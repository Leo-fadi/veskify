import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { APIRequestContext } from "@playwright/test";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import {
  compileCommercialSharedFrameSelection,
  currentCommercialSharedFrameSelection,
} from "@/application/commercial-shared-frame";
import { karvonenSeed } from "@/data/seed";
import { createP10B16P04RawAurumCommercialFixture } from "@/data/demo/p10b-16p-04-commercial-acceptance";
import { applyBrandSystemFoundationPatch, brandSystemToCssVariables } from "@/domain/design-system";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import type { ProjectAggregate } from "@/services/storage/project-repository";
import {
  ar10aAssertZeroCallReadiness,
  ar10aInspectAcceptance,
  ar10aVerifySerializedCandidate,
} from "../helpers/ar-10a-review-browser";
import { parseP10B18DAcceptanceInspectionResponse } from "../helpers/p10b-18d-live-safe-evidence";

const raw = readFileSync("tests/fixtures/ar-10a/original-aggregate.json");
const parsed: unknown = JSON.parse(raw.toString("utf8"));
const aggregate = validateProjectAggregate(parsed as ProjectAggregate);
const draft = aggregate.snapshots.find((s) => s.id === aggregate.project.draftSnapshotId)!;

describe("AR-10A protected API readiness retains actual completion and failures", () => {
  const token = "synthetic-readiness-token-for-tests";
  const response = () => ({
    ok: true,
    acceptance: {
      namespace: "p10b-16p-04-real-studio-design-intent-v2-acceptance",
      projectId: "project_p10b16p04_aurum_commercial_acceptance",
      callBudget: 3,
      providerCallCount: 0,
      retryCount: 0,
      status: "ready",
      failureClassification: null,
      activeAttempt: null,
      failedAttempt: null,
      provider: {
        providerId: "openai-prompted-storefront-design-intent-v2",
        modelId: null,
        category: "unconfigured",
        credentialsAvailable: false,
        timeoutMs: null,
        boundedTimeout: false,
        retryCount: 0,
      },
      selectedTransport: {
        kind: "mock",
        providerId: "openai-prompted-storefront-design-intent-v2",
        modelId: "mocked-p10b-16p-04-design-intent-v2",
      },
      cases: [],
    },
  });
  const run = (
    get: ReturnType<typeof vi.fn>,
    retain: (observation: Record<string, unknown>) => Promise<void>,
  ) =>
    ar10aInspectAcceptance({
      request: { get } as unknown as Pick<APIRequestContext, "get">,
      origin: "http://localhost:12345",
      token,
      retain,
    });
  it("requires a successful parsed zero-call mock state and makes one bounded request", async () => {
    const get = vi.fn(() =>
      Promise.resolve({ status: () => 200, json: () => Promise.resolve(response()) }),
    );
    const retain = vi.fn((observation: Record<string, unknown>) =>
      Promise.resolve(void observation),
    );
    ar10aAssertZeroCallReadiness(await run(get, retain));
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]).toEqual([
      "http://localhost:12345/api/demo/p10b-16p-04",
      {
        headers: { "x-veskify-p10b-16p-04-acceptance-token": token },
        timeout: 120_000,
        maxRetries: 0,
        maxRedirects: 0,
      },
    ]);
    expect(retain).toHaveBeenCalledOnce();
    const result = retain.mock.calls[0][0] as {
      outcome: string;
      stages: { stage: string; elapsedMs: number }[];
    };
    expect(result.outcome).toBe("PASS");
    expect(result.stages.map((s) => s.stage)).toEqual([
      "request-start",
      "response-returned",
      "body-read",
      "schema-validated",
      "zero-call-ready",
    ]);
    expect(result.stages.every((s) => s.elapsedMs >= 0)).toBe(true);
  });
  it("retains unsuccessful status and rejects without consuming or substituting its body", async () => {
    const json = vi.fn(() => Promise.resolve(response()));
    const get = vi.fn(() => Promise.resolve({ status: () => 404, json }));
    const retain = vi.fn((observation: Record<string, unknown>) =>
      Promise.resolve(void observation),
    );
    await expect(run(get, retain)).rejects.toThrow("must be successful");
    expect(get).toHaveBeenCalledOnce();
    expect(json).not.toHaveBeenCalled();
    expect(retain).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "FAIL",
        stages: [
          expect.objectContaining({ stage: "request-start" }),
          expect.objectContaining({ stage: "response-returned", status: 404 }),
          expect.objectContaining({ stage: "error" }),
        ],
      }),
    );
  });
  it("distinguishes body-read failure from schema rejection and retains each in finally", async () => {
    for (const json of [
      () => Promise.reject(new SyntaxError("Invalid JSON")),
      () =>
        Promise.resolve({
          ok: true,
          acceptance: { ...response().acceptance, projectId: "foreign" },
        }),
    ]) {
      const get = vi.fn(() => Promise.resolve({ status: () => 200, json }));
      const retain = vi.fn((observation: Record<string, unknown>) =>
        Promise.resolve(void observation),
      );
      await expect(run(get, retain)).rejects.toThrow();
      expect(get).toHaveBeenCalledOnce();
      expect(retain).toHaveBeenCalledOnce();
      expect(retain).toHaveBeenCalledWith(expect.objectContaining({ outcome: "FAIL" }));
    }
  });
  it("records the original timeout category without retrying or retaining secret headers", async () => {
    const get = vi.fn(() =>
      Promise.reject(
        new Error("apiRequestContext.get: Timeout 120000ms exceeded.\nheader: " + token),
      ),
    );
    const retain = vi.fn((observation: Record<string, unknown>) =>
      Promise.resolve(void observation),
    );
    await expect(run(get, retain)).rejects.toThrow("Timeout 120000ms");
    expect(get).toHaveBeenCalledOnce();
    expect(retain).toHaveBeenCalledOnce();
    const recorded = JSON.stringify(retain.mock.calls);
    expect(recorded).not.toContain(token);
    expect(recorded).not.toContain("header:");
    expect(recorded).not.toContain("response-returned");
  });
  it("rejects schema-valid but non-ready, active, failed, nonzero-call or live transport states", () => {
    for (const patch of [
      { status: "calling" },
      { providerCallCount: 1 },
      { activeAttempt: {} },
      { failedAttempt: {} },
      { failureClassification: "failed" },
      { selectedTransport: { ...response().acceptance.selectedTransport, kind: "openai" } },
    ]) {
      const parsed = parseP10B18DAcceptanceInspectionResponse({
        ok: true,
        acceptance: { ...response().acceptance, ...patch },
      });
      expect(() => ar10aAssertZeroCallReadiness(parsed)).toThrow();
    }
  });
});

describe("AR-10A route preparation validates response authority", () => {
  const fingerprint = canonicalStorefrontContentFingerprint(draft);
  const script = (rows: string) => `self.__next_f.push(${JSON.stringify([1, rows])})`;
  const props = (initialAggregate: unknown, candidate = fingerprint) =>
    JSON.stringify({
      initialAggregate,
      proposalCandidateFingerprint: candidate,
    });
  it("requires the exact preserved aggregate in direct or referenced Flight props", () => {
    for (const rows of [
      `a:${props(parsed)}\n`,
      `a:${props("$b:value")}\nb:${JSON.stringify({ value: parsed })}\n`,
    ])
      expect(ar10aVerifySerializedCandidate([script(rows)], fingerprint).aggregateSha256).toBe(
        createHash("sha256").update(raw).digest("hex"),
      );
  });
  it("rejects wrong, absent and ambiguous candidate props", () => {
    for (const rows of [
      `a:${props(parsed, "wrong")}\n`,
      "a:{}\n",
      `a:${props(parsed)}\nb:${props(parsed)}\n`,
    ])
      expect(() => ar10aVerifySerializedCandidate([script(rows)], fingerprint)).toThrow();
  });
  it("rejects changed protected aggregate bytes even with the expected candidate label", () => {
    expect(() =>
      ar10aVerifySerializedCandidate(
        [script(`a:${props({ ...aggregate, catalogue: {} })}\n`)],
        fingerprint,
      ),
    ).toThrow("differs from the preserved original");
  });
  it("rejects missing, cyclic, duplicate and unsupported serialization references", () => {
    for (const rows of [
      `a:${props("$b")}\n`,
      `a:${props("$b")}\nb:"$b"\n`,
      `a:${props(parsed)}\na:{}\n`,
      `a:${props("$L1")}\n`,
    ])
      expect(() => ar10aVerifySerializedCandidate([script(rows)], fingerprint)).toThrow();
  });
});

describe("AR-10A reusable realization retains canonical authority", () => {
  it("uses the exact generated input, with no visual-copy or catalogue replacement", () => {
    expect(createHash("sha256").update(raw).digest("hex")).toBe(
      "355a1ab4188ea6e30e711ab84d3ba8ecbd853cab26fe6e8dbda4d6cf27b6bc5d",
    );
    expect(canonicalStorefrontContentFingerprint(draft)).toBe(
      "v1_50184_0784a748aa03ccbb5e081601548c20c63070658d24a5e3fa5344ef6093da9061",
    );
    expect(aggregate).toEqual(parsed);
  });
  it("keeps the registered home/frame/card implementation shared across all three targets", () => {
    const before = structuredClone(aggregate);
    const evidenceReferences =
      createP10B16P04RawAurumCommercialFixture().approvedEvidenceReferences;
    const home = draft.pages.find((p) => p.type === "home")!;
    const signatures = [];
    for (const renderTarget of ["editor", "preview", "published"] as const) {
      const context = createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: "en",
        enabledLocales: ["en", "fi"],
        snapshot: draft,
        catalogue: aggregate.catalogue,
        evidenceReferences,
        renderTarget,
      });
      const markup = renderToStaticMarkup(renderStorefrontPage(home, context));
      const dom = document.createElement("div");
      dom.innerHTML = markup;
      expect(dom.querySelector('[data-frame-profile="editorial-masthead"]')).not.toBeNull();
      expect(
        dom.querySelector('[data-component="homepageHero"][data-variant="editorialSplit"]'),
      ).not.toBeNull();
      signatures.push(
        [...dom.querySelectorAll("[data-card-anatomy]")].map((card) => ({
          anatomy: card.getAttribute("data-card-anatomy"),
          facts: card.getAttribute("data-card-facts-fingerprint"),
          text: card.textContent,
          media: [...card.querySelectorAll("img")].map((image) => [
            image.getAttribute("src"),
            image.alt,
          ]),
        })),
      );
    }
    expect(signatures[0].length).toBeGreaterThan(0);
    expect(signatures[1]).toEqual(signatures[0]);
    expect(signatures[2]).toEqual(signatures[0]);
    expect(aggregate).toEqual(before);
  });
  it("applies the same frame to the existing non-Aurum fixture with contrasting canonical roles", () => {
    const original = structuredClone(karvonenSeed.draftSnapshot);
    const compiled = compileCommercialSharedFrameSelection({
      snapshot: {
        ...original,
        brandSystem: applyBrandSystemFoundationPatch(original.brandSystem, {
          spacing: { density: "compact" },
        }),
      },
      catalogue: karvonenSeed.catalogue,
      selection: currentCommercialSharedFrameSelection("editorial-masthead"),
    }).snapshot;
    const a = brandSystemToCssVariables(draft.brandSystem),
      b = brandSystemToCssVariables(compiled.brandSystem);
    expect(a["--brand-type-display-size"]).not.toBe(b["--brand-type-display-size"]);
    expect(a["--brand-section-rhythm"]).not.toBe(b["--brand-section-rhythm"]);
    for (const renderTarget of ["editor", "preview", "published"] as const) {
      const context = createStorefrontRenderContext({
        activeLocale: "fi",
        primaryLocale: "fi",
        snapshot: compiled,
        catalogue: karvonenSeed.catalogue,
        renderTarget,
      });
      const markup = renderToStaticMarkup(
        renderStorefrontPage(
          compiled.pages.find((p) => p.type === "home")!,
          context,
        ),
      );
      expect(markup).toContain('data-frame-profile="editorial-masthead"');
      expect(markup).not.toContain("Aurum Nordic");
    }
    expect(karvonenSeed.draftSnapshot).toEqual(original);
  });
});
