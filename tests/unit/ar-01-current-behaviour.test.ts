import { writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveRendererConformanceReport } from "@/components/registry";
import { runPromptedStorefrontDesignCompilation } from "@/application/prompted-storefront-design-compiler";
import * as semanticCompiler from "@/application/prompted-storefront-design-compiler/semantic-compiler";
import * as executor from "@/application/prompted-storefront-design-compiler/executor";
import * as materializer from "@/application/whole-storefront-generation-plan/complete-storefront-materializer";
import * as siteMap from "@/application/storefront-site-map/materializer";
import { migrateLegacyDynamicCommerceRoutes } from "@/application/dynamic-commerce-routes";
import { P10B14_PREMIUM_EDITORIAL_SELECTION } from "@/application/premium-editorial-vertical-slice";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import {
  P10B16P03_DRAFT_ID,
  P10B16P03_PROJECT_ID,
} from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import {
  promptedStorefrontStudioGenerationRequestSchema,
  PROMPTED_STOREFRONT_STUDIO_OPERATION,
  PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
} from "@/application/prompted-storefront-studio";
import { createP10B16P03MockPromptedStorefrontDesignIntentProvider } from "@/integrations/ai/mock-prompted-storefront-design-intent-v2-provider.server";
import { createP10B16P03ServerPromptedStorefrontStudioAuthority } from "@/integrations/ai/prompted-storefront-studio-authority.server";

vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());

describe("AR-01 current behaviour characterization", () => {
  it("records live renderer conformance without asserting a preferred finding count", () => {
    const report = createLiveRendererConformanceReport();
    const measured = {
      fingerprint: report.fingerprint,
      findings: report.findings.map(({ id, classification }) => ({ id, classification })),
      blocking: report.blockingDefects.length,
      metadata: report.metadataGaps.length,
      deliberate: report.deliberateFutureCapabilities.length,
      commercial: report.commercialGaps.length,
    };
    process.stdout.write(`AR01_RENDERER_CONFORMANCE ${JSON.stringify(measured)}\n`);
    if (process.env.AR01_CONFORMANCE_OUTPUT)
      writeFileSync(process.env.AR01_CONFORMANCE_OUTPUT, `${JSON.stringify(measured, null, 2)}\n`);
    expect(new Set(measured.findings.map(({ id }) => id)).size).toBe(measured.findings.length);
    expect(measured.findings.length).toBe(
      measured.blocking + measured.metadata + measured.deliberate + measured.commercial,
    );
  });

  it("observes provider completion before exact compilation, execution and materialization", async () => {
    const authority = createP10B16P03ServerPromptedStorefrontStudioAuthority();
    const input = promptedStorefrontStudioGenerationRequestSchema.parse({
      operation: PROMPTED_STOREFRONT_STUDIO_OPERATION,
      contractVersion: PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
      requestId: "ar01-order",
      projectId: P10B16P03_PROJECT_ID,
      draftSnapshotId: P10B16P03_DRAFT_ID,
      draftRevision: 0,
      activeLocale: "en",
      targetScope: "storefront",
      merchantPrompt: "Create a premium editorial storefront with clear product discovery.",
    });
    const context = await authority.resolve(
      input,
      new Request("http://localhost/api/ai/whole-storefront-proposals", { method: "POST" }),
    );
    const current = await context.loadCurrentAuthority();
    const provider = createP10B16P03MockPromptedStorefrontDesignIntentProvider({
      scenario: "premium-editorial",
      compatibilityInput: current.compatibilityInput,
    });
    const events: string[] = [];
    const compile = semanticCompiler.compileSemanticStorefrontDesignIntentV1;
    vi.spyOn(semanticCompiler, "compileSemanticStorefrontDesignIntentV1").mockImplementation(
      (input) => {
        events.push("compile");
        return compile(input);
      },
    );
    const execute = executor.executeCompiledSemanticStorefrontDesignIntentV1;
    vi.spyOn(executor, "executeCompiledSemanticStorefrontDesignIntentV1").mockImplementation(
      (input) => {
        events.push("execute");
        return execute(input);
      },
    );
    const materialize = materializer.materializeCompleteStorefrontSelection;
    vi.spyOn(materializer, "materializeCompleteStorefrontSelection").mockImplementation((input) => {
      events.push("materialize");
      return materialize(input);
    });
    const result = await runPromptedStorefrontDesignCompilation({
      provider: {
        ...provider,
        async createDesignIntent(...args) {
          events.push("provider-start");
          const intent = await provider.createDesignIntent(...args);
          events.push("provider-complete");
          return intent;
        },
      },
      loadCurrentAuthority: context.loadCurrentAuthority,
    });
    expect(events).toEqual([
      "provider-start",
      "provider-complete",
      "compile",
      "execute",
      "materialize",
    ]);
    expect(result.evidence.materializationCount).toBe(1);
    process.stdout.write(`AR01_GENERATION_ORDER ${JSON.stringify(events)}\n`);
  }, 120_000);

  it("projects existing compact route identities temporarily and folds them without source writes", () => {
    const source = createP10B14PremiumEditorialFixture();
    const catalogue = source.fixture.planningInput.catalogue;
    const originalCatalogue = structuredClone(catalogue);
    const migration = migrateLegacyDynamicCommerceRoutes(source.slice.snapshot, catalogue);
    if (migration.status === "requires-decision")
      throw new Error("Expected supported fixture migration");
    const compact = migration.snapshot;
    const original = structuredClone(compact);
    const routes = compact.dynamicCommercePresentation!.routeInventory;
    const decision = structuredClone(source.siteMapDecision);
    for (const page of decision.pages) {
      const existing =
        routes.find((route) => route.route === page.route) ??
        compact.pages.find((candidate) => candidate.slug === page.route);
      if (existing) page.existingPageId = existing.id;
    }
    const referencedRoutes = routes.filter((route) =>
      decision.pages.some((page) => page.existingPageId === route.id),
    );
    expect(referencedRoutes.length).toBeGreaterThan(0);
    const materializeSiteMap = siteMap.materializeStorefrontSiteMap;
    let observedProjection = false;
    vi.spyOn(siteMap, "materializeStorefrontSiteMap").mockImplementation((input) => {
      observedProjection = true;
      expect(input.baseSnapshot.dynamicCommercePresentation).toBeUndefined();
      for (const route of referencedRoutes)
        expect(input.baseSnapshot.pages.find(({ id }) => id === route.id)).toMatchObject({
          id: route.id,
          slug: route.route,
          sections: [],
        });
      return materializeSiteMap(input);
    });
    const result = materializer.materializeCompleteStorefrontSelection({
      planningInput: { ...source.fixture.planningInput, draft: compact },
      siteMapDecision: decision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
      directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
    });
    expect(observedProjection).toBe(true);
    for (const route of referencedRoutes)
      expect(
        result.snapshot.dynamicCommercePresentation!.routeInventory.find(
          ({ id }) => id === route.id,
        ),
      ).toEqual(route);
    expect(
      result.snapshot.pages.some((page) => page.type === "product" || page.type === "collection"),
    ).toBe(false);
    expect(compact).toEqual(original);
    expect(catalogue).toEqual(originalCatalogue);
    process.stdout.write(
      `AR01_COMPACT_ROUNDTRIP ${JSON.stringify({ preservedRoutes: referencedRoutes.length, concreteCommercePages: 0, sourceUnchanged: true })}\n`,
    );
  });
});
