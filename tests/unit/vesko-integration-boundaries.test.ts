import { describe, expect, it, vi } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import {
  availabilityOptionMediaProjectionSchema,
  catalogueProjectionSchema,
  createStandaloneVeskoIntegrationBoundary,
  merchantProjectContextSchema,
  publishStorefrontRequestSchema,
  saveStorefrontDraftRequestSchema,
  veskoIntegrationCapabilitiesSchema,
} from "@/application/vesko-integration";

const context = {
  userId: "user_demo",
  tenantId: "tenant_demo",
  merchantId: "merchant_demo",
  organizationId: "organization_demo",
  storeId: "store_demo",
  storefrontProjectId: aurumNordicSeed.project.id,
  roles: ["owner"],
  permissions: ["readStorefront", "saveDraft", "restoreDraft", "publishStorefront"],
  primaryLocale: "en",
  enabledLocales: ["en", "fi"],
  market: "FI",
  projectRevision: "project-revision-1",
} as const;

const catalogue = {
  tenantId: context.tenantId,
  storeId: context.storeId,
  catalogueId: aurumNordicSeed.catalogue.id,
  revision: "catalogue-revision-1",
  products: [
    {
      productId: "product_aurora_ring_585",
      slug: "aurora-ring-585",
      title: { en: "Aurora Ring 585", fi: "Aurora-sormus 585" },
      productTypeId: "ring",
      sku: "AUR-585",
      price: { amount: 1290, currency: "EUR" },
    },
  ],
  collections: [
    {
      collectionId: "collection_rings",
      slug: "rings",
      title: { en: "Rings", fi: "Sormukset" },
      productIds: ["product_aurora_ring_585"],
    },
  ],
  categories: [
    {
      categoryId: "category_rings",
      parentCategoryId: null,
      slug: "rings",
      title: { en: "Rings", fi: "Sormukset" },
    },
  ],
  navigation: [
    {
      navigationId: "navigation_rings",
      target: { kind: "collection", collectionId: "collection_rings" },
    },
  ],
} as const;

const capabilities = {
  merchantContext: "available",
  catalogueProjection: "available",
  availabilityProjection: "available",
  optionResolution: "available",
  canonicalMedia: "available",
  draftPersistence: "available",
  publishing: "available",
  historyRestoration: "available",
} as const;

describe("P9-01 Vesko integration boundaries", () => {
  it("validates a strict merchant and project context", () => {
    expect(merchantProjectContextSchema.parse(context)).toMatchObject({
      tenantId: "tenant_demo",
      storefrontProjectId: aurumNordicSeed.project.id,
    });
  });

  it("rejects tenant and project identity mismatches", () => {
    expect(() =>
      saveStorefrontDraftRequestSchema.parse({
        context,
        expectedRevision: "project-revision-1",
        draft: {
          tenantId: "tenant_other",
          storefrontProjectId: "project_other",
          revision: "draft-revision-1",
          fingerprint: "draft-fingerprint-1",
          snapshot: aurumNordicSeed.draftSnapshot,
        },
      }),
    ).toThrow(/identity/i);
  });

  it("preserves canonical IDs, membership and projection revision", () => {
    const value = catalogueProjectionSchema.parse(catalogue);
    expect(value.revision).toBe("catalogue-revision-1");
    expect(value.collections[0]?.productIds).toEqual(["product_aurora_ring_585"]);
  });

  it("does not expose protected commerce mutation fields", () => {
    expect(() => catalogueProjectionSchema.parse({ ...catalogue, mutatePrice: true })).toThrow();
    expect(() =>
      catalogueProjectionSchema.parse({
        ...catalogue,
        products: [{ ...catalogue.products[0], inventoryCommand: "adjust" }],
      }),
    ).toThrow();
  });

  it("keeps availability, options and media as strict read-only projection data", () => {
    expect(
      availabilityOptionMediaProjectionSchema.parse({
        tenantId: context.tenantId,
        storeId: context.storeId,
        productId: "product_aurora_ring_585",
        revision: "availability-revision-1",
        availability: "inStock",
        stockDisplay: "show",
        attributes: [
          { attributeId: "attribute_material", label: { en: "Material" }, value: { en: "Gold" } },
        ],
        optionGroups: [
          {
            optionGroupId: "option_size",
            label: { en: "Size" },
            required: true,
            valueIds: ["option_value_16"],
          },
        ],
        variants: [
          {
            variantId: "variant_16",
            optionValueIds: ["option_value_16"],
            price: { amount: 1290, currency: "EUR" },
            availability: "inStock",
          },
        ],
        media: [{ mediaId: "asset_aurora_ring", role: "main", alt: { en: "Aurora ring" } }],
      }),
    ).toMatchObject({ productId: "product_aurora_ring_585" });
  });

  it("requires the current expected project revision before saving", () => {
    expect(() =>
      saveStorefrontDraftRequestSchema.parse({
        context,
        expectedRevision: "project-revision-stale",
        draft: {
          tenantId: context.tenantId,
          storefrontProjectId: aurumNordicSeed.project.id,
          revision: "draft-revision-1",
          fingerprint: "draft-fingerprint-1",
          snapshot: aurumNordicSeed.draftSnapshot,
        },
      }),
    ).toThrow(/current project revision/i);
  });

  it("accepts presentation publishing only and rejects commerce payloads", () => {
    expect(
      publishStorefrontRequestSchema.parse({
        context,
        expectedDraftRevision: "draft-revision-1",
        requestId: "request_publish_1",
        snapshot: aurumNordicSeed.draftSnapshot,
      }).snapshot.id,
    ).toBe(aurumNordicSeed.draftSnapshot.id);
    expect(() =>
      publishStorefrontRequestSchema.parse({
        context,
        expectedDraftRevision: "draft-revision-1",
        requestId: "request_publish_1",
        snapshot: aurumNordicSeed.draftSnapshot,
        catalogueMutation: { price: 1 },
      }),
    ).toThrow();
  });

  it("makes capabilities explicit and deterministic", () => {
    expect(veskoIntegrationCapabilitiesSchema.parse(capabilities)).toEqual(capabilities);
    expect(() =>
      veskoIntegrationCapabilitiesSchema.parse({ ...capabilities, publishing: "maybe" }),
    ).toThrow();
  });

  it("allows standalone adapters to satisfy the same strict port bundle", () => {
    const boundary = createStandaloneVeskoIntegrationBoundary({
      capabilities,
      context: { load: vi.fn(() => Promise.resolve(merchantProjectContextSchema.parse(context))) },
      catalogue: { load: vi.fn(() => Promise.resolve(catalogueProjectionSchema.parse(catalogue))) },
      availability: { load: vi.fn() },
      drafts: { load: vi.fn(), save: vi.fn(), restore: vi.fn() },
      publishing: { publish: vi.fn() },
    });

    expect(boundary.capabilities.catalogueProjection).toBe("available");
    expect(typeof boundary.context.load).toBe("function");
  });
});
