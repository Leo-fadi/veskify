import {
  assetReviewHasMaterialChanges,
  approvedAssetProjection,
  unresolvedRequiredAssetCandidates,
  type AssetReviewState,
} from "@/domain/asset-review";
import {
  cloneUrlBriefWorkflow,
  currentUrlBrief,
  urlBriefWorkflowMaterialEvidence,
  urlBriefWorkflowSchema,
  type UrlBriefWorkflow,
} from "@/domain/onboarding";
import { updateStorefrontDesignBriefReview } from "@/application/source-discovery";

const assetBlockerPrefix = "Asset review: ";

const blockerRoleLabels = {
  logo: "logo",
  hero: "hero image",
  collection: "collection image",
  product: "product image",
  editorial: "editorial image",
  supporting: "supporting image",
} as const;

function requiredAssetBlocker(
  candidate: ReturnType<typeof unresolvedRequiredAssetCandidates>[number],
) {
  return `${assetBlockerPrefix}The required ${blockerRoleLabels[candidate.discoveredRole]} needs a merchant decision.`;
}

export function assetReviewBriefData(state: AssetReviewState) {
  const approved = approvedAssetProjection(state);
  return {
    approvedReusableAssetIds: approved.map((asset) => asset.assetId),
    approvedAssetAssignments: approved.map((asset) => ({
      assetId: asset.assetId,
      role: asset.approvedRole,
      revision: asset.revision,
      fingerprint: asset.fingerprint,
    })),
    assetReviewFingerprint: state.materialFingerprint,
    blockers: unresolvedRequiredAssetCandidates(state).map(requiredAssetBlocker),
  };
}

export function withoutAssetReviewBlockers(blockers: readonly string[]): string[] {
  return blockers.filter((blocker) => !blocker.startsWith(assetBlockerPrefix));
}

export function synchronizeAssetReviewWithBrief(
  workflowInput: UrlBriefWorkflow,
  state: AssetReviewState,
  now: string,
): UrlBriefWorkflow {
  const workflow = cloneUrlBriefWorkflow(workflowInput);
  const current = currentUrlBrief(workflow);
  const material = urlBriefWorkflowMaterialEvidence(workflow);
  const briefData = assetReviewBriefData(state);
  let briefRevisions = workflow.briefRevisions;
  let status = workflow.status;
  let lastSafeState = workflow.lastSafeState;

  if (current?.status === "needsReview" && material) {
    const refreshed = updateStorefrontDesignBriefReview(current, {
      now,
      materialEvidence: material,
      approvedReusableAssetIds: briefData.approvedReusableAssetIds,
      approvedAssetAssignments: briefData.approvedAssetAssignments,
      assetReviewFingerprint: briefData.assetReviewFingerprint,
      materialUnresolvedBlockers: [
        ...withoutAssetReviewBlockers(current.materialUnresolvedBlockers),
        ...briefData.blockers,
      ],
    });
    briefRevisions = workflow.briefRevisions.map((brief) =>
      brief.revision === refreshed.revision ? refreshed : brief,
    );
  } else if (
    current?.status === "approved" &&
    (current.assetReviewFingerprint === null
      ? assetReviewHasMaterialChanges(state)
      : current.assetReviewFingerprint !== briefData.assetReviewFingerprint)
  ) {
    status = "stale";
    lastSafeState = "stale";
  }

  return urlBriefWorkflowSchema.parse({
    ...workflow,
    status,
    lastSafeState,
    assetReview: state,
    briefRevisions,
    failure:
      status === "stale"
        ? {
            code: "stale-brief-approval",
            message:
              "Approved storefront assets changed. Review a new brief revision before generation.",
            retryable: true,
          }
        : workflow.failure,
    updatedAt: now,
  });
}
