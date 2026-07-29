import type {
  DesignDirectionId,
  DesignDiversityFixture,
} from "../helpers/design-diversity-evaluator";

export const canonicalCommerceBaseline = {
  catalogueRevision: "catalogue-revision-17",
  products: [
    { id: "product-watch-1", sku: "WATCH-001", price: { amount: 24900, currency: "EUR" } },
    { id: "product-ring-1", sku: "RING-001", price: { amount: 18900, currency: "EUR" } },
  ],
  collections: [{ id: "collection-new", productIds: ["product-watch-1", "product-ring-1"] }],
};

const directionFacts: Record<DesignDirectionId, { recipeId: string; tokenIdentity: string }> = {
  premiumEditorial: { recipeId: "premium-editorial-v1", tokenIdentity: "premium-editorial-tokens" },
  modernTechnical: { recipeId: "modern-technical-v1", tokenIdentity: "modern-technical-tokens" },
  warmApproachable: { recipeId: "warm-approachable-v1", tokenIdentity: "warm-approachable-tokens" },
};

function contentCases(): DesignDiversityFixture["contentCases"] {
  return [
    { id: "oneCollection", unexplainedEmptyAreas: 0 },
    { id: "multipleCollections", unexplainedEmptyAreas: 0 },
    { id: "smallProductCount", unexplainedEmptyAreas: 0 },
    { id: "largeProductCount", unexplainedEmptyAreas: 0 },
    { id: "missingOptionalMedia", unexplainedEmptyAreas: 0 },
  ];
}

function responsive(): DesignDiversityFixture["responsive"] {
  const result = {
    horizontalOverflow: false,
    clipping: false,
    overlap: false,
    invalidEmptySpace: false,
    layoutProbePassed: true,
    screenshotReview: "passed" as const,
    manualReview: "passed" as const,
  };
  return {
    375: { home: { ...result }, collection: { ...result }, product: { ...result } },
    768: { home: { ...result }, collection: { ...result }, product: { ...result } },
    1024: { home: { ...result }, collection: { ...result }, product: { ...result } },
    1440: { home: { ...result }, collection: { ...result }, product: { ...result } },
  };
}

function locales(direction: string): DesignDiversityFixture["localePresentation"] {
  return {
    en: {
      home: { merchantVisibleText: `${direction} home`, leakage: [] },
      collection: { merchantVisibleText: `${direction} collection`, leakage: [] },
      product: { merchantVisibleText: `${direction} product`, leakage: [] },
    },
    fi: {
      home: { merchantVisibleText: `${direction} etusivu`, leakage: [] },
      collection: { merchantVisibleText: `${direction} kokoelma`, leakage: [] },
      product: { merchantVisibleText: `${direction} tuote`, leakage: [] },
    },
  };
}

const approvedAssets = [
  {
    assetId: "hero",
    role: "hero",
    owner: { kind: "storefront" as const },
    provenance: "approved-brief",
  },
  {
    assetId: "collection",
    role: "collection",
    owner: { kind: "collection" as const, id: "collection-new" },
    provenance: "canonical-collection",
  },
  {
    assetId: "product-watch",
    role: "product",
    owner: { kind: "product" as const, id: "product-watch-1" },
    provenance: "canonical-product",
  },
  {
    assetId: "product-ring",
    role: "product",
    owner: { kind: "product" as const, id: "product-ring-1" },
    provenance: "canonical-product",
  },
];
const assetUses = approvedAssets.map((asset) => ({
  assetId: asset.assetId,
  approvedRole: asset.role,
  actualRole: asset.role,
  approvedOwner: asset.owner,
  bindingTarget: asset.owner,
  provenance: asset.provenance,
}));

const baseByDirection: Record<DesignDirectionId, DesignDiversityFixture> = {
  premiumEditorial: {
    directionId: "premiumEditorial",
    selectedDirection: directionFacts.premiumEditorial,
    pages: {
      home: {
        directionId: "premiumEditorial",
        ...directionFacts.premiumEditorial,
        sections: ["header", "hero", "collections", "story", "products", "campaign", "footer"],
        composition: "editorial-chapters",
        hero: "full-bleed-editorial",
        navigation: "transparent-overlay",
        collectionDiscovery: "image-led",
        productCards: "premium-image-first",
        storyTrustCampaign: "editorial-chapters",
      },
      collection: {
        directionId: "premiumEditorial",
        ...directionFacts.premiumEditorial,
        sections: ["header", "collectionHero", "filters", "productGrid", "story", "footer"],
        composition: "editorial-image-led",
        discovery: "image-led",
        structure: "editorial-grid",
        productCard: "premium-image-first",
      },
      product: {
        directionId: "premiumEditorial",
        ...directionFacts.premiumEditorial,
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
    responsive: responsive(),
    localePresentation: locales("premium"),
    forbiddenLocaleTerms: ["aurum", "karvonen", "lumo"],
    contentCases: contentCases(),
    protectedCommerce: canonicalCommerceBaseline,
    approvedAssets: structuredClone(approvedAssets),
    assetUses: structuredClone(assetUses),
  },
  modernTechnical: {
    directionId: "modernTechnical",
    selectedDirection: directionFacts.modernTechnical,
    pages: {
      home: {
        directionId: "modernTechnical",
        ...directionFacts.modernTechnical,
        sections: ["header", "hero", "products", "collections", "trust", "footer"],
        composition: "commerce-dashboard",
        hero: "asymmetric-contained",
        navigation: "compact-utility",
        collectionDiscovery: "horizontal-filters",
        productCards: "compact-commerce",
        storyTrustCampaign: "technical-trust",
      },
      collection: {
        directionId: "modernTechnical",
        ...directionFacts.modernTechnical,
        sections: ["header", "filterBar", "productGrid", "comparison", "footer"],
        composition: "dense-filtered-grid",
        discovery: "horizontal-filters",
        structure: "dense-grid",
        productCard: "compact-commerce",
      },
      product: {
        directionId: "modernTechnical",
        ...directionFacts.modernTechnical,
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
    responsive: responsive(),
    localePresentation: locales("technical"),
    forbiddenLocaleTerms: ["aurum", "karvonen", "lumo"],
    contentCases: contentCases(),
    protectedCommerce: canonicalCommerceBaseline,
    approvedAssets: structuredClone(approvedAssets),
    assetUses: structuredClone(assetUses),
  },
  warmApproachable: {
    directionId: "warmApproachable",
    selectedDirection: directionFacts.warmApproachable,
    pages: {
      home: {
        directionId: "warmApproachable",
        ...directionFacts.warmApproachable,
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
        collectionDiscovery: "story-led-cards",
        productCards: "soft-standard",
        storyTrustCampaign: "warm-guidance",
      },
      collection: {
        directionId: "warmApproachable",
        ...directionFacts.warmApproachable,
        sections: ["header", "collectionIntro", "categoryCards", "productGrid", "trust", "footer"],
        composition: "approachable-editorial-cards",
        discovery: "story-led-cards",
        structure: "category-cards",
        productCard: "soft-standard",
      },
      product: {
        directionId: "warmApproachable",
        ...directionFacts.warmApproachable,
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
        options: "friendly-groups",
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
    responsive: responsive(),
    localePresentation: locales("warm"),
    forbiddenLocaleTerms: ["aurum", "karvonen", "lumo"],
    contentCases: contentCases(),
    protectedCommerce: canonicalCommerceBaseline,
    approvedAssets: structuredClone(approvedAssets),
    assetUses: structuredClone(assetUses),
  },
};

export const knownDistinctDesignDirections = Object.values(baseByDirection).map((fixture) =>
  structuredClone(fixture),
);
export const knownColourOnlyDesignDirections = knownDistinctDesignDirections.map((fixture) => {
  const reference = structuredClone(baseByDirection.premiumEditorial);
  return {
    ...reference,
    directionId: fixture.directionId,
    selectedDirection: fixture.selectedDirection,
    pages: Object.fromEntries(
      Object.entries(reference.pages).map(([pageType, page]) => [
        pageType,
        { ...page, directionId: fixture.directionId, ...fixture.selectedDirection },
      ]),
    ) as DesignDiversityFixture["pages"],
    designSystem: { ...reference.designSystem, colours: `${fixture.directionId}-palette` },
  };
});
