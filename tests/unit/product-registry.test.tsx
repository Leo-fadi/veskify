import { describe, expect, it } from "vitest";
import {
  createStorefrontRenderContext,
  getComponentDefinition,
  validateRegisteredPage,
} from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { productOrderOptionDisplaySchema } from "@/domain/catalogue";

const page = aurumNordicSeed.draftSnapshot.pages.find((item) => item.type === "product")!;
const context = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
});

describe("P1-03 product registry", () => {
  it("registers strict defaults and approved variants", () => {
    const expected = {
      productGallery: "thumbnails",
      productInfo: "premium",
      productOptions: "buttons",
      imageText: "imageRight",
      relatedProducts: "grid",
    };
    for (const [type, variant] of Object.entries(expected)) {
      const definition = getComponentDefinition(type);
      expect(definition.defaultVariant).toBe(variant);
      expect(() =>
        definition.contentSchema.parse({ ...definition.defaultContent, extra: true }),
      ).toThrow();
      expect(() =>
        definition.validate(
          {
            id: `section_${type}`,
            component: type,
            variant: "wrong",
            visible: true,
            content: definition.defaultContent,
            props: definition.defaultProps,
          },
          "product",
          context,
        ),
      ).toThrow(/Unsupported/);
    }
    expect(getComponentDefinition("imageText").allowedPageTypes).toEqual(["product", "content"]);
    expect(() =>
      getComponentDefinition("productInfo").validate(page.sections[2], "home", context),
    ).toThrow(/not allowed/);
  });

  it("rejects unknown and duplicate product references", () => {
    const unknown = structuredClone(page.sections[1]);
    unknown.content.productId = "product_unknown";
    expect(() =>
      getComponentDefinition("productGallery").validate(unknown, "product", context),
    ).toThrow(/Unknown product/);
    const related = structuredClone(page.sections[6]);
    related.content.productIds = ["product_lumi_halo_ring", "product_lumi_halo_ring"];
    expect(() =>
      getComponentDefinition("relatedProducts").validate(related, "product", context),
    ).toThrow();
  });

  it("protects commerce and option sources", () => {
    expect(getComponentDefinition("productInfo").protectedFields.readOnlyPaths).toContain(
      "catalogue.products.*.price",
    );
    expect(getComponentDefinition("productOptions").protectedFields.readOnlyPaths).toContain(
      "catalogue.products.*.orderOptions",
    );
    expect(validateRegisteredPage(page, context).sections).toHaveLength(8);
  });

  it("validates both option types and rejects malformed cross-type values", () => {
    expect(
      productOrderOptionDisplaySchema.parse({
        id: "option_size",
        type: "selection",
        label: { en: "Size" },
        required: true,
        values: [{ en: "15" }],
      }).type,
    ).toBe("selection");
    expect(
      productOrderOptionDisplaySchema.parse({
        id: "option_engraving",
        type: "text",
        label: { en: "Engraving" },
        required: false,
        maxLength: 20,
      }).type,
    ).toBe("text");
    for (const malformed of [
      { id: "option_empty", type: "selection", label: { en: "Size" }, required: true, values: [] },
      {
        id: "option_selection_limit",
        type: "selection",
        label: { en: "Size" },
        required: true,
        values: [{ en: "15" }],
        maxLength: 2,
      },
      { id: "option_text_no_limit", type: "text", label: { en: "Text" }, required: false },
      {
        id: "option_text_values",
        type: "text",
        label: { en: "Text" },
        required: false,
        maxLength: 20,
        values: [{ en: "Invalid" }],
      },
    ]) {
      expect(() => productOrderOptionDisplaySchema.parse(malformed)).toThrow();
    }
  });
});
