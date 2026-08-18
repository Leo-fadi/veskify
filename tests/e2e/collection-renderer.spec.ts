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
  await expect(page.getByText("€1,290")).toBeVisible();
  await expect(page.getByText("€1,890")).toBeVisible();
  const commerce = page.locator('[data-component="dynamicCollectionCommerce"]');
  await expect(commerce).toBeVisible();
  const productCards = commerce.getByRole("article");
  await expect(productCards).toHaveCount(2);
  await expect(productCards.nth(0).getByRole("button", { name: "Aurora Ring 585" })).toBeVisible();
  await expect(productCards.nth(0).getByText("In stock", { exact: true })).toBeVisible();
  await expect(productCards.nth(1).getByRole("button", { name: "Lumi Halo Ring" })).toBeVisible();
  await expect(
    productCards.nth(1).getByText("Limited availability", { exact: true }),
  ).toBeVisible();
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
  const filterPanel = filterRegion.locator('[data-filter-panel-content="true"]');
  const filterTrigger = filterRegion.getByRole("button", { name: /Show filters/ });
  await expect(page.locator('[data-filter-layout="horizontal"]')).toBeVisible();
  await expect(filterTrigger).toBeVisible();
  await expect(filterTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(filterPanel).toBeHidden();
  await filterTrigger.focus();
  await expect(filterTrigger).toBeFocused();
  await filterTrigger.press("Enter");
  await expect(filterTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(filterPanel).toBeVisible();
  await expect(filterRegion.getByRole("heading", { name: "Filters" })).toBeVisible();
  const metalColour = page.getByRole("checkbox", { name: /^Yellow gold \(1\)$/ });
  await expect(metalColour).toBeVisible();
  await metalColour.focus();
  await expect(metalColour).toBeFocused();
  await page.keyboard.press("Space");
  expect(await page.getByRole("article").allTextContents()).toEqual(before);

  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { level: 1, name: "Sormukset" })).toBeVisible();
  await expect(page.getByText("Malliston sormukset")).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(filterRegion.getByRole("heading", { name: "Suodattimet" })).toBeVisible();
  const finnishMetalColour = page.getByRole("checkbox", { name: /^Keltakulta \(1\)$/ });
  await expect(finnishMetalColour).toBeVisible();
  await finnishMetalColour.focus();
  await expect(finnishMetalColour).toBeFocused();
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
    const filterRegion = page.locator('[data-layout-region="filters"]');
    const filterPanel = filterRegion.locator('[data-filter-panel-content="true"]');
    const filterTrigger = filterRegion.getByRole("button", { name: /Show filters/ });
    const panelMode = await filterRegion
      .locator("[data-filter-panel-mode]")
      .getAttribute("data-filter-panel-mode");
    await expect(page.locator('[data-filter-layout="horizontal"]')).toBeVisible();
    expect(["disclosure", "persistent"]).toContain(panelMode);
    if (width < 1024 || panelMode === "disclosure") {
      await expect(filterTrigger).toBeVisible();
      await expect(filterTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(filterPanel).toBeHidden();
      await filterTrigger.focus();
      await expect(filterTrigger).toBeFocused();
      await filterTrigger.press("Enter");
      await expect(filterTrigger).toHaveAttribute("aria-expanded", "true");
    } else {
      await expect(filterTrigger).toBeHidden();
    }
    await expect(filterPanel).toBeVisible();
    await expect(filterRegion.getByRole("heading", { name: "Filters" })).toBeVisible();
    await expect(filterRegion.getByRole("checkbox", { name: /^Yellow gold \(1\)$/ })).toBeVisible();
    await expectNoStorefrontHorizontalClipping(page);
  });
}
