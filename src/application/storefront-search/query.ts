import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  STOREFRONT_SEARCH_MAX_TERMS,
  StorefrontSearchError,
  storefrontSearchAuthorityFingerprint,
  storefrontSearchAuthorityV1Schema,
  storefrontSearchFilterSelectionV1Schema,
  storefrontSearchRequestV1Schema,
  storefrontSearchResultPageV1Schema,
  type StorefrontSearchAuthorityV1,
  type StorefrontSearchFilterSelectionV1,
  type StorefrontSearchRequestV1,
  type StorefrontSearchResultPageV1,
} from "./contract";

export type NormalizedStorefrontSearchQuery = Readonly<{
  normalizedQuery: string;
  normalizedTerms: readonly string[];
}>;

const compareCanonical = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

export function foldStorefrontSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("und")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function normalizeStorefrontSearchQuery(rawQuery: string): NormalizedStorefrontSearchQuery {
  const displayQuery = rawQuery.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const folded = foldStorefrontSearchText(displayQuery);
  if (folded === "") return { normalizedQuery: "", normalizedTerms: [] };
  const normalizedTerms = [...new Set(folded.split(" "))];
  if (normalizedTerms.length > STOREFRONT_SEARCH_MAX_TERMS) {
    throw new StorefrontSearchError(
      "too-many-terms",
      `Search queries support at most ${STOREFRONT_SEARCH_MAX_TERMS} normalized terms.`,
    );
  }
  return { normalizedQuery: displayQuery, normalizedTerms };
}

export function normalizeStorefrontSearchFilters(
  filters: readonly StorefrontSearchFilterSelectionV1[],
): StorefrontSearchFilterSelectionV1[] {
  return filters
    .map((filter) =>
      storefrontSearchFilterSelectionV1Schema.parse({
        field: filter.field,
        values: [...filter.values].sort(compareCanonical),
      }),
    )
    .sort((left, right) => compareCanonical(left.field, right.field));
}

export function storefrontSearchRequestFingerprint({
  request,
  authority,
  authorityFingerprint,
  normalized,
}: {
  request: StorefrontSearchRequestV1;
  authority: StorefrontSearchAuthorityV1;
  authorityFingerprint: string;
  normalized: NormalizedStorefrontSearchQuery;
}): string {
  return `storefront-search-request-${canonicalValueFingerprint({
    contractVersion: request.contractVersion,
    catalogueFingerprint: authority.catalogueFingerprint,
    authorityFingerprint,
    locale: request.locale,
    normalizedQuery: normalized.normalizedQuery,
    normalizedTerms: normalized.normalizedTerms,
    page: request.page,
    pageSize: request.pageSize,
    sort: request.sort,
    filters: normalizeStorefrontSearchFilters(request.filters),
  })}`;
}

/**
 * Rebinds an adapter result to the exact server-owned request and authority.
 * A search-port result is untrusted until these independently
 * derived fingerprints and normalized request fields match.
 */
export function validateStorefrontSearchResultForRequest({
  result: resultInput,
  request: requestInput,
  authority: authorityInput,
}: {
  result: unknown;
  request: StorefrontSearchRequestV1;
  authority: StorefrontSearchAuthorityV1;
}): StorefrontSearchResultPageV1 {
  const request = storefrontSearchRequestV1Schema.parse(requestInput);
  const authority = storefrontSearchAuthorityV1Schema.parse(authorityInput);
  const result = storefrontSearchResultPageV1Schema.parse(resultInput);
  const authorityFingerprint = storefrontSearchAuthorityFingerprint(authority);
  const normalized = normalizeStorefrontSearchQuery(request.rawQuery);
  const requestFingerprint = storefrontSearchRequestFingerprint({
    request,
    authority,
    authorityFingerprint,
    normalized,
  });
  const expectedRequestMaterial = {
    requestFingerprint,
    catalogueFingerprint: authority.catalogueFingerprint,
    authorityFingerprint,
    normalizedQuery: normalized.normalizedQuery,
    normalizedTerms: normalized.normalizedTerms,
    page: request.page,
    pageSize: request.pageSize,
    appliedFilters: normalizeStorefrontSearchFilters(request.filters),
    sort: request.sort,
  };
  const actualRequestMaterial = {
    requestFingerprint: result.requestFingerprint,
    catalogueFingerprint: result.catalogueFingerprint,
    authorityFingerprint: result.authorityFingerprint,
    normalizedQuery: result.normalizedQuery,
    normalizedTerms: result.normalizedTerms,
    page: result.page,
    pageSize: result.pageSize,
    appliedFilters: result.appliedFilters,
    sort: result.sort,
  };
  if (
    canonicalValueFingerprint(actualRequestMaterial) !==
    canonicalValueFingerprint(expectedRequestMaterial)
  ) {
    throw new StorefrontSearchError(
      "invalid-authority",
      "The storefront search result does not match the current request authority.",
    );
  }
  const routedProductIds = new Set(authority.productRoutes.map(({ productId }) => productId));
  if (result.productIds.some((productId) => !routedProductIds.has(productId))) {
    throw new StorefrontSearchError(
      "invalid-authority",
      "The storefront search result contains a product without current route authority.",
    );
  }
  return result;
}
