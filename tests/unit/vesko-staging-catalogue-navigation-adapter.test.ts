import { describe, expect, it, vi } from "vitest";

import type { MerchantProjectContextPort } from "@/application/merchant-project-context";
import type { MerchantProjectContext } from "@/application/vesko-integration";
import { aurumNordicSeed } from "@/data/seed";
import {
  createStagingCatalogueNavigationProjectionAdapter,
  type StagingCatalogueNavigationEnvelope,
} from "@/integrations/vesko-staging-catalogue-navigation";
import {
  storefrontCatalogueProjectionSchema,
  type StorefrontCatalogueProjection,
} from "@/integrations/vesko-catalogue/catalogue-projection-adapter";

const [firstProduct, secondProduct] = aurumNordicSeed.catalogue.products;
const [firstCollection, secondCollection] = aurumNordicSeed.catalogue.collections;

const identity = {
  tenantId: "tenant_staging",
  userId: "user_staging",
  merchantId: "merchant_staging",
  organizationId: "organization_staging",
  storeId: "store_staging",
  storefrontProjectId: "project_staging",
} as const;

const loadContext = {
  tenantId: identity.tenantId,
  storeId: identity.storeId,
  storefrontProjectId: identity.storefrontProjectId,
} as const;

function merchantContext(
  permissions: MerchantProjectContext["permissions"] = ["readStorefront"],
): MerchantProjectContext {
  return {
    ...identity,
    roles: ["owner"],
    permissions,
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    market: "FI",
    projectRevision: "vesko-project-etag-123",
  };
}

function projectionFixture(): StorefrontCatalogueProjection {
  return storefrontCatalogueProjectionSchema.parse({
    id: "catalogue_staging",
    revision: 7,
    merchant: { id: identity.merchantId, name: "Staging merchant" },
    project: {
      id: identity.storefrontProjectId,
      merchantId: identity.merchantId,
      revision: 11,
    },
    supportedLocales: ["en", "fi"],
    catalogueSafeTitle: { en: "Staging catalogue", fi: "Testiluettelo" },
    products: [
      {
        ...firstProduct,
        productTypeId: "product_type_ring",
        slug: "aurora-ring",
        categoryIds: ["category_jewellery"],
        routeReferenceId: "route_product_aurora",
        routeReferenceIds: ["route_product_aurora"],
      },
      {
        ...secondProduct,
        productTypeId: "product_type_ring",
        slug: "lumi-halo-ring",
        categoryIds: ["category_jewellery"],
        routeReferenceId: "route_product_lumi",
        routeReferenceIds: ["route_product_lumi"],
      },
    ],
    collections: [
      {
        ...firstCollection,
        slug: "jewellery-core",
        productIds: [firstProduct.id, secondProduct.id],
        routeReferenceId: "route_collection_jewellery",
        routeReferenceIds: ["route_collection_jewellery"],
      },
      {
        ...secondCollection,
        slug: "watches",
        productIds: [firstProduct.id],
        routeReferenceId: "route_collection_watches",
        routeReferenceIds: ["route_collection_watches"],
      },
    ],
    categories: [
      {
        id: "category_jewellery",
        slug: "jewellery",
        title: { en: "Jewellery", fi: "Korut" },
        parentCategoryId: null,
        routeReferenceId: "route_category_jewellery",
        supportedLocales: ["en", "fi"],
      },
      {
        id: "category_rings",
        slug: "rings",
        title: { en: "Rings", fi: "Sormukset" },
        parentCategoryId: "category_jewellery",
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
        path: "/products/aurora-ring",
        target: { kind: "product", productId: firstProduct.id },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_product_lumi",
        path: "/products/lumi-halo-ring",
        target: { kind: "product", productId: secondProduct.id },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_collection_jewellery",
        path: "/collections/jewellery-core",
        target: { kind: "collection", collectionId: firstCollection.id },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_collection_watches",
        path: "/collections/watches",
        target: { kind: "collection", collectionId: secondCollection.id },
        supportedLocales: ["en", "fi"],
      },
      {
        id: "route_category_jewellery",
        path: "/categories/jewellery",
        target: { kind: "category", categoryId: "category_jewellery" },
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
        id: "navigation_home",
        label: { en: "Home", fi: "Etusivu" },
        routeReferenceId: "route_home",
        parentNavigationNodeId: null,
        supportedLocales: ["en", "fi"],
      },
      {
        id: "navigation_jewellery",
        label: { en: "Jewellery", fi: "Korut" },
        routeReferenceId: "route_collection_jewellery",
        parentNavigationNodeId: "navigation_home",
        supportedLocales: ["en", "fi"],
      },
    ],
  });
}

function envelope(
  projection = projectionFixture(),
  catalogueRevision = "vesko-catalogue-etag-abc123",
): StagingCatalogueNavigationEnvelope {
  return {
    ...loadContext,
    catalogueRevision,
    projection,
  };
}

function createHarness(
  response: unknown = envelope(),
  permissions: MerchantProjectContext["permissions"] = ["readStorefront"],
) {
  const contextPort: MerchantProjectContextPort = {
    load: vi.fn(async () => merchantContext(permissions)),
  };
  const transport = { load: vi.fn(async () => response) };
  return {
    adapter: createStagingCatalogueNavigationProjectionAdapter({ contextPort, transport }),
    contextPort,
    transport,
  };
}

describe("P10-02 staging catalogue/navigation projection", () => {
  it("maps a valid staging envelope to the normalized P9-03 projection", async () => {
    const harness = createHarness();

    const result = await harness.adapter.load(loadContext);

    expect(result.catalogueRevision).toBe("vesko-catalogue-etag-abc123");
    expect(result.projection.id).toBe("catalogue_staging");
    expect(result.projection.products.map(({ id }) => id)).toEqual([
      firstProduct.id,
      secondProduct.id,
    ]);
    expect(harness.contextPort.load).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      storefrontProjectId: identity.storefrontProjectId,
    });
  });

  it("preserves Vesko collection membership order", async () => {
    const projection = projectionFixture();
    projection.collections[0]!.productIds = [secondProduct.id, firstProduct.id];
    const harness = createHarness(envelope(projection));

    const result = await harness.adapter.load(loadContext);

    expect(result.projection.collections[0]?.productIds).toEqual([
      secondProduct.id,
      firstProduct.id,
    ]);
  });

  it("preserves category hierarchy and resolved navigation route references", async () => {
    const harness = createHarness();

    const result = await harness.adapter.load(loadContext);

    expect(result.projection.categories[1]).toMatchObject({
      id: "category_rings",
      parentCategoryId: "category_jewellery",
      routeReferenceId: "route_category_rings",
    });
    expect(result.projection.navigation[1]).toMatchObject({
      id: "navigation_jewellery",
      routeReferenceId: "route_collection_jewellery",
    });
  });

  it("rejects duplicate normalized route ownership", async () => {
    const projection = projectionFixture();
    projection.routeReferences.push({
      id: "route_duplicate_jewellery",
      path: "/collections/jewellery-core/",
      target: { kind: "collection", collectionId: firstCollection.id },
      supportedLocales: ["en"],
    });
    const harness = createHarness(envelope(projection));

    await expect(harness.adapter.load(loadContext)).rejects.toMatchObject({
      code: "duplicateCanonicalIdentity",
    });
  });

  it("rejects localized values outside the projection's supported locales", async () => {
    const projection = projectionFixture();
    projection.supportedLocales = ["en"];
    projection.categories.forEach((category) => {
      category.supportedLocales = ["en"];
    });
    projection.routeReferences.forEach((route) => {
      route.supportedLocales = ["en"];
    });
    projection.navigation.forEach((node) => {
      node.supportedLocales = ["en"];
    });
    const harness = createHarness(envelope(projection));

    await expect(harness.adapter.load(loadContext)).rejects.toMatchObject({
      code: "unsupportedLocale",
    });
  });

  it("preserves the opaque catalogue revision without parsing it", async () => {
    const revision = "vesko-etag-catalogue-v4:abc123";
    const harness = createHarness(envelope(projectionFixture(), revision));

    await expect(
      harness.adapter.load({ ...loadContext, expectedRevision: revision }),
    ).resolves.toMatchObject({
      catalogueRevision: revision,
    });
  });

  it("requires current view storefront permission before transport access", async () => {
    const harness = createHarness(envelope(), ["saveDraft"]);

    await expect(harness.adapter.load(loadContext)).rejects.toMatchObject({
      code: "permissionDenied",
    });
    expect(harness.transport.load).not.toHaveBeenCalled();
  });

  it("maps malformed staging responses to a merchant-safe typed failure", async () => {
    const harness = createHarness({ invalid: true });

    await expect(harness.adapter.load(loadContext)).rejects.toMatchObject({
      code: "malformedIntegrationResponse",
    });
  });
});
