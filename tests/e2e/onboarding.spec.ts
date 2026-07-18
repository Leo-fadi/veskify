import { expect, test } from "@playwright/test";

const storageKey = "veskify:onboarding-session";

for (const option of [
  "Create a new storefront",
  "Redesign an existing storefront",
  "Use a demo preset",
]) {
  test(`starts onboarding with ${option.toLowerCase()}`, async ({ page }) => {
    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "How would you like to begin?" })).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(option, "i") }).check();
    await expect(page.getByRole("radio", { name: new RegExp(option, "i") })).toBeChecked();
  });
}

test("continues, goes back, refreshes and resumes the same choice", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: /Redesign an existing storefront/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Business basics" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Your saved onboarding draft has been resumed.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business basics" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("radio", { name: /Redesign an existing storefront/i })).toBeChecked();
});

test("supports Finnish and keyboard-only creation-path selection", async ({ page }) => {
  await page.goto("/projects/new");
  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Miten haluat aloittaa?" })).toBeVisible();

  const demo = page.getByRole("radio", { name: /Käytä demopohjaa/i });
  await demo.focus();
  await page.keyboard.press("Space");
  await expect(demo).toBeChecked();
  await expect(page.getByRole("button", { name: "Jatka" })).toBeEnabled();
});

test("recovers from corrupt saved onboarding without exposing technical details", async ({
  page,
}) => {
  await page.addInitScript(({ key }) => window.localStorage.setItem(key, "not valid json"), {
    key: storageKey,
  });
  await page.goto("/projects/new");
  await expect(
    page.getByRole("heading", { name: "Saved onboarding progress cannot be opened" }),
  ).toBeVisible();
  await expect(page.getByText(/schema|JSON|storage key/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Discard and restart" }).click();
  await page.getByRole("button", { name: "Yes, start over" }).click();
  await expect(page.getByRole("heading", { name: "How would you like to begin?" })).toBeVisible();
});

test("recovers from an incompatible saved onboarding version", async ({ page }) => {
  await page.addInitScript(
    ({ key }) => window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 99 })),
    { key: storageKey },
  );
  await page.goto("/projects/new");
  await expect(page.getByRole("heading", { name: /needs a fresh start/i })).toBeVisible();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`onboarding has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "How would you like to begin?" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
