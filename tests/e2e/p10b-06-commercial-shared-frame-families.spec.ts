import { expect, test, type Page } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const profiles = [
  {
    id: "editorial-masthead",
    mobile: "drawer",
    footer: "brand-editorial",
  },
  {
    id: "commerce-utility",
    mobile: "stacked-disclosure",
    footer: "service-navigation",
  },
  {
    id: "centered-minimal",
    mobile: "compact-overlay",
    footer: "navigation-columns",
  },
  {
    id: "compact-technical",
    mobile: "drawer",
    footer: "compact-commerce-legal",
  },
] as const;

function monitorProviderTraffic(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host === "api.openai.com" || host.endsWith(".openai.com")) requests.push(request.url());
  });
  return requests;
}

for (const profile of profiles) {
  test(`${profile.id} remains distinct and unclipped at all four widths`, async ({ page }) => {
    const providerRequests = monitorProviderTraffic(page);
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `/p10b-06-frame-proof?profile=${profile.id}&locale=${width === 768 ? "fi" : "en"}`,
      );
      const frame = page.locator(`[data-frame-profile="${profile.id}"]`);
      await expect(frame.first()).toBeVisible();
      await expect(page.locator("header[data-frame-region=header]")).toHaveAttribute(
        "data-mobile-navigation-mode",
        profile.mobile,
      );
      await expect(page.locator("footer[data-frame-region=footer]")).toHaveAttribute(
        "data-footer-composition",
        profile.footer,
      );
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expect(page.locator("[data-p10b-06-frame-proof]")).toHaveAttribute(
        "lang",
        width === 768 ? "fi" : "en",
      );
      await expectNoStorefrontHorizontalClipping(page);
    }
    expect(providerRequests).toEqual([]);
  });

  test(`${profile.id} mobile navigation supports keyboard close and focus restoration`, async ({
    page,
  }) => {
    const providerRequests = monitorProviderTraffic(page);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`/p10b-06-frame-proof?profile=${profile.id}`);
    const trigger = page.locator("header[data-frame-region=header] button[aria-controls]");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = page.locator(`[data-mobile-mode="${profile.mobile}"]`);
    await expect(menu).toBeVisible();
    if (profile.mobile === "stacked-disclosure") {
      await expect(menu).toHaveAttribute("role", "region");
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    } else {
      await expect(menu).toHaveAttribute("role", "dialog");
      await expect(menu).toHaveAttribute("aria-modal", "true");
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(providerRequests).toEqual([]);
  });
}

for (const evidence of [
  { profile: "editorial-masthead", width: 1440, name: "editorial-masthead-wide.png" },
  { profile: "commerce-utility", width: 1440, name: "commerce-utility-wide.png" },
  { profile: "centered-minimal", width: 1440, name: "centered-minimal-wide.png" },
  { profile: "compact-technical", width: 1440, name: "compact-technical-wide.png" },
  { profile: "editorial-masthead", width: 375, name: "drawer-mobile.png" },
  { profile: "commerce-utility", width: 375, name: "stacked-disclosure-mobile.png" },
  { profile: "centered-minimal", width: 375, name: "compact-overlay-mobile.png" },
] as const) {
  test(`retains ${evidence.name} commercial visual evidence`, async ({ page }) => {
    await page.setViewportSize({ width: evidence.width, height: 1000 });
    await page.goto(`/p10b-06-frame-proof?profile=${evidence.profile}`);
    if (evidence.width === 375) {
      await page.getByRole("button", { name: "Open menu" }).click();
    }
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.complete ? image.decode().catch(() => undefined) : Promise.resolve(),
        ),
      );
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
    });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(evidence.name, {
      animations: "disabled",
      caret: "initial",
      fullPage: true,
      timeout: 10_000,
    });
  });
}

test("one frame keeps its structure while Design DNA materially changes its appearance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/p10b-06-frame-proof?profile=centered-minimal");
  const baseline = await page
    .locator("[data-p10b-06-frame-proof]")
    .screenshot({ caret: "initial" });
  await page.goto("/p10b-06-frame-proof?profile=centered-minimal&dna=technical");
  const technical = await page
    .locator("[data-p10b-06-frame-proof]")
    .screenshot({ caret: "initial" });
  expect(technical.equals(baseline)).toBe(false);
  await expect(page.locator("header")).toHaveAttribute("data-frame-profile", "centered-minimal");
});

test("locale controls preserve current preview query authority", async ({ page }) => {
  const providerRequests = monitorProviderTraffic(page);
  await page.goto("/p10b-06-frame-proof?profile=compact-technical&dna=technical&session=retained");
  await page
    .locator("header[data-frame-region=header]")
    .getByRole("button", { name: "FI" })
    .first()
    .click();
  await expect(page).toHaveURL(/locale=fi/);
  const destination = new URL(page.url());
  expect(destination.searchParams.get("profile")).toBe("compact-technical");
  expect(destination.searchParams.get("dna")).toBe("technical");
  expect(destination.searchParams.get("session")).toBe("retained");
  await expect(page.locator("[data-p10b-06-frame-proof]")).toHaveAttribute("lang", "fi");
  expect(providerRequests).toEqual([]);
});
