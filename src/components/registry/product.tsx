import { z } from "zod";
import { assetRefSchema, localizedTextSchema } from "@/domain/shared";
import {
  ImageText,
  ProductGallery,
  ProductInfo,
  ProductOptions,
  RelatedProducts,
} from "@/components/storefront/product-sections";
import { defineComponent } from "./contract";

const productReferenceSchema = z.object({ productId: z.string().min(3) }).strict();
const emptyPropsSchema = z.object({}).strict();
const localAssetSchema = assetRefSchema.refine((asset) => asset.url.startsWith("/seed-assets/"), {
  message: "Storefront media must use a controlled local seed asset.",
});
const productProtectedPaths = [
  "productId",
  "catalogue.products.*.price",
  "catalogue.products.*.stockStatus",
  "catalogue.products.*.variants",
  "catalogue.products.*.orderOptions",
] as const;

function requireProduct(productId: string, catalogue: { products: Array<{ id: string }> }) {
  if (!catalogue.products.some((product) => product.id === productId)) {
    throw new Error(`Unknown product reference: ${productId}.`);
  }
}

export const productGalleryContentSchema = productReferenceSchema;
export const productGalleryPropsSchema = z
  .object({ thumbnailPosition: z.literal("bottom") })
  .strict();
export const productGalleryDefinition = defineComponent({
  type: "productGallery",
  label: "Product gallery",
  allowedPageTypes: ["product"],
  variants: ["thumbnails"] as const,
  defaultVariant: "thumbnails",
  contentSchema: productGalleryContentSchema,
  propsSchema: productGalleryPropsSchema,
  defaultContent: { productId: "product_aurora_ring_585" },
  defaultProps: { thumbnailPosition: "bottom" },
  editorFields: {},
  protectedFields: { readOnlyPaths: [...productProtectedPaths, "catalogue.products.*.images"] },
  validateContext: ({ content, context }) => requireProduct(content.productId, context.catalogue),
  renderer: ({ content, context }) => <ProductGallery {...content} context={context} />,
});

export const productInfoContentSchema = productReferenceSchema;
export const productInfoPropsSchema = z.object({ showRating: z.boolean() }).strict();
export const productInfoDefinition = defineComponent({
  type: "productInfo",
  label: "Product information",
  allowedPageTypes: ["product"],
  variants: ["premium"] as const,
  defaultVariant: "premium",
  contentSchema: productInfoContentSchema,
  propsSchema: productInfoPropsSchema,
  defaultContent: { productId: "product_aurora_ring_585" },
  defaultProps: { showRating: true },
  editorFields: {
    showRating: {
      source: "props",
      control: "select",
      label: "Show visual rating",
      valueType: "boolean",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
  },
  protectedFields: { readOnlyPaths: productProtectedPaths },
  validateContext: ({ content, context }) => requireProduct(content.productId, context.catalogue),
  renderer: ({ content, props, context }) => (
    <ProductInfo {...content} {...props} context={context} />
  ),
});

export const productOptionsContentSchema = productReferenceSchema;
export const productOptionsPropsSchema = z.object({ demoOnly: z.literal(true) }).strict();
export const productOptionsDefinition = defineComponent({
  type: "productOptions",
  label: "Product options",
  allowedPageTypes: ["product"],
  variants: ["buttons"] as const,
  defaultVariant: "buttons",
  contentSchema: productOptionsContentSchema,
  propsSchema: productOptionsPropsSchema,
  defaultContent: { productId: "product_aurora_ring_585" },
  defaultProps: { demoOnly: true },
  editorFields: {},
  protectedFields: { readOnlyPaths: productProtectedPaths },
  validateContext: ({ content, context }) => requireProduct(content.productId, context.catalogue),
  renderer: ({ content, context }) => <ProductOptions {...content} context={context} />,
});

export const imageTextContentSchema = z
  .object({ heading: localizedTextSchema, body: localizedTextSchema, media: localAssetSchema })
  .strict();
export const imageTextPropsSchema = z.object({ demoPlaceholder: z.literal(true) }).strict();
export const imageTextDefinition = defineComponent({
  type: "imageText",
  label: "Image and text",
  allowedPageTypes: ["product", "content"],
  variants: ["imageRight"] as const,
  defaultVariant: "imageRight",
  contentSchema: imageTextContentSchema,
  propsSchema: imageTextPropsSchema,
  defaultContent: {
    heading: { en: "Material, care and delivery", fi: "Materiaali, hoito ja toimitus" },
    body: {
      en: "Product material and care information. Delivery and returns are demo placeholders only. Draft placeholder — review before publishing.",
      fi: "Tuotteen materiaali- ja hoitotiedot. Toimitus ja palautukset ovat vain demosisältöä. Luonnospaikkamerkki — tarkista ennen julkaisua.",
    },
    media: {
      id: "asset_product_details_default",
      url: "/seed-assets/aurora-ring.svg",
      alt: { en: "Aurora ring detail", fi: "Aurora-sormuksen yksityiskohta" },
      decorative: false,
    },
  },
  defaultProps: { demoPlaceholder: true },
  editorFields: {
    heading: { source: "content", control: "text", label: "Heading", localized: true },
    body: { source: "content", control: "textarea", label: "Body", localized: true },
  },
  protectedFields: { readOnlyPaths: ["media.url", "demoPlaceholder"] },
  renderer: ({ content, context }) => <ImageText {...content} context={context} />,
});

export const relatedProductsContentSchema = z
  .object({
    heading: localizedTextSchema,
    productIds: z.array(z.string().min(3)).superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: "custom", message: "Related product references must be unique." });
      }
    }),
  })
  .strict();
export const relatedProductsPropsSchema = emptyPropsSchema;
export const relatedProductsDefinition = defineComponent({
  type: "relatedProducts",
  label: "Related products",
  allowedPageTypes: ["product"],
  variants: ["grid"] as const,
  defaultVariant: "grid",
  contentSchema: relatedProductsContentSchema,
  propsSchema: relatedProductsPropsSchema,
  defaultContent: { heading: { en: "You may also like", fi: "Saatat myös pitää" }, productIds: [] },
  defaultProps: {},
  editorFields: {
    heading: { source: "content", control: "text", label: "Heading", localized: true },
  },
  protectedFields: { readOnlyPaths: [...productProtectedPaths, "productIds"] },
  validateContext: ({ content, context }) =>
    content.productIds.forEach((productId) => requireProduct(productId, context.catalogue)),
  renderer: ({ content, context }) => <RelatedProducts {...content} context={context} />,
});

export const productDefinitions = {
  productGallery: productGalleryDefinition,
  productInfo: productInfoDefinition,
  productOptions: productOptionsDefinition,
  imageText: imageTextDefinition,
  relatedProducts: relatedProductsDefinition,
} as const;
