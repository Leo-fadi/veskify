import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const profiles = [
  "pdp-standard-commerce",
  "pdp-high-consideration",
  "pdp-gallery-led",
  "pdp-variant-led",
] as const;

const widths = [375, 768, 1024, 1440] as const;

test.beforeEach(async ({ page }) => {
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><rect width="1400" height="1000" fill="#d7cfc4"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
});

for (const profileId of profiles) {
  for (const width of widths) {
    test(`${profileId} retains governed PDP commerce at ${width}px`, async ({ page }, testInfo) => {
      const providerRequests: string[] = [];
      page.on("request", (request) => {
        const host = new URL(request.url()).hostname;
        if (host === "api.openai.com" || host.endsWith(".openai.com")) {
          providerRequests.push(request.url());
        }
      });
      await page.setViewportSize({ width, height: width === 375 ? 1000 : 1100 });
      await page.goto(`/p10b-11-pdp-proof?profile=${profileId}`);
      const root = page.locator(`[data-p10b-11-pdp-profile="${profileId}"]`);
      await expect(root).toHaveAttribute("data-profile-version", "1.0.0");
      await expect(root).toHaveAttribute("data-structural-fingerprint", /pdp-profile-/);
      await expect(root).toHaveAttribute("data-materialization-fingerprint", /v1_/);
      await expect(root).toHaveAttribute("data-snapshot-fingerprint", /v1_/);
      await expect(root).toHaveAttribute("data-responsive-viewports", "375,768,1024,1440");
      await expect(root.locator('[data-component="dynamicProductDetail"]')).toBeVisible();
      await expect(root.locator("[data-pdp-composition]")).toHaveCount(1);
      await expect(root.locator("[data-option-group-count]")).toHaveAttribute(
        "data-option-group-count",
        /[2-9]/,
      );
      await expect(root.locator('[data-frame-region="header"]')).toHaveAttribute(
        "data-frame-profile",
      );
      await expectNoStorefrontHorizontalClipping(page);
      expect(providerRequests).toEqual([]);
      await testInfo.attach(`${profileId}-${width}px`, {
        body: await root.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
    });
  }
}

test("all PDP profiles retain distinct structural composition", async ({ page }) => {
  test.setTimeout(240_000);
  const fingerprints = new Set<string>();
  const compositions = new Set<string>();
  for (const profileId of profiles) {
    await page.goto(`/p10b-11-pdp-proof?profile=${profileId}`);
    const root = page.locator(`[data-p10b-11-pdp-profile="${profileId}"]`);
    fingerprints.add((await root.getAttribute("data-structural-fingerprint"))!);
    compositions.add(
      (await root.locator("[data-pdp-composition]").getAttribute("data-pdp-composition"))!,
    );
  }
  expect(fingerprints.size).toBe(4);
  expect(compositions).toEqual(
    new Set(["standard-commerce", "high-consideration", "gallery-led", "variant-led"]),
  );
});
