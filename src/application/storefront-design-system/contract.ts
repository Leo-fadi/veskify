import { z } from "zod";
import { canonicalValueFingerprint } from "@/domain/storefront";

const tokenSchema = z.string().regex(/^[a-z][A-Za-z0-9-]*$/);
const localizedLabelSchema = z.object({ en: z.string().min(1), fi: z.string().min(1) }).strict();

export const storefrontDesignDirectionIdSchema = z.enum([
  "premiumEditorial",
  "modernTechnical",
  "warmApproachable",
]);

/**
 * Versioned, registered selections that must remain coordinated across the
 * homepage, collection and product-detail page. These are presentation
 * references, never executable component definitions.
 */
export const storefrontDesignDirectionComponentSelectionsSchema = z
  .object({
    header: z.object({ component: z.literal("header"), variant: tokenSchema }).strict(),
    hero: z.object({ component: z.literal("hero"), variant: tokenSchema }).strict(),
    collectionDiscovery: z
      .object({ component: z.literal("featuredCategories"), variant: tokenSchema })
      .strict(),
    productCard: z.object({ component: z.literal("productGrid"), variant: tokenSchema }).strict(),
    storytelling: z.object({ component: z.literal("brandStory"), variant: tokenSchema }).strict(),
    campaign: z.object({ component: z.literal("campaignBanner"), variant: tokenSchema }).strict(),
    trust: z.object({ component: z.literal("benefitIcons"), variant: tokenSchema }).strict(),
    footer: z.object({ component: z.literal("footer"), variant: tokenSchema }).strict(),
    collectionCommerce: z
      .object({ component: z.literal("dynamicCollectionCommerce"), variant: tokenSchema })
      .strict(),
    productDetail: z
      .object({ component: z.literal("dynamicProductDetail"), variant: tokenSchema })
      .strict(),
  })
  .strict();

const semanticSectionRecipeSchema = z
  .object({
    slot: tokenSchema,
    component: tokenSchema,
    variant: tokenSchema,
    required: z.boolean(),
    acceptedAssetRoles: z.array(tokenSchema),
  })
  .strict();

const pageRecipeSchema = z
  .object({
    id: tokenSchema,
    label: localizedLabelSchema,
    pageType: z.enum(["home", "collection", "product"]),
    sections: z.array(semanticSectionRecipeSchema).min(1),
    responsive: z
      .object({
        breakpoints: z.tuple([
          z.literal("mobile"),
          z.literal("tablet"),
          z.literal("desktop"),
          z.literal("wide"),
        ]),
        allowHorizontalOverflow: z.literal(false),
      })
      .strict(),
  })
  .strict()
  .superRefine((recipe, context) => {
    const slots = recipe.sections.map((section) => section.slot);
    if (new Set(slots).size !== slots.length) {
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "Recipe slots must be unique.",
      });
    }
    const headerIndex = recipe.sections.findIndex((section) => section.component === "header");
    if (
      headerIndex < 0 ||
      recipe.sections
        .slice(0, headerIndex)
        .some((section) => section.component !== "announcementBar")
    ) {
      context.addIssue({
        code: "custom",
        path: ["sections", Math.max(headerIndex, 0)],
        message: "Only an announcement bar may precede the header.",
      });
    }
    if (recipe.sections.at(-1)?.component !== "footer") {
      context.addIssue({ code: "custom", path: ["sections"], message: "Footer must be last." });
    }
  });

const typographyDirectionSchema = z
  .object({
    id: tokenSchema,
    label: localizedLabelSchema,
    headingFont: z.enum(["inter", "georgia", "system-sans", "system-serif"]),
    bodyFont: z.enum(["inter", "georgia", "system-sans", "system-serif"]),
    scaleRatio: z.number().min(1.125).max(1.5),
    readingWidth: z.enum(["narrow", "standard"]),
  })
  .strict();

const imageTreatmentSchema = z
  .object({
    id: z.enum(["fullBleed", "contained", "editorialCrop", "productNeutral", "split", "softFrame"]),
    label: localizedLabelSchema,
    canonicalMediaImmutable: z.literal(true),
    allowedAssetRoles: z.array(tokenSchema).min(1),
  })
  .strict();

const productCardFamilySchema = z
  .object({
    id: z.enum(["minimalProduct", "editorialImage", "compactCommerce", "premiumJewellery"]),
    label: localizedLabelSchema,
    registryVariant: z.enum(["standard", "editorial", "compact", "imageFirst", "horizontal"]),
    requiredCommerceFields: z.tuple([
      z.literal("productId"),
      z.literal("title"),
      z.literal("priceState"),
      z.literal("availability"),
      z.literal("canonicalMedia"),
      z.literal("productRoute"),
    ]),
  })
  .strict();

export const storefrontDesignDirectionSchema = z
  .object({
    version: z.literal("1.0.0"),
    id: storefrontDesignDirectionIdSchema,
    label: localizedLabelSchema,
    plannerDescription: localizedLabelSchema,
    typographyDirectionId: tokenSchema,
    imageTreatmentId: imageTreatmentSchema.shape.id,
    homepageRecipeId: tokenSchema,
    collectionRecipeId: tokenSchema,
    productRecipeId: tokenSchema,
    productCardFamilyId: productCardFamilySchema.shape.id,
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

export const storefrontDesignSystemV1Schema = z
  .object({
    version: z.literal("1.0.0"),
    semanticFoundation: z
      .object({
        colourRoles: z.tuple([
          z.literal("primary"),
          z.literal("secondary"),
          z.literal("accent"),
          z.literal("background"),
          z.literal("surface"),
          z.literal("text"),
          z.literal("mutedText"),
          z.literal("border"),
          z.literal("success"),
          z.literal("warning"),
          z.literal("unavailable"),
        ]),
        layoutRoles: z.tuple([
          z.literal("contentWidth"),
          z.literal("spacingDensity"),
          z.literal("cornerTreatment"),
          z.literal("borderTreatment"),
          z.literal("surfaceDepth"),
        ]),
        commerceStatusTokensProtected: z.literal(true),
      })
      .strict(),
    typographyDirections: z.array(typographyDirectionSchema).min(5),
    imageTreatments: z.array(imageTreatmentSchema).min(6),
    productCardFamilies: z.array(productCardFamilySchema).min(3),
    homepageRecipes: z.array(pageRecipeSchema).min(3),
    collectionRecipes: z.array(pageRecipeSchema).min(2),
    productRecipes: z.array(pageRecipeSchema).min(3),
    directions: z.array(storefrontDesignDirectionSchema).min(3),
    fingerprint: z.string().min(1),
  })
  .strict()
  .superRefine((system, context) => {
    for (const [path, values] of [
      ["typographyDirections", system.typographyDirections],
      ["imageTreatments", system.imageTreatments],
      ["productCardFamilies", system.productCardFamilies],
      ["homepageRecipes", system.homepageRecipes],
      ["collectionRecipes", system.collectionRecipes],
      ["productRecipes", system.productRecipes],
      ["directions", system.directions],
    ] as const) {
      const ids = values.map((value) => value.id);
      if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: "custom", path: [path], message: `${path} IDs must be unique.` });
      }
    }
    const material = {
      version: system.version,
      semanticFoundation: system.semanticFoundation,
      typographyDirections: system.typographyDirections,
      imageTreatments: system.imageTreatments,
      productCardFamilies: system.productCardFamilies,
      homepageRecipes: system.homepageRecipes,
      collectionRecipes: system.collectionRecipes,
      productRecipes: system.productRecipes,
      directions: system.directions,
    };
    if (system.fingerprint !== `storefront-design-system-${canonicalValueFingerprint(material)}`) {
      context.addIssue({ code: "custom", path: ["fingerprint"], message: "Fingerprint is stale." });
    }
    const homepageRecipeIds = new Set(system.homepageRecipes.map((recipe) => recipe.id));
    const collectionRecipeIds = new Set(system.collectionRecipes.map((recipe) => recipe.id));
    const productRecipeIds = new Set(system.productRecipes.map((recipe) => recipe.id));
    const typographyIds = new Set(system.typographyDirections.map((item) => item.id));
    const imageIds = new Set(system.imageTreatments.map((item) => item.id));
    const cardIds = new Set(system.productCardFamilies.map((item) => item.id));
    system.directions.forEach((direction, index) => {
      const references: [string, string, ReadonlySet<string>][] = [
        ["homepageRecipeId", direction.homepageRecipeId, homepageRecipeIds],
        ["collectionRecipeId", direction.collectionRecipeId, collectionRecipeIds],
        ["productRecipeId", direction.productRecipeId, productRecipeIds],
        ["typographyDirectionId", direction.typographyDirectionId, typographyIds],
        ["imageTreatmentId", direction.imageTreatmentId, imageIds],
        ["productCardFamilyId", direction.productCardFamilyId, cardIds],
      ];
      for (const [field, id, ids] of references) {
        if (!ids.has(id)) {
          context.addIssue({
            code: "custom",
            path: ["directions", index, field],
            message: "Unknown design-system reference.",
          });
        }
      }
      const homepage = system.homepageRecipes.find(
        (recipe) => recipe.id === direction.homepageRecipeId,
      );
      const collection = system.collectionRecipes.find(
        (recipe) => recipe.id === direction.collectionRecipeId,
      );
      const product = system.productRecipes.find(
        (recipe) => recipe.id === direction.productRecipeId,
      );
      const selectedSections = [
        ["header", homepage],
        ["hero", homepage],
        ["collectionDiscovery", homepage],
        ["productCard", homepage],
        ["storytelling", homepage],
        ["campaign", homepage],
        ["trust", homepage],
        ["footer", homepage],
        ["collectionCommerce", collection],
        ["productDetail", product],
      ] as const;
      selectedSections.forEach(([selectionName, recipe]) => {
        const selection = direction.componentSelections[selectionName];
        if (
          !recipe?.sections.some(
            (section) =>
              section.component === selection.component && section.variant === selection.variant,
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["directions", index, "componentSelections", selectionName],
            message: "A coordinated component selection must match its selected registered recipe.",
          });
        }
      });
      if (
        direction.componentSelections.collectionCommerce.variant !==
        direction.collectionPresentation.variant
      ) {
        context.addIssue({
          code: "custom",
          path: ["directions", index, "componentSelections", "collectionCommerce", "variant"],
          message: "Collection presentation must use the coordinated collection component variant.",
        });
      }
      if (
        direction.componentSelections.productDetail.variant !==
        direction.productPresentation.variant
      ) {
        context.addIssue({
          code: "custom",
          path: ["directions", index, "componentSelections", "productDetail", "variant"],
          message:
            "Product presentation must use the coordinated product-detail component variant.",
        });
      }
      const productCard = system.productCardFamilies.find(
        (family) => family.id === direction.productCardFamilyId,
      );
      if (productCard?.registryVariant !== direction.collectionPresentation.cardVariant) {
        context.addIssue({
          code: "custom",
          path: ["directions", index, "collectionPresentation", "cardVariant"],
          message: "Collection presentation must use the selected registered product-card family.",
        });
      }
    });
  });

export type StorefrontDesignDirectionId = z.infer<typeof storefrontDesignDirectionIdSchema>;
export type StorefrontDesignDirection = z.infer<typeof storefrontDesignDirectionSchema>;
export type StorefrontDesignSystemV1 = z.infer<typeof storefrontDesignSystemV1Schema>;
