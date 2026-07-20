import { expect, test } from "@playwright/test";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";
import { onboardingBriefIdForSession, onboardingSessionSchema } from "@/domain/onboarding";

const storageKey = "veskify:onboarding-session";
const createdAt = "2026-07-19T10:00:00.000Z";

function reviewSession() {
  const id = "onboarding_review_e2e";
  return onboardingSessionSchema.parse({
    schemaVersion: 2,
    id,
    creationPath: "new-storefront",
    activeStepId: "review-plan",
    completedStepIds: [
      "creation-path",
      "business-basics",
      "existing-sources",
      "visual-direction",
      "catalogue",
      "pages",
      "languages",
    ],
    skippedStepIds: ["brand-assets"],
    selectedLanguages: ["en", "fi"],
    primaryLanguage: "en",
    status: "active",
    createdAt,
    updatedAt: createdAt,
    designBrief: normalizeStorefrontDesignBriefInput({
      id: onboardingBriefIdForSession(id),
      createdAt,
      updatedAt: createdAt,
      creationContext: { type: "new-storefront" },
      businessIdentity: {
        businessName: "Northern Light Studio",
        shortDescription: "Considered jewellery for everyday wear.",
        industry: "jewellery",
        targetCustomer: "Customers looking for lasting Nordic design.",
        primaryMarket: "Finland",
      },
      brandDirection: {
        visualStyleDirection: "editorial",
        typographyDirection: "serif-led",
        imageryDirection: "product-focused",
        toneKeywords: ["elegant"],
      },
      catalogueContext: "controlled-demo-catalogue",
      storefrontStructure: { pageTypes: ["home", "collection", "product"] },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    }),
  });
}

test.beforeEach(async ({ page }) => {
  const session = reviewSession();
  await page.addInitScript(
    ({ key, value }) => {
      const seededKey = `${key}:e2e-seeded`;
      if (!window.sessionStorage.getItem(seededKey)) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.setItem(seededKey, "true");
      }
    },
    { key: storageKey, value: JSON.stringify(session) },
  );
});

test("restores O-09 without project persistence and renders its canonical review", async ({
  page,
}) => {
  await page.goto("/projects/new");
  await expect(page.getByRole("heading", { name: "Review your storefront plan" })).toBeVisible();
  const businessSummary = page
    .getByRole("heading", { name: "What we understood" })
    .locator("xpath=ancestor::summary");
  await businessSummary.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Northern Light Studio")).toBeVisible();
  for (const heading of [
    "What we understood",
    "Brand direction",
    "Storefront template",
    "Storefront pages",
    "Storefront languages",
    "Catalogue plan",
    "Warnings",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Ready to create" })).toBeVisible();
  await expect(
    page.getByText(/template_balanced_commerce|logo-available|when-not-requested/),
  ).toHaveCount(0);
  expect(
    await page.evaluate(async () =>
      (await indexedDB.databases()).some(({ name }) => name === "veskify"),
    ),
  ).toBe(false);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Review your storefront plan" })).toBeVisible();
  expect(
    await page.evaluate(async () =>
      (await indexedDB.databases()).some(({ name }) => name === "veskify"),
    ),
  ).toBe(false);
});

test("confirms O-09 from the keyboard and enters the returned editor route", async ({ page }) => {
  await page.goto("/projects/new");
  const create = page.getByRole("button", { name: "Create storefront project" });
  await create.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/projects\/project_onboarding_[a-f0-9]{8}\/editor$/);
  await expect(page.getByText("Northern Light Studio", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
  expect(
    await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const open = indexedDB.open("veskify");
          open.onerror = () => reject(new Error("Could not open the project database."));
          open.onsuccess = () => {
            const database = open.result;
            const projects = database.transaction("projects").objectStore("projects").getAll();
            projects.onerror = () => reject(new Error("Could not count persisted projects."));
            projects.onsuccess = () => {
              database.close();
              const persistedProjects = projects.result as unknown as Array<{ id: string }>;
              resolve(
                persistedProjects.filter(({ id }) => id.startsWith("project_onboarding_")).length,
              );
            };
          };
        }),
    ),
  ).toBe(1);

  await page.goBack();
  await expect(page.getByRole("heading", { name: "How would you like to begin?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create storefront project" })).toHaveCount(0);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`O-09 has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "Review your storefront plan" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
