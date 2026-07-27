// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  aiStorefrontProviderResponseSchema,
  createDeterministicMockStorefrontAIProvider,
  buildAiStorefrontProviderRequest,
  type AiStorefrontGenerationCommand,
} from "@/application/ai-storefront-generation";
import type { AiStorefrontProjection } from "@/application/ai-storefront";
import {
  createDeterministicWholeStorefrontPlanningProvider,
  createWholeStorefrontGenerationPlan,
  wholeStorefrontPlanningInputSchema,
  WholeStorefrontPlanningProviderError,
  type WholeStorefrontPlanningInput,
  type WholeStorefrontPlanningProvider,
  type WholeStorefrontPlanningProviderRequest,
} from "@/application/whole-storefront-generation-plan";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicSeed } from "@/data/seed";
import { createServerWholeStorefrontPlanningClient } from "@/integrations/ai/whole-storefront-runtime-client";
import {
  createStandaloneServerWholeStorefrontPlanningAuthority,
  createServerWholeStorefrontPlanningHandler,
  type ServerWholeStorefrontPlanningAuthority,
} from "@/integrations/ai/whole-storefront-runtime-authority";
import type { MerchantProjectAuthorization } from "@/application/merchant-project-context";
import { sourceEvidenceSchema, sourceReferenceSchema } from "@/domain/source-discovery";

const now = "2026-07-26T10:00:00.000Z";
const snapshot = aurumNordicSeed.draftSnapshot;

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
  instruction = "Apply a warm premium style across the storefront.",
  sequence = 1,
}: {
  storefront?: AiStorefrontProjection;
  instruction?: string;
  sequence?: number;
} = {}) {
  const provider = {
    id: "server-whole-storefront-planning",
    assetReferenceCapability: "structuredApprovedAssets" as const,
    proposeStorefront: () => Promise.reject(new Error("server boundary")),
  };
  const command: AiStorefrontGenerationCommand = {
    projectId: aurumNordicSeed.project.id,
    draftSnapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    storefront: structuredClone(storefront),
    affectedPageIds: storefront.pageOrder,
    affectedSectionTargets: [],
    designSystemTarget: { kind: "storefrontDesignSystem", projectId: aurumNordicSeed.project.id },
    merchantInstruction: instruction,
    activeLocale: "en",
    enabledLocales: ["en", "fi"],
    requestedScope: "storefront",
    capability: "approvedColorTypographyDirection",
    providerId: provider.id,
    provider,
    importedContent: [],
  };
  return buildAiStorefrontProviderRequest(command, sequence);
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
    expect((proposal as { proposal: { status: string } }).proposal.status).toBe("pending");
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
    const handler = createServerWholeStorefrontPlanningHandler({
      authority: createStandaloneServerWholeStorefrontPlanningAuthority(),
      selectProvider: () => createDeterministicWholeStorefrontPlanningProvider(),
    });
    const firstResponse = await handler(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(request()) }),
    );
    const firstBody = (await firstResponse.json()) as { proposal: unknown };
    const firstEnvelope = aiStorefrontProviderResponseSchema.parse(firstBody.proposal);
    const acceptedRequest = request({
      storefront: firstEnvelope.proposal.proposedStorefront,
      instruction: "Use a minimal Nordic colour and typography direction throughout the site.",
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

  it("maps a planner stale-result to a non-retryable stale response", async () => {
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
          Promise.reject(
            new WholeStorefrontPlanningProviderError("stale-result", "stale planning input"),
          ),
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
  });
});
