import { describe, expect, it } from "vitest";

import { aurumNordicSeed, karvonenSeed } from "@/data/seed";

describe("Karvonen canonical demo seed", () => {
  it("contains ten products in deterministic source order", () => {
    expect(karvonenSeed.project.id).toBe("project_karvonen");
    expect(karvonenSeed.catalogue.products).toHaveLength(10);
    expect(karvonenSeed.catalogue.products.map(({ id }) => id)).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `product_karvonen_${String(index + 1).padStart(2, "0")}`,
      ),
    );
  });

  it("preserves supplied prices, SKUs, and product 7 unavailable-price handling", () => {
    const products = karvonenSeed.catalogue.products;

    expect(products[0]).toMatchObject({ sku: "BV012s", price: { amount: 129, currency: "EUR" } });
    expect(products[1]).toMatchObject({
      sku: "L64248510000",
      price: { amount: 329, currency: "EUR" },
    });
    expect(products[3]).toMatchObject({
      price: { amount: 199.2, currency: "EUR" },
      compareAtPrice: { amount: 249, currency: "EUR" },
    });
    expect(products[5]?.price).toEqual({ amount: 2680, currency: "EUR" });
    expect(products[6]?.priceUnavailableReason?.fi).toContain("ei ole saatavilla");
    expect(products[6]?.price).toBeUndefined();
    expect(products[7]).toMatchObject({ sku: "701-008", price: { amount: 2290, currency: "EUR" } });
    expect(products[8]).toMatchObject({ sku: "700-005", price: { amount: 1690, currency: "EUR" } });
    expect(products[9]).toMatchObject({
      sku: "724400000",
      price: { amount: 2024, currency: "EUR" },
    });
  });

  it("maps supplied variant prices and keeps collection membership canonical", () => {
    const first = karvonenSeed.catalogue.products[0];

    expect(first.variants.map(({ id, price: currentPrice }) => ({ id, currentPrice }))).toEqual([
      { id: "variant_karvonen_01_01", currentPrice: { amount: 129, currency: "EUR" } },
      { id: "variant_karvonen_01_02", currentPrice: { amount: 129, currency: "EUR" } },
      { id: "variant_karvonen_01_03", currentPrice: { amount: 129, currency: "EUR" } },
    ]);
    expect(
      karvonenSeed.catalogue.collections.find((collection) => collection.slug === "pihka"),
    )?.toMatchObject({
      productIds: ["product_karvonen_08", "product_karvonen_09"],
    });
    expect(first).not.toHaveProperty("collection");
  });

  it("uses only local Karvonen image paths", () => {
    const urls = karvonenSeed.catalogue.products.flatMap((product) =>
      product.images.map(({ url }) => url),
    );

    expect(urls).toHaveLength(18);
    expect(urls.every((url) => url.startsWith("/seed-assets/karvonen/"))).toBe(true);
    expect(urls.some((url) => /^https?:\/\//.test(url))).toBe(false);
  });

  it("owns an independent Karvonen storefront tree, BrandSystem, navigation and assets", () => {
    const karvonenSnapshot = karvonenSeed.draftSnapshot;
    const aurumSnapshot = aurumNordicSeed.draftSnapshot;
    const serialized = JSON.stringify(karvonenSnapshot);

    expect(karvonenSnapshot.brandSystem).not.toBe(aurumSnapshot.brandSystem);
    expect(karvonenSnapshot.navigation).not.toBe(aurumSnapshot.navigation);
    expect(karvonenSnapshot.pages).not.toBe(aurumSnapshot.pages);
    expect(serialized).not.toContain("Aurum Nordic");
    expect(serialized).not.toContain("Aurora");
    expect(serialized).not.toContain("/seed-assets/aurora-ring.svg");
    expect(karvonenSnapshot.brandSystem).not.toEqual(aurumSnapshot.brandSystem);
    expect(
      karvonenSnapshot.navigation.primary.map((item) => {
        expect(item.target.type).toBe("page");
        if (item.target.type !== "page") {
          throw new Error("The legacy Karvonen fixture must retain page navigation targets.");
        }
        return item.target.pageId;
      }),
    ).toEqual(["page_karvonen_home", "page_karvonen_collection_myrskyluodon_maija"]);
  });

  it("keeps cloned draft mutations isolated from the other merchant seed", () => {
    const karvonenDraft = structuredClone(karvonenSeed.draftSnapshot);
    const aurumDraft = structuredClone(aurumNordicSeed.draftSnapshot);
    const aurumBefore = structuredClone(aurumDraft);

    karvonenDraft.brandSystem.colors.primary = "#000000";
    karvonenDraft.pages[0].title.fi = "Muokattu Karvonen";
    karvonenDraft.navigation.primary[0].label.fi = "Muokattu etusivu";

    expect(aurumDraft).toEqual(aurumBefore);
  });

  it("binds Karvonen product and collection pages only to canonical Karvonen references", () => {
    const collection = karvonenSeed.draftSnapshot.pages.find((page) => page.type === "collection")!;
    const product = karvonenSeed.draftSnapshot.pages.find((page) => page.type === "product")!;

    expect(collection.slug).toBe("/collections/myrskyluodon-maija");
    expect(
      collection.sections.find((section) => section.component === "collectionHeader")?.content,
    ).toEqual({ collectionId: "collection_karvonen_myrskyluodon-maija" });
    expect(
      collection.sections.find((section) => section.component === "productGrid")?.content,
    ).toEqual({
      heading: { en: "Myrskyluodon Maija", fi: "Myrskyluodon Maija" },
      productIds: ["product_karvonen_01"],
    });
    expect(product.slug).toBe("/products/guldviva-myrskyluodon-maija-sormus");
    expect(
      product.sections
        .filter((section) =>
          ["productGallery", "productInfo", "productOptions"].includes(section.component),
        )
        .map((section) => section.content),
    ).toEqual([
      { productId: "product_karvonen_01" },
      { productId: "product_karvonen_01" },
      { productId: "product_karvonen_01" },
    ]);
  });

  it("does not invalidate the existing Aurum Nordic seed", () => {
    expect(aurumNordicSeed.catalogue.products).toHaveLength(6);
    expect(aurumNordicSeed.catalogue.products.every((product) => product.price)).toBe(true);
  });
});
