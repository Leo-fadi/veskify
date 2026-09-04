// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as templates from "@/application/storefront-templates";
import { legacyV1CoordinatedDirectionReplayAliasIds } from "@/application/bounded-storefront-synthesis/legacy-v1-replay-authority";
// prettier-ignore
import { inactiveStructuralStorefrontFamilyCandidateRegistry, inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue } from "@/application/storefront-templates";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
// prettier-ignore
import { compileP10b18aAuditCase, createP10b18aShapeAuthorities, p10b18aNormalizedDesignTopologyFingerprint, p10b18aSemanticVariations } from "../helpers/p10b-18a-commercial-authority";
// prettier-ignore
import { buildP10b18cMatrix, p10b18cClusterMetrics, replayP10b18cCase } from "../helpers/p10b-18c-commercial-quality";
// prettier-ignore
import { currentVitestCoverage, parseRetainedInventory, protectedAuthorities, readA09Baselines, readRetainedInventory, repositoryRoot, retainedInventoryFingerprint, type RetainedInventory } from "../helpers/p10b-19a-10a-retained-matrix-inventory";

const inventory = readRetainedInventory();
const clone = () => structuredClone(inventory);
const withoutRenderIdentity = (value: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => key !== "renderTarget" && key !== "observationFingerprint",
    ),
  );
// prettier-ignore
const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(path.join(directory, entry.name)) : /\.tsx?$/u.test(entry.name) ? [path.join(directory, entry.name)] : []);

describe("P10B-19A-10A retained matrix inventory", () => {
  it("strictly locks the complete safe inventory, explicit commands and protected task-base sources", () => {
    // prettier-ignore
    expect(inventory).toMatchObject({ schemaVersion: "1.0.0", authorityKind: "p10b-19a-retained-matrix-inventory", baseCommit: "ffecc5be5d00630f90bf6bcbd17247773b38aeee" });
    // prettier-ignore
    expect([inventory.matrixEntries.length, protectedAuthorities(inventory).length, inventory.productionInactivityAssertions.length]).toEqual([24, 76, 9]);
    // prettier-ignore
    expect(inventory.matrixEntries.every(({ exactCommand }) => exactCommand.startsWith("pnpm exec vitest run tests/") && !/[?*{}]|(?:^| )--(?: |$)|\.env|\b[A-Za-z_]\w*=/u.test(exactCommand))).toBe(true);
    // prettier-ignore
    expect(canonicalValueString(inventory)).not.toMatch(/"(?:snapshot|catalogue|html|screenshot|assetUrl|merchantCopy|productData|price|inventory|customerData|providerRequest|providerResponse|credential|environmentVariable|publicationPayload)":/iu);
  });

  it("recomputes the exact accepted 126-case and frozen-72 semantic authority", () => {
    const matrix = buildP10b18cMatrix();
    const replays = matrix.cases.map(replayP10b18cCase);
    const clusters = p10b18cClusterMetrics(matrix.cases);
    const clusterSizes = Object.values(clusters.topologyCounts);
    // prettier-ignore
    const complete = { completeCaseCount: matrix.cases.length, successfulCompileCount: matrix.cases.length, successfulReplayCount: replays.filter(({ selectedAuthorityStable, topologyStable, snapshotStable, commerceStable, mediaStable }) => selectedAuthorityStable && topologyStable && snapshotStable && commerceStable && mediaStable).length, consumedAuthorityLineageCount: new Set(matrix.cases.map(({ fingerprints }) => fingerprints.consumedAuthority)).size, normalizedMaterialTopologyCount: clusters.distinctNormalizedTopologies, directionLabelFreeTopologyCount: new Set(matrix.cases.map(({ fingerprints }) => fingerprints.directionLabelFreeTopology)).size, repeatedClusterCount: clusterSizes.filter((count) => count > 1).length, repeatedMembershipCount: clusters.repeatedClusterMembership, largestRepeatedClusterSize: clusters.largestCluster, singletonCount: clusters.singletons, completeMatrixCaseSetFingerprint: canonicalValueFingerprint(matrix.cases.map(({ compiled }) => compiled.caseId).sort()) };
    // prettier-ignore
    const frozen = createP10b18aShapeAuthorities().flatMap((authority) => p10b18aSemanticVariations.map((variation) => { const before = canonicalValueString(authority.catalogue); const result = compileP10b18aAuditCase(authority, variation); expect(canonicalValueString(authority.catalogue)).toBe(before); return { caseId: `${authority.id}--${variation.id}`, topology: p10b18aNormalizedDesignTopologyFingerprint(result) }; }));
    // prettier-ignore
    const frozenSizes = Object.values(frozen.reduce<Record<string, number>>((counts, { topology }) => ({ ...counts, [topology]: (counts[topology] ?? 0) + 1 }), {}));
    // prettier-ignore
    const frozenMetrics = { frozenCaseCount: frozen.length, frozenNormalizedTopologyCount: frozenSizes.length, frozenRepeatedMembershipCount: frozenSizes.filter((count) => count > 1).reduce((sum, count) => sum + count, 0), frozenLargestClusterSize: Math.max(...frozenSizes), frozenSingletonCount: frozenSizes.filter((count) => count === 1).length, frozenMatrixCaseSetFingerprint: canonicalValueFingerprint(frozen.map(({ caseId }) => caseId).sort()) };
    expect(matrix.failures).toEqual([]);
    // prettier-ignore
    expect(matrix.cases.filter(({ fingerprints }) => fingerprints.commerceBefore !== fingerprints.commerceAfter || fingerprints.mediaBefore !== fingerprints.mediaAfter)).toEqual([]);
    expect(inventory.expectedSemanticMetrics).toMatchObject({ ...complete, ...frozenMetrics });
  }, 1_500_000);

  it("retains fresh-clone A-09 baseline identities, counts and preview/published parity", () => {
    const { a09b, a09c, file09b, material09b, file09c, material09c } = readA09Baselines();
    // prettier-ignore
    const preview = a09b.representatives.flatMap(({ directionId, aliasId, renderObservations }) => renderObservations.map((value) => ({ directionId, aliasId, ...withoutRenderIdentity(value) })));
    // prettier-ignore
    const published = a09c.representatives.flatMap(({ directionId, aliasId, publishedRendererAuthority }) => publishedRendererAuthority.renderObservations.map((value) => ({ directionId, aliasId, ...withoutRenderIdentity(value) })));
    // prettier-ignore
    const metrics = { legacyAliasCount: legacyV1CoordinatedDirectionReplayAliasIds.length, historicalRepresentativeCount: a09b.baselineRecordCount, previewObservationExpectedCount: a09b.renderObservationCount, previewObservationActualCount: preview.length, previewLocaleCount: new Set(a09b.representatives.flatMap(({ renderObservations }) => renderObservations.map(({ locale }) => locale))).size, previewSurfaceCount: new Set(a09b.representatives.flatMap(({ renderObservations }) => renderObservations.map(({ surface }) => surface))).size, previewRepositoryWriteCount: 0, previewSourceMutationCount: 0, directCompilationExpectedCount: a09c.recordCounts.directCompilations, directCompilationActualCount: a09c.recordCounts.directCompilations, preparationExpectedCount: a09c.recordCounts.preparations, preparationActualCount: a09c.recordCounts.preparations, isolatedConfirmationExpectedCount: a09c.recordCounts.isolatedConfirmations, isolatedConfirmationActualCount: a09c.recordCounts.isolatedConfirmations, publishedObservationExpectedCount: a09c.recordCounts.publishedRenderObservations, publishedObservationActualCount: published.length, previewPublishedParityExpectedCount: preview.length, previewPublishedParityActualCount: preview.filter((value, index) => canonicalValueString(value) === canonicalValueString(published[index])).length, migrationCurrentExpectedCount: a09c.representatives.length, migrationCurrentActualCount: a09c.representatives.filter(({ directCompilationAuthority }) => directCompilationAuthority.migrationStatus === "current").length, externalPublicationCallCount: a09c.mutationAndExternalActivity.externalPublicationCalls, providerCallCount: a09c.mutationAndExternalActivity.providerCalls, veskoCallCount: a09c.mutationAndExternalActivity.veskoCalls, commerceMutationCount: 0, mediaMutationCount: 0, a09bBaselineFileSha256: file09b, a09bBaselineMaterialSha256: material09b, a09cBaselineFileSha256: file09c, a09cBaselineMaterialSha256: material09c };
    expect(inventory.expectedSemanticMetrics).toMatchObject(metrics);
  });

  it("keeps all nine production authorities inactive and all governed adapters outside runtime", () => {
    // prettier-ignore
    const exportedRecords = (Object.values(templates) as unknown[]).filter(
      (value): value is Record<string, unknown> =>
        value !== null && typeof value === "object" && !Array.isArray(value),
    );
    const count = (key: string) =>
      exportedRecords.filter((value) => Object.hasOwn(value, key)).length;
    // prettier-ignore
    const inactivity: Record<string, number> = { "production-active-structural-families": 0, "production-capability-contexts": count("contextFingerprint"), "production-compatibility-evaluations": count("evaluationFingerprint"), "production-compatibility-profiles": inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue.profiles.length, "production-page-blueprint-candidates": inactiveStructuralStorefrontFamilyCandidateRegistry.pageBlueprintCandidates.length, "production-selectable-structural-families": 0, "production-selection-receipts": count("selectionFingerprint"), "production-selection-requests": count("requestFingerprint"), "production-structural-family-candidates": inactiveStructuralStorefrontFamilyCandidateRegistry.familyCandidates.length };
    inventory.productionInactivityAssertions.forEach(({ assertionId, expectedCount }) =>
      expect(inactivity[assertionId]).toBe(expectedCount),
    );
    const marker =
      /page-blueprint-v2|PageBlueprintV2|structural-storefront-(?:family-candidate|candidate-compatibility|deterministic-selection|selection-contract)|legacy-v1-(?:replay-authority|historical-snapshot-replay|publication-replay)/u;
    const allowed =
      /src\/(?:application\/storefront-templates\/|domain\/structural-storefront-family\/|application\/bounded-storefront-synthesis\/legacy-v1-historical-snapshot-replay\.ts$|application\/publishing\/legacy-v1-publication-replay\.ts$)/u;
    // prettier-ignore
    expect(sourceFiles(path.join(repositoryRoot, "src")).map((file) => path.relative(repositoryRoot, file).split(path.sep).join("/")).filter((file) => !allowed.test(file) && marker.test(readFileSync(path.join(repositoryRoot, file), "utf8")))).toEqual([]);
  });

  it("is discovered once and assigned once by the current dynamic DEVX-01 plan", async () => {
    const { discovered, required, union } = await currentVitestCoverage(inventory);
    expect(new Set(discovered).size).toBe(discovered.length);
    expect(new Set(union).size).toBe(discovered.length);
    expect(
      required.every((file) => union.filter((candidate) => candidate === file).length === 1),
    ).toBe(true);
  });

  it("rejects stale, incomplete, unsafe or expanded data and binds every material field", () => {
    const changed = [clone(), clone(), clone()];
    changed[0].expectedSemanticMetrics.completeCaseCount = 127;
    changed[1].matrixEntries[0].exactCommand +=
      " tests/unit/p10b-19a-01-structural-storefront-family.test.ts";
    changed[2].protectedProductionAuthorities[0] =
      changed[2].protectedProductionAuthorities[0].replace(/[a-f0-9]$/u, "0");
    // prettier-ignore
    changed.forEach((value) => expect(retainedInventoryFingerprint(value)).not.toBe(inventory.inventoryFingerprint));
    // prettier-ignore
    expect(() => parseRetainedInventory({ ...changed[1], inventoryFingerprint: retainedInventoryFingerprint(changed[1]) })).toThrow(/command tests/iu);
    expect(() => parseRetainedInventory({ ...inventory, unexpected: true })).toThrow();
    // prettier-ignore
    expect(() => parseRetainedInventory({ ...inventory, matrixEntries: inventory.matrixEntries.slice(1), inventoryFingerprint: retainedInventoryFingerprint({ ...inventory, matrixEntries: inventory.matrixEntries.slice(1) }) })).toThrow();
    expect(() =>
      parseRetainedInventory({
        ...inventory,
        inventoryFingerprint: inventory.inventoryFingerprint.replace(/[a-f0-9]$/u, "0"),
      }),
    ).toThrow(/stale/u);
    const unsafe = clone();
    unsafe.matrixEntries[0].exactCommand = "echo unsafe";
    unsafe.inventoryFingerprint = retainedInventoryFingerprint(unsafe);
    expect(() => parseRetainedInventory(unsafe)).toThrow(/Unsafe matrix command/u);
    const source = changed[2];
    source.inventoryFingerprint = retainedInventoryFingerprint(source);
    expect(() => parseRetainedInventory(source)).toThrow(
      /^Protected source hash mismatch: src\/.+; expected [a-f0-9]{64}; actual [a-f0-9]{64}\.$/u,
    );
    const reordered = Object.fromEntries(Object.entries(inventory).reverse()) as RetainedInventory;
    expect(retainedInventoryFingerprint(reordered)).toBe(inventory.inventoryFingerprint);
    expect(parseRetainedInventory(reordered)).toEqual(inventory);
  });
});
