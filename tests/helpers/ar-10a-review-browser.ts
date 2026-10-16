import type { APIRequestContext, Page } from "@playwright/test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseP10B18DAcceptanceInspectionResponse } from "./p10b-18d-live-safe-evidence";

/** APIRequestContext requests are not observed by page network listeners. */
export async function ar10aInspectAcceptance({
  request,
  origin,
  token,
  retain,
}: {
  request: Pick<APIRequestContext, "get">;
  origin: string;
  token: string;
  retain: (observation: Record<string, unknown>) => Promise<void>;
}) {
  const started = performance.now();
  const stages: Record<string, unknown>[] = [];
  const mark = (stage: string, details: Record<string, unknown> = {}) =>
    stages.push({
      stage,
      at: new Date().toISOString(),
      elapsedMs: performance.now() - started,
      ...details,
    });
  let outcome = "FAIL";
  mark("request-start");
  try {
    const response = await request.get(`${origin}/api/demo/p10b-16p-04`, {
      headers: { "x-veskify-p10b-16p-04-acceptance-token": token },
      timeout: 120_000,
      maxRetries: 0,
      maxRedirects: 0,
    });
    mark("response-returned", { status: response.status() });
    assert.equal(response.status(), 200, "Inspection response must be successful");
    const body: unknown = await response.json();
    mark("body-read");
    const acceptance = parseP10B18DAcceptanceInspectionResponse(body);
    mark("schema-validated", {
      responseOk: true,
      projectId: acceptance.projectId,
      callBudget: acceptance.callBudget,
      status: acceptance.status,
      providerCallCount: acceptance.providerCallCount,
      retryCount: acceptance.retryCount,
      selectedTransportKind: acceptance.selectedTransport.kind,
      caseCount: acceptance.cases.length,
      hasFailureClassification: acceptance.failureClassification !== null,
      hasActiveAttempt: acceptance.activeAttempt !== null,
      hasFailedAttempt: acceptance.failedAttempt !== null,
    });
    ar10aAssertZeroCallReadiness(acceptance);
    mark("zero-call-ready");
    outcome = "PASS";
    return acceptance;
  } catch (error) {
    // Request errors can include headers/cookies after their first line. Retain
    // the actual error category and first line without copying those secrets.
    const name = error instanceof Error ? error.name : "Error";
    const message = (error instanceof Error ? error.message : String(error))
      .split("\n")[0]
      .replaceAll(token, "[redacted]")
      .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
      .slice(0, 2000);
    mark("error", { name, message });
    const retained = new Error(message);
    retained.name = name;
    throw retained;
  } finally {
    await retain({
      operation: "GET /api/demo/p10b-16p-04",
      deadlineMs: 120_000,
      timingMeaning:
        "APIRequestContext.get completion, not first-byte latency; body and schema completion are separate stages.",
      outcome,
      stages,
      elapsedMs: performance.now() - started,
    });
  }
}

export function ar10aAssertZeroCallReadiness(
  value: ReturnType<typeof parseP10B18DAcceptanceInspectionResponse>,
) {
  assert.equal(value.selectedTransport.kind, "mock");
  assert.equal(value.status, "ready");
  assert.equal(value.providerCallCount, 0);
  assert.equal(value.retryCount, 0);
  assert.equal(value.failureClassification, null);
  assert.equal(value.activeAttempt, null);
  assert.equal(value.failedAttempt, null);
  assert.deepEqual(value.cases, []);
}

/** Reuse the preserved candidate's non-evaluating Flight extraction; never accept URL intent alone. */
export function ar10aVerifySerializedCandidate(scripts: string[], expected: string) {
  const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const fragments = scripts.map((script) => {
    assert(script.startsWith("self.__next_f.push("));
    assert(script.endsWith(")") || script.endsWith(");"));
    const payload: unknown = JSON.parse(
      script.slice("self.__next_f.push(".length, script.endsWith(");") ? -2 : -1),
    );
    assert(Array.isArray(payload));
    if (payload[0] !== 1) return "";
    assert(typeof payload[1] === "string");
    return payload[1];
  });
  const rows = new Map<string, unknown>();
  for (const line of fragments.join("").split("\n")) {
    const match = /^([0-9a-f]+):([[{"]|null|true|false|-?\d)/.exec(line);
    if (!match) continue;
    assert(!rows.has(match[1]), "Duplicate Flight row");
    rows.set(match[1], JSON.parse(line.slice(match[1].length + 1)));
  }
  const matches: Record<string, unknown>[] = [];
  function find(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (
      object(value) &&
      Object.hasOwn(value, "initialAggregate") &&
      value.proposalCandidateFingerprint === expected
    )
      matches.push(value);
    for (const child of Object.values(value)) find(child);
  }
  for (const value of rows.values()) find(value);
  assert.equal(matches.length, 1, "Expected one exact candidate prop");
  function decode(value: unknown, ancestry = new Set<string>()): unknown {
    if (typeof value === "string" && value.startsWith("$")) {
      if (value.startsWith("$$")) return value.slice(1);
      if (value === "$undefined") return undefined;
      assert(/^\$[0-9a-f]+(?::[^:]+)*$/.test(value), "Unsupported aggregate marker");
      assert(!ancestry.has(value), "Cyclic aggregate reference");
      const [id, ...path] = value.slice(1).split(":");
      assert(rows.has(id), "Missing aggregate row");
      let target = rows.get(id);
      for (const property of path) {
        assert(
          (object(target) || Array.isArray(target)) && Object.hasOwn(target, property),
          "Missing aggregate property",
        );
        target = (target as Record<string, unknown>)[property];
      }
      return decode(target, new Set([...ancestry, value]));
    }
    if (Array.isArray(value)) return value.map((item) => decode(item, ancestry));
    if (object(value))
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, decode(item, ancestry)]),
      );
    return value;
  }
  const aggregate = decode(matches[0].initialAggregate);
  const bytes = JSON.stringify(aggregate, null, 2) + "\n";
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  assert.equal(
    sha256,
    "355a1ab4188ea6e30e711ab84d3ba8ecbd853cab26fe6e8dbda4d6cf27b6bc5d",
    "Response aggregate differs from the preserved original",
  );
  return {
    candidateFingerprint: expected,
    aggregateSha256: sha256,
    bytes: Buffer.byteLength(bytes),
  };
}

export async function ar10aReadCandidateIdentity(page: Page, expected: string) {
  const scripts = await page.evaluate(() =>
    [...document.scripts]
      .filter((script) => !script.src && script.textContent?.startsWith("self.__next_f.push("))
      .map((script) => script.textContent),
  );
  return ar10aVerifySerializedCandidate(scripts, expected);
}

/** Read-only measurements in one document coordinate system; application chrome remains visible. */
export async function ar10aMeasure(page: Page) {
  return page.evaluate(() => {
    const box = (element: Element) => {
      const r = element.getBoundingClientRect();
      return {
        x: r.x + scrollX,
        y: r.y + scrollY,
        width: r.width,
        height: r.height,
        bottom: r.bottom + scrollY,
      };
    };
    const properties = [
      "display",
      "position",
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "letter-spacing",
      "padding-top",
      "padding-bottom",
      "padding-left",
      "padding-right",
      "margin-top",
      "margin-bottom",
      "gap",
      "align-items",
      "align-content",
      "grid-template-columns",
      "grid-template-rows",
      "height",
      "min-height",
      "max-height",
      "aspect-ratio",
      "object-fit",
      "box-shadow",
      "border-width",
      "container-type",
    ];
    const describe = (element: Element) => ({
      tag: element.tagName,
      class: element.className,
      attributes: Object.fromEntries(
        [...element.attributes]
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => [a.name, a.value]),
      ),
      box: box(element),
      style: Object.fromEntries(
        properties.map((p) => [p, getComputedStyle(element).getPropertyValue(p)]),
      ),
    });
    const storefront = document.querySelector(".project-preview__storefront")!;
    const selectors = [
      "[data-frame-region='header']",
      "[data-frame-region='desktop-header-layout']",
      "[data-frame-region='mobile-header-layout']",
      "[data-frame-region='header'] .store-brand",
      "[data-component='homepageHero']",
      "[data-component='homepageHero'] [data-region='content']",
      "[data-component='homepageHero'] h1",
      "[data-component='homepageHero'] [data-region='actions']",
      "[data-component='homepageHero'] [data-region='media']",
      "[data-component='homepageFeaturedProducts']",
      "[data-region='section-heading'] h2",
    ];
    const nodes = Object.fromEntries(
      selectors.map((selector) => [
        selector,
        [...storefront.querySelectorAll(selector)]
          .filter((e) => e.getBoundingClientRect().height > 0)
          .map(describe),
      ]),
    );
    const cards = [...storefront.querySelectorAll("[data-card-anatomy]")].map((card) => ({
      ...describe(card),
      descendants: [
        ...card.querySelectorAll(
          "[data-card-region], [data-art-direction-contract], img, figure, picture",
        ),
      ].map(describe),
      children: [...card.children].map((child) => ({
        ...describe(child),
        children: [...child.children].map(describe),
      })),
    }));
    const styled =
      storefront.querySelector("[data-component='homepageHero'] h1, [data-card-anatomy]") ??
      storefront;
    const style = getComputedStyle(styled);
    const vars = [
      "--brand-section-rhythm",
      "--brand-gutter",
      "--brand-grid-gap",
      "--brand-card-inset",
      "--brand-density-content",
      "--brand-density-commerce",
      "--brand-media-prominence",
      "--brand-container-content",
      "--brand-elevation-shadow",
      "--brand-type-display-size",
      "--brand-type-heading-size",
      "--brand-type-body-size",
      "--brand-type-price-size",
    ];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scroll: { x: scrollX, y: scrollY },
      storefront: box(storefront),
      reviewChromeHeight: storefront.getBoundingClientRect().top + scrollY,
      projected: Object.fromEntries(vars.map((v) => [v, style.getPropertyValue(v)])),
      nodes,
      cards,
      content: storefront.textContent,
      media: [...storefront.querySelectorAll("img")].map((image) => ({
        src: image.getAttribute("src"),
        currentSrc: new URL(image.currentSrc || image.src, location.href).pathname,
        alt: image.alt,
      })),
    };
  });
}

export async function ar10aActualFonts(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const results = [];
    for (const selector of [
      "[data-frame-region='desktop-header-layout'] .store-brand",
      "[data-frame-region='mobile-header-layout'] .store-brand",
      "[data-component='homepageHero'] h1",
      "[data-component='homepageHero'] p",
      "[data-card-region='heading']",
      "[data-card-region='price']",
    ]) {
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
      if (nodeId) {
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        const matched = await cdp.send("CSS.getMatchedStylesForNode", { nodeId });
        results.push({
          selector,
          fonts,
          matchedRules: (matched.matchedCSSRules ?? [])
            .map(({ rule }) => ({
              selector: rule.selectorList.text,
              origin: rule.origin,
              properties: rule.style.cssProperties
                .filter((p) => /^(font|line-height|letter-spacing)/.test(p.name))
                .map(({ name, value, important, disabled }) => ({
                  name,
                  value,
                  important,
                  disabled,
                })),
            }))
            .filter((rule) => rule.properties.length),
        });
      }
    }
    return results;
  } finally {
    await cdp.detach();
  }
}
