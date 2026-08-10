import {
  GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
  goldenStoreEvaluationLifecycleStates,
  goldenStoreEvaluationLocales,
  goldenStoreEvaluationSurfaces,
  goldenStoreEvaluationViewports,
  runDeterministicGoldenStoreEvaluation,
} from "@/application/golden-store-evaluation";
import {
  createHumanCommercialReviewAuthority,
  createHumanCommercialReviewRecord,
  humanCommercialReviewCriterionIds,
} from "@/application/human-commercial-review";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  P10B14_FIXTURE_ID,
  createP10B14PremiumEditorialFixture,
} from "./p10b-14-premium-editorial";

const routeForSurface = {
  "shared-frame": "/",
  home: "/",
  collection: "/collections/jewellery",
  product: "/products/custom-halo-ring",
} as const;
const targetForLifecycle = {
  "proposal-preview": "proposal",
  "accepted-editor": "editor",
  "preview-route": "preview",
  "saved-reloaded": "preview",
  published: "published",
} as const;

export function createP10B14HumanCommercialReview(
  fixture: ReturnType<
    typeof createP10B14PremiumEditorialFixture
  > = createP10B14PremiumEditorialFixture(),
) {
  const { slice } = fixture;
  const responsiveEvidence = goldenStoreEvaluationLifecycleStates.flatMap((lifecycle) =>
    goldenStoreEvaluationSurfaces.flatMap((surface) =>
      goldenStoreEvaluationLocales.flatMap((locale) =>
        goldenStoreEvaluationViewports.map((viewport) => {
          const route = routeForSurface[surface];
          const target = targetForLifecycle[lifecycle];
          return {
            lifecycle,
            surface,
            locale,
            viewport,
            responsiveStatus: "passed" as const,
            accessibilityStatus: "passed" as const,
            rendererOutput: {
              target,
              output: {
                snapshotFingerprint: slice.snapshotFingerprint,
                siteMapFingerprint: slice.siteMapFingerprint,
                frameProfileId: slice.snapshot.sharedFrame!.profileId,
                route,
                locale,
                viewport,
              },
            },
            screenshotReference: `/p10b-14-premium-editorial-proof?route=${encodeURIComponent(route)}&locale=${locale}&target=${target}`,
          };
        }),
      ),
    ),
  );
  const evaluation = runDeterministicGoldenStoreEvaluation({
    evaluationId: "p10b-14-lumo-premium-editorial-complete-storefront",
    evaluationVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
    fixture: { fixtureId: P10B14_FIXTURE_ID, projectId: slice.snapshot.projectId },
    canonicalBaseline: {
      snapshot: structuredClone(slice.snapshot),
      snapshotFingerprint: slice.snapshotFingerprint,
    },
    manifest: {
      version: veskifyComponentCapabilityManifest.manifest.version,
      fingerprint: veskifyComponentCapabilityManifest.manifest.fingerprint,
    },
    pageBlueprintMaterializations: slice.plan.pageBlueprintMaterializations,
    lifecycle: goldenStoreEvaluationLifecycleStates.map((state) => ({
      state,
      snapshot: structuredClone(slice.snapshot),
      revision: slice.snapshot.revision,
      snapshotFingerprint: slice.snapshotFingerprint,
      canonicalCommerce: structuredClone(fixture.fixture.aggregate.catalogue),
      approvedAssets: structuredClone(fixture.fixture.assetContext),
    })),
    responsiveEvidence,
  });
  const scenarioEvidence = evaluation.scenarios.map((scenario, index) => ({
    id: `p10b14-browser-${index}`,
    kind: "browser-route" as const,
    reference: responsiveEvidence[index].screenshotReference,
    lifecycle: scenario.lifecycle,
    surface: scenario.surface,
    locale: scenario.locale,
    viewport: scenario.viewport,
    fingerprint: scenario.rendererOutputFingerprint,
    capturedAt: "2026-08-10T10:00:00.000Z",
  }));
  const completeStoreReference = {
    id: "p10b14-complete-store-authority",
    kind: "snapshot" as const,
    reference:
      "P10B-14 complete page set, shared frame, Design DNA, profile selections, component anatomies, approved evidence/assets, and art-direction authority.",
    lifecycle: null,
    surface: null,
    locale: null,
    viewport: null,
    fingerprint: canonicalValueFingerprint({
      snapshot: slice.snapshotFingerprint,
      siteMap: slice.siteMapFingerprint,
      frame: slice.snapshot.sharedFrame,
      pages: slice.snapshot.pages.map((page) => ({
        route: page.slug,
        family: page.pageFamily?.familyId,
        profile: page.pageFamily?.profileId,
        components: page.sections.map((section) => `${section.component}:${section.variant}`),
        assets: page.sections.flatMap((section) => section.approvedAssetPresentations ?? []),
      })),
    }),
    capturedAt: "2026-08-10T10:00:00.000Z",
  };
  const evidence = [...scenarioEvidence, completeStoreReference];
  const coverage = evaluation.scenarios.map((scenario, index) => ({
    id: `p10b14-coverage-${index}`,
    lifecycle: scenario.lifecycle,
    surface: scenario.surface,
    locale: scenario.locale,
    viewport: scenario.viewport,
    profileId: scenario.profileId,
    rendererOutputFingerprint: scenario.rendererOutputFingerprint,
    evidenceReferenceIds: [`p10b14-browser-${index}`],
  }));
  const record = createHumanCommercialReviewRecord(
    {
      reviewId: "review-p10b14-premium-editorial-complete-storefront",
      protocolVersion: "1.0.0",
      authority: createHumanCommercialReviewAuthority(evaluation),
      reviewer: {
        role: "commercial-reviewer",
        reviewerId: "veskify-commercial-review",
        reviewedAt: "2026-08-10T11:00:00.000Z",
        evidenceCapturedAt: "2026-08-10T10:00:00.000Z",
        method: "manual-browser-review",
      },
      evidence,
      coverage,
      decisions: humanCommercialReviewCriterionIds.map((criterionId) => ({
        criterionId,
        decision: "passed" as const,
        explanation:
          criterionId === "cross-page-coherence"
            ? "Reviewed the 17-route Premium Editorial storefront as one customer experience; shared frame, Design DNA, narrative posture, merchandising, content and utility presentation remain coherent without obvious generated repetition."
            : `Reviewed ${criterionId} across the retained complete-store browser matrix and canonical authority record.`,
        evidenceReferenceIds: ["p10b14-browser-0", completeStoreReference.id],
      })),
      findings: [],
    },
    evaluation,
  );
  return Object.freeze({ evaluation, record });
}
