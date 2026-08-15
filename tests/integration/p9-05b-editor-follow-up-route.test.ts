// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { aiStorefrontProviderResponseSchema } from "@/application/ai-storefront-generation";
import {
  buildP905bLocalDemoRequest,
  p905bLocalDemoSession,
  resetP905bLocalDemo,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import { createServerWholeStorefrontPlanningClient } from "@/integrations/ai/whole-storefront-runtime-client";

const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "deterministic",
  VESKIFY_P9_05B_LOCAL_DEMO: "1",
} as const;

function configureEnvironment() {
  for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("P9-05B integrated editor follow-up composition", () => {
  it("resolves the production-disabled session authority for the explicitly tagged client path", async () => {
    configureEnvironment();
    await resetP905bLocalDemo(environment);
    const providerRequest = await buildP905bLocalDemoRequest(
      "Create a premium editorial storefront while preserving canonical commerce truth.",
      environment,
    );
    const session = p905bLocalDemoSession(environment);
    const { POST } = await import("@/app/api/ai/whole-storefront-proposals/route");
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(url).toBe("/api/ai/whole-storefront-proposals");
      return POST(new Request(new URL(url, "http://p9-05b.test"), init));
    });
    vi.stubGlobal("fetch", fetchMock);

    const proposal = await createServerWholeStorefrontPlanningClient({
      p905bSessionId: session.sessionId,
    }).proposeStorefront(providerRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(aiStorefrontProviderResponseSchema.safeParse(proposal).success).toBe(true);
  });

  it("does not activate the P9 authority without the registered follow-up operation tag", async () => {
    configureEnvironment();
    await resetP905bLocalDemo(environment);
    const providerRequest = await buildP905bLocalDemoRequest(
      "Create a premium editorial storefront while preserving canonical commerce truth.",
      environment,
    );
    const session = p905bLocalDemoSession(environment);
    const { POST } = await import("@/app/api/ai/whole-storefront-proposals/route");

    const response = await POST(
      new Request("http://p9-05b.test/api/ai/whole-storefront-proposals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-veskify-p9-05b-session": session.sessionId,
        },
        body: JSON.stringify(providerRequest),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      failure: { category: "validation", retryable: false },
    });
  });
});
