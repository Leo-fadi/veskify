import {
  storefrontDesignSystemV1Schema,
  type StorefrontDesignDirectionId,
  type StorefrontDesignSystemV1,
} from "./contract";
import { canonicalValueFingerprint } from "@/domain/storefront";

const responsive = {
  breakpoints: ["mobile", "tablet", "desktop", "wide"] as const,
  allowHorizontalOverflow: false as const,
};
const section = (
  slot: string,
  component: string,
  variant: string,
  required: boolean,
  acceptedAssetRoles: string[] = [],
) => ({ slot, component, variant, required, acceptedAssetRoles });
const recipe = (
  id: string,
  label: { en: string; fi: string },
  pageType: "home" | "collection" | "product",
  sections: ReturnType<typeof section>[],
) => ({ id, label, pageType, sections, responsive });

const material = {
  version: "1.0.0" as const,
  semanticFoundation: {
    colourRoles: [
      "primary",
      "secondary",
      "accent",
      "background",
      "surface",
      "text",
      "mutedText",
      "border",
      "success",
      "warning",
      "unavailable",
    ] as const,
    layoutRoles: [
      "contentWidth",
      "spacingDensity",
      "cornerTreatment",
      "borderTreatment",
      "surfaceDepth",
    ] as const,
    commerceStatusTokensProtected: true as const,
  },
  typographyDirections: [
    {
      id: "refinedSerif",
      label: { en: "Refined serif", fi: "Hienostunut antiikva" },
      headingFont: "georgia",
      bodyFont: "inter",
      scaleRatio: 1.3,
      readingWidth: "narrow",
    },
    {
      id: "modernSans",
      label: { en: "Modern sans", fi: "Moderni groteski" },
      headingFont: "system-sans",
      bodyFont: "inter",
      scaleRatio: 1.25,
      readingWidth: "standard",
    },
    {
      id: "editorialContrast",
      label: { en: "Editorial contrast", fi: "Toimituksellinen kontrasti" },
      headingFont: "system-serif",
      bodyFont: "system-sans",
      scaleRatio: 1.333,
      readingWidth: "narrow",
    },
    {
      id: "technicalFunctional",
      label: { en: "Technical and functional", fi: "Tekninen ja käytännöllinen" },
      headingFont: "inter",
      bodyFont: "system-sans",
      scaleRatio: 1.2,
      readingWidth: "standard",
    },
    {
      id: "warmApproachable",
      label: { en: "Warm and approachable", fi: "Lämmin ja helposti lähestyttävä" },
      headingFont: "georgia",
      bodyFont: "system-sans",
      scaleRatio: 1.25,
      readingWidth: "standard",
    },
  ],
  imageTreatments: [
    {
      id: "fullBleed",
      label: { en: "Full bleed", fi: "Reunasta reunaan" },
      canonicalMediaImmutable: true,
      allowedAssetRoles: ["heroDesktop", "heroMobile", "editorialImage"],
    },
    {
      id: "contained",
      label: { en: "Contained", fi: "Rajattu alue" },
      canonicalMediaImmutable: true,
      allowedAssetRoles: ["heroDesktop", "collectionImage", "editorialImage"],
    },
    {
      id: "editorialCrop",
      label: { en: "Editorial crop", fi: "Toimituksellinen rajaus" },
      canonicalMediaImmutable: true,
      allowedAssetRoles: ["heroDesktop", "heroMobile", "editorialImage"],
    },
    {
      id: "productNeutral",
      label: { en: "Product-focused neutral", fi: "Neutraali tuotekuva" },
      canonicalMediaImmutable: true,
      allowedAssetRoles: ["productMainImage", "productAlternativeImage"],
    },
    {
      id: "split",
      label: { en: "Split layout", fi: "Jaettu asettelu" },
      canonicalMediaImmutable: true,
      allowedAssetRoles: ["heroDesktop", "collectionImage", "editorialImage"],
    },
    {
      id: "softFrame",
      label: { en: "Soft frame", fi: "Pehmeä kehys" },
      canonicalMediaImmutable: true,
      allowedAssetRoles: ["collectionImage", "editorialImage", "productMainImage"],
    },
  ],
  productCardFamilies: [
    {
      id: "minimalProduct",
      label: { en: "Minimal product-first", fi: "Pelkistetty tuotekeskeinen" },
      registryVariant: "standard",
      requiredCommerceFields: [
        "productId",
        "title",
        "priceState",
        "availability",
        "canonicalMedia",
        "productRoute",
      ],
    },
    {
      id: "editorialImage",
      label: { en: "Editorial image-led", fi: "Kuvavetoinen editorial" },
      registryVariant: "editorial",
      requiredCommerceFields: [
        "productId",
        "title",
        "priceState",
        "availability",
        "canonicalMedia",
        "productRoute",
      ],
    },
    {
      id: "compactCommerce",
      label: { en: "Compact commerce", fi: "Kompakti kaupallinen" },
      registryVariant: "compact",
      requiredCommerceFields: [
        "productId",
        "title",
        "priceState",
        "availability",
        "canonicalMedia",
        "productRoute",
      ],
    },
    {
      id: "premiumJewellery",
      label: { en: "Premium jewellery", fi: "Premium-korut" },
      registryVariant: "imageFirst",
      requiredCommerceFields: [
        "productId",
        "title",
        "priceState",
        "availability",
        "canonicalMedia",
        "productRoute",
      ],
    },
  ],
  homepageRecipes: [
    recipe("homePremiumEditorial", { en: "Premium editorial", fi: "Premium editorial" }, "home", [
      section("announcement", "announcementBar", "minimal", false),
      section("header", "header", "transparent", true),
      section("hero", "hero", "fullBleed", true, ["heroDesktop", "heroMobile"]),
      section("discovery", "featuredCategories", "imageLed", true, ["collectionImage"]),
      section("story", "brandStory", "imageLed", false, ["editorialImage"]),
      section("products", "productGrid", "editorial", true, ["productMainImage"]),
      section("campaign", "campaignBanner", "imageOverlay", false, ["editorialImage"]),
      section("trust", "benefitIcons", "minimal", false),
      section("newsletter", "newsletter", "card", false),
      section("footer", "footer", "editorial", true),
    ]),
    recipe("homeModernCommerce", { en: "Modern commerce-led", fi: "Moderni kaupallinen" }, "home", [
      section("announcement", "announcementBar", "singleLine", false),
      section("header", "header", "compact", true),
      section("hero", "hero", "asymmetric", true, ["heroDesktop"]),
      section("products", "productGrid", "compact", true, ["productMainImage"]),
      section("discovery", "featuredCategories", "grid", true, ["collectionImage"]),
      section("campaign", "campaignBanner", "minimal", false, ["editorialImage"]),
      section("story", "brandStory", "minimal", false, ["editorialImage"]),
      section("trust", "benefitIcons", "threeColumn", false),
      section("newsletter", "newsletter", "inline", false),
      section("footer", "footer", "compact", true),
    ]),
    recipe("homeWarmStory", { en: "Warm brand story", fi: "Lämmin bränditarina" }, "home", [
      section("announcement", "announcementBar", "minimal", false),
      section("header", "header", "centered", true),
      section("hero", "hero", "editorial", true, ["heroDesktop"]),
      section("story", "brandStory", "editorial", true, ["editorialImage"]),
      section("discovery", "featuredCategories", "editorialCards", true, ["collectionImage"]),
      section("products", "productGrid", "standard", true, ["productMainImage"]),
      section("campaign", "campaignBanner", "split", false, ["editorialImage"]),
      section("trust", "benefitIcons", "cards", false),
      section("newsletter", "newsletter", "card", false),
      section("footer", "footer", "columns", true),
    ]),
  ],
  collectionRecipes: [
    recipe(
      "collectionEditorial",
      { en: "Editorial collection", fi: "Toimituksellinen mallisto" },
      "collection",
      [
        section("header", "header", "transparent", true),
        section("introduction", "dynamicCollectionCommerce", "editorial", true, [
          "collectionImage",
          "productMainImage",
        ]),
        section("footer", "footer", "editorial", true),
      ],
    ),
    recipe(
      "collectionCommerce",
      { en: "Commerce-first collection", fi: "Kaupallinen mallisto" },
      "collection",
      [
        section("header", "header", "compact", true),
        section("introduction", "dynamicCollectionCommerce", "compact", true, [
          "collectionImage",
          "productMainImage",
        ]),
        section("footer", "footer", "compact", true),
      ],
    ),
    recipe(
      "collectionWarmDiscovery",
      { en: "Warm collection discovery", fi: "Lämmin mallistojen löydettävyys" },
      "collection",
      [
        section("header", "header", "centered", true),
        section("introduction", "dynamicCollectionCommerce", "editorial", true, [
          "collectionImage",
          "productMainImage",
        ]),
        section("footer", "footer", "columns", true),
      ],
    ),
  ],
  productRecipes: [
    recipe("productSimple", { en: "Simple product", fi: "Yksinkertainen tuote" }, "product", [
      section("header", "header", "centered", true),
      section("product", "dynamicProductDetail", "balanced", true, [
        "productMainImage",
        "productAlternativeImage",
      ]),
      section("footer", "footer", "columns", true),
    ]),
    recipe("productJewellery", { en: "Jewellery configuration", fi: "Korun valinnat" }, "product", [
      section("header", "header", "transparent", true),
      section("product", "dynamicProductDetail", "editorialSplit", true, [
        "productMainImage",
        "productAlternativeImage",
      ]),
      section("footer", "footer", "editorial", true),
    ]),
    recipe(
      "productVariantLed",
      { en: "Variant-led product", fi: "Vaihtoehtokeskeinen tuote" },
      "product",
      [
        section("header", "header", "compact", true),
        section("product", "dynamicProductDetail", "compact", true, [
          "productMainImage",
          "productAlternativeImage",
        ]),
        section("footer", "footer", "compact", true),
      ],
    ),
    recipe(
      "productGallery",
      { en: "Gallery-led product", fi: "Galleriavetoinen tuote" },
      "product",
      [
        section("header", "header", "centered", true),
        section("product", "dynamicProductDetail", "galleryDominant", true, [
          "productMainImage",
          "productAlternativeImage",
        ]),
        section("footer", "footer", "columns", true),
      ],
    ),
  ],
  directions: [
    {
      version: "1.0.0",
      id: "premiumEditorial",
      label: { en: "Premium editorial", fi: "Premium editorial" },
      plannerDescription: {
        en: "Story-led composition, expressive imagery and spacious jewellery presentation.",
        fi: "Tarinavetoinen kokonaisuus, näyttävät kuvat ja väljä koruesittely.",
      },
      typographyDirectionId: "refinedSerif",
      imageTreatmentId: "editorialCrop",
      homepageRecipeId: "homePremiumEditorial",
      collectionRecipeId: "collectionEditorial",
      productRecipeId: "productJewellery",
      productCardFamilyId: "premiumJewellery",
      spacingDensity: "spacious",
      cornerTreatment: "soft",
      surfaceDepth: "layered",
      componentSelections: {
        header: { component: "header", variant: "transparent" },
        hero: { component: "hero", variant: "fullBleed" },
        collectionDiscovery: { component: "featuredCategories", variant: "imageLed" },
        productCard: { component: "productGrid", variant: "editorial" },
        storytelling: { component: "brandStory", variant: "imageLed" },
        campaign: { component: "campaignBanner", variant: "imageOverlay" },
        trust: { component: "benefitIcons", variant: "minimal" },
        footer: { component: "footer", variant: "editorial" },
        collectionCommerce: { component: "dynamicCollectionCommerce", variant: "editorial" },
        productDetail: { component: "dynamicProductDetail", variant: "editorialSplit" },
      },
      collectionPresentation: {
        variant: "editorial",
        gridDensity: "spacious",
        cardVariant: "imageFirst",
        filterLayout: "horizontal",
      },
      productPresentation: {
        variant: "editorialSplit",
        galleryLayout: "grid",
        optionDensity: "comfortable",
        attributeLayout: "groups",
        mediaTreatment: "editorial",
      },
    },
    {
      version: "1.0.0",
      id: "modernTechnical",
      label: { en: "Modern technical", fi: "Moderni tekninen" },
      plannerDescription: {
        en: "Product-first hierarchy, compact comparison and functional variant selection.",
        fi: "Tuotekeskeinen hierarkia, kompakti vertailu ja käytännölliset vaihtoehdot.",
      },
      typographyDirectionId: "technicalFunctional",
      imageTreatmentId: "productNeutral",
      homepageRecipeId: "homeModernCommerce",
      collectionRecipeId: "collectionCommerce",
      productRecipeId: "productVariantLed",
      productCardFamilyId: "compactCommerce",
      spacingDensity: "compact",
      cornerTreatment: "square",
      surfaceDepth: "flat",
      componentSelections: {
        header: { component: "header", variant: "compact" },
        hero: { component: "hero", variant: "asymmetric" },
        collectionDiscovery: { component: "featuredCategories", variant: "grid" },
        productCard: { component: "productGrid", variant: "compact" },
        storytelling: { component: "brandStory", variant: "minimal" },
        campaign: { component: "campaignBanner", variant: "minimal" },
        trust: { component: "benefitIcons", variant: "threeColumn" },
        footer: { component: "footer", variant: "compact" },
        collectionCommerce: { component: "dynamicCollectionCommerce", variant: "compact" },
        productDetail: { component: "dynamicProductDetail", variant: "compact" },
      },
      collectionPresentation: {
        variant: "compact",
        gridDensity: "compact",
        cardVariant: "compact",
        filterLayout: "sidebar",
      },
      productPresentation: {
        variant: "compact",
        galleryLayout: "thumbnails",
        optionDensity: "compact",
        attributeLayout: "table",
        mediaTreatment: "contained",
      },
    },
    {
      version: "1.0.0",
      id: "warmApproachable",
      label: { en: "Warm approachable", fi: "Lämmin ja helposti lähestyttävä" },
      plannerDescription: {
        en: "Balanced commerce with friendly storytelling, soft surfaces and clear discovery.",
        fi: "Tasapainoinen kauppa, ystävällinen tarina, pehmeät pinnat ja selkeä löydettävyys.",
      },
      typographyDirectionId: "warmApproachable",
      imageTreatmentId: "softFrame",
      homepageRecipeId: "homeWarmStory",
      collectionRecipeId: "collectionWarmDiscovery",
      productRecipeId: "productSimple",
      productCardFamilyId: "minimalProduct",
      spacingDensity: "standard",
      cornerTreatment: "rounded",
      surfaceDepth: "subtle",
      componentSelections: {
        header: { component: "header", variant: "centered" },
        hero: { component: "hero", variant: "editorial" },
        collectionDiscovery: { component: "featuredCategories", variant: "editorialCards" },
        productCard: { component: "productGrid", variant: "standard" },
        storytelling: { component: "brandStory", variant: "editorial" },
        campaign: { component: "campaignBanner", variant: "split" },
        trust: { component: "benefitIcons", variant: "cards" },
        footer: { component: "footer", variant: "columns" },
        collectionCommerce: { component: "dynamicCollectionCommerce", variant: "editorial" },
        productDetail: { component: "dynamicProductDetail", variant: "balanced" },
      },
      collectionPresentation: {
        variant: "editorial",
        gridDensity: "standard",
        cardVariant: "standard",
        filterLayout: "horizontal",
      },
      productPresentation: {
        variant: "balanced",
        galleryLayout: "thumbnails",
        optionDensity: "comfortable",
        attributeLayout: "groups",
        mediaTreatment: "contained",
      },
    },
  ],
};

export const storefrontDesignSystemV1: StorefrontDesignSystemV1 =
  storefrontDesignSystemV1Schema.parse({
    ...material,
    fingerprint: `storefront-design-system-${canonicalValueFingerprint(material)}`,
  });

export function selectStorefrontDesignDirection(input: {
  visualStyleDirection: string | null;
  typographyDirection: string | null;
  imageryDirection: string | null;
  toneKeywords: readonly string[];
}): StorefrontDesignDirectionId {
  const signals = [
    input.visualStyleDirection,
    input.typographyDirection,
    input.imageryDirection,
    ...input.toneKeywords,
  ].map((value) => value?.toLowerCase() ?? "");
  if (signals.some((value) => ["minimal", "technical", "bold", "sans-led"].includes(value))) {
    return "modernTechnical";
  }
  if (
    signals.some((value) =>
      ["luxury", "editorial", "elegant", "serif-led", "product-focused"].includes(value),
    )
  ) {
    return "premiumEditorial";
  }
  if (signals.some((value) => ["warm", "natural", "playful", "soft"].includes(value))) {
    return "warmApproachable";
  }
  return "premiumEditorial";
}

export function getStorefrontDesignDirection(id: StorefrontDesignDirectionId) {
  return storefrontDesignSystemV1.directions.find((direction) => direction.id === id)!;
}
