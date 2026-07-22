import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OnboardingService, UrlBriefWorkflowOperationError } from "@/application/onboarding";
import {
  discoverStorefrontSource,
  reconcileStorefrontSources,
  type SourceDiscoveryAdapter,
} from "@/application/source-discovery";
import { aurumNordicSeed } from "@/data/seed";
import { onboardingSessionSchema, type OnboardingSession } from "@/domain/onboarding";
import { sourceReferenceSchema, type SourceReference } from "@/domain/source-discovery";
import {
  createPublicSourceDiscoveryAdapter,
  type PublicSourceNetwork,
  type PublicSourceNetworkRequest,
  type PublicSourceNetworkResponse,
  createServerUrlBriefWorkflowService,
  selectServerSourceDiscoveryAdapter,
} from "@/integrations/source-discovery/index.server";
import { extractPublicHtml } from "@/integrations/source-discovery/public-source-html";
import type {
  OnboardingSessionLoadResult,
  OnboardingSessionRepository,
} from "@/services/onboarding";

const retrievedAt = "2026-07-22T14:00:00.000Z";
const encoder = new TextEncoder();

function source(
  url = "https://merchant.example/",
  mode: SourceReference["allowedDiscoveryPolicy"]["mode"] = "bounded-public",
): SourceReference {
  const parsed = new URL(url);
  return sourceReferenceSchema.parse({
    id: "source_public_merchant",
    sourceType: "merchant-provided-url",
    url,
    normalizedOrigin: parsed.origin,
    requestedLocale: "en",
    discoveredAt: retrievedAt,
    allowedDiscoveryPolicy: {
      mode,
      maxPages: mode === "bounded-public" ? 1 : 5,
      maxAssets: 20,
      followSameOriginOnly: true,
    },
    status: "discovering",
    warnings: [],
    failure: null,
  });
}

function htmlResponse(
  html: string,
  overrides: Partial<PublicSourceNetworkResponse> = {},
): PublicSourceNetworkResponse {
  return {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    body: encoder.encode(html),
    ...overrides,
  };
}

type NetworkReply =
  | PublicSourceNetworkResponse
  | Error
  | ((input: PublicSourceNetworkRequest) => Promise<PublicSourceNetworkResponse>);

class MockPublicSourceNetwork implements PublicSourceNetwork {
  readonly resolveCalls: string[] = [];
  readonly requestCalls: PublicSourceNetworkRequest[] = [];

  constructor(
    readonly replies: NetworkReply[],
    readonly addresses: readonly { address: string; family: 4 | 6 }[] = [
      { address: "93.184.216.34", family: 4 },
    ],
  ) {}

  resolve(hostname: string): Promise<readonly { address: string; family: 4 | 6 }[]> {
    this.resolveCalls.push(hostname);
    return Promise.resolve(this.addresses);
  }

  request(input: PublicSourceNetworkRequest): Promise<PublicSourceNetworkResponse> {
    this.requestCalls.push(input);
    const reply = this.replies.shift();
    if (!reply) return Promise.reject(new Error("No mocked response configured."));
    if (reply instanceof Error) return Promise.reject(reply);
    return typeof reply === "function" ? reply(input) : Promise.resolve(reply);
  }
}

const completeHtml = `<!doctype html>
<html lang="en">
  <head>
    <title>North Star Goods</title>
    <meta name="description" content="Objects for thoughtful Nordic homes.">
    <meta property="og:title" content="North Star Goods — Helsinki">
    <meta property="og:description" content="Small-batch pieces selected with care.">
    <meta property="og:site_name" content="North Star Goods">
    <meta property="og:image" content="/images/storefront-hero.jpg">
    <meta name="theme-color" content="#16324f">
    <link rel="canonical" href="https://merchant.example/">
    <link rel="icon" href="/favicon.svg">
  </head>
  <body>
    <header><img class="brand-logo" src="/images/logo.svg" alt="North Star Goods logo"></header>
    <main><h1>North Star Goods</h1><p>Made for calm, considered spaces.</p></main>
  </body>
</html>`;

function htmlWithRobotsMeta(name: string, content: string): string {
  return completeHtml.replace("<head>", `<head><meta name="${name}" content="${content}">`);
}

function pendingNetworkReply(
  input: PublicSourceNetworkRequest,
): Promise<PublicSourceNetworkResponse> {
  return new Promise((_, reject) => {
    if (input.signal.aborted) {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
      return;
    }
    input.signal.addEventListener(
      "abort",
      () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      },
      { once: true },
    );
  });
}

class MemoryOnboardingRepository implements OnboardingSessionRepository {
  session?: OnboardingSession;

  load(): Promise<OnboardingSessionLoadResult> {
    return Promise.resolve(
      this.session
        ? { status: "found", session: structuredClone(this.session) }
        : { status: "missing" },
    );
  }

  save(session: OnboardingSession): Promise<void> {
    this.session = onboardingSessionSchema.parse(structuredClone(session));
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.session = undefined;
    return Promise.resolve();
  }
}

describe("P7-03 safe public-source discovery adapter", () => {
  it("produces source-scoped evidence for a safe public HTTPS page", async () => {
    const network = new MockPublicSourceNetwork([htmlResponse(completeHtml)]);
    const result = await discoverStorefrontSource(
      createPublicSourceDiscoveryAdapter({ network, now: () => retrievedAt }),
      source(),
    );

    expect(result.source.status).toBe("partial");
    expect(result.evidence.length).toBeGreaterThan(4);
    expect(result.evidence.every((item) => item.provenance.sourceReferenceId === source().id)).toBe(
      true,
    );
    expect(result.evidence.every((item) => item.provenance.documentUrl === source().url)).toBe(
      true,
    );
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "limited-pages" }));
  });

  it("rejects localhost before invoking the network boundary", async () => {
    const network = new MockPublicSourceNetwork([]);
    const adapter = createPublicSourceDiscoveryAdapter({ network });

    await expect(adapter.discover({ source: source("https://localhost/") })).rejects.toMatchObject({
      code: "blocked-source",
    });
    expect(network.resolveCalls).toEqual([]);
    expect(network.requestCalls).toEqual([]);
  });

  it.each([
    "https://127.0.0.1/",
    "https://10.0.0.4/",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/",
    "https://[fe80::1]/",
    "https://[fd00::1]/",
  ])("rejects private, loopback, link-local and metadata target %s", async (url) => {
    const network = new MockPublicSourceNetwork([]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network }).discover({ source: source(url) }),
    ).rejects.toMatchObject({ code: "blocked-source" });
    expect(network.requestCalls).toEqual([]);
  });

  it("rejects a hostname resolving to any non-public address before requesting it", async () => {
    const network = new MockPublicSourceNetwork(
      [],
      [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.4", family: 4 },
      ],
    );

    await expect(
      createPublicSourceDiscoveryAdapter({ network }).discover({ source: source() }),
    ).rejects.toMatchObject({ code: "blocked-source" });
    expect(network.requestCalls).toEqual([]);
  });

  it("rejects unsafe redirect targets and cross-origin redirect chains", async () => {
    const privateRedirect = new MockPublicSourceNetwork([
      htmlResponse("", { status: 302, headers: { location: "https://127.0.0.1/" } }),
    ]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network: privateRedirect }).discover({
        source: source(),
      }),
    ).rejects.toMatchObject({ code: "blocked-source" });
    expect(privateRedirect.requestCalls).toHaveLength(1);

    const crossOrigin = new MockPublicSourceNetwork([
      htmlResponse("", { status: 302, headers: { location: "https://other.example/" } }),
    ]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network: crossOrigin }).discover({ source: source() }),
    ).rejects.toMatchObject({ code: "blocked-source" });
    expect(crossOrigin.requestCalls).toHaveLength(1);
  });

  it.each([
    ["http://merchant.example/", "unsupported-protocol"],
    ["ftp://merchant.example/", "unsupported-protocol"],
    ["file:///etc/passwd", "unsupported-protocol"],
    ["data:text/html,unsafe", "unsupported-protocol"],
    ["javascript:alert(1)", "unsupported-protocol"],
    ["https://user:secret@merchant.example/", "invalid-url"],
    ["https://merchant.example:8443/", "blocked-source"],
  ])("rejects unsupported or credentialed URL %s", async (url, code) => {
    const network = new MockPublicSourceNetwork([]);
    const unsafeSource = {
      ...source(),
      url,
      normalizedOrigin: new URL(url).origin,
    };
    await expect(
      createPublicSourceDiscoveryAdapter({ network }).discover({ source: unsafeSource }),
    ).rejects.toMatchObject({ code });
    expect(network.requestCalls).toEqual([]);
  });

  it("rejects a pre-aborted signal as cancellation without invoking the network", async () => {
    const network = new MockPublicSourceNetwork([]);
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, "addEventListener");
    controller.abort();

    await expect(
      createPublicSourceDiscoveryAdapter({ network }).discover({
        source: source(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: "cancelled",
      message: "Storefront discovery was cancelled. Your reviewed progress is unchanged.",
    });
    expect(network.resolveCalls).toEqual([]);
    expect(network.requestCalls).toEqual([]);
    expect(addListener).not.toHaveBeenCalled();
  });

  it("cancels safely while a network request is active", async () => {
    let markRequestStarted: (() => void) | undefined;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    const cancellationNetwork = new MockPublicSourceNetwork([
      (input) => {
        markRequestStarted?.();
        return pendingNetworkReply(input);
      },
    ]);
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, "addEventListener");
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const discovery = createPublicSourceDiscoveryAdapter({
      network: cancellationNetwork,
      timeoutMs: 2_000,
    }).discover({ source: source(), signal: controller.signal });
    await requestStarted;
    controller.abort();

    await expect(discovery).rejects.toMatchObject({ code: "cancelled" });
    expect(cancellationNetwork.requestCalls).toHaveLength(1);
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(removeListener.mock.calls[0]?.[1]).toBe(addListener.mock.calls[0]?.[1]);
  });

  it("keeps adapter timeout distinct from merchant cancellation", async () => {
    const timeoutNetwork = new MockPublicSourceNetwork([pendingNetworkReply]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network: timeoutNetwork, timeoutMs: 100 }).discover({
        source: source(),
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("removes caller abort listeners after successful and failed discovery", async () => {
    const successController = new AbortController();
    const successAdd = vi.spyOn(successController.signal, "addEventListener");
    const successRemove = vi.spyOn(successController.signal, "removeEventListener");
    await createPublicSourceDiscoveryAdapter({
      network: new MockPublicSourceNetwork([htmlResponse(completeHtml)]),
    }).discover({ source: source(), signal: successController.signal });

    expect(successAdd).toHaveBeenCalledTimes(1);
    expect(successRemove).toHaveBeenCalledTimes(1);
    expect(successRemove.mock.calls[0]?.[1]).toBe(successAdd.mock.calls[0]?.[1]);

    const failureController = new AbortController();
    const failureAdd = vi.spyOn(failureController.signal, "addEventListener");
    const failureRemove = vi.spyOn(failureController.signal, "removeEventListener");
    await expect(
      createPublicSourceDiscoveryAdapter({
        network: new MockPublicSourceNetwork([new Error("simulated fetch failure")]),
      }).discover({ source: source(), signal: failureController.signal }),
    ).rejects.toMatchObject({ code: "unavailable-source" });

    expect(failureAdd).toHaveBeenCalledTimes(1);
    expect(failureRemove).toHaveBeenCalledTimes(1);
    expect(failureRemove.mock.calls[0]?.[1]).toBe(failureAdd.mock.calls[0]?.[1]);
  });

  it("rejects responses larger than the configured byte limit", async () => {
    const network = new MockPublicSourceNetwork([
      htmlResponse(`<html><body>${"x".repeat(1_100)}</body></html>`),
    ]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network, maxResponseBytes: 1_024 }).discover({
        source: source(),
      }),
    ).rejects.toMatchObject({ code: "blocked-source" });
  });

  it("rejects unsupported content types", async () => {
    const network = new MockPublicSourceNetwork([
      htmlResponse("{}", { headers: { "content-type": "application/json" } }),
    ]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network }).discover({ source: source() }),
    ).rejects.toMatchObject({ code: "blocked-source" });
  });

  it("honors detectable source policy denials and redirect loops", async () => {
    const forbidden = new MockPublicSourceNetwork([
      htmlResponse("", { status: 403, headers: { "content-type": "text/html" } }),
    ]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network: forbidden }).discover({ source: source() }),
    ).rejects.toMatchObject({ code: "blocked-source" });

    const robotsDenied = new MockPublicSourceNetwork([
      htmlResponse(completeHtml, {
        headers: { "content-type": "text/html", "x-robots-tag": "noindex" },
      }),
    ]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network: robotsDenied }).discover({ source: source() }),
    ).rejects.toMatchObject({ code: "blocked-source" });
    expect(robotsDenied.resolveCalls).toEqual(["merchant.example"]);

    const loop = new MockPublicSourceNetwork([
      htmlResponse("", { status: 302, headers: { location: source().url } }),
    ]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network: loop }).discover({ source: source() }),
    ).rejects.toMatchObject({ code: "blocked-source" });
    expect(loop.requestCalls).toHaveLength(1);
  });

  it.each([
    ["robots noindex", "robots", "noindex"],
    ["robots none", "robots", "none"],
    ["mixed-case robots noindex", "RoBoTs", "NoInDeX"],
    ["comma-separated robots noindex", "robots", "nofollow, noindex"],
    ["whitespace-separated robots noindex", "robots", "nofollow noindex"],
    ["bot-specific noindex", "VeskifyPublicSourceDiscovery", "noindex"],
  ])("blocks %s before producing public evidence", async (_label, name, content) => {
    const network = new MockPublicSourceNetwork([htmlResponse(htmlWithRobotsMeta(name, content))]);

    await expect(
      createPublicSourceDiscoveryAdapter({ network }).discover({ source: source() }),
    ).rejects.toMatchObject({
      code: "blocked-source",
      message: "The storefront declares that this page must not be indexed or reused.",
    });
    expect(network.resolveCalls).toEqual(["merchant.example"]);
    expect(network.requestCalls).toHaveLength(1);
  });

  it("emits no title, copy, colour or asset candidates for a denied HTML document", () => {
    const extracted = extractPublicHtml(htmlWithRobotsMeta("robots", "noindex"), {
      robotsAgentName: "veskifypublicsourcediscovery",
    });

    expect(extracted).toMatchObject({
      robotsPolicy: { denied: true, directives: ["noindex"] },
      title: null,
      metaDescription: null,
      openGraphTitle: null,
      openGraphDescription: null,
      openGraphSiteName: null,
      themeColour: null,
      brandNameCandidates: [],
      marketingCopyCandidates: [],
      assets: [],
    });
  });

  it("allows nofollow without noindex and extracts ordinary evidence", async () => {
    const network = new MockPublicSourceNetwork([
      htmlResponse(htmlWithRobotsMeta("ROBOTS", "NOFOLLOW")),
    ]);

    const result = await createPublicSourceDiscoveryAdapter({
      network,
      now: () => retrievedAt,
    }).discover({ source: source() });

    expect(result.evidence).toContainEqual(expect.objectContaining({ kind: "page-identity" }));
    expect(result.evidence).toContainEqual(expect.objectContaining({ kind: "colour-signal" }));
    expect(result.assetCandidates).toHaveLength(3);
  });

  it("rejects cross-source provenance through the existing orchestrator", async () => {
    const network = new MockPublicSourceNetwork([htmlResponse(completeHtml)]);
    const result = await createPublicSourceDiscoveryAdapter({
      network,
      now: () => retrievedAt,
    }).discover({ source: source() });
    const malicious: SourceDiscoveryAdapter = {
      id: "cross-source-public-fixture",
      discover: () => ({
        ...result,
        evidence: result.evidence.map((item, index) =>
          index === 0
            ? { ...item, provenance: { ...item.provenance, sourceReferenceId: "source_other" } }
            : item,
        ),
      }),
    };

    await expect(discoverStorefrontSource(malicious, source())).rejects.toMatchObject({
      code: "unavailable-source",
    });
  });

  it("extracts title, descriptions, Open Graph values, colour and declared assets", async () => {
    const network = new MockPublicSourceNetwork([htmlResponse(completeHtml)]);
    const result = await createPublicSourceDiscoveryAdapter({
      network,
      now: () => retrievedAt,
    }).discover({ source: source() });
    const pageIdentity = result.evidence.find((item) => item.kind === "page-identity");

    expect(pageIdentity?.observedValue).toMatchObject({
      documentTitle: "North Star Goods",
      metaDescription: "Objects for thoughtful Nordic homes.",
      openGraphTitle: "North Star Goods — Helsinki",
      openGraphDescription: "Small-batch pieces selected with care.",
      canonicalUrl: "https://merchant.example/",
      declaredLanguage: "en",
    });
    expect(result.evidence).toContainEqual(
      expect.objectContaining({ kind: "colour-signal", observedValue: "#16324f" }),
    );
    expect(result.assetCandidates).toHaveLength(3);
  });

  it("does not invent metadata that is missing from the document", async () => {
    const network = new MockPublicSourceNetwork([
      htmlResponse("<html><body><p>Simple public introduction.</p></body></html>"),
    ]);
    const result = await createPublicSourceDiscoveryAdapter({
      network,
      now: () => retrievedAt,
    }).discover({ source: source() });
    expect(result.evidence.some((item) => item.kind === "page-identity")).toBe(false);
    expect(result.assetCandidates).toEqual([]);
    expect(result.evidence.some((item) => item.kind === "colour-signal")).toBe(false);
  });

  it("returns no-reusable-evidence for recognized but empty HTML", async () => {
    const network = new MockPublicSourceNetwork([htmlResponse("<html><body></body></html>")]);
    await expect(
      createPublicSourceDiscoveryAdapter({ network }).discover({ source: source() }),
    ).rejects.toMatchObject({ code: "no-reusable-evidence" });
  });

  it("keeps all remote assets unapproved candidates", async () => {
    const network = new MockPublicSourceNetwork([htmlResponse(completeHtml)]);
    const result = await createPublicSourceDiscoveryAdapter({
      network,
      now: () => retrievedAt,
    }).discover({ source: source() });

    expect(
      result.assetCandidates.every(
        (asset) =>
          asset.licensingUsageConfirmation === "pending" &&
          asset.uncertainty.isUncertain &&
          asset.fingerprint === null,
      ),
    ).toBe(true);
  });

  it("does not extract public product facts as canonical commerce evidence", async () => {
    const catalogueBefore = structuredClone(aurumNordicSeed.catalogue);
    const network = new MockPublicSourceNetwork([
      htmlResponse(
        "<html lang='en'><head><title>Sale</title></head><body><p>SKU PUBLIC-1 — only €1 — in stock</p></body></html>",
      ),
    ]);
    const result = await createPublicSourceDiscoveryAdapter({
      network,
      now: () => retrievedAt,
    }).discover({ source: source() });
    const reconciliation = reconcileStorefrontSources({
      source: source(),
      discovery: result,
      canonicalCommerceProjection: aurumNordicSeed.catalogue,
    });

    expect(result.evidence.some((item) => item.kind === "product-reference-observed")).toBe(false);
    expect(reconciliation.decisions.every((decision) => decision.field === null)).toBe(true);
    expect(aurumNordicSeed.catalogue).toEqual(catalogueBefore);
  });

  it("keeps deterministic mode credential-free and unchanged", () => {
    const adapter = selectServerSourceDiscoveryAdapter("deterministic");
    const first = adapter.discover({
      source: source("https://merchant.example/", "deterministic"),
    });
    const second = adapter.discover({
      source: source("https://merchant.example/", "deterministic"),
    });

    expect(second).toEqual(first);
    expect(adapter.id).toBe("deterministic-source-discovery-mock");
  });

  it("preserves the latest safe persisted workflow when public discovery later fails", async () => {
    const repository = new MemoryOnboardingRepository();
    let tick = 0;
    const now = () => new Date(Date.parse(retrievedAt) + tick++ * 1_000).toISOString();
    await new OnboardingService(repository, {
      createId: () => "onboarding_public_source",
      now,
    }).createSession();
    const network = new MockPublicSourceNetwork([
      htmlResponse(completeHtml),
      new Error("simulated network outage"),
    ]);
    const service = createServerUrlBriefWorkflowService({
      mode: "bounded-public",
      repository,
      commerce: { load: () => aurumNordicSeed.catalogue },
      workflowOptions: { now, createSourceId: () => "source_public_workflow" },
      selectionOptions: { publicSource: { network, now } },
    });
    await service.submitSourceUrl("https://merchant.example/");
    const reviewed = await service.discover();

    await expect(service.discover()).rejects.toBeInstanceOf(UrlBriefWorkflowOperationError);
    const restored = await service.restore();
    expect(restored).toMatchObject({
      status: "discovery-failed",
      lastSafeState: "evidence-ready",
      discoveryResult: reviewed.discoveryResult,
    });
  });

  it("uses only the injected mocked network and sends no credentials or cookies", async () => {
    const network = new MockPublicSourceNetwork([htmlResponse(completeHtml)]);
    await createPublicSourceDiscoveryAdapter({ network }).discover({ source: source() });

    expect(network.requestCalls.length).toBeGreaterThan(0);
    for (const call of network.requestCalls) {
      expect(call.headers).not.toHaveProperty("authorization");
      expect(call.headers).not.toHaveProperty("cookie");
      expect(call.resolvedAddresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
    }
  });

  it("keeps the adapter free of React, Puck, browser automation and broad crawler dependencies", () => {
    const sources = [
      "src/integrations/source-discovery/public-source-discovery-adapter.server.ts",
      "src/integrations/source-discovery/node-public-source-network.server.ts",
      "src/integrations/source-discovery/public-source-html.ts",
      "src/integrations/source-discovery/public-source-security.ts",
    ]
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(/from ["'](?:react|next|@puckeditor|playwright|puppeteer|cheerio)/);
    expect(sources).not.toMatch(
      /XMLHttpRequest|document\.(?:querySelector|createElement)|window\.|page\.goto|browser\.newPage/,
    );
    expect(sources).not.toMatch(/OPENAI_API_KEY|process\.env|authorization|cookie:/i);

    for (const serverFile of [
      "src/integrations/source-discovery/index.server.ts",
      "src/integrations/source-discovery/node-public-source-network.server.ts",
      "src/integrations/source-discovery/public-source-discovery-adapter.server.ts",
      "src/integrations/source-discovery/source-discovery-selection.server.ts",
    ]) {
      expect(readFileSync(serverFile, "utf8")).toMatch(/^import "server-only";/);
    }
  });
});
