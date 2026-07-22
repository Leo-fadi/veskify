import { z } from "zod";
import {
  brandReconstructionProposalSchema,
  reconciliationResultSchema,
  sourceDiscoveryResultSchema,
  sourceFailureCodeSchema,
  sourceReferenceSchema,
  storefrontDesignBriefContractSchema,
  type ReconciliationDecision,
  type ReconciliationResult,
  type StorefrontDesignBriefContract,
  type StorefrontSourceEvidenceMaterial,
} from "@/domain/source-discovery";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";

export const URL_BRIEF_WORKFLOW_SCHEMA_VERSION = 1 as const;

export const urlBriefWorkflowStatusSchema = z.enum([
  "idle",
  "source-submitted",
  "discovering",
  "discovery-failed",
  "evidence-ready",
  "reconciliation-needed",
  "brand-proposal-ready",
  "brief-needs-review",
  "approved",
  "stale",
  "superseded",
]);

export const urlBriefWorkflowSafeStateSchema = z.enum([
  "idle",
  "source-submitted",
  "discovery-failed",
  "evidence-ready",
  "reconciliation-needed",
  "brand-proposal-ready",
  "brief-needs-review",
  "approved",
  "stale",
  "superseded",
]);

export const merchantReconciliationResolutionSchema = z
  .object({
    decisionId: idSchema,
    outcome: z.enum(["accept-source-evidence", "reject-source-evidence", "use-vesko-truth"]),
    canonicalProductId: idSchema.nullable().default(null),
    canonicalCollectionId: idSchema.nullable().default(null),
    note: z.string().trim().min(1).max(500).nullable(),
    resolvedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((resolution, context) => {
    if (resolution.canonicalProductId !== null && resolution.canonicalCollectionId !== null) {
      context.addIssue({
        code: "custom",
        path: ["canonicalCollectionId"],
        message: "A merchant resolution cannot target both a product and a collection.",
      });
    }
  });

export const urlBriefWorkflowFailureSchema = z
  .object({
    code: z.union([
      sourceFailureCodeSchema,
      z.enum(["invalid-contract", "invalid-lifecycle", "persistence-failed", "interrupted"]),
    ]),
    message: z.string().trim().min(1).max(500),
    retryable: z.boolean(),
  })
  .strict();

export const urlBriefWorkflowSchema = z
  .object({
    schemaVersion: z.literal(URL_BRIEF_WORKFLOW_SCHEMA_VERSION),
    id: idSchema,
    status: urlBriefWorkflowStatusSchema,
    lastSafeState: urlBriefWorkflowSafeStateSchema,
    sourceReferences: z.array(sourceReferenceSchema),
    currentSourceReferenceId: idSchema.nullable(),
    discoveryResult: sourceDiscoveryResultSchema.nullable(),
    reconciliation: reconciliationResultSchema.nullable(),
    merchantResolutions: z.array(merchantReconciliationResolutionSchema),
    unresolvedInformationIds: z.array(idSchema),
    brandProposal: brandReconstructionProposalSchema.nullable(),
    briefRevisions: z.array(storefrontDesignBriefContractSchema),
    currentBriefRevision: z.number().int().positive().nullable(),
    approvedEvidenceFingerprint: z.string().trim().min(1).nullable(),
    failure: urlBriefWorkflowFailureSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((workflow, context) => {
    if (Date.parse(workflow.updatedAt) < Date.parse(workflow.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "Workflow update time precedes its creation time.",
      });
    }

    const sourceIds = workflow.sourceReferences.map((source) => source.id);
    if (new Set(sourceIds).size !== sourceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["sourceReferences"],
        message: "Source references must have unique identifiers.",
      });
    }
    if (
      workflow.currentSourceReferenceId !== null &&
      !sourceIds.includes(workflow.currentSourceReferenceId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["currentSourceReferenceId"],
        message: "The current source reference must exist in the workflow.",
      });
    }

    const decisionIds = new Set(
      workflow.reconciliation?.decisions.map((decision) => decision.id) ?? [],
    );
    const resolutionIds = workflow.merchantResolutions.map((resolution) => resolution.decisionId);
    if (new Set(resolutionIds).size !== resolutionIds.length) {
      context.addIssue({
        code: "custom",
        path: ["merchantResolutions"],
        message: "A reconciliation decision may only be resolved once.",
      });
    }
    workflow.merchantResolutions.forEach((resolution, index) => {
      if (!decisionIds.has(resolution.decisionId)) {
        context.addIssue({
          code: "custom",
          path: ["merchantResolutions", index, "decisionId"],
          message: "Merchant resolutions must reference the current reconciliation.",
        });
        return;
      }
      const decision = workflow.reconciliation?.decisions.find(
        (candidate) => candidate.id === resolution.decisionId,
      );
      if (decision && !resolutionMatchesDecision(decision, resolution)) {
        context.addIssue({
          code: "custom",
          path: ["merchantResolutions", index],
          message: "Merchant resolutions must match the reconciliation decision and target.",
        });
      }
    });
    if (
      new Set(workflow.unresolvedInformationIds).size !== workflow.unresolvedInformationIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["unresolvedInformationIds"],
        message: "Unresolved information identifiers must be unique.",
      });
    }
    workflow.unresolvedInformationIds.forEach((identifier, index) => {
      if (!decisionIds.has(identifier) || resolutionIds.includes(identifier)) {
        context.addIssue({
          code: "custom",
          path: ["unresolvedInformationIds", index],
          message: "Unresolved information must reference an unresolved reconciliation decision.",
        });
      }
    });

    const revisions = workflow.briefRevisions.map((brief) => brief.revision);
    if (new Set(revisions).size !== revisions.length) {
      context.addIssue({
        code: "custom",
        path: ["briefRevisions"],
        message: "Storefront Design Brief revisions must be unique.",
      });
    }
    const currentBrief = workflow.briefRevisions.find(
      (brief) => brief.revision === workflow.currentBriefRevision,
    );
    if (workflow.currentBriefRevision !== null && currentBrief === undefined) {
      context.addIssue({
        code: "custom",
        path: ["currentBriefRevision"],
        message: "The current Storefront Design Brief revision must be persisted.",
      });
    }
    if (workflow.status === "approved") {
      if (currentBrief?.status !== "approved") {
        context.addIssue({
          code: "custom",
          path: ["currentBriefRevision"],
          message: "An approved workflow requires an approved current brief.",
        });
      }
      if (
        workflow.approvedEvidenceFingerprint === null ||
        workflow.approvedEvidenceFingerprint !== currentBrief?.approvedEvidenceFingerprint
      ) {
        context.addIssue({
          code: "custom",
          path: ["approvedEvidenceFingerprint"],
          message: "The workflow must retain the current brief's approved evidence fingerprint.",
        });
      }
    }
    if (workflow.status === "stale" && currentBrief?.status !== "approved") {
      context.addIssue({
        code: "custom",
        path: ["currentBriefRevision"],
        message: "A stale workflow retains its previously approved brief until supersession.",
      });
    }
    if (workflow.status === "superseded") {
      const prior = workflow.briefRevisions.find(
        (brief) =>
          brief.status === "superseded" && brief.supersededByRevision === currentBrief?.revision,
      );
      if (currentBrief?.status !== "needsReview" || prior === undefined) {
        context.addIssue({
          code: "custom",
          path: ["briefRevisions"],
          message:
            "A superseded workflow requires a superseded approval and reviewable replacement.",
        });
      }
    }
  });

export type UrlBriefWorkflowStatus = z.infer<typeof urlBriefWorkflowStatusSchema>;
export type UrlBriefWorkflowSafeState = z.infer<typeof urlBriefWorkflowSafeStateSchema>;
export type MerchantReconciliationResolution = z.infer<
  typeof merchantReconciliationResolutionSchema
>;
export type UrlBriefWorkflow = z.infer<typeof urlBriefWorkflowSchema>;

export function createIdleUrlBriefWorkflow(input: { id: string; now: string }): UrlBriefWorkflow {
  return urlBriefWorkflowSchema.parse({
    schemaVersion: URL_BRIEF_WORKFLOW_SCHEMA_VERSION,
    id: input.id,
    status: "idle",
    lastSafeState: "idle",
    sourceReferences: [],
    currentSourceReferenceId: null,
    discoveryResult: null,
    reconciliation: null,
    merchantResolutions: [],
    unresolvedInformationIds: [],
    brandProposal: null,
    briefRevisions: [],
    currentBriefRevision: null,
    approvedEvidenceFingerprint: null,
    failure: null,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function cloneUrlBriefWorkflow(workflow: UrlBriefWorkflow): UrlBriefWorkflow {
  return urlBriefWorkflowSchema.parse(structuredClone(workflow));
}

export function currentUrlBrief(workflow: UrlBriefWorkflow): StorefrontDesignBriefContract | null {
  if (workflow.currentBriefRevision === null) return null;
  return (
    workflow.briefRevisions.find((brief) => brief.revision === workflow.currentBriefRevision) ??
    null
  );
}

export function unresolvedReconciliationDecisionIds(
  reconciliation: ReconciliationResult,
  resolutions: readonly MerchantReconciliationResolution[],
): string[] {
  const decisionById = new Map(
    reconciliation.decisions.map((decision) => [decision.id, decision] as const),
  );
  const resolved = new Set(
    resolutions
      .filter((resolution) => {
        const decision = decisionById.get(resolution.decisionId);
        return decision ? resolutionMatchesDecision(decision, resolution) : false;
      })
      .map((resolution) => resolution.decisionId),
  );
  return [
    ...new Set([...reconciliation.unresolvedConflictIds, ...reconciliation.missingInformationIds]),
  ].filter((identifier) => !resolved.has(identifier));
}

export function resolvedWorkflowReconciliation(
  reconciliation: ReconciliationResult,
  resolutions: readonly MerchantReconciliationResolution[],
): ReconciliationResult {
  const resolutionById = new Map(
    resolutions
      .filter((resolution) => {
        const decision = reconciliation.decisions.find(
          (candidate) => candidate.id === resolution.decisionId,
        );
        return decision ? resolutionMatchesDecision(decision, resolution) : false;
      })
      .map((resolution) => [resolution.decisionId, resolution]),
  );
  return reconciliationResultSchema.parse({
    ...reconciliation,
    decisions: reconciliation.decisions.map((decision) => {
      const resolution = resolutionById.get(decision.id);
      if (!resolution) return decision;
      const kind =
        resolution.outcome === "accept-source-evidence"
          ? "accepted-evidence"
          : resolution.outcome === "reject-source-evidence"
            ? "rejected-evidence"
            : "canonical-override";
      return {
        ...decision,
        kind,
        canonicalProductId: resolution.canonicalProductId ?? decision.canonicalProductId,
        canonicalCollectionId: resolution.canonicalCollectionId ?? decision.canonicalCollectionId,
        merchantDecisionRequired: false,
      };
    }),
    unresolvedConflictIds: reconciliation.unresolvedConflictIds.filter(
      (identifier) => !resolutionById.has(identifier),
    ),
    missingInformationIds: reconciliation.missingInformationIds.filter(
      (identifier) => !resolutionById.has(identifier),
    ),
  });
}

export function resolutionMatchesDecision(
  decision: ReconciliationDecision,
  resolution: MerchantReconciliationResolution,
): boolean {
  if (decision.field === null) {
    return (
      resolution.outcome !== "use-vesko-truth" &&
      resolution.canonicalProductId === null &&
      resolution.canonicalCollectionId === null
    );
  }
  if (resolution.outcome !== "use-vesko-truth") return false;

  const targetsCollection = decision.field === "collection-identity";
  const allowsEitherTarget = decision.field === "collection-membership";
  const targetId = targetsCollection
    ? resolution.canonicalCollectionId
    : allowsEitherTarget
      ? (resolution.canonicalCollectionId ?? resolution.canonicalProductId)
      : resolution.canonicalProductId;
  if (targetId === null) return false;
  if (targetsCollection && resolution.canonicalProductId !== null) {
    return false;
  }
  if (!targetsCollection && !allowsEitherTarget && resolution.canonicalCollectionId !== null) {
    return false;
  }
  return (
    decision.candidateCanonicalIds.length === 0 || decision.candidateCanonicalIds.includes(targetId)
  );
}

export function urlBriefWorkflowMaterialEvidence(
  workflow: UrlBriefWorkflow,
): StorefrontSourceEvidenceMaterial | null {
  if (workflow.discoveryResult === null || workflow.reconciliation === null) return null;
  if (workflow.currentSourceReferenceId !== workflow.discoveryResult.source.id) return null;
  if (workflow.reconciliation.sourceReferenceId !== workflow.discoveryResult.source.id) return null;
  return {
    sourceReferences: [workflow.discoveryResult.source],
    evidence: workflow.discoveryResult.evidence,
    assetCandidates: workflow.discoveryResult.assetCandidates,
    reconciliation: resolvedWorkflowReconciliation(
      workflow.reconciliation,
      workflow.merchantResolutions,
    ),
  };
}
