import { z } from "zod";
import { canonicalValueString } from "@/domain/storefront";

export const STOREFRONT_GENERATION_REVIEW_SCHEMA_VERSION = 1 as const;

const localizedCopySchema = z
  .object({ en: z.string().trim().min(1), fi: z.string().trim().min(1) })
  .strict();
const reviewStatusSchema = z.enum(["ready", "ready-with-warnings", "blocked"]);
const reviewSectionStatusSchema = z.enum(["complete", "warning", "blocked", "not-applicable"]);
const reviewSectionIdSchema = z.enum([
  "business",
  "brand-foundation",
  "storefront-template",
  "storefront-pages",
  "languages",
  "catalogue",
  "assumptions",
  "warnings",
  "blockers",
]);
const reviewStageSchema = z.enum([
  "brand-foundation",
  "template-selection",
  "storefront-materialization",
]);
const stageExecutionStatusSchema = z.enum(["executed", "not-run"]);

export const storefrontGenerationReviewFactSchema = z
  .object({
    id: z.string().trim().min(1),
    label: localizedCopySchema,
    value: z.string().trim().min(1),
  })
  .strict();

export const storefrontGenerationReviewSectionSchema = z
  .object({
    id: reviewSectionIdSchema,
    heading: localizedCopySchema,
    summary: localizedCopySchema,
    status: reviewSectionStatusSchema,
    source: z.string().trim().min(1),
    sourceStage: reviewStageSchema.nullable(),
    facts: z.array(storefrontGenerationReviewFactSchema),
    diagnosticCodes: z.array(z.string().trim().min(1)),
  })
  .strict();

export const storefrontGenerationReviewDiagnosticSchema = z
  .object({
    stage: reviewStageSchema,
    code: z.string().trim().min(1),
    severity: z.enum(["info", "warning", "blocker"]),
    message: z.string().trim().min(1),
    planId: z.string().trim().min(1).nullable(),
    context: localizedCopySchema,
  })
  .strict();

export const storefrontGenerationReviewPageSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.string().trim().min(1),
    path: z.string().trim().min(1),
    position: z.number().int().min(0),
    totalSectionCount: z.number().int().min(0),
    visibleSectionCount: z.number().int().min(0),
    hiddenSectionCount: z.number().int().min(0),
    componentIds: z.array(z.string().trim().min(1)),
  })
  .strict()
  .superRefine((page, context) => {
    if (page.visibleSectionCount + page.hiddenSectionCount !== page.totalSectionCount) {
      context.addIssue({
        code: "custom",
        path: ["totalSectionCount"],
        message: "Page section counts must reconcile.",
      });
    }
    if (page.componentIds.length !== page.totalSectionCount) {
      context.addIssue({
        code: "custom",
        path: ["componentIds"],
        message: "Component identifiers must cover every section.",
      });
    }
  });

export const storefrontGenerationReviewLanguageSchema = z
  .object({
    selectedLanguages: z.array(z.enum(["en", "fi"])),
    primaryLanguage: z.enum(["en", "fi"]).nullable(),
  })
  .strict();

export const storefrontGenerationReviewCatalogueContextSchema = z.enum([
  "existing-vesko-catalogue",
  "controlled-demo-catalogue",
  "empty-catalogue",
]);

export const storefrontGenerationReviewProvenanceSchema = z
  .object({
    brief: z.string().trim().min(1),
    brandFoundation: z.string().trim().min(1),
    templateSelection: z.string().trim().min(1),
    storefrontMaterialization: z.string().trim().min(1),
  })
  .strict();

export const storefrontGenerationReviewStageStatusSchema = z
  .object({ stage: reviewStageSchema, status: stageExecutionStatusSchema })
  .strict();

export const storefrontGenerationReviewSchema = z
  .object({
    schemaVersion: z.literal(STOREFRONT_GENERATION_REVIEW_SCHEMA_VERSION),
    id: z.string().trim().min(1),
    guidedGenerationPlanId: z.string().trim().min(1),
    briefId: z.string().trim().min(1),
    briefFingerprint: z.string().trim().min(1),
    status: reviewStatusSchema,
    canCreateProject: z.boolean(),
    title: localizedCopySchema,
    summary: localizedCopySchema,
    sections: z.array(storefrontGenerationReviewSectionSchema),
    assumptions: z.array(localizedCopySchema),
    warnings: z.array(storefrontGenerationReviewDiagnosticSchema),
    blockers: z.array(storefrontGenerationReviewDiagnosticSchema),
    sourceDiagnostics: z.array(storefrontGenerationReviewDiagnosticSchema),
    stageStatuses: z.array(storefrontGenerationReviewStageStatusSchema),
    pageSummaries: z.array(storefrontGenerationReviewPageSchema),
    languagePlan: storefrontGenerationReviewLanguageSchema,
    catalogueContext: storefrontGenerationReviewCatalogueContextSchema.nullable(),
    catalogueRef: z.string().trim().min(1),
    selectedPresetId: z.string().trim().min(1).nullable(),
    selectedTemplateId: z.string().trim().min(1).nullable(),
    brandFoundationPlanId: z.string().trim().min(1),
    templateSelectionPlanId: z.string().trim().min(1).nullable(),
    materializationPlanId: z.string().trim().min(1).nullable(),
    generatedSnapshotId: z.string().trim().min(1).nullable(),
    provenance: storefrontGenerationReviewProvenanceSchema,
  })
  .strict()
  .superRefine((review, context) => {
    const expectedSections = [
      "business",
      "brand-foundation",
      "storefront-template",
      "storefront-pages",
      "languages",
      "catalogue",
      "assumptions",
      "warnings",
      "blockers",
    ];
    const expectedStages = ["brand-foundation", "template-selection", "storefront-materialization"];
    if (
      canonicalValueString(review.stageStatuses.map((stage) => stage.stage)) !==
      canonicalValueString(expectedStages)
    ) {
      context.addIssue({
        code: "custom",
        path: ["stageStatuses"],
        message: "Stage statuses must use the canonical order.",
      });
    }
    const brandStage = review.stageStatuses.find((stage) => stage.stage === "brand-foundation");
    const templateStage = review.stageStatuses.find(
      (stage) => stage.stage === "template-selection",
    );
    const materializationStage = review.stageStatuses.find(
      (stage) => stage.stage === "storefront-materialization",
    );
    if (brandStage?.status !== "executed") {
      context.addIssue({
        code: "custom",
        path: ["stageStatuses"],
        message: "Brand foundation must be executed.",
      });
    }
    if (templateStage?.status === "not-run" && review.templateSelectionPlanId !== null) {
      context.addIssue({
        code: "custom",
        path: ["templateSelectionPlanId"],
        message: "A not-run template stage cannot have a plan ID.",
      });
    }
    if (
      canonicalValueString(review.sections.map((section) => section.id)) !==
      canonicalValueString(expectedSections)
    ) {
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "Review sections must use the canonical order.",
      });
    }
    if (
      review.warnings.length !==
      review.sourceDiagnostics.filter((item) => item.severity === "warning").length
    ) {
      context.addIssue({
        code: "custom",
        path: ["warnings"],
        message: "Warning diagnostics must match source diagnostics.",
      });
    }
    if (
      review.blockers.length !==
      review.sourceDiagnostics.filter((item) => item.severity === "blocker").length
    ) {
      context.addIssue({
        code: "custom",
        path: ["blockers"],
        message: "Blocker diagnostics must match source diagnostics.",
      });
    }
    const requiredPages = ["home", "collection", "product"];
    const hasRequiredPages = requiredPages.every((type) =>
      review.pageSummaries.some((page) => page.type === type),
    );
    const expectedCanCreate =
      review.status !== "blocked" &&
      review.generatedSnapshotId !== null &&
      hasRequiredPages &&
      review.blockers.length === 0;
    if (review.canCreateProject !== expectedCanCreate) {
      context.addIssue({
        code: "custom",
        path: ["canCreateProject"],
        message: "canCreateProject does not match review readiness.",
      });
    }
    if (review.status === "blocked" && review.canCreateProject) {
      context.addIssue({
        code: "custom",
        path: ["canCreateProject"],
        message: "Blocked reviews cannot allow project creation.",
      });
    }
    if (
      review.status === "blocked" &&
      (review.generatedSnapshotId !== null || review.pageSummaries.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Blocked reviews cannot contain a generated snapshot or page summaries.",
      });
    }
    if (review.generatedSnapshotId === null && review.pageSummaries.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["pageSummaries"],
        message: "A review without a snapshot cannot contain pages.",
      });
    }
    const pagesSection = review.sections.find((section) => section.id === "storefront-pages");
    if (materializationStage?.status === "not-run") {
      if (
        review.materializationPlanId !== null ||
        review.generatedSnapshotId !== null ||
        review.pageSummaries.length > 0 ||
        pagesSection?.status !== "not-applicable"
      ) {
        context.addIssue({
          code: "custom",
          path: ["stageStatuses"],
          message: "A not-run materialization must not expose materialized pages or IDs.",
        });
      }
      if (review.sourceDiagnostics.some((item) => item.stage === "storefront-materialization")) {
        context.addIssue({
          code: "custom",
          path: ["sourceDiagnostics"],
          message: "A not-run materialization cannot have diagnostics.",
        });
      }
    }
    if (
      materializationStage?.status === "executed" &&
      review.generatedSnapshotId === null &&
      pagesSection?.status !== "blocked"
    ) {
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "An executed materialization without a snapshot must block pages.",
      });
    }
    if (review.generatedSnapshotId !== null && materializationStage?.status !== "executed") {
      context.addIssue({
        code: "custom",
        path: ["generatedSnapshotId"],
        message: "A snapshot requires executed materialization.",
      });
    }
    if (review.pageSummaries.length > 0 && materializationStage?.status !== "executed") {
      context.addIssue({
        code: "custom",
        path: ["pageSummaries"],
        message: "Page summaries require executed materialization.",
      });
    }
    if (review.templateSelectionPlanId === null && review.selectedTemplateId !== null) {
      context.addIssue({
        code: "custom",
        path: ["selectedTemplateId"],
        message: "A missing selection plan cannot have a selected template.",
      });
    }
  });

export type StorefrontGenerationReview = z.infer<typeof storefrontGenerationReviewSchema>;
export type StorefrontGenerationReviewFact = z.infer<typeof storefrontGenerationReviewFactSchema>;
export type StorefrontGenerationReviewSection = z.infer<
  typeof storefrontGenerationReviewSectionSchema
>;
export type StorefrontGenerationReviewDiagnostic = z.infer<
  typeof storefrontGenerationReviewDiagnosticSchema
>;
export type StorefrontGenerationReviewPage = z.infer<typeof storefrontGenerationReviewPageSchema>;

export class StorefrontGenerationReviewError extends Error {
  readonly code: "invalid-guided-plan" | "invalid-review" | "inconsistent-review-source";
  readonly causeValue: unknown;

  constructor(code: StorefrontGenerationReviewError["code"], message: string, cause?: unknown) {
    super(message);
    this.name = "StorefrontGenerationReviewError";
    this.code = code;
    this.causeValue = cause;
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

export function cloneStorefrontGenerationReview(
  input: StorefrontGenerationReview,
): StorefrontGenerationReview {
  return deepFreeze(structuredClone(storefrontGenerationReviewSchema.parse(input)));
}

export function validateStorefrontGenerationReview(input: unknown): StorefrontGenerationReview {
  try {
    return cloneStorefrontGenerationReview(storefrontGenerationReviewSchema.parse(input));
  } catch (cause) {
    if (cause instanceof StorefrontGenerationReviewError) throw cause;
    throw new StorefrontGenerationReviewError(
      "invalid-review",
      "Storefront generation review is invalid.",
      cause,
    );
  }
}
