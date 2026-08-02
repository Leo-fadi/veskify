import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const projectId = "project_lumo_fresh";
const demoToken = "p9r-04-deterministic-browser-token";
const instruction =
  "Redesign the entire storefront in a modern technical direction. Create a substantially different coordinated composition across the homepage, collection page and product-detail page. Use compact spacing, crisp surfaces, commerce-focused collection cards, structured product discovery, a specification-led product-detail page, and a coordinated shared header and footer. Preserve all catalogue data, product identities, prices, stock, options, media bindings and approved assets.";

const routes = [
  {
    path: `/projects/${projectId}/published`,
    selector: ".store-hero",
    action: { en: "Jewellery", fi: "Korut" },
    actionRole: "link",
  },
  {
    path: `/projects/${projectId}/published/collections/jewellery`,
    selector: '[data-component="dynamicCollectionCommerce"]',
    heading: { en: "Jewellery", fi: "Korut" },
    action: { en: "Sort products", fi: "Lajittele tuotteet" },
    actionRole: "combobox",
  },
  {
    path: `/projects/${projectId}/published/products/custom-halo-ring`,
    selector: '[data-component="dynamicProductDetail"]',
    heading: { en: "Custom Halo Ring", fi: "Muokattava Halo-sormus" },
    action: { en: "Add to cart", fi: "Lisää ostoskoriin" },
    actionRole: "button",
  },
] as const;

async function selectLocale(
  page: Parameters<typeof expectNoStorefrontHorizontalClipping>[0],
  locale: "en" | "fi",
) {
  const label = locale === "en" ? "English" : "Suomi";
  await page.getByRole("radio", { name: label }).check();
}

function resetSession(value: unknown): string {
  if (
    !value ||
    typeof value !== "object" ||
    !("session" in value) ||
    !value.session ||
    typeof value.session !== "object" ||
    !("sessionId" in value.session) ||
    typeof value.session.sessionId !== "string"
  ) {
    throw new Error("P9R-04 local demo reset did not return a session.");
  }
  return value.session.sessionId;
}

function editorRoute(value: unknown): string {
  if (
    !value ||
    typeof value !== "object" ||
    !("editorRoute" in value) ||
    typeof value.editorRoute !== "string"
  ) {
    throw new Error("P9R-04 generation did not return an editor route.");
  }
  return value.editorRoute;
}

test("P9R-04 accepts one deterministic modernTechnical generation and keeps every published surface responsive in EN/FI", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/");
  const reset = await page.evaluate(async (token) => {
    const response = await fetch("/api/demo/p9-05b", {
      headers: { "x-veskify-p9-05b-demo-token": token },
      method: "POST",
    });
    const body: unknown = await response.json();
    return { body, ok: response.ok };
  }, demoToken);
  expect(reset.ok).toBe(true);
  const sessionId = resetSession(reset.body);

  const generated = await page.evaluate(
    async ({ merchantInstruction, projectId: targetProjectId, sessionId, token }) => {
      const response = await fetch("/api/demo/p9-05b/generate", {
        body: JSON.stringify({ merchantInstruction, projectId: targetProjectId, sessionId }),
        headers: { "content-type": "application/json", "x-veskify-p9-05b-demo-token": token },
        method: "POST",
      });
      const body: unknown = await response.json();
      return { body, ok: response.ok };
    },
    {
      merchantInstruction: instruction,
      projectId,
      sessionId,
      token: demoToken,
    },
  );
  expect(generated.ok).toBe(true);
  const generatedProposal = generated.body as {
    proposal?: {
      proposal?: { proposedStorefront?: { pages?: Array<{ id?: string; sections?: unknown[] }> } };
    };
  };
  const proposedPages = generatedProposal.proposal?.proposal?.proposedStorefront?.pages;
  expect(proposedPages?.map((candidate) => candidate.id)).toContain("page_lumo_collection");
  const generatedCollection = proposedPages?.find(
    (candidate) => candidate.id === "page_lumo_collection",
  ) as { sections?: Array<{ component?: string; variant?: string }> } | undefined;
  expect(generatedCollection?.sections).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ component: "dynamicCollectionCommerce", variant: "compact" }),
    ]),
  );
  const generatedHomepage = proposedPages?.find(
    (candidate) => candidate.id === "page_lumo_home",
  ) as { sections?: Array<{ component?: string; variant?: string }> } | undefined;
  expect(generatedHomepage?.sections).toEqual(
    expect.arrayContaining([expect.objectContaining({ component: "hero", variant: "asymmetric" })]),
  );
  const generatedProduct = proposedPages?.find(
    (candidate) => candidate.id === "page_lumo_product",
  ) as { sections?: Array<{ component?: string; variant?: string }> } | undefined;
  expect(generatedProduct?.sections).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ component: "dynamicProductDetail", variant: "compact" }),
    ]),
  );
  const generatedEditorRoute = editorRoute(generated.body);
  expect(generatedEditorRoute).toContain("p9-05b-session=");

  await page.goto(generatedEditorRoute);
  const accept = page.getByRole("button", { name: /Hyväksy ja käytä|Accept and apply/ });
  await expect(accept).toBeVisible();
  const storefrontPage = page.getByLabel(/Storefront page|Kauppasivuston sivu/);
  await storefrontPage.selectOption("page_lumo_collection");
  const proposalCanvasRegion = page.getByLabel(/Proposal preview canvas|Ehdotuksen esikatselualue/);
  await expect(proposalCanvasRegion).toBeVisible();
  const proposalCanvas = proposalCanvasRegion.frameLocator("iframe");
  const proposedCollection = proposalCanvas.locator('[data-component="dynamicCollectionCommerce"]');
  await expect(proposedCollection).toHaveAttribute("data-render-target", "editor");
  await expect(proposedCollection).toHaveAttribute("data-variant", "compact");
  await expect(proposalCanvas.locator('[data-filter-layout="sidebar"]')).toBeVisible();
  await expect(proposalCanvas.locator('[data-layout-region="products"]')).toBeVisible();

  await storefrontPage.selectOption("page_lumo_home");
  await expect(proposalCanvas.locator(".store-hero")).toBeVisible();
  await storefrontPage.selectOption("page_lumo_product");
  await expect(
    proposalCanvas.getByRole("heading", { name: "Muokattava Halo-sormus" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Tallenna luonnos|Save draft/ })).toBeDisabled();

  await accept.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: /Ota kauppaehdotus käyttöön|Apply storefront proposal/ })
    .click();
  await expect(page.getByText(/Storefront proposal applied|kauppaehdotus/i)).toBeVisible();

  await page.getByRole("button", { name: /Kumoa|Undo/ }).click();
  await expect(page.getByRole("button", { name: /Tee uudelleen|Redo/ })).toBeEnabled();
  await page.getByRole("button", { name: /Tee uudelleen|Redo/ }).click();
  await page.getByRole("button", { name: /Tallenna luonnos|Save draft/ }).click();
  await expect(page.getByText("Luonnos tallennettiin.", { exact: true })).toBeVisible();

  await page.goto(`/projects/${projectId}/collections/jewellery`);
  const draftCollection = page.locator('[data-component="dynamicCollectionCommerce"]');
  await expect(draftCollection).toHaveAttribute("data-render-target", "preview");
  await expect(draftCollection).toHaveAttribute("data-variant", "compact");
  await expect(page.locator('[data-filter-layout="sidebar"]')).toBeVisible();
  await expect(page.locator('[data-layout-region="products"]')).toBeVisible();

  await page.goto(`/projects/${projectId}/publish?p9-05b-session=${encodeURIComponent(sessionId)}`);
  await page.getByRole("button", { name: /Tarkista julkaisu|Review publish/ }).click();
  await expect(
    page.getByRole("heading", { name: /Vahvista julkaisu|Confirm publication/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Julkaise verkkokauppa|Publish storefront/ }).click();
  await expect(
    page.getByRole("heading", { name: /julkaistiin onnistuneesti|published successfully/i }),
  ).toBeVisible();

  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    for (const locale of ["en", "fi"] as const) {
      for (const route of routes) {
        await page.goto(route.path);
        await selectLocale(page, locale);
        await expect(page.locator(route.selector)).toBeVisible();
        if ("heading" in route) {
          await expect(
            page.getByRole("heading", { level: 1, name: route.heading[locale] }),
          ).toBeVisible();
        }
        if (route.selector === '[data-component="dynamicCollectionCommerce"]') {
          const filters = page.locator('[data-layout-region="filters"]');
          await expect(page.locator(route.selector)).toHaveAttribute(
            "data-render-target",
            "published",
          );
          await expect(page.locator(route.selector)).toHaveAttribute("data-variant", "compact");
          await expect(page.locator('[data-filter-layout="sidebar"]')).toBeVisible();
          await expect(page.locator('[data-layout-region="products"]')).toBeVisible();
          if (width < 1024) {
            const disclosure = filters.getByRole("button", {
              name: locale === "en" ? "Show filters" : "Näytä suodattimet",
            });
            await expect(disclosure).toBeVisible();
            await expect(filters).not.toHaveAttribute("open", "");

            await disclosure.click();
            await expect(filters).toHaveAttribute("open", "");
            await expect(filters.locator("fieldset")).not.toHaveCount(0);
            for (const fieldset of await filters.locator("fieldset").all()) {
              await expect(fieldset).toBeVisible();
            }
            await expectNoStorefrontHorizontalClipping(page);

            await disclosure.click();
            await expect(filters).not.toHaveAttribute("open", "");
            await disclosure.focus();
            await page.keyboard.press("Enter");
            await expect(filters).toHaveAttribute("open", "");
            await expect(filters.locator("fieldset").first()).toBeVisible();
          } else {
            await expect(filters).toBeVisible();
            await expect(filters.locator("summary")).toBeHidden();
            await expect(filters.locator("fieldset").first()).toBeVisible();
          }
        }
        const action =
          route.selector === ".store-hero"
            ? page.getByRole("navigation").first().getByRole("link", { name: route.action[locale] })
            : page.getByRole(route.actionRole, { name: route.action[locale] });
        await expect(action).toBeVisible();
        await expectNoStorefrontHorizontalClipping(page);
      }
    }
  }
});
