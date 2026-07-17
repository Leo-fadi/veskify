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
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);

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
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await expect(page.getByLabel("Proposal preview canvas")).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText(/page remains unchanged/i)).toBeVisible();
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();

  await page.getByRole("button", { name: "Add a campaign section." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByRole("heading", { name: /campaign section/i })).toBeVisible();
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await expect(page.getByLabel("Draft status")).toContainText("Unsaved changes");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("uses the selected Puck section and shows localized concrete proposal details", async ({
  page,
}) => {
  await page.goto(url);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  const headingField = page.getByRole("textbox", { name: "Main heading", exact: true });
  await expect(async () => {
    await canvas.getByText("Made for northern light", { exact: true }).click();
    await expect(headingField).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  const requestPanel = page.getByLabel("Design request");
  await expect(requestPanel.getByText("Aurum hero", { exact: true })).toBeVisible();

  await page.getByLabel("Your request").fill("Improve the hero.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await expect(page.getByRole("list", { name: "Proposed changes" })).toContainText(
    /Made for northern light|supporting text/i,
  );
  await expect(requestPanel.getByText("Aurum hero", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("button", { name: "Make the homepage feel more luxurious." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  const details = page.getByRole("list", { name: "Proposed changes" }).getByRole("listitem");
  const detailCount = await details.count();
  expect(detailCount).toBeGreaterThan(1);
  await page.getByRole("radio", { name: "Suomi" }).click();
  const finnishDetails = page
    .getByRole("list", { name: "Ehdotetut muutokset" })
    .getByRole("listitem");
  expect(await finnishDetails.count()).toBe(detailCount);
  await expect(finnishDetails.first()).toContainText(/Vaihda|Päivitä|Käytä/);
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
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Proposal preview canvas")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Discard changes" }).click();

  await expect(page.getByLabel("Proposal preview canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept and apply" })).toHaveCount(0);
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
  await expect(page.getByText(/page changed after this request started/i)).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
  await expect(canvas.getByText("Made for northern light", { exact: true })).toBeVisible();
});

test("saved manual and accepted proposal changes survive editor refresh", async ({ page }) => {
  await page.goto(url);
  let canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  const headingField = page.getByRole("textbox", { name: "Main heading", exact: true });
  await expect(async () => {
    await canvas.getByText("Made for northern light", { exact: true }).click();
    await expect(headingField).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  await headingField.fill("A saved merchant homepage");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");

  await page.reload();
  canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await expect(canvas.getByRole("heading", { name: "A saved merchant homepage" })).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");

  await page.getByRole("button", { name: "Add a campaign section." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();

  await page.reload();
  canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await expect(canvas.getByRole("heading", { name: "A saved merchant homepage" })).toBeVisible();
  await expect(canvas.getByRole("heading", { name: "Discover Rings" })).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
  await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);
});

test("revises and regenerates before accepting without changing the active draft", async ({
  page,
}) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Make the homepage feel more luxurious." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  const proposal = page.getByLabel("Design proposal");
  await expect(proposal).toBeVisible();
  const firstId = await proposal.getAttribute("data-proposal-id");

  await page.getByLabel("How should this proposal change?").fill("Make it more minimal.");
  await page.getByRole("button", { name: "Revise" }).click();
  await expect(proposal).not.toHaveAttribute("data-proposal-id", firstId!);
  const revisedId = await proposal.getAttribute("data-proposal-id");
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");

  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect(proposal).not.toHaveAttribute("data-proposal-id", revisedId!);
  await expect(page.getByText(/regenerated proposal is ready/i)).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
});

test("clarifies a vague request before proposal creation", async ({ page }) => {
  await page.goto(url);
  await page.getByLabel("Your request").fill("Make it better.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  const answer = page.getByLabel("Your answer");
  await expect(answer).toBeFocused();
  await expect(page.getByLabel("Design proposal")).toHaveCount(0);
  await answer.fill("Make the layout more minimal.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
});

test("reject and cancel preserve the current editor page", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Make the layout more minimal." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");

  await page.getByRole("button", { name: "Make the layout more minimal." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Design proposal")).toHaveCount(0);
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
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
