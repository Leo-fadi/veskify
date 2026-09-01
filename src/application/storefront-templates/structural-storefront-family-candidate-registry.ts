import { z } from "zod";

import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import {
  canonicalizeStructuralStorefrontCrossPageRelationships,
  structuralStorefrontCrossPageRelationshipV1Schema,
  structuralStorefrontPageFamilyIdSchema,
  structuralStorefrontPageFamilyIds,
  type StructuralStorefrontCrossPageRelationshipV1,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family/cross-page-relationships";
import {
  structuralStorefrontFamilyIdSchema,
  structuralStorefrontFamilyIdentityKey,
  structuralStorefrontFamilyIds,
  structuralStorefrontFamilyVersionSchema,
  type StructuralStorefrontFamilyId,
} from "@/domain/structural-storefront-family/identity";
import { STRUCTURAL_STOREFRONT_FAMILY_INITIAL_LIFECYCLE_STATE } from "@/domain/structural-storefront-family/lifecycle";

import {
  createPageBlueprintV2CandidateAuthorityIdentityKey,
  createPageBlueprintV2CandidateReferenceIdentityKey,
  pageBlueprintV2CandidateAuthorityV1Schema,
  pageBlueprintV2CandidateReferenceSchema,
  type PageBlueprintV2CandidateAuthorityV1,
  type PageBlueprintV2CandidateReference,
} from "./page-blueprint-v2-candidate-authority";

export const STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_SCHEMA_VERSION = "1.0.0" as const;
export const INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_REGISTRY_SCHEMA_VERSION =
  "1.0.0" as const;
export const MAX_PAGE_BLUEPRINT_V2_CANDIDATES_PER_PAGE_FAMILY_PROFILE = 8;
export const MAX_INACTIVE_PAGE_BLUEPRINT_V2_CANDIDATES = 96;
export const MAX_INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATES = 24;

const MAX_REGISTRY_FAILURE_EVIDENCE = 8;

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const pageFamilyOrder = new Map<StructuralStorefrontPageFamilyId, number>(
  structuralStorefrontPageFamilyIds.map((pageFamilyId, index) => [pageFamilyId, index]),
);

const familyIdOrder = new Map<StructuralStorefrontFamilyId, number>(
  structuralStorefrontFamilyIds.map((familyId, index) => [familyId, index]),
);

function compareCanonicalVersions(left: string, right: string): number {
  const leftSegments = left.split(".");
  const rightSegments = right.split(".");

  for (let index = 0; index < leftSegments.length; index += 1) {
    const leftSegment = leftSegments[index];
    const rightSegment = rightSegments[index];
    if (leftSegment.length !== rightSegment.length) {
      return leftSegment.length - rightSegment.length;
    }
    const segmentDifference = compareCodeUnits(leftSegment, rightSegment);
    if (segmentDifference !== 0) return segmentDifference;
  }

  return 0;
}

function comparePageBlueprintReferences(
  left: PageBlueprintV2CandidateReference,
  right: PageBlueprintV2CandidateReference,
): number {
  const idDifference = compareCodeUnits(left.blueprintId, right.blueprintId);
  return idDifference !== 0
    ? idDifference
    : compareCanonicalVersions(left.blueprintVersion, right.blueprintVersion);
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.freeze(
    [...counts]
      .filter(([, count]) => count > 1)
      .map(([value]) => value)
      .sort(compareCodeUnits),
  );
}

function boundedEvidence(values: readonly string[]): string {
  const visible = values.slice(0, MAX_REGISTRY_FAILURE_EVIDENCE);
  const omitted = values.length - visible.length;
  return `${visible.join(", ")}${omitted > 0 ? ` (+${omitted} more)` : ""}`;
}

export const structuralStorefrontFamilyPageFamilyProfileCandidatesV1Schema = z
  .object({
    pageFamilyId: structuralStorefrontPageFamilyIdSchema,
    blueprintCandidates: z
      .array(pageBlueprintV2CandidateReferenceSchema)
      .min(1)
      .max(MAX_PAGE_BLUEPRINT_V2_CANDIDATES_PER_PAGE_FAMILY_PROFILE)
      .readonly(),
  })
  .strict()
  .superRefine((profile, context) => {
    const duplicateReferences = duplicateValues(
      profile.blueprintCandidates.map(createPageBlueprintV2CandidateReferenceIdentityKey),
    );
    if (duplicateReferences.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["blueprintCandidates"],
        message: `Duplicate PageBlueprint candidate references: ${boundedEvidence(duplicateReferences)}.`,
      });
    }
  })
  .readonly();

export type StructuralStorefrontFamilyPageFamilyProfileCandidatesV1 = z.infer<
  typeof structuralStorefrontFamilyPageFamilyProfileCandidatesV1Schema
>;

const familyCandidateShape = {
  candidateSchemaVersion: z.literal(STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_SCHEMA_VERSION),
  familyId: structuralStorefrontFamilyIdSchema,
  familyVersion: structuralStorefrontFamilyVersionSchema,
  lifecycleState: z.literal(STRUCTURAL_STOREFRONT_FAMILY_INITIAL_LIFECYCLE_STATE),
  pageFamilyProfiles: z
    .array(structuralStorefrontFamilyPageFamilyProfileCandidatesV1Schema)
    .length(structuralStorefrontPageFamilyIds.length)
    .readonly(),
  crossPageRelationships: z
    .array(structuralStorefrontCrossPageRelationshipV1Schema)
    .min(1)
    .readonly(),
} as const;

function addFamilyCandidateIntegrityIssues(
  candidate: Readonly<{
    pageFamilyProfiles: readonly StructuralStorefrontFamilyPageFamilyProfileCandidatesV1[];
    crossPageRelationships: readonly StructuralStorefrontCrossPageRelationshipV1[];
  }>,
  context: z.RefinementCtx,
): void {
  const declaredPageFamilies = candidate.pageFamilyProfiles.map(({ pageFamilyId }) => pageFamilyId);
  const duplicatePageFamilies = duplicateValues(declaredPageFamilies);
  const declaredPageFamilySet = new Set(declaredPageFamilies);
  const missingPageFamilies = structuralStorefrontPageFamilyIds.filter(
    (pageFamilyId) => !declaredPageFamilySet.has(pageFamilyId),
  );

  if (duplicatePageFamilies.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["pageFamilyProfiles"],
      message: `Duplicate structural page-family profiles: ${boundedEvidence(duplicatePageFamilies)}.`,
    });
  }
  if (missingPageFamilies.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["pageFamilyProfiles"],
      message: `Missing structural page-family profiles: ${boundedEvidence(missingPageFamilies)}.`,
    });
  }

  try {
    canonicalizeStructuralStorefrontCrossPageRelationships(candidate.crossPageRelationships);
  } catch (error) {
    context.addIssue({
      code: "custom",
      path: ["crossPageRelationships"],
      message:
        error instanceof Error
          ? error.message
          : "Cross-page relationship authority is not canonicalizable.",
    });
  }
}

const structuralStorefrontFamilyCandidateCreationInputSchema = z
  .object(familyCandidateShape)
  .strict()
  .superRefine(addFamilyCandidateIntegrityIssues);

const familyCandidateFingerprintSchema = z
  .string()
  .regex(/^structural-storefront-family-candidate-v1_[1-9][0-9]*_[0-9a-f]{64}$/);

const structuralStorefrontFamilyCandidateSuppliedSchema = z
  .object({
    ...familyCandidateShape,
    candidateFingerprint: familyCandidateFingerprintSchema,
  })
  .strict()
  .superRefine(addFamilyCandidateIntegrityIssues);

export type StructuralStorefrontFamilyCandidateV1 = Readonly<{
  candidateSchemaVersion: typeof STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_SCHEMA_VERSION;
  familyId: z.infer<typeof structuralStorefrontFamilyIdSchema>;
  familyVersion: z.infer<typeof structuralStorefrontFamilyVersionSchema>;
  lifecycleState: typeof STRUCTURAL_STOREFRONT_FAMILY_INITIAL_LIFECYCLE_STATE;
  pageFamilyProfiles: readonly StructuralStorefrontFamilyPageFamilyProfileCandidatesV1[];
  crossPageRelationships: readonly StructuralStorefrontCrossPageRelationshipV1[];
  candidateFingerprint: string;
}>;

function canonicalizePageFamilyProfiles(
  profiles: readonly StructuralStorefrontFamilyPageFamilyProfileCandidatesV1[],
): readonly StructuralStorefrontFamilyPageFamilyProfileCandidatesV1[] {
  return Object.freeze(
    [...profiles]
      .sort(
        (left, right) =>
          (pageFamilyOrder.get(left.pageFamilyId) ?? Number.POSITIVE_INFINITY) -
          (pageFamilyOrder.get(right.pageFamilyId) ?? Number.POSITIVE_INFINITY),
      )
      .map((profile) =>
        structuralStorefrontFamilyPageFamilyProfileCandidatesV1Schema.parse({
          pageFamilyId: profile.pageFamilyId,
          blueprintCandidates: [...profile.blueprintCandidates].sort(
            comparePageBlueprintReferences,
          ),
        }),
      ),
  );
}

function canonicalFamilyCandidateContent(
  candidate: z.infer<typeof structuralStorefrontFamilyCandidateCreationInputSchema>,
): Omit<StructuralStorefrontFamilyCandidateV1, "candidateFingerprint"> {
  return deepFreeze({
    candidateSchemaVersion: candidate.candidateSchemaVersion,
    familyId: candidate.familyId,
    familyVersion: candidate.familyVersion,
    lifecycleState: candidate.lifecycleState,
    pageFamilyProfiles: canonicalizePageFamilyProfiles(candidate.pageFamilyProfiles),
    crossPageRelationships: canonicalizeStructuralStorefrontCrossPageRelationships(
      candidate.crossPageRelationships,
    ),
  });
}

function createFamilyCandidateFingerprint(
  candidate: Omit<StructuralStorefrontFamilyCandidateV1, "candidateFingerprint">,
): string {
  return `structural-storefront-family-candidate-${canonicalValueFingerprint({
    candidateSchemaVersion: candidate.candidateSchemaVersion,
    familyId: candidate.familyId,
    familyVersion: candidate.familyVersion,
    pageFamilyProfiles: candidate.pageFamilyProfiles,
    crossPageRelationships: candidate.crossPageRelationships,
  })}`;
}

function canonicalFamilyCandidate(
  candidate: z.infer<typeof structuralStorefrontFamilyCandidateCreationInputSchema>,
): StructuralStorefrontFamilyCandidateV1 {
  const content = canonicalFamilyCandidateContent(candidate);
  return deepFreeze({
    ...content,
    candidateFingerprint: createFamilyCandidateFingerprint(content),
  });
}

export const structuralStorefrontFamilyCandidateV1Schema =
  structuralStorefrontFamilyCandidateSuppliedSchema.transform(
    (candidate, context): StructuralStorefrontFamilyCandidateV1 => {
      const canonical = canonicalFamilyCandidate(candidate);
      if (candidate.candidateFingerprint !== canonical.candidateFingerprint) {
        context.addIssue({
          code: "custom",
          path: ["candidateFingerprint"],
          message: "Structural Storefront Family candidate fingerprint is stale.",
        });
        return z.NEVER;
      }
      return canonical;
    },
  );

export function createStructuralStorefrontFamilyCandidate(
  input: unknown,
): StructuralStorefrontFamilyCandidateV1 {
  return canonicalFamilyCandidate(
    structuralStorefrontFamilyCandidateCreationInputSchema.parse(input),
  );
}

export function parseStructuralStorefrontFamilyCandidate(
  input: unknown,
): StructuralStorefrontFamilyCandidateV1 {
  return structuralStorefrontFamilyCandidateV1Schema.parse(input);
}

function createFamilyCandidateIdentityKey(
  candidate: StructuralStorefrontFamilyCandidateV1,
): string {
  return structuralStorefrontFamilyIdentityKey({
    familyId: candidate.familyId,
    familyVersion: candidate.familyVersion,
  });
}

export type InactiveStructuralStorefrontFamilyCandidateRegistryV1 = Readonly<{
  contractSchemaVersion: typeof INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_REGISTRY_SCHEMA_VERSION;
  pageBlueprintCandidates: readonly PageBlueprintV2CandidateAuthorityV1[];
  familyCandidates: readonly StructuralStorefrontFamilyCandidateV1[];
}>;

const inactiveRegistryShapeSchema = z
  .object({
    contractSchemaVersion: z.literal(
      INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_REGISTRY_SCHEMA_VERSION,
    ),
    pageBlueprintCandidates: z
      .array(pageBlueprintV2CandidateAuthorityV1Schema)
      .max(MAX_INACTIVE_PAGE_BLUEPRINT_V2_CANDIDATES)
      .readonly(),
    familyCandidates: z
      .array(structuralStorefrontFamilyCandidateV1Schema)
      .max(MAX_INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATES)
      .readonly(),
  })
  .strict();

function hasSubstitutionCycle(adjacency: ReadonlyMap<string, readonly string[]>): boolean {
  const colours = new Map<string, "unvisited" | "visiting" | "visited">();

  const visit = (identityKey: string): boolean => {
    const colour = colours.get(identityKey) ?? "unvisited";
    if (colour === "visiting") return true;
    if (colour === "visited") return false;

    colours.set(identityKey, "visiting");
    for (const targetIdentityKey of adjacency.get(identityKey) ?? []) {
      if (visit(targetIdentityKey)) return true;
    }
    colours.set(identityKey, "visited");
    return false;
  };

  return [...adjacency.keys()].sort(compareCodeUnits).some(visit);
}

function addRegistryIntegrityIssues(
  registry: z.infer<typeof inactiveRegistryShapeSchema>,
  context: z.RefinementCtx,
): void {
  const pageBlueprintIdentityKeys = registry.pageBlueprintCandidates.map(
    createPageBlueprintV2CandidateAuthorityIdentityKey,
  );
  const duplicatePageBlueprintIdentities = duplicateValues(pageBlueprintIdentityKeys);
  if (duplicatePageBlueprintIdentities.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["pageBlueprintCandidates"],
      message: `Duplicate PageBlueprint candidate identities: ${boundedEvidence(duplicatePageBlueprintIdentities)}.`,
    });
  }

  const familyIdentityKeys = registry.familyCandidates.map(createFamilyCandidateIdentityKey);
  const duplicateFamilyIdentities = duplicateValues(familyIdentityKeys);
  if (duplicateFamilyIdentities.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["familyCandidates"],
      message: `Duplicate Structural Storefront Family candidate identities: ${boundedEvidence(duplicateFamilyIdentities)}.`,
    });
  }

  if (duplicatePageBlueprintIdentities.length > 0 || duplicateFamilyIdentities.length > 0) return;

  const pageBlueprintByIdentity = new Map(
    registry.pageBlueprintCandidates.map((candidate) => [
      createPageBlueprintV2CandidateAuthorityIdentityKey(candidate),
      candidate,
    ]),
  );

  registry.familyCandidates.forEach((familyCandidate, familyIndex) => {
    familyCandidate.pageFamilyProfiles.forEach((profile, profileIndex) => {
      profile.blueprintCandidates.forEach((reference, referenceIndex) => {
        const identityKey = createPageBlueprintV2CandidateReferenceIdentityKey(reference);
        const target = pageBlueprintByIdentity.get(identityKey);
        if (!target) {
          context.addIssue({
            code: "custom",
            path: [
              "familyCandidates",
              familyIndex,
              "pageFamilyProfiles",
              profileIndex,
              "blueprintCandidates",
              referenceIndex,
            ],
            message: `Unknown PageBlueprint candidate reference ${identityKey}.`,
          });
        } else if (target.structural.pageFamilyId !== profile.pageFamilyId) {
          context.addIssue({
            code: "custom",
            path: [
              "familyCandidates",
              familyIndex,
              "pageFamilyProfiles",
              profileIndex,
              "blueprintCandidates",
              referenceIndex,
            ],
            message: `PageBlueprint candidate ${identityKey} does not belong to ${profile.pageFamilyId}.`,
          });
        }
      });
    });
  });

  const adjacency = new Map<string, readonly string[]>();
  registry.pageBlueprintCandidates.forEach((source, sourceIndex) => {
    const sourceIdentityKey = createPageBlueprintV2CandidateAuthorityIdentityKey(source);
    const resolvedTargets: string[] = [];

    source.omissionSubstitutionFallback.blueprintSubstitutionCandidates.forEach(
      (reference, referenceIndex) => {
        const targetIdentityKey = createPageBlueprintV2CandidateReferenceIdentityKey(reference);
        const target = pageBlueprintByIdentity.get(targetIdentityKey);
        if (!target) {
          context.addIssue({
            code: "custom",
            path: [
              "pageBlueprintCandidates",
              sourceIndex,
              "omissionSubstitutionFallback",
              "blueprintSubstitutionCandidates",
              referenceIndex,
            ],
            message: `Unknown PageBlueprint substitution target ${targetIdentityKey}.`,
          });
          return;
        }
        if (sourceIdentityKey === targetIdentityKey) {
          context.addIssue({
            code: "custom",
            path: [
              "pageBlueprintCandidates",
              sourceIndex,
              "omissionSubstitutionFallback",
              "blueprintSubstitutionCandidates",
              referenceIndex,
            ],
            message: "A PageBlueprint substitution target must differ from its source identity.",
          });
          return;
        }
        if (target.structural.pageFamilyId !== source.structural.pageFamilyId) {
          context.addIssue({
            code: "custom",
            path: [
              "pageBlueprintCandidates",
              sourceIndex,
              "omissionSubstitutionFallback",
              "blueprintSubstitutionCandidates",
              referenceIndex,
            ],
            message: `PageBlueprint substitution target ${targetIdentityKey} does not belong to ${source.structural.pageFamilyId}.`,
          });
          return;
        }
        resolvedTargets.push(targetIdentityKey);
      },
    );

    adjacency.set(sourceIdentityKey, Object.freeze(resolvedTargets));
  });

  if (hasSubstitutionCycle(adjacency)) {
    context.addIssue({
      code: "custom",
      path: ["pageBlueprintCandidates"],
      message: "PageBlueprint substitution candidates must form an acyclic exact-identity graph.",
    });
  }
}

function comparePageBlueprintCandidates(
  left: PageBlueprintV2CandidateAuthorityV1,
  right: PageBlueprintV2CandidateAuthorityV1,
): number {
  const pageFamilyDifference =
    (pageFamilyOrder.get(left.structural.pageFamilyId) ?? Number.POSITIVE_INFINITY) -
    (pageFamilyOrder.get(right.structural.pageFamilyId) ?? Number.POSITIVE_INFINITY);
  if (pageFamilyDifference !== 0) return pageFamilyDifference;

  const idDifference = compareCodeUnits(left.structural.id, right.structural.id);
  return idDifference !== 0
    ? idDifference
    : compareCanonicalVersions(left.structural.version, right.structural.version);
}

function compareFamilyCandidates(
  left: StructuralStorefrontFamilyCandidateV1,
  right: StructuralStorefrontFamilyCandidateV1,
): number {
  const familyDifference =
    (familyIdOrder.get(left.familyId) ?? Number.POSITIVE_INFINITY) -
    (familyIdOrder.get(right.familyId) ?? Number.POSITIVE_INFINITY);
  return familyDifference !== 0
    ? familyDifference
    : compareCanonicalVersions(left.familyVersion, right.familyVersion);
}

export const inactiveStructuralStorefrontFamilyCandidateRegistryV1Schema =
  inactiveRegistryShapeSchema
    .superRefine(addRegistryIntegrityIssues)
    .transform((registry): InactiveStructuralStorefrontFamilyCandidateRegistryV1 =>
      deepFreeze({
        contractSchemaVersion: registry.contractSchemaVersion,
        pageBlueprintCandidates: [...registry.pageBlueprintCandidates].sort(
          comparePageBlueprintCandidates,
        ),
        familyCandidates: [...registry.familyCandidates].sort(compareFamilyCandidates),
      }),
    );

export function canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(
  input: unknown,
): InactiveStructuralStorefrontFamilyCandidateRegistryV1 {
  return inactiveStructuralStorefrontFamilyCandidateRegistryV1Schema.parse(input);
}

export const inactiveStructuralStorefrontFamilyCandidateRegistry =
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry({
    contractSchemaVersion: INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_REGISTRY_SCHEMA_VERSION,
    pageBlueprintCandidates: [],
    familyCandidates: [],
  });
