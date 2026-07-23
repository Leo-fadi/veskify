import { expect, test, type Page } from "@playwright/test";

const editorUrl = "/projects/project_aurum_nordic/editor";

async function createProposal(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    await page.getByRole("button", { name: "Open AI assistant" }).click();
  }
  await page.getByRole("button", { name: "Make the layout more minimal." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
}

test("reviews, rejects and accepts a proposal without automatic draft mutation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(editorUrl);
  await createProposal(page);
  const card = page.getByLabel("Design proposal");
  await expect(card).toContainText("Affected page");
  await expect(card).toContainText("Affected scope");
  await expect(card).toContainText("Planned changes");
  await expect(card).toContainText("Warnings and diagnostics");
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");

  await page.getByRole("button", { name: "Reject" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/page remains unchanged/i)).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");

  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "Add a campaign section." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await page.getByRole("button", { name: "Accept and apply" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/accepted for draft application/i)).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("reloading a proposal review never applies it", async ({ page }) => {
  await page.goto(editorUrl);
  await createProposal(page);
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");

  await page.reload();
  await expect(page.getByLabel("Design proposal")).toHaveCount(0);
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
});

test("renders Finnish proposal review labels", async ({ page }) => {
  await page.goto(editorUrl);
  await page.getByRole("radio", { name: "Suomi" }).check();
  await page.getByRole("button", { name: "Tee asettelusta pelkistetympi." }).click();
  await page.getByRole("button", { name: "Luo ehdotus" }).click();
  const card = page.getByLabel("Design proposal");
  await expect(card).toContainText("Kohdesivu");
  await expect(card).toContainText("Suunnitellut muutokset");
  await expect(card).toContainText("Varoitukset ja diagnostiikka");
  await expect(page.getByRole("button", { name: "Hyväksy ja käytä" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hylkää" })).toBeVisible();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`proposal confirmation has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(editorUrl);
    await createProposal(page);
    await expect(page.getByRole("button", { name: "Accept and apply" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
