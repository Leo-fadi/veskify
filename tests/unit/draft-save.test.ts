import { describe, expect, it, vi } from "vitest";
import {
  assembleValidatedEditorDraft,
  EditorDraftValidationError,
  saveValidatedEditorDraft,
  StaleEditorDraftError,
} from "@/application/draft-save";
import { aurumNordicSeed } from "@/data/seed";
import { InMemoryProjectRepository, type ProjectRepository } from "@/services/storage";

const projectId = aurumNordicSeed.project.id;
const fixedDate = new Date("2026-07-17T13:00:00.000Z");

function repository() {
  return new InMemoryProjectRepository([
    {
      project: structuredClone(aurumNordicSeed.project),
      catalogue: structuredClone(aurumNordicSeed.catalogue),
      snapshots: [
        structuredClone(aurumNordicSeed.publishedSnapshot),
        structuredClone(aurumNordicSeed.draftSnapshot),
      ],
    },
  ]);
}

function changedPage(type: "home" | "collection" | "product", title: string) {
  const page = structuredClone(
    aurumNordicSeed.draftSnapshot.pages.find((candidate) => candidate.type === type)!,
  );
  page.title.en = title;
  return page;
}

describe("P2-07 validated editor draft save", () => {
  it("assembles changed pages and preserves unrelated canonical data", () => {
    const assembled = assembleValidatedEditorDraft({
      baseDraft: aurumNordicSeed.draftSnapshot,
      changedPages: [changedPage("home", "Saved home")],
      aggregate: aurumNordicSeed,
      primaryLocale: "en",
      identity: {
        id: "snapshot_draft_assembled",
        createdAt: fixedDate.toISOString(),
        createdBy: "user",
      },
    });
    expect(assembled.pages.find((page) => page.type === "home")?.title.en).toBe("Saved home");
    expect(assembled.pages.find((page) => page.type === "product")).toEqual(
      aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "product"),
    );
    expect(assembled.brandSystem).toEqual(aurumNordicSeed.draftSnapshot.brandSystem);
    expect(assembled.navigation).toEqual(aurumNordicSeed.draftSnapshot.navigation);
    expect(assembled.catalogueRef).toBe(aurumNordicSeed.draftSnapshot.catalogueRef);
    expect(assembled.revision).toBe(aurumNordicSeed.draftSnapshot.revision);
  });

  it("assembles a validated accepted storefront brand system with changed pages", () => {
    const brandSystem = structuredClone(aurumNordicSeed.draftSnapshot.brandSystem);
    brandSystem.colors.primary = "#7B4A2D";
    const assembled = assembleValidatedEditorDraft({
      baseDraft: aurumNordicSeed.draftSnapshot,
      changedPages: [changedPage("home", "Storefront proposal home")],
      brandSystem,
      aggregate: aurumNordicSeed,
      primaryLocale: "en",
    });

    expect(assembled.brandSystem.colors.primary).toBe("#7B4A2D");
    expect(assembled.pages.find((page) => page.type === "home")?.title.en).toBe(
      "Storefront proposal home",
    );
  });

  it("saves multiple pages while preserving published, catalogue and untouched pages", async () => {
    const value = repository();
    const before = await value.get(projectId);
    const result = await saveValidatedEditorDraft({
      repository: value,
      projectId,
      loadedDraft: structuredClone(aurumNordicSeed.draftSnapshot),
      changedPages: [
        changedPage("home", "Saved home"),
        changedPage("collection", "Saved collection"),
      ],
      primaryLocale: "en",
      now: () => fixedDate,
      createSnapshotId: () => "snapshot_draft_multi_page",
    });
    expect(result.draft.pages.find((page) => page.type === "home")?.title.en).toBe("Saved home");
    expect(result.draft.pages.find((page) => page.type === "collection")?.title.en).toBe(
      "Saved collection",
    );
    expect(result.draft.pages.find((page) => page.type === "product")).toEqual(
      aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "product"),
    );
    expect(result.aggregate.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
    expect(result.aggregate.project.revision).toBe(before.project.revision);
    expect(
      result.aggregate.snapshots.find(
        (snapshot) => snapshot.id === before.project.publishedSnapshotId,
      ),
    ).toEqual(
      before.snapshots.find((snapshot) => snapshot.id === before.project.publishedSnapshotId),
    );
    expect(result.aggregate.catalogue).toEqual(before.catalogue);
    expect(result.aggregate).toEqual(await value.get(projectId));
    expect(result.aggregate.snapshots).toHaveLength(before.snapshots.length + 1);
    expect(
      result.aggregate.snapshots.some((snapshot) => snapshot.id === before.project.draftSnapshotId),
    ).toBe(true);
  });

  it("returns the canonical compacted repository state after every save", async () => {
    const value = repository();
    let loadedDraft = structuredClone(aurumNordicSeed.draftSnapshot);

    for (let index = 1; index <= 5; index += 1) {
      const page = structuredClone(
        loadedDraft.pages.find((candidate) => candidate.type === "home")!,
      );
      page.title.en = `Application save ${index}`;
      const result = await saveValidatedEditorDraft({
        repository: value,
        projectId,
        loadedDraft,
        changedPages: [page],
        primaryLocale: "en",
        now: () => new Date(fixedDate.getTime() + index * 1_000),
        createSnapshotId: () => `snapshot_application_compacted_${index}`,
      });

      expect(result.aggregate).toEqual(await value.get(projectId));
      expect(result.aggregate.project.draftSnapshotId).toBe(result.draft.id);
      expect(result.draft.id).toBe(`snapshot_application_compacted_${index}`);
      expect(result.draft.pages.find((candidate) => candidate.type === "home")?.title.en).toBe(
        `Application save ${index}`,
      );
      expect(result.aggregate.snapshots).toHaveLength(2 + index);
      loadedDraft = result.draft;
    }
  });

  it("rejects invalid changed pages and invalid complete snapshots before writing", () => {
    const invalidPage = changedPage("home", "Invalid home");
    invalidPage.sections[0].component = "unknownComponent";
    expect(() =>
      assembleValidatedEditorDraft({
        baseDraft: aurumNordicSeed.draftSnapshot,
        changedPages: [invalidPage],
        aggregate: aurumNordicSeed,
        primaryLocale: "en",
      }),
    ).toThrow(EditorDraftValidationError);

    const collection = changedPage("collection", "Invalid complete draft");
    collection.sections[0].id = aurumNordicSeed.draftSnapshot.pages[0].sections[0].id;
    expect(() =>
      assembleValidatedEditorDraft({
        baseDraft: aurumNordicSeed.draftSnapshot,
        changedPages: [collection],
        aggregate: aurumNordicSeed,
        primaryLocale: "en",
      }),
    ).toThrow(EditorDraftValidationError);
  });

  it("does not call storage when candidate assembly validation fails", async () => {
    const value = repository();
    const before = await value.get(projectId);
    const saveDraft = vi.spyOn(value, "saveDraft");
    const invalidPage = changedPage("home", "Invalid service candidate");
    invalidPage.sections[0].component = "unknownComponent";

    await expect(
      saveValidatedEditorDraft({
        repository: value,
        projectId,
        loadedDraft: aurumNordicSeed.draftSnapshot,
        changedPages: [invalidPage],
        primaryLocale: "en",
        now: () => fixedDate,
      }),
    ).rejects.toBeInstanceOf(EditorDraftValidationError);
    expect(saveDraft).not.toHaveBeenCalled();
    expect(await value.get(projectId)).toEqual(before);
  });

  it("refuses a stale loaded draft and preserves the newer stored draft", async () => {
    const value = repository();
    const newer = structuredClone(aurumNordicSeed.draftSnapshot);
    newer.id = "snapshot_draft_newer";
    newer.pages[0].title.en = "Newer stored home";
    await value.saveDraft(projectId, newer);

    await expect(
      saveValidatedEditorDraft({
        repository: value,
        projectId,
        loadedDraft: aurumNordicSeed.draftSnapshot,
        changedPages: [changedPage("home", "Stale editor home")],
        primaryLocale: "en",
      }),
    ).rejects.toBeInstanceOf(StaleEditorDraftError);
    const after = await value.get(projectId);
    expect(
      after.snapshots.find((snapshot) => snapshot.id === after.project.draftSnapshotId)?.pages[0]
        .title.en,
    ).toBe("Newer stored home");
  });

  it("maps an atomic repository conflict to stale without overwriting concurrent work", async () => {
    const inner = repository();
    const racing: ProjectRepository = {
      list: () => inner.list(),
      get: (id) => inner.get(id),
      create: (aggregate) => inner.create(aggregate),
      saveDraft: async (id, snapshot, expected) => {
        const concurrent = structuredClone(aurumNordicSeed.draftSnapshot);
        concurrent.id = "snapshot_draft_concurrent";
        concurrent.pages[0].title.en = "Concurrent save";
        await inner.saveDraft(id, concurrent);
        return inner.saveDraft(id, snapshot, expected);
      },
      publish: (id, revision) => inner.publish(id, revision),
      restore: (id, snapshotId) => inner.restore(id, snapshotId),
    };
    await expect(
      saveValidatedEditorDraft({
        repository: racing,
        projectId,
        loadedDraft: aurumNordicSeed.draftSnapshot,
        changedPages: [changedPage("home", "Losing save")],
        primaryLocale: "en",
        now: () => fixedDate,
      }),
    ).rejects.toBeInstanceOf(StaleEditorDraftError);
    const after = await inner.get(projectId);
    expect(after.project.draftSnapshotId).toBe("snapshot_draft_concurrent");
  });

  it("rejects a concurrent draft that becomes current before the post-write reread", async () => {
    const inner = repository();
    let getCount = 0;
    const racing: ProjectRepository = {
      list: () => inner.list(),
      get: async (id) => {
        getCount += 1;
        if (getCount === 2) {
          const aggregate = await inner.get(id);
          const current = aggregate.snapshots.find(
            (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
          )!;
          const concurrent = structuredClone(current);
          concurrent.id = "snapshot_concurrent_after_write";
          concurrent.pages[0].title.en = "Concurrent post-write draft";
          await inner.saveDraft(id, concurrent, {
            id: current.id,
            revision: current.revision,
          });
        }
        return inner.get(id);
      },
      create: (aggregate) => inner.create(aggregate),
      saveDraft: (id, snapshot, expected) => inner.saveDraft(id, snapshot, expected),
      publish: (id, revision) => inner.publish(id, revision),
      restore: (id, snapshotId) => inner.restore(id, snapshotId),
    };

    await expect(
      saveValidatedEditorDraft({
        repository: racing,
        projectId,
        loadedDraft: aurumNordicSeed.draftSnapshot,
        changedPages: [changedPage("home", "Candidate that briefly saved")],
        primaryLocale: "en",
        now: () => fixedDate,
        createSnapshotId: () => "snapshot_candidate_before_reread",
      }),
    ).rejects.toBeInstanceOf(StaleEditorDraftError);

    const after = await inner.get(projectId);
    expect(after.project.draftSnapshotId).toBe("snapshot_concurrent_after_write");
    expect(
      after.snapshots.find((snapshot) => snapshot.id === after.project.draftSnapshotId)?.pages[0]
        .title.en,
    ).toBe("Concurrent post-write draft");
  });

  it("rejects canonical post-write drift even when the candidate ID is reused", async () => {
    const inner = repository();
    let getCount = 0;
    const racing: ProjectRepository = {
      list: () => inner.list(),
      get: async (id) => {
        getCount += 1;
        if (getCount === 2) {
          const aggregate = await inner.get(id);
          const current = aggregate.snapshots.find(
            (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
          )!;
          const rewritten = structuredClone(current);
          rewritten.pages[0].title.en = "Same identity, different canonical draft";
          await inner.saveDraft(id, rewritten, {
            id: current.id,
            revision: current.revision,
          });
        }
        return inner.get(id);
      },
      create: (aggregate) => inner.create(aggregate),
      saveDraft: (id, snapshot, expected) => inner.saveDraft(id, snapshot, expected),
      publish: (id, revision) => inner.publish(id, revision),
      restore: (id, snapshotId) => inner.restore(id, snapshotId),
    };

    await expect(
      saveValidatedEditorDraft({
        repository: racing,
        projectId,
        loadedDraft: aurumNordicSeed.draftSnapshot,
        changedPages: [changedPage("home", "Expected canonical candidate")],
        primaryLocale: "en",
        now: () => fixedDate,
        createSnapshotId: () => "snapshot_same_id_race",
      }),
    ).rejects.toBeInstanceOf(StaleEditorDraftError);
  });

  it("keeps inputs and stored state intact after a storage failure", async () => {
    const inner = repository();
    const changed = changedPage("home", "Unsaved after failure");
    const before = await inner.get(projectId);
    const failing: ProjectRepository = {
      list: () => inner.list(),
      get: (id) => inner.get(id),
      create: (aggregate) => inner.create(aggregate),
      saveDraft: vi.fn(() => Promise.reject(new Error("storage unavailable"))),
      publish: (id, revision) => inner.publish(id, revision),
      restore: (id, snapshotId) => inner.restore(id, snapshotId),
    };
    await expect(
      saveValidatedEditorDraft({
        repository: failing,
        projectId,
        loadedDraft: aurumNordicSeed.draftSnapshot,
        changedPages: [changed],
        primaryLocale: "en",
        now: () => fixedDate,
      }),
    ).rejects.toThrow("storage unavailable");
    expect(changed.title.en).toBe("Unsaved after failure");
    expect(await inner.get(projectId)).toEqual(before);
  });
});
