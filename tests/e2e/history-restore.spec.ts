import { expect, test } from "@playwright/test";

const projectId = "project_aurum_nordic";
const historyUrl = `/projects/${projectId}/history`;
const publishUrl = `/projects/${projectId}/publish`;

test("browses and navigates a previous version without falling through to the draft", async ({
  page,
}) => {
  await page.goto(publishUrl);
  await page.getByRole("link", { name: "Version history" }).click();
  await expect(page).toHaveURL(historyUrl);
  await expect(page.getByRole("heading", { name: "Previous storefront versions" })).toBeVisible();
  const publishedCard = page
    .getByRole("heading", { name: "Current published version" })
    .locator("xpath=../..");
  await publishedCard.getByRole("link", { name: "Preview" }).click();
  await expect(page).toHaveURL(/\/history\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByText("Previous version")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Rings", exact: true }).click();
  await expect(page).toHaveURL(/\/history\/[^/]+\/collections\/rings$/);
  await expect(page.getByText("Previous version")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Aurora Ring", exact: true }).first().click();
  await expect(page).toHaveURL(/\/history\/[^/]+\/products\/aurora-ring-585$/);
  await expect(page.getByText("Previous version")).toBeVisible({ timeout: 15_000 });
});

test("cancels and confirms a restore without changing the published storefront", async ({
  page,
}) => {
  await page.goto(historyUrl);
  const publishedCard = page
    .getByRole("heading", { name: "Current published version" })
    .locator("xpath=../..");
  await publishedCard.getByRole("link", { name: "Restore as draft" }).click();
  await page.getByRole("link", { name: "Return to previous versions" }).click();
  await expect(page).toHaveURL(historyUrl);

  await page
    .getByRole("heading", { name: "Current published version" })
    .locator("xpath=../..")
    .getByRole("link", { name: "Restore as draft" })
    .click();
  await page.getByRole("button", { name: "Restore as new draft" }).click();
  await expect(page.getByRole("heading", { name: "Your new saved draft is ready" })).toBeVisible();
  await page.getByRole("link", { name: "Open restored draft" }).click();
  await expect(page).toHaveURL(`/projects/${projectId}/editor`);
  await page.goto(`/projects/${projectId}/published`);
  await expect(page.getByText("Published storefront")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
});
