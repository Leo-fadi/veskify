import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { readLegacyV1HistoricalSnapshot } from "@/application/bounded-storefront-synthesis/legacy-v1-historical-snapshot-replay";
// prettier-ignore
import { createLegacyV1StorefrontReplayReference, legacyV1CoordinatedDirectionReplayAliasRegistry, parseLegacyV1StorefrontReplayReference, resolveLegacyV1ReplayAlias } from "@/application/bounded-storefront-synthesis/legacy-v1-replay-authority";
// prettier-ignore
import { compileLegacyV1HistoricalPublicationReplay, parseLegacyV1HistoricalPublicationReplayReceipt } from "@/application/publishing/legacy-v1-publication-replay";
import { canonicalizePageBlueprintV2AssetRoleCompatibilityContract } from "@/application/storefront-templates/page-blueprint-v2-asset-role-contract";
// prettier-ignore
import { createPageBlueprintV2CandidateAuthority, parsePageBlueprintV2CandidateAuthority } from "@/application/storefront-templates/page-blueprint-v2-candidate-authority";
import { canonicalizePageBlueprintV2StructuralContract } from "@/application/storefront-templates/page-blueprint-v2-contract";
import { parsePageBlueprintV2NormalizedTopology } from "@/application/storefront-templates/page-blueprint-v2-normalized-topology";
import { canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract } from "@/application/storefront-templates/page-blueprint-v2-omission-substitution-fallback-contract";
import { canonicalizePageBlueprintV2ResponsiveRuleContract } from "@/application/storefront-templates/page-blueprint-v2-responsive-rule-contract";
// prettier-ignore
import { evaluateInactiveStructuralStorefrontCandidateCompatibility, parseStructuralStorefrontCandidateCompatibilityEvaluation } from "@/application/storefront-templates/structural-storefront-candidate-compatibility-evaluation";
// prettier-ignore
import { createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue, createStructuralStorefrontCapabilityContext, createStructuralStorefrontFamilyCompatibilityProfile, inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue, parseStructuralStorefrontCapabilityContext, parseStructuralStorefrontFamilyCompatibilityProfile } from "@/application/storefront-templates/structural-storefront-compatibility-contract";
// prettier-ignore
import { parseStructuralStorefrontDeterministicSelectionReceipt, selectDeterministicStructuralStorefrontCandidate } from "@/application/storefront-templates/structural-storefront-deterministic-selection";
// prettier-ignore
import { canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry, createStructuralStorefrontFamilyCandidate, inactiveStructuralStorefrontFamilyCandidateRegistry } from "@/application/storefront-templates/structural-storefront-family-candidate-registry";
// prettier-ignore
import { deriveInactiveCandidateNormalizedTopologyIndex, parseStructuralStorefrontFamilyNormalizedTopology } from "@/application/storefront-templates/structural-storefront-family-normalized-topology";
// prettier-ignore
import { createStructuralStorefrontDeterministicSelectionRequest, parseStructuralStorefrontDeterministicSelectionRequest } from "@/application/storefront-templates/structural-storefront-selection-contract";
// prettier-ignore
import { createP10B16RepresentativeAuthority, createP10B16RepresentativeOutcome } from "@/data/demo/p10b-16-coordinated-directions";
// prettier-ignore
import { canonicalStorefrontContentFingerprint, canonicalValueFingerprint, canonicalValueString, type StorefrontSnapshot } from "@/domain/storefront";
import { restoreHistoryMetadata, type ProjectAggregate } from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";

import { retainedInventoryPath } from "./p10b-19a-10a-retained-matrix-inventory";
// prettier-ignore
import { createPositiveCrossAuthorityIntegrationAuthority, positiveIntegrationBaselinePath, readPositiveIntegrationBaseline, type PositiveCrossAuthorityIntegrationAuthority } from "./p10b-19a-10b1-positive-cross-authority-integration";

const taskBase = "29f03e3e1c00c33e07cae93872877b604342f6dc" as const;
// prettier-ignore
const phases = ["page-blueprint-contract", "candidate-registry", "normalized-topology", "compatibility-evaluation", "deterministic-selection", "legacy-v1-alias", "legacy-v1-historical-read", "legacy-v1-publication-replay"] as const;
// prettier-ignore
const corruptionClasses = ["schema", "identity", "reference", "cycle", "stale-fingerprint", "compatibility", "selection-capacity", "authority-confusion"] as const;
type PhaseId = (typeof phases)[number];
type CorruptionClass = (typeof corruptionClasses)[number];
type B1 = PositiveCrossAuthorityIntegrationAuthority;
type IssueProjection = Readonly<{ code: string; path: readonly (string | number)[] }>;
type ExpectedFailure =
  | Readonly<{ kind: "typed-error"; name: string; code: string | null }>
  | Readonly<{ kind: "zod-issues"; issues: readonly IssueProjection[] }>;

const typed = (name: string, code: string | null): ExpectedFailure => ({
  kind: "typed-error",
  name,
  code,
});
const issues = (...entries: readonly (readonly [string, readonly (string | number)[]])[]) =>
  ({
    kind: "zod-issues",
    issues: entries.map(([code, issuePath]) => ({ code, path: issuePath })),
  }) as const satisfies ExpectedFailure;
const caseSpec = (
  caseId: string,
  ownerTaskId: string,
  expectedTerminalPhaseId: PhaseId,
  corruptionClass: CorruptionClass,
  failure: ExpectedFailure,
) => ({ caseId, ownerTaskId, expectedTerminalPhaseId, corruptionClass, failure });

// prettier-ignore
export const failureCaseCatalogue = Object.freeze([
  caseSpec("a03-unknown-relationship-endpoint", "P10B-19A-03", "page-blueprint-contract", "reference", issues(["custom", ["relationships"]])),
  caseSpec("a03-precedence-cycle", "P10B-19A-03", "page-blueprint-contract", "cycle", issues(["custom", ["orderAlternatives", 0, "regionIds"]], ["custom", ["relationships"]], ["custom", ["relationships"]])),
  caseSpec("a04-unknown-region-requirement", "P10B-19A-04", "page-blueprint-contract", "reference", issues(["custom", ["regionAssetRequirements"]])),
  caseSpec("a04-required-role-zero-minimum", "P10B-19A-04", "page-blueprint-contract", "schema", issues(["custom", ["regionAssetRequirements", 0, "roleRequirements", 0, "cardinality", "minimum"]])),
  caseSpec("a05-missing-breakpoint", "P10B-19A-05", "page-blueprint-contract", "schema", issues(["custom", ["breakpointRules"]], ["too_small", ["breakpointRules"]])),
  caseSpec("a05-incompatible-relationship-transformation", "P10B-19A-05", "page-blueprint-contract", "compatibility", issues(["custom", ["breakpointRules", 0, "relationshipTransformations", 0, "transformation"]])),
  caseSpec("a06-required-region-omit", "P10B-19A-06", "page-blueprint-contract", "compatibility", issues(["custom", ["regionFallbackRules", 0, "terminalResolution"]])),
  caseSpec("a06-source-blueprint-substitution-target", "P10B-19A-06", "page-blueprint-contract", "reference", issues(["custom", ["blueprintSubstitutionCandidates", 0, "blueprintId"]])),
  caseSpec("a07-child-blueprint-identity-mismatch", "P10B-19A-07", "candidate-registry", "identity", issues(["custom", ["blueprintId"]])),
  caseSpec("a07-stale-page-candidate-fingerprint", "P10B-19A-07", "candidate-registry", "stale-fingerprint", issues(["custom", ["candidateFingerprint"]])),
  caseSpec("a07-unknown-family-blueprint-reference", "P10B-19A-07", "candidate-registry", "reference", issues(["custom", ["familyCandidates", 0, "pageFamilyProfiles", 0, "blueprintCandidates", 0]])),
  caseSpec("a07-wrong-page-family-reference", "P10B-19A-07", "candidate-registry", "reference", issues(["custom", ["familyCandidates", 0, "pageFamilyProfiles", 0, "blueprintCandidates", 0]])),
  caseSpec("a07-substitution-cycle", "P10B-19A-07", "candidate-registry", "cycle", issues(["custom", ["pageBlueprintCandidates"]])),
  caseSpec("a08a-stale-page-topology-fingerprint", "P10B-19A-08A", "normalized-topology", "stale-fingerprint", issues(["custom", ["topologyFingerprint"]])),
  caseSpec("a08a-stale-family-topology-fingerprint", "P10B-19A-08A", "normalized-topology", "stale-fingerprint", issues(["custom", ["topologyFingerprint"]])),
  caseSpec("a08b-active-locale-not-available", "P10B-19A-08B", "compatibility-evaluation", "compatibility", issues(["custom", ["activeLocale"]])),
  caseSpec("a08b-missing-candidate-capacity-evidence", "P10B-19A-08B", "compatibility-evaluation", "schema", typed("Error", null)),
  caseSpec("a08b-stale-candidate-evidence-fingerprint", "P10B-19A-08B", "compatibility-evaluation", "stale-fingerprint", typed("Error", null)),
  caseSpec("a08b-incomplete-condition-partition", "P10B-19A-08B", "compatibility-evaluation", "compatibility", issues(["custom", ["conditionPolicies", 0]])),
  caseSpec("a08b-profile-candidate-mismatch", "P10B-19A-08B", "compatibility-evaluation", "identity", typed("Error", null)),
  caseSpec("a08b-stale-evaluation-fingerprint", "P10B-19A-08B", "compatibility-evaluation", "stale-fingerprint", issues(["custom", ["evaluationFingerprint"]])),
  caseSpec("a08c-stale-request-evaluation-binding", "P10B-19A-08C", "deterministic-selection", "stale-fingerprint", typed("StructuralStorefrontDeterministicSelectionError", "stale-selection-authority")),
  caseSpec("a08c-no-eligible-family-candidates", "P10B-19A-08C", "deterministic-selection", "selection-capacity", typed("StructuralStorefrontDeterministicSelectionError", "no-eligible-family-candidates")),
  caseSpec("a08c-no-compatible-family-candidates", "P10B-19A-08C", "deterministic-selection", "compatibility", typed("StructuralStorefrontDeterministicSelectionError", "no-compatible-family-candidates")),
  caseSpec("a08c-invalid-substitution-resolution", "P10B-19A-08C", "deterministic-selection", "compatibility", typed("StructuralStorefrontDeterministicSelectionError", "stale-selection-authority")),
  caseSpec("a08c-insufficient-distinct-selection-capacity", "P10B-19A-08C", "deterministic-selection", "selection-capacity", typed("StructuralStorefrontDeterministicSelectionError", "insufficient-distinct-selection-capacity")),
  caseSpec("a08c-stale-selection-receipt", "P10B-19A-08C", "deterministic-selection", "stale-fingerprint", typed("StructuralStorefrontDeterministicSelectionError", "stale-selection-authority")),
  caseSpec("a08c-production-empty-registry-fail-closed", "P10B-19A-08C", "deterministic-selection", "selection-capacity", typed("StructuralStorefrontDeterministicSelectionError", "no-eligible-family-candidates")),
  caseSpec("a09a-alias-direction-mismatch", "P10B-19A-09A", "legacy-v1-alias", "identity", typed("LegacyV1ReplayAuthorityError", "legacy-v1-alias-direction-mismatch")),
  caseSpec("a09a-stale-replay-reference", "P10B-19A-09A", "legacy-v1-alias", "stale-fingerprint", typed("LegacyV1ReplayAuthorityError", "stale-legacy-v1-replay-reference")),
  caseSpec("a09b-explicit-replay-persisted-authority-mismatch", "P10B-19A-09B", "legacy-v1-historical-read", "compatibility", typed("LegacyV1HistoricalSnapshotReadError", "legacy-v1-historical-replay-authority-mismatch")),
  caseSpec("a09c-publication-source-snapshot-mismatch", "P10B-19A-09C", "legacy-v1-publication-replay", "identity", typed("LegacyV1HistoricalPublicationReplayError", "legacy-v1-publication-source-mismatch")),
  caseSpec("legacy-alias-as-v2-family-id", "P10B-19A-07", "candidate-registry", "authority-confusion", issues(["invalid_value", ["familyCandidates", 0, "familyId"]])),
  caseSpec("v2-family-id-as-legacy-alias", "P10B-19A-09A", "legacy-v1-alias", "authority-confusion", typed("LegacyV1ReplayAuthorityError", "unknown-legacy-v1-alias")),
  caseSpec("legacy-replay-reference-as-v2-selection-request", "P10B-19A-08C", "deterministic-selection", "authority-confusion", issues(["unrecognized_keys", []], ["invalid_type", ["compatibilityEvaluationFingerprint"]], ["invalid_type", ["eligibleFamilyIds"]], ["invalid_type", ["excludedCompleteStoreTopologyFingerprints"]], ["invalid_type", ["excludedFamilyCandidateIdentityKeys"]], ["invalid_type", ["excludedFamilyTopologyFingerprints"]], ["invalid_type", ["requestFingerprint"]], ["invalid_value", ["requestSchemaVersion"]], ["invalid_type", ["selectionCaseId"]], ["invalid_value", ["selectionPolicyVersion"]])),
  caseSpec("v2-selection-receipt-as-legacy-publication-replay-receipt", "P10B-19A-09C", "legacy-v1-publication-replay", "authority-confusion", typed("LegacyV1HistoricalPublicationReplayError", "stale-legacy-v1-publication-replay-receipt")),
]);

// prettier-ignore
const representatives = [["premium-editorial", "legacy-v1:premium-editorial"], ["modern-technical", "legacy-v1:modern-technical"], ["minimal-commerce", "legacy-v1:minimal-commerce"]] as const;
type DirectionId = (typeof representatives)[number][0];

function snapshotById(aggregate: ProjectAggregate, snapshotId: string): StorefrontSnapshot {
  const snapshot = aggregate.snapshots.find(({ id }) => id === snapshotId);
  if (!snapshot) throw new Error(`Missing required snapshot ${snapshotId}.`);
  return snapshot;
}

function createA09Authority() {
  const representativeSource = createP10B16RepresentativeAuthority().source;
  const sourceAggregate = representativeSource.fixture.aggregate;
  return Object.fromEntries(
    representatives.map(([directionId, aliasId]) => {
      const outcome = createP10B16RepresentativeOutcome(directionId, 0);
      const historical = structuredClone(outcome.synthesis.materialization.snapshot);
      const currentDraft = structuredClone(
        snapshotById(sourceAggregate, sourceAggregate.project.draftSnapshotId),
      );
      currentDraft.id = `snapshot_lumo_current_${directionId.replaceAll("-", "_")}`;
      const published = structuredClone(
        snapshotById(sourceAggregate, sourceAggregate.project.publishedSnapshotId),
      );
      const project = {
        ...structuredClone(sourceAggregate.project),
        draftSnapshotId: currentDraft.id,
      };
      const aggregate = validateProjectAggregate({
        project,
        catalogue: structuredClone(sourceAggregate.catalogue),
        snapshots: [published, historical, currentDraft],
        snapshotHistoryMetadata: [restoreHistoryMetadata(project.id, historical.id)],
      });
      const canonicalHistorical = snapshotById(aggregate, historical.id);
      const replayReference = createLegacyV1StorefrontReplayReference({
        aliasId,
        sourceSelection: outcome.narrowing,
      });
      const historicalReadResult = readLegacyV1HistoricalSnapshot({
        snapshot: canonicalHistorical,
        catalogue: aggregate.catalogue,
        replayReference,
      });
      const currentEvidenceReferences = structuredClone(
        representativeSource.approvedEvidenceReferences,
      );
      return [
        directionId,
        {
          directionId,
          aliasId,
          aggregate,
          historical: canonicalHistorical,
          replayReference,
          historicalReadResult,
          currentEvidenceReferences,
          input: { aggregate, historicalReadResult, currentEvidenceReferences },
        },
      ];
    }),
  ) as Readonly<Record<DirectionId, A09Fixture>>;
}

// prettier-ignore
type A09Fixture = Readonly<{ directionId: DirectionId; aliasId: (typeof representatives)[number][1]; aggregate: ProjectAggregate; historical: StorefrontSnapshot; replayReference: ReturnType<typeof createLegacyV1StorefrontReplayReference>; historicalReadResult: ReturnType<typeof readLegacyV1HistoricalSnapshot>; currentEvidenceReferences: ReturnType<typeof createP10B16RepresentativeAuthority>["source"]["approvedEvidenceReferences"]; input: Parameters<typeof compileLegacyV1HistoricalPublicationReplay>[0] }>;
type A09 = ReturnType<typeof createA09Authority>;

const fingerprint = (value: unknown): string => canonicalValueFingerprint(value);
const staleFingerprint = (value: string): string =>
  `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
// prettier-ignore
const home = (authority: B1) => required(authority.candidateRegistry.pageBlueprintCandidates.find(({ structural }) => structural.id === "test-a10b1-home-primary"), "home candidate");
// prettier-ignore
const family = (authority: B1, familyId: string) => required(authority.candidateRegistry.familyCandidates.find((entry) => entry.familyId === familyId), `${familyId} family`);
// prettier-ignore
const profile = (authority: B1, familyId: string) => required(authority.compatibilityProfileCatalogue.profiles.find((entry) => entry.familyId === familyId), `${familyId} profile`);
function required<Value>(value: Value | undefined, label: string): Value {
  if (value === undefined) throw new Error(`Missing ${label}.`);
  return value;
}

function stateProjection(authority: B1, legacy: A09) {
  // prettier-ignore
  const aliases = { registry: legacyV1CoordinatedDirectionReplayAliasRegistry, replayReferences: representatives.map(([id]) => legacy[id].replayReference) };
  // prettier-ignore
  const snapshots = representatives.map(([id]) => ({ directionId: id, snapshotFingerprint: canonicalStorefrontContentFingerprint(legacy[id].historical), catalogueFingerprint: fingerprint(legacy[id].aggregate.catalogue) }));
  // prettier-ignore
  const aggregates = representatives.map(([id]) => ({ directionId: id, aggregateFingerprint: fingerprint(legacy[id].aggregate), readSnapshotFingerprint: canonicalStorefrontContentFingerprint(legacy[id].historicalReadResult.snapshot as StorefrontSnapshot), readReceiptFingerprint: legacy[id].historicalReadResult.receipt.receiptFingerprint, currentEvidenceReferencesFingerprint: fingerprint(legacy[id].currentEvidenceReferences) }));
  // prettier-ignore
  return { b1FixtureRoot: fingerprint(authority), candidateRegistry: fingerprint(authority.candidateRegistry), normalizedTopologyIndex: fingerprint(authority.normalizedTopologyIndex), capabilityContexts: fingerprint(authority.contexts), profileCatalogue: fingerprint(authority.compatibilityProfileCatalogue), compatibilityEvaluations: fingerprint(authority.evaluations), selectionRequestsAndReceipts: fingerprint(authority.selections), legacyAliases: fingerprint(aliases), a09bSourceSnapshots: fingerprint(snapshots), a09cSourceAggregates: fingerprint(aggregates) };
}

// prettier-ignore
type CorruptionPlan = Readonly<{ source: unknown; corruptedAuthorityKind: string; projection: unknown; invoke: () => unknown }>;
// prettier-ignore
const corruptionPlan = (source: unknown, corruptedAuthorityKind: string, projection: unknown, invoke: () => unknown): CorruptionPlan => ({ source, corruptedAuthorityKind, projection, invoke });

function selectorInput(
  authority: B1,
  context: B1["contexts"][keyof B1["contexts"]],
  evaluation: B1["evaluations"][keyof B1["evaluations"]],
  selectionRequest: unknown,
) {
  // prettier-ignore
  return { candidateRegistry: authority.candidateRegistry, normalizedTopologyIndex: authority.normalizedTopologyIndex, capabilityContext: context, compatibilityProfileCatalogue: authority.compatibilityProfileCatalogue, compatibilityEvaluation: evaluation, selectionRequest };
}

function recreatedRequest(
  expectedEvaluationFingerprint: string,
  source: { readonly requestFingerprint: string },
  changes: Readonly<Record<string, unknown>>,
) {
  const { requestFingerprint: _requestFingerprint, ...material } = source;
  void _requestFingerprint;
  return createStructuralStorefrontDeterministicSelectionRequest(expectedEvaluationFingerprint, {
    ...material,
    ...changes,
  });
}

function planFor(caseId: string, authority: B1, legacy: A09): CorruptionPlan {
  const candidate = home(authority);
  const [firstRegion, secondRegion] = candidate.structural.regions;
  // prettier-ignore
  const directEvaluationAuthority = { candidateRegistry: authority.candidateRegistry, normalizedTopologyIndex: authority.normalizedTopologyIndex, capabilityContext: authority.contexts.directEn, compatibilityProfileCatalogue: authority.compatibilityProfileCatalogue };
  // prettier-ignore
  const directSelector = (selectionRequest: unknown) => selectorInput(authority, authority.contexts.directEn, authority.evaluations.directEn, selectionRequest);
  switch (caseId) {
    case "a03-unknown-relationship-endpoint": {
      // prettier-ignore
      const relationship = { sourceRegionId: firstRegion.id, relationshipKind: "anchors", targetRegionId: "test-a10b2-unknown-region" };
      const corrupted = {
        ...candidate.structural,
        relationships: [...candidate.structural.relationships, relationship],
      };
      // prettier-ignore
      return corruptionPlan(candidate.structural, "page-blueprint-v2-structural-contract", { addedRelationship: `${firstRegion.id}->anchors->unknown-region` }, () => canonicalizePageBlueprintV2StructuralContract(corrupted));
    }
    case "a03-precedence-cycle": {
      // prettier-ignore
      const relationships = [{ sourceRegionId: firstRegion.id, relationshipKind: "precedes", targetRegionId: secondRegion.id }, { sourceRegionId: secondRegion.id, relationshipKind: "precedes", targetRegionId: firstRegion.id }];
      const projection = {
        introducedCycle: relationships.map(({ sourceRegionId, targetRegionId }) => [
          sourceRegionId,
          targetRegionId,
        ]),
      };
      // prettier-ignore
      return corruptionPlan(candidate.structural, "page-blueprint-v2-structural-contract", projection, () => canonicalizePageBlueprintV2StructuralContract({ ...candidate.structural, relationships }));
    }
    case "a04-unknown-region-requirement": {
      const requirements = candidate.assetRoleCompatibility.regionAssetRequirements.map(
        (entry, index) =>
          index === 0 ? { ...entry, regionId: "test-a10b2-unknown-region" } : entry,
      );
      const corrupted = {
        ...candidate.assetRoleCompatibility,
        regionAssetRequirements: requirements,
      };
      // prettier-ignore
      return corruptionPlan(candidate.assetRoleCompatibility, "page-blueprint-v2-asset-role-contract", { replacedRegionId: "test-a10b2-unknown-region" }, () => canonicalizePageBlueprintV2AssetRoleCompatibilityContract(candidate.structural, corrupted));
    }
    case "a04-required-role-zero-minimum": {
      const region = candidate.assetRoleCompatibility.regionAssetRequirements[0];
      const role = region.roleRequirements[0];
      // prettier-ignore
      const requirements = [{ ...region, roleRequirements: [{ ...role, cardinality: { ...role.cardinality, minimum: 0 } }, ...region.roleRequirements.slice(1)] }, ...candidate.assetRoleCompatibility.regionAssetRequirements.slice(1)];
      const corrupted = {
        ...candidate.assetRoleCompatibility,
        regionAssetRequirements: requirements,
      };
      // prettier-ignore
      return corruptionPlan(candidate.assetRoleCompatibility, "page-blueprint-v2-asset-role-contract", { field: "cardinality.minimum", replacement: 0 }, () => canonicalizePageBlueprintV2AssetRoleCompatibilityContract(candidate.structural, corrupted));
    }
    case "a05-missing-breakpoint": {
      const breakpointRules = candidate.responsiveRules.breakpointRules.filter(
        ({ breakpoint }) => breakpoint !== "wide",
      );
      const corrupted = { ...candidate.responsiveRules, breakpointRules };
      // prettier-ignore
      return corruptionPlan(candidate.responsiveRules, "page-blueprint-v2-responsive-rule-contract", { removedBreakpoint: "wide" }, () => canonicalizePageBlueprintV2ResponsiveRuleContract(candidate.structural, corrupted));
    }
    case "a05-incompatible-relationship-transformation": {
      const relationshipKey = `${firstRegion.id}->precedes->${secondRegion.id}`;
      const [mobile, ...remaining] = candidate.responsiveRules.breakpointRules;
      // prettier-ignore
      const breakpointRules = [{ ...mobile, relationshipTransformations: [{ relationshipKey, transformation: "stack" }] }, ...remaining];
      const corrupted = { ...candidate.responsiveRules, breakpointRules };
      // prettier-ignore
      return corruptionPlan(candidate.responsiveRules, "page-blueprint-v2-responsive-rule-contract", { relationshipKey, transformation: "stack" }, () => canonicalizePageBlueprintV2ResponsiveRuleContract(candidate.structural, corrupted));
    }
    case "a06-required-region-omit": {
      const [fallback, ...remaining] = candidate.omissionSubstitutionFallback.regionFallbackRules;
      const regionFallbackRules = [
        { ...fallback, terminalResolution: "omit-region" },
        ...remaining,
      ];
      const corrupted = { ...candidate.omissionSubstitutionFallback, regionFallbackRules };
      // prettier-ignore
      return corruptionPlan(candidate.omissionSubstitutionFallback, "page-blueprint-v2-fallback-contract", { regionId: fallback.regionId, terminalResolution: "omit-region" }, () => canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract(candidate.structural, candidate.assetRoleCompatibility, candidate.responsiveRules, corrupted));
    }
    case "a06-source-blueprint-substitution-target": {
      const reference = {
        blueprintId: candidate.structural.id,
        blueprintVersion: candidate.structural.version,
      };
      const corrupted = {
        ...candidate.omissionSubstitutionFallback,
        blueprintSubstitutionCandidates: [reference],
      };
      // prettier-ignore
      return corruptionPlan(candidate.omissionSubstitutionFallback, "page-blueprint-v2-fallback-contract", { addedSubstitutionTarget: `${reference.blueprintId}@${reference.blueprintVersion}` }, () => canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract(candidate.structural, candidate.assetRoleCompatibility, candidate.responsiveRules, corrupted));
    }
    case "a07-child-blueprint-identity-mismatch": {
      const corrupted = {
        ...candidate,
        assetRoleCompatibility: {
          ...candidate.assetRoleCompatibility,
          blueprintId: "test-a10b2-other-blueprint",
        },
      };
      // prettier-ignore
      return corruptionPlan(candidate, "page-blueprint-v2-candidate-authority", { child: "assetRoleCompatibility", blueprintId: "test-a10b2-other-blueprint" }, () => parsePageBlueprintV2CandidateAuthority(corrupted));
    }
    case "a07-stale-page-candidate-fingerprint": {
      const replacement = staleFingerprint(candidate.candidateFingerprint);
      // prettier-ignore
      return corruptionPlan(candidate, "page-blueprint-v2-candidate-authority", { field: "candidateFingerprint", replacementKind: "last-hex-toggle" }, () => parsePageBlueprintV2CandidateAuthority({ ...candidate, candidateFingerprint: replacement }));
    }
    case "a07-unknown-family-blueprint-reference":
    case "a07-wrong-page-family-reference": {
      const editorial = family(authority, "editorial-offset");
      const { candidateFingerprint: _candidateFingerprint, ...material } = editorial;
      void _candidateFingerprint;
      // prettier-ignore
      const reference = caseId === "a07-unknown-family-blueprint-reference" ? { blueprintId: "test-a10b2-missing-home", blueprintVersion: "1.0.0" } : { blueprintId: "test-a10b1-collection-primary", blueprintVersion: "1.0.0" };
      const rebuilt = createStructuralStorefrontFamilyCandidate({
        ...material,
        pageFamilyProfiles: editorial.pageFamilyProfiles.map((entry) =>
          entry.pageFamilyId === "home" ? { ...entry, blueprintCandidates: [reference] } : entry,
        ),
      });
      const registry = {
        ...authority.candidateRegistry,
        familyCandidates: authority.candidateRegistry.familyCandidates.map((entry) =>
          entry.familyId === editorial.familyId ? rebuilt : entry,
        ),
      };
      // prettier-ignore
      return corruptionPlan({ editorial, registry: authority.candidateRegistry }, "inactive-structural-family-candidate-registry", { homeBlueprintReference: `${reference.blueprintId}@${reference.blueprintVersion}` }, () => canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(registry));
    }
    case "a07-substitution-cycle": {
      const terminal = required(
        authority.candidateRegistry.pageBlueprintCandidates.find(
          ({ structural }) => structural.id === "test-a10b1-product-detail-terminal",
        ),
        "terminal product candidate",
      );
      const { candidateFingerprint: _candidateFingerprint, ...material } = terminal;
      void _candidateFingerprint;
      const reference = {
        blueprintId: "test-a10b1-product-detail-primary",
        blueprintVersion: "1.0.0",
      };
      const rebuilt = createPageBlueprintV2CandidateAuthority({
        ...material,
        omissionSubstitutionFallback: {
          ...terminal.omissionSubstitutionFallback,
          blueprintSubstitutionCandidates: [reference],
        },
      });
      const registry = {
        ...authority.candidateRegistry,
        pageBlueprintCandidates: authority.candidateRegistry.pageBlueprintCandidates.map((entry) =>
          entry.structural.id === terminal.structural.id ? rebuilt : entry,
        ),
      };
      // prettier-ignore
      return corruptionPlan({ terminal, registry: authority.candidateRegistry }, "inactive-structural-family-candidate-registry", { cycleClosingReference: `${reference.blueprintId}@${reference.blueprintVersion}` }, () => canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(registry));
    }
    case "a08a-stale-page-topology-fingerprint": {
      const topology = authority.normalizedTopologyIndex.pageBlueprintEntries[0].normalizedTopology;
      // prettier-ignore
      return corruptionPlan({ topology, index: authority.normalizedTopologyIndex }, "page-blueprint-v2-normalized-topology", { field: "topologyFingerprint", replacementKind: "last-hex-toggle" }, () => parsePageBlueprintV2NormalizedTopology({ ...topology, topologyFingerprint: staleFingerprint(topology.topologyFingerprint) }));
    }
    case "a08a-stale-family-topology-fingerprint": {
      const topology = authority.normalizedTopologyIndex.familyEntries[0].normalizedTopology;
      // prettier-ignore
      return corruptionPlan({ topology, index: authority.normalizedTopologyIndex }, "structural-family-normalized-topology", { field: "topologyFingerprint", replacementKind: "last-hex-toggle" }, () => parseStructuralStorefrontFamilyNormalizedTopology({ ...topology, topologyFingerprint: staleFingerprint(topology.topologyFingerprint) }));
    }
    case "a08b-active-locale-not-available": {
      const context = authority.contexts.directEn;
      // prettier-ignore
      return corruptionPlan({ context, registry: authority.candidateRegistry }, "structural-storefront-capability-context", { availableLocales: ["fi"], retainedActiveLocale: "en" }, () => parseStructuralStorefrontCapabilityContext(authority.candidateRegistry, { ...context, availableLocales: ["fi"] }));
    }
    case "a08b-missing-candidate-capacity-evidence": {
      const context = authority.contexts.directEn;
      const evidence = context.pageBlueprintAssetRoleCapacityEvidence.slice(1);
      // prettier-ignore
      return corruptionPlan({ context, registry: authority.candidateRegistry }, "structural-storefront-capability-context", { removedCapacityEvidenceCount: 1 }, () => parseStructuralStorefrontCapabilityContext(authority.candidateRegistry, { ...context, pageBlueprintAssetRoleCapacityEvidence: evidence }));
    }
    case "a08b-stale-candidate-evidence-fingerprint": {
      const context = authority.contexts.directEn;
      const first = context.pageBlueprintAssetRoleCapacityEvidence[0];
      const replacement =
        context.pageBlueprintAssetRoleCapacityEvidence[1].exactCandidateFingerprint;
      const evidence = [
        { ...first, exactCandidateFingerprint: replacement },
        ...context.pageBlueprintAssetRoleCapacityEvidence.slice(1),
      ];
      // prettier-ignore
      return corruptionPlan({ context, registry: authority.candidateRegistry }, "structural-storefront-capability-context", { field: "exactCandidateFingerprint", replacementKind: "other-candidate" }, () => parseStructuralStorefrontCapabilityContext(authority.candidateRegistry, { ...context, pageBlueprintAssetRoleCapacityEvidence: evidence }));
    }
    case "a08b-incomplete-condition-partition": {
      const editorialProfile = profile(authority, "editorial-offset");
      const conditionPolicies = editorialProfile.conditionPolicies.map((policy, index) =>
        index === 0
          ? {
              ...policy,
              incompatibleValues: policy.incompatibleValues.filter((value) => value !== "rich"),
            }
          : policy,
      );
      // prettier-ignore
      return corruptionPlan({ profile: editorialProfile, catalogue: authority.compatibilityProfileCatalogue }, "structural-family-compatibility-profile", { dimension: "catalogue-cardinality", removedPartitionValue: "rich" }, () => parseStructuralStorefrontFamilyCompatibilityProfile(family(authority, "editorial-offset"), { ...editorialProfile, conditionPolicies }));
    }
    case "a08b-profile-candidate-mismatch": {
      const editorialProfile = profile(authority, "editorial-offset");
      // prettier-ignore
      return corruptionPlan({ profile: editorialProfile, candidate: family(authority, "campaign-modular") }, "structural-family-compatibility-profile-binding", { substitutedCandidateFamilyId: "campaign-modular" }, () => parseStructuralStorefrontFamilyCompatibilityProfile(family(authority, "campaign-modular"), editorialProfile));
    }
    case "a08b-stale-evaluation-fingerprint": {
      const evaluation = authority.evaluations.directEn;
      // prettier-ignore
      return corruptionPlan({ evaluation, authority: directEvaluationAuthority }, "structural-candidate-compatibility-evaluation", { field: "evaluationFingerprint", replacementKind: "last-hex-toggle" }, () => parseStructuralStorefrontCandidateCompatibilityEvaluation(directEvaluationAuthority, { ...evaluation, evaluationFingerprint: staleFingerprint(evaluation.evaluationFingerprint) }));
    }
    case "a08c-stale-request-evaluation-binding": {
      const request = authority.selections.localeEquivalent[0].selectionRequest;
      const source = {
        request,
        directFiContext: authority.contexts.directFi,
        directFiEvaluation: authority.evaluations.directFi,
      };
      // prettier-ignore
      return corruptionPlan(source, "deterministic-selection-request-binding", { requestLocaleAuthority: "en", receivingLocaleAuthority: "fi" }, () => selectDeterministicStructuralStorefrontCandidate(selectorInput(authority, authority.contexts.directFi, authority.evaluations.directFi, request)));
    }
    case "a08c-no-eligible-family-candidates": {
      const bundle = required(
        authority.selections.familyConstrainedDirect.find(
          ({ familyId }) => familyId === "editorial-offset",
        ),
        "editorial direct selection",
      );
      const selectionRequest = recreatedRequest(
        authority.evaluations.directEn.evaluationFingerprint,
        bundle.selectionRequest,
        { excludedFamilyCandidateIdentityKeys: ["editorial-offset@1.0.0"] },
      );
      // prettier-ignore
      return corruptionPlan({ request: bundle.selectionRequest, evaluation: authority.evaluations.directEn }, "deterministic-selection-request", { excludedFamilyCandidateIdentityKeys: ["editorial-offset@1.0.0"] }, () => selectDeterministicStructuralStorefrontCandidate(directSelector(selectionRequest)));
    }
    case "a08c-no-compatible-family-candidates": {
      const editorial = family(authority, "editorial-offset");
      const editorialProfile = profile(authority, "editorial-offset");
      const { profileFingerprint: _profileFingerprint, ...profileMaterial } = editorialProfile;
      void _profileFingerprint;
      const changedProfile = createStructuralStorefrontFamilyCompatibilityProfile(editorial, {
        ...profileMaterial,
        conditionPolicies: editorialProfile.conditionPolicies.map((policy) =>
          policy.dimension === "locale"
            ? { ...policy, supportedValues: ["fi"], incompatibleValues: ["en"] }
            : policy,
        ),
      });
      const compatibilityProfileCatalogue =
        createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
          contractSchemaVersion: "1.0.0",
          profiles: authority.compatibilityProfileCatalogue.profiles.map((entry) =>
            entry.familyId === editorial.familyId ? changedProfile : entry,
          ),
        });
      const evaluationAuthority = { ...directEvaluationAuthority, compatibilityProfileCatalogue };
      const compatibilityEvaluation =
        evaluateInactiveStructuralStorefrontCandidateCompatibility(evaluationAuthority);
      const sourceRequest = required(
        authority.selections.familyConstrainedDirect.find(
          ({ familyId }) => familyId === "editorial-offset",
        ),
        "editorial direct selection",
      ).selectionRequest;
      const selectionRequest = recreatedRequest(
        compatibilityEvaluation.evaluationFingerprint,
        sourceRequest,
        { compatibilityEvaluationFingerprint: compatibilityEvaluation.evaluationFingerprint },
      );
      const source = {
        profile: editorialProfile,
        catalogue: authority.compatibilityProfileCatalogue,
        evaluation: authority.evaluations.directEn,
        request: sourceRequest,
      };
      // prettier-ignore
      return corruptionPlan(source, "structural-family-compatibility-profile", { dimension: "locale", supportedValues: ["fi"], incompatibleValues: ["en"] }, () => selectDeterministicStructuralStorefrontCandidate({ ...evaluationAuthority, compatibilityEvaluation, selectionRequest }));
    }
    case "a08c-invalid-substitution-resolution": {
      const evaluation = authority.evaluations.mixedEn;
      const corrupted = {
        ...evaluation,
        pageBlueprintEvaluations: evaluation.pageBlueprintEvaluations.map((entry) =>
          entry.candidateIdentityKey === "test-a10b1-product-detail-primary@1.0.0"
            ? { ...entry, compatibleSubstitutionCandidateIdentityKeys: [] }
            : entry,
        ),
      };
      const projection = {
        candidateIdentityKey: "test-a10b1-product-detail-primary@1.0.0",
        compatibleSubstitutionCandidateIdentityKeys: [],
      };
      // prettier-ignore
      return corruptionPlan({ evaluation, request: authority.selections.mixed.selectionRequest }, "candidate-compatibility-evaluation", projection, () => selectDeterministicStructuralStorefrontCandidate(selectorInput(authority, authority.contexts.mixedEn, corrupted, authority.selections.mixed.selectionRequest)));
    }
    case "a08c-insufficient-distinct-selection-capacity": {
      const sourceRequest = authority.selections.sequential[0].selectionRequest;
      const excluded = authority.selections.sequential.map(
        ({ selectionReceipt }) =>
          selectionReceipt.selectedCompleteStoreTopology.topologyFingerprint,
      );
      const selectionRequest = recreatedRequest(
        authority.evaluations.directEn.evaluationFingerprint,
        sourceRequest,
        { excludedCompleteStoreTopologyFingerprints: excluded },
      );
      const source = {
        request: sourceRequest,
        sequentialReceipts: authority.selections.sequential.map(
          ({ selectionReceipt }) => selectionReceipt,
        ),
      };
      // prettier-ignore
      return corruptionPlan(source, "deterministic-selection-request", { excludedCompleteStoreTopologyCount: excluded.length }, () => selectDeterministicStructuralStorefrontCandidate(directSelector(selectionRequest)));
    }
    case "a08c-stale-selection-receipt": {
      const bundle = authority.selections.mixed;
      const selectionAuthority = selectorInput(
        authority,
        authority.contexts.mixedEn,
        authority.evaluations.mixedEn,
        bundle.selectionRequest,
      );
      const corrupted = {
        ...bundle.selectionReceipt,
        selectionFingerprint: staleFingerprint(bundle.selectionReceipt.selectionFingerprint),
      };
      // prettier-ignore
      return corruptionPlan({ receipt: bundle.selectionReceipt, authority: selectionAuthority }, "deterministic-selection-receipt", { field: "selectionFingerprint", replacementKind: "last-hex-toggle" }, () => parseStructuralStorefrontDeterministicSelectionReceipt(selectionAuthority, corrupted));
    }
    case "a08c-production-empty-registry-fail-closed": {
      const candidateRegistry = inactiveStructuralStorefrontFamilyCandidateRegistry;
      const normalizedTopologyIndex =
        deriveInactiveCandidateNormalizedTopologyIndex(candidateRegistry);
      const capabilityContext = createStructuralStorefrontCapabilityContext(candidateRegistry, {
        contextSchemaVersion: "1.0.0",
        catalogueCardinality: "sparse",
        factDepth: "sparse",
        productComplexity: "simple",
        navigationDepth: "shallow",
        activeLocale: "en",
        availableLocales: ["en"],
        pageBlueprintAssetRoleCapacityEvidence: [],
      });
      const compatibilityProfileCatalogue =
        inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue;
      const evaluationAuthority = {
        candidateRegistry,
        normalizedTopologyIndex,
        capabilityContext,
        compatibilityProfileCatalogue,
      };
      const compatibilityEvaluation =
        evaluateInactiveStructuralStorefrontCandidateCompatibility(evaluationAuthority);
      // prettier-ignore
      const selectionRequest = createStructuralStorefrontDeterministicSelectionRequest(compatibilityEvaluation.evaluationFingerprint, { requestSchemaVersion: "1.0.0", selectionPolicyVersion: "1.0.0", selectionCaseId: "p10b-19a-10b2-case-28", compatibilityEvaluationFingerprint: compatibilityEvaluation.evaluationFingerprint, eligibleFamilyIds: ["editorial-offset"], excludedFamilyCandidateIdentityKeys: [], excludedFamilyTopologyFingerprints: [], excludedCompleteStoreTopologyFingerprints: [] });
      const source = {
        b1Root: authority.candidateRegistry,
        productionEmptyRoot: candidateRegistry,
        productionEmptyCatalogue: compatibilityProfileCatalogue,
      };
      const projection = {
        rootReplacement: "production-empty",
        recomputedDependentAuthorities: ["topology", "context", "evaluation", "request"],
      };
      // prettier-ignore
      return corruptionPlan(source, "complete-selection-root-authority", projection, () => selectDeterministicStructuralStorefrontCandidate({ ...evaluationAuthority, compatibilityEvaluation, selectionRequest }));
    }
    case "a09a-alias-direction-mismatch": {
      const source = {
        aliasId: legacy["premium-editorial"].aliasId,
        sourceSelection: legacy["premium-editorial"].replayReference.sourceSelection,
      };
      // prettier-ignore
      return corruptionPlan(source, "legacy-v1-replay-alias-direction-binding", { aliasDirection: "premium-editorial", selectionDirection: "modern-technical" }, () => createLegacyV1StorefrontReplayReference({ aliasId: legacy["premium-editorial"].aliasId, sourceSelection: legacy["modern-technical"].replayReference.sourceSelection }));
    }
    case "a09a-stale-replay-reference": {
      const reference = legacy["minimal-commerce"].replayReference;
      // prettier-ignore
      return corruptionPlan(reference, "legacy-v1-replay-reference", { field: "replayFingerprint", replacementKind: "last-hex-toggle" }, () => parseLegacyV1StorefrontReplayReference({ ...reference, replayFingerprint: staleFingerprint(reference.replayFingerprint) }));
    }
    case "a09b-explicit-replay-persisted-authority-mismatch": {
      const fixture = legacy["premium-editorial"];
      const selection = fixture.replayReference.sourceSelection;
      const replayReference = createLegacyV1StorefrontReplayReference({
        aliasId: fixture.aliasId,
        sourceSelection: {
          ...selection,
          sharedFrameProfileId: "editorial-masthead",
        },
      });
      const source = {
        snapshotFingerprint: canonicalStorefrontContentFingerprint(fixture.historical),
        catalogueFingerprint: fingerprint(fixture.aggregate.catalogue),
        replayFingerprint: fixture.replayReference.replayFingerprint,
      };
      // prettier-ignore
      return corruptionPlan(source, "legacy-v1-explicit-replay-binding", { field: "sharedFrameProfileId", replacement: "editorial-masthead" }, () => readLegacyV1HistoricalSnapshot({ snapshot: fixture.historical, catalogue: fixture.aggregate.catalogue, replayReference }));
    }
    case "a09c-publication-source-snapshot-mismatch": {
      const fixture = legacy["premium-editorial"];
      const snapshot = structuredClone(fixture.historical);
      snapshot.pages[0].title.en = `${snapshot.pages[0].title.en} mismatch`;
      const source = {
        aggregate: fixture.aggregate,
        historicalReadResult: fixture.historicalReadResult,
        currentEvidenceReferences: fixture.currentEvidenceReferences,
      };
      // prettier-ignore
      return corruptionPlan(source, "legacy-v1-publication-source-snapshot", { field: "pages[0].title.en", changeKind: "content-fingerprint-mismatch" }, () => compileLegacyV1HistoricalPublicationReplay({ aggregate: fixture.aggregate, historicalReadResult: { ...fixture.historicalReadResult, snapshot }, currentEvidenceReferences: fixture.currentEvidenceReferences }));
    }
    case "legacy-alias-as-v2-family-id": {
      const registry = {
        ...authority.candidateRegistry,
        familyCandidates: authority.candidateRegistry.familyCandidates.map((entry, index) =>
          index === 0 ? { ...entry, familyId: "legacy-v1:premium-editorial" } : entry,
        ),
      };
      // prettier-ignore
      return corruptionPlan(authority.candidateRegistry, "legacy-v1-alias-in-v2-family-registry", { wrongAuthorityKind: "legacy-v1-alias", receivingField: "familyId" }, () => canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(registry));
    }
    case "v2-family-id-as-legacy-alias": {
      // prettier-ignore
      return corruptionPlan(family(authority, "editorial-offset"), "v2-family-id-in-legacy-alias-resolver", { wrongAuthorityKind: "v2-family-id", value: "editorial-offset" }, () => resolveLegacyV1ReplayAlias("editorial-offset"));
    }
    case "legacy-replay-reference-as-v2-selection-request": {
      const reference = legacy["premium-editorial"].replayReference;
      // prettier-ignore
      return corruptionPlan(reference, "legacy-v1-replay-reference-in-v2-selection-parser", { wrongAuthorityKind: "legacy-v1-replay-reference", receivingSchema: "v2-selection-request" }, () => parseStructuralStorefrontDeterministicSelectionRequest(authority.evaluations.directEn.evaluationFingerprint, reference));
    }
    case "v2-selection-receipt-as-legacy-publication-replay-receipt": {
      const receipt = authority.selections.mixed.selectionReceipt;
      // prettier-ignore
      return corruptionPlan(receipt, "v2-selection-receipt-in-legacy-publication-parser", { wrongAuthorityKind: "v2-selection-receipt", receivingSchema: "legacy-publication-replay-receipt" }, () => parseLegacyV1HistoricalPublicationReplayReceipt(receipt));
    }
    default:
      throw new Error(`Unknown A-10B2 failure case ${caseId}.`);
  }
}

// prettier-ignore
const zeroActivity = Object.freeze({ automaticRepairCount: 0, silentNormalizationCount: 0, fallbackToV1Count: 0, fallbackToV2Count: 0, defaultCandidateCount: 0, partialReceiptCount: 0, partialPublicationResultCount: 0, repositoryWriteCount: 0, snapshotMutationCount: 0, catalogueMutationCount: 0, commerceMutationCount: 0, mediaMutationCount: 0, testOnlyPublicationConfirmationCount: 0, externalPublicationCallCount: 0, providerCallCount: 0, veskoCallCount: 0 });

function compareIssue(left: IssueProjection, right: IssueProjection): number {
  return canonicalValueString(left).localeCompare(canonicalValueString(right), "en");
}
const sortedIssues = (value: readonly IssueProjection[]) => [...value].sort(compareIssue);

function observeFailure(spec: (typeof failureCaseCatalogue)[number], authority: B1, legacy: A09) {
  const before = stateProjection(authority, legacy);
  const preStateFingerprint = fingerprint(before);
  const plan = planFor(spec.caseId, authority, legacy);
  const completedPhaseIds: PhaseId[] = [];
  let caught: unknown;
  let partialOutputCount = 0;
  try {
    const output = plan.invoke();
    completedPhaseIds.push(spec.expectedTerminalPhaseId);
    partialOutputCount = output === undefined ? 0 : 1;
  } catch (error) {
    caught = error;
  }
  if (caught === undefined) throw new Error(`${spec.caseId} did not fail closed.`);

  let failureAuthorityKind: "typed-error" | "zod-issues";
  let errorName: string;
  let errorCode: string | null;
  let issuePathFingerprint: string | null;
  if (caught instanceof z.ZodError) {
    const observed = sortedIssues(
      caught.issues.map(({ code, path: issuePath }) => ({
        code,
        path: issuePath.filter(
          (entry): entry is string | number =>
            typeof entry === "string" || typeof entry === "number",
        ),
      })),
    );
    if (
      spec.failure.kind !== "zod-issues" ||
      canonicalValueString(observed) !== canonicalValueString(sortedIssues(spec.failure.issues))
    ) {
      throw new Error(`${spec.caseId} emitted unexpected Zod issue authority.`);
    }
    failureAuthorityKind = "zod-issues";
    errorName = "ZodError";
    errorCode = null;
    issuePathFingerprint = fingerprint(observed);
  } else {
    if (!(caught instanceof Error)) throw new Error(`${spec.caseId} threw a non-Error value.`);
    const code =
      "code" in caught && typeof (caught as { readonly code?: unknown }).code === "string"
        ? (caught as { readonly code: string }).code
        : null;
    if (
      spec.failure.kind !== "typed-error" ||
      caught.name !== spec.failure.name ||
      code !== spec.failure.code
    ) {
      throw new Error(`${spec.caseId} emitted unexpected typed error authority.`);
    }
    failureAuthorityKind = "typed-error";
    errorName = caught.name;
    errorCode = code;
    issuePathFingerprint = null;
  }

  const after = stateProjection(authority, legacy);
  const postStateFingerprint = fingerprint(after);
  const terminalIndex = phases.indexOf(spec.expectedTerminalPhaseId);
  const downstreamCompletedPhaseCount = completedPhaseIds.filter(
    (phase) => phases.indexOf(phase) > terminalIndex,
  ).length;
  const material = {
    caseId: spec.caseId,
    ownerTaskId: spec.ownerTaskId,
    expectedTerminalPhaseId: spec.expectedTerminalPhaseId,
    observedTerminalPhaseId: spec.expectedTerminalPhaseId,
    corruptionClass: spec.corruptionClass,
    failureAuthorityKind,
    errorName,
    errorCode,
    issuePathFingerprint,
    completedPhaseIds,
    downstreamCompletedPhaseCount,
    partialOutputCount,
    preStateFingerprint,
    postStateFingerprint,
    sourceAuthorityFingerprint: fingerprint(plan.source),
    corruptedAuthorityKind: plan.corruptedAuthorityKind,
    corruptionProjectionFingerprint: fingerprint(plan.projection),
    externalActivity: zeroActivity,
  };
  return Object.freeze({
    ...material,
    observationFingerprint: `p10b-19a-failure-observation-${fingerprint(material)}`,
  });
}

export function createFailureMatrixObservations() {
  const legacy = createA09Authority();
  return Object.freeze(
    failureCaseCatalogue.map((spec) =>
      observeFailure(spec, createPositiveCrossAuthorityIntegrationAuthority(), legacy),
    ),
  );
}

export type P10B19A10B2FailureObservationV1 = ReturnType<
  typeof createFailureMatrixObservations
>[number];

const count = z.number().int().nonnegative();
const fingerprintSchema = z.string().regex(/^(?:[a-z0-9-]+-)?v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const readonlyStrict = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.strictObject(shape).readonly();
const phaseSchema = z.enum(phases);
const activityShape = Object.fromEntries(
  Object.keys(zeroActivity).map((key) => [key, z.literal(0)]),
);
// prettier-ignore
const productionV2AuthorityCountsSchema = readonlyStrict({ pageBlueprintCandidateCount: z.literal(0), structuralFamilyCandidateCount: z.literal(0), compatibilityProfileCount: z.literal(0), capabilityContextCount: z.literal(0), compatibilityEvaluationCount: z.literal(0), selectionRequestCount: z.literal(0), selectionReceiptCount: z.literal(0), activeStructuralFamilyCount: z.literal(0), selectableStructuralFamilyCount: z.literal(0) });
// prettier-ignore
const predecessorAuthoritySchema = readonlyStrict({ a10aInventoryFingerprint: fingerprintSchema, a10aFixtureSha256: sha256Schema, a10aMatrixEntryCount: z.literal(24), a10aProtectedProductionHashCount: z.literal(76), a10aProductionInactivityAssertionCount: z.literal(9), a10aCompleteCaseCount: z.literal(126), a10aFrozenCaseCount: z.literal(72), a10b1BaselineFingerprint: fingerprintSchema, a10b1FixtureSha256: sha256Schema, a10b1PositiveObservationCounts: readonlyStrict({ pageBlueprintCandidateCount: z.literal(8), structuralFamilyCandidateCount: z.literal(6), compatibilityProfileCount: z.literal(6), capabilityContextCount: z.literal(3), familyConstrainedDirectSelectionCount: z.literal(6), mixedDirectPageStatusCount: z.literal(5), mixedSubstitutionPageStatusCount: z.literal(2), mixedOmissionPageStatusCount: z.literal(1), sequentialDistinctSelectionCount: z.literal(3) }) });
// prettier-ignore
const failureCaseSchema = readonlyStrict({ caseId: z.string().min(1), ownerTaskId: z.string().min(1), expectedTerminalPhaseId: phaseSchema, observedTerminalPhaseId: phaseSchema, corruptionClass: z.enum(corruptionClasses), failureAuthorityKind: z.enum(["typed-error", "zod-issues"]), errorName: z.string().min(1), errorCode: z.string().min(1).nullable(), issuePathFingerprint: fingerprintSchema.nullable(), completedPhaseIds: z.array(phaseSchema).readonly(), downstreamCompletedPhaseCount: count, partialOutputCount: count, preStateFingerprint: fingerprintSchema, postStateFingerprint: fingerprintSchema, observationFingerprint: fingerprintSchema });
// prettier-ignore
const aggregateEvidenceSchema = readonlyStrict({ totalCaseCount: z.literal(36), passedCaseCount: z.literal(36), ownerMismatchCount: z.literal(0), terminalPhaseMismatchCount: z.literal(0), downstreamExecutionCount: z.literal(0), partialOutputCount: z.literal(0), sourceMutationCount: z.literal(0), repositoryWriteCount: z.literal(0), externalPublicationCount: z.literal(0), providerCallCount: z.literal(0), veskoCallCount: z.literal(0), productionFileChangeCount: z.literal(0), noRepairOrFallbackCounts: readonlyStrict(activityShape), productionV2AuthorityCounts: productionV2AuthorityCountsSchema });
const baselineMaterialShape = {
  schemaVersion: z.literal("1.0.0"),
  authorityKind: z.literal("p10b-19a-fail-closed-cross-authority-matrix"),
  baseCommit: z.literal(taskBase),
  predecessorAuthority: predecessorAuthoritySchema,
  caseCount: z.literal(36),
  failureCases: z.array(failureCaseSchema).length(36).readonly(),
  aggregateEvidence: aggregateEvidenceSchema,
} as const;
const baselineMaterialSchema = readonlyStrict(baselineMaterialShape);
const failureBaselineSchema = readonlyStrict({
  ...baselineMaterialShape,
  baselineFingerprint: z
    .string()
    .regex(/^p10b-19a-fail-closed-cross-authority-matrix-v1_[1-9][0-9]*_[a-f0-9]{64}$/u),
});
export type FailureBaseline = z.infer<typeof failureBaselineSchema>;

const repositoryRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
export const failureBaselinePath = path.join(
  repositoryRoot,
  "tests/fixtures/p10b-19a-10b2-fail-closed-cross-authority-matrix.v1.json",
);
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

export function failureBaselineFingerprint(
  value: Omit<FailureBaseline, "baselineFingerprint"> | FailureBaseline,
): string {
  const { baselineFingerprint: _baselineFingerprint, ...material } = value as FailureBaseline;
  void _baselineFingerprint;
  return `p10b-19a-fail-closed-cross-authority-matrix-${fingerprint(material)}`;
}

function baselineCases(observations: readonly P10B19A10B2FailureObservationV1[]) {
  return observations.map(
    ({
      sourceAuthorityFingerprint: _source,
      corruptedAuthorityKind: _kind,
      corruptionProjectionFingerprint: _corruption,
      externalActivity: _activity,
      ...bounded
    }) => {
      void [_source, _kind, _corruption, _activity];
      return bounded;
    },
  );
}

function predecessorAuthority(authority: B1) {
  const a10a = authority.retainedInventory;
  const a10b1 = readPositiveIntegrationBaseline();
  const mixed = a10b1.compatibilityEvidence.evaluations.find(
    ({ evaluationId }) => evaluationId === "mixed-fallback-en",
  );
  if (!mixed) throw new Error("Missing A-10B1 mixed compatibility evidence.");
  return {
    a10aInventoryFingerprint: a10a.inventoryFingerprint,
    a10aFixtureSha256: sha256(readFileSync(retainedInventoryPath)),
    a10aMatrixEntryCount: a10a.matrixEntries.length,
    a10aProtectedProductionHashCount: a10a.protectedProductionAuthorities.length,
    a10aProductionInactivityAssertionCount: a10a.productionInactivityAssertions.length,
    a10aCompleteCaseCount: a10b1.a10aAuthority.completeCaseCount,
    a10aFrozenCaseCount: a10b1.a10aAuthority.frozenCaseCount,
    a10b1BaselineFingerprint: a10b1.baselineFingerprint,
    a10b1FixtureSha256: sha256(readFileSync(positiveIntegrationBaselinePath)),
    a10b1PositiveObservationCounts: {
      pageBlueprintCandidateCount: a10b1.fixtureCounts.pageBlueprintCandidateCount,
      structuralFamilyCandidateCount: a10b1.fixtureCounts.structuralFamilyCandidateCount,
      compatibilityProfileCount: a10b1.fixtureCounts.compatibilityProfileCount,
      capabilityContextCount: a10b1.fixtureCounts.capabilityContextCount,
      familyConstrainedDirectSelectionCount: a10b1.selectionEvidence.familyConstrainedDirect.length,
      mixedDirectPageStatusCount: mixed.pageStatusCounts.direct,
      mixedSubstitutionPageStatusCount: mixed.pageStatusCounts.substitution,
      mixedOmissionPageStatusCount: mixed.pageStatusCounts.omission,
      sequentialDistinctSelectionCount: a10b1.selectionEvidence.sequentialDistinct.length,
    },
  };
}

function aggregateEvidence(observations: readonly P10B19A10B2FailureObservationV1[]) {
  const expectedOwners = new Map(
    failureCaseCatalogue.map(({ caseId, ownerTaskId }) => [caseId, ownerTaskId]),
  );
  return {
    totalCaseCount: observations.length,
    passedCaseCount: observations.filter(
      (entry) =>
        entry.preStateFingerprint === entry.postStateFingerprint &&
        entry.expectedTerminalPhaseId === entry.observedTerminalPhaseId &&
        entry.downstreamCompletedPhaseCount === 0 &&
        entry.partialOutputCount === 0,
    ).length,
    ownerMismatchCount: observations.filter(
      (entry) => expectedOwners.get(entry.caseId) !== entry.ownerTaskId,
    ).length,
    terminalPhaseMismatchCount: observations.filter(
      (entry) => entry.expectedTerminalPhaseId !== entry.observedTerminalPhaseId,
    ).length,
    downstreamExecutionCount: observations.reduce(
      (sum, entry) => sum + entry.downstreamCompletedPhaseCount,
      0,
    ),
    partialOutputCount: observations.reduce((sum, entry) => sum + entry.partialOutputCount, 0),
    sourceMutationCount: observations.filter(
      (entry) => entry.preStateFingerprint !== entry.postStateFingerprint,
    ).length,
    repositoryWriteCount: 0,
    externalPublicationCount: 0,
    providerCallCount: 0,
    veskoCallCount: 0,
    productionFileChangeCount: 0,
    noRepairOrFallbackCounts: zeroActivity,
    productionV2AuthorityCounts: {
      pageBlueprintCandidateCount: 0,
      structuralFamilyCandidateCount: 0,
      compatibilityProfileCount: 0,
      capabilityContextCount: 0,
      compatibilityEvaluationCount: 0,
      selectionRequestCount: 0,
      selectionReceiptCount: 0,
      activeStructuralFamilyCount: 0,
      selectableStructuralFamilyCount: 0,
    },
  };
}

export function createFailureBaseline(): FailureBaseline {
  const observations = createFailureMatrixObservations();
  const authority = createPositiveCrossAuthorityIntegrationAuthority();
  const material = baselineMaterialSchema.parse({
    schemaVersion: "1.0.0",
    authorityKind: "p10b-19a-fail-closed-cross-authority-matrix",
    baseCommit: taskBase,
    predecessorAuthority: predecessorAuthority(authority),
    caseCount: observations.length,
    failureCases: baselineCases(observations),
    aggregateEvidence: aggregateEvidence(observations),
  });
  return parseFailureBaseline(
    {
      ...material,
      baselineFingerprint: failureBaselineFingerprint(material),
    },
    false,
  );
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}

export function parseFailureBaseline(value: unknown, verifyMaterial = true): FailureBaseline {
  const parsed = failureBaselineSchema.parse(value);
  if (failureBaselineFingerprint(parsed) !== parsed.baselineFingerprint) {
    throw new Error("Fail-closed cross-authority baseline fingerprint is stale.");
  }
  if (verifyMaterial) {
    const recreated = createFailureBaseline();
    if (canonicalValueString(parsed) !== canonicalValueString(recreated)) {
      throw new Error("Fail-closed cross-authority baseline is incomplete or noncanonical.");
    }
  }
  return deepFreeze(parsed);
}

export function readFailureBaseline(): FailureBaseline {
  return parseFailureBaseline(JSON.parse(readFileSync(failureBaselinePath, "utf8")));
}

export function failureBaselineMaterialSha256(value: FailureBaseline): string {
  const { baselineFingerprint: _baselineFingerprint, ...material } = value;
  void _baselineFingerprint;
  return sha256(canonicalValueString(material));
}
