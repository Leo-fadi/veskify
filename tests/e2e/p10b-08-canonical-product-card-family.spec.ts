import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const demoToken = "p10a-04c-deterministic-browser-token";

const directions = [
  {
    instruction: "Redesign the entire storefront in a premium editorial direction.",
    home: "imageFirst",
    collection: "imageFirst",
  },
  {
    instruction: "Redesign the entire storefront in a modern technical direction.",
    home: "compact",
    collection: "compact",
  },
  {
    instruction: "Redesign the entire storefront in a warm approachable direction.",
    home: "standard",
    collection: "standard",
  },
] as const;

async function generate(page: Page, instruction: string) {
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
  const sessionId = (reset.body as { session: { sessionId: string } }).session.sessionId;
  const generated = await page.evaluate(
    async ({ merchantInstruction, sessionId: activeSessionId, token }) => {
      const response = await fetch("/api/demo/p9-05b/generate", {
        body: JSON.stringify({
          merchantInstruction,
          projectId: "project_lumo_fresh",
          sessionId: activeSessionId,
        }),
        headers: { "content-type": "application/json", "x-veskify-p9-05b-demo-token": token },
        method: "POST",
      });
      const body: unknown = await response.json();
      return { body, ok: response.ok };
    },
    { merchantInstruction: instruction, sessionId, token: demoToken },
  );
  expect(generated.ok).toBe(true);
  const editorRoute = (generated.body as { editorRoute: string }).editorRoute;
  await page.goto(editorRoute);
  await expect(
    page.getByRole("button", { name: /Hyväksy ja käytä|Accept and apply/ }),
  ).toBeVisible();
  return page
    .getByLabel(/Proposal preview canvas|Ehdotuksen esikatselualue/)
    .frameLocator("iframe");
}

async function selectPage(page: Page, frame: FrameLocator, pageId: string) {
  await page.getByLabel(/Storefront page|Kauppasivuston sivu/).selectOption(pageId);
  await expect(frame.locator(`[data-card-context]`).first()).toBeVisible();
}

async function expectNoTitleActionIntersection(cards: Locator) {
  const evidence = await cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const card = node as HTMLElement;
      const heading = card.querySelector<HTMLElement>('[data-card-region="heading"]');
      const action = card.querySelector<HTMLElement>('[data-card-region="actions"]');
      const button = action?.querySelector<HTMLElement>("button");
      if (!heading || !action || !button) {
        return { complete: false };
      }
      const headingRect = heading.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      return {
        complete: true,
        intersects:
          headingRect.left < actionRect.right - 0.5 &&
          headingRect.right > actionRect.left + 0.5 &&
          headingRect.top < actionRect.bottom - 0.5 &&
          headingRect.bottom > actionRect.top + 0.5,
        touchHeight: buttonRect.height,
        actionHeight: actionRect.height,
        horizontalOverflow: card.scrollWidth - card.clientWidth,
      };
    }),
  );
  expect(evidence.length).toBeGreaterThan(0);
  expect(evidence.every(({ complete }) => complete)).toBe(true);
  expect(evidence.every((item) => !item.intersects)).toBe(true);
  expect(evidence.every((item) => (item.touchHeight ?? 0) >= 44)).toBe(true);
  expect(evidence.every((item) => (item.actionHeight ?? 0) <= 72)).toBe(true);
  expect(evidence.every((item) => (item.horizontalOverflow ?? 0) <= 1)).toBe(true);
}

test("image-first cards keep long EN and FI titles separate from usable actions", async ({
  page,
}) => {
  test.setTimeout(180_000);
  expect(await page.evaluate(() => window.innerWidth)).toBeGreaterThanOrEqual(1024);
  const frame = await generate(page, directions[0].instruction);
  await expect(frame.locator("body")).toBeVisible();

  const setStableViewport = async (width: number) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction((expectedWidth) => window.innerWidth === expectedWidth, width);
    await frame.locator("body").evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    expect(await page.evaluate(() => window.innerWidth)).toBe(width);
  };

  const cases = [
    {
      pageId: "page_lumo_home",
      context: "homepageMerchandising",
      title: "A deliberately long northern-light jewellery title for everyday wear",
    },
    {
      pageId: "page_lumo_collection",
      context: "collectionResults",
      title: "Poikkeuksellisen pitkä suomalainen korutuotteen nimi turvalliseen rivittymiseen",
    },
  ] as const;

  let inspectedPageCount = 0;
  for (const current of cases) {
    await setStableViewport(1440);
    await selectPage(page, frame, current.pageId);
    await expect(page.getByLabel(/Storefront page|Kauppasivuston sivu/)).toHaveValue(
      current.pageId,
    );
    await expect(frame.locator("body")).toBeVisible();
    const cards = frame.locator(
      `[data-card-anatomy="imageFirst"][data-card-context="${current.context}"]`,
    );
    await expect(cards.first()).toBeVisible();
    await cards
      .first()
      .locator('[data-card-region="heading"] button')
      .evaluate((button, title) => {
        button.textContent = title;
      }, current.title);

    const inspectedWidths: number[] = [];
    for (const width of [375, 768, 1024, 1440]) {
      await setStableViewport(width);
      await expectNoTitleActionIntersection(cards);
      inspectedWidths.push(width);
    }
    expect(inspectedWidths).toEqual([375, 768, 1024, 1440]);
    const action = cards.first().locator('[data-card-region="actions"] button');
    await action.focus();
    await expect(action).toBeFocused();
    inspectedPageCount += 1;
  }
  expect(inspectedPageCount).toBe(cases.length);
});

test("five canonical anatomies remain one protected renderer across commercial contexts", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const externalProviderRequests: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host === "api.openai.com" || host.endsWith(".openai.com")) {
      externalProviderRequests.push(request.url());
    }
  });

  const observed = new Set<string>();
  for (const direction of directions) {
    const frame = await generate(page, direction.instruction);
    await selectPage(page, frame, "page_lumo_home");
    await expect(
      frame.locator('[data-card-context="homepageMerchandising"]').first(),
    ).toHaveAttribute("data-card-anatomy", direction.home);
    observed.add(direction.home);

    await selectPage(page, frame, "page_lumo_collection");
    const collectionCard = frame.locator('[data-card-context="collectionResults"]').first();
    await expect(collectionCard).toHaveAttribute("data-card-anatomy", direction.collection);
    await expect(collectionCard.locator("[data-product-media-owner]")).toHaveAttribute(
      "data-product-media-owner",
      /product_/,
    );
    observed.add(direction.collection);
  }
  await page.goto("/projects/project_aurum_nordic");
  await expect(page.locator('[data-card-context="legacyHomepageGrid"]').first()).toHaveAttribute(
    "data-card-anatomy",
    "editorial",
  );
  observed.add("editorial");
  await page.goto("/projects/project_aurum_nordic/products/aurora-ring-585");
  await expect(page.locator('[data-card-context="relatedProducts"]').first()).toHaveAttribute(
    "data-card-anatomy",
    "horizontal",
  );
  observed.add("horizontal");
  expect([...observed].sort()).toEqual(
    ["compact", "editorial", "horizontal", "imageFirst", "standard"].sort(),
  );
  expect(externalProviderRequests).toEqual([]);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`canonical collection cards preserve lineage without clipping at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/projects/project_aurum_nordic/collections/rings");
    const cards = page.locator('[data-card-context="collectionResults"]');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toHaveAttribute(
      "data-card-facts-fingerprint",
      /product-card-facts-/,
    );
    await expect(cards.first().locator("[data-product-media-owner]")).toHaveAttribute(
      "data-product-media-owner",
      /product_/,
    );
    await expectNoStorefrontHorizontalClipping(page);
  });
}
