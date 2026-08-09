import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";
import { pageTypeSchema } from "@/domain/storefront";
import { commercialSharedFrameProfileIdSchema } from "@/domain/storefront/commercial-shared-frame";
import { canonicalProductCardAnatomyIdSchema } from "@/domain/product-card";
import {
  assetRoleSchema,
  commerceBindingSourceTypeSchema,
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
  "campaign-promotion",
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
  "when-evidence-is-unavailable",
  "when-not-requested",
]);

const pageBlueprintFlowRuleIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][A-Za-z0-9]*(?:[._-][a-z][A-Za-z0-9]*)*$/);

const pageBlueprintProfileVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

const commercialHomepageFingerprintSchema = z.string().trim().min(1).max(240);
const commercialCollectionSearchFingerprintSchema = z.string().trim().min(1).max(240);

export const commercialHomepageProfileAuthoritySchema = z
  .object({
    family: z.literal("commercial-homepage"),
    compatibleSharedFrameProfileIds: z.array(commercialSharedFrameProfileIdSchema).min(1),
    defaultSharedFrameProfileId: commercialSharedFrameProfileIdSchema,
    merchandisingEmphasis: z.enum([
      "curated-products",
      "product-discovery",
      "restrained-commerce",
      "campaign-conversion",
      "collection-discovery",
      "considered-purchase",
    ]),
    productCardAnatomyId: canonicalProductCardAnatomyIdSchema,
    sectionCardinality: z.array(
      z
        .object({
          slotId: z.string().trim().min(1).max(80),
          minimum: z.number().int().nonnegative(),
          ideal: z.number().int().nonnegative(),
          maximum: z.number().int().positive(),
        })
        .strict()
        .superRefine((cardinality, context) => {
          if (cardinality.minimum > cardinality.ideal || cardinality.ideal > cardinality.maximum) {
            context.addIssue({
              code: "custom",
              path: ["ideal"],
              message: "Commercial homepage cardinality must satisfy minimum <= ideal <= maximum.",
            });
          }
        }),
    ),
    contentCardinality: z.array(
      z
        .object({
          slotId: z.string().trim().min(1).max(80),
          resource: z.enum(["products", "collections"]),
          minimum: z.number().int().nonnegative(),
          ideal: z.number().int().nonnegative(),
          maximum: z.number().int().positive(),
        })
        .strict()
        .superRefine((cardinality, context) => {
          if (cardinality.minimum > cardinality.ideal || cardinality.ideal > cardinality.maximum) {
            context.addIssue({
              code: "custom",
              path: ["ideal"],
              message:
                "Commercial homepage content cardinality must satisfy minimum <= ideal <= maximum.",
            });
          }
        }),
    ),
    evidenceRequirements: z.array(
      z
        .object({
          slotId: z.string().trim().min(1).max(80),
          authority: z.enum([
            "canonical-commerce",
            "approved-merchant-evidence",
            "approved-media",
            "none",
          ]),
          unsatisfiedPolicy: z.enum(["fail-closed", "omit"]),
        })
        .strict(),
    ),
    responsiveArchitecture: z.tuple([
      z
        .object({
          breakpoint: z.literal("mobile"),
          viewport: z.literal(375),
          transformationIds: z.array(z.string().trim().min(1).max(80)),
        })
        .strict(),
      z
        .object({
          breakpoint: z.literal("tablet"),
          viewport: z.literal(768),
          transformationIds: z.array(z.string().trim().min(1).max(80)),
        })
        .strict(),
      z
        .object({
          breakpoint: z.literal("desktop"),
          viewport: z.literal(1024),
          transformationIds: z.array(z.string().trim().min(1).max(80)),
        })
        .strict(),
      z
        .object({
          breakpoint: z.literal("wide"),
          viewport: z.literal(1440),
          transformationIds: z.array(z.string().trim().min(1).max(80)),
        })
        .strict(),
    ]),
    designDnaNarrowing: z
      .object({
        spacingDensity: z.array(z.enum(["compact", "standard", "spacious"])).min(1),
        surfaceDepth: z.array(z.enum(["flat", "subtle", "layered"])).min(1),
        imagePosture: z.array(z.enum(["contained", "editorial", "immersive"])).min(1),
      })
      .strict(),
    structuralSignature: commercialHomepageFingerprintSchema,
    structuralFingerprint: commercialHomepageFingerprintSchema,
  })
  .strict()
  .superRefine((authority, context) => {
    if (
      !authority.compatibleSharedFrameProfileIds.includes(authority.defaultSharedFrameProfileId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["defaultSharedFrameProfileId"],
        message: "The default shared frame must be one of the profile-compatible frames.",
      });
    }
    for (const [path, values] of [
      ["compatibleSharedFrameProfileIds", authority.compatibleSharedFrameProfileIds],
      ["sectionCardinality", authority.sectionCardinality.map((entry) => entry.slotId)],
      [
        "contentCardinality",
        authority.contentCardinality.map((entry) => `${entry.slotId}:${entry.resource}`),
      ],
      [
        "evidenceRequirements",
        authority.evidenceRequirements.map((entry) => `${entry.slotId}:${entry.authority}`),
      ],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: [path],
          message: "Commercial homepage authority entries must be unique.",
        });
      }
    }
  });

/**
 * Registered presentation authority for the single canonical collection/search
 * commerce component. It deliberately describes a PageBlueprint profile rather
 * than introducing a collection, search, membership, or filter data model.
 */
export const commercialCollectionSearchProfileAuthoritySchema = z
  .object({
    family: z.literal("commercial-collection-search"),
    compatibleSharedFrameProfileIds: z.array(commercialSharedFrameProfileIdSchema).min(1),
    defaultSharedFrameProfileId: commercialSharedFrameProfileIdSchema,
    presentationMode: z.enum([
      "editorial-discovery",
      "catalogue-comparison",
      "campaign-led-discovery",
      "dense-search",
    ]),
    productCardAnatomyId: canonicalProductCardAnatomyIdSchema,
    gridDensity: z.enum(["compact", "standard", "spacious"]),
    filterLayout: z.enum(["sidebar", "horizontal"]),
    childCollectionTreatment: z.enum(["editorial-discovery", "navigation", "compact", "omit"]),
    resultsTreatment: z.enum(["curated", "comparison", "campaign-transition", "dense-scan"]),
    campaignEvidencePolicy: z.enum(["not-required", "approved-editorial-media-required"]),
    responsiveArchitecture: z.tuple([
      z
        .object({
          breakpoint: z.literal("mobile"),
          viewport: z.literal(375),
          transformationIds: z.array(z.string().trim().min(1).max(80)),
        })
        .strict(),
      z
        .object({
          breakpoint: z.literal("tablet"),
          viewport: z.literal(768),
          transformationIds: z.array(z.string().trim().min(1).max(80)),
        })
        .strict(),
      z
        .object({
          breakpoint: z.literal("desktop"),
          viewport: z.literal(1024),
          transformationIds: z.array(z.string().trim().min(1).max(80)),
        })
        .strict(),
      z
        .object({
          breakpoint: z.literal("wide"),
          viewport: z.literal(1440),
          transformationIds: z.array(z.string().trim().min(1).max(80)),
        })
        .strict(),
    ]),
    designDnaNarrowing: z
      .object({
        spacingDensity: z.array(z.enum(["compact", "standard", "spacious"])).min(1),
        surfaceDepth: z.array(z.enum(["flat", "subtle", "layered"])).min(1),
        imagePosture: z.array(z.enum(["contained", "editorial", "immersive"])).min(1),
      })
      .strict(),
    structuralSignature: commercialCollectionSearchFingerprintSchema,
    structuralFingerprint: commercialCollectionSearchFingerprintSchema,
  })
  .strict()
  .superRefine((authority, context) => {
    if (
      !authority.compatibleSharedFrameProfileIds.includes(authority.defaultSharedFrameProfileId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["defaultSharedFrameProfileId"],
        message: "The default shared frame must be one of the profile-compatible frames.",
      });
    }
    if (
      (authority.presentationMode === "campaign-led-discovery") !==
      (authority.campaignEvidencePolicy === "approved-editorial-media-required")
    ) {
      context.addIssue({
        code: "custom",
        path: ["campaignEvidencePolicy"],
        message: "Only campaign-led discovery may require approved editorial media.",
      });
    }
  });

const pageBlueprintComponentSelectionSchema = z
  .object({
    slotId: z.string().trim().min(1).max(80),
    component: z.string().trim().min(1).max(80),
    variants: z.array(z.string().trim().min(1).max(80)).min(1),
    defaultVariant: z.string().trim().min(1).max(80),
  })
  .strict()
  .superRefine((selection, context) => {
    if (new Set(selection.variants).size !== selection.variants.length) {
      context.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Profile variants must be unique.",
      });
    }
    if (!selection.variants.includes(selection.defaultVariant)) {
      context.addIssue({
        code: "custom",
        path: ["defaultVariant"],
        message: "The profile default variant must be registered.",
      });
    }
  });

/**
 * A profile is metadata on the canonical PageBlueprint page plan. It is deliberately
 * not a second page tree, persisted storefront shape, or renderer projection.
 */
export const executablePageBlueprintProfileSchema = z
  .object({
    id: pageBlueprintFlowRuleIdSchema,
    version: pageBlueprintProfileVersionSchema,
    scope: pageTypeSchema,
    orderedNarrativeRoles: z.array(narrativeRoleSchema),
    roleCardinality: z.array(
      z
        .object({
          role: narrativeRoleSchema,
          minimum: z.number().int().nonnegative(),
          maximum: z.number().int().positive(),
        })
        .strict()
        .superRefine((cardinality, context) => {
          if (cardinality.maximum < cardinality.minimum) {
            context.addIssue({
              code: "custom",
              path: ["maximum"],
              message: "Role maximum cannot be lower than its minimum.",
            });
          }
        }),
    ),
    componentSelections: z.array(pageBlueprintComponentSelectionSchema),
    parameterDefaults: z
      .record(z.string().trim().min(1).max(80), z.union([z.string(), z.number()]))
      .default({}),
    requiredBindingCategories: z.array(commerceBindingSourceTypeSchema).default([]),
    requiredAssetRoles: z.array(assetRoleSchema).default([]),
    responsiveBreakpoints: z.tuple([
      z.literal("mobile"),
      z.literal("tablet"),
      z.literal("desktop"),
      z.literal("wide"),
    ]),
    accessibilityContract: z.literal("registered-component-contracts"),
    commercialHomepage: commercialHomepageProfileAuthoritySchema.optional(),
    commercialCollectionSearch: commercialCollectionSearchProfileAuthoritySchema.optional(),
  })
  .strict()
  .superRefine((profile, context) => {
    const roles = profile.roleCardinality.map((entry) => entry.role);
    if (new Set(roles).size !== roles.length) {
      context.addIssue({
        code: "custom",
        path: ["roleCardinality"],
        message: "Profile role cardinalities must be unique.",
      });
    }
    const slots = profile.componentSelections.map((entry) => entry.slotId);
    if (new Set(slots).size !== slots.length) {
      context.addIssue({
        code: "custom",
        path: ["componentSelections"],
        message: "Profile component slots must be unique.",
      });
    }
  });

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
    slots: z.array(storefrontTemplateSlotSchema),
    pageBlueprint: pageBlueprintCompositionContractSchema.default(
      defaultPageBlueprintCompositionContract,
    ),
    profile: executablePageBlueprintProfileSchema.optional(),
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
export type ExecutablePageBlueprintProfile = z.infer<typeof executablePageBlueprintProfileSchema>;
export type CommercialHomepageProfileAuthority = z.infer<
  typeof commercialHomepageProfileAuthoritySchema
>;
export type CommercialCollectionSearchProfileAuthority = z.infer<
  typeof commercialCollectionSearchProfileAuthoritySchema
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
