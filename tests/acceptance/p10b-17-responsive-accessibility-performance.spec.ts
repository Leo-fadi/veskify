import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { storefrontMainContentId } from "@/components/registry/contract";
import { openEditorAssistant } from "../e2e/editor-assistant";
import {
  expectBoundedStorefrontKeyboardTraversal,
  expectStorefrontSemanticIntegrity,
  expectStorefrontTouchGeometry,
} from "../e2e/storefront-accessibility";
import { expectNoStorefrontHorizontalClipping } from "../e2e/storefront-geometry";
import {
  captureStorefrontPerformanceEvidence,
  installStorefrontPerformanceObservers,
  settleStorefrontPerformanceInputs,
} from "../e2e/storefront-performance";
import {
  assertSelectedMinimalCommerceAuthority,
  assertSelectedModernTechnicalAuthority,
  assertSelectedPremiumAuthority,
} from "./p10b-16p-04-commercial-fidelity-assertions";
import type { P10B16P04SafeSelection } from "./p10b-16p-04-visual-evidence";
import {
  captureP10B17Evidence,
  expectP10B17Offline,
  installP10B17OfflineAuthority,
  navigateP10B17Route,
  p10b17Directions,
  p10b17EditorUrl,
  p10b17ProjectId,
  p10b17Route,
  p10b17Surfaces,
  p10b17Widths,
  storefrontRendererFingerprint,
  storefrontResponsiveStructureFingerprint,
  storefrontRoot,
  withP10B17StableRouteAssertion,
  writeP10B17EvidenceManifest,
  type P10B17EvidenceEntry,
  type P10B17ForbiddenRequests,
  type P10B17GeneratedDirection,
  type P10B17Locale,
  type P10B17PerformanceRecord,
  type P10B17Surface,
  type P10B17Width,
} from "./p10b-17-browser-evidence";

const inspectionPath = "/api/demo/p10b-16p-04";
const generationPath = "/api/ai/whole-storefront-proposals";
const acceptanceTokenHeader = "x-veskify-p10b-16p-04-acceptance-token";

type GenerationSuccess = Readonly<{
  ok: true;
  proposal: Readonly<{
    metadata: Readonly<{ wholeStorefrontProposalFingerprint: string }>;
  }>;
  lineage: Readonly<{
    candidateSnapshotFingerprint: string;
    compiledDecisionFingerprint: string;
    materializationCount: 1;
    protectedCommerceBeforeFingerprint: string;
    protectedCommerceAfterFingerprint: string;
    protectedMediaBeforeFingerprint: string;
    protectedMediaAfterFingerprint: string;
    providerCallCount: 1;
    retryCount: 0;
  }>;
}>;

type InspectionCase = Readonly<{
  candidateSnapshotFingerprint: string;
  compiledDecisionFingerprint: string;
  structuralFingerprint: string;
  protectedCommerceBeforeFingerprint: string;
  protectedCommerceAfterFingerprint: string;
  protectedMediaBeforeFingerprint: string;
  protectedMediaAfterFingerprint: string;
  materializationCount: 1;
  selection: P10B16P04SafeSelection;
}>;

type AcceptanceInspection = Readonly<{
  projectId: string;
  selectedTransport: Readonly<{ kind: "mock" | "openai" }>;
  providerCallCount: number;
  retryCount: 0;
  cases: readonly InspectionCase[];
}>;

type StoredAuthority = Readonly<{
  draft: string;
  catalogue: string;
  history: string;
}>;

function requiredAcceptanceToken(): string {
  const token = process.env.P10B17_PLAYWRIGHT_ACCEPTANCE_TOKEN;
  if (!token || Buffer.byteLength(token) < 32) {
    throw new Error("The P10B-17 acceptance token is unavailable.");
  }
  return token;
}

async function inspectAcceptance(page: Page): Promise<AcceptanceInspection> {
  const response = await page.request.get(inspectionPath, {
    headers: { [acceptanceTokenHeader]: requiredAcceptanceToken() },
  });
  expect(response.status()).toBe(200);
  const result = (await response.json()) as Readonly<{
    ok: true;
    acceptance: AcceptanceInspection;
  }>;
  expect(result.ok).toBe(true);
  return result.acceptance;
}

async function readStoredAuthority(page: Page): Promise<StoredAuthority> {
  return page.evaluate(async (projectId) => {
    const value = <Value>(request: IDBRequest<Value>) =>
      new Promise<Value>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error("Could not inspect controlled Studio storage."));
      });
    const open = indexedDB.open("veskify");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(new Error("Could not open controlled Studio storage."));
    });
    const project = (await value(
      database.transaction("projects", "readonly").objectStore("projects").get(projectId),
    )) as { draftSnapshotId: string } | undefined;
    if (!project) throw new Error("The controlled P10B-17 project is unavailable.");
    const snapshot = await value(
      database
        .transaction("snapshots", "readonly")
        .objectStore("snapshots")
        .get(project.draftSnapshotId) as IDBRequest<unknown>,
    );
    const draft = JSON.stringify(snapshot);
    const parsed = snapshot as { catalogueRef?: string };
    if (!parsed.catalogueRef) throw new Error("The controlled draft has no catalogue authority.");
    const catalogue = JSON.stringify(
      await value(
        database
          .transaction("catalogues", "readonly")
          .objectStore("catalogues")
          .get(parsed.catalogueRef) as IDBRequest<unknown>,
      ),
    );
    const history = JSON.stringify(
      await value(
        database
          .transaction("snapshotHistoryMetadata", "readonly")
          .objectStore("snapshotHistoryMetadata")
          .index("by-project")
          .getAll(projectId) as IDBRequest<unknown>,
      ),
    );
    database.close();
    return { draft, catalogue, history };
  }, p10b17ProjectId);
}

function proposalRegion(page: Page): Locator {
  return page.getByLabel(/Storefront design proposal|Verkkokaupan suunnitteluehdotus/);
}

function activeDraft(page: Page): Locator {
  return page.locator("[data-p10b16p04-active-draft-fingerprint]");
}

async function generateDirection(
  page: Page,
  direction: (typeof p10b17Directions)[number],
  expectedCaseCount: number,
): Promise<P10B17GeneratedDirection> {
  await openEditorAssistant(page);
  await page.getByRole("radio", { name: /Entire storefront|Koko verkkokauppa/ }).check();
  await page.getByLabel(/Your request|Pyyntösi/).fill(direction.prompt);
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === generationPath && response.request().method() === "POST",
    { timeout: 180_000 },
  );
  await page.getByRole("button", { name: /Generate storefront|Luo verkkokauppa/ }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const result = (await response.json()) as GenerationSuccess;
  expect(result.ok).toBe(true);
  expect(result.lineage).toMatchObject({
    materializationCount: 1,
    providerCallCount: 1,
    retryCount: 0,
  });
  expect(result.lineage.protectedCommerceAfterFingerprint).toBe(
    result.lineage.protectedCommerceBeforeFingerprint,
  );
  expect(result.lineage.protectedMediaAfterFingerprint).toBe(
    result.lineage.protectedMediaBeforeFingerprint,
  );
  await expect(proposalRegion(page)).toBeVisible({ timeout: 60_000 });
  const inspection = await inspectAcceptance(page);
  expect(inspection).toMatchObject({
    projectId: p10b17ProjectId,
    selectedTransport: { kind: "mock" },
    providerCallCount: expectedCaseCount,
    retryCount: 0,
  });
  expect(inspection.cases).toHaveLength(expectedCaseCount);
  const retained = inspection.cases.find(
    ({ candidateSnapshotFingerprint }) =>
      candidateSnapshotFingerprint === result.lineage.candidateSnapshotFingerprint,
  );
  if (!retained) throw new Error(`No retained ${direction.id} acceptance case exists.`);
  expect(retained.materializationCount).toBe(1);
  expect(retained.compiledDecisionFingerprint).toBe(result.lineage.compiledDecisionFingerprint);
  expect(retained.protectedCommerceAfterFingerprint).toBe(
    retained.protectedCommerceBeforeFingerprint,
  );
  expect(retained.protectedMediaAfterFingerprint).toBe(retained.protectedMediaBeforeFingerprint);
  if (direction.id === "premium-editorial") assertSelectedPremiumAuthority(retained.selection);
  if (direction.id === "modern-technical")
    assertSelectedModernTechnicalAuthority(retained.selection);
  if (direction.id === "minimal-commerce")
    assertSelectedMinimalCommerceAuthority(retained.selection);
  return {
    direction: direction.id,
    snapshotFingerprint: retained.candidateSnapshotFingerprint,
    proposalFingerprint: result.proposal.metadata.wholeStorefrontProposalFingerprint,
    structuralFingerprint: retained.structuralFingerprint,
    compiledDecisionFingerprint: retained.compiledDecisionFingerprint,
    protectedCommerceFingerprint: retained.protectedCommerceBeforeFingerprint,
    protectedMediaFingerprint: retained.protectedMediaBeforeFingerprint,
    selection: retained.selection,
  };
}

async function rejectProposal(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Reject|Hylkää/, exact: true }).click();
  await expect(proposalRegion(page)).toHaveCount(0);
}

async function acceptAndSaveProposal(page: Page, fingerprint: string): Promise<void> {
  await page.getByRole("button", { name: /Accept and apply|Hyväksy ja käytä/ }).click();
  await page
    .getByRole("button", { name: /Apply storefront proposal|Ota kauppaehdotus käyttöön/ })
    .click();
  await expect(activeDraft(page)).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    fingerprint,
  );
  await expect(page.getByTestId("draft-status")).toContainText(
    /Unsaved changes|Tallentamattomia muutoksia/,
  );
  await page.getByRole("button", { name: /Save draft|Tallenna luonnos/ }).click();
  await expect(page.getByText(/Draft saved successfully|Luonnos tallennettiin/)).toBeVisible();
}

function materialIdentity(generated: P10B17GeneratedDirection): readonly string[] {
  return [
    generated.selection.designDnaNonColour.typography.pairing,
    generated.selection.sharedFrame.profileId,
    generated.selection.profiles.homepage,
    generated.selection.dynamicCommerce.collectionArchetypeId,
    generated.selection.dynamicCommerce.configurableArchetypeId,
    [...generated.selection.productCardAnatomyIds].sort().join(","),
    generated.selection.postures.responsive,
    generated.selection.postures.artDirection,
  ];
}

function changedMaterialDimensions(
  first: P10B17GeneratedDirection,
  second: P10B17GeneratedDirection,
): number {
  const left = materialIdentity(first);
  const right = materialIdentity(second);
  return left.filter((value, index) => value !== right[index]).length;
}

async function assertResponsiveSurface({
  page,
  generated,
  surface,
  width,
  locale,
}: {
  page: Page;
  generated: P10B17GeneratedDirection;
  surface: P10B17Surface;
  width: P10B17Width;
  locale: P10B17Locale;
}): Promise<string> {
  await page.setViewportSize({ width, height: width === 375 ? 900 : 1000 });
  const path = p10b17Route({
    surface,
    locale,
    renderer: "proposal",
    snapshotFingerprint: generated.snapshotFingerprint,
  });
  return withP10B17StableRouteAssertion({
    page,
    path,
    expectedFrame: generated.selection.sharedFrame.profileId,
    expectedSnapshotFingerprint: generated.snapshotFingerprint,
    assertion: async (root) => {
      await expect(page.locator(`.project-preview[lang="${locale}"]`)).toBeVisible();
      await expectStorefrontSemanticIntegrity(root);
      await expectNoStorefrontHorizontalClipping(page);
      await expect(root.locator('[data-frame-region="header"]')).toHaveAttribute(
        "data-frame-profile",
        generated.selection.sharedFrame.profileId,
      );
      await expect(root.locator('[data-frame-region="footer"]')).toHaveAttribute(
        "data-frame-profile",
        generated.selection.sharedFrame.profileId,
      );
      await expect(root.locator("img:not([alt])")).toHaveCount(0);
      await expect(root).not.toContainText(
        /verify live|requires verification|protected authority|runtime commerce routes/iu,
      );
      if (surface.id === "collection" || surface.id === "search") {
        await expect(root.locator("article[data-card-anatomy]")).not.toHaveCount(0);
      }
      if (surface.id === "search") {
        await expect(
          root.locator('[data-search-context="transient-canonical-results"]'),
        ).toBeVisible();
        await expect(root.locator('form[role="search"]:visible').first()).toBeVisible();
      }
      if (surface.id === "configurable-pdp") {
        await expect(
          root.getByRole("heading", {
            level: 2,
            name: /Choose product options|Valitse tuotevaihtoehdot/,
          }),
        ).toBeVisible();
        await expect(root.locator("fieldset[data-option-group-id]")).not.toHaveCount(0);
        await expect(
          root.getByRole("button", { name: /Add to cart|Lisää ostoskoriin/ }),
        ).toBeVisible();
      }
      if (surface.id === "simple-pdp") {
        await expect(
          root.getByRole("button", { name: /Add to cart|Lisää ostoskoriin/ }),
        ).toBeVisible();
      }
      return storefrontResponsiveStructureFingerprint(root);
    },
  });
}

async function assertMobileKeyboardAndFocus(page: Page, generated: P10B17GeneratedDirection) {
  const home = p10b17Surfaces.find(({ id }) => id === "home")!;
  await page.setViewportSize({ width: 375, height: 900 });
  await navigateP10B17Route(
    page,
    p10b17Route({
      surface: home,
      locale: "en",
      renderer: "proposal",
      snapshotFingerprint: generated.snapshotFingerprint,
    }),
  );
  const root = storefrontRoot(page);
  const skip = root.getByRole("link", { name: "Skip to main content" });
  await skip.focus();
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(root.locator(`#${storefrontMainContentId}`)).toBeFocused();
  const menu = root.getByRole("button", { name: /Open menu|Avaa valikko/i }).first();
  await menu.focus();
  await page.keyboard.press("Enter");
  const mobileRegion = root.locator('[data-frame-region="mobile-navigation"]');
  await expect(mobileRegion).toBeVisible();
  await expect(root.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(mobileRegion).toHaveCount(0);
  await expect(menu).toBeFocused();
  const focusStyle = await menu.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(focusStyle.style).not.toBe("none");
  expect(Number.parseFloat(focusStyle.width)).toBeGreaterThanOrEqual(2);
  await expectStorefrontTouchGeometry(root, 24);
  await expectBoundedStorefrontKeyboardTraversal({ page, root, maximumSteps: 100 });
}

async function assertFilterAndPdpKeyboard(page: Page, generated: P10B17GeneratedDirection) {
  const collection = p10b17Surfaces.find(({ id }) => id === "collection")!;
  await page.setViewportSize({ width: 375, height: 900 });
  await navigateP10B17Route(
    page,
    p10b17Route({
      surface: collection,
      locale: "en",
      renderer: "proposal",
      snapshotFingerprint: generated.snapshotFingerprint,
    }),
  );
  const collectionRoot = storefrontRoot(page);
  const disclosure = collectionRoot.getByRole("button", { name: /^Show filters\b/i });
  await expect(disclosure).toHaveCount(1);
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  const controlledPanelId = await disclosure.getAttribute("aria-controls");
  if (!controlledPanelId) throw new Error("The filter disclosure has no controlled panel.");
  const controlledPanel = collectionRoot.locator(`#${controlledPanelId}`);
  await expect(controlledPanel).toBeVisible();
  const firstFilter = controlledPanel.locator("input").first();
  await expect(firstFilter).toHaveCount(1);
  await firstFilter.focus();
  await expect(firstFilter).toBeFocused();
  await firstFilter.evaluate((element) => {
    element.addEventListener(
      "click",
      () =>
        element.ownerDocument.documentElement.setAttribute(
          "data-p10b17-filter-keyboard-activation",
          "observed",
        ),
      { once: true },
    );
  });
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute(
    "data-p10b17-filter-keyboard-activation",
    "observed",
  );
  await expect(firstFilter).toBeFocused();
  await expect(controlledPanel).toBeVisible();
  const configurable = p10b17Surfaces.find(({ id }) => id === "configurable-pdp")!;
  await navigateP10B17Route(
    page,
    p10b17Route({
      surface: configurable,
      locale: "en",
      renderer: "proposal",
      snapshotFingerprint: generated.snapshotFingerprint,
    }),
  );
  const pdpRoot = storefrontRoot(page);
  const option = pdpRoot
    .locator(
      "[data-option-group-id] input:not([disabled]), [data-option-group-id] select:not([disabled]), [data-option-group-id] button:not([disabled])",
    )
    .first();
  await expect(option).toHaveCount(1);
  await expect(option).toBeVisible();
  await option.focus();
  await expect(option).toBeFocused();
  const optionTag = await option.evaluate((element) => {
    const mark = () =>
      element.ownerDocument.documentElement.setAttribute(
        "data-p10b17-pdp-keyboard-activation",
        "observed",
      );
    element.addEventListener("click", mark, { once: true });
    element.addEventListener("change", mark, { once: true });
    return element.tagName;
  });
  if (optionTag === "SELECT") {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  } else {
    await page.keyboard.press(optionTag === "INPUT" ? "Space" : "Enter");
  }
  await expect(page.locator("html")).toHaveAttribute(
    "data-p10b17-pdp-keyboard-activation",
    "observed",
  );
  await expect(
    pdpRoot.getByRole("button", { name: /Add to cart|Lisää ostoskoriin/ }),
  ).toBeVisible();
}

async function assertTouchGeometryAcrossCriticalSurfaces(
  page: Page,
  generated: P10B17GeneratedDirection,
) {
  for (const width of [375, 768] as const) {
    await page.setViewportSize({ width, height: 1000 });
    for (const surfaceId of ["home", "search", "collection", "configurable-pdp", "cart"] as const) {
      const surface = p10b17Surfaces.find(({ id }) => id === surfaceId)!;
      await navigateP10B17Route(
        page,
        p10b17Route({
          surface,
          locale: "en",
          renderer: "proposal",
          snapshotFingerprint: generated.snapshotFingerprint,
        }),
      );
      const root = storefrontRoot(page);
      await expect(root).toBeVisible();
      if (surfaceId === "home") {
        await expectStorefrontTouchGeometry(root, 24);
        const menu = root.getByRole("button", { name: "Open menu", exact: true });
        await menu.click();
        await expect(root.locator('[data-frame-region="mobile-navigation"]')).toBeVisible();
      }
      if (surfaceId === "collection") {
        const disclosure = root.getByRole("button", { name: /^Show filters\b/i });
        await disclosure.click();
        await expect(disclosure).toHaveAttribute("aria-expanded", "true");
      }
      await expectStorefrontTouchGeometry(root, 24);
    }
  }
}

async function assertReducedMotion(page: Page, generated: P10B17GeneratedDirection) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const home = p10b17Surfaces.find(({ id }) => id === "home")!;
  const path = p10b17Route({
    surface: home,
    locale: "en",
    renderer: "proposal",
    snapshotFingerprint: generated.snapshotFingerprint,
  });
  const offenders = await withP10B17StableRouteAssertion({
    page,
    path,
    expectedFrame: generated.selection.sharedFrame.profileId,
    expectedSnapshotFingerprint: generated.snapshotFingerprint,
    assertion: (root) =>
      root.locator("*").evaluateAll((elements) =>
        elements.flatMap((element) => {
          const style = getComputedStyle(element);
          const durations = `${style.animationDuration},${style.transitionDuration}`
            .split(",")
            .map((value) => value.trim())
            .map((value) =>
              value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000,
            );
          return durations.some((duration) => Number.isFinite(duration) && duration > 20)
            ? [`${element.tagName.toLowerCase()}:${durations.join(",")}`]
            : [];
        }),
      ),
  });
  expect(offenders).toEqual([]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
}

async function capturePerformance(
  page: Page,
  generated: P10B17GeneratedDirection,
  surface: P10B17Surface,
): Promise<P10B17PerformanceRecord> {
  await installStorefrontPerformanceObservers(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const path = p10b17Route({
    surface,
    locale: "en",
    renderer: "proposal",
    snapshotFingerprint: generated.snapshotFingerprint,
  });
  return withP10B17StableRouteAssertion({
    page,
    path,
    expectedFrame: generated.selection.sharedFrame.profileId,
    expectedSnapshotFingerprint: generated.snapshotFingerprint,
    assertion: async (root) => {
      await settleStorefrontPerformanceInputs(page, root);
      const evidence = await captureStorefrontPerformanceEvidence(page, root);
      expect(evidence.observerSupport).toEqual({ layoutShift: true, longTask: true });
      expect(evidence.domNodeCount).toBeLessThanOrEqual(2_500);
      expect(evidence.productCardCount).toBeLessThanOrEqual(24);
      expect(evidence.imageElementCount).toBeLessThanOrEqual(48);
      expect(evidence.eagerImageCount).toBeLessThanOrEqual(2);
      expect(evidence.eagerImageCount + evidence.lazyImageCount).toBe(evidence.imageElementCount);
      expect(evidence.highPriorityImageCount).toBeLessThanOrEqual(1);
      expect(evidence.duplicateImageRequestCount).toBeLessThanOrEqual(1);
      if (evidence.layoutShiftTotal !== null)
        expect(
          evidence.layoutShiftTotal,
          JSON.stringify(evidence.layoutShiftEntries),
        ).toBeLessThanOrEqual(0.25);
      return {
        direction: generated.direction,
        surface: surface.id,
        width: 1440,
        domNodeCount: evidence.domNodeCount,
        productCardCount: evidence.productCardCount,
        imageElementCount: evidence.imageElementCount,
        eagerImageCount: evidence.eagerImageCount,
        lazyImageCount: evidence.lazyImageCount,
        highPriorityImageCount: evidence.highPriorityImageCount,
        imageRequestCount: evidence.imageRequestCount,
        uniqueImageRequestCount: evidence.uniqueImageRequestCount,
        duplicateImageRequestCount: evidence.duplicateImageRequestCount,
        observerSupport: evidence.observerSupport,
        layoutShiftTotal: evidence.layoutShiftTotal,
        layoutShiftEntries: evidence.layoutShiftEntries,
        longTaskCount: evidence.longTaskCount,
        longTaskDuration: evidence.longTaskDuration,
        scriptRequestCount: evidence.scriptRequestCount,
        scriptTransferBytes: evidence.scriptTransferBytes,
      } satisfies P10B17PerformanceRecord;
    },
  });
}

test.describe.configure({ timeout: 1_800_000 });

test("retained A/B/C authority closes responsive, accessibility, and bounded performance", async ({
  browserName,
  page,
}, testInfo: TestInfo) => {
  test.skip(browserName !== "chromium", "P10B-17 retains one deterministic Chromium evidence set.");
  const requests = await installP10B17OfflineAuthority(page);
  const offlineRecords: P10B17ForbiddenRequests[] = [requests];
  await navigateP10B17Route(page, p10b17EditorUrl);
  await expect(activeDraft(page)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("radio", { name: /^English$/ }).check();
  const rawFingerprint = await activeDraft(page).getAttribute(
    "data-p10b16p04-active-draft-fingerprint",
  );
  if (!rawFingerprint) throw new Error("The controlled raw draft fingerprint is unavailable.");
  const rawStored = await readStoredAuthority(page);
  const generatedDirections: P10B17GeneratedDirection[] = [];
  const evidence: P10B17EvidenceEntry[] = [];
  const performance: P10B17PerformanceRecord[] = [];

  for (const [index, direction] of p10b17Directions.entries()) {
    const generated = await generateDirection(page, direction, index + 1);
    generatedDirections.push(generated);
    if (direction.id !== "minimal-commerce") {
      await rejectProposal(page);
      await expect(activeDraft(page)).toHaveAttribute(
        "data-p10b16p04-active-draft-fingerprint",
        rawFingerprint,
      );
      expect(await readStoredAuthority(page)).toEqual(rawStored);
    }
    const preview = await page.context().newPage();
    offlineRecords.push(await installP10B17OfflineAuthority(preview));
    for (const width of [375, 1440] as const) {
      for (const surfaceId of ["home", "collection", "configurable-pdp"] as const) {
        const surface = p10b17Surfaces.find(({ id }) => id === surfaceId)!;
        evidence.push(
          await captureP10B17Evidence({
            page: preview,
            generated,
            surface,
            width,
            locale: "en",
          }),
        );
      }
    }
    await preview.close();
    expect((await readStoredAuthority(page)).draft).toBe(rawStored.draft);
    expect((await readStoredAuthority(page)).catalogue).toBe(rawStored.catalogue);
  }

  expect(
    new Set(generatedDirections.map(({ structuralFingerprint }) => structuralFingerprint)).size,
  ).toBe(3);
  expect(
    new Set(
      generatedDirections.map(({ compiledDecisionFingerprint }) => compiledDecisionFingerprint),
    ).size,
  ).toBe(3);
  for (let left = 0; left < generatedDirections.length; left += 1) {
    for (let right = left + 1; right < generatedDirections.length; right += 1) {
      expect(
        changedMaterialDimensions(generatedDirections[left], generatedDirections[right]),
      ).toBeGreaterThanOrEqual(4);
    }
  }

  const minimal = generatedDirections.find(({ direction }) => direction === "minimal-commerce")!;
  const studioRoot = page
    .getByLabel(/Proposal preview canvas|Ehdotuksen esikatselualue/)
    .frameLocator("iframe")
    .locator('[data-veskify-canvas-root="true"]');
  await expect(studioRoot).toBeVisible();
  const studioHomeFingerprint = await storefrontRendererFingerprint(studioRoot);

  // Preserve the normal one-time proposal lifecycle before Next development-route
  // compilation can refresh the background Studio page and discard transient UI state.
  await acceptAndSaveProposal(page, minimal.snapshotFingerprint);
  const savedStored = await readStoredAuthority(page);
  expect(savedStored.catalogue).toBe(rawStored.catalogue);
  expect(savedStored.history).toBe(rawStored.history);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(activeDraft(page)).toHaveAttribute(
    "data-p10b16p04-active-draft-fingerprint",
    minimal.snapshotFingerprint,
  );

  const matrixPage = await page.context().newPage();
  offlineRecords.push(await installP10B17OfflineAuthority(matrixPage));
  const directionSurfaceFingerprints = new Map<string, string>();
  for (const generated of generatedDirections) {
    for (const width of p10b17Widths) {
      for (const surfaceId of [
        "home",
        "collection",
        "search",
        "simple-pdp",
        "configurable-pdp",
      ] as const) {
        const surface = p10b17Surfaces.find(({ id }) => id === surfaceId)!;
        const fingerprint = await assertResponsiveSurface({
          page: matrixPage,
          generated,
          surface,
          width,
          locale: "en",
        });
        directionSurfaceFingerprints.set(
          `${generated.direction}:${width}:${surface.id}`,
          fingerprint,
        );
      }
    }
  }
  for (const width of p10b17Widths) {
    const fingerprints = generatedDirections.map(({ direction }) =>
      directionSurfaceFingerprints.get(`${direction}:${width}:home`),
    );
    expect(new Set(fingerprints).size).toBe(3);
  }

  for (const width of p10b17Widths) {
    for (const surfaceId of ["home", "search", "configurable-pdp"] as const) {
      const surface = p10b17Surfaces.find(({ id }) => id === surfaceId)!;
      await assertResponsiveSurface({
        page: matrixPage,
        generated: minimal,
        surface,
        width,
        locale: "fi",
      });
    }
  }
  const search = p10b17Surfaces.find(({ id }) => id === "search")!;
  await navigateP10B17Route(
    matrixPage,
    p10b17Route({
      surface: search,
      locale: "en",
      renderer: "proposal",
      snapshotFingerprint: minimal.snapshotFingerprint,
    }),
  );
  const finnishLocale = storefrontRoot(matrixPage).getByRole("button", { name: "FI" });
  await finnishLocale.click();
  await expect(matrixPage).toHaveURL((url) => url.searchParams.get("locale") === "fi");
  await expect(matrixPage).toHaveURL((url) => url.searchParams.get("q") === "925");
  await expect(matrixPage.locator('.project-preview[lang="fi"]')).toBeVisible();
  await matrixPage.close();

  const interactionPage = await page.context().newPage();
  offlineRecords.push(await installP10B17OfflineAuthority(interactionPage));
  await assertMobileKeyboardAndFocus(interactionPage, minimal);
  await assertFilterAndPdpKeyboard(interactionPage, minimal);
  await assertTouchGeometryAcrossCriticalSurfaces(interactionPage, minimal);
  await assertReducedMotion(interactionPage, minimal);
  await interactionPage.close();

  const additionalSurfaceIds = ["search", "simple-pdp", "cart"] as const;
  const evidencePage = await page.context().newPage();
  offlineRecords.push(await installP10B17OfflineAuthority(evidencePage));
  for (const width of p10b17Widths) {
    for (const surfaceId of additionalSurfaceIds) {
      const surface = p10b17Surfaces.find(({ id }) => id === surfaceId)!;
      evidence.push(
        await captureP10B17Evidence({
          page: evidencePage,
          generated: minimal,
          surface,
          width,
          locale: "en",
        }),
      );
    }
  }
  await evidencePage.close();

  for (const surface of p10b17Surfaces) {
    const performancePage = await page.context().newPage();
    offlineRecords.push(await installP10B17OfflineAuthority(performancePage));
    performance.push(await capturePerformance(performancePage, minimal, surface));
    await performancePage.close();
  }

  const equivalencePage = await page.context().newPage();
  offlineRecords.push(await installP10B17OfflineAuthority(equivalencePage));
  const home = p10b17Surfaces.find(({ id }) => id === "home")!;
  const savedPath = p10b17Route({ surface: home, locale: "en", renderer: "saved-preview" });
  const savedFingerprint = await withP10B17StableRouteAssertion({
    page: equivalencePage,
    path: savedPath,
    expectedFrame: minimal.selection.sharedFrame.profileId,
    assertion: storefrontRendererFingerprint,
  });
  expect(savedFingerprint).toBe(studioHomeFingerprint);
  evidence.push(
    await captureP10B17Evidence({
      page: equivalencePage,
      generated: minimal,
      surface: home,
      width: 1440,
      locale: "en",
      renderer: "saved-preview",
    }),
  );
  await withP10B17StableRouteAssertion({
    page: equivalencePage,
    path: p10b17Route({ surface: search, locale: "en", renderer: "published" }),
    assertion: async (publishedRoot) => {
      await expectStorefrontSemanticIntegrity(publishedRoot);
      await expectNoStorefrontHorizontalClipping(equivalencePage);
      await expect(
        publishedRoot.locator("[data-responsive-transformations]").first(),
      ).toBeVisible();
    },
  });
  await equivalencePage.close();

  expect(new Set(evidence.map(({ filename }) => filename)).size).toBe(evidence.length);
  expect(evidence.filter(({ renderer }) => renderer === "proposal")).toHaveLength(30);
  expectP10B17Offline(requests, 3);
  for (const record of offlineRecords.slice(1)) expectP10B17Offline(record, 0);
  const finalInspection = await inspectAcceptance(page);
  expect(finalInspection.providerCallCount).toBe(3);
  expect(finalInspection.retryCount).toBe(0);
  for (const retained of finalInspection.cases) {
    expect(retained.protectedCommerceAfterFingerprint).toBe(
      retained.protectedCommerceBeforeFingerprint,
    );
    expect(retained.protectedMediaAfterFingerprint).toBe(retained.protectedMediaBeforeFingerprint);
  }
  await writeP10B17EvidenceManifest({
    entries: evidence,
    performance,
    directions: generatedDirections,
    testInfo,
  });
});
