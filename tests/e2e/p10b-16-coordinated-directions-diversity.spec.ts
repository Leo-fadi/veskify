import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const directions = ["premium-editorial", "modern-technical", "minimal-commerce"] as const;
const widths = [375, 768, 1024, 1440] as const;
const proofUrl = (direction: string, alternative: number, route = "/") =>
  `/p10b-16-direction-proof?direction=${direction}&alternative=${alternative}&route=${encodeURIComponent(route)}`;

test.beforeEach(async ({ page }) => {
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><rect width="1400" height="1000" fill="#d8d0c6"/><path d="M0 780L410 300l260 250 250-190 480 420" fill="none" stroke="#4f453c" stroke-width="38"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
});

for (const direction of directions) {
  for (const width of widths) {
    test(`${direction} remains coordinated at ${width}px`, async ({ page }, testInfo) => {
      const providerRequests: string[] = [];
      page.on("request", (request) => {
        const host = new URL(request.url()).hostname;
        if (host === "api.openai.com" || host.endsWith(".openai.com")) {
          providerRequests.push(request.url());
        }
      });
      await page.setViewportSize({ width, height: width === 375 ? 1000 : 1100 });
      await page.goto(proofUrl(direction, 0));
      const root = page.locator(`[data-p10b-16-direction="${direction}"]`);
      await expect(root).toHaveAttribute("data-direction-fingerprint", /coordinated-direction/);
      await expect(root).toHaveAttribute("data-diversity-fingerprint", /storefront-structure/);
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
      await testInfo.attach(`p10b16-${direction}-home-${width}px`, {
        body: await root.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
      if (process.platform === "darwin") {
        await expect(root).toHaveScreenshot(`p10b16-${direction}-home-${width}px.png`, {
          animations: "disabled",
          maxDiffPixelRatio: 0.001,
        });
      }
    });
  }
}

for (const direction of directions) {
  test(`${direction} retains within-direction structural variety`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    const fingerprints = new Set<string>();
    const snapshotFingerprints = new Set<string>();
    for (const alternative of [0, 1, 2]) {
      await page.goto(proofUrl(direction, alternative));
      const root = page.locator(`[data-p10b-16-direction="${direction}"]`);
      fingerprints.add((await root.getAttribute("data-diversity-fingerprint"))!);
      snapshotFingerprints.add((await root.getAttribute("data-snapshot-fingerprint"))!);
      await expectNoStorefrontHorizontalClipping(page);
      if (alternative === 1) {
        await testInfo.attach(`p10b16-${direction}-alternative-${alternative}`, {
          body: await root.screenshot({ animations: "disabled" }),
          contentType: "image/png",
        });
      }
    }
    expect(fingerprints.size).toBe(3);
    expect(snapshotFingerprints.size).toBe(3);
  });
}

for (const direction of directions) {
  for (const [label, route] of [
    ["collection", "/collections/jewellery"],
    ["pdp", "/products/custom-halo-ring"],
  ] as const) {
    test(`${direction} coordinates its ${label} surface`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.goto(proofUrl(direction, 0, route));
      const root = page.locator(`[data-p10b-16-direction="${direction}"]`);
      await expect(root.locator('[data-frame-region="header"]')).toBeVisible();
      if (label === "collection") {
        await expect(root.locator("article[data-card-anatomy]").first()).toBeVisible();
      } else {
        await expect(root.locator('[data-component="dynamicProductDetail"]')).toBeVisible();
      }
      await expectNoStorefrontHorizontalClipping(page);
    });
  }
}

test("canonical directions are structurally distinct without provider traffic", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const fingerprints = new Set<string>();
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host === "api.openai.com" || host.endsWith(".openai.com"))
      providerRequests.push(request.url());
  });
  for (const direction of directions) {
    await page.goto(proofUrl(direction, 0));
    const root = page.locator(`[data-p10b-16-direction="${direction}"]`);
    fingerprints.add((await root.getAttribute("data-diversity-fingerprint"))!);
  }
  expect(fingerprints.size).toBe(3);
  expect(providerRequests).toEqual([]);
});
