import { describe, expect, it, vi } from "vitest";
import { confirmPublish, preparePublish } from "@/application/publishing";
import { aurumNordicSeed } from "@/data/seed";
import {
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  CompiledPublicationIntegrityError,
  InMemoryProjectRepository,
  parseCompiledPublicationArtifact,
  type AuthoritativePublishingProjectRepository,
  type AtomicPublicationFailurePoint,
} from "@/services/storage";

const projectId = aurumNordicSeed.project.id;

function repository(failAtomicPublicationAt?: (point: AtomicPublicationFailurePoint) => void) {
  return new InMemoryProjectRepository(
    [
      {
        project: structuredClone(aurumNordicSeed.project),
        catalogue: structuredClone(aurumNordicSeed.catalogue),
        snapshots: [
          structuredClone(aurumNordicSeed.publishedSnapshot),
          structuredClone(aurumNordicSeed.draftSnapshot),
        ],
      },
    ],
    { failAtomicPublicationAt },
  );
}

function authoritativeDecorator(
  inner: AuthoritativePublishingProjectRepository,
): AuthoritativePublishingProjectRepository {
  return {
    list: () => inner.list(),
    get: (id) => inner.get(id),
    create: (aggregate) => inner.create(aggregate),
    saveDraft: (id, snapshot, expectedBase) => inner.saveDraft(id, snapshot, expectedBase),
    publish: (id, expectation) => inner.publish(id, expectation),
    restore: (id, snapshotId, expectation) => inner.restore(id, snapshotId, expectation),
    getPublicationOperation: (identity) => inner.getPublicationOperation(identity),
    getActiveCompiledPublication: (id) => inner.getActiveCompiledPublication(id),
    getCompiledPublicationArtifact: (id, artifactId) =>
      inner.getCompiledPublicationArtifact(id, artifactId),
    listPublishedStorefrontVersions: (id) => inner.listPublishedStorefrontVersions(id),
    restorePublishedStorefrontVersion: (id, versionId, expectation) =>
      inner.restorePublishedStorefrontVersion(id, versionId, expectation),
  };
}

async function saveChange(value: InMemoryProjectRepository, label: string) {
  const aggregate = await value.get(projectId);
  const current = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
  const draft: StorefrontSnapshot = structuredClone(current);
  draft.id = `snapshot_atomic_${label}`;
  draft.createdAt = new Date(Date.parse(current.createdAt) + 1_000).toISOString();
  draft.pages[0].title.en = `Atomic ${label}`;
  await value.saveDraft(projectId, draft, { id: current.id, revision: current.revision });
}

async function publishChange(value: InMemoryProjectRepository, label: string) {
  await saveChange(value, label);
  const preparation = await preparePublish(projectId, value, {
    now: () => new Date(`2026-08-07T10:0${label.length % 9}:00.000Z`),
    createPreparationId: () => `publish_preparation_atomic_${label}`,
  });
  const result = await confirmPublish(preparation, value);
  return { preparation, result, active: (await value.getActiveCompiledPublication(projectId))! };
}

describe("P10A-08C-02B atomic compiled publication", () => {
  it("preserves the active-version precondition through authoritative decorators", async () => {
    const value = repository();
    await saveChange(value, "authority_a");
    const firstPreparation = await preparePublish(projectId, value, {
      createPreparationId: () => "publish_preparation_authority_a",
    });
    expect(firstPreparation.expectedActivePublicationVersionId).toBeNull();
    await confirmPublish(firstPreparation, value);
    const activeA = (await value.getActiveCompiledPublication(projectId))!;

    await saveChange(value, "authority_b");
    const directPreparation = await preparePublish(projectId, value, {
      createPreparationId: () => "publish_preparation_authority_b_direct",
    });
    const activeRead = vi.spyOn(value, "getActiveCompiledPublication");
    const wrapped = authoritativeDecorator(value);
    const wrappedPreparation = await preparePublish(projectId, wrapped, {
      createPreparationId: () => "publish_preparation_authority_b_wrapped",
    });

    expect(directPreparation.expectedActivePublicationVersionId).toBe(activeA.version.id);
    expect(wrappedPreparation.expectedActivePublicationVersionId).toBe(activeA.version.id);
    expect(activeRead).toHaveBeenCalledWith(projectId);

    await confirmPublish(directPreparation, value);
    const activeB = (await value.getActiveCompiledPublication(projectId))!;
    const aggregateB = await value.get(projectId);
    const versionsB = await value.listPublishedStorefrontVersions(projectId);
    expect(activeB.version.id).not.toBe(activeA.version.id);

    await expect(confirmPublish(wrappedPreparation, wrapped)).rejects.toMatchObject({
      code: "STALE_PUBLISH_PREPARATION",
    });
    expect(await value.get(projectId)).toEqual(aggregateB);
    expect(await value.getActiveCompiledPublication(projectId)).toEqual(activeB);
    expect(await value.listPublishedStorefrontVersions(projectId)).toEqual(versionsB);
  });

  it("commits the exact manual snapshot, compiler artifact, version, operation and pointer together", async () => {
    const value = repository();
    const { preparation, result, active } = await publishChange(value, "manual");
    const versions = await value.listPublishedStorefrontVersions(projectId);
    const operation = await value.getPublicationOperation({
      tenantId: "tenant_standalone",
      merchantId: "merchant_standalone",
      organizationId: "organization_standalone",
      storeId: "store_standalone",
      storefrontProjectId: projectId,
      operationType: "publish",
      requestId: preparation.preparationId,
    });

    expect(active.pointer.versionId).toBe(active.version.id);
    expect(active.pointer.artifactId).toBe(active.artifact.id);
    expect(active.pointer.publishedSnapshotId).toBe(result.publishedSnapshot.id);
    expect(active.version.publishedSnapshot.fingerprint).toBe(
      canonicalStorefrontContentFingerprint(result.publishedSnapshot),
    );
    expect(active.artifact.authority).toEqual({ kind: "manual" });
    expect(active.artifact.compileReceipt.sourceAuthorityKind).toBe("manual");
    expect(active.artifact.compiledResult.runtimeFingerprint).toBe(
      preparation.compilation.resultIdentity.runtimeFingerprint,
    );
    expect(operation?.publishedSnapshotId).toBe(result.publishedSnapshot.id);
    expect(operation?.publishedVersionId).toBe(active.version.id);
    expect(operation?.compiledArtifactId).toBe(active.artifact.id);
    expect(versions).toEqual([active.version]);
    expect(Object.isFrozen(active)).toBe(true);
    expect(Object.isFrozen(active.artifact)).toBe(true);
  });

  it("appends immutable linked versions and keeps old artifacts unchanged", async () => {
    const value = repository();
    const first = await publishChange(value, "first");
    const firstArtifact = structuredClone(first.active.artifact);
    const second = await publishChange(value, "second");
    const versions = await value.listPublishedStorefrontVersions(projectId);

    expect(versions).toHaveLength(2);
    expect(versions[1].predecessorVersionId).toBe(versions[0].id);
    expect(second.active.version.id).toBe(versions[1].id);
    expect(await value.getCompiledPublicationArtifact(projectId, firstArtifact.id)).toEqual(
      firstArtifact,
    );
    expect(second.active.artifact.id).not.toBe(firstArtifact.id);
  });

  it("fails closed when an artifact or version integrity fingerprint is tampered", async () => {
    const value = repository();
    const { active } = await publishChange(value, "integrity");
    const tampered = structuredClone(active.artifact);
    tampered.compiledResult.pages[0].page.title.en = "Tampered";

    expect(() => parseCompiledPublicationArtifact(tampered)).toThrow(
      CompiledPublicationIntegrityError,
    );
  });

  it.each<AtomicPublicationFailurePoint>(["artifact", "version", "pointer"])(
    "preserves the complete live state when the %s transaction stage fails",
    async (failurePoint) => {
      let injected: AtomicPublicationFailurePoint | null = null;
      const value = repository((point) => {
        if (point === injected) throw new Error(`Injected ${point} failure.`);
      });
      await publishChange(value, `baseline_${failurePoint}`);
      const beforeAggregate = await value.get(projectId);
      const beforeActive = await value.getActiveCompiledPublication(projectId);
      const beforeVersions = await value.listPublishedStorefrontVersions(projectId);
      await saveChange(value, `candidate_${failurePoint}`);
      const preparation = await preparePublish(projectId, value, {
        createPreparationId: () => `publish_preparation_failure_${failurePoint}`,
      });
      const beforeAttempt = await value.get(projectId);
      injected = failurePoint;

      await expect(confirmPublish(preparation, value)).rejects.toMatchObject({
        code: "PUBLISH_CONFIRMATION_FAILED",
      });
      expect(await value.get(projectId)).toEqual(beforeAttempt);
      expect(await value.getActiveCompiledPublication(projectId)).toEqual(beforeActive);
      expect(await value.listPublishedStorefrontVersions(projectId)).toEqual(beforeVersions);
      expect((await value.get(projectId)).project.publishedSnapshotId).toBe(
        beforeAggregate.project.publishedSnapshotId,
      );
    },
  );

  it("rejects a stale active-version precondition without any write", async () => {
    const value = repository();
    await saveChange(value, "concurrent");
    const preparation = await preparePublish(projectId, value, {
      createPreparationId: () => "publish_preparation_concurrent",
    });
    const stale = structuredClone(preparation);
    stale.expectedActivePublicationVersionId = "published_version_stale";
    const before = await value.get(projectId);

    await expect(confirmPublish(stale, value)).rejects.toMatchObject({
      code: "STALE_PUBLISH_PREPARATION",
    });
    expect(await value.get(projectId)).toEqual(before);
    expect(await value.getActiveCompiledPublication(projectId)).toBeNull();
  });

  it("restores version A to a new draft, leaves B live, and explicitly recompiles version C", async () => {
    const value = repository();
    const first = await publishChange(value, "restore_a");
    const second = await publishChange(value, "restore_b");
    const liveBeforeRestore = second.active;
    const compileSpy = vi.spyOn(value, "publish");
    const beforeRestore = await value.get(projectId);
    const currentDraft = beforeRestore.snapshots.find(
      ({ id }) => id === beforeRestore.project.draftSnapshotId,
    )!;

    const restoredDraft = await value.restorePublishedStorefrontVersion(
      projectId,
      first.active.version.id,
      {
        projectRevision: beforeRestore.project.revision,
        draft: {
          id: currentDraft.id,
          revision: currentDraft.revision,
          contentFingerprint: canonicalStorefrontContentFingerprint(currentDraft),
        },
        target: {
          id: first.active.publishedSnapshot.id,
          revision: first.active.publishedSnapshot.revision,
          contentFingerprint: canonicalStorefrontContentFingerprint(first.active.publishedSnapshot),
        },
      },
    );
    const afterRestore = await value.get(projectId);
    expect(restoredDraft.id).not.toBe(first.active.publishedSnapshot.id);
    expect(canonicalStorefrontContentFingerprint(restoredDraft)).toBe(
      first.active.version.publishedSnapshot.fingerprint,
    );
    expect(afterRestore.project.publishedSnapshotId).toBe(liveBeforeRestore.publishedSnapshot.id);
    expect((await value.getActiveCompiledPublication(projectId))?.version.id).toBe(
      liveBeforeRestore.version.id,
    );

    const preparation = await preparePublish(projectId, value, {
      createPreparationId: () => "publish_preparation_restore_c",
    });
    await confirmPublish(preparation, value);
    const versions = await value.listPublishedStorefrontVersions(projectId);
    const active = (await value.getActiveCompiledPublication(projectId))!;
    expect(versions).toHaveLength(3);
    expect(active.version.id).toBe(versions[2].id);
    expect(active.version.predecessorVersionId).toBe(liveBeforeRestore.version.id);
    expect(active.artifact.sourceSnapshot.id).toBe(restoredDraft.id);
    expect(active.artifact.id).not.toBe(first.active.artifact.id);
    expect(compileSpy).toHaveBeenCalledTimes(1);
  });
});
