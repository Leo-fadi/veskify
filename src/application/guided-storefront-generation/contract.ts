import { z } from "zod";
import { storefrontDesignBriefSchema } from "@/domain/design-brief";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";
import { canonicalValueString, storefrontSnapshotSchema } from "@/domain/storefront";
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
    if (plan.templateSelectionPlan && plan.templateSelectionPlan.briefId !== plan.briefId) {
      context.addIssue({
        code: "custom",
        path: ["templateSelectionPlan", "briefId"],
        message: "Template selection brief ID must match.",
      });
    }
    if (plan.generatedSnapshot) {
      if (plan.generatedSnapshot.projectId !== plan.projectId) {
        context.addIssue({
          code: "custom",
          path: ["generatedSnapshot", "projectId"],
          message: "Generated snapshot project ID must match projectId.",
        });
      }
      if (plan.generatedSnapshot.catalogueRef !== plan.catalogueRef) {
        context.addIssue({
          code: "custom",
          path: ["generatedSnapshot", "catalogueRef"],
          message: "Generated snapshot catalogue reference must match catalogueRef.",
        });
      }
      if (plan.generatedSnapshot.createdAt !== plan.createdAt) {
        context.addIssue({
          code: "custom",
          path: ["generatedSnapshot", "createdAt"],
          message: "Generated snapshot createdAt must match createdAt.",
        });
      }
      if (
        canonicalValueString(plan.generatedSnapshot.brandSystem) !==
        canonicalValueString(plan.brandFoundationPlan.brandSystem)
      ) {
        context.addIssue({
          code: "custom",
          path: ["generatedSnapshot", "brandSystem"],
          message: "Generated snapshot BrandSystem must match the brand foundation plan.",
        });
      }
    }
    const materialization = plan.initialStorefrontGenerationPlan;
    if (materialization) {
      if (materialization.briefId !== plan.briefId) {
        context.addIssue({
          code: "custom",
          path: ["initialStorefrontGenerationPlan", "briefId"],
          message: "Materialization brief ID must match.",
        });
      }
      if (materialization.projectId !== plan.projectId) {
        context.addIssue({
          code: "custom",
          path: ["initialStorefrontGenerationPlan", "projectId"],
          message: "Materialization project ID must match projectId.",
        });
      }
      if (materialization.snapshotId !== plan.snapshotId) {
        context.addIssue({
          code: "custom",
          path: ["initialStorefrontGenerationPlan", "snapshotId"],
          message: "Materialization snapshot ID must match snapshotId.",
        });
      }
      if (materialization.catalogueRef !== plan.catalogueRef) {
        context.addIssue({
          code: "custom",
          path: ["initialStorefrontGenerationPlan", "catalogueRef"],
          message: "Materialization catalogue reference must match catalogueRef.",
        });
      }
      if (plan.templateSelectionPlan) {
        if (materialization.templateSelectionPlanId !== plan.templateSelectionPlan.id) {
          context.addIssue({
            code: "custom",
            path: ["initialStorefrontGenerationPlan", "templateSelectionPlanId"],
            message: "Materialization selection plan ID must match.",
          });
        }
        if (materialization.selectedTemplateId !== plan.templateSelectionPlan.selectedTemplateId) {
          context.addIssue({
            code: "custom",
            path: ["initialStorefrontGenerationPlan", "selectedTemplateId"],
            message: "Materialization selected template must match.",
          });
        }
      } else {
        context.addIssue({
          code: "custom",
          path: ["templateSelectionPlan"],
          message: "Materialization requires its template selection plan.",
        });
      }
      const topSnapshot = plan.generatedSnapshot;
      if (
        canonicalValueString(materialization.generatedSnapshot) !==
        canonicalValueString(topSnapshot)
      ) {
        context.addIssue({
          code: "custom",
          path: ["initialStorefrontGenerationPlan", "generatedSnapshot"],
          message: "Materialization snapshot must equal the top-level generated snapshot.",
        });
      }
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
