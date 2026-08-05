import { describe, expect, it, vi } from "vitest";
import {
  ControlledAcceptancePreflightRunner,
  CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION,
  controlledAcceptanceAuthorityFingerprint,
  controlledAcceptanceCaseFingerprint,
  controlledLiveCallAuthorizationFingerprint,
  declaredPageAuthorityFingerprint,
  type ControlledAcceptanceCase,
  type ControlledLiveCallAuthorization,
} from "@/application/controlled-acceptance-preflight";
import {
  executeGovernedInitialGeneration,
  governedSkillPackageRegistry,
  skillCapabilityKnowledge,
  type GovernedEditingPageAuthority,
  type GovernedFollowUpEditingRequest,
  type GovernedInitialGenerationRequest,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
  type WholeStorefrontPlanningProvider,
} from "@/application/whole-storefront-generation-plan";
import { planRegisteredTokenRefinement } from "@/application/ai-storefront-generation/token-refinement";
import { homepageCommerceBridgeDefaults } from "@/components/registry";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";

const providerId = "deterministic-test-provider";
const now = () => "2026-08-05T09:00:00.000Z";

function source() {
  const fixture = createP905aFreshMerchantFixture("modernTechnical");
  const planningInput = structuredClone(fixture.planningInput);
  const target = createWholeStorefrontGenerationTarget(planningInput);
  const authority: GovernedSkillAuthorityEnvelope = {
    projectId: planningInput.project.id,
    projectRevision: planningInput.project.revision,
    draftSnapshotId: planningInput.draft.id,
    draftRevision: planningInput.draft.revision,
    snapshotFingerprint: target.activeDraftFingerprint,
    manifest: skillCapabilityKnowledge.getManifestReference(),
    packageRegistry: {
      version: governedSkillPackageRegistry.version,
      fingerprint: governedSkillPackageRegistry.fingerprint,
    },
    componentRegistryFingerprint: target.registryFingerprint,
    commerceFingerprint: target.canonicalCommerceFingerprint,
    approvedAssetFingerprint: target.approvedAssetContextFingerprint,
    locale: "en",
    requestIdentity: "p10a-07c-02-request",
  };
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId: "modernTechnical",
  });
  return { planningInput, authority, plan };
}

function initialRequest(value = source()): GovernedInitialGenerationRequest {
  const descriptor = governedSkillPackageRegistry.resolve(
    "applyRegisteredWholeStorefrontDirection",
    "initialGeneration",
  ).descriptor;
  const profiles = value.plan.pageBlueprintMaterializations.map((materialization) => {
    const profile = skillCapabilityKnowledge
      .listExecutableProfiles({
        manifest: value.authority.manifest,
        pageType: materialization.pageType,
      })
      .find((candidate) => candidate.profileId === materialization.profileId);
    const page = value.plan.target.pages.find(
      (candidate) => candidate.type === materialization.pageType,
    );
    if (!profile || !page)
      throw new Error("Expected registered initial-generation profile authority.");
    return {
      pageId: page.id,
      pageType: page.type,
      profileId: profile.profileId,
      fingerprint: profile.fingerprint,
      materializationFingerprint: materialization.fingerprint,
    };
  });
  return {
    executionKind: "initialGeneration",
    packageId: descriptor.id,
    packageVersion: descriptor.version,
    authority: {
      executionKind: "initialGeneration",
      authority: structuredClone(value.authority),
      brief: {
        briefId: value.planningInput.brief.id,
        revision: value.planningInput.brief.revision,
        fingerprint: value.planningInput.brief.fingerprint,
      },
      profiles,
      catalogueFingerprint: value.authority.commerceFingerprint,
      registeredDirectionId: "modernTechnical",
      outputContractId: "wholeStorefrontPlanningInput.v1",
    },
    planningInput: structuredClone(value.planningInput),
  };
}

function followUpRequest(value = source()): GovernedFollowUpEditingRequest {
  const home = value.planningInput.draft.pages.find((page) => page.type === "home");
  const hero = home?.sections.find((section) => section.component === "hero");
  if (!home || !hero) throw new Error("Expected canonical home hero.");
  hero.component = "homepageHero";
  hero.variant = "editorial";
  hero.content = structuredClone(homepageCommerceBridgeDefaults.homepageHero.content);
  hero.props = structuredClone(homepageCommerceBridgeDefaults.homepageHero.props);
  const target = createWholeStorefrontGenerationTarget(value.planningInput);
  value.authority = {
    ...value.authority,
    snapshotFingerprint: target.activeDraftFingerprint,
    componentRegistryFingerprint: target.registryFingerprint,
    commerceFingerprint: target.canonicalCommerceFingerprint,
    approvedAssetFingerprint: target.approvedAssetContextFingerprint,
  };
  const plan = createWholeStorefrontGenerationPlan(value.planningInput, {
    directionId: "modernTechnical",
  });
  const materialization = plan.pageBlueprintMaterializations.find(
    (item) => item.pageType === "home",
  );
  const profile = skillCapabilityKnowledge
    .listExecutableProfiles({ manifest: value.authority.manifest, pageType: "home" })
    .find((candidate) => candidate.profileId === materialization?.profileId);
  const selection = profile?.componentSelections.find(
    (candidate) => candidate.componentType === "homepageHero",
  );
  const page = plan.target.pages.find((candidate) => candidate.type === "home");
  if (!materialization || !profile || !selection || !page)
    throw new Error("Expected canonical follow-up page authority.");
  const authority: GovernedEditingPageAuthority = {
    pageId: page.id,
    pageType: "home",
    profile: { profileId: profile.profileId, fingerprint: profile.fingerprint, pageType: "home" },
    selections: [
      {
        profileId: profile.profileId,
        slotId: selection.slotId,
        componentType: selection.componentType,
        variant: selection.defaultVariant,
      },
    ],
    boundedParameters: [],
    bindings: [],
    approvedAssets: [],
  };
  const descriptor = governedSkillPackageRegistry.resolve(
    "improveHero",
    "followUpEditing",
  ).descriptor;
  return {
    authority: {
      executionKind: "followUpEditing",
      packageId: descriptor.id,
      packageVersion: descriptor.version,
      scope: descriptor.scope,
      authority: structuredClone(value.authority),
      pages: [authority],
    },
    planningInput: structuredClone(value.planningInput),
  };
}

function stages(lifecycle: ControlledAcceptanceCase["lifecycleExercise"]) {
  if (lifecycle === "preview-only") return ["proposal-retained", "previewed"] as const;
  if (lifecycle === "reject") return ["proposal-retained", "previewed", "rejected"] as const;
  if (lifecycle === "accept") return ["proposal-retained", "previewed", "accepted"] as const;
  if (lifecycle === "accept-undo")
    return ["proposal-retained", "previewed", "accepted", "undone"] as const;
  return ["proposal-retained", "previewed", "accepted", "undone", "redone"] as const;
}

function acceptanceCase(
  execution: GovernedInitialGenerationRequest | GovernedFollowUpEditingRequest = initialRequest(),
  lifecycle: ControlledAcceptanceCase["lifecycleExercise"] = "preview-only",
): ControlledAcceptanceCase {
  const authority =
    "executionKind" in execution ? execution.authority.authority : execution.authority.authority;
  const kind = "executionKind" in execution ? "initialGeneration" : "followUpEditing";
  return {
    caseId: "p10a-07c-02-case",
    caseVersion: CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION,
    executionKind: kind,
    requestIdentity: authority.requestIdentity,
    locale: authority.locale,
    authority: structuredClone(authority),
    declaredPageAuthorityFingerprint: declaredPageAuthorityFingerprint(execution),
    providerConfiguration: { providerId, modelId: "deterministic-v1" },
    expectedModelId: "deterministic-v1",
    maximumProviderCalls: 1,
    expectedReviewStages: [...stages(lifecycle)],
    lifecycleExercise: lifecycle,
    evidenceRetention: { kind: "in-memory", destinationId: "controlled-test-evidence" },
    execution: structuredClone(execution),
  };
}

function authorization(input: ControlledAcceptanceCase): ControlledLiveCallAuthorization {
  const unsigned = {
    kind: "controlled-live-provider-call" as const,
    authorizationId: "test-authorization-identity",
    caseId: input.caseId,
    caseVersion: CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION,
    authorityFingerprint: controlledAcceptanceAuthorityFingerprint(input.authority),
    caseFingerprint: controlledAcceptanceCaseFingerprint(input),
    providerId,
    maximumProviderCalls: input.maximumProviderCalls,
  };
  return { ...unsigned, fingerprint: controlledLiveCallAuthorizationFingerprint(unsigned) };
}

function provider(
  calls = vi.fn(),
  response: (request: Parameters<WholeStorefrontPlanningProvider["createPlan"]>[0]) => unknown = (
    request,
  ) => request.expectedPlan,
): WholeStorefrontPlanningProvider {
  return {
    id: providerId,
    capabilities: {
      wholeStorefrontPlanning: true,
      structuredPlanOutput: true,
      approvedAssetReferences: true,
    },
    createPlan(request) {
      calls();
      return Promise.resolve(response(request));
    },
  };
}

function runner(
  input: ControlledAcceptanceCase,
  providerValue: WholeStorefrontPlanningProvider,
  extra: Partial<ConstructorParameters<typeof ControlledAcceptancePreflightRunner>[0]> = {},
) {
  return new ControlledAcceptancePreflightRunner({
    provider: providerValue,
    providerModelId: "deterministic-v1",
    currentAuthority: () => structuredClone(input.authority),
    currentPlanningInput: () =>
      structuredClone((input.execution as GovernedInitialGenerationRequest).planningInput),
    allowedProviderIds: [providerId],
    now,
    ...extra,
  });
}

describe("P10A-07C-02 controlled provider acceptance preflight", () => {
  it("defaults to zero provider calls and blocks missing, invalid, and zero-budget authorization", async () => {
    const input = acceptanceCase();
    const calls = vi.fn();
    const preflight = runner(input, provider(calls));
    await expect(preflight.run(input)).resolves.toMatchObject({
      ok: false,
      failure: { code: "missing-live-authorization" },
    });
    const invalid = { ...authorization(input), fingerprint: "stale-authorization" };
    await expect(preflight.run(input, invalid)).resolves.toMatchObject({
      ok: false,
      failure: { code: "invalid-live-authorization" },
    });
    const unsupported = { ...input, caseVersion: "9.9.9" };
    await expect(preflight.run(unsupported)).resolves.toMatchObject({
      ok: false,
      failure: { code: "unsupported-case-version" },
    });
    const zero = { ...input, maximumProviderCalls: 0 };
    await expect(
      runner(zero, provider(calls)).run(zero, authorization(zero)),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "provider-allowance-exhausted" },
    });
    expect(calls).not.toHaveBeenCalled();
  });

  it("fails stale project, draft, snapshot, registry, manifest, and profile authority before provider invocation", async () => {
    const input = acceptanceCase();
    const calls = vi.fn();
    const staleCurrent = {
      ...input.authority,
      projectRevision: input.authority.projectRevision + 1,
    };
    await expect(
      runner(input, provider(calls), { currentAuthority: () => staleCurrent }).run(
        input,
        authorization(input),
      ),
    ).resolves.toMatchObject({ ok: false, failure: { code: "stale-authority" } });
    const staleRegistry = structuredClone(input);
    staleRegistry.authority.manifest.fingerprint = "stale-manifest";
    await expect(
      runner(staleRegistry, provider(calls)).run(staleRegistry, authorization(staleRegistry)),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "stale-authority" },
    });
    const staleProfile = { ...input, declaredPageAuthorityFingerprint: "stale-profile" };
    await expect(
      runner(staleProfile, provider(calls)).run(staleProfile, authorization(staleProfile)),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "stale-authority" },
    });
    expect(calls).not.toHaveBeenCalled();
  });

  it("uses P10A-05C authority through preview, acceptance, undo and redo with safe retained evidence", async () => {
    const input = acceptanceCase(initialRequest(), "accept-undo-redo");
    const calls = vi.fn();
    const result = await runner(input, provider(calls)).run(input, authorization(input));
    expect(result).toMatchObject({
      ok: true,
      evidence: { providerAttemptCount: 1, providerOutcome: "completed" },
    });
    expect(calls).toHaveBeenCalledOnce();
    if (!result.ok) throw new Error(result.failure.message);
    expect(result.evidence.governedPackageId).toBe("applyRegisteredWholeStorefrontDirection");
    expect(result.evidence.proposalFingerprint).toMatch(/^whole_storefront_proposal_/);
    expect(result.evidence.previewFingerprint).not.toBeNull();
    expect(result.evidence.acceptanceFingerprint).not.toBeNull();
    expect(result.evidence.undoFingerprint).not.toBeNull();
    expect(result.evidence.redoFingerprint).not.toBeNull();
    expect(result.evidence.publishState).toBe("not-published");
    expect(JSON.stringify(result.evidence)).not.toMatch(
      /credential|api[_-]?key|raw provider|merchantInstruction/i,
    );
  }, 20_000);

  it("uses the P10A-05D-02 explicit follow-up authority through the same provider guard", async () => {
    const input = acceptanceCase(followUpRequest(), "preview-only");
    const calls = vi.fn();
    const result = await runner(input, provider(calls)).run(input, authorization(input));
    expect(result).toMatchObject({
      ok: true,
      evidence: { executionKind: "followUpEditing", providerAttemptCount: 1 },
    });
    expect(calls).toHaveBeenCalledOnce();
  }, 20_000);

  it("forwards governed follow-up direction, token, package, and request identity context", async () => {
    const directionalSource = source();
    const directionalBase = followUpRequest(directionalSource);
    const directionDescriptor = governedSkillPackageRegistry.resolve(
      "applyRegisteredWholeStorefrontDirection",
      "followUpEditing",
    ).descriptor;
    const directional = {
      ...directionalBase,
      authority: {
        ...directionalBase.authority,
        packageId: directionDescriptor.id,
        packageVersion: directionDescriptor.version,
        scope: directionDescriptor.scope,
      },
      registeredDirectionId: "modernTechnical" as const,
    };
    const tokenSource = source();
    const tokenBase = followUpRequest(tokenSource);
    const tokenDescriptor = governedSkillPackageRegistry.resolve(
      "applyExactBrandPalette",
      "followUpEditing",
    ).descriptor;
    const tokenRefinementPlan = planRegisteredTokenRefinement(
      "Set primary #B54708, secondary #111111, accent #B54708, background #FFFFFF, surface #FFFFFF, text #111111, muted text #333333, and border #111111. Preserve all layouts and commerce.",
      tokenSource.planningInput.draft.brandSystem,
    );
    if (!tokenRefinementPlan) throw new Error("Expected a registered token refinement plan.");
    const token = {
      ...tokenBase,
      authority: {
        ...tokenBase.authority,
        packageId: tokenDescriptor.id,
        packageVersion: tokenDescriptor.version,
        scope: tokenDescriptor.scope,
        pages: [],
      },
      tokenRefinementPlan,
    };
    const requests: Parameters<WholeStorefrontPlanningProvider["createPlan"]>[0][] = [];
    const captureProvider = provider(vi.fn(), (request) => {
      requests.push(request);
      return request.expectedPlan;
    });
    const directionalCase = acceptanceCase(directional);
    const tokenCase = acceptanceCase(token);
    await expect(
      runner(directionalCase, captureProvider).run(directionalCase, authorization(directionalCase)),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      runner(tokenCase, captureProvider).run(tokenCase, authorization(tokenCase)),
    ).resolves.toMatchObject({ ok: true });
    const directionRequest = requests.find(
      (request) =>
        request.governedExecution?.packageId === "applyRegisteredWholeStorefrontDirection",
    );
    const tokenRequest = requests.find(
      (request) => request.governedExecution?.packageId === "applyExactBrandPalette",
    );
    expect(directionRequest?.governedExecution).toEqual({
      executionKind: "followUpEditing",
      packageId: "applyRegisteredWholeStorefrontDirection",
      requestIdentity: directionalCase.requestIdentity,
    });
    expect(directionRequest?.tokenRefinementPlan).toBeNull();
    expect(directionRequest?.expectedPlan.designSystemSelection.directionId).toBe(
      "modernTechnical",
    );
    expect(tokenRequest?.governedExecution).toEqual({
      executionKind: "followUpEditing",
      packageId: "applyExactBrandPalette",
      requestIdentity: tokenCase.requestIdentity,
    });
    expect(tokenRequest?.tokenRefinementPlan).toEqual(tokenRefinementPlan);
  }, 30_000);

  it("exercises the canonical reject lifecycle without publish or protected-state mutation", async () => {
    const input = acceptanceCase(initialRequest(), "reject");
    const result = await runner(input, provider()).run(input, authorization(input));
    if (!result.ok) throw new Error(result.failure.message);
    expect(result.evidence.previewFingerprint).not.toBeNull();
    expect(result.evidence.protectedStateBeforeFingerprint).toBe(
      result.evidence.protectedStateAfterFingerprint,
    );
    expect(result.evidence.publishState).toBe("not-published");
  }, 20_000);

  it("exhausts an authorization after one successful call and never retries a provider failure", async () => {
    const input = acceptanceCase();
    const calls = vi.fn();
    const preflight = runner(input, provider(calls));
    expect((await preflight.run(input, authorization(input))).ok).toBe(true);
    await expect(preflight.run(input, authorization(input))).resolves.toMatchObject({
      ok: false,
      failure: { code: "provider-allowance-exhausted" },
    });
    expect(calls).toHaveBeenCalledOnce();

    const failingCalls = vi.fn();
    const unavailable = provider(failingCalls, () => {
      throw new Error("deterministic transport failure");
    });
    const failingPreflight = runner(input, unavailable);
    await expect(failingPreflight.run(input, authorization(input))).resolves.toMatchObject({
      ok: false,
      failure: { code: "provider-unavailable" },
      evidence: { providerAttemptCount: 1, providerOutcome: "unavailable" },
    });
    expect(failingCalls).toHaveBeenCalledOnce();
    await expect(failingPreflight.run(input, authorization(input))).resolves.toMatchObject({
      ok: false,
      failure: { code: "provider-allowance-exhausted" },
    });
  }, 20_000);

  it("keeps budget scoped to an authorization fingerprint and does not consume it before a call", async () => {
    const input = acceptanceCase();
    const distinctCase = { ...input, caseId: "p10a-07c-02-case-distinct" };
    const calls = vi.fn();
    const preflight = runner(input, provider(calls));
    const invalid = { ...authorization(input), caseFingerprint: "tampered-case-fingerprint" };
    await expect(preflight.run(input, invalid)).resolves.toMatchObject({
      ok: false,
      failure: { code: "invalid-live-authorization" },
    });
    await expect(preflight.run(input, authorization(input))).resolves.toMatchObject({ ok: true });
    await expect(preflight.run(distinctCase, authorization(distinctCase))).resolves.toMatchObject({
      ok: true,
    });
    await expect(preflight.run(input, authorization(input))).resolves.toMatchObject({
      ok: false,
      failure: { code: "provider-allowance-exhausted" },
    });
    expect(calls).toHaveBeenCalledTimes(2);
  }, 30_000);

  it("classifies deterministic provider validation separately from provider availability", async () => {
    const input = acceptanceCase();
    const result = await runner(
      input,
      provider(vi.fn(), (request) => ({ ...request.expectedPlan, fingerprint: "invalid-plan" })),
    ).run(input, authorization(input));
    expect(result).toMatchObject({
      ok: false,
      failure: { code: "provider-response-validation-failed" },
      evidence: { providerOutcome: "invalid-response" },
    });
  }, 20_000);

  it("fails stale acceptance closed after retaining the reviewable proposal", async () => {
    const input = acceptanceCase(initialRequest(), "accept");
    let reads = 0;
    const currentPlanningInput = () => {
      reads += 1;
      if (reads < 5) {
        return structuredClone((input.execution as GovernedInitialGenerationRequest).planningInput);
      }
      const stale = structuredClone(
        (input.execution as GovernedInitialGenerationRequest).planningInput,
      ) as ReturnType<typeof source>["planningInput"];
      stale.draft.revision += 1;
      return stale;
    };
    await expect(
      runner(input, provider(), { currentPlanningInput }).run(input, authorization(input)),
    ).resolves.toMatchObject({ ok: false, failure: { code: "stale-acceptance" } });
  }, 20_000);

  it("returns a typed malformed-case result for non-cloneable input without provider or network activity", async () => {
    const input = acceptanceCase();
    const calls = vi.fn();
    const result = await runner(input, provider(calls)).run({
      ...input,
      execution: () => undefined,
    });
    expect(result).toMatchObject({
      ok: false,
      failure: { code: "malformed-case" },
      evidence: null,
    });
    expect(calls).not.toHaveBeenCalled();
  });

  it("keeps evidence fingerprints deterministic for equivalent accepted executions", async () => {
    const first = acceptanceCase(initialRequest(), "accept-undo-redo");
    const second = acceptanceCase(initialRequest(), "accept-undo-redo");
    const one = await runner(first, provider()).run(first, authorization(first));
    const two = await runner(second, provider()).run(second, authorization(second));
    if (!one.ok || !two.ok) throw new Error("Expected deterministic acceptance evidence.");
    expect(one.evidence.fingerprint).toBe(two.evidence.fingerprint);
  }, 20_000);

  it("does not call a provider when evidence retention cannot initialize", async () => {
    const input = acceptanceCase();
    const calls = vi.fn();
    await expect(
      runner(input, provider(calls), {
        retainEvidence: () => {
          throw new Error("in-memory sink unavailable");
        },
      }).run(input, authorization(input)),
    ).resolves.toMatchObject({ ok: false, failure: { code: "evidence-initialization-failed" } });
    expect(calls).not.toHaveBeenCalled();
  });

  it("retains final terminal evidence for both success and pre-call rejection", async () => {
    const input = acceptanceCase();
    const retained: unknown[] = [];
    const preflight = runner(input, provider(), {
      retainEvidence: (evidence) => {
        retained.push(structuredClone(evidence));
        return evidence;
      },
    });
    const success = await preflight.run(input, authorization(input));
    const rejection = await preflight.run(input);
    if (!success.ok || rejection.ok) throw new Error("Expected terminal evidence outcomes.");
    expect(retained.at(-2)).toMatchObject({
      completedAt: now(),
      finalStatus: "succeeded",
      providerCompletionCount: 1,
      failure: null,
    });
    expect(retained.at(-1)).toMatchObject({
      completedAt: now(),
      finalStatus: "failed",
      failure: { code: "missing-live-authorization" },
    });
    expect(success.evidence).toEqual(retained.at(-2));
    expect(rejection.evidence).toEqual(retained.at(-1));
  }, 20_000);

  it("rejects case, trusted model, and required current-planning tampering before provider use", async () => {
    const input = acceptanceCase();
    const calls = vi.fn();
    const changedLifecycle = {
      ...input,
      lifecycleExercise: "reject" as const,
      expectedReviewStages: [...stages("reject")],
    };
    await expect(
      runner(input, provider(calls)).run(changedLifecycle, authorization(input)),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "invalid-live-authorization" },
    });
    const mismatchedModel = { ...input, expectedModelId: "untrusted-model" };
    await expect(
      runner(mismatchedModel, provider(calls)).run(mismatchedModel, authorization(mismatchedModel)),
    ).resolves.toMatchObject({ ok: false, failure: { code: "invalid-provider-configuration" } });
    await expect(
      runner(input, provider(calls), {
        currentPlanningInput: () => {
          throw new Error("Current server state unavailable");
        },
      }).run(input, authorization(input)),
    ).resolves.toMatchObject({ ok: false, failure: { code: "stale-authority" } });
    expect(calls).not.toHaveBeenCalled();
  });

  it("proves a governed initial proposal remains pending before lifecycle exercise", () => {
    const input = initialRequest();
    const result = executeGovernedInitialGeneration(input, input.authority.authority);
    expect(result).toMatchObject({ valid: true, proposal: { status: "pending" } });
  }, 20_000);
});
