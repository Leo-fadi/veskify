"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AiProposalConfirmationOrchestrator,
  type AiProposalConfirmationResult,
} from "@/application/ai-proposal-confirmation";
import {
  AiProposalGenerationOrchestrator,
  type AiProposalEditorIdentity,
  type AiProposalGenerationEvent,
  type AiProposalGenerationResult,
  type GeneratedAiProposal,
} from "@/application/ai-proposal-generation";
import {
  AiStorefrontGenerationOrchestrator,
  buildAiStorefrontProviderRequestForSupportedCapability,
  createStorefrontDiagnosticAttemptId,
  createDeterministicMockStorefrontAIProvider,
  hasExplicitStorefrontSectionIntent,
  recordStorefrontDiagnostic,
  resolveStorefrontGenerationScope,
  type AiStorefrontGenerationFailure,
  type AiStorefrontGenerationIdentity,
  type StorefrontGenerationScope,
  type StorefrontAIProvider,
} from "@/application/ai-storefront-generation";
import {
  CanonicalStorefrontHistory,
  StorefrontProposalAcceptanceCoordinator,
  projectAiStorefrontSnapshot,
  validateAiStorefrontProposal,
  type AiStorefrontProposal,
} from "@/application/ai-storefront";
import { createDeterministicMockAIProvider, type AIProvider } from "@/application/ai-provider";
import {
  noopProposalAnalyticsSink,
  type ProposalAnalyticsEvent,
  type ProposalAnalyticsSink,
} from "@/application/analytics";
import { InMemoryDesignProposalStore } from "@/application/design-operations";
import {
  classifyRevisionInstruction,
  minimalRevisionRequest,
} from "@/application/design-agent/revisions";
import { createDeterministicDesignProvider } from "@/application/design-skills";
import { validateRegisteredSnapshot, type StorefrontRenderContext } from "@/components/registry";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { BrandSystem } from "@/domain/design-system";
import { resolveLocalizedText, type Locale, type LocalizedText } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  type PageFactEvidenceReference,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
  PROMPTED_STOREFRONT_STUDIO_OPERATION,
  promptedStorefrontStudioGenerationRequestSchema,
  type PromptedStorefrontStudioGenerationLineage,
} from "@/application/prompted-storefront-studio";
import {
  PromptedStorefrontStudioClientAbortedError,
  PromptedStorefrontStudioClientError,
  type PromptedStorefrontRuntimeStage,
  type PromptedStorefrontStudioClient,
} from "@/integrations/ai/whole-storefront-runtime-client";

export type DesignAgentTargetScope = "section" | "page" | "storefront";
type ResolvedStorefrontWorkflowScope = StorefrontGenerationScope["kind"];
export type StorefrontProposalHistoryAction = "applied" | "undone" | "redone";
type ValidatedStorefrontProposalScope = AiStorefrontProposal["target"]["scope"];
export type PromptedInitialStorefrontDraftAuthority = Readonly<{
  draftSnapshotId: string;
  draftRevision: number;
  contentFingerprint: string;
}>;

export function storefrontMinimalRevisionInstruction(
  locale: Locale,
  scope: ResolvedStorefrontWorkflowScope,
) {
  if (scope === "homepage") {
    return locale === "fi"
      ? "Uudista vain etusivu moderniksi tekniseksi ja pelkistetyksi. Säilytä tuotteet, hinnat, varasto, mediasidonnat, reitit ja hyväksytyt aineistot. Älä muuta kokoelma- tai tuotesivua."
      : "Redesign only the homepage in a modern technical, minimal Nordic direction. Preserve products, prices, stock, media bindings, routes, and approved assets. Do not change the collection page or product page.";
  }
  return locale === "fi"
    ? "Käytä pelkistettyä pohjoismaista väri- ja typografiailmettä koko sivustolla."
    : "Use a minimal Nordic colour and typography direction throughout the site.";
}

export type ProposalReviewUiState =
  | "idle"
  | "needsClarification"
  | "generating"
  | "proposalReady"
  | "revising"
  | "accepting"
  | "accepted"
  | "rejected"
  | "closed"
  | "failed"
  | "stale"
  | "superseded";

export type PromptedStorefrontGenerationStage =
  | "idle"
  | "preparing-authority"
  | "requesting-design-intent"
  | "validating-intent"
  | "compiling-design"
  | "materializing-proposal"
  | "proposal-ready"
  | "failed"
  | "stale"
  | "superseded";

export type ProposalReviewUiSession = {
  state: ProposalReviewUiState;
  status: LocalizedText;
  selectedSectionId: string | null;
  affectedSectionIds: string[];
  assumptions: LocalizedText[];
  clarificationQuestion: LocalizedText | null;
  failure: { message: LocalizedText; retryable: boolean } | null;
};

export function storefrontFailureDiagnosticCategory(
  code: AiStorefrontGenerationFailure["code"],
): Parameters<typeof recordStorefrontDiagnostic>[0]["category"] {
  switch (code) {
    case "staleDraft":
      return "staleDraft";
    case "staleTarget":
      return "staleTarget";
    case "unsupportedRequest":
      return "unsupportedRequest";
    case "providerUnavailable":
      return "providerUnavailable";
    case "authenticationUnavailable":
      return "authenticationUnavailable";
    case "permissionDenied":
      return "permissionDenied";
    case "projectMismatch":
      return "projectMismatch";
    case "tenantMismatch":
      return "tenantMismatch";
    case "internalFailure":
      return "internalFailure";
    case "superseded":
      return "superseded";
    case "validationFailed":
    case "invalidCommand":
    case "assetCapabilityUnavailable":
      return "validation";
  }
}

export type DesignAgentSessionController = {
  targetScope: DesignAgentTargetScope;
  selectTarget: (target: DesignAgentTargetScope) => void;
  selectedSectionEligible: boolean;
  request: string;
  setRequest: (request: string) => void;
  clarificationAnswer: string;
  setClarificationAnswer: (answer: string) => void;
  revision: string;
  setRevision: (revision: string) => void;
  session: ProposalReviewUiSession | null;
  generatedProposal: GeneratedAiProposal | null;
  generatedStorefrontProposal: AiStorefrontProposal | null;
  visibleState: ProposalReviewUiState;
  statusMessage: string;
  previewActive: boolean;
  blocksSave: boolean;
  controlsDisabled: boolean;
  generationRetryAvailable: boolean;
  promptedInitialGeneration?: boolean;
  promptedProposalActive?: boolean;
  promptedGenerationStage?: PromptedStorefrontGenerationStage;
  promptedGenerationLineage?: PromptedStorefrontStudioGenerationLineage | null;
  controlledStorefrontAcceptance: boolean;
  canUndoStorefront: boolean;
  canRedoStorefront: boolean;
  submitRequest: () => void;
  retryGeneration: () => void;
  answerClarification: () => void;
  reviseProposal: () => void;
  regenerateProposal: () => void;
  acceptProposal: () => void;
  rejectProposal: () => void;
  cancelSession: () => void;
  restartSession: () => void;
  closeForPageSwitch: (nextPage: PageModel) => void;
  closeForPageMutation: (nextPage: PageModel) => void;
  closeForSelectionChange: (nextSectionId?: string) => void;
  closeForLocaleChange: () => void;
  undoStorefront: () => boolean | Promise<boolean>;
  redoStorefront: () => boolean | Promise<boolean>;
  clearStorefrontHistory: () => void;
};

type UseDesignAgentSessionInput = {
  lifecycleKey: string;
  projectId: string;
  initialTargetScope?: DesignAgentTargetScope;
  draftSnapshotId?: string;
  draftRevision?: number;
  page?: PageModel;
  activeLocale?: Locale;
  primaryLocale?: Locale;
  enabledLocales?: Locale[];
  brandSystem?: BrandSystem;
  displayContext?: StorefrontRenderContext;
  selectedSectionId?: string;
  activeDraft?: StorefrontSnapshot;
  storedDraft?: StorefrontSnapshot;
  publishedSnapshot?: StorefrontSnapshot;
  catalogue?: CatalogueDisplayModel;
  initialStorefrontProposal?: AiStorefrontProposal;
  controlledStorefrontAcceptance?: boolean;
  disabled: boolean;
  provider?: AIProvider;
  storefrontProvider?: StorefrontAIProvider;
  promptedStorefrontClient?: PromptedStorefrontStudioClient;
  promptedInitialDraftAuthority?: PromptedInitialStorefrontDraftAuthority;
  currentEvidenceReferencesForStorefrontProposal?: (
    proposalId: string,
  ) => readonly PageFactEvidenceReference[];
  analytics?: ProposalAnalyticsSink;
  analyticsRoute?: string;
  onProposalReady?: () => void;
  onStorefrontEvidenceAuthority?: (
    evidenceReferences: readonly PageFactEvidenceReference[],
  ) => void;
  onAcceptedPage: (page: PageModel) => void;
  onStorefrontAccepted?: (input: {
    proposalId: string;
    acceptedSnapshot: StorefrontSnapshot;
  }) => Promise<void>;
  onStorefrontRejected?: (input: { proposalId: string }) => Promise<void>;
  projectStorefrontHistorySnapshot?: (snapshot: StorefrontSnapshot) => StorefrontSnapshot;
  onStorefrontHistorySnapshot?: (snapshot: StorefrontSnapshot) => Promise<void>;
  onStorefrontSnapshot: (
    snapshot: StorefrontSnapshot,
    scope: ValidatedStorefrontProposalScope,
    action: StorefrontProposalHistoryAction,
    transition: Readonly<{ replaceEditorHistory: boolean }>,
  ) => void;
};

const statuses = {
  idle: { en: "Ready for a design request.", fi: "Valmis uuteen suunnittelupyyntöön." },
  generating: {
    en: "Preparing the design proposal.",
    fi: "Valmistellaan suunnitteluehdotusta.",
  },
  revising: {
    en: "Preparing the revised proposal.",
    fi: "Valmistellaan muokattua ehdotusta.",
  },
  ready: {
    en: "The proposal is ready to review.",
    fi: "Ehdotus on valmis tarkistettavaksi.",
  },
  regenerated: {
    en: "A regenerated proposal is ready to review.",
    fi: "Uudelleen luotu ehdotus on valmis tarkistettavaksi.",
  },
  accepting: {
    en: "Applying the validated proposal to your draft.",
    fi: "Validoitua ehdotusta sovelletaan luonnokseen.",
  },
  accepted: {
    en: "The proposal was accepted for draft application.",
    fi: "Ehdotus hyväksyttiin luonnokseen sovellettavaksi.",
  },
  rejected: {
    en: "The proposal was rejected; the page remains unchanged.",
    fi: "Ehdotus hylättiin ja sivu säilyy ennallaan.",
  },
  closed: {
    en: "The request was cancelled; the page remains unchanged.",
    fi: "Pyyntö peruttiin ja sivu säilyy ennallaan.",
  },
  pageSwitch: {
    en: "The previous request was closed because you opened another page.",
    fi: "Edellinen pyyntö suljettiin, koska avasit toisen sivun.",
  },
  stale: {
    en: "The page changed after this request started. Start a new request from the current page.",
    fi: "Sivu muuttui pyynnön aloittamisen jälkeen. Aloita uusi pyyntö nykyiseltä sivulta.",
  },
  empty: {
    en: "Describe the storefront change you want before creating a proposal.",
    fi: "Kuvaile haluamasi kauppamuutos ennen ehdotuksen luomista.",
  },
  localeSwitch: {
    en: "The language changed while the proposal was being prepared. Submit the request again in the current language.",
    fi: "Kieli vaihtui ehdotuksen valmistelun aikana. Lähetä pyyntö uudelleen nykyisellä kielellä.",
  },
  contextSwitch: {
    en: "The page or selected section changed. Submit the preserved request again for the current selection.",
    fi: "Sivu tai valittu osio vaihtui. Lähetä säilytetty pyyntö uudelleen nykyiselle valinnalle.",
  },
  targetSwitch: {
    en: "The previous request was replaced because you chose a different target.",
    fi: "Edellinen pyyntö korvattiin, koska valitsit toisen kohteen.",
  },
  controlledAcceptance: {
    en: "This controlled proposal stays ready until you accept or reject it.",
    fi: "Tämä valvottu ehdotus säilyy tarkistettavana, kunnes hyväksyt tai hylkäät sen.",
  },
} satisfies Record<string, LocalizedText>;

const promptedGenerationStatuses = {
  idle: statuses.idle,
  "preparing-authority": {
    en: "Checking the current storefront authority.",
    fi: "Tarkistetaan verkkokaupan nykyinen auktoriteetti.",
  },
  "requesting-design-intent": {
    en: "Creating a bounded storefront design intent.",
    fi: "Luodaan rajattua verkkokaupan suunnitteluaikomusta.",
  },
  "validating-intent": {
    en: "Validating the storefront design intent.",
    fi: "Validoidaan verkkokaupan suunnitteluaikomusta.",
  },
  "compiling-design": {
    en: "Compiling the design through current storefront authority.",
    fi: "Kootaan suunnitelmaa verkkokaupan nykyisen auktoriteetin kautta.",
  },
  "materializing-proposal": {
    en: "Materializing the complete storefront proposal.",
    fi: "Muodostetaan koko verkkokaupan ehdotusta.",
  },
  "proposal-ready": statuses.ready,
  failed: {
    en: "The storefront could not be generated safely. Your draft has not changed.",
    fi: "Verkkokauppaa ei voitu luoda turvallisesti. Luonnos säilyi ennallaan.",
  },
  stale: {
    en: "The storefront authority changed during generation. Your draft has not changed.",
    fi: "Verkkokaupan auktoriteetti muuttui luonnin aikana. Luonnos säilyi ennallaan.",
  },
  superseded: {
    en: "The generation was superseded by a newer editor context. Your draft has not changed.",
    fi: "Uudempi muokkauskonteksti korvasi luonnin. Luonnos säilyi ennallaan.",
  },
} satisfies Record<PromptedStorefrontGenerationStage, LocalizedText>;

export function storefrontProposalHistoryStatus(
  scope: ValidatedStorefrontProposalScope,
  action: StorefrontProposalHistoryAction,
): LocalizedText {
  const target =
    scope === "page"
      ? { en: "homepage proposal", fi: "Etusivuehdotus" }
      : { en: "entire-storefront proposal", fi: "Koko verkkokaupan ehdotus" };
  switch (action) {
    case "applied":
      return {
        en: `The ${target.en} was applied as one unsaved draft change.`,
        fi: `${target.fi} lisättiin yhtenä tallentamattomana luonnosmuutoksena.`,
      };
    case "undone":
      return {
        en: `Undid the ${target.en} as one change.`,
        fi: `${target.fi} kumottiin yhtenä muutoksena.`,
      };
    case "redone":
      return {
        en: `Redid the ${target.en} as one change.`,
        fi: `${target.fi} tehtiin uudelleen yhtenä muutoksena.`,
      };
  }
}

type Runtime = ReturnType<typeof createRuntime>;

function createRuntimeBridge(
  initialAnalytics: ProposalAnalyticsSink,
  initialAnalyticsRoute: string,
) {
  let identity: AiProposalEditorIdentity | null = null;
  let storefrontIdentity: AiStorefrontGenerationIdentity | null = null;
  let analytics = initialAnalytics;
  let analyticsRoute = initialAnalyticsRoute;
  return {
    currentIdentity: () => {
      if (!identity) throw new Error("The current editor identity is unavailable.");
      return structuredClone(identity);
    },
    currentStorefrontIdentity: () => {
      if (!storefrontIdentity) throw new Error("The current storefront identity is unavailable.");
      return structuredClone(storefrontIdentity);
    },
    recordGenerationEvent: (event: AiProposalGenerationEvent) => {
      try {
        analytics.track({
          name: event.name,
          projectId: event.projectId,
          timestamp: new Date().toISOString(),
          route: analyticsRoute,
          targetId: event.sectionId ?? event.pageId,
          ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
        });
      } catch {
        // Observability cannot control proposal state.
      }
    },
    updateAnalytics(next: ProposalAnalyticsSink, nextRoute: string) {
      analytics = next;
      analyticsRoute = nextRoute;
    },
    updateIdentity(next: AiProposalEditorIdentity | null) {
      identity = next ? structuredClone(next) : null;
    },
    bindStorefrontIdentity(next: AiStorefrontGenerationIdentity) {
      storefrontIdentity = structuredClone(next);
    },
    updateStorefrontContext(next: AiStorefrontGenerationIdentity["context"] | null) {
      storefrontIdentity =
        next && storefrontIdentity
          ? { context: structuredClone(next), target: storefrontIdentity.target }
          : next
            ? null
            : null;
    },
  };
}

function createRuntime(
  currentIdentity: () => AiProposalEditorIdentity,
  currentStorefrontIdentity: () => AiStorefrontGenerationIdentity,
  recordGenerationEvent: (event: AiProposalGenerationEvent) => void,
  provider: AIProvider,
  storefrontProvider: StorefrontAIProvider,
) {
  const proposalStore = new InMemoryDesignProposalStore();
  return {
    proposalStore,
    provider,
    storefrontProvider,
    clarificationProvider: createDeterministicDesignProvider(),
    generation: new AiProposalGenerationOrchestrator({
      currentIdentity,
      proposalStore,
      analytics: { record: recordGenerationEvent },
    }),
    confirmation: new AiProposalConfirmationOrchestrator({ proposalStore, currentIdentity }),
    storefrontGeneration: new AiStorefrontGenerationOrchestrator({
      currentIdentity: currentStorefrontIdentity,
    }),
  };
}

function affectedSectionIds(operations: readonly unknown[]) {
  return [
    ...new Set(
      operations.flatMap((operation) =>
        operation &&
        typeof operation === "object" &&
        "sectionId" in operation &&
        typeof operation.sectionId === "string"
          ? [operation.sectionId]
          : [],
      ),
    ),
  ];
}

function uiSession(
  state: ProposalReviewUiState,
  status: LocalizedText,
  options: Partial<Omit<ProposalReviewUiSession, "state" | "status">> = {},
): ProposalReviewUiSession {
  return {
    state,
    status,
    selectedSectionId: options.selectedSectionId ?? null,
    affectedSectionIds: options.affectedSectionIds ?? [],
    assumptions: options.assumptions ?? [],
    clarificationQuestion: options.clarificationQuestion ?? null,
    failure: options.failure ?? null,
  };
}

function tryProjectAiStorefrontSnapshot(snapshot: StorefrontSnapshot) {
  try {
    return projectAiStorefrontSnapshot(snapshot);
  } catch {
    return null;
  }
}

export function useDesignAgentSession({
  lifecycleKey,
  projectId,
  initialTargetScope = "page",
  draftSnapshotId,
  draftRevision,
  page,
  activeLocale,
  primaryLocale,
  enabledLocales,
  brandSystem,
  displayContext,
  selectedSectionId,
  activeDraft,
  storedDraft,
  publishedSnapshot,
  catalogue,
  initialStorefrontProposal,
  controlledStorefrontAcceptance = false,
  disabled,
  provider,
  storefrontProvider,
  promptedStorefrontClient,
  promptedInitialDraftAuthority,
  currentEvidenceReferencesForStorefrontProposal,
  analytics = noopProposalAnalyticsSink,
  analyticsRoute = `/projects/${projectId}/editor`,
  onProposalReady,
  onStorefrontEvidenceAuthority,
  onAcceptedPage,
  onStorefrontAccepted,
  onStorefrontRejected,
  projectStorefrontHistorySnapshot,
  onStorefrontHistorySnapshot,
  onStorefrontSnapshot,
}: UseDesignAgentSessionInput): DesignAgentSessionController {
  const actionSequence = useRef(0);
  const acceptancePending = useRef(false);
  const generationPending = useRef(false);
  const promptedGenerationAbort = useRef<AbortController | null>(null);
  const clarificationRequest = useRef<{ instruction: string; useOriginal: boolean } | null>(null);
  const merchantInstruction = useRef("");
  const lastGenerationInstruction = useRef("");
  const lastGenerationScope = useRef<DesignAgentTargetScope>("page");
  const lastResolvedStorefrontScope = useRef<ResolvedStorefrontWorkflowScope | null>(null);
  const targetExplicitlySelected = useRef(false);
  const initialLifecycle = useRef(true);
  const pendingStorefrontAcceptance = useRef<StorefrontProposalAcceptanceCoordinator | null>(null);
  const acceptedStorefrontHistory = useRef<CanonicalStorefrontHistory | null>(null);
  const acceptedStorefrontHistoryFingerprint = useRef<string | null>(null);
  const acceptedStorefrontProposalScopes = useRef(
    new Map<string, ValidatedStorefrontProposalScope>(),
  );
  const [runtimeBridge] = useState(() => createRuntimeBridge(analytics, analyticsRoute));
  const [runtime] = useState<Runtime>(() =>
    createRuntime(
      runtimeBridge.currentIdentity,
      runtimeBridge.currentStorefrontIdentity,
      runtimeBridge.recordGenerationEvent,
      provider ?? createDeterministicMockAIProvider(),
      storefrontProvider ?? createDeterministicMockStorefrontAIProvider(),
    ),
  );
  const [targetScope, setTargetScope] = useState<DesignAgentTargetScope>(initialTargetScope);
  const [request, setRequest] = useState("");
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [revision, setRevision] = useState("");
  const [session, setSession] = useState<ProposalReviewUiSession | null>(null);
  const [generationRetryUsed, setGenerationRetryUsed] = useState(false);
  const [generatedStorefrontProposal, setGeneratedStorefrontProposal] =
    useState<AiStorefrontProposal | null>(null);
  const [promptedGenerationStage, setPromptedGenerationStage] =
    useState<PromptedStorefrontGenerationStage>("idle");
  const [promptedGenerationLineage, setPromptedGenerationLineage] =
    useState<PromptedStorefrontStudioGenerationLineage | null>(null);
  const [promptedProposalId, setPromptedProposalId] = useState<string | null>(null);
  const [storefrontHistoryState, setStorefrontHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const importedStorefrontProposalId = useRef<string | null>(null);

  const locale = activeLocale ?? primaryLocale ?? "en";
  const fallbackLocale = primaryLocale ?? locale;
  const localize = (value: LocalizedText) => resolveLocalizedText(value, locale, fallbackLocale);
  const promptedInitialGeneration = Boolean(
    promptedStorefrontClient &&
    promptedInitialDraftAuthority &&
    !controlledStorefrontAcceptance &&
    targetScope === "storefront" &&
    activeDraft &&
    storedDraft &&
    activeDraft.id === promptedInitialDraftAuthority.draftSnapshotId &&
    activeDraft.revision === promptedInitialDraftAuthority.draftRevision &&
    storedDraft.id === promptedInitialDraftAuthority.draftSnapshotId &&
    storedDraft.revision === promptedInitialDraftAuthority.draftRevision &&
    canonicalStorefrontContentFingerprint(activeDraft) ===
      promptedInitialDraftAuthority.contentFingerprint &&
    canonicalStorefrontContentFingerprint(storedDraft) ===
      promptedInitialDraftAuthority.contentFingerprint,
  );

  useEffect(() => {
    runtimeBridge.updateAnalytics(analytics, analyticsRoute);
  }, [analytics, analyticsRoute, runtimeBridge]);

  const updateRuntimeIdentity = useCallback(
    (
      nextPage: PageModel | undefined,
      nextSectionId: string | undefined,
      nextScope: DesignAgentTargetScope = targetScope,
    ) => {
      runtimeBridge.updateIdentity(
        nextPage && draftSnapshotId && draftRevision !== undefined
          ? {
              projectId,
              draftSnapshotId,
              draftRevision,
              target:
                nextScope === "section" &&
                nextSectionId &&
                nextPage.sections.some((section) => section.id === nextSectionId)
                  ? { type: "section", pageId: nextPage.id, sectionId: nextSectionId }
                  : { type: "page", pageId: nextPage.id },
              page: structuredClone(nextPage),
            }
          : null,
      );
    },
    [draftRevision, draftSnapshotId, projectId, runtimeBridge, targetScope],
  );

  useEffect(() => {
    updateRuntimeIdentity(page, selectedSectionId, targetScope);
  }, [page, selectedSectionId, targetScope, updateRuntimeIdentity]);

  useEffect(() => {
    const storefront = activeDraft ? tryProjectAiStorefrontSnapshot(activeDraft) : null;
    runtimeBridge.updateStorefrontContext(
      storefront && activeDraft && activeLocale && enabledLocales
        ? {
            projectId,
            draftSnapshotId: activeDraft.id,
            draftRevision: activeDraft.revision,
            enabledLocales,
            activeLocale,
            storefront,
          }
        : null,
    );
  }, [activeDraft, activeLocale, enabledLocales, projectId, runtimeBridge]);

  useEffect(() => {
    if (
      !initialStorefrontProposal ||
      importedStorefrontProposalId.current === initialStorefrontProposal.id ||
      !activeDraft ||
      !storedDraft ||
      !publishedSnapshot ||
      !catalogue ||
      !activeLocale ||
      !primaryLocale ||
      !enabledLocales
    ) {
      return;
    }
    let cancelled = false;
    importedStorefrontProposalId.current = initialStorefrontProposal.id;
    try {
      const proposal = validateAiStorefrontProposal(initialStorefrontProposal, {
        projectId,
        draftSnapshotId: activeDraft.id,
        draftRevision: activeDraft.revision,
        enabledLocales,
        activeLocale,
        storefront: projectAiStorefrontSnapshot(activeDraft),
      });
      const coordinator = new StorefrontProposalAcceptanceCoordinator({
        proposal,
        activeDraft,
        storedDraft,
        publishedSnapshot,
        catalogue,
        enabledLocales,
        activeLocale,
        primaryLocale,
      });
      if (coordinator.inspect().state !== "ready") return;
      pendingStorefrontAcceptance.current = coordinator;
      queueMicrotask(() => {
        if (cancelled) return;
        setGeneratedStorefrontProposal(proposal);
        setTargetScope("storefront");
        setSession(
          uiSession("proposalReady", statuses.ready, {
            affectedSectionIds: affectedSectionIds(
              proposal.operations.map((entry) => entry.operation),
            ),
          }),
        );
        onProposalReady?.();
      });
    } catch {
      // A bridge proposal is untrusted at the browser boundary. A stale or
      // mismatched envelope is intentionally not shown or applied.
      queueMicrotask(() => {
        if (cancelled) return;
        pendingStorefrontAcceptance.current = null;
        setGeneratedStorefrontProposal(null);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    activeDraft,
    activeLocale,
    catalogue,
    enabledLocales,
    initialStorefrontProposal,
    onProposalReady,
    primaryLocale,
    projectId,
    publishedSnapshot,
    storedDraft,
  ]);

  const refreshStorefrontHistory = useCallback(() => {
    const history = acceptedStorefrontHistory.current;
    if (!history) {
      setStorefrontHistoryState({ canUndo: false, canRedo: false });
      return;
    }
    const transactions = history.inspectTransactions();
    setStorefrontHistoryState({
      canUndo: transactions.past.length > 0,
      canRedo: transactions.future.length > 0,
    });
  }, []);

  const ensureAcceptedStorefrontHistory = useCallback(
    (snapshot: StorefrontSnapshot) => {
      if (!catalogue || !activeLocale || !primaryLocale) {
        throw new Error("Storefront history requires complete validation context.");
      }
      const validated = validateRegisteredSnapshot(
        snapshot,
        catalogue,
        activeLocale,
        primaryLocale,
      );
      const history =
        acceptedStorefrontHistory.current ??
        new CanonicalStorefrontHistory({
          validateSnapshot: (candidate) =>
            validateRegisteredSnapshot(candidate, catalogue, activeLocale, primaryLocale),
        });
      if (!acceptedStorefrontHistory.current) {
        history.initialize(validated);
        acceptedStorefrontHistory.current = history;
      } else {
        history.rebaseCurrent(validated);
      }
      return history;
    },
    [activeLocale, catalogue, primaryLocale],
  );

  const trackConfirmationEvent = (
    name: Extract<ProposalAnalyticsEvent["name"], "ai_proposal_accepted" | "ai_proposal_rejected">,
    generated: GeneratedAiProposal,
  ) => {
    try {
      analytics.track({
        name,
        projectId: generated.projectId,
        timestamp: new Date().toISOString(),
        route: analyticsRoute,
        targetId: generated.sectionId ?? generated.pageId,
      });
    } catch {
      // Observability cannot control proposal state.
    }
  };

  const closePending = useCallback(() => {
    const current = runtime.confirmation.inspect();
    if (["ready", "accepting", "failed"].includes(current.state)) runtime.confirmation.close();
  }, [runtime]);

  const closeStorefrontPending = useCallback(() => {
    promptedGenerationAbort.current?.abort();
    promptedGenerationAbort.current = null;
    runtime.storefrontGeneration.supersede();
    const coordinator = pendingStorefrontAcceptance.current;
    if (coordinator && ["ready", "failed"].includes(coordinator.inspect().state)) {
      coordinator.close();
    }
    pendingStorefrontAcceptance.current = null;
    setGeneratedStorefrontProposal(null);
    setPromptedProposalId(null);
    setPromptedGenerationLineage(null);
    setPromptedGenerationStage("idle");
  }, [runtime]);

  const clearWorkflow = useCallback((status?: LocalizedText) => {
    actionSequence.current += 1;
    generationPending.current = false;
    setGenerationRetryUsed(false);
    clarificationRequest.current = null;
    setClarificationAnswer("");
    setRevision("");
    setSession(status ? uiSession("closed", status) : null);
  }, []);

  const clearStorefrontHistory = useCallback(() => {
    acceptedStorefrontHistory.current = null;
    acceptedStorefrontHistoryFingerprint.current = null;
    acceptedStorefrontProposalScopes.current.clear();
    setStorefrontHistoryState({ canUndo: false, canRedo: false });
  }, []);

  useEffect(() => {
    if (initialLifecycle.current) {
      initialLifecycle.current = false;
      return;
    }
    closePending();
    closeStorefrontPending();
    runtime.confirmation.reset();
    clearStorefrontHistory();
    clearWorkflow();
    merchantInstruction.current = "";
    lastGenerationInstruction.current = "";
    setRequest("");
  }, [
    clearStorefrontHistory,
    clearWorkflow,
    closePending,
    closeStorefrontPending,
    lifecycleKey,
    runtime,
  ]);

  useEffect(
    () => () => {
      actionSequence.current += 1;
      closePending();
      closeStorefrontPending();
    },
    [closePending, closeStorefrontPending],
  );

  useEffect(() => {
    if (!activeDraft || !acceptedStorefrontHistory.current) return;
    try {
      const fingerprint = canonicalStorefrontContentFingerprint(activeDraft);
      if (fingerprint === acceptedStorefrontHistoryFingerprint.current) return;
      ensureAcceptedStorefrontHistory(activeDraft);
      acceptedStorefrontHistoryFingerprint.current = fingerprint;
      refreshStorefrontHistory();
    } catch {
      acceptedStorefrontHistory.current = null;
      acceptedStorefrontHistoryFingerprint.current = null;
      refreshStorefrontHistory();
    }
  }, [activeDraft, ensureAcceptedStorefrontHistory, refreshStorefrontHistory]);

  const commandFor = (instruction: string) => {
    if (
      !page ||
      !activeLocale ||
      !brandSystem ||
      !displayContext ||
      !draftSnapshotId ||
      draftRevision === undefined ||
      !enabledLocales
    ) {
      throw new Error("The current editor page is not ready for a design request.");
    }
    return {
      projectId,
      draftSnapshotId,
      draftRevision,
      page,
      target:
        targetScope === "section" && selectedSectionId
          ? ({ type: "section", pageId: page.id, sectionId: selectedSectionId } as const)
          : ({ type: "page", pageId: page.id } as const),
      merchantInstruction: instruction,
      activeLocale,
      enabledLocales,
      brandSystem,
      displayContext,
      importedContent: [],
      provider: runtime.provider,
    };
  };

  const storefrontCommandFor = (
    instruction: string,
    attemptId: string,
    scope: StorefrontGenerationScope,
  ) => {
    if (!activeDraft || !activeLocale || !enabledLocales) {
      throw new Error("The complete storefront is not ready for a design request.");
    }
    const storefront = projectAiStorefrontSnapshot(activeDraft);
    const baseCommand = {
      projectId,
      draftSnapshotId: activeDraft.id,
      draftRevision: activeDraft.revision,
      storefront,
      affectedPageIds: [...scope.affectedPageIds],
      affectedSectionTargets: [],
      designSystemTarget: scope.includesSharedFrame
        ? { kind: "storefrontDesignSystem" as const, projectId }
        : null,
      merchantInstruction: instruction,
      activeLocale,
      enabledLocales,
      requestedScope: scope.kind === "homepage" ? ("page" as const) : ("storefront" as const),
      providerId: runtime.storefrontProvider.id,
      correlationRequestId: attemptId,
      provider: runtime.storefrontProvider,
      importedContent: [],
    };
    const { command, request } = buildAiStorefrontProviderRequestForSupportedCapability(
      baseCommand,
      1,
    );
    runtimeBridge.bindStorefrontIdentity({
      context: {
        projectId,
        draftSnapshotId: activeDraft.id,
        draftRevision: activeDraft.revision,
        enabledLocales,
        activeLocale,
        storefront,
      },
      target: request.target,
    });
    return command;
  };

  const applyGenerationResult = (
    result: AiProposalGenerationResult,
    readyStatus: LocalizedText,
  ) => {
    if (result.state === "proposalReady") {
      const opened = runtime.confirmation.open(result.proposal);
      if (opened.state !== "ready" || !opened.generatedProposal) {
        const message = opened.failure?.message ?? {
          en: "The proposal is no longer available for safe review.",
          fi: "Ehdotusta ei voi enää tarkistaa turvallisesti.",
        };
        setSession(uiSession("failed", message, { failure: { message, retryable: false } }));
        return;
      }
      const canonicalProposal = opened.generatedProposal.proposal;
      setRequest("");
      setRevision("");
      setSession(
        uiSession("proposalReady", readyStatus, {
          selectedSectionId:
            opened.generatedProposal.editorTarget.type === "section"
              ? opened.generatedProposal.editorTarget.sectionId
              : null,
          affectedSectionIds: affectedSectionIds(canonicalProposal.operations),
        }),
      );
      onProposalReady?.();
      return;
    }
    setSession(
      uiSession(result.state, result.failure.message, {
        failure: { message: result.failure.message, retryable: result.failure.retryable },
      }),
    );
  };

  const generatePage = async (
    instruction: string,
    mode: "initial" | "revision" | "regeneration" = "initial",
  ) => {
    if (disabled || generationPending.current) return;
    generationPending.current = true;
    closePending();
    const actionId = actionSequence.current + 1;
    actionSequence.current = actionId;
    lastGenerationInstruction.current = instruction;
    setSession(
      uiSession(
        mode === "revision" ? "revising" : "generating",
        statuses[mode === "revision" ? "revising" : "generating"],
      ),
    );
    try {
      const result = await runtime.generation.generate(commandFor(instruction));
      if (actionSequence.current !== actionId) {
        if (result.state === "proposalReady") {
          runtime.proposalStore.reject(result.proposal.proposal.id);
        }
        return;
      }
      applyGenerationResult(
        result,
        mode === "regeneration" ? statuses.regenerated : statuses.ready,
      );
    } catch {
      if (actionSequence.current !== actionId) return;
      const message = {
        en: "That request could not be completed safely. Your current page has not changed.",
        fi: "Pyyntöä ei voitu toteuttaa turvallisesti. Nykyinen sivu säilyi ennallaan.",
      };
      setSession(uiSession("failed", message, { failure: { message, retryable: true } }));
    } finally {
      if (actionSequence.current === actionId) generationPending.current = false;
    }
  };

  const generatePromptedStorefront = async (instruction: string) => {
    if (
      disabled ||
      generationPending.current ||
      generatedStorefrontProposal ||
      pendingStorefrontAcceptance.current ||
      !promptedStorefrontClient ||
      !promptedInitialGeneration
    ) {
      return;
    }
    if (!activeDraft || !activeLocale || !enabledLocales) {
      const message = promptedGenerationStatuses.failed;
      setPromptedGenerationStage("failed");
      setSession(uiSession("failed", message, { failure: { message, retryable: false } }));
      return;
    }

    generationPending.current = true;
    closePending();
    closeStorefrontPending();
    const actionId = actionSequence.current + 1;
    actionSequence.current = actionId;
    const abortController = new AbortController();
    promptedGenerationAbort.current = abortController;
    lastGenerationInstruction.current = instruction;
    lastGenerationScope.current = "storefront";
    lastResolvedStorefrontScope.current = "storefront";
    setPromptedGenerationLineage(null);
    setPromptedGenerationStage("preparing-authority");
    setSession(uiSession("generating", promptedGenerationStatuses["preparing-authority"]));

    const updateStage = (stage: PromptedStorefrontRuntimeStage) => {
      if (actionSequence.current !== actionId) return;
      setPromptedGenerationStage(stage);
      setSession(uiSession("generating", promptedGenerationStatuses[stage]));
    };

    try {
      const promptedRequest = promptedStorefrontStudioGenerationRequestSchema.parse({
        operation: PROMPTED_STOREFRONT_STUDIO_OPERATION,
        contractVersion: PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
        requestId: createStorefrontDiagnosticAttemptId(),
        projectId,
        draftSnapshotId: activeDraft.id,
        draftRevision: activeDraft.revision,
        activeLocale,
        targetScope: "storefront",
        merchantPrompt: instruction,
      });
      const result = await promptedStorefrontClient.generateStorefront(promptedRequest, {
        signal: abortController.signal,
        onStage: updateStage,
      });
      if (actionSequence.current !== actionId) return;
      if (
        result.proposal.providerRequestId !== promptedRequest.requestId ||
        result.proposal.proposal.requestId !== promptedRequest.requestId ||
        result.proposal.providerId !== result.lineage.providerId
      ) {
        throw new Error("The prompted proposal does not match the active generation request.");
      }

      const proposal = validateAiStorefrontProposal(result.proposal.proposal, {
        projectId,
        draftSnapshotId: activeDraft.id,
        draftRevision: activeDraft.revision,
        enabledLocales,
        activeLocale,
        storefront: projectAiStorefrontSnapshot(activeDraft),
      });
      if (!storedDraft || !publishedSnapshot || !catalogue || !primaryLocale) {
        throw new Error("The prompted proposal cannot be reviewed without complete draft context.");
      }
      const coordinator = new StorefrontProposalAcceptanceCoordinator({
        proposal,
        activeDraft,
        storedDraft,
        publishedSnapshot,
        catalogue,
        enabledLocales,
        activeLocale,
        primaryLocale,
      });
      if (coordinator.inspect().state !== "ready") {
        throw new Error("The prompted proposal is not ready for isolated review.");
      }
      pendingStorefrontAcceptance.current = coordinator;
      onStorefrontEvidenceAuthority?.(result.currentEvidenceReferences);
      refreshStorefrontHistory();
      setGeneratedStorefrontProposal(proposal);
      setPromptedProposalId(proposal.id);
      setPromptedGenerationLineage(result.lineage);
      setPromptedGenerationStage("proposal-ready");
      setRequest("");
      setRevision("");
      setSession(
        uiSession("proposalReady", promptedGenerationStatuses["proposal-ready"], {
          affectedSectionIds: affectedSectionIds(
            proposal.operations.map((entry) => entry.operation),
          ),
        }),
      );
      onProposalReady?.();
    } catch (error) {
      if (actionSequence.current !== actionId) return;
      if (error instanceof PromptedStorefrontStudioClientAbortedError) {
        setPromptedGenerationStage("superseded");
        setSession(
          uiSession("superseded", promptedGenerationStatuses.superseded, {
            failure: { message: promptedGenerationStatuses.superseded, retryable: false },
          }),
        );
        return;
      }
      const stale =
        error instanceof PromptedStorefrontStudioClientError && error.category === "stale";
      const stage = stale ? "stale" : "failed";
      const message = promptedGenerationStatuses[stage];
      setPromptedGenerationStage(stage);
      setSession(
        uiSession(stale ? "stale" : "failed", message, {
          failure: { message, retryable: false },
        }),
      );
    } finally {
      if (promptedGenerationAbort.current === abortController) {
        promptedGenerationAbort.current = null;
      }
      if (actionSequence.current === actionId) generationPending.current = false;
    }
  };

  const generateStorefront = async (
    instruction: string,
    mode: "initial" | "revision" | "regeneration" = "initial",
    routedScope?: StorefrontGenerationScope,
  ) => {
    if (disabled || generationPending.current) return;
    generationPending.current = true;
    closePending();
    closeStorefrontPending();
    const actionId = actionSequence.current + 1;
    actionSequence.current = actionId;
    lastGenerationInstruction.current = instruction;
    lastGenerationScope.current = "storefront";
    let resolvedScope: StorefrontGenerationScope | null = null;
    try {
      resolvedScope =
        routedScope ??
        (activeDraft ? resolveStorefrontGenerationScope(instruction, activeDraft.pages) : null);
    } catch {
      const message = {
        en: "That storefront scope is not supported safely. Your draft has not changed.",
        fi: "Verkkokauppapyynnön laajuutta ei voida toteuttaa turvallisesti. Luonnos säilyi ennallaan.",
      };
      generationPending.current = false;
      setSession(uiSession("failed", message, { failure: { message, retryable: false } }));
      return;
    }
    const diagnosticScope = resolvedScope?.kind === "homepage" ? "page" : "storefront";
    lastResolvedStorefrontScope.current = resolvedScope?.kind ?? null;
    setSession(
      uiSession(
        mode === "revision" ? "revising" : "generating",
        statuses[mode === "revision" ? "revising" : "generating"],
      ),
    );
    const attemptId = createStorefrontDiagnosticAttemptId();
    let failureCategory:
      "client_command_build" | "client_acceptance_coordinator" | "unknown_client_failure" =
      "client_command_build";
    recordStorefrontDiagnostic({
      attemptId,
      projectId,
      scope: diagnosticScope,
      stage: "submission_received",
      category: "success",
    });
    try {
      recordStorefrontDiagnostic({
        attemptId,
        projectId,
        scope: diagnosticScope,
        stage: "command_build_started",
        category: "success",
      });
      if (!resolvedScope) {
        throw new Error("The complete storefront is not ready for a design request.");
      }
      const command = storefrontCommandFor(instruction, attemptId, resolvedScope);
      recordStorefrontDiagnostic({
        attemptId,
        projectId,
        scope: diagnosticScope,
        stage: "command_build_completed",
        category: "success",
      });
      const result = await runtime.storefrontGeneration.generate(command);
      if (actionSequence.current !== actionId) return;
      if (result.state !== "ready") {
        recordStorefrontDiagnostic({
          attemptId,
          projectId,
          scope: diagnosticScope,
          stage: "proposal_state_completed",
          category: storefrontFailureDiagnosticCategory(result.failure.code),
        });
        setSession(
          uiSession(result.state, result.failure.message, {
            failure: { message: result.failure.message, retryable: result.failure.retryable },
          }),
        );
        return;
      }
      if (
        !activeDraft ||
        !storedDraft ||
        !publishedSnapshot ||
        !catalogue ||
        !activeLocale ||
        !primaryLocale ||
        !enabledLocales
      ) {
        throw new Error("The storefront proposal cannot be opened without complete draft context.");
      }
      failureCategory = "client_acceptance_coordinator";
      recordStorefrontDiagnostic({
        attemptId,
        projectId,
        scope: diagnosticScope,
        stage: "acceptance_coordinator_started",
        category: "success",
      });
      pendingStorefrontAcceptance.current = new StorefrontProposalAcceptanceCoordinator({
        proposal: result.proposal,
        activeDraft,
        storedDraft,
        publishedSnapshot,
        catalogue,
        enabledLocales,
        activeLocale,
        primaryLocale,
      });
      onStorefrontEvidenceAuthority?.(
        currentEvidenceReferencesForStorefrontProposal?.(result.proposal.id) ?? [],
      );
      refreshStorefrontHistory();
      setGeneratedStorefrontProposal(result.proposal);
      setRequest("");
      setRevision("");
      setSession(
        uiSession(
          "proposalReady",
          mode === "regeneration" ? statuses.regenerated : statuses.ready,
          {
            affectedSectionIds: affectedSectionIds(
              result.proposal.operations.map((entry) => entry.operation),
            ),
          },
        ),
      );
      recordStorefrontDiagnostic({
        attemptId,
        projectId,
        scope: diagnosticScope,
        stage: "proposal_state_completed",
        category: "success",
      });
      onProposalReady?.();
    } catch {
      if (actionSequence.current !== actionId) return;
      recordStorefrontDiagnostic({
        attemptId,
        projectId,
        scope: diagnosticScope,
        stage:
          failureCategory === "client_acceptance_coordinator"
            ? "acceptance_coordinator_started"
            : "command_build_started",
        category: failureCategory,
      });
      const message = {
        en: "That storefront request could not be completed safely. Your draft has not changed.",
        fi: "Kaupan pyyntöä ei voitu toteuttaa turvallisesti. Luonnos säilyi ennallaan.",
      };
      setSession(uiSession("failed", message, { failure: { message, retryable: true } }));
    } finally {
      if (actionSequence.current === actionId) generationPending.current = false;
    }
  };

  const generate = (
    instruction: string,
    mode: "initial" | "revision" | "regeneration" = "initial",
    scope: DesignAgentTargetScope = targetScope,
  ) => {
    lastGenerationScope.current = scope;
    return scope === "storefront"
      ? generateStorefront(instruction, mode)
      : generatePage(instruction, mode);
  };

  const submitRequest = () => {
    const instruction = request;
    if (disabled || controlledStorefrontAcceptance) return;
    if (!instruction.trim()) {
      setSession(
        uiSession("failed", statuses.empty, {
          failure: { message: statuses.empty, retryable: false },
        }),
      );
      return;
    }
    merchantInstruction.current = instruction;
    setGenerationRetryUsed(false);
    if (targetScope === "storefront") {
      if (promptedInitialGeneration) {
        void generatePromptedStorefront(instruction);
        return;
      }
      void generate(instruction, "initial", "storefront");
      return;
    }
    if (targetScope === "page" && page?.type === "home" && activeDraft) {
      if (!hasExplicitStorefrontSectionIntent(instruction)) {
        try {
          const routedScope = resolveStorefrontGenerationScope(instruction, activeDraft.pages);
          if (routedScope.kind === "homepage") {
            void generateStorefront(instruction, "initial", routedScope);
            return;
          }
        } catch {
          const message = {
            en: "That page scope is not supported safely. Your draft has not changed.",
            fi: "Sivupyynnön laajuutta ei voida toteuttaa turvallisesti. Luonnos säilyi ennallaan.",
          };
          setSession(uiSession("failed", message, { failure: { message, retryable: false } }));
          return;
        }
      }
    }
    const classification = runtime.clarificationProvider.classifyDesignRequest(instruction, locale);
    if (classification.requiresClarification && classification.clarifications[0]) {
      clarificationRequest.current = {
        instruction,
        useOriginal: classification.normalizedIntent === "campaignSection",
      };
      const status = {
        en: "One answer is needed before the proposal can be prepared.",
        fi: "Tarvitaan yksi vastaus ennen ehdotuksen valmistelua.",
      };
      setSession(
        uiSession("needsClarification", status, {
          clarificationQuestion: classification.clarifications[0],
        }),
      );
      return;
    }
    void generate(instruction, "initial", targetScope);
  };

  const answerClarification = () => {
    const pending = clarificationRequest.current;
    const answer = clarificationAnswer.trim();
    if (!pending || !answer || disabled || controlledStorefrontAcceptance) return;
    clarificationRequest.current = null;
    setGenerationRetryUsed(false);
    void generate(pending.useOriginal ? pending.instruction : answer, "initial", targetScope);
  };

  const reviseProposal = () => {
    if (session?.state !== "proposalReady" || !revision.trim()) return;
    if (promptedProposalId) {
      setSession((current) =>
        current
          ? {
              ...current,
              status: {
                en: "Reject this proposal before generating another storefront design.",
                fi: "Hylkää tämä ehdotus ennen uuden verkkokauppasuunnitelman luomista.",
              },
            }
          : current,
      );
      return;
    }
    if (controlledStorefrontAcceptance && generatedStorefrontProposal) {
      setSession((current) =>
        current ? { ...current, status: statuses.controlledAcceptance } : current,
      );
      return;
    }
    const kind = classifyRevisionInstruction(revision);
    if (kind === "startOver") {
      restartSession();
      return;
    }
    if (kind !== "makeMinimal") {
      const message = {
        en: "That revision is not supported yet. The current proposal remains ready to review.",
        fi: "Tätä muutospyyntöä ei vielä tueta. Nykyinen ehdotus säilyy tarkistettavana.",
      };
      setSession((current) => (current ? { ...current, status: message } : current));
      return;
    }
    setGenerationRetryUsed(false);
    if (generatedStorefrontProposal) {
      void generateStorefront(
        storefrontMinimalRevisionInstruction(
          locale,
          lastResolvedStorefrontScope.current ?? "storefront",
        ),
        "revision",
      );
      return;
    }
    void generate(minimalRevisionRequest(locale), "revision", lastGenerationScope.current);
  };

  const regenerateProposal = () => {
    if (session?.state !== "proposalReady" || !lastGenerationInstruction.current) return;
    if (promptedProposalId) {
      setSession((current) =>
        current
          ? {
              ...current,
              status: {
                en: "Reject this proposal before generating another storefront design.",
                fi: "Hylkää tämä ehdotus ennen uuden verkkokauppasuunnitelman luomista.",
              },
            }
          : current,
      );
      return;
    }
    if (controlledStorefrontAcceptance && generatedStorefrontProposal) {
      setSession((current) =>
        current ? { ...current, status: statuses.controlledAcceptance } : current,
      );
      return;
    }
    setGenerationRetryUsed(false);
    void generate(lastGenerationInstruction.current, "regeneration", lastGenerationScope.current);
  };

  const retryGeneration = () => {
    if (
      disabled ||
      controlledStorefrontAcceptance ||
      session?.state !== "failed" ||
      !session.failure?.retryable ||
      generationRetryUsed ||
      !lastGenerationInstruction.current ||
      runtime.confirmation.inspect().generatedProposal ||
      generatedStorefrontProposal ||
      promptedInitialGeneration
    ) {
      return;
    }
    setGenerationRetryUsed(true);
    void generate(lastGenerationInstruction.current, "initial", lastGenerationScope.current);
  };

  const applyConfirmationResult = (result: AiProposalConfirmationResult) => {
    const generated = result.generatedProposal;
    if (result.state === "accepting" && generated) {
      setSession(
        uiSession("accepting", statuses.accepting, {
          selectedSectionId:
            generated.editorTarget.type === "section" ? generated.editorTarget.sectionId : null,
          affectedSectionIds: affectedSectionIds(generated.proposal.operations),
        }),
      );
      return;
    }
    if (result.state === "failed" && generated && result.failure) {
      setSession(
        uiSession("failed", result.failure.message, {
          selectedSectionId:
            generated.editorTarget.type === "section" ? generated.editorTarget.sectionId : null,
          affectedSectionIds: affectedSectionIds(generated.proposal.operations),
          failure: { message: result.failure.message, retryable: result.failure.retryable },
        }),
      );
      return;
    }
    if (result.state === "stale" && result.failure) {
      setSession(
        uiSession("stale", result.failure.message, {
          failure: { message: result.failure.message, retryable: false },
        }),
      );
      return;
    }
    const terminalState: ProposalReviewUiState =
      result.state === "accepted"
        ? "accepted"
        : result.state === "rejected"
          ? "rejected"
          : "closed";
    setSession(
      uiSession(
        terminalState,
        result.state === "accepted"
          ? statuses.accepted
          : result.state === "rejected"
            ? statuses.rejected
            : statuses.closed,
      ),
    );
  };

  const acceptProposal = () => {
    if (
      disabled ||
      acceptancePending.current ||
      (session?.state !== "proposalReady" && session?.state !== "failed")
    ) {
      return;
    }
    if (generatedStorefrontProposal) {
      const coordinator = pendingStorefrontAcceptance.current;
      if (!coordinator) return;
      acceptancePending.current = true;
      setSession(uiSession("accepting", statuses.accepting));
      const actionId = actionSequence.current + 1;
      actionSequence.current = actionId;
      window.setTimeout(() => {
        void (async () => {
          if (actionSequence.current !== actionId) {
            acceptancePending.current = false;
            return;
          }
          const beforeAcceptance = coordinator.inspect().activeDraft;
          const result = coordinator.accept();
          if (result.state === "accepted") {
            if (!result.transaction) {
              const message = {
                en: "The storefront proposal could not be recorded safely. Your draft is unchanged.",
                fi: "Kaupan ehdotusta ei voitu kirjata turvallisesti. Luonnos säilyi ennallaan.",
              };
              setSession(
                uiSession("failed", message, {
                  failure: { message, retryable: true },
                }),
              );
              acceptancePending.current = false;
              return;
            }
            let activeStorefront: StorefrontSnapshot;
            try {
              await onStorefrontAccepted?.({
                proposalId: generatedStorefrontProposal.id,
                acceptedSnapshot: result.activeDraft,
              });
              if (actionSequence.current !== actionId) {
                acceptancePending.current = false;
                return;
              }
              const history = ensureAcceptedStorefrontHistory(beforeAcceptance);
              activeStorefront = history.commit(result.transaction);
              acceptedStorefrontHistoryFingerprint.current =
                canonicalStorefrontContentFingerprint(activeStorefront);
            } catch {
              const message = {
                en: "The storefront proposal could not be recorded safely. Your draft is unchanged.",
                fi: "Kaupan ehdotusta ei voitu kirjata turvallisesti. Luonnos säilyi ennallaan.",
              };
              setSession(
                uiSession("failed", message, {
                  failure: { message, retryable: true },
                }),
              );
              pendingStorefrontAcceptance.current = null;
              setGeneratedStorefrontProposal(null);
              setPromptedProposalId(null);
              setPromptedGenerationLineage(null);
              setPromptedGenerationStage("failed");
              refreshStorefrontHistory();
              acceptancePending.current = false;
              return;
            }
            acceptedStorefrontProposalScopes.current.set(
              result.transaction.proposalId,
              generatedStorefrontProposal.target.scope,
            );
            onStorefrontSnapshot(
              activeStorefront,
              generatedStorefrontProposal.target.scope,
              "applied",
              { replaceEditorHistory: result.transaction.structuralTransition !== undefined },
            );
            pendingStorefrontAcceptance.current = null;
            setGeneratedStorefrontProposal(null);
            setPromptedProposalId(null);
            setPromptedGenerationStage("idle");
            refreshStorefrontHistory();
            setSession(
              uiSession(
                "accepted",
                storefrontProposalHistoryStatus(
                  generatedStorefrontProposal.target.scope,
                  "applied",
                ),
              ),
            );
            acceptancePending.current = false;
            return;
          }
          const message = result.failure?.message ?? {
            en: "The storefront proposal could not be applied safely.",
            fi: "Kaupan ehdotusta ei voitu ottaa turvallisesti käyttöön.",
          };
          setSession(
            uiSession(result.state === "stale" ? "stale" : "failed", message, {
              failure: { message, retryable: result.failure?.retryable ?? false },
            }),
          );
          if (result.state === "stale") {
            pendingStorefrontAcceptance.current = null;
            setGeneratedStorefrontProposal(null);
            setPromptedProposalId(null);
            setPromptedGenerationStage("stale");
          }
          acceptancePending.current = false;
        })();
      }, 0);
      return;
    }
    acceptancePending.current = true;
    const beginning = runtime.confirmation.beginAcceptance();
    applyConfirmationResult(beginning);
    if (beginning.state !== "accepting") {
      acceptancePending.current = false;
      return;
    }
    const actionId = actionSequence.current + 1;
    actionSequence.current = actionId;
    window.setTimeout(() => {
      if (actionSequence.current !== actionId) {
        acceptancePending.current = false;
        return;
      }
      try {
        const result = runtime.confirmation.completeAcceptance(onAcceptedPage);
        applyConfirmationResult(result);
        if (result.state === "accepted" && result.generatedProposal) {
          trackConfirmationEvent("ai_proposal_accepted", result.generatedProposal);
        }
      } finally {
        acceptancePending.current = false;
      }
    }, 0);
  };

  const rejectProposal = () => {
    if (
      disabled ||
      acceptancePending.current ||
      (session?.state !== "proposalReady" && session?.state !== "failed")
    ) {
      return;
    }
    if (generatedStorefrontProposal) {
      const coordinator = pendingStorefrontAcceptance.current;
      if (!coordinator) return;
      if (onStorefrontRejected) {
        acceptancePending.current = true;
        const proposalId = generatedStorefrontProposal.id;
        void (async () => {
          try {
            await onStorefrontRejected({ proposalId });
            const result = coordinator.reject();
            if (result.state === "rejected") {
              pendingStorefrontAcceptance.current = null;
              setGeneratedStorefrontProposal(null);
              setPromptedProposalId(null);
              setPromptedGenerationLineage(null);
              setPromptedGenerationStage("idle");
              setSession(uiSession("rejected", statuses.rejected));
            }
          } catch {
            const message = {
              en: "The storefront proposal could not be rejected safely. Your draft is unchanged.",
              fi: "Kauppaehdotusta ei voitu hylätä turvallisesti. Luonnos säilyi ennallaan.",
            };
            setSession(
              uiSession("failed", message, {
                failure: { message, retryable: false },
              }),
            );
          } finally {
            acceptancePending.current = false;
          }
        })();
        return;
      }
      const result = coordinator.reject();
      if (result.state === "rejected") {
        pendingStorefrontAcceptance.current = null;
        setGeneratedStorefrontProposal(null);
        setPromptedProposalId(null);
        setPromptedGenerationLineage(null);
        setPromptedGenerationStage("idle");
        setSession(uiSession("rejected", statuses.rejected));
      }
      return;
    }
    const result = runtime.confirmation.reject();
    applyConfirmationResult(result);
    if (result.generatedProposal) {
      trackConfirmationEvent("ai_proposal_rejected", result.generatedProposal);
    }
  };

  const cancelSession = () => {
    if (disabled) return;
    if (controlledStorefrontAcceptance && generatedStorefrontProposal) {
      setSession((current) =>
        current ? { ...current, status: statuses.controlledAcceptance } : current,
      );
      return;
    }
    actionSequence.current += 1;
    if (generatedStorefrontProposal || lastGenerationScope.current === "storefront") {
      closeStorefrontPending();
      setSession(uiSession("closed", statuses.closed));
      return;
    }
    closePending();
    applyConfirmationResult(
      runtime.confirmation.inspect().state === "closed"
        ? runtime.confirmation.inspect()
        : runtime.confirmation.close(),
    );
  };

  const restartSession = () => {
    if (disabled || controlledStorefrontAcceptance) return;
    closePending();
    closeStorefrontPending();
    runtime.confirmation.reset();
    actionSequence.current += 1;
    generationPending.current = false;
    clarificationRequest.current = null;
    merchantInstruction.current = "";
    lastGenerationInstruction.current = "";
    setGenerationRetryUsed(false);
    setRequest("");
    setClarificationAnswer("");
    setRevision("");
    setSession(uiSession("idle", statuses.idle));
  };

  const supersedeForContextChange = (
    nextPage: PageModel | undefined,
    nextSectionId: string | undefined,
    status: LocalizedText,
  ) => {
    updateRuntimeIdentity(nextPage, nextSectionId, targetScope);
    actionSequence.current += 1;
    generationPending.current = false;
    clarificationRequest.current = null;
    setClarificationAnswer("");
    setRevision("");

    const hasStorefrontWorkflow = Boolean(
      lastGenerationScope.current === "storefront" &&
      session &&
      [
        "needsClarification",
        "generating",
        "proposalReady",
        "revising",
        "accepting",
        "failed",
      ].includes(session.state),
    );
    if (hasStorefrontWorkflow) {
      const promptedWorkflow = promptedGenerationStage !== "idle" || promptedProposalId !== null;
      if (merchantInstruction.current) setRequest(merchantInstruction.current);
      closeStorefrontPending();
      if (promptedWorkflow) {
        setPromptedGenerationStage(status === statuses.targetSwitch ? "superseded" : "stale");
      }
      setSession(
        uiSession(status === statuses.targetSwitch ? "superseded" : "stale", status, {
          failure: { message: status, retryable: false },
        }),
      );
      return;
    }

    const current = runtime.confirmation.inspect();
    const hasContextBoundWorkflow = Boolean(
      session &&
      [
        "needsClarification",
        "generating",
        "proposalReady",
        "revising",
        "accepting",
        "failed",
      ].includes(session.state),
    );
    if (
      merchantInstruction.current &&
      (hasContextBoundWorkflow || ["ready", "accepting", "failed"].includes(current.state))
    ) {
      setRequest(merchantInstruction.current);
    }
    if (["ready", "accepting", "failed"].includes(current.state)) {
      applyConfirmationResult(runtime.confirmation.markStale());
      return;
    }
    if (hasContextBoundWorkflow) {
      if (
        status === statuses.localeSwitch &&
        session?.state === "failed" &&
        session.failure?.retryable
      ) {
        setSession(
          uiSession("failed", status, {
            failure: { message: status, retryable: true },
          }),
        );
        return;
      }
      setSession(
        uiSession("superseded", status, {
          failure: { message: status, retryable: false },
        }),
      );
    }
  };

  const closeForPageSwitch = (nextPage: PageModel) => {
    if (targetScope === "storefront") {
      if (promptedInitialGeneration && session?.state === "generating") {
        supersedeForContextChange(nextPage, undefined, statuses.contextSwitch);
        return;
      }
      updateRuntimeIdentity(nextPage, undefined, targetScope);
      return;
    }
    if (targetScope === "section") {
      targetExplicitlySelected.current = false;
      setTargetScope("page");
      supersedeForContextChange(nextPage, undefined, statuses.pageSwitch);
      updateRuntimeIdentity(nextPage, undefined, "page");
      return;
    }
    supersedeForContextChange(nextPage, undefined, statuses.pageSwitch);
  };

  const closeForPageMutation = (nextPage: PageModel) => {
    const nextSectionId =
      selectedSectionId && nextPage.sections.some((section) => section.id === selectedSectionId)
        ? selectedSectionId
        : undefined;
    if (targetScope === "section" && !nextSectionId) {
      targetExplicitlySelected.current = false;
      setTargetScope("page");
      supersedeForContextChange(nextPage, undefined, statuses.contextSwitch);
      updateRuntimeIdentity(nextPage, undefined, "page");
      return;
    }
    supersedeForContextChange(nextPage, nextSectionId, statuses.stale);
  };

  const closeForSelectionChange = (nextSectionId?: string) => {
    if (nextSectionId === selectedSectionId) return;
    if (targetScope === "section" && !nextSectionId) {
      targetExplicitlySelected.current = false;
      supersedeForContextChange(page, undefined, statuses.contextSwitch);
      setTargetScope("page");
      updateRuntimeIdentity(page, undefined, "page");
      return;
    }
    if (!targetExplicitlySelected.current) {
      const automaticScope: DesignAgentTargetScope = nextSectionId ? "section" : "page";
      if (automaticScope !== targetScope) {
        supersedeForContextChange(page, nextSectionId, statuses.contextSwitch);
        setTargetScope(automaticScope);
        updateRuntimeIdentity(page, nextSectionId, automaticScope);
        return;
      }
    }
    if (targetScope !== "section") {
      updateRuntimeIdentity(page, nextSectionId, targetScope);
      return;
    }
    supersedeForContextChange(page, nextSectionId, statuses.contextSwitch);
  };

  const closeForLocaleChange = () => {
    if (controlledStorefrontAcceptance && generatedStorefrontProposal) return;
    supersedeForContextChange(page, selectedSectionId, statuses.localeSwitch);
  };

  const selectTarget = (nextTarget: DesignAgentTargetScope) => {
    if (controlledStorefrontAcceptance) return;
    if (nextTarget === targetScope || (nextTarget === "section" && !selectedSectionId)) return;
    targetExplicitlySelected.current = true;
    const hasWorkflow = Boolean(
      session &&
      [
        "needsClarification",
        "generating",
        "proposalReady",
        "revising",
        "accepting",
        "failed",
      ].includes(session.state),
    );
    if (hasWorkflow) {
      const promptedWorkflow = promptedGenerationStage !== "idle" || promptedProposalId !== null;
      if (merchantInstruction.current) setRequest(merchantInstruction.current);
      closePending();
      closeStorefrontPending();
      if (promptedWorkflow) setPromptedGenerationStage("superseded");
      setSession(
        uiSession("superseded", statuses.targetSwitch, {
          failure: { message: statuses.targetSwitch, retryable: false },
        }),
      );
    }
    setTargetScope(nextTarget);
    updateRuntimeIdentity(page, selectedSectionId, nextTarget);
  };

  const undoStorefront = async () => {
    try {
      const history = acceptedStorefrontHistory.current;
      const transaction = history?.inspectTransactions().past.at(-1);
      const scope = transaction
        ? (acceptedStorefrontProposalScopes.current.get(transaction.proposalId) ?? "storefront")
        : "storefront";
      const previous = history?.undo();
      if (!previous) return false;
      const projectedPrevious = projectStorefrontHistorySnapshot?.(previous) ?? previous;
      acceptedStorefrontHistoryFingerprint.current =
        canonicalStorefrontContentFingerprint(projectedPrevious);
      await onStorefrontHistorySnapshot?.(projectedPrevious);
      onStorefrontSnapshot(projectedPrevious, scope, "undone", {
        replaceEditorHistory: transaction?.structuralTransition !== undefined,
      });
      refreshStorefrontHistory();
      setSession(uiSession("accepted", storefrontProposalHistoryStatus(scope, "undone")));
      return true;
    } catch {
      const restoredSnapshot = acceptedStorefrontHistory.current?.redo();
      acceptedStorefrontHistoryFingerprint.current = restoredSnapshot
        ? canonicalStorefrontContentFingerprint(
            projectStorefrontHistorySnapshot?.(restoredSnapshot) ?? restoredSnapshot,
          )
        : null;
      refreshStorefrontHistory();
      return false;
    }
  };

  const redoStorefront = async () => {
    try {
      const history = acceptedStorefrontHistory.current;
      const transaction = history?.inspectTransactions().future[0];
      const scope = transaction
        ? (acceptedStorefrontProposalScopes.current.get(transaction.proposalId) ?? "storefront")
        : "storefront";
      const next = history?.redo();
      if (!next) return false;
      const projectedNext = projectStorefrontHistorySnapshot?.(next) ?? next;
      acceptedStorefrontHistoryFingerprint.current =
        canonicalStorefrontContentFingerprint(projectedNext);
      await onStorefrontHistorySnapshot?.(projectedNext);
      onStorefrontSnapshot(projectedNext, scope, "redone", {
        replaceEditorHistory: transaction?.structuralTransition !== undefined,
      });
      refreshStorefrontHistory();
      setSession(uiSession("accepted", storefrontProposalHistoryStatus(scope, "redone")));
      return true;
    } catch {
      const restoredSnapshot = acceptedStorefrontHistory.current?.undo();
      acceptedStorefrontHistoryFingerprint.current = restoredSnapshot
        ? canonicalStorefrontContentFingerprint(
            projectStorefrontHistorySnapshot?.(restoredSnapshot) ?? restoredSnapshot,
          )
        : null;
      refreshStorefrontHistory();
      return false;
    }
  };

  const confirmation = runtime.confirmation.inspect();
  const generatedProposal =
    confirmation.generatedProposal?.proposal.status === "pending"
      ? confirmation.generatedProposal
      : null;

  const visibleState = session?.state ?? "idle";
  const statusMessage = localize(session?.status ?? statuses.idle);
  const previewActive =
    (generatedProposal !== null || generatedStorefrontProposal !== null) &&
    (session?.state === "proposalReady" ||
      session?.state === "accepting" ||
      session?.state === "failed");
  const blocksSave = previewActive || session?.state === "needsClarification";
  const controlsDisabled =
    disabled || ["generating", "revising", "accepting"].includes(visibleState);
  const generationRetryAvailable =
    session?.state === "failed" &&
    Boolean(session.failure?.retryable) &&
    !promptedInitialGeneration &&
    !generationRetryUsed &&
    Boolean(request.trim()) &&
    generatedProposal === null &&
    generatedStorefrontProposal === null;
  const updateRequest = (nextRequest: string) => {
    setRequest(nextRequest);
    if (session && ["failed", "stale", "superseded"].includes(session.state)) {
      if (promptedInitialGeneration) setPromptedGenerationStage("idle");
      setSession(uiSession("idle", statuses.idle));
    }
  };

  return {
    targetScope,
    selectTarget,
    selectedSectionEligible: Boolean(selectedSectionId),
    request,
    setRequest: updateRequest,
    clarificationAnswer,
    setClarificationAnswer,
    revision,
    setRevision,
    session,
    generatedProposal,
    generatedStorefrontProposal,
    visibleState,
    statusMessage,
    previewActive,
    blocksSave,
    controlsDisabled,
    generationRetryAvailable,
    promptedInitialGeneration,
    promptedProposalActive:
      promptedProposalId !== null && generatedStorefrontProposal?.id === promptedProposalId,
    promptedGenerationStage,
    promptedGenerationLineage,
    controlledStorefrontAcceptance,
    canUndoStorefront: storefrontHistoryState.canUndo,
    canRedoStorefront: storefrontHistoryState.canRedo,
    submitRequest,
    retryGeneration,
    answerClarification,
    reviseProposal,
    regenerateProposal,
    acceptProposal,
    rejectProposal,
    cancelSession,
    restartSession,
    closeForPageSwitch,
    closeForPageMutation,
    closeForSelectionChange,
    closeForLocaleChange,
    undoStorefront,
    redoStorefront,
    clearStorefrontHistory,
  };
}
