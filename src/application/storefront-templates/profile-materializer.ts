import {
  boundedParametersById,
  resolveBoundedParameterInheritance,
  type CommerceBindingSourceType,
  type ComponentDefinitionV2,
} from "@/domain/component-platform";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { validateNarrativeComposition } from "./design-vocabulary-validation";
import {
  executablePageBlueprintProfileSchema,
  storefrontTemplatePagePlanSchema,
  type StorefrontTemplatePagePlan,
  type CommercialHomepageProfileAuthority,
  type CommercialCollectionSearchProfileAuthority,
} from "./contract";
import { getCommercialSharedFrameProfile } from "@/domain/storefront/commercial-shared-frame";
import { requireCanonicalProductCardAnatomy } from "@/domain/product-card";

export type ExecutablePageBlueprintMaterialization = Readonly<{
  profileId: string;
  profileVersion: string;
  pageType: StorefrontTemplatePagePlan["pageType"];
  roleOrder: readonly string[];
  slots: readonly Readonly<{
    slotId: string;
    component: string;
    variant: string;
    narrativeRole: string;
    visualWeight: string;
    transitionIntent?: string;
    boundedParameters: Readonly<Record<string, string | number>>;
  }>[];
  requiredBindingCategories: readonly string[];
  requiredAssetRoles: readonly string[];
  commercialHomepage?: CommercialHomepageProfileAuthority;
  commercialCollectionSearch?: CommercialCollectionSearchProfileAuthority;
  fingerprint: string;
}>;

export class ExecutablePageBlueprintMaterializationError extends Error {
  constructor(
    readonly code:
      | "unknown-profile"
      | "unsupported-profile-version"
      | "invalid-profile"
      | "incompatible-component"
      | "invalid-parameter"
      | "invalid-composition"
      | "missing-required-binding",
    message: string,
  ) {
    super(message);
    this.name = "ExecutablePageBlueprintMaterializationError";
  }
}

const compositeRuntimeComponentByPageType: Readonly<
  Partial<Record<StorefrontTemplatePagePlan["pageType"], Readonly<Record<string, string>>>>
> = {
  collection: {
    collectionHeader: "dynamicCollectionCommerce",
    filterBar: "dynamicCollectionCommerce",
    productGrid: "dynamicCollectionCommerce",
  },
  product: {
    productGallery: "dynamicProductDetail",
    productInfo: "dynamicProductDetail",
    productOptions: "dynamicProductDetail",
    benefitIcons: "dynamicProductDetail",
    imageText: "dynamicProductDetail",
    relatedProducts: "dynamicProductDetail",
  },
};

/** Canonical PageBlueprint-slot projection into the controlled runtime registry. */
export function runtimeComponentForPageBlueprintComponent(
  component: string,
  pageType: StorefrontTemplatePagePlan["pageType"],
): string {
  return compositeRuntimeComponentByPageType[pageType]?.[component] ?? component;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => freeze(entry));
  }
  return value;
}

/**
 * Resolves the PageBlueprint exactly once into a renderer-independent execution
 * projection. Consumers receive this projection; they never reconstruct profile
 * order, family, variant or inherited parameter choices from raw recipe data.
 */
export function materializeExecutablePageBlueprint(
  input: Readonly<{
    pagePlan: StorefrontTemplatePagePlan;
    componentDefinitions: readonly ComponentDefinitionV2[];
    availableBindingCategories: readonly CommerceBindingSourceType[];
    brandSystemParameterValues?: Readonly<Record<string, string | number>>;
  }>,
): ExecutablePageBlueprintMaterialization {
  const parsedPagePlan = storefrontTemplatePagePlanSchema.safeParse(input.pagePlan);
  if (!parsedPagePlan.success) {
    throw new ExecutablePageBlueprintMaterializationError(
      "invalid-profile",
      "The PageBlueprint profile is not a valid registered composition contract.",
    );
  }
  const pagePlan = parsedPagePlan.data;
  const profile = pagePlan.profile;
  if (!profile) {
    throw new ExecutablePageBlueprintMaterializationError(
      "unknown-profile",
      "The PageBlueprint has no registered executable profile.",
    );
  }
  if (profile.version !== "1.0.0") {
    throw new ExecutablePageBlueprintMaterializationError(
      "unsupported-profile-version",
      `PageBlueprint profile ${profile.id} version ${profile.version} is unsupported.`,
    );
  }
  if (!executablePageBlueprintProfileSchema.safeParse(profile).success) {
    throw new ExecutablePageBlueprintMaterializationError(
      "invalid-profile",
      `PageBlueprint profile ${profile.id} is invalid.`,
    );
  }
  if (profile.commercialHomepage) {
    profile.commercialHomepage.compatibleSharedFrameProfileIds.forEach(
      getCommercialSharedFrameProfile,
    );
    requireCanonicalProductCardAnatomy(
      profile.commercialHomepage.productCardAnatomyId,
      "homepageMerchandising",
    );
  }
  if (profile.commercialCollectionSearch) {
    profile.commercialCollectionSearch.compatibleSharedFrameProfileIds.forEach(
      getCommercialSharedFrameProfile,
    );
    requireCanonicalProductCardAnatomy(
      profile.commercialCollectionSearch.productCardAnatomyId,
      "collectionResults",
    );
  }
  if (
    profile.scope !== pagePlan.pageType ||
    canonicalValueString(profile.orderedNarrativeRoles) !==
      canonicalValueString(pagePlan.slots.map((slot) => slot.narrativeRole)) ||
    profile.componentSelections.length !== pagePlan.slots.length
  ) {
    throw new ExecutablePageBlueprintMaterializationError(
      "invalid-profile",
      `Profile ${profile.id} does not match the canonical PageBlueprint structure.`,
    );
  }
  pagePlan.slots.forEach((slot, index) => {
    const selection = profile.componentSelections[index];
    if (
      !selection ||
      selection.slotId !== slot.id ||
      selection.component !== slot.sectionType ||
      selection.defaultVariant !== slot.defaultVariant ||
      canonicalValueString(selection.variants) !== canonicalValueString(slot.allowedVariants)
    ) {
      throw new ExecutablePageBlueprintMaterializationError(
        "invalid-profile",
        `Profile ${profile.id} does not match canonical slot ${slot.id}.`,
      );
    }
  });
  const definitions = new Map(
    input.componentDefinitions.map((definition) => [definition.type, definition]),
  );
  const slots = pagePlan.slots.map((slot) => {
    const expected = profile.componentSelections.find((selection) => selection.slotId === slot.id);
    const definition = definitions.get(slot.sectionType);
    if (
      !expected ||
      expected.component !== slot.sectionType ||
      expected.defaultVariant !== slot.defaultVariant ||
      !definition ||
      !definition.supportedPageTypes.includes(pagePlan.pageType) ||
      !definition.variants.some((variant) => variant.id === slot.defaultVariant)
    ) {
      throw new ExecutablePageBlueprintMaterializationError(
        "incompatible-component",
        `Profile ${profile.id} cannot materialize ${slot.id} as ${slot.sectionType}/${slot.defaultVariant}.`,
      );
    }
    const boundedParameters = Object.fromEntries(
      [
        ...new Set([
          ...Object.keys(input.brandSystemParameterValues ?? {}),
          ...Object.keys(profile.parameterDefaults),
        ]),
      ].map((parameterId) => {
        const value = profile.parameterDefaults[parameterId];
        const parameter = boundedParametersById.get(parameterId);
        if (!parameter) {
          throw new ExecutablePageBlueprintMaterializationError(
            "invalid-parameter",
            `Profile ${profile.id} references unknown bounded parameter ${parameterId}.`,
          );
        }
        const resolved = resolveBoundedParameterInheritance(parameterId, [
          ...(input.brandSystemParameterValues?.[parameterId] === undefined
            ? []
            : [
                {
                  level: "brandSystem" as const,
                  value: input.brandSystemParameterValues[parameterId],
                },
              ]),
          ...(pagePlan.pageBlueprint.boundedParameterConstraints.some(
            (constraint) => constraint.parameterId === parameterId,
          )
            ? [
                {
                  level: "pageBlueprint" as const,
                  constraint: pagePlan.pageBlueprint.boundedParameterConstraints.find(
                    (constraint) => constraint.parameterId === parameterId,
                  ),
                },
              ]
            : []),
          ...(value === undefined ? [] : [{ level: "pageBlueprint" as const, value }]),
        ]);
        if (resolved.issues.length > 0 || resolved.value === undefined) {
          throw new ExecutablePageBlueprintMaterializationError(
            "invalid-parameter",
            `Profile ${profile.id} has invalid inherited ${parameterId} parameters.`,
          );
        }
        return [parameterId, resolved.value];
      }),
    );
    return {
      slotId: slot.id,
      component: slot.sectionType,
      variant: slot.defaultVariant,
      narrativeRole: slot.narrativeRole,
      visualWeight: slot.visualWeight,
      ...(slot.transitionIntent === undefined ? {} : { transitionIntent: slot.transitionIntent }),
      boundedParameters,
    };
  });
  const composition = validateNarrativeComposition({
    pageType: pagePlan.pageType,
    blueprintProfileId: profile.id,
    pageBlueprint: pagePlan,
    components: input.componentDefinitions,
    sections: slots.map(
      ({
        slotId,
        component,
        variant,
        narrativeRole,
        visualWeight,
        transitionIntent,
        boundedParameters,
      }) => ({
        id: slotId,
        component,
        variant,
        narrativeRole,
        visualWeight,
        ...(transitionIntent === undefined ? {} : { transitionIntent }),
        ...(Object.keys(boundedParameters).length === 0 ? {} : { parameters: boundedParameters }),
        parameterAuthority: "pageBlueprint" as const,
      }),
    ),
  });
  if (!composition.valid) {
    throw new ExecutablePageBlueprintMaterializationError(
      "invalid-composition",
      `Profile ${profile.id} fails narrative validation: ${composition.issues.map((entry) => entry.code).join(", ")}.`,
    );
  }
  if (
    profile.requiredAssetRoles.some(
      (role) =>
        !slots.some((slot) =>
          definitions
            .get(slot.component)
            ?.assetSlots.some((assetSlot) => assetSlot.acceptedRoles.includes(role)),
        ),
    )
  ) {
    throw new ExecutablePageBlueprintMaterializationError(
      "incompatible-component",
      `Profile ${profile.id} requires an asset role that its selected components cannot accept.`,
    );
  }
  if (!Array.isArray(input.availableBindingCategories)) {
    throw new ExecutablePageBlueprintMaterializationError(
      "missing-required-binding",
      `Profile ${profile.id} has no explicit canonical binding evidence.`,
    );
  }
  const available = new Set(input.availableBindingCategories);
  if (profile.requiredBindingCategories.some((category) => !available.has(category))) {
    throw new ExecutablePageBlueprintMaterializationError(
      "missing-required-binding",
      `Profile ${profile.id} lacks its required canonical binding categories.`,
    );
  }
  const materialization = {
    profileId: profile.id,
    profileVersion: profile.version,
    pageType: pagePlan.pageType,
    roleOrder: slots.map((slot) => slot.narrativeRole),
    slots,
    requiredBindingCategories: [...profile.requiredBindingCategories],
    requiredAssetRoles: [...profile.requiredAssetRoles],
    ...(profile.commercialHomepage
      ? { commercialHomepage: structuredClone(profile.commercialHomepage) }
      : {}),
    ...(profile.commercialCollectionSearch
      ? { commercialCollectionSearch: structuredClone(profile.commercialCollectionSearch) }
      : {}),
  };
  return freeze({
    ...materialization,
    fingerprint: `page-blueprint-${canonicalValueFingerprint(canonicalValueString(materialization))}`,
  });
}

/**
 * Confirms that the canonical sections which survived omission policy still
 * satisfy the already-materialized PageBlueprint. This deliberately consumes
 * the existing projection instead of materializing a second representation.
 */
export function validateExecutablePageBlueprintRealization(
  input: Readonly<{
    pagePlan: StorefrontTemplatePagePlan;
    materialization: ExecutablePageBlueprintMaterialization;
    componentDefinitions: readonly ComponentDefinitionV2[];
    sections: readonly Readonly<{ component: string; variant: string }>[];
  }>,
): void {
  const pagePlan = storefrontTemplatePagePlanSchema.parse(input.pagePlan);
  const profile = pagePlan.profile;
  if (
    !profile ||
    input.materialization.profileId !== profile.id ||
    input.materialization.profileVersion !== profile.version ||
    input.materialization.pageType !== pagePlan.pageType
  ) {
    throw new ExecutablePageBlueprintMaterializationError(
      "invalid-profile",
      "The final composition does not match its canonical executable PageBlueprint.",
    );
  }
  const unmatched = input.sections.map((section) => ({ ...section, used: false }));
  const realizedSlots = input.materialization.slots.filter((slot) => {
    const section = unmatched.find(
      (candidate) =>
        !candidate.used &&
        candidate.component === slot.component &&
        candidate.variant === slot.variant,
    );
    if (!section) return false;
    section.used = true;
    return true;
  });
  if (unmatched.some((section) => !section.used)) {
    throw new ExecutablePageBlueprintMaterializationError(
      "invalid-composition",
      "The final composition contains a section outside the executable PageBlueprint.",
    );
  }
  const roleCounts = new Map<string, number>();
  realizedSlots.forEach((slot) =>
    roleCounts.set(slot.narrativeRole, (roleCounts.get(slot.narrativeRole) ?? 0) + 1),
  );
  if (
    profile.roleCardinality.some((entry) => {
      const count = roleCounts.get(entry.role) ?? 0;
      return count < entry.minimum || count > entry.maximum;
    })
  ) {
    throw new ExecutablePageBlueprintMaterializationError(
      "invalid-composition",
      "The final composition no longer satisfies the executable PageBlueprint role cardinality.",
    );
  }
  const composition = validateNarrativeComposition({
    pageType: pagePlan.pageType,
    blueprintProfileId: profile.id,
    pageBlueprint: pagePlan,
    components: input.componentDefinitions,
    sections: realizedSlots.map((slot) => ({
      id: slot.slotId,
      component: slot.component,
      variant: slot.variant,
      narrativeRole: slot.narrativeRole,
      visualWeight: slot.visualWeight,
      ...(slot.transitionIntent === undefined ? {} : { transitionIntent: slot.transitionIntent }),
      ...(Object.keys(slot.boundedParameters).length === 0
        ? {}
        : { parameters: slot.boundedParameters }),
      parameterAuthority: "pageBlueprint" as const,
    })),
  });
  if (!composition.valid) {
    throw new ExecutablePageBlueprintMaterializationError(
      "invalid-composition",
      `The final PageBlueprint composition fails narrative validation: ${composition.issues.map((entry) => entry.code).join(", ")}.`,
    );
  }
}
