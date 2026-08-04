import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const projectId = "project_lumo_fresh";
const demoToken = "p10a-04c-deterministic-browser-token";

const profiles = [
  {
    name: "brand-led editorial",
    instruction: "Redesign the entire storefront in a premium editorial direction.",
    selected: [
      ["homepageHero", "fullBleed"],
      ["homepageFeaturedCollections", "imageLed"],
      ["homepagePromotion", "imageLed"],
      ["homepageFeaturedProducts", "editorial"],
      ["homepageTrust", "minimal"],
    ],
  },
  {
    name: "catalogue-forward commerce",
    instruction: "Redesign the entire storefront in a modern technical direction.",
    selected: [
      ["homepageHero", "asymmetric"],
      ["homepageFeaturedProducts", "compact"],
      ["homepageCollectionNavigation", "grid"],
      ["homepageTrust", "threeColumn"],
    ],
  },
  {
    name: "balanced warm",
    instruction: "Redesign the entire storefront in a warm approachable direction.",
    selected: [
      ["homepageHero", "editorial"],
      ["homepageFeaturedCollections", "editorialCards"],
      ["homepageFeaturedProducts", "standard"],
      ["homepageTrust", "cards"],
    ],
  },
] as const;

const bridgeComponents = [
  "homepageHero",
  "homepageFeaturedCollections",
  "homepageFeaturedProducts",
  "homepageCollectionNavigation",
  "homepagePromotion",
  "homepageTrust",
] as const;

type GeneratedProposal = {
  editorRoute?: string;
  proposal?: {
    proposal?: {
      proposedStorefront?: { pages?: Array<{ id?: string; sections?: Array<unknown> }> };
    };
  };
};

function sessionId(value: unknown): string {
  if (
    !value ||
    typeof value !== "object" ||
    !("session" in value) ||
    !value.session ||
    typeof value.session !== "object" ||
    !("sessionId" in value.session) ||
    typeof value.session.sessionId !== "string"
  ) {
    throw new Error("P10A-04C deterministic demo reset did not return a session.");
  }
  return value.session.sessionId;
}

function generatedEditorRoute(value: GeneratedProposal): string {
  if (typeof value.editorRoute !== "string") {
    throw new Error("P10A-04C deterministic generation did not return an editor route.");
  }
  return value.editorRoute;
}

function expectedComponents(profile: (typeof profiles)[number]) {
  return profile.selected.map(([component]) => component);
}

function expectedVariant(profile: (typeof profiles)[number], component: string) {
  return profile.selected.find(([candidate]) => candidate === component)?.[1];
}

async function resetAndGenerate(page: Page, instruction: string) {
  await page.goto("/");
  const reset = await page.evaluate(async (token) => {
    const response = await fetch("/api/demo/p9-05b", {
      headers: { "x-veskify-p9-05b-demo-token": token },
      method: "POST",
    });
    return { body: (await response.json()) as unknown, ok: response.ok };
  }, demoToken);
  expect(reset.ok, JSON.stringify(reset.body)).toBe(true);
  const activeSessionId = sessionId(reset.body);
  const generated = await page.evaluate(
    async ({
      merchantInstruction,
      projectId: targetProjectId,
      sessionId: targetSessionId,
      token,
    }) => {
      const response = await fetch("/api/demo/p9-05b/generate", {
        body: JSON.stringify({
          merchantInstruction,
          projectId: targetProjectId,
          sessionId: targetSessionId,
        }),
        headers: { "content-type": "application/json", "x-veskify-p9-05b-demo-token": token },
        method: "POST",
      });
      return { body: (await response.json()) as GeneratedProposal, ok: response.ok };
    },
    {
      merchantInstruction: instruction,
      projectId,
      sessionId: activeSessionId,
      token: demoToken,
    },
  );
  expect(generated.ok, JSON.stringify(generated.body)).toBe(true);
  return { generated: generated.body, sessionId: activeSessionId };
}

async function homepagePreview(page: Page, route: string): Promise<FrameLocator> {
  await page.goto(route);
  await expect(
    page.getByRole("button", { name: /Hyväksy ja käytä|Accept and apply/ }),
  ).toBeVisible();
  await page.getByLabel(/Storefront page|Kauppasivuston sivu/).selectOption("page_lumo_home");
  const frame = page
    .getByLabel(/Proposal preview canvas|Ehdotuksen esikatselualue/)
    .frameLocator("iframe");
  await expect(frame.locator('[data-component="homepageHero"]')).toBeVisible();
  return frame;
}

async function expectRenderedProfile(
  surface: FrameLocator | Page,
  profile: (typeof profiles)[number],
  target: "editor" | "preview" | "published",
) {
  const selector = bridgeComponents
    .map((component) => `[data-component="${component}"]`)
    .join(", ");
  const renderedComponents = await surface
    .locator(selector)
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-component")));
  expect(renderedComponents).toEqual(expectedComponents(profile));
  for (const component of expectedComponents(profile)) {
    const section = surface.locator(`[data-component="${component}"]`);
    await expect(section).toHaveAttribute("data-render-target", target);
    await expect(section).toHaveAttribute("data-variant", expectedVariant(profile, component)!);
  }
  await expect(surface.locator('[data-component="homepageHero"] [data-asset-id]')).toHaveCount(1);
  await expect(
    surface.locator('[data-component="homepageFeaturedProducts"] [data-item-count]'),
  ).toHaveCount(1);
  await expect(
    surface.locator('[data-component="homepageFeaturedProducts"] article'),
  ).not.toHaveCount(0);
  const collectionSurface = surface.locator(
    '[data-component="homepageFeaturedCollections"], [data-component="homepageCollectionNavigation"]',
  );
  if ((await collectionSurface.count()) > 0) {
    await expect(collectionSurface.locator("[data-item-count]")).toHaveCount(1);
    await expect(collectionSurface.locator("article")).not.toHaveCount(0);
  }
  if ((await surface.locator('[data-component="homepagePromotion"]').count()) > 0) {
    await expect(
      surface.locator('[data-component="homepagePromotion"] [data-asset-id]'),
    ).toHaveCount(1);
  }
}

test("P10A-04C renders executable homepage profiles through the deterministic bridge without browser or provider errors", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const browserErrors: string[] = [];
  const providerRequests: string[] = [];
  await page.route("https://lumo.example/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><title>Lumo fixture asset</title></svg>',
      contentType: "image/svg+xml",
    }),
  );
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "api.openai.com" || url.hostname.endsWith(".openai.com")) {
      providerRequests.push(request.url());
    }
  });

  for (const profile of profiles) {
    const { generated } = await resetAndGenerate(page, profile.instruction);
    const homepage = generated.proposal?.proposal?.proposedStorefront?.pages?.find(
      (candidate) => candidate.id === "page_lumo_home",
    );
    const plannedSelections = (homepage?.sections ?? []).flatMap((section) => {
      if (
        !section ||
        typeof section !== "object" ||
        !("component" in section) ||
        !("variant" in section) ||
        typeof section.component !== "string" ||
        typeof section.variant !== "string" ||
        !bridgeComponents.includes(section.component as (typeof bridgeComponents)[number])
      ) {
        return [];
      }
      return [[section.component, section.variant]] as const;
    });
    expect(plannedSelections).toEqual(profile.selected);
    const frame = await homepagePreview(page, generatedEditorRoute(generated));
    await expectRenderedProfile(frame, profile, "preview");
  }

  // Each deterministic reset replaces the browser repository. Re-create the
  // premium proposal in the active final session before exercising publish.
  const premium = await resetAndGenerate(page, profiles[0].instruction);
  await page.goto(generatedEditorRoute(premium.generated));
  await page.getByRole("button", { name: /Hyväksy ja käytä|Accept and apply/ }).click();
  await page
    .getByRole("button", { name: /Ota kauppaehdotus käyttöön|Apply storefront proposal/ })
    .click();
  await expect(page.getByText(/Storefront proposal applied|kauppaehdotus/i)).toBeVisible();
  await page.getByRole("button", { name: /Tallenna luonnos|Save draft/ }).click();
  await page.goto(
    `/projects/${projectId}/publish?p9-05b-session=${encodeURIComponent(premium.sessionId)}`,
  );
  await page.getByRole("button", { name: /Tarkista julkaisu|Review publish/ }).click();
  await page.getByRole("button", { name: /Julkaise verkkokauppa|Publish storefront/ }).click();
  await expect(
    page.getByRole("heading", { name: /julkaistiin onnistuneesti|published successfully/i }),
  ).toBeVisible();

  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.goto(`/projects/${projectId}/published`);
    await expect(page.locator('[data-component="homepageHero"]')).toBeVisible();
    await expectRenderedProfile(page, profiles[0], "published");
    await expectNoStorefrontHorizontalClipping(page);
  }

  expect(browserErrors).toEqual([]);
  expect(providerRequests).toEqual([]);
});
