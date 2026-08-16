import { z } from "zod";
import {
  componentResponsiveTransformationSchema,
  componentVariantStructuralSemanticsSchema,
  productMediaPresentationSchema,
  productPresentationContextSchema,
  storefrontAssetMetadataSchema,
} from "@/domain/component-platform";
import { canonicalValueFingerprint } from "@/domain/storefront";
import type { ProductDisplayModel } from "@/domain/catalogue";

export const canonicalProductCardContractVersion = "1.0.0" as const;
export const canonicalProductCardAuthorityVersion = "1.0.0" as const;

export const canonicalProductCardAnatomyIdSchema = z.enum([
  "standard",
  "editorial",
  "compact",
  "imageFirst",
  "horizontal",
]);

export const canonicalProductCardContextSchema = z.enum([
  "homepageMerchandising",
  "collectionResults",
  "searchResults",
  "relatedProducts",
  "legacyHomepageGrid",
  "legacyRelatedProducts",
]);

const anatomySchema = z
  .object({
    id: canonicalProductCardAnatomyIdSchema,
    label: z.object({ en: z.string().min(1), fi: z.string().min(1) }).strict(),
    semanticName: z.enum(["comparisonInformationLed", "editorial", "compact", "imageLed", "dense"]),
    semantics: componentVariantStructuralSemanticsSchema,
    responsiveTransformations: z.array(componentResponsiveTransformationSchema).min(1),
    supportedContexts: z.array(canonicalProductCardContextSchema).min(1),
  })
  .strict()
  .superRefine((anatomy, context) => {
    if (anatomy.semantics.variantId !== anatomy.id) {
      context.addIssue({
        code: "custom",
        path: ["semantics", "variantId"],
        message: "Product-card anatomy identity and variant identity must match.",
      });
    }
    const ids = anatomy.responsiveTransformations.map(({ id }) => id);
    if (
      ids.length !== anatomy.semantics.structure.responsiveTransformationIds.length ||
      ids.some((id, index) => id !== anatomy.semantics.structure.responsiveTransformationIds[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["responsiveTransformations"],
        message: "Product-card responsive transformations must exactly match its structure.",
      });
    }
  });

const migrationAliasSchema = z
  .object({
    from: z.string().trim().min(1).max(80),
    to: canonicalProductCardAnatomyIdSchema,
  })
  .strict();

const requiredCommerceFields = [
  "productId",
  "title",
  "priceState",
  "availability",
  "canonicalMedia",
  "productRoute",
] as const;

const canonicalProductCardAuthorityMaterialSchema = z
  .object({
    contractVersion: z.literal(canonicalProductCardContractVersion),
    identity: z.literal("canonicalProductCardFamily"),
    version: z.literal(canonicalProductCardAuthorityVersion),
    requiredCommerceFields: z.tuple([
      z.literal("productId"),
      z.literal("title"),
      z.literal("priceState"),
      z.literal("availability"),
      z.literal("canonicalMedia"),
      z.literal("productRoute"),
    ]),
    anatomies: z.array(anatomySchema).length(5),
    migrationAliases: z.array(migrationAliasSchema),
  })
  .strict();

const transformation = (
  id: string,
  mode: z.input<typeof componentResponsiveTransformationSchema>["mode"],
  fromPresentationMode: string,
  toPresentationMode: string,
  affectedRegions: z.input<typeof componentResponsiveTransformationSchema>["affectedRegions"],
  breakpoints: z.input<typeof componentResponsiveTransformationSchema>["breakpoints"] = ["mobile"],
): z.input<typeof componentResponsiveTransformationSchema> => ({
  id,
  mode,
  breakpoints,
  fromPresentationMode,
  toPresentationMode,
  affectedRegions,
});

const allContexts = canonicalProductCardContextSchema.options;
const anatomy = (
  id: z.infer<typeof canonicalProductCardAnatomyIdSchema>,
  label: { en: string; fi: string },
  semanticName: z.infer<typeof anatomySchema>["semanticName"],
  structure: z.input<typeof componentVariantStructuralSemanticsSchema>["structure"],
  responsiveTransformations: z.input<typeof componentResponsiveTransformationSchema>[],
  materialDifferences: z.input<
    typeof componentVariantStructuralSemanticsSchema
  >["materialDifferences"],
  supportedContexts: readonly CanonicalProductCardContext[] = allContexts,
) => ({
  id,
  label,
  semanticName,
  semantics: {
    variantId: id,
    classification: "meaningfulStructuralVariant" as const,
    materialDifferences,
    finishingTokenIds: [],
    structure,
  },
  responsiveTransformations,
  supportedContexts: [...supportedContexts],
});

const authorityMaterial = canonicalProductCardAuthorityMaterialSchema.parse({
  contractVersion: canonicalProductCardContractVersion,
  identity: "canonicalProductCardFamily",
  version: canonicalProductCardAuthorityVersion,
  requiredCommerceFields,
  anatomies: [
    anatomy(
      "standard",
      { en: "Comparison and information led", fi: "Vertailu- ja tietopainotteinen" },
      "comparisonInformationLed",
      {
        regionOrder: ["media", "content", "heading", "price", "metadata", "actions"],
        omittedRegions: [],
        assetPlacements: [{ slotId: "productMedia", region: "media" }],
        contentRelationship: "balanced",
        ctaRelationship: "separated",
        merchandisingEmphasis: "balanced",
        navigationModel: "inline",
        responsiveTransformationIds: ["standardCondense"],
        presentationMode: "comparisonGrid",
      },
      [
        transformation("standardCondense", "condense", "comparisonGrid", "comparisonStack", [
          "metadata",
          "actions",
        ]),
      ],
      ["hierarchy", "regionArrangement", "ctaRelationship"],
    ),
    anatomy(
      "editorial",
      { en: "Editorial", fi: "Toimituksellinen" },
      "editorial",
      {
        regionOrder: ["media", "heading", "content", "price", "metadata", "actions"],
        omittedRegions: [],
        assetPlacements: [{ slotId: "productMedia", region: "media" }],
        contentRelationship: "mediaLed",
        ctaRelationship: "overlay",
        merchandisingEmphasis: "dominant",
        navigationModel: "inline",
        responsiveTransformationIds: ["editorialStack"],
        presentationMode: "editorialOverlay",
      },
      [
        transformation("editorialStack", "stack", "editorialOverlay", "editorialStack", [
          "heading",
          "price",
          "actions",
        ]),
      ],
      ["assetPlacement", "contentRelationship", "ctaRelationship"],
      allContexts.filter((context) => context !== "searchResults"),
    ),
    anatomy(
      "compact",
      { en: "Compact", fi: "Kompakti" },
      "compact",
      {
        regionOrder: ["heading", "price", "media", "actions"],
        omittedRegions: ["metadata"],
        assetPlacements: [{ slotId: "productMedia", region: "media" }],
        contentRelationship: "contentLed",
        ctaRelationship: "inline",
        merchandisingEmphasis: "supporting",
        navigationModel: "inline",
        responsiveTransformationIds: ["compactSimplify"],
        presentationMode: "compactCommerce",
      },
      [
        transformation("compactSimplify", "simplify", "compactCommerce", "compactEssential", [
          "media",
          "actions",
        ]),
      ],
      ["hierarchy", "regionPresence", "contentRelationship"],
    ),
    anatomy(
      "imageFirst",
      { en: "Image led", fi: "Kuvavetoinen" },
      "imageLed",
      {
        regionOrder: ["media", "actions", "content", "heading", "price", "metadata"],
        omittedRegions: [],
        assetPlacements: [{ slotId: "productMedia", region: "media" }],
        contentRelationship: "mediaLed",
        ctaRelationship: "overlay",
        merchandisingEmphasis: "dominant",
        navigationModel: "inline",
        responsiveTransformationIds: ["imageFirstReorder"],
        presentationMode: "imageFirstOverlay",
      },
      [
        transformation("imageFirstReorder", "reorder", "imageFirstOverlay", "imageFirstStack", [
          "actions",
          "content",
        ]),
      ],
      ["hierarchy", "assetPlacement", "regionArrangement"],
      allContexts.filter((context) => context !== "searchResults"),
    ),
    anatomy(
      "horizontal",
      { en: "Dense", fi: "Tiivis" },
      "dense",
      {
        regionOrder: ["media", "heading", "price", "metadata", "actions"],
        omittedRegions: ["content"],
        assetPlacements: [{ slotId: "productMedia", region: "media" }],
        contentRelationship: "supporting",
        ctaRelationship: "sticky",
        merchandisingEmphasis: "balanced",
        navigationModel: "inline",
        responsiveTransformationIds: ["denseReflow"],
        presentationMode: "denseHorizontal",
      },
      [
        transformation(
          "denseReflow",
          "reflow",
          "denseHorizontal",
          "denseStack",
          ["media", "metadata", "actions"],
          ["mobile", "tablet"],
        ),
      ],
      ["regionArrangement", "regionPresence", "ctaRelationship"],
    ),
  ],
  migrationAliases: [
    { from: "grid", to: "horizontal" },
    { from: "minimalProduct", to: "standard" },
    { from: "editorialImage", to: "editorial" },
    { from: "compactCommerce", to: "compact" },
    { from: "premiumJewellery", to: "imageFirst" },
    { from: "denseComparison", to: "horizontal" },
  ],
});

export const canonicalProductCardAuthority = Object.freeze({
  ...authorityMaterial,
  fingerprint: `canonical-product-card-${canonicalValueFingerprint(authorityMaterial)}`,
});

export type CanonicalProductCardAnatomyId = z.infer<typeof canonicalProductCardAnatomyIdSchema>;
export type CanonicalProductCardContext = z.infer<typeof canonicalProductCardContextSchema>;

export function migrateCanonicalProductCardAnatomy(value: string): CanonicalProductCardAnatomyId {
  const current = canonicalProductCardAnatomyIdSchema.safeParse(value);
  if (current.success) return current.data;
  const alias = canonicalProductCardAuthority.migrationAliases.find(({ from }) => from === value);
  if (!alias) throw new Error(`Unknown product-card anatomy: ${value}.`);
  return alias.to;
}

export function requireCanonicalProductCardAnatomy(
  anatomyId: string,
  context: CanonicalProductCardContext,
) {
  const id = migrateCanonicalProductCardAnatomy(anatomyId);
  const anatomyValue = canonicalProductCardAuthority.anatomies.find(
    (candidate) => candidate.id === id,
  );
  if (!anatomyValue || !anatomyValue.supportedContexts.includes(context)) {
    throw new Error(`Product-card anatomy ${anatomyId} is not supported in ${context}.`);
  }
  return anatomyValue;
}

export const canonicalProductCardRequestSchema = z
  .object({
    anatomyId: canonicalProductCardAnatomyIdSchema,
    context: canonicalProductCardContextSchema,
    product: productPresentationContextSchema,
    media: productMediaPresentationSchema.optional(),
    asset: storefrontAssetMetadataSchema.optional(),
    showCanonicalBadge: z.boolean().default(true),
    conciseAttributeLimit: z.number().int().min(0).max(6).default(2),
  })
  .strict()
  .superRefine((request, context) => {
    const anatomyValue = canonicalProductCardAuthority.anatomies.find(
      ({ id }) => id === request.anatomyId,
    );
    if (!anatomyValue?.supportedContexts.includes(request.context)) {
      context.addIssue({ code: "custom", path: ["context"], message: "Unsupported card context." });
    }
    if ((request.media === undefined) !== (request.asset === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["media"],
        message: "Card media and its canonical asset metadata must be supplied together.",
      });
      return;
    }
    if (!request.media || !request.asset) return;
    if (
      request.media.role === "editorial" ||
      request.media.assetId !== request.asset.assetId ||
      request.asset.provenance.kind !== "canonicalProductMedia" ||
      request.asset.provenance.sourceId !== request.product.productId ||
      !request.product.media.some(
        (candidate) =>
          candidate.assetId === request.media?.assetId && candidate.role === request.media?.role,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["media"],
        message: "Product cards may only present exact canonical media owned by the product.",
      });
    }
    const expectedRole =
      request.media.role === "main" ? "productMainImage" : "productAlternativeImage";
    if (request.asset.role !== expectedRole) {
      context.addIssue({
        code: "custom",
        path: ["asset", "role"],
        message: "Product-card media role does not match canonical media lineage.",
      });
    }
    if (!request.context.startsWith("legacy") && request.asset.artDirection === undefined) {
      context.addIssue({
        code: "custom",
        path: ["asset", "artDirection"],
        message: "Active product-card media requires P10B-04 art-direction authority.",
      });
    }
    if (
      request.asset.artDirection &&
      (request.asset.artDirection.source.assetId !== request.media.assetId ||
        request.asset.artDirection.source.sourceOwnerId !== request.product.productId ||
        request.asset.artDirection.source.provenanceKind !== "canonicalProductMedia" ||
        request.asset.artDirection.source.role !== expectedRole)
    ) {
      context.addIssue({
        code: "custom",
        path: ["asset", "artDirection", "source"],
        message: "Product-card art direction must preserve exact P10B-04 source lineage.",
      });
    }
  });

export type CanonicalProductCardRequest = z.infer<typeof canonicalProductCardRequestSchema>;

export function canonicalProductCardFactsFingerprint(
  requestValue: Pick<CanonicalProductCardRequest, "product" | "media" | "asset">,
) {
  const { product, media, asset } = requestValue;
  return `product-card-facts-${canonicalValueFingerprint({
    productId: product.productId,
    revision: product.revision,
    title: product.title,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    priceUnavailableReason: product.priceUnavailableReason,
    availability: product.availability,
    media: media
      ? {
          assetId: media.assetId,
          role: media.role,
          sourceOwnerId: asset?.provenance.sourceId,
          sourceKind: asset?.provenance.kind,
          sourceAuthorityFingerprint: asset?.artDirection?.fingerprint,
        }
      : null,
  })}`;
}

/**
 * Derives a stable presentation identity without treating the merchant-facing
 * product-type label as an identifier or changing canonical commerce truth.
 */
export function canonicalProductTypePresentationId(productType: string): string {
  return `product-type-${canonicalValueFingerprint(productType).slice(0, 24)}`;
}

/** Compatibility projection for stored legacy components; it never persists a second product model. */
export function projectLegacyProductCardProduct(product: ProductDisplayModel) {
  const revision = `legacy-product-${canonicalValueFingerprint(product)}`;
  const availability =
    product.availabilityLabel ??
    (product.stockStatus === "inStock"
      ? { en: "In stock", fi: "Varastossa" }
      : product.stockStatus === "lowStock"
        ? { en: "Limited availability", fi: "Rajoitetusti saatavilla" }
        : product.stockStatus === "outOfStock"
          ? { en: "Currently unavailable", fi: "Ei juuri nyt saatavilla" }
          : { en: "Availability not provided", fi: "Saatavuustietoa ei annettu" });
  const context = productPresentationContextSchema.parse({
    productId: product.id,
    productTypeId: canonicalProductTypePresentationId(product.productType),
    sku: product.sku,
    title: product.title,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    priceUnavailableReason: product.priceUnavailableReason,
    availability,
    media: product.images.map((image, index) => ({
      assetId: image.id,
      role: index === 0 ? "main" : "alternative",
      alt: image.alt,
      decorative: image.decorative,
    })),
    attributeGroups: [],
    optionGroups: [],
    selectedValues: [],
    unavailableCombinations: [],
    relatedProductIds: [],
    revision,
  });
  const assets = product.images.map((image, index) =>
    storefrontAssetMetadataSchema.parse({
      assetId: image.id,
      role: index === 0 ? "productMainImage" : "productAlternativeImage",
      alt: image.alt,
      decorative: image.decorative ?? image.alt === undefined,
      provenance: { kind: "canonicalProductMedia", sourceId: product.id },
      approvalStatus: "approved",
      usageRights: "merchantOwned",
      responsiveCrops: [],
      revision,
    }),
  );
  return { product: context, assets };
}
