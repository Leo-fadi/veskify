import { storefrontDesignDirectionIdSchema } from "@/application/storefront-design-system";
import { assetRoleSchema, commerceBindingSourceTypeSchema } from "@/domain/component-platform";
import { idSchema, localeSchema } from "@/domain/shared";
import { canonicalValueFingerprint, pageTypeSchema } from "@/domain/storefront";
import { z } from "zod";
import {
  skillCapabilityKnowledge,
  SkillCapabilityKnowledgeError,
  type SkillCapabilityKnowledgeConsumer,
  type SkillCapabilityManifestReference,
} from "./capability-knowledge";

const fingerprintSchema = z.string().trim().min(1).max(240);
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const requestIdentitySchema = z.string().trim().min(1).max(240);

export const governedSkillPackageExecutionKindSchema = z.enum([
  "initialGeneration",
  "followUpEditing",
]);
export const governedSkillPackageScopeSchema = z.enum([
  "completeStorefront",
  "designSystem",
  "currentPage",
  "selectedSection",
]);
export const governedSkillPackageIdSchema = z.enum([
  "applyRegisteredWholeStorefrontDirection",
  "applyExactBrandPalette",
  "improveHero",
  "addCampaignSection",
]);
export const governedCapabilityQuerySchema = z.enum([
  "capabilityManifest",
  "executableProfile",
  "slotSelection",
  "boundedParameter",
  "canonicalBinding",
  "approvedAsset",
]);
export const governedAssetAuthoritySchema = z.enum(["none", "approvedAssetReuse"]);
export const governedParameterAuthoritySchema = z.enum(["none", "registeredBoundedParameters"]);
export const governedProfileRequirementSchema = z.enum(["none", "optional", "slotTarget"]);

export type GovernedSkillPackageExecutionKind = z.infer<
  typeof governedSkillPackageExecutionKindSchema
>;
export type GovernedSkillPackageScope = z.infer<typeof governedSkillPackageScopeSchema>;
export type GovernedSkillPackageId = z.infer<typeof governedSkillPackageIdSchema>;

export const governedSkillPackageDescriptorSchema = z
  .object({
    id: governedSkillPackageIdSchema,
    version: versionSchema,
    executionKind: z.literal("followUpEditing"),
    scope: governedSkillPackageScopeSchema,
    compatibility: z.object({ deprecated: z.literal(false) }).strict(),
    supportedPageTypes: z.array(pageTypeSchema).min(1),
    profileRequirement: governedProfileRequirementSchema,
    requiredCapabilityQueries: z.array(governedCapabilityQuerySchema).min(1),
    requiredAuthorityFingerprints: z.array(
      z.enum(["capabilityManifest", "componentRegistry", "commerce", "approvedAssets", "draft"]),
    ),
    parameterAuthority: governedParameterAuthoritySchema,
    assetAuthority: governedAssetAuthoritySchema,
    protectedStateRestrictions: z.array(
      z.enum([
        "commerceReadOnly",
        "navigationReadOnly",
        "canonicalMediaReadOnly",
        "approvedAssetIdentityReadOnly",
      ]),
    ),
    outputContractId: z.string().trim().min(1).max(160),
  })
  .strict()
  .superRefine((descriptor, context) => {
    for (const [field, values] of [
      ["supportedPageTypes", descriptor.supportedPageTypes],
      ["requiredCapabilityQueries", descriptor.requiredCapabilityQueries],
      ["requiredAuthorityFingerprints", descriptor.requiredAuthorityFingerprints],
      ["protectedStateRestrictions", descriptor.protectedStateRestrictions],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", path: [field], message: `${field} must be unique.` });
      }
    }
    if (
      descriptor.profileRequirement === "slotTarget" &&
      !descriptor.requiredCapabilityQueries.includes("slotSelection")
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiredCapabilityQueries"],
        message: "Slot-target packages must declare slot-selection capability access.",
      });
    }
  });

export type GovernedSkillPackageDescriptor = z.infer<typeof governedSkillPackageDescriptorSchema>;

export const governedSkillPackageAliasSchema = z
  .object({
    id: z.string().regex(/^[a-z][A-Za-z0-9]{2,79}$/),
    canonicalPackageId: governedSkillPackageIdSchema,
    deprecated: z.literal(true),
    directionId: storefrontDesignDirectionIdSchema.optional(),
  })
  .strict();

export type GovernedSkillPackageAlias = z.infer<typeof governedSkillPackageAliasSchema>;

export const governedSkillAuthorityEnvelopeSchema = z
  .object({
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    snapshotFingerprint: fingerprintSchema,
    manifest: z.object({ version: versionSchema, fingerprint: fingerprintSchema }).strict(),
    packageRegistry: z.object({ version: versionSchema, fingerprint: fingerprintSchema }).strict(),
    componentRegistryFingerprint: fingerprintSchema,
    commerceFingerprint: fingerprintSchema,
    approvedAssetFingerprint: fingerprintSchema.nullable(),
    locale: localeSchema,
    requestIdentity: requestIdentitySchema,
  })
  .strict();

export type GovernedSkillAuthorityEnvelope = z.infer<typeof governedSkillAuthorityEnvelopeSchema>;

export const governedProfileAuthoritySchema = z
  .object({
    profileId: z.string().trim().min(1).max(160),
    fingerprint: fingerprintSchema,
    pageType: pageTypeSchema,
  })
  .strict();

export const governedSkillSelectionSchema = z
  .object({
    profileId: z.string().trim().min(1).max(160),
    slotId: z.string().trim().min(1).max(160),
    componentType: z.string().trim().min(1).max(160),
    variant: z.string().trim().min(1).max(160),
  })
  .strict();

export const governedBoundedParameterIntentSchema = z
  .object({
    targetSlotId: z.string().trim().min(1).max(160),
    parameterId: z.string().trim().min(1).max(160),
    value: z.union([z.string(), z.number()]),
  })
  .strict();

export const governedCanonicalBindingReferenceSchema = z
  .object({
    targetSlotId: z.string().trim().min(1).max(160),
    bindingSlotId: z.string().trim().min(1).max(160),
    sourceType: commerceBindingSourceTypeSchema,
    fingerprint: fingerprintSchema,
  })
  .strict();

export const governedApprovedAssetReferenceSchema = z
  .object({
    targetSlotId: z.string().trim().min(1).max(160),
    assetSlotId: z.string().trim().min(1).max(160),
    assetId: idSchema,
    role: assetRoleSchema,
    revision: z.string().trim().min(1).max(160),
    materialFingerprint: fingerprintSchema,
    required: z.boolean(),
  })
  .strict();

export const governedInitialGenerationAuthoritySchema = z
  .object({
    executionKind: z.literal("initialGeneration"),
    authority: governedSkillAuthorityEnvelopeSchema,
    brief: z
      .object({
        briefId: idSchema,
        revision: z.number().int().positive(),
        fingerprint: fingerprintSchema,
      })
      .strict(),
    profiles: z.array(governedProfileAuthoritySchema).min(1),
    catalogueFingerprint: fingerprintSchema,
    registeredDirectionId: storefrontDesignDirectionIdSchema,
    outputContractId: z.literal("wholeStorefrontPlanningInput.v1"),
  })
  .strict();

export type GovernedInitialGenerationAuthority = z.infer<
  typeof governedInitialGenerationAuthoritySchema
>;

export const governedFollowUpEditingAuthoritySchema = z
  .object({
    executionKind: z.literal("followUpEditing"),
    packageId: z.string().regex(/^[a-z][A-Za-z0-9]{2,79}$/),
    packageVersion: versionSchema,
    scope: governedSkillPackageScopeSchema,
    authority: governedSkillAuthorityEnvelopeSchema,
    page: z
      .object({
        pageId: idSchema,
        pageType: pageTypeSchema,
        profile: governedProfileAuthoritySchema.optional(),
      })
      .strict(),
    selections: z.array(governedSkillSelectionSchema),
    boundedParameters: z.array(governedBoundedParameterIntentSchema).default([]),
    bindings: z.array(governedCanonicalBindingReferenceSchema).default([]),
    approvedAssets: z.array(governedApprovedAssetReferenceSchema).default([]),
  })
  .strict()
  .superRefine((request, context) => {
    const slotIds = request.selections.map((selection) => selection.slotId);
    if (new Set(slotIds).size !== slotIds.length) {
      context.addIssue({
        code: "custom",
        path: ["selections"],
        message: "Follow-up capability selections must use unique profile slot IDs.",
      });
    }
  });

export type GovernedFollowUpEditingAuthority = z.infer<
  typeof governedFollowUpEditingAuthoritySchema
>;

export const governedSkillPackageFailureCodeSchema = z.enum([
  "unknownPackage",
  "deprecatedPackageWithoutMigration",
  "invalidExecutionKind",
  "stalePackageAuthority",
  "invalidScope",
  "unsupportedPageType",
  "staleManifestAuthority",
  "staleProfileAuthority",
  "staleProjectAuthority",
  "staleDraftAuthority",
  "staleRegistryAuthority",
  "staleCommerceAuthority",
  "staleApprovedAssetAuthority",
  "missingProfileAuthority",
  "invalidSlotSelection",
  "unsupportedBoundedParameter",
  "invalidBoundedParameter",
  "invalidCanonicalBinding",
  "unsupportedAssetAuthority",
  "invalidApprovedAssetReference",
  "unauthorizedCapabilityReference",
  "invalidRequest",
]);

export type GovernedSkillPackageFailureCode = z.infer<typeof governedSkillPackageFailureCodeSchema>;

export type GovernedSkillPackageFailure = Readonly<{
  code: GovernedSkillPackageFailureCode;
  message: string;
}>;

export type GovernedSkillPackageValidationResult<T> =
  | Readonly<{ valid: true; value: T }>
  | Readonly<{ valid: false; failure: GovernedSkillPackageFailure }>;

export class GovernedSkillPackageError extends Error {
  constructor(
    readonly code: GovernedSkillPackageFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "GovernedSkillPackageError";
  }
}

export const GOVERNED_SKILL_PACKAGE_REGISTRY_VERSION = "1.0.0";

const protectedStateRestrictions = [
  "commerceReadOnly",
  "navigationReadOnly",
  "canonicalMediaReadOnly",
  "approvedAssetIdentityReadOnly",
] as const;

export const governedSkillPackageDescriptors = [
  {
    id: "applyRegisteredWholeStorefrontDirection",
    version: "1.0.0",
    executionKind: "followUpEditing",
    scope: "completeStorefront",
    compatibility: { deprecated: false },
    supportedPageTypes: ["home", "collection", "product", "content", "cart", "checkout", "landing"],
    profileRequirement: "optional",
    requiredCapabilityQueries: [
      "capabilityManifest",
      "executableProfile",
      "slotSelection",
      "boundedParameter",
      "canonicalBinding",
      "approvedAsset",
    ],
    requiredAuthorityFingerprints: [
      "capabilityManifest",
      "componentRegistry",
      "commerce",
      "approvedAssets",
      "draft",
    ],
    parameterAuthority: "registeredBoundedParameters",
    assetAuthority: "approvedAssetReuse",
    protectedStateRestrictions: [...protectedStateRestrictions],
    outputContractId: "governedFollowUpEditingAuthority.v1",
  },
  {
    id: "applyExactBrandPalette",
    version: "1.0.0",
    executionKind: "followUpEditing",
    scope: "designSystem",
    compatibility: { deprecated: false },
    supportedPageTypes: ["home", "collection", "product", "content", "cart", "checkout", "landing"],
    profileRequirement: "none",
    requiredCapabilityQueries: ["capabilityManifest"],
    requiredAuthorityFingerprints: ["capabilityManifest", "commerce", "approvedAssets", "draft"],
    parameterAuthority: "none",
    assetAuthority: "none",
    protectedStateRestrictions: [...protectedStateRestrictions],
    outputContractId: "governedFollowUpEditingAuthority.v1",
  },
  {
    id: "improveHero",
    version: "1.0.0",
    executionKind: "followUpEditing",
    scope: "selectedSection",
    compatibility: { deprecated: false },
    supportedPageTypes: ["home", "landing"],
    profileRequirement: "slotTarget",
    requiredCapabilityQueries: ["capabilityManifest", "executableProfile", "slotSelection"],
    requiredAuthorityFingerprints: ["capabilityManifest", "componentRegistry", "commerce", "draft"],
    parameterAuthority: "none",
    assetAuthority: "none",
    protectedStateRestrictions: [...protectedStateRestrictions],
    outputContractId: "governedFollowUpEditingAuthority.v1",
  },
  {
    id: "addCampaignSection",
    version: "1.0.0",
    executionKind: "followUpEditing",
    scope: "currentPage",
    compatibility: { deprecated: false },
    supportedPageTypes: ["home", "landing"],
    profileRequirement: "optional",
    requiredCapabilityQueries: ["capabilityManifest", "executableProfile"],
    requiredAuthorityFingerprints: ["capabilityManifest", "commerce", "approvedAssets", "draft"],
    parameterAuthority: "none",
    assetAuthority: "none",
    protectedStateRestrictions: [...protectedStateRestrictions],
    outputContractId: "governedFollowUpEditingAuthority.v1",
  },
] as const satisfies readonly GovernedSkillPackageDescriptor[];

export const governedSkillPackageAliases = [
  {
    id: "applyLuxuryStyle",
    canonicalPackageId: "applyRegisteredWholeStorefrontDirection",
    deprecated: true,
    directionId: "premiumEditorial",
  },
  {
    id: "applyMinimalNordicStyle",
    canonicalPackageId: "applyRegisteredWholeStorefrontDirection",
    deprecated: true,
    directionId: "modernTechnical",
  },
  {
    id: "applyMinimalNordicStorefrontStyle",
    canonicalPackageId: "applyRegisteredWholeStorefrontDirection",
    deprecated: true,
    directionId: "modernTechnical",
  },
  {
    id: "applyWarmPremiumStorefrontStyle",
    canonicalPackageId: "applyRegisteredWholeStorefrontDirection",
    deprecated: true,
    directionId: "premiumEditorial",
  },
  {
    id: "applyBrandPalette",
    canonicalPackageId: "applyExactBrandPalette",
    deprecated: true,
  },
] as const satisfies readonly GovernedSkillPackageAlias[];

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

function packageRegistryFingerprint(
  descriptors: readonly GovernedSkillPackageDescriptor[],
  aliases: readonly GovernedSkillPackageAlias[],
) {
  return `governed-skill-packages-${canonicalValueFingerprint({
    version: GOVERNED_SKILL_PACKAGE_REGISTRY_VERSION,
    descriptors: [...descriptors].sort((left, right) => left.id.localeCompare(right.id)),
    aliases: [...aliases].sort((left, right) => left.id.localeCompare(right.id)),
  })}`;
}

function failure(
  code: GovernedSkillPackageFailureCode,
  message: string,
): GovernedSkillPackageValidationResult<never> {
  return deepFreeze({ valid: false as const, failure: deepFreeze({ code, message }) });
}

function success<T>(value: T): GovernedSkillPackageValidationResult<T> {
  return deepFreeze({ valid: true as const, value });
}

function equivalentAuthority(
  requested: GovernedSkillAuthorityEnvelope,
  current: GovernedSkillAuthorityEnvelope,
): GovernedSkillPackageFailure | undefined {
  if (requested.projectId !== current.projectId) {
    return {
      code: "staleProjectAuthority",
      message: "The governed request targets a stale project.",
    };
  }
  if (
    requested.draftSnapshotId !== current.draftSnapshotId ||
    requested.draftRevision !== current.draftRevision ||
    requested.snapshotFingerprint !== current.snapshotFingerprint
  ) {
    return { code: "staleDraftAuthority", message: "The governed request targets a stale draft." };
  }
  if (
    requested.manifest.version !== current.manifest.version ||
    requested.manifest.fingerprint !== current.manifest.fingerprint
  ) {
    return {
      code: "staleManifestAuthority",
      message: "The generated capability manifest changed after the request was prepared.",
    };
  }
  if (
    requested.packageRegistry.version !== current.packageRegistry.version ||
    requested.packageRegistry.fingerprint !== current.packageRegistry.fingerprint
  ) {
    return {
      code: "staleRegistryAuthority",
      message: "The governed package registry changed after the request was prepared.",
    };
  }
  if (requested.componentRegistryFingerprint !== current.componentRegistryFingerprint) {
    return {
      code: "staleRegistryAuthority",
      message: "The registered component authority changed after the request was prepared.",
    };
  }
  if (requested.commerceFingerprint !== current.commerceFingerprint) {
    return {
      code: "staleCommerceAuthority",
      message: "Canonical commerce changed after the request was prepared.",
    };
  }
  if (requested.approvedAssetFingerprint !== current.approvedAssetFingerprint) {
    return {
      code: "staleApprovedAssetAuthority",
      message: "The approved asset authority changed after the request was prepared.",
    };
  }
  return undefined;
}

function mapCapabilityFailure(error: unknown): GovernedSkillPackageFailure {
  if (error instanceof SkillCapabilityKnowledgeError) {
    if (error.code === "unknownManifestVersion" || error.code === "staleManifestFingerprint") {
      return { code: "staleManifestAuthority", message: error.message };
    }
    if (error.code === "unknownProfile" || error.code === "incompatibleProfilePageType") {
      return { code: "staleProfileAuthority", message: error.message };
    }
    return { code: "invalidSlotSelection", message: error.message };
  }
  return {
    code: "invalidRequest",
    message: error instanceof Error ? error.message : "The governed request is invalid.",
  };
}

export type GovernedSkillPackageResolution = Readonly<{
  descriptor: GovernedSkillPackageDescriptor;
  requestedPackageId: string;
  alias: GovernedSkillPackageAlias | null;
}>;

export type GovernedInitialGenerationOutput = Readonly<{
  executionKind: "initialGeneration";
  authority: GovernedInitialGenerationAuthority;
  outputFingerprint: string;
}>;

export type GovernedFollowUpEditingOutput = Readonly<{
  executionKind: "followUpEditing";
  package: GovernedSkillPackageResolution;
  authority: GovernedFollowUpEditingAuthority;
  outputFingerprint: string;
}>;

export class GovernedSkillPackageRegistry {
  readonly #descriptors: ReadonlyMap<string, GovernedSkillPackageDescriptor>;
  readonly #aliases: ReadonlyMap<string, GovernedSkillPackageAlias>;
  readonly #consumer: SkillCapabilityKnowledgeConsumer;
  readonly version = GOVERNED_SKILL_PACKAGE_REGISTRY_VERSION;
  readonly fingerprint: string;

  constructor(
    input: Readonly<{
      descriptors?: readonly GovernedSkillPackageDescriptor[];
      aliases?: readonly GovernedSkillPackageAlias[];
      capabilityKnowledge?: SkillCapabilityKnowledgeConsumer;
    }> = {},
  ) {
    const descriptors = (input.descriptors ?? governedSkillPackageDescriptors).map((descriptor) =>
      deepFreeze(governedSkillPackageDescriptorSchema.parse(structuredClone(descriptor))),
    );
    const aliases = (input.aliases ?? governedSkillPackageAliases).map((alias) =>
      deepFreeze(governedSkillPackageAliasSchema.parse(structuredClone(alias))),
    );
    const descriptorIds = descriptors.map((descriptor) => descriptor.id);
    if (new Set(descriptorIds).size !== descriptorIds.length) {
      throw new GovernedSkillPackageError(
        "invalidRequest",
        "Canonical governed package IDs must be unique.",
      );
    }
    const aliasIds = aliases.map((alias) => alias.id);
    if (new Set(aliasIds).size !== aliasIds.length) {
      throw new GovernedSkillPackageError(
        "invalidRequest",
        "Governed package aliases must be unique.",
      );
    }
    const byId = new Map<string, GovernedSkillPackageDescriptor>(
      descriptors.map((descriptor) => [descriptor.id, descriptor]),
    );
    for (const alias of aliases) {
      if (descriptors.some((descriptor) => descriptor.id === alias.id)) {
        throw new GovernedSkillPackageError(
          "invalidRequest",
          `Compatibility alias ${alias.id} cannot be an independent canonical package.`,
        );
      }
      if (!byId.has(alias.canonicalPackageId)) {
        throw new GovernedSkillPackageError(
          "deprecatedPackageWithoutMigration",
          `Deprecated package ${alias.id} has no canonical migration target.`,
        );
      }
    }
    this.#descriptors = byId;
    this.#aliases = new Map(aliases.map((alias) => [alias.id, alias]));
    this.#consumer = input.capabilityKnowledge ?? skillCapabilityKnowledge;
    this.fingerprint = packageRegistryFingerprint(descriptors, aliases);
    deepFreeze(this);
  }

  capabilityManifestReference(): SkillCapabilityManifestReference {
    return this.#consumer.getManifestReference();
  }

  list(): readonly GovernedSkillPackageDescriptor[] {
    return immutableList(
      [...this.#descriptors.values()].sort((left, right) => left.id.localeCompare(right.id)),
    );
  }

  listAliases(): readonly GovernedSkillPackageAlias[] {
    return immutableList(
      [...this.#aliases.values()].sort((left, right) => left.id.localeCompare(right.id)),
    );
  }

  resolve(
    requestedPackageId: string,
    executionKind: GovernedSkillPackageExecutionKind,
  ): GovernedSkillPackageResolution {
    const direct = this.#descriptors.get(requestedPackageId);
    const alias = direct ? undefined : this.#aliases.get(requestedPackageId);
    const descriptor =
      direct ?? (alias ? this.#descriptors.get(alias.canonicalPackageId) : undefined);
    if (!descriptor) {
      throw new GovernedSkillPackageError(
        "unknownPackage",
        `Unknown governed skill package: ${requestedPackageId}.`,
      );
    }
    if (descriptor.executionKind !== executionKind) {
      throw new GovernedSkillPackageError(
        "invalidExecutionKind",
        `Package ${requestedPackageId} does not support ${executionKind}.`,
      );
    }
    return deepFreeze({ descriptor, requestedPackageId, alias: alias ?? null });
  }

  validateInitialGeneration(
    input: unknown,
    currentAuthority: GovernedSkillAuthorityEnvelope,
  ): GovernedSkillPackageValidationResult<GovernedInitialGenerationOutput> {
    try {
      const authority = governedInitialGenerationAuthoritySchema.parse(structuredClone(input));
      const stale = equivalentAuthority(authority.authority, currentAuthority);
      if (stale) return failure(stale.code, stale.message);
      if (
        authority.authority.packageRegistry.version !== this.version ||
        authority.authority.packageRegistry.fingerprint !== this.fingerprint
      ) {
        return failure("staleRegistryAuthority", "The governed package registry is stale.");
      }
      this.#consumer.listExecutableProfiles({ manifest: authority.authority.manifest });
      for (const profileAuthority of authority.profiles) {
        const profile = this.#consumer
          .listExecutableProfiles({
            manifest: authority.authority.manifest,
            pageType: profileAuthority.pageType,
          })
          .find((candidate) => candidate.profileId === profileAuthority.profileId);
        if (!profile || profile.fingerprint !== profileAuthority.fingerprint) {
          return failure(
            "staleProfileAuthority",
            `Executable PageBlueprint profile ${profileAuthority.profileId} is stale or unavailable.`,
          );
        }
      }
      const output = deepFreeze({
        executionKind: "initialGeneration" as const,
        authority: deepFreeze(authority),
        outputFingerprint: `governed-initial-generation-${canonicalValueFingerprint(authority)}`,
      });
      return success(output);
    } catch (error) {
      const mapped = mapCapabilityFailure(error);
      return failure(mapped.code, mapped.message);
    }
  }

  validateFollowUpEditing(
    input: unknown,
    currentAuthority: GovernedSkillAuthorityEnvelope,
  ): GovernedSkillPackageValidationResult<GovernedFollowUpEditingOutput> {
    try {
      const authority = governedFollowUpEditingAuthoritySchema.parse(structuredClone(input));
      const packageResolution = this.resolve(authority.packageId, authority.executionKind);
      if (authority.packageVersion !== packageResolution.descriptor.version) {
        return failure(
          "stalePackageAuthority",
          `Package ${authority.packageId} is not at the current governed version.`,
        );
      }
      if (authority.scope !== packageResolution.descriptor.scope) {
        return failure(
          "invalidScope",
          `Package ${authority.packageId} does not authorize ${authority.scope} scope.`,
        );
      }
      const stale = equivalentAuthority(authority.authority, currentAuthority);
      if (stale) return failure(stale.code, stale.message);
      if (
        authority.authority.packageRegistry.version !== this.version ||
        authority.authority.packageRegistry.fingerprint !== this.fingerprint
      ) {
        return failure("staleRegistryAuthority", "The governed package registry is stale.");
      }
      this.#consumer.listExecutableProfiles({ manifest: authority.authority.manifest });
      if (!packageResolution.descriptor.supportedPageTypes.includes(authority.page.pageType)) {
        return failure(
          "unsupportedPageType",
          `Package ${packageResolution.descriptor.id} does not support ${authority.page.pageType}.`,
        );
      }
      const declaredQueries = packageResolution.descriptor.requiredCapabilityQueries;
      if (!declaredQueries.includes("slotSelection") && authority.selections.length > 0) {
        return failure(
          "unauthorizedCapabilityReference",
          `Package ${authority.packageId} does not authorize component slot selections.`,
        );
      }
      if (!declaredQueries.includes("boundedParameter") && authority.boundedParameters.length > 0) {
        return failure(
          "unauthorizedCapabilityReference",
          `Package ${authority.packageId} does not authorize bounded parameter references.`,
        );
      }
      if (!declaredQueries.includes("canonicalBinding") && authority.bindings.length > 0) {
        return failure(
          "unauthorizedCapabilityReference",
          `Package ${authority.packageId} does not authorize canonical binding references.`,
        );
      }
      if (!declaredQueries.includes("approvedAsset") && authority.approvedAssets.length > 0) {
        return failure(
          "unauthorizedCapabilityReference",
          `Package ${authority.packageId} does not authorize approved asset references.`,
        );
      }
      if (
        packageResolution.descriptor.profileRequirement === "slotTarget" &&
        authority.page.profile === undefined
      ) {
        return failure(
          "missingProfileAuthority",
          `Package ${packageResolution.descriptor.id} requires an explicit executable profile and slot.`,
        );
      }
      const resolvedSelections = new Map<
        string,
        ReturnType<SkillCapabilityKnowledgeConsumer["resolveSelection"]>
      >();
      for (const selection of authority.selections) {
        const resolved = this.#consumer.resolveSelection({
          manifest: authority.authority.manifest,
          ...selection,
        });
        if (resolved.profile.pageType !== authority.page.pageType) {
          return failure(
            "staleProfileAuthority",
            `Selection ${selection.slotId} does not belong to the requested ${authority.page.pageType} page.`,
          );
        }
        if (
          authority.page.profile &&
          (authority.page.profile.profileId !== resolved.profile.profileId ||
            authority.page.profile.fingerprint !== resolved.profile.fingerprint ||
            authority.page.profile.pageType !== resolved.profile.pageType)
        ) {
          return failure(
            "staleProfileAuthority",
            `Selection ${selection.slotId} does not match the supplied executable profile authority.`,
          );
        }
        resolvedSelections.set(selection.slotId, resolved);
      }
      if (
        packageResolution.descriptor.profileRequirement === "slotTarget" &&
        resolvedSelections.size === 0
      ) {
        return failure(
          "missingProfileAuthority",
          `Package ${packageResolution.descriptor.id} requires a registered target slot.`,
        );
      }
      for (const parameter of authority.boundedParameters) {
        if (packageResolution.descriptor.parameterAuthority !== "registeredBoundedParameters") {
          return failure(
            "unsupportedBoundedParameter",
            `Package ${packageResolution.descriptor.id} does not authorize bounded parameters.`,
          );
        }
        const selection = resolvedSelections.get(parameter.targetSlotId);
        if (
          !selection ||
          !selection.component.boundedParameterIds.includes(parameter.parameterId)
        ) {
          return failure(
            "unsupportedBoundedParameter",
            `Bounded parameter ${parameter.parameterId} is not available for slot ${parameter.targetSlotId}.`,
          );
        }
        const result = this.#consumer.validateBoundedParameter({
          manifest: authority.authority.manifest,
          componentType: selection.component.componentType,
          parameterId: parameter.parameterId,
          value: parameter.value,
        });
        if (!result.valid) {
          return failure(
            "invalidBoundedParameter",
            `Bounded parameter ${parameter.parameterId} is not valid at instance authority.`,
          );
        }
      }
      for (const binding of authority.bindings) {
        const selection = resolvedSelections.get(binding.targetSlotId);
        const bindingSlot = selection?.component.requiredBindingSlots.find(
          (candidate) => candidate.slotId === binding.bindingSlotId,
        );
        if (!bindingSlot || !bindingSlot.acceptedSourceTypes.includes(binding.sourceType)) {
          return failure(
            "invalidCanonicalBinding",
            `Binding ${binding.bindingSlotId} is not registered for slot ${binding.targetSlotId}.`,
          );
        }
      }
      for (const asset of authority.approvedAssets) {
        if (packageResolution.descriptor.assetAuthority !== "approvedAssetReuse") {
          return failure(
            "unsupportedAssetAuthority",
            `Package ${packageResolution.descriptor.id} does not authorize approved asset reuse.`,
          );
        }
        if (authority.authority.approvedAssetFingerprint === null) {
          return failure(
            "staleApprovedAssetAuthority",
            "Approved asset references require current approved-asset authority.",
          );
        }
        const selection = resolvedSelections.get(asset.targetSlotId);
        const assetSlot = selection?.component.assetSlots.find(
          (candidate) => candidate.slotId === asset.assetSlotId,
        );
        if (
          !assetSlot ||
          !assetSlot.acceptedRoles.includes(asset.role) ||
          assetSlot.required !== asset.required
        ) {
          return failure(
            "invalidApprovedAssetReference",
            `Approved asset ${asset.assetId} is not compatible with slot ${asset.assetSlotId}.`,
          );
        }
      }
      const output = deepFreeze({
        executionKind: "followUpEditing" as const,
        package: packageResolution,
        authority: deepFreeze(authority),
        outputFingerprint: `governed-follow-up-editing-${canonicalValueFingerprint({
          registryFingerprint: this.fingerprint,
          packageId: packageResolution.descriptor.id,
          authority,
        })}`,
      });
      return success(output);
    } catch (error) {
      const mapped = mapCapabilityFailure(error);
      return failure(mapped.code, mapped.message);
    }
  }
}

export function createGovernedSkillPackageRegistry(
  input: ConstructorParameters<typeof GovernedSkillPackageRegistry>[0] = {},
) {
  return new GovernedSkillPackageRegistry(input);
}

export const governedSkillPackageRegistry = createGovernedSkillPackageRegistry();
