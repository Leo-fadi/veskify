import { z } from "zod";
import { idSchema } from "@/domain/shared";

export const dynamicCommerceDesignSelectionSchema = z
  .object({
    authorityFingerprint: z.string().trim().min(1).max(240),
    collectionArchetypeId: idSchema,
    searchArchetypeId: idSchema,
    standardSimpleArchetypeId: idSchema,
    configurableArchetypeId: idSchema,
    galleryLedArchetypeId: idSchema,
    highConsiderationArchetypeId: idSchema,
    genericFallbackArchetypeId: idSchema,
    productTypeMappings: z.record(idSchema, idSchema),
  })
  .strict();

export type DynamicCommerceDesignSelection = Readonly<{
  authorityFingerprint: string;
  collectionArchetypeId: string;
  searchArchetypeId: string;
  standardSimpleArchetypeId: string;
  configurableArchetypeId: string;
  galleryLedArchetypeId: string;
  highConsiderationArchetypeId: string;
  genericFallbackArchetypeId: string;
  productTypeMappings: Readonly<Record<string, string>>;
}>;

export type DynamicCommerceDesignSelectionErrorCode =
  | "missing-authority"
  | "invalid-selection"
  | "unknown-archetype"
  | "incompatible-context"
  | "stale-authority"
  | "stale-commerce-authority"
  | "stale-product-type-authority";

export class DynamicCommerceDesignSelectionError extends Error {
  constructor(
    readonly code: DynamicCommerceDesignSelectionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DynamicCommerceDesignSelectionError";
  }
}
