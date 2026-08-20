import { z } from "zod";
import {
  contentSupportDefinition,
  type ContentSupportVariant,
} from "@/components/registry/content-support";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { getCommercialSharedFrameProfile } from "@/domain/storefront/commercial-shared-frame";
import {
  deepFreeze,
  executablePageBlueprintProfileSchema,
  storefrontTemplatePagePlanSchema,
  type CommercialContentSupportProfileAuthority,
  type ExecutablePageBlueprintProfile,
  type StorefrontTemplatePagePlan,
  type StorefrontTemplateSlot,
} from "./contract";

export const COMMERCIAL_CONTENT_SUPPORT_PROFILE_VERSION = "1.0.0" as const;

export const commercialContentSupportProfileIds = [
  "content-about-story",
  "content-about-process",
  "content-contact-channels",
  "content-contact-directory",
  "content-location-directory",
  "content-location-appointments",
  "content-faq-disclosure",
  "content-faq-topic-guide",
  "content-service-details",
  "content-policy-reading",
  "content-generic-reading",
  "content-generic-editorial",
  "landing-campaign-editorial",
  "landing-campaign-image-led",
  "landing-campaign-story",
] as const;
export const commercialContentSupportProfileIdSchema = z.enum(commercialContentSupportProfileIds);
export type CommercialContentSupportProfileId = (typeof commercialContentSupportProfileIds)[number];

export class CommercialContentSupportProfileError extends Error {
  constructor(
    readonly code: "unknown-profile" | "invalid-structure",
    message: string,
  ) {
    super(message);
    this.name = "CommercialContentSupportProfileError";
  }
}

type ContentProfileInput = Readonly<{
  id: CommercialContentSupportProfileId;
  pageType: "content" | "landing";
  pageFamilyIds: CommercialContentSupportProfileAuthority["pageFamilyIds"];
  variant: ContentSupportVariant;
  narrativeRole: StorefrontTemplateSlot["narrativeRole"];
  visualWeight: StorefrontTemplateSlot["visualWeight"];
  compatibleSharedFrameProfileIds: CommercialContentSupportProfileAuthority["compatibleSharedFrameProfileIds"];
  defaultSharedFrameProfileId: CommercialContentSupportProfileAuthority["defaultSharedFrameProfileId"];
}>;

const breakpoints = [
  { breakpoint: "mobile" as const, viewport: 375 as const },
  { breakpoint: "tablet" as const, viewport: 768 as const },
  { breakpoint: "desktop" as const, viewport: 1024 as const },
  { breakpoint: "wide" as const, viewport: 1440 as const },
] as const;

function responsiveArchitecture(
  variant: ContentProfileInput["variant"],
): CommercialContentSupportProfileAuthority["responsiveArchitecture"] {
  const registered = new Map(
    (contentSupportDefinition.commercialAnatomy?.responsiveTransformations ?? []).map(
      (transformation) => [transformation.id, transformation],
    ),
  );
  const effectiveVariant =
    variant === "locationAppointments"
      ? "locationDirectory"
      : variant === "faqTopicGuide"
        ? "faqDisclosure"
        : variant;
  const preferredTransformation =
    effectiveVariant === "contactDirectory"
      ? "contactCondense"
      : effectiveVariant === "faqDisclosure"
        ? "faqDisclosureStack"
        : effectiveVariant === "campaignImageLed"
          ? "campaignReadingReflow"
          : "contentStack";
  const transformation = registered.get(preferredTransformation);
  if (!transformation)
    throw new Error(`Missing registered ${preferredTransformation} transformation.`);
  return breakpoints.map(({ breakpoint, viewport }) => ({
    breakpoint,
    viewport,
    transformationIds: transformation.breakpoints.includes(breakpoint) ? [transformation.id] : [],
  })) as CommercialContentSupportProfileAuthority["responsiveArchitecture"];
}

function createProfile(input: ContentProfileInput): StorefrontTemplatePagePlan {
  const slot: StorefrontTemplateSlot = {
    id: "approved-content-support",
    required: true,
    sectionType: "contentSupport",
    allowedVariants: [input.variant],
    defaultVariant: input.variant,
    label: { en: "Approved content and support", fi: "Hyväksytty sisältö ja tuki" },
    purpose: input.narrativeRole === "campaign" ? "campaign-promotion" : "editorial-story",
    narrativeRole: input.narrativeRole,
    visualWeight: input.visualWeight,
    boundedParameterConstraints: [],
    omitWhen: "never",
  };
  const structuralMaterial = {
    pageType: input.pageType,
    pageFamilyIds: [...input.pageFamilyIds],
    slot: { component: slot.sectionType, variant: slot.defaultVariant, role: slot.narrativeRole },
    compatibleSharedFrameProfileIds: [...input.compatibleSharedFrameProfileIds],
    responsiveArchitecture: responsiveArchitecture(input.variant),
  };
  const authority: CommercialContentSupportProfileAuthority = {
    family: "commercial-content-support",
    pageFamilyIds: [...input.pageFamilyIds],
    compatibleSharedFrameProfileIds: [...input.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: input.defaultSharedFrameProfileId,
    evidencePolicy: "current-approved-brief-facts",
    responsiveArchitecture: responsiveArchitecture(input.variant),
    structuralSignature: `content-support-structure-${canonicalValueFingerprint(structuralMaterial)}`,
    structuralFingerprint: `content-support-profile-${canonicalValueFingerprint({
      id: input.id,
      version: COMMERCIAL_CONTENT_SUPPORT_PROFILE_VERSION,
      structuralMaterial,
    })}`,
  };
  const profile: ExecutablePageBlueprintProfile = executablePageBlueprintProfileSchema.parse({
    id: input.id,
    version: COMMERCIAL_CONTENT_SUPPORT_PROFILE_VERSION,
    scope: input.pageType,
    orderedNarrativeRoles: [input.narrativeRole],
    roleCardinality: [{ role: input.narrativeRole, minimum: 1, maximum: 1 }],
    componentSelections: [
      {
        slotId: slot.id,
        component: slot.sectionType,
        variants: [...slot.allowedVariants],
        defaultVariant: slot.defaultVariant,
      },
    ],
    parameterDefaults: {},
    requiredBindingCategories: ["localizedContent"],
    requiredAssetRoles: [],
    responsiveBreakpoints: ["mobile", "tablet", "desktop", "wide"],
    accessibilityContract: "registered-component-contracts",
    commercialContentSupport: authority,
  });
  return storefrontTemplatePagePlanSchema.parse({
    pageType: input.pageType,
    slots: [slot],
    pageBlueprint: {
      allowedNarrativeRoles: [input.narrativeRole],
      requiredNarrativeRoles: [input.narrativeRole],
      flowRuleIds: [],
      maxRepeatedRole: 1,
      maxRepeatedComponentFamily: 1,
      boundedParameterConstraints: [],
      responsiveParameterIds: ["responsiveCollapse"],
    },
    profile,
  });
}

const inputs: readonly ContentProfileInput[] = [
  {
    id: "content-about-story",
    pageType: "content",
    pageFamilyIds: ["about"],
    variant: "aboutStory",
    narrativeRole: "education",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: [
      "editorial-masthead",
      "centered-minimal",
      "commerce-utility",
      "compact-technical",
    ],
    defaultSharedFrameProfileId: "editorial-masthead",
  },
  {
    id: "content-about-process",
    pageType: "content",
    pageFamilyIds: ["about"],
    variant: "aboutProcess",
    narrativeRole: "education",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "commerce-utility"],
    defaultSharedFrameProfileId: "editorial-masthead",
  },
  {
    id: "content-contact-channels",
    pageType: "content",
    pageFamilyIds: ["contact"],
    variant: "contactChannels",
    narrativeRole: "service",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["commerce-utility", "centered-minimal"],
    defaultSharedFrameProfileId: "commerce-utility",
  },
  {
    id: "content-contact-directory",
    pageType: "content",
    pageFamilyIds: ["contact"],
    variant: "contactDirectory",
    narrativeRole: "service",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["commerce-utility", "compact-technical"],
    defaultSharedFrameProfileId: "commerce-utility",
  },
  {
    id: "content-location-directory",
    pageType: "content",
    pageFamilyIds: ["store-locations"],
    variant: "locationDirectory",
    narrativeRole: "service",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["commerce-utility", "centered-minimal"],
    defaultSharedFrameProfileId: "commerce-utility",
  },
  {
    id: "content-location-appointments",
    pageType: "content",
    pageFamilyIds: ["store-locations"],
    variant: "locationAppointments",
    narrativeRole: "service",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["commerce-utility", "compact-technical"],
    defaultSharedFrameProfileId: "commerce-utility",
  },
  {
    id: "content-faq-disclosure",
    pageType: "content",
    pageFamilyIds: ["faq"],
    variant: "faqDisclosure",
    narrativeRole: "service",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["commerce-utility", "centered-minimal"],
    defaultSharedFrameProfileId: "commerce-utility",
  },
  {
    id: "content-faq-topic-guide",
    pageType: "content",
    pageFamilyIds: ["faq"],
    variant: "faqTopicGuide",
    narrativeRole: "education",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "commerce-utility"],
    defaultSharedFrameProfileId: "commerce-utility",
  },
  {
    id: "content-service-details",
    pageType: "content",
    pageFamilyIds: ["shipping-information", "returns-information"],
    variant: "serviceDetails",
    narrativeRole: "service",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["commerce-utility", "compact-technical", "centered-minimal"],
    defaultSharedFrameProfileId: "commerce-utility",
  },
  {
    id: "content-policy-reading",
    pageType: "content",
    pageFamilyIds: ["policy-legal"],
    variant: "policyReading",
    narrativeRole: "service",
    visualWeight: "light",
    compatibleSharedFrameProfileIds: ["centered-minimal", "compact-technical"],
    defaultSharedFrameProfileId: "centered-minimal",
  },
  {
    id: "content-generic-reading",
    pageType: "content",
    pageFamilyIds: ["generic-content"],
    variant: "genericReading",
    narrativeRole: "education",
    visualWeight: "light",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "centered-minimal"],
    defaultSharedFrameProfileId: "centered-minimal",
  },
  {
    id: "content-generic-editorial",
    pageType: "content",
    pageFamilyIds: ["generic-content"],
    variant: "genericEditorial",
    narrativeRole: "education",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "centered-minimal"],
    defaultSharedFrameProfileId: "editorial-masthead",
  },
  {
    id: "landing-campaign-editorial",
    pageType: "landing",
    pageFamilyIds: ["campaign-editorial"],
    variant: "campaignEditorial",
    narrativeRole: "education",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "commerce-utility"],
    defaultSharedFrameProfileId: "editorial-masthead",
  },
  {
    id: "landing-campaign-image-led",
    pageType: "landing",
    pageFamilyIds: ["campaign-editorial"],
    variant: "campaignImageLed",
    narrativeRole: "education",
    visualWeight: "heavy",
    compatibleSharedFrameProfileIds: ["editorial-masthead", "commerce-utility"],
    defaultSharedFrameProfileId: "editorial-masthead",
  },
  {
    id: "landing-campaign-story",
    pageType: "landing",
    pageFamilyIds: ["campaign-editorial"],
    variant: "campaignStory",
    narrativeRole: "education",
    visualWeight: "medium",
    compatibleSharedFrameProfileIds: ["centered-minimal", "editorial-masthead"],
    defaultSharedFrameProfileId: "editorial-masthead",
  },
];

export const commercialContentSupportPagePlans: readonly StorefrontTemplatePagePlan[] = deepFreeze(
  inputs.map(createProfile),
);

function dimensions(plan: StorefrontTemplatePagePlan) {
  const authority = plan.profile?.commercialContentSupport;
  if (!authority) throw new Error("Content/support profile authority is missing.");
  return [
    canonicalValueString(authority.pageFamilyIds),
    canonicalValueString(
      plan.slots.map((slot) => ({ component: slot.sectionType, variant: slot.defaultVariant })),
    ),
    canonicalValueString(authority.compatibleSharedFrameProfileIds),
    canonicalValueString(authority.responsiveArchitecture),
  ];
}

export function validateCommercialContentSupportProfileLibrary(
  entries: readonly unknown[] = commercialContentSupportPagePlans,
): readonly StorefrontTemplatePagePlan[] {
  const parsed = entries.map((entry) => storefrontTemplatePagePlanSchema.parse(entry));
  if (parsed.length < 15)
    throw new Error("P10B-12 requires fifteen registered content/support profiles.");
  if (new Set(parsed.map((plan) => plan.profile?.id)).size !== parsed.length) {
    throw new Error("Content/support profile IDs must be unique.");
  }
  if (new Set(parsed.map((plan) => dimensions(plan).join("|"))).size !== parsed.length) {
    throw new Error("Content/support profiles must have distinct structural compositions.");
  }
  parsed.forEach((plan) => {
    const profile = plan.profile;
    const authority = profile?.commercialContentSupport;
    if (!profile || !authority || profile.scope !== plan.pageType) {
      throw new Error("Content/support profiles must extend their executable PageBlueprint scope.");
    }
    authority.compatibleSharedFrameProfileIds.forEach(getCommercialSharedFrameProfile);
    if (authority.evidencePolicy !== "current-approved-brief-facts") {
      throw new Error("Content/support profiles must fail closed on current approved facts.");
    }
    const slot = plan.slots[0];
    if (
      plan.slots.length !== 1 ||
      !slot ||
      slot.sectionType !== "contentSupport" ||
      slot.defaultVariant !== profile.componentSelections[0]?.defaultVariant
    ) {
      throw new Error("Content/support profiles must materialize one bounded registered section.");
    }
  });
  return deepFreeze(parsed.map((entry) => structuredClone(entry)));
}

const validatedProfiles = validateCommercialContentSupportProfileLibrary();
const profilesById = new Map(validatedProfiles.map((plan) => [plan.profile!.id, plan] as const));

export function getCommercialContentSupportProfile(
  profileId: string,
): StorefrontTemplatePagePlan | undefined {
  const parsed = commercialContentSupportProfileIdSchema.safeParse(profileId);
  if (!parsed.success) return undefined;
  const plan = profilesById.get(parsed.data);
  return plan ? deepFreeze(structuredClone(plan)) : undefined;
}

export function listCommercialContentSupportProfiles(): readonly StorefrontTemplatePagePlan[] {
  return deepFreeze(validatedProfiles.map((plan) => structuredClone(plan)));
}
