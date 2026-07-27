import { z } from "zod";
import {
  getComponentDefinition,
  validateRegisteredPage,
  type StorefrontRenderContext,
} from "@/components/registry";
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
import {
  pageModelSchema,
  sectionInstanceSchema,
  type PageModel,
  type SectionInstance,
} from "@/domain/storefront";

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
  addApprovedSectionOperationSchema,
  removeOptionalSectionOperationSchema,
  reorderSectionsOperationSchema,
  applyRegisteredPageSectionsOperationSchema,
]);

export type DesignOperation = z.infer<typeof designOperationSchema>;
export type DesignOperationContext = StorefrontRenderContext;

function sectionIndex(page: PageModel, sectionId: string) {
  const index = page.sections.findIndex((section) => section.id === sectionId);
  if (index < 0) throw new Error(`Unknown section: ${sectionId}.`);
  return index;
}

function assertGlobalComposition(original: PageModel, candidate: PageModel) {
  for (const component of ["header", "footer"] as const) {
    const expected = original.sections.filter((section) => section.component === component).length;
    const actual = candidate.sections.filter((section) => section.component === component).length;
    if (actual !== expected)
      throw new Error(`Design operations must preserve the page ${component}.`);
  }
  const footerIndex = candidate.sections.findIndex((section) => section.component === "footer");
  if (footerIndex >= 0 && footerIndex !== candidate.sections.length - 1) {
    throw new Error("The footer must remain the final page section.");
  }
  const headerIndex = candidate.sections.findIndex((section) => section.component === "header");
  if (
    headerIndex >= 0 &&
    candidate.sections
      .slice(0, headerIndex)
      .some((section) => section.component !== "announcementBar")
  ) {
    throw new Error("Only announcement bars may precede the page header.");
  }
}

function assertProtectedChromeIdentity(original: PageModel, candidate: PageModel) {
  for (const component of ["header", "footer"] as const) {
    const expected = original.sections.find((section) => section.component === component);
    const actual = candidate.sections.find((section) => section.component === component);
    if (
      expected &&
      (!actual ||
        actual.id !== expected.id ||
        JSON.stringify(actual.content) !== JSON.stringify(expected.content))
    ) {
      throw new Error(`Registered page composition must preserve the ${component} identity.`);
    }
  }
}

function validateResult(
  original: PageModel,
  candidate: PageModel,
  context?: DesignOperationContext,
) {
  const parsed = pageModelSchema.parse(candidate);
  assertGlobalComposition(original, parsed);
  validateRegisteredPage(parsed, context);
  return parsed;
}

function patchSectionProperty(
  page: PageModel,
  sectionId: string,
  property: string,
  value: unknown,
) {
  const index = sectionIndex(page, sectionId);
  page.sections[index] = {
    ...page.sections[index],
    props: { ...page.sections[index].props, [property]: value },
  };
}

function applyDesignOperationInternal(
  input: PageModel,
  operationInput: unknown,
  context?: DesignOperationContext,
): PageModel {
  const original = pageModelSchema.parse(structuredClone(input));
  const operation = designOperationSchema.parse(operationInput);
  const candidate = structuredClone(original);

  switch (operation.type) {
    case "CHANGE_LOCALIZED_SECTION_TEXT": {
      const index = sectionIndex(candidate, operation.sectionId);
      const section = candidate.sections[index];
      const definition = getComponentDefinition(section.component);
      const field = definition.editorFields[operation.field];
      if (!field || field.source !== "content" || !field.localized) {
        throw new Error(`Field ${operation.field} is not approved localized section text.`);
      }
      const current = localizedTextSchema.parse(section.content[operation.field]);
      candidate.sections[index] = {
        ...section,
        content: {
          ...section.content,
          [operation.field]: { ...current, [operation.locale]: operation.value },
        },
      };
      break;
    }
    case "CHANGE_SECTION_VARIANT": {
      const index = sectionIndex(candidate, operation.sectionId);
      candidate.sections[index] = { ...candidate.sections[index], variant: operation.variant };
      break;
    }
    case "CHANGE_BACKGROUND":
      patchSectionProperty(candidate, operation.sectionId, "background", operation.background);
      break;
    case "CHANGE_TYPOGRAPHY":
      patchSectionProperty(candidate, operation.sectionId, "typography", operation.typography);
      break;
    case "CHANGE_DENSITY":
      patchSectionProperty(candidate, operation.sectionId, "density", operation.density);
      break;
    case "CHANGE_SHAPE":
      patchSectionProperty(candidate, operation.sectionId, "shape", operation.shape);
      break;
    case "CHANGE_ALIGNMENT":
      patchSectionProperty(candidate, operation.sectionId, "alignment", operation.alignment);
      break;
    case "CHANGE_CTA_STYLE":
      patchSectionProperty(
        candidate,
        operation.sectionId,
        "ctaPresentation",
        operation.ctaPresentation,
      );
      break;
    case "APPLY_APPROVED_BRAND_COLOURS":
      candidate.themeOverride = { ...candidate.themeOverride, colors: operation.colors };
      break;
    case "APPLY_APPROVED_BRAND_TYPOGRAPHY":
      candidate.themeOverride = { ...candidate.themeOverride, typography: operation.typography };
      break;
    case "ADD_APPROVED_SECTION": {
      if (candidate.sections.some((section) => section.id === operation.sectionId)) {
        throw new Error(`Section ID already exists: ${operation.sectionId}.`);
      }
      const definition = getComponentDefinition(operation.component);
      const section: SectionInstance = {
        id: operation.sectionId,
        component: definition.type,
        variant: operation.variant ?? definition.defaultVariant,
        visible: true,
        content: structuredClone(definition.defaultContent),
        props: structuredClone(definition.defaultProps),
      };
      definition.validate(section, candidate.type, context);
      const footerIndex = candidate.sections.findIndex((item) => item.component === "footer");
      const fallbackIndex = footerIndex < 0 ? candidate.sections.length : footerIndex;
      const index = operation.index ?? fallbackIndex;
      candidate.sections.splice(index, 0, section);
      break;
    }
    case "REMOVE_OPTIONAL_SECTION": {
      const index = sectionIndex(candidate, operation.sectionId);
      const component = candidate.sections[index].component;
      if (component === "header" || component === "footer") {
        throw new Error(`The required ${component} cannot be removed.`);
      }
      candidate.sections.splice(index, 1);
      break;
    }
    case "REORDER_SECTIONS": {
      const existingIds = candidate.sections.map((section) => section.id);
      if (
        operation.sectionIds.length !== existingIds.length ||
        new Set(operation.sectionIds).size !== existingIds.length ||
        existingIds.some((id) => !operation.sectionIds.includes(id))
      ) {
        throw new Error("Reorder must contain every section ID exactly once.");
      }
      const byId = new Map(candidate.sections.map((section) => [section.id, section]));
      candidate.sections = operation.sectionIds.map((id) => structuredClone(byId.get(id)!));
      break;
    }
    case "APPLY_REGISTERED_PAGE_SECTIONS": {
      const originalIds = new Set(original.sections.map((section) => section.id));
      const nextIds = new Set(operation.sections.map((section) => section.id));
      const removedIds = original.sections
        .filter((section) => !nextIds.has(section.id))
        .map((section) => section.id)
        .sort();
      const declaredRemovedIds = [...operation.removedSectionIds].sort();
      if (
        new Set(declaredRemovedIds).size !== declaredRemovedIds.length ||
        JSON.stringify(removedIds) !== JSON.stringify(declaredRemovedIds)
      ) {
        throw new Error("Registered page composition must declare every removed section exactly.");
      }
      if (operation.sections.some((section) => !originalIds.has(section.id) && !section.visible)) {
        throw new Error("New registered sections must be visible when introduced.");
      }
      candidate.sections = structuredClone(operation.sections);
      assertProtectedChromeIdentity(original, candidate);
      break;
    }
  }

  return validateResult(original, candidate, context);
}

export function validateDesignOperationAgainstPage(
  input: PageModel,
  operationInput: unknown,
): PageModel {
  return applyDesignOperationInternal(input, operationInput);
}

export function applyDesignOperation(
  input: PageModel,
  operationInput: unknown,
  context: DesignOperationContext,
): PageModel {
  return applyDesignOperationInternal(input, operationInput, context);
}

export function applyDesignOperations(
  input: PageModel,
  operations: readonly DesignOperation[],
  context: DesignOperationContext,
): PageModel {
  return operations.reduce(
    (page, operation) => applyDesignOperation(page, operation, context),
    pageModelSchema.parse(structuredClone(input)),
  );
}

export const homepageRedesignIntentSchema = z
  .object({
    direction: z.enum(["luxury", "minimal", "bold"]),
    includeCampaign: z.boolean(),
    campaignSectionId: idSchema.optional(),
  })
  .strict();
export type HomepageRedesignIntent = z.infer<typeof homepageRedesignIntentSchema>;

const directionTokens = {
  luxury: { background: "background", typography: "serif", density: "spacious", shape: "soft" },
  minimal: { background: "surface", typography: "sans", density: "compact", shape: "square" },
  bold: { background: "accent", typography: "strong", density: "standard", shape: "rounded" },
} as const;

const luxuryVariants: Readonly<Record<string, string>> = {
  announcementBar: "minimal",
  header: "transparent",
  featuredCategories: "imageLed",
  productGrid: "editorial",
  campaignBanner: "imageOverlay",
  brandStory: "imageLed",
  benefitIcons: "cards",
  newsletter: "card",
  footer: "editorial",
};

function generatedSectionId(page: PageModel, base: string) {
  if (!page.sections.some((section) => section.id === base)) return base;
  let suffix = 2;
  while (page.sections.some((section) => section.id === `${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export function generateHomepageRedesign(
  input: PageModel,
  intentInput: HomepageRedesignIntent,
  context: DesignOperationContext,
): { page: PageModel; operations: DesignOperation[] } {
  const page = pageModelSchema.parse(structuredClone(input));
  if (page.type !== "home") throw new Error("Complete homepage redesign requires a home page.");
  const intent = homepageRedesignIntentSchema.parse(intentInput);
  const tokens = directionTokens[intent.direction];
  const operations: DesignOperation[] = [];

  for (const section of page.sections) {
    const definition = getComponentDefinition(section.component);
    const variant = intent.direction === "luxury" ? luxuryVariants[section.component] : undefined;
    if (variant && definition.variants.includes(variant)) {
      operations.push({ type: "CHANGE_SECTION_VARIANT", sectionId: section.id, variant });
    }
    for (const [type, property, value] of [
      ["CHANGE_BACKGROUND", "background", tokens.background],
      ["CHANGE_TYPOGRAPHY", "typography", tokens.typography],
      ["CHANGE_DENSITY", "density", tokens.density],
      ["CHANGE_SHAPE", "shape", tokens.shape],
    ] as const) {
      if (definition.editorFields[property]) {
        operations.push({ type, sectionId: section.id, [property]: value } as DesignOperation);
      }
    }
  }

  if (
    intent.includeCampaign &&
    !page.sections.some((section) => section.component === "campaignBanner")
  ) {
    const sectionId =
      intent.campaignSectionId ?? generatedSectionId(page, "section_home_campaign_generated");
    operations.push({
      type: "ADD_APPROVED_SECTION",
      sectionId,
      component: "campaignBanner",
      variant: intent.direction === "luxury" ? "imageOverlay" : undefined,
    });
    operations.push(
      { type: "CHANGE_BACKGROUND", sectionId, background: tokens.background },
      { type: "CHANGE_TYPOGRAPHY", sectionId, typography: tokens.typography },
      { type: "CHANGE_DENSITY", sectionId, density: tokens.density },
      { type: "CHANGE_SHAPE", sectionId, shape: tokens.shape },
    );
  }

  return { page: applyDesignOperations(page, operations, context), operations };
}
