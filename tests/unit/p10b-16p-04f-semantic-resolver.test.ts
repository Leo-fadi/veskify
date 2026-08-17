// @vitest-environment node

import { describe, expect, it } from "vitest";
import { isCurrentCompatibleCoordinatedDirectionExactSelection } from "@/application/bounded-storefront-synthesis";
import {
  deriveSemanticCapabilityIndex,
  prepareSemanticStorefrontDesignCompilationAuthority,
  resolveSemanticStorefrontCompatibility,
} from "@/application/prompted-storefront-design-compiler";
import {
  createPromptedStorefrontDesignRequestV2,
  createSemanticStorefrontDesignRequestV1,
  semanticStorefrontCurrentAuthorityFingerprint,
  type CreateSemanticStorefrontDesignRequestV1Options,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent";
import { createP10B16P03RawKarvonenStudioFixture } from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import { canonicalValueString } from "@/domain/storefront";
import { semanticIntentFixture } from "../fixtures/p10b-16p-04-semantic-intent";

const prompt = "Create a refined premium editorial storefront.";

function authority() {
  const fixture = createP10B16P03RawKarvonenStudioFixture();
  const currentRequestInput = {
    merchantPrompt: prompt,
    project: fixture.aggregate.project,
    draft: fixture.planningInput.draft,
    catalogue: fixture.planningInput.catalogue,
    approvedBrief: fixture.brief,
    approvedAssetContext: fixture.planningInput.approvedAssetContext,
  };
  const exact = createPromptedStorefrontDesignRequestV2(currentRequestInput);
  const compatibilityInput = {
    planningInput: fixture.planningInput,
    siteMapDecision: fixture.siteMapDecision,
    approvedEvidenceReferences: fixture.approvedEvidenceReferences,
  };
  const currentAuthorityFingerprint = semanticStorefrontCurrentAuthorityFingerprint(
    exact.request.currentAuthority,
  );
  const semanticIndex = deriveSemanticCapabilityIndex({
    authority: compatibilityInput,
    currentAuthorityFingerprint,
  });
  const createRequest = (
    options: Omit<
      CreateSemanticStorefrontDesignRequestV1Options,
      "semanticAuthorityFingerprint" | "semanticInfluenceAuthority"
    > = {},
  ) =>
    createSemanticStorefrontDesignRequestV1(exact, {
      semanticAuthorityFingerprint: semanticIndex.semanticAuthorityFingerprint,
      semanticInfluenceAuthority: semanticIndex.semanticInfluenceAuthority,
      ...options,
    });
  return {
    fixture,
    currentRequestInput,
    compatibilityInput,
    currentAuthorityFingerprint,
    semanticIndex,
    createRequest,
    request: createRequest(),
  };
}

function resolve(
  fixture: ReturnType<typeof authority>,
  request: SemanticStorefrontDesignRequestV1,
  overrides: Parameters<typeof semanticIntentFixture>[1] = {},
) {
  return resolveSemanticStorefrontCompatibility({
    request,
    intent: semanticIntentFixture(request, overrides),
    compatibilityInput: fixture.compatibilityInput,
    semanticCapabilityIndex: fixture.semanticIndex,
    trustedCurrentAuthorityFingerprint: fixture.currentAuthorityFingerprint,
  });
}

describe("P10B-16P-04F semantic compatibility resolver", () => {
  it("proves every advertised backbone resolves through current executable authority", () => {
    const fixture = authority();
    const prepared = prepareSemanticStorefrontDesignCompilationAuthority({
      originalRequest: fixture.request,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      semanticCapabilityIndex: fixture.semanticIndex,
    });

    expect(fixture.semanticIndex.candidates).toHaveLength(135);
    for (const candidate of fixture.semanticIndex.candidates) {
      expect(() => prepared.resolveExecutionAuthority(candidate.selection)).not.toThrow();
    }
  }, 180_000);

  it("rejects a syntactically valid selection outside the prepared current tuple inventory", () => {
    const fixture = authority();
    const prepared = prepareSemanticStorefrontDesignCompilationAuthority({
      originalRequest: fixture.request,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      semanticCapabilityIndex: fixture.semanticIndex,
    });
    const [registered] = fixture.semanticIndex.candidates;
    if (!registered) throw new Error("Missing prepared semantic candidate authority.");
    const selection = {
      ...registered.selection,
      includedOptionalPageFamilyIds: ["unregistered-content-family"],
    };
    const { authorityId, authorityVersion, authorityFingerprint, selectionId, ...exact } =
      selection;
    void [authorityId, authorityVersion, authorityFingerprint, selectionId];

    expect(
      isCurrentCompatibleCoordinatedDirectionExactSelection({
        authority: fixture.compatibilityInput,
        exactSelection: exact,
      }),
    ).toBe(false);
    expect(() => prepared.resolveExecutionAuthority(selection)).toThrowError(
      expect.objectContaining({
        code: "stale-authority",
        message: "The semantic selection is not part of the prepared current authority.",
      }),
    );
  });

  it("derives stable metadata-only authority and selects distinct exact structures", () => {
    const fixture = authority();
    const before = canonicalValueString(fixture.fixture.planningInput.draft);
    const premium = resolve(fixture, fixture.request, {
      commercialPosture: "premium-editorial",
      navigationPosture: "editorial",
      storyCatalogueBalance: "story-first",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "story-led",
      imageProminence: "image-led",
    });
    const technical = resolve(fixture, fixture.request, {
      commercialPosture: "modern-technical",
      density: "high",
      navigationPosture: "compact",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "catalogue-comparison",
      configurableProductPosture: "technical",
      mobileHierarchy: "conversion-led",
    });

    expect(fixture.semanticIndex.candidateCount).toBeGreaterThan(0);
    expect(premium.selection).toMatchObject({
      authorityId: "coordinated-direction:premium-editorial",
      designSystemSpacingDensity: "standard",
      informationDensityPosture: "balanced",
      sharedFrameProfileId: "editorial-masthead",
      merchandisingPosture: "curated",
    });
    expect(technical.selection).toMatchObject({
      authorityId: "coordinated-direction:modern-technical",
      designSystemSpacingDensity: "compact",
      informationDensityPosture: "compact",
      sharedFrameProfileId: "compact-technical",
    });
    expect(technical.selectedStructuralFingerprint).not.toBe(premium.selectedStructuralFingerprint);
    expect(premium.semanticResolutionFingerprint).toBe(premium.diagnostic.diagnosticFingerprint);
    expect(premium.diagnostic.stages.at(-1)).toMatchObject({
      stage: "semantic-ranking",
      remainingCandidateCount: 1,
    });
    expect(JSON.stringify(premium.diagnostic)).not.toMatch(
      /merchantPrompt|designConceptSummary|productId|collectionId|price|stock/u,
    );
    expect(canonicalValueString(fixture.fixture.planningInput.draft)).toBe(before);
  });

  it("enforces trusted hints and explicit hard/avoid constraints before scoring", () => {
    const fixture = authority();
    const request = fixture.createRequest({
      trustedExactHints: {
        directionPackageId: "minimal-commerce",
        frameFamilyId: "centered-minimal",
      },
      explicitConstraintAuthority: [
        {
          clauseReference: "merchant-minimal",
          field: "commercial-posture",
          value: "minimal-commerce",
          semantics: "hard",
        },
        {
          clauseReference: "merchant-not-premium",
          field: "commercial-posture",
          value: "premium-editorial",
          semantics: "avoid",
        },
      ],
    });
    const result = resolve(fixture, request, { commercialPosture: "premium-editorial" });

    expect(result.selection).toMatchObject({
      authorityId: "coordinated-direction:minimal-commerce",
      sharedFrameProfileId: "centered-minimal",
    });
    expect(result.diagnostic.stages.map(({ stage }) => stage)).toEqual([
      "current-compatible-authority",
      "trusted-exact-hints",
      "explicit-hard-constraints",
      "explicit-avoidances",
      "required-evidence-and-assets",
      "semantic-ranking",
    ]);
  });

  it("fails every impossible server authority with one narrow reason", () => {
    const fixture = authority();
    const constraint = (
      field: "commercial-posture" | "required-evidence" | "required-asset-role",
      value: string,
      semantics: "hard" | "avoid" = "hard",
    ) => ({ clauseReference: `${field}-${semantics}`, field, value, semantics });
    const cases = [
      {
        code: "contradictory-explicit-constraints",
        request: fixture.createRequest({
          explicitConstraintAuthority: [
            constraint("commercial-posture", "premium-editorial"),
            constraint("commercial-posture", "minimal-commerce"),
          ],
        }),
      },
      {
        code: "hard-avoid-conflict",
        request: fixture.createRequest({
          explicitConstraintAuthority: [
            constraint("commercial-posture", "premium-editorial"),
            constraint("commercial-posture", "premium-editorial", "avoid"),
          ],
        }),
      },
      {
        code: "missing-required-evidence",
        request: fixture.createRequest({
          explicitConstraintAuthority: [constraint("required-evidence", "generic-content")],
        }),
      },
      {
        code: "missing-required-asset",
        request: fixture.createRequest({
          explicitConstraintAuthority: [
            constraint("required-asset-role", "intentionally-unavailable-role"),
          ],
        }),
      },
      {
        code: "invalid-trusted-hint",
        request: fixture.createRequest({
          trustedExactHints: {
            directionPackageId: "premium-editorial",
            frameFamilyId: "compact-technical",
          },
        }),
      },
      {
        code: "unsupported-explicit-constraint",
        request: fixture.createRequest({
          explicitConstraintAuthority: [constraint("commercial-posture", "unsupported-posture")],
        }),
      },
      {
        code: "stale-semantic-authority",
        request: { ...fixture.request, semanticAuthorityFingerprint: "stale" },
      },
    ] as const;

    for (const failure of cases) {
      expect(() => resolve(fixture, failure.request)).toThrowError(
        expect.objectContaining({ code: failure.code }),
      );
    }
    expect(() =>
      resolveSemanticStorefrontCompatibility({
        request: fixture.request,
        intent: semanticIntentFixture(fixture.request),
        compatibilityInput: fixture.compatibilityInput,
        semanticCapabilityIndex: fixture.semanticIndex,
        trustedCurrentAuthorityFingerprint: "stale-current-authority",
      }),
    ).toThrowError(expect.objectContaining({ code: "stale-request-authority" }));
    expect(JSON.stringify(fixture.semanticIndex)).not.toMatch(
      /candidateSnapshot|storefrontSnapshot|materialization|proposal/iu,
    );
  });
});
