import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";
import { brandSystemSchema } from "@/domain/design-system";
import { storefrontDesignBriefSchema } from "@/domain/design-brief";
import { storefrontSnapshotSchema } from "@/domain/storefront";
import { storefrontTemplateSelectionPlanSchema } from "./selection-contract";

export const INITIAL_STOREFRONT_GENERATION_SCHEMA_VERSION = 1 as const;

export const initialStorefrontGenerationStatusSchema = z.enum([
  "ready",
  "ready-with-warnings",
  "blocked",
]);

const generationMessageSchema = z
  .object({ code: z.string().trim().min(1), message: z.string().trim().min(1) })
  .strict();

export const initialStorefrontOmissionSchema = z
  .object({
    pageType: z.string().trim().min(1),
    slotId: z.string().trim().min(1),
    sectionType: z.string().trim().min(1),
    condition: z.string().trim().min(1),
  })
  .strict();

export const initialStorefrontProvenanceSchema = z
  .object({
    pageSource: z.string().trim().min(1),
    sectionSource: z.string().trim().min(1),
    contentSource: z.string().trim().min(1),
    brandSystemSource: z.string().trim().min(1),
    omissions: z.array(initialStorefrontOmissionSchema),
  })
  .strict();

export const initialStorefrontMaterializationInputSchema = z
  .object({
    brief: storefrontDesignBriefSchema,
    templateSelectionPlan: storefrontTemplateSelectionPlanSchema,
    brandSystem: brandSystemSchema,
    projectId: idSchema,
    snapshotId: idSchema,
    catalogueRef: idSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const initialStorefrontGenerationPlanSchema = z
  .object({
    schemaVersion: z.literal(INITIAL_STOREFRONT_GENERATION_SCHEMA_VERSION),
    id: idSchema,
    briefId: idSchema,
    templateSelectionPlanId: idSchema,
    selectedTemplateId: idSchema.nullable(),
    projectId: idSchema,
    snapshotId: idSchema,
    catalogueRef: idSchema,
    status: initialStorefrontGenerationStatusSchema,
    generatedSnapshot: storefrontSnapshotSchema.nullable(),
    generatedPageIds: z.array(idSchema),
    assumptions: z.array(z.string().trim().min(1)),
    warnings: z.array(generationMessageSchema),
    blockers: z.array(generationMessageSchema),
    provenance: initialStorefrontProvenanceSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.status === "blocked" && plan.generatedSnapshot !== null) {
      context.addIssue({
        code: "custom",
        path: ["generatedSnapshot"],
        message: "A blocked generation plan cannot contain a snapshot.",
      });
    }
    if (plan.status !== "blocked" && plan.generatedSnapshot === null) {
      context.addIssue({
        code: "custom",
        path: ["generatedSnapshot"],
        message: "A ready generation plan must contain a snapshot.",
      });
    }
    if (plan.status === "blocked" && plan.blockers.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["blockers"],
        message: "A blocked generation plan must explain its blockers.",
      });
    }
    if (plan.generatedSnapshot && plan.generatedSnapshot.id !== plan.snapshotId) {
      context.addIssue({
        code: "custom",
        path: ["generatedSnapshot", "id"],
        message: "The generated snapshot ID must match snapshotId.",
      });
    }
  });

export type InitialStorefrontMaterializationInput = z.infer<
  typeof initialStorefrontMaterializationInputSchema
>;
export type InitialStorefrontGenerationStatus = z.infer<
  typeof initialStorefrontGenerationStatusSchema
>;
export type InitialStorefrontOmission = z.infer<typeof initialStorefrontOmissionSchema>;
export type InitialStorefrontProvenance = z.infer<typeof initialStorefrontProvenanceSchema>;
export type InitialStorefrontGenerationPlan = z.infer<typeof initialStorefrontGenerationPlanSchema>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

export function cloneInitialStorefrontGenerationPlan(
  input: InitialStorefrontGenerationPlan,
): InitialStorefrontGenerationPlan {
  return deepFreeze(structuredClone(initialStorefrontGenerationPlanSchema.parse(input)));
}

export function validateInitialStorefrontGenerationPlan(
  input: unknown,
): InitialStorefrontGenerationPlan {
  return cloneInitialStorefrontGenerationPlan(initialStorefrontGenerationPlanSchema.parse(input));
}
