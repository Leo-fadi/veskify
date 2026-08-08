import { z } from "zod";
import { assetRefSchema, assetRoleSchema, idSchema } from "@/domain/shared";
import { responsiveImageAuthoritySchema } from "@/domain/asset-presentation";

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
    sourceProvenanceKind: z
      .enum(["merchantProvided", "sourceDiscovered", "generated", "preset"])
      .optional(),
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
    artDirection: responsiveImageAuthoritySchema.optional(),
  })
  .strict()
  .superRefine((presentation, context) => {
    const source = presentation.artDirection?.source;
    if (
      source !== undefined &&
      (source.assetId !== presentation.assetId ||
        source.assetId !== presentation.asset.id ||
        source.role !== presentation.role ||
        source.revision !== presentation.revision ||
        source.materialFingerprint !== presentation.materialFingerprint)
    ) {
      context.addIssue({
        code: "custom",
        path: ["artDirection", "source"],
        message: "Responsive image source lineage must match the approved presentation exactly.",
      });
    }
  });

export type ApprovedAssetPresentation = z.infer<typeof approvedAssetPresentationSchema>;
