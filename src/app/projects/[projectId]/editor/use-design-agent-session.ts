"use client";

import { useEffect, useRef, useState } from "react";
import {
  createDeterministicDesignAgent,
  type DesignAgentActionResult,
  type DesignAgentSession,
  type DesignAgentSessionState,
  type DeterministicDesignAgent,
} from "@/application/design-agent";
import type { DesignProposal } from "@/application/design-operations";
import type { StorefrontRenderContext } from "@/components/registry";
import type { BrandSystem } from "@/domain/design-system";
import { resolveLocalizedText, type Locale } from "@/domain/shared";
import type { PageModel } from "@/domain/storefront";

type AgentActivity = Extract<DesignAgentSessionState, "classifying" | "generating" | "revising">;

export type DesignAgentSessionController = {
  request: string;
  setRequest: (request: string) => void;
  clarificationAnswer: string;
  setClarificationAnswer: (answer: string) => void;
  revision: string;
  setRevision: (revision: string) => void;
  session: DesignAgentSession | null;
  proposal: DesignProposal | null;
  visibleState: DesignAgentSessionState;
  statusMessage: string;
  previewActive: boolean;
  blocksSave: boolean;
  controlsDisabled: boolean;
  submitRequest: () => void;
  answerClarification: () => void;
  reviseProposal: () => void;
  regenerateProposal: () => void;
  acceptProposal: () => void;
  rejectProposal: () => void;
  cancelSession: () => void;
  restartSession: () => void;
  closeForPageSwitch: () => void;
  closeForPageMutation: (nextPage: PageModel) => void;
};

type UseDesignAgentSessionInput = {
  lifecycleKey: string;
  projectId: string;
  page?: PageModel;
  activeLocale?: Locale;
  primaryLocale?: Locale;
  brandSystem?: BrandSystem;
  displayContext?: StorefrontRenderContext;
  selectedSectionId?: string;
  disabled: boolean;
  onAcceptedPage: (page: PageModel) => void;
};

const fallbackStatus = {
  en: "Ready for a design request.",
  fi: "Valmis uuteen suunnittelupyyntöön.",
} as const;

const friendlyError = {
  en: "That request could not be completed safely. Your current page has not changed.",
  fi: "Pyyntöä ei voitu toteuttaa turvallisesti. Nykyinen sivu säilyi ennallaan.",
} as const;

const pageSwitchStatus = {
  en: "The previous request was closed because you opened another page.",
  fi: "Edellinen pyyntö suljettiin, koska avasit toisen sivun.",
} as const;

const activityStatus: Record<AgentActivity, { en: string; fi: string }> = {
  classifying: {
    en: "Understanding your request.",
    fi: "Tulkitaan pyyntöäsi.",
  },
  generating: {
    en: "Preparing the design proposal.",
    fi: "Valmistellaan suunnitteluehdotusta.",
  },
  revising: {
    en: "Preparing the revised proposal.",
    fi: "Valmistellaan muokattua ehdotusta.",
  },
};

function cancelIfOpen(agent: DeterministicDesignAgent, session: DesignAgentSession | null) {
  if (!session || ["accepted", "rejected", "cancelled"].includes(session.state)) return;
  try {
    agent.cancelSession(session.id);
  } catch {
    // Cleanup is best-effort; the process-local agent becomes unreachable after reset.
  }
}

export function useDesignAgentSession({
  lifecycleKey,
  projectId,
  page,
  activeLocale,
  primaryLocale,
  brandSystem,
  displayContext,
  selectedSectionId,
  disabled,
  onAcceptedPage,
}: UseDesignAgentSessionInput): DesignAgentSessionController {
  const agentRef = useRef(createDeterministicDesignAgent());
  const sessionRef = useRef<DesignAgentSession | null>(null);
  const pendingAction = useRef(0);
  const initialLifecycle = useRef(true);
  const [request, setRequest] = useState("");
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [revision, setRevision] = useState("");
  const [session, setSessionState] = useState<DesignAgentSession | null>(null);
  const [proposal, setProposal] = useState<DesignProposal | null>(null);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const locale = activeLocale ?? primaryLocale ?? "en";
  const fallbackLocale = primaryLocale ?? locale;
  const localize = (value: { en?: string; fi?: string }) =>
    resolveLocalizedText(value, locale, fallbackLocale);

  const rememberSession = (nextSession: DesignAgentSession | null) => {
    const inspected = nextSession ? agentRef.current.inspectSession(nextSession.id) : null;
    sessionRef.current = inspected;
    setSessionState(inspected);
  };

  const clearVisibleWorkflow = (message?: string) => {
    pendingAction.current += 1;
    setActivity(null);
    setProposal(null);
    setClarificationAnswer("");
    setRevision("");
    if (message !== undefined) setNotice(message);
  };

  useEffect(() => {
    if (initialLifecycle.current) {
      initialLifecycle.current = false;
      return;
    }
    cancelIfOpen(agentRef.current, sessionRef.current);
    agentRef.current = createDeterministicDesignAgent();
    sessionRef.current = null;
    pendingAction.current += 1;
    setSessionState(null);
    setProposal(null);
    setActivity(null);
    setNotice(null);
    setRequest("");
    setClarificationAnswer("");
    setRevision("");
  }, [lifecycleKey]);

  useEffect(
    () => () => {
      pendingAction.current += 1;
      cancelIfOpen(agentRef.current, sessionRef.current);
    },
    [],
  );

  const applyResult = (result: DesignAgentActionResult, previous?: DesignProposal | null) => {
    rememberSession(result.session);
    setActivity(null);
    setNotice(result.message ? localize(result.message) : null);
    if (result.outcome === "proposalReady") {
      setProposal(result.proposal ?? previous ?? null);
      setRevision("");
      return;
    }
    if (result.outcome === "revisionFailed" || result.outcome === "regenerationFailed") {
      setProposal(previous ?? null);
      return;
    }
    if (result.outcome === "stale") {
      try {
        const cancelled = agentRef.current.cancelSession(result.session.id);
        rememberSession(cancelled.session);
      } catch {
        // The stale result already guarantees that the pending proposal was not applied.
      }
      setProposal(null);
      return;
    }
    if (result.outcome !== "needsClarification") setProposal(null);
  };

  const defer = (nextActivity: AgentActivity, action: () => DesignAgentActionResult) => {
    if (disabled || activity) return;
    const actionId = pendingAction.current + 1;
    pendingAction.current = actionId;
    setActivity(nextActivity);
    setNotice(null);
    window.setTimeout(() => {
      if (pendingAction.current !== actionId) return;
      try {
        applyResult(action(), proposal);
      } catch {
        setActivity(null);
        setNotice(localize(friendlyError));
      }
    }, 0);
  };

  const startCurrentSession = () => {
    if (!page || !activeLocale || !brandSystem || !displayContext) {
      throw new Error("The current editor page is not ready for a design request.");
    }
    cancelIfOpen(agentRef.current, sessionRef.current);
    const started = agentRef.current.startSession({
      projectId,
      page,
      pageType: page.type,
      activeLocale,
      brandSystem,
      displayContext,
      selectedSectionId,
    });
    rememberSession(started.session);
    return started.session;
  };

  const submitRequest = () => {
    if (!request.trim()) return;
    defer("classifying", () => {
      const started = startCurrentSession();
      return agentRef.current.submitRequest(started.id, request);
    });
  };

  const answerClarification = () => {
    if (!session || session.state !== "needsClarification" || !clarificationAnswer.trim()) return;
    defer("classifying", () =>
      agentRef.current.answerClarification(session.id, clarificationAnswer),
    );
  };

  const reviseProposal = () => {
    if (!session || !page || session.state !== "proposalReady" || !revision.trim()) return;
    defer("revising", () => agentRef.current.reviseProposal(session.id, revision, page));
  };

  const regenerateProposal = () => {
    if (!session || !page || session.state !== "proposalReady") return;
    defer("generating", () => agentRef.current.regenerateProposal(session.id, page));
  };

  const acceptProposal = () => {
    if (disabled || activity || !session || !page || session.state !== "proposalReady") return;
    try {
      const result = agentRef.current.acceptProposal(session.id, page);
      applyResult(result, proposal);
      if (result.outcome === "accepted" && result.page) onAcceptedPage(result.page);
    } catch {
      setNotice(localize(friendlyError));
    }
  };

  const rejectProposal = () => {
    if (disabled || activity || !session || session.state !== "proposalReady") return;
    try {
      applyResult(agentRef.current.rejectProposal(session.id), proposal);
    } catch {
      setNotice(localize(friendlyError));
    }
  };

  const cancelSession = () => {
    if (disabled || !session) return;
    try {
      applyResult(agentRef.current.cancelSession(session.id), proposal);
    } catch {
      setNotice(localize(friendlyError));
    }
  };

  const restartSession = () => {
    if (disabled || !session) return;
    try {
      const result = agentRef.current.restartSession(session.id);
      applyResult(result, proposal);
      setRequest("");
      setNotice(null);
    } catch {
      setNotice(localize(friendlyError));
    }
  };

  const closeForPageSwitch = () => {
    cancelIfOpen(agentRef.current, sessionRef.current);
    rememberSession(null);
    clearVisibleWorkflow(localize(pageSwitchStatus));
    setRequest("");
  };

  const closeForPageMutation = (nextPage: PageModel) => {
    const currentSession = sessionRef.current;
    if (
      !currentSession ||
      ["accepted", "rejected", "cancelled", "failed", "idle"].includes(currentSession.state)
    ) {
      return;
    }
    pendingAction.current += 1;
    try {
      if (currentSession.state === "proposalReady") {
        const result = agentRef.current.regenerateProposal(currentSession.id, nextPage);
        if (result.outcome === "stale") {
          applyResult(result, proposal);
          return;
        }
      }
      const cancelled = agentRef.current.cancelSession(currentSession.id);
      rememberSession(cancelled.session);
      setNotice(localize(cancelled.session.status));
    } catch {
      setNotice(localize(friendlyError));
    }
    setActivity(null);
    setProposal(null);
  };

  const visibleState = activity ?? session?.state ?? "idle";
  const statusMessage =
    notice ?? localize(activity ? activityStatus[activity] : (session?.status ?? fallbackStatus));
  const previewActive = proposal !== null && session?.state === "proposalReady";
  const blocksSave = activity !== null || session?.state === "needsClarification" || previewActive;

  return {
    request,
    setRequest,
    clarificationAnswer,
    setClarificationAnswer,
    revision,
    setRevision,
    session,
    proposal,
    visibleState,
    statusMessage,
    previewActive,
    blocksSave,
    controlsDisabled: disabled || activity !== null,
    submitRequest,
    answerClarification,
    reviseProposal,
    regenerateProposal,
    acceptProposal,
    rejectProposal,
    cancelSession,
    restartSession,
    closeForPageSwitch,
    closeForPageMutation,
  };
}
