import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "../e2e/storefront-geometry";

const outputDirectory = process.env.P10B18B04_EVIDENCE_DIR ?? "/private/tmp/p10b18b04-evidence";

type Capture = Readonly<{
  id: string;
  profile:
    "pdp-standard-commerce" | "pdp-high-consideration" | "pdp-gallery-led" | "pdp-variant-led";
  scenario: "complex" | "simple" | "light" | "rich" | "sparse";
  width: 375 | 768 | 1024 | 1440;
  related: 0 | 1 | 3;
  evidence?: "none";
  direction?: "premiumEditorial" | "modernTechnical" | "warmApproachable";
}>;

const captures: readonly Capture[] = [
  {
    id: "standard-simple-mobile",
    profile: "pdp-standard-commerce",
    scenario: "simple",
    width: 375,
    related: 0,
  },
  {
    id: "standard-simple-wide",
    profile: "pdp-standard-commerce",
    scenario: "simple",
    width: 1440,
    related: 0,
  },
  {
    id: "standard-light-mobile",
    profile: "pdp-standard-commerce",
    scenario: "light",
    width: 375,
    related: 1,
  },
  {
    id: "standard-light-wide",
    profile: "pdp-standard-commerce",
    scenario: "light",
    width: 1440,
    related: 1,
  },
  {
    id: "variant-complex-mobile",
    profile: "pdp-variant-led",
    scenario: "complex",
    width: 375,
    related: 3,
  },
  {
    id: "variant-complex-tablet",
    profile: "pdp-variant-led",
    scenario: "complex",
    width: 768,
    related: 3,
  },
  {
    id: "variant-complex-desktop",
    profile: "pdp-variant-led",
    scenario: "complex",
    width: 1024,
    related: 3,
  },
  {
    id: "variant-complex-wide",
    profile: "pdp-variant-led",
    scenario: "complex",
    width: 1440,
    related: 3,
  },
  {
    id: "gallery-rich-mobile",
    profile: "pdp-gallery-led",
    scenario: "rich",
    width: 375,
    related: 3,
  },
  {
    id: "gallery-rich-tablet",
    profile: "pdp-gallery-led",
    scenario: "rich",
    width: 768,
    related: 3,
  },
  {
    id: "gallery-rich-desktop",
    profile: "pdp-gallery-led",
    scenario: "rich",
    width: 1024,
    related: 3,
  },
  {
    id: "gallery-rich-wide",
    profile: "pdp-gallery-led",
    scenario: "rich",
    width: 1440,
    related: 3,
  },
  {
    id: "high-evidence-mobile",
    profile: "pdp-high-consideration",
    scenario: "complex",
    width: 375,
    related: 3,
  },
  {
    id: "high-evidence-desktop",
    profile: "pdp-high-consideration",
    scenario: "complex",
    width: 1024,
    related: 3,
  },
  {
    id: "high-evidence-wide",
    profile: "pdp-high-consideration",
    scenario: "complex",
    width: 1440,
    related: 3,
  },
  {
    id: "high-no-evidence-wide",
    profile: "pdp-high-consideration",
    scenario: "complex",
    width: 1440,
    related: 1,
    evidence: "none",
  },
  {
    id: "sparse-simple-mobile",
    profile: "pdp-standard-commerce",
    scenario: "sparse",
    width: 375,
    related: 1,
  },
  {
    id: "sparse-simple-wide",
    profile: "pdp-standard-commerce",
    scenario: "sparse",
    width: 1440,
    related: 1,
  },
  {
    id: "minimal-standard-wide",
    profile: "pdp-standard-commerce",
    scenario: "light",
    width: 1440,
    related: 3,
    direction: "warmApproachable",
  },
  {
    id: "minimal-high-wide",
    profile: "pdp-high-consideration",
    scenario: "complex",
    width: 1440,
    related: 0,
    direction: "warmApproachable",
  },
] as const;

type Geometry = Readonly<{
  documentHeight: number;
  openingHeight: number;
  primaryMedia: Readonly<{ width: number; height: number; top: number }> | null;
  purchase: Readonly<{ width: number; height: number; top: number }>;
  titleTop: number;
  priceTop: number;
  firstOptionTop: number | null;
  actionTop: number;
  supportingTop: number | null;
  relatedTop: number | null;
  largestVerticalGap: number;
  optionGroupCount: number;
  canonicalMediaCount: number;
  relatedProductCount: number;
  composition: string;
  configurationComplexity: string;
  mediaDepth: string;
  stickyAction: boolean;
}>;

async function geometry(page: Page): Promise<Geometry> {
  return page.locator("[data-component='dynamicProductDetail']").evaluate((root) => {
    const bounds = (selector: string) =>
      root.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null;
    const absolute = (rect: DOMRect | null) =>
      rect
        ? {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            top: Math.round(rect.top + scrollY),
          }
        : null;
    const opening =
      root.querySelector<HTMLElement>("[data-purchase-region='opening']")?.parentElement ?? root;
    const purchase = bounds("[data-purchase-region='opening']");
    const actionElement = root.querySelector<HTMLElement>("[aria-label='Purchase action']");
    const action = actionElement?.getBoundingClientRect() ?? null;
    const positions = [
      bounds("h1"),
      bounds("[aria-label='Price']"),
      bounds("[data-option-group-id]"),
      action,
      bounds("[data-product-region='description']"),
      bounds("[data-canonical-related-product-count]"),
    ]
      .filter((entry): entry is DOMRect => Boolean(entry))
      .sort((left, right) => left.top - right.top);
    const gaps = positions
      .slice(1)
      .map((entry, index) => Math.max(0, entry.top - positions[index].bottom));
    if (!purchase || !action || !actionElement) {
      throw new Error("PDP purchase hierarchy is incomplete.");
    }
    const actionStyle = getComputedStyle(actionElement);
    return {
      documentHeight: document.documentElement.scrollHeight,
      openingHeight: Math.round(opening.getBoundingClientRect().height),
      primaryMedia: absolute(bounds("[aria-label='Product gallery'] figure img")),
      purchase: absolute(purchase)!,
      titleTop: Math.round(bounds("h1")!.top + scrollY),
      priceTop: Math.round(bounds("[aria-label='Price']")!.top + scrollY),
      firstOptionTop: absolute(bounds("[data-option-group-id]"))?.top ?? null,
      actionTop: Math.round(action.top + scrollY),
      supportingTop: absolute(bounds("[data-product-region='description']"))?.top ?? null,
      relatedTop: absolute(bounds("[data-canonical-related-product-count]"))?.top ?? null,
      largestVerticalGap: Math.round(gaps.length ? Math.max(...gaps) : 0),
      optionGroupCount: Number(
        root.getAttribute("data-option-group-count") ??
          root.querySelectorAll("[data-option-group-id]").length,
      ),
      canonicalMediaCount: Number(
        root
          .querySelector("[data-canonical-media-count]")
          ?.getAttribute("data-canonical-media-count") ?? 0,
      ),
      relatedProductCount: Number(
        root
          .querySelector("[data-related-product-count]")
          ?.getAttribute("data-related-product-count") ?? 0,
      ),
      composition: root.dataset.pdpComposition ?? "",
      configurationComplexity: root.dataset.productConfigurationComplexity ?? "",
      mediaDepth: root.dataset.productMediaDepth ?? "",
      stickyAction: actionStyle.position === "sticky" || actionStyle.position === "fixed",
    };
  });
}

test("retains twenty governed PDP quality captures and geometry", async ({ page }, testInfo) => {
  test.setTimeout(1_800_000);
  expect(captures).toHaveLength(20);
  const forbiddenRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/openai|vesko|\/api\/publish|\/api\/generate/i.test(url)) forbiddenRequests.push(url);
  });
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><rect width="1400" height="1000" fill="#d7cfc4"/><path d="M180 760 700 180l520 580" fill="none" stroke="#756b60" stroke-width="32"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
  await mkdir(outputDirectory, { recursive: true });
  const manifest: Array<Capture & Readonly<{ geometry: Geometry; screenshot: string }>> = [];
  for (const capture of captures) {
    await page.setViewportSize({
      width: capture.width,
      height: capture.width === 375 ? 900 : 1000,
    });
    const query = new URLSearchParams({
      profile: capture.profile,
      scenario: capture.scenario,
      related: String(capture.related),
      ...(capture.evidence ? { evidence: capture.evidence } : {}),
      ...(capture.direction ? { direction: capture.direction } : {}),
    });
    await page.goto(`/p10b-11-pdp-proof?${query}`);
    const root = page.locator(`[data-p10b-11-pdp-profile='${capture.profile}']`);
    await expect(root).toHaveAttribute("data-proof-scenario", capture.scenario);
    await expect(root.locator("[data-component='dynamicProductDetail']")).toHaveCount(1);
    await expect(root.locator("h1")).toBeVisible();
    await expect(root.locator("[aria-label='Price']")).toBeVisible();
    await expect(root.locator("[aria-label='Purchase action']")).toBeVisible();
    await expectNoStorefrontHorizontalClipping(page);
    const measured = await geometry(page);
    expect(measured.primaryMedia?.height ?? 0).toBeLessThanOrEqual(
      capture.width === 375 ? 360 : 710,
    );
    expect(measured.relatedProductCount).toBe(capture.related);
    if (capture.scenario === "simple" || capture.scenario === "sparse") {
      expect(measured.optionGroupCount).toBe(0);
      await expect(root.locator("[aria-label='Current configuration']")).toHaveCount(0);
    }
    if (capture.scenario === "rich") {
      expect(measured.canonicalMediaCount).toBeGreaterThanOrEqual(3);
      expect(measured.mediaDepth).toBe("rich");
      expect(measured.composition).toBe("gallery-led");
    }
    if (capture.profile === "pdp-variant-led") {
      expect(measured.composition).toBe("variant-led");
      await expect(root.locator("[aria-label='Current configuration']")).toBeVisible();
    }
    if (capture.evidence === "none") {
      await expect(root.locator("aside"), "optional evidence must omit cleanly").toHaveCount(0);
    } else if (capture.profile === "pdp-high-consideration") {
      await expect(
        root.locator("aside"),
        "approved supporting evidence must remain visible",
      ).toBeVisible();
    }
    if (
      capture.width === 375 &&
      ["pdp-standard-commerce", "pdp-gallery-led", "pdp-variant-led"].includes(capture.profile)
    ) {
      expect(measured.stickyAction).toBe(true);
    }
    const screenshot = resolve(outputDirectory, `${capture.id}.png`);
    await root.screenshot({ animations: "disabled", path: screenshot });
    await testInfo.attach(capture.id, { path: screenshot, contentType: "image/png" });
    manifest.push({ ...capture, geometry: measured, screenshot });
  }
  expect(forbiddenRequests).toEqual([]);
  await writeFile(
    resolve(outputDirectory, "p10b-18b-04-pdp-quality-manifest.json"),
    `${JSON.stringify({ contractVersion: "p10b-18b-04-browser-evidence-v1", captures: manifest, forbiddenRequests }, null, 2)}\n`,
  );
});
