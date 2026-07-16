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
  .object({ tone: z.enum(["primary", "accent"]) })
  .strict();
export const announcementBarDefinition = defineComponent({
  type: "announcementBar",
  label: "Announcement bar",
  allowedPageTypes: ["home"],
  variants: ["singleLine"] as const,
  defaultVariant: "singleLine",
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
  },
  protectedFields: { readOnlyPaths: [] },
  renderer: ({ content, props, context }) => (
    <AnnouncementBar {...content} {...props} context={context} />
  ),
});

export const headerContentSchema = z.object({ brandName: z.string().min(1).max(80) }).strict();
export const headerPropsSchema = z
  .object({ showSearch: z.boolean(), showCart: z.boolean() })
  .strict();
export const headerDefinition = defineComponent({
  type: "header",
  label: "Store header",
  allowedPageTypes: ["home", "collection"],
  variants: ["centered"] as const,
  defaultVariant: "centered",
  contentSchema: headerContentSchema,
  propsSchema: headerPropsSchema,
  defaultContent: { brandName: "Aurum Nordic" },
  defaultProps: { showSearch: true, showCart: true },
  editorFields: { brandName: { source: "content", control: "text", label: "Brand name" } },
  protectedFields: { readOnlyPaths: ["navigation"] },
  renderer: ({ content, props, context }) => (
    <StoreHeader {...content} {...props} context={context} />
  ),
});

export const featuredCategoriesContentSchema = z
  .object({
    heading: localizedTextSchema,
    collectionIds: uniqueIds("Collection references must not contain duplicates."),
  })
  .strict();
export const featuredCategoriesPropsSchema = z
  .object({ cardAspect: z.enum(["portrait", "square"]) })
  .strict();
export const featuredCategoriesDefinition = defineComponent({
  type: "featuredCategories",
  label: "Featured categories",
  allowedPageTypes: ["home"],
  variants: ["editorialCards"] as const,
  defaultVariant: "editorialCards",
  contentSchema: featuredCategoriesContentSchema,
  propsSchema: featuredCategoriesPropsSchema,
  defaultContent: {
    heading: { en: "Find your piece", fi: "Löydä oma korusi" },
    collectionIds: ["collection_rings"],
  },
  defaultProps: { cardAspect: "portrait" },
  editorFields: {
    heading: { source: "content", control: "text", label: "Heading", localized: true },
  },
  protectedFields: { readOnlyPaths: ["collectionIds"] },
  validateContext: ({ content, context }) =>
    requireReferences(
      content.collectionIds,
      new Set(context.catalogue.collections.map((item) => item.id)),
      "collection",
    ),
  renderer: ({ content, props, context }) => (
    <FeaturedCategories {...content} {...props} context={context} />
  ),
});

export const productGridContentSchema = z
  .object({
    heading: localizedTextSchema,
    productIds: uniqueIds("Product references must not contain duplicates."),
  })
  .strict();
export const productGridPropsSchema = z
  .object({ columns: z.enum(["two", "three", "four"]) })
  .strict();
export const productGridDefinition = defineComponent({
  type: "productGrid",
  label: "Product grid",
  allowedPageTypes: ["home", "collection"],
  variants: ["editorial"] as const,
  defaultVariant: "editorial",
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
  },
  protectedFields: {
    readOnlyPaths: ["productIds", "catalogue.products.*.price", "catalogue.products.*.stockStatus"],
  },
  validateContext: ({ content, context }) =>
    requireReferences(
      content.productIds,
      new Set(context.catalogue.products.map((item) => item.id)),
      "product",
    ),
  renderer: ({ content, props, context }) => (
    <ProductGrid {...content} {...props} context={context} />
  ),
});

const editorialContentSchema = z
  .object({ heading: localizedTextSchema, body: localizedTextSchema, media: localAssetSchema })
  .strict();
export const campaignBannerContentSchema = editorialContentSchema
  .extend({ cta: linkSchema })
  .strict();
export const campaignBannerPropsSchema = z
  .object({ mediaPosition: z.enum(["left", "right"]) })
  .strict();
export const campaignBannerDefinition = defineComponent({
  type: "campaignBanner",
  label: "Campaign banner",
  allowedPageTypes: ["home", "landing"],
  variants: ["split"] as const,
  defaultVariant: "split",
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
  },
  protectedFields: { readOnlyPaths: ["media.url"] },
  renderer: ({ content, props, context }) => (
    <CampaignBanner {...content} {...props} context={context} />
  ),
});

export const brandStoryContentSchema = editorialContentSchema
  .extend({
    facts: z
      .array(z.object({ value: z.string().min(1).max(20), label: localizedTextSchema }).strict())
      .min(1)
      .max(4),
  })
  .strict();
export const brandStoryPropsSchema = z
  .object({ imagePosition: z.enum(["left", "right"]) })
  .strict();
export const brandStoryDefinition = defineComponent({
  type: "brandStory",
  label: "Brand story",
  allowedPageTypes: ["home", "content"],
  variants: ["editorial"] as const,
  defaultVariant: "editorial",
  contentSchema: brandStoryContentSchema,
  propsSchema: brandStoryPropsSchema,
  defaultContent: {
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
    heading: { source: "content", control: "text", label: "Heading", localized: true },
    body: { source: "content", control: "textarea", label: "Story", localized: true },
  },
  protectedFields: { readOnlyPaths: ["media.url"] },
  renderer: ({ content, props, context }) => (
    <BrandStory {...content} {...props} context={context} />
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
  .object({ benefits: z.array(benefitSchema).length(3) })
  .strict();
export const benefitIconsPropsSchema = z.object({ alignment: z.literal("center") }).strict();
export const benefitIconsDefinition = defineComponent({
  type: "benefitIcons",
  label: "Benefits",
  allowedPageTypes: ["home", "product", "cart"],
  variants: ["threeColumn"] as const,
  defaultVariant: "threeColumn",
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
  editorFields: {},
  protectedFields: { readOnlyPaths: ["benefits.*.icon"] },
  renderer: ({ content, context }) => <BenefitIcons {...content} context={context} />,
});

export const newsletterContentSchema = z
  .object({
    heading: localizedTextSchema,
    body: localizedTextSchema,
    emailLabel: localizedTextSchema,
    buttonLabel: localizedTextSchema,
  })
  .strict();
export const newsletterPropsSchema = z.object({ demoOnly: z.literal(true) }).strict();
export const newsletterDefinition = defineComponent({
  type: "newsletter",
  label: "Newsletter",
  allowedPageTypes: ["home"],
  variants: ["inline"] as const,
  defaultVariant: "inline",
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
  },
  protectedFields: { readOnlyPaths: ["demoOnly"] },
  renderer: ({ sectionId, content, context }) => (
    <Newsletter {...content} context={context} sectionId={sectionId} />
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
export const footerPropsSchema = z.object({ showPolicies: z.boolean() }).strict();
export const footerDefinition = defineComponent({
  type: "footer",
  label: "Store footer",
  allowedPageTypes: ["home", "collection"],
  variants: ["columns"] as const,
  defaultVariant: "columns",
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
  },
  protectedFields: { readOnlyPaths: ["navigation", "policyLabel"] },
  renderer: ({ content, props, context }) => (
    <StoreFooter {...content} {...props} context={context} />
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
