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
  requestWholeStorefrontGenerationPlan,
  WholeStorefrontPlanningProviderError,
  wholeStorefrontPlanningInputSchema,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
  type WholeStorefrontPlanningProvider,
} from "@/application/whole-storefront-generation-plan";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION,
  controlledAcceptanceAuthorityFingerprint,
  controlledAcceptanceCaseSchema,
  controlledAcceptanceEvidenceSchema,
  controlledLiveCallAuthorizationFingerprint,
  controlledLiveCallAuthorizationSchema,
  declaredPageAuthorityFingerprint,
  type ControlledAcceptanceCase,
  type ControlledAcceptanceEvidence,
  type ControlledAcceptanceFailureCode,
  type ControlledAcceptanceResult,
} from "./contract";

type RetainedEvidence = Omit<ControlledAcceptanceEvidence, "fingerprint">;

export type ControlledAcceptancePreflightDependencies = Readonly<{
  /** The only provider entry point. Tests must inject a deterministic provider here. */
  provider: WholeStorefrontPlanningProvider;
  currentAuthority: () => unknown;
  /** Used again during acceptance so a proposal cannot be accepted against a changed draft. */
  currentPlanningInput?: () => unknown;
  /** Optional independently refreshed authority for the review-to-accept transition. */
  currentAcceptancePlanningInput?: () => unknown;
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

function extractExecution(input: ControlledAcceptanceCase):
  | Readonly<{
      kind: "initialGeneration";
      request: ReturnType<typeof governedInitialGenerationRequestSchema.parse>;
      planningInput: WholeStorefrontPlanningInput;
      packageId: string;
    }>
  | Readonly<{
      kind: "followUpEditing";
      request: ReturnType<typeof governedFollowUpEditingRequestSchema.parse>;
      planningInput: WholeStorefrontPlanningInput;
      packageId: string;
    }> {
  if (input.executionKind === "initialGeneration") {
    const request = governedInitialGenerationRequestSchema.parse(clone(input.execution));
    return {
      kind: "initialGeneration",
      request,
      planningInput: wholeStorefrontPlanningInputSchema.parse(request.planningInput),
      packageId: request.packageId,
    };
  }
  const request = governedFollowUpEditingRequestSchema.parse(clone(input.execution));
  return {
    kind: "followUpEditing",
    request,
    planningInput: wholeStorefrontPlanningInputSchema.parse(request.planningInput),
    packageId: request.authority.packageId,
  };
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
    fingerprint: undefined,
  })}`;
}

function baseEvidence(
  input: ControlledAcceptanceCase,
  packageId: string | null,
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
      caseId: input.caseId,
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

function completeEvidence(evidence: RetainedEvidence): ControlledAcceptanceEvidence {
  const complete = { ...evidence, fingerprint: evidenceFingerprint(evidence) };
  return controlledAcceptanceEvidenceSchema.parse(complete);
}

function failure(
  code: ControlledAcceptanceFailureCode,
  message: string,
  evidence: RetainedEvidence | null,
  now: string,
): ControlledAcceptanceResult {
  const retained =
    evidence === null
      ? null
      : completeEvidence({
          ...evidence,
          completedAt: now,
          finalStatus: "failed",
          failure: { code, category: code },
        });
  return frozen({ ok: false as const, failure: frozen({ code, message }), evidence: retained });
}

function assertAuthority(
  input: ControlledAcceptanceCase,
  execution: ReturnType<typeof extractExecution>,
  currentValue: unknown,
): GovernedSkillAuthorityEnvelope {
  const current = governedSkillAuthorityEnvelopeSchema.parse(clone(currentValue));
  const requestAuthority =
    execution.kind === "initialGeneration"
      ? execution.request.authority.authority
      : execution.request.authority.authority;
  if (
    canonicalValueString(input.authority) !== canonicalValueString(current) ||
    canonicalValueString(requestAuthority) !== canonicalValueString(input.authority) ||
    input.requestIdentity !== input.authority.requestIdentity ||
    input.locale !== input.authority.locale ||
    input.declaredPageAuthorityFingerprint !== declaredPageAuthorityFingerprint(execution.request)
  ) {
    throw new Error("The acceptance case no longer matches current governed authority.");
  }
  const planning = execution.planningInput;
  if (
    planning.project.id !== current.projectId ||
    planning.project.revision !== current.projectRevision ||
    planning.draft.id !== current.draftSnapshotId ||
    planning.draft.revision !== current.draftRevision
  ) {
    throw new Error("The explicit canonical planning input is stale.");
  }
  return current;
}

function assertAuthorization(
  input: ControlledAcceptanceCase,
  value: unknown,
  successfulCallCount: number,
  providerAttemptCount: number,
): void {
  if (value === undefined || value === null) throw new Error("missing");
  const authorization = controlledLiveCallAuthorizationSchema.parse(clone(value));
  const { fingerprint: _fingerprint, ...unsigned } = authorization;
  if (
    authorization.fingerprint !== controlledLiveCallAuthorizationFingerprint(unsigned) ||
    authorization.caseId !== input.caseId ||
    authorization.caseVersion !== input.caseVersion ||
    authorization.authorityFingerprint !==
      controlledAcceptanceAuthorityFingerprint(input.authority) ||
    authorization.providerId !== input.providerConfiguration.providerId ||
    authorization.maximumProviderCalls !== input.maximumProviderCalls ||
    input.maximumProviderCalls <= 0 ||
    successfulCallCount >= authorization.maximumProviderCalls ||
    providerAttemptCount >= authorization.maximumProviderCalls
  ) {
    throw new Error("invalid");
  }
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
 * A stateful, intentionally un-routed coordinator. Constructing it performs no provider work;
 * calling run without a current explicit authorization always stops before the provider boundary.
 */
export class ControlledAcceptancePreflightRunner {
  readonly #dependencies: ControlledAcceptancePreflightDependencies;
  #successfulCallCount = 0;
  #providerAttemptCount = 0;

  constructor(dependencies: ControlledAcceptancePreflightDependencies) {
    this.#dependencies = dependencies;
  }

  async run(caseValue: unknown, authorizationValue?: unknown): Promise<ControlledAcceptanceResult> {
    const now = this.#dependencies.now();
    let input: ControlledAcceptanceCase;
    try {
      input = controlledAcceptanceCaseSchema.parse(clone(caseValue));
    } catch {
      return failure("malformed-case", "The controlled acceptance case is malformed.", null, now);
    }
    if (input.caseVersion !== "1.0.0") {
      return failure(
        "unsupported-case-version",
        "The controlled acceptance case version is unsupported.",
        null,
        now,
      );
    }

    let execution: ReturnType<typeof extractExecution>;
    try {
      execution = extractExecution(input);
      assertAuthority(input, execution, this.#dependencies.currentAuthority());
    } catch {
      return failure(
        "stale-authority",
        "Current project, draft, registry, manifest, or profile authority is stale.",
        null,
        now,
      );
    }

    if (
      this.#dependencies.provider.id !== input.providerConfiguration.providerId ||
      !this.#dependencies.allowedProviderIds.includes(input.providerConfiguration.providerId) ||
      input.expectedModelId !== input.providerConfiguration.modelId
    ) {
      return failure(
        "invalid-provider-configuration",
        "The configured provider identity is not allowed for this controlled acceptance case.",
        null,
        now,
      );
    }

    let evidence = baseEvidence(input, execution.packageId, now);
    try {
      assertAuthorization(
        input,
        authorizationValue,
        this.#successfulCallCount,
        this.#providerAttemptCount,
      );
    } catch (error) {
      return failure(
        authorizationValue === undefined || authorizationValue === null
          ? "missing-live-authorization"
          : input.maximumProviderCalls <= 0 ||
              this.#successfulCallCount >= input.maximumProviderCalls ||
              this.#providerAttemptCount >= input.maximumProviderCalls
            ? "provider-allowance-exhausted"
            : "invalid-live-authorization",
        "An explicit, current controlled live-call authorization is required before provider invocation.",
        { ...evidence, providerOutcome: "rejected-before-call" },
        now,
      );
    }

    try {
      const initialized = completeEvidence(evidence);
      evidence = clone(this.#dependencies.retainEvidence?.(initialized) ?? initialized);
      // Retained evidence is parsed again to ensure a custom in-memory test sink cannot widen it.
      controlledAcceptanceEvidenceSchema.parse(evidence);
      evidence = { ...evidence, fingerprint: undefined } as RetainedEvidence;
    } catch {
      return failure(
        "evidence-initialization-failed",
        "Controlled acceptance evidence could not be initialized.",
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
        const result = executeGovernedInitialGeneration(execution.request, input.authority);
        if (!result.valid) throw new Error(result.failure.code);
        integrated = {
          plan: result.plan,
          proposal: result.proposal,
          authorityInput: { plan: result.plan, planningInput: result.planningInput },
        };
      } else {
        const result = executeGovernedFollowUpEditing(execution.request, input.authority);
        if (!result.valid) throw new Error(result.failure.code);
        integrated = {
          plan: result.coordinatedPlan.baselineGenerationPlan,
          proposal: result.proposal,
          authorityInput: { plan: result.coordinatedPlan, planningInput: result.planningInput },
        };
      }
    } catch {
      return failure(
        "planning-proposal-rejected",
        "The governed request could not produce a current reviewable proposal.",
        { ...evidence, providerOutcome: "rejected-before-call" },
        now,
      );
    }

    let providerPlan: WholeStorefrontGenerationPlan;
    this.#providerAttemptCount += 1;
    evidence = { ...evidence, providerAttemptCount: this.#providerAttemptCount };
    try {
      providerPlan = await requestWholeStorefrontGenerationPlan({
        provider: this.#dependencies.provider,
        input: execution.planningInput,
        currentInput: () =>
          this.#dependencies.currentPlanningInput?.() ?? structuredClone(execution.planningInput),
      });
    } catch (error) {
      const code =
        error instanceof WholeStorefrontPlanningProviderError &&
        ["malformed-structured-response", "invalid-plan", "stale-result"].includes(error.code)
          ? "provider-response-validation-failed"
          : "provider-unavailable";
      return failure(
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
      return failure(
        "planning-proposal-rejected",
        "The provider plan does not match the governed canonical proposal authority.",
        { ...evidence, providerOutcome: "completed", planFingerprint: providerPlan.fingerprint },
        now,
      );
    }
    this.#successfulCallCount += 1;

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
      coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
        proposal: integrated.proposal,
        currentInput: () => {
          const currentPlanning =
            this.#dependencies.currentAcceptancePlanningInput?.() ??
            this.#dependencies.currentPlanningInput?.() ??
            execution.planningInput;
          return currentAuthorityInput(
            integrated.plan,
            wholeStorefrontPlanningInputSchema.parse(clone(currentPlanning)),
            execution.kind === "followUpEditing"
              ? (integrated.authorityInput as { plan: unknown }).plan
              : undefined,
          );
        },
      });
    } catch {
      return failure("stale-acceptance", "The proposal became stale before review.", evidence, now);
    }
    const preview = coordinator.inspect();
    if (preview.state !== "ready" || preview.proposal.status !== "pending") {
      return failure(
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
        return failure(
          "stale-acceptance",
          "The proposal became stale before acceptance.",
          evidence,
          now,
        );
      }
      if (lifecycle.state !== "accepted") {
        return failure(
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
          return failure(
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
            return failure(
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
      return failure(
        "lifecycle-failed",
        "The configured review stages do not match the lifecycle exercise.",
        evidence,
        now,
      );
    }
    const final = coordinator.inspect();
    const after = protectedStateFingerprint(final.activeStorefront);
    if (before !== after) {
      return failure(
        "protected-state-violation",
        "Controlled acceptance detected a protected navigation, commerce, asset, or binding mutation.",
        { ...evidence, protectedStateAfterFingerprint: after },
        now,
      );
    }
    if (
      canonicalValueString(final.publishedStorefront) !==
      canonicalValueString(integrated.proposal.originalStorefront)
    ) {
      return failure(
        "lifecycle-failed",
        "Controlled acceptance must not publish a storefront.",
        evidence,
        now,
      );
    }
    return frozen({
      ok: true as const,
      evidence: completeEvidence({
        ...evidence,
        completedAt: now,
        protectedStateAfterFingerprint: after,
        finalStatus: "succeeded",
      }),
    });
  }
}
