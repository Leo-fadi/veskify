import { expect, test, type Page } from "@playwright/test";

const hasNoHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("loads the Vesko Storefront Studio entry and exposes the working journeys", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Shape a storefront/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start storefront setup" })).toHaveAttribute(
    "href",
    "/projects/new",
  );
  await expect(page.getByRole("link", { name: "Continue editing storefront" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic/editor",
  );
  await expect(page.getByRole("link", { name: "Preview storefront" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic",
  );
  await expect(page.getByText(/Batch 1|stops before onboarding|editor is deferred/i)).toHaveCount(
    0,
  );
  await expect(page.getByText(/Veskify|Puck|Developer tools|Open visual editor/i)).toHaveCount(0);
});

test("loads the isolated Puck compatibility proof", async ({ page }) => {
  await page.goto("/puck-proof");

  await expect(page.getByRole("heading", { name: "Puck adapter proof" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Puck editor proof" })).toBeVisible();
  await expect(page.getByText(/Publishing remains deferred|No draft handoff/i)).toBeVisible();
});

test("loads the complete persisted homepage and switches locale by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects/project_aurum_nordic");

  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find your piece" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aurum favourites" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Light, held close" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quiet forms, lasting meaning" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notes from the north" })).toBeVisible();
  await expect(page.locator("header.store-header")).toHaveCount(1);
  await expect(page.locator("footer.store-footer")).toHaveCount(1);
  expect(
    await page
      .locator("header.store-header")
      .evaluate((header) =>
        Boolean(
          header.compareDocumentPosition(document.querySelector("main")!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  expect(
    await page
      .locator("footer.store-footer")
      .evaluate((footer) =>
        Boolean(
          document.querySelector("main")!.compareDocumentPosition(footer) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  await expect(page.getByText("1 290 €")).toBeVisible();
  const ringsLink = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Rings" });
  await ringsLink.focus();
  await expect(ringsLink).toBeFocused();
  const finnishControl = page.getByRole("radio", { name: "Suomi" });
  await finnishControl.focus();
  await expect(finnishControl).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Tehty pohjoiseen valoon" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Löydä oma korusi" })).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(page.getByRole("region", { name: "Puck editor proof" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /publish|save|edit|delete/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Liity uutiskirjeeseen" }).click();
  await expect(page.getByText("Vain demo — sähköpostia ei lähetetä.")).toBeVisible();
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`renders without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projects/project_aurum_nordic");
    await expect(page.getByText("Draft preview")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Storefront language" })).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
    await expect(page.locator("header.store-header")).toBeVisible();
    await expect(page.locator("footer.store-footer")).toBeVisible();
  });
}

test("keeps Finnish storefront navigation and calls to action inside the tablet viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/projects/project_aurum_nordic");
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();

  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");

  await expect(page.getByRole("heading", { name: "Tehty pohjoiseen valoon" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tutustu sormuksiin" })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Päänavigaatio" })
      .getByRole("link", { name: "Sormukset" }),
  ).toBeVisible();
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
});
