import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { readLegacyV1HistoricalSnapshot } from "@/application/bounded-storefront-synthesis/legacy-v1-historical-snapshot-replay";
import { createLegacyV1StorefrontReplayReference } from "@/application/bounded-storefront-synthesis/legacy-v1-replay-authority";
import { confirmPublish } from "@/application/publishing/confirm-publish";
import { compileLegacyV1HistoricalPublicationReplay } from "@/application/publishing/legacy-v1-publication-replay";
import {
  assertMatchingPublishCompilation,
  publishCompilerContractVersion,
  publishCompilerVersion,
  trustedPublishCompilationSchema,
} from "@/application/publishing/publish-compiler";
import { preparePublish } from "@/application/publishing/prepare-publish";
import {
  createP10B16RepresentativeAuthority,
  createP10B16RepresentativeOutcome,
} from "@/data/demo/p10b-16-coordinated-directions";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  assertPublishedStorefrontVersionIntegrity,
  InMemoryProjectRepository,
  restoreHistoryMetadata,
  type AtomicPublicationFailurePoint,
  type ProjectAggregate,
  type PublicationOperationWrite,
} from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import baselineFixture from "../fixtures/p10b-19a-09c-publication-replay-baseline.v1.json";
import {
  createP10B19A09CPublicationRenderParityEvidence,
  P10B19A09C_BASE_COMMIT,
  P10B19A09C_BASELINE_PATH,
  type P10B19A09CPublicationRenderParitySource,
} from "../helpers/p10b-19a-09c-publication-render-observation";

const ACCEPTED_BASELINE_FILE_SHA256 =
  "e1a2eb36eed615945b100797886be4a0d345b579e7b84eb8f4629aa124d03653";
const ACCEPTED_BASELINE_MATERIAL_SHA256 =
  "92b2f872d10cd9777758c7cd6572e9b3fb598f1aa00703cbdaaf9e196c1e5b30";
const FINAL_COMPARISON_PATH = resolve(
  existsSync("/private/tmp") ? "/private/tmp" : tmpdir(),
  "veskify-p10b-19a-09c-final-publication-comparison.json",
);
const BASELINE_FIXTURE_PATH = resolve(
  process.cwd(),
  "tests/fixtures/p10b-19a-09c-publication-replay-baseline.v1.json",
);
const cases = [
  ["premium-editorial", "legacy-v1:premium-editorial", "artifact"],
  ["modern-technical", "legacy-v1:modern-technical", "version"],
  ["minimal-commerce", "legacy-v1:minimal-commerce", "pointer"],
] as const;

type DirectionId = (typeof cases)[number][0];
type BaselineRepresentative = (typeof baselineFixture.representatives)[number];
type Comparison = Readonly<{
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
): Comparison {
  const comparedLength = Math.max(expectedValues.length, actualValues.length);
  let identical = 0;
  let mismatches = 0;
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

function snapshotById(aggregate: ProjectAggregate, snapshotId: string): StorefrontSnapshot {
  const snapshot = aggregate.snapshots.find(({ id }) => id === snapshotId);
  if (!snapshot) throw new Error(`Missing required snapshot ${snapshotId}.`);
  return snapshot;
}

function historicalAggregate(directionId: DirectionId): ProjectAggregate {
  const sourceAggregate = createP10B16RepresentativeAuthority().source.fixture.aggregate;
  const historical = structuredClone(
    createP10B16RepresentativeOutcome(directionId, 0).synthesis.materialization.snapshot,
  );
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
  return validateProjectAggregate({
    project,
    catalogue: structuredClone(sourceAggregate.catalogue),
    snapshots: [published, historical, currentDraft],
    snapshotHistoryMetadata: [restoreHistoryMetadata(project.id, historical.id)],
  });
}

function historicalDraftAggregate(
  aggregate: ProjectAggregate,
  historicalSnapshotId: string,
): ProjectAggregate {
  return validateProjectAggregate({
    ...structuredClone(aggregate),
    project: {
      ...structuredClone(aggregate.project),
      draftSnapshotId: historicalSnapshotId,
    },
  });
}

function publicationOperation(
  directionId: DirectionId,
  projectId: string,
  expectedRevision: number,
  compileReceiptFingerprint: string,
  requestSuffix = "",
): PublicationOperationWrite {
  const direction = directionId.replaceAll("-", "_");
  const requestId = `publication_replay_${direction}${requestSuffix}`;
  return {
    tenantId: "tenant_p10b_19a_09c",
    merchantId: "merchant_p10b_19a_09c",
    organizationId: "organization_p10b_19a_09c",
    storeId: "store_p10b_19a_09c",
    storefrontProjectId: projectId,
    operationType: "publish",
    requestId,
    requestFingerprint: `p10b-19a-09c-${compileReceiptFingerprint}${requestSuffix}`,
    result: {
      requestId,
      storefrontProjectId: projectId,
      publishedRevision: `p10b-19a-09c-revision-${expectedRevision + 1}`,
      status: "published",
    },
  };
}

function flattenPublishedObservations(representatives: readonly BaselineRepresentative[]) {
  return representatives.flatMap(({ directionId, aliasId, publishedRendererAuthority }) =>
    publishedRendererAuthority.renderObservations.map((observation) => ({
      directionId,
      aliasId,
      ...observation,
    })),
  );
}

function routeProfileFrameProjection(representatives: readonly BaselineRepresentative[]) {
  return flattenPublishedObservations(representatives).map(
    ({
      directionId,
      aliasId,
      surface,
      route,
      locale,
      renderTarget,
      pageFamilyId,
      pageProfileId,
      sharedFrameProfileId,
    }) => ({
      directionId,
      aliasId,
      surface,
      route,
      locale,
      renderTarget,
      pageFamilyId,
      pageProfileId,
      sharedFrameProfileId,
    }),
  );
}

function materialWithoutSelfHash() {
  const material = structuredClone(baselineFixture) as Record<string, unknown>;
  Reflect.deleteProperty(material, "baselineFileMaterialSha256");
  return material;
}

describe("P10B-19A-09C historical v1 publication and current published-render replay", () => {
  it("matches the frozen 3 x 6 x 2 authority through direct compile, atomic confirmation, storage and normalized render parity", async () => {
    const fixtureBytes = readFileSync(BASELINE_FIXTURE_PATH);
    const baselineFileSha256 = sha256(fixtureBytes);
    if (existsSync(P10B19A09C_BASELINE_PATH)) {
      expect(readFileSync(P10B19A09C_BASELINE_PATH)).toEqual(fixtureBytes);
    }
    expect(JSON.parse(fixtureBytes.toString("utf8"))).toEqual(baselineFixture);
    expect(baselineFileSha256).toBe(ACCEPTED_BASELINE_FILE_SHA256);
    expect(sha256(canonicalValueString(materialWithoutSelfHash()))).toBe(
      ACCEPTED_BASELINE_MATERIAL_SHA256,
    );
    expect(baselineFixture).toMatchObject({
      baselineSchemaVersion: "1.0.0",
      authorityKind: "legacy-v1-publication-replay-task-base-baseline",
      baseCommit: P10B19A09C_BASE_COMMIT,
      recordCounts: {
        representatives: 3,
        directCompilations: 3,
        preparations: 3,
        isolatedConfirmations: 3,
        activeCompiledPublications: 3,
        publishedVersionAdditions: 3,
        publishedRenderObservations: 36,
      },
      mutationAndExternalActivity: {
        preparationWrites: 0,
        sourceAggregateMutations: 0,
        sourceSnapshotMutations: 0,
        externalPublicationCalls: 0,
        providerCalls: 0,
        veskoCalls: 0,
      },
      baselineFileMaterialSha256: ACCEPTED_BASELINE_MATERIAL_SHA256,
    });

    const { source } = createP10B16RepresentativeAuthority();
    const authorityRecords: Array<Omit<BaselineRepresentative, "publishedRendererAuthority">> = [];
    const renderSources: P10B19A09CPublicationRenderParitySource[] = [];
    let directCompilations = 0;
    let preparationCompilations = 0;
    let preparationWrites = 0;
    let isolatedConfirmations = 0;
    let activeCompiledPublications = 0;
    let publishedVersionAdditions = 0;
    let migrationCurrent = 0;
    let sourceSnapshotMutations = 0;
    let sourceAggregateMutations = 0;
    let commerceChanges = 0;
    let mediaChanges = 0;
    let atomicFailurePreservationPasses = 0;

    for (const [caseIndex, [directionId, aliasId, failurePoint]] of cases.entries()) {
      const aggregate = historicalAggregate(directionId);
      const aggregateBefore = canonicalValueString(aggregate);
      const historical = snapshotById(
        aggregate,
        createP10B16RepresentativeOutcome(directionId, 0).synthesis.materialization.snapshot.id,
      );
      const historicalBefore = canonicalValueString(historical);
      const replayReference = createLegacyV1StorefrontReplayReference({
        aliasId,
        sourceSelection: createP10B16RepresentativeOutcome(directionId, 0).narrowing,
      });
      const historicalReadResult = readLegacyV1HistoricalSnapshot({
        snapshot: historical,
        catalogue: aggregate.catalogue,
        replayReference,
      });
      const direct = compileLegacyV1HistoricalPublicationReplay({
        aggregate,
        historicalReadResult,
        currentEvidenceReferences: source.approvedEvidenceReferences,
      });
      const directCompilation = trustedPublishCompilationSchema.parse(direct.compilation);
      directCompilations += 1;
      migrationCurrent += direct.compilation.receipt.migrationStatus === "current" ? 1 : 0;

      const publishableAggregate = historicalDraftAggregate(aggregate, historical.id);
      const repository = new InMemoryProjectRepository([publishableAggregate]);
      const preparedAt = `2026-09-03T10:0${caseIndex}:00.000Z`;
      const preparationId = `publish_preparation_p10b_19a_09c_${directionId.replaceAll("-", "_")}`;
      const beforePreparation = await repository.get(publishableAggregate.project.id);
      const activeBeforePreparation = await repository.getActiveCompiledPublication(
        publishableAggregate.project.id,
      );
      const versionsBeforePreparation = await repository.listPublishedStorefrontVersions(
        publishableAggregate.project.id,
      );
      const preparation = await preparePublish(publishableAggregate.project.id, repository, {
        authority: {
          kind: "manual",
          currentEvidenceReferences: source.approvedEvidenceReferences,
        },
        now: () => new Date(preparedAt),
        createPreparationId: () => preparationId,
      });
      assertMatchingPublishCompilation(preparation.compilation, directCompilation);
      preparationCompilations += 1;
      preparationWrites +=
        canonicalValueString(await repository.get(publishableAggregate.project.id)) ===
          canonicalValueString(beforePreparation) &&
        canonicalValueString(
          await repository.getActiveCompiledPublication(publishableAggregate.project.id),
        ) === canonicalValueString(activeBeforePreparation) &&
        canonicalValueString(
          await repository.listPublishedStorefrontVersions(publishableAggregate.project.id),
        ) === canonicalValueString(versionsBeforePreparation)
          ? 0
          : 1;
      expect(preparation.publishPermitted).toBe(true);
      const priorPublished = snapshotById(
        beforePreparation,
        beforePreparation.project.publishedSnapshotId,
      );
      const operation = publicationOperation(
        directionId,
        publishableAggregate.project.id,
        preparation.expectedProjectRevision,
        direct.compilation.receipt.fingerprint,
      );

      const confirmation = await confirmPublish(preparation, repository, {
        authority: {
          kind: "manual",
          currentEvidenceReferences: source.approvedEvidenceReferences,
        },
        publicationOperation: operation,
      });
      isolatedConfirmations += 1;
      const active = await repository.getActiveCompiledPublication(publishableAggregate.project.id);
      if (!active) throw new Error("Missing active compiled publication after confirmation.");
      const versions = await repository.listPublishedStorefrontVersions(
        publishableAggregate.project.id,
      );
      const storedOperation = await repository.getPublicationOperation(operation);
      if (!storedOperation) throw new Error("Missing retained publication operation.");
      assertPublishedStorefrontVersionIntegrity(
        active.version,
        active.artifact,
        active.publishedSnapshot,
      );
      assertMatchingPublishCompilation(preparation.compilation, {
        result: active.artifact.compiledResult,
        receipt: active.artifact.compileReceipt,
      });
      expect(active.artifact.compiledResult).toEqual(direct.compilation.result);
      expect(active.artifact.compileReceipt).toEqual(direct.compilation.receipt);
      expect(active.version.publishedSnapshot.id).toBe(confirmation.publishedSnapshot.id);
      expect(active.publishedSnapshot).toEqual(confirmation.publishedSnapshot);
      expect(versions).toEqual([active.version]);
      expect(await repository.getPublicationOperation(operation)).toEqual(storedOperation);
      expect(confirmation.aggregate.project.revision).toBe(
        publishableAggregate.project.revision + 1,
      );
      expect(
        canonicalStorefrontContentEqual(
          confirmation.publishedSnapshot,
          confirmation.synchronizedDraftSnapshot,
        ),
      ).toBe(true);
      expect(canonicalStorefrontContentFingerprint(confirmation.publishedSnapshot)).toBe(
        historicalReadResult.receipt.sourceSnapshot.canonicalSnapshotFingerprint,
      );
      expect(canonicalStorefrontContentFingerprint(confirmation.synchronizedDraftSnapshot)).toBe(
        historicalReadResult.receipt.sourceSnapshot.canonicalSnapshotFingerprint,
      );
      expect(snapshotById(confirmation.aggregate, historical.id)).toEqual(historical);
      expect(snapshotById(confirmation.aggregate, priorPublished.id)).toEqual(priorPublished);
      activeCompiledPublications += 1;
      publishedVersionAdditions += versions.length === versionsBeforePreparation.length + 1 ? 1 : 0;

      const failingRepository = new InMemoryProjectRepository([publishableAggregate], {
        failAtomicPublicationAt: (point: AtomicPublicationFailurePoint) => {
          if (point === failurePoint) throw new Error(`Injected ${point} failure.`);
        },
      });
      const failureOperation = publicationOperation(
        directionId,
        publishableAggregate.project.id,
        preparation.expectedProjectRevision,
        direct.compilation.receipt.fingerprint,
        `_failure_${failurePoint}`,
      );
      const failureAggregateBefore = await failingRepository.get(publishableAggregate.project.id);
      const failureActiveBefore = await failingRepository.getActiveCompiledPublication(
        publishableAggregate.project.id,
      );
      const failureVersionsBefore = await failingRepository.listPublishedStorefrontVersions(
        publishableAggregate.project.id,
      );
      await expect(
        failingRepository.publish(publishableAggregate.project.id, {
          projectRevision: preparation.expectedProjectRevision,
          draft: preparation.expectedDraft,
          published: preparation.expectedPublished,
          operation: failureOperation,
          compiledPublication: {
            compilation: directCompilation,
            authority: preparation.authority,
            operation: failureOperation,
            expectedActiveVersionId: preparation.expectedActivePublicationVersionId,
          },
        }),
      ).rejects.toThrow(`Injected ${failurePoint} failure.`);
      expect(await failingRepository.get(publishableAggregate.project.id)).toEqual(
        failureAggregateBefore,
      );
      expect(
        await failingRepository.getActiveCompiledPublication(publishableAggregate.project.id),
      ).toEqual(failureActiveBefore);
      expect(
        await failingRepository.listPublishedStorefrontVersions(publishableAggregate.project.id),
      ).toEqual(failureVersionsBefore);
      expect(await failingRepository.getPublicationOperation(failureOperation)).toBeNull();
      atomicFailurePreservationPasses += 1;

      const sourceCommerceFingerprint = canonicalValueFingerprint(aggregate.catalogue);
      const confirmedCommerceFingerprint = canonicalValueFingerprint(
        confirmation.aggregate.catalogue,
      );
      commerceChanges += sourceCommerceFingerprint === confirmedCommerceFingerprint ? 0 : 1;
      const sourceMediaFingerprint = canonicalValueFingerprint(
        aggregate.catalogue.products.map(({ id, images }) => ({ id, images })),
      );
      const confirmedMediaFingerprint = canonicalValueFingerprint(
        confirmation.aggregate.catalogue.products.map(({ id, images }) => ({ id, images })),
      );
      mediaChanges += sourceMediaFingerprint === confirmedMediaFingerprint ? 0 : 1;
      const dynamicCommerceFingerprint =
        direct.compilation.receipt.dynamicCommercePresentationFingerprint;
      if (!dynamicCommerceFingerprint) {
        throw new Error("Missing dynamic-commerce publication fingerprint.");
      }
      const expectedActivePublicationVersionId = preparation.expectedActivePublicationVersionId;
      if (expectedActivePublicationVersionId !== null) {
        throw new Error("Expected no active publication version before historical replay.");
      }

      authorityRecords.push({
        directionId,
        aliasId,
        historicalAuthority: {
          replayReferenceFingerprint: replayReference.replayFingerprint,
          historicalReadReceiptFingerprint: historicalReadResult.receipt.receiptFingerprint,
          sourceSnapshotId: historical.id,
          sourceSnapshotRevision: historical.revision,
          canonicalSourceSnapshotFingerprint:
            historicalReadResult.receipt.sourceSnapshot.canonicalSnapshotFingerprint,
        },
        directCompilationAuthority: {
          publishCompilerContractVersion,
          publishCompilerVersion,
          sourceAuthorityKind: direct.compilation.receipt.sourceAuthorityKind,
          compiledRuntimeFingerprint: direct.compilation.result.runtimeFingerprint,
          validationReportFingerprint: direct.compilation.result.validationReportFingerprint,
          compileReceiptFingerprint: direct.compilation.receipt.fingerprint,
          manifestFingerprint: direct.compilation.receipt.manifestFingerprint,
          registryFingerprint: direct.compilation.receipt.registryFingerprint,
          profileAuthorityFingerprint: canonicalValueFingerprint(
            direct.compilation.receipt.profileAuthorities,
          ),
          commerceFingerprint: direct.compilation.receipt.commerceFingerprint,
          navigationRoutesFingerprint: direct.compilation.receipt.navigationRoutesFingerprint,
          productMediaFingerprint: direct.compilation.receipt.productMediaFingerprint,
          productCardAuthorityFingerprint:
            direct.compilation.receipt.productCardAuthorityFingerprint,
          approvedAssetFingerprint: direct.compilation.receipt.approvedAssetFingerprint,
          dynamicCommerceFingerprint,
          localeAuthorityFingerprint: direct.compilation.receipt.localeAuthority.fingerprint,
          migrationStatus: direct.compilation.receipt.migrationStatus,
          migrationFingerprint: direct.compilation.receipt.migrationFingerprint,
        },
        preparationAuthority: {
          preparationId: preparation.preparationId,
          preparedAt: preparation.preparedAt,
          publishPermitted: preparation.publishPermitted,
          preparedCompilationResultIdentity: preparation.compilation.resultIdentity,
          preparedCompileReceiptFingerprint: preparation.compilation.receipt.fingerprint,
          changeSummaryFingerprint: canonicalValueFingerprint(preparation.changeSummary),
          expectedActivePublicationVersionId,
        },
        confirmationAndStorageAuthority: {
          projectRevisionBefore: publishableAggregate.project.revision,
          projectRevisionAfter: confirmation.aggregate.project.revision,
          priorPublishedSnapshotFingerprint: canonicalStorefrontContentFingerprint(priorPublished),
          newPublishedSnapshotFingerprint: canonicalStorefrontContentFingerprint(
            confirmation.publishedSnapshot,
          ),
          synchronizedDraftSnapshotFingerprint: canonicalStorefrontContentFingerprint(
            confirmation.synchronizedDraftSnapshot,
          ),
          activePublicationVersionId: active.version.id,
          activePublicationVersionFingerprint: active.version.integrityFingerprint,
          activeCompiledArtifactId: active.artifact.id,
          activeCompiledArtifactFingerprint: active.artifact.integrityFingerprint,
          storedCompiledResultRuntimeFingerprint: active.artifact.compiledResult.runtimeFingerprint,
          storedCompileReceiptFingerprint: active.artifact.compileReceipt.fingerprint,
          publishedVersionCount: versions.length,
          publicationOperationFingerprint: canonicalValueFingerprint(storedOperation),
        },
      });
      renderSources.push({
        directionId,
        aggregate: confirmation.aggregate,
        historicalSnapshot: snapshotById(confirmation.aggregate, historical.id),
        publishedSnapshot: confirmation.publishedSnapshot,
      });
      sourceAggregateMutations += canonicalValueString(aggregate) === aggregateBefore ? 0 : 1;
      sourceSnapshotMutations += canonicalValueString(historical) === historicalBefore ? 0 : 1;
    }

    const renderEvidence = await createP10B19A09CPublicationRenderParityEvidence(renderSources);
    const actualRepresentatives = authorityRecords.map((authorityRecord) => {
      const rendered = renderEvidence.representatives.find(
        ({ directionId }) => directionId === authorityRecord.directionId,
      );
      if (!rendered) throw new Error("Missing publication render representative.");
      return {
        ...authorityRecord,
        publishedRendererAuthority: {
          currentRendererAuthorityFingerprint: rendered.currentRendererAuthorityFingerprint,
          pageAndDynamicRouteInventoryFingerprint: rendered.pageAndDynamicRouteInventoryFingerprint,
          canonicalCommerceFingerprint: rendered.canonicalCommerceFingerprint,
          canonicalProductMediaFingerprint: rendered.canonicalProductMediaFingerprint,
          canonicalApprovedPresentationFingerprint:
            rendered.canonicalApprovedPresentationFingerprint,
          renderObservations: rendered.parityObservations.map(
            ({ publishedObservation }) => publishedObservation,
          ),
        },
      };
    }) as BaselineRepresentative[];

    sourceAggregateMutations += renderEvidence.sourceAggregateMutations;
    sourceSnapshotMutations +=
      renderEvidence.historicalSnapshotMutations + renderEvidence.publishedSnapshotMutations;
    const representativeComparison = compareCanonical(
      baselineFixture.representatives,
      actualRepresentatives,
    );
    const directCompilationComparison = compareCanonical(
      baselineFixture.representatives.map(
        ({ directCompilationAuthority }) => directCompilationAuthority,
      ),
      actualRepresentatives.map(({ directCompilationAuthority }) => directCompilationAuthority),
    );
    const preparationComparison = compareCanonical(
      baselineFixture.representatives.map(({ preparationAuthority }) => preparationAuthority),
      actualRepresentatives.map(({ preparationAuthority }) => preparationAuthority),
    );
    const activePublicationComparison = compareCanonical(
      baselineFixture.representatives.map(({ confirmationAndStorageAuthority }) => ({
        activeCompiledArtifactId: confirmationAndStorageAuthority.activeCompiledArtifactId,
        activeCompiledArtifactFingerprint:
          confirmationAndStorageAuthority.activeCompiledArtifactFingerprint,
        activePublicationVersionId: confirmationAndStorageAuthority.activePublicationVersionId,
        activePublicationVersionFingerprint:
          confirmationAndStorageAuthority.activePublicationVersionFingerprint,
        storedCompiledResultRuntimeFingerprint:
          confirmationAndStorageAuthority.storedCompiledResultRuntimeFingerprint,
        storedCompileReceiptFingerprint:
          confirmationAndStorageAuthority.storedCompileReceiptFingerprint,
      })),
      actualRepresentatives.map(({ confirmationAndStorageAuthority }) => ({
        activeCompiledArtifactId: confirmationAndStorageAuthority.activeCompiledArtifactId,
        activeCompiledArtifactFingerprint:
          confirmationAndStorageAuthority.activeCompiledArtifactFingerprint,
        activePublicationVersionId: confirmationAndStorageAuthority.activePublicationVersionId,
        activePublicationVersionFingerprint:
          confirmationAndStorageAuthority.activePublicationVersionFingerprint,
        storedCompiledResultRuntimeFingerprint:
          confirmationAndStorageAuthority.storedCompiledResultRuntimeFingerprint,
        storedCompileReceiptFingerprint:
          confirmationAndStorageAuthority.storedCompileReceiptFingerprint,
      })),
    );
    const publishedObservationComparison = compareCanonical(
      flattenPublishedObservations(baselineFixture.representatives),
      flattenPublishedObservations(actualRepresentatives),
    );
    const routeProfileFrameComparison = compareCanonical(
      routeProfileFrameProjection(baselineFixture.representatives),
      routeProfileFrameProjection(actualRepresentatives),
    );
    const parityCount = renderEvidence.normalizedStructuralMatches;
    const pass =
      baselineFileSha256 === ACCEPTED_BASELINE_FILE_SHA256 &&
      representativeComparison.identical === 3 &&
      representativeComparison.mismatches === 0 &&
      directCompilations === 3 &&
      directCompilationComparison.identical === 3 &&
      directCompilationComparison.mismatches === 0 &&
      preparationCompilations === 3 &&
      preparationComparison.identical === 3 &&
      preparationComparison.mismatches === 0 &&
      preparationWrites === 0 &&
      isolatedConfirmations === 3 &&
      activeCompiledPublications === 3 &&
      activePublicationComparison.identical === 3 &&
      activePublicationComparison.mismatches === 0 &&
      publishedVersionAdditions === 3 &&
      publishedObservationComparison.identical === 36 &&
      publishedObservationComparison.mismatches === 0 &&
      renderEvidence.previewCompactObservationsMatchingA09B === 36 &&
      parityCount === 36 &&
      renderEvidence.observationCount === 36 &&
      migrationCurrent === 3 &&
      atomicFailurePreservationPasses === 3 &&
      sourceSnapshotMutations === 0 &&
      sourceAggregateMutations === 0 &&
      commerceChanges === 0 &&
      mediaChanges === 0 &&
      routeProfileFrameComparison.mismatches === 0;
    const report = {
      schemaVersion: "1.0.0",
      authorityKind: "legacy-v1-final-publication-replay-comparison",
      baselineFileSha256,
      baselineMaterialSha256: baselineFixture.baselineFileMaterialSha256,
      baseCommit: P10B19A09C_BASE_COMMIT,
      representatives: representativeComparison,
      directCompilations: directCompilationComparison,
      preparationCompilations: preparationComparison,
      preparationWrites,
      isolatedConfirmations: {
        expected: 3,
        actual: isolatedConfirmations,
        passed: isolatedConfirmations,
        failures: 3 - isolatedConfirmations,
      },
      activeCompiledPublications: activePublicationComparison,
      publishedVersionAdditions: {
        expected: 3,
        actual: publishedVersionAdditions,
        exact: publishedVersionAdditions,
        mismatches: 3 - publishedVersionAdditions,
      },
      publishedRenderObservations: publishedObservationComparison,
      previewPublishedStructuralParity: {
        expected: 36,
        actual: renderEvidence.observationCount,
        identical: parityCount,
        mismatches: renderEvidence.observationCount - parityCount,
        acceptedA09BPreviewIdentical: renderEvidence.previewCompactObservationsMatchingA09B,
      },
      migrationCurrent,
      atomicFailurePreservation: {
        expected: 3,
        passed: atomicFailurePreservationPasses,
        stateChanges: 3 - atomicFailurePreservationPasses,
      },
      sourceSnapshotMutations,
      sourceAggregateMutations,
      externalPublicationCalls: 0,
      providerCalls: 0,
      veskoCalls: 0,
      commerceChanges,
      mediaChanges,
      routeProfileFrameMismatches: routeProfileFrameComparison.mismatches,
      finalVerdict: pass ? "PASS" : "FAIL",
    } as const;
    writeFileSync(FINAL_COMPARISON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    expect(actualRepresentatives).toEqual(baselineFixture.representatives);
    expect(renderEvidence.observationCount).toBe(36);
    expect(renderEvidence.previewCompactObservationsMatchingA09B).toBe(36);
    expect(renderEvidence.normalizedStructuralMatches).toBe(36);
    expect(report).toMatchObject({
      baselineFileSha256: ACCEPTED_BASELINE_FILE_SHA256,
      baseCommit: P10B19A09C_BASE_COMMIT,
      representatives: { expected: 3, actual: 3, identical: 3, mismatches: 0 },
      directCompilations: { expected: 3, actual: 3, identical: 3, mismatches: 0 },
      preparationCompilations: { expected: 3, actual: 3, identical: 3, mismatches: 0 },
      preparationWrites: 0,
      isolatedConfirmations: { expected: 3, actual: 3, passed: 3, failures: 0 },
      activeCompiledPublications: { expected: 3, actual: 3, identical: 3, mismatches: 0 },
      publishedVersionAdditions: { expected: 3, actual: 3, exact: 3, mismatches: 0 },
      publishedRenderObservations: {
        expected: 36,
        actual: 36,
        identical: 36,
        mismatches: 0,
      },
      previewPublishedStructuralParity: {
        expected: 36,
        actual: 36,
        identical: 36,
        mismatches: 0,
        acceptedA09BPreviewIdentical: 36,
      },
      migrationCurrent: 3,
      atomicFailurePreservation: { expected: 3, passed: 3, stateChanges: 0 },
      sourceSnapshotMutations: 0,
      sourceAggregateMutations: 0,
      externalPublicationCalls: 0,
      providerCalls: 0,
      veskoCalls: 0,
      commerceChanges: 0,
      mediaChanges: 0,
      routeProfileFrameMismatches: 0,
      finalVerdict: "PASS",
    });
  }, 120_000);
});
