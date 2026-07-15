import { expect, test } from "@playwright/test";

test("loads the Veskify foundation shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Aurum Nordic storefront design demo/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Review status/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /isolated Puck adapter proof/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Aurum Nordic draft preview/i })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic",
  );
});

test("loads the persisted draft project and switches locale on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/projects/project_aurum_nordic");

  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
  await page.getByRole("radio", { name: "Suomi" }).check();
  await expect(page.getByRole("heading", { name: "Tehty pohjoiseen valoon" })).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
});

test("renders the persisted draft project at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/projects/project_aurum_nordic");

  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Storefront language" })).toBeVisible();
});
