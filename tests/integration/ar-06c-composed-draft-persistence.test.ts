import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB, openDB } from "idb";
import { createAr06aComposedTemplate } from "@/data/demo/ar-06a-composed-template";
import { aurumNordicSeed } from "@/data/seed";
import { IndexedDbProjectRepository } from "@/services/storage/indexed-db-project-repository";
import { InMemoryProjectRepository } from "@/services/storage/in-memory-project-repository";
import {
  createComposedStaticDraftCapability,
  composedStaticDraftOperationsFor,
  type ProjectAggregate,
} from "@/services/storage/project-repository";
import { saveComposedEditorDraft } from "@/application/draft-save/save-composed-editor-draft";
import { publishHistoryMetadata } from "@/services/storage/snapshot-history-metadata";
import { currentDraft } from "@/application/draft-save/save-editor-draft";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
} from "@/domain/storefront/canonical-storefront";
import { composedDraftContextFingerprint } from "@/application/draft-save/composed-draft-validation";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Ar06cComposedDraftProof } from "@/integrations/puck/ar-06c-composed-draft-proof";
import {
  composedRegionSlotName,
  type createComposedPuckSession,
} from "@/integrations/puck/composed-page-adapter";

vi.mock("@/integrations/puck/composed-puck-editor", () => ({
  ComposedPuckEditor: (props: {
    session: ReturnType<typeof createComposedPuckSession>;
    readOnly: boolean;
    onAcceptedChange: () => void;
  }) =>
    createElement(
      "button",
      {
        disabled: props.readOnly,
        onClick: () => {
          const data = structuredClone(props.session.project());
          const slots = data.root?.props;
          if (!slots) throw new Error("Expected Puck root slots");
          const hero = Reflect.get(slots, composedRegionSlotName("orientation")) as Array<{
            props: Record<string, unknown>;
          }>;
          hero[0].props.title = "Pending save text";
          props.session.apply(data, props.session.identity);
          props.onAcceptedChange();
        },
      },
      "Test editor input",
    ),
}));

let sequence = 0;
const databases: string[] = [];
const repositories: IndexedDbProjectRepository[] = [];
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  for (const repository of repositories.splice(0)) await repository.close();
  for (const name of databases.splice(0)) await deleteDB(name);
});
async function setup(kind: "indexed" | "memory" = "indexed") {
  const fixture = createAr06aComposedTemplate("offset");
  const page = fixture.snapshot.pages.find((value) => value.id === fixture.homeId)!;
  if (!("composition" in page)) throw new Error("Composed fixture required");
  const authority = fixture.resolver({
    owner: page.composition.owner,
    composition: page.composition,
  });
  const capability = await createComposedStaticDraftCapability([
    {
      owner: { kind: "static-page", id: fixture.homeId },
      candidate: authority.candidate,
      requiredAssetRoleCapacityEvidence: authority.requiredAssetRoleCapacityEvidence,
    },
  ]);
  const suffix = `ar06c_${++sequence}`;
  const catalogue = { ...structuredClone(fixture.catalogue), id: `catalogue_${suffix}` };
  const project = {
    ...structuredClone(aurumNordicSeed.project),
    id: `project_${suffix}`,
    draftSnapshotId: `snapshot_draft_${suffix}`,
    publishedSnapshotId: `snapshot_published_${suffix}`,
  };
  const snapshot = composedStaticDraftOperationsFor(capability)!.validateSnapshot(
    {
      ...fixture.snapshot,
      id: project.draftSnapshotId,
      projectId: project.id,
      catalogueRef: catalogue.id,
    },
    { project, catalogue },
  );
  const published = {
    ...structuredClone(aurumNordicSeed.publishedSnapshot),
    id: project.publishedSnapshotId,
    projectId: project.id,
    catalogueRef: catalogue.id,
  };
  const input: ProjectAggregate = {
    project,
    catalogue,
    snapshots: [published, snapshot],
    snapshotHistoryMetadata: publishHistoryMetadata(project.id, published.id, snapshot.id),
  };
  const name = `veskify-test-${suffix}`;
  databases.push(name);
  const repository =
    kind === "indexed"
      ? new IndexedDbProjectRepository({ databaseName: name, composedDraftCapability: capability })
      : new InMemoryProjectRepository([], { composedDraftCapability: capability });
  if (repository instanceof IndexedDbProjectRepository) repositories.push(repository);
  const aggregate = await repository.create(input);
  return { repository, aggregate, capability, name };
}
function changed(aggregate: ProjectAggregate, title = "Persisted canonical title") {
  const snapshot = structuredClone(currentDraft(aggregate));
  snapshot.pages[0].title.en = title;
  return snapshot;
}
function expected(aggregate: ProjectAggregate) {
  const draft = currentDraft(aggregate);
  return {
    id: draft.id,
    revision: draft.revision,
    snapshotFingerprint: canonicalValueFingerprint(draft),
    contextFingerprint: composedDraftContextFingerprint(aggregate),
  };
}
type RawStores = {
  [
    name in
      | "projects"
      | "catalogues"
      | "snapshots"
      | "snapshotProvenance"
      | "snapshotHistoryMetadata"
      | "publicationOperations"
      | "compiledPublicationArtifacts"
      | "publishedStorefrontVersions"
      | "activePublishedStorefrontPointers"
  ]: { key: string; value: unknown };
};
async function rows(name: string): Promise<Record<string, unknown[]>> {
  const db = await openDB<RawStores>(name);
  try {
    return Object.fromEntries(
      await Promise.all(
        Array.from(db.objectStoreNames).map(
          async (store) => [store, await db.getAll(store)] as const,
        ),
      ),
    );
  } finally {
    db.close();
  }
}
describe("AR-06C composed repository persistence", () => {
  it("blocks editing and duplicate saves until the real repository acknowledgement completes", async () => {
    databases.push("veskify-ar06c-draft-offset");
    render(createElement(Ar06cComposedDraftProof, { layout: "offset", locale: "en" }));
    fireEvent.click(await screen.findByRole("button", { name: "Initialize local example" }));
    const editor = await screen.findByRole("button", { name: "Test editor input" });
    fireEvent.click(editor);
    const save = screen.getByRole("button", { name: "Save draft" });
    expect(save).toBeEnabled();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Invoked with the actual instance via apply below.
    const originalSave = IndexedDbProjectRepository.prototype.saveDraft;
    const write = vi
      .spyOn(IndexedDbProjectRepository.prototype, "saveDraft")
      .mockImplementation(async function (this: IndexedDbProjectRepository, ...args) {
        await pending;
        return originalSave.apply(this, args);
      });
    fireEvent.click(save);
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(save).toBeDisabled();
    expect(editor).toBeDisabled();
    expect(editor.parentElement).toHaveAttribute("inert");
    fireEvent.click(save);
    fireEvent.click(editor);
    expect(write).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Invoked with the actual instance via call below.
    const originalGet = IndexedDbProjectRepository.prototype.get;
    let acknowledged!: () => void;
    const readback = new Promise<void>((resolve) => {
      acknowledged = resolve;
    });
    vi.spyOn(IndexedDbProjectRepository.prototype, "get").mockImplementationOnce(async function (
      this: IndexedDbProjectRepository,
      id,
    ) {
      const aggregate = await originalGet.call(this, id);
      acknowledged();
      return aggregate;
    });
    await act(async () => {
      release();
      await readback;
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Draft saved on this device"),
    );
    expect(write).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Test editor input" })).toBeEnabled();
    expect(save).toBeDisabled();
    expect(screen.getByText("No unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Read-only composed preview" })).toHaveTextContent(
      "Pending save text",
    );
  });
  it.each(["indexed", "memory"] as const)(
    "%s opt-in saves the full composition, preserves mixed history and rejects default reads",
    async (kind) => {
      const f = await setup(kind);
      const original = structuredClone(f.aggregate);
      const result = await saveComposedEditorDraft({
        repository: f.repository,
        capability: f.capability,
        loadedAggregate: f.aggregate,
        workingSnapshot: changed(f.aggregate),
        createSnapshotId: () => `snapshot_saved_${sequence}`,
        now: () => new Date("2026-09-27T10:00:00Z"),
      });
      expect(result.draft.pages[0].title.en).toBe("Persisted canonical title");
      expect(result.draft).toHaveProperty("compositionExtensionVersion", "1.0.0");
      expect(
        result.aggregate.snapshots.find((s) => s.id === original.project.draftSnapshotId),
      ).toEqual(currentDraft(original));
      expect(
        result.aggregate.snapshots.find((s) => s.id === original.project.publishedSnapshotId),
      ).toEqual(original.snapshots.find((s) => s.id === original.project.publishedSnapshotId));
      expect(result.aggregate.catalogue).toEqual(original.catalogue);
      const historyById = (value: ProjectAggregate) =>
        [...(value.snapshotHistoryMetadata ?? [])].sort((a, b) =>
          a.snapshotId.localeCompare(b.snapshotId),
        );
      expect(historyById(result.aggregate)).toEqual(historyById(original));
      expect(result.aggregate.project.publishedSnapshotId).toBe(
        original.project.publishedSnapshotId,
      );
      if (f.repository instanceof IndexedDbProjectRepository) {
        await f.repository.close();
        const fresh = new IndexedDbProjectRepository({
          databaseName: f.name,
          composedDraftCapability: f.capability,
        });
        repositories.push(fresh);
        expect(currentDraft(await fresh.get(original.project.id))).toEqual(result.draft);
        const legacy = new IndexedDbProjectRepository({ databaseName: f.name });
        repositories.push(legacy);
        await expect(legacy.get(original.project.id)).rejects.toThrow();
      } else expect(() => new InMemoryProjectRepository([result.aggregate])).toThrow();
    },
  );
  it.each(["indexed", "memory"] as const)(
    "%s requires exact CAS and new immutable draft identity",
    async (kind) => {
      const f = await setup(kind);
      const before = await f.repository.get(f.aggregate.project.id);
      const candidate = { ...changed(before), id: `snapshot_cas_${sequence}` };
      for (const pin of [
        undefined,
        { id: currentDraft(before).id, revision: currentDraft(before).revision },
        { ...expected(before), snapshotFingerprint: "wrong" },
        { ...expected(before), contextFingerprint: "wrong" },
      ]) {
        await expect(f.repository.saveDraft(before.project.id, candidate, pin)).rejects.toThrow();
        expect(await f.repository.get(before.project.id)).toEqual(before);
      }
      await expect(
        f.repository.saveDraft(before.project.id, changed(before), expected(before)),
      ).rejects.toThrow();
      await f.repository.saveDraft(before.project.id, candidate, expected(before));
      const after = await f.repository.get(before.project.id);
      await expect(
        f.repository.saveDraft(
          before.project.id,
          { ...candidate, id: `snapshot_stale_${sequence}` },
          expected(before),
        ),
      ).rejects.toThrow();
      expect(await f.repository.get(before.project.id)).toEqual(after);
    },
  );
  it("compares same-ID changed content and catalogue inside the IndexedDB transaction", async () => {
    const f = await setup();
    const before = f.aggregate;
    const db = await openDB<RawStores>(f.name);
    try {
      const draft = changed(before, "Changed without revision increment");
      await db.put("snapshots", draft);
      await expect(
        f.repository.saveDraft(
          before.project.id,
          { ...draft, id: `snapshot_rejected_${sequence}` },
          expected(before),
        ),
      ).rejects.toThrow();
      await db.put("snapshots", currentDraft(before));
      const catalogue = structuredClone(before.catalogue);
      catalogue.products[0].title.en = "Updated catalogue";
      await db.put("catalogues", catalogue);
      await expect(
        f.repository.saveDraft(
          before.project.id,
          { ...changed(before), id: `snapshot_context_${sequence}` },
          expected(before),
        ),
      ).rejects.toThrow();
      expect(await db.get("snapshots", `snapshot_context_${sequence}`)).toBeUndefined();
      expect(await db.get("projects", before.project.id)).toMatchObject({
        draftSnapshotId: before.project.draftSnapshotId,
      });
    } finally {
      db.close();
    }
  });
  it("aborts actual project-store write failure after snapshot add without any partial records", async () => {
    const f = await setup();
    const before = await rows(f.name);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Invoked with the intercepted object store via call below.
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      if (this.name === "projects")
        throw new DOMException("Controlled write failure", "UnknownError");
      return put.call(this, value, key);
    });
    await expect(
      saveComposedEditorDraft({
        repository: f.repository,
        capability: f.capability,
        loadedAggregate: f.aggregate,
        workingSnapshot: changed(f.aggregate),
        createSnapshotId: () => `snapshot_failure_${sequence}`,
      }),
    ).rejects.toThrow("Controlled write failure");
    vi.restoreAllMocks();
    expect(await rows(f.name)).toEqual(before);
  });
  it.each(["indexed", "memory"] as const)(
    "%s keeps publication and restore closed for composed projects",
    async (kind) => {
      const f = await setup(kind);
      const before = await f.repository.get(f.aggregate.project.id);
      const draft = currentDraft(before);
      const published = before.snapshots.find(
        (snapshot) => snapshot.id === before.project.publishedSnapshotId,
      )!;
      const pin = (snapshot: typeof draft) => ({
        id: snapshot.id,
        revision: snapshot.revision,
        contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
      });
      await expect(
        f.repository.publish(before.project.id, {
          projectRevision: before.project.revision,
          draft: pin(draft),
          published: pin(published),
        }),
      ).rejects.toThrow();
      await expect(f.repository.restore(before.project.id, published.id)).rejects.toThrow();
      expect(await f.repository.get(before.project.id)).toEqual(before);
      if (f.repository instanceof IndexedDbProjectRepository) {
        const stored = await rows(f.name);
        const legacy = {
          ...before,
          snapshots: [published, { ...structuredClone(published), id: draft.id }],
        };
        await expect(f.repository.replaceLocalDemoAggregate(legacy)).rejects.toThrow();
        expect(await rows(f.name)).toEqual(stored);
      }
    },
  );
  it("rejects invalid aggregate references or composed published authority", async () => {
    const f = await setup("memory");
    for (const invalid of [
      {
        ...f.aggregate,
        project: { ...f.aggregate.project, publishedSnapshotId: currentDraft(f.aggregate).id },
      },
      { ...f.aggregate, snapshots: [...f.aggregate.snapshots, currentDraft(f.aggregate)] },
      {
        ...f.aggregate,
        snapshots: f.aggregate.snapshots.map((snapshot) => ({ ...snapshot, projectId: "foreign" })),
      },
    ])
      expect(
        () => new InMemoryProjectRepository([invalid], { composedDraftCapability: f.capability }),
      ).toThrow();
  });
});
