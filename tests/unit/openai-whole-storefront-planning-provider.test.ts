// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildWholeStorefrontPlanningProviderRequest,
  createDeterministicWholeStorefrontPlanningProvider,
  createWholeStorefrontRecipeContext,
  requestWholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningProvider,
} from "@/application/whole-storefront-generation-plan";
import {
  createApprovedGenerationAssetContextFingerprint,
  planRegisteredTokenRefinement,
} from "@/application/ai-storefront-generation";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicSeed } from "@/data/seed";
import { sourceEvidenceSchema, sourceReferenceSchema } from "@/domain/source-discovery";
import {
  assertOpenAiStrictSchemaIsClosed,
  buildOpenAiWholeStorefrontDirectionRequest,
  buildOpenAiWholeStorefrontDirectionInput,
  openAiWholeStorefrontDirectionOutputSchema,
  OpenAiWholeStorefrontPlanningProvider,
  type OpenAiResponseRequestOptions,
  type OpenAiResponsesRequest,
} from "@/integrations/ai/openai";
import {
  selectServerWholeStorefrontPlanningProvider,
  selectServerWholeStorefrontPlanningProviderConfiguration,
} from "@/integrations/ai/openai/whole-storefront-planning-client.server";

const now = "2026-07-24T09:00:00.000Z";

function materialEvidence() {
  const source = sourceReferenceSchema.parse({
    id: "source_openai_whole_storefront",
    sourceType: "deterministic-fixture",
    url: "https://merchant.example/private-store",
    normalizedOrigin: "https://merchant.example",
    requestedLocale: "en",
    discoveredAt: now,
    allowedDiscoveryPolicy: {
      mode: "deterministic",
      maxPages: 5,
      maxAssets: 10,
      followSameOriginOnly: true,
    },
    status: "complete",
    warnings: [],
    failure: null,
  });
  const evidence = sourceEvidenceSchema.parse({
    id: "evidence_openai_whole_storefront",
    kind: "page-identity",
    provenance: { sourceReferenceId: source.id, sourceUrl: source.url, observedAt: now },
    sourceUrl: source.url,
    confidence: 1,
    observedValue: { title: "Private merchant identity" },
    extractionMethod: "deterministic-test-fixture",
    locale: "en",
    warnings: [],
    uncertainty: { isUncertain: false, reason: null },
  });
  return {
    sourceReferences: [source],
    evidence: [evidence],
    assetCandidates: [],
    reconciliation: null,
  };
}

function planningInput() {
  const brief = approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: "brief_openai_whole_storefront",
      now,
      businessIdentity: { businessName: "Private merchant" },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
      sourceReferenceIds: ["source_openai_whole_storefront"],
      sourceEvidenceIds: ["evidence_openai_whole_storefront"],
      materialEvidence: materialEvidence(),
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      pagePlan: { pageTypes: ["home", "collection", "product"] },
      approvedBrandDirection: {
        logoAssetRef: { id: "asset_logo", label: "Merchant logo" },
        supportingImageAssetRefs: [],
        preferredBrandColours: ["#123456"],
        typographyDirection: "serif-led",
        visualStyleDirection: "editorial",
        imageryDirection: "studio",
        toneKeywords: ["warm"],
      },
    }),
    { actorId: "merchant_owner", approvedAt: now },
  );
  const assetContextValue = {
    briefId: brief.id,
    briefRevision: brief.revision,
    approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint!,
    assetReviewFingerprint: null,
    assets: [],
  };
  return {
    brief,
    project: {
      id: aurumNordicSeed.project.id,
      revision: aurumNordicSeed.project.revision,
      enabledLocales: ["en", "fi"],
    },
    draft: structuredClone(aurumNordicSeed.draftSnapshot),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    componentDefinitions: structuredClone(veskifyComponentDefinitionsV2),
    recipeContext: createWholeStorefrontRecipeContext(),
    approvedAssetContext: {
      ...assetContextValue,
      fingerprint: createApprovedGenerationAssetContextFingerprint(assetContextValue),
    },
    requiredAssetPlacements: [],
  };
}

function completedResponse(selection: Record<string, unknown>) {
  return {
    id: "resp_whole_storefront_safe",
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: "structured" }] }],
    output_text: JSON.stringify(selection),
  };
}

class RecordingTransport {
  calls: Array<{ request: OpenAiResponsesRequest; options: OpenAiResponseRequestOptions }> = [];

  constructor(readonly response: () => Promise<unknown>) {}

  create(request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) {
    this.calls.push({ request, options });
    return this.response();
  }
}

function provider(transport: RecordingTransport, telemetry?: { record: (event: unknown) => void }) {
  return new OpenAiWholeStorefrontPlanningProvider({
    responses: transport,
    model: "configured-test-model",
    timeoutMs: 1_000,
    telemetry,
  });
}

describe("P8-03 OpenAI whole-storefront planning provider", () => {
  it("projects only the safe trusted provider and model identity for controlled acceptance", () => {
    expect(
      selectServerWholeStorefrontPlanningProviderConfiguration({ environment: {} }),
    ).toMatchObject({
      provider: { id: "deterministic-whole-storefront-planning" },
      modelId: null,
    });
    expect(
      selectServerWholeStorefrontPlanningProviderConfiguration({
        environment: { VESKIFY_AI_PROVIDER: "openai" },
      }),
    ).toMatchObject({
      provider: { id: "openai-whole-storefront-planning" },
      modelId: null,
    });
    expect(
      selectServerWholeStorefrontPlanningProviderConfiguration({
        environment: {
          VESKIFY_AI_PROVIDER: "openai",
          OPENAI_API_KEY: "test-only-placeholder",
          VESKIFY_OPENAI_MODEL: "configured-test-model",
        },
      }),
    ).toMatchObject({
      provider: { id: "openai-whole-storefront-planning" },
      modelId: "configured-test-model",
    });
  });

  it("builds a sanitized registry-aware request with the required planning constraints", () => {
    const request = buildWholeStorefrontPlanningProviderRequest(planningInput());
    const serialized = JSON.stringify(request);

    expect(request.target.pages.map((page) => page.role)).toEqual(
      expect.arrayContaining(["homepage", "collection-template", "product-template"]),
    );
    expect(request.registry.some((definition) => definition.type === "dynamicProductDetail")).toBe(
      true,
    );
    expect(request.canonicalCommerce.productIds).toContain("product_aurora_ring_585");
    expect(request.approvedAssets.contextFingerprint).toMatch(/^approved-generation-assets-/);
    expect(request.protectedInstructions.join(" ")).toMatch(/HTML, CSS, executable code/i);
    expect(serialized).not.toContain("merchant.example");
    expect(serialized).not.toContain("Private merchant identity");
    expect(serialized).not.toContain("https://");
  });

  it("uses a closed direction DTO and materializes the canonical plan only on the server", async () => {
    const input = planningInput();
    const request = buildWholeStorefrontPlanningProviderRequest(input);
    const telemetry = { record: vi.fn() };
    const transport = new RecordingTransport(() =>
      Promise.resolve(
        completedResponse({
          requestFingerprint: request.requestFingerprint,
          selectionId: "warmApproachable",
        }),
      ),
    );

    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: provider(transport, telemetry),
        input,
        currentInput: () => input,
      }),
    ).resolves.toEqual(request.planForDirection("warmApproachable"));
    expect(transport.calls[0]?.request).toMatchObject({
      model: "configured-test-model",
      store: false,
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(transport.calls[0]?.request.text.format.name).toBe("veskify_whole_storefront_direction");
    expect(buildOpenAiWholeStorefrontDirectionRequest(request, "configured-test-model").input).toBe(
      transport.calls[0]?.request.input,
    );
    expect(buildOpenAiWholeStorefrontDirectionInput(request)).not.toContain("expectedPlan");
    expect(buildOpenAiWholeStorefrontDirectionInput(request)).not.toContain(
      request.expectedPlan.fingerprint,
    );
    expect(() =>
      assertOpenAiStrictSchemaIsClosed(openAiWholeStorefrontDirectionOutputSchema),
    ).not.toThrow();
    expect(JSON.stringify(openAiWholeStorefrontDirectionOutputSchema)).not.toMatch(
      /"additionalProperties"\s*:\s*\{/,
    );
    expect(telemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "openai",
        modelId: "configured-test-model",
        operation: "wholeStorefrontPlanning",
        outcome: "success",
        providerRequestId: "resp_whole_storefront_safe",
      }),
    );
    expect(JSON.stringify(telemetry.record.mock.calls)).not.toMatch(
      /merchant\.example|Private merchant/i,
    );
  });

  it("selects the validated token refinement without choosing a structural archetype", async () => {
    const input = planningInput();
    const tokenRefinement = planRegisteredTokenRefinement(
      "Use primary forest green, background warm off-white, and Georgia headings with Inter body text. Preserve layouts, sections, products, and images.",
      input.draft.brandSystem,
    );
    expect(tokenRefinement).not.toBeNull();
    const request = buildWholeStorefrontPlanningProviderRequest(
      input,
      "Use primary forest green, background warm off-white, and Georgia headings with Inter body text. Preserve layouts, sections, products, and images.",
      tokenRefinement,
    );
    const transport = new RecordingTransport(() =>
      Promise.resolve(
        completedResponse({
          requestFingerprint: request.requestFingerprint,
          selectionId: "validatedTokenRefinement",
        }),
      ),
    );

    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: provider(transport),
        input,
        currentInput: () => input,
        tokenRefinementPlan: tokenRefinement,
      }),
    ).resolves.toEqual(request.planForTokenRefinement());
    expect(request.requestClass).toBe("tokenOnlyRefinement");
    expect(request.expectedPlan.pagePlans.every((page) => page.disposition === "retained")).toBe(
      true,
    );
    expect(transport.calls).toHaveLength(1);
  });

  it("passes URL, HTML-like, and JSON-like merchant prose only through untrusted user content", async () => {
    const input = planningInput();
    const merchantInstruction =
      'Use https://merchant.example/reference as visual context; keep <section>craft</section> literal and interpret {"mood":"warm"} only as prose.';
    const request = buildWholeStorefrontPlanningProviderRequest(input, merchantInstruction);
    const transport = new RecordingTransport(() =>
      Promise.resolve(
        completedResponse({
          requestFingerprint: request.requestFingerprint,
          selectionId: "premiumEditorial",
        }),
      ),
    );

    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: provider(transport),
        input,
        currentInput: () => input,
        merchantInstruction,
      }),
    ).resolves.toEqual(request.planForDirection("premiumEditorial"));

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.request.input).toContain("https://merchant.example/reference");
    expect(transport.calls[0]?.request.input).toContain("<section>craft</section>");
    expect(transport.calls[0]?.request.input).toContain('{\\"mood\\":\\"warm\\"}');
    expect(transport.calls[0]?.request.instructions).not.toContain(merchantInstruction);
  });

  it("rejects an unregistered direction during DTO-to-canonical validation", async () => {
    const input = planningInput();
    const request = buildWholeStorefrontPlanningProviderRequest(input);
    const dto = {
      requestFingerprint: request.requestFingerprint,
      selectionId: "inventedDirection",
    };

    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: provider(new RecordingTransport(() => Promise.resolve(completedResponse(dto)))),
        input,
        currentInput: () => input,
      }),
    ).rejects.toMatchObject({ code: "malformed-structured-response" });
  });

  it.each([
    ["components", []],
    ["variants", {}],
    ["props", {}],
    ["recipes", []],
    ["pageGraph", { pages: [] }],
  ])("rejects provider-owned structural field %s", async (field, value) => {
    const input = planningInput();
    const request = buildWholeStorefrontPlanningProviderRequest(input);
    const dto = {
      requestFingerprint: request.requestFingerprint,
      selectionId: "modernTechnical",
      [field]: value,
    };

    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: provider(new RecordingTransport(() => Promise.resolve(completedResponse(dto)))),
        input,
        currentInput: () => input,
      }),
    ).rejects.toMatchObject({ code: "malformed-structured-response" });
  });

  it("rejects a plan when current fingerprints or revisions are stale", async () => {
    const input = planningInput();
    const request = buildWholeStorefrontPlanningProviderRequest(input);
    const current = structuredClone(input);
    current.project.revision += 1;

    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: provider(
          new RecordingTransport(() =>
            Promise.resolve(
              completedResponse({
                requestFingerprint: request.requestFingerprint,
                selectionId: "warmApproachable",
              }),
            ),
          ),
        ),
        input,
        currentInput: () => current,
      }),
    ).rejects.toMatchObject({ code: "stale-result" });
  });

  it("records safe categorized telemetry for transport, malformed-output, and validation failures", async () => {
    const input = planningInput();
    const request = buildWholeStorefrontPlanningProviderRequest(input);
    const telemetry = { record: vi.fn() };
    const incapable: WholeStorefrontPlanningProvider = {
      id: "incapable",
      capabilities: {
        wholeStorefrontPlanning: false,
        structuredPlanOutput: false,
        approvedAssetReferences: false,
      },
      createPlan: vi.fn(),
    };
    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: incapable,
        input,
        currentInput: () => input,
      }),
    ).rejects.toMatchObject({ code: "provider-incapable" });
    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: provider(
          new RecordingTransport(() => Promise.reject(new Error("provider secret"))),
          telemetry,
        ),
        input,
        currentInput: () => input,
      }),
    ).rejects.toMatchObject({ code: "provider-unavailable" });
    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: provider(
          new RecordingTransport(() =>
            Promise.resolve({
              id: "resp_malformed",
              status: "completed",
              output: [],
              output_text: "not-json",
            }),
          ),
          telemetry,
        ),
        input,
        currentInput: () => input,
      }),
    ).rejects.toMatchObject({ code: "malformed-structured-response" });
    const invalidDto = {
      requestFingerprint: request.requestFingerprint,
      selectionId: "unregisteredDirection",
    };
    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: provider(
          new RecordingTransport(() => Promise.resolve(completedResponse(invalidDto))),
          telemetry,
        ),
        input,
        currentInput: () => input,
      }),
    ).rejects.toMatchObject({ code: "malformed-structured-response" });
    expect(telemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "wholeStorefrontPlanning",
        outcome: "unexpectedProviderFailure",
      }),
    );
    expect(telemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "wholeStorefrontPlanning",
        outcome: "malformedResponse",
      }),
    );
    expect(telemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "wholeStorefrontPlanning",
        outcome: "validationRejected",
      }),
    );
    expect(JSON.stringify(telemetry.record.mock.calls)).not.toMatch(
      /provider secret|merchant\.example/i,
    );
    await expect(
      requestWholeStorefrontGenerationPlan({
        provider: selectServerWholeStorefrontPlanningProvider({
          environment: { VESKIFY_AI_PROVIDER: "openai" },
        }),
        input,
        currentInput: () => input,
      }),
    ).rejects.toMatchObject({ code: "credentials-unavailable" });
  });

  it("keeps deterministic planning credential-free and leaves canonical snapshots unchanged", async () => {
    const input = planningInput();
    const beforeInput = structuredClone(input);
    const draftBefore = structuredClone(aurumNordicSeed.draftSnapshot);
    const publishedBefore = structuredClone(aurumNordicSeed.publishedSnapshot);
    const result = await requestWholeStorefrontGenerationPlan({
      provider: createDeterministicWholeStorefrontPlanningProvider(),
      input,
      currentInput: () => input,
    });

    expect(result.requestFingerprint).toBe(
      buildWholeStorefrontPlanningProviderRequest(input).requestFingerprint,
    );
    expect(input).toEqual(beforeInput);
    expect(aurumNordicSeed.draftSnapshot).toEqual(draftBefore);
    expect(aurumNordicSeed.publishedSnapshot).toEqual(publishedBefore);
  });
});
