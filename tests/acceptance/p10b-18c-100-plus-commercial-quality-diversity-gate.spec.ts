import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
  type StorefrontSearchRequestV1,
} from "@/application/storefront-search";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { projectSchema } from "@/domain/project";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import {
  createStandaloneCatalogueProductSearchAdapter,
  createStandaloneStorefrontSearchAuthority,
} from "@/integrations/storefront-search";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import {
  P10B18C_STAGE_B_BROWSER_TIMEOUT_MS,
  buildP10b18cMatrix,
  compileP10b18cCase,
  materializeP10b18cCase,
  p10b18cSemanticStrata,
  p10b18cClusterMetrics,
  p10b18cDuplicateAnalysis,
  p10b18cSemanticCausality,
  p10b18cSerializableCase,
  selectP10b18cContentUtilityStores,
  selectP10b18cHumanStores,
  selectP10b18cSearchStores,
  selectP10b18cTabletStores,
  type P10b18cMaterializedCase,
  type P10b18cSelectedStore,
} from "../helpers/p10b-18c-commercial-quality";
import {
  P10B18CActiveCaptureEvidence,
  type P10B18CCaptureResumeExpectation,
} from "../helpers/p10b-18c-active-capture-evidence";
import {
  p10b18cRendererAuthorityFingerprint,
  prepareP10B18CDeltaStageB,
  type P10B18CDeltaStageBResult,
} from "../helpers/p10b-18c-delta-stage-b";
import {
  assertP10B18CStageBFreeSpace,
  p10b18cStageBStorageRootsFromEnvironment,
} from "../helpers/p10b-18c-free-space-preflight";
import { canonicalP10BEvidenceFilename } from "../helpers/p10b-evidence-filename";
import {
  p10b18cPresentationImageAuthorities,
  p10b18cSharedFrameLogoAuthority,
} from "../helpers/p10b-18c-presentation-image-evidence";
import { createP10b18aShapeAuthorities } from "../helpers/p10b-18a-commercial-authority";
import {
  P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV,
  requireP10B18CPlaywrightAcceptanceToken,
} from "../helpers/p10b-18c-production-server-composition";
import {
  captureP10B18AEvidence,
  initializeP10B18AStorage,
  installP10B18AOfflineAuthority,
  p10b18aEvidenceDirectory,
  p10b18aEvidenceRunId,
  p10b18aOrigin,
  readP10B18AAggregate,
  seedP10B18AAggregate,
  type P10B18AStoreManifestEntry,
  type P10B18ASurface,
  type P10B18AWidth,
} from "./p10b-18a-browser-evidence";

type CoreSurface = "home" | "collection" | "search" | "product-detail";
type SearchMode = "multiple" | "one" | "zero";

function p10b18cP04PageAcceptanceToken(): string {
  return requireP10B18CPlaywrightAcceptanceToken(
    process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV],
  );
}

type Geometry = Readonly<{
  viewportWidth: number;
  documentWidth: number;
  documentHeight: number;
  horizontalOverflow: number;
  largestEmptyVerticalGap: number;
  openingHeight: number | null;
  firstActionOffset: number | null;
  firstMerchandisingOffset: number | null;
  orientationHeight: number | null;
  filterHeight: number | null;
  firstCardOffset: number | null;
  mediaRegionHeight: number | null;
  purchaseRegionOffset: number | null;
  firstOptionOffset: number | null;
  relatedMerchandisingOffset: number | null;
  meaningfulRegionCount: number;
  primaryActionOffset: number | null;
  cartLineCount: number;
  cartSummaryOffset: number | null;
}>;

type Accessibility = Readonly<{
  headingCount: number;
  h1Count: number;
  landmarkCount: number;
  unnamedControlCount: number;
  missingAltCount: number;
  disclosureCount: number;
  minimumTouchWidth: number | null;
  minimumTouchHeight: number | null;
  reducedMotionActiveAnimationCount: number;
}>;

type BrowserCapture = Readonly<{
  filename: string;
  screenshotSha256: string;
  caseId: string;
  shapeId: string;
  semanticIntent: string;
  directionId: string;
  designDnaFingerprint: string;
  frame: string;
  profiles: P10b18cMaterializedCase["profiles"];
  contentSupportEffectiveAnatomy: unknown;
  utilityAnatomy: unknown;
  productCardAnatomy: unknown;
  assetAuthority: unknown;
  viewport: number;
  locale: string;
  surface: string;
  route: string;
  renderer: "saved-draft-preview" | "production-disabled-proof";
  snapshotFingerprint: string;
  consumedAuthorityFingerprint: string;
  normalizedTopologyFingerprint: string;
  domFingerprint: string;
  geometry: Geometry;
  accessibility: Accessibility;
  commerceFingerprint: string;
  mediaFingerprint: string;
}>;

function recordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireBrowserCapture(value: unknown, index: number): BrowserCapture {
  if (
    !recordValue(value) ||
    typeof value.filename !== "string" ||
    typeof value.screenshotSha256 !== "string" ||
    typeof value.caseId !== "string" ||
    typeof value.shapeId !== "string" ||
    typeof value.semanticIntent !== "string" ||
    typeof value.directionId !== "string" ||
    typeof value.designDnaFingerprint !== "string" ||
    typeof value.frame !== "string" ||
    !recordValue(value.profiles) ||
    typeof value.viewport !== "number" ||
    typeof value.locale !== "string" ||
    typeof value.surface !== "string" ||
    typeof value.route !== "string" ||
    (value.renderer !== "saved-draft-preview" && value.renderer !== "production-disabled-proof") ||
    typeof value.snapshotFingerprint !== "string" ||
    typeof value.consumedAuthorityFingerprint !== "string" ||
    typeof value.normalizedTopologyFingerprint !== "string" ||
    typeof value.domFingerprint !== "string" ||
    !recordValue(value.geometry) ||
    !recordValue(value.accessibility) ||
    typeof value.commerceFingerprint !== "string" ||
    typeof value.mediaFingerprint !== "string" ||
    !("contentSupportEffectiveAnatomy" in value) ||
    !("utilityAnatomy" in value) ||
    !("productCardAnatomy" in value) ||
    !("assetAuthority" in value)
  ) {
    throw new Error(`P10B-18C resumed manifest entry ${index + 1} is malformed.`);
  }
  return value as BrowserCapture;
}

const contentProofPlan = [
  { profile: "content-about-story", id: "about-story" },
  { profile: "content-about-process", id: "about-process" },
  { profile: "content-contact-channels", id: "contact-channels" },
  { profile: "content-location-directory", id: "location-directory" },
  { profile: "content-faq-disclosure", id: "faq-disclosure" },
  { profile: "content-service-details", family: "returns-information", id: "returns-service" },
  { profile: "content-policy-reading", id: "policy-reading" },
  { profile: "content-generic-reading", id: "generic-reading" },
  { profile: "content-generic-editorial", id: "generic-editorial" },
  { profile: "landing-campaign-editorial", action: "paired", id: "campaign-editorial" },
  {
    profile: "landing-campaign-image-led",
    media: "approved",
    action: "paired",
    id: "campaign-image-led",
  },
  { profile: "landing-campaign-story", action: "paired", id: "campaign-story" },
] as const;

const utilityProofPlan = [
  { profile: "commerce-utility-cart", id: "populated-cart", state: "cart-populated" },
  {
    profile: "commerce-utility-cart",
    scenario: "empty",
    id: "empty-cart",
    state: "cart-empty",
  },
  {
    profile: "commerce-utility-cart",
    scenario: "unavailable",
    id: "unavailable-cart",
    state: "unavailable",
  },
  { profile: "commerce-utility-checkout", id: "checkout-boundary", state: "checkout" },
  {
    profile: "commerce-utility-no-results",
    scenario: "query",
    id: "no-results-query",
    state: "no-results",
  },
  {
    profile: "commerce-utility-no-results",
    scenario: "filters",
    id: "no-results-filters",
    state: "no-results",
  },
  { profile: "commerce-utility-empty", id: "generic-empty", state: "empty" },
  { profile: "commerce-utility-error", id: "recoverable-error", state: "error" },
  {
    profile: "commerce-utility-error",
    scenario: "unrecoverable",
    id: "unrecoverable-error",
    state: "error",
  },
  { profile: "commerce-utility-not-found", id: "not-found", state: "not-found" },
  {
    profile: "commerce-utility-cart",
    scenario: "loading",
    id: "loading",
    state: "loading",
  },
  {
    profile: "commerce-utility-checkout",
    capabilities: "none",
    id: "unsupported-actions",
    state: "checkout",
  },
] as const;

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeName(value: string): string {
  return value
    .replace(/[^a-z0-9.-]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
}

function query(values: Record<string, string | undefined>): string {
  const parameters = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") parameters.set(key, value);
  });
  return parameters.toString();
}

function isConfigurable(product: P10b18cMaterializedCase["representativeContext"]["product"]) {
  return product.variants.length > 1 || Boolean(product.orderOptions?.length);
}

function storeManifest(store: P10b18cMaterializedCase): P10B18AStoreManifestEntry {
  const authority = store.compiled.authority;
  const result = store.compiled.result;
  const homepageSelection = result.synthesisDecision.pageProfileSelections.find(
    ({ familyId }) => familyId === "home",
  );
  if (!homepageSelection) throw new Error(`${store.compiled.caseId} has no homepage selection.`);
  return {
    caseId: store.compiled.caseId,
    fixtureAuthority: authority.fixtureAuthority,
    fixtureKind: authority.fixtureKind,
    fixtureSourceDraftId: authority.fixtureSetup.sourceDraftId,
    fixtureSourceDraftKind: authority.fixtureSetup.sourceDraftKind,
    runtimeAuthority: store.runtimeAuthority,
    projectId: store.aggregate.project.id,
    locale: store.locale,
    shapeId: authority.id,
    directionId: store.directionId,
    semanticVariationId: store.compiled.stratum.id,
    semanticIntentFingerprint: store.fingerprints.semanticIntent,
    semanticDrivers: store.compiled.stratum.drivers,
    compiledDecisionFingerprint: store.fingerprints.compiledDecision,
    compilerStructuralFingerprint: store.fingerprints.compilerStructural,
    consumedAuthorityFingerprint: store.fingerprints.consumedAuthority,
    normalizedAuthorityTopologyFingerprint: store.fingerprints.normalizedTopology,
    candidateSnapshotFingerprint: store.fingerprints.snapshot,
    catalogueFingerprint: store.fingerprints.catalogue,
    approvedEvidenceFingerprint: authority.approvedEvidenceFingerprint,
    approvedAssetContextFingerprint: authority.approvedAssetContextFingerprint,
    approvedAssetPresentationFingerprint: authority.approvedAssetPresentationFingerprint,
    approvedAssetRoleSelections: result.synthesisDecision.approvedAssetRoleSelections.map(
      ({
        profileId,
        slotId,
        component,
        assetSlotId,
        role,
        assetId,
        assetRevision,
        materialFingerprint,
      }) => ({
        profileId,
        slotId,
        component,
        assetSlotId,
        role,
        assetId,
        assetRevision,
        materialFingerprint,
      }),
    ),
    commerceFingerprintBefore: store.fingerprints.commerceBefore,
    commerceFingerprintAfter: store.fingerprints.commerceAfter,
    mediaFingerprintBefore: store.fingerprints.mediaBefore,
    mediaFingerprintAfter: store.fingerprints.mediaAfter,
    frame: result.synthesisDecision.sharedFrame.profileId,
    profiles: store.profiles,
    archetypes: store.archetypes,
    componentVariants: result.synthesisDecision.componentChoices.map(
      ({ component, variant, anatomyId }) => ({ component, variant, anatomyId: anatomyId ?? null }),
    ),
    homepageComponentSequence: result.synthesisDecision.componentChoices
      .filter(({ pageKey }) => pageKey === homepageSelection.pageKey)
      .map(({ slotId, component, variant }) => ({ slotId, component, variant })),
    selectionSummary: {
      contract: "p10b-18c-current-authority",
      semanticMappingNote: store.compiled.stratum.mappingNote,
      completeness: store.completeness,
      complexity: store.complexity,
    },
    representativeRoutes: {
      home: "/",
      collection: store.representativeRoutes.collection,
      productDetail: store.representativeRoutes.productDetail,
    },
    representativeContext: {
      collectionId: store.representativeContext.collectionId,
      collectionProductCount: store.representativeContext.collectionProductCount,
      productId: store.representativeContext.product.id,
      productType: store.representativeContext.product.productType,
      productConfigurable: isConfigurable(store.representativeContext.product),
    },
  };
}

function baseCapturePlanEntry({
  store,
  manifest,
  surface,
  route,
  width,
  caseSuffix,
}: {
  store: P10b18cMaterializedCase;
  manifest: P10B18AStoreManifestEntry;
  surface: P10B18ASurface;
  route: string;
  width: P10B18AWidth;
  caseSuffix?: string;
}): Readonly<{
  captureStore: P10B18AStoreManifestEntry;
  expectation: P10B18CCaptureResumeExpectation;
}> {
  const captureStore = caseSuffix
    ? { ...manifest, caseId: `${manifest.caseId}--${caseSuffix}` }
    : manifest;
  const logicalFilename = `${safeName(
    [
      captureStore.caseId,
      captureStore.directionId,
      captureStore.shapeId,
      surface,
      `${width}px`,
    ].join("-"),
  )}.png`;
  const suffix = route === "/" ? "" : route;
  const expectedUrl = new URL(
    `${p10b18aOrigin(captureStore.runtimeAuthority)}/projects/${captureStore.projectId}${suffix}`,
  );
  expectedUrl.searchParams.set("locale", captureStore.locale);
  return {
    captureStore,
    expectation: {
      identity: {
        caseId: store.compiled.caseId,
        semanticStratum: store.compiled.stratum.id,
        surfacePageType: surface,
        expectedRoute: route,
        expectedUrl: expectedUrl.toString(),
        viewport: { width, height: width === 375 ? 900 : 1_000 },
        locale: store.locale,
        renderer: "saved-draft-preview",
        runtimeMode: captureStore.runtimeAuthority,
        selectedSnapshotFingerprint: store.fingerprints.snapshot,
        normalizedTopologyFingerprint: store.fingerprints.normalizedTopology,
        logicalFilename,
      },
      canonicalFilename: canonicalP10BEvidenceFilename(logicalFilename),
      consumedAuthorityFingerprint: store.fingerprints.consumedAuthority,
    },
  };
}

async function inspectGeometry(page: Page, rootSelector: string): Promise<Geometry> {
  return page.locator(rootSelector).evaluate((root) => {
    const element = root as HTMLElement;
    const documentElement = document.documentElement;
    const rootTop = element.getBoundingClientRect().top + window.scrollY;
    const rect = (selector: string) =>
      element.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null;
    const offset = (selector: string) => {
      const bounds = rect(selector);
      return bounds ? Math.round(bounds.top + window.scrollY - rootTop) : null;
    };
    const visibleRegions = Array.from(
      element.querySelectorAll<HTMLElement>(
        ":scope > *, main > *, section, article, aside, header, [data-layout-region], [data-state-region], [data-cart-region]",
      ),
    )
      .map((node) => node.getBoundingClientRect())
      .filter(({ width, height }) => width > 0 && height > 0)
      .sort((left, right) => left.top - right.top);
    const gaps = visibleRegions
      .slice(1)
      .map((bounds, index) => Math.max(0, Math.round(bounds.top - visibleRegions[index].bottom)));
    const opening = rect(
      "[data-layout-region='opening'], [data-layout-region='hero'], main > header, [data-state-region='identity'], [data-cart-region='identity']",
    );
    const orientation = rect(
      "[data-layout-region='orientation'], [data-search-state-summary='true']",
    );
    const filter = rect("[data-layout-region='filters'], [data-filter-region]");
    const media = rect("[data-pdp-region='media'], [data-layout-region='media']");
    return {
      viewportWidth: window.innerWidth,
      documentWidth: documentElement.scrollWidth,
      documentHeight: documentElement.scrollHeight,
      horizontalOverflow: Math.max(0, documentElement.scrollWidth - window.innerWidth),
      largestEmptyVerticalGap: gaps.length > 0 ? Math.max(...gaps) : 0,
      openingHeight: opening ? Math.round(opening.height) : null,
      firstActionOffset: offset("a[href], button"),
      firstMerchandisingOffset: offset(
        "[data-component='homepageFeaturedProducts'], [data-component='homepageFeaturedCollections'], [data-product-card]",
      ),
      orientationHeight: orientation ? Math.round(orientation.height) : null,
      filterHeight: filter ? Math.round(filter.height) : null,
      firstCardOffset: offset("[data-product-card]"),
      mediaRegionHeight: media ? Math.round(media.height) : null,
      purchaseRegionOffset: offset("[data-pdp-region='purchase'], [data-purchase-region]"),
      firstOptionOffset: offset("[data-product-option], fieldset"),
      relatedMerchandisingOffset: offset("[data-pdp-region='related'], [data-related-products]"),
      meaningfulRegionCount: visibleRegions.length,
      primaryActionOffset: offset("[data-action-tone='primary'], [data-primary-action]"),
      cartLineCount: element.querySelectorAll("[data-cart-line]").length,
      cartSummaryOffset: offset("[data-cart-region='summary'], [data-cart-region='totals']"),
    };
  });
}

async function inspectProductCardActionIntersections(page: Page, rootSelector: string) {
  return page.locator(rootSelector).evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("article[data-card-anatomy]")].flatMap((card) => {
      const heading = card.querySelector<HTMLElement>('[data-card-region="heading"]');
      const action = card.querySelector<HTMLElement>('[data-card-region="actions"]');
      if (!heading || !action || action.getClientRects().length === 0) return [];
      const headingRect = heading.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();
      const intersects =
        headingRect.left < actionRect.right - 0.5 &&
        headingRect.right > actionRect.left + 0.5 &&
        headingRect.top < actionRect.bottom - 0.5 &&
        headingRect.bottom > actionRect.top + 0.5;
      return intersects
        ? [
            {
              anatomy: card.dataset.cardAnatomy ?? "unknown",
              context: card.dataset.cardContext ?? "unknown",
              productId: card.dataset.productId ?? "unknown",
              heading: {
                top: headingRect.top,
                right: headingRect.right,
                bottom: headingRect.bottom,
                left: headingRect.left,
              },
              action: {
                top: actionRect.top,
                right: actionRect.right,
                bottom: actionRect.bottom,
                left: actionRect.left,
              },
            },
          ]
        : [];
    }),
  );
}

async function inspectCaptureChrome(page: Page) {
  const selector = [
    "nextjs-portal",
    "#webpack-dev-server-client-overlay",
    "[data-nextjs-toast]",
    "[data-nextjs-dev-tools-button]",
    '[data-testid="editor-toolbar"]',
    '[data-testid="editor-context"]',
    "[data-studio-shell]",
    "[data-playwright-control]",
    "[data-acceptance-debug-overlay]",
  ].join(",");
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.map((node) => ({
      tagName: node.tagName.toLowerCase(),
      id: node.id,
      testId: node.getAttribute("data-testid"),
    })),
  );
}

async function assertCleanCaptureSurface(page: Page) {
  const chrome = await inspectCaptureChrome(page);
  if (chrome.length > 0) {
    throw new Error(
      `P10B-18C retained capture contains non-storefront chrome: ${JSON.stringify(chrome)}`,
    );
  }
}

async function inspectCustomerVisibleProvisionalText(page: Page, rootSelector: string) {
  return page.locator(rootSelector).evaluate((root) => {
    const content = (root.textContent ?? "").replace(/\s+/g, " ");
    return [
      ...content.matchAll(
        /verify (?:exact|live)|requires verification|not captured|reference configuration|exact specifications|natural or laboratory/gi,
      ),
    ].map(([match]) => match);
  });
}

async function assertCommercialSurfaceIntegrity(page: Page, rootSelector: string) {
  const [intersections, provisionalText] = await Promise.all([
    inspectProductCardActionIntersections(page, rootSelector),
    inspectCustomerVisibleProvisionalText(page, rootSelector),
  ]);
  expect(intersections).toEqual([]);
  expect(provisionalText).toEqual([]);
}

async function inspectAccessibility(page: Page, rootSelector: string): Promise<Accessibility> {
  return page.locator(rootSelector).evaluate((root) => {
    const element = root as HTMLElement;
    const controls = Array.from(
      element.querySelectorAll<HTMLElement>("a[href], button, input, select, summary"),
    ).filter((control) => control.getBoundingClientRect().width > 0);
    const dimensions = controls.map((control) => control.getBoundingClientRect());
    const animations = element.getAnimations({ subtree: true }).filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return animation.playState === "running" && Number(timing?.duration ?? 0) > 0;
    });
    return {
      headingCount: element.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
      h1Count: element.querySelectorAll("h1").length,
      landmarkCount: element.querySelectorAll("header, nav, main, footer").length,
      unnamedControlCount: controls.filter((control) => {
        const normalizeAccessibleName = (value: string | null | undefined): string =>
          (value ?? "").replace(/\s+/g, " ").trim();
        const labelledByIds = (control.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .filter(Boolean);
        const seenLabelledByIds = new Set<string>();
        const labelledBy = normalizeAccessibleName(
          labelledByIds
            .filter((id) => {
              if (seenLabelledByIds.has(id)) {
                return false;
              }
              seenLabelledByIds.add(id);
              return true;
            })
            .map((id) => control.ownerDocument.getElementById(id))
            .filter((reference): reference is HTMLElement => reference !== null)
            .map(
              (reference) =>
                normalizeAccessibleName(reference.getAttribute("aria-label")) ||
                normalizeAccessibleName(reference.textContent),
            )
            .filter(Boolean)
            .join(" "),
        );
        const ariaLabel = normalizeAccessibleName(control.getAttribute("aria-label"));
        const nativeLabels = Array.from(
          (
            control as HTMLElement & {
              labels?: NodeListOf<HTMLLabelElement> | null;
            }
          ).labels ?? [],
        );
        const explicitLabels = control.id
          ? Array.from(
              control.ownerDocument.querySelectorAll<HTMLLabelElement>("label[for]"),
            ).filter((label) => label.htmlFor === control.id)
          : [];
        const implicitLabel = control.closest("label");
        const associatedLabelElements = Array.from(
          new Set([...nativeLabels, ...explicitLabels, ...(implicitLabel ? [implicitLabel] : [])]),
        );
        const associatedLabels = normalizeAccessibleName(
          associatedLabelElements.map((label) => label.textContent ?? "").join(" "),
        );
        const role = control.getAttribute("role");
        const nativeText =
          control instanceof HTMLButtonElement ||
          control instanceof HTMLAnchorElement ||
          control.tagName === "SUMMARY" ||
          role === "button" ||
          role === "link" ||
          role === "menuitem" ||
          role === "tab"
            ? normalizeAccessibleName(control.textContent)
            : control instanceof HTMLInputElement && control.type === "image"
              ? normalizeAccessibleName(control.alt)
              : "";
        const buttonLikeInputValue =
          control instanceof HTMLInputElement &&
          ["button", "submit", "reset"].includes(control.type)
            ? normalizeAccessibleName(control.value)
            : "";
        const existingTruthfulFallback = normalizeAccessibleName(control.getAttribute("title"));
        const label =
          [
            labelledBy,
            ariaLabel,
            associatedLabels,
            nativeText,
            buttonLikeInputValue,
            existingTruthfulFallback,
          ].find(Boolean) ?? "";
        return label.trim().length === 0;
      }).length,
      missingAltCount: Array.from(element.querySelectorAll("img")).filter(
        (image) => !image.hasAttribute("alt"),
      ).length,
      disclosureCount: element.querySelectorAll("details > summary").length,
      minimumTouchWidth:
        dimensions.length > 0
          ? Math.round(Math.min(...dimensions.map(({ width }) => width)))
          : null,
      minimumTouchHeight:
        dimensions.length > 0
          ? Math.round(Math.min(...dimensions.map(({ height }) => height)))
          : null,
      reducedMotionActiveAnimationCount: animations.length,
    };
  });
}

function designDnaFingerprint(store: P10b18cMaterializedCase): string {
  return canonicalValueFingerprint(store.compiled.result.synthesisDecision.designDna);
}

async function baseCapture({
  page,
  store,
  manifest,
  diagnostics,
  surface,
  route,
  width,
  profileOrArchetype,
  caseSuffix,
  retainPresentationImageEvidence,
}: {
  page: Page;
  store: P10b18cMaterializedCase;
  manifest: P10B18AStoreManifestEntry;
  diagnostics: P10B18CActiveCaptureEvidence;
  surface: P10B18ASurface;
  route: string;
  width: P10B18AWidth;
  profileOrArchetype: string;
  caseSuffix?: string;
  retainPresentationImageEvidence?: boolean;
}): Promise<BrowserCapture> {
  const { captureStore, expectation } = baseCapturePlanEntry({
    store,
    manifest,
    surface,
    route,
    width,
    caseSuffix,
  });
  return diagnostics.runCapture({
    page,
    identity: expectation.identity,
    presentationImageAuthorities: p10b18cPresentationImageAuthorities(store.snapshot, surface),
    retainPresentationImageEvidence,
    execute: async (onLifecycle, activeIdentity) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const base = await captureP10B18AEvidence({
        page,
        store: captureStore,
        surface,
        route,
        width,
        profileOrArchetype,
        onLifecycle,
        canonicalFilename: activeIdentity.canonicalFilename,
        beforeScreenshot: async (capturePage) => {
          await assertCleanCaptureSurface(capturePage);
          await assertCommercialSurfaceIntegrity(capturePage, ".project-preview__storefront");
        },
      });
      const image = await readFile(resolve(p10b18aEvidenceDirectory(), base.filename));
      const geometry = await inspectGeometry(page, ".project-preview__storefront");
      const accessibility = await inspectAccessibility(page, ".project-preview__storefront");
      expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(accessibility.headingCount).toBeGreaterThan(0);
      expect(accessibility.landmarkCount).toBeGreaterThanOrEqual(3);
      expect(accessibility.unnamedControlCount).toBe(0);
      expect(accessibility.missingAltCount).toBe(0);
      return {
        filename: base.filename,
        screenshotSha256: sha256(image),
        caseId: store.compiled.caseId,
        shapeId: store.compiled.authority.id,
        semanticIntent: store.compiled.stratum.id,
        directionId: store.directionId,
        designDnaFingerprint: designDnaFingerprint(store),
        frame: manifest.frame,
        profiles: store.profiles,
        contentSupportEffectiveAnatomy: store.normalizedTopology.effectiveContentSupportAnatomy,
        utilityAnatomy: store.normalizedTopology.utilityAnatomy,
        productCardAnatomy: store.normalizedTopology.canonicalCardAnatomies,
        assetAuthority: store.compiled.result.synthesisDecision.approvedAssetRoleSelections,
        viewport: width,
        locale: store.locale,
        surface,
        route,
        renderer: "saved-draft-preview" as const,
        snapshotFingerprint: store.fingerprints.snapshot,
        consumedAuthorityFingerprint: store.fingerprints.consumedAuthority,
        normalizedTopologyFingerprint: store.fingerprints.normalizedTopology,
        domFingerprint: base.domTopologyFingerprint,
        geometry,
        accessibility,
        commerceFingerprint: store.fingerprints.commerceAfter,
        mediaFingerprint: store.fingerprints.mediaAfter,
      };
    },
  });
}

function searchRequest(rawQuery: string, locale: "en" | "fi"): StorefrontSearchRequestV1 {
  return {
    contractVersion: STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
    rawQuery,
    locale,
    page: 1,
    pageSize: 24,
    sort: "relevance",
    filters: [],
  };
}

function searchQuery(store: P10b18cMaterializedCase, mode: SearchMode) {
  const catalogue = store.compiled.authority.catalogue;
  const productRoutes =
    store.snapshot.dynamicCommercePresentation?.routeInventory.flatMap((route) =>
      route.kind === "product" ? [{ productId: route.productId, route: route.route }] : [],
    ) ?? [];
  const authority = createStandaloneStorefrontSearchAuthority({
    catalogue,
    primaryLocale: store.aggregate.project.primaryLocale,
    enabledLocales: store.aggregate.project.enabledLocales,
    productRoutes,
  });
  const adapter = createStandaloneCatalogueProductSearchAdapter({ catalogue });
  const terms = [
    "Lumoava",
    "Kohinoor",
    ...catalogue.products.flatMap((product) =>
      [product.title[store.locale], product.productType]
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => value.split(/\s+/gu))
        .map((value) => value.replace(/[^\p{L}\p{N}-]/gu, ""))
        .filter((value) => value.length >= 3),
    ),
  ];
  const candidates = [...new Set(terms)];
  if (mode === "zero") {
    const rawQuery = "zzzz-p10b18c-no-result";
    return {
      rawQuery,
      resultCount: adapter.search(searchRequest(rawQuery, store.locale), authority).productIds
        .length,
    };
  }
  const desired = mode === "one" ? (count: number) => count === 1 : (count: number) => count > 1;
  for (const rawQuery of candidates) {
    const resultCount = adapter.search(searchRequest(rawQuery, store.locale), authority).productIds
      .length;
    if (desired(resultCount)) return { rawQuery, resultCount };
  }
  throw new Error(`${store.compiled.caseId} has no deterministic ${mode} search query.`);
}

async function proofCapture({
  page,
  store,
  diagnostics,
  kind,
  id,
  route,
  selector,
  width,
}: {
  page: Page;
  store: P10b18cMaterializedCase;
  diagnostics: P10B18CActiveCaptureEvidence;
  kind: "content" | "utility";
  id: string;
  route: string;
  selector: string;
  width: 375 | 1440;
}): Promise<BrowserCapture> {
  const url = `${p10b18aOrigin("p03-standalone")}${route}`;
  const logicalFilename = `p10b-18c-proof-captures/${safeName(
    `${store.compiled.caseId}-${kind}-${id}-${width}px`,
  )}.png`;
  const expectation: P10B18CCaptureResumeExpectation = {
    identity: {
      caseId: store.compiled.caseId,
      semanticStratum: store.compiled.stratum.id,
      surfacePageType: `${kind}:${id}`,
      expectedRoute: route,
      expectedUrl: url,
      viewport: { width, height: width === 375 ? 900 : 1_000 },
      locale: store.locale,
      renderer: "production-disabled-proof",
      runtimeMode: "p03-standalone",
      selectedSnapshotFingerprint: store.fingerprints.snapshot,
      normalizedTopologyFingerprint: store.fingerprints.normalizedTopology,
      logicalFilename,
    },
    canonicalFilename: canonicalP10BEvidenceFilename(logicalFilename),
    consumedAuthorityFingerprint: store.fingerprints.consumedAuthority,
  };
  return diagnostics.runCapture({
    page,
    identity: expectation.identity,
    execute: async (onLifecycle, activeIdentity) => {
      await page.setViewportSize({ width, height: width === 375 ? 900 : 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await onLifecycle({
        state: "navigation-started",
        expectedUrl: url,
        actualUrl: page.url(),
        httpStatus: null,
      });
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await onLifecycle({
        state: "response-received",
        expectedUrl: url,
        actualUrl: page.url(),
        httpStatus: response?.status() ?? null,
      });
      expect(response?.ok()).toBe(true);
      const root = page.locator(selector);
      await page.waitForFunction(
        (expectedSelector) => {
          if (document.querySelector(expectedSelector)) return true;
          return Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).some(
            (heading) =>
              heading.textContent?.replace(/\s+/gu, " ").trim() === "This page couldn’t load" &&
              (heading as HTMLElement).getClientRects().length > 0,
          );
        },
        selector,
        { timeout: 120_000 },
      );
      const runtimeBoundary = page
        .getByRole("heading", { name: "This page couldn’t load", exact: true })
        .first();
      if (await runtimeBoundary.isVisible().catch(() => false)) {
        throw new Error('P10B-18C proof rendered the visible "This page couldn’t load" boundary.');
      }
      await root.waitFor({ state: "visible", timeout: 120_000 });
      await page.waitForFunction(() => document.readyState === "complete", undefined, {
        timeout: 120_000,
      });
      await onLifecycle({
        state: "storefront-ready",
        expectedUrl: url,
        actualUrl: page.url(),
        httpStatus: response?.status() ?? null,
      });
      const screenshotPath = resolve(p10b18aEvidenceDirectory(), activeIdentity.expectedPath);
      await mkdir(resolve(screenshotPath, ".."), { recursive: true });
      await assertCleanCaptureSurface(page);
      await assertCommercialSurfaceIntegrity(page, selector);
      await onLifecycle({
        state: "capture-started",
        expectedUrl: url,
        actualUrl: page.url(),
        httpStatus: response?.status() ?? null,
      });
      const image = await page.screenshot({
        animations: "disabled",
        caret: "hide",
        fullPage: true,
      });
      await writeFile(screenshotPath, image);
      const geometry = await inspectGeometry(page, selector);
      const accessibility = await inspectAccessibility(page, selector);
      expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(accessibility.headingCount).toBeGreaterThan(0);
      expect(accessibility.unnamedControlCount).toBe(0);
      expect(accessibility.missingAltCount).toBe(0);
      const domFingerprint = await root.evaluate((element) => {
        const nodes = Array.from(element.querySelectorAll("*")).map((node) => ({
          tag: node.tagName.toLowerCase(),
          component: node.getAttribute("data-component"),
          region:
            node.getAttribute("data-layout-region") ??
            node.getAttribute("data-state-region") ??
            node.getAttribute("data-cart-region"),
          variant: node.getAttribute("data-variant"),
          state: node.getAttribute("data-utility-state"),
        }));
        return JSON.stringify(nodes);
      });
      return {
        filename: activeIdentity.canonicalFilename,
        screenshotSha256: sha256(image),
        caseId: store.compiled.caseId,
        shapeId: store.compiled.authority.id,
        semanticIntent: store.compiled.stratum.id,
        directionId: store.directionId,
        designDnaFingerprint: designDnaFingerprint(store),
        frame: store.compiled.result.synthesisDecision.sharedFrame.profileId,
        profiles: store.profiles,
        contentSupportEffectiveAnatomy: store.normalizedTopology.effectiveContentSupportAnatomy,
        utilityAnatomy: store.normalizedTopology.utilityAnatomy,
        productCardAnatomy: store.normalizedTopology.canonicalCardAnatomies,
        assetAuthority: store.compiled.result.synthesisDecision.approvedAssetRoleSelections,
        viewport: width,
        locale: store.locale,
        surface: `${kind}:${id}`,
        route,
        renderer: "production-disabled-proof" as const,
        snapshotFingerprint: store.fingerprints.snapshot,
        consumedAuthorityFingerprint: store.fingerprints.consumedAuthority,
        normalizedTopologyFingerprint: store.fingerprints.normalizedTopology,
        domFingerprint: `p10b18c-proof-dom-${canonicalValueFingerprint(domFingerprint)}`,
        geometry,
        accessibility,
        commerceFingerprint: store.fingerprints.commerceAfter,
        mediaFingerprint: store.fingerprints.mediaAfter,
      };
    },
  });
}

function buildCapturePlan(input: {
  selected: readonly P10b18cSelectedStore[];
  searchStores: readonly P10b18cSelectedStore[];
  contentUtilityStores: readonly P10b18cSelectedStore[];
  tabletStores: readonly P10b18cSelectedStore[];
}): readonly P10B18CCaptureResumeExpectation[] {
  const plan: P10B18CCaptureResumeExpectation[] = [];
  const searchModeByCase = new Map(
    input.searchStores.map(({ store }, index) => [
      store.compiled.caseId,
      (["multiple", "one", "zero"] as const)[index % 3],
    ]),
  );
  const tabletIds = new Set(input.tabletStores.map(({ store }) => store.compiled.caseId));
  for (const runtimeAuthority of ["p03-standalone", "p04-integrated-mock"] as const) {
    for (const { store } of input.selected.filter(
      (entry) => entry.store.runtimeAuthority === runtimeAuthority,
    )) {
      const manifest = storeManifest(store);
      const coreSurfaces = [
        { surface: "home", route: "/", profile: store.profiles.homepage },
        {
          surface: "collection",
          route: store.representativeRoutes.collection,
          profile: store.representativeContext.collectionArchetype,
        },
        {
          surface: "product-detail",
          route: store.representativeRoutes.productDetail,
          profile: store.representativeContext.productArchetype,
        },
      ] as const;
      for (const width of [375, 1440] as const) {
        for (const surface of coreSurfaces) {
          plan.push(
            baseCapturePlanEntry({
              store,
              manifest,
              surface: surface.surface,
              route: surface.route,
              width,
            }).expectation,
          );
        }
      }
      const searchMode = searchModeByCase.get(store.compiled.caseId);
      if (searchMode) {
        const search = searchQuery(store, searchMode);
        const route = `/search?q=${encodeURIComponent(search.rawQuery)}`;
        for (const width of [375, 1440] as const) {
          plan.push(
            baseCapturePlanEntry({
              store,
              manifest,
              surface: "search",
              route,
              width,
              caseSuffix: `search-${searchMode}`,
            }).expectation,
          );
        }
      }
      if (tabletIds.has(store.compiled.caseId)) {
        for (const width of [768, 1024] as const) {
          for (const surface of coreSurfaces) {
            plan.push(
              baseCapturePlanEntry({
                store,
                manifest,
                surface: surface.surface,
                route: surface.route,
                width,
                caseSuffix: `intermediate-${width}`,
              }).expectation,
            );
          }
        }
      }
    }
  }
  for (let index = 0; index < input.contentUtilityStores.length; index += 1) {
    const store = input.contentUtilityStores[index].store;
    const content = contentProofPlan[index];
    const utility = utilityProofPlan[index];
    for (const width of [375, 1440] as const) {
      const contentRoute = `/p10b-12-content-support-proof?${query({
        profile: content.profile,
        family: "family" in content ? content.family : undefined,
        locale: store.locale,
        media: "media" in content ? content.media : undefined,
        action: "action" in content ? content.action : undefined,
      })}`;
      const contentLogicalFilename = `p10b-18c-proof-captures/${safeName(
        `${store.compiled.caseId}-content-${content.id}-${width}px`,
      )}.png`;
      plan.push({
        identity: {
          caseId: store.compiled.caseId,
          semanticStratum: store.compiled.stratum.id,
          surfacePageType: `content:${content.id}`,
          expectedRoute: contentRoute,
          expectedUrl: `${p10b18aOrigin("p03-standalone")}${contentRoute}`,
          viewport: { width, height: width === 375 ? 900 : 1_000 },
          locale: store.locale,
          renderer: "production-disabled-proof",
          runtimeMode: "p03-standalone",
          selectedSnapshotFingerprint: store.fingerprints.snapshot,
          normalizedTopologyFingerprint: store.fingerprints.normalizedTopology,
          logicalFilename: contentLogicalFilename,
        },
        canonicalFilename: canonicalP10BEvidenceFilename(contentLogicalFilename),
        consumedAuthorityFingerprint: store.fingerprints.consumedAuthority,
      });
      const utilityRoute = `/p10b-13-utility-proof?${query({
        profile: utility.profile,
        scenario: "scenario" in utility ? utility.scenario : undefined,
        locale: store.locale,
        capabilities: "capabilities" in utility ? utility.capabilities : undefined,
      })}`;
      const utilityLogicalFilename = `p10b-18c-proof-captures/${safeName(
        `${store.compiled.caseId}-utility-${utility.id}-${width}px`,
      )}.png`;
      plan.push({
        identity: {
          caseId: store.compiled.caseId,
          semanticStratum: store.compiled.stratum.id,
          surfacePageType: `utility:${utility.id}`,
          expectedRoute: utilityRoute,
          expectedUrl: `${p10b18aOrigin("p03-standalone")}${utilityRoute}`,
          viewport: { width, height: width === 375 ? 900 : 1_000 },
          locale: store.locale,
          renderer: "production-disabled-proof",
          runtimeMode: "p03-standalone",
          selectedSnapshotFingerprint: store.fingerprints.snapshot,
          normalizedTopologyFingerprint: store.fingerprints.normalizedTopology,
          logicalFilename: utilityLogicalFilename,
        },
        canonicalFilename: canonicalP10BEvidenceFilename(utilityLogicalFilename),
        consumedAuthorityFingerprint: store.fingerprints.consumedAuthority,
      });
    }
  }
  return plan;
}

test.describe.configure({ timeout: P10B18C_STAGE_B_BROWSER_TIMEOUT_MS });

test("retains the deterministic 28-store, 280-capture commercial quality review", async ({
  browser,
  browserName,
}, testInfo: TestInfo) => {
  test.skip(browserName !== "chromium", "P10B-18C retains one deterministic Chromium review.");
  const preCaptureStorageEvidence = assertP10B18CStageBFreeSpace({
    roots: p10b18cStageBStorageRootsFromEnvironment(p10b18aEvidenceDirectory()),
    phase: "full-stage-b-precapture",
  });
  await writeFile(
    resolve(p10b18aEvidenceDirectory(), "p10b-18c-full-stage-b-precapture-storage-evidence.json"),
    `${JSON.stringify(preCaptureStorageEvidence, null, 2)}\n`,
    "utf8",
  );
  const matrix = buildP10b18cMatrix();
  expect(matrix.cases).toHaveLength(126);
  expect(matrix.failures).toEqual([]);
  const selected = selectP10b18cHumanStores(matrix.cases);
  const searchStores = selectP10b18cSearchStores(selected);
  const contentUtilityStores = selectP10b18cContentUtilityStores(selected);
  const tabletStores = selectP10b18cTabletStores(selected);
  expect(selected).toHaveLength(28);
  expect(searchStores).toHaveLength(14);
  expect(contentUtilityStores).toHaveLength(12);
  expect(tabletStores).toHaveLength(6);

  const capturePlan = buildCapturePlan({
    selected,
    searchStores,
    contentUtilityStores,
    tabletStores,
  });
  expect(capturePlan).toHaveLength(280);
  const rendererAuthorityFingerprint = await p10b18cRendererAuthorityFingerprint();
  const diagnostics = new P10B18CActiveCaptureEvidence(p10b18aEvidenceDirectory());
  const deltaBaselineManifestPath = process.env.P10B18C_DELTA_BASELINE_MANIFEST;
  const deltaBaselineHumanReviewPath = process.env.P10B18C_DELTA_BASELINE_HUMAN_REVIEW;
  if ((deltaBaselineManifestPath === undefined) !== (deltaBaselineHumanReviewPath === undefined)) {
    throw new Error("P10B-18C delta Stage B requires both baseline manifest and review paths.");
  }
  const resumeCountValue = process.env.P10B18C_RESUME_COMPLETED_CAPTURE_COUNT;
  const resumeCount = resumeCountValue === undefined ? 0 : Number(resumeCountValue);
  if (!Number.isInteger(resumeCount) || resumeCount < 0 || resumeCount >= capturePlan.length) {
    throw new Error("P10B-18C resume count must be an integer between zero and 279.");
  }
  if (resumeCount > 0 && deltaBaselineManifestPath !== undefined) {
    throw new Error("P10B-18C delta Stage B cannot be combined with prefix resume mode.");
  }
  let deltaStageB: P10B18CDeltaStageBResult | null = null;
  if (deltaBaselineManifestPath !== undefined && deltaBaselineHumanReviewPath !== undefined) {
    deltaStageB = await prepareP10B18CDeltaStageB({
      baselineManifestPath: deltaBaselineManifestPath,
      baselineHumanReviewPath: deltaBaselineHumanReviewPath,
      evidenceDirectory: p10b18aEvidenceDirectory(),
      capturePlan,
      currentRendererAuthorityFingerprint: rendererAuthorityFingerprint,
      storageRoots: p10b18cStageBStorageRootsFromEnvironment(p10b18aEvidenceDirectory()),
    });
  }
  let resumedCaptures: readonly BrowserCapture[] = [];
  if (resumeCount > 0) {
    const expectedNextEntry = capturePlan[resumeCount];
    if (!expectedNextEntry) throw new Error("P10B-18C resume lacks its exact next capture.");
    const audit = await diagnostics.auditAndPrepareResume({
      expectedCompletedCaptureCount: resumeCount,
      expectedEntries: capturePlan.slice(0, resumeCount),
      expectedNextEntry,
    });
    resumedCaptures = audit.manifestEntries.map(requireBrowserCapture);
  }

  const context = await browser.newContext({ baseURL: p10b18aOrigin() });
  const page = await context.newPage();
  const ledger = await installP10B18AOfflineAuthority(page, {
    p04AcceptanceToken: p10b18cP04PageAcceptanceToken(),
  });
  const captures: BrowserCapture[] = [];
  const storage: Array<{
    caseId: string;
    seeded: string;
    reloaded: string;
    transientRuntimePersisted: boolean;
  }> = [];
  const searchModeByCase = new Map(
    searchStores.map(({ store }, index) => [
      store.compiled.caseId,
      (["multiple", "one", "zero"] as const)[index % 3],
    ]),
  );
  const tabletIds = new Set(tabletStores.map(({ store }) => store.compiled.caseId));
  const firstCaptureSmoke = process.env.P10B18C_FIRST_CAPTURE_SMOKE === "1";
  if (firstCaptureSmoke && resumeCount > 0) {
    throw new Error("P10B-18C first-capture smoke cannot reuse a resumed manifest.");
  }
  let captureCursor = 0;
  const runPlannedCapture = async (
    execute: () => Promise<BrowserCapture>,
  ): Promise<Readonly<{ capture: BrowserCapture; reused: boolean }>> => {
    const expected = capturePlan[captureCursor];
    if (!expected) throw new Error(`P10B-18C capture ${captureCursor + 1} is outside the plan.`);
    const deltaCaptureValue = deltaStageB?.carriedCapturesByFilename.get(
      expected.canonicalFilename,
    );
    const deltaCapture =
      deltaCaptureValue === undefined
        ? undefined
        : requireBrowserCapture(deltaCaptureValue, captureCursor);
    const reused = captureCursor < resumeCount || deltaCapture !== undefined;
    const capture =
      deltaCapture ??
      (captureCursor < resumeCount ? resumedCaptures[captureCursor] : await execute());
    if (!capture) throw new Error(`P10B-18C capture ${captureCursor + 1} is missing.`);
    expect(capture).toMatchObject({
      filename: expected.canonicalFilename,
      caseId: expected.identity.caseId,
      surface: expected.identity.surfacePageType,
      route: expected.identity.expectedRoute,
      viewport: expected.identity.viewport.width,
      locale: expected.identity.locale,
      renderer: expected.identity.renderer,
      snapshotFingerprint: expected.identity.selectedSnapshotFingerprint,
      consumedAuthorityFingerprint: expected.consumedAuthorityFingerprint,
      normalizedTopologyFingerprint: expected.identity.normalizedTopologyFingerprint,
    });
    captureCursor += 1;
    return { capture, reused };
  };
  try {
    for (const runtimeAuthority of ["p03-standalone", "p04-integrated-mock"] as const) {
      await initializeP10B18AStorage(page, runtimeAuthority);
      for (const selectedEntry of selected.filter(
        ({ store }) => store.runtimeAuthority === runtimeAuthority,
      )) {
        const store = selectedEntry.store;
        const manifest = storeManifest(store);
        const seeded = await seedP10B18AAggregate(page, store.aggregate, runtimeAuthority);
        const seededAggregate = validateProjectAggregate({
          project: projectSchema.parse(seeded.project),
          catalogue: catalogueDisplayModelSchema.parse(seeded.catalogue),
          snapshots: storefrontSnapshotSchema.array().parse(seeded.snapshots),
        });
        const persisted = seededAggregate.snapshots.find(
          ({ id }) => id === seededAggregate.project.draftSnapshotId,
        );
        if (!persisted) throw new Error(`${store.compiled.caseId} lacks seeded draft.`);
        expect(canonicalStorefrontContentFingerprint(persisted)).toBe(store.fingerprints.snapshot);

        const coreSurfaces: readonly {
          surface: CoreSurface;
          route: string;
          profile: string;
        }[] = [
          { surface: "home", route: "/", profile: store.profiles.homepage },
          {
            surface: "collection",
            route: store.representativeRoutes.collection,
            profile: store.representativeContext.collectionArchetype,
          },
          {
            surface: "product-detail",
            route: store.representativeRoutes.productDetail,
            profile: store.representativeContext.productArchetype,
          },
        ];
        for (const width of [375, 1440] as const) {
          for (const surface of coreSurfaces) {
            const { capture } = await runPlannedCapture(() =>
              baseCapture({
                page,
                store,
                manifest,
                diagnostics,
                surface: surface.surface,
                route: surface.route,
                width,
                profileOrArchetype: surface.profile,
              }),
            );
            captures.push(capture);
            if (firstCaptureSmoke) {
              expect(captures).toHaveLength(1);
              expect(
                JSON.parse(await readFile(diagnostics.captureProgressPath(), "utf8")) as unknown,
              ).toMatchObject({
                completedCaptureCount: 1,
                entries: [
                  {
                    identity: {
                      logicalFilename: expect.any(String),
                      canonicalFilename: capture.filename,
                      expectedPath: capture.filename,
                      sequenceIndex: 1,
                    },
                    manifestEntry: { filename: capture.filename },
                    captureEventLedger: { blockingRuntimeFailures: [] },
                  },
                ],
              });
              expect(
                JSON.parse(await readFile(diagnostics.activeCapturePath(), "utf8")) as unknown,
              ).toMatchObject({
                activeCapture: null,
                lastCompletedCapture: {
                  identity: { canonicalFilename: capture.filename, sequenceIndex: 1 },
                  lifecycle: {
                    currentStage: "capture-complete",
                    reachedStages: [
                      { state: "planned", timestamp: expect.any(String) },
                      { state: "navigation-started", timestamp: expect.any(String) },
                      { state: "response-received", timestamp: expect.any(String) },
                      { state: "storefront-ready", timestamp: expect.any(String) },
                      { state: "capture-started", timestamp: expect.any(String) },
                      { state: "capture-complete", timestamp: expect.any(String) },
                    ],
                  },
                  persistence: {
                    actualPath: capture.filename,
                    screenshotWrittenAt: expect.any(String),
                    manifestPersistedAt: expect.any(String),
                  },
                },
              });
              expect(
                JSON.parse(await readFile(diagnostics.setupEventLedgerPath(), "utf8")) as unknown,
              ).toMatchObject({
                entries: [
                  {
                    captureSequenceIndex: 1,
                    classification: "harness/setup events outside the active capture interval",
                  },
                ],
              });
              return;
            }
          }
        }

        const searchMode = searchModeByCase.get(store.compiled.caseId);
        if (searchMode) {
          const search = searchQuery(store, searchMode);
          const route = `/search?q=${encodeURIComponent(search.rawQuery)}`;
          for (const width of [375, 1440] as const) {
            const { capture, reused } = await runPlannedCapture(() =>
              baseCapture({
                page,
                store,
                manifest,
                diagnostics,
                surface: "search",
                route,
                width,
                profileOrArchetype: store.archetypes.search,
                caseSuffix: `search-${searchMode}`,
              }),
            );
            if (!reused) {
              const renderedCount = await page
                .locator("[data-search-result-count]")
                .getAttribute("data-search-result-count");
              expect(Number(renderedCount)).toBe(search.resultCount);
            }
            captures.push(capture);
          }
        }

        if (tabletIds.has(store.compiled.caseId)) {
          for (const width of [768, 1024] as const) {
            for (const surface of coreSurfaces) {
              const { capture } = await runPlannedCapture(() =>
                baseCapture({
                  page,
                  store,
                  manifest,
                  diagnostics,
                  surface: surface.surface,
                  route: surface.route,
                  width,
                  profileOrArchetype: surface.profile,
                  caseSuffix: `intermediate-${width}`,
                }),
              );
              captures.push(capture);
            }
          }
        }

        const retained = await readP10B18AAggregate(
          page,
          store.aggregate.project.id,
          store.aggregate.catalogue.id,
          runtimeAuthority,
        );
        const retainedAggregate = validateProjectAggregate({
          project: projectSchema.parse(retained.project),
          catalogue: catalogueDisplayModelSchema.parse(retained.catalogue),
          snapshots: storefrontSnapshotSchema.array().parse(retained.snapshots),
        });
        const reloadedDraft = retainedAggregate.snapshots.find(
          ({ id }) => id === retainedAggregate.project.draftSnapshotId,
        );
        if (!reloadedDraft) throw new Error(`${store.compiled.caseId} lacks reloaded draft.`);
        const serialized = canonicalValueString(retainedAggregate);
        storage.push({
          caseId: store.compiled.caseId,
          seeded: canonicalStorefrontContentFingerprint(persisted),
          reloaded: canonicalStorefrontContentFingerprint(reloadedDraft),
          transientRuntimePersisted:
            serialized.includes("p10b18c-runtime-transient") ||
            serialized.includes("zzzz-p10b18c-no-result"),
        });
      }
    }

    for (let index = 0; index < contentUtilityStores.length; index += 1) {
      const selectedEntry = contentUtilityStores[index];
      const store = selectedEntry.store;
      const content = contentProofPlan[index];
      const utility = utilityProofPlan[index];
      for (const width of [375, 1440] as const) {
        const contentRoute = `/p10b-12-content-support-proof?${query({
          profile: content.profile,
          family: "family" in content ? content.family : undefined,
          locale: store.locale,
          media: "media" in content ? content.media : undefined,
          action: "action" in content ? content.action : undefined,
        })}`;
        const { capture: contentCapture, reused: contentReused } = await runPlannedCapture(() =>
          proofCapture({
            page,
            store,
            diagnostics,
            kind: "content",
            id: content.id,
            route: contentRoute,
            selector: "[data-component='contentSupport']",
            width,
          }),
        );
        if (!contentReused && content.profile === "landing-campaign-image-led") {
          await expect(page.locator("[data-component='contentSupport'] img")).toHaveCount(1);
        }
        captures.push(contentCapture);

        const utilityRoute = `/p10b-13-utility-proof?${query({
          profile: utility.profile,
          scenario: "scenario" in utility ? utility.scenario : undefined,
          locale: store.locale,
          capabilities: "capabilities" in utility ? utility.capabilities : undefined,
        })}`;
        const { capture: utilityCapture, reused: utilityReused } = await runPlannedCapture(() =>
          proofCapture({
            page,
            store,
            diagnostics,
            kind: "utility",
            id: utility.id,
            route: utilityRoute,
            selector: "[data-utility-state]",
            width,
          }),
        );
        if (!utilityReused) {
          const utilityState = page.locator("[data-utility-state]");
          await expect(utilityState).toHaveAttribute("data-utility-state", utility.state);
          expect(
            await utilityState.locator("[data-action-tone='primary']").count(),
          ).toBeLessThanOrEqual(1);
          if (utility.state === "loading") {
            await expect(utilityState).toHaveAttribute("role", "status");
            await expect(utilityState).toHaveAttribute("aria-live", "polite");
            await expect(utilityState).toHaveAttribute("aria-busy", "true");
          }
          if (utility.state === "error") {
            await expect(utilityState).toHaveAttribute("role", "alert");
            await expect(utilityState).toHaveAttribute("aria-live", "assertive");
          }
          if ("capabilities" in utility && utility.capabilities === "none") {
            await expect(utilityState.locator("[data-utility-action]")).toHaveCount(0);
          }
        }
        captures.push(utilityCapture);
      }
    }
  } finally {
    await context.close();
  }

  expect(captures).toHaveLength(280);
  expect(captureCursor).toBe(capturePlan.length);
  expect(captures.filter(({ renderer }) => renderer === "saved-draft-preview")).toHaveLength(232);
  expect(captures.filter(({ renderer }) => renderer === "production-disabled-proof")).toHaveLength(
    48,
  );
  expect(new Set(captures.map(({ filename }) => filename)).size).toBe(280);
  expect(new Set(captures.map(({ screenshotSha256 }) => screenshotSha256)).size).toBeGreaterThan(1);
  expect(storage).toHaveLength(28);
  expect(storage.every(({ seeded, reloaded }) => seeded === reloaded)).toBe(true);
  expect(storage.every(({ transientRuntimePersisted }) => !transientRuntimePersisted)).toBe(true);
  expect(ledger).toEqual({
    external: [],
    provider: [],
    Vesko: [],
    generation: [],
    publication: [],
    runtimeErrors: [],
  });
  if (deltaStageB !== null) {
    expect(deltaStageB.carriedCaptureCount + deltaStageB.regeneratedCaptureCount).toBe(280);
    expect(deltaStageB.changedCaseIds).toEqual([
      "neutral-true-high-consideration--minimal-product-first",
      "neutral-true-high-consideration--modern-balanced-utility",
    ]);
    expect(deltaStageB.carriedCaptureCount).toBe(268);
    expect(deltaStageB.regeneratedCaptureCount).toBe(12);
  }

  const causality = p10b18cSemanticCausality(matrix.cases).map((witness) => {
    const renderFingerprint = (caseId: string | null) =>
      captures
        .filter(
          (capture) =>
            capture.caseId === caseId &&
            capture.renderer === "saved-draft-preview" &&
            capture.viewport === 1440 &&
            ["home", "collection", "product-detail"].includes(capture.surface),
        )
        .map(({ surface, domFingerprint, screenshotSha256 }) => ({
          surface,
          domFingerprint,
          screenshotSha256,
        }));
    const a = renderFingerprint(witness.aCase);
    const b = renderFingerprint(witness.bCase);
    return {
      ...witness,
      renderDelta:
        a.length > 0 && b.length > 0
          ? canonicalValueFingerprint(a) !== canonicalValueFingerprint(b)
          : "not-retained",
      renderedA: a,
      renderedB: b,
    };
  });
  expect(causality.every(({ renderDelta }) => renderDelta !== "not-retained")).toBe(true);

  const manifest = {
    contractVersion: "p10b-18c-commercial-quality-browser-manifest-v1",
    runId: p10b18aEvidenceRunId(),
    fixtureClassification:
      "production-disabled deterministic P10B-18A catalogue/evidence authority; never real merchant evidence",
    rendererAuthority: {
      completeStores: "current canonical saved-draft preview routes",
      transientUtilities:
        "accepted P10B-12/P10B-13 production-disabled proof routes; runtime state is deliberately not injected into StorefrontSnapshot",
    },
    rendererAuthorityFingerprint,
    selectionAlgorithm:
      "deterministic material-authority set cover, cluster medoids, same-direction alternatives, near-duplicate witnesses, outliers, rich/sparse authority and stable case-ID tie-break",
    selectedStoreCount: selected.length,
    captureCount: captures.length,
    capturePlan: {
      core: 168,
      search: 28,
      contentSupportAndUtility: 48,
      intermediateWidths: 36,
      total: 280,
    },
    selectedStores: selected.map(({ store, reasons }) => ({
      ...p10b18cSerializableCase(store),
      reasons,
    })),
    searchCases: searchStores.map(({ store }) => ({
      caseId: store.compiled.caseId,
      mode: searchModeByCase.get(store.compiled.caseId),
    })),
    contentUtilityCases: contentUtilityStores.map(({ store }, index) => ({
      caseId: store.compiled.caseId,
      content: contentProofPlan[index],
      utility: utilityProofPlan[index],
    })),
    tabletCases: tabletStores.map(({ store }) => store.compiled.caseId),
    expandedMatrixMetrics: p10b18cClusterMetrics(matrix.cases),
    duplicateAnalysis: p10b18cDuplicateAnalysis(matrix.cases),
    semanticCausality: causality,
    preCaptureStorageEvidence,
    storage,
    captures: [...captures].sort((left, right) => left.filename.localeCompare(right.filename)),
    requestErrorLedger: ledger,
    deltaStageB:
      deltaStageB === null
        ? null
        : {
            classification: "authority-and-hash-bound delta Stage B",
            changedCaseIds: deltaStageB.changedCaseIds,
            carriedCaptureCount: deltaStageB.carriedCaptureCount,
            regeneratedCaptureCount: deltaStageB.regeneratedCaptureCount,
            storageRequirement: deltaStageB.storageRequirement,
            storageEvidence: deltaStageB.storageEvidence,
            auditPath: deltaStageB.auditPath,
            auditFingerprint: deltaStageB.auditFingerprint,
          },
    externalProviderCalls: 0,
    VeskoCalls: 0,
    realPublications: 0,
  };
  const manifestPath = resolve(
    p10b18aEvidenceDirectory(),
    "p10b-18c-commercial-quality-browser-manifest.json",
  );
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await testInfo.attach("P10B-18C browser manifest", {
    path: manifestPath,
    contentType: "application/json",
  });
});

if (
  process.env.P10B18C_CAPTURE_122_DIAGNOSIS === "1" ||
  process.env.P10B18C_CAPTURE_122_SMOKE === "1"
) {
  test("diagnoses the exact capture-122 production search logo request chain", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Capture 122 retains one Chromium witness.");
    test.setTimeout(900_000);
    const authority = createP10b18aShapeAuthorities(["aurum-approved-presentation-image-rich"])[0];
    const stratum = p10b18cSemanticStrata.find(({ id }) => id === "minimal-balanced-guided");
    expect(authority).toBeDefined();
    expect(stratum).toBeDefined();
    if (!authority || !stratum) return;
    const store = materializeP10b18cCase(compileP10b18cCase(authority, stratum));
    expect(store.compiled.caseId).toBe(
      "aurum-approved-presentation-image-rich--minimal-balanced-guided",
    );
    expect(store.runtimeAuthority).toBe("p04-integrated-mock");
    expect(store.locale).toBe("en");
    const logoAuthority = p10b18cSharedFrameLogoAuthority(store.snapshot);
    expect(logoAuthority).toMatchObject({
      assetId: "asset_p10b18b06_aurum_logo",
      materialFingerprint: "p10b18b06-fictional-aurum-logo-v1",
      placementContext: "sharedFrame",
      placementPurpose: "brand-identity",
      componentType: "header",
      assetSlotId: "brandLogo",
    });
    expect(logoAuthority?.sources[0]?.approvedUrl).toBe("/seed-assets/aurum-nordic-logo.svg");

    const context = await browser.newContext({ baseURL: p10b18aOrigin() });
    const page = await context.newPage();
    const ledger = await installP10B18AOfflineAuthority(page, {
      p04AcceptanceToken: p10b18cP04PageAcceptanceToken(),
    });
    const diagnostics = new P10B18CActiveCaptureEvidence(p10b18aEvidenceDirectory());
    const smokeSetupLedgerPath = resolve(
      p10b18aEvidenceDirectory(),
      "p10b-18c-capture-122-smoke-setup-ledger.json",
    );
    const smokeSetupStages: Array<{ stage: string; timestamp: string }> = [];
    const recordSmokeSetupStage = async (stage: string) => {
      smokeSetupStages.push({ stage, timestamp: new Date().toISOString() });
      await mkdir(p10b18aEvidenceDirectory(), { recursive: true });
      await writeFile(
        smokeSetupLedgerPath,
        `${JSON.stringify({ stages: smokeSetupStages }, null, 2)}\n`,
        "utf8",
      );
    };
    try {
      await recordSmokeSetupStage("storage-initialization-started");
      await initializeP10B18AStorage(page, "p04-integrated-mock");
      await recordSmokeSetupStage("storage-initialization-complete");
      await recordSmokeSetupStage("aggregate-seed-started");
      await seedP10B18AAggregate(page, store.aggregate, "p04-integrated-mock");
      await recordSmokeSetupStage("aggregate-seed-complete");
      await recordSmokeSetupStage("active-capture-entry-started");
      const capture = await baseCapture({
        page,
        store,
        manifest: storeManifest(store),
        diagnostics,
        surface: "search",
        route: "/search?q=Ring",
        width: 1440,
        profileOrArchetype: store.archetypes.search,
        caseSuffix: "search-multiple",
        retainPresentationImageEvidence: true,
      });
      await recordSmokeSetupStage("active-capture-entry-complete");
      expect(capture).toMatchObject({
        caseId: store.compiled.caseId,
        renderer: "saved-draft-preview",
        route: "/search?q=Ring",
        surface: "search",
        viewport: 1440,
        locale: "en",
      });
      expect(page.url()).toContain("/search?q=Ring&locale=en");
      expect(ledger).toMatchObject({
        external: [],
        provider: [],
        Vesko: [],
        generation: [],
        publication: [],
        runtimeErrors: [],
      });
      const progress = JSON.parse(await readFile(diagnostics.captureProgressPath(), "utf8")) as {
        completedCaptureCount: number;
        pendingEntry: unknown;
        entries: Array<{
          captureEventLedger: {
            blockingRuntimeFailures: string[];
            expectedSupersededPresentationImageAbortCount: number;
            expectedSupersededPresentationImageAborts: Array<{ rootClass: string }>;
            presentationImageEvidence: {
              placementCount: number;
              placements: Array<{
                probeLifecycleSettled: boolean;
                elementCount: number;
                authority: { placementPurpose: string | null };
                elements: Array<{
                  complete: boolean;
                  naturalWidth: number;
                  naturalHeight: number;
                  visible: boolean;
                  decodedSuccessfully: boolean;
                }>;
              }>;
            };
          };
        }>;
      };
      expect(progress).toMatchObject({
        completedCaptureCount: 1,
        pendingEntry: null,
        entries: [
          {
            captureEventLedger: {
              blockingRuntimeFailures: [],
              presentationImageEvidence: {
                placementCount: expect.any(Number),
              },
            },
          },
        ],
      });
      const captureLedger = progress.entries[0]?.captureEventLedger;
      const logoEvidence = captureLedger?.presentationImageEvidence.placements.find(
        ({ authority }) => authority.placementPurpose === "brand-identity",
      );
      expect(logoEvidence?.probeLifecycleSettled).toBe(true);
      expect(logoEvidence?.elementCount).toBeGreaterThan(0);
      expect(
        logoEvidence?.elements.some(
          (element) =>
            element.complete &&
            element.naturalWidth > 0 &&
            element.naturalHeight > 0 &&
            element.visible &&
            element.decodedSuccessfully,
        ),
      ).toBe(true);
      expect(captureLedger?.blockingRuntimeFailures).toEqual([]);
      expect(
        captureLedger?.expectedSupersededPresentationImageAborts.every(({ rootClass }) =>
          ["A", "B"].includes(rootClass),
        ),
      ).toBe(true);
      expect(
        JSON.parse(await readFile(diagnostics.activeCapturePath(), "utf8")) as unknown,
      ).toMatchObject({
        activeCapture: null,
        lastCompletedCapture: {
          lifecycle: { currentStage: "capture-complete" },
          persistence: {
            screenshotWrittenAt: expect.any(String),
            manifestPersistedAt: expect.any(String),
          },
        },
      });
    } finally {
      await context.close();
    }
  });
}

if (process.env.P10B18C_CAPTURE_108_SMOKE === "1") {
  test("completes the exact capture-108 FI collection witness with retained request evidence", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Capture 108 retains one Chromium witness.");
    test.setTimeout(900_000);
    const matrix = buildP10b18cMatrix();
    const selected = selectP10b18cHumanStores(matrix.cases);
    const selectedEntry = selected.find(
      ({ store }) => store.compiled.caseId === "simple-product-heavy-small--minimal-story-airy",
    );
    expect(matrix.failures).toEqual([]);
    expect(selectedEntry).toBeDefined();
    if (!selectedEntry) return;
    const store = selectedEntry.store;
    expect(store.runtimeAuthority).toBe("p03-standalone");
    expect(store.locale).toBe("fi");
    expect(store.representativeRoutes.collection).toBe("/collections/yolento");

    const context = await browser.newContext({ baseURL: p10b18aOrigin() });
    const page = await context.newPage();
    const ledger = await installP10B18AOfflineAuthority(page, {
      p04AcceptanceToken: p10b18cP04PageAcceptanceToken(),
    });
    const diagnostics = new P10B18CActiveCaptureEvidence(p10b18aEvidenceDirectory());
    try {
      await initializeP10B18AStorage(page, "p03-standalone");
      await seedP10B18AAggregate(page, store.aggregate, "p03-standalone");
      const capture = await baseCapture({
        page,
        store,
        manifest: storeManifest(store),
        diagnostics,
        surface: "collection",
        route: store.representativeRoutes.collection,
        width: 375,
        profileOrArchetype: store.representativeContext.collectionArchetype,
      });
      expect(capture).toMatchObject({
        caseId: "simple-product-heavy-small--minimal-story-airy",
        renderer: "saved-draft-preview",
        route: "/collections/yolento",
        surface: "collection",
        viewport: 375,
        locale: "fi",
      });
      expect(page.url()).toBe(
        `${p10b18aOrigin("p03-standalone")}/projects/${store.aggregate.project.id}/collections/yolento?locale=fi`,
      );
      expect(ledger).toMatchObject({
        external: [],
        provider: [],
        Vesko: [],
        generation: [],
        publication: [],
        runtimeErrors: [],
      });
      expect(
        JSON.parse(await readFile(diagnostics.captureProgressPath(), "utf8")) as unknown,
      ).toMatchObject({
        completedCaptureCount: 1,
        pendingEntry: null,
        entries: [
          {
            identity: {
              caseId: "simple-product-heavy-small--minimal-story-airy",
              surfacePageType: "collection",
              expectedRoute: "/collections/yolento",
              viewport: { width: 375, height: 900 },
              locale: "fi",
            },
            manifestEntry: {
              filename: capture.filename,
              screenshotSha256: capture.screenshotSha256,
            },
            captureEventLedger: {
              blockingRuntimeFailures: [],
              nonDeferredBlockingRuntimeFailures: [],
              pendingNextAppRouterPrefetchAbortCount: 0,
              expectedNextAppRouterPrefetchAborts: expect.any(Array),
            },
            lifecycle: { currentStage: "capture-complete" },
          },
        ],
      });
      expect(
        JSON.parse(await readFile(diagnostics.activeCapturePath(), "utf8")) as unknown,
      ).toMatchObject({
        activeCapture: null,
        lastCompletedCapture: {
          identity: {
            caseId: "simple-product-heavy-small--minimal-story-airy",
            surfacePageType: "collection",
          },
          lifecycle: { currentStage: "capture-complete" },
          persistence: {
            actualPath: capture.filename,
            screenshotWrittenAt: expect.any(String),
            manifestPersistedAt: expect.any(String),
          },
        },
      });
    } finally {
      await context.close();
    }
  });
}

if (process.env.P10B18C_CAPTURE_156_SMOKE === "1") {
  test("settles the exact capture-156 production home presentation-image chain", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Capture 156 retains one Chromium witness.");
    test.setTimeout(900_000);
    const authority = createP10b18aShapeAuthorities(["aurum-approved-presentation-image-rich"])[0];
    const stratum = p10b18cSemanticStrata.find(({ id }) => id === "minimal-story-airy");
    expect(authority).toBeDefined();
    expect(stratum).toBeDefined();
    if (!authority || !stratum) return;
    const store = materializeP10b18cCase(compileP10b18cCase(authority, stratum));
    expect(store.compiled.caseId).toBe(
      "aurum-approved-presentation-image-rich--minimal-story-airy",
    );
    expect(store.runtimeAuthority).toBe("p04-integrated-mock");
    expect(store.locale).toBe("en");

    const context = await browser.newContext({ baseURL: p10b18aOrigin() });
    const page = await context.newPage();
    const ledger = await installP10B18AOfflineAuthority(page, {
      p04AcceptanceToken: p10b18cP04PageAcceptanceToken(),
    });
    const diagnostics = new P10B18CActiveCaptureEvidence(p10b18aEvidenceDirectory());
    try {
      await initializeP10B18AStorage(page, "p04-integrated-mock");
      await seedP10B18AAggregate(page, store.aggregate, "p04-integrated-mock");
      const capture = await baseCapture({
        page,
        store,
        manifest: storeManifest(store),
        diagnostics,
        surface: "home",
        route: "/",
        width: 1024,
        profileOrArchetype: store.profiles.homepage,
        retainPresentationImageEvidence: true,
      });
      expect(capture).toMatchObject({
        caseId: store.compiled.caseId,
        renderer: "saved-draft-preview",
        route: "/",
        surface: "home",
        viewport: 1024,
        locale: "en",
      });
      expect(ledger).toMatchObject({
        external: [],
        provider: [],
        Vesko: [],
        generation: [],
        publication: [],
        runtimeErrors: [],
      });
      const progress = JSON.parse(await readFile(diagnostics.captureProgressPath(), "utf8")) as {
        completedCaptureCount: number;
        pendingEntry: unknown;
        entries: Array<{
          captureEventLedger: {
            blockingRuntimeFailures: string[];
            expectedSupersededPresentationImageAborts: unknown[];
            presentationImageEvidence: {
              placementCount: number;
              placements: Array<{
                activeViewportBreakpoint: string;
                activeSourceAssetIds: string[];
                inactiveSourceAssetIds: string[];
                authority: {
                  placementPurpose: string | null;
                  assetId: string;
                };
                elements: Array<{
                  complete: boolean;
                  naturalWidth: number;
                  naturalHeight: number;
                  visible: boolean;
                  decodedSuccessfully: boolean;
                  sourceValidForViewport: boolean;
                  brokenImageState: boolean;
                }>;
              }>;
            };
          };
        }>;
      };
      expect(progress).toMatchObject({
        completedCaptureCount: 1,
        pendingEntry: null,
      });
      const captureLedger = progress.entries[0]?.captureEventLedger;
      expect(captureLedger?.blockingRuntimeFailures).toEqual([]);
      const placements = captureLedger?.presentationImageEvidence.placements ?? [];
      const logo = placements.find(
        ({ authority: placementAuthority }) =>
          placementAuthority.placementPurpose === "brand-identity",
      );
      const hero = placements.find(
        ({ authority: placementAuthority }) =>
          placementAuthority.placementPurpose === "hero-primary",
      );
      const healthyActiveElement = (placement: (typeof placements)[number] | undefined) =>
        placement?.elements.some(
          (element) =>
            element.visible &&
            element.complete &&
            element.naturalWidth > 0 &&
            element.naturalHeight > 0 &&
            element.decodedSuccessfully &&
            element.sourceValidForViewport &&
            !element.brokenImageState,
        ) ?? false;
      expect(logo).toBeDefined();
      expect(hero).toBeDefined();
      expect(healthyActiveElement(logo)).toBe(true);
      expect(healthyActiveElement(hero)).toBe(true);
      expect(hero?.activeViewportBreakpoint).toBe("desktop");
      expect(hero?.activeSourceAssetIds).toContain("asset_p10b16p04_aurum_hero");
      expect(hero?.inactiveSourceAssetIds).toContain("asset_p10b18b06_aurum_hero_mobile");
      expect(
        JSON.parse(await readFile(diagnostics.activeCapturePath(), "utf8")) as unknown,
      ).toMatchObject({
        activeCapture: null,
        lastCompletedCapture: {
          lifecycle: { currentStage: "capture-complete" },
          persistence: {
            screenshotWrittenAt: expect.any(String),
            manifestPersistedAt: expect.any(String),
          },
        },
      });
    } finally {
      await context.close();
    }
  });
}

if (process.env.P10B18C_CAPTURE_115_SMOKE === "1") {
  test("renders the exact capture-115 saved-draft homepage in the production P04 server", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Capture 115 retains one Chromium witness.");
    const authority = createP10b18aShapeAuthorities(["aurum-approved-presentation-image-rich"])[0];
    const stratum = p10b18cSemanticStrata.find(({ id }) => id === "minimal-balanced-guided");
    expect(authority).toBeDefined();
    expect(stratum).toBeDefined();
    if (!authority || !stratum) return;
    const store = materializeP10b18cCase(compileP10b18cCase(authority, stratum));
    expect(store.compiled.caseId).toBe(
      "aurum-approved-presentation-image-rich--minimal-balanced-guided",
    );
    expect(store.runtimeAuthority).toBe("p04-integrated-mock");

    const context = await browser.newContext({ baseURL: p10b18aOrigin() });
    const page = await context.newPage();
    const ledger = await installP10B18AOfflineAuthority(page, {
      p04AcceptanceToken: p10b18cP04PageAcceptanceToken(),
    });
    const diagnostics = new P10B18CActiveCaptureEvidence(p10b18aEvidenceDirectory());
    try {
      await initializeP10B18AStorage(page, "p04-integrated-mock");
      const seeded = await seedP10B18AAggregate(page, store.aggregate, "p04-integrated-mock");
      const seededAggregate = validateProjectAggregate({
        project: projectSchema.parse(seeded.project),
        catalogue: catalogueDisplayModelSchema.parse(seeded.catalogue),
        snapshots: storefrontSnapshotSchema.array().parse(seeded.snapshots),
      });
      const persisted = seededAggregate.snapshots.find(
        ({ id }) => id === seededAggregate.project.draftSnapshotId,
      );
      expect(persisted).toBeDefined();
      if (!persisted) return;
      expect(canonicalStorefrontContentFingerprint(persisted)).toBe(store.fingerprints.snapshot);

      const capture = await baseCapture({
        page,
        store,
        manifest: storeManifest(store),
        diagnostics,
        surface: "home",
        route: "/",
        width: 375,
        profileOrArchetype: store.profiles.homepage,
      });
      expect(capture).toMatchObject({
        caseId: store.compiled.caseId,
        renderer: "saved-draft-preview",
        route: "/",
        surface: "home",
        viewport: 375,
      });
      expect(ledger).toMatchObject({
        external: [],
        provider: [],
        Vesko: [],
        generation: [],
        publication: [],
        runtimeErrors: [],
      });
      expect(
        JSON.parse(await readFile(diagnostics.captureProgressPath(), "utf8")) as unknown,
      ).toMatchObject({
        completedCaptureCount: 1,
        entries: [
          {
            identity: {
              caseId: store.compiled.caseId,
              surfacePageType: "home",
              viewport: { width: 375, height: 900 },
            },
            manifestEntry: { filename: capture.filename },
            captureEventLedger: { blockingRuntimeFailures: [] },
          },
        ],
      });
    } finally {
      await context.close();
    }
  });
}

if (
  process.env.P10B18C_CAPTURE_005_DIAGNOSIS === "1" ||
  process.env.P10B18C_CAPTURE_005_SMOKE === "1"
) {
  test("diagnoses the exact capture-005 production collection request ledger", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Capture 005 retains one Chromium witness.");
    const authority = createP10b18aShapeAuthorities([
      "canonical-product-media-rich-presentation-asset-poor",
    ])[0];
    const stratum = p10b18cSemanticStrata.find(({ id }) => id === "modern-catalogue-dense");
    expect(authority).toBeDefined();
    expect(stratum).toBeDefined();
    if (!authority || !stratum) return;
    const store = materializeP10b18cCase(compileP10b18cCase(authority, stratum));
    expect(store.compiled.caseId).toBe(
      "canonical-product-media-rich-presentation-asset-poor--modern-catalogue-dense",
    );
    expect(store.runtimeAuthority).toBe("p03-standalone");
    expect(store.locale).toBe("fi");

    const context = await browser.newContext({ baseURL: p10b18aOrigin() });
    const page = await context.newPage();
    const ledger = await installP10B18AOfflineAuthority(page, {
      p04AcceptanceToken: p10b18cP04PageAcceptanceToken(),
    });
    const diagnostics = new P10B18CActiveCaptureEvidence(p10b18aEvidenceDirectory());
    try {
      await initializeP10B18AStorage(page, "p03-standalone");
      await seedP10B18AAggregate(page, store.aggregate, "p03-standalone");
      const capture = await baseCapture({
        page,
        store,
        manifest: storeManifest(store),
        diagnostics,
        surface: "collection",
        route: "/collections/pihka",
        width: 1440,
        profileOrArchetype: store.representativeContext.collectionArchetype,
      });
      expect(capture).toMatchObject({
        caseId: store.compiled.caseId,
        renderer: "saved-draft-preview",
        route: "/collections/pihka",
        surface: "collection",
        viewport: 1440,
        locale: "fi",
      });
      expect(ledger).toMatchObject({
        external: [],
        provider: [],
        Vesko: [],
        generation: [],
        publication: [],
        runtimeErrors: [],
      });
    } finally {
      await context.close();
    }
  });
}

test.describe("P10B-18C accessible-name probe regressions", () => {
  test("accepts an input named by an explicit native label", async ({ page }) => {
    await page.setContent(
      '<main><label for="explicit-name">Ring size</label><input id="explicit-name" type="text"></main>',
    );

    expect((await inspectAccessibility(page, "main")).unnamedControlCount).toBe(0);
  });

  test("accepts an input nested inside a native label", async ({ page }) => {
    await page.setContent(
      '<main><label>Ring size <input id="implicit-name" type="text"></label></main>',
    );

    expect((await inspectAccessibility(page, "main")).unnamedControlCount).toBe(0);
  });

  test("accepts an input named by aria-labelledby", async ({ page }) => {
    await page.setContent(
      '<main><span id="aria-name">Ring size</span><input type="text" aria-labelledby="aria-name"></main>',
    );

    expect((await inspectAccessibility(page, "main")).unnamedControlCount).toBe(0);
  });

  test("resolves multiple aria-labelledby references deterministically in declared order", async ({
    page,
  }) => {
    await page.setContent(
      '<main><span id="first-name">Size</span><span id="second-name">15</span><input type="text" aria-labelledby="first-name second-name"></main>',
    );

    await expect(page.getByRole("textbox", { name: "Size 15" })).toHaveCount(1);
    const counts = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      counts.push((await inspectAccessibility(page, "main")).unnamedControlCount);
    }
    expect(counts).toEqual([0, 0, 0]);
  });

  test("accepts a button-like input named by its native value", async ({ page }) => {
    await page.setContent('<main><input type="submit" value="Continue to checkout"></main>');

    expect((await inspectAccessibility(page, "main")).unnamedControlCount).toBe(0);
  });

  test("does not use an ordinary text-input value as its accessible name", async ({ page }) => {
    await page.setContent('<main><input type="text" value="This is entered data"></main>');

    expect((await inspectAccessibility(page, "main")).unnamedControlCount).toBe(1);
  });

  test("continues to report a genuinely unnamed visible control", async ({ page }) => {
    await page.setContent('<main><button type="button"></button></main>');

    expect((await inspectAccessibility(page, "main")).unnamedControlCount).toBe(1);
  });

  test("does not derive a name from empty or missing aria-labelledby references", async ({
    page,
  }) => {
    await page.setContent(
      '<main><span id="empty-reference">   </span><input type="text" aria-labelledby="missing-reference empty-reference"></main>',
    );

    expect((await inspectAccessibility(page, "main")).unnamedControlCount).toBe(1);
  });
});

test.describe("P10B-18C clean retained-evidence regressions", () => {
  test("detects Next, Playwright, Studio and acceptance debug chrome before capture", async ({
    page,
  }) => {
    await page.setContent(`<main>Storefront</main>
      <nextjs-portal></nextjs-portal>
      <div data-playwright-control></div>
      <div data-studio-shell></div>
      <div data-acceptance-debug-overlay></div>`);
    expect((await inspectCaptureChrome(page)).map(({ tagName }) => tagName)).toEqual([
      "nextjs-portal",
      "div",
      "div",
      "div",
    ]);

    await page.setContent("<main>Clean storefront</main>");
    await expect(assertCleanCaptureSurface(page)).resolves.toBeUndefined();
  });
});
