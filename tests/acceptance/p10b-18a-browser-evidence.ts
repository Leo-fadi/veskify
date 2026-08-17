import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { Locator, Page } from "@playwright/test";
import type { ProjectAggregate } from "@/services/storage";

export const p10b18aWidths = [375, 1440] as const;
export type P10B18AWidth = (typeof p10b18aWidths)[number] | 768 | 1024;
export type P10B18ASurface = "home" | "collection" | "product-detail";
export type P10B18ALocale = "en" | "fi";
export type P10B18ARuntimeAuthority = "p03-standalone" | "p04-integrated-mock";
const P04_ACCEPTANCE_HEADER = "x-veskify-p10b-16p-04-acceptance-token";

export type P10B18ARequestLedger = {
  external: string[];
  provider: string[];
  Vesko: string[];
  generation: string[];
  publication: string[];
  runtimeErrors: string[];
};

export type P10B18AStoreManifestEntry = Readonly<{
  caseId: string;
  fixtureAuthority: string;
  fixtureKind: string;
  fixtureSourceDraftId: string;
  fixtureSourceDraftKind: string;
  runtimeAuthority: P10B18ARuntimeAuthority;
  projectId: string;
  locale: P10B18ALocale;
  shapeId: string;
  directionId: string;
  semanticVariationId: string;
  semanticIntentFingerprint: string;
  semanticDrivers: Readonly<Record<string, string>>;
  compiledDecisionFingerprint: string;
  compilerStructuralFingerprint: string;
  consumedAuthorityFingerprint: string;
  normalizedAuthorityTopologyFingerprint: string;
  candidateSnapshotFingerprint: string;
  catalogueFingerprint: string;
  approvedEvidenceFingerprint: string | null;
  approvedAssetContextFingerprint: string | null;
  approvedAssetPresentationFingerprint: string;
  approvedAssetRoleSelections: readonly Readonly<{
    profileId: string;
    slotId: string;
    component: string;
    assetSlotId: string;
    role: string;
    assetId: string;
    assetRevision: string;
    materialFingerprint: string;
  }>[];
  commerceFingerprintBefore: string;
  commerceFingerprintAfter: string;
  mediaFingerprintBefore: string;
  mediaFingerprintAfter: string;
  frame: string;
  profiles: Readonly<Record<string, string>>;
  archetypes: Readonly<Record<string, string>>;
  componentVariants: readonly Readonly<{
    component: string;
    variant: string;
    anatomyId: string | null;
  }>[];
  homepageComponentSequence: readonly Readonly<{
    slotId: string;
    component: string;
    variant: string;
  }>[];
  selectionSummary: Readonly<Record<string, unknown>>;
  representativeRoutes: Readonly<{
    home: string;
    collection: string;
    productDetail: string;
  }>;
  representativeContext: Readonly<{
    collectionId: string;
    collectionProductCount: number;
    productId: string;
    productType: string;
    productConfigurable: boolean;
  }>;
}>;

export type P10B18AEvidenceEntry = Readonly<{
  filename: string;
  caseId: string;
  fixtureAuthority: string;
  fixtureKind: string;
  runtimeAuthority: P10B18ARuntimeAuthority;
  projectId: string;
  shapeId: string;
  directionId: string;
  semanticVariationId: string;
  semanticIntentFingerprint: string;
  compiledDecisionFingerprint: string;
  consumedAuthorityFingerprint: string;
  normalizedAuthorityTopologyFingerprint: string;
  candidateSnapshotFingerprint: string;
  commerceFingerprint: string;
  mediaFingerprint: string;
  surface: P10B18ASurface;
  route: string;
  viewport: P10B18AWidth;
  locale: P10B18ALocale;
  renderer: "saved-draft-preview";
  frame: string;
  profileOrArchetype: string;
  documentHeight: number;
  documentWidth: number;
  pngHeight: number;
  pngWidth: number;
  domNodeCount: number;
  productCardCount: number;
  domExactFingerprint: string;
  domTopologyFingerprint: string;
  renderedDesignDnaFingerprint: string;
  renderedComponentVariants: readonly string[];
}>;

type SerializableAuditAggregate = Readonly<{
  project: Readonly<{
    id: string;
    draftSnapshotId: string;
    [key: string]: unknown;
  }>;
  catalogue: Readonly<{ id: string; [key: string]: unknown }>;
  snapshots: readonly Readonly<{ id: string; projectId: string; [key: string]: unknown }>[];
}>;

export type P10B18AStoredAggregate = Readonly<{
  project: unknown;
  catalogue: unknown;
  snapshots: readonly unknown[];
  staleProjectState: Readonly<{
    history: number;
    publicationOperations: number;
    compiledPublicationArtifacts: number;
    publishedStorefrontVersions: number;
    activePublishedStorefrontPointer: number;
  }>;
}>;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`P10B-18A requires ${name}.`);
  return value;
}

export function p10b18aOrigin(authority: P10B18ARuntimeAuthority = "p03-standalone"): string {
  return requiredEnvironment(
    authority === "p04-integrated-mock"
      ? "P10B18A_P04_PLAYWRIGHT_ORIGIN"
      : "P10B18A_PLAYWRIGHT_ORIGIN",
  );
}

export function p10b18aEvidenceDirectory(): string {
  const systemTempRoot = resolve(tmpdir());
  const repositoryRoot = resolve(".");
  const directory = resolve(
    process.env.P10B18A_EVIDENCE_DIR ??
      resolve(systemTempRoot, "veskify-p10b-18a-commercial-authority-audit"),
  );
  const relativeToTemp = relative(systemTempRoot, directory);
  const relativeToRepository = relative(repositoryRoot, directory);
  const withinTemp =
    relativeToTemp === "" ||
    (relativeToTemp !== ".." &&
      !relativeToTemp.startsWith(`..${sep}`) &&
      !isAbsolute(relativeToTemp));
  const withinRepository =
    relativeToRepository === "" ||
    (relativeToRepository !== ".." &&
      !relativeToRepository.startsWith(`..${sep}`) &&
      !isAbsolute(relativeToRepository));
  if (!withinTemp || withinRepository) {
    throw new Error(
      "P10B-18A browser evidence must remain outside the repository within the system temporary directory.",
    );
  }
  return directory;
}

export function p10b18aEvidenceRunId(): string {
  return requiredEnvironment("P10B18A_EVIDENCE_RUN_ID");
}

function safeRuntimeError(value: string): string {
  const acceptanceToken = process.env.P10B18A_P04_ACCEPTANCE_TOKEN;
  return (acceptanceToken ? value.replaceAll(acceptanceToken, "[redacted]") : value)
    .replace(/([?&](?:authorization|key|token)=)[^&\s]+/giu, "$1[redacted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 500);
}

export async function installP10B18AOfflineAuthority(page: Page): Promise<P10B18ARequestLedger> {
  const standaloneOrigin = new URL(p10b18aOrigin("p03-standalone")).origin;
  const p04Origin = new URL(p10b18aOrigin("p04-integrated-mock")).origin;
  const allowedOrigins = new Set([standaloneOrigin, p04Origin]);
  const acceptanceToken = requiredEnvironment("P10B18A_P04_ACCEPTANCE_TOKEN");
  if (Buffer.byteLength(acceptanceToken) < 32) {
    throw new Error("P10B-18A requires a P04 acceptance token of at least 32 bytes.");
  }
  const ledger: P10B18ARequestLedger = {
    external: [],
    provider: [],
    Vesko: [],
    generation: [],
    publication: [],
    runtimeErrors: [],
  };
  page.on("pageerror", (error) => {
    ledger.runtimeErrors.push(safeRuntimeError(`pageerror:${error.name}:${error.message}`));
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      ledger.runtimeErrors.push(safeRuntimeError(`console:${message.text()}`));
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    const generationRequest =
      url.pathname.startsWith("/api/ai/") || url.pathname === "/api/demo/p9-05b/generate";
    if (!allowedOrigins.has(url.origin)) ledger.external.push(request.url());
    if (url.hostname === "api.openai.com" || url.hostname.endsWith(".openai.com")) {
      ledger.provider.push(request.url());
    }
    if (url.hostname === "vesko.fi" || url.hostname.endsWith(".vesko.fi")) {
      ledger.Vesko.push(request.url());
    }
    if (generationRequest) {
      ledger.generation.push(`${request.method()} ${url.pathname}`);
    }
    if (url.pathname.startsWith("/api/storefront-publish")) {
      ledger.publication.push(`${request.method()} ${url.pathname}`);
    }
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const external = !allowedOrigins.has(url.origin);
    const forbiddenExternal =
      url.hostname === "api.openai.com" ||
      url.hostname.endsWith(".openai.com") ||
      url.hostname === "vesko.fi" ||
      url.hostname.endsWith(".vesko.fi");
    const forbiddenMutation =
      url.pathname.startsWith("/api/ai/") ||
      url.pathname === "/api/demo/p9-05b/generate" ||
      url.pathname.startsWith("/api/storefront-publish");
    if (external || forbiddenExternal || forbiddenMutation) {
      await route.abort("blockedbyclient");
      return;
    }
    const requestHeaders = { ...route.request().headers() };
    delete requestHeaders[P04_ACCEPTANCE_HEADER];
    await route.continue({
      headers:
        url.origin === p04Origin
          ? { ...requestHeaders, [P04_ACCEPTANCE_HEADER]: acceptanceToken }
          : requestHeaders,
    });
  });
  return ledger;
}

function projectRoute({
  locale,
  projectId,
  route,
  runtimeAuthority,
}: {
  locale: P10B18ALocale;
  projectId: string;
  route: string;
  runtimeAuthority: P10B18ARuntimeAuthority;
}): string {
  const suffix = route === "/" ? "" : route;
  return `${p10b18aOrigin(runtimeAuthority)}/projects/${projectId}${suffix}?locale=${locale}`;
}

async function navigate(
  page: Page,
  routeAuthority: Readonly<{
    locale: P10B18ALocale;
    projectId: string;
    route: string;
    runtimeAuthority: P10B18ARuntimeAuthority;
  }>,
): Promise<Locator> {
  const url = projectRoute(routeAuthority);
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  if (!response?.ok() || page.url() !== url) {
    throw new Error(
      `P10B-18A preview navigation failed for ${routeAuthority.route} (${response?.status() ?? "none"}).`,
    );
  }
  const root = page.locator(".project-preview__storefront");
  await root.waitFor({ state: "visible", timeout: 120_000 });
  await page.waitForFunction(
    () =>
      document.readyState === "complete" &&
      Boolean(document.querySelector(".project-preview__storefront")),
    undefined,
    { timeout: 120_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolveValue) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolveValue())),
      ),
  );
  return root;
}

export async function initializeP10B18AStorage(
  page: Page,
  runtimeAuthority: P10B18ARuntimeAuthority,
): Promise<void> {
  const origin = p10b18aOrigin(runtimeAuthority);
  const rootUrl = `${origin}/`;
  const response = await page.goto(rootUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  if (!response?.ok() || page.url() !== rootUrl) {
    throw new Error(
      `P10B-18A could not initialize the isolated ${runtimeAuthority} browser origin.`,
    );
  }
  // This is a test-only mirror of the canonical IndexedDB v5 schema. It exists solely to avoid
  // invoking the production repository's empty-database demo bootstrap. The first audited
  // aggregate is seeded before any `/projects/...` navigation, and every normal preview capture
  // subsequently reloads and revalidates it through createBrowserProjectRepository().
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolveValue, reject) => {
      const request = indexedDB.open("veskify", 5);
      request.onupgradeneeded = (event) => {
        if (event.oldVersion !== 0) {
          request.transaction?.abort();
          return;
        }
        const value = request.result;
        value.createObjectStore("projects", { keyPath: "id" });
        value.createObjectStore("catalogues", { keyPath: "id" });
        value
          .createObjectStore("snapshots", { keyPath: "id" })
          .createIndex("by-project", "projectId");
        value
          .createObjectStore("snapshotProvenance", { keyPath: "snapshotId" })
          .createIndex("by-project", "projectId");
        value
          .createObjectStore("snapshotHistoryMetadata", { keyPath: "snapshotId" })
          .createIndex("by-project", "projectId");
        value
          .createObjectStore("publicationOperations", { keyPath: "operationKey" })
          .createIndex("by-project", "storefrontProjectId");
        value
          .createObjectStore("compiledPublicationArtifacts", { keyPath: "id" })
          .createIndex("by-project", "projectId");
        value
          .createObjectStore("publishedStorefrontVersions", { keyPath: "id" })
          .createIndex("by-project", "projectId");
        value.createObjectStore("activePublishedStorefrontPointers", { keyPath: "projectId" });
      };
      request.onsuccess = () => resolveValue(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("P10B-18A could not initialize browser storage."));
      request.onblocked = () => reject(new Error("P10B-18A browser storage upgrade was blocked."));
    });
    const expectedStores = {
      activePublishedStorefrontPointers: { keyPath: "projectId", index: null },
      catalogues: { keyPath: "id", index: null },
      compiledPublicationArtifacts: { keyPath: "id", index: "projectId" },
      projects: { keyPath: "id", index: null },
      publicationOperations: { keyPath: "operationKey", index: "storefrontProjectId" },
      publishedStorefrontVersions: { keyPath: "id", index: "projectId" },
      snapshotHistoryMetadata: { keyPath: "snapshotId", index: "projectId" },
      snapshotProvenance: { keyPath: "snapshotId", index: "projectId" },
      snapshots: { keyPath: "id", index: "projectId" },
    } as const;
    const actualStoreNames = [...database.objectStoreNames].sort();
    const expectedStoreNames = Object.keys(expectedStores).sort();
    if (
      database.version !== 5 ||
      JSON.stringify(actualStoreNames) !== JSON.stringify(expectedStoreNames)
    ) {
      database.close();
      throw new Error("P10B-18A browser storage does not have the exact canonical v5 stores.");
    }
    const transaction = database.transaction(expectedStoreNames, "readonly");
    for (const [storeName, expected] of Object.entries(expectedStores)) {
      const store = transaction.objectStore(storeName);
      if (store.keyPath !== expected.keyPath) {
        transaction.abort();
        database.close();
        throw new Error(`P10B-18A ${storeName} has a stale key path.`);
      }
      if (expected.index === null) {
        if (store.indexNames.length !== 0) {
          transaction.abort();
          database.close();
          throw new Error(`P10B-18A ${storeName} has an unexpected index.`);
        }
        continue;
      }
      if (store.indexNames.length !== 1 || !store.indexNames.contains("by-project")) {
        transaction.abort();
        database.close();
        throw new Error(`P10B-18A ${storeName} lacks its canonical index.`);
      }
      const index = store.index("by-project");
      if (index.keyPath !== expected.index || index.unique || index.multiEntry) {
        transaction.abort();
        database.close();
        throw new Error(`P10B-18A ${storeName} has stale canonical index authority.`);
      }
    }
    database.close();
  });
}

/**
 * Installs one already-validated, test-only aggregate into the ephemeral browser
 * repository. Normal preview clients subsequently reload it through
 * `createBrowserProjectRepository().get()`, which performs canonical validation.
 */
export async function seedP10B18AAggregate(
  page: Page,
  aggregate: ProjectAggregate,
  runtimeAuthority: P10B18ARuntimeAuthority,
): Promise<P10B18AStoredAggregate> {
  if (new URL(page.url()).origin !== new URL(p10b18aOrigin(runtimeAuthority)).origin) {
    throw new Error("P10B-18A refused to seed an aggregate into the wrong origin repository.");
  }
  const serializable = structuredClone(aggregate) as unknown as SerializableAuditAggregate;
  return page.evaluate(async (input) => {
    const requestValue = <Value>(request: IDBRequest<Value>) =>
      new Promise<Value>((resolveValue, reject) => {
        request.onsuccess = () => resolveValue(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
      });
    const database = await new Promise<IDBDatabase>((resolveValue, reject) => {
      const request = indexedDB.open("veskify");
      request.onsuccess = () => resolveValue(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
    });
    const canonicalStoreNames = [
      "activePublishedStorefrontPointers",
      "catalogues",
      "compiledPublicationArtifacts",
      "projects",
      "publicationOperations",
      "publishedStorefrontVersions",
      "snapshotHistoryMetadata",
      "snapshotProvenance",
      "snapshots",
    ];
    if (new Set(canonicalStoreNames).size !== canonicalStoreNames.length) {
      database.close();
      throw new Error("P10B-18A canonical seed transaction contains a duplicate store.");
    }
    const transaction = database.transaction(canonicalStoreNames, "readwrite");
    const completed = new Promise<void>((resolveValue, reject) => {
      transaction.oncomplete = () => resolveValue();
      transaction.onabort = () => reject(transaction.error ?? new Error("Audit seed aborted."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Audit seed failed."));
    });
    const snapshots = transaction.objectStore("snapshots");
    const provenance = transaction.objectStore("snapshotProvenance");
    // The browser context and both origins are dedicated to this audit. Reset every canonical
    // store before each sample so a prior shape, history or publication record cannot leak into
    // the next saved-draft preview.
    for (const storeName of transaction.objectStoreNames) {
      transaction.objectStore(storeName).clear();
    }
    transaction.objectStore("catalogues").put(input.catalogue);
    for (const snapshot of input.snapshots) snapshots.put(snapshot);
    provenance.put({
      snapshotId: input.project.draftSnapshotId,
      projectId: input.project.id,
      kind: "managedDraft",
    });
    transaction.objectStore("projects").put(input.project);
    await completed;

    const read = database.transaction(
      [
        "activePublishedStorefrontPointers",
        "catalogues",
        "compiledPublicationArtifacts",
        "projects",
        "publicationOperations",
        "publishedStorefrontVersions",
        "snapshotHistoryMetadata",
        "snapshots",
      ],
      "readonly",
    );
    const project: unknown = await requestValue(
      read.objectStore("projects").get(input.project.id) as IDBRequest<unknown>,
    );
    const storedSnapshots: unknown[] = await requestValue(
      read.objectStore("snapshots").index("by-project").getAll(input.project.id) as IDBRequest<
        unknown[]
      >,
    );
    const catalogue: unknown = await requestValue(
      read.objectStore("catalogues").get(input.catalogue.id) as IDBRequest<unknown>,
    );
    const staleProjectState = {
      history: await requestValue(
        read.objectStore("snapshotHistoryMetadata").index("by-project").count(input.project.id),
      ),
      publicationOperations: await requestValue(
        read.objectStore("publicationOperations").index("by-project").count(input.project.id),
      ),
      compiledPublicationArtifacts: await requestValue(
        read
          .objectStore("compiledPublicationArtifacts")
          .index("by-project")
          .count(input.project.id),
      ),
      publishedStorefrontVersions: await requestValue(
        read.objectStore("publishedStorefrontVersions").index("by-project").count(input.project.id),
      ),
      activePublishedStorefrontPointer: Number(
        Boolean(
          await requestValue(
            read.objectStore("activePublishedStorefrontPointers").get(input.project.id),
          ),
        ),
      ),
    };
    database.close();
    return { project, catalogue, snapshots: storedSnapshots, staleProjectState };
  }, serializable);
}

export async function readP10B18AAggregate(
  page: Page,
  projectId: string,
  catalogueId: string,
  runtimeAuthority: P10B18ARuntimeAuthority,
): Promise<P10B18AStoredAggregate> {
  if (new URL(page.url()).origin !== new URL(p10b18aOrigin(runtimeAuthority)).origin) {
    throw new Error("P10B-18A refused to read an aggregate from the wrong origin repository.");
  }
  return page.evaluate(
    async ({ projectId: selectedProjectId, catalogueId: selectedCatalogueId }) => {
      const requestValue = <Value>(request: IDBRequest<Value>) =>
        new Promise<Value>((resolveValue, reject) => {
          request.onsuccess = () => resolveValue(request.result);
          request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
        });
      const database = await new Promise<IDBDatabase>((resolveValue, reject) => {
        const request = indexedDB.open("veskify");
        request.onsuccess = () => resolveValue(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("IndexedDB could not be opened."));
      });
      const read = database.transaction(
        [
          "activePublishedStorefrontPointers",
          "catalogues",
          "compiledPublicationArtifacts",
          "projects",
          "publicationOperations",
          "publishedStorefrontVersions",
          "snapshotHistoryMetadata",
          "snapshots",
        ],
        "readonly",
      );
      const project: unknown = await requestValue(
        read.objectStore("projects").get(selectedProjectId) as IDBRequest<unknown>,
      );
      const snapshots: unknown[] = await requestValue(
        read.objectStore("snapshots").index("by-project").getAll(selectedProjectId) as IDBRequest<
          unknown[]
        >,
      );
      const catalogue: unknown = await requestValue(
        read.objectStore("catalogues").get(selectedCatalogueId) as IDBRequest<unknown>,
      );
      const staleProjectState = {
        history: await requestValue(
          read.objectStore("snapshotHistoryMetadata").index("by-project").count(selectedProjectId),
        ),
        publicationOperations: await requestValue(
          read.objectStore("publicationOperations").index("by-project").count(selectedProjectId),
        ),
        compiledPublicationArtifacts: await requestValue(
          read
            .objectStore("compiledPublicationArtifacts")
            .index("by-project")
            .count(selectedProjectId),
        ),
        publishedStorefrontVersions: await requestValue(
          read
            .objectStore("publishedStorefrontVersions")
            .index("by-project")
            .count(selectedProjectId),
        ),
        activePublishedStorefrontPointer: Number(
          Boolean(
            await requestValue(
              read.objectStore("activePublishedStorefrontPointers").get(selectedProjectId),
            ),
          ),
        ),
      };
      database.close();
      return { project, catalogue, snapshots, staleProjectState };
    },
    { projectId, catalogueId },
  );
}

async function waitForImages(root: Locator): Promise<void> {
  const scroll = await root.evaluate((candidate) => {
    const view = candidate.ownerDocument.defaultView;
    return { x: view?.scrollX ?? 0, y: view?.scrollY ?? 0 };
  });
  try {
    const images = root.locator("img");
    for (let index = 0; index < (await images.count()); index += 1) {
      const image = images.nth(index);
      if (!(await image.isVisible())) continue;
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(async (candidate) => {
        const value = candidate as HTMLImageElement;
        if (!value.complete) {
          await new Promise<void>((resolveValue) => {
            const settle = () => {
              value.removeEventListener("load", settle);
              value.removeEventListener("error", settle);
              resolveValue();
            };
            value.addEventListener("load", settle);
            value.addEventListener("error", settle);
          });
        }
        if (value.naturalWidth === 0 || value.naturalHeight === 0) {
          throw new Error("A P10B-18A storefront image did not load.");
        }
        await value.decode();
      });
    }
  } finally {
    await root.evaluate((candidate, position) => {
      candidate.ownerDocument.defaultView?.scrollTo(position.x, position.y);
    }, scroll);
  }
}

function fingerprint(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function pngDimensions(image: Buffer): Readonly<{ width: number; height: number }> {
  if (image.length < 24 || image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("P10B-18A evidence is not a complete PNG.");
  }
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

function safeName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  if (!normalized) throw new Error("P10B-18A evidence filename is empty.");
  if (normalized.length <= 150) return normalized;
  const suffix = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `${normalized.slice(0, 137)}-${suffix}`;
}

const p10b18aEvidenceScreenshotStyle = `
  /* Next development chrome is outside the storefront and is excluded only
     from retained audit images. Runtime errors remain independently fatal. */
  nextjs-portal { display: none !important; }
`;

async function assertDevelopmentChromeIsOutsideStorefront(root: Locator): Promise<void> {
  const portalOwnership = await root.evaluate((candidate) =>
    [...candidate.ownerDocument.querySelectorAll("nextjs-portal")].map((portal) => ({
      tagName: portal.tagName.toLowerCase(),
      insideStorefront: candidate.contains(portal),
    })),
  );
  if (
    portalOwnership.some(
      ({ tagName, insideStorefront }) => tagName !== "nextjs-portal" || insideStorefront,
    )
  ) {
    throw new Error("P10B-18A development chrome entered the storefront evidence root.");
  }
}

async function renderedAuthority(root: Locator) {
  return root.evaluate((candidate) => {
    const attribute = (node: Element, name: string) => node.getAttribute(name);
    const nodes = [
      ...candidate.querySelectorAll<HTMLElement>(
        "[data-frame-region], [data-component], [data-card-anatomy], [data-layout-region]",
      ),
    ];
    const viewport = candidate.ownerDocument.defaultView?.innerWidth ?? 1;
    const exactNodes = nodes.map((node) => {
      const style = getComputedStyle(node);
      const bounds = node.getBoundingClientRect();
      return {
        tag: node.tagName.toLowerCase(),
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
        widthRatio: Math.round((bounds.width / viewport) * 1_000),
      };
    });
    const topologyNodes = [
      ...new Map(exactNodes.map((node) => [JSON.stringify(node), node])).values(),
    ];
    const computed = getComputedStyle(candidate);
    const designDnaVariables = [
      "--brand-design-dna-version",
      "--brand-design-dna-fingerprint",
      "--brand-font-display",
      "--brand-font-heading",
      "--brand-font-body",
      "--brand-type-scale-ratio",
      "--brand-section-rhythm",
      "--brand-page-gutter",
      "--brand-grid-gap",
      "--brand-card-inset",
      "--brand-surface-page",
      "--brand-surface-default",
      "--brand-border-width",
      "--brand-radius",
      "--brand-elevation-shadow",
      "--brand-control-height",
      "--brand-control-radius",
      "--brand-density-global",
      "--brand-density-commerce",
      "--brand-media-ratio",
      "--brand-media-crop",
      "--brand-media-prominence",
    ];
    return {
      connected: candidate.isConnected && candidate.ownerDocument.body.contains(candidate),
      documentHeight: Math.ceil(candidate.scrollHeight),
      documentWidth: Math.ceil(candidate.scrollWidth),
      clientWidth: Math.ceil((candidate as HTMLElement).clientWidth),
      viewport,
      headerCount: candidate.querySelectorAll('[data-frame-region="header"]').length,
      footerCount: candidate.querySelectorAll('[data-frame-region="footer"]').length,
      productCardCount: candidate.querySelectorAll("article[data-card-anatomy]").length,
      exactNodes,
      topologyNodes,
      componentVariants: [
        ...new Set(
          nodes.flatMap((node) => {
            const component = attribute(node, "data-component");
            const variant = attribute(node, "data-variant");
            const anatomy = attribute(node, "data-card-anatomy");
            return component || anatomy
              ? [`${component ?? "product-card"}:${variant ?? anatomy ?? "default"}`]
              : [];
          }),
        ),
      ],
      designDna: Object.fromEntries(
        designDnaVariables.map((name) => [name, computed.getPropertyValue(name).trim()]),
      ),
    };
  });
}

export async function captureP10B18AEvidence({
  page,
  store,
  surface,
  route,
  width,
  profileOrArchetype,
}: {
  page: Page;
  store: P10B18AStoreManifestEntry;
  surface: P10B18ASurface;
  route: string;
  width: P10B18AWidth;
  profileOrArchetype: string;
}): Promise<P10B18AEvidenceEntry> {
  await page.setViewportSize({ width, height: width === 375 ? 900 : 1_000 });
  const root = await navigate(page, {
    locale: store.locale,
    projectId: store.projectId,
    route,
    runtimeAuthority: store.runtimeAuthority,
  });
  await waitForImages(root);
  const authority = await renderedAuthority(root);
  if (!authority.connected) throw new Error(`${store.caseId}:${surface} detached before capture.`);
  if (authority.headerCount !== 1 || authority.footerCount !== 1) {
    throw new Error(`${store.caseId}:${surface} does not have one complete shared frame.`);
  }
  if (authority.viewport !== width || Math.abs(authority.clientWidth - width) > 2) {
    throw new Error(`${store.caseId}:${surface} rendered at the wrong width.`);
  }
  if (authority.documentWidth > width + 1) {
    throw new Error(`${store.caseId}:${surface} overflows horizontally.`);
  }
  const frameProfiles = new Set(
    authority.exactNodes.flatMap(({ frameProfile }) => (frameProfile ? [frameProfile] : [])),
  );
  if (frameProfiles.size !== 1 || !frameProfiles.has(store.frame)) {
    throw new Error(`${store.caseId}:${surface} did not render ${store.frame}.`);
  }

  const filename = `${safeName(
    [store.caseId, store.directionId, store.shapeId, surface, `${width}px`].join("-"),
  )}.png`;
  const directory = p10b18aEvidenceDirectory();
  await mkdir(directory, { recursive: true });
  await assertDevelopmentChromeIsOutsideStorefront(root);
  const image = await root.screenshot({
    animations: "disabled",
    caret: "hide",
    style: p10b18aEvidenceScreenshotStyle,
  });
  const png = pngDimensions(image);
  if (
    Math.abs(png.width - authority.documentWidth) > 2 ||
    png.height + 2 < authority.documentHeight
  ) {
    throw new Error(`${store.caseId}:${surface} full-document evidence is clipped.`);
  }
  await writeFile(resolve(directory, filename), image);
  return {
    filename,
    caseId: store.caseId,
    fixtureAuthority: store.fixtureAuthority,
    fixtureKind: store.fixtureKind,
    runtimeAuthority: store.runtimeAuthority,
    projectId: store.projectId,
    shapeId: store.shapeId,
    directionId: store.directionId,
    semanticVariationId: store.semanticVariationId,
    semanticIntentFingerprint: store.semanticIntentFingerprint,
    compiledDecisionFingerprint: store.compiledDecisionFingerprint,
    consumedAuthorityFingerprint: store.consumedAuthorityFingerprint,
    normalizedAuthorityTopologyFingerprint: store.normalizedAuthorityTopologyFingerprint,
    candidateSnapshotFingerprint: store.candidateSnapshotFingerprint,
    commerceFingerprint: store.commerceFingerprintBefore,
    mediaFingerprint: store.mediaFingerprintBefore,
    surface,
    route,
    viewport: width,
    locale: store.locale,
    renderer: "saved-draft-preview",
    frame: store.frame,
    profileOrArchetype,
    documentHeight: authority.documentHeight,
    documentWidth: authority.documentWidth,
    pngHeight: png.height,
    pngWidth: png.width,
    domNodeCount: authority.exactNodes.length,
    productCardCount: authority.productCardCount,
    domExactFingerprint: fingerprint("p10b18a-dom-exact-v1", authority.exactNodes),
    domTopologyFingerprint: fingerprint("p10b18a-dom-topology-v1", authority.topologyNodes),
    renderedDesignDnaFingerprint: fingerprint("p10b18a-rendered-dna-v1", authority.designDna),
    renderedComponentVariants: authority.componentVariants,
  };
}

export async function writeP10B18AEvidenceManifest({
  stores,
  captures,
  ledger,
  sampledStorefrontMaterializationCount,
  workerFixtureBootstrapMaterializationCount,
}: {
  stores: readonly P10B18AStoreManifestEntry[];
  captures: readonly P10B18AEvidenceEntry[];
  ledger: P10B18ARequestLedger;
  sampledStorefrontMaterializationCount: number;
  workerFixtureBootstrapMaterializationCount: number;
}): Promise<string> {
  const directory = p10b18aEvidenceDirectory();
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, "p10b-18a-commercial-authority-browser-manifest.json");
  const orderedStores = [...stores].sort((left, right) => left.caseId.localeCompare(right.caseId));
  const orderedCaptures = [...captures].sort((left, right) =>
    `${left.caseId}:${left.surface}:${left.viewport}`.localeCompare(
      `${right.caseId}:${right.surface}:${right.viewport}`,
    ),
  );
  const countBy = (values: readonly string[]) =>
    Object.fromEntries(
      [...new Set(values)]
        .sort()
        .map((value) => [value, values.filter((candidate) => candidate === value).length]),
    );
  const selectedCases = orderedStores.map((store) => ({
    caseId: store.caseId,
    fixtureAuthority: store.fixtureAuthority,
    fixtureKind: store.fixtureKind,
    runtimeAuthority: store.runtimeAuthority,
    projectId: store.projectId,
    locale: store.locale,
    shapeId: store.shapeId,
    directionId: store.directionId,
    semanticVariationId: store.semanticVariationId,
    semanticIntentFingerprint: store.semanticIntentFingerprint,
    compiledDecisionFingerprint: store.compiledDecisionFingerprint,
    compilerStructuralFingerprint: store.compilerStructuralFingerprint,
    normalizedAuthorityTopologyFingerprint: store.normalizedAuthorityTopologyFingerprint,
    consumedAuthorityFingerprint: store.consumedAuthorityFingerprint,
  }));
  const collapseWitnesses = [...new Set(orderedStores.map(({ directionId }) => directionId))]
    .sort()
    .map((directionId) => {
      const directionStores = orderedStores.filter((store) => store.directionId === directionId);
      const repeatedTopology = directionStores.find((store) =>
        directionStores.some(
          (candidate) =>
            candidate.caseId !== store.caseId &&
            candidate.normalizedAuthorityTopologyFingerprint ===
              store.normalizedAuthorityTopologyFingerprint &&
            candidate.compiledDecisionFingerprint !== store.compiledDecisionFingerprint,
        ),
      )?.normalizedAuthorityTopologyFingerprint;
      return {
        directionId,
        normalizedAuthorityTopologyFingerprint: repeatedTopology ?? null,
        caseIds: repeatedTopology
          ? directionStores
              .filter((store) => store.normalizedAuthorityTopologyFingerprint === repeatedTopology)
              .map(({ caseId }) => caseId)
              .sort()
          : [],
      };
    });
  await writeFile(
    path,
    `${JSON.stringify(
      {
        contractVersion: "p10b-18a-commercial-authority-browser-evidence-v2",
        runId: p10b18aEvidenceRunId(),
        fixtureClassification:
          "production-disabled deterministic audit authority; never real merchant evidence",
        renderer: "current normal saved-draft preview routes",
        runtimeAuthority:
          "two local origins: P03 standalone deterministic and P04 integrated/mock acceptance",
        captureRoot: ".project-preview__storefront (complete shared frame header through footer)",
        storeCount: orderedStores.length,
        sampledStorefrontMaterializationCount,
        workerFixtureBootstrapMaterializationCount,
        materializationAccounting: {
          sampledStorefronts: {
            count: sampledStorefrontMaterializationCount,
            processScope: "Playwright worker",
            authority: "selected semantic compiler decisions executed by the current executor",
            varietyEvidence: true,
          },
          workerFixtureBootstrap: {
            count: workerFixtureBootstrapMaterializationCount,
            processScope: "Playwright worker",
            authority: "cached P10B-16P-04J raw Aurum dynamic-authority bootstrap",
            varietyEvidence: false,
          },
          expectedNextServerFixtureBootstraps: {
            count: 2,
            instrumented: false,
            authorities: [
              {
                runtimeAuthority: "p03-standalone",
                fixture: "P10B-16P-03 raw Karvonen dynamic-authority bootstrap",
                expectedMaximumPerProcess: 1,
                trigger: "standalone current-evidence/preview authority initialization",
              },
              {
                runtimeAuthority: "p04-integrated-mock",
                fixture: "P10B-16P-04J raw Aurum dynamic-authority bootstrap",
                expectedMaximumPerProcess: 1,
                trigger: "authenticated P04 current-evidence authority initialization",
              },
            ],
            varietyEvidence: false,
          },
          totalMaterializationCount: null,
          totalAccountingReason:
            "Next dev route-module process lifecycles are not instrumented, so process-scoped fixture expectations are enumerated but never summed into a claimed run total.",
        },
        captureCount: orderedCaptures.length,
        widths: p10b18aWidths,
        surfaces: ["home", "collection", "product-detail"],
        selection: {
          selectedCases,
          shapeCounts: countBy(orderedStores.map(({ shapeId }) => shapeId)),
          directionCounts: countBy(orderedStores.map(({ directionId }) => directionId)),
          fixtureAuthorityCounts: countBy(
            orderedStores.map(({ fixtureAuthority }) => fixtureAuthority),
          ),
          localeCounts: countBy(orderedStores.map(({ locale }) => locale)),
          runtimeAuthorityCounts: countBy(
            orderedStores.map(({ runtimeAuthority }) => runtimeAuthority),
          ),
          normalizedTopologyCounts: countBy(
            orderedStores.map(
              ({ normalizedAuthorityTopologyFingerprint }) =>
                normalizedAuthorityTopologyFingerprint,
            ),
          ),
          distinctNormalizedTopologyCount: new Set(
            orderedStores.map(
              ({ normalizedAuthorityTopologyFingerprint }) =>
                normalizedAuthorityTopologyFingerprint,
            ),
          ).size,
          collapseWitnesses,
        },
        stores: orderedStores,
        captures: orderedCaptures,
        requestLedger: ledger,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return path;
}
