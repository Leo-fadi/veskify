import { expect, test } from "@playwright/test";

test("loads the Veskify foundation shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Aurum Nordic storefront design demo/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Review status/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /isolated Puck adapter proof/i })).toBeVisible();
});
