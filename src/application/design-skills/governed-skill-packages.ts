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
const requestIdentitySchema = z.string().min(1).max(240);

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

export const governedSkillPackageOutputContractsSchema = z
  .object({
    initialGeneration: z.literal("wholeStorefrontPlanningInput.v1").optional(),
    followUpEditing: z.literal("governedFollowUpEditingAuthority.v1").optional(),
  })
  .strict();

export type GovernedSkillPackageOutputContracts = z.infer<
  typeof governedSkillPackageOutputContractsSchema
>;

export const governedSkillPackageDescriptorSchema = z
  .object({
    id: governedSkillPackageIdSchema,
    version: versionSchema,
    executionKinds: z.array(governedSkillPackageExecutionKindSchema).min(1),
    scope: governedSkillPackageScopeSchema,
    compatibility: z.object({ deprecated: z.literal(false) }).strict(),
    supportedPageTypes: z.array(pageTypeSchema).min(1),
    profileRequirement: governedProfileRequirementSchema,
    selectionConstraint: z.enum(["none", "canonicalHero"]),
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
    outputContracts: governedSkillPackageOutputContractsSchema,
  })
  .strict()
  .superRefine((descriptor, context) => {
    for (const [field, values] of [
      ["executionKinds", descriptor.executionKinds],
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
    const declaredExecutionKinds = descriptor.executionKinds.slice().sort();
    const contractExecutionKinds = Object.entries(descriptor.outputContracts)
      .filter(([, contract]) => contract !== undefined)
      .map(([executionKind]) => executionKind)
      .sort();
    if (
      declaredExecutionKinds.length !== contractExecutionKinds.length ||
      declaredExecutionKinds.some((kind, index) => kind !== contractExecutionKinds[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["outputContracts"],
        message: "Every supported execution kind must declare exactly one output contract.",
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
    projectRevision: z.number().int().nonnegative(),
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

export const governedInitialProfileAuthoritySchema = governedProfileAuthoritySchema
  .extend({
    pageId: idSchema,
    materializationFingerprint: fingerprintSchema,
  })
  .strict();

export type GovernedInitialProfileAuthority = z.infer<typeof governedInitialProfileAuthoritySchema>;

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

export const governedEditingPageAuthoritySchema = z
  .object({
    pageId: idSchema,
    pageType: pageTypeSchema,
    profile: governedProfileAuthoritySchema.optional(),
    selections: z.array(governedSkillSelectionSchema),
    boundedParameters: z.array(governedBoundedParameterIntentSchema).default([]),
    bindings: z.array(governedCanonicalBindingReferenceSchema).default([]),
    approvedAssets: z.array(governedApprovedAssetReferenceSchema).default([]),
  })
  .strict()
  .superRefine((page, context) => {
    const slotIds = page.selections.map((selection) => selection.slotId);
    if (new Set(slotIds).size !== slotIds.length) {
      context.addIssue({
        code: "custom",
        path: ["selections"],
        message: "Page-scoped capability selections must use unique profile slot IDs.",
      });
    }
  });

export type GovernedEditingPageAuthority = z.infer<typeof governedEditingPageAuthoritySchema>;

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
    profiles: z.array(governedInitialProfileAuthoritySchema).min(1),
    catalogueFingerprint: fingerprintSchema,
    registeredDirectionId: storefrontDesignDirectionIdSchema,
    outputContractId: z.literal("wholeStorefrontPlanningInput.v1"),
  })
  .strict()
  .superRefine((authority, context) => {
    for (const [label, values] of [
      ["pageId", authority.profiles.map((profile) => profile.pageId)],
      ["pageType", authority.profiles.map((profile) => profile.pageType)],
      ["profileId", authority.profiles.map((profile) => profile.profileId)],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: ["profiles"],
          message: `Initial-generation profile authorities must use unique ${label} values.`,
        });
      }
    }
  });

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
    pages: z.array(governedEditingPageAuthoritySchema),
  })
  .strict()
  .superRefine((request, context) => {
    const pageIds = request.pages.map((page) => page.pageId);
    if (new Set(pageIds).size !== pageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["pages"],
        message: "Follow-up page authorities must use unique canonical page IDs.",
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
  "staleLocaleAuthority",
  "staleRequestIdentityAuthority",
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

/**
 * v2 introduces per-execution output contracts. Consumers carrying the v1
 * authority envelope fail closed before parsing v2 descriptor metadata.
 */
export const GOVERNED_SKILL_PACKAGE_REGISTRY_VERSION = "2.0.0";

const protectedStateRestrictions = [
  "commerceReadOnly",
  "navigationReadOnly",
  "canonicalMediaReadOnly",
  "approvedAssetIdentityReadOnly",
] as const;

export const governedSkillPackageDescriptors = [
  {
    id: "applyRegisteredWholeStorefrontDirection",
    version: "1.2.0",
    executionKinds: ["initialGeneration", "followUpEditing"],
    scope: "completeStorefront",
    compatibility: { deprecated: false },
    supportedPageTypes: ["home", "collection", "product", "content", "cart", "checkout", "landing"],
    profileRequirement: "optional",
    selectionConstraint: "none",
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
    outputContracts: {
      initialGeneration: "wholeStorefrontPlanningInput.v1",
      followUpEditing: "governedFollowUpEditingAuthority.v1",
    },
  },
  {
    id: "applyExactBrandPalette",
    version: "1.0.0",
    executionKinds: ["followUpEditing"],
    scope: "designSystem",
    compatibility: { deprecated: false },
    supportedPageTypes: ["home", "collection", "product", "content", "cart", "checkout", "landing"],
    profileRequirement: "none",
    selectionConstraint: "none",
    requiredCapabilityQueries: ["capabilityManifest"],
    requiredAuthorityFingerprints: ["capabilityManifest", "commerce", "approvedAssets", "draft"],
    parameterAuthority: "none",
    assetAuthority: "none",
    protectedStateRestrictions: [...protectedStateRestrictions],
    outputContracts: { followUpEditing: "governedFollowUpEditingAuthority.v1" },
  },
  {
    id: "improveHero",
    version: "1.0.0",
    executionKinds: ["followUpEditing"],
    scope: "selectedSection",
    compatibility: { deprecated: false },
    supportedPageTypes: ["home", "landing"],
    profileRequirement: "slotTarget",
    selectionConstraint: "canonicalHero",
    requiredCapabilityQueries: [
      "capabilityManifest",
      "executableProfile",
      "slotSelection",
      "boundedParameter",
      "canonicalBinding",
      "approvedAsset",
    ],
    requiredAuthorityFingerprints: ["capabilityManifest", "componentRegistry", "commerce", "draft"],
    parameterAuthority: "registeredBoundedParameters",
    assetAuthority: "approvedAssetReuse",
    protectedStateRestrictions: [...protectedStateRestrictions],
    outputContracts: { followUpEditing: "governedFollowUpEditingAuthority.v1" },
  },
  {
    id: "addCampaignSection",
    version: "1.0.0",
    executionKinds: ["followUpEditing"],
    scope: "currentPage",
    compatibility: { deprecated: false },
    supportedPageTypes: ["home", "landing"],
    profileRequirement: "optional",
    selectionConstraint: "none",
    requiredCapabilityQueries: [
      "capabilityManifest",
      "executableProfile",
      "slotSelection",
      "boundedParameter",
      "canonicalBinding",
      "approvedAsset",
    ],
    requiredAuthorityFingerprints: ["capabilityManifest", "commerce", "approvedAssets", "draft"],
    parameterAuthority: "registeredBoundedParameters",
    assetAuthority: "approvedAssetReuse",
    protectedStateRestrictions: [...protectedStateRestrictions],
    outputContracts: { followUpEditing: "governedFollowUpEditingAuthority.v1" },
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
  if (
    requested.projectId !== current.projectId ||
    requested.projectRevision !== current.projectRevision
  ) {
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
  if (requested.locale !== current.locale) {
    return {
      code: "staleLocaleAuthority",
      message: "The governed request was prepared for a different locale.",
    };
  }
  if (requested.requestIdentity !== current.requestIdentity) {
    return {
      code: "staleRequestIdentityAuthority",
      message: "The governed request identity is stale.",
    };
  }
  return undefined;
}

function mapCapabilityFailure(error: unknown): GovernedSkillPackageFailure {
  if (error instanceof GovernedSkillPackageError) {
    return { code: error.code, message: error.message };
  }
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

function compareCanonicalStrings(left: string, right: string) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function normalizeFollowUpAuthority(
  authority: GovernedFollowUpEditingAuthority,
): GovernedFollowUpEditingAuthority {
  return {
    ...authority,
    pages: authority.pages
      .map((page) => ({
        ...page,
        selections: [...page.selections].sort((left, right) =>
          compareCanonicalStrings(left.slotId, right.slotId),
        ),
        boundedParameters: [...page.boundedParameters].sort((left, right) =>
          compareCanonicalStrings(
            `${left.targetSlotId}:${left.parameterId}`,
            `${right.targetSlotId}:${right.parameterId}`,
          ),
        ),
        bindings: [...page.bindings].sort((left, right) =>
          compareCanonicalStrings(
            `${left.targetSlotId}:${left.bindingSlotId}`,
            `${right.targetSlotId}:${right.bindingSlotId}`,
          ),
        ),
        approvedAssets: [...page.approvedAssets].sort((left, right) =>
          compareCanonicalStrings(
            `${left.targetSlotId}:${left.assetSlotId}:${left.assetId}:${left.revision}`,
            `${right.targetSlotId}:${right.assetSlotId}:${right.assetId}:${right.revision}`,
          ),
        ),
      }))
      .sort((left, right) => compareCanonicalStrings(left.pageId, right.pageId)),
  };
}

function normalizeInitialGenerationAuthority(
  authority: GovernedInitialGenerationAuthority,
): GovernedInitialGenerationAuthority {
  return {
    ...authority,
    profiles: [...authority.profiles].sort((left, right) =>
      compareCanonicalStrings(
        `${left.pageType}:${left.pageId}:${left.profileId}`,
        `${right.pageType}:${right.pageId}:${right.profileId}`,
      ),
    ),
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
    if (alias && executionKind === "initialGeneration") {
      throw new GovernedSkillPackageError(
        "invalidExecutionKind",
        `Deprecated package ${requestedPackageId} does not support initial generation.`,
      );
    }
    if (!descriptor.executionKinds.includes(executionKind)) {
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
      const authority = normalizeInitialGenerationAuthority(
        governedInitialGenerationAuthoritySchema.parse(structuredClone(input)),
      );
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
      const authority = normalizeFollowUpAuthority(
        governedFollowUpEditingAuthoritySchema.parse(structuredClone(input)),
      );
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
      const requiresOnePage = ["selectedSection", "currentPage"].includes(
        packageResolution.descriptor.scope,
      );
      if (requiresOnePage && authority.pages.length !== 1) {
        return failure(
          "invalidScope",
          `Package ${authority.packageId} requires exactly one page-scoped authority.`,
        );
      }
      if (
        packageResolution.descriptor.scope === "completeStorefront" &&
        authority.pages.length === 0
      ) {
        return failure(
          "invalidScope",
          `Package ${authority.packageId} requires one or more declared page authorities.`,
        );
      }
      const declaredQueries = packageResolution.descriptor.requiredCapabilityQueries;
      for (const page of authority.pages) {
        if (!packageResolution.descriptor.supportedPageTypes.includes(page.pageType)) {
          return failure(
            "unsupportedPageType",
            `Package ${packageResolution.descriptor.id} does not support ${page.pageType} pages.`,
          );
        }
        if (!declaredQueries.includes("slotSelection") && page.selections.length > 0) {
          return failure(
            "unauthorizedCapabilityReference",
            `Package ${authority.packageId} does not authorize component slot selections.`,
          );
        }
        if (!declaredQueries.includes("boundedParameter") && page.boundedParameters.length > 0) {
          return failure(
            "unauthorizedCapabilityReference",
            `Package ${authority.packageId} does not authorize bounded parameter references.`,
          );
        }
        if (!declaredQueries.includes("canonicalBinding") && page.bindings.length > 0) {
          return failure(
            "unauthorizedCapabilityReference",
            `Package ${authority.packageId} does not authorize canonical binding references.`,
          );
        }
        if (!declaredQueries.includes("approvedAsset") && page.approvedAssets.length > 0) {
          return failure(
            "unauthorizedCapabilityReference",
            `Package ${authority.packageId} does not authorize approved asset references.`,
          );
        }
        if (
          packageResolution.descriptor.profileRequirement === "slotTarget" &&
          page.profile === undefined
        ) {
          return failure(
            "missingProfileAuthority",
            `Package ${packageResolution.descriptor.id} requires an explicit executable profile and slot.`,
          );
        }
        const declaredProfile = page.profile
          ? this.#consumer
              .listExecutableProfiles({
                manifest: authority.authority.manifest,
                pageType: page.pageType,
              })
              .find((profile) => profile.profileId === page.profile?.profileId)
          : undefined;
        if (
          page.profile &&
          (!declaredProfile ||
            declaredProfile.fingerprint !== page.profile.fingerprint ||
            declaredProfile.pageType !== page.profile.pageType)
        ) {
          return failure(
            "staleProfileAuthority",
            `Executable PageBlueprint profile ${page.profile.profileId} is stale or unavailable for page ${page.pageId}.`,
          );
        }
        const resolvedSelections = new Map<
          string,
          ReturnType<SkillCapabilityKnowledgeConsumer["resolveSelection"]>
        >();
        for (const selection of page.selections) {
          const resolved = this.#consumer.resolveSelection({
            manifest: authority.authority.manifest,
            ...selection,
          });
          if (resolved.profile.pageType !== page.pageType) {
            return failure(
              "staleProfileAuthority",
              `Selection ${selection.slotId} does not belong to page ${page.pageId}.`,
            );
          }
          if (
            declaredProfile &&
            (declaredProfile.profileId !== resolved.profile.profileId ||
              declaredProfile.fingerprint !== resolved.profile.fingerprint)
          ) {
            return failure(
              "staleProfileAuthority",
              `Selection ${selection.slotId} does not match page ${page.pageId} profile authority.`,
            );
          }
          if (
            packageResolution.descriptor.selectionConstraint === "canonicalHero" &&
            !(resolved.slotId === "hero" && resolved.component.componentType === "homepageHero")
          ) {
            return failure(
              "invalidSlotSelection",
              `Package ${authority.packageId} can target only a registered hero slot.`,
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
        for (const parameter of page.boundedParameters) {
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
        for (const binding of page.bindings) {
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
        const assetsBySlot = new Map<string, { count: number; assetIds: Set<string> }>();
        for (const asset of page.approvedAssets) {
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
          const key = `${asset.targetSlotId}:${asset.assetSlotId}`;
          const group = assetsBySlot.get(key) ?? { count: 0, assetIds: new Set<string>() };
          const assetIdentity = `${asset.assetId}:${asset.revision}:${asset.materialFingerprint}`;
          if (group.assetIds.has(assetIdentity)) {
            return failure(
              "invalidApprovedAssetReference",
              `Approved asset ${asset.assetId} is duplicated for slot ${asset.assetSlotId}.`,
            );
          }
          group.assetIds.add(assetIdentity);
          group.count += 1;
          assetsBySlot.set(key, group);
        }
        for (const [selectionId, selection] of resolvedSelections) {
          for (const assetSlot of selection.component.assetSlots) {
            const count = assetsBySlot.get(`${selectionId}:${assetSlot.slotId}`)?.count ?? 0;
            if (
              count < assetSlot.minItems ||
              count > (assetSlot.maxItems ?? Number.MAX_SAFE_INTEGER)
            ) {
              return failure(
                "invalidApprovedAssetReference",
                `Approved asset cardinality is invalid for slot ${assetSlot.slotId}.`,
              );
            }
          }
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
