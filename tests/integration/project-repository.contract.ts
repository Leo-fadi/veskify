import { beforeEach, describe, expect, it } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import type { StorefrontSnapshot } from "@/domain/storefront";
import {
  ProjectNotFoundError,
  RepositoryValidationError,
  RevisionConflictError,
  SnapshotNotFoundError,
  SnapshotProjectMismatchError,
  type ProjectRepository,
} from "@/services/storage";

const projectId = aurumNordicSeed.project.id;

function editableDraft(): StorefrontSnapshot {
  return structuredClone(aurumNordicSeed.draftSnapshot);
}

export function runProjectRepositoryContract(
  name: string,
  createRepository: () => ProjectRepository | Promise<ProjectRepository>,
): void {
  describe(`${name} ProjectRepository contract`, () => {
    let repository: ProjectRepository;

    beforeEach(async () => {
      repository = await createRepository();
    });

    it("lists deterministic seeded summaries and gets the complete aggregate", async () => {
      expect(await repository.list()).toEqual([
        expect.objectContaining({
          id: projectId,
          name: "Aurum Nordic",
          revision: 2,
          publishedSnapshotId: aurumNordicSeed.publishedSnapshot.id,
          draftSnapshotId: aurumNordicSeed.draftSnapshot.id,
        }),
      ]);
      const aggregate = await repository.get(projectId);
      expect(aggregate.catalogue.products).toHaveLength(6);
      expect(aggregate.snapshots.map(({ id }) => id).sort()).toEqual(
        [aurumNordicSeed.publishedSnapshot.id, aurumNordicSeed.draftSnapshot.id].sort(),
      );
    });

    it("defensively isolates returned data and saved inputs", async () => {
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
      expect(stored.project.name).toBe("Aurum Nordic");
      expect(stored.catalogue.products[0].price.amount).toBe(1290);
      expect(stored.snapshots.some((snapshot) => snapshot.pages[0].title.en === "Home")).toBe(true);
      expect(
        stored.snapshots.find((snapshot) => snapshot.id === draft.id)?.pages[0]?.title.en,
      ).toBe("Saved title");
    });

    it("returns a typed error for an unknown project", async () => {
      await expect(repository.get("project_missing")).rejects.toBeInstanceOf(ProjectNotFoundError);
    });

    it("saves only a valid current draft", async () => {
      const before = await repository.get(projectId);
      const draft = editableDraft();
      draft.id = "snapshot_new_draft";
      draft.pages[0].title.en = "New draft home";
      await repository.saveDraft(projectId, draft);

      const after = await repository.get(projectId);
      expect(after.project.draftSnapshotId).toBe(draft.id);
      expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
      expect(after.snapshots.find((snapshot) => snapshot.id === draft.id)?.pages[0]?.title.en).toBe(
        "New draft home",
      );
    });

    it("rejects invalid, foreign and historical draft snapshots", async () => {
      const before = await repository.get(projectId);
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

      const historical = editableDraft();
      historical.id = before.project.publishedSnapshotId;
      historical.pages[0].title.en = "Attempted history overwrite";
      await expect(repository.saveDraft(projectId, historical)).rejects.toBeInstanceOf(
        RepositoryValidationError,
      );
      expect(await repository.get(projectId)).toEqual(before);
    });

    it("publishes the current draft, increments revision and preserves history", async () => {
      const before = await repository.get(projectId);
      const after = await repository.publish(projectId, before.project.revision);
      const published = after.snapshots.find(
        (snapshot) => snapshot.id === after.project.publishedSnapshotId,
      );
      const draft = after.snapshots.find(
        (snapshot) => snapshot.id === before.project.draftSnapshotId,
      );

      expect(after.project.revision).toBe(before.project.revision + 1);
      expect(after.project.publishedSnapshotId).not.toBe(before.project.publishedSnapshotId);
      expect(published?.pages).toEqual(draft?.pages);
      expect(after.snapshots.map(({ id }) => id)).toContain(before.project.publishedSnapshotId);
      expect(after.snapshots).toHaveLength(before.snapshots.length + 1);
    });

    it("rejects a stale publish without changing state", async () => {
      const before = await repository.get(projectId);
      await expect(
        repository.publish(projectId, before.project.revision - 1),
      ).rejects.toBeInstanceOf(RevisionConflictError);
      expect(await repository.get(projectId)).toEqual(before);
    });

    it("restores history to a new isolated draft without publishing", async () => {
      const before = await repository.get(projectId);
      const historicalId = before.project.publishedSnapshotId;
      const restored = await repository.restore(projectId, historicalId);
      const after = await repository.get(projectId);

      expect(restored.id).not.toBe(historicalId);
      expect(after.project.draftSnapshotId).toBe(restored.id);
      expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
      expect(after.snapshots.map(({ id }) => id)).toContain(historicalId);
      restored.pages[0].title.en = "Mutated restored output";
      expect(
        (await repository.get(projectId)).snapshots.find(
          (snapshot) => snapshot.id === after.project.draftSnapshotId,
        )?.pages[0]?.title.en,
      ).toBe("Home");
    });

    it("returns a typed error for an unknown snapshot", async () => {
      await expect(repository.restore(projectId, "snapshot_missing")).rejects.toBeInstanceOf(
        SnapshotNotFoundError,
      );
    });

    it("preserves protected commerce display data", async () => {
      const before = structuredClone(aurumNordicSeed.catalogue.products).map(
        ({ id, price, stockStatus }) => ({ id, price, stockStatus }),
      );
      const draft = editableDraft();
      draft.id = "snapshot_protected_fields_test";
      await repository.saveDraft(projectId, draft);
      await repository.publish(projectId, aurumNordicSeed.project.revision);
      await repository.restore(projectId, aurumNordicSeed.publishedSnapshot.id);

      expect(
        (await repository.get(projectId)).catalogue.products.map(({ id, price, stockStatus }) => ({
          id,
          price,
          stockStatus,
        })),
      ).toEqual(before);
    });
  });
}
