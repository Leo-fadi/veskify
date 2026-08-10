// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createP10bLiveSynthesisIntentProviderRequest,
  p10bLiveSynthesisIntentProviderRequestSchema,
  validateP10bLiveSynthesisIntentProviderResult,
  type P10bLiveSynthesisIntentProviderRequest,
} from "@/application/bounded-storefront-synthesis/live-provider-acceptance";
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
import { canonicalValueFingerprint } from "@/domain/storefront";

function request(
  requestedDirectionId: "premium-editorial" | "modern-technical" | "minimal-commerce" | null,
) {
  return createP10bLiveSynthesisIntentProviderRequest({
    merchantInstruction:
      requestedDirectionId === null
        ? "Create a complete storefront with a coherent direction for this merchant."
        : `Create a ${requestedDirectionId} complete storefront.`,
    requestedDirectionId,
    merchantContext: {
      businessName: "Karvonen",
      shortDescription: "A Finnish jewellery merchant with an approved factual brief.",
      industry: "jewellery",
      targetCustomer: "Customers choosing lasting Finnish jewellery.",
      primaryMarket: "Finland",
      enabledLocales: ["en", "fi"],
    },
    catalogueCharacteristics: {
      productCount: 12,
      collectionCount: 3,
      configurableProductCount: 2,
      optionGroupCount: 5,
      productsWithMultipleMedia: 9,
      productsWithoutPrice: 0,
      canonicalCommerceFingerprint: "commerce-p10b16l-test",
    },
    evidenceRichness: {
      approvedBriefRevision: 1,
      approvedFactFamilies: ["about", "contact", "faq"],
      approvedFactCount: 8,
    },
    approvedAssetPosture: {
      approvedAssetCount: 1,
      approvedRoles: ["logo"],
      editorialMediaAvailable: false,
    },
    currentAuthorityFingerprint: "p10b16l-current-authority-test",
  });
}

function completedResponse(
  providerRequest: P10bLiveSynthesisIntentProviderRequest,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "resp_p10b16l_safe",
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: "structured" }] }],
    output_text: JSON.stringify({
      requestFingerprint: providerRequest.requestFingerprint,
      directionId: providerRequest.directionOptions[0]?.id,
      narrativePosture: null,
      merchandisingPosture: null,
      informationDensityPosture: null,
      artDirectionPosture: null,
      responsiveMode: null,
    }),
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
  it("exposes all current P10B-16 directions generally and only the exact named direction", () => {
    const general = request(null);
    expect(general.directionOptions.map(({ id }) => id)).toEqual([
      "premium-editorial",
      "modern-technical",
      "minimal-commerce",
    ]);
    expect(general.directionOptions.every(({ authorityFingerprint }) => authorityFingerprint)).toBe(
      true,
    );
    expect(JSON.stringify(general)).not.toMatch(
      /premiumEditorial|modernTechnical|warmApproachable|homepageProfileId|componentSelections/,
    );

    for (const directionId of [
      "premium-editorial",
      "modern-technical",
      "minimal-commerce",
    ] as const) {
      const named = request(directionId);
      expect(named.requestedDirectionId).toBe(directionId);
      expect(named.directionOptions.map(({ id }) => id)).toEqual([directionId]);
    }
  });

  it("binds the request and result to exact current authority and validated bounded characteristics", () => {
    const current = request("modern-technical");
    expect(p10bLiveSynthesisIntentProviderRequestSchema.safeParse(current).success).toBe(true);
    expect(
      p10bLiveSynthesisIntentProviderRequestSchema.safeParse({
        ...current,
        currentAuthorityFingerprint: "changed-current-authority",
      }).success,
    ).toBe(false);

    const providerResult = {
      requestFingerprint: current.requestFingerprint,
      directionId: "modern-technical",
      narrativePosture: "catalogue-dense",
      merchandisingPosture: "dense",
      informationDensityPosture: "compact",
      artDirectionPosture: "contained",
      responsiveMode: "commerce-first",
    } as const;
    const result = validateP10bLiveSynthesisIntentProviderResult(current, providerResult);
    expect(result).toEqual({
      directionId: "modern-technical",
      deterministicSeed: `p10b-live-${canonicalValueFingerprint(providerResult)}`,
      characteristics: {
        narrativePosture: "catalogue-dense",
        merchandisingPosture: "dense",
        informationDensityPosture: "compact",
        artDirectionPosture: "contained",
        responsiveMode: "commerce-first",
      },
    });
    const differentlyNarrowed = validateP10bLiveSynthesisIntentProviderResult(current, {
      ...providerResult,
      merchandisingPosture: null,
      informationDensityPosture: null,
      artDirectionPosture: null,
      responsiveMode: null,
    });
    expect(differentlyNarrowed.deterministicSeed).not.toBe(result.deterministicSeed);

    expect(() =>
      validateP10bLiveSynthesisIntentProviderResult(current, {
        requestFingerprint: current.requestFingerprint,
        directionId: "modern-technical",
        narrativePosture: null,
        merchandisingPosture: null,
        informationDensityPosture: null,
        artDirectionPosture: null,
        responsiveMode: null,
      }),
    ).toThrow(expect.objectContaining({ code: "unsupported-selection" }));

    expect(() =>
      validateP10bLiveSynthesisIntentProviderResult(current, {
        requestFingerprint: "p10b-live-synthesis-intent-stale",
        directionId: "modern-technical",
        narrativePosture: null,
        merchandisingPosture: null,
        informationDensityPosture: null,
        artDirectionPosture: null,
        responsiveMode: null,
      }),
    ).toThrow(expect.objectContaining({ code: "stale-authority" }));
    expect(() =>
      validateP10bLiveSynthesisIntentProviderResult(current, {
        requestFingerprint: current.requestFingerprint,
        directionId: "modern-technical",
        narrativePosture: "story-led",
        merchandisingPosture: null,
        informationDensityPosture: null,
        artDirectionPosture: null,
        responsiveMode: null,
      }),
    ).toThrow(expect.objectContaining({ code: "unsupported-selection" }));
  });

  it("uses a closed output schema and rejects unknown layout, code, and commerce fields", () => {
    const current = request("premium-editorial");
    expect(() =>
      assertOpenAiStrictSchemaIsClosed(openAiP10bLiveSynthesisIntentOutputSchema),
    ).not.toThrow();
    expect(openAiP10bLiveSynthesisIntentOutputSchema).toMatchObject({
      additionalProperties: false,
    });
    const base = {
      requestFingerprint: current.requestFingerprint,
      directionId: "premium-editorial",
      narrativePosture: null,
      merchandisingPosture: null,
      informationDensityPosture: null,
      artDirectionPosture: null,
      responsiveMode: null,
    };
    for (const forbidden of [
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
    const current = request("minimal-commerce");
    const telemetry = { record: vi.fn<(event: OpenAiProviderTelemetryEvent) => void>() };
    const transport = new RecordingTransport(() => Promise.resolve(completedResponse(current)));
    const selected = await provider(transport, telemetry).selectIntent(current);

    expect(selected).toMatchObject({
      requestFingerprint: current.requestFingerprint,
      directionId: "minimal-commerce",
    });
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
    expect(telemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "openai",
        modelId: "p10b16l-test-model",
        operation: "completeStorefrontSynthesisIntent",
        outcome: "success",
        providerRequestId: "resp_p10b16l_safe",
        totalTokens: 100,
      }),
    );
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
