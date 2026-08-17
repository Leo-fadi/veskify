import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  semanticStorefrontCurrentAuthorityFingerprint,
  semanticStorefrontDesignIntentFingerprint,
  semanticStorefrontDesignIntentV1Schema,
  type SemanticStorefrontDesignIntentV1,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent";
import { deriveSemanticCapabilityIndex } from "@/application/prompted-storefront-design-compiler";
import { createPromptedStorefrontDesignRequestV2 } from "@/application/prompted-storefront-design-intent/request";
import { createSemanticStorefrontDesignRequestV1 } from "@/application/prompted-storefront-design-intent/semantic-request";
import { createP10B16P03RawKarvonenStudioFixture } from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import {
  createP10B16P03MockPromptedStorefrontDesignIntentProvider,
  p10b16p03MockPromptScenarios,
  selectP10B16P03MockPromptScenario,
  type P10B16P03MockPromptFailure,
} from "@/integrations/ai/mock-prompted-storefront-design-intent-v2-provider.server";
import {
  semanticIntentMaterialFixture,
  type SemanticDriverOverrides,
} from "../fixtures/p10b-16p-04-semantic-intent";

const scenarioExpectations = {
  "premium-editorial": {
    designConceptSummary: "Refined editorial storytelling with calm, considered commerce.",
    commercialPosture: "premium-editorial",
    density: "low",
    navigationPosture: "editorial",
    storyCatalogueBalance: "story-first",
    discoveryPosture: "editorial",
    configurableProductPosture: "guided",
    mobileHierarchy: "story-led",
    imageProminence: "image-led",
  },
  "modern-technical": {
    designConceptSummary: "Technical catalogue depth with precise comparison and decision support.",
    commercialPosture: "modern-technical",
    density: "high",
    navigationPosture: "catalogue",
    storyCatalogueBalance: "catalogue-first",
    discoveryPosture: "campaign",
    configurableProductPosture: "guided",
    mobileHierarchy: "product-led",
    imageProminence: "balanced",
  },
  "minimal-commerce": {
    designConceptSummary: "Restrained product discovery with low visual noise and direct commerce.",
    commercialPosture: "minimal-commerce",
    density: "balanced",
    navigationPosture: "minimal",
    storyCatalogueBalance: "balanced",
    discoveryPosture: "dense-search",
    configurableProductPosture: "standard",
    mobileHierarchy: "conversion-led",
    imageProminence: "restrained",
  },
} as const satisfies Record<(typeof p10b16p03MockPromptScenarios)[number], SemanticDriverOverrides>;

function request(): SemanticStorefrontDesignRequestV1 {
  const fixture = createP10B16P03RawKarvonenStudioFixture();
  const exact = createPromptedStorefrontDesignRequestV2({
    merchantPrompt: "Create a refined premium editorial jewellery storefront.",
    project: fixture.aggregate.project,
    draft: fixture.planningInput.draft,
    catalogue: fixture.planningInput.catalogue,
    approvedBrief: fixture.brief,
    approvedAssetContext: fixture.planningInput.approvedAssetContext,
    priorDiversityEvidence: {
      recentAcceptedStructuralFingerprints: [],
      recentRejectedStructuralFingerprints: [],
      recentlyUsedPostureKeys: [],
      merchantAvoidancePreferenceKeys: [],
    },
  });
  const semanticIndex = deriveSemanticCapabilityIndex({
    authority: {
      planningInput: fixture.planningInput,
      siteMapDecision: fixture.siteMapDecision,
      approvedEvidenceReferences: fixture.approvedEvidenceReferences,
    },
    currentAuthorityFingerprint: semanticStorefrontCurrentAuthorityFingerprint(
      exact.request.currentAuthority,
    ),
  });
  return createSemanticStorefrontDesignRequestV1(exact, {
    semanticAuthorityFingerprint: semanticIndex.semanticAuthorityFingerprint,
    semanticInfluenceAuthority: semanticIndex.semanticInfluenceAuthority,
  });
}

function validation(request: SemanticStorefrontDesignRequestV1) {
  return {
    currentAuthorityFingerprint: () => request.currentAuthorityFingerprint,
    semanticAuthorityFingerprint: () => request.semanticAuthorityFingerprint,
  };
}

async function intentFor(
  scenario: (typeof p10b16p03MockPromptScenarios)[number],
): Promise<SemanticStorefrontDesignIntentV1> {
  const semanticRequest = request();
  return createP10B16P03MockPromptedStorefrontDesignIntentProvider({
    scenario,
    compatibilityInput: { ignoredLegacyAuthority: true },
  }).createDesignIntent(semanticRequest, validation(semanticRequest));
}

describe("P10B-16P-04F semantic mock provider", () => {
  it("retains deterministic merchant-language scenario selection", () => {
    expect(selectP10B16P03MockPromptScenario("Refined editorial storytelling")).toBe(
      "premium-editorial",
    );
    expect(selectP10B16P03MockPromptScenario("Dense technical catalogue comparison")).toBe(
      "modern-technical",
    );
    expect(selectP10B16P03MockPromptScenario("Minimal conversion experience")).toBe(
      "minimal-commerce",
    );
    expect(selectP10B16P03MockPromptScenario("Please improve the storefront")).toBe(
      "premium-editorial",
    );
  });

  it.each(p10b16p03MockPromptScenarios)(
    "emits one strict registry-decoupled %s intent with a valid fingerprint",
    async (scenario) => {
      const onRequest = vi.fn();
      const provider = createP10B16P03MockPromptedStorefrontDesignIntentProvider({
        scenario,
        compatibilityInput: { exactAuthorityMustRemainUnused: true },
        onRequest,
      });
      const semanticRequest = request();
      const intent = await provider.createDesignIntent(
        semanticRequest,
        validation(semanticRequest),
      );
      expect(onRequest).toHaveBeenCalledOnce();
      expect(onRequest).toHaveBeenCalledWith(semanticRequest);
      expect(semanticStorefrontDesignIntentV1Schema.parse(intent)).toEqual(intent);
      const { semanticIntentFingerprint, ...material } = intent;
      expect(material).toEqual(
        semanticIntentMaterialFixture(semanticRequest, scenarioExpectations[scenario]),
      );
      expect(semanticIntentFingerprint).toBe(semanticStorefrontDesignIntentFingerprint(material));
      expect(intent.commercialPosture).toBe(scenario);
      expect(JSON.stringify(intent)).not.toMatch(
        /editorial-masthead|centered-minimal|homepage-|collection-|pdp-|componentId|variantId|pageBlueprint|selectionId|typographyCharacter|productCardInformationDepth|galleryEmphasis/,
      );
    },
  );

  it("produces stable but materially different semantic scenario evidence", async () => {
    const firstPremium = await intentFor("premium-editorial");
    const secondPremium = await intentFor("premium-editorial");
    const modern = await intentFor("modern-technical");
    const minimal = await intentFor("minimal-commerce");
    expect(firstPremium.semanticIntentFingerprint).toBe(secondPremium.semanticIntentFingerprint);
    expect(
      new Set([
        firstPremium.semanticIntentFingerprint,
        modern.semanticIntentFingerprint,
        minimal.semanticIntentFingerprint,
      ]).size,
    ).toBe(3);
    const intents = [firstPremium, modern, minimal] as const;
    const driverValues = [
      intents.map(({ commercialPosture }) => commercialPosture),
      intents.map(({ globalVisualIntent }) => globalVisualIntent.density),
      intents.map(({ sharedFrameIntent }) => sharedFrameIntent.navigationPosture),
      intents.map(({ homepageIntent }) => homepageIntent.storyCatalogueBalance),
      intents.map(({ collectionIntent }) => collectionIntent.discoveryPosture),
      intents.map(({ pdpIntent }) => pdpIntent.configurableProductPosture),
      intents.map(
        ({ responsiveAndArtDirectionIntent }) => responsiveAndArtDirectionIntent.mobileHierarchy,
      ),
      intents.map(
        ({ responsiveAndArtDirectionIntent }) => responsiveAndArtDirectionIntent.imageProminence,
      ),
    ];
    expect(driverValues).toHaveLength(8);
    const distinctValueCounts = driverValues.map((values) => new Set(values).size);
    expect(distinctValueCounts.every((count) => count >= 2)).toBe(true);
    expect(distinctValueCounts.filter((count) => count === 3).length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    ["current", { currentAuthorityFingerprint: () => "changed-current-authority" }],
    ["semantic", { semanticAuthorityFingerprint: () => "changed-semantic-authority" }],
  ] as const)("fails closed for stale %s authority", async (_kind, stalePart) => {
    const semanticRequest = request();
    const provider = createP10B16P03MockPromptedStorefrontDesignIntentProvider({
      scenario: "premium-editorial",
    });
    await expect(
      provider.createDesignIntent(semanticRequest, {
        ...validation(semanticRequest),
        ...stalePart,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
  });

  it.each([
    ["provider-refusal", "provider-refusal"],
    ["provider-timeout", "provider-timeout"],
    ["provider-transport", "provider-transport"],
    ["malformed-output", "malformed-output"],
    ["strict-schema-invalid", "strict-schema-invalid"],
    ["unknown-capability", "unknown-capability"],
    ["insufficient-material-intent", "invalid-request"],
    ["unsupported-hard-constraint", "unknown-capability"],
  ] satisfies readonly [P10B16P03MockPromptFailure, string][])(
    "preserves the safe %s failure scenario",
    async (failure, expectedCode) => {
      const semanticRequest = request();
      const provider = createP10B16P03MockPromptedStorefrontDesignIntentProvider({
        scenario: "premium-editorial",
        failure,
      });
      await expect(
        provider.createDesignIntent(semanticRequest, validation(semanticRequest)),
      ).rejects.toMatchObject({ code: expectedCode });
    },
  );
});
