import { describe, expect, it } from "vitest";
import { createStorefrontRenderContext } from "@/components/registry";
import {
  cartPageContentSchema,
  cartPageDefinition,
  cartPagePropsSchema,
} from "@/components/registry/cart";
import { aurumNordicSeed } from "@/data/seed";
import type { SectionInstance } from "@/domain/storefront";

const context = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
});

const section = (lineItems?: Array<{ productId: string; quantity: number }>): SectionInstance => ({
  id: "section_cart_page",
  component: "cartPage",
  variant: "split",
  visible: true,
  content: {
    ...structuredClone(cartPageDefinition.defaultContent),
    ...(lineItems !== undefined ? { lineItems } : {}),
  },
  props: cartPagePropsSchema.parse(cartPageDefinition.defaultProps),
});

describe("P1-04 cart registry", () => {
  it("defines strict, schema-valid split defaults for cart pages", () => {
    expect(cartPageDefinition.allowedPageTypes).toEqual(["cart"]);
    expect(cartPageDefinition.variants).toEqual(["split"]);
    expect(cartPageContentSchema.parse(cartPageDefinition.defaultContent)).toEqual(
      cartPageDefinition.defaultContent,
    );
    expect(cartPagePropsSchema.parse(cartPageDefinition.defaultProps)).toEqual(
      cartPageDefinition.defaultProps,
    );
    expect(() =>
      cartPageContentSchema.parse({ ...cartPageDefinition.defaultContent, unsafe: true }),
    ).toThrow();
  });

  it("rejects unsupported placement, variants and interactive cart props", () => {
    expect(() => cartPageDefinition.validate(section(), "home", context)).toThrow(/not allowed/);
    expect(() =>
      cartPageDefinition.validate({ ...section(), variant: "drawer" }, "cart", context),
    ).toThrow(/Unsupported/);
    expect(() =>
      cartPagePropsSchema.parse({ ...cartPageDefinition.defaultProps, demoOnly: false }),
    ).toThrow();
  });

  it("accepts known catalogue products and rejects missing or duplicate references", () => {
    expect(() => cartPageDefinition.validate(section(), "cart", context)).not.toThrow();

    const missing = section([{ productId: "product_missing", quantity: 1 }]);
    expect(() => cartPageDefinition.validate(missing, "cart", context)).toThrow(
      /Unknown product reference/,
    );

    const duplicate = section([
      { productId: "product_aurora_ring_585", quantity: 1 },
      { productId: "product_aurora_ring_585", quantity: 2 },
    ]);
    expect(() => cartPageDefinition.validate(duplicate, "cart", context)).toThrow(/unique/);
  });

  it("allows an empty presentation but bounds dummy quantities", () => {
    const empty = section([]);
    expect(() => cartPageDefinition.validate(empty, "cart", context)).not.toThrow();

    for (const quantity of [0, 11, 1.5]) {
      const invalid = section([{ productId: "product_aurora_ring_585", quantity }]);
      expect(() => cartPageDefinition.validate(invalid, "cart", context)).toThrow();
    }
  });

  it("protects line items and canonical commerce values from design editing", () => {
    expect(cartPageDefinition.protectedFields.readOnlyPaths).toEqual(
      expect.arrayContaining([
        "lineItems",
        "demoOnly",
        "catalogue.products.*.price",
        "catalogue.products.*.stockStatus",
      ]),
    );
    expect(cartPageDefinition.editorFields).toEqual({
      heading: { source: "content", control: "text", label: "Heading", localized: true },
    });
  });
});
