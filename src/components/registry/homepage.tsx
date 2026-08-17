import { z } from "zod";
import { assetRefSchema, localizedTextSchema, safeExternalUrlSchema } from "@/domain/shared";
import {
  AnnouncementBar,
  BenefitIcons,
  BrandStory,
  CampaignBanner,
  FeaturedCategories,
  Newsletter,
  ProductGrid,
  StoreFooter,
  StoreHeader,
} from "@/components/storefront/homepage-sections";
import { defineComponent, type StorefrontRenderContext } from "./contract";
import {
  ctaPresentationSchema,
  designVocabularyDefaults,
  designVocabularyVariants,
  ctaPresentationEditorField,
  sectionAlignmentSchema,
  sectionAlignmentEditorField,
  sectionStyleEditorFields,
  sectionStyleSchema,
  sectionVocabularyClass,
} from "./design-vocabulary";

const localAssetSchema = assetRefSchema.refine((asset) => asset.url.startsWith("/seed-assets/"), {
  message: "Storefront media must use a controlled local seed asset.",
});
const safeHrefSchema = z.union([z.string().regex(/^\/(?:[a-z0-9-]+\/?)*$/), safeExternalUrlSchema]);
const linkSchema = z.object({ label: localizedTextSchema, href: safeHrefSchema }).strict();
const uniqueIds = (message: string) =>
  z.array(z.string().min(3)).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message });
  });

function requireReferences(ids: string[], known: ReadonlySet<string>, kind: string) {
  ids.forEach((id) => {
    if (!known.has(id)) throw new Error(`Unknown ${kind} reference: ${id}.`);
  });
}

export const announcementBarContentSchema = z
  .object({ message: localizedTextSchema, link: linkSchema.optional() })
  .strict();
export const announcementBarPropsSchema = z
  .object({ tone: z.enum(["primary", "accent"]), ...sectionStyleSchema })
  .strict();
export const announcementBarDefinition = defineComponent({
  type: "announcementBar",
  label: "Announcement bar",
  allowedPageTypes: ["home"],
  variants: designVocabularyVariants.announcementBar,
  defaultVariant: designVocabularyDefaults.announcementBar,
  contentSchema: announcementBarContentSchema,
  propsSchema: announcementBarPropsSchema,
  defaultContent: {
    message: { en: "Complimentary delivery in Finland", fi: "Maksuton toimitus Suomessa" },
  },
  defaultProps: { tone: "primary" },
  editorFields: {
    message: { source: "content", control: "text", label: "Announcement", localized: true },
    tone: {
      source: "props",
      control: "select",
      label: "Tone",
      options: [
        { label: "Primary", value: "primary" },
        { label: "Accent", value: "accent" },
      ],
    },
    ...sectionStyleEditorFields,
  },
  protectedFields: { readOnlyPaths: [] },
  renderer: ({ variant, content, props, context }) => (
    <AnnouncementBar
      {...content}
      {...props}
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

export const headerContentSchema = z.object({ brandName: z.string().min(1).max(80) }).strict();
export const headerPropsSchema = z
  .object({ showSearch: z.boolean(), showCart: z.boolean(), ...sectionStyleSchema })
  .strict();
export const headerDefinition = defineComponent({
  type: "header",
  label: "Store header",
  allowedPageTypes: ["home", "collection", "product"],
  variants: designVocabularyVariants.header,
  defaultVariant: designVocabularyDefaults.header,
  contentSchema: headerContentSchema,
  propsSchema: headerPropsSchema,
  defaultContent: { brandName: "Aurum Nordic" },
  defaultProps: { showSearch: true, showCart: true },
  editorFields: {
    brandName: { source: "content", control: "text", label: "Brand name" },
    showSearch: {
      source: "props",
      control: "select",
      label: "Search control",
      valueType: "boolean",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    showCart: {
      source: "props",
      control: "select",
      label: "Cart demo control",
      valueType: "boolean",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    ...sectionStyleEditorFields,
  },
  protectedFields: { readOnlyPaths: ["navigation"] },
  renderer: ({
    variant,
    content,
    props,
    approvedAssetPlacements,
    approvedAssetPresentations,
    context,
  }) => (
    <StoreHeader
      {...content}
      {...props}
      approvedAssetPlacements={approvedAssetPlacements}
      approvedAssetPresentations={approvedAssetPresentations}
      className={sectionVocabularyClass(variant, props)}
      context={context}
      variant={variant}
    />
  ),
});

export const featuredCategoriesContentSchema = z
  .object({
    heading: localizedTextSchema,
    collectionIds: uniqueIds("Collection references must not contain duplicates."),
  })
  .strict();
export const featuredCategoriesPropsSchema = z
  .object({
    cardAspect: z.enum(["portrait", "square"]),
    alignment: sectionAlignmentSchema.default("left"),
    ...sectionStyleSchema,
  })
  .strict();
export const featuredCategoriesDefinition = defineComponent({
  type: "featuredCategories",
  label: "Featured categories",
  allowedPageTypes: ["home"],
  variants: designVocabularyVariants.featuredCategories,
  defaultVariant: designVocabularyDefaults.featuredCategories,
  contentSchema: featuredCategoriesContentSchema,
  propsSchema: featuredCategoriesPropsSchema,
  defaultContent: {
    heading: { en: "Find your piece", fi: "Löydä oma korusi" },
    collectionIds: ["collection_rings"],
  },
  defaultProps: { cardAspect: "portrait" },
  editorFields: {
    heading: { source: "content", control: "text", label: "Heading", localized: true },
    cardAspect: {
      source: "props",
      control: "select",
      label: "Card shape",
      options: [
        { label: "Portrait", value: "portrait" },
        { label: "Square", value: "square" },
      ],
    },
    alignment: sectionAlignmentEditorField,
    ...sectionStyleEditorFields,
  },
  protectedFields: { readOnlyPaths: ["collectionIds"] },
  validateContext: ({ content, context }) =>
    requireReferences(
      content.collectionIds,
      new Set(context.catalogue.collections.map((item) => item.id)),
      "collection",
    ),
  renderer: ({ variant, content, props, context }) => (
    <FeaturedCategories
      {...content}
      {...props}
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

export const productGridContentSchema = z
  .object({
    heading: localizedTextSchema,
    productIds: uniqueIds("Product references must not contain duplicates."),
  })
  .strict();
export const productGridPropsSchema = z
  .object({
    columns: z.enum(["two", "three", "four"]),
    alignment: sectionAlignmentSchema.default("left"),
    ...sectionStyleSchema,
  })
  .strict();
export const productGridDefinition = defineComponent({
  type: "productGrid",
  label: "Product grid",
  allowedPageTypes: ["home", "collection"],
  variants: designVocabularyVariants.productGrid,
  defaultVariant: designVocabularyDefaults.productGrid,
  contentSchema: productGridContentSchema,
  propsSchema: productGridPropsSchema,
  defaultContent: {
    heading: { en: "Aurum favourites", fi: "Aurumin suosikit" },
    productIds: ["product_aurora_ring_585"],
  },
  defaultProps: { columns: "three" },
  editorFields: {
    heading: { source: "content", control: "text", label: "Heading", localized: true },
    columns: {
      source: "props",
      control: "select",
      label: "Columns",
      options: [
        { label: "Two", value: "two" },
        { label: "Three", value: "three" },
        { label: "Four", value: "four" },
      ],
    },
    alignment: sectionAlignmentEditorField,
    ...sectionStyleEditorFields,
  },
  protectedFields: {
    readOnlyPaths: [
      "productIds",
      "catalogue.products.*.id",
      "catalogue.products.*.sku",
      "catalogue.products.*.price",
      "catalogue.products.*.stockStatus",
      "catalogue.products.*.images",
    ],
  },
  validateContext: ({ content, context }) =>
    requireReferences(
      content.productIds,
      new Set(context.catalogue.products.map((item) => item.id)),
      "product",
    ),
  renderer: ({ variant, content, props, context }) => (
    <ProductGrid
      {...content}
      {...props}
      anatomyId={
        variant === "editorial" ? "editorial" : variant === "compact" ? "compact" : "standard"
      }
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

const editorialContentSchema = z
  .object({ heading: localizedTextSchema, body: localizedTextSchema, media: localAssetSchema })
  .strict();
export const campaignBannerContentSchema = editorialContentSchema
  .extend({ cta: linkSchema })
  .strict();
export const campaignBannerPropsSchema = z
  .object({
    mediaPosition: z.enum(["left", "right"]),
    alignment: sectionAlignmentSchema.default("left"),
    ctaPresentation: ctaPresentationSchema.default("primary"),
    ...sectionStyleSchema,
  })
  .strict();
export const campaignBannerDefinition = defineComponent({
  type: "campaignBanner",
  label: "Campaign banner",
  allowedPageTypes: ["home", "landing"],
  variants: designVocabularyVariants.campaignBanner,
  defaultVariant: designVocabularyDefaults.campaignBanner,
  contentSchema: campaignBannerContentSchema,
  propsSchema: campaignBannerPropsSchema,
  defaultContent: {
    heading: { en: "A quiet kind of brilliance", fi: "Hiljaista loistoa" },
    body: {
      en: "Pieces for every northern season.",
      fi: "Koruja pohjoisen jokaiseen vuodenaikaan.",
    },
    cta: { label: { en: "Explore rings", fi: "Tutustu sormuksiin" }, href: "/collections/rings" },
    media: {
      id: "asset_campaign_default",
      url: "/seed-assets/lumi-halo-ring.svg",
      alt: { en: "White gold ring", fi: "Valkokultainen sormus" },
      decorative: false,
    },
  },
  defaultProps: { mediaPosition: "left" },
  editorFields: {
    heading: { source: "content", control: "text", label: "Heading", localized: true },
    body: { source: "content", control: "textarea", label: "Copy", localized: true },
    mediaPosition: {
      source: "props",
      control: "select",
      label: "Image position",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    alignment: sectionAlignmentEditorField,
    ctaPresentation: ctaPresentationEditorField,
    ...sectionStyleEditorFields,
  },
  protectedFields: { readOnlyPaths: ["media.url"] },
  renderer: ({ variant, content, props, context }) => (
    <CampaignBanner
      {...content}
      {...props}
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

export const brandStoryContentSchema = z
  .object({
    eyebrow: localizedTextSchema.optional(),
    heading: localizedTextSchema,
    body: localizedTextSchema,
    media: assetRefSchema.optional(),
    approvedAssetId: z.string().min(3).optional(),
    facts: z
      .array(z.object({ value: z.string().min(1).max(20), label: localizedTextSchema }).strict())
      .min(0)
      .max(4),
  })
  .strict()
  .refine((content) => content.media !== undefined || content.approvedAssetId !== undefined, {
    message: "Brand story requires registered media or an approved asset reference.",
  });
export const brandStoryPropsSchema = z
  .object({
    imagePosition: z.enum(["left", "right"]),
    alignment: sectionAlignmentSchema.default("left"),
    ...sectionStyleSchema,
  })
  .strict();
export const brandStoryDefinition = defineComponent({
  type: "brandStory",
  label: "Brand story",
  allowedPageTypes: ["home", "content"],
  variants: designVocabularyVariants.brandStory,
  defaultVariant: designVocabularyDefaults.brandStory,
  contentSchema: brandStoryContentSchema,
  propsSchema: brandStoryPropsSchema,
  defaultContent: {
    eyebrow: { en: "Our story", fi: "Tarina" },
    heading: { en: "Designed in Helsinki", fi: "Suunniteltu Helsingissä" },
    body: {
      en: "Nordic clarity, made personal.",
      fi: "Pohjoismaista selkeyttä, henkilökohtaisesti.",
    },
    media: {
      id: "asset_story_default",
      url: "/seed-assets/aava-necklace.svg",
      alt: { en: "Silver necklace", fi: "Hopeakaulakoru" },
      decorative: false,
    },
    facts: [{ value: "2014", label: { en: "Founded", fi: "Perustettu" } }],
  },
  defaultProps: { imagePosition: "right" },
  editorFields: {
    eyebrow: { source: "content", control: "text", label: "Eyebrow", localized: true },
    heading: { source: "content", control: "text", label: "Heading", localized: true },
    body: { source: "content", control: "textarea", label: "Story", localized: true },
    imagePosition: {
      source: "props",
      control: "select",
      label: "Image position",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    alignment: sectionAlignmentEditorField,
    ...sectionStyleEditorFields,
  },
  protectedFields: { readOnlyPaths: ["media.url", "approvedAssetId"] },
  renderer: ({ variant, content, props, context }) => (
    <BrandStory
      {...content}
      {...props}
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

const benefitSchema = z
  .object({
    icon: z.enum(["craft", "delivery", "care"]),
    title: localizedTextSchema,
    text: localizedTextSchema,
  })
  .strict();
export const benefitIconsContentSchema = z
  .object({ benefits: z.array(benefitSchema).min(3).max(4) })
  .strict();
export const benefitIconsPropsSchema = z
  .object({ alignment: sectionAlignmentSchema.default("center"), ...sectionStyleSchema })
  .strict();
export const benefitIconsDefinition = defineComponent({
  type: "benefitIcons",
  label: "Benefits",
  allowedPageTypes: ["home", "product", "cart"],
  variants: designVocabularyVariants.benefitIcons,
  defaultVariant: designVocabularyDefaults.benefitIcons,
  contentSchema: benefitIconsContentSchema,
  propsSchema: benefitIconsPropsSchema,
  defaultContent: {
    benefits: [
      {
        icon: "craft",
        title: { en: "Considered craft", fi: "Harkittu käsityö" },
        text: { en: "Materials chosen to last.", fi: "Kestämään valitut materiaalit." },
      },
      {
        icon: "delivery",
        title: { en: "Complimentary delivery", fi: "Maksuton toimitus" },
        text: { en: "Dummy delivery presentation.", fi: "Toimituksen demosisältö." },
      },
      {
        icon: "care",
        title: { en: "Here to help", fi: "Autamme mielellämme" },
        text: { en: "Demo care guidance.", fi: "Huollon demoneuvonta." },
      },
    ],
  },
  defaultProps: { alignment: "center" },
  editorFields: {
    alignment: sectionAlignmentEditorField,
    ...sectionStyleEditorFields,
  },
  protectedFields: { readOnlyPaths: ["benefits.*.icon"] },
  renderer: ({ variant, content, props, context }) => (
    <BenefitIcons
      {...content}
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

export const newsletterContentSchema = z
  .object({
    heading: localizedTextSchema,
    body: localizedTextSchema,
    emailLabel: localizedTextSchema,
    buttonLabel: localizedTextSchema,
  })
  .strict();
export const newsletterPropsSchema = z
  .object({
    demoOnly: z.literal(true),
    alignment: sectionAlignmentSchema.default("left"),
    ...sectionStyleSchema,
  })
  .strict();
export const newsletterDefinition = defineComponent({
  type: "newsletter",
  label: "Newsletter",
  allowedPageTypes: ["home"],
  variants: designVocabularyVariants.newsletter,
  defaultVariant: designVocabularyDefaults.newsletter,
  contentSchema: newsletterContentSchema,
  propsSchema: newsletterPropsSchema,
  defaultContent: {
    heading: { en: "Notes from the north", fi: "Terveisiä pohjoisesta" },
    body: {
      en: "Stories and new pieces, occasionally.",
      fi: "Tarinoita ja uutuuksia silloin tällöin.",
    },
    emailLabel: { en: "Email address", fi: "Sähköpostiosoite" },
    buttonLabel: { en: "Join the journal", fi: "Liity uutiskirjeeseen" },
  },
  defaultProps: { demoOnly: true },
  editorFields: {
    heading: { source: "content", control: "text", label: "Heading", localized: true },
    body: { source: "content", control: "textarea", label: "Copy", localized: true },
    alignment: sectionAlignmentEditorField,
    ...sectionStyleEditorFields,
  },
  protectedFields: { readOnlyPaths: ["demoOnly"] },
  renderer: ({ sectionId, variant, content, props, context }) => (
    <Newsletter
      {...content}
      className={sectionVocabularyClass(variant, props)}
      context={context}
      sectionId={sectionId}
    />
  ),
});

export const footerContentSchema = z
  .object({
    brandName: z.string().min(1),
    contact: localizedTextSchema,
    policyLabel: localizedTextSchema,
    copyright: localizedTextSchema,
  })
  .strict();
export const footerPropsSchema = z
  .object({ showPolicies: z.boolean(), ...sectionStyleSchema })
  .strict();
export const footerDefinition = defineComponent({
  type: "footer",
  label: "Store footer",
  allowedPageTypes: ["home", "collection", "product"],
  variants: designVocabularyVariants.footer,
  defaultVariant: designVocabularyDefaults.footer,
  contentSchema: footerContentSchema,
  propsSchema: footerPropsSchema,
  defaultContent: {
    brandName: "Aurum Nordic",
    contact: { en: "Helsinki · hello@example.test", fi: "Helsinki · hello@example.test" },
    policyLabel: { en: "Delivery · Returns · Privacy", fi: "Toimitus · Palautukset · Tietosuoja" },
    copyright: { en: "© Aurum Nordic demo", fi: "© Aurum Nordic -demo" },
  },
  defaultProps: { showPolicies: true },
  editorFields: {
    contact: { source: "content", control: "text", label: "Contact", localized: true },
    ...sectionStyleEditorFields,
  },
  protectedFields: { readOnlyPaths: ["navigation", "policyLabel"] },
  renderer: ({ variant, content, props, context }) => (
    <StoreFooter
      {...content}
      {...props}
      className={sectionVocabularyClass(variant, props)}
      context={context}
      variant={variant}
    />
  ),
});

export const homepageDefinitions = {
  announcementBar: announcementBarDefinition,
  header: headerDefinition,
  featuredCategories: featuredCategoriesDefinition,
  productGrid: productGridDefinition,
  campaignBanner: campaignBannerDefinition,
  brandStory: brandStoryDefinition,
  benefitIcons: benefitIconsDefinition,
  newsletter: newsletterDefinition,
  footer: footerDefinition,
} as const;

export function validateCatalogueReferences(
  context: StorefrontRenderContext,
  type: "products" | "collections",
  ids: string[],
) {
  const known = new Set(context.catalogue[type].map((item) => item.id));
  requireReferences(ids, known, type === "products" ? "product" : "collection");
}
