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
import type { ComponentDefinitionV2 } from "@/domain/component-platform";
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

function requiredValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing ${label}.`);
  return value;
}

function generatedComponent(
  plan: ReturnType<typeof createWholeStorefrontGenerationPlan>,
  role: "collection-template" | "product-template",
) {
  const page = requiredValue(
    plan.pagePlans.find((candidate) => candidate.role === role),
    role,
  );
  return requiredValue(
    page.components.find(
      (component): component is Extract<(typeof page.components)[number], { instance: unknown }> =>
        "instance" in component,
    ),
    `${role} generated component`,
  );
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

  it("uses the supplied V2 registry versions for generated components", () => {
    const invalidRegistry = input();
    const dynamicCollection = requiredValue(
      invalidRegistry.componentDefinitions.find(
        (definition) => definition.type === "dynamicCollectionCommerce",
      ),
      "dynamic collection definition",
    );
    const dynamicProduct = requiredValue(
      invalidRegistry.componentDefinitions.find(
        (definition) => definition.type === "dynamicProductDetail",
      ),
      "dynamic product definition",
    );
    dynamicCollection.version = { major: 2, minor: 1, patch: 0 };
    dynamicProduct.version = { major: 3, minor: 0, patch: 0 };

    const plan = createWholeStorefrontGenerationPlan(invalidRegistry);
    expect(generatedComponent(plan, "collection-template").instance.componentVersion).toEqual({
      major: 2,
      minor: 1,
      patch: 0,
    });
    expect(generatedComponent(plan, "product-template").instance.componentVersion).toEqual({
      major: 3,
      minor: 0,
      patch: 0,
    });
  });

  it("permits only compatible current approved asset placements", () => {
    const context = approvedAssetContext(input().brief);
    const baseline = createWholeStorefrontGenerationPlan(input());
    const collectionComponent = generatedComponent(baseline, "collection-template").instance;
    const collectionPage = requiredValue(
      baseline.pagePlans.find((page) => page.role === "collection-template"),
      "collection page plan",
    );
    const placement = {
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: collectionPage.pageId,
      componentId: collectionComponent.id,
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
    const baseline = createWholeStorefrontGenerationPlan(input());
    const collectionComponent = generatedComponent(baseline, "collection-template").instance;
    const collectionPage = requiredValue(
      baseline.pagePlans.find((page) => page.role === "collection-template"),
      "collection page plan",
    );
    const placement = {
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: collectionPage.pageId,
      componentId: collectionComponent.id,
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

  it("preserves existing collection and product bindings and rejects ambiguous page commerce", () => {
    const current = input();
    const collection = requiredValue(current.catalogue.collections[1], "second collection");
    const product = requiredValue(current.catalogue.products[1], "second product");
    const collectionPage = requiredValue(
      current.draft.pages.find((page) => page.type === "collection"),
      "collection page",
    );
    const productPage = requiredValue(
      current.draft.pages.find((page) => page.type === "product"),
      "product page",
    );
    requiredValue(
      collectionPage.sections.find((section) => section.component === "collectionHeader"),
      "collection header",
    ).content = { collectionId: collection.id };
    requiredValue(
      collectionPage.sections.find((section) => section.component === "productGrid"),
      "collection product grid",
    ).content = {
      heading: { en: "Collection", fi: "Mallisto" },
      productIds: collection.productIds,
    };
    productPage.sections
      .filter((section) =>
        ["productGallery", "productInfo", "productOptions"].includes(section.component),
      )
      .forEach((section) => {
        section.content = { productId: product.id };
      });

    const plan = createWholeStorefrontGenerationPlan(current);
    expect(plan.canonicalCommerceBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "collection", collectionId: collection.id }),
        expect.objectContaining({ source: "product", productId: product.id }),
      ]),
    );

    requiredValue(
      productPage.sections.find((section) => section.component === "productInfo"),
      "product information",
    ).content = { productId: aurumNordicSeed.catalogue.products[0].id };
    expect(() => createWholeStorefrontGenerationPlan(current)).toThrow(/conflicting|ambiguous/i);

    const missingBinding = input();
    const missingCollectionPage = requiredValue(
      missingBinding.draft.pages.find((page) => page.type === "collection"),
      "missing collection page",
    );
    requiredValue(
      missingCollectionPage.sections.find((section) => section.component === "productGrid"),
      "missing collection product grid",
    ).content = { heading: { en: "Collection", fi: "Mallisto" } };
    expect(() => createWholeStorefrontGenerationPlan(missingBinding)).toThrow(/missing|ambiguous/i);
  });

  it("allows retained asset targets but rejects removed replacement targets", () => {
    const current = input();
    const headerDefinition = requiredValue(
      current.componentDefinitions.find((definition) => definition.type === "header"),
      "header definition",
    );
    const collectionHeaderDefinition = requiredValue(
      current.componentDefinitions.find((definition) => definition.type === "collectionHeader"),
      "collection header definition",
    );
    const slot = {
      id: "approvedSourceMedia",
      title: { en: "Approved source media", fi: "Hyväksytty lähdemedia" },
      acceptedRoles: ["collectionImage"],
      required: false,
      minItems: 0,
      maxItems: 1,
    } satisfies ComponentDefinitionV2["assetSlots"][number];
    headerDefinition.assetSlots = [slot];
    collectionHeaderDefinition.assetSlots = [slot];
    const context = approvedAssetContext(current.brief);
    const homePage = requiredValue(
      current.draft.pages.find((page) => page.type === "home"),
      "home page",
    );
    const homeHeader = requiredValue(
      homePage.sections.find((section) => section.component === "header"),
      "home header",
    );
    const retainedPlacement = {
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: homePage.id,
      componentId: homeHeader.id,
      componentType: "header",
      assetSlotId: slot.id,
      assetId: context.assets[0].assetId,
      role: context.assets[0].role,
      assetRevision: context.assets[0].revision,
      materialFingerprint: context.assets[0].materialFingerprint,
      sourceReferenceId: context.assets[0].sourceReferenceId,
      required: true,
    };
    expect(
      createWholeStorefrontGenerationPlan({
        ...current,
        approvedAssetContext: context,
        requiredAssetPlacements: [retainedPlacement],
      }).approvedAssetPlacements,
    ).toEqual([retainedPlacement]);

    const collectionPage = requiredValue(
      current.draft.pages.find((page) => page.type === "collection"),
      "collection page",
    );
    const replacedHeader = requiredValue(
      collectionPage.sections.find((section) => section.component === "collectionHeader"),
      "replaced collection header",
    );
    expect(() =>
      createWholeStorefrontGenerationPlan({
        ...current,
        approvedAssetContext: context,
        requiredAssetPlacements: [
          {
            ...retainedPlacement,
            pageId: collectionPage.id,
            componentId: replacedHeader.id,
            componentType: "collectionHeader",
          },
        ],
      }),
    ).toThrow(/unavailable component/i);
  });

  it("creates deterministic unique page and component IDs for collisions and long page IDs", () => {
    const collidingDraft = structuredClone(aurumNordicSeed.draftSnapshot);
    const home = requiredValue(
      collidingDraft.pages.find((page) => page.type === "home"),
      "home page",
    );
    home.id = "page_collection_template";
    collidingDraft.pages = [home];
    collidingDraft.navigation = { primary: [], footer: [] };
    const collisionPlan = createWholeStorefrontGenerationPlan(input({ draft: collidingDraft }));
    const collectionPlan = requiredValue(
      collisionPlan.pagePlans.find((page) => page.role === "collection-template"),
      "created collection page",
    );
    expect(collectionPlan.pageId).not.toBe("page_collection_template");
    expect(new Set(collisionPlan.pagePlans.map((page) => page.pageId)).size).toBe(
      collisionPlan.pagePlans.length,
    );

    const longDraft = structuredClone(aurumNordicSeed.draftSnapshot);
    const longCollectionPage = requiredValue(
      longDraft.pages.find((page) => page.type === "collection"),
      "long collection page",
    );
    longCollectionPage.id = `page_${"a".repeat(75)}`;
    longDraft.navigation = { primary: [], footer: [] };
    const first = createWholeStorefrontGenerationPlan(input({ draft: longDraft }));
    const second = createWholeStorefrontGenerationPlan(input({ draft: longDraft }));
    const generated = generatedComponent(first, "collection-template").instance;
    expect(generated.id.length).toBeLessThanOrEqual(80);
    expect(generated.id).toBe(generatedComponent(second, "collection-template").instance.id);
  });

  it("marks retained components unsupported on their page type as compatibility review items", () => {
    const current = input();
    const homePage = requiredValue(
      current.draft.pages.find((page) => page.type === "home"),
      "home page",
    );
    homePage.sections.push({
      id: "section_home_incompatible_collection_header",
      component: "collectionHeader",
      variant: "editorial",
      visible: true,
      content: { collectionId: current.catalogue.collections[0].id },
      props: { mediaPosition: "right" },
    });

    const plan = createWholeStorefrontGenerationPlan(current);
    expect(plan.reviewSummary.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componentId: "section_home_incompatible_collection_header",
          disposition: "fallback-retained",
        }),
      ]),
    );
    expect(plan.requiredMerchantReviewItems.map((item) => item.message).join(" ")).toMatch(
      /compatibility/i,
    );
  });

  it("enforces approved asset slot cardinality and duplicate placement identities", () => {
    const current = input();
    const headerDefinition = requiredValue(
      current.componentDefinitions.find((definition) => definition.type === "header"),
      "header definition",
    );
    headerDefinition.assetSlots = [
      {
        id: "approvedSourceMedia",
        title: { en: "Approved source media", fi: "Hyväksytty lähdemedia" },
        acceptedRoles: ["collectionImage"],
        required: false,
        minItems: 0,
        maxItems: 1,
      },
    ];
    const initialContext = approvedAssetContext(current.brief);
    const firstAsset = requiredValue(initialContext.assets[0], "first approved asset");
    const contextValue = {
      briefId: initialContext.briefId,
      briefRevision: initialContext.briefRevision,
      approvedEvidenceFingerprint: initialContext.approvedEvidenceFingerprint,
      assetReviewFingerprint: initialContext.assetReviewFingerprint,
      assets: [
        ...initialContext.assets,
        {
          ...firstAsset,
          assetId: "asset_collection_source_second",
          revision: "asset-revision-2",
          materialFingerprint: "asset-material-2",
        },
      ],
    };
    const context = {
      ...contextValue,
      fingerprint: createApprovedGenerationAssetContextFingerprint(contextValue),
    };
    const homePage = requiredValue(
      current.draft.pages.find((page) => page.type === "home"),
      "home page",
    );
    const homeHeader = requiredValue(
      homePage.sections.find((section) => section.component === "header"),
      "home header",
    );
    const placement = {
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: homePage.id,
      componentId: homeHeader.id,
      componentType: "header",
      assetSlotId: "approvedSourceMedia",
      assetId: firstAsset.assetId,
      role: firstAsset.role,
      assetRevision: firstAsset.revision,
      materialFingerprint: firstAsset.materialFingerprint,
      sourceReferenceId: firstAsset.sourceReferenceId,
      required: true,
    };
    const secondPlacement = {
      ...placement,
      assetId: context.assets[1].assetId,
      assetRevision: context.assets[1].revision,
      materialFingerprint: context.assets[1].materialFingerprint,
    };
    expect(() =>
      createWholeStorefrontGenerationPlan({
        ...current,
        approvedAssetContext: context,
        requiredAssetPlacements: [placement, secondPlacement],
      }),
    ).toThrow(/maximum items/i);
    expect(() =>
      createWholeStorefrontGenerationPlan({
        ...current,
        approvedAssetContext: context,
        requiredAssetPlacements: [placement, placement],
      }),
    ).toThrow(/more than once/i);
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
