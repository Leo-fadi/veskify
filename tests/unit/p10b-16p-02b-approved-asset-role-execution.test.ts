import { describe, expect, it } from "vitest";
import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
  listCompatibleCoordinatedDirectionSelectionNarrowings,
} from "@/application/bounded-storefront-synthesis";
import { migrateLegacyDynamicCommerceRoutes } from "@/application/dynamic-commerce-routes";
import {
  createWholeStorefrontGenerationPlan,
  materializeCompleteStorefrontSelection,
  type WholeStorefrontApprovedAssetRoleSelection,
  type WholeStorefrontGenerationPlanError,
} from "@/application/whole-storefront-generation-plan";
import { P10B14_PREMIUM_EDITORIAL_SELECTION } from "@/application/premium-editorial-vertical-slice";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";

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
});
