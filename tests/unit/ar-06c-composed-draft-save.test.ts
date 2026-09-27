import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createAr06aComposedTemplate } from "@/data/demo/ar-06a-composed-template";
import { aurumNordicSeed } from "@/data/seed";
import {
  composedStaticDraftOperationsFor,
  createComposedStaticDraftCapability,
  RepositoryValidationError,
  type ProjectAggregate,
} from "@/services/storage/project-repository";
import {
  createComposedStaticDraftCapability as createCapabilityFromSupport,
  lookupComposedStaticDraftOperations,
} from "@/services/storage/composed-draft-repository-support";
import { InMemoryProjectRepository } from "@/services/storage/in-memory-project-repository";
import { IndexedDbProjectRepository } from "@/services/storage/indexed-db-project-repository";
import { saveComposedEditorDraft } from "@/application/draft-save/save-composed-editor-draft";
import { currentDraft } from "@/application/draft-save/save-editor-draft";
import { composedDraftContextFingerprint } from "@/application/draft-save/composed-draft-validation";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";

async function fixture() {
  const f = createAr06aComposedTemplate("offset");
  const page = f.snapshot.pages.find((p) => p.id === f.homeId)!;
  if (!("composition" in page)) throw new Error("Expected composition");
  const { candidate, requiredAssetRoleCapacityEvidence } = f.resolver({
    owner: page.composition.owner,
    composition: page.composition,
  });
  const material = [
    {
      owner: { kind: "static-page" as const, id: page.id },
      candidate,
      requiredAssetRoleCapacityEvidence,
    },
  ];
  const pending = createComposedStaticDraftCapability(material);
  material[0].candidate = {}; // Issuance captured its own input before the dynamic-import await.
  const capability = await pending;
  const project = { ...structuredClone(aurumNordicSeed.project), draftSnapshotId: f.snapshot.id };
  const context = { project, catalogue: f.catalogue };
  const snapshot = composedStaticDraftOperationsFor(capability)!.validateSnapshot(
    f.snapshot,
    context,
  );
  const aggregate: ProjectAggregate = {
    ...context,
    snapshots: [structuredClone(aurumNordicSeed.publishedSnapshot), snapshot],
  };
  return { ...f, capability, aggregate, snapshot, context };
}
describe("AR-06C trusted composed draft boundary", () => {
  it("authenticates runtime capability identity and freezes authority before asynchronous issuance", async () => {
    const f = await fixture();
    expect(createCapabilityFromSupport).toBe(createComposedStaticDraftCapability);
    expect(lookupComposedStaticDraftOperations(f.capability)).toBe(
      composedStaticDraftOperationsFor(f.capability),
    );
    const before = canonicalValueFingerprint(f.snapshot);
    expect(
      composedStaticDraftOperationsFor(f.capability)!.validateSnapshot(f.snapshot, f.context),
    ).toHaveProperty("compositionExtensionVersion", "1.0.0");
    expect(canonicalValueFingerprint(f.snapshot)).toBe(before);
    for (const token of [{}, { ...f.capability }]) {
      expect(lookupComposedStaticDraftOperations(token)).toBeUndefined();
      expect(() => composedStaticDraftOperationsFor(token)).toThrow(RepositoryValidationError);
      expect(() => new InMemoryProjectRepository([], { composedDraftCapability: token })).toThrow(
        "Unrecognized",
      );
      expect(() => new IndexedDbProjectRepository({ composedDraftCapability: token })).toThrow(
        "Unrecognized",
      );
    }
    expect(() => new InMemoryProjectRepository([f.aggregate])).toThrow();
    await expect(createComposedStaticDraftCapability([])).rejects.toThrow();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    await expect(
      createComposedStaticDraftCapability([
        {
          owner: { kind: "static-page", id: f.homeId },
          candidate: cyclic,
          requiredAssetRoleCapacityEvidence: [],
        },
      ]),
    ).rejects.toThrow("Cyclic draft authority");
  });
  it("rejects unknown versions, foreign owners, stale fingerprints and invalid registered content", async () => {
    const f = await fixture();
    const operations = composedStaticDraftOperationsFor(f.capability)!;
    const candidates = [
      { ...f.snapshot, compositionExtensionVersion: "9.0.0" },
      { ...f.snapshot, projectId: "foreign" },
      { ...f.snapshot, catalogueRef: "foreign" },
    ];
    const stale = structuredClone(f.snapshot);
    const page = stale.pages.find((p) => p.id === f.homeId)!;
    if (!("composition" in page)) throw new Error("Expected composition");
    if (!page.composition || typeof page.composition !== "object")
      throw new Error("Expected composition value");
    Reflect.set(page.composition, "compositionFingerprint", "wrong");
    candidates.push(stale);
    const content = structuredClone(f.snapshot);
    Reflect.set(content.pages[0].sections[0], "component", "unregistered");
    candidates.push(content);
    for (const candidate of candidates)
      expect(() => operations.validateSnapshot(candidate, f.context)).toThrow();
    expect(() =>
      operations.validateSnapshot(f.snapshot, {
        ...f.context,
        project: { ...f.context.project, enabledLocales: [] },
      }),
    ).toThrow();
  });
  it("captures save input before await and detects an intervening readback save", async () => {
    const f = await fixture();
    const repository = new InMemoryProjectRepository([f.aggregate], {
      composedDraftCapability: f.capability,
    });
    const working = structuredClone(f.snapshot);
    working.pages[0].title.en = "Captured input";
    const originalGet = repository.get.bind(repository);
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    repository.get = async (id) => {
      await barrier;
      return originalGet(id);
    };
    const operation = saveComposedEditorDraft({
      repository,
      capability: f.capability,
      loadedAggregate: f.aggregate,
      workingSnapshot: working,
      createSnapshotId: () => "snapshot_captured_ar06c",
    });
    working.pages[0].title.en = "Late caller mutation";
    f.aggregate.project.name = "Late context mutation";
    release();
    const result = await operation;
    expect(result.draft.pages[0].title.en).toBe("Captured input");
    repository.get = originalGet;
    const stored = await repository.get(result.aggregate.project.id);
    let reads = 0;
    repository.get = async (id) => {
      const value = await originalGet(id);
      if (++reads === 2) {
        const current = currentDraft(value);
        const newer = { ...structuredClone(current), id: "snapshot_intervening_ar06c" };
        newer.pages[0].title.en = "Intervening committed save";
        await repository.saveDraft(id, newer, {
          id: current.id,
          revision: current.revision,
          snapshotFingerprint: canonicalValueFingerprint(current),
          contextFingerprint: composedDraftContextFingerprint(value),
        });
        return originalGet(id);
      }
      return value;
    };
    const next = structuredClone(currentDraft(stored));
    next.pages[0].title.en = "New pending value";
    await expect(
      saveComposedEditorDraft({
        repository,
        capability: f.capability,
        loadedAggregate: stored,
        workingSnapshot: next,
        createSnapshotId: () => "snapshot_readback_ar06c",
      }),
    ).rejects.toThrow("stored draft changed");
    expect(currentDraft(await originalGet(stored.project.id)).id).toBe(
      "snapshot_intervening_ar06c",
    );
  });
  it("restricts the capability factory to its trusted guarded root and rejects an unrelated consumer", () => {
    const allowed = new Set([
      "src/services/storage/project-repository.ts",
      "src/services/storage/composed-draft-repository-support.ts",
      "src/integrations/puck/ar-06c-composed-draft-proof.tsx",
    ]);
    const isUnauthorized = (path: string, text: string) =>
      !allowed.has(path) && /\bcreateComposedStaticDraftCapability\b/u.test(text);
    expect(
      isUnauthorized(
        "src/app/unrelated.ts",
        'import { createComposedStaticDraftCapability } from "@/services/storage/project-repository";',
      ),
    ).toBe(true);
    const paths = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "src"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n");
    expect(
      [...new Set(paths)].filter((path) => isUnauthorized(path, readFileSync(path, "utf8"))),
    ).toEqual([]);
    const route = readFileSync("src/app/acceptance/ar-06c/page.tsx", "utf8");
    expect(route.indexOf("if (!enabled) notFound()")).toBeLessThan(route.indexOf("await import("));
    expect(route).toContain('if (process.env.NODE_ENV === "development")');
    expect(route).toContain('process.env.VESKIFY_AR06C_ACCEPTANCE === "1"');
  });
});
