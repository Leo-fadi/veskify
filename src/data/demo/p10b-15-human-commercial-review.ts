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
  createP10B15BoundedSynthesisFixture,
  P10B15_REPRESENTATIVE_INTENTS,
} from "./p10b-15-bounded-synthesis";

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

export function createP10B15HumanCommercialReviews(
  fixture: ReturnType<
    typeof createP10B15BoundedSynthesisFixture
  > = createP10B15BoundedSynthesisFixture(),
) {
  return Object.freeze(
    P10B15_REPRESENTATIVE_INTENTS.map((intent) => {
      const outcome = fixture.outcomes[intent];
      const { decision, materialization } = outcome;
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
                    synthesisFingerprint: decision.synthesisFingerprint,
                    snapshotFingerprint: materialization.snapshotFingerprint,
                    siteMapFingerprint: materialization.siteMapFingerprint,
                    frameProfileId: materialization.snapshot.sharedFrame!.profileId,
                    route,
                    locale,
                    viewport,
                  },
                },
                screenshotReference: `/p10b-15-synthesis-proof?intent=${intent}&route=${encodeURIComponent(route)}&locale=${locale}&target=${target}`,
              };
            }),
          ),
        ),
      );
      const evaluation = runDeterministicGoldenStoreEvaluation({
        evaluationId: `p10b-15-${intent}-complete-storefront`,
        evaluationVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
        fixture: {
          fixtureId: `p10b15-lumo-${intent}`,
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
      const scenarioEvidence = evaluation.scenarios.map((scenario, index) => ({
        id: `p10b15-${intent}-browser-${index}`,
        kind: "browser-route" as const,
        reference: responsiveEvidence[index].screenshotReference,
        lifecycle: scenario.lifecycle,
        surface: scenario.surface,
        locale: scenario.locale,
        viewport: scenario.viewport,
        fingerprint: scenario.rendererOutputFingerprint,
        capturedAt: "2026-08-10T13:00:00.000Z",
      }));
      const synthesisReference = {
        id: `p10b15-${intent}-synthesis-authority`,
        kind: "snapshot" as const,
        reference:
          "P10B-15 bounded synthesis decision, complete canonical snapshot, shared frame, Design DNA, profiles, narrative roles, commerce and evidence authority.",
        lifecycle: null,
        surface: null,
        locale: null,
        viewport: null,
        fingerprint: canonicalValueFingerprint({
          decision: decision.synthesisFingerprint,
          snapshot: materialization.snapshotFingerprint,
          profiles: decision.pageProfileSelections,
          narrative: decision.narrative,
        }),
        capturedAt: "2026-08-10T13:00:00.000Z",
      };
      const evidence = [...scenarioEvidence, synthesisReference];
      const coverage = evaluation.scenarios.map((scenario, index) => ({
        id: `p10b15-${intent}-coverage-${index}`,
        lifecycle: scenario.lifecycle,
        surface: scenario.surface,
        locale: scenario.locale,
        viewport: scenario.viewport,
        profileId: scenario.profileId,
        rendererOutputFingerprint: scenario.rendererOutputFingerprint,
        evidenceReferenceIds: [`p10b15-${intent}-browser-${index}`],
      }));
      const record = createHumanCommercialReviewRecord(
        {
          reviewId: `review-p10b15-${intent}`,
          protocolVersion: "1.0.0",
          authority: createHumanCommercialReviewAuthority(evaluation),
          reviewer: {
            role: "commercial-reviewer",
            reviewerId: "veskify-commercial-review",
            reviewedAt: "2026-08-10T14:00:00.000Z",
            evidenceCapturedAt: "2026-08-10T13:00:00.000Z",
            method: "manual-browser-review",
          },
          evidence,
          coverage,
          decisions: humanCommercialReviewCriterionIds.map((criterionId) => ({
            criterionId,
            decision: "passed" as const,
            explanation:
              criterionId === "cross-page-coherence"
                ? `Reviewed the ${intent} 17-route synthesis as one customer experience; its shared frame, Design DNA, narrative posture, merchandising and utility presentation remain coherent.`
                : `Reviewed ${criterionId} across the retained ${intent} complete-store browser matrix and canonical synthesis record.`,
            evidenceReferenceIds: [`p10b15-${intent}-browser-0`, synthesisReference.id],
          })),
          findings: [],
        },
        evaluation,
      );
      return Object.freeze({ intent, evaluation, record });
    }),
  );
}
