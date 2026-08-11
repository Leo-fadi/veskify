// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PROMPTED_STOREFRONT_CAPABILITY_PROJECTION_VERSION,
  PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
  promptedStorefrontCapabilityReferenceAuthorityFingerprint,
  promptedStorefrontCapabilityProjectionFingerprint,
  promptedStorefrontCapabilityProjectionSchema,
  promptedStorefrontDesignIntentFingerprint,
  promptedStorefrontDesignRequestFingerprint,
  promptedStorefrontDesignRequestV2Schema,
  promptedStorefrontPromptFingerprint,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCapabilityAvailability,
  type PromptedStorefrontCapabilityDimension,
  type PromptedStorefrontCapabilityEntry,
  type PromptedStorefrontCapabilityIntentRole,
  type PromptedStorefrontCurrentAuthorityIdentity,
  type PromptedStorefrontDesignRequestV2,
  type PromptedStorefrontPreferenceSemantics,
} from "@/application/prompted-storefront-design-intent";
import {
  assertOpenAiStrictSchemaIsClosed,
  type OpenAiResponseRequestOptions,
  type OpenAiResponsesRequest,
} from "@/integrations/ai/openai/contract";
import {
  buildOpenAiPromptedStorefrontDesignIntentV2Request,
  openAiPromptedStorefrontDesignIntentV2OutputSchema,
  OpenAiPromptedStorefrontDesignIntentV2Provider,
  type PromptedStorefrontDesignIntentProviderTelemetryEvent,
} from "@/integrations/ai/openai/prompted-storefront-design-intent-v2-provider.server";
import { selectServerPromptedStorefrontDesignIntentProviderConfiguration } from "@/integrations/ai/openai/prompted-storefront-design-intent-v2-client.server";

type CapabilityInput = Readonly<{
  key: string;
  dimension: PromptedStorefrontCapabilityDimension;
  availability?: PromptedStorefrontCapabilityAvailability;
  selection?: PromptedStorefrontCapabilityEntry["selection"];
  productTypeKey?: boolean;
  intentRoles?: readonly PromptedStorefrontCapabilityIntentRole[];
}>;

const capabilityInputs: readonly CapabilityInput[] = [
  { key: "designDna.typographyPairing.serifLed", dimension: "design-dna.typography-pairing" },
  { key: "sharedFrame.profile.editorial", dimension: "shared-frame.profile" },
  { key: "homepage.profile.editorial", dimension: "homepage.profile" },
  { key: "homepage.role.brandStory", dimension: "homepage.narrative-role" },
  { key: "homepage.family.hero", dimension: "homepage.component-family" },
  { key: "homepage.variant.heroSplit", dimension: "homepage.meaningful-variant" },
  {
    key: "homepage.sectionCount.commercial",
    dimension: "homepage.section-count",
    selection: { kind: "number", minimum: 3, maximum: 12 },
  },
  { key: "homepage.rhythm.considered", dimension: "homepage.section-rhythm" },
  { key: "homepage.assetRole.editorial", dimension: "homepage.asset-role" },
  { key: "collectionSearch.archetype.editorial", dimension: "collection-search.archetype" },
  { key: "collectionSearch.discovery.guided", dimension: "collection-search.discovery" },
  { key: "collectionSearch.density.balanced", dimension: "collection-search.density" },
  { key: "collectionSearch.filterSort.visible", dimension: "collection-search.filter-sort" },
  {
    key: "collectionSearch.childCollection.contextual",
    dimension: "collection-search.child-collection",
  },
  {
    key: "collectionSearch.merchandising.curated",
    dimension: "collection-search.merchandising",
  },
  { key: "collectionSearch.productCard.editorial", dimension: "collection-search.product-card" },
  {
    key: "collectionSearch.search.registeredFailClosed",
    dimension: "collection-search.search-relationship",
    availability: "registered-fail-closed",
  },
  {
    key: "pdp.archetype.standard",
    dimension: "pdp.archetype",
    intentRoles: ["pdp-standard-simple"],
  },
  {
    key: "pdp.archetype.configurable",
    dimension: "pdp.archetype",
    intentRoles: ["pdp-configurable"],
  },
  {
    key: "pdp.archetype.gallery",
    dimension: "pdp.archetype",
    intentRoles: ["pdp-gallery-led"],
  },
  {
    key: "pdp.archetype.highConsideration",
    dimension: "pdp.archetype",
    intentRoles: ["pdp-high-consideration"],
  },
  {
    key: "pdp.archetype.genericFallback",
    dimension: "pdp.archetype",
    intentRoles: ["pdp-generic-fallback"],
  },
  {
    key: "pdp.productType.ring",
    dimension: "pdp.product-type",
    productTypeKey: true,
  },
  { key: "pdp.options.configurable", dimension: "pdp.option-complexity" },
  { key: "pdp.media.gallery", dimension: "pdp.media" },
  { key: "pdp.purchaseHierarchy.considered", dimension: "pdp.purchase-hierarchy" },
  { key: "pdp.relatedMerchandising.curated", dimension: "pdp.related-merchandising" },
  { key: "pdp.productCard.informationLed", dimension: "pdp.product-card" },
  { key: "contentSupport.profile.about", dimension: "content-support.profile" },
  {
    key: "contentSupport.narrativePurpose.brandStory",
    dimension: "content-support.narrative-purpose",
  },
  { key: "component.family.hero", dimension: "component.family" },
  { key: "component.variant.heroSplit", dimension: "component.meaningful-variant" },
  {
    key: "component.parameter.density",
    dimension: "component.bounded-parameter",
    selection: { kind: "enum", allowedValues: ["balanced", "compact"] },
  },
  { key: "responsive.posture.contentFirst", dimension: "responsive.posture" },
  { key: "responsive.mobileHierarchy.storyFirst", dimension: "responsive.mobile-hierarchy" },
  { key: "responsive.density.progressive", dimension: "responsive.density" },
  { key: "responsive.image.editorial", dimension: "responsive.image" },
  { key: "responsive.crop.focal", dimension: "responsive.crop" },
  { key: "responsive.overlay.subtle", dimension: "responsive.overlay" },
  { key: "responsive.assetRole.editorial", dimension: "responsive.asset-role" },
];

function capabilityAuthority(): PromptedStorefrontCapabilityAuthority {
  const capabilities = capabilityInputs
    .map((entry) => ({
      key: entry.key,
      dimension: entry.dimension,
      description: `Safe capability ${entry.key}.`,
      contexts: ["storefront"],
      availability: entry.availability ?? "available",
      requirements: [],
      selection: entry.selection ?? { kind: "capability" as const },
    }))
    .sort((left, right) =>
      `${left.dimension}:${left.key}`.localeCompare(`${right.dimension}:${right.key}`),
    );
  const projectionMaterial: Parameters<
    typeof promptedStorefrontCapabilityProjectionFingerprint
  >[0] = {
    version: PROMPTED_STOREFRONT_CAPABILITY_PROJECTION_VERSION,
    capabilities,
    search: {
      registration: "registered-presentation-authority",
      execution: "unavailable",
      behavior: "fail-closed",
      reason: "missing-canonical-search-results-adapter",
    },
  };
  const projection = promptedStorefrontCapabilityProjectionSchema.parse({
    ...projectionMaterial,
    fingerprint: promptedStorefrontCapabilityProjectionFingerprint(projectionMaterial),
  });
  const referencesByPreferenceKey = new Map(
    capabilityInputs.map((entry) => [
      entry.key,
      {
        key: entry.key,
        dimension: entry.dimension,
        availability: entry.availability ?? "available",
        authorityKind:
          entry.dimension === "pdp.product-type"
            ? ("catalogue" as const)
            : entry.dimension.startsWith("shared-frame")
              ? ("shared-frame" as const)
              : entry.dimension.startsWith("component")
                ? ("component-manifest" as const)
                : entry.dimension.startsWith("pdp") ||
                    entry.dimension.startsWith("collection-search")
                  ? ("dynamic-commerce" as const)
                  : ("commercial-grammar" as const),
        authorityId: `authority-${entry.key}`,
        authorityFingerprint: `authority-fingerprint-${entry.key}`,
        selection: entry.selection ?? { kind: "capability" as const },
        productTypeKey: entry.productTypeKey ?? false,
        ...(entry.intentRoles ? { intentRoles: [...entry.intentRoles] } : {}),
      },
    ]),
  );
  return { projection, referencesByPreferenceKey };
}

function currentAuthority(
  authority: PromptedStorefrontCapabilityAuthority,
): PromptedStorefrontCurrentAuthorityIdentity {
  return {
    projectId: "project_prompted_intent",
    projectRevision: 7,
    draftSnapshotId: "snapshot_prompted_intent",
    draftRevision: 11,
    storefrontSnapshotFingerprint: "storefront-snapshot-current",
    dynamicCommercePresentationFingerprint: "dynamic-commerce-current",
    capabilityManifestFingerprint: "component-capability-manifest-current",
    pageBlueprintAuthorityFingerprint: "page-blueprint-authority-current",
    designDnaAuthorityFingerprint: "design-dna-authority-current",
    approvedBriefFingerprint: "approved-brief-current",
    approvedBriefEvidenceFingerprint: "approved-brief-evidence-current",
    approvedAssetAuthorityFingerprint: "approved-assets-current",
    canonicalCommerceAuthorityFingerprint: "canonical-commerce-current",
    catalogueProjectionFingerprint: "catalogue-projection-current",
    capabilityProjectionFingerprint: authority.projection.fingerprint,
    capabilityReferenceAuthorityFingerprint:
      promptedStorefrontCapabilityReferenceAuthorityFingerprint(
        authority.referencesByPreferenceKey.values(),
      ),
  };
}

const exactMerchantPrompt =
  "  Build a composed editorial shop; keep this arbitrary spacing and punctuation exactly.  \n";

function requestFixture(authority = capabilityAuthority()): PromptedStorefrontDesignRequestV2 {
  const authorityIdentity = currentAuthority(authority);
  const material: Parameters<typeof promptedStorefrontDesignRequestFingerprint>[0] = {
    contractVersion: PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
    requestId: "prompted_request_exact_prompt",
    merchantPrompt: exactMerchantPrompt,
    promptFingerprint: promptedStorefrontPromptFingerprint(exactMerchantPrompt),
    currentAuthority: authorityIdentity,
    approvedMerchantContext: {
      businessName: "Nordic Atelier",
      industry: "Jewellery",
      approvedBrandSummary: "A restrained Nordic jewellery studio.",
      targetCustomer: "Design-conscious adults",
      primaryMarket: "Finland",
      approvedToneOrVisualPriorities: ["editorial", "considered"],
      supportedLocales: ["en", "fi"],
      excludedClaimsOrUnsupportedRequirements: ["No unsupported delivery guarantees"],
    },
    catalogueCharacteristics: {
      productCount: 12,
      collectionCount: 3,
      productTypes: [
        {
          productTypeKey: "pdp.productType.ring",
          safeLabel: "Ring",
          productCount: 12,
          simpleProductCount: 8,
          configurableProductCount: 4,
          optionGroupCountRange: { minimum: 0, maximum: 3 },
          mediaDepthRange: { minimum: 1, maximum: 5 },
          highConsiderationPresentationCount: 2,
        },
      ],
      simpleProductCount: 8,
      configurableProductCount: 4,
      optionGroupComplexity: { none: 8, one: 2, twoToThree: 2, fourOrMore: 0 },
      mediaDepth: { none: 0, one: 3, twoToThree: 7, fourOrMore: 2 },
      highConsiderationPresentationCount: 2,
      collectionMembershipSize: { minimum: 2, maximum: 8, averageRounded: 4 },
      collectionHierarchy: { depth: "unavailable", childCollections: "unavailable" },
    },
    evidenceAndAssets: {
      approvedEvidenceFamilies: ["brand-story"],
      approvedPresentationAssetRoles: ["editorial-image"],
      editorialOrBrandImageryAvailable: true,
      responsiveAssetTreatmentAvailable: true,
      evidenceDependentCapabilityKeys: [],
      unresolvedSafeOmissions: [],
    },
    capabilityProjection: authority.projection,
    priorDiversityEvidence: {
      recentAcceptedStructuralFingerprints: [],
      recentRejectedStructuralFingerprints: [],
      recentlyUsedPostureKeys: [],
      merchantAvoidancePreferenceKeys: [],
    },
  };
  return promptedStorefrontDesignRequestV2Schema.parse({
    ...material,
    requestFingerprint: promptedStorefrontDesignRequestFingerprint(material),
  });
}

function preference(
  key: string,
  dimension: PromptedStorefrontCapabilityDimension,
  semantics: PromptedStorefrontPreferenceSemantics = "soft",
) {
  return { key, dimension, semantics, rank: semantics === "soft" ? 1 : null };
}

function reference(key: string, dimension: PromptedStorefrontCapabilityDimension) {
  return { key, dimension };
}

function intentFixture(request: PromptedStorefrontDesignRequestV2) {
  const designDna = preference(
    "designDna.typographyPairing.serifLed",
    "design-dna.typography-pairing",
  );
  const frame = preference("sharedFrame.profile.editorial", "shared-frame.profile");
  const homepageProfile = preference("homepage.profile.editorial", "homepage.profile");
  const homepageRole = reference("homepage.role.brandStory", "homepage.narrative-role");
  const collectionArchetype = preference(
    "collectionSearch.archetype.editorial",
    "collection-search.archetype",
  );
  const pdpArchetype = preference("pdp.archetype.standard", "pdp.archetype");
  const configurablePdpArchetype = preference("pdp.archetype.configurable", "pdp.archetype");
  const galleryPdpArchetype = preference("pdp.archetype.gallery", "pdp.archetype");
  const highConsiderationPdpArchetype = preference(
    "pdp.archetype.highConsideration",
    "pdp.archetype",
  );
  const genericFallbackPdpArchetype = preference("pdp.archetype.genericFallback", "pdp.archetype");
  return {
    contractVersion: PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
    requestFingerprint: request.requestFingerprint,
    promptFingerprint: request.promptFingerprint,
    concept: {
      summary: "A restrained editorial commerce experience.",
      commercialPosture: "Premium and product-led",
      intendedCustomerExperience: "Calm discovery with confident purchase hierarchy.",
    },
    constraints: { hard: [], soft: [designDna], optional: [], avoid: [] },
    designDna: { preferences: [designDna] },
    sharedFrame: { preferences: [frame] },
    homepage: {
      profilePreferences: [homepageProfile],
      narrativeRoleSequence: [homepageRole],
      requiredRoles: [homepageRole],
      preferredRoles: [homepageRole],
      optionalRoles: [],
      avoidedRoles: [],
      componentFamilyPreferences: [preference("homepage.family.hero", "homepage.component-family")],
      meaningfulVariantPreferences: [
        preference("homepage.variant.heroSplit", "homepage.meaningful-variant"),
      ],
      sectionCount: {
        key: "homepage.sectionCount.commercial",
        dimension: "homepage.section-count" as const,
        minimum: 4,
        ideal: 6,
        maximum: 8,
      },
      sectionRhythmPreferences: [
        preference("homepage.rhythm.considered", "homepage.section-rhythm"),
      ],
      evidenceDependentOmission: "omit" as const,
      approvedAssetRolePreferences: [
        preference("homepage.assetRole.editorial", "homepage.asset-role"),
      ],
    },
    collectionSearch: {
      archetypePreferences: [collectionArchetype],
      discoveryPreferences: [
        preference("collectionSearch.discovery.guided", "collection-search.discovery"),
      ],
      densityPreferences: [
        preference("collectionSearch.density.balanced", "collection-search.density"),
      ],
      filterSortPreferences: [
        preference("collectionSearch.filterSort.visible", "collection-search.filter-sort"),
      ],
      childCollectionPreferences: [
        preference(
          "collectionSearch.childCollection.contextual",
          "collection-search.child-collection",
        ),
      ],
      merchandisingPreferences: [
        preference("collectionSearch.merchandising.curated", "collection-search.merchandising"),
      ],
      productCardPreferences: [
        preference("collectionSearch.productCard.editorial", "collection-search.product-card"),
      ],
      searchRelationshipPreferences: [
        preference(
          "collectionSearch.search.registeredFailClosed",
          "collection-search.search-relationship",
          "optional",
        ),
      ],
      searchExecutionExpectation: "registered-presentation-fail-closed-runtime" as const,
    },
    productDetail: {
      standardSimplePreferences: [pdpArchetype],
      configurablePreferences: [configurablePdpArchetype],
      galleryLedPreferences: [galleryPdpArchetype],
      highConsiderationPreferences: [highConsiderationPdpArchetype],
      genericFallbackPreferences: [genericFallbackPdpArchetype],
      productTypeIntentions: [
        { productTypeKey: "pdp.productType.ring", preferences: [pdpArchetype] },
      ],
      optionComplexityPreferences: [
        preference("pdp.options.configurable", "pdp.option-complexity"),
      ],
      mediaPreferences: [preference("pdp.media.gallery", "pdp.media")],
      purchaseDecisionHierarchyPreferences: [
        preference("pdp.purchaseHierarchy.considered", "pdp.purchase-hierarchy"),
      ],
      relatedMerchandisingPreferences: [
        preference("pdp.relatedMerchandising.curated", "pdp.related-merchandising"),
      ],
      productCardPreferences: [preference("pdp.productCard.informationLed", "pdp.product-card")],
    },
    contentSupport: {
      pageFamilyPreferences: [
        preference("contentSupport.profile.about", "content-support.profile"),
      ],
      narrativePurposePreferences: [
        preference(
          "contentSupport.narrativePurpose.brandStory",
          "content-support.narrative-purpose",
        ),
      ],
      evidenceRequirements: [],
      safeOmissionBehavior: "omit" as const,
    },
    components: {
      familyPreferences: [preference("component.family.hero", "component.family")],
      meaningfulVariantPreferences: [
        preference("component.variant.heroSplit", "component.meaningful-variant"),
      ],
      boundedParameterPreferences: [
        {
          ...preference("component.parameter.density", "component.bounded-parameter"),
          dimension: "component.bounded-parameter" as const,
          value: "balanced",
        },
      ],
    },
    responsiveArtDirection: {
      responsivePosturePreferences: [
        preference("responsive.posture.contentFirst", "responsive.posture"),
      ],
      mobileHierarchyPreferences: [
        preference("responsive.mobileHierarchy.storyFirst", "responsive.mobile-hierarchy"),
      ],
      densityTransformationPreferences: [
        preference("responsive.density.progressive", "responsive.density"),
      ],
      desktopNarrativePriority: [homepageRole],
      mobileNarrativePriority: [homepageRole],
      imagePosturePreferences: [preference("responsive.image.editorial", "responsive.image")],
      cropFocalPreferences: [preference("responsive.crop.focal", "responsive.crop")],
      overlayPreferences: [preference("responsive.overlay.subtle", "responsive.overlay")],
      approvedMediaRolePreferences: [
        preference("responsive.assetRole.editorial", "responsive.asset-role"),
      ],
    },
  };
}

function completedResponse(intent: unknown, overrides: Record<string, unknown> = {}) {
  return {
    id: "resp_prompted_design_intent_raw_identity",
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: "structured" }] }],
    output_text: JSON.stringify(intent),
    usage: { input_tokens: 120, output_tokens: 80, total_tokens: 200 },
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

  create(request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) {
    this.calls.push({ request, options });
    return this.implementation(request, options);
  }
}

function provider(
  transport: RecordingTransport,
  telemetry?: { record: (event: PromptedStorefrontDesignIntentProviderTelemetryEvent) => void },
) {
  return new OpenAiPromptedStorefrontDesignIntentV2Provider({
    responses: transport,
    model: "prompted-design-intent-test-model",
    timeoutMs: 4_000,
    telemetry,
  });
}

function validation(authority: PromptedStorefrontCapabilityAuthority) {
  return {
    capabilityAuthority: authority,
    currentAuthority: () => currentAuthority(authority),
  };
}

function expectStrictObjects(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectStrictObjects);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const schema = value as Record<string, unknown>;
  if (
    schema.type === "object" &&
    typeof schema.properties === "object" &&
    schema.properties !== null &&
    !Array.isArray(schema.properties)
  ) {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(Object.keys(schema.properties as Record<string, unknown>));
  }
  Object.values(schema).forEach(expectStrictObjects);
}

async function capturedFailure(task: () => Promise<unknown>): Promise<Error & { code?: string }> {
  try {
    await task();
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("Expected the mocked provider call to fail.");
}

describe("P10B-16P-02A strict OpenAI prompted design-intent provider", () => {
  it("preserves the exact prompt in one non-stored strict call and returns a server fingerprint", async () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);
    const intent = intentFixture(request);
    const telemetry = {
      record: vi.fn<(event: PromptedStorefrontDesignIntentProviderTelemetryEvent) => void>(),
    };
    const transport = new RecordingTransport(() => Promise.resolve(completedResponse(intent)));

    const result = await provider(transport, telemetry).createDesignIntent(
      request,
      validation(authority),
    );

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]).toMatchObject({
      request: {
        model: "prompted-design-intent-test-model",
        store: false,
        text: { format: { type: "json_schema", strict: true } },
      },
      options: { maxRetries: 0, timeout: 4_000 },
    });
    const providerInput = JSON.parse(transport.calls[0]?.request.input ?? "null") as {
      merchantPrompt: string;
    };
    expect(providerInput.merchantPrompt).toBe(exactMerchantPrompt);
    expect(buildOpenAiPromptedStorefrontDesignIntentV2Request(request, "model").input).toContain(
      exactMerchantPrompt.replaceAll("\n", "\\n"),
    );
    expect(result).toEqual({
      ...intent,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(intent),
    });
    expect(result).not.toHaveProperty("executableIntentId");
    expect(telemetry.record).toHaveBeenCalledOnce();
    expect(telemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "openai-prompted-storefront-design-intent-v2",
        modelId: "prompted-design-intent-test-model",
        operation: "promptedStorefrontDesignIntentV2",
        requestFingerprint: request.requestFingerprint,
        promptFingerprint: request.promptFingerprint,
        intentFingerprint: result.intentFingerprint,
        callCount: 1,
        retryCount: 0,
        outcome: "success",
        totalTokens: 200,
      }),
    );
    const telemetryJson = JSON.stringify(telemetry.record.mock.calls);
    expect(telemetryJson).not.toContain(exactMerchantPrompt);
    expect(telemetryJson).not.toContain("resp_prompted_design_intent_raw_identity");
  });

  it("exports a recursively closed strict schema and retains local bounded validation", () => {
    expect(() =>
      assertOpenAiStrictSchemaIsClosed(openAiPromptedStorefrontDesignIntentV2OutputSchema),
    ).not.toThrow();
    expectStrictObjects(openAiPromptedStorefrontDesignIntentV2OutputSchema);
    expect(JSON.stringify(openAiPromptedStorefrontDesignIntentV2OutputSchema)).not.toContain(
      "executableIntentId",
    );
    expect(
      () =>
        new OpenAiPromptedStorefrontDesignIntentV2Provider({
          responses: new RecordingTransport(() => Promise.resolve({})),
          model: "test-model",
          timeoutMs: 999,
        }),
    ).toThrow(expect.objectContaining({ code: "invalid-request" }));
    expect(
      () =>
        new OpenAiPromptedStorefrontDesignIntentV2Provider({
          responses: new RecordingTransport(() => Promise.resolve({})),
          model: "test-model",
          timeoutMs: 120_001,
        }),
    ).toThrow(expect.objectContaining({ code: "invalid-request" }));
    expect(
      () =>
        new OpenAiPromptedStorefrontDesignIntentV2Provider({
          responses: new RecordingTransport(() => Promise.resolve({})),
          model: "unsafe model identifier",
          timeoutMs: 4_000,
        }),
    ).toThrow(expect.objectContaining({ code: "invalid-request" }));
  });

  it("classifies refusal, timeout, transport, malformed JSON and strict-schema failures once", async () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);
    const intent = intentFixture(request);
    const secret = "raw-provider-secret-must-not-escape";
    const cases: readonly Readonly<{
      code: string;
      outcome: string;
      response: () => Promise<unknown>;
    }>[] = [
      {
        code: "provider-refusal",
        outcome: "providerRefusal",
        response: () =>
          Promise.resolve(
            completedResponse(intent, {
              output: [{ type: "message", content: [{ type: "refusal", refusal: secret }] }],
            }),
          ),
      },
      {
        code: "provider-timeout",
        outcome: "timeout",
        response: () =>
          Promise.reject(Object.assign(new Error(secret), { name: "APIConnectionTimeoutError" })),
      },
      {
        code: "provider-transport",
        outcome: "transportFailure",
        response: () => Promise.reject(new Error(secret)),
      },
      {
        code: "malformed-output",
        outcome: "malformedOutput",
        response: () => Promise.resolve(completedResponse(intent, { output_text: `{${secret}` })),
      },
      {
        code: "malformed-output",
        outcome: "malformedOutput",
        response: () => Promise.resolve({ id: secret }),
      },
      {
        code: "strict-schema-invalid",
        outcome: "strictSchemaInvalid",
        response: () =>
          Promise.resolve(completedResponse({ ...intent, arbitraryCode: "not allowed" })),
      },
    ];

    for (const entry of cases) {
      const telemetry = {
        record: vi.fn<(event: PromptedStorefrontDesignIntentProviderTelemetryEvent) => void>(),
      };
      const transport = new RecordingTransport(entry.response);
      const failure = await capturedFailure(() =>
        provider(transport, telemetry).createDesignIntent(request, validation(authority)),
      );
      expect(failure).toMatchObject({ code: entry.code });
      expect(failure.message).not.toContain(secret);
      expect(transport.calls).toHaveLength(1);
      expect(telemetry.record).toHaveBeenCalledOnce();
      expect(telemetry.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: entry.outcome, callCount: 1, retryCount: 0 }),
      );
      expect(JSON.stringify(telemetry.record.mock.calls)).not.toContain(secret);
      expect(JSON.stringify(telemetry.record.mock.calls)).not.toContain(exactMerchantPrompt);
    }
  });

  it("fails closed when current authority cannot be resolved before or after the provider call", async () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);
    const secret = "current-authority-storage-secret";
    const preCallTransport = new RecordingTransport(() =>
      Promise.resolve(completedResponse(intentFixture(request))),
    );

    const preCallFailure = await capturedFailure(() =>
      provider(preCallTransport).createDesignIntent(request, {
        capabilityAuthority: authority,
        currentAuthority: () => {
          throw new Error(secret);
        },
      }),
    );
    expect(preCallFailure).toMatchObject({ code: "stale-authority" });
    expect(preCallFailure.message).not.toContain(secret);
    expect(preCallTransport.calls).toHaveLength(0);

    let currentReadCount = 0;
    const postCallTransport = new RecordingTransport(() =>
      Promise.resolve(completedResponse(intentFixture(request))),
    );
    const postCallTelemetry = {
      record: vi.fn<(event: PromptedStorefrontDesignIntentProviderTelemetryEvent) => void>(),
    };
    const postCallFailure = await capturedFailure(() =>
      provider(postCallTransport, postCallTelemetry).createDesignIntent(request, {
        capabilityAuthority: authority,
        currentAuthority: () => {
          currentReadCount += 1;
          if (currentReadCount > 1) throw new Error(secret);
          return currentAuthority(authority);
        },
      }),
    );
    expect(postCallFailure).toMatchObject({ code: "stale-authority" });
    expect(postCallFailure.message).not.toContain(secret);
    expect(postCallTransport.calls).toHaveLength(1);
    expect(postCallTelemetry.record).toHaveBeenCalledOnce();
    expect(postCallTelemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "staleAuthority", callCount: 1, retryCount: 0 }),
    );
    expect(JSON.stringify(postCallTelemetry.record.mock.calls)).not.toContain(secret);
  });

  it("classifies unknown capability and post-call stale authority without repair or fallback", async () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);
    const unknownIntent = structuredClone(intentFixture(request));
    unknownIntent.designDna.preferences = [
      preference("designDna.typographyPairing.invented", "design-dna.typography-pairing"),
    ];
    const unknownTelemetry = {
      record: vi.fn<(event: PromptedStorefrontDesignIntentProviderTelemetryEvent) => void>(),
    };
    const unknownTransport = new RecordingTransport(() =>
      Promise.resolve(completedResponse(unknownIntent)),
    );

    await expect(
      provider(unknownTransport, unknownTelemetry).createDesignIntent(
        request,
        validation(authority),
      ),
    ).rejects.toMatchObject({ code: "unknown-capability" });
    expect(unknownTransport.calls).toHaveLength(1);
    expect(unknownTelemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "unknownCapability" }),
    );

    let currentReadCount = 0;
    const staleTransport = new RecordingTransport(() =>
      Promise.resolve(completedResponse(intentFixture(request))),
    );
    const staleTelemetry = {
      record: vi.fn<(event: PromptedStorefrontDesignIntentProviderTelemetryEvent) => void>(),
    };
    await expect(
      provider(staleTransport, staleTelemetry).createDesignIntent(request, {
        capabilityAuthority: authority,
        currentAuthority: () => {
          currentReadCount += 1;
          const current = currentAuthority(authority);
          return currentReadCount === 1
            ? current
            : { ...current, draftRevision: current.draftRevision + 1 };
        },
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
    expect(staleTransport.calls).toHaveLength(1);
    expect(staleTelemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "staleAuthority" }),
    );
  });

  it("keeps unavailable server configuration fail-closed instead of selecting a fallback", async () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);
    for (const [environment, category] of [
      [{}, "provider-not-openai"],
      [{ VESKIFY_AI_PROVIDER: "mock" }, "provider-not-openai"],
      [{ VESKIFY_AI_PROVIDER: "openai" }, "credentials-unavailable"],
      [
        {
          VESKIFY_AI_PROVIDER: "openai",
          OPENAI_API_KEY: "test-only-placeholder",
          VESKIFY_OPENAI_TIMEOUT_MS: "999",
        },
        "invalid-timeout",
      ],
    ] as const) {
      const selected = selectServerPromptedStorefrontDesignIntentProviderConfiguration({
        environment,
      });
      expect(selected).toMatchObject({ category, modelId: null });
      expect(selected.provider.id).toBe("openai-prompted-storefront-design-intent-v2");
      await expect(
        selected.provider.createDesignIntent(request, validation(authority)),
      ).rejects.toMatchObject({ code: "credentials-unavailable" });
    }
  });
});
