// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWholeStorefrontPlanningRouteHandler } from "@/app/api/ai/whole-storefront-proposals/route";
import { createP905bLocalDemoGenerateHandler } from "@/app/api/demo/p9-05b/generate/route";
import {
  p905bLocalDemoSession,
  resetP905bLocalDemo,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import type { WholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";

const demoToken = "p9-05b-local-demo-token-for-focused-tests";
const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  VESKIFY_P9_05B_LOCAL_DEMO: "1",
  VESKIFY_P9_05B_LOCAL_DEMO_TOKEN: demoToken,
} as const;

function directionProvider(): WholeStorefrontPlanningProvider {
  return {
    id: "mocked-local-demo-provider",
    capabilities: {
      wholeStorefrontPlanning: true,
      structuredPlanOutput: true,
      approvedAssetReferences: true,
    },
    createPlan: (request) => Promise.resolve(request.planForDirection("premiumEditorial")),
  };
}

function request(input: {
  sessionId: string;
  token?: string;
  origin?: string;
  contentType?: string;
  projectId?: string;
}) {
  return new Request("http://p9-05b.test/api/demo/p9-05b/generate", {
    method: "POST",
    headers: {
      ...(input.origin === undefined ? {} : { origin: input.origin }),
      ...(input.contentType === undefined ? {} : { "content-type": input.contentType }),
      ...(input.token === undefined ? {} : { "x-veskify-p9-05b-demo-token": input.token }),
    },
    body: JSON.stringify({
      merchantInstruction: "Create a premium editorial storefront for Lumo Atelier.",
      projectId: input.projectId ?? "project_lumo_fresh",
      sessionId: input.sessionId,
    }),
  });
}

describe("P9-05B local demo generation authorization", () => {
  beforeEach(async () => {
    await resetP905bLocalDemo(environment);
  });

  it("allows one same-origin authorized JSON generation and exposes the editor bridge route", async () => {
    const providerCalls = vi.fn();
    const route = createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: () => directionProvider(),
    });
    const handler = createP905bLocalDemoGenerateHandler({
      environment,
      createProposalHandler: async (input) => {
        providerCalls();
        return route(input);
      },
    });
    const session = p905bLocalDemoSession(environment);

    const response = await handler(
      request({
        sessionId: session.sessionId,
        token: demoToken,
        origin: "http://p9-05b.test",
        contentType: "application/json",
      }),
    );
    const body = (await response.json()) as { editorRoute?: string; ok?: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.editorRoute).toBe(
      `/projects/project_lumo_fresh/editor?p9-05b-session=${encodeURIComponent(session.sessionId)}`,
    );
    expect(providerCalls).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "cross-origin",
      { origin: "https://other.example", contentType: "application/json", token: demoToken },
    ],
    ["text content", { origin: "http://p9-05b.test", contentType: "text/plain", token: demoToken }],
    ["missing token", { origin: "http://p9-05b.test", contentType: "application/json" }],
    [
      "invalid token",
      { origin: "http://p9-05b.test", contentType: "application/json", token: "invalid" },
    ],
  ])("rejects %s before invoking the provider", async (_name, headers) => {
    const providerCalls = vi.fn();
    const handler = createP905bLocalDemoGenerateHandler({
      environment,
      createProposalHandler: () => {
        providerCalls();
        return Promise.reject(new Error("The provider must not be called."));
      },
    });
    const response = await handler(
      request({ sessionId: p905bLocalDemoSession(environment).sessionId, ...headers }),
    );

    expect(response.status).toBe(403);
    expect(providerCalls).not.toHaveBeenCalled();
  });

  it("rejects a duplicate controlled call without another provider invocation", async () => {
    const providerCalls = vi.fn();
    const route = createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: () => directionProvider(),
    });
    const handler = createP905bLocalDemoGenerateHandler({
      environment,
      createProposalHandler: async (input) => {
        providerCalls();
        return route(input);
      },
    });
    const sessionId = p905bLocalDemoSession(environment).sessionId;
    const input = {
      sessionId,
      token: demoToken,
      origin: "http://p9-05b.test",
      contentType: "application/json",
    };

    expect((await handler(request(input))).status).toBe(200);
    expect((await handler(request(input))).status).toBe(400);
    expect(providerCalls).toHaveBeenCalledTimes(1);
  });

  it("is unavailable by default without the explicit local demo configuration", async () => {
    const handler = createP905bLocalDemoGenerateHandler({
      environment: { NODE_ENV: "test", VESKIFY_RUNTIME_MODE: "integrated" },
    });
    const response = await handler(
      request({
        sessionId: "a".repeat(43),
        token: demoToken,
        origin: "http://p9-05b.test",
        contentType: "application/json",
      }),
    );
    expect(response.status).toBe(404);
  });
});
