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
const samePage = (left: PageModel, right: PageModel) =>
  JSON.stringify(left) === JSON.stringify(right);

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
  const [sessionPages, setSessionPages] = useState<Record<string, PageModel>>({});
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({});
  const [validationMessage, setValidationMessage] = useState("");

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
          setSessionPages({});
          setResetKeys({});
          setValidationMessage("");
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

  const originalPage = state.pages.find((item) => item.id === selectedPageId) ?? state.pages[0];
  const page = sessionPages[originalPage.id] ?? originalPage;
  const hasUnsavedChanges = !samePage(page, originalPage);
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

  const changePage = (nextPage: PageModel) => {
    setSessionPages((current) => ({ ...current, [nextPage.id]: nextPage }));
    setValidationMessage("");
  };

  const selectPage = (nextPageId: string) => {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Switch pages? Your unsaved changes will stay in this editor session until you return or discard them.",
      )
    ) {
      return;
    }
    setSelectedPageId(nextPageId);
    setValidationMessage("");
  };

  const discardChanges = () => {
    if (!hasUnsavedChanges) return;
    if (!window.confirm("Discard the unsaved changes on this page? This cannot be undone.")) return;
    setSessionPages((current) => {
      const next = { ...current };
      delete next[originalPage.id];
      return next;
    });
    setResetKeys((current) => ({
      ...current,
      [originalPage.id]: (current[originalPage.id] ?? 0) + 1,
    }));
    setValidationMessage("");
  };

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
          <strong>{hasUnsavedChanges ? "Unsaved changes" : "No unsaved changes"}</strong>
          <span>
            {draftDiffers(state.draft, state.published)
              ? "The stored draft also differs from the published storefront."
              : "Changes stay in this editor session."}
          </span>
        </div>
      </header>
      <div className={styles.workspace}>
        <aside aria-label="Editor controls" className={styles.sidebar}>
          <section>
            <label htmlFor="editor-page">Storefront page</label>
            <select
              id="editor-page"
              onChange={(event) => selectPage(event.target.value)}
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
          <button
            className={styles.discardButton}
            disabled={!hasUnsavedChanges}
            onClick={discardChanges}
            type="button"
          >
            Discard changes
          </button>
          <p className={styles.boundaryNote}>
            These changes are not saved to your stored draft. Saving and publishing arrive in later
            milestones.
          </p>
          {validationMessage ? (
            <p className={styles.validationMessage} role="alert">
              {validationMessage}
            </p>
          ) : null}
        </aside>
        <main className={styles.canvas}>
          <VeskifyPuckCanvas
            brandSystem={state.draft.brandSystem}
            context={context}
            onPageChange={changePage}
            onValidationError={setValidationMessage}
            page={page}
            resetKey={resetKeys[page.id] ?? 0}
          />
        </main>
      </div>
    </div>
  );
}
