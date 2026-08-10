import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const widths = [375, 768, 1024, 1440] as const;
const outcomes = [
  ["editorial-led", "homepage-editorial-storytelling", "pdp-high-consideration"],
  ["commerce-led", "homepage-high-consideration", "pdp-high-consideration"],
  ["restrained-minimal", "homepage-minimal-brand-commerce", "pdp-standard-commerce"],
] as const;
const routes = [
  "/",
  "/collections/jewellery",
  "/search",
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

const proofUrl = (intent: string, route: string) =>
  `/p10b-15-synthesis-proof?intent=${intent}&route=${encodeURIComponent(route)}`;

test.beforeEach(async ({ page }) => {
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><rect width="1400" height="1000" fill="#d8d0c6"/><path d="M0 780L410 300l260 250 250-190 480 420" fill="none" stroke="#4f453c" stroke-width="38"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
});

for (const [intent, homepageProfile] of outcomes) {
  for (const width of widths) {
    test(`${intent} remains coherent at ${width}px`, async ({ page }, testInfo) => {
      const providerRequests: string[] = [];
      page.on("request", (request) => {
        const host = new URL(request.url()).hostname;
        if (host === "api.openai.com" || host.endsWith(".openai.com")) {
          providerRequests.push(request.url());
        }
      });
      await page.setViewportSize({ width, height: width === 375 ? 1000 : 1100 });
      await page.goto(proofUrl(intent, "/"));
      const root = page.locator(`[data-p10b-15-synthesis="${intent}"]`);
      await expect(root).toHaveAttribute("data-page-profile", homepageProfile);
      await expect(root).toHaveAttribute("data-shared-frame-profile", "centered-minimal");
      await expect(root).toHaveAttribute("data-synthesis-fingerprint", /bounded-storefront/);
      await expect(root.locator('[data-frame-region="header"]')).toBeVisible();
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
      await testInfo.attach(`p10b15-${intent}-home-${width}px`, {
        body: await root.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
      if (process.platform === "darwin") {
        await expect(root).toHaveScreenshot(`p10b15-${intent}-home-${width}px.png`, {
          animations: "disabled",
          maxDiffPixelRatio: 0.001,
        });
      }
    });
  }
}

for (const [intent, , pdpProfile] of outcomes) {
  for (const [label, route] of [
    ["collection", "/collections/jewellery"],
    ["configurable-pdp", "/products/custom-halo-ring"],
  ] as const) {
    test(`${intent} retains ${label} progression`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.goto(proofUrl(intent, route));
      const root = page.locator(`[data-p10b-15-synthesis="${intent}"]`);
      await expect(root.locator('[data-frame-region="header"]')).toBeVisible();
      if (label === "collection") {
        await expect(root.locator("article[data-card-anatomy]").first()).toBeVisible();
      } else {
        await expect(root).toHaveAttribute("data-page-profile", pdpProfile);
        await expect(root.locator('[data-component="dynamicProductDetail"]')).toBeVisible();
      }
      await expectNoStorefrontHorizontalClipping(page);
      await page.evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
      });
      if (process.platform === "darwin") {
        await expect(root).toHaveScreenshot(`p10b15-${intent}-${label}-1440px.png`, {
          animations: "disabled",
          maxDiffPixelRatio: 0.001,
        });
      }
    });
  }
}

test("one synthesized complete store reaches every required route through one snapshot", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const fingerprints = new Set<string>();
  for (const route of routes) {
    await page.goto(proofUrl("commerce-led", route));
    const root = page.locator('[data-p10b-15-synthesis="commerce-led"]');
    await expect(root).toHaveAttribute("data-page-route", route);
    fingerprints.add((await root.getAttribute("data-snapshot-fingerprint"))!);
  }
  expect(fingerprints.size).toBe(1);
});
