import { expect, test, type Page } from "@playwright/test";

const editorUrl = "/projects/project_aurum_nordic/editor";
const storefrontInstruction = "Apply a warm premium style across the storefront.";

async function openStorefrontProposal(page: Page, instruction = storefrontInstruction) {
  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    await page.getByRole("button", { name: "Open AI assistant" }).click();
  }
  await page.getByRole("radio", { name: "Entire storefront" }).check();
  await page.getByLabel("Your request").fill(instruction);
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Storefront design proposal")).toBeVisible();
}

test("selected-section proposal uses the existing editor flow", async ({ page }) => {
  await page.goto(editorUrl);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText("Made for northern light", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeChecked();
  await page.getByLabel("Your request").fill("Improve the selected hero.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
});

test("selected-section target falls back to Current page when its section disappears", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText("Made for northern light", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeChecked();

  await page.getByLabel("Storefront page").selectOption("page_collection_rings");

  await expect(page.getByRole("radio", { name: "Current page" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeDisabled();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
});

test("current-page proposal uses the existing editor flow", async ({ page }) => {
  await page.goto(editorUrl);
  await expect(page.getByRole("radio", { name: "Current page" })).toBeChecked();
  await page.getByLabel("Your request").fill("Make the layout more minimal.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toContainText("Home");
});

test("entire-storefront proposal shows complete merchant review", async ({ page }) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  const review = page.getByLabel("Storefront design proposal");
  await expect(review).toContainText("Homepage");
  await expect(review).toContainText("Rings");
  await expect(review).toContainText("Aurora Ring 585");
  await expect(review).not.toContainText(/page_home|APPLY_APPROVED|storefront_proposal_/);
});

test("entire-storefront Accept, Undo and Redo remain one editor action", async ({ page }) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await expect(page.getByLabel("Draft status")).toContainText("Unsaved changes");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
});

test("Save draft reloads the complete accepted storefront without changing Published", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await expect(page.getByLabel("Draft status")).toContainText("Unsaved changes");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();

  await page.reload();
  let canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");
  for (const pageId of ["page_collection_rings", "page_product_aurora"]) {
    await page.getByLabel("Storefront page").selectOption(pageId);
    canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
    await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");
  }
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");

  await page.goto("/projects/project_aurum_nordic/published");
  await expect(page.getByLabel("Published storefront")).toBeVisible();
  await expect(page.locator(".project-preview")).toHaveCSS("--brand-color-primary", "#8A5A2B");
});

test("Reject closes the storefront review without draft mutation", async ({ page }) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
});

test("stale storefront previews leave the canvas before normal editing resumes", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await openStorefrontProposal(page);
  await expect(page.getByLabel("Proposal preview canvas")).toBeVisible();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");

  await page.getByRole("radio", { name: "Suomi" }).check();

  await expect(page.getByLabel("Proposal preview canvas")).toHaveCount(0);
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
});

test("accepted storefront history survives a later rejected proposal", async ({ page }) => {
  await page.goto(editorUrl);
  const canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await openStorefrontProposal(page);
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await expect(page.getByLabel("Draft status")).toContainText("Unsaved changes");
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");

  await page.getByRole("button", { name: "Start over" }).click();
  await openStorefrontProposal(page);
  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();

  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
});

test("multiple accepted storefront proposals undo and redo in chronological order", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await openStorefrontProposal(page);
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");

  await page.getByRole("button", { name: "Start over" }).click();
  await openStorefrontProposal(
    page,
    "Use a minimal Nordic colour and typography direction throughout the site.",
  );
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#243238");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#243238");
});

test("page edits after storefront Accept are undone before the composite storefront change", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  const canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await openStorefrontProposal(page);
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");

  await canvas.getByText("Made for northern light", { exact: true }).click();
  await page
    .getByLabel("Selected section actions")
    .getByRole("button", { name: "Duplicate" })
    .click();
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(1);
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
});

test("retryable storefront failure requires an explicit Retry", async ({ page }) => {
  await page.goto(editorUrl);
  await page.getByRole("radio", { name: "Entire storefront" }).check();
  await page.getByLabel("Your request").fill("Rebuild the storefront navigation.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  const retry = page.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  await expect(retry).toBeFocused();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
});

test("target switch makes an old storefront proposal unusable", async ({ page }) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  await page.getByRole("radio", { name: "Current page" }).check();
  await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept and apply" })).toHaveCount(0);
  await expect(page.getByLabel("Design request")).toHaveAttribute("data-agent-state", "superseded");
});

test("canonical context change makes a ready proposal stale and impossible to accept", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await page.getByLabel("Your request").fill("Make the layout more minimal.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await page.getByRole("radio", { name: "Suomi" }).check();
  await expect(page.getByLabel("Design proposal")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept and apply" })).toHaveCount(0);
});

test("target selector and storefront review actions are keyboard operable", async ({ page }) => {
  await page.goto(editorUrl);
  const currentPage = page.getByRole("radio", { name: "Current page" });
  await currentPage.focus();
  await currentPage.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Entire storefront" })).toBeChecked();
  await page.getByLabel("Your request").fill(storefrontInstruction);
  await page.getByLabel("Your request").press("Control+Enter");
  await expect(page.getByLabel("Storefront design proposal").getByRole("heading")).toBeFocused();
  await page.getByRole("button", { name: "Reject" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`storefront target and review have no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(editorUrl);
    await openStorefrontProposal(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
