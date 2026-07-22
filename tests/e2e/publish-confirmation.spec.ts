import { expect, test, type Page } from "@playwright/test";

const projectId = "project_aurum_nordic";
const editorUrl = `/projects/${projectId}/editor`;
const publishUrl = `/projects/${projectId}/publish`;
const publishedUrl = `/projects/${projectId}/published`;

async function saveHomepageHeading(
  page: Page,
  heading: string,
  currentHeading = "Made for northern light",
) {
  await page.goto(editorUrl);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText(currentHeading, { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeChecked({
    timeout: 3_000,
  });
  const designTab = page.getByRole("button", { name: "Design", exact: true });
  await designTab.click();
  await expect(designTab).toHaveAttribute("aria-current", "page");
  const headingField = page.getByRole("textbox", { name: "Main heading", exact: true });
  await expect(headingField).toBeVisible({ timeout: 3_000 });
  await headingField.fill(heading);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();
}

test("reviews a saved draft, confirms publication, and opens the published storefront", async ({
  page,
}) => {
  await saveHomepageHeading(page, "Published from the saved draft");
  await page.goto(publishUrl);
  await page.getByRole("button", { name: "Review publish" }).click();
  await expect(page.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
  await expect(page.getByText("Content was updated in: Aurum hero (Home).")).toBeVisible();
  await page.getByRole("button", { name: "Publish storefront" }).click();
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View published storefront" }).click();
  await expect(page.getByText("Published storefront")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published from the saved draft" })).toBeVisible();
});

test("keeps published navigation on the immutable published snapshot", async ({ page }) => {
  await saveHomepageHeading(page, "Published storefront content");
  await page.goto(publishUrl);
  await page.getByRole("button", { name: "Review publish" }).click();
  await page.getByRole("button", { name: "Publish storefront" }).click();
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toBeVisible();

  await saveHomepageHeading(page, "Unpublished draft content", "Published storefront content");
  await page.goto(publishedUrl);
  await expect(page.getByRole("heading", { name: "Published storefront content" })).toBeVisible();
  await expect(page.getByText("Draft preview")).toHaveCount(0);
  await page.getByRole("link", { name: "Rings", exact: true }).click();
  await expect(page).toHaveURL(`/projects/${projectId}/published/collections/rings`);
  await expect(page.getByText("Published storefront")).toBeVisible();
  await expect(page.getByText("Draft preview")).toHaveCount(0);
  await page.getByRole("link", { name: "Aurora Ring", exact: true }).first().click();
  await expect(page).toHaveURL(`/projects/${projectId}/published/products/aurora-ring-585`);
  await expect(page.getByText("Published storefront")).toBeVisible();
  await expect(page.getByText("Draft preview")).toHaveCount(0);
});

test("cancels a review without publishing", async ({ page }) => {
  await saveHomepageHeading(page, "Review without publish");
  await page.goto(publishUrl);
  await page.getByRole("button", { name: "Review publish" }).click();
  await page.getByRole("link", { name: "Cancel and return to editor" }).click();
  await expect(page).toHaveURL(editorUrl);
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toHaveCount(0);
  await page.goto(publishedUrl);
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
});

test("recovers from a stale preparation only after the merchant reviews the latest draft", async ({
  page,
  context,
}) => {
  await saveHomepageHeading(page, "First saved draft");
  await page.goto(publishUrl);
  await page.getByRole("button", { name: "Review publish" }).click();
  await expect(page.getByRole("heading", { name: "Confirm publication" })).toBeVisible();

  const secondEditor = await context.newPage();
  await saveHomepageHeading(secondEditor, "Newer saved draft", "First saved draft");
  await secondEditor.close();

  await page.getByRole("button", { name: "Publish storefront" }).click();
  await expect(page.getByText(/changed after your review/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Review latest draft" }).click();
  await expect(page.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
  await expect(page.getByText("Content was updated in: Aurum hero (Home).")).toBeVisible();
});

test("supports keyboard publication controls", async ({ page }) => {
  await saveHomepageHeading(page, "Keyboard saved draft");
  await page.goto(publishUrl);
  await page.getByRole("button", { name: "Review publish" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
  await page.getByRole("button", { name: "Publish storefront" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toBeVisible();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`publish confirmation has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(publishUrl);
    await expect(page.getByRole("heading", { name: "Publish storefront" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
