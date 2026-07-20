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
import { createDeterministicMockAIProvider, type AIProvider } from "@/application/ai-provider";
import {
  noopProposalAnalyticsSink,
  type ProposalAnalyticsEvent,
  type ProposalAnalyticsSink,
} from "@/application/analytics";
import { InMemoryDesignProposalStore, type DesignProposal } from "@/application/design-operations";
import {
  classifyRevisionInstruction,
  minimalRevisionRequest,
} from "@/application/design-agent/revisions";
import { createDeterministicDesignProvider } from "@/application/design-skills";
import type { StorefrontRenderContext } from "@/components/registry";
import type { BrandSystem } from "@/domain/design-system";
import { resolveLocalizedText, type Locale, type LocalizedText } from "@/domain/shared";
import type { PageModel } from "@/domain/storefront";

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

export type ProposalReviewUiSession = {
  state: ProposalReviewUiState;
  status: LocalizedText;
  selectedSectionId: string | null;
  affectedSectionIds: string[];
  assumptions: LocalizedText[];
  clarificationQuestion: LocalizedText | null;
  failure: { message: LocalizedText; retryable: boolean } | null;
};

export type DesignAgentSessionController = {
  request: string;
  setRequest: (request: string) => void;
  clarificationAnswer: string;
  setClarificationAnswer: (answer: string) => void;
  revision: string;
  setRevision: (revision: string) => void;
  session: ProposalReviewUiSession | null;
  generatedProposal: GeneratedAiProposal | null;
  visibleState: ProposalReviewUiState;
  statusMessage: string;
  previewActive: boolean;
  blocksSave: boolean;
  controlsDisabled: boolean;
  generationRetryAvailable: boolean;
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
};

type UseDesignAgentSessionInput = {
  lifecycleKey: string;
  projectId: string;
  draftSnapshotId?: string;
  draftRevision?: number;
  page?: PageModel;
  activeLocale?: Locale;
  primaryLocale?: Locale;
  enabledLocales?: Locale[];
  brandSystem?: BrandSystem;
  displayContext?: StorefrontRenderContext;
  selectedSectionId?: string;
  disabled: boolean;
  provider?: AIProvider;
  analytics?: ProposalAnalyticsSink;
  analyticsRoute?: string;
  onProposalReady?: () => void;
  onAcceptedPage: (page: PageModel) => void;
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
} satisfies Record<string, LocalizedText>;

type Runtime = ReturnType<typeof createRuntime>;

function createRuntimeBridge(
  initialAnalytics: ProposalAnalyticsSink,
  initialAnalyticsRoute: string,
) {
  let identity: AiProposalEditorIdentity | null = null;
  let analytics = initialAnalytics;
  let analyticsRoute = initialAnalyticsRoute;
  return {
    currentIdentity: () => {
      if (!identity) throw new Error("The current editor identity is unavailable.");
      return structuredClone(identity);
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
  };
}

function createRuntime(
  currentIdentity: () => AiProposalEditorIdentity,
  recordGenerationEvent: (event: AiProposalGenerationEvent) => void,
  provider: AIProvider,
) {
  const proposalStore = new InMemoryDesignProposalStore();
  return {
    proposalStore,
    provider,
    clarificationProvider: createDeterministicDesignProvider(),
    generation: new AiProposalGenerationOrchestrator({
      currentIdentity,
      proposalStore,
      analytics: { record: recordGenerationEvent },
    }),
    confirmation: new AiProposalConfirmationOrchestrator({ proposalStore, currentIdentity }),
  };
}

function affectedSectionIds(proposal: DesignProposal) {
  return [
    ...new Set(
      proposal.operations.flatMap((operation) =>
        "sectionId" in operation ? [operation.sectionId] : [],
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

export function useDesignAgentSession({
  lifecycleKey,
  projectId,
  draftSnapshotId,
  draftRevision,
  page,
  activeLocale,
  primaryLocale,
  enabledLocales,
  brandSystem,
  displayContext,
  selectedSectionId,
  disabled,
  provider,
  analytics = noopProposalAnalyticsSink,
  analyticsRoute = `/projects/${projectId}/editor`,
  onProposalReady,
  onAcceptedPage,
}: UseDesignAgentSessionInput): DesignAgentSessionController {
  const actionSequence = useRef(0);
  const acceptancePending = useRef(false);
  const generationPending = useRef(false);
  const clarificationRequest = useRef<{ instruction: string; useOriginal: boolean } | null>(null);
  const merchantInstruction = useRef("");
  const lastGenerationInstruction = useRef("");
  const initialLifecycle = useRef(true);
  const [runtimeBridge] = useState(() => createRuntimeBridge(analytics, analyticsRoute));
  const [runtime] = useState<Runtime>(() =>
    createRuntime(
      runtimeBridge.currentIdentity,
      runtimeBridge.recordGenerationEvent,
      provider ?? createDeterministicMockAIProvider(),
    ),
  );
  const [request, setRequest] = useState("");
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [revision, setRevision] = useState("");
  const [session, setSession] = useState<ProposalReviewUiSession | null>(null);
  const [generationRetryUsed, setGenerationRetryUsed] = useState(false);

  const locale = activeLocale ?? primaryLocale ?? "en";
  const fallbackLocale = primaryLocale ?? locale;
  const localize = (value: LocalizedText) => resolveLocalizedText(value, locale, fallbackLocale);

  useEffect(() => {
    runtimeBridge.updateAnalytics(analytics, analyticsRoute);
  }, [analytics, analyticsRoute, runtimeBridge]);

  const updateRuntimeIdentity = useCallback(
    (nextPage: PageModel | undefined, nextSectionId: string | undefined) => {
      runtimeBridge.updateIdentity(
        nextPage && draftSnapshotId && draftRevision !== undefined
          ? {
              projectId,
              draftSnapshotId,
              draftRevision,
              target:
                nextSectionId && nextPage.sections.some((section) => section.id === nextSectionId)
                  ? { type: "section", pageId: nextPage.id, sectionId: nextSectionId }
                  : { type: "page", pageId: nextPage.id },
              page: structuredClone(nextPage),
            }
          : null,
      );
    },
    [draftRevision, draftSnapshotId, projectId, runtimeBridge],
  );

  useEffect(() => {
    updateRuntimeIdentity(page, selectedSectionId);
  }, [page, selectedSectionId, updateRuntimeIdentity]);

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

  const clearWorkflow = useCallback((status?: LocalizedText) => {
    actionSequence.current += 1;
    acceptancePending.current = false;
    generationPending.current = false;
    setGenerationRetryUsed(false);
    clarificationRequest.current = null;
    setClarificationAnswer("");
    setRevision("");
    setSession(status ? uiSession("closed", status) : null);
  }, []);

  useEffect(() => {
    if (initialLifecycle.current) {
      initialLifecycle.current = false;
      return;
    }
    closePending();
    runtime.confirmation.reset();
    clearWorkflow();
    merchantInstruction.current = "";
    lastGenerationInstruction.current = "";
    setRequest("");
  }, [clearWorkflow, closePending, lifecycleKey, runtime]);

  useEffect(
    () => () => {
      actionSequence.current += 1;
      closePending();
    },
    [closePending],
  );

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
      target: selectedSectionId
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
          affectedSectionIds: affectedSectionIds(canonicalProposal),
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

  const generate = async (
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

  const submitRequest = () => {
    const instruction = request.trim();
    if (disabled) return;
    if (!instruction) {
      setSession(
        uiSession("failed", statuses.empty, {
          failure: { message: statuses.empty, retryable: false },
        }),
      );
      return;
    }
    merchantInstruction.current = instruction;
    setGenerationRetryUsed(false);
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
    void generate(instruction);
  };

  const answerClarification = () => {
    const pending = clarificationRequest.current;
    const answer = clarificationAnswer.trim();
    if (!pending || !answer || disabled) return;
    clarificationRequest.current = null;
    setGenerationRetryUsed(false);
    void generate(pending.useOriginal ? pending.instruction : answer);
  };

  const reviseProposal = () => {
    if (session?.state !== "proposalReady" || !revision.trim()) return;
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
    void generate(minimalRevisionRequest(locale), "revision");
  };

  const regenerateProposal = () => {
    if (session?.state !== "proposalReady" || !lastGenerationInstruction.current) return;
    setGenerationRetryUsed(false);
    void generate(lastGenerationInstruction.current, "regeneration");
  };

  const retryGeneration = () => {
    if (
      disabled ||
      session?.state !== "failed" ||
      !session.failure?.retryable ||
      generationRetryUsed ||
      !lastGenerationInstruction.current ||
      runtime.confirmation.inspect().generatedProposal
    ) {
      return;
    }
    setGenerationRetryUsed(true);
    void generate(lastGenerationInstruction.current);
  };

  const applyConfirmationResult = (result: AiProposalConfirmationResult) => {
    const generated = result.generatedProposal;
    if (result.state === "accepting" && generated) {
      setSession(
        uiSession("accepting", statuses.accepting, {
          selectedSectionId:
            generated.editorTarget.type === "section" ? generated.editorTarget.sectionId : null,
          affectedSectionIds: affectedSectionIds(generated.proposal),
        }),
      );
      return;
    }
    if (result.state === "failed" && generated && result.failure) {
      setSession(
        uiSession("failed", result.failure.message, {
          selectedSectionId:
            generated.editorTarget.type === "section" ? generated.editorTarget.sectionId : null,
          affectedSectionIds: affectedSectionIds(generated.proposal),
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
    const result = runtime.confirmation.reject();
    applyConfirmationResult(result);
    if (result.generatedProposal) {
      trackConfirmationEvent("ai_proposal_rejected", result.generatedProposal);
    }
  };

  const cancelSession = () => {
    if (disabled) return;
    actionSequence.current += 1;
    closePending();
    applyConfirmationResult(
      runtime.confirmation.inspect().state === "closed"
        ? runtime.confirmation.inspect()
        : runtime.confirmation.close(),
    );
  };

  const restartSession = () => {
    if (disabled) return;
    closePending();
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
    updateRuntimeIdentity(nextPage, nextSectionId);
    actionSequence.current += 1;
    acceptancePending.current = false;
    generationPending.current = false;
    clarificationRequest.current = null;
    setClarificationAnswer("");
    setRevision("");

    const current = runtime.confirmation.inspect();
    const hasContextBoundWorkflow = Boolean(
      session &&
      ["needsClarification", "generating", "proposalReady", "revising", "accepting"].includes(
        session.state,
      ),
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
      setSession(
        uiSession("superseded", status, {
          failure: { message: status, retryable: false },
        }),
      );
    }
  };

  const closeForPageSwitch = (nextPage: PageModel) => {
    supersedeForContextChange(nextPage, undefined, statuses.pageSwitch);
  };

  const closeForPageMutation = (nextPage: PageModel) => {
    supersedeForContextChange(nextPage, selectedSectionId, statuses.stale);
  };

  const closeForSelectionChange = (nextSectionId?: string) => {
    if (nextSectionId === selectedSectionId) return;
    supersedeForContextChange(page, nextSectionId, statuses.contextSwitch);
  };

  const closeForLocaleChange = () => {
    supersedeForContextChange(page, selectedSectionId, statuses.localeSwitch);
  };

  const confirmation = runtime.confirmation.inspect();
  const generatedProposal =
    confirmation.generatedProposal?.proposal.status === "pending"
      ? confirmation.generatedProposal
      : null;

  const visibleState = session?.state ?? "idle";
  const statusMessage = localize(session?.status ?? statuses.idle);
  const previewActive =
    generatedProposal !== null &&
    (session?.state === "proposalReady" ||
      session?.state === "accepting" ||
      session?.state === "failed");
  const blocksSave = previewActive || session?.state === "needsClarification";
  const controlsDisabled =
    disabled || ["generating", "revising", "accepting"].includes(visibleState);
  const generationRetryAvailable =
    session?.state === "failed" &&
    Boolean(session.failure?.retryable) &&
    !generationRetryUsed &&
    Boolean(request.trim()) &&
    generatedProposal === null;
  const updateRequest = (nextRequest: string) => {
    setRequest(nextRequest);
    if (session && ["failed", "stale", "superseded"].includes(session.state)) {
      setSession(uiSession("idle", statuses.idle));
    }
  };

  return {
    request,
    setRequest: updateRequest,
    clarificationAnswer,
    setClarificationAnswer,
    revision,
    setRevision,
    session,
    generatedProposal,
    visibleState,
    statusMessage,
    previewActive,
    blocksSave,
    controlsDisabled,
    generationRetryAvailable,
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
  };
}
