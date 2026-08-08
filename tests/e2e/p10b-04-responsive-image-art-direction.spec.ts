import { expect, test, type Page } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const projectId = "project_lumo_fresh";
const demoToken = "p10a-04c-deterministic-browser-token";

async function editorialProposal(page: Page) {
  await page.goto("/");
  const reset = await page.evaluate(async (token) => {
    const response = await fetch("/api/demo/p9-05b", {
      headers: { "x-veskify-p9-05b-demo-token": token },
      method: "POST",
    });
    return {
      body: (await response.json()) as { session?: { sessionId: string } },
      ok: response.ok,
    };
  }, demoToken);
  if (!reset.ok || !reset.body.session) {
    throw new Error(`P10B-04 deterministic editorial reset failed: ${JSON.stringify(reset.body)}`);
  }
  const generated = await page.evaluate(
    async ({ sessionId, token, targetProjectId }) => {
      const response = await fetch("/api/demo/p9-05b/generate", {
        body: JSON.stringify({
          merchantInstruction: "Redesign the entire storefront in a premium editorial direction.",
          projectId: targetProjectId,
          sessionId,
        }),
        headers: { "content-type": "application/json", "x-veskify-p9-05b-demo-token": token },
        method: "POST",
      });
      return (await response.json()) as { editorRoute: string };
    },
    { sessionId: reset.body.session.sessionId, token: demoToken, targetProjectId: projectId },
  );
  await page.goto(generated.editorRoute);
  await expect(
    page.getByRole("button", { name: /Hyväksy ja käytä|Accept and apply/ }),
  ).toBeVisible();
  await page.getByLabel(/Storefront page|Kauppasivuston sivu/).selectOption("page_lumo_home");
  return page
    .getByLabel(/Proposal preview canvas|Ehdotuksen esikatselualue/)
    .frameLocator("iframe");
}

test("editorial media exposes correlated four-breakpoint art-direction evidence without provider traffic", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const providerRequests: string[] = [];
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"/>',
      contentType: "image/svg+xml",
    }),
  );
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host === "api.openai.com" || host.endsWith(".openai.com"))
      providerRequests.push(request.url());
  });
  const frame = await editorialProposal(page);

  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const art = frame.locator('[data-component="homepageHero"] [data-art-direction-fingerprint]');
    await expect(art).toBeVisible();
    await expect(art).toHaveAttribute("data-art-direction-contract", "1.0.0");
    await expect(art).toHaveAttribute("data-art-direction-fingerprint", /.+/);
    await expect(art.locator("picture source")).toHaveCount(4);
    for (const breakpoint of ["mobile", "tablet", "desktop", "wide"]) {
      const source = art.locator(`source[data-art-breakpoint="${breakpoint}"]`);
      await expect(source).toHaveAttribute("data-art-crop", /natural|contain|cover|editorial/);
      await expect(source).toHaveAttribute("data-art-focal", /^0(?:\.\d+)?,0(?:\.\d+)?$|^1,1$/);
      await expect(source).toHaveAttribute(
        "data-art-ratio",
        /natural|square|portrait|landscape|wide/,
      );
      await expect(source).toHaveAttribute("data-art-overlay", /none|subtle|contrast|gradient/);
    }
  }
  expect(providerRequests).toEqual([]);
});

for (const width of [375, 1440]) {
  test(`canonical PDP media retains source lineage and responsive treatment at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/projects/project_aurum_nordic/products/aurora-ring-585");
    const art = page
      .locator("[data-art-direction-fingerprint][data-art-direction-source-id]")
      .first();
    await expect(art).toBeVisible();
    const sourceId = await art.getAttribute("data-art-direction-source-id");
    expect(sourceId).toMatch(/^asset_/);
    await expect(art.locator("picture source")).toHaveCount(4);
    await expect(page.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
    await expectNoStorefrontHorizontalClipping(page);
  });
}
