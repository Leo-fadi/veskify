import { expect, test, type Page } from "@playwright/test";

const projectId = "project_lumo_fresh";
const demoToken = "p10a-08d-02-publication-evidence-token";
const originalHeading = "Jewellery shaped by patient hands";

type SnapshotIdentity = Readonly<{
  id: string;
  revision: number;
  fingerprint: string;
}>;

type PublicationEvidence = Readonly<{
  projectId: string;
  draftSnapshot: SnapshotIdentity;
  publishedSnapshot: SnapshotIdentity;
  activePublication: Readonly<{
    pointer: Readonly<{
      versionId: string;
      versionFingerprint: string;
      artifactId: string;
      artifactFingerprint: string;
      publishedSnapshotId: string;
    }>;
    version: Readonly<{
      id: string;
      sequence: number;
      predecessorVersionId: string | null;
      fingerprint: string;
      publishedSnapshot: SnapshotIdentity;
      artifactId: string;
      artifactFingerprint: string;
    }>;
    artifact: Readonly<{
      id: string;
      fingerprint: string;
      sourceSnapshot: SnapshotIdentity;
      authority:
        | Readonly<{ kind: "manual" }>
        | Readonly<{
            kind: "accepted-ai";
            receiptId: string;
            proposalId: string;
            acceptedSnapshotId: string;
            acceptedSnapshotFingerprint: string;
          }>;
    }>;
    publishedSnapshot: SnapshotIdentity;
  }> | null;
}>;

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

async function publicationEvidence(page: Page, sessionId: string): Promise<PublicationEvidence> {
  const result = await page.evaluate(
    async ({ targetProjectId, sessionId }) => {
      const response = await fetch(
        `/api/demo/p9-05b/publication-evidence?projectId=${encodeURIComponent(targetProjectId)}`,
        { headers: { "x-veskify-p9-05b-session": sessionId } },
      );
      return { body: (await response.json()) as unknown, ok: response.ok };
    },
    { targetProjectId: projectId, sessionId },
  );
  if (
    !result.ok ||
    !result.body ||
    typeof result.body !== "object" ||
    !("evidence" in result.body) ||
    !result.body.evidence ||
    typeof result.body.evidence !== "object" ||
    !("projectId" in result.body.evidence) ||
    result.body.evidence.projectId !== projectId ||
    !("draftSnapshot" in result.body.evidence) ||
    !("publishedSnapshot" in result.body.evidence) ||
    !("activePublication" in result.body.evidence)
  ) {
    throw new Error("Publication evidence could not resolve safe authoritative identities.");
  }
  return result.body.evidence as PublicationEvidence;
}

async function publicationEvidenceIsAvailable(page: Page, sessionId?: string): Promise<boolean> {
  return page.evaluate(
    async ({ targetProjectId, sessionId }) => {
      const response = await fetch(
        `/api/demo/p9-05b/publication-evidence?projectId=${encodeURIComponent(targetProjectId)}`,
        sessionId ? { headers: { "x-veskify-p9-05b-session": sessionId } } : undefined,
      );
      return response.ok;
    },
    { targetProjectId: projectId, sessionId },
  );
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

async function expectCurrentPublication(
  page: Page,
  sessionId: string,
  expected: PublicationEvidence,
) {
  const current = await publicationEvidence(page, sessionId);
  expect(current.publishedSnapshot).toEqual(expected.publishedSnapshot);
  expect(current.activePublication).toEqual(expected.activePublication);
}

async function expectPublishedRouteChain(
  page: Page,
  sessionId: string,
  homeHeading: string,
  expected: PublicationEvidence,
) {
  await page.goto(publishedUrl(sessionId));
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === `/projects/${projectId}/published` &&
      url.searchParams.get("p9-05b-session") === sessionId
    );
  });
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByText("Published storefront")).toBeVisible();
  await expect(page.getByRole("heading", { name: homeHeading })).toBeVisible();
  await expectCurrentPublication(page, sessionId, expected);
  await page.getByRole("link", { name: "Jewellery", exact: true }).click();
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === `/projects/${projectId}/published/collections/jewellery` &&
      url.searchParams.get("p9-05b-session") === sessionId
    );
  });
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByRole("heading", { level: 1, name: "Jewellery" })).toBeVisible();
  await expectCurrentPublication(page, sessionId, expected);
  await page.getByRole("button", { name: "Custom Halo Ring", exact: true }).click();
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === `/projects/${projectId}/published/products/custom-halo-ring` &&
      url.searchParams.get("p9-05b-session") === sessionId
    );
  });
  await page.getByRole("radio", { name: "English" }).check();
  await expect(page.getByRole("heading", { level: 1, name: "Custom Halo Ring" })).toBeVisible();
  await expect(page.getByText("Published storefront")).toBeVisible();
  await expectCurrentPublication(page, sessionId, expected);
}

async function acceptDeterministicProposal(page: Page) {
  const sessionId = await resetSession(page);
  const baseline = await publicationEvidence(page, sessionId);
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
  const acceptanceResponse = page.waitForResponse(
    (response) => response.url().includes("/api/demo/p9-05b/accept") && response.status() === 200,
  );
  await page
    .getByRole("button", { name: /Apply storefront proposal|Ota kauppaehdotus käyttöön/ })
    .click();
  const body = (await (await acceptanceResponse).json()) as unknown;
  expect(JSON.stringify(body)).not.toContain("snapshot");
  expect(JSON.stringify(body)).not.toContain("runtime");
  const publishHref = await page
    .getByRole("link", { name: /Publish|Julkaise/, exact: true })
    .getAttribute("href");
  if (!publishHref) throw new Error("Accepted publication evidence did not expose a route.");
  const receiptId = new URL(publishHref, "http://localhost").searchParams.get("accepted-receipt");
  if (!receiptId) throw new Error("Accepted publication route did not contain an opaque receipt.");
  const accepted = await publicationEvidence(page, sessionId);
  expect(accepted.activePublication).toEqual(baseline.activePublication);
  expect(accepted.draftSnapshot.fingerprint).not.toBe(baseline.publishedSnapshot.fingerprint);
  return { sessionId, receiptId, baseline, accepted };
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
  const baseline = await publicationEvidence(page, sessionId);
  await saveHeading(page, sessionId, originalHeading, "Publication evidence version A");
  await prepareAndConfirm(page, sessionId);
  const versionA = await publicationEvidence(page, sessionId);
  expect(versionA.publishedSnapshot.fingerprint).not.toBe(baseline.publishedSnapshot.fingerprint);
  expect(versionA.activePublication).not.toBeNull();
  await expectPublishedRouteChain(page, sessionId, "Publication evidence version A", versionA);

  await saveHeading(page, undefined, "Publication evidence version A", "Unpublished version B");
  await expectPublishedRouteChain(page, sessionId, "Publication evidence version A", versionA);
  expect((await publicationEvidence(page, sessionId)).publishedSnapshot).toEqual(
    versionA.publishedSnapshot,
  );
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
  const { sessionId, receiptId, baseline, accepted } = await acceptDeterministicProposal(page);
  await prepareAndConfirm(page, sessionId, receiptId);
  const published = await publicationEvidence(page, sessionId);
  const active = published.activePublication;
  expect(active).not.toBeNull();
  if (!active) throw new Error("Accepted-AI publication did not create an active version.");
  expect(active.version.id).not.toBe(baseline.activePublication?.version.id ?? null);
  expect(active.artifact.id).not.toBe(baseline.activePublication?.artifact.id ?? null);
  expect(published.publishedSnapshot.fingerprint).toBe(accepted.draftSnapshot.fingerprint);
  expect(active.publishedSnapshot).toEqual(published.publishedSnapshot);
  expect(active.artifact.sourceSnapshot).toEqual(accepted.draftSnapshot);
  expect(active.version.publishedSnapshot).toEqual(published.publishedSnapshot);
  expect(active.version.artifactId).toBe(active.artifact.id);
  expect(active.version.artifactFingerprint).toBe(active.artifact.fingerprint);
  expect(active.pointer.versionId).toBe(active.version.id);
  expect(active.pointer.versionFingerprint).toBe(active.version.fingerprint);
  expect(active.pointer.artifactId).toBe(active.artifact.id);
  expect(active.pointer.artifactFingerprint).toBe(active.artifact.fingerprint);
  expect(active.pointer.publishedSnapshotId).toBe(published.publishedSnapshot.id);
  expect(active.artifact.authority).toMatchObject({
    kind: "accepted-ai",
    receiptId,
    acceptedSnapshotId: accepted.draftSnapshot.id,
    acceptedSnapshotFingerprint: accepted.draftSnapshot.fingerprint,
  });
  expect(await publicationEvidenceIsAvailable(page)).toBe(false);
  expect(await publicationEvidenceIsAvailable(page, "wrong-session-authority".repeat(2))).toBe(
    false,
  );
  await expectPublishedRouteChain(page, sessionId, originalHeading, published);
  expect(externalProviderCalls).toBe(0);
});
