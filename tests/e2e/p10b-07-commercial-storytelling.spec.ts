import { expect, test, type Page } from "@playwright/test";

const projectId = "project_lumo_fresh";
const demoToken = "p10a-04c-deterministic-browser-token";

async function premiumHomepage(page: Page) {
  await page.goto("/");
  const reset = await page.evaluate(async (token) => {
    const response = await fetch("/api/demo/p9-05b", {
      headers: { "x-veskify-p9-05b-demo-token": token },
      method: "POST",
    });
    return {
      body: (await response.json()) as { session?: { sessionId?: string } },
      ok: response.ok,
    };
  }, demoToken);
  const sessionId = reset.body.session?.sessionId;
  if (!reset.ok || !sessionId) throw new Error("P10B-07 deterministic reset failed.");
  const generated = await page.evaluate(
    async ({ sessionId: currentSession, token, targetProjectId }) => {
      const response = await fetch("/api/demo/p9-05b/generate", {
        body: JSON.stringify({
          merchantInstruction: "Redesign the entire storefront in a premium editorial direction.",
          projectId: targetProjectId,
          sessionId: currentSession,
        }),
        headers: { "content-type": "application/json", "x-veskify-p9-05b-demo-token": token },
        method: "POST",
      });
      return { body: (await response.json()) as { editorRoute?: string }, ok: response.ok };
    },
    { sessionId, token: demoToken, targetProjectId: projectId },
  );
  if (!generated.ok || !generated.body.editorRoute) {
    throw new Error("P10B-07 deterministic generation failed.");
  }
  await page.goto(generated.body.editorRoute);
  await page.getByLabel(/Storefront page|Kauppasivuston sivu/).selectOption("page_lumo_home");
  return page
    .getByLabel(/Proposal preview canvas|Ehdotuksen esikatselualue/)
    .frameLocator("iframe");
}

test("premium hero, lookbook, campaign and approved proof retain commercial responsive evidence", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const providerRequests: string[] = [];
  const browserErrors: string[] = [];
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#d8d1c7"/><path d="M0 650L400 260l250 230 210-180 340 340" fill="none" stroke="#51483f" stroke-width="36"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host === "api.openai.com" || host.endsWith(".openai.com")) {
      providerRequests.push(request.url());
    }
  });
  const frame = await premiumHomepage(page);

  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    const hero = frame.locator('[data-component="homepageHero"]');
    const campaign = frame.locator('[data-component="homepagePromotion"]');
    const editorial = frame.locator('[data-component="homepageEditorial"]');
    const proof = frame.locator('[data-component="homepageProof"]');
    await expect(hero).toHaveAttribute("data-variant", "fullBleedOverlay");
    await expect(hero).toHaveAttribute("data-responsive-transformations", "overlayToContained");
    await expect(hero.locator("[data-art-direction-fingerprint]")).toBeVisible();
    await expect(campaign).toHaveAttribute("data-variant", "imageLed");
    await expect(editorial).toHaveAttribute("data-variant", "lookbookGallery");
    await expect(editorial).toHaveAttribute("data-responsive-transformations", "lookbookCarousel");
    await expect(editorial.locator("[data-asset-id]")).toHaveCount(2);
    await expect(proof).toHaveAttribute("data-evidence-state", "approved");
    await expect(proof.locator("[data-evidence-authority]")).toHaveCount(1);
    await expect(proof.getByText(/Finnish small-batch jewellery/i)).toBeVisible();
    const overflow = await frame
      .locator("html")
      .evaluate((root) => root.scrollWidth - root.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await testInfo.attach(`p10b-07-premium-${width}px`, {
      body: await frame.locator("body").screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  }

  expect(browserErrors).toEqual([]);
  expect(providerRequests).toEqual([]);
});
