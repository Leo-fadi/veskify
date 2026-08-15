// @vitest-environment node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("P10B-16P-05A active production-path architecture", () => {
  it("keeps the normal proposal handler free of demo and acceptance authority", () => {
    const handler = source("src/app/api/ai/whole-storefront-proposals/handler.ts");

    expect(handler).toContain("PROMPTED_STOREFRONT_STUDIO_OPERATION");
    expect(handler).toContain("REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION");
    expect(handler).toContain("promptedOperation && !followUpOperation");
    expect(handler).toContain("followUpOperation && !promptedOperation");
    expect(handler).toContain('{ category: "validation", retryable: false }');
    expect(handler).not.toMatch(/p9-05b|p10b-16l|p10b-16p-0[34]|data\/demo/u);
  });

  it("isolates production-disabled acceptance and historical P9 authority from the normal handler", () => {
    const p03 = source(
      "src/app/api/ai/whole-storefront-proposals/p10b-16p-03-composition.server.ts",
    );
    const p04 = source(
      "src/app/api/ai/whole-storefront-proposals/p10b-16p-04-composition.server.ts",
    );
    const p9 = source("src/app/api/demo/p9-05b/generate/handler.ts");
    const p9FollowUp = source(
      "src/app/api/ai/whole-storefront-proposals/p9-05b-composition.server.ts",
    );
    const route = source("src/app/api/ai/whole-storefront-proposals/route.ts");

    for (const composition of [p03, p04]) {
      expect(composition).toContain("createServerPromptedStorefrontStudioHandler");
      expect(composition).not.toContain("createWholeStorefrontPlanningRouteHandler");
      expect(composition).not.toContain("createServerWholeStorefrontPlanningHandler");
    }
    expect(p9).toContain("createServerWholeStorefrontPlanningHandler");
    expect(p9).not.toContain("createServerPromptedStorefrontStudioHandler");
    expect(p9).not.toContain("createWholeStorefrontPlanningRouteHandler");
    expect(p9FollowUp).toContain("createP905bLocalDemoAuthority");
    expect(p9FollowUp).toContain("createWholeStorefrontPlanningRouteHandler");
    expect(route).toContain('process.env.NODE_ENV !== "production"');
    expect(route).toContain('process.env.VESKIFY_P9_05B_LOCAL_DEMO === "1"');
    expect(route).toContain('await import("./p9-05b-composition.server")');
  });

  it("keeps the retained registered follow-up transport explicitly tagged", () => {
    const contract = source("src/application/ai-storefront-generation/contract.ts");
    const client = source("src/integrations/ai/whole-storefront-runtime-client.ts");

    expect(contract).toContain("REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION");
    expect(contract).toContain("WHOLE_STOREFRONT_PROPOSAL_OPERATION_HEADER");
    expect(client).toContain("REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION");
    expect(client).toContain("WHOLE_STOREFRONT_PROPOSAL_OPERATION_HEADER");
  });

  it("removes the executable-intent bridge and its active route family", () => {
    const removed = [
      "src/application/bounded-storefront-synthesis/live-provider-acceptance.ts",
      "src/integrations/ai/p10b-live-synthesis-acceptance-authority.server.ts",
      "src/integrations/ai/p10b-live-synthesis-acceptance-client.ts",
      "src/integrations/ai/openai/p10b-live-synthesis-intent-provider.ts",
      "src/integrations/ai/openai/p10b-live-synthesis-intent-client.server.ts",
      "src/app/api/demo/p10b-live/route.ts",
      "src/app/api/demo/p10b-live/accept/handler.ts",
      "src/app/api/demo/p10b-live/accept/route.ts",
      "src/app/api/demo/p10b-live/generate/handler.ts",
      "src/app/api/demo/p10b-live/generate/route.ts",
      "src/app/api/demo/p10b-live/reject/handler.ts",
      "src/app/api/demo/p10b-live/reject/route.ts",
      "src/app/api/demo/p10b-live/synchronize/handler.ts",
      "src/app/api/demo/p10b-live/synchronize/route.ts",
    ];

    removed.forEach((path) => expect(existsSync(join(root, path)), path).toBe(false));
    const activeSource = [
      source("src/app/projects/[projectId]/editor/page.tsx"),
      source("src/app/projects/[projectId]/editor/project-editor-client.tsx"),
      source("src/app/projects/[projectId]/project-preview-client.tsx"),
    ].join("\n");
    expect(activeSource).not.toMatch(/p10b-16l|executableIntentId/u);
  });

  it("keeps semantic resolution metadata-only and the executor as sole prompted materializer", () => {
    const compilerRoot = join(root, "src/application/prompted-storefront-design-compiler");
    const files = readdirSync(compilerRoot)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => ({ name, text: readFileSync(join(compilerRoot, name), "utf8") }));
    const completeMaterializers = files.filter(({ text }) =>
      text.includes("executeBoundedStorefrontSynthesis"),
    );
    const coordinator = files.find(({ name }) => name === "coordinator.ts")?.text ?? "";
    const resolver = files.find(
      ({ name }) => name === "semantic-compatibility-resolution.ts",
    )?.text;

    expect(completeMaterializers.map(({ name }) => name)).toEqual(["executor.ts"]);
    expect(resolver).not.toMatch(
      /executeBoundedStorefrontSynthesis|materializeCompleteStorefront/u,
    );
    expect(coordinator.match(/provider\.createDesignIntent/g)).toHaveLength(1);
    expect(coordinator).toContain("requireExactlyOneMaterialization");
  });

  it("keeps browser authority compact and server-owned", () => {
    const studioContract = source("src/application/prompted-storefront-studio/contract.ts");
    const requestStart = studioContract.indexOf(
      "export const promptedStorefrontStudioGenerationRequestSchema",
    );
    const requestEnd = studioContract.indexOf("/** Safe correlation evidence", requestStart);
    expect(requestStart).toBeGreaterThanOrEqual(0);
    expect(requestEnd).toBeGreaterThan(requestStart);
    const studioRequestContract = studioContract.slice(requestStart, requestEnd);
    const studioHandler = source(
      "src/integrations/ai/prompted-storefront-studio-handler.server.ts",
    );

    expect(studioRequestContract).toContain("merchantPrompt");
    expect(studioRequestContract).not.toMatch(
      /providerIntent|compiledDecision|candidateSnapshot|capabilityAuthority/u,
    );
    expect(studioHandler).toContain("context.loadCurrentAuthority");
    expect(studioHandler).toContain("runPromptedStorefrontDesignCompilation");
    expect(studioHandler).not.toMatch(/selectionId|executableIntentId/u);
  });
});
