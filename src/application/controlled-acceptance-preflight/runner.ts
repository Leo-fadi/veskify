import {
  executeGovernedFollowUpEditing,
  executeGovernedInitialGeneration,
  governedFollowUpEditingRequestSchema,
  governedInitialGenerationRequestSchema,
  governedSkillAuthorityEnvelopeSchema,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills";
import {
  WholeStorefrontProposalAcceptanceCoordinator,
  type WholeStorefrontProposal,
  type WholeStorefrontProposalAuthorityInput,
  type WholeStorefrontRuntimeState,
} from "@/application/whole-storefront-proposal-lifecycle";
import {
  createWholeStorefrontGenerationTarget,
  requestWholeStorefrontGenerationPlan,
  WholeStorefrontPlanningProviderError,
  wholeStorefrontPlanningInputSchema,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
  type WholeStorefrontPlanningProvider,
} from "@/application/whole-storefront-generation-plan";
import type { RegisteredTokenRefinementPlan } from "@/application/storefront-design-system";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION,
  controlledAcceptanceAuthorityFingerprint,
  controlledAcceptanceCaseFingerprint,
  controlledAcceptanceCaseSchema,
  controlledAcceptanceEvidenceSchema,
  controlledLiveCallAuthorizationFingerprint,
  controlledLiveCallAuthorizationSchema,
  declaredPageAuthorityFingerprint,
  type ControlledAcceptanceCase,
  type ControlledAcceptanceEvidence,
  type ControlledAcceptanceFailureCode,
  type ControlledAcceptanceResult,
  type ControlledLiveCallAuthorization,
} from "./contract";

type RetainedEvidence = Omit<ControlledAcceptanceEvidence, "fingerprint">;
type AuthorizationBudget = { attempts: number; completions: number };
type AuthorizedBudget = Readonly<{
  key: string;
  authorization: ControlledLiveCallAuthorization;
  budget: AuthorizationBudget;
}>;

export type ControlledAcceptancePreflightDependencies = Readonly<{
  /** The only provider entry point. Tests inject deterministic providers here. */
  provider: WholeStorefrontPlanningProvider;
  /** Safe identity supplied by trusted provider configuration, never by the acceptance case. */
  providerModelId: string | null;
  currentAuthority: () => unknown;
  /** Required current server-derived planning input; request input is never a fallback. */
  currentPlanningInput: () => unknown;
  allowedProviderIds: readonly string[];
  now: () => string;
  retainEvidence?: (evidence: ControlledAcceptanceEvidence) => ControlledAcceptanceEvidence;
}>;

function frozen<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => frozen(child));
  }
  return value;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function protectedStateFingerprint(state: WholeStorefrontRuntimeState): string {
  return `controlled-protected-state-${canonicalValueFingerprint({
    navigation: state.navigation,
    commerceFingerprint: state.canonicalCommerceFingerprint,
    approvedAssetFingerprint: state.approvedAssetContextFingerprint,
  })}`;
}

function evidenceFingerprint(evidence: RetainedEvidence): string {
  return `controlled-acceptance-evidence-${canonicalValueFingerprint({
    ...evidence,
    completedAt: null,
  })}`;
}

function completeEvidence(evidence: RetainedEvidence): ControlledAcceptanceEvidence {
  return controlledAcceptanceEvidenceSchema.parse({
    ...evidence,
    fingerprint: evidenceFingerprint(evidence),
  });
}

function extractExecution(input: ControlledAcceptanceCase):
  | Readonly<{
      kind: "initialGeneration";
      request: ReturnType<typeof governedInitialGenerationRequestSchema.parse>;
      planningInput: WholeStorefrontPlanningInput;
      packageId: string;
      providerContext: Readonly<{
        directionId?: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"];
        tokenRefinementPlan?: RegisteredTokenRefinementPlan;
      }>;
    }>
  | Readonly<{
      kind: "followUpEditing";
      request: ReturnType<typeof governedFollowUpEditingRequestSchema.parse>;
      planningInput: WholeStorefrontPlanningInput;
      packageId: string;
      providerContext: Readonly<{
        directionId?: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"];
        tokenRefinementPlan?: RegisteredTokenRefinementPlan;
      }>;
    }> {
  if (input.executionKind === "initialGeneration") {
    const request = governedInitialGenerationRequestSchema.parse(clone(input.execution));
    return {
      kind: "initialGeneration",
      request,
      planningInput: wholeStorefrontPlanningInputSchema.parse(request.planningInput),
      packageId: request.packageId,
      providerContext: { directionId: request.authority.registeredDirectionId },
    };
  }
  const request = governedFollowUpEditingRequestSchema.parse(clone(input.execution));
  return {
    kind: "followUpEditing",
    request,
    planningInput: wholeStorefrontPlanningInputSchema.parse(request.planningInput),
    packageId: request.authority.packageId,
    providerContext: {
      ...(request.registeredDirectionId === undefined
        ? {}
        : { directionId: request.registeredDirectionId }),
      ...(request.tokenRefinementPlan === undefined
        ? {}
        : { tokenRefinementPlan: request.tokenRefinementPlan }),
    },
  };
}

function baseEvidence(
  input: ControlledAcceptanceCase,
  packageId: string,
  now: string,
): RetainedEvidence {
  return {
    caseId: input.caseId,
    caseVersion: CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION,
    startedAt: now,
    completedAt: null,
    executionKind: input.executionKind,
    governedPackageId: packageId,
    requestFingerprint: `controlled-request-${canonicalValueFingerprint({
      requestIdentity: input.requestIdentity,
      execution: input.execution,
    })}`,
    authorityFingerprint: controlledAcceptanceAuthorityFingerprint(input.authority),
    projectId: input.authority.projectId,
    projectRevision: input.authority.projectRevision,
    draftSnapshotId: input.authority.draftSnapshotId,
    draftRevision: input.authority.draftRevision,
    snapshotFingerprint: input.authority.snapshotFingerprint,
    manifest: clone(input.authority.manifest),
    packageRegistry: clone(input.authority.packageRegistry),
    declaredPageAuthorityFingerprint: input.declaredPageAuthorityFingerprint,
    commerceFingerprint: input.authority.commerceFingerprint,
    approvedAssetFingerprint: input.authority.approvedAssetFingerprint,
    provider: clone(input.providerConfiguration),
    providerAttemptCount: 0,
    providerCompletionCount: 0,
    providerOutcome: "not-attempted",
    planFingerprint: null,
    proposalFingerprint: null,
    reviewSummaryFingerprint: null,
    previewFingerprint: null,
    acceptanceFingerprint: null,
    undoFingerprint: null,
    redoFingerprint: null,
    protectedStateBeforeFingerprint: null,
    protectedStateAfterFingerprint: null,
    publishState: "not-published",
    finalStatus: "failed",
    failure: null,
  };
}

function currentAuthorityInput(
  plan: WholeStorefrontGenerationPlan,
  planningInput: WholeStorefrontPlanningInput,
  coordinatedPlan?: unknown,
): WholeStorefrontProposalAuthorityInput {
  return coordinatedPlan === undefined
    ? { plan, planningInput }
    : { plan: coordinatedPlan as never, planningInput };
}

/**
 * An intentionally un-routed preflight. Calling run without current authorization or current
 * server-derived planning input cannot reach the injected provider boundary.
 */
export class ControlledAcceptancePreflightRunner {
  readonly #dependencies: ControlledAcceptancePreflightDependencies;
  readonly #budgets = new Map<string, AuthorizationBudget>();

  constructor(dependencies: ControlledAcceptancePreflightDependencies) {
    this.#dependencies = dependencies;
  }

  #terminalFailure(
    code: ControlledAcceptanceFailureCode,
    message: string,
    evidence: RetainedEvidence | null,
    now: string,
  ): ControlledAcceptanceResult {
    if (evidence === null)
      return frozen({ ok: false, failure: frozen({ code, message }), evidence: null });
    try {
      const finalized = completeEvidence({
        ...evidence,
        completedAt: now,
        finalStatus: "failed",
        failure: { code, category: code },
      });
      const retained = this.#dependencies.retainEvidence?.(finalized) ?? finalized;
      return frozen({
        ok: false,
        failure: frozen({ code, message }),
        evidence: controlledAcceptanceEvidenceSchema.parse(clone(retained)),
      });
    } catch {
      return frozen({
        ok: false,
        failure: frozen({
          code: "evidence-initialization-failed",
          message: "Controlled acceptance evidence could not be retained safely.",
        }),
        evidence: null,
      });
    }
  }

  #terminalSuccess(evidence: RetainedEvidence, now: string): ControlledAcceptanceResult {
    try {
      const finalized = completeEvidence({
        ...evidence,
        completedAt: now,
        finalStatus: "succeeded",
      });
      const retained = this.#dependencies.retainEvidence?.(finalized) ?? finalized;
      return frozen({
        ok: true,
        evidence: controlledAcceptanceEvidenceSchema.parse(clone(retained)),
      });
    } catch {
      return this.#terminalFailure(
        "evidence-initialization-failed",
        "Controlled acceptance evidence could not be retained safely.",
        null,
        now,
      );
    }
  }

  #assertCaseAuthority(
    input: ControlledAcceptanceCase,
    execution: ReturnType<typeof extractExecution>,
  ): GovernedSkillAuthorityEnvelope {
    const current = governedSkillAuthorityEnvelopeSchema.parse(
      clone(this.#dependencies.currentAuthority()),
    );
    const requestAuthority = execution.request.authority.authority;
    if (
      canonicalValueString(input.authority) !== canonicalValueString(current) ||
      canonicalValueString(requestAuthority) !== canonicalValueString(input.authority) ||
      input.requestIdentity !== input.authority.requestIdentity ||
      input.locale !== input.authority.locale ||
      input.declaredPageAuthorityFingerprint !== declaredPageAuthorityFingerprint(execution.request)
    ) {
      throw new Error("stale authority");
    }
    return current;
  }

  #freshPlanningInput(
    input: ControlledAcceptanceCase,
    currentAuthority: GovernedSkillAuthorityEnvelope,
  ): WholeStorefrontPlanningInput {
    const planning = wholeStorefrontPlanningInputSchema.parse(
      clone(this.#dependencies.currentPlanningInput()),
    );
    const target = createWholeStorefrontGenerationTarget(planning);
    if (
      planning.project.id !== currentAuthority.projectId ||
      planning.project.revision !== currentAuthority.projectRevision ||
      planning.draft.id !== currentAuthority.draftSnapshotId ||
      planning.draft.revision !== currentAuthority.draftRevision ||
      target.activeDraftFingerprint !== currentAuthority.snapshotFingerprint ||
      target.registryFingerprint !== currentAuthority.componentRegistryFingerprint ||
      target.canonicalCommerceFingerprint !== currentAuthority.commerceFingerprint ||
      target.approvedAssetContextFingerprint !== currentAuthority.approvedAssetFingerprint ||
      !planning.project.enabledLocales.includes(currentAuthority.locale) ||
      canonicalValueString(currentAuthority) !== canonicalValueString(input.authority)
    ) {
      throw new Error("stale current planning input");
    }
    return planning;
  }

  #authorization(input: ControlledAcceptanceCase, value: unknown): AuthorizedBudget {
    const authorization = controlledLiveCallAuthorizationSchema.parse(clone(value));
    const unsigned = {
      kind: authorization.kind,
      authorizationId: authorization.authorizationId,
      caseId: authorization.caseId,
      caseVersion: authorization.caseVersion,
      authorityFingerprint: authorization.authorityFingerprint,
      caseFingerprint: authorization.caseFingerprint,
      providerId: authorization.providerId,
      maximumProviderCalls: authorization.maximumProviderCalls,
    };
    const key = authorization.fingerprint;
    const budget = this.#budgets.get(key) ?? { attempts: 0, completions: 0 };
    if (
      authorization.fingerprint !== controlledLiveCallAuthorizationFingerprint(unsigned) ||
      authorization.caseId !== input.caseId ||
      authorization.caseVersion !== input.caseVersion ||
      authorization.authorityFingerprint !==
        controlledAcceptanceAuthorityFingerprint(input.authority) ||
      authorization.caseFingerprint !== controlledAcceptanceCaseFingerprint(input) ||
      authorization.providerId !== input.providerConfiguration.providerId ||
      authorization.maximumProviderCalls !== input.maximumProviderCalls ||
      input.maximumProviderCalls <= 0 ||
      budget.attempts >= authorization.maximumProviderCalls
    ) {
      throw new Error("invalid authorization");
    }
    return { key, authorization, budget };
  }

  #authorizationFailureCode(value: unknown): ControlledAcceptanceFailureCode {
    const parsed = controlledLiveCallAuthorizationSchema.safeParse(value);
    if (!parsed.success) {
      return typeof value === "object" &&
        value !== null &&
        (value as Record<string, unknown>).maximumProviderCalls === 0
        ? "provider-allowance-exhausted"
        : "invalid-live-authorization";
    }
    const budget = this.#budgets.get(parsed.data.fingerprint);
    return parsed.data.maximumProviderCalls <= 0 ||
      (budget !== undefined && budget.attempts >= parsed.data.maximumProviderCalls)
      ? "provider-allowance-exhausted"
      : "invalid-live-authorization";
  }

  async run(caseValue: unknown, authorizationValue?: unknown): Promise<ControlledAcceptanceResult> {
    const now = this.#dependencies.now();
    let input: ControlledAcceptanceCase;
    try {
      input = controlledAcceptanceCaseSchema.parse(clone(caseValue));
    } catch {
      return this.#terminalFailure(
        "malformed-case",
        "The controlled acceptance case is malformed.",
        null,
        now,
      );
    }
    if (input.caseVersion !== CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION) {
      return this.#terminalFailure(
        "unsupported-case-version",
        "The controlled acceptance case version is unsupported.",
        null,
        now,
      );
    }

    let execution: ReturnType<typeof extractExecution>;
    try {
      execution = extractExecution(input);
    } catch {
      return this.#terminalFailure(
        "malformed-case",
        "The governed execution input is malformed.",
        null,
        now,
      );
    }
    let evidence = baseEvidence(input, execution.packageId, now);
    let currentAuthority: GovernedSkillAuthorityEnvelope;
    try {
      currentAuthority = this.#assertCaseAuthority(input, execution);
      this.#freshPlanningInput(input, currentAuthority);
    } catch {
      return this.#terminalFailure(
        "stale-authority",
        "Current project, draft, registry, manifest, profile, or planning authority is stale.",
        evidence,
        now,
      );
    }
    if (
      this.#dependencies.provider.id !== input.providerConfiguration.providerId ||
      !this.#dependencies.allowedProviderIds.includes(input.providerConfiguration.providerId) ||
      input.expectedModelId !== this.#dependencies.providerModelId ||
      input.providerConfiguration.modelId !== this.#dependencies.providerModelId
    ) {
      return this.#terminalFailure(
        "invalid-provider-configuration",
        "The configured provider or model identity is not trusted for this controlled acceptance case.",
        evidence,
        now,
      );
    }

    let authorization: AuthorizedBudget;
    try {
      if (authorizationValue === undefined || authorizationValue === null)
        throw new Error("missing");
      authorization = this.#authorization(input, authorizationValue);
    } catch {
      return this.#terminalFailure(
        authorizationValue === undefined || authorizationValue === null
          ? "missing-live-authorization"
          : this.#authorizationFailureCode(authorizationValue),
        "An explicit, current controlled live-call authorization is required before provider invocation.",
        { ...evidence, providerOutcome: "rejected-before-call" },
        now,
      );
    }
    try {
      const initialized = completeEvidence(evidence);
      if (this.#dependencies.retainEvidence !== undefined) {
        controlledAcceptanceEvidenceSchema.parse(
          clone(this.#dependencies.retainEvidence(initialized)),
        );
      }
    } catch {
      return this.#terminalFailure(
        "evidence-initialization-failed",
        "Controlled acceptance evidence could not be initialized safely.",
        null,
        now,
      );
    }

    let integrated:
      | Readonly<{
          plan: WholeStorefrontGenerationPlan;
          proposal: WholeStorefrontProposal;
          authorityInput: WholeStorefrontProposalAuthorityInput;
        }>
      | undefined;
    try {
      if (execution.kind === "initialGeneration") {
        const result = executeGovernedInitialGeneration(execution.request, currentAuthority);
        if (!result.valid) throw new Error(result.failure.code);
        integrated = {
          plan: result.plan,
          proposal: result.proposal,
          authorityInput: { plan: result.plan, planningInput: result.planningInput },
        };
      } else {
        const result = executeGovernedFollowUpEditing(execution.request, currentAuthority);
        if (!result.valid) throw new Error(result.failure.code);
        integrated = {
          plan: result.coordinatedPlan.baselineGenerationPlan,
          proposal: result.proposal,
          authorityInput: { plan: result.coordinatedPlan, planningInput: result.planningInput },
        };
      }
    } catch {
      return this.#terminalFailure(
        "planning-proposal-rejected",
        "The governed request could not produce a current reviewable proposal.",
        { ...evidence, providerOutcome: "rejected-before-call" },
        now,
      );
    }

    let trustedPlanning: WholeStorefrontPlanningInput;
    try {
      trustedPlanning = this.#freshPlanningInput(input, currentAuthority);
    } catch {
      return this.#terminalFailure(
        "stale-authority",
        "Current planning authority drifted before provider invocation.",
        evidence,
        now,
      );
    }
    authorization.budget.attempts += 1;
    this.#budgets.set(authorization.key, authorization.budget);
    evidence = { ...evidence, providerAttemptCount: authorization.budget.attempts };
    let providerPlan: WholeStorefrontGenerationPlan;
    try {
      providerPlan = await requestWholeStorefrontGenerationPlan({
        provider: this.#dependencies.provider,
        input: trustedPlanning,
        currentInput: () => this.#freshPlanningInput(input, currentAuthority),
        directionId: execution.providerContext.directionId,
        tokenRefinementPlan: execution.providerContext.tokenRefinementPlan,
        governedExecution: {
          executionKind: execution.kind,
          packageId: execution.packageId,
          requestIdentity: input.requestIdentity,
        },
      });
      authorization.budget.completions += 1;
      evidence = { ...evidence, providerCompletionCount: authorization.budget.completions };
    } catch (caught) {
      const code =
        caught instanceof WholeStorefrontPlanningProviderError && caught.code === "stale-result"
          ? "stale-authority"
          : caught instanceof WholeStorefrontPlanningProviderError &&
              ["malformed-structured-response", "invalid-plan"].includes(caught.code)
            ? "provider-response-validation-failed"
            : "provider-unavailable";
      return this.#terminalFailure(
        code,
        "The injected provider did not return a safely validated controlled plan.",
        {
          ...evidence,
          providerOutcome: code === "provider-unavailable" ? "unavailable" : "invalid-response",
        },
        now,
      );
    }
    if (providerPlan.fingerprint !== integrated.plan.fingerprint) {
      return this.#terminalFailure(
        "planning-proposal-rejected",
        "The provider plan does not match the governed canonical proposal authority.",
        { ...evidence, providerOutcome: "completed", planFingerprint: providerPlan.fingerprint },
        now,
      );
    }

    const before = protectedStateFingerprint(integrated.proposal.originalStorefront);
    evidence = {
      ...evidence,
      providerOutcome: "completed",
      planFingerprint: providerPlan.fingerprint,
      proposalFingerprint: integrated.proposal.id,
      reviewSummaryFingerprint: canonicalValueFingerprint(integrated.proposal.reviewSummary),
      previewFingerprint: canonicalValueFingerprint(integrated.proposal.proposedStorefront),
      protectedStateBeforeFingerprint: before,
    };
    let coordinator: WholeStorefrontProposalAcceptanceCoordinator;
    try {
      const postProviderPlanning = this.#freshPlanningInput(input, currentAuthority);
      coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
        proposal: integrated.proposal,
        currentInput: () =>
          currentAuthorityInput(
            integrated.plan,
            this.#freshPlanningInput(input, currentAuthority),
            execution.kind === "followUpEditing"
              ? (integrated.authorityInput as { plan: unknown }).plan
              : undefined,
          ),
      });
      void postProviderPlanning;
    } catch {
      return this.#terminalFailure(
        "stale-acceptance",
        "The proposal became stale before review.",
        evidence,
        now,
      );
    }
    const preview = coordinator.inspect();
    if (preview.state !== "ready" || preview.proposal.status !== "pending") {
      return this.#terminalFailure(
        "lifecycle-failed",
        "The governed proposal was not retained for review.",
        evidence,
        now,
      );
    }
    const requiredStages = ["proposal-retained", "previewed"] as string[];
    let lifecycle = preview;
    if (input.lifecycleExercise === "reject") {
      lifecycle = coordinator.reject();
      requiredStages.push("rejected");
    } else if (input.lifecycleExercise !== "preview-only") {
      lifecycle = coordinator.accept();
      if (lifecycle.state === "stale") {
        return this.#terminalFailure(
          "stale-acceptance",
          "The proposal became stale before acceptance.",
          evidence,
          now,
        );
      }
      if (lifecycle.state !== "accepted") {
        return this.#terminalFailure(
          "lifecycle-failed",
          "The proposal could not be accepted safely.",
          evidence,
          now,
        );
      }
      requiredStages.push("accepted");
      evidence = {
        ...evidence,
        acceptanceFingerprint: canonicalValueFingerprint(lifecycle.activeStorefront),
      };
      if (
        input.lifecycleExercise === "accept-undo" ||
        input.lifecycleExercise === "accept-undo-redo"
      ) {
        const undone = coordinator.undo();
        if (
          !undone ||
          canonicalValueString(undone) !==
            canonicalValueString(integrated.proposal.originalStorefront)
        ) {
          return this.#terminalFailure(
            "lifecycle-failed",
            "Undo did not restore the exact original storefront.",
            evidence,
            now,
          );
        }
        requiredStages.push("undone");
        evidence = { ...evidence, undoFingerprint: canonicalValueFingerprint(undone) };
        if (input.lifecycleExercise === "accept-undo-redo") {
          const redone = coordinator.redo();
          if (
            !redone ||
            canonicalValueString(redone) !==
              canonicalValueString(integrated.proposal.proposedStorefront)
          ) {
            return this.#terminalFailure(
              "lifecycle-failed",
              "Redo did not restore the accepted storefront.",
              evidence,
              now,
            );
          }
          requiredStages.push("redone");
          evidence = { ...evidence, redoFingerprint: canonicalValueFingerprint(redone) };
        }
      }
    }
    if (
      canonicalValueString([...new Set(requiredStages)].sort()) !==
      canonicalValueString([...new Set(input.expectedReviewStages)].sort())
    ) {
      return this.#terminalFailure(
        "lifecycle-failed",
        "The configured review stages do not match the lifecycle exercise.",
        evidence,
        now,
      );
    }
    const final = coordinator.inspect();
    const after = protectedStateFingerprint(final.activeStorefront);
    if (before !== after) {
      return this.#terminalFailure(
        "protected-state-violation",
        "Controlled acceptance detected a protected navigation, commerce, or asset mutation.",
        { ...evidence, protectedStateAfterFingerprint: after },
        now,
      );
    }
    if (
      canonicalValueString(final.publishedStorefront) !==
      canonicalValueString(integrated.proposal.originalStorefront)
    ) {
      return this.#terminalFailure(
        "lifecycle-failed",
        "Controlled acceptance must not publish a storefront.",
        evidence,
        now,
      );
    }
    return this.#terminalSuccess({ ...evidence, protectedStateAfterFingerprint: after }, now);
  }
}
