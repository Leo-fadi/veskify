import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const states = [
  ["commerce-utility-cart", "cart"],
  ["commerce-utility-no-results", "no-results"],
  ["commerce-utility-error", "error"],
  ["commerce-utility-not-found", "not-found"],
] as const;
const widths = [375, 768, 1024, 1440] as const;

for (const [profile, state] of states)
  for (const width of widths) {
    test(`${profile} remains coherent and reachable at ${width}px`, async ({ page }, testInfo) => {
      const providerRequests: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).hostname.includes("openai"))
          providerRequests.push(request.url());
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/p10b-13-utility-proof?profile=${profile}`);
      const root = page.locator(`[data-p10b-13-profile="${profile}"]`);
      await expect(root).toHaveAttribute("data-runtime-kind", state);
      await expect(root).toHaveAttribute(
        "data-structural-fingerprint",
        /commerce-utility-profile-/,
      );
      await expect(root.locator('[data-frame-region="header"]')).toBeVisible();
      await expectNoStorefrontHorizontalClipping(page);
      expect(providerRequests).toEqual([]);
      await testInfo.attach(`${profile}-${width}px`, {
        body: await root.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
    });
  }

test("cart actions dispatch only declared canonical capabilities", async ({ page }) => {
  await page.goto("/p10b-13-utility-proof?profile=commerce-utility-cart");
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("[data-last-utility-action]")).toHaveAttribute(
    "data-last-utility-action",
    "remove-line",
  );
});
