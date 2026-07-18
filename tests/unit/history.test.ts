import { describe, expect, it, vi } from "vitest";
import {
  confirmRestore,
  listProjectHistory,
  prepareRestore,
  readHistoricalSnapshot,
  StaleRestorePreparationError,
} from "@/application/history";
import { aurumNordicSeed } from "@/data/seed";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";

const projectId = aurumNordicSeed.project.id;
const aggregate = (): ProjectAggregate => ({
  project: structuredClone(aurumNordicSeed.project),
  catalogue: structuredClone(aurumNordicSeed.catalogue),
  snapshots: [
    structuredClone(aurumNordicSeed.publishedSnapshot),
    structuredClone(aurumNordicSeed.draftSnapshot),
  ],
});
const repository = () => new InMemoryProjectRepository([aggregate()]);

async function publishedHistory(value: InMemoryProjectRepository) {
  const current = await value.get(projectId);
  const draft = structuredClone(
    current.snapshots.find((snapshot) => snapshot.id === current.project.draftSnapshotId)!,
  );
  draft.id = "snapshot_history_changed_draft";
  draft.createdAt = "2026-07-20T10:00:00.000Z";
  draft.pages[0].title.en = "History draft";
  await value.saveDraft(projectId, draft, {
    id: current.project.draftSnapshotId,
    revision: draft.revision,
  });
  const latest = await value.get(projectId);
  const currentDraft = latest.snapshots.find(
    (snapshot) => snapshot.id === latest.project.draftSnapshotId,
  )!;
  await value.publish(projectId, {
    projectRevision: latest.project.revision,
    draft: {
      id: currentDraft.id,
      revision: currentDraft.revision,
      contentFingerprint: (
        await import("@/domain/storefront")
      ).canonicalStorefrontContentFingerprint(currentDraft),
    },
    published: {
      id: latest.project.publishedSnapshotId,
      revision: latest.project.revision - 1,
      contentFingerprint: (
        await import("@/domain/storefront")
      ).canonicalStorefrontContentFingerprint(
        latest.snapshots.find((snapshot) => snapshot.id === latest.project.publishedSnapshotId)!,
      ),
    },
  });
  return value.get(projectId);
}

describe("published history and restore boundary", () => {
  it("orders deterministic safe history labels without exposing provenance", async () => {
    const value = repository();
    const entries = await listProjectHistory(projectId, value);
    expect(entries.map((entry) => entry.kind)).toEqual(["currentPublished", "currentDraft"]);
    expect(entries[0]).toMatchObject({ authorRole: "system", pageCount: 3 });
    expect(
      entries.every((entry) => entry.reason === undefined && entry.summary === undefined),
    ).toBe(true);
  });

  it("reads an exact immutable historical snapshot and restores it as a new draft", async () => {
    const value = repository();
    const before = await publishedHistory(value);
    const historicalId = aurumNordicSeed.publishedSnapshot.id;
    const historical = await readHistoricalSnapshot(projectId, historicalId, value);
    const preparation = await prepareRestore(projectId, historicalId, value, {
      now: () => new Date("2026-07-21T10:00:00.000Z"),
    });
    const result = await confirmRestore(preparation, value);
    expect(result.restoredDraftSnapshot.id).not.toBe(historicalId);
    expect(result.restoredDraftSnapshot.pages).toEqual(historical.pages);
    expect(result.aggregate.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
    expect(result.aggregate.project.revision).toBe(before.project.revision);
    expect(result.aggregate.snapshots.some((snapshot) => snapshot.id === historicalId)).toBe(true);
    expect(result.aggregate.catalogue).toEqual(before.catalogue);
    const restoredMetadata = result.aggregate.snapshotHistoryMetadata?.find(
      ({ snapshotId }) => snapshotId === result.restoredDraftSnapshot.id,
    );
    expect(restoredMetadata).toMatchObject({
      reason: "restored",
      summary: {
        en: "A previous storefront version was restored as a new saved draft.",
        fi: "Verkkokaupan aiempi versio palautettiin uudeksi tallennetuksi luonnokseksi.",
      },
    });
  });

  it("rejects stale draft preparation without restoring or publishing", async () => {
    const value = repository();
    const preparation = await prepareRestore(
      projectId,
      aurumNordicSeed.publishedSnapshot.id,
      value,
    );
    const before = await value.get(projectId);
    const draft = structuredClone(
      before.snapshots.find((snapshot) => snapshot.id === before.project.draftSnapshotId)!,
    );
    draft.id = "snapshot_history_stale_draft";
    draft.createdAt = "2026-07-20T10:00:00.000Z";
    await value.saveDraft(projectId, draft, {
      id: before.project.draftSnapshotId,
      revision: draft.revision,
    });
    await expect(confirmRestore(preparation, value)).rejects.toBeInstanceOf(
      StaleRestorePreparationError,
    );
    const after = await value.get(projectId);
    expect(after.project.draftSnapshotId).toBe(draft.id);
    expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
  });

  it("does not duplicate restore writes when confirmation is attempted again", async () => {
    const value = repository();
    const preparation = await prepareRestore(
      projectId,
      aurumNordicSeed.publishedSnapshot.id,
      value,
    );
    const restore = vi.spyOn(value, "restore");
    await confirmRestore(preparation, value);
    await expect(confirmRestore(preparation, value)).rejects.toBeInstanceOf(
      StaleRestorePreparationError,
    );
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
