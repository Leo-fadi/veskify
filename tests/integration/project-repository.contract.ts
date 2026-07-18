import { beforeEach, describe, expect, it } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  CatalogueAlreadyExistsError,
  DraftConflictError,
  InvalidRestoreTargetError,
  NoStorefrontChangesError,
  ProjectNotFoundError,
  ProjectAlreadyExistsError,
  PublishedConflictError,
  PublishContentConflictError,
  RepositoryValidationError,
  RevisionConflictError,
  SnapshotNotFoundError,
  SnapshotAlreadyExistsError,
  SnapshotProjectMismatchError,
  type ProjectAggregate,
  type ProjectRepository,
  type PublishExpectation,
} from "@/services/storage";

const projectId = aurumNordicSeed.project.id;

function editableDraft(): StorefrontSnapshot {
  return structuredClone(aurumNordicSeed.draftSnapshot);
}

export function createdAggregate(label: string): ProjectAggregate {
  const project = structuredClone(aurumNordicSeed.project);
  const catalogue = structuredClone(aurumNordicSeed.catalogue);
  const published = structuredClone(aurumNordicSeed.publishedSnapshot);
  const draft = structuredClone(aurumNordicSeed.draftSnapshot);
  project.id = `project_created_${label}`;
  project.name = `Created ${label}`;
  catalogue.id = `catalogue_created_${label}`;
  published.id = `snapshot_created_published_${label}`;
  draft.id = `snapshot_created_draft_${label}`;
  for (const snapshot of [published, draft]) {
    snapshot.projectId = project.id;
    snapshot.catalogueRef = catalogue.id;
  }
  return {
    project: {
      ...project,
      publishedSnapshotId: published.id,
      draftSnapshotId: draft.id,
    },
    catalogue,
    snapshots: [published, draft],
    snapshotHistoryMetadata: [
      {
        snapshotId: published.id,
        projectId: project.id,
        reason: "published",
        summary: {
          en: "Created storefront history.",
          fi: "Luodun verkkokaupan historia.",
        },
      },
    ],
  };
}

function publishExpectation(aggregate: ProjectAggregate): PublishExpectation {
  const draft = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
  )!;
  const published = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
  )!;
  return {
    projectRevision: aggregate.project.revision,
    draft: {
      id: draft.id,
      revision: draft.revision,
      contentFingerprint: canonicalStorefrontContentFingerprint(draft),
    },
    published: {
      id: published.id,
      revision: published.revision,
      contentFingerprint: canonicalStorefrontContentFingerprint(published),
    },
  };
}

async function saveMeaningfulDraft(
  repository: ProjectRepository,
  label: string,
): Promise<ProjectAggregate> {
  const before = await repository.get(projectId);
  const current = before.snapshots.find(
    (snapshot) => snapshot.id === before.project.draftSnapshotId,
  )!;
  const draft = structuredClone(current);
  draft.id = `snapshot_publishable_${label}`;
  draft.createdAt = new Date(Date.parse(current.createdAt) + 1_000).toISOString();
  draft.pages[0].title.en = `Publishable ${label}`;
  await repository.saveDraft(projectId, draft, {
    id: current.id,
    revision: current.revision,
  });
  return repository.get(projectId);
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

    it("atomically creates a complete detached aggregate and preserves its metadata", async () => {
      const input = createdAggregate("complete");
      const original = structuredClone(input);
      const created = await repository.create(input);

      expect(input).toEqual(original);
      const loaded = await repository.get(input.project.id);
      expect(loaded.project).toEqual(created.project);
      expect(loaded.catalogue).toEqual(created.catalogue);
      expect(loaded.snapshots.map(({ id }) => id).sort()).toEqual(
        created.snapshots.map(({ id }) => id).sort(),
      );
      expect(loaded.snapshotHistoryMetadata).toEqual(created.snapshotHistoryMetadata);
      expect(await repository.list()).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: input.project.id })]),
      );
      expect(created.project).toEqual(input.project);
      expect(created.catalogue).toEqual(input.catalogue);
      expect(created.snapshots).toEqual(input.snapshots);
      expect(created.snapshotHistoryMetadata).toEqual(input.snapshotHistoryMetadata);

      created.project.name = "Mutated result";
      created.catalogue.products[0].price.amount = 1;
      created.snapshots[0].pages[0].title.en = "Mutated result";
      const isolated = await repository.get(input.project.id);
      expect(isolated.project).toEqual(input.project);
      expect(isolated.catalogue).toEqual(input.catalogue);
      expect(isolated.snapshots.map(({ id }) => id).sort()).toEqual(
        input.snapshots.map(({ id }) => id).sort(),
      );

      input.project.name = "Mutated input";
      input.snapshots[0].pages[0].title.en = "Mutated input";
      expect((await repository.get(original.project.id)).project.name).toBe("Created complete");
      expect((await repository.get(original.project.id)).snapshots[0].pages[0].title.en).toBe(
        original.snapshots[0].pages[0].title.en,
      );
    });

    it("rejects identity conflicts and leaves existing aggregates unchanged", async () => {
      const first = createdAggregate("identity_first");
      await repository.create(first);
      const before = await repository.get(first.project.id);

      const duplicateProject = createdAggregate("identity_project");
      duplicateProject.project.id = first.project.id;
      duplicateProject.snapshots.forEach((snapshot) => (snapshot.projectId = first.project.id));
      duplicateProject.snapshotHistoryMetadata?.forEach(
        (metadata) => (metadata.projectId = first.project.id),
      );
      await expect(repository.create(duplicateProject)).rejects.toBeInstanceOf(
        ProjectAlreadyExistsError,
      );

      const duplicateCatalogue = createdAggregate("identity_catalogue");
      duplicateCatalogue.catalogue.id = first.catalogue.id;
      duplicateCatalogue.snapshots.forEach(
        (snapshot) => (snapshot.catalogueRef = first.catalogue.id),
      );
      await expect(repository.create(duplicateCatalogue)).rejects.toBeInstanceOf(
        CatalogueAlreadyExistsError,
      );

      const duplicateSnapshot = createdAggregate("identity_snapshot");
      duplicateSnapshot.snapshots[0].id = first.snapshots[0].id;
      duplicateSnapshot.project.publishedSnapshotId = duplicateSnapshot.snapshots[0].id;
      duplicateSnapshot.snapshotHistoryMetadata![0].snapshotId = duplicateSnapshot.snapshots[0].id;
      await expect(repository.create(duplicateSnapshot)).rejects.toBeInstanceOf(
        SnapshotAlreadyExistsError,
      );

      expect(await repository.get(first.project.id)).toEqual(before);
      expect(await repository.list()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: first.project.id }),
          expect.objectContaining({ id: aurumNordicSeed.project.id }),
        ]),
      );
    });

    it("rejects invalid aggregates before writing and permits another valid project", async () => {
      const cases: Array<(aggregate: ProjectAggregate) => void> = [
        (aggregate) => (aggregate.snapshots[0].pages[0].sections[0].component = "unknownComponent"),
        (aggregate) => (aggregate.project.draftSnapshotId = "snapshot_missing_draft"),
        (aggregate) => (aggregate.project.publishedSnapshotId = "snapshot_missing_published"),
        (aggregate) => (aggregate.snapshots[0].projectId = "project_other"),
        (aggregate) => (aggregate.snapshots[0].catalogueRef = "catalogue_other"),
        (aggregate) =>
          aggregate.snapshotHistoryMetadata!.push({
            snapshotId: "snapshot_missing_history",
            projectId: aggregate.project.id,
            reason: "published",
            summary: { en: "Invalid", fi: "Virheellinen" },
          }),
        (aggregate) => (aggregate.snapshots[1].id = aggregate.snapshots[0].id),
      ];
      const before = await repository.list();
      for (const [index, mutate] of cases.entries()) {
        const invalid = createdAggregate(`invalid_${index}`);
        mutate(invalid);
        await expect(repository.create(invalid)).rejects.toBeInstanceOf(RepositoryValidationError);
        expect(await repository.list()).toEqual(before);
      }

      const second = await repository.create(createdAggregate("second_valid"));
      expect(second.project.id).toBe("project_created_second_valid");
    });

    it("allows only one concurrent creation for the same project identity", async () => {
      const left = createdAggregate("concurrent");
      const right = structuredClone(left);
      const results = await Promise.allSettled([repository.create(left), repository.create(right)]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected && rejected.reason).toBeInstanceOf(ProjectAlreadyExistsError);
      expect((await repository.list()).filter(({ id }) => id === left.project.id)).toHaveLength(1);
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

      const afterPublish = await repository.publish(projectId, publishExpectation(afterSaves));
      expect(afterPublish.project.revision).toBe(afterSaves.project.revision + 1);
      expect(afterPublish.snapshots).toHaveLength(20);
      expect(afterPublish.snapshots.map(({ id }) => id)).toContain(
        before.project.publishedSnapshotId,
      );
      expect(
        afterPublish.snapshots.find(
          (snapshot) => snapshot.id === afterPublish.project.publishedSnapshotId,
        )?.pages[0].title.en,
      ).toBe("Saved draft 100");
      const synchronizedDraft = afterPublish.snapshots.find(
        (snapshot) => snapshot.id === afterPublish.project.draftSnapshotId,
      )!;
      const published = afterPublish.snapshots.find(
        (snapshot) => snapshot.id === afterPublish.project.publishedSnapshotId,
      )!;
      expect(synchronizedDraft.id).not.toBe(published.id);
      expect(synchronizedDraft.revision).toBe(afterPublish.project.revision);
      expect(published.revision).toBe(afterPublish.project.revision);
      expect(canonicalStorefrontContentEqual(synchronizedDraft, published)).toBe(true);

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
    }, 60_000);

    it("publishes the current draft, increments revision and preserves history", async () => {
      const before = await saveMeaningfulDraft(repository, "single_publish");
      const after = await repository.publish(projectId, publishExpectation(before));
      const published = after.snapshots.find(
        (snapshot) => snapshot.id === after.project.publishedSnapshotId,
      );
      const draft = after.snapshots.find(
        (snapshot) => snapshot.id === after.project.draftSnapshotId,
      );

      expect(after.project.revision).toBe(before.project.revision + 1);
      expect(after.project.publishedSnapshotId).not.toBe(before.project.publishedSnapshotId);
      expect(after.project.draftSnapshotId).not.toBe(before.project.draftSnapshotId);
      expect(published?.id).not.toBe(draft?.id);
      expect(published?.revision).toBe(after.project.revision);
      expect(draft?.revision).toBe(after.project.revision);
      expect(canonicalStorefrontContentEqual(published!, draft!)).toBe(true);
      expect(after.snapshotHistoryMetadata).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ snapshotId: published!.id, reason: "published" }),
          expect.objectContaining({
            snapshotId: draft!.id,
            reason: "publishedDraftSynchronized",
          }),
        ]),
      );
      expect(after.snapshots.map(({ id }) => id)).toContain(before.project.publishedSnapshotId);
      expect(after.snapshots).toHaveLength(before.snapshots.length + 2);
      expect(after).toEqual(await repository.get(projectId));
    });

    it("retains every immutable published snapshot across repeated publishes", async () => {
      const publishedIds = new Set<string>();
      const initial = await repository.get(projectId);
      publishedIds.add(initial.project.publishedSnapshotId);

      for (let index = 1; index <= 20; index += 1) {
        const saved = await saveMeaningfulDraft(repository, `sequential_${index}`);
        const published = await repository.publish(projectId, publishExpectation(saved));
        publishedIds.add(published.project.publishedSnapshotId);
        expect(published.project.revision).toBe(initial.project.revision + index);
        expect(publishedIds.size).toBe(index + 1);
        for (const publishedId of publishedIds) {
          expect(published.snapshots.map(({ id }) => id)).toContain(publishedId);
        }
      }

      const afterPublishes = await repository.get(projectId);
      expect(afterPublishes.snapshots.length).toBeGreaterThan(20);
      const oldestPublishedId = initial.project.publishedSnapshotId;
      const preRestoreDraftId = afterPublishes.project.draftSnapshotId;
      const preRestoreDraft = structuredClone(
        afterPublishes.snapshots.find(({ id }) => id === preRestoreDraftId)!,
      );
      const restored = await repository.restore(projectId, oldestPublishedId);
      const afterRestore = await repository.get(projectId);
      expect(afterRestore.project.draftSnapshotId).toBe(restored.id);
      expect(afterRestore.snapshots.map(({ id }) => id)).toContain(oldestPublishedId);
      expect(afterRestore.snapshots.map(({ id }) => id)).toContain(preRestoreDraftId);
      expect(afterRestore.project.publishedSnapshotId).toBe(
        afterPublishes.project.publishedSnapshotId,
      );

      const reversed = await repository.restore(projectId, preRestoreDraftId);
      const afterReverse = await repository.get(projectId);
      expect(canonicalStorefrontContentEqual(reversed, preRestoreDraft)).toBe(true);
      expect(afterReverse.snapshots.map(({ id }) => id)).toEqual(
        expect.arrayContaining([oldestPublishedId, preRestoreDraftId, restored.id, reversed.id]),
      );
      expect(afterReverse.project.publishedSnapshotId).toBe(
        afterPublishes.project.publishedSnapshotId,
      );
    }, 30_000);

    it("rejects publishing a draft with no meaningful storefront changes", async () => {
      const before = await repository.get(projectId);

      await expect(
        repository.publish(projectId, publishExpectation(before)),
      ).rejects.toBeInstanceOf(NoStorefrontChangesError);

      expect(await repository.get(projectId)).toEqual(before);
    });

    it("rejects reuse of an older published-history snapshot without changing state", async () => {
      const initial = await saveMeaningfulDraft(repository, "history_id_reuse");
      const olderPublishedId = initial.project.publishedSnapshotId;
      await repository.publish(projectId, publishExpectation(initial));
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
      const staleExpectation = publishExpectation(before);
      staleExpectation.projectRevision -= 1;
      await expect(repository.publish(projectId, staleExpectation)).rejects.toBeInstanceOf(
        RevisionConflictError,
      );
      expect(await repository.get(projectId)).toEqual(before);
    });

    it("rejects stale draft, published and canonical publish expectations atomically", async () => {
      const before = await saveMeaningfulDraft(repository, "stale_expectations");
      const cases: Array<[PublishExpectation, new (...args: never[]) => Error]> = [
        [
          {
            ...publishExpectation(before),
            draft: { ...publishExpectation(before).draft, id: "snapshot_wrong_draft" },
          },
          DraftConflictError,
        ],
        [
          {
            ...publishExpectation(before),
            published: {
              ...publishExpectation(before).published,
              id: "snapshot_wrong_published",
            },
          },
          PublishedConflictError,
        ],
        [
          {
            ...publishExpectation(before),
            draft: {
              ...publishExpectation(before).draft,
              contentFingerprint: `v1_0_${"0".repeat(64)}`,
            },
          },
          PublishContentConflictError,
        ],
        [
          {
            ...publishExpectation(before),
            published: {
              ...publishExpectation(before).published,
              contentFingerprint: `v1_0_${"0".repeat(64)}`,
            },
          },
          PublishContentConflictError,
        ],
      ];

      for (const [expectation, error] of cases) {
        await expect(repository.publish(projectId, expectation)).rejects.toBeInstanceOf(error);
        expect(await repository.get(projectId)).toEqual(before);
      }
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
      expect(after.snapshotHistoryMetadata).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ snapshotId: restored.id, reason: "restored" }),
        ]),
      );
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

    it("retains older published history through a later restore", async () => {
      const initial = await saveMeaningfulDraft(repository, "published_restore");
      const olderPublishedId = initial.project.publishedSnapshotId;
      const afterPublish = await repository.publish(projectId, publishExpectation(initial));
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
      expect(afterRestore.snapshots).toHaveLength(6);
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
      draft.pages[0].title.en = "Protected fields publish";
      await repository.saveDraft(projectId, draft);
      const saved = await repository.get(projectId);
      await repository.publish(projectId, publishExpectation(saved));
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
