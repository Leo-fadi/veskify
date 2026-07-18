import {
  cloneOnboardingSession,
  getOnboardingStep,
  onboardingSessionSchema,
  onboardingStepRegistry,
  type OnboardingCreationPath,
  type OnboardingSession,
} from "@/domain/onboarding";
import type {
  OnboardingSessionLoadResult,
  OnboardingSessionRepository,
} from "@/services/onboarding";

export type OnboardingTransitionErrorCode =
  | "CREATION_PATH_REQUIRED"
  | "REQUIRED_STEP_CANNOT_BE_SKIPPED"
  | "STEP_NOT_AVAILABLE"
  | "NO_PREVIOUS_STEP"
  | "NO_NEXT_STEP"
  | "SESSION_COMPLETED";

export class OnboardingTransitionError extends Error {
  constructor(readonly code: OnboardingTransitionErrorCode) {
    super(code);
    this.name = "OnboardingTransitionError";
  }
}

export type OnboardingProgress = Readonly<{
  current: number;
  total: number;
  completed: number;
  skipped: number;
  percent: number;
}>;

export type OnboardingResumeResult =
  | { status: "new"; session: OnboardingSession }
  | { status: "resumed"; session: OnboardingSession }
  | Exclude<OnboardingSessionLoadResult, { status: "found" } | { status: "missing" }>;

export type OnboardingServiceOptions = {
  createId?: () => string;
  now?: () => string;
};

function defaultId(): string {
  return `onboarding_${crypto.randomUUID()}`;
}

export class OnboardingService {
  readonly #repository: OnboardingSessionRepository;
  readonly #createId: () => string;
  readonly #now: () => string;

  constructor(repository: OnboardingSessionRepository, options: OnboardingServiceOptions = {}) {
    this.#repository = repository;
    this.#createId = options.createId ?? defaultId;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  async createSession(): Promise<OnboardingSession> {
    const timestamp = this.#now();
    const session = onboardingSessionSchema.parse({
      id: this.#createId(),
      schemaVersion: 1,
      creationPath: null,
      activeStepId: "creation-path",
      completedStepIds: [],
      skippedStepIds: [],
      selectedLanguages: ["en"],
      primaryLanguage: "en",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await this.#repository.save(session);
    return cloneOnboardingSession(session);
  }

  loadSession(): Promise<OnboardingSessionLoadResult> {
    return this.#repository.load();
  }

  async resume(): Promise<OnboardingResumeResult> {
    const result = await this.loadSession();
    if (result.status === "missing") {
      return { status: "new", session: await this.createSession() };
    }
    if (result.status === "found") {
      return { status: "resumed", session: cloneOnboardingSession(result.session) };
    }
    return result;
  }

  async selectCreationPath(
    input: OnboardingSession,
    creationPath: OnboardingCreationPath,
  ): Promise<OnboardingSession> {
    const session = this.#validateActive(input);
    if (session.activeStepId !== "creation-path") {
      throw new OnboardingTransitionError("STEP_NOT_AVAILABLE");
    }
    return this.#commit({ ...session, creationPath });
  }

  async advance(input: OnboardingSession): Promise<OnboardingSession> {
    const session = this.#validateActive(input);
    const step = getOnboardingStep(session.activeStepId);
    if (!step.completableNow) throw new OnboardingTransitionError("STEP_NOT_AVAILABLE");
    if (step.id === "creation-path" && session.creationPath === null) {
      throw new OnboardingTransitionError("CREATION_PATH_REQUIRED");
    }
    if (!step.nextStepId) throw new OnboardingTransitionError("NO_NEXT_STEP");

    const completedStepIds = session.completedStepIds.includes(step.id)
      ? session.completedStepIds
      : [...session.completedStepIds, step.id];
    return this.#commit({
      ...session,
      activeStepId: step.nextStepId,
      completedStepIds,
      skippedStepIds: session.skippedStepIds.filter((stepId) => stepId !== step.id),
    });
  }

  async goBack(input: OnboardingSession): Promise<OnboardingSession> {
    const session = onboardingSessionSchema.parse(input);
    const previousStepId = getOnboardingStep(session.activeStepId).previousStepId;
    if (!previousStepId) throw new OnboardingTransitionError("NO_PREVIOUS_STEP");
    return this.#commit({ ...session, activeStepId: previousStepId, status: "active" });
  }

  async skip(input: OnboardingSession): Promise<OnboardingSession> {
    const session = this.#validateActive(input);
    const step = getOnboardingStep(session.activeStepId);
    if (!step.optional) throw new OnboardingTransitionError("REQUIRED_STEP_CANNOT_BE_SKIPPED");
    if (!step.nextStepId) throw new OnboardingTransitionError("NO_NEXT_STEP");
    const skippedStepIds = session.skippedStepIds.includes(step.id)
      ? session.skippedStepIds
      : [...session.skippedStepIds, step.id];
    return this.#commit({
      ...session,
      activeStepId: step.nextStepId,
      completedStepIds: session.completedStepIds.filter((stepId) => stepId !== step.id),
      skippedStepIds,
    });
  }

  async reset(): Promise<OnboardingSession> {
    return this.createSession();
  }

  inspectProgress(input: OnboardingSession): OnboardingProgress {
    const session = onboardingSessionSchema.parse(input);
    const current = getOnboardingStep(session.activeStepId).position;
    const completed = session.completedStepIds.length;
    const skipped = session.skippedStepIds.length;
    return Object.freeze({
      current,
      total: onboardingStepRegistry.length,
      completed,
      skipped,
      percent: Math.round((completed / onboardingStepRegistry.length) * 100),
    });
  }

  #validateActive(input: OnboardingSession): OnboardingSession {
    const session = onboardingSessionSchema.parse(input);
    if (session.status === "completed") {
      throw new OnboardingTransitionError("SESSION_COMPLETED");
    }
    return session;
  }

  async #commit(input: OnboardingSession): Promise<OnboardingSession> {
    const next = onboardingSessionSchema.parse({ ...input, updatedAt: this.#now() });
    await this.#repository.save(next);
    return cloneOnboardingSession(next);
  }
}
