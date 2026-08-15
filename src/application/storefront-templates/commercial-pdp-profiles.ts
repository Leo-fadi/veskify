import { dynamicProductDetailDefinition } from "@/components/registry/dynamic-product-detail";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { getCommercialSharedFrameProfile } from "@/domain/storefront/commercial-shared-frame";
import { requireCanonicalProductCardAnatomy } from "@/domain/product-card";
import { z } from "zod";
import {
  deepFreeze,
  executablePageBlueprintProfileSchema,
  pageBlueprintCompositionContractSchema,
  storefrontTemplatePagePlanSchema,
  type CommercialProductDetailProfileAuthority,
  type ExecutablePageBlueprintProfile,
  type StorefrontTemplatePagePlan,
  type StorefrontTemplateSlot,
} from "./contract";

export const COMMERCIAL_PDP_PROFILE_VERSION = "1.0.0" as const;

export const commercialPdpProfileIds = [
  "pdp-standard-commerce",
  "pdp-high-consideration",
  "pdp-gallery-led",
  "pdp-variant-led",
] as const;
export const commercialPdpProfileIdSchema = z.enum(commercialPdpProfileIds);
export type CommercialPdpProfileId = (typeof commercialPdpProfileIds)[number];

export class CommercialPdpProfileError extends Error {
  constructor(
    readonly code: "unknown-profile" | "unsatisfied-required-evidence" | "invalid-configuration",
    message: string,
  ) {
    super(message);
    this.name = "CommercialPdpProfileError";
  }
}

type CommercialPdpProfileInput = Readonly<{
  id: CommercialPdpProfileId;
  compatibleSharedFrameProfileIds: CommercialProductDetailProfileAuthority["compatibleSharedFrameProfileIds"];
  defaultSharedFrameProfileId: CommercialProductDetailProfileAuthority["defaultSharedFrameProfileId"];
  presentation: CommercialProductDetailProfileAuthority["presentation"];
  dynamicProductDetailVariant: CommercialProductDetailProfileAuthority["dynamicProductDetailVariant"];
  dynamicProductDetailProps: CommercialProductDetailProfileAuthority["dynamicProductDetailProps"];
  relatedProductCardAnatomyId: CommercialProductDetailProfileAuthority["relatedProductCardAnatomyId"];
  evidenceRequirements: CommercialProductDetailProfileAuthority["evidenceRequirements"];
  responsiveTransformationIds: readonly string[];
  designDnaNarrowing: CommercialProductDetailProfileAuthority["designDnaNarrowing"];
}>;

const productCompositionContract = pageBlueprintCompositionContractSchema.parse({
  allowedNarrativeRoles: ["product-focus", "product-proof", "conversion", "continuation"],
  requiredNarrativeRoles: ["product-focus"],
  flowRuleIds: [],
  maxRepeatedRole: 2,
  maxRepeatedComponentFamily: 1,
  boundedParameterConstraints: [],
  responsiveParameterIds: ["responsiveCollapse"],
});

const commercialPdpResponsiveBreakpoints = [
  { breakpoint: "mobile" as const, viewport: 375 as const },
  { breakpoint: "tablet" as const, viewport: 768 as const },
  { breakpoint: "desktop" as const, viewport: 1024 as const },
  { breakpoint: "wide" as const, viewport: 1440 as const },
] as const;

function productDetailSlot(
  variant: CommercialPdpProfileInput["dynamicProductDetailVariant"],
): StorefrontTemplateSlot {
  return {
    id: "dynamic-product-detail",
    required: true,
    sectionType: "dynamicProductDetail",
    allowedVariants: dynamicProductDetailDefinition.variants.map(({ id }) => id),
    defaultVariant: variant,
    label: { en: "Dynamic product detail", fi: "Dynaaminen tuotesivu" },
    purpose: "product-information",
    narrativeRole: "product-focus",
    visualWeight: "dominant",
    boundedParameterConstraints: [],
    omitWhen: "never",
  };
}

function responsiveArchitecture(
  transformationIds: readonly string[],
): CommercialProductDetailProfileAuthority["responsiveArchitecture"] {
  const transformations = new Map(
    (dynamicProductDetailDefinition.commercialAnatomy?.responsiveTransformations ?? []).map(
      (transformation) => [transformation.id, new Set(transformation.breakpoints)],
    ),
  );
  const unique = [...new Set(transformationIds)];
  unique.forEach((transformationId) => {
    if (!transformations.has(transformationId)) {
      throw new Error(
        `Commercial PDP responsive transformation ${transformationId} is unavailable.`,
      );
    }
  });
  return commercialPdpResponsiveBreakpoints.map(({ breakpoint, viewport }) => ({
    breakpoint,
    viewport,
    transformationIds: unique.filter((transformationId) =>
      transformations.get(transformationId)?.has(breakpoint),
    ),
  })) as CommercialProductDetailProfileAuthority["responsiveArchitecture"];
}

function createProfile(input: CommercialPdpProfileInput): StorefrontTemplatePagePlan {
  const slots = [productDetailSlot(input.dynamicProductDetailVariant)];
  const responsive = responsiveArchitecture(input.responsiveTransformationIds);
  const structuralMaterial = {
    orderedNarrativeRoles: slots.map((entry) => entry.narrativeRole),
    selections: slots.map((entry) => ({
      slotId: entry.id,
      component: entry.sectionType,
      variant: entry.defaultVariant,
      required: entry.required,
    })),
    compatibleSharedFrameProfileIds: [...input.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: input.defaultSharedFrameProfileId,
    presentation: input.presentation,
    dynamicProductDetailVariant: input.dynamicProductDetailVariant,
    dynamicProductDetailProps: input.dynamicProductDetailProps,
    relatedProductCardAnatomyId: input.relatedProductCardAnatomyId,
    evidenceRequirements: input.evidenceRequirements,
    responsiveArchitecture: responsive,
    designDnaNarrowing: input.designDnaNarrowing,
  };
  const authority: CommercialProductDetailProfileAuthority = {
    family: "commercial-product-detail",
    compatibleSharedFrameProfileIds: [...input.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: input.defaultSharedFrameProfileId,
    presentation: input.presentation,
    dynamicProductDetailVariant: input.dynamicProductDetailVariant,
    dynamicProductDetailProps: structuredClone(input.dynamicProductDetailProps),
    relatedProductCardAnatomyId: input.relatedProductCardAnatomyId,
    evidenceRequirements: input.evidenceRequirements.map((entry) => ({ ...entry })),
    responsiveArchitecture: responsive,
    designDnaNarrowing: structuredClone(input.designDnaNarrowing),
    structuralSignature: `pdp-structure-${canonicalValueFingerprint(structuralMaterial)}`,
    structuralFingerprint: `pdp-profile-${canonicalValueFingerprint({
      id: input.id,
      version: COMMERCIAL_PDP_PROFILE_VERSION,
      structuralMaterial,
    })}`,
  };
  const profile: ExecutablePageBlueprintProfile = executablePageBlueprintProfileSchema.parse({
    id: input.id,
    version: COMMERCIAL_PDP_PROFILE_VERSION,
    scope: "product",
    orderedNarrativeRoles: slots.map((entry) => entry.narrativeRole),
    roleCardinality: [{ role: "product-focus", minimum: 1, maximum: 1 }],
    componentSelections: slots.map((entry) => ({
      slotId: entry.id,
      component: entry.sectionType,
      variants: [...entry.allowedVariants],
      defaultVariant: entry.defaultVariant,
    })),
    parameterDefaults: {},
    requiredBindingCategories: ["product"],
    requiredAssetRoles: [],
    responsiveBreakpoints: ["mobile", "tablet", "desktop", "wide"],
    accessibilityContract: "registered-component-contracts",
    commercialProductDetail: authority,
  });
  return storefrontTemplatePagePlanSchema.parse({
    pageType: "product",
    slots,
    pageBlueprint: productCompositionContract,
    profile,
  });
}

const profileInputs: readonly CommercialPdpProfileInput[] = [
  {
    id: "pdp-standard-commerce",
    // The generic PDP fallback is storefront-global safety authority. It uses the
    // same frame-agnostic dynamic renderer as the exact PDP archetypes and must
    // remain renderable inside every registered complete-storefront frame.
    compatibleSharedFrameProfileIds: [
      "commerce-utility",
      "centered-minimal",
      "editorial-masthead",
      "compact-technical",
    ],
    defaultSharedFrameProfileId: "commerce-utility",
    presentation: "standard-commerce",
    dynamicProductDetailVariant: "balanced",
    dynamicProductDetailProps: {
      galleryLayout: "thumbnails",
      optionDensity: "comfortable",
      attributeLayout: "groups",
      showDescription: true,
      showSku: true,
      stickyMobileAction: true,
      mediaTreatment: "contained",
    },
    relatedProductCardAnatomyId: "standard",
    evidenceRequirements: [
      { region: "product", authority: "canonical-commerce", unsatisfiedPolicy: "fail-closed" },
    ],
    responsiveTransformationIds: ["pdpStandardStack"],
    designDnaNarrowing: {
      spacingDensity: ["compact", "standard", "spacious"],
      surfaceDepth: ["flat", "subtle", "layered"],
      imagePosture: ["contained", "editorial"],
    },
  },
  {
    id: "pdp-high-consideration",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "centered-minimal"],
    defaultSharedFrameProfileId: "editorial-masthead",
    presentation: "high-consideration",
    dynamicProductDetailVariant: "editorialSplit",
    dynamicProductDetailProps: {
      galleryLayout: "grid",
      optionDensity: "comfortable",
      attributeLayout: "table",
      showDescription: true,
      showSku: true,
      stickyMobileAction: false,
      mediaTreatment: "editorial",
    },
    relatedProductCardAnatomyId: "editorial",
    evidenceRequirements: [
      { region: "product", authority: "canonical-commerce", unsatisfiedPolicy: "fail-closed" },
      { region: "supporting", authority: "approved-merchant-evidence", unsatisfiedPolicy: "omit" },
      { region: "proof", authority: "approved-merchant-evidence", unsatisfiedPolicy: "omit" },
      { region: "service", authority: "approved-merchant-evidence", unsatisfiedPolicy: "omit" },
    ],
    responsiveTransformationIds: ["pdpHighConsiderationReflow"],
    designDnaNarrowing: {
      spacingDensity: ["standard", "spacious"],
      surfaceDepth: ["subtle", "layered"],
      imagePosture: ["editorial", "immersive"],
    },
  },
  {
    id: "pdp-gallery-led",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "commerce-utility"],
    defaultSharedFrameProfileId: "editorial-masthead",
    presentation: "gallery-led",
    dynamicProductDetailVariant: "galleryDominant",
    dynamicProductDetailProps: {
      galleryLayout: "grid",
      optionDensity: "comfortable",
      attributeLayout: "groups",
      showDescription: true,
      showSku: true,
      stickyMobileAction: true,
      mediaTreatment: "editorial",
    },
    relatedProductCardAnatomyId: "imageFirst",
    evidenceRequirements: [
      { region: "product", authority: "canonical-commerce", unsatisfiedPolicy: "fail-closed" },
      { region: "related-products", authority: "canonical-commerce", unsatisfiedPolicy: "omit" },
    ],
    responsiveTransformationIds: ["pdpGalleryLedContain"],
    designDnaNarrowing: {
      spacingDensity: ["standard", "spacious"],
      surfaceDepth: ["subtle", "layered"],
      imagePosture: ["editorial", "immersive"],
    },
  },
  {
    id: "pdp-variant-led",
    compatibleSharedFrameProfileIds: ["commerce-utility", "compact-technical"],
    defaultSharedFrameProfileId: "compact-technical",
    presentation: "variant-led",
    dynamicProductDetailVariant: "compact",
    dynamicProductDetailProps: {
      galleryLayout: "thumbnails",
      optionDensity: "compact",
      attributeLayout: "groups",
      showDescription: false,
      showSku: true,
      stickyMobileAction: true,
      mediaTreatment: "contained",
    },
    relatedProductCardAnatomyId: "horizontal",
    evidenceRequirements: [
      { region: "product", authority: "canonical-commerce", unsatisfiedPolicy: "fail-closed" },
    ],
    responsiveTransformationIds: ["pdpVariantLedFocus"],
    designDnaNarrowing: {
      spacingDensity: ["compact", "standard"],
      surfaceDepth: ["flat", "subtle"],
      imagePosture: ["contained", "editorial"],
    },
  },
];

export const commercialPdpPagePlans: readonly StorefrontTemplatePagePlan[] = deepFreeze(
  profileInputs.map(createProfile),
);

function profileDimensions(plan: StorefrontTemplatePagePlan) {
  const authority = plan.profile?.commercialProductDetail;
  if (!authority) throw new Error("Commercial PDP profile authority is missing.");
  return [
    authority.presentation,
    authority.dynamicProductDetailVariant,
    canonicalValueString(authority.dynamicProductDetailProps),
    canonicalValueString(authority.compatibleSharedFrameProfileIds),
    authority.relatedProductCardAnatomyId,
    canonicalValueString(authority.evidenceRequirements),
    canonicalValueString(authority.responsiveArchitecture),
  ];
}

export function validateCommercialPdpProfileLibrary(
  entries: readonly unknown[] = commercialPdpPagePlans,
): readonly StorefrontTemplatePagePlan[] {
  const parsed = entries.map((entry) => storefrontTemplatePagePlanSchema.parse(entry));
  if (parsed.length < 4) throw new Error("At least four commercial PDP profiles are required.");
  const ids = parsed.map((entry) => entry.profile?.id);
  if (new Set(ids).size !== ids.length) throw new Error("Commercial PDP IDs must be unique.");
  const signatures = parsed.map(
    (entry) => entry.profile?.commercialProductDetail?.structuralSignature,
  );
  if (signatures.some((entry) => !entry) || new Set(signatures).size !== signatures.length) {
    throw new Error("Commercial PDP profiles must have unique material structures.");
  }
  const anatomy = dynamicProductDetailDefinition.commercialAnatomy;
  if (!anatomy) throw new Error("Dynamic PDP commercial anatomy is unavailable.");
  parsed.forEach((plan) => {
    const profile = plan.profile;
    const authority = profile?.commercialProductDetail;
    if (!profile || !authority || profile.scope !== "product") {
      throw new Error("Commercial PDP profiles must extend executable product authority.");
    }
    authority.compatibleSharedFrameProfileIds.forEach(getCommercialSharedFrameProfile);
    requireCanonicalProductCardAnatomy(authority.relatedProductCardAnatomyId, "relatedProducts");
    const dynamicSlot = plan.slots.find((slot) => slot.sectionType === "dynamicProductDetail");
    if (!dynamicSlot || dynamicSlot.defaultVariant !== authority.dynamicProductDetailVariant) {
      throw new Error(
        `Commercial PDP ${profile.id} does not select its canonical dynamic PDP variant.`,
      );
    }
    const variant = anatomy.variants.find(
      (entry) => entry.variantId === authority.dynamicProductDetailVariant,
    );
    if (variant?.classification !== "meaningfulStructuralVariant") {
      throw new Error(`Commercial PDP ${profile.id} requires a meaningful dynamic PDP variant.`);
    }
    authority.responsiveArchitecture.forEach((breakpoint) => {
      breakpoint.transformationIds.forEach((transformationId) => {
        const transformation = anatomy.responsiveTransformations.find(
          (entry) => entry.id === transformationId,
        );
        if (!transformation) {
          throw new Error(
            `Commercial PDP responsive transformation ${transformationId} is unavailable.`,
          );
        }
        if (!transformation.breakpoints.includes(breakpoint.breakpoint)) {
          throw new Error(
            `Commercial PDP responsive transformation ${transformationId} is not registered for ${breakpoint.breakpoint}.`,
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
      })),
      compatibleSharedFrameProfileIds: [...authority.compatibleSharedFrameProfileIds],
      defaultSharedFrameProfileId: authority.defaultSharedFrameProfileId,
      presentation: authority.presentation,
      dynamicProductDetailVariant: authority.dynamicProductDetailVariant,
      dynamicProductDetailProps: authority.dynamicProductDetailProps,
      relatedProductCardAnatomyId: authority.relatedProductCardAnatomyId,
      evidenceRequirements: authority.evidenceRequirements,
      responsiveArchitecture: authority.responsiveArchitecture,
      designDnaNarrowing: authority.designDnaNarrowing,
    };
    if (
      authority.structuralSignature !==
        `pdp-structure-${canonicalValueFingerprint(structuralMaterial)}` ||
      authority.structuralFingerprint !==
        `pdp-profile-${canonicalValueFingerprint({
          id: profile.id,
          version: profile.version,
          structuralMaterial,
        })}`
    ) {
      throw new Error(`Commercial PDP profile ${profile.id} has stale structural authority.`);
    }
  });
  for (let left = 0; left < parsed.length; left += 1) {
    for (let right = left + 1; right < parsed.length; right += 1) {
      const materialDifferences = profileDimensions(parsed[left]).filter(
        (dimension, index) => dimension !== profileDimensions(parsed[right])[index],
      ).length;
      if (materialDifferences < 3) {
        throw new Error(
          `Commercial PDP profiles ${ids[left]} and ${ids[right]} are shallow near-duplicates.`,
        );
      }
    }
  }
  return deepFreeze(parsed.map((entry) => structuredClone(entry)));
}

const validatedProfiles = validateCommercialPdpProfileLibrary();
const profilesById = new Map(
  validatedProfiles.map((entry) => [entry.profile!.id as CommercialPdpProfileId, entry]),
);

export function listCommercialPdpProfiles(): readonly StorefrontTemplatePagePlan[] {
  return deepFreeze(validatedProfiles.map((entry) => structuredClone(entry)));
}

export function getCommercialPdpProfile(profileId: string): StorefrontTemplatePagePlan | undefined {
  const entry = profilesById.get(profileId as CommercialPdpProfileId);
  return entry ? deepFreeze(structuredClone(entry)) : undefined;
}

export function assertCommercialPdpEvidence(
  profileId: string,
  evidence: Readonly<{ canonicalCommerce: boolean; approvedMerchantEvidence: boolean }>,
): void {
  const authority = getCommercialPdpProfile(profileId)?.profile?.commercialProductDetail;
  if (!authority) {
    throw new CommercialPdpProfileError(
      "unknown-profile",
      `Commercial PDP profile ${profileId} is unavailable.`,
    );
  }
  authority.evidenceRequirements.forEach((requirement) => {
    const available =
      requirement.authority === "canonical-commerce"
        ? evidence.canonicalCommerce
        : requirement.authority === "approved-merchant-evidence"
          ? evidence.approvedMerchantEvidence
          : true;
    if (!available && requirement.unsatisfiedPolicy === "fail-closed") {
      throw new CommercialPdpProfileError(
        "unsatisfied-required-evidence",
        `Commercial PDP ${requirement.region} lacks required approved authority.`,
      );
    }
  });
}
