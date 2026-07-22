import {
  approveAssetCandidate,
  approvedAssetProjection,
  assignAssetCandidateRole,
  cloneAssetReviewState,
  listAssetCandidatesRequiringReview,
  markAssetCandidateRequired,
  markAssetCandidateUnavailable,
  registerDiscoveredAssetCandidates,
  rejectAssetCandidate,
  type ApprovedAssetProjectionItem,
  type AssetReviewCandidate,
  type AssetReviewState,
} from "@/domain/asset-review";
import { cloneOnboardingSession, type OnboardingSession } from "@/domain/onboarding";
import type { AssetCandidate, SourceReference } from "@/domain/source-discovery";
import type { LocalizedText } from "@/domain/shared";
import { OnboardingStorageError, type OnboardingSessionRepository } from "@/services/onboarding";
import { synchronizeAssetReviewWithBrief } from "./workflow-integration";

export class AssetReviewPersistenceError extends Error {
  readonly code = "ASSET_REVIEW_PERSISTENCE_FAILED" as const;

  constructor(
    readonly safeState: AssetReviewState,
    options?: ErrorOptions,
  ) {
    super("The asset review could not be saved. Previously saved decisions are intact.", options);
    this.name = "AssetReviewPersistenceError";
  }
}

export class AssetReviewWorkflowError extends Error {
  readonly code = "ASSET_REVIEW_WORKFLOW_UNAVAILABLE" as const;

  constructor() {
    super("A persisted URL onboarding workflow is required for asset review.");
    this.name = "AssetReviewWorkflowError";
  }
}

export type AssetReviewServiceOptions = Readonly<{
  now?: () => string;
}>;

export class AssetReviewService {
  readonly #repository: OnboardingSessionRepository;
  readonly #now: () => string;

  constructor(repository: OnboardingSessionRepository, options: AssetReviewServiceOptions = {}) {
    this.#repository = repository;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  async listCandidatesRequiringReview(): Promise<AssetReviewCandidate[]> {
    const session = await this.#load();
    return listAssetCandidatesRequiringReview(session.urlBriefWorkflow.assetReview);
  }

  async approvedProjection(): Promise<ApprovedAssetProjectionItem[]> {
    const session = await this.#load();
    return approvedAssetProjection(session.urlBriefWorkflow.assetReview);
  }

  async synchronizeCandidates(input: {
    source: SourceReference;
    candidates: readonly AssetCandidate[];
    requiredCandidateIds?: readonly string[];
  }): Promise<AssetReviewState> {
    return this.#mutate((state) =>
      registerDiscoveredAssetCandidates({
        state,
        source: input.source,
        candidates: input.candidates,
        requiredCandidateIds: input.requiredCandidateIds,
        now: this.#now(),
      }),
    );
  }

  async assignRole(input: {
    candidateId: string;
    sourceReferenceId: string;
    expectedRevision: number;
    role: Parameters<typeof assignAssetCandidateRole>[0]["role"];
    alt?: LocalizedText | null;
    actorId: string;
    actorReference?: string | null;
    note?: string | null;
  }): Promise<AssetReviewState> {
    return this.#mutate((state) => assignAssetCandidateRole({ ...input, state, now: this.#now() }));
  }

  async approve(input: {
    candidateId: string;
    sourceReferenceId: string;
    expectedRevision: number;
    actorId: string;
    actorReference?: string | null;
    note?: string | null;
  }): Promise<AssetReviewState> {
    const session = await this.#load();
    const source = this.#source(session, input.sourceReferenceId);
    const safeState = session.urlBriefWorkflow.assetReview;
    const next = approveAssetCandidate({ ...input, state: safeState, source, now: this.#now() });
    return this.#persist(session, next, safeState);
  }

  async reject(input: {
    candidateId: string;
    sourceReferenceId: string;
    expectedRevision: number;
    actorId: string;
    actorReference?: string | null;
    note?: string | null;
  }): Promise<AssetReviewState> {
    return this.#mutate((state) => rejectAssetCandidate({ ...input, state, now: this.#now() }));
  }

  async markUnavailable(input: {
    candidateId: string;
    sourceReferenceId: string;
    expectedRevision: number;
    reason: string;
  }): Promise<AssetReviewState> {
    return this.#mutate((state) =>
      markAssetCandidateUnavailable({ ...input, state, now: this.#now() }),
    );
  }

  async markRequired(input: {
    candidateId: string;
    sourceReferenceId: string;
    expectedRevision: number;
    required: boolean;
  }): Promise<AssetReviewState> {
    return this.#mutate((state) => markAssetCandidateRequired({ ...input, state }));
  }

  async #mutate(
    mutation: (state: AssetReviewState) => AssetReviewState,
  ): Promise<AssetReviewState> {
    const session = await this.#load();
    const safeState = session.urlBriefWorkflow.assetReview;
    const next = mutation(safeState);
    return this.#persist(session, next, safeState);
  }

  async #load(): Promise<OnboardingSession> {
    const loaded = await this.#repository.load();
    if (loaded.status !== "found") throw new AssetReviewWorkflowError();
    return cloneOnboardingSession(loaded.session);
  }

  #source(session: OnboardingSession, sourceReferenceId: string): SourceReference {
    const source = session.urlBriefWorkflow.sourceReferences.find(
      (candidate) => candidate.id === sourceReferenceId,
    );
    if (!source) throw new AssetReviewWorkflowError();
    return source;
  }

  async #persist(
    session: OnboardingSession,
    next: AssetReviewState,
    safeState: AssetReviewState,
  ): Promise<AssetReviewState> {
    const now = this.#now();
    const workflow = synchronizeAssetReviewWithBrief(session.urlBriefWorkflow, next, now);
    const updated = cloneOnboardingSession({
      ...session,
      urlBriefWorkflow: workflow,
      updatedAt: new Date(
        Math.max(Date.parse(session.updatedAt), Date.parse(workflow.updatedAt)),
      ).toISOString(),
    });
    try {
      await this.#repository.save(updated);
      return cloneAssetReviewState(next);
    } catch (error) {
      throw new AssetReviewPersistenceError(cloneAssetReviewState(safeState), {
        cause: error instanceof OnboardingStorageError ? error : undefined,
      });
    }
  }
}
