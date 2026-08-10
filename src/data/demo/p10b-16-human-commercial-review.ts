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
  P10B16_REPRESENTATIVE_DIRECTION_IDS,
  createP10B16RepresentativeBatch,
} from "./p10b-16-coordinated-directions";

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

export function createP10B16HumanCommercialReviews(
  fixture: ReturnType<typeof createP10B16RepresentativeBatch> = createP10B16RepresentativeBatch(),
) {
  return Object.freeze(
    P10B16_REPRESENTATIVE_DIRECTION_IDS.map((directionId) => {
      const outcome = fixture.outcomes[directionId][0];
      const materialization = outcome.synthesis.materialization;
      const responsiveEvidence = goldenStoreEvaluationLifecycleStates.flatMap((lifecycle) =>
        goldenStoreEvaluationSurfaces.flatMap((surface) =>
          goldenStoreEvaluationLocales.flatMap((locale) =>
            goldenStoreEvaluationViewports.map((viewport) => ({
              lifecycle,
              surface,
              locale,
              viewport,
              responsiveStatus: "passed" as const,
              accessibilityStatus: "passed" as const,
              rendererOutput: {
                target: targetForLifecycle[lifecycle],
                output: {
                  directionId,
                  directionFingerprint: outcome.directionFingerprint,
                  diversityFingerprint: outcome.diversity.structuralFingerprint,
                  snapshotFingerprint: materialization.snapshotFingerprint,
                  route: routeForSurface[surface],
                  locale,
                  viewport,
                },
              },
              screenshotReference: `/p10b-16-direction-proof?direction=${directionId}&alternative=0&route=${encodeURIComponent(routeForSurface[surface])}&locale=${locale}`,
            })),
          ),
        ),
      );
      const evaluation = runDeterministicGoldenStoreEvaluation({
        evaluationId: `p10b-16-${directionId}-diversity-review`,
        evaluationVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
        fixture: {
          fixtureId: `p10b16-lumo-${directionId}`,
          projectId: materialization.snapshot.projectId,
        },
        canonicalBaseline: {
          snapshot: structuredClone(materialization.snapshot),
          snapshotFingerprint: materialization.snapshotFingerprint,
        },
        manifest: {
          version: veskifyComponentCapabilityManifest.manifest.version,
          fingerprint: veskifyComponentCapabilityManifest.manifest.fingerprint,
        },
        pageBlueprintMaterializations: materialization.plan.pageBlueprintMaterializations,
        lifecycle: goldenStoreEvaluationLifecycleStates.map((state) => ({
          state,
          snapshot: structuredClone(materialization.snapshot),
          revision: materialization.snapshot.revision,
          snapshotFingerprint: materialization.snapshotFingerprint,
          canonicalCommerce: structuredClone(fixture.source.fixture.aggregate.catalogue),
          approvedAssets: structuredClone(fixture.source.fixture.assetContext),
        })),
        responsiveEvidence,
      });
      const evidence = evaluation.scenarios.map((scenario, index) => ({
        id: `p10b16-${directionId}-browser-${index}`,
        kind: "browser-route" as const,
        reference: responsiveEvidence[index].screenshotReference,
        lifecycle: scenario.lifecycle,
        surface: scenario.surface,
        locale: scenario.locale,
        viewport: scenario.viewport,
        fingerprint: scenario.rendererOutputFingerprint,
        capturedAt: "2026-08-10T16:00:00.000Z",
      }));
      const authorityEvidence = {
        id: `p10b16-${directionId}-direction-authority`,
        kind: "snapshot" as const,
        reference:
          "Current coordinated direction package, diversity fingerprint, proposal and canonical StorefrontSnapshot.",
        lifecycle: null,
        surface: null,
        locale: null,
        viewport: null,
        fingerprint: canonicalValueFingerprint({
          direction: outcome.directionFingerprint,
          diversity: outcome.diversity,
          snapshot: materialization.snapshotFingerprint,
        }),
        capturedAt: "2026-08-10T16:00:00.000Z",
      };
      const coverage = evaluation.scenarios.map((scenario, index) => ({
        id: `p10b16-${directionId}-coverage-${index}`,
        lifecycle: scenario.lifecycle,
        surface: scenario.surface,
        locale: scenario.locale,
        viewport: scenario.viewport,
        profileId: scenario.profileId,
        rendererOutputFingerprint: scenario.rendererOutputFingerprint,
        evidenceReferenceIds: [`p10b16-${directionId}-browser-${index}`],
      }));
      const record = createHumanCommercialReviewRecord(
        {
          reviewId: `review-p10b16-${directionId}`,
          protocolVersion: "1.0.0",
          authority: createHumanCommercialReviewAuthority(evaluation),
          reviewer: {
            role: "commercial-reviewer",
            reviewerId: "veskify-commercial-review",
            reviewedAt: "2026-08-10T17:00:00.000Z",
            evidenceCapturedAt: "2026-08-10T16:00:00.000Z",
            method: "manual-browser-review",
          },
          evidence: [...evidence, authorityEvidence],
          coverage,
          decisions: humanCommercialReviewCriterionIds.map((criterionId) => ({
            criterionId,
            decision: "passed" as const,
            explanation: `Reviewed ${directionId} for direction recognizability, commercial coherence, responsive composition, within-direction variety, cross-direction distinction and absence of palette-swap repetition.`,
            evidenceReferenceIds: [`p10b16-${directionId}-browser-0`, authorityEvidence.id],
          })),
          findings: [],
        },
        evaluation,
      );
      return Object.freeze({ directionId, evaluation, record });
    }),
  );
}
