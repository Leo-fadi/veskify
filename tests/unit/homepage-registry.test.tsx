import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createStorefrontRenderContext,
  getComponentDefinition,
  validateRegisteredPage,
  veskifyComponentRegistry,
} from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const context = (locale: "en" | "fi" = "en") =>
  createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });
const expectedTypes = [
  "announcementBar",
  "header",
  "hero",
  "featuredCategories",
  "productGrid",
  "campaignBanner",
  "brandStory",
  "benefitIcons",
  "newsletter",
  "footer",
];

describe("P1-01 homepage registry", () => {
  it("registers strict, valid defaults for every initial homepage component", () => {
    expect(Object.keys(veskifyComponentRegistry)).toEqual(expect.arrayContaining(expectedTypes));
    for (const definition of Object.values(veskifyComponentRegistry)) {
      expect(definition.contentSchema.parse(definition.defaultContent)).toEqual(
        definition.defaultContent,
      );
      expect(definition.propsSchema.parse(definition.defaultProps)).toEqual(
        definition.defaultProps,
      );
      expect(() =>
        definition.contentSchema.parse({ ...definition.defaultContent, unsafe: true }),
      ).toThrow();
      expect(definition.variants).toEqual([definition.defaultVariant]);
    }
  });

  it("rejects unsupported variants and disallowed page placement", () => {
    for (const section of homepage.sections) {
      const definition = getComponentDefinition(section.component);
      expect(() =>
        definition.validate({ ...section, variant: "unsupported" }, "home", context()),
      ).toThrow(/Unsupported/);
    }
    expect(() =>
      getComponentDefinition("header").validate(homepage.sections[1], "product", context()),
    ).toThrow(/not allowed/);
  });

  it("rejects duplicate and unknown catalogue references before rendering", () => {
    const productSection = structuredClone(
      homepage.sections.find((section) => section.component === "productGrid")!,
    );
    productSection.content.productIds = ["product_aurora_ring_585", "product_aurora_ring_585"];
    expect(() =>
      validateRegisteredPage({ ...homepage, sections: [productSection] }, context()),
    ).toThrow(/duplicates/);
    productSection.content.productIds = ["product_missing"];
    expect(() =>
      validateRegisteredPage({ ...homepage, sections: [productSection] }, context()),
    ).toThrow(/Unknown product/);

    const collectionSection = structuredClone(
      homepage.sections.find((section) => section.component === "featuredCategories")!,
    );
    collectionSection.content.collectionIds = ["collection_missing"];
    expect(() =>
      validateRegisteredPage({ ...homepage, sections: [collectionSection] }, context()),
    ).toThrow(/Unknown collection/);
  });

  it("marks catalogue commerce and runtime data as protected", () => {
    expect(getComponentDefinition("productGrid").protectedFields.readOnlyPaths).toEqual(
      expect.arrayContaining([
        "productIds",
        "catalogue.products.*.price",
        "catalogue.products.*.stockStatus",
      ]),
    );
    expect(getComponentDefinition("header").protectedFields.readOnlyPaths).toContain("navigation");
    expect(getComponentDefinition("footer").protectedFields.readOnlyPaths).toContain("navigation");
  });

  it("renders all ten sections in canonical order with catalogue and navigation data", () => {
    const { container } = render(<>{renderStorefrontPage(homepage, context())}</>);
    expect([...container.children].map((element) => element.tagName.toLowerCase())).toEqual([
      "aside",
      "header",
      "section",
      "section",
      "section",
      "section",
      "section",
      "section",
      "section",
      "footer",
    ]);
    expect(screen.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Aurora Ring 585" })).toBeVisible();
    expect(screen.getByText((value) => value.replace(/\s/g, "") === "1290€")).toBeVisible();
    expect(screen.getByText("Limited availability")).toBeVisible();
    expect(
      within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", {
        name: "Rings",
      }),
    ).toHaveAttribute("href", "/collections/rings");
  });

  it("renders Finnish content and shared locale fallback", () => {
    const value = structuredClone(homepage);
    const campaign = value.sections.find((section) => section.component === "campaignBanner")!;
    campaign.content.heading = { en: "Primary fallback campaign" };
    render(<>{renderStorefrontPage(value, context("fi"))}</>);
    expect(screen.getByRole("heading", { name: "Tehty pohjoiseen valoon" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Aurora-sormus 585" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Primary fallback campaign" })).toBeVisible();
  });

  it("renders useful catalogue-backed empty states", () => {
    const value = structuredClone(homepage);
    value.sections.find(
      (section) => section.component === "featuredCategories",
    )!.content.collectionIds = [];
    value.sections.find((section) => section.component === "productGrid")!.content.productIds = [];
    render(<>{renderStorefrontPage(value, context())}</>);
    expect(screen.getByText("Collections will appear here when they are available.")).toBeVisible();
    expect(screen.getByText("Products will appear here when they are available.")).toBeVisible();
  });
});
