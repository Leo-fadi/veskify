import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const profiles = [
  "homepage-editorial-storytelling",
  "homepage-commerce-led-discovery",
  "homepage-minimal-brand-commerce",
  "homepage-campaign-led",
  "homepage-collection-gateway",
  "homepage-high-consideration",
] as const;

const widths = [375, 768, 1024, 1440] as const;

test.beforeEach(async ({ page }) => {
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><rect width="1400" height="1000" fill="#d7cfc4"/><path d="M0 760L420 290l250 250 250-190 480 410" fill="none" stroke="#51483f" stroke-width="42"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
});

for (const profileId of profiles) {
  for (const width of widths) {
    test(`${profileId} retains commercial hierarchy at ${width}px`, async ({ page }, testInfo) => {
      const providerRequests: string[] = [];
      page.on("request", (request) => {
        const host = new URL(request.url()).hostname;
        if (host === "api.openai.com" || host.endsWith(".openai.com")) {
          providerRequests.push(request.url());
        }
      });
      await page.setViewportSize({ width, height: width === 375 ? 1000 : 1100 });
      await page.goto(`/p10b-09-homepage-proof?profile=${profileId}`);
      const root = page.locator(`[data-p10b-09-homepage-profile="${profileId}"]`);
      await expect(root).toHaveAttribute("data-profile-version", "1.0.0");
      await expect(root).toHaveAttribute("data-structural-fingerprint", /homepage-profile-/);
      await expect(root).toHaveAttribute("data-materialization-fingerprint", /v1_/);
      await expect(root).toHaveAttribute(
        "data-component-anatomy-fingerprint",
        /homepage-components-/,
      );
      await expect(root).toHaveAttribute("data-design-dna-fingerprint", /design-dna-/);
      await expect(root).toHaveAttribute("data-product-card-anatomy", /.+/);
      await expect(root).toHaveAttribute("data-snapshot-fingerprint", /v1_/);
      await expect(root.locator('[data-component="homepageHero"]')).toBeVisible();
      await expect(
        root.locator('[data-card-context="homepageMerchandising"]').first(),
      ).toBeVisible();
      await expect(root.locator('[data-frame-region="header"]')).toHaveAttribute(
        "data-frame-profile",
      );
      await expectNoStorefrontHorizontalClipping(page);
      expect(providerRequests).toEqual([]);
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) =>
            image.complete ? image.decode().catch(() => undefined) : Promise.resolve(),
          ),
        );
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
      });
      await testInfo.attach(`${profileId}-${width}px`, {
        body: await root.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
      if (process.platform === "darwin") {
        await expect(root).toHaveScreenshot(`${profileId}-${width}px.png`, {
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
        });
      }
    });
  }
}

test("all six profiles retain distinct architecture and canonical renderer identity", async ({
  page,
}) => {
  const fingerprints = new Set<string>();
  const firstImpressions = new Set<string>();
  for (const profileId of profiles) {
    await page.goto(`/p10b-09-homepage-proof?profile=${profileId}`);
    const root = page.locator(`[data-p10b-09-homepage-profile="${profileId}"]`);
    fingerprints.add((await root.getAttribute("data-structural-fingerprint"))!);
    const hero = root.locator('[data-component="homepageHero"]');
    firstImpressions.add((await hero.getAttribute("data-variant"))!);
    await expect(root.locator('[data-component="homepageHero"]')).toBeVisible();
  }
  expect(fingerprints.size).toBe(6);
  expect(firstImpressions.size).toBeGreaterThanOrEqual(5);
});
