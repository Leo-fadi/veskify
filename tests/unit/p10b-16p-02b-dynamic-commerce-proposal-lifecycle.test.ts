import { describe, expect, it } from "vitest";
import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
} from "@/application/bounded-storefront-synthesis";
import { type DynamicCommerceDesignSelection } from "@/application/dynamic-commerce-routes";
import {
  materializeWholeStorefrontRuntimeSnapshot,
  replayWholeStorefrontProposalOperations,
  validateWholeStorefrontProposal,
  WholeStorefrontProposalAcceptanceCoordinator,
  type WholeStorefrontProposalOperationEnvelope,
} from "@/application/whole-storefront-proposal-lifecycle";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";

function lifecycleFixture() {
  const source = createP10B14PremiumEditorialFixture();
  const draft = {
    ...structuredClone(source.fixture.planningInput.draft),
    dynamicCommercePresentation: structuredClone(source.slice.snapshot.dynamicCommercePresentation),
  };
  const authority = draft.dynamicCommercePresentation;
  if (!authority) throw new Error("Missing current dynamic-commerce authority.");
  const collection = authority.collectionSearchArchetypes.find(
    ({ id }) => id === authority.fallbacks.collectionArchetypeId,
  );
  const search = authority.collectionSearchArchetypes.find(
    ({ id }) => id === authority.searchArchetypeId,
  );
  if (!collection || !search) throw new Error("Missing collection/search archetypes.");
  const products = authority.productDetailArchetypes.filter(
    ({ id }) => id !== authority.fallbacks.productDetailArchetypeId,
  );
  const standard = products[0];
  const alternative = products.find(({ id }) => id !== standard?.id) ?? standard;
  if (!standard || !alternative) throw new Error("Missing product archetype.");
  const dynamicCommerceSelection: DynamicCommerceDesignSelection = {
    authorityFingerprint: authority.authorityFingerprint,
    collectionArchetypeId: collection.id,
    searchArchetypeId: search.id,
    standardSimpleArchetypeId: standard.id,
    configurableArchetypeId: alternative.id,
    galleryLedArchetypeId: standard.id,
    highConsiderationArchetypeId: alternative.id,
    genericFallbackArchetypeId: authority.fallbacks.productDetailArchetypeId,
    productTypeMappings: Object.fromEntries(
      authority.productTypeMappings.map(({ productTypeId, archetypeId }) => [
        productTypeId,
        archetypeId,
      ]),
    ),
  };
  const input = {
    planningInput: { ...source.fixture.planningInput, draft },
    siteMapDecision: source.siteMapDecision,
    approvedEvidenceReferences: source.approvedEvidenceReferences,
    request: { intent: "editorial-led" as const, deterministicSeed: "proposal-lifecycle" },
    dynamicCommerceSelection,
    dynamicCommerceAuthorityFingerprint: authority.authorityFingerprint,
  };
  const decision = createBoundedStorefrontSynthesisDecision(input);
  const result = executeBoundedStorefrontSynthesis({
    ...input,
    decision,
    pageEvidenceAuthority: source.pageEvidenceAuthority,
    contentFactAuthority: source.contentFactAuthority,
    approvedAssetPresentations: source.fixture.assetPresentations,
  });
  return { source, result };
}

describe("P10B-16P-02B dynamic-commerce proposal lifecycle", () => {
  it("carries exact aggregate authority through proposal, accept, undo, redo, and snapshot projection", () => {
    const { source, result } = lifecycleFixture();
    const { plan, planningInput, proposal, snapshot } = result.materialization;
    const currentInput = { plan, planningInput };
    const operation = proposal.operations.find(
      ({ operation }) => operation.type === "APPLY_DYNAMIC_COMMERCE_PRESENTATION",
    );
    if (!operation || operation.operation.type !== "APPLY_DYNAMIC_COMMERCE_PRESENTATION") {
      throw new Error("Missing dynamic-commerce proposal operation.");
    }
    const roleSelection = operation.operation.selection;
    expect(operation.operation).toMatchObject({
      type: "APPLY_DYNAMIC_COMMERCE_PRESENTATION",
      sourceAuthorityFingerprint:
        proposal.originalStorefront.dynamicCommercePresentation?.authorityFingerprint,
    });
    expect(proposal.proposedStorefront.dynamicCommercePresentation).toEqual(
      operation.operation.presentation,
    );
    expect(
      Object.fromEntries(
        snapshot.dynamicCommercePresentation!.productComplexityRules.map(({ id, archetypeId }) => [
          id,
          archetypeId,
        ]),
      ),
    ).toEqual({
      product_rule_considered: roleSelection.highConsiderationArchetypeId,
      product_rule_options: roleSelection.highConsiderationArchetypeId,
      product_rule_configurable: roleSelection.configurableArchetypeId,
      product_rule_gallery: roleSelection.galleryLedArchetypeId,
      product_rule_simple: roleSelection.standardSimpleArchetypeId,
    });
    expect(validateWholeStorefrontProposal(proposal, currentInput)).toEqual(proposal);
    const materializedProposal = materializeWholeStorefrontRuntimeSnapshot({
      runtime: proposal.proposedStorefront,
      planningInput,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });
    expect(materializedProposal.dynamicCommercePresentation).toEqual(
      snapshot.dynamicCommercePresentation,
    );

    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => currentInput,
    });
    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    expect(accepted.activeStorefront.dynamicCommercePresentation).toEqual(
      proposal.proposedStorefront.dynamicCommercePresentation,
    );
    expect(
      materializeWholeStorefrontRuntimeSnapshot({
        runtime: accepted.activeStorefront,
        planningInput,
        approvedAssetPresentations: source.fixture.assetPresentations,
      }).dynamicCommercePresentation,
    ).toEqual(snapshot.dynamicCommercePresentation);
    expect(coordinator.undo()?.dynamicCommercePresentation).toEqual(
      proposal.originalStorefront.dynamicCommercePresentation,
    );
    expect(coordinator.redo()?.dynamicCommercePresentation).toEqual(
      proposal.proposedStorefront.dynamicCommercePresentation,
    );
  });

  it("rejects tampered or stale aggregate authority atomically", () => {
    const { result } = lifecycleFixture();
    const { plan, planningInput, proposal } = result.materialization;
    const applyIndex = proposal.operations.findIndex(
      ({ operation }) => operation.type === "APPLY_DYNAMIC_COMMERCE_PRESENTATION",
    );
    if (applyIndex < 0) throw new Error("Missing dynamic-commerce proposal operation.");
    const sourceOperation = proposal.operations[applyIndex];
    if (!sourceOperation) throw new Error("Missing dynamic-commerce proposal envelope.");
    const tamperedOperation = {
      ...sourceOperation.operation,
      sourceAuthorityFingerprint: "stale-dynamic-commerce-authority",
    } as WholeStorefrontProposalOperationEnvelope["operation"];
    const tampered = proposal.operations.map((envelope, index) =>
      index === applyIndex
        ? {
            ...envelope,
            identity: `whole-storefront-operation-${canonicalValueFingerprint(tamperedOperation)}`,
            operation: tamperedOperation,
          }
        : envelope,
    );
    expect(() =>
      replayWholeStorefrontProposalOperations(proposal.originalStorefront, tampered),
    ).toThrowError(expect.objectContaining({ code: "stale-plan" }));

    if (sourceOperation.operation.type !== "APPLY_DYNAMIC_COMMERCE_PRESENTATION") {
      throw new Error("Missing dynamic-commerce proposal operation.");
    }
    const currentStandardSimpleArchetypeId =
      sourceOperation.operation.selection.standardSimpleArchetypeId;
    const alternativeRole =
      proposal.originalStorefront.dynamicCommercePresentation?.productDetailArchetypes.find(
        ({ id }) =>
          id !==
            proposal.originalStorefront.dynamicCommercePresentation?.fallbacks
              .productDetailArchetypeId && id !== currentStandardSimpleArchetypeId,
      );
    if (!alternativeRole) throw new Error("Expected an alternative current PDP archetype.");
    const tamperedRoleOperation = {
      ...sourceOperation.operation,
      selection: {
        ...sourceOperation.operation.selection,
        standardSimpleArchetypeId: alternativeRole.id,
      },
    };
    const tamperedRoleSelection = proposal.operations.map((envelope, index) =>
      index === applyIndex
        ? {
            ...envelope,
            identity: `whole-storefront-operation-${canonicalValueFingerprint(tamperedRoleOperation)}`,
            operation: tamperedRoleOperation,
          }
        : envelope,
    );
    expect(() =>
      replayWholeStorefrontProposalOperations(proposal.originalStorefront, tamperedRoleSelection),
    ).toThrowError(expect.objectContaining({ code: "stale-plan" }));

    let currentInput = { plan, planningInput };
    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => currentInput,
    });
    const before = canonicalValueString(coordinator.inspect().activeStorefront);
    currentInput = {
      plan,
      planningInput: {
        ...planningInput,
        draft: { ...planningInput.draft, revision: planningInput.draft.revision + 1 },
      },
    };
    const rejected = coordinator.accept();
    expect(rejected.state).toBe("stale");
    expect(canonicalValueString(rejected.activeStorefront)).toBe(before);
    expect(rejected.transaction).toBeNull();
  });
});
