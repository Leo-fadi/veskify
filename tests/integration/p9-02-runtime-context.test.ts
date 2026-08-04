// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  aiStorefrontProviderResponseSchema,
  buildAiStorefrontProviderRequestForSupportedCapability,
  createApprovedGenerationAssetContextFingerprint,
  type AiStorefrontCapabilitySelectionInput,
  validateAiStorefrontProviderResponse,
} from "@/application/ai-storefront-generation";
import type { WholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import {
  createStandaloneAuthoritativeWholeStorefrontPlanningContextSource,
  createStandaloneServerWholeStorefrontPlanningAuthority,
  type AuthoritativeWholeStorefrontPlanningContextSource,
} from "@/integrations/ai/whole-storefront-runtime-authority";
import { createWholeStorefrontPlanningRouteHandler } from "@/app/api/ai/whole-storefront-proposals/handler";

function requestFor(
  seed: typeof aurumNordicSeed | typeof karvonenSeed,
  activeLocale: "en" | "fi" = "en",
) {
  const snapshot = seed.draftSnapshot;
  const command = {
    projectId: seed.project.id,
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
    designSystemTarget: { kind: "storefrontDesignSystem", projectId: seed.project.id },
    merchantInstruction: "Apply a warm premium style across the storefront.",
    activeLocale,
    enabledLocales: seed.project.enabledLocales,
    requestedScope: "storefront",
    providerId: "server-whole-storefront-planning",
    provider: {
      id: "server-whole-storefront-planning",
      assetReferenceCapability: "structuredApprovedAssets",
      generationCapabilities: [
        "approvedColorTypographyDirection",
        "registeredWholeStorefrontDirection",
      ] as const,
      proposeStorefront: () => Promise.reject(new Error("Server-only provider boundary")),
    },
    importedContent: [],
  } satisfies AiStorefrontCapabilitySelectionInput;
  return buildAiStorefrontProviderRequestForSupportedCapability(command, 1).request;
}

function recordingProvider(record: (request: unknown) => void): WholeStorefrontPlanningProvider {
  return {
    id: "p9-02-recording-planner",
    capabilities: {
      wholeStorefrontPlanning: true,
      structuredPlanOutput: true,
      approvedAssetReferences: true,
    },
    createPlan: (request) => {
      record(request);
      return Promise.resolve(structuredClone(request.expectedPlan));
    },
  };
}

describe("P9-02 authoritative whole-storefront runtime context", () => {
  it("passes the server-owned brief, registry, recipes and approved assets through the editor route", async () => {
    const base = createStandaloneAuthoritativeWholeStorefrontPlanningContextSource();
    const load = vi.fn(
      (input: Parameters<AuthoritativeWholeStorefrontPlanningContextSource["load"]>[0]) =>
        base.load(input),
    );
    const source: AuthoritativeWholeStorefrontPlanningContextSource = { load };
    const received: unknown[] = [];
    const handler = createWholeStorefrontPlanningRouteHandler({
      authority: createStandaloneServerWholeStorefrontPlanningAuthority({ contextSource: source }),
      selectProvider: () => recordingProvider((value) => received.push(value)),
    });
    const browserRequest = requestFor(aurumNordicSeed);

    const accepted = await handler(
      new Request("http://localhost/api/ai/whole-storefront-proposals", {
        method: "POST",
        body: JSON.stringify(browserRequest),
      }),
    );
    const replacedBrief = await handler(
      new Request("http://localhost/api/ai/whole-storefront-proposals", {
        method: "POST",
        body: JSON.stringify({ ...browserRequest, brief: { businessName: "Browser override" } }),
      }),
    );
    const planningRequest = received[0] as {
      approvedBrief: { businessContext: { businessName: string; primaryMarket: string } };
      registry: readonly { type: string }[];
      recipes: {
        templates: readonly {
          id: string;
          pagePlans: readonly { pageType: string; slots: readonly { sectionType: string }[] }[];
        }[];
      };
      approvedAssets: { assets: readonly { role: string }[] };
      canonicalCommerce: { protectedFacts: readonly string[] };
    };

    expect(accepted.status).toBe(200);
    expect(replacedBrief.status).toBe(400);
    expect(load).toHaveBeenCalled();
    expect(planningRequest.approvedBrief.businessContext).toMatchObject({
      businessName: "Aurum Nordic",
      primaryMarket: "Finland",
    });
    expect(planningRequest.registry.length).toBeGreaterThan(1);
    expect(planningRequest.recipes.templates.length).toBeGreaterThan(0);
    const homeRecipe = planningRequest.recipes.templates
      .flatMap((template) => template.pagePlans)
      .find((page) => page.pageType === "home");
    expect(homeRecipe?.slots.findIndex((slot) => slot.sectionType === "header")).toBeLessThan(
      homeRecipe?.slots.findIndex((slot) => slot.sectionType === "homepageHero") ?? 0,
    );
    expect(homeRecipe?.slots.at(-1)?.sectionType).toBe("footer");
    expect(planningRequest.approvedAssets.assets).toEqual([
      expect.objectContaining({ role: "logo" }),
    ]);
    expect(planningRequest.canonicalCommerce.protectedFacts.join(" ")).toMatch(/product media/i);
  });

  it("retains the browser correlation ID while validating server-added authoritative assets", async () => {
    const handler = createWholeStorefrontPlanningRouteHandler({
      authority: createStandaloneServerWholeStorefrontPlanningAuthority(),
      selectProvider: () => recordingProvider(() => undefined),
    });
    const browserRequest = requestFor(aurumNordicSeed);
    const response = await handler(
      new Request("http://localhost/api/ai/whole-storefront-proposals", {
        method: "POST",
        body: JSON.stringify(browserRequest),
      }),
    );
    const body = (await response.json()) as { proposal: unknown };
    const envelope = aiStorefrontProviderResponseSchema.parse(body.proposal);

    expect(response.status).toBe(200);
    expect(envelope.providerRequestId).toBe(browserRequest.requestId);
    expect(envelope.proposal.requestId).toBe(browserRequest.requestId);
    expect(envelope.metadata.authoritativePlanningFingerprint).toMatch(/^whole-storefront-plan-/);
    expect(() => validateAiStorefrontProviderResponse(browserRequest, envelope)).not.toThrow();
  });

  it("rejects extra, reassigned, and reuse-disabled approved asset contexts", async () => {
    const base = createStandaloneAuthoritativeWholeStorefrontPlanningContextSource();
    const browserRequest = requestFor(aurumNordicSeed);
    const responseFor = async (
      update: (
        context: Awaited<ReturnType<AuthoritativeWholeStorefrontPlanningContextSource["load"]>>,
      ) => void,
    ) => {
      const source: AuthoritativeWholeStorefrontPlanningContextSource = {
        load: async (input) => {
          const context = structuredClone(await base.load(input));
          update(context);
          if (context.approvedAssetContext !== null) {
            context.approvedAssetContext.fingerprint =
              createApprovedGenerationAssetContextFingerprint(context.approvedAssetContext);
          }
          return context;
        },
      };
      return createWholeStorefrontPlanningRouteHandler({
        authority: createStandaloneServerWholeStorefrontPlanningAuthority({
          contextSource: source,
        }),
        selectProvider: () => recordingProvider(() => undefined),
      })(
        new Request("http://localhost/api/ai/whole-storefront-proposals", {
          method: "POST",
          body: JSON.stringify(browserRequest),
        }),
      );
    };

    const extra = await responseFor((context) => {
      const asset = context.approvedAssetContext?.assets[0];
      if (!asset || !context.approvedAssetContext) throw new Error("Missing approved test asset");
      context.approvedAssetContext.assets.push({ ...asset, assetId: "asset_unapproved" });
    });
    const changedRole = await responseFor((context) => {
      const asset = context.approvedAssetContext?.assets[0];
      if (!asset) throw new Error("Missing approved test asset");
      asset.role = "editorialImage";
    });
    const reuseDisabled = await responseFor((context) => {
      context.brief.generationPermissions.allowAssetReuse = false;
    });

    expect(extra.status).toBe(400);
    expect(changedRole.status).toBe(400);
    expect(reuseDisabled.status).toBe(400);
  });

  it("keeps Aurum and Karvonen briefs and approved assets project-isolated", async () => {
    const authority = createStandaloneServerWholeStorefrontPlanningAuthority();
    const aurum = await authority.resolve(
      requestFor(aurumNordicSeed),
      new Request("http://localhost"),
    );
    const karvonen = await authority.resolve(
      requestFor(karvonenSeed, "fi"),
      new Request("http://localhost"),
    );

    expect(aurum.planningInput.brief.businessIdentity.businessName).toBe("Aurum Nordic");
    expect(karvonen.planningInput.brief.businessIdentity.businessName).toBe("Karvonen");
    expect(aurum.planningInput.approvedAssetContext?.assets[0]?.assetId).not.toBe(
      karvonen.planningInput.approvedAssetContext?.assets[0]?.assetId,
    );
    expect(karvonen.planningInput.brief.languagePlan.selectedLanguages).toContain("fi");
  });

  it("rejects a proposal as stale when the authoritative approved asset fingerprint changes", async () => {
    const base = createStandaloneAuthoritativeWholeStorefrontPlanningContextSource();
    let loads = 0;
    const source: AuthoritativeWholeStorefrontPlanningContextSource = {
      load: async (input) => {
        const context = structuredClone(await base.load(input));
        if (loads++ === 0 || context.approvedAssetContext === null) return context;
        const assetContext = { ...context.approvedAssetContext, assets: [] };
        return {
          ...context,
          approvedAssetContext: {
            ...assetContext,
            fingerprint: createApprovedGenerationAssetContextFingerprint(assetContext),
          },
        };
      },
    };
    const handler = createWholeStorefrontPlanningRouteHandler({
      authority: createStandaloneServerWholeStorefrontPlanningAuthority({ contextSource: source }),
      selectProvider: () => recordingProvider(() => undefined),
    });

    const response = await handler(
      new Request("http://localhost/api/ai/whole-storefront-proposals", {
        method: "POST",
        body: JSON.stringify(requestFor(aurumNordicSeed)),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      failure: { category: "stale", retryable: false },
    });
  });
});
