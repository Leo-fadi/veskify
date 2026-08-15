// @vitest-environment node

import { describe, expect, it } from "vitest";
import { deriveSemanticCapabilityIndex } from "@/application/prompted-storefront-design-compiler";
import {
  createPromptedStorefrontDesignRequestV2,
  type PromptedStorefrontDesignRequestAuthority,
} from "@/application/prompted-storefront-design-intent/request";
import {
  semanticStorefrontAtomCount,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent/semantic-contract";
import {
  createSemanticStorefrontDesignRequestV1,
  expectedSemanticStorefrontDesignRequestFingerprint,
  semanticStorefrontCurrentAuthorityFingerprint,
} from "@/application/prompted-storefront-design-intent/semantic-request";
import {
  validateSemanticStorefrontDesignIntentV1,
  validateSemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent/semantic-validation";
import { createP10B16P03RawKarvonenStudioFixture } from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import {
  createSemanticStorefrontDesignIntentV1WireAuthority,
  decodeSemanticStorefrontDesignIntentV1Wire,
} from "@/integrations/ai/openai/semantic-storefront-design-intent-v1-wire";
import { semanticIntentMaterialFixture } from "../fixtures/p10b-16p-04-semantic-intent";

const promptA =
  "Create a refined premium jewellery storefront with strong editorial storytelling, elegant product discovery, sophisticated configurable-product pages, generous visual breathing room and restrained luxury hierarchy.";

function exactAuthority(): Readonly<{
  authority: PromptedStorefrontDesignRequestAuthority;
  options: Parameters<typeof createSemanticStorefrontDesignRequestV1>[1];
}> {
  const fixture = createP10B16P03RawKarvonenStudioFixture();
  const authority = createPromptedStorefrontDesignRequestV2({
    merchantPrompt: promptA,
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
      authority.request.currentAuthority,
    ),
  });
  return {
    authority,
    options: {
      semanticAuthorityFingerprint: semanticIndex.semanticAuthorityFingerprint,
      semanticInfluenceAuthority: semanticIndex.semanticInfluenceAuthority,
    },
  };
}

function semanticRequest(): SemanticStorefrontDesignRequestV1 {
  const { authority, options } = exactAuthority();
  return createSemanticStorefrontDesignRequestV1(authority, options);
}

function validation(request: SemanticStorefrontDesignRequestV1) {
  return {
    currentAuthorityFingerprint: () => request.currentAuthorityFingerprint,
    semanticAuthorityFingerprint: () => request.semanticAuthorityFingerprint,
  };
}

describe("P10B-16P-04F compact semantic request and wire contract", () => {
  it("projects deterministic aggregate authority without exact registry inventory", () => {
    const { authority, options } = exactAuthority();
    const first = createSemanticStorefrontDesignRequestV1(authority, options);
    const second = createSemanticStorefrontDesignRequestV1(authority, options);
    const serialized = JSON.stringify(first);

    expect(second).toEqual(first);
    expect(first.requestFingerprint).toBe(
      expectedSemanticStorefrontDesignRequestFingerprint(first),
    );
    expect(first.merchantPrompt).toBe(promptA);
    expect(first.catalogueCharacteristics.productCount).toBeGreaterThan(0);
    expect(first.catalogueCharacteristics.productTypeCount).toBeGreaterThan(0);
    expect(first.supportedPageFamilies.length).toBeLessThanOrEqual(6);
    expect(first.explicitConstraintAuthority).toEqual([]);
    expect(first.trustedExactHints).toEqual({
      directionPackageId: null,
      frameFamilyId: null,
    });
    expect(first.fixedRuntimeTruth).toEqual({
      commerce: "read-only",
      canonicalMedia: "protected",
      searchExecution: "registered-presentation-runtime-unavailable",
    });
    expect(serialized).not.toContain("capabilityProjection");
    expect(serialized).not.toContain("capabilities");
    expect(serialized).not.toContain("editorial-masthead");
    expect(serialized).not.toContain("homepage-editorial-storytelling");
    expect(serialized).not.toContain("dynamicProductDetail");
    expect(serialized).not.toContain(authority.request.currentAuthority.projectId);
  });

  it("validates request fingerprints and only accepts registered trusted hints", () => {
    const { authority, options } = exactAuthority();
    const request = createSemanticStorefrontDesignRequestV1(authority, {
      ...options,
      trustedExactHints: {
        directionPackageId: "premium-editorial",
        frameFamilyId: "editorial-masthead",
      },
    });
    expect(validateSemanticStorefrontDesignRequestV1(request)).toEqual(request);
    expect(() =>
      validateSemanticStorefrontDesignRequestV1({
        ...request,
        requestFingerprint: "semantic-request-stale",
      }),
    ).toThrowError("request-fingerprint-mismatch");
    expect(() =>
      createSemanticStorefrontDesignRequestV1(authority, {
        ...options,
        trustedExactHints: {
          directionPackageId: "invented-direction",
          frameFamilyId: null,
        },
      }),
    ).toThrowError("invalid-request");
  });

  it("exports a compact recursively closed strict schema without exact key enums", () => {
    const request = semanticRequest();
    const wire = createSemanticStorefrontDesignIntentV1WireAuthority(request);
    const serialized = JSON.stringify(wire.schema);

    expect(semanticStorefrontAtomCount).toBe(27);
    expect(wire.metrics.conservativeEstimatedTokens).toBeLessThan(20_000);
    expect(wire.metrics.definitionCount).toBeGreaterThan(0);
    expect(serialized).toMatch(/"commercialPosture"/);
    expect(serialized).toMatch(/"density"/);
    expect(serialized).toMatch(/"navigationPosture"/);
    expect(serialized).toMatch(/"storyCatalogueBalance"/);
    expect(serialized).toMatch(/"discoveryPosture"/);
    expect(serialized).toMatch(/"configurableProductPosture"/);
    expect(serialized).toMatch(/"mobileHierarchy"/);
    expect(serialized).toMatch(/"imageProminence"/);
    expect(serialized).not.toMatch(
      /"typographyCharacter"|"spacing"|"headerPriority"|"primaryRole"|"productCardInformationDepth"|"galleryEmphasis"|"cropFocalPosture"/,
    );
    expect(serialized).not.toContain("editorial-masthead");
    expect(serialized).not.toContain("homepage-editorial-storytelling");
    expect(serialized).not.toContain("component.meaningful-variant");
    expect(serialized).not.toContain("PageBlueprint");
  });

  it("decodes one strict semantic result, derives its fingerprint, and performs no repair", () => {
    const request = semanticRequest();
    const material = semanticIntentMaterialFixture(request, {
      designConceptSummary: "A refined, story-led commercial experience.",
    });
    const wire = createSemanticStorefrontDesignIntentV1WireAuthority(request);
    const decoded = decodeSemanticStorefrontDesignIntentV1Wire({
      wireIntent: material,
      request,
      validation: validation(request),
      expectedSchemaFingerprint: wire.schemaFingerprint,
    });

    expect(Object.keys(material)).toEqual([
      "contractVersion",
      "requestFingerprint",
      "promptFingerprint",
      "currentAuthorityFingerprint",
      "semanticAuthorityFingerprint",
      "designConceptSummary",
      "commercialPosture",
      "globalVisualIntent",
      "sharedFrameIntent",
      "homepageIntent",
      "collectionIntent",
      "pdpIntent",
      "responsiveAndArtDirectionIntent",
    ]);
    expect(material.globalVisualIntent).toEqual({ density: "balanced" });
    expect(material.sharedFrameIntent).toEqual({ navigationPosture: "minimal" });
    expect(material.homepageIntent).toEqual({ storyCatalogueBalance: "balanced" });
    expect(material.collectionIntent).toEqual({ discoveryPosture: "dense-search" });
    expect(material.pdpIntent).toEqual({ configurableProductPosture: "standard" });
    expect(material.responsiveAndArtDirectionIntent).toEqual({
      mobileHierarchy: "balanced",
      imageProminence: "balanced",
    });
    expect(decoded.intent.semanticIntentFingerprint).toMatch(/^semantic-storefront-intent-/);
    expect(decoded.intent.commercialPosture).toBe("minimal-commerce");
    expect(decoded.wireIntentFingerprint).toMatch(/^semantic-storefront-wire-intent-/);
    expect(() =>
      decodeSemanticStorefrontDesignIntentV1Wire({
        wireIntent: { ...material, providerInventedField: "not allowed" },
        request,
        validation: validation(request),
        expectedSchemaFingerprint: wire.schemaFingerprint,
      }),
    ).toThrowError("strict-schema-invalid");
    const { sharedFrameIntent: _sharedFrameIntent, ...incomplete } = material;
    void _sharedFrameIntent;
    expect(() =>
      decodeSemanticStorefrontDesignIntentV1Wire({
        wireIntent: incomplete,
        request,
        validation: validation(request),
        expectedSchemaFingerprint: wire.schemaFingerprint,
      }),
    ).toThrowError("strict-schema-invalid");
  });

  it("fails stale response identity and authority before returning an intent", () => {
    const request = semanticRequest();
    const material = semanticIntentMaterialFixture(request);
    expect(() =>
      validateSemanticStorefrontDesignIntentV1({
        request,
        validation: validation(request),
        intent: { ...material, promptFingerprint: "stale-prompt" },
      }),
    ).toThrowError("prompt-fingerprint-mismatch");
    expect(() =>
      validateSemanticStorefrontDesignIntentV1({
        request,
        validation: {
          ...validation(request),
          semanticAuthorityFingerprint: () => "stale-semantic-authority",
        },
        intent: material,
      }),
    ).toThrowError("stale-authority");
  });
});
