"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createStorefrontRenderContext, type StorefrontRenderContext } from "@/components/registry";
import {
  renderStorefrontPage,
  validateStorefrontHomepage,
} from "@/components/storefront/storefront-page";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { Locale } from "@/domain/shared";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import { createBrowserProjectRepository, ProjectNotFoundError } from "@/services/storage";
import { loadP905bLocalDemoPublishedProjection } from "@/integrations/ai/p9-05b-local-demo-client";
import {
  previewLabel,
  previewPathPrefix,
  selectedSnapshotId,
  type SnapshotKind,
} from "./preview-mode";
import { HistoricalPreviewActions } from "./historical-preview-actions";

type RepositoryFactory = () => ProjectRepository;

type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "missingDraft" }
  | { status: "missingHomepage" }
  | { status: "failure" }
  | { status: "validationFailure" }
  | {
      status: "success";
      aggregate: ProjectAggregate;
      draft: ProjectAggregate["snapshots"][number];
      homepage: ProjectAggregate["snapshots"][number]["pages"][number];
      evidenceReferences: NonNullable<StorefrontRenderContext["evidenceReferences"]>;
    };

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
    <main className="project-state" role="main">
      <section aria-live="polite" className="project-state__panel">
        <p className="project-state__eyebrow">{previewLabel(snapshotKind)}</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {retry ? (
          <button className="project-retry" onClick={retry} type="button">
            Try again
          </button>
        ) : null}
        <Link href="/">Return to Vesko home</Link>
      </section>
    </main>
  );
}

export function ProjectPreviewClient({
  projectId,
  repositoryFactory = defaultRepositoryFactory,
  snapshotKind = "draft",
  historicalSnapshotId,
  initialAggregate,
  publishedSessionId,
}: {
  projectId: string;
  repositoryFactory?: RepositoryFactory;
  snapshotKind?: SnapshotKind;
  historicalSnapshotId?: string;
  initialAggregate?: ProjectAggregate;
  publishedSessionId?: string;
}) {
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeLocale, setActiveLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const aggregateSource = initialAggregate
      ? Promise.resolve({ aggregate: initialAggregate, evidenceReferences: [] })
      : snapshotKind === "published" && publishedSessionId
        ? loadP905bLocalDemoPublishedProjection({
            projectId,
            sessionId: publishedSessionId,
          }).then(({ evidenceReferences, ...aggregate }) => ({ aggregate, evidenceReferences }))
        : repository.current!.get(projectId).then((aggregate) => ({
            aggregate,
            evidenceReferences: [],
          }));
    aggregateSource
      .then(({ aggregate, evidenceReferences }) => {
        if (cancelled) return;
        const draft = aggregate.snapshots.find(
          (snapshot) =>
            snapshot.id ===
            selectedSnapshotId(aggregate.project, snapshotKind, historicalSnapshotId),
        );
        if (!draft) {
          setState({ status: "missingDraft" });
          return;
        }
        const homepage = draft.pages.find((page) => page.type === "home");
        if (!homepage) {
          setState({ status: "missingHomepage" });
          return;
        }
        try {
          validateStorefrontHomepage(homepage);
          const context = createStorefrontRenderContext({
            activeLocale: aggregate.project.primaryLocale,
            primaryLocale: aggregate.project.primaryLocale,
            catalogue: aggregate.catalogue,
            snapshot: draft,
            evidenceReferences,
            pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
            pagePathSuffix: publishedSessionId
              ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}`
              : "",
            renderTarget: snapshotKind === "published" ? "published" : "preview",
          });
          void renderStorefrontPage(homepage, context);
        } catch {
          setState({ status: "validationFailure" });
          return;
        }
        setActiveLocale(aggregate.project.primaryLocale);
        setState({ status: "success", aggregate, draft, homepage, evidenceReferences });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: error instanceof ProjectNotFoundError ? "notFound" : "failure",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    historicalSnapshotId,
    initialAggregate,
    projectId,
    publishedSessionId,
    snapshotKind,
  ]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  };

  if (state.status === "loading") {
    return (
      <StatusPanel
        message="Preparing the saved storefront…"
        snapshotKind={snapshotKind}
        title="Loading your storefront"
      />
    );
  }
  if (state.status === "notFound") {
    return (
      <StatusPanel
        title="Project not found"
        message="We could not find this saved storefront on this device."
        snapshotKind={snapshotKind}
      />
    );
  }
  if (state.status === "missingDraft") {
    return (
      <StatusPanel
        title="Draft unavailable"
        message="This project does not currently have a draft storefront to preview."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  }
  if (state.status === "missingHomepage") {
    return (
      <StatusPanel
        title="Homepage unavailable"
        message="The saved draft does not contain a homepage yet."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  }
  if (state.status === "validationFailure") {
    return (
      <StatusPanel
        title="Storefront could not be displayed"
        message="Some saved storefront content needs attention before it can be shown safely."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  }
  if (state.status === "failure") {
    return (
      <StatusPanel
        title="Storefront could not be loaded"
        message="We could not open the saved project. Your draft has not been changed."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  }

  const locale = activeLocale ?? state.aggregate.project.primaryLocale;
  const style = brandSystemToCssVariables(state.draft.brandSystem) as CSSProperties;
  const renderContext = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: state.aggregate.project.primaryLocale,
    catalogue: state.aggregate.catalogue,
    snapshot: state.draft,
    evidenceReferences: state.evidenceReferences,
    pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
    pagePathSuffix: publishedSessionId
      ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}`
      : "",
    renderTarget: snapshotKind === "published" ? "published" : "preview",
  });

  return (
    <div className="project-preview" lang={locale} style={style}>
      <header className="project-preview__header">
        <div>
          <Link className="project-preview__back" href="/">
            Vesko home
          </Link>
          <h1>{state.aggregate.project.name}</h1>
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
                name="storefront-locale"
                onChange={() => setActiveLocale(enabledLocale)}
                type="radio"
                value={enabledLocale}
              />
              <span>{enabledLocale === "en" ? "English" : "Suomi"}</span>
            </label>
          ))}
        </fieldset>
      </header>
      <HistoricalPreviewActions
        locale={locale}
        projectId={projectId}
        snapshotId={historicalSnapshotId}
        snapshotKind={snapshotKind}
      />
      <div
        aria-label={
          snapshotKind === "history"
            ? "Previous version storefront"
            : snapshotKind === "published"
              ? "Published storefront"
              : "Draft storefront"
        }
        className="project-preview__storefront"
      >
        {renderStorefrontPage(state.homepage, renderContext)}
      </div>
    </div>
  );
}
