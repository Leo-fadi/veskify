import { describe, expect, it } from "vitest";
import {
  acceptWholeStorefrontPlanningResult,
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
  validateWholeStorefrontGenerationPlan,
} from "@/application/whole-storefront-generation-plan";
import { createApprovedGenerationAssetContextFingerprint } from "@/application/ai-storefront-generation";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicSeed } from "@/data/seed";
import { sourceEvidenceSchema, sourceReferenceSchema } from "@/domain/source-discovery";

const now = "2026-07-23T10:00:00.000Z";

function materialEvidence() {
  const source = sourceReferenceSchema.parse({
    id: "source_whole_storefront",
    sourceType: "deterministic-fixture",
    url: "https://merchant.example/store",
    normalizedOrigin: "https://merchant.example",
    requestedLocale: "en",
    discoveredAt: now,
    allowedDiscoveryPolicy: {
      mode: "deterministic",
      maxPages: 5,
      maxAssets: 10,
      followSameOriginOnly: true,
    },
    status: "complete",
    warnings: [],
    failure: null,
  });
  const evidence = sourceEvidenceSchema.parse({
    id: "evidence_whole_storefront",
    kind: "page-identity",
    provenance: { sourceReferenceId: source.id, sourceUrl: source.url, observedAt: now },
    sourceUrl: source.url,
    confidence: 1,
    observedValue: { title: "Whole storefront merchant" },
    extractionMethod: "deterministic-test-fixture",
    locale: "en",
    warnings: [],
    uncertainty: { isUncertain: false, reason: null },
  });
  return {
    sourceReferences: [source],
    evidence: [evidence],
    assetCandidates: [],
    reconciliation: null,
  };
}

function approvedBrief(overrides: Record<string, unknown> = {}) {
  return approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: "brief_whole_storefront",
      now,
      businessIdentity: { businessName: "Whole storefront merchant" },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
      sourceReferenceIds: ["source_whole_storefront"],
      sourceEvidenceIds: ["evidence_whole_storefront"],
      materialEvidence: materialEvidence(),
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      pagePlan: { pageTypes: ["home", "collection", "product"] },
      approvedBrandDirection: {
        logoAssetRef: { id: "asset_logo", label: "Merchant logo" },
        supportingImageAssetRefs: [],
        preferredBrandColours: ["#123456"],
        typographyDirection: "serif-led",
        visualStyleDirection: "editorial",
        imageryDirection: "studio",
        toneKeywords: ["warm"],
      },
      ...overrides,
    }),
    { actorId: "merchant_owner", approvedAt: now },
  );
}

function approvedAssetContext(
  brief = approvedBrief({ assetReviewFingerprint: "asset-review-whole-storefront" }),
) {
  const value = {
    briefId: "brief_whole_storefront",
    briefRevision: 1,
    approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint!,
    assetReviewFingerprint: "asset-review-whole-storefront",
    assets: [
      {
        assetId: "asset_collection_source",
        role: "collectionImage" as const,
        sourceReferenceId: "source_whole_storefront",
        revision: "asset-revision-1",
        materialFingerprint: "asset-material-1",
        provenance: { location: "html-meta" as const, observedAt: now },
        alt: { en: "Approved collection image", fi: "Hyväksytty mallistokuva" },
        presentation: { decorative: false, mediaType: "image/jpeg", responsiveCrops: [] },
        approval: { actorId: "merchant_owner", actorReference: "merchant-session" },
      },
    ],
  };
  return { ...value, fingerprint: createApprovedGenerationAssetContextFingerprint(value) };
}

function input(overrides: Record<string, unknown> = {}) {
  const brief = approvedBrief({ assetReviewFingerprint: "asset-review-whole-storefront" });
  return {
    brief,
    project: {
      id: aurumNordicSeed.project.id,
      revision: aurumNordicSeed.project.revision,
      enabledLocales: ["en", "fi"],
    },
    draft: structuredClone(aurumNordicSeed.draftSnapshot),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    componentDefinitions: structuredClone(veskifyComponentDefinitionsV2),
    approvedAssetContext: null,
    requiredAssetPlacements: [],
    ...overrides,
  };
}

describe("P8-01 whole-storefront generation plan", () => {
  it("creates one deterministic approved-brief plan for home, collection and product families", () => {
    const first = createWholeStorefrontGenerationPlan(input());
    const second = createWholeStorefrontGenerationPlan(input());

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.pagePlans.map((page) => page.role)).toEqual([
      "collection-template",
      "homepage",
      "product-template",
    ]);
    expect(first.sharedDesignDirection.brandSystemFingerprint).toBe(
      first.target.brandSystemFingerprint,
    );
    expect(first.pagePlans.every((page) => page.disposition === "retained")).toBe(true);

    const homeOnlyDraft = structuredClone(aurumNordicSeed.draftSnapshot);
    homeOnlyDraft.pages = homeOnlyDraft.pages.filter((page) => page.type === "home");
    homeOnlyDraft.navigation = { primary: [], footer: [] };
    const initialized = createWholeStorefrontGenerationPlan(input({ draft: homeOnlyDraft }));
    expect(initialized.pagePlans.filter((page) => page.disposition === "created")).toHaveLength(2);
  });

  it("blocks missing, unapproved and stale approved briefs", () => {
    const missing = input({ brief: { ...approvedBrief(), status: "needsReview" } });
    expect(() => createWholeStorefrontGenerationPlan(missing)).toThrow(/approve/i);

    const stale = approvedBrief();
    stale.evidenceFingerprint = "changed-evidence";
    expect(() => createWholeStorefrontGenerationPlan(input({ brief: stale }))).toThrow(/stale/i);
  });

  it("invalidates a prior plan when the target draft or supported locale plan changes", () => {
    const current = input();
    const plan = createWholeStorefrontGenerationPlan(current);
    const changed = input({
      draft: { ...current.draft, revision: current.draft.revision + 1 },
    });

    expect(createWholeStorefrontGenerationPlan(changed).requestFingerprint).not.toBe(
      plan.requestFingerprint,
    );
    expect(createWholeStorefrontGenerationTarget(changed).fingerprint).not.toBe(
      plan.target.fingerprint,
    );
  });

  it("uses read-only canonical product and collection bindings instead of copied commerce facts", () => {
    const plan = createWholeStorefrontGenerationPlan(input());
    const productBinding = plan.canonicalCommerceBindings.find(
      (binding) => binding.source === "product",
    );
    const collectionBinding = plan.canonicalCommerceBindings.find(
      (binding) => binding.source === "collection",
    );

    expect(productBinding).toMatchObject({ productId: aurumNordicSeed.catalogue.products[0].id });
    expect(collectionBinding).toMatchObject({
      collectionId: aurumNordicSeed.catalogue.collections[0].id,
    });
    expect(JSON.stringify(productBinding)).not.toContain('"price"');
    expect(plan.reviewSummary.protectedFactsPreserved.join(" ")).toMatch(
      /SKU, price, availability/i,
    );
  });

  it("rejects unknown product, collection and component references", () => {
    const missingComponent = input();
    missingComponent.draft.pages[0].sections[0].component = "unknownComponent";
    expect(() => createWholeStorefrontGenerationPlan(missingComponent)).toThrow(/unregistered/i);

    const missingCommerce = input();
    missingCommerce.catalogue.collections[0].productIds = ["product_unknown"];
    expect(() => createWholeStorefrontGenerationPlan(missingCommerce)).toThrow(/resolve within/i);
  });

  it("uses existing V2 validation for incompatible component versions and data contracts", () => {
    const invalidRegistry = input();
    const dynamicProduct = invalidRegistry.componentDefinitions.find(
      (definition) => definition.type === "dynamicProductDetail",
    )!;
    dynamicProduct.version = { major: 3, minor: 0, patch: 0 };

    expect(() => createWholeStorefrontGenerationPlan(invalidRegistry)).toThrow(
      /registered version|invalid/i,
    );
  });

  it("permits only compatible current approved asset placements", () => {
    const context = approvedAssetContext(input().brief);
    const collectionPage = aurumNordicSeed.draftSnapshot.pages.find(
      (page) => page.type === "collection",
    )!;
    const placement = {
      type: "PLACE_APPROVED_SOURCE_ASSET" as const,
      pageId: collectionPage.id,
      componentId: `plan_${collectionPage.id}_collection_commerce`,
      componentType: "dynamicCollectionCommerce",
      assetSlotId: "collectionCommerceMedia",
      assetId: context.assets[0].assetId,
      role: context.assets[0].role,
      assetRevision: context.assets[0].revision,
      materialFingerprint: context.assets[0].materialFingerprint,
      sourceReferenceId: context.assets[0].sourceReferenceId,
      required: true,
    };
    const plan = createWholeStorefrontGenerationPlan(
      input({ approvedAssetContext: context, requiredAssetPlacements: [placement] }),
    );

    expect(plan.approvedAssetPlacements).toEqual([placement]);
    expect(() =>
      createWholeStorefrontGenerationPlan(
        input({
          approvedAssetContext: context,
          requiredAssetPlacements: [{ ...placement, assetSlotId: "unknownSlot" }],
        }),
      ),
    ).toThrow(/not compatible/i);
  });

  it("rejects missing or stale required approved asset placements", () => {
    const context = approvedAssetContext(input().brief);
    const collectionPage = aurumNordicSeed.draftSnapshot.pages.find(
      (page) => page.type === "collection",
    )!;
    const placement = {
      type: "PLACE_APPROVED_SOURCE_ASSET" as const,
      pageId: collectionPage.id,
      componentId: `plan_${collectionPage.id}_collection_commerce`,
      componentType: "dynamicCollectionCommerce",
      assetSlotId: "collectionCommerceMedia",
      assetId: context.assets[0].assetId,
      role: context.assets[0].role,
      assetRevision: "stale-revision",
      materialFingerprint: context.assets[0].materialFingerprint,
      sourceReferenceId: context.assets[0].sourceReferenceId,
      required: true,
    };

    expect(() =>
      createWholeStorefrontGenerationPlan(input({ requiredAssetPlacements: [placement] })),
    ).toThrow(/unavailable/i);
    expect(() =>
      createWholeStorefrontGenerationPlan(
        input({ approvedAssetContext: context, requiredAssetPlacements: [placement] }),
      ),
    ).toThrow(/no longer approved/i);
  });

  it("rejects provider-invented plans and stale asynchronous results", async () => {
    const current = input();
    const plan = createWholeStorefrontGenerationPlan(current);
    const invented = structuredClone(plan);
    invented.target.projectId = "project_invented";
    expect(() => validateWholeStorefrontGenerationPlan(current, invented)).toThrow(
      /does not match/i,
    );

    await expect(
      acceptWholeStorefrontPlanningResult(current, Promise.resolve(plan), () =>
        input({ project: { ...current.project, revision: current.project.revision + 1 } }),
      ),
    ).rejects.toMatchObject({ code: "stale-result" });
  });

  it("is planning-only and leaves the source draft and catalogue unchanged on failure", () => {
    const current = input();
    const before = structuredClone({ draft: current.draft, catalogue: current.catalogue });
    current.draft.pages[0].sections[0].component = "unknownComponent";

    expect(() => createWholeStorefrontGenerationPlan(current)).toThrow();
    expect(aurumNordicSeed.draftSnapshot).toEqual(before.draft);
    expect(aurumNordicSeed.catalogue).toEqual(before.catalogue);
  });
});
