import { z } from "zod";
import { storefrontDesignBriefSchema } from "@/domain/design-brief";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";
import { storefrontSnapshotSchema } from "@/domain/storefront";
import { brandFoundationPlanSchema } from "@/application/brand-foundation/contract";
import { initialStorefrontGenerationPlanSchema } from "@/application/storefront-templates/materializer-contract";
import { storefrontTemplateSelectionPlanSchema } from "@/application/storefront-templates/selection-contract";

export const GUIDED_STOREFRONT_GENERATION_SCHEMA_VERSION = 1 as const;

export const guidedStorefrontGenerationInputSchema = z
  .object({
    brief: storefrontDesignBriefSchema,
    projectId: idSchema,
    snapshotId: idSchema,
    catalogueRef: idSchema,
    createdAt: isoDateTimeSchema,
    preferredTemplateId: idSchema.optional(),
  })
  .strict();

export const guidedStorefrontGenerationStatusSchema = z.enum([
  "ready",
  "ready-with-warnings",
  "blocked",
]);
export const guidedStorefrontGenerationStageSchema = z.enum([
  "brand-foundation",
  "template-selection",
  "storefront-materialization",
]);
export const guidedStorefrontGenerationStageStatusSchema = z.enum(["executed", "not-run"]);
export const guidedStorefrontGenerationDiagnosticSeveritySchema = z.enum([
  "info",
  "warning",
  "blocker",
]);

export const guidedStorefrontGenerationDiagnosticSchema = z
  .object({
    stage: guidedStorefrontGenerationStageSchema,
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    severity: guidedStorefrontGenerationDiagnosticSeveritySchema,
    planId: idSchema.nullable(),
  })
  .strict();

export const guidedStorefrontGenerationStageDiagnosticsSchema = z
  .object({
    stage: guidedStorefrontGenerationStageSchema,
    status: guidedStorefrontGenerationStageStatusSchema,
    diagnostics: z.array(guidedStorefrontGenerationDiagnosticSchema),
  })
  .strict();

export const guidedStorefrontGenerationProvenanceSchema = z
  .object({
    brandFoundation: z.string().trim().min(1),
    templateSelection: z.string().trim().min(1),
    storefrontMaterialization: z.string().trim().min(1),
  })
  .strict();

export const guidedStorefrontGenerationPlanSchema = z
  .object({
    schemaVersion: z.literal(GUIDED_STOREFRONT_GENERATION_SCHEMA_VERSION),
    id: idSchema,
    briefId: idSchema,
    status: guidedStorefrontGenerationStatusSchema,
    projectId: idSchema,
    snapshotId: idSchema,
    catalogueRef: idSchema,
    createdAt: isoDateTimeSchema,
    brandFoundationPlan: brandFoundationPlanSchema,
    templateSelectionPlan: storefrontTemplateSelectionPlanSchema.nullable(),
    initialStorefrontGenerationPlan: initialStorefrontGenerationPlanSchema.nullable(),
    generatedSnapshot: storefrontSnapshotSchema.nullable(),
    stageDiagnostics: z.array(guidedStorefrontGenerationStageDiagnosticsSchema),
    diagnostics: z.array(guidedStorefrontGenerationDiagnosticSchema),
    assumptions: z.array(z.string().trim().min(1)),
    warnings: z.array(guidedStorefrontGenerationDiagnosticSchema),
    blockers: z.array(guidedStorefrontGenerationDiagnosticSchema),
    provenance: guidedStorefrontGenerationProvenanceSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.briefId !== plan.brandFoundationPlan.briefId) {
      context.addIssue({
        code: "custom",
        path: ["brandFoundationPlan", "briefId"],
        message: "Brand foundation brief ID must match.",
      });
    }
    if (plan.status === "blocked" && plan.generatedSnapshot !== null) {
      context.addIssue({
        code: "custom",
        path: ["generatedSnapshot"],
        message: "A blocked orchestration cannot contain a snapshot.",
      });
    }
    if (plan.status !== "blocked" && plan.generatedSnapshot === null) {
      context.addIssue({
        code: "custom",
        path: ["generatedSnapshot"],
        message: "A ready orchestration must contain a snapshot.",
      });
    }
    if (plan.status === "blocked" && plan.blockers.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["blockers"],
        message: "A blocked orchestration must explain its blockers.",
      });
    }
    if (plan.generatedSnapshot && plan.generatedSnapshot.id !== plan.snapshotId) {
      context.addIssue({
        code: "custom",
        path: ["generatedSnapshot", "id"],
        message: "Generated snapshot ID must match snapshotId.",
      });
    }
  });

export type GuidedStorefrontGenerationInput = z.infer<typeof guidedStorefrontGenerationInputSchema>;
export type GuidedStorefrontGenerationStatus = z.infer<
  typeof guidedStorefrontGenerationStatusSchema
>;
export type GuidedStorefrontGenerationStage = z.infer<typeof guidedStorefrontGenerationStageSchema>;
export type GuidedStorefrontGenerationDiagnostic = z.infer<
  typeof guidedStorefrontGenerationDiagnosticSchema
>;
export type GuidedStorefrontGenerationPlan = z.infer<typeof guidedStorefrontGenerationPlanSchema>;

export class GuidedStorefrontGenerationError extends Error {
  readonly code: "invalid-input" | "invalid-plan" | "inconsistent-stage";
  readonly causeValue: unknown;

  constructor(code: GuidedStorefrontGenerationError["code"], message: string, cause?: unknown) {
    super(message);
    this.name = "GuidedStorefrontGenerationError";
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

export function cloneGuidedStorefrontGenerationPlan(
  input: GuidedStorefrontGenerationPlan,
): GuidedStorefrontGenerationPlan {
  return deepFreeze(structuredClone(guidedStorefrontGenerationPlanSchema.parse(input)));
}

export function validateGuidedStorefrontGenerationPlan(
  input: unknown,
): GuidedStorefrontGenerationPlan {
  return cloneGuidedStorefrontGenerationPlan(guidedStorefrontGenerationPlanSchema.parse(input));
}
