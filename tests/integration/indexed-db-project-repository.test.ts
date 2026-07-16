import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB, openDB } from "idb";
import { aurumNordicSeed } from "@/data/seed";
import { projectSchema } from "@/domain/project";
import {
  aurumNordicPhase0SeedState,
  aurumNordicP101SeedState,
  aurumNordicP102SeedState,
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

async function writePhase0Seed(databaseName: string, modified = false) {
  const database = await openDB(databaseName, 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });
      db.createObjectStore("catalogues", { keyPath: "id" });
      const snapshots = db.createObjectStore("snapshots", { keyPath: "id" });
      snapshots.createIndex("by-project", "projectId");
    },
  });
  const transaction = database.transaction(["projects", "catalogues", "snapshots"], "readwrite");
  const project = structuredClone(aurumNordicPhase0SeedState.project);
  if (modified) project.name = "Merchant-modified Aurum";
  await transaction.objectStore("projects").put(project);
  await transaction
    .objectStore("catalogues")
    .put(structuredClone(aurumNordicPhase0SeedState.catalogue));
  for (const snapshot of aurumNordicPhase0SeedState.snapshots)
    await transaction.objectStore("snapshots").put(structuredClone(snapshot));
  await transaction.done;
  database.close();
}

async function writeP101Seed(databaseName: string, modified = false) {
  const database = await openDB(databaseName, 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });
      db.createObjectStore("catalogues", { keyPath: "id" });
      const snapshots = db.createObjectStore("snapshots", { keyPath: "id" });
      snapshots.createIndex("by-project", "projectId");
    },
  });
  const transaction = database.transaction(["projects", "catalogues", "snapshots"], "readwrite");
  await transaction.objectStore("projects").put(structuredClone(aurumNordicP101SeedState.project));
  await transaction
    .objectStore("catalogues")
    .put(structuredClone(aurumNordicP101SeedState.catalogue));
  for (const source of aurumNordicP101SeedState.snapshots) {
    const snapshot = structuredClone(source);
    if (modified) {
      const homepage = snapshot.pages.find((page) => page.type === "home");
      if (homepage) homepage.title.en = `${snapshot.createdBy} edited homepage`;
    }
    await transaction.objectStore("snapshots").put(snapshot);
  }
  await transaction.done;
  database.close();
}

async function writeP102Seed(
  databaseName: string,
  edit?: "project" | "catalogue" | "draft" | "published",
) {
  const database = await openDB(databaseName, 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });
      db.createObjectStore("catalogues", { keyPath: "id" });
      const snapshots = db.createObjectStore("snapshots", { keyPath: "id" });
      snapshots.createIndex("by-project", "projectId");
    },
  });
  const transaction = database.transaction(["projects", "catalogues", "snapshots"], "readwrite");
  const project = structuredClone(aurumNordicP102SeedState.project);
  const catalogue = structuredClone(aurumNordicP102SeedState.catalogue);
  if (edit === "project") project.name = "Edited P1-02 project";
  if (edit === "catalogue") catalogue.products[0].title.en = "Edited catalogue product";
  await transaction.objectStore("projects").put(project);
  await transaction.objectStore("catalogues").put(catalogue);
  for (const source of aurumNordicP102SeedState.snapshots) {
    const snapshot = structuredClone(source);
    if (edit === "draft" && snapshot.id === project.draftSnapshotId)
      snapshot.pages[0].title.en = "Edited draft";
    if (edit === "published" && snapshot.id === project.publishedSnapshotId)
      snapshot.pages[0].title.en = "Edited published";
    await transaction.objectStore("snapshots").put(snapshot);
  }
  await transaction.done;
  database.close();
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
  it("atomically upgrades the exact untouched Phase 0 Aurum seed", async () => {
    const databaseName = testDatabaseName("phase0-migration");
    await writePhase0Seed(databaseName);
    const repository = openRepository(databaseName);

    const aggregate = await repository.get(aurumNordicSeed.project.id);
    const homepage = aggregate.snapshots
      .find((snapshot) => snapshot.id === aggregate.project.draftSnapshotId)
      ?.pages.find((page) => page.type === "home");
    expect(homepage?.sections).toHaveLength(10);
  });

  it("does not overwrite a locally modified Phase 0 project", async () => {
    const databaseName = testDatabaseName("phase0-modified");
    await writePhase0Seed(databaseName, true);
    const repository = openRepository(databaseName);
    await expect(repository.list()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Merchant-modified Aurum" })]),
    );
    await repository.close();

    const database = await openDB(databaseName, 1);
    const stored: unknown = await database.get("projects", aurumNordicSeed.project.id);
    expect(projectSchema.parse(stored).name).toBe("Merchant-modified Aurum");
    database.close();
  });

  it("atomically upgrades the exact untouched P1-01 seed to the collection composition", async () => {
    const databaseName = testDatabaseName("p101-migration");
    await writeP101Seed(databaseName);
    const repository = openRepository(databaseName);

    const aggregate = await repository.get(aurumNordicSeed.project.id);
    for (const snapshotId of [
      aggregate.project.publishedSnapshotId,
      aggregate.project.draftSnapshotId,
    ]) {
      const collection = aggregate.snapshots
        .find((snapshot) => snapshot.id === snapshotId)
        ?.pages.find((page) => page.type === "collection");
      expect(collection?.sections.map((section) => section.component)).toEqual([
        "header",
        "collectionHeader",
        "filterBar",
        "productGrid",
        "footer",
      ]);
    }
  });

  it("preserves edited P1-01 draft and published snapshots", async () => {
    const databaseName = testDatabaseName("p101-edited");
    await writeP101Seed(databaseName, true);
    const repository = openRepository(databaseName);

    const aggregate = await repository.get(aurumNordicSeed.project.id);
    const published = aggregate.snapshots.find(
      (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
    );
    const draft = aggregate.snapshots.find(
      (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
    );
    expect(published?.pages.find((page) => page.type === "home")?.title.en).toBe(
      "system edited homepage",
    );
    expect(draft?.pages.find((page) => page.type === "home")?.title.en).toBe(
      "user edited homepage",
    );
    expect(published?.pages.find((page) => page.type === "collection")?.sections).toEqual([]);
    expect(draft?.pages.find((page) => page.type === "collection")?.sections).toEqual([]);
  });

  it("atomically upgrades the exact untouched P1-02 seed to the product composition", async () => {
    const databaseName = testDatabaseName("p102-migration");
    await writeP102Seed(databaseName);
    const repository = openRepository(databaseName);

    const aggregate = await repository.get(aurumNordicSeed.project.id);
    for (const snapshotId of [
      aggregate.project.publishedSnapshotId,
      aggregate.project.draftSnapshotId,
    ]) {
      const product = aggregate.snapshots
        .find((snapshot) => snapshot.id === snapshotId)
        ?.pages.find((page) => page.type === "product");
      expect(product?.sections.map((section) => section.component)).toEqual([
        "header",
        "productGallery",
        "productInfo",
        "productOptions",
        "benefitIcons",
        "imageText",
        "relatedProducts",
        "footer",
      ]);
    }
    expect(aggregate.catalogue.products[0].images).toHaveLength(2);
  });

  it.each(["project", "catalogue", "draft", "published"] as const)(
    "preserves edited P1-02 %s data",
    async (edit) => {
      const databaseName = testDatabaseName(`p102-edited-${edit}`);
      await writeP102Seed(databaseName, edit);
      const repository = openRepository(databaseName);
      const aggregate = await repository.get(aurumNordicSeed.project.id);
      expect(
        aggregate.snapshots
          .find((snapshot) => snapshot.id === aggregate.project.draftSnapshotId)
          ?.pages.find((page) => page.type === "product")?.sections,
      ).toEqual([]);
      if (edit === "project") expect(aggregate.project.name).toBe("Edited P1-02 project");
      if (edit === "catalogue")
        expect(aggregate.catalogue.products[0].title.en).toBe("Edited catalogue product");
      if (edit === "draft")
        expect(
          aggregate.snapshots.find((snapshot) => snapshot.id === aggregate.project.draftSnapshotId)
            ?.pages[0].title.en,
        ).toBe("Edited draft");
      if (edit === "published")
        expect(
          aggregate.snapshots.find(
            (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
          )?.pages[0].title.en,
        ).toBe("Edited published");
    },
  );

  it("keeps the P1-02 migration idempotent across repeated bootstrap", async () => {
    const databaseName = testDatabaseName("p102-repeat");
    await writeP102Seed(databaseName);
    const first = openRepository(databaseName);
    const migrated = await first.get(aurumNordicSeed.project.id);
    await first.close();
    const reopened = openRepository(databaseName);
    expect(await reopened.get(aurumNordicSeed.project.id)).toEqual(migrated);
  });
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
