import { z } from "zod";
import {
  boundedParameterDefinitions,
  createLegacyComponentDesignCompatibility,
  validateComponentDefinitionV2,
  type ComponentDefinitionV2,
  type ComponentInstanceV2,
  type ComponentInstanceValidationContracts,
  type ComponentProjectionContext,
  type ComponentVariantStructuralSemantics,
  type ProductPresentationContext,
  type StorefrontAssetMetadata,
} from "@/domain/component-platform";
import { idSchema, localizedTextSchema } from "@/domain/shared";
import { pageFactEvidenceReferenceSchema } from "@/domain/storefront";
import {
  createRegisteredComponentCommercialAnatomy,
  withCurrentComponentCommercialAnatomy,
  type RegisteredCommercialAnatomyInput,
} from "./commercial-anatomy";

const localizedActionLabelSchema = localizedTextSchema.optional();

export const homepageSurfaceStyleSchema = z
  .object({ surface: z.enum(["plain", "soft", "contrast"]) })
  .strict();

export const homepageHeroContentSchema = z
  .object({
    eyebrow: localizedTextSchema.optional(),
    heading: localizedTextSchema,
    supportingCopy: localizedTextSchema.optional(),
    primaryActionLabel: localizedActionLabelSchema,
    secondaryActionLabel: localizedActionLabelSchema,
  })
  .strict();

export const homepageHeroPropsSchema = z
  .object({
    mediaPosition: z.enum(["left", "right", "background"]),
    imagePresentation: z.enum(["cover", "contain"]),
    textAlignment: z.enum(["left", "center"]),
    contentWidth: z.enum(["narrow", "standard", "wide"]).default("standard"),
    overlayContrast: z.enum(["soft", "strong"]).default("soft"),
  })
  .strict();

export const homepageFeaturedCollectionsContentSchema = z
  .object({
    heading: localizedTextSchema.optional(),
    supportingCopy: localizedTextSchema.optional(),
    mediaPlaceholderLabel: localizedTextSchema,
  })
  .strict();

export const homepageFeaturedCollectionsPropsSchema = z
  .object({
    layout: z.enum(["grid", "row"]),
    cardPresentation: z.enum(["image", "text", "compact"]),
    columns: z.number().int().min(2).max(4),
    showDescriptions: z.boolean(),
  })
  .strict();

export const homepageFeaturedProductsContentSchema = z
  .object({
    heading: localizedTextSchema.optional(),
    supportingCopy: localizedTextSchema.optional(),
    mediaPlaceholderLabel: localizedTextSchema,
    emptyStateMessage: localizedTextSchema,
    // The snapshot carries the approved product-list selection as references,
    // not as copied commerce data. This preserves merchandising order at every
    // runtime surface while the catalogue remains the only product authority.
    productIds: z.array(idSchema).min(1).optional(),
  })
  .strict();

export const homepageFeaturedProductsPropsSchema = z
  .object({
    layout: z.enum(["grid", "carousel"]),
    cardVariant: z.enum(["standard", "editorial", "compact", "imageFirst", "horizontal"]),
    columns: z.number().int().min(2).max(4),
  })
  .strict();

export const homepageCollectionNavigationContentSchema = z
  .object({
    heading: localizedTextSchema.optional(),
    mediaPlaceholderLabel: localizedTextSchema,
  })
  .strict();

export const homepageCollectionNavigationPropsSchema = z
  .object({
    presentation: z.enum(["image", "text", "compact"]),
    columns: z.number().int().min(2).max(4),
  })
  .strict();

export const homepagePromotionContentSchema = z
  .object({
    heading: localizedTextSchema,
    description: localizedTextSchema,
    actionLabel: localizedActionLabelSchema,
  })
  .strict();

export const homepagePromotionPropsSchema = z
  .object({
    mediaPosition: z.enum(["left", "right", "background"]),
    actionPresentation: z.enum(["primary", "secondary", "text"]),
    textAlignment: z.enum(["left", "center"]),
  })
  .strict();

const trustItemSchema = z
  .object({
    id: idSchema,
    kind: z.enum(["delivery", "returns", "service", "storeSupport"]),
    title: localizedTextSchema,
    description: localizedTextSchema,
  })
  .strict();

export const homepageTrustContentSchema = z
  .object({
    heading: localizedTextSchema.optional(),
    items: z.array(trustItemSchema).min(1).max(6),
    actionLabel: localizedActionLabelSchema,
  })
  .strict()
  .superRefine((content, context) => {
    if (new Set(content.items.map((item) => item.id)).size !== content.items.length) {
      context.addIssue({
        code: "custom",
        message: "Trust item IDs must be unique.",
        path: ["items"],
      });
    }
  });

export const homepageTrustPropsSchema = z
  .object({
    columns: z.number().int().min(1).max(4),
    textAlignment: z.enum(["left", "center"]),
  })
  .strict();

const editorialStepSchema = z
  .object({
    id: idSchema,
    title: localizedTextSchema,
    description: localizedTextSchema,
  })
  .strict();

export const homepageEditorialContentSchema = z
  .object({
    eyebrow: localizedTextSchema.optional(),
    heading: localizedTextSchema,
    body: localizedTextSchema,
    steps: z.array(editorialStepSchema).max(4).default([]),
    actionLabel: localizedActionLabelSchema,
  })
  .strict();

export const homepageEditorialPropsSchema = z
  .object({
    mediaPosition: z.enum(["left", "right"]),
    textAlignment: z.enum(["left", "center"]),
    galleryColumns: z.number().int().min(1).max(3).default(2),
  })
  .strict();

const proofItemSchema = z
  .object({
    id: idSchema,
    kind: z.enum(["quote", "brandFact", "service"]),
    statement: localizedTextSchema,
    attribution: localizedTextSchema.optional(),
    evidence: pageFactEvidenceReferenceSchema,
  })
  .strict();

export const homepageProofContentSchema = z
  .object({
    heading: localizedTextSchema.optional(),
    items: z.array(proofItemSchema).max(4).default([]),
  })
  .strict()
  .superRefine((content, context) => {
    if (new Set(content.items.map((item) => item.id)).size !== content.items.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Proof item IDs must be unique.",
      });
    }
  });

export const homepageProofPropsSchema = z
  .object({
    columns: z.number().int().min(1).max(3),
    textAlignment: z.enum(["left", "center"]),
  })
  .strict();

const commonProtectedPaths = [
  "bindings.product.productId",
  "bindings.product.productTypeId",
  "bindings.product.sku",
  "bindings.product.price",
  "bindings.product.compareAtPrice",
  "bindings.product.availability",
  "bindings.collection.collectionId",
  "bindings.collection.productIds",
  "commerce.product.productId",
  "commerce.product.productTypeId",
  "commerce.product.sku",
  "commerce.product.price",
  "commerce.product.compareAtPrice",
  "commerce.product.availability",
  "commerce.collection.collectionId",
  "commerce.collection.productIds",
  "assets.*.provenance",
] as const;

const presentationContextSlot = {
  id: "presentationContext",
  title: { en: "Project and brand context", fi: "Projektin ja brändin konteksti" },
  acceptedSourceTypes: ["projectBrandContext"],
  required: true,
  revisionRequired: true,
  emptyState: "message",
} as const;

const copyContextSlot = {
  id: "copyContext",
  title: { en: "Localized content source", fi: "Lokalisoidun sisällön lähde" },
  acceptedSourceTypes: ["localizedContent"],
  required: false,
  revisionRequired: true,
  emptyState: "hide",
} as const;

const responsiveRules = [
  {
    breakpoints: ["mobile", "tablet", "desktop", "wide"],
    allowHorizontalOverflow: false,
    maxColumns: 4,
    notes: {
      en: "Homepage commerce sections reflow at 375, 768, 1024 and 1440 pixels without product-type-specific geometry.",
      fi: "Etusivun kauppaosiot mukautuvat 375, 768, 1024 ja 1440 pikselissä ilman tuotetyyppikohtaista geometriaa.",
    },
  },
] as const;

const accessibilityRequirements = {
  keyboard: "Every navigation action is keyboard operable through a native button.",
  semantics: "Sections use labelled landmarks, ordered headings, lists and articles.",
  labels: "Images and navigation actions use approved localized accessible names.",
  focus: "Interactive controls retain visible focus and usable touch targets.",
  contrast: "The renderer consumes validated project and brand presentation tokens.",
} as const;

const stableMigration = { policy: "stable", previousVersions: [], migrations: [] } as const;

function define(input: unknown, anatomy?: RegisteredCommercialAnatomyInput): ComponentDefinitionV2 {
  const definition = input as Record<string, unknown>;
  return validateComponentDefinitionV2(
    anatomy
      ? {
          ...definition,
          commercialAnatomy: createRegisteredComponentCommercialAnatomy(
            definition as Parameters<typeof createRegisteredComponentCommercialAnatomy>[0],
            anatomy,
          ),
        }
      : withCurrentComponentCommercialAnatomy(definition),
  );
}

function designCompatibilityFor(
  family: "commerce" | "marketing" | "navigation" | "service" | "content",
  allowedNarrativeRoles?: readonly string[],
) {
  const compatibility = createLegacyComponentDesignCompatibility();
  return {
    ...compatibility,
    ...(allowedNarrativeRoles === undefined
      ? {}
      : {
          allowedNarrativeRoles: [...allowedNarrativeRoles],
          commerceRequirements: ["none"],
        }),
    boundedParameterIds: boundedParameterDefinitions
      .filter((parameter) => parameter.compatibleComponentFamilies.includes(family))
      .map((parameter) => parameter.id),
  };
}

const heroSplitStructure: ComponentVariantStructuralSemantics["structure"] = {
  regionOrder: ["frame", "content", "heading", "body", "actions", "media"],
  omittedRegions: ["merchandising"],
  assetPlacements: [{ slotId: "heroMedia", region: "media" }],
  contentRelationship: "balanced",
  ctaRelationship: "inline",
  merchandisingEmphasis: "none",
  navigationModel: "none",
  responsiveTransformationIds: ["splitToStack"],
  presentationMode: "editorialSplitHero",
};

const heroOverlayStructure: ComponentVariantStructuralSemantics["structure"] = {
  regionOrder: ["frame", "media", "content", "heading", "body", "actions"],
  omittedRegions: ["merchandising"],
  assetPlacements: [{ slotId: "heroMedia", region: "frame" }],
  contentRelationship: "mediaLed",
  ctaRelationship: "overlay",
  merchandisingEmphasis: "none",
  navigationModel: "none",
  responsiveTransformationIds: ["overlayToContained"],
  presentationMode: "fullBleedOverlayHero",
};

const homepageHeroCommercialAnatomy: RegisteredCommercialAnatomyInput = {
  regions: [
    { id: "frame", required: true },
    { id: "media", required: false },
    { id: "content", required: true },
    { id: "heading", required: true },
    { id: "body", required: false },
    { id: "actions", required: false },
    { id: "merchandising", required: false },
  ],
  responsiveTransformations: [
    {
      id: "splitToStack",
      mode: "stack",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "editorialSplitHero",
      toPresentationMode: "stackedHero",
      affectedRegions: ["media", "content", "actions"],
    },
    {
      id: "overlayToContained",
      mode: "switch-layout",
      breakpoints: ["mobile"],
      fromPresentationMode: "fullBleedOverlayHero",
      toPresentationMode: "containedOverlayHero",
      affectedRegions: ["frame", "media", "content", "actions"],
    },
    {
      id: "mediaFirstStack",
      mode: "reorder",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "mediaLedHero",
      toPresentationMode: "mediaFirstStackedHero",
      affectedRegions: ["media", "content"],
    },
    {
      id: "asymmetricReflow",
      mode: "reflow",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "asymmetricHero",
      toPresentationMode: "balancedStackedHero",
      affectedRegions: ["frame", "media", "content"],
    },
    {
      id: "restrainedCondense",
      mode: "condense",
      breakpoints: ["mobile"],
      fromPresentationMode: "restrainedCopyHero",
      toPresentationMode: "compactCopyHero",
      affectedRegions: ["content", "heading", "body", "actions"],
    },
    {
      id: "campaignReflow",
      mode: "reflow",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "campaignMerchandisingHero",
      toPresentationMode: "campaignStackedHero",
      affectedRegions: ["media", "merchandising", "content", "actions"],
    },
  ],
  variants: [
    {
      variantId: "editorial",
      classification: "compatibilityAlias",
      materialDifferences: [],
      finishingTokenIds: [],
      aliasOf: "editorialSplit",
      structure: heroSplitStructure,
    },
    {
      variantId: "fullBleed",
      classification: "compatibilityAlias",
      materialDifferences: [],
      finishingTokenIds: [],
      aliasOf: "fullBleedOverlay",
      structure: heroOverlayStructure,
    },
    {
      variantId: "editorialSplit",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["hierarchy", "assetPlacement", "ctaRelationship", "presentationMode"],
      finishingTokenIds: [],
      structure: heroSplitStructure,
    },
    {
      variantId: "imageLed",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "contentRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        ...heroSplitStructure,
        regionOrder: ["frame", "media", "content", "heading", "body", "actions"],
        contentRelationship: "mediaLed",
        responsiveTransformationIds: ["mediaFirstStack"],
        presentationMode: "mediaLedHero",
      },
    },
    {
      variantId: "minimal",
      classification: "compatibilityAlias",
      materialDifferences: [],
      finishingTokenIds: [],
      aliasOf: "restrained",
      structure: {
        regionOrder: ["frame", "content", "heading", "body", "actions"],
        omittedRegions: ["media", "merchandising"],
        assetPlacements: [],
        contentRelationship: "contentLed",
        ctaRelationship: "inline",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["restrainedCondense"],
        presentationMode: "restrainedCopyHero",
      },
    },
    {
      variantId: "fullBleedOverlay",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "assetPlacement",
        "contentRelationship",
        "ctaRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: heroOverlayStructure,
    },
    {
      variantId: "asymmetric",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "hierarchy",
        "regionArrangement",
        "contentRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        ...heroSplitStructure,
        regionOrder: ["frame", "content", "heading", "media", "body", "actions"],
        contentRelationship: "contentLed",
        responsiveTransformationIds: ["asymmetricReflow"],
        presentationMode: "asymmetricHero",
      },
    },
    {
      variantId: "restrained",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionPresence",
        "assetPlacement",
        "contentRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "content", "heading", "body", "actions"],
        omittedRegions: ["media", "merchandising"],
        assetPlacements: [],
        contentRelationship: "contentLed",
        ctaRelationship: "inline",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["restrainedCondense"],
        presentationMode: "restrainedCopyHero",
      },
    },
    {
      variantId: "campaignMerchandising",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "regionPresence",
        "contentRelationship",
        "ctaRelationship",
        "merchandisingEmphasis",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        ...heroSplitStructure,
        regionOrder: ["frame", "media", "merchandising", "content", "heading", "body", "actions"],
        omittedRegions: [],
        contentRelationship: "mediaLed",
        ctaRelationship: "separated",
        merchandisingEmphasis: "dominant",
        responsiveTransformationIds: ["campaignReflow"],
        presentationMode: "campaignMerchandisingHero",
      },
    },
  ],
};

export const homepageHeroDefinition = define(
  {
    type: "homepageHero",
    version: { major: 2, minor: 0, patch: 0 },
    title: { en: "Homepage hero", fi: "Etusivun pääosio" },
    merchantDescription: {
      en: "Introduces the storefront with approved media, localized copy and navigation actions.",
      fi: "Esittelee kaupan hyväksytyllä medialla, lokalisoidulla tekstillä ja navigointitoiminnoilla.",
    },
    family: "marketing",
    supportedPageTypes: ["home", "landing"],
    variants: [
      { id: "editorial", title: { en: "Editorial", fi: "Toimituksellinen" } },
      { id: "fullBleed", title: { en: "Full bleed", fi: "Koko pinnan kuva" } },
      { id: "editorialSplit", title: { en: "Editorial split", fi: "Toimituksellinen jako" } },
      { id: "imageLed", title: { en: "Image led", fi: "Kuvapainotteinen" } },
      { id: "minimal", title: { en: "Minimal", fi: "Minimaalinen" } },
      {
        id: "fullBleedOverlay",
        title: { en: "Full-bleed overlay", fi: "Kokonainen kuva peittotekstillä" },
      },
      { id: "asymmetric", title: { en: "Asymmetrical", fi: "Epäsymmetrinen" } },
      { id: "restrained", title: { en: "Restrained", fi: "Harkittu" } },
      {
        id: "campaignMerchandising",
        title: { en: "Campaign merchandising", fi: "Kampanjanostot" },
      },
    ],
    defaultVariant: "editorialSplit",
    industryTags: [],
    contentSchema: z.toJSONSchema(homepageHeroContentSchema),
    propsSchema: z.toJSONSchema(homepageHeroPropsSchema),
    styleOverridesSchema: z.toJSONSchema(homepageSurfaceStyleSchema),
    contentSlots: [
      {
        id: "eyebrow",
        title: { en: "Eyebrow", fi: "Yläotsikko" },
        localized: true,
        required: false,
      },
      { id: "heading", title: { en: "Heading", fi: "Otsikko" }, localized: true, required: true },
      {
        id: "supportingCopy",
        title: { en: "Supporting copy", fi: "Tukiteksti" },
        localized: true,
        required: false,
      },
      {
        id: "primaryActionLabel",
        title: { en: "Primary action label", fi: "Ensisijaisen toiminnon teksti" },
        localized: true,
        required: false,
      },
      {
        id: "secondaryActionLabel",
        title: { en: "Secondary action label", fi: "Toissijaisen toiminnon teksti" },
        localized: true,
        required: false,
      },
    ],
    commerceBindingSlots: [
      presentationContextSlot,
      copyContextSlot,
      {
        id: "heroAsset",
        title: { en: "Hero asset", fi: "Pääosion media" },
        acceptedSourceTypes: ["asset"],
        required: false,
        revisionRequired: true,
        emptyState: "hide",
      },
      {
        id: "primaryAction",
        title: { en: "Primary navigation action", fi: "Ensisijainen navigointitoiminto" },
        acceptedSourceTypes: ["navigation"],
        required: false,
        revisionRequired: true,
        emptyState: "hide",
      },
      {
        id: "secondaryAction",
        title: { en: "Secondary navigation action", fi: "Toissijainen navigointitoiminto" },
        acceptedSourceTypes: ["navigation"],
        required: false,
        revisionRequired: true,
        emptyState: "hide",
      },
    ],
    assetSlots: [
      {
        id: "heroMedia",
        title: { en: "Hero media", fi: "Pääosion media" },
        acceptedRoles: ["heroDesktop", "heroMobile", "editorialImage"],
        required: false,
        minItems: 0,
        maxItems: 1,
      },
    ],
    editablePresentationFields: [
      {
        path: "content.eyebrow",
        label: { en: "Eyebrow", fi: "Yläotsikko" },
        source: "content",
        control: "text",
        localized: true,
      },
      {
        path: "content.heading",
        label: { en: "Heading", fi: "Otsikko" },
        source: "content",
        control: "text",
        localized: true,
      },
      {
        path: "content.supportingCopy",
        label: { en: "Supporting copy", fi: "Tukiteksti" },
        source: "content",
        control: "textarea",
        localized: true,
      },
      {
        path: "content.primaryActionLabel",
        label: { en: "Primary action", fi: "Ensisijainen toiminto" },
        source: "content",
        control: "text",
        localized: true,
      },
      {
        path: "content.secondaryActionLabel",
        label: { en: "Secondary action", fi: "Toissijainen toiminto" },
        source: "content",
        control: "text",
        localized: true,
      },
      {
        path: "props.mediaPosition",
        label: { en: "Media position", fi: "Median sijainti" },
        source: "props",
        control: "select",
        localized: false,
      },
      {
        path: "props.imagePresentation",
        label: { en: "Image presentation", fi: "Kuvan esitystapa" },
        source: "props",
        control: "select",
        localized: false,
      },
      {
        path: "props.textAlignment",
        label: { en: "Text alignment", fi: "Tekstin tasaus" },
        source: "props",
        control: "select",
        localized: false,
      },
      {
        path: "props.contentWidth",
        label: { en: "Content width", fi: "Sisällön leveys" },
        source: "props",
        control: "select",
        localized: false,
      },
      {
        path: "props.overlayContrast",
        label: { en: "Overlay contrast", fi: "Peittokuvan kontrasti" },
        source: "props",
        control: "select",
        localized: false,
      },
      {
        path: "styleOverrides.surface",
        label: { en: "Surface", fi: "Pinta" },
        source: "styleOverrides",
        control: "select",
        localized: false,
      },
    ],
    protectedFields: { readOnlyPaths: [...commonProtectedPaths] },
    responsiveRules,
    accessibilityRequirements,
    designCompatibility: designCompatibilityFor("marketing", [
      "orientation",
      "campaign",
      "brand-story",
    ]),
    migration: stableMigration,
    renderer: {
      adapterId: "veskifyHomepageRenderer",
      exportName: "HomepageHeroSection",
      supportedTargets: ["editor", "preview", "published"],
    },
  },
  homepageHeroCommercialAnatomy,
);

function commerceListDefinition({
  type,
  title,
  description,
  family,
  variants,
  defaultVariant,
  contentSchema,
  propsSchema,
  contentSlots,
  bindingSlot,
  assetSlot,
  editablePresentationFields,
  exportName,
}: {
  type: string;
  title: { en: string; fi: string };
  description: { en: string; fi: string };
  family: "commerce" | "navigation";
  variants: readonly { id: string; title: { en: string; fi: string } }[];
  defaultVariant: string;
  contentSchema: z.ZodType;
  propsSchema: z.ZodType;
  contentSlots: readonly unknown[];
  bindingSlot: unknown;
  assetSlot: unknown;
  editablePresentationFields: readonly unknown[];
  exportName: string;
}) {
  return define({
    type,
    version: { major: 2, minor: 0, patch: 0 },
    title,
    merchantDescription: description,
    family,
    supportedPageTypes: ["home"],
    variants,
    defaultVariant,
    industryTags: [],
    contentSchema: z.toJSONSchema(contentSchema),
    propsSchema: z.toJSONSchema(propsSchema),
    styleOverridesSchema: z.toJSONSchema(homepageSurfaceStyleSchema),
    contentSlots,
    commerceBindingSlots: [presentationContextSlot, copyContextSlot, bindingSlot],
    assetSlots: [assetSlot],
    editablePresentationFields: [
      ...editablePresentationFields,
      {
        path: "styleOverrides.surface",
        label: { en: "Surface", fi: "Pinta" },
        source: "styleOverrides",
        control: "select",
        localized: false,
      },
    ],
    protectedFields: { readOnlyPaths: [...commonProtectedPaths] },
    responsiveRules,
    accessibilityRequirements,
    designCompatibility: designCompatibilityFor(family),
    migration: stableMigration,
    renderer: {
      adapterId: "veskifyHomepageRenderer",
      exportName,
      supportedTargets: ["editor", "preview", "published"],
    },
  });
}

export const homepageFeaturedCollectionsDefinition = commerceListDefinition({
  type: "homepageFeaturedCollections",
  title: { en: "Featured collections", fi: "Nostetut mallistot" },
  description: {
    en: "Presents an ordered canonical collection selection with approved collection media.",
    fi: "Esittää järjestetyn kanonisen mallistovalinnan hyväksytyllä mallistomedialla.",
  },
  family: "commerce",
  variants: [
    { id: "standard", title: { en: "Standard", fi: "Tavallinen" } },
    { id: "editorial", title: { en: "Editorial", fi: "Toimituksellinen" } },
    { id: "editorialCards", title: { en: "Editorial cards", fi: "Toimitukselliset kortit" } },
    { id: "grid", title: { en: "Grid", fi: "Ruudukko" } },
    { id: "carousel", title: { en: "Carousel", fi: "Karuselli" } },
    { id: "imageLed", title: { en: "Image led", fi: "Kuvapainotteinen" } },
  ],
  defaultVariant: "standard",
  contentSchema: homepageFeaturedCollectionsContentSchema,
  propsSchema: homepageFeaturedCollectionsPropsSchema,
  contentSlots: [
    { id: "heading", title: { en: "Heading", fi: "Otsikko" }, localized: true, required: false },
    {
      id: "supportingCopy",
      title: { en: "Supporting copy", fi: "Tukiteksti" },
      localized: true,
      required: false,
    },
  ],
  bindingSlot: {
    id: "collections",
    title: { en: "Featured collections", fi: "Nostetut mallistot" },
    acceptedSourceTypes: ["collectionList"],
    required: true,
    revisionRequired: true,
    emptyState: "message",
  },
  assetSlot: {
    id: "collectionMedia",
    title: { en: "Collection media", fi: "Mallistomedia" },
    acceptedRoles: ["collectionImage", "editorialImage"],
    required: false,
    minItems: 0,
    maxItems: 64,
  },
  editablePresentationFields: [
    {
      path: "content.heading",
      label: { en: "Heading", fi: "Otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "content.supportingCopy",
      label: { en: "Supporting copy", fi: "Tukiteksti" },
      source: "content",
      control: "textarea",
      localized: true,
    },
    {
      path: "props.layout",
      label: { en: "Layout", fi: "Asettelu" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.cardPresentation",
      label: { en: "Card presentation", fi: "Kortin esitystapa" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.columns",
      label: { en: "Columns", fi: "Sarakkeet" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.showDescriptions",
      label: { en: "Show descriptions", fi: "Näytä kuvaukset" },
      source: "props",
      control: "toggle",
      localized: false,
    },
  ],
  exportName: "HomepageFeaturedCollectionsSection",
});

export const homepageFeaturedProductsDefinition = commerceListDefinition({
  type: "homepageFeaturedProducts",
  title: { en: "Featured products", fi: "Nostetut tuotteet" },
  description: {
    en: "Presents canonical products through the reusable product-card contract.",
    fi: "Esittää kanoniset tuotteet uudelleenkäytettävän tuotekorttisopimuksen kautta.",
  },
  family: "commerce",
  variants: [
    { id: "standard", title: { en: "Standard", fi: "Tavallinen" } },
    { id: "editorial", title: { en: "Editorial", fi: "Toimituksellinen" } },
    { id: "compact", title: { en: "Compact", fi: "Kompakti" } },
  ],
  defaultVariant: "standard",
  contentSchema: homepageFeaturedProductsContentSchema,
  propsSchema: homepageFeaturedProductsPropsSchema,
  contentSlots: [
    { id: "heading", title: { en: "Heading", fi: "Otsikko" }, localized: true, required: false },
    {
      id: "supportingCopy",
      title: { en: "Supporting copy", fi: "Tukiteksti" },
      localized: true,
      required: false,
    },
    {
      id: "emptyStateMessage",
      title: { en: "Empty-state message", fi: "Tyhjän tilan viesti" },
      localized: true,
      required: true,
    },
  ],
  bindingSlot: {
    id: "products",
    title: { en: "Featured products", fi: "Nostetut tuotteet" },
    acceptedSourceTypes: ["productList"],
    required: true,
    revisionRequired: true,
    emptyState: "message",
  },
  assetSlot: {
    id: "productMedia",
    title: { en: "Product media", fi: "Tuotemedia" },
    acceptedRoles: ["productMainImage", "productAlternativeImage"],
    required: false,
    minItems: 0,
    maxItems: 64,
  },
  editablePresentationFields: [
    {
      path: "content.heading",
      label: { en: "Heading", fi: "Otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "content.supportingCopy",
      label: { en: "Supporting copy", fi: "Tukiteksti" },
      source: "content",
      control: "textarea",
      localized: true,
    },
    {
      path: "content.emptyStateMessage",
      label: { en: "Empty-state message", fi: "Tyhjän tilan viesti" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "props.layout",
      label: { en: "Layout", fi: "Asettelu" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.cardVariant",
      label: { en: "Product-card presentation", fi: "Tuotekortin esitystapa" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.columns",
      label: { en: "Columns", fi: "Sarakkeet" },
      source: "props",
      control: "select",
      localized: false,
    },
  ],
  exportName: "HomepageFeaturedProductsSection",
});

export const homepageCollectionNavigationDefinition = commerceListDefinition({
  type: "homepageCollectionNavigation",
  title: { en: "Collection navigation", fi: "Mallistonavigointi" },
  description: {
    en: "Provides canonical collection navigation in image, text or compact presentation.",
    fi: "Tarjoaa kanonisen mallistonavigoinnin kuva-, teksti- tai kompaktissa esityksessä.",
  },
  family: "navigation",
  variants: [
    { id: "standard", title: { en: "Standard", fi: "Tavallinen" } },
    { id: "compact", title: { en: "Compact", fi: "Kompakti" } },
    { id: "editorialCards", title: { en: "Editorial cards", fi: "Toimitukselliset kortit" } },
    { id: "grid", title: { en: "Grid", fi: "Ruudukko" } },
    { id: "carousel", title: { en: "Carousel", fi: "Karuselli" } },
    { id: "imageLed", title: { en: "Image led", fi: "Kuvapainotteinen" } },
  ],
  defaultVariant: "standard",
  contentSchema: homepageCollectionNavigationContentSchema,
  propsSchema: homepageCollectionNavigationPropsSchema,
  contentSlots: [
    { id: "heading", title: { en: "Heading", fi: "Otsikko" }, localized: true, required: false },
  ],
  bindingSlot: {
    id: "collections",
    title: { en: "Collections", fi: "Mallistot" },
    acceptedSourceTypes: ["collectionList"],
    required: true,
    revisionRequired: true,
    emptyState: "message",
  },
  assetSlot: {
    id: "collectionMedia",
    title: { en: "Collection media", fi: "Mallistomedia" },
    acceptedRoles: ["collectionImage", "editorialImage"],
    required: false,
    minItems: 0,
    maxItems: 64,
  },
  editablePresentationFields: [
    {
      path: "content.heading",
      label: { en: "Heading", fi: "Otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "props.presentation",
      label: { en: "Presentation", fi: "Esitystapa" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.columns",
      label: { en: "Columns", fi: "Sarakkeet" },
      source: "props",
      control: "select",
      localized: false,
    },
  ],
  exportName: "HomepageCollectionNavigationSection",
});

function marketingDefinition({
  type,
  title,
  description,
  family,
  variants,
  defaultVariant,
  contentSchema,
  propsSchema,
  contentSlots,
  extraBindingSlots,
  assetSlots,
  editablePresentationFields,
  exportName,
  supportedPageTypes = ["home"],
  allowedNarrativeRoles,
  anatomy,
  protectedReadOnlyPaths = [],
}: {
  type: string;
  title: { en: string; fi: string };
  description: { en: string; fi: string };
  family: "marketing" | "service" | "content";
  variants: readonly { id: string; title: { en: string; fi: string } }[];
  defaultVariant: string;
  contentSchema: z.ZodType;
  propsSchema: z.ZodType;
  contentSlots: readonly unknown[];
  extraBindingSlots: readonly unknown[];
  assetSlots: readonly unknown[];
  editablePresentationFields: readonly unknown[];
  exportName: string;
  supportedPageTypes?: readonly ("home" | "collection" | "content" | "landing")[];
  allowedNarrativeRoles?: readonly string[];
  anatomy?: RegisteredCommercialAnatomyInput;
  protectedReadOnlyPaths?: readonly string[];
}) {
  return define(
    {
      type,
      version: { major: 2, minor: 0, patch: 0 },
      title,
      merchantDescription: description,
      family,
      supportedPageTypes,
      variants,
      defaultVariant,
      industryTags: [],
      contentSchema: z.toJSONSchema(contentSchema),
      propsSchema: z.toJSONSchema(propsSchema),
      styleOverridesSchema: z.toJSONSchema(homepageSurfaceStyleSchema),
      contentSlots,
      commerceBindingSlots: [presentationContextSlot, copyContextSlot, ...extraBindingSlots],
      assetSlots,
      editablePresentationFields: [
        ...editablePresentationFields,
        {
          path: "styleOverrides.surface",
          label: { en: "Surface", fi: "Pinta" },
          source: "styleOverrides",
          control: "select",
          localized: false,
        },
      ],
      protectedFields: { readOnlyPaths: [...commonProtectedPaths, ...protectedReadOnlyPaths] },
      responsiveRules,
      accessibilityRequirements,
      designCompatibility: designCompatibilityFor(family, allowedNarrativeRoles),
      migration: stableMigration,
      renderer: {
        adapterId: "veskifyHomepageRenderer",
        exportName,
        supportedTargets: ["editor", "preview", "published"],
      },
    },
    anatomy,
  );
}

const promotionCommercialAnatomy: RegisteredCommercialAnatomyInput = {
  regions: [
    { id: "frame", required: true },
    { id: "media", required: false },
    { id: "content", required: true },
    { id: "heading", required: true },
    { id: "body", required: true },
    { id: "actions", required: false },
    { id: "merchandising", required: false },
  ],
  responsiveTransformations: [
    {
      id: "campaignSplitStack",
      mode: "stack",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "campaignSplit",
      toPresentationMode: "campaignStacked",
      affectedRegions: ["media", "content", "actions"],
    },
    {
      id: "campaignOverlaySwitch",
      mode: "switch-layout",
      breakpoints: ["mobile"],
      fromPresentationMode: "campaignOverlay",
      toPresentationMode: "campaignContained",
      affectedRegions: ["frame", "media", "content", "actions"],
    },
    {
      id: "campaignCondense",
      mode: "condense",
      breakpoints: ["mobile"],
      fromPresentationMode: "campaignMinimal",
      toPresentationMode: "campaignCompact",
      affectedRegions: ["content", "heading", "body", "actions"],
    },
    {
      id: "campaignEditorialReflow",
      mode: "reflow",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "campaignEditorial",
      toPresentationMode: "campaignEditorialStacked",
      affectedRegions: ["media", "content"],
    },
    {
      id: "campaignMediaFirst",
      mode: "reorder",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "campaignImageLed",
      toPresentationMode: "campaignImageFirstStacked",
      affectedRegions: ["media", "merchandising", "content", "actions"],
    },
  ],
  variants: [
    {
      variantId: "split",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["hierarchy", "assetPlacement", "ctaRelationship", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "content", "heading", "body", "actions", "media"],
        omittedRegions: ["merchandising"],
        assetPlacements: [{ slotId: "promotionMedia", region: "media" }],
        contentRelationship: "balanced",
        ctaRelationship: "inline",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["campaignSplitStack"],
        presentationMode: "campaignSplit",
      },
    },
    {
      variantId: "overlay",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "assetPlacement",
        "contentRelationship",
        "ctaRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "media", "content", "heading", "body", "actions"],
        omittedRegions: ["merchandising"],
        assetPlacements: [{ slotId: "promotionMedia", region: "frame" }],
        contentRelationship: "mediaLed",
        ctaRelationship: "overlay",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["campaignOverlaySwitch"],
        presentationMode: "campaignOverlay",
      },
    },
    {
      variantId: "minimal",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionPresence",
        "assetPlacement",
        "contentRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "content", "heading", "body", "actions"],
        omittedRegions: ["media", "merchandising"],
        assetPlacements: [],
        contentRelationship: "contentLed",
        ctaRelationship: "inline",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["campaignCondense"],
        presentationMode: "campaignMinimal",
      },
    },
    {
      variantId: "editorial",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "contentRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "content", "heading", "media", "body", "actions"],
        omittedRegions: ["merchandising"],
        assetPlacements: [{ slotId: "promotionMedia", region: "media" }],
        contentRelationship: "contentLed",
        ctaRelationship: "separated",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["campaignEditorialReflow"],
        presentationMode: "campaignEditorial",
      },
    },
    {
      variantId: "imageLed",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "regionPresence",
        "contentRelationship",
        "merchandisingEmphasis",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "media", "merchandising", "content", "heading", "body", "actions"],
        omittedRegions: [],
        assetPlacements: [{ slotId: "promotionMedia", region: "media" }],
        contentRelationship: "mediaLed",
        ctaRelationship: "separated",
        merchandisingEmphasis: "dominant",
        navigationModel: "none",
        responsiveTransformationIds: ["campaignMediaFirst"],
        presentationMode: "campaignImageLed",
      },
    },
  ],
};

export const homepagePromotionDefinition = marketingDefinition({
  type: "homepagePromotion",
  title: { en: "Promotional content", fi: "Kampanjasisältö" },
  description: {
    en: "Shows merchant-owned campaign copy, approved media and an approved navigation action.",
    fi: "Näyttää kauppiaan kampanjatekstin, hyväksytyn median ja hyväksytyn navigointitoiminnon.",
  },
  family: "marketing",
  supportedPageTypes: ["home", "landing", "collection"],
  allowedNarrativeRoles: ["campaign", "brand-story", "continuation"],
  anatomy: promotionCommercialAnatomy,
  variants: [
    { id: "split", title: { en: "Split", fi: "Jaettu" } },
    { id: "overlay", title: { en: "Overlay", fi: "Päällekkäinen" } },
    { id: "minimal", title: { en: "Minimal", fi: "Minimaalinen" } },
    { id: "editorial", title: { en: "Editorial", fi: "Toimituksellinen" } },
    { id: "imageLed", title: { en: "Image led", fi: "Kuvapainotteinen" } },
  ],
  defaultVariant: "split",
  contentSchema: homepagePromotionContentSchema,
  propsSchema: homepagePromotionPropsSchema,
  contentSlots: [
    { id: "heading", title: { en: "Heading", fi: "Otsikko" }, localized: true, required: true },
    {
      id: "description",
      title: { en: "Description", fi: "Kuvaus" },
      localized: true,
      required: true,
    },
    {
      id: "actionLabel",
      title: { en: "Action label", fi: "Toiminnon teksti" },
      localized: true,
      required: false,
    },
  ],
  extraBindingSlots: [
    {
      id: "promotionAsset",
      title: { en: "Promotional asset", fi: "Kampanjamedia" },
      acceptedSourceTypes: ["asset"],
      required: false,
      revisionRequired: true,
      emptyState: "hide",
    },
    {
      id: "promotionAction",
      title: { en: "Promotional navigation", fi: "Kampanjanavigointi" },
      acceptedSourceTypes: ["navigation"],
      required: false,
      revisionRequired: true,
      emptyState: "hide",
    },
  ],
  assetSlots: [
    {
      id: "promotionMedia",
      title: { en: "Promotional media", fi: "Kampanjamedia" },
      acceptedRoles: ["heroDesktop", "heroMobile", "editorialImage"],
      required: false,
      minItems: 0,
      maxItems: 1,
    },
  ],
  editablePresentationFields: [
    {
      path: "content.heading",
      label: { en: "Heading", fi: "Otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "content.description",
      label: { en: "Description", fi: "Kuvaus" },
      source: "content",
      control: "textarea",
      localized: true,
    },
    {
      path: "content.actionLabel",
      label: { en: "Action label", fi: "Toiminnon teksti" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "props.mediaPosition",
      label: { en: "Media position", fi: "Median sijainti" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.actionPresentation",
      label: { en: "Action presentation", fi: "Toiminnon esitystapa" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.textAlignment",
      label: { en: "Text alignment", fi: "Tekstin tasaus" },
      source: "props",
      control: "select",
      localized: false,
    },
  ],
  exportName: "HomepagePromotionSection",
});

export const homepageTrustDefinition = marketingDefinition({
  type: "homepageTrust",
  title: { en: "Trust and support", fi: "Luottamus ja tuki" },
  description: {
    en: "Presents localized delivery, returns, service and store-support copy without operational logic.",
    fi: "Esittää lokalisoidut toimitus-, palautus-, palvelu- ja myymälätukitekstit ilman operatiivista logiikkaa.",
  },
  family: "service",
  variants: [
    { id: "row", title: { en: "Row", fi: "Rivi" } },
    { id: "cards", title: { en: "Cards", fi: "Kortit" } },
    { id: "compact", title: { en: "Compact", fi: "Kompakti" } },
    { id: "threeColumn", title: { en: "Three columns", fi: "Kolme palstaa" } },
    { id: "minimal", title: { en: "Minimal", fi: "Minimaalinen" } },
  ],
  defaultVariant: "row",
  contentSchema: homepageTrustContentSchema,
  propsSchema: homepageTrustPropsSchema,
  contentSlots: [
    { id: "heading", title: { en: "Heading", fi: "Otsikko" }, localized: true, required: false },
    {
      id: "items",
      title: { en: "Trust items", fi: "Luottamussisällöt" },
      localized: true,
      required: true,
      maxItems: 6,
    },
    {
      id: "actionLabel",
      title: { en: "Support action label", fi: "Tukitoiminnon teksti" },
      localized: true,
      required: false,
    },
  ],
  extraBindingSlots: [
    {
      id: "supportAction",
      title: { en: "Support navigation", fi: "Tukinavigointi" },
      acceptedSourceTypes: ["navigation"],
      required: false,
      revisionRequired: true,
      emptyState: "hide",
    },
  ],
  assetSlots: [],
  editablePresentationFields: [
    {
      path: "content.heading",
      label: { en: "Heading", fi: "Otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "content.items",
      label: { en: "Trust items", fi: "Luottamussisällöt" },
      source: "content",
      control: "textarea",
      localized: true,
    },
    {
      path: "content.actionLabel",
      label: { en: "Support action", fi: "Tukitoiminto" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "props.columns",
      label: { en: "Columns", fi: "Sarakkeet" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.textAlignment",
      label: { en: "Text alignment", fi: "Tekstin tasaus" },
      source: "props",
      control: "select",
      localized: false,
    },
  ],
  exportName: "HomepageTrustSection",
});

const editorialCommercialAnatomy: RegisteredCommercialAnatomyInput = {
  regions: [
    { id: "frame", required: true },
    { id: "media", required: false },
    { id: "content", required: true },
    { id: "heading", required: true },
    { id: "body", required: true },
    { id: "actions", required: false },
    { id: "continuation", required: false },
  ],
  responsiveTransformations: [
    {
      id: "storySplitStack",
      mode: "stack",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "storyImageText",
      toPresentationMode: "storyStacked",
      affectedRegions: ["media", "content"],
    },
    {
      id: "storyReorder",
      mode: "reorder",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "storyBrandLed",
      toPresentationMode: "storyMediaFirst",
      affectedRegions: ["media", "content", "heading"],
    },
    {
      id: "processDisclosure",
      mode: "disclosure",
      breakpoints: ["mobile"],
      fromPresentationMode: "storyProcess",
      toPresentationMode: "storyProcessDisclosure",
      affectedRegions: ["body", "continuation"],
    },
    {
      id: "lookbookCarousel",
      mode: "carousel",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "storyLookbook",
      toPresentationMode: "storyLookbookCarousel",
      affectedRegions: ["media", "content"],
    },
    {
      id: "continuationCondense",
      mode: "condense",
      breakpoints: ["mobile"],
      fromPresentationMode: "storyContinuation",
      toPresentationMode: "storyContinuationCompact",
      affectedRegions: ["content", "body", "actions"],
    },
  ],
  variants: [
    {
      variantId: "imageText",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["hierarchy", "assetPlacement", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "content", "heading", "body", "actions", "media"],
        omittedRegions: ["continuation"],
        assetPlacements: [{ slotId: "storyMedia", region: "media" }],
        contentRelationship: "balanced",
        ctaRelationship: "inline",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["storySplitStack"],
        presentationMode: "storyImageText",
      },
    },
    {
      variantId: "brandStory",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "contentRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "media", "content", "heading", "body", "actions"],
        omittedRegions: ["continuation"],
        assetPlacements: [{ slotId: "storyMedia", region: "media" }],
        contentRelationship: "contentLed",
        ctaRelationship: "inline",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["storyReorder"],
        presentationMode: "storyBrandLed",
      },
    },
    {
      variantId: "craftProcess",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "regionPresence",
        "contentRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "content", "heading", "body", "continuation", "media"],
        omittedRegions: ["actions"],
        assetPlacements: [{ slotId: "storyMedia", region: "media" }],
        contentRelationship: "contentLed",
        ctaRelationship: "none",
        merchandisingEmphasis: "none",
        navigationModel: "disclosure",
        responsiveTransformationIds: ["processDisclosure"],
        presentationMode: "storyProcess",
      },
    },
    {
      variantId: "lookbookGallery",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "contentRelationship",
        "navigationModel",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "media", "content", "heading", "body"],
        omittedRegions: ["actions", "continuation"],
        assetPlacements: [{ slotId: "storyMedia", region: "media" }],
        contentRelationship: "mediaLed",
        ctaRelationship: "none",
        merchandisingEmphasis: "supporting",
        navigationModel: "carousel",
        responsiveTransformationIds: ["lookbookCarousel"],
        presentationMode: "storyLookbook",
      },
    },
    {
      variantId: "continuationCta",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionPresence",
        "assetPlacement",
        "contentRelationship",
        "ctaRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "content", "heading", "body", "actions"],
        omittedRegions: ["media", "continuation"],
        assetPlacements: [],
        contentRelationship: "supporting",
        ctaRelationship: "separated",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["continuationCondense"],
        presentationMode: "storyContinuation",
      },
    },
  ],
};

export const homepageEditorialDefinition = marketingDefinition({
  type: "homepageEditorial",
  title: { en: "Editorial storytelling", fi: "Toimituksellinen tarina" },
  description: {
    en: "Presents approved brand, craft, process, image-text, lookbook and continuation stories.",
    fi: "Esittää hyväksytyt brändi-, valmistus-, prosessi-, kuva-teksti-, lookbook- ja jatkotarinat.",
  },
  family: "content",
  supportedPageTypes: ["home", "collection", "content", "landing"],
  allowedNarrativeRoles: ["brand-story", "education", "campaign", "continuation"],
  variants: [
    { id: "imageText", title: { en: "Image and text", fi: "Kuva ja teksti" } },
    { id: "brandStory", title: { en: "Brand story", fi: "Bränditarina" } },
    { id: "craftProcess", title: { en: "Craft and process", fi: "Valmistus ja prosessi" } },
    { id: "lookbookGallery", title: { en: "Lookbook gallery", fi: "Lookbook-galleria" } },
    { id: "continuationCta", title: { en: "Continuation", fi: "Jatko" } },
  ],
  defaultVariant: "imageText",
  contentSchema: homepageEditorialContentSchema,
  propsSchema: homepageEditorialPropsSchema,
  contentSlots: [
    { id: "eyebrow", title: { en: "Eyebrow", fi: "Yläotsikko" }, localized: true, required: false },
    { id: "heading", title: { en: "Heading", fi: "Otsikko" }, localized: true, required: true },
    { id: "body", title: { en: "Body", fi: "Leipäteksti" }, localized: true, required: true },
    {
      id: "steps",
      title: { en: "Process steps", fi: "Prosessivaiheet" },
      localized: true,
      required: false,
      maxItems: 4,
    },
    {
      id: "actionLabel",
      title: { en: "Action", fi: "Toiminto" },
      localized: true,
      required: false,
    },
  ],
  extraBindingSlots: [
    ...(["storyPrimaryAsset", "storySecondaryAsset", "storyTertiaryAsset"] as const).map((id) => ({
      id,
      title: { en: "Editorial asset", fi: "Toimituksellinen media" },
      acceptedSourceTypes: ["asset"] as const,
      required: false,
      revisionRequired: true,
      emptyState: "hide" as const,
    })),
    {
      id: "editorialAction",
      title: { en: "Editorial navigation", fi: "Toimituksellinen navigointi" },
      acceptedSourceTypes: ["navigation"],
      required: false,
      revisionRequired: true,
      emptyState: "hide",
    },
  ],
  assetSlots: [
    {
      id: "storyMedia",
      title: { en: "Editorial media", fi: "Toimituksellinen media" },
      acceptedRoles: ["editorialImage", "heroDesktop", "heroMobile"],
      required: false,
      minItems: 0,
      maxItems: 3,
    },
  ],
  editablePresentationFields: [
    {
      path: "content.eyebrow",
      label: { en: "Eyebrow", fi: "Yläotsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "content.heading",
      label: { en: "Heading", fi: "Otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "content.body",
      label: { en: "Body", fi: "Leipäteksti" },
      source: "content",
      control: "textarea",
      localized: true,
    },
    {
      path: "content.steps",
      label: { en: "Process steps", fi: "Prosessivaiheet" },
      source: "content",
      control: "textarea",
      localized: true,
    },
    {
      path: "content.actionLabel",
      label: { en: "Action", fi: "Toiminto" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "props.mediaPosition",
      label: { en: "Media position", fi: "Median sijainti" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.textAlignment",
      label: { en: "Text alignment", fi: "Tekstin tasaus" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.galleryColumns",
      label: { en: "Gallery columns", fi: "Gallerian sarakkeet" },
      source: "props",
      control: "select",
      localized: false,
    },
  ],
  exportName: "HomepageEditorialSection",
  anatomy: editorialCommercialAnatomy,
});

const proofCommercialAnatomy: RegisteredCommercialAnatomyInput = {
  regions: [
    { id: "frame", required: true },
    { id: "content", required: true },
    { id: "heading", required: false },
    { id: "proof", required: true },
    { id: "service", required: false },
  ],
  responsiveTransformations: [
    {
      id: "quotePreserve",
      mode: "preserve",
      breakpoints: ["mobile", "tablet", "desktop", "wide"],
      fromPresentationMode: "proofQuote",
      toPresentationMode: "proofQuote",
      affectedRegions: ["content", "proof"],
    },
    {
      id: "proofGridStack",
      mode: "stack",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "proofGrid",
      toPresentationMode: "proofStacked",
      affectedRegions: ["proof", "content"],
    },
    {
      id: "serviceCondense",
      mode: "condense",
      breakpoints: ["mobile"],
      fromPresentationMode: "proofService",
      toPresentationMode: "proofServiceCompact",
      affectedRegions: ["service", "proof"],
    },
  ],
  variants: [
    {
      variantId: "quoteSpotlight",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["hierarchy", "contentRelationship", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "content", "heading", "proof"],
        omittedRegions: ["service"],
        assetPlacements: [],
        contentRelationship: "contentLed",
        ctaRelationship: "none",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["quotePreserve"],
        presentationMode: "proofQuote",
      },
    },
    {
      variantId: "proofGrid",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "contentRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "heading", "proof", "content"],
        omittedRegions: ["service"],
        assetPlacements: [],
        contentRelationship: "balanced",
        ctaRelationship: "none",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["proofGridStack"],
        presentationMode: "proofGrid",
      },
    },
    {
      variantId: "serviceAssurance",
      classification: "meaningfulStructuralVariant",
      materialDifferences: [
        "regionArrangement",
        "regionPresence",
        "contentRelationship",
        "responsiveTransformation",
        "presentationMode",
      ],
      finishingTokenIds: [],
      structure: {
        regionOrder: ["frame", "content", "heading", "service", "proof"],
        omittedRegions: [],
        assetPlacements: [],
        contentRelationship: "supporting",
        ctaRelationship: "none",
        merchandisingEmphasis: "none",
        navigationModel: "none",
        responsiveTransformationIds: ["serviceCondense"],
        presentationMode: "proofService",
      },
    },
  ],
};

export const homepageProofDefinition = marketingDefinition({
  type: "homepageProof",
  title: { en: "Evidence-grounded proof", fi: "Todennettu näyttö" },
  description: {
    en: "Presents only claims that retain canonical approved evidence references.",
    fi: "Esittää vain väitteet, joilla on kanoninen hyväksytty näyttöviite.",
  },
  family: "service",
  supportedPageTypes: ["home", "content", "landing"],
  allowedNarrativeRoles: ["brand-proof", "trust", "service"],
  variants: [
    { id: "quoteSpotlight", title: { en: "Quote spotlight", fi: "Lainausnosto" } },
    { id: "proofGrid", title: { en: "Proof grid", fi: "Näyttöruudukko" } },
    { id: "serviceAssurance", title: { en: "Service assurance", fi: "Palvelulupaus" } },
  ],
  defaultVariant: "quoteSpotlight",
  contentSchema: homepageProofContentSchema,
  propsSchema: homepageProofPropsSchema,
  contentSlots: [
    { id: "heading", title: { en: "Heading", fi: "Otsikko" }, localized: true, required: false },
  ],
  extraBindingSlots: [],
  assetSlots: [],
  editablePresentationFields: [
    {
      path: "content.heading",
      label: { en: "Heading", fi: "Otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "props.columns",
      label: { en: "Columns", fi: "Sarakkeet" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.textAlignment",
      label: { en: "Text alignment", fi: "Tekstin tasaus" },
      source: "props",
      control: "select",
      localized: false,
    },
  ],
  protectedReadOnlyPaths: ["content.items"],
  exportName: "HomepageProofSection",
  anatomy: proofCommercialAnatomy,
});

export function resolveHomepageProofContent(
  input: unknown,
  options: Readonly<{ required: boolean }>,
) {
  const content = homepageProofContentSchema.parse(input);
  if (content.items.length > 0) return content;
  if (options.required)
    throw new Error("Evidence-grounded proof requires current approved evidence.");
  return undefined;
}

export const homepageCommerceDefinitions = [
  homepageHeroDefinition,
  homepageFeaturedCollectionsDefinition,
  homepageFeaturedProductsDefinition,
  homepageCollectionNavigationDefinition,
  homepagePromotionDefinition,
  homepageTrustDefinition,
  homepageEditorialDefinition,
  homepageProofDefinition,
] as const;

type HomepageDataSchemas = {
  content: z.ZodType;
  props: z.ZodType;
};

const homepageDataSchemas: Readonly<Record<string, HomepageDataSchemas>> = {
  homepageHero: {
    content: homepageHeroContentSchema,
    props: homepageHeroPropsSchema,
  },
  homepageFeaturedCollections: {
    content: homepageFeaturedCollectionsContentSchema,
    props: homepageFeaturedCollectionsPropsSchema,
  },
  homepageFeaturedProducts: {
    content: homepageFeaturedProductsContentSchema,
    props: homepageFeaturedProductsPropsSchema,
  },
  homepageCollectionNavigation: {
    content: homepageCollectionNavigationContentSchema,
    props: homepageCollectionNavigationPropsSchema,
  },
  homepagePromotion: {
    content: homepagePromotionContentSchema,
    props: homepagePromotionPropsSchema,
  },
  homepageTrust: {
    content: homepageTrustContentSchema,
    props: homepageTrustPropsSchema,
  },
  homepageEditorial: {
    content: homepageEditorialContentSchema,
    props: homepageEditorialPropsSchema,
  },
  homepageProof: {
    content: homepageProofContentSchema,
    props: homepageProofPropsSchema,
  },
};

function validateHomepageData(instance: ComponentInstanceV2) {
  const schemas = homepageDataSchemas[instance.component];
  if (!schemas) return;
  for (const [label, schema, value] of [
    ["content", schemas.content, instance.content],
    ["props", schemas.props, instance.props],
    ["styleOverrides", homepageSurfaceStyleSchema, instance.styleOverrides],
  ] as const) {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid component ${label}: ${z.prettifyError(result.error)}`);
    }
  }
}

function hasBinding(instance: ComponentInstanceV2, slotId: string): boolean {
  return instance.bindings.some((binding) => binding.slotId === slotId);
}

function validateActionPair(instance: ComponentInstanceV2, label: unknown, bindingSlot: string) {
  const hasLabel = label !== undefined;
  const hasNavigation = hasBinding(instance, bindingSlot);
  if (hasLabel !== hasNavigation) {
    throw new Error(
      `Homepage action label and canonical navigation binding ${bindingSlot} must be supplied together.`,
    );
  }
}

function validateHomepageInstance(instance: ComponentInstanceV2) {
  validateHomepageData(instance);
  switch (instance.component) {
    case "homepageHero": {
      const content = homepageHeroContentSchema.parse(instance.content);
      validateActionPair(instance, content.primaryActionLabel, "primaryAction");
      validateActionPair(instance, content.secondaryActionLabel, "secondaryAction");
      if (
        instance.variant === "restrained" &&
        (hasBinding(instance, "heroAsset") ||
          instance.assetAssignments.some((assignment) => assignment.slotId === "heroMedia"))
      ) {
        throw new Error("Restrained copy-first heroes cannot retain a hero-media binding.");
      }
      if (instance.variant === "campaignMerchandising" && !content.eyebrow) {
        throw new Error("Campaign merchandising heroes require an approved campaign eyebrow.");
      }
      break;
    }
    case "homepagePromotion": {
      const content = homepagePromotionContentSchema.parse(instance.content);
      validateActionPair(instance, content.actionLabel, "promotionAction");
      break;
    }
    case "homepageTrust": {
      const content = homepageTrustContentSchema.parse(instance.content);
      validateActionPair(instance, content.actionLabel, "supportAction");
      break;
    }
    case "homepageEditorial": {
      const content = homepageEditorialContentSchema.parse(instance.content);
      validateActionPair(instance, content.actionLabel, "editorialAction");
      if (
        instance.variant === "continuationCta" &&
        (instance.bindings.some((binding) => binding.source === "asset") ||
          instance.assetAssignments.some((assignment) => assignment.slotId === "storyMedia"))
      ) {
        throw new Error("Continuation editorial compositions cannot retain story media.");
      }
      if (instance.variant === "craftProcess" && content.steps.length === 0) {
        throw new Error(
          "Craft and process editorial composition requires at least one process step.",
        );
      }
      break;
    }
    case "homepageProof": {
      resolveHomepageProofContent(instance.content, { required: true });
      break;
    }
  }
}

function productAssetRole(
  role: ProductPresentationContext["media"][number]["role"],
): StorefrontAssetMetadata["role"] {
  if (role === "main") return "productMainImage";
  if (role === "editorial") return "editorialImage";
  return "productAlternativeImage";
}

type ProductListBinding = Extract<
  ComponentInstanceV2["bindings"][number],
  { source: "productList" }
>;

function productListBindingFor(
  instance: ComponentInstanceV2,
  slotId: string,
): ProductListBinding | undefined {
  return instance.bindings.find(
    (binding): binding is ProductListBinding =>
      binding.source === "productList" && binding.slotId === slotId,
  );
}

function validateHomepageProductMediaConformance(
  instance: ComponentInstanceV2,
  projection: ComponentProjectionContext,
) {
  const productBinding = productListBindingFor(instance, "products");
  if (!productBinding || instance.component !== "homepageFeaturedProducts") return;

  const products = new Map(projection.products.map((product) => [product.productId, product]));
  const assets = new Map(projection.assets.map((asset) => [asset.assetId, asset]));
  const canonicalMedia = new Map<
    string,
    { productIds: Set<string>; expectedRole: StorefrontAssetMetadata["role"] }
  >();
  const selectedMedia = new Map<string, StorefrontAssetMetadata["role"]>();

  for (const productId of productBinding.productIds) {
    const product = products.get(productId);
    if (!product) continue;
    for (const media of product.media) {
      const expectedRole = productAssetRole(media.role);
      const existing = canonicalMedia.get(media.assetId);
      if (existing && existing.expectedRole !== expectedRole) {
        throw new Error(
          `Canonical product media cannot use conflicting roles across bound products: ${media.assetId}.`,
        );
      }
      if (existing) {
        existing.productIds.add(productId);
      } else {
        canonicalMedia.set(media.assetId, { productIds: new Set([productId]), expectedRole });
      }
    }
    const selected = product.media.find((media) => {
      const metadata = assets.get(media.assetId);
      return (
        metadata?.approvalStatus === "approved" &&
        metadata.role === productAssetRole(media.role) &&
        metadata.provenance.kind === "canonicalProductMedia"
      );
    });
    if (selected) selectedMedia.set(selected.assetId, productAssetRole(selected.role));
  }

  const assignments = instance.assetAssignments.filter(
    (assignment) => assignment.slotId === "productMedia",
  );
  if (assignments.length === 0) return;

  const assigned = new Map(assignments.map((assignment) => [assignment.assetId, assignment.role]));
  for (const assignment of assignments) {
    const relation = canonicalMedia.get(assignment.assetId);
    if (!relation) {
      throw new Error(
        `Product media assignment does not belong to a product in the bound product list: ${assignment.assetId}.`,
      );
    }
    if (assignment.role !== relation.expectedRole) {
      throw new Error(
        `Product media assignment role does not match canonical product media: ${assignment.assetId}.`,
      );
    }
    const metadata = assets.get(assignment.assetId);
    if (metadata?.provenance.kind !== "canonicalProductMedia") {
      throw new Error(
        `Product media assignment must preserve canonical product-media provenance: ${assignment.assetId}.`,
      );
    }
    if (!selectedMedia.has(assignment.assetId)) {
      throw new Error(
        `Product media assignment is not the deterministic first compatible media: ${assignment.assetId}.`,
      );
    }
  }
  for (const [assetId, expectedRole] of selectedMedia) {
    if (assigned.get(assetId) !== expectedRole) {
      throw new Error(`Missing canonical homepage product-media assignment: ${assetId}.`);
    }
  }
}

export const homepageCommerceInstanceValidationContracts: ComponentInstanceValidationContracts =
  Object.fromEntries(
    homepageCommerceDefinitions.map((definition) => [
      definition.type,
      {
        validateInstance: validateHomepageInstance,
        validateConformance:
          definition.type === "homepageFeaturedProducts"
            ? validateHomepageProductMediaConformance
            : undefined,
      },
    ]),
  );

export type HomepageHeroContent = z.infer<typeof homepageHeroContentSchema>;
export type HomepageHeroProps = z.infer<typeof homepageHeroPropsSchema>;
export type HomepageFeaturedCollectionsContent = z.infer<
  typeof homepageFeaturedCollectionsContentSchema
>;
export type HomepageFeaturedCollectionsProps = z.infer<
  typeof homepageFeaturedCollectionsPropsSchema
>;
export type HomepageFeaturedProductsContent = z.infer<typeof homepageFeaturedProductsContentSchema>;
export type HomepageFeaturedProductsProps = z.infer<typeof homepageFeaturedProductsPropsSchema>;
export type HomepageCollectionNavigationContent = z.infer<
  typeof homepageCollectionNavigationContentSchema
>;
export type HomepageCollectionNavigationProps = z.infer<
  typeof homepageCollectionNavigationPropsSchema
>;
export type HomepagePromotionContent = z.infer<typeof homepagePromotionContentSchema>;
export type HomepagePromotionProps = z.infer<typeof homepagePromotionPropsSchema>;
export type HomepageTrustContent = z.infer<typeof homepageTrustContentSchema>;
export type HomepageTrustProps = z.infer<typeof homepageTrustPropsSchema>;
export type HomepageEditorialContent = z.infer<typeof homepageEditorialContentSchema>;
export type HomepageEditorialProps = z.infer<typeof homepageEditorialPropsSchema>;
export type HomepageProofContent = z.infer<typeof homepageProofContentSchema>;
export type HomepageProofProps = z.infer<typeof homepageProofPropsSchema>;
export type HomepageSurfaceStyle = z.infer<typeof homepageSurfaceStyleSchema>;
