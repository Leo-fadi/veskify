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

describe("P12-01 Vesko staging transport and authentication foundation", () => {
  it("fails safely when required staging configuration is absent or invalid", async () => {
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

    let receivedPath: string | undefined;
    const fetch = vi.fn((url: URL) => {
      receivedPath = url.pathname;
      return Promise.resolve(new Response(JSON.stringify({ result: "ok" }), { status: 200 }));
    });
    const transport = createVeskoStagingTransport({
      configuration: configuration({ authentication: { required: false, kind: "injected" } }),
      fetch,
    });
    for (const route of ["/../admin", "/%2e%2e/admin", "/api2/../../admin", "/\\admin"]) {
      await expect(transport.request(request({ route }))).rejects.toMatchObject({
        code: "configurationUnavailable",
      });
    }
    await transport.request(request({ route: "/catalogue/products?keep=this", response: "json" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(receivedPath).toBe("/api/catalogue/products");
  });

  it("attaches credentials without following redirects or logging raw paths", async () => {
    const events: unknown[] = [];
    let requestCount = 0;
    const fetch = vi.fn((_url: URL, init: { headers: Headers }) => {
      expect(init.headers.get("authorization")).toBe("opaque credential");
      expect(init.headers.get("x-correlation-id")).toBe("correlation_01");
      expect((init as { redirect?: string }).redirect).toBe("manual");
      requestCount += 1;
      return Promise.resolve(
        requestCount === 1
          ? new Response(JSON.stringify({ result: "ok" }), { status: 200 })
          : new Response("redirect body", {
              status: 302,
              headers: { location: "https://other.test" },
            }),
      );
    });
    const transport = createVeskoStagingTransport({
      configuration: configuration({ correlationHeaderName: "x-correlation-id" }),
      authentication: createVeskoStagingAuthorizationProvider({
        obtain: () => Promise.resolve({ headers: { authorization: "opaque credential" } }),
      }),
      fetch,
      logger: { log: (event) => events.push(event) },
    });

    await transport.request(
      request({
        route: "/customers/alice-smith?customer=never-log-this",
        logRouteTemplate: "/customers/:customerId",
        correlationId: "correlation_01",
      }),
    );
    await expect(
      transport.request(
        request({
          route: "/customers/alice-smith?customer=never-log-this",
          logRouteTemplate: "/customers/:customerId",
          correlationId: "correlation_01",
        }),
      ),
    ).rejects.toMatchObject({ code: "stagingUnavailable", status: 302 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(events).toContainEqual(
      expect.objectContaining({
        operation: "catalogue-read",
        route: "/customers/:customerId",
        correlationId: "correlation_01",
      }),
    );
    expect(JSON.stringify(events)).not.toContain("opaque credential");
    expect(JSON.stringify(events)).not.toContain("customer=never-log-this");
    expect(JSON.stringify(events)).not.toContain("alice-smith");
  });

  it("shares authorization acquisition and normalizes token failures despite logger faults", async () => {
    let releaseAuthorization: ((value: { headers: { authorization: string } }) => void) | undefined;
    const obtain = vi.fn(
      () =>
        new Promise<{ headers: { authorization: string } }>((resolve) => {
          releaseAuthorization = resolve;
        }),
    );
    const provider = createVeskoStagingAuthorizationProvider({ obtain });
    const first = provider.authorize({});
    const second = provider.authorize({});
    await Promise.resolve();
    expect(obtain).toHaveBeenCalledTimes(1);
    releaseAuthorization?.({ headers: { authorization: "opaque" } });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);

    const transport = createVeskoStagingTransport({
      configuration: configuration(),
      authentication: {
        authorize: () => Promise.reject(new VeskoStagingAuthenticationError("permissionDenied")),
      },
      fetch: vi.fn(),
      logger: {
        log: () => {
          throw new Error("logger failure");
        },
      },
    });

    await expect(transport.request(request())).rejects.toMatchObject({ code: "permissionDenied" });
  });

  it("enforces one deadline through stalled auth, fetch, and JSON parsing", async () => {
    const stalledFetch = vi.fn();
    const stalledAuthorization = createVeskoStagingTransport({
      configuration: configuration({ timeoutMs: 1 }),
      authentication: { authorize: () => new Promise(() => undefined) },
      fetch: stalledFetch,
      logger: {
        log: () => {
          throw new Error("logger failure");
        },
      },
    });
    await expect(stalledAuthorization.request(request())).rejects.toMatchObject({
      code: "timeout",
    });
    expect(stalledFetch).not.toHaveBeenCalled();

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

    const parsingTransport = createVeskoStagingTransport({
      configuration: configuration({
        authentication: { required: false, kind: "injected" },
        timeoutMs: 1,
      }),
      fetch: (_url, init) =>
        Promise.resolve({
          status: 200,
          headers: new Headers(),
          body: { cancel: vi.fn(() => Promise.resolve()) },
          json: () =>
            new Promise((_, reject) =>
              init.signal.addEventListener(
                "abort",
                () => reject(new DOMException("", "AbortError")),
                {
                  once: true,
                },
              ),
            ),
        } as unknown as Response),
    });
    await expect(parsingTransport.request(request())).rejects.toMatchObject({ code: "timeout" });

    const controller = new AbortController();
    const abortedTransport = createVeskoStagingTransport({
      configuration: configuration(),
      authentication: { authorize: () => new Promise(() => undefined) },
      fetch: vi.fn(),
    });
    const aborted = abortedTransport.request(request({ signal: controller.signal }));
    controller.abort();
    await expect(aborted).rejects.toMatchObject({
      code: "requestAborted",
    });
  });

  it("normalizes protected and non-success statuses before parsing bodies", async () => {
    const outcomes = [
      [401, "authenticationUnavailable"],
      [403, "permissionDenied"],
      [404, "resourceNotFound"],
      [409, "staleRevision"],
      [429, "rateLimited"],
      [302, "stagingUnavailable"],
      [503, "stagingUnavailable"],
    ] as const;

    for (const [status, code] of outcomes) {
      const transport = createVeskoStagingTransport({
        configuration: configuration({ authentication: { required: false, kind: "injected" } }),
        fetch: () => Promise.resolve(new Response("sensitive backend error", { status })),
        logger: {
          log: () => {
            throw new Error("logger failure");
          },
        },
      });
      await expect(transport.request(request())).rejects.toMatchObject({ code, status });
    }
    const noNetwork = vi.fn();
    const invalidExpectedStatus = createVeskoStagingTransport({
      configuration: configuration({ authentication: { required: false, kind: "injected" } }),
      fetch: noNetwork,
    });
    await expect(
      invalidExpectedStatus.request(request({ expectedStatuses: [401] })),
    ).rejects.toMatchObject({ code: "configurationUnavailable" });
    expect(noNetwork).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON responses", async () => {
    const transport = createVeskoStagingTransport({
      configuration: configuration({ authentication: { required: false, kind: "injected" } }),
      fetch: () => Promise.resolve(new Response("not-json", { status: 200 })),
    });

    await expect(transport.request(request())).rejects.toMatchObject({ code: "malformedResponse" });
  });

  it("preserves opaque ETag and configured revision values despite logger faults", async () => {
    const transport = createVeskoStagingTransport({
      configuration: configuration({
        authentication: { required: false, kind: "injected" },
        revisionHeaderName: "x-vesko-revision",
      }),
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ result: "ok" }), {
            status: 200,
            headers: { etag: 'W/"opaque-v1"', "x-vesko-revision": "revision/not-a-number" },
          }),
        ),
      logger: {
        log: () => {
          throw new Error("logger failure");
        },
      },
    });

    await expect(transport.request(request())).resolves.toMatchObject({
      etag: 'W/"opaque-v1"',
      revision: "revision/not-a-number",
    });
  });

  it("does not retry mutations and cancels unread response bodies", async () => {
    const body = { cancel: vi.fn(() => Promise.resolve()) };
    const fetch = vi.fn(() =>
      Promise.resolve({
        status: 201,
        headers: new Headers(),
        body,
        json: vi.fn(),
      } as unknown as Response),
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
        response: "empty",
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(body.cancel).toHaveBeenCalledTimes(1);
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
        resolveSaveProvenance: () => Promise.reject(new Error("Not used by assembly readiness.")),
      },
      publishPreparations: { load: () => Promise.resolve(null) },
    });

    expect(integrationReadiness(ports).standaloneCredentialFree).toBe(true);
  });
});
