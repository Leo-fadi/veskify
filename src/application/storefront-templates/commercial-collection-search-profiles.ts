import { z } from "zod";
import { dynamicCollectionCommerceDefinition } from "@/components/registry/dynamic-collection-commerce";
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
  type CommercialCollectionSearchProfileAuthority,
  type StorefrontTemplatePagePlan,
  type StorefrontTemplateSlot,
} from "./contract";

export const COMMERCIAL_COLLECTION_SEARCH_PROFILE_VERSION = "1.0.0" as const;

export const commercialCollectionSearchProfileIds = [
  "collection-editorial-discovery",
  "collection-catalogue-comparison",
  "collection-campaign-led-discovery",
  "collection-dense-search",
] as const;
export const commercialCollectionSearchProfileIdSchema = z.enum(
  commercialCollectionSearchProfileIds,
);

export type CommercialCollectionSearchProfileId =
  (typeof commercialCollectionSearchProfileIds)[number];

export class CommercialCollectionSearchProfileError extends Error {
  constructor(
    readonly code: "unknown-profile" | "unsatisfied-required-evidence",
    message: string,
  ) {
    super(message);
    this.name = "CommercialCollectionSearchProfileError";
  }
}

type ProfileInput = Readonly<{
  id: CommercialCollectionSearchProfileId;
  variant: "editorialDiscovery" | "catalogueComparison" | "campaignLedDiscovery" | "denseSearch";
  narrativeRole: StorefrontTemplateSlot["narrativeRole"];
  compatibleSharedFrameProfileIds: CommercialCollectionSearchProfileAuthority["compatibleSharedFrameProfileIds"];
  defaultSharedFrameProfileId: CommercialCollectionSearchProfileAuthority["defaultSharedFrameProfileId"];
  presentationMode: CommercialCollectionSearchProfileAuthority["presentationMode"];
  productCardAnatomyId: CommercialCollectionSearchProfileAuthority["productCardAnatomyId"];
  gridDensity: CommercialCollectionSearchProfileAuthority["gridDensity"];
  filterLayout: CommercialCollectionSearchProfileAuthority["filterLayout"];
  childCollectionTreatment: CommercialCollectionSearchProfileAuthority["childCollectionTreatment"];
  resultsTreatment: CommercialCollectionSearchProfileAuthority["resultsTreatment"];
  campaignEvidencePolicy: CommercialCollectionSearchProfileAuthority["campaignEvidencePolicy"];
  responsiveTransformationIds: readonly string[];
  designDnaNarrowing: CommercialCollectionSearchProfileAuthority["designDnaNarrowing"];
}>;

const breakpoints = [
  { breakpoint: "mobile" as const, viewport: 375 as const },
  { breakpoint: "tablet" as const, viewport: 768 as const },
  { breakpoint: "desktop" as const, viewport: 1024 as const },
  { breakpoint: "wide" as const, viewport: 1440 as const },
] as const;

const collectionComposition = pageBlueprintCompositionContractSchema.parse({
  allowedNarrativeRoles: ["orientation", "primary-discovery", "secondary-discovery", "campaign"],
  requiredNarrativeRoles: [],
  flowRuleIds: [],
  maxRepeatedRole: 1,
  maxRepeatedComponentFamily: 1,
  boundedParameterConstraints: [],
  responsiveParameterIds: ["responsiveCollapse", "filterPlacement", "density"],
});

function collectionSlot(input: ProfileInput): StorefrontTemplateSlot {
  const variants = dynamicCollectionCommerceDefinition.variants.map(({ id }) => id);
  return {
    id: "collection-commerce",
    required: true,
    sectionType: "dynamicCollectionCommerce",
    allowedVariants: variants,
    defaultVariant: input.variant,
    label: { en: "collection commerce", fi: "malliston kauppa" },
    purpose: "filtering-or-merchandising",
    narrativeRole: input.narrativeRole,
    visualWeight: input.presentationMode === "campaign-led-discovery" ? "dominant" : "heavy",
    boundedParameterConstraints: [],
    omitWhen: "never",
  };
}

function responsiveArchitecture(ids: readonly string[], productCardAnatomyId: string) {
  const registered = new Map<string, Set<string>>();
  const add = (
    transformations: readonly Readonly<{ id: string; breakpoints: readonly string[] }>[],
  ) =>
    transformations.forEach((transformation) => {
      const values = registered.get(transformation.id) ?? new Set<string>();
      transformation.breakpoints.forEach((breakpoint) => values.add(breakpoint));
      registered.set(transformation.id, values);
    });
  add(dynamicCollectionCommerceDefinition.commercialAnatomy!.responsiveTransformations);
  add(
    requireCanonicalProductCardAnatomy(productCardAnatomyId, "collectionResults")
      .responsiveTransformations,
  );
  [...new Set(ids)].forEach((id) => {
    if (!registered.has(id))
      throw new Error(`Collection/search responsive transformation ${id} is unavailable.`);
  });
  return breakpoints.map(({ breakpoint, viewport }) => ({
    breakpoint,
    viewport,
    transformationIds: [...new Set(ids)].filter((id) => registered.get(id)?.has(breakpoint)),
  })) as CommercialCollectionSearchProfileAuthority["responsiveArchitecture"];
}

function createProfile(input: ProfileInput): StorefrontTemplatePagePlan {
  const slot = collectionSlot(input);
  const structuralMaterial = {
    component: slot.sectionType,
    variant: slot.defaultVariant,
    narrativeRole: slot.narrativeRole,
    compatibleSharedFrameProfileIds: [...input.compatibleSharedFrameProfileIds],
    presentationMode: input.presentationMode,
    productCardAnatomyId: input.productCardAnatomyId,
    gridDensity: input.gridDensity,
    filterLayout: input.filterLayout,
    childCollectionTreatment: input.childCollectionTreatment,
    resultsTreatment: input.resultsTreatment,
    campaignEvidencePolicy: input.campaignEvidencePolicy,
    responsiveArchitecture: responsiveArchitecture(
      input.responsiveTransformationIds,
      input.productCardAnatomyId,
    ),
    designDnaNarrowing: input.designDnaNarrowing,
  };
  const authority: CommercialCollectionSearchProfileAuthority = {
    family: "commercial-collection-search",
    compatibleSharedFrameProfileIds: [...input.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: input.defaultSharedFrameProfileId,
    presentationMode: input.presentationMode,
    productCardAnatomyId: input.productCardAnatomyId,
    gridDensity: input.gridDensity,
    filterLayout: input.filterLayout,
    childCollectionTreatment: input.childCollectionTreatment,
    resultsTreatment: input.resultsTreatment,
    campaignEvidencePolicy: input.campaignEvidencePolicy,
    responsiveArchitecture: responsiveArchitecture(
      input.responsiveTransformationIds,
      input.productCardAnatomyId,
    ),
    designDnaNarrowing: structuredClone(input.designDnaNarrowing),
    structuralSignature: `collection-search-structure-${canonicalValueFingerprint(structuralMaterial)}`,
    structuralFingerprint: `collection-search-profile-${canonicalValueFingerprint({
      id: input.id,
      version: COMMERCIAL_COLLECTION_SEARCH_PROFILE_VERSION,
      structuralMaterial,
    })}`,
  };
  return storefrontTemplatePagePlanSchema.parse({
    pageType: "collection",
    slots: [slot],
    pageBlueprint: collectionComposition,
    profile: executablePageBlueprintProfileSchema.parse({
      id: input.id,
      version: COMMERCIAL_COLLECTION_SEARCH_PROFILE_VERSION,
      scope: "collection",
      orderedNarrativeRoles: [slot.narrativeRole],
      roleCardinality: [{ role: slot.narrativeRole, minimum: 1, maximum: 1 }],
      componentSelections: [
        {
          slotId: slot.id,
          component: slot.sectionType,
          variants: [...slot.allowedVariants],
          defaultVariant: slot.defaultVariant,
        },
      ],
      parameterDefaults: {},
      requiredBindingCategories: ["collection", "productList"],
      requiredAssetRoles:
        input.campaignEvidencePolicy === "approved-editorial-media-required"
          ? ["editorialImage"]
          : [],
      responsiveBreakpoints: ["mobile", "tablet", "desktop", "wide"],
      accessibilityContract: "registered-component-contracts",
      commercialCollectionSearch: authority,
    }),
  });
}

const profileInputs: readonly ProfileInput[] = [
  {
    id: "collection-editorial-discovery",
    variant: "editorialDiscovery",
    narrativeRole: "orientation",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "centered-minimal"],
    defaultSharedFrameProfileId: "editorial-masthead",
    presentationMode: "editorial-discovery",
    productCardAnatomyId: "editorial",
    gridDensity: "spacious",
    filterLayout: "horizontal",
    childCollectionTreatment: "editorial-discovery",
    resultsTreatment: "curated",
    campaignEvidencePolicy: "not-required",
    responsiveTransformationIds: [
      "editorialCollectionStack",
      "collectionFilterDisclosure",
      "editorialStack",
    ],
    designDnaNarrowing: {
      spacingDensity: ["standard", "spacious"],
      surfaceDepth: ["subtle", "layered"],
      imagePosture: ["editorial", "immersive"],
    },
  },
  {
    id: "collection-catalogue-comparison",
    variant: "catalogueComparison",
    narrativeRole: "primary-discovery",
    compatibleSharedFrameProfileIds: ["commerce-utility", "compact-technical"],
    defaultSharedFrameProfileId: "commerce-utility",
    presentationMode: "catalogue-comparison",
    productCardAnatomyId: "compact",
    gridDensity: "standard",
    filterLayout: "sidebar",
    childCollectionTreatment: "navigation",
    resultsTreatment: "comparison",
    campaignEvidencePolicy: "not-required",
    responsiveTransformationIds: [
      "comparisonFilterDisclosure",
      "comparisonGridReflow",
      "compactSimplify",
    ],
    designDnaNarrowing: {
      spacingDensity: ["compact", "standard"],
      surfaceDepth: ["flat", "subtle"],
      imagePosture: ["contained"],
    },
  },
  {
    id: "collection-campaign-led-discovery",
    variant: "campaignLedDiscovery",
    narrativeRole: "campaign",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "centered-minimal"],
    defaultSharedFrameProfileId: "editorial-masthead",
    presentationMode: "campaign-led-discovery",
    productCardAnatomyId: "imageFirst",
    gridDensity: "spacious",
    filterLayout: "horizontal",
    childCollectionTreatment: "editorial-discovery",
    resultsTreatment: "campaign-transition",
    campaignEvidencePolicy: "approved-editorial-media-required",
    responsiveTransformationIds: [
      "campaignLeadStack",
      "campaignFilterDisclosure",
      "imageFirstReorder",
    ],
    designDnaNarrowing: {
      spacingDensity: ["standard", "spacious"],
      surfaceDepth: ["subtle", "layered"],
      imagePosture: ["editorial", "immersive"],
    },
  },
  {
    id: "collection-dense-search",
    variant: "denseSearch",
    narrativeRole: "secondary-discovery",
    compatibleSharedFrameProfileIds: ["commerce-utility", "compact-technical", "centered-minimal"],
    defaultSharedFrameProfileId: "compact-technical",
    presentationMode: "dense-search",
    productCardAnatomyId: "compact",
    gridDensity: "compact",
    filterLayout: "horizontal",
    childCollectionTreatment: "compact",
    resultsTreatment: "dense-scan",
    campaignEvidencePolicy: "not-required",
    responsiveTransformationIds: ["denseFilterDisclosure", "denseGridReflow", "compactSimplify"],
    designDnaNarrowing: {
      spacingDensity: ["compact", "standard"],
      surfaceDepth: ["flat", "subtle"],
      imagePosture: ["contained", "editorial"],
    },
  },
];

export const commercialCollectionSearchPagePlans: readonly StorefrontTemplatePagePlan[] =
  deepFreeze(profileInputs.map(createProfile));

function expectedStructuralMaterial(plan: StorefrontTemplatePagePlan) {
  const authority = plan.profile?.commercialCollectionSearch;
  const slot = plan.slots[0];
  if (!authority || !slot)
    throw new Error("Commercial collection/search profile authority is missing.");
  return {
    component: slot.sectionType,
    variant: slot.defaultVariant,
    narrativeRole: slot.narrativeRole,
    compatibleSharedFrameProfileIds: authority.compatibleSharedFrameProfileIds,
    presentationMode: authority.presentationMode,
    productCardAnatomyId: authority.productCardAnatomyId,
    gridDensity: authority.gridDensity,
    filterLayout: authority.filterLayout,
    childCollectionTreatment: authority.childCollectionTreatment,
    resultsTreatment: authority.resultsTreatment,
    campaignEvidencePolicy: authority.campaignEvidencePolicy,
    responsiveArchitecture: authority.responsiveArchitecture,
    designDnaNarrowing: authority.designDnaNarrowing,
  };
}

export function validateCommercialCollectionSearchProfileLibrary(
  entries: readonly unknown[] = commercialCollectionSearchPagePlans,
): readonly StorefrontTemplatePagePlan[] {
  const parsed = entries.map((entry) => storefrontTemplatePagePlanSchema.parse(entry));
  if (parsed.length < 4)
    throw new Error("At least four commercial collection/search profiles are required.");
  const ids = parsed.map((entry) => entry.profile?.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Commercial collection/search IDs must be unique.");
  const signatures = parsed.map(
    (entry) => entry.profile?.commercialCollectionSearch?.structuralSignature,
  );
  if (signatures.some((entry) => !entry) || new Set(signatures).size !== signatures.length) {
    throw new Error("Commercial collection/search profiles must have unique material structures.");
  }
  parsed.forEach((plan) => {
    const profile = plan.profile;
    const authority = profile?.commercialCollectionSearch;
    if (!profile || !authority || profile.scope !== "collection" || plan.slots.length !== 1) {
      throw new Error(
        "Commercial collection/search profiles must extend collection PageBlueprint authority.",
      );
    }
    authority.compatibleSharedFrameProfileIds.forEach(getCommercialSharedFrameProfile);
    if (!canonicalProductCardAnatomyIdSchema.options.includes(authority.productCardAnatomyId)) {
      throw new Error(`Unknown product-card anatomy ${authority.productCardAnatomyId}.`);
    }
    requireCanonicalProductCardAnatomy(authority.productCardAnatomyId, "collectionResults");
    const slot = plan.slots[0];
    if (
      !dynamicCollectionCommerceDefinition.variants.some(
        (entry) => entry.id === slot.defaultVariant,
      )
    ) {
      throw new Error(
        "Commercial collection/search profiles must select a registered component variant.",
      );
    }
    const variant = dynamicCollectionCommerceDefinition.commercialAnatomy?.variants.find(
      (entry) => entry.variantId === slot.defaultVariant,
    );
    if (variant?.classification !== "meaningfulStructuralVariant") {
      throw new Error(
        "Commercial collection/search profiles require meaningful collection component variants.",
      );
    }
    const registered = new Map(
      dynamicCollectionCommerceDefinition.commercialAnatomy!.responsiveTransformations.map(
        (entry) => [entry.id, new Set(entry.breakpoints)],
      ),
    );
    requireCanonicalProductCardAnatomy(
      authority.productCardAnatomyId,
      "collectionResults",
    ).responsiveTransformations.forEach((entry) => {
      const current =
        registered.get(entry.id) ?? new Set<"mobile" | "tablet" | "desktop" | "wide">();
      entry.breakpoints.forEach((breakpoint) => current.add(breakpoint));
      registered.set(entry.id, current);
    });
    authority.responsiveArchitecture.forEach((entry) =>
      entry.transformationIds.forEach((id) => {
        if (!registered.get(id)?.has(entry.breakpoint)) {
          throw new Error(
            `Collection/search responsive transformation ${id} is not registered for ${entry.breakpoint}.`,
          );
        }
      }),
    );
    const expectedSignature = `collection-search-structure-${canonicalValueFingerprint(
      expectedStructuralMaterial(plan),
    )}`;
    if (authority.structuralSignature !== expectedSignature) {
      throw new Error("Commercial collection/search profile has stale structural authority.");
    }
  });
  const dimensions = parsed.map((plan) => {
    const authority = plan.profile!.commercialCollectionSearch!;
    return [
      plan.slots[0].defaultVariant,
      authority.productCardAnatomyId,
      authority.filterLayout,
      authority.gridDensity,
      authority.childCollectionTreatment,
      authority.resultsTreatment,
      canonicalValueString(authority.responsiveArchitecture),
    ];
  });
  dimensions.forEach((left, index) =>
    dimensions.slice(index + 1).forEach((right) => {
      const materialDifferences = left.filter((value, position) => value !== right[position]);
      if (materialDifferences.length < 3) {
        throw new Error("Commercial collection/search profiles are shallow near-duplicates.");
      }
    }),
  );
  return deepFreeze(parsed.map((entry) => structuredClone(entry)));
}

const validatedProfiles = validateCommercialCollectionSearchProfileLibrary();
const profilesById = new Map(
  validatedProfiles.map((entry) => [
    entry.profile!.id as CommercialCollectionSearchProfileId,
    entry,
  ]),
);

export function listCommercialCollectionSearchProfiles(): readonly StorefrontTemplatePagePlan[] {
  return deepFreeze(validatedProfiles.map((entry) => structuredClone(entry)));
}

export function getCommercialCollectionSearchProfile(
  profileId: string,
): StorefrontTemplatePagePlan | undefined {
  const entry = profilesById.get(profileId as CommercialCollectionSearchProfileId);
  return entry ? deepFreeze(structuredClone(entry)) : undefined;
}
