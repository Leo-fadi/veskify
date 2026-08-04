import { describe, expect, it } from "vitest";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
} from "@/application/whole-storefront-generation-plan";
import {
  WholeStorefrontProposalAcceptanceCoordinator,
  compileWholeStorefrontProposal,
} from "@/application/whole-storefront-proposal-lifecycle";
import { canonicalValueString } from "@/domain/storefront";
import {
  executeGovernedInitialGeneration,
  validateAuthorizedInitialGenerationProfileSet,
  type GovernedInitialGenerationRequest,
} from "@/application/design-skills/initial-generation-integration";
import {
  governedSkillPackageRegistry,
  type GovernedInitialGenerationAuthority,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills/governed-skill-packages";
import { skillCapabilityKnowledge } from "@/application/design-skills/capability-knowledge";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";

function createBaseline() {
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
    requestIdentity: "p10a-05c-initial-generation-request",
  };
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId: "modernTechnical",
  });
  const profiles = plan.pageBlueprintMaterializations.map((materialization) => {
    const capability = skillCapabilityKnowledge
      .listExecutableProfiles({ manifest: authority.manifest, pageType: materialization.pageType })
      .find((profile) => profile.profileId === materialization.profileId);
    const page = target.pages.find((candidate) => candidate.type === materialization.pageType);
    if (!capability || !page) {
      throw new Error("Expected the canonical planner profile to be in the generated manifest.");
    }
    return {
      pageId: page.id,
      pageType: materialization.pageType,
      profileId: capability.profileId,
      fingerprint: capability.fingerprint,
      materializationFingerprint: materialization.fingerprint,
    };
  });
  return {
    planningInput,
    authority,
    plan,
    proposal: compileWholeStorefrontProposal({ plan, planningInput }),
    profiles,
  };
}

const baseline = createBaseline();

type TestInitialGenerationRequest = Omit<GovernedInitialGenerationRequest, "planningInput"> & {
  planningInput: typeof baseline.planningInput;
};

function request(
  overrides: Partial<TestInitialGenerationRequest> = {},
): TestInitialGenerationRequest {
  const descriptor = governedSkillPackageRegistry.resolve(
    "applyRegisteredWholeStorefrontDirection",
    "initialGeneration",
  ).descriptor;
  const outputContract = descriptor.outputContracts.initialGeneration;
  if (!outputContract) throw new Error("Expected the initial-generation output contract.");
  return {
    executionKind: "initialGeneration",
    packageId: descriptor.id,
    packageVersion: descriptor.version,
    authority: {
      executionKind: "initialGeneration",
      authority: structuredClone(baseline.authority),
      brief: {
        briefId: baseline.planningInput.brief.id,
        revision: baseline.planningInput.brief.revision,
        fingerprint: baseline.planningInput.brief.fingerprint,
      },
      profiles: structuredClone(baseline.profiles),
      catalogueFingerprint: baseline.authority.commerceFingerprint,
      registeredDirectionId: "modernTechnical",
      outputContractId: outputContract,
    },
    planningInput: structuredClone(baseline.planningInput),
    ...overrides,
  };
}

function execute(input: unknown, current: GovernedSkillAuthorityEnvelope) {
  return executeGovernedInitialGeneration(input, current);
}

function executeCurrent(input = request()) {
  return execute(input, input.authority.authority);
}

function profileSet(authority: GovernedInitialGenerationAuthority, plan = baseline.plan) {
  return validateAuthorizedInitialGenerationProfileSet(authority, plan);
}

describe("P10A-05C governed initial-generation integration", () => {
  it("authorizes initial generation only for the canonical whole-storefront package", () => {
    expect(executeCurrent()).toMatchObject({ valid: true });
    expect(executeCurrent(request({ packageId: "applyLuxuryStyle" }))).toMatchObject({
      valid: false,
      failure: { code: "invalidExecutionKind" },
    });
    for (const packageId of [
      "applyExactBrandPalette",
      "improveHero",
      "addCampaignSection",
    ] as const) {
      expect(executeCurrent(request({ packageId, packageVersion: "1.0.0" }))).toMatchObject({
        valid: false,
        failure: { code: "invalidExecutionKind" },
      });
    }
  });

  it("maps exact governed authority into the canonical planner and compiler", () => {
    const input = request();
    const result = executeCurrent(input);
    if (!result.valid) throw new Error(result.failure.message);
    expect(result.authority).toEqual({
      ...input.authority,
      profiles: [...input.authority.profiles].sort((left, right) =>
        `${left.pageType}:${left.pageId}:${left.profileId}`.localeCompare(
          `${right.pageType}:${right.pageId}:${right.profileId}`,
        ),
      ),
    });
    expect(result.planningInput).toEqual(input.planningInput);
    expect(result.plan).toEqual(baseline.plan);
    expect(result.proposal).toEqual(baseline.proposal);
    expect(result.proposal.preconditions).toMatchObject({
      projectRevision: input.authority.authority.projectRevision,
      briefRevision: input.authority.brief.revision,
      canonicalCommerceFingerprint: input.authority.catalogueFingerprint,
    });
  });

  it("requires the exact authorized PageBlueprint profile set before compilation", () => {
    const input = request();
    expect(profileSet(input.authority)).toEqual({ valid: true });
    expect(
      profileSet({ ...input.authority, profiles: [...input.authority.profiles].reverse() }),
    ).toEqual({
      valid: true,
    });
    const first = baseline.plan.pageBlueprintMaterializations[0];
    const additional = {
      ...baseline.plan,
      pageBlueprintMaterializations: [...baseline.plan.pageBlueprintMaterializations, first],
    };
    const missing = {
      ...baseline.plan,
      pageBlueprintMaterializations: baseline.plan.pageBlueprintMaterializations.slice(1),
    };
    const differentId = {
      ...baseline.plan,
      pageBlueprintMaterializations: [
        { ...first, profileId: "blueprint-unapproved" },
        ...baseline.plan.pageBlueprintMaterializations.slice(1),
      ],
    };
    const staleFingerprint = {
      ...baseline.plan,
      pageBlueprintMaterializations: [
        { ...first, fingerprint: "stale-materialization-fingerprint" },
        ...baseline.plan.pageBlueprintMaterializations.slice(1),
      ],
    };
    const wrongPageType = {
      ...baseline.plan,
      pageBlueprintMaterializations: [
        { ...first, pageType: "product" satisfies (typeof first)["pageType"] },
        ...baseline.plan.pageBlueprintMaterializations.slice(1),
      ],
    } satisfies typeof baseline.plan;
    for (const plan of [additional, missing, differentId, staleFingerprint, wrongPageType]) {
      expect(profileSet(input.authority, plan)).toMatchObject({ valid: false });
    }
    const contradictory = {
      ...input,
      authority: {
        ...input.authority,
        profiles: [
          { ...input.authority.profiles[0], materializationFingerprint: "stale-materialization" },
          ...input.authority.profiles.slice(1),
        ],
      },
    };
    expect(execute(contradictory, input.authority.authority)).toMatchObject({
      valid: false,
      failure: { code: "staleInitialGenerationAuthority" },
    });
  });

  it("fails stale authority and malformed input before planning", () => {
    const input = request();
    const current = input.authority.authority;
    const checks: readonly [unknown, string][] = [
      [
        {
          ...input,
          authority: {
            ...input.authority,
            authority: { ...input.authority.authority, requestIdentity: "stale" },
          },
        },
        "staleRequestIdentityAuthority",
      ],
      [
        {
          ...input,
          authority: {
            ...input.authority,
            authority: { ...input.authority.authority, projectRevision: 999 },
          },
        },
        "staleProjectAuthority",
      ],
      [
        {
          ...input,
          authority: {
            ...input.authority,
            authority: {
              ...input.authority.authority,
              manifest: { version: "9.9.9", fingerprint: "stale" },
            },
          },
        },
        "staleManifestAuthority",
      ],
      [{ ...input, packageVersion: "9.9.9" }, "stalePackageAuthority"],
      [
        {
          ...input,
          authority: { ...input.authority, catalogueFingerprint: "stale-catalogue" },
        },
        "stalePlanningAuthority",
      ],
      [
        {
          ...input,
          authority: {
            ...input.authority,
            authority: { ...input.authority.authority, approvedAssetFingerprint: "stale-assets" },
          },
        },
        "staleApprovedAssetAuthority",
      ],
      [
        {
          ...input,
          authority: {
            ...input.authority,
            profiles: [{ ...input.authority.profiles[0], fingerprint: "stale-profile" }],
          },
        },
        "staleProfileAuthority",
      ],
    ];
    for (const [candidate, code] of checks) {
      expect(execute(candidate, current)).toMatchObject({ valid: false, failure: { code } });
    }
    for (const malformed of [
      { ...input, planningInput: () => undefined },
      { ...input, planningInput: Symbol("untrusted") },
      {
        ...input,
        planningInput: new Proxy(
          {},
          {
            ownKeys: () => {
              throw new Error("untrusted");
            },
          },
        ),
      },
    ]) {
      expect(execute(malformed, current)).toMatchObject({
        valid: false,
        failure: { code: "invalidRequest" },
      });
    }
    expect(execute({ ...input, planningInput: {} }, current)).toMatchObject({
      valid: false,
      failure: { code: "invalidPlanningInput" },
    });
  });

  it("reuses deterministic canonical planner and compiler output without duplicate fixture execution", () => {
    const input = request();
    const result = executeCurrent(input);
    if (!result.valid) throw new Error(result.failure.message);
    expect(result.planningInput).toEqual(baseline.planningInput);
    expect(result.plan.fingerprint).toBe(baseline.plan.fingerprint);
    expect(result.proposal.id).toBe(baseline.proposal.id);
    expect(result.proposal.reviewSummary).toEqual(baseline.proposal.reviewSummary);
  });

  it("keeps review-before-apply, acceptance, undo, redo and protected state on canonical paths", () => {
    const input = request();
    const before = canonicalValueString({
      catalogue: input.planningInput.catalogue,
      approvedAssets: input.planningInput.approvedAssetContext,
      navigation: input.planningInput.draft.navigation,
    });
    const result = executeCurrent(input);
    if (!result.valid) throw new Error(result.failure.message);
    expect(result.proposal.status).toBe("pending");
    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal: result.proposal,
      currentInput: () => ({ plan: result.plan, planningInput: result.planningInput }),
    });
    expect(coordinator.accept().state).toBe("accepted");
    expect(canonicalValueString(coordinator.undo())).toBe(
      canonicalValueString(result.proposal.originalStorefront),
    );
    expect(canonicalValueString(coordinator.redo())).toBe(
      canonicalValueString(result.proposal.proposedStorefront),
    );
    expect(
      canonicalValueString({
        catalogue: input.planningInput.catalogue,
        approvedAssets: input.planningInput.approvedAssetContext,
        navigation: input.planningInput.draft.navigation,
      }),
    ).toBe(before);
  });
});
