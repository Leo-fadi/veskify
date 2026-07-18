import { expect, test, type Page } from "@playwright/test";

const storageKey = "veskify:onboarding-session";

type StoredOnboardingSession = {
  activeStepId?: string;
  skippedStepIds?: string[];
  designBrief?: { catalogueContext?: string | null; products?: unknown };
  products?: unknown;
};

async function reachCatalogue(page: Page) {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: /Create a new storefront/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Business name" }).fill("Aurum Nordic");
  await page
    .getByRole("textbox", { name: "Short business description" })
    .fill("A Helsinki jewellery studio.");
  await page.getByRole("combobox", { name: "Industry" }).selectOption("jewellery");
  await page
    .getByRole("textbox", { name: "Target customer" })
    .fill("Customers looking for Nordic jewellery.");
  await page.getByRole("textbox", { name: "Primary market" }).fill("Finland");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Existing sources" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Brand assets" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Visual direction" })).toBeVisible();
  await page.getByRole("radio", { name: /Editorial/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
}

for (const option of [
  "Create a new storefront",
  "Redesign an existing storefront",
  "Use a demo preset",
]) {
  test(`starts onboarding with ${option.toLowerCase()}`, async ({ page }) => {
    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "How would you like to begin?" })).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(option, "i") }).check();
    await expect(page.getByRole("radio", { name: new RegExp(option, "i") })).toBeChecked();
  });
}

test("continues, goes back, refreshes and resumes the same choice", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: /Redesign an existing storefront/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Business basics" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Your saved onboarding draft has been resumed.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business basics" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("radio", { name: /Redesign an existing storefront/i })).toBeChecked();
});

test("completes Business basics, resumes partial values, and reaches deferred O-03", async ({
  page,
}) => {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: /Create a new storefront/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Business basics" })).toBeVisible();

  await page.getByRole("textbox", { name: "Business name" }).fill("Aurum Nordic");
  await page.getByRole("textbox", { name: "Business name" }).press("Tab");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Business basics" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Business name" })).toHaveValue("Aurum Nordic");

  await page
    .getByRole("textbox", { name: "Short business description" })
    .fill("A Helsinki jewellery studio.");
  await page.getByRole("combobox", { name: "Industry" }).selectOption("jewellery");
  await page
    .getByRole("textbox", { name: "Target customer" })
    .fill("Customers looking for Nordic jewellery.");
  await page.getByRole("textbox", { name: "Primary market" }).fill("Finland");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Existing sources" })).toBeVisible();
  await expect(page.getByText(/No existing storefront is needed/i)).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Business basics" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Existing sources" })).toBeVisible();
});

test("saves a focused edit before Back and restores it on O-02", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: /Create a new storefront/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  const name = page.getByRole("textbox", { name: "Business name" });
  await name.fill("Aurum Nordic");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "How would you like to begin?" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Business basics" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Business name" })).toHaveValue("Aurum Nordic");
});

test("completes redesign Existing sources, goes back, and resumes the URL", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: /Redesign an existing storefront/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Business name" }).fill("Aurum Nordic");
  await page
    .getByRole("textbox", { name: "Short business description" })
    .fill("A Helsinki jewellery studio.");
  await page.getByRole("combobox", { name: "Industry" }).selectOption("jewellery");
  await page
    .getByRole("textbox", { name: "Target customer" })
    .fill("Customers looking for Nordic jewellery.");
  await page.getByRole("textbox", { name: "Primary market" }).fill("Finland");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Existing sources" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Current storefront address" })
    .fill("merchant.example/store");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Brand assets" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("textbox", { name: "Current storefront address" })).toHaveValue(
    "https://merchant.example/store",
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Existing sources" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Current storefront address" })).toHaveValue(
    "https://merchant.example/store",
  );
});

test("skips redesign Existing sources after typing and persists no URL", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: /Redesign an existing storefront/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Business name" }).fill("Aurum Nordic");
  await page
    .getByRole("textbox", { name: "Short business description" })
    .fill("A Helsinki jewellery studio.");
  await page.getByRole("combobox", { name: "Industry" }).selectOption("jewellery");
  await page
    .getByRole("textbox", { name: "Target customer" })
    .fill("Customers looking for Nordic jewellery.");
  await page.getByRole("textbox", { name: "Primary market" }).fill("Finland");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Existing sources" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Current storefront address" })
    .fill("merchant.example/store");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Brand assets" })).toBeVisible();
  expect(
    await page.evaluate((key) => {
      type StoredSession = {
        activeStepId?: string;
        completedStepIds?: string[];
        skippedStepIds?: string[];
        designBrief?: { creationContext?: { existingStorefrontUrl?: string | null } };
      };
      const session = JSON.parse(
        window.localStorage.getItem(key) ?? "{}",
      ) as unknown as StoredSession;
      return {
        activeStepId: session.activeStepId,
        completedStepIds: session.completedStepIds,
        skippedStepIds: session.skippedStepIds,
        url: session.designBrief?.creationContext?.existingStorefrontUrl,
      };
    }, storageKey),
  ).toEqual({
    activeStepId: "brand-assets",
    completedStepIds: ["creation-path", "business-basics"],
    skippedStepIds: ["existing-sources"],
    url: null,
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Brand assets" })).toBeVisible();
});

test("supports Finnish Existing sources completion", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: "Suomi" }).check();
  await page.getByRole("radio", { name: /Uudista nykyinen verkkokauppa/i }).check();
  await page.getByRole("button", { name: "Jatka" }).click();
  await page.getByRole("textbox", { name: "Yrityksen nimi" }).fill("Aurum Nordic");
  await page
    .getByRole("textbox", { name: "Lyhyt kuvaus yrityksestä" })
    .fill("Helsinkiläinen korustudio.");
  await page.getByRole("combobox", { name: "Toimiala" }).selectOption("jewellery");
  await page
    .getByRole("textbox", { name: "Kohdeasiakas" })
    .fill("Pohjoismaisista koruista kiinnostuneet.");
  await page.getByRole("textbox", { name: "Päämarkkina" }).fill("Suomi");
  await page.getByRole("button", { name: "Jatka" }).click();
  await expect(page.getByRole("heading", { name: "Nykyiset lähteet" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Nykyisen verkkokaupan osoite" })
    .fill("merchant.example");
  await page.getByRole("button", { name: "Jatka" }).click();
  await expect(page.getByRole("heading", { name: "Brändiaineistot" })).toBeVisible();
});

test("completes visual direction with keyboard-accessible controlled choices and resumes it", async ({
  page,
}) => {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: /Create a new storefront/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Business name" }).fill("Aurum Nordic");
  await page
    .getByRole("textbox", { name: "Short business description" })
    .fill("A Helsinki jewellery studio.");
  await page.getByRole("combobox", { name: "Industry" }).selectOption("jewellery");
  await page
    .getByRole("textbox", { name: "Target customer" })
    .fill("Customers looking for Nordic jewellery.");
  await page.getByRole("textbox", { name: "Primary market" }).fill("Finland");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Existing sources" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Brand assets" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Visual direction" })).toBeVisible();

  const editorial = page.getByRole("radio", { name: /Editorial/i });
  await editorial.focus();
  await page.keyboard.press("Space");
  await expect(editorial).toBeChecked();
  const tone = page.getByRole("button", { name: "Warm", exact: true });
  await tone.focus();
  await page.keyboard.press("Enter");
  await expect(tone).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("combobox", { name: "Accessibility" }).selectOption("high-contrast");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Visual direction" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Editorial/i })).toBeChecked();
  await expect(page.getByRole("button", { name: "Remove Warm" })).toBeVisible();
});

test("completes O-06 with the demo context from the keyboard and resumes it", async ({ page }) => {
  await reachCatalogue(page);

  const demo = page.getByRole("radio", { name: /Demo catalogue/i });
  await demo.focus();
  await page.keyboard.press("Space");
  await expect(demo).toBeChecked();
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}");
        const session = (
          parsed !== null && typeof parsed === "object" ? parsed : {}
        ) as StoredOnboardingSession;
        return session.designBrief?.catalogueContext;
      }, storageKey),
    )
    .toBe("controlled-demo-catalogue");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Store pages" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Store pages" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("radio", { name: /Demo catalogue/i })).toBeChecked();
});

test("skips O-06 with the empty context without product data on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await reachCatalogue(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Store pages" })).toBeVisible();
  expect(
    await page.evaluate((key) => {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      const session = (
        parsed !== null && typeof parsed === "object" ? parsed : {}
      ) as StoredOnboardingSession;
      return {
        activeStepId: session.activeStepId,
        catalogueContext: session.designBrief?.catalogueContext,
        skipped: session.skippedStepIds?.includes("catalogue"),
        productData: session.designBrief?.products ?? session.products ?? null,
      };
    }, storageKey),
  ).toEqual({
    activeStepId: "pages",
    catalogueContext: "empty-catalogue",
    skipped: true,
    productData: null,
  });
});

test("supports Finnish labels and keyboard navigation through Business basics", async ({
  page,
}) => {
  await page.goto("/projects/new");
  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");
  const newStorefront = page.getByRole("radio", { name: /Luo uusi verkkokauppa/i });
  await newStorefront.focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Jatka" }).click();
  await expect(page.getByRole("heading", { name: "Yrityksen perustiedot" })).toBeVisible();

  await page.getByRole("textbox", { name: "Yrityksen nimi" }).fill("Aurum Nordic");
  await page
    .getByRole("textbox", { name: "Lyhyt kuvaus yrityksestä" })
    .fill("Helsinkiläinen studio.");
  await page.getByRole("combobox", { name: "Toimiala" }).selectOption("jewellery");
  await page
    .getByRole("textbox", { name: "Kohdeasiakas" })
    .fill("Pohjoismaisista koruista kiinnostuneet.");
  await page.getByRole("textbox", { name: "Päämarkkina" }).fill("Suomi");
  await page.getByRole("button", { name: "Jatka" }).click();
  await expect(page.getByRole("heading", { name: "Nykyiset lähteet" })).toBeVisible();
});

test("supports Finnish and keyboard-only creation-path selection", async ({ page }) => {
  await page.goto("/projects/new");
  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Miten haluat aloittaa?" })).toBeVisible();

  const demo = page.getByRole("radio", { name: /Käytä demopohjaa/i });
  await demo.focus();
  await page.keyboard.press("Space");
  await expect(demo).toBeChecked();
  await expect(page.getByRole("button", { name: "Jatka" })).toBeEnabled();
});

test("recovers from corrupt saved onboarding without exposing technical details", async ({
  page,
}) => {
  await page.addInitScript(({ key }) => window.localStorage.setItem(key, "not valid json"), {
    key: storageKey,
  });
  await page.goto("/projects/new");
  await expect(
    page.getByRole("heading", { name: "Saved onboarding progress cannot be opened" }),
  ).toBeVisible();
  await expect(page.getByText(/schema|JSON|storage key/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Discard and restart" }).click();
  await page.getByRole("button", { name: "Yes, start over" }).click();
  await expect(page.getByRole("heading", { name: "How would you like to begin?" })).toBeVisible();
});

test("recovers from an incompatible saved onboarding version", async ({ page }) => {
  await page.addInitScript(
    ({ key }) => window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 99 })),
    { key: storageKey },
  );
  await page.goto("/projects/new");
  await expect(page.getByRole("heading", { name: /needs a fresh start/i })).toBeVisible();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`onboarding has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "How would you like to begin?" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
