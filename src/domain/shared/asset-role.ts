import { z } from "zod";

/**
 * Canonical approved-asset roles shared by capability declarations, source
 * evidence and persisted storefront placement records.
 */
export const assetRoleSchema = z.enum([
  "logo",
  "heroDesktop",
  "heroMobile",
  "collectionImage",
  "productMainImage",
  "productAlternativeImage",
  "editorialImage",
  "supportingContentImage",
  "iconDecorative",
]);

export type AssetRole = z.infer<typeof assetRoleSchema>;
