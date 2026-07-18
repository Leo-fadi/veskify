import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { createInitialProjectAggregate } from "@/application/initial-project-aggregate";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront";
import {
  CatalogueAlreadyExistsError,
  InMemoryProjectRepository,
  IndexedDbProjectRepository,
  NoStorefrontChangesError,
  ProjectAlreadyExistsError,
  SnapshotAlreadyExistsError,
  type ProjectAggregate,
  type ProjectRepository,
  type PublishExpectation,
} from "@/services/storage";
import { initialAggregateFixture } from "../helpers/initial-project-aggregate";

let databaseSequence = 0;
const indexedRepositories: IndexedDbProjectRepository[] = [];
const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(indexedRepositories.splice(0).map((repository) => repository.close()));
  await Promise.all(databaseNames.splice(0).map((databaseName) => deleteDB(databaseName)));
});

function createRepository(kind: "in-memory" | "indexed-db"): ProjectRepository {
  if (kind === "in-memory") return new InMemoryProjectRepository([]);
  databaseSequence += 1;
  const databaseName = `veskify-initial-aggregate-${databaseSequence}`;
  databaseNames.push(databaseName);
  const repository = new IndexedDbProjectRepository({ databaseName });
  indexedRepositories.push(repository);
  return repository;
}

function expectation(aggregate: ProjectAggregate): PublishExpectation {
  const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
  const published = aggregate.snapshots.find(
    ({ id }) => id === aggregate.project.publishedSnapshotId,
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

describe.each(["in-memory", "indexed-db"] as const)(
  "P3-15 handoff through the %s repository",
  (kind) => {
    it("creates and returns the exact initial aggregate without history", async () => {
      const repository = createRepository(kind);
      const input = initialAggregateFixture({ suffix: `${kind}-create` });
      const aggregate = createInitialProjectAggregate(input);
      const created = await repository.create(aggregate);
      const loaded = await repository.get(aggregate.project.id);

      expect(created).toEqual(aggregate);
      expect(loaded).toEqual(aggregate);
      expect("snapshotHistoryMetadata" in loaded).toBe(false);
      expect(loaded.project.draftSnapshotId).toBe(input.guidedGenerationPlan.snapshotId);
      expect(loaded.snapshots.find(({ id }) => id === loaded.project.draftSnapshotId)).toEqual(
        input.guidedGenerationPlan.generatedSnapshot,
      );

      input.catalogue.products[0].price.amount = 1;
      created.catalogue.products[0].price.amount = 2;
      loaded.project.name = "Returned value mutation";
      const preserved = await repository.get(aggregate.project.id);
      expect(preserved.project.name).toBe("Northern Light Studio");
      expect(preserved.catalogue.products[0].price.amount).not.toBe(1);
      expect(preserved.catalogue.products[0].price.amount).not.toBe(2);
    });

    it("starts synchronized, then supports the normal changed-draft publish flow", async () => {
      const repository = createRepository(kind);
      const aggregate = createInitialProjectAggregate(
        initialAggregateFixture({ suffix: `${kind}-publish` }),
      );
      await repository.create(aggregate);
      const initial = await repository.get(aggregate.project.id);
      await expect(
        repository.publish(initial.project.id, expectation(initial)),
      ).rejects.toBeInstanceOf(NoStorefrontChangesError);
      expect((await repository.get(initial.project.id)).snapshotHistoryMetadata).toBeUndefined();

      const currentDraft = initial.snapshots.find(
        ({ id }) => id === initial.project.draftSnapshotId,
      )!;
      const changedDraft = structuredClone(currentDraft);
      changedDraft.id = `snapshot_changed_${kind}`;
      changedDraft.createdAt = new Date(Date.parse(currentDraft.createdAt) + 1_000).toISOString();
      changedDraft.pages[0].title.en = "A legitimate saved change";
      await repository.saveDraft(initial.project.id, changedDraft, {
        id: currentDraft.id,
        revision: currentDraft.revision,
      });
      const changed = await repository.get(initial.project.id);
      const published = await repository.publish(changed.project.id, expectation(changed));
      expect(published.project.revision).toBe(1);
      expect(published.snapshotHistoryMetadata?.length).toBeGreaterThan(0);
    });

    it("retains typed identity conflicts and atomic rejection", async () => {
      const repository = createRepository(kind);
      const first = createInitialProjectAggregate(
        initialAggregateFixture({ suffix: `${kind}-identity-a` }),
      );
      await repository.create(first);
      const before = await repository.get(first.project.id);
      await expect(repository.create(first)).rejects.toBeInstanceOf(ProjectAlreadyExistsError);

      const catalogueConflict = createInitialProjectAggregate(
        initialAggregateFixture({
          suffix: `${kind}-identity-b`,
          catalogueId: first.catalogue.id,
        }),
      );
      await expect(repository.create(catalogueConflict)).rejects.toBeInstanceOf(
        CatalogueAlreadyExistsError,
      );

      const snapshotFixture = initialAggregateFixture({ suffix: `${kind}-identity-c` });
      const snapshotConflict = createInitialProjectAggregate({
        ...snapshotFixture,
        publishedSnapshotId: first.project.publishedSnapshotId,
      });
      await expect(repository.create(snapshotConflict)).rejects.toBeInstanceOf(
        SnapshotAlreadyExistsError,
      );
      expect(await repository.get(first.project.id)).toEqual(before);
    });
  },
);

it("reopening IndexedDB preserves the factory aggregate without invented history", async () => {
  databaseSequence += 1;
  const databaseName = `veskify-initial-aggregate-reopen-${databaseSequence}`;
  databaseNames.push(databaseName);
  const firstRepository = new IndexedDbProjectRepository({ databaseName });
  indexedRepositories.push(firstRepository);
  const aggregate = createInitialProjectAggregate(
    initialAggregateFixture({ suffix: "indexed-reopen" }),
  );
  await firstRepository.create(aggregate);
  await firstRepository.close();
  indexedRepositories.splice(indexedRepositories.indexOf(firstRepository), 1);

  const reopened = new IndexedDbProjectRepository({ databaseName });
  indexedRepositories.push(reopened);
  expect(await reopened.get(aggregate.project.id)).toEqual(aggregate);
  expect((await reopened.get(aggregate.project.id)).snapshotHistoryMetadata).toBeUndefined();
});
