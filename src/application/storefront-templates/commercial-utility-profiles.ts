import { z } from "zod";
import { commerceUtilityDefinition } from "@/components/registry/commerce-utility";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { getCommercialSharedFrameProfile } from "@/domain/storefront/commercial-shared-frame";
import {
  deepFreeze,
  executablePageBlueprintProfileSchema,
  pageBlueprintCompositionContractSchema,
  storefrontTemplatePagePlanSchema,
  type CommercialUtilityProfileAuthority,
  type StorefrontTemplatePagePlan,
} from "./contract";

export const COMMERCIAL_UTILITY_PROFILE_VERSION = "1.0.0" as const;
export const commercialUtilityProfileIds = [
  "commerce-utility-cart",
  "commerce-utility-checkout",
  "commerce-utility-no-results",
  "commerce-utility-empty",
  "commerce-utility-error",
  "commerce-utility-not-found",
] as const;
export const commercialUtilityProfileIdSchema = z.enum(commercialUtilityProfileIds);
export type CommercialUtilityProfileId = (typeof commercialUtilityProfileIds)[number];

type UtilityInput = Readonly<{
  id: CommercialUtilityProfileId;
  pageType: "cart" | "checkout" | "content";
  state: CommercialUtilityProfileAuthority["state"];
  variant:
    | "cart"
    | "checkoutBoundary"
    | "noResults"
    | "emptyState"
    | "recoverableError"
    | "notFound"
    | "loading";
  role: "orientation" | "continuation" | "service";
  frames: CommercialUtilityProfileAuthority["compatibleSharedFrameProfileIds"];
  defaultFrame: CommercialUtilityProfileAuthority["defaultSharedFrameProfileId"];
  capabilities: CommercialUtilityProfileAuthority["requiredRuntimeCapabilities"];
}>;

const breakpoints = [
  { breakpoint: "mobile" as const, viewport: 375 as const },
  { breakpoint: "tablet" as const, viewport: 768 as const },
  { breakpoint: "desktop" as const, viewport: 1024 as const },
  { breakpoint: "wide" as const, viewport: 1440 as const },
] as const;
const composition = pageBlueprintCompositionContractSchema.parse({
  allowedNarrativeRoles: ["orientation", "continuation", "service"],
  requiredNarrativeRoles: [],
  flowRuleIds: [],
  maxRepeatedRole: 1,
  maxRepeatedComponentFamily: 1,
  boundedParameterConstraints: [],
  responsiveParameterIds: ["responsiveCollapse"],
});

function createProfile(input: UtilityInput): StorefrontTemplatePagePlan {
  const architecture = breakpoints.map(({ breakpoint, viewport }) => ({
    breakpoint,
    viewport,
    transformationIds: breakpoint === "mobile" || breakpoint === "tablet" ? ["utilityStack"] : [],
  })) as CommercialUtilityProfileAuthority["responsiveArchitecture"];
  const material = {
    state: input.state,
    variant: input.variant,
    role: input.role,
    frames: input.frames,
    capabilities: input.capabilities,
    architecture,
  };
  const authority: CommercialUtilityProfileAuthority = {
    family: "commercial-utility",
    state: input.state,
    compatibleSharedFrameProfileIds: [...input.frames],
    defaultSharedFrameProfileId: input.defaultFrame,
    requiredRuntimeCapabilities: [...input.capabilities],
    omissionBehavior: "fail-closed",
    responsiveArchitecture: architecture,
    structuralSignature: `commerce-utility-structure-${canonicalValueFingerprint(material)}`,
    structuralFingerprint: `commerce-utility-profile-${canonicalValueFingerprint({ id: input.id, version: COMMERCIAL_UTILITY_PROFILE_VERSION, material })}`,
  };
  return storefrontTemplatePagePlanSchema.parse({
    pageType: input.pageType,
    slots: [
      {
        id: "utility-state",
        required: true,
        sectionType: "commerceUtility",
        allowedVariants: [input.variant],
        defaultVariant: input.variant,
        label: { en: "commerce utility", fi: "kaupan apunäkymä" },
        purpose: "navigation",
        narrativeRole: input.role,
        visualWeight: input.state === "cart" ? "heavy" : "medium",
        boundedParameterConstraints: [],
        omitWhen: "never",
      },
    ],
    pageBlueprint: composition,
    profile: executablePageBlueprintProfileSchema.parse({
      id: input.id,
      version: COMMERCIAL_UTILITY_PROFILE_VERSION,
      scope: input.pageType,
      orderedNarrativeRoles: [input.role],
      roleCardinality: [{ role: input.role, minimum: 1, maximum: 1 }],
      componentSelections: [
        {
          slotId: "utility-state",
          component: "commerceUtility",
          variants: [input.variant],
          defaultVariant: input.variant,
        },
      ],
      parameterDefaults: {},
      requiredBindingCategories: [],
      requiredAssetRoles: [],
      responsiveBreakpoints: ["mobile", "tablet", "desktop", "wide"],
      accessibilityContract: "registered-component-contracts",
      commercialUtility: authority,
    }),
  });
}

const inputs: readonly UtilityInput[] = [
  {
    id: "commerce-utility-cart",
    pageType: "cart",
    state: "cart",
    variant: "cart",
    role: "orientation",
    frames: ["commerce-utility", "compact-technical", "centered-minimal", "editorial-masthead"],
    defaultFrame: "commerce-utility",
    capabilities: ["change-quantity", "remove-line", "continue-checkout"],
  },
  {
    id: "commerce-utility-checkout",
    pageType: "checkout",
    state: "checkout",
    variant: "checkoutBoundary",
    role: "orientation",
    frames: ["commerce-utility", "centered-minimal", "editorial-masthead"],
    defaultFrame: "commerce-utility",
    capabilities: ["continue-checkout"],
  },
  {
    id: "commerce-utility-no-results",
    pageType: "content",
    state: "no-results",
    variant: "noResults",
    role: "orientation",
    frames: ["commerce-utility", "compact-technical", "centered-minimal", "editorial-masthead"],
    defaultFrame: "commerce-utility",
    capabilities: ["clear-search", "clear-filters"],
  },
  {
    id: "commerce-utility-empty",
    pageType: "content",
    state: "empty",
    variant: "emptyState",
    role: "continuation",
    frames: ["centered-minimal", "editorial-masthead", "commerce-utility"],
    defaultFrame: "centered-minimal",
    capabilities: ["continue-shopping"],
  },
  {
    id: "commerce-utility-error",
    pageType: "content",
    state: "error",
    variant: "recoverableError",
    role: "service",
    frames: ["compact-technical", "commerce-utility", "centered-minimal", "editorial-masthead"],
    defaultFrame: "compact-technical",
    capabilities: ["retry"],
  },
  {
    id: "commerce-utility-not-found",
    pageType: "content",
    state: "not-found",
    variant: "notFound",
    role: "orientation",
    frames: ["centered-minimal", "editorial-masthead", "commerce-utility"],
    defaultFrame: "centered-minimal",
    capabilities: ["return-home"],
  },
];

export const commercialUtilityPagePlans = deepFreeze(inputs.map(createProfile));

export function validateCommercialUtilityProfileLibrary(
  entries: readonly unknown[] = commercialUtilityPagePlans,
): readonly StorefrontTemplatePagePlan[] {
  const parsed = entries.map((entry) => storefrontTemplatePagePlanSchema.parse(entry));
  if (parsed.length < 6 || new Set(parsed.map((entry) => entry.profile?.id)).size !== parsed.length)
    throw new Error("Commercial utility profile IDs must be complete and unique.");
  parsed.forEach((plan) => {
    const authority = plan.profile?.commercialUtility;
    const slot = plan.slots[0];
    if (!authority || !slot || slot.sectionType !== "commerceUtility" || plan.slots.length !== 1)
      throw new Error("Commercial utility profiles require the registered utility component.");
    authority.compatibleSharedFrameProfileIds.forEach(getCommercialSharedFrameProfile);
    if (!commerceUtilityDefinition.variants.includes(slot.defaultVariant))
      throw new Error("Commercial utility profile selects an unregistered variant.");
    authority.responsiveArchitecture.forEach((entry) =>
      entry.transformationIds.forEach((id) => {
        if (id !== "utilityStack" || !["mobile", "tablet"].includes(entry.breakpoint))
          throw new Error(
            `Commercial utility transformation ${id} is unsupported at ${entry.breakpoint}.`,
          );
      }),
    );
    const expected = `commerce-utility-structure-${canonicalValueFingerprint({ state: authority.state, variant: slot.defaultVariant, role: slot.narrativeRole, frames: authority.compatibleSharedFrameProfileIds, capabilities: authority.requiredRuntimeCapabilities, architecture: authority.responsiveArchitecture })}`;
    if (authority.structuralSignature !== expected)
      throw new Error("Commercial utility profile has stale structural authority.");
  });
  return deepFreeze(parsed.map((entry) => structuredClone(entry)));
}

const validated = validateCommercialUtilityProfileLibrary();
const byId = new Map(
  validated.map((entry) => [entry.profile!.id as CommercialUtilityProfileId, entry]),
);
export const listCommercialUtilityProfiles = () =>
  deepFreeze(validated.map((entry) => structuredClone(entry)));
export const getCommercialUtilityProfile = (id: string) =>
  byId.get(id as CommercialUtilityProfileId)
    ? deepFreeze(structuredClone(byId.get(id as CommercialUtilityProfileId)!))
    : undefined;
