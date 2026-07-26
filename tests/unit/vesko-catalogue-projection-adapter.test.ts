import { describe, expect, it } from "vitest";

import { aurumNordicSeed } from "@/data/seed/aurum-nordic";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import {
  createCatalogueProjectionProvider,
  createStandaloneCatalogueProjectionAdapter,
  projectToCanonicalCommerceProjection,
  storefrontCatalogueProjectionSchema,
  type StorefrontCatalogueProjection,
} from "@/integrations/vesko-catalogue/catalogue-projection-adapter";

const [aurumFirstProduct, aurumSecondProduct] = aurumNordicSeed.catalogue.products;
const [aurumFirstCollection, aurumSecondCollection] = aurumNordicSeed.catalogue.collections;

function transportInput(overrides: Partial<StorefrontCatalogueProjection> = {}) {
  const base: StorefrontCatalogueProjection = {
    id: "projection_aurum_demo",
    revision: 7,
    merchant: { id: "merchant_aurum", name: "Aurum Nordic" },
    project: { id: "project_aurum", merchantId: "merchant_aurum", revision: 14 },
    supportedLocales: ["en", "fi"],
    catalogueSafeTitle: { en: "Aurum catalogue", fi: "Aurum-katalogi" },
    products: [
      {
        ...aurumFirstProduct,
        slug: "aurora-ring",
        categoryIds: ["category_jewelry"],
        routeReferenceId: "route_product_aurora",
        routeReferenceIds: ["route_product_aurora", "route_collection_gifts"],
      },
      {
        ...aurumSecondProduct,
        slug: "lumi-halo-ring",
        categoryIds: ["category_jewelry"],
        routeReferenceId: "route_product_lumi",
        routeReferenceIds: ["route_product_lumi", "route_collection_gifts"],
      },
    ],
    collections: [
      {
        ...aurumFirstCollection,
        slug: "jewellery-core",
        productIds: [aurumFirstProduct.id, aurumSecondProduct.id],
        routeReferenceId: "route_collection_gifts",
        routeReferenceIds: ["route_collection_gifts"],
      },
      {
        ...aurumSecondCollection,
        slug: "watches",
        productIds: [aurumFirstProduct.id],
        routeReferenceId: "route_collection_watches",
        routeReferenceIds: [],
      },
    ],
    categories: [
      {
        id: "category_jewelry",
        slug: "jewelry",
        title: { en: "Jewelry", fi: "Korut" },
        parentCategoryId: null,
        routeReferenceId: "route_category_jewelry",
        supportedLocales: ["en", "fi"],
      },
      {
        id: "category_rings",
        slug: "rings",
        title: { en: "Rings", fi: "Sormukset" },
        parentCategoryId: "category_jewelry",
        routeReferenceId: "route_category_rings",
        supportedLocales: ["en", "fi"],
      },
    ],
    routeReferences: [
      {
        id: "route_home",
        path: "/",
        target: { kind: "home" },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_product_aurora",
        path: "/products/aurora-ring-585",
        target: { kind: "product", productId: aurumFirstProduct.id },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_product_lumi",
        path: "/products/lumi-halo-ring",
        target: { kind: "product", productId: aurumSecondProduct.id },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_collection_gifts",
        path: "/collections/jewellery-core",
        target: { kind: "collection", collectionId: aurumFirstCollection.id },
        supportedLocales: ["en"],
      },
      {
        id: "route_collection_watches",
        path: "/collections/watches",
        target: { kind: "collection", collectionId: aurumSecondCollection.id },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_category_jewelry",
        path: "/categories/jewelry",
        target: { kind: "category", categoryId: "category_jewelry" },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_category_rings",
        path: "/categories/rings",
        target: { kind: "category", categoryId: "category_rings" },
        supportedLocales: ["en", "fi"],
      },
    ],
    navigation: [
      {
        id: "nav_home",
        label: { en: "Home", fi: "Etusivu" },
        routeReferenceId: "route_home",
        parentNavigationNodeId: null,
        supportedLocales: ["en", "fi"],
      },
      {
        id: "nav_jewelry",
        label: { en: "Jewelry", fi: "Korut" },
        routeReferenceId: "route_collection_gifts",
        parentNavigationNodeId: "nav_home",
        supportedLocales: ["en", "fi"],
      },
    ],
  };

  return storefrontCatalogueProjectionSchema.parse({ ...base, ...overrides });
}

describe("P9-03 read-only catalogue projection adapter", () => {
  it("maps valid products, collections and navigation deterministically", async () => {
    const provider = createCatalogueProjectionProvider({
      transport: { load: () => transportInput() },
    });
    const loaded = await provider.load();
    const canonical = projectToCanonicalCommerceProjection(loaded);

    expect(canonical.id).toBe("projection_aurum_demo");
    expect(canonical.products).toHaveLength(2);
    expect(canonical.collections).toHaveLength(2);
    expect(loaded.navigation).toHaveLength(2);
    expect(loaded.categories).toHaveLength(2);
  });

  it("preserves collection merchandising product order", async () => {
    const reordered = transportInput({
      collections: [
        {
          ...aurumFirstCollection,
          slug: "jewellery-core",
          productIds: [aurumSecondProduct.id, aurumFirstProduct.id],
          routeReferenceId: "route_collection_gifts",
          routeReferenceIds: ["route_collection_gifts"],
        },
        {
          ...aurumSecondCollection,
          slug: "watches",
          productIds: [aurumFirstProduct.id],
          routeReferenceId: "route_collection_watches",
          routeReferenceIds: [],
        },
      ],
    });

    const provider = createCatalogueProjectionProvider({ transport: { load: () => reordered } });
    const loaded = await provider.load();
    const canonical = projectToCanonicalCommerceProjection(loaded);

    expect(loaded.collections[0]?.productIds).toEqual([
      aurumSecondProduct.id,
      aurumFirstProduct.id,
    ]);
    expect(canonical.collections[0]?.productIds).toEqual([
      aurumSecondProduct.id,
      aurumFirstProduct.id,
    ]);
  });

  it("preserves standalone collection slugs exactly", async () => {
    const standalone = createStandaloneCatalogueProjectionAdapter(aurumNordicSeed.catalogue);
    const loaded = await standalone.load();

    const mappedCollection = loaded.collections.find(
      (collection) => collection.id === aurumFirstCollection.id,
    );
    expect(mappedCollection?.slug).toBe(aurumFirstCollection.slug);

    const withInvalidCollectionSlug = {
      ...structuredClone(transportInput()),
      collections: [
        {
          ...transportInput().collections[0],
          slug: "seasonal/new-arrivals",
        },
        ...transportInput().collections.slice(1),
      ],
    } as const;
    await expect(
      createCatalogueProjectionProvider({
        transport: { load: () => withInvalidCollectionSlug },
      }).load(),
    ).rejects.toThrow(/slug/i);
  });

  it("strips adapter-only product fields and validates canonical projection", async () => {
    const provider = createCatalogueProjectionProvider({
      transport: { load: () => transportInput() },
    });
    const loaded = await provider.load();
    const canonical = projectToCanonicalCommerceProjection(loaded);

    const parsed = catalogueDisplayModelSchema.parse(canonical);
    const firstProduct = loaded.products[0];

    expect(parsed.products).toHaveLength(2);
    expect("slug" in firstProduct).toBe(true);
    expect(parsed.products[0]).not.toHaveProperty("slug");
    expect(parsed.products[0]).not.toHaveProperty("routeReferenceId");
    expect(parsed.products[0]).not.toHaveProperty("routeReferenceIds");
    expect(parsed.products[0]).not.toHaveProperty("categoryIds");
  });

  it("preserves an optional canonical source product type ID for downstream composition", async () => {
    const provider = createCatalogueProjectionProvider({
      transport: {
        load: () =>
          transportInput({
            products: [
              { ...transportInput().products[0], productTypeId: "product_type_ring" },
              transportInput().products[1],
            ],
          }),
      },
    });

    const loaded = await provider.load();
    expect(loaded.products[0]?.productTypeId).toBe("product_type_ring");
    expect(projectToCanonicalCommerceProjection(loaded).products[0]).not.toHaveProperty(
      "productTypeId",
    );
  });

  it("requires primary product/collection/category routes to target the owning entity", async () => {
    const invalidProductRoute = {
      ...transportInput(),
      routeReferences: [
        {
          id: "route_mismatch",
          path: "/route/mismatch",
          target: { kind: "collection", collectionId: aurumFirstCollection.id },
          supportedLocales: ["en"],
        },
        ...transportInput().routeReferences,
      ],
      products: [
        { ...transportInput().products[0], routeReferenceId: "route_mismatch" },
        ...transportInput().products.slice(1),
      ],
    };
    await expect(
      createCatalogueProjectionProvider({ transport: { load: () => invalidProductRoute } }).load(),
    ).rejects.toThrow(/owning product/i);
  });

  it("rejects duplicate route path and locale ownership", async () => {
    const duplicatedPaths = {
      ...transportInput(),
      routeReferences: [
        {
          id: "route_watches_primary",
          path: "/collections/watches/",
          target: { kind: "collection", collectionId: aurumSecondCollection.id },
          supportedLocales: ["en"],
        },
        {
          id: "route_watches_alias",
          path: "/collections/watches",
          target: { kind: "collection", collectionId: aurumFirstCollection.id },
          supportedLocales: ["en", "fi"],
        },
        ...transportInput().routeReferences.slice(2),
      ],
    };
    await expect(
      createCatalogueProjectionProvider({ transport: { load: () => duplicatedPaths } }).load(),
    ).rejects.toThrow(/path and locale ownership/i);
  });

  it("enforces category locale compatibility with catalogue and category route", async () => {
    const fiLocales: Array<"en" | "fi"> = ["fi"];
    const enLocales: Array<"en" | "fi"> = ["en"];

    const base = transportInput();
    const unsupportedCategoryLocale = structuredClone(base);
    unsupportedCategoryLocale.supportedLocales = fiLocales;
    unsupportedCategoryLocale.categories[0].supportedLocales = enLocales;
    unsupportedCategoryLocale.routeReferences = base.routeReferences.map((route) => ({
      ...route,
      supportedLocales: fiLocales,
    }));
    unsupportedCategoryLocale.navigation = base.navigation.map((node) => ({
      ...node,
      supportedLocales: fiLocales,
    }));

    const incompatibleCategoryRoute = structuredClone(base);
    incompatibleCategoryRoute.supportedLocales = fiLocales;
    incompatibleCategoryRoute.routeReferences = base.routeReferences.map((route) => ({
      ...route,
      supportedLocales: fiLocales,
    }));
    incompatibleCategoryRoute.routeReferences = [
      {
        id: "route_bad_locale",
        path: "/categories/jewelry",
        target: { kind: "category", categoryId: "category_jewelry" },
        supportedLocales: enLocales,
      },
      ...base.routeReferences.map((route) => ({ ...route, supportedLocales: fiLocales })),
    ];
    incompatibleCategoryRoute.categories = [
      {
        ...base.categories[0],
        routeReferenceId: "route_bad_locale",
        supportedLocales: ["fi"],
      },
      base.categories[1],
    ];

    await expect(
      createCatalogueProjectionProvider({
        transport: { load: () => unsupportedCategoryLocale },
      }).load(),
    ).rejects.toThrow(/Category locales/i);
    await expect(
      createCatalogueProjectionProvider({
        transport: { load: () => incompatibleCategoryRoute },
      }).load(),
    ).rejects.toThrow(/compatible with the owning category/i);
  });

  it("bounds standalone merchant/project IDs for long catalogue IDs deterministically", async () => {
    const longId = `catalogue_${"a".repeat(140)}`;
    const first = createStandaloneCatalogueProjectionAdapter({
      ...structuredClone(aurumNordicSeed.catalogue),
      id: longId,
    });
    const second = createStandaloneCatalogueProjectionAdapter({
      ...structuredClone(aurumNordicSeed.catalogue),
      id: `${longId}_variant`,
    });

    const firstLoaded = await first.load();
    const secondLoaded = await second.load();

    expect(firstLoaded.merchant.id).toMatch(/^merchant_/);
    expect(firstLoaded.project.id).toMatch(/^project_/);
    expect(firstLoaded.merchant.id.length).toBeLessThanOrEqual(80);
    expect(firstLoaded.project.id.length).toBeLessThanOrEqual(80);
    expect(firstLoaded.merchant.id).not.toEqual(secondLoaded.merchant.id);
    expect(firstLoaded.project.id).not.toEqual(secondLoaded.project.id);
  });
});
