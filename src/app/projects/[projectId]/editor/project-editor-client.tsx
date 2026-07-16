"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createStorefrontRenderContext, validateRegisteredPage } from "@/components/registry";
import { brandSystemToCssVariables } from "@/domain/design-system";
import { resolveLocalizedText, type Locale } from "@/domain/shared";
import type { PageModel, PageType, StorefrontSnapshot } from "@/domain/storefront";
import { VeskifyPuckCanvas } from "@/integrations/puck/veskify-puck-editor";
import {
  createBrowserProjectRepository,
  ProjectNotFoundError,
  RepositoryValidationError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";
import styles from "./project-editor.module.css";

type RepositoryFactory = () => ProjectRepository;
type ReadyState = {
  status: "ready";
  aggregate: ProjectAggregate;
  draft: StorefrontSnapshot;
  published: StorefrontSnapshot;
  pages: PageModel[];
};
type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "missingDraft" }
  | { status: "validationError" }
  | { status: "storageError" }
  | ReadyState;

const editorPageTypes = new Set<PageType>(["home", "collection", "product"]);
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
    <main className={styles.state}>
      <section aria-live="polite" className={styles.statePanel}>
        <p className={styles.eyebrow}>Visual editor</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {retry ? (
          <button onClick={retry} type="button">
            Try again
          </button>
        ) : null}
        <Link href="/">Return to Veskify home</Link>
      </section>
    </main>
  );
}

function snapshotDesign(snapshot: StorefrontSnapshot) {
  return {
    brandSystem: snapshot.brandSystem,
    navigation: snapshot.navigation,
    pages: snapshot.pages,
    catalogueRef: snapshot.catalogueRef,
  };
}

const draftDiffers = (draft: StorefrontSnapshot, published: StorefrontSnapshot) =>
  JSON.stringify(snapshotDesign(draft)) !== JSON.stringify(snapshotDesign(published));

export function ProjectEditorClient({
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
  const [selectedPageId, setSelectedPageId] = useState<string>();
  const [activeLocale, setActiveLocale] = useState<Locale>();

  useEffect(() => {
    let cancelled = false;
    repository
      .current!.get(projectId)
      .then((aggregate) => {
        if (cancelled) return;
        const draft = aggregate.snapshots.find(
          (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
        );
        const published = aggregate.snapshots.find(
          (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
        );
        if (!draft || !published) {
          setState({ status: "missingDraft" });
          return;
        }
        try {
          const context = createStorefrontRenderContext({
            activeLocale: aggregate.project.primaryLocale,
            primaryLocale: aggregate.project.primaryLocale,
            catalogue: aggregate.catalogue,
            snapshot: draft,
            pagePathPrefix: `/projects/${projectId}`,
          });
          const pages = draft.pages.filter((page) => editorPageTypes.has(page.type));
          pages.forEach((page) => validateRegisteredPage(page, context));
          if (pages.length === 0) throw new Error("No supported draft pages are available.");
          setSelectedPageId(pages.find((page) => page.type === "home")?.id ?? pages[0].id);
          setActiveLocale(aggregate.project.primaryLocale);
          setState({ status: "ready", aggregate, draft, published, pages });
        } catch {
          setState({ status: "validationError" });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status:
            error instanceof ProjectNotFoundError
              ? "notFound"
              : error instanceof RepositoryValidationError
                ? "validationError"
                : "storageError",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, projectId]);

  const retry = () => setAttempt((current) => current + 1);
  if (state.status === "loading") {
    return <StatusPanel title="Loading visual editor" message="Opening your saved draft…" />;
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
        message="This project does not have both a draft and published storefront to compare safely."
        retry={retry}
      />
    );
  }
  if (state.status === "validationError") {
    return (
      <StatusPanel
        title="Editor could not display this draft"
        message="Some saved storefront content needs attention before it can be opened safely. Nothing was changed."
        retry={retry}
      />
    );
  }
  if (state.status === "storageError") {
    return (
      <StatusPanel
        title="Editor could not load the project"
        message="We could not open the saved project. Your draft has not been changed."
        retry={retry}
      />
    );
  }

  const page = state.pages.find((item) => item.id === selectedPageId) ?? state.pages[0];
  const locale = activeLocale ?? state.aggregate.project.primaryLocale;
  const title = resolveLocalizedText(page.title, locale, state.aggregate.project.primaryLocale);
  const context = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: state.aggregate.project.primaryLocale,
    catalogue: state.aggregate.catalogue,
    snapshot: state.draft,
    pagePathPrefix: `/projects/${projectId}`,
  });
  const previewHref = `/projects/${projectId}${page.slug === "/" ? "" : page.slug}`;
  const style = brandSystemToCssVariables(state.draft.brandSystem) as CSSProperties;

  return (
    <div className={styles.editor} lang={locale} style={style}>
      <header className={styles.topbar}>
        <nav aria-label="Editor navigation" className={styles.navigation}>
          <Link href="/">Veskify home</Link>
          <span aria-hidden="true">/</span>
          <strong>{state.aggregate.project.name}</strong>
        </nav>
        <div className={styles.currentPage}>
          <span>Current page</span>
          <h1>{title}</h1>
        </div>
        <div aria-label="Draft status" className={styles.draftStatus} role="status">
          <strong>
            {draftDiffers(state.draft, state.published)
              ? "Unpublished changes"
              : "Draft is up to date"}
          </strong>
          <span>Read-only editor milestone</span>
        </div>
      </header>
      <div className={styles.workspace}>
        <aside aria-label="Editor controls" className={styles.sidebar}>
          <section>
            <label htmlFor="editor-page">Storefront page</label>
            <select
              id="editor-page"
              onChange={(event) => setSelectedPageId(event.target.value)}
              value={page.id}
            >
              {state.pages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.type === "home"
                    ? "Homepage"
                    : resolveLocalizedText(
                        item.title,
                        locale,
                        state.aggregate.project.primaryLocale,
                      )}
                </option>
              ))}
            </select>
            <p>Homepage, collection and product pages use their own approved sections.</p>
          </section>
          <fieldset>
            <legend>Storefront language</legend>
            {state.aggregate.project.enabledLocales.map((enabledLocale) => (
              <label key={enabledLocale}>
                <input
                  checked={locale === enabledLocale}
                  name="editor-locale"
                  onChange={() => setActiveLocale(enabledLocale)}
                  type="radio"
                  value={enabledLocale}
                />
                <span>{enabledLocale === "en" ? "English" : "Suomi"}</span>
              </label>
            ))}
          </fieldset>
          <Link className={styles.previewLink} href={previewHref}>
            View selected page
          </Link>
          <p className={styles.boundaryNote}>
            Editing, saving and publishing arrive in later milestones. Your stored draft is
            unchanged.
          </p>
        </aside>
        <main className={styles.canvas}>
          <VeskifyPuckCanvas brandSystem={state.draft.brandSystem} context={context} page={page} />
        </main>
      </div>
    </div>
  );
}
