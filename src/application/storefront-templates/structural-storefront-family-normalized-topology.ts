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
import { structuralStorefrontFamilyIdentityKey } from "@/domain/structural-storefront-family/identity";

import {
  derivePageBlueprintV2NormalizedTopology,
  pageBlueprintV2NormalizedTopologyFingerprintSchema,
  type PageBlueprintV2NormalizedTopologyV1,
} from "./page-blueprint-v2-normalized-topology";
import {
  createPageBlueprintV2CandidateAuthorityIdentityKey,
  createPageBlueprintV2CandidateReferenceIdentityKey,
} from "./page-blueprint-v2-candidate-authority";
import {
  MAX_PAGE_BLUEPRINT_V2_CANDIDATES_PER_PAGE_FAMILY_PROFILE,
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  parseStructuralStorefrontFamilyCandidate,
  type InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  type StructuralStorefrontFamilyCandidateV1,
} from "./structural-storefront-family-candidate-registry";

export const STRUCTURAL_STOREFRONT_FAMILY_NORMALIZED_TOPOLOGY_SCHEMA_VERSION = "1.0.0" as const;
export const INACTIVE_CANDIDATE_NORMALIZED_TOPOLOGY_INDEX_SCHEMA_VERSION = "1.0.0" as const;

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const pageFamilyOrder = new Map<StructuralStorefrontPageFamilyId, number>(
  structuralStorefrontPageFamilyIds.map((pageFamilyId, index) => [pageFamilyId, index]),
);

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}

const pageFamilyTopologyEntrySchema = z
  .object({
    pageFamilyId: structuralStorefrontPageFamilyIdSchema,
    pageBlueprintTopologyFingerprints: z
      .array(pageBlueprintV2NormalizedTopologyFingerprintSchema)
      .min(1)
      .max(MAX_PAGE_BLUEPRINT_V2_CANDIDATES_PER_PAGE_FAMILY_PROFILE)
      .readonly(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (
      new Set(entry.pageBlueprintTopologyFingerprints).size !==
      entry.pageBlueprintTopologyFingerprints.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["pageBlueprintTopologyFingerprints"],
        message: "Page-family topology fingerprints must be unique.",
      });
    }
  })
  .readonly();

export type StructuralStorefrontFamilyPageFamilyTopologyV1 = z.infer<
  typeof pageFamilyTopologyEntrySchema
>;

const familyTopologyMaterialShape = {
  topologySchemaVersion: z.literal(STRUCTURAL_STOREFRONT_FAMILY_NORMALIZED_TOPOLOGY_SCHEMA_VERSION),
  pageFamilyTopologies: z
    .array(pageFamilyTopologyEntrySchema)
    .length(structuralStorefrontPageFamilyIds.length)
    .readonly(),
  crossPageRelationships: z
    .array(structuralStorefrontCrossPageRelationshipV1Schema)
    .min(1)
    .readonly(),
} as const;

function addFamilyTopologyIntegrityIssues(
  value: Readonly<{
    pageFamilyTopologies: readonly StructuralStorefrontFamilyPageFamilyTopologyV1[];
    crossPageRelationships: readonly StructuralStorefrontCrossPageRelationshipV1[];
  }>,
  context: z.RefinementCtx,
): void {
  const declared = value.pageFamilyTopologies.map(({ pageFamilyId }) => pageFamilyId);
  const unique = new Set(declared);
  if (unique.size !== declared.length) {
    context.addIssue({
      code: "custom",
      path: ["pageFamilyTopologies"],
      message: "Structural Family topology contains duplicate page-family entries.",
    });
  }
  const missing = structuralStorefrontPageFamilyIds.filter(
    (pageFamilyId) => !unique.has(pageFamilyId),
  );
  if (missing.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["pageFamilyTopologies"],
      message: `Structural Family topology is missing page families: ${missing.join(", ")}.`,
    });
  }
  try {
    canonicalizeStructuralStorefrontCrossPageRelationships(value.crossPageRelationships);
  } catch (error) {
    context.addIssue({
      code: "custom",
      path: ["crossPageRelationships"],
      message: error instanceof Error ? error.message : "Invalid cross-page topology authority.",
    });
  }
}

const familyTopologyMaterialSchema = z
  .object(familyTopologyMaterialShape)
  .strict()
  .superRefine(addFamilyTopologyIntegrityIssues);

export const structuralStorefrontFamilyNormalizedTopologyFingerprintSchema = z
  .string()
  .regex(/^structural-storefront-family-normalized-topology-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/);

export type StructuralStorefrontFamilyNormalizedTopologyFingerprint = z.infer<
  typeof structuralStorefrontFamilyNormalizedTopologyFingerprintSchema
>;

export type StructuralStorefrontFamilyNormalizedTopologyV1 = Readonly<
  z.infer<typeof familyTopologyMaterialSchema> & {
    topologyFingerprint: StructuralStorefrontFamilyNormalizedTopologyFingerprint;
  }
>;

function canonicalFamilyTopologyMaterial(
  input: z.infer<typeof familyTopologyMaterialSchema>,
): z.infer<typeof familyTopologyMaterialSchema> {
  return familyTopologyMaterialSchema.parse({
    topologySchemaVersion: input.topologySchemaVersion,
    pageFamilyTopologies: [...input.pageFamilyTopologies]
      .sort(
        (left, right) =>
          (pageFamilyOrder.get(left.pageFamilyId) ?? Number.POSITIVE_INFINITY) -
          (pageFamilyOrder.get(right.pageFamilyId) ?? Number.POSITIVE_INFINITY),
      )
      .map((entry) => ({
        pageFamilyId: entry.pageFamilyId,
        pageBlueprintTopologyFingerprints: [...entry.pageBlueprintTopologyFingerprints].sort(
          compareCodeUnits,
        ),
      })),
    crossPageRelationships: canonicalizeStructuralStorefrontCrossPageRelationships(
      input.crossPageRelationships,
    ),
  });
}

function familyTopologyFingerprint(
  material: z.infer<typeof familyTopologyMaterialSchema>,
): StructuralStorefrontFamilyNormalizedTopologyFingerprint {
  return structuralStorefrontFamilyNormalizedTopologyFingerprintSchema.parse(
    `structural-storefront-family-normalized-topology-${canonicalValueFingerprint(material)}`,
  );
}

function createFamilyTopology(
  input: z.infer<typeof familyTopologyMaterialSchema>,
): StructuralStorefrontFamilyNormalizedTopologyV1 {
  const material = canonicalFamilyTopologyMaterial(input);
  return deepFreeze({ ...material, topologyFingerprint: familyTopologyFingerprint(material) });
}

export const structuralStorefrontFamilyNormalizedTopologyV1Schema = z
  .object({
    ...familyTopologyMaterialShape,
    topologyFingerprint: structuralStorefrontFamilyNormalizedTopologyFingerprintSchema,
  })
  .strict()
  .superRefine(addFamilyTopologyIntegrityIssues)
  .transform((input, context): StructuralStorefrontFamilyNormalizedTopologyV1 => {
    const { topologyFingerprint, ...material } = input;
    const canonical = createFamilyTopology(material);
    if (familyTopologyFingerprint(material) !== canonical.topologyFingerprint) {
      context.addIssue({
        code: "custom",
        message: "Structural Storefront Family normalized topology must use canonical ordering.",
      });
      return z.NEVER;
    }
    if (topologyFingerprint !== canonical.topologyFingerprint) {
      context.addIssue({
        code: "custom",
        path: ["topologyFingerprint"],
        message: "Structural Storefront Family normalized-topology fingerprint is stale.",
      });
      return z.NEVER;
    }
    return canonical;
  });

export function parseStructuralStorefrontFamilyNormalizedTopology(
  input: unknown,
): StructuralStorefrontFamilyNormalizedTopologyV1 {
  return structuralStorefrontFamilyNormalizedTopologyV1Schema.parse(input);
}

function pageTopologiesByIdentity(
  registry: InactiveStructuralStorefrontFamilyCandidateRegistryV1,
): ReadonlyMap<string, PageBlueprintV2NormalizedTopologyV1> {
  return new Map(
    registry.pageBlueprintCandidates.map((candidate) => [
      createPageBlueprintV2CandidateAuthorityIdentityKey(candidate),
      derivePageBlueprintV2NormalizedTopology(candidate),
    ]),
  );
}

function deriveCanonicalFamilyTopology(
  registry: InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  family: StructuralStorefrontFamilyCandidateV1,
  pageTopologies: ReadonlyMap<string, PageBlueprintV2NormalizedTopologyV1>,
): StructuralStorefrontFamilyNormalizedTopologyV1 {
  const candidatesByIdentity = new Map(
    registry.pageBlueprintCandidates.map((candidate) => [
      createPageBlueprintV2CandidateAuthorityIdentityKey(candidate),
      candidate,
    ]),
  );
  const pageFamilyTopologies = family.pageFamilyProfiles.map((profile) => ({
    pageFamilyId: profile.pageFamilyId,
    pageBlueprintTopologyFingerprints: [
      ...new Set(
        profile.blueprintCandidates.map((reference) => {
          const identityKey = createPageBlueprintV2CandidateReferenceIdentityKey(reference);
          const candidate = candidatesByIdentity.get(identityKey);
          const topology = pageTopologies.get(identityKey);
          if (!candidate || !topology)
            throw new Error(`Unknown PageBlueprint candidate ${identityKey}.`);
          if (candidate.structural.pageFamilyId !== profile.pageFamilyId) {
            throw new Error(
              `PageBlueprint candidate ${identityKey} does not belong to ${profile.pageFamilyId}.`,
            );
          }
          return topology.topologyFingerprint;
        }),
      ),
    ].sort(compareCodeUnits),
  }));
  return createFamilyTopology({
    topologySchemaVersion: STRUCTURAL_STOREFRONT_FAMILY_NORMALIZED_TOPOLOGY_SCHEMA_VERSION,
    pageFamilyTopologies,
    crossPageRelationships: family.crossPageRelationships,
  });
}

export function deriveStructuralStorefrontFamilyNormalizedTopology(
  registryInput: unknown,
  familyCandidateInput: unknown,
): StructuralStorefrontFamilyNormalizedTopologyV1 {
  const registry = canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(registryInput);
  const family = parseStructuralStorefrontFamilyCandidate(familyCandidateInput);
  return deriveCanonicalFamilyTopology(registry, family, pageTopologiesByIdentity(registry));
}

type NormalizedTopologyIndexEntry<Topology> = Readonly<{
  candidateIdentityKey: string;
  exactCandidateFingerprint: string;
  normalizedTopology: Topology;
}>;

type DuplicateTopologyCluster = Readonly<{
  topologyFingerprint: string;
  candidateIdentityKeys: readonly string[];
}>;

export type InactiveCandidateNormalizedTopologyIndexV1 = Readonly<{
  contractSchemaVersion: typeof INACTIVE_CANDIDATE_NORMALIZED_TOPOLOGY_INDEX_SCHEMA_VERSION;
  pageBlueprintEntries: readonly NormalizedTopologyIndexEntry<PageBlueprintV2NormalizedTopologyV1>[];
  familyEntries: readonly NormalizedTopologyIndexEntry<StructuralStorefrontFamilyNormalizedTopologyV1>[];
  duplicatePageBlueprintTopologyClusters: readonly DuplicateTopologyCluster[];
  duplicateFamilyTopologyClusters: readonly DuplicateTopologyCluster[];
}>;

function duplicateClusters(
  entries: readonly NormalizedTopologyIndexEntry<{ readonly topologyFingerprint: string }>[],
): readonly DuplicateTopologyCluster[] {
  const identitiesByFingerprint = new Map<string, string[]>();
  for (const entry of entries) {
    const identities =
      identitiesByFingerprint.get(entry.normalizedTopology.topologyFingerprint) ?? [];
    identities.push(entry.candidateIdentityKey);
    identitiesByFingerprint.set(entry.normalizedTopology.topologyFingerprint, identities);
  }
  return [...identitiesByFingerprint]
    .filter(([, identities]) => identities.length > 1)
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([topologyFingerprint, identities]) => ({
      topologyFingerprint,
      candidateIdentityKeys: identities.sort(compareCodeUnits),
    }));
}

export function deriveInactiveCandidateNormalizedTopologyIndex(
  registryInput: unknown,
): InactiveCandidateNormalizedTopologyIndexV1 {
  const registry = canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(registryInput);
  const topologies = pageTopologiesByIdentity(registry);
  const pageBlueprintEntries = registry.pageBlueprintCandidates.map((candidate) => {
    const candidateIdentityKey = createPageBlueprintV2CandidateAuthorityIdentityKey(candidate);
    const normalizedTopology = topologies.get(candidateIdentityKey);
    if (!normalizedTopology) {
      throw new Error(`Missing derived PageBlueprint topology ${candidateIdentityKey}.`);
    }
    return {
      candidateIdentityKey,
      exactCandidateFingerprint: candidate.candidateFingerprint,
      normalizedTopology,
    };
  });
  const familyEntries = registry.familyCandidates.map((family) => ({
    candidateIdentityKey: structuralStorefrontFamilyIdentityKey({
      familyId: family.familyId,
      familyVersion: family.familyVersion,
    }),
    exactCandidateFingerprint: family.candidateFingerprint,
    normalizedTopology: deriveCanonicalFamilyTopology(registry, family, topologies),
  }));
  return deepFreeze({
    contractSchemaVersion: INACTIVE_CANDIDATE_NORMALIZED_TOPOLOGY_INDEX_SCHEMA_VERSION,
    pageBlueprintEntries,
    familyEntries,
    duplicatePageBlueprintTopologyClusters: duplicateClusters(pageBlueprintEntries),
    duplicateFamilyTopologyClusters: duplicateClusters(familyEntries),
  });
}
