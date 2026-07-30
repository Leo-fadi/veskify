import { z } from "zod";
import { storefrontDesignDirectionComponentSelectionsSchema } from "@/application/storefront-design-system/contract";
import {
  approvedAssetPlacementOperationSchema,
  approvedGenerationAssetContextSchema,
} from "@/application/ai-storefront-generation";
import {
  componentDefinitionV2Schema,
  componentInstanceV2Schema,
  presentationBindingSchema,
} from "@/domain/component-platform";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { storefrontDesignBriefContractSchema } from "@/domain/source-discovery";
import { localeSchema, idSchema } from "@/domain/shared";
import { canonicalValueFingerprint, storefrontSnapshotSchema } from "@/domain/storefront";
import { storefrontTemplateDefinitionSchema } from "@/application/storefront-templates";
import {
  registeredTokenRefinementPlanSchema,
  storefrontDesignSystemV1Schema,
} from "@/application/storefront-design-system";

export const WHOLE_STOREFRONT_GENERATION_PLAN_SCHEMA_VERSION = 1 as const;

const fingerprintSchema = z.string().trim().min(1).max(240);
const componentVersionReferenceSchema = z
  .object({
    type: z.string().trim().min(1).max(80),
    version: z
      .object({
        major: z.number().int().positive(),
        minor: z.number().int().nonnegative(),
        patch: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

/**
 * The approved page and section recipes are owned by the storefront-template
 * registry.  Whole-storefront planning consumes that existing contract rather
 * than maintaining a second recipe vocabulary.
 */
export const wholeStorefrontRecipeContextSchema = z
  .object({
    templates: z.array(storefrontTemplateDefinitionSchema).min(1),
    designSystem: storefrontDesignSystemV1Schema,
    fingerprint: fingerprintSchema,
  })
  .strict()
  .superRefine((context, refinement) => {
    const templates = [...context.templates].sort((left, right) => left.id.localeCompare(right.id));
    if (
      context.fingerprint !==
      `storefront-recipes-${canonicalValueFingerprint({
        templates,
        designSystem: context.designSystem,
      })}`
    ) {
      refinement.addIssue({
        code: "custom",
        path: ["fingerprint"],
        message: "The approved storefront recipe context fingerprint is stale.",
      });
    }
  });

export const wholeStorefrontProjectTargetSchema = z
  .object({
    id: idSchema,
    revision: z.number().int().nonnegative(),
    enabledLocales: z.array(localeSchema).min(1),
  })
  .strict()
  .superRefine((project, context) => {
    if (new Set(project.enabledLocales).size !== project.enabledLocales.length) {
      context.addIssue({
        code: "custom",
        path: ["enabledLocales"],
        message: "Project locales must be unique.",
      });
    }
  });

export const wholeStorefrontPlanningInputSchema = z
  .object({
    brief: storefrontDesignBriefContractSchema,
    project: wholeStorefrontProjectTargetSchema,
    draft: storefrontSnapshotSchema,
    catalogue: catalogueDisplayModelSchema,
    componentDefinitions: z.array(componentDefinitionV2Schema).min(1),
    recipeContext: wholeStorefrontRecipeContextSchema,
    approvedAssetContext: approvedGenerationAssetContextSchema.nullable(),
    requiredAssetPlacements: z.array(approvedAssetPlacementOperationSchema).default([]),
  })
  .strict();

export const wholeStorefrontPageRoleSchema = z.enum([
  "homepage",
  "collection-template",
  "product-template",
  "other",
]);

export const wholeStorefrontTargetSchema = z
  .object({
    projectId: idSchema,
    projectRevision: z.number().int().nonnegative(),
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    activeDraftFingerprint: fingerprintSchema,
    supportedLocales: z.array(localeSchema).min(1),
    pages: z
      .array(
        z
          .object({
            id: idSchema,
            role: wholeStorefrontPageRoleSchema,
            type: z.enum([
              "home",
              "collection",
              "product",
              "content",
              "cart",
              "checkout",
              "landing",
            ]),
            sections: z
              .array(
                z
                  .object({
                    id: idSchema,
                    component: z.string().trim().min(1).max(80),
                    variant: z.string().trim().min(1).max(80),
                    visible: z.boolean(),
                  })
                  .strict(),
              )
              .max(200),
          })
          .strict(),
      )
      .min(1),
    navigation: z.array(
      z
        .object({
          id: idSchema,
          area: z.enum(["primary", "footer"]),
          target: z.union([
            z.object({ type: z.literal("page"), pageId: idSchema }).strict(),
            z.object({ type: z.literal("external") }).strict(),
          ]),
        })
        .strict(),
    ),
    productIds: z.array(idSchema),
    collections: z.array(z.object({ id: idSchema, productIds: z.array(idSchema) }).strict()),
    componentDefinitions: z.array(componentVersionReferenceSchema).min(1),
    registryFingerprint: fingerprintSchema,
    recipeFingerprint: fingerprintSchema,
    brandSystemFingerprint: fingerprintSchema,
    canonicalCommerceFingerprint: fingerprintSchema,
    approvedAssetContextFingerprint: fingerprintSchema.nullable(),
    fingerprint: fingerprintSchema,
  })
  .strict();

const wholeStorefrontRetainedComponentPlanSchema = z
  .object({
    disposition: z.enum(["retained", "fallback-retained"]),
    componentId: idSchema,
    component: z.string().trim().min(1).max(80),
    componentVersion: z
      .object({
        major: z.number().int().positive(),
        minor: z.number().int().nonnegative(),
        patch: z.number().int().nonnegative(),
      })
      .strict(),
    variant: z.string().trim().min(1).max(80),
    preservesExistingContent: z.literal(true),
  })
  .strict();

const wholeStorefrontGeneratedComponentPlanSchema = z
  .object({
    disposition: z.enum(["added", "replacement"]),
    instance: componentInstanceV2Schema,
    replacesComponentIds: z.array(idSchema).default([]),
  })
  .strict();

export const wholeStorefrontComponentPlanSchema = z.union([
  wholeStorefrontRetainedComponentPlanSchema,
  wholeStorefrontGeneratedComponentPlanSchema,
]);

export const wholeStorefrontPagePlanSchema = z
  .object({
    pageId: idSchema,
    role: wholeStorefrontPageRoleSchema,
    disposition: z.enum(["retained", "created", "fallback-retained"]),
    familyRequirements: z.array(z.string().trim().min(1).max(80)),
    components: z.array(wholeStorefrontComponentPlanSchema),
    compatibilityNotes: z.array(z.string().trim().min(1).max(240)),
  })
  .strict();

export const wholeStorefrontSharedDesignDirectionSchema = z
  .object({
    brandSystemFingerprint: fingerprintSchema,
    preferredBrandColours: z.array(z.string().trim().min(1).max(40)),
    typographyDirection: z.string().trim().min(1).max(120),
    visualStyleDirection: z.string().trim().min(1).max(120),
    imageryDirection: z.string().trim().min(1).max(120),
    toneKeywords: z.array(z.string().trim().min(1).max(80)),
    consistencyRules: z.array(z.string().trim().min(1).max(240)).min(1),
  })
  .strict();

export const wholeStorefrontSharedChromePlanSchema = z
  .object({
    headerComponentIds: z.array(idSchema),
    footerComponentIds: z.array(idSchema),
    navigationItemIds: z.array(idSchema),
    buttonHierarchy: z.literal("shared-brand-system"),
    headingHierarchy: z.literal("shared-brand-system"),
  })
  .strict();

export const wholeStorefrontDesignSystemSelectionSchema = z
  .object({
    directionVersion: z.literal("1.0.0"),
    directionId: z.enum(["premiumEditorial", "modernTechnical", "warmApproachable"]),
    homepageRecipeId: z.string().trim().min(1).max(80),
    collectionRecipeId: z.string().trim().min(1).max(80),
    productRecipeId: z.string().trim().min(1).max(80),
    typographyDirectionId: z.string().trim().min(1).max(80),
    imageTreatmentId: z.string().trim().min(1).max(80),
    productCardFamilyId: z.string().trim().min(1).max(80),
    spacingDensity: z.enum(["compact", "standard", "spacious"]),
    cornerTreatment: z.enum(["square", "soft", "rounded"]),
    surfaceDepth: z.enum(["flat", "subtle", "layered"]),
    componentSelections: storefrontDesignDirectionComponentSelectionsSchema,
    collectionPresentation: z
      .object({
        variant: z.enum(["standard", "editorial", "compact", "gallery"]),
        gridDensity: z.enum(["compact", "standard", "spacious"]),
        cardVariant: z.enum(["standard", "editorial", "compact", "imageFirst", "horizontal"]),
        filterLayout: z.enum(["sidebar", "horizontal"]),
      })
      .strict(),
    productPresentation: z
      .object({
        variant: z.enum(["balanced", "editorial", "compact", "galleryDominant", "editorialSplit"]),
        galleryLayout: z.enum(["thumbnails", "grid"]),
        optionDensity: z.enum(["compact", "comfortable"]),
        attributeLayout: z.enum(["groups", "table"]),
        mediaTreatment: z.enum(["contained", "crop", "editorial"]),
      })
      .strict(),
  })
  .strict();

export const wholeStorefrontReviewItemSchema = z
  .object({
    code: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(500),
    severity: z.enum(["warning", "required-review"]),
  })
  .strict();

export const wholeStorefrontReviewSummarySchema = z
  .object({
    sharedDesignSystemChanges: z.array(z.string().trim().min(1).max(240)),
    pages: z.array(
      z
        .object({
          pageId: idSchema,
          disposition: z.enum(["retained", "created", "fallback-retained"]),
        })
        .strict(),
    ),
    components: z.array(
      z
        .object({
          componentId: idSchema,
          component: z.string().trim().min(1).max(80),
          disposition: z.enum(["retained", "added", "replacement", "fallback-retained"]),
        })
        .strict(),
    ),
    canonicalBindings: z.array(presentationBindingSchema),
    approvedAssetPlacements: z.array(approvedAssetPlacementOperationSchema),
    protectedFactsPreserved: z.array(z.string().trim().min(1).max(240)).min(1),
    warnings: z.array(wholeStorefrontReviewItemSchema),
    requiredMerchantReviewItems: z.array(wholeStorefrontReviewItemSchema),
  })
  .strict();

export const wholeStorefrontGenerationPlanSchema = z
  .object({
    schemaVersion: z.literal(WHOLE_STOREFRONT_GENERATION_PLAN_SCHEMA_VERSION),
    id: idSchema,
    requestFingerprint: fingerprintSchema,
    target: wholeStorefrontTargetSchema,
    briefId: idSchema,
    briefRevision: z.number().int().positive(),
    evidenceFingerprint: fingerprintSchema,
    approvedAssetContextFingerprint: fingerprintSchema.nullable(),
    componentRegistryFingerprint: fingerprintSchema,
    recipeContextFingerprint: fingerprintSchema,
    languagePlan: z
      .object({
        primaryLanguage: localeSchema,
        selectedLanguages: z.array(localeSchema).min(1),
        missingTranslationPolicy: z.literal("explicit-generation-or-merchant-review"),
      })
      .strict(),
    requestClass: z.enum(["coordinatedStructuralDirection", "tokenOnlyRefinement"]),
    tokenRefinementPlan: registeredTokenRefinementPlanSchema.nullable(),
    designSystemSelection: wholeStorefrontDesignSystemSelectionSchema,
    sharedDesignDirection: wholeStorefrontSharedDesignDirectionSchema,
    sharedChrome: wholeStorefrontSharedChromePlanSchema,
    pagePlans: z.array(wholeStorefrontPagePlanSchema).min(1),
    canonicalCommerceBindings: z.array(presentationBindingSchema),
    approvedAssetPlacements: z.array(approvedAssetPlacementOperationSchema),
    navigationChanges: z.array(
      z.object({ navigationItemId: idSchema, disposition: z.literal("retained") }).strict(),
    ),
    warnings: z.array(wholeStorefrontReviewItemSchema),
    requiredMerchantReviewItems: z.array(wholeStorefrontReviewItemSchema),
    reviewSummary: wholeStorefrontReviewSummarySchema,
    fingerprint: fingerprintSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    if ((plan.requestClass === "tokenOnlyRefinement") !== (plan.tokenRefinementPlan !== null)) {
      context.addIssue({
        code: "custom",
        path: ["tokenRefinementPlan"],
        message: "Token-only plans must carry one validated token-refinement contract.",
      });
    }
    const pageIds = plan.pagePlans.map((page) => page.pageId);
    if (new Set(pageIds).size !== pageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["pagePlans"],
        message: "Whole-storefront page plans must use unique page IDs.",
      });
    }
    const componentIds = plan.pagePlans.flatMap((page) =>
      page.components.map((component) =>
        "instance" in component ? component.instance.id : component.componentId,
      ),
    );
    const permittedReplacementIdentity = (componentId: string) => {
      const matches = plan.pagePlans.flatMap((page) =>
        page.components.filter((component) =>
          "instance" in component
            ? component.instance.id === componentId
            : component.componentId === componentId,
        ),
      );
      return (
        matches.length === 2 &&
        matches.some((component) => "componentId" in component) &&
        matches.some(
          (component) =>
            "instance" in component &&
            component.disposition === "replacement" &&
            component.replacesComponentIds.includes(componentId),
        )
      );
    };
    if (
      [...new Set(componentIds)].some(
        (componentId) =>
          componentIds.filter((candidate) => candidate === componentId).length > 1 &&
          !permittedReplacementIdentity(componentId),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["pagePlans"],
        message: "Whole-storefront component plans must use unique component IDs.",
      });
    }
  });

export type WholeStorefrontPlanningInput = z.infer<typeof wholeStorefrontPlanningInputSchema>;
export type WholeStorefrontRecipeContext = z.infer<typeof wholeStorefrontRecipeContextSchema>;
export type WholeStorefrontGenerationTarget = z.infer<typeof wholeStorefrontTargetSchema>;
export type WholeStorefrontGenerationPlan = z.infer<typeof wholeStorefrontGenerationPlanSchema>;
export type WholeStorefrontReviewSummary = z.infer<typeof wholeStorefrontReviewSummarySchema>;

export type WholeStorefrontGenerationPlanErrorCode =
  | "no-approved-brief"
  | "stale-brief"
  | "missing-canonical-project-target"
  | "stale-project-revision"
  | "missing-canonical-commerce-projection"
  | "unknown-commerce-binding"
  | "unsupported-page-family"
  | "unknown-component"
  | "incompatible-component-version"
  | "invalid-component-contract"
  | "missing-required-recipe-content"
  | "missing-required-recipe-asset"
  | "missing-required-asset-placement"
  | "stale-approved-asset"
  | "asset-role-slot-incompatible"
  | "provider-invented-target"
  | "missing-required-locale"
  | "provider-incapable"
  | "stale-result";

export class WholeStorefrontGenerationPlanError extends Error {
  constructor(
    readonly code: WholeStorefrontGenerationPlanErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WholeStorefrontGenerationPlanError";
  }
}
