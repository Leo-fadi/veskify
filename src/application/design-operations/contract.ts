import { z } from "zod";
import { registeredTokenRefinementPlanSchema } from "@/application/storefront-design-system/token-refinement";
import {
  ctaPresentationSchema,
  sectionAlignmentSchema,
  sectionBackgroundSchema,
  sectionDensitySchema,
  sectionShapeSchema,
  sectionTypographySchema,
} from "@/components/registry/design-vocabulary";
import { brandSystemSchema } from "@/domain/design-system";
import { idSchema, localeSchema, localizedTextSchema } from "@/domain/shared";
import { pageModelSchema, sectionInstanceSchema } from "@/domain/storefront";

const sectionTargetSchema = z.object({ sectionId: idSchema }).strict();

export const changeLocalizedSectionTextOperationSchema = sectionTargetSchema
  .extend({
    type: z.literal("CHANGE_LOCALIZED_SECTION_TEXT"),
    field: z.string().min(1).max(80),
    locale: localeSchema,
    value: z.string().min(1).max(2_000),
  })
  .strict();
export const changeSectionVariantOperationSchema = sectionTargetSchema
  .extend({ type: z.literal("CHANGE_SECTION_VARIANT"), variant: z.string().min(1).max(80) })
  .strict();

export const changeBackgroundOperationSchema = sectionTargetSchema
  .extend({ type: z.literal("CHANGE_BACKGROUND"), background: sectionBackgroundSchema })
  .strict();
export const changeTypographyOperationSchema = sectionTargetSchema
  .extend({ type: z.literal("CHANGE_TYPOGRAPHY"), typography: sectionTypographySchema })
  .strict();
export const changeDensityOperationSchema = sectionTargetSchema
  .extend({ type: z.literal("CHANGE_DENSITY"), density: sectionDensitySchema })
  .strict();
export const changeShapeOperationSchema = sectionTargetSchema
  .extend({ type: z.literal("CHANGE_SHAPE"), shape: sectionShapeSchema })
  .strict();
export const changeAlignmentOperationSchema = sectionTargetSchema
  .extend({ type: z.literal("CHANGE_ALIGNMENT"), alignment: sectionAlignmentSchema })
  .strict();
export const changeCtaStyleOperationSchema = sectionTargetSchema
  .extend({ type: z.literal("CHANGE_CTA_STYLE"), ctaPresentation: ctaPresentationSchema })
  .strict();

export const applyApprovedBrandColoursOperationSchema = z
  .object({
    type: z.literal("APPLY_APPROVED_BRAND_COLOURS"),
    colors: brandSystemSchema.shape.colors,
  })
  .strict();
export const applyApprovedBrandTypographyOperationSchema = z
  .object({
    type: z.literal("APPLY_APPROVED_BRAND_TYPOGRAPHY"),
    typography: brandSystemSchema.shape.typography,
  })
  .strict();
export const applyRegisteredBrandSystemOperationSchema = z
  .object({
    type: z.literal("APPLY_REGISTERED_BRAND_SYSTEM"),
    directionId: z.enum(["premiumEditorial", "modernTechnical", "warmApproachable"]).optional(),
    designSystemNarrowing: z
      .object({
        spacingDensity: z.enum(["compact", "standard", "spacious"]),
        surfaceDepth: z.enum(["flat", "subtle", "layered"]),
      })
      .strict()
      .optional(),
    refinementId: z.literal("validatedTokenRefinement").optional(),
    tokenRefinementPlan: registeredTokenRefinementPlanSchema.optional(),
    brandSystem: brandSystemSchema,
  })
  .strict()
  .superRefine((operation, context) => {
    if ((operation.directionId === undefined) === (operation.refinementId === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["directionId"],
        message:
          "A registered BrandSystem operation must identify one direction or validated token refinement.",
      });
    }
    if (
      (operation.refinementId === "validatedTokenRefinement") !==
      (operation.tokenRefinementPlan !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["tokenRefinementPlan"],
        message:
          "Only a validated token-refinement operation may include its canonical token plan.",
      });
    }
    if (operation.designSystemNarrowing !== undefined && operation.directionId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["designSystemNarrowing"],
        message:
          "Only a registered direction operation may include bounded design-system narrowing.",
      });
    }
  });
export const addApprovedSectionOperationSchema = z
  .object({
    type: z.literal("ADD_APPROVED_SECTION"),
    sectionId: idSchema,
    component: z.string().min(1).max(80),
    variant: z.string().min(1).max(80).optional(),
    index: z.number().int().nonnegative().optional(),
  })
  .strict();
export const removeOptionalSectionOperationSchema = sectionTargetSchema
  .extend({ type: z.literal("REMOVE_OPTIONAL_SECTION") })
  .strict();
export const reorderSectionsOperationSchema = z
  .object({ type: z.literal("REORDER_SECTIONS"), sectionIds: z.array(idSchema).min(1) })
  .strict();
export const applyRegisteredPageSectionsOperationSchema = z
  .object({
    type: z.literal("APPLY_REGISTERED_PAGE_SECTIONS"),
    sections: z.array(sectionInstanceSchema).min(1).max(200),
    removedSectionIds: z.array(idSchema).max(200),
  })
  .strict();

export const designOperationSchema = z.discriminatedUnion("type", [
  changeLocalizedSectionTextOperationSchema,
  changeSectionVariantOperationSchema,
  changeBackgroundOperationSchema,
  changeTypographyOperationSchema,
  changeDensityOperationSchema,
  changeShapeOperationSchema,
  changeAlignmentOperationSchema,
  changeCtaStyleOperationSchema,
  applyApprovedBrandColoursOperationSchema,
  applyApprovedBrandTypographyOperationSchema,
  applyRegisteredBrandSystemOperationSchema,
  addApprovedSectionOperationSchema,
  removeOptionalSectionOperationSchema,
  reorderSectionsOperationSchema,
  applyRegisteredPageSectionsOperationSchema,
]);

export type DesignOperation = z.infer<typeof designOperationSchema>;
export const homepageRedesignIntentSchema = z
  .object({
    direction: z.enum(["luxury", "minimal", "bold"]),
    includeCampaign: z.boolean(),
    campaignSectionId: idSchema.optional(),
  })
  .strict();
export const proposalValidationResultSchema = z
  .object({ valid: z.boolean(), errors: z.array(z.string()) })
  .strict();
export const designProposalSchema = z
  .object({
    id: z.string().regex(/^proposal_[a-f0-9]{8}$/),
    originalPage: pageModelSchema,
    proposedPage: pageModelSchema,
    operations: z.array(designOperationSchema),
    summary: localizedTextSchema,
    validation: proposalValidationResultSchema,
    status: z.enum(["pending", "accepted", "rejected"]),
  })
  .strict();

export type ProposalValidationResult = z.infer<typeof proposalValidationResultSchema>;
export type DesignProposal = z.infer<typeof designProposalSchema>;
