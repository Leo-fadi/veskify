import { z } from "zod";
import { assetRefSchema, assetRoleSchema, idSchema } from "@/domain/shared";
import { responsiveImageAuthoritySchema } from "@/domain/asset-presentation";

export const approvedAssetPlacementPurposeSchema = z.enum([
  "brand-identity",
  "hero-primary",
  "campaign-primary",
  "editorial-story",
  "collection-card",
  "collection-campaign",
  "content-support",
  "decorative",
]);

export const approvedAssetReusePolicySchema = z.enum([
  "unique-high-salience",
  "bounded-editorial",
  "identity-reusable",
  "decorative-reusable",
]);

export const approvedAssetAffinitySchema = z.enum([
  "exact-role-exact-purpose",
  "exact-role-compatible-purpose",
  "compatible-role-exact-purpose",
  "compatible-fallback",
]);

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
    placementContext: z.enum(["page", "sharedFrame"]).optional(),
    placementPurpose: approvedAssetPlacementPurposeSchema.optional(),
    reusePolicy: approvedAssetReusePolicySchema.optional(),
    affinity: approvedAssetAffinitySchema.optional(),
    responsiveSourceAssetIds: z.array(idSchema).max(4).optional(),
    required: z.boolean().default(false),
  })
  .strict();

export type ApprovedAssetPlacementOperation = z.infer<typeof approvedAssetPlacementOperationSchema>;

const responsivePresentationSourceSchema = z
  .object({
    breakpoints: z
      .array(z.enum(["mobile", "tablet", "desktop", "wide"]))
      .min(1)
      .max(4),
    assetId: idSchema,
    role: assetRoleSchema,
    revision: z.string().trim().min(1).max(120),
    materialFingerprint: z.string().trim().min(1),
    asset: assetRefSchema,
  })
  .strict();

/** Safe URL-bearing projection of an already approved placement for rendering. */
export const approvedAssetPresentationSchema = z
  .object({
    assetId: idSchema,
    role: assetRoleSchema,
    revision: z.string().trim().min(1).max(120),
    materialFingerprint: z.string().trim().min(1),
    asset: assetRefSchema,
    artDirection: responsiveImageAuthoritySchema.optional(),
    responsiveSources: z.array(responsivePresentationSourceSchema).max(4).optional(),
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
    const responsiveSourceIds = presentation.responsiveSources?.map(({ assetId }) => assetId) ?? [];
    if (new Set(responsiveSourceIds).size !== responsiveSourceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["responsiveSources"],
        message: "Responsive presentation source identities must be unique.",
      });
    }
    presentation.responsiveSources?.forEach((responsiveSource, index) => {
      if (
        responsiveSource.assetId !== responsiveSource.asset.id ||
        responsiveSource.assetId === presentation.assetId
      ) {
        context.addIssue({
          code: "custom",
          path: ["responsiveSources", index, "assetId"],
          message: "Responsive presentation sources must identify a distinct matching asset.",
        });
      }
    });
    if (presentation.artDirection?.contractVersion === "1.1.0") {
      presentation.artDirection.responsiveSources.forEach(({ source }, index) => {
        const approvedSource = presentation.responsiveSources?.find(
          ({ assetId }) => assetId === source.assetId,
        );
        if (
          !approvedSource ||
          approvedSource.role !== source.role ||
          approvedSource.revision !== source.revision ||
          approvedSource.materialFingerprint !== source.materialFingerprint
        ) {
          context.addIssue({
            code: "custom",
            path: ["artDirection", "responsiveSources", index],
            message:
              "Responsive image source lineage must resolve to an exact approved presentation source.",
          });
        }
      });
    }
  });

export type ApprovedAssetPresentation = z.infer<typeof approvedAssetPresentationSchema>;
export type ApprovedAssetPlacementPurpose = z.infer<typeof approvedAssetPlacementPurposeSchema>;
export type ApprovedAssetReusePolicy = z.infer<typeof approvedAssetReusePolicySchema>;
export type ApprovedAssetAffinity = z.infer<typeof approvedAssetAffinitySchema>;
