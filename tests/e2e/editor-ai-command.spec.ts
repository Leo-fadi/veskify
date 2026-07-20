import { expect, test } from "@playwright/test";

const editorUrl = "/projects/project_aurum_nordic/editor";

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

for (const width of [375, 768, 1024, 1440]) {
  test(`editor AI command and confirmation remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(editorUrl);
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
