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
import { sectionVocabularyClass } from "./design-vocabulary";
import {
  announcementBarContentSchema,
  announcementBarMetadata,
  announcementBarPropsSchema,
  benefitIconsContentSchema,
  benefitIconsMetadata,
  benefitIconsPropsSchema,
  brandStoryContentSchema,
  brandStoryMetadata,
  brandStoryPropsSchema,
  campaignBannerContentSchema,
  campaignBannerMetadata,
  campaignBannerPropsSchema,
  featuredCategoriesContentSchema,
  featuredCategoriesMetadata,
  featuredCategoriesPropsSchema,
  footerContentSchema,
  footerMetadata,
  footerPropsSchema,
  headerContentSchema,
  headerMetadata,
  headerPropsSchema,
  newsletterContentSchema,
  newsletterMetadata,
  newsletterPropsSchema,
  productGridContentSchema,
  productGridMetadata,
  productGridPropsSchema,
} from "./homepage-metadata";

export {
  announcementBarContentSchema,
  announcementBarPropsSchema,
  benefitIconsContentSchema,
  benefitIconsPropsSchema,
  brandStoryContentSchema,
  brandStoryPropsSchema,
  campaignBannerContentSchema,
  campaignBannerPropsSchema,
  featuredCategoriesContentSchema,
  featuredCategoriesPropsSchema,
  footerContentSchema,
  footerPropsSchema,
  headerContentSchema,
  headerPropsSchema,
  newsletterContentSchema,
  newsletterPropsSchema,
  productGridContentSchema,
  productGridPropsSchema,
};

function requireReferences(ids: string[], known: ReadonlySet<string>, kind: string) {
  ids.forEach((id) => {
    if (!known.has(id)) throw new Error(`Unknown ${kind} reference: ${id}.`);
  });
}

export const announcementBarDefinition = defineComponent({
  ...announcementBarMetadata,
  renderer: ({ variant, content, props, context }) => (
    <AnnouncementBar
      {...content}
      {...props}
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

export const headerDefinition = defineComponent({
  ...headerMetadata,
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

export const featuredCategoriesDefinition = defineComponent({
  ...featuredCategoriesMetadata,
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

export const productGridDefinition = defineComponent({
  ...productGridMetadata,
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

export const campaignBannerDefinition = defineComponent({
  ...campaignBannerMetadata,
  renderer: ({ variant, content, props, context }) => (
    <CampaignBanner
      {...content}
      {...props}
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

export const brandStoryDefinition = defineComponent({
  ...brandStoryMetadata,
  renderer: ({ variant, content, props, context }) => (
    <BrandStory
      {...content}
      {...props}
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

export const benefitIconsDefinition = defineComponent({
  ...benefitIconsMetadata,
  renderer: ({ variant, content, props, context }) => (
    <BenefitIcons
      {...content}
      className={sectionVocabularyClass(variant, props)}
      context={context}
    />
  ),
});

export const newsletterDefinition = defineComponent({
  ...newsletterMetadata,
  renderer: ({ sectionId, variant, content, props, context }) => (
    <Newsletter
      {...content}
      className={sectionVocabularyClass(variant, props)}
      context={context}
      sectionId={sectionId}
    />
  ),
});

export const footerDefinition = defineComponent({
  ...footerMetadata,
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
