import { z } from "zod";
import { assetRoleSchema } from "@/domain/shared/asset-role";
import { localeSchema } from "@/domain/shared/schemas";
import {
  canonicalValueFingerprint,
  canonicalValueString,
} from "@/domain/storefront/canonical-storefront";
import {
  structuralStorefrontFamilyIdentityKey,
  structuralStorefrontPageFamilyIdSchema,
  structuralStorefrontPageFamilyIds,
} from "@/domain/structural-storefront-family";
import {
  MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY,
  MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_REQUIREMENTS_PER_REGION,
} from "./page-blueprint-v2-asset-role-contract";
import {
  createPageBlueprintV2CandidateAuthorityIdentityKey,
  createPageBlueprintV2CandidateReferenceIdentityKey,
} from "./page-blueprint-v2-candidate-authority";
import {
  MAX_PAGE_BLUEPRINT_V2_REGIONS,
  pageBlueprintV2RegionIdSchema,
} from "./page-blueprint-v2-contract";
import { pageBlueprintV2NormalizedTopologyFingerprintSchema } from "./page-blueprint-v2-normalized-topology";
import {
  deriveInactiveCandidateNormalizedTopologyIndex,
  structuralStorefrontFamilyNormalizedTopologyFingerprintSchema,
  type InactiveCandidateNormalizedTopologyIndexV1,
} from "./structural-storefront-family-normalized-topology";
import {
  MAX_INACTIVE_PAGE_BLUEPRINT_V2_CANDIDATES,
  MAX_INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATES,
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  type InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  type StructuralStorefrontFamilyCandidateV1,
} from "./structural-storefront-family-candidate-registry";
import {
  inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueFingerprintSchema,
  parseStructuralStorefrontCapabilityContext,
  structuralStorefrontCapabilityContextValue,
  structuralStorefrontCapabilityContextFingerprintSchema,
  structuralStorefrontCatalogueCardinalitySchema,
  structuralStorefrontCompatibilityDimensions,
  structuralStorefrontFactDepthSchema,
  structuralStorefrontFamilyCompatibilityProfileFingerprintSchema,
  structuralStorefrontNavigationDepthSchema,
  structuralStorefrontProductComplexitySchema,
  validateInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueBinding,
  type StructuralStorefrontCapabilityContextV1,
  type StructuralStorefrontFamilyCompatibilityProfileV1,
} from "./structural-storefront-compatibility-contract";
export const STRUCTURAL_STOREFRONT_CANDIDATE_COMPATIBILITY_EVALUATION_SCHEMA_VERSION =
  "1.0.0" as const;
export const pageBlueprintV2CandidateCompatibilityStatuses = Object.freeze([
  "directly-compatible",
  "substitution-compatible",
  "omission-compatible",
  "incompatible",
] as const);
export const pageBlueprintV2CandidateCompatibilityStatusSchema = z.enum(
  pageBlueprintV2CandidateCompatibilityStatuses,
);
export type PageBlueprintV2CandidateCompatibilityStatus = z.infer<
  typeof pageBlueprintV2CandidateCompatibilityStatusSchema
>;
export const pageBlueprintV2CandidateCompatibilityTerminalDispositions = Object.freeze([
  "not-needed",
  "substitution-candidates-available",
  "omit-triggered-regions",
  "fail-closed",
] as const);
export const pageBlueprintV2CandidateCompatibilityTerminalDispositionSchema = z.enum(
  pageBlueprintV2CandidateCompatibilityTerminalDispositions,
);
const dispositionByStatus = {
  "directly-compatible": "not-needed",
  "substitution-compatible": "substitution-candidates-available",
  "omission-compatible": "omit-triggered-regions",
  incompatible: "fail-closed",
} as const;
export const structuralStorefrontFamilyCandidateCompatibilityStatuses = Object.freeze([
  "directly-compatible",
  "conditionally-compatible",
  "incompatible",
] as const);
export const structuralStorefrontFamilyCandidateCompatibilityStatusSchema = z.enum(
  structuralStorefrontFamilyCandidateCompatibilityStatuses,
);
export type StructuralStorefrontFamilyCandidateCompatibilityStatus = z.infer<
  typeof structuralStorefrontFamilyCandidateCompatibilityStatusSchema
>;
const exactIdentityKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*@1\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u);
const pageCandidateFingerprintSchema = z
  .string()
  .regex(/^page-blueprint-v2-candidate-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);
const familyCandidateFingerprintSchema = z
  .string()
  .regex(/^structural-storefront-family-candidate-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);
const registryAuthorityFingerprintSchema = z.string().regex(/^v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);
export const pageBlueprintV2RequiredAssetRoleCompatibilityEvaluationV1Schema = z
  .object({
    regionId: pageBlueprintV2RegionIdSchema,
    role: assetRoleSchema,
    requiredMinimum: z.number().int().positive().max(MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY),
    satisfiableMinimumCapacity: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY),
    satisfied: z.boolean(),
  })
  .strict()
  .superRefine((evaluation, context) => {
    if (
      evaluation.satisfied !==
      evaluation.satisfiableMinimumCapacity >= evaluation.requiredMinimum
    ) {
      context.addIssue({ code: "custom", path: ["satisfied"], message: "Capacity mismatch." });
    }
  })
  .readonly();
export const pageBlueprintV2CandidateCompatibilityEvaluationV1Schema = z
  .object({
    candidateIdentityKey: exactIdentityKeySchema,
    exactCandidateFingerprint: pageCandidateFingerprintSchema,
    normalizedTopologyFingerprint: pageBlueprintV2NormalizedTopologyFingerprintSchema,
    requiredRoleEvaluations: z
      .array(pageBlueprintV2RequiredAssetRoleCompatibilityEvaluationV1Schema)
      .max(MAX_PAGE_BLUEPRINT_V2_REGIONS * MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_REQUIREMENTS_PER_REGION)
      .readonly(),
    triggeredRegionIds: z
      .array(pageBlueprintV2RegionIdSchema)
      .max(MAX_PAGE_BLUEPRINT_V2_REGIONS)
      .readonly(),
    compatibleSubstitutionCandidateIdentityKeys: z
      .array(exactIdentityKeySchema)
      .max(MAX_INACTIVE_PAGE_BLUEPRINT_V2_CANDIDATES)
      .readonly(),
    terminalDisposition: pageBlueprintV2CandidateCompatibilityTerminalDispositionSchema,
    status: pageBlueprintV2CandidateCompatibilityStatusSchema,
  })
  .strict()
  .superRefine((evaluation, context) => {
    const allSatisfied = evaluation.requiredRoleEvaluations.every(({ satisfied }) => satisfied);
    const hasCompatibleSubstitutions =
      evaluation.compatibleSubstitutionCandidateIdentityKeys.length > 0;
    const diagnosticsAgree =
      evaluation.terminalDisposition === dispositionByStatus[evaluation.status] &&
      (evaluation.status === "directly-compatible") === allSatisfied &&
      (evaluation.status === "substitution-compatible") === hasCompatibleSubstitutions &&
      (evaluation.status === "directly-compatible" || evaluation.triggeredRegionIds.length > 0);
    if (!diagnosticsAgree) {
      context.addIssue({ code: "custom", message: "Page diagnostics contradict status." });
    }
  })
  .readonly();
export type PageBlueprintV2CandidateCompatibilityEvaluationV1 = z.infer<
  typeof pageBlueprintV2CandidateCompatibilityEvaluationV1Schema
>;
const conditionOutcomeSchema = z.enum(["supported", "incompatible"]);
const conditionEvaluationSchema = z.discriminatedUnion("dimension", [
  z
    .object({
      dimension: z.literal("catalogue-cardinality"),
      actualValue: structuralStorefrontCatalogueCardinalitySchema,
      outcome: conditionOutcomeSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      dimension: z.literal("fact-depth"),
      actualValue: structuralStorefrontFactDepthSchema,
      outcome: conditionOutcomeSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      dimension: z.literal("product-complexity"),
      actualValue: structuralStorefrontProductComplexitySchema,
      outcome: conditionOutcomeSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      dimension: z.literal("navigation-depth"),
      actualValue: structuralStorefrontNavigationDepthSchema,
      outcome: conditionOutcomeSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      dimension: z.literal("locale"),
      actualValue: localeSchema,
      outcome: conditionOutcomeSchema,
    })
    .strict()
    .readonly(),
]);
const pageFamilyCandidateStatusSchema = z
  .object({
    candidateIdentityKey: exactIdentityKeySchema,
    status: pageBlueprintV2CandidateCompatibilityStatusSchema,
  })
  .strict()
  .readonly();
const pageFamilyEvaluationSchema = z
  .object({
    pageFamilyId: structuralStorefrontPageFamilyIdSchema,
    candidateStatuses: z.array(pageFamilyCandidateStatusSchema).min(1).readonly(),
    directlyCompatibleCandidateIdentityKeys: z.array(exactIdentityKeySchema).readonly(),
    conditionallyCompatibleCandidateIdentityKeys: z.array(exactIdentityKeySchema).readonly(),
    incompatibleCandidateIdentityKeys: z.array(exactIdentityKeySchema).readonly(),
  })
  .strict()
  .readonly();
export const structuralStorefrontFamilyCandidateCompatibilityEvaluationV1Schema = z
  .object({
    candidateIdentityKey: exactIdentityKeySchema,
    exactCandidateFingerprint: familyCandidateFingerprintSchema,
    normalizedTopologyFingerprint: structuralStorefrontFamilyNormalizedTopologyFingerprintSchema,
    compatibilityProfileFingerprint:
      structuralStorefrontFamilyCompatibilityProfileFingerprintSchema,
    conditionEvaluations: z
      .array(conditionEvaluationSchema)
      .length(structuralStorefrontCompatibilityDimensions.length)
      .readonly(),
    pageFamilyEvaluations: z
      .array(pageFamilyEvaluationSchema)
      .length(structuralStorefrontPageFamilyIds.length)
      .readonly(),
    incompatibleConditionDimensions: z
      .array(z.enum(structuralStorefrontCompatibilityDimensions))
      .max(structuralStorefrontCompatibilityDimensions.length)
      .readonly(),
    incompatiblePageFamilyIds: z
      .array(structuralStorefrontPageFamilyIdSchema)
      .max(structuralStorefrontPageFamilyIds.length)
      .readonly(),
    status: structuralStorefrontFamilyCandidateCompatibilityStatusSchema,
  })
  .strict()
  .readonly();
export type StructuralStorefrontFamilyCandidateCompatibilityEvaluationV1 = z.infer<
  typeof structuralStorefrontFamilyCandidateCompatibilityEvaluationV1Schema
>;
export const structuralStorefrontCandidateCompatibilityEvaluationFingerprintSchema = z
  .string()
  .regex(
    /^structural-storefront-candidate-compatibility-evaluation-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u,
  );
const evaluationMaterialShape = {
  evaluationSchemaVersion: z.literal(
    STRUCTURAL_STOREFRONT_CANDIDATE_COMPATIBILITY_EVALUATION_SCHEMA_VERSION,
  ),
  registryAuthorityFingerprint: registryAuthorityFingerprintSchema,
  capabilityContextFingerprint: structuralStorefrontCapabilityContextFingerprintSchema,
  profileCatalogueFingerprint:
    inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueFingerprintSchema,
  pageBlueprintEvaluations: z
    .array(pageBlueprintV2CandidateCompatibilityEvaluationV1Schema)
    .max(MAX_INACTIVE_PAGE_BLUEPRINT_V2_CANDIDATES)
    .readonly(),
  familyEvaluations: z
    .array(structuralStorefrontFamilyCandidateCompatibilityEvaluationV1Schema)
    .max(MAX_INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATES)
    .readonly(),
} as const;
export const structuralStorefrontCandidateCompatibilityEvaluationV1Schema = z
  .object({
    ...evaluationMaterialShape,
    evaluationFingerprint: structuralStorefrontCandidateCompatibilityEvaluationFingerprintSchema,
  })
  .strict()
  .readonly();
export type StructuralStorefrontCandidateCompatibilityEvaluationV1 = z.infer<
  typeof structuralStorefrontCandidateCompatibilityEvaluationV1Schema
>;
const evaluatorInputSchema = z
  .object({
    candidateRegistry: z.unknown(),
    normalizedTopologyIndex: z.unknown(),
    capabilityContext: z.unknown(),
    compatibilityProfileCatalogue: z.unknown(),
  })
  .strict();
export type StructuralStorefrontCandidateCompatibilityEvaluatorInput = z.infer<
  typeof evaluatorInputSchema
>;
function isExactJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value))
    return Reflect.ownKeys(value).length === value.length + 1 && value.every(isExactJsonValue);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return (
    Reflect.ownKeys(value).length === Object.keys(value).length &&
    Object.values(value).every(isExactJsonValue)
  );
}
function assertExactTopologyIndex(
  registry: InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  supplied: unknown,
): InactiveCandidateNormalizedTopologyIndexV1 {
  const expected = deriveInactiveCandidateNormalizedTopologyIndex(registry);
  if (
    !isExactJsonValue(supplied) ||
    canonicalValueString(supplied) !== canonicalValueString(expected)
  ) {
    throw new Error("Normalized-topology index must exactly match deterministic A-08A authority.");
  }
  return expected;
}
const familyIdentityKey = (value: Readonly<{ familyId: string; familyVersion: string }>) =>
  structuralStorefrontFamilyIdentityKey({
    familyId: value.familyId,
    familyVersion: value.familyVersion,
  });
function createPageBlueprintEvaluator(
  registry: InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  topology: InactiveCandidateNormalizedTopologyIndexV1,
  capabilityContext: StructuralStorefrontCapabilityContextV1,
) {
  const candidateByIdentity = new Map(
    registry.pageBlueprintCandidates.map((candidate) => [
      createPageBlueprintV2CandidateAuthorityIdentityKey(candidate),
      candidate,
    ]),
  );
  const topologyByIdentity = new Map(
    topology.pageBlueprintEntries.map((entry) => [entry.candidateIdentityKey, entry]),
  );
  const evidenceByIdentity = new Map(
    capabilityContext.pageBlueprintAssetRoleCapacityEvidence.map((entry) => [
      `${entry.blueprintId}@${entry.blueprintVersion}`,
      entry,
    ]),
  );
  const memo = new Map<string, PageBlueprintV2CandidateCompatibilityEvaluationV1>();
  const evaluate = (identityKey: string): PageBlueprintV2CandidateCompatibilityEvaluationV1 => {
    const cached = memo.get(identityKey);
    if (cached) return cached;
    const candidate = candidateByIdentity.get(identityKey);
    const topologyEntry = topologyByIdentity.get(identityKey);
    const evidence = evidenceByIdentity.get(identityKey);
    if (!candidate || !topologyEntry || !evidence) {
      throw new Error(`Validated compatibility authority is missing ${identityKey}.`);
    }
    const capacityByRole = new Map(
      evidence.requiredRoleCapacities.map((capacity) => [
        `${capacity.regionId}\u0000${capacity.role}`,
        capacity.satisfiableMinimumCapacity,
      ]),
    );
    const requiredRoleEvaluations =
      candidate.assetRoleCompatibility.regionAssetRequirements.flatMap(
        ({ regionId, roleRequirements }) =>
          roleRequirements
            .filter(({ requirement }) => requirement === "required")
            .map(({ role, cardinality }) => {
              const satisfiableMinimumCapacity = capacityByRole.get(`${regionId}\u0000${role}`);
              if (satisfiableMinimumCapacity === undefined) {
                throw new Error(`Validated compatibility capacity is missing ${identityKey}.`);
              }
              return {
                regionId,
                role,
                requiredMinimum: cardinality.minimum,
                satisfiableMinimumCapacity,
                satisfied: satisfiableMinimumCapacity >= cardinality.minimum,
              };
            }),
      );
    const triggeredRegionIds = [
      ...new Set(
        requiredRoleEvaluations
          .filter(({ satisfied }) => !satisfied)
          .map(({ regionId }) => regionId),
      ),
    ];
    const directlyCompatible = triggeredRegionIds.length === 0;
    let compatibleSubstitutionCandidateIdentityKeys: string[] = [];
    if (!directlyCompatible) {
      compatibleSubstitutionCandidateIdentityKeys =
        candidate.omissionSubstitutionFallback.blueprintSubstitutionCandidates
          .map(createPageBlueprintV2CandidateReferenceIdentityKey)
          .filter((targetIdentityKey) => evaluate(targetIdentityKey).status !== "incompatible");
    }
    const allTriggeredRegionsOmittable = triggeredRegionIds.every((regionId) =>
      candidate.omissionSubstitutionFallback.regionFallbackRules.some(
        (rule) => rule.regionId === regionId && rule.terminalResolution === "omit-region",
      ),
    );
    const status: PageBlueprintV2CandidateCompatibilityStatus = directlyCompatible
      ? "directly-compatible"
      : compatibleSubstitutionCandidateIdentityKeys.length > 0
        ? "substitution-compatible"
        : allTriggeredRegionsOmittable
          ? "omission-compatible"
          : "incompatible";
    const result = pageBlueprintV2CandidateCompatibilityEvaluationV1Schema.parse({
      candidateIdentityKey: identityKey,
      exactCandidateFingerprint: candidate.candidateFingerprint,
      normalizedTopologyFingerprint: topologyEntry.normalizedTopology.topologyFingerprint,
      requiredRoleEvaluations,
      triggeredRegionIds,
      compatibleSubstitutionCandidateIdentityKeys,
      terminalDisposition: dispositionByStatus[status],
      status,
    });
    memo.set(identityKey, result);
    return result;
  };
  return evaluate;
}
function evaluateFamily(
  family: StructuralStorefrontFamilyCandidateV1,
  profile: StructuralStorefrontFamilyCompatibilityProfileV1,
  normalizedTopologyFingerprint: string,
  context: StructuralStorefrontCapabilityContextV1,
  pageEvaluations: ReadonlyMap<string, PageBlueprintV2CandidateCompatibilityEvaluationV1>,
): StructuralStorefrontFamilyCandidateCompatibilityEvaluationV1 {
  const conditionEvaluations = profile.conditionPolicies.map((policy) => {
    const actualValue = structuralStorefrontCapabilityContextValue(context, policy.dimension);
    const outcome = (policy.supportedValues as readonly string[]).includes(actualValue)
      ? "supported"
      : "incompatible";
    return { dimension: policy.dimension, actualValue, outcome };
  });
  const pageFamilyEvaluations = family.pageFamilyProfiles.map((pageFamilyProfile) => {
    const candidateStatuses = pageFamilyProfile.blueprintCandidates.map((reference) => {
      const candidateIdentityKey = createPageBlueprintV2CandidateReferenceIdentityKey(reference);
      const evaluation = pageEvaluations.get(candidateIdentityKey);
      if (!evaluation) throw new Error(`Missing PageBlueprint evaluation ${candidateIdentityKey}.`);
      return { candidateIdentityKey, status: evaluation.status };
    });
    return {
      pageFamilyId: pageFamilyProfile.pageFamilyId,
      candidateStatuses,
      directlyCompatibleCandidateIdentityKeys: candidateStatuses
        .filter(({ status }) => status === "directly-compatible")
        .map(({ candidateIdentityKey }) => candidateIdentityKey),
      conditionallyCompatibleCandidateIdentityKeys: candidateStatuses
        .filter(({ status }) => ["substitution-compatible", "omission-compatible"].includes(status))
        .map(({ candidateIdentityKey }) => candidateIdentityKey),
      incompatibleCandidateIdentityKeys: candidateStatuses
        .filter(({ status }) => status === "incompatible")
        .map(({ candidateIdentityKey }) => candidateIdentityKey),
    };
  });
  const incompatibleConditionDimensions = conditionEvaluations
    .filter(({ outcome }) => outcome === "incompatible")
    .map(({ dimension }) => dimension);
  const incompatiblePageFamilyIds = pageFamilyEvaluations
    .filter(
      (evaluation) =>
        evaluation.directlyCompatibleCandidateIdentityKeys.length === 0 &&
        evaluation.conditionallyCompatibleCandidateIdentityKeys.length === 0,
    )
    .map(({ pageFamilyId }) => pageFamilyId);
  const status: StructuralStorefrontFamilyCandidateCompatibilityStatus =
    incompatibleConditionDimensions.length > 0 || incompatiblePageFamilyIds.length > 0
      ? "incompatible"
      : pageFamilyEvaluations.every(
            ({ directlyCompatibleCandidateIdentityKeys }) =>
              directlyCompatibleCandidateIdentityKeys.length > 0,
          )
        ? "directly-compatible"
        : "conditionally-compatible";
  return structuralStorefrontFamilyCandidateCompatibilityEvaluationV1Schema.parse({
    candidateIdentityKey: familyIdentityKey(family),
    exactCandidateFingerprint: family.candidateFingerprint,
    normalizedTopologyFingerprint,
    compatibilityProfileFingerprint: profile.profileFingerprint,
    conditionEvaluations,
    pageFamilyEvaluations,
    incompatibleConditionDimensions,
    incompatiblePageFamilyIds,
    status,
  });
}
export function evaluateInactiveStructuralStorefrontCandidateCompatibility(
  input: StructuralStorefrontCandidateCompatibilityEvaluatorInput,
): StructuralStorefrontCandidateCompatibilityEvaluationV1 {
  const parsedInput = evaluatorInputSchema.parse(input);
  const registry = canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(
    parsedInput.candidateRegistry,
  );
  const topology = assertExactTopologyIndex(registry, parsedInput.normalizedTopologyIndex);
  const capabilityContext = parseStructuralStorefrontCapabilityContext(
    registry,
    parsedInput.capabilityContext,
  );
  const compatibilityProfileCatalogue =
    validateInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueBinding(
      registry,
      parsedInput.compatibilityProfileCatalogue,
    );
  const evaluatePageBlueprint = createPageBlueprintEvaluator(registry, topology, capabilityContext);
  const pageBlueprintEvaluations = registry.pageBlueprintCandidates.map((candidate) =>
    evaluatePageBlueprint(createPageBlueprintV2CandidateAuthorityIdentityKey(candidate)),
  );
  const pageEvaluationsByIdentity = new Map(
    pageBlueprintEvaluations.map((evaluation) => [evaluation.candidateIdentityKey, evaluation]),
  );
  const profilesByIdentity = new Map(
    compatibilityProfileCatalogue.profiles.map((profile) => [familyIdentityKey(profile), profile]),
  );
  const familyTopologiesByIdentity = new Map(
    topology.familyEntries.map((entry) => [entry.candidateIdentityKey, entry.normalizedTopology]),
  );
  const familyEvaluations = registry.familyCandidates.map((family) => {
    const identityKey = familyIdentityKey(family);
    const profile = profilesByIdentity.get(identityKey);
    const familyTopology = familyTopologiesByIdentity.get(identityKey);
    if (!profile || !familyTopology) {
      throw new Error(`Validated family compatibility authority is missing ${identityKey}.`);
    }
    return evaluateFamily(
      family,
      profile,
      familyTopology.topologyFingerprint,
      capabilityContext,
      pageEvaluationsByIdentity,
    );
  });
  const material = {
    evaluationSchemaVersion:
      STRUCTURAL_STOREFRONT_CANDIDATE_COMPATIBILITY_EVALUATION_SCHEMA_VERSION,
    registryAuthorityFingerprint: canonicalValueFingerprint(registry),
    capabilityContextFingerprint: capabilityContext.contextFingerprint,
    profileCatalogueFingerprint: compatibilityProfileCatalogue.catalogueFingerprint,
    pageBlueprintEvaluations,
    familyEvaluations,
  } satisfies Omit<StructuralStorefrontCandidateCompatibilityEvaluationV1, "evaluationFingerprint">;
  return structuralStorefrontCandidateCompatibilityEvaluationV1Schema.parse({
    ...material,
    evaluationFingerprint: `structural-storefront-candidate-compatibility-evaluation-${canonicalValueFingerprint(material)}`,
  });
}
export function parseStructuralStorefrontCandidateCompatibilityEvaluation(
  authority: StructuralStorefrontCandidateCompatibilityEvaluatorInput,
  input: unknown,
): StructuralStorefrontCandidateCompatibilityEvaluationV1 {
  const parsed = structuralStorefrontCandidateCompatibilityEvaluationV1Schema.parse(input);
  const expected = evaluateInactiveStructuralStorefrontCandidateCompatibility(authority);
  if (canonicalValueString(parsed) !== canonicalValueString(expected)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["evaluationFingerprint"],
        message: "Candidate compatibility evaluation is stale or noncanonical.",
      },
    ]);
  }
  return expected;
}
