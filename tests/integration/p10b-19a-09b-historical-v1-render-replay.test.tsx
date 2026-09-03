import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

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

// Byte-exact mirror of the task-approved safe baseline. Compression keeps the focused fixture
// bounded; the test verifies the decoded file hash and requires any external task artifact to
// match these exact bytes. It contains fingerprints and bounded identifiers only, never snapshots.
const CHECKED_IN_BASELINE_GZIP_BASE64 = [
  "H4sIAAAAAAACE+1c224cR5J991cQep628hqZOW+GF8Yai8Ea9mJeFoNCZEaE2DPNbm53k15hMP++J0lKoi6ULYGU5BVbYItVlVWZ",
  "lScu52RU8Z/fnJw86XzQzXqrv4xTPeO/6v6w3m2f/Pnkif/Wfeue/Gm24Yvj6W6/Pj7/j/VW5rHT9eGIHYM3q0u/2isLvrai+9WR",
  "D/9YzWuuXlz4+hJz6/vd2dn6eHVtHnVwrxy7+Cwh+6pFEw8XkzelxJ25xXx97jPd6p6PGNe8Am/lR9HtEcOZlzrfnp+dXK6Pejie",
  "7C+2J6vV2G1t/ezk6fl+fclHfXo8O396qYd/rO35il3rq/P9ruu3182+Pfv74dUI53h/1rHby/e7i+0carw6dn1z/9kPur+8GcjN",
  "Ybo5fr7XAwaFg+gKB/4bu09O/nn1jQay3uuYJ/54NX9ofba+OFuprOc88uZqCFctebPmw3WrjT7j8Rwz/Of3tEfXG37+s5pikEN/",
  "WG+f6R63fjW8V5dYTcDU9rvtcXV9Cv67OQeHF+9bWOqIlMWrds2kbKkDFuJkpVBvTaRWJfxeawjmiiUWN1odGlspVf2rUR12F/uh",
  "v2z5/HC6O17fzuFma9lcnO0Ww4SdLrJnO9512s96ub6xRveyyeDtbjst75fX2r5x37ij2GqLCwWNJbUSkibfm6+SccBb5FFKH46D",
  "xeLn8HuKGrhWm8dGrtniYHdrbKe8V/lhz2f6035n641e39YA7JhHWZ2tt+uz29Cc7s70nJ+93vzFztXp+tnptNXDWm6s+9WZY7fZ",
  "XNvL61293P3KElayPozdpe6f3xqq8n6c3nUqnAfued3m1Tnncv7aCdh+7xDnPXy3lX97vuWz9fh5d3HUH7eXmIvd/vkbYBzgnasz",
  "Pp92ljHZC0wqDDYO4rvvLk+X5wAbK36M2qNnD5TEcu/lyuSCs0ile0SIrOWWnb20hhkZdP+W/aPHFNBjLbGhO1d8UmsuKVXTodl3",
  "CeabdmmBZXAuFowSwRpYfM1NKbbg9R09YrbkYhz/AiT47V7J0+Kj687DWaIbOY7uNTjynFwYlWKCRcLeFBNBQj2RVMfelWzZOvtW",
  "+zs6/e4cwetS5aeX4Wa3fbtzH2tZSEoNuGFJRoN8Jodtsapm2syTr00lUvISXeEq1jMTaWXE42bGt3q/2CNOwB1nENT9dy+ywRsd",
  "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",
].join("");

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
    const baselineBytes = gunzipSync(Buffer.from(CHECKED_IN_BASELINE_GZIP_BASE64, "base64"));
    const baselineFileSha256 = sha256(baselineBytes);
    if (existsSync(P10B19A09B_BASELINE_PATH)) {
      expect(readFileSync(P10B19A09B_BASELINE_PATH)).toEqual(baselineBytes);
    }
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

    if (existsSync(P10B19A09B_BASELINE_PATH)) {
      writeFileSync(FINAL_COMPARISON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    }

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
