import { expect, test } from "@playwright/test";

const collectionUrl = "/projects/project_aurum_nordic/collections/rings";

test("loads the persisted rings collection and operates bilingual demo controls by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(collectionUrl);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
  await expect(page.getByText("Aurora Ring 585").first()).toBeVisible();
  await expect(page.getByText("Lumi Halo Ring")).toBeVisible();
  await expect(page.getByText("1 290 €")).toBeVisible();
  await expect(page.getByText("1 890 €")).toBeVisible();
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
  const material = page.getByRole("button", { name: "Material" });
  await material.focus();
  await expect(material).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await page.getByRole("article").allTextContents()).toEqual(before);

  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { level: 1, name: "Sormukset" })).toBeVisible();
  await expect(page.getByText("Malliston sormukset")).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(page.getByText(/Vain demoesittely/)).toBeVisible();
  await expect(page.getByText(/puck/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /save|publish|delete|edit/i })).toHaveCount(0);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`collection has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(collectionUrl);
    await expect(page.getByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
