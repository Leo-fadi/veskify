import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import type { PageType } from "@/domain/storefront";
import type { ExecutablePageBlueprintProfile } from "@/application/storefront-templates";
import {
  componentDataSchemaContractSchema,
  componentDefinitionV2Schema,
  formatComponentVersion,
  protectedCommerceFieldPaths,
  type AccessibilityRequirement,
  type AssetRole,
  type AssetSlotDefinition,
  type CommerceBindingSlotDefinition,
  type CommerceBindingSourceType,
  type ComponentDefinitionV2,
  type ComponentDataSchemaContract,
  type ComponentCommercialAnatomy,
  type ComponentFamily,
  type ComponentMaterialDifference,
  type ComponentMigrationMetadata,
  type ComponentVariantStructuralClassification,
  type ComponentVersion,
  type ContentSlotDefinition,
  type EditablePresentationField,
  type RendererAdapterIdentity,
  type ResponsiveRule,
} from "./component-platform";
import { boundedParametersById, type BoundedParameterDefinition } from "./design-vocabulary";
import {
  createCommercialGrammarCapability,
  evaluateCommercialGrammarCompatibility,
  resolveCommercialGrammarInheritance,
  type CommercialGrammarCategory,
  type CommercialGrammarCompatibilityAuthority,
  type CommercialGrammarLayer,
  type CommercialGrammarValueCompatibility,
} from "./commercial-design-grammar";

export const componentCapabilityManifestVersion = "1.3.0" as const;

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
    structuralClassification: ComponentVariantStructuralClassification | "unclassified";
    materialDifferences: readonly ComponentMaterialDifference[];
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
  commercialAnatomy?: Readonly<ComponentCommercialAnatomy> & Readonly<{ fingerprint: string }>;
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
  commercialHomepage?: NonNullable<ExecutablePageBlueprintProfile["commercialHomepage"]>;
  commercialProductDetail?: NonNullable<ExecutablePageBlueprintProfile["commercialProductDetail"]>;
  commercialCollectionSearch?: NonNullable<
    ExecutablePageBlueprintProfile["commercialCollectionSearch"]
  >;
  fingerprint: string;
}>;

export type GeneratedComponentCapabilityManifest = Readonly<{
  version: typeof componentCapabilityManifestVersion;
  entries: readonly ComponentCapabilityManifestEntry[];
  profiles: readonly ExecutablePageBlueprintProfileCapabilityEntry[];
  commercialDesignGrammar: ReturnType<typeof createCommercialGrammarCapability>;
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
  getCommercialAnatomy: (
    componentType: string,
  ) => ComponentCapabilityManifestEntry["commercialAnatomy"];
  getCommercialAnatomyMigration: (
    componentType: string,
    fromVersion: Readonly<ComponentVersion>,
  ) => ComponentMigrationMetadata["migrations"][number] | undefined;
  requireCommercialReadyVariant: (
    input: CommercialReadyVariantRequirement,
  ) => CommercialReadyVariantCapability;
  listCommercialGrammarCategories: () => readonly CommercialGrammarCategory[];
  getCommercialGrammarCategory: (
    categoryId: CommercialGrammarCategory["id"],
  ) => CommercialGrammarCategory | undefined;
  getCommercialGrammarValueCompatibility: (
    categoryId: CommercialGrammarCategory["id"],
    value: string,
  ) => CommercialGrammarValueCompatibility | undefined;
  resolveCommercialGrammar: (
    layers: readonly CommercialGrammarLayer[],
  ) => ReturnType<typeof resolveCommercialGrammarInheritance>;
  evaluateCommercialGrammarCompatibility: (
    input: Parameters<typeof evaluateCommercialGrammarCompatibility>[2],
  ) => ReturnType<typeof evaluateCommercialGrammarCompatibility>;
}>;

export type ComponentCapabilityManifestGenerationInput = Readonly<{
  componentDefinitions: readonly unknown[];
  executableProfiles: readonly unknown[];
  validateExecutableProfile: (profile: unknown) => ExecutablePageBlueprintProfile;
}>;

export const commercialCapabilityErrorCodes = {
  unknownComponent: "unknownComponent",
  unknownVariant: "unknownVariant",
  missingAnatomy: "missingAnatomy",
  staleAnatomy: "staleAnatomy",
  incompatiblePageFamily: "incompatiblePageFamily",
  incompatibleNarrativeRole: "incompatibleNarrativeRole",
  incompatibleAssetRole: "incompatibleAssetRole",
  notCommercialReady: "notCommercialReady",
  notMeaningfulStructuralVariant: "notMeaningfulStructuralVariant",
} as const;

export type CommercialCapabilityErrorCode =
  (typeof commercialCapabilityErrorCodes)[keyof typeof commercialCapabilityErrorCodes];

export class CommercialCapabilityError extends Error {
  constructor(
    readonly code: CommercialCapabilityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommercialCapabilityError";
  }
}

export type CommercialReadyVariantRequirement = Readonly<{
  componentType: string;
  variant: string;
  expectedAnatomyIdentity?: string;
  expectedAnatomyVersion?: Readonly<ComponentVersion>;
  pageType?: PageType;
  narrativeRole?: NarrativeRole;
  assetRoles?: readonly AssetRole[];
  requireMeaningful?: boolean;
}>;

export type CommercialReadyVariantCapability = Readonly<{
  component: ComponentCapabilityManifestEntry;
  variant: ComponentCapabilityManifestEntry["variants"][number];
  anatomy: NonNullable<ComponentCapabilityManifestEntry["commercialAnatomy"]>;
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

function canonicalizeCommercialAnatomy(
  anatomy: ComponentCommercialAnatomy,
): NonNullable<ComponentCapabilityManifestEntry["commercialAnatomy"]> {
  const content = {
    ...clone(anatomy),
    regions: canonicalRows(anatomy.regions, (region) => region.id),
    parameters: canonicalRows(anatomy.parameters, (parameter) => parameter.id),
    responsiveTransformations: canonicalRows(
      anatomy.responsiveTransformations,
      (transformation) => transformation.id,
    ).map((transformation) => ({
      ...transformation,
      breakpoints: sortStrings(transformation.breakpoints),
      affectedRegions: sortStrings(transformation.affectedRegions),
    })),
    compatibility: {
      allowedPageTypes: sortStrings(anatomy.compatibility.allowedPageTypes),
      narrativeRoles: sortStrings(anatomy.compatibility.narrativeRoles),
      brandPostures: sortStrings(anatomy.compatibility.brandPostures),
      assetRequirements: canonicalRows(
        anatomy.compatibility.assetRequirements,
        (requirement) => requirement.slotId,
      ).map((requirement) => ({
        ...requirement,
        acceptedRoles: sortStrings(requirement.acceptedRoles),
      })),
      responsiveModes: sortStrings(anatomy.compatibility.responsiveModes),
    },
    variants: canonicalRows(anatomy.variants, (variant) => variant.variantId).map((variant) => ({
      ...variant,
      materialDifferences: sortStrings(variant.materialDifferences),
      finishingTokenIds: sortStrings(variant.finishingTokenIds),
      structure: {
        ...variant.structure,
        omittedRegions: sortStrings(variant.structure.omittedRegions),
        assetPlacements: canonicalRows(
          variant.structure.assetPlacements,
          (placement) => placement.slotId,
        ),
        responsiveTransformationIds: sortStrings(variant.structure.responsiveTransformationIds),
      },
    })),
    migration: {
      ...clone(anatomy.migration),
      previousVersions: canonicalRows(anatomy.migration.previousVersions, canonicalValueString),
      migrations: canonicalRows(anatomy.migration.migrations, canonicalValueString),
    },
  };
  return deepFreeze({
    ...content,
    fingerprint: `component-anatomy-${canonicalValueFingerprint(canonicalValueString(content))}`,
  });
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
  const commercialAnatomy =
    definition.commercialAnatomy === undefined
      ? undefined
      : canonicalizeCommercialAnatomy(definition.commercialAnatomy);
  const commercialVariants = new Map(
    commercialAnatomy?.variants.map((variant) => [variant.variantId, variant]) ?? [],
  );
  const entry = {
    registryIdentity: `ComponentDefinitionV2:${definition.type}`,
    componentType: definition.type,
    componentDefinitionVersion: clone(definition.version),
    family: definition.family,
    defaultVariant: definition.defaultVariant,
    variants: canonicalRows(definition.variants, (variant) => variant.id).map(
      (variant): ComponentCapabilityManifestEntry["variants"][number] => ({
        id: variant.id,
        compatibleDensity: sortStrings(variant.compatibleDensity ?? []),
        structuralClassification:
          commercialVariants.get(variant.id)?.classification ?? "unclassified",
        materialDifferences: sortStrings(
          commercialVariants.get(variant.id)?.materialDifferences ?? [],
        ),
      }),
    ),
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
    ...(commercialAnatomy === undefined ? {} : { commercialAnatomy }),
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
    ...(profile.commercialHomepage
      ? { commercialHomepage: clone(profile.commercialHomepage) }
      : {}),
    ...(profile.commercialProductDetail
      ? { commercialProductDetail: clone(profile.commercialProductDetail) }
      : {}),
    ...(profile.commercialCollectionSearch
      ? { commercialCollectionSearch: clone(profile.commercialCollectionSearch) }
      : {}),
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
  const componentFamilies = new Set(entries.map((entry) => entry.family));
  for (const entry of entries) {
    for (const profileId of entry.pageBlueprintCompatibility.profileIds) {
      if (!profilesById.has(profileId)) {
        throw new Error(
          `Component ${entry.componentType} references unknown executable PageBlueprint profile ${profileId}.`,
        );
      }
    }
  }
  const commercialDesignGrammar = createCommercialGrammarCapability();
  const commercialGrammarCompatibilityAuthority: CommercialGrammarCompatibilityAuthority = {
    hasPageBlueprintProfile: (profileId) => profilesById.has(profileId),
    hasComponentFamily: (family) => componentFamilies.has(family as ComponentFamily),
    getComponent: (componentType) => {
      const entry = byComponentType.get(componentType);
      return entry
        ? { family: entry.family, variants: entry.variants.map((variant) => variant.id) }
        : undefined;
    },
  };
  const grammarCategoriesById = new Map(
    commercialDesignGrammar.categories.map((category) => [category.id, category]),
  );
  const grammarValueCompatibilityById = new Map(
    commercialDesignGrammar.valueCompatibility.map((entry) => [
      `${entry.categoryId}:${entry.value}`,
      entry,
    ]),
  );
  const manifestContent = {
    version: componentCapabilityManifestVersion,
    entries,
    profiles,
    commercialDesignGrammar,
  };
  const manifest = deepFreeze({
    ...manifestContent,
    fingerprint: `component-capability-manifest-${canonicalValueFingerprint(
      canonicalValueString(manifestContent),
    )}`,
  });

  function requireCommercialReadyVariant(
    requirement: CommercialReadyVariantRequirement,
  ): CommercialReadyVariantCapability {
    const component = byComponentType.get(requirement.componentType);
    if (!component) {
      throw new CommercialCapabilityError(
        commercialCapabilityErrorCodes.unknownComponent,
        `Unknown registered component capability: ${requirement.componentType}.`,
      );
    }
    const variant = component.variants.find((candidate) => candidate.id === requirement.variant);
    if (!variant) {
      throw new CommercialCapabilityError(
        commercialCapabilityErrorCodes.unknownVariant,
        `Unknown registered component variant: ${requirement.componentType}/${requirement.variant}.`,
      );
    }
    const anatomy = component.commercialAnatomy;
    if (!anatomy) {
      throw new CommercialCapabilityError(
        commercialCapabilityErrorCodes.missingAnatomy,
        `Component ${requirement.componentType} has no registered commercial anatomy.`,
      );
    }
    if (
      (requirement.expectedAnatomyIdentity !== undefined &&
        requirement.expectedAnatomyIdentity !== anatomy.identity) ||
      (requirement.expectedAnatomyVersion !== undefined &&
        formatComponentVersion(requirement.expectedAnatomyVersion) !==
          formatComponentVersion(anatomy.version))
    ) {
      throw new CommercialCapabilityError(
        commercialCapabilityErrorCodes.staleAnatomy,
        `Component ${requirement.componentType} commercial anatomy authority is stale.`,
      );
    }
    if (
      requirement.pageType !== undefined &&
      !anatomy.compatibility.allowedPageTypes.includes(requirement.pageType)
    ) {
      throw new CommercialCapabilityError(
        commercialCapabilityErrorCodes.incompatiblePageFamily,
        `Component ${requirement.componentType} is not commercially compatible with ${requirement.pageType} pages.`,
      );
    }
    if (
      requirement.narrativeRole !== undefined &&
      !anatomy.compatibility.narrativeRoles.includes(requirement.narrativeRole)
    ) {
      throw new CommercialCapabilityError(
        commercialCapabilityErrorCodes.incompatibleNarrativeRole,
        `Component ${requirement.componentType} is not commercially compatible with narrative role ${requirement.narrativeRole}.`,
      );
    }
    const acceptedAssetRoles = new Set(
      anatomy.compatibility.assetRequirements.flatMap((asset) => asset.acceptedRoles),
    );
    for (const assetRole of requirement.assetRoles ?? []) {
      if (!acceptedAssetRoles.has(assetRole)) {
        throw new CommercialCapabilityError(
          commercialCapabilityErrorCodes.incompatibleAssetRole,
          `Component ${requirement.componentType} does not accept commercial asset role ${assetRole}.`,
        );
      }
    }
    if (
      variant.structuralClassification === "unclassified" ||
      variant.structuralClassification === "legacySuperseded" ||
      variant.structuralClassification === "notYetP10BCommercialReady"
    ) {
      throw new CommercialCapabilityError(
        commercialCapabilityErrorCodes.notCommercialReady,
        `Component variant ${requirement.componentType}/${requirement.variant} is not P10B commercial-ready.`,
      );
    }
    if (
      (requirement.requireMeaningful ?? true) &&
      variant.structuralClassification !== "meaningfulStructuralVariant"
    ) {
      throw new CommercialCapabilityError(
        commercialCapabilityErrorCodes.notMeaningfulStructuralVariant,
        `Component variant ${requirement.componentType}/${requirement.variant} is not a meaningful structural variant.`,
      );
    }
    return deepFreeze({ component, variant, anatomy });
  }

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
    getCommercialAnatomy: (componentType) => byComponentType.get(componentType)?.commercialAnatomy,
    getCommercialAnatomyMigration: (componentType, fromVersion) => {
      const anatomy = byComponentType.get(componentType)?.commercialAnatomy;
      return anatomy?.migration.migrations.find(
        (migration) =>
          formatComponentVersion(migration.fromVersion) === formatComponentVersion(fromVersion) &&
          formatComponentVersion(migration.toVersion) === formatComponentVersion(anatomy.version),
      );
    },
    requireCommercialReadyVariant,
    listCommercialGrammarCategories: () => commercialDesignGrammar.categories,
    getCommercialGrammarCategory: (categoryId) => grammarCategoriesById.get(categoryId),
    getCommercialGrammarValueCompatibility: (categoryId, value) =>
      grammarValueCompatibilityById.get(`${categoryId}:${value}`),
    resolveCommercialGrammar: (layers) =>
      resolveCommercialGrammarInheritance(commercialDesignGrammar, layers),
    evaluateCommercialGrammarCompatibility: (compatibilityInput) =>
      evaluateCommercialGrammarCompatibility(
        commercialDesignGrammar,
        commercialGrammarCompatibilityAuthority,
        compatibilityInput,
      ),
  });
}

export function serializeComponentCapabilityManifest(
  manifest: GeneratedComponentCapabilityManifest,
): string {
  return canonicalValueString({
    version: manifest.version,
    entries: manifest.entries,
    profiles: manifest.profiles,
    commercialDesignGrammar: manifest.commercialDesignGrammar,
    fingerprint: manifest.fingerprint,
  });
}
