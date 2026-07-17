import { expect, test } from "@playwright/test";

const url = "/projects/project_aurum_nordic/editor";

test("loads the in-memory Puck editor and switches page and locale", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByText("Aurum Nordic", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
  const canvasFrame = page
    .getByLabel("Visual editor canvas")
    .frameLocator("iframe")
    .locator("[data-veskify-canvas-root]");
  await expect(canvasFrame).toHaveAttribute("lang", "en");
  await expect(canvasFrame).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
  await expect(page.getByRole("button", { name: /save|publish/i })).toHaveCount(0);

  const switcher = page.getByLabel("Storefront page");
  await switcher.selectOption("page_collection_rings");
  await expect(page.getByRole("heading", { name: "Rings", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View selected page" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic/collections/rings",
  );
  await expect(canvasFrame).toHaveAttribute("lang", "en");
  await expect(canvasFrame).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await page.getByRole("radio", { name: "Suomi" }).check();
  await expect(page.getByRole("heading", { name: "Sormukset", exact: true }).first()).toBeVisible();
  await expect(canvasFrame).toHaveAttribute("lang", "fi");
  await switcher.selectOption("page_product_aurora");
  await expect(
    page.getByRole("heading", { name: "Aurora-sormus 585", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "View selected page" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic/products/aurora-ring-585",
  );
  await expect(canvasFrame).toHaveAttribute("lang", "fi");
  await expect(canvasFrame).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await page.getByRole("radio", { name: "English" }).check();
  await expect(canvasFrame).toHaveAttribute("lang", "en");
});

test("selects and edits an approved field, then discards the session change", async ({ page }) => {
  await page.goto(url);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  const headingField = page.getByRole("textbox", { name: "Main heading", exact: true });
  await expect(async () => {
    await canvas.getByText("Made for northern light", { exact: true }).click();
    await expect(headingField).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  await headingField.fill("A merchant-made homepage");
  await expect(
    canvas.getByRole("heading", { name: "A merchant-made homepage", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("Unsaved changes");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(
    canvas.getByRole("heading", { name: "Made for northern light", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
});

test("requests, previews, rejects and accepts deterministic proposals on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(url);
  await page.getByRole("button", { name: "Make the homepage feel more luxurious." }).click();
  await page.getByRole("button", { name: "Show proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await expect(page.getByLabel("Proposal preview canvas")).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
  await page.getByRole("button", { name: "Reject proposal" }).click();
  await expect(page.getByText(/remains exactly as it was/i)).toBeVisible();
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();

  await page.getByRole("button", { name: "Add a campaign section." }).click();
  await page.getByRole("button", { name: "Show proposal" }).click();
  await expect(page.getByRole("heading", { name: /new campaign section/i })).toBeVisible();
  await page.getByRole("button", { name: "Accept proposal" }).click();
  await expect(page.getByLabel("Draft status")).toContainText("Unsaved changes");
  await expect(page.getByText(/does not save or publish/i)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("discard closes a proposal so discarded edits cannot be accepted later", async ({ page }) => {
  await page.goto(url);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  const headingField = page.getByRole("textbox", { name: "Main heading", exact: true });
  await expect(async () => {
    await canvas.getByText("Made for northern light", { exact: true }).click();
    await expect(headingField).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  await headingField.fill("A proposal base that will be discarded");
  await expect(page.getByLabel("Draft status")).toContainText("Unsaved changes");

  await page.getByRole("button", { name: "Make the homepage feel more luxurious." }).click();
  await page.getByRole("button", { name: "Show proposal" }).click();
  await expect(page.getByLabel("Proposal preview canvas")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Discard changes" }).click();

  await expect(page.getByLabel("Proposal preview canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept proposal" })).toHaveCount(0);
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
  await expect(page.getByText(/proposal was closed because the page changed/i)).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
  await expect(canvas.getByText("Made for northern light", { exact: true })).toBeVisible();
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
