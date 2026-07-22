import {
  approveStorefrontDesignBrief,
  createDeterministicMockDiscoveryAdapter,
  createStorefrontDesignBrief,
  discoverStorefrontSource,
  proposeBrandReconstruction,
  reconcileStorefrontSources,
  requireApprovedCurrentStorefrontDesignBrief,
  SourceDiscoveryApplicationError,
  supersedeStorefrontDesignBrief,
  updateStorefrontDesignBriefReview,
  type SourceDiscoveryAdapter,
  type SourceDiscoveryApplicationErrorCode,
} from "@/application/source-discovery";
import {
  cloneUrlBriefWorkflow,
  currentUrlBrief,
  merchantReconciliationResolutionSchema,
  unresolvedReconciliationDecisionIds,
  urlBriefWorkflowMaterialEvidence,
  urlBriefWorkflowSchema,
  urlBriefWorkflowSafeStateSchema,
  type MerchantReconciliationResolution,
  type OnboardingSession,
  type UrlBriefWorkflow,
  type UrlBriefWorkflowSafeState,
} from "@/domain/onboarding";
import {
  createStorefrontSourceEvidenceFingerprint,
  normalizeSourceUrl,
  sourceDiscoveryResultSchema,
  sourceReferenceSchema,
  type CanonicalCommerceProjection,
  type SourceFailureCode,
  type SourceReference,
  type StorefrontDesignBriefContract,
} from "@/domain/source-discovery";
import { localeSchema, type Locale } from "@/domain/shared";
import { OnboardingStorageError, type OnboardingSessionRepository } from "@/services/onboarding";

export interface CanonicalCommerceProjectionProvider {
  load(): Promise<CanonicalCommerceProjection | null> | CanonicalCommerceProjection | null;
}

export type UrlBriefWorkflowServiceOptions = Readonly<{
  now?: () => string;
  createSourceId?: () => string;
  discoveryPolicy?: SourceReference["allowedDiscoveryPolicy"];
}>;

export type PrepareUrlStorefrontBriefInput = Readonly<{
  businessIdentity: unknown;
  languagePlan: unknown;
  approvedBrandDirection?: unknown;
  approvedReusableAssetIds?: readonly string[];
  pagePlan?: unknown;
  navigationDirection?: readonly string[];
  homepageGoals?: readonly string[];
  collectionPageGoals?: readonly string[];
  productPageGoals?: readonly string[];
  visualPriorities?: readonly string[];
  contentAssumptions?: readonly string[];
  materialUnresolvedBlockers?: readonly string[];
  excludedClaims?: readonly string[];
  generationPermissions?: Partial<StorefrontDesignBriefContract["generationPermissions"]>;
}>;

export type CanonicalMerchantReconciliationMatch = Readonly<{
  canonicalProductId?: string | null;
  canonicalCollectionId?: string | null;
}>;

export class UrlBriefWorkflowOperationError extends Error {
  constructor(
    readonly code: SourceDiscoveryApplicationErrorCode,
    message: string,
    readonly workflow: UrlBriefWorkflow,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "UrlBriefWorkflowOperationError";
  }
}

export class UrlBriefWorkflowPersistenceError extends Error {
  readonly code = "ONBOARDING_WORKFLOW_PERSISTENCE_FAILED" as const;

  constructor(
    readonly safeWorkflow: UrlBriefWorkflow,
    options?: ErrorOptions,
  ) {
    super(
      "The URL onboarding workflow could not be saved. Previously saved progress is intact.",
      options,
    );
    this.name = "UrlBriefWorkflowPersistenceError";
  }
}

type LoadedWorkflow = Readonly<{
  session: OnboardingSession;
  workflow: UrlBriefWorkflow;
}>;

const deterministicPolicy: SourceReference["allowedDiscoveryPolicy"] = {
  mode: "deterministic",
  maxPages: 5,
  maxAssets: 20,
  followSameOriginOnly: true,
};

function replaceSource(
  references: readonly SourceReference[],
  source: SourceReference,
): SourceReference[] {
  const withoutCurrent = references.filter((candidate) => candidate.id !== source.id);
  return [...withoutCurrent, source];
}

function failureCode(error: unknown): SourceDiscoveryApplicationErrorCode {
  return error instanceof SourceDiscoveryApplicationError ||
    error instanceof UrlBriefWorkflowOperationError
    ? error.code
    : "unavailable-source";
}

function sourceFailureCode(code: SourceDiscoveryApplicationErrorCode): SourceFailureCode {
  switch (code) {
    case "invalid-url":
    case "unsupported-protocol":
    case "blocked-source":
    case "unavailable-source":
    case "timeout":
    case "no-reusable-evidence":
    case "conflicting-evidence":
    case "missing-canonical-vesko-projection":
    case "stale-brief-approval":
      return code;
    default:
      return "unavailable-source";
  }
}

function retryableFailure(code: SourceDiscoveryApplicationErrorCode): boolean {
  return code !== "invalid-url" && code !== "unsupported-protocol" && code !== "invalid-contract";
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function workflowSafeState(workflow: UrlBriefWorkflow): UrlBriefWorkflowSafeState {
  return workflow.status === "discovering"
    ? workflow.lastSafeState
    : urlBriefWorkflowSafeStateSchema.parse(workflow.status);
}

function replaceBrief(
  briefs: readonly StorefrontDesignBriefContract[],
  brief: StorefrontDesignBriefContract,
): StorefrontDesignBriefContract[] {
  return [...briefs.filter((candidate) => candidate.revision !== brief.revision), brief].sort(
    (left, right) => left.revision - right.revision,
  );
}

function sourceReferencesMatch(left: SourceReference, right: SourceReference): boolean {
  return (
    left.id === right.id &&
    left.url === right.url &&
    left.normalizedOrigin === right.normalizedOrigin &&
    left.requestedLocale === right.requestedLocale
  );
}

export class UrlBriefWorkflowService {
  readonly #repository: OnboardingSessionRepository;
  readonly #adapter: SourceDiscoveryAdapter;
  readonly #commerce: CanonicalCommerceProjectionProvider;
  readonly #now: () => string;
  readonly #createSourceId: () => string;
  readonly #policy: SourceReference["allowedDiscoveryPolicy"];

  constructor(
    repository: OnboardingSessionRepository,
    adapter: SourceDiscoveryAdapter,
    commerce: CanonicalCommerceProjectionProvider,
    options: UrlBriefWorkflowServiceOptions = {},
  ) {
    this.#repository = repository;
    this.#adapter = adapter;
    this.#commerce = commerce;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#createSourceId = options.createSourceId ?? (() => `source_${crypto.randomUUID()}`);
    this.#policy = options.discoveryPolicy ?? deterministicPolicy;
  }

  async restore(): Promise<UrlBriefWorkflow> {
    const loaded = await this.#load();
    if (loaded.workflow.status !== "discovering") {
      return cloneUrlBriefWorkflow(loaded.workflow);
    }

    const timestamp = this.#now();
    const activeSource = loaded.workflow.sourceReferences.find(
      (source) => source.id === loaded.workflow.currentSourceReferenceId,
    );
    const reviewedSource = loaded.workflow.discoveryResult?.source;
    const restoredSource = activeSource
      ? sourceReferenceSchema.parse({
          ...(reviewedSource?.id === activeSource.id ? reviewedSource : activeSource),
          status: reviewedSource?.id === activeSource.id ? reviewedSource.status : "pending",
          failure: null,
        })
      : null;
    const restored = urlBriefWorkflowSchema.parse({
      ...loaded.workflow,
      status: loaded.workflow.lastSafeState,
      sourceReferences: restoredSource
        ? replaceSource(loaded.workflow.sourceReferences, restoredSource)
        : loaded.workflow.sourceReferences,
      failure: {
        code: "interrupted",
        message: "An interrupted discovery was restored to the latest safe workflow state.",
        retryable: true,
      },
      updatedAt: timestamp,
    });
    const persisted = await this.#persist(loaded.session, restored, loaded.workflow);
    return cloneUrlBriefWorkflow(persisted.workflow);
  }

  async submitSourceUrl(value: string, requestedLocale: Locale = "en"): Promise<UrlBriefWorkflow> {
    const loaded = await this.#load();
    let parsed: URL;
    try {
      parsed = new URL(value.trim());
    } catch (error) {
      return this.#persistInputFailureAndThrow(
        loaded,
        "invalid-url",
        "Enter a valid public storefront URL.",
        error,
      );
    }
    if (parsed.protocol !== "https:") {
      return this.#persistInputFailureAndThrow(
        loaded,
        "unsupported-protocol",
        "The storefront URL must use HTTPS.",
      );
    }
    if (parsed.username || parsed.password) {
      return this.#persistInputFailureAndThrow(
        loaded,
        "invalid-url",
        "Storefront URLs containing credentials are not supported.",
      );
    }

    const normalized = normalizeSourceUrl(parsed.toString());
    const locale = localeSchema.parse(requestedLocale);
    const currentSource = loaded.workflow.sourceReferences.find(
      (candidate) => candidate.id === loaded.workflow.currentSourceReferenceId,
    );
    if (
      currentSource?.url === normalized.url &&
      currentSource.normalizedOrigin === normalized.normalizedOrigin &&
      currentSource.requestedLocale === locale
    ) {
      return cloneUrlBriefWorkflow(loaded.workflow);
    }

    const timestamp = this.#now();
    const source = sourceReferenceSchema.parse({
      id: this.#createSourceId(),
      sourceType: "merchant-provided-url",
      url: normalized.url,
      normalizedOrigin: normalized.normalizedOrigin,
      requestedLocale: locale,
      discoveredAt: timestamp,
      allowedDiscoveryPolicy: this.#policy,
      status: "pending",
      warnings: [],
      failure: null,
    });
    const next = urlBriefWorkflowSchema.parse({
      ...loaded.workflow,
      status: "source-submitted",
      lastSafeState: "source-submitted",
      sourceReferences: [source],
      currentSourceReferenceId: source.id,
      discoveryResult: null,
      reconciliation: null,
      merchantResolutions: [],
      unresolvedInformationIds: [],
      brandProposal: null,
      briefRevisions: [],
      currentBriefRevision: null,
      approvedEvidenceFingerprint: null,
      failure: null,
      updatedAt: timestamp,
    });
    const persisted = await this.#persist(loaded.session, next, loaded.workflow);
    return cloneUrlBriefWorkflow(persisted.workflow);
  }

  async discover(): Promise<UrlBriefWorkflow> {
    const loaded = await this.#load();
    const source = loaded.workflow.sourceReferences.find(
      (candidate) => candidate.id === loaded.workflow.currentSourceReferenceId,
    );
    if (!source) {
      throw new UrlBriefWorkflowOperationError(
        "invalid-lifecycle",
        "Submit a storefront URL before discovery.",
        cloneUrlBriefWorkflow(loaded.workflow),
      );
    }
    const timestamp = this.#now();
    const discoveringSource = sourceReferenceSchema.parse({
      ...source,
      discoveredAt: timestamp,
      status: "discovering",
      failure: null,
    });
    const safeState = workflowSafeState(loaded.workflow);
    const discovering = urlBriefWorkflowSchema.parse({
      ...loaded.workflow,
      status: "discovering",
      lastSafeState: safeState,
      sourceReferences: replaceSource(loaded.workflow.sourceReferences, discoveringSource),
      failure: null,
      updatedAt: timestamp,
    });
    const active = await this.#persist(loaded.session, discovering, loaded.workflow);

    try {
      const discovered = await discoverStorefrontSource(this.#adapter, discoveringSource);
      if (discovered.evidence.length === 0 && discovered.assetCandidates.length === 0) {
        throw new SourceDiscoveryApplicationError(
          "no-reusable-evidence",
          "The source did not provide reusable storefront evidence.",
        );
      }
      const completedSource = sourceReferenceSchema.parse({
        ...discovered.source,
        status: "complete",
        failure: null,
      });
      const completedResult = sourceDiscoveryResultSchema.parse({
        ...discovered,
        source: completedSource,
      });
      const next = urlBriefWorkflowSchema.parse({
        ...active.workflow,
        status: "evidence-ready",
        lastSafeState: "evidence-ready",
        sourceReferences: replaceSource(active.workflow.sourceReferences, completedSource),
        discoveryResult: completedResult,
        failure: null,
        updatedAt: this.#now(),
      });
      const persisted = await this.#persist(active.session, next, loaded.workflow);
      return cloneUrlBriefWorkflow(persisted.workflow);
    } catch (error) {
      if (error instanceof UrlBriefWorkflowPersistenceError) throw error;
      const code = failureCode(error);
      const failedSource = sourceReferenceSchema.parse({
        ...discoveringSource,
        status: "failed",
        failure: {
          code: sourceFailureCode(code),
          message: messageFor(error, "The storefront source could not be discovered."),
          retryable: retryableFailure(code),
        },
      });
      const failed = urlBriefWorkflowSchema.parse({
        ...active.workflow,
        status: "discovery-failed",
        lastSafeState: safeState,
        sourceReferences: replaceSource(active.workflow.sourceReferences, failedSource),
        failure: {
          code,
          message: messageFor(error, "The storefront source could not be discovered."),
          retryable: retryableFailure(code),
        },
        updatedAt: this.#now(),
      });
      const persisted = await this.#persist(active.session, failed, loaded.workflow);
      throw new UrlBriefWorkflowOperationError(
        code,
        persisted.workflow.failure?.message ?? "Source discovery failed.",
        cloneUrlBriefWorkflow(persisted.workflow),
        { cause: error },
      );
    }
  }

  async reconcile(): Promise<UrlBriefWorkflow> {
    const loaded = await this.#load();
    const discovery = loaded.workflow.discoveryResult;
    const currentSource = loaded.workflow.sourceReferences.find(
      (candidate) => candidate.id === loaded.workflow.currentSourceReferenceId,
    );
    if (!discovery || !currentSource || !sourceReferencesMatch(discovery.source, currentSource)) {
      throw new UrlBriefWorkflowOperationError(
        "invalid-lifecycle",
        "Discover evidence for the current storefront source before reconciliation.",
        cloneUrlBriefWorkflow(loaded.workflow),
      );
    }

    try {
      const canonicalCommerceProjection = await this.#commerce.load();
      const reconciliation = reconcileStorefrontSources({
        source: discovery.source,
        discovery,
        canonicalCommerceProjection,
      });
      const decisionIds = new Set(reconciliation.decisions.map((decision) => decision.id));
      const merchantResolutions = loaded.workflow.merchantResolutions.filter((resolution) =>
        decisionIds.has(resolution.decisionId),
      );
      const unresolvedInformationIds = unresolvedReconciliationDecisionIds(
        reconciliation,
        merchantResolutions,
      );
      let status: UrlBriefWorkflow["status"] =
        unresolvedInformationIds.length > 0 ? "reconciliation-needed" : "evidence-ready";
      let lastSafeState: UrlBriefWorkflowSafeState = status;
      const candidate = urlBriefWorkflowSchema.parse({
        ...loaded.workflow,
        status,
        lastSafeState,
        reconciliation,
        merchantResolutions,
        unresolvedInformationIds,
        failure: null,
        updatedAt: this.#now(),
      });
      const brief = currentUrlBrief(candidate);
      const material = urlBriefWorkflowMaterialEvidence(candidate);
      if (brief?.status === "approved" && material) {
        const fingerprint = createStorefrontSourceEvidenceFingerprint(material);
        if (fingerprint === brief.approvedEvidenceFingerprint) {
          status = "approved";
          lastSafeState = "approved";
        } else {
          status = "stale";
          lastSafeState = "stale";
        }
      }
      const next = urlBriefWorkflowSchema.parse({ ...candidate, status, lastSafeState });
      const persisted = await this.#persist(loaded.session, next, loaded.workflow);
      return cloneUrlBriefWorkflow(persisted.workflow);
    } catch (error) {
      if (error instanceof UrlBriefWorkflowPersistenceError) throw error;
      const code = failureCode(error);
      const failed = urlBriefWorkflowSchema.parse({
        ...loaded.workflow,
        status: "discovery-failed",
        lastSafeState: workflowSafeState(loaded.workflow),
        failure: {
          code,
          message: messageFor(error, "Storefront evidence could not be reconciled."),
          retryable: retryableFailure(code),
        },
        updatedAt: this.#now(),
      });
      const persisted = await this.#persist(loaded.session, failed, loaded.workflow);
      throw new UrlBriefWorkflowOperationError(
        code,
        persisted.workflow.failure?.message ?? "Reconciliation failed.",
        cloneUrlBriefWorkflow(persisted.workflow),
        { cause: error },
      );
    }
  }

  async proposeBrand(): Promise<UrlBriefWorkflow> {
    const loaded = await this.#load();
    const discovery = loaded.workflow.discoveryResult;
    const material = urlBriefWorkflowMaterialEvidence(loaded.workflow);
    if (!discovery || !material) {
      throw new UrlBriefWorkflowOperationError(
        "invalid-lifecycle",
        "Reconcile storefront evidence before proposing a brand direction.",
        cloneUrlBriefWorkflow(loaded.workflow),
      );
    }
    const brandProposal = proposeBrandReconstruction({
      source: discovery.source,
      evidence: discovery.evidence,
      assetCandidates: discovery.assetCandidates,
    });
    const current = currentUrlBrief(loaded.workflow);
    let briefRevisions = loaded.workflow.briefRevisions;
    if (current?.status === "needsReview") {
      briefRevisions = replaceBrief(
        briefRevisions,
        updateStorefrontDesignBriefReview(current, {
          now: this.#now(),
          materialEvidence: material,
          brandProposal,
          unresolvedItems: [],
        }),
      );
    }
    const keepLifecycleState =
      loaded.workflow.status === "stale" || loaded.workflow.status === "superseded";
    const status = keepLifecycleState ? loaded.workflow.status : "brand-proposal-ready";
    const next = urlBriefWorkflowSchema.parse({
      ...loaded.workflow,
      status,
      lastSafeState: status,
      brandProposal,
      briefRevisions,
      failure: null,
      updatedAt: this.#now(),
    });
    const persisted = await this.#persist(loaded.session, next, loaded.workflow);
    return cloneUrlBriefWorkflow(persisted.workflow);
  }

  async prepareBrief(input: PrepareUrlStorefrontBriefInput): Promise<UrlBriefWorkflow> {
    const loaded = await this.#load();
    const material = urlBriefWorkflowMaterialEvidence(loaded.workflow);
    if (!material || !loaded.workflow.brandProposal) {
      throw new UrlBriefWorkflowOperationError(
        "invalid-lifecycle",
        "Reconciled evidence and a brand proposal are required before brief review.",
        cloneUrlBriefWorkflow(loaded.workflow),
      );
    }
    const projectionRef = loaded.workflow.reconciliation?.canonicalCommerceProjectionRef ?? null;
    const current = currentUrlBrief(loaded.workflow);
    const brief =
      current?.status === "needsReview"
        ? updateStorefrontDesignBriefReview(current, {
            now: this.#now(),
            materialEvidence: material,
            businessIdentity: input.businessIdentity,
            languagePlan: input.languagePlan,
            brandProposal: loaded.workflow.brandProposal,
            approvedBrandDirection: input.approvedBrandDirection,
            approvedReusableAssetIds: input.approvedReusableAssetIds ?? [],
            pagePlan: input.pagePlan ?? { pageTypes: ["home", "collection", "product"] },
            navigationDirection: input.navigationDirection ?? [],
            homepageGoals: input.homepageGoals ?? [],
            collectionPageGoals: input.collectionPageGoals ?? [],
            productPageGoals: input.productPageGoals ?? [],
            visualPriorities: input.visualPriorities ?? [],
            contentAssumptions: input.contentAssumptions ?? [],
            unresolvedItems: [],
            materialUnresolvedBlockers: input.materialUnresolvedBlockers ?? [],
            excludedClaims: input.excludedClaims ?? [],
            generationPermissions: {
              allowMarketingCopy: input.generationPermissions?.allowMarketingCopy ?? true,
              allowAssetReuse: input.generationPermissions?.allowAssetReuse ?? false,
              allowGeneratedImagery: input.generationPermissions?.allowGeneratedImagery ?? false,
            },
          })
        : createStorefrontDesignBrief({
            id: `${loaded.workflow.id}_brief`.slice(0, 80),
            now: this.#now(),
            businessIdentity: input.businessIdentity,
            languagePlan: input.languagePlan,
            sourceReferenceIds: material.sourceReferences.map((source) => source.id),
            sourceEvidenceIds: material.evidence.map((evidence) => evidence.id),
            materialEvidence: material,
            canonicalCommerceProjectionRef: projectionRef,
            brandProposal: loaded.workflow.brandProposal,
            approvedBrandDirection: input.approvedBrandDirection,
            approvedReusableAssetIds: input.approvedReusableAssetIds,
            pagePlan: input.pagePlan,
            navigationDirection: input.navigationDirection,
            homepageGoals: input.homepageGoals,
            collectionPageGoals: input.collectionPageGoals,
            productPageGoals: input.productPageGoals,
            visualPriorities: input.visualPriorities,
            contentAssumptions: input.contentAssumptions,
            materialUnresolvedBlockers: input.materialUnresolvedBlockers,
            excludedClaims: input.excludedClaims,
            generationPermissions: input.generationPermissions,
          });
    const nextStatus =
      loaded.workflow.status === "superseded" ? "superseded" : "brief-needs-review";
    const next = urlBriefWorkflowSchema.parse({
      ...loaded.workflow,
      status: nextStatus,
      lastSafeState: nextStatus,
      briefRevisions: replaceBrief(loaded.workflow.briefRevisions, brief),
      currentBriefRevision: brief.revision,
      approvedEvidenceFingerprint: null,
      failure: null,
      updatedAt: this.#now(),
    });
    const persisted = await this.#persist(loaded.session, next, loaded.workflow);
    return cloneUrlBriefWorkflow(persisted.workflow);
  }

  async recordMerchantResolution(
    decisionId: string,
    outcome: MerchantReconciliationResolution["outcome"],
    note: string | null = null,
    canonicalMatch: CanonicalMerchantReconciliationMatch = {},
  ): Promise<UrlBriefWorkflow> {
    const loaded = await this.#load();
    const reconciliation = loaded.workflow.reconciliation;
    if (!reconciliation || !loaded.workflow.unresolvedInformationIds.includes(decisionId)) {
      throw new UrlBriefWorkflowOperationError(
        "invalid-lifecycle",
        "The reconciliation decision is not awaiting merchant resolution.",
        cloneUrlBriefWorkflow(loaded.workflow),
      );
    }
    const decision = reconciliation.decisions.find((candidate) => candidate.id === decisionId);
    if (!decision) {
      throw new UrlBriefWorkflowOperationError(
        "invalid-lifecycle",
        "The reconciliation decision is no longer available.",
        cloneUrlBriefWorkflow(loaded.workflow),
      );
    }

    const canonicalProductId = canonicalMatch.canonicalProductId ?? null;
    const canonicalCollectionId = canonicalMatch.canonicalCollectionId ?? null;
    if (decision.field === null) {
      if (
        outcome === "use-vesko-truth" ||
        canonicalProductId !== null ||
        canonicalCollectionId !== null
      ) {
        throw new UrlBriefWorkflowOperationError(
          "conflicting-evidence",
          "Choose whether to use or reject this non-commerce source evidence.",
          cloneUrlBriefWorkflow(loaded.workflow),
        );
      }
    } else {
      const expectsCollection = decision.field === "collection-identity";
      const allowsEitherTarget = decision.field === "collection-membership";
      const selectedId = expectsCollection
        ? canonicalCollectionId
        : allowsEitherTarget
          ? (canonicalCollectionId ?? canonicalProductId)
          : canonicalProductId;
      const hasWrongTarget = expectsCollection
        ? canonicalProductId !== null
        : !allowsEitherTarget && canonicalCollectionId !== null;
      if (
        outcome !== "use-vesko-truth" ||
        selectedId === null ||
        hasWrongTarget ||
        (decision.candidateCanonicalIds.length > 0 &&
          !decision.candidateCanonicalIds.includes(selectedId))
      ) {
        throw new UrlBriefWorkflowOperationError(
          "conflicting-evidence",
          "Select an exact canonical Vesko match before resolving this commerce conflict.",
          cloneUrlBriefWorkflow(loaded.workflow),
        );
      }
      let projection: CanonicalCommerceProjection | null;
      try {
        projection = await this.#commerce.load();
      } catch (error) {
        throw new UrlBriefWorkflowOperationError(
          "unavailable-source",
          "The current Vesko catalogue could not be verified. Try reconciliation again.",
          cloneUrlBriefWorkflow(loaded.workflow),
          { cause: error },
        );
      }
      const projectionIsCurrent = projection?.id === reconciliation.canonicalCommerceProjectionRef;
      const targetExists =
        canonicalCollectionId !== null
          ? projection?.collections.some((collection) => collection.id === selectedId)
          : projection?.products.some((product) => product.id === selectedId);
      if (!projectionIsCurrent || !targetExists) {
        throw new UrlBriefWorkflowOperationError(
          projection ? "conflicting-evidence" : "missing-canonical-vesko-projection",
          "The selected Vesko record is not available in the current catalogue. Reconcile again.",
          cloneUrlBriefWorkflow(loaded.workflow),
        );
      }
    }
    const parsedResolution = merchantReconciliationResolutionSchema.safeParse({
      decisionId,
      outcome,
      canonicalProductId,
      canonicalCollectionId,
      note,
      resolvedAt: this.#now(),
    });
    if (!parsedResolution.success) {
      throw new UrlBriefWorkflowOperationError(
        "invalid-contract",
        "The reconciliation choice is invalid. Review the selection and try again.",
        cloneUrlBriefWorkflow(loaded.workflow),
        { cause: parsedResolution.error },
      );
    }
    const resolution = parsedResolution.data;
    const merchantResolutions = [
      ...loaded.workflow.merchantResolutions.filter(
        (candidate) => candidate.decisionId !== decisionId,
      ),
      resolution,
    ];
    const unresolvedInformationIds = unresolvedReconciliationDecisionIds(
      reconciliation,
      merchantResolutions,
    );
    let candidate = urlBriefWorkflowSchema.parse({
      ...loaded.workflow,
      merchantResolutions,
      unresolvedInformationIds,
      updatedAt: this.#now(),
    });
    const current = currentUrlBrief(candidate);
    if (current?.status === "needsReview") {
      const material = urlBriefWorkflowMaterialEvidence(candidate);
      if (!material) throw new Error("Reconciled evidence is unavailable.");
      const updatedBrief = updateStorefrontDesignBriefReview(current, {
        now: this.#now(),
        materialEvidence: material,
        brandProposal: candidate.brandProposal,
        unresolvedItems: [],
      });
      candidate = urlBriefWorkflowSchema.parse({
        ...candidate,
        briefRevisions: replaceBrief(candidate.briefRevisions, updatedBrief),
      });
    }
    let status = candidate.status;
    if (status === "reconciliation-needed" && unresolvedInformationIds.length === 0) {
      status = candidate.brandProposal ? "brand-proposal-ready" : "evidence-ready";
    }
    if (current?.status === "needsReview" && status !== "superseded") {
      status = "brief-needs-review";
    }
    const next = urlBriefWorkflowSchema.parse({
      ...candidate,
      status,
      lastSafeState: status,
      failure: null,
    });
    const persisted = await this.#persist(loaded.session, next, loaded.workflow);
    return cloneUrlBriefWorkflow(persisted.workflow);
  }

  async approveBrief(actorId: string, approvedBrandDirection?: unknown): Promise<UrlBriefWorkflow> {
    const loaded = await this.#load();
    const brief = currentUrlBrief(loaded.workflow);
    const material = urlBriefWorkflowMaterialEvidence(loaded.workflow);
    if (!brief || !material || loaded.workflow.unresolvedInformationIds.length > 0) {
      throw new UrlBriefWorkflowOperationError(
        "conflicting-evidence",
        "Resolve all material source decisions before approval.",
        cloneUrlBriefWorkflow(loaded.workflow),
      );
    }

    let projection: CanonicalCommerceProjection | null;
    try {
      projection = await this.#commerce.load();
    } catch (error) {
      throw new UrlBriefWorkflowOperationError(
        "unavailable-source",
        "The current Vesko catalogue could not be verified. Try approval again.",
        cloneUrlBriefWorkflow(loaded.workflow),
        { cause: error },
      );
    }
    const currentProjectionRef =
      loaded.workflow.reconciliation?.canonicalCommerceProjectionRef ?? null;
    const currentEvidenceFingerprint = createStorefrontSourceEvidenceFingerprint(material);
    if (
      projection === null ||
      projection.id !== currentProjectionRef ||
      brief.canonicalCommerceProjectionRef !== currentProjectionRef ||
      brief.evidenceFingerprint !== currentEvidenceFingerprint
    ) {
      const failureCode: SourceDiscoveryApplicationErrorCode = projection
        ? "stale-brief-approval"
        : "missing-canonical-vesko-projection";
      const reviewStatus: UrlBriefWorkflow["status"] =
        brief.status === "approved"
          ? "stale"
          : loaded.workflow.status === "superseded"
            ? "superseded"
            : "brief-needs-review";
      const stale = urlBriefWorkflowSchema.parse({
        ...loaded.workflow,
        status: reviewStatus,
        lastSafeState: reviewStatus,
        approvedEvidenceFingerprint:
          brief.status === "approved" ? loaded.workflow.approvedEvidenceFingerprint : null,
        failure: {
          code: failureCode,
          message: projection
            ? "Storefront evidence or protected Vesko commerce changed. Refresh the brief before approval."
            : "A current canonical Vesko catalogue is required before approval.",
          retryable: true,
        },
        updatedAt: this.#now(),
      });
      const persisted = await this.#persist(loaded.session, stale, loaded.workflow);
      throw new UrlBriefWorkflowOperationError(
        failureCode,
        persisted.workflow.failure?.message ?? "Refresh the brief before approval.",
        cloneUrlBriefWorkflow(persisted.workflow),
      );
    }
    try {
      const approved = approveStorefrontDesignBrief(brief, {
        actorId,
        approvedAt: this.#now(),
        approvedBrandDirection,
      });
      const next = urlBriefWorkflowSchema.parse({
        ...loaded.workflow,
        status: "approved",
        lastSafeState: "approved",
        briefRevisions: replaceBrief(loaded.workflow.briefRevisions, approved),
        approvedEvidenceFingerprint: approved.approvedEvidenceFingerprint,
        failure: null,
        updatedAt: this.#now(),
      });
      const persisted = await this.#persist(loaded.session, next, loaded.workflow);
      return cloneUrlBriefWorkflow(persisted.workflow);
    } catch (error) {
      if (error instanceof UrlBriefWorkflowPersistenceError) throw error;
      const code = failureCode(error);
      throw new UrlBriefWorkflowOperationError(
        code,
        messageFor(error, "The Storefront Design Brief could not be approved."),
        cloneUrlBriefWorkflow(loaded.workflow),
        { cause: error },
      );
    }
  }

  async supersedeStaleBrief(): Promise<UrlBriefWorkflow> {
    const loaded = await this.#load();
    const brief = currentUrlBrief(loaded.workflow);
    const material = urlBriefWorkflowMaterialEvidence(loaded.workflow);
    if (loaded.workflow.status !== "stale" || brief?.status !== "approved" || !material) {
      throw new UrlBriefWorkflowOperationError(
        "invalid-lifecycle",
        "Only a stale approved brief can be superseded.",
        cloneUrlBriefWorkflow(loaded.workflow),
      );
    }
    const { superseded, replacement } = supersedeStorefrontDesignBrief(brief, {
      now: this.#now(),
      materialEvidence: material,
      brandProposal: loaded.workflow.brandProposal,
      approvedReusableAssetIds: loaded.workflow.brandProposal?.reusedAssetIds ?? [],
      materialUnresolvedBlockers: [],
    });
    const next = urlBriefWorkflowSchema.parse({
      ...loaded.workflow,
      status: "superseded",
      lastSafeState: "superseded",
      briefRevisions: replaceBrief(
        replaceBrief(loaded.workflow.briefRevisions, superseded),
        replacement,
      ),
      currentBriefRevision: replacement.revision,
      approvedEvidenceFingerprint: null,
      failure: null,
      updatedAt: this.#now(),
    });
    const persisted = await this.#persist(loaded.session, next, loaded.workflow);
    return cloneUrlBriefWorkflow(persisted.workflow);
  }

  async requireApprovedBriefForGeneration(): Promise<StorefrontDesignBriefContract> {
    const loaded = await this.#load();
    const brief = currentUrlBrief(loaded.workflow);
    const material = urlBriefWorkflowMaterialEvidence(loaded.workflow);
    const approvalStateIsCurrent =
      loaded.workflow.status === "approved" ||
      (loaded.workflow.status === "discovery-failed" &&
        loaded.workflow.lastSafeState === "approved");
    if (!approvalStateIsCurrent || !brief || !material) {
      throw new UrlBriefWorkflowOperationError(
        "stale-brief-approval",
        "Generation requires a current approved Storefront Design Brief.",
        cloneUrlBriefWorkflow(loaded.workflow),
      );
    }
    try {
      return requireApprovedCurrentStorefrontDesignBrief(
        brief,
        createStorefrontSourceEvidenceFingerprint(material),
      );
    } catch (error) {
      const code = failureCode(error);
      throw new UrlBriefWorkflowOperationError(
        code,
        messageFor(error, "Generation requires a current approved Storefront Design Brief."),
        cloneUrlBriefWorkflow(loaded.workflow),
        { cause: error },
      );
    }
  }

  async #load(): Promise<LoadedWorkflow> {
    const result = await this.#repository.load();
    if (result.status !== "found") {
      const code = result.status === "unavailable" ? "unavailable-source" : "invalid-lifecycle";
      throw new SourceDiscoveryApplicationError(
        code,
        "A persisted onboarding session is required for the URL brief workflow.",
      );
    }
    return {
      session: result.session,
      workflow: cloneUrlBriefWorkflow(result.session.urlBriefWorkflow),
    };
  }

  async #persist(
    session: LoadedWorkflow["session"],
    workflowInput: UrlBriefWorkflow,
    safeWorkflow: UrlBriefWorkflow,
  ): Promise<LoadedWorkflow> {
    const workflow = urlBriefWorkflowSchema.parse(workflowInput);
    const updatedAt = new Date(
      Math.max(Date.parse(session.updatedAt), Date.parse(workflow.updatedAt)),
    ).toISOString();
    const updatedSession = {
      ...session,
      urlBriefWorkflow: workflow,
      updatedAt,
    };
    try {
      await this.#repository.save(updatedSession);
      return { session: updatedSession, workflow };
    } catch (error) {
      throw new UrlBriefWorkflowPersistenceError(cloneUrlBriefWorkflow(safeWorkflow), {
        cause: error instanceof OnboardingStorageError ? error : undefined,
      });
    }
  }

  async #persistInputFailureAndThrow(
    loaded: LoadedWorkflow,
    code: "invalid-url" | "unsupported-protocol",
    message: string,
    cause?: unknown,
  ): Promise<never> {
    const failed = urlBriefWorkflowSchema.parse({
      ...loaded.workflow,
      status: "discovery-failed",
      lastSafeState: workflowSafeState(loaded.workflow),
      failure: { code, message, retryable: false },
      updatedAt: this.#now(),
    });
    const persisted = await this.#persist(loaded.session, failed, loaded.workflow);
    throw new UrlBriefWorkflowOperationError(
      code,
      message,
      cloneUrlBriefWorkflow(persisted.workflow),
      cause instanceof Error ? { cause } : undefined,
    );
  }
}

export function createDeterministicUrlBriefWorkflowService(
  repository: OnboardingSessionRepository,
  commerce: CanonicalCommerceProjectionProvider,
  options: UrlBriefWorkflowServiceOptions = {},
): UrlBriefWorkflowService {
  return new UrlBriefWorkflowService(
    repository,
    createDeterministicMockDiscoveryAdapter(),
    commerce,
    { ...options, discoveryPolicy: options.discoveryPolicy ?? deterministicPolicy },
  );
}
