import { describe, expect, it } from "vitest";
import {
  getComponentDefinition,
  veskifyComponentDefinitionsV2,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import {
  dynamicCollectionCommerceVariantSchema,
  dynamicProductDetailPropsSchema,
  dynamicProductDetailVariantSchema,
  homepageHeroPropsSchema,
} from "@/components/registry";
import { karvonenSeed } from "@/data/seed";
import {
  brandSystemToCssVariables,
  premiumVisualPresetIds,
  premiumVisualPresetIdSchema,
  premiumVisualPresetLabels,
  premiumVisualPresets,
  visualSystemSchema,
} from "@/domain/design-system";

describe("P8-04 AI-ready storefront visual system", () => {
  it("offers only the three approved visual presets with complete EN/FI labels", () => {
    expect(Object.keys(premiumVisualPresets)).toEqual([
      "premiumEditorial",
      "modernMinimal",
      "futureLuxury",
    ]);
    premiumVisualPresetIds.forEach((preset) => {
      const visualSystem = premiumVisualPresets[preset];
      const label = premiumVisualPresetLabels[preset];
      expect(premiumVisualPresetIdSchema.parse(preset)).toBe(preset);
      expect(visualSystemSchema.parse(visualSystem)).toEqual(visualSystem);
      expect(label.en.length).toBeGreaterThan(0);
      expect(label.fi.length).toBeGreaterThan(0);
    });
    expect(() => premiumVisualPresetIdSchema.parse("arbitraryCss")).toThrow();
    expect(() =>
      visualSystemSchema.parse({ ...premiumVisualPresets.modernMinimal, shadow: "huge" }),
    ).toThrow();
  });

  it("turns the selected structured visual system into bounded shared CSS variables", () => {
    const variables = brandSystemToCssVariables(karvonenSeed.draftSnapshot.brandSystem);

    expect(variables).toMatchObject({
      "--brand-content-width": "92rem",
      "--brand-surface-treatment": "layered",
      "--brand-divider-treatment": "subtle",
      "--brand-button-hierarchy": "balanced",
      "--brand-image-treatment": "editorial",
    });
  });

  it("registers premium header, hero, footer, collection and PDP layouts", () => {
    expect(getComponentDefinition("header").variants).toContain("editorial");
    expect(getComponentDefinition("hero").variants).toEqual(
      expect.arrayContaining(["fullBleed", "asymmetric", "restrained"]),
    );
    expect(getComponentDefinition("footer").variants).toEqual(
      expect.arrayContaining(["expanded", "dark", "compact"]),
    );
    expect(dynamicCollectionCommerceVariantSchema.options).toContain("gallery");
    expect(dynamicProductDetailVariantSchema.options).toEqual(
      expect.arrayContaining(["galleryDominant", "editorialSplit"]),
    );
    expect(
      veskifyComponentDefinitionsV2
        .find((definition) => definition.type === "homepageHero")
        ?.variants.map((variant) => variant.id),
    ).toEqual(expect.arrayContaining(["fullBleedOverlay", "asymmetric", "restrained"]));
    expect(veskifyComponentRegistryV2.get("dynamicProductDetail").type).toBe(
      "dynamicProductDetail",
    );
  });

  it("rejects arbitrary presentation fields while accepting only approved media treatment", () => {
    expect(
      dynamicProductDetailPropsSchema.parse({
        galleryLayout: "thumbnails",
        optionDensity: "comfortable",
        attributeLayout: "groups",
        showDescription: true,
        showSku: true,
        stickyMobileAction: true,
        mediaTreatment: "editorial",
      }).mediaTreatment,
    ).toBe("editorial");
    expect(() =>
      dynamicProductDetailPropsSchema.parse({
        galleryLayout: "thumbnails",
        optionDensity: "comfortable",
        attributeLayout: "groups",
        showDescription: true,
        showSku: true,
        stickyMobileAction: true,
        mediaTreatment: "url(https://example.com/image.jpg)",
      }),
    ).toThrow();
    expect(() =>
      homepageHeroPropsSchema.parse({
        mediaPosition: "background",
        imagePresentation: "cover",
        textAlignment: "center",
        arbitraryCss: "position: fixed",
      }),
    ).toThrow();
  });

  it("uses a premium but independent Karvonen composition without changing commerce facts", () => {
    const snapshot = karvonenSeed.draftSnapshot;
    const home = snapshot.pages.find((page) => page.type === "home");
    const product = karvonenSeed.catalogue.products.find(
      (candidate) => candidate.id === "product_karvonen_01",
    );

    expect(snapshot.brandSystem.visualSystem?.preset).toBe("premiumEditorial");
    expect(home?.sections.find((section) => section.component === "header")?.variant).toBe(
      "editorial",
    );
    expect(home?.sections.find((section) => section.component === "hero")?.variant).toBe(
      "fullBleed",
    );
    expect(product).toMatchObject({
      id: "product_karvonen_01",
      sku: "BV012s",
      price: { amount: 129, currency: "EUR" },
    });
  });
});
