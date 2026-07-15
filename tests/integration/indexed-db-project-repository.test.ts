import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { aurumNordicSeed } from "@/data/seed";
import {
  IndexedDbProjectRepository,
  RepositoryValidationError,
} from "@/services/storage";
import { runProjectRepositoryContract } from "./project-repository.contract";

const openRepositories: IndexedDbProjectRepository[] = [];
const databaseNames = new Set<string>();
let databaseSequence = 0;

function testDatabaseName(label: string): string {
  databaseSequence += 1;
  const name = `veskify-test-${label}-${databaseSequence}`;
  databaseNames.add(name);
  return name;
}

function openRepository(
  databaseName: string,
  options: ConstructorParameters<typeof IndexedDbProjectRepository>[0] = {},
): IndexedDbProjectRepository {
  const repository = new IndexedDbProjectRepository({ ...options, databaseName });
  openRepositories.push(repository);
  return repository;
}

afterEach(async () => {
  await Promise.all(openRepositories.splice(0).map((repository) => repository.close()));
  await Promise.all([...databaseNames].map((name) => deleteDB(name)));
  databaseNames.clear();
});

runProjectRepositoryContract("IndexedDbProjectRepository", () =>
  openRepository(testDatabaseName("contract")),
);

describe("IndexedDbProjectRepository persistence", () => {
  it("bootstraps the seed only on the first initialization", async () => {
    const databaseName = testDatabaseName("bootstrap");
    const first = openRepository(databaseName);
    const draft = structuredClone(aurumNordicSeed.draftSnapshot);
    draft.id = "snapshot_persisted_draft";
    draft.pages[0].title.en = "Persisted browser draft";
    await first.saveDraft(aurumNordicSeed.project.id, draft);
    await first.close();

    const reopened = openRepository(databaseName);
    const aggregate = await reopened.get(aurumNordicSeed.project.id);
    expect(aggregate.project.draftSnapshotId).toBe(draft.id);
    expect(
      aggregate.snapshots.find((snapshot) => snapshot.id === draft.id)?.pages[0]?.title.en,
    ).toBe("Persisted browser draft");
    expect(aggregate.snapshots).toHaveLength(3);
  });

  it("uses injected deterministic identity and time generation", async () => {
    const repository = openRepository(testDatabaseName("generators"), {
      createSnapshotId: ({ reason }) => `snapshot_test_${reason}`,
      createTimestamp: () => "2026-07-16T10:00:00.000Z",
    });

    const aggregate = await repository.publish(
      aurumNordicSeed.project.id,
      aurumNordicSeed.project.revision,
    );
    expect(aggregate.project.publishedSnapshotId).toBe("snapshot_test_published");
    expect(aggregate.project.updatedAt).toBe("2026-07-16T10:00:00.000Z");
  });

  it("leaves no partial writes when a publish cannot create a unique snapshot", async () => {
    const repository = openRepository(testDatabaseName("rollback"), {
      createSnapshotId: () => aurumNordicSeed.publishedSnapshot.id,
    });
    const before = await repository.get(aurumNordicSeed.project.id);

    await expect(
      repository.publish(aurumNordicSeed.project.id, before.project.revision),
    ).rejects.toBeInstanceOf(RepositoryValidationError);
    expect(await repository.get(aurumNordicSeed.project.id)).toEqual(before);
  });

  it("keeps persisted return values defensively isolated after reopening", async () => {
    const databaseName = testDatabaseName("isolation");
    const first = openRepository(databaseName);
    const aggregate = await first.get(aurumNordicSeed.project.id);
    aggregate.catalogue.products[0].price.amount = 1;
    aggregate.project.name = "External mutation";
    await first.close();

    const reopened = openRepository(databaseName);
    const persisted = await reopened.get(aurumNordicSeed.project.id);
    expect(persisted.catalogue.products[0].price.amount).toBe(1290);
    expect(persisted.project.name).toBe("Aurum Nordic");
  });
});
