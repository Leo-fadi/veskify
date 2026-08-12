// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  aiStorefrontProviderResponseSchema,
  AiStorefrontGenerationOrchestrator,
  AiStorefrontProviderUnavailableError,
  AiStorefrontProviderValidationError,
  buildAiStorefrontProviderRequest,
  createDeterministicMockStorefrontAIProvider,
  buildAiStorefrontProviderRequestForSupportedCapability,
  requestAiStorefrontProposal,
  type AiStorefrontGenerationCommand,
  type AiStorefrontGenerationIdentity,
  type AiStorefrontProviderServerError,
  type recordStorefrontDiagnostic,
} from "@/application/ai-storefront-generation";
import type { AiStorefrontProjection } from "@/application/ai-storefront";
import {
  createDeterministicWholeStorefrontPlanningProvider,
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontRecipeContext,
  wholeStorefrontPlanningInputSchema,
  WholeStorefrontPlanningProviderError,
  WholeStorefrontGenerationPlanError,
  type WholeStorefrontPlanningInput,
  type WholeStorefrontPlanningProvider,
  type WholeStorefrontPlanningProviderRequest,
} from "@/application/whole-storefront-generation-plan";
import { WholeStorefrontProposalError } from "@/application/whole-storefront-proposal-lifecycle";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicSeed } from "@/data/seed";
import { createServerWholeStorefrontPlanningClient } from "@/integrations/ai/whole-storefront-runtime-client";
import {
  createStandaloneServerWholeStorefrontPlanningAuthority,
  mapServerWholeStorefrontFailure,
  createServerWholeStorefrontPlanningHandler,
  ServerWholeStorefrontAuthorityError,
  type ServerWholeStorefrontPlanningAuthority,
} from "@/integrations/ai/whole-storefront-runtime-authority";
import type { MerchantProjectAuthorization } from "@/application/merchant-project-context";
import { VeskoIntegrationError } from "@/application/vesko-integration";
import { sourceEvidenceSchema, sourceReferenceSchema } from "@/domain/source-discovery";
import { p9r07ExactDesignSystemRequest } from "../fixtures/p9r-07-design-system";

const now = "2026-07-26T10:00:00.000Z";
const snapshot = aurumNordicSeed.draftSnapshot;
type DiagnosticRecord = Parameters<typeof recordStorefrontDiagnostic>[0];

const diagnosticStages = [
  "submission_received",
  "command_build_started",
  "command_build_completed",
  "request_started",
  "response_received",
  "response_decoding_started",
  "response_decoding_completed",
  "acceptance_coordinator_started",
  "proposal_state_completed",
  "request_received",
  "request_validation_completed",
  "provider_invocation_started",
  "provider_invocation_completed",
  "provider_response_parsed",
  "normalization_completed",
  "proposal_schema_validated",
  "proposal_compiled",
  "protected_state_validated",
  "response_completed",
] as const satisfies readonly DiagnosticRecord["stage"][];

const diagnosticCategories = [
  "success",
  "client_command_build",
  "client_request",
  "client_response",
  "client_response_decode",
  "client_acceptance_coordinator",
  "unknown_client_failure",
  "validation",
  "stale",
  "staleDraft",
  "staleTarget",
  "unsupportedRequest",
  "providerFailure",
  "superseded",
  "permissionDenied",
  "projectMismatch",
  "tenantMismatch",
  "providerUnavailable",
  "malformedResponse",
  "internalFailure",
] as const satisfies readonly DiagnosticRecord["category"][];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDiagnosticRecord(value: unknown): value is DiagnosticRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.attemptId === "string" &&
    typeof value.projectId === "string" &&
    (value.scope === "storefront" || value.scope === "page") &&
    diagnosticStages.some((stage) => stage === value.stage) &&
    diagnosticCategories.some((category) => category === value.category) &&
    (value.status === undefined || typeof value.status === "number")
  );
}

function planningInput(): WholeStorefrontPlanningInput {
  const source = sourceReferenceSchema.parse({
    id: "source_runtime_planner",
    sourceType: "deterministic-fixture",
    url: "https://merchant.example/store",
    normalizedOrigin: "https://merchant.example",
    requestedLocale: "en",
    discoveredAt: now,
    allowedDiscoveryPolicy: {
      mode: "deterministic",
      maxPages: 1,
      maxAssets: 1,
      followSameOriginOnly: true,
    },
    status: "complete",
    warnings: [],
    failure: null,
  });
  const evidence = sourceEvidenceSchema.parse({
    id: "evidence_runtime_planner",
    kind: "page-identity",
    provenance: { sourceReferenceId: source.id, sourceUrl: source.url, observedAt: now },
    sourceUrl: source.url,
    confidence: 1,
    observedValue: { title: "Runtime merchant" },
    extractionMethod: "deterministic-test-fixture",
    locale: "en",
    warnings: [],
    uncertainty: { isUncertain: false, reason: null },
  });
  const brief = approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: "brief_runtime_planner",
      now,
      businessIdentity: { businessName: "Runtime merchant" },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
      sourceReferenceIds: [source.id],
      sourceEvidenceIds: [evidence.id],
      materialEvidence: {
        sourceReferences: [source],
        evidence: [evidence],
        assetCandidates: [],
        reconciliation: null,
      },
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      pagePlan: { pageTypes: ["home", "collection", "product"] },
      approvedBrandDirection: {
        logoAssetRef: { id: "asset_runtime_logo", label: "Merchant logo" },
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
  return wholeStorefrontPlanningInputSchema.parse({
    brief,
    project: {
      id: aurumNordicSeed.project.id,
      revision: aurumNordicSeed.project.revision,
      enabledLocales: ["en", "fi"],
    },
    draft: structuredClone(snapshot),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    componentDefinitions: structuredClone(veskifyComponentDefinitionsV2),
    recipeContext: createWholeStorefrontRecipeContext(),
    approvedAssetContext: null,
    requiredAssetPlacements: [],
  });
}

function request({
  storefront = {
    pageOrder: snapshot.pages.map((page) => page.id),
    pages: structuredClone(snapshot.pages),
    navigation: structuredClone(snapshot.navigation),
    brandSystem: structuredClone(snapshot.brandSystem),
  },
  instruction = p9r07ExactDesignSystemRequest,
  sequence = 1,
  scope = "storefront",
}: {
  storefront?: AiStorefrontProjection;
  instruction?: string;
  sequence?: number;
  scope?: "storefront" | "page";
} = {}) {
  const provider = {
    id: "server-whole-storefront-planning",
    assetReferenceCapability: "structuredApprovedAssets" as const,
    generationCapabilities: [
      "approvedColorTypographyDirection",
      "registeredWholeStorefrontDirection",
    ] as const,
    proposeStorefront: () => Promise.reject(new Error("server boundary")),
  };
  const homepage = storefront.pages.find((page) => page.type === "home");
  if (scope === "page" && !homepage) throw new Error("The runtime fixture requires a homepage.");
  const command = {
    projectId: aurumNordicSeed.project.id,
    draftSnapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    storefront: structuredClone(storefront),
    affectedPageIds: scope === "page" ? [homepage!.id] : storefront.pageOrder,
    affectedSectionTargets: [],
    designSystemTarget:
      scope === "page"
        ? null
        : { kind: "storefrontDesignSystem", projectId: aurumNordicSeed.project.id },
    merchantInstruction:
      scope === "page"
        ? "Redesign only the homepage as a modern technical landing page. Preserve products, prices, stock, media bindings, routes, and approved assets. Do not change the collection page or product page."
        : instruction,
    activeLocale: "en",
    enabledLocales: ["en", "fi"],
    requestedScope: scope,
    providerId: provider.id,
    provider,
    importedContent: [],
  } satisfies Omit<AiStorefrontGenerationCommand, "capability">;
  return buildAiStorefrontProviderRequestForSupportedCapability(command, sequence).request;
}

function designSystemRequest() {
  const provider = {
    id: "server-whole-storefront-planning",
    assetReferenceCapability: "structuredApprovedAssets" as const,
    generationCapabilities: [
      "approvedColorTypographyDirection",
      "registeredWholeStorefrontDirection",
    ] as const,
    proposeStorefront: () => Promise.reject(new Error("server boundary")),
  };
  return buildAiStorefrontProviderRequestForSupportedCapability(
    {
      projectId: aurumNordicSeed.project.id,
      draftSnapshotId: snapshot.id,
      draftRevision: snapshot.revision,
      storefront: {
        pageOrder: snapshot.pages.map((page) => page.id),
        pages: structuredClone(snapshot.pages),
        navigation: structuredClone(snapshot.navigation),
        brandSystem: structuredClone(snapshot.brandSystem),
      },
      affectedPageIds: snapshot.pages.map((page) => page.id),
      affectedSectionTargets: [],
      designSystemTarget: {
        kind: "storefrontDesignSystem",
        projectId: aurumNordicSeed.project.id,
      },
      merchantInstruction: p9r07ExactDesignSystemRequest,
      activeLocale: "en",
      enabledLocales: ["en", "fi"],
      requestedScope: "storefront",
      providerId: provider.id,
      provider,
      importedContent: [],
    },
    1,
  ).request;
}

function authority(input = planningInput()): ServerWholeStorefrontPlanningAuthority {
  const authorization: MerchantProjectAuthorization = {
    context: {
      userId: "user_runtime",
      tenantId: "tenant_runtime",
      merchantId: "merchant_runtime",
      organizationId: "organization_runtime",
      storeId: "store_runtime",
      storefrontProjectId: input.project.id,
      roles: ["owner"],
      permissions: ["readStorefront", "saveDraft"],
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      market: "Finland",
      projectRevision: "standalone-project-revision-1",
    },
    actions: ["request-ai-design"],
  };
  return {
    resolve: () =>
      Promise.resolve({
        authorization,
        planningInput: input,
        currentPlanningInput: () => input,
        proposalEnvelope: async (proposalRequest: ReturnType<typeof request>) => {
          const response =
            await createDeterministicMockStorefrontAIProvider().proposeStorefront(proposalRequest);
          return {
            ...response,
            providerId: proposalRequest.providerId,
          };
        },
      }),
  };
}

describe("P9-01 runtime whole-storefront provider boundary", () => {
  it.each([
    [
      "provider DTO validation",
      new WholeStorefrontPlanningProviderError(
        "malformed-structured-response",
        "provider response details must remain private",
      ),
      { status: 400, category: "validation", retryable: false },
    ],
    [
      "PageBlueprint plan validation",
      new WholeStorefrontGenerationPlanError("provider-invented-target", "invalid plan"),
      { status: 400, category: "validation", retryable: false },
    ],
    [
      "proposal compilation validation",
      new WholeStorefrontProposalError("invalid-plan", "invalid proposal"),
      { status: 400, category: "validation", retryable: false },
    ],
    [
      "protected-state response validation",
      new AiStorefrontProviderValidationError("protected-state", "invalid protected state"),
      { status: 400, category: "validation", retryable: false },
    ],
    [
      "stale proposal compilation",
      new WholeStorefrontProposalError("stale-draft", "stale draft"),
      { status: 409, category: "stale", retryable: false },
    ],
    [
      "provider timeout",
      new WholeStorefrontPlanningProviderError("provider-unavailable", "timeout"),
      { status: 503, category: "providerUnavailable", retryable: true },
    ],
    [
      "provider authentication",
      new WholeStorefrontPlanningProviderError(
        "credentials-unavailable",
        "credentials unavailable",
      ),
      { status: 503, category: "providerUnavailable", retryable: true },
    ],
    [
      "authorization",
      new VeskoIntegrationError("permissionDenied"),
      { status: 401, category: "permissionDenied", retryable: false },
    ],
    [
      "unknown application failure",
      new Error("internal application failure"),
      { status: 500, category: "internalFailure", retryable: false },
    ],
  ])("maps %s without misrepresenting its category or retryability", (_label, error, expected) => {
    expect(mapServerWholeStorefrontFailure(error)).toEqual(expected);
  });

  it.each(["invalid-brief", "registry-mismatch", "invalid-asset-reference"] as const)(
    "keeps the %s authority failure as non-retryable validation",
    (code) => {
      expect(
        mapServerWholeStorefrontFailure(new ServerWholeStorefrontAuthorityError(code)),
      ).toEqual({
        status: 400,
        category: "validation",
        retryable: false,
      });
    },
  );

  it("keeps authentication unavailability distinct from permission denial", () => {
    expect(
      mapServerWholeStorefrontFailure(
        new ServerWholeStorefrontAuthorityError("authentication-unavailable"),
      ),
    ).toEqual({
      status: 503,
      category: "authenticationUnavailable",
      retryable: false,
    });
    expect(
      mapServerWholeStorefrontFailure(new VeskoIntegrationError("authenticationUnavailable")),
    ).toEqual({
      status: 503,
      category: "authenticationUnavailable",
      retryable: true,
    });
    expect(mapServerWholeStorefrontFailure(new VeskoIntegrationError("permissionDenied"))).toEqual({
      status: 401,
      category: "permissionDenied",
      retryable: false,
    });
  });

  it("preserves authenticated-service unavailability through the browser provider boundary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              failure: { category: "authenticationUnavailable", retryable: true },
            }),
            { status: 503 },
          ),
        ),
      ),
    );

    try {
      await expect(
        requestAiStorefrontProposal(createServerWholeStorefrontPlanningClient(), request()),
      ).rejects.toMatchObject({
        category: "authenticationUnavailable",
        retryable: true,
        status: 503,
      } satisfies Partial<AiStorefrontProviderServerError>);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    ["validation", false, 400],
    ["stale", false, 409],
    ["permissionDenied", false, 401],
    ["authenticationUnavailable", true, 503],
    ["internalFailure", false, 500],
  ] as const)(
    "preserves a typed %s response through the browser boundary",
    async (category, retryable, status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            new Response(JSON.stringify({ ok: false, failure: { category, retryable } }), {
              status,
            }),
          ),
        ),
      );

      try {
        await expect(
          createServerWholeStorefrontPlanningClient().proposeStorefront(request()),
        ).rejects.toMatchObject({ category, retryable, status });
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

  it("classifies a rejected browser transport as retryable unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network offline"))),
    );

    try {
      await expect(
        createServerWholeStorefrontPlanningClient().proposeStorefront(request()),
      ).rejects.toMatchObject({
        category: "providerUnavailable",
        retryable: true,
        status: 0,
      });
      await expect(
        requestAiStorefrontProposal(createServerWholeStorefrontPlanningClient(), request()),
      ).rejects.toBeInstanceOf(AiStorefrontProviderUnavailableError);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserves a server internal failure through browser translation and orchestration", async () => {
    const client = createServerWholeStorefrontPlanningClient();
    const serverRequest = request();
    const command = {
      projectId: serverRequest.target.projectId,
      draftSnapshotId: serverRequest.target.draftSnapshotId,
      draftRevision: serverRequest.target.draftRevision,
      storefront: structuredClone(serverRequest.storefront),
      affectedPageIds: [...serverRequest.target.affectedPageIds],
      affectedSectionTargets: [],
      designSystemTarget: serverRequest.target.designSystemTarget,
      merchantInstruction: "Apply a warm premium style across the storefront.",
      activeLocale: serverRequest.activeLocale,
      enabledLocales: [...serverRequest.enabledLocales],
      requestedScope: serverRequest.target.scope,
      capability: "approvedColorTypographyDirection",
      canonicalTokenRefinementPlan: serverRequest.tokenRefinementPlan ?? undefined,
      providerId: client.id,
      provider: client,
      importedContent: [],
    } satisfies AiStorefrontGenerationCommand;
    const canonical = buildAiStorefrontProviderRequest(command, 1);
    const currentIdentity: AiStorefrontGenerationIdentity = {
      context: {
        projectId: command.projectId,
        draftSnapshotId: command.draftSnapshotId,
        draftRevision: command.draftRevision,
        enabledLocales: [...canonical.enabledLocales],
        activeLocale: canonical.activeLocale,
        storefront: structuredClone(command.storefront),
      },
      target: structuredClone(canonical.target),
      assetContextFingerprint: canonical.assetContextFingerprint,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              failure: { category: "internalFailure", retryable: false },
            }),
            { status: 500 },
          ),
        ),
      ),
    );

    try {
      const result = await new AiStorefrontGenerationOrchestrator({
        currentIdentity: () => structuredClone(currentIdentity),
      }).generate(command);

      expect(result).toMatchObject({
        state: "failed",
        proposal: null,
        failure: { code: "internalFailure", retryable: false },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps malformed HTTP requests as non-retryable validation failures", async () => {
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: authority(),
      selectProvider: () => createDeterministicWholeStorefrontPlanningProvider(),
    });

    const response = await handler(
      new Request("http://localhost", { method: "POST", body: "{not json" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      failure: { category: "validation", retryable: false },
    });
  });

  it("maps an untyped provider transport failure to the genuine provider boundary", async () => {
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: authority(),
      selectProvider: () => ({
        id: "transport-failure",
        capabilities: {
          wholeStorefrontPlanning: true,
          structuredPlanOutput: true,
          approvedAssetReferences: true,
        },
        createPlan: () => Promise.reject(new Error("transport reset")),
      }),
    });

    const response = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      failure: { category: "providerUnavailable", retryable: true },
    });
  });

  it("does not disclose or misclassify an unknown post-provider application failure", async () => {
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: {
        resolve: () =>
          authority()
            .resolve(request(), new Request("http://localhost"))
            .then((context) => ({
              ...context,
              proposalEnvelope: () =>
                Promise.reject(new Error("provider payload secret=unsafe-value\\nstack trace")),
            })),
      },
      selectProvider: () => ({
        id: "deterministic-planner",
        capabilities: {
          wholeStorefrontPlanning: true,
          structuredPlanOutput: true,
          approvedAssetReferences: true,
        },
        createPlan: (providerRequest) => Promise.resolve(providerRequest.expectedPlan),
      }),
    });

    const response = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      failure: { category: "internalFailure", retryable: false },
    });
    expect(JSON.stringify(body)).not.toContain("unsafe-value");
    expect(JSON.stringify(body)).not.toContain("stack trace");
  });

  it("keeps a deterministic plan fingerprint rejection non-retryable", async () => {
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: authority(),
      selectProvider: () => ({
        id: "invalid-deterministic-planner",
        capabilities: {
          wholeStorefrontPlanning: true,
          structuredPlanOutput: true,
          approvedAssetReferences: true,
        },
        createPlan: (providerRequest) => {
          const invalid = structuredClone(providerRequest.expectedPlan);
          invalid.fingerprint = "whole-storefront-plan-invalid";
          return Promise.resolve(invalid);
        },
      }),
    });

    const response = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      failure: { category: "validation", retryable: false },
    });
  });

  it("keeps an invalid deterministic provider DTO non-retryable", async () => {
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: authority(),
      selectProvider: () => ({
        id: "invalid-dto-planner",
        capabilities: {
          wholeStorefrontPlanning: true,
          structuredPlanOutput: true,
          approvedAssetReferences: true,
        },
        createPlan: () => Promise.resolve({ invalid: "provider DTO" }),
      }),
    });

    const response = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      failure: { category: "validation", retryable: false },
    });
  });

  it("keeps browser and server authority identical for the P9R-07 design-system request", async () => {
    const browserRequest = designSystemRequest();
    const deterministicEnvelope = aiStorefrontProviderResponseSchema.parse(
      await createDeterministicMockStorefrontAIProvider().proposeStorefront(browserRequest),
    );
    expect(
      deterministicEnvelope.proposal.operations.map(({ operation }) => operation.type),
    ).toEqual(["APPLY_APPROVED_BRAND_COLOURS", "APPLY_APPROVED_BRAND_TYPOGRAPHY"]);
    const createPlan = vi.fn((input: WholeStorefrontPlanningProviderRequest) =>
      Promise.resolve(structuredClone(input.expectedPlan)),
    );
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: authority(),
      selectProvider: () => ({
        id: "recording-canonical-planner",
        capabilities: {
          wholeStorefrontPlanning: true,
          structuredPlanOutput: true,
          approvedAssetReferences: true,
        },
        createPlan,
      }),
    });

    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(browserRequest),
      }),
    );
    const body = (await response.json()) as { proposal: unknown };
    const envelope = aiStorefrontProviderResponseSchema.parse(body.proposal);

    expect(response.status).toBe(200);
    expect(createPlan).toHaveBeenCalledOnce();
    expect(createPlan.mock.calls[0][0]).toMatchObject({
      requestClass: "tokenOnlyRefinement",
      tokenRefinementPlan: browserRequest.tokenRefinementPlan,
    });
    expect(browserRequest.capability).toBe("approvedColorTypographyDirection");
    expect(browserRequest.target.designSystemTarget).not.toBeNull();
    expect(browserRequest.target.affectedPageIds).toEqual(
      expect.arrayContaining(snapshot.pages.map((page) => page.id)),
    );
    expect(envelope.proposal.operations.map(({ operation }) => operation.type)).toEqual([
      "APPLY_APPROVED_BRAND_COLOURS",
      "APPLY_APPROVED_BRAND_TYPOGRAPHY",
    ]);
    expect(envelope.proposal.proposedStorefront.pages).toEqual(browserRequest.storefront.pages);
    expect(envelope.proposal.proposedStorefront.pageOrder).toEqual(
      browserRequest.storefront.pageOrder,
    );
    expect(envelope.proposal.proposedStorefront.navigation).toEqual(
      browserRequest.storefront.navigation,
    );
    expect(envelope.proposal.proposedStorefront.brandSystem).toMatchObject({
      colors: browserRequest.tokenRefinementPlan?.palette?.colors,
      typography: browserRequest.tokenRefinementPlan?.typography,
    });
  });

  it("rejects a browser capability decision that disagrees with server reconstruction", async () => {
    const canonical = designSystemRequest();
    const mismatched = buildAiStorefrontProviderRequest(
      {
        projectId: canonical.target.projectId,
        draftSnapshotId: canonical.target.draftSnapshotId,
        draftRevision: canonical.target.draftRevision,
        storefront: canonical.storefront,
        affectedPageIds: canonical.target.affectedPageIds,
        affectedSectionTargets: [],
        designSystemTarget: canonical.target.designSystemTarget,
        merchantInstruction: canonical.instruction,
        activeLocale: canonical.activeLocale,
        enabledLocales: canonical.enabledLocales,
        requestedScope: "storefront",
        capability: "registeredWholeStorefrontDirection",
        providerId: canonical.providerId,
        provider: {
          id: canonical.providerId,
          generationCapabilities: [
            "approvedColorTypographyDirection",
            "registeredWholeStorefrontDirection",
          ],
          proposeStorefront: () => Promise.reject(new Error("server boundary")),
        },
        importedContent: [],
      },
      canonical.requestSequence,
    );
    const provider = {
      id: "must-not-run",
      capabilities: {
        wholeStorefrontPlanning: true,
        structuredPlanOutput: true,
        approvedAssetReferences: true,
      },
      createPlan: vi.fn(),
    } satisfies WholeStorefrontPlanningProvider;
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: authority(),
      selectProvider: () => provider,
    });

    const response = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(mismatched) }),
    );

    expect(response.status).toBe(409);
    expect(provider.createPlan).not.toHaveBeenCalled();
  });
  it("records page scope in every runtime-client diagnostic for a homepage request", async () => {
    const records: DiagnosticRecord[] = [];
    const log = vi.spyOn(console, "info").mockImplementation((_event, value) => {
      if (typeof value !== "string") return;
      const parsed: unknown = JSON.parse(value);
      if (isDiagnosticRecord(parsed)) records.push(parsed);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              failure: { category: "validation", retryable: false },
            }),
            { status: 400 },
          ),
        ),
      ),
    );

    await expect(
      createServerWholeStorefrontPlanningClient().proposeStorefront(request({ scope: "page" })),
    ).rejects.toMatchObject({ category: "validation", status: 400 });
    vi.unstubAllGlobals();
    log.mockRestore();

    expect(records.length).toBeGreaterThan(0);
    expect(new Set(records.map((record) => record.scope))).toEqual(new Set(["page"]));
  });

  it("records only canonical request and project identifiers before request validation", async () => {
    const records: DiagnosticRecord[] = [];
    const log = vi.spyOn(console, "info").mockImplementation((_event, value) => {
      if (typeof value !== "string") return;
      const parsed: unknown = JSON.parse(value);
      if (isDiagnosticRecord(parsed)) records.push(parsed);
    });
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: authority(),
      selectProvider: () => createDeterministicWholeStorefrontPlanningProvider(),
    });
    const validIds = ["attempt_canonical_1", "p9_05b_local_123", "request_safe_456"];
    for (const requestId of validIds) {
      const body = request();
      body.requestId = requestId;
      await handler(
        new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }),
      );
    }
    await handler(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          requestId: "x".repeat(81),
          target: { projectId: "project_bad\nidentifier" },
        }),
      }),
    );
    await handler(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          requestId: "unsafe identifier",
          target: { projectId: "x".repeat(81) },
        }),
      }),
    );
    await handler(new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }));
    log.mockRestore();

    const received = records.filter((record) => record.stage === "request_received");
    expect(received.slice(0, 3).map((record) => record.attemptId)).toEqual(validIds);
    expect(
      received.slice(0, 3).every((record) => record.projectId === aurumNordicSeed.project.id),
    ).toBe(true);
    expect(received.slice(3)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attemptId: "attempt_unavailable",
          projectId: "project_unavailable",
        }),
      ]),
    );
    expect(records.some((record) => record.projectId.includes("\n"))).toBe(false);
  });

  it("routes the editor runtime client envelope through the canonical server planner before review", async () => {
    const value = authority();
    const createPlan = vi.fn((input: WholeStorefrontPlanningProviderRequest) =>
      Promise.resolve(structuredClone(input.expectedPlan)),
    );
    const provider: WholeStorefrontPlanningProvider = {
      id: "recording-canonical-planner",
      capabilities: {
        wholeStorefrontPlanning: true,
        structuredPlanOutput: true,
        approvedAssetReferences: true,
      },
      createPlan,
    };
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: value,
      selectProvider: () => provider,
    });
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const serverResponse = await handler(
        new Request("http://localhost/api/ai/whole-storefront-proposals", {
          method: init?.method,
          body: init?.body,
          headers: init?.headers,
        }),
      );
      return serverResponse;
    });
    vi.stubGlobal("fetch", fetch);
    const body = await createServerWholeStorefrontPlanningClient().proposeStorefront(request());
    vi.unstubAllGlobals();

    expect(fetch).toHaveBeenCalledOnce();
    expect(createPlan).toHaveBeenCalledOnce();
    expect((body as { proposal: { status: string } }).proposal.status).toBe("pending");
  });

  it("does not fall back when the configured canonical planner fails", async () => {
    const value = authority();
    const fallback = vi.fn();
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: value,
      selectProvider: () => ({
        id: "failing-canonical-planner",
        capabilities: {
          wholeStorefrontPlanning: true,
          structuredPlanOutput: true,
          approvedAssetReferences: true,
        },
        createPlan: () => Promise.reject(new Error("provider failure")),
      }),
    });
    const response = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
    );

    expect(response.status).toBe(503);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("requires canonical request-ai-design authority and rejects stale draft identity", async () => {
    const canonical = authority();
    const denied: ServerWholeStorefrontPlanningAuthority = {
      resolve: (providerRequest, httpRequest) =>
        canonical.resolve(providerRequest, httpRequest).then((context) => ({
          ...context,
          authorization: {
            ...context.authorization,
            context: { ...context.authorization.context, permissions: ["readStorefront"] },
          },
        })),
    };
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: denied,
      selectProvider: () => ({
        id: "unused",
        capabilities: {
          wholeStorefrontPlanning: true,
          structuredPlanOutput: true,
          approvedAssetReferences: true,
        },
        createPlan: () => Promise.resolve(createWholeStorefrontGenerationPlan(planningInput())),
      }),
    });
    const response = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a stale canonical draft before the planner is invoked", async () => {
    const input = planningInput();
    input.draft.revision += 1;
    const provider = {
      id: "recording-canonical-planner",
      capabilities: {
        wholeStorefrontPlanning: true,
        structuredPlanOutput: true,
        approvedAssetReferences: true,
      },
      createPlan: vi.fn(),
    } satisfies WholeStorefrontPlanningProvider;
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: authority(input),
      selectProvider: () => provider,
    });

    const response = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
    );

    expect(response.status).toBe(409);
    expect(provider.createPlan).not.toHaveBeenCalled();
  });

  it("keeps deterministic storefront proposals available only through explicit standalone injection", async () => {
    const provider = createDeterministicMockStorefrontAIProvider();
    const proposal = await provider.proposeStorefront(request());

    expect(provider.id).toBe("deterministic-storefront-mock");
    expect(provider.generationCapabilities).toEqual(["approvedColorTypographyDirection"]);
    expect((proposal as { proposal: { status: string } }).proposal.status).toBe("pending");
  });

  it("advertises registered whole-storefront support only on the real server planning client", () => {
    expect(createServerWholeStorefrontPlanningClient().generationCapabilities).toEqual([
      "approvedColorTypographyDirection",
      "registeredWholeStorefrontDirection",
    ]);
  });

  it("resolves canonical standalone seed context instead of an unavailable route authority", async () => {
    const context = await createStandaloneServerWholeStorefrontPlanningAuthority().resolve(
      request(),
      new Request("http://localhost"),
    );

    expect(context.planningInput.project.id).toBe(aurumNordicSeed.project.id);
    expect(context.planningInput.draft.id).toBe(aurumNordicSeed.draftSnapshot.id);
    expect(context.authorization.actions).toContain("request-ai-design");
  });

  it("accepts only server-validated standalone proposal baselines for repeat planning", async () => {
    const standaloneAuthority = createStandaloneServerWholeStorefrontPlanningAuthority();
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: standaloneAuthority,
      selectProvider: () => createDeterministicWholeStorefrontPlanningProvider(),
    });
    const firstResponse = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
    );
    const firstBody = (await firstResponse.json()) as { proposal: unknown };
    const firstEnvelope = aiStorefrontProviderResponseSchema.parse(firstBody.proposal);
    const acceptedRequest = request({
      storefront: firstEnvelope.proposal.proposedStorefront,
      instruction: "Apply a warm premium style across the storefront.",
      sequence: 2,
    });
    const acceptedResponse = await handler(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(acceptedRequest),
      }),
    );
    const unknownStorefront = structuredClone(firstEnvelope.proposal.proposedStorefront);
    unknownStorefront.brandSystem.colors.primary = "#010101";
    const unknownResponse = await handler(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(request({ storefront: unknownStorefront, sequence: 3 })),
      }),
    );

    expect(firstResponse.status).toBe(200);
    expect(acceptedResponse.status).toBe(200);
    expect(unknownResponse.status).toBe(409);
  });

  it.each(["stale-result", "stale-brief", "stale-approved-asset"] as const)(
    "maps the planner %s failure to a non-retryable stale response",
    async (code) => {
      const handler = createServerWholeStorefrontPlanningHandler({
        authority: authority(),
        selectProvider: () => ({
          id: "stale-planner",
          capabilities: {
            wholeStorefrontPlanning: true,
            structuredPlanOutput: true,
            approvedAssetReferences: true,
          },
          createPlan: () =>
            Promise.reject(new WholeStorefrontGenerationPlanError(code, "stale planning input")),
        }),
      });
      const response = await handler(
        new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        failure: { category: "stale", retryable: false },
      });
    },
  );
});
