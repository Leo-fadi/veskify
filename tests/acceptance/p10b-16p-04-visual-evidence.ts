import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FrameLocator, Locator, Page } from "@playwright/test";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";

export const p10b16p04CommercialEvidenceWidths = [375, 768, 1024, 1440] as const;
export type P10B16P04CommercialEvidenceWidth = (typeof p10b16p04CommercialEvidenceWidths)[number];

export type P10B16P04RendererMode =
  | "studio-proposal"
  | "isolated-proposal"
  | "saved-preview"
  | "isolated-registered-frame-regions"
  | "search-runtime-results";

export type P10B16P04SafeSelection = Readonly<{
  directionId: string;
  designDnaNonColour: Readonly<{
    typography: Readonly<{
      pairing: string;
      scale: Readonly<{ posture: string; ratio: number }>;
      roles: Readonly<{
        display: Readonly<{ font: string }>;
        heading: Readonly<{ font: string }>;
        body: Readonly<{ font: string }>;
      }>;
    }>;
    spacing: Readonly<{
      scale: string;
      sectionRhythm: string;
      pageGutter: string;
      gridGap: string;
      cardInset: string;
    }>;
    surfaces: Readonly<{
      posture: string;
      border: string;
      radius: string;
      elevation: string;
    }>;
    controls: Readonly<{
      primaryAction: string;
      height: string;
      density: string;
      shape: string;
      emphasis: string;
    }>;
    density: Readonly<{
      posture: string;
      navigation: string;
      content: string;
      commerce: string;
    }>;
    media: Readonly<{
      posture: string;
      ratio: string;
      crop: string;
      overlay: string;
      prominence: string;
    }>;
  }>;
  sharedFrame: Readonly<{ profileId: string }>;
  profiles: Readonly<{
    homepage: string;
    collection: string;
    search: string;
    productDetail: string;
  }>;
  homepageProductCount: number;
  dynamicCommerce: Readonly<{
    collectionArchetypeId: string;
    searchArchetypeId: string;
    standardSimpleArchetypeId: string;
    configurableArchetypeId: string;
    highConsiderationArchetypeId: string;
    genericFallbackArchetypeId: string;
    productTypeMappings: readonly Readonly<{
      productTypeId: string;
      archetypeId: string;
    }>[];
    selectedArchetypes: Readonly<{
      collection: P10B16P04SafeDynamicArchetype;
      standardSimple: P10B16P04SafeDynamicArchetype;
      configurable: P10B16P04SafeDynamicArchetype;
      highConsideration: P10B16P04SafeDynamicArchetype;
    }>;
  }>;
  narrative: Readonly<{ homepageRoleSequence: readonly string[] }>;
  componentChoices: readonly Readonly<{
    pageKey: string;
    slotId: string;
    component: string;
    variant: string;
    anatomyId: string | null;
  }>[];
  pageProfileSelections: readonly Readonly<{
    pageKey: string;
    familyId: string;
    profileId: string;
    narrativeRoles: readonly string[];
  }>[];
  productCardAnatomyIds: readonly string[];
  postures: Readonly<{
    narrative: string;
    merchandising: string;
    informationDensity: string;
    artDirection: string;
    responsive: string;
    spacingDensity: string;
    surfaceDepth: string;
  }>;
  responsiveArtDirection: Readonly<{
    responsiveMode: string;
    responsiveCapabilityKeys: readonly string[];
    artDirectionCapabilityKeys: readonly string[];
    approvedAssetRoleKeys: readonly string[];
  }>;
  semanticResolution: Readonly<{
    initialCandidateCount: number;
    finalCandidateCount: number;
    acceptedSemanticPaths: readonly string[];
    substitutedSemanticPaths: readonly string[];
  }>;
  staticContentSupportSelections: readonly string[];
  utilityPresentationSelections: readonly string[];
}>;

type P10B16P04SafeDynamicArchetype = Readonly<{
  archetypeId: string;
  profileId: string;
  component: "dynamicCollectionCommerce" | "dynamicProductDetail";
  variant: string;
  anatomyId: string | null;
}>;

export type P10B16P04EvidenceIdentity = Readonly<{
  logicalCaptureId: string;
  width: P10B16P04CommercialEvidenceWidth;
  surface: string;
  locale: "en" | "fi";
  representativeContext: Readonly<{
    kind: "home" | "collection" | "product" | "content" | "utility" | "search" | "frame";
    id: string;
    route: string;
  }>;
  snapshotFingerprint: string;
  proposalFingerprint: string;
  rendererMode: P10B16P04RendererMode;
  selectedFrame: string;
  selectedProfileOrArchetype: string;
}>;

export type P10B16P04VisualEvidenceEntry = P10B16P04EvidenceIdentity &
  Readonly<{
    filename: string;
    documentHeight: number;
    documentWidth: number;
    pngHeight: number;
    pngWidth: number;
    segmentIndex: number;
    segmentCount: number;
    segmentScrollY: number;
    segmentOverlap: number;
    rendererFingerprint: string;
  }>;

type CanvasStyleState = Readonly<{
  bodyStyle: string | null;
  htmlStyle: string | null;
  iframeStyle: string | null;
  ancestorStyles: readonly (string | null)[];
  pageScrollX: number;
  pageScrollY: number;
  viewport: Readonly<{ width: number; height: number }> | null;
}>;

type StorefrontMetrics = Readonly<{
  connected: boolean;
  documentHeight: number;
  documentWidth: number;
  hasFooter: boolean;
  hasHeader: boolean;
  horizontalOverflow: number;
  viewportHeight: number;
  viewportWidth: number;
  windowScrollX: number;
  windowScrollY: number;
}>;

const pngSignature = "89504e470d0a1a0a";
const defaultSegmentHeight = 900;
const segmentOverlap = 140;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function safeEvidenceName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, "-")
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/^-|-$/g, "");
  invariant(normalized.length > 0, "The visual-evidence filename is empty.");
  return normalized.slice(0, 120);
}

function pngDimensions(image: Buffer): Readonly<{ width: number; height: number }> {
  invariant(image.length >= 24, "The captured visual evidence is not a complete PNG.");
  invariant(
    image.subarray(0, 8).toString("hex") === pngSignature,
    "The captured visual evidence is not a PNG.",
  );
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

function isReplacedImageContext(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(?:element|node).*(?:not attached|detached)|execution context was destroyed|cannot find context with specified id|frame was detached/iu.test(
      error.message,
    )
  );
}

async function waitForImages(root: Locator): Promise<void> {
  const scrollPosition = await root.evaluate((candidate) => {
    const view = candidate.ownerDocument.defaultView;
    return { x: view?.scrollX ?? 0, y: view?.scrollY ?? 0 };
  });
  const imageCount = await root.locator("img").count();
  const maximumContextAttempts = 3;
  try {
    for (let index = 0; index < imageCount; index += 1) {
      for (let attempt = 0; attempt < maximumContextAttempts; attempt += 1) {
        try {
          const image = root.locator("img").nth(index);
          if (!(await image.isVisible())) break;
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
          break;
        } catch (error) {
          if (!isReplacedImageContext(error) || attempt === maximumContextAttempts - 1) {
            throw error;
          }
        }
      }
    }
  } finally {
    await root.evaluate(async (candidate, position) => {
      candidate.ownerDocument.defaultView?.scrollTo(position.x, position.y);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }, scrollPosition);
  }
}

async function hideFrameworkDevelopmentChrome(root: Locator): Promise<void> {
  await root.evaluate((candidate) => {
    const document = candidate.ownerDocument;
    for (const portal of document.querySelectorAll<HTMLElement>("nextjs-portal")) {
      portal.style.setProperty("display", "none", "important");
    }
  });
}

async function suppressPuckInteractionChrome(documentRoot: Locator): Promise<void> {
  await documentRoot.evaluate(() => {
    const document = window.document;
    if (document.querySelector("style[data-p10b16p04-capture-chrome]")) return;
    const style = document.createElement("style");
    style.dataset.p10b16p04CaptureChrome = "suppressed";
    style.textContent = `
      [data-puck-overlay] { display: none !important; }
      :root {
        --puck-color-selection-bg: transparent !important;
        --puck-color-selection-border: transparent !important;
      }
    `;
    document.head.append(style);
  });
}

async function restorePuckInteractionChrome(documentRoot: Locator): Promise<void> {
  await documentRoot.evaluate(() => {
    window.document.querySelector("style[data-p10b16p04-capture-chrome]")?.remove();
  });
}

async function storefrontMetrics(root: Locator): Promise<StorefrontMetrics> {
  return root.evaluate((candidate) => {
    const element = candidate as HTMLElement;
    const documentElement = element.ownerDocument.documentElement;
    const body = element.ownerDocument.body;
    const bounds = element.getBoundingClientRect();
    return {
      connected: element.isConnected && body.contains(element),
      documentHeight: Math.ceil(
        Math.max(element.scrollHeight, element.offsetHeight, bounds.height),
      ),
      documentWidth: Math.ceil(Math.max(element.scrollWidth, element.offsetWidth, bounds.width)),
      hasFooter: element.querySelector('[data-frame-region="footer"]') !== null,
      hasHeader: element.querySelector('[data-frame-region="header"]') !== null,
      horizontalOverflow: Math.max(0, element.scrollWidth - documentElement.clientWidth),
      viewportHeight: documentElement.clientHeight,
      viewportWidth: documentElement.clientWidth,
      windowScrollX: element.ownerDocument.defaultView?.scrollX ?? 0,
      windowScrollY: element.ownerDocument.defaultView?.scrollY ?? 0,
    };
  });
}

async function rendererFingerprint(
  root: Locator,
  identity: P10B16P04EvidenceIdentity,
): Promise<string> {
  const authority = await root.evaluate(async (candidate) => {
    const element = candidate as HTMLElement;
    const attributes = [
      "data-frame-profile",
      "data-frame-region",
      "data-footer-composition",
      "data-desktop-composition",
      "data-mobile-navigation-mode",
      "data-mobile-mode",
      "data-search-placement",
      "data-component",
      "data-variant",
      "data-surface",
      "data-pdp-composition",
      "data-card-anatomy",
      "data-card-context",
      "data-card-facts-fingerprint",
      "data-product-id",
      "data-product-type",
      "data-product-count",
      "data-search-context",
      "data-results-treatment",
      "data-filter-layout",
      "data-option-group-count",
      "data-page-family",
      "data-utility-state",
      "data-summary-placement",
      "data-responsive-layout",
      "data-responsive-transformations",
      "data-asset-id",
      "data-asset-role",
      "data-asset-provenance",
      "data-product-media-owner",
      "data-art-direction-fingerprint",
      "data-art-selected-breakpoint",
      "data-art-crop",
      "data-art-focal",
      "data-art-overlay",
      "data-art-ratio",
    ] as const;
    const materialStyleProperties = [
      "display",
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "background-color",
      "color",
      "border-width",
      "border-radius",
      "box-shadow",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "gap",
      "grid-template-columns",
      "max-width",
      "max-height",
      "object-fit",
      "object-position",
      "aspect-ratio",
    ] as const;
    const materialSelectors = [
      ["frame-header", '[data-frame-region="header"]'],
      ["frame-footer", '[data-frame-region="footer"]'],
      ["hero", '[data-component="homepageHero"]'],
      ["editorial", '[data-component="homepageEditorial"]'],
      ["product-card", "[data-card-anatomy]"],
      ["collection", '[data-component="dynamicCollectionCommerce"]'],
      ["product-detail", '[data-component="dynamicProductDetail"]'],
      ["purchase-action", '[aria-label="Purchase action"] button'],
      ["content", '[data-component="contentSupport"]'],
      ["utility", '[data-component="commerceUtility"]'],
    ] as const;
    const designDnaVariables = [
      "--brand-design-dna-version",
      "--brand-design-dna-fingerprint",
      "--brand-font-display",
      "--brand-font-heading",
      "--brand-font-body",
      "--brand-type-scale-ratio",
      "--brand-type-display-size",
      "--brand-type-heading-size",
      "--brand-type-body-size",
      "--brand-section-rhythm",
      "--brand-page-gutter",
      "--brand-grid-gap",
      "--brand-card-inset",
      "--brand-container-content",
      "--brand-container-commerce",
      "--brand-surface-page",
      "--brand-surface-default",
      "--brand-surface-muted",
      "--brand-surface-contrast",
      "--brand-border-width",
      "--brand-radius",
      "--brand-elevation-shadow",
      "--brand-control-height",
      "--brand-control-radius",
      "--brand-control-emphasis",
      "--brand-density-global",
      "--brand-density-navigation",
      "--brand-density-content",
      "--brand-density-commerce",
      "--brand-media-ratio",
      "--brand-media-crop",
      "--brand-media-overlay-opacity",
      "--brand-media-prominence",
    ] as const;
    const computed = getComputedStyle(element);
    const normalizedText = (element.textContent ?? "").replaceAll(/\s+/g, " ").trim();
    const textDigest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(normalizedText),
    );
    return {
      locale: element.lang || element.ownerDocument.documentElement.lang,
      customerTextFingerprint: [...new Uint8Array(textDigest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
      customerTextLength: normalizedText.length,
      designDna: Object.fromEntries(
        designDnaVariables.map((variable) => [
          variable,
          computed.getPropertyValue(variable).trim(),
        ]),
      ),
      nodes: [...element.querySelectorAll<HTMLElement>(`[${attributes.join("],[")}]`)].map(
        (node) => ({
          tag: node.tagName.toLocaleLowerCase("en"),
          attributes: Object.fromEntries(
            attributes.flatMap((attribute) => {
              const value = node.getAttribute(attribute);
              return value === null ? [] : [[attribute, value]];
            }),
          ),
        }),
      ),
      materialStyles: Object.fromEntries(
        materialSelectors.map(([label, selector]) => {
          const node = element.querySelector<HTMLElement>(selector);
          if (!node) return [label, null];
          const style = getComputedStyle(node);
          return [
            label,
            {
              tag: node.tagName.toLocaleLowerCase("en"),
              values: Object.fromEntries(
                materialStyleProperties.map((property) => [
                  property,
                  style.getPropertyValue(property),
                ]),
              ),
            },
          ];
        }),
      ),
      images: [...element.querySelectorAll<HTMLImageElement>("img")]
        .filter((image) => image.getClientRects().length > 0)
        .map((image) => {
          const asset = image.closest<HTMLElement>("[data-asset-id]");
          const product = image.closest<HTMLElement>("[data-product-id]");
          const mediaOwner = image.closest<HTMLElement>("[data-product-media-owner]");
          const style = getComputedStyle(image);
          let safePath = "";
          try {
            safePath = new URL(image.currentSrc || image.src, element.ownerDocument.baseURI)
              .pathname;
          } catch {
            safePath = "invalid-image-source";
          }
          return {
            assetId: asset?.dataset.assetId ?? null,
            productId: product?.dataset.productId ?? null,
            productMediaOwner: mediaOwner?.dataset.productMediaOwner ?? null,
            sourcePath: safePath,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            objectFit: style.objectFit,
            objectPosition: style.objectPosition,
            aspectRatio: style.aspectRatio,
            maxWidth: style.maxWidth,
            maxHeight: style.maxHeight,
          };
        }),
    };
  });
  return `p10b16p04-renderer-${canonicalValueFingerprint({
    pageIdentity: identity.representativeContext,
    selectedFrame: identity.selectedFrame,
    selectedProfileOrArchetype: identity.selectedProfileOrArchetype,
    width: identity.width,
    authority,
  })}`;
}

async function configureCanvasForCapture(
  page: Page,
  iframe: Locator,
  width: P10B16P04CommercialEvidenceWidth,
): Promise<CanvasStyleState> {
  const previousViewport = page.viewportSize();
  await page.setViewportSize({ width: Math.max(1600, width + 40), height: 1100 });
  const styleState = await iframe.evaluate(
    (candidate, capture) => {
      const element = candidate as HTMLIFrameElement;
      const ancestors: HTMLElement[] = [];
      let ancestor = element.parentElement;
      while (ancestor && ancestors.length < 5) {
        ancestors.push(ancestor);
        ancestor = ancestor.parentElement;
      }
      const state = {
        bodyStyle: document.body.getAttribute("style"),
        htmlStyle: document.documentElement.getAttribute("style"),
        iframeStyle: element.getAttribute("style"),
        ancestorStyles: ancestors.map((item) => item.getAttribute("style")),
        pageScrollX: window.scrollX,
        pageScrollY: window.scrollY,
      };
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      element.style.position = "fixed";
      element.style.inset = "0 auto auto 0";
      element.style.width = `${capture.width}px`;
      element.style.maxWidth = "none";
      element.style.height = `${capture.segmentHeight}px`;
      element.style.border = "0";
      element.style.zIndex = "2147483000";
      for (const container of ancestors) {
        container.style.overflow = "visible";
        container.style.maxWidth = "none";
      }
      window.scrollTo(0, 0);
      return state;
    },
    { width, segmentHeight: defaultSegmentHeight },
    { timeout: 30_000 },
  );
  return { ...styleState, viewport: previousViewport };
}

async function restoreCanvasAfterCapture(
  page: Page,
  iframe: Locator,
  state: CanvasStyleState,
): Promise<void> {
  await iframe.evaluate(
    (candidate, original) => {
      const element = candidate as HTMLIFrameElement;
      const ancestors: HTMLElement[] = [];
      let ancestor = element.parentElement;
      while (ancestor && ancestors.length < original.ancestorStyles.length) {
        ancestors.push(ancestor);
        ancestor = ancestor.parentElement;
      }
      const restore = (target: HTMLElement, value: string | null) => {
        if (value === null) target.removeAttribute("style");
        else target.setAttribute("style", value);
      };
      restore(document.documentElement, original.htmlStyle);
      restore(document.body, original.bodyStyle);
      restore(element, original.iframeStyle);
      ancestors.forEach((item, index) => restore(item, original.ancestorStyles[index] ?? null));
      window.scrollTo(original.pageScrollX, original.pageScrollY);
    },
    state,
    { timeout: 30_000 },
  );
  if (state.viewport) await page.setViewportSize(state.viewport);
}

function manifestEntry(input: {
  identity: P10B16P04EvidenceIdentity;
  filename: string;
  metrics: StorefrontMetrics;
  png: Readonly<{ width: number; height: number }>;
  rendererFingerprint: string;
  segmentIndex: number;
  segmentCount: number;
  segmentScrollY: number;
  segmentOverlap: number;
}): P10B16P04VisualEvidenceEntry {
  return {
    ...input.identity,
    filename: input.filename,
    documentHeight: input.metrics.documentHeight,
    documentWidth: input.metrics.documentWidth,
    pngHeight: input.png.height,
    pngWidth: input.png.width,
    segmentIndex: input.segmentIndex,
    segmentCount: input.segmentCount,
    segmentScrollY: input.segmentScrollY,
    segmentOverlap: input.segmentOverlap,
    rendererFingerprint: input.rendererFingerprint,
  };
}

async function captureFullRoot(input: {
  root: Locator;
  evidenceDirectory: string;
  identity: P10B16P04EvidenceIdentity;
  metrics: StorefrontMetrics;
  rendererFingerprint: string;
}): Promise<readonly P10B16P04VisualEvidenceEntry[]> {
  const filename = `${safeEvidenceName(input.identity.logicalCaptureId)}.png`;
  const image = await input.root.screenshot({ animations: "disabled", caret: "hide" });
  const png = pngDimensions(image);
  invariant(
    Math.abs(png.width - input.metrics.documentWidth) <= 2,
    `The complete storefront capture width ${png.width} does not match ${input.metrics.documentWidth}.`,
  );
  invariant(
    png.height + 2 >= input.metrics.documentHeight,
    `The complete storefront capture clipped ${input.metrics.documentHeight - png.height}px.`,
  );
  await writeFile(join(input.evidenceDirectory, filename), image);
  return [
    manifestEntry({
      ...input,
      filename,
      png,
      segmentIndex: 1,
      segmentCount: 1,
      segmentScrollY: 0,
      segmentOverlap: 0,
    }),
  ];
}

async function captureCanvasSegments(input: {
  page: Page;
  iframe: Locator;
  documentRoot: Locator;
  evidenceDirectory: string;
  identity: P10B16P04EvidenceIdentity;
  metrics: StorefrontMetrics;
  rendererFingerprint: string;
}): Promise<readonly P10B16P04VisualEvidenceEntry[]> {
  const viewportHeight = Math.min(defaultSegmentHeight, input.metrics.documentHeight);
  const step = Math.max(1, viewportHeight - segmentOverlap);
  const maximumScroll = Math.max(0, input.metrics.documentHeight - viewportHeight);
  const positions: number[] = [];
  for (let position = 0; position < maximumScroll; position += step) positions.push(position);
  positions.push(maximumScroll);
  const uniquePositions = [...new Set(positions)];
  const entries: P10B16P04VisualEvidenceEntry[] = [];
  for (const [index, position] of uniquePositions.entries()) {
    const viewport = input.page.viewportSize();
    if (viewport) await input.page.mouse.move(viewport.width - 1, viewport.height - 1);
    await input.documentRoot.evaluate((_root, scrollY) => {
      window.scrollTo(0, scrollY);
    }, position);
    await input.documentRoot.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    const filename = `${safeEvidenceName(input.identity.logicalCaptureId)}-segment-${String(index + 1).padStart(2, "0")}-of-${String(uniquePositions.length).padStart(2, "0")}.png`;
    const image = await input.iframe.screenshot({ animations: "disabled", caret: "hide" });
    const png = pngDimensions(image);
    invariant(
      png.width === input.identity.width,
      `The storefront segment width ${png.width} does not match ${input.identity.width}.`,
    );
    await writeFile(join(input.evidenceDirectory, filename), image);
    entries.push(
      manifestEntry({
        ...input,
        filename,
        png,
        segmentIndex: index + 1,
        segmentCount: uniquePositions.length,
        segmentScrollY: position,
        segmentOverlap: index === 0 ? 0 : segmentOverlap,
      }),
    );
  }
  const coveredBottom =
    (uniquePositions.at(-1) ?? 0) + (entries.at(-1)?.pngHeight ?? defaultSegmentHeight);
  invariant(
    coveredBottom + 2 >= input.metrics.documentHeight,
    "The segmented storefront evidence does not reach the complete footer.",
  );
  return entries;
}

function assertMetrics(metrics: StorefrontMetrics, identity: P10B16P04EvidenceIdentity): void {
  invariant(metrics.connected, "The storefront document detached before visual capture.");
  invariant(metrics.hasHeader, `${identity.surface} does not render the selected shared header.`);
  invariant(metrics.hasFooter, `${identity.surface} does not render the selected shared footer.`);
  invariant(
    metrics.viewportWidth === identity.width,
    `${identity.surface} rendered at ${metrics.viewportWidth}px instead of ${identity.width}px.`,
  );
  invariant(
    metrics.horizontalOverflow <= 1,
    `${identity.surface} overflows horizontally by ${metrics.horizontalOverflow}px.`,
  );
  invariant(metrics.documentHeight > 0, `${identity.surface} has no rendered document height.`);
}

export async function capturePuckStorefrontDocument(input: {
  page: Page;
  canvasRegion: Locator;
  evidenceDirectory: string;
  identity: P10B16P04EvidenceIdentity;
  assertDocument?: (root: Locator) => Promise<void>;
}): Promise<readonly P10B16P04VisualEvidenceEntry[]> {
  await mkdir(input.evidenceDirectory, { recursive: true });
  const iframe = input.canvasRegion.locator("iframe");
  const frame: FrameLocator = input.canvasRegion.frameLocator("iframe");
  const root = frame.locator('[data-veskify-canvas-root="true"]');
  const documentRoot = frame.locator("html");
  await iframe.waitFor({ state: "visible" });
  await root.waitFor({ state: "visible" });
  const canvasState = await configureCanvasForCapture(input.page, iframe, input.identity.width);
  let innerScroll = { x: 0, y: 0 };
  try {
    await documentRoot.waitFor({ state: "attached" });
    await documentRoot.evaluate(
      (_html, width) =>
        new Promise<void>((resolve, reject) => {
          let attempts = 0;
          const check = () => {
            if (document.documentElement.clientWidth === width) return resolve();
            if (attempts++ >= 30) return reject(new Error("The Puck viewport did not resize."));
            requestAnimationFrame(check);
          };
          check();
        }),
      input.identity.width,
      { timeout: 30_000 },
    );
    // The evidence helper resizes the iframe element directly instead of using Puck's viewport UI.
    // Notify responsive components after Chromium has committed the nested layout viewport.
    await documentRoot.evaluate(() => window.dispatchEvent(new Event("resize")));
    innerScroll = await documentRoot.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    await documentRoot.evaluate(() => window.scrollTo(0, 0));
    await documentRoot.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await hideFrameworkDevelopmentChrome(root);
    await suppressPuckInteractionChrome(documentRoot);
    await waitForImages(root);
    await input.assertDocument?.(root);
    const metrics = await storefrontMetrics(root);
    assertMetrics(metrics, input.identity);
    const fingerprint = await rendererFingerprint(root, input.identity);
    // Chromium may report the offscreen Puck root's complete dimensions while a direct locator
    // screenshot composites content below the fixed iframe from the outer Studio document. Capture
    // the actual iframe viewport in deterministic overlapping segments so Studio controls can never
    // enter storefront evidence.
    return await captureCanvasSegments({
      page: input.page,
      iframe,
      documentRoot,
      evidenceDirectory: input.evidenceDirectory,
      identity: input.identity,
      metrics,
      rendererFingerprint: fingerprint,
    });
  } finally {
    await restorePuckInteractionChrome(documentRoot);
    await documentRoot.evaluate(
      (_html, scroll) => window.scrollTo(scroll.x, scroll.y),
      innerScroll,
      { timeout: 30_000 },
    );
    await restoreCanvasAfterCapture(input.page, iframe, canvasState);
  }
}

export async function captureStandaloneStorefrontDocument(input: {
  page: Page;
  root: Locator;
  evidenceDirectory: string;
  identity: P10B16P04EvidenceIdentity;
  assertDocument?: (root: Locator) => Promise<void>;
}): Promise<readonly P10B16P04VisualEvidenceEntry[]> {
  await mkdir(input.evidenceDirectory, { recursive: true });
  const originalViewport = input.page.viewportSize();
  const originalScroll = await input.page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }));
  await input.page.setViewportSize({ width: input.identity.width, height: defaultSegmentHeight });
  try {
    await input.page.waitForFunction(
      (width) => document.documentElement.clientWidth === width,
      input.identity.width,
      { timeout: 30_000 },
    );
    await input.page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await input.root.waitFor({ state: "visible" });
    await hideFrameworkDevelopmentChrome(input.root);
    await waitForImages(input.root);
    await input.assertDocument?.(input.root);
    const metrics = await storefrontMetrics(input.root);
    assertMetrics(metrics, input.identity);
    return captureFullRoot({
      root: input.root,
      evidenceDirectory: input.evidenceDirectory,
      identity: input.identity,
      metrics,
      rendererFingerprint: await rendererFingerprint(input.root, input.identity),
    });
  } finally {
    if (originalViewport) await input.page.setViewportSize(originalViewport);
    await input.page.evaluate((scroll) => window.scrollTo(scroll.x, scroll.y), originalScroll);
  }
}

/**
 * Captures the two exact registered shared-frame regions from an isolated
 * storefront render. This is evidence of the existing renderer in context,
 * not a second or synthetic frame renderer.
 */
export async function captureP10B16P04RegisteredFrameRegions(input: {
  page: Page;
  root: Locator;
  evidenceDirectory: string;
  identity: P10B16P04EvidenceIdentity;
}): Promise<readonly P10B16P04VisualEvidenceEntry[]> {
  await mkdir(input.evidenceDirectory, { recursive: true });
  const originalViewport = input.page.viewportSize();
  const originalScroll = await input.page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }));
  await input.page.setViewportSize({ width: input.identity.width, height: defaultSegmentHeight });
  try {
    await input.root.waitFor({ state: "visible" });
    await hideFrameworkDevelopmentChrome(input.root);
    await waitForImages(input.root);
    const metrics = await storefrontMetrics(input.root);
    assertMetrics(metrics, input.identity);
    const fingerprint = await rendererFingerprint(input.root, input.identity);
    const regions = [
      ["header", input.root.locator('[data-frame-region="header"]')],
      ["footer", input.root.locator('[data-frame-region="footer"]')],
    ] as const;
    const entries: P10B16P04VisualEvidenceEntry[] = [];
    for (const [index, [name, region]] of regions.entries()) {
      await region.waitFor({ state: "visible" });
      const filename = `${safeEvidenceName(input.identity.logicalCaptureId)}-${name}.png`;
      const image = await region.screenshot({ animations: "disabled", caret: "hide" });
      const png = pngDimensions(image);
      await writeFile(join(input.evidenceDirectory, filename), image);
      entries.push(
        manifestEntry({
          identity: input.identity,
          filename,
          metrics,
          png,
          rendererFingerprint: fingerprint,
          segmentIndex: index + 1,
          segmentCount: regions.length,
          segmentScrollY: 0,
          segmentOverlap: 0,
        }),
      );
    }
    return entries;
  } finally {
    if (originalViewport) await input.page.setViewportSize(originalViewport);
    await input.page.evaluate((scroll) => window.scrollTo(scroll.x, scroll.y), originalScroll);
  }
}

/** Captures a bounded acceptance region that intentionally is not a storefront document. */
export async function captureP10B16P04EvidenceRegion(input: {
  page: Page;
  region: Locator;
  evidenceDirectory: string;
  identity: P10B16P04EvidenceIdentity;
}): Promise<readonly P10B16P04VisualEvidenceEntry[]> {
  await mkdir(input.evidenceDirectory, { recursive: true });
  const originalViewport = input.page.viewportSize();
  const originalScroll = await input.page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }));
  await input.page.setViewportSize({ width: input.identity.width, height: defaultSegmentHeight });
  try {
    await input.region.waitFor({ state: "visible" });
    await hideFrameworkDevelopmentChrome(input.region);
    const filename = `${safeEvidenceName(input.identity.logicalCaptureId)}.png`;
    const bounds = await input.region.evaluate((candidate) => {
      const element = candidate as HTMLElement;
      const rectangle = element.getBoundingClientRect();
      return {
        connected: element.isConnected && element.ownerDocument.body.contains(element),
        height: Math.ceil(Math.max(element.scrollHeight, rectangle.height)),
        width: Math.ceil(Math.max(element.scrollWidth, rectangle.width)),
      };
    });
    invariant(bounds.connected, "The visual-evidence region detached before capture.");
    const image = await input.region.screenshot({ animations: "disabled", caret: "hide" });
    const png = pngDimensions(image);
    invariant(png.height + 2 >= bounds.height, "The visual-evidence region was clipped.");
    invariant(
      png.width + 2 >= bounds.width,
      "The visual-evidence region was clipped horizontally.",
    );
    await writeFile(join(input.evidenceDirectory, filename), image);
    return [
      {
        ...input.identity,
        filename,
        documentHeight: bounds.height,
        documentWidth: bounds.width,
        pngHeight: png.height,
        pngWidth: png.width,
        segmentIndex: 1,
        segmentCount: 1,
        segmentScrollY: 0,
        segmentOverlap: 0,
        rendererFingerprint: `p10b16p04-region-${canonicalValueFingerprint({
          mode: input.identity.rendererMode,
          surface: input.identity.surface,
          context: input.identity.representativeContext,
          dimensions: bounds,
        })}`,
      },
    ];
  } finally {
    if (originalViewport) await input.page.setViewportSize(originalViewport);
    await input.page.evaluate((scroll) => window.scrollTo(scroll.x, scroll.y), originalScroll);
  }
}

export async function writeP10B16P04VisualEvidenceManifest(
  evidenceDirectory: string,
  entries: readonly P10B16P04VisualEvidenceEntry[],
): Promise<string> {
  await mkdir(evidenceDirectory, { recursive: true });
  const path = join(evidenceDirectory, "p10b-16p-04-commercial-visual-evidence.json");
  const ordered = [...entries].sort((left, right) =>
    `${left.logicalCaptureId}:${left.segmentIndex}`.localeCompare(
      `${right.logicalCaptureId}:${right.segmentIndex}`,
    ),
  );
  await writeFile(
    path,
    `${JSON.stringify(
      {
        contractVersion: "p10b-16p-04-commercial-visual-evidence-v1",
        captureCount: new Set(ordered.map(({ logicalCaptureId }) => logicalCaptureId)).size,
        fileCount: ordered.length,
        entries: ordered,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return path;
}
