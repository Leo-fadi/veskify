import { z } from "zod";
import { idSchema } from "@/domain/shared";
import { dynamicCollectionCommerceContentSchema } from "./dynamic-collection-commerce";
import { dynamicProductDetailContentSchema } from "./dynamic-product-detail";

const canonicalRevisionSchema = z.string().trim().min(1).max(240);

export const dynamicCollectionCommerceBridgeContentSchema = dynamicCollectionCommerceContentSchema
  .extend({
    collectionId: idSchema,
    productIds: z.array(idSchema),
    canonicalRevision: canonicalRevisionSchema,
  })
  .strict();

export const dynamicProductDetailBridgeContentSchema = dynamicProductDetailContentSchema
  .extend({
    productId: idSchema,
    relatedProductIds: z.array(idSchema),
    canonicalRevision: canonicalRevisionSchema,
  })
  .strict();
