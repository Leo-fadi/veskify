import {
  cloneOnboardingSession,
  creationPathToBriefContext,
  getOnboardingStep,
  onboardingBriefIdForSession,
  onboardingSessionSchema,
  onboardingStepRegistry,
  evaluateBusinessBasics as evaluateBusinessBasicsForBrief,
  type BusinessBasicsField,
  type OnboardingCreationPath,
  type OnboardingSession,
} from "@/domain/onboarding";
import {
  evaluateExistingSourcesCompletion,
  validateExistingStorefrontSource,
  type ExistingStorefrontSourceValidationCode,
} from "./existing-sources";
import {
  createEmptyStorefrontDesignBrief,
  updateStorefrontDesignBriefArea,
  type BusinessIdentity,
} from "@/domain/design-brief";
import {
  OnboardingStorageError,
  type OnboardingSessionLoadResult,
  type OnboardingSessionRepository,
} from "@/services/onboarding";

export type OnboardingTransitionErrorCode =
  | "CREATION_PATH_REQUIRED"
  | "BUSINESS_BASICS_INCOMPLETE"
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

export class OnboardingBusinessBasicsValidationError extends Error {
  readonly code = "BUSINESS_BASICS_INCOMPLETE" as const;

  constructor(readonly missingFields: readonly BusinessBasicsField[]) {
    super("Business basics are incomplete.");
    this.name = "OnboardingBusinessBasicsValidationError";
  }
}

export class OnboardingExistingSourcesValidationError extends Error {
  readonly code: ExistingStorefrontSourceValidationCode;

  constructor(code: ExistingStorefrontSourceValidationCode) {
    super(code);
    this.name = "OnboardingExistingSourcesValidationError";
    this.code = code;
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
    const id = this.#createId();
    const session = onboardingSessionSchema.parse({
      id,
      schemaVersion: 2,
      creationPath: null,
      activeStepId: "creation-path",
      completedStepIds: [],
      skippedStepIds: [],
      selectedLanguages: ["en"],
      primaryLanguage: "en",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      designBrief: createEmptyStorefrontDesignBrief({
        id: onboardingBriefIdForSession(id),
        now: timestamp,
      }),
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
      try {
        return { status: "new", session: await this.createSession() };
      } catch (error) {
        if (error instanceof OnboardingStorageError) return { status: "unavailable" };
        throw error;
      }
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
    const timestamp = this.#now();
    const context = creationPathToBriefContext(creationPath);
    const designBrief = updateStorefrontDesignBriefArea(
      session.designBrief,
      "creationContext",
      {
        type: context,
        existingStorefrontUrl:
          context === "redesign-existing-storefront"
            ? session.designBrief.creationContext.existingStorefrontUrl
            : null,
      },
      timestamp,
    );
    return this.#commit({ ...session, creationPath, designBrief }, timestamp);
  }

  async advance(input: OnboardingSession): Promise<OnboardingSession> {
    const session = this.#validateActive(input);
    const step = getOnboardingStep(session.activeStepId);
    if (step.id === "business-basics") return this.completeBusinessBasics(session);
    if (step.id === "existing-sources") return this.completeExistingSources(session);
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

  evaluateBusinessBasics(input: OnboardingSession) {
    const session = onboardingSessionSchema.parse(input);
    return evaluateBusinessBasicsForBrief(session.designBrief);
  }

  async updateBusinessIdentity(
    input: OnboardingSession,
    patch: Partial<Pick<BusinessIdentity, BusinessBasicsField>>,
  ): Promise<OnboardingSession> {
    const session = this.#validateBusinessBasicsStep(input);
    const timestamp = this.#now();
    const designBrief = updateStorefrontDesignBriefArea(
      session.designBrief,
      "businessIdentity",
      patch,
      timestamp,
    );
    return this.#commit(
      {
        ...session,
        designBrief,
        completedStepIds: session.completedStepIds.filter((stepId) => stepId !== "business-basics"),
      },
      timestamp,
    );
  }

  async updateBusinessIdentityField<Field extends BusinessBasicsField>(
    input: OnboardingSession,
    field: Field,
    value: BusinessIdentity[Field],
  ): Promise<OnboardingSession> {
    return this.updateBusinessIdentity(input, { [field]: value });
  }

  async completeBusinessBasics(
    input: OnboardingSession,
    patch?: Partial<Pick<BusinessIdentity, BusinessBasicsField>>,
  ): Promise<OnboardingSession> {
    const session = this.#validateBusinessBasicsStep(input);
    const timestamp = this.#now();
    const designBrief = patch
      ? updateStorefrontDesignBriefArea(session.designBrief, "businessIdentity", patch, timestamp)
      : session.designBrief;
    const evaluation = evaluateBusinessBasicsForBrief(designBrief);
    if (!evaluation.complete) {
      throw new OnboardingBusinessBasicsValidationError(evaluation.missingFields);
    }
    return this.#commit(
      {
        ...session,
        designBrief,
        activeStepId: "existing-sources",
        completedStepIds: session.completedStepIds.includes("business-basics")
          ? session.completedStepIds
          : [...session.completedStepIds, "business-basics"],
        skippedStepIds: session.skippedStepIds.filter((stepId) => stepId !== "business-basics"),
      },
      timestamp,
    );
  }

  evaluateExistingSourcesCompletion(input: OnboardingSession) {
    const session = onboardingSessionSchema.parse(input);
    return evaluateExistingSourcesCompletion(session.designBrief);
  }

  async updateExistingStorefrontUrl(
    input: OnboardingSession,
    value: string,
  ): Promise<OnboardingSession> {
    const session = this.#validateExistingSourcesStep(input);
    if (session.designBrief.creationContext.type !== "redesign-existing-storefront") {
      return cloneOnboardingSession(session);
    }
    const validation = validateExistingStorefrontSource(value);
    if (!validation.valid) throw new OnboardingExistingSourcesValidationError(validation.code);
    const designBrief = updateStorefrontDesignBriefArea(
      session.designBrief,
      "creationContext",
      { existingStorefrontUrl: validation.normalizedUrl },
      this.#now(),
    );
    return this.#commit({ ...session, designBrief });
  }

  async completeExistingSources(
    input: OnboardingSession,
    value?: string,
  ): Promise<OnboardingSession> {
    const session = this.#validateExistingSourcesStep(input);
    let designBrief = session.designBrief;
    if (session.designBrief.creationContext.type === "redesign-existing-storefront") {
      const candidate = value ?? session.designBrief.creationContext.existingStorefrontUrl ?? "";
      const validation = validateExistingStorefrontSource(candidate);
      if (!validation.valid) throw new OnboardingExistingSourcesValidationError(validation.code);
      designBrief = updateStorefrontDesignBriefArea(
        session.designBrief,
        "creationContext",
        { existingStorefrontUrl: validation.normalizedUrl },
        this.#now(),
      );
    }
    const evaluation = evaluateExistingSourcesCompletion(designBrief);
    if (!evaluation.complete) {
      throw new OnboardingExistingSourcesValidationError("EXISTING_STOREFRONT_URL_REQUIRED");
    }
    const completedStepIds: OnboardingSession["completedStepIds"] =
      session.completedStepIds.includes("existing-sources")
        ? session.completedStepIds
        : [...session.completedStepIds, "existing-sources"];
    return this.#commit({
      ...session,
      designBrief,
      activeStepId: "brand-assets",
      completedStepIds,
      skippedStepIds: session.skippedStepIds.filter((stepId) => stepId !== "existing-sources"),
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

  #validateBusinessBasicsStep(input: OnboardingSession): OnboardingSession {
    const session = this.#validateActive(input);
    if (session.activeStepId !== "business-basics") {
      throw new OnboardingTransitionError("STEP_NOT_AVAILABLE");
    }
    return session;
  }

  #validateExistingSourcesStep(input: OnboardingSession): OnboardingSession {
    const session = this.#validateActive(input);
    if (session.activeStepId !== "existing-sources") {
      throw new OnboardingTransitionError("STEP_NOT_AVAILABLE");
    }
    return session;
  }

  async #commit(input: OnboardingSession, timestamp = this.#now()): Promise<OnboardingSession> {
    const updatedAt = new Date(
      Math.max(
        Date.parse(input.createdAt),
        Date.parse(input.updatedAt),
        Date.parse(input.designBrief.updatedAt),
        Date.parse(timestamp),
      ),
    ).toISOString();
    const next = onboardingSessionSchema.parse({ ...input, updatedAt });
    await this.#repository.save(next);
    return cloneOnboardingSession(next);
  }
}
