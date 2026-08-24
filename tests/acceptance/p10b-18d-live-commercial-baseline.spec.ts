import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { z } from "zod";
import {
  P10B18D_ACCEPTANCE_CONTEXTS,
  P10B18D_ACCEPTANCE_LOCALE,
  P10B18D_ACCEPTANCE_PROJECT_ID,
  P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY,
  P10B18D_ACCEPTANCE_TOKEN_HEADER,
  P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION,
  P10B18D_LIVE_ACCEPTANCE_MODEL,
  P10B18D_LIVE_ACCEPTANCE_TIMEOUT_MS,
  P10B18D_MOCK_MODEL,
  p10b18dConceptsForRunner,
  p10b18dExpectedAcceptanceStatus,
  type P10B18DLockedConcept,
} from "../helpers/p10b-18d-live-commercial-acceptance";
import {
  parseP10B18DAcceptanceInspectionResponse,
  parseP10B18DConsumedGenerationResponse,
  p10b18dSafeEvidenceFingerprint,
  type P10B18DAcceptanceInspection,
} from "../helpers/p10b-18d-live-safe-evidence";
import {
  assertP10B18DDistinctPageRoles,
  buildP10B18DPreviewUrl,
  p10b18dCaptureSurfaces,
  p10b18dSafePreviewRouteIdentity,
  runP10B18DCandidateEvidenceSequence,
  type P10B18DCaptureSurface,
} from "../helpers/p10b-18d-preview-evidence";

const sessionIdSchema = z.enum(["A", "B"]);
const sessionId = sessionIdSchema.parse(process.env.P10B18D_SESSION);
const expectLive = process.env.P10B18D_EXPECT_LIVE === "1";
const expectedModel = expectLive ? P10B18D_LIVE_ACCEPTANCE_MODEL : P10B18D_MOCK_MODEL;
const resumeAfterOrdinal = process.env.P10B18D_RESUME_AFTER_ORDINAL
  ? z.coerce.number().int().min(1).max(6).parse(process.env.P10B18D_RESUME_AFTER_ORDINAL)
  : undefined;
const runnerConcepts = p10b18dConceptsForRunner({
  sessionId,
  live: expectLive,
  ...(resumeAfterOrdinal === undefined ? {} : { resumeAfterOrdinal }),
});
const expectedRunnerCallCount = runnerConcepts.length;
const evidenceRoot = resolveEvidenceRoot(process.env.P10B18D_EVIDENCE_ROOT);
const sessionDirectory = join(evidenceRoot, `session-${sessionId.toLowerCase()}`);
const screenshotDirectory = join(sessionDirectory, "screenshots");

type CaptureEntry = Readonly<{
  conceptId: string;
  proposalFingerprint: string;
  structuralFingerprint: string;
  safeEvidenceTopologyFingerprint: string;
  surface: P10B18DCaptureSurface["id"];
  route: string;
  viewport: Readonly<{ width: number; height: number }>;
  locale: typeof P10B18D_ACCEPTANCE_LOCALE;
  screenshotPath: string;
  screenshotSha256: string;
  visualFindings: readonly string[];
}>;

type CaseEntry = Readonly<{
  conceptId: string;
  ordinal: number;
  promptFingerprint: string;
  providerId: string;
  modelId: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  sdkTransportEntryCount: 1;
  retryCount: 0;
  fallbackCount: 0;
  strictSchemaFingerprint: string;
  semanticIntentFingerprint: string;
  compiledDecisionFingerprint: string;
  structuralFingerprint: string;
  safeEvidenceTopologyFingerprint: string;
  normalizedTopology: Readonly<Record<string, unknown>>;
  candidateSnapshotFingerprint: string;
  materializationCount: 1;
  selectedAuthority: Readonly<Record<string, unknown>>;
  protectedCommerceBeforeFingerprint: string;
  protectedCommerceAfterFingerprint: string;
  protectedMediaBeforeFingerprint: string;
  protectedMediaAfterFingerprint: string;
  terminalOutcome: "rejected-raw-restored" | "accepted-lifecycle-complete";
}>;

function resolveEvidenceRoot(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized || !isAbsolute(normalized)) {
    throw new Error("P10B18D_EVIDENCE_ROOT must be an absolute external directory.");
  }
  const root = resolve(normalized);
  const repository = resolve(process.cwd());
  const repositoryRelative = relative(repository, root);
  if (
    repositoryRelative === "" ||
    (!repositoryRelative.startsWith("..") && !isAbsolute(repositoryRelative))
  ) {
    throw new Error("P10B-18D evidence must remain outside the repository.");
  }
  return root;
}

function requiredToken(): string {
  const token = process.env[P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY]?.trim();
  if (!token || Buffer.byteLength(token) < 32) {
    throw new Error("The P10B-18D runner requires the configured acceptance token.");
  }
  return token;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  const parsed = z.record(z.string(), z.unknown()).safeParse(value);
  if (!parsed.success) throw new Error(`Expected ${label} to be a record.`);
  return parsed.data;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected ${key} to be a non-empty string.`);
  }
  return value;
}

function requiredArray(record: Record<string, unknown>, key: string): readonly unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`Expected ${key} to be an array.`);
  return value;
}

function safeSelectionSummary(selection: Record<string, unknown>) {
  const sharedFrame = asRecord(selection.sharedFrame, "shared-frame selection");
  const profiles = asRecord(selection.profiles, "profile selection");
  const narrative = asRecord(selection.narrative, "narrative selection");
  const dynamicCommerce = asRecord(selection.dynamicCommerce, "dynamic-commerce selection");
  const selectedArchetypes = asRecord(
    dynamicCommerce.selectedArchetypes,
    "selected dynamic-commerce archetypes",
  );
  const projection = {
    directionId: requiredString(selection, "directionId"),
    designDnaNonColour: asRecord(selection.designDnaNonColour, "non-colour Design DNA"),
    sharedFrame: { profileId: requiredString(sharedFrame, "profileId") },
    profiles: {
      homepage: requiredString(profiles, "homepage"),
      collection: requiredString(profiles, "collection"),
      search: requiredString(profiles, "search"),
      productDetail: requiredString(profiles, "productDetail"),
    },
    orderedHomepageSequence: requiredArray(narrative, "homepageRoleSequence"),
    dynamicCommerce: {
      collectionArchetypeId: requiredString(dynamicCommerce, "collectionArchetypeId"),
      searchArchetypeId: requiredString(dynamicCommerce, "searchArchetypeId"),
      standardSimpleArchetypeId: requiredString(dynamicCommerce, "standardSimpleArchetypeId"),
      configurableArchetypeId: requiredString(dynamicCommerce, "configurableArchetypeId"),
      selectedArchetypes,
    },
    componentChoices: requiredArray(selection, "componentChoices"),
    pageProfileSelections: requiredArray(selection, "pageProfileSelections"),
    productCardAnatomyIds: requiredArray(selection, "productCardAnatomyIds"),
    postures: asRecord(selection.postures, "commercial postures"),
    responsiveArtDirection: asRecord(
      selection.responsiveArtDirection,
      "responsive art-direction authority",
    ),
    staticContentSupportSelections: requiredArray(selection, "staticContentSupportSelections"),
    utilityPresentationSelections: requiredArray(selection, "utilityPresentationSelections"),
  } as const;
  return {
    projection,
    safeEvidenceFingerprint: p10b18dSafeEvidenceFingerprint(projection),
  };
}

function safeErrorMessage(error: unknown, token: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replaceAll(token, "[redacted]").slice(0, 1_000);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function installSameOriginAcceptanceAuthority(
  context: BrowserContext,
  baseUrl: string,
  token: string,
): Promise<void> {
  const origin = new URL(baseUrl).origin;
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin) {
      await route.continue();
      return;
    }
    await route.continue({
      headers: {
        ...request.headers(),
        [P10B18D_ACCEPTANCE_TOKEN_HEADER]: token,
      },
    });
  });
}

async function readInspection(page: Page, baseUrl: string, token: string) {
  const response = await page.request
    .get(`${baseUrl}/api/demo/p10b-16p-04`, {
      headers: { [P10B18D_ACCEPTANCE_TOKEN_HEADER]: token },
      timeout: P10B18D_LIVE_ACCEPTANCE_TIMEOUT_MS,
    })
    .catch(() => {
      throw new Error("The authenticated P10B-18D inspection request did not complete.");
    });
  if (response.status() !== 200) {
    throw new Error(`Acceptance inspection returned HTTP ${response.status()}.`);
  }
  return parseP10B18DAcceptanceInspectionResponse(await response.json());
}

function assertReadyConfiguration(inspection: P10B18DAcceptanceInspection): void {
  expect(inspection).toMatchObject({
    callBudget: P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION,
    providerCallCount: 0,
    retryCount: 0,
    status: "ready",
    failureClassification: null,
    activeAttempt: null,
    failedAttempt: null,
    cases: [],
  });
  expect(inspection.selectedTransport).toMatchObject({
    kind: expectLive ? "openai" : "mock",
    providerId: "openai-prompted-storefront-design-intent-v2",
    modelId: expectedModel,
  });
  if (expectLive) {
    expect(inspection.provider).toMatchObject({
      providerId: "openai-prompted-storefront-design-intent-v2",
      modelId: P10B18D_LIVE_ACCEPTANCE_MODEL,
      timeoutMs: P10B18D_LIVE_ACCEPTANCE_TIMEOUT_MS,
      retryCount: 0,
      category: "eligible",
      credentialsAvailable: true,
    });
  }
}

function widthsFor(
  concept: P10B18DLockedConcept,
  surface: P10B18DCaptureSurface,
): readonly number[] {
  const widths = [375, 1440];
  if (
    [1, 3, 6].includes(concept.ordinal) &&
    (surface.id === "home" || surface.id === "configurable-pdp")
  ) {
    widths.splice(1, 0, 768, 1024);
  }
  return widths;
}

async function storefrontDiagnostics(root: ReturnType<Page["locator"]>) {
  return root.evaluate((element) => {
    const documentElement = element.ownerDocument.documentElement;
    const visible = (candidate: Element) => {
      const html = candidate as HTMLElement;
      const style = window.getComputedStyle(html);
      const rectangle = html.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rectangle.width > 0 &&
        rectangle.height > 0
      );
    };
    const normalizedText = (value: string | null | undefined) =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const accessibleName = (control: Element) => {
      const labelledBy = normalizedText(control.getAttribute("aria-labelledby"));
      if (labelledBy) {
        const referenced = labelledBy
          .split(" ")
          .map((id) => normalizedText(element.ownerDocument.getElementById(id)?.textContent))
          .filter(Boolean)
          .join(" ");
        if (referenced) return referenced;
      }
      const ariaLabel = normalizedText(control.getAttribute("aria-label"));
      if (ariaLabel) return ariaLabel;
      if (control instanceof HTMLElement && "labels" in control) {
        const labels = Array.from((control as HTMLInputElement).labels ?? [])
          .map((label) => normalizedText(label.textContent))
          .filter(Boolean)
          .join(" ");
        if (labels) return labels;
      }
      const tagName = control.tagName;
      if (["BUTTON", "A", "SUMMARY"].includes(tagName)) {
        const text = normalizedText(control.textContent);
        if (text) return text;
      }
      if (tagName === "IMG") {
        const alt = normalizedText(control.getAttribute("alt"));
        if (alt) return alt;
      }
      if (tagName === "INPUT") {
        const input = control as HTMLInputElement;
        if (["button", "submit", "reset"].includes(input.type)) {
          const value = normalizedText(input.value);
          if (value) return value;
        }
      }
      return normalizedText(control.getAttribute("title"));
    };
    const interactive = Array.from(
      element.querySelectorAll(
        'button, a[href], input, select, textarea, summary, [role="button"], [role="link"]',
      ),
    ).filter((control) => visible(control) && !control.hasAttribute("disabled"));
    const images = Array.from(element.querySelectorAll<HTMLImageElement>("img")).filter(visible);
    const customerText = normalizedText(element.textContent);
    const internalTerms = Array.from(
      customerText.matchAll(/\b(?:demo|audit|fixture|deterministic|verification|test-only)\b/gi),
      (match) => match[0]?.toLocaleLowerCase("en") ?? "",
    ).filter(Boolean);
    return {
      documentLocale: documentElement.lang,
      horizontalOverflow: documentElement.scrollWidth > documentElement.clientWidth + 1,
      errorBoundaryVisible: customerText.includes("This page couldn\u2019t load"),
      placeholderCount: element.querySelectorAll('img[src*="placeholder"], [data-placeholder]')
        .length,
      brokenImageCount: images.filter(
        (image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0,
      ).length,
      unnamedControlCount: interactive.filter((control) => !accessibleName(control)).length,
      internalTerms: [...new Set(internalTerms)].slice(0, 10),
    };
  });
}

async function captureSurface(input: {
  page: Page;
  baseUrl: string;
  concept: P10B18DLockedConcept;
  surface: P10B18DCaptureSurface;
  width: number;
  candidateFingerprint: string;
  structuralFingerprint: string;
  safeEvidenceTopologyFingerprint: string;
  token: string;
}): Promise<CaptureEntry> {
  const height = input.width < 768 ? 1_200 : 1_000;
  const page = input.page;
  await page.setViewportSize({ width: input.width, height });
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(safeErrorMessage(error, input.token)));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(safeErrorMessage(message.text(), input.token));
    }
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    requestFailures.push(
      `${request.method()} ${url.pathname}: ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const url = new URL(response.url());
      failedResponses.push(`${response.status()} ${url.pathname}`);
    }
  });

  const route = buildP10B18DPreviewUrl({
    baseUrl: input.baseUrl,
    surface: input.surface,
    kind: "candidate",
    candidateFingerprint: input.candidateFingerprint,
  });
  const filename = `${String(input.concept.ordinal).padStart(2, "0")}-${input.concept.id}-${input.surface.id}-${input.width}.png`;
  const screenshotPath = join(screenshotDirectory, filename);
  try {
    const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 120_000 });
    if (!response || response.status() >= 400) {
      await page.screenshot({ path: `${screenshotPath}.failure.png`, fullPage: true });
      throw new Error(`${input.surface.id} returned HTTP ${response?.status() ?? "unavailable"}.`);
    }
    const root = page.locator(".project-preview__storefront");
    try {
      await expect(root).toBeVisible({ timeout: 30_000 });
    } catch (error) {
      await page.screenshot({ path: `${screenshotPath}.failure.png`, fullPage: true });
      throw error;
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const diagnostics = await storefrontDiagnostics(root);
    if (diagnostics.errorBoundaryVisible) {
      await page.screenshot({ path: `${screenshotPath}.failure.png`, fullPage: true });
      throw new Error(`${input.surface.id} rendered the storefront error boundary.`);
    }
    if (
      pageErrors.length > 0 ||
      consoleErrors.length > 0 ||
      requestFailures.length > 0 ||
      failedResponses.length > 0
    ) {
      await page.screenshot({ path: `${screenshotPath}.failure.png`, fullPage: true });
      throw new Error(
        `${input.surface.id} runtime failure: ${JSON.stringify({
          pageErrors,
          consoleErrors,
          requestFailures,
          failedResponses,
        })}`,
      );
    }
    await root.screenshot({ path: screenshotPath, animations: "disabled" });
    const screenshotSha256 = createHash("sha256")
      .update(await readFile(screenshotPath))
      .digest("hex");
    const visualFindings = [
      ...(diagnostics.documentLocale === P10B18D_ACCEPTANCE_LOCALE
        ? []
        : [`locale:${diagnostics.documentLocale || "missing"}`]),
      ...(diagnostics.horizontalOverflow ? ["horizontal-overflow"] : []),
      ...(diagnostics.placeholderCount > 0
        ? [`placeholder-count:${diagnostics.placeholderCount}`]
        : []),
      ...(diagnostics.brokenImageCount > 0
        ? [`broken-image-count:${diagnostics.brokenImageCount}`]
        : []),
      ...(diagnostics.unnamedControlCount > 0
        ? [`unnamed-control-count:${diagnostics.unnamedControlCount}`]
        : []),
      ...diagnostics.internalTerms.map((term) => `internal-term:${term}`),
    ];
    return {
      conceptId: input.concept.id,
      proposalFingerprint: input.candidateFingerprint,
      structuralFingerprint: input.structuralFingerprint,
      safeEvidenceTopologyFingerprint: input.safeEvidenceTopologyFingerprint,
      surface: input.surface.id,
      route: p10b18dSafePreviewRouteIdentity(route),
      viewport: { width: input.width, height },
      locale: P10B18D_ACCEPTANCE_LOCALE,
      screenshotPath,
      screenshotSha256,
      visualFindings,
    };
  } finally {
    // The concept-owned evidence page is closed only after every surface is captured.
  }
}

async function proveSavedPreview(input: {
  context: BrowserContext;
  baseUrl: string;
  surface: P10B18DCaptureSurface;
  token: string;
}): Promise<void> {
  const page = await input.context.newPage();
  await page.setViewportSize({ width: 1440, height: 1_000 });
  const runtimeFailures: string[] = [];
  page.on("pageerror", (error) => runtimeFailures.push(safeErrorMessage(error, input.token)));
  page.on("console", (message) => {
    if (message.type() === "error")
      runtimeFailures.push(safeErrorMessage(message.text(), input.token));
  });
  try {
    const response = await page.goto(
      buildP10B18DPreviewUrl({
        baseUrl: input.baseUrl,
        surface: input.surface,
        kind: "raw-draft",
      }),
      {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      },
    );
    expect(response?.status()).toBe(200);
    const root = page.locator(".project-preview__storefront");
    await expect(root).toBeVisible({ timeout: 30_000 });
    expect((await storefrontDiagnostics(root)).errorBoundaryVisible).toBe(false);
    expect(runtimeFailures).toEqual([]);
  } finally {
    await page.close();
  }
}

async function prewarmCaptureRoutes(input: {
  context: BrowserContext;
  baseUrl: string;
}): Promise<void> {
  for (const surface of p10b18dCaptureSurfaces) {
    const page = await input.context.newPage();
    try {
      await page.setViewportSize({ width: 1440, height: 1_000 });
      const response = await page.goto(
        buildP10B18DPreviewUrl({
          baseUrl: input.baseUrl,
          surface,
          kind: "raw-draft",
        }),
        { waitUntil: "domcontentloaded", timeout: 300_000 },
      );
      expect(response?.status()).toBe(200);
      await expect(
        page
          .locator(".project-preview__storefront")
          .or(page.getByRole("heading", { name: "Page unavailable", exact: true })),
        `Expected the ${surface.id} route to reach a bounded prewarm state.`,
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await page.close();
    }
  }
}

async function proveRawDraftRoute(input: {
  context: BrowserContext;
  baseUrl: string;
}): Promise<void> {
  const page = await input.context.newPage();
  const home = p10b18dCaptureSurfaces.find(({ id }) => id === "home");
  if (!home) throw new Error("The P10B-18D raw-draft home witness is unavailable.");
  try {
    const route = buildP10B18DPreviewUrl({
      baseUrl: input.baseUrl,
      surface: home,
      kind: "raw-draft",
    });
    expect(new URL(route).searchParams.has("p10b-16p-04-proposal")).toBe(false);
    const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
    expect(response?.status()).toBe(200);
    await expect(page.locator(".project-preview__storefront")).toBeVisible({ timeout: 30_000 });
  } finally {
    await page.close();
  }
}

async function openEditor(page: Page, baseUrl: string): Promise<string> {
  const response = await page.goto(
    `${baseUrl}/projects/${P10B18D_ACCEPTANCE_PROJECT_ID}/editor?locale=${P10B18D_ACCEPTANCE_LOCALE}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  expect(response?.status()).toBe(200);
  const editor = page.locator("[data-p10b16p04-active-draft-fingerprint]");
  await expect(editor).toBeVisible({ timeout: 30_000 });
  const fingerprint = await editor.getAttribute("data-p10b16p04-active-draft-fingerprint");
  if (!fingerprint) throw new Error("The raw fixture fingerprint is unavailable.");
  const request = page.locator("#design-request");
  if (!(await request.isVisible())) {
    await page.getByRole("button", { name: "Open AI assistant" }).click();
  }
  await expect(request).toBeVisible();
  const storefrontTarget = page.locator('input[name="design-agent-target"][value="storefront"]');
  if (!(await storefrontTarget.isChecked())) await storefrontTarget.check();
  return fingerprint;
}

async function prepareStudioControlPageDevelopmentContinuity(page: Page): Promise<() => void> {
  let frozen = false;
  await page.goto("about:blank");
  await page.routeWebSocket(/\/_next\/webpack-hmr(?:\?.*)?$/, (controlSocket) => {
    const serverSocket = controlSocket.connectToServer();
    controlSocket.onMessage((message) => serverSocket.send(message));
    serverSocket.onMessage((message) => {
      if (!frozen) controlSocket.send(message);
    });
  });
  return () => {
    frozen = true;
  };
}

async function generateProposal(input: {
  page: Page;
  baseUrl: string;
  concept: P10B18DLockedConcept;
}) {
  const request = input.page.locator("#design-request");
  await request.fill(input.concept.prompt);
  const responsePromise = input.page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/ai/whole-storefront-proposals",
    { timeout: 180_000 },
  );
  await input.page.locator("form:has(#design-request) button[type=submit]").click();
  const response = await responsePromise;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Proposal route returned a malformed response at HTTP ${response.status()}.`);
  }
  let result: ReturnType<typeof parseP10B18DConsumedGenerationResponse>;
  try {
    result = parseP10B18DConsumedGenerationResponse(body);
  } catch {
    throw new Error(
      `Proposal route returned malformed safe evidence at HTTP ${response.status()}.`,
    );
  }
  if (!result.ok) {
    throw new Error(
      `Proposal route failed closed at HTTP ${response.status()}: ${result.failure.category}.`,
    );
  }
  if (response.status() !== 200) {
    throw new Error(`Proposal route returned an unexpected success at HTTP ${response.status()}.`);
  }
  await expect(input.page.getByTestId("canonical-storefront-generation-review")).toBeVisible({
    timeout: 30_000,
  });
  await expect(input.page.getByLabel("Proposal preview canvas")).toBeVisible({ timeout: 30_000 });
  return result;
}

async function rejectProposal(page: Page, rawFingerprint: string): Promise<void> {
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByTestId("canonical-storefront-generation-review")).toHaveCount(0);
  await expect(page.locator("[data-p10b16p04-active-draft-fingerprint]")).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    rawFingerprint,
  );
  await expect(page.locator("#design-request")).toBeEnabled();
}

async function completeLifecycle(input: {
  page: Page;
  context: BrowserContext;
  baseUrl: string;
  rawFingerprint: string;
  candidateFingerprint: string;
  token: string;
}): Promise<void> {
  await input.page.getByRole("button", { name: "Accept and apply", exact: true }).click();
  const dialog = input.page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Apply storefront proposal", exact: true }).click();
  const editor = input.page.locator("[data-p10b16p04-active-draft-fingerprint]");
  await expect(editor).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    input.candidateFingerprint,
  );
  await input.page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    input.rawFingerprint,
  );
  await input.page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    input.candidateFingerprint,
  );
  await input.page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(input.page.getByText("Draft saved successfully.")).toBeVisible({ timeout: 30_000 });
  await input.page.reload({ waitUntil: "domcontentloaded" });
  await expect(input.page.locator("[data-p10b16p04-active-draft-fingerprint]")).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    input.candidateFingerprint,
  );
  const preview = input.page.getByRole("link", { name: "Preview storefront", exact: true });
  await expect(preview).toBeVisible();
  const previewHref = await preview.getAttribute("href");
  expect(previewHref).toContain(`/projects/${P10B18D_ACCEPTANCE_PROJECT_ID}`);
  for (const surface of p10b18dCaptureSurfaces) {
    await proveSavedPreview({
      context: input.context,
      baseUrl: input.baseUrl,
      surface,
      token: input.token,
    });
  }
}

test.describe("P10B-18D live commercial storefront baseline", () => {
  test(
    expectLive
      ? `runs authorized Session ${sessionId} in locked order`
      : "runs the mocked Concept 1 runner smoke",
    async ({ page, context }, testInfo) => {
      const baseUrl = testInfo.project.use.baseURL;
      if (typeof baseUrl !== "string") throw new Error("The acceptance base URL is unavailable.");
      const token = requiredToken();
      await mkdir(screenshotDirectory, { recursive: true });
      await installSameOriginAcceptanceAuthority(context, baseUrl, token);
      const startedAt = new Date().toISOString();
      const captures: CaptureEntry[] = [];
      const cases: CaseEntry[] = [];
      const ledgerPath = join(sessionDirectory, "session-ledger.json");
      let activeConceptId: string | null = null;
      let activeSafeCase: Omit<CaseEntry, "terminalOutcome"> | null = null;
      const persist = async (
        failure: null | Readonly<{ conceptId: string | null; message: string }>,
      ) =>
        writeJson(ledgerPath, {
          version: "p10b-18d-live-session-ledger-v1",
          sessionId,
          transport: expectLive ? "live" : "mock",
          providerId: "openai-prompted-storefront-design-intent-v2",
          modelId: expectedModel,
          timeoutMs: P10B18D_LIVE_ACCEPTANCE_TIMEOUT_MS,
          retryCount: 0,
          fallbackCount: 0,
          callBudget: P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION,
          resumeAfterOrdinal: resumeAfterOrdinal ?? null,
          fixture: {
            projectId: P10B18D_ACCEPTANCE_PROJECT_ID,
            collectionId: P10B18D_ACCEPTANCE_CONTEXTS.collection.collectionId,
            simpleProductId: P10B18D_ACCEPTANCE_CONTEXTS.simpleProduct.productId,
            configurableProductId: P10B18D_ACCEPTANCE_CONTEXTS.configurableProduct.productId,
            locale: P10B18D_ACCEPTANCE_LOCALE,
          },
          startedAt,
          updatedAt: new Date().toISOString(),
          cases,
          activeSafeCase,
          captures,
          failure,
        });

      await persist(null);
      try {
        const readiness = await readInspection(page, baseUrl, token);
        assertReadyConfiguration(readiness);
        const bootstrapRawFingerprint = await openEditor(page, baseUrl);
        await prewarmCaptureRoutes({ context, baseUrl });
        await page.waitForTimeout(1_000);
        const freezeStudioDevelopmentReloads =
          await prepareStudioControlPageDevelopmentContinuity(page);
        const rawFingerprint = await openEditor(page, baseUrl);
        expect(rawFingerprint).toBe(bootstrapRawFingerprint);
        freezeStudioDevelopmentReloads();
        for (const concept of runnerConcepts) {
          activeConceptId = concept.id;
          await expect(page.locator("[data-p10b16p04-active-draft-fingerprint]")).toHaveAttribute(
            "data-p10b16p04-active-draft-fingerprint",
            rawFingerprint,
          );
          const result = await generateProposal({ page, baseUrl, concept });
          expect(result.lineage).toMatchObject({
            providerId: "openai-prompted-storefront-design-intent-v2",
            modelId: expectedModel,
            providerCallCount: 1,
            retryCount: 0,
            materializationCount: 1,
          });
          expect(result.lineage.protectedCommerceAfterFingerprint).toBe(
            result.lineage.protectedCommerceBeforeFingerprint,
          );
          expect(result.lineage.protectedMediaAfterFingerprint).toBe(
            result.lineage.protectedMediaBeforeFingerprint,
          );
          await expect(page.locator("[data-p10b16p04-active-draft-fingerprint]")).toHaveAttribute(
            "data-p10b16p04-active-draft-fingerprint",
            rawFingerprint,
          );

          const inspection = await readInspection(page, baseUrl, token);
          const expectedCaseNumber = cases.length + 1;
          expect(inspection).toMatchObject({
            providerCallCount: expectedCaseNumber,
            retryCount: 0,
            failureClassification: null,
            activeAttempt: null,
            failedAttempt: null,
          });
          expect(inspection.cases).toHaveLength(expectedCaseNumber);
          const caseEvidence = inspection.cases[expectedCaseNumber - 1];
          if (!caseEvidence) throw new Error(`Safe evidence is missing for ${concept.id}.`);
          expect(caseEvidence).toMatchObject({
            caseNumber: expectedCaseNumber,
            providerCallCount: expectedCaseNumber,
            providerId: "openai-prompted-storefront-design-intent-v2",
            modelId: expectedModel,
            retryCount: 0,
            sdkTransportEntryCount: 1,
            materializationCount: 1,
            protectedCommerce: "unchanged",
            canonicalProductMedia: "unchanged",
            requestFingerprint: result.lineage.requestFingerprint,
            promptFingerprint: result.lineage.promptFingerprint,
            intentFingerprint: result.lineage.providerIntentFingerprint,
            compiledDecisionFingerprint: result.lineage.compiledDecisionFingerprint,
            structuralFingerprint: result.lineage.structuralFingerprint,
            candidateSnapshotFingerprint: result.lineage.candidateSnapshotFingerprint,
          });
          if (expectLive) {
            expect(caseEvidence.inputTokens).toEqual(expect.any(Number));
            expect(caseEvidence.outputTokens).toEqual(expect.any(Number));
            expect(caseEvidence.totalTokens).toEqual(expect.any(Number));
          }
          const normalizedTopology = safeSelectionSummary(caseEvidence.selection);
          const lifecycleWitness = expectLive && sessionId === "B" && concept.ordinal === 6;
          const safeCaseEntry: Omit<CaseEntry, "terminalOutcome"> = {
            conceptId: concept.id,
            ordinal: concept.ordinal,
            promptFingerprint: caseEvidence.promptFingerprint,
            providerId: caseEvidence.providerId,
            modelId: caseEvidence.modelId,
            durationMs: caseEvidence.durationMs,
            ...(caseEvidence.inputTokens === undefined
              ? {}
              : { inputTokens: caseEvidence.inputTokens }),
            ...(caseEvidence.outputTokens === undefined
              ? {}
              : { outputTokens: caseEvidence.outputTokens }),
            ...(caseEvidence.totalTokens === undefined
              ? {}
              : { totalTokens: caseEvidence.totalTokens }),
            sdkTransportEntryCount: 1,
            retryCount: 0,
            fallbackCount: 0,
            strictSchemaFingerprint: caseEvidence.providerSchemaFingerprint,
            semanticIntentFingerprint: caseEvidence.intentFingerprint,
            compiledDecisionFingerprint: caseEvidence.compiledDecisionFingerprint,
            structuralFingerprint: caseEvidence.structuralFingerprint,
            safeEvidenceTopologyFingerprint: normalizedTopology.safeEvidenceFingerprint,
            normalizedTopology: normalizedTopology.projection,
            candidateSnapshotFingerprint: caseEvidence.candidateSnapshotFingerprint,
            materializationCount: 1,
            selectedAuthority: caseEvidence.selection,
            protectedCommerceBeforeFingerprint: caseEvidence.protectedCommerceBeforeFingerprint,
            protectedCommerceAfterFingerprint: caseEvidence.protectedCommerceAfterFingerprint,
            protectedMediaBeforeFingerprint: caseEvidence.protectedMediaBeforeFingerprint,
            protectedMediaAfterFingerprint: caseEvidence.protectedMediaAfterFingerprint,
          };
          let controlContinuity:
            | Readonly<{
                url: string;
                documentMarker: string;
                candidateFingerprint: string;
              }>
            | undefined;
          await runP10B18DCandidateEvidenceSequence({
            persistSafeEvidence: async () => {
              activeSafeCase = safeCaseEntry;
              await persist(null);
            },
            captureCandidate: async () => {
              const controlUrl = page.url();
              const documentMarker = `p10b18d-control-${concept.ordinal}`;
              await page.evaluate(
                ({ marker, candidateFingerprint }) => {
                  document.documentElement.dataset.p10b18dControlContinuity = marker;
                  document.documentElement.dataset.p10b18dControlProposalFingerprint =
                    candidateFingerprint;
                },
                {
                  marker: documentMarker,
                  candidateFingerprint: caseEvidence.candidateSnapshotFingerprint,
                },
              );
              const proposalCanvas = page.getByLabel("Proposal preview canvas");
              await expect(
                proposalCanvas.frameLocator("iframe").locator('[data-veskify-canvas-root="true"]'),
              ).toBeVisible();
              await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
              controlContinuity = {
                url: controlUrl,
                documentMarker,
                candidateFingerprint: caseEvidence.candidateSnapshotFingerprint,
              };

              const evidencePage = await context.newPage();
              assertP10B18DDistinctPageRoles(page, evidencePage);
              try {
                for (const surface of p10b18dCaptureSurfaces) {
                  for (const width of expectLive ? widthsFor(concept, surface) : [1_440]) {
                    captures.push(
                      await captureSurface({
                        page: evidencePage,
                        baseUrl,
                        concept,
                        surface,
                        width,
                        candidateFingerprint: caseEvidence.candidateSnapshotFingerprint,
                        structuralFingerprint: caseEvidence.structuralFingerprint,
                        safeEvidenceTopologyFingerprint: normalizedTopology.safeEvidenceFingerprint,
                        token,
                      }),
                    );
                    await persist(null);
                  }
                }
              } finally {
                await evidencePage.close();
              }
            },
            assertControlContinuity: async () => {
              if (!controlContinuity) {
                throw new Error(`The ${concept.id} Studio control identity was not retained.`);
              }
              expect(page.isClosed()).toBe(false);
              expect(page.url()).toBe(controlContinuity.url);
              expect(
                await page.evaluate(
                  () => document.documentElement.dataset.p10b18dControlContinuity ?? null,
                ),
              ).toBe(controlContinuity.documentMarker);
              expect(
                await page.evaluate(
                  () => document.documentElement.dataset.p10b18dControlProposalFingerprint ?? null,
                ),
              ).toBe(controlContinuity.candidateFingerprint);
              const proposalReview = page.getByTestId("canonical-storefront-generation-review");
              await expect(proposalReview).toBeVisible();
              await expect(
                page
                  .getByLabel("Proposal preview canvas")
                  .frameLocator("iframe")
                  .locator('[data-veskify-canvas-root="true"]'),
              ).toBeVisible();
              await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
            },
            completeTerminalLifecycle: async () => {
              if (lifecycleWitness) {
                await completeLifecycle({
                  page,
                  context,
                  baseUrl,
                  rawFingerprint,
                  candidateFingerprint: caseEvidence.candidateSnapshotFingerprint,
                  token,
                });
              } else {
                await rejectProposal(page, rawFingerprint);
                await proveRawDraftRoute({ context, baseUrl });
              }
            },
          });
          cases.push({
            ...safeCaseEntry,
            terminalOutcome: lifecycleWitness
              ? "accepted-lifecycle-complete"
              : "rejected-raw-restored",
          });
          activeSafeCase = null;
          activeConceptId = null;
          await persist(null);
        }

        const completed = await readInspection(page, baseUrl, token);
        expect(completed).toMatchObject({
          providerCallCount: expectedRunnerCallCount,
          retryCount: 0,
          status: p10b18dExpectedAcceptanceStatus(expectedRunnerCallCount),
          failureClassification: null,
          activeAttempt: null,
          failedAttempt: null,
        });
        expect(cases).toHaveLength(expectedRunnerCallCount);
        const expectedCaptureCount = runnerConcepts.reduce(
          (conceptTotal, concept) =>
            conceptTotal +
            p10b18dCaptureSurfaces.reduce(
              (surfaceTotal, surface) =>
                surfaceTotal + (expectLive ? widthsFor(concept, surface).length : 1),
              0,
            ),
          0,
        );
        expect(captures).toHaveLength(expectedCaptureCount);
        await persist(null);
      } catch (error) {
        await persist({ conceptId: activeConceptId, message: safeErrorMessage(error, token) });
        throw error;
      }
    },
  );
});
