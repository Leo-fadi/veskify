// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createStandaloneVeskoIntegrationAssembly,
  integrationReadiness,
} from "@/application/vesko-integration";
import { aurumNordicSeed } from "@/data/seed";
import {
  createVeskoStagingAuthorizationProvider,
  createVeskoStagingTransport,
  readVeskoStagingConfiguration,
  VeskoStagingAuthenticationError,
  type VeskoStagingConfiguration,
} from "@/integrations/vesko-staging/index.server";
import { InMemoryProjectRepository } from "@/services/storage";

function configuration(
  overrides: Partial<VeskoStagingConfiguration> = {},
): VeskoStagingConfiguration {
  return {
    baseUrl: new URL("https://staging.vesko.test/api/"),
    authentication: { required: true, kind: "injected" },
    timeoutMs: 1_000,
    ...overrides,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    operation: "catalogue-read",
    method: "GET" as const,
    route: "/catalogue/projection?customer=never-log-this",
    response: "json" as const,
    ...overrides,
  };
}

describe("P10-01 Vesko staging transport and authentication foundation", () => {
  it("fails safely when required staging configuration is absent or invalid", () => {
    const missingConfiguration = (() => {
      try {
        readVeskoStagingConfiguration({});
      } catch (error) {
        return error;
      }
      throw new Error("Expected staging configuration to fail.");
    })();
    expect(missingConfiguration).toMatchObject({
      code: "configurationUnavailable",
    });
    expect(() =>
      readVeskoStagingConfiguration({ VESKO_STAGING_BASE_URL: "http://not-secure.test" }),
    ).toThrow("Vesko staging configuration is unavailable or invalid.");
  });

  it("attaches injected authorization headers without logging them", async () => {
    const events: unknown[] = [];
    const fetch = vi.fn(async (_url: URL, init: { headers: Headers }) => {
      expect(init.headers.get("authorization")).toBe("opaque credential");
      expect(init.headers.get("x-correlation-id")).toBe("correlation_01");
      return new Response(JSON.stringify({ result: "ok" }), { status: 200 });
    });
    const transport = createVeskoStagingTransport({
      configuration: configuration({ correlationHeaderName: "x-correlation-id" }),
      authentication: createVeskoStagingAuthorizationProvider({
        obtain: async () => ({ headers: { authorization: "opaque credential" } }),
      }),
      fetch,
      logger: { log: (event) => events.push(event) },
    });

    await transport.request(request({ correlationId: "correlation_01" }));

    expect(events).toEqual([
      expect.objectContaining({
        operation: "catalogue-read",
        route: "/catalogue/projection",
        correlationId: "correlation_01",
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("opaque credential");
    expect(JSON.stringify(events)).not.toContain("customer=never-log-this");
  });

  it("normalizes token and authentication failures", async () => {
    const transport = createVeskoStagingTransport({
      configuration: configuration(),
      authentication: {
        authorize: async () => {
          throw new VeskoStagingAuthenticationError("permissionDenied");
        },
      },
      fetch: vi.fn(),
    });

    await expect(transport.request(request())).rejects.toMatchObject({ code: "permissionDenied" });
  });

  it("maps timeout and caller abort without starting a retry", async () => {
    const timedOutFetch = vi.fn(
      (_url: URL, init: { signal: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("", "AbortError")), {
            once: true,
          });
        }),
    );
    const timeoutTransport = createVeskoStagingTransport({
      configuration: configuration({
        authentication: { required: false, kind: "injected" },
        timeoutMs: 1,
      }),
      fetch: timedOutFetch,
    });
    await expect(timeoutTransport.request(request())).rejects.toMatchObject({ code: "timeout" });
    expect(timedOutFetch).toHaveBeenCalledTimes(1);

    const controller = new AbortController();
    controller.abort();
    const abortedTransport = createVeskoStagingTransport({
      configuration: configuration({ authentication: { required: false, kind: "injected" } }),
      fetch: vi.fn(),
    });
    await expect(
      abortedTransport.request(request({ signal: controller.signal })),
    ).rejects.toMatchObject({
      code: "requestAborted",
    });
  });

  it("normalizes non-success HTTP statuses without parsing backend bodies", async () => {
    const outcomes = [
      [401, "authenticationUnavailable"],
      [403, "permissionDenied"],
      [404, "resourceNotFound"],
      [409, "staleRevision"],
      [429, "rateLimited"],
      [503, "stagingUnavailable"],
    ] as const;

    for (const [status, code] of outcomes) {
      const transport = createVeskoStagingTransport({
        configuration: configuration({ authentication: { required: false, kind: "injected" } }),
        fetch: async () => new Response("sensitive backend error", { status }),
      });
      await expect(transport.request(request())).rejects.toMatchObject({ code, status });
    }
  });

  it("rejects malformed JSON responses", async () => {
    const transport = createVeskoStagingTransport({
      configuration: configuration({ authentication: { required: false, kind: "injected" } }),
      fetch: async () => new Response("not-json", { status: 200 }),
    });

    await expect(transport.request(request())).rejects.toMatchObject({ code: "malformedResponse" });
  });

  it("preserves opaque ETag and configured revision values exactly", async () => {
    const transport = createVeskoStagingTransport({
      configuration: configuration({
        authentication: { required: false, kind: "injected" },
        revisionHeaderName: "x-vesko-revision",
      }),
      fetch: async () =>
        new Response(JSON.stringify({ result: "ok" }), {
          status: 200,
          headers: { etag: 'W/"opaque-v1"', "x-vesko-revision": "revision/not-a-number" },
        }),
    });

    await expect(transport.request(request())).resolves.toMatchObject({
      etag: 'W/"opaque-v1"',
      revision: "revision/not-a-number",
    });
  });

  it("does not automatically retry mutation requests", async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ result: "saved" }), { status: 201 }),
    );
    const transport = createVeskoStagingTransport({
      configuration: configuration({ authentication: { required: false, kind: "injected" } }),
      fetch,
    });

    await transport.request(
      request({
        operation: "draft-save",
        method: "POST",
        route: "/storefront/drafts",
        body: '{"opaque":true}',
        expectedStatuses: [201],
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("leaves standalone Phase 9 assembly credential-free", () => {
    const repository = new InMemoryProjectRepository([
      {
        project: structuredClone(aurumNordicSeed.project),
        catalogue: structuredClone(aurumNordicSeed.catalogue),
        snapshots: [
          structuredClone(aurumNordicSeed.publishedSnapshot),
          structuredClone(aurumNordicSeed.draftSnapshot),
        ],
      },
    ]);
    const ports = createStandaloneVeskoIntegrationAssembly({
      projectRepository: repository,
      catalogue: structuredClone(aurumNordicSeed.catalogue),
      identity: {
        tenantId: "tenant_p10_01",
        userId: "user_p10_01",
        merchantId: "merchant_p10_01",
        organizationId: "organization_p10_01",
        storeId: "store_p10_01",
        storefrontProjectId: aurumNordicSeed.project.id,
      },
      saveProvenanceSource: {
        resolveSaveProvenance: async () => {
          throw new Error("Not used by assembly readiness.");
        },
      },
      publishPreparations: { load: async () => null },
    });

    expect(integrationReadiness(ports).standaloneCredentialFree).toBe(true);
  });
});
