"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  assembleValidatedEditorDraft,
  EditorDraftValidationError,
  saveValidatedEditorDraft,
  StaleEditorDraftError,
} from "@/application/draft-save";
import type { AIProvider } from "@/application/ai-provider";
import type { StorefrontAIProvider } from "@/application/ai-storefront-generation";
import {
  canDuplicateSection,
  canToggleSectionVisibility,
  CanonicalEditorHistory,
  type CanonicalCommandTransaction,
  createDuplicateSectionTransaction,
  createSectionVisibilityTransaction,
  duplicateCanonicalSection,
  setCanonicalSectionVisibility,
} from "@/application/editor-history";
import {
  createStorefrontRenderContext,
  getComponentDefinition,
  merchantEditorSectionLabel,
  validateRegisteredPage,
} from "@/components/registry";
import { brandSystemToCssVariables, type BrandSystem } from "@/domain/design-system";
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
import { createBrowserProposalAnalyticsSink } from "@/services/analytics";
import {
  AppShell,
  Button,
  Card,
  Drawer,
  editorCopy,
  Field,
  Notice,
  StatusPill,
  Tabs,
} from "@/components/ui";
import styles from "./project-editor.module.css";
import { DesignAgentPanel } from "./design-agent-panel";
import {
  canonicalPagesEqual,
  changedPagesForActiveDraft,
  composeActiveEditorDraft,
  proposalStorefrontPreview,
} from "./editor-draft-state";
import {
  useDesignAgentSession,
  type DesignAgentSessionController,
} from "./use-design-agent-session";

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
        <p className={styles.eyebrow}>Storefront Studio</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {retry ? (
          <button onClick={retry} type="button">
            Try again
          </button>
        ) : null}
        <Link href="/">Return to Vesko home</Link>
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

function duplicatedSectionFrom(transaction: CanonicalCommandTransaction | undefined) {
  if (
    transaction?.forward.length !== 1 ||
    transaction.inverse.length !== 1 ||
    transaction.forward[0].type !== "insertSection" ||
    transaction.inverse[0].type !== "removeSection" ||
    transaction.forward[0].section.id !== transaction.inverse[0].sectionId
  ) {
    return undefined;
  }
  return transaction.forward[0].section;
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

function editorPageName(page: PageModel, locale: Locale, primaryLocale: Locale) {
  return page.type === "home"
    ? locale === "fi"
      ? "Etusivu"
      : "Homepage"
    : resolveLocalizedText(page.title, locale, primaryLocale);
}

function EditorDesignTools({
  locale,
  selectedSectionLabel,
}: {
  locale: Locale;
  selectedSectionLabel?: string;
}) {
  const toolCopy = editorCopy[locale].tools;

  return (
    <div className={styles.designTools}>
      <Card className={styles.toolCard}>
        <p className={styles.eyebrow}>{toolCopy.design}</p>
        <h2>{selectedSectionLabel ?? toolCopy.selectSection}</h2>
        <p>{toolCopy.designIntro}</p>
        <Notice variant="info">
          {selectedSectionLabel ? toolCopy.designIntro : toolCopy.selectSection}
        </Notice>
      </Card>
      <div aria-label={toolCopy.designControls} className={styles.designGroups}>
        {toolCopy.groups.map((group, index) => (
          <details key={group} open={index === 0}>
            <summary>{group}</summary>
            <p>{selectedSectionLabel ? toolCopy.designIntro : toolCopy.selectSection}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

function EditorToolRail({
  activeTab,
  controller,
  id,
  locale,
  onTabChange,
  pageTitle,
  primaryLocale,
  selectedSectionLabel,
  storefrontPageCount,
  onReviewPage,
}: {
  activeTab: "design" | "ai";
  controller: DesignAgentSessionController;
  id?: string;
  locale: Locale;
  onTabChange: (tab: "design" | "ai") => void;
  pageTitle: string;
  primaryLocale: Locale;
  selectedSectionLabel?: string;
  storefrontPageCount: number;
  onReviewPage: (pageId: string) => void;
}) {
  const text = editorCopy[locale].tools;

  return (
    <section aria-label={editorCopy[locale].panels.contextual} className={styles.toolRail} id={id}>
      <Tabs
        items={[
          {
            active: activeTab === "design",
            id: "design",
            label: text.design,
          },
          {
            active: activeTab === "ai",
            id: "ai",
            label: text.assistant,
          },
        ]}
        label={text.label}
        onSelect={(id) => onTabChange(id === "ai" ? "ai" : "design")}
      />
      {activeTab === "design" ? (
        <EditorDesignTools locale={locale} selectedSectionLabel={selectedSectionLabel} />
      ) : (
        <DesignAgentPanel
          controller={controller}
          locale={locale}
          pageTitle={pageTitle}
          primaryLocale={primaryLocale}
          selectedSectionLabel={selectedSectionLabel}
          storefrontPageCount={storefrontPageCount}
          onReviewPage={onReviewPage}
        />
      )}
    </section>
  );
}

export function ProjectEditorClient({
  projectId,
  repositoryFactory = defaultRepositoryFactory,
  aiProvider,
  storefrontAiProvider,
}: {
  projectId: string;
  repositoryFactory?: RepositoryFactory;
  aiProvider?: AIProvider;
  storefrontAiProvider?: StorefrontAIProvider;
}) {
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [proposalAnalytics] = useState(createBrowserProposalAnalyticsSink);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedPageId, setSelectedPageId] = useState<string>();
  const [selectedSectionId, setSelectedSectionId] = useState<string>();
  const [activeLocale, setActiveLocale] = useState<Locale>();
  const [sessionPages, setSessionPages] = useState<Record<string, PageModel>>({});
  const [sessionBrandSystem, setSessionBrandSystem] = useState<BrandSystem>();
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({});
  const [validationMessage, setValidationMessage] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [editorHistory, setEditorHistory] = useState<CanonicalEditorHistory>();
  const [pageEditsAfterStorefront, setPageEditsAfterStorefront] = useState(0);
  const [saveState, setSaveState] = useState<SaveUiState>({ status: "idle" });
  const [activeToolTab, setActiveToolTab] = useState<"design" | "ai">("ai");
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [outlineDrawerOpen, setOutlineDrawerOpen] = useState(false);
  const [toolDrawerOpen, setToolDrawerOpen] = useState(false);
  const [compactViewport, setCompactViewport] = useState(false);
  const savePending = useRef(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 63.99rem)");
    const update = () => setCompactViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (event.altKey || isTypingTarget(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      const undo = modifier && event.key.toLocaleLowerCase() === "z" && !event.shiftKey;
      const redo =
        (modifier && event.key.toLocaleLowerCase() === "z" && event.shiftKey) ||
        (event.ctrlKey && !event.metaKey && event.key.toLocaleLowerCase() === "y");
      const action = undo ? "undo" : redo ? "redo" : undefined;
      if (!action) return;
      const button = document.querySelector<HTMLButtonElement>(
        `[data-editor-history-action='${action}']`,
      );
      if (!button || button.disabled) return;
      button.click();
      event.preventDefault();
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, []);

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
          const nextHistory = new CanonicalEditorHistory({
            validatePage: (page) => validateRegisteredPage(page, context),
          });
          pages.forEach((page) => nextHistory.initialize(page));
          setEditorHistory(nextHistory);
          setSelectedPageId(pages.find((page) => page.type === "home")?.id ?? pages[0].id);
          setSelectedSectionId(undefined);
          setActiveLocale(aggregate.project.primaryLocale);
          setSessionPages({});
          setSessionBrandSystem(undefined);
          setResetKeys({});
          setValidationMessage("");
          setHistoryStatus("");
          setPageEditsAfterStorefront(0);
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
  const activeDraft = readyState
    ? composeActiveEditorDraft({
        draft: readyState.draft,
        sessionPages,
        brandSystem: sessionBrandSystem,
      })
    : undefined;
  const readyContext =
    readyState && readyLocale && activeDraft
      ? createStorefrontRenderContext({
          activeLocale: readyLocale,
          primaryLocale: readyState.aggregate.project.primaryLocale,
          catalogue: readyState.aggregate.catalogue,
          snapshot: activeDraft,
          pagePathPrefix: `/projects/${projectId}`,
        })
      : undefined;
  const agent = useDesignAgentSession({
    lifecycleKey: `${projectId}:${attempt}`,
    projectId,
    draftSnapshotId: readyState?.draft.id,
    draftRevision: readyState?.draft.revision,
    page: readyPage,
    activeLocale: readyLocale,
    primaryLocale: readyState?.aggregate.project.primaryLocale,
    enabledLocales: readyState?.aggregate.project.enabledLocales,
    brandSystem: activeDraft?.brandSystem,
    displayContext: readyContext,
    selectedSectionId,
    activeDraft,
    storedDraft: readyState?.draft,
    publishedSnapshot: readyState?.published,
    catalogue: readyState?.aggregate.catalogue,
    disabled: saveState.status === "saving",
    provider: aiProvider,
    storefrontProvider: storefrontAiProvider,
    analytics: proposalAnalytics,
    analyticsRoute: `/projects/${projectId}/editor`,
    onAcceptedPage: (acceptedPage) => {
      const committedPage =
        editorHistory?.commit(acceptedPage, "Apply design proposal") ??
        structuredClone(acceptedPage);
      setSessionPages((current) => ({ ...current, [acceptedPage.id]: committedPage }));
      setValidationMessage("");
      setHistoryStatus("Proposal applied. You can undo this change.");
      setPageEditsAfterStorefront((current) => (agent.canUndoStorefront ? current + 1 : current));
      setSaveState({ status: "idle" });
      setResetKeys((current) => ({
        ...current,
        [acceptedPage.id]: (current[acceptedPage.id] ?? 0) + 1,
      }));
    },
    onStorefrontSnapshot: (snapshot) => {
      if (!readyState) return;
      setSessionPages(
        Object.fromEntries(
          snapshot.pages.flatMap((snapshotPage) => {
            const baseline = readyState.draft.pages.find((item) => item.id === snapshotPage.id);
            return baseline && canonicalPagesEqual(snapshotPage, baseline)
              ? []
              : [[snapshotPage.id, structuredClone(snapshotPage)] as const];
          }),
        ),
      );
      setSessionBrandSystem(structuredClone(snapshot.brandSystem));
      snapshot.pages.forEach((snapshotPage) => editorHistory?.rebase(snapshotPage));
      setResetKeys((current) =>
        Object.fromEntries(
          snapshot.pages.map((snapshotPage) => [
            snapshotPage.id,
            (current[snapshotPage.id] ?? 0) + 1,
          ]),
        ),
      );
      setSelectedSectionId((current) =>
        current &&
        snapshot.pages.some((item) => item.sections.some((section) => section.id === current))
          ? current
          : undefined,
      );
      setValidationMessage("");
      setHistoryStatus("Storefront proposal applied as one change. You can undo it atomically.");
      setPageEditsAfterStorefront(0);
      setSaveState({ status: "idle" });
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
  const changedPages = changedPagesForActiveDraft({
    baseDraft: state.draft,
    activeDraft: activeDraft!,
  });
  const brandSystemChanged =
    JSON.stringify(activeDraft!.brandSystem) !== JSON.stringify(state.draft.brandSystem);
  const hasUnsavedChanges = changedPages.length > 0 || brandSystemChanged;
  const locale = readyLocale!;
  const title = resolveLocalizedText(page.title, locale, state.aggregate.project.primaryLocale);
  const context = readyContext!;
  const previewHref = `/projects/${projectId}${page.slug === "/" ? "" : page.slug}`;
  const previewStorefront = proposalStorefrontPreview({
    proposal: agent.generatedStorefrontProposal,
    previewActive: agent.previewActive,
    visibleState: agent.visibleState,
  });
  const displayedBrandSystem = previewStorefront?.brandSystem ?? activeDraft!.brandSystem;
  const style = brandSystemToCssVariables(displayedBrandSystem) as CSSProperties;
  const showingProposal =
    (agent.generatedProposal !== null || previewStorefront !== undefined) &&
    agent.previewActive &&
    (agent.visibleState === "proposalReady" || agent.visibleState === "accepting");
  const canvasPage =
    (showingProposal ? agent.generatedProposal?.proposal.proposedPage : undefined) ??
    previewStorefront?.pages.find((item) => item.id === page.id) ??
    page;
  const selectedSection = selectedSectionId
    ? page.sections.find((section) => section.id === selectedSectionId)
    : undefined;
  let completeDraftIsValid = false;
  if (hasUnsavedChanges) {
    try {
      assembleValidatedEditorDraft({
        baseDraft: state.draft,
        changedPages,
        brandSystem: activeDraft!.brandSystem,
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
  const mutationsBlocked = saving || proposalBlocksSave;
  const saveDisabled =
    !hasUnsavedChanges ||
    !completeDraftIsValid ||
    Boolean(validationMessage) ||
    proposalBlocksSave ||
    saveState.status === "saving";
  const currentPageCanUndo = editorHistory?.canUndo(page.id) ?? false;
  const canUndoStorefront = agent.canUndoStorefront && pageEditsAfterStorefront === 0;
  const canUndo = canUndoStorefront || currentPageCanUndo;
  const canRedo = agent.canRedoStorefront || (editorHistory?.canRedo(page.id) ?? false);
  const text = editorCopy[locale];
  const status =
    saveState.status === "saving"
      ? "saving"
      : hasUnsavedChanges
        ? "unsaved"
        : draftDiffers(state.draft, state.published)
          ? "draft-different"
          : "saved";
  const statusLabel =
    status === "draft-different" ? text.status.draftDifferent : text.status[status];

  const remountPage = (pageId: string) => {
    setResetKeys((current) => ({
      ...current,
      [pageId]: (current[pageId] ?? 0) + 1,
    }));
  };

  const showHistoryPage = (nextPage: PageModel) => {
    setSessionPages((current) => ({ ...current, [nextPage.id]: structuredClone(nextPage) }));
    if (
      selectedSectionId &&
      !nextPage.sections.some((section) => section.id === selectedSectionId)
    ) {
      setSelectedSectionId(undefined);
    }
    remountPage(nextPage.id);
    setValidationMessage("");
    setSaveState({ status: "idle" });
  };

  const changePage = (nextPage: PageModel) => {
    if (savePending.current) return;
    try {
      validateRegisteredPage(nextPage, context);
    } catch {
      setValidationMessage(text.feedback.pageValidation);
      setSaveState({
        status: "validation",
        message: text.feedback.pageSaveValidation,
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
    const committedPage = editorHistory?.commit(nextPage, "Edit page") ?? structuredClone(nextPage);
    setSessionPages((current) => ({ ...current, [nextPage.id]: committedPage }));
    setPageEditsAfterStorefront((current) => (agent.canUndoStorefront ? current + 1 : current));
    setValidationMessage("");
    setHistoryStatus("Change added. You can undo it from the editor toolbar.");
    setSaveState({ status: "idle" });
  };

  const undoCurrentPage = () => {
    if (mutationsBlocked || !editorHistory) return false;
    const transaction = editorHistory.inspectTransactions(page.id).past.at(-1);
    const duplicatedSection = duplicatedSectionFrom(transaction);
    const duplicateIndex = duplicatedSection
      ? page.sections.findIndex((section) => section.id === duplicatedSection.id)
      : -1;
    const previousPage = editorHistory.undo(page.id);
    if (!previousPage) return false;
    agent.closeForPageMutation(previousPage);
    showHistoryPage(previousPage);
    setPageEditsAfterStorefront((current) => Math.max(0, current - 1));
    if (duplicatedSection && selectedSectionId === duplicatedSection.id) {
      setSelectedSectionId(previousPage.sections[Math.max(0, duplicateIndex - 1)]?.id);
    }
    setHistoryStatus("Undid the last change on this page.");
    return true;
  };

  const redoCurrentPage = () => {
    if (mutationsBlocked || !editorHistory) return false;
    const transaction = editorHistory.inspectTransactions(page.id).future[0];
    const duplicatedSection = duplicatedSectionFrom(transaction);
    const nextPage = editorHistory.redo(page.id);
    if (!nextPage) return false;
    agent.closeForPageMutation(nextPage);
    showHistoryPage(nextPage);
    setPageEditsAfterStorefront((current) => (agent.canUndoStorefront ? current + 1 : current));
    if (duplicatedSection) setSelectedSectionId(duplicatedSection.id);
    setHistoryStatus("Redid the last change on this page.");
    return true;
  };

  const undoEditor = () => {
    if (mutationsBlocked) return false;
    if (currentPageCanUndo && pageEditsAfterStorefront > 0) return undoCurrentPage();
    if (canUndoStorefront) {
      const undone = agent.undoStorefront();
      if (undone) setHistoryStatus("Undid the storefront proposal as one change.");
      return undone;
    }
    return undoCurrentPage();
  };

  const redoEditor = () => {
    if (mutationsBlocked) return false;
    if (agent.canRedoStorefront) {
      const redone = agent.redoStorefront();
      if (redone) setHistoryStatus("Redid the storefront proposal as one change.");
      return redone;
    }
    return redoCurrentPage();
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
    const nextOriginalPage = state.pages.find((candidate) => candidate.id === nextPageId);
    const nextPage = nextOriginalPage
      ? (sessionPages[nextOriginalPage.id] ?? nextOriginalPage)
      : undefined;
    if (!nextPage || nextPage.id === page.id) return;
    agent.closeForPageSwitch(nextPage);
    setSelectedPageId(nextPageId);
    setSelectedSectionId(undefined);
    setValidationMessage("");
    setHistoryStatus("");
  };

  const selectSection = (nextSectionId: string) => {
    if (savePending.current || mutationsBlocked) return;
    if (!page.sections.some((section) => section.id === nextSectionId)) return;
    if (nextSectionId === selectedSectionId) return;
    agent.closeForSelectionChange(nextSectionId);
    setSelectedSectionId(nextSectionId);
  };

  const discardChanges = () => {
    if (savePending.current) return;
    if (!currentPageHasUnsavedChanges) return;
    if (
      !window.confirm(
        locale === "fi"
          ? "Peruutetaanko tämän sivun tallentamattomat muutokset? Toimintoa ei voi kumota."
          : "Discard the unsaved changes on this page? This cannot be undone.",
      )
    )
      return;
    const resetPage = editorHistory?.reset(originalPage) ?? structuredClone(originalPage);
    setSessionPages((current) => {
      const next = { ...current };
      delete next[originalPage.id];
      return next;
    });
    if (
      selectedSectionId &&
      !resetPage.sections.some((section) => section.id === selectedSectionId)
    ) {
      setSelectedSectionId(undefined);
    }
    remountPage(originalPage.id);
    setValidationMessage("");
    setHistoryStatus("Discarded this page's changes and cleared its undo history.");
    setPageEditsAfterStorefront((current) => Math.max(0, current - 1));
    setSaveState({ status: "idle" });
    agent.closeForPageMutation(resetPage);
  };

  const duplicateSelectedSection = () => {
    if (mutationsBlocked || !selectedSection) return;
    try {
      const allSectionIds = new Set(
        state.draft.pages.flatMap((baselinePage) =>
          (sessionPages[baselinePage.id] ?? baselinePage).sections.map((section) => section.id),
        ),
      );
      const componentLabel = merchantEditorSectionLabel(page, selectedSection, locale);
      const transaction = createDuplicateSectionTransaction({
        page,
        sectionId: selectedSection.id,
        existingSectionIds: allSectionIds,
        label: `Duplicate ${componentLabel}`,
      });
      const nextPage = editorHistory
        ? editorHistory.commitTransaction(transaction)
        : duplicateCanonicalSection({
            page,
            sectionId: selectedSection.id,
            existingSectionIds: allSectionIds,
            context,
          });
      agent.closeForPageMutation(nextPage);
      showHistoryPage(nextPage);
      setPageEditsAfterStorefront((current) => (agent.canUndoStorefront ? current + 1 : current));
      const duplicatedSection = duplicatedSectionFrom(transaction);
      if (duplicatedSection) setSelectedSectionId(duplicatedSection.id);
      const duplicatedLabel = duplicatedSection
        ? merchantEditorSectionLabel(nextPage, duplicatedSection, locale)
        : componentLabel;
      setHistoryStatus(
        locale === "fi"
          ? `${duplicatedLabel} luotiin ja valittiin.`
          : `${duplicatedLabel} was created and selected.`,
      );
    } catch {
      setValidationMessage(text.feedback.duplicateUnavailable);
    }
  };

  const toggleSelectedSection = () => {
    if (mutationsBlocked || !selectedSection) return;
    try {
      const componentLabel = getComponentDefinition(selectedSection.component).label;
      const nextVisible = !selectedSection.visible;
      const transaction = createSectionVisibilityTransaction({
        page,
        sectionId: selectedSection.id,
        visible: nextVisible,
        label: `${nextVisible ? "Show" : "Hide"} ${componentLabel}`,
      });
      const nextPage = editorHistory
        ? editorHistory.commitTransaction(transaction)
        : setCanonicalSectionVisibility({
            page,
            sectionId: selectedSection.id,
            visible: nextVisible,
            context,
          });
      agent.closeForPageMutation(nextPage);
      showHistoryPage(nextPage);
      setPageEditsAfterStorefront((current) => (agent.canUndoStorefront ? current + 1 : current));
      setHistoryStatus(
        `${selectedSection.visible ? "Hid" : "Showed"} ${getComponentDefinition(selectedSection.component).label}.`,
      );
    } catch {
      setValidationMessage(text.feedback.requiredVisible);
    }
  };

  const outlineList = (
    <ol aria-label={text.navigation.outline} className={styles.outlineList}>
      {state.pages.map((item) => {
        const itemIsCurrent = item.id === page.id;
        const itemPage = sessionPages[item.id] ?? item;
        return (
          <li key={item.id}>
            <button
              aria-current={itemIsCurrent ? "page" : undefined}
              className={styles.outlinePage}
              disabled={saving}
              onClick={() => selectPage(item.id)}
              type="button"
            >
              <span>{editorPageName(item, locale, state.aggregate.project.primaryLocale)}</span>
              <small>
                {itemPage.sections.length} {text.navigation.sections}
              </small>
            </button>
            {itemIsCurrent ? (
              <ol className={styles.outlineSections}>
                {itemPage.sections.map((section) => (
                  <li key={section.id}>
                    <button
                      aria-current={section.id === selectedSectionId ? "step" : undefined}
                      aria-label={`${merchantEditorSectionLabel(itemPage, section, locale)} — ${section.visible ? text.section.visible : text.section.hidden}`}
                      className={styles.outlineSection}
                      disabled={saving}
                      onClick={() => selectSection(section.id)}
                      type="button"
                    >
                      <span>{merchantEditorSectionLabel(itemPage, section, locale)}</span>
                      <small>{section.visible ? text.section.visible : text.section.hidden}</small>
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ol>
  );

  const sectionActions = (
    <Card aria-label={text.section.actions} className={styles.sectionActions}>
      <details open>
        <summary>{text.section.options}</summary>
        <h2>{text.section.selected}</h2>
        {selectedSection ? (
          <>
            <p>
              <strong>{merchantEditorSectionLabel(page, selectedSection, locale)}</strong>
              <span>{selectedSection.visible ? text.section.visible : text.section.hidden}</span>
            </p>
            <div>
              <Button
                disabled={!canDuplicateSection(selectedSection) || mutationsBlocked}
                onClick={duplicateSelectedSection}
                variant="secondary"
              >
                {text.section.duplicate}
              </Button>
              <Button
                disabled={!canToggleSectionVisibility(selectedSection) || mutationsBlocked}
                onClick={toggleSelectedSection}
                variant="secondary"
              >
                {selectedSection.visible ? text.section.hide : text.section.show}
              </Button>
            </div>
            {!canDuplicateSection(selectedSection) ||
            !canToggleSectionVisibility(selectedSection) ? (
              <p>{text.section.required}</p>
            ) : null}
          </>
        ) : (
          <p>{text.section.empty}</p>
        )}
      </details>
    </Card>
  );

  const toolRail = (
    <EditorToolRail
      activeTab={activeToolTab}
      controller={agent}
      id="editor-contextual-panel"
      locale={locale}
      onTabChange={setActiveToolTab}
      pageTitle={title}
      primaryLocale={state.aggregate.project.primaryLocale}
      selectedSectionLabel={
        selectedSection ? merchantEditorSectionLabel(page, selectedSection, locale) : undefined
      }
      storefrontPageCount={activeDraft!.pages.length}
      onReviewPage={(pageId) => {
        const candidate = state.pages.find((item) => item.id === pageId);
        if (!candidate || candidate.id === page.id) return;
        agent.closeForPageSwitch(candidate);
        setSelectedPageId(candidate.id);
        setSelectedSectionId(undefined);
        setValidationMessage("");
        setHistoryStatus(
          locale === "fi"
            ? "Näytetään ehdotuksen esikatselu valitulle sivulle. Luonnosta ei ole muutettu."
            : "Showing the proposal preview for the selected page. Your draft has not changed.",
        );
      }}
    />
  );

  const renderDraftSafeguards = (compact: boolean) => {
    const saveDisabledReason = validationMessage
      ? validationMessage
      : hasUnsavedChanges && !completeDraftIsValid
        ? locale === "fi"
          ? "Joitakin muutoksia on korjattava ennen luonnoksen tallentamista."
          : "Some changes need attention before this draft can be saved."
        : proposalBlocksSave
          ? locale === "fi"
            ? "Viimeistele nykyisen ehdotuksen tarkistus ennen luonnoksen tallentamista."
            : "Finish reviewing the current proposal before saving the draft."
          : saving
            ? locale === "fi"
              ? "Luonnosta tallennetaan. Odota, kunnes tallennus on valmis."
              : "The draft is being saved. Wait until saving is complete."
            : !hasUnsavedChanges
              ? locale === "fi"
                ? "Luonnoksen tallennus tulee käyttöön, kun teet muutoksen."
                : "Save draft becomes available after you make a change."
              : undefined;
    const saveIsBlockedByValidation =
      Boolean(validationMessage) || (hasUnsavedChanges && !completeDraftIsValid);

    return (
      <section
        aria-label={locale === "fi" ? "Luonnoksen suojaukset" : "Draft safeguards"}
        className={styles.draftSafeguards}
      >
        <Button
          className={styles.discardButton}
          disabled={!currentPageHasUnsavedChanges || saving}
          onClick={discardChanges}
          variant="quiet"
        >
          {locale === "fi" ? "Peruuta sivun muutokset" : "Discard changes"}
        </Button>
        <p className={styles.boundaryNote}>
          {hasUnsavedChanges
            ? locale === "fi"
              ? "Tallenna muutokset luonnokseen ennen julkaisemista. Julkaisun tarkistus käyttää vain viimeksi tallennettua luonnosta."
              : "Save these changes to the draft before publishing. Publish review uses only the last saved draft."
            : locale === "fi"
              ? "Luonnoksen tallentaminen ei julkaise muutoksia. Tarkista ja vahvista julkaisu erikseen."
              : "Saving a draft does not publish it. Review and confirm publishing separately."}
        </p>
        {compact && saveDisabled && saveDisabledReason ? (
          <Notice
            className={styles.validationMessage}
            role={saveIsBlockedByValidation ? "alert" : undefined}
            variant={saveIsBlockedByValidation ? "danger" : "info"}
          >
            {saveDisabledReason}
          </Notice>
        ) : !compact && validationMessage ? (
          <p className={styles.validationMessage} role="alert">
            {validationMessage}
          </p>
        ) : null}
      </section>
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
        brandSystem: activeDraft!.brandSystem,
        primaryLocale: state.aggregate.project.primaryLocale,
      });
      const published = result.aggregate.snapshots.find(
        (snapshot) => snapshot.id === result.aggregate.project.publishedSnapshotId,
      );
      if (!published) throw new EditorDraftValidationError();
      const pages = result.draft.pages.filter((item) => editorPageTypes.has(item.type));
      pages.forEach((savedPage) => editorHistory?.rebase(savedPage));
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
      setSessionBrandSystem(undefined);
      agent.clearStorefrontHistory();
      setPageEditsAfterStorefront(0);
      setResetKeys((current) =>
        Object.fromEntries(pages.map((item) => [item.id, (current[item.id] ?? 0) + 1])),
      );
      setValidationMessage("");
      setHistoryStatus(
        locale === "fi"
          ? "Luonnos tallennettiin. Kumoa-toiminto on edelleen käytettävissä ja luo uusia tallentamattomia muutoksia."
          : "Draft saved. Undo remains available and will create new unsaved work.",
      );
      setSaveState({ status: "success", message: text.feedback.saved });
    } catch (error) {
      if (error instanceof StaleEditorDraftError) {
        setSaveState({
          status: "stale",
          message: text.feedback.saveStale,
        });
      } else if (
        error instanceof EditorDraftValidationError ||
        error instanceof RepositoryValidationError
      ) {
        setSaveState({
          status: "validation",
          message: text.feedback.saveValidation,
        });
      } else {
        setSaveState({
          status: "storage",
          message: text.feedback.saveStorage,
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
      <AppShell
        activeModule="editor"
        editorMode
        showModuleNav={false}
        headerActions={
          <div className={styles.draftActions}>
            <fieldset className={styles.headerLocale}>
              <legend>{locale === "fi" ? "Kieli" : "Language"}</legend>
              {state.aggregate.project.enabledLocales.map((enabledLocale) => (
                <label key={enabledLocale}>
                  <input
                    checked={locale === enabledLocale}
                    name="editor-locale"
                    onChange={() => {
                      if (enabledLocale !== locale) agent.closeForLocaleChange();
                      setActiveLocale(enabledLocale);
                    }}
                    type="radio"
                    value={enabledLocale}
                  />
                  <span>{enabledLocale === "en" ? "English" : "Suomi"}</span>
                </label>
              ))}
            </fieldset>
            <div className={styles.statusCluster}>
              <div
                aria-label={text.status.draft}
                className={styles.draftStatus}
                data-testid="draft-status"
                role="status"
              >
                <StatusPill label={statusLabel} live status={status} />
                <span>{hasUnsavedChanges ? text.status.unsaved : text.status.noUnsaved}</span>
                <span>
                  {draftDiffers(state.draft, state.published)
                    ? text.status.storedDraftDiffers
                    : text.status.sessionNotice}
                </span>
              </div>
              <div aria-label={text.status.publish} className={styles.publishStatus} role="status">
                <StatusPill
                  label={
                    draftDiffers(state.draft, state.published)
                      ? text.status.readyToPublish
                      : text.status.published
                  }
                  status={
                    draftDiffers(state.draft, state.published) ? "ready-to-publish" : "published"
                  }
                />
                <span>
                  {draftDiffers(state.draft, state.published)
                    ? text.status.draftDiffersDetail
                    : text.status.publishedCurrent}
                </span>
              </div>
            </div>
            <div aria-label={text.status.history} className={styles.historyActions}>
              <Button
                data-editor-history-action="undo"
                disabled={!canUndo || mutationsBlocked}
                onClick={undoEditor}
                variant="quiet"
                title={text.actions.undoTitle}
              >
                {text.actions.undo}
              </Button>
              <Button
                data-editor-history-action="redo"
                disabled={!canRedo || mutationsBlocked}
                onClick={redoEditor}
                variant="quiet"
                title={text.actions.redoTitle}
              >
                {text.actions.redo}
              </Button>
            </div>
            <Button href={previewHref} variant="secondary">
              {text.actions.preview}
            </Button>
            <Button disabled={saveDisabled} onClick={() => void saveDraft()}>
              {saveState.status === "saving" ? text.actions.savingDraft : text.actions.saveDraft}
            </Button>
            {hasUnsavedChanges ? (
              <span aria-disabled="true" className={styles.publishAction}>
                {text.actions.publish}
              </span>
            ) : (
              <Button href={`/projects/${projectId}/publish`} variant="primary">
                {text.actions.publish}
              </Button>
            )}
            <details className={styles.headerOverflow}>
              <summary>{text.actions.more}</summary>
              <div>
                <Button href={previewHref} variant="quiet">
                  {text.actions.openPreview}
                </Button>
              </div>
            </details>
            <div aria-live="polite" aria-atomic="true" className={styles.saveStatus}>
              {saveState.status === "saving" ? <p role="status">{text.feedback.saving}</p> : null}
              {saveState.status === "success" ? <p role="status">{saveState.message}</p> : null}
              {saveState.status === "validation" ||
              saveState.status === "storage" ||
              saveState.status === "stale" ? (
                <p role="alert">{saveState.message}</p>
              ) : null}
              {hasUnsavedChanges && !completeDraftIsValid ? (
                <p role="alert">{text.feedback.saveAttention}</p>
              ) : null}
            </div>
            <p aria-live="polite" aria-atomic="true" className={styles.historyStatus} role="status">
              {historyStatus}
            </p>
          </div>
        }
        locale={locale}
        pageLabel={text.navigation.currentPage}
        pageTitle={title}
        projectId={projectId}
        projectName={state.aggregate.project.name}
      >
        <div aria-label={text.panels.contextual} className={styles.workspaceToolbar}>
          <Button
            aria-controls={compactViewport ? undefined : "editor-workspace-panel"}
            aria-expanded={compactViewport ? outlineDrawerOpen : leftPanelOpen}
            className={compactViewport ? styles.drawerTrigger : undefined}
            onClick={() => {
              if (compactViewport) {
                setOutlineDrawerOpen(true);
                setToolDrawerOpen(false);
                return;
              }
              setLeftPanelOpen((current) => !current);
            }}
            variant="secondary"
          >
            {compactViewport
              ? text.panels.workspace
              : leftPanelOpen
                ? text.panels.collapseWorkspace
                : text.panels.expandWorkspace}
          </Button>
          <Button
            aria-controls={compactViewport ? undefined : "editor-contextual-panel"}
            aria-expanded={compactViewport ? toolDrawerOpen : rightPanelOpen}
            className={compactViewport ? styles.drawerTrigger : undefined}
            onClick={() => {
              if (compactViewport) {
                setToolDrawerOpen(true);
                setOutlineDrawerOpen(false);
                return;
              }
              setRightPanelOpen((current) => !current);
            }}
            variant="secondary"
          >
            {compactViewport
              ? activeToolTab === "ai"
                ? text.tools.openAssistant
                : text.tools.openDesign
              : rightPanelOpen
                ? text.panels.collapseContextual
                : text.panels.expandContextual}
          </Button>
        </div>
        <div
          className={[
            styles.workspace,
            !leftPanelOpen && styles.workspaceLeftCollapsed,
            !rightPanelOpen && styles.workspaceRightCollapsed,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {!compactViewport && leftPanelOpen ? (
            <aside
              aria-label={text.panels.workspace}
              className={styles.sidebar}
              id="editor-workspace-panel"
            >
              <section className={styles.outlineHeader}>
                <p className={styles.eyebrow}>{text.navigation.structure}</p>
                <h2>{text.panels.workspace}</h2>
                <p>{text.navigation.structureHelp}</p>
              </section>
              <Field
                hint={text.navigation.storefrontPageHint}
                id="editor-page"
                label={text.navigation.storefrontPage}
              >
                <select
                  disabled={saving}
                  id="editor-page"
                  onChange={(event) => selectPage(event.target.value)}
                  value={page.id}
                >
                  {state.pages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {editorPageName(item, locale, state.aggregate.project.primaryLocale)}
                    </option>
                  ))}
                </select>
              </Field>
              {outlineList}
              {sectionActions}
              <Link className={styles.previewLink} href={previewHref}>
                {text.navigation.viewSelectedPage}
              </Link>
              {renderDraftSafeguards(false)}
            </aside>
          ) : null}
          <main className={styles.canvas}>
            {showingProposal ? (
              <div className={styles.proposalPreviewLabel} role="status">
                {text.canvas.proposalNotice}
              </div>
            ) : null}
            <VeskifyPuckCanvas
              brandSystem={displayedBrandSystem}
              context={context}
              onPageChange={changePage}
              onSelectedSectionChange={(sectionId) => {
                const nextSectionId =
                  sectionId && page.sections.some((section) => section.id === sectionId)
                    ? sectionId
                    : undefined;
                if (nextSectionId === selectedSectionId) return;
                agent.closeForSelectionChange(nextSectionId);
                setSelectedSectionId(nextSectionId);
              }}
              onValidationError={(message) => {
                if (!savePending.current) setValidationMessage(message);
              }}
              page={canvasPage}
              readOnly={agent.blocksSave || saving}
              readOnlyLabel={showingProposal ? text.canvas.proposal : text.canvas.editor}
              resetKey={resetKeys[canvasPage.id] ?? 0}
              sessionKey={
                agent.generatedProposal?.proposal.id ??
                agent.generatedStorefrontProposal?.id ??
                "active"
              }
              contextualPanel={!compactViewport && rightPanelOpen ? toolRail : undefined}
              compactFieldsTargetId={
                compactViewport && toolDrawerOpen && activeToolTab === "design"
                  ? "editor-compact-design-fields"
                  : undefined
              }
              showDesignFields={!compactViewport && rightPanelOpen && activeToolTab === "design"}
              validationErrorMessage={text.feedback.canvasValidation}
            />
          </main>
        </div>
        <Drawer
          closeLabel={text.actions.close}
          onClose={() => setOutlineDrawerOpen(false)}
          open={outlineDrawerOpen}
          title={text.panels.workspace}
        >
          <div className={styles.drawerContent}>
            {outlineList}
            {sectionActions}
            {compactViewport ? renderDraftSafeguards(true) : null}
          </div>
        </Drawer>
        <Drawer
          closeLabel={text.actions.close}
          onClose={() => setToolDrawerOpen(false)}
          open={toolDrawerOpen}
          title={text.panels.contextual}
        >
          <div className={styles.drawerContent}>
            {toolRail}
            {activeToolTab === "design" ? <div id="editor-compact-design-fields" /> : null}
          </div>
        </Drawer>
      </AppShell>
    </div>
  );
}
