import { describe, expect, it } from "vitest";
import {
  STOREFRONT_SEARCH_AUTHORITY_CONTRACT_VERSION,
  STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
  StorefrontSearchError,
  buildStorefrontSearchUrl,
  normalizeStorefrontSearchQuery,
  splitStorefrontSearchFormTarget,
  storefrontSearchRequestV1Schema,
  storefrontSearchResultFingerprint,
  storefrontSearchResultPageV1Schema,
  type StorefrontSearchRequestV1,
} from "@/application/storefront-search";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  createStandaloneCatalogueProductSearchAdapter,
  createStandaloneStorefrontSearchAuthority,
  type StandaloneCatalogueSearchDiagnostics,
} from "@/integrations/storefront-search";

const text = (en: string, fi = en) => ({ en, fi });

function fixtureCatalogue(): CatalogueDisplayModel {
  return catalogueDisplayModelSchema.parse({
    id: "catalogue_search_fixture",
    products: [
      {
        id: "product_aurora_gold_ring",
        sku: "AUR-585",
        title: text("Aurora Gold Ring", "Aurora-kultasormus"),
        description: text("A refined bridal ring", "Hienostunut vihkisormus"),
        brand: "Aurum Nordic",
        category: "Rings",
        price: { amount: 790, currency: "EUR" },
        stockStatus: "inStock",
        images: [
          {
            id: "asset_search_aurora",
            url: "/seed-assets/aurora-ring.svg",
            alt: text("Aurora ring"),
            decorative: false,
          },
        ],
        productType: "ring",
        attributes: { material: "gold", fineness: "585", styleTags: ["bridal", "minimal"] },
        variants: [],
      },
      {
        id: "product_lumi_gold_ring",
        sku: "LUM-585",
        title: text("Lumi Gold Ring", "Lumi-kultasormus"),
        description: text("A luminous gold ring", "Valoisa kultasormus"),
        brand: "Aurum Nordic",
        category: "Rings",
        price: { amount: 990, currency: "EUR" },
        stockStatus: "lowStock",
        images: [
          {
            id: "asset_search_lumi",
            url: "/seed-assets/lumi-halo-ring.svg",
            alt: text("Lumi ring"),
            decorative: false,
          },
        ],
        productType: "ring",
        attributes: { material: "gold", fineness: "585", styleTags: ["celebration"] },
        variants: [],
      },
      {
        id: "product_sade_silver_necklace",
        sku: "NECK-SADE-925",
        title: text("Säde Silver Necklace", "Säde-hopeakoru"),
        description: text("A bright everyday necklace", "Kirkas arkinen kaulakoru"),
        brand: "Aurum Nordic",
        category: "Necklaces",
        price: { amount: 149, currency: "EUR" },
        stockStatus: "inStock",
        images: [
          {
            id: "asset_search_sade",
            url: "/seed-assets/aava-necklace.svg",
            alt: text("Säde necklace"),
            decorative: false,
          },
        ],
        productType: "pendant",
        attributes: { material: "silver", fineness: "925", internalNote: "verification-only" },
        variants: [],
      },
      {
        id: "product_provisional_sample",
        sku: "SAMPLE-01",
        title: text("Reference Sample"),
        description: text("Material requires verification before publication"),
        brand: "Workshop",
        category: "Samples",
        priceUnavailableReason: text("Unavailable"),
        stockStatus: "outOfStock",
        images: [
          {
            id: "asset_search_sample",
            url: "/seed-assets/kajo-earrings.svg",
            alt: text("Reference sample"),
            decorative: false,
          },
        ],
        productType: "sample",
        attributes: { internalNote: "verify live", material: "not captured" },
        variants: [],
      },
      {
        id: "product_hidden_secret",
        sku: "HIDDEN-99",
        title: text("Secret Necklace"),
        description: text("Not publicly routed"),
        brand: "Aurum Nordic",
        category: "Necklaces",
        price: { amount: 199, currency: "EUR" },
        stockStatus: "inStock",
        images: [
          {
            id: "asset_search_hidden",
            url: "/seed-assets/aava-necklace.svg",
            alt: text("Hidden necklace"),
            decorative: false,
          },
        ],
        productType: "necklace",
        attributes: { material: "silver", fineness: "925" },
        variants: [],
      },
    ],
    collections: [
      {
        id: "collection_wedding_rings",
        slug: "wedding-rings",
        title: text("Wedding Rings", "Vihkisormukset"),
        description: text("Rings for lasting promises", "Sormuksia kestäviin lupauksiin"),
        productIds: ["product_aurora_gold_ring", "product_lumi_gold_ring"],
      },
      {
        id: "collection_necklaces",
        slug: "necklaces",
        title: text("Necklaces", "Kaulakorut"),
        description: text("Canonical necklaces", "Kaulakorut"),
        productIds: ["product_sade_silver_necklace", "product_hidden_secret"],
      },
    ],
  });
}

function productRoutes(catalogue: CatalogueDisplayModel) {
  return catalogue.products
    .filter(({ id }) => id !== "product_hidden_secret")
    .map(({ id }, index) => ({ productId: id, route: `/products/search-product-${index + 1}` }));
}

function searchRequest(
  rawQuery: string,
  overrides: Partial<Omit<StorefrontSearchRequestV1, "contractVersion" | "rawQuery">> = {},
): StorefrontSearchRequestV1 {
  return storefrontSearchRequestV1Schema.parse({
    contractVersion: STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
    rawQuery,
    locale: "en",
    page: 1,
    pageSize: 24,
    sort: "relevance",
    filters: [],
    ...overrides,
  });
}

function fixtureSearch() {
  const catalogue = fixtureCatalogue();
  const authority = createStandaloneStorefrontSearchAuthority({
    catalogue,
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    productRoutes: productRoutes(catalogue),
  });
  return {
    catalogue,
    authority,
    adapter: createStandaloneCatalogueProductSearchAdapter({ catalogue }),
  };
}

describe("P10B-16P-06 canonical standalone search adapter", () => {
  it("builds one immutable locale index and invalidates it only for exact authority changes", () => {
    const catalogue = fixtureCatalogue();
    const authority = createStandaloneStorefrontSearchAuthority({
      catalogue,
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      productRoutes: productRoutes(catalogue),
    });
    const narrowedAuthority = createStandaloneStorefrontSearchAuthority({
      catalogue,
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      productRoutes: productRoutes(catalogue).slice(0, 1),
    });
    const diagnostics: StandaloneCatalogueSearchDiagnostics[] = [];
    const adapter = createStandaloneCatalogueProductSearchAdapter({
      catalogue,
      onDiagnostics: (value) => diagnostics.push(value),
    });

    const first = adapter.search(searchRequest("ring"), authority);
    const repeated = adapter.search(searchRequest("ring"), authority);
    const narrowed = adapter.search(searchRequest("ring"), narrowedAuthority);
    const restored = adapter.search(searchRequest("ring"), authority);

    expect(repeated).toEqual(first);
    expect(narrowed.productIds).toEqual(["product_aurora_gold_ring"]);
    expect(restored).toEqual(first);
    expect(diagnostics.map(({ indexBuildCount }) => indexBuildCount)).toEqual([1, 1, 2, 3]);
    expect(diagnostics.map(({ indexReused }) => indexReused)).toEqual([false, true, false, false]);
    expect(diagnostics.map(({ indexCacheEntryCount }) => indexCacheEntryCount)).toEqual([
      1, 1, 1, 1,
    ]);
    expect(diagnostics[0]?.searchableValueCount).toBe(diagnostics[1]?.searchableValueCount);
  });

  it("enforces bounded transient contracts and builds one deterministic encoded GET URL", () => {
    expect(searchRequest("   ").rawQuery).toBe("");
    expect(() => searchRequest("x".repeat(121))).toThrow();
    expect(() => searchRequest("ring", { pageSize: 13 as 12 })).toThrow();
    expect(() =>
      searchRequest("ring", {
        filters: [
          { field: "brand", values: ["Aurum Nordic"] },
          { field: "brand", values: ["Workshop"] },
        ],
      }),
    ).toThrow();
    expect(() =>
      normalizeStorefrontSearchQuery(
        "one two three four five six seven eight nine ten eleven twelve thirteen",
      ),
    ).toThrowError(expect.objectContaining({ code: "too-many-terms" }));

    const url = buildStorefrontSearchUrl({
      routePath:
        "/projects/project_aurum/search?p10b-16p-04-proposal=proposal%20fingerprint&unsafe=drop",
      rawQuery: "  Säde & 585  ",
      locale: "fi",
      page: 2,
      pageSize: 12,
      sort: "price-ascending",
      filters: [{ field: "brand", values: ["Aurum Nordic"] }],
    });
    const parsed = new URL(url, "https://veskify.invalid");
    expect(parsed.pathname).toBe("/projects/project_aurum/search");
    expect(parsed.searchParams.get("p10b-16p-04-proposal")).toBe("proposal fingerprint");
    expect(parsed.searchParams.get("q")).toBe("Säde & 585");
    expect(parsed.searchParams.get("locale")).toBe("fi");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("pageSize")).toBe("12");
    expect(parsed.searchParams.get("sort")).toBe("price-ascending");
    expect(parsed.searchParams.getAll("filter.brand")).toEqual(["Aurum Nordic"]);
    expect(parsed.searchParams.has("unsafe")).toBe(false);
    expect(url).not.toContain("%2520");
    expect(
      splitStorefrontSearchFormTarget({
        routePath:
          "/projects/project_aurum/search?p9-05b-session=safe-session&p10b-16p-04-utility=populated&q=old",
        locale: "en",
      }),
    ).toEqual({
      action: "/projects/project_aurum/search",
      hiddenInputs: [
        { name: "p9-05b-session", value: "safe-session" },
        { name: "p10b-16p-04-utility", value: "populated" },
        { name: "locale", value: "en" },
      ],
    });
    expect(() =>
      buildStorefrontSearchUrl({
        routePath: "/projects/project_aurum/search?p10b-16p-04-utility=unknown",
        rawQuery: "ring",
        locale: "en",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<StorefrontSearchError>>({ code: "invalid-request" }),
    );
    expect(() =>
      splitStorefrontSearchFormTarget({
        routePath:
          "/projects/project_aurum/search?p10b-16p-04-utility=empty&" +
          "p10b-16p-04-utility=populated",
        locale: "en",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<StorefrontSearchError>>({ code: "invalid-request" }),
    );
  });

  it("ranks exact and localized fields deterministically without exposing internal fields", () => {
    const { adapter, authority, catalogue } = fixtureSearch();
    const before = canonicalValueString(catalogue);
    expect(adapter.search(searchRequest("AUR-585"), authority).productIds[0]).toBe(
      "product_aurora_gold_ring",
    );
    expect(adapter.search(searchRequest("Aurora Gold Ring"), authority).productIds).toEqual([
      "product_aurora_gold_ring",
    ]);
    expect(adapter.search(searchRequest("GOLD RING"), authority).productIds).toEqual([
      "product_aurora_gold_ring",
      "product_lumi_gold_ring",
    ]);
    expect(adapter.search(searchRequest("sade", { locale: "fi" }), authority).productIds).toEqual([
      "product_sade_silver_necklace",
    ]);
    expect(adapter.search(searchRequest("SÄDE", { locale: "fi" }), authority).productIds).toEqual([
      "product_sade_silver_necklace",
    ]);
    expect(adapter.search(searchRequest("925", { locale: "fi" }), authority).productIds).toEqual([
      "product_sade_silver_necklace",
    ]);
    expect(adapter.search(searchRequest("925"), authority).productIds).toEqual([
      "product_sade_silver_necklace",
    ]);
    expect(adapter.search(searchRequest("Rings"), authority).productIds).toEqual([
      "product_aurora_gold_ring",
      "product_lumi_gold_ring",
    ]);
    expect(adapter.search(searchRequest("pendant"), authority).productIds).toEqual([
      "product_sade_silver_necklace",
    ]);
    expect(adapter.search(searchRequest("Wedding"), authority).productIds).toEqual([
      "product_aurora_gold_ring",
      "product_lumi_gold_ring",
    ]);
    expect(adapter.search(searchRequest("necklace"), authority).productIds).toEqual([
      "product_sade_silver_necklace",
    ]);
    expect(adapter.search(searchRequest("verification"), authority).productIds).toEqual([]);
    expect(adapter.search(searchRequest("secret"), authority).productIds).toEqual([]);
    expect(canonicalValueString(catalogue)).toBe(before);
  });

  it("binds locale, catalogue, route eligibility, filtering, sorting and pagination fingerprints", () => {
    const { adapter, authority } = fixtureSearch();
    const first = adapter.search(searchRequest("Aurum"), authority);
    const repeated = adapter.search(searchRequest("Aurum"), authority);
    expect(first).toEqual(repeated);
    expect(storefrontSearchResultPageV1Schema.parse(first)).toEqual(first);
    expect(first.catalogueFingerprint).toBe(authority.catalogueFingerprint);
    expect(first.totalCount).toBe(3);
    expect(first.availableFacets.map(({ field }) => field)).toEqual(
      expect.arrayContaining(["category", "productType", "stockStatus"]),
    );
    const { resultFingerprint, ...material } = first;
    void resultFingerprint;
    const incompleteMaterial = { ...material, productIds: first.productIds.slice(0, -1) };
    expect(() =>
      storefrontSearchResultPageV1Schema.parse({
        ...incompleteMaterial,
        resultFingerprint: storefrontSearchResultFingerprint(incompleteMaterial),
      }),
    ).toThrow(/exact bounded membership/i);

    const rings = adapter.search(
      searchRequest("Aurum", {
        filters: [{ field: "productType", values: ["ring"] }],
        sort: "price-descending",
      }),
      authority,
    );
    expect(rings.productIds).toEqual(["product_lumi_gold_ring", "product_aurora_gold_ring"]);
    expect(rings.totalCount).toBe(2);

    const finnish = adapter.search(searchRequest("Aurum", { locale: "fi" }), authority);
    expect(finnish.requestFingerprint).not.toBe(first.requestFingerprint);
    expect(finnish.resultFingerprint).not.toBe(first.resultFingerprint);

    const staleAuthority = {
      ...authority,
      catalogueFingerprint: canonicalValueFingerprint("stale"),
    };
    expect(() => adapter.search(searchRequest("ring"), staleAuthority)).toThrowError(
      expect.objectContaining({ code: "stale-catalogue-authority" }),
    );
    expect(() =>
      adapter.search(searchRequest("ring"), {
        ...authority,
        contractVersion: STOREFRONT_SEARCH_AUTHORITY_CONTRACT_VERSION,
        productRoutes: [
          ...authority.productRoutes,
          { productId: "product_missing", route: "/products/missing-product" },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid-authority" }));
  });

  it("returns governed empty and zero-result states without fabricated catalogue membership", () => {
    const { adapter, authority } = fixtureSearch();
    const empty = adapter.search(searchRequest("... — !!!"), authority);
    expect(empty).toMatchObject({
      state: "empty-query",
      normalizedQuery: "",
      normalizedTerms: [],
      totalCount: 0,
      productIds: [],
    });
    const noResults = adapter.search(searchRequest("nonexistent-product"), authority);
    expect(noResults).toMatchObject({ state: "results", totalCount: 0, productIds: [] });
    expect(noResults.normalizedTerms).toEqual(["nonexistent", "product"]);
    expect(noResults.resultFingerprint).not.toBe(empty.resultFingerprint);
  });

  it("rejects standalone attribute widening and result pages beyond current membership", () => {
    const { adapter, authority, catalogue } = fixtureSearch();
    expect(() =>
      createStandaloneStorefrontSearchAuthority({
        catalogue,
        primaryLocale: "en",
        enabledLocales: ["en", "fi"],
        productRoutes: productRoutes(catalogue),
        searchableAttributeKeys: ["material", "internalNote"],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid-authority" }));
    expect(() =>
      adapter.search(searchRequest("Aurum", { page: 2, pageSize: 12 }), authority),
    ).toThrowError(expect.objectContaining({ code: "invalid-request" }));
  });

  it("searches 1,000 products with bounded linear work and stable page identities", () => {
    const productIds = Array.from(
      { length: 1_000 },
      (_, index) => `product_scale_${String(index + 1).padStart(4, "0")}`,
    );
    const catalogue = catalogueDisplayModelSchema.parse({
      id: "catalogue_search_scale",
      products: productIds.map((id, index) => ({
        id,
        sku: `SCALE-${String(index + 1).padStart(4, "0")}`,
        title: text(
          `Scale product ${String(index + 1).padStart(4, "0")}`,
          `Testituote ${String(index + 1).padStart(4, "0")}`,
        ),
        brand: `Brand ${index % 5}`,
        category: `Category ${index % 8}`,
        price: { amount: index + 1, currency: "EUR" },
        stockStatus: "inStock",
        images: [
          {
            id: `asset_scale_${String(index + 1).padStart(4, "0")}`,
            url: `/seed-assets/scale-${String(index + 1).padStart(4, "0")}.svg`,
            alt: text(`Scale product ${index + 1}`),
            decorative: false,
          },
        ],
        productType: `type-${index % 4}`,
        attributes: {},
        variants:
          index % 2 === 0
            ? []
            : [
                {
                  id: `variant_scale_${String(index + 1).padStart(4, "0")}`,
                  label: text("Configured", "Määritetty"),
                  attributes: { size: index % 3 === 0 ? "large" : "standard" },
                },
              ],
      })),
      collections: Array.from({ length: 4 }, (_, collectionIndex) => ({
        id: `collection_scale_${collectionIndex + 1}`,
        slug: `scale-${collectionIndex + 1}`,
        title: text(
          `Scale collection ${collectionIndex + 1}`,
          `Testimallisto ${collectionIndex + 1}`,
        ),
        description: text("Scale test products", "Hakuskaalan testituotteet"),
        productIds: productIds.slice(collectionIndex * 250, (collectionIndex + 1) * 250),
      })),
    });
    const authority = createStandaloneStorefrontSearchAuthority({
      catalogue,
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      productRoutes: productIds.map((productId, index) => ({
        productId,
        route: `/products/scale-product-${String(index + 1).padStart(4, "0")}`,
      })),
      searchableFields: ["localized-title", "product-type", "collection-title"],
      searchableAttributeKeys: [],
    });
    let diagnostics: StandaloneCatalogueSearchDiagnostics | undefined;
    const diagnosticHistory: StandaloneCatalogueSearchDiagnostics[] = [];
    const adapter = createStandaloneCatalogueProductSearchAdapter({
      catalogue,
      onDiagnostics: (value) => {
        diagnostics = value;
        diagnosticHistory.push(value);
      },
    });
    const startedAt = performance.now();
    const firstPage = adapter.search(searchRequest("scale", { pageSize: 24 }), authority);
    const observedMilliseconds = performance.now() - startedAt;
    const secondPage = adapter.search(searchRequest("scale", { page: 2, pageSize: 24 }), authority);
    const finnishPage = adapter.search(
      searchRequest("testituote", { locale: "fi", pageSize: 12 }),
      authority,
    );
    expect(firstPage.totalCount).toBe(1_000);
    expect(firstPage.productIds).toHaveLength(24);
    expect(secondPage.productIds).toHaveLength(24);
    expect(new Set([...firstPage.productIds, ...secondPage.productIds]).size).toBe(48);
    expect(firstPage.productIds[0]).toBe("product_scale_0001");
    expect(secondPage.productIds[0]).toBe("product_scale_0025");
    expect(finnishPage.totalCount).toBe(1_000);
    expect(finnishPage.productIds).toHaveLength(12);
    expect(catalogue.collections).toHaveLength(4);
    expect(catalogue.products.some(({ variants }) => variants.length === 0)).toBe(true);
    expect(catalogue.products.some(({ variants }) => variants.length > 0)).toBe(true);
    expect(diagnostics).toMatchObject({
      catalogueProductCount: 1_000,
      eligibleProductCount: 1_000,
      collectionMembershipCount: 1_000,
      normalizedTermCount: 1,
      resultCount: 1_000,
      indexBuildCount: 2,
      indexCacheEntryCount: 2,
      indexReused: false,
    });
    expect(diagnosticHistory.map(({ indexBuildCount }) => indexBuildCount)).toEqual([1, 1, 2]);
    expect(diagnosticHistory.map(({ indexReused }) => indexReused)).toEqual([false, true, false]);
    expect(diagnostics!.termComparisonCount).toBeLessThanOrEqual(2_000);
    expect(diagnostics!.searchableValueCount).toBeLessThanOrEqual(3_000);
    // Operation counts are authoritative; this loose guard only catches accidental runaway work.
    expect(observedMilliseconds).toBeLessThan(5_000);
  });

  it("returns typed failures without retaining raw malformed input", () => {
    const { adapter, authority } = fixtureSearch();
    let failure: unknown;
    try {
      adapter.search({ ...searchRequest("ring"), page: 0 }, authority);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(StorefrontSearchError);
    expect(failure).toMatchObject({ code: "invalid-request" });
    expect((failure as Error).message).not.toContain("ring");
  });
});
