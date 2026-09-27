"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAr06aComposedTemplate,
  type Ar06aCompositionLayout,
  type Ar06aLocale,
} from "@/data/demo/ar-06a-composed-template";
import { aurumNordicSeed } from "@/data/seed";
import { IndexedDbProjectRepository } from "@/services/storage/indexed-db-project-repository";
import {
  composedStaticDraftOperationsFor,
  createComposedStaticDraftCapability,
  ProjectNotFoundError,
  type ComposedStaticDraftCapability,
  type ProjectAggregate,
} from "@/services/storage/project-repository";
import { saveComposedEditorDraft } from "@/application/draft-save/save-composed-editor-draft";
import { currentDraft } from "@/application/draft-save/save-editor-draft";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import { createComposedPuckSession } from "./composed-page-adapter";
import { ComposedPuckEditor, type ComposedPuckStatePathObservation } from "./composed-puck-editor";

type Session = ReturnType<typeof createComposedPuckSession>;
type Connection = {
  repository: IndexedDbProjectRepository;
  capability: ComposedStaticDraftCapability;
};

export function Ar06cComposedDraftProof({
  layout,
  locale,
}: Readonly<{ layout: Ar06aCompositionLayout; locale: Ar06aLocale }>) {
  const fixture = useMemo(() => createAr06aComposedTemplate(layout), [layout]);
  const projectId = `project_ar06c_${layout}`;
  const [connection, setConnection] = useState<Connection>();
  const [loaded, setLoaded] = useState<ProjectAggregate>();
  const [session, setSession] = useState<Session>();
  const [status, setStatus] = useState("Opening local draft…");
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const pending = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const makeSession = useCallback(
    (aggregate: ProjectAggregate) =>
      createComposedPuckSession({
        snapshot: currentDraft(aggregate),
        catalogue: aggregate.catalogue,
        pageId: fixture.homeId,
        activeLocale: locale,
        primaryLocale: aggregate.project.primaryLocale,
        enabledLocales: aggregate.project.enabledLocales,
        resolveAuthority: fixture.resolver,
      }),
    [fixture, locale],
  );
  useEffect(() => {
    let disposed = false;
    let repository: IndexedDbProjectRepository | undefined;
    const open = async () => {
      const page = fixture.snapshot.pages.find((item) => item.id === fixture.homeId)!;
      if (!("composition" in page)) throw new Error("Composed example authority is missing.");
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
      if (disposed) return;
      repository = new IndexedDbProjectRepository({
        databaseName: `veskify-ar06c-draft-${layout}`,
        composedDraftCapability: capability,
      });
      setConnection({ repository, capability });
      try {
        const aggregate = await repository.get(projectId);
        const resumed = makeSession(aggregate);
        if (!disposed) {
          setLoaded(aggregate);
          setSession(resumed);
          setStatus("Saved local draft reopened.");
        }
      } catch (error) {
        if (disposed) return;
        if (error instanceof ProjectNotFoundError) {
          setMissing(true);
          setStatus("No saved example. Initialize it explicitly to begin.");
        } else throw error;
      }
    };
    void open().catch((error: unknown) => {
      if (!disposed) setStatus(error instanceof Error ? error.message : "Unable to open draft.");
    });
    return () => {
      disposed = true;
      void repository?.close();
    };
  }, [fixture, layout, makeSession, projectId]);
  const initialize = async () => {
    if (!connection || pending.current || !missing) return;
    pending.current = true;
    setSaving(true);
    try {
      const catalogue = { ...structuredClone(fixture.catalogue), id: `catalogue_ar06c_${layout}` };
      const project = {
        ...structuredClone(aurumNordicSeed.project),
        id: projectId,
        draftSnapshotId: `snapshot_ar06c_${layout}_initial`,
        publishedSnapshotId: `snapshot_ar06c_${layout}_published`,
      };
      const snapshot = composedStaticDraftOperationsFor(connection.capability)!.validateSnapshot(
        { ...fixture.snapshot, id: project.draftSnapshotId, projectId, catalogueRef: catalogue.id },
        { project, catalogue },
      );
      const published = {
        ...structuredClone(aurumNordicSeed.publishedSnapshot),
        id: project.publishedSnapshotId,
        projectId,
        catalogueRef: catalogue.id,
      };
      const aggregate = await connection.repository.create({
        project,
        catalogue,
        snapshots: [published, snapshot],
      });
      setLoaded(aggregate);
      setSession(makeSession(aggregate));
      setMissing(false);
      setStatus("Local example initialized. Edits require Save draft.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Initialization failed.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const save = async () => {
    if (!connection || !loaded || !session || pending.current) return;
    pending.current = true;
    setSaving(true);
    setStatus("Saving local draft…");
    try {
      const working = composedStaticDraftOperationsFor(connection.capability)!.validateSnapshot(
        session.snapshot,
        loaded,
      );
      const result = await saveComposedEditorDraft({
        ...connection,
        loadedAggregate: loaded,
        workingSnapshot: working,
      });
      setLoaded(result.aggregate);
      setSession(makeSession(result.aggregate));
      setStatus("Draft saved on this device. Reopen to verify it.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Save failed; the stored draft was not replaced.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const observe = useCallback((value: ComposedPuckStatePathObservation) => {
    if (value.dragging !== undefined)
      root.current?.setAttribute("data-ar06c-puck-dragging", String(value.dragging));
  }, []);
  const renderer = session?.renderer();
  const page = session?.snapshot.pages.find((item) => item.id === fixture.homeId);
  const assignments = new Map(
    page && "composition" in page
      ? page.composition.regionAssignments.map((item) => [item.regionId, item.units])
      : [],
  );
  const order = renderer?.regions.flatMap((region) =>
    (assignments.get(region.id) ?? []).map((unit) =>
      unit.kind === "section" ? unit.sectionId : unit.kind,
    ),
  );
  const fingerprint = session ? canonicalValueFingerprint(session.snapshot) : "";
  const saved = loaded ? canonicalValueFingerprint(currentDraft(loaded)) : "";
  const dirty = fingerprint !== saved;
  return (
    <div
      ref={root}
      data-ar06c-ready={Boolean(session)}
      data-ar06c-layout={layout}
      data-active-locale={locale}
      data-ar06c-canonical-order={order?.join(",") ?? ""}
      data-ar06c-snapshot-fingerprint={fingerprint}
      data-ar06c-saved-fingerprint={saved}
      data-ar06c-loaded-id={loaded?.project.draftSnapshotId ?? ""}
      data-ar06c-unsaved={dirty}
      data-ar06c-saving={saving}
      data-ar06c-puck-dragging="false"
    >
      <h1>Local composed draft proof</h1>
      <p>
        This isolated example saves only in this browser. It does not publish or enable Studio
        saves.
      </p>
      <p role="status">{status}</p>
      {missing ? (
        <button disabled={saving || !connection} onClick={() => void initialize()}>
          Initialize local example
        </button>
      ) : null}
      {session ? (
        <>
          <button disabled={saving || !dirty} onClick={() => void save()}>
            Save draft
          </button>
          <a href={`/acceptance/ar-06c?case=${layout}&locale=${locale}`}>Reopen saved draft</a>
          <p>{dirty ? "Unsaved changes" : "No unsaved changes"}</p>
          <div inert={saving} aria-busy={saving} data-ar06c-editing-disabled={saving}>
            <ComposedPuckEditor
              session={session}
              readOnly={saving}
              onAcceptedChange={() => setVersion((value) => value + 1)}
              onStatePathObservation={observe}
            />
          </div>
          <section
            aria-label="Read-only composed preview"
            data-ar06c-preview="true"
            data-ar06c-version={version}
          >
            {renderer?.render()}
          </section>
        </>
      ) : null}
    </div>
  );
}
