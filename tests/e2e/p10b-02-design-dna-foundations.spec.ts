import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const representativePages = [
  {
    kind: "home",
    url: "/projects/project_aurum_nordic",
    heading: "Made for northern light",
    headingLevel: 2,
  },
  {
    kind: "collection",
    url: "/projects/project_aurum_nordic/collections/rings",
    heading: "Rings",
    headingLevel: 1,
  },
  {
    kind: "product",
    url: "/projects/project_aurum_nordic/products/aurora-ring-585",
    heading: "Aurora Ring 585",
    headingLevel: 1,
  },
] as const;

for (const width of [375, 768, 1024, 1440]) {
  test(`projects one merchant-wide Design DNA across representative pages at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const fingerprints = new Set<string>();

    for (const representative of representativePages) {
      await page.goto(representative.url);
      const root = page.locator(".project-preview");
      const heading = page.getByRole("heading", {
        level: representative.headingLevel,
        name: representative.heading,
      });
      await expect(root).toBeVisible();
      await expect(heading).toBeVisible();

      const foundation = await root.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          fingerprint: style.getPropertyValue("--brand-design-dna-fingerprint").trim(),
          displayFont: style.getPropertyValue("--brand-font-display").trim(),
          sectionRhythm: style.getPropertyValue("--brand-section-rhythm").trim(),
          pageGutter: style.getPropertyValue("--brand-page-gutter").trim(),
          controlHeight: style.getPropertyValue("--brand-control-height").trim(),
          mediaCrop: style.getPropertyValue("--brand-media-crop").trim(),
        };
      });
      fingerprints.add(foundation.fingerprint);
      expect(foundation).toMatchObject({
        fingerprint: expect.stringMatching(/^design-dna-/),
        displayFont: expect.stringContaining("Georgia"),
        sectionRhythm: expect.stringContaining("clamp"),
        pageGutter: expect.stringContaining("clamp"),
        controlHeight: "2.75rem",
        mediaCrop: "cover",
      });
      await expect(heading).toHaveCSS("font-family", /Georgia/);
      await expectNoStorefrontHorizontalClipping(page);
    }

    expect(fingerprints.size).toBe(1);
  });
}
