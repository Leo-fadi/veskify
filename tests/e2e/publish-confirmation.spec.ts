import { expect, test, type Page } from "@playwright/test";

const projectId = "project_lumo_fresh";
const demoToken = "publish-confirmation-deterministic-browser-token";
const originalHeading = "Jewellery shaped by patient hands";

function editorUrl(sessionId?: string) {
  return sessionId
    ? `/projects/${projectId}/editor?p9-05b-session=${encodeURIComponent(sessionId)}`
    : `/projects/${projectId}/editor`;
}

function publishUrl(sessionId: string) {
  return `/projects/${projectId}/publish?p9-05b-session=${encodeURIComponent(sessionId)}`;
}

function publishedUrl(sessionId: string) {
  return `/projects/${projectId}/published?p9-05b-session=${encodeURIComponent(sessionId)}`;
}

async function resetSession(page: Page): Promise<string> {
  await page.goto("/");
  const response = await page.evaluate(async (token) => {
    const result = await fetch("/api/demo/p9-05b", {
      headers: { "x-veskify-p9-05b-demo-token": token },
      method: "POST",
    });
    return { body: (await result.json()) as unknown, ok: result.ok };
  }, demoToken);
  if (
    !response.ok ||
    !response.body ||
    typeof response.body !== "object" ||
    !("session" in response.body) ||
    !response.body.session ||
    typeof response.body.session !== "object" ||
    !("sessionId" in response.body.session) ||
    typeof response.body.session.sessionId !== "string"
  ) {
    throw new Error("Publish confirmation test reset did not return a server session.");
  }
  return response.body.session.sessionId;
}

async function publishedFingerprint(page: Page): Promise<string> {
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/demo/p9-05b");
    return { body: (await result.json()) as unknown, ok: result.ok };
  });
  if (
    !response.ok ||
    !response.body ||
    typeof response.body !== "object" ||
    !("demo" in response.body) ||
    !response.body.demo ||
    typeof response.body.demo !== "object" ||
    !("publishedFingerprint" in response.body.demo) ||
    typeof response.body.demo.publishedFingerprint !== "string"
  ) {
    throw new Error("Publish confirmation test could not read the safe demo publication state.");
  }
  return response.body.demo.publishedFingerprint;
}

async function saveHomepageHeading(
  page: Page,
  sessionId: string | undefined,
  heading: string,
  currentHeading = originalHeading,
) {
  await page.goto(editorUrl(sessionId));
  await page.getByRole("radio", { name: "English" }).check();
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText(currentHeading, { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeChecked({
    timeout: 3_000,
  });
  const designTab = page.getByRole("button", { name: "Design", exact: true });
  await designTab.click();
  await expect(designTab).toHaveAttribute("aria-current", "page");
  const headingField = page.getByRole("textbox", { name: "Main heading", exact: true });
  await expect(headingField).toBeVisible({ timeout: 3_000 });
  await headingField.fill(heading);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();
}

async function openPublish(page: Page, sessionId: string) {
  await page.goto(publishUrl(sessionId));
  await page.getByRole("radio", { name: "English" }).check();
}

test("reviews a saved draft, confirms publication, and opens the published storefront", async ({
  page,
}) => {
  const sessionId = await resetSession(page);
  const previousPublishedFingerprint = await publishedFingerprint(page);
  await saveHomepageHeading(page, sessionId, "Published from the saved draft");
  await openPublish(page, sessionId);
  await page.getByRole("button", { name: "Review publish" }).click();
  await expect(page.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
  await expect(page.getByText("Content was updated in: Hero (Lumo Atelier).")).toBeVisible();
  await page.getByRole("button", { name: "Publish storefront" }).click();
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toBeVisible();
  await expect.poll(() => publishedFingerprint(page)).not.toBe(previousPublishedFingerprint);
  await page.getByRole("link", { name: "View published storefront" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `/projects/${projectId}/published` &&
      url.searchParams.get("p9-05b-session") === sessionId &&
      url.searchParams.has("published-revision"),
  );
  await expect(page.getByText("Published storefront")).toBeVisible();
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByRole("heading", { name: "Published from the saved draft" })).toBeVisible();
});

test("keeps published navigation on the immutable published snapshot", async ({ page }) => {
  const sessionId = await resetSession(page);
  await saveHomepageHeading(page, sessionId, "Published storefront content");
  await openPublish(page, sessionId);
  await page.getByRole("button", { name: "Review publish" }).click();
  await page.getByRole("button", { name: "Publish storefront" }).click();
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toBeVisible();

  await saveHomepageHeading(
    page,
    undefined,
    "Unpublished draft content",
    "Published storefront content",
  );
  await page.goto(publishedUrl(sessionId));
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByRole("heading", { name: "Published storefront content" })).toBeVisible();
  await expect(page.getByText("Draft preview")).toHaveCount(0);
  await page.getByRole("link", { name: "Jewellery", exact: true }).click();
  await expect(page).toHaveURL(`/projects/${projectId}/published/collections/jewellery`);
  await page.getByRole("link", { name: "Custom Halo Ring", exact: true }).first().click();
  await expect(page).toHaveURL(`/projects/${projectId}/published/products/custom-halo-ring`);
  await expect(page.getByText("Published storefront")).toBeVisible();
});

test("cancels a review without publishing", async ({ page }) => {
  const sessionId = await resetSession(page);
  await saveHomepageHeading(page, sessionId, "Review without publish");
  await openPublish(page, sessionId);
  await page.getByRole("button", { name: "Review publish" }).click();
  await page.getByRole("link", { name: "Cancel and return to editor" }).click();
  await expect(page).toHaveURL(editorUrl(sessionId));
  await page.goto(publishedUrl(sessionId));
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByRole("heading", { name: originalHeading })).toBeVisible();
});

test("recovers from a stale preparation only after the merchant reviews the latest draft", async ({
  page,
  context,
}) => {
  const sessionId = await resetSession(page);
  await saveHomepageHeading(page, sessionId, "First saved draft");
  await openPublish(page, sessionId);
  await page.getByRole("button", { name: "Review publish" }).click();
  await expect(page.getByRole("heading", { name: "Confirm publication" })).toBeVisible();

  const secondEditor = await context.newPage();
  await saveHomepageHeading(secondEditor, sessionId, "Newer saved draft", "First saved draft");
  await secondEditor.close();

  await page.getByRole("button", { name: "Publish storefront" }).click();
  await expect(page.getByText(/changed after your review/i)).toBeVisible();
  await page.getByRole("button", { name: "Review latest draft" }).click();
  await expect(page.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
  await page.getByRole("button", { name: "Publish storefront" }).click();
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toBeVisible();
});

test("supports keyboard publication controls", async ({ page }) => {
  const sessionId = await resetSession(page);
  await saveHomepageHeading(page, sessionId, "Keyboard saved draft");
  await openPublish(page, sessionId);
  await page.getByRole("button", { name: "Review publish" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
  await page.getByRole("button", { name: "Publish storefront" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toBeVisible();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`publish confirmation has no horizontal overflow at ${width}px`, async ({ page }) => {
    const sessionId = await resetSession(page);
    await page.setViewportSize({ width, height: 900 });
    await openPublish(page, sessionId);
    await expect(page.getByRole("heading", { name: "Publish storefront" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
