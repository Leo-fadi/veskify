import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import {
  captureP10B16P06SearchEvidence,
  writeP10B16P06SearchEvidenceManifest,
  type P10B16P06SearchEvidenceEntry,
} from "./p10b-16p-06-search-evidence";
import { openEditorAssistant } from "./editor-assistant";

const projectId = "project_p10b16p04_aurum_commercial_acceptance";
const editorUrl = `/projects/${projectId}/editor`;
const draftSearchPath = `/projects/${projectId}/search`;
const publishedSearchPath = `/projects/${projectId}/published/search`;
const generationPath = "/api/ai/whole-storefront-proposals";
const publicationPath = "/api/storefront-publish";
const acceptanceTokenHeader = "x-veskify-p10b-16p-04-acceptance-token";
const widths = [375, 768, 1024, 1440] as const;

type ForbiddenRequests = Readonly<{
  providers: string[];
  Vesko: string[];
  generation: string[];
  publication: string[];
  writes: string[];
}>;

function requiredAcceptanceToken(): string {
  const token = process.env.P10B16P06_PLAYWRIGHT_ACCEPTANCE_TOKEN;
  if (!token || Buffer.byteLength(token) < 32) {
    throw new Error("The controlled P10B-16P-06 browser authority is unavailable.");
  }
  return token;
}

async function installOfflineAcceptanceAuthority(page: Page): Promise<ForbiddenRequests> {
  const configuredBaseUrl = test.info().project.use.baseURL;
  if (typeof configuredBaseUrl !== "string") {
    throw new Error("The controlled search browser requires one exact base URL.");
  }
  const baseOrigin = new URL(configuredBaseUrl).origin;
  const token = requiredAcceptanceToken();
  const requests: ForbiddenRequests = {
    providers: [],
    Vesko: [],
    generation: [],
    publication: [],
    writes: [],
  };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "api.openai.com" || url.hostname.endsWith(".openai.com")) {
      requests.providers.push(request.url());
    }
    if (url.hostname === "vesko.fi" || url.hostname.endsWith(".vesko.fi")) {
      requests.Vesko.push(request.url());
    }
    if (url.pathname === generationPath) requests.generation.push(request.method());
    if (url.pathname === publicationPath) requests.publication.push(request.method());
    if (
      new URL(request.url()).origin === baseOrigin &&
      url.pathname !== generationPath &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    ) {
      requests.writes.push(`${request.method()} ${url.pathname}`);
    }
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const original = Object.fromEntries(
      Object.entries(request.headers()).filter(
        ([key]) => key.toLowerCase() !== acceptanceTokenHeader,
      ),
    );
    if (
      url.hostname === "api.openai.com" ||
      url.hostname.endsWith(".openai.com") ||
      url.hostname === "vesko.fi" ||
      url.hostname.endsWith(".vesko.fi")
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue({
      headers:
        url.origin === baseOrigin ? { ...original, [acceptanceTokenHeader]: token } : original,
    });
  });
  return requests;
}

async function controlledPage(context: BrowserContext) {
  const controlled = await context.newPage();
  const requests = await installOfflineAcceptanceAuthority(controlled);
  return { controlled, requests } as const;
}

async function seedControlledAurumDraft(page: Page): Promise<string> {
  await page.goto(editorUrl, { waitUntil: "domcontentloaded" });
  const editor = page.locator("[data-p10b16p04-active-draft-fingerprint]");
  await expect(editor).toBeVisible({ timeout: 60_000 });
  const fingerprint = await editor.getAttribute("data-p10b16p04-active-draft-fingerprint");
  if (!fingerprint) throw new Error("The controlled Aurum draft fingerprint is unavailable.");
  await expect(page.getByRole("button", { name: /Save draft|Tallenna luonnos/ })).toBeDisabled();
  return fingerprint;
}

async function storedDraftBytes(page: Page): Promise<string> {
  return page.evaluate(async (requestedProjectId) => {
    const value = <Value>(request: IDBRequest<Value>) =>
      new Promise<Value>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error("Could not read the controlled draft."));
      });
    const open = indexedDB.open("veskify");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(new Error("Could not open controlled Studio storage."));
    });
    const project = (await value(
      database.transaction("projects", "readonly").objectStore("projects").get(requestedProjectId),
    )) as { draftSnapshotId: string } | undefined;
    if (!project) throw new Error("The controlled Aurum project is missing.");
    const draft: unknown = await value(
      database
        .transaction("snapshots", "readonly")
        .objectStore("snapshots")
        .get(project.draftSnapshotId) as IDBRequest<unknown>,
    );
    database.close();
    return JSON.stringify(draft);
  }, projectId);
}

function searchRoot(page: Page) {
  return page.locator('[data-search-context="transient-canonical-results"]');
}

async function expectResults({
  page,
  query,
  locale,
  count,
  productIds,
}: {
  page: Page;
  query: string;
  locale: "en" | "fi";
  count: number;
  productIds: readonly string[];
}) {
  await expect(page).toHaveURL((url) => {
    return url.pathname.endsWith("/search") && url.searchParams.get("q") === query;
  });
  const root = searchRoot(page);
  await expect(root).toBeVisible({ timeout: 60_000 });
  await expect(root.locator('[data-search-state="results"]')).toHaveAttribute(
    "data-search-result-count",
    String(count),
  );
  await expect(root.locator("[data-primary-collection-id]")).toHaveCount(0);
  await expect(
    root.getByText(locale === "fi" ? "Hakutulokset" : "Search results").first(),
  ).toBeVisible();
  const cards = root.locator("[data-product-id]");
  await expect(cards).toHaveCount(productIds.length);
  expect(
    await cards.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.productId),
    ),
  ).toEqual(productIds);
  await expect(root.getByText(/Filters|Suodattimet/)).toHaveCount(0);
  await expect(root.getByText(/Sort by|Lajittele/)).toHaveCount(0);
}

function assertOffline(requests: ForbiddenRequests, expectedGenerationRequests = 0): void {
  expect(requests.providers).toEqual([]);
  expect(requests.Vesko).toEqual([]);
  expect(requests.generation).toEqual(
    Array.from({ length: expectedGenerationRequests }, () => "POST"),
  );
  expect(requests.publication).toEqual([]);
  expect(requests.writes).toEqual([]);
}

test.describe.configure({ timeout: 600_000 });

test("canonical search remains transient across draft reload and published rendering", async ({
  browserName,
  page,
}, testInfo: TestInfo) => {
  test.skip(browserName !== "chromium", "The controlled search evidence uses one Chromium worker.");
  const requests = await installOfflineAcceptanceAuthority(page);
  const rawFingerprint = await seedControlledAurumDraft(page);
  expect(rawFingerprint).toMatch(/^v1_\d+_[0-9a-f]{64}$/u);
  const storedBefore = await storedDraftBytes(page);
  expect(storedBefore).not.toContain("p10b16p06-query-never-persisted");
  const evidence: P10B16P06SearchEvidenceEntry[] = [];

  await page.goto(`/projects/${projectId}`, { waitUntil: "domcontentloaded" });
  const searchForm = page.locator('form[role="search"]:visible').first();
  await expect(searchForm).toHaveAttribute("method", "get");
  await expect(searchForm).toHaveAttribute("action", draftSearchPath);
  await expect(searchForm.locator('input[name="locale"]')).toHaveValue("en");
  await searchForm.getByRole("searchbox", { name: "Search products" }).fill("Sisu Automatic Watch");
  await Promise.all([
    page.waitForURL(
      (url) => url.pathname === draftSearchPath && url.searchParams.get("q") !== null,
    ),
    searchForm.getByRole("button", { name: "Search", exact: true }).click(),
  ]);
  await expectResults({
    page,
    query: "Sisu Automatic Watch",
    locale: "en",
    count: 1,
    productIds: ["product_sisu_automatic_watch"],
  });
  evidence.push(
    await captureP10B16P06SearchEvidence({
      page,
      renderer: "draft",
      scenario: "exact-title",
      width: 1440,
      locale: "en",
      query: "Sisu Automatic Watch",
    }),
  );
  await page.getByRole("button", { name: "View product" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/products/sisu-automatic-watch`));
  await expect(page.getByRole("heading", { name: "Sisu Automatic Watch", level: 1 })).toBeVisible();
  evidence.push(
    await captureP10B16P06SearchEvidence({
      page,
      renderer: "draft",
      scenario: "result-to-pdp",
      surface: "product-detail",
      width: 1440,
      locale: "en",
      query: "Sisu Automatic Watch",
    }),
  );

  await page.goto(`${draftSearchPath}?q=925&locale=en`, { waitUntil: "domcontentloaded" });
  await expectResults({
    page,
    query: "925",
    locale: "en",
    count: 2,
    productIds: ["product_aava_necklace_925", "product_meri_bracelet_925"],
  });
  await page.goto(`${draftSearchPath}?q=RING-AUR-585&locale=en`, {
    waitUntil: "domcontentloaded",
  });
  await expectResults({
    page,
    query: "RING-AUR-585",
    locale: "en",
    count: 1,
    productIds: ["product_aurora_ring_585"],
  });
  evidence.push(
    await captureP10B16P06SearchEvidence({
      page,
      renderer: "draft",
      scenario: "exact-sku",
      width: 1440,
      locale: "en",
      query: "RING-AUR-585",
    }),
  );

  await page.goto(`${draftSearchPath}?q=does-not-exist&locale=en`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "No results found" })).toBeVisible();
  await expect(searchRoot(page).locator('[data-search-zero-results="true"]')).toHaveAttribute(
    "data-search-query",
    "does-not-exist",
  );
  evidence.push(
    await captureP10B16P06SearchEvidence({
      page,
      renderer: "draft",
      scenario: "no-results",
      width: 1440,
      locale: "en",
      query: "does-not-exist",
    }),
  );
  await page.goto(`${draftSearchPath}?locale=en`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Search products" })).toBeVisible();
  await expect(searchRoot(page).locator('[data-search-empty-query="true"]')).toBeVisible();
  evidence.push(
    await captureP10B16P06SearchEvidence({
      page,
      renderer: "draft",
      scenario: "empty-query",
      width: 1440,
      locale: "en",
      query: "",
    }),
  );

  await page.goto(`${draftSearchPath}?q=sormus&locale=fi`, { waitUntil: "domcontentloaded" });
  await expectResults({
    page,
    query: "sormus",
    locale: "fi",
    count: 2,
    productIds: ["product_aurora_ring_585", "product_lumi_halo_ring"],
  });
  await expect(page.locator('.project-preview[lang="fi"]')).toBeVisible();
  await expect(
    page
      .locator('form[role="search"]:visible')
      .first()
      .getByRole("searchbox", { name: "Hae tuotteita" }),
  ).toHaveValue("sormus");
  evidence.push(
    await captureP10B16P06SearchEvidence({
      page,
      renderer: "draft",
      scenario: "finnish-results",
      width: 1440,
      locale: "fi",
      query: "sormus",
    }),
  );

  await page.goto(editorUrl, { waitUntil: "domcontentloaded" });
  await openEditorAssistant(page);
  await page.getByRole("radio", { name: /Entire storefront|Koko verkkokauppa/ }).check();
  const prompt = page.getByLabel(/Your request|Pyyntösi/);
  await prompt.fill(
    "Create a restrained premium jewellery storefront with clear product discovery and configurable-product guidance.",
  );
  const generationResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === generationPath && response.request().method() === "POST",
    { timeout: 180_000 },
  );
  await page.getByRole("button", { name: /Generate storefront|Luo verkkokauppa/ }).click();
  const generated = await generationResponse;
  expect(generated.status()).toBe(200);
  const result = (await generated.json()) as {
    ok: boolean;
    lineage: {
      candidateSnapshotFingerprint: string;
      protectedCommerceBeforeFingerprint: string;
      protectedCommerceAfterFingerprint: string;
      protectedMediaBeforeFingerprint: string;
      protectedMediaAfterFingerprint: string;
    };
  };
  expect(result.ok).toBe(true);
  expect(result.lineage.protectedCommerceAfterFingerprint).toBe(
    result.lineage.protectedCommerceBeforeFingerprint,
  );
  expect(result.lineage.protectedMediaAfterFingerprint).toBe(
    result.lineage.protectedMediaBeforeFingerprint,
  );
  const proposalFingerprint = result.lineage.candidateSnapshotFingerprint;
  await page.goto(
    `${draftSearchPath}?q=925&locale=en&p10b-16p-04-proposal=${encodeURIComponent(proposalFingerprint)}`,
    { waitUntil: "domcontentloaded", timeout: 120_000 },
  );
  await expectResults({
    page,
    query: "925",
    locale: "en",
    count: 2,
    productIds: ["product_aava_necklace_925", "product_meri_bracelet_925"],
  });
  for (const form of await page.locator('form[role="search"]:visible').all()) {
    await expect(form.locator('input[name="p10b-16p-04-proposal"]')).toHaveValue(
      proposalFingerprint,
    );
  }
  evidence.push(
    await captureP10B16P06SearchEvidence({
      page,
      renderer: "proposal",
      scenario: "proposal-results",
      width: 1440,
      locale: "en",
      query: "925",
    }),
  );
  expect(await storedDraftBytes(page)).toBe(storedBefore);
  assertOffline(requests, 1);

  const context = page.context();
  await page.close();
  for (const width of widths) {
    for (const renderer of ["draft", "published"] as const) {
      const evidencePage = await controlledPage(context);
      try {
        await evidencePage.controlled.setViewportSize({
          width,
          height: width === 375 ? 900 : 1000,
        });
        await evidencePage.controlled.goto(
          `${renderer === "draft" ? draftSearchPath : publishedSearchPath}?q=925&locale=en`,
          { waitUntil: "domcontentloaded", timeout: 120_000 },
        );
        if (renderer === "published") {
          await expect(evidencePage.controlled.getByText("Published storefront")).toBeVisible();
        }
        await expectResults({
          page: evidencePage.controlled,
          query: "925",
          locale: "en",
          count: 2,
          productIds: ["product_aava_necklace_925", "product_meri_bracelet_925"],
        });
        evidence.push(
          await captureP10B16P06SearchEvidence({
            page: evidencePage.controlled,
            renderer,
            scenario: "shared-frame-multiple-results",
            width,
            locale: "en",
            query: "925",
          }),
        );
        assertOffline(evidencePage.requests);
      } finally {
        await evidencePage.controlled.close();
      }
    }
  }

  const transientQuery = "p10b16p06-query-never-persisted";
  const firstLoad = await controlledPage(context);
  await firstLoad.controlled.goto(`${draftSearchPath}?q=${transientQuery}&locale=en`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(
    firstLoad.controlled.getByRole("heading", { name: "No results found" }),
  ).toBeVisible();
  const beforeReload = await storedDraftBytes(firstLoad.controlled);
  assertOffline(firstLoad.requests);
  await firstLoad.controlled.close();

  const reloaded = await controlledPage(context);
  await reloaded.controlled.goto(`${draftSearchPath}?q=${transientQuery}&locale=en`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(
    reloaded.controlled.getByRole("heading", { name: "No results found" }),
  ).toBeVisible();
  expect(await storedDraftBytes(reloaded.controlled)).toBe(beforeReload);
  await reloaded.controlled.goto(`${draftSearchPath}?q=925&locale=en`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expectResults({
    page: reloaded.controlled,
    query: "925",
    locale: "en",
    count: 2,
    productIds: ["product_aava_necklace_925", "product_meri_bracelet_925"],
  });
  evidence.push(
    await captureP10B16P06SearchEvidence({
      page: reloaded.controlled,
      renderer: "saved-preview",
      scenario: "saved-preview-results",
      width: 1440,
      locale: "en",
      query: "925",
    }),
  );
  expect(await storedDraftBytes(reloaded.controlled)).toBe(beforeReload);
  assertOffline(reloaded.requests);
  await reloaded.controlled.close();
  expect(beforeReload).toBe(storedBefore);
  expect(beforeReload).not.toContain(transientQuery);

  const manifest = await writeP10B16P06SearchEvidenceManifest(evidence, testInfo);
  expect(manifest).toContain("/private/tmp/");
  assertOffline(requests, 1);
});
