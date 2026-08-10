import {
  createStorefrontDesignBriefPageFactEvidenceAuthority,
  PageFactEvidenceAuthorityError,
} from "@/application/storefront-site-map";
import {
  currentUrlBrief,
  urlBriefWorkflowMaterialEvidence,
  urlBriefWorkflowSchema,
} from "@/domain/onboarding";
import {
  contentSupportFactPayloadSchema,
  contentSupportPageFamilyIdSchema,
  createContentSupportFactDocument,
  pageFactEvidenceRequestSchema,
  type ContentSupportFactDocument,
  type ContentSupportPageFamilyId,
  type PageFactEvidenceRequest,
} from "@/domain/storefront";

export const contentSupportFactAuthorityErrorCodes = [
  "unsupported-content-family",
  "missing-approved-fact",
  "invalid-approved-fact-payload",
  "family-fact-mismatch",
  "unknown-evidence-authority",
  "stale-evidence-revision",
  "evidence-not-approved",
  "evidence-source-mismatch",
  "evidence-family-incompatible",
] as const;
export type ContentSupportFactAuthorityErrorCode =
  (typeof contentSupportFactAuthorityErrorCodes)[number];

export class ContentSupportFactAuthorityError extends Error {
  constructor(
    readonly code: ContentSupportFactAuthorityErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ContentSupportFactAuthorityError";
  }
}

/**
 * Read-only P10B-12 content authority. It consumes source evidence from the
 * current approved URL/brief workflow and never accepts factual payloads from
 * the page, proposal, profile or caller.
 */
export interface ContentSupportFactAuthority {
  resolve(
    input: Readonly<{
      familyId: ContentSupportPageFamilyId;
      reference: PageFactEvidenceRequest;
    }>,
  ): ContentSupportFactDocument;
}

export function createStorefrontDesignBriefContentSupportFactAuthority(
  input: unknown,
): ContentSupportFactAuthority {
  const workflow = urlBriefWorkflowSchema.parse(structuredClone(input));
  const brief = currentUrlBrief(workflow);
  const materialEvidence = urlBriefWorkflowMaterialEvidence(workflow);
  const evidenceById = new Map(
    (materialEvidence?.evidence ?? []).map((evidence) => [evidence.id, evidence] as const),
  );
  const pageFactAuthority = createStorefrontDesignBriefPageFactEvidenceAuthority(workflow);

  return Object.freeze({
    resolve(
      inputValue: Readonly<{
        familyId: ContentSupportPageFamilyId;
        reference: PageFactEvidenceRequest;
      }>,
    ) {
      const familyId = contentSupportPageFamilyIdSchema.safeParse(inputValue.familyId);
      if (!familyId.success) {
        throw new ContentSupportFactAuthorityError(
          "unsupported-content-family",
          "The requested page family is outside the P10B-12 content/support authority.",
        );
      }
      const request = pageFactEvidenceRequestSchema.parse(inputValue.reference);
      let evidence;
      try {
        evidence = pageFactAuthority.resolve({ reference: request, familyId: familyId.data });
      } catch (cause) {
        if (cause instanceof PageFactEvidenceAuthorityError) {
          throw new ContentSupportFactAuthorityError(cause.code, cause.message, { cause });
        }
        throw cause;
      }
      const sourceEvidence = evidenceById.get(evidence.authorityId);
      if (!sourceEvidence || !brief || evidence.revision !== String(brief.revision)) {
        throw new ContentSupportFactAuthorityError(
          "missing-approved-fact",
          `The current approved brief does not contain ${evidence.authorityId}.`,
        );
      }
      const payload = contentSupportFactPayloadSchema.safeParse(sourceEvidence.observedValue);
      if (!payload.success) {
        throw new ContentSupportFactAuthorityError(
          "invalid-approved-fact-payload",
          `Approved evidence ${evidence.authorityId} does not contain a bounded P10B-12 fact payload.`,
          { cause: payload.error },
        );
      }
      if (payload.data.familyId !== familyId.data) {
        throw new ContentSupportFactAuthorityError(
          "family-fact-mismatch",
          `Approved evidence ${evidence.authorityId} belongs to ${payload.data.familyId}, not ${familyId.data}.`,
        );
      }
      return createContentSupportFactDocument({ evidence, payload: payload.data });
    },
  });
}
