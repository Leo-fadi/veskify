import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const profiles = [
  "content-about-story",
  "content-about-process",
  "content-contact-channels",
  "content-contact-directory",
  "content-location-directory",
  "content-location-appointments",
  "content-faq-disclosure",
  "content-faq-topic-guide",
  "content-service-details",
  "content-policy-reading",
  "content-generic-reading",
  "content-generic-editorial",
  "landing-campaign-editorial",
  "landing-campaign-image-led",
  "landing-campaign-story",
] as const;

const widths = [375, 768, 1024, 1440] as const;

for (const profileId of profiles) {
  for (const width of widths) {
    test(`${profileId} renders approved content at ${width}px without a provider`, async ({
      page,
    }, testInfo) => {
      const providerRequests: string[] = [];
      page.on("request", (request) => {
        const host = new URL(request.url()).hostname;
        if (host === "api.openai.com" || host.endsWith(".openai.com"))
          providerRequests.push(request.url());
      });
      await page.setViewportSize({ width, height: width === 375 ? 1000 : 1100 });
      await page.goto(`/p10b-12-content-support-proof?profile=${profileId}`);
      const root = page.locator(`[data-p10b-12-content-support-profile="${profileId}"]`);
      await expect(root).toHaveAttribute("data-structural-fingerprint", /content-support-profile-/);
      await expect(root).toHaveAttribute(
        "data-fact-document-fingerprint",
        /content-support-facts-v1_/,
      );
      await expect(root.locator('[data-frame-region="header"]')).toHaveAttribute(
        "data-frame-profile",
      );
      await expect(root.locator("main")).toBeVisible();
      await expectNoStorefrontHorizontalClipping(page);
      expect(providerRequests).toEqual([]);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
      });
      await testInfo.attach(`${profileId}-${width}px`, {
        body: await root.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
    });
  }
}

test("profiles retain distinct compositions and only display bounded approved content", async ({
  page,
}) => {
  const fingerprints = new Set<string>();
  for (const profileId of profiles) {
    await page.goto(`/p10b-12-content-support-proof?profile=${profileId}`);
    const root = page.locator(`[data-p10b-12-content-support-profile="${profileId}"]`);
    fingerprints.add((await root.getAttribute("data-structural-fingerprint"))!);
    await expect(root).not.toContainText("unapproved caller fact");
    await expect(root).toHaveAttribute(
      "data-fact-document-fingerprint",
      /content-support-facts-v1_/,
    );
    await expect(root.locator('[data-component="contentSupport"]')).not.toBeEmpty();
  }
  expect(fingerprints.size).toBe(profiles.length);
});
