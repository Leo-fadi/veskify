"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
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
  | { status: "generating" }
  | { status: "ready"; proposal: DesignProposal }
  | { status: "invalid" | "unsupported" | "error"; message: string }
  | { status: "accepted" | "rejected"; proposal: DesignProposal };

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
  const [request, setRequest] = useState("");
  const [proposalState, setProposalState] = useState<ProposalUiState>({ status: "idle" });
  const proposalStore = useRef(new InMemoryDesignProposalStore());

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
          setRequest("");
          setProposalState({ status: "idle" });
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
  const showingProposal = proposalState.status === "ready";
  const canvasPage = showingProposal ? proposalState.proposal.proposedPage : page;

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
    setProposalState({ status: "idle" });
  };

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProposalState({ status: "generating" });
    window.setTimeout(() => {
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
    if (proposalState.status !== "ready") return;
    try {
      const acceptedPage = proposalStore.current.accept(proposalState.proposal.id);
      changePage(acceptedPage);
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
    if (proposalState.status !== "ready") return;
    try {
      proposalStore.current.reject(proposalState.proposal.id);
      setProposalState({ status: "rejected", proposal: proposalState.proposal });
    } catch {
      setProposalState({
        status: "error",
        message: "The proposal could not be closed. Your current page was not changed.",
      });
    }
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
          {showingProposal ? (
            <div className={styles.proposalPreviewLabel} role="status">
              Proposal preview — your current page is unchanged
            </div>
          ) : null}
          <VeskifyPuckCanvas
            brandSystem={state.draft.brandSystem}
            context={context}
            onPageChange={changePage}
            onValidationError={setValidationMessage}
            page={canvasPage}
            readOnly={showingProposal}
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
              id="design-request"
              onChange={(event) => setRequest(event.target.value)}
              placeholder="Make the homepage feel more luxurious."
              required
              rows={4}
              value={request}
            />
            <button disabled={proposalState.status === "generating"} type="submit">
              {proposalState.status === "generating" ? "Preparing proposal…" : "Show proposal"}
            </button>
            <div className={styles.examples}>
              <span>Try an example</span>
              {deterministicProposalPrompts.map((prompt) => (
                <button key={prompt} onClick={() => setRequest(prompt)} type="button">
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
            proposalState.status === "error" ? (
              <p role={proposalState.status === "unsupported" ? "status" : "alert"}>
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
                <button onClick={acceptProposal} type="button">
                  Accept proposal
                </button>
                <button onClick={rejectProposal} type="button">
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
