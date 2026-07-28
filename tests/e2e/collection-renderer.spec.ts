import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const collectionUrl = "/projects/project_aurum_nordic/collections/rings";

test("loads the persisted rings collection and operates bilingual demo controls by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto(collectionUrl);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
  await expect(page.getByText("Aurora Ring 585").first()).toBeVisible();
  await expect(page.getByText("Lumi Halo Ring")).toBeVisible();
  await expect(page.getByText("1 290 €")).toBeVisible();
  await expect(page.getByText("1 890 €")).toBeVisible();
  await expect(page.locator('[data-component="dynamicCollectionCommerce"]')).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Home" }),
  ).toHaveAttribute("href", "/projects/project_aurum_nordic");
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Rings" }),
  ).toHaveAttribute("href", "/projects/project_aurum_nordic/collections/rings");

  const before = await page.getByRole("article").allTextContents();
  const filterRegion = page.locator('[data-layout-region="filters"]');
  const filters = page.getByRole("button", {
    name: "Show filters",
    exact: true,
  });
  await expect(filters).toHaveCount(1);
  await expect(filters).toBeVisible();
  await filters.scrollIntoViewIfNeeded();
  await filters.focus();
  await expect(filters).toBeFocused();
  await filters.press("Enter");
  await expect(filterRegion).toHaveAttribute("open", "");
  const material = page.getByRole("checkbox", { name: /Gold/ });
  await expect(material).toBeVisible();
  await material.focus();
  await expect(material).toBeFocused();
  await page.keyboard.press("Space");
  expect(await page.getByRole("article").allTextContents()).toEqual(before);

  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { level: 1, name: "Sormukset" })).toBeVisible();
  await expect(page.getByText("Malliston sormukset")).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(page.getByRole("button", { name: "Näytä suodattimet", exact: true })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Lajittele tuotteet", exact: true }),
  ).toBeVisible();
  await expectNoStorefrontHorizontalClipping(page);
  await expect(page.getByText(/puck/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /save|publish|delete|edit/i })).toHaveCount(0);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`collection has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(collectionUrl);
    await expect(page.getByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
    await expectNoStorefrontHorizontalClipping(page);
  });
}
