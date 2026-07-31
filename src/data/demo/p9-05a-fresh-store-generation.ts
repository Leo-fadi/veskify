import {
  createApprovedGenerationAssetContextFingerprint,
  approvedGenerationAssetContextSchema,
} from "@/application/ai-storefront-generation";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { createWholeStorefrontRecipeContext } from "@/application/whole-storefront-generation-plan";
import { getComponentDefinition, validateRegisteredSnapshot } from "@/components/registry";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { componentDefinitionV2Schema } from "@/domain/component-platform";
import { brandSystemSchema } from "@/domain/design-system";
import { projectSchema } from "@/domain/project";
import {
  storefrontDesignBriefContractSchema,
  type StorefrontDesignBriefContract,
} from "@/domain/source-discovery";
import {
  canonicalValueString,
  storefrontSnapshotSchema,
  type SectionInstance,
} from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";

export const P9_05A_FIXED_TIME = "2026-07-28T09:00:00.000Z";
export const P9_05A_PROJECT_ID = "project_lumo_fresh";
export const P9_05A_CATALOGUE_ID = "catalogue_lumo_fresh";
export const P9_05A_DRAFT_ID = "snapshot_lumo_fresh_draft";
export const P9_05A_PUBLISHED_ID = "snapshot_lumo_fresh_published";
export const P9_05A_SIMPLE_PRODUCT_ID = "product_lumo_arc_studs";
export const P9_05A_COMPLEX_PRODUCT_ID = "product_lumo_custom_ring";
export const P9_05A_COLLECTION_ID = "collection_lumo_jewellery";

const HOME_PAGE_ID = "page_lumo_home";
const COLLECTION_PAGE_ID = "page_lumo_collection";
const PRODUCT_PAGE_ID = "page_lumo_product";
const SOURCE_ID = "source_lumo_merchant";
const EVIDENCE_ID = "evidence_lumo_identity";
const SOURCE_URL = "https://lumo.example/";

const localized = (en: string, fi: string) => ({ en, fi });

const approvedAssetDefinitions = [
  {
    assetId: "asset_lumo_logo",
    candidateRole: "logo" as const,
    role: "logo" as const,
    mediaType: "image/svg+xml",
    sourceUrl: "https://lumo.example/assets/logo.svg",
    purpose: "Approved Lumo Atelier logo.",
    alt: null,
    decorative: true,
  },
  {
    assetId: "asset_lumo_hero",
    candidateRole: "hero" as const,
    role: "heroDesktop" as const,
    mediaType: "image/jpeg",
    sourceUrl: "https://lumo.example/assets/bench.jpg",
    purpose: "Approved wide image of the Lumo Atelier workbench.",
    alt: localized(
      "Jeweller working at the Lumo Atelier bench",
      "Koruntekijä Lumo Atelierin työpöydän ääressä",
    ),
    decorative: false,
  },
  {
    assetId: "asset_lumo_story",
    candidateRole: "editorial" as const,
    role: "editorialImage" as const,
    mediaType: "image/jpeg",
    sourceUrl: "https://lumo.example/assets/craft.jpg",
    purpose: "Approved close-up image of Lumo Atelier craftsmanship.",
    alt: localized("Hand-finishing a ring", "Sormuksen viimeistely käsin"),
    decorative: false,
  },
  {
    assetId: "asset_lumo_collection",
    candidateRole: "collection" as const,
    role: "collectionImage" as const,
    mediaType: "image/jpeg",
    sourceUrl: "https://lumo.example/assets/collection.jpg",
    purpose: "Approved image for Lumo Atelier collection discovery.",
    alt: localized("Lumo Atelier jewellery collection", "Lumo Atelierin korumallisto"),
    decorative: false,
  },
] as const;

export type P905aDirectionId = "premiumEditorial" | "modernTechnical" | "warmApproachable";

export const p905aDirectionScenarios = {
  premiumEditorial: {
    id: "premiumEditorial",
    merchantInstruction: "Apply a warm premium style across the storefront.",
    briefDirection: {
      typographyDirection: "serif-led",
      visualStyleDirection: "editorial",
      imageryDirection: "editorial",
      toneKeywords: ["elegant"],
    },
    expected: {
      homepageRecipeId: "homePremiumEditorial",
      homepageOrder: ["header", "hero", "featuredCategories", "productGrid", "footer"],
      heroVariant: "fullBleed",
      productCardFamilyId: "premiumJewellery",
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
      typographyDirectionId: "refinedSerif",
      spacingDensity: "spacious",
      cornerTreatment: "soft",
      surfaceDepth: "layered",
      imageTreatmentId: "editorialCrop",
    },
  },
  modernTechnical: {
    id: "modernTechnical",
    merchantInstruction:
      "Use a minimal Nordic colour and typography direction throughout the site.",
    briefDirection: {
      typographyDirection: "sans-led",
      visualStyleDirection: "minimal",
      imageryDirection: "product-focused",
      toneKeywords: ["technical"],
    },
    expected: {
      homepageRecipeId: "homeModernCommerce",
      homepageOrder: [
        "header",
        "hero",
        "productGrid",
        "featuredCategories",
        "brandStory",
        "benefitIcons",
        "footer",
      ],
      heroVariant: "asymmetric",
      productCardFamilyId: "compactCommerce",
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
      typographyDirectionId: "technicalFunctional",
      spacingDensity: "compact",
      cornerTreatment: "square",
      surfaceDepth: "flat",
      imageTreatmentId: "productNeutral",
    },
  },
  warmApproachable: {
    id: "warmApproachable",
    merchantInstruction: "Apply a warm premium style across the storefront.",
    briefDirection: {
      typographyDirection: "soft",
      visualStyleDirection: "natural",
      imageryDirection: "mixed",
      toneKeywords: ["warm"],
    },
    expected: {
      homepageRecipeId: "homeWarmStory",
      homepageOrder: [
        "header",
        "hero",
        "brandStory",
        "featuredCategories",
        "productGrid",
        "footer",
      ],
      heroVariant: "editorial",
      productCardFamilyId: "minimalProduct",
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
      typographyDirectionId: "warmApproachable",
      spacingDensity: "standard",
      cornerTreatment: "rounded",
      surfaceDepth: "subtle",
      imageTreatmentId: "softFrame",
    },
  },
} as const satisfies Record<
  P905aDirectionId,
  {
    id: P905aDirectionId;
    merchantInstruction: string;
    briefDirection: {
      typographyDirection: "serif-led" | "sans-led" | "soft";
      visualStyleDirection: "editorial" | "minimal" | "natural";
      imageryDirection: "editorial" | "product-focused" | "mixed";
      toneKeywords: readonly ("elegant" | "technical" | "warm")[];
    };
    expected: {
      homepageRecipeId: string;
      homepageOrder: readonly string[];
      heroVariant: string;
      productCardFamilyId: string;
      collectionPresentation: {
        variant: string;
        gridDensity: string;
        cardVariant: string;
        filterLayout: string;
      };
      productPresentation: {
        variant: string;
        galleryLayout: string;
        optionDensity: string;
        attributeLayout: string;
        mediaTreatment: string;
      };
      typographyDirectionId: string;
      spacingDensity: string;
      cornerTreatment: string;
      surfaceDepth: string;
      imageTreatmentId: string;
    };
  }
>;

function section(
  id: string,
  component: string,
  overrides: Partial<Pick<SectionInstance, "variant" | "content" | "props">> = {},
): SectionInstance {
  const definition = getComponentDefinition(component);
  return {
    id,
    component,
    variant: overrides.variant ?? definition.defaultVariant,
    visible: true,
    content: structuredClone(overrides.content ?? definition.defaultContent),
    props: structuredClone(overrides.props ?? definition.defaultProps),
  };
}

const catalogue = catalogueDisplayModelSchema.parse({
  id: P9_05A_CATALOGUE_ID,
  products: [
    {
      id: P9_05A_SIMPLE_PRODUCT_ID,
      sku: "LUMO-STUD-01",
      title: localized("Arc Studs", "Kaari-nappikorvakorut"),
      description: localized(
        "Recycled silver studs with a softly curved profile.",
        "Kierrätyshopeiset nappikorvakorut pehmeästi kaartuvalla muodolla.",
      ),
      brand: "Lumo Atelier",
      category: "Earrings",
      price: { amount: 120, currency: "EUR" },
      compareAtPrice: { amount: 145, currency: "EUR" },
      availabilityLabel: localized("Ready to ship", "Heti toimitettavissa"),
      stockStatus: "inStock",
      images: [
        {
          id: "media_lumo_studs_main",
          url: "/seed-assets/lumo/arc-studs.svg",
          alt: localized("Pair of Lumo Arc silver studs", "Lumo Kaari -hopeakorvakorupari"),
          decorative: false,
        },
      ],
      productType: "earrings",
      attributes: {
        material: "recycled silver",
        fineness: "925",
        soldAs: "pair",
      },
      variants: [],
      seo: {
        title: localized("Arc Studs | Lumo Atelier", "Kaari-nappikorvakorut | Lumo Atelier"),
        metaDescription: localized(
          "Recycled silver stud earrings made in Finland.",
          "Suomessa valmistetut kierrätyshopeiset nappikorvakorut.",
        ),
      },
    },
    {
      id: P9_05A_COMPLEX_PRODUCT_ID,
      sku: "LUMO-RING-CUSTOM",
      title: localized("Custom Halo Ring", "Muokattava Halo-sormus"),
      description: localized(
        "A made-to-order ring configured from approved metal, size and stone choices.",
        "Tilauksesta valmistettava sormus hyväksytyillä metalli-, koko- ja kivivalinnoilla.",
      ),
      brand: "Lumo Atelier",
      category: "Rings",
      price: { amount: 890, currency: "EUR" },
      availabilityLabel: localized("Made to order", "Valmistetaan tilauksesta"),
      stockStatus: "lowStock",
      images: [
        {
          id: "media_lumo_ring_main",
          url: "/seed-assets/lumo/custom-halo-ring.svg",
          alt: localized("Lumo custom halo ring", "Lumo-muokattava halosormus"),
          decorative: false,
        },
        {
          id: "media_lumo_ring_detail",
          url: "/seed-assets/lumo/custom-halo-ring-detail.svg",
          alt: localized("Lumo halo ring side profile", "Lumo-halosormuksen sivuprofiili"),
          decorative: false,
        },
      ],
      productType: "ring",
      attributes: {
        material: "gold",
        ringSizes: ["16", "17", "18", "19"],
        metalColours: ["yellow", "white"],
        stoneTypes: ["moissanite", "diamond"],
        engraving: "available",
      },
      variants: [
        {
          id: "variant_lumo_ring_yellow_17",
          label: localized("Yellow gold · size 17", "Keltakulta · koko 17"),
          attributes: { metalColour: "yellow", ringSize: "17", purity: "14K" },
          price: { amount: 890, currency: "EUR" },
        },
        {
          id: "variant_lumo_ring_white_17",
          label: localized("White gold · size 17", "Valkokulta · koko 17"),
          attributes: { metalColour: "white", ringSize: "17", purity: "14K" },
          price: { amount: 940, currency: "EUR" },
        },
        {
          id: "variant_lumo_ring_yellow_18",
          label: localized("Yellow gold · size 18", "Keltakulta · koko 18"),
          attributes: { metalColour: "yellow", ringSize: "18", purity: "14K" },
          price: { amount: 890, currency: "EUR" },
        },
      ],
      orderOptions: [
        {
          id: "option_lumo_ring_size",
          type: "selection",
          label: localized("Ring size", "Sormuskoko"),
          required: true,
          values: ["16", "17", "18", "19"].map((value) => localized(value, value)),
        },
        {
          id: "option_lumo_metal_colour",
          type: "selection",
          label: localized("Metal colour", "Metallin väri"),
          required: true,
          values: [localized("Yellow gold", "Keltakulta"), localized("White gold", "Valkokulta")],
        },
        {
          id: "option_lumo_purity",
          type: "selection",
          label: localized("Gold purity", "Kullan pitoisuus"),
          required: true,
          values: [localized("14K", "14K"), localized("18K", "18K")],
        },
        {
          id: "option_lumo_stone",
          type: "selection",
          label: localized("Stone", "Kivi"),
          required: true,
          values: [localized("Moissanite", "Moissaniitti"), localized("Diamond", "Timantti")],
        },
        {
          id: "option_lumo_engraving",
          type: "text",
          label: localized("Engraving", "Kaiverrus"),
          required: false,
          maxLength: 24,
        },
      ],
      seo: {
        title: localized(
          "Custom Halo Ring | Lumo Atelier",
          "Muokattava Halo-sormus | Lumo Atelier",
        ),
        metaDescription: localized(
          "Configure a made-to-order Lumo Atelier halo ring.",
          "Muokkaa tilauksesta valmistettava Lumo Atelierin halosormus.",
        ),
      },
    },
  ],
  collections: [
    {
      id: P9_05A_COLLECTION_ID,
      slug: "jewellery",
      title: localized("Jewellery", "Korut"),
      description: localized(
        "Small-batch pieces and made-to-order rings.",
        "Pienissä erissä valmistettuja koruja ja tilaussormuksia.",
      ),
      productIds: [P9_05A_SIMPLE_PRODUCT_ID, P9_05A_COMPLEX_PRODUCT_ID],
    },
  ],
});

const initialBrandSystem = brandSystemSchema.parse({
  colors: {
    primary: "#4B5148",
    secondary: "#7B6E62",
    accent: "#B4825A",
    background: "#FAF8F4",
    surface: "#FFFFFF",
    text: "#242522",
    mutedText: "#60635C",
    border: "#D8D4CC",
  },
  typography: {
    headingFont: "system-serif",
    bodyFont: "system-sans",
    baseSize: 16,
    scaleRatio: 1.2,
    headingWeight: 600,
    bodyWeight: 400,
  },
  shape: { radius: "subtle" },
  spacing: { density: "balanced" },
  imagery: { style: "mixed" },
  voice: {
    formality: "balanced",
    detail: "concise",
    positioning: "accessible",
    warmth: "warm",
    energy: "balanced",
  },
});

const sharedHeader = (suffix: string) =>
  section(`section_lumo_header_${suffix}`, "header", {
    content: { brandName: "Lumo Atelier" },
    props: { showSearch: true, showCart: true },
    variant: "centered",
  });

const sharedFooter = (suffix: string) =>
  section(`section_lumo_footer_${suffix}`, "footer", {
    content: {
      brandName: "Lumo Atelier",
      contact: localized("Helsinki · studio@lumo.example", "Helsinki · studio@lumo.example"),
      policyLabel: localized("Store information · Privacy", "Myymälätiedot · Tietosuoja"),
      copyright: localized("© Lumo Atelier", "© Lumo Atelier"),
    },
    props: { showPolicies: true },
    variant: "columns",
  });

const draftSnapshot = storefrontSnapshotSchema.parse({
  id: P9_05A_DRAFT_ID,
  projectId: P9_05A_PROJECT_ID,
  revision: 0,
  brandSystem: initialBrandSystem,
  navigation: {
    primary: [
      {
        id: "navigation_lumo_home",
        label: localized("Home", "Etusivu"),
        target: { type: "page", pageId: HOME_PAGE_ID },
      },
      {
        id: "navigation_lumo_collection",
        label: localized("Jewellery", "Korut"),
        target: { type: "page", pageId: COLLECTION_PAGE_ID },
      },
      {
        id: "navigation_lumo_ring",
        label: localized("Custom ring", "Muokattava sormus"),
        target: { type: "page", pageId: PRODUCT_PAGE_ID },
      },
    ],
    footer: [],
  },
  pages: [
    {
      id: HOME_PAGE_ID,
      type: "home",
      slug: "/",
      title: localized("Lumo Atelier", "Lumo Atelier"),
      seo: {
        title: localized("Lumo Atelier jewellery", "Lumo Atelierin korut"),
        metaDescription: localized(
          "Finnish small-batch jewellery and made-to-order rings.",
          "Suomalaisia pieneräkoruja ja tilaussormuksia.",
        ),
      },
      sections: [
        sharedHeader("home"),
        section("section_lumo_hero", "hero", {
          variant: "restrained",
          content: {
            eyebrow: localized("Lumo Atelier", "Lumo Atelier"),
            title: localized("Jewellery shaped by patient hands", "Koruja kärsivällisin käsin"),
            body: localized(
              "Small-batch pieces and rings configured for their wearer.",
              "Pieneräkoruja ja käyttäjälleen muokattavia sormuksia.",
            ),
            cta: {
              label: localized("Discover jewellery", "Tutustu koruihin"),
              href: "/collections/jewellery",
            },
            media: {
              id: "asset_lumo_hero",
              url: "/seed-assets/lumo/workbench.svg",
              alt: localized(
                "Jeweller working at the Lumo Atelier bench",
                "Koruntekijä Lumo Atelierin työpöydän ääressä",
              ),
              decorative: false,
            },
          },
          props: { mediaPosition: "right" },
        }),
        section("section_lumo_categories", "featuredCategories", {
          content: {
            heading: localized("Start with a collection", "Aloita mallistosta"),
            collectionIds: [P9_05A_COLLECTION_ID],
          },
          props: { cardAspect: "square" },
          variant: "grid",
        }),
        section("section_lumo_products", "productGrid", {
          content: {
            heading: localized("Made at Lumo Atelier", "Valmistettu Lumo Atelierissa"),
            productIds: [P9_05A_SIMPLE_PRODUCT_ID, P9_05A_COMPLEX_PRODUCT_ID],
          },
          props: { columns: "two" },
          variant: "standard",
        }),
        sharedFooter("home"),
      ],
    },
    {
      id: COLLECTION_PAGE_ID,
      type: "collection",
      slug: "/collections/jewellery",
      title: localized("Jewellery", "Korut"),
      seo: {
        title: localized("Jewellery | Lumo Atelier", "Korut | Lumo Atelier"),
        metaDescription: localized(
          "Browse Lumo Atelier jewellery.",
          "Tutustu Lumo Atelierin koruihin.",
        ),
      },
      sections: [
        sharedHeader("collection"),
        section("section_lumo_collection_header", "collectionHeader", {
          content: { collectionId: P9_05A_COLLECTION_ID },
        }),
        section("section_lumo_collection_filters", "filterBar"),
        section("section_lumo_collection_products", "productGrid", {
          content: {
            heading: localized("Jewellery", "Korut"),
            productIds: [P9_05A_SIMPLE_PRODUCT_ID, P9_05A_COMPLEX_PRODUCT_ID],
          },
          props: { columns: "two" },
        }),
        sharedFooter("collection"),
      ],
    },
    {
      id: PRODUCT_PAGE_ID,
      type: "product",
      slug: "/products/custom-halo-ring",
      title: localized("Custom Halo Ring", "Muokattava Halo-sormus"),
      seo: {
        title: localized(
          "Custom Halo Ring | Lumo Atelier",
          "Muokattava Halo-sormus | Lumo Atelier",
        ),
        metaDescription: localized(
          "Configure the Lumo Atelier Custom Halo Ring.",
          "Muokkaa Lumo Atelierin Halo-sormus.",
        ),
      },
      sections: [
        sharedHeader("product"),
        section("section_lumo_product_gallery", "productGallery", {
          content: { productId: P9_05A_COMPLEX_PRODUCT_ID },
        }),
        section("section_lumo_product_info", "productInfo", {
          content: { productId: P9_05A_COMPLEX_PRODUCT_ID },
          props: { showRating: false },
        }),
        section("section_lumo_product_options", "productOptions", {
          content: { productId: P9_05A_COMPLEX_PRODUCT_ID },
        }),
        sharedFooter("product"),
      ],
    },
  ],
  catalogueRef: P9_05A_CATALOGUE_ID,
  createdAt: P9_05A_FIXED_TIME,
  createdBy: "system",
});

const publishedSnapshot = storefrontSnapshotSchema.parse({
  ...structuredClone(draftSnapshot),
  id: P9_05A_PUBLISHED_ID,
  createdBy: "system",
});

const project = projectSchema.parse({
  id: P9_05A_PROJECT_ID,
  name: "Lumo Atelier",
  mode: "merchant",
  industry: "jewellery",
  primaryLocale: "fi",
  enabledLocales: ["en", "fi"],
  businessProfile: {
    name: "Lumo Atelier",
    description:
      "A Finnish small-batch jewellery studio focused on careful craft and guided ring discovery.",
    audience: "Customers seeking personal jewellery and a clear made-to-order ring process.",
    market: "Finland",
    sourceReferences: [SOURCE_URL],
  },
  publishedSnapshotId: P9_05A_PUBLISHED_ID,
  draftSnapshotId: P9_05A_DRAFT_ID,
  revision: 0,
  createdAt: P9_05A_FIXED_TIME,
  updatedAt: P9_05A_FIXED_TIME,
});

const aggregate: ProjectAggregate = {
  project,
  catalogue,
  snapshots: [
    validateRegisteredSnapshot(publishedSnapshot, catalogue, "fi", "fi"),
    validateRegisteredSnapshot(draftSnapshot, catalogue, "fi", "fi"),
  ],
};

function approvedBrief(directionId: P905aDirectionId): StorefrontDesignBriefContract {
  const direction = p905aDirectionScenarios[directionId].briefDirection;
  const brief = createStorefrontDesignBrief({
    id: `brief_lumo_${directionId.replace(/[A-Z]/g, (value) => `_${value.toLowerCase()}`)}`,
    now: P9_05A_FIXED_TIME,
    businessIdentity: {
      businessName: "Lumo Atelier",
      shortDescription:
        "A Finnish small-batch jewellery studio combining careful craftsmanship with guided ring discovery.",
      industry: "jewellery",
      targetCustomer: "Customers seeking personal jewellery and clear made-to-order guidance.",
      primaryMarket: "Finland",
    },
    languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "fi" },
    sourceReferenceIds: [SOURCE_ID],
    sourceEvidenceIds: [EVIDENCE_ID],
    materialEvidence: {
      sourceReferences: [
        {
          id: SOURCE_ID,
          sourceType: "deterministic-fixture",
          url: SOURCE_URL,
          normalizedOrigin: new URL(SOURCE_URL).origin,
          requestedLocale: "fi",
          discoveredAt: P9_05A_FIXED_TIME,
          allowedDiscoveryPolicy: {
            mode: "deterministic",
            maxPages: 1,
            maxAssets: approvedAssetDefinitions.length,
            followSameOriginOnly: true,
          },
          status: "complete",
          warnings: [],
          failure: null,
        },
      ],
      evidence: [
        {
          id: EVIDENCE_ID,
          kind: "page-identity",
          provenance: {
            sourceReferenceId: SOURCE_ID,
            sourceUrl: SOURCE_URL,
            documentUrl: null,
            observedAt: P9_05A_FIXED_TIME,
            extractionLocation: "merchant-approved-input",
          },
          sourceUrl: SOURCE_URL,
          confidence: 1,
          observedValue: {
            businessName: "Lumo Atelier",
            businessDescription:
              "Finnish small-batch jewellery and guided made-to-order ring discovery.",
          },
          extractionMethod: "deterministic-p9-05a-fixture",
          locale: "fi",
          warnings: [],
          uncertainty: { isUncertain: false, reason: null },
        },
      ],
      assetCandidates: approvedAssetDefinitions.map((asset) => ({
        id: asset.assetId,
        role: asset.candidateRole,
        source: { kind: "source-url" as const, url: asset.sourceUrl },
        dimensions: asset.role === "logo" ? null : { width: 1600, height: 1000 },
        mediaType: asset.mediaType,
        provenance: {
          sourceReferenceId: SOURCE_ID,
          sourceUrl: asset.sourceUrl,
          documentUrl: SOURCE_URL,
          observedAt: P9_05A_FIXED_TIME,
          extractionLocation: "merchant-approved-input",
        },
        confidence: 1,
        proposedReusePurpose: asset.purpose,
        licensingUsageConfirmation: "confirmed" as const,
        warnings: [],
        uncertainty: { isUncertain: false, reason: null },
        fingerprint: { algorithm: "sha256" as const, value: `material-${asset.assetId}` },
        duplicateOfAssetId: null,
      })),
      reconciliation: null,
    },
    canonicalCommerceProjectionRef: P9_05A_CATALOGUE_ID,
    approvedReusableAssetIds: approvedAssetDefinitions.map((asset) => asset.assetId),
    approvedAssetAssignments: approvedAssetDefinitions.map((asset) => ({
      assetId: asset.assetId,
      role: asset.role,
      revision: "1:p9-05a-approved",
      fingerprint: `material-${asset.assetId}`,
    })),
    assetReviewFingerprint: "asset-review-lumo-p9-05a",
    pagePlan: { pageTypes: ["home", "collection", "product"] },
    navigationDirection: ["Use the canonical home, jewellery and custom-ring page targets."],
    homepageGoals: [
      "Lead with approved craft imagery and make collection discovery clear.",
      "Use the canonical product collection without copying product facts into editable content.",
    ],
    collectionPageGoals: ["Keep canonical product membership and ordering unchanged."],
    productPageGoals: ["Guide every configured ring choice without changing canonical options."],
    visualPriorities: ["Create one coherent direction across homepage, collection and product."],
    excludedClaims: [
      "Do not invent materials, guarantees, delivery promises, certifications or availability.",
    ],
    generationPermissions: { allowAssetReuse: true },
    approvedBrandDirection: {
      logoAssetRef: { id: "asset_lumo_logo", label: "Lumo Atelier logo" },
      supportingImageAssetRefs: [
        { id: "asset_lumo_hero", label: "Lumo Atelier workbench" },
        { id: "asset_lumo_story", label: "Lumo Atelier craftsmanship" },
        { id: "asset_lumo_collection", label: "Lumo Atelier jewellery collection" },
      ],
      preferredBrandColours: ["#4B5148", "#B4825A"],
      typographyDirection: direction.typographyDirection,
      visualStyleDirection: direction.visualStyleDirection,
      imageryDirection: direction.imageryDirection,
      toneKeywords: [...direction.toneKeywords],
    },
  });
  return storefrontDesignBriefContractSchema.parse(
    approveStorefrontDesignBrief(brief, {
      actorId: "merchant_lumo_owner",
      approvedAt: P9_05A_FIXED_TIME,
    }),
  );
}

function approvedAssetContext(brief: StorefrontDesignBriefContract) {
  const input = {
    briefId: brief.id,
    briefRevision: brief.revision,
    approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint!,
    assetReviewFingerprint: brief.assetReviewFingerprint!,
    assets: approvedAssetDefinitions.map((asset) => ({
      assetId: asset.assetId,
      role: asset.role,
      sourceReferenceId: SOURCE_ID,
      revision: "1:p9-05a-approved",
      materialFingerprint: `material-${asset.assetId}`,
      provenance: { location: "merchant-upload" as const, observedAt: P9_05A_FIXED_TIME },
      alt: asset.alt,
      presentation: {
        decorative: asset.decorative,
        mediaType: asset.mediaType,
        responsiveCrops: [],
      },
      approval: {
        actorId: "merchant_lumo_owner",
        actorReference: "p9-05a-approved-brief",
      },
    })),
  };
  return approvedGenerationAssetContextSchema.parse({
    ...input,
    fingerprint: createApprovedGenerationAssetContextFingerprint(input),
  });
}

export function createP905aFreshMerchantFixture(directionId: P905aDirectionId) {
  const brief = approvedBrief(directionId);
  const assetContext = approvedAssetContext(brief);
  const freshAggregate = structuredClone(aggregate);
  const draft = freshAggregate.snapshots.find(
    (snapshot) => snapshot.id === freshAggregate.project.draftSnapshotId,
  )!;
  const published = freshAggregate.snapshots.find(
    (snapshot) => snapshot.id === freshAggregate.project.publishedSnapshotId,
  )!;
  return {
    direction: p905aDirectionScenarios[directionId],
    aggregate: freshAggregate,
    draft,
    published,
    brief,
    assetContext,
    assetPresentations: assetContext.assets.map((asset) => {
      const definition = approvedAssetDefinitions.find(
        (candidate) => candidate.assetId === asset.assetId,
      );
      if (!definition) throw new Error(`Missing Lumo presentation asset: ${asset.assetId}.`);
      return {
        assetId: asset.assetId,
        role: asset.role,
        revision: asset.revision,
        materialFingerprint: asset.materialFingerprint,
        asset: {
          id: asset.assetId,
          url: definition.sourceUrl,
          ...(asset.alt === null || asset.alt === undefined ? {} : { alt: asset.alt }),
          decorative: asset.presentation.decorative,
        },
      };
    }),
    planningInput: {
      brief,
      project: {
        id: freshAggregate.project.id,
        revision: freshAggregate.project.revision,
        enabledLocales: [...freshAggregate.project.enabledLocales],
      },
      draft,
      catalogue: freshAggregate.catalogue,
      componentDefinitions: veskifyComponentDefinitionsV2.map((definition) =>
        componentDefinitionV2Schema.parse(structuredClone(definition)),
      ),
      recipeContext: createWholeStorefrontRecipeContext(),
      approvedAssetContext: assetContext,
      requiredAssetPlacements: [],
    },
  };
}

export function p905aProtectedCommerceBaseline(
  input: ReturnType<typeof createP905aFreshMerchantFixture>["aggregate"]["catalogue"],
) {
  return structuredClone(input);
}

export function assertP905aFixtureIsolation() {
  const fixture = createP905aFreshMerchantFixture("premiumEditorial");
  const material = canonicalValueString({
    project: fixture.aggregate.project,
    catalogue: fixture.aggregate.catalogue,
    draft: fixture.draft,
    brief: fixture.brief,
  }).toLowerCase();
  return {
    containsAurum: material.includes("aurum"),
    containsKarvonen: material.includes("karvonen"),
    projectId: fixture.aggregate.project.id,
    catalogueId: fixture.aggregate.catalogue.id,
    snapshotIds: fixture.aggregate.snapshots.map((snapshot) => snapshot.id),
  };
}
