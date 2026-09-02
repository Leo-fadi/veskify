import { z } from "zod";

import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  structuralStorefrontFamilyIdentityKey,
  structuralStorefrontPageFamilyIds,
} from "@/domain/structural-storefront-family";
import {
  createPageBlueprintV2CandidateAuthorityIdentityKey,
  createPageBlueprintV2CandidateReferenceIdentityKey,
  type PageBlueprintV2CandidateAuthorityV1,
} from "./page-blueprint-v2-candidate-authority";
import {
  parseStructuralStorefrontCandidateCompatibilityEvaluation,
  type PageBlueprintV2CandidateCompatibilityEvaluationV1,
  type StructuralStorefrontCandidateCompatibilityEvaluationV1,
  type StructuralStorefrontFamilyCandidateCompatibilityEvaluationV1,
} from "./structural-storefront-candidate-compatibility-evaluation";
import {
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  type InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  type StructuralStorefrontFamilyCandidateV1,
} from "./structural-storefront-family-candidate-registry";
import {
  deriveInactiveCandidateNormalizedTopologyIndex,
  type InactiveCandidateNormalizedTopologyIndexV1,
} from "./structural-storefront-family-normalized-topology";
import {
  MAX_STRUCTURAL_STOREFRONT_SELECTION_COMBINATION_EVALUATIONS,
  STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION,
  STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_RECEIPT_SCHEMA_VERSION,
  STRUCTURAL_STOREFRONT_SELECTED_COMPLETE_TOPOLOGY_SCHEMA_VERSION,
  StructuralStorefrontDeterministicSelectionError,
  createStructuralStorefrontDeterministicSelectionReceipt,
  createStructuralStorefrontSelectedCompleteTopology,
  parseStructuralStorefrontDeterministicSelectionRequest,
  structuralStorefrontDeterministicSelectionReceiptV1Schema,
  type StructuralStorefrontDeterministicSelectionReceiptV1,
  type StructuralStorefrontDeterministicSelectionRequestV1,
  type StructuralStorefrontSelectedPageFamilyCandidateV1,
} from "./structural-storefront-selection-contract";

const selectorInputSchema = z
  .object({
    candidateRegistry: z.unknown(),
    normalizedTopologyIndex: z.unknown(),
    capabilityContext: z.unknown(),
    compatibilityProfileCatalogue: z.unknown(),
    compatibilityEvaluation: z.unknown(),
    selectionRequest: z.unknown(),
  })
  .strict();

export type StructuralStorefrontDeterministicSelectionInput = z.infer<typeof selectorInputSchema>;

const compareCodeUnits = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

function fail(
  code: ConstructorParameters<typeof StructuralStorefrontDeterministicSelectionError>[0],
  details: ConstructorParameters<typeof StructuralStorefrontDeterministicSelectionError>[1] = {},
): never {
  throw new StructuralStorefrontDeterministicSelectionError(code, details);
}

type TrustedSelectionAuthority = Readonly<{
  registry: InactiveStructuralStorefrontFamilyCandidateRegistryV1;
  topology: InactiveCandidateNormalizedTopologyIndexV1;
  evaluation: StructuralStorefrontCandidateCompatibilityEvaluationV1;
  request: StructuralStorefrontDeterministicSelectionRequestV1;
}>;

function trustedAuthority(input: unknown): TrustedSelectionAuthority {
  try {
    const supplied = selectorInputSchema.parse(input);
    const registry = canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(
      supplied.candidateRegistry,
    );
    const topology = deriveInactiveCandidateNormalizedTopologyIndex(registry);
    const evaluatorAuthority = {
      candidateRegistry: registry,
      normalizedTopologyIndex: supplied.normalizedTopologyIndex,
      capabilityContext: supplied.capabilityContext,
      compatibilityProfileCatalogue: supplied.compatibilityProfileCatalogue,
    };
    const evaluation = parseStructuralStorefrontCandidateCompatibilityEvaluation(
      evaluatorAuthority,
      supplied.compatibilityEvaluation,
    );
    const request = parseStructuralStorefrontDeterministicSelectionRequest(
      evaluation.evaluationFingerprint,
      supplied.selectionRequest,
    );
    return { registry, topology, evaluation, request };
  } catch (error) {
    if (error instanceof StructuralStorefrontDeterministicSelectionError) throw error;
    return fail("stale-selection-authority");
  }
}

type PageEntry = Readonly<{
  identityKey: string;
  candidate: PageBlueprintV2CandidateAuthorityV1;
  topology: InactiveCandidateNormalizedTopologyIndexV1["pageBlueprintEntries"][number];
  evaluation: PageBlueprintV2CandidateCompatibilityEvaluationV1;
}>;

type FamilyEntry = Readonly<{
  identityKey: string;
  candidate: StructuralStorefrontFamilyCandidateV1;
  topology: InactiveCandidateNormalizedTopologyIndexV1["familyEntries"][number];
  evaluation: StructuralStorefrontFamilyCandidateCompatibilityEvaluationV1;
}>;

type AuthorityMaps = Readonly<{
  pages: ReadonlyMap<string, PageEntry>;
  families: ReadonlyMap<string, FamilyEntry>;
}>;

function authorityMaps(authority: TrustedSelectionAuthority): AuthorityMaps {
  const pageTopologies = new Map(
    authority.topology.pageBlueprintEntries.map((entry) => [entry.candidateIdentityKey, entry]),
  );
  const pageEvaluations = new Map(
    authority.evaluation.pageBlueprintEvaluations.map((entry) => [
      entry.candidateIdentityKey,
      entry,
    ]),
  );
  const pages = new Map<string, PageEntry>();
  for (const candidate of authority.registry.pageBlueprintCandidates) {
    const identityKey = createPageBlueprintV2CandidateAuthorityIdentityKey(candidate);
    const topology = pageTopologies.get(identityKey);
    const evaluation = pageEvaluations.get(identityKey);
    if (
      !topology ||
      !evaluation ||
      topology.exactCandidateFingerprint !== candidate.candidateFingerprint ||
      evaluation.exactCandidateFingerprint !== candidate.candidateFingerprint ||
      evaluation.normalizedTopologyFingerprint !== topology.normalizedTopology.topologyFingerprint
    ) {
      return fail("stale-selection-authority", { candidateIdentityKey: identityKey });
    }
    pages.set(identityKey, { identityKey, candidate, topology, evaluation });
  }

  const familyTopologies = new Map(
    authority.topology.familyEntries.map((entry) => [entry.candidateIdentityKey, entry]),
  );
  const familyEvaluations = new Map(
    authority.evaluation.familyEvaluations.map((entry) => [entry.candidateIdentityKey, entry]),
  );
  const families = new Map<string, FamilyEntry>();
  for (const candidate of authority.registry.familyCandidates) {
    const identityKey = structuralStorefrontFamilyIdentityKey({
      familyId: candidate.familyId,
      familyVersion: candidate.familyVersion,
    });
    const topology = familyTopologies.get(identityKey);
    const evaluation = familyEvaluations.get(identityKey);
    if (
      !topology ||
      !evaluation ||
      topology.exactCandidateFingerprint !== candidate.candidateFingerprint ||
      evaluation.exactCandidateFingerprint !== candidate.candidateFingerprint ||
      evaluation.normalizedTopologyFingerprint !== topology.normalizedTopology.topologyFingerprint
    ) {
      return fail("stale-selection-authority", { candidateIdentityKey: identityKey });
    }
    families.set(identityKey, { identityKey, candidate, topology, evaluation });
  }
  return { pages, families };
}

function familyTieFingerprint(
  entry: FamilyEntry,
  request: StructuralStorefrontDeterministicSelectionRequestV1,
): string {
  return canonicalValueFingerprint({
    selectionPolicyVersion: STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION,
    selectionRequestFingerprint: request.requestFingerprint,
    familyCandidateIdentityKey: entry.identityKey,
    exactFamilyCandidateFingerprint: entry.candidate.candidateFingerprint,
    familyNormalizedTopologyFingerprint: entry.topology.normalizedTopology.topologyFingerprint,
  });
}

function compareFamilies(
  left: FamilyEntry,
  right: FamilyEntry,
  request: StructuralStorefrontDeterministicSelectionRequestV1,
): number {
  if (left.evaluation.status !== right.evaluation.status) {
    return left.evaluation.status === "directly-compatible" ? -1 : 1;
  }
  return (
    compareCodeUnits(familyTieFingerprint(left, request), familyTieFingerprint(right, request)) ||
    compareCodeUnits(left.identityKey, right.identityKey)
  );
}

function pageTieFingerprint(
  entry: PageEntry,
  familyIdentityKey: string,
  request: StructuralStorefrontDeterministicSelectionRequestV1,
): string {
  return canonicalValueFingerprint({
    selectionPolicyVersion: STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION,
    selectionRequestFingerprint: request.requestFingerprint,
    selectedFamilyCandidateIdentityKey: familyIdentityKey,
    pageFamilyId: entry.candidate.structural.pageFamilyId,
    pageBlueprintCandidateIdentityKey: entry.identityKey,
    exactPageBlueprintCandidateFingerprint: entry.candidate.candidateFingerprint,
    pageBlueprintNormalizedTopologyFingerprint:
      entry.topology.normalizedTopology.topologyFingerprint,
  });
}

function comparePages(
  left: PageEntry,
  right: PageEntry,
  familyIdentityKey: string,
  request: StructuralStorefrontDeterministicSelectionRequestV1,
): number {
  if (left.evaluation.status !== right.evaluation.status) {
    if (left.evaluation.status === "directly-compatible") return -1;
    if (right.evaluation.status === "directly-compatible") return 1;
    return left.evaluation.status === "substitution-compatible" ? -1 : 1;
  }
  return (
    compareCodeUnits(
      pageTieFingerprint(left, familyIdentityKey, request),
      pageTieFingerprint(right, familyIdentityKey, request),
    ) || compareCodeUnits(left.identityKey, right.identityKey)
  );
}

function eligibleFamilies(
  authority: TrustedSelectionAuthority,
  maps: AuthorityMaps,
): readonly FamilyEntry[] {
  const exactExclusions = new Set(authority.request.excludedFamilyCandidateIdentityKeys);
  const topologyExclusions = new Set(authority.request.excludedFamilyTopologyFingerprints);
  const familyIds = new Set(authority.request.eligibleFamilyIds);
  const inScope = [...maps.families.values()].filter(
    (entry) =>
      familyIds.has(entry.candidate.familyId) &&
      !exactExclusions.has(entry.identityKey) &&
      !topologyExclusions.has(entry.topology.normalizedTopology.topologyFingerprint),
  );
  if (inScope.length === 0) return fail("no-eligible-family-candidates");
  const compatible = inScope.filter(({ evaluation }) => evaluation.status !== "incompatible");
  if (compatible.length === 0) return fail("no-compatible-family-candidates");
  return compatible.sort((left, right) => compareFamilies(left, right, authority.request));
}

function candidatePools(
  family: FamilyEntry,
  maps: AuthorityMaps,
  request: StructuralStorefrontDeterministicSelectionRequestV1,
): readonly (readonly PageEntry[])[] {
  return structuralStorefrontPageFamilyIds.map((pageFamilyId) => {
    const profile = family.candidate.pageFamilyProfiles.find(
      (entry) => entry.pageFamilyId === pageFamilyId,
    );
    if (!profile)
      return fail("stale-selection-authority", { candidateIdentityKey: family.identityKey });
    const pool = profile.blueprintCandidates
      .map((reference) => {
        const identityKey = createPageBlueprintV2CandidateReferenceIdentityKey(reference);
        const entry = maps.pages.get(identityKey);
        if (!entry || entry.candidate.structural.pageFamilyId !== pageFamilyId) {
          return fail("stale-selection-authority", {
            pageFamilyId,
            candidateIdentityKey: identityKey,
          });
        }
        return entry;
      })
      .filter(({ evaluation }) => evaluation.status !== "incompatible");
    if (pool.length === 0) {
      return fail("no-compatible-page-family-candidates", {
        pageFamilyId,
        candidateIdentityKey: family.identityKey,
      });
    }
    return pool.sort((left, right) => comparePages(left, right, family.identityKey, request));
  });
}

function* combinations(
  pools: readonly (readonly PageEntry[])[],
  depth = 0,
  prefix: readonly PageEntry[] = [],
): Generator<readonly PageEntry[]> {
  if (depth === pools.length) {
    yield prefix;
    return;
  }
  for (const entry of pools[depth]) yield* combinations(pools, depth + 1, [...prefix, entry]);
}

function canonicalOmissions(entry: PageEntry): readonly string[] {
  const triggered = entry.evaluation.triggeredRegionIds;
  if (entry.evaluation.status !== "omission-compatible" || triggered.length === 0) {
    return fail("invalid-substitution-resolution", { candidateIdentityKey: entry.identityKey });
  }
  const defaultOrder = entry.candidate.structural.orderAlternatives.find(
    ({ id }) => id === entry.candidate.structural.defaultOrderAlternativeId,
  )?.regionIds;
  const regions = new Map(entry.candidate.structural.regions.map((region) => [region.id, region]));
  const fallbackByRegion = new Map(
    entry.candidate.omissionSubstitutionFallback.regionFallbackRules.map((rule) => [
      rule.regionId,
      rule,
    ]),
  );
  if (
    !defaultOrder ||
    triggered.some(
      (regionId) =>
        regions.get(regionId)?.requirement !== "optional" ||
        fallbackByRegion.get(regionId)?.terminalResolution !== "omit-region",
    )
  ) {
    return fail("invalid-substitution-resolution", { candidateIdentityKey: entry.identityKey });
  }
  const selected = defaultOrder.filter((regionId) => triggered.includes(regionId));
  if (canonicalValueString(selected) !== canonicalValueString(triggered)) {
    return fail("invalid-substitution-resolution", { candidateIdentityKey: entry.identityKey });
  }
  return selected;
}

function resolvePage(
  source: PageEntry,
  maps: AuthorityMaps,
): StructuralStorefrontSelectedPageFamilyCandidateV1 {
  if (source.evaluation.status === "incompatible") {
    return fail("invalid-substitution-resolution", { candidateIdentityKey: source.identityKey });
  }
  const sourceCompatibilityStatus = source.evaluation.status;
  let current = source;
  const path: string[] = [];
  const visited = new Set([source.identityKey]);
  while (current.evaluation.status === "substitution-compatible") {
    const reported = current.evaluation.compatibleSubstitutionCandidateIdentityKeys;
    const declared =
      current.candidate.omissionSubstitutionFallback.blueprintSubstitutionCandidates.map(
        createPageBlueprintV2CandidateReferenceIdentityKey,
      );
    const reportedSet = new Set(reported);
    if (
      reported.length === 0 ||
      canonicalValueString(declared.filter((identityKey) => reportedSet.has(identityKey))) !==
        canonicalValueString(reported)
    ) {
      return fail("invalid-substitution-resolution", { candidateIdentityKey: current.identityKey });
    }
    const targetIdentityKey = reported[0];
    const target = maps.pages.get(targetIdentityKey);
    if (
      !target ||
      visited.has(targetIdentityKey) ||
      target.candidate.structural.pageFamilyId !== source.candidate.structural.pageFamilyId ||
      target.evaluation.status === "incompatible"
    ) {
      return fail("invalid-substitution-resolution", { candidateIdentityKey: targetIdentityKey });
    }
    visited.add(targetIdentityKey);
    path.push(targetIdentityKey);
    current = target;
  }
  if (
    current.evaluation.status !== "directly-compatible" &&
    current.evaluation.status !== "omission-compatible"
  ) {
    return fail("invalid-substitution-resolution", { candidateIdentityKey: current.identityKey });
  }
  const omittedRegionIds =
    current.evaluation.status === "omission-compatible" ? canonicalOmissions(current) : [];
  const resolutionMode =
    source.evaluation.status === "directly-compatible"
      ? "direct"
      : source.evaluation.status === "omission-compatible"
        ? "omission"
        : "substitution";
  return {
    pageFamilyId: source.candidate.structural.pageFamilyId,
    sourceCandidateIdentityKey: source.identityKey,
    sourceExactCandidateFingerprint: source.candidate.candidateFingerprint,
    sourceNormalizedTopologyFingerprint: source.topology.normalizedTopology.topologyFingerprint,
    sourceCompatibilityStatus,
    resolutionMode,
    substitutionPathCandidateIdentityKeys: path,
    effectiveCandidateIdentityKey: current.identityKey,
    effectiveExactCandidateFingerprint: current.candidate.candidateFingerprint,
    effectiveNormalizedTopologyFingerprint: current.topology.normalizedTopology.topologyFingerprint,
    terminalCompatibilityStatus: current.evaluation.status,
    omittedRegionIds,
  };
}

function omittedTopologyRegionIds(
  selection: StructuralStorefrontSelectedPageFamilyCandidateV1,
  maps: AuthorityMaps,
): readonly string[] {
  const candidate = maps.pages.get(selection.effectiveCandidateIdentityKey)?.candidate;
  const defaultOrder = candidate?.structural.orderAlternatives.find(
    ({ id }) => id === candidate.structural.defaultOrderAlternativeId,
  )?.regionIds;
  if (!candidate || !defaultOrder) {
    return fail("invalid-substitution-resolution", {
      pageFamilyId: selection.pageFamilyId,
      candidateIdentityKey: selection.effectiveCandidateIdentityKey,
    });
  }
  return selection.omittedRegionIds.map((regionId) => {
    const index = defaultOrder.indexOf(regionId);
    if (index < 0) {
      return fail("invalid-substitution-resolution", {
        pageFamilyId: selection.pageFamilyId,
        candidateIdentityKey: selection.effectiveCandidateIdentityKey,
      });
    }
    return `r${index}`;
  });
}

function receipt(
  authority: TrustedSelectionAuthority,
  maps: AuthorityMaps,
  family: FamilyEntry,
  selections: readonly StructuralStorefrontSelectedPageFamilyCandidateV1[],
): StructuralStorefrontDeterministicSelectionReceiptV1 {
  const selectedCompleteStoreTopology = createStructuralStorefrontSelectedCompleteTopology({
    topologySchemaVersion: STRUCTURAL_STOREFRONT_SELECTED_COMPLETE_TOPOLOGY_SCHEMA_VERSION,
    pageFamilyTopologies: selections.map((selection) => ({
      pageFamilyId: selection.pageFamilyId,
      effectivePageBlueprintTopologyFingerprint: selection.effectiveNormalizedTopologyFingerprint,
      omittedTopologyRegionIds: omittedTopologyRegionIds(selection, maps),
    })),
    crossPageRelationships: family.candidate.crossPageRelationships,
  });
  return createStructuralStorefrontDeterministicSelectionReceipt({
    receiptSchemaVersion: STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_RECEIPT_SCHEMA_VERSION,
    selectionPolicyVersion: STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION,
    selectionRequestFingerprint: authority.request.requestFingerprint,
    compatibilityEvaluationFingerprint: authority.evaluation.evaluationFingerprint,
    selectedFamilyCandidate: {
      candidateIdentityKey: family.identityKey,
      familyId: family.candidate.familyId,
      familyVersion: family.candidate.familyVersion,
      exactCandidateFingerprint: family.candidate.candidateFingerprint,
      normalizedTopologyFingerprint: family.topology.normalizedTopology.topologyFingerprint,
      compatibilityStatus: family.evaluation.status,
    },
    pageFamilySelections: selections,
    selectedCompleteStoreTopology,
  });
}

export function selectDeterministicStructuralStorefrontCandidate(
  input: unknown,
): StructuralStorefrontDeterministicSelectionReceiptV1 {
  const authority = trustedAuthority(input);
  const maps = authorityMaps(authority);
  const excludedTopologies = new Set(authority.request.excludedCompleteStoreTopologyFingerprints);
  let evaluatedCombinationCount = 0;
  for (const family of eligibleFamilies(authority, maps)) {
    const pools = candidatePools(family, maps, authority.request);
    for (const combination of combinations(pools)) {
      if (
        evaluatedCombinationCount === MAX_STRUCTURAL_STOREFRONT_SELECTION_COMBINATION_EVALUATIONS
      ) {
        return fail("selection-combination-budget-exhausted", { evaluatedCombinationCount });
      }
      evaluatedCombinationCount += 1;
      const selections = combination.map((source) => resolvePage(source, maps));
      const selected = receipt(authority, maps, family, selections);
      if (!excludedTopologies.has(selected.selectedCompleteStoreTopology.topologyFingerprint)) {
        return selected;
      }
    }
  }
  return fail("insufficient-distinct-selection-capacity", { evaluatedCombinationCount });
}

export function parseStructuralStorefrontDeterministicSelectionReceipt(
  authorityInput: unknown,
  input: unknown,
): StructuralStorefrontDeterministicSelectionReceiptV1 {
  let parsed: StructuralStorefrontDeterministicSelectionReceiptV1;
  try {
    parsed = structuralStorefrontDeterministicSelectionReceiptV1Schema.parse(input);
  } catch {
    return fail("stale-selection-authority");
  }
  let expected: StructuralStorefrontDeterministicSelectionReceiptV1;
  try {
    expected = selectDeterministicStructuralStorefrontCandidate(authorityInput);
  } catch {
    return fail("stale-selection-authority");
  }
  if (canonicalValueString(parsed) !== canonicalValueString(expected)) {
    return fail("stale-selection-authority");
  }
  return expected;
}
