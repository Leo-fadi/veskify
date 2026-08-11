import {
  boundedParametersById,
  resolveBoundedParameterInheritance,
} from "@/domain/component-platform";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { storefrontTemplatePagePlanSchema, type StorefrontTemplatePagePlan } from "./contract";

export class ExecutablePageBlueprintAuthorityError extends Error {
  constructor(
    readonly code: "invalid-profile" | "invalid-parameter",
    message: string,
  ) {
    super(message);
    this.name = "ExecutablePageBlueprintAuthorityError";
  }
}

export type ExecutablePageBlueprintAuthorityValidation = Readonly<{
  fingerprint: string;
  boundedParametersBySlotId: Readonly<Record<string, Readonly<Record<string, string | number>>>>;
}>;

/**
 * Validates current registered PageBlueprint/profile metadata and calculates
 * its canonical authority fingerprint. This is read-only authority knowledge:
 * it creates no storefront plan, page instance, proposal, snapshot, or
 * renderer projection.
 */
export function validateExecutablePageBlueprintAuthority(
  input: Readonly<{
    pagePlan: StorefrontTemplatePagePlan;
    brandSystemParameterValues?: Readonly<Record<string, string | number>>;
  }>,
): ExecutablePageBlueprintAuthorityValidation {
  const parsed = storefrontTemplatePagePlanSchema.safeParse(input.pagePlan);
  const profile = parsed.success ? parsed.data.profile : undefined;
  if (
    !parsed.success ||
    !profile ||
    profile.scope !== parsed.data.pageType ||
    canonicalValueString(profile.orderedNarrativeRoles) !==
      canonicalValueString(parsed.data.slots.map(({ narrativeRole }) => narrativeRole)) ||
    profile.componentSelections.length !== parsed.data.slots.length
  ) {
    throw new ExecutablePageBlueprintAuthorityError(
      "invalid-profile",
      "The PageBlueprint profile does not match its registered page structure.",
    );
  }
  parsed.data.slots.forEach((slot, index) => {
    const selection = profile.componentSelections[index];
    if (
      !selection ||
      selection.slotId !== slot.id ||
      selection.component !== slot.sectionType ||
      selection.defaultVariant !== slot.defaultVariant ||
      canonicalValueString(selection.variants) !== canonicalValueString(slot.allowedVariants)
    ) {
      throw new ExecutablePageBlueprintAuthorityError(
        "invalid-profile",
        `The PageBlueprint profile does not match registered slot ${slot.id}.`,
      );
    }
  });

  const boundedParametersBySlotId = Object.fromEntries(
    parsed.data.slots.map((slot) => {
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
            throw new ExecutablePageBlueprintAuthorityError(
              "invalid-parameter",
              `Profile ${profile.id} references unknown bounded parameter ${parameterId}.`,
            );
          }
          const constraint = parsed.data.pageBlueprint.boundedParameterConstraints.find(
            (candidate) => candidate.parameterId === parameterId,
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
            ...(constraint ? [{ level: "pageBlueprint" as const, constraint }] : []),
            ...(value === undefined ? [] : [{ level: "pageBlueprint" as const, value }]),
          ]);
          if (resolved.issues.length > 0 || resolved.value === undefined) {
            throw new ExecutablePageBlueprintAuthorityError(
              "invalid-parameter",
              `Profile ${profile.id} has invalid inherited ${parameterId} parameters.`,
            );
          }
          return [parameterId, resolved.value];
        }),
      );
      return [slot.id, boundedParameters];
    }),
  );
  const slots = parsed.data.slots.map((slot) => ({
    slotId: slot.id,
    component: slot.sectionType,
    variant: slot.defaultVariant,
    narrativeRole: slot.narrativeRole,
    visualWeight: slot.visualWeight,
    ...(slot.transitionIntent === undefined ? {} : { transitionIntent: slot.transitionIntent }),
    boundedParameters: boundedParametersBySlotId[slot.id] ?? {},
  }));
  const authorityMaterial = {
    profileId: profile.id,
    profileVersion: profile.version,
    pageType: parsed.data.pageType,
    roleOrder: slots.map(({ narrativeRole }) => narrativeRole),
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
  return Object.freeze({
    boundedParametersBySlotId: Object.freeze(boundedParametersBySlotId),
    fingerprint: `page-blueprint-${canonicalValueFingerprint(
      canonicalValueString(authorityMaterial),
    )}`,
  });
}
