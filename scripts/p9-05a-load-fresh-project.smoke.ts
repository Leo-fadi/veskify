import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  P9_05A_FRESH_EDITOR_ROUTE,
  loadP905aFreshProject,
} from "@/data/demo/p9-05a-fresh-project-loader";
import { P9_05A_PROJECT_ID } from "@/data/demo/p9-05a-fresh-store-generation";
import { IndexedDbProjectRepository } from "@/services/storage";

const databaseName = "veskify-p9-05a-loader-smoke";

describe("P9-05A fresh project loader", () => {
  it("persists the isolated aggregate through the browser project repository", async () => {
    const repository = new IndexedDbProjectRepository({ databaseName });
    const loaded = await loadP905aFreshProject(repository);

    expect(loaded).toMatchObject({
      status: "created",
      projectId: P9_05A_PROJECT_ID,
      editorRoute: P9_05A_FRESH_EDITOR_ROUTE,
    });
    if (loaded.status !== "created") throw new Error("The fresh fixture was not created.");
    const persisted = await repository.get(P9_05A_PROJECT_ID);
    expect(persisted.project).toEqual(loaded.aggregate.project);
    expect(persisted.catalogue).toEqual(loaded.aggregate.catalogue);
    expect(persisted.snapshots.map((snapshot) => snapshot.id).sort()).toEqual(
      loaded.aggregate.snapshots.map((snapshot) => snapshot.id).sort(),
    );
    expect(loaded.aggregate.catalogue.products).toHaveLength(2);
    expect(loaded.aggregate.catalogue.collections).toHaveLength(1);
    expect(loaded.brief.status).toBe("approved");
    expect(loaded.approvedAssetContext.assets).toHaveLength(4);
    expect(JSON.stringify(loaded.aggregate)).not.toMatch(/Aurum|Karvonen/i);

    expect(await loadP905aFreshProject(repository)).toEqual({
      status: "already-exists",
      projectId: P9_05A_PROJECT_ID,
      editorRoute: P9_05A_FRESH_EDITOR_ROUTE,
    });
  });
});
