import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { createApprovedStorefrontProject } from "@/application/approved-storefront-project";
import {
  InMemoryProjectRepository,
  IndexedDbProjectRepository,
  type ProjectRepository,
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
  const databaseName = `veskify-approved-project-${databaseSequence}`;
  databaseNames.push(databaseName);
  const repository = new IndexedDbProjectRepository({ databaseName });
  indexedRepositories.push(repository);
  return repository;
}

describe.each(["in-memory", "indexed-db"] as const)(
  "P3-17 approved project creation through the %s repository",
  (kind) => {
    it("persists the approved aggregate and leaves it as an unpublished draft", async () => {
      const input = initialAggregateFixture({ suffix: `${kind}-integration` });
      const repository = createRepository(kind);

      const result = await createApprovedStorefrontProject({ ...input, repository });
      const loaded = await repository.get(result.projectId);

      expect(result).toEqual({
        projectId: loaded.project.id,
        draftSnapshotId: loaded.project.draftSnapshotId,
        publishedSnapshotId: loaded.project.publishedSnapshotId,
      });
      expect(loaded.project.revision).toBe(0);
      expect(loaded.project.draftSnapshotId).toBe(input.guidedGenerationPlan.snapshotId);
      expect(loaded.snapshotHistoryMetadata).toBeUndefined();
    });
  },
);

it("IndexedDB project creation survives closing and reopening the repository", async () => {
  databaseSequence += 1;
  const databaseName = `veskify-approved-project-reopen-${databaseSequence}`;
  databaseNames.push(databaseName);
  const first = new IndexedDbProjectRepository({ databaseName });
  indexedRepositories.push(first);
  const input = initialAggregateFixture({ suffix: "indexed-reopen" });

  const result = await createApprovedStorefrontProject({ ...input, repository: first });
  await first.close();
  indexedRepositories.splice(indexedRepositories.indexOf(first), 1);

  const reopened = new IndexedDbProjectRepository({ databaseName });
  indexedRepositories.push(reopened);
  await expect(reopened.get(result.projectId)).resolves.toMatchObject({
    project: {
      id: result.projectId,
      draftSnapshotId: result.draftSnapshotId,
      publishedSnapshotId: result.publishedSnapshotId,
      revision: 0,
    },
  });
});
