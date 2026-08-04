import { veskifyComponentCapabilityManifest } from "@/components/registry";
import type {
  ComponentCapabilityManifestAuthority,
  ComponentCapabilityManifestEntry,
  ExecutablePageBlueprintProfileCapabilityEntry,
} from "@/domain/component-platform";
import { resolveBoundedParameterInheritance } from "@/domain/component-platform";
import { pageTypeSchema, type PageType } from "@/domain/storefront";
import { designSkillRegistry } from "./default-registry";
import type { DesignSkillRegistry } from "./registry";

type NarrativeRole = ComponentCapabilityManifestEntry["narrativeRoles"][number];

export const skillCapabilityKnowledgeErrorCodes = {
  unknownManifestVersion: "unknownManifestVersion",
  staleManifestFingerprint: "staleManifestFingerprint",
  unknownProfile: "unknownProfile",
  unknownSlot: "unknownSlot",
  unknownComponent: "unknownComponent",
  unsupportedPageType: "unsupportedPageType",
  incompatibleProfilePageType: "incompatibleProfilePageType",
  incompatibleProfileComponent: "incompatibleProfileComponent",
  unknownVariant: "unknownVariant",
  unsupportedBoundedParameter: "unsupportedBoundedParameter",
} as const;

export type SkillCapabilityKnowledgeErrorCode =
  (typeof skillCapabilityKnowledgeErrorCodes)[keyof typeof skillCapabilityKnowledgeErrorCodes];

export class SkillCapabilityKnowledgeError extends Error {
  constructor(
    readonly code: SkillCapabilityKnowledgeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SkillCapabilityKnowledgeError";
  }
}

export type SkillCapabilityManifestReference = Readonly<{
  version: string;
  fingerprint: string;
}>;

export type SkillProfileCapability = Readonly<{
  profileId: string;
  profileVersion: string;
  fingerprint: string;
  pageType: PageType;
  orderedNarrativeRoles: readonly string[];
  requiredBindingCategories: readonly string[];
  requiredAssetRoles: readonly string[];
  componentSelections: readonly Readonly<{
    slotId: string;
    componentType: string;
    variants: readonly string[];
    defaultVariant: string;
  }>[];
}>;

export type SkillComponentCapability = Readonly<{
  componentType: string;
  componentDefinitionVersion: Readonly<{
    major: number;
    minor: number;
    patch: number;
  }>;
  family: string;
  defaultVariant: string;
  variants: readonly string[];
  allowedPageTypes: readonly PageType[];
  narrativeRoles: readonly string[];
  boundedParameterIds: readonly string[];
  pageBlueprintCompatibility: Readonly<{
    policy: "anyRegistered" | "listed";
    profileIds: readonly string[];
  }>;
  requiredBindingSlots: readonly Readonly<{
    slotId: string;
    acceptedSourceTypes: readonly string[];
  }>[];
  requiredAssetSlots: readonly Readonly<{
    slotId: string;
    acceptedRoles: readonly string[];
  }>[];
  assetSlots: readonly Readonly<{
    slotId: string;
    acceptedRoles: readonly string[];
    required: boolean;
    minItems: number;
    maxItems?: number;
  }>[];
}>;

export type SkillCapabilitySelection = Readonly<{
  manifest: SkillCapabilityManifestReference;
  profileId: string;
  slotId: string;
  componentType: string;
  variant: string;
}>;

export type SkillProviderCapabilityContext = Readonly<{
  manifest: SkillCapabilityManifestReference;
  profiles: readonly SkillProfileCapability[];
  components: readonly SkillComponentCapability[];
}>;

export type CurrentDesignSkillInventoryEntry = Readonly<{
  id: string;
  version: string;
  scope: string;
  supportedPageTypes: readonly PageType[];
  allowedOperationTypes: readonly string[];
  allowedComponentTypes: readonly string[];
}>;

export type SkillCapabilityKnowledgeConsumer = Readonly<{
  getManifestReference: () => SkillCapabilityManifestReference;
  listExecutableProfiles: (
    input: Readonly<{
      manifest: SkillCapabilityManifestReference;
      pageType?: PageType;
    }>,
  ) => readonly SkillProfileCapability[];
  listCompatibleComponents: (
    input: Readonly<{
      manifest: SkillCapabilityManifestReference;
      pageType?: PageType;
      narrativeRole?: NarrativeRole;
      profileId?: string;
    }>,
  ) => readonly SkillComponentCapability[];
  resolveSelection: (input: SkillCapabilitySelection) => Readonly<{
    profile: SkillProfileCapability;
    slotId: string;
    component: SkillComponentCapability;
    variant: string;
  }>;
  validateBoundedParameter: (
    input: Readonly<{
      manifest: SkillCapabilityManifestReference;
      componentType: string;
      parameterId: string;
      value: string | number;
    }>,
  ) => Readonly<{ valid: boolean }>;
  createProviderCapabilityContext: (
    input: Readonly<{
      manifest: SkillCapabilityManifestReference;
      selections: readonly Omit<SkillCapabilitySelection, "manifest">[];
    }>,
  ) => SkillProviderCapabilityContext;
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      const child: unknown = Reflect.get(value, key);
      deepFreeze(child);
    }
  }
  return value;
}

function immutableList<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function profileCapability(
  profile: ExecutablePageBlueprintProfileCapabilityEntry,
): SkillProfileCapability {
  return deepFreeze({
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    fingerprint: profile.fingerprint,
    pageType: profile.pageType,
    orderedNarrativeRoles: immutableList(profile.orderedNarrativeRoles),
    requiredBindingCategories: immutableList(profile.requiredBindingCategories),
    requiredAssetRoles: immutableList(profile.requiredAssetRoles),
    componentSelections: immutableList(
      profile.componentSelections.map((selection) =>
        deepFreeze({
          slotId: selection.slotId,
          componentType: selection.componentType,
          variants: immutableList(selection.variants),
          defaultVariant: selection.defaultVariant,
        }),
      ),
    ),
  });
}

function componentCapability(entry: ComponentCapabilityManifestEntry): SkillComponentCapability {
  return deepFreeze({
    componentType: entry.componentType,
    componentDefinitionVersion: deepFreeze({ ...entry.componentDefinitionVersion }),
    family: entry.family,
    defaultVariant: entry.defaultVariant,
    variants: immutableList(entry.variants.map((variant) => variant.id)),
    allowedPageTypes: immutableList(entry.allowedPageTypes),
    narrativeRoles: immutableList(entry.narrativeRoles),
    boundedParameterIds: immutableList(entry.boundedParameters.map((parameter) => parameter.id)),
    pageBlueprintCompatibility: deepFreeze({
      policy: entry.pageBlueprintCompatibility.policy,
      profileIds: immutableList(entry.pageBlueprintCompatibility.profileIds),
    }),
    requiredBindingSlots: immutableList(
      entry.requiredCommerceBindingSlots.map((slot) =>
        deepFreeze({
          slotId: slot.slotId,
          acceptedSourceTypes: immutableList(slot.acceptedSourceTypes),
        }),
      ),
    ),
    requiredAssetSlots: immutableList(
      entry.requiredAssetSlots.map((slot) =>
        deepFreeze({
          slotId: slot.slotId,
          acceptedRoles: immutableList(slot.acceptedRoles),
        }),
      ),
    ),
    assetSlots: immutableList(
      entry.assetSlots.map((slot) =>
        deepFreeze({
          slotId: slot.id,
          acceptedRoles: immutableList(slot.acceptedRoles),
          required: slot.required,
          minItems: slot.minItems,
          ...(slot.maxItems === undefined ? {} : { maxItems: slot.maxItems }),
        }),
      ),
    ),
  });
}

function inventoryEntry(
  definition: ReturnType<DesignSkillRegistry["list"]>[number],
): CurrentDesignSkillInventoryEntry {
  return deepFreeze({
    id: definition.id,
    version: definition.version,
    scope: definition.scope,
    supportedPageTypes: immutableList(definition.supportedPageTypes),
    allowedOperationTypes: immutableList(definition.allowedOperationTypes),
    allowedComponentTypes: immutableList(definition.allowedComponentTypes),
  });
}

/**
 * Auditable inventory of the current legacy skill registry. It is descriptive
 * only: P10A-05 will replace hard-coded skill capability declarations with
 * versioned package contracts that consume this boundary.
 */
export function listCurrentDesignSkillInventory(
  registry: DesignSkillRegistry = designSkillRegistry,
): readonly CurrentDesignSkillInventoryEntry[] {
  return immutableList(
    registry
      .list()
      .map(inventoryEntry)
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

/**
 * Creates the one typed, read-only capability-consumer boundary for skills.
 * It accepts a generated authority, never raw manifest-shaped data, and omits
 * renderer internals, component schemas, canonical commerce records and asset
 * instances from every consumer and provider-facing projection.
 */
export function createSkillCapabilityKnowledgeConsumer(
  authority: ComponentCapabilityManifestAuthority = veskifyComponentCapabilityManifest,
): SkillCapabilityKnowledgeConsumer {
  const manifestReference = deepFreeze({
    version: authority.manifest.version,
    fingerprint: authority.manifest.fingerprint,
  });
  const profilesById = new Map(
    authority.manifest.profiles.map((profile) => [profile.profileId, profileCapability(profile)]),
  );
  const componentsByType = new Map(
    authority.manifest.entries.map((entry) => [entry.componentType, componentCapability(entry)]),
  );

  function assertManifestReference(reference: SkillCapabilityManifestReference) {
    if (reference.version !== manifestReference.version) {
      throw new SkillCapabilityKnowledgeError(
        skillCapabilityKnowledgeErrorCodes.unknownManifestVersion,
        "The requested capability manifest version is not available.",
      );
    }
    if (reference.fingerprint !== manifestReference.fingerprint) {
      throw new SkillCapabilityKnowledgeError(
        skillCapabilityKnowledgeErrorCodes.staleManifestFingerprint,
        "The requested capability manifest fingerprint is stale.",
      );
    }
  }

  function getProfile(profileId: string): SkillProfileCapability {
    const profile = profilesById.get(profileId);
    if (!profile) {
      throw new SkillCapabilityKnowledgeError(
        skillCapabilityKnowledgeErrorCodes.unknownProfile,
        `Unknown executable PageBlueprint profile: ${profileId}.`,
      );
    }
    return profile;
  }

  function getComponent(componentType: string): SkillComponentCapability {
    const component = componentsByType.get(componentType);
    if (!component) {
      throw new SkillCapabilityKnowledgeError(
        skillCapabilityKnowledgeErrorCodes.unknownComponent,
        `Unknown registered component capability: ${componentType}.`,
      );
    }
    return component;
  }

  function assertSupportedPageType(pageType: PageType | undefined) {
    if (pageType !== undefined && !pageTypeSchema.safeParse(pageType).success) {
      throw new SkillCapabilityKnowledgeError(
        skillCapabilityKnowledgeErrorCodes.unsupportedPageType,
        `Unsupported capability page type: ${pageType}.`,
      );
    }
  }

  function componentAllowsProfile(
    component: SkillComponentCapability,
    profile: SkillProfileCapability,
  ) {
    return (
      component.pageBlueprintCompatibility.policy === "anyRegistered" ||
      component.pageBlueprintCompatibility.profileIds.includes(profile.profileId)
    );
  }

  function resolveSelection(input: SkillCapabilitySelection) {
    assertManifestReference(input.manifest);
    const profile = getProfile(input.profileId);
    const component = getComponent(input.componentType);
    const selection = profile.componentSelections.find(
      (candidate) => candidate.slotId === input.slotId,
    );
    if (!selection) {
      throw new SkillCapabilityKnowledgeError(
        skillCapabilityKnowledgeErrorCodes.unknownSlot,
        `Profile ${profile.profileId} has no capability slot ${input.slotId}.`,
      );
    }
    if (selection.componentType !== component.componentType) {
      throw new SkillCapabilityKnowledgeError(
        skillCapabilityKnowledgeErrorCodes.incompatibleProfileComponent,
        `Slot ${input.slotId} does not select component ${component.componentType}.`,
      );
    }
    if (!componentAllowsProfile(component, profile)) {
      throw new SkillCapabilityKnowledgeError(
        skillCapabilityKnowledgeErrorCodes.incompatibleProfileComponent,
        `Component ${component.componentType} is not compatible with PageBlueprint ${profile.profileId}.`,
      );
    }
    if (
      !selection.variants.includes(input.variant) ||
      !component.variants.includes(input.variant)
    ) {
      throw new SkillCapabilityKnowledgeError(
        skillCapabilityKnowledgeErrorCodes.unknownVariant,
        `Variant ${input.variant} is not registered for ${component.componentType} in profile ${profile.profileId}.`,
      );
    }
    return deepFreeze({ profile, slotId: selection.slotId, component, variant: input.variant });
  }

  return deepFreeze({
    getManifestReference: () => manifestReference,
    listExecutableProfiles: ({ manifest, pageType }) => {
      assertManifestReference(manifest);
      return immutableList(
        [...profilesById.values()].filter(
          (profile) => pageType === undefined || profile.pageType === pageType,
        ),
      );
    },
    listCompatibleComponents: ({ manifest, pageType, narrativeRole, profileId }) => {
      assertManifestReference(manifest);
      assertSupportedPageType(pageType);
      const profile = profileId === undefined ? undefined : getProfile(profileId);
      if (profile && pageType !== undefined && profile.pageType !== pageType) {
        throw new SkillCapabilityKnowledgeError(
          skillCapabilityKnowledgeErrorCodes.incompatibleProfilePageType,
          `Profile ${profile.profileId} is not compatible with ${pageType} page capability queries.`,
        );
      }
      return immutableList(
        [...componentsByType.values()].filter((component) => {
          if (pageType !== undefined && !component.allowedPageTypes.includes(pageType))
            return false;
          if (narrativeRole !== undefined && !component.narrativeRoles.includes(narrativeRole)) {
            return false;
          }
          return profile === undefined
            ? true
            : componentAllowsProfile(component, profile) &&
                profile.componentSelections.some(
                  (selection) => selection.componentType === component.componentType,
                );
        }),
      );
    },
    resolveSelection,
    validateBoundedParameter: ({ manifest, componentType, parameterId, value }) => {
      assertManifestReference(manifest);
      const component = getComponent(componentType);
      if (!component.boundedParameterIds.includes(parameterId)) {
        throw new SkillCapabilityKnowledgeError(
          skillCapabilityKnowledgeErrorCodes.unsupportedBoundedParameter,
          `Bounded parameter ${parameterId} is not registered for ${componentType}.`,
        );
      }
      const resolution = resolveBoundedParameterInheritance(parameterId, [
        { level: "instance", value },
      ]);
      return deepFreeze({ valid: resolution.issues.length === 0 && resolution.value === value });
    },
    createProviderCapabilityContext: ({ manifest, selections }) => {
      assertManifestReference(manifest);
      const resolved = selections.map((selection) => resolveSelection({ ...selection, manifest }));
      const profiles = immutableList(
        [
          ...new Map(
            resolved.map((selection) => [selection.profile.profileId, selection.profile]),
          ).values(),
        ].sort((left, right) => left.profileId.localeCompare(right.profileId)),
      );
      const components = immutableList(
        [
          ...new Map(
            resolved.map((selection) => [selection.component.componentType, selection.component]),
          ).values(),
        ].sort((left, right) => left.componentType.localeCompare(right.componentType)),
      );
      return deepFreeze({ manifest: manifestReference, profiles, components });
    },
  });
}

export const skillCapabilityKnowledge = createSkillCapabilityKnowledgeConsumer();
