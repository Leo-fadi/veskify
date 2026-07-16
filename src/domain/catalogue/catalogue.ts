import { z } from "zod";
import { assetRefSchema, idSchema, localizedSeoSchema, localizedTextSchema } from "@/domain/shared";

const attributeValueSchema = z.union([
  z.string().trim().min(1),
  z.number(),
  z.array(z.string().trim().min(1)).min(1),
]);

export const productVariantDisplaySchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    attributes: z.record(z.string(), attributeValueSchema),
  })
  .strict();

export const productOrderOptionDisplaySchema = z
  .object({
    id: idSchema,
    type: z.enum(["selection", "text"]),
    label: localizedTextSchema,
    required: z.boolean(),
    values: z.array(localizedTextSchema).optional(),
    maxLength: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((option, context) => {
    if (option.type === "selection" && (option.values?.length ?? 0) === 0) {
      context.addIssue({
        code: "custom",
        message: "Selection options require at least one value.",
        path: ["values"],
      });
    }
    if (option.type === "selection" && option.maxLength !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Selection options cannot define a character limit.",
        path: ["maxLength"],
      });
    }
    if (option.type === "text" && option.maxLength === undefined) {
      context.addIssue({
        code: "custom",
        message: "Text options require a character limit.",
        path: ["maxLength"],
      });
    }
    if (option.type === "text" && option.values !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Text options cannot define selection values.",
        path: ["values"],
      });
    }
  });

export const productDisplayModelSchema = z
  .object({
    id: idSchema,
    sku: z.string().trim().min(1).max(80).optional(),
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),
    price: z.object({ amount: z.number().nonnegative(), currency: z.literal("EUR") }).strict(),
    stockStatus: z.enum(["inStock", "lowStock", "outOfStock"]).optional(),
    images: z.array(assetRefSchema).min(1),
    productType: z.string().trim().min(1).max(80),
    attributes: z.record(z.string(), attributeValueSchema),
    variants: z.array(productVariantDisplaySchema),
    orderOptions: z.array(productOrderOptionDisplaySchema).optional(),
    seo: localizedSeoSchema.optional(),
  })
  .strict()
  .superRefine((product, context) => {
    const variantIds = product.variants.map((variant) => variant.id);
    const optionIds = product.orderOptions?.map((option) => option.id) ?? [];
    if (new Set(variantIds).size !== variantIds.length) {
      context.addIssue({
        code: "custom",
        message: "Variant IDs must be unique.",
        path: ["variants"],
      });
    }
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Order option IDs must be unique.",
        path: ["orderOptions"],
      });
    }
  });

export const collectionDisplayModelSchema = z
  .object({
    id: idSchema,
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: localizedTextSchema,
    description: localizedTextSchema,
    productIds: z.array(idSchema).min(1),
  })
  .strict()
  .superRefine((collection, context) => {
    if (new Set(collection.productIds).size !== collection.productIds.length) {
      context.addIssue({
        code: "custom",
        message: "Collection product references must be unique.",
        path: ["productIds"],
      });
    }
  });

export const catalogueDisplayModelSchema = z
  .object({
    id: idSchema,
    products: z.array(productDisplayModelSchema).min(1),
    collections: z.array(collectionDisplayModelSchema).min(1),
  })
  .strict()
  .superRefine((catalogue, context) => {
    const productIds = catalogue.products.map((product) => product.id);
    const skus = catalogue.products.flatMap((product) => (product.sku ? [product.sku] : []));
    const collectionIds = catalogue.collections.map((collection) => collection.id);
    const assetIds = catalogue.products.flatMap((product) =>
      product.images.map((image) => image.id),
    );

    for (const [values, path, message] of [
      [productIds, ["products"], "Product IDs must be unique."],
      [skus, ["products"], "Product SKUs must be unique."],
      [collectionIds, ["collections"], "Collection IDs must be unique."],
      [assetIds, ["products"], "Asset IDs must be unique."],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", message, path: [...path] });
      }
    }

    const knownProducts = new Set(productIds);
    catalogue.collections.forEach((collection, collectionIndex) => {
      collection.productIds.forEach((productId, productIndex) => {
        if (!knownProducts.has(productId)) {
          context.addIssue({
            code: "custom",
            message: "Collection product references must resolve within the catalogue.",
            path: ["collections", collectionIndex, "productIds", productIndex],
          });
        }
      });
    });
  });

export const protectedProductPaths = ["price", "stockStatus"] as const;

export type ProductVariantDisplay = z.infer<typeof productVariantDisplaySchema>;
export type ProductOrderOptionDisplay = z.infer<typeof productOrderOptionDisplaySchema>;
export type ProductDisplayModel = z.infer<typeof productDisplayModelSchema>;
export type CollectionDisplayModel = z.infer<typeof collectionDisplayModelSchema>;
export type CatalogueDisplayModel = z.infer<typeof catalogueDisplayModelSchema>;
