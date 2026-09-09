import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import * as collection from "@/components/registry/collection";
import * as collectionMetadata from "@/components/registry/collection-metadata";
import * as product from "@/components/registry/product";
import * as productMetadata from "@/components/registry/product-metadata";
import { createStorefrontRenderContext } from "@/components/registry/registry";
import { adaptV1ComponentDefinitionToV2 } from "@/components/registry/v2-compatibility";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";
import {
  observeLegacyMetadata,
  type ObservedLegacyDefinition,
} from "../helpers/ar-02-legacy-metadata-observation";

const context = (activeLocale: "en" | "fi") =>
  createStorefrontRenderContext({
    activeLocale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });
const hash = (value: unknown) =>
  createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex");
// Projected from AR-02E pre-edit baseline at HEAD 020692efb9705ee5619efe8ba88020c7ab3ad034,
// /Users/leo/veskify-batch-runs/BATCH-03/AR-02E/observation/baseline-observation.json,
// SHA-256 bdb66afbe2298494c3bbddaa6ac963e17e3c1053adedef3a08fbd15d862ea873.
const definitions = (
  [
    ["collection", "collectionHeaderDefinition", collection.collectionHeaderDefinition],
    ["collection", "filterBarDefinition", collection.filterBarDefinition],
    ["product", "productGalleryDefinition", product.productGalleryDefinition],
    ["product", "productInfoDefinition", product.productInfoDefinition],
    ["product", "productOptionsDefinition", product.productOptionsDefinition],
    ["product", "imageTextDefinition", product.imageTextDefinition],
    ["product", "relatedProductsDefinition", product.relatedProductsDefinition],
  ] as const
).map(([group, exportName, definition]) => ({
  group,
  exportName,
  definition,
  publicSchemaExportMapping: {
    content: `${definition.type}ContentSchema`,
    props: `${definition.type}PropsSchema`,
  },
})) satisfies readonly ObservedLegacyDefinition[];
const schemas = {
  collectionHeader: [
    collectionMetadata.collectionHeaderContentSchema,
    collectionMetadata.collectionHeaderPropsSchema,
  ],
  filterBar: [collectionMetadata.filterBarContentSchema, collectionMetadata.filterBarPropsSchema],
  productGallery: [
    productMetadata.productGalleryContentSchema,
    productMetadata.productGalleryPropsSchema,
  ],
  productInfo: [productMetadata.productInfoContentSchema, productMetadata.productInfoPropsSchema],
  productOptions: [
    productMetadata.productOptionsContentSchema,
    productMetadata.productOptionsPropsSchema,
  ],
  imageText: [productMetadata.imageTextContentSchema, productMetadata.imageTextPropsSchema],
  relatedProducts: [
    productMetadata.relatedProductsContentSchema,
    productMetadata.relatedProductsPropsSchema,
  ],
} as const;

describe("AR-02E commerce metadata", () => {
  it("preserves schema identities, parsed defaults, ordered groups, and adaptation", () => {
    const pairs = [
      [
        collection.collectionHeaderDefinition,
        collectionMetadata.collectionHeaderMetadata,
        collection.collectionHeaderContentSchema,
        collectionMetadata.collectionHeaderContentSchema,
        collection.collectionHeaderPropsSchema,
        collectionMetadata.collectionHeaderPropsSchema,
      ],
      [
        collection.filterBarDefinition,
        collectionMetadata.filterBarMetadata,
        collection.filterBarContentSchema,
        collectionMetadata.filterBarContentSchema,
        collection.filterBarPropsSchema,
        collectionMetadata.filterBarPropsSchema,
      ],
      [
        product.productGalleryDefinition,
        productMetadata.productGalleryMetadata,
        product.productGalleryContentSchema,
        productMetadata.productGalleryContentSchema,
        product.productGalleryPropsSchema,
        productMetadata.productGalleryPropsSchema,
      ],
      [
        product.productInfoDefinition,
        productMetadata.productInfoMetadata,
        product.productInfoContentSchema,
        productMetadata.productInfoContentSchema,
        product.productInfoPropsSchema,
        productMetadata.productInfoPropsSchema,
      ],
      [
        product.productOptionsDefinition,
        productMetadata.productOptionsMetadata,
        product.productOptionsContentSchema,
        productMetadata.productOptionsContentSchema,
        product.productOptionsPropsSchema,
        productMetadata.productOptionsPropsSchema,
      ],
      [
        product.imageTextDefinition,
        productMetadata.imageTextMetadata,
        product.imageTextContentSchema,
        productMetadata.imageTextContentSchema,
        product.imageTextPropsSchema,
        productMetadata.imageTextPropsSchema,
      ],
      [
        product.relatedProductsDefinition,
        productMetadata.relatedProductsMetadata,
        product.relatedProductsContentSchema,
        productMetadata.relatedProductsContentSchema,
        product.relatedProductsPropsSchema,
        productMetadata.relatedProductsPropsSchema,
      ],
    ] as const;
    for (const [
      definition,
      metadata,
      runtimeContent,
      metadataContent,
      runtimeProps,
      metadataProps,
    ] of pairs) {
      expect(runtimeContent).toBe(metadataContent);
      expect(runtimeProps).toBe(metadataProps);
      expect(definition.contentSchema).toBe(metadataContent);
      expect(definition.propsSchema).toBe(metadataProps);
      expect(definition.defaultContent).toEqual(metadataContent.parse(metadata.defaultContent));
      expect(definition.defaultProps).toEqual(metadataProps.parse(metadata.defaultProps));
    }
    expect(collection.jewelleryFilterTokenSchema).toBe(
      collectionMetadata.jewelleryFilterTokenSchema,
    );
    expect(product.productGalleryContentSchema).toBe(product.productInfoContentSchema);
    expect(product.productInfoContentSchema).toBe(product.productOptionsContentSchema);
    expect(Object.values(collectionMetadata.collectionMetadataDefinitions)).toEqual([
      collectionMetadata.collectionHeaderMetadata,
      collectionMetadata.filterBarMetadata,
    ]);
    expect(Object.values(productMetadata.productMetadataDefinitions)).toEqual([
      productMetadata.productGalleryMetadata,
      productMetadata.productInfoMetadata,
      productMetadata.productOptionsMetadata,
      productMetadata.imageTextMetadata,
      productMetadata.relatedProductsMetadata,
    ]);
    const observed = observeLegacyMetadata({ definitions, schemas, context });
    expect(observed.renderings).toHaveLength(18);
    expect(
      hash(definitions.map(({ definition }) => adaptV1ComponentDefinitionToV2(definition))),
    ).toBe("b448189f7336f369299232ffca9a9e1f14ad08921ee8532231e07060e35f76d2");
    expect(hash(observed.definitions)).toBe(
      "b5a020286ab660dfd9c4ca1c261a1ad50202551338bd062a806573e60b4cdb30",
    );
    expect(hash(observed.renderings)).toBe(
      "a8efe50ca1377f98c5e7abdb06968929beffdfcf01f05330ad753a0cd1777b80",
    );
  });

  it("retains strict commerce, asset, variant, page, and default behavior", () => {
    expect(() =>
      product.relatedProductsContentSchema.parse({
        ...product.relatedProductsDefinition.defaultContent,
        productIds: ["product_aurora_ring_585", "product_aurora_ring_585"],
      }),
    ).toThrow(/unique/);
    expect(() => collection.filterBarContentSchema.parse({ filters: [] })).toThrow();
    expect(() =>
      product.imageTextContentSchema.parse({
        ...product.imageTextDefinition.defaultContent,
        media: {
          id: "asset_unsafe",
          url: "https://unsafe.example/image.jpg",
          alt: { en: "Unsafe", fi: "Turvaton" },
          decorative: false,
        },
      }),
    ).toThrow(/controlled local/);
    expect(() =>
      product.productGalleryDefinition.render(
        {
          id: "bad",
          component: "productGallery",
          variant: "unknown",
          visible: true,
          content: product.productGalleryDefinition.defaultContent,
          props: product.productGalleryDefinition.defaultProps,
        },
        context("en"),
        "product",
      ),
    ).toThrow(/Unsupported productGallery variant/);
    expect(() =>
      collection.collectionHeaderDefinition.render(
        {
          id: "bad",
          component: "collectionHeader",
          variant: "editorial",
          visible: true,
          content: collection.collectionHeaderDefinition.defaultContent,
          props: collection.collectionHeaderDefinition.defaultProps,
        },
        context("en"),
        "product",
      ),
    ).toThrow(/not allowed/);
    expect(() =>
      collection.collectionHeaderDefinition.render(
        {
          id: "bad",
          component: "collectionHeader",
          variant: "editorial",
          visible: true,
          content: { collectionId: "collection_missing" },
          props: collection.collectionHeaderDefinition.defaultProps,
        },
        context("en"),
        "collection",
      ),
    ).toThrow(/Unknown collection reference/);
    expect(() =>
      product.productGalleryDefinition.render(
        {
          id: "bad",
          component: "productGallery",
          variant: "thumbnails",
          visible: true,
          content: { productId: "product_missing" },
          props: product.productGalleryDefinition.defaultProps,
        },
        context("en"),
        "product",
      ),
    ).toThrow(/Unknown product reference/);
    expect(
      product.imageTextPropsSchema.parse(product.imageTextDefinition.defaultProps),
    ).toMatchObject({ alignment: "left" });
  });

  it.each([
    "src/components/registry/collection-metadata.ts",
    "src/components/registry/product-metadata.ts",
  ])("has a renderer-free runtime closure for %s", (entry) => {
    const closure = resolveRuntimeImportClosure(entry);
    const forbidden =
      /(?:^src\/components\/(?:storefront\/|registry\/.*\.tsx$)|^src\/components\/registry\/(?:index|registry|legacy-registry|v2-registry|contract|collection|product)\.(?:ts|tsx)$|^src\/integrations\/puck\/|^src\/(?:app|features)\/|(?:^|\/)(?:react|react-dom)(?:\/|$)|acceptance|\.css$)/iu;
    expect(closure.runtimePaths).not.toEqual([]);
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
  });
});
