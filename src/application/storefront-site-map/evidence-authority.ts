import { createStorefrontDesignBriefEvidenceFingerprint } from "@/application/source-discovery";
import {
  currentUrlBrief,
  urlBriefWorkflowMaterialEvidence,
  urlBriefWorkflowSchema,
  type UrlBriefWorkflow,
} from "@/domain/onboarding";
import {
  getPageFamilyDefinition,
  pageFactEvidenceReferenceSchema,
  pageFactEvidenceRequestSchema,
  type PageFactEvidenceReference,
  type PageFactEvidenceRequest,
  type PageFamilyId,
} from "@/domain/storefront";

export const pageFactEvidenceAuthorityErrorCodes = [
  "unknown-evidence-authority",
  "stale-evidence-revision",
  "evidence-not-approved",
  "evidence-source-mismatch",
  "evidence-family-incompatible",
] as const;
export type PageFactEvidenceAuthorityErrorCode =
  (typeof pageFactEvidenceAuthorityErrorCodes)[number];

export class PageFactEvidenceAuthorityError extends Error {
  constructor(
    readonly code: PageFactEvidenceAuthorityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PageFactEvidenceAuthorityError";
  }
}

export interface PageFactEvidenceAuthority {
  resolve(
    input: Readonly<{
      reference: PageFactEvidenceRequest;
      familyId: PageFamilyId;
    }>,
  ): PageFactEvidenceReference;
}

function hasCurrentApprovedEvidence(workflow: UrlBriefWorkflow): boolean {
  const brief = currentUrlBrief(workflow);
  const materialEvidence = urlBriefWorkflowMaterialEvidence(workflow);
  if (
    workflow.status !== "approved" ||
    brief?.status !== "approved" ||
    brief.approval.status !== "approved" ||
    brief.approvedEvidenceFingerprint === null ||
    materialEvidence === null
  ) {
    return false;
  }
  try {
    const currentFingerprint = createStorefrontDesignBriefEvidenceFingerprint({
      sourceReferenceIds: brief.sourceReferenceIds,
      sourceEvidenceIds: brief.sourceEvidenceIds,
      canonicalCommerceProjectionRef: brief.canonicalCommerceProjectionRef,
      materialEvidence,
      assetReviewFingerprint: brief.assetReviewFingerprint,
    });
    return (
      currentFingerprint === brief.evidenceFingerprint &&
      currentFingerprint === brief.approvedEvidenceFingerprint &&
      currentFingerprint === workflow.approvedEvidenceFingerprint
    );
  } catch {
    return false;
  }
}

/**
 * Read-only page-fact authority projected from the canonical persisted URL/brief workflow.
 * Caller references never establish approval; only the current approved brief revision and
 * its exact material-evidence fingerprint can issue a canonical snapshot reference.
 */
export function createStorefrontDesignBriefPageFactEvidenceAuthority(
  input: unknown,
): PageFactEvidenceAuthority {
  const workflow = urlBriefWorkflowSchema.parse(structuredClone(input));
  const brief = currentUrlBrief(workflow);
  const materialEvidence = urlBriefWorkflowMaterialEvidence(workflow);
  const evidenceById = new Map(
    (materialEvidence?.evidence ?? []).map((evidence) => [evidence.id, evidence] as const),
  );
  const approvalIsCurrent = hasCurrentApprovedEvidence(workflow);

  return Object.freeze({
    resolve(
      inputValue: Readonly<{
        reference: PageFactEvidenceRequest;
        familyId: PageFamilyId;
      }>,
    ) {
      const reference = pageFactEvidenceRequestSchema.parse(inputValue.reference);
      const evidence = evidenceById.get(reference.authorityId);
      if (!evidence) {
        throw new PageFactEvidenceAuthorityError(
          "unknown-evidence-authority",
          `Evidence authority ${reference.authorityId} does not exist in canonical material evidence.`,
        );
      }
      if (!brief || reference.revision !== String(brief.revision)) {
        throw new PageFactEvidenceAuthorityError(
          "stale-evidence-revision",
          `Evidence authority ${reference.authorityId} does not match the current brief revision.`,
        );
      }
      if (reference.source !== "approved-source-evidence") {
        throw new PageFactEvidenceAuthorityError(
          "evidence-source-mismatch",
          `Evidence authority ${reference.authorityId} does not belong to ${reference.source}.`,
        );
      }
      if (!approvalIsCurrent) {
        throw new PageFactEvidenceAuthorityError(
          "evidence-not-approved",
          `Evidence authority ${reference.authorityId} is not covered by a current approved brief.`,
        );
      }
      if (
        !getPageFamilyDefinition(inputValue.familyId).permittedEvidenceKinds.includes(evidence.kind)
      ) {
        throw new PageFactEvidenceAuthorityError(
          "evidence-family-incompatible",
          `Evidence authority ${reference.authorityId} is not permitted for ${inputValue.familyId}.`,
        );
      }
      return pageFactEvidenceReferenceSchema.parse({
        source: "approved-source-evidence",
        authorityId: evidence.id,
        revision: String(brief.revision),
        status: "approved",
        approvalAuthorityId: brief.id,
        approvalFingerprint: brief.approvedEvidenceFingerprint,
      });
    },
  });
}
