import type { PageType } from "@/domain/storefront";
import {
  homepageCollectionNavigationDefinition,
  homepageFeaturedCollectionsDefinition,
  homepageFeaturedProductsDefinition,
  homepageHeroDefinition,
  homepagePromotionDefinition,
  homepageTrustDefinition,
} from "./homepage-commerce";

function registeredVariants(definition: Readonly<{ variants: readonly { id: string }[] }>) {
  return definition.variants.map(({ id }) => id);
}

/**
 * Pure, renderer-independent vocabulary metadata for bounded composition layers.
 * The renderer registry remains the executable source of truth; a regression test
 * verifies this manifest stays aligned with it.
 */
export const supportedSectionManifest = {
  announcementBar: {
    allowedPageTypes: ["home"] as const satisfies readonly PageType[],
    variants: ["singleLine", "rotating", "minimal", "bold"] as const,
  },
  header: {
    allowedPageTypes: ["home", "collection", "product"] as const satisfies readonly PageType[],
    variants: ["centered", "split", "compact", "transparent"] as const,
  },
  hero: {
    allowedPageTypes: ["home", "landing"] as const satisfies readonly PageType[],
    variants: ["editorial", "fullBleed", "asymmetric", "restrained"] as const,
  },
  featuredCategories: {
    allowedPageTypes: ["home"] as const satisfies readonly PageType[],
    variants: ["grid", "editorialCards", "carousel", "imageLed"] as const,
  },
  productGrid: {
    allowedPageTypes: ["home", "collection"] as const satisfies readonly PageType[],
    variants: ["standard", "editorial", "compact"] as const,
  },
  campaignBanner: {
    allowedPageTypes: ["home", "landing"] as const satisfies readonly PageType[],
    variants: ["imageOverlay", "split", "minimal"] as const,
  },
  brandStory: {
    allowedPageTypes: ["home", "content"] as const satisfies readonly PageType[],
    variants: ["editorial", "timeline", "founder", "minimal", "imageLed"] as const,
  },
  benefitIcons: {
    allowedPageTypes: ["home", "product", "cart"] as const satisfies readonly PageType[],
    variants: ["threeColumn", "fourColumn", "minimal", "cards"] as const,
  },
  newsletter: {
    allowedPageTypes: ["home"] as const satisfies readonly PageType[],
    variants: ["inline", "card", "fullWidth"] as const,
  },
  footer: {
    allowedPageTypes: ["home", "collection", "product"] as const satisfies readonly PageType[],
    variants: ["columns", "editorial", "compact"] as const,
  },
  collectionHeader: {
    allowedPageTypes: ["collection"] as const satisfies readonly PageType[],
    variants: ["editorial"] as const,
  },
  filterBar: {
    allowedPageTypes: ["collection"] as const satisfies readonly PageType[],
    variants: ["horizontal"] as const,
  },
  productGallery: {
    allowedPageTypes: ["product"] as const satisfies readonly PageType[],
    variants: ["thumbnails"] as const,
  },
  productInfo: {
    allowedPageTypes: ["product"] as const satisfies readonly PageType[],
    variants: ["premium"] as const,
  },
  productOptions: {
    allowedPageTypes: ["product"] as const satisfies readonly PageType[],
    variants: ["buttons"] as const,
  },
  imageText: {
    allowedPageTypes: ["product", "content"] as const satisfies readonly PageType[],
    variants: ["imageLeft", "imageRight", "stacked"] as const,
  },
  relatedProducts: {
    allowedPageTypes: ["product"] as const satisfies readonly PageType[],
    variants: ["grid"] as const,
  },
  dynamicCollectionCommerce: {
    allowedPageTypes: ["collection"] as const satisfies readonly PageType[],
    variants: ["standard", "editorial", "compact", "gallery"] as const,
  },
  dynamicProductDetail: {
    allowedPageTypes: ["product"] as const satisfies readonly PageType[],
    variants: ["balanced", "editorial", "compact", "galleryDominant", "editorialSplit"] as const,
  },
  homepageHero: {
    allowedPageTypes: ["home"] as const satisfies readonly PageType[],
    variants: registeredVariants(homepageHeroDefinition),
  },
  homepageFeaturedCollections: {
    allowedPageTypes: ["home"] as const satisfies readonly PageType[],
    variants: registeredVariants(homepageFeaturedCollectionsDefinition),
  },
  homepageFeaturedProducts: {
    allowedPageTypes: ["home"] as const satisfies readonly PageType[],
    variants: registeredVariants(homepageFeaturedProductsDefinition),
  },
  homepageCollectionNavigation: {
    allowedPageTypes: ["home"] as const satisfies readonly PageType[],
    variants: registeredVariants(homepageCollectionNavigationDefinition),
  },
  homepagePromotion: {
    allowedPageTypes: ["home"] as const satisfies readonly PageType[],
    variants: registeredVariants(homepagePromotionDefinition),
  },
  homepageTrust: {
    allowedPageTypes: ["home"] as const satisfies readonly PageType[],
    variants: registeredVariants(homepageTrustDefinition),
  },
} as const;

export type SupportedSectionType = keyof typeof supportedSectionManifest;

export function getSupportedSectionManifest(sectionType: string) {
  return Object.hasOwn(supportedSectionManifest, sectionType)
    ? supportedSectionManifest[sectionType as SupportedSectionType]
    : undefined;
}
