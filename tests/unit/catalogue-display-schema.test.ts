import { describe, expect, it } from "vitest";

import { aurumNordicSeed } from "@/data/seed/aurum-nordic";
import {
  catalogueDisplayModelSchema,
  productDisplayModelSchema,
} from "@/domain/catalogue/catalogue";

describe("catalogue display schema", () => {
  it("keeps the existing Aurum Nordic catalogue compatible", () => {
    const parsed = catalogueDisplayModelSchema.parse(aurumNordicSeed.catalogue);

    expect(parsed.products).toHaveLength(6);
    expect(parsed.products[0]?.price).toEqual({ amount: 1290, currency: "EUR" });
  });

  it("supports merchant metadata and variant-level display prices", () => {
    const source = structuredClone(aurumNordicSeed.catalogue.products[2]);
    const parsed = productDisplayModelSchema.parse({
      ...source,
      brand: "Aurum Nordic",
      category: "Rings",
      compareAtPrice: { amount: 299, currency: "EUR" },
      availabilityLabel: { en: "Available to order", fi: "Saatavilla tilattavaksi" },
      variants: [
        {
          ...source.variants[0],
          price: { amount: 249, currency: "EUR" },
        },
      ],
    });

    expect(parsed.brand).toBe("Aurum Nordic");
    expect(parsed.category).toBe("Rings");
    expect(parsed.variants[0]?.price).toEqual({ amount: 249, currency: "EUR" });
    expect(parsed.attributes).toEqual(source.attributes);
    expect("collections" in parsed).toBe(false);
  });

  it("requires exactly one current price or unavailable-price reason", () => {
    const source = structuredClone(aurumNordicSeed.catalogue.products[0]);
    const unavailable = { ...source } as Record<string, unknown>;
    delete unavailable.price;
    unavailable.priceUnavailableReason = {
      en: "Price available on request",
      fi: "Hinta saatavilla pyynnöstä",
    };

    expect(productDisplayModelSchema.parse(unavailable).price).toBeUndefined();
    expect(() =>
      productDisplayModelSchema.parse({
        ...source,
        priceUnavailableReason: {
          en: "Price available on request",
          fi: "Hinta saatavilla pyynnöstä",
        },
      }),
    ).toThrow("cannot define both");
    expect(() => {
      const missing = { ...source } as Record<string, unknown>;
      delete missing.price;
      productDisplayModelSchema.parse(missing);
    }).toThrow("require either");
  });

  it("keeps material, colour, and stone data in attributes", () => {
    const source = structuredClone(aurumNordicSeed.catalogue.products[0]);
    const parsed = productDisplayModelSchema.parse(source);

    expect(typeof parsed.attributes.material).toBe("string");
    expect(typeof parsed.attributes.metalColour).toBe("string");
    expect(parsed.attributes).toHaveProperty("stoneType");
  });
});
