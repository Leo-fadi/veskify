"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  assembleValidatedEditorDraft,
  EditorDraftValidationError,
  saveValidatedEditorDraft,
  StaleEditorDraftError,
} from "@/application/draft-save";
import type { AIProvider } from "@/application/ai-provider";
import type { StorefrontAIProvider } from "@/application/ai-storefront-generation";
import { P10B16P03_PROJECT_ID } from "@/data/demo/p10b-16p-03-studio-identity";
import {
  createServerPromptedStorefrontStudioClient,
  createServerWholeStorefrontPlanningClient,
  ServerWholeStorefrontPlanningClient,
  type PromptedStorefrontStudioClient,
} from "@/integrations/ai/whole-storefront-runtime-client";
import {
  createCatalogueStorefrontCommerceRouteAdapter,
  type CollectionCommerceRoutePresentation,
  type ProductCommerceRoutePresentation,
  type StorefrontCommerceRouteAdapter,
} from "@/integrations/storefront-commerce-routes";
import {
  acceptP905bLocalDemoProposal,
  P905bLocalDemoSynchronizationClientError,
  synchronizeP905bLocalDemoAggregate,
} from "@/integrations/ai/p9-05b-local-demo-client";
import {
  acceptP10bLiveSynthesisProposal,
  P10bLiveSynthesisAcceptanceClientError,
  rejectP10bLiveSynthesisProposal,
  synchronizeP10bLiveSynthesisAggregate,
} from "@/integrations/ai/p10b-live-synthesis-acceptance-client";
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
  type StorefrontRenderContext,
} from "@/components/registry";
import { brandSystemToCssVariables, type BrandSystem } from "@/domain/design-system";
import { resolveLocalizedText, type Locale } from "@/domain/shared";
import type { AiStorefrontProposal } from "@/application/ai-storefront";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  type PageFactEvidenceReference,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import type { CommerceUtilityRuntimeState } from "@/domain/commerce-utility";
import { projectDynamicCommerceArchetypePages } from "@/application/dynamic-commerce-routes";
import { VeskifyPuckCanvas } from "@/integrations/puck/veskify-puck-editor";
import {
  createBrowserProjectRepository,
  DraftConflictError,
  InMemoryProjectRepository,
  IndexedDbProjectRepository,
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
import { storefrontShellCopy } from "@/components/ui/storefront-studio-copy";
import styles from "./project-editor.module.css";
import { DesignAgentPanel } from "./design-agent-panel";
import {
  canonicalPagesEqual,
  composeActiveEditorDraft,
  establishAcceptedAiReceiptClientAuthority,
  projectCanonicalEditorPages,
  proposalCanonicalReviewSnapshot,
  proposalStorefrontPreview,
  reconcileAcceptedAiReceiptClientAuthority,
  type AcceptedAiReceiptClientAuthority,
} from "./editor-draft-state";
import {
  storefrontProposalHistoryStatus,
  useDesignAgentSession,
  type DesignAgentSessionController,
  type DesignAgentTargetScope,
  type PromptedInitialStorefrontDraftAuthority,
} from "./use-design-agent-session";

type RepositoryFactory = () => ProjectRepository;
const defaultCommerceRouteAdapter = createCatalogueStorefrontCommerceRouteAdapter();
const emptyEvidenceReferences: readonly PageFactEvidenceReference[] = [];
type LocalDemoBridgeBase = {
  aggregate: ProjectAggregate;
  proposal: AiStorefrontProposal | null;
  sessionId: string;
  authoritativeRevision: number;
  baselineFingerprint: string;
  evidenceReferences: NonNullable<StorefrontRenderContext["evidenceReferences"]>;
};
type LocalDemoBridge =
  | (LocalDemoBridgeBase & { kind: "p9-05b" })
  | (LocalDemoBridgeBase & {
      kind: "p10b-16l";
      rawDraft: StorefrontSnapshot;
      reviewBaselineFingerprint: string | null;
      persistedAggregate: ProjectAggregate;
    });
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

const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();

function editorPagesFor(
  draft: StorefrontSnapshot,
  catalogue: ProjectAggregate["catalogue"],
  localDemoBridge: LocalDemoBridge | undefined,
  representativeRouteIds: Readonly<Record<string, string>> = {},
): PageModel[] {
  return projectCanonicalEditorPages({
    draft,
    catalogue,
    includeAllLegacyPages: localDemoBridge?.kind === "p10b-16l",
    representativeRouteIds,
  });
}

function p10bLiveHistorySnapshot(
  snapshot: StorefrontSnapshot,
  localDemoBridge: LocalDemoBridge | undefined,
): StorefrontSnapshot {
  return localDemoBridge?.kind === "p10b-16l" &&
    localDemoBridge.reviewBaselineFingerprint !== null &&
    canonicalStorefrontContentFingerprint(snapshot) === localDemoBridge.reviewBaselineFingerprint
    ? structuredClone(localDemoBridge.rawDraft)
    : snapshot;
}

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
    sharedFrame: snapshot.sharedFrame,
    dynamicCommercePresentation: snapshot.dynamicCommercePresentation,
    contentSupportFactDocuments: snapshot.contentSupportFactDocuments,
    catalogueRef: snapshot.catalogueRef,
  };
}

function aggregateWithActiveDraft(
  aggregate: ProjectAggregate,
  activeDraft: StorefrontSnapshot,
): ProjectAggregate {
  const hasSnapshot = aggregate.snapshots.some((snapshot) => snapshot.id === activeDraft.id);
  return {
    ...aggregate,
    project: {
      ...aggregate.project,
      draftSnapshotId: activeDraft.id,
      updatedAt: activeDraft.createdAt,
    },
    snapshots: hasSnapshot
      ? aggregate.snapshots.map((snapshot) =>
          snapshot.id === activeDraft.id ? structuredClone(activeDraft) : snapshot,
        )
      : [...aggregate.snapshots, structuredClone(activeDraft)],
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
  const archetypeNames: Readonly<Record<string, { en: string; fi: string }>> = {
    "collection-editorial-discovery": {
      en: "Editorial collection design archetype",
      fi: "Toimituksellinen kokoelmanäkymä",
    },
    "collection-catalogue-comparison": {
      en: "Catalogue comparison design archetype",
      fi: "Vertaileva kokoelmanäkymä",
    },
    "collection-campaign-led-discovery": {
      en: "Campaign-led collection design archetype",
      fi: "Kampanjavetoinen kokoelmanäkymä",
    },
    "collection-dense-search": {
      en: "Dense collection and search design archetype",
      fi: "Tiivis kokoelma- ja hakunäkymä",
    },
    "pdp-standard-commerce": {
      en: "Standard product-page design archetype",
      fi: "Tavallinen tuotesivumalli",
    },
    "pdp-high-consideration": {
      en: "High-consideration product-page design archetype",
      fi: "Harkitun oston tuotesivumalli",
    },
    "pdp-gallery-led": {
      en: "Gallery-led product-page design archetype",
      fi: "Galleriavetoinen tuotesivumalli",
    },
    "pdp-variant-led": {
      en: "Configurable product-page design archetype",
      fi: "Muunneltavan tuotteen tuotesivumalli",
    },
  };
  if (page.id.startsWith("archetype_")) {
    if (page.id === "archetype_pdp_generic_fallback") {
      return locale === "fi"
        ? "Yleinen turvallinen tuotesivumalli"
        : "Safe generic product-page design archetype";
    }
    const name = page.pageFamily?.profileId ? archetypeNames[page.pageFamily.profileId] : undefined;
    if (name) return name[locale];
  }
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
  designFieldsTargetId,
  id,
  locale,
  onTabChange,
  pageTitle,
  primaryLocale,
  selectedSectionLabel,
  storefrontPageCount,
  onReviewPage,
  onConfirmationDialogOpenChange,
}: {
  activeTab: "design" | "ai";
  controller: DesignAgentSessionController;
  designFieldsTargetId?: string;
  id?: string;
  locale: Locale;
  onTabChange: (tab: "design" | "ai") => void;
  pageTitle: string;
  primaryLocale: Locale;
  selectedSectionLabel?: string;
  storefrontPageCount: number;
  onReviewPage: (pageId: string) => void;
  onConfirmationDialogOpenChange?: (open: boolean) => void;
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
        <>
          <EditorDesignTools locale={locale} selectedSectionLabel={selectedSectionLabel} />
          {designFieldsTargetId ? <div id={designFieldsTargetId} /> : null}
        </>
      ) : (
        <DesignAgentPanel
          controller={controller}
          locale={locale}
          pageTitle={pageTitle}
          primaryLocale={primaryLocale}
          selectedSectionLabel={selectedSectionLabel}
          storefrontPageCount={storefrontPageCount}
          onReviewPage={onReviewPage}
          onConfirmationDialogOpenChange={onConfirmationDialogOpenChange}
        />
      )}
    </section>
  );
}

export function ProjectEditorClient({
  projectId,
  initialDesignAgentTarget,
  initialEvidenceReferences = emptyEvidenceReferences,
  repositoryFactory = defaultRepositoryFactory,
  aiProvider,
  storefrontAiProvider,
  promptedStorefrontClient,
  promptedInitialDraftAuthority,
  p10b16p04Acceptance = false,
  p10b16p04InitialAggregate,
  localDemoBridge,
  commerceRouteAdapter = defaultCommerceRouteAdapter,
}: {
  projectId: string;
  initialDesignAgentTarget?: DesignAgentTargetScope;
  initialEvidenceReferences?: readonly PageFactEvidenceReference[];
  repositoryFactory?: RepositoryFactory;
  aiProvider?: AIProvider;
  storefrontAiProvider?: StorefrontAIProvider;
  promptedStorefrontClient?: PromptedStorefrontStudioClient;
  promptedInitialDraftAuthority?: PromptedInitialStorefrontDraftAuthority;
  /** Safe fingerprint projection used only by the authenticated non-production P04 browser gate. */
  p10b16p04Acceptance?: boolean;
  /** Trusted raw commercial-acceptance input; never contains a generated or designed snapshot. */
  p10b16p04InitialAggregate?: ProjectAggregate;
  localDemoBridge?: LocalDemoBridge;
  commerceRouteAdapter?: StorefrontCommerceRouteAdapter;
}) {
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [proposalAnalytics] = useState(createBrowserProposalAnalyticsSink);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedPageId, setSelectedPageId] = useState<string>();
  const [selectedSectionId, setSelectedSectionId] = useState<string>();
  const [representativeRouteIds, setRepresentativeRouteIds] = useState<Record<string, string>>({});
  const [p10b16p04CartContext, setP10b16p04CartContext] = useState<"empty" | "populated">("empty");
  const [activeLocale, setActiveLocale] = useState<Locale>();
  const [sessionPages, setSessionPages] = useState<Record<string, PageModel>>({});
  const [sessionBrandSystem, setSessionBrandSystem] = useState<BrandSystem>();
  const [sessionStorefrontDraft, setSessionStorefrontDraft] = useState<StorefrontSnapshot>();
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
  const [toolDrawerNestedModalOpen, setToolDrawerNestedModalOpen] = useState(false);
  const [drawerViewport, setDrawerViewport] = useState(false);
  const [importedDemoProposal, setImportedDemoProposal] = useState<AiStorefrontProposal>();
  const [authoritativeRevision, setAuthoritativeRevision] = useState<number | null>(
    localDemoBridge?.authoritativeRevision ?? null,
  );
  const [acceptedReceiptAuthority, setAcceptedReceiptAuthority] =
    useState<AcceptedAiReceiptClientAuthority>();
  const [currentEvidenceReferences, setCurrentEvidenceReferences] = useState<
    readonly PageFactEvidenceReference[]
  >(() => structuredClone(localDemoBridge?.evidenceReferences ?? initialEvidenceReferences));
  const pendingAcceptedReceiptAuthority = useRef<AcceptedAiReceiptClientAuthority | undefined>(
    undefined,
  );
  const savePending = useRef(false);
  const commitCanonicalPageMutation = (update: Parameters<typeof setSessionPages>[0]): void => {
    setAcceptedReceiptAuthority(undefined);
    setSessionPages(update);
  };
  const resolvedStorefrontAiProvider = useMemo(
    () =>
      storefrontAiProvider ??
      createServerWholeStorefrontPlanningClient({
        ...(localDemoBridge?.kind === "p9-05b"
          ? { p905bSessionId: localDemoBridge.sessionId }
          : {}),
      }),
    [localDemoBridge, storefrontAiProvider],
  );
  const resolvedPromptedStorefrontClient = useMemo(
    () =>
      promptedStorefrontClient ??
      (storefrontAiProvider ||
      localDemoBridge ||
      (projectId !== P10B16P03_PROJECT_ID && !p10b16p04Acceptance)
        ? undefined
        : createServerPromptedStorefrontStudioClient()),
    [
      localDemoBridge,
      p10b16p04Acceptance,
      projectId,
      promptedStorefrontClient,
      storefrontAiProvider,
    ],
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 79.99rem)");
    const update = () => setDrawerViewport(media.matches);
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
    const load = async () => {
      const currentRepository = repository.current!;
      if (p10b16p04InitialAggregate) {
        if (!(currentRepository instanceof IndexedDbProjectRepository)) {
          throw new Error(
            "The P04 acceptance composition requires the canonical browser repository.",
          );
        }
        const baselineDraft = p10b16p04InitialAggregate.snapshots.find(
          ({ id }) => id === p10b16p04InitialAggregate.project.draftSnapshotId,
        );
        if (!baselineDraft) {
          throw new Error("The P04 acceptance composition is missing its raw draft.");
        }
        const baselineFingerprint = canonicalStorefrontContentFingerprint(baselineDraft);
        const marker = `veskify:p10b-16p-04:${p10b16p04InitialAggregate.project.id}:${baselineFingerprint}`;
        if (window.sessionStorage.getItem(marker) !== "seeded") {
          await currentRepository.replaceLocalDemoAggregate(p10b16p04InitialAggregate);
          window.sessionStorage.setItem(marker, "seeded");
        }
      }
      if (localDemoBridge) {
        if (!(currentRepository instanceof IndexedDbProjectRepository)) {
          throw new Error("The local demo bridge requires the canonical browser repository.");
        }
        const marker = `veskify:${localDemoBridge.kind}:${localDemoBridge.sessionId}:${localDemoBridge.baselineFingerprint}:${localDemoBridge.authoritativeRevision}`;
        if (window.sessionStorage.getItem(marker) !== "seeded") {
          await currentRepository.replaceLocalDemoAggregate(
            localDemoBridge.kind === "p10b-16l"
              ? localDemoBridge.persistedAggregate
              : localDemoBridge.aggregate,
          );
          window.sessionStorage.setItem(marker, "seeded");
        }
      }
      const persisted = await currentRepository.get(projectId);
      return localDemoBridge?.kind === "p10b-16l" && localDemoBridge.proposal !== null
        ? structuredClone(localDemoBridge.aggregate)
        : persisted;
    };
    void load()
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
          const retainedEvidenceReferences = structuredClone(
            localDemoBridge?.evidenceReferences ?? initialEvidenceReferences,
          );
          const context = createStorefrontRenderContext({
            activeLocale: aggregate.project.primaryLocale,
            primaryLocale: aggregate.project.primaryLocale,
            enabledLocales: aggregate.project.enabledLocales,
            catalogue: aggregate.catalogue,
            snapshot: draft,
            pagePathPrefix: `/projects/${projectId}`,
            evidenceReferences: retainedEvidenceReferences,
          });
          const pages = editorPagesFor(draft, aggregate.catalogue, localDemoBridge);
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
          setRepresentativeRouteIds({});
          setSessionBrandSystem(undefined);
          setSessionStorefrontDraft(undefined);
          setCurrentEvidenceReferences(retainedEvidenceReferences);
          setImportedDemoProposal(localDemoBridge?.proposal ?? undefined);
          setAuthoritativeRevision(localDemoBridge?.authoritativeRevision ?? null);
          setAcceptedReceiptAuthority(undefined);
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
  }, [attempt, initialEvidenceReferences, localDemoBridge, p10b16p04InitialAggregate, projectId]);

  const readyState = state.status === "ready" ? state : undefined;
  const editorDraftBase = sessionStorefrontDraft ?? readyState?.draft;
  const editorDraftPages =
    editorDraftBase && readyState
      ? editorPagesFor(
          editorDraftBase,
          readyState.aggregate.catalogue,
          localDemoBridge,
          representativeRouteIds,
        )
      : [];
  const readyOriginalPage =
    editorDraftPages.find((item) => item.id === selectedPageId) ?? editorDraftPages[0];
  const readyPage = readyOriginalPage
    ? (sessionPages[readyOriginalPage.id] ?? readyOriginalPage)
    : undefined;
  const readyLocale = activeLocale ?? readyState?.aggregate.project.primaryLocale;
  const activeDraft = readyState
    ? composeActiveEditorDraft({
        draft: editorDraftBase ?? readyState.draft,
        sessionPages,
        brandSystem: sessionBrandSystem,
      })
    : undefined;
  const visiblePages =
    activeDraft && readyState
      ? editorPagesFor(
          activeDraft,
          readyState.aggregate.catalogue,
          localDemoBridge,
          representativeRouteIds,
        )
      : [];
  const readyContext =
    readyState && readyLocale && activeDraft
      ? createStorefrontRenderContext({
          activeLocale: readyLocale,
          primaryLocale: readyState.aggregate.project.primaryLocale,
          enabledLocales: readyState.aggregate.project.enabledLocales,
          catalogue: readyState.aggregate.catalogue,
          snapshot: activeDraft,
          pagePathPrefix: `/projects/${projectId}`,
          evidenceReferences: currentEvidenceReferences,
        })
      : undefined;
  const agent = useDesignAgentSession({
    lifecycleKey: `${projectId}:${attempt}`,
    projectId,
    initialTargetScope: initialDesignAgentTarget,
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
    storefrontProvider: resolvedStorefrontAiProvider,
    promptedStorefrontClient: resolvedPromptedStorefrontClient,
    promptedInitialDraftAuthority,
    currentEvidenceReferencesForStorefrontProposal:
      resolvedStorefrontAiProvider instanceof ServerWholeStorefrontPlanningClient
        ? (proposalId) =>
            resolvedStorefrontAiProvider.currentEvidenceReferencesForProposal(proposalId)
        : undefined,
    initialStorefrontProposal: importedDemoProposal,
    controlledStorefrontAcceptance: localDemoBridge?.kind === "p10b-16l",
    analytics: proposalAnalytics,
    analyticsRoute: `/projects/${projectId}/editor`,
    onStorefrontEvidenceAuthority: (evidenceReferences) =>
      setCurrentEvidenceReferences(structuredClone(evidenceReferences)),
    onAcceptedPage: (acceptedPage) => {
      const committedPage =
        editorHistory?.commit(acceptedPage, "Apply design proposal") ??
        structuredClone(acceptedPage);
      commitCanonicalPageMutation((current) => ({
        ...current,
        [acceptedPage.id]: committedPage,
      }));
      setValidationMessage("");
      setHistoryStatus("Proposal applied. You can undo this change.");
      setPageEditsAfterStorefront((current) => (agent.canUndoStorefront ? current + 1 : current));
      setSaveState({ status: "idle" });
      setResetKeys((current) => ({
        ...current,
        [acceptedPage.id]: (current[acceptedPage.id] ?? 0) + 1,
      }));
    },
    onStorefrontAccepted: async ({ proposalId, acceptedSnapshot }) => {
      pendingAcceptedReceiptAuthority.current = undefined;
      if (!localDemoBridge) return;
      if (authoritativeRevision === null || !readyState) {
        throw new P905bLocalDemoSynchronizationClientError("stale", 409);
      }
      if (localDemoBridge.kind === "p9-05b") {
        const acceptance = await acceptP905bLocalDemoProposal({
          projectId,
          sessionId: localDemoBridge.sessionId,
          proposalId,
          acceptanceActionId: `acceptance_action_${canonicalValueFingerprint({
            sessionId: localDemoBridge.sessionId,
            proposalId,
            authoritativeRevision,
          }).slice(-32)}`,
          expectedAuthorityRevision: authoritativeRevision,
          expectedProjectRevision: readyState.aggregate.project.revision,
          expectedDraftId: readyState.draft.id,
          expectedDraftRevision: readyState.draft.revision,
        });
        setAuthoritativeRevision(acceptance.authoritativeRevision);
        pendingAcceptedReceiptAuthority.current = establishAcceptedAiReceiptClientAuthority(
          acceptance.receiptId,
          acceptedSnapshot,
        );
        return;
      }
      const acceptance = await acceptP10bLiveSynthesisProposal({
        projectId,
        sessionId: localDemoBridge.sessionId,
        proposalId,
        expectedRevision: authoritativeRevision,
        acceptedSnapshot,
      });
      setAuthoritativeRevision(acceptance.authoritativeRevision);
    },
    onStorefrontRejected:
      localDemoBridge?.kind === "p10b-16l"
        ? async ({ proposalId }) => {
            if (authoritativeRevision === null) return;
            const rejection = await rejectP10bLiveSynthesisProposal({
              projectId,
              sessionId: localDemoBridge.sessionId,
              proposalId,
              expectedRevision: authoritativeRevision,
            });
            setAuthoritativeRevision(rejection.authoritativeRevision);
            window.location.reload();
          }
        : undefined,
    projectStorefrontHistorySnapshot: (snapshot) =>
      p10bLiveHistorySnapshot(snapshot, localDemoBridge),
    onStorefrontHistorySnapshot: async (snapshot) => {
      if (!localDemoBridge) return;
      if (authoritativeRevision === null || !readyState) {
        throw new P905bLocalDemoSynchronizationClientError("stale", 409);
      }
      const synchronization = await (localDemoBridge.kind === "p9-05b"
        ? synchronizeP905bLocalDemoAggregate({
            projectId,
            sessionId: localDemoBridge.sessionId,
            expectedRevision: authoritativeRevision,
            mode: "active",
            aggregate: aggregateWithActiveDraft(readyState.aggregate, snapshot),
          })
        : synchronizeP10bLiveSynthesisAggregate({
            projectId,
            sessionId: localDemoBridge.sessionId,
            expectedRevision: authoritativeRevision,
            mode: "active",
            aggregate: aggregateWithActiveDraft(readyState.aggregate, snapshot),
          }));
      setAuthoritativeRevision(synchronization.authoritativeRevision);
    },
    onStorefrontSnapshot: (snapshot, scope, action, transition) => {
      if (!readyState) return;
      const authoritativeSnapshot = p10bLiveHistorySnapshot(snapshot, localDemoBridge);
      setAcceptedReceiptAuthority(
        action === "applied" ? pendingAcceptedReceiptAuthority.current : undefined,
      );
      pendingAcceptedReceiptAuthority.current = undefined;
      setSessionPages({});
      setSessionBrandSystem(undefined);
      setSessionStorefrontDraft(structuredClone(authoritativeSnapshot));
      const authoritativePages = editorPagesFor(
        authoritativeSnapshot,
        readyState.aggregate.catalogue,
        localDemoBridge,
        representativeRouteIds,
      );
      // Current evidence is established independently by the server/session authority. Snapshot
      // fact references are retained provenance and may never authorize their own rendering.
      const authoritativeEvidenceReferences = structuredClone(currentEvidenceReferences);
      const authoritativeContext = createStorefrontRenderContext({
        activeLocale: readyLocale ?? readyState.aggregate.project.primaryLocale,
        primaryLocale: readyState.aggregate.project.primaryLocale,
        enabledLocales: readyState.aggregate.project.enabledLocales,
        catalogue: readyState.aggregate.catalogue,
        snapshot: authoritativeSnapshot,
        pagePathPrefix: `/projects/${projectId}`,
        evidenceReferences: authoritativeEvidenceReferences,
      });
      authoritativePages.forEach((snapshotPage) =>
        validateRegisteredPage(snapshotPage, authoritativeContext),
      );
      if (transition.replaceEditorHistory || !editorHistory) {
        const nextHistory = new CanonicalEditorHistory({
          validatePage: (snapshotPage) =>
            validateRegisteredPage(snapshotPage, authoritativeContext),
        });
        authoritativePages.forEach((snapshotPage) => nextHistory.initialize(snapshotPage));
        setEditorHistory(nextHistory);
      } else {
        authoritativePages.forEach((snapshotPage) => editorHistory.rebase(snapshotPage));
      }
      setCurrentEvidenceReferences(authoritativeEvidenceReferences);
      setResetKeys((current) =>
        Object.fromEntries(
          authoritativePages.map((snapshotPage) => [
            snapshotPage.id,
            (current[snapshotPage.id] ?? 0) + 1,
          ]),
        ),
      );
      setSelectedPageId((current) =>
        current && authoritativePages.some((item) => item.id === current)
          ? current
          : (authoritativePages.find((item) => item.type === "home")?.id ??
            authoritativePages[0]?.id),
      );
      setSelectedSectionId((current) =>
        current &&
        authoritativePages.some((item) => item.sections.some((section) => section.id === current))
          ? current
          : undefined,
      );
      setValidationMessage("");
      setHistoryStatus(
        resolveLocalizedText(
          storefrontProposalHistoryStatus(scope, action),
          readyLocale ?? "en",
          readyState.aggregate.project.primaryLocale,
        ),
      );
      setPageEditsAfterStorefront(0);
      setSaveState({ status: "idle" });
    },
  });

  const usableAcceptedReceiptAuthority = reconcileAcceptedAiReceiptClientAuthority(
    acceptedReceiptAuthority,
    activeDraft,
  );

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

  const originalPage = readyOriginalPage;
  const page = readyPage!;
  const previewStorefront = proposalStorefrontPreview({
    proposal: agent.generatedStorefrontProposal,
    previewActive: agent.previewActive,
    visibleState: agent.visibleState,
  });
  const proposalReviewSnapshot = proposalCanonicalReviewSnapshot({
    proposal: agent.generatedStorefrontProposal,
    previewActive: agent.previewActive,
    visibleState: agent.visibleState,
    acceptanceBaseline: activeDraft!,
  });
  const showingProposal =
    (agent.generatedProposal !== null || previewStorefront !== undefined) &&
    agent.previewActive &&
    (agent.visibleState === "proposalReady" || agent.visibleState === "accepting");
  const displayedDraft = proposalReviewSnapshot ?? activeDraft!;
  const displayedPages = proposalReviewSnapshot
    ? editorPagesFor(
        proposalReviewSnapshot,
        state.aggregate.catalogue,
        undefined,
        representativeRouteIds,
      )
    : visiblePages;
  const workspacePage =
    displayedPages.find(({ id }) => id === selectedPageId) ??
    displayedPages.find(({ type }) => type === "home") ??
    displayedPages[0] ??
    page;
  const currentPageHasUnsavedChanges = !canonicalPagesEqual(page, originalPage);
  const hasUnsavedChanges =
    canonicalStorefrontContentFingerprint(activeDraft!) !==
    canonicalStorefrontContentFingerprint(state.draft);
  const locale = readyLocale!;
  const dynamicAuthority = displayedDraft.dynamicCommercePresentation;
  const selectedArchetypeProjection = dynamicAuthority
    ? projectDynamicCommerceArchetypePages(
        displayedDraft,
        state.aggregate.catalogue,
        representativeRouteIds,
      ).find(({ page: projectedPage }) => projectedPage.id === workspacePage.id)
    : undefined;
  const selectedArchetype = selectedArchetypeProjection?.archetype;
  const representativeRoutes = selectedArchetype
    ? dynamicAuthority!.routeInventory.filter((route) =>
        selectedArchetype.family === "product-detail"
          ? route.kind === "product"
          : route.kind === "collection",
      )
    : [];
  const selectedRepresentativeRoute = representativeRoutes.find(
    ({ id }) => id === selectedArchetypeProjection?.representativeRouteId,
  );
  const title = resolveLocalizedText(
    workspacePage.title,
    locale,
    state.aggregate.project.primaryLocale,
  );
  const pageRepeatsProjectName =
    title.trim().localeCompare(state.aggregate.project.name.trim(), locale, {
      sensitivity: "accent",
    }) === 0;
  const identity = storefrontShellCopy[locale];
  const displayedRenderContext = proposalReviewSnapshot
    ? createStorefrontRenderContext({
        activeLocale: locale,
        primaryLocale: state.aggregate.project.primaryLocale,
        enabledLocales: state.aggregate.project.enabledLocales,
        catalogue: state.aggregate.catalogue,
        snapshot: proposalReviewSnapshot,
        pagePathPrefix: `/projects/${projectId}`,
        evidenceReferences: currentEvidenceReferences,
      })
    : readyContext!;
  const context = {
    ...displayedRenderContext,
    onLocaleChange: (nextLocale: Locale) => {
      if (nextLocale !== locale) agent.closeForLocaleChange();
      setActiveLocale(nextLocale);
    },
  };
  const previewHref = `/projects/${projectId}${workspacePage.slug === "/" ? "" : workspacePage.slug}${
    localDemoBridge?.kind === "p10b-16l"
      ? `?p10b-16l-session=${encodeURIComponent(localDemoBridge.sessionId)}`
      : ""
  }`;
  const displayedBrandSystem = previewStorefront?.brandSystem ?? activeDraft!.brandSystem;
  const style = brandSystemToCssVariables(displayedBrandSystem) as CSSProperties;
  const canvasPage =
    (showingProposal ? agent.generatedProposal?.proposal.proposedPage : undefined) ??
    (proposalReviewSnapshot
      ? workspacePage
      : previewStorefront?.pages.find((item) => item.id === page.id)) ??
    workspacePage;
  const canvasCollection =
    canvasPage.type === "collection"
      ? state.aggregate.catalogue.collections.find(
          (collection) => canvasPage.slug === `/collections/${collection.slug}`,
        )
      : undefined;
  const canvasProductId =
    canvasPage.pageFamily?.commerceContext?.kind === "product"
      ? canvasPage.pageFamily.commerceContext.productId
      : undefined;
  const canvasProduct = canvasProductId
    ? state.aggregate.catalogue.products.find(({ id }) => id === canvasProductId)
    : undefined;
  const p10b16p04CartRuntime: CommerceUtilityRuntimeState | undefined = (() => {
    if (
      !p10b16p04Acceptance ||
      !canvasPage.sections.some(
        (section) => section.component === "commerceUtility" && section.variant === "cart",
      )
    ) {
      return undefined;
    }
    if (p10b16p04CartContext === "empty") {
      return {
        kind: "cart",
        revision: "p10b16p04-cart-empty-v1",
        lines: [],
        actions: ["continue-shopping"],
      };
    }
    const product = state.aggregate.catalogue.products.find(
      (candidate) => candidate.id === "product_sisu_automatic_watch",
    );
    if (!product?.price) return undefined;
    return {
      kind: "cart",
      revision: "p10b16p04-cart-populated-v1",
      lines: [
        {
          lineId: "p10b16p04-cart-line-sisu",
          productId: product.id,
          quantity: 1,
          minimumQuantity: 1,
          maximumQuantity: 3,
          unitPrice: product.price,
          linePrice: product.price,
        },
      ],
      subtotal: product.price,
      total: product.price,
      actions: ["change-quantity", "remove-line", "continue-shopping"],
    };
  })();
  const canvasContext = p10b16p04CartRuntime
    ? {
        ...context,
        commerceUtilityRuntime: p10b16p04CartRuntime,
        // The acceptance composition proves the existing typed action boundary without
        // introducing or persisting operational cart state.
        onCommerceUtilityIntent: () => undefined,
      }
    : context;
  let canvasCollectionPresentation: CollectionCommerceRoutePresentation | undefined;
  let canvasCollectionPresentationInvalid = false;
  if (canvasCollection) {
    try {
      canvasCollectionPresentation =
        commerceRouteAdapter.collection({
          aggregate: state.aggregate,
          snapshot: displayedDraft,
          page: canvasPage,
          collection: canvasCollection,
        }) ?? undefined;
    } catch {
      canvasCollectionPresentationInvalid = true;
    }
  }
  let canvasProductPresentation: ProductCommerceRoutePresentation | undefined;
  let canvasProductPresentationInvalid =
    canvasPage.type === "product" &&
    canvasPage.sections.some(({ component }) => component === "dynamicProductDetail") &&
    !canvasProduct;
  if (canvasProduct) {
    try {
      canvasProductPresentation =
        commerceRouteAdapter.product({
          aggregate: state.aggregate,
          snapshot: displayedDraft,
          page: canvasPage,
          product: canvasProduct,
          evidenceReferences: currentEvidenceReferences,
        }) ?? undefined;
      canvasProductPresentationInvalid = canvasProductPresentation === undefined;
    } catch {
      canvasProductPresentationInvalid = true;
    }
  }
  const selectedSection = selectedSectionId
    ? workspacePage.sections.find((section) => section.id === selectedSectionId)
    : undefined;
  let completeDraftIsValid = false;
  if (hasUnsavedChanges) {
    try {
      assembleValidatedEditorDraft({
        baseDraft: state.draft,
        replacementSnapshot: activeDraft!,
        aggregate: state.aggregate,
        primaryLocale: state.aggregate.project.primaryLocale,
        evidenceReferences: currentEvidenceReferences,
      });
      completeDraftIsValid = true;
    } catch {
      completeDraftIsValid = false;
    }
  }
  const localAcceptanceProposalPending =
    localDemoBridge?.kind === "p10b-16l" &&
    localDemoBridge.proposal !== null &&
    authoritativeRevision === localDemoBridge.authoritativeRevision;
  const proposalBlocksSave = agent.blocksSave || localAcceptanceProposalPending;
  const previewBlocked =
    localDemoBridge?.kind === "p10b-16l" && (proposalBlocksSave || hasUnsavedChanges);
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
    commitCanonicalPageMutation((current) => ({
      ...current,
      [nextPage.id]: structuredClone(nextPage),
    }));
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
    commitCanonicalPageMutation((current) => ({ ...current, [nextPage.id]: committedPage }));
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

  const undoEditor = async () => {
    if (mutationsBlocked) return false;
    if (currentPageCanUndo && pageEditsAfterStorefront > 0) return undoCurrentPage();
    if (canUndoStorefront) {
      const undone = await agent.undoStorefront();
      return undone;
    }
    return undoCurrentPage();
  };

  const redoEditor = async () => {
    if (mutationsBlocked) return false;
    if (agent.canRedoStorefront) {
      const redone = await agent.redoStorefront();
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
    const nextOriginalPage = displayedPages.find((candidate) => candidate.id === nextPageId);
    const nextPage = nextOriginalPage
      ? proposalReviewSnapshot
        ? nextOriginalPage
        : (sessionPages[nextOriginalPage.id] ?? nextOriginalPage)
      : undefined;
    if (!nextPage || nextPage.id === workspacePage.id) return;
    if (!proposalReviewSnapshot) agent.closeForPageSwitch(nextPage);
    setSelectedPageId(nextPageId);
    setSelectedSectionId(undefined);
    setValidationMessage("");
    setHistoryStatus("");
  };

  const selectRepresentativeContext = (routeId: string) => {
    if (!selectedArchetypeProjection || savePending.current) return;
    const nextRepresentativeRouteIds = {
      ...representativeRouteIds,
      [selectedArchetypeProjection.archetype.id]: routeId,
    };
    const nextProjection = projectDynamicCommerceArchetypePages(
      displayedDraft,
      state.aggregate.catalogue,
      nextRepresentativeRouteIds,
    ).find(({ page: projectedPage }) => projectedPage.id === workspacePage.id);
    if (!nextProjection) return;
    setRepresentativeRouteIds(nextRepresentativeRouteIds);
    if (!proposalReviewSnapshot) {
      setSessionPages((current) => ({
        ...current,
        [nextProjection.page.id]: structuredClone(nextProjection.page),
      }));
      editorHistory?.rebase(nextProjection.page);
    }
    remountPage(nextProjection.page.id);
    setSelectedSectionId(undefined);
    setValidationMessage("");
    setHistoryStatus(
      locale === "fi"
        ? "Edustava esikatselukohde vaihtui. Valinta ei muuta luonnosta."
        : "Representative preview context changed. This selection does not change the draft.",
    );
  };

  const selectSection = (nextSectionId: string) => {
    if (savePending.current || mutationsBlocked) return;
    if (!workspacePage.sections.some((section) => section.id === nextSectionId)) return;
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
    commitCanonicalPageMutation((current) => {
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
        visiblePages.flatMap((baselinePage) =>
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

  const representativeContextControls = selectedArchetypeProjection ? (
    <Card className={styles.sectionActions} data-testid="dynamic-commerce-representative-context">
      <p className={styles.eyebrow}>
        {locale === "fi" ? "Edustava esikatselu" : "Representative preview"}
      </p>
      <h2>
        {selectedArchetype?.family === "product-detail"
          ? locale === "fi"
            ? "Näytä tuote tällä tuotesivumallilla"
            : "Preview a product with this archetype"
          : locale === "fi"
            ? "Näytä kokoelma tällä kokoelmamallilla"
            : "Preview a collection with this archetype"}
      </h2>
      <p>
        {locale === "fi"
          ? "Valinta vaihtaa vain esikatselun tietoja. Se ei luo tuote- tai kokoelmakohtaista ulkoasua eikä tallennu luonnokseen."
          : "This changes preview data only. It does not create a product- or collection-specific design and is not saved to the draft."}
      </p>
      {selectedArchetype?.family === "collection-search" &&
      selectedArchetype.supportedContexts.includes("search") ? (
        <p data-testid="dynamic-commerce-search-unavailable">
          {locale === "fi"
            ? "Haun esitystapa kuuluu tähän malliin, mutta haun suoritus ei ole vielä käytettävissä. Alla näkyy vain edustava kokoelmakonteksti — ei hakutuloksia."
            : "Search presentation belongs to this archetype, but search execution is not yet available. The representative preview below shows collection context only — not search results."}
        </p>
      ) : null}
      <Field
        id="dynamic-commerce-representative-route"
        label={
          selectedArchetype?.family === "product-detail"
            ? locale === "fi"
              ? "Edustava tuote"
              : "Representative product"
            : locale === "fi"
              ? "Edustava kokoelma"
              : "Representative collection"
        }
      >
        <select
          id="dynamic-commerce-representative-route"
          onChange={(event) => selectRepresentativeContext(event.target.value)}
          value={selectedArchetypeProjection.representativeRouteId}
        >
          {representativeRoutes.map((route) => {
            const commerceLabel =
              route.kind === "product"
                ? state.aggregate.catalogue.products.find(({ id }) => id === route.productId)?.title
                : route.kind === "collection"
                  ? state.aggregate.catalogue.collections.find(
                      ({ id }) => id === route.collectionId,
                    )?.title
                  : undefined;
            return (
              <option data-route={route.route} key={route.id} value={route.id}>
                {commerceLabel
                  ? resolveLocalizedText(
                      commerceLabel,
                      locale,
                      state.aggregate.project.primaryLocale,
                    )
                  : locale === "fi"
                    ? "Kokoelma ei saatavilla"
                    : "Collection unavailable"}
              </option>
            );
          })}
        </select>
        {selectedRepresentativeRoute ? (
          <span className={styles.representativeRoute} data-testid="representative-route-path">
            {selectedRepresentativeRoute.route}
          </span>
        ) : null}
      </Field>
    </Card>
  ) : null;

  const p10b16p04UtilityContextControls =
    p10b16p04Acceptance && p10b16p04CartRuntime ? (
      <Card className={styles.sectionActions}>
        <p className={styles.eyebrow}>Visual acceptance context</p>
        <h2>Read-only cart presentation</h2>
        <p>
          Switch the transient acceptance context without changing the storefront draft or canonical
          commerce.
        </p>
        <div className={styles.sectionActionButtons}>
          <Button
            data-testid="p10b16p04-utility-empty"
            onClick={() => setP10b16p04CartContext("empty")}
            variant={p10b16p04CartContext === "empty" ? "primary" : "secondary"}
          >
            Empty cart
          </Button>
          <Button
            data-testid="p10b16p04-utility-populated"
            onClick={() => setP10b16p04CartContext("populated")}
            variant={p10b16p04CartContext === "populated" ? "primary" : "secondary"}
          >
            Populated cart
          </Button>
        </div>
      </Card>
    ) : null;

  const productTypeMappingList = dynamicAuthority ? (
    <Card className={styles.sectionActions} data-testid="dynamic-commerce-product-type-mappings">
      <p className={styles.eyebrow}>
        {locale === "fi" ? "Tuotetyyppien esitystapa" : "Product-type presentation"}
      </p>
      <h2>
        {locale === "fi" ? "Tuotesivumallien määritykset" : "Product-page archetype mappings"}
      </h2>
      <ul>
        {dynamicAuthority.productTypeMappings.map((mapping) => {
          const productType = state.aggregate.catalogue.products.find(
            (product) =>
              canonicalProductTypePresentationId(product.productType) === mapping.productTypeId,
          )?.productType;
          const archetypePage = displayedPages.find(({ id }) => id === mapping.archetypeId);
          return (
            <li key={mapping.productTypeId}>
              <strong>
                {productType ??
                  (locale === "fi" ? "Tuntematon tuotetyyppi" : "Unknown product type")}
              </strong>
              {" → "}
              {archetypePage
                ? editorPageName(archetypePage, locale, state.aggregate.project.primaryLocale)
                : locale === "fi"
                  ? "Yleinen turvallinen tuotesivumalli"
                  : "Safe generic product-page archetype"}
            </li>
          );
        })}
      </ul>
      <p>
        {locale === "fi"
          ? "Uudet ja tuntemattomat tuotetyypit käyttävät hallittua yleistä varamallia."
          : "New and unknown product types use the governed generic fallback."}
      </p>
    </Card>
  ) : null;

  const outlineList = (
    <ol aria-label={text.navigation.outline} className={styles.outlineList}>
      {displayedPages.map((item) => {
        const itemIsCurrent = item.id === workspacePage.id;
        const itemPage = proposalReviewSnapshot ? item : (sessionPages[item.id] ?? item);
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
              <strong>{merchantEditorSectionLabel(workspacePage, selectedSection, locale)}</strong>
              <span>{selectedSection.visible ? text.section.visible : text.section.hidden}</span>
            </p>
            <div className={styles.sectionActionButtons}>
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

  const renderToolRail = (designFieldsTargetId?: string) => (
    <EditorToolRail
      activeTab={activeToolTab}
      controller={agent}
      designFieldsTargetId={designFieldsTargetId}
      id="editor-contextual-panel"
      locale={locale}
      onTabChange={setActiveToolTab}
      pageTitle={title}
      primaryLocale={state.aggregate.project.primaryLocale}
      selectedSectionLabel={
        selectedSection
          ? merchantEditorSectionLabel(workspacePage, selectedSection, locale)
          : undefined
      }
      storefrontPageCount={displayedPages.length}
      onConfirmationDialogOpenChange={setToolDrawerNestedModalOpen}
      onReviewPage={(pageId) => {
        const candidate = displayedPages.find((item) => item.id === pageId);
        if (!candidate || candidate.id === workspacePage.id) return;
        if (!proposalReviewSnapshot) agent.closeForPageSwitch(candidate);
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
    const capturedActiveDraft = structuredClone(activeDraft!);
    savePending.current = true;
    setSaveState({ status: "saving" });
    try {
      // Construct the exact validated saved candidate without touching browser storage.
      // The authoritative session must accept this candidate before local persistence.
      const stagingRepository = new InMemoryProjectRepository([state.aggregate]);
      const prepared = await saveValidatedEditorDraft({
        repository: stagingRepository,
        projectId,
        loadedDraft: capturedDraft,
        replacementSnapshot: capturedActiveDraft,
        primaryLocale: state.aggregate.project.primaryLocale,
        evidenceReferences: currentEvidenceReferences,
      });
      if (localDemoBridge) {
        if (authoritativeRevision === null) {
          throw new P905bLocalDemoSynchronizationClientError("stale", 409);
        }
        const synchronization = await (localDemoBridge.kind === "p9-05b"
          ? synchronizeP905bLocalDemoAggregate({
              projectId,
              sessionId: localDemoBridge.sessionId,
              expectedRevision: authoritativeRevision,
              mode: "saved",
              aggregate: prepared.aggregate,
            })
          : synchronizeP10bLiveSynthesisAggregate({
              projectId,
              sessionId: localDemoBridge.sessionId,
              expectedRevision: authoritativeRevision,
              mode: "saved",
              aggregate: prepared.aggregate,
            }));
        setAuthoritativeRevision(synchronization.authoritativeRevision);
      }
      await repository.current!.saveDraft(projectId, prepared.draft, {
        id: capturedDraft.id,
        revision: capturedDraft.revision,
      });
      const persistedAggregate = await repository.current!.get(projectId);
      const persistedDraft = persistedAggregate.snapshots.find(
        (snapshot) => snapshot.id === persistedAggregate.project.draftSnapshotId,
      );
      if (!persistedDraft || persistedDraft.id !== prepared.draft.id) {
        throw new StaleEditorDraftError();
      }
      const result = { aggregate: persistedAggregate, draft: persistedDraft };
      const published = result.aggregate.snapshots.find(
        (snapshot) => snapshot.id === result.aggregate.project.publishedSnapshotId,
      );
      if (!published) throw new EditorDraftValidationError();
      const pages = editorPagesFor(
        result.draft,
        result.aggregate.catalogue,
        localDemoBridge,
        representativeRouteIds,
      );
      pages.forEach((savedPage) => editorHistory?.rebase(savedPage));
      setState({
        status: "ready",
        aggregate: result.aggregate,
        draft: result.draft,
        published,
        pages,
      });
      setAcceptedReceiptAuthority(undefined);
      setSessionPages((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([pageId, sessionPage]) => {
            const savedPage = pages.find((item) => item.id === pageId);
            return !savedPage || !canonicalPagesEqual(sessionPage, savedPage);
          }),
        ),
      );
      setSessionBrandSystem(undefined);
      setSessionStorefrontDraft(undefined);
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
      if (
        error instanceof StaleEditorDraftError ||
        error instanceof DraftConflictError ||
        (error instanceof P905bLocalDemoSynchronizationClientError && error.category === "stale") ||
        (error instanceof P10bLiveSynthesisAcceptanceClientError && error.category === "stale")
      ) {
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
      {...(p10b16p04Acceptance
        ? {
            "data-p10b16p04-active-draft-fingerprint": canonicalStorefrontContentFingerprint(
              activeDraft!,
            ),
          }
        : {})}
      lang={locale}
      style={style}
    >
      <AppShell
        activeModule="editor"
        editorMode
        showModuleNav={false}
        showModuleIdentity={false}
        headerActions={
          <div className={styles.draftActions}>
            <section
              aria-label={locale === "fi" ? "Muokkaussisällön konteksti" : "Editor context"}
              className={styles.editorContext}
              data-testid="editor-context"
            >
              <p className={styles.editorContextStudio}>{identity.studio}</p>
              <p className={styles.editorContextPage}>
                <span>{state.aggregate.project.name}</span>
                {!pageRepeatsProjectName ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <strong>{title}</strong>
                  </>
                ) : null}
              </p>
            </section>
            <fieldset className={styles.headerLocale}>
              <legend>{locale === "fi" ? "Kieli" : "Language"}</legend>
              {state.aggregate.project.enabledLocales.map((enabledLocale) => (
                <label key={enabledLocale}>
                  <input
                    checked={locale === enabledLocale}
                    disabled={
                      agent.controlledStorefrontAcceptance &&
                      agent.generatedStorefrontProposal !== null
                    }
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
                <span className={styles.statusDetail}>
                  {hasUnsavedChanges ? text.status.unsaved : text.status.noUnsaved}
                </span>
                <span className={styles.statusDetail}>
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
                <span className={styles.statusDetail}>
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
                onClick={() => void undoEditor()}
                variant="quiet"
                title={text.actions.undoTitle}
              >
                {text.actions.undo}
              </Button>
              <Button
                data-editor-history-action="redo"
                disabled={!canRedo || mutationsBlocked}
                onClick={() => void redoEditor()}
                variant="quiet"
                title={text.actions.redoTitle}
              >
                {text.actions.redo}
              </Button>
            </div>
            <div aria-label={text.panels.contextual} className={styles.workspacePanelActions}>
              <Button
                aria-controls={drawerViewport ? undefined : "editor-workspace-panel"}
                aria-expanded={drawerViewport ? outlineDrawerOpen : leftPanelOpen}
                onClick={() => {
                  if (drawerViewport) {
                    setOutlineDrawerOpen(true);
                    setToolDrawerOpen(false);
                    return;
                  }
                  setLeftPanelOpen((current) => !current);
                }}
                variant="secondary"
              >
                {drawerViewport
                  ? text.panels.workspace
                  : leftPanelOpen
                    ? text.panels.collapseWorkspace
                    : text.panels.expandWorkspace}
              </Button>
              <Button
                aria-controls={drawerViewport ? undefined : "editor-contextual-panel"}
                aria-expanded={drawerViewport ? toolDrawerOpen : rightPanelOpen}
                onClick={() => {
                  if (drawerViewport) {
                    setToolDrawerOpen(true);
                    setOutlineDrawerOpen(false);
                    return;
                  }
                  setRightPanelOpen((current) => !current);
                }}
                variant="secondary"
              >
                {drawerViewport
                  ? activeToolTab === "ai"
                    ? text.tools.openAssistant
                    : text.tools.openDesign
                  : rightPanelOpen
                    ? text.panels.collapseContextual
                    : text.panels.expandContextual}
              </Button>
            </div>
            {previewBlocked ? (
              <span aria-disabled="true" className={styles.publishAction}>
                {text.actions.preview}
              </span>
            ) : (
              <Button href={previewHref} variant="secondary">
                {text.actions.preview}
              </Button>
            )}
            <Button disabled={saveDisabled} onClick={() => void saveDraft()}>
              {saveState.status === "saving" ? text.actions.savingDraft : text.actions.saveDraft}
            </Button>
            {proposalBlocksSave || (hasUnsavedChanges && !usableAcceptedReceiptAuthority) ? (
              <span aria-disabled="true" className={styles.publishAction}>
                {text.actions.publish}
              </span>
            ) : (
              <Button
                href={
                  localDemoBridge?.kind === "p9-05b"
                    ? `/projects/${projectId}/publish?p9-05b-session=${encodeURIComponent(localDemoBridge.sessionId)}${usableAcceptedReceiptAuthority ? `&accepted-receipt=${encodeURIComponent(usableAcceptedReceiptAuthority.receiptId)}` : ""}`
                    : `/projects/${projectId}/publish`
                }
                variant="primary"
              >
                {text.actions.publish}
              </Button>
            )}
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
        projectId={projectId}
      >
        <div
          className={[
            styles.workspace,
            !leftPanelOpen && styles.workspaceLeftCollapsed,
            !rightPanelOpen && styles.workspaceRightCollapsed,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {!drawerViewport && leftPanelOpen ? (
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
                  value={workspacePage.id}
                >
                  {displayedPages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {editorPageName(item, locale, state.aggregate.project.primaryLocale)}
                    </option>
                  ))}
                </select>
              </Field>
              {representativeContextControls}
              {p10b16p04UtilityContextControls}
              {productTypeMappingList}
              {outlineList}
              {sectionActions}
              {previewBlocked ? (
                <span aria-disabled="true" className={styles.previewLink}>
                  {text.navigation.viewSelectedPage}
                </span>
              ) : (
                <Link className={styles.previewLink} href={previewHref}>
                  {text.navigation.viewSelectedPage}
                </Link>
              )}
              {renderDraftSafeguards(false)}
            </aside>
          ) : null}
          <main className={styles.canvas}>
            {showingProposal ? (
              <div className={styles.proposalPreviewLabel} role="status">
                {text.canvas.proposalNotice}
              </div>
            ) : null}
            {canvasCollectionPresentationInvalid || canvasProductPresentationInvalid ? (
              <section
                aria-label={text.canvas.editor}
                className={styles.validationMessage}
                role="alert"
              >
                {canvasProductPresentationInvalid
                  ? text.feedback.canvasValidation
                  : text.feedback.collectionProjectionUnavailable}
              </section>
            ) : (
              <VeskifyPuckCanvas
                brandSystem={displayedBrandSystem}
                context={canvasContext}
                onPageChange={changePage}
                onSelectedSectionChange={(sectionId) => {
                  const nextSectionId =
                    sectionId && workspacePage.sections.some((section) => section.id === sectionId)
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
                contextualPanel={undefined}
                compactFieldsTargetId={
                  activeToolTab === "design" &&
                  ((drawerViewport && toolDrawerOpen) || (!drawerViewport && rightPanelOpen))
                    ? drawerViewport
                      ? "editor-compact-design-fields"
                      : "editor-design-fields"
                    : undefined
                }
                collectionPresentation={canvasCollectionPresentation}
                productPresentation={canvasProductPresentation}
                showDesignFields={false}
                validationErrorMessage={text.feedback.canvasValidation}
              />
            )}
          </main>
          {!drawerViewport && rightPanelOpen ? renderToolRail("editor-design-fields") : null}
        </div>
        <Drawer
          closeLabel={text.actions.close}
          onClose={() => setOutlineDrawerOpen(false)}
          open={outlineDrawerOpen}
          title={text.panels.workspace}
        >
          <div className={styles.drawerContent}>
            {representativeContextControls}
            {p10b16p04UtilityContextControls}
            {productTypeMappingList}
            {outlineList}
            {sectionActions}
            {drawerViewport ? renderDraftSafeguards(true) : null}
          </div>
        </Drawer>
        <Drawer
          closeLabel={text.actions.close}
          closeOnEscape={!toolDrawerNestedModalOpen}
          onClose={() => setToolDrawerOpen(false)}
          open={toolDrawerOpen}
          title={text.panels.contextual}
        >
          <div className={styles.drawerContent}>
            {renderToolRail(
              activeToolTab === "design" ? "editor-compact-design-fields" : undefined,
            )}
          </div>
        </Drawer>
      </AppShell>
    </div>
  );
}
