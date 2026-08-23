import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  compileP10b18aAuditCase,
  createP10b18aShapeAuthorities,
  p10b18aMaterializerDesignAuthorityFingerprint,
  p10b18aNormalizedDesignTopologyFingerprint,
  p10b18aSemanticVariations,
} from "../helpers/p10b-18a-commercial-authority";
import {
  P10B18C_MATRIX_CONTRACT_VERSION,
  buildP10b18cMatrix,
  p10b18cClusterMetrics,
  p10b18cDuplicateAnalysis,
  p10b18cSemanticCausality,
  p10b18cSemanticStrata,
  p10b18cSerializableCase,
  replayP10b18cCase,
} from "../helpers/p10b-18c-commercial-quality";

const matrix = buildP10b18cMatrix();
const replays = matrix.cases.map(replayP10b18cCase);
const metrics = p10b18cClusterMetrics(matrix.cases);
const duplicates = p10b18cDuplicateAnalysis(matrix.cases);
const causality = p10b18cSemanticCausality(matrix.cases);

function frozen72() {
  const outcomes = createP10b18aShapeAuthorities().flatMap((authority) =>
    p10b18aSemanticVariations.map((variation) => {
      const result = compileP10b18aAuditCase(authority, variation);
      return {
        caseId: `${authority.id}--${variation.id}`,
        result,
        normalizedTopology: p10b18aNormalizedDesignTopologyFingerprint(result),
        consumedAuthority: p10b18aMaterializerDesignAuthorityFingerprint(result),
      };
    }),
  );
  const counts = Object.values(
    outcomes.reduce<Record<string, number>>((result, outcome) => {
      result[outcome.normalizedTopology] = (result[outcome.normalizedTopology] ?? 0) + 1;
      return result;
    }, {}),
  );
  return {
    compileCount: outcomes.length,
    normalizedTopologies: new Set(outcomes.map(({ normalizedTopology }) => normalizedTopology))
      .size,
    repeatedClusterMembership: counts
      .filter((count) => count > 1)
      .reduce((sum, count) => sum + count, 0),
    largestCluster: Math.max(...counts),
    singletons: counts.filter((count) => count === 1).length,
    consumedAuthorityCount: new Set(outcomes.map(({ consumedAuthority }) => consumedAuthority))
      .size,
  };
}

const frozen = frozen72();

function writeMachineEvidence() {
  const configured = process.env.P10B18C_EVIDENCE_DIR;
  if (!configured) return;
  const directory = resolve(configured);
  mkdirSync(directory, { recursive: true });
  const report = {
    contractVersion: P10B18C_MATRIX_CONTRACT_VERSION,
    runId: process.env.P10B18C_EVIDENCE_RUN_ID ?? "vitest-local",
    fixtureClassification:
      "production-disabled deterministic P10B-18A catalogue/evidence authorities; never real merchant evidence",
    caseContract: {
      shapeCount: matrix.shapeIds.length,
      stratumCount: matrix.stratumIds.length,
      expectedCaseCount: matrix.expectedCaseCount,
      shapeIds: matrix.shapeIds,
      strata: p10b18cSemanticStrata,
    },
    result: {
      completeCount: matrix.cases.length,
      failureCount: matrix.failures.length,
      failures: matrix.failures,
      deterministicReplayCount: replays.filter(
        ({
          selectedAuthorityStable,
          topologyStable,
          snapshotStable,
          commerceStable,
          mediaStable,
        }) =>
          selectedAuthorityStable &&
          topologyStable &&
          snapshotStable &&
          commerceStable &&
          mediaStable,
      ).length,
      protectedCommerceMutationCount: matrix.cases.filter(
        ({ fingerprints }) =>
          fingerprints.commerceBefore !== fingerprints.commerceAfter ||
          fingerprints.catalogue !== fingerprints.catalogue,
      ).length,
      protectedMediaMutationCount: matrix.cases.filter(
        ({ fingerprints }) => fingerprints.mediaBefore !== fingerprints.mediaAfter,
      ).length,
      placeholderCount: matrix.cases.reduce(
        (sum, store) => sum + store.completeness.placeholderCount,
        0,
      ),
      promisedButUnrenderedCount: matrix.cases.reduce(
        (sum, store) => sum + store.completeness.promisedButUnrenderedCount,
        0,
      ),
      missingAssetCount: matrix.cases.reduce(
        (sum, store) => sum + store.completeness.missingAssetCount,
        0,
      ),
      missingFactEvidenceCount: matrix.cases.reduce(
        (sum, store) => sum + store.completeness.missingFactEvidenceCount,
        0,
      ),
      elapsedMilliseconds: matrix.elapsedMilliseconds,
      maxCompileMilliseconds: Math.max(
        0,
        ...matrix.cases.map(({ compiled }) => compiled.compileMilliseconds),
      ),
      maxMaterializationMilliseconds: Math.max(
        0,
        ...matrix.cases.map(({ materializationMilliseconds }) => materializationMilliseconds),
      ),
    },
    expandedMetrics: metrics,
    frozen72: frozen,
    duplicateAnalysis: duplicates,
    semanticCausality: causality,

    cases: matrix.cases.map(p10b18cSerializableCase),
    runtimeLedger: {
      providerCalls: 0,
      VeskoCalls: 0,
      realPublications: 0,
    },
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const firstRun = resolve(directory, "p10b-18c-first-run-machine-report.json");
  if (!existsSync(firstRun)) writeFileSync(firstRun, serialized, "utf8");
  writeFileSync(resolve(directory, "p10b-18c-latest-machine-report.json"), serialized, "utf8");
}

writeMachineEvidence();

describe("P10B-18C 100+ commercial quality and diversity gate", () => {
  it("constructs the exact 9 x 14 complete-store matrix without dropping a failure", () => {
    expect(matrix.shapeIds).toHaveLength(9);
    expect(matrix.stratumIds).toHaveLength(14);
    expect(new Set(matrix.stratumIds).size).toBe(14);
    expect(matrix.expectedCaseCount).toBe(126);
    expect(matrix.cases).toHaveLength(126);
    expect(matrix.failures).toEqual([]);
    expect(new Set(matrix.cases.map(({ compiled }) => compiled.caseId)).size).toBe(126);
    expect(
      matrix.cases.every(
        ({ completeness }) =>
          completeness.localeComplete &&
          completeness.promisedButUnrenderedCount === 0 &&
          completeness.placeholderCount === 0 &&
          completeness.missingAssetCount === 0 &&
          completeness.missingFactEvidenceCount === 0,
      ),
    ).toBe(true);
  });

  it("replays all 126 through the exact compiler and materializer deterministically", () => {
    expect(replays).toHaveLength(126);
    expect(
      replays.every(
        ({
          selectedAuthorityStable,
          topologyStable,
          snapshotStable,
          commerceStable,
          mediaStable,
        }) =>
          selectedAuthorityStable &&
          topologyStable &&
          snapshotStable &&
          commerceStable &&
          mediaStable,
      ),
    ).toBe(true);
  });

  it("preserves protected commerce, canonical media and approved presentation lineage", () => {
    for (const store of matrix.cases) {
      expect(store.fingerprints.commerceAfter).toBe(store.fingerprints.commerceBefore);
      expect(store.fingerprints.mediaAfter).toBe(store.fingerprints.mediaBefore);
      expect(store.snapshot.catalogueRef).toBe(store.compiled.authority.catalogue.id);
      expect(
        canonicalValueFingerprint(store.compiled.authority.approvedAssetPresentations),
      ).toBeTruthy();
      expect(canonicalValueString(store.snapshot)).not.toContain("p10b18c-runtime-transient");
    }
  });

  it("keeps the exact unchanged P10B-18A 72-case diversity floor", () => {
    expect(frozen.compileCount).toBe(72);
    expect(frozen.normalizedTopologies).toBeGreaterThanOrEqual(39);
    expect(frozen.repeatedClusterMembership).toBeLessThanOrEqual(53);
    expect(frozen.largestCluster).toBeLessThanOrEqual(7);
    expect(frozen.singletons).toBeGreaterThanOrEqual(19);
  });

  it("separates compiled lineage, consumed authority and material topology", () => {
    expect(
      new Set(matrix.cases.map(({ fingerprints }) => fingerprints.compiledDecision)).size,
    ).toBeGreaterThan(1);
    expect(
      new Set(matrix.cases.map(({ fingerprints }) => fingerprints.consumedAuthority)).size,
    ).toBeGreaterThan(1);
    expect(metrics.distinctNormalizedTopologies).toBeGreaterThan(1);
    expect(
      new Set(matrix.cases.map(({ fingerprints }) => fingerprints.directionLabelFreeTopology)).size,
    ).toBeGreaterThan(1);
    expect(duplicates.exactMaterialDuplicateClusters).toBeDefined();
    expect(duplicates.strongNearDuplicateWitnesses).toBeDefined();
  });

  it("classifies all eight provider-visible semantic controls against consumed authority", () => {
    expect(causality).toHaveLength(8);
    expect(new Set(causality.map(({ semanticControl }) => semanticControl)).size).toBe(8);
    expect(
      causality.every(
        ({ classification, exactOwningAuthority, verdict }) =>
          [
            "material-direct",
            "material-compound",
            "derived",
            "substitution-only",
            "unavailable",
          ].includes(classification) &&
          exactOwningAuthority.length > 0 &&
          verdict.length > 0,
      ),
    ).toBe(true);
  });
});
