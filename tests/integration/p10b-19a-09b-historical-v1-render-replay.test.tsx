import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { selectedSnapshotId } from "@/app/projects/[projectId]/preview-mode";
import {
  LegacyV1HistoricalSnapshotReadError,
  readLegacyV1HistoricalSnapshot,
} from "@/application/bounded-storefront-synthesis/legacy-v1-historical-snapshot-replay";
import { createLegacyV1StorefrontReplayReference } from "@/application/bounded-storefront-synthesis/legacy-v1-replay-authority";
import {
  createP10B16RepresentativeAuthority,
  createP10B16RepresentativeOutcome,
} from "@/data/demo/p10b-16-coordinated-directions";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  InMemoryProjectRepository,
  restoreHistoryMetadata,
  type ProjectAggregate,
} from "@/services/storage";
import {
  createP10B19A09BHistoricalRenderReplayEvidence,
  P10B19A09B_BASE_COMMIT,
  P10B19A09B_BASELINE_PATH,
} from "../helpers/p10b-19a-09b-render-observation";

const ACCEPTED_BASELINE_FILE_SHA256 =
  "e14bd08a18e63848a24fab161d50875c188fb3a49b22ae63ec9930b27a8fed06";
const ACCEPTED_BASELINE_MATERIAL_SHA256 =
  "b224390ba16a850821155874dbaf1f9a740f55004684f9982531f80716ca013f";
const FINAL_COMPARISON_PATH = "/private/tmp/veskify-p10b-19a-09b-final-replay-comparison.json";

const aliases = {
  "premium-editorial": "legacy-v1:premium-editorial",
  "modern-technical": "legacy-v1:modern-technical",
  "minimal-commerce": "legacy-v1:minimal-commerce",
} as const;

type DirectionId = keyof typeof aliases;
type ReplayEvidence = Awaited<ReturnType<typeof createP10B19A09BHistoricalRenderReplayEvidence>>;
type Representative = ReplayEvidence["representatives"][number];
type Observation = Representative["renderObservations"][number];

type FrozenBaseline = Readonly<{
  baselineSchemaVersion: "1.0.0";
  authorityKind: "historical-v1-read-render-task-base-baseline";
  baseCommit: string;
  generationCommandIdentity: string;
  baselineRecordCount: number;
  renderObservationCount: number;
  representatives: ReplayEvidence["representatives"];
  baselineFileMaterialSha256Policy: string;
  baselineFileMaterialSha256: string;
}>;

type CanonicalComparison = Readonly<{
  expected: number;
  actual: number;
  identical: number;
  mismatches: number;
}>;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareCanonical(
  expectedValues: readonly unknown[],
  actualValues: readonly unknown[],
): CanonicalComparison {
  let identical = 0;
  let mismatches = 0;
  const comparedLength = Math.max(expectedValues.length, actualValues.length);
  for (let index = 0; index < comparedLength; index += 1) {
    if (
      index < expectedValues.length &&
      index < actualValues.length &&
      canonicalValueString(expectedValues[index]) === canonicalValueString(actualValues[index])
    ) {
      identical += 1;
    } else {
      mismatches += 1;
    }
  }
  return {
    expected: expectedValues.length,
    actual: actualValues.length,
    identical,
    mismatches,
  };
}

function requireSnapshot(aggregate: ProjectAggregate, snapshotId: string): StorefrontSnapshot {
  const snapshot = aggregate.snapshots.find(({ id }) => id === snapshotId);
  if (!snapshot) throw new Error(`Missing required snapshot ${snapshotId}.`);
  return snapshot;
}

function directionId(value: string): DirectionId {
  if (Object.hasOwn(aliases, value)) return value as DirectionId;
  throw new Error(`Unknown representative direction ${value}.`);
}

function historicalRepositoryAggregate(id: DirectionId): ProjectAggregate {
  const sourceAggregate = createP10B16RepresentativeAuthority().source.fixture.aggregate;
  const historical = structuredClone(
    createP10B16RepresentativeOutcome(id, 0).synthesis.materialization.snapshot,
  );
  const currentDraft = structuredClone(
    requireSnapshot(sourceAggregate, sourceAggregate.project.draftSnapshotId),
  );
  currentDraft.id = `snapshot_lumo_current_${id.replaceAll("-", "_")}`;
  const published = structuredClone(
    requireSnapshot(sourceAggregate, sourceAggregate.project.publishedSnapshotId),
  );

  const project = {
    ...structuredClone(sourceAggregate.project),
    draftSnapshotId: currentDraft.id,
  };
  return {
    project,
    catalogue: structuredClone(sourceAggregate.catalogue),
    snapshots: [published, historical, currentDraft],
    snapshotHistoryMetadata: [restoreHistoryMetadata(project.id, historical.id)],
  };
}

function historicalState(aggregate: ProjectAggregate) {
  const currentIds = new Set([
    aggregate.project.draftSnapshotId,
    aggregate.project.publishedSnapshotId,
  ]);
  return {
    snapshots: aggregate.snapshots.filter(({ id }) => !currentIds.has(id)),
    snapshotHistoryMetadata: aggregate.snapshotHistoryMetadata ?? [],
  };
}

function productMedia(aggregate: ProjectAggregate) {
  return aggregate.catalogue.products.map(({ id, images }) => ({ id, images }));
}

function flattenedObservations(representatives: readonly Representative[]) {
  return representatives.flatMap(({ directionId, aliasId, renderObservations }) =>
    renderObservations.map((observation) => ({ directionId, aliasId, ...observation })),
  );
}

function snapshotFingerprints(representatives: readonly Representative[]) {
  return representatives.map(({ directionId, canonicalSourceSnapshotFingerprint }) => ({
    directionId,
    canonicalSourceSnapshotFingerprint,
  }));
}

function commerceFingerprints(representatives: readonly Representative[]) {
  return representatives.map(({ directionId, canonicalCommerceFingerprint }) => ({
    directionId,
    canonicalCommerceFingerprint,
  }));
}

function mediaFingerprints(representatives: readonly Representative[]) {
  return representatives.flatMap(
    ({
      directionId,
      canonicalProductMediaFingerprint,
      canonicalApprovedPresentationFingerprint,
    }) => [
      {
        directionId,
        authority: "canonical-product-media",
        fingerprint: canonicalProductMediaFingerprint,
      },
      {
        directionId,
        authority: "canonical-approved-presentation",
        fingerprint: canonicalApprovedPresentationFingerprint,
      },
    ],
  );
}

function routeProfileFrameProjection(representatives: readonly Representative[]) {
  return representatives.flatMap((representative) =>
    representative.renderObservations.map((observation) => ({
      directionId: representative.directionId,
      aliasId: representative.aliasId,
      surface: observation.surface,
      route: observation.route,
      renderTarget: observation.renderTarget,
      pageFamilyId: observation.pageFamilyId,
      pageProfileId: observation.pageProfileId,
      sharedFrameProfileId: observation.sharedFrameProfileId,
      representativeSharedFrameProfileId: representative.sharedFrameProfileId,
      homepageProfileId: representative.homepageProfileId,
      collectionProfileId: representative.collectionProfileId,
      searchProfileId: representative.searchProfileId,
      pdpProfileId: representative.pdpProfileId,
      pageAndDynamicRouteInventoryFingerprint:
        representative.pageAndDynamicRouteInventoryFingerprint,
      currentRendererAuthorityFingerprint: representative.currentRendererAuthorityFingerprint,
    })),
  );
}

function localeProjection(observations: readonly (Observation & { directionId: string })[]) {
  return observations.map(({ directionId, surface, route, locale }) => ({
    directionId,
    surface,
    route,
    locale,
  }));
}

function rendererFingerprints(representatives: readonly Representative[]) {
  return representatives.map(({ directionId, currentRendererAuthorityFingerprint }) => ({
    directionId,
    currentRendererAuthorityFingerprint,
  }));
}

describe("P10B-19A-09B historical v1 current-renderer replay", () => {
  it("matches the immutable 3 x 6 x 2 baseline and preserves historical repository authority", async () => {
    const baselineBytes = readFileSync(P10B19A09B_BASELINE_PATH);
    const baselineFileSha256 = sha256(baselineBytes);
    const baseline = JSON.parse(baselineBytes.toString("utf8")) as FrozenBaseline;
    const baselineMaterial = structuredClone(baseline) as Record<string, unknown>;
    delete baselineMaterial.baselineFileMaterialSha256;

    expect(baselineFileSha256).toBe(ACCEPTED_BASELINE_FILE_SHA256);
    expect(Object.keys(baseline).sort()).toEqual(
      [
        "authorityKind",
        "baseCommit",
        "baselineFileMaterialSha256",
        "baselineFileMaterialSha256Policy",
        "baselineRecordCount",
        "baselineSchemaVersion",
        "generationCommandIdentity",
        "renderObservationCount",
        "representatives",
      ].sort(),
    );
    expect(baseline).toMatchObject({
      baselineSchemaVersion: "1.0.0",
      authorityKind: "historical-v1-read-render-task-base-baseline",
      baseCommit: P10B19A09B_BASE_COMMIT,
      generationCommandIdentity:
        "pnpm vitest run --config /private/tmp/veskify-a09b-probe.config.mjs",
      baselineRecordCount: 3,
      renderObservationCount: 36,
      baselineFileMaterialSha256Policy:
        "SHA-256 of RFC8785-compatible canonical baseline material excluding only baselineFileMaterialSha256",
      baselineFileMaterialSha256: ACCEPTED_BASELINE_MATERIAL_SHA256,
    });
    expect(sha256(canonicalValueString(baselineMaterial))).toBe(ACCEPTED_BASELINE_MATERIAL_SHA256);
    expect(baseline.representatives).toHaveLength(baseline.baselineRecordCount);
    expect(
      baseline.representatives.reduce(
        (count, representative) => count + representative.renderObservations.length,
        0,
      ),
    ).toBe(baseline.renderObservationCount);

    const repositoryCases = await Promise.all(
      baseline.representatives.map(async (representative) => {
        const id = directionId(representative.directionId);
        const seed = historicalRepositoryAggregate(id);
        const repository = new InMemoryProjectRepository([seed]);
        const writeSpies = [
          vi.spyOn(repository, "create"),
          vi.spyOn(repository, "saveDraft"),
          vi.spyOn(repository, "publish"),
          vi.spyOn(repository, "restore"),
          vi.spyOn(repository, "restorePublishedStorefrontVersion"),
        ] as const;
        const before = await repository.get(seed.project.id);
        const requestedSnapshotId = selectedSnapshotId(
          before.project,
          "history",
          representative.sourceSnapshotId,
        );
        if (!requestedSnapshotId) {
          throw new Error("The requested historical representative identity is unavailable.");
        }
        const selected = before.snapshots.find(
          ({ id: snapshotId }) => snapshotId === requestedSnapshotId,
        );
        if (!selected) throw new Error("The requested historical representative is unavailable.");
        return {
          representative,
          id,
          seed,
          repository,
          writeSpies,
          before,
          requestedSnapshotId,
          selected,
        };
      }),
    );
    const evidence = await createP10B19A09BHistoricalRenderReplayEvidence(
      repositoryCases.map(({ id, before, selected }) => ({
        directionId: id,
        aggregate: before,
        snapshot: selected,
      })),
    );
    const expectedObservations = flattenedObservations(baseline.representatives);
    const actualObservations = flattenedObservations(evidence.representatives);
    const representativeComparison = compareCanonical(
      baseline.representatives,
      evidence.representatives,
    );
    const observationComparison = compareCanonical(expectedObservations, actualObservations);
    const snapshotFingerprintComparison = compareCanonical(
      snapshotFingerprints(baseline.representatives),
      snapshotFingerprints(evidence.representatives),
    );
    const protectedCommerceComparison = compareCanonical(
      commerceFingerprints(baseline.representatives),
      commerceFingerprints(evidence.representatives),
    );
    const protectedMediaComparison = compareCanonical(
      mediaFingerprints(baseline.representatives),
      mediaFingerprints(evidence.representatives),
    );
    const routeProfileFrameComparison = compareCanonical(
      routeProfileFrameProjection(baseline.representatives),
      routeProfileFrameProjection(evidence.representatives),
    );
    const localeComparison = compareCanonical(
      localeProjection(expectedObservations),
      localeProjection(actualObservations),
    );
    const rendererAuthorityComparison = compareCanonical(
      rendererFingerprints(baseline.representatives),
      rendererFingerprints(evidence.representatives),
    );

    let repositoryWrites = 0;
    let repositoryAggregateChanges = 0;
    let repositorySnapshotChanges = 0;
    let repositoryCatalogueChanges = 0;
    let repositoryMediaChanges = 0;
    let draftChanges = 0;
    let publishedChanges = 0;
    let historyChanges = 0;
    let snapshotCountChanges = 0;
    let projectPointerChanges = 0;
    let exactHistorySelections = 0;
    let historicalReadMismatches = 0;
    let historyMetadataSeedMismatches = 0;
    let safeValidationFailures = 0;
    let failureStateChanges = 0;
    let retryMismatches = 0;

    for (const {
      representative,
      id,
      seed,
      repository,
      before,
      requestedSnapshotId,
      selected,
    } of repositoryCases) {
      if (
        before.snapshotHistoryMetadata?.length !== 1 ||
        before.snapshotHistoryMetadata[0].projectId !== before.project.id ||
        before.snapshotHistoryMetadata[0].snapshotId !== requestedSnapshotId ||
        before.snapshotHistoryMetadata[0].reason !== "restored"
      ) {
        historyMetadataSeedMismatches += 1;
      }

      if (
        requestedSnapshotId === representative.sourceSnapshotId &&
        requestedSnapshotId !== before.project.draftSnapshotId &&
        requestedSnapshotId !== before.project.publishedSnapshotId
      ) {
        exactHistorySelections += 1;
      }

      const outcome = createP10B16RepresentativeOutcome(id, 0);
      const replayReference = createLegacyV1StorefrontReplayReference({
        aliasId: aliases[id],
        sourceSelection: outcome.narrowing,
      });
      const readResult = readLegacyV1HistoricalSnapshot({
        snapshot: selected,
        catalogue: before.catalogue,
        replayReference,
      });
      if (
        canonicalValueString(readResult.snapshot) !== canonicalValueString(selected) ||
        readResult.receipt.sourceSnapshot.snapshotId !== requestedSnapshotId ||
        readResult.receipt.sourceSnapshot.canonicalSnapshotFingerprint !==
          representative.canonicalSourceSnapshotFingerprint ||
        canonicalStorefrontContentFingerprint(selected) !==
          representative.canonicalSourceSnapshotFingerprint ||
        readResult.receipt.replayBinding?.aliasId !== representative.aliasId ||
        readResult.receipt.replayBinding?.replayReferenceFingerprint !==
          representative.replayReferenceFingerprint
      ) {
        historicalReadMismatches += 1;
      }

      const malformed = structuredClone(selected);
      malformed.pages[0].sections[0].component = "unknownHistoricalComponent";
      try {
        readLegacyV1HistoricalSnapshot({
          snapshot: malformed,
          catalogue: before.catalogue,
          replayReference,
        });
      } catch (error) {
        if (
          error instanceof LegacyV1HistoricalSnapshotReadError &&
          error.code === "invalid-legacy-v1-historical-snapshot"
        ) {
          safeValidationFailures += 1;
        }
      }
      const afterFailure = await repository.get(seed.project.id);
      failureStateChanges +=
        canonicalValueString(afterFailure) === canonicalValueString(before) ? 0 : 1;

      const retryReadResult = readLegacyV1HistoricalSnapshot({
        snapshot: selected,
        catalogue: before.catalogue,
        replayReference,
      });
      retryMismatches +=
        canonicalValueString(retryReadResult.snapshot) ===
          canonicalValueString(readResult.snapshot) &&
        canonicalValueString(retryReadResult.receipt) === canonicalValueString(readResult.receipt)
          ? 0
          : 1;

      const after = await repository.get(seed.project.id);
      repositoryAggregateChanges +=
        canonicalValueString(after) === canonicalValueString(before) ? 0 : 1;
      repositorySnapshotChanges +=
        canonicalValueString(after.snapshots) === canonicalValueString(before.snapshots) ? 0 : 1;
      repositoryCatalogueChanges +=
        canonicalValueString(after.catalogue) === canonicalValueString(before.catalogue) ? 0 : 1;
      repositoryMediaChanges +=
        canonicalValueString(productMedia(after)) === canonicalValueString(productMedia(before))
          ? 0
          : 1;
      draftChanges +=
        before.project.draftSnapshotId === after.project.draftSnapshotId &&
        canonicalValueString(requireSnapshot(before, before.project.draftSnapshotId)) ===
          canonicalValueString(requireSnapshot(after, after.project.draftSnapshotId))
          ? 0
          : 1;
      publishedChanges +=
        before.project.publishedSnapshotId === after.project.publishedSnapshotId &&
        canonicalValueString(requireSnapshot(before, before.project.publishedSnapshotId)) ===
          canonicalValueString(requireSnapshot(after, after.project.publishedSnapshotId))
          ? 0
          : 1;
      historyChanges +=
        canonicalValueString(historicalState(after)) ===
        canonicalValueString(historicalState(before))
          ? 0
          : 1;
      snapshotCountChanges += before.snapshots.length === after.snapshots.length ? 0 : 1;
      projectPointerChanges +=
        before.project.draftSnapshotId === after.project.draftSnapshotId &&
        before.project.publishedSnapshotId === after.project.publishedSnapshotId
          ? 0
          : 1;
    }
    repositoryWrites += repositoryCases.reduce(
      (count, { writeSpies }) =>
        count + writeSpies.reduce((writeCount, spy) => writeCount + spy.mock.calls.length, 0),
      0,
    );
    repositoryCases.forEach(({ writeSpies }) => writeSpies.forEach((spy) => spy.mockRestore()));

    const snapshotMutations = evidence.snapshotMutations + repositorySnapshotChanges;
    const catalogueMutations = evidence.catalogueMutations + repositoryCatalogueChanges;
    const commerceChanges = catalogueMutations + protectedCommerceComparison.mismatches;
    const mediaChanges = repositoryMediaChanges + protectedMediaComparison.mismatches;
    const routeProfileFrameMismatches = routeProfileFrameComparison.mismatches;
    const implementationCommitCandidateFingerprint = `historical-v1-render-replay-candidate-${canonicalValueFingerprint(
      {
        baseCommit: evidence.baseCommit,
        rendererAuthorityFingerprint: evidence.rendererAuthorityFingerprint,
        representatives: evidence.representatives,
      },
    )}`;
    const pass =
      baselineFileSha256 === ACCEPTED_BASELINE_FILE_SHA256 &&
      evidence.baseCommit === P10B19A09B_BASE_COMMIT &&
      evidence.renderObservationCount === 36 &&
      representativeComparison.identical === 3 &&
      representativeComparison.mismatches === 0 &&
      observationComparison.expected === 36 &&
      observationComparison.actual === 36 &&
      observationComparison.identical === 36 &&
      observationComparison.mismatches === 0 &&
      snapshotFingerprintComparison.identical === 3 &&
      snapshotFingerprintComparison.mismatches === 0 &&
      protectedCommerceComparison.identical === 3 &&
      protectedCommerceComparison.mismatches === 0 &&
      protectedMediaComparison.identical === 6 &&
      protectedMediaComparison.mismatches === 0 &&
      routeProfileFrameComparison.identical === 36 &&
      routeProfileFrameMismatches === 0 &&
      localeComparison.identical === 36 &&
      localeComparison.mismatches === 0 &&
      rendererAuthorityComparison.identical === 3 &&
      rendererAuthorityComparison.mismatches === 0 &&
      snapshotMutations === 0 &&
      repositoryWrites === 0 &&
      commerceChanges === 0 &&
      mediaChanges === 0 &&
      repositoryAggregateChanges === 0 &&
      draftChanges === 0 &&
      publishedChanges === 0 &&
      historyChanges === 0 &&
      snapshotCountChanges === 0 &&
      projectPointerChanges === 0 &&
      exactHistorySelections === 3 &&
      historicalReadMismatches === 0 &&
      historyMetadataSeedMismatches === 0 &&
      safeValidationFailures === 3 &&
      failureStateChanges === 0 &&
      retryMismatches === 0;
    const report = {
      schemaVersion: "1.0.0",
      authorityKind: "historical-v1-final-render-replay-comparison",
      baselineFileSha256,
      baselineMaterialSha256: baseline.baselineFileMaterialSha256,
      baseCommit: evidence.baseCommit,
      implementationCommitCandidateFingerprint,
      rendererAuthorityFingerprint: evidence.rendererAuthorityFingerprint,
      representativeComparison,
      observationComparison,
      snapshotFingerprintComparison,
      protectedCommerceComparison,
      protectedMediaComparison,
      routeProfileFrameComparison,
      localeComparison,
      rendererAuthorityComparison,
      repositoryIsolationComparison: {
        expectedHistorySelections: 3,
        exactHistorySelections,
        historicalReadMismatches,
        repositoryAggregateChanges,
        draftChanges,
        publishedChanges,
        historyChanges,
        snapshotCountChanges,
        projectPointerChanges,
        historyMetadataSeedMismatches,
        safeValidationFailures,
        failureStateChanges,
        retryMismatches,
      },
      snapshotMutations,
      catalogueMutations,
      repositoryWrites,
      commerceChanges,
      mediaChanges,
      routeProfileFrameMismatches,
      finalVerdict: pass ? "PASS" : "FAIL",
    } as const;

    writeFileSync(FINAL_COMPARISON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    expect(evidence.baseCommit).toBe(baseline.baseCommit);
    expect(evidence.rendererAuthorityFingerprint).toBe(
      baseline.representatives[0].currentRendererAuthorityFingerprint,
    );
    expect(evidence.renderObservationCount).toBe(baseline.renderObservationCount);
    expect(evidence.representatives).toEqual(baseline.representatives);
    expect(report).toMatchObject({
      baselineFileSha256: ACCEPTED_BASELINE_FILE_SHA256,
      baseCommit: P10B19A09B_BASE_COMMIT,
      observationComparison: { expected: 36, actual: 36, identical: 36, mismatches: 0 },
      snapshotMutations: 0,
      catalogueMutations: 0,
      repositoryWrites: 0,
      commerceChanges: 0,
      mediaChanges: 0,
      routeProfileFrameMismatches: 0,
      finalVerdict: "PASS",
    });
  });
});
