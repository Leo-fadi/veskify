"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  assembleValidatedEditorDraft,
  EditorDraftValidationError,
  saveValidatedEditorDraft,
  StaleEditorDraftError,
} from "@/application/draft-save";
import { InMemoryDesignProposalStore, type DesignProposal } from "@/application/design-operations";
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
import {
  deterministicProposalPrompts,
  acceptCurrentDesignProposal,
  canonicalPagesEqual,
  proposalChangeLabels,
  requestDeterministicHomepageProposal,
} from "./deterministic-proposal-requests";

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
type ProposalUiState =
  | { status: "idle" }
  | { status: "generating"; basePage: PageModel }
  | { status: "ready"; proposal: DesignProposal }
  | { status: "invalid" | "unsupported" | "error" | "stale"; message: string }
  | { status: "accepted" | "rejected"; proposal: DesignProposal };
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
  const [request, setRequest] = useState("");
  const [proposalState, setProposalState] = useState<ProposalUiState>({ status: "idle" });
  const proposalStore = useRef(new InMemoryDesignProposalStore());
  const proposalGeneration = useRef(0);
  const [saveState, setSaveState] = useState<SaveUiState>({ status: "idle" });
  const savePending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    proposalGeneration.current += 1;
    queueMicrotask(() => {
      if (!cancelled) setProposalState({ status: "idle" });
    });
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
          setRequest("");
          setProposalState({ status: "idle" });
          setSaveState({ status: "idle" });
          proposalGeneration.current += 1;
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
  const currentPageHasUnsavedChanges = !canonicalPagesEqual(page, originalPage);
  const changedPages = state.pages.flatMap((baselinePage) => {
    const sessionPage = sessionPages[baselinePage.id];
    return sessionPage && !canonicalPagesEqual(sessionPage, baselinePage) ? [sessionPage] : [];
  });
  const hasUnsavedChanges = changedPages.length > 0;
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
  const showingProposal = proposalState.status === "ready";
  const canvasPage = showingProposal ? proposalState.proposal.proposedPage : page;
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
  const proposalBlocksSave =
    proposalState.status === "generating" || proposalState.status === "ready";
  const saving = saveState.status === "saving";
  const saveDisabled =
    !hasUnsavedChanges ||
    !completeDraftIsValid ||
    Boolean(validationMessage) ||
    proposalBlocksSave ||
    saveState.status === "saving";

  const closeProposalBecausePageChanged = (message: string) => {
    proposalGeneration.current += 1;
    setProposalState((current) =>
      current.status === "ready" || current.status === "generating"
        ? { status: "stale", message }
        : { status: "idle" },
    );
  };

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
      closeProposalBecausePageChanged(
        "The proposal was closed because the page changed. Create a new proposal to review the latest design.",
      );
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
    setValidationMessage("");
    closeProposalBecausePageChanged(
      "The proposal was closed because you opened another page. Create a new proposal when you are ready.",
    );
  };

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savePending.current) return;
    const generation = proposalGeneration.current + 1;
    proposalGeneration.current = generation;
    setProposalState({ status: "generating", basePage: structuredClone(page) });
    window.setTimeout(() => {
      if (generation !== proposalGeneration.current) return;
      try {
        const result = requestDeterministicHomepageProposal({
          request,
          page,
          context,
          store: proposalStore.current,
        });
        setProposalState(
          result.status === "ready"
            ? { status: "ready", proposal: result.proposal }
            : { status: result.status, message: result.message },
        );
      } catch {
        setProposalState({
          status: "error",
          message: "Something went wrong while preparing the proposal. Your page was not changed.",
        });
      }
    }, 0);
  };

  const acceptProposal = () => {
    if (savePending.current) return;
    if (proposalState.status !== "ready") return;
    try {
      const result = acceptCurrentDesignProposal({
        currentPage: page,
        proposal: proposalState.proposal,
        store: proposalStore.current,
      });
      if (result.status === "stale") {
        closeProposalBecausePageChanged(
          "This proposal is no longer based on your current page. Create a new proposal to review the latest design.",
        );
        return;
      }
      const acceptedPage = result.page;
      proposalGeneration.current += 1;
      setSessionPages((current) => ({ ...current, [acceptedPage.id]: acceptedPage }));
      setValidationMessage("");
      setSaveState({ status: "idle" });
      setResetKeys((current) => ({
        ...current,
        [acceptedPage.id]: (current[acceptedPage.id] ?? 0) + 1,
      }));
      setProposalState({ status: "accepted", proposal: proposalState.proposal });
    } catch {
      setProposalState({
        status: "error",
        message: "The proposal could not be applied safely. Your current page was not changed.",
      });
    }
  };

  const rejectProposal = () => {
    if (savePending.current) return;
    if (proposalState.status !== "ready") return;
    try {
      proposalStore.current.reject(proposalState.proposal.id);
      proposalGeneration.current += 1;
      setProposalState({ status: "rejected", proposal: proposalState.proposal });
    } catch {
      setProposalState({
        status: "error",
        message: "The proposal could not be closed. Your current page was not changed.",
      });
    }
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
    closeProposalBecausePageChanged(
      "Your changes were discarded and the proposal was closed because the page changed.",
    );
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
      setProposalState({ status: "idle" });
      proposalGeneration.current += 1;
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
    <div aria-busy={saving} className={styles.editor} lang={locale} style={style}>
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
            onValidationError={(message) => {
              if (!savePending.current) setValidationMessage(message);
            }}
            page={canvasPage}
            readOnly={showingProposal || saving}
            readOnlyLabel={showingProposal ? "Proposal preview canvas" : "Visual editor canvas"}
            resetKey={resetKeys[canvasPage.id] ?? 0}
          />
        </main>
        <aside aria-label="Design request" className={styles.requestPanel}>
          <form className={styles.requestForm} onSubmit={submitRequest}>
            <div>
              <p className={styles.eyebrow}>Design assistant</p>
              <h2>What would you like to change?</h2>
              <p>Choose an example or describe the same supported result in your own typing.</p>
            </div>
            <label htmlFor="design-request">Your request</label>
            <textarea
              disabled={saving}
              id="design-request"
              onChange={(event) => setRequest(event.target.value)}
              placeholder="Make the homepage feel more luxurious."
              required
              rows={4}
              value={request}
            />
            <button disabled={proposalState.status === "generating" || saving} type="submit">
              {proposalState.status === "generating" ? "Preparing proposal…" : "Show proposal"}
            </button>
            <div className={styles.examples}>
              <span>Try an example</span>
              {deterministicProposalPrompts.map((prompt) => (
                <button
                  disabled={saving}
                  key={prompt}
                  onClick={() => setRequest(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </form>

          <div aria-live="polite" aria-atomic="true" className={styles.proposalStatus}>
            {proposalState.status === "generating" ? (
              <p>Preparing a safe visual proposal…</p>
            ) : null}
            {proposalState.status === "invalid" ||
            proposalState.status === "unsupported" ||
            proposalState.status === "error" ||
            proposalState.status === "stale" ? (
              <p
                role={
                  proposalState.status === "unsupported" || proposalState.status === "stale"
                    ? "status"
                    : "alert"
                }
              >
                {proposalState.message}
              </p>
            ) : null}
            {proposalState.status === "accepted" ? (
              <p>Proposal accepted. The homepage now has unsaved changes.</p>
            ) : null}
            {proposalState.status === "rejected" ? (
              <p>Proposal rejected. Your page remains exactly as it was.</p>
            ) : null}
          </div>

          {proposalState.status === "ready" ? (
            <section className={styles.proposalCard} aria-label="Design proposal">
              <p className={styles.eyebrow}>Ready to review</p>
              <h2>
                {resolveLocalizedText(
                  proposalState.proposal.summary,
                  locale,
                  state.aggregate.project.primaryLocale,
                )}
              </h2>
              <p>
                <strong>Affected page:</strong> {title}
              </p>
              <ol>
                {proposalChangeLabels(proposalState.proposal, locale).map((label, index) => (
                  <li key={`${proposalState.proposal.operations[index].type}-${index}`}>{label}</li>
                ))}
              </ol>
              <p className={styles.boundaryNote}>
                Accepting updates only this in-memory draft page. It does not save or publish.
              </p>
              <div className={styles.proposalActions}>
                <button disabled={saving} onClick={acceptProposal} type="button">
                  Accept proposal
                </button>
                <button disabled={saving} onClick={rejectProposal} type="button">
                  Reject proposal
                </button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
