import { expect, test } from "@playwright/test";

const url = "/projects/project_aurum_nordic/editor";

test("loads the read-only Puck editor and switches page and locale", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByText("Aurum Nordic", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("Draft is up to date");
  await expect(page.getByRole("button", { name: /save|publish/i })).toHaveCount(0);

  const switcher = page.getByLabel("Storefront page");
  await switcher.selectOption("page_collection_rings");
  await expect(page.getByRole("heading", { name: "Rings", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View selected page" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic/collections/rings",
  );
  await page.getByRole("radio", { name: "Suomi" }).check();
  await expect(page.getByRole("heading", { name: "Sormukset", exact: true }).first()).toBeVisible();
  await switcher.selectOption("page_product_aurora");
  await expect(
    page.getByRole("heading", { name: "Aurora-sormus 585", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "View selected page" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic/products/aurora-ring-585",
  );
});

for (const width of [375, 768, 1024, 1440]) {
  test(`editor shell has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await expect(page.getByText("Aurum Nordic", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
