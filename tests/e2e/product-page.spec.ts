import { expect, test } from "@playwright/test";

const url = "/projects/project_aurum_nordic/products/aurora-ring-585";

test("loads the bilingual Aurora product draft with visual-only controls", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
  await expect(page.getByText("Yellow gold", { exact: true })).toBeVisible();
  await expect(page.getByText("14K", { exact: true })).toBeVisible();
  await expect(page.getByText("1 290 €")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart — demo only" })).toBeVisible();
  await expect(page.getByText("Maximum 20 characters")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lumi Halo Ring" })).toBeVisible();
  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { level: 1, name: "Aurora-sormus 585" })).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
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
