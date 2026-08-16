import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { openEditorAssistant } from "./editor-assistant";

const projectId = "project_p10b16l_karvonen_raw";
const editorUrl = `/projects/${projectId}/editor`;
const generationPath = "/api/ai/whole-storefront-proposals";
const widths = [375, 768, 1024, 1440] as const;

const promptA =
  "Create a refined premium jewellery storefront with strong editorial storytelling, elegant product discovery, sophisticated configurable-product pages and restrained commercial hierarchy.";
const promptB =
  "Create an information-rich modern technical jewellery storefront with catalogue-led discovery, precise configurable-product guidance and confident commercial hierarchy.";
const promptC =
  "Create a restrained minimal commerce jewellery storefront with focused product discovery, quiet typography and direct conversion-led hierarchy.";

type MockFailure =
  | "provider-refusal"
  | "malformed-output"
  | "unsupported-hard-constraint"
  | "insufficient-material-intent";

type CapturedGenerationRequest = Readonly<{
  operation: string;
  contractVersion: string;
  requestId: string;
  projectId: string;
  draftSnapshotId: string;
  draftRevision: number;
  activeLocale: string;
  targetScope: string;
  merchantPrompt: string;
}>;

type SafeLineage = Readonly<{
  providerId: string;
  modelId: string | null;
  requestFingerprint: string;
  promptFingerprint: string;
  providerIntentFingerprint: string;
  compiledDecisionFingerprint: string;
  synthesisFingerprint: string;
  structuralFingerprint: string;
  candidateSnapshotFingerprint: string;
  protectedCommerceBeforeFingerprint: string;
  protectedCommerceAfterFingerprint: string;
  protectedMediaBeforeFingerprint: string;
  protectedMediaAfterFingerprint: string;
  providerCallCount: 1;
  retryCount: 0;
  materializationCount: 1;
}>;

type GenerationSuccess = Readonly<{
  ok: true;
  lineage: SafeLineage;
}>;

type GenerationControl = {
  failure?: MockFailure | "stale" | "transport";
  requests: CapturedGenerationRequest[];
  externalProviderRequests: string[];
};

function capturedGenerationRequest(postData: string | null): CapturedGenerationRequest {
  const candidate: unknown = JSON.parse(postData ?? "null");
  if (!candidate || typeof candidate !== "object" || !("merchantPrompt" in candidate)) {
    throw new Error("The Studio sent an unreadable prompt-generation request.");
  }
  return candidate as CapturedGenerationRequest;
}

async function readStoredDraft(page: Page): Promise<string> {
  return page.evaluate(async (requestedProjectId) => {
    const requestValue = <Value>(request: IDBRequest<Value>) =>
      new Promise<Value>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(new Error("Could not read the raw Studio fixture.", { cause: request.error }));
      });
    const open = indexedDB.open("veskify");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () =>
        reject(new Error("Could not open the Studio database.", { cause: open.error }));
    });
    const transaction = database.transaction(["projects", "snapshots"], "readonly");
    const project = (await requestValue(
      transaction.objectStore("projects").get(requestedProjectId),
    )) as { draftSnapshotId: string } | undefined;
    if (!project) throw new Error("The raw P10B-16P-03 project is missing.");
    const snapshot: unknown = await requestValue(
      transaction.objectStore("snapshots").get(project.draftSnapshotId) as IDBRequest<unknown>,
    );
    database.close();
    return JSON.stringify(snapshot);
  }, projectId);
}

async function installGenerationControl(page: Page): Promise<GenerationControl> {
  const control: GenerationControl = {
    requests: [],
    externalProviderRequests: [],
  };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "api.openai.com" || url.hostname.endsWith(".openai.com")) {
      control.externalProviderRequests.push(request.url());
    }
  });
  await page.route(`**${generationPath}`, async (route) => {
    const request = route.request();
    const body = capturedGenerationRequest(request.postData());
    control.requests.push(body);
    if (control.failure === "stale") {
      await route.fulfill({
        body: JSON.stringify({ ok: false, failure: { category: "stale", retryable: false } }),
        contentType: "application/json",
        status: 409,
      });
      return;
    }
    if (control.failure === "transport") {
      await route.abort("failed");
      return;
    }
    const headers = {
      ...request.headers(),
      ...(control.failure ? { "x-veskify-p10b-16p-03-mock-failure": control.failure } : {}),
    };
    await route.continue({ headers });
  });
  return control;
}

async function useEntireStorefrontPrompt(page: Page) {
  const english = page.getByRole("radio", { name: "English" });
  await expect(english).toBeVisible({ timeout: 30_000 });
  await english.check();
  await openEditorAssistant(page);
  await page.getByRole("radio", { name: "Entire storefront" }).check();
  const prompt = page.getByLabel("Your request");
  const generate = page.getByRole("button", { name: "Generate storefront" });
  await expect(prompt).toBeEnabled();
  await expect(generate).toBeDisabled();
  return { generate, prompt };
}

async function generate(
  page: Page,
  control: GenerationControl,
  prompt: string,
): Promise<GenerationSuccess> {
  control.failure = undefined;
  const requestCount = control.requests.length;
  const field = page.getByLabel("Your request");
  const generateButton = page.getByRole("button", { name: "Generate storefront" });
  await field.fill(prompt);
  await expect(field).toHaveValue(prompt);
  await expect(generateButton).toBeEnabled();
  const responsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === generationPath,
    { timeout: 180_000 },
  );
  await generateButton.click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const result = (await response.json()) as GenerationSuccess;
  expect(result.ok).toBe(true);
  await expect(page.getByLabel("Storefront design proposal")).toBeVisible({ timeout: 30_000 });
  expect(control.requests).toHaveLength(requestCount + 1);
  const captured = control.requests.at(-1)!;
  expect(captured.merchantPrompt).toBe(prompt);
  expect(Object.keys(captured).sort()).toEqual(
    [
      "activeLocale",
      "contractVersion",
      "draftRevision",
      "draftSnapshotId",
      "merchantPrompt",
      "operation",
      "projectId",
      "requestId",
      "targetScope",
    ].sort(),
  );
  expect(captured).toMatchObject({
    activeLocale: "en",
    contractVersion: "2.0.0",
    operation: "promptedStorefrontDesignV2",
    projectId,
    targetScope: "storefront",
  });
  expect(result.lineage).toMatchObject({
    materializationCount: 1,
    modelId: "deterministic-p10b-16p-03-v1",
    providerId: "p10b-16p-03-mock-prompted-storefront-design-v2",
    providerCallCount: 1,
    retryCount: 0,
  });
  expect(result.lineage.protectedCommerceAfterFingerprint).toBe(
    result.lineage.protectedCommerceBeforeFingerprint,
  );
  expect(result.lineage.protectedMediaAfterFingerprint).toBe(
    result.lineage.protectedMediaBeforeFingerprint,
  );
  expect(JSON.stringify(result)).not.toContain(prompt);
  return result;
}

async function selectOption(select: Locator, value: string) {
  await expect(select.locator(`option[value="${value}"]`)).toBeAttached();
  await select.selectOption(value);
}

async function proposalComponentSequence(page: Page): Promise<string[]> {
  const canvas = page.getByLabel(/Proposal preview canvas/).frameLocator("iframe");
  await expect(canvas.locator("[data-veskify-canvas-root]")).toBeVisible();
  return canvas.locator("[data-component]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const element = node as HTMLElement;
      return [
        element.dataset.component,
        element.dataset.variant,
        element.dataset.pdpComposition,
        element.dataset.cardAnatomy,
      ]
        .filter(Boolean)
        .join(":");
    }),
  );
}

async function attachResponsiveProposalEvidence(page: Page, testInfo: TestInfo) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 375 ? 900 : 1000 });
    const proposals = page.getByLabel("Storefront design proposal");
    let visibleProposals = await Promise.all(
      Array.from({ length: await proposals.count() }, (_, index) =>
        proposals.nth(index).isVisible(),
      ),
    );
    if (!visibleProposals.some(Boolean)) {
      await openEditorAssistant(page);
      visibleProposals = await Promise.all(
        Array.from({ length: await proposals.count() }, (_, index) =>
          proposals.nth(index).isVisible(),
        ),
      );
    }
    expect(visibleProposals.some(Boolean)).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await testInfo.attach(`p10b16p03-studio-proposal-${width}px`, {
      body: await page.screenshot({ animations: "disabled", fullPage: true }),
      contentType: "image/png",
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const drawer = page.getByRole("dialog", { name: "Contextual tools" });
  if (await drawer.isVisible()) {
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
  }
}

async function rejectProposal(page: Page) {
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
  await expect(page.getByText(/page remains unchanged/i)).toBeVisible();
}

test.describe.configure({ timeout: 360_000 });

test("raw Studio generates, reviews, rejects, accepts, restores, saves and previews one canonical storefront", async ({
  page,
}, testInfo) => {
  const control = await installGenerationControl(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(editorUrl);
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("radio", { name: "English" }).check();
  const pageSelector = page.locator("#editor-page");
  const rawOutline = await pageSelector.locator("option").allTextContents();
  const rawDraft = await readStoredDraft(page);
  expect(rawOutline[0]).toBe("Homepage");
  expect(rawOutline).not.toContain("Myrskyluodon Maija");
  await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
  const { prompt, generate: generateButton } = await useEntireStorefrontPrompt(page);
  expect(control.requests).toEqual([]);
  expect(control.externalProviderRequests).toEqual([]);

  const first = await generate(page, control, promptA);
  const proposalOutline = await pageSelector.locator("option").allTextContents();
  expect(proposalOutline.length).toBeGreaterThan(rawOutline.length);
  expect(proposalOutline).not.toEqual(expect.arrayContaining(["Myrskyluodon Maija", "Feeniks"]));
  await expect(page.getByTestId("canonical-storefront-generation-review")).toContainText(
    /Complete storefront proposal/,
  );
  await expect(page.getByTestId("canonical-storefront-generation-review")).toContainText(
    /product imagery stay unchanged/i,
  );
  await expect(page.getByTestId("canonical-storefront-generation-review")).not.toContainText(
    /canonical|archetype|runtime|protected authority/i,
  );
  await expect(page.getByText(/Suggested changes preview/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Regenerate|Create another/i })).toHaveCount(0);
  await expect(prompt).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Entire storefront" })).toBeDisabled();
  expect(await readStoredDraft(page)).toBe(rawDraft);

  const homeSequenceA = await proposalComponentSequence(page);
  expect(homeSequenceA.length).toBeGreaterThanOrEqual(4);
  await attachResponsiveProposalEvidence(page, testInfo);

  await selectOption(pageSelector, "archetype_collection_search_dense");
  await page
    .locator("#dynamic-commerce-representative-route")
    .selectOption({ label: "Myrskyluodon Maija" });
  await expect(page.getByTestId("representative-route-path")).toHaveText(
    "/collections/myrskyluodon-maija",
  );
  const proposalCanvas = page.getByLabel(/Proposal preview canvas/).frameLocator("iframe");
  await expect(
    proposalCanvas.getByRole("heading", { name: "Myrskyluodon Maija", exact: true }).first(),
  ).toBeVisible();
  await expect(
    proposalCanvas.locator('[data-component="dynamicCollectionCommerce"]'),
  ).toBeVisible();
  const representativeSearchQuery = page.getByLabel("Representative search query");
  await expect(representativeSearchQuery).toBeVisible();
  await representativeSearchQuery.fill("ring");
  await expect(page.getByTestId("dynamic-commerce-representative-search-link")).toHaveAttribute(
    "href",
    `/projects/${projectId}/search?q=ring&locale=en`,
  );

  await selectOption(pageSelector, "archetype_pdp_standard");
  await page.locator("#dynamic-commerce-representative-route").selectOption({
    label: "Lumoava Yölento, korvakorut",
  });
  await expect(page.getByTestId("representative-route-path")).toHaveText(
    "/products/product-karvonen-02",
  );
  await expect(
    proposalCanvas.getByRole("heading", {
      name: "Lumoava Yölento, korvakorut",
      exact: true,
    }),
  ).toBeVisible();
  await expect(proposalCanvas.locator("[data-option-group-count]")).toHaveCount(0);

  await selectOption(pageSelector, "archetype_pdp_high_consideration");
  await page.locator("#dynamic-commerce-representative-route").selectOption({
    label: "Festive Feeniks Lux Oval timanttisormus",
  });
  await expect(page.getByTestId("representative-route-path")).toHaveText(
    "/products/product-karvonen-06",
  );
  await expect(
    proposalCanvas.getByRole("heading", {
      name: "Festive Feeniks Lux Oval timanttisormus",
      exact: true,
    }),
  ).toBeVisible();
  const proposalOptions = proposalCanvas.getByRole("region", {
    name: "Choose product options",
  });
  await expect(proposalOptions).toBeVisible();
  await expect(proposalOptions.getByRole("group")).toHaveCount(2);

  const aboutOption = pageSelector
    .locator("option")
    .filter({ hasText: /^Karvonen$/ })
    .first();
  const aboutId = await aboutOption.getAttribute("value");
  if (!aboutId) throw new Error("The generated About page is unavailable.");
  await pageSelector.selectOption(aboutId);
  await expect(proposalCanvas.getByRole("heading", { name: "Karvonen" }).first()).toBeVisible();
  const cartOption = pageSelector
    .locator("option")
    .filter({ hasText: /^Cart$/ })
    .first();
  const cartId = await cartOption.getAttribute("value");
  if (!cartId) throw new Error("The generated cart presentation is unavailable.");
  await pageSelector.selectOption(cartId);
  await expect(proposalCanvas.locator("[data-utility-state]")).toBeVisible();

  await rejectProposal(page);
  expect(await readStoredDraft(page)).toBe(rawDraft);
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
  expect(control.requests).toHaveLength(1);

  const second = await generate(page, control, promptB);
  const generatedHomeId = await pageSelector.locator("option").first().getAttribute("value");
  if (!generatedHomeId) throw new Error("The generated homepage is unavailable.");
  await pageSelector.selectOption(generatedHomeId);
  const homeSequenceB = await proposalComponentSequence(page);
  const structuralChanges = Array.from(
    { length: Math.max(homeSequenceA.length, homeSequenceB.length) },
    (_, index) => homeSequenceA[index] !== homeSequenceB[index],
  ).filter(Boolean).length;
  expect(structuralChanges).toBeGreaterThanOrEqual(4);
  for (const key of [
    "providerIntentFingerprint",
    "compiledDecisionFingerprint",
    "synthesisFingerprint",
    "structuralFingerprint",
    "candidateSnapshotFingerprint",
  ] as const) {
    expect(second.lineage[key]).not.toBe(first.lineage[key]);
  }
  await expect(prompt).toBeDisabled();
  await expect(generateButton).toBeDisabled();

  await page.getByRole("button", { name: "Accept and apply" }).click();
  await page.getByRole("button", { name: /Apply storefront proposal/ }).click();
  await expect(
    page.getByText(/entire-storefront proposal was applied as one unsaved draft change/i).first(),
  ).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
  expect(control.requests).toHaveLength(2);

  const acceptedOutline = await pageSelector.locator("option").allTextContents();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(pageSelector.locator("option")).toHaveText(rawOutline);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(pageSelector.locator("option")).toHaveText(acceptedOutline);
  expect(control.requests).toHaveLength(2);

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();
  const savedDraft = await readStoredDraft(page);
  expect(savedDraft).not.toBe(rawDraft);
  await page.reload();
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.locator("#editor-page option")).toHaveText(acceptedOutline);
  expect(await readStoredDraft(page)).toBe(savedDraft);
  await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();

  const normalPreview = page.getByRole("link", { name: "Preview storefront" }).first();
  await expect(normalPreview).toHaveAttribute("href", `/projects/${projectId}`);
  await page.waitForTimeout(300);
  await Promise.all([
    page.waitForURL(new RegExp(`/projects/${projectId}/?$`), { timeout: 30_000 }),
    normalPreview.click(),
  ]);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Karvonen", exact: true }).first()).toBeVisible();
  await page.goto(`/projects/${projectId}/pages/about`);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Karvonen", exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-component="homepageEditorial"]')).toBeVisible();

  for (const [url, heading] of [
    [`/projects/${projectId}/collections/myrskyluodon-maija`, "Myrskyluodon Maija"],
    [`/projects/${projectId}/collections/feeniks`, "Feeniks"],
    [`/projects/${projectId}/products/product-karvonen-01`, "Guldviva Myrskyluodon Maija sormus"],
    [
      `/projects/${projectId}/products/product-karvonen-06`,
      "Festive Feeniks Lux Oval timanttisormus",
    ],
  ] as const) {
    await page.goto(url);
    await expect(page.getByText("Draft preview")).toBeVisible();
    await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
  }
  const configurable = page.locator('[data-component="dynamicProductDetail"]');
  const configurableOptions = configurable.locator('[data-option-group-count="2"]');
  await expect(configurableOptions).toBeVisible();
  await expect(configurableOptions.getByRole("group")).toHaveCount(2);
  const configurableMedia = await configurable
    .locator("img")
    .evaluateAll((images) =>
      images.map((image) => ({ alt: image.getAttribute("alt"), src: image.getAttribute("src") })),
    );
  expect(configurableMedia.some(({ src }) => src?.includes("product-06/main.jpg"))).toBe(true);

  await page.goto(editorUrl);
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByRole("link", { name: "Preview storefront" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Publish changes" })).toBeVisible();
  expect(control.requests).toHaveLength(2);
  expect(control.externalProviderRequests).toEqual([]);
});

test("a third merchant intent reaches the minimal-commerce mock once without terminal reset", async ({
  page,
}) => {
  const control = await installGenerationControl(page);
  await page.goto(editorUrl);
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible({ timeout: 60_000 });
  await useEntireStorefrontPrompt(page);
  const result = await generate(page, control, promptC);
  expect(result.lineage.providerCallCount).toBe(1);
  expect(result.lineage.retryCount).toBe(0);
  expect(control.requests.map(({ merchantPrompt }) => merchantPrompt)).toEqual([promptC]);
  await rejectProposal(page);
  await expect(page.getByLabel("Your request")).toBeEnabled();
  expect(control.externalProviderRequests).toEqual([]);
});

test("mock failures preserve the exact raw draft and never retry or fall back", async ({
  page,
}) => {
  const control = await installGenerationControl(page);
  await page.goto(editorUrl);
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible({ timeout: 60_000 });
  const rawDraft = await readStoredDraft(page);
  const { prompt, generate: generateButton } = await useEntireStorefrontPrompt(page);
  const failures = [
    ["provider-refusal", "Provider refusal"],
    ["malformed-output", "Malformed intent"],
    ["unsupported-hard-constraint", "Unsupported hard constraint"],
    ["insufficient-material-intent", "Insufficient material intent"],
    ["stale", "Stale authority"],
    ["transport", "Transport failure"],
  ] as const;

  for (const [failure, label] of failures) {
    control.failure = failure;
    const exactPrompt = `${label}: keep the merchant's approved facts and create a complete storefront.`;
    const callCount = control.requests.length;
    await prompt.fill(exactPrompt);
    const responsePromise =
      failure === "transport"
        ? null
        : page.waitForResponse((response) => new URL(response.url()).pathname === generationPath, {
            timeout: 180_000,
          });
    await generateButton.click();
    if (responsePromise) await responsePromise;
    await expect(
      page.locator('[data-agent-state="failed"], [data-agent-state="stale"]'),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
    await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
    await expect(prompt).toHaveValue(exactPrompt);
    await expect(prompt).toBeEnabled();
    await expect(generateButton).toBeEnabled();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
    expect(await readStoredDraft(page)).toBe(rawDraft);
    expect(control.requests).toHaveLength(callCount + 1);
    await page.waitForTimeout(150);
    expect(control.requests).toHaveLength(callCount + 1);
  }
  expect(control.externalProviderRequests).toEqual([]);
});

test("duplicate submission and a pending context change cannot replace or apply a late proposal", async ({
  page,
}) => {
  const externalProviderRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "api.openai.com" || url.hostname.endsWith(".openai.com")) {
      externalProviderRequests.push(request.url());
    }
  });
  let releaseRequest: (() => void) | undefined;
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  const requests: CapturedGenerationRequest[] = [];
  await page.route(`**${generationPath}`, async (route) => {
    requests.push(capturedGenerationRequest(route.request().postData()));
    await requestReleased;
    await route.abort("aborted").catch(() => undefined);
  });

  await page.goto(editorUrl);
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible({ timeout: 60_000 });
  const rawDraft = await readStoredDraft(page);
  const { prompt, generate: generateButton } = await useEntireStorefrontPrompt(page);
  await prompt.fill(promptA);
  await generateButton.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect.poll(() => requests.length).toBe(1);
  await expect(
    page.locator('[data-prompted-generation-stage="requesting-design-intent"]'),
  ).toBeVisible();
  await expect(prompt).toBeDisabled();
  await expect(generateButton).toBeDisabled();

  await page.getByRole("radio", { name: "Suomi" }).check();
  await expect(page.locator('[data-prompted-generation-stage="stale"]')).toBeVisible();
  releaseRequest?.();
  await expect(page.getByLabel(/Pyyntösi|Your request/)).toBeEnabled();
  await expect(
    page.getByLabel(/Verkkokaupan suunnitteluehdotus|Storefront design proposal/),
  ).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(await readStoredDraft(page)).toBe(rawDraft);
  expect(externalProviderRequests).toEqual([]);
});
