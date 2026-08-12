import {
  boundedParametersById,
  projectBoundedParametersToComponentRuntime,
  resolveBoundedParameterInheritance,
  type CommerceBindingSourceType,
  type ComponentDefinitionV2,
  type NarrativeRoleDefinition,
} from "@/domain/component-platform";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { validateNarrativeComposition } from "./design-vocabulary-validation";
import {
  executablePageBlueprintProfileSchema,
  storefrontTemplatePagePlanSchema,
  type StorefrontTemplatePagePlan,
  type CommercialHomepageProfileAuthority,
  type CommercialContentSupportProfileAuthority,
  type CommercialProductDetailProfileAuthority,
  type CommercialCollectionSearchProfileAuthority,
  type CommercialUtilityProfileAuthority,
} from "./contract";
import { getCommercialSharedFrameProfile } from "@/domain/storefront/commercial-shared-frame";
import { requireCanonicalProductCardAnatomy } from "@/domain/product-card";
import {
  ExecutablePageBlueprintAuthorityError,
  validateExecutablePageBlueprintAuthority,
} from "./profile-authority";

export type ExecutablePageBlueprintMaterialization = Readonly<{
  profileId: string;
  profileVersion: string;
  pageType: StorefrontTemplatePagePlan["pageType"];
  roleOrder: readonly NarrativeRoleDefinition["id"][];
  slots: readonly Readonly<{
    slotId: string;
    component: string;
    variant: string;
    narrativeRole: NarrativeRoleDefinition["id"];
    visualWeight: string;
    transitionIntent?: string;
    boundedParameters: Readonly<Record<string, string | number>>;
  }>[];
  requiredBindingCategories: readonly string[];
  requiredAssetRoles: readonly string[];
  commercialHomepage?: CommercialHomepageProfileAuthority;
  commercialContentSupport?: CommercialContentSupportProfileAuthority;
  commercialProductDetail?: CommercialProductDetailProfileAuthority;
  commercialCollectionSearch?: CommercialCollectionSearchProfileAuthority;
  commercialUtility?: CommercialUtilityProfileAuthority;
  fingerprint: string;
}>;

/**
 * A bounded, transient selection over one registered PageBlueprint slot. It
 * cannot replace the slot component or introduce unregistered variants or
 * parameters; it only selects authority already permitted by the profile and
 * current component definition.
 */
export type ExecutablePageBlueprintSlotSelectionOverride = Readonly<{
  slotId: string;
  component: string;
  variant: string;
  boundedParameters?: Readonly<Record<string, string | number>>;
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
    slotSelectionOverrides?: readonly ExecutablePageBlueprintSlotSelectionOverride[];
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
  if (profile.commercialContentSupport) {
    profile.commercialContentSupport.compatibleSharedFrameProfileIds.forEach(
      getCommercialSharedFrameProfile,
    );
  }
  if (profile.commercialProductDetail) {
    profile.commercialProductDetail.compatibleSharedFrameProfileIds.forEach(
      getCommercialSharedFrameProfile,
    );
    requireCanonicalProductCardAnatomy(
      profile.commercialProductDetail.relatedProductCardAnatomyId,
      "relatedProducts",
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
  if (profile.commercialUtility) {
    profile.commercialUtility.compatibleSharedFrameProfileIds.forEach(
      getCommercialSharedFrameProfile,
    );
  }
  let profileAuthority;
  try {
    profileAuthority = validateExecutablePageBlueprintAuthority({
      pagePlan,
      ...(input.brandSystemParameterValues
        ? { brandSystemParameterValues: input.brandSystemParameterValues }
        : {}),
    });
  } catch (cause) {
    if (cause instanceof ExecutablePageBlueprintAuthorityError) {
      throw new ExecutablePageBlueprintMaterializationError(cause.code, cause.message);
    }
    throw cause;
  }
  const definitions = new Map(
    input.componentDefinitions.map((definition) => [definition.type, definition]),
  );
  const suppliedSlotSelectionOverrides = input.slotSelectionOverrides;
  if (
    suppliedSlotSelectionOverrides !== undefined &&
    !Array.isArray(suppliedSlotSelectionOverrides)
  ) {
    throw new ExecutablePageBlueprintMaterializationError(
      "incompatible-component",
      `Profile ${profile.id} received invalid slot-selection authority.`,
    );
  }
  const slotSelectionOverrides: readonly ExecutablePageBlueprintSlotSelectionOverride[] =
    suppliedSlotSelectionOverrides ?? [];
  const selectionOverrides = new Map<string, ExecutablePageBlueprintSlotSelectionOverride>();
  for (const selection of slotSelectionOverrides) {
    if (
      !selection ||
      typeof selection !== "object" ||
      typeof selection.slotId !== "string" ||
      typeof selection.component !== "string" ||
      typeof selection.variant !== "string" ||
      selectionOverrides.has(selection.slotId)
    ) {
      throw new ExecutablePageBlueprintMaterializationError(
        "incompatible-component",
        `Profile ${profile.id} received an invalid or duplicate slot selection.`,
      );
    }
    selectionOverrides.set(selection.slotId, selection);
  }
  for (const slotId of selectionOverrides.keys()) {
    if (!pagePlan.slots.some((slot) => slot.id === slotId)) {
      throw new ExecutablePageBlueprintMaterializationError(
        "incompatible-component",
        `Profile ${profile.id} has no registered slot ${slotId}.`,
      );
    }
  }
  const slots = pagePlan.slots.map((slot) => {
    const expected = profile.componentSelections.find((selection) => selection.slotId === slot.id);
    const definition = definitions.get(slot.sectionType);
    const selectionOverride = selectionOverrides.get(slot.id);
    const variant = selectionOverride?.variant ?? slot.defaultVariant;
    const variantAuthority = definition?.commercialAnatomy?.variants.find(
      (candidate) => candidate.variantId === variant,
    );
    const hasParameterOverrides =
      selectionOverride?.boundedParameters !== undefined &&
      selectionOverride.boundedParameters !== null &&
      typeof selectionOverride.boundedParameters === "object" &&
      !Array.isArray(selectionOverride.boundedParameters) &&
      Object.keys(selectionOverride.boundedParameters).length > 0;
    if (
      !expected ||
      expected.component !== slot.sectionType ||
      expected.defaultVariant !== slot.defaultVariant ||
      !definition ||
      !definition.supportedPageTypes.includes(pagePlan.pageType) ||
      (selectionOverride?.component !== undefined &&
        selectionOverride.component !== slot.sectionType)
    ) {
      throw new ExecutablePageBlueprintMaterializationError(
        "incompatible-component",
        `Profile ${profile.id} cannot materialize ${slot.id} as its registered component.`,
      );
    }
    if (
      !slot.allowedVariants.includes(variant) ||
      !expected.variants.includes(variant) ||
      !definition.variants.some((candidate) => candidate.id === variant) ||
      (selectionOverride !== undefined &&
        (variant !== slot.defaultVariant || !hasParameterOverrides) &&
        variantAuthority?.classification !== "meaningfulStructuralVariant")
    ) {
      throw new ExecutablePageBlueprintMaterializationError(
        "incompatible-component",
        `Profile ${profile.id} cannot materialize ${slot.id} as ${slot.sectionType}/${variant}.`,
      );
    }
    const parameterOverrides = selectionOverride?.boundedParameters ?? {};
    if (
      !parameterOverrides ||
      typeof parameterOverrides !== "object" ||
      Array.isArray(parameterOverrides)
    ) {
      throw new ExecutablePageBlueprintMaterializationError(
        "invalid-parameter",
        `Profile ${profile.id} received invalid bounded parameters for slot ${slot.id}.`,
      );
    }
    const boundedParameters = {
      ...(profileAuthority.boundedParametersBySlotId[slot.id] ?? {}),
    };
    const resolvedParameterOverrides: Record<string, string | number> = {};
    for (const [parameterId, value] of Object.entries(parameterOverrides).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const parameter = boundedParametersById.get(parameterId);
      if (
        !parameter ||
        !definition.designCompatibility.boundedParameterIds.includes(parameterId) ||
        !parameter.authority.instanceOverrideAllowed ||
        !parameter.compatibleComponentFamilies.includes(definition.family) ||
        !parameter.compatiblePageTypes.includes(pagePlan.pageType) ||
        (parameter.compatibleVariants.length > 0 && !parameter.compatibleVariants.includes(variant))
      ) {
        throw new ExecutablePageBlueprintMaterializationError(
          "invalid-parameter",
          `Profile ${profile.id} cannot apply bounded parameter ${parameterId} to ${slot.sectionType}/${variant}.`,
        );
      }
      const pageConstraint = pagePlan.pageBlueprint.boundedParameterConstraints.find(
        (constraint) => constraint.parameterId === parameterId,
      );
      const slotConstraint = slot.boundedParameterConstraints.find(
        (constraint) => constraint.parameterId === parameterId,
      );
      const resolved = resolveBoundedParameterInheritance(parameterId, [
        ...(input.brandSystemParameterValues?.[parameterId] === undefined
          ? []
          : [
              {
                level: "brandSystem" as const,
                value: input.brandSystemParameterValues[parameterId],
              },
            ]),
        ...(pageConstraint
          ? [{ level: "pageBlueprint" as const, constraint: pageConstraint }]
          : []),
        ...(slotConstraint
          ? [{ level: "pageBlueprint" as const, constraint: slotConstraint }]
          : []),
        ...(profile.parameterDefaults[parameterId] === undefined
          ? []
          : [
              {
                level: "pageBlueprint" as const,
                value: profile.parameterDefaults[parameterId],
              },
            ]),
        { level: "instance" as const, value },
      ]);
      if (resolved.issues.length > 0 || resolved.value === undefined) {
        throw new ExecutablePageBlueprintMaterializationError(
          "invalid-parameter",
          `Profile ${profile.id} received an invalid current-authority value for ${parameterId} in slot ${slot.id}.`,
        );
      }
      boundedParameters[parameterId] = resolved.value;
      resolvedParameterOverrides[parameterId] = resolved.value;
    }
    if (
      projectBoundedParametersToComponentRuntime(slot.sectionType, resolvedParameterOverrides) ===
      null
    ) {
      throw new ExecutablePageBlueprintMaterializationError(
        "invalid-parameter",
        `Profile ${profile.id} cannot project the selected bounded parameters for slot ${slot.id} into its current renderer.`,
      );
    }
    return {
      slotId: slot.id,
      component: slot.sectionType,
      variant,
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
    ...(profile.commercialContentSupport
      ? { commercialContentSupport: structuredClone(profile.commercialContentSupport) }
      : {}),
    ...(profile.commercialProductDetail
      ? { commercialProductDetail: structuredClone(profile.commercialProductDetail) }
      : {}),
    ...(profile.commercialCollectionSearch
      ? { commercialCollectionSearch: structuredClone(profile.commercialCollectionSearch) }
      : {}),
    ...(profile.commercialUtility
      ? { commercialUtility: structuredClone(profile.commercialUtility) }
      : {}),
  };
  return freeze({
    ...materialization,
    fingerprint:
      selectionOverrides.size === 0
        ? profileAuthority.fingerprint
        : `page-blueprint-${canonicalValueFingerprint(
            canonicalValueString({
              authorityFingerprint: profileAuthority.fingerprint,
              materialization,
            }),
          )}`,
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
