import { describe, expect, it } from "vitest";
import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
  listCompatibleCoordinatedDirectionSelectionNarrowings,
} from "@/application/bounded-storefront-synthesis";
import {
  migrateLegacyDynamicCommerceRoutes,
  requireMigratedDynamicCommerceSnapshot,
  resolveDynamicCommerceRoutePage,
} from "@/application/dynamic-commerce-routes";
import {
  createWholeStorefrontGenerationPlan,
  materializeCompleteStorefrontSelection,
  resolveRegisteredCollectionApprovedAssetSelections,
  type WholeStorefrontApprovedAssetRoleSelection,
  type WholeStorefrontGenerationPlanError,
} from "@/application/whole-storefront-generation-plan";
import { materializeWholeStorefrontRuntimeSnapshot } from "@/application/whole-storefront-proposal-lifecycle";
import { P10B14_PREMIUM_EDITORIAL_SELECTION } from "@/application/premium-editorial-vertical-slice";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { createP10B16P04RawAurumCommercialFixture } from "@/data/demo/p10b-16p-04-commercial-acceptance";

function exactStoryAssetSelection(
  source: ReturnType<typeof createP10B14PremiumEditorialFixture>,
): WholeStorefrontApprovedAssetRoleSelection {
  const asset = source.fixture.assetContext.assets.find(({ role }) => role === "editorialImage");
  if (!asset) throw new Error("Missing approved editorial fixture asset.");
  return {
    profileId: P10B14_PREMIUM_EDITORIAL_SELECTION.homepageProfileId,
    slotId: "hero",
    component: "homepageHero",
    assetSlotId: "heroMedia",
    role: asset.role,
    assetId: asset.assetId,
    assetRevision: asset.revision,
    materialFingerprint: asset.materialFingerprint,
    authorityFingerprint: source.fixture.assetContext.fingerprint,
  };
}

function exactCollectionAssetSelection(
  source: ReturnType<typeof createP10B14PremiumEditorialFixture>,
) {
  const selections = resolveRegisteredCollectionApprovedAssetSelections({
    planningInput: source.slice.planningInput,
    profileId: P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
  });
  const selection = selections.find(({ role }) => role === "collectionImage");
  if (!selection) throw new Error("Missing exact approved collection-image selection.");
  return selection;
}

describe("P10B-16P-02B exact approved asset-role execution", () => {
  it("uses the exact approved role and asset in the canonical plan instead of first-compatible order", () => {
    const source = createP10B14PremiumEditorialFixture();
    const selection = exactStoryAssetSelection(source);
    const plan = createWholeStorefrontGenerationPlan(source.slice.planningInput, {
      directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
      homepageProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.homepageProfileId,
      collectionProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
      pdpProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.pdpProfileId,
      approvedAssetRoleSelections: [selection],
    });
    const hero = plan.pagePlans
      .flatMap(({ components }) => components)
      .find(
        (component) =>
          "instance" in component && component.pageBlueprintSlotId === selection.slotId,
      );

    expect(plan.approvedAssetRoleSelections).toEqual([selection]);
    expect(hero && "instance" in hero ? hero.instance.assetAssignments : []).toEqual([
      {
        slotId: selection.assetSlotId,
        assetId: selection.assetId,
        role: selection.role,
      },
    ]);
    expect(plan.approvedAssetPlacements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetSlotId: selection.assetSlotId,
          assetId: selection.assetId,
          role: selection.role,
          assetRevision: selection.assetRevision,
          materialFingerprint: selection.materialFingerprint,
        }),
      ]),
    );
  });

  it("preserves the exact selection through the sole complete-storefront materialization", () => {
    const source = createP10B14PremiumEditorialFixture();
    const selection = exactStoryAssetSelection(source);
    const result = materializeCompleteStorefrontSelection({
      planningInput: source.slice.planningInput,
      siteMapDecision: source.siteMapDecision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
      directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
      approvedAssetRoleSelections: [selection],
      materializationIdPrefix: "p10b16p02b_asset_role",
    });
    const hero = result.snapshot.pages
      .find(({ type }) => type === "home")
      ?.sections.find(({ component }) => component === "homepageHero");

    expect(result.plan.approvedAssetRoleSelections).toEqual([selection]);
    expect(hero?.approvedAssetPlacements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetSlotId: selection.assetSlotId,
          assetId: selection.assetId,
          role: selection.role,
        }),
      ]),
    );
    expect(hero?.approvedAssetPresentations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetId: selection.assetId, role: selection.role }),
      ]),
    );
  });

  it("derives the exact collection asset from registered profile and slot authority", () => {
    const source = createP10B14PremiumEditorialFixture();
    const selection = exactCollectionAssetSelection(source);
    const repeated = exactCollectionAssetSelection(source);

    expect(selection).toMatchObject({
      profileId: P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
      component: "dynamicCollectionCommerce",
      assetSlotId: "collectionCommerceMedia",
      role: "collectionImage",
      authorityFingerprint: source.fixture.assetContext.fingerprint,
    });
    expect(selection.selectionFingerprint).toMatch(/^registered-collection-asset-/);
    expect(repeated).toEqual(selection);

    const result = materializeCompleteStorefrontSelection({
      planningInput: source.slice.planningInput,
      siteMapDecision: source.siteMapDecision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
      directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
    });
    const dynamicCollectionSections =
      result.snapshot.dynamicCommercePresentation?.routeInventory.flatMap((route) =>
        route.kind === "collection"
          ? [
              resolveDynamicCommerceRoutePage({
                snapshot: result.snapshot,
                catalogue: source.fixture.planningInput.catalogue,
                routeId: route.id,
                projection: "runtime",
              }).page.sections[0],
            ]
          : [],
      ) ?? [];
    expect(dynamicCollectionSections.length).toBeGreaterThan(0);
    expect(
      dynamicCollectionSections.every((section) =>
        section.approvedAssetPlacements?.some(
          (placement) =>
            placement.assetId === selection.assetId &&
            placement.assetSlotId === selection.assetSlotId &&
            placement.role === selection.role,
        ),
      ),
    ).toBe(true);
  });

  it("preserves a non-default registered collection variant through proposal replay and dynamic-route resolution", () => {
    const source = createP10B14PremiumEditorialFixture();
    const selectedVariant = "catalogueComparison" as const;
    const pageBlueprintSelectionOverrides = [
      {
        pageType: "collection" as const,
        profileId: P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
        slotSelections: [
          {
            slotId: "collection-commerce",
            component: "dynamicCollectionCommerce",
            variant: selectedVariant,
            boundedParameters: {},
          },
        ],
      },
    ] as const;
    const result = materializeCompleteStorefrontSelection({
      planningInput: source.slice.planningInput,
      siteMapDecision: source.siteMapDecision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
      directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
      pageBlueprintSelectionOverrides,
      materializationIdPrefix: "p10b16p02b_collection_variant",
    });
    const authority = result.snapshot.dynamicCommercePresentation;
    expect(authority).toBeDefined();
    const collectionMapping = authority?.collectionRouteMappings[0];
    const collectionArchetype = authority?.collectionSearchArchetypes.find(
      ({ id }) => id === collectionMapping?.archetypeId,
    );

    expect(
      result.plan.pageBlueprintMaterializations
        .find(({ pageType }) => pageType === "collection")
        ?.slots.find(({ slotId }) => slotId === "collection-commerce")?.variant,
    ).toBe(selectedVariant);
    expect(collectionArchetype?.componentPresentations[0]?.variant).toBe(selectedVariant);
    const replayed = requireMigratedDynamicCommerceSnapshot(
      materializeWholeStorefrontRuntimeSnapshot({
        runtime: result.proposal.proposedStorefront,
        planningInput: result.planningInput,
        approvedAssetPresentations: source.fixture.assetPresentations,
      }),
      source.fixture.planningInput.catalogue,
    );
    expect(replayed.dynamicCommercePresentation).toEqual(authority);

    const collectionRoute = authority?.routeInventory.find(({ kind }) => kind === "collection");
    if (!collectionRoute) throw new Error("Missing collection route for exact variant replay.");
    expect(
      resolveDynamicCommerceRoutePage({
        snapshot: result.snapshot,
        catalogue: source.fixture.planningInput.catalogue,
        routeId: collectionRoute.id,
        projection: "runtime",
      }).page.sections[0]?.variant,
    ).toBe(selectedVariant);
  });

  it("does not promote one collection image across a multi-collection archetype while retaining shared campaign media", () => {
    const source = createP10B16P04RawAurumCommercialFixture();
    expect(source.executionPlanningInput.catalogue.collections.length).toBeGreaterThan(1);
    const collectionAsset = source.executionPlanningInput.approvedAssetContext?.assets.find(
      ({ role }) => role === "collectionImage",
    );
    const editorialAsset = source.executionPlanningInput.approvedAssetContext?.assets.find(
      ({ role }) => role === "editorialImage",
    );
    if (!collectionAsset || !editorialAsset) {
      throw new Error("Missing approved multi-collection asset fixture authority.");
    }
    const compatibilityInput = {
      planningInput: source.executionPlanningInput,
      siteMapDecision: source.siteMapDecision,
      approvedEvidenceReferences: source.approvedEvidenceReferences,
    };
    const synthesisInput = {
      ...compatibilityInput,
      request: {
        intent: "campaign-emphasis" as const,
        deterministicSeed: "multi-collection-shared-campaign-media",
      },
    };
    const decision = createBoundedStorefrontSynthesisDecision(synthesisInput);
    const result = executeBoundedStorefrontSynthesis({
      ...synthesisInput,
      decision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.approvedAssetPresentations,
    });
    const authority = result.materialization.snapshot.dynamicCommercePresentation;
    expect(authority).toBeDefined();
    const selectedArchetypeIds = new Set(
      authority?.collectionRouteMappings.map(({ archetypeId }) => archetypeId),
    );
    expect([...selectedArchetypeIds]).toHaveLength(1);
    const selectedArchetype = authority?.collectionSearchArchetypes.find(({ id }) =>
      selectedArchetypeIds.has(id),
    );
    const selectedAssets =
      selectedArchetype?.componentPresentations.flatMap(
        ({ approvedAssetSelections }) => approvedAssetSelections ?? [],
      ) ?? [];

    expect(decision.commercialProfiles.collectionProfileId).toBe(
      "collection-campaign-led-discovery",
    );
    expect(selectedAssets).toEqual([
      expect.objectContaining({ assetId: editorialAsset.assetId, role: "editorialImage" }),
    ]);
    expect(selectedAssets).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetId: collectionAsset.assetId, role: "collectionImage" }),
      ]),
    );
    const legacyWithNonReusableRequiredAsset = materializeWholeStorefrontRuntimeSnapshot({
      runtime: result.materialization.proposal.proposedStorefront,
      planningInput: result.materialization.planningInput,
      approvedAssetPresentations: source.approvedAssetPresentations,
    });
    const pagesWithEditorialPlacement = legacyWithNonReusableRequiredAsset.pages.flatMap((page) => {
      const placement = page.sections
        .filter(({ component }) => component === "dynamicCollectionCommerce")
        .flatMap(({ approvedAssetPlacements }) => approvedAssetPlacements ?? [])
        .find(({ role }) => role === "editorialImage");
      return placement ? [{ page, placement }] : [];
    });
    if (pagesWithEditorialPlacement.length < 2) {
      throw new Error("Missing shared editorial asset migration fixture.");
    }
    const [changedEditorial] = pagesWithEditorialPlacement;
    changedEditorial.placement.required = !changedEditorial.placement.required;
    const expectedConflictingRouteIds = pagesWithEditorialPlacement
      .filter(({ placement }) => placement.required)
      .map(({ page }) => page.id);
    const requiredAssetMigration = migrateLegacyDynamicCommerceRoutes(
      legacyWithNonReusableRequiredAsset,
      source.executionPlanningInput.catalogue,
    );
    expect(requiredAssetMigration.status).toBe("requires-decision");
    if (requiredAssetMigration.status === "requires-decision") {
      expect(requiredAssetMigration.decisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "conflicting-legacy-presentation",
            routeIds: expectedConflictingRouteIds,
          }),
        ]),
      );
    }
    const replayed = requireMigratedDynamicCommerceSnapshot(
      materializeWholeStorefrontRuntimeSnapshot({
        runtime: result.materialization.proposal.proposedStorefront,
        planningInput: result.materialization.planningInput,
        approvedAssetPresentations: source.approvedAssetPresentations,
      }),
      source.executionPlanningInput.catalogue,
    );
    expect(replayed.dynamicCommercePresentation).toEqual(authority);

    const collectionRoutes = authority?.routeInventory.filter(({ kind }) => kind === "collection");
    expect(collectionRoutes).toHaveLength(
      source.executionPlanningInput.catalogue.collections.length,
    );
    for (const route of collectionRoutes ?? []) {
      const section = resolveDynamicCommerceRoutePage({
        snapshot: result.materialization.snapshot,
        catalogue: source.executionPlanningInput.catalogue,
        routeId: route.id,
        projection: "runtime",
      }).page.sections[0];
      expect(section?.approvedAssetPlacements).toEqual([
        expect.objectContaining({ assetId: editorialAsset.assetId, role: "editorialImage" }),
      ]);
    }
  });

  it("carries exact asset execution authority through bounded synthesis and proposal replay", () => {
    const source = createP10B14PremiumEditorialFixture();
    const migration = migrateLegacyDynamicCommerceRoutes(
      source.slice.snapshot,
      source.fixture.planningInput.catalogue,
    );
    if (migration.status === "requires-decision") {
      throw new Error("Dynamic-commerce fixture migration requires a decision.");
    }
    const selection = exactStoryAssetSelection(source);
    const compatibilityInput = {
      planningInput: { ...source.fixture.planningInput, draft: migration.snapshot },
      siteMapDecision: source.siteMapDecision,
      approvedEvidenceReferences: source.approvedEvidenceReferences,
    };
    const narrowing = listCompatibleCoordinatedDirectionSelectionNarrowings(
      compatibilityInput,
    ).find(
      (candidate) =>
        candidate.homepageProfileId === selection.profileId &&
        candidate.directionId === P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
    );
    if (!narrowing) throw new Error("Missing compatible exact asset-role fixture narrowing.");
    const synthesisInput = {
      ...compatibilityInput,
      request: { intent: "prompted-design-v2" as const, deterministicSeed: "asset-role-exact" },
      selectionNarrowing: narrowing,
      approvedAssetRoleSelections: [selection],
    };
    const decision = createBoundedStorefrontSynthesisDecision(synthesisInput);
    const result = executeBoundedStorefrontSynthesis({
      ...synthesisInput,
      decision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });

    expect(decision.approvedAssetRoleSelections).toEqual([selection]);
    expect(decision.exactSelectionAuthority.approvedAssetRoleSelectionFingerprint).toMatch(
      /^bounded-approved-asset-role-selections-/,
    );
    expect(result.materialization.plan.approvedAssetRoleSelections).toEqual([selection]);
    expect(result.materialization.proposal.status).toBe("pending");
  });

  it("fails closed for stale assets and unsupported exact variant anatomy targets", () => {
    const source = createP10B14PremiumEditorialFixture();
    const selection = exactStoryAssetSelection(source);

    expect(() =>
      createWholeStorefrontGenerationPlan(source.slice.planningInput, {
        directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
        homepageProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.homepageProfileId,
        collectionProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
        pdpProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.pdpProfileId,
        approvedAssetRoleSelections: [
          { ...selection, materialFingerprint: "stale-material-fingerprint" },
        ],
      }),
    ).toThrow(
      expect.objectContaining<Partial<WholeStorefrontGenerationPlanError>>({
        code: "stale-approved-asset",
      }),
    );

    expect(() =>
      createWholeStorefrontGenerationPlan(source.slice.planningInput, {
        directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
        homepageProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.homepageProfileId,
        collectionProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
        pdpProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.pdpProfileId,
        approvedAssetRoleSelections: [
          {
            ...selection,
            slotId: "curated-products",
            component: "homepageFeaturedProducts",
            assetSlotId: "productMedia",
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining<Partial<WholeStorefrontGenerationPlanError>>({
        code: "asset-role-slot-incompatible",
      }),
    );
  });

  it("fails before materialization when the exact asset has no matching renderer presentation", () => {
    const source = createP10B14PremiumEditorialFixture();
    const selection = exactStoryAssetSelection(source);

    expect(() =>
      materializeCompleteStorefrontSelection({
        planningInput: source.slice.planningInput,
        siteMapDecision: source.siteMapDecision,
        pageEvidenceAuthority: source.pageEvidenceAuthority,
        contentFactAuthority: source.contentFactAuthority,
        approvedAssetPresentations: source.fixture.assetPresentations.filter(
          ({ assetId }) => assetId !== selection.assetId,
        ),
        directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
        approvedAssetRoleSelections: [selection],
      }),
    ).toThrow(
      expect.objectContaining<Partial<WholeStorefrontGenerationPlanError>>({
        code: "stale-approved-asset",
      }),
    );
  });

  it("fails closed for stale, wrong-role, wrong-slot, and unavailable collection assets", () => {
    const source = createP10B14PremiumEditorialFixture();
    const selection = exactCollectionAssetSelection(source);
    const input = {
      planningInput: source.slice.planningInput,
      siteMapDecision: source.siteMapDecision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
    } as const;
    const selectedPresentation = source.fixture.assetPresentations.find(
      ({ assetId, role }) => assetId === selection.assetId && role === selection.role,
    );
    if (!selectedPresentation) throw new Error("Missing collection renderer presentation fixture.");

    for (const approvedAssetPresentations of [
      source.fixture.assetPresentations.filter(({ assetId }) => assetId !== selection.assetId),
      source.fixture.assetPresentations.map((presentation) =>
        presentation === selectedPresentation
          ? { ...presentation, revision: "stale-collection-asset-revision" }
          : presentation,
      ),
      source.fixture.assetPresentations.map((presentation) =>
        presentation === selectedPresentation
          ? { ...presentation, role: "editorialImage" as const }
          : presentation,
      ),
    ]) {
      expect(() =>
        materializeCompleteStorefrontSelection({
          ...input,
          approvedAssetPresentations,
        }),
      ).toThrow(
        expect.objectContaining<Partial<WholeStorefrontGenerationPlanError>>({
          code: "stale-approved-asset",
        }),
      );
    }

    const planningInputWithWrongSlot = {
      ...source.slice.planningInput,
      componentDefinitions: source.slice.planningInput.componentDefinitions.map((definition) =>
        definition.type === "dynamicCollectionCommerce"
          ? {
              ...definition,
              assetSlots: definition.assetSlots.map((slot) =>
                slot.id === "collectionCommerceMedia"
                  ? { ...slot, id: "wrongCollectionCommerceMedia" }
                  : slot,
              ),
            }
          : definition,
      ),
    };
    expect(() =>
      materializeCompleteStorefrontSelection({
        ...input,
        planningInput: planningInputWithWrongSlot,
        approvedAssetPresentations: source.fixture.assetPresentations,
      }),
    ).toThrow(/Commercial anatomy asset requirements must cover the registered asset slots/);
  });
});
