import { z } from "zod";
import {
  dynamicCollectionCommerceContentSchema,
  dynamicCollectionCommerceDefaultContent,
  dynamicCollectionCommerceDefaultProps,
  dynamicCollectionCommercePropsSchema,
} from "./dynamic-collection-commerce";
import {
  dynamicProductDetailContentSchema,
  dynamicProductDetailDefaultContent,
  dynamicProductDetailDefaultProps,
  dynamicProductDetailPropsSchema,
} from "./dynamic-product-detail";
import { collectionHeaderDefinition, filterBarDefinition } from "./collection";
import { productGridDefinition } from "./homepage";
import {
  productGalleryDefinition,
  productInfoDefinition,
  productOptionsDefinition,
  relatedProductsDefinition,
} from "./product";
import { defineComponent } from "./contract";
import { idSchema } from "@/domain/shared";

const canonicalRevisionSchema = z.string().trim().min(1).max(240);
const dynamicCollectionCommerceBridgeVariants = [
  "standard",
  "editorial",
  "compact",
  "gallery",
  "editorialDiscovery",
  "catalogueComparison",
  "campaignLedDiscovery",
  "denseSearch",
] as const;

/**
 * The legacy bridge composes the legacy product grid while canonical collection
 * rendering is handled by the v2 component. New canonical variants therefore
 * need a bounded visual compatibility projection here; passing their authority
 * identifiers through would make the old grid reject the otherwise valid page.
 */
const legacyProductGridVariantByCollectionVariant: Readonly<
  Record<
    (typeof dynamicCollectionCommerceBridgeVariants)[number],
    "standard" | "editorial" | "compact"
  >
> = {
  standard: "standard",
  editorial: "editorial",
  compact: "compact",
  gallery: "editorial",
  editorialDiscovery: "editorial",
  catalogueComparison: "compact",
  campaignLedDiscovery: "editorial",
  denseSearch: "compact",
};

export const dynamicCollectionCommerceBridgeContentSchema = dynamicCollectionCommerceContentSchema
  .extend({
    collectionId: idSchema,
    productIds: z.array(idSchema),
    canonicalRevision: canonicalRevisionSchema,
  })
  .strict();

export const dynamicCollectionCommerceBridgeDefinition = defineComponent({
  type: "dynamicCollectionCommerce",
  label: "Dynamic collection commerce",
  allowedPageTypes: ["collection"],
  variants: dynamicCollectionCommerceBridgeVariants,
  defaultVariant: "standard",
  contentSchema: dynamicCollectionCommerceBridgeContentSchema,
  propsSchema: dynamicCollectionCommercePropsSchema,
  defaultContent: {
    ...dynamicCollectionCommerceDefaultContent,
    collectionId: "collection_rings",
    productIds: ["product_aurora_ring_585"],
    canonicalRevision: "canonical-commerce-default",
  },
  defaultProps: dynamicCollectionCommerceDefaultProps,
  editorFields: {},
  protectedFields: {
    readOnlyPaths: [
      "collectionId",
      "productIds",
      "canonicalRevision",
      "catalogue.collections",
      "catalogue.products",
    ],
  },
  validateContext: ({ content, context }) => {
    if (!context.catalogue.collections.some((item) => item.id === content.collectionId)) {
      throw new Error(`Unknown collection reference: ${content.collectionId}.`);
    }
    const products = new Set(context.catalogue.products.map((item) => item.id));
    if (content.productIds.some((productId) => !products.has(productId))) {
      throw new Error("Dynamic collection references an unknown canonical product.");
    }
  },
  renderer: ({ sectionId, variant, content, props, context }) => (
    <>
      {collectionHeaderDefinition.render(
        {
          id: `${sectionId}_header`,
          component: "collectionHeader",
          variant: "editorial",
          visible: true,
          content: { collectionId: content.collectionId },
          props: { mediaPosition: "right" },
        },
        context,
        "collection",
      )}
      {filterBarDefinition.render(
        {
          id: `${sectionId}_filters`,
          component: "filterBar",
          variant: "horizontal",
          visible: true,
          content: filterBarDefinition.defaultContent,
          props: filterBarDefinition.defaultProps,
        },
        context,
        "collection",
      )}
      {productGridDefinition.render(
        {
          id: `${sectionId}_products`,
          component: "productGrid",
          variant: legacyProductGridVariantByCollectionVariant[variant],
          visible: true,
          content: { heading: content.productsHeading, productIds: content.productIds },
          props: {
            columns:
              props.gridDensity === "compact"
                ? "four"
                : props.gridDensity === "spacious"
                  ? "two"
                  : "three",
          },
        },
        context,
        "collection",
      )}
    </>
  ),
});

export const dynamicProductDetailBridgeContentSchema = dynamicProductDetailContentSchema
  .extend({
    productId: idSchema,
    relatedProductIds: z.array(idSchema),
    canonicalRevision: canonicalRevisionSchema,
  })
  .strict();

export const dynamicProductDetailBridgeDefinition = defineComponent({
  type: "dynamicProductDetail",
  label: "Dynamic product detail",
  allowedPageTypes: ["product"],
  variants: ["balanced", "editorial", "compact", "galleryDominant", "editorialSplit"] as const,
  defaultVariant: "balanced",
  contentSchema: dynamicProductDetailBridgeContentSchema,
  propsSchema: dynamicProductDetailPropsSchema,
  defaultContent: {
    ...dynamicProductDetailDefaultContent,
    productId: "product_aurora_ring_585",
    relatedProductIds: [],
    canonicalRevision: "canonical-commerce-default",
  },
  defaultProps: dynamicProductDetailDefaultProps,
  editorFields: {},
  protectedFields: {
    readOnlyPaths: ["productId", "relatedProductIds", "canonicalRevision", "catalogue.products"],
  },
  validateContext: ({ content, context }) => {
    const products = new Set(context.catalogue.products.map((item) => item.id));
    if (!products.has(content.productId)) {
      throw new Error(`Unknown product reference: ${content.productId}.`);
    }
    if (content.relatedProductIds.some((productId) => !products.has(productId))) {
      throw new Error("Dynamic product detail references an unknown related product.");
    }
  },
  renderer: ({ sectionId, content, context }) => (
    <>
      {productGalleryDefinition.render(
        {
          id: `${sectionId}_gallery`,
          component: "productGallery",
          variant: "thumbnails",
          visible: true,
          content: { productId: content.productId },
          props: { thumbnailPosition: "bottom" },
        },
        context,
        "product",
      )}
      {productInfoDefinition.render(
        {
          id: `${sectionId}_info`,
          component: "productInfo",
          variant: "premium",
          visible: true,
          content: { productId: content.productId },
          props: { showRating: true },
        },
        context,
        "product",
      )}
      {productOptionsDefinition.render(
        {
          id: `${sectionId}_options`,
          component: "productOptions",
          variant: "buttons",
          visible: true,
          content: { productId: content.productId },
          props: { demoOnly: true },
        },
        context,
        "product",
      )}
      {content.relatedProductIds.length > 0
        ? relatedProductsDefinition.render(
            {
              id: `${sectionId}_related`,
              component: "relatedProducts",
              variant: "grid",
              visible: true,
              content: {
                heading: content.relatedHeading,
                productIds: content.relatedProductIds,
              },
              props: {},
            },
            context,
            "product",
          )
        : null}
    </>
  ),
});

export const dynamicCommerceBridgeDefinitions = {
  dynamicCollectionCommerce: dynamicCollectionCommerceBridgeDefinition,
  dynamicProductDetail: dynamicProductDetailBridgeDefinition,
} as const;
