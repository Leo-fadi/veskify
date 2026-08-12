import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB, openDB } from "idb";
import {
  P10B16P03_CATALOGUE_ID,
  P10B16P03_DRAFT_ID,
  P10B16P03_PROJECT_ID,
  createP10B16P03RawKarvonenStudioFixture,
} from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import { projectSchema } from "@/domain/project";
import { canonicalValueString, storefrontSnapshotSchema } from "@/domain/storefront";
import { aurumNordicSeed } from "@/data/seed";
import { IndexedDbProjectRepository } from "@/services/storage";

const openRepositories: IndexedDbProjectRepository[] = [];
const databaseNames = new Set<string>();
let databaseSequence = 0;

function databaseName(label: string): string {
  databaseSequence += 1;
  const name = `veskify-p10b-16p-03-${label}-${databaseSequence}`;
  databaseNames.add(name);
  return name;
}

function repository(name: string): IndexedDbProjectRepository {
  const instance = new IndexedDbProjectRepository({ databaseName: name });
  openRepositories.push(instance);
  return instance;
}

afterEach(async () => {
  await Promise.all(openRepositories.splice(0).map((instance) => instance.close()));
  await Promise.all([...databaseNames].map((name) => deleteDB(name)));
  databaseNames.clear();
});

describe("P10B-16P-03 raw Storefront Studio bootstrap", () => {
  it("does not construct or seed P03 authority for an unrelated project", async () => {
    const name = databaseName("unrelated-project");
    const indexedRepository = repository(name);

    await indexedRepository.get(aurumNordicSeed.project.id);

    const database = await openDB(name);
    expect(await database.get("projects", P10B16P03_PROJECT_ID)).toBeUndefined();
    expect(await database.get("catalogues", P10B16P03_CATALOGUE_ID)).toBeUndefined();
    expect(await database.get("snapshots", P10B16P03_DRAFT_ID)).toBeUndefined();
    database.close();
  });

  it("seeds the exact raw server fixture with managed draft provenance", async () => {
    const name = databaseName("exact-fixture");
    const expected = createP10B16P03RawKarvonenStudioFixture();
    const indexedRepository = repository(name);

    const aggregate = await indexedRepository.get(P10B16P03_PROJECT_ID);

    expect(canonicalValueString(aggregate)).toBe(canonicalValueString(expected.aggregate));
    expect(aggregate.snapshots.find(({ id }) => id === P10B16P03_DRAFT_ID)).toEqual(
      expected.rawDraft,
    );

    const database = await openDB(name);
    expect(await database.get("snapshotProvenance", P10B16P03_DRAFT_ID)).toMatchObject({
      projectId: P10B16P03_PROJECT_ID,
      snapshotId: P10B16P03_DRAFT_ID,
      kind: "managedDraft",
    });
    database.close();
  });

  it("is idempotent and never overwrites an existing merchant-edited raw project", async () => {
    const name = databaseName("edited-project");
    const first = repository(name);
    await first.get(P10B16P03_PROJECT_ID);
    await first.close();

    const database = await openDB(name);
    const project = projectSchema.parse(await database.get("projects", P10B16P03_PROJECT_ID));
    const draft = storefrontSnapshotSchema.parse(
      await database.get("snapshots", P10B16P03_DRAFT_ID),
    );
    project.name = "Merchant-edited raw Karvonen";
    draft.pages[0].title.en = "Merchant-edited raw homepage";
    await database.put("projects", project);
    await database.put("snapshots", draft);
    database.close();

    const reopened = repository(name);
    const aggregate = await reopened.get(P10B16P03_PROJECT_ID);
    expect(aggregate.project.name).toBe("Merchant-edited raw Karvonen");
    expect(
      aggregate.snapshots.find(({ id }) => id === P10B16P03_DRAFT_ID)?.pages[0]?.title.en,
    ).toBe("Merchant-edited raw homepage");
  });

  it("fails closed without partial rows when a raw-fixture identifier is occupied", async () => {
    const name = databaseName("identifier-conflict");
    const database = await openDB(name, 1, {
      upgrade(value) {
        value.createObjectStore("projects", { keyPath: "id" });
        value.createObjectStore("catalogues", { keyPath: "id" });
        const snapshots = value.createObjectStore("snapshots", { keyPath: "id" });
        snapshots.createIndex("by-project", "projectId");
      },
    });
    await database.put("catalogues", {
      id: P10B16P03_CATALOGUE_ID,
      marker: "existing-local-authority",
    });
    database.close();

    const indexedRepository = repository(name);
    await indexedRepository.get(aurumNordicSeed.project.id);

    const stored = await openDB(name);
    expect(await stored.get("projects", P10B16P03_PROJECT_ID)).toBeUndefined();
    expect(await stored.get("catalogues", P10B16P03_CATALOGUE_ID)).toEqual({
      id: P10B16P03_CATALOGUE_ID,
      marker: "existing-local-authority",
    });
    expect(await stored.get("snapshots", P10B16P03_DRAFT_ID)).toBeUndefined();
    expect(await stored.get("snapshotProvenance", P10B16P03_DRAFT_ID)).toBeUndefined();
    stored.close();
  });
});
