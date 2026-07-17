import { beforeEach, describe, expect, it } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import type { StorefrontSnapshot } from "@/domain/storefront";
import {
  DraftConflictError,
  InvalidRestoreTargetError,
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
      expect(
        aggregate.snapshots
          .find((snapshot) => snapshot.id === aggregate.project.draftSnapshotId)
          ?.pages.find((page) => page.type === "home")?.sections,
      ).toHaveLength(10);
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
      const supersededDraftId = before.project.draftSnapshotId;
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
      expect(after.snapshots.some((snapshot) => snapshot.id === supersededDraftId)).toBe(true);
      expect(after.snapshots).toHaveLength(before.snapshots.length + 1);
    });

    it("atomically rejects saving over a different draft base", async () => {
      const before = await repository.get(projectId);
      const originalDraft = before.snapshots.find(
        (snapshot) => snapshot.id === before.project.draftSnapshotId,
      )!;
      const newer = editableDraft();
      newer.id = "snapshot_newer_draft_base";
      newer.pages[0].title.en = "Newer stored draft";
      await repository.saveDraft(projectId, newer);
      const beforeStaleAttempt = await repository.get(projectId);
      const stale = editableDraft();
      stale.id = "snapshot_stale_draft_attempt";
      stale.pages[0].title.en = "Stale overwrite";

      await expect(
        repository.saveDraft(projectId, stale, {
          id: originalDraft.id,
          revision: originalDraft.revision,
        }),
      ).rejects.toBeInstanceOf(DraftConflictError);
      const after = await repository.get(projectId);
      expect(after).toEqual(beforeStaleAttempt);
    });

    it("rejects invalid, foreign and historical draft snapshots", async () => {
      const before = await repository.get(projectId);
      const invalid = editableDraft();
      invalid.id = "snapshot_invalid_component";
      invalid.pages[0].sections[0].component = "unknownComponent";
      await expect(repository.saveDraft(projectId, invalid)).rejects.toBeInstanceOf(
        RepositoryValidationError,
      );

      const missingProduct = editableDraft();
      missingProduct.id = "snapshot_missing_product";
      const productGrid = missingProduct.pages[0].sections.find(
        (section) => section.component === "productGrid",
      );
      if (!productGrid) throw new Error("The seeded homepage must include a product grid.");
      productGrid.content.productIds = ["product_missing"];
      await expect(repository.saveDraft(projectId, missingProduct)).rejects.toBeInstanceOf(
        RepositoryValidationError,
      );

      const foreign = editableDraft();
      foreign.id = "snapshot_foreign_project";
      foreign.projectId = "project_other";
      await expect(repository.saveDraft(projectId, foreign)).rejects.toBeInstanceOf(
        SnapshotProjectMismatchError,
      );

      const catalogueMismatch = editableDraft();
      catalogueMismatch.id = "snapshot_catalogue_mismatch";
      catalogueMismatch.catalogueRef = "catalogue_other";
      await expect(repository.saveDraft(projectId, catalogueMismatch)).rejects.toBeInstanceOf(
        RepositoryValidationError,
      );

      const historical = editableDraft();
      historical.id = before.project.publishedSnapshotId;
      historical.pages[0].title.en = "Attempted history overwrite";
      await expect(repository.saveDraft(projectId, historical)).rejects.toBeInstanceOf(
        RepositoryValidationError,
      );
      expect(await repository.get(projectId)).toEqual(before);
    });

    it("keeps 100 sequential draft saves bounded and publishes the latest draft", async () => {
      const before = await repository.get(projectId);
      const publishedBefore = structuredClone(
        before.snapshots.find((snapshot) => snapshot.id === before.project.publishedSnapshotId),
      );
      const catalogueBefore = structuredClone(before.catalogue);
      const supersededDraftIds: string[] = [];

      for (let index = 1; index <= 100; index += 1) {
        const current = await repository.get(projectId);
        const currentDraft = current.snapshots.find(
          (snapshot) => snapshot.id === current.project.draftSnapshotId,
        )!;
        supersededDraftIds.push(currentDraft.id);
        const candidate = structuredClone(currentDraft);
        candidate.id = `snapshot_compacted_${index}`;
        candidate.createdAt = new Date(Date.parse(currentDraft.createdAt) + 1_000).toISOString();
        candidate.pages[0].title.en = `Saved draft ${index}`;
        await repository.saveDraft(projectId, candidate, {
          id: currentDraft.id,
          revision: currentDraft.revision,
        });

        const saved = await repository.get(projectId);
        expect(saved.project.draftSnapshotId).toBe(candidate.id);
        expect(
          saved.snapshots.find((snapshot) => snapshot.id === candidate.id)?.pages[0].title.en,
        ).toBe(`Saved draft ${index}`);
        expect(saved.snapshots.length).toBeLessThanOrEqual(20);
      }

      const afterSaves = await repository.get(projectId);
      expect(afterSaves.project.revision).toBe(before.project.revision);
      expect(afterSaves.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
      expect(afterSaves.catalogue).toEqual(catalogueBefore);
      expect(
        afterSaves.snapshots.find(
          (snapshot) => snapshot.id === afterSaves.project.publishedSnapshotId,
        ),
      ).toEqual(publishedBefore);
      expect(afterSaves.snapshots).toHaveLength(20);
      expect(
        afterSaves.snapshots.filter(
          (snapshot) => snapshot.id === afterSaves.project.draftSnapshotId,
        ),
      ).toHaveLength(1);
      const retainedSupersededDrafts = afterSaves.snapshots.filter(
        (snapshot) =>
          snapshot.id !== afterSaves.project.draftSnapshotId &&
          snapshot.id !== afterSaves.project.publishedSnapshotId,
      );
      expect(retainedSupersededDrafts).toHaveLength(18);
      expect(retainedSupersededDrafts.map(({ id }) => id)).toEqual(
        Array.from({ length: 18 }, (_, index) => `snapshot_compacted_${index + 82}`),
      );

      await expect(repository.restore(projectId, supersededDraftIds[0])).rejects.toBeInstanceOf(
        SnapshotNotFoundError,
      );

      const afterPublish = await repository.publish(projectId, afterSaves.project.revision);
      expect(afterPublish.project.revision).toBe(afterSaves.project.revision + 1);
      expect(afterPublish.snapshots).toHaveLength(21);
      expect(afterPublish.snapshots.map(({ id }) => id)).toContain(
        before.project.publishedSnapshotId,
      );
      expect(
        afterPublish.snapshots.find(
          (snapshot) => snapshot.id === afterPublish.project.publishedSnapshotId,
        )?.pages[0].title.en,
      ).toBe("Saved draft 100");

      const newestSupersededId = "snapshot_compacted_99";
      const restored = await repository.restore(projectId, newestSupersededId);
      const afterRestore = await repository.get(projectId);
      expect(afterRestore.project.draftSnapshotId).toBe(restored.id);
      expect(afterRestore.snapshots.map(({ id }) => id)).toContain(newestSupersededId);
      expect(afterRestore.snapshots.map(({ id }) => id)).toContain(
        before.project.publishedSnapshotId,
      );
      expect(afterRestore.snapshots.map(({ id }) => id)).toContain(
        afterPublish.project.publishedSnapshotId,
      );
      expect(afterRestore.snapshots).toHaveLength(20);
    }, 15_000);

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

    it("rejects reuse of an older published-history snapshot without changing state", async () => {
      const initial = await repository.get(projectId);
      const olderPublishedId = initial.project.publishedSnapshotId;
      await repository.publish(projectId, initial.project.revision);
      const beforeAttempt = await repository.get(projectId);
      const candidate = structuredClone(
        beforeAttempt.snapshots.find(
          (snapshot) => snapshot.id === beforeAttempt.project.draftSnapshotId,
        )!,
      );
      candidate.id = olderPublishedId;
      candidate.pages[0].title.en = "Attempted older history overwrite";

      await expect(repository.saveDraft(projectId, candidate)).rejects.toBeInstanceOf(
        RepositoryValidationError,
      );
      expect(await repository.get(projectId)).toEqual(beforeAttempt);
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
      const supersededDraftId = before.project.draftSnapshotId;
      const restored = await repository.restore(projectId, historicalId);
      const after = await repository.get(projectId);

      expect(restored.id).not.toBe(historicalId);
      expect(after.project.draftSnapshotId).toBe(restored.id);
      expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
      expect(after.project.revision).toBe(before.project.revision);
      expect(after.snapshots.map(({ id }) => id)).toContain(historicalId);
      expect(after.snapshots.map(({ id }) => id)).toContain(supersededDraftId);
      expect(after.snapshots).toHaveLength(before.snapshots.length + 1);
      restored.pages[0].title.en = "Mutated restored output";
      expect(
        (await repository.get(projectId)).snapshots.find(
          (snapshot) => snapshot.id === after.project.draftSnapshotId,
        )?.pages[0]?.title.en,
      ).toBe("Home");
    });

    it("rejects repeated restore attempts against the current draft without mutation", async () => {
      const before = await repository.get(projectId);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(
          repository.restore(projectId, before.project.draftSnapshotId),
        ).rejects.toBeInstanceOf(InvalidRestoreTargetError);
      }

      expect(await repository.get(projectId)).toEqual(before);
    });

    it("retains older published history while restore compacts the current draft", async () => {
      const initial = await repository.get(projectId);
      const olderPublishedId = initial.project.publishedSnapshotId;
      const afterPublish = await repository.publish(projectId, initial.project.revision);
      const currentPublishedId = afterPublish.project.publishedSnapshotId;
      const supersededDraftId = afterPublish.project.draftSnapshotId;

      const restored = await repository.restore(projectId, olderPublishedId);
      const afterRestore = await repository.get(projectId);

      expect(afterRestore.project.draftSnapshotId).toBe(restored.id);
      expect(afterRestore.project.publishedSnapshotId).toBe(currentPublishedId);
      expect(afterRestore.project.revision).toBe(afterPublish.project.revision);
      expect(afterRestore.snapshots.map(({ id }) => id)).toEqual(
        expect.arrayContaining([olderPublishedId, currentPublishedId, restored.id]),
      );
      expect(afterRestore.snapshots.map(({ id }) => id)).toContain(supersededDraftId);
      expect(afterRestore.snapshots).toHaveLength(4);
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
