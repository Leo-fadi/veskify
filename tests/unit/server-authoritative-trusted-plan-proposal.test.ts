import { describe, expect, it } from "vitest";

import type { AiStorefrontProviderRequest } from "@/application/ai-storefront-generation";
import {
  executeAiStorefrontProposal,
  projectAiStorefrontSnapshot,
  validateAiStorefrontProposal,
} from "@/application/ai-storefront";
import { executeCoordinatedDirection } from "@/application/bounded-storefront-synthesis";
import { designOperationSchema } from "@/application/design-operations";
import type { WholeStorefrontPlanningInput } from "@/application/whole-storefront-generation-plan";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { createRawKarvonenStorefrontFixture } from "@/data/demo/raw-karvonen-storefront-fixture";
import { canonicalStorefrontContentFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  createServerAuthoritativeTrustedPlanProposalTransport,
  createServerAuthoritativeTrustedPlanProposalResponse,
  ServerWholeStorefrontAuthorityError,
} from "@/integrations/ai/whole-storefront-runtime-authority";

const source = createP10B14PremiumEditorialFixture();
const instruction = "Create a modern technical storefront for Lumo Atelier.";

function studioTransport(planningInput: WholeStorefrontPlanningInput): AiStorefrontProviderRequest {
  return createServerAuthoritativeTrustedPlanProposalTransport({
    planningInput,
    plan: source.slice.plan,
    merchantInstruction: instruction,
    activeLocale: planningInput.project.enabledLocales[0],
    requestSequence: 1,
    correlationRequestId: "p10b16l_trusted_plan_projection",
    providerId: "trusted-plan-test-provider",
  });
}

function project(input?: {
  request?: AiStorefrontProviderRequest;
  planningInput?: WholeStorefrontPlanningInput;
  expectedSnapshot?: typeof source.slice.snapshot;
}) {
  const planningInput = input?.planningInput ?? source.slice.planningInput;
  return createServerAuthoritativeTrustedPlanProposalResponse({
    request: input?.request ?? studioTransport(planningInput),
    plan: source.slice.plan,
    planningInput,
    approvedAssetPresentations: source.fixture.assetPresentations,
    expectedSnapshot: input?.expectedSnapshot ?? source.slice.snapshot,
  });
}

function thrownCode(action: () => unknown): unknown {
  try {
    action();
    return null;
  } catch (error) {
    return error && typeof error === "object" && "code" in error ? error.code : null;
  }
}

describe("server-authoritative trusted whole-storefront plan proposal projection", () => {
  it("projects the trusted plan exactly without consulting the legacy request direction", () => {
    const response = project();

    // The transport text names modern technical while the trusted bounded plan is
    // Premium Editorial. The historical direction classifier would reject this;
    // this boundary correctly treats only the already-validated plan as authority.
    expect(source.slice.plan.designSystemSelection.directionId).toBe("premiumEditorial");
    expect(response.proposal.operations).not.toHaveLength(0);
    expect(response.metadata.authoritativePlanningFingerprint).toBe(source.slice.plan.fingerprint);
    expect(canonicalValueString(response.proposal.originalStorefront)).toBe(
      canonicalValueString(projectAiStorefrontSnapshot(source.slice.planningInput.draft)),
    );
    expect(response.proposal.dynamicCommerceMigration).toMatchObject({
      kind: "canonicalDynamicCommerceMigration",
      resultingAuthorityFingerprint:
        source.slice.snapshot.dynamicCommercePresentation!.authorityFingerprint,
    });
    expect(response.proposal.proposedStorefront.dynamicCommercePresentation).toEqual(
      source.slice.snapshot.dynamicCommercePresentation,
    );
    expect(response.proposal.proposedStorefront.pageOrder).toEqual(
      source.slice.snapshot.pages.map(({ id }) => id),
    );
    expect(new Set(response.proposal.proposedStorefront.pageOrder)).toEqual(
      new Set(source.slice.snapshot.pages.map(({ id }) => id)),
    );
  });

  it("fails closed for stale Studio transport and stale plan authority", () => {
    const staleRequest = {
      ...studioTransport(source.slice.planningInput),
      targetFingerprint: "storefront-target-stale",
    };
    expect(thrownCode(() => project({ request: staleRequest }))).toBe("stale");

    const stalePlanningInput = structuredClone(source.slice.planningInput);
    stalePlanningInput.project.revision += 1;
    expect(
      thrownCode(() =>
        project({
          request: studioTransport(stalePlanningInput),
          planningInput: stalePlanningInput,
        }),
      ),
    ).toBe("stale-plan");
  });

  it("rejects any projected storefront that differs from the trusted expected snapshot", () => {
    const differentSnapshot = structuredClone(source.slice.snapshot);
    differentSnapshot.pages[0].title.en = "Unexpected presentation";

    expect(thrownCode(() => project({ expectedSnapshot: differentSnapshot }))).toBe(
      "malformed-state",
    );
    expect(() => project({ expectedSnapshot: differentSnapshot })).toThrow(
      ServerWholeStorefrontAuthorityError,
    );
  });

  it("binds a bounded synthesized BrandSystem to its exact registered narrowing and current plan", () => {
    const fixture = createRawKarvonenStorefrontFixture();
    const result = executeCoordinatedDirection({
      planningInput: fixture.executionPlanningInput,
      siteMapDecision: fixture.siteMapDecision,
      approvedEvidenceReferences: fixture.approvedEvidenceReferences,
      pageEvidenceAuthority: fixture.pageEvidenceAuthority,
      contentFactAuthority: fixture.contentFactAuthority,
      approvedAssetPresentations: fixture.approvedAssetPresentations,
      directionRequest: {
        directionId: "premium-editorial",
        deterministicSeed: "registered-narrowing-regression",
      },
    });
    const materialization = result.synthesis.materialization;
    const request = createServerAuthoritativeTrustedPlanProposalTransport({
      planningInput: materialization.planningInput,
      plan: materialization.plan,
      merchantInstruction: "Create the trusted complete Premium Editorial storefront.",
      activeLocale: materialization.planningInput.project.enabledLocales[0],
      requestSequence: 1,
      correlationRequestId: "registered_narrowing_regression",
      providerId: "trusted-plan-test-provider",
    });
    const response = createServerAuthoritativeTrustedPlanProposalResponse({
      request,
      plan: materialization.plan,
      planningInput: materialization.planningInput,
      approvedAssetPresentations: fixture.approvedAssetPresentations,
      expectedSnapshot: materialization.snapshot,
    });
    const brandOperation = response.proposal.operations.find(
      ({ operation }) => operation.type === "APPLY_REGISTERED_BRAND_SYSTEM",
    )?.operation;
    if (!brandOperation || brandOperation.type !== "APPLY_REGISTERED_BRAND_SYSTEM") {
      throw new Error("Expected one registered BrandSystem operation.");
    }
    expect(brandOperation.designSystemNarrowing).toEqual({
      spacingDensity: materialization.plan.designSystemSelection.spacingDensity,
      surfaceDepth: materialization.plan.designSystemSelection.surfaceDepth,
    });
    expect(response.metadata.authoritativePlanningFingerprint).toBe(
      materialization.plan.fingerprint,
    );
    expect(response.proposal.proposedStorefront.pages).toHaveLength(
      materialization.snapshot.pages.length,
    );
    expect(response.proposal.proposedStorefront.dynamicCommercePresentation).toEqual(
      materialization.snapshot.dynamicCommercePresentation,
    );
    const applied = executeAiStorefrontProposal({
      proposal: response.proposal,
      activeDraft: materialization.planningInput.draft,
      catalogue: fixture.planningInput.catalogue,
      enabledLocales: fixture.aggregate.project.enabledLocales,
      activeLocale: request.activeLocale,
      primaryLocale: request.activeLocale,
    });
    expect(canonicalStorefrontContentFingerprint(applied)).toBe(
      canonicalStorefrontContentFingerprint(materialization.snapshot),
    );

    const tampered = structuredClone(response.proposal);
    const tamperedBrand = tampered.operations.find(
      ({ operation }) => operation.type === "APPLY_REGISTERED_BRAND_SYSTEM",
    )?.operation;
    if (!tamperedBrand || tamperedBrand.type !== "APPLY_REGISTERED_BRAND_SYSTEM") {
      throw new Error("Expected one registered BrandSystem operation.");
    }
    tamperedBrand.designSystemNarrowing = {
      ...tamperedBrand.designSystemNarrowing!,
      surfaceDepth: "flat",
    };
    expect(
      thrownCode(() =>
        validateAiStorefrontProposal(tampered, {
          projectId: request.target.projectId,
          draftSnapshotId: request.target.draftSnapshotId,
          draftRevision: request.target.draftRevision,
          enabledLocales: request.enabledLocales,
          activeLocale: request.activeLocale,
          storefront: request.storefront,
        }),
      ),
    ).toBe("invalid-global-operation");

    expect(
      designOperationSchema.safeParse({
        ...brandOperation,
        designSystemNarrowing: {
          spacingDensity: "unbounded",
          surfaceDepth: "subtle",
        },
      }).success,
    ).toBe(false);

    const stalePlan = structuredClone(materialization.plan);
    stalePlan.fingerprint = "whole-storefront-plan-tampered";
    expect(
      thrownCode(() =>
        createServerAuthoritativeTrustedPlanProposalResponse({
          request,
          plan: stalePlan,
          planningInput: materialization.planningInput,
          approvedAssetPresentations: fixture.approvedAssetPresentations,
          expectedSnapshot: materialization.snapshot,
        }),
      ),
    ).toBe("stale-plan");
  });
});
