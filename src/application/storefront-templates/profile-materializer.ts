import {
  boundedParametersById,
  resolveBoundedParameterInheritance,
  type ComponentDefinitionV2,
} from "@/domain/component-platform";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { validateNarrativeComposition } from "./design-vocabulary-validation";
import {
  executablePageBlueprintProfileSchema,
  storefrontTemplatePagePlanSchema,
  type StorefrontTemplatePagePlan,
} from "./contract";

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
    availableBindingCategories?: readonly string[];
  }>,
): ExecutablePageBlueprintMaterialization {
  const pagePlan = storefrontTemplatePagePlanSchema.parse(input.pagePlan);
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
  executablePageBlueprintProfileSchema.parse(profile);
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
      Object.entries(profile.parameterDefaults).map(([parameterId, value]) => {
        const parameter = boundedParametersById.get(parameterId);
        if (!parameter) {
          throw new ExecutablePageBlueprintMaterializationError(
            "invalid-parameter",
            `Profile ${profile.id} references unknown bounded parameter ${parameterId}.`,
          );
        }
        const resolved = resolveBoundedParameterInheritance(parameterId, [
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
          { level: "instance" as const, value },
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
      }),
    ),
  });
  if (!composition.valid) {
    throw new ExecutablePageBlueprintMaterializationError(
      "invalid-composition",
      `Profile ${profile.id} fails narrative validation: ${composition.issues.map((entry) => entry.code).join(", ")}.`,
    );
  }
  const available = new Set(input.availableBindingCategories ?? profile.requiredBindingCategories);
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
  };
  return freeze({
    ...materialization,
    fingerprint: `page-blueprint-${canonicalValueFingerprint(canonicalValueString(materialization))}`,
  });
}
