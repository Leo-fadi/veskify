import { z } from "zod";
import {
  designOperationSchema,
  proposalValidationResultSchema,
} from "@/application/design-operations";
import type { StorefrontRenderContext } from "@/components/registry";
import type { RegisteredComponentType } from "@/components/registry/registry";
import type { BrandSystem } from "@/domain/design-system";
import {
  localeSchema,
  localizedTextSchema,
  type Locale,
  type LocalizedText,
} from "@/domain/shared";
import {
  pageModelSchema,
  pageTypeSchema,
  type PageModel,
  type PageType,
} from "@/domain/storefront";

export const designIntentSchema = z.enum([
  "exactBrandPalette",
  "luxuryStyle",
  "minimalNordicStyle",
  "campaignSection",
  "heroImprovement",
]);
export const designSkillScopeSchema = z.enum([
  "section",
  "page",
  "storefront",
  "brand",
  "cataloguePresentation",
]);
export const designOperationTypeSchema = z.enum([
  "CHANGE_LOCALIZED_SECTION_TEXT",
  "CHANGE_SECTION_VARIANT",
  "CHANGE_BACKGROUND",
  "CHANGE_TYPOGRAPHY",
  "CHANGE_DENSITY",
  "CHANGE_SHAPE",
  "CHANGE_ALIGNMENT",
  "CHANGE_CTA_STYLE",
  "APPLY_APPROVED_BRAND_COLOURS",
  "APPLY_APPROVED_BRAND_TYPOGRAPHY",
  "ADD_APPROVED_SECTION",
  "REMOVE_OPTIONAL_SECTION",
  "REORDER_SECTIONS",
]);
export const skillContextRequirementSchema = z.enum([
  "activeLocale",
  "page",
  "brandSystem",
  "selectedSection",
  "catalogue",
  "campaign",
]);
export const skillPreconditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pageTypeSupported") }).strict(),
  z.object({ type: z.literal("componentExists"), component: z.string().min(1).max(80) }).strict(),
  z.object({ type: z.literal("campaignContextAvailableOrDerivable") }).strict(),
]);
export const skillValidationRuleSchema = z.enum([
  "structuredOperationsOnly",
  "declaredOperationsOnly",
  "declaredComponentsOnly",
  "protectedPathsPreserved",
  "requestedScopePreserved",
  "noExecutableContent",
  "canonicalPageValid",
]);

export const campaignContextSchema = z
  .object({
    objective: localizedTextSchema.optional(),
    heading: localizedTextSchema.optional(),
    body: localizedTextSchema.optional(),
  })
  .strict()
  .refine((context) => context.objective || context.heading || context.body, {
    message: "Campaign context requires an objective, heading or body.",
  });

export type DesignIntent = z.infer<typeof designIntentSchema>;
export type DesignSkillScope = z.infer<typeof designSkillScopeSchema>;
export type DesignOperationType = z.infer<typeof designOperationTypeSchema>;
export type SkillContextRequirement = z.infer<typeof skillContextRequirementSchema>;
export type SkillPrecondition = z.infer<typeof skillPreconditionSchema>;
export type SkillValidationRule = z.infer<typeof skillValidationRuleSchema>;
export type CampaignContext = z.infer<typeof campaignContextSchema>;

export function hasMeaningfulCampaignContext(value: unknown): value is CampaignContext {
  return campaignContextSchema.safeParse(value).success;
}

export type DesignSkillExecutionContext = {
  activeLocale: Locale;
  page: PageModel;
  pageType: PageType;
  brandSystem: BrandSystem;
  displayContext: StorefrontRenderContext;
  selectedSectionId?: string;
  campaign?: CampaignContext;
  requestedScope: DesignSkillScope;
};

export type DesignSkillSummaryInput = {
  activeLocale: Locale;
  page: PageModel;
  operationCount: number;
  selectedSectionId?: string;
};

export type DesignSkillDefinition = {
  id: string;
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  supportedIntents: DesignIntent[];
  scope: DesignSkillScope;
  supportedPageTypes: PageType[];
  requiredContext: SkillContextRequirement[];
  optionalContext: SkillContextRequirement[];
  allowedComponentTypes: RegisteredComponentType[];
  allowedOperationTypes: DesignOperationType[];
  protectedPaths: string[];
  preconditions: SkillPrecondition[];
  outputSchema: z.ZodType;
  validationRules: SkillValidationRule[];
  execute: (context: Readonly<DesignSkillExecutionContext>) => unknown;
  summarize: (input: Readonly<DesignSkillSummaryInput>) => LocalizedText;
};

const functionSchema = z.custom<(...args: never[]) => unknown>(
  (value) => typeof value === "function",
  "Expected a deterministic function.",
);
const zodSchemaSchema = z.custom<z.ZodType>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "safeParse" in value &&
    typeof value.safeParse === "function",
  "Expected a Zod output schema.",
);

export const designSkillDefinitionSchema: z.ZodType<DesignSkillDefinition> = z
  .object({
    id: z.string().regex(/^[a-z][A-Za-z0-9]{2,79}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    title: localizedTextSchema,
    description: localizedTextSchema,
    supportedIntents: z.array(designIntentSchema).min(1),
    scope: designSkillScopeSchema,
    supportedPageTypes: z.array(pageTypeSchema).min(1),
    requiredContext: z.array(skillContextRequirementSchema),
    optionalContext: z.array(skillContextRequirementSchema),
    allowedComponentTypes: z.array(z.string().min(1).max(80)).min(1) as z.ZodType<
      RegisteredComponentType[]
    >,
    allowedOperationTypes: z.array(designOperationTypeSchema).min(1),
    protectedPaths: z.array(z.string().min(1)).min(1),
    preconditions: z.array(skillPreconditionSchema),
    outputSchema: zodSchemaSchema,
    validationRules: z.array(skillValidationRuleSchema).min(1),
    execute: functionSchema as unknown as z.ZodType<DesignSkillDefinition["execute"]>,
    summarize: functionSchema as unknown as z.ZodType<DesignSkillDefinition["summarize"]>,
  })
  .strict()
  .superRefine((definition, context) => {
    for (const [field, values] of [
      ["supportedIntents", definition.supportedIntents],
      ["supportedPageTypes", definition.supportedPageTypes],
      ["requiredContext", definition.requiredContext],
      ["optionalContext", definition.optionalContext],
      ["allowedComponentTypes", definition.allowedComponentTypes],
      ["allowedOperationTypes", definition.allowedOperationTypes],
      ["protectedPaths", definition.protectedPaths],
      ["validationRules", definition.validationRules],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", path: [field], message: `${field} must be unique.` });
      }
    }
    const overlap = definition.requiredContext.filter((item) =>
      definition.optionalContext.includes(item),
    );
    if (overlap.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["optionalContext"],
        message: "Required and optional context declarations must not overlap.",
      });
    }
  });

export const designRequestClassificationSchema = z
  .object({
    normalizedIntent: designIntentSchema.nullable(),
    locale: localeSchema,
    confidence: z.number().min(0).max(1),
    requestedScope: designSkillScopeSchema.nullable(),
    selectedSkillIds: z.array(z.string()),
    requiresClarification: z.boolean(),
    clarifications: z.array(localizedTextSchema),
    unsupportedReason: localizedTextSchema.nullable(),
  })
  .strict();

export const selectedDesignSkillSchema = z
  .object({
    id: z.string(),
    version: z.string(),
    scope: designSkillScopeSchema,
    targetSectionIds: z.array(z.string()),
  })
  .strict();

export const designPlanSchema = z
  .object({
    id: z.string().regex(/^plan_[a-f0-9]{8}$/),
    normalizedIntent: designIntentSchema.nullable(),
    locale: localeSchema,
    requestedScope: designSkillScopeSchema.nullable(),
    selectedSkills: z.array(selectedDesignSkillSchema),
    affectedPageIds: z.array(z.string()),
    affectedSectionIds: z.array(z.string()),
    plannedOperationCategories: z.array(designOperationTypeSchema),
    explanation: localizedTextSchema,
    assumptions: z.array(localizedTextSchema),
    requiredClarifications: z.array(localizedTextSchema),
    validation: proposalValidationResultSchema,
  })
  .strict();

export const designSkillExecutionResultSchema = z
  .object({
    originalPage: pageModelSchema,
    proposedPage: pageModelSchema,
    selectedSkills: z.array(selectedDesignSkillSchema),
    operations: z.array(designOperationSchema),
    summary: localizedTextSchema,
    validation: proposalValidationResultSchema,
    failureReason: localizedTextSchema.nullable(),
  })
  .strict();

export type DesignRequestClassification = z.infer<typeof designRequestClassificationSchema>;
export type SelectedDesignSkill = z.infer<typeof selectedDesignSkillSchema>;
export type DesignPlan = z.infer<typeof designPlanSchema>;
export type DesignSkillExecutionResult = z.infer<typeof designSkillExecutionResultSchema>;
