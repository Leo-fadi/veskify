import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const profiles = [
  "collection-editorial-discovery",
  "collection-catalogue-comparison",
  "collection-campaign-led-discovery",
  "collection-dense-search",
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
    test(`${profileId} preserves commercial collection authority at ${width}px`, async ({
      page,
    }, testInfo) => {
      const providerRequests: string[] = [];
      page.on("request", (request) => {
        const host = new URL(request.url()).hostname;
        if (host === "api.openai.com" || host.endsWith(".openai.com")) {
          providerRequests.push(request.url());
        }
      });
      await page.setViewportSize({ width, height: width === 375 ? 1000 : 1100 });
      await page.goto(`/p10b-10-collection-search-proof?profile=${profileId}`);
      const root = page.locator(`[data-p10b-10-collection-profile="${profileId}"]`);
      await expect(root).toHaveAttribute("data-profile-version", "1.0.0");
      await expect(root).toHaveAttribute(
        "data-structural-fingerprint",
        /collection-search-profile-/,
      );
      await expect(root).toHaveAttribute("data-materialization-fingerprint", /page-blueprint-/);
      await expect(root).toHaveAttribute(
        "data-component-anatomy-fingerprint",
        /collection-components-/,
      );
      await expect(root).toHaveAttribute("data-design-dna-fingerprint", /design-dna-/);
      await expect(root).toHaveAttribute("data-snapshot-fingerprint", /v1_/);
      await expect(root.locator('[data-component="dynamicCollectionCommerce"]')).toBeVisible();
      await expect(root.locator('[data-card-context="collectionResults"]').first()).toBeVisible();
      await expect(root.locator('[data-frame-region="header"]')).toHaveAttribute(
        "data-frame-profile",
      );
      if (profileId === "collection-campaign-led-discovery") {
        await expect(root.locator('[data-layout-region="campaign-lead"]')).toBeVisible();
        await expect(root.locator('[data-layout-region="campaign-lead"]')).toHaveAttribute(
          "data-asset-role",
          "editorialImage",
        );
      } else {
        await expect(root.locator('[data-layout-region="campaign-lead"]')).toHaveCount(0);
      }
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
    });
  }
}

test("all four profiles retain distinct structural rendering and canonical card authority", async ({
  page,
}) => {
  const fingerprints = new Set<string>();
  const variants = new Set<string>();
  const treatments = new Set<string>();
  for (const profileId of profiles) {
    await page.goto(`/p10b-10-collection-search-proof?profile=${profileId}`);
    const root = page.locator(`[data-p10b-10-collection-profile="${profileId}"]`);
    const commerce = root.locator('[data-component="dynamicCollectionCommerce"]');
    fingerprints.add((await root.getAttribute("data-structural-fingerprint"))!);
    variants.add((await commerce.getAttribute("data-variant"))!);
    treatments.add((await commerce.getAttribute("data-results-treatment"))!);
    await expect(root.locator('[data-card-context="collectionResults"]').first()).toBeVisible();
  }
  expect(fingerprints.size).toBe(4);
  expect(variants.size).toBe(4);
  expect(treatments.size).toBe(4);
});
