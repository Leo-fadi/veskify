import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createStorefrontRenderContext,
  designVocabularyDefaults,
  designVocabularyVariants,
  getComponentDefinition,
  renderRegisteredSection,
  sectionForegroundByBackground,
} from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";
import { editorPropsToSection, toPuckDefaults } from "@/integrations/puck/config";

const context = (activeLocale: "en" | "fi" = "en") =>
  createStorefrontRenderContext({
    activeLocale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });

const contracts = designVocabularyVariants;

afterEach(cleanup);

describe("P2-02 storefront design vocabulary", () => {
  it("provides renderer-owned CSS for every non-default variant and foreground pairing", () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/components/storefront/design-vocabulary.css"),
      "utf8",
    );
    for (const [component, variants] of Object.entries(designVocabularyVariants)) {
      for (const variant of variants) {
        if (
          variant === designVocabularyDefaults[component as keyof typeof designVocabularyDefaults]
        ) {
          continue;
        }
        const selector =
          component === "imageText"
            ? `.store-image-text--${variant === "imageLeft" ? "left" : "stacked"}`
            : `.store-variant--${variant}`;
        expect(stylesheet).toContain(selector);
      }
    }
    expect(stylesheet).toContain(".store-vocabulary.store-foreground--text");
    expect(stylesheet).toContain(".store-vocabulary.store-foreground--surface");
    expect(stylesheet).toContain("background: var(--brand-color-primary)");
    expect(stylesheet).toContain("background: var(--brand-color-secondary)");
    expect(stylesheet).toContain("background: var(--brand-color-accent)");
    expect(stylesheet).toContain("color: var(--brand-color-primary-text)");
    expect(stylesheet).toContain("color: var(--brand-color-secondary-text)");
    expect(stylesheet).toContain("color: var(--brand-color-accent-text)");
    expect(stylesheet).toMatch(
      /store-variant--fullBleed \.store-hero__copy[\s\S]*color: var\(--brand-color-text\)/,
    );
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain(":focus-visible");
    expect(globals).toMatch(/\.project-preview \{[\s\S]*font-size: var\(--brand-type-base-size\)/);
    expect(globals).toMatch(/\.store-announcement \{[\s\S]*color: var\(--brand-highlight-text\)/);
  });
  it("validates and renders every controlled variant with token classes", () => {
    for (const [component, variants] of Object.entries(contracts)) {
      const definition = getComponentDefinition(component);
      expect(definition.variants).toEqual(variants);
      expect(definition.defaultVariant).toBe(
        designVocabularyDefaults[component as keyof typeof designVocabularyDefaults],
      );
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
          "store-foreground--text",
          "store-density--compact",
          "store-typography--strong",
          "store-shape--rounded",
        );
        cleanup();
      }
    }
  });

  it("round-trips a non-default Puck variant into visibly distinct canonical rendering", () => {
    const definition = getComponentDefinition("campaignBanner");
    const section = editorPropsToSection(
      definition,
      {
        id: "section_puck_campaign_overlay",
        ...toPuckDefaults(definition),
        variant: "imageOverlay",
      },
      "home",
      context(),
    );
    expect(section.variant).toBe("imageOverlay");
    const { container } = render(<>{renderRegisteredSection(section, context(), "home")}</>);
    expect(container.firstElementChild).toHaveClass("store-variant--imageOverlay");
    expect(container.querySelector("img")).toBeVisible();
  });

  it("pairs every exposed background with an authoritative foreground token", () => {
    expect(sectionForegroundByBackground).toEqual({
      inherit: "inherit",
      background: "text",
      surface: "text",
      primary: "surface",
      secondary: "surface",
      accent: "text",
    });
    const definition = getComponentDefinition("footer");
    for (const [background, foreground] of Object.entries(sectionForegroundByBackground)) {
      const section = {
        id: `section_footer_${background}`,
        component: "footer",
        variant: "editorial",
        visible: true,
        content: definition.defaultContent,
        props: { ...definition.defaultProps, background },
      };
      const { container } = render(<>{renderRegisteredSection(section, context(), "home")}</>);
      expect(container.firstElementChild).toHaveClass(
        `store-background--${background}`,
        `store-foreground--${foreground}`,
      );
      cleanup();
    }
  });

  it("makes image-text variants authoritative over contradictory legacy placement props", () => {
    const definition = getComponentDefinition("imageText");
    for (const [variant, legacyPosition, expectedLayout] of [
      ["imageLeft", "right", "left"],
      ["imageRight", "left", "right"],
      ["stacked", "left", "stacked"],
    ] as const) {
      const section = {
        id: `section_image_text_${variant}`.toLowerCase(),
        component: "imageText",
        variant,
        visible: true,
        content: definition.defaultContent,
        props: { ...definition.defaultProps, mediaPosition: legacyPosition },
      };
      const { container } = render(<>{renderRegisteredSection(section, context(), "product")}</>);
      expect(container.firstElementChild).toHaveClass(`store-image-text--${expectedLayout}`);
      if (expectedLayout !== "left") {
        expect(container.firstElementChild).not.toHaveClass("store-image-text--left");
      }
      if (expectedLayout !== "right") {
        expect(container.firstElementChild).not.toHaveClass("store-image-text--right");
      }
      cleanup();
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
