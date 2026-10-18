import { describe, expect, it } from "vitest";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { planRegisteredTokenRefinement } from "@/application/ai-storefront-generation";
import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
} from "@/application/bounded-storefront-synthesis";
import { listCompatibleCoordinatedDirectionSelectionNarrowings } from "@/application/bounded-storefront-synthesis/compatible-direction-selections";
import { registeredBrandSystemForDirection } from "@/application/storefront-design-system";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan/planner";
import { wholeStorefrontGenerationPlanSchema } from "@/application/whole-storefront-generation-plan/contract";
import {
  compileWholeStorefrontProposal,
  validateWholeStorefrontProposal,
} from "@/application/whole-storefront-proposal-lifecycle";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";

const source = createP10B14PremiumEditorialFixture();
const common = {
  planningInput: source.fixture.planningInput,
  siteMapDecision: source.siteMapDecision,
  approvedEvidenceReferences: source.approvedEvidenceReferences,
};

function exactWithRegionalIntent() {
  const [narrowing] = listCompatibleCoordinatedDirectionSelectionNarrowings(common);
  if (!narrowing) throw new Error("Expected one registered exact selection.");
  const { authorityId, authorityVersion, authorityFingerprint, selectionId, ...exact } = narrowing;
  void [authorityId, authorityVersion, authorityFingerprint, selectionId];
  return {
    ...exact,
    expressiveVisualPreferences: {
      version: "2.0.0" as const,
      regionalDensity: {
        navigation: "compact" as const,
        content: "spacious" as const,
        commerce: "balanced" as const,
      },
    },
  };
}

describe("AR-09A regional design intent", () => {
  it("carries a bounded regional overlay through decision, plan, operation, and snapshot", () => {
    const request = { intent: "editorial-led" as const, deterministicSeed: "ar09a" };
    const decision = createBoundedStorefrontSynthesisDecision({
      ...common,
      request,
      exactSelection: exactWithRegionalIntent(),
    });
    const result = executeBoundedStorefrontSynthesis({
      ...common,
      request,
      decision,
      exactSelection: exactWithRegionalIntent(),
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });
    expect(result.decision.designDna.expressiveVisualPreferences?.regionalDensity).toEqual({
      navigation: "compact",
      content: "spacious",
      commerce: "balanced",
    });
    expect(result.materialization.plan.designSystemSelection.expressiveVisualPreferences).toEqual(
      result.decision.designDna.expressiveVisualPreferences,
    );
    expect(result.materialization.proposal.operations[0]?.operation).toMatchObject({
      type: "APPLY_REGISTERED_BRAND_SYSTEM",
      designSystemNarrowing: {
        expressiveVisualPreferences: result.decision.designDna.expressiveVisualPreferences,
      },
    });
    expect(result.materialization.snapshot.brandSystem.designDna?.density).toMatchObject({
      navigation: "compact",
      content: "spacious",
      commerce: "balanced",
    });
  });

  it("rejects null, unknown and stale overlay values", () => {
    const request = { intent: "editorial-led" as const, deterministicSeed: "ar09a-negative" };
    for (const expressiveVisualPreferences of [
      null,
      { ...exactWithRegionalIntent().expressiveVisualPreferences, version: "1.0.0" },
      { ...exactWithRegionalIntent().expressiveVisualPreferences, arbitrary: true },
      {
        version: "2.0.0",
        regionalDensity: {
          navigation: "compact",
          content: "spacious",
          commerce: "balanced",
          global: "compact",
        },
      },
      { version: "2.0.0", regionalDensity: { navigation: "compact", content: "spacious" } },
      {
        version: "2.0.0",
        regionalDensity: { navigation: "unknown", content: "spacious", commerce: "balanced" },
      },
    ]) {
      expect(() =>
        createBoundedStorefrontSynthesisDecision({
          ...common,
          request,
          exactSelection: { ...exactWithRegionalIntent(), expressiveVisualPreferences } as never,
        }),
      ).toThrow();
    }
  });

  it("does not let a valid regional overlay authorize an unsupported exact tuple", () => {
    expect(() =>
      createBoundedStorefrontSynthesisDecision({
        ...common,
        request: { intent: "editorial-led", deterministicSeed: "ar09a-forged-tuple" },
        exactSelection: {
          ...exactWithRegionalIntent(),
          includedOptionalPageFamilyIds: ["unregistered-family"],
        },
      }),
    ).toThrow(/complete current compatible direction tuple/);
  });

  it("rejects an invalid direct registered-BrandSystem overlay instead of treating it as absent", () => {
    expect(() =>
      registeredBrandSystemForDirection(
        source.fixture.planningInput.draft.brandSystem,
        source.fixture.planningInput.recipeContext.designSystem,
        "premiumEditorial",
        {
          spacingDensity: "spacious",
          surfaceDepth: "flat",
          expressiveVisualPreferences: null as never,
        },
      ),
    ).toThrow();
  });

  it("rejects malformed falsy preferences at the direct planner boundary", () => {
    const options = {
      directionId: "premiumEditorial" as const,
      designSystemNarrowing: {
        spacingDensity: "spacious" as const,
        surfaceDepth: "flat" as const,
      },
    };
    const inputBefore = JSON.stringify(source.fixture.planningInput);
    const legacy = createWholeStorefrontGenerationPlan(source.fixture.planningInput, options);
    expect(legacy.designSystemSelection).not.toHaveProperty("expressiveVisualPreferences");
    for (const expressiveVisualPreferences of [null, false, 0, ""]) {
      const malformed = {
        ...options,
        designSystemNarrowing: {
          ...options.designSystemNarrowing,
          expressiveVisualPreferences,
        },
      };
      expect(() =>
        createWholeStorefrontGenerationPlan(source.fixture.planningInput, malformed as never),
      ).toThrow();
    }
    const valid = createWholeStorefrontGenerationPlan(source.fixture.planningInput, {
      ...options,
      designSystemNarrowing: {
        ...options.designSystemNarrowing,
        expressiveVisualPreferences: exactWithRegionalIntent().expressiveVisualPreferences,
      },
    });
    expect(valid.designSystemSelection.expressiveVisualPreferences).toEqual(
      exactWithRegionalIntent().expressiveVisualPreferences,
    );
    expect(JSON.stringify(source.fixture.planningInput)).toBe(inputBefore);
  });

  it("rejects regional preferences in token-only plans without losing valid legacy refinement", () => {
    const planningInput = source.fixture.planningInput;
    const before = JSON.stringify(planningInput);
    const tokenRefinementPlan = planRegisteredTokenRefinement(
      "Use primary forest green, secondary sage, background warm off-white, and Georgia headings with Inter body text. Preserve layouts, sections, products, and images.",
      planningInput.draft.brandSystem,
    );
    if (tokenRefinementPlan === null) throw new Error("Expected a real registered refinement.");
    const legacy = createWholeStorefrontGenerationPlan(planningInput, { tokenRefinementPlan });
    expect(legacy.requestClass).toBe("tokenOnlyRefinement");
    expect(legacy.designSystemSelection).not.toHaveProperty("expressiveVisualPreferences");
    const proposal = compileWholeStorefrontProposal({ plan: legacy, planningInput });
    expect(validateWholeStorefrontProposal(proposal, { plan: legacy, planningInput })).toEqual(
      proposal,
    );
    expect(proposal.operations[0]?.operation).toMatchObject({
      type: "APPLY_REGISTERED_BRAND_SYSTEM",
      refinementId: "validatedTokenRefinement",
      tokenRefinementPlan,
    });
    const expressiveVisualPreferences = exactWithRegionalIntent().expressiveVisualPreferences;
    expect(() =>
      createWholeStorefrontGenerationPlan(planningInput, {
        tokenRefinementPlan,
        designSystemNarrowing: {
          spacingDensity: "spacious",
          surfaceDepth: "flat",
          expressiveVisualPreferences,
        },
      }),
    ).toThrow(/Token-only/);
    const forged = structuredClone(legacy);
    forged.designSystemSelection.expressiveVisualPreferences = expressiveVisualPreferences;
    const { fingerprint: oldFingerprint, ...material } = forged;
    void oldFingerprint;
    forged.fingerprint = `whole-storefront-plan-${canonicalValueFingerprint(material)}`;
    expect(() => wholeStorefrontGenerationPlanSchema.parse(forged)).toThrow(/Token-only/);
    expect(() => compileWholeStorefrontProposal({ plan: forged, planningInput })).toThrow();
    expect(JSON.stringify(planningInput)).toBe(before);
  });

  it("rejects preference tampering at decision, plan, operation and final proposal stages", () => {
    const request = { intent: "editorial-led" as const, deterministicSeed: "ar09a-tamper" };
    const exactSelection = exactWithRegionalIntent();
    const decision = createBoundedStorefrontSynthesisDecision({
      ...common,
      request,
      exactSelection,
    });
    const execution = {
      ...common,
      request,
      exactSelection,
      decision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    };
    const before = JSON.stringify(execution);
    const result = executeBoundedStorefrontSynthesis(execution);
    const current = {
      plan: result.materialization.plan,
      planningInput: result.materialization.planningInput,
    };
    expect(validateWholeStorefrontProposal(result.materialization.proposal, current)).toEqual(
      result.materialization.proposal,
    );
    expect(compileWholeStorefrontProposal(current)).toEqual(result.materialization.proposal);
    const changedDecision = structuredClone(decision);
    changedDecision.designDna.expressiveVisualPreferences!.regionalDensity.content = "compact";
    const { synthesisFingerprint: _oldDecisionFingerprint, ...decisionMaterial } = changedDecision;
    void _oldDecisionFingerprint;
    changedDecision.synthesisFingerprint = `bounded-storefront-synthesis-${canonicalValueFingerprint(decisionMaterial)}`;
    expect(() =>
      executeBoundedStorefrontSynthesis({ ...execution, decision: changedDecision }),
    ).toThrow(/does not match current canonical authority/);

    const changedPlan = structuredClone(result.materialization.plan);
    changedPlan.designSystemSelection.expressiveVisualPreferences!.regionalDensity.commerce =
      "spacious";
    expect(() =>
      compileWholeStorefrontProposal({
        plan: changedPlan,
        planningInput: result.materialization.planningInput,
      }),
    ).toThrow();

    const { fingerprint: _oldPlanFingerprint, ...planMaterial } = changedPlan;
    void _oldPlanFingerprint;
    changedPlan.fingerprint = `whole-storefront-plan-${canonicalValueFingerprint(planMaterial)}`;
    expect(() =>
      validateWholeStorefrontProposal(result.materialization.proposal, {
        ...current,
        plan: changedPlan,
      }),
    ).toThrow(/different plan|stale/);

    const rebindProposalId = (proposal: typeof result.materialization.proposal) => {
      const { id: _oldId, ...material } = proposal;
      void _oldId;
      proposal.id = `whole_storefront_proposal_${canonicalValueFingerprint(material).slice(-8)}`;
    };
    const changedOperation = structuredClone(result.materialization.proposal);
    const operation = changedOperation.operations.find(
      ({ operation }) => operation.type === "APPLY_REGISTERED_BRAND_SYSTEM",
    )?.operation;
    if (!operation || operation.type !== "APPLY_REGISTERED_BRAND_SYSTEM")
      throw new Error("Expected the registered BrandSystem operation.");
    operation.designSystemNarrowing!.expressiveVisualPreferences!.regionalDensity.navigation =
      "spacious";
    rebindProposalId(changedOperation);
    expect(() =>
      validateWholeStorefrontProposal(changedOperation, {
        plan: result.materialization.plan,
        planningInput: result.materialization.planningInput,
      }),
    ).toThrow();

    const changedCandidate = structuredClone(result.materialization.proposal);
    changedCandidate.proposedStorefront.brandSystem.designDna!.density.commerce = "spacious";
    rebindProposalId(changedCandidate);
    expect(() =>
      validateWholeStorefrontProposal(changedCandidate, {
        plan: result.materialization.plan,
        planningInput: result.materialization.planningInput,
      }),
    ).toThrow(/complete validated plan/);
    expect(JSON.stringify(execution)).toBe(before);
  });
});
