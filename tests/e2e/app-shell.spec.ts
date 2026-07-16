import { expect, test } from "@playwright/test";

test("loads the Veskify foundation shell", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Aurum Nordic storefront design demo/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Review status/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /isolated Puck adapter proof/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Aurum Nordic draft preview/i })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic",
  );
});

test("loads the isolated Puck compatibility proof", async ({ page }) => {
  await page.goto("/puck-proof");

  await expect(page.getByRole("heading", { name: "Puck adapter proof" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Puck editor proof" })).toBeVisible();
  await expect(page.getByText(/Publishing remains deferred|No draft handoff/i)).toBeVisible();
});

test("loads the persisted draft project and switches locale on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/projects/project_aurum_nordic");

  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
  const finnishControl = page.getByRole("radio", { name: "Suomi" });
  await finnishControl.focus();
  await expect(finnishControl).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Tehty pohjoiseen valoon" })).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(page.getByRole("region", { name: "Puck editor proof" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /publish|save|edit|delete/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("renders the persisted draft project at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/projects/project_aurum_nordic");

  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Storefront language" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
