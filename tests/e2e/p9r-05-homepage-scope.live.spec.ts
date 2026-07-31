import { expect, test } from "@playwright/test";

const enabled = process.env.VESKIFY_P9R05_LIVE === "1";
const projectId = "project_lumo_fresh";
const demoToken = "p9r-05-homepage-live-browser-token";
const instruction =
  "Redesign only the homepage as a bold modern technical landing page. Replace the current composition with a materially different layout: compact header, asymmetric hero, featured products near the top, structured collection discovery, specification-style brand story, three-column trust section, and compact footer. Change section order, component variants, density, surfaces, and hierarchy—not just colours or typography. Preserve all products, prices, stock, media bindings, routes, and approved assets. Do not change the collection page or product page.";

test.describe("P9R-05 live homepage-only acceptance", () => {
  test.skip(!enabled, "The controlled live homepage acceptance is opt-in.");
  test("applies one structurally material homepage-only OpenAI proposal without widening scope", async ({
    page,
  }) => {
    await page.goto("/");
    const result = await page.evaluate(
      async ({ instruction, projectId, token }) => {
        const reset = await fetch("/api/demo/p9-05b", {
          headers: { "x-veskify-p9-05b-demo-token": token },
          method: "POST",
        });
        const resetBody: unknown = await reset.json();
        if (
          !reset.ok ||
          !resetBody ||
          typeof resetBody !== "object" ||
          !("session" in resetBody) ||
          !resetBody.session ||
          typeof resetBody.session !== "object" ||
          !("sessionId" in resetBody.session) ||
          typeof (resetBody.session as { sessionId?: unknown }).sessionId !== "string"
        ) {
          throw new Error("The protected homepage test session did not start.");
        }
        const sessionId = (resetBody.session as { sessionId: string }).sessionId;
        const generated = await fetch("/api/demo/p9-05b/generate", {
          body: JSON.stringify({ merchantInstruction: instruction, projectId, sessionId }),
          headers: { "content-type": "application/json", "x-veskify-p9-05b-demo-token": token },
          method: "POST",
        });
        const body: unknown = await generated.json();
        if (
          !generated.ok ||
          !body ||
          typeof body !== "object" ||
          !("editorRoute" in body) ||
          typeof body.editorRoute !== "string"
        ) {
          throw new Error("The homepage proposal was not generated.");
        }
        const proposal = "proposal" in body ? body.proposal : null;
        if (!proposal || typeof proposal !== "object" || !("proposal" in proposal)) {
          throw new Error("The homepage proposal response is incomplete.");
        }
        const envelope = proposal.proposal;
        if (!envelope || typeof envelope !== "object") {
          throw new Error("The homepage proposal envelope is incomplete.");
        }
        const target = "target" in envelope ? envelope.target : null;
        const original = "originalStorefront" in envelope ? envelope.originalStorefront : null;
        const proposed = "proposedStorefront" in envelope ? envelope.proposedStorefront : null;
        const operations = "operations" in envelope ? envelope.operations : null;
        const isRecord = (value: unknown): value is Record<string, unknown> =>
          typeof value === "object" && value !== null;
        const pageByType = (storefront: unknown, type: string) => {
          if (!isRecord(storefront) || !("pages" in storefront)) return null;
          const pages = storefront.pages;
          if (!Array.isArray(pages)) return null;
          return (
            (pages as unknown[]).find(
              (candidate) => isRecord(candidate) && candidate.type === type,
            ) ?? null
          );
        };
        const operationList: unknown[] | null = Array.isArray(operations)
          ? (operations as unknown[])
          : null;
        const firstOperation = operationList?.[0] ?? null;
        const operation = isRecord(firstOperation) ? firstOperation.operation : null;
        const proposedHomepage = pageByType(proposed, "home");
        const sections =
          isRecord(proposedHomepage) && Array.isArray(proposedHomepage.sections)
            ? (proposedHomepage.sections as unknown[])
            : [];
        const sectionSignature = sections.flatMap((section) =>
          isRecord(section) &&
          typeof section.component === "string" &&
          typeof section.variant === "string"
            ? [`${section.component}:${section.variant}`]
            : [],
        );
        return {
          editorRoute: body.editorRoute,
          homepageChanged:
            JSON.stringify(pageByType(original, "home")) !==
            JSON.stringify(pageByType(proposed, "home")),
          collectionUnchanged:
            JSON.stringify(pageByType(original, "collection")) ===
            JSON.stringify(pageByType(proposed, "collection")),
          productUnchanged:
            JSON.stringify(pageByType(original, "product")) ===
            JSON.stringify(pageByType(proposed, "product")),
          onePageOperation:
            operationList !== null &&
            operationList.length === 1 &&
            isRecord(operation) &&
            operation.type === "APPLY_REGISTERED_PAGE_SECTIONS",
          structuralHomepage:
            JSON.stringify(sectionSignature) ===
            JSON.stringify([
              "header:compact",
              "hero:asymmetric",
              "productGrid:compact",
              "featuredCategories:grid",
              "brandStory:minimal",
              "footer:compact",
            ]),
          pageScope:
            !!target &&
            typeof target === "object" &&
            (target as Record<string, unknown>).scope === "page" &&
            Array.isArray((target as Record<string, unknown>).affectedPageIds) &&
            (target as { affectedPageIds: unknown[] }).affectedPageIds.length === 1 &&
            (target as Record<string, unknown>).designSystemTarget === null,
        };
      },
      { instruction, projectId, token: demoToken },
    );

    expect(result.pageScope).toBe(true);
    expect(result.onePageOperation).toBe(true);
    expect(result.structuralHomepage).toBe(true);
    expect(result.homepageChanged).toBe(true);
    expect(result.collectionUnchanged).toBe(true);
    expect(result.productUnchanged).toBe(true);

    await page.goto(result.editorRoute);
    await page.getByRole("button", { name: /Hyväksy ja käytä|Accept and apply/ }).click();
    await page
      .getByRole("button", { name: /Ota etusivuehdotus käyttöön|Apply homepage proposal/ })
      .click();
    const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
    await expect(canvas.locator(".store-header.store-variant--compact nav")).toBeVisible();
    await expect(canvas.locator(".store-hero.store-variant--asymmetric")).toBeVisible();
    await expect(
      canvas.locator(".store-section.store-variant--compact .product-grid"),
    ).toBeVisible();
    await expect(canvas.locator(".brand-story.store-variant--minimal")).toBeVisible();
    await expect(canvas.locator(".benefits")).toHaveCount(0);
    await expect(canvas.locator(".store-footer.store-variant--compact")).toBeVisible();
    await page.getByRole("button", { name: /Kumoa|Undo/ }).click();
    await expect(canvas.locator(".store-hero.store-variant--restrained")).toBeVisible();
    await page.getByRole("button", { name: /Tee uudelleen|Redo/ }).click();
    await expect(canvas.locator(".store-hero.store-variant--asymmetric")).toBeVisible();
    await page.getByRole("button", { name: /Tallenna luonnos|Save draft/ }).click();
    await expect(page.getByText("Luonnos tallennettiin.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(canvas.locator(".store-hero.store-variant--asymmetric")).toBeVisible();
  });
});
