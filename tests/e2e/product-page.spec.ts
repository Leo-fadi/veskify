import { expect, test } from "@playwright/test";

const url = "/projects/project_aurum_nordic/products/aurora-ring-585";

test("loads the bilingual Aurora product draft with visual-only controls", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
  await expect(page.getByText("Yellow gold", { exact: true })).toBeVisible();
  await expect(page.getByText("14K", { exact: true })).toBeVisible();
  await expect(page.getByText("1 290 €")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart", exact: true })).toBeVisible();
  await expect(page.getByText(/0\/20 characters.*Allowed length: 0-20 characters/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lumi Halo Ring" })).toBeVisible();
  await expect(page.locator('[data-component="dynamicProductDetail"]')).toBeVisible();
  const gallery = page.getByRole("region", { name: "Product gallery" });
  const firstImage = gallery.getByRole("button", { name: "View product image 1" });
  const secondImage = gallery.getByRole("button", { name: "View product image 2" });
  await secondImage.click();
  await expect(secondImage).toHaveAttribute("aria-pressed", "true");
  await expect(gallery.locator("figure img")).toHaveAttribute("alt", "Aurora ring side detail");
  await firstImage.focus();
  await page.keyboard.press("Enter");
  await expect(firstImage).toHaveAttribute("aria-pressed", "true");
  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { level: 1, name: "Aurora-sormus 585" })).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Materiaali, hoito ja toimitus" })).toBeVisible();
  await expect(page.getByText(/Puck editor|property panel/i)).toHaveCount(0);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`product page has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
