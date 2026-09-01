import { z } from "zod";

/**
 * Canonical approved-asset roles shared by capability declarations, source
 * evidence and persisted storefront placement records.
 */
export const assetRoleValues = Object.freeze([
  "logo",
  "heroDesktop",
  "heroMobile",
  "collectionImage",
  "productMainImage",
  "productAlternativeImage",
  "editorialImage",
  "supportingContentImage",
  "iconDecorative",
] as const);

export const assetRoleSchema = z.enum(assetRoleValues);

export type AssetRole = z.infer<typeof assetRoleSchema>;
