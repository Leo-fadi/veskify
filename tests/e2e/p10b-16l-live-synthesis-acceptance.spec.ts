import { expect, test, type Locator, type Page } from "@playwright/test";

const projectId = "project_p10b16l_karvonen_raw";
const acceptanceToken = "p10b-16l-mocked-browser-acceptance-token";
const merchantInstruction =
  "Create a complete modern technical storefront from the approved Karvonen merchant inputs while preserving every canonical commerce and product-media fact.";

type ResetBody = Readonly<{
  ok: true;
  acceptance: {
    generationStatus: string;
    providerCallCount: number;
    rawPresentation: {
      pageCount: number;
      sectionCount: number;
      hasSharedFrame: boolean;
      hasDesignDna: boolean;
      hasPageFamilySelection: boolean;
    };
  };
  session: { projectId: string; sessionId: string };
}>;

type GenerationBody = Readonly<{
  ok: true;
  generation: {
    providerId: string;
    modelId: string;
    providerCallCount: number;
    directionId: string;
    directionAuthorityFingerprint: string;
    directionFingerprint: string;
    synthesisFingerprint: string;
    structuralDiversityFingerprint: string;
    siteMapFingerprint: string;
    snapshotFingerprint: string;
    pageCount: number;
    staticDesignPageCount: number;
    dynamicRouteCount: number;
    collectionSearchArchetypeCount: number;
    productDetailArchetypeCount: number;
    pageFamilyCounts: Record<string, number>;
    dynamicRouteFamilyCounts: Record<string, number>;
    selectedProfileIds: string[];
    protectedCommerce: string;
    canonicalProductMedia: string;
    approvedAssets: string;
    validation: string;
    editorRoute: string;
  };
}>;

async function reset(page: Page): Promise<ResetBody> {
  const result = await page.evaluate(async (token) => {
    const response = await fetch("/api/demo/p10b-live", {
      method: "POST",
      headers: { "x-veskify-p10b-16l-acceptance-token": token },
    });
    return { body: (await response.json()) as unknown, status: response.status };
  }, acceptanceToken);
  expect(result.status).toBe(200);
  const body = result.body as ResetBody;
  expect(body.ok).toBe(true);
  return body;
}

async function generate(page: Page, sessionId: string): Promise<GenerationBody> {
  const result = await page.evaluate(
    async ({ instruction, projectId: requestedProjectId, sessionId, token }) => {
      const response = await fetch("/api/demo/p10b-live/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-veskify-p10b-16l-acceptance-token": token,
        },
        body: JSON.stringify({
          projectId: requestedProjectId,
          sessionId,
          merchantInstruction: instruction,
          requestedDirectionId: "modern-technical",
        }),
      });
      return { body: (await response.json()) as unknown, status: response.status };
    },
    {
      instruction: merchantInstruction,
      projectId,
      sessionId,
      token: acceptanceToken,
    },
  );
  expect(result.status).toBe(200);
  const body = result.body as GenerationBody;
  expect(body.ok).toBe(true);
  return body;
}

async function selectOptionMatching(select: Locator, label: RegExp) {
  const option = select.locator("option").filter({ hasText: label }).first();
  await expect(option).toBeAttached();
  const value = await option.getAttribute("value");
  if (!value) throw new Error(`No storefront design authority matched ${label}.`);
  await select.selectOption(value);
}

test("mocked P10B-16L synthesis reaches normal Studio review, history, save, reload and preview", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const acceptanceRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/demo/")) acceptanceRequests.push(url.pathname);
  });

  await page.goto("/");
  const resetBody = await reset(page);
  expect(resetBody.acceptance).toMatchObject({
    generationStatus: "idle",
    providerCallCount: 0,
    rawPresentation: {
      pageCount: 1,
      sectionCount: 0,
      hasSharedFrame: false,
      hasDesignDna: false,
      hasPageFamilySelection: false,
    },
  });
  expect(resetBody.session.projectId).toBe(projectId);
  expect(resetBody.session.sessionId.length).toBeGreaterThanOrEqual(32);

  const generatedBody = await generate(page, resetBody.session.sessionId);
  const generation = generatedBody.generation;
  expect(generation).toMatchObject({
    providerId: "openai-p10b-complete-storefront-synthesis-intent",
    modelId: "mocked-p10b16l-structured-intent",
    providerCallCount: 1,
    directionId: "modern-technical",
    pageCount: 28,
    staticDesignPageCount: 8,
    dynamicRouteCount: 20,
    protectedCommerce: "unchanged",
    canonicalProductMedia: "unchanged",
    approvedAssets: "unchanged",
    validation: "valid",
  });
  expect(generation.collectionSearchArchetypeCount).toBeGreaterThan(0);
  expect(generation.collectionSearchArchetypeCount).toBeLessThanOrEqual(4);
  expect(generation.productDetailArchetypeCount).toBeGreaterThan(1);
  expect(generation.productDetailArchetypeCount).toBeLessThanOrEqual(5);
  expect(generation.pageFamilyCounts).toEqual({
    cart: 1,
    checkout: 1,
    collection: 9,
    "empty-state": 1,
    "error-state": 1,
    home: 1,
    "no-results": 1,
    "not-found": 1,
    "product-detail": 10,
    "search-results": 1,
    about: 1,
  });
  expect(generation.dynamicRouteFamilyCounts).toEqual({
    collection: 9,
    "product-detail": 10,
    "search-results": 1,
  });
  const canonicalDesignAuthorityCount =
    generation.staticDesignPageCount +
    generation.collectionSearchArchetypeCount +
    generation.productDetailArchetypeCount;
  expect(canonicalDesignAuthorityCount).toBe(14);
  expect(generation.selectedProfileIds).toEqual(
    expect.arrayContaining([
      "commerce-utility-cart",
      "commerce-utility-checkout",
      "commerce-utility-no-results",
      "commerce-utility-empty",
      "commerce-utility-error",
      "commerce-utility-not-found",
    ]),
  );
  expect(generation.selectedProfileIds.some((profileId) => profileId.startsWith("homepage-"))).toBe(
    true,
  );
  expect(generation.directionAuthorityFingerprint).toMatch(/^coordinated-direction-/);
  expect(generation.directionFingerprint).toMatch(/^coordinated-direction-selection-/);
  expect(generation.synthesisFingerprint).toMatch(/^bounded-storefront-synthesis-/);
  expect(generation.structuralDiversityFingerprint).toMatch(/^storefront-structure-/);
  expect(generation.siteMapFingerprint).toMatch(/^site-map-/);
  expect(generation.snapshotFingerprint).toMatch(/^v1_/);
  expect(generation.editorRoute).toContain("p10b-16l-session=");
  expect(generation.editorRoute).not.toContain("p9-05b-session=");
  expect(Object.keys(generatedBody)).toEqual(["ok", "generation"]);
  expect(generatedBody).not.toHaveProperty("proposal");

  await page.goto(generation.editorRoute);
  const storefrontPage = page.getByLabel(/Storefront page|Kauppasivuston sivu/);
  await expect(storefrontPage).toBeVisible();
  await expect(storefrontPage.locator("option")).toHaveCount(canonicalDesignAuthorityCount);
  await expect(storefrontPage.locator("option", { hasText: "Myrskyluodon Maija" })).toHaveCount(0);
  await expect(
    storefrontPage.locator("option", { hasText: "Festive Feeniks Lux Oval timanttisormus" }),
  ).toHaveCount(0);
  const homePageId = await storefrontPage.locator("option").first().getAttribute("value");
  if (!homePageId) throw new Error("P10B-16L home page identity is unavailable.");
  const accept = page.getByRole("button", { name: /Hyväksy ja käytä|Accept and apply/ });
  await expect(accept).toBeVisible();
  const proposalReview = page.getByLabel(
    /Verkkokaupan suunnitteluehdotus|Storefront design proposal/,
  );
  const migrationReview = proposalReview.getByTestId("dynamic-commerce-migration-review");
  await expect(migrationReview).toContainText(
    /Yhtenäinen verkkokaupan sivuilme|Coordinated storefront page design/,
  );
  await expect(migrationReview).toContainText(/Verkkokaupan sivut8|Storefront pages8/);
  await expect(migrationReview).toContainText(
    /Uudelleenkäytettävät kaupan asettelut6|Reusable shopping layouts6/,
  );
  await expect(migrationReview).toContainText(
    /Tuote-, kokoelma- ja hakusivut20|Product, collection, and search pages20/,
  );
  await expect(migrationReview).toContainText(/säilyvät ennallaan|stay unchanged/i);
  await expect(migrationReview).not.toContainText(
    /kanoninen|canonical|ulkoasumalli|archetype|ajonaikainen|runtime|suojattu Vesko|protected Vesko/i,
  );
  await expect(
    page.getByText(
      /tarkista ehdotus ja hyväksy tai hylkää se|review this proposal, then accept or reject it/i,
    ),
  ).toBeVisible();
  await expect(
    proposalReview.getByRole("button", { name: /Luo uudelleen|Regenerate/ }),
  ).toHaveCount(0);
  await expect(
    proposalReview.getByLabel(/Miten ehdotusta pitäisi muuttaa|How should this proposal change/),
  ).toHaveCount(0);
  await expect(proposalReview.getByRole("button", { name: /^(Sulje|Close)$/ })).toHaveCount(0);
  await expect(
    page.getByRole("radio", { name: /Koko verkkokauppa|Entire storefront/ }),
  ).toBeDisabled();
  await expect(page.getByRole("radio", { name: "English" })).toBeDisabled();
  await expect(page.getByLabel(/Pyyntösi|Your request/)).toBeDisabled();
  await expect(page.getByRole("button", { name: /Tallenna luonnos|Save draft/ })).toBeDisabled();
  await expect(
    page
      .locator('[aria-disabled="true"]')
      .filter({ hasText: /Julkaise muutokset|Publish changes/ }),
  ).toBeVisible();
  await expect(
    page
      .locator('[aria-disabled="true"]')
      .filter({ hasText: /Esikatsele kauppaa|Preview storefront/ }),
  ).toBeVisible();
  await expect(page.locator('a[href*="p10b-16l-session"]')).toHaveCount(0);

  const pendingPreviewResponse = await page.goto(
    `/projects/${projectId}/collections/myrskyluodon-maija?p10b-16l-session=${encodeURIComponent(resetBody.session.sessionId)}`,
  );
  expect(pendingPreviewResponse?.status()).toBe(404);
  await page.goto(`/projects/${projectId}/editor`);
  const persistedRawPage = page.getByLabel(/Storefront page|Kauppasivuston sivu/);
  await expect(persistedRawPage.locator("option")).toHaveCount(1);
  await page.goto(generation.editorRoute);
  await expect(storefrontPage.locator("option")).toHaveCount(canonicalDesignAuthorityCount);

  const proposalCanvasRegion = page.getByLabel(/Proposal preview canvas|Ehdotuksen esikatselualue/);
  await expect(proposalCanvasRegion).toBeVisible();
  const proposalCanvas = proposalCanvasRegion.frameLocator("iframe");
  await selectOptionMatching(
    storefrontPage,
    /Dense collection and search design archetype|Tiivis kokoelma- ja hakunäkymä/i,
  );
  await page
    .locator("#dynamic-commerce-representative-route")
    .selectOption({ label: "Myrskyluodon Maija — /collections/myrskyluodon-maija" });
  await expect(
    proposalCanvas.locator('[data-component="dynamicCollectionCommerce"]'),
  ).toBeVisible();
  await selectOptionMatching(
    storefrontPage,
    /High-consideration product-page design archetype|Harkitun oston tuotesivumalli/i,
  );
  await page.locator("#dynamic-commerce-representative-route").selectOption({
    label: "Festive Feeniks Lux Oval timanttisormus — /products/product-karvonen-06",
  });
  await expect(
    proposalCanvas.getByRole("heading", {
      name: "Festive Feeniks Lux Oval timanttisormus",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    proposalCanvas.getByRole("region", { name: /Product gallery|Tuotekuvat/ }),
  ).toBeVisible();
  await storefrontPage.selectOption(homePageId);
  await expect(proposalCanvas.locator('[data-component="homepageHero"]')).toBeVisible();

  await accept.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: /Ota kauppaehdotus käyttöön|Apply storefront proposal/ })
    .click();
  await expect(page.getByText(/Storefront proposal applied|kauppaehdotus/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Tallenna luonnos|Save draft/ })).toBeEnabled();
  await expect(
    page
      .locator('[aria-disabled="true"]')
      .filter({ hasText: /Julkaise muutokset|Publish changes/ }),
  ).toBeVisible();

  const undo = page.getByRole("button", { name: /Kumoa|Undo/, exact: true });
  const redo = page.getByRole("button", { name: /Tee uudelleen|Redo/, exact: true });
  await undo.click();
  await expect(storefrontPage.locator("option")).toHaveCount(1);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(storefrontPage.locator("option")).toHaveCount(canonicalDesignAuthorityCount);
  await expect(undo).toBeEnabled();

  await page.getByRole("button", { name: /Tallenna luonnos|Save draft/ }).click();
  await expect(page.getByText(/^(Luonnos tallennettiin\.|Draft saved\.)$/)).toBeVisible();
  await page.reload();
  await expect(storefrontPage.locator("option")).toHaveCount(canonicalDesignAuthorityCount);
  await expect(accept).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Tallenna luonnos|Save draft/ })).toBeDisabled();

  await selectOptionMatching(
    storefrontPage,
    /Dense collection and search design archetype|Tiivis kokoelma- ja hakunäkymä/i,
  );
  await page
    .locator("#dynamic-commerce-representative-route")
    .selectOption({ label: "Myrskyluodon Maija — /collections/myrskyluodon-maija" });
  const previewLink = page
    .getByRole("link", { name: /Esikatsele kauppaa|Preview storefront/ })
    .first();
  await expect(previewLink).toHaveAttribute(
    "href",
    /\/collections\/myrskyluodon-maija\?p10b-16l-session=/,
  );
  const previewHref = await previewLink.getAttribute("href");
  if (!previewHref) throw new Error("P10B-16L collection preview route is unavailable.");
  await page.goto(previewHref);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(
    page.getByRole("region", { name: /Collection controls|Malliston valinnat/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Myrskyluodon Maija" }).first()).toBeVisible();

  await page.goto(generation.editorRoute);
  const reloadedStorefrontPage = page.getByLabel(/Storefront page|Kauppasivuston sivu/);
  await expect(reloadedStorefrontPage.locator("option")).toHaveCount(canonicalDesignAuthorityCount);
  await selectOptionMatching(
    reloadedStorefrontPage,
    /High-consideration product-page design archetype|Harkitun oston tuotesivumalli/i,
  );
  await page.locator("#dynamic-commerce-representative-route").selectOption({
    label: "Festive Feeniks Lux Oval timanttisormus — /products/product-karvonen-06",
  });
  const productPreview = page
    .getByRole("link", { name: /Esikatsele kauppaa|Preview storefront/ })
    .first();
  await expect(productPreview).toHaveAttribute(
    "href",
    /\/products\/product-karvonen-06\?p10b-16l-session=/,
  );
  const productPreviewHref = await productPreview.getAttribute("href");
  if (!productPreviewHref) throw new Error("P10B-16L product preview route is unavailable.");
  await page.goto(productPreviewHref);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Festive Feeniks Lux Oval timanttisormus",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: /Product gallery|Tuotekuvat/ })).toBeVisible();

  await page.goto(generation.editorRoute);
  const contentStorefrontPage = page.getByLabel(/Storefront page|Kauppasivuston sivu/);
  const karvonenOptions = contentStorefrontPage.locator("option", { hasText: "Karvonen" });
  await expect(karvonenOptions).toHaveCount(1);
  const aboutPageId = await karvonenOptions.getAttribute("value");
  if (!aboutPageId) throw new Error("P10B-16L About page identity is unavailable.");
  await contentStorefrontPage.selectOption(aboutPageId);
  const aboutPreview = page
    .getByRole("link", { name: /Esikatsele kauppaa|Preview storefront/ })
    .first();
  await expect(aboutPreview).toHaveAttribute("href", /\/pages\/about\?p10b-16l-session=/);
  const aboutPreviewHref = await aboutPreview.getAttribute("href");
  if (!aboutPreviewHref) throw new Error("P10B-16L About preview route is unavailable.");
  await page.goto(aboutPreviewHref);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Karvonen" }).first()).toBeVisible();

  await page.goto(generation.editorRoute);
  const utilityPage = page.getByLabel(/Storefront page|Kauppasivuston sivu/);
  const cartOption = utilityPage
    .locator("option")
    .filter({ hasText: /^(Ostoskori|Cart)$/ })
    .first();
  const cartPageId = await cartOption.getAttribute("value");
  if (!cartPageId) throw new Error("P10B-16L cart page identity is unavailable.");
  await utilityPage.selectOption(cartPageId);
  const utilityPreview = page
    .getByRole("link", { name: /Esikatsele kauppaa|Preview storefront/ })
    .first();
  await expect(utilityPreview).toHaveAttribute("href", /\/cart\?p10b-16l-session=/);
  const utilityPreviewHref = await utilityPreview.getAttribute("href");
  if (!utilityPreviewHref) throw new Error("P10B-16L utility preview route is unavailable.");
  await page.goto(utilityPreviewHref);
  await expect(page.locator("[data-utility-state]")).toBeVisible();

  expect(acceptanceRequests.filter((path) => path === "/api/demo/p10b-live/generate")).toHaveLength(
    1,
  );
  expect(acceptanceRequests.some((path) => path.startsWith("/api/demo/p9-05b"))).toBe(false);
});
