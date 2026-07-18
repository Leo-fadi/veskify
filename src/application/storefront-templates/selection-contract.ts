import { z } from "zod";
import { idSchema } from "@/domain/shared";
import { storefrontTemplatePagePlanSchema } from "./contract";

export const STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION = 1 as const;

export const storefrontTemplateSelectionSourceSchema = z.enum(["recommended", "merchant-override"]);
export const storefrontTemplateSelectionStatusSchema = z.enum([
  "selected",
  "selected-with-warnings",
  "blocked",
]);

const localizedExplanationSchema = z
  .object({ en: z.string().trim().min(1), fi: z.string().trim().min(1) })
  .strict();

const selectionMessageSchema = z
  .object({ code: z.string().trim().min(1), message: z.string().trim().min(1) })
  .strict();

export const storefrontTemplateCandidateSchema = z
  .object({
    templateId: idSchema,
    score: z.number().int(),
    compatible: z.boolean(),
    reasonCodes: z.array(z.string().trim().min(1)),
    resolverWarnings: z.array(selectionMessageSchema),
    resolverErrors: z.array(selectionMessageSchema),
  })
  .strict();

export const storefrontTemplateSelectionPlanSchema = z
  .object({
    schemaVersion: z.literal(STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION),
    id: idSchema,
    briefId: idSchema,
    selectedTemplateId: idSchema.nullable(),
    selectionSource: storefrontTemplateSelectionSourceSchema,
    status: storefrontTemplateSelectionStatusSchema,
    candidates: z.array(storefrontTemplateCandidateSchema),
    explanation: localizedExplanationSchema,
    assumptions: z.array(z.string().trim().min(1)),
    warnings: z.array(selectionMessageSchema),
    blockers: z.array(selectionMessageSchema),
    resolvedPagePlans: z.array(storefrontTemplatePagePlanSchema),
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.status === "blocked" && plan.selectedTemplateId !== null) {
      context.addIssue({
        code: "custom",
        path: ["selectedTemplateId"],
        message: "A blocked selection cannot include a selected template.",
      });
    }
    if (plan.status !== "blocked" && plan.selectedTemplateId === null) {
      context.addIssue({
        code: "custom",
        path: ["selectedTemplateId"],
        message: "A selected plan must include a template.",
      });
    }
    if (plan.status === "blocked" && plan.blockers.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["blockers"],
        message: "A blocked selection must explain its blockers.",
      });
    }
  });

export type StorefrontTemplateSelectionSource = z.infer<
  typeof storefrontTemplateSelectionSourceSchema
>;
export type StorefrontTemplateSelectionStatus = z.infer<
  typeof storefrontTemplateSelectionStatusSchema
>;
export type StorefrontTemplateCandidate = z.infer<typeof storefrontTemplateCandidateSchema>;
export type StorefrontTemplateSelectionPlan = z.infer<typeof storefrontTemplateSelectionPlanSchema>;

export function cloneStorefrontTemplateSelectionPlan(
  input: StorefrontTemplateSelectionPlan,
): StorefrontTemplateSelectionPlan {
  return deepFreeze(structuredClone(storefrontTemplateSelectionPlanSchema.parse(input)));
}

export function validateStorefrontTemplateSelectionPlan(
  input: unknown,
): StorefrontTemplateSelectionPlan {
  return cloneStorefrontTemplateSelectionPlan(storefrontTemplateSelectionPlanSchema.parse(input));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}
