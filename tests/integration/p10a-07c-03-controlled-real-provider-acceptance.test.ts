// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
  STRICT_SCOPE_ROUTER_CONTRACT_VERSION,
  governedSkillPackageRegistry,
  routeGovernedDesignRequest,
  skillCapabilityKnowledge,
  type GovernedEditingPageAuthority,
  type GovernedFollowUpEditingRequest,
  type GovernedInitialGenerationRequest,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
} from "@/application/whole-storefront-generation-plan";
import { homepageCommerceBridgeDefaults } from "@/components/registry";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { selectServerWholeStorefrontPlanningProviderConfiguration } from "@/integrations/ai/openai/whole-storefront-planning-client.server";

const enabled = process.env.VESKIFY_P10A_07C_03_CONTROLLED_ACCEPTANCE === "1";
const now = () => "2026-08-05T12:00:00.000Z";

function source(requestIdentity: string, heroAuthority = false) {
  const fixture = createP905aFreshMerchantFixture("modernTechnical");
  const planningInput = structuredClone(fixture.planningInput);
  if (heroAuthority) {
    const home = planningInput.draft.pages.find((page) => page.type === "home");
    const hero = home?.sections.find((section) => section.component === "hero");
    if (!home || !hero) throw new Error("Expected the canonical homepage hero.");
    hero.component = "homepageHero";
    hero.variant = "editorial";
    hero.content = structuredClone(homepageCommerceBridgeDefaults.homepageHero.content);
    hero.props = structuredClone(homepageCommerceBridgeDefaults.homepageHero.props);
  }
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
    requestIdentity,
  };
  return {
    planningInput,
    authority,
    plan: createWholeStorefrontGenerationPlan(planningInput, { directionId: "modernTechnical" }),
  };
}

function initialRequest(value: ReturnType<typeof source>): GovernedInitialGenerationRequest {
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
      throw new Error("Expected current initial-generation profile authority.");
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

function heroAuthority(value: ReturnType<typeof source>): GovernedEditingPageAuthority {
  const materialization = value.plan.pageBlueprintMaterializations.find(
    (candidate) => candidate.pageType === "home",
  );
  const profile = skillCapabilityKnowledge
    .listExecutableProfiles({ manifest: value.authority.manifest, pageType: "home" })
    .find((candidate) => candidate.profileId === materialization?.profileId);
  const selection = profile?.componentSelections.find(
    (candidate) => candidate.componentType === "homepageHero",
  );
  const page = value.plan.target.pages.find((candidate) => candidate.type === "home");
  if (!profile || !selection || !page) throw new Error("Expected exact current hero authority.");
  return {
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
}

function followUpRequest(value: ReturnType<typeof source>): GovernedFollowUpEditingRequest {
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
      pages: [heroAuthority(value)],
    },
    planningInput: structuredClone(value.planningInput),
  };
}

function stages(
  lifecycle: ControlledAcceptanceCase["lifecycleExercise"],
): ControlledAcceptanceCase["expectedReviewStages"] {
  return lifecycle === "preview-only"
    ? ["proposal-retained", "previewed"]
    : ["proposal-retained", "previewed", "accepted", "undone", "redone"];
}

function acceptanceCase(
  caseId: string,
  execution: GovernedInitialGenerationRequest | GovernedFollowUpEditingRequest,
  routerDecisionFingerprint: string,
  lifecycle: ControlledAcceptanceCase["lifecycleExercise"],
  providerConfiguration: Readonly<{ providerId: string; modelId: string }>,
): ControlledAcceptanceCase {
  const authority = execution.authority.authority;
  return {
    caseId,
    caseVersion: CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION,
    executionKind: "executionKind" in execution ? "initialGeneration" : "followUpEditing",
    requestIdentity: authority.requestIdentity,
    locale: authority.locale,
    authority: structuredClone(authority),
    routerDecisionFingerprint,
    declaredPageAuthorityFingerprint: declaredPageAuthorityFingerprint(execution),
    providerConfiguration,
    expectedModelId: providerConfiguration.modelId,
    maximumProviderCalls: 1,
    expectedReviewStages: stages(lifecycle),
    lifecycleExercise: lifecycle,
    evidenceRetention: { kind: "in-memory", destinationId: "p10a-07c-03-evidence" },
    execution: structuredClone(execution),
  };
}

function authorization(input: ControlledAcceptanceCase): ControlledLiveCallAuthorization {
  const unsigned = {
    kind: "controlled-live-provider-call" as const,
    authorizationId: `${input.caseId}-authorization`,
    caseId: input.caseId,
    caseVersion: CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION,
    authorityFingerprint: controlledAcceptanceAuthorityFingerprint(input.authority),
    caseFingerprint: controlledAcceptanceCaseFingerprint(input),
    providerId: input.providerConfiguration.providerId,
    maximumProviderCalls: 1,
  };
  return { ...unsigned, fingerprint: controlledLiveCallAuthorizationFingerprint(unsigned) };
}

function routeInitial(
  value: ReturnType<typeof source>,
  execution: GovernedInitialGenerationRequest,
) {
  return routeGovernedDesignRequest(
    {
      contractVersion: STRICT_SCOPE_ROUTER_CONTRACT_VERSION,
      merchantInstruction: "Create a new storefront.",
      declaredExecutionKind: "initialGeneration",
      declaredIntent: "createNewStorefront",
      declaredScope: "completeStorefront",
      declaredPageIds: execution.authority.profiles.map((profile) => profile.pageId),
      declaredSlots: [],
      initialGeneration: execution,
    },
    value.authority,
    { dispatch: true },
  );
}

function routeHero(value: ReturnType<typeof source>, execution: GovernedFollowUpEditingRequest) {
  const authority = execution.authority.pages[0];
  if (!authority) throw new Error("Expected hero page authority.");
  return routeGovernedDesignRequest(
    {
      contractVersion: STRICT_SCOPE_ROUTER_CONTRACT_VERSION,
      merchantInstruction: "Improve this hero.",
      declaredExecutionKind: "followUpEditing",
      declaredIntent: "heroImprovement",
      declaredScope: "selectedSection",
      declaredPageIds: [authority.pageId],
      declaredSlots: authority.selections.map((selection) => ({
        pageId: authority.pageId,
        slotId: selection.slotId,
      })),
      followUpEditing: execution,
    },
    value.authority,
    { dispatch: true },
  );
}

describe.runIf(enabled)("P10A-07C-03 controlled real-provider acceptance", () => {
  it("performs the two authorized cases serially with safe retained evidence", async () => {
    const configured = selectServerWholeStorefrontPlanningProviderConfiguration();
    expect(configured.provider.id).toBe("openai-whole-storefront-planning");
    expect(configured.modelId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/);
    if (configured.modelId === null)
      throw new Error("Expected configured provider model identity.");
    const providerConfiguration = {
      providerId: configured.provider.id,
      modelId: configured.modelId,
    };

    const initialSource = source("p10a-07c-03-case-a-request");
    const initialExecution = initialRequest(initialSource);
    const initialRoute = routeInitial(initialSource, initialExecution);
    expect(initialRoute.outcome).toBe("initialGeneration");
    if (initialRoute.outcome !== "initialGeneration")
      throw new Error("Initial route was rejected.");
    expect(initialRoute.execution?.valid).toBe(true);
    const initialCase = acceptanceCase(
      "p10a-07c-03-case-a",
      initialExecution,
      initialRoute.decision.fingerprint,
      "preview-only",
      providerConfiguration,
    );
    const retained: unknown[] = [];
    const initialResult = await new ControlledAcceptancePreflightRunner({
      provider: configured.provider,
      providerModelId: configured.modelId,
      currentAuthority: () => structuredClone(initialSource.authority),
      currentPlanningInput: () => structuredClone(initialSource.planningInput),
      allowedProviderIds: [configured.provider.id],
      now,
      retainEvidence: (evidence) => {
        retained.push(structuredClone(evidence));
        return evidence;
      },
    }).run(initialCase, authorization(initialCase));
    expect(initialResult.ok).toBe(true);
    if (!initialResult.ok) throw new Error(initialResult.failure.code);
    expect(initialResult.evidence).toMatchObject({
      routerDecisionFingerprint: initialRoute.decision.fingerprint,
      providerAttemptCount: 1,
      providerCompletionCount: 1,
      publishState: "not-published",
      finalStatus: "succeeded",
    });

    const followUpSource = source("p10a-07c-03-case-b-request", true);
    const followUpExecution = followUpRequest(followUpSource);
    const followUpRoute = routeHero(followUpSource, followUpExecution);
    expect(followUpRoute.outcome).toBe("followUpEditing");
    if (followUpRoute.outcome !== "followUpEditing") throw new Error("Hero route was rejected.");
    expect(followUpRoute.execution?.valid).toBe(true);
    if (followUpRoute.execution?.valid) {
      const original = followUpRoute.execution.proposal.originalStorefront.pages.find(
        (page) => page.type === "home",
      );
      const proposed = followUpRoute.execution.proposal.proposedStorefront.pages.find(
        (page) => page.type === "home",
      );
      if (!original || !proposed) throw new Error("Expected governed home proposal pages.");
      expect(
        proposed.components.filter((component) => component.component !== "homepageHero"),
      ).toEqual(original.components.filter((component) => component.component !== "homepageHero"));
    }
    const followUpCase = acceptanceCase(
      "p10a-07c-03-case-b",
      followUpExecution,
      followUpRoute.decision.fingerprint,
      "accept-undo-redo",
      providerConfiguration,
    );
    const followUpResult = await new ControlledAcceptancePreflightRunner({
      provider: configured.provider,
      providerModelId: configured.modelId,
      currentAuthority: () => structuredClone(followUpSource.authority),
      currentPlanningInput: () => structuredClone(followUpSource.planningInput),
      allowedProviderIds: [configured.provider.id],
      now,
      retainEvidence: (evidence) => {
        retained.push(structuredClone(evidence));
        return evidence;
      },
    }).run(followUpCase, authorization(followUpCase));
    expect(followUpResult.ok).toBe(true);
    if (!followUpResult.ok) throw new Error(followUpResult.failure.code);
    expect(followUpResult.evidence).toMatchObject({
      routerDecisionFingerprint: followUpRoute.decision.fingerprint,
      providerAttemptCount: 1,
      providerCompletionCount: 1,
      publishState: "not-published",
      finalStatus: "succeeded",
    });
    expect(followUpResult.evidence.acceptanceFingerprint).not.toBeNull();
    expect(followUpResult.evidence.undoFingerprint).not.toBeNull();
    expect(followUpResult.evidence.redoFingerprint).not.toBeNull();
    expect(retained).toHaveLength(4);
  }, 90_000);
});
