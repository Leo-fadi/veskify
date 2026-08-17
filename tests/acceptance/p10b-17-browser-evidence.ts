import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import type { P10B16P04SafeSelection } from "./p10b-16p-04-visual-evidence";

export const p10b17ProjectId = "project_p10b16p04_aurum_commercial_acceptance";
export const p10b17EditorUrl = `/projects/${p10b17ProjectId}/editor`;
export const p10b17Widths = [375, 768, 1024, 1440] as const;
export type P10B17Width = (typeof p10b17Widths)[number];
export type P10B17Locale = "en" | "fi";
export type P10B17Direction = "premium-editorial" | "modern-technical" | "minimal-commerce";

export const p10b17Directions = Object.freeze([
  {
    id: "premium-editorial" as const,
    prompt:
      "Create a refined premium jewellery storefront with strong editorial storytelling, elegant product discovery, sophisticated configurable-product pages, generous visual breathing room and restrained luxury hierarchy.",
  },
  {
    id: "modern-technical" as const,
    prompt:
      "Create a modern technical jewellery storefront that prioritises catalogue depth, comparison, filters, product information and clear configurable-product decision support with a compact, information-rich commercial hierarchy.",
  },
  {
    id: "minimal-commerce" as const,
    prompt:
      "Create a restrained minimal-commerce jewellery storefront focused on fast product discovery, conversion, concise proof, clean product pages, low visual noise and a balanced mobile-first hierarchy.",
  },
] as const);

export const p10b17Surfaces = Object.freeze([
  { id: "home" as const, kind: "home" as const, path: "/" },
  {
    id: "collection" as const,
    kind: "collection" as const,
    path: "/collections/everyday-icons",
  },
  { id: "search" as const, kind: "search" as const, path: "/search", query: "925" },
  {
    id: "simple-pdp" as const,
    kind: "product" as const,
    path: "/products/sisu-automatic-watch",
  },
  {
    id: "configurable-pdp" as const,
    kind: "product" as const,
    path: "/products/aurora-ring-585",
  },
  { id: "about" as const, kind: "content" as const, path: "/pages/about" },
  { id: "cart" as const, kind: "utility" as const, path: "/cart" },
] as const);

export type P10B17Surface = (typeof p10b17Surfaces)[number];

export type P10B17ForbiddenRequests = {
  provider: string[];
  Vesko: string[];
  publication: string[];
  generation: string[];
  runtimeErrors: string[];
};

export type P10B17GeneratedDirection = Readonly<{
  direction: P10B17Direction;
  snapshotFingerprint: string;
  proposalFingerprint: string;
  structuralFingerprint: string;
  compiledDecisionFingerprint: string;
  protectedCommerceFingerprint: string;
  protectedMediaFingerprint: string;
  selection: P10B16P04SafeSelection;
}>;

export type P10B17PerformanceRecord = Readonly<{
  direction: P10B17Direction;
  surface: P10B17Surface["id"];
  width: P10B17Width;
  domNodeCount: number;
  productCardCount: number;
  imageElementCount: number;
  eagerImageCount: number;
  lazyImageCount: number;
  highPriorityImageCount: number;
  imageRequestCount: number;
  uniqueImageRequestCount: number;
  duplicateImageRequestCount: number;
  observerSupport: Readonly<{ layoutShift: boolean; longTask: boolean }>;
  layoutShiftTotal: number | null;
  layoutShiftEntries: readonly Readonly<{ value: number; sources: readonly string[] }>[];
  longTaskCount: number | null;
  longTaskDuration: number | null;
  scriptRequestCount: number;
  scriptTransferBytes: number;
}>;

export type P10B17EvidenceEntry = Readonly<{
  filename: string;
  fixture: "aurum-production-disabled";
  direction: P10B17Direction;
  viewport: P10B17Width;
  locale: P10B17Locale;
  surface: P10B17Surface["id"];
  renderer: "proposal" | "saved-preview" | "published";
  frame: string;
  profileOrArchetype: string;
  snapshotFingerprint: string;
  rendererFingerprint: string;
  commerceFingerprint: string;
  mediaFingerprint: string;
  documentHeight: number;
  documentWidth: number;
}>;

export const p10b17EvidenceDirectory = process.env.P10B17_EVIDENCE_DIR
  ? resolve(process.env.P10B17_EVIDENCE_DIR)
  : resolve(tmpdir(), "veskify-p10b-17-responsive-evidence");
export const p10b17EvidenceRunId = (() => {
  const value = process.env.P10B17_EVIDENCE_RUN_ID;
  if (!value || !/^[A-Za-z0-9_-]{8,80}$/u.test(value)) {
    throw new Error("The P10B-17 evidence run identity is unavailable.");
  }
  return value;
})();

const acceptanceTokenHeader = "x-veskify-p10b-16p-04-acceptance-token";

function requiredAcceptanceToken(): string {
  const token = process.env.P10B17_PLAYWRIGHT_ACCEPTANCE_TOKEN;
  if (!token || Buffer.byteLength(token) < 32) {
    throw new Error("The production-disabled P10B-17 browser authority is unavailable.");
  }
  return token;
}

function safeRuntimeError(value: string): string {
  return value
    .replace(/([?&](?:authorization|key|token)=)[^&\s]+/giu, "$1[redacted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 400);
}

export async function installP10B17OfflineAuthority(page: Page): Promise<P10B17ForbiddenRequests> {
  const configuredBaseUrl = testBaseUrl();
  const baseOrigin = new URL(configuredBaseUrl).origin;
  const token = requiredAcceptanceToken();
  const requests: P10B17ForbiddenRequests = {
    provider: [],
    Vesko: [],
    publication: [],
    generation: [],
    runtimeErrors: [],
  };
  page.on("pageerror", (error) => {
    requests.runtimeErrors.push(safeRuntimeError(`pageerror:${error.name}:${error.message}`));
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      requests.runtimeErrors.push(safeRuntimeError(`console:${message.text()}`));
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "api.openai.com" || url.hostname.endsWith(".openai.com")) {
      requests.provider.push(request.url());
    }
    if (url.hostname === "vesko.fi" || url.hostname.endsWith(".vesko.fi")) {
      requests.Vesko.push(request.url());
    }
    if (url.pathname === "/api/storefront-publish") requests.publication.push(request.method());
    if (url.pathname === "/api/ai/whole-storefront-proposals") {
      requests.generation.push(request.method());
    }
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isForbidden =
      url.hostname === "api.openai.com" ||
      url.hostname.endsWith(".openai.com") ||
      url.hostname === "vesko.fi" ||
      url.hostname.endsWith(".vesko.fi");
    if (isForbidden) {
      await route.abort("blockedbyclient");
      return;
    }
    const headers = Object.fromEntries(
      Object.entries(request.headers()).filter(
        ([key]) => key.toLowerCase() !== acceptanceTokenHeader,
      ),
    );
    await route.continue({
      headers: url.origin === baseOrigin ? { ...headers, [acceptanceTokenHeader]: token } : headers,
    });
  });
  return requests;
}

function testBaseUrl(): string {
  const value = process.env.P10B16P04_PLAYWRIGHT_ORIGIN;
  if (!value) throw new Error("P10B-17 requires one exact same-origin server authority.");
  return value;
}

const isDestroyedExecutionContext = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("Execution context was destroyed");

async function waitForStableP10B17Document(page: Page, expectedUrl: string): Promise<void> {
  const maximumDocumentChanges = 3;
  for (let attempt = 0; attempt < maximumDocumentChanges; attempt += 1) {
    try {
      await page.waitForURL(expectedUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForFunction(
        (url) => document.readyState === "complete" && window.location.href === url,
        expectedUrl,
        { timeout: 120_000 },
      );
      await page.waitForLoadState("networkidle", { timeout: 120_000 });
      await page.locator("next-route-announcer").waitFor({
        state: "attached",
        timeout: 120_000,
      });
      const documentIdentity = await page.evaluate(() => performance.timeOrigin);
      await page.waitForTimeout(500);
      const settledIdentity = await page.evaluate((url) => {
        if (document.readyState !== "complete" || window.location.href !== url) return null;
        return performance.timeOrigin;
      }, expectedUrl);
      if (settledIdentity === documentIdentity) return;
    } catch (error) {
      if (!isDestroyedExecutionContext(error)) throw error;
    }
  }
  throw new Error(`P10B-17 route did not retain a stable document at ${expectedUrl}.`);
}

/**
 * Accepts only the exact Next.js development-server `ERR_ABORTED` race backed
 * by an observed successful document response. When that proof is unavailable,
 * one bounded document retry is permitted; HTTP failures, redirects, other
 * errors, and a second abort remain fatal.
 */
export async function navigateP10B17Route(page: Page, path: string): Promise<void> {
  const expectedUrl = new URL(path, testBaseUrl()).href;
  const navigate = async () => {
    const observedDocument = page
      .waitForResponse(
        (candidate) =>
          candidate.url() === expectedUrl && candidate.request().resourceType() === "document",
        { timeout: 120_000 },
      )
      .catch(() => null);
    let response;
    try {
      response = await page.goto(expectedUrl, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
    } catch (error) {
      const observed = await observedDocument;
      if (
        error instanceof Error &&
        error.message.includes("net::ERR_ABORTED") &&
        observed?.ok() &&
        page.url() === expectedUrl
      ) {
        await page.waitForURL(expectedUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
        return;
      }
      throw error;
    }
    const acceptedResponse = response ?? (await observedDocument);
    if (!acceptedResponse?.ok()) {
      throw new Error(
        `P10B-17 route navigation failed with status ${acceptedResponse?.status() ?? "none"}.`,
      );
    }
    if (page.url() !== expectedUrl) {
      throw new Error(`P10B-17 route navigation redirected to ${page.url()}.`);
    }
  };
  try {
    await navigate();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("net::ERR_ABORTED")) throw error;
    await page.waitForTimeout(100);
    await navigate();
  }
  await waitForStableP10B17Document(page, expectedUrl);
}

/**
 * Repeats one exact read-only route assertion only when Next development-mode
 * document replacement destroys its execution context. Each attempt must
 * independently prove the exact URL, document response, storefront root, and
 * optional proposal/frame authority before the assertion is allowed to run.
 */
export async function withP10B17StableRouteAssertion<Value>({
  page,
  path,
  expectedFrame,
  expectedSnapshotFingerprint,
  assertion,
}: {
  page: Page;
  path: string;
  expectedFrame?: string;
  expectedSnapshotFingerprint?: string;
  assertion: (root: Locator) => Promise<Value>;
}): Promise<Value> {
  const expectedUrl = new URL(path, testBaseUrl()).href;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await navigateP10B17Route(page, path);
    try {
      await expect(page).toHaveURL(expectedUrl);
      if (expectedSnapshotFingerprint) {
        expect(new URL(page.url()).searchParams.get("p10b-16p-04-proposal")).toBe(
          expectedSnapshotFingerprint,
        );
      }
      const root = page.locator(".project-preview__storefront");
      await expect(root).toHaveCount(1);
      await expect(root).toBeVisible({ timeout: 60_000 });
      if (expectedFrame) {
        for (const region of ["header", "footer"] as const) {
          await expect(root.locator(`[data-frame-region="${region}"]`)).toHaveAttribute(
            "data-frame-profile",
            expectedFrame,
          );
        }
      }
      const initialDocumentIdentity = await root.evaluate((candidate, url) => {
        const view = candidate.ownerDocument.defaultView;
        if (!candidate.isConnected || !view || view.location.href !== url) {
          throw new Error("P10B-17 storefront root does not belong to the exact route document.");
        }
        return view.performance.timeOrigin;
      }, expectedUrl);
      const result = await assertion(root);
      const finalDocumentIdentity = await root.evaluate((candidate, url) => {
        const view = candidate.ownerDocument.defaultView;
        if (!candidate.isConnected || !view || view.location.href !== url) {
          throw new Error("P10B-17 storefront root changed during route assertion.");
        }
        return view.performance.timeOrigin;
      }, expectedUrl);
      expect(finalDocumentIdentity).toBe(initialDocumentIdentity);
      return result;
    } catch (error) {
      if (attempt === 0 && isDestroyedExecutionContext(error)) continue;
      throw error;
    }
  }
  throw new Error(`P10B-17 route assertion did not retain a stable document at ${expectedUrl}.`);
}

export function expectP10B17Offline(
  requests: P10B17ForbiddenRequests,
  generationCount: number,
): void {
  expect(requests.provider).toEqual([]);
  expect(requests.Vesko).toEqual([]);
  expect(requests.publication).toEqual([]);
  expect(requests.generation).toEqual(Array.from({ length: generationCount }, () => "POST"));
  expect(requests.runtimeErrors).toEqual([]);
}

export function p10b17Route({
  surface,
  locale,
  snapshotFingerprint,
  renderer = "proposal",
}: {
  surface: P10B17Surface;
  locale: P10B17Locale;
  snapshotFingerprint?: string;
  renderer?: "proposal" | "saved-preview" | "published";
}): string {
  const prefix =
    renderer === "published"
      ? `/projects/${p10b17ProjectId}/published`
      : `/projects/${p10b17ProjectId}`;
  const suffix = surface.path === "/" ? "" : surface.path;
  const query = new URLSearchParams({ locale });
  if (surface.id === "search") query.set("q", locale === "fi" ? "925" : surface.query);
  if (surface.id === "cart") query.set("p10b-16p-04-utility", "populated");
  if (renderer === "proposal") {
    if (!snapshotFingerprint) throw new Error("Proposal rendering requires its exact snapshot.");
    query.set("p10b-16p-04-proposal", snapshotFingerprint);
  }
  return `${prefix}${suffix}?${query.toString()}`;
}

export function storefrontRoot(page: Page): Locator {
  return page.locator(".project-preview__storefront");
}

function authorityForSurface(selection: P10B16P04SafeSelection, surface: P10B17Surface): string {
  if (surface.id === "home") return selection.profiles.homepage;
  if (surface.id === "collection") return selection.dynamicCommerce.collectionArchetypeId;
  if (surface.id === "search") return selection.dynamicCommerce.searchArchetypeId;
  if (surface.id === "simple-pdp") return selection.dynamicCommerce.standardSimpleArchetypeId;
  if (surface.id === "configurable-pdp") {
    return selection.dynamicCommerce.configurableArchetypeId;
  }
  if (surface.id === "about") {
    return (
      selection.staticContentSupportSelections.find((value) => value.includes("about")) ?? "about"
    );
  }
  return selection.utilityPresentationSelections.find((value) => value.includes("cart")) ?? "cart";
}

async function waitForStorefrontImages(root: Locator): Promise<void> {
  const scrollPosition = await root.evaluate((candidate) => {
    const view = candidate.ownerDocument.defaultView;
    return { x: view?.scrollX ?? 0, y: view?.scrollY ?? 0 };
  });
  const images = root.locator("img");
  const imageCount = await images.count();
  try {
    for (let index = 0; index < imageCount; index += 1) {
      const image = images.nth(index);
      if (!(await image.isVisible())) continue;
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(async (candidate) => {
        const value = candidate as HTMLImageElement;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (!value.complete) {
          await new Promise<void>((resolve) => {
            const settle = () => {
              value.removeEventListener("load", settle);
              value.removeEventListener("error", settle);
              resolve();
            };
            value.addEventListener("load", settle);
            value.addEventListener("error", settle);
            if (value.complete) settle();
          });
        }
        if (value.naturalWidth === 0 || value.naturalHeight === 0) {
          throw new Error("A retained storefront image did not load successfully.");
        }
        await value.decode();
      });
    }
  } finally {
    await root.evaluate(async (candidate, position) => {
      candidate.ownerDocument.defaultView?.scrollTo(position.x, position.y);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }, scrollPosition);
  }
}

const p10b17EvidenceScreenshotStyle = `
  /* The black N badge and red Issue pill are owned by the Next development
     portal, not by the storefront. Exclude that one known framework host only
     while capturing retained evidence; production lazy loading and storefront
     presentation remain unchanged. */
  nextjs-portal { display: none !important; }
`;

async function assertDevelopmentChromeIsOutsideStorefront(root: Locator): Promise<void> {
  const portalOwnership = await root.evaluate((candidate) =>
    [...candidate.ownerDocument.querySelectorAll("nextjs-portal")].map((portal) => ({
      tagName: portal.tagName.toLowerCase(),
      insideStorefront: candidate.contains(portal),
    })),
  );
  expect(portalOwnership.every(({ tagName }) => tagName === "nextjs-portal")).toBe(true);
  expect(portalOwnership.every(({ insideStorefront }) => !insideStorefront)).toBe(true);
}

export async function storefrontRendererFingerprint(root: Locator): Promise<string> {
  const material = await root.evaluate((element) => {
    const attribute = (node: Element, name: string) => node.getAttribute(name);
    const nodes = [...element.querySelectorAll("[data-component], [data-frame-region]")];
    return {
      language: element.closest("[lang]")?.getAttribute("lang") ?? null,
      frame: nodes
        .filter((node) => node.hasAttribute("data-frame-region"))
        .map((node) => ({
          region: attribute(node, "data-frame-region"),
          profile: attribute(node, "data-frame-profile"),
          variant: attribute(node, "data-variant"),
        })),
      components: nodes
        .filter((node) => node.hasAttribute("data-component"))
        .map((node) => ({
          component: attribute(node, "data-component"),
          variant: attribute(node, "data-variant"),
          responsive: attribute(node, "data-responsive-transformations"),
          execution: attribute(node, "data-responsive-execution-fingerprint"),
        })),
      productCards: [...element.querySelectorAll("article[data-card-anatomy]")].map((node) => ({
        anatomy: attribute(node, "data-card-anatomy"),
        context: attribute(node, "data-card-context"),
        presentation: attribute(node, "data-card-presentation-mode"),
        responsive: attribute(node, "data-responsive-transformations"),
      })),
      headings: [...element.querySelectorAll("h1, h2, h3")].map((heading) => ({
        level: heading.tagName,
        text: heading.textContent?.trim().replace(/\s+/gu, " ") ?? "",
      })),
    };
  });
  return `p10b17-renderer-v1_${createHash("sha256").update(JSON.stringify(material)).digest("hex")}`;
}

/**
 * Captures only rendered structural authority at the active width. Customer
 * copy is deliberately excluded so three identical responsive compositions
 * cannot pass merely because their headings differ.
 */
export async function storefrontResponsiveStructureFingerprint(root: Locator): Promise<string> {
  const material = await root.evaluate((element) => {
    const attribute = (node: Element, name: string) => node.getAttribute(name);
    const structuralNodes = [
      ...element.querySelectorAll<HTMLElement>(
        "[data-frame-region], [data-component], [data-card-anatomy], [data-layout-region]",
      ),
    ];
    const viewportWidth = element.ownerDocument.defaultView?.innerWidth ?? 1;
    return {
      viewportWidth,
      nodes: structuralNodes.map((node) => {
        const style = getComputedStyle(node);
        const bounds = node.getBoundingClientRect();
        return {
          frameRegion: attribute(node, "data-frame-region"),
          frameProfile: attribute(node, "data-frame-profile"),
          component: attribute(node, "data-component"),
          variant: attribute(node, "data-variant"),
          cardAnatomy: attribute(node, "data-card-anatomy"),
          cardPresentation: attribute(node, "data-card-presentation-mode"),
          layoutRegion: attribute(node, "data-layout-region"),
          responsive: attribute(node, "data-responsive-transformations"),
          display: style.display,
          flexDirection: style.flexDirection,
          gridTemplateColumns: style.gridTemplateColumns,
          order: style.order,
          position: style.position,
          leftRatio: Math.round((bounds.left / viewportWidth) * 1_000),
          widthRatio: Math.round((bounds.width / viewportWidth) * 1_000),
        };
      }),
    };
  });
  return `p10b17-responsive-structure-v1_${createHash("sha256")
    .update(JSON.stringify(material))
    .digest("hex")}`;
}

export async function captureP10B17Evidence({
  page,
  generated,
  surface,
  width,
  locale,
  renderer = "proposal",
}: {
  page: Page;
  generated: P10B17GeneratedDirection;
  surface: P10B17Surface;
  width: P10B17Width;
  locale: P10B17Locale;
  renderer?: P10B17EvidenceEntry["renderer"];
}): Promise<P10B17EvidenceEntry> {
  await mkdir(p10b17EvidenceDirectory, { recursive: true });
  await page.setViewportSize({ width, height: width === 375 ? 900 : 1000 });
  const path = p10b17Route({
    surface,
    locale,
    renderer,
    snapshotFingerprint: renderer === "proposal" ? generated.snapshotFingerprint : undefined,
  });
  return withP10B17StableRouteAssertion({
    page,
    path,
    expectedFrame: renderer === "published" ? undefined : generated.selection.sharedFrame.profileId,
    expectedSnapshotFingerprint:
      renderer === "proposal" ? generated.snapshotFingerprint : undefined,
    assertion: async (root) => {
      await waitForStorefrontImages(root);
      await assertDevelopmentChromeIsOutsideStorefront(root);
      const documentSize = await root.evaluate((node) => ({
        height: Math.ceil(node.scrollHeight),
        width: Math.ceil(node.scrollWidth),
      }));
      const rendererFingerprint = await storefrontRendererFingerprint(root);
      const filename =
        ["p10b17", generated.direction, renderer, surface.id, locale, `${width}px`].join("-") +
        ".png";
      await root.screenshot({
        animations: "disabled",
        caret: "hide",
        path: resolve(p10b17EvidenceDirectory, filename),
        style: p10b17EvidenceScreenshotStyle,
      });
      return {
        filename,
        fixture: "aurum-production-disabled",
        direction: generated.direction,
        viewport: width,
        locale,
        surface: surface.id,
        renderer,
        frame: generated.selection.sharedFrame.profileId,
        profileOrArchetype: authorityForSurface(generated.selection, surface),
        snapshotFingerprint: generated.snapshotFingerprint,
        rendererFingerprint,
        commerceFingerprint: generated.protectedCommerceFingerprint,
        mediaFingerprint: generated.protectedMediaFingerprint,
        documentHeight: documentSize.height,
        documentWidth: documentSize.width,
      } satisfies P10B17EvidenceEntry;
    },
  });
}

export async function writeP10B17EvidenceManifest({
  entries,
  performance,
  directions,
  testInfo,
}: {
  entries: readonly P10B17EvidenceEntry[];
  performance: readonly P10B17PerformanceRecord[];
  directions: readonly P10B17GeneratedDirection[];
  testInfo: TestInfo;
}): Promise<string> {
  await mkdir(p10b17EvidenceDirectory, { recursive: true });
  const path = resolve(p10b17EvidenceDirectory, "manifest.json");
  const manifest = {
    contractVersion: "p10b-17-responsive-evidence-v1",
    runId: p10b17EvidenceRunId,
    fixture: "Aurum fictional production-disabled acceptance merchant",
    targetWidths: p10b17Widths,
    locales: ["en", "fi"],
    providerCalls: 0,
    VeskoCalls: 0,
    publicationInvocations: 0,
    directions: directions.map((direction) => ({
      direction: direction.direction,
      snapshotFingerprint: direction.snapshotFingerprint,
      structuralFingerprint: direction.structuralFingerprint,
      compiledDecisionFingerprint: direction.compiledDecisionFingerprint,
      frame: direction.selection.sharedFrame.profileId,
      homepageProfile: direction.selection.profiles.homepage,
      collectionArchetype: direction.selection.dynamicCommerce.collectionArchetypeId,
      simplePdpArchetype: direction.selection.dynamicCommerce.standardSimpleArchetypeId,
      configurablePdpArchetype: direction.selection.dynamicCommerce.configurableArchetypeId,
      commerceFingerprint: direction.protectedCommerceFingerprint,
      mediaFingerprint: direction.protectedMediaFingerprint,
    })),
    captures: entries,
    performance,
  } as const;
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await testInfo.attach("p10b-17-responsive-evidence-manifest", {
    contentType: "application/json",
    path,
  });
  process.stdout.write(`P10B-17 evidence manifest: ${path}\n`);
  return path;
}
