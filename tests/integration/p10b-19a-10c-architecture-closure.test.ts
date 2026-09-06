// @vitest-environment node

import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { readRetainedInventory } from "../helpers/p10b-19a-10a-retained-matrix-inventory";
// prettier-ignore
import { acceptedLimitations, acceptedDecisionFingerprint, closureCandidateFingerprint, closureCandidatePath, closureManifestFixtureSha256, closureManifestPath, createClosureManifest, createClosureCandidate, createProductOwnerDecision, createProductOwnerReviewPacket, deriveFinalRetainedTestFiles, exactNextTask, exactProductOwnerDecisionText, exactStatusTransition, expectedClosureFingerprint, externalClosureBaselinePath, externalClosureBaselineSha256, finalRetainedTestFiles, finalRetainedVitestCommand, parseClosureCandidate, parseClosureManifest, parseProductOwnerDecision, productOwnerDecisionPath, productOwnerReviewPacketPath, rejectPreGateClosureDecision, taskBase, verifyFrozenPredecessorBytes, writeAcceptedClosureArtifacts, writePreGateArtifacts, type ClosureCandidate } from "../helpers/p10b-19a-10c-architecture-closure";

const candidate = createClosureCandidate();
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
// prettier-ignore
const expectedChildDistribution = { A: 6, B: 7, C: 8, D: 8, E: 9, F: 8, G: 11, H: 6, I: 6, J: 4 } as const;
// prettier-ignore
const negativeZeroKeys = ["ownerMismatchCount", "terminalPhaseMismatchCount", "downstreamExecutionCount", "partialOutputCount", "sourceMutationCount", "repositoryWriteCount", "productionFileChangeCount", "automaticRepairCount", "silentNormalizationCount", "fallbackToV1Count", "fallbackToV2Count", "defaultCandidateCount", "partialReceiptCount", "partialPublicationResultCount", "snapshotMutationCount", "catalogueMutationCount", "commerceMutationCount", "mediaMutationCount", "testOnlyPublicationConfirmationCount", "externalPublicationCallCount", "providerCallCount", "veskoCallCount"] as const;
// prettier-ignore
const candidateKeys = ["candidateSchemaVersion", "authorityKind", "baseCommit", "architectureLock", "predecessorAuthority", "structuralExitEvidence", "legacyCompatibilityEvidence", "integrationEvidence", "productionBoundary", "acceptedLimitations", "exactNextTask", "closureCandidateFingerprint"] as const;
// prettier-ignore
const reviewHeadings = ["Task base and closure candidate fingerprint", "What P10B-19A now proves", "What P10B-19A explicitly does not prove", "A-10A retained matrix summary", "A-10B1 positive integration summary", "A-10B2 36-case failure summary", "A-09 legacy compatibility summary", "Production inactivity summary", "Architecture-lock integrity and 73-child result", "Accepted limitations", "Exact next task", "Recommendation"] as const;

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach((child) => expectDeepFrozen(child, seen));
}

describe("P10B-19A-10C architecture closure candidate", () => {
  it("binds the exact architecture lock and all frozen predecessor bytes", () => {
    expect(candidate.architectureLock).toMatchObject({
      fileSha256: "5292792dae97273411702eeaf468575172c0cf46b026103216423de29eaf47fd",
      numberedSectionCount: 21,
      mermaidDiagramCount: 4,
      acceptedArchitectureChildCount: 73,
      nestedDeliveryDecompositionChildDelta: 0,
      p10b19bEntryDependency: "19A constraints",
    });
    expect(candidate.architectureLock.childDistribution).toEqual(expectedChildDistribution);
    expect(verifyFrozenPredecessorBytes()).toEqual({
      fileCount: 11,
      pathSetFingerprint: candidate.predecessorAuthority.frozenPathSetFingerprint,
      byteManifestFingerprint: candidate.predecessorAuthority.frozenByteManifestFingerprint,
    });
  });

  it("binds retained, positive, fail-closed and legacy compatibility evidence", () => {
    expect(candidate.integrationEvidence.retained).toMatchObject({
      matrixEntryCount: 24,
      protectedProductionHashCount: 76,
      productionInactivityAssertionCount: 9,
      completeMatrix: { caseCount: 126, normalizedMaterialTopologyCount: 54 },
      frozenMatrix: { caseCount: 72, normalizedTopologyCount: 39 },
    });
    expect(candidate.integrationEvidence.positive).toMatchObject({
      pageBlueprintCandidateCount: 8,
      structuralFamilyCandidateCount: 6,
      compatibilityProfileCount: 6,
      capabilityContextCount: 3,
      mixedPageStatusCounts: { direct: 5, substitution: 2, omission: 1, incompatible: 0 },
      mixedFamilyStatusCounts: { direct: 0, conditional: 6, incompatible: 0 },
      sequentialDistinctSelectionCount: 3,
    });
    const negative = candidate.integrationEvidence.negative;
    expect(negative).toMatchObject({
      totalCaseCount: 36,
      passedCaseCount: 36,
      typedErrorObservationCount: 16,
      zodIssueObservationCount: 20,
      nativeErrorNullCodeCount: 3,
      authorityConfusionCaseCount: 4,
    });
    expect(negativeZeroKeys.map((key) => negative[key])).toEqual(negativeZeroKeys.map(() => 0));
    expect(candidate.legacyCompatibilityEvidence).toMatchObject({
      legacyAliasCount: 3,
      historicalRepresentativeCount: 3,
      previewObservationActualCount: 36,
      publishedObservationActualCount: 36,
      previewPublishedParityActualCount: 36,
      selectorEligibility: "legacy-v1-ineligible",
    });
  });

  it("locks structural evidence, production inactivity and the exact retained plan", () => {
    expect(candidate.structuralExitEvidence).toMatchObject({
      structuralFamilyIds: { count: 6 },
      structuralPageFamilyRoles: { count: 6 },
      crossPageRelationshipKinds: { count: 7 },
      canonicalAssetRoles: { count: 9 },
      responsiveBreakpoints: { count: 4 },
      productionCandidateRegistry: {
        state: "empty",
        pageBlueprintCandidateCount: 0,
        structuralFamilyCandidateCount: 0,
      },
      normalizedTopology: "deterministic",
      compatibilityEvaluation: "deterministic",
      selection: { method: "scoring-free-and-deterministic", combinationMaximum: 4096 },
    });
    Object.entries(candidate.productionBoundary).forEach(([key, value]) => {
      expect(value).toBe(key.startsWith("retainedA09") ? 3 : 0);
    });
    const derived = deriveFinalRetainedTestFiles(readRetainedInventory());
    expect(derived).toEqual(finalRetainedTestFiles);
    expect(derived).toHaveLength(26);
    expect(new Set(derived).size).toBe(26);
    expect(derived).toEqual([...derived].sort());
    expect(candidate.integrationEvidence.retainedPlan).toEqual({
      testFileCount: 26,
      testFileSetFingerprint:
        "v1_1686_7662d474cac69427306d3c810aa09bdf4b5310b3c34043f45927d35a36bae925",
      exactCommand: finalRetainedVitestCommand,
    });
  });

  it("is strict, deterministic, deeply frozen and cannot infer closure", () => {
    expect(Object.keys(candidate)).toEqual(candidateKeys);
    expect(candidate.baseCommit).toBe(taskBase);
    expect(candidate.exactNextTask).toBe(exactNextTask);
    expect(candidate.acceptedLimitations).toEqual(acceptedLimitations);
    expect(closureCandidateFingerprint(candidate)).toBe(candidate.closureCandidateFingerprint);
    expect(parseClosureCandidate(Object.fromEntries(Object.entries(candidate).reverse()))).toEqual(
      candidate,
    );
    expect(() => parseClosureCandidate({ ...candidate, unknown: true })).toThrow();
    const staleSuffix = candidate.closureCandidateFingerprint.endsWith("0") ? "1" : "0";
    expect(() =>
      parseClosureCandidate({
        ...candidate,
        closureCandidateFingerprint: candidate.closureCandidateFingerprint.replace(
          /.$/u,
          staleSuffix,
        ),
      }),
    ).toThrow(/stale/u);
    const unknownNested = {
      ...candidate,
      architectureLock: { ...candidate.architectureLock, unknown: true },
    };
    expect(() =>
      parseClosureCandidate({
        ...unknownNested,
        closureCandidateFingerprint: closureCandidateFingerprint(unknownNested as ClosureCandidate),
      }),
    ).toThrow();
    const reordered = {
      ...candidate,
      acceptedLimitations: [...candidate.acceptedLimitations].reverse(),
    };
    expect(() =>
      parseClosureCandidate({
        ...reordered,
        closureCandidateFingerprint: closureCandidateFingerprint(
          reordered as unknown as ClosureCandidate,
        ),
      }),
    ).toThrow();
    ["decision", "productOwnerDecision", "statusTransition", "closureFingerprint"].forEach((key) =>
      expect(candidate).not.toHaveProperty(key),
    );
    [undefined, "rejected", "accept approximately"].forEach((decision) =>
      expect(() => rejectPreGateClosureDecision(decision)).toThrow(/unavailable/u),
    );
    expectDeepFrozen(candidate);
  });

  it("creates the exact bounded twelve-section review packet", () => {
    const review = createProductOwnerReviewPacket(candidate);
    expect([...review.matchAll(/^## ([0-9]+)\. ([^\n]+)$/gmu)].map((match) => match[2])).toEqual(
      reviewHeadings,
    );
    expect(review).toContain(candidate.closureCandidateFingerprint);
    expect(review).toContain(exactNextTask);
    acceptedLimitations.forEach((limitation) => expect(review).toContain(limitation));
    expect(review).toMatch(/\*\*ACCEPT\*\*\n$/u);
    expect(review).not.toContain("ACCEPT P10B-19A STRUCTURAL ARCHITECTURE CLOSURE");
    expect(review).not.toMatch(
      /\/private\/|BEGIN [A-Z ]*PRIVATE KEY|raw source|snapshots?|product data|merchant (?:data|content)|!\[[^\]]*\]\(|data:image\/|provider payload|credentials?/iu,
    );
  });

  it("writes only the two explicitly authorized read-only pre-gate artifacts", () => {
    if (process.env.VESKIFY_A10C_WRITE_PRE_GATE !== "1") {
      expect(() => writePreGateArtifacts(candidate)).toThrow(/not authorized/u);
      return;
    }
    const paths = writePreGateArtifacts(candidate);
    expect(paths).toEqual({
      closureCandidatePath,
      productOwnerReviewPacketPath,
    });
    const artifactPaths = [paths.closureCandidatePath, paths.productOwnerReviewPacketPath];
    const candidateBytes = `${JSON.stringify(candidate, null, 2)}\n`;
    const reviewBytes = createProductOwnerReviewPacket(candidate);
    const initialStats = artifactPaths.map((target) => lstatSync(target));
    expect(initialStats.map(({ mode }) => mode & 0o777)).toEqual([0o444, 0o444]);
    expect(readFileSync(closureCandidatePath, "utf8")).toBe(candidateBytes);
    expect(parseClosureCandidate(JSON.parse(candidateBytes))).toEqual(candidate);
    expect(readFileSync(productOwnerReviewPacketPath, "utf8")).toBe(reviewBytes);
    expect(writePreGateArtifacts(candidate)).toEqual(paths);
    expect(artifactPaths.map((target) => readFileSync(target, "utf8"))).toEqual([
      candidateBytes,
      reviewBytes,
    ]);
    expect(artifactPaths.map((target) => lstatSync(target).ino)).toEqual(
      initialStats.map(({ ino }) => ino),
    );
  });

  it("binds only the exact accepted decision and deterministic final closure", () => {
    const decision = createProductOwnerDecision(candidate, exactProductOwnerDecisionText);
    const manifest = createClosureManifest(candidate, decision);
    expect(decision.decisionFingerprint).toBe(acceptedDecisionFingerprint);
    expect(manifest).toMatchObject({
      productOwnerDecision: { decisionText: exactProductOwnerDecisionText },
      statusTransition: exactStatusTransition,
      exactNextTask,
      closureFingerprint: expectedClosureFingerprint,
    });
    expect(
      parseProductOwnerDecision(Object.fromEntries(Object.entries(decision).reverse())),
    ).toEqual(decision);
    expect(parseClosureManifest(Object.fromEntries(Object.entries(manifest).reverse()))).toEqual(
      manifest,
    );
    [undefined, "rejected", "ACCEPT P10B-19A STRUCTURAL ARCHITECTURE CLOSURE "].forEach((text) =>
      expect(() => createProductOwnerDecision(candidate, text)).toThrow(),
    );
    const staleDecisionSuffix = acceptedDecisionFingerprint.endsWith("0") ? "1" : "0";
    expect(() =>
      parseProductOwnerDecision({
        ...decision,
        decisionFingerprint: acceptedDecisionFingerprint.replace(/.$/u, staleDecisionSuffix),
      }),
    ).toThrow(/stale/u);
    expectDeepFrozen(decision);
    expectDeepFrozen(manifest);
  });

  it("writes the exact accepted decision and final closure authority", () => {
    if (process.env.VESKIFY_A10C_WRITE_FINAL !== "1") {
      expect(() => writeAcceptedClosureArtifacts(exactProductOwnerDecisionText)).toThrow(
        /not authorized/u,
      );
      return;
    }
    const paths = writeAcceptedClosureArtifacts(exactProductOwnerDecisionText);
    const governedPaths = [
      paths.productOwnerDecisionPath,
      paths.closureManifestPath,
      paths.externalClosureBaselinePath,
    ];
    expect(paths).toEqual({
      productOwnerDecisionPath,
      closureManifestPath,
      externalClosureBaselinePath,
    });
    expect(governedPaths.map((target) => lstatSync(target).mode & 0o777)).toEqual([
      0o444, 0o644, 0o444,
    ]);
    expect(
      parseProductOwnerDecision(JSON.parse(readFileSync(productOwnerDecisionPath, "utf8"))),
    ).toHaveProperty("decisionFingerprint", acceptedDecisionFingerprint);
    expect(
      parseClosureManifest(JSON.parse(readFileSync(closureManifestPath, "utf8"))),
    ).toHaveProperty("closureFingerprint", expectedClosureFingerprint);
    expect(sha256(readFileSync(productOwnerDecisionPath))).toBe(
      "42f4ea06e32300490a798cf45ed32977a1d2981f1ed88b59763d9d363db6db92",
    );
    expect(sha256(readFileSync(closureManifestPath))).toBe(closureManifestFixtureSha256);
    expect(sha256(readFileSync(externalClosureBaselinePath))).toBe(externalClosureBaselineSha256);
  });
});
