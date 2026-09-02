import { z } from "zod";
import {
  canonicalLocaleOrder,
  localeSchema,
  localeValues,
  type Locale,
} from "@/domain/shared/schemas";
import { assetRoleSchema } from "@/domain/shared/asset-role";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import {
  structuralStorefrontFamilyIdSchema,
  structuralStorefrontFamilyIdentityKey,
  structuralStorefrontFamilyIds,
  structuralStorefrontFamilyVersionSchema,
} from "@/domain/structural-storefront-family/identity";
import {
  MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY,
  MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_REQUIREMENTS_PER_REGION,
  MAX_PAGE_BLUEPRINT_V2_REGION_ASSET_REQUIREMENTS,
} from "./page-blueprint-v2-asset-role-contract";
import { createPageBlueprintV2CandidateAuthorityIdentityKey } from "./page-blueprint-v2-candidate-authority";
import {
  MAX_INACTIVE_PAGE_BLUEPRINT_V2_CANDIDATES,
  MAX_INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATES,
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  parseStructuralStorefrontFamilyCandidate,
  type InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  type StructuralStorefrontFamilyCandidateV1,
} from "./structural-storefront-family-candidate-registry";
import {
  pageBlueprintV2RecordVersionSchema,
  pageBlueprintV2RegionIdSchema,
  pageBlueprintV2StableIdSchema,
} from "./page-blueprint-v2-contract";
export const STRUCTURAL_STOREFRONT_CAPABILITY_CONTEXT_SCHEMA_VERSION = "1.0.0" as const;
export const STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_SCHEMA_VERSION = "1.0.0" as const;
export const INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION =
  "1.0.0" as const;
export const structuralStorefrontCompatibilityDimensions = Object.freeze([
  "catalogue-cardinality",
  "fact-depth",
  "product-complexity",
  "navigation-depth",
  "locale",
] as const);
export const structuralStorefrontCompatibilityDimensionSchema = z.enum(
  structuralStorefrontCompatibilityDimensions,
);
export type StructuralStorefrontCompatibilityDimension = z.infer<
  typeof structuralStorefrontCompatibilityDimensionSchema
>;
export const structuralStorefrontCatalogueCardinalityValues = Object.freeze([
  "sparse",
  "standard",
  "rich",
] as const);
export const structuralStorefrontFactDepthValues = structuralStorefrontCatalogueCardinalityValues;
export const structuralStorefrontProductComplexityValues = Object.freeze([
  "simple",
  "configurable",
  "mixed",
] as const);
export const structuralStorefrontNavigationDepthValues = Object.freeze([
  "shallow",
  "standard",
  "deep",
] as const);
export const structuralStorefrontCatalogueCardinalitySchema = z.enum(
  structuralStorefrontCatalogueCardinalityValues,
);
export const structuralStorefrontFactDepthSchema = z.enum(structuralStorefrontFactDepthValues);
export const structuralStorefrontProductComplexitySchema = z.enum(
  structuralStorefrontProductComplexityValues,
);
export const structuralStorefrontNavigationDepthSchema = z.enum(
  structuralStorefrontNavigationDepthValues,
);
export type StructuralStorefrontCompatibilityValue =
  | z.infer<typeof structuralStorefrontCatalogueCardinalitySchema>
  | z.infer<typeof structuralStorefrontProductComplexitySchema>
  | z.infer<typeof structuralStorefrontNavigationDepthSchema>
  | Locale;
const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const dimensionOrder = new Map(
  structuralStorefrontCompatibilityDimensions.map((dimension, index) => [dimension, index]),
);
const familyOrder = new Map(
  structuralStorefrontFamilyIds.map((familyId, index) => [familyId, index]),
);
const familyIdentityKey = (value: Readonly<{ familyId: string; familyVersion: string }>) =>
  structuralStorefrontFamilyIdentityKey({
    familyId: value.familyId,
    familyVersion: value.familyVersion,
  });
function compareVersions(left: string, right: string): number {
  const leftSegments = left.split(".");
  const rightSegments = right.split(".");
  for (let index = 0; index < leftSegments.length; index += 1) {
    const lengthDifference = leftSegments[index].length - rightSegments[index].length;
    if (lengthDifference !== 0) return lengthDifference;
    const valueDifference = compareCodeUnits(leftSegments[index], rightSegments[index]);
    if (valueDifference !== 0) return valueDifference;
  }
  return 0;
}
function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}
function duplicateValues(values: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort(compareCodeUnits);
}
function addDuplicates(
  values: readonly string[],
  path: (string | number)[],
  label: string,
  context: z.RefinementCtx,
): void {
  const duplicates = duplicateValues(values);
  if (duplicates.length > 0)
    context.addIssue({
      code: "custom",
      path,
      message: `Duplicate ${label}: ${duplicates.join(", ")}.`,
    });
}
const candidateFingerprintSchema = z
  .string()
  .regex(/^page-blueprint-v2-candidate-v1_[1-9][0-9]*_[0-9a-f]{64}$/u);
const familyCandidateFingerprintSchema = z
  .string()
  .regex(/^structural-storefront-family-candidate-v1_[1-9][0-9]*_[0-9a-f]{64}$/u);
export const structuralStorefrontCapabilityContextFingerprintSchema = z
  .string()
  .regex(/^structural-storefront-capability-context-v1_[1-9][0-9]*_[0-9a-f]{64}$/u);
export const structuralStorefrontFamilyCompatibilityProfileFingerprintSchema = z
  .string()
  .regex(/^structural-storefront-family-compatibility-profile-v1_[1-9][0-9]*_[0-9a-f]{64}$/u);
export const inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueFingerprintSchema = z
  .string()
  .regex(
    /^inactive-structural-storefront-family-compatibility-profile-catalogue-v1_[1-9][0-9]*_[0-9a-f]{64}$/u,
  );
export const pageBlueprintV2RequiredAssetRoleCapacityV1Schema = z
  .object({
    regionId: pageBlueprintV2RegionIdSchema,
    role: assetRoleSchema,
    satisfiableMinimumCapacity: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY),
  })
  .strict()
  .readonly();
export type PageBlueprintV2RequiredAssetRoleCapacityV1 = z.infer<
  typeof pageBlueprintV2RequiredAssetRoleCapacityV1Schema
>;
export const pageBlueprintV2RequiredAssetRoleCapacityEvidenceV1Schema = z
  .object({
    blueprintId: pageBlueprintV2StableIdSchema,
    blueprintVersion: pageBlueprintV2RecordVersionSchema,
    exactCandidateFingerprint: candidateFingerprintSchema,
    requiredRoleCapacities: z
      .array(pageBlueprintV2RequiredAssetRoleCapacityV1Schema)
      .max(
        MAX_PAGE_BLUEPRINT_V2_REGION_ASSET_REQUIREMENTS *
          MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_REQUIREMENTS_PER_REGION,
      )
      .readonly(),
  })
  .strict()
  .superRefine((evidence, context) =>
    addDuplicates(
      evidence.requiredRoleCapacities.map(({ regionId, role }) => `${regionId}:${role}`),
      ["requiredRoleCapacities"],
      "required region/role capacity evidence",
      context,
    ),
  )
  .readonly();
export type PageBlueprintV2RequiredAssetRoleCapacityEvidenceV1 = z.infer<
  typeof pageBlueprintV2RequiredAssetRoleCapacityEvidenceV1Schema
>;
const capabilityContextMaterialSchema = z
  .object({
    contextSchemaVersion: z.literal(STRUCTURAL_STOREFRONT_CAPABILITY_CONTEXT_SCHEMA_VERSION),
    catalogueCardinality: structuralStorefrontCatalogueCardinalitySchema,
    factDepth: structuralStorefrontFactDepthSchema,
    productComplexity: structuralStorefrontProductComplexitySchema,
    navigationDepth: structuralStorefrontNavigationDepthSchema,
    activeLocale: localeSchema,
    availableLocales: z.array(localeSchema).min(1).max(localeValues.length).readonly(),
    pageBlueprintAssetRoleCapacityEvidence: z
      .array(pageBlueprintV2RequiredAssetRoleCapacityEvidenceV1Schema)
      .max(MAX_INACTIVE_PAGE_BLUEPRINT_V2_CANDIDATES)
      .readonly(),
  })
  .strict()
  .superRefine((input, context) => {
    addDuplicates(input.availableLocales, ["availableLocales"], "available locales", context);
    addDuplicates(
      input.pageBlueprintAssetRoleCapacityEvidence.map(
        ({ blueprintId, blueprintVersion }) => `${blueprintId}@${blueprintVersion}`,
      ),
      ["pageBlueprintAssetRoleCapacityEvidence"],
      "candidate capacity evidence",
      context,
    );
    if (!input.availableLocales.includes(input.activeLocale)) {
      context.addIssue({
        code: "custom",
        path: ["activeLocale"],
        message: "Active locale must be present in available locales.",
      });
    }
  });
type CapabilityContextMaterial = z.infer<typeof capabilityContextMaterialSchema>;
export type StructuralStorefrontCapabilityContextV1 = Readonly<
  CapabilityContextMaterial & { contextFingerprint: string }
>;
function canonicalCapacityEvidence(
  registry: InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  supplied: readonly PageBlueprintV2RequiredAssetRoleCapacityEvidenceV1[],
): readonly PageBlueprintV2RequiredAssetRoleCapacityEvidenceV1[] {
  const suppliedByIdentity = new Map(
    supplied.map((entry) => [`${entry.blueprintId}@${entry.blueprintVersion}`, entry]),
  );
  const expectedIdentities = registry.pageBlueprintCandidates.map(
    createPageBlueprintV2CandidateAuthorityIdentityKey,
  );
  if (
    supplied.length !== expectedIdentities.length ||
    supplied.some(
      (entry) => !expectedIdentities.includes(`${entry.blueprintId}@${entry.blueprintVersion}`),
    )
  ) {
    throw new Error(
      "Capability context must contain evidence for every and only registry candidate.",
    );
  }
  return Object.freeze(
    registry.pageBlueprintCandidates.map((candidate) => {
      const identity = createPageBlueprintV2CandidateAuthorityIdentityKey(candidate);
      const entry = suppliedByIdentity.get(identity);
      if (!entry) throw new Error(`Missing required-role capacity evidence for ${identity}.`);
      if (entry.exactCandidateFingerprint !== candidate.candidateFingerprint) {
        throw new Error(
          `Required-role capacity evidence for ${identity} has a stale candidate fingerprint.`,
        );
      }
      const required = candidate.assetRoleCompatibility.regionAssetRequirements.flatMap(
        ({ regionId, roleRequirements }) =>
          roleRequirements
            .filter(({ requirement }) => requirement === "required")
            .map(({ role }) => ({ regionId, role })),
      );
      const capacityByKey = new Map(
        entry.requiredRoleCapacities.map((capacity) => [
          `${capacity.regionId}:${capacity.role}`,
          capacity.satisfiableMinimumCapacity,
        ]),
      );
      if (
        capacityByKey.size !== required.length ||
        required.some(({ regionId, role }) => !capacityByKey.has(`${regionId}:${role}`))
      ) {
        throw new Error(
          `Required-role capacity evidence for ${identity} is incomplete or contains extras.`,
        );
      }
      return pageBlueprintV2RequiredAssetRoleCapacityEvidenceV1Schema.parse({
        blueprintId: candidate.structural.id,
        blueprintVersion: candidate.structural.version,
        exactCandidateFingerprint: candidate.candidateFingerprint,
        requiredRoleCapacities: required.map(({ regionId, role }) => ({
          regionId,
          role,
          satisfiableMinimumCapacity: capacityByKey.get(`${regionId}:${role}`),
        })),
      });
    }),
  );
}
function canonicalCapabilityContext(
  registry: InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  input: CapabilityContextMaterial,
): StructuralStorefrontCapabilityContextV1 {
  const material = deepFreeze({
    ...input,
    availableLocales: canonicalLocaleOrder(input.availableLocales),
    pageBlueprintAssetRoleCapacityEvidence: canonicalCapacityEvidence(
      registry,
      input.pageBlueprintAssetRoleCapacityEvidence,
    ),
  });
  return deepFreeze({
    ...material,
    contextFingerprint: `structural-storefront-capability-context-${canonicalValueFingerprint(material)}`,
  });
}
export function createStructuralStorefrontCapabilityContext(
  registryInput: unknown,
  input: unknown,
): StructuralStorefrontCapabilityContextV1 {
  const registry = canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(registryInput);
  return canonicalCapabilityContext(registry, capabilityContextMaterialSchema.parse(input));
}
export function parseStructuralStorefrontCapabilityContext(
  registryInput: unknown,
  input: unknown,
): StructuralStorefrontCapabilityContextV1 {
  const supplied = capabilityContextMaterialSchema
    .extend({ contextFingerprint: structuralStorefrontCapabilityContextFingerprintSchema })
    .strict()
    .parse(input);
  const { contextFingerprint, ...material } = supplied;
  const canonical = createStructuralStorefrontCapabilityContext(registryInput, material);
  if (
    contextFingerprint !== canonical.contextFingerprint ||
    JSON.stringify(supplied) !== JSON.stringify(canonical)
  ) {
    throw new Error("Structural Storefront capability context is stale or noncanonical.");
  }
  return canonical;
}
const contextKeyByDimension = {
  "catalogue-cardinality": "catalogueCardinality",
  "fact-depth": "factDepth",
  "product-complexity": "productComplexity",
  "navigation-depth": "navigationDepth",
  locale: "activeLocale",
} as const;
export function structuralStorefrontCapabilityContextValue(
  context: StructuralStorefrontCapabilityContextV1,
  dimension: StructuralStorefrontCompatibilityDimension,
): StructuralStorefrontCompatibilityValue {
  return context[contextKeyByDimension[dimension]];
}
const policyVocabulary = {
  "catalogue-cardinality": structuralStorefrontCatalogueCardinalityValues,
  "fact-depth": structuralStorefrontFactDepthValues,
  "product-complexity": structuralStorefrontProductComplexityValues,
  "navigation-depth": structuralStorefrontNavigationDepthValues,
  locale: localeValues,
} as const;
function policySchema<Values extends readonly [string, ...string[]]>(
  dimension: StructuralStorefrontCompatibilityDimension,
  values: Values,
) {
  return z
    .object({
      dimension: z.literal(dimension),
      supportedValues: z.array(z.enum(values)).min(1).max(values.length).readonly(),
      incompatibleValues: z.array(z.enum(values)).max(values.length).readonly(),
    })
    .strict()
    .superRefine((policy, context) => {
      addDuplicates(policy.supportedValues, ["supportedValues"], "supported values", context);
      addDuplicates(
        policy.incompatibleValues,
        ["incompatibleValues"],
        "incompatible values",
        context,
      );
      const supported = new Set<string>(policy.supportedValues);
      const incompatible = new Set<string>(policy.incompatibleValues);
      const overlap = policy.supportedValues.filter((value) => incompatible.has(value));
      if (
        overlap.length > 0 ||
        values.some((value) => !supported.has(value) && !incompatible.has(value))
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Supported and incompatible values must form a complete disjoint vocabulary partition.",
        });
      }
    })
    .readonly();
}
const catalogueCardinalityPolicySchema = policySchema(
  "catalogue-cardinality",
  structuralStorefrontCatalogueCardinalityValues,
);
const factDepthPolicySchema = policySchema("fact-depth", structuralStorefrontFactDepthValues);
const productComplexityPolicySchema = policySchema(
  "product-complexity",
  structuralStorefrontProductComplexityValues,
);
const navigationDepthPolicySchema = policySchema(
  "navigation-depth",
  structuralStorefrontNavigationDepthValues,
);
const localePolicySchema = policySchema("locale", localeValues);
export const structuralStorefrontFamilyCompatibilityConditionPolicyV1Schema = z.discriminatedUnion(
  "dimension",
  [
    catalogueCardinalityPolicySchema,
    factDepthPolicySchema,
    productComplexityPolicySchema,
    navigationDepthPolicySchema,
    localePolicySchema,
  ],
);
export type StructuralStorefrontFamilyCompatibilityConditionPolicyV1 = z.infer<
  typeof structuralStorefrontFamilyCompatibilityConditionPolicyV1Schema
>;
const profileMaterialSchema = z
  .object({
    profileSchemaVersion: z.literal(
      STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_SCHEMA_VERSION,
    ),
    familyId: structuralStorefrontFamilyIdSchema,
    familyVersion: structuralStorefrontFamilyVersionSchema,
    exactFamilyCandidateFingerprint: familyCandidateFingerprintSchema,
    conditionPolicies: z
      .array(structuralStorefrontFamilyCompatibilityConditionPolicyV1Schema)
      .length(structuralStorefrontCompatibilityDimensions.length)
      .readonly(),
  })
  .strict()
  .superRefine((profile, context) =>
    addDuplicates(
      profile.conditionPolicies.map(({ dimension }) => dimension),
      ["conditionPolicies"],
      "compatibility dimensions",
      context,
    ),
  );
type ProfileMaterial = z.infer<typeof profileMaterialSchema>;
export type StructuralStorefrontFamilyCompatibilityProfileV1 = Readonly<
  ProfileMaterial & { profileFingerprint: string }
>;
function canonicalPolicy(
  policy: StructuralStorefrontFamilyCompatibilityConditionPolicyV1,
): StructuralStorefrontFamilyCompatibilityConditionPolicyV1 {
  const order = policyVocabulary[policy.dimension] as readonly string[];
  const supported = new Set<string>(policy.supportedValues);
  const incompatible = new Set<string>(policy.incompatibleValues);
  return structuralStorefrontFamilyCompatibilityConditionPolicyV1Schema.parse({
    dimension: policy.dimension,
    supportedValues: order.filter((value) => supported.has(value)),
    incompatibleValues: order.filter((value) => incompatible.has(value)),
  });
}
function canonicalProfile(
  materialInput: ProfileMaterial,
): StructuralStorefrontFamilyCompatibilityProfileV1 {
  const material = deepFreeze({
    ...materialInput,
    conditionPolicies: [...materialInput.conditionPolicies]
      .sort(
        (left, right) =>
          (dimensionOrder.get(left.dimension) ?? Infinity) -
          (dimensionOrder.get(right.dimension) ?? Infinity),
      )
      .map(canonicalPolicy),
  });
  return deepFreeze({
    ...material,
    profileFingerprint: `structural-storefront-family-compatibility-profile-${canonicalValueFingerprint(material)}`,
  });
}
function parseUnboundProfile(input: unknown): StructuralStorefrontFamilyCompatibilityProfileV1 {
  const supplied = profileMaterialSchema
    .extend({
      profileFingerprint: structuralStorefrontFamilyCompatibilityProfileFingerprintSchema,
    })
    .strict()
    .parse(input);
  const { profileFingerprint, ...material } = supplied;
  const canonical = canonicalProfile(material);
  if (
    profileFingerprint !== canonical.profileFingerprint ||
    JSON.stringify(supplied) !== JSON.stringify(canonical)
  ) {
    throw new Error("Structural Storefront Family compatibility profile is stale or noncanonical.");
  }
  return canonical;
}
function assertProfileBinding(
  candidate: StructuralStorefrontFamilyCandidateV1,
  profile: Pick<
    StructuralStorefrontFamilyCompatibilityProfileV1,
    "familyId" | "familyVersion" | "exactFamilyCandidateFingerprint"
  >,
): void {
  if (
    candidate.familyId !== profile.familyId ||
    candidate.familyVersion !== profile.familyVersion ||
    candidate.candidateFingerprint !== profile.exactFamilyCandidateFingerprint
  ) {
    throw new Error(
      "Compatibility profile must bind the exact Structural Storefront Family candidate.",
    );
  }
}
export function createStructuralStorefrontFamilyCompatibilityProfile(
  familyCandidateInput: unknown,
  input: unknown,
): StructuralStorefrontFamilyCompatibilityProfileV1 {
  const candidate = parseStructuralStorefrontFamilyCandidate(familyCandidateInput);
  const material = profileMaterialSchema.parse(input);
  assertProfileBinding(candidate, material);
  return canonicalProfile(material);
}
export function parseStructuralStorefrontFamilyCompatibilityProfile(
  familyCandidateInput: unknown,
  input: unknown,
): StructuralStorefrontFamilyCompatibilityProfileV1 {
  const candidate = parseStructuralStorefrontFamilyCandidate(familyCandidateInput);
  const profile = parseUnboundProfile(input);
  assertProfileBinding(candidate, profile);
  return profile;
}
const catalogueMaterialSchema = z
  .object({
    contractSchemaVersion: z.literal(
      INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
    ),
    profiles: z
      .array(z.unknown())
      .max(MAX_INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATES)
      .readonly(),
  })
  .strict();
type CatalogueMaterial = Readonly<{
  contractSchemaVersion: typeof INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION;
  profiles: readonly StructuralStorefrontFamilyCompatibilityProfileV1[];
}>;
export type InactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueV1 = Readonly<
  CatalogueMaterial & { catalogueFingerprint: string }
>;
function canonicalCatalogue(
  input: z.infer<typeof catalogueMaterialSchema>,
): InactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueV1 {
  const profiles = input.profiles.map(parseUnboundProfile);
  const identities = profiles.map(familyIdentityKey);
  const fingerprints = profiles.map(({ profileFingerprint }) => profileFingerprint);
  const duplicateIdentities = duplicateValues(identities);
  const duplicateFingerprints = duplicateValues(fingerprints);
  if (duplicateIdentities.length > 0 || duplicateFingerprints.length > 0) {
    throw new Error(
      "Compatibility-profile catalogue contains duplicate identity or fingerprint authority.",
    );
  }
  const material = deepFreeze({
    contractSchemaVersion: input.contractSchemaVersion,
    profiles: [...profiles].sort(
      (left, right) =>
        (familyOrder.get(left.familyId) ?? Infinity) -
          (familyOrder.get(right.familyId) ?? Infinity) ||
        compareVersions(left.familyVersion, right.familyVersion),
    ),
  });
  return deepFreeze({
    ...material,
    catalogueFingerprint: `inactive-structural-storefront-family-compatibility-profile-catalogue-${canonicalValueFingerprint(material)}`,
  });
}
export function createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue(
  input: unknown,
): InactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueV1 {
  return canonicalCatalogue(catalogueMaterialSchema.parse(input));
}
export function parseInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue(
  input: unknown,
): InactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueV1 {
  const supplied = catalogueMaterialSchema
    .extend({
      catalogueFingerprint:
        inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueFingerprintSchema,
    })
    .strict()
    .parse(input);
  const { catalogueFingerprint, ...material } = supplied;
  const canonical = canonicalCatalogue(material);
  if (
    catalogueFingerprint !== canonical.catalogueFingerprint ||
    JSON.stringify(supplied) !== JSON.stringify(canonical)
  ) {
    throw new Error("Compatibility-profile catalogue is stale or noncanonical.");
  }
  return canonical;
}
export function validateInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueBinding(
  registryInput: unknown,
  catalogueInput: unknown,
): InactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueV1 {
  const registry = canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(registryInput);
  const catalogue =
    parseInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue(catalogueInput);
  const profileByIdentity = new Map(
    catalogue.profiles.map((profile) => [familyIdentityKey(profile), profile]),
  );
  if (
    profileByIdentity.size !== registry.familyCandidates.length ||
    registry.familyCandidates.some((candidate) => {
      const profile = profileByIdentity.get(familyIdentityKey(candidate));
      return !profile || profile.exactFamilyCandidateFingerprint !== candidate.candidateFingerprint;
    })
  ) {
    throw new Error(
      "Compatibility-profile catalogue must exactly bind the inactive family registry.",
    );
  }
  return catalogue;
}
export const inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue =
  createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
    contractSchemaVersion:
      INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
    profiles: [],
  });
