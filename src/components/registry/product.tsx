import {
  ImageText,
  ProductGallery,
  ProductInfo,
  ProductOptions,
  RelatedProducts,
} from "@/components/storefront/product-sections";
import { defineComponent } from "./contract";
import { sectionVocabularyClass } from "./design-vocabulary";
import {
  imageTextContentSchema,
  imageTextMetadata,
  imageTextPropsSchema,
  productGalleryContentSchema,
  productGalleryMetadata,
  productGalleryPropsSchema,
  productInfoContentSchema,
  productInfoMetadata,
  productInfoPropsSchema,
  productOptionsContentSchema,
  productOptionsMetadata,
  productOptionsPropsSchema,
  relatedProductsContentSchema,
  relatedProductsMetadata,
  relatedProductsPropsSchema,
} from "./product-metadata";

export {
  imageTextContentSchema,
  imageTextPropsSchema,
  productGalleryContentSchema,
  productGalleryPropsSchema,
  productInfoContentSchema,
  productInfoPropsSchema,
  productOptionsContentSchema,
  productOptionsPropsSchema,
  relatedProductsContentSchema,
  relatedProductsPropsSchema,
};

function requireProduct(productId: string, catalogue: { products: Array<{ id: string }> }) {
  if (!catalogue.products.some((product) => product.id === productId)) {
    throw new Error(`Unknown product reference: ${productId}.`);
  }
}

export const productGalleryDefinition = defineComponent({
  ...productGalleryMetadata,
  validateContext: ({ content, context }) => requireProduct(content.productId, context.catalogue),
  renderer: ({ content, context }) => <ProductGallery {...content} context={context} />,
});
export const productInfoDefinition = defineComponent({
  ...productInfoMetadata,
  validateContext: ({ content, context }) => requireProduct(content.productId, context.catalogue),
  renderer: ({ content, props, context }) => (
    <ProductInfo {...content} {...props} context={context} />
  ),
});
export const productOptionsDefinition = defineComponent({
  ...productOptionsMetadata,
  validateContext: ({ content, context }) => requireProduct(content.productId, context.catalogue),
  renderer: ({ content, context }) => <ProductOptions {...content} context={context} />,
});
export const imageTextDefinition = defineComponent({
  ...imageTextMetadata,
  renderer: ({ variant, content, props, context }) => (
    <ImageText
      {...content}
      className={sectionVocabularyClass(variant, props)}
      context={context}
      layout={variant === "imageLeft" ? "left" : variant === "stacked" ? "stacked" : "right"}
    />
  ),
});
export const relatedProductsDefinition = defineComponent({
  ...relatedProductsMetadata,
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
