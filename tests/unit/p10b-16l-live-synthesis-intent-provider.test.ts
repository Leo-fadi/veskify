// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  executeCoordinatedDirection,
  P10B_LIVE_SYNTHESIS_INTENT_CONTRACT_VERSION,
  p10bLiveSynthesisExecutableResultFingerprint,
  type CoordinatedDirectionExecutionInput,
  type CoordinatedStorefrontDirectionId,
} from "@/application/bounded-storefront-synthesis";
import {
  createP10bLiveSynthesisIntentProviderRequest,
  p10bLiveSynthesisIntentProviderRequestSchema,
  validateP10bLiveSynthesisIntentProviderResult,
  type P10bLiveSynthesisIntentProviderRequest,
  type P10bLiveSynthesisIntentProviderResult,
} from "@/application/bounded-storefront-synthesis/live-provider-acceptance";
import { createP10B16LRawKarvonenAcceptanceFixture } from "@/data/demo/p10b-16l-live-provider-acceptance";
import {
  assertOpenAiStrictSchemaIsClosed,
  type OpenAiProviderTelemetry,
  type OpenAiProviderTelemetryEvent,
  type OpenAiResponseRequestOptions,
  type OpenAiResponsesRequest,
} from "@/integrations/ai/openai/contract";
import { selectServerP10bLiveSynthesisIntentProviderConfiguration } from "@/integrations/ai/openai/p10b-live-synthesis-intent-client.server";
import {
  buildOpenAiP10bLiveSynthesisIntentRequest,
  openAiP10bLiveSynthesisIntentOutputSchema,
  OpenAiP10bLiveSynthesisIntentProvider,
} from "@/integrations/ai/openai/p10b-live-synthesis-intent-provider";

const fixture = createP10B16LRawKarvonenAcceptanceFixture();
const currentAuthorityFingerprint = "p10b16l-current-authority-test";
const executionAuthority: Omit<
  CoordinatedDirectionExecutionInput,
  "directionRequest" | "usedDiversityFingerprints"
> = {
  planningInput: fixture.executionPlanningInput,
  siteMapDecision: fixture.siteMapDecision,
  approvedEvidenceReferences: fixture.approvedEvidenceReferences,
  pageEvidenceAuthority: fixture.pageEvidenceAuthority,
  contentFactAuthority: fixture.contentFactAuthority,
  approvedAssetPresentations: fixture.approvedAssetPresentations,
};
const requestCache = new Map<
  CoordinatedStorefrontDirectionId | "general",
  P10bLiveSynthesisIntentProviderRequest
>();

function request(requestedDirectionId: CoordinatedStorefrontDirectionId | null) {
  const cacheKey = requestedDirectionId ?? "general";
  const cached = requestCache.get(cacheKey);
  if (cached) return cached;
  const { brief, planningInput } = fixture;
  const catalogue = planningInput.catalogue;
  const created = createP10bLiveSynthesisIntentProviderRequest({
    merchantInstruction:
      requestedDirectionId === null
        ? "Create a complete storefront with a coherent direction for this merchant."
        : `Create a ${requestedDirectionId} complete storefront.`,
    requestedDirectionId,
    merchantContext: {
      businessName: brief.businessIdentity.businessName,
      shortDescription: brief.businessIdentity.shortDescription,
      industry: brief.businessIdentity.industry,
      targetCustomer: brief.businessIdentity.targetCustomer,
      primaryMarket: brief.businessIdentity.primaryMarket,
      enabledLocales: planningInput.project.enabledLocales,
    },
    catalogueCharacteristics: {
      productCount: catalogue.products.length,
      collectionCount: catalogue.collections.length,
      configurableProductCount: catalogue.products.filter(
        ({ orderOptions }) => (orderOptions?.length ?? 0) > 0,
      ).length,
      optionGroupCount: catalogue.products.reduce(
        (count, { orderOptions }) => count + (orderOptions?.length ?? 0),
        0,
      ),
      productsWithMultipleMedia: catalogue.products.filter(({ images }) => images.length > 1)
        .length,
      productsWithoutPrice: catalogue.products.filter(({ price }) => price === undefined).length,
      canonicalCommerceFingerprint: "commerce-p10b16l-test",
    },
    evidenceRichness: {
      approvedBriefRevision: brief.revision,
      approvedFactFamilies: ["about"],
      approvedFactCount: fixture.approvedEvidenceReferences.length,
    },
    approvedAssetPosture: {
      approvedAssetCount: fixture.approvedAssetPresentations.length,
      approvedRoles: [],
      editorialMediaAvailable: false,
    },
    currentAuthorityFingerprint,
    executionAuthority,
  });
  requestCache.set(cacheKey, created);
  return created;
}

function selectedResult(
  providerRequest: P10bLiveSynthesisIntentProviderRequest,
  index = 0,
): P10bLiveSynthesisIntentProviderResult {
  const selected = providerRequest.executableIntents[index];
  if (!selected) throw new Error("The test requires an advertised executable intent.");
  return {
    requestFingerprint: providerRequest.requestFingerprint,
    executableIntentId: selected.intentId,
    executableIntentFingerprint: selected.executableIntentFingerprint,
  };
}

function completedResponse(
  providerRequest: P10bLiveSynthesisIntentProviderRequest,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "resp_p10b16l_safe",
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: "structured" }] }],
    output_text: JSON.stringify(selectedResult(providerRequest)),
    usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100 },
    ...overrides,
  };
}

class RecordingTransport {
  readonly calls: Array<{
    request: OpenAiResponsesRequest;
    options: OpenAiResponseRequestOptions;
  }> = [];

  constructor(
    readonly implementation: (
      request: OpenAiResponsesRequest,
      options: OpenAiResponseRequestOptions,
    ) => Promise<unknown>,
  ) {}

  create(requestValue: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) {
    this.calls.push({ request: requestValue, options });
    return this.implementation(requestValue, options);
  }
}

function provider(transport: RecordingTransport, telemetry?: OpenAiProviderTelemetry) {
  return new OpenAiP10bLiveSynthesisIntentProvider({
    responses: transport,
    model: "p10b16l-test-model",
    timeoutMs: 4_000,
    telemetry,
  });
}

describe("P10B-16L bounded live synthesis intent provider", () => {
  it("versions v2 and exposes only executable options for general and exact named directions", () => {
    expect(P10B_LIVE_SYNTHESIS_INTENT_CONTRACT_VERSION).toBe("2.0.0");
    const general = request(null);
    expect(general.contractVersion).toBe("2.0.0");
    expect(Object.isFrozen(general)).toBe(true);
    expect(Object.isFrozen(general.executableIntents)).toBe(true);
    expect(Object.isFrozen(general.executableIntents[0])).toBe(true);
    expect(Object.isFrozen(general.executableIntents[0].characteristics)).toBe(true);
    expect(general.executableIntents).toHaveLength(3);
    expect(
      Object.fromEntries(
        ["premium-editorial", "modern-technical", "minimal-commerce"].map((directionId) => [
          directionId,
          general.executableIntents.filter((option) => option.directionId === directionId).length,
        ]),
      ),
    ).toEqual({
      "premium-editorial": 1,
      "modern-technical": 1,
      "minimal-commerce": 1,
    });
    expect(
      general.executableIntents.every(
        ({ intentId, executableIntentFingerprint, expectedExecutionFingerprint }) =>
          intentId.length > 0 &&
          executableIntentFingerprint.startsWith("p10b-live-executable-intent-") &&
          expectedExecutionFingerprint.startsWith("p10b-live-executable-result-"),
      ),
    ).toBe(true);
    expect(JSON.stringify(general)).not.toMatch(
      /premiumEditorial|modernTechnical|warmApproachable|homepageProfileId|sharedFrameProfileId|componentSelections|productCardAnatomyIds/,
    );

    const named = request("premium-editorial");
    expect(named.requestedDirectionId).toBe("premium-editorial");
    expect(named.executableIntents).toHaveLength(1);
    expect(new Set(named.executableIntents.map(({ directionId }) => directionId))).toEqual(
      new Set(["premium-editorial"]),
    );
  }, 90_000);

  it("fails closed for v1 and stale request authority", () => {
    const current = request(null);
    expect(p10bLiveSynthesisIntentProviderRequestSchema.safeParse(current).success).toBe(true);
    const v1Request = { ...current, contractVersion: "1.0.0" };
    expect(p10bLiveSynthesisIntentProviderRequestSchema.safeParse(v1Request).success).toBe(false);
    expect(() =>
      validateP10bLiveSynthesisIntentProviderResult(v1Request, selectedResult(current)),
    ).toThrow(expect.objectContaining({ code: "invalid-request" }));
    expect(
      p10bLiveSynthesisIntentProviderRequestSchema.safeParse({
        ...current,
        currentAuthorityFingerprint: "changed-current-authority",
      }).success,
    ).toBe(false);
    expect(() =>
      validateP10bLiveSynthesisIntentProviderResult(current, {
        ...selectedResult(current),
        requestFingerprint: "p10b-live-synthesis-intent-stale",
      }),
    ).toThrow(expect.objectContaining({ code: "stale-authority" }));
  });

  it("binds advertised options exactly and preserves their seeds, selections, and executions", () => {
    const current = request(null);
    const firstIndex = 0;
    const secondIndex = 1;
    const firstOption = current.executableIntents[firstIndex];
    const secondOption = current.executableIntents[secondIndex];
    const first = validateP10bLiveSynthesisIntentProviderResult(
      current,
      selectedResult(current, firstIndex),
    );
    const second = validateP10bLiveSynthesisIntentProviderResult(
      current,
      selectedResult(current, secondIndex),
    );

    expect(first).toMatchObject({
      executableIntentId: firstOption.intentId,
      executableIntentFingerprint: firstOption.executableIntentFingerprint,
      expectedExecutionFingerprint: firstOption.expectedExecutionFingerprint,
      directionRequest: {
        directionId: firstOption.directionId,
        characteristics: firstOption.characteristics,
      },
    });
    expect(second.directionRequest.characteristics).toEqual(secondOption.characteristics);
    expect(second.directionRequest.directionId).not.toBe(first.directionRequest.directionId);
    expect(second.directionRequest.deterministicSeed).not.toBe(
      first.directionRequest.deterministicSeed,
    );

    const firstExecution = executeCoordinatedDirection({
      ...executionAuthority,
      directionRequest: first.directionRequest,
    });
    const secondExecution = executeCoordinatedDirection({
      ...executionAuthority,
      directionRequest: second.directionRequest,
    });
    expect(p10bLiveSynthesisExecutableResultFingerprint(firstExecution)).toBe(
      first.expectedExecutionFingerprint,
    );
    expect(p10bLiveSynthesisExecutableResultFingerprint(secondExecution)).toBe(
      second.expectedExecutionFingerprint,
    );
    expect(secondExecution.diversity.structuralFingerprint).not.toBe(
      firstExecution.diversity.structuralFingerprint,
    );
  });

  it("rejects stale intent fingerprints and unadvertised intent identities", () => {
    const current = request(null);
    expect(() =>
      validateP10bLiveSynthesisIntentProviderResult(current, {
        ...selectedResult(current),
        executableIntentFingerprint: "p10b-live-executable-intent-stale",
      }),
    ).toThrow(expect.objectContaining({ code: "stale-authority" }));
    expect(() =>
      validateP10bLiveSynthesisIntentProviderResult(current, {
        ...selectedResult(current),
        executableIntentId: "coordinated-executable-intent-unadvertised",
      }),
    ).toThrow(expect.objectContaining({ code: "unsupported-selection" }));
  });

  it("uses a closed output schema and rejects old posture, layout, code, and commerce fields", () => {
    const current = request(null);
    expect(() =>
      assertOpenAiStrictSchemaIsClosed(openAiP10bLiveSynthesisIntentOutputSchema),
    ).not.toThrow();
    expect(openAiP10bLiveSynthesisIntentOutputSchema).toMatchObject({
      additionalProperties: false,
    });
    const base = selectedResult(current);
    for (const forbidden of [
      {
        directionId: "premium-editorial",
        narrativePosture: "story-led",
        merchandisingPosture: "curated",
        informationDensityPosture: "balanced",
        artDirectionPosture: "editorial",
        responsiveMode: "content-first",
      },
      { homepageProfileId: "homepage-invented" },
      { componentIds: ["arbitrary-component"] },
      { sectionTree: [{ type: "hero" }] },
      { jsx: "<Hero />" },
      { css: ".hero { display: none; }" },
      { price: 1 },
    ]) {
      expect(() =>
        validateP10bLiveSynthesisIntentProviderResult(current, { ...base, ...forbidden }),
      ).toThrow(expect.objectContaining({ code: "malformed-response" }));
    }
  });

  it("makes exactly one non-stored structured transport call with retries disabled", async () => {
    const current = request(null);
    const telemetry = { record: vi.fn<(event: OpenAiProviderTelemetryEvent) => void>() };
    const transport = new RecordingTransport(() => Promise.resolve(completedResponse(current)));
    const selected = await provider(transport, telemetry).selectIntent(current);

    expect(selected).toEqual(selectedResult(current));
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]).toMatchObject({
      request: {
        model: "p10b16l-test-model",
        store: false,
        text: { format: { type: "json_schema", strict: true } },
      },
      options: { maxRetries: 0, timeout: 4_000 },
    });
    expect(buildOpenAiP10bLiveSynthesisIntentRequest(current, "p10b16l-test-model")).toEqual(
      transport.calls[0]?.request,
    );
    expect(telemetry.record).toHaveBeenCalledOnce();
    const telemetryEvent = telemetry.record.mock.calls[0]?.[0];
    expect(telemetryEvent).toMatchObject({
      providerId: "openai",
      modelId: "p10b16l-test-model",
      operation: "completeStorefrontSynthesisIntent",
      outcome: "success",
      totalTokens: 100,
    });
    expect(telemetryEvent?.providerRequestId).toMatch(/^openai-response-v1_/);
    expect(JSON.stringify(telemetry.record.mock.calls)).not.toContain("resp_p10b16l_safe");
    expect(JSON.stringify(telemetry.record.mock.calls)).not.toContain(current.merchantInstruction);
  });

  it("maps transport, refusal, and malformed response failures without exposing raw content", async () => {
    const current = request(null);
    const secret = "raw-provider-secret-must-not-escape";
    const cases: Array<{ response: () => Promise<unknown>; code: string; outcome: string }> = [
      {
        response: () => Promise.reject(new Error(secret)),
        code: "provider-unavailable",
        outcome: "unexpectedProviderFailure",
      },
      {
        response: () =>
          Promise.resolve(
            completedResponse(current, {
              output: [{ type: "message", content: [{ type: "refusal", refusal: secret }] }],
              output_text: "",
            }),
          ),
        code: "provider-refusal",
        outcome: "providerRefusal",
      },
      {
        response: () =>
          Promise.resolve(completedResponse(current, { output_text: `{"raw":"${secret}"}` })),
        code: "malformed-response",
        outcome: "malformedResponse",
      },
    ];

    for (const entry of cases) {
      const telemetry = { record: vi.fn<(event: OpenAiProviderTelemetryEvent) => void>() };
      const transport = new RecordingTransport(entry.response);
      let failure: unknown;
      try {
        await provider(transport, telemetry).selectIntent(current);
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({ code: entry.code });
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).not.toContain(secret);
      expect(transport.calls).toHaveLength(1);
      expect(telemetry.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: entry.outcome }),
      );
      expect(JSON.stringify(telemetry.record.mock.calls)).not.toContain(secret);
    }
  });

  it("requires explicit eligible OpenAI configuration and never falls back", async () => {
    for (const [environment, category] of [
      [{}, "provider-not-openai"],
      [{ VESKIFY_AI_PROVIDER: "mock" }, "provider-not-openai"],
      [{ VESKIFY_AI_PROVIDER: "openai" }, "credentials-unavailable"],
      [
        {
          VESKIFY_AI_PROVIDER: "openai",
          OPENAI_API_KEY: "test-only-placeholder",
          VESKIFY_OPENAI_MODEL: "unsafe model\nidentifier",
        },
        "model-identity-unavailable",
      ],
      [
        {
          VESKIFY_AI_PROVIDER: "openai",
          OPENAI_API_KEY: "test-only-placeholder",
          VESKIFY_OPENAI_TIMEOUT_MS: "10",
        },
        "invalid-timeout",
      ],
    ] as const) {
      const configured = selectServerP10bLiveSynthesisIntentProviderConfiguration({ environment });
      expect(configured).toMatchObject({ category, modelId: null });
      expect(configured.provider.id).toBe("openai-p10b-complete-storefront-synthesis-intent");
      await expect(configured.provider.selectIntent(request(null))).rejects.toMatchObject({
        code: "credentials-unavailable",
      });
    }

    expect(
      selectServerP10bLiveSynthesisIntentProviderConfiguration({
        environment: {
          VESKIFY_AI_PROVIDER: "openai",
          OPENAI_API_KEY: "test-only-placeholder",
          VESKIFY_OPENAI_MODEL: "p10b16l-eligible-test-model",
        },
      }),
    ).toMatchObject({
      category: "eligible",
      modelId: "p10b16l-eligible-test-model",
      provider: {
        id: "openai-p10b-complete-storefront-synthesis-intent",
        modelId: "p10b16l-eligible-test-model",
      },
    });
  });
});
