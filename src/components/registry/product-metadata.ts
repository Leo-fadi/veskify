import { z } from "zod";
import { assetRefSchema, localizedTextSchema } from "@/domain/shared/schemas";
import type { defineComponent } from "./contract";
import {
  designVocabularyDefaults,
  designVocabularyVariants,
  sectionAlignmentEditorField,
  sectionAlignmentSchema,
  sectionStyleEditorFields,
  sectionStyleSchema,
} from "./design-vocabulary";

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
export const productGalleryContentSchema = productReferenceSchema;
export const productGalleryPropsSchema = z
  .object({ thumbnailPosition: z.literal("bottom") })
  .strict();
export const productInfoContentSchema = productReferenceSchema;
export const productInfoPropsSchema = z.object({ showRating: z.boolean() }).strict();
export const productOptionsContentSchema = productReferenceSchema;
export const productOptionsPropsSchema = z.object({ demoOnly: z.literal(true) }).strict();
export const imageTextContentSchema = z
  .object({ heading: localizedTextSchema, body: localizedTextSchema, media: localAssetSchema })
  .strict();
export const imageTextPropsSchema = z
  .object({
    demoPlaceholder: z.literal(true),
    mediaPosition: z.enum(["left", "right"]).optional(),
    alignment: sectionAlignmentSchema.default("left"),
    ...sectionStyleSchema,
  })
  .strict();
export const relatedProductsContentSchema = z
  .object({
    heading: localizedTextSchema,
    productIds: z.array(z.string().min(3)).superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length)
        context.addIssue({ code: "custom", message: "Related product references must be unique." });
    }),
  })
  .strict();
export const relatedProductsPropsSchema = emptyPropsSchema;
type MetadataInput<
  TContent extends z.ZodType,
  TProps extends z.ZodType,
  TVariants extends readonly [string, ...string[]],
> = Omit<
  Parameters<typeof defineComponent<TContent, TProps, TVariants>>[0],
  "renderer" | "validateContext"
>;
export const productGalleryMetadata = {
  type: "productGallery",
  label: "Product gallery",
  allowedPageTypes: ["product"],
  variants: ["thumbnails"],
  defaultVariant: "thumbnails",
  contentSchema: productGalleryContentSchema,
  propsSchema: productGalleryPropsSchema,
  defaultContent: { productId: "product_aurora_ring_585" },
  defaultProps: { thumbnailPosition: "bottom" },
  editorFields: {},
  protectedFields: { readOnlyPaths: [...productProtectedPaths, "catalogue.products.*.images"] },
} as const satisfies MetadataInput<
  typeof productGalleryContentSchema,
  typeof productGalleryPropsSchema,
  readonly ["thumbnails"]
>;
export const productInfoMetadata = {
  type: "productInfo",
  label: "Product information",
  allowedPageTypes: ["product"],
  variants: ["premium"],
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
} as const satisfies MetadataInput<
  typeof productInfoContentSchema,
  typeof productInfoPropsSchema,
  readonly ["premium"]
>;
export const productOptionsMetadata = {
  type: "productOptions",
  label: "Product options",
  allowedPageTypes: ["product"],
  variants: ["buttons"],
  defaultVariant: "buttons",
  contentSchema: productOptionsContentSchema,
  propsSchema: productOptionsPropsSchema,
  defaultContent: { productId: "product_aurora_ring_585" },
  defaultProps: { demoOnly: true },
  editorFields: {},
  protectedFields: { readOnlyPaths: productProtectedPaths },
} as const satisfies MetadataInput<
  typeof productOptionsContentSchema,
  typeof productOptionsPropsSchema,
  readonly ["buttons"]
>;
export const imageTextMetadata = {
  type: "imageText",
  label: "Image and text",
  allowedPageTypes: ["product", "content"],
  variants: designVocabularyVariants.imageText,
  defaultVariant: designVocabularyDefaults.imageText,
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
    alignment: sectionAlignmentEditorField,
    ...sectionStyleEditorFields,
  },
  protectedFields: { readOnlyPaths: ["media.url", "demoPlaceholder"] },
} as const satisfies MetadataInput<
  typeof imageTextContentSchema,
  typeof imageTextPropsSchema,
  typeof designVocabularyVariants.imageText
>;
export const relatedProductsMetadata = {
  type: "relatedProducts",
  label: "Related products",
  allowedPageTypes: ["product"],
  variants: ["grid"],
  defaultVariant: "grid",
  contentSchema: relatedProductsContentSchema,
  propsSchema: relatedProductsPropsSchema,
  defaultContent: { heading: { en: "You may also like", fi: "Saatat myös pitää" }, productIds: [] },
  defaultProps: {},
  editorFields: {
    heading: { source: "content", control: "text", label: "Heading", localized: true },
  },
  protectedFields: { readOnlyPaths: [...productProtectedPaths, "productIds"] },
} as const satisfies MetadataInput<
  typeof relatedProductsContentSchema,
  typeof relatedProductsPropsSchema,
  readonly ["grid"]
>;
/** Ordered metadata group for the later V2 adapter consumer. */
export const productMetadataDefinitions = {
  productGallery: productGalleryMetadata,
  productInfo: productInfoMetadata,
  productOptions: productOptionsMetadata,
  imageText: imageTextMetadata,
  relatedProducts: relatedProductsMetadata,
} as const;
