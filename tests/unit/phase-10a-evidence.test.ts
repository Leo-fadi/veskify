import { describe, expect, it } from "vitest";
import {
  assertApprovedAssetParity,
  assertCompleteViewportPageFamilyEvidence,
  assertProposalSnapshotParity,
  assertProtectedCommerceParity,
  assertRendererProjectionParity,
  captureApprovedAssetProjection,
  captureProtectedCommerceProjection,
  createBaselineStructuralDelta,
  createGenerationAuthorityEvidence,
  createProposalSnapshotIntegrityEvidence,
  createPublishWithoutProviderEvidence,
  createRendererParityEvidence,
  PHASE_10A_LOCALES,
  PHASE_10A_PAGE_FAMILIES,
  PHASE_10A_RENDER_TARGETS,
  PHASE_10A_VIEWPORTS,
  type CommercialQualityEvidence,
  type ViewportPageFamilyEvidence,
} from "../helpers/phase-10a-evidence";
import {
  createP905aAcceptanceCoordinator,
  generateP905aScenario,
  saveAndResolveP905aPreview,
} from "../helpers/p9-05a-generation-harness";
import { confirmPublish, preparePublish } from "@/application/publishing";

async function acceptedScenario() {
  const generated = await generateP905aScenario("modernTechnical");
  const accepted = createP905aAcceptanceCoordinator(generated).accept();
  if (accepted.state !== "accepted") throw new Error("Expected deterministic acceptance.");
  return { generated, accepted };
}

function completeViewportEvidence(): ViewportPageFamilyEvidence[] {
  return PHASE_10A_PAGE_FAMILIES.flatMap((pageFamily) =>
    PHASE_10A_VIEWPORTS.flatMap((viewport) =>
      PHASE_10A_LOCALES.flatMap((locale) =>
        PHASE_10A_RENDER_TARGETS.map((renderTarget) => ({
          pageFamily,
          viewport,
          locale,
          renderTarget,
          horizontalOverflow: false,
          basicAccessibilityPassed: true,
          screenshotReference: null,
        })),
      ),
    ),
  );
}

describe("Phase 10A deterministic evidence helpers", () => {
  it("captures planner authority, registered selections, variants, and bounded parameters", async () => {
    const { generated, accepted } = await acceptedScenario();
    const evidence = createGenerationAuthorityEvidence({
      plannerId: "server-whole-storefront-planning",
      providerId: "p9-05a-captured-deterministic-provider",
      registeredRecipeIds: {
        home: generated.plan.designSystemSelection.homepageRecipeId,
        collection: generated.plan.designSystemSelection.collectionRecipeId,
        product: generated.plan.designSystemSelection.productRecipeId,
      },
      pageBlueprintProfileIds: { home: null, collection: null, product: null },
      snapshot: accepted.activeDraft,
    });

    expect(evidence.componentSelections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ componentFamily: "hero", variant: expect.any(String) }),
        expect.objectContaining({ componentFamily: "dynamicCollectionCommerce" }),
        expect.objectContaining({ componentFamily: "dynamicProductDetail" }),
      ]),
    );
    expect(evidence.componentProjectionFingerprint).toMatch(/^v1_/);
  });

  it("detects protected-commerce mutations including collection membership and routes", async () => {
    const { generated, accepted } = await acceptedScenario();
    const baseline = captureProtectedCommerceProjection(
      generated.fixture.aggregate.catalogue,
      accepted.activeDraft,
    );
    const mutatedCatalogue = structuredClone(generated.fixture.aggregate.catalogue);
    mutatedCatalogue.products[0]!.price = { amount: 1, currency: "EUR" };
    mutatedCatalogue.collections[0]!.productIds.reverse();
    const mutatedSnapshot = structuredClone(accepted.activeDraft);
    mutatedSnapshot.pages[0]!.slug = "/changed";
    const candidate = captureProtectedCommerceProjection(mutatedCatalogue, mutatedSnapshot);

    expect(() => assertProtectedCommerceParity(baseline, candidate)).toThrow(/protected commerce/i);
  });

  it("detects approved-asset and provenance mutations", async () => {
    const { generated } = await acceptedScenario();
    const baseline = captureApprovedAssetProjection(generated.fixture.assetContext.assets);
    const mutated = structuredClone(generated.fixture.assetContext.assets);
    mutated[0]!.provenance.location = "other-safe-source-location";

    expect(() =>
      assertApprovedAssetParity(baseline, captureApprovedAssetProjection(mutated)),
    ).toThrow(/approved asset/i);
  });

  it("proves proposal and accepted StorefrontSnapshot projection parity", async () => {
    const { generated, accepted } = await acceptedScenario();
    const evidence = createProposalSnapshotIntegrityEvidence({
      proposal: generated.proposal,
      acceptedSnapshot: accepted.activeDraft,
    });

    expect(assertProposalSnapshotParity(evidence).exactProjectionParity).toBe(true);
    expect(evidence.proposalFingerprint).toMatch(/^v1_/);
  });

  it("proves editor, preview, and published projections remain exact", async () => {
    const { generated, accepted } = await acceptedScenario();
    const saved = await saveAndResolveP905aPreview({ generated, accepted: accepted.activeDraft });
    const preparation = await preparePublish(
      generated.fixture.aggregate.project.id,
      generated.repository,
      {
        now: () => new Date("2026-08-02T09:00:00.000Z"),
        createPreparationId: () => "publish_preparation_phase_10a_evidence",
      },
    );
    const published = await confirmPublish(preparation, generated.repository);
    const parity = createRendererParityEvidence({
      editor: accepted.activeDraft,
      preview: saved.preview,
      published: published.publishedSnapshot,
    });

    expect(assertRendererProjectionParity(parity).exactParity).toBe(true);
  });

  it("records baseline structural deltas deterministically without a visual-quality verdict", async () => {
    const { generated, accepted } = await acceptedScenario();
    const first = createBaselineStructuralDelta(generated.fixture.draft, accepted.activeDraft);
    const second = createBaselineStructuralDelta(generated.fixture.draft, accepted.activeDraft);

    expect(first).toEqual(second);
    expect(first.changedPageIds).toEqual(expect.arrayContaining(["page_lumo_home"]));
  });

  it("requires a complete EN/FI viewport and page-family evidence matrix", () => {
    const records = completeViewportEvidence();
    expect(assertCompleteViewportPageFamilyEvidence(records)).toHaveLength(72);
    expect(() => assertCompleteViewportPageFamilyEvidence(records.slice(1))).toThrow(/incomplete/i);
  });

  it("keeps localized editor metadata and optional future narrative evidence intact", () => {
    const record = completeViewportEvidence().find(
      (candidate) => candidate.locale === "fi" && candidate.renderTarget === "editor",
    );
    const commercial: CommercialQualityEvidence = {
      pageFamily: "home",
      viewport: 375,
      recipeId: "registered-home-recipe",
      pageBlueprintProfileId: null,
      componentFamilySequence: ["header", "hero", "footer"],
      variantSequence: ["default", "default", "default"],
      repeatedFamilyCount: 0,
      productDiscoveryVisible: true,
      purchaseActionVisible: null,
      mediaCoverage: "complete",
      responsiveOverflow: false,
      accessibilityResult: "not-reviewed",
      screenshotReference: null,
      evaluation: {
        hierarchy: "not-reviewed",
        coherence: "not-reviewed",
        repetition: "not-reviewed",
        spacingRhythm: "not-reviewed",
        surfaceTransitions: "not-reviewed",
        mediaUsage: "not-reviewed",
        mobileQuality: "not-reviewed",
        notes: [],
      },
    };

    expect(record).toMatchObject({ locale: "fi", renderTarget: "editor" });
    expect(commercial.narrativeSequence).toBeUndefined();
  });

  it("records publication without a provider call", async () => {
    const { generated, accepted } = await acceptedScenario();
    const before = generated.providerRequests.length;
    await saveAndResolveP905aPreview({ generated, accepted: accepted.activeDraft });
    const preparation = await preparePublish(
      generated.fixture.aggregate.project.id,
      generated.repository,
      {
        now: () => new Date("2026-08-02T10:00:00.000Z"),
        createPreparationId: () => "publish_preparation_phase_10a_no_provider",
      },
    );
    const published = await confirmPublish(preparation, generated.repository);
    const evidence = createPublishWithoutProviderEvidence({
      providerCallsBeforePublish: before,
      providerCallsAfterPublish: generated.providerRequests.length,
      publishedSnapshot: published.publishedSnapshot,
    });

    expect(evidence).toMatchObject({ providerCalledDuringPublish: false });
    expect(evidence.publishedSnapshotFingerprint).toBeDefined();
    expect(accepted.activeDraft.id).toBe(generated.fixture.draft.id);
  });
});
