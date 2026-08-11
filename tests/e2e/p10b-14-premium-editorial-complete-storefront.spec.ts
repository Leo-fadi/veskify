import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const widths = [375, 768, 1024, 1440] as const;
const primaryEvidence = [
  ["home", "/"],
  ["collection", "/collections/jewellery"],
  ["configurable-pdp", "/products/custom-halo-ring"],
] as const;
const routes = [
  "/",
  "/collections/jewellery",
  "/products/arc-studs",
  "/products/custom-halo-ring",
  "/pages/about",
  "/pages/contact",
  "/pages/faq",
  "/pages/shipping",
  "/pages/returns",
  "/pages/policy",
  "/cart",
  "/checkout",
  "/states/no-results",
  "/states/empty",
  "/states/error",
  "/404",
] as const;

const proofUrl = (route: string) =>
  `/p10b-14-premium-editorial-proof?route=${encodeURIComponent(route)}`;

test.beforeEach(async ({ page }) => {
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><rect width="1400" height="1000" fill="#d8d0c6"/><path d="M0 780L410 300l260 250 250-190 480 420" fill="none" stroke="#4f453c" stroke-width="38"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
});

for (const [name, route] of primaryEvidence)
  for (const width of widths) {
    test(`${name} retains complete-store coherence at ${width}px`, async ({ page }, testInfo) => {
      const providerRequests: string[] = [];
      page.on("request", (request) => {
        const host = new URL(request.url()).hostname;
        if (host === "api.openai.com" || host.endsWith(".openai.com"))
          providerRequests.push(request.url());
      });
      await page.setViewportSize({ width, height: width === 375 ? 1000 : 1100 });
      await page.goto(proofUrl(route));
      const root = page.locator('[data-p10b-14-complete-storefront="premium-editorial"]');
      await expect(root).toHaveAttribute("data-page-route", route);
      await expect(root).toHaveAttribute("data-shared-frame-profile", "centered-minimal");
      await expect(root).toHaveAttribute("data-snapshot-fingerprint", /v1_/);
      await expect(root.locator('[data-frame-region="header"]')).toBeVisible();
      if (name === "collection")
        await expect(root.locator("article[data-card-anatomy]").first()).toBeVisible();
      if (name === "configurable-pdp") {
        await expect(root.locator('[data-component="dynamicProductDetail"]')).toBeVisible();
        await expect(root.locator("[data-option-group-count]")).toHaveAttribute(
          "data-option-group-count",
          /[2-9]/,
        );
      }
      await expectNoStorefrontHorizontalClipping(page);
      expect(providerRequests).toEqual([]);
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) =>
            image.complete ? image.decode().catch(() => undefined) : Promise.resolve(),
          ),
        );
        document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
      });
      await testInfo.attach(`p10b14-${name}-${width}px`, {
        body: await root.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
      if (process.platform === "darwin")
        await expect(root).toHaveScreenshot(`p10b14-${name}-${width}px.png`, {
          animations: "disabled",
          maxDiffPixelRatio: 0.001,
        });
    });
  }

for (const [name, route, width] of [
  ["about", "/pages/about", 1440],
  ["cart", "/cart", 375],
  ["no-results", "/states/no-results", 1024],
] as const) {
  test(`${name} retains representative complete-store evidence`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(proofUrl(route));
    const root = page.locator('[data-p10b-14-complete-storefront="premium-editorial"]');
    await expect(root.locator('[data-frame-region="header"]')).toBeVisible();
    await expectNoStorefrontHorizontalClipping(page);
    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
    });
    if (process.platform === "darwin")
      await expect(root).toHaveScreenshot(`p10b14-${name}-${width}px.png`, {
        animations: "disabled",
        maxDiffPixels: 100,
      });
  });
}

test("all required routes use the same canonical snapshot, frame, and renderer", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const snapshotFingerprints = new Set<string>();
  for (const route of routes) {
    await page.goto(proofUrl(route));
    const root = page.locator('[data-p10b-14-complete-storefront="premium-editorial"]');
    await expect(root).toHaveAttribute("data-page-route", route);
    await expect(root).toHaveAttribute("data-shared-frame-profile", "centered-minimal");
    snapshotFingerprints.add((await root.getAttribute("data-snapshot-fingerprint"))!);
  }
  expect(snapshotFingerprints.size).toBe(1);
});

test("configurable PDP reaches incomplete and interactive generic option authority", async ({
  page,
}) => {
  await page.goto(proofUrl("/products/custom-halo-ring"));
  const root = page.locator('[data-p10b-14-complete-storefront="premium-editorial"]');
  await expect(root.locator('[data-complete="false"]').first()).toBeVisible();
  const optionButtons = root.locator("[data-option-group-id] button:not(:disabled)");
  expect(await optionButtons.count()).toBeGreaterThan(1);
  await optionButtons.first().click();
  await expect(optionButtons.first()).toHaveAttribute("aria-pressed", "true");
});

test("utility actions remain bounded runtime intents and are never persisted", async ({ page }) => {
  await page.goto(proofUrl("/cart"));
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("[data-last-utility-action]")).toHaveAttribute(
    "data-last-utility-action",
    "remove-line",
  );
});
