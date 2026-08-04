import { describe, expect, it } from "vitest";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import {
  WholeStorefrontProposalAcceptanceCoordinator,
  compileWholeStorefrontProposal,
  coordinatedPageAuthorityFingerprint,
  coordinatedFollowUpPlanFingerprint,
  coordinatedProtectedStateFingerprint,
  createWholeStorefrontRuntimeState,
  validateWholeStorefrontProposal,
  type CoordinatedFollowUpPlan,
  WholeStorefrontProposalError,
} from "@/application/whole-storefront-proposal-lifecycle";
import { canonicalValueString } from "@/domain/storefront";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";

function fixture() {
  const source = createP905aFreshMerchantFixture("modernTechnical");
  const planningInput = structuredClone(source.planningInput);
  const baselineGenerationPlan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId: "modernTechnical",
  });
  const original = createWholeStorefrontRuntimeState({
    plan: baselineGenerationPlan,
    planningInput,
  });
  return { planningInput, baselineGenerationPlan, original };
}

function followUpPlan(pageTypes: readonly ("home" | "collection" | "product")[]) {
  const source = fixture();
  const pageChanges = pageTypes.map((pageType) => {
    const materialization = source.baselineGenerationPlan.pageBlueprintMaterializations.find(
      (entry) => entry.pageType === pageType,
    );
    const originalPage = source.original.pages.find((page) => page.type === pageType);
    if (!materialization || !originalPage) throw new Error(`Expected ${pageType} plan authority.`);
    const slot = materialization.slots[0];
    const first = originalPage.components[0];
    if (!slot || !first) throw new Error(`Expected ${pageType} authority.`);
    return {
      pageId: originalPage.pageId,
      pageType,
      profileId: materialization.profileId,
      profileFingerprint: materialization.fingerprint,
      pageAuthorityFingerprint: coordinatedPageAuthorityFingerprint(originalPage),
      slotIds: [slot.slotId],
      operations: [
        {
          type: "APPLY_PAGE_COMPONENTS" as const,
          page: {
            ...originalPage,
            components: originalPage.components.map((component) =>
              component.id === first.id ? { ...component, visible: !component.visible } : component,
            ),
          },
          removedComponentIds: [],
        },
      ],
    };
  });
  const withoutFingerprint = {
    kind: "governedFollowUp" as const,
    version: 1 as const,
    id: "plan_governed_follow_up",
    target: source.baselineGenerationPlan.target,
    requestIdentity: "p10a-05d-01-request",
    locale: "en" as const,
    manifest: { version: "1.0.0", fingerprint: "manifest-governed-follow-up" },
    packageRegistry: { version: "2.0.0", fingerprint: "registry-governed-follow-up" },
    componentRegistryFingerprint: source.baselineGenerationPlan.componentRegistryFingerprint,
    commerceFingerprint: source.baselineGenerationPlan.target.canonicalCommerceFingerprint,
    approvedAssetFingerprint: source.planningInput.approvedAssetContext?.fingerprint ?? null,
    protectedStateFingerprint: coordinatedProtectedStateFingerprint(source.original),
    baselineGenerationPlan: source.baselineGenerationPlan,
    sharedOperations: [],
    pageChanges,
    explanation: "Review the explicit coordinated follow-up changes before applying them.",
  };
  const plan: CoordinatedFollowUpPlan = {
    ...withoutFingerprint,
    fingerprint: coordinatedFollowUpPlanFingerprint(withoutFingerprint),
  };
  return { ...source, plan };
}

function withFingerprint(plan: CoordinatedFollowUpPlan): CoordinatedFollowUpPlan {
  const { fingerprint: _fingerprint, ...withoutFingerprint } = plan;
  void _fingerprint;
  return {
    ...withoutFingerprint,
    fingerprint: coordinatedFollowUpPlanFingerprint(withoutFingerprint),
  };
}

function errorCode(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    if (error instanceof WholeStorefrontProposalError) return error.code;
    throw error;
  }
  throw new Error("Expected a whole-storefront proposal error.");
}

describe("P10A-05D-01 coordinated proposal authority", () => {
  it("preserves initial-generation compilation and proposal identity", () => {
    const source = fixture();
    const first = compileWholeStorefrontProposal({
      plan: source.baselineGenerationPlan,
      planningInput: source.planningInput,
    });
    const second = compileWholeStorefrontProposal({
      plan: source.baselineGenerationPlan,
      planningInput: source.planningInput,
    });
    expect(second).toEqual(first);
    expect(
      compileWholeStorefrontProposal({
        plan: { kind: "initialGeneration", plan: source.baselineGenerationPlan },
        planningInput: source.planningInput,
      }),
    ).toEqual(first);
  });

  it("compiles one or many explicit page changes through the existing aggregate compiler", () => {
    const one = followUpPlan(["home"]);
    const many = followUpPlan(["home", "collection", "product"]);
    const oneProposal = compileWholeStorefrontProposal({
      plan: one.plan,
      planningInput: one.planningInput,
    });
    const manyProposal = compileWholeStorefrontProposal({
      plan: many.plan,
      planningInput: many.planningInput,
    });
    expect(oneProposal.planId).toBe(one.plan.id);
    expect(
      manyProposal.reviewSummary.pages.filter((page) => page.status === "changed"),
    ).toHaveLength(3);
    expect(
      validateWholeStorefrontProposal(manyProposal, {
        plan: many.plan,
        planningInput: many.planningInput,
      }),
    ).toEqual(manyProposal);
  });

  it("rejects duplicate, undeclared, and stale page/profile authority", () => {
    const source = followUpPlan(["home"]);
    const duplicate = withFingerprint({
      ...source.plan,
      pageChanges: [...source.plan.pageChanges, source.plan.pageChanges[0]],
    });
    expect(
      errorCode(() =>
        compileWholeStorefrontProposal({ plan: duplicate, planningInput: source.planningInput }),
      ),
    ).toBe("duplicate-page-authority");
    const undeclared = withFingerprint({
      ...source.plan,
      pageChanges: source.plan.pageChanges.map((change) => ({ ...change, pageId: "page_unknown" })),
    });
    expect(
      errorCode(() =>
        compileWholeStorefrontProposal({ plan: undeclared, planningInput: source.planningInput }),
      ),
    ).toBe("undeclared-page-operation");
    const staleProfile = withFingerprint({
      ...source.plan,
      pageChanges: source.plan.pageChanges.map((change) => ({
        ...change,
        profileFingerprint: "stale",
      })),
    });
    expect(
      errorCode(() =>
        compileWholeStorefrontProposal({ plan: staleProfile, planningInput: source.planningInput }),
      ),
    ).toBe("stale-page-authority");
    expect(
      errorCode(() =>
        compileWholeStorefrontProposal({
          plan: { kind: "unsupportedKind" },
          planningInput: source.planningInput,
        }),
      ),
    ).toBe("unsupported-coordinated-plan-kind");
  });

  it("rejects cross-page components, unknown slots, conflicting page operations, and protected identities", () => {
    const source = followUpPlan(["home", "collection"]);
    const [home, collection] = source.plan.pageChanges;
    if (!home || !collection) throw new Error("Expected two page changes.");
    const crossPage = withFingerprint({
      ...source.plan,
      pageChanges: [{ ...home, operations: collection.operations }, collection],
    });
    expect(
      errorCode(() =>
        compileWholeStorefrontProposal({ plan: crossPage, planningInput: source.planningInput }),
      ),
    ).toBe("undeclared-page-operation");
    const unknownSlot = withFingerprint({
      ...source.plan,
      pageChanges: [{ ...home, slotIds: ["unknown-slot"] }, collection],
    });
    expect(
      errorCode(() =>
        compileWholeStorefrontProposal({ plan: unknownSlot, planningInput: source.planningInput }),
      ),
    ).toBe("stale-page-authority");
    const conflicting = withFingerprint({
      ...source.plan,
      pageChanges: [{ ...home, operations: [...home.operations, ...home.operations] }, collection],
    });
    expect(
      errorCode(() =>
        compileWholeStorefrontProposal({ plan: conflicting, planningInput: source.planningInput }),
      ),
    ).toBe("conflicting-coordinated-operation");
    const first = collection.operations[0];
    if (!first || first.type !== "APPLY_PAGE_COMPONENTS") {
      throw new Error("Expected the collection page operation.");
    }
    const protectedBindingMutation = withFingerprint({
      ...source.plan,
      pageChanges: [
        {
          ...collection,
          operations: [
            {
              ...first,
              page: {
                ...first.page,
                components: first.page.components.map((component, index) =>
                  index === 0 ? { ...component, component: "footer" } : component,
                ),
              },
            },
          ],
        },
        home,
      ],
    });
    expect(
      errorCode(() =>
        compileWholeStorefrontProposal({
          plan: protectedBindingMutation,
          planningInput: source.planningInput,
        }),
      ),
    ).toBe("protected-commerce-mutation");
  });

  it("keeps atomic acceptance, rejection, close, undo, redo, and protected state", () => {
    const source = followUpPlan(["home", "collection"]);
    const proposal = compileWholeStorefrontProposal({
      plan: source.plan,
      planningInput: source.planningInput,
    });
    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => ({ plan: source.plan, planningInput: source.planningInput }),
    });
    const protectedBefore = canonicalValueString({
      catalogue: source.planningInput.catalogue,
      navigation: source.planningInput.draft.navigation,
      approvedAssets: source.planningInput.approvedAssetContext,
    });
    expect(coordinator.reject().state).toBe("rejected");
    expect(canonicalValueString(coordinator.close().activeStorefront)).toBe(
      canonicalValueString(proposal.originalStorefront),
    );
    const accepted = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => ({ plan: source.plan, planningInput: source.planningInput }),
    });
    expect(accepted.accept().state).toBe("accepted");
    expect(canonicalValueString(accepted.undo())).toBe(
      canonicalValueString(proposal.originalStorefront),
    );
    expect(canonicalValueString(accepted.redo())).toBe(
      canonicalValueString(proposal.proposedStorefront),
    );
    expect(
      canonicalValueString({
        catalogue: source.planningInput.catalogue,
        navigation: source.planningInput.draft.navigation,
        approvedAssets: source.planningInput.approvedAssetContext,
      }),
    ).toBe(protectedBefore);

    let staleCurrent = { plan: source.plan, planningInput: source.planningInput };
    const stale = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => staleCurrent,
    });
    staleCurrent = {
      ...staleCurrent,
      planningInput: {
        ...staleCurrent.planningInput,
        draft: {
          ...staleCurrent.planningInput.draft,
          revision: staleCurrent.planningInput.draft.revision + 1,
        },
      },
    };
    const failed = stale.accept();
    expect(failed.state).toBe("stale");
    expect(failed.failure?.code).toBe("stale-draft");
    expect(failed.activeStorefront).toEqual(proposal.originalStorefront);
  });
});
