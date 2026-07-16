import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createStorefrontRenderContext,
  getComponentDefinition,
  renderRegisteredSection,
} from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";

const context = (activeLocale: "en" | "fi" = "en") =>
  createStorefrontRenderContext({
    activeLocale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });

const contracts = {
  announcementBar: ["singleLine", "minimal", "bold"],
  header: ["centered", "split", "compact"],
  featuredCategories: ["editorialCards", "grid", "imageLed"],
  productGrid: ["editorial", "standard", "compact"],
  campaignBanner: ["split", "imageOverlay", "minimal"],
  imageText: ["imageRight", "imageLeft", "stacked"],
  brandStory: ["editorial", "minimal", "imageLed"],
  benefitIcons: ["threeColumn", "minimal", "cards"],
  newsletter: ["inline", "card", "fullWidth"],
  footer: ["columns", "editorial", "compact"],
} as const;

afterEach(cleanup);

describe("P2-02 storefront design vocabulary", () => {
  it("validates and renders every controlled variant with token classes", () => {
    for (const [component, variants] of Object.entries(contracts)) {
      const definition = getComponentDefinition(component);
      expect(definition.variants).toEqual(variants);
      for (const variant of variants) {
        const pageType = component === "imageText" ? "product" : definition.allowedPageTypes[0];
        const section = {
          id: `section_${component}_${variant}`.toLowerCase(),
          component,
          variant,
          visible: true,
          content: definition.defaultContent,
          props: {
            ...definition.defaultProps,
            background: "accent",
            density: "compact",
            typography: "strong",
            shape: "rounded",
          },
        };
        const { container } = render(<>{renderRegisteredSection(section, context(), pageType)}</>);
        const root = container.firstElementChild;
        expect(root).toHaveClass(`store-variant--${variant}`);
        expect(root).toHaveClass(
          "store-background--accent",
          "store-density--compact",
          "store-typography--strong",
          "store-shape--rounded",
        );
        cleanup();
      }
    }
  });

  it("renders controlled EN and FI content", () => {
    const definition = getComponentDefinition("campaignBanner");
    const section = {
      id: "section_localized_campaign",
      component: "campaignBanner",
      variant: "imageOverlay",
      visible: true,
      content: {
        ...definition.defaultContent,
        heading: { en: "Winter edit", fi: "Talven valikoima" },
      },
      props: definition.defaultProps,
    };
    const { rerender } = render(<>{renderRegisteredSection(section, context("en"), "home")}</>);
    expect(screen.getByRole("heading", { name: "Winter edit" })).toBeVisible();
    rerender(<>{renderRegisteredSection(section, context("fi"), "home")}</>);
    expect(screen.getByRole("heading", { name: "Talven valikoima" })).toBeVisible();
  });

  it("rejects invalid variants, malformed tokens, and commerce overrides", () => {
    const definition = getComponentDefinition("productGrid");
    const base = {
      id: "section_protected_grid",
      component: "productGrid",
      variant: "standard",
      visible: true,
      content: definition.defaultContent,
      props: definition.defaultProps,
    };
    expect(() => definition.validate({ ...base, variant: "freeform" }, "home", context())).toThrow(
      /Unsupported/,
    );
    expect(() =>
      definition.validate(
        { ...base, props: { ...base.props, background: "neon" } },
        "home",
        context(),
      ),
    ).toThrow();
    expect(() =>
      definition.validate(
        { ...base, props: { ...base.props, price: 1, stockStatus: "inStock" } },
        "home",
        context(),
      ),
    ).toThrow();
    expect(definition.editorFields).not.toHaveProperty("price");
    expect(definition.editorFields).not.toHaveProperty("productIds");
    expect(definition.protectedFields.readOnlyPaths).toEqual(
      expect.arrayContaining([
        "productIds",
        "catalogue.products.*.id",
        "catalogue.products.*.sku",
        "catalogue.products.*.price",
        "catalogue.products.*.stockStatus",
        "catalogue.products.*.images",
      ]),
    );
  });

  it("retains page placement rules and de-duplicates global sections", () => {
    const productGrid = getComponentDefinition("productGrid");
    expect(() =>
      productGrid.validate(
        {
          id: "section_grid_wrong_page",
          component: "productGrid",
          variant: "standard",
          visible: true,
          content: productGrid.defaultContent,
          props: productGrid.defaultProps,
        },
        "product",
        context(),
      ),
    ).toThrow(/not allowed/);

    const page = structuredClone(
      aurumNordicSeed.draftSnapshot.pages.find((item) => item.type === "home")!,
    );
    const header = page.sections.find((section) => section.component === "header")!;
    const footer = page.sections.find((section) => section.component === "footer")!;
    page.sections.push(
      { ...structuredClone(header), id: "section_duplicate_header" },
      { ...structuredClone(footer), id: "section_duplicate_footer" },
    );
    expect(() => renderStorefrontPage(page, context())).toThrow(
      /must not contain more than one header/,
    );
  });
});
