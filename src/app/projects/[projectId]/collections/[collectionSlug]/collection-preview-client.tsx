"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { Locale } from "@/domain/shared";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import { createBrowserProjectRepository, ProjectNotFoundError } from "@/services/storage";
import {
  previewLabel,
  previewPathPrefix,
  selectedSnapshotId,
  type SnapshotKind,
} from "../../preview-mode";
import { HistoricalPreviewActions } from "../../historical-preview-actions";

type RepositoryFactory = () => ProjectRepository;
type Snapshot = ProjectAggregate["snapshots"][number];
type Page = Snapshot["pages"][number];

type LoadState =
  | { status: "loading" }
  | {
      status:
        | "notFound"
        | "missingDraft"
        | "collectionNotFound"
        | "missingPage"
        | "failure"
        | "validationFailure";
    }
  | { status: "success"; aggregate: ProjectAggregate; draft: Snapshot; page: Page };

const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();

function StatusPanel({
  title,
  message,
  retry,
  snapshotKind,
}: {
  title: string;
  message: string;
  retry?: () => void;
  snapshotKind: SnapshotKind;
}) {
  return (
    <main className="project-state">
      <section aria-live="polite" className="project-state__panel">
        <p className="project-state__eyebrow">{previewLabel(snapshotKind)}</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {retry ? (
          <button className="project-retry" onClick={retry} type="button">
            Try again
          </button>
        ) : null}
        <Link href="/">Return to Veskify home</Link>
      </section>
    </main>
  );
}

export function CollectionPreviewClient({
  projectId,
  collectionSlug,
  repositoryFactory = defaultRepositoryFactory,
  snapshotKind = "draft",
  historicalSnapshotId,
}: {
  projectId: string;
  collectionSlug: string;
  repositoryFactory?: RepositoryFactory;
  snapshotKind?: SnapshotKind;
  historicalSnapshotId?: string;
}) {
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeLocale, setActiveLocale] = useState<Locale>();

  useEffect(() => {
    let cancelled = false;
    repository
      .current!.get(projectId)
      .then((aggregate) => {
        if (cancelled) return;
        const draft = aggregate.snapshots.find(
          (snapshot) =>
            snapshot.id ===
            selectedSnapshotId(aggregate.project, snapshotKind, historicalSnapshotId),
        );
        if (!draft) return setState({ status: "missingDraft" });
        const collection = aggregate.catalogue.collections.find(
          (item) => item.slug === collectionSlug,
        );
        if (!collection) return setState({ status: "collectionNotFound" });
        const page = draft.pages.find(
          (item) => item.type === "collection" && item.slug === `/collections/${collection.slug}`,
        );
        if (!page) return setState({ status: "missingPage" });
        try {
          const context = createStorefrontRenderContext({
            activeLocale: aggregate.project.primaryLocale,
            primaryLocale: aggregate.project.primaryLocale,
            catalogue: aggregate.catalogue,
            snapshot: draft,
            pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
          });
          void renderStorefrontPage(page, context);
        } catch {
          return setState({ status: "validationFailure" });
        }
        setActiveLocale(aggregate.project.primaryLocale);
        setState({ status: "success", aggregate, draft, page });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ status: error instanceof ProjectNotFoundError ? "notFound" : "failure" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, collectionSlug, historicalSnapshotId, projectId, snapshotKind]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  if (state.status === "loading")
    return (
      <StatusPanel
        message="Preparing the saved storefront…"
        snapshotKind={snapshotKind}
        title="Loading the collection"
      />
    );
  if (state.status === "notFound")
    return (
      <StatusPanel
        title="Project not found"
        message="We could not find this saved storefront on this device."
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "missingDraft")
    return (
      <StatusPanel
        title="Draft unavailable"
        message="This project does not currently have a draft storefront to preview."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "collectionNotFound")
    return (
      <StatusPanel
        title="Collection not found"
        message="This collection is not available in the saved catalogue."
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "missingPage")
    return (
      <StatusPanel
        title="Collection page unavailable"
        message="The saved draft does not contain a page for this collection yet."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "validationFailure")
    return (
      <StatusPanel
        title="Collection could not be displayed"
        message="Some saved collection content needs attention before it can be shown safely."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "failure")
    return (
      <StatusPanel
        title="Collection could not be loaded"
        message="We could not open the saved project. Your draft has not been changed."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status !== "success") return null;

  const locale = activeLocale ?? state.aggregate.project.primaryLocale;
  const context = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: state.aggregate.project.primaryLocale,
    catalogue: state.aggregate.catalogue,
    snapshot: state.draft,
    pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
  });
  const style = brandSystemToCssVariables(state.draft.brandSystem) as CSSProperties;

  return (
    <div className="project-preview" lang={locale} style={style}>
      <div className="project-preview__header">
        <div>
          <Link
            className="project-preview__back"
            href={previewPathPrefix(projectId, snapshotKind, historicalSnapshotId)}
          >
            Storefront home
          </Link>
          <p className="project-preview__title">{state.aggregate.project.name}</p>
        </div>
        <div className="project-preview__status">
          <span>{previewLabel(snapshotKind)}</span>
          <span aria-live="polite">Current locale: {locale.toUpperCase()}</span>
        </div>
        <fieldset className="locale-control">
          <legend>Storefront language</legend>
          {state.aggregate.project.enabledLocales.map((enabledLocale) => (
            <label key={enabledLocale}>
              <input
                checked={locale === enabledLocale}
                name="collection-locale"
                onChange={() => setActiveLocale(enabledLocale)}
                type="radio"
                value={enabledLocale}
              />
              <span>{enabledLocale === "en" ? "English" : "Suomi"}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <HistoricalPreviewActions
        locale={locale}
        projectId={projectId}
        snapshotId={historicalSnapshotId}
        snapshotKind={snapshotKind}
      />
      <div
        aria-label={
          snapshotKind === "history"
            ? "Previous version collection storefront"
            : `${previewLabel(snapshotKind)} collection storefront`
        }
        className="project-preview__storefront"
      >
        {renderStorefrontPage(state.page, context)}
      </div>
    </div>
  );
}
