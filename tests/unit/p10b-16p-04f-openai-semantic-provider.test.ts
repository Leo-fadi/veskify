// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deriveSemanticCapabilityIndex } from "@/application/prompted-storefront-design-compiler";
import { PromptedStorefrontDesignIntentError } from "@/application/prompted-storefront-design-intent/contract";
import {
  semanticStorefrontAtomCount,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent/semantic-contract";
import { createPromptedStorefrontDesignRequestV2 } from "@/application/prompted-storefront-design-intent/request";
import {
  createSemanticStorefrontDesignRequestV1,
  semanticStorefrontCurrentAuthorityFingerprint,
} from "@/application/prompted-storefront-design-intent/semantic-request";
import { createP10B16P03RawKarvonenStudioFixture } from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import {
  buildOpenAiPromptedStorefrontDesignIntentV2Request,
  OpenAiPromptedStorefrontDesignIntentV2Provider,
  projectOpenAiPromptedStorefrontDesignIntentV2Input,
  type PromptedStorefrontDesignIntentProviderTelemetryEvent,
} from "@/integrations/ai/openai/prompted-storefront-design-intent-v2-provider.server";
import {
  OPENAI_PROMPTED_DESIGN_CANONICAL_BASE_URL,
  selectServerPromptedStorefrontDesignIntentProviderConfiguration,
} from "@/integrations/ai/openai/prompted-storefront-design-intent-v2-client.server";
import {
  createSemanticStorefrontDesignIntentV1WireAuthority,
  decodeSemanticStorefrontDesignIntentV1Wire,
} from "@/integrations/ai/openai/semantic-storefront-design-intent-v1-wire";
import type {
  OpenAiResponseRequestOptions,
  OpenAiResponsesRequest,
} from "@/integrations/ai/openai/strict-output-contract";
import { semanticIntentMaterialFixture } from "../fixtures/p10b-16p-04-semantic-intent";

const merchantPrompt = "Create a restrained editorial storefront.";

const semanticDriverPropertyNames = [
  "commercialPosture",
  "density",
  "navigationPosture",
  "storyCatalogueBalance",
  "discoveryPosture",
  "configurableProductPosture",
  "mobileHierarchy",
  "imageProminence",
] as const;

const removedPeerPropertyNames = [
  "intendedCustomerExperience",
  "typographyCharacter",
  "typographyHierarchy",
  "typographyScale",
  "spacing",
  "surfaceDepth",
  "shape",
  "controls",
  "colour",
  "mediaEmphasis",
  "headerPriority",
  "announcementImportance",
  "footerDepth",
  "primaryRole",
  "secondaryRoles",
  "productCardInformationDepth",
  "simpleProductPosture",
  "highConsiderationPosture",
  "galleryEmphasis",
  "densityTransformation",
  "cropFocalPosture",
  "overlayPosture",
] as const;

function requestFixture(): SemanticStorefrontDesignRequestV1 {
  const fixture = createP10B16P03RawKarvonenStudioFixture();
  const authority = createPromptedStorefrontDesignRequestV2({
    merchantPrompt,
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
  return createSemanticStorefrontDesignRequestV1(authority, {
    semanticAuthorityFingerprint: semanticIndex.semanticAuthorityFingerprint,
    semanticInfluenceAuthority: semanticIndex.semanticInfluenceAuthority,
    explicitConstraintAuthority: [
      {
        clauseReference: "merchant-frame-requirement",
        field: "shared-frame-family",
        value: "editorial-masthead",
        semantics: "hard",
      },
    ],
    trustedExactHints: {
      directionPackageId: "premium-editorial",
      frameFamilyId: "editorial-masthead",
    },
  });
}

function intentFixture(request = requestFixture()) {
  return semanticIntentMaterialFixture(request, {
    designConceptSummary: "Refined product discovery with editorial restraint.",
  });
}

class RecordingTransport {
  readonly calls: Array<{
    request: OpenAiResponsesRequest;
    options: OpenAiResponseRequestOptions;
  }> = [];

  constructor(
    readonly response: unknown,
    readonly error?: Error,
  ) {}

  create(request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) {
    this.calls.push({ request, options });
    return this.error ? Promise.reject(this.error) : Promise.resolve(this.response);
  }
}

function validation(request: SemanticStorefrontDesignRequestV1) {
  return {
    currentAuthorityFingerprint: () => request.currentAuthorityFingerprint,
    semanticAuthorityFingerprint: () => request.semanticAuthorityFingerprint,
  };
}

function provider(
  transport: RecordingTransport,
  telemetry?: { record(event: PromptedStorefrontDesignIntentProviderTelemetryEvent): void },
) {
  return new OpenAiPromptedStorefrontDesignIntentV2Provider({
    responses: transport,
    model: "semantic-test-model",
    timeoutMs: 120_000,
    telemetry,
  });
}

function capturePromptedStorefrontDesignIntentError(
  operation: () => unknown,
): PromptedStorefrontDesignIntentError {
  try {
    operation();
  } catch (error) {
    if (error instanceof PromptedStorefrontDesignIntentError) return error;
    throw error;
  }
  throw new Error("Expected prompted storefront design intent validation to fail.");
}

describe("P10B-16P-04F OpenAI semantic provider", () => {
  it("retains only allowlisted wire-schema issue paths", () => {
    const request = requestFixture();
    const authority = createSemanticStorefrontDesignIntentV1WireAuthority(request);
    const decode = (wireIntent: unknown) =>
      decodeSemanticStorefrontDesignIntentV1Wire({
        wireIntent,
        request,
        validation: validation(request),
        expectedSchemaFingerprint: authority.schemaFingerprint,
      });
    const { commercialPosture: _omitted, ...missingKnownField } = intentFixture(request);
    void _omitted;
    const missingKnownFieldError = capturePromptedStorefrontDesignIntentError(() =>
      decode(missingKnownField),
    );
    expect(missingKnownFieldError.code).toBe("strict-schema-invalid");
    expect(missingKnownFieldError.safeDiagnostic?.issuePaths).toEqual(["commercialPosture"]);
    const unsafeError = capturePromptedStorefrontDesignIntentError(() =>
      decode({ ...intentFixture(request), unadvertisedSecret: "unretained-private-value" }),
    );
    expect(unsafeError.code).toBe("strict-schema-invalid");
    expect(JSON.stringify(unsafeError)).not.toContain("unadvertisedSecret");
    expect(JSON.stringify(unsafeError)).not.toContain("unretained-private-value");

    const removedPeerError = capturePromptedStorefrontDesignIntentError(() =>
      decode({
        ...intentFixture(request),
        globalVisualIntent: {
          density: intentFixture(request).globalVisualIntent.density,
          typographyCharacter: "unadvertised-peer-value",
        },
      }),
    );
    expect(removedPeerError.code).toBe("strict-schema-invalid");
    expect(removedPeerError.safeDiagnostic?.issuePaths).toEqual(["globalVisualIntent"]);
    expect(JSON.stringify(removedPeerError)).not.toContain("typographyCharacter");
    expect(JSON.stringify(removedPeerError)).not.toContain("unadvertised-peer-value");
  });

  it("sends a compact strict semantic request without registry authority or trusted exact hints", () => {
    const request = requestFixture();
    const projected = projectOpenAiPromptedStorefrontDesignIntentV2Input(request);
    const providerRequest = buildOpenAiPromptedStorefrontDesignIntentV2Request(request, "model");
    const serializedInput = JSON.stringify(projected);
    const serializedSchema = JSON.stringify(providerRequest.text.format.schema);
    const serializedEnvelope = JSON.stringify(providerRequest);
    const conservativeEnvelopeTokens = Math.ceil(serializedEnvelope.length / 4);
    expect(serializedInput).not.toMatch(
      /capabilityManifest|capabilityProjection|trustedExactHints|selectionId|PageBlueprint|editorial-masthead|directionPackageId|frameFamilyId|commercial-frame-editorial/,
    );
    expect(serializedInput).toContain("premium-editorial");
    for (const propertyName of semanticDriverPropertyNames) {
      expect(serializedSchema).toContain(`"${propertyName}"`);
    }
    for (const propertyName of removedPeerPropertyNames) {
      expect(serializedSchema).not.toContain(`"${propertyName}"`);
    }
    expect(serializedSchema).not.toMatch(
      /capabilityProjection|selectionId|componentId|variantId|pageBlueprintId|frameFamilyId|directionPackageId/,
    );
    expect(Object.values(request.trustedExactHints).filter((value) => value !== null)).toHaveLength(
      2,
    );
    expect(semanticStorefrontAtomCount).toBe(27);
    expect(providerRequest.store).toBe(false);
    expect(providerRequest.max_output_tokens).toBe(4_000);
    expect(providerRequest.text.format.strict).toBe(true);
    expect(providerRequest.text.format.schema).toEqual(
      createSemanticStorefrontDesignIntentV1WireAuthority(request).schema,
    );
    expect(Buffer.byteLength(providerRequest.instructions)).toBeLessThan(5_000);
    expect(Buffer.byteLength(providerRequest.input)).toBeLessThan(10_000);
    expect(Buffer.byteLength(serializedSchema)).toBeLessThan(40_000);
    expect(Buffer.byteLength(serializedEnvelope)).toBeLessThan(60_000);
    expect(
      createSemanticStorefrontDesignIntentV1WireAuthority(request).metrics
        .conservativeEstimatedTokens,
    ).toBeLessThan(20_000);
    expect(conservativeEnvelopeTokens).toBeLessThan(15_000);
  });

  it("makes one zero-retry call and validates the returned semantic intent", async () => {
    const request = requestFixture();
    const transport = new RecordingTransport({
      id: "response-safe-id",
      status: "completed",
      output: [],
      output_text: JSON.stringify(intentFixture(request)),
      usage: { input_tokens: 900, output_tokens: 400, total_tokens: 1_300 },
    });
    const result = await provider(transport).createDesignIntent(request, validation(request));

    expect(result.semanticIntentFingerprint).toMatch(/^semantic-storefront-intent-/);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.options).toEqual({ maxRetries: 0, timeout: 120_000 });
  });

  it("fails stale authority before entering the provider transport", async () => {
    const request = requestFixture();
    const transport = new RecordingTransport(undefined);
    await expect(
      provider(transport).createDesignIntent(request, {
        currentAuthorityFingerprint: () => "different-current-authority",
        semanticAuthorityFingerprint: () => request.semanticAuthorityFingerprint,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
    expect(transport.calls).toHaveLength(0);
  });

  it("selects only the official 120-second zero-retry transport without fallback", () => {
    const environment = {
      VESKIFY_AI_PROVIDER: "openai",
      OPENAI_API_KEY: "test-only-placeholder",
      VESKIFY_OPENAI_MODEL: "semantic-test-model",
      VESKIFY_OPENAI_TIMEOUT_MS: "120000",
    };
    const selected = selectServerPromptedStorefrontDesignIntentProviderConfiguration({
      environment,
      sdkEnvironment: {},
    });

    expect(OPENAI_PROMPTED_DESIGN_CANONICAL_BASE_URL).toBe("https://api.openai.com/v1");
    expect(selected).toMatchObject({
      category: "eligible",
      modelId: "semantic-test-model",
      timeoutMs: 120_000,
      retryCount: 0,
      transport: {
        endpoint: "official-openai-responses-v1",
        canonicalBaseUrl: true,
        customHeadersConfigured: false,
        proxyConfigured: false,
      },
    });
    const unavailable = selectServerPromptedStorefrontDesignIntentProviderConfiguration({
      environment: { ...environment, VESKIFY_AI_PROVIDER: "deterministic" },
      sdkEnvironment: {},
    });
    expect(unavailable.category).toBe("provider-not-openai");
    expect(unavailable.modelId).toBeNull();
  });

  it.each([
    {
      name: "provider refusal",
      response: {
        id: "safe-refusal-id",
        status: "completed",
        output: [{ content: [{ type: "refusal" }] }],
        output_text: "{}",
      },
      error: undefined,
      code: "provider-refusal",
      outcome: "providerRefusal",
    },
    {
      name: "malformed completed output",
      response: {
        id: "safe-malformed-id",
        status: "completed",
        output: [],
        output_text: "{",
      },
      error: undefined,
      code: "malformed-output",
      outcome: "malformedOutput",
    },
    {
      name: "strict semantic schema rejection",
      response: {
        id: "safe-schema-id",
        status: "completed",
        output: [],
        output_text: "{}",
      },
      error: undefined,
      code: "strict-schema-invalid",
      outcome: "strictSchemaInvalid",
    },
    {
      name: "transport reset",
      response: undefined,
      error: Object.assign(new Error("unsafe transport detail"), {
        name: "APIConnectionError",
        cause: { code: "ECONNRESET" },
      }),
      code: "provider-transport",
      outcome: "transportFailure",
      safeCause: "connection-reset",
    },
    {
      name: "transport timeout",
      response: undefined,
      error: Object.assign(new Error("unsafe timeout detail"), {
        name: "APIConnectionTimeoutError",
      }),
      code: "provider-timeout",
      outcome: "timeout",
      safeCause: "timeout",
    },
  ])("classifies $name safely after exactly one call", async (scenario) => {
    const request = requestFixture();
    const transport = new RecordingTransport(scenario.response, scenario.error);
    const record = vi.fn<(event: PromptedStorefrontDesignIntentProviderTelemetryEvent) => void>();

    await expect(
      provider(transport, { record }).createDesignIntent(request, validation(request)),
    ).rejects.toMatchObject({ code: scenario.code });

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.options).toEqual({ maxRetries: 0, timeout: 120_000 });
    expect(record).toHaveBeenCalledTimes(1);
    const event = record.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      callCount: 1,
      retryCount: 0,
      sdkTransportEntryCount: 1,
      outcome: scenario.outcome,
      ...(scenario.safeCause
        ? { transportDiagnostic: { kind: "openai-transport", cause: scenario.safeCause } }
        : {}),
    });
    if (scenario.code === "strict-schema-invalid") {
      expect(event?.schemaDiagnostic?.kind).toBe("schema-validation");
      expect(typeof event?.schemaDiagnostic?.issueCount).toBe("number");
      expect(Array.isArray(event?.schemaDiagnostic?.issueCodes)).toBe(true);
      expect(Array.isArray(event?.schemaDiagnostic?.issuePaths)).toBe(true);
      expect(event?.schemaDiagnostic?.fingerprint).toMatch(/^semantic-wire-schema-diagnostic-v1_/);
    }
    expect(JSON.stringify(event)).not.toContain("unsafe");
  });
});
