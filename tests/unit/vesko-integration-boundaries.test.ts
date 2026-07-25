import { describe, expect, it, vi } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import {
  assertAuthoritativeDraftSavePreconditions,
  assertAuthoritativePublishPreconditions,
  assertAuthoritativeRestorePreconditions,
  availabilityOptionMediaProjectionSchema,
  catalogueProjectionSchema,
  createStandaloneVeskoIntegrationBoundary,
  merchantProjectContextSchema,
  publishStorefrontRequestSchema,
  restoreStorefrontHistoryRequestSchema,
  saveStorefrontDraftRequestSchema,
  VeskoIntegrationError,
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
};

const catalogue = {
  tenantId: context.tenantId,
  storeId: context.storeId,
  storefrontProjectId: context.storefrontProjectId,
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
      slug: "rings-collection",
      title: { en: "Rings", fi: "Sormukset" },
      productIds: ["product_aurora_ring_585"],
      categoryId: "category_rings",
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
};

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

const currentDraft = {
  id: aurumNordicSeed.draftSnapshot.id,
  revision: "draft-revision-1",
  contentFingerprint: "draft-fingerprint-1",
} as const;
const currentPublished = {
  id: aurumNordicSeed.publishedSnapshot.id,
  revision: "published-revision-1",
  contentFingerprint: "published-fingerprint-1",
} as const;

function completeAvailabilityProjection() {
  return {
    tenantId: context.tenantId,
    storeId: context.storeId,
    storefrontProjectId: context.storefrontProjectId,
    productId: "product_aurora_ring_585",
    revision: "availability-revision-1",
    availability: "inStock",
    stockDisplay: "show",
    attributes: [
      { attributeId: "attribute_material", label: { en: "Material" }, value: { en: "Gold" } },
    ],
    optionGroups: [
      {
        id: "option_metal",
        label: { en: "Metal" },
        source: "variantDimension",
        required: true,
        presentation: "swatch",
        values: [
          {
            id: "option_value_yellow_gold",
            label: { en: "Yellow gold" },
            value: "yellowGold",
            swatch: { color: "#D4AF37" },
          },
        ],
      },
      {
        id: "option_size",
        label: { en: "Ring size" },
        source: "variantDimension",
        required: true,
        presentation: "buttonGroup",
        values: [{ id: "option_value_size_16", label: { en: "16" }, value: "16" }],
        dependsOn: [{ groupId: "option_metal", valueIds: ["option_value_yellow_gold"] }],
      },
      {
        id: "option_engraving",
        label: { en: "Engraving" },
        source: "orderOption",
        required: false,
        presentation: "textInput",
        values: [],
        textEntryConstraints: {
          minLength: 0,
          maxLength: 20,
          characterPolicy: "unicodeText",
          placeholder: { en: "Optional engraving" },
        },
      },
    ],
    variants: [
      {
        variantId: "variant_ring_16_yellow_gold",
        optionValueIds: ["option_value_yellow_gold", "option_value_size_16"],
        price: { amount: 1290, currency: "EUR" },
        availability: "inStock",
      },
    ],
    media: [{ assetId: "media_ring_main", role: "main", alt: { en: "Aurora ring" } }],
  };
}

function saveRequest(expectedCurrentDraft = currentDraft) {
  return {
    context,
    requestId: "request_save_1",
    expectedProjectRevision: context.projectRevision,
    expectedCurrentDraft,
    draft: {
      tenantId: context.tenantId,
      storefrontProjectId: context.storefrontProjectId,
      revision: "draft-revision-2",
      contentFingerprint: "draft-fingerprint-2",
      snapshot: aurumNordicSeed.draftSnapshot,
    },
  };
}

function authoritativeSnapshot(snapshot: typeof currentDraft | typeof currentPublished) {
  return {
    ...snapshot,
    tenantId: context.tenantId,
    storefrontProjectId: context.storefrontProjectId,
  };
}

function immutableHistoryTarget(snapshot: typeof currentPublished) {
  return { ...authoritativeSnapshot(snapshot), immutable: true as const };
}

describe("P9-01 Vesko integration boundaries", () => {
  it("preserves complete canonical option values, presentation, dependencies and text constraints", () => {
    const parsed = availabilityOptionMediaProjectionSchema.parse(completeAvailabilityProjection());
    expect(parsed.optionGroups.map((group) => group.id)).toEqual([
      "option_metal",
      "option_size",
      "option_engraving",
    ]);
    expect(parsed.optionGroups[0]?.values[0]?.swatch).toEqual({ color: "#D4AF37" });
    expect(parsed.optionGroups[1]?.dependsOn).toEqual([
      { groupId: "option_metal", valueIds: ["option_value_yellow_gold"] },
    ]);
    expect(parsed.optionGroups[2]?.textEntryConstraints?.maxLength).toBe(20);
  });

  it("rejects broken canonical option-value and dependency references", () => {
    const broken = completeAvailabilityProjection();
    broken.optionGroups[1].dependsOn = [
      { groupId: "option_missing", valueIds: ["option_value_unknown"] },
    ];
    broken.variants[0].optionValueIds = ["option_value_unknown"];

    expect(() => availabilityOptionMediaProjectionSchema.parse(broken)).toThrow(
      /option dependencies|canonical option values/i,
    );
  });

  it("preserves variant media associations and rejects variants outside the product", () => {
    const projection = completeAvailabilityProjection();
    const withVariantMedia = {
      ...projection,
      media: [
        {
          assetId: "media_ring_variant",
          role: "variant",
          variantIds: ["variant_ring_16_yellow_gold"],
          alt: { en: "Yellow gold ring" },
        },
      ],
    };
    expect(availabilityOptionMediaProjectionSchema.parse(withVariantMedia).media[0]).toMatchObject({
      role: "variant",
      variantIds: ["variant_ring_16_yellow_gold"],
    });

    const withUnknownVariantMedia = {
      ...withVariantMedia,
      media: [{ ...withVariantMedia.media[0], variantIds: ["variant_other_product"] }],
    };
    expect(() => availabilityOptionMediaProjectionSchema.parse(withUnknownVariantMedia)).toThrow(
      /variant media must reference/i,
    );
  });

  it("rejects stale draft IDs, revisions and fingerprints despite an unchanged project revision", () => {
    const request = saveStorefrontDraftRequestSchema.parse(saveRequest());
    expect(() =>
      assertAuthoritativeDraftSavePreconditions(
        request,
        { ...authoritativeSnapshot(currentDraft), id: "snapshot_draft_newer" },
        context.projectRevision,
      ),
    ).toThrow(expect.objectContaining({ code: "draftRevisionConflict" }));
    expect(() =>
      assertAuthoritativeDraftSavePreconditions(
        request,
        { ...authoritativeSnapshot(currentDraft), revision: "draft-revision-2" },
        context.projectRevision,
      ),
    ).toThrow(expect.objectContaining({ code: "draftRevisionConflict" }));
    expect(() =>
      assertAuthoritativeDraftSavePreconditions(
        request,
        { ...authoritativeSnapshot(currentDraft), contentFingerprint: "draft-fingerprint-newer" },
        context.projectRevision,
      ),
    ).toThrow(expect.objectContaining({ code: "draftRevisionConflict" }));
  });

  it("restores only an immutable history target and rejects a caller-supplied snapshot", () => {
    const request = {
      context,
      requestId: "request_restore_1",
      expectedProjectRevision: context.projectRevision,
      expectedCurrentDraft: currentDraft,
      target: {
        id: aurumNordicSeed.publishedSnapshot.id,
        revision: "published-revision-1",
        contentFingerprint: "published-fingerprint-1",
      },
    };
    expect(restoreStorefrontHistoryRequestSchema.parse(request).target.id).toBe(
      aurumNordicSeed.publishedSnapshot.id,
    );
    expect(() =>
      restoreStorefrontHistoryRequestSchema.parse({
        ...request,
        snapshot: aurumNordicSeed.draftSnapshot,
      }),
    ).toThrow();
  });

  it("rejects stale current drafts and mismatched immutable restore-target fingerprints", () => {
    const request = restoreStorefrontHistoryRequestSchema.parse({
      context,
      requestId: "request_restore_1",
      expectedProjectRevision: context.projectRevision,
      expectedCurrentDraft: currentDraft,
      target: currentPublished,
    });
    expect(() =>
      assertAuthoritativeRestorePreconditions(
        request,
        { ...authoritativeSnapshot(currentDraft), revision: "draft-revision-2" },
        immutableHistoryTarget(currentPublished),
        context.projectRevision,
      ),
    ).toThrow(expect.objectContaining({ code: "draftRevisionConflict" }));
    expect(() =>
      assertAuthoritativeRestorePreconditions(
        request,
        authoritativeSnapshot(currentDraft),
        {
          ...immutableHistoryTarget(currentPublished),
          contentFingerprint: "published-fingerprint-other",
        },
        context.projectRevision,
      ),
    ).toThrow(expect.objectContaining({ code: "historyTargetFingerprintMismatch" }));
  });

  it("rejects duplicate catalogue identities and unresolved navigation targets", () => {
    const duplicate = structuredClone(catalogue);
    duplicate.collections.push(structuredClone(duplicate.collections[0]));
    duplicate.navigation[0].target = { kind: "collection", collectionId: "collection_missing" };

    expect(() => catalogueProjectionSchema.parse(duplicate)).toThrow(
      /canonical ids|navigation collection targets/i,
    );
  });

  it("publishes only the authoritative saved draft identity and rejects stale confirmations", () => {
    const request = publishStorefrontRequestSchema.parse({
      context,
      requestId: "request_publish_1",
      publishPreparationId: "publish_preparation_1",
      expectedProjectRevision: context.projectRevision,
      expectedSavedDraft: currentDraft,
      expectedPublished: currentPublished,
    });
    expect(() =>
      publishStorefrontRequestSchema.parse({ ...request, snapshot: aurumNordicSeed.draftSnapshot }),
    ).toThrow();
    expect(() =>
      assertAuthoritativePublishPreconditions(
        request,
        { ...authoritativeSnapshot(currentDraft), contentFingerprint: "draft-tampered" },
        authoritativeSnapshot(currentPublished),
        context.projectRevision,
        "publish_preparation_1",
      ),
    ).toThrow(expect.objectContaining({ code: "savedDraftMismatch" }));
    expect(() =>
      assertAuthoritativePublishPreconditions(
        request,
        authoritativeSnapshot(currentDraft),
        authoritativeSnapshot(currentPublished),
        context.projectRevision,
        "publish_preparation_newer",
      ),
    ).toThrow(expect.objectContaining({ code: "stalePublishConfirmation" }));
  });

  it("allows valid standalone adapters to satisfy all strict ports", () => {
    expect(merchantProjectContextSchema.parse(context)).toMatchObject({
      tenantId: context.tenantId,
      storefrontProjectId: context.storefrontProjectId,
    });
    expect(veskoIntegrationCapabilitiesSchema.parse(capabilities)).toEqual(capabilities);
    const boundary = createStandaloneVeskoIntegrationBoundary({
      capabilities,
      context: { load: vi.fn(() => Promise.resolve(merchantProjectContextSchema.parse(context))) },
      catalogue: { load: vi.fn(() => Promise.resolve(catalogueProjectionSchema.parse(catalogue))) },
      availability: {
        load: vi.fn(() =>
          Promise.resolve(
            availabilityOptionMediaProjectionSchema.parse(completeAvailabilityProjection()),
          ),
        ),
      },
      drafts: { load: vi.fn(() => Promise.resolve(null)), save: vi.fn(), restore: vi.fn() },
      publishing: { publish: vi.fn() },
    });

    expect(boundary.capabilities.catalogueProjection).toBe("available");
    expect(typeof boundary.drafts.restore).toBe("function");
    expect(new VeskoIntegrationError("publishedStateConflict").message).not.toMatch(
      /backend|payload/i,
    );
  });
});
