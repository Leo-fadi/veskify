import { expect, test, type Locator, type Page } from "@playwright/test";

const url = "/projects/project_aurum_nordic/editor";
const projectUrl = "/projects/project_aurum_nordic";

async function selectHomepageHero(page: Page) {
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText("Made for northern light", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeChecked({
    timeout: 3_000,
  });
  return canvas;
}

async function activateDesignControls(page: Page) {
  const designTab = page.getByRole("button", { name: "Design", exact: true });
  await designTab.click();
  await expect(designTab).toHaveAttribute("aria-current", "page");
  const headingField = page.getByRole("textbox", { name: "Main heading", exact: true });
  await expect(headingField).toBeVisible({ timeout: 3_000 });
  return headingField;
}

async function activateAiAssistant(page: Page) {
  const aiTab = page.getByRole("button", { name: "AI assistant", exact: true });
  await aiTab.click();
  await expect(aiTab).toHaveAttribute("aria-current", "page");
}

async function openSectionActions(sectionActions: Locator) {
  const details = sectionActions.locator("details");
  if (!(await details.evaluate((element: HTMLDetailsElement) => element.open))) {
    await sectionActions.locator("summary").click();
  }
  await expect(details).toHaveJSProperty("open", true);
  await expect(sectionActions.getByRole("button", { name: "Duplicate" })).toBeVisible();
}

test("loads the in-memory Puck editor and switches page and locale", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
  const editorContext = page.getByTestId("editor-context");
  await expect(editorContext.getByText("Storefront Studio", { exact: true })).toBeVisible();
  await expect(editorContext.getByText("Aurum Nordic", { exact: true })).toBeVisible();
  await expect(editorContext.getByText("Home", { exact: true })).toBeVisible();
  const canvasFrame = page
    .getByLabel("Visual editor canvas")
    .frameLocator("iframe")
    .locator("[data-veskify-canvas-root]");
  await expect(canvasFrame).toHaveAttribute("lang", "en");
  await expect(canvasFrame).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Design", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI assistant", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.getByText("Layout", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "AI assistant", exact: true }).click();

  const switcher = page.locator("#editor-page");
  await switcher.selectOption("page_collection_rings");
  await expect(switcher).toHaveValue("page_collection_rings");
  await expect(page.getByRole("link", { name: "View selected page" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic/collections/rings",
  );
  await expect(editorContext.getByText("Rings", { exact: true })).toBeVisible();
  await expect(canvasFrame).toHaveAttribute("lang", "en");
  await expect(canvasFrame).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await page.getByRole("radio", { name: "Suomi" }).check();
  await expect(canvasFrame).toHaveAttribute("lang", "fi");
  await expect(editorContext.getByText("Sormukset", { exact: true })).toBeVisible();
  await switcher.selectOption("page_product_aurora");
  await expect(switcher).toHaveValue("page_product_aurora");
  await expect(page.getByRole("link", { name: "Näytä valittu sivu" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic/products/aurora-ring-585",
  );
  await expect(editorContext.getByText(/Aurora/)).toBeVisible();
  await expect(canvasFrame).toHaveAttribute("lang", "fi");
  await expect(canvasFrame).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await page.getByRole("radio", { name: "English" }).check();
  await expect(canvasFrame).toHaveAttribute("lang", "en");
  await expect(editorContext.getByText(/Aurora/)).toBeVisible();
});

test("shows compact editor context and no legacy project tabs in editor mode", async ({ page }) => {
  await page.goto(url);
  const editorContext = page.getByTestId("editor-context");
  await expect(editorContext.getByText("Storefront Studio", { exact: true })).toBeVisible();
  await expect(editorContext.getByText("Aurum Nordic", { exact: true })).toBeVisible();
  await expect(editorContext.getByText("Home", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Editor navigation" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Storefront Studion moduulit" })).toHaveCount(
    0,
  );

  await expect(page.getByText("Blocks", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Outline", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Puck", { exact: true })).toHaveCount(0);
});

test("non-editor project routes still show the storefront preview", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto(projectUrl);

  await expect(page.getByRole("heading", { name: "Aurum Nordic", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search (demo)" })).toBeVisible();
  await expect(page.getByLabel("Visual editor canvas")).not.toBeVisible();
});

test("keeps every collapsed editor rail destination visible and labelled", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(url);
  const navigation = page.getByRole("navigation", { name: "Global navigation" });
  const rail = page.getByRole("banner");
  await expect(rail).toHaveCSS("width", "72px");
  const home = navigation.getByRole("link", { name: "Vesko home" });
  await home.hover();
  await expect(home.getByText("Vesko home", { exact: true })).toBeVisible();

  for (const label of ["Vesko home", "Storefront Studio", "Projects", "Account"]) {
    const destination = navigation.getByRole("link", { name: label });
    await expect(destination.locator("svg")).toBeVisible();
    await destination.focus();
    await expect(destination.getByText(label, { exact: true })).toBeVisible();
  }

  const studio = navigation.getByRole("link", { name: "Storefront Studio" });
  await expect(studio).toHaveAttribute("aria-current", "page");
  expect(await studio.evaluate((element) => getComputedStyle(element, "::before").width)).not.toBe(
    "0px",
  );
});

test("uses one collapsible merchant workspace panel on each side at desktop width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url);

  await expect(page.getByRole("complementary", { name: "Pages & sections" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Contextual tools" })).toBeVisible();
  await expect(page.getByText("Blocks", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Outline", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Puck", { exact: true })).toHaveCount(0);

  const outline = page.getByRole("complementary", { name: "Pages & sections" });
  const canvas = page.getByLabel("Visual editor canvas");
  const tools = page.getByRole("region", { name: "Contextual tools" });
  const [outlineBox, canvasBox, toolsBox] = await Promise.all([
    outline.boundingBox(),
    canvas.boundingBox(),
    tools.boundingBox(),
  ]);
  if (!outlineBox || !canvasBox || !toolsBox) {
    throw new Error("The editor workspace panels must have measurable layout boxes.");
  }
  expect(outlineBox.x).toBeLessThan(canvasBox.x);
  expect(canvasBox.x).toBeLessThan(toolsBox.x);
  await expect(canvas.getByRole("region", { name: "Contextual tools" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open preview" })).toHaveCount(0);

  await page.getByRole("button", { name: "Collapse pages and sections" }).click();
  await page.getByRole("button", { name: "Collapse contextual tools" }).click();
  await expect(page.getByRole("complementary", { name: "Pages & sections" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Contextual tools" })).toHaveCount(0);

  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((element) => element.getBoundingClientRect().width >= 900)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole("button", { name: "Expand pages and sections" }).click();
  await page.getByRole("button", { name: "Expand contextual tools" }).click();
  await expect(page.getByRole("complementary", { name: "Pages & sections" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Contextual tools" })).toBeVisible();
});

test("uses drawer panels at tablet width without shrinking the editor canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(url);

  await expect(page.getByRole("complementary", { name: "Pages & sections" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Contextual tools" })).toHaveCount(0);
  const canvas = page.getByLabel("Visual editor canvas");
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((element) => element.getBoundingClientRect().width >= 800)).toBe(
    true,
  );

  await page.getByRole("button", { name: "Pages & sections" }).click();
  await expect(page.getByRole("dialog", { name: "Pages & sections" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Pages & sections" })
    .getByRole("button", { name: "Close" })
    .click();

  await page.getByRole("button", { name: "Open AI assistant" }).click();
  await expect(page.getByRole("dialog", { name: "Contextual tools" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Contextual tools" })
    .getByRole("button", { name: "Close" })
    .click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("selects and edits an approved field, then discards the session change", async ({ page }) => {
  await page.goto(url);
  const canvas = await selectHomepageHero(page);
  const headingField = await activateDesignControls(page);
  await headingField.fill("A merchant-made homepage");
  await expect(
    canvas.getByRole("heading", { name: "A merchant-made homepage", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(
    canvas.getByRole("heading", { name: "Made for northern light", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
});

test("uses canonical keyboard undo and redo outside typing controls", async ({ page }) => {
  await page.goto(url);
  const canvas = await selectHomepageHero(page);
  const sectionActions = page.getByLabel("Selected section actions");
  await openSectionActions(sectionActions);
  await sectionActions.getByRole("button", { name: "Duplicate" }).click();
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(2);
});

test("duplicates and hides the actual selected section with undo and redo on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(url);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText("Made for northern light", { exact: true }).click();
  await page.getByRole("button", { name: "Pages & sections" }).click();
  const sectionActions = page
    .getByRole("dialog", { name: "Pages & sections" })
    .getByLabel("Selected section actions");
  await openSectionActions(sectionActions);
  await expect(sectionActions.getByText("Hero", { exact: true })).toBeVisible();

  await sectionActions.getByRole("button", { name: "Duplicate" }).click();
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(2);
  await sectionActions.getByRole("button", { name: "Hide" }).click();
  await expect(canvas.getByText("Hidden section — select it to show it again")).toBeVisible();
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(1);

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog", { name: "Pages & sections" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(canvas.getByText("Hidden section — select it to show it again")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
  await page.getByRole("radio", { name: "Suomi" }).click();
  await expect(
    canvas.getByText("Piilotettu osio — valitse osio näyttääksesi sen uudelleen"),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

for (const width of [375, 768]) {
  test(`keeps compact draft safeguards available at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
    await canvas.getByText("Made for northern light", { exact: true }).click();
    const trigger = page.getByRole("button", { name: "Pages & sections" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Pages & sections" });
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

    const sectionActions = dialog.getByLabel("Selected section actions");
    await openSectionActions(sectionActions);
    await expect(sectionActions.getByText("Hero", { exact: true })).toBeVisible();
    await sectionActions.getByRole("button", { name: "Duplicate" }).click();
    await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(2);
    await expect(dialog.getByRole("button", { name: "Discard changes" })).toBeEnabled();
    await expect(
      dialog.getByText(/save these changes to the draft before publishing/i),
    ).toBeVisible();

    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("button", { name: "Discard changes" }).click();
    await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "Discard changes" })).toBeDisabled();
    await expect(
      dialog.getByText(/save draft becomes available after you make a change/i),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(trigger).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test("shows selected-section design fields in the compact contextual drawer", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(url);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText("Made for northern light", { exact: true }).click();
  await page.getByRole("button", { name: "Open AI assistant" }).click();
  const drawer = page.getByRole("dialog", { name: "Contextual tools" });
  await expect(drawer.getByRole("radio", { name: "Selected section" })).toBeChecked({
    timeout: 3_000,
  });
  await drawer.getByRole("button", { name: "Design", exact: true }).click();

  const headingField = drawer.getByRole("textbox", { name: "Main heading", exact: true });
  await expect(headingField).toBeVisible({ timeout: 3_000 });
  await headingField.fill("A compact merchant homepage");
  await expect(
    canvas.getByRole("heading", { name: "A compact merchant homepage", exact: true }),
  ).toBeVisible();

  await drawer.getByRole("button", { name: "AI assistant", exact: true }).click();
  await expect(headingField).toHaveCount(0);
  await expect(drawer.getByLabel("Design request")).toBeVisible();
});

test("requests, previews, rejects and accepts deterministic proposals on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(url);
  await page.getByRole("button", { name: "Open AI assistant" }).click();
  await page.getByRole("button", { name: "Make the homepage feel more luxurious." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await expect(page.getByLabel("Proposal preview canvas")).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText(/page remains unchanged/i)).toBeVisible();
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();

  await page.getByRole("button", { name: "Add a campaign section." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByRole("heading", { name: /campaign section/i })).toBeVisible();
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await expect(canvas.getByRole("heading", { name: "Discover Rings" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(canvas.getByRole("heading", { name: "Discover Rings" })).toHaveCount(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(canvas.getByRole("heading", { name: "Discover Rings" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();
  await page.goto("/projects/project_aurum_nordic/published");
  await expect(page.getByText("Published storefront")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discover Rings" })).toHaveCount(0);
});

test("uses the selected Puck section and shows localized grouped proposal details", async ({
  page,
}) => {
  await page.goto(url);
  await selectHomepageHero(page);
  await activateDesignControls(page);
  await activateAiAssistant(page);
  const requestPanel = page.getByLabel("Design request");
  await expect(requestPanel.getByText("Hero", { exact: true })).toBeVisible();

  await page.getByLabel("Your request").fill("Improve the hero.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await expect(page.getByRole("list", { name: "Proposed changes" })).toContainText(
    /Made for northern light|supporting text/i,
  );
  await expect(requestPanel.getByText("Hero", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("button", { name: "Make the homepage feel more luxurious." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  const details = page.getByRole("list", { name: "Proposed changes" }).getByRole("listitem");
  const detailCount = await details.count();
  expect(detailCount).toBe(10);
  await expect(details.first()).toContainText(/layout|background|typography|spacing|shapes/i);
  await page.getByRole("radio", { name: "Suomi" }).click();
  await expect(page.getByTestId("design-proposal")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hyväksy ja käytä" })).toHaveCount(0);
  await expect(page.getByLabel("Pyyntösi")).toHaveValue("Make the homepage feel more luxurious.");
  await page.getByRole("button", { name: "Tee etusivusta ylellisempi." }).click();
  await page.getByRole("button", { name: "Luo ehdotus" }).click();
  const finnishDetails = page
    .getByRole("list", { name: "Ehdotetut muutokset" })
    .getByRole("listitem");
  expect(await finnishDetails.count()).toBe(detailCount);
  await expect(finnishDetails.first()).toContainText(
    /asettelu|tausta|typografia|väljyys|muotokieli/i,
  );
});

test("discard closes a proposal so discarded edits cannot be accepted later", async ({ page }) => {
  await page.goto(url);
  const canvas = await selectHomepageHero(page);
  const headingField = await activateDesignControls(page);
  await headingField.fill("A proposal base that will be discarded");
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");

  await activateAiAssistant(page);
  await page.getByRole("button", { name: "Make the homepage feel more luxurious." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Proposal preview canvas")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Discard changes" }).click();

  await expect(page.getByLabel("Proposal preview canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept and apply" })).toHaveCount(0);
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
  await expect(page.getByText(/page changed after this request started/i)).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
  await expect(canvas.getByText("Made for northern light", { exact: true })).toBeVisible();
});

test("saved manual and accepted proposal changes survive editor refresh", async ({ page }) => {
  await page.goto(url);
  let canvas = await selectHomepageHero(page);
  const headingField = await activateDesignControls(page);
  await headingField.fill("A saved merchant homepage");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");

  await page.reload();
  canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await expect(canvas.getByRole("heading", { name: "A saved merchant homepage" })).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");

  await activateAiAssistant(page);
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
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
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
  await expect
    .poll(async () => {
      const nextId = await proposal.getAttribute("data-proposal-id");
      return nextId && nextId !== firstId ? nextId : null;
    })
    .not.toBeNull();
  await expect(page.getByLabel("Design request")).toHaveAttribute(
    "data-agent-state",
    "proposalReady",
  );
  await expect(proposal).toBeVisible();
  await expect(proposal).not.toHaveAttribute("data-proposal-id", firstId!);
  const revisedId = await proposal.getAttribute("data-proposal-id");
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");

  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect
    .poll(async () => {
      const nextId = await proposal.getAttribute("data-proposal-id");
      return nextId && nextId !== revisedId ? nextId : null;
    })
    .not.toBeNull();
  await expect(page.getByLabel("Design request")).toHaveAttribute(
    "data-agent-state",
    "proposalReady",
  );
  await expect(proposal).toBeVisible();
  await expect(proposal).not.toHaveAttribute("data-proposal-id", revisedId!);
  await expect(page.getByText(/regenerated proposal is ready/i)).toBeVisible();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
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
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
});

test("reject and cancel preserve the current editor page", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Make the layout more minimal." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");

  await page.getByRole("button", { name: "Make the layout more minimal." }).click();
  await page.getByRole("button", { name: "Create proposal" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Design proposal")).toHaveCount(0);
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`editor shell has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
