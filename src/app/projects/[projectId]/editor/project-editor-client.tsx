"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  assembleValidatedEditorDraft,
  EditorDraftValidationError,
  saveValidatedEditorDraft,
  StaleEditorDraftError,
} from "@/application/draft-save";
import {
  createStorefrontRenderContext,
  getComponentDefinition,
  validateRegisteredPage,
} from "@/components/registry";
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
import { DesignAgentPanel } from "./design-agent-panel";
import { useDesignAgentSession } from "./use-design-agent-session";

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
type SaveUiState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; message: string }
  | { status: "validation" | "storage" | "stale"; message: string };

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

const canonicalPagesEqual = (left: PageModel, right: PageModel) =>
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
  const [selectedSectionId, setSelectedSectionId] = useState<string>();
  const [activeLocale, setActiveLocale] = useState<Locale>();
  const [sessionPages, setSessionPages] = useState<Record<string, PageModel>>({});
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({});
  const [validationMessage, setValidationMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveUiState>({ status: "idle" });
  const savePending = useRef(false);

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
          setSelectedSectionId(undefined);
          setActiveLocale(aggregate.project.primaryLocale);
          setSessionPages({});
          setResetKeys({});
          setValidationMessage("");
          setSaveState({ status: "idle" });
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

  const readyState = state.status === "ready" ? state : undefined;
  const readyOriginalPage =
    readyState?.pages.find((item) => item.id === selectedPageId) ?? readyState?.pages[0];
  const readyPage = readyOriginalPage
    ? (sessionPages[readyOriginalPage.id] ?? readyOriginalPage)
    : undefined;
  const readyLocale = activeLocale ?? readyState?.aggregate.project.primaryLocale;
  const readyContext =
    readyState && readyLocale
      ? createStorefrontRenderContext({
          activeLocale: readyLocale,
          primaryLocale: readyState.aggregate.project.primaryLocale,
          catalogue: readyState.aggregate.catalogue,
          snapshot: readyState.draft,
          pagePathPrefix: `/projects/${projectId}`,
        })
      : undefined;
  const agent = useDesignAgentSession({
    lifecycleKey: `${projectId}:${attempt}`,
    projectId,
    page: readyPage,
    activeLocale: readyLocale,
    primaryLocale: readyState?.aggregate.project.primaryLocale,
    brandSystem: readyState?.draft.brandSystem,
    displayContext: readyContext,
    selectedSectionId,
    disabled: saveState.status === "saving",
    onProposalReady: () => setSelectedSectionId(undefined),
    onAcceptedPage: (acceptedPage) => {
      setSessionPages((current) => ({ ...current, [acceptedPage.id]: acceptedPage }));
      setValidationMessage("");
      setSaveState({ status: "idle" });
      setResetKeys((current) => ({
        ...current,
        [acceptedPage.id]: (current[acceptedPage.id] ?? 0) + 1,
      }));
    },
  });

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

  const originalPage = readyOriginalPage!;
  const page = readyPage!;
  const currentPageHasUnsavedChanges = !canonicalPagesEqual(page, originalPage);
  const changedPages = state.pages.flatMap((baselinePage) => {
    const sessionPage = sessionPages[baselinePage.id];
    return sessionPage && !canonicalPagesEqual(sessionPage, baselinePage) ? [sessionPage] : [];
  });
  const hasUnsavedChanges = changedPages.length > 0;
  const locale = readyLocale!;
  const title = resolveLocalizedText(page.title, locale, state.aggregate.project.primaryLocale);
  const context = readyContext!;
  const previewHref = `/projects/${projectId}${page.slug === "/" ? "" : page.slug}`;
  const style = brandSystemToCssVariables(state.draft.brandSystem) as CSSProperties;
  const showingProposal = agent.previewActive;
  const canvasPage = agent.proposal?.proposedPage ?? page;
  const selectedSection = selectedSectionId
    ? page.sections.find((section) => section.id === selectedSectionId)
    : undefined;
  let completeDraftIsValid = false;
  if (hasUnsavedChanges) {
    try {
      assembleValidatedEditorDraft({
        baseDraft: state.draft,
        changedPages,
        aggregate: state.aggregate,
        primaryLocale: state.aggregate.project.primaryLocale,
      });
      completeDraftIsValid = true;
    } catch {
      completeDraftIsValid = false;
    }
  }
  const proposalBlocksSave = agent.blocksSave;
  const saving = saveState.status === "saving";
  const saveDisabled =
    !hasUnsavedChanges ||
    !completeDraftIsValid ||
    Boolean(validationMessage) ||
    proposalBlocksSave ||
    saveState.status === "saving";

  const changePage = (nextPage: PageModel) => {
    if (savePending.current) return;
    try {
      validateRegisteredPage(nextPage, context);
    } catch {
      setValidationMessage(
        "That page change is not valid yet, so it cannot be saved. Your last valid design is still shown.",
      );
      setSaveState({
        status: "validation",
        message: "Fix the page issue before saving your draft.",
      });
      return;
    }
    if (!canonicalPagesEqual(nextPage, page)) {
      agent.closeForPageMutation(nextPage);
    }
    if (
      selectedSectionId &&
      !nextPage.sections.some((section) => section.id === selectedSectionId)
    ) {
      setSelectedSectionId(undefined);
    }
    setSessionPages((current) => ({ ...current, [nextPage.id]: nextPage }));
    setValidationMessage("");
    setSaveState({ status: "idle" });
  };

  const selectPage = (nextPageId: string) => {
    if (savePending.current) return;
    if (
      currentPageHasUnsavedChanges &&
      !window.confirm(
        "Switch pages? Your unsaved changes will stay in this editor session until you return or discard them.",
      )
    ) {
      return;
    }
    setSelectedPageId(nextPageId);
    setSelectedSectionId(undefined);
    setValidationMessage("");
    agent.closeForPageSwitch();
  };

  const discardChanges = () => {
    if (savePending.current) return;
    if (!currentPageHasUnsavedChanges) return;
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
    setSaveState({ status: "idle" });
    agent.closeForPageMutation(originalPage);
  };

  const saveDraft = async () => {
    if (saveDisabled || savePending.current) return;
    const capturedDraft = structuredClone(state.draft);
    const capturedChangedPages = structuredClone(changedPages);
    savePending.current = true;
    setSaveState({ status: "saving" });
    try {
      const result = await saveValidatedEditorDraft({
        repository: repository.current!,
        projectId,
        loadedDraft: capturedDraft,
        changedPages: capturedChangedPages,
        primaryLocale: state.aggregate.project.primaryLocale,
      });
      const published = result.aggregate.snapshots.find(
        (snapshot) => snapshot.id === result.aggregate.project.publishedSnapshotId,
      );
      if (!published) throw new EditorDraftValidationError();
      const pages = result.draft.pages.filter((item) => editorPageTypes.has(item.type));
      setState({
        status: "ready",
        aggregate: result.aggregate,
        draft: result.draft,
        published,
        pages,
      });
      setSessionPages((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([pageId, sessionPage]) => {
            const savedPage = result.draft.pages.find((item) => item.id === pageId);
            return !savedPage || !canonicalPagesEqual(sessionPage, savedPage);
          }),
        ),
      );
      setResetKeys((current) =>
        Object.fromEntries(pages.map((item) => [item.id, (current[item.id] ?? 0) + 1])),
      );
      setValidationMessage("");
      setSaveState({ status: "success", message: "Draft saved successfully." });
    } catch (error) {
      if (error instanceof StaleEditorDraftError) {
        setSaveState({
          status: "stale",
          message:
            "A newer draft was saved elsewhere. Reload before saving; your current changes are still here.",
        });
      } else if (
        error instanceof EditorDraftValidationError ||
        error instanceof RepositoryValidationError
      ) {
        setSaveState({
          status: "validation",
          message: "This draft could not be validated. Your changes are still here for review.",
        });
      } else {
        setSaveState({
          status: "storage",
          message: "The draft could not be saved. Check your browser storage and try again.",
        });
      }
    } finally {
      savePending.current = false;
    }
  };

  return (
    <div
      aria-busy={saving || agent.controlsDisabled}
      className={styles.editor}
      lang={locale}
      style={style}
    >
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
        <div className={styles.draftActions}>
          <div aria-label="Draft status" className={styles.draftStatus} role="status">
            <strong>{hasUnsavedChanges ? "Unsaved changes" : "No unsaved changes"}</strong>
            <span>
              {draftDiffers(state.draft, state.published)
                ? "The stored draft differs from the published storefront."
                : "Changes stay in this editor session until saved."}
            </span>
          </div>
          <button
            className={styles.saveDraftButton}
            disabled={saveDisabled}
            onClick={() => void saveDraft()}
            type="button"
          >
            {saveState.status === "saving" ? "Saving draft…" : "Save draft"}
          </button>
          <div aria-live="polite" aria-atomic="true" className={styles.saveStatus}>
            {saveState.status === "saving" ? (
              <p role="status">Saving your draft… Please wait before making more changes.</p>
            ) : null}
            {saveState.status === "success" ? <p role="status">{saveState.message}</p> : null}
            {saveState.status === "validation" ||
            saveState.status === "storage" ||
            saveState.status === "stale" ? (
              <p role="alert">{saveState.message}</p>
            ) : null}
            {hasUnsavedChanges && !completeDraftIsValid ? (
              <p role="alert">Some changes need attention before this draft can be saved.</p>
            ) : null}
          </div>
        </div>
      </header>
      <div className={styles.workspace}>
        <aside aria-label="Editor controls" className={styles.sidebar}>
          <section>
            <label htmlFor="editor-page">Storefront page</label>
            <select
              disabled={saving}
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
            disabled={!currentPageHasUnsavedChanges || saving}
            onClick={discardChanges}
            type="button"
          >
            Discard changes
          </button>
          <p className={styles.boundaryNote}>
            Save draft keeps this work unpublished. Publishing remains a separate future action.
          </p>
          {validationMessage ? (
            <p className={styles.validationMessage} role="alert">
              {validationMessage}
            </p>
          ) : null}
        </aside>
        <main className={styles.canvas}>
          {showingProposal ? (
            <div className={styles.proposalPreviewLabel} role="status">
              Proposal preview — your current page is unchanged
            </div>
          ) : null}
          <VeskifyPuckCanvas
            brandSystem={state.draft.brandSystem}
            context={context}
            onPageChange={changePage}
            onSelectedSectionChange={(sectionId) => {
              setSelectedSectionId(
                sectionId && page.sections.some((section) => section.id === sectionId)
                  ? sectionId
                  : undefined,
              );
            }}
            onValidationError={(message) => {
              if (!savePending.current) setValidationMessage(message);
            }}
            page={canvasPage}
            readOnly={agent.blocksSave || saving}
            readOnlyLabel={showingProposal ? "Proposal preview canvas" : "Visual editor canvas"}
            resetKey={resetKeys[canvasPage.id] ?? 0}
          />
        </main>
        <DesignAgentPanel
          controller={agent}
          locale={locale}
          pageTitle={title}
          primaryLocale={state.aggregate.project.primaryLocale}
          selectedSectionLabel={
            selectedSection ? getComponentDefinition(selectedSection.component).label : undefined
          }
        />
      </div>
    </div>
  );
}
