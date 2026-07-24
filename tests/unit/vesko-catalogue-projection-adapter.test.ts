import { describe, expect, it, vi } from "vitest";

import { aurumNordicSeed } from "@/data/seed/aurum-nordic";
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
        target: {
          kind: "product",
          productId: aurumFirstProduct.id,
        },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_product_lumi",
        path: "/products/lumi-halo-ring",
        target: {
          kind: "product",
          productId: aurumSecondProduct.id,
        },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_collection_gifts",
        path: "/collections/jewellery-core",
        target: {
          kind: "collection",
          collectionId: aurumFirstCollection.id,
        },
        supportedLocales: ["en"],
      },
      {
        id: "route_collection_watches",
        path: "/collections/watches",
        target: {
          kind: "collection",
          collectionId: aurumSecondCollection.id,
        },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_category_jewelry",
        path: "/categories/jewelry",
        target: {
          kind: "category",
          categoryId: "category_jewelry",
        },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_category_rings",
        path: "/categories/rings",
        target: {
          kind: "category",
          categoryId: "category_rings",
        },
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
    const source = {
      load: () => transportInput(),
    };

    const provider = createCatalogueProjectionProvider({ transport: source });
    const loaded = await provider.load();

    const canonical = projectToCanonicalCommerceProjection(loaded);

    expect(canonical.id).toBe("projection_aurum_demo");
    expect(canonical.products).toHaveLength(2);
    expect(canonical.collections).toHaveLength(2);
    expect(loaded.navigation).toHaveLength(2);
    expect(loaded.categories).toHaveLength(2);
  });

  it("preserves canonical IDs and slugs for products, collections and routes", async () => {
    const provider = createCatalogueProjectionProvider({
      transport: { load: () => transportInput() },
    });
    const loaded = await provider.load();

    const product = loaded.products.find((item) => item.id === aurumFirstProduct.id);
    const collection = loaded.collections.find((item) => item.id === aurumFirstCollection.id);
    expect(product?.id).toBe(aurumFirstProduct.id);
    expect(product?.slug).toBe("aurora-ring");
    expect(collection?.id).toBe(aurumFirstCollection.id);
    expect(collection?.slug).toBe("jewellery-core");
    expect(loaded.navigation.find((item) => item.id === "nav_home")?.id).toBe("nav_home");
  });

  it("rejects duplicate canonical IDs", async () => {
    const base = transportInput();
    const [firstProduct] = base.products;
    const projection = {
      ...base,
      products: [
        firstProduct,
        {
          ...firstProduct,
          slug: "aurora-ring-duplicate",
        },
      ],
    };
    const provider = createCatalogueProjectionProvider({
      transport: { load: () => projection },
    });

    await expect(provider.load()).rejects.toThrow();
  });

  it("rejects unknown membership and broken navigation references", async () => {
    const invalid = transportInput();
    const broken = {
      ...invalid,
      products: invalid.products.map((product, index) =>
        index === 0 ? { ...product, categoryIds: ["category_missing"] } : product,
      ),
      navigation: [
        ...invalid.navigation,
        {
          id: "nav_missing",
          label: { en: "Missing", fi: "Puuttuva" },
          routeReferenceId: "route_missing",
          parentNavigationNodeId: "nav_home",
          supportedLocales: ["en", "fi"],
        },
      ],
    };

    const provider = createCatalogueProjectionProvider({
      transport: { load: () => broken },
    });
    await expect(provider.load()).rejects.toThrow();
  });

  it("rejects cyclic category and navigation hierarchies", async () => {
    const base = transportInput();
    const invalid = {
      ...base,
      categories: [
        ...base.categories,
        {
          id: "category_loop_a",
          slug: "loop-a",
          title: { en: "Loop A", fi: "Silmukka A" },
          parentCategoryId: "category_loop_b",
          supportedLocales: ["en", "fi"],
        },
        {
          id: "category_loop_b",
          slug: "loop-b",
          title: { en: "Loop B", fi: "Silmukka B" },
          parentCategoryId: "category_loop_a",
          supportedLocales: ["en", "fi"],
        },
      ],
      navigation: [
        {
          id: "nav_home",
          label: { en: "Home", fi: "Etusivu" },
          routeReferenceId: "route_home",
          supportedLocales: ["en", "fi"],
          parentNavigationNodeId: "nav_loop_child",
        },
        {
          id: "nav_loop_child",
          label: { en: "Child", fi: "Lapsi" },
          routeReferenceId: "route_collection_gifts",
          parentNavigationNodeId: "nav_loop_child",
          supportedLocales: ["en", "fi"],
        },
      ],
    };
    const provider = createCatalogueProjectionProvider({ transport: { load: () => invalid } });

    await expect(provider.load()).rejects.toThrow();
  });

  it("rejects stale revisions from transport input", async () => {
    const provider = createCatalogueProjectionProvider({
      transport: {
        load: vi
          .fn()
          .mockResolvedValueOnce(transportInput())
          .mockResolvedValueOnce(transportInput({ revision: 3 })),
      },
    });

    await provider.load();
    await expect(provider.load()).rejects.toThrow(/Stale canonical projection revision/);
  });

  it("normalizes equivalent reordered responses deterministically", async () => {
    const first = {
      ...transportInput(),
      products: [...transportInput().products].reverse(),
      collections: [...transportInput().collections].reverse(),
      navigation: [...transportInput().navigation].reverse(),
      routeReferences: [...transportInput().routeReferences].reverse(),
      categories: [...transportInput().categories].reverse(),
    };

    const second = transportInput();

    const firstResult = await createCatalogueProjectionProvider({
      transport: { load: () => first },
    }).load();
    const secondResult = await createCatalogueProjectionProvider({
      transport: { load: () => second },
    }).load();

    expect(firstResult).toEqual(secondResult);
  });

  it("keeps existing standalone fixture compatibility", async () => {
    const standalone = createStandaloneCatalogueProjectionAdapter(aurumNordicSeed.catalogue);
    const loaded = await standalone.load();

    const sortById = <T extends { id: string }>(values: readonly T[]) =>
      [...values].sort((left, right) => left.id.localeCompare(right.id));
    const normalizeCollection = <T extends { id: string; productIds: Array<unknown> }>(
      value: T,
    ) => {
      const collection = { ...value } as T & { slug?: string };
      delete collection.slug;
      return {
        ...collection,
        productIds: [...collection.productIds].sort(),
      };
    };

    const canonical = projectToCanonicalCommerceProjection(loaded);
    expect(canonical.id).toBe(aurumNordicSeed.catalogue.id);
    expect(sortById(canonical.collections).map(normalizeCollection)).toEqual(
      sortById(aurumNordicSeed.catalogue.collections).map(normalizeCollection),
    );
  });
});
