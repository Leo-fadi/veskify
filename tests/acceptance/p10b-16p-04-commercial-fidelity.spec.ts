import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { openEditorAssistant } from "../e2e/editor-assistant";
import {
  assertCommercialSurface,
  assertSelectedMinimalCommerceAuthority,
  assertSelectedModernTechnicalAuthority,
  assertSelectedPremiumAuthority,
  type CommercialSurface,
  type SafeSelection,
} from "./p10b-16p-04-commercial-fidelity-assertions";
import {
  captureP10B16P04EvidenceRegion,
  capturePuckStorefrontDocument,
  captureStandaloneStorefrontDocument,
  writeP10B16P04VisualEvidenceManifest,
  type P10B16P04CommercialEvidenceWidth,
  type P10B16P04EvidenceIdentity,
  type P10B16P04RendererMode,
  type P10B16P04VisualEvidenceEntry,
} from "./p10b-16p-04-visual-evidence";

// Keep Playwright's Node-side module graph independent from the server-only fixture
// builder. These exact public test identities are asserted by the server-owned P04
// acceptance authority before it serves the production-disabled composition.
const commercialAcceptance = Object.freeze({
  projectId: "project_p10b16p04_aurum_commercial_acceptance",
  locale: "en" as const,
  collection: Object.freeze({
    collectionId: "collection_everyday",
    collectionSlug: "everyday-icons",
  }),
  secondaryCollection: Object.freeze({
    collectionId: "collection_rings",
    collectionSlug: "rings",
    title: "Rings",
  }),
  simpleProduct: Object.freeze({
    productId: "product_sisu_automatic_watch",
    productSlug: "sisu-automatic-watch",
  }),
  configurableProduct: Object.freeze({
    productId: "product_aurora_ring_585",
    productSlug: "aurora-ring-585",
  }),
});

const projectId = commercialAcceptance.projectId;
const editorUrl = `/projects/${projectId}/editor`;
const generationPath = "/api/ai/whole-storefront-proposals";
const inspectionPath = "/api/demo/p10b-16p-04";
const acceptanceTokenHeader = "x-veskify-p10b-16p-04-acceptance-token";
const evidenceDirectory = resolve(
  process.env.P10B16P04_ACCEPTANCE_EVIDENCE_DIR ??
    "/private/tmp/veskify-p10b-16p-04-mocked-commercial",
);
const promptA =
  "Create a refined premium jewellery storefront with strong editorial storytelling, elegant product discovery, sophisticated configurable-product pages, generous visual breathing room and restrained luxury hierarchy.";
const promptB =
  "Create a modern technical jewellery storefront that prioritises catalogue depth, comparison, filters, product information and clear configurable-product decision support with a compact, information-rich commercial hierarchy.";
const promptC =
  "Create a restrained minimal-commerce jewellery storefront focused on fast product discovery, conversion, concise proof, clean product pages, low visual noise and a balanced mobile-first hierarchy.";
const promptAOnly = process.env.P10B16P04_PROMPT_A_ONLY === "1";
const promptBOnly = process.env.P10B16P04_PROMPT_B_ONLY === "1";
const promptCOnly = process.env.P10B16P04_PROMPT_C_ONLY === "1";
if ([promptAOnly, promptBOnly, promptCOnly].filter(Boolean).length > 1) {
  throw new Error("The P10B-16P-04 browser may execute only one authorized prompt case.");
}
const acceptanceCase = promptCOnly ? "prompt-c" : promptBOnly ? "prompt-b" : "prompt-a";
const merchantPrompt =
  acceptanceCase === "prompt-c" ? promptC : acceptanceCase === "prompt-b" ? promptB : promptA;
const livePromptOnly = process.env.VESKIFY_P10B_16P_04_LIVE_ACCEPTANCE === "1";
const stopAfterProposal =
  (livePromptOnly && acceptanceCase !== "prompt-c") ||
  process.env.P10B16P04_STOP_AFTER_PROPOSAL === "1";
const expectedTransportKind = livePromptOnly ? "openai" : "mock";
const promptAStructuralFingerprint =
  "semantic-structure-v1_501_57087ca71a72bf77f44fb2e4cd6375e08ab328ba08059bac4e3ae48974485050";
const promptBStructuralFingerprint =
  "semantic-structure-v1_513_1448f2125e97be6cfa7f5d5d0a4d9fdc7511751f77932458491900f0ca7e3246";
if (
  promptCOnly &&
  (process.env.VESKIFY_P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT !==
    promptAStructuralFingerprint ||
    process.env.VESKIFY_P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT_2 !==
      promptBStructuralFingerprint)
) {
  throw new Error(
    "Prompt C must inherit the exact retained rejected Prompt A and Prompt B structural fingerprints.",
  );
}

function requiredAcceptanceToken(): string {
  const token = process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN;
  if (!token || Buffer.byteLength(token) < 32) {
    throw new Error("The mocked P10B-16P-04 commercial acceptance authority is unavailable.");
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
    history: canonicalValueFingerprint(authority.history),
    project: canonicalValueFingerprint(authority.project),
  };
}

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
    caseNumber: number;
    providerId: string;
    modelId: string | null;
    requestFingerprint: string;
    promptFingerprint: string;
    intentFingerprint: string;
    compiledDecisionFingerprint: string;
    synthesisFingerprint: string;
    structuralFingerprint: string;
    candidateSnapshotFingerprint: string;
    currentAuthorityFingerprints: readonly string[];
    materializationAuthorityFingerprint: string;
    protectedCommerceBeforeFingerprint: string;
    protectedCommerceAfterFingerprint: string;
    protectedMediaBeforeFingerprint: string;
    protectedMediaAfterFingerprint: string;
    materializationCount: 1;
    providerWireIntentFingerprint?: string;
    providerRequestFingerprint?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    durationMs?: number;
    capturedAt: string;
    selection: SafeSelection;
  }>[];
}>;

type AcceptanceInspectionResponse = Readonly<{ ok: true; acceptance: AcceptanceInspection }>;

const priorMaterialAuthority = Object.freeze({
  "prompt-a": Object.freeze({
    typography: "serif-led",
    frame: "editorial-masthead",
    homepage: "homepage-campaign-led",
    collectionArchetype: "archetype_collection_campaign",
    configurablePdpArchetype: "archetype_pdp_high_consideration",
    productCards: "compact,editorial,imageFirst",
    informationDensity: "airy",
    responsive: "balanced",
    artDirection: "immersive",
    candidateSnapshotFingerprint:
      "v1_41196_2070c4bb4439a9116b34855f336d8b379aa861b11bb4fc8e4ffaf33d9f1893f5",
  }),
  "prompt-b": Object.freeze({
    typography: "sans-led",
    frame: "commerce-utility",
    homepage: "homepage-collection-gateway",
    collectionArchetype: "archetype_collection_search_dense",
    configurablePdpArchetype: "archetype_pdp_standard",
    productCards: "compact,standard",
    informationDensity: "compact",
    responsive: "commerce-first",
    artDirection: "contained",
    candidateSnapshotFingerprint:
      "v1_39446_2dfaa31ba80f84636550357c7fe6755805198ea6c5fe775cec1d78aa71ccb5ea",
  }),
});

function materialAuthorityDimensions(selection: SafeSelection) {
  return {
    typography: selection.designDnaNonColour.typography.pairing,
    frame: selection.sharedFrame.profileId,
    homepage: selection.profiles.homepage,
    collectionArchetype: selection.dynamicCommerce.collectionArchetypeId,
    configurablePdpArchetype: selection.dynamicCommerce.configurableArchetypeId,
    productCards: [...selection.productCardAnatomyIds].sort().join(","),
    informationDensity: selection.postures.informationDensity,
    responsive: selection.postures.responsive,
    artDirection: selection.postures.artDirection,
  };
}

function comparePriorMaterialAuthority(selection: SafeSelection) {
  const current = materialAuthorityDimensions(selection);
  return Object.entries(priorMaterialAuthority).map(([priorCase, prior]) => {
    const changedDimensions = Object.keys(current).filter(
      (key) => current[key as keyof typeof current] !== prior[key as keyof typeof current],
    );
    return { priorCase, changedDimensions, changedDimensionCount: changedDimensions.length };
  });
}

function proposalCanvasRegion(page: Page): Locator {
  return page.getByLabel(/Proposal preview canvas|Ehdotuksen esikatselualue/);
}

function editorCanvasRegion(page: Page): Locator {
  return page.getByLabel(/Visual editor canvas|Visuaalinen muokkausalue/);
}

function proposalRegion(page: Page): Locator {
  return page.getByLabel(/Storefront design proposal|Verkkokaupan suunnitteluehdotus/);
}

function acceptanceEditor(page: Page): Locator {
  return page.locator("[data-p10b16p04-active-draft-fingerprint]");
}

function proposalDocumentRoot(page: Page): Locator {
  return proposalCanvasRegion(page)
    .frameLocator("iframe")
    .locator('[data-veskify-canvas-root="true"]');
}

function localeLabel(locale: "en" | "fi"): RegExp {
  return locale === "fi" ? /^Suomi$/ : /^English$/;
}

async function installSameOriginAcceptanceAuthority(page: Page): Promise<void> {
  const configuredBaseUrl = test.info().project.use.baseURL;
  if (typeof configuredBaseUrl !== "string") {
    throw new Error("The P10B-16P-04 commercial browser requires one exact base URL.");
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

function assertProtectedAcceptanceState(
  inspection: AcceptanceInspection,
  generated: GenerationSuccess,
): void {
  expect(inspection).toMatchObject({
    projectId,
    selectedTransport: { kind: expectedTransportKind },
    providerCallCount: 1,
    retryCount: 0,
  });
  expect(inspection.cases).toHaveLength(1);
  const retained = inspection.cases[0];
  expect(retained).toMatchObject({
    candidateSnapshotFingerprint: generated.lineage.candidateSnapshotFingerprint,
    materializationCount: 1,
  });
  expect(retained.protectedCommerceBeforeFingerprint).toBe(
    generated.lineage.protectedCommerceBeforeFingerprint,
  );
  expect(retained.protectedCommerceAfterFingerprint).toBe(
    generated.lineage.protectedCommerceAfterFingerprint,
  );
  expect(retained.protectedCommerceAfterFingerprint).toBe(
    retained.protectedCommerceBeforeFingerprint,
  );
  expect(retained.protectedMediaBeforeFingerprint).toBe(
    generated.lineage.protectedMediaBeforeFingerprint,
  );
  expect(retained.protectedMediaAfterFingerprint).toBe(
    generated.lineage.protectedMediaAfterFingerprint,
  );
  expect(retained.protectedMediaAfterFingerprint).toBe(retained.protectedMediaBeforeFingerprint);
}

async function optionValueContaining(select: Locator, expected: string): Promise<string> {
  const value = await select.locator("option").evaluateAll((options, text) => {
    const option = options.find(
      (candidate) =>
        candidate.getAttribute("data-route") === text || candidate.textContent?.includes(text),
    );
    return option instanceof HTMLOptionElement ? option.value : null;
  }, expected);
  if (!value) throw new Error(`No representative Studio option contains ${expected}.`);
  return value;
}

async function selectPageLabel(page: Page, label: RegExp): Promise<void> {
  const select = page.locator("#editor-page");
  const options = await select.locator("option").allTextContents();
  const index = options.findIndex((option) => label.test(option.trim()));
  if (index < 0) throw new Error(`The generated page ${label.source} is unavailable.`);
  await select.selectOption({ index }, { timeout: 30_000 });
}

async function selectArchetypeAndRoute(
  page: Page,
  archetypeId: string,
  route: string,
): Promise<void> {
  await page.locator("#editor-page").selectOption(archetypeId, { timeout: 30_000 });
  await expect(page.locator("#editor-page")).toHaveValue(archetypeId);
  const representative = page.locator("#dynamic-commerce-representative-route");
  const routeValue = await optionValueContaining(representative, route);
  await representative.selectOption(routeValue, { timeout: 30_000 });
  await expect(representative).toHaveValue(routeValue);
}

async function setUtilityContext(page: Page, kind: "empty" | "populated"): Promise<void> {
  await page.getByTestId(`p10b16p04-utility-${kind}`).click();
  const root = proposalDocumentRoot(page);
  if (kind === "empty") {
    await expect(root.getByText("Your cart is empty.")).toBeVisible();
  } else {
    await expect(root.locator("[data-summary-placement]")).toBeVisible();
  }
}

function surfaces(): readonly CommercialSurface[] {
  const collectionRoute = `/collections/${commercialAcceptance.collection.collectionSlug}`;
  const simpleRoute = `/products/${commercialAcceptance.simpleProduct.productSlug}`;
  const configurableRoute = `/products/${commercialAcceptance.configurableProduct.productSlug}`;
  return [
    {
      id: "home",
      kind: "home",
      route: "/",
      contextId: "home",
      profile: (selection) => selection.profiles.homepage,
      selectInStudio: async (page) => selectPageLabel(page, /^Homepage$/i),
    },
    {
      id: "collection",
      kind: "collection",
      route: collectionRoute,
      contextId: commercialAcceptance.collection.collectionId,
      profile: (selection) => selection.profiles.collection,
      archetype: (selection) => selection.dynamicCommerce.selectedArchetypes.collection,
      selectInStudio: async (page, selection) =>
        selectArchetypeAndRoute(
          page,
          selection.dynamicCommerce.collectionArchetypeId,
          collectionRoute,
        ),
    },
    {
      id: "simple-pdp",
      kind: "product",
      route: simpleRoute,
      contextId: commercialAcceptance.simpleProduct.productId,
      profile: (selection) => selection.profiles.productDetail,
      archetype: (selection) => selection.dynamicCommerce.selectedArchetypes.standardSimple,
      selectInStudio: async (page, selection) =>
        selectArchetypeAndRoute(
          page,
          selection.dynamicCommerce.standardSimpleArchetypeId,
          simpleRoute,
        ),
    },
    {
      id: "configurable-pdp",
      kind: "product",
      route: configurableRoute,
      contextId: commercialAcceptance.configurableProduct.productId,
      profile: (selection) => selection.profiles.productDetail,
      archetype: (selection) => selection.dynamicCommerce.selectedArchetypes.configurable,
      selectInStudio: async (page, selection) =>
        selectArchetypeAndRoute(
          page,
          selection.dynamicCommerce.configurableArchetypeId,
          configurableRoute,
        ),
    },
    {
      id: "about",
      kind: "content",
      route: "/pages/about",
      contextId: "about",
      profile: (selection) =>
        selection.staticContentSupportSelections.find((value) => value.includes("about")) ??
        "about",
      selectInStudio: async (page) => selectPageLabel(page, /^About(?: Aurum Nordic)?$/i),
    },
    {
      id: "cart-empty",
      kind: "utility",
      route: "/cart",
      contextId: "empty-cart",
      profile: (selection) =>
        selection.utilityPresentationSelections.find((value) => value.includes("cart")) ?? "cart",
      selectInStudio: async (page) => {
        await selectPageLabel(page, /^Cart$/i);
        await setUtilityContext(page, "empty");
      },
    },
    {
      id: "cart-populated",
      kind: "utility",
      route: "/cart",
      contextId: "populated-cart",
      profile: (selection) =>
        selection.utilityPresentationSelections.find((value) => value.includes("cart")) ?? "cart",
      selectInStudio: async (page) => {
        await selectPageLabel(page, /^Cart$/i);
        await setUtilityContext(page, "populated");
      },
    },
  ];
}

function targetedSurfacesForWidth(
  width: P10B16P04CommercialEvidenceWidth,
): readonly CommercialSurface[] {
  const all = surfaces();
  const byId = (id: CommercialSurface["id"]) => {
    const surface = all.find((candidate) => candidate.id === id);
    if (!surface) throw new Error(`The commercial evidence surface ${id} is unavailable.`);
    return surface;
  };
  const ids: readonly CommercialSurface["id"][] =
    width === 375
      ? ["home", "collection", "simple-pdp", "configurable-pdp", "about", "cart-populated"]
      : width === 768
        ? ["home", "collection", "configurable-pdp"]
        : width === 1024
          ? ["home", "collection", "simple-pdp", "configurable-pdp"]
          : [
              "home",
              "collection",
              "simple-pdp",
              "configurable-pdp",
              "about",
              "cart-populated",
              "cart-empty",
            ];
  return ids.map(byId);
}

function identity(input: {
  surface: CommercialSurface;
  width: P10B16P04CommercialEvidenceWidth;
  mode: P10B16P04RendererMode;
  selection: SafeSelection;
  snapshotFingerprint: string;
  proposalFingerprint: string;
}): P10B16P04EvidenceIdentity {
  const { surface, width, mode, selection } = input;
  return {
    logicalCaptureId: `${mode}-${surface.id}-${width}`,
    width,
    surface: surface.id,
    locale: commercialAcceptance.locale,
    representativeContext: {
      kind: surface.kind,
      id: surface.contextId,
      route: surface.route,
    },
    snapshotFingerprint: input.snapshotFingerprint,
    proposalFingerprint: input.proposalFingerprint,
    rendererMode: mode,
    selectedFrame: selection.sharedFrame.profileId,
    selectedProfileOrArchetype:
      surface.archetype?.(selection).archetypeId ?? surface.profile(selection),
  };
}

function previewUrl(surface: CommercialSurface, proposalFingerprint?: string): string {
  const query = new URLSearchParams();
  if (proposalFingerprint) query.set("p10b-16p-04-proposal", proposalFingerprint);
  if (surface.id === "cart-empty") query.set("p10b-16p-04-utility", "empty");
  if (surface.id === "cart-populated") query.set("p10b-16p-04-utility", "populated");
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return `/projects/${projectId}${surface.route === "/" ? "" : surface.route}${suffix}`;
}

async function capturePreviewSurface(input: {
  page: Page;
  surface: CommercialSurface;
  width: P10B16P04CommercialEvidenceWidth;
  mode: "isolated-proposal" | "saved-preview";
  selection: SafeSelection;
  snapshotFingerprint: string;
  proposalFingerprint: string;
}): Promise<readonly P10B16P04VisualEvidenceEntry[]> {
  await input.page.setViewportSize({ width: input.width, height: 900 });
  await input.page.goto(
    previewUrl(
      input.surface,
      input.mode === "isolated-proposal" ? input.snapshotFingerprint : undefined,
    ),
    { waitUntil: "domcontentloaded", timeout: 120_000 },
  );
  const root = input.page.locator(".project-preview__storefront");
  await expect(root).toHaveCount(1);
  await expect(root).toHaveAttribute("aria-label", /storefront/i);
  await expect(root).toBeVisible({ timeout: 30_000 });
  return captureStandaloneStorefrontDocument({
    page: input.page,
    root,
    evidenceDirectory,
    identity: identity(input),
    assertDocument: (root) =>
      assertCommercialSurface({
        root,
        surface: input.surface,
        selection: input.selection,
        width: input.width,
      }),
  });
}

async function captureDirectSearchFailure(input: {
  page: Page;
  width: 375 | 1440;
  selection: SafeSelection;
  snapshotFingerprint: string;
  proposalFingerprint: string;
}): Promise<readonly P10B16P04VisualEvidenceEntry[]> {
  await input.page.setViewportSize({ width: input.width, height: 900 });
  const query = new URLSearchParams({
    "p10b-16p-04-proposal": input.snapshotFingerprint,
  });
  await input.page.goto(`/projects/${projectId}/search?${query.toString()}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(
    input.page.getByRole("heading", { name: /Storefront could not be displayed/i }),
  ).toBeVisible();
  const customerCopy = await input.page.locator("main").innerText();
  expect(customerCopy).not.toMatch(/\bVesko\b/iu);
  expect(customerCopy).toMatch(/Return to store|Continue shopping/i);
  return captureP10B16P04EvidenceRegion({
    page: input.page,
    region: input.page.locator("main"),
    evidenceDirectory,
    identity: {
      logicalCaptureId: `search-runtime-fail-closed-${input.width}`,
      width: input.width,
      surface: "search-runtime-fail-closed",
      locale: commercialAcceptance.locale,
      representativeContext: { kind: "search", id: "search", route: "/search" },
      snapshotFingerprint: input.snapshotFingerprint,
      proposalFingerprint: input.proposalFingerprint,
      rendererMode: "search-runtime-fail-closed",
      selectedFrame: input.selection.sharedFrame.profileId,
      selectedProfileOrArchetype: input.selection.dynamicCommerce.searchArchetypeId,
    },
  });
}

function assertEquivalentRenderers(entries: readonly P10B16P04VisualEvidenceEntry[]): void {
  const comparable = entries.filter(
    (entry) =>
      entry.width === 1440 &&
      entry.surface === "home" &&
      ["studio-proposal", "isolated-proposal", "saved-preview"].includes(entry.rendererMode),
  );
  expect(new Set(comparable.map(({ rendererMode }) => rendererMode))).toEqual(
    new Set(["studio-proposal", "isolated-proposal", "saved-preview"]),
  );
  expect(new Set(comparable.map(({ rendererFingerprint }) => rendererFingerprint)).size).toBe(1);
}

test.describe.configure({ timeout: 900_000 });

test("Aurum proposal retains complete commercial visual evidence", async ({
  browserName,
  page,
}, testInfo: TestInfo) => {
  test.skip(browserName !== "chromium", "The controlled visual evidence uses one Chromium worker.");
  await mkdir(evidenceDirectory, { recursive: true });
  await installSameOriginAcceptanceAuthority(page);
  const providerOrVeskoRequests: string[] = [];
  const generationRequests: string[] = [];
  const publicationRequests: string[] = [];
  let latestInspection: AcceptanceInspection | null = null;
  page.context().on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === generationPath) generationRequests.push(request.method());
    if (url.pathname === "/api/storefront-publish") {
      publicationRequests.push(request.method());
    }
    if (
      url.hostname === "api.openai.com" ||
      url.hostname.endsWith(".openai.com") ||
      url.hostname === "vesko.fi" ||
      url.hostname.endsWith(".vesko.fi")
    ) {
      providerOrVeskoRequests.push(request.url());
    }
  });

  try {
    await page.goto(editorUrl);
    await expect(editorCanvasRegion(page)).toBeVisible({ timeout: 60_000 });
    const rawDraftFingerprint = await acceptanceEditor(page).getAttribute(
      "data-p10b16p04-active-draft-fingerprint",
    );
    if (!rawDraftFingerprint) throw new Error("The raw P04 draft fingerprint is unavailable.");
    expect(rawDraftFingerprint).toMatch(/^v1_\d+_[0-9a-f]{64}$/u);
    const rawStoredAuthority = await readStoredAuthority(page);
    const rawStoredFingerprints = storedFingerprints(rawStoredAuthority);
    expect(rawStoredFingerprints.draft).toBe(rawDraftFingerprint);
    await page.getByRole("radio", { name: localeLabel(commercialAcceptance.locale) }).check();
    await expect(proposalRegion(page)).toHaveCount(0);
    const readiness = await inspectAcceptance(page);
    latestInspection = readiness;
    expect(readiness).toMatchObject({
      projectId,
      selectedTransport: { kind: expectedTransportKind },
      providerCallCount: 0,
      retryCount: 0,
      cases: [],
    });
    if (livePromptOnly) {
      expect(readiness).toMatchObject({
        provider: {
          providerId: "openai-prompted-storefront-design-intent-v2",
          modelId: "gpt-5.6-sol",
          category: "eligible",
          credentialsAvailable: true,
          timeoutMs: 120_000,
          boundedTimeout: true,
          retryCount: 0,
        },
      });
    }
    expect(providerOrVeskoRequests).toEqual([]);
    await openEditorAssistant(page);
    await page.getByRole("radio", { name: /Entire storefront|Koko verkkokauppa/ }).check();
    const prompt = page.getByLabel(/Your request|Pyyntösi/);
    const generate = page.getByRole("button", { name: /Generate storefront|Luo verkkokauppa/ });
    await prompt.fill(merchantPrompt);
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === generationPath &&
        response.request().method() === "POST",
      { timeout: 180_000 },
    );
    await generate.click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const generated = (await response.json()) as GenerationSuccess;
    expect(generated.ok).toBe(true);
    expect(generated.lineage).toMatchObject({
      materializationCount: 1,
      providerCallCount: 1,
      retryCount: 0,
    });
    expect(generated.lineage.protectedCommerceAfterFingerprint).toBe(
      generated.lineage.protectedCommerceBeforeFingerprint,
    );
    expect(generated.lineage.protectedMediaAfterFingerprint).toBe(
      generated.lineage.protectedMediaBeforeFingerprint,
    );
    await expect(proposalRegion(page)).toBeVisible({ timeout: 30_000 });

    const inspection = await inspectAcceptance(page);
    latestInspection = inspection;
    expect(inspection).toMatchObject({
      projectId,
      selectedTransport: { kind: expectedTransportKind },
      providerCallCount: 1,
      retryCount: 0,
    });
    expect(inspection.cases).toHaveLength(1);
    const retained = inspection.cases[0];
    assertProtectedAcceptanceState(inspection, generated);
    expect(retained).toMatchObject({
      candidateSnapshotFingerprint: generated.lineage.candidateSnapshotFingerprint,
      materializationCount: 1,
    });
    expect(retained.protectedCommerceAfterFingerprint).toBe(
      retained.protectedCommerceBeforeFingerprint,
    );
    expect(retained.protectedMediaAfterFingerprint).toBe(retained.protectedMediaBeforeFingerprint);
    expect(retained.selection.dynamicCommerce.searchExecution).toBe(
      "registered-presentation-fail-closed-runtime",
    );
    if (acceptanceCase === "prompt-a") {
      assertSelectedPremiumAuthority(retained.selection);
    } else if (acceptanceCase === "prompt-b") {
      assertSelectedModernTechnicalAuthority(retained.selection);
    } else {
      assertSelectedMinimalCommerceAuthority(retained.selection);
    }
    const materialComparisons =
      acceptanceCase === "prompt-c" ? comparePriorMaterialAuthority(retained.selection) : [];
    if (acceptanceCase === "prompt-c") {
      expect(retained.structuralFingerprint).not.toBe(promptAStructuralFingerprint);
      expect(retained.structuralFingerprint).not.toBe(promptBStructuralFingerprint);
      expect(retained.candidateSnapshotFingerprint).not.toBe(
        priorMaterialAuthority["prompt-a"].candidateSnapshotFingerprint,
      );
      expect(retained.candidateSnapshotFingerprint).not.toBe(
        priorMaterialAuthority["prompt-b"].candidateSnapshotFingerprint,
      );
      for (const comparison of materialComparisons) {
        expect(
          comparison.changedDimensionCount,
          `${comparison.priorCase}/prompt-c`,
        ).toBeGreaterThanOrEqual(4);
      }
    }

    const snapshotFingerprint = generated.lineage.candidateSnapshotFingerprint;
    const proposalFingerprint = generated.proposal.metadata.wholeStorefrontProposalFingerprint;
    const selection = retained.selection;
    const evidence: P10B16P04VisualEvidenceEntry[] = [];

    for (const width of [375, 768, 1024, 1440] as const) {
      for (const surface of targetedSurfacesForWidth(width)) {
        await surface.selectInStudio(page, selection);
        evidence.push(
          ...(await capturePuckStorefrontDocument({
            page,
            canvasRegion: proposalCanvasRegion(page),
            evidenceDirectory,
            identity: identity({
              surface,
              width,
              mode: "studio-proposal",
              selection,
              snapshotFingerprint,
              proposalFingerprint,
            }),
            assertDocument: (root) => assertCommercialSurface({ root, surface, selection, width }),
          })),
        );
      }
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    evidence.push(
      ...(await captureP10B16P04EvidenceRegion({
        page,
        region: acceptanceEditor(page),
        evidenceDirectory,
        identity: {
          logicalCaptureId: "studio-proposal-overview-1440",
          width: 1440,
          surface: "studio-proposal-overview",
          locale: commercialAcceptance.locale,
          representativeContext: { kind: "home", id: "home", route: "/" },
          snapshotFingerprint,
          proposalFingerprint,
          rendererMode: "studio-proposal",
          selectedFrame: selection.sharedFrame.profileId,
          selectedProfileOrArchetype: selection.profiles.homepage,
        },
      })),
    );

    if (stopAfterProposal) {
      await page.getByRole("button", { name: /Reject|Hylkää/, exact: true }).click();
      await expect(proposalRegion(page)).toHaveCount(0);
      await expect(acceptanceEditor(page)).toHaveAttribute(
        "data-p10b16p04-active-draft-fingerprint",
        rawDraftFingerprint,
      );
      const finalInspection = await inspectAcceptance(page);
      assertProtectedAcceptanceState(finalInspection, generated);
      expect(finalInspection.providerCallCount).toBe(1);
      expect(finalInspection.retryCount).toBe(0);
      expect(generationRequests).toEqual(["POST"]);
      expect(publicationRequests).toEqual([]);
      expect(providerOrVeskoRequests).toEqual([]);
      const manifestPath = await writeP10B16P04VisualEvidenceManifest(evidenceDirectory, evidence);
      const safePromptEvidence = {
        terminalStatus: `${acceptanceCase}-complete-awaiting-product-owner-review`,
        acceptanceCase,
        cumulativeProviderCallNumber: livePromptOnly
          ? acceptanceCase === "prompt-b"
            ? 15
            : 14
          : null,
        projectId,
        studioUrl: editorUrl,
        retainedEvidenceDirectory: evidenceDirectory,
        provider: finalInspection.provider,
        selectedTransport: finalInspection.selectedTransport,
        providerCallCount: finalInspection.providerCallCount,
        retryCount: finalInspection.retryCount,
        caseEvidence: finalInspection.cases[0],
        lifecycle: {
          proposalInspected: true,
          proposalRejected: true,
          rawDraftRestored: true,
          publishInvocations: 0,
        },
        protectedAuthority: {
          commerce: "unchanged",
          canonicalProductMedia: "unchanged",
        },
        visualEvidenceManifest: manifestPath,
      } as const;
      const safeEvidencePath = resolve(evidenceDirectory, `safe-${acceptanceCase}-evidence.json`);
      await writeFile(safeEvidencePath, `${JSON.stringify(safePromptEvidence, null, 2)}\n`, "utf8");
      await testInfo.attach(`p10b-16p-04-safe-${acceptanceCase}-evidence`, {
        path: safeEvidencePath,
        contentType: "application/json",
      });
      return;
    }

    await page.getByRole("button", { name: /Accept and apply|Hyväksy ja käytä/ }).click();
    await page
      .getByRole("button", { name: /Apply storefront proposal|Ota kauppaehdotus käyttöön/ })
      .click();
    await expect(acceptanceEditor(page)).toHaveAttribute(
      "data-p10b16p04-active-draft-fingerprint",
      snapshotFingerprint,
    );
    assertProtectedAcceptanceState(await inspectAcceptance(page), generated);
    await expect(page.getByTestId("draft-status")).toContainText(
      /Unsaved changes|Tallentamattomia muutoksia/,
    );
    expect(await readStoredAuthority(page)).toEqual(rawStoredAuthority);
    const undo = page.getByRole("button", { name: /Undo|Kumoa/, exact: true });
    const redo = page.getByRole("button", { name: /Redo|Tee uudelleen/, exact: true });
    await undo.click();
    await expect(acceptanceEditor(page)).toHaveAttribute(
      "data-p10b16p04-active-draft-fingerprint",
      rawDraftFingerprint,
    );
    assertProtectedAcceptanceState(await inspectAcceptance(page), generated);
    expect(await readStoredAuthority(page)).toEqual(rawStoredAuthority);
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(acceptanceEditor(page)).toHaveAttribute(
      "data-p10b16p04-active-draft-fingerprint",
      snapshotFingerprint,
    );
    assertProtectedAcceptanceState(await inspectAcceptance(page), generated);
    expect(await readStoredAuthority(page)).toEqual(rawStoredAuthority);
    await page.getByRole("button", { name: /Save draft|Tallenna luonnos/ }).click();
    await expect(page.getByText(/Draft saved successfully|Luonnos tallennettiin/)).toBeVisible();
    assertProtectedAcceptanceState(await inspectAcceptance(page), generated);
    const savedStoredAuthority = await readStoredAuthority(page);
    const savedStoredFingerprints = storedFingerprints(savedStoredAuthority);
    expect(savedStoredFingerprints.draft).toBe(snapshotFingerprint);
    expect(savedStoredFingerprints.catalogue).toBe(rawStoredFingerprints.catalogue);
    expect(savedStoredAuthority.history).toEqual(rawStoredAuthority.history);
    const savedDynamicCommerce = savedStoredAuthority.draft.dynamicCommercePresentation;
    if (!savedDynamicCommerce) {
      throw new Error("The saved Prompt C storefront lacks dynamic-commerce authority.");
    }
    expect(savedDynamicCommerce.productTypeMappings).toEqual(
      selection.dynamicCommerce.productTypeMappings,
    );
    expect(savedDynamicCommerce.fallbacks.productDetailArchetypeId).toBe(
      selection.dynamicCommerce.genericFallbackArchetypeId,
    );
    await page.reload();
    await expect(editorCanvasRegion(page)).toBeVisible({ timeout: 60_000 });
    await expect(acceptanceEditor(page)).toHaveAttribute(
      "data-p10b16p04-active-draft-fingerprint",
      snapshotFingerprint,
    );
    await page.getByRole("radio", { name: localeLabel(commercialAcceptance.locale) }).check();
    assertProtectedAcceptanceState(await inspectAcceptance(page), generated);
    expect(await readStoredAuthority(page)).toEqual(savedStoredAuthority);
    await expect(proposalRegion(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save draft|Tallenna luonnos/ })).toBeDisabled();

    const isolatedPage = await page.context().newPage();
    await installSameOriginAcceptanceAuthority(isolatedPage);
    const home = targetedSurfacesForWidth(1440)[0];
    evidence.push(
      ...(await capturePreviewSurface({
        page: isolatedPage,
        surface: home,
        width: 1440,
        mode: "isolated-proposal",
        selection,
        snapshotFingerprint,
        proposalFingerprint,
      })),
    );
    evidence.push(
      ...(await captureDirectSearchFailure({
        page: isolatedPage,
        width: 1440,
        selection,
        snapshotFingerprint,
        proposalFingerprint,
      })),
    );
    await isolatedPage.close();

    await page.setViewportSize({ width: 1440, height: 1100 });
    const normalPreview = page
      .getByRole("link", { name: /Preview storefront|Esikatsele kauppaa/ })
      .first();
    await expect(normalPreview).toHaveAttribute("href", `/projects/${projectId}`);
    await Promise.all([
      page.waitForURL(new RegExp(`/projects/${projectId}/?$`), { timeout: 30_000 }),
      normalPreview.click(),
    ]);
    await expect(page.getByText(/Draft preview|Luonnoksen esikatselu/)).toBeVisible();
    const savedHomeRoot = page.locator(".project-preview__storefront");
    await expect(savedHomeRoot).toBeVisible({ timeout: 30_000 });
    evidence.push(
      ...(await captureStandaloneStorefrontDocument({
        page,
        root: savedHomeRoot,
        evidenceDirectory,
        identity: identity({
          surface: home,
          width: 1440,
          mode: "saved-preview",
          selection,
          snapshotFingerprint,
          proposalFingerprint,
        }),
        assertDocument: (root) =>
          assertCommercialSurface({ root, surface: home, selection, width: 1440 }),
      })),
    );

    const savedPreviewSurfaceIds = [
      "collection",
      "simple-pdp",
      "configurable-pdp",
      "about",
      "cart-empty",
    ] as const satisfies readonly CommercialSurface["id"][];
    for (const surfaceId of savedPreviewSurfaceIds) {
      const surface = surfaces().find((candidate) => candidate.id === surfaceId);
      if (!surface) throw new Error(`The saved preview surface ${surfaceId} is unavailable.`);
      evidence.push(
        ...(await capturePreviewSurface({
          page,
          surface,
          width: 1440,
          mode: "saved-preview",
          selection,
          snapshotFingerprint,
          proposalFingerprint,
        })),
      );
    }

    await page.goto(
      `/projects/${projectId}/collections/${commercialAcceptance.secondaryCollection.collectionSlug}`,
      { waitUntil: "domcontentloaded", timeout: 120_000 },
    );
    await expect(page.getByText(/Draft preview|Luonnoksen esikatselu/)).toBeVisible();
    const secondaryCollectionRoot = page.locator(".project-preview__storefront");
    await expect(
      secondaryCollectionRoot.getByRole("heading", {
        level: 1,
        name: commercialAcceptance.secondaryCollection.title,
      }),
    ).toBeVisible();
    const selectedCollectionArchetype = selection.dynamicCommerce.selectedArchetypes.collection;
    await expect(
      secondaryCollectionRoot.locator(
        `[data-component="${selectedCollectionArchetype.component}"]`,
      ),
    ).toHaveAttribute("data-variant", selectedCollectionArchetype.variant);
    await expect(secondaryCollectionRoot.locator('[data-frame-region="header"]')).toHaveAttribute(
      "data-frame-profile",
      selection.sharedFrame.profileId,
    );
    await expect(secondaryCollectionRoot.locator('[data-frame-region="footer"]')).toHaveAttribute(
      "data-frame-profile",
      selection.sharedFrame.profileId,
    );

    await page.goto(editorUrl);
    await expect(editorCanvasRegion(page)).toBeVisible({ timeout: 60_000 });
    await page.getByRole("radio", { name: localeLabel(commercialAcceptance.locale) }).check();
    await expect(
      page.getByRole("link", { name: /Preview storefront|Esikatsele kauppaa/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Publish changes|Julkaise muutokset/ }),
    ).toBeVisible();
    expect(await readStoredAuthority(page)).toEqual(savedStoredAuthority);
    const finalInspection = await inspectAcceptance(page);
    latestInspection = finalInspection;
    assertProtectedAcceptanceState(finalInspection, generated);
    expect(finalInspection).toMatchObject({
      status: "ready",
      activeAttempt: null,
      failedAttempt: null,
      failureClassification: null,
    });
    expect(finalInspection.providerCallCount).toBe(1);
    expect(finalInspection.retryCount).toBe(0);

    assertEquivalentRenderers(evidence);
    const logicalCaptureIds = new Set(evidence.map(({ logicalCaptureId }) => logicalCaptureId));
    expect(logicalCaptureIds.size).toBe(29);
    expect(new Set(evidence.map(({ filename }) => filename)).size).toBe(evidence.length);
    for (const logicalCaptureId of logicalCaptureIds) {
      const segments = evidence.filter((entry) => entry.logicalCaptureId === logicalCaptureId);
      expect(segments.map(({ segmentIndex }) => segmentIndex)).toEqual(
        Array.from({ length: segments.length }, (_value, index) => index + 1),
      );
      expect(new Set(segments.map(({ segmentCount }) => segmentCount))).toEqual(
        new Set([segments.length]),
      );
    }
    expect(generationRequests).toEqual(["POST"]);
    expect(publicationRequests).toEqual([]);
    expect(providerOrVeskoRequests).toEqual([]);
    const manifestPath = await writeP10B16P04VisualEvidenceManifest(evidenceDirectory, evidence);
    const safePromptEvidence = {
      terminalStatus: "prompt-c-complete",
      acceptanceCase,
      cumulativeProviderCallNumber: livePromptOnly ? 16 : null,
      projectId,
      studioUrl: editorUrl,
      retainedEvidenceDirectory: evidenceDirectory,
      provider: finalInspection.provider,
      selectedTransport: finalInspection.selectedTransport,
      providerCallCount: finalInspection.providerCallCount,
      retryCount: finalInspection.retryCount,
      caseEvidence: finalInspection.cases[0],
      materialComparisons,
      lifecycle: {
        proposalInspected: true,
        acceptedAtomically: true,
        oneUnsavedDraftChange: true,
        undoRestoredRawDraft: true,
        redoRestoredAcceptedPromptC: true,
        savedExplicitly: true,
        reloadedExactSavedStorefront: true,
        normalPreviewOpened: true,
        verifiedPreviewRoutes: [
          `/projects/${projectId}`,
          `/projects/${projectId}/collections/${commercialAcceptance.collection.collectionSlug}`,
          `/projects/${projectId}/collections/${commercialAcceptance.secondaryCollection.collectionSlug}`,
          `/projects/${projectId}/products/${commercialAcceptance.simpleProduct.productSlug}`,
          `/projects/${projectId}/products/${commercialAcceptance.configurableProduct.productSlug}`,
          `/projects/${projectId}/pages/about`,
          `/projects/${projectId}/cart`,
        ],
        publishRemainedSeparate: true,
        publishInvocations: 0,
      },
      storageAuthority: {
        rawDraftFingerprint: rawStoredFingerprints.draft,
        savedDraftFingerprint: savedStoredFingerprints.draft,
        rawCatalogueFingerprint: rawStoredFingerprints.catalogue,
        savedCatalogueFingerprint: savedStoredFingerprints.catalogue,
        rawHistoryCount: rawStoredAuthority.history.length,
        savedHistoryCount: savedStoredAuthority.history.length,
      },
      protectedAuthority: {
        commerce: "unchanged",
        canonicalProductMedia: "unchanged",
      },
      visualEvidenceManifest: manifestPath,
    } as const;
    const safeEvidencePath = resolve(evidenceDirectory, "safe-prompt-c-evidence.json");
    await writeFile(safeEvidencePath, `${JSON.stringify(safePromptEvidence, null, 2)}\n`, "utf8");
    await testInfo.attach("p10b-16p-04-safe-prompt-c-evidence", {
      path: safeEvidencePath,
      contentType: "application/json",
    });
    await testInfo.attach("p10b-16p-04-commercial-visual-evidence", {
      path: manifestPath,
      contentType: "application/json",
    });
  } catch (error) {
    latestInspection = await inspectAcceptance(page).catch(() => latestInspection);
    await writeFile(
      resolve(evidenceDirectory, "safe-terminal-failure.json"),
      `${JSON.stringify(
        {
          terminalStatus: "failed",
          providerCallCount: latestInspection?.providerCallCount ?? null,
          retryCount: latestInspection?.retryCount ?? 0,
          safeFailureClassification: latestInspection?.failureClassification ?? "browser-gate",
          failedAttempt: latestInspection?.failedAttempt ?? null,
          activeAttempt: latestInspection?.activeAttempt ?? null,
          cases: latestInspection?.cases ?? [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    throw error;
  }
});
