import { z } from "zod";
import {
  validateComponentDefinitionV2,
  type ComponentDefinitionV2,
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
    columns: z.number().int().min(2).max(6),
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
    { id: "editorialSplit", title: { en: "Editorial split", fi: "Toimituksellinen jako" } },
    { id: "imageLed", title: { en: "Image led", fi: "Kuvapainotteinen" } },
    { id: "minimal", title: { en: "Minimal", fi: "Minimaalinen" } },
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
    acceptedRoles: ["productMainImage", "productAlternativeImage", "editorialImage"],
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
