import type { ComponentInstanceV2 } from "@/domain/component-platform";
import {
  homepageCollectionNavigationContentSchema,
  homepageCollectionNavigationPropsSchema,
  homepageFeaturedCollectionsContentSchema,
  homepageFeaturedCollectionsPropsSchema,
  homepageFeaturedProductsContentSchema,
  homepageFeaturedProductsDefinition,
  homepageFeaturedProductsPropsSchema,
  homepageEditorialContentSchema,
  homepageEditorialDefinition,
  homepageEditorialPropsSchema,
  homepageHeroContentSchema,
  homepageHeroDefinition,
  homepageHeroPropsSchema,
  homepageProofContentSchema,
  homepageProofDefinition,
  homepageProofPropsSchema,
  homepageCollectionNavigationDefinition,
  homepageFeaturedCollectionsDefinition,
  homepagePromotionDefinition,
  homepagePromotionContentSchema,
  homepagePromotionPropsSchema,
  homepageTrustDefinition,
  homepageTrustContentSchema,
  homepageTrustPropsSchema,
} from "./homepage-commerce";

export const homepageCommerceBridgeComponentNames = [
  "homepageHero",
  "homepageFeaturedCollections",
  "homepageFeaturedProducts",
  "homepageCollectionNavigation",
  "homepagePromotion",
  "homepageTrust",
  "homepageEditorial",
  "homepageProof",
] as const;

export type HomepageCommerceBridgeComponent = (typeof homepageCommerceBridgeComponentNames)[number];

function variantIds(
  definition: Readonly<{ type: string; variants: readonly { id: string }[] }>,
): readonly [string, ...string[]] {
  const variants = definition.variants.map(({ id }) => id);
  const first = variants[0];
  if (!first) throw new Error(`Homepage component ${definition.type} has no variants.`);
  return [first, ...variants.slice(1)];
}

export const homepageCommerceBridgeVariants: Readonly<
  Record<HomepageCommerceBridgeComponent, readonly [string, ...string[]]>
> = {
  homepageHero: variantIds(homepageHeroDefinition),
  homepageFeaturedCollections: variantIds(homepageFeaturedCollectionsDefinition),
  homepageFeaturedProducts: variantIds(homepageFeaturedProductsDefinition),
  homepageCollectionNavigation: variantIds(homepageCollectionNavigationDefinition),
  homepagePromotion: variantIds(homepagePromotionDefinition),
  homepageTrust: variantIds(homepageTrustDefinition),
  homepageEditorial: variantIds(homepageEditorialDefinition),
  homepageProof: variantIds(homepageProofDefinition),
};

export const homepageCommerceBridgeDefaults = {
  homepageHero: {
    content: homepageHeroContentSchema.parse({
      heading: { en: "Discover the collection", fi: "Tutustu mallistoon" },
    }),
    props: homepageHeroPropsSchema.parse({
      mediaPosition: "right",
      imagePresentation: "cover",
      textAlignment: "left",
    }),
  },
  homepageFeaturedCollections: {
    content: homepageFeaturedCollectionsContentSchema.parse({
      heading: { en: "Shop by collection", fi: "Osta mallistoittain" },
      mediaPlaceholderLabel: {
        en: "Collection image unavailable",
        fi: "Mallistokuva ei ole saatavilla",
      },
    }),
    props: homepageFeaturedCollectionsPropsSchema.parse({
      layout: "grid",
      cardPresentation: "image",
      columns: 3,
      showDescriptions: true,
    }),
  },
  homepageFeaturedProducts: {
    content: homepageFeaturedProductsContentSchema.parse({
      heading: { en: "Featured products", fi: "Nostetut tuotteet" },
      mediaPlaceholderLabel: { en: "Product image unavailable", fi: "Tuotekuva ei ole saatavilla" },
      emptyStateMessage: { en: "Products will appear here.", fi: "Tuotteet näkyvät täällä." },
    }),
    props: homepageFeaturedProductsPropsSchema.parse({
      layout: "grid",
      cardVariant: "standard",
      columns: 3,
    }),
  },
  homepageCollectionNavigation: {
    content: homepageCollectionNavigationContentSchema.parse({
      heading: { en: "Browse collections", fi: "Selaa mallistoja" },
      mediaPlaceholderLabel: {
        en: "Collection image unavailable",
        fi: "Mallistokuva ei ole saatavilla",
      },
    }),
    props: homepageCollectionNavigationPropsSchema.parse({ presentation: "compact", columns: 3 }),
  },
  homepagePromotion: {
    content: homepagePromotionContentSchema.parse({
      heading: { en: "Made for considered shopping", fi: "Harkittuun ostamiseen" },
      description: { en: "Explore the latest collection.", fi: "Tutustu uusimpaan mallistoon." },
    }),
    props: homepagePromotionPropsSchema.parse({
      mediaPosition: "right",
      actionPresentation: "primary",
      textAlignment: "left",
    }),
  },
  homepageTrust: {
    content: homepageTrustContentSchema.parse({
      items: [
        {
          id: "support",
          kind: "service",
          title: { en: "Here to help", fi: "Autamme mielellämme" },
          description: {
            en: "Review store support before ordering.",
            fi: "Tarkista kaupan tuki ennen tilausta.",
          },
        },
      ],
    }),
    props: homepageTrustPropsSchema.parse({ columns: 3, textAlignment: "left" }),
  },
  homepageEditorial: {
    content: homepageEditorialContentSchema.parse({
      eyebrow: { en: "Our perspective", fi: "Näkökulmamme" },
      heading: { en: "A considered point of view", fi: "Harkittu näkökulma" },
      body: {
        en: "Discover the approved story and imagery behind the collection.",
        fi: "Tutustu malliston hyväksyttyyn tarinaan ja kuvamaailmaan.",
      },
    }),
    props: homepageEditorialPropsSchema.parse({
      mediaPosition: "right",
      textAlignment: "left",
      galleryColumns: 2,
    }),
  },
  homepageProof: {
    content: homepageProofContentSchema.parse({ items: [] }),
    props: homepageProofPropsSchema.parse({ columns: 3, textAlignment: "left" }),
  },
} satisfies Readonly<
  Record<
    HomepageCommerceBridgeComponent,
    { content: ComponentInstanceV2["content"]; props: ComponentInstanceV2["props"] }
  >
>;
