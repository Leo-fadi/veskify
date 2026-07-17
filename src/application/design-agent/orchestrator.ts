import {
  type DesignProposal,
  type InMemoryDesignProposalStore,
} from "@/application/design-operations";
import {
  campaignContextSchema,
  createDeterministicDesignProvider,
  designRequestClassificationSchema,
  hasMeaningfulCampaignContext,
  type CampaignContext,
  type DesignPlannerInput,
  type DeterministicDesignProvider,
} from "@/application/design-skills";
import { validateRegisteredPage, type StorefrontRenderContext } from "@/components/registry";
import { brandSystemSchema, type BrandSystem } from "@/domain/design-system";
import { localeSchema, type Locale, type LocalizedText } from "@/domain/shared";
import {
  pageModelSchema,
  pageTypeSchema,
  type PageModel,
  type PageType,
} from "@/domain/storefront";
import {
  type DesignAgentFailure,
  type DesignAgentSession,
  type DesignAgentSessionState,
} from "./contract";
import {
  classifyRevisionInstruction,
  constrainDesignPlanForRevision,
  minimalRevisionRequest,
  revisionSummary,
} from "./revisions";
import { InMemoryDesignAgentSessionStore } from "./session-store";

export type StartDesignAgentSessionInput = {
  sessionId?: string;
  projectId: string;
  page: PageModel;
  pageType: PageType;
  activeLocale: Locale;
  brandSystem: BrandSystem;
  displayContext: StorefrontRenderContext;
  selectedSectionId?: string;
  campaign?: CampaignContext;
};

export type DesignAgentActionOutcome =
  | "sessionStarted"
  | "needsClarification"
  | "proposalReady"
  | "unsupported"
  | "failed"
  | "regenerationFailed"
  | "revisionFailed"
  | "stale"
  | "unsupportedRevision"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "restarted";

export type DesignAgentActionResult = {
  outcome: DesignAgentActionOutcome;
  session: DesignAgentSession;
  proposal?: DesignProposal;
  page?: PageModel;
  message?: LocalizedText;
};

type SessionContext = {
  brandSystem: BrandSystem;
  displayContext: StorefrontRenderContext;
  initialCampaign?: CampaignContext;
  campaign?: CampaignContext;
  baseRequest: string | null;
};

const statuses: Record<DesignAgentSessionState, LocalizedText> = {
  idle: { en: "Ready for a design request.", fi: "Valmis uuteen suunnittelupyyntöön." },
  classifying: {
    en: "Understanding the requested result.",
    fi: "Tulkitaan toivottua lopputulosta.",
  },
  needsClarification: {
    en: "One answer is needed before the proposal can be prepared.",
    fi: "Tarvitaan yksi vastaus ennen ehdotuksen valmistelua.",
  },
  planning: { en: "Preparing a safe design plan.", fi: "Valmistellaan turvallista suunnitelmaa." },
  generating: { en: "Preparing the design proposal.", fi: "Valmistellaan suunnitteluehdotusta." },
  proposalReady: {
    en: "The proposal is ready to review.",
    fi: "Ehdotus on valmis tarkistettavaksi.",
  },
  revising: {
    en: "Rebuilding the proposal from the original page.",
    fi: "Ehdotus rakennetaan uudelleen alkuperäisestä sivusta.",
  },
  accepted: {
    en: "The proposal was accepted for draft application.",
    fi: "Ehdotus hyväksyttiin luonnokseen sovellettavaksi.",
  },
  rejected: {
    en: "The proposal was rejected; the page remains unchanged.",
    fi: "Ehdotus hylättiin ja sivu säilyy ennallaan.",
  },
  cancelled: {
    en: "The request was cancelled; the page remains unchanged.",
    fi: "Pyyntö peruttiin ja sivu säilyy ennallaan.",
  },
  failed: {
    en: "The request could not produce a safe proposal.",
    fi: "Pyynnöstä ei voitu luoda turvallista ehdotusta.",
  },
};

const staleMessage: LocalizedText = {
  en: "The page changed after this request started. Start a new request from the current page.",
  fi: "Sivu muuttui pyynnön aloittamisen jälkeen. Aloita uusi pyyntö nykyiseltä sivulta.",
};

const unsupportedRevisionMessage: LocalizedText = {
  en: "That revision is not supported yet. The current proposal remains ready to review.",
  fi: "Tätä muutospyyntöä ei vielä tueta. Nykyinen ehdotus säilyy tarkistettavana.",
};

const regeneratingStatus: LocalizedText = {
  en: "Regenerating the proposal from the original request.",
  fi: "Luodaan ehdotus uudelleen alkuperäisestä pyynnöstä.",
};

const regeneratedReadyStatus: LocalizedText = {
  en: "A regenerated proposal is ready to review.",
  fi: "Uudelleen luotu ehdotus on valmis tarkistettavaksi.",
};

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function campaignCanBeDerived(context: SessionContext) {
  return Boolean(
    context.campaign?.objective ||
    context.campaign?.heading ||
    context.campaign?.body ||
    context.displayContext.catalogue.collections.length > 0,
  );
}

function campaignQuestion(): LocalizedText {
  return {
    en: "What should this campaign highlight?",
    fi: "Mitä tämän kampanjan tulisi korostaa?",
  };
}

function failure(
  code: DesignAgentFailure["code"],
  message: LocalizedText,
  details: string[] = [],
): DesignAgentFailure {
  return { code, message, details };
}

export class DeterministicDesignAgent {
  readonly #sessions: InMemoryDesignAgentSessionStore;
  readonly #provider: DeterministicDesignProvider;
  readonly #contexts = new Map<string, SessionContext>();
  #sessionSequence = 0;

  constructor({
    sessionStore = new InMemoryDesignAgentSessionStore(),
    proposalProvider = createDeterministicDesignProvider(),
  }: {
    sessionStore?: InMemoryDesignAgentSessionStore;
    proposalProvider?: DeterministicDesignProvider;
  } = {}) {
    this.#sessions = sessionStore;
    this.#provider = proposalProvider;
  }

  startSession(input: StartDesignAgentSessionInput): DesignAgentActionResult {
    const page = pageModelSchema.parse(structuredClone(input.page));
    const pageType = pageTypeSchema.parse(input.pageType);
    const locale = localeSchema.parse(input.activeLocale);
    const brandSystem = brandSystemSchema.parse(structuredClone(input.brandSystem));
    const displayContext = structuredClone(input.displayContext);
    if (page.id !== input.page.id || page.type !== pageType) {
      throw new Error("The session page and PageType must identify the same canonical page.");
    }
    validateRegisteredPage(page, displayContext);
    const campaign = hasMeaningfulCampaignContext(input.campaign)
      ? campaignContextSchema.parse(structuredClone(input.campaign))
      : undefined;
    this.#sessionSequence += 1;
    const sessionId =
      input.sessionId ??
      `session_${stableHash(`${input.projectId}:${page.id}:${this.#sessionSequence}`)}`;
    const session = this.#sessions.create({
      id: sessionId,
      projectId: input.projectId,
      pageId: page.id,
      pageType,
      locale,
      originalPage: page,
      initialMerchantRequest: null,
      currentMerchantRequest: null,
      selectedSectionId: input.selectedSectionId ?? null,
      normalizedIntent: null,
      classification: null,
      plan: null,
      activeProposalId: null,
      proposalAttemptSequence: 0,
      revisionCount: 0,
      assumptions: [],
      clarificationQuestion: null,
      clarificationAnswer: null,
      revisionSummary: null,
      status: statuses.idle,
      state: "idle",
      failure: null,
    });
    this.#contexts.set(session.id, {
      brandSystem,
      displayContext,
      initialCampaign: campaign,
      campaign,
      baseRequest: null,
    });
    return { outcome: "sessionStarted", session };
  }

  inspectSession(sessionId: string) {
    return this.#sessions.inspect(sessionId);
  }

  inspectProposal(sessionId: string) {
    const session = this.#sessions.inspect(sessionId);
    if (!session.activeProposalId) throw new Error(`Session ${sessionId} has no proposal.`);
    return this.#provider.inspect(session.activeProposalId);
  }

  listActiveSessions(projectId: string, pageId?: string) {
    return this.#sessions.listActive(projectId, pageId);
  }

  submitRequest(sessionId: string, merchantRequest: string): DesignAgentActionResult {
    const session = this.#sessions.inspect(sessionId);
    if (session.state !== "idle") {
      throw new Error(`Session ${sessionId} must be idle before submitting a request.`);
    }
    const request = merchantRequest.trim();
    if (!request) throw new Error("A merchant request is required.");
    this.#sessions.transition(sessionId, "classifying", {
      initialMerchantRequest: request,
      currentMerchantRequest: request,
      status: statuses.classifying,
      failure: null,
    });
    return this.#processRequest(sessionId, request, false);
  }

  answerClarification(sessionId: string, answerInput: string): DesignAgentActionResult {
    const session = this.#sessions.inspect(sessionId);
    if (session.state !== "needsClarification") {
      throw new Error(`Session ${sessionId} is not waiting for clarification.`);
    }
    const answer = answerInput.trim();
    if (!answer) throw new Error("A clarification answer is required.");
    const context = this.#context(sessionId);
    const campaignClarification = session.normalizedIntent === "campaignSection";
    if (campaignClarification) {
      context.campaign = campaignContextSchema.parse({
        objective: session.locale === "fi" ? { fi: answer } : { en: answer },
      });
    }
    this.#sessions.transition(sessionId, "classifying", {
      clarificationAnswer: answer,
      currentMerchantRequest: campaignClarification ? session.currentMerchantRequest : answer,
      status: statuses.classifying,
      failure: null,
    });
    return this.#processRequest(
      sessionId,
      campaignClarification ? session.initialMerchantRequest! : answer,
      campaignClarification,
    );
  }

  reviseProposal(
    sessionId: string,
    instruction: string,
    currentPage: PageModel,
  ): DesignAgentActionResult {
    const session = this.#sessions.inspect(sessionId);
    if (session.state !== "proposalReady") {
      throw new Error("Only a ready proposal can be revised; restart a closed session first.");
    }
    if (this.#isStale(session, currentPage)) {
      return { outcome: "stale", session, message: staleMessage };
    }
    const kind = classifyRevisionInstruction(instruction);
    if (!kind) {
      return { outcome: "unsupportedRevision", session, message: unsupportedRevisionMessage };
    }
    if (kind === "startOver") return this.restartSession(sessionId);

    const context = this.#context(sessionId);
    const previousProposalId = session.activeProposalId!;
    const nextRevisionCount = session.revisionCount + 1;
    const nextProposalAttempt = session.proposalAttemptSequence + 1;
    this.#sessions.transition(sessionId, "revising", {
      currentMerchantRequest: instruction.trim(),
      proposalAttemptSequence: nextProposalAttempt,
      revisionSummary: revisionSummary(kind),
      status: statuses.revising,
      failure: null,
    });

    try {
      const request =
        kind === "makeMinimal"
          ? minimalRevisionRequest(session.locale)
          : (context.baseRequest ?? session.initialMerchantRequest!);
      const plannerInput = this.#plannerInput(session, request);
      const classification = this.#provider.classifyDesignRequest(request, session.locale);
      const initialPlan = this.#provider.createDesignPlan(plannerInput);
      const plan =
        kind === "keepHero" || kind === "omitCampaign"
          ? constrainDesignPlanForRevision(initialPlan, session.originalPage, kind)
          : initialPlan;
      if (!plan.validation.valid) throw new Error(plan.validation.errors.join(" "));
      const execution = this.#provider.executeDesignPlan(plan, plannerInput);
      if (!execution.validation.valid || execution.failureReason) {
        throw new Error(execution.validation.errors.join(" "));
      }
      const proposal = this.#provider.createProposalFromDesignPlan(
        execution,
        context.displayContext,
        undefined,
        this.#proposalIdentity(session.id, nextProposalAttempt),
      );
      if (proposal.id === previousProposalId) {
        throw new Error("A revision must create a new proposal identity.");
      }
      this.#provider.reject(previousProposalId);
      if (kind === "makeMinimal") context.baseRequest = request;
      const revised = this.#sessions.transition(sessionId, "proposalReady", {
        normalizedIntent: classification.normalizedIntent,
        classification,
        plan,
        activeProposalId: proposal.id,
        revisionCount: nextRevisionCount,
        assumptions: plan.assumptions,
        clarificationQuestion: null,
        revisionSummary: revisionSummary(kind),
        status: statuses.proposalReady,
        failure: null,
      });
      return { outcome: "proposalReady", session: revised, proposal };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown revision failure.";
      const message: LocalizedText = {
        en: "The revision could not be validated. The previous proposal remains ready to review.",
        fi: "Muutosta ei voitu validoida. Edellinen ehdotus säilyy tarkistettavana.",
      };
      const restored = this.#sessions.transition(sessionId, "proposalReady", {
        activeProposalId: previousProposalId,
        status: message,
        failure: failure("executionFailed", message, [detail]),
      });
      return { outcome: "revisionFailed", session: restored, message };
    }
  }

  regenerateProposal(sessionId: string, currentPage: PageModel): DesignAgentActionResult {
    const session = this.#sessions.inspect(sessionId);
    if (session.state !== "proposalReady") {
      throw new Error(
        "Only a ready pending proposal can be regenerated; restart a closed session first.",
      );
    }
    const previousProposal = this.#provider.inspect(session.activeProposalId!);
    if (previousProposal.status !== "pending") {
      throw new Error("Only an active pending proposal can be regenerated.");
    }
    if (this.#isStale(session, currentPage)) {
      return { outcome: "stale", session, message: staleMessage };
    }
    const context = this.#context(sessionId);
    const request = context.baseRequest ?? session.initialMerchantRequest;
    if (!request) throw new Error("Regeneration requires the original merchant request.");
    const nextProposalAttempt = session.proposalAttemptSequence + 1;
    this.#sessions.transition(sessionId, "generating", {
      proposalAttemptSequence: nextProposalAttempt,
      status: regeneratingStatus,
      failure: null,
    });

    try {
      const plannerInput = this.#plannerInput(session, request);
      const classification = this.#provider.classifyDesignRequest(request, session.locale);
      if (
        classification.requiresClarification ||
        classification.unsupportedReason ||
        !classification.normalizedIntent
      ) {
        throw new Error("The original request no longer classifies as an executable request.");
      }
      const plan = this.#provider.createDesignPlan(plannerInput);
      if (!plan.validation.valid) throw new Error(plan.validation.errors.join(" "));
      const execution = this.#provider.executeDesignPlan(plan, plannerInput);
      if (!execution.validation.valid || execution.failureReason) {
        throw new Error(execution.validation.errors.join(" "));
      }
      const proposal = this.#provider.createProposalFromDesignPlan(
        execution,
        context.displayContext,
        undefined,
        this.#proposalIdentity(session.id, nextProposalAttempt),
      );
      if (proposal.id === previousProposal.id) {
        throw new Error("Regeneration must create a new proposal identity.");
      }
      this.#provider.reject(previousProposal.id);
      const regenerated = this.#sessions.transition(sessionId, "proposalReady", {
        normalizedIntent: classification.normalizedIntent,
        classification,
        plan,
        activeProposalId: proposal.id,
        assumptions: plan.assumptions,
        status: regeneratedReadyStatus,
        failure: null,
      });
      return { outcome: "proposalReady", session: regenerated, proposal };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown regeneration failure.";
      const message: LocalizedText = {
        en: "Regeneration could not be validated. The previous proposal remains ready to review.",
        fi: "Uudelleen luontia ei voitu validoida. Edellinen ehdotus säilyy tarkistettavana.",
      };
      const restored = this.#sessions.transition(sessionId, "proposalReady", {
        activeProposalId: previousProposal.id,
        status: message,
        failure: failure("executionFailed", message, [detail]),
      });
      return { outcome: "regenerationFailed", session: restored, message };
    }
  }

  acceptProposal(sessionId: string, currentPage: PageModel): DesignAgentActionResult {
    const session = this.#sessions.inspect(sessionId);
    if (session.state !== "proposalReady") {
      throw new Error("Only a ready proposal can be accepted; restart a closed session first.");
    }
    if (this.#isStale(session, currentPage)) {
      return { outcome: "stale", session, message: staleMessage };
    }
    const page = this.#provider.accept(session.activeProposalId!);
    const accepted = this.#sessions.transition(sessionId, "accepted", {
      status: statuses.accepted,
      failure: null,
    });
    return { outcome: "accepted", session: accepted, page };
  }

  rejectProposal(sessionId: string): DesignAgentActionResult {
    const session = this.#sessions.inspect(sessionId);
    if (session.state !== "proposalReady") {
      throw new Error("Only a ready proposal can be rejected.");
    }
    const page = this.#provider.reject(session.activeProposalId!);
    const rejected = this.#sessions.transition(sessionId, "rejected", {
      status: statuses.rejected,
      failure: null,
    });
    return { outcome: "rejected", session: rejected, page };
  }

  cancelSession(sessionId: string): DesignAgentActionResult {
    const session = this.#sessions.inspect(sessionId);
    if (session.activeProposalId) {
      const proposal = this.#provider.inspect(session.activeProposalId);
      if (proposal.status === "pending") this.#provider.reject(proposal.id);
    }
    const cancelled = this.#sessions.cancel(sessionId, {
      status: statuses.cancelled,
      failure: null,
    });
    return { outcome: "cancelled", session: cancelled, page: session.originalPage };
  }

  restartSession(sessionId: string): DesignAgentActionResult {
    const session = this.#sessions.inspect(sessionId);
    if (session.activeProposalId) {
      const proposal = this.#provider.inspect(session.activeProposalId);
      if (proposal.status === "pending") this.#provider.reject(proposal.id);
    }
    const context = this.#context(sessionId);
    context.campaign = context.initialCampaign
      ? structuredClone(context.initialCampaign)
      : undefined;
    context.baseRequest = null;
    const restarted = this.#sessions.transition(sessionId, "idle", {
      initialMerchantRequest: null,
      currentMerchantRequest: null,
      normalizedIntent: null,
      classification: null,
      plan: null,
      activeProposalId: null,
      revisionCount: 0,
      assumptions: [],
      clarificationQuestion: null,
      clarificationAnswer: null,
      revisionSummary: null,
      status: statuses.idle,
      failure: null,
    });
    return { outcome: "restarted", session: restarted, page: session.originalPage };
  }

  #processRequest(
    sessionId: string,
    request: string,
    campaignWasClarified: boolean,
  ): DesignAgentActionResult {
    const session = this.#sessions.inspect(sessionId);
    const context = this.#context(sessionId);
    let classification = this.#provider.classifyDesignRequest(request, session.locale);

    if (
      classification.normalizedIntent === "campaignSection" &&
      !campaignWasClarified &&
      !campaignCanBeDerived(context)
    ) {
      classification = designRequestClassificationSchema.parse({
        ...classification,
        requiresClarification: true,
        clarifications: [campaignQuestion()],
      });
    }

    if (classification.requiresClarification) {
      const question = classification.clarifications[0];
      const waiting = this.#sessions.transition(sessionId, "needsClarification", {
        normalizedIntent: classification.normalizedIntent,
        classification,
        clarificationQuestion: question,
        status: statuses.needsClarification,
        failure: null,
      });
      return { outcome: "needsClarification", session: waiting, message: question };
    }

    if (classification.unsupportedReason || !classification.normalizedIntent) {
      const message =
        classification.unsupportedReason ??
        ({
          en: "This request is not supported by the approved design capabilities.",
          fi: "Hyväksytyt suunnittelutoiminnot eivät tue tätä pyyntöä.",
        } satisfies LocalizedText);
      const failed = this.#sessions.transition(sessionId, "failed", {
        classification,
        normalizedIntent: null,
        status: statuses.failed,
        failure: failure("unsupportedRequest", message),
      });
      return { outcome: "unsupported", session: failed, message };
    }

    context.baseRequest = request;
    this.#sessions.transition(sessionId, "planning", {
      normalizedIntent: classification.normalizedIntent,
      classification,
      clarificationQuestion: null,
      status: statuses.planning,
      failure: null,
    });
    const planningSession = this.#sessions.inspect(sessionId);
    const plannerInput = this.#plannerInput(planningSession, request);
    const plan = this.#provider.createDesignPlan(plannerInput);
    if (!plan.validation.valid) {
      const message: LocalizedText = {
        en: "A safe plan could not be created for this page.",
        fi: "Tälle sivulle ei voitu luoda turvallista suunnitelmaa.",
      };
      const failed = this.#sessions.transition(sessionId, "failed", {
        plan,
        assumptions: plan.assumptions,
        status: statuses.failed,
        failure: failure("invalidPlan", message, plan.validation.errors),
      });
      return { outcome: "failed", session: failed, message };
    }

    this.#sessions.transition(sessionId, "generating", {
      plan,
      proposalAttemptSequence: planningSession.proposalAttemptSequence + 1,
      assumptions: plan.assumptions,
      status: statuses.generating,
      failure: null,
    });
    const execution = this.#provider.executeDesignPlan(plan, plannerInput);
    if (!execution.validation.valid || execution.failureReason) {
      const message =
        execution.failureReason ??
        ({
          en: "The proposal failed validation and the page remains unchanged.",
          fi: "Ehdotus ei läpäissyt validointia ja sivu säilyy ennallaan.",
        } satisfies LocalizedText);
      const failed = this.#sessions.transition(sessionId, "failed", {
        status: statuses.failed,
        failure: failure("executionFailed", message, execution.validation.errors),
      });
      return { outcome: "failed", session: failed, message };
    }
    const proposal = this.#provider.createProposalFromDesignPlan(
      execution,
      context.displayContext,
      undefined,
      this.#proposalIdentity(session.id, planningSession.proposalAttemptSequence + 1),
    );
    const ready = this.#sessions.transition(sessionId, "proposalReady", {
      activeProposalId: proposal.id,
      status: statuses.proposalReady,
      failure: null,
    });
    return { outcome: "proposalReady", session: ready, proposal };
  }

  #plannerInput(session: DesignAgentSession, request: string): DesignPlannerInput {
    const context = this.#context(session.id);
    return {
      merchantRequest: request,
      activeLocale: session.locale,
      page: structuredClone(session.originalPage),
      pageType: session.pageType,
      brandSystem: structuredClone(context.brandSystem),
      displayContext: structuredClone(context.displayContext),
      selectedSectionId: session.selectedSectionId ?? undefined,
      campaign: context.campaign ? structuredClone(context.campaign) : undefined,
    };
  }

  #isStale(session: DesignAgentSession, currentPageInput: PageModel) {
    const context = this.#context(session.id);
    try {
      const currentPage = pageModelSchema.parse(structuredClone(currentPageInput));
      validateRegisteredPage(currentPage, context.displayContext);
      return canonicalJson(currentPage) !== canonicalJson(session.originalPage);
    } catch {
      return true;
    }
  }

  #context(sessionId: string) {
    const context = this.#contexts.get(sessionId);
    if (!context) throw new Error(`Unknown design-agent context: ${sessionId}.`);
    return context;
  }

  #proposalIdentity(sessionId: string, attempt: number) {
    return `${sessionId}:attempt:${attempt}`;
  }
}

export function createDeterministicDesignAgent(options?: {
  sessionStore?: InMemoryDesignAgentSessionStore;
  proposalProvider?: DeterministicDesignProvider;
  proposalStore?: InMemoryDesignProposalStore;
}) {
  if (options?.proposalProvider && options.proposalStore) {
    throw new Error("Inject either a proposal provider or proposal store, not both.");
  }
  return new DeterministicDesignAgent({
    sessionStore: options?.sessionStore,
    proposalProvider:
      options?.proposalProvider ?? createDeterministicDesignProvider(options?.proposalStore),
  });
}
