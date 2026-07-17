import {
  designAgentSessionSchema,
  type DesignAgentSession,
  type DesignAgentSessionState,
} from "./contract";

const transitions: Readonly<Record<DesignAgentSessionState, readonly DesignAgentSessionState[]>> = {
  idle: ["classifying", "cancelled"],
  classifying: ["needsClarification", "planning", "failed", "cancelled"],
  needsClarification: ["classifying", "idle", "cancelled"],
  planning: ["generating", "failed", "cancelled"],
  generating: ["proposalReady", "failed", "cancelled"],
  proposalReady: ["generating", "revising", "accepted", "rejected", "cancelled", "idle"],
  revising: ["proposalReady", "failed", "cancelled"],
  accepted: ["idle"],
  rejected: ["idle"],
  cancelled: ["idle"],
  failed: ["idle", "cancelled"],
};

const activeStates = new Set<DesignAgentSessionState>([
  "idle",
  "classifying",
  "needsClarification",
  "planning",
  "generating",
  "proposalReady",
  "revising",
]);

type SessionPatch = Partial<
  Omit<
    DesignAgentSession,
    | "id"
    | "projectId"
    | "pageId"
    | "pageType"
    | "originalPage"
    | "state"
    | "createdAt"
    | "updatedAt"
  >
>;

export class InMemoryDesignAgentSessionStore {
  readonly #sessions = new Map<string, DesignAgentSession>();
  readonly #now: () => string;

  constructor(now: () => string = () => new Date().toISOString()) {
    this.#now = now;
  }

  create(
    input: Omit<DesignAgentSession, "createdAt" | "updatedAt"> &
      Partial<Pick<DesignAgentSession, "createdAt" | "updatedAt">>,
  ): DesignAgentSession {
    if (this.#sessions.has(input.id)) {
      throw new Error(`Duplicate design-agent session ID: ${input.id}.`);
    }
    const createdAt = input.createdAt ?? this.#now();
    const session = designAgentSessionSchema.parse({
      ...structuredClone(input),
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
    });
    this.#sessions.set(session.id, structuredClone(session));
    return structuredClone(session);
  }

  inspect(id: string): DesignAgentSession {
    const session = this.#sessions.get(id);
    if (!session) throw new Error(`Unknown design-agent session: ${id}.`);
    return structuredClone(session);
  }

  transition(
    id: string,
    nextState: DesignAgentSessionState,
    patch: SessionPatch = {},
  ): DesignAgentSession {
    const current = this.inspect(id);
    if (!transitions[current.state].includes(nextState)) {
      throw new Error(`Invalid design-agent transition: ${current.state} -> ${nextState}.`);
    }
    const candidate = designAgentSessionSchema.parse({
      ...current,
      ...structuredClone(patch),
      id: current.id,
      projectId: current.projectId,
      pageId: current.pageId,
      pageType: current.pageType,
      originalPage: current.originalPage,
      state: nextState,
      createdAt: current.createdAt,
      updatedAt: this.#now(),
    });
    this.#sessions.set(id, structuredClone(candidate));
    return structuredClone(candidate);
  }

  listActive(projectId: string, pageId?: string): DesignAgentSession[] {
    return [...this.#sessions.values()]
      .filter(
        (session) =>
          session.projectId === projectId &&
          (!pageId || session.pageId === pageId) &&
          activeStates.has(session.state),
      )
      .map((session) => structuredClone(session));
  }

  cancel(id: string, patch: SessionPatch = {}): DesignAgentSession {
    return this.transition(id, "cancelled", patch);
  }
}
