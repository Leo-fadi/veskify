import {
  catalogueDisplayModelSchema,
  type CatalogueDisplayModel,
  type ProductDisplayModel,
} from "@/domain/catalogue";
import { resolveLocalizedText, type Locale, type LocalizedText } from "@/domain/shared";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  STOREFRONT_SEARCH_AUTHORITY_CONTRACT_VERSION,
  STOREFRONT_SEARCH_RESULTS_CONTRACT_VERSION,
  STOREFRONT_SEARCHABLE_FIELDS,
  StorefrontSearchError,
  foldStorefrontSearchText,
  normalizeStorefrontSearchFilters,
  normalizeStorefrontSearchQuery,
  storefrontSearchAuthorityFingerprint,
  storefrontSearchAuthorityV1Schema,
  storefrontSearchRequestFingerprint,
  storefrontSearchRequestV1Schema,
  storefrontSearchResultFingerprint,
  storefrontSearchResultPageV1Schema,
  type StorefrontProductSearchPort,
  type StorefrontSearchAuthorityV1,
  type StorefrontSearchFacetSummaryV1,
  type StorefrontSearchFilterField,
  type StorefrontSearchFilterSelectionV1,
  type StorefrontSearchRequestV1,
  type StorefrontSearchResultMaterialV1,
  type StorefrontSearchResultPageV1,
} from "@/application/storefront-search";

export type StandaloneCatalogueSearchDiagnostics = Readonly<{
  catalogueProductCount: number;
  eligibleProductCount: number;
  collectionMembershipCount: number;
  searchableValueCount: number;
  termComparisonCount: number;
  normalizedTermCount: number;
  resultCount: number;
}>;

type DiagnosticsCounter = {
  searchableValueCount: number;
  termComparisonCount: number;
};

type SearchCandidate = {
  product: ProductDisplayModel;
  productId: string;
  catalogueIndex: number;
  routeIndex: number;
  relevanceTier: number;
  normalizedTitle: string;
  filterValues: Readonly<Record<StorefrontSearchFilterField, string | undefined>>;
};

const filterFields = ["brand", "category", "productType", "stockStatus"] as const;

const provisionalSearchMarkers = [
  "verify live",
  "requires verification",
  "not captured",
  "canonical products",
  "protected authority",
  "runtime commerce routes",
  "checkout authority",
] as const;

/** Explicit customer-facing attribute projection for the standalone catalogue adapter. */
export const STANDALONE_STOREFRONT_SEARCHABLE_ATTRIBUTE_KEYS = [
  "audience",
  "caseSizeMm",
  "chainLengthsCm",
  "colour",
  "fineness",
  "karat",
  "material",
  "metalColour",
  "movement",
  "ringSizes",
  "size",
  "sizeRange",
  "stoneColour",
  "stoneSetting",
  "stoneShape",
  "stoneType",
  "strapMaterial",
  "styleTags",
  "watchBrand",
  "watchModel",
  "waterResistance",
] as const;

export function createStandaloneStorefrontSearchAuthority({
  catalogue,
  primaryLocale,
  enabledLocales,
  productRoutes,
  searchableFields = STOREFRONT_SEARCHABLE_FIELDS,
  searchableAttributeKeys = STANDALONE_STOREFRONT_SEARCHABLE_ATTRIBUTE_KEYS,
}: {
  catalogue: CatalogueDisplayModel;
  primaryLocale: Locale;
  enabledLocales: readonly Locale[];
  productRoutes: readonly Readonly<{ productId: string; route: string }>[];
  searchableFields?: readonly (typeof STOREFRONT_SEARCHABLE_FIELDS)[number][];
  searchableAttributeKeys?: readonly string[];
}): StorefrontSearchAuthorityV1 {
  const parsedCatalogue = catalogueDisplayModelSchema.parse(catalogue);
  const supportedAttributeKeys = new Set<string>(STANDALONE_STOREFRONT_SEARCHABLE_ATTRIBUTE_KEYS);
  if (searchableAttributeKeys.some((key) => !supportedAttributeKeys.has(key))) {
    throw new StorefrontSearchError(
      "invalid-authority",
      "The standalone search authority contains an unsupported customer-facing attribute.",
    );
  }
  return storefrontSearchAuthorityV1Schema.parse({
    contractVersion: STOREFRONT_SEARCH_AUTHORITY_CONTRACT_VERSION,
    catalogueFingerprint: canonicalValueFingerprint(parsedCatalogue),
    primaryLocale,
    enabledLocales: [...enabledLocales],
    productRoutes: productRoutes.map(({ productId, route }) => ({ productId, route })),
    searchableFields: [...searchableFields],
    searchableAttributeKeys: [...searchableAttributeKeys],
  });
}

function compareCanonical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function localized(
  value: LocalizedText | undefined,
  request: StorefrontSearchRequestV1,
  authority: StorefrontSearchAuthorityV1,
): string | undefined {
  if (!value) return undefined;
  const resolved = resolveLocalizedText(value, request.locale, authority.primaryLocale);
  return resolved === "" ? undefined : resolved;
}

function attributeValues(value: string | number | string[]): string[] {
  return Array.isArray(value) ? value : [String(value)];
}

function customerSearchableSupportingValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const folded = foldStorefrontSearchText(value);
  if (folded === "") return undefined;
  return provisionalSearchMarkers.some((marker) => folded.includes(marker)) ? undefined : folded;
}

function normalizedValues(
  values: readonly (string | undefined)[],
  diagnostics: DiagnosticsCounter,
) {
  return values.flatMap((value) => {
    if (!value) return [];
    const normalized = foldStorefrontSearchText(value);
    if (normalized === "") return [];
    diagnostics.searchableValueCount += 1;
    return [normalized];
  });
}

function normalizedSupportingValues(
  values: readonly (string | undefined)[],
  diagnostics: DiagnosticsCounter,
) {
  return values.flatMap((value) => {
    const normalized = customerSearchableSupportingValue(value);
    if (!normalized) return [];
    diagnostics.searchableValueCount += 1;
    return [normalized];
  });
}

function everyTermMatches(
  terms: readonly string[],
  values: readonly string[],
  diagnostics: DiagnosticsCounter,
  mode: "token" | "prefix",
): boolean {
  const tokens = values.flatMap((value) => value.split(" "));
  return terms.every((term) => {
    for (const token of tokens) {
      diagnostics.termComparisonCount += 1;
      if (mode === "token" ? token === term : token.startsWith(term)) return true;
    }
    return false;
  });
}

function relevanceTier({
  query,
  terms,
  sku,
  title,
  structured,
  collectionTitles,
  supporting,
  diagnostics,
}: {
  query: string;
  terms: readonly string[];
  sku: string | undefined;
  title: string;
  structured: readonly string[];
  collectionTitles: readonly string[];
  supporting: readonly string[];
  diagnostics: DiagnosticsCounter;
}): number | undefined {
  if (sku === query) return 1;
  if (title === query) return 2;
  if (everyTermMatches(terms, [title], diagnostics, "token")) return 3;
  if (everyTermMatches(terms, [title], diagnostics, "prefix")) return 4;
  if (everyTermMatches(terms, structured, diagnostics, "prefix")) return 5;
  if (everyTermMatches(terms, collectionTitles, diagnostics, "prefix")) return 6;
  const allSearchableValues = [
    title,
    ...(sku ? [sku] : []),
    ...structured,
    ...collectionTitles,
    ...supporting,
  ];
  return everyTermMatches(terms, allSearchableValues, diagnostics, "prefix") ? 7 : undefined;
}

function filterValue(product: ProductDisplayModel, field: StorefrontSearchFilterField) {
  if (field === "brand") return product.brand;
  if (field === "category") return product.category;
  if (field === "productType") return product.productType;
  return product.stockStatus;
}

function matchesFilters(
  candidate: SearchCandidate,
  filters: readonly StorefrontSearchFilterSelectionV1[],
): boolean {
  return filters.every(({ field, values }) => {
    const candidateValue = candidate.filterValues[field];
    if (!candidateValue) return false;
    const normalizedCandidate = foldStorefrontSearchText(candidateValue);
    return values.some((value) => foldStorefrontSearchText(value) === normalizedCandidate);
  });
}

function facetsFor(candidates: readonly SearchCandidate[]): StorefrontSearchFacetSummaryV1[] {
  return filterFields.flatMap((field) => {
    const counts = new Map<string, { value: string; count: number }>();
    for (const candidate of candidates) {
      const value = candidate.filterValues[field];
      if (!value) continue;
      const key = foldStorefrontSearchText(value);
      const current = counts.get(key);
      counts.set(key, current ? { ...current, count: current.count + 1 } : { value, count: 1 });
    }
    if (counts.size < 2 || counts.size > 100) return [];
    return [
      {
        field,
        values: [...counts.values()].sort((left, right) =>
          compareCanonical(left.value, right.value),
        ),
      },
    ];
  });
}

function canonicalTieBreak(left: SearchCandidate, right: SearchCandidate): number {
  return (
    left.catalogueIndex - right.catalogueIndex ||
    left.routeIndex - right.routeIndex ||
    compareCanonical(left.productId, right.productId)
  );
}

function sortCandidates(
  candidates: readonly SearchCandidate[],
  request: StorefrontSearchRequestV1,
): SearchCandidate[] {
  return [...candidates].sort((left, right) => {
    if (request.sort === "relevance") {
      return left.relevanceTier - right.relevanceTier || canonicalTieBreak(left, right);
    }
    if (request.sort === "title-ascending") {
      return (
        compareCanonical(left.normalizedTitle, right.normalizedTitle) ||
        canonicalTieBreak(left, right)
      );
    }
    const leftPrice = left.product.price?.amount;
    const rightPrice = right.product.price?.amount;
    if (leftPrice === undefined || rightPrice === undefined) {
      if (leftPrice === rightPrice) return canonicalTieBreak(left, right);
      return leftPrice === undefined ? 1 : -1;
    }
    const priceDifference =
      request.sort === "price-ascending" ? leftPrice - rightPrice : rightPrice - leftPrice;
    return priceDifference || canonicalTieBreak(left, right);
  });
}

function createResult(material: StorefrontSearchResultMaterialV1): StorefrontSearchResultPageV1 {
  return storefrontSearchResultPageV1Schema.parse({
    ...material,
    resultFingerprint: storefrontSearchResultFingerprint(material),
  });
}

export function createStandaloneCatalogueProductSearchAdapter({
  catalogue: catalogueInput,
  onDiagnostics,
}: {
  catalogue: CatalogueDisplayModel;
  onDiagnostics?: (diagnostics: StandaloneCatalogueSearchDiagnostics) => void;
}): StorefrontProductSearchPort {
  const catalogue = catalogueDisplayModelSchema.parse(catalogueInput);
  const catalogueFingerprint = canonicalValueFingerprint(catalogue);
  const productById = new Map(catalogue.products.map((product) => [product.id, product]));
  const catalogueIndexByProductId = new Map(
    catalogue.products.map((product, index) => [product.id, index]),
  );

  return {
    search(requestInput, authorityInput) {
      const parsedRequest = storefrontSearchRequestV1Schema.safeParse(requestInput);
      if (!parsedRequest.success) {
        throw new StorefrontSearchError(
          "invalid-request",
          "The storefront search request is invalid.",
        );
      }
      const parsedAuthority = storefrontSearchAuthorityV1Schema.safeParse(authorityInput);
      if (!parsedAuthority.success) {
        throw new StorefrontSearchError(
          "invalid-authority",
          "The current storefront search authority is invalid.",
        );
      }
      const request = parsedRequest.data;
      const authority = parsedAuthority.data;
      if (authority.catalogueFingerprint !== catalogueFingerprint) {
        throw new StorefrontSearchError(
          "stale-catalogue-authority",
          "The storefront search authority does not match the current catalogue.",
        );
      }
      if (!authority.enabledLocales.includes(request.locale)) {
        throw new StorefrontSearchError(
          "unsupported-locale",
          "The requested storefront search locale is unavailable.",
        );
      }
      for (const { productId } of authority.productRoutes) {
        if (!productById.has(productId)) {
          throw new StorefrontSearchError(
            "invalid-authority",
            "A searchable public product route is unavailable in the current catalogue.",
          );
        }
      }

      const authorityFingerprint = storefrontSearchAuthorityFingerprint(authority);
      const normalized = normalizeStorefrontSearchQuery(request.rawQuery);
      const appliedFilters = normalizeStorefrontSearchFilters(request.filters);
      const requestFingerprint = storefrontSearchRequestFingerprint({
        request,
        authority,
        authorityFingerprint,
        normalized,
      });
      const baseMaterial = {
        contractVersion: STOREFRONT_SEARCH_RESULTS_CONTRACT_VERSION,
        requestFingerprint,
        catalogueFingerprint,
        authorityFingerprint,
        page: request.page,
        pageSize: request.pageSize,
        appliedFilters,
        sort: request.sort,
      } as const;
      if (normalized.normalizedTerms.length === 0) {
        const result = createResult({
          ...baseMaterial,
          state: "empty-query",
          normalizedQuery: "",
          normalizedTerms: [],
          totalCount: 0,
          productIds: [],
          availableFacets: [],
        });
        onDiagnostics?.({
          catalogueProductCount: catalogue.products.length,
          eligibleProductCount: authority.productRoutes.length,
          collectionMembershipCount: 0,
          searchableValueCount: 0,
          termComparisonCount: 0,
          normalizedTermCount: 0,
          resultCount: 0,
        });
        return result;
      }

      const routeIndexByProductId = new Map(
        authority.productRoutes.map(({ productId }, index) => [productId, index]),
      );
      const collectionTitlesByProductId = new Map<string, string[]>();
      let collectionMembershipCount = 0;
      if (authority.searchableFields.includes("collection-title")) {
        for (const collection of catalogue.collections) {
          const title = localized(collection.title, request, authority);
          for (const productId of collection.productIds) {
            collectionMembershipCount += 1;
            if (!routeIndexByProductId.has(productId) || !title) continue;
            const titles = collectionTitlesByProductId.get(productId) ?? [];
            titles.push(title);
            collectionTitlesByProductId.set(productId, titles);
          }
        }
      }

      const fields = new Set(authority.searchableFields);
      const diagnostics: DiagnosticsCounter = { searchableValueCount: 0, termComparisonCount: 0 };
      const foldedQuery = foldStorefrontSearchText(normalized.normalizedQuery);
      const candidates: SearchCandidate[] = [];
      for (const { productId } of authority.productRoutes) {
        const product = productById.get(productId)!;
        const title = foldStorefrontSearchText(localized(product.title, request, authority) ?? "");
        diagnostics.searchableValueCount += 1;
        const sku = fields.has("sku") ? foldStorefrontSearchText(product.sku ?? "") : undefined;
        if (sku) diagnostics.searchableValueCount += 1;
        const structured = normalizedValues(
          [
            fields.has("brand") ? product.brand : undefined,
            fields.has("category") ? product.category : undefined,
            fields.has("product-type") ? product.productType : undefined,
          ],
          diagnostics,
        );
        const collectionTitles = normalizedValues(
          fields.has("collection-title") ? (collectionTitlesByProductId.get(productId) ?? []) : [],
          diagnostics,
        );
        const supporting = normalizedSupportingValues(
          [
            fields.has("localized-description")
              ? localized(product.description, request, authority)
              : undefined,
            ...(fields.has("allowlisted-attributes")
              ? authority.searchableAttributeKeys.flatMap((key) => {
                  const value = product.attributes[key];
                  return value === undefined ? [] : attributeValues(value);
                })
              : []),
          ],
          diagnostics,
        );
        const tier = relevanceTier({
          query: foldedQuery,
          terms: normalized.normalizedTerms,
          sku,
          title,
          structured,
          collectionTitles,
          supporting,
          diagnostics,
        });
        if (tier === undefined) continue;
        candidates.push({
          product,
          productId,
          catalogueIndex: catalogueIndexByProductId.get(productId)!,
          routeIndex: routeIndexByProductId.get(productId)!,
          relevanceTier: tier,
          normalizedTitle: title,
          filterValues: Object.fromEntries(
            filterFields.map((field) => [field, filterValue(product, field)]),
          ) as Readonly<Record<StorefrontSearchFilterField, string | undefined>>,
        });
      }

      const availableFacets = facetsFor(candidates);
      const filtered = candidates.filter((candidate) => matchesFilters(candidate, appliedFilters));
      const sorted = sortCandidates(filtered, request);
      const pageStart = (request.page - 1) * request.pageSize;
      if (sorted.length > 0 && pageStart >= sorted.length) {
        throw new StorefrontSearchError(
          "invalid-request",
          "The requested storefront search page is unavailable.",
        );
      }
      const productIds = sorted
        .slice(pageStart, pageStart + request.pageSize)
        .map(({ productId }) => productId);
      const result = createResult({
        ...baseMaterial,
        state: "results",
        normalizedQuery: normalized.normalizedQuery,
        normalizedTerms: [...normalized.normalizedTerms],
        totalCount: sorted.length,
        productIds,
        availableFacets,
      });
      onDiagnostics?.({
        catalogueProductCount: catalogue.products.length,
        eligibleProductCount: authority.productRoutes.length,
        collectionMembershipCount,
        searchableValueCount: diagnostics.searchableValueCount,
        termComparisonCount: diagnostics.termComparisonCount,
        normalizedTermCount: normalized.normalizedTerms.length,
        resultCount: sorted.length,
      });
      return result;
    },
  };
}
