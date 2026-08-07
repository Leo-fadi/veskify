import { expect, test, type Page } from "@playwright/test";

const projectId = "project_lumo_fresh";
const demoToken = "p10a-08d-02-publication-evidence-token";
const originalHeading = "Jewellery shaped by patient hands";

function editorUrl(sessionId?: string) {
  return sessionId
    ? `/projects/${projectId}/editor?p9-05b-session=${encodeURIComponent(sessionId)}`
    : `/projects/${projectId}/editor`;
}

function publishUrl(sessionId: string, receiptId?: string) {
  const receipt = receiptId ? `&accepted-receipt=${encodeURIComponent(receiptId)}` : "";
  return `/projects/${projectId}/publish?p9-05b-session=${encodeURIComponent(sessionId)}${receipt}`;
}

function publishedUrl(sessionId: string) {
  return `/projects/${projectId}/published?p9-05b-session=${encodeURIComponent(sessionId)}`;
}

async function resetSession(page: Page): Promise<string> {
  await page.goto("/");
  const result = await page.evaluate(async (token) => {
    const response = await fetch("/api/demo/p9-05b", {
      method: "POST",
      headers: { "x-veskify-p9-05b-demo-token": token },
    });
    return { body: (await response.json()) as unknown, ok: response.ok };
  }, demoToken);
  if (
    !result.ok ||
    !result.body ||
    typeof result.body !== "object" ||
    !("session" in result.body) ||
    !result.body.session ||
    typeof result.body.session !== "object" ||
    !("sessionId" in result.body.session) ||
    typeof result.body.session.sessionId !== "string"
  ) {
    throw new Error("Publication evidence reset did not return a trusted session.");
  }
  return result.body.session.sessionId;
}

async function publishedFingerprint(page: Page): Promise<string> {
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/demo/p9-05b");
    return { body: (await response.json()) as unknown, ok: response.ok };
  });
  if (
    !result.ok ||
    !result.body ||
    typeof result.body !== "object" ||
    !("demo" in result.body) ||
    !result.body.demo ||
    typeof result.body.demo !== "object" ||
    !("publishedFingerprint" in result.body.demo) ||
    typeof result.body.demo.publishedFingerprint !== "string"
  ) {
    throw new Error("Publication evidence could not resolve the safe published fingerprint.");
  }
  return result.body.demo.publishedFingerprint;
}

async function saveHeading(
  page: Page,
  sessionId: string | undefined,
  current: string,
  next: string,
) {
  await page.goto(editorUrl(sessionId));
  await page.getByRole("radio", { name: "English" }).check();
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText(current, { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeChecked({
    timeout: 3_000,
  });
  await page.getByRole("button", { name: "Design", exact: true }).click();
  const heading = page.getByRole("textbox", { name: "Main heading", exact: true });
  await expect(heading).toBeVisible({ timeout: 3_000 });
  await heading.fill(next);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();
}

async function prepareAndConfirm(page: Page, sessionId: string, receiptId?: string) {
  await page.goto(publishUrl(sessionId, receiptId));
  await page.getByRole("radio", { name: "English" }).check();
  const prepareRequest = page.waitForRequest((request) => {
    return (
      request.url().includes("/api/storefront-publish") &&
      request.method() === "POST" &&
      (request.postData()?.includes('"action":"prepare"') ?? false)
    );
  });
  await page.getByRole("button", { name: "Review publish" }).click();
  const requestBody = (await prepareRequest).postData() ?? "";
  expect(requestBody).not.toContain("compilation");
  expect(requestBody).not.toContain("compiledResult");
  expect(requestBody).not.toContain("compileReceipt");
  if (receiptId) {
    expect(requestBody).toContain('"kind":"accepted-ai"');
    expect(requestBody).toContain(`"receiptId":"${receiptId}"`);
  } else {
    expect(requestBody).toContain('"kind":"manual"');
    expect(requestBody).not.toContain("receiptId");
  }
  await expect(page.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
  await page.getByRole("button", { name: "Publish storefront" }).click();
  await expect(
    page.getByRole("heading", { name: "Storefront published successfully" }),
  ).toBeVisible();
}

async function expectPublishedRouteChain(page: Page, sessionId: string, homeHeading: string) {
  await page.goto(publishedUrl(sessionId));
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByText("Published storefront")).toBeVisible();
  await expect(page.getByRole("heading", { name: homeHeading })).toBeVisible();
  await page.getByRole("link", { name: "Jewellery", exact: true }).click();
  await expect(page).toHaveURL(/\/published\/collections\/jewellery/);
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByRole("heading", { level: 1, name: "Jewellery" })).toBeVisible();
  await page.getByRole("button", { name: "Custom Halo Ring", exact: true }).click();
  await expect(page).toHaveURL(/\/published\/products\/custom-halo-ring/);
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByRole("heading", { level: 1, name: "Custom Halo Ring" })).toBeVisible();
  await expect(page.getByText("Published storefront")).toBeVisible();
}

async function acceptDeterministicProposal(page: Page) {
  const sessionId = await resetSession(page);
  const generated = await page.evaluate(
    async ({ targetProjectId, sessionId, token }) => {
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
    { targetProjectId: projectId, sessionId, token: demoToken },
  );
  expect(generated.ok).toBe(true);
  if (
    !generated.body ||
    typeof generated.body !== "object" ||
    !("editorRoute" in generated.body) ||
    typeof generated.body.editorRoute !== "string"
  ) {
    throw new Error("Publication evidence did not receive the deterministic proposal route.");
  }
  await page.goto(generated.body.editorRoute);
  await page.getByRole("button", { name: /Accept and apply|Hyväksy ja käytä/ }).click();
  const accepted = page.waitForResponse(
    (response) => response.url().includes("/api/demo/p9-05b/accept") && response.status() === 200,
  );
  await page
    .getByRole("button", { name: /Apply storefront proposal|Ota kauppaehdotus käyttöön/ })
    .click();
  const body = (await (await accepted).json()) as unknown;
  expect(JSON.stringify(body)).not.toContain("snapshot");
  expect(JSON.stringify(body)).not.toContain("runtime");
  const publishHref = await page
    .getByRole("link", { name: /Publish|Julkaise/, exact: true })
    .getAttribute("href");
  if (!publishHref) throw new Error("Accepted publication evidence did not expose a route.");
  const receiptId = new URL(publishHref, "http://localhost").searchParams.get("accepted-receipt");
  if (!receiptId) throw new Error("Accepted publication route did not contain an opaque receipt.");
  return { sessionId, receiptId };
}

test("manual publication renders the complete route chain and isolates later local draft edits", async ({
  page,
}) => {
  test.setTimeout(150_000);
  let externalProviderCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("api.openai.com") || request.url().includes("/api/ai/")) {
      externalProviderCalls += 1;
    }
  });
  const sessionId = await resetSession(page);
  const baselineFingerprint = await publishedFingerprint(page);
  await saveHeading(page, sessionId, originalHeading, "Publication evidence version A");
  await prepareAndConfirm(page, sessionId);
  const versionAFingerprint = await publishedFingerprint(page);
  expect(versionAFingerprint).not.toBe(baselineFingerprint);
  await expectPublishedRouteChain(page, sessionId, "Publication evidence version A");

  await saveHeading(page, undefined, "Publication evidence version A", "Unpublished version B");
  await expectPublishedRouteChain(page, sessionId, "Publication evidence version A");
  expect(await publishedFingerprint(page)).toBe(versionAFingerprint);
  expect(externalProviderCalls).toBe(0);
});

test("accepted-AI publication uses only the opaque receipt and renders the complete route chain", async ({
  page,
}) => {
  test.setTimeout(150_000);
  let externalProviderCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("api.openai.com") || request.url().includes("/api/ai/")) {
      externalProviderCalls += 1;
    }
  });
  const { sessionId, receiptId } = await acceptDeterministicProposal(page);
  await prepareAndConfirm(page, sessionId, receiptId);
  await expectPublishedRouteChain(page, sessionId, originalHeading);
  expect(externalProviderCalls).toBe(0);
});
