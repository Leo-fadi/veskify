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
import { AppShell, Button, Card, Drawer, Field, Notice, StatusPill, Tabs } from "@/components/ui";
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
  const text =
    locale === "fi"
      ? {
          heading: "Design",
          intro: "Muokkaa valitun osion sisältöä ja ulkoasua työskentelyalueella.",
          select: "Valitse osio sivulta nähdäksesi sen säätimet.",
          groups: ["Asettelu", "Sisältö", "Väri", "Typografia", "Väljyys", "Muoto", "Näkyvyys"],
        }
      : {
          heading: "Design",
          intro: "Edit the selected section's content and appearance in the workspace.",
          select: "Select a section on the canvas to see its controls.",
          groups: ["Layout", "Content", "Colour", "Typography", "Spacing", "Shape", "Visibility"],
        };

  return (
    <div className={styles.designTools}>
      <Card className={styles.toolCard}>
        <p className={styles.eyebrow}>{text.heading}</p>
        <h2>{selectedSectionLabel ?? text.select}</h2>
        <p>{text.intro}</p>
        <Notice variant="info">{selectedSectionLabel ? text.intro : text.select}</Notice>
      </Card>
      <div
        aria-label={locale === "fi" ? "Design-säätimet" : "Design controls"}
        className={styles.designGroups}
      >
        {text.groups.map((group, index) => (
          <details key={group} open={index === 0}>
            <summary>{group}</summary>
            <p>{selectedSectionLabel ? text.intro : text.select}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

function EditorToolRail({
  activeTab,
  controller,
  locale,
  onTabChange,
  pageTitle,
  primaryLocale,
  selectedSectionLabel,
  storefrontPageCount,
}: {
  activeTab: "design" | "ai";
  controller: DesignAgentSessionController;
  locale: Locale;
  onTabChange: (tab: "design" | "ai") => void;
  pageTitle: string;
  primaryLocale: Locale;
  selectedSectionLabel?: string;
  storefrontPageCount: number;
}) {
  return (
    <section aria-label="Editor tools" className={styles.toolRail}>
      <Tabs
        items={[
          {
            active: activeTab === "design",
            id: "design",
            label: locale === "fi" ? "Design" : "Design",
          },
          {
            active: activeTab === "ai",
            id: "ai",
            label: locale === "fi" ? "Suunnitteluavustaja" : "AI assistant",
          },
        ]}
        label={locale === "fi" ? "Muokkaustyökalut" : "Editor tools"}
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
  const status =
    saveState.status === "saving"
      ? "saving"
      : hasUnsavedChanges
        ? "unsaved"
        : draftDiffers(state.draft, state.published)
          ? "draft-different"
          : "saved";
  const statusLabel =
    locale === "fi"
      ? status === "saving"
        ? "Tallennetaan"
        : status === "unsaved"
          ? "Tallentamattomia muutoksia"
          : status === "draft-different"
            ? "Luonnos eroaa julkaistusta"
            : "Tallennettu"
      : status === "saving"
        ? "Saving draft"
        : status === "unsaved"
          ? "Unsaved changes"
          : status === "draft-different"
            ? "Draft differs from published"
            : "Saved";

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
      setValidationMessage("That section cannot be duplicated safely.");
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
      setValidationMessage("That section must remain visible on this page.");
    }
  };

  const outlineList = (
    <ol
      aria-label={locale === "fi" ? "Sivut ja osiot" : "Pages and sections"}
      className={styles.outlineList}
    >
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
                {itemPage.sections.length} {locale === "fi" ? "osiota" : "sections"}
              </small>
            </button>
            {itemIsCurrent ? (
              <ol className={styles.outlineSections}>
                {itemPage.sections.map((section) => (
                  <li key={section.id}>
                    <button
                      aria-current={section.id === selectedSectionId ? "step" : undefined}
                      aria-label={`${merchantEditorSectionLabel(itemPage, section, locale)} — ${section.visible ? (locale === "fi" ? "Näkyvä" : "Visible") : locale === "fi" ? "Piilotettu" : "Hidden"}`}
                      className={styles.outlineSection}
                      disabled={saving}
                      onClick={() => selectSection(section.id)}
                      type="button"
                    >
                      <span>{merchantEditorSectionLabel(itemPage, section, locale)}</span>
                      <small>
                        {section.visible
                          ? locale === "fi"
                            ? "Näkyvä"
                            : "Visible"
                          : locale === "fi"
                            ? "Piilotettu"
                            : "Hidden"}
                      </small>
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
    <Card aria-label="Selected section actions" className={styles.sectionActions}>
      <details open>
        <summary>{locale === "fi" ? "Osion toiminnot" : "Section options"}</summary>
        <h2>{locale === "fi" ? "Valittu osio" : "Selected section"}</h2>
        {selectedSection ? (
          <>
            <p>
              <strong>{merchantEditorSectionLabel(page, selectedSection, locale)}</strong>
              <span>
                {selectedSection.visible
                  ? locale === "fi"
                    ? "Näkyvä"
                    : "Visible"
                  : locale === "fi"
                    ? "Piilotettu"
                    : "Hidden"}
              </span>
            </p>
            <div>
              <Button
                disabled={!canDuplicateSection(selectedSection) || mutationsBlocked}
                onClick={duplicateSelectedSection}
                variant="secondary"
              >
                {locale === "fi" ? "Monista" : "Duplicate"}
              </Button>
              <Button
                disabled={!canToggleSectionVisibility(selectedSection) || mutationsBlocked}
                onClick={toggleSelectedSection}
                variant="secondary"
              >
                {selectedSection.visible
                  ? locale === "fi"
                    ? "Piilota"
                    : "Hide"
                  : locale === "fi"
                    ? "Näytä"
                    : "Show"}
              </Button>
            </div>
            {!canDuplicateSection(selectedSection) ||
            !canToggleSectionVisibility(selectedSection) ? (
              <p>
                {locale === "fi"
                  ? "Pakollinen osio pysyy näkyvissä ja voi esiintyä vain kerran."
                  : "This required section must remain visible and can only appear once."}
              </p>
            ) : null}
          </>
        ) : (
          <p>{locale === "fi" ? "Valitse osio sivulta." : "Select a section on the canvas."}</p>
        )}
      </details>
    </Card>
  );

  const toolRail = (
    <EditorToolRail
      activeTab={activeToolTab}
      controller={agent}
      locale={locale}
      onTabChange={setActiveToolTab}
      pageTitle={title}
      primaryLocale={state.aggregate.project.primaryLocale}
      selectedSectionLabel={
        selectedSection ? merchantEditorSectionLabel(page, selectedSection, locale) : undefined
      }
      storefrontPageCount={activeDraft!.pages.length}
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
      setHistoryStatus("Draft saved. Undo remains available and will create new unsaved work.");
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
      <AppShell
        activeModule="editor"
        editorMode
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
              <div aria-label="Draft status" className={styles.draftStatus} role="status">
                <StatusPill label={statusLabel} live status={status} />
                <span>{hasUnsavedChanges ? "Unsaved changes" : "No unsaved changes"}</span>
                <span>
                  {draftDiffers(state.draft, state.published)
                    ? "The stored draft differs from the published storefront."
                    : "Changes stay in this editor session until saved."}
                </span>
              </div>
              <div aria-label="Publish status" className={styles.publishStatus} role="status">
                <StatusPill
                  label={
                    draftDiffers(state.draft, state.published)
                      ? locale === "fi"
                        ? "Valmis julkaistavaksi"
                        : "Ready to publish"
                      : locale === "fi"
                        ? "Julkaistu"
                        : "Published"
                  }
                  status={
                    draftDiffers(state.draft, state.published) ? "ready-to-publish" : "published"
                  }
                />
                <span>
                  {draftDiffers(state.draft, state.published)
                    ? locale === "fi"
                      ? "Luonnos eroaa julkaistusta kaupasta."
                      : "Draft differs from published storefront."
                    : locale === "fi"
                      ? "Julkaistu tila on ajan tasalla."
                      : "Published storefront is up to date."}
                </span>
              </div>
            </div>
            <div aria-label="Edit history" className={styles.historyActions}>
              <Button
                data-editor-history-action="undo"
                disabled={!canUndo || mutationsBlocked}
                onClick={undoEditor}
                variant="quiet"
                title="Undo (Ctrl or Command + Z)"
              >
                Undo
              </Button>
              <Button
                data-editor-history-action="redo"
                disabled={!canRedo || mutationsBlocked}
                onClick={redoEditor}
                variant="quiet"
                title="Redo (Ctrl or Command + Shift + Z)"
              >
                Redo
              </Button>
            </div>
            <Button href={previewHref} variant="secondary">
              {locale === "fi" ? "Esikatsele kauppaa" : "Preview storefront"}
            </Button>
            <Button disabled={saveDisabled} onClick={() => void saveDraft()}>
              {saveState.status === "saving" ? "Saving draft…" : "Save draft"}
            </Button>
            {hasUnsavedChanges ? (
              <span aria-disabled="true" className={styles.publishAction}>
                {locale === "fi" ? "Julkaise muutokset" : "Publish changes"}
              </span>
            ) : (
              <Button href={`/projects/${projectId}/publish`} variant="primary">
                {locale === "fi" ? "Julkaise muutokset" : "Publish changes"}
              </Button>
            )}
            <details className={styles.headerOverflow}>
              <summary>{locale === "fi" ? "Lisää" : "More"}</summary>
              <div>
                <Button href={previewHref} variant="quiet">
                  {locale === "fi" ? "Avaa esikatselu" : "Open preview"}
                </Button>
              </div>
            </details>
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
            <p aria-live="polite" aria-atomic="true" className={styles.historyStatus} role="status">
              {historyStatus}
            </p>
          </div>
        }
        pageLabel={locale === "fi" ? "Nykyinen sivu" : "Current page"}
        pageTitle={title}
        projectId={projectId}
        projectName={state.aggregate.project.name}
      >
        <div className={styles.workspaceToolbar}>
          <Button
            className={styles.drawerTrigger}
            onClick={() => {
              setOutlineDrawerOpen(true);
              setToolDrawerOpen(false);
            }}
            variant="secondary"
          >
            {locale === "fi" ? "Sivut ja osiot" : "Pages & sections"}
          </Button>
          <Button
            className={styles.drawerTrigger}
            onClick={() => {
              setToolDrawerOpen(true);
              setOutlineDrawerOpen(false);
            }}
            variant="secondary"
          >
            {activeToolTab === "ai"
              ? locale === "fi"
                ? "Avaa suunnitteluavustaja"
                : "Open AI assistant"
              : locale === "fi"
                ? "Avaa design-työkalut"
                : "Open design tools"}
          </Button>
        </div>
        <div className={styles.workspace}>
          {!compactViewport ? (
            <aside aria-label="Editor controls" className={styles.sidebar}>
              <section className={styles.outlineHeader}>
                <p className={styles.eyebrow}>{locale === "fi" ? "Rakenne" : "Structure"}</p>
                <h2>{locale === "fi" ? "Sivut ja osiot" : "Pages & sections"}</h2>
                <p>
                  {locale === "fi"
                    ? "Valitse sivu ja sen osio työskentelyä varten."
                    : "Choose a page and section to work on."}
                </p>
              </section>
              <Field
                hint="Homepage, collection and product pages use their approved sections."
                id="editor-page"
                label="Storefront page"
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
                View selected page
              </Link>
              {renderDraftSafeguards(false)}
            </aside>
          ) : null}
          <main className={styles.canvas}>
            {showingProposal ? (
              <div className={styles.proposalPreviewLabel} role="status">
                Proposal preview — your current page is unchanged
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
              readOnlyLabel={showingProposal ? "Proposal preview canvas" : "Visual editor canvas"}
              resetKey={resetKeys[canvasPage.id] ?? 0}
              sessionKey={
                agent.generatedProposal?.proposal.id ??
                agent.generatedStorefrontProposal?.id ??
                "active"
              }
            />
          </main>
          {!compactViewport ? toolRail : null}
        </div>
        <Drawer
          closeLabel={locale === "fi" ? "Sulje" : "Close"}
          onClose={() => setOutlineDrawerOpen(false)}
          open={outlineDrawerOpen}
          title={locale === "fi" ? "Sivut ja osiot" : "Pages & sections"}
        >
          <div className={styles.drawerContent}>
            {outlineList}
            {sectionActions}
            {compactViewport ? renderDraftSafeguards(true) : null}
          </div>
        </Drawer>
        <Drawer
          closeLabel={locale === "fi" ? "Sulje" : "Close"}
          onClose={() => setToolDrawerOpen(false)}
          open={toolDrawerOpen}
          title={locale === "fi" ? "Muokkaustyökalut" : "Editor tools"}
        >
          <div className={styles.drawerContent}>{toolRail}</div>
        </Drawer>
      </AppShell>
    </div>
  );
}
