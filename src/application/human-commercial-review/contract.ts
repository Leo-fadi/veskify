import {
  goldenStoreEvaluationLifecycleStateSchema,
  goldenStoreEvaluationSurfaceSchema,
  goldenStoreEvaluationViewportSchema,
} from "@/application/golden-store-evaluation";
import { idSchema, isoDateTimeSchema, localeSchema } from "@/domain/shared";
import { z } from "zod";

/**
 * A retained, human-authored review protocol layered on deterministic P10A-07A
 * evidence. It is not a storefront, acceptance action, or publishing authority.
 */
export const HUMAN_COMMERCIAL_REVIEW_PROTOCOL_VERSION = "1.0.0" as const;

const fingerprintSchema = z.string().trim().min(1).max(240);
const referenceIdSchema = z.string().trim().min(1).max(160);

export const humanCommercialReviewCriterionIds = [
  "visual-hierarchy",
  "commercial-clarity",
  "product-and-collection-discoverability",
  "merchandising-coherence",
  "brand-consistency",
  "responsive-composition",
  "content-and-media-appropriateness",
  "navigation-clarity",
  "conversion-path-clarity",
  "accessibility-observations",
  "cross-page-coherence",
] as const;

export const humanCommercialReviewCriterionIdSchema = z.enum(humanCommercialReviewCriterionIds);
export const humanCommercialReviewDecisionSchema = z.enum([
  "passed",
  "failed",
  "blocked",
  "not-applicable",
]);

export const humanCommercialReviewCriterionDefinitions = [
  {
    id: "visual-hierarchy",
    required: true,
    scope: "coordinated-storefront",
    expectation: "Primary content and commerce actions retain a clear visual priority.",
  },
  {
    id: "commercial-clarity",
    required: true,
    scope: "home-collection-product",
    expectation: "Commercial purpose, product context, and next actions remain understandable.",
  },
  {
    id: "product-and-collection-discoverability",
    required: true,
    scope: "home-collection-product",
    expectation: "Products, collections, filters, and product routes remain discoverable.",
  },
  {
    id: "merchandising-coherence",
    required: true,
    scope: "home-collection-product",
    expectation: "Merchandising order and component choices read as one coherent storefront.",
  },
  {
    id: "brand-consistency",
    required: true,
    scope: "coordinated-storefront",
    expectation:
      "Brand-system choices and registered profile composition remain visually coherent.",
  },
  {
    id: "responsive-composition",
    required: true,
    scope: "all-required-viewports",
    expectation: "Composition remains usable and intentional at every required viewport.",
  },
  {
    id: "content-and-media-appropriateness",
    required: true,
    scope: "home-collection-product",
    expectation: "Approved assets and content are appropriate to their rendered context.",
  },
  {
    id: "navigation-clarity",
    required: true,
    scope: "shared-frame-and-routes",
    expectation: "Shared navigation and route affordances remain clear across reviewed surfaces.",
  },
  {
    id: "conversion-path-clarity",
    required: true,
    scope: "product-and-commerce-surfaces",
    expectation: "Discovery and purchase paths retain clear, reachable next actions.",
  },
  {
    id: "accessibility-observations",
    required: true,
    scope: "all-required-viewports",
    expectation: "Human observations retain accessibility concerns alongside deterministic checks.",
  },
  {
    id: "cross-page-coherence",
    required: true,
    scope: "coordinated-storefront",
    expectation: "Shared frame, homepage, collection, and PDP work as one storefront.",
  },
] as const;

export const humanCommercialReviewEvidenceReferenceSchema = z
  .object({
    id: referenceIdSchema,
    kind: z.enum([
      "screenshot",
      "browser-route",
      "dom-observation",
      "renderer-output",
      "console-observation",
      "runtime-error",
      "snapshot",
      "proposal",
      "fixture",
      "lifecycle",
    ]),
    reference: z.string().trim().min(1).max(500),
    lifecycle: goldenStoreEvaluationLifecycleStateSchema.nullable(),
    surface: goldenStoreEvaluationSurfaceSchema.nullable(),
    locale: localeSchema.nullable(),
    viewport: goldenStoreEvaluationViewportSchema.nullable(),
    fingerprint: fingerprintSchema.nullable(),
    capturedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export const humanCommercialReviewCoverageSchema = z
  .object({
    id: referenceIdSchema,
    lifecycle: goldenStoreEvaluationLifecycleStateSchema,
    surface: goldenStoreEvaluationSurfaceSchema,
    locale: localeSchema,
    viewport: goldenStoreEvaluationViewportSchema,
    profileId: z.string().trim().min(1).max(160),
    rendererOutputFingerprint: fingerprintSchema,
    evidenceReferenceIds: z.array(referenceIdSchema).min(1),
  })
  .strict();

export const humanCommercialReviewDecisionRecordSchema = z
  .object({
    criterionId: humanCommercialReviewCriterionIdSchema,
    decision: humanCommercialReviewDecisionSchema,
    explanation: z.string().trim().min(1).max(2_000),
    evidenceReferenceIds: z.array(referenceIdSchema).min(1),
  })
  .strict();

export const humanCommercialReviewFindingSchema = z
  .object({
    id: referenceIdSchema,
    criterionId: humanCommercialReviewCriterionIdSchema,
    affectedCoverageIds: z.array(referenceIdSchema).min(1),
    severity: z.enum(["info", "warning", "blocker"]),
    description: z.string().trim().min(1).max(2_000),
    evidenceReferenceIds: z.array(referenceIdSchema).min(1),
    suggestedCorrection: z.string().trim().min(1).max(2_000).nullable(),
    disposition: z.enum(["needs-correction", "accepted-risk", "not-reproducible", "deferred"]),
    status: z.enum(["open", "acknowledged", "resolved", "deferred"]),
  })
  .strict();

export const humanCommercialReviewAuthoritySchema = z
  .object({
    evaluationId: referenceIdSchema,
    evaluationFingerprint: fingerprintSchema,
    fixture: z.object({ fixtureId: idSchema, projectId: idSchema }).strict(),
    canonicalSnapshot: z
      .object({
        snapshotId: idSchema,
        revision: z.number().int().nonnegative(),
        snapshotFingerprint: fingerprintSchema,
      })
      .strict(),
    proposalPreviewSnapshotFingerprint: fingerprintSchema,
    manifest: z.object({ version: fingerprintSchema, fingerprint: fingerprintSchema }).strict(),
    pageBlueprintProfiles: z
      .array(
        z
          .object({
            profileId: z.string().trim().min(1).max(160),
            profileVersion: z.string().trim().min(1).max(80),
            materializationFingerprint: fingerprintSchema,
          })
          .strict(),
      )
      .length(3),
    lifecycle: z
      .array(
        z
          .object({
            state: goldenStoreEvaluationLifecycleStateSchema,
            revision: z.number().int().nonnegative(),
            snapshotFingerprint: fingerprintSchema,
            navigationFingerprint: fingerprintSchema,
            protectedCommerceFingerprint: fingerprintSchema,
            approvedAssetFingerprint: fingerprintSchema,
          })
          .strict(),
      )
      .length(5),
    rendererScenarioFingerprint: fingerprintSchema,
    brandSystemFingerprint: fingerprintSchema,
    fingerprint: fingerprintSchema,
  })
  .strict();

export const humanCommercialReviewInputSchema = z
  .object({
    reviewId: referenceIdSchema,
    protocolVersion: z.literal(HUMAN_COMMERCIAL_REVIEW_PROTOCOL_VERSION),
    authority: humanCommercialReviewAuthoritySchema,
    reviewer: z
      .object({
        role: z.enum(["merchant-owner", "commercial-reviewer", "accessibility-reviewer"]),
        reviewerId: referenceIdSchema,
        reviewedAt: isoDateTimeSchema,
        evidenceCapturedAt: isoDateTimeSchema.nullable(),
        method: z.enum(["manual-browser-review", "retained-evidence-review"]),
      })
      .strict(),
    evidence: z.array(humanCommercialReviewEvidenceReferenceSchema).min(1),
    coverage: z.array(humanCommercialReviewCoverageSchema).min(1),
    decisions: z.array(humanCommercialReviewDecisionRecordSchema).min(1),
    findings: z.array(humanCommercialReviewFindingSchema),
  })
  .strict();

export const humanCommercialReviewOverallDecisionSchema = z.enum([
  "passed",
  "failed",
  "blocked",
  "incomplete",
]);

export const humanCommercialReviewRecordSchema = humanCommercialReviewInputSchema
  .extend({
    /** A protocol disposition only; it cannot accept, publish, or close P10A. */
    overallDecision: humanCommercialReviewOverallDecisionSchema,
    fingerprint: fingerprintSchema,
  })
  .strict();

export type HumanCommercialReviewAuthority = z.infer<typeof humanCommercialReviewAuthoritySchema>;
export type HumanCommercialReviewInput = z.infer<typeof humanCommercialReviewInputSchema>;
export type HumanCommercialReviewEvidenceReference = z.infer<
  typeof humanCommercialReviewEvidenceReferenceSchema
>;

export type HumanCommercialReviewRecord = Readonly<
  z.infer<typeof humanCommercialReviewRecordSchema>
>;

export class HumanCommercialReviewProtocolError extends Error {
  constructor(
    readonly code:
      | "invalid-input"
      | "stale-authority"
      | "incomplete-coverage"
      | "invalid-decision"
      | "invalid-finding",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "HumanCommercialReviewProtocolError";
  }
}
