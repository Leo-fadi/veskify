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
  PHASE_10A_LIFECYCLE_STATES,
  PHASE_10A_LOCALES,
  PHASE_10A_PAGE_FAMILIES,
  PHASE_10A_VIEWPORTS,
  type CommercialQualityEvidence,
  type Phase10aLifecycleState,
  type Phase10aRenderTarget,
  type ViewportPageFamilyEvidence,
} from "../helpers/phase-10a-evidence";
import {
  createP905aAcceptanceCoordinator,
  generateP905aScenario,
  p905aCurrentEvidenceReferences,
  saveAndResolveP905aPreview,
} from "../helpers/p9-05a-generation-harness";
import { confirmPublish, preparePublish } from "@/application/publishing";
import type { ApprovedGenerationAssetContext } from "@/application/ai-storefront-generation";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { StorefrontSnapshot } from "@/domain/storefront";

type CatalogueMutation = (catalogue: CatalogueDisplayModel) => void;
type AssetContextMutation = (context: ApprovedGenerationAssetContext) => void;
type SnapshotMutation = (snapshot: StorefrontSnapshot) => void;

async function acceptedScenario() {
  const generated = await generateP905aScenario("modernTechnical");
  const accepted = createP905aAcceptanceCoordinator(generated).accept();
  if (accepted.state !== "accepted") throw new Error("Expected deterministic acceptance.");
  return { generated, accepted };
}

function completeViewportEvidence(): ViewportPageFamilyEvidence[] {
  const renderTargetForLifecycle: Readonly<Record<Phase10aLifecycleState, Phase10aRenderTarget>> = {
    "proposal-preview": "preview",
    "accepted-editor": "editor",
    "saved-reloaded": "preview",
    preview: "preview",
    published: "published",
  };
  return PHASE_10A_LIFECYCLE_STATES.flatMap((lifecycleState) =>
    PHASE_10A_PAGE_FAMILIES.flatMap((pageFamily) =>
      PHASE_10A_VIEWPORTS.flatMap((viewport) =>
        PHASE_10A_LOCALES.map((locale) => ({
          pageFamily,
          viewport,
          locale,
          lifecycleState,
          renderTarget: renderTargetForLifecycle[lifecycleState],
          horizontalOverflow: false,
          basicAccessibilityPassed: true,
          screenshotReference: null,
        })),
      ),
    ),
  );
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
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
      pageBlueprintProfileIds: {
        home: required(
          generated.plan.pageBlueprintMaterializations.find((entry) => entry.pageType === "home")
            ?.profileId,
          "Expected an executable homepage profile.",
        ),
        collection: required(
          generated.plan.pageBlueprintMaterializations.find(
            (entry) => entry.pageType === "collection",
          )?.profileId,
          "Expected an executable collection profile.",
        ),
        product: required(
          generated.plan.pageBlueprintMaterializations.find((entry) => entry.pageType === "product")
            ?.profileId,
          "Expected an executable product profile.",
        ),
      },
      snapshot: accepted.activeDraft,
    });

    const hero = required(
      evidence.componentSelections.find(
        (selection) => selection.componentFamily === "homepageHero",
      ),
      "Expected a registered hero selection.",
    );
    expect(hero.variant.length).toBeGreaterThan(0);
    expect(evidence.componentSelections.map((selection) => selection.componentFamily)).toEqual(
      expect.arrayContaining(["dynamicCollectionCommerce", "dynamicProductDetail"]),
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
    required(mutatedCatalogue.products[0], "Expected a canonical product.").price = {
      amount: 1,
      currency: "EUR",
    };
    required(
      mutatedCatalogue.collections[0],
      "Expected a canonical collection.",
    ).productIds.reverse();
    const mutatedSnapshot = structuredClone(accepted.activeDraft);
    required(mutatedSnapshot.pages[0], "Expected a storefront page.").slug = "/changed";
    const candidate = captureProtectedCommerceProjection(mutatedCatalogue, mutatedSnapshot);

    expect(() => assertProtectedCommerceParity(baseline, candidate)).toThrow(/protected commerce/i);
  });

  const commerceMutations: readonly Readonly<{ name: string; mutate: CatalogueMutation }>[] = [
    {
      name: "a variant label changes",
      mutate: (catalogue) => {
        required(
          required(
            catalogue.products.find((product) => product.variants.length > 0),
            "Expected variants.",
          ).variants[0],
          "Expected a variant.",
        ).label.en = "Changed variant label";
      },
    },
    {
      name: "a variant option selection changes",
      mutate: (catalogue) => {
        required(
          required(
            catalogue.products.find((product) => product.variants.length > 0),
            "Expected variants.",
          ).variants[0],
          "Expected a variant.",
        ).attributes.metalColour = "changed";
      },
    },
    {
      name: "a SKU changes",
      mutate: (catalogue) => {
        required(catalogue.products[0], "Expected a canonical product.").sku = "CHANGED-SKU";
      },
    },
    {
      name: "availability or stock changes",
      mutate: (catalogue) => {
        required(catalogue.products[0], "Expected a canonical product.").stockStatus = "outOfStock";
      },
    },
    {
      name: "a media binding changes",
      mutate: (catalogue) => {
        required(
          required(catalogue.products[0], "Expected a product.").images[0],
          "Expected media.",
        ).id = "media_changed";
      },
    },
  ];

  it.each(commerceMutations)(
    "detects a canonical commerce mutation when $name",
    async ({ mutate }) => {
      const { generated, accepted } = await acceptedScenario();
      const baseline = captureProtectedCommerceProjection(
        generated.fixture.aggregate.catalogue,
        accepted.activeDraft,
      );
      const mutatedCatalogue = structuredClone(generated.fixture.aggregate.catalogue);
      mutate(mutatedCatalogue);
      const candidate = captureProtectedCommerceProjection(mutatedCatalogue, accepted.activeDraft);

      expect(() => assertProtectedCommerceParity(baseline, candidate)).toThrow(
        /protected commerce/i,
      );
    },
  );

  it("detects approved-asset provenance mutations", async () => {
    const { generated } = await acceptedScenario();
    const baseline = captureApprovedAssetProjection(
      generated.fixture.assetContext,
      generated.proposal.assetPlacementOperations,
    );
    const mutated = structuredClone(generated.fixture.assetContext);
    required(mutated.assets[0], "Expected an approved asset.").provenance.location =
      "other-safe-source-location";

    expect(() =>
      assertApprovedAssetParity(
        baseline,
        captureApprovedAssetProjection(mutated, generated.proposal.assetPlacementOperations),
      ),
    ).toThrow(/approved asset/i);
  });

  const assetContextMutations: readonly Readonly<{ name: string; mutate: AssetContextMutation }>[] =
    [
      {
        name: "brief ID changes",
        mutate: (context) => {
          context.briefId = "brief_other";
        },
      },
      {
        name: "brief revision changes",
        mutate: (context) => {
          context.briefRevision += 1;
        },
      },
      {
        name: "approved evidence fingerprint changes",
        mutate: (context) => {
          context.approvedEvidenceFingerprint = "approved-evidence-changed";
        },
      },
      {
        name: "asset-context fingerprint changes",
        mutate: (context) => {
          context.fingerprint = "approved-generation-assets-changed";
        },
      },
    ];

  it.each(assetContextMutations)(
    "binds approved assets to the brief context when $name",
    async ({ mutate }) => {
      const { generated } = await acceptedScenario();
      const baseline = captureApprovedAssetProjection(
        generated.fixture.assetContext,
        generated.proposal.assetPlacementOperations,
      );
      const mutated = structuredClone(generated.fixture.assetContext);
      mutate(mutated);

      expect(() =>
        assertApprovedAssetParity(
          baseline,
          captureApprovedAssetProjection(mutated, generated.proposal.assetPlacementOperations),
        ),
      ).toThrow(/approved asset/i);
    },
  );

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
        authority: {
          kind: "manual",
          currentEvidenceReferences: p905aCurrentEvidenceReferences(generated),
        },
      },
    );
    const published = await confirmPublish(preparation, generated.repository, {
      authority: {
        kind: "manual",
        currentEvidenceReferences: p905aCurrentEvidenceReferences(generated),
      },
    });
    const parity = createRendererParityEvidence({
      editor: accepted.activeDraft,
      preview: saved.preview,
      published: published.publishedSnapshot,
    });

    expect(assertRendererProjectionParity(parity).exactParity).toBe(true);
  });

  const rendererMutations: readonly Readonly<{ name: string; mutate: SnapshotMutation }>[] = [
    {
      name: "navigation differs",
      mutate: (snapshot) => {
        required(snapshot.navigation.primary[0], "Expected primary navigation.").label.en =
          "Changed navigation";
      },
    },
    {
      name: "shared header configuration differs",
      mutate: (snapshot) => {
        required(
          required(
            snapshot.pages.find((page) => page.type === "home"),
            "Expected homepage.",
          ).sections.find((section) => section.component === "header"),
          "Expected shared header section.",
        ).props = { layout: "changed" };
      },
    },
    {
      name: "BrandSystem tokens differ",
      mutate: (snapshot) => {
        snapshot.brandSystem.colors.primary = "#123456";
      },
    },
  ];

  it.each(rendererMutations)(
    "rejects renderer parity when $name while page identities remain stable",
    async ({ mutate }) => {
      const { accepted } = await acceptedScenario();
      const mutated = structuredClone(accepted.activeDraft);
      const pageIds = accepted.activeDraft.pages.map((page) => page.id);
      mutate(mutated);
      expect(mutated.pages.map((page) => page.id)).toEqual(pageIds);

      const evidence = createRendererParityEvidence({
        editor: accepted.activeDraft,
        preview: mutated,
        published: accepted.activeDraft,
      });
      expect(() => assertRendererProjectionParity(evidence)).toThrow(/diverged/i);
    },
  );

  it("records baseline structural deltas deterministically without a visual-quality verdict", async () => {
    const { generated, accepted } = await acceptedScenario();
    const first = createBaselineStructuralDelta(generated.fixture.draft, accepted.activeDraft);
    const second = createBaselineStructuralDelta(generated.fixture.draft, accepted.activeDraft);

    expect(first).toEqual(second);
    expect(first.changedPageIds).toEqual(expect.arrayContaining(["page_lumo_home"]));
  });

  it("requires the complete 120-record lifecycle, page-family, locale, and viewport matrix", () => {
    const records = completeViewportEvidence();
    expect(assertCompleteViewportPageFamilyEvidence(records)).toHaveLength(120);
  });

  it("rejects missing lifecycle records, duplicates, and unsupported lifecycle states", () => {
    const records = completeViewportEvidence();
    const withoutProposalPreview = records.filter(
      (record) => record.lifecycleState !== "proposal-preview",
    );
    const withoutSavedReloaded = records.filter(
      (record) => record.lifecycleState !== "saved-reloaded",
    );
    const first = required(records[0], "Expected lifecycle evidence.");

    expect(() => assertCompleteViewportPageFamilyEvidence(withoutProposalPreview)).toThrow(
      /proposal-preview/i,
    );
    expect(() => assertCompleteViewportPageFamilyEvidence(withoutSavedReloaded)).toThrow(
      /saved-reloaded/i,
    );
    expect(() => assertCompleteViewportPageFamilyEvidence([...records, first])).toThrow(
      /duplicates/i,
    );
    expect(() =>
      assertCompleteViewportPageFamilyEvidence([
        ...records,
        { ...first, lifecycleState: "unsupported-lifecycle" },
      ]),
    ).toThrow(/unsupported lifecycle-state/i);
  });

  it("keeps localized editor metadata and optional future narrative evidence intact", () => {
    const record = required(
      completeViewportEvidence().find(
        (candidate) => candidate.locale === "fi" && candidate.lifecycleState === "accepted-editor",
      ),
      "Expected Finnish accepted-editor evidence.",
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

    expect(record).toMatchObject({
      locale: "fi",
      lifecycleState: "accepted-editor",
      renderTarget: "editor",
    });
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
        authority: {
          kind: "manual",
          currentEvidenceReferences: p905aCurrentEvidenceReferences(generated),
        },
      },
    );
    const published = await confirmPublish(preparation, generated.repository, {
      authority: {
        kind: "manual",
        currentEvidenceReferences: p905aCurrentEvidenceReferences(generated),
      },
    });
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
