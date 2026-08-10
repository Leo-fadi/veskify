import {
  homepageCollectionNavigationDefinition,
  homepageEditorialDefinition,
  homepageFeaturedCollectionsDefinition,
  homepageFeaturedProductsDefinition,
  homepageHeroDefinition,
  homepageProofDefinition,
  homepagePromotionDefinition,
  homepageTrustDefinition,
} from "@/components/registry/homepage-commerce";
import { getSupportedSectionManifest } from "@/components/registry/supported-vocabulary";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { getCommercialSharedFrameProfile } from "@/domain/storefront/commercial-shared-frame";
import {
  canonicalProductCardAnatomyIdSchema,
  requireCanonicalProductCardAnatomy,
} from "@/domain/product-card";
import {
  deepFreeze,
  executablePageBlueprintProfileSchema,
  pageBlueprintCompositionContractSchema,
  storefrontTemplatePagePlanSchema,
  type CommercialHomepageProfileAuthority,
  type ExecutablePageBlueprintProfile,
  type StorefrontTemplatePagePlan,
  type StorefrontTemplateSlot,
} from "./contract";
import { z } from "zod";

export const COMMERCIAL_HOMEPAGE_PROFILE_VERSION = "1.0.0" as const;

export const commercialHomepageProfileIds = [
  "homepage-editorial-storytelling",
  "homepage-commerce-led-discovery",
  "homepage-minimal-brand-commerce",
  "homepage-campaign-led",
  "homepage-collection-gateway",
  "homepage-high-consideration",
] as const;
export const commercialHomepageProfileIdSchema = z.enum(commercialHomepageProfileIds);

export type CommercialHomepageProfileId = (typeof commercialHomepageProfileIds)[number];

export class CommercialHomepageProfileError extends Error {
  constructor(
    readonly code: "unknown-profile" | "unsatisfied-required-evidence" | "invalid-cardinality",
    message: string,
  ) {
    super(message);
    this.name = "CommercialHomepageProfileError";
  }
}

type SlotInput = Readonly<{
  id: string;
  required: boolean;
  sectionType: string;
  defaultVariant: string;
  purpose: StorefrontTemplateSlot["purpose"];
  narrativeRole: StorefrontTemplateSlot["narrativeRole"];
  visualWeight: StorefrontTemplateSlot["visualWeight"];
  omitWhen?: StorefrontTemplateSlot["omitWhen"];
}>;

type CommercialProfileInput = Readonly<{
  id: CommercialHomepageProfileId;
  slots: readonly SlotInput[];
  compatibleSharedFrameProfileIds: CommercialHomepageProfileAuthority["compatibleSharedFrameProfileIds"];
  defaultSharedFrameProfileId: CommercialHomepageProfileAuthority["defaultSharedFrameProfileId"];
  merchandisingEmphasis: CommercialHomepageProfileAuthority["merchandisingEmphasis"];
  productCardAnatomyId: CommercialHomepageProfileAuthority["productCardAnatomyId"];
  contentCardinality: CommercialHomepageProfileAuthority["contentCardinality"];
  evidenceRequirements: CommercialHomepageProfileAuthority["evidenceRequirements"];
  responsiveTransformationIds: readonly string[];
  designDnaNarrowing: CommercialHomepageProfileAuthority["designDnaNarrowing"];
}>;

const componentDefinitions = {
  homepageCollectionNavigation: homepageCollectionNavigationDefinition,
  homepageEditorial: homepageEditorialDefinition,
  homepageFeaturedCollections: homepageFeaturedCollectionsDefinition,
  homepageFeaturedProducts: homepageFeaturedProductsDefinition,
  homepageHero: homepageHeroDefinition,
  homepageProof: homepageProofDefinition,
  homepagePromotion: homepagePromotionDefinition,
  homepageTrust: homepageTrustDefinition,
} as const;

function slot(input: SlotInput): StorefrontTemplateSlot {
  const definition = componentDefinitions[input.sectionType as keyof typeof componentDefinitions];
  if (!definition) throw new Error(`Unknown commercial homepage component ${input.sectionType}.`);
  const variants = definition.variants.map(({ id }) => id);
  if (!variants.includes(input.defaultVariant)) {
    throw new Error(
      `Commercial homepage slot ${input.id} references unavailable variant ${input.defaultVariant}.`,
    );
  }
  return {
    id: input.id,
    required: input.required,
    sectionType: input.sectionType,
    allowedVariants: variants,
    defaultVariant: input.defaultVariant,
    label: { en: input.id.replaceAll("-", " "), fi: input.id.replaceAll("-", " ") },
    purpose: input.purpose,
    narrativeRole: input.narrativeRole,
    visualWeight: input.visualWeight,
    boundedParameterConstraints: [],
    omitWhen: input.required ? "never" : (input.omitWhen ?? "when-not-requested"),
  };
}

const homepageCompositionContract = pageBlueprintCompositionContractSchema.parse({
  allowedNarrativeRoles: [
    "orientation",
    "primary-discovery",
    "secondary-discovery",
    "brand-story",
    "brand-proof",
    "education",
    "campaign",
    "trust",
    "continuation",
  ],
  requiredNarrativeRoles: ["orientation", "primary-discovery", "continuation"],
  flowRuleIds: ["discovery-follows-orientation", "no-adjacent-dominant-sections"],
  maxRepeatedRole: 2,
  maxRepeatedComponentFamily: 4,
  boundedParameterConstraints: [],
  responsiveParameterIds: ["responsiveCollapse", "columnCount"],
});

const commercialHomepageResponsiveBreakpoints = [
  { breakpoint: "mobile" as const, viewport: 375 as const },
  { breakpoint: "tablet" as const, viewport: 768 as const },
  { breakpoint: "desktop" as const, viewport: 1024 as const },
  { breakpoint: "wide" as const, viewport: 1440 as const },
] as const;

function responsiveTransformationBreakpoints(productCardAnatomyId: string) {
  const registered = new Map<string, Set<string>>();
  const add = (
    transformations: readonly Readonly<{ id: string; breakpoints: readonly string[] }>[],
  ) => {
    transformations.forEach((transformation) => {
      const breakpoints = registered.get(transformation.id) ?? new Set<string>();
      transformation.breakpoints.forEach((breakpoint) => breakpoints.add(breakpoint));
      registered.set(transformation.id, breakpoints);
    });
  };
  Object.values(componentDefinitions).forEach((definition) =>
    add(definition.commercialAnatomy?.responsiveTransformations ?? []),
  );
  add(
    requireCanonicalProductCardAnatomy(productCardAnatomyId, "homepageMerchandising")
      .responsiveTransformations,
  );
  return registered;
}

function responsiveArchitecture(
  transformationIds: readonly string[],
  productCardAnatomyId: string,
): CommercialHomepageProfileAuthority["responsiveArchitecture"] {
  const unique = [...new Set(transformationIds)];
  const registered = responsiveTransformationBreakpoints(productCardAnatomyId);
  unique.forEach((transformationId) => {
    if (!registered.has(transformationId)) {
      throw new Error(
        `Commercial homepage responsive transformation ${transformationId} is unavailable.`,
      );
    }
  });
  return commercialHomepageResponsiveBreakpoints.map(({ breakpoint, viewport }) => ({
    breakpoint,
    viewport,
    transformationIds: unique.filter((transformationId) =>
      registered.get(transformationId)?.has(breakpoint),
    ),
  })) as CommercialHomepageProfileAuthority["responsiveArchitecture"];
}

function createProfile(input: CommercialProfileInput): StorefrontTemplatePagePlan {
  const slots = input.slots.map(slot);
  const roleCounts = new Map<StorefrontTemplateSlot["narrativeRole"], number>();
  slots.forEach((entry) =>
    roleCounts.set(entry.narrativeRole, (roleCounts.get(entry.narrativeRole) ?? 0) + 1),
  );
  const sectionCardinality = slots.map((entry) => ({
    slotId: entry.id,
    minimum: entry.required ? 1 : 0,
    ideal: 1,
    maximum: 1,
  }));
  const structuralMaterial = {
    orderedNarrativeRoles: slots.map((entry) => entry.narrativeRole),
    selections: slots.map((entry) => ({
      slotId: entry.id,
      component: entry.sectionType,
      variant: entry.defaultVariant,
      required: entry.required,
      omitWhen: entry.omitWhen,
    })),
    compatibleSharedFrameProfileIds: [...input.compatibleSharedFrameProfileIds],
    merchandisingEmphasis: input.merchandisingEmphasis,
    productCardAnatomyId: input.productCardAnatomyId,
    sectionCardinality,
    contentCardinality: input.contentCardinality,
    responsiveArchitecture: responsiveArchitecture(
      input.responsiveTransformationIds,
      input.productCardAnatomyId,
    ),
    designDnaNarrowing: input.designDnaNarrowing,
  };
  const structuralSignature = `homepage-structure-${canonicalValueFingerprint(structuralMaterial)}`;
  const authority: CommercialHomepageProfileAuthority = {
    family: "commercial-homepage",
    compatibleSharedFrameProfileIds: [...input.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: input.defaultSharedFrameProfileId,
    merchandisingEmphasis: input.merchandisingEmphasis,
    productCardAnatomyId: input.productCardAnatomyId,
    sectionCardinality,
    contentCardinality: input.contentCardinality.map((entry) => ({ ...entry })),
    evidenceRequirements: input.evidenceRequirements.map((entry) => ({ ...entry })),
    responsiveArchitecture: responsiveArchitecture(
      input.responsiveTransformationIds,
      input.productCardAnatomyId,
    ),
    designDnaNarrowing: structuredClone(input.designDnaNarrowing),
    structuralSignature,
    structuralFingerprint: `homepage-profile-${canonicalValueFingerprint({
      id: input.id,
      version: COMMERCIAL_HOMEPAGE_PROFILE_VERSION,
      structuralMaterial,
    })}`,
  };
  const profile: ExecutablePageBlueprintProfile = executablePageBlueprintProfileSchema.parse({
    id: input.id,
    version: COMMERCIAL_HOMEPAGE_PROFILE_VERSION,
    scope: "home",
    orderedNarrativeRoles: slots.map((entry) => entry.narrativeRole),
    roleCardinality: [...roleCounts.entries()].map(([role, maximum]) => ({
      role,
      minimum: slots.filter((entry) => entry.narrativeRole === role && entry.required).length,
      maximum,
    })),
    componentSelections: slots.map((entry) => ({
      slotId: entry.id,
      component: entry.sectionType,
      variants: [...entry.allowedVariants],
      defaultVariant: entry.defaultVariant,
    })),
    parameterDefaults: {},
    requiredBindingCategories: [
      "navigation",
      "projectBrandContext",
      ...(slots.some((entry) =>
        ["homepageFeaturedCollections", "homepageCollectionNavigation"].includes(entry.sectionType),
      )
        ? (["collectionList"] as const)
        : []),
      ...(slots.some((entry) => entry.sectionType === "homepageFeaturedProducts")
        ? (["productList"] as const)
        : []),
    ],
    requiredAssetRoles: [],
    responsiveBreakpoints: ["mobile", "tablet", "desktop", "wide"],
    accessibilityContract: "registered-component-contracts",
    commercialHomepage: authority,
  });
  return storefrontTemplatePagePlanSchema.parse({
    pageType: "home",
    slots,
    pageBlueprint: homepageCompositionContract,
    profile,
  });
}

const continuation = (id = "continuation"): SlotInput => ({
  id,
  required: true,
  sectionType: "homepageEditorial",
  defaultVariant: "continuationCta",
  purpose: "editorial-story",
  narrativeRole: "continuation",
  visualWeight: "light",
});

const profileInputs: readonly CommercialProfileInput[] = [
  {
    id: "homepage-editorial-storytelling",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "centered-minimal"],
    defaultSharedFrameProfileId: "editorial-masthead",
    merchandisingEmphasis: "curated-products",
    productCardAnatomyId: "editorial",
    contentCardinality: [
      { slotId: "curated-products", resource: "products", minimum: 1, ideal: 4, maximum: 8 },
    ],
    designDnaNarrowing: {
      spacingDensity: ["standard", "spacious"],
      surfaceDepth: ["subtle", "layered"],
      imagePosture: ["editorial", "immersive"],
    },
    responsiveTransformationIds: [
      "splitToStack",
      "storyReorder",
      "editorialStack",
      "lookbookCarousel",
      "quotePreserve",
      "continuationCondense",
    ],
    evidenceRequirements: [
      { slotId: "brand-story", authority: "approved-merchant-evidence", unsatisfiedPolicy: "omit" },
      { slotId: "editorial-lookbook", authority: "approved-media", unsatisfiedPolicy: "omit" },
      {
        slotId: "approved-proof",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "omit",
      },
    ],
    slots: [
      {
        id: "hero",
        required: true,
        sectionType: "homepageHero",
        defaultVariant: "editorialSplit",
        purpose: "hero",
        narrativeRole: "orientation",
        visualWeight: "dominant",
      },
      {
        id: "brand-story",
        required: false,
        sectionType: "homepageEditorial",
        defaultVariant: "brandStory",
        purpose: "editorial-story",
        narrativeRole: "brand-story",
        visualWeight: "heavy",
        omitWhen: "when-evidence-is-unavailable",
      },
      {
        id: "curated-products",
        required: true,
        sectionType: "homepageFeaturedProducts",
        defaultVariant: "editorial",
        purpose: "featured-products",
        narrativeRole: "primary-discovery",
        visualWeight: "heavy",
      },
      {
        id: "editorial-lookbook",
        required: false,
        sectionType: "homepageEditorial",
        defaultVariant: "lookbookGallery",
        purpose: "editorial-story",
        narrativeRole: "education",
        visualWeight: "heavy",
        omitWhen: "when-imagery-is-unavailable",
      },
      {
        id: "approved-proof",
        required: false,
        sectionType: "homepageProof",
        defaultVariant: "quoteSpotlight",
        purpose: "social-proof",
        narrativeRole: "brand-proof",
        visualWeight: "medium",
        omitWhen: "when-evidence-is-unavailable",
      },
      continuation(),
    ],
  },
  {
    id: "homepage-commerce-led-discovery",
    compatibleSharedFrameProfileIds: ["commerce-utility", "compact-technical"],
    defaultSharedFrameProfileId: "commerce-utility",
    merchandisingEmphasis: "product-discovery",
    productCardAnatomyId: "compact",
    contentCardinality: [
      { slotId: "collection-discovery", resource: "collections", minimum: 1, ideal: 4, maximum: 8 },
      { slotId: "product-discovery", resource: "products", minimum: 2, ideal: 8, maximum: 12 },
    ],
    designDnaNarrowing: {
      spacingDensity: ["compact", "standard"],
      surfaceDepth: ["flat", "subtle"],
      imagePosture: ["contained", "editorial"],
    },
    responsiveTransformationIds: [
      "asymmetricReflow",
      "compactSimplify",
      "campaignCondense",
      "serviceCondense",
      "continuationCondense",
    ],
    evidenceRequirements: [
      {
        slotId: "collection-discovery",
        authority: "canonical-commerce",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "product-discovery",
        authority: "canonical-commerce",
        unsatisfiedPolicy: "fail-closed",
      },
      { slotId: "campaign", authority: "approved-merchant-evidence", unsatisfiedPolicy: "omit" },
      {
        slotId: "service-proof",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "omit",
      },
    ],
    slots: [
      {
        id: "hero",
        required: true,
        sectionType: "homepageHero",
        defaultVariant: "asymmetric",
        purpose: "hero",
        narrativeRole: "orientation",
        visualWeight: "dominant",
      },
      {
        id: "collection-discovery",
        required: true,
        sectionType: "homepageCollectionNavigation",
        defaultVariant: "grid",
        purpose: "featured-categories",
        narrativeRole: "secondary-discovery",
        visualWeight: "heavy",
      },
      {
        id: "product-discovery",
        required: true,
        sectionType: "homepageFeaturedProducts",
        defaultVariant: "compact",
        purpose: "featured-products",
        narrativeRole: "primary-discovery",
        visualWeight: "heavy",
      },
      {
        id: "campaign",
        required: false,
        sectionType: "homepagePromotion",
        defaultVariant: "minimal",
        purpose: "campaign-promotion",
        narrativeRole: "campaign",
        visualWeight: "medium",
        omitWhen: "when-evidence-is-unavailable",
      },
      {
        id: "service-proof",
        required: false,
        sectionType: "homepageProof",
        defaultVariant: "serviceAssurance",
        purpose: "social-proof",
        narrativeRole: "trust",
        visualWeight: "medium",
        omitWhen: "when-evidence-is-unavailable",
      },
      continuation(),
    ],
  },
  {
    id: "homepage-minimal-brand-commerce",
    compatibleSharedFrameProfileIds: ["centered-minimal", "editorial-masthead"],
    defaultSharedFrameProfileId: "centered-minimal",
    merchandisingEmphasis: "restrained-commerce",
    productCardAnatomyId: "standard",
    contentCardinality: [
      { slotId: "focused-products", resource: "products", minimum: 1, ideal: 2, maximum: 4 },
    ],
    designDnaNarrowing: {
      spacingDensity: ["standard", "spacious"],
      surfaceDepth: ["flat", "subtle"],
      imagePosture: ["contained", "editorial"],
    },
    responsiveTransformationIds: ["restrainedCondense", "standardCondense", "continuationCondense"],
    evidenceRequirements: [
      {
        slotId: "focused-products",
        authority: "canonical-commerce",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "concise-service",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "omit",
      },
    ],
    slots: [
      {
        id: "hero",
        required: true,
        sectionType: "homepageHero",
        defaultVariant: "restrained",
        purpose: "hero",
        narrativeRole: "orientation",
        visualWeight: "heavy",
      },
      {
        id: "focused-products",
        required: true,
        sectionType: "homepageFeaturedProducts",
        defaultVariant: "standard",
        purpose: "featured-products",
        narrativeRole: "primary-discovery",
        visualWeight: "heavy",
      },
      {
        id: "concise-service",
        required: false,
        sectionType: "homepageTrust",
        defaultVariant: "minimal",
        purpose: "brand-values",
        narrativeRole: "trust",
        visualWeight: "light",
        omitWhen: "when-evidence-is-unavailable",
      },
      continuation(),
    ],
  },
  {
    id: "homepage-campaign-led",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "commerce-utility"],
    defaultSharedFrameProfileId: "editorial-masthead",
    merchandisingEmphasis: "campaign-conversion",
    productCardAnatomyId: "imageFirst",
    contentCardinality: [
      { slotId: "campaign-products", resource: "products", minimum: 1, ideal: 4, maximum: 8 },
    ],
    designDnaNarrowing: {
      spacingDensity: ["standard", "spacious"],
      surfaceDepth: ["subtle", "layered"],
      imagePosture: ["editorial", "immersive"],
    },
    responsiveTransformationIds: [
      "campaignReflow",
      "campaignMediaFirst",
      "imageFirstReorder",
      "storySplitStack",
      "proofGridStack",
      "continuationCondense",
    ],
    evidenceRequirements: [
      {
        slotId: "campaign",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "fail-closed",
      },
      { slotId: "campaign", authority: "approved-media", unsatisfiedPolicy: "fail-closed" },
      {
        slotId: "campaign-products",
        authority: "canonical-commerce",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "supporting-story",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "omit",
      },
      {
        slotId: "campaign-proof",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "omit",
      },
    ],
    slots: [
      {
        id: "hero",
        required: true,
        sectionType: "homepageHero",
        defaultVariant: "campaignMerchandising",
        purpose: "hero",
        narrativeRole: "orientation",
        visualWeight: "dominant",
      },
      {
        id: "campaign",
        required: true,
        sectionType: "homepagePromotion",
        defaultVariant: "imageLed",
        purpose: "campaign-promotion",
        narrativeRole: "campaign",
        visualWeight: "heavy",
      },
      {
        id: "campaign-products",
        required: true,
        sectionType: "homepageFeaturedProducts",
        defaultVariant: "editorial",
        purpose: "featured-products",
        narrativeRole: "primary-discovery",
        visualWeight: "heavy",
      },
      {
        id: "supporting-story",
        required: false,
        sectionType: "homepageEditorial",
        defaultVariant: "imageText",
        purpose: "editorial-story",
        narrativeRole: "brand-story",
        visualWeight: "medium",
        omitWhen: "when-evidence-is-unavailable",
      },
      {
        id: "campaign-proof",
        required: false,
        sectionType: "homepageProof",
        defaultVariant: "proofGrid",
        purpose: "social-proof",
        narrativeRole: "brand-proof",
        visualWeight: "medium",
        omitWhen: "when-evidence-is-unavailable",
      },
      continuation(),
    ],
  },
  {
    id: "homepage-collection-gateway",
    compatibleSharedFrameProfileIds: ["commerce-utility", "compact-technical"],
    defaultSharedFrameProfileId: "compact-technical",
    merchandisingEmphasis: "collection-discovery",
    productCardAnatomyId: "compact",
    contentCardinality: [
      { slotId: "featured-collections", resource: "collections", minimum: 1, ideal: 4, maximum: 6 },
      {
        slotId: "collection-navigation",
        resource: "collections",
        minimum: 1,
        ideal: 6,
        maximum: 12,
      },
      { slotId: "category-products", resource: "products", minimum: 1, ideal: 4, maximum: 8 },
    ],
    designDnaNarrowing: {
      spacingDensity: ["compact", "standard"],
      surfaceDepth: ["flat", "subtle"],
      imagePosture: ["contained", "editorial"],
    },
    responsiveTransformationIds: [
      "mediaFirstStack",
      "compactSimplify",
      "storyReorder",
      "serviceCondense",
      "continuationCondense",
    ],
    evidenceRequirements: [
      {
        slotId: "featured-collections",
        authority: "canonical-commerce",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "collection-navigation",
        authority: "canonical-commerce",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "category-products",
        authority: "canonical-commerce",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "editorial-reinforcement",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "omit",
      },
      {
        slotId: "service-proof",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "omit",
      },
    ],
    slots: [
      {
        id: "hero",
        required: true,
        sectionType: "homepageHero",
        defaultVariant: "imageLed",
        purpose: "hero",
        narrativeRole: "orientation",
        visualWeight: "dominant",
      },
      {
        id: "featured-collections",
        required: true,
        sectionType: "homepageFeaturedCollections",
        defaultVariant: "imageLed",
        purpose: "featured-categories",
        narrativeRole: "secondary-discovery",
        visualWeight: "heavy",
      },
      {
        id: "collection-navigation",
        required: true,
        sectionType: "homepageCollectionNavigation",
        defaultVariant: "carousel",
        purpose: "featured-categories",
        narrativeRole: "secondary-discovery",
        visualWeight: "medium",
      },
      {
        id: "category-products",
        required: true,
        sectionType: "homepageFeaturedProducts",
        defaultVariant: "compact",
        purpose: "featured-products",
        narrativeRole: "primary-discovery",
        visualWeight: "heavy",
      },
      {
        id: "editorial-reinforcement",
        required: false,
        sectionType: "homepageEditorial",
        defaultVariant: "brandStory",
        purpose: "editorial-story",
        narrativeRole: "brand-story",
        visualWeight: "medium",
        omitWhen: "when-evidence-is-unavailable",
      },
      {
        id: "service-proof",
        required: false,
        sectionType: "homepageProof",
        defaultVariant: "serviceAssurance",
        purpose: "social-proof",
        narrativeRole: "trust",
        visualWeight: "medium",
        omitWhen: "when-evidence-is-unavailable",
      },
      continuation(),
    ],
  },
  {
    id: "homepage-high-consideration",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "centered-minimal"],
    defaultSharedFrameProfileId: "centered-minimal",
    merchandisingEmphasis: "considered-purchase",
    productCardAnatomyId: "horizontal",
    contentCardinality: [
      { slotId: "selected-products", resource: "products", minimum: 1, ideal: 2, maximum: 4 },
    ],
    designDnaNarrowing: {
      spacingDensity: ["standard", "spacious"],
      surfaceDepth: ["subtle", "layered"],
      imagePosture: ["contained", "editorial"],
    },
    responsiveTransformationIds: [
      "splitToStack",
      "processCondense",
      "proofGridStack",
      "denseReflow",
      "storyReorder",
      "continuationCondense",
    ],
    evidenceRequirements: [
      {
        slotId: "process-explanation",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "process-explanation",
        authority: "approved-media",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "approved-proof",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "selected-products",
        authority: "canonical-commerce",
        unsatisfiedPolicy: "fail-closed",
      },
      {
        slotId: "service-context",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "omit",
      },
      {
        slotId: "supporting-editorial",
        authority: "approved-merchant-evidence",
        unsatisfiedPolicy: "omit",
      },
    ],
    slots: [
      {
        id: "hero",
        required: true,
        sectionType: "homepageHero",
        defaultVariant: "editorialSplit",
        purpose: "hero",
        narrativeRole: "orientation",
        visualWeight: "dominant",
      },
      {
        id: "process-explanation",
        required: true,
        sectionType: "homepageEditorial",
        defaultVariant: "craftProcess",
        purpose: "editorial-story",
        narrativeRole: "brand-story",
        visualWeight: "heavy",
      },
      {
        id: "approved-proof",
        required: true,
        sectionType: "homepageProof",
        defaultVariant: "proofGrid",
        purpose: "social-proof",
        narrativeRole: "brand-proof",
        visualWeight: "medium",
      },
      {
        id: "service-context",
        required: false,
        sectionType: "homepageTrust",
        defaultVariant: "cards",
        purpose: "brand-values",
        narrativeRole: "trust",
        visualWeight: "medium",
        omitWhen: "when-evidence-is-unavailable",
      },
      {
        id: "selected-products",
        required: true,
        sectionType: "homepageFeaturedProducts",
        defaultVariant: "editorial",
        purpose: "featured-products",
        narrativeRole: "primary-discovery",
        visualWeight: "heavy",
      },
      {
        id: "supporting-editorial",
        required: false,
        sectionType: "homepageEditorial",
        defaultVariant: "brandStory",
        purpose: "editorial-story",
        narrativeRole: "education",
        visualWeight: "medium",
        omitWhen: "when-evidence-is-unavailable",
      },
      continuation(),
    ],
  },
];

export const commercialHomepagePagePlans: readonly StorefrontTemplatePagePlan[] = deepFreeze(
  profileInputs.map(createProfile),
);

function profileDimensions(plan: StorefrontTemplatePagePlan) {
  const authority = plan.profile?.commercialHomepage;
  if (!authority) throw new Error("Commercial homepage profile authority is missing.");
  return [
    canonicalValueString(plan.slots.map((entry) => entry.narrativeRole)),
    canonicalValueString(
      plan.slots.map((entry) => ({ component: entry.sectionType, variant: entry.defaultVariant })),
    ),
    canonicalValueString(plan.slots.map((entry) => entry.required)),
    canonicalValueString(authority.compatibleSharedFrameProfileIds),
    authority.merchandisingEmphasis,
    authority.productCardAnatomyId,
    canonicalValueString(authority.responsiveArchitecture),
  ];
}

export function validateCommercialHomepageProfileLibrary(
  entries: readonly unknown[] = commercialHomepagePagePlans,
): readonly StorefrontTemplatePagePlan[] {
  const parsed = entries.map((entry) => storefrontTemplatePagePlanSchema.parse(entry));
  if (parsed.length < 6) throw new Error("At least six commercial homepage profiles are required.");
  const ids = parsed.map((entry) => entry.profile?.id);
  if (new Set(ids).size !== ids.length) throw new Error("Commercial homepage IDs must be unique.");
  const signatures = parsed.map((entry) => entry.profile?.commercialHomepage?.structuralSignature);
  if (signatures.some((entry) => !entry) || new Set(signatures).size !== signatures.length) {
    throw new Error("Commercial homepage profiles must have unique material structures.");
  }
  parsed.forEach((plan) => {
    const profile = plan.profile;
    const authority = profile?.commercialHomepage;
    if (!profile || !authority || profile.scope !== "home") {
      throw new Error("Commercial homepage profiles must extend executable homepage authority.");
    }
    authority.compatibleSharedFrameProfileIds.forEach(getCommercialSharedFrameProfile);
    const productCardAnatomy = requireCanonicalProductCardAnatomy(
      authority.productCardAnatomyId,
      "homepageMerchandising",
    );
    if (!canonicalProductCardAnatomyIdSchema.options.includes(authority.productCardAnatomyId)) {
      throw new Error(`Unknown product-card anatomy ${authority.productCardAnatomyId}.`);
    }
    const slots = new Map(plan.slots.map((entry) => [entry.id, entry]));
    authority.sectionCardinality.forEach((entry) => {
      const profileSlot = slots.get(entry.slotId);
      if (!profileSlot || entry.minimum !== (profileSlot.required ? 1 : 0) || entry.maximum !== 1) {
        throw new Error(`Commercial homepage cardinality is stale for ${entry.slotId}.`);
      }
    });
    authority.evidenceRequirements.forEach((entry) => {
      const profileSlot = slots.get(entry.slotId);
      if (!profileSlot || (entry.unsatisfiedPolicy === "omit" && profileSlot.required)) {
        throw new Error(`Commercial homepage evidence policy is invalid for ${entry.slotId}.`);
      }
    });
    authority.contentCardinality.forEach((entry) => {
      const profileSlot = slots.get(entry.slotId);
      const expectedComponents =
        entry.resource === "products"
          ? ["homepageFeaturedProducts"]
          : ["homepageFeaturedCollections", "homepageCollectionNavigation"];
      if (!profileSlot || !expectedComponents.includes(profileSlot.sectionType)) {
        throw new Error(
          `Commercial homepage ${entry.resource} cardinality is invalid for ${entry.slotId}.`,
        );
      }
    });
    const registeredResponsiveTransformations = new Map<string, Set<string>>();
    const registerResponsiveTransformations = (
      transformations: readonly Readonly<{ id: string; breakpoints: readonly string[] }>[],
    ) => {
      transformations.forEach((transformation) => {
        const breakpoints =
          registeredResponsiveTransformations.get(transformation.id) ?? new Set<string>();
        transformation.breakpoints.forEach((breakpoint) => breakpoints.add(breakpoint));
        registeredResponsiveTransformations.set(transformation.id, breakpoints);
      });
    };
    registerResponsiveTransformations(productCardAnatomy.responsiveTransformations);
    plan.slots.forEach((entry) => {
      const manifest = getSupportedSectionManifest(entry.sectionType);
      if (!manifest || !manifest.allowedPageTypes.includes("home")) {
        throw new Error(`Commercial homepage component ${entry.sectionType} is unavailable.`);
      }
      if (!manifest.variants.includes(entry.defaultVariant)) {
        throw new Error(`Commercial homepage variant ${entry.defaultVariant} is unavailable.`);
      }
      const componentDefinition =
        componentDefinitions[entry.sectionType as keyof typeof componentDefinitions];
      if (
        !componentDefinition.designCompatibility.allowedNarrativeRoles.includes(entry.narrativeRole)
      ) {
        throw new Error(
          `Commercial homepage narrative role ${entry.narrativeRole} is incompatible with ${entry.sectionType}.`,
        );
      }
      registerResponsiveTransformations(
        componentDefinition.commercialAnatomy?.responsiveTransformations ?? [],
      );
    });
    authority.responsiveArchitecture.forEach((breakpoint) => {
      breakpoint.transformationIds.forEach((transformationId) => {
        const supportedBreakpoints = registeredResponsiveTransformations.get(transformationId);
        if (!supportedBreakpoints) {
          throw new Error(
            `Commercial homepage responsive transformation ${transformationId} is unavailable.`,
          );
        }
        if (!supportedBreakpoints.has(breakpoint.breakpoint)) {
          throw new Error(
            `Commercial homepage responsive transformation ${transformationId} is not registered for ${breakpoint.breakpoint}.`,
          );
        }
      });
    });
    const structuralMaterial = {
      orderedNarrativeRoles: plan.slots.map((entry) => entry.narrativeRole),
      selections: plan.slots.map((entry) => ({
        slotId: entry.id,
        component: entry.sectionType,
        variant: entry.defaultVariant,
        required: entry.required,
        omitWhen: entry.omitWhen,
      })),
      compatibleSharedFrameProfileIds: [...authority.compatibleSharedFrameProfileIds],
      merchandisingEmphasis: authority.merchandisingEmphasis,
      productCardAnatomyId: authority.productCardAnatomyId,
      sectionCardinality: authority.sectionCardinality,
      contentCardinality: authority.contentCardinality,
      responsiveArchitecture: authority.responsiveArchitecture,
      designDnaNarrowing: authority.designDnaNarrowing,
    };
    if (
      authority.structuralSignature !==
        `homepage-structure-${canonicalValueFingerprint(structuralMaterial)}` ||
      authority.structuralFingerprint !==
        `homepage-profile-${canonicalValueFingerprint({
          id: profile.id,
          version: profile.version,
          structuralMaterial,
        })}`
    ) {
      throw new Error(`Commercial homepage profile ${profile.id} has stale structural authority.`);
    }
  });
  for (let left = 0; left < parsed.length; left += 1) {
    for (let right = left + 1; right < parsed.length; right += 1) {
      const leftDimensions = profileDimensions(parsed[left]);
      const rightDimensions = profileDimensions(parsed[right]);
      const materialDifferences = leftDimensions.filter(
        (dimension, index) => dimension !== rightDimensions[index],
      ).length;
      if (materialDifferences < 3) {
        throw new Error(
          `Commercial homepage profiles ${ids[left]} and ${ids[right]} are shallow near-duplicates.`,
        );
      }
    }
  }
  return deepFreeze(parsed.map((entry) => structuredClone(entry)));
}

const validatedProfiles = validateCommercialHomepageProfileLibrary();
const profilesById = new Map(
  validatedProfiles.map((entry) => [entry.profile!.id as CommercialHomepageProfileId, entry]),
);

export function listCommercialHomepageProfiles(): readonly StorefrontTemplatePagePlan[] {
  return deepFreeze(validatedProfiles.map((entry) => structuredClone(entry)));
}

export function getCommercialHomepageProfile(
  profileId: string,
): StorefrontTemplatePagePlan | undefined {
  const entry = profilesById.get(profileId as CommercialHomepageProfileId);
  return entry ? deepFreeze(structuredClone(entry)) : undefined;
}

export function resolveCommercialHomepageProfileSlots(
  profileId: string,
  evidence: Readonly<{
    canonicalCommerce: boolean;
    canonicalProductCount: number;
    canonicalCollectionCount: number;
    approvedMerchantEvidence: boolean;
    approvedMediaSlotIds: readonly string[];
  }>,
): Readonly<{ includedSlotIds: readonly string[]; omittedSlotIds: readonly string[] }> {
  const plan = getCommercialHomepageProfile(profileId);
  const authority = plan?.profile?.commercialHomepage;
  if (!plan || !authority) {
    throw new CommercialHomepageProfileError(
      "unknown-profile",
      `Commercial homepage profile ${profileId} is unavailable.`,
    );
  }
  const approvedMediaSlotIds = new Set(evidence.approvedMediaSlotIds);
  const isAvailable = (
    requirement: CommercialHomepageProfileAuthority["evidenceRequirements"][number],
  ) =>
    requirement.authority === "canonical-commerce"
      ? evidence.canonicalCommerce
      : requirement.authority === "approved-merchant-evidence"
        ? evidence.approvedMerchantEvidence
        : requirement.authority === "approved-media"
          ? approvedMediaSlotIds.has(requirement.slotId)
          : true;
  const includedSlotIds: string[] = [];
  const omittedSlotIds: string[] = [];
  for (const slot of plan.slots) {
    const requirements = authority.evidenceRequirements.filter(
      (requirement) => requirement.slotId === slot.id,
    );
    const unsatisfied = requirements.filter((requirement) => !isAvailable(requirement));
    if (unsatisfied.length === 0) {
      includedSlotIds.push(slot.id);
      continue;
    }
    if (!slot.required && unsatisfied.every((entry) => entry.unsatisfiedPolicy === "omit")) {
      omittedSlotIds.push(slot.id);
      continue;
    }
    throw new CommercialHomepageProfileError(
      "unsatisfied-required-evidence",
      `Commercial homepage slot ${slot.id} lacks required approved authority.`,
    );
  }
  for (const cardinality of authority.sectionCardinality) {
    const count = includedSlotIds.includes(cardinality.slotId) ? 1 : 0;
    if (count < cardinality.minimum || count > cardinality.maximum) {
      throw new CommercialHomepageProfileError(
        "invalid-cardinality",
        `Commercial homepage slot ${cardinality.slotId} violates registered cardinality.`,
      );
    }
  }
  for (const cardinality of authority.contentCardinality) {
    if (!includedSlotIds.includes(cardinality.slotId)) continue;
    const count =
      cardinality.resource === "products"
        ? evidence.canonicalProductCount
        : evidence.canonicalCollectionCount;
    if (count < cardinality.minimum) {
      throw new CommercialHomepageProfileError(
        "invalid-cardinality",
        `Commercial homepage slot ${cardinality.slotId} requires at least ${cardinality.minimum} ${cardinality.resource}.`,
      );
    }
  }
  return deepFreeze({ includedSlotIds, omittedSlotIds });
}

export function resolveCommercialHomepageSlotItemLimit(
  profileId: string,
  slotId: string,
  resource: "products" | "collections",
  availableCount: number,
): number {
  return resolveCommercialHomepageSlotItemCardinality(profileId, slotId, resource, availableCount)
    .maximum;
}

export function resolveCommercialHomepageSlotItemCardinality(
  profileId: string,
  slotId: string,
  resource: "products" | "collections",
  availableCount: number,
): Readonly<{ minimum: number; maximum: number }> {
  const plan = getCommercialHomepageProfile(profileId);
  const authority = plan?.profile?.commercialHomepage;
  if (!authority) {
    throw new CommercialHomepageProfileError(
      "unknown-profile",
      `Commercial homepage profile ${profileId} is unavailable.`,
    );
  }
  const cardinality = authority.contentCardinality.find(
    (entry) => entry.slotId === slotId && entry.resource === resource,
  );
  if (!cardinality) return { minimum: 0, maximum: availableCount };
  if (availableCount < cardinality.minimum) {
    throw new CommercialHomepageProfileError(
      "invalid-cardinality",
      `Commercial homepage slot ${slotId} requires at least ${cardinality.minimum} ${resource}.`,
    );
  }
  return {
    minimum: cardinality.minimum,
    maximum: Math.min(availableCount, cardinality.maximum),
  };
}
