// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createPromptedStorefrontComposition } from "@/app/api/ai/whole-storefront-proposals/prompted-composition.server";
import { createMerchantProjectAuthorization } from "@/application/merchant-project-context";
import {
  PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
  PROMPTED_STOREFRONT_STUDIO_OPERATION,
} from "@/application/prompted-storefront-studio";
import { VeskoIntegrationError } from "@/application/vesko-integration/contract";
import {
  createP10B16P03RawKarvonenStudioFixture,
  P10B16P03_DRAFT_ID,
  P10B16P03_PROJECT_ID,
} from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import { createP10B16P03MockPromptedStorefrontDesignIntentProvider } from "@/integrations/ai/mock-prompted-storefront-design-intent-v2-provider.server";
import {
  createP10B16P03ServerPromptedStorefrontStudioAuthority,
  unavailableServerPromptedStorefrontStudioAuthority as oldUnavailable,
} from "@/integrations/ai/prompted-storefront-studio-authority.server";
import { unavailableServerPromptedStorefrontStudioAuthority } from "@/integrations/ai/prompted-storefront-studio-authority-contract.server";
import {
  mapServerWholeStorefrontFailure,
  ServerWholeStorefrontAuthorityError,
} from "@/integrations/ai/whole-storefront-failures";
import {
  mapServerWholeStorefrontFailure as oldMap,
  ServerWholeStorefrontAuthorityError as OldAuthorityError,
} from "@/integrations/ai/whole-storefront-runtime-authority";
import { ProjectNotFoundError as publicProjectNotFoundError } from "@/services/storage";
import { ProjectNotFoundError } from "@/services/storage/project-repository";

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/ai/whole-storefront-proposals", {
    method: "POST",
    body: JSON.stringify({
      operation: PROMPTED_STOREFRONT_STUDIO_OPERATION,
      contractVersion: PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
      requestId: "ar04-generation",
      projectId: P10B16P03_PROJECT_ID,
      draftSnapshotId: P10B16P03_DRAFT_ID,
      draftRevision: 0,
      activeLocale: "en",
      targetScope: "storefront",
      merchantPrompt: "Create a refined premium jewellery storefront with editorial storytelling.",
      ...overrides,
    }),
  });
}

describe("AR-04 normal composition", () => {
  it("preserves public constructors, mapping function and unavailable singleton identity", () => {
    expect(OldAuthorityError).toBe(ServerWholeStorefrontAuthorityError);
    expect(oldMap).toBe(mapServerWholeStorefrontFailure);
    expect(oldUnavailable).toBe(unavailableServerPromptedStorefrontStudioAuthority);
    expect(publicProjectNotFoundError).toBe(ProjectNotFoundError);
    expect(new ProjectNotFoundError("missing")).toBeInstanceOf(publicProjectNotFoundError);
    class Child extends OldAuthorityError {}
    expect(new Child("unauthorized")).toBeInstanceOf(ServerWholeStorefrontAuthorityError);
    expect(oldMap(new Child("unauthorized"))).toEqual({
      status: 401,
      category: "permissionDenied",
      retryable: false,
    });
    expect(
      mapServerWholeStorefrontFailure(new VeskoIntegrationError("authenticationUnavailable")),
    ).toEqual({ status: 503, category: "authenticationUnavailable", retryable: true });
    expect(
      mapServerWholeStorefrontFailure(
        new ServerWholeStorefrontAuthorityError("authentication-unavailable"),
      ),
    ).toEqual({ status: 503, category: "authenticationUnavailable", retryable: false });
    expect(
      mapServerWholeStorefrontFailure({
        name: "ServerWholeStorefrontAuthorityError",
        code: "unauthorized",
      }),
    ).toEqual({ status: 500, category: "internalFailure", retryable: false });
  });

  it.each(["integrated", "standalone", "unconfigured"])(
    "fails closed before provider selection without authority in %s mode",
    async (mode) => {
      const selectPromptedProvider = vi.fn(() => {
        throw new Error("Provider selection must not execute");
      });
      const handler = createPromptedStorefrontComposition({
        environment: { VESKIFY_RUNTIME_MODE: mode, VESKIFY_AI_PROVIDER: "openai" },
        selectPromptedProvider,
      });
      const response = await handler(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        ok: false,
        failure: { category: "authenticationUnavailable", retryable: false },
      });
      expect(selectPromptedProvider).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ projectId: "project_unknown" }, 400, "validation"],
    [{ draftSnapshotId: "draft_unknown" }, 409, "stale"],
    [{ draftRevision: 1 }, 409, "stale"],
    [{ activeLocale: "sv" }, 400, "validation"],
  ] as const)(
    "preserves current project/draft/locale rejection for %j",
    async (body, status, category) => {
      const fixture = createP10B16P03RawKarvonenStudioFixture();
      const before = JSON.stringify(fixture);
      const selectPromptedProvider = vi.fn(() => {
        throw new Error("No provider selection");
      });
      const handler = createPromptedStorefrontComposition({
        promptedAuthority: createP10B16P03ServerPromptedStorefrontStudioAuthority({
          loadFixture: () => fixture,
        }),
        selectPromptedProvider,
      });
      const response = await handler(request(body));
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ ok: false, failure: { category, retryable: false } });
      expect(selectPromptedProvider).not.toHaveBeenCalled();
      expect(JSON.stringify(fixture)).toBe(before);
    },
  );

  it("enforces the real request-ai-design action before selecting a provider", async () => {
    const authority = createP10B16P03ServerPromptedStorefrontStudioAuthority();
    const selectPromptedProvider = vi.fn(() => {
      throw new Error("No provider selection");
    });
    const handler = createPromptedStorefrontComposition({
      promptedAuthority: {
        async resolve(input, httpRequest) {
          const current = await authority.resolve(input, httpRequest);
          return {
            ...current,
            authorization: createMerchantProjectAuthorization({
              ...current.authorization.context,
              roles: ["viewer"],
              permissions: ["readStorefront"],
            }),
          };
        },
      },
      selectPromptedProvider,
    });
    const response = await handler(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      failure: { category: "permissionDenied", retryable: false },
    });
    expect(selectPromptedProvider).not.toHaveBeenCalled();
  });

  it("retains tenant mismatch as a terminal trusted-authority failure", async () => {
    const selectPromptedProvider = vi.fn(() => {
      throw new Error("No provider selection");
    });
    const handler = createPromptedStorefrontComposition({
      promptedAuthority: {
        resolve: () => Promise.reject(new VeskoIntegrationError("tenantMismatch")),
      },
      selectPromptedProvider,
    });
    const response = await handler(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      failure: { category: "tenantMismatch", retryable: false },
    });
    expect(selectPromptedProvider).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "preserves terminal lifecycle failures with refusal=%s",
    async (refusal) => {
      const fixture = createP10B16P03RawKarvonenStudioFixture();
      const before = JSON.stringify(fixture);
      const providerCalls = vi.fn();
      const success = vi.fn(() => {
        throw new Error("Success recording failed");
      });
      const failure = vi.fn(() => {
        throw new Error("Failure recording failed");
      });
      const handler = createPromptedStorefrontComposition({
        promptedAuthority: createP10B16P03ServerPromptedStorefrontStudioAuthority({
          loadFixture: () => fixture,
        }),
        selectPromptedProvider: () =>
          createP10B16P03MockPromptedStorefrontDesignIntentProvider({
            scenario: "premium-editorial",
            onRequest: providerCalls,
            ...(refusal ? { failure: "provider-refusal" as const } : {}),
          }),
        promptedLifecycle: { success, failure },
      });
      const response = await handler(request());
      expect(response.status).toBe(refusal ? 400 : 500);
      expect(await response.json()).toEqual({
        ok: false,
        failure: { category: refusal ? "validation" : "internalFailure", retryable: false },
      });
      expect(providerCalls).toHaveBeenCalledTimes(1);
      expect(success).toHaveBeenCalledTimes(refusal ? 0 : 1);
      expect(failure).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(fixture)).toBe(before);
    },
  );

  it("loads and constructs the actual normal entry without dedicated local or legacy modules", async () => {
    vi.resetModules();
    const forbidden = [
      "@/data/demo/p10b-16p-03-studio-prompt-generation",
      "@/data/demo/p10b-16p-03-studio-identity",
      "@/integrations/ai/mock-prompted-storefront-design-intent-v2-provider.server",
      "@/integrations/ai/prompted-storefront-studio-authority.server",
      "@/integrations/ai/whole-storefront-runtime-authority",
    ];
    const loaded = vi.fn(() => {
      throw new Error("Forbidden normal composition dependency");
    });
    for (const path of forbidden) vi.doMock(path, loaded);
    try {
      const normal =
        await import("@/app/api/ai/whole-storefront-proposals/prompted-composition.server");
      const handler = normal.createPromptedStorefrontComposition({ environment: {} });
      expect((await handler(request())).status).toBe(503);
      expect(loaded).not.toHaveBeenCalled();
    } finally {
      for (const path of forbidden) vi.doUnmock(path);
      vi.resetModules();
    }
  });
});
