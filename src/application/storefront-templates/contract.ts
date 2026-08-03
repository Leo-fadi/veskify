import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";
import { pageTypeSchema } from "@/domain/storefront";
import {
  narrativeRoleIds,
  narrativeRoleSchema,
  parameterConstraintSchema,
  transitionIntentSchema,
  visualWeightSchema,
} from "@/domain/component-platform";

export const STOREFRONT_TEMPLATE_SCHEMA_VERSION = 1 as const;

export const storefrontTemplateCategorySchema = z.enum([
  "brand-led-editorial",
  "balanced-commerce",
  "catalogue-forward-commerce",
]);
export const storefrontTemplateStatusSchema = z.enum(["implemented", "planned"]);
export const templateCapabilitySchema = z.enum([
  "catalogue-available",
  "logo-available",
  "supporting-imagery-available",
  "collection-pages-requested",
  "product-pages-requested",
]);
export const catalogueContextSchema = z.enum(["existing", "demo", "empty"]);
export const templateSlotPurposeSchema = z.enum([
  "announcement-or-trust",
  "navigation",
  "hero",
  "featured-categories",
  "featured-products",
  "editorial-story",
  "brand-values",
  "social-proof",
  "newsletter",
  "footer",
  "collection-introduction",
  "filtering-or-merchandising",
  "product-media",
  "product-information",
  "product-options",
  "related-products",
]);
export const templateSlotOmissionSchema = z.enum([
  "never",
  "when-catalogue-is-empty",
  "when-logo-is-unavailable",
  "when-imagery-is-unavailable",
  "when-not-requested",
]);

const pageBlueprintFlowRuleIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][A-Za-z0-9]*(?:[._-][a-z][A-Za-z0-9]*)*$/);

export const pageBlueprintCompositionContractSchema = z
  .object({
    allowedNarrativeRoles: z
      .array(narrativeRoleSchema)
      .min(1)
      .default([...narrativeRoleIds]),
    requiredNarrativeRoles: z.array(narrativeRoleSchema).default([]),
    flowRuleIds: z.array(pageBlueprintFlowRuleIdSchema).default([]),
    maxRepeatedRole: z.number().int().positive().default(2),
    maxRepeatedComponentFamily: z.number().int().positive().default(3),
    boundedParameterConstraints: z.array(parameterConstraintSchema).default([]),
    responsiveParameterIds: z.array(pageBlueprintFlowRuleIdSchema).default([]),
  })
  .strict()
  .superRefine((contract, context) => {
    if (new Set(contract.allowedNarrativeRoles).size !== contract.allowedNarrativeRoles.length) {
      context.addIssue({
        code: "custom",
        path: ["allowedNarrativeRoles"],
        message: "Allowed narrative roles must be unique.",
      });
    }
    if (new Set(contract.requiredNarrativeRoles).size !== contract.requiredNarrativeRoles.length) {
      context.addIssue({
        code: "custom",
        path: ["requiredNarrativeRoles"],
        message: "Required narrative roles must be unique.",
      });
    }
    if (
      contract.requiredNarrativeRoles.some((role) => !contract.allowedNarrativeRoles.includes(role))
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiredNarrativeRoles"],
        message: "Required narrative roles must be allowed by the PageBlueprint.",
      });
    }
  });

export const defaultPageBlueprintCompositionContract = pageBlueprintCompositionContractSchema.parse(
  {},
);

const templateTokenSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z][A-Za-z0-9-]*$/, "Use stable component or template tokens.");

const requiredLocalizedTextSchema = z
  .object({ en: z.string().trim().min(1), fi: z.string().trim().min(1) })
  .strict();

export const storefrontTemplateSlotSchema = z
  .object({
    id: templateTokenSchema,
    required: z.boolean(),
    sectionType: templateTokenSchema,
    allowedVariants: z.array(templateTokenSchema).min(1),
    defaultVariant: templateTokenSchema,
    label: requiredLocalizedTextSchema,
    purpose: templateSlotPurposeSchema,
    narrativeRole: narrativeRoleSchema.default("orientation"),
    visualWeight: visualWeightSchema.default("medium"),
    transitionIntent: transitionIntentSchema.optional(),
    boundedParameterConstraints: z.array(parameterConstraintSchema).default([]),
    omitWhen: templateSlotOmissionSchema.default("never"),
  })
  .strict()
  .superRefine((slot, context) => {
    if (new Set(slot.allowedVariants).size !== slot.allowedVariants.length) {
      context.addIssue({
        code: "custom",
        path: ["allowedVariants"],
        message: "Allowed variants must be unique.",
      });
    }
    if (!slot.allowedVariants.includes(slot.defaultVariant)) {
      context.addIssue({
        code: "custom",
        path: ["defaultVariant"],
        message: "The default variant must be allowed.",
      });
    }
    if (slot.required && slot.omitWhen !== "never") {
      context.addIssue({
        code: "custom",
        path: ["omitWhen"],
        message: "Required slots cannot have an omission condition.",
      });
    }
  });

/**
 * The persisted pre-Task-6 slot shape. It deliberately has no narrative defaults:
 * a v2 resolved plan did not select Task-6 semantics and must be migrated from its
 * registered template identity rather than silently acquiring them through parsing.
 */
export const legacyStorefrontTemplateSlotSchema = z
  .object({
    id: templateTokenSchema,
    required: z.boolean(),
    sectionType: templateTokenSchema,
    allowedVariants: z.array(templateTokenSchema).min(1),
    defaultVariant: templateTokenSchema,
    label: requiredLocalizedTextSchema,
    purpose: templateSlotPurposeSchema,
    omitWhen: templateSlotOmissionSchema.default("never"),
  })
  .strict();

export const storefrontTemplatePagePlanSchema = z
  .object({
    pageType: pageTypeSchema,
    slots: z.array(storefrontTemplateSlotSchema).min(1),
    pageBlueprint: pageBlueprintCompositionContractSchema.default(
      defaultPageBlueprintCompositionContract,
    ),
  })
  .strict()
  .superRefine((plan, context) => {
    const ids = plan.slots.map((slot) => slot.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["slots"],
        message: "Slot IDs must be unique within a page plan.",
      });
    }
  });

export const legacyStorefrontTemplatePagePlanSchema = z
  .object({
    pageType: pageTypeSchema,
    slots: z.array(legacyStorefrontTemplateSlotSchema).min(1),
  })
  .strict()
  .superRefine((plan, context) => {
    const ids = plan.slots.map((slot) => slot.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["slots"],
        message: "Slot IDs must be unique within a page plan.",
      });
    }
  });

export const storefrontTemplateDefinitionSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.literal(STOREFRONT_TEMPLATE_SCHEMA_VERSION),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    name: requiredLocalizedTextSchema,
    description: requiredLocalizedTextSchema,
    designCharacteristics: requiredLocalizedTextSchema,
    recommendedUse: requiredLocalizedTextSchema,
    category: storefrontTemplateCategorySchema,
    supportedPageTypes: z.array(pageTypeSchema).min(1),
    supportedCatalogueContexts: z.array(catalogueContextSchema).min(1),
    pagePlans: z.array(storefrontTemplatePagePlanSchema).min(1),
    requiredCapabilities: z.array(templateCapabilitySchema),
    optionalCapabilities: z.array(templateCapabilitySchema),
    status: storefrontTemplateStatusSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((template, context) => {
    if (new Set(template.supportedPageTypes).size !== template.supportedPageTypes.length) {
      context.addIssue({
        code: "custom",
        path: ["supportedPageTypes"],
        message: "Supported page types must be unique.",
      });
    }
    if (new Set(template.requiredCapabilities).size !== template.requiredCapabilities.length) {
      context.addIssue({
        code: "custom",
        path: ["requiredCapabilities"],
        message: "Required capabilities must be unique.",
      });
    }
    if (new Set(template.optionalCapabilities).size !== template.optionalCapabilities.length) {
      context.addIssue({
        code: "custom",
        path: ["optionalCapabilities"],
        message: "Optional capabilities must be unique.",
      });
    }
    if (
      template.requiredCapabilities.some((capability) =>
        template.optionalCapabilities.includes(capability),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["optionalCapabilities"],
        message: "A capability cannot be both required and optional.",
      });
    }
    const pageTypes = template.pagePlans.map((plan) => plan.pageType);
    if (new Set(pageTypes).size !== pageTypes.length) {
      context.addIssue({
        code: "custom",
        path: ["pagePlans"],
        message: "Page plans must be unique by page type.",
      });
    }
    if (
      template.supportedPageTypes.length !== pageTypes.length ||
      template.supportedPageTypes.some((pageType) => !pageTypes.includes(pageType))
    ) {
      context.addIssue({
        code: "custom",
        path: ["supportedPageTypes"],
        message: "Supported page types must match the defined page plans.",
      });
    }
  });

export type StorefrontTemplateCategory = z.infer<typeof storefrontTemplateCategorySchema>;
export type StorefrontTemplateStatus = z.infer<typeof storefrontTemplateStatusSchema>;
export type TemplateCapability = z.infer<typeof templateCapabilitySchema>;
export type CatalogueContext = z.infer<typeof catalogueContextSchema>;
export type TemplateSlotPurpose = z.infer<typeof templateSlotPurposeSchema>;
export type TemplateSlotOmission = z.infer<typeof templateSlotOmissionSchema>;
export type PageBlueprintCompositionContract = z.infer<
  typeof pageBlueprintCompositionContractSchema
>;
export type StorefrontTemplateSlot = z.infer<typeof storefrontTemplateSlotSchema>;
export type StorefrontTemplatePagePlan = z.infer<typeof storefrontTemplatePagePlanSchema>;
export type LegacyStorefrontTemplatePagePlan = z.infer<
  typeof legacyStorefrontTemplatePagePlanSchema
>;
export type StorefrontTemplateDefinition = z.infer<typeof storefrontTemplateDefinitionSchema>;

export function cloneTemplateDefinition(
  input: StorefrontTemplateDefinition,
): StorefrontTemplateDefinition {
  return deepFreeze(structuredClone(storefrontTemplateDefinitionSchema.parse(input)));
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}
