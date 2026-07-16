import { describe, expect, it } from "vitest";
import { validateRegisteredSnapshot } from "@/components/registry";
import { catalogueDisplayModelSchema, protectedProductPaths } from "@/domain/catalogue";
import { projectSchema } from "@/domain/project";
import { storefrontSnapshotSchema } from "@/domain/storefront";
import { aurumNordicSeed } from "@/data/seed";

describe("Aurum Nordic jewellery seed", () => {
  it("validates the project, catalogue and separate snapshots", () => {
    expect(projectSchema.parse(aurumNordicSeed.project).id).toBe("project_aurum_nordic");
    expect(catalogueDisplayModelSchema.parse(aurumNordicSeed.catalogue).products).toHaveLength(6);
    expect(storefrontSnapshotSchema.parse(aurumNordicSeed.publishedSnapshot).id).toBe(
      aurumNordicSeed.project.publishedSnapshotId,
    );
    expect(storefrontSnapshotSchema.parse(aurumNordicSeed.draftSnapshot).id).toBe(
      aurumNordicSeed.project.draftSnapshotId,
    );
    expect(aurumNordicSeed.project.publishedSnapshotId).not.toBe(
      aurumNordicSeed.project.draftSnapshotId,
    );
  });

  it("contains the six Appendix B products with their canonical SKUs", () => {
    expect(
      aurumNordicSeed.catalogue.products.map((product) => [product.title.en, product.sku]),
    ).toEqual([
      ["Aurora Ring 585", "RING-AUR-585"],
      ["Lumi Halo Ring", "RING-LUM-HALO"],
      ["Aava Silver Necklace", "NECK-AAVA-925"],
      ["Sisu Automatic Watch", "WATCH-SISU-AUTO"],
      ["Kajo Rose Earrings", "EAR-KAJO-585"],
      ["Meri Bracelet", "BRAC-MERI-925"],
    ]);
  });

  it("uses unique aggregate IDs and local placeholder assets", () => {
    const productIds = aurumNordicSeed.catalogue.products.map((product) => product.id);
    const collectionIds = aurumNordicSeed.catalogue.collections.map((collection) => collection.id);
    const assetIds = aurumNordicSeed.catalogue.products.flatMap((product) =>
      product.images.map((image) => image.id),
    );

    expect(new Set(productIds).size).toBe(productIds.length);
    expect(new Set(collectionIds).size).toBe(collectionIds.length);
    expect(new Set(assetIds).size).toBe(assetIds.length);
    expect(
      aurumNordicSeed.catalogue.products.every((product) =>
        product.images.every((image) => image.url.startsWith("/seed-assets/")),
      ),
    ).toBe(true);
  });

  it("provides English and Finnish storefront and catalogue content", () => {
    for (const product of aurumNordicSeed.catalogue.products) {
      expect(product.title.en).toBeTruthy();
      expect(product.title.fi).toBeTruthy();
      expect(product.description?.en).toBeTruthy();
      expect(product.description?.fi).toBeTruthy();
      expect(product.seo?.title.en).toBeTruthy();
      expect(product.seo?.title.fi).toBeTruthy();
    }
    for (const collection of aurumNordicSeed.catalogue.collections) {
      expect(collection.title.en).toBeTruthy();
      expect(collection.title.fi).toBeTruthy();
    }
    for (const page of aurumNordicSeed.draftSnapshot.pages) {
      expect(page.title.en).toBeTruthy();
      expect(page.title.fi).toBeTruthy();
    }
  });

  it("freezes dummy price and stock display data and records their protected paths", () => {
    expect(aurumNordicSeed.protectedProductPaths).toEqual(protectedProductPaths);
    for (const product of aurumNordicSeed.catalogue.products) {
      expect(Object.isFrozen(product)).toBe(true);
      expect(Object.isFrozen(product.price)).toBe(true);
      expect(product.price.currency).toBe("EUR");
      expect(product.price.amount).toBeGreaterThan(0);
      expect(["inStock", "lowStock", "outOfStock"]).toContain(product.stockStatus);
      expect(() => Object.assign(product.price, { amount: 1 })).toThrow();
    }
  });

  it("contains realistic ring, engraving and watch attributes", () => {
    const aurora = aurumNordicSeed.catalogue.products.find(
      (product) => product.sku === "RING-AUR-585",
    );
    const lumi = aurumNordicSeed.catalogue.products.find(
      (product) => product.sku === "RING-LUM-HALO",
    );
    const watch = aurumNordicSeed.catalogue.products.find(
      (product) => product.sku === "WATCH-SISU-AUTO",
    );

    expect(aurora?.attributes).toMatchObject({
      material: "gold",
      fineness: "585",
      karat: "14K",
      metalColour: "yellow",
      stoneType: "diamond",
      engraving: "available",
    });
    expect(aurora?.attributes.ringSizes).toEqual(["15", "16", "17", "18", "19", "20", "21"]);
    expect(aurora?.orderOptions?.some((option) => option.type === "text")).toBe(true);
    expect(lumi?.attributes).toMatchObject({ stoneShape: "round", stoneSetting: "halo" });
    expect(watch?.attributes).toMatchObject({
      material: "steel",
      caseSizeMm: 40,
      movement: "automatic",
      waterResistance: "10 ATM",
    });
  });

  it("provides the complete registered Appendix C homepage and keeps later page UI deferred", () => {
    const validated = validateRegisteredSnapshot(
      aurumNordicSeed.draftSnapshot,
      aurumNordicSeed.catalogue,
    );
    expect(validated.pages.map((page) => page.type)).toEqual(["home", "collection", "product"]);
    expect(validated.pages[0]?.sections.map((section) => section.component)).toEqual([
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
    ]);
    expect(validated.pages[1]?.sections).toEqual([]);
    expect(validated.pages[2]?.sections.map((section) => section.component)).toEqual([
      "header",
      "productGallery",
      "productInfo",
      "productOptions",
      "benefitIcons",
      "imageText",
      "relatedProducts",
      "footer",
    ]);
  });
});
