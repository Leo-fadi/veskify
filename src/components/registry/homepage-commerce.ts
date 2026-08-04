import { z } from "zod";
import {
  boundedParameterDefinitions,
  createLegacyComponentDesignCompatibility,
  validateComponentDefinitionV2,
  type ComponentDefinitionV2,
  type ComponentInstanceV2,
  type ComponentInstanceValidationContracts,
  type ComponentProjectionContext,
  type ProductPresentationContext,
  type StorefrontAssetMetadata,
} from "@/domain/component-platform";
import { idSchema, localizedTextSchema } from "@/domain/shared";

const localizedActionLabelSchema = localizedTextSchema.optional();

export const homepageSurfaceStyleSchema = z
  .object({ surface: z.enum(["plain", "soft", "contrast"]) })
  .strict();

export const homepageHeroContentSchema = z
  .object({
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

function define(input: unknown): ComponentDefinitionV2 {
  return validateComponentDefinitionV2(input);
}

function designCompatibilityFor(family: "commerce" | "marketing" | "navigation" | "service") {
  const compatibility = createLegacyComponentDesignCompatibility();
  return {
    ...compatibility,
    boundedParameterIds: boundedParameterDefinitions
      .filter((parameter) => parameter.compatibleComponentFamilies.includes(family))
      .map((parameter) => parameter.id),
  };
}

export const homepageHeroDefinition = define({
  type: "homepageHero",
  version: { major: 2, minor: 0, patch: 0 },
  title: { en: "Homepage hero", fi: "Etusivun pääosio" },
  merchantDescription: {
    en: "Introduces the storefront with approved media, localized copy and navigation actions.",
    fi: "Esittelee kaupan hyväksytyllä medialla, lokalisoidulla tekstillä ja navigointitoiminnoilla.",
  },
  family: "marketing",
  supportedPageTypes: ["home"],
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
  ],
  defaultVariant: "editorialSplit",
  industryTags: [],
  contentSchema: z.toJSONSchema(homepageHeroContentSchema),
  propsSchema: z.toJSONSchema(homepageHeroPropsSchema),
  styleOverridesSchema: z.toJSONSchema(homepageSurfaceStyleSchema),
  contentSlots: [
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
  designCompatibility: designCompatibilityFor("marketing"),
  migration: stableMigration,
  renderer: {
    adapterId: "veskifyHomepageRenderer",
    exportName: "HomepageHeroSection",
    supportedTargets: ["editor", "preview", "published"],
  },
});

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
}: {
  type: string;
  title: { en: string; fi: string };
  description: { en: string; fi: string };
  family: "marketing" | "service";
  variants: readonly { id: string; title: { en: string; fi: string } }[];
  defaultVariant: string;
  contentSchema: z.ZodType;
  propsSchema: z.ZodType;
  contentSlots: readonly unknown[];
  extraBindingSlots: readonly unknown[];
  assetSlots: readonly unknown[];
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

export const homepagePromotionDefinition = marketingDefinition({
  type: "homepagePromotion",
  title: { en: "Promotional content", fi: "Kampanjasisältö" },
  description: {
    en: "Shows merchant-owned campaign copy, approved media and an approved navigation action.",
    fi: "Näyttää kauppiaan kampanjatekstin, hyväksytyn median ja hyväksytyn navigointitoiminnon.",
  },
  family: "marketing",
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

export const homepageCommerceDefinitions = [
  homepageHeroDefinition,
  homepageFeaturedCollectionsDefinition,
  homepageFeaturedProductsDefinition,
  homepageCollectionNavigationDefinition,
  homepagePromotionDefinition,
  homepageTrustDefinition,
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
export type HomepageSurfaceStyle = z.infer<typeof homepageSurfaceStyleSchema>;
