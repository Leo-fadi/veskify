"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createStorefrontRenderContext } from "@/components/registry";
import {
  renderStorefrontPage,
  validateStorefrontHomepage,
} from "@/components/storefront/storefront-page";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { Locale } from "@/domain/shared";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import { createBrowserProjectRepository, ProjectNotFoundError } from "@/services/storage";

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
    };

const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();

function StatusPanel({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <main className="project-state" role="main">
      <section aria-live="polite" className="project-state__panel">
        <p className="project-state__eyebrow">Draft preview</p>
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

export function ProjectPreviewClient({
  projectId,
  repositoryFactory = defaultRepositoryFactory,
}: {
  projectId: string;
  repositoryFactory?: RepositoryFactory;
}) {
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeLocale, setActiveLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    repository
      .current!.get(projectId)
      .then((aggregate) => {
        if (cancelled) return;
        const draft = aggregate.snapshots.find(
          (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
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
            pagePathPrefix: `/projects/${projectId}`,
          });
          void renderStorefrontPage(homepage, context);
        } catch {
          setState({ status: "validationFailure" });
          return;
        }
        setActiveLocale(aggregate.project.primaryLocale);
        setState({ status: "success", aggregate, draft, homepage });
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
  }, [attempt, projectId]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  };

  if (state.status === "loading") {
    return <StatusPanel title="Loading your storefront" message="Preparing the saved draft…" />;
  }
  if (state.status === "notFound") {
    return (
      <StatusPanel
        title="Project not found"
        message="We could not find this saved storefront on this device."
      />
    );
  }
  if (state.status === "missingDraft") {
    return (
      <StatusPanel
        title="Draft unavailable"
        message="This project does not currently have a draft storefront to preview."
        retry={retry}
      />
    );
  }
  if (state.status === "missingHomepage") {
    return (
      <StatusPanel
        title="Homepage unavailable"
        message="The saved draft does not contain a homepage yet."
        retry={retry}
      />
    );
  }
  if (state.status === "validationFailure") {
    return (
      <StatusPanel
        title="Storefront could not be displayed"
        message="Some saved storefront content needs attention before it can be shown safely."
        retry={retry}
      />
    );
  }
  if (state.status === "failure") {
    return (
      <StatusPanel
        title="Storefront could not be loaded"
        message="We could not open the saved project. Your draft has not been changed."
        retry={retry}
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
    pagePathPrefix: `/projects/${projectId}`,
  });

  return (
    <div className="project-preview" lang={locale} style={style}>
      <header className="project-preview__header">
        <div>
          <Link className="project-preview__back" href="/">
            Veskify home
          </Link>
          <h1>{state.aggregate.project.name}</h1>
        </div>
        <div className="project-preview__status">
          <span>Draft preview</span>
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
      <div aria-label="Draft storefront" className="project-preview__storefront">
        {renderStorefrontPage(state.homepage, renderContext)}
      </div>
    </div>
  );
}
