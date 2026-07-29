import type {
  DesignDirectionId,
  DesignDiversityFixture,
} from "../helpers/design-diversity-evaluator";

const protectedCommerce = {
  catalogueRevision: "catalogue-revision-17",
  products: [
    { id: "product-watch-1", sku: "WATCH-001", price: { amount: 24900, currency: "EUR" } },
    { id: "product-ring-1", sku: "RING-001", price: { amount: 18900, currency: "EUR" } },
  ],
  collections: [{ id: "collection-new", productIds: ["product-watch-1", "product-ring-1"] }],
};

const contentCases: DesignDiversityFixture["contentCases"] = [
  { id: "oneCollection", unexplainedEmptyAreas: 0 },
  { id: "multipleCollections", unexplainedEmptyAreas: 0 },
  { id: "smallProductCount", unexplainedEmptyAreas: 0 },
  { id: "largeProductCount", unexplainedEmptyAreas: 0 },
  { id: "missingOptionalMedia", unexplainedEmptyAreas: 0 },
];

function responsive(direction: string): DesignDiversityFixture["responsive"] {
  return {
    375: {
      home: `${direction}:mobile-flow`,
      collection: `${direction}:mobile-collection`,
      product: `${direction}:mobile-pdp`,
    },
    768: {
      home: `${direction}:tablet-flow`,
      collection: `${direction}:tablet-collection`,
      product: `${direction}:tablet-pdp`,
    },
    1024: {
      home: `${direction}:desktop-flow`,
      collection: `${direction}:desktop-collection`,
      product: `${direction}:desktop-pdp`,
    },
    1440: {
      home: `${direction}:wide-flow`,
      collection: `${direction}:wide-collection`,
      product: `${direction}:wide-pdp`,
    },
  };
}

function locales(direction: string): DesignDiversityFixture["localePresentation"] {
  return {
    en: {
      home: `${direction}:home-en`,
      collection: `${direction}:collection-en`,
      product: `${direction}:product-en`,
    },
    fi: {
      home: `${direction}:home-fi`,
      collection: `${direction}:collection-fi`,
      product: `${direction}:product-fi`,
    },
  };
}

const baseByDirection: Record<DesignDirectionId, DesignDiversityFixture> = {
  premiumEditorial: {
    directionId: "premiumEditorial",
    pages: {
      home: {
        directionId: "premiumEditorial",
        sections: ["header", "hero", "collections", "story", "products", "campaign", "footer"],
        composition: "editorial-chapters",
        hero: "full-bleed-editorial",
        navigation: "transparent-overlay",
      },
      collection: {
        directionId: "premiumEditorial",
        sections: ["header", "collectionHero", "filters", "productGrid", "story", "footer"],
        composition: "editorial-image-led",
        discovery: "image-led",
        productCard: "premium-image-first",
      },
      product: {
        directionId: "premiumEditorial",
        sections: ["header", "productDetail", "story", "recommendations", "footer"],
        composition: "gallery-dominant",
        gallery: "editorial-grid",
        information: "narrow-sticky-column",
        options: "comfortable-groups",
      },
    },
    designSystem: {
      colours: "ink-ivory-gold",
      typography: "refined-serif",
      spacingDensity: "spacious",
      shapeRadius: "square",
      borderSurfaceElevation: "flat-hairline",
      imageTreatment: "editorial-crop",
    },
    responsive: responsive("premium"),
    localePresentation: locales("premium"),
    contentCases,
    protectedCommerce,
    approvedAssetIds: ["hero", "collection", "product-watch", "product-ring"],
    usedAssetIds: ["hero", "collection", "product-watch", "product-ring"],
  },
  modernTechnical: {
    directionId: "modernTechnical",
    pages: {
      home: {
        directionId: "modernTechnical",
        sections: ["header", "hero", "products", "collections", "trust", "footer"],
        composition: "commerce-dashboard",
        hero: "asymmetric-contained",
        navigation: "compact-utility",
      },
      collection: {
        directionId: "modernTechnical",
        sections: ["header", "filterBar", "productGrid", "comparison", "footer"],
        composition: "dense-filtered-grid",
        discovery: "horizontal-filters",
        productCard: "compact-commerce",
      },
      product: {
        directionId: "modernTechnical",
        sections: ["header", "productDetail", "specifications", "recommendations", "footer"],
        composition: "compact-two-column",
        gallery: "contained-thumbnails",
        information: "dense-specification-stack",
        options: "compact-dependent-controls",
      },
    },
    designSystem: {
      colours: "graphite-white-signal",
      typography: "technical-sans",
      spacingDensity: "compact",
      shapeRadius: "soft",
      borderSurfaceElevation: "outlined-subtle",
      imageTreatment: "product-neutral",
    },
    responsive: responsive("technical"),
    localePresentation: locales("technical"),
    contentCases,
    protectedCommerce,
    approvedAssetIds: ["hero", "collection", "product-watch", "product-ring"],
    usedAssetIds: ["hero", "product-watch", "product-ring"],
  },
  warmApproachable: {
    directionId: "warmApproachable",
    pages: {
      home: {
        directionId: "warmApproachable",
        sections: [
          "header",
          "hero",
          "story",
          "collections",
          "products",
          "trust",
          "campaign",
          "footer",
        ],
        composition: "guided-brand-story",
        hero: "soft-split",
        navigation: "centered-friendly",
      },
      collection: {
        directionId: "warmApproachable",
        sections: ["header", "collectionIntro", "categoryCards", "productGrid", "trust", "footer"],
        composition: "approachable-editorial-cards",
        discovery: "story-led-cards",
        productCard: "soft-standard",
      },
      product: {
        directionId: "warmApproachable",
        sections: [
          "header",
          "productDetail",
          "benefits",
          "brandStory",
          "recommendations",
          "footer",
        ],
        composition: "balanced-story",
        gallery: "soft-framed-thumbnails",
        information: "comfortable-benefit-stack",
        options: "comfortable-groups",
      },
    },
    designSystem: {
      colours: "clay-cream-forest",
      typography: "warm-serif-sans",
      spacingDensity: "standard",
      shapeRadius: "rounded",
      borderSurfaceElevation: "layered-soft",
      imageTreatment: "soft-frame",
    },
    responsive: responsive("warm"),
    localePresentation: locales("warm"),
    contentCases,
    protectedCommerce,
    approvedAssetIds: ["hero", "collection", "product-watch", "product-ring"],
    usedAssetIds: ["hero", "collection", "product-watch", "product-ring"],
  },
};

export const knownDistinctDesignDirections = Object.values(baseByDirection);

export const knownColourOnlyDesignDirections = knownDistinctDesignDirections.map(
  (fixture, index, fixtures): DesignDiversityFixture => {
    const reference = fixtures[0]!;
    return {
      ...structuredClone(reference),
      directionId: fixture.directionId,
      pages: {
        home: { ...structuredClone(reference.pages.home), directionId: fixture.directionId },
        collection: {
          ...structuredClone(reference.pages.collection),
          directionId: fixture.directionId,
        },
        product: { ...structuredClone(reference.pages.product), directionId: fixture.directionId },
      },
      designSystem: {
        ...structuredClone(reference.designSystem),
        colours: ["ink-ivory", "blue-white", "clay-cream"][index]!,
      },
    };
  },
);
