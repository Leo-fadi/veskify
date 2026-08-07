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

function acceptedAiAuthorityFromRequestBody(body: string | null) {
  const value = JSON.parse(body ?? "null") as unknown;
  if (
    !value ||
    typeof value !== "object" ||
    !("request" in value) ||
    !value.request ||
    typeof value.request !== "object" ||
    !("authority" in value.request) ||
    !value.request.authority ||
    typeof value.request.authority !== "object" ||
    !("kind" in value.request.authority) ||
    value.request.authority.kind !== "accepted-ai" ||
    !("receiptId" in value.request.authority) ||
    typeof value.request.authority.receiptId !== "string"
  ) {
    throw new Error("Publish preparation did not carry bounded accepted-AI authority.");
  }
  return { kind: "accepted-ai" as const, receiptId: value.request.authority.receiptId };
}

async function acceptGovernedProposal(page: Page) {
  const sessionId = await resetSession(page);
  const generated = await page.evaluate(
    async ({ projectId: targetProjectId, sessionId, token }) => {
      const response = await fetch("/api/demo/p9-05b/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-veskify-p9-05b-demo-token": token,
        },
        body: JSON.stringify({
          projectId: targetProjectId,
          sessionId,
          merchantInstruction: "Create a modern technical storefront for Lumo Atelier.",
        }),
      });
      return { body: (await response.json()) as unknown, ok: response.ok };
    },
    { projectId, sessionId, token: demoToken },
  );
  expect(generated.ok).toBe(true);
  if (
    !generated.body ||
    typeof generated.body !== "object" ||
    !("editorRoute" in generated.body) ||
    typeof generated.body.editorRoute !== "string"
  ) {
    throw new Error("Accepted-AI browser test did not receive an editor route.");
  }

  await page.goto(generated.body.editorRoute);
  await page.getByRole("button", { name: /Accept and apply|Hyväksy ja käytä/ }).click();
  const acceptanceResponse = page.waitForResponse(
    (response) => response.url().includes("/api/demo/p9-05b/accept") && response.status() === 200,
  );
  await page
    .getByRole("button", { name: /Apply storefront proposal|Ota kauppaehdotus käyttöön/ })
    .click();
  const acceptanceBody = (await (await acceptanceResponse).json()) as unknown;
  expect(JSON.stringify(acceptanceBody)).not.toContain("snapshot");
  expect(JSON.stringify(acceptanceBody)).not.toContain("runtime");
  return { sessionId };
}

test("prepares accepted-AI publication and invalidates it after a later editor mutation", async ({
  page,
}) => {
  test.setTimeout(120_000);
  let providerCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/demo/p9-05b/generate") || request.url().includes("/api/ai/")) {
      providerCalls += 1;
    }
  });
  await acceptGovernedProposal(page);

  const publishLink = page.getByRole("link", { name: /Publish|Julkaise/, exact: true });
  await expect(publishLink).toBeVisible();
  await expect(publishLink).toHaveAttribute("href", /accepted-receipt=/);
  const acceptedPublishHref = await publishLink.getAttribute("href");
  if (!acceptedPublishHref) throw new Error("Accepted-AI publish link did not expose its route.");
  const callsAfterAcceptance = providerCalls;
  const publishPage = await page.context().newPage();
  await publishPage.goto(acceptedPublishHref);
  await expect(publishPage).toHaveURL(/accepted-receipt=/);
  await publishPage.getByRole("radio", { name: "English" }).check();

  const preparationRequest = publishPage.waitForRequest((request) => {
    if (!request.url().includes("/api/storefront-publish") || request.method() !== "POST") {
      return false;
    }
    return request.postData()?.includes('"action":"prepare"') ?? false;
  });
  await publishPage.getByRole("button", { name: "Review publish" }).click();
  const prepareAuthority = acceptedAiAuthorityFromRequestBody(
    (await preparationRequest).postData(),
  );
  expect(typeof prepareAuthority.receiptId).toBe("string");
  expect(prepareAuthority).toEqual({
    kind: "accepted-ai",
    receiptId: prepareAuthority.receiptId,
  });
  await expect(publishPage.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
  await publishPage.close();

  await page.getByRole("radio", { name: "English" }).check();
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText(originalHeading, { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeChecked({
    timeout: 3_000,
  });
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(page.getByRole("button", { name: "Homepage hero — Hidden" })).toBeVisible();

  await expect(page.locator('a[href*="accepted-receipt="]')).toHaveCount(0);
  await expect(
    page.locator('[aria-disabled="true"]').filter({ hasText: /^Publish changes$/ }),
  ).toBeVisible();
  expect(providerCalls).toBe(callsAfterAcceptance);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Homepage hero — Visible" })).toBeVisible();
  await expect(page.locator('a[href*="accepted-receipt="]')).toHaveCount(0);
  await expect(
    page.locator('[aria-disabled="true"]').filter({ hasText: /^Publish changes$/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Homepage hero — Hidden" })).toBeVisible();
  await expect(page.locator('a[href*="accepted-receipt="]')).toHaveCount(0);
  await expect(
    page.locator('[aria-disabled="true"]').filter({ hasText: /^Publish changes$/ }),
  ).toBeVisible();
  expect(providerCalls).toBe(callsAfterAcceptance);

  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();
  const manualPublishLink = page.getByRole("link", { name: "Publish changes", exact: true });
  await expect(manualPublishLink).toHaveAttribute("href", /p9-05b-session=/);
  expect(await manualPublishLink.getAttribute("href")).not.toContain("accepted-receipt");
  expect(providerCalls).toBe(callsAfterAcceptance);
});

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
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `/projects/${projectId}/published/collections/jewellery` &&
      url.searchParams.get("p9-05b-session") === sessionId,
  );
  await page.getByRole("radio", { name: "English" }).check();
  await page.getByRole("button", { name: "Custom Halo Ring", exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `/projects/${projectId}/published/products/custom-halo-ring` &&
      url.searchParams.get("p9-05b-session") === sessionId,
  );
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
