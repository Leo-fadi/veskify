import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import type { PageType } from "@/domain/storefront";
import {
  componentDefinitionV2Schema,
  protectedCommerceFieldPaths,
  type AccessibilityRequirement,
  type AssetRole,
  type AssetSlotDefinition,
  type CommerceBindingSlotDefinition,
  type CommerceBindingSourceType,
  type ComponentDefinitionV2,
  type ComponentFamily,
  type ComponentMigrationMetadata,
  type ComponentVersion,
  type ContentSlotDefinition,
  type EditablePresentationField,
  type RendererAdapterIdentity,
  type ResponsiveRule,
} from "./component-platform";
import { boundedParametersById, type BoundedParameterDefinition } from "./design-vocabulary";

export const componentCapabilityManifestVersion = "1.0.0" as const;

type NarrativeRole = ComponentDefinitionV2["designCompatibility"]["allowedNarrativeRoles"][number];

export type ComponentCapabilityManifestEntry = Readonly<{
  registryIdentity: string;
  componentType: string;
  componentDefinitionVersion: Readonly<ComponentVersion>;
  family: ComponentFamily;
  defaultVariant: ComponentDefinitionV2["defaultVariant"];
  variants: readonly Readonly<{
    id: string;
    compatibleDensity: readonly NonNullable<
      ComponentDefinitionV2["variants"][number]["compatibleDensity"]
    >[number][];
  }>[];
  allowedPageTypes: readonly PageType[];
  narrativeRoles: readonly NarrativeRole[];
  visualWeights: readonly ComponentDefinitionV2["designCompatibility"]["allowedVisualWeights"][number][];
  transitionIntents: readonly ComponentDefinitionV2["designCompatibility"]["allowedTransitionIntents"][number][];
  commerceRequirements: readonly ComponentDefinitionV2["designCompatibility"]["commerceRequirements"][number][];
  pageBlueprintCompatibility: Readonly<{
    policy: "anyRegistered" | "listed";
    profileIds: readonly string[];
  }>;
  contentSlots: readonly Readonly<ContentSlotDefinition>[];
  commerceBindingSlots: readonly Readonly<CommerceBindingSlotDefinition>[];
  supportedBindingCategories: readonly CommerceBindingSourceType[];
  requiredBindingCategories: readonly CommerceBindingSourceType[];
  assetSlots: readonly Readonly<AssetSlotDefinition>[];
  supportedAssetRoles: readonly AssetRole[];
  requiredAssetRoles: readonly AssetRole[];
  boundedParameters: readonly Readonly<BoundedParameterDefinition>[];
  editablePresentationFields: readonly Readonly<EditablePresentationField>[];
  protectedPaths: readonly string[];
  responsiveRules: readonly Readonly<ResponsiveRule>[];
  accessibilityRequirements: Readonly<AccessibilityRequirement>;
  renderer: Readonly<RendererAdapterIdentity>;
  migration: Readonly<ComponentMigrationMetadata>;
  fingerprint: string;
}>;

export type GeneratedComponentCapabilityManifest = Readonly<{
  version: typeof componentCapabilityManifestVersion;
  entries: readonly ComponentCapabilityManifestEntry[];
  fingerprint: string;
}>;

export type ComponentCapabilityManifestAuthority = Readonly<{
  manifest: GeneratedComponentCapabilityManifest;
  getByComponentType: (componentType: string) => ComponentCapabilityManifestEntry | undefined;
  getByFamily: (family: ComponentFamily) => readonly ComponentCapabilityManifestEntry[];
  getCompatibleForPageType: (pageType: PageType) => readonly ComponentCapabilityManifestEntry[];
  getCompatibleForNarrativeRole: (
    role: NarrativeRole,
  ) => readonly ComponentCapabilityManifestEntry[];
  getVariants: (
    componentType: string,
  ) => readonly ComponentCapabilityManifestEntry["variants"][number][];
  getBoundedParameters: (
    componentType: string,
  ) => readonly ComponentCapabilityManifestEntry["boundedParameters"][number][];
}>;

function compareCanonicalStrings(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function sortStrings<T extends string>(values: readonly T[]): T[] {
  return [...values].sort(compareCanonicalStrings);
}

function uniqueSorted<T extends string>(values: readonly T[], label: string): T[] {
  const sorted = sortStrings(values);
  if (new Set(sorted).size !== sorted.length) {
    throw new Error(`Duplicate ${label} capability metadata is not allowed.`);
  }
  return sorted;
}

function clone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    throw new Error("Component capability metadata must be serializable.");
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

function canonicalRows<T>(values: readonly T[], key: (value: T) => string): T[] {
  return values.map(clone).sort((left, right) => compareCanonicalStrings(key(left), key(right)));
}

function componentEntry(definition: ComponentDefinitionV2): ComponentCapabilityManifestEntry {
  const parameterIds = uniqueSorted(
    definition.designCompatibility.boundedParameterIds,
    `bounded parameter for ${definition.type}`,
  );
  const boundedParameters = parameterIds.map((parameterId) => {
    const parameter = boundedParametersById.get(parameterId);
    if (!parameter) {
      throw new Error(
        `Component ${definition.type} references unknown bounded parameter ${parameterId}.`,
      );
    }
    return clone(parameter);
  });
  const narrativeRoles = uniqueSorted(
    definition.designCompatibility.allowedNarrativeRoles,
    `narrative role for ${definition.type}`,
  );
  const assetSlots = canonicalRows(definition.assetSlots, (slot) => slot.id);
  const commerceBindingSlots = canonicalRows(definition.commerceBindingSlots, (slot) => slot.id);
  const entry = {
    registryIdentity: `ComponentDefinitionV2:${definition.type}`,
    componentType: definition.type,
    componentDefinitionVersion: clone(definition.version),
    family: definition.family,
    defaultVariant: definition.defaultVariant,
    variants: canonicalRows(definition.variants, (variant) => variant.id).map((variant) => ({
      id: variant.id,
      compatibleDensity: sortStrings(variant.compatibleDensity ?? []),
    })),
    allowedPageTypes: uniqueSorted(
      definition.supportedPageTypes,
      `page type for ${definition.type}`,
    ),
    narrativeRoles,
    visualWeights: uniqueSorted(
      definition.designCompatibility.allowedVisualWeights,
      `visual weight for ${definition.type}`,
    ),
    transitionIntents: uniqueSorted(
      definition.designCompatibility.allowedTransitionIntents,
      `transition intent for ${definition.type}`,
    ),
    commerceRequirements: uniqueSorted(
      definition.designCompatibility.commerceRequirements,
      `commerce requirement for ${definition.type}`,
    ),
    pageBlueprintCompatibility: {
      policy: definition.designCompatibility.blueprintProfilePolicy,
      profileIds: uniqueSorted(
        definition.designCompatibility.compatibleBlueprintProfileIds,
        `PageBlueprint profile for ${definition.type}`,
      ),
    },
    contentSlots: canonicalRows(definition.contentSlots, (slot) => slot.id),
    commerceBindingSlots,
    supportedBindingCategories: sortStrings([
      ...new Set(commerceBindingSlots.flatMap((slot) => slot.acceptedSourceTypes)),
    ]),
    requiredBindingCategories: sortStrings([
      ...new Set(
        commerceBindingSlots
          .filter((slot) => slot.required)
          .flatMap((slot) => slot.acceptedSourceTypes),
      ),
    ]),
    assetSlots,
    supportedAssetRoles: sortStrings([
      ...new Set(assetSlots.flatMap((slot) => slot.acceptedRoles)),
    ]),
    requiredAssetRoles: sortStrings([
      ...new Set(assetSlots.filter((slot) => slot.required).flatMap((slot) => slot.acceptedRoles)),
    ]),
    boundedParameters: canonicalRows(boundedParameters, (parameter) => parameter.id),
    editablePresentationFields: canonicalRows(
      definition.editablePresentationFields,
      (field) => `${field.source}:${field.path}`,
    ),
    protectedPaths: sortStrings([
      ...new Set([...protectedCommerceFieldPaths, ...definition.protectedFields.readOnlyPaths]),
    ]),
    responsiveRules: canonicalRows(definition.responsiveRules, canonicalValueString).map(
      (rule) => ({
        ...rule,
        breakpoints: sortStrings(rule.breakpoints),
      }),
    ),
    accessibilityRequirements: clone(definition.accessibilityRequirements),
    renderer: {
      ...clone(definition.renderer),
      supportedTargets: sortStrings(definition.renderer.supportedTargets),
    },
    migration: {
      ...clone(definition.migration),
      previousVersions: canonicalRows(definition.migration.previousVersions, canonicalValueString),
      migrations: canonicalRows(definition.migration.migrations, canonicalValueString),
    },
  };
  return deepFreeze({
    ...entry,
    fingerprint: `component-capability-${canonicalValueFingerprint(canonicalValueString(entry))}`,
  });
}

/**
 * Generates a detached, deterministic capability projection. Registered component
 * definitions remain the authority; this function never registers or mutates them.
 */
export function createComponentCapabilityManifestAuthority(
  definitions: readonly unknown[],
): ComponentCapabilityManifestAuthority {
  const parsed = definitions.map((definition) => componentDefinitionV2Schema.parse(definition));
  const componentTypes = parsed.map((definition) => definition.type);
  if (new Set(componentTypes).size !== componentTypes.length) {
    throw new Error("Duplicate ComponentDefinitionV2 identities cannot generate a manifest.");
  }

  const entries = parsed
    .map(componentEntry)
    .sort((left, right) => compareCanonicalStrings(left.componentType, right.componentType));
  const manifestContent = { version: componentCapabilityManifestVersion, entries };
  const manifest = deepFreeze({
    ...manifestContent,
    fingerprint: `component-capability-manifest-${canonicalValueFingerprint(
      canonicalValueString(manifestContent),
    )}`,
  });
  const byComponentType = new Map(entries.map((entry) => [entry.componentType, entry]));

  return deepFreeze({
    manifest,
    getByComponentType: (componentType) => byComponentType.get(componentType),
    getByFamily: (family) => deepFreeze(entries.filter((entry) => entry.family === family)),
    getCompatibleForPageType: (pageType) =>
      deepFreeze(entries.filter((entry) => entry.allowedPageTypes.includes(pageType))),
    getCompatibleForNarrativeRole: (role) =>
      deepFreeze(entries.filter((entry) => entry.narrativeRoles.includes(role))),
    getVariants: (componentType) => byComponentType.get(componentType)?.variants ?? [],
    getBoundedParameters: (componentType) =>
      byComponentType.get(componentType)?.boundedParameters ?? [],
  });
}

export function serializeComponentCapabilityManifest(
  manifest: GeneratedComponentCapabilityManifest,
): string {
  return canonicalValueString({
    version: manifest.version,
    entries: manifest.entries,
    fingerprint: manifest.fingerprint,
  });
}
