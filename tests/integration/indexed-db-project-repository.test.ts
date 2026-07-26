import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB, openDB } from "idb";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import { projectSchema } from "@/domain/project";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront";
import {
  aurumNordicPhase0SeedState,
  aurumNordicP101SeedState,
  aurumNordicP102SeedState,
  IndexedDbProjectRepository,
  RepositoryValidationError,
  SnapshotAlreadyExistsError,
  type ProjectAggregate,
  type PublishExpectation,
} from "@/services/storage";
import { createdAggregate, runProjectRepositoryContract } from "./project-repository.contract";

const openRepositories: IndexedDbProjectRepository[] = [];
const databaseNames = new Set<string>();
let databaseSequence = 0;

type IndexedDbPut = (
  this: IDBObjectStore,
  value: unknown,
  key?: IDBValidKey,
) => IDBRequest<IDBValidKey>;

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

async function makePublishable(repository: IndexedDbProjectRepository, label: string) {
  const aggregate = await repository.get(aurumNordicSeed.project.id);
  const current = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
  )!;
  const draft = structuredClone(current);
  draft.id = `snapshot_indexed_publishable_${label}`;
  draft.createdAt = new Date(Date.parse(current.createdAt) + 1_000).toISOString();
  draft.pages[0].title.en = `Indexed publishable ${label}`;
  await repository.saveDraft(aggregate.project.id, draft, {
    id: current.id,
    revision: current.revision,
  });
  return repository.get(aggregate.project.id);
}

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

async function writePhase0Seed(databaseName: string, modified: false | "project" | "all" = false) {
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
  const catalogue = structuredClone(aurumNordicPhase0SeedState.catalogue);
  const snapshots = structuredClone(aurumNordicPhase0SeedState.snapshots);
  if (modified) project.name = "Merchant-modified Aurum";
  if (modified === "all") {
    catalogue.products[0].title.en = "Merchant-edited Aurora";
    for (const snapshot of snapshots) {
      const hero = snapshot.pages
        .find((page) => page.type === "home")
        ?.sections.find((section) => section.component === "hero");
      if (hero) hero.content.title = { en: `${snapshot.createdBy} edited legacy hero` };
    }
  }
  await transaction.objectStore("projects").put(project);
  await transaction.objectStore("catalogues").put(catalogue);
  for (const snapshot of snapshots) await transaction.objectStore("snapshots").put(snapshot);
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

type KarvonenConflictKind = "catalogue" | "publishedSnapshot" | "draftSnapshot";

async function writeKarvonenConflict(databaseName: string, kind: KarvonenConflictKind) {
  const database = await openDB(databaseName, 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });
      db.createObjectStore("catalogues", { keyPath: "id" });
      const snapshots = db.createObjectStore("snapshots", { keyPath: "id" });
      snapshots.createIndex("by-project", "projectId");
    },
  });
  const transaction = database.transaction(["catalogues", "snapshots"], "readwrite");
  if (kind === "catalogue") {
    await transaction.objectStore("catalogues").put({
      id: karvonenSeed.catalogue.id,
      marker: "existing-catalogue",
    });
  } else {
    const snapshotId =
      kind === "publishedSnapshot"
        ? karvonenSeed.publishedSnapshot.id
        : karvonenSeed.draftSnapshot.id;
    await transaction.objectStore("snapshots").put({
      id: snapshotId,
      projectId: "project_existing-conflict",
      marker: "existing-snapshot",
    });
  }
  await transaction.done;
  database.close();
}

function replaceLegacyKarvonenReferences(value: unknown): unknown {
  const references = new Map<string, string>([
    ...aurumNordicSeed.catalogue.products.map(
      (product, index) => [product.id, karvonenSeed.catalogue.products[index]?.id ?? ""] as const,
    ),
    ["collection_rings", "collection_karvonen_myrskyluodon-maija"],
    ["collection_everyday", "collection_karvonen_pihka"],
    ["/seed-assets/aurora-ring.svg", "/seed-assets/karvonen/storefront/hero-desktop.jpg"],
    [
      "/seed-assets/lumi-halo-ring.svg",
      "/seed-assets/karvonen/storefront/collection-diamond-rings.jpg",
    ],
    [
      "/seed-assets/aava-necklace.svg",
      "/seed-assets/karvonen/storefront/collection-jewellery-or-wedding-rings.jpg",
    ],
  ]);
  if (typeof value === "string")
    return references.get(value) ?? value.replaceAll("Aurum Nordic", "Karvonen");
  if (Array.isArray(value)) return value.map(replaceLegacyKarvonenReferences);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, replaceLegacyKarvonenReferences(entry)]),
    );
  }
  return value;
}

function legacyKarvonenSnapshot(id: string, revision: number, createdBy: "system" | "user") {
  const source = replaceLegacyKarvonenReferences(
    aurumNordicSeed.draftSnapshot,
  ) as typeof aurumNordicSeed.draftSnapshot;
  return {
    ...source,
    id,
    projectId: karvonenSeed.project.id,
    catalogueRef: karvonenSeed.catalogue.id,
    revision,
    createdBy,
    pages: source.pages.map((page) => {
      if (page.id === "page_home") {
        return {
          ...page,
          title: { fi: "Karvonen" },
          seo: { title: { fi: "Karvonen" }, metaDescription: { fi: "Karvosen korut" } },
        };
      }
      if (page.id === "page_collection_rings") {
        return {
          ...page,
          slug: "/collections/myrskyluodon-maija",
          title: { fi: "Myrskyluodon Maija" },
        };
      }
      return {
        ...page,
        slug: "/products/guldviva-myrskyluodon-maija-sormus",
        title: karvonenSeed.catalogue.products[0].title,
      };
    }),
  };
}

async function writeLegacyKarvonenSeed(databaseName: string, editDraft = false) {
  const database = await openDB(databaseName, 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });
      db.createObjectStore("catalogues", { keyPath: "id" });
      const snapshots = db.createObjectStore("snapshots", { keyPath: "id" });
      snapshots.createIndex("by-project", "projectId");
    },
  });
  const transaction = database.transaction(["projects", "catalogues", "snapshots"], "readwrite");
  const draft = legacyKarvonenSnapshot("snapshot_karvonen_draft", 2, "user");
  if (editDraft) {
    draft.pages[0].title = { fi: "Kauppiaan muokkaama Karvonen" };
  }
  await transaction.objectStore("projects").put(structuredClone(karvonenSeed.project));
  await transaction.objectStore("catalogues").put(structuredClone(karvonenSeed.catalogue));
  await transaction
    .objectStore("snapshots")
    .put(legacyKarvonenSnapshot("snapshot_karvonen_published", 1, "system"));
  await transaction.objectStore("snapshots").put(draft);
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
  it("creates a complete aggregate atomically, preserves provenance, and survives reopen", async () => {
    const databaseName = testDatabaseName("create-reopen");
    const repository = openRepository(databaseName);
    const input = createdAggregate("indexed_reopen");
    const created = await repository.create(input);
    await repository.close();

    const reopened = openRepository(databaseName);
    const loaded = await reopened.get(input.project.id);
    expect(loaded.project).toEqual(created.project);
    expect(loaded.catalogue).toEqual(created.catalogue);
    expect(loaded.snapshots.map(({ id }) => id).sort()).toEqual(
      created.snapshots.map(({ id }) => id).sort(),
    );
    expect(loaded.snapshotHistoryMetadata).toEqual(created.snapshotHistoryMetadata);
    const database = await openDB(databaseName);
    expect(database.version).toBe(4);
    const transaction = database.transaction(
      [
        "projects",
        "catalogues",
        "snapshots",
        "snapshotProvenance",
        "snapshotHistoryMetadata",
        "publicationOperations",
      ],
      "readonly",
    );
    expect(await transaction.objectStore("projects").get(input.project.id)).toBeTruthy();
    expect(await transaction.objectStore("catalogues").get(input.catalogue.id)).toBeTruthy();
    expect(
      await transaction.objectStore("snapshots").index("by-project").getAll(input.project.id),
    ).toHaveLength(2);
    expect(
      await transaction
        .objectStore("snapshotProvenance")
        .index("by-project")
        .getAll(input.project.id),
    ).toEqual([
      expect.objectContaining({
        projectId: input.project.id,
        snapshotId: input.project.draftSnapshotId,
        kind: "managedDraft",
      }),
    ]);
    expect(
      await transaction
        .objectStore("snapshotHistoryMetadata")
        .index("by-project")
        .getAll(input.project.id),
    ).toEqual(input.snapshotHistoryMetadata);
    expect(
      await transaction
        .objectStore("publicationOperations")
        .index("by-project")
        .getAll(input.project.id),
    ).toEqual([]);
    await transaction.done;
    database.close();
  });

  it("aborts invalid creation without leaving partial IndexedDB rows or disturbing bootstrap", async () => {
    const databaseName = testDatabaseName("create-abort");
    const repository = openRepository(databaseName);
    const invalid = createdAggregate("indexed_invalid");
    invalid.snapshots[0].pages[0].sections[0].component = "unknownComponent";
    await expect(repository.create(invalid)).rejects.toBeInstanceOf(RepositoryValidationError);
    expect(await repository.list()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: aurumNordicSeed.project.id })]),
    );
    const database = await openDB(databaseName);
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots", "snapshotProvenance", "snapshotHistoryMetadata"],
      "readonly",
    );
    expect(await transaction.objectStore("projects").get(invalid.project.id)).toBeUndefined();
    expect(await transaction.objectStore("catalogues").get(invalid.catalogue.id)).toBeUndefined();
    expect(
      await transaction.objectStore("snapshots").index("by-project").getAll(invalid.project.id),
    ).toEqual([]);
    expect(
      await transaction
        .objectStore("snapshotProvenance")
        .index("by-project")
        .getAll(invalid.project.id),
    ).toEqual([]);
    expect(
      await transaction
        .objectStore("snapshotHistoryMetadata")
        .index("by-project")
        .getAll(invalid.project.id),
    ).toEqual([]);
    await transaction.done;
    database.close();
  });

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
    await writePhase0Seed(databaseName, "project");
    const repository = openRepository(databaseName);
    await expect(repository.list()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Merchant-modified Aurum" })]),
    );
    await repository.close();

    const database = await openDB(databaseName);
    const stored: unknown = await database.get("projects", aurumNordicSeed.project.id);
    expect(projectSchema.parse(stored).name).toBe("Merchant-modified Aurum");
    database.close();
  });

  it("upgrades modified Phase 0 hero shapes without replacing user data", async () => {
    const databaseName = testDatabaseName("phase0-edited-shape");
    await writePhase0Seed(databaseName, "all");
    const first = openRepository(databaseName);

    const migrated = await first.get(aurumNordicSeed.project.id);
    expect(migrated.project.name).toBe("Merchant-modified Aurum");
    expect(migrated.catalogue.products[0].title.en).toBe("Merchant-edited Aurora");
    const published = migrated.snapshots.find(
      (snapshot) => snapshot.id === migrated.project.publishedSnapshotId,
    );
    const draft = migrated.snapshots.find(
      (snapshot) => snapshot.id === migrated.project.draftSnapshotId,
    );
    const publishedHero = published?.pages[0]?.sections[0];
    const draftHero = draft?.pages[0]?.sections[0];
    expect(publishedHero?.content.title).toEqual({ en: "system edited legacy hero" });
    expect(draftHero?.content.title).toEqual({ en: "user edited legacy hero" });
    expect(publishedHero?.content).toHaveProperty("cta");
    expect(publishedHero?.content).toHaveProperty("media");
    expect(publishedHero?.props).toEqual({ mediaPosition: "right" });
    expect(draftHero?.content).toHaveProperty("cta");
    expect(draftHero?.content).toHaveProperty("media");
    expect(draftHero?.props).toEqual({ mediaPosition: "right" });
    expect(published?.pages.find((page) => page.type === "collection")?.sections).toEqual([]);
    expect(draft?.pages.find((page) => page.type === "collection")?.sections).toEqual([]);

    await first.close();
    const reopened = openRepository(databaseName);
    expect(await reopened.get(aurumNordicSeed.project.id)).toEqual(migrated);
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
    expect(
      aggregate.snapshots.some((snapshot) => snapshot.id === aurumNordicSeed.draftSnapshot.id),
    ).toBe(true);
  });

  it("bootstraps both Aurum Nordic and Karvonen into an empty database", async () => {
    const databaseName = testDatabaseName("karvonen-empty");
    const repository = openRepository(databaseName);

    expect((await repository.get(aurumNordicSeed.project.id)).project.id).toBe(
      aurumNordicSeed.project.id,
    );
    const karvonen = await repository.get(karvonenSeed.project.id);
    expect(karvonen.catalogue.products).toHaveLength(10);
    expect(karvonen.snapshots.map(({ id }) => id).sort()).toEqual(
      [karvonenSeed.publishedSnapshot.id, karvonenSeed.draftSnapshot.id].sort(),
    );
    expect(karvonen.snapshots).toHaveLength(2);
  });

  it("replaces only the untouched legacy Karvonen seed with the isolated storefront", async () => {
    const databaseName = testDatabaseName("karvonen-legacy-seed");
    await writeLegacyKarvonenSeed(databaseName);

    const repository = openRepository(databaseName);
    const karvonen = await repository.get(karvonenSeed.project.id);
    const serializedDraft = JSON.stringify(
      karvonen.snapshots.find((snapshot) => snapshot.id === karvonen.project.draftSnapshotId),
    );

    expect(karvonen.project.name).toBe("Karvonen");
    expect(karvonen.catalogue.products[0]?.sku).toBe("BV012s");
    expect(serializedDraft).not.toContain("Aurum Nordic");
    expect(serializedDraft).not.toContain("Aurora");
    expect(serializedDraft).toContain("Guldviva Myrskyluodon Maija");
  });

  it("does not replace a merchant-edited legacy Karvonen draft during bootstrap", async () => {
    const databaseName = testDatabaseName("karvonen-legacy-edited");
    await writeLegacyKarvonenSeed(databaseName, true);

    const repository = openRepository(databaseName);
    const karvonen = await repository.get(karvonenSeed.project.id);
    const draft = karvonen.snapshots.find(
      (snapshot) => snapshot.id === karvonen.project.draftSnapshotId,
    )!;

    expect(draft.pages[0]?.title.fi).toBe("Kauppiaan muokkaama Karvonen");
    expect(JSON.stringify(draft)).toContain("Aurora");
  });

  it("adds missing Karvonen without overwriting an existing Aurum database", async () => {
    const databaseName = testDatabaseName("karvonen-missing");
    const first = openRepository(databaseName);
    await first.get(aurumNordicSeed.project.id);
    await first.close();

    const database = await openDB(databaseName);
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots", "snapshotProvenance"],
      "readwrite",
    );
    await transaction.objectStore("projects").delete(karvonenSeed.project.id);
    await transaction.objectStore("catalogues").delete(karvonenSeed.catalogue.id);
    for (const snapshot of [karvonenSeed.publishedSnapshot, karvonenSeed.draftSnapshot]) {
      await transaction.objectStore("snapshots").delete(snapshot.id);
      await transaction.objectStore("snapshotProvenance").delete(snapshot.id);
    }
    await transaction.done;
    database.close();

    const reopened = openRepository(databaseName);
    expect((await reopened.get(aurumNordicSeed.project.id)).project.name).toBe("Aurum Nordic");
    expect((await reopened.get(karvonenSeed.project.id)).catalogue.products).toHaveLength(10);
  });

  it("does not overwrite an existing Karvonen project and remains idempotent", async () => {
    const databaseName = testDatabaseName("karvonen-idempotent");
    const first = openRepository(databaseName);
    await first.get(karvonenSeed.project.id);
    await first.close();

    const database = await openDB(databaseName);
    const project = projectSchema.parse(await database.get("projects", karvonenSeed.project.id));
    expect(project).toBeDefined();
    project.name = "Merchant-edited Karvonen";
    await database.put("projects", project);
    database.close();

    const reopened = openRepository(databaseName);
    expect((await reopened.get(karvonenSeed.project.id)).project.name).toBe(
      "Merchant-edited Karvonen",
    );
    await reopened.close();

    const databaseAfterRepeat = await openDB(databaseName);
    expect(await databaseAfterRepeat.getAll("projects")).toHaveLength(2);
    expect(await databaseAfterRepeat.getAll("catalogues")).toHaveLength(2);
    expect(await databaseAfterRepeat.getAll("snapshots")).toHaveLength(4);
    expect(await databaseAfterRepeat.getAll("snapshotProvenance")).toHaveLength(2);
    databaseAfterRepeat.close();
  });

  it.each(["catalogue", "publishedSnapshot", "draftSnapshot"] as const)(
    "skips the complete Karvonen seed when the %s identifier is occupied",
    async (kind) => {
      const databaseName = testDatabaseName(`karvonen-conflict-${kind}`);
      await writeKarvonenConflict(databaseName, kind);

      const repository = openRepository(databaseName);
      await repository.get(aurumNordicSeed.project.id);
      const database = await openDB(databaseName);

      expect(await database.get("projects", karvonenSeed.project.id)).toBeUndefined();
      if (kind === "catalogue") {
        expect(await database.get("catalogues", karvonenSeed.catalogue.id)).toMatchObject({
          marker: "existing-catalogue",
        });
      } else {
        expect(await database.get("catalogues", karvonenSeed.catalogue.id)).toBeUndefined();
      }
      expect(await database.get("snapshots", karvonenSeed.publishedSnapshot.id)).toEqual(
        kind === "publishedSnapshot"
          ? expect.objectContaining({ marker: "existing-snapshot" })
          : undefined,
      );
      expect(await database.get("snapshots", karvonenSeed.draftSnapshot.id)).toEqual(
        kind === "draftSnapshot"
          ? expect.objectContaining({ marker: "existing-snapshot" })
          : undefined,
      );
      expect(
        await database.get("snapshotProvenance", karvonenSeed.draftSnapshot.id),
      ).toBeUndefined();
      database.close();
    },
  );

  it("preserves unknown stored snapshots while pruning only provenance-managed drafts", async () => {
    const databaseName = testDatabaseName("unknown-legacy-retention");
    const first = openRepository(databaseName);
    const seeded = await first.get(aurumNordicSeed.project.id);
    const unknownLegacy = structuredClone(
      seeded.snapshots.find((snapshot) => snapshot.id === seeded.project.draftSnapshotId)!,
    );
    unknownLegacy.id = "snapshot_unknown_stored_legacy";
    unknownLegacy.createdAt = "2025-01-01T00:00:00.000Z";
    await first.close();

    const database = await openDB(databaseName);
    await database.put("snapshots", unknownLegacy);
    database.close();

    const repository = openRepository(databaseName);
    for (let index = 1; index <= 25; index += 1) {
      const current = await repository.get(aurumNordicSeed.project.id);
      const currentDraft = current.snapshots.find(
        (snapshot) => snapshot.id === current.project.draftSnapshotId,
      )!;
      const candidate = structuredClone(currentDraft);
      candidate.id = `snapshot_indexed_managed_with_legacy_${index}`;
      candidate.createdAt = new Date(Date.parse(currentDraft.createdAt) + 1_000).toISOString();
      await repository.saveDraft(aurumNordicSeed.project.id, candidate, {
        id: currentDraft.id,
        revision: currentDraft.revision,
      });
    }

    const after = await repository.get(aurumNordicSeed.project.id);
    expect(after.snapshots).toHaveLength(20);
    expect(after.snapshots.map(({ id }) => id)).toContain(unknownLegacy.id);
    expect(after.snapshots.map(({ id }) => id)).toContain(aurumNordicSeed.publishedSnapshot.id);
  });

  it("rolls back candidate, pointer and compaction when the draft transaction fails", async () => {
    const repository = openRepository(testDatabaseName("draft-transaction-failure"));
    for (let index = 1; index <= 18; index += 1) {
      const current = await repository.get(aurumNordicSeed.project.id);
      const currentDraft = current.snapshots.find(
        (snapshot) => snapshot.id === current.project.draftSnapshotId,
      )!;
      const saved = structuredClone(currentDraft);
      saved.id = `snapshot_before_transaction_failure_${index}`;
      saved.createdAt = new Date(Date.parse(currentDraft.createdAt) + 1_000).toISOString();
      await repository.saveDraft(aurumNordicSeed.project.id, saved, {
        id: currentDraft.id,
        revision: currentDraft.revision,
      });
    }
    const before = await repository.get(aurumNordicSeed.project.id);
    expect(before.snapshots).toHaveLength(20);
    const currentDraft = before.snapshots.find(
      (snapshot) => snapshot.id === before.project.draftSnapshotId,
    )!;
    const candidate = structuredClone(currentDraft);
    candidate.id = "snapshot_transaction_failure";
    candidate.createdAt = new Date(Date.parse(currentDraft.createdAt) + 1_000).toISOString();
    candidate.pages[0].title.en = "Must not persist";
    const deleteSpy = vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementationOnce(() => {
      throw new DOMException("Forced transaction failure", "AbortError");
    });

    try {
      await expect(
        repository.saveDraft(aurumNordicSeed.project.id, candidate, {
          id: currentDraft.id,
          revision: currentDraft.revision,
        }),
      ).rejects.toThrow("Forced transaction failure");
    } finally {
      deleteSpy.mockRestore();
    }

    expect(await repository.get(aurumNordicSeed.project.id)).toEqual(before);
  });

  it("uses injected deterministic identity and time generation", async () => {
    let generatedProjectId: string | undefined;
    const repository = openRepository(testDatabaseName("generators"), {
      createSnapshotId: ({ projectId, reason }) => {
        generatedProjectId = projectId;
        return `snapshot_test_${reason}`;
      },
      createTimestamp: () => "2026-07-16T10:00:00.000Z",
    });

    const saved = await makePublishable(repository, "generators");
    const aggregate = await repository.publish(
      aurumNordicSeed.project.id,
      publishExpectation(saved),
    );
    expect(aggregate.project.publishedSnapshotId).toBe("snapshot_test_published");
    expect(aggregate.project.draftSnapshotId).toBe("snapshot_test_synchronized");
    expect(aggregate.project.updatedAt).toBe("2026-07-16T10:00:00.000Z");
    expect(generatedProjectId).toBe(aurumNordicSeed.project.id);
  });

  it("leaves no partial writes when a publish cannot create a unique snapshot", async () => {
    const repository = openRepository(testDatabaseName("rollback"), {
      createSnapshotId: () => aurumNordicSeed.publishedSnapshot.id,
    });
    const before = await makePublishable(repository, "identity_rollback");

    await expect(
      repository.publish(aurumNordicSeed.project.id, publishExpectation(before)),
    ).rejects.toBeInstanceOf(SnapshotAlreadyExistsError);
    expect(await repository.get(aurumNordicSeed.project.id)).toEqual(before);
  });

  it("rejects a generated restore ID owned by another project without mutation", async () => {
    let collisionId = "snapshot_restore_collision_pending";
    const repository = openRepository(testDatabaseName("restore-cross-project-collision"), {
      createSnapshotId: () => collisionId,
    });
    const first = createdAggregate("restore_collision_first");
    const second = createdAggregate("restore_collision_second");
    await repository.create(first);
    await repository.create(second);
    const secondStored = await repository.get(second.project.id);
    collisionId = secondStored.project.draftSnapshotId;
    const before = await repository.get(first.project.id);

    await expect(
      repository.restore(first.project.id, first.project.publishedSnapshotId),
    ).rejects.toBeInstanceOf(SnapshotAlreadyExistsError);
    expect(await repository.get(first.project.id)).toEqual(before);
    expect(await repository.get(second.project.id)).toEqual(secondStored);
  });

  it("leaves no partial writes when synchronized-draft construction fails validation", async () => {
    const repository = openRepository(testDatabaseName("synchronized-validation-rollback"), {
      createSnapshotId: ({ reason }) =>
        reason === "synchronized" ? "INVALID SNAPSHOT ID" : `snapshot_valid_${reason}`,
    });
    const before = await makePublishable(repository, "synchronized_validation");

    await expect(
      repository.publish(aurumNordicSeed.project.id, publishExpectation(before)),
    ).rejects.toBeInstanceOf(RepositoryValidationError);

    expect(await repository.get(aurumNordicSeed.project.id)).toEqual(before);
  });

  it("rolls back both snapshots, project and provenance when publish transaction fails", async () => {
    const repository = openRepository(testDatabaseName("publish-transaction-rollback"));
    const before = await makePublishable(repository, "transaction_rollback");
    let snapshotAddCount = 0;
    const originalAddValue: unknown = Object.getOwnPropertyDescriptor(
      IDBObjectStore.prototype,
      "add",
    )?.value;
    if (typeof originalAddValue !== "function") {
      throw new Error("IndexedDB add must be available.");
    }
    const originalAdd = originalAddValue as IndexedDbPut;
    const addSpy = vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === "snapshots") {
        snapshotAddCount += 1;
        if (snapshotAddCount === 2) {
          throw new DOMException("Forced publish transaction failure", "AbortError");
        }
      }
      return key === undefined
        ? Reflect.apply(originalAdd, this, [value])
        : Reflect.apply(originalAdd, this, [value, key]);
    });

    try {
      await expect(
        repository.publish(aurumNordicSeed.project.id, publishExpectation(before)),
      ).rejects.toThrow("Forced publish transaction failure");
    } finally {
      addSpy.mockRestore();
    }

    expect(await repository.get(aurumNordicSeed.project.id)).toEqual(before);
  });

  it("keeps persisted return values defensively isolated after reopening", async () => {
    const databaseName = testDatabaseName("isolation");
    const first = openRepository(databaseName);
    const aggregate = await first.get(aurumNordicSeed.project.id);
    aggregate.catalogue.products[0].price!.amount = 1;
    aggregate.project.name = "External mutation";
    await first.close();

    const reopened = openRepository(databaseName);
    const persisted = await reopened.get(aurumNordicSeed.project.id);
    expect(persisted.catalogue.products[0].price!.amount).toBe(1290);
    expect(persisted.project.name).toBe("Aurum Nordic");
  });
});
