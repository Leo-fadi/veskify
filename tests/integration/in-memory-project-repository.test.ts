import { beforeEach, describe, expect, it } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import type { StorefrontSnapshot } from "@/domain/storefront";
import {
  createAurumNordicProjectRepository,
  ProjectNotFoundError,
  RepositoryValidationError,
  RevisionConflictError,
  SnapshotNotFoundError,
  SnapshotProjectMismatchError,
  type InMemoryProjectRepository,
} from "@/services/storage";

const projectId = aurumNordicSeed.project.id;

function editableDraft(): StorefrontSnapshot {
  return structuredClone(aurumNordicSeed.draftSnapshot);
}

describe("InMemoryProjectRepository", () => {
  let repository: InMemoryProjectRepository;

  beforeEach(() => {
    repository = createAurumNordicProjectRepository();
  });

  it("lists deterministic seeded summaries and gets the valid aggregate", async () => {
    const summaries = await repository.list();
    const aggregate = await repository.get(projectId);

    expect(summaries).toEqual([
      expect.objectContaining({
        id: projectId,
        name: "Aurum Nordic",
        revision: 2,
        publishedSnapshotId: aurumNordicSeed.publishedSnapshot.id,
        draftSnapshotId: aurumNordicSeed.draftSnapshot.id,
      }),
    ]);
    expect(aggregate.project.id).toBe(projectId);
    expect(aggregate.catalogue.products).toHaveLength(6);
    expect(aggregate.snapshots.map((snapshot) => snapshot.id)).toEqual([
      aurumNordicSeed.publishedSnapshot.id,
      aurumNordicSeed.draftSnapshot.id,
    ]);
  });

  it("defensively clones returned data and saved inputs", async () => {
    const first = await repository.get(projectId);
    first.project.name = "Mutated outside";
    first.catalogue.products[0].price.amount = 1;
    first.snapshots[0].pages[0].title.en = "Mutated outside";

    const draft = editableDraft();
    draft.id = "snapshot_saved_clone_test";
    draft.pages[0].title.en = "Saved title";
    await repository.saveDraft(projectId, draft);
    draft.pages[0].title.en = "Mutated after save";

    const stored = await repository.get(projectId);
    const saved = stored.snapshots.find((snapshot) => snapshot.id === draft.id);
    expect(stored.project.name).toBe("Aurum Nordic");
    expect(stored.catalogue.products[0].price.amount).toBe(1290);
    expect(stored.snapshots[0].pages[0].title.en).toBe("Home");
    expect(saved?.pages[0]?.title.en).toBe("Saved title");
  });

  it("returns an explicit typed error for an unknown project", async () => {
    await expect(repository.get("project_missing")).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("saves a valid draft without changing the published reference", async () => {
    const before = await repository.get(projectId);
    const draft = editableDraft();
    draft.id = "snapshot_new_draft";
    draft.pages[0].title.en = "New draft home";

    await repository.saveDraft(projectId, draft);
    const after = await repository.get(projectId);

    expect(after.project.draftSnapshotId).toBe(draft.id);
    expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
    expect(
      after.snapshots.find((snapshot) => snapshot.id === draft.id)?.pages[0]?.title.en,
    ).toBe("New draft home");
  });

  it("does not allow a draft save to overwrite immutable history", async () => {
    const historical = editableDraft();
    historical.id = aurumNordicSeed.publishedSnapshot.id;
    historical.pages[0].title.en = "Attempted history overwrite";

    await expect(repository.saveDraft(projectId, historical)).rejects.toBeInstanceOf(
      RepositoryValidationError,
    );
    expect(
      (await repository.get(projectId)).snapshots.find(
        (snapshot) => snapshot.id === aurumNordicSeed.publishedSnapshot.id,
      )?.pages[0]?.title.en,
    ).toBe("Home");
  });

  it("rejects invalid compositions and snapshots from another project", async () => {
    const invalid = editableDraft();
    invalid.id = "snapshot_invalid_component";
    invalid.pages[0].sections[0].component = "unknownComponent";

    await expect(repository.saveDraft(projectId, invalid)).rejects.toBeInstanceOf(
      RepositoryValidationError,
    );

    const foreign = editableDraft();
    foreign.id = "snapshot_foreign_project";
    foreign.projectId = "project_other";
    await expect(repository.saveDraft(projectId, foreign)).rejects.toBeInstanceOf(
      SnapshotProjectMismatchError,
    );
  });

  it("publishes the current draft, increments revision and preserves history", async () => {
    const before = await repository.get(projectId);
    const published = await repository.publish(projectId, before.project.revision);
    const newPublished = published.snapshots.find(
      (snapshot) => snapshot.id === published.project.publishedSnapshotId,
    );
    const draft = published.snapshots.find(
      (snapshot) => snapshot.id === before.project.draftSnapshotId,
    );

    expect(published.project.revision).toBe(before.project.revision + 1);
    expect(published.project.publishedSnapshotId).not.toBe(before.project.publishedSnapshotId);
    expect(newPublished?.pages).toEqual(draft?.pages);
    expect(published.snapshots.map((snapshot) => snapshot.id)).toContain(
      before.project.publishedSnapshotId,
    );
    expect(published.snapshots).toHaveLength(before.snapshots.length + 1);
  });

  it("rejects publishing a stale revision without changing state", async () => {
    const before = await repository.get(projectId);
    await expect(repository.publish(projectId, before.project.revision - 1)).rejects.toBeInstanceOf(
      RevisionConflictError,
    );
    expect(await repository.get(projectId)).toEqual(before);
  });

  it("restores history into a new draft without changing the published reference", async () => {
    const before = await repository.get(projectId);
    const historicalId = before.project.publishedSnapshotId;
    const restored = await repository.restore(projectId, historicalId);
    const after = await repository.get(projectId);

    expect(restored.id).not.toBe(historicalId);
    expect(after.project.draftSnapshotId).toBe(restored.id);
    expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
    expect(after.snapshots.map((snapshot) => snapshot.id)).toContain(historicalId);
    restored.pages[0].title.en = "Mutated restored output";
    expect(
      (await repository.get(projectId)).snapshots.find(
        (snapshot) => snapshot.id === after.project.draftSnapshotId,
      )?.pages[0]?.title.en,
    ).toBe("Home");
  });

  it("returns a typed error for an unknown historical snapshot", async () => {
    await expect(repository.restore(projectId, "snapshot_missing")).rejects.toBeInstanceOf(
      SnapshotNotFoundError,
    );
  });

  it("never alters protected commerce display data", async () => {
    const protectedBefore = structuredClone(aurumNordicSeed.catalogue.products).map(
      ({ id, price, stockStatus }) => ({ id, price, stockStatus }),
    );
    const draft = editableDraft();
    draft.id = "snapshot_protected_fields_test";

    await repository.saveDraft(projectId, draft);
    await repository.publish(projectId, aurumNordicSeed.project.revision);
    await repository.restore(projectId, aurumNordicSeed.publishedSnapshot.id);

    const protectedAfter = (await repository.get(projectId)).catalogue.products.map(
      ({ id, price, stockStatus }) => ({ id, price, stockStatus }),
    );
    expect(protectedAfter).toEqual(protectedBefore);
  });
});
