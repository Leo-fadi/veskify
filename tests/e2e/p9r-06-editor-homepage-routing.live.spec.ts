import { expect, test } from "@playwright/test";

const enabled = process.env.VESKIFY_P9R06_LIVE === "1";
const projectId = "project_lumo_fresh";
const demoToken = "p9r-06-editor-homepage-routing-token";
const instruction =
  "Redesign only the homepage as a bold modern technical landing page. Replace the current composition with a materially different layout: compact header, asymmetric hero, featured products near the top, structured collection discovery, specification-style brand story, three-column trust section, and compact footer. Change section order, component variants, density, surfaces, and hierarchy—not just colours or typography. Preserve all products, prices, stock, media bindings, routes, and approved assets. Do not change the collection page or product page.";

test.describe("P9R-06 editor homepage routing acceptance", () => {
  test.skip(!enabled, "The controlled editor homepage acceptance is opt-in.");

  test("routes Current page through the canonical homepage proposal lifecycle", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    const sessionId = await page.evaluate(async (token) => {
      const response = await fetch("/api/demo/p9-05b", {
        headers: { "x-veskify-p9-05b-demo-token": token },
        method: "POST",
      });
      const body: unknown = await response.json();
      if (
        !response.ok ||
        !body ||
        typeof body !== "object" ||
        !("session" in body) ||
        !body.session ||
        typeof body.session !== "object" ||
        !("sessionId" in body.session) ||
        typeof (body.session as { sessionId?: unknown }).sessionId !== "string"
      ) {
        throw new Error("The protected editor session did not start.");
      }
      return (body.session as { sessionId: string }).sessionId;
    }, demoToken);

    const editorRoute = `/projects/${projectId}/editor?p9-05b-session=${encodeURIComponent(sessionId)}`;
    await page.goto(editorRoute);
    await expect(page.getByRole("radio", { name: /Nykyinen sivu|Current page/ })).toBeChecked();

    const proposalRequests: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes("/api/ai/whole-storefront-proposals") ||
        request.url().includes("/api/demo/p9-05b/generate")
      ) {
        proposalRequests.push(new URL(request.url()).pathname);
      }
    });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/ai/whole-storefront-proposals") &&
        response.request().method() === "POST",
    );
    await page.getByLabel(/Pyyntösi|Your request/).fill(instruction);
    await page.getByRole("button", { name: /Luo ehdotus|Create proposal/ }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const responseBody = (await response.json()) as Record<string, unknown>;
    const proposalEnvelope = responseBody.proposal as Record<string, unknown>;
    const proposal = proposalEnvelope.proposal as Record<string, unknown>;
    const target = proposal.target as Record<string, unknown>;
    const original = proposal.originalStorefront as { pages: Array<Record<string, unknown>> };
    const proposed = proposal.proposedStorefront as { pages: Array<Record<string, unknown>> };
    const operations = proposal.operations as Array<Record<string, unknown>>;
    const pageByType = (storefront: { pages: Array<Record<string, unknown>> }, type: string) =>
      storefront.pages.find((candidate) => candidate.type === type);
    const proposedHomepage = pageByType(proposed, "home")!;
    const signature = (proposedHomepage.sections as Array<Record<string, unknown>>).map(
      (section) => `${String(section.component)}:${String(section.variant)}`,
    );

    expect(proposalRequests).toEqual(["/api/ai/whole-storefront-proposals"]);
    expect(target).toMatchObject({
      scope: "page",
      designSystemTarget: null,
    });
    expect(target.affectedPageIds).toHaveLength(1);
    expect(operations).toHaveLength(1);
    expect((operations[0].operation as Record<string, unknown>).type).toBe(
      "APPLY_REGISTERED_PAGE_SECTIONS",
    );
    expect(signature).toEqual([
      "header:compact",
      "hero:asymmetric",
      "productGrid:compact",
      "featuredCategories:grid",
      "brandStory:minimal",
      "footer:compact",
    ]);
    expect(pageByType(proposed, "home")).not.toEqual(pageByType(original, "home"));
    expect(pageByType(proposed, "collection")).toEqual(pageByType(original, "collection"));
    expect(pageByType(proposed, "product")).toEqual(pageByType(original, "product"));

    const review = page.getByLabel(/Etusivun suunnitteluehdotus|Homepage design proposal/);
    await expect(review).toBeVisible();
    await expect(review).toContainText(/Etusivu|Homepage/);
    await expect(review).not.toContainText(/Koko verkkokauppa|Entire storefront/);

    await page.getByRole("button", { name: /Hyväksy ja käytä|Accept and apply/ }).click();
    await page
      .getByRole("button", { name: /Ota etusivuehdotus käyttöön|Apply homepage proposal/ })
      .click();
    const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
    await expect(canvas.locator(".store-hero.store-variant--asymmetric")).toBeVisible();
    await expect(canvas.locator(".brand-story.store-variant--minimal")).toBeVisible();
    await expect(canvas.locator(".benefits")).toHaveCount(0);

    await page.getByRole("button", { name: /Kumoa|Undo/ }).click();
    await expect(canvas.locator(".store-hero.store-variant--restrained")).toBeVisible();
    await page.getByRole("button", { name: /Tee uudelleen|Redo/ }).click();
    await expect(canvas.locator(".store-hero.store-variant--asymmetric")).toBeVisible();
    await page.getByRole("button", { name: /Tallenna luonnos|Save draft/ }).click();
    await expect(page.getByText("Luonnos tallennettiin.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(canvas.locator(".store-hero.store-variant--asymmetric")).toBeVisible();

    const previewHref = await page
      .getByRole("link", { name: /Esikatsele kauppaa|Preview storefront/ })
      .getAttribute("href");
    expect(previewHref).toBeTruthy();
    await page.goto(previewHref!);
    await expect(page.locator(".store-hero.store-variant--asymmetric")).toBeVisible();
    await expect(page.locator(".brand-story.store-variant--minimal")).toBeVisible();
  });
});
