import {
  executablePageBlueprintProfileSchema,
  listExecutablePageBlueprintProfiles,
  materializeExecutablePageBlueprint,
  type StorefrontTemplatePagePlan,
} from "@/application/storefront-templates";
import type { ReactNode } from "react";
import {
  boundedParametersById,
  createComponentCapabilityManifestAuthority,
  serializeComponentCapabilityManifest,
  type ComponentCapabilityManifestAuthority,
  type ComponentDefinitionV2,
  type ComponentVersion,
  type GeneratedComponentCapabilityManifest,
} from "@/domain/component-platform";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { dynamicCollectionCommerceComponentByTarget } from "@/components/storefront/dynamic-collection-commerce";
import { dynamicProductDetailComponentByTarget } from "@/components/storefront/dynamic-product-detail";
import { homepageCommerceComponentByTarget } from "@/components/storefront/homepage-commerce";
import { veskifyComponentCapabilityManifest } from "./capability-manifest";
import { veskifyComponentRegistry } from "./registry";
import { veskifyComponentDefinitionsV2 } from "./v2-registry";

const rendererTargets = ["editor", "preview", "published"] as const;
type RendererTarget = (typeof rendererTargets)[number];
type RendererCallable = (input: never) => ReactNode;

export const rendererConformanceFindingCategories = [
  "missing-renderer",
  "orphan-renderer",
  "incompatible-variant",
  "page-blueprint-compatibility-gap",
  "binding-gap",
  "asset-role-gap",
  "bounded-parameter-gap",
  "responsive-contract-gap",
  "accessibility-contract-gap",
  "metadata-or-version-drift",
  "commercial-capability-missing",
] as const;

export type RendererConformanceFindingCategory =
  (typeof rendererConformanceFindingCategories)[number];
export type RendererConformanceClassification =
  "blocking-defect" | "metadata-gap" | "commercial-gap" | "deliberate-future-capability";

export type RendererRegistration = Readonly<{
  adapterId: string;
  exportName: string;
  supportedTargets: readonly RendererTarget[];
  variantCapabilities: readonly RendererVariantCapability[];
  componentType?: string;
  version?: Readonly<ComponentVersion>;
  ownership?: "primary" | "fallback";
}>;

export type RendererVariantCapability = Readonly<{
  target: RendererTarget;
  supportedVariants: readonly string[];
  fallbackVariants?: readonly string[];
}>;

export type RendererConformanceFinding = Readonly<{
  id: string;
  category: RendererConformanceFindingCategory;
  classification: RendererConformanceClassification;
  message: string;
  componentType?: string;
  variantId?: string;
  profileId?: string;
}>;

export type RendererConformanceReport = Readonly<{
  manifestFingerprint: string;
  rendererRegistrationFingerprint: string;
  findings: readonly RendererConformanceFinding[];
  blockingDefects: readonly RendererConformanceFinding[];
  metadataGaps: readonly RendererConformanceFinding[];
  commercialGaps: readonly RendererConformanceFinding[];
  deliberateFutureCapabilities: readonly RendererConformanceFinding[];
  fingerprint: string;
}>;

export type RendererConformanceInput = Readonly<{
  componentDefinitions: readonly ComponentDefinitionV2[];
  pagePlans: readonly StorefrontTemplatePagePlan[];
  manifestAuthority: ComponentCapabilityManifestAuthority;
  rendererRegistrations: readonly RendererRegistration[];
  externalManifest?: GeneratedComponentCapabilityManifest;
}>;

function compare(left: string, right: string) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => freeze(entry));
  }
  return value;
}

function rendererIdentity(registration: Pick<RendererRegistration, "adapterId" | "exportName">) {
  return `${registration.adapterId}:${registration.exportName}`;
}

function canonicalTargets(targets: readonly string[]) {
  return [...new Set(targets)].sort(compare);
}

function canonicalVariantCapabilities(capabilities: readonly RendererVariantCapability[]) {
  return capabilities
    .map((capability) => ({
      target: capability.target,
      supportedVariants: canonicalTargets(capability.supportedVariants),
      fallbackVariants: canonicalTargets(capability.fallbackVariants ?? []),
    }))
    .sort((left, right) => compare(left.target, right.target));
}

function registrationFingerprintValue(registration: RendererRegistration) {
  return {
    adapterId: registration.adapterId,
    exportName: registration.exportName,
    componentType: registration.componentType ?? null,
    ownership: registration.ownership ?? "primary",
    supportedTargets: canonicalTargets(registration.supportedTargets),
    variantCapabilities: canonicalVariantCapabilities(registration.variantCapabilities),
    version: registration.version ?? null,
  };
}

function capabilityForTarget(registration: RendererRegistration, target: RendererTarget) {
  return registration.variantCapabilities.find((capability) => capability.target === target);
}

function capabilitiesFor(
  variants: readonly string[],
  targets: readonly RendererTarget[],
): readonly RendererVariantCapability[] {
  return targets.map((target) => ({ target, supportedVariants: variants }));
}

function registrationFromTargetMap(
  adapterId: string,
  componentType: string | undefined,
  targets: Readonly<Record<RendererTarget, RendererCallable>>,
  variants: readonly string[],
  supportedTargets: readonly RendererTarget[] = rendererTargets,
): RendererRegistration {
  const exportNames = [...new Set(Object.values(targets).map((renderer) => renderer.name))];
  return {
    adapterId,
    ...(componentType === undefined ? {} : { componentType }),
    exportName: exportNames.join("|"),
    supportedTargets: supportedTargets.filter((target) => typeof targets[target] === "function"),
    variantCapabilities: capabilitiesFor(variants, supportedTargets),
  };
}

/**
 * Reads renderer registrations from their actual runtime maps. This deliberately
 * does not maintain another component or capability inventory.
 */
export function collectLiveRendererRegistrations(): readonly RendererRegistration[] {
  const variantsByComponentType = new Map(
    veskifyComponentDefinitionsV2.map((definition) => [
      definition.type,
      definition.variants.map((variant) => variant.id),
    ]),
  );
  const variantsFor = (componentType: string) => {
    const variants = variantsByComponentType.get(componentType);
    if (!variants) throw new Error(`Missing renderer variant evidence for ${componentType}.`);
    return variants;
  };
  const legacyRegistrations: RendererRegistration[] = Object.entries(veskifyComponentRegistry)
    .filter(
      ([componentType, definition]) =>
        typeof definition.render === "function" &&
        ![
          "homepageHero",
          "homepageFeaturedCollections",
          "homepageFeaturedProducts",
          "homepageCollectionNavigation",
          "homepagePromotion",
          "homepageTrust",
        ].includes(componentType),
    )
    .map(([componentType]) => {
      const targets: readonly RendererTarget[] =
        componentType === "dynamicCollectionCommerce" || componentType === "dynamicProductDetail"
          ? ["editor"]
          : rendererTargets;
      return {
        adapterId: "veskifyV1Registry",
        componentType,
        exportName: componentType,
        ownership: componentType === "dynamicCollectionCommerce" ? "fallback" : "primary",
        supportedTargets: targets,
        variantCapabilities: capabilitiesFor(variantsFor(componentType), targets),
      };
    });
  return freeze([
    ...legacyRegistrations,
    ...Object.entries(homepageCommerceComponentByTarget).map(([componentType, targets]) =>
      registrationFromTargetMap(
        "veskifyHomepageRenderer",
        componentType,
        targets,
        variantsFor(componentType),
      ),
    ),
    registrationFromTargetMap(
      "veskifyCommerceRenderer",
      "dynamicCollectionCommerce",
      dynamicCollectionCommerceComponentByTarget,
      variantsFor("dynamicCollectionCommerce"),
    ),
    registrationFromTargetMap(
      "veskifyCommerceRenderer",
      "dynamicProductDetail",
      dynamicProductDetailComponentByTarget,
      variantsFor("dynamicProductDetail"),
      ["preview", "published"],
    ),
  ]);
}

function finding(
  category: RendererConformanceFindingCategory,
  classification: RendererConformanceClassification,
  id: string,
  message: string,
  context: Pick<RendererConformanceFinding, "componentType" | "variantId" | "profileId"> = {},
): RendererConformanceFinding {
  return { id, category, classification, message, ...context };
}

function validParameterValue(parameterId: string, value: string | number): boolean {
  const parameter = boundedParametersById.get(parameterId);
  if (!parameter) return false;
  if (parameter.allowedValues) return parameter.allowedValues.includes(value);
  return (
    typeof value === "number" &&
    value >= parameter.numericRange!.minimum &&
    value <= parameter.numericRange!.maximum
  );
}

function canonicalManifestFor(
  componentDefinitions: readonly ComponentDefinitionV2[],
  pagePlans: readonly StorefrontTemplatePagePlan[],
) {
  return createComponentCapabilityManifestAuthority({
    componentDefinitions,
    executableProfiles: pagePlans.map((plan) => plan.profile),
    validateExecutableProfile: (profile) => executablePageBlueprintProfileSchema.parse(profile),
  });
}

/**
 * Produces evidence from live registrations. Supplied manifest-shaped data is
 * checked for drift but never becomes the source used for conformance.
 */
export function createRendererConformanceReport(
  input: RendererConformanceInput,
): RendererConformanceReport {
  const findings: RendererConformanceFinding[] = [];
  const canonicalAuthority = canonicalManifestFor(input.componentDefinitions, input.pagePlans);
  const canonicalManifest = canonicalAuthority.manifest;
  const liveManifest = input.manifestAuthority.manifest;
  const liveSerialized = serializeComponentCapabilityManifest(liveManifest);
  const canonicalSerialized = serializeComponentCapabilityManifest(canonicalManifest);
  if (liveSerialized !== canonicalSerialized) {
    findings.push(
      finding(
        "metadata-or-version-drift",
        "metadata-gap",
        "live-manifest-drift",
        "The supplied manifest authority differs from the manifest regenerated from the live registry and profiles.",
      ),
    );
  }
  if (
    input.externalManifest !== undefined &&
    serializeComponentCapabilityManifest(input.externalManifest) !== canonicalSerialized
  ) {
    findings.push(
      finding(
        "metadata-or-version-drift",
        "metadata-gap",
        "external-manifest-drift",
        "External manifest-like data differs from the live generated manifest and is ignored.",
      ),
    );
  }

  const definitionsByType = new Map(
    input.componentDefinitions.map((definition) => [definition.type, definition]),
  );
  const registrationsByIdentity = new Map<string, RendererRegistration[]>();
  const registrationsByComponentType = new Map<string, RendererRegistration[]>();
  input.rendererRegistrations.forEach((registration) => {
    const key = rendererIdentity(registration);
    registrationsByIdentity.set(key, [...(registrationsByIdentity.get(key) ?? []), registration]);
    if (registration.componentType) {
      registrationsByComponentType.set(registration.componentType, [
        ...(registrationsByComponentType.get(registration.componentType) ?? []),
        registration,
      ]);
    }
  });

  for (const entry of canonicalManifest.entries) {
    const definition = definitionsByType.get(entry.componentType);
    if (!definition) {
      findings.push(
        finding(
          "metadata-or-version-drift",
          "blocking-defect",
          `manifest-without-definition:${entry.componentType}`,
          `Manifest component ${entry.componentType} has no live canonical definition.`,
          { componentType: entry.componentType },
        ),
      );
      continue;
    }
    if (
      canonicalValueString(entry.componentDefinitionVersion) !==
      canonicalValueString(definition.version)
    ) {
      findings.push(
        finding(
          "metadata-or-version-drift",
          "blocking-defect",
          `definition-version-drift:${entry.componentType}`,
          `Manifest component ${entry.componentType} has a stale definition version.`,
          { componentType: entry.componentType },
        ),
      );
    }
    const registrations = registrationsByIdentity.get(rendererIdentity(entry.renderer)) ?? [];
    if (registrations.length === 0) {
      findings.push(
        finding(
          "missing-renderer",
          "blocking-defect",
          `missing-renderer:${entry.componentType}`,
          `Manifest component ${entry.componentType} has no registered renderer.`,
          { componentType: entry.componentType },
        ),
      );
    }
    if (registrations.length > 1) {
      findings.push(
        finding(
          "metadata-or-version-drift",
          "blocking-defect",
          `duplicate-renderer:${entry.componentType}`,
          `Renderer ${rendererIdentity(entry.renderer)} has duplicate ownership.`,
          { componentType: entry.componentType },
        ),
      );
    }
    for (const registration of registrations) {
      if (
        registration.componentType !== undefined &&
        registration.componentType !== entry.componentType
      ) {
        findings.push(
          finding(
            "metadata-or-version-drift",
            "blocking-defect",
            `renderer-alias:${entry.componentType}`,
            `Renderer ${rendererIdentity(entry.renderer)} is registered through ${registration.componentType}, not ${entry.componentType}.`,
            { componentType: entry.componentType },
          ),
        );
      }
      if (
        canonicalValueString(canonicalTargets(registration.supportedTargets)) !==
        canonicalValueString(canonicalTargets(entry.renderer.supportedTargets))
      ) {
        findings.push(
          finding(
            "missing-renderer",
            "blocking-defect",
            `renderer-targets:${entry.componentType}`,
            `Renderer ${rendererIdentity(entry.renderer)} does not expose every declared target.`,
            { componentType: entry.componentType },
          ),
        );
      }
      if (registration.version === undefined) {
        findings.push(
          finding(
            "metadata-or-version-drift",
            "metadata-gap",
            `renderer-version-unregistered:${entry.componentType}`,
            `Renderer ${rendererIdentity(entry.renderer)} has no independently registered renderer version.`,
            { componentType: entry.componentType },
          ),
        );
      } else if (
        canonicalValueString(registration.version) !== canonicalValueString(definition.version)
      ) {
        findings.push(
          finding(
            "metadata-or-version-drift",
            "blocking-defect",
            `renderer-version-drift:${entry.componentType}`,
            `Renderer ${rendererIdentity(entry.renderer)} version differs from ${entry.componentType}.`,
            { componentType: entry.componentType },
          ),
        );
      }
    }
    const componentRegistrations = registrationsByComponentType.get(entry.componentType) ?? [];
    for (const target of entry.renderer.supportedTargets) {
      const declaredTargetRegistrations = registrations.filter((registration) =>
        registration.supportedTargets.includes(target),
      );
      const alternateTargetRegistrations = componentRegistrations.filter(
        (registration) =>
          rendererIdentity(registration) !== rendererIdentity(entry.renderer) &&
          registration.supportedTargets.includes(target),
      );
      if (alternateTargetRegistrations.length > 0) {
        const classification =
          declaredTargetRegistrations.length === 0 &&
          alternateTargetRegistrations.some(
            (registration) => (registration.ownership ?? "primary") === "primary",
          )
            ? "blocking-defect"
            : "deliberate-future-capability";
        findings.push(
          finding(
            "metadata-or-version-drift",
            classification,
            `renderer-ownership-drift:${entry.componentType}:${target}`,
            `Component ${entry.componentType} uses ${alternateTargetRegistrations
              .map(rendererIdentity)
              .sort(compare)
              .join(
                ", ",
              )} for ${target}, not only its declared ${rendererIdentity(entry.renderer)} renderer.`,
            { componentType: entry.componentType },
          ),
        );
      }
      for (const variant of entry.variants) {
        const capabilities = declaredTargetRegistrations
          .map((registration) => capabilityForTarget(registration, target))
          .filter(
            (capability): capability is RendererVariantCapability => capability !== undefined,
          );
        if (capabilities.some((capability) => capability.supportedVariants.includes(variant.id))) {
          continue;
        }
        if (capabilities.some((capability) => capability.fallbackVariants?.includes(variant.id))) {
          findings.push(
            finding(
              "incompatible-variant",
              "blocking-defect",
              `renderer-variant-fallback:${entry.componentType}:${variant.id}:${target}`,
              `Renderer ${rendererIdentity(entry.renderer)} exposes ${entry.componentType}/${variant.id} on ${target} only through an undeclared fallback.`,
              { componentType: entry.componentType, variantId: variant.id },
            ),
          );
          continue;
        }
        findings.push(
          finding(
            "incompatible-variant",
            "blocking-defect",
            `renderer-variant-target:${entry.componentType}:${variant.id}:${target}`,
            `Renderer ${rendererIdentity(entry.renderer)} does not support ${entry.componentType}/${variant.id} on ${target}.`,
            { componentType: entry.componentType, variantId: variant.id },
          ),
        );
      }
    }
    for (const registration of componentRegistrations) {
      const declaredVariants = new Set(entry.variants.map((variant) => variant.id));
      for (const capability of registration.variantCapabilities) {
        for (const variant of capability.supportedVariants) {
          if (!declaredVariants.has(variant)) {
            findings.push(
              finding(
                "metadata-or-version-drift",
                "metadata-gap",
                `renderer-stale-variant:${entry.componentType}:${variant}:${capability.target}`,
                `Renderer ${rendererIdentity(registration)} advertises stale ${entry.componentType}/${variant} support on ${capability.target}.`,
                { componentType: entry.componentType, variantId: variant },
              ),
            );
          }
        }
      }
    }
    const responsiveBreakpoints = new Set(
      definition.responsiveRules.flatMap((rule) => rule.breakpoints),
    );
    if (
      !(["mobile", "tablet", "desktop", "wide"] as const).every((point) =>
        responsiveBreakpoints.has(point),
      )
    ) {
      findings.push(
        finding(
          "responsive-contract-gap",
          "blocking-defect",
          `responsive-contract:${entry.componentType}`,
          `Component ${entry.componentType} does not declare all required responsive breakpoints.`,
          { componentType: entry.componentType },
        ),
      );
    }
    if (
      !definition.accessibilityRequirements.keyboard ||
      !definition.accessibilityRequirements.semantics ||
      !definition.accessibilityRequirements.labels ||
      !definition.accessibilityRequirements.focus
    ) {
      findings.push(
        finding(
          "accessibility-contract-gap",
          "blocking-defect",
          `accessibility-contract:${entry.componentType}`,
          `Component ${entry.componentType} lacks a registered accessibility contract.`,
          { componentType: entry.componentType },
        ),
      );
    }
  }

  for (const registration of input.rendererRegistrations) {
    const owners = canonicalManifest.entries.filter((entry) =>
      registration.componentType
        ? entry.componentType === registration.componentType
        : rendererIdentity(entry.renderer) === rendererIdentity(registration),
    );
    if (owners.length === 0) {
      findings.push(
        finding(
          "orphan-renderer",
          "blocking-defect",
          `orphan-renderer:${rendererIdentity(registration)}`,
          `Renderer ${rendererIdentity(registration)} has no canonical component definition.`,
        ),
      );
    }
    if (owners.length > 1) {
      findings.push(
        finding(
          "metadata-or-version-drift",
          "blocking-defect",
          `renderer-multiple-definitions:${rendererIdentity(registration)}`,
          `Renderer ${rendererIdentity(registration)} is owned by multiple canonical component definitions.`,
        ),
      );
    }
  }

  for (const pagePlan of input.pagePlans) {
    const profile = pagePlan.profile;
    if (!profile) continue;
    const manifestProfile = canonicalAuthority.getByProfileId(profile.id);
    if (!manifestProfile || manifestProfile.profileVersion !== profile.version) {
      findings.push(
        finding(
          "page-blueprint-compatibility-gap",
          "blocking-defect",
          `profile-manifest:${profile.id}`,
          `Executable PageBlueprint profile ${profile.id} does not resolve through the live manifest.`,
          { profileId: profile.id },
        ),
      );
      continue;
    }
    for (const [index, selection] of profile.componentSelections.entries()) {
      const slot = pagePlan.slots[index];
      const definition = definitionsByType.get(selection.component);
      if (!slot || !definition || !definition.supportedPageTypes.includes(pagePlan.pageType)) {
        findings.push(
          finding(
            "page-blueprint-compatibility-gap",
            "blocking-defect",
            `profile-component:${profile.id}:${selection.slotId}`,
            `Profile ${profile.id} selection ${selection.slotId} is not page-compatible.`,
            { componentType: selection.component, profileId: profile.id },
          ),
        );
        continue;
      }
      if (!definition.designCompatibility.allowedNarrativeRoles.includes(slot.narrativeRole)) {
        findings.push(
          finding(
            "page-blueprint-compatibility-gap",
            "blocking-defect",
            `profile-role:${profile.id}:${selection.slotId}`,
            `Profile ${profile.id} role ${slot.narrativeRole} is incompatible with ${selection.component}.`,
            { componentType: selection.component, profileId: profile.id },
          ),
        );
      }
      for (const variant of selection.variants) {
        if (!definition.variants.some((registered) => registered.id === variant)) {
          findings.push(
            finding(
              "incompatible-variant",
              "blocking-defect",
              `profile-variant:${profile.id}:${selection.component}:${variant}`,
              `Profile ${profile.id} variant ${selection.component}/${variant} is not renderer-compatible.`,
              { componentType: selection.component, variantId: variant, profileId: profile.id },
            ),
          );
        }
      }
    }
    for (const selection of profile.componentSelections) {
      const definition = definitionsByType.get(selection.component);
      if (!definition) continue;
      for (const bindingSlot of definition.commerceBindingSlots.filter((slot) => slot.required)) {
        const supplied = profile.requiredBindingCategories.some((category) =>
          bindingSlot.acceptedSourceTypes.includes(category),
        );
        if (!supplied) {
          findings.push(
            finding(
              "binding-gap",
              "blocking-defect",
              `profile-component-binding:${profile.id}:${selection.slotId}:${bindingSlot.id}`,
              `Profile ${profile.id} does not supply a canonical binding for required ${selection.component}/${bindingSlot.id}.`,
              { componentType: selection.component, profileId: profile.id },
            ),
          );
        }
      }
    }
    for (const category of profile.requiredBindingCategories) {
      const supported = profile.componentSelections.some((selection) =>
        definitionsByType
          .get(selection.component)
          ?.commerceBindingSlots.some((slot) => slot.acceptedSourceTypes.includes(category)),
      );
      if (!supported) {
        findings.push(
          finding(
            "binding-gap",
            "blocking-defect",
            `profile-stale-binding:${profile.id}:${category}`,
            `Profile ${profile.id} declares ${category} without a compatible selected component binding slot.`,
            { profileId: profile.id },
          ),
        );
      }
    }
    for (const role of profile.requiredAssetRoles) {
      const supported = profile.componentSelections.some((selection) =>
        definitionsByType
          .get(selection.component)
          ?.assetSlots.some((slot) => slot.acceptedRoles.includes(role)),
      );
      if (!supported) {
        findings.push(
          finding(
            "asset-role-gap",
            "blocking-defect",
            `profile-asset:${profile.id}:${role}`,
            `Profile ${profile.id} requires ${role} without a compatible selected component asset slot.`,
            { profileId: profile.id },
          ),
        );
      }
    }
    for (const [parameterId, value] of Object.entries(profile.parameterDefaults)) {
      const parameter = boundedParametersById.get(parameterId);
      const selections = profile.componentSelections.map((selection) => ({
        selection,
        definition: definitionsByType.get(selection.component),
      }));
      const supported =
        parameter !== undefined &&
        validParameterValue(parameterId, value) &&
        parameter.authority.defaultLevels.includes("pageBlueprint") &&
        selections.every(
          ({ selection, definition }) =>
            definition !== undefined &&
            parameter.compatibleComponentFamilies.includes(definition.family) &&
            parameter.compatiblePageTypes.includes(profile.scope) &&
            (parameter.compatibleVariants.length === 0 ||
              parameter.compatibleVariants.includes(selection.defaultVariant)),
        );
      if (!supported) {
        findings.push(
          finding(
            "bounded-parameter-gap",
            "blocking-defect",
            `profile-parameter:${profile.id}:${parameterId}`,
            `Profile ${profile.id} applies unsupported ${parameterId} at PageBlueprint authority.`,
            { profileId: profile.id },
          ),
        );
      }
    }
    try {
      const availableBindingCategories = profile.requiredBindingCategories;
      const first = materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: input.componentDefinitions,
        availableBindingCategories,
      });
      const second = materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: input.componentDefinitions,
        availableBindingCategories,
      });
      if (first.fingerprint !== second.fingerprint) {
        findings.push(
          finding(
            "page-blueprint-compatibility-gap",
            "blocking-defect",
            `profile-nondeterministic:${profile.id}`,
            `Profile ${profile.id} did not materialize deterministically.`,
            { profileId: profile.id },
          ),
        );
      }
    } catch {
      findings.push(
        finding(
          "page-blueprint-compatibility-gap",
          "blocking-defect",
          `profile-materialization:${profile.id}`,
          `Profile ${profile.id} cannot materialize from the live component registry.`,
          { profileId: profile.id },
        ),
      );
    }
  }

  const bridgedComponentTypes = new Set(Object.keys(veskifyComponentRegistry));
  const profileComponentTypes = new Set(
    input.pagePlans.flatMap(
      (plan) => plan.profile?.componentSelections.map((selection) => selection.component) ?? [],
    ),
  );
  canonicalManifest.entries
    .filter(
      (entry) =>
        !bridgedComponentTypes.has(entry.componentType) &&
        !profileComponentTypes.has(entry.componentType),
    )
    .forEach((entry) => {
      findings.push(
        finding(
          "commercial-capability-missing",
          "commercial-gap",
          `unbridged-commercial-capability:${entry.componentType}`,
          `Component ${entry.componentType} has a registered renderer but no canonical bridge or executable PageBlueprint selection.`,
          { componentType: entry.componentType },
        ),
      );
    });

  const orderedFindings = findings.sort((left, right) => compare(left.id, right.id));
  const grouped = {
    blockingDefects: orderedFindings.filter((entry) => entry.classification === "blocking-defect"),
    metadataGaps: orderedFindings.filter((entry) => entry.classification === "metadata-gap"),
    commercialGaps: orderedFindings.filter((entry) => entry.classification === "commercial-gap"),
    deliberateFutureCapabilities: orderedFindings.filter(
      (entry) => entry.classification === "deliberate-future-capability",
    ),
  };
  const reportContent = {
    manifestFingerprint: canonicalManifest.fingerprint,
    rendererRegistrationFingerprint: `renderer-registrations-${canonicalValueFingerprint(
      canonicalValueString(
        input.rendererRegistrations
          .map(registrationFingerprintValue)
          .sort((left, right) => compare(canonicalValueString(left), canonicalValueString(right))),
      ),
    )}`,
    findings: orderedFindings,
    ...grouped,
  };
  return freeze({
    ...reportContent,
    fingerprint: `renderer-conformance-${canonicalValueFingerprint(canonicalValueString(reportContent))}`,
  });
}

export function createLiveRendererConformanceReport(): RendererConformanceReport {
  return createRendererConformanceReport({
    componentDefinitions: veskifyComponentDefinitionsV2,
    pagePlans: listExecutablePageBlueprintProfiles(),
    manifestAuthority: veskifyComponentCapabilityManifest,
    rendererRegistrations: collectLiveRendererRegistrations(),
  });
}
