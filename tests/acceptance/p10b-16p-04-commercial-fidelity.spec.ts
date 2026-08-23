import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { openEditorAssistant } from "../e2e/editor-assistant";
import {
  assertSelectedPremiumAuthority,
  type SafeSelection,
} from "./p10b-16p-04-commercial-fidelity-assertions";

const commercialAcceptance = Object.freeze({
  projectId: "project_p10b16p04_aurum_commercial_acceptance",
  locale: "en" as const,
  collectionSlug: "everyday-icons",
  simpleProductSlug: "sisu-automatic-watch",
  configurableProductSlug: "aurora-ring-585",
});

const projectId = commercialAcceptance.projectId;
const editorUrl = `/projects/${projectId}/editor`;
const generationPath = "/api/ai/whole-storefront-proposals";
const inspectionPath = "/api/demo/p10b-16p-04";
const acceptanceTokenHeader = "x-veskify-p10b-16p-04-acceptance-token";
const merchantPrompt =
  "Create a refined premium jewellery storefront with strong editorial storytelling, elegant product discovery, sophisticated configurable-product pages, generous visual breathing room and restrained luxury hierarchy.";
const liveAcceptance = process.env.VESKIFY_P10B_16P_04_LIVE_ACCEPTANCE === "1";
const expectedTransportKind = liveAcceptance ? "openai" : "mock";

function requiredAcceptanceToken(): string {
  const token = process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN;
  if (!token || Buffer.byteLength(token) < 32) {
    throw new Error("The P10B-16P-04 Studio acceptance authority is unavailable.");
  }
  return token;
}

const acceptanceToken = requiredAcceptanceToken();

type GenerationSuccess = Readonly<{
  ok: true;
  proposal: Readonly<{
    metadata: Readonly<{ wholeStorefrontProposalFingerprint: string }>;
    proposal: Readonly<{ id: string }>;
  }>;
  lineage: Readonly<{
    candidateSnapshotFingerprint: string;
    materializationCount: 1;
    protectedCommerceBeforeFingerprint: string;
    protectedCommerceAfterFingerprint: string;
    protectedMediaBeforeFingerprint: string;
    protectedMediaAfterFingerprint: string;
    providerCallCount: 1;
    retryCount: 0;
  }>;
}>;

type StoredAuthority = Readonly<{
  draft: StorefrontSnapshot;
  catalogue: unknown;
  history: readonly unknown[];
  project: Readonly<Record<string, unknown>>;
}>;

type AcceptanceInspection = Readonly<{
  projectId: string;
  provider: Readonly<{
    providerId: string;
    modelId: string | null;
    category: string;
    credentialsAvailable: boolean;
    timeoutMs: number | null;
    boundedTimeout: boolean;
    retryCount: 0;
  }>;
  selectedTransport: Readonly<{ kind: "mock" | "openai" }>;
  providerCallCount: number;
  retryCount: 0;
  status: string;
  failureClassification: string | null;
  failedAttempt: unknown;
  activeAttempt: unknown;
  cases: readonly Readonly<{
    candidateSnapshotFingerprint: string;
    protectedCommerceBeforeFingerprint: string;
    protectedCommerceAfterFingerprint: string;
    protectedMediaBeforeFingerprint: string;
    protectedMediaAfterFingerprint: string;
    materializationCount: 1;
    selection: SafeSelection;
  }>[];
}>;

type AcceptanceInspectionResponse = Readonly<{ ok: true; acceptance: AcceptanceInspection }>;

function editorCanvasRegion(page: Page): Locator {
  return page.getByLabel(/Visual editor canvas|Visuaalinen muokkausalue/);
}

function proposalRegion(page: Page): Locator {
  return page.getByLabel(/Storefront design proposal|Verkkokaupan suunnitteluehdotus/);
}

function acceptanceEditor(page: Page): Locator {
  return page.locator("[data-p10b16p04-active-draft-fingerprint]");
}

function localeLabel(locale: "en" | "fi"): RegExp {
  return locale === "fi" ? /^Suomi$/ : /^English$/;
}

async function installSameOriginAcceptanceAuthority(page: Page): Promise<void> {
  const configuredBaseUrl = test.info().project.use.baseURL;
  if (typeof configuredBaseUrl !== "string") {
    throw new Error("The P10B-16P-04 browser requires one exact base URL.");
  }
  const baseOrigin = new URL(configuredBaseUrl).origin;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const original = Object.fromEntries(
      Object.entries(request.headers()).filter(
        ([key]) => key.toLowerCase() !== acceptanceTokenHeader,
      ),
    );
    await route.continue({
      headers:
        new URL(request.url()).origin === baseOrigin
          ? { ...original, [acceptanceTokenHeader]: acceptanceToken }
          : original,
    });
  });
}

async function inspectAcceptance(page: Page): Promise<AcceptanceInspection> {
  const response = await page.request.get(inspectionPath, {
    headers: { [acceptanceTokenHeader]: acceptanceToken },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as AcceptanceInspectionResponse;
  expect(body.ok).toBe(true);
  return body.acceptance;
}

async function readStoredAuthority(page: Page): Promise<StoredAuthority> {
  const result: unknown = await page.evaluate(async (requestedProjectId) => {
    const value = <Value>(request: IDBRequest<Value>) =>
      new Promise<Value>((resolveValue, reject) => {
        request.onsuccess = () => resolveValue(request.result);
        request.onerror = () => reject(new Error("Could not inspect controlled Studio storage."));
      });
    const open = indexedDB.open("veskify");
    const database = await new Promise<IDBDatabase>((resolveDatabase, reject) => {
      open.onsuccess = () => resolveDatabase(open.result);
      open.onerror = () => reject(new Error("Could not open controlled Studio storage."));
    });
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots", "snapshotHistoryMetadata"],
      "readonly",
    );
    const project = (await value(transaction.objectStore("projects").get(requestedProjectId))) as
      { draftSnapshotId: string } | undefined;
    if (!project) throw new Error("The controlled Studio project is missing.");
    const draft = (await value(
      transaction.objectStore("snapshots").get(project.draftSnapshotId),
    )) as { catalogueRef: string } | undefined;
    if (!draft) throw new Error("The controlled Studio draft is missing.");
    const catalogue: unknown = await value(
      transaction.objectStore("catalogues").get(draft.catalogueRef) as IDBRequest<unknown>,
    );
    const history: unknown[] = await value(
      transaction
        .objectStore("snapshotHistoryMetadata")
        .index("by-project")
        .getAll(requestedProjectId) as IDBRequest<unknown[]>,
    );
    database.close();
    return { draft, catalogue, history, project };
  }, projectId);
  return result as StoredAuthority;
}

function storedFingerprints(authority: StoredAuthority) {
  return {
    draft: canonicalStorefrontContentFingerprint(authority.draft),
    catalogue: canonicalValueFingerprint(authority.catalogue),
  };
}

async function generateProposal(page: Page): Promise<GenerationSuccess> {
  const prompt = page.getByLabel(/Your request|Pyyntösi/);
  const generate = page.getByRole("button", {
    name: /Generate storefront|Luo verkkokauppa/,
  });
  await prompt.fill(merchantPrompt);
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === generationPath && response.request().method() === "POST",
    { timeout: 180_000 },
  );
  await generate.click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  return (await response.json()) as GenerationSuccess;
}

function assertProtectedAcceptanceState(
  inspection: AcceptanceInspection,
  generated: GenerationSuccess,
  caseIndex: number,
): void {
  expect(inspection).toMatchObject({
    projectId,
    selectedTransport: { kind: expectedTransportKind },
    retryCount: 0,
  });
  const retained = inspection.cases[caseIndex];
  expect(retained).toBeDefined();
  expect(retained).toMatchObject({
    candidateSnapshotFingerprint: generated.lineage.candidateSnapshotFingerprint,
    materializationCount: 1,
  });
  expect(generated.lineage).toMatchObject({
    materializationCount: 1,
    providerCallCount: 1,
    retryCount: 0,
  });
  expect(retained?.protectedCommerceAfterFingerprint).toBe(
    retained?.protectedCommerceBeforeFingerprint,
  );
  expect(retained?.protectedMediaAfterFingerprint).toBe(retained?.protectedMediaBeforeFingerprint);
  expect(generated.lineage.protectedCommerceAfterFingerprint).toBe(
    generated.lineage.protectedCommerceBeforeFingerprint,
  );
  expect(generated.lineage.protectedMediaAfterFingerprint).toBe(
    generated.lineage.protectedMediaBeforeFingerprint,
  );
}

test.describe.configure({ timeout: 420_000 });

test("runs the lean token-protected Studio proposal lifecycle without publication", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", "The controlled acceptance uses one Chromium worker.");
  await installSameOriginAcceptanceAuthority(page);

  const generationRequests: string[] = [];
  const publicationRequests: string[] = [];
  const externalProviderOrVeskoRequests: string[] = [];
  page.context().on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === generationPath) generationRequests.push(request.method());
    if (url.pathname === "/api/storefront-publish") publicationRequests.push(request.method());
    if (
      url.hostname === "api.openai.com" ||
      url.hostname.endsWith(".openai.com") ||
      url.hostname === "vesko.fi" ||
      url.hostname.endsWith(".vesko.fi")
    ) {
      externalProviderOrVeskoRequests.push(request.url());
    }
  });

  await page.goto(editorUrl);
  await expect(editorCanvasRegion(page)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("radio", { name: localeLabel(commercialAcceptance.locale) }).check();
  const rawDraftFingerprint = await acceptanceEditor(page).getAttribute(
    "data-p10b16p04-active-draft-fingerprint",
  );
  if (!rawDraftFingerprint) throw new Error("The raw P04 draft fingerprint is unavailable.");
  const rawStoredAuthority = await readStoredAuthority(page);
  const rawStoredFingerprints = storedFingerprints(rawStoredAuthority);
  expect(rawStoredFingerprints.draft).toBe(rawDraftFingerprint);

  const readiness = await inspectAcceptance(page);
  expect(readiness).toMatchObject({
    projectId,
    selectedTransport: { kind: expectedTransportKind },
    providerCallCount: 0,
    retryCount: 0,
    cases: [],
  });
  if (liveAcceptance) {
    expect(readiness.provider).toMatchObject({
      providerId: "openai-prompted-storefront-design-intent-v2",
      modelId: "gpt-5.6-sol",
      category: "eligible",
      credentialsAvailable: true,
      timeoutMs: 120_000,
      boundedTimeout: true,
      retryCount: 0,
    });
  }

  await openEditorAssistant(page);
  await page.getByRole("radio", { name: /Entire storefront|Koko verkkokauppa/ }).check();

  const rejected = await generateProposal(page);
  expect(rejected.ok).toBe(true);
  await expect(proposalRegion(page)).toBeVisible({ timeout: 30_000 });
  const rejectedInspection = await inspectAcceptance(page);
  expect(rejectedInspection.providerCallCount).toBe(1);
  expect(rejectedInspection.cases).toHaveLength(1);
  assertProtectedAcceptanceState(rejectedInspection, rejected, 0);
  assertSelectedPremiumAuthority(rejectedInspection.cases[0].selection);
  await page.getByRole("button", { name: /Reject|Hylkää/, exact: true }).click();
  await expect(proposalRegion(page)).toHaveCount(0);
  await expect(acceptanceEditor(page)).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    rawDraftFingerprint,
  );
  expect(await readStoredAuthority(page)).toEqual(rawStoredAuthority);

  const accepted = await generateProposal(page);
  expect(accepted.ok).toBe(true);
  await expect(proposalRegion(page)).toBeVisible({ timeout: 30_000 });
  const acceptedInspection = await inspectAcceptance(page);
  expect(acceptedInspection.providerCallCount).toBe(2);
  expect(acceptedInspection.cases).toHaveLength(2);
  assertProtectedAcceptanceState(acceptedInspection, accepted, 1);
  const selection = acceptedInspection.cases[1].selection;
  expect(selection.directionId).toBe("premiumEditorial");

  const proposalRoot = page
    .getByLabel(/Proposal preview canvas|Ehdotuksen esikatselualue/)
    .frameLocator("iframe")
    .locator('[data-veskify-canvas-root="true"]');
  await expect(proposalRoot).toBeVisible();
  await expect(proposalRoot.locator('[data-frame-region="header"]')).toHaveAttribute(
    "data-frame-profile",
    selection.sharedFrame.profileId,
  );
  await expect(proposalRoot.locator('[data-frame-region="footer"]')).toBeVisible();

  const acceptedFingerprint = accepted.lineage.candidateSnapshotFingerprint;
  await page.getByRole("button", { name: /Accept and apply|Hyväksy ja käytä/ }).click();
  await page
    .getByRole("button", { name: /Apply storefront proposal|Ota kauppaehdotus käyttöön/ })
    .click();
  await expect(acceptanceEditor(page)).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    acceptedFingerprint,
  );
  expect(await readStoredAuthority(page)).toEqual(rawStoredAuthority);

  const undo = page.getByRole("button", { name: /Undo|Kumoa/, exact: true });
  const redo = page.getByRole("button", { name: /Redo|Tee uudelleen/, exact: true });
  await undo.click();
  await expect(acceptanceEditor(page)).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    rawDraftFingerprint,
  );
  await redo.click();
  await expect(acceptanceEditor(page)).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    acceptedFingerprint,
  );

  await page.getByRole("button", { name: /Save draft|Tallenna luonnos/ }).click();
  await expect(page.getByText(/Draft saved successfully|Luonnos tallennettiin/)).toBeVisible();
  const savedStoredAuthority = await readStoredAuthority(page);
  const savedFingerprints = storedFingerprints(savedStoredAuthority);
  expect(savedFingerprints.draft).toBe(acceptedFingerprint);
  expect(savedFingerprints.catalogue).toBe(rawStoredFingerprints.catalogue);

  await page.reload();
  await expect(editorCanvasRegion(page)).toBeVisible({ timeout: 60_000 });
  await expect(acceptanceEditor(page)).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    acceptedFingerprint,
  );
  expect(await readStoredAuthority(page)).toEqual(savedStoredAuthority);
  await expect(page.getByRole("button", { name: /Save draft|Tallenna luonnos/ })).toBeDisabled();

  const preview = page.getByRole("link", { name: /Preview storefront|Esikatsele kauppaa/ }).first();
  await expect(preview).toHaveAttribute("href", `/projects/${projectId}`);
  await preview.click();
  await expect(page.locator(".project-preview__storefront")).toBeVisible({ timeout: 30_000 });

  for (const route of [
    `/projects/${projectId}/collections/${commercialAcceptance.collectionSlug}`,
    `/projects/${projectId}/products/${commercialAcceptance.simpleProductSlug}`,
    `/projects/${projectId}/products/${commercialAcceptance.configurableProductSlug}`,
    `/projects/${projectId}/pages/about`,
    `/projects/${projectId}/cart`,
  ]) {
    await page.goto(route);
    await expect(page.locator(".project-preview__storefront")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Draft preview|Luonnoksen esikatselu/)).toBeVisible();
  }

  await page.goto(editorUrl);
  await expect(editorCanvasRegion(page)).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole("link", { name: /Publish changes|Julkaise muutokset/ }),
  ).toBeVisible();
  const finalInspection = await inspectAcceptance(page);
  expect(finalInspection).toMatchObject({
    status: "ready",
    activeAttempt: null,
    failedAttempt: null,
    failureClassification: null,
    providerCallCount: 2,
    retryCount: 0,
  });
  expect(finalInspection.cases).toHaveLength(2);
  expect(generationRequests).toEqual(["POST", "POST"]);
  expect(publicationRequests).toEqual([]);
  expect(externalProviderOrVeskoRequests).toEqual([]);
});
