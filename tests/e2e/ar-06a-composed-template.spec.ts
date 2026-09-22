import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { expect, test, type FullConfig } from "@playwright/test";
import {
  inspectAr06aCacheControl,
  inspectAr06aVisibility,
  observeComposedPage,
  settleComposedPage,
  traverseComposedControls,
} from "../helpers/ar-06a-composition-observation";

const cases = ["stack", "offset"] as const;
const locales = ["en", "fi"] as const;
const widths = [375, 768, 1024, 1440] as const;
const readingOrder = [
  "section_home_hero",
  "section_home_categories",
  "section_home_products",
  "section_home_campaign",
  "section_home_story",
  "section_home_benefits",
  "section_home_newsletter",
];
const sourcePaths = [
  "src/components/storefront/composed-page-realization.ts",
  "src/components/storefront/composed-storefront-page.tsx",
  "src/components/storefront/composed-storefront-page.module.css",
  "src/data/demo/ar-06a-composed-template.ts",
  "src/app/acceptance/ar-06a/page.tsx",
  "src/app/globals.css",
  "src/components/storefront/canonical-product-card.module.css",
];
const sourceHashes = Object.fromEntries(
  sourcePaths.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]),
);
const equivalent = new Map<string, Record<string, string>>();
const structures = new Map<string, string>();
const nextVersion = (
  JSON.parse(readFileSync("node_modules/next/package.json", "utf8")) as {
    version: string;
  }
).version;
function headerScope(config: FullConfig, url: string) {
  const server = config.webServer;
  expect(server?.command).toMatch(/^pnpm dev --port \d+$/u);
  expect(
    (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: { dev: string } }).scripts.dev,
  ).toBe("next dev");
  return {
    pathname: new URL(url).pathname,
    nodeEnvironment: server?.env?.NODE_ENV || "development",
    runtimeMode: server?.env?.VESKIFY_RUNTIME_MODE ?? "",
    acceptanceFlag: server?.env?.VESKIFY_AR06A_ACCEPTANCE ?? "",
    // The guarded route has one frozen deterministic fixture consumer; source
    // isolation and exact export inventories separately verify this assertion.
    approvedFixtureOnly: true,
  };
}
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2);

// Read actual text ranges and hit targets after scrolling them into view. No layout overrides.
function observeContentVisibility() {
  const root = document.querySelector<HTMLElement>("[data-ar06a-ready=true]")!;
  const samples: {
    label: string;
    content: { left: number; right: number; top: number; bottom: number };
    boundaries: { left: number; right: number; top: number; bottom: number }[];
    unobscured: boolean;
  }[] = [];
  const box = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  const record = (element: HTMLElement, r: DOMRect, label: string) => {
    const owner =
      element.closest(".store-hero__copy,[data-card-anatomy]") ?? root.querySelector("main")!;
    const boundaries = [box(owner.getBoundingClientRect())];
    for (
      let ancestor = element.parentElement;
      ancestor && root.contains(ancestor);
      ancestor = ancestor.parentElement
    ) {
      const style = getComputedStyle(ancestor);
      if (
        [style.overflowX, style.overflowY].some((value) =>
          ["hidden", "clip", "auto", "scroll"].includes(value),
        )
      )
        boundaries.push(box(ancestor.getBoundingClientRect()));
    }
    const unobscured = [0.1, 0.5, 0.9].every((fraction) => {
      const hit = document.elementFromPoint(r.left + r.width * fraction, r.top + r.height / 2);
      return hit !== null && (element.contains(hit) || hit.contains(element));
    });
    samples.push({ label, content: box(r), boundaries, unobscured });
  };
  for (const owner of root.querySelectorAll(".store-hero__copy,[data-card-anatomy]")) {
    const walker = document.createTreeWalker(owner, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const element = node.parentElement!;
      element.scrollIntoView({ block: "center", behavior: "instant" });
      const range = document.createRange();
      range.selectNodeContents(node);
      const rectangles = [...range.getClientRects()];
      if (!rectangles.length) throw new Error("Required text has no visible rectangles");
      for (const r of rectangles) record(element, r, "text: " + node.textContent.trim());
    }
  }
  for (const element of root.querySelectorAll<HTMLElement>(
    "main a[href],main button,main input,[data-card-region=media] img",
  )) {
    element.scrollIntoView({ block: "center", behavior: "instant" });
    record(
      element,
      element.getBoundingClientRect(),
      element.tagName +
        ": " +
        (element.textContent?.trim() ||
          element.getAttribute("alt") ||
          element.getAttribute("aria-label")),
    );
  }
  window.scrollTo(0, 0);
  return samples;
}

// Prewarm before individually timed cases; fresh browser contexts per capture.
test.beforeAll(async ({ browser, baseURL }, workerInfo) => {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(message.text());
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (
        url.origin !== new URL(baseURL!).origin ||
        url.pathname.startsWith("/api/") ||
        !["GET", "HEAD"].includes(request.method())
      ) {
        failures.push(request.method() + " " + url.pathname);
        await route.abort();
      } else await route.continue();
    });
    for (const layout of cases)
      for (const locale of locales) {
        const response = await page.goto("/acceptance/ar-06a?case=" + layout + "&locale=" + locale);
        expect(response?.status()).toBe(200);
        inspectAr06aCacheControl(
          response?.headers()["cache-control"],
          headerScope(workerInfo.config, page.url()),
        );
        await settleComposedPage(page);
        expect(page.url()).toBe(
          new URL("/acceptance/ar-06a?case=" + layout + "&locale=" + locale, baseURL).href,
        );
      }
    expect(failures).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const layout of cases)
  for (const locale of locales)
    for (const width of widths) {
      test(layout + " " + locale + " " + width, async ({ page, baseURL }, testInfo) => {
        const errors: string[] = [];
        const external: string[] = [];
        const forbiddenCalls: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== new URL(baseURL!).origin) {
            external.push(url.href);
            await route.abort();
          } else if (
            url.pathname.startsWith("/api/") ||
            !["GET", "HEAD"].includes(route.request().method())
          ) {
            forbiddenCalls.push(route.request().method() + " " + url.pathname);
            await route.abort();
          } else await route.continue();
        });
        await page.setViewportSize({ width, height: 1100 });
        const response = await page.goto("/acceptance/ar-06a?case=" + layout + "&locale=" + locale);
        expect(response?.status()).toBe(200);
        const rawCacheControl = response?.headers()["cache-control"];
        const cacheControl = inspectAr06aCacheControl(
          rawCacheControl,
          headerScope(testInfo.config, page.url()),
        );
        await settleComposedPage(page);
        await expect(page.locator("[data-ar06a-ready=true]")).toHaveAttribute(
          "data-active-locale",
          locale,
        );
        await expect(
          page
            .locator('[data-composed-section="section_home_hero"]')
            .getByRole("heading", { level: 2 }),
        ).toHaveText(locale === "en" ? "Made for northern light" : "Tehty pohjoiseen valoon");
        await expect(page.locator("[data-ar06a-ready=true]")).toHaveAttribute(
          "data-ar06a-layout",
          layout,
        );
        expect(page.url()).toBe(
          new URL("/acceptance/ar-06a?case=" + layout + "&locale=" + locale, baseURL).href,
        );
        const observation = await page.evaluate(observeComposedPage);
        await testInfo.attach("geometry-before-assertions", {
          body: JSON.stringify({ layout, locale, width, sourceHashes, observation }),
          contentType: "application/json",
        });
        expect(observation.locale).toBe(locale);
        expect(observation.mainCount).toBe(1);
        expect(observation.frame).toEqual({ headers: 1, footers: 1 });
        expect(observation.readingOrder).toEqual(readingOrder);
        expect(new Set(observation.readingOrder).size).toBe(readingOrder.length);
        expect(observation.overflow).toBeLessThanOrEqual(2);
        expect(observation.overflowing).toEqual([]);
        expect(observation.images.length).toBeGreaterThan(0);
        for (const image of observation.images) {
          expect(image.complete && image.naturalWidth > 0 && image.naturalHeight > 0).toBe(true);
          expect(image.box.width > 0 && image.box.height > 0).toBe(true);
        }
        const visibility = await page.evaluate(observeContentVisibility);
        await testInfo.attach("actual-content-visibility", {
          body: JSON.stringify(visibility),
          contentType: "application/json",
        });
        expect(inspectAr06aVisibility(visibility)).toEqual([]);
        const cards = page.locator(".product-grid [data-card-anatomy]");
        const cardImages = cards.locator('[data-card-region="media"] img');
        await expect(cards).toHaveCount(4);
        await expect(cards.locator('[data-card-region="heading"]')).toHaveCount(4);
        await expect(cards.locator('[data-card-region="price"]')).toHaveCount(4);
        await expect(cardImages).toHaveCount(4);
        if (layout === "offset" && width >= 1024) {
          // The 12rem track floor must produce usable media, allowing the same
          // two-pixel tolerance for the card's existing one-pixel borders.
          for (const mediaWidth of await cardImages.evaluateAll((images) =>
            images.map((image) => image.getBoundingClientRect().width),
          )) {
            expect(mediaWidth).toBeGreaterThanOrEqual(
              12 * parseFloat(observation.tokens.rootFontSize) - 2,
            );
          }
        }
        // The same registered full-width components retain their legacy column counts.
        if (layout === "stack") {
          const fullWidth = await page
            .locator(".store-hero,.product-grid")
            .evaluateAll((elements) =>
              elements.map(
                (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
              ),
            );
          expect(fullWidth).toEqual([
            width >= 768 ? 2 : 1,
            width >= 1024 ? 4 : width >= 640 ? 2 : 1,
          ]);
        }
        const [orientation, discovery] = observation.regions;
        if (layout === "offset" && width >= 1024) {
          expect(observation.pair).not.toBeNull();
          near(discovery.box.x - orientation.box.right, observation.pair!.gap);
          near(orientation.box.width, discovery.box.width);
          near(discovery.contentBox.y - orientation.contentBox.y, observation.expectedOffset);
          near(discovery.paddingBlockStart, observation.expectedOffset);
          expect(discovery.contentBox.y - orientation.contentBox.y).toBeGreaterThan(16);
        } else {
          for (let index = 1; index < observation.regions.length; index++) {
            expect(observation.regions[index].box.y).toBeGreaterThanOrEqual(
              observation.regions[index - 1].box.bottom - 2,
            );
          }
          near(discovery.box.x, orientation.box.x);
          near(discovery.paddingBlockStart, 0);
        }
        const firstGroupBottom = Math.max(orientation.box.bottom, discovery.box.bottom);
        expect(observation.regions[2].box.y).toBeGreaterThanOrEqual(firstGroupBottom - 2);
        for (let index = 3; index < observation.regions.length; index++) {
          expect(observation.regions[index].box.y).toBeGreaterThanOrEqual(
            observation.regions[index - 1].box.bottom - 2,
          );
        }
        expect(observation.focusable.length).toBeGreaterThan(0);
        const tabs = await traverseComposedControls(page, observation.focusable.length);
        expect(tabs).toEqual(observation.focusable.map((control) => control.domIndex));
        const key = locale + "-" + width;
        const { composition, candidate, ...contentIdentities } = observation.identities;
        expect(Object.keys(contentIdentities).sort()).toEqual([
          "brand",
          "catalogue",
          "content",
          "contentmedia",
          "support",
        ]);
        if (layout === "stack") {
          equivalent.set(key, contentIdentities);
          structures.set(key, composition + candidate);
        } else {
          expect(contentIdentities).toEqual(equivalent.get(key));
          expect(composition + candidate).not.toBe(structures.get(key));
        }
        expect(external).toEqual([]);
        expect(forbiddenCalls).toEqual([]);
        expect(errors).toEqual([]);
        const output = process.env.AR06A_CAPTURE_DIR ?? testInfo.outputPath("captures");
        mkdirSync(output, { recursive: true });
        const name = layout + "-" + locale + "-" + width;
        const screenshot = await page.screenshot({ fullPage: true, animations: "disabled" });
        expect(external).toEqual([]);
        expect(forbiddenCalls).toEqual([]);
        expect(errors).toEqual([]);
        writeFileSync(join(output, name + ".png"), screenshot, { flag: "wx" });
        writeFileSync(
          join(output, name + ".json"),
          JSON.stringify(
            {
              layout,
              locale,
              width,
              toleranceCssPixels: 2,
              observation,
              visibility,
              tabs,
              externalRequests: external,
              forbiddenCalls,
              errors,
              sourceHashes,
              headerEvidence: {
                nextVersion,
                rawCacheControl,
                cacheControl,
                scope: headerScope(testInfo.config, page.url()),
              },
            },
            null,
            2,
          ) + "\n",
          { flag: "wx" },
        );
      });
    }
