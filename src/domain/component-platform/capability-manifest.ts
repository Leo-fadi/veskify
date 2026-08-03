import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import type { PageType } from "@/domain/storefront";
import type { ExecutablePageBlueprintProfile } from "@/application/storefront-templates";
import {
  componentDataSchemaContractSchema,
  componentDefinitionV2Schema,
  protectedCommerceFieldPaths,
  type AccessibilityRequirement,
  type AssetRole,
  type AssetSlotDefinition,
  type CommerceBindingSlotDefinition,
  type CommerceBindingSourceType,
  type ComponentDefinitionV2,
  type ComponentDataSchemaContract,
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
  contentSchema: Readonly<ComponentDataSchemaContract>;
  propsSchema: Readonly<ComponentDataSchemaContract>;
  styleOverridesSchema: Readonly<ComponentDataSchemaContract>;
  contentSlots: readonly Readonly<ContentSlotDefinition>[];
  commerceBindingSlots: readonly Readonly<CommerceBindingSlotDefinition>[];
  supportedBindingCategories: readonly CommerceBindingSourceType[];
  requiredCommerceBindingSlots: readonly Readonly<{
    slotId: CommerceBindingSlotDefinition["id"];
    acceptedSourceTypes: readonly CommerceBindingSourceType[];
  }>[];
  assetSlots: readonly Readonly<AssetSlotDefinition>[];
  supportedAssetRoles: readonly AssetRole[];
  requiredAssetSlots: readonly Readonly<{
    slotId: AssetSlotDefinition["id"];
    acceptedRoles: readonly AssetRole[];
  }>[];
  boundedParameters: readonly Readonly<BoundedParameterDefinition>[];
  editablePresentationFields: readonly Readonly<EditablePresentationField>[];
  protectedPaths: readonly string[];
  responsiveRules: readonly Readonly<ResponsiveRule>[];
  accessibilityRequirements: Readonly<AccessibilityRequirement>;
  renderer: Readonly<RendererAdapterIdentity>;
  migration: Readonly<ComponentMigrationMetadata>;
  fingerprint: string;
}>;

export type ExecutablePageBlueprintProfileCapabilityEntry = Readonly<{
  profileId: ExecutablePageBlueprintProfile["id"];
  profileVersion: ExecutablePageBlueprintProfile["version"];
  pageType: ExecutablePageBlueprintProfile["scope"];
  orderedNarrativeRoles: readonly ExecutablePageBlueprintProfile["orderedNarrativeRoles"][number][];
  roleCardinality: readonly Readonly<ExecutablePageBlueprintProfile["roleCardinality"][number]>[];
  componentSelections: readonly Readonly<{
    slotId: ExecutablePageBlueprintProfile["componentSelections"][number]["slotId"];
    componentType: ExecutablePageBlueprintProfile["componentSelections"][number]["component"];
    variants: readonly ExecutablePageBlueprintProfile["componentSelections"][number]["variants"][number][];
    defaultVariant: ExecutablePageBlueprintProfile["componentSelections"][number]["defaultVariant"];
  }>[];
  parameterDefaults: Readonly<ExecutablePageBlueprintProfile["parameterDefaults"]>;
  requiredBindingCategories: readonly ExecutablePageBlueprintProfile["requiredBindingCategories"][number][];
  requiredAssetRoles: readonly ExecutablePageBlueprintProfile["requiredAssetRoles"][number][];
  responsiveBreakpoints: Readonly<ExecutablePageBlueprintProfile["responsiveBreakpoints"]>;
  accessibilityContract: ExecutablePageBlueprintProfile["accessibilityContract"];
  fingerprint: string;
}>;

export type GeneratedComponentCapabilityManifest = Readonly<{
  version: typeof componentCapabilityManifestVersion;
  entries: readonly ComponentCapabilityManifestEntry[];
  profiles: readonly ExecutablePageBlueprintProfileCapabilityEntry[];
  fingerprint: string;
}>;

export type ComponentCapabilityManifestAuthority = Readonly<{
  manifest: GeneratedComponentCapabilityManifest;
  getByComponentType: (componentType: string) => ComponentCapabilityManifestEntry | undefined;
  getByProfileId: (profileId: string) => ExecutablePageBlueprintProfileCapabilityEntry | undefined;
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

export type ComponentCapabilityManifestGenerationInput = Readonly<{
  componentDefinitions: readonly unknown[];
  executableProfiles: readonly unknown[];
  validateExecutableProfile: (profile: unknown) => ExecutablePageBlueprintProfile;
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

const unorderedSchemaArrayKeys = new Set(["allOf", "anyOf", "enum", "oneOf", "required"]);

function canonicalizeJsonValue(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) {
    const entries = value.map((entry) => canonicalizeJsonValue(entry));
    return key && unorderedSchemaArrayKeys.has(key)
      ? entries.sort((left, right) =>
          compareCanonicalStrings(canonicalValueString(left), canonicalValueString(right)),
        )
      : entries;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareCanonicalStrings(left, right))
        .map(([entryKey, entryValue]) => [entryKey, canonicalizeJsonValue(entryValue, entryKey)]),
    );
  }
  return value;
}

function canonicalizeComponentSchema(
  schema: ComponentDataSchemaContract,
): ComponentDataSchemaContract {
  return componentDataSchemaContractSchema.parse(canonicalizeJsonValue(schema));
}

function canonicalizeBindingSlot(
  slot: CommerceBindingSlotDefinition,
): CommerceBindingSlotDefinition {
  return {
    ...clone(slot),
    acceptedSourceTypes: uniqueSorted(
      slot.acceptedSourceTypes,
      `binding source type for ${slot.id}`,
    ),
  };
}

function canonicalizeAssetSlot(slot: AssetSlotDefinition): AssetSlotDefinition {
  return {
    ...clone(slot),
    acceptedRoles: uniqueSorted(slot.acceptedRoles, `asset role for ${slot.id}`),
  };
}

function canonicalizeParameterDefaults(
  defaults: ExecutablePageBlueprintProfile["parameterDefaults"],
): ExecutablePageBlueprintProfile["parameterDefaults"] {
  return Object.fromEntries(
    Object.entries(defaults)
      .sort(([left], [right]) => compareCanonicalStrings(left, right))
      .map(([parameterId, value]) => [parameterId, clone(value)]),
  );
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
    if (!parameter.compatibleComponentFamilies.includes(definition.family)) {
      throw new Error(
        `Component ${definition.type} family ${definition.family} is incompatible with bounded parameter ${parameterId}.`,
      );
    }
    return clone(parameter);
  });
  const narrativeRoles = uniqueSorted(
    definition.designCompatibility.allowedNarrativeRoles,
    `narrative role for ${definition.type}`,
  );
  const assetSlots = canonicalRows(
    definition.assetSlots.map(canonicalizeAssetSlot),
    (slot) => slot.id,
  );
  const commerceBindingSlots = canonicalRows(
    definition.commerceBindingSlots.map(canonicalizeBindingSlot),
    (slot) => slot.id,
  );
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
    contentSchema: canonicalizeComponentSchema(definition.contentSchema),
    propsSchema: canonicalizeComponentSchema(definition.propsSchema),
    styleOverridesSchema: canonicalizeComponentSchema(definition.styleOverridesSchema),
    contentSlots: canonicalRows(definition.contentSlots, (slot) => slot.id),
    commerceBindingSlots,
    supportedBindingCategories: sortStrings([
      ...new Set(commerceBindingSlots.flatMap((slot) => slot.acceptedSourceTypes)),
    ]),
    requiredCommerceBindingSlots: commerceBindingSlots
      .filter((slot) => slot.required)
      .map((slot) => ({ slotId: slot.id, acceptedSourceTypes: slot.acceptedSourceTypes })),
    assetSlots,
    supportedAssetRoles: sortStrings([
      ...new Set(assetSlots.flatMap((slot) => slot.acceptedRoles)),
    ]),
    requiredAssetSlots: assetSlots
      .filter((slot) => slot.required)
      .map((slot) => ({ slotId: slot.id, acceptedRoles: slot.acceptedRoles })),
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

function profileEntry(
  profile: ExecutablePageBlueprintProfile,
  entriesByComponentType: ReadonlyMap<string, ComponentCapabilityManifestEntry>,
): ExecutablePageBlueprintProfileCapabilityEntry {
  const componentSelections = profile.componentSelections.map((selection) => {
    const component = entriesByComponentType.get(selection.component);
    if (!component) {
      throw new Error(
        `Executable PageBlueprint profile ${profile.id} references unknown component ${selection.component}.`,
      );
    }
    if (!component.allowedPageTypes.includes(profile.scope)) {
      throw new Error(
        `Executable PageBlueprint profile ${profile.id} uses ${selection.component} outside ${profile.scope} pages.`,
      );
    }
    const variants = uniqueSorted(
      selection.variants,
      `variant for ${profile.id}/${selection.component}`,
    );
    for (const variant of variants) {
      if (!component.variants.some((registered) => registered.id === variant)) {
        throw new Error(
          `Executable PageBlueprint profile ${profile.id} references unknown ${selection.component} variant ${variant}.`,
        );
      }
    }
    return {
      slotId: selection.slotId,
      componentType: selection.component,
      variants,
      defaultVariant: selection.defaultVariant,
    };
  });
  const entry = {
    profileId: profile.id,
    profileVersion: profile.version,
    pageType: profile.scope,
    orderedNarrativeRoles: clone(profile.orderedNarrativeRoles),
    roleCardinality: canonicalRows(profile.roleCardinality, (entry) => entry.role),
    componentSelections,
    parameterDefaults: canonicalizeParameterDefaults(profile.parameterDefaults),
    requiredBindingCategories: uniqueSorted(
      profile.requiredBindingCategories,
      `required binding category for profile ${profile.id}`,
    ),
    requiredAssetRoles: uniqueSorted(
      profile.requiredAssetRoles,
      `required asset role for profile ${profile.id}`,
    ),
    responsiveBreakpoints: clone(profile.responsiveBreakpoints),
    accessibilityContract: profile.accessibilityContract,
  };
  return deepFreeze({
    ...entry,
    fingerprint: `page-blueprint-capability-${canonicalValueFingerprint(
      canonicalValueString(entry),
    )}`,
  });
}

/**
 * Generates a detached, deterministic capability projection. Registered component
 * definitions remain the authority; this function never registers or mutates them.
 */
export function createComponentCapabilityManifestAuthority(
  input: ComponentCapabilityManifestGenerationInput,
): ComponentCapabilityManifestAuthority {
  const parsed = input.componentDefinitions.map((definition) =>
    componentDefinitionV2Schema.parse(definition),
  );
  const componentTypes = parsed.map((definition) => definition.type);
  if (new Set(componentTypes).size !== componentTypes.length) {
    throw new Error("Duplicate ComponentDefinitionV2 identities cannot generate a manifest.");
  }

  const entries = parsed
    .map(componentEntry)
    .sort((left, right) => compareCanonicalStrings(left.componentType, right.componentType));
  const byComponentType = new Map(entries.map((entry) => [entry.componentType, entry]));
  const parsedProfiles = input.executableProfiles.map((profile) =>
    input.validateExecutableProfile(profile),
  );
  const profileIds = parsedProfiles.map((profile) => profile.id);
  if (new Set(profileIds).size !== profileIds.length) {
    throw new Error(
      "Duplicate executable PageBlueprint profile identities cannot generate a manifest.",
    );
  }
  const profiles = parsedProfiles
    .map((profile) => profileEntry(profile, byComponentType))
    .sort((left, right) => compareCanonicalStrings(left.profileId, right.profileId));
  const profilesById = new Map(profiles.map((profile) => [profile.profileId, profile]));
  for (const entry of entries) {
    for (const profileId of entry.pageBlueprintCompatibility.profileIds) {
      if (!profilesById.has(profileId)) {
        throw new Error(
          `Component ${entry.componentType} references unknown executable PageBlueprint profile ${profileId}.`,
        );
      }
    }
  }
  const manifestContent = { version: componentCapabilityManifestVersion, entries, profiles };
  const manifest = deepFreeze({
    ...manifestContent,
    fingerprint: `component-capability-manifest-${canonicalValueFingerprint(
      canonicalValueString(manifestContent),
    )}`,
  });

  return deepFreeze({
    manifest,
    getByComponentType: (componentType) => byComponentType.get(componentType),
    getByProfileId: (profileId) => profilesById.get(profileId),
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
