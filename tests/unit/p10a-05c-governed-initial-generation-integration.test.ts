import { describe, expect, it } from "vitest";
import { createWholeStorefrontGenerationTarget } from "@/application/whole-storefront-generation-plan";
import { WholeStorefrontProposalAcceptanceCoordinator } from "@/application/whole-storefront-proposal-lifecycle";
import { canonicalValueString } from "@/domain/storefront";
import {
  executeGovernedInitialGeneration,
  type GovernedInitialGenerationRequest,
} from "@/application/design-skills/initial-generation-integration";
import {
  governedSkillPackageRegistry,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills/governed-skill-packages";
import { skillCapabilityKnowledge } from "@/application/design-skills/capability-knowledge";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";

function fixture() {
  return createP905aFreshMerchantFixture("modernTechnical");
}

type TestInitialGenerationRequest = Omit<GovernedInitialGenerationRequest, "planningInput"> & {
  planningInput: ReturnType<typeof fixture>["planningInput"];
};

function authorityFor(
  planningInput: ReturnType<typeof fixture>["planningInput"],
): GovernedSkillAuthorityEnvelope {
  const target = createWholeStorefrontGenerationTarget(planningInput);
  return {
    projectId: planningInput.project.id,
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
}

function request(
  overrides: Partial<TestInitialGenerationRequest> = {},
): TestInitialGenerationRequest {
  const current = fixture();
  const planningInput = structuredClone(current.planningInput);
  const authority = authorityFor(planningInput);
  const profiles = (["home", "collection", "product"] as const).map((pageType) => {
    const profile = skillCapabilityKnowledge.listExecutableProfiles({
      manifest: authority.manifest,
      pageType,
    })[0];
    if (!profile) throw new Error(`Expected a generated ${pageType} PageBlueprint profile.`);
    return { profileId: profile.profileId, fingerprint: profile.fingerprint, pageType };
  });
  const descriptor = governedSkillPackageRegistry.resolve(
    "applyRegisteredWholeStorefrontDirection",
    "initialGeneration",
  ).descriptor;
  return {
    executionKind: "initialGeneration",
    packageId: descriptor.id,
    packageVersion: descriptor.version,
    authority: {
      executionKind: "initialGeneration",
      authority,
      brief: {
        briefId: planningInput.brief.id,
        revision: planningInput.brief.revision,
        fingerprint: planningInput.brief.fingerprint,
      },
      profiles,
      catalogueFingerprint: authority.commerceFingerprint,
      registeredDirectionId: "modernTechnical",
      outputContractId: "wholeStorefrontPlanningInput.v1",
    },
    planningInput,
    ...overrides,
  };
}

function execute(input: unknown, current: GovernedSkillAuthorityEnvelope) {
  return executeGovernedInitialGeneration(input, current);
}

function executeCurrent(input = request()) {
  return execute(input, input.authority.authority);
}

describe("P10A-05C governed initial-generation integration", () => {
  it("authorizes initial generation only for the canonical whole-storefront package", () => {
    const canonical = executeCurrent();
    expect(canonical).toMatchObject({ valid: true });

    const packageRequest = request({ packageId: "applyLuxuryStyle" });
    const alias = executeCurrent(packageRequest);
    expect(alias).toMatchObject({
      valid: false,
      failure: { code: "unsupportedInitialGenerationPackage" },
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

  it("preserves the governed envelope, brief, generated profiles, direction and output contract", () => {
    const input = request();
    const result = executeCurrent(input);
    if (!result.valid) throw new Error(result.failure.message);
    expect(result.authority).toEqual(input.authority);
    expect(result.planningInput).toEqual(input.planningInput);
    expect(result.authority.authority.locale).toBe(input.authority.authority.locale);
    expect(result.plan.designSystemSelection.directionId).toBe("modernTechnical");
    expect(result.proposal.preconditions.briefRevision).toBe(input.authority.brief.revision);
    expect(result.proposal.operations[0]?.operation).toMatchObject({
      type: "APPLY_REGISTERED_BRAND_SYSTEM",
      directionId: "modernTechnical",
    });
  });

  it("fails stale request, manifest, package, draft, commerce, asset and profile authority before planning", () => {
    const base = request();
    const current = base.authority.authority;
    const checks = [
      [
        {
          ...base,
          authority: {
            ...base.authority,
            authority: { ...base.authority.authority, requestIdentity: "stale" },
          },
        },
        "staleRequestIdentityAuthority",
      ],
      [
        {
          ...base,
          authority: {
            ...base.authority,
            authority: {
              ...base.authority.authority,
              manifest: { version: "9.9.9", fingerprint: "stale" },
            },
          },
        },
        "staleManifestAuthority",
      ],
      [{ ...base, packageVersion: "9.9.9" }, "stalePackageAuthority"],
      [
        {
          ...base,
          authority: {
            ...base.authority,
            authority: { ...base.authority.authority, snapshotFingerprint: "stale" },
          },
        },
        "staleDraftAuthority",
      ],
      [
        { ...base, authority: { ...base.authority, catalogueFingerprint: "stale-catalogue" } },
        "stalePlanningAuthority",
      ],
      [
        {
          ...base,
          authority: {
            ...base.authority,
            authority: { ...base.authority.authority, approvedAssetFingerprint: "stale-assets" },
          },
        },
        "staleApprovedAssetAuthority",
      ],
      [
        {
          ...base,
          authority: {
            ...base.authority,
            profiles: [{ ...base.authority.profiles[0]!, fingerprint: "stale-profile" }],
          },
        },
        "staleProfileAuthority",
      ],
    ] as const;
    for (const [input, code] of checks) {
      expect(execute(input, current)).toMatchObject({ valid: false, failure: { code } });
    }
  });

  it("fails a planning-input authority mismatch before the planner can produce a proposal", () => {
    const input = request();
    const changed = structuredClone(input.planningInput) as typeof input.planningInput & {
      draft: { revision: number };
    };
    changed.draft.revision += 1;
    const result = execute({ ...input, planningInput: changed }, input.authority.authority);
    expect(result).toMatchObject({
      valid: false,
      failure: { code: "stalePlanningAuthority" },
    });
  });

  it("reuses the existing planner, compiler and proposal validator deterministically", () => {
    const first = executeCurrent();
    const second = executeCurrent();
    if (!first.valid || !second.valid) throw new Error("Expected governed generation to succeed.");
    expect(first.planningInput).toEqual(second.planningInput);
    expect(first.plan).toEqual(second.plan);
    expect(first.proposal).toEqual(second.proposal);
    expect(first.outputFingerprint).toBe(second.outputFingerprint);
    expect(first.proposal.status).toBe("pending");
  });

  it("keeps the proposal lifecycle, protected commerce and approved assets on existing canonical paths", () => {
    const input = request();
    const before = canonicalValueString({
      catalogue: input.planningInput.catalogue,
      approvedAssets: input.planningInput.approvedAssetContext,
      navigation: input.planningInput.draft.navigation,
    });
    const result = executeCurrent(input);
    if (!result.valid) throw new Error(result.failure.message);
    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal: result.proposal,
      currentInput: () => ({ plan: result.plan, planningInput: result.planningInput }),
    });
    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
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

  it("returns immutable outputs without provider, persistence, editor, save or publish authority", () => {
    const input = request();
    const result = executeCurrent(input);
    if (!result.valid) throw new Error(result.failure.message);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.proposal)).toBe(true);
    expect(Object.keys(result).sort()).toEqual([
      "authority",
      "outputFingerprint",
      "plan",
      "planningInput",
      "proposal",
      "valid",
    ]);
    expect(canonicalValueString(input.planningInput)).toBe(
      canonicalValueString(request().planningInput),
    );
  });
});
