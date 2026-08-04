import { z } from "zod";
import { assetRefSchema, assetRoleSchema, idSchema } from "@/domain/shared";

/**
 * Immutable authority for an approved source asset placed in a storefront
 * component. This is intentionally independent of planner, editor and
 * renderer implementations so one canonical record can cross each boundary.
 */
export const approvedAssetPlacementOperationSchema = z
  .object({
    type: z.literal("PLACE_APPROVED_SOURCE_ASSET"),
    pageId: idSchema,
    componentId: idSchema,
    componentType: z.string().trim().min(1).max(80),
    assetSlotId: z.string().trim().min(1).max(80),
    assetId: idSchema,
    role: assetRoleSchema,
    assetRevision: z.string().trim().min(1).max(120),
    materialFingerprint: z.string().trim().min(1),
    sourceReferenceId: idSchema,
    required: z.boolean().default(false),
  })
  .strict();

export type ApprovedAssetPlacementOperation = z.infer<typeof approvedAssetPlacementOperationSchema>;

/** Safe URL-bearing projection of an already approved placement for rendering. */
export const approvedAssetPresentationSchema = z
  .object({
    assetId: idSchema,
    role: assetRoleSchema,
    revision: z.string().trim().min(1).max(120),
    materialFingerprint: z.string().trim().min(1),
    asset: assetRefSchema,
  })
  .strict();

export type ApprovedAssetPresentation = z.infer<typeof approvedAssetPresentationSchema>;
