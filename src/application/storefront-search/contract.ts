import { z } from "zod";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { idSchema, localeSchema } from "@/domain/shared";

export const STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION = "storefront-search-request-v1" as const;
export const STOREFRONT_SEARCH_RESULTS_CONTRACT_VERSION = "storefront-search-results-v1" as const;
export const STOREFRONT_SEARCH_AUTHORITY_CONTRACT_VERSION =
  "storefront-search-authority-v1" as const;

export const STOREFRONT_SEARCH_PAGE_SIZES = [12, 24, 36, 48] as const;
export const STOREFRONT_SEARCH_DEFAULT_PAGE_SIZE = 24 as const;
export const STOREFRONT_SEARCH_MAX_TERMS = 12 as const;

const storefrontSearchPageSizeSchema = z.union([
  z.literal(12),
  z.literal(24),
  z.literal(36),
  z.literal(48),
]);

export const storefrontSearchSortSchema = z.enum([
  "relevance",
  "price-ascending",
  "price-descending",
  "title-ascending",
]);

export const storefrontSearchFilterFieldSchema = z.enum([
  "brand",
  "category",
  "productType",
  "stockStatus",
]);

const boundedFilterValueSchema = z.string().trim().min(1).max(120);

export const storefrontSearchFilterSelectionV1Schema = z
  .object({
    field: storefrontSearchFilterFieldSchema,
    values: z
      .array(boundedFilterValueSchema)
      .min(1)
      .max(20)
      .superRefine((values, context) => {
        if (new Set(values).size !== values.length) {
          context.addIssue({
            code: "custom",
            message: "Search filter values must be unique.",
          });
        }
      }),
  })
  .strict()
  .superRefine((filter, context) => {
    if (
      filter.field === "stockStatus" &&
      filter.values.some((value) => !["inStock", "lowStock", "outOfStock"].includes(value))
    ) {
      context.addIssue({
        code: "custom",
        path: ["values"],
        message: "Stock-status filters must use current canonical status values.",
      });
    }
  });

const normalizedRawQuerySchema = z
  .string()
  .transform((value) => value.normalize("NFKC").trim().replace(/\s+/gu, " "))
  .pipe(z.string().max(120));

export const storefrontSearchRequestV1Schema = z
  .object({
    contractVersion: z.literal(STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION),
    rawQuery: normalizedRawQuerySchema,
    locale: localeSchema,
    page: z.number().int().min(1).max(10_000),
    pageSize: storefrontSearchPageSizeSchema,
    sort: storefrontSearchSortSchema,
    filters: z.array(storefrontSearchFilterSelectionV1Schema).max(12),
  })
  .strict()
  .superRefine((request, context) => {
    const fields = request.filters.map(({ field }) => field);
    if (new Set(fields).size !== fields.length) {
      context.addIssue({
        code: "custom",
        path: ["filters"],
        message: "A search filter field may be selected at most once.",
      });
    }
  });

export const STOREFRONT_SEARCHABLE_FIELDS = [
  "sku",
  "localized-title",
  "brand",
  "category",
  "product-type",
  "collection-title",
  "localized-description",
  "allowlisted-attributes",
] as const;

export const storefrontSearchableFieldSchema = z.enum(STOREFRONT_SEARCHABLE_FIELDS);

const productRouteSchema = z
  .object({
    productId: idSchema,
    route: z
      .string()
      .trim()
      .regex(/^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "Searchable products require exact canonical /products/<slug> routes.",
      }),
  })
  .strict();

const attributeKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/);

const fingerprintSchema = z.string().trim().min(1).max(240);

/**
 * Server-attested search authority. A product route entry means the product has
 * both current public route authority and a current PDP presentation mapping.
 */
export const storefrontSearchAuthorityV1Schema = z
  .object({
    contractVersion: z.literal(STOREFRONT_SEARCH_AUTHORITY_CONTRACT_VERSION),
    catalogueFingerprint: fingerprintSchema,
    primaryLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1).max(2),
    productRoutes: z.array(productRouteSchema),
    searchableFields: z.array(storefrontSearchableFieldSchema).min(1),
    searchableAttributeKeys: z.array(attributeKeySchema).max(40),
  })
  .strict()
  .superRefine((authority, context) => {
    const productIds = authority.productRoutes.map(({ productId }) => productId);
    const routes = authority.productRoutes.map(({ route }) => route);
    for (const [values, path, message] of [
      [authority.enabledLocales, ["enabledLocales"], "Enabled search locales must be unique."],
      [productIds, ["productRoutes"], "Search product route identities must be unique."],
      [routes, ["productRoutes"], "Search product routes must be unique."],
      [authority.searchableFields, ["searchableFields"], "Searchable fields must be unique."],
      [
        authority.searchableAttributeKeys,
        ["searchableAttributeKeys"],
        "Searchable attribute keys must be unique.",
      ],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", path: [...path], message });
      }
    }
    if (!authority.enabledLocales.includes(authority.primaryLocale)) {
      context.addIssue({
        code: "custom",
        path: ["primaryLocale"],
        message: "The primary search locale must be enabled.",
      });
    }
    if (!authority.searchableFields.includes("localized-title")) {
      context.addIssue({
        code: "custom",
        path: ["searchableFields"],
        message: "Canonical localized product titles must remain searchable.",
      });
    }
    if (
      authority.searchableAttributeKeys.length > 0 &&
      !authority.searchableFields.includes("allowlisted-attributes")
    ) {
      context.addIssue({
        code: "custom",
        path: ["searchableAttributeKeys"],
        message: "Attribute keys require the allowlisted-attributes searchable field.",
      });
    }
  });

export const storefrontSearchFacetValueV1Schema = z
  .object({ value: boundedFilterValueSchema, count: z.number().int().positive() })
  .strict();

export const storefrontSearchFacetSummaryV1Schema = z
  .object({
    field: storefrontSearchFilterFieldSchema,
    values: z.array(storefrontSearchFacetValueV1Schema).min(2).max(100),
  })
  .strict()
  .superRefine((facet, context) => {
    const values = facet.values.map(({ value }) => value);
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: "custom",
        path: ["values"],
        message: "Facet values must be unique.",
      });
    }
  });

const storefrontSearchResultMaterialSchema = z
  .object({
    contractVersion: z.literal(STOREFRONT_SEARCH_RESULTS_CONTRACT_VERSION),
    state: z.enum(["empty-query", "results"]),
    requestFingerprint: fingerprintSchema,
    catalogueFingerprint: fingerprintSchema,
    authorityFingerprint: fingerprintSchema,
    normalizedQuery: z.string().max(120),
    normalizedTerms: z.array(z.string().min(1).max(120)).max(STOREFRONT_SEARCH_MAX_TERMS),
    totalCount: z.number().int().nonnegative(),
    page: z.number().int().min(1).max(10_000),
    pageSize: storefrontSearchPageSizeSchema,
    productIds: z.array(idSchema).max(48),
    availableFacets: z.array(storefrontSearchFacetSummaryV1Schema).max(12),
    appliedFilters: z.array(storefrontSearchFilterSelectionV1Schema).max(12),
    sort: storefrontSearchSortSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (new Set(result.productIds).size !== result.productIds.length) {
      context.addIssue({
        code: "custom",
        path: ["productIds"],
        message: "Search result product identities must be unique.",
      });
    }
    if (result.productIds.length > result.pageSize) {
      context.addIssue({
        code: "custom",
        path: ["productIds"],
        message: "A search result page cannot exceed its bounded page size.",
      });
    }
    if (
      result.state === "empty-query" &&
      (result.normalizedQuery !== "" ||
        result.normalizedTerms.length !== 0 ||
        result.totalCount !== 0 ||
        result.productIds.length !== 0 ||
        result.availableFacets.length !== 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["state"],
        message: "The governed empty-query state cannot contain search results.",
      });
    }
    if (result.state === "results" && result.normalizedTerms.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["normalizedTerms"],
        message: "A results state requires at least one normalized search term.",
      });
    }
    if (result.state === "results") {
      const pageStart = (result.page - 1) * result.pageSize;
      if (result.totalCount > 0 && pageStart >= result.totalCount) {
        context.addIssue({
          code: "custom",
          path: ["page"],
          message: "The requested search result page exceeds the available result set.",
        });
      } else {
        const expectedPageCount = Math.min(
          result.pageSize,
          Math.max(0, result.totalCount - pageStart),
        );
        if (result.productIds.length !== expectedPageCount) {
          context.addIssue({
            code: "custom",
            path: ["productIds"],
            message: "The search result page must contain its exact bounded membership.",
          });
        }
      }
    }
  });

export const storefrontSearchResultPageV1Schema = storefrontSearchResultMaterialSchema
  .extend({ resultFingerprint: fingerprintSchema })
  .strict()
  .superRefine((result, context) => {
    const { resultFingerprint: _resultFingerprint, ...material } = result;
    if (_resultFingerprint !== storefrontSearchResultFingerprint(material)) {
      context.addIssue({
        code: "custom",
        path: ["resultFingerprint"],
        message: "The search result fingerprint must bind the exact transient result material.",
      });
    }
  });

export type StorefrontSearchSort = z.infer<typeof storefrontSearchSortSchema>;
export type StorefrontSearchFilterField = z.infer<typeof storefrontSearchFilterFieldSchema>;
export type StorefrontSearchFilterSelectionV1 = z.infer<
  typeof storefrontSearchFilterSelectionV1Schema
>;
export type StorefrontSearchRequestV1 = z.infer<typeof storefrontSearchRequestV1Schema>;
export type StorefrontSearchAuthorityV1 = z.infer<typeof storefrontSearchAuthorityV1Schema>;
export type StorefrontSearchFacetSummaryV1 = z.infer<typeof storefrontSearchFacetSummaryV1Schema>;
export type StorefrontSearchResultPageV1 = z.infer<typeof storefrontSearchResultPageV1Schema>;
export type StorefrontSearchResultMaterialV1 = z.infer<typeof storefrontSearchResultMaterialSchema>;

export interface StorefrontProductSearchPort {
  search(
    request: StorefrontSearchRequestV1,
    authority: StorefrontSearchAuthorityV1,
  ): StorefrontSearchResultPageV1;
}

export type StorefrontSearchErrorCode =
  | "invalid-request"
  | "invalid-authority"
  | "stale-catalogue-authority"
  | "unsupported-locale"
  | "too-many-terms";

export class StorefrontSearchError extends Error {
  readonly code: StorefrontSearchErrorCode;

  constructor(code: StorefrontSearchErrorCode, message: string) {
    super(message);
    this.name = "StorefrontSearchError";
    this.code = code;
  }
}

export function storefrontSearchAuthorityFingerprint(
  authorityInput: StorefrontSearchAuthorityV1,
): string {
  const authority = storefrontSearchAuthorityV1Schema.parse(authorityInput);
  return `storefront-search-authority-${canonicalValueFingerprint(authority)}`;
}

export function storefrontSearchResultFingerprint(
  materialInput: StorefrontSearchResultMaterialV1,
): string {
  const material = storefrontSearchResultMaterialSchema.parse(materialInput);
  return `storefront-search-result-${canonicalValueFingerprint(material)}`;
}
