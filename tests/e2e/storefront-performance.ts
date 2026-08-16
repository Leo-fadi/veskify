import { expect, type Locator, type Page } from "@playwright/test";

export type StorefrontPerformanceEvidence = Readonly<{
  observerSupport: Readonly<{ layoutShift: boolean; longTask: boolean }>;
  layoutShiftTotal: number | null;
  layoutShiftEntries: readonly Readonly<{
    value: number;
    sources: readonly string[];
  }>[];
  longTaskCount: number | null;
  longTaskDuration: number | null;
  domNodeCount: number;
  productCardCount: number;
  imageElementCount: number;
  eagerImageCount: number;
  lazyImageCount: number;
  highPriorityImageCount: number;
  imageRequestCount: number;
  uniqueImageRequestCount: number;
  duplicateImageRequestCount: number;
  scriptRequestCount: number;
  scriptTransferBytes: number;
}>;

/** Installs bounded, read-only performance observers before storefront navigation. */
export async function installStorefrontPerformanceObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type SafeEntry = PerformanceEntry & {
      duration: number;
      hadRecentInput?: boolean;
      sources?: readonly Readonly<{ node?: Node | null }>[];
      value?: number;
    };
    const evidence = {
      layoutShiftSupported: false,
      longTaskSupported: false,
      layoutShiftTotal: 0,
      layoutShiftEntries: [] as { value: number; sources: string[] }[],
      longTaskCount: 0,
      longTaskDuration: 0,
    };
    Object.defineProperty(window, "__veskifyStorefrontPerformance", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: evidence,
    });
    const supported = PerformanceObserver.supportedEntryTypes ?? [];
    if (supported.includes("layout-shift")) {
      evidence.layoutShiftSupported = true;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as SafeEntry[]) {
          if (!entry.hadRecentInput) {
            const value = entry.value ?? 0;
            evidence.layoutShiftTotal += value;
            if (evidence.layoutShiftEntries.length < 20) {
              evidence.layoutShiftEntries.push({
                value,
                sources: (entry.sources ?? []).slice(0, 5).map(({ node }) => {
                  if (!(node instanceof Element)) return "unavailable";
                  const authority =
                    (node.getAttribute("data-component") ??
                      node.getAttribute("data-frame-region") ??
                      node.getAttribute("data-card-anatomy") ??
                      node.id) ||
                    [...node.classList].slice(0, 2).join(".");
                  return `${node.tagName.toLowerCase()}${authority ? `[${authority}]` : ""}`;
                }),
              });
            }
          }
        }
      }).observe({ buffered: true, type: "layout-shift" });
    }
    if (supported.includes("longtask")) {
      evidence.longTaskSupported = true;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as SafeEntry[]) {
          evidence.longTaskCount += 1;
          evidence.longTaskDuration += entry.duration;
        }
      }).observe({ buffered: true, type: "longtask" });
    }
  });
}

/** Waits for deterministic render inputs without imposing a machine-speed budget. */
export async function settleStorefrontPerformanceInputs(
  page: Page,
  storefrontRoot: Locator,
): Promise<void> {
  await expect(storefrontRoot).toBeVisible();
  await expect(storefrontRoot.locator("main")).toHaveCount(1);
  await page.waitForLoadState("networkidle", { timeout: 120_000 });
  await storefrontRoot.evaluate(async (root) => {
    await root.ownerDocument.fonts.ready;
    const eagerImages = [...root.querySelectorAll<HTMLImageElement>("img")].filter(
      (image) => image.loading !== "lazy",
    );
    await Promise.all(
      eagerImages.map(
        (image) =>
          new Promise<void>((resolve, reject) => {
            const settle = () => {
              image.removeEventListener("load", loaded);
              image.removeEventListener("error", failed);
            };
            const loaded = () => {
              settle();
              resolve();
            };
            const failed = () => {
              settle();
              reject(new Error("An eager storefront image failed before performance capture."));
            };
            if (image.complete) {
              if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve();
              else failed();
              return;
            }
            image.addEventListener("load", loaded, { once: true });
            image.addEventListener("error", failed, { once: true });
          }),
      ),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

/** Captures deterministic counts and reports unsupported browser metrics as null, never zero. */
export async function captureStorefrontPerformanceEvidence(
  page: Page,
  storefrontRoot: Locator,
): Promise<StorefrontPerformanceEvidence> {
  await expect(storefrontRoot).toBeVisible();
  return storefrontRoot.evaluate((root) => {
    type BrowserEvidence = {
      layoutShiftSupported: boolean;
      longTaskSupported: boolean;
      layoutShiftTotal: number;
      layoutShiftEntries: { value: number; sources: string[] }[];
      longTaskCount: number;
      longTaskDuration: number;
    };
    const browserEvidence = (
      window as typeof window & { __veskifyStorefrontPerformance?: BrowserEvidence }
    ).__veskifyStorefrontPerformance;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const imageResources = resources.filter(({ initiatorType }) => initiatorType === "img");
    const imageUrls = imageResources.map(({ name }) => {
      const url = new URL(name, window.location.href);
      return `${url.origin}${url.pathname}${url.search}`;
    });
    const uniqueImageUrls = new Set(imageUrls);
    const scripts = resources.filter(({ initiatorType }) => initiatorType === "script");
    const images = [...root.querySelectorAll<HTMLImageElement>("img")];
    return {
      observerSupport: {
        layoutShift: browserEvidence?.layoutShiftSupported ?? false,
        longTask: browserEvidence?.longTaskSupported ?? false,
      },
      layoutShiftTotal: browserEvidence?.layoutShiftSupported
        ? browserEvidence.layoutShiftTotal
        : null,
      layoutShiftEntries: browserEvidence?.layoutShiftSupported
        ? browserEvidence.layoutShiftEntries
        : [],
      longTaskCount: browserEvidence?.longTaskSupported ? browserEvidence.longTaskCount : null,
      longTaskDuration: browserEvidence?.longTaskSupported
        ? browserEvidence.longTaskDuration
        : null,
      domNodeCount: root.querySelectorAll("*").length,
      productCardCount: root.querySelectorAll("article[data-card-anatomy]").length,
      imageElementCount: images.length,
      eagerImageCount: images.filter((image) => image.loading === "eager").length,
      lazyImageCount: images.filter((image) => image.loading === "lazy").length,
      highPriorityImageCount: images.filter(
        (image) => image.getAttribute("fetchpriority") === "high",
      ).length,
      imageRequestCount: imageUrls.length,
      uniqueImageRequestCount: uniqueImageUrls.size,
      duplicateImageRequestCount: imageUrls.length - uniqueImageUrls.size,
      scriptRequestCount: scripts.length,
      scriptTransferBytes: scripts.reduce(
        (total, resource) => total + Math.max(0, resource.transferSize),
        0,
      ),
    };
  });
}
