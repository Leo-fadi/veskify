import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const proofUrl = "/p10b-16p-01-dynamic-route-proof";
const projectId = "project_lumo_fresh";
const editorUrl = proofUrl;
const simpleProductUrl = `/projects/${projectId}/products/arc-studs`;
const configurableProductUrl = `/projects/${projectId}/products/custom-halo-ring`;
const jewelleryCollectionUrl = `/projects/${projectId}/collections/jewellery`;
const giftsCollectionUrl = `/projects/${projectId}/collections/gifts`;
const widths = [375, 768, 1024, 1440] as const;

const providerRequests = new WeakMap<Page, string[]>();

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  providerRequests.set(page, requests);
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host === "api.openai.com" || host.endsWith(".openai.com")) {
      requests.push(request.url());
    }
  });
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><rect width="1400" height="1000" fill="#d8d0c6"/><path d="M0 780L410 300l260 250 250-190 480 420" fill="none" stroke="#4f453c" stroke-width="38"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
});

test.afterEach(({ page }) => {
  expect(providerRequests.get(page)).toEqual([]);
});

async function seedProof(page: Page) {
  await page.goto(editorUrl);
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("radio", { name: "English" }).check();
  await expect(
    page
      .getByLabel("Visual editor canvas")
      .frameLocator("iframe")
      .locator("[data-veskify-canvas-root]"),
  ).toHaveAttribute("lang", "en");
}

async function useEnglishStorefront(page: Page) {
  const english = page.getByRole("radio", { name: "English" });
  await expect(english).toBeVisible({ timeout: 30_000 });
  await english.check();
}

async function prepareEvidence(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((image) =>
        image.complete ? image.decode().catch(() => undefined) : Promise.resolve(),
      ),
    );
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
  });
}

async function retainMacScreenshot(locator: Locator, name: string) {
  if (process.platform !== "darwin") return;
  await expect(locator).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.001,
  });
}

async function retainMacPageScreenshot(page: Page, name: string) {
  if (process.platform !== "darwin") return;
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    maxDiffPixelRatio: 0.001,
  });
}

test("Studio exposes governed archetypes and merchant-readable mappings instead of route pages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await seedProof(page);

  const pageSelector = page.locator("#editor-page");
  const options = await pageSelector.locator("option").allTextContents();
  expect(options.filter((label) => /design archetype/i.test(label)).length).toBeGreaterThanOrEqual(
    4,
  );
  expect(options).toEqual(
    expect.arrayContaining([
      "Editorial collection design archetype",
      "Dense collection and search design archetype",
      "Standard product-page design archetype",
      "High-consideration product-page design archetype",
      "Safe generic product-page design archetype",
    ]),
  );
  expect(options).not.toEqual(
    expect.arrayContaining(["Jewellery", "Gifts", "Arc Studs", "Custom Halo Ring"]),
  );

  const mappings = page.getByTestId("dynamic-commerce-product-type-mappings");
  await expect(
    mappings.getByRole("heading", { name: "Product-page archetype mappings" }),
  ).toBeVisible();
  await expect(mappings).toContainText("earrings");
  await expect(mappings).toContainText("ring");
  await expect(mappings).toContainText("High-consideration product-page design archetype");
  await expect(mappings.getByRole("listitem").filter({ hasText: /^earrings →/i })).toContainText(
    "High-consideration product-page design archetype",
  );
  await expect(mappings.getByRole("listitem").filter({ hasText: /^ring →/i })).toContainText(
    "High-consideration product-page design archetype",
  );
  await expect(mappings).not.toContainText(/archetype_pdp_|pdp-high-consideration/);
  await prepareEvidence(page);
  await retainMacPageScreenshot(page, "p10b16p01-editor-archetype-outline-1440px.png");
});

test("representative product and collection choices remain transient editor context", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await seedProof(page);
  const pageSelector = page.locator("#editor-page");

  await pageSelector.selectOption("archetype_pdp_standard");
  const representative = page.locator("#dynamic-commerce-representative-route");
  expect(await representative.inputValue()).not.toBe("");
  const productCanvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await expect(productCanvas.getByRole("heading", { name: "Arc Studs" })).toBeVisible();
  await expect(productCanvas.locator("[data-option-group-count]")).toHaveCount(0);

  await pageSelector.selectOption("archetype_pdp_high_consideration");
  const defaultProductRoute = await representative.inputValue();
  const productRoutes = await representative
    .locator("option")
    .evaluateAll((options) =>
      Object.fromEntries(
        options.map((option) => [option.textContent?.trim(), option.getAttribute("data-route")]),
      ),
    );
  expect(productRoutes).toEqual({
    "Arc Studs": "/products/arc-studs",
    "Custom Halo Ring": "/products/custom-halo-ring",
  });
  await representative.selectOption({ label: "Custom Halo Ring" });
  await expect(page.getByTestId("representative-route-path")).toHaveText(
    "/products/custom-halo-ring",
  );
  await expect(productCanvas.getByRole("heading", { name: "Custom Halo Ring" })).toBeVisible();
  await expect(productCanvas.getByRole("region", { name: "Choose product options" })).toBeVisible();
  const ringSizeGroups = productCanvas.getByRole("group", { name: /Ring size/ });
  await expect(ringSizeGroups).toHaveCount(2);
  await expect(ringSizeGroups.first()).toBeVisible();
  await expect(productCanvas.getByRole("textbox", { name: /Engraving/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();

  await pageSelector.selectOption("archetype_collection_editorial");
  const collectionRepresentative = page.locator("#dynamic-commerce-representative-route");
  await expect(collectionRepresentative.locator("option")).toHaveCount(2);
  const collectionRoutes = await collectionRepresentative
    .locator("option")
    .evaluateAll((options) =>
      Object.fromEntries(
        options.map((option) => [option.textContent?.trim(), option.getAttribute("data-route")]),
      ),
    );
  expect(collectionRoutes).toEqual({
    Gifts: "/collections/gifts",
    Jewellery: "/collections/jewellery",
  });
  await collectionRepresentative.selectOption({ label: "Gifts" });
  await expect(page.getByTestId("representative-route-path")).toHaveText("/collections/gifts");
  const collectionCanvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await expect(collectionCanvas.getByRole("heading", { name: "Gifts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();

  await page.reload();
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("radio", { name: "English" }).check();
  await page.locator("#editor-page").selectOption("archetype_pdp_high_consideration");
  await expect(page.locator("#dynamic-commerce-representative-route")).toHaveValue(
    defaultProductRoute,
  );
});

test("two concrete product URLs share one archetype while binding exact simple and configurable commerce", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await seedProof(page);

  await page.goto(simpleProductUrl);
  await useEnglishStorefront(page);
  const simple = page.locator('[data-component="dynamicProductDetail"]');
  await expect(page.getByRole("heading", { name: "Arc Studs", exact: true })).toBeVisible();
  await expect(simple.locator("[data-option-group-count]")).toHaveCount(0);
  await expect(page.getByText("Ready to ship", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search" })).toHaveCount(0);
  const simpleVariant = await simple.getAttribute("data-variant");
  const simpleComposition = await simple.getAttribute("data-pdp-composition");
  const simpleRoot = page.locator(".project-preview__storefront");
  await prepareEvidence(page);
  await testInfo.attach("p10b16p01-product-arc-studs", {
    body: await simpleRoot.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
  await retainMacScreenshot(simpleRoot, "p10b16p01-product-arc-studs-1440px.png");

  await page.goto(configurableProductUrl);
  await useEnglishStorefront(page);
  const configurable = page.locator('[data-component="dynamicProductDetail"]');
  await expect(page.getByRole("heading", { name: "Custom Halo Ring", exact: true })).toBeVisible();
  await expect(configurable.locator("[data-option-group-count]")).toHaveAttribute(
    "data-option-group-count",
    "8",
  );
  await expect(page.getByText("Made to order", { exact: true })).toBeVisible();
  await expect(configurable).toHaveAttribute("data-variant", simpleVariant!);
  await expect(configurable).toHaveAttribute("data-pdp-composition", simpleComposition!);
  const configurableRoot = page.locator(".project-preview__storefront");
  await prepareEvidence(page);
  await testInfo.attach("p10b16p01-product-custom-halo-ring", {
    body: await configurableRoot.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
  await retainMacScreenshot(configurableRoot, "p10b16p01-product-custom-halo-ring-1440px.png");
});

test("two concrete collection URLs share a governed archetype with exact collection membership", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await seedProof(page);

  await page.goto(jewelleryCollectionUrl);
  await useEnglishStorefront(page);
  const jewellery = page.locator('[data-component="dynamicCollectionCommerce"]');
  await expect(page.getByRole("heading", { name: "Jewellery", exact: true })).toBeVisible();
  await expect(jewellery.locator("[data-product-count]")).toHaveAttribute(
    "data-product-count",
    "2",
  );
  const jewelleryVariant = await jewellery.getAttribute("data-variant");
  const jewelleryProducts = await jewellery
    .locator("article[data-card-anatomy] h3")
    .allTextContents();
  expect(jewelleryProducts).toEqual(["Arc Studs", "Custom Halo Ring"]);
  const jewelleryRoot = page.locator(".project-preview__storefront");
  await prepareEvidence(page);
  await testInfo.attach("p10b16p01-collection-jewellery", {
    body: await jewelleryRoot.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
  await retainMacScreenshot(jewelleryRoot, "p10b16p01-collection-jewellery-1440px.png");

  await page.goto(giftsCollectionUrl);
  await useEnglishStorefront(page);
  const gifts = page.locator('[data-component="dynamicCollectionCommerce"]');
  await expect(page.getByRole("heading", { name: "Gifts", exact: true })).toBeVisible();
  await expect(gifts.locator("[data-product-count]")).toHaveAttribute("data-product-count", "2");
  await expect(gifts).toHaveAttribute("data-variant", jewelleryVariant!);
  const giftProducts = await gifts.locator("article[data-card-anatomy] h3").allTextContents();
  expect(giftProducts).toEqual(["Custom Halo Ring", "Arc Studs"]);
  const giftsRoot = page.locator(".project-preview__storefront");
  await prepareEvidence(page);
  await testInfo.attach("p10b16p01-collection-gifts", {
    body: await giftsRoot.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
  await retainMacScreenshot(giftsRoot, "p10b16p01-collection-gifts-1440px.png");
});

test("an archetype presentation edit survives save and reload without creating route pages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await seedProof(page);
  const pageSelector = page.locator("#editor-page");
  await pageSelector.selectOption("archetype_collection_editorial");

  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByRole("heading", { name: "Jewellery", exact: true }).click();
  await page.getByRole("button", { name: "Design", exact: true }).click();
  const variant = page.getByRole("combobox", { name: "Layout variant" });
  await expect(variant).toBeVisible();
  await variant.selectOption("gallery");
  await expect(canvas.locator('[data-component="dynamicCollectionCommerce"]')).toHaveAttribute(
    "data-variant",
    "gallery",
  );
  await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("radio", { name: "English" }).check();
  await page.locator("#editor-page").selectOption("archetype_collection_editorial");
  const reloadedCanvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await expect(
    reloadedCanvas.locator('[data-component="dynamicCollectionCommerce"]'),
  ).toHaveAttribute("data-variant", "gallery");
  const options = await page.locator("#editor-page option").allTextContents();
  expect(options).not.toEqual(
    expect.arrayContaining(["Jewellery", "Gifts", "Arc Studs", "Custom Halo Ring"]),
  );
});

for (const width of widths) {
  test(`configurable dynamic PDP remains responsive at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 375 ? 1000 : 1100 });
    await seedProof(page);
    await page.goto(configurableProductUrl);
    const product = page.locator('[data-component="dynamicProductDetail"]');
    await expect(product).toBeVisible();
    await expect(product.locator("[data-option-group-count]")).toHaveAttribute(
      "data-option-group-count",
      "8",
    );
    await expectNoStorefrontHorizontalClipping(page);
    const storefront = page.locator(".project-preview__storefront");
    await prepareEvidence(page);
    await testInfo.attach(`p10b16p01-configurable-pdp-${width}px`, {
      body: await storefront.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
    await retainMacScreenshot(storefront, `p10b16p01-configurable-pdp-${width}px.png`);
  });
}
