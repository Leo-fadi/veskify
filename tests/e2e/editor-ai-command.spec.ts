import { expect, test, type Page } from "@playwright/test";

const editorUrl = "/projects/project_aurum_nordic/editor";

async function clickCreateAndChangeContext(page: Page, change: "page" | "locale" | "section") {
  if (change === "section") {
    const productGridHeading = page
      .getByLabel("Visual editor canvas")
      .frameLocator("iframe")
      .getByText("Aurum favourites", { exact: true })
      .first();
    await productGridHeading.evaluate((heading) => {
      const create = [...window.parent.document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === "Create proposal",
      );
      if (!create) throw new Error("Create proposal button was not found.");
      create.click();
      (heading as HTMLElement).click();
    });
    return;
  }
  await page.evaluate((nextChange) => {
    const create = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Create proposal",
    );
    if (!create) throw new Error("Create proposal button was not found.");
    create.click();

    if (nextChange === "page") {
      const switcher = document.querySelector<HTMLSelectElement>("#editor-page");
      if (!switcher) throw new Error("Storefront page switcher was not found.");
      switcher.value = "page_collection_rings";
      switcher.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (nextChange === "locale") {
      const finnish = [...document.querySelectorAll<HTMLLabelElement>("label")].find(
        (label) => label.textContent?.trim() === "Suomi",
      );
      const radio = finnish?.querySelector<HTMLInputElement>('input[type="radio"]');
      if (!radio) throw new Error("Finnish locale control was not found.");
      radio.click();
      return;
    }
  }, change);
}

test("submits a localized editor command from the keyboard without mutating the draft", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const request = page.getByLabel("Your request");
  await expect(request).toHaveAttribute(
    "placeholder",
    "For example: Make the homepage feel more luxurious.",
  );
  await expect(page.getByText(/Control or Command \+ Enter/i)).toBeVisible();

  await request.fill("Make the layout more minimal.");
  await request.press("Control+Enter");
  const proposal = page.getByLabel("Design proposal");
  await expect(proposal).toBeVisible();
  await expect(proposal.getByRole("heading")).toBeFocused();
  await expect(request).toHaveValue("");
  await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");

  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("radio", { name: "Suomi" }).check();
  await expect(page.getByLabel("Pyyntösi")).toHaveAttribute(
    "placeholder",
    "Esimerkiksi: Tee etusivusta ylellisempi.",
  );
  await expect(page.getByText(/Control tai Command \+ Enter/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tee etusivusta ylellisempi." })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Make the homepage feel more luxurious." }),
  ).toHaveCount(0);
});

for (const contextChange of ["page", "locale", "section"] as const) {
  test(`${contextChange} changes supersede generation before its asynchronous result can activate`, async ({
    page,
  }) => {
    await page.goto(editorUrl);
    if (contextChange === "section") {
      const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
      await expect(async () => {
        await canvas.getByText("Made for northern light", { exact: true }).click();
        await expect(page.getByLabel("Design request")).toContainText("Aurum hero");
      }).toPass({ timeout: 15_000 });
    }
    const request = page.getByLabel("Your request");
    await request.fill(
      contextChange === "section"
        ? "Improve the selected hero."
        : "Make the homepage feel more luxurious.",
    );

    await clickCreateAndChangeContext(page, contextChange);

    await expect(page.getByLabel("Design proposal")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Accept and apply" })).toHaveCount(0);
    await expect(page.getByLabel("Draft status")).toContainText("No unsaved changes");
    await expect(
      page.getByLabel(contextChange === "locale" ? "Pyyntösi" : "Your request"),
    ).not.toHaveValue("");
  });
}

test("duplicate form activation produces one review and one accepted editor mutation", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await page.getByLabel("Your request").fill("Add a campaign section.");
  await page.evaluate(() => {
    const form = document.querySelector<HTMLTextAreaElement>("#design-request")?.form;
    if (!form) throw new Error("Design request form was not found.");
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await page.getByRole("button", { name: "Accept and apply" }).click();
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await expect(canvas.getByRole("heading", { name: "Discover Rings" })).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvas.getByRole("heading", { name: "Discover Rings" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`editor AI command and confirmation remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(editorUrl);
    if (width < 1024) await page.getByRole("button", { name: "Open AI assistant" }).click();
    const request = page.getByLabel("Your request");
    await expect(request).toBeVisible();
    await request.fill("Add a campaign section.");
    await request.press("Control+Enter");
    await expect(page.getByLabel("Design proposal")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept and apply" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
