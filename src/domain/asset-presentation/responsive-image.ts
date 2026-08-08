import { z } from "zod";
import { assetRoleSchema, idSchema } from "@/domain/shared";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";

export const responsiveImageAuthorityContractVersion = "1.0.0" as const;
export const responsiveImageBreakpoints = ["mobile", "tablet", "desktop", "wide"] as const;

export const responsiveImageBreakpointSchema = z.enum(responsiveImageBreakpoints);
export const responsiveImageRatioSchema = z.enum([
  "natural",
  "square",
  "portrait",
  "landscape",
  "wide",
]);
export const responsiveImageOverlaySchema = z.enum(["none", "subtle", "contrast", "gradient"]);

export const normalizedPointSchema = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();

export const normalizedRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .superRefine((rect, context) => {
    if (rect.x + rect.width > 1 || rect.y + rect.height > 1) {
      context.addIssue({
        code: "custom",
        message: "Normalized rectangles must remain inside the source frame.",
      });
    }
  });

export const responsiveImageCropSchema = z
  .object({
    mode: z.enum(["natural", "contain", "cover", "editorial"]),
    rect: normalizedRectSchema.optional(),
  })
  .strict()
  .superRefine((crop, context) => {
    if (crop.rect !== undefined && crop.mode !== "editorial") {
      context.addIssue({
        code: "custom",
        path: ["rect"],
        message: "Only editorial crops may declare an explicit normalized crop rectangle.",
      });
    }
  });

export const responsiveImageTreatmentSchema = z
  .object({
    ratio: responsiveImageRatioSchema,
    crop: responsiveImageCropSchema,
    focalPoint: normalizedPointSchema,
    overlay: responsiveImageOverlaySchema,
  })
  .strict();

export const responsiveImageSourceLineageSchema = z
  .object({
    assetId: idSchema,
    role: assetRoleSchema,
    revision: z.string().trim().min(1).max(120),
    materialFingerprint: z.string().trim().min(1),
    provenanceKind: z.enum([
      "merchantProvided",
      "sourceDiscovered",
      "canonicalProductMedia",
      "generated",
      "preset",
    ]),
    sourceOwnerId: idSchema,
  })
  .strict();

export const responsiveImagePlacementAuthoritySchema = z
  .object({
    componentType: z.string().trim().min(1).max(80),
    componentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    variant: z.string().trim().min(1).max(80),
    anatomyContractVersion: z.string().trim().min(1).max(40),
    anatomyIdentity: z.string().trim().min(1).max(120),
    anatomyVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    anatomyRegion: z.string().trim().min(1).max(80),
    assetSlotId: z.string().trim().min(1).max(80),
    required: z.boolean(),
  })
  .strict();

export const approvedResponsiveImageDerivativeSchema = z
  .object({
    derivativeId: idSchema,
    revision: z.string().trim().min(1).max(120),
    materialFingerprint: z.string().trim().min(1),
    source: responsiveImageSourceLineageSchema,
    transform: responsiveImageTreatmentSchema,
    approvalStatus: z.enum(["pending", "approved", "rejected"]),
    breakpoint: responsiveImageBreakpointSchema.optional(),
  })
  .strict();

const responsiveTreatmentOverrideSchema = z
  .object({
    breakpoint: responsiveImageBreakpointSchema,
    treatment: responsiveImageTreatmentSchema,
  })
  .strict();

const authorityMaterialSchema = z
  .object({
    contractVersion: z.literal(responsiveImageAuthorityContractVersion),
    source: responsiveImageSourceLineageSchema,
    placement: responsiveImagePlacementAuthoritySchema,
    safeArea: normalizedRectSchema.optional(),
    sourceTreatment: responsiveImageTreatmentSchema,
    responsiveTreatments: z.array(responsiveTreatmentOverrideSchema).max(4),
    derivatives: z.array(approvedResponsiveImageDerivativeSchema),
  })
  .strict();

function orderedMaterial(input: z.infer<typeof authorityMaterialSchema>) {
  return {
    ...input,
    responsiveTreatments: [...input.responsiveTreatments].sort(
      (a, b) =>
        responsiveImageBreakpoints.indexOf(a.breakpoint) -
        responsiveImageBreakpoints.indexOf(b.breakpoint),
    ),
    derivatives: [...input.derivatives].sort((a, b) =>
      a.derivativeId.localeCompare(b.derivativeId),
    ),
  };
}

export function responsiveImageAuthorityFingerprint(
  input: z.infer<typeof authorityMaterialSchema>,
) {
  return canonicalValueFingerprint(orderedMaterial(authorityMaterialSchema.parse(input)));
}

export const responsiveImageAuthoritySchema = authorityMaterialSchema
  .extend({ fingerprint: z.string().trim().min(1) })
  .strict()
  .superRefine((authority, context) => {
    const breakpoints = authority.responsiveTreatments.map(({ breakpoint }) => breakpoint);
    if (new Set(breakpoints).size !== breakpoints.length) {
      context.addIssue({
        code: "custom",
        path: ["responsiveTreatments"],
        message: "Responsive treatment breakpoints must be unique.",
      });
    }
    const derivativeIds = authority.derivatives.map(({ derivativeId }) => derivativeId);
    if (new Set(derivativeIds).size !== derivativeIds.length) {
      context.addIssue({
        code: "custom",
        path: ["derivatives"],
        message: "Derivative identities must be unique.",
      });
    }
    authority.derivatives.forEach((derivative, index) => {
      if (
        canonicalValueFingerprint(derivative.source) !== canonicalValueFingerprint(authority.source)
      ) {
        context.addIssue({
          code: "custom",
          path: ["derivatives", index, "source"],
          message: "Derivative lineage must exactly match the approved source.",
        });
      }
    });
    const { fingerprint, ...material } = authority;
    if (fingerprint !== responsiveImageAuthorityFingerprint(material)) {
      context.addIssue({
        code: "custom",
        path: ["fingerprint"],
        message: "Responsive image authority fingerprint is stale.",
      });
    }
  });

export type ResponsiveImageBreakpoint = z.infer<typeof responsiveImageBreakpointSchema>;
export type ResponsiveImageTreatment = z.infer<typeof responsiveImageTreatmentSchema>;
export type ResponsiveImageSourceLineage = z.infer<typeof responsiveImageSourceLineageSchema>;
export type ResponsiveImageAuthority = z.infer<typeof responsiveImageAuthoritySchema>;
export type ResponsiveImageAuthorityMaterial = z.input<typeof authorityMaterialSchema>;

export function createResponsiveImageAuthority(
  input: z.input<typeof authorityMaterialSchema>,
): ResponsiveImageAuthority {
  const material = orderedMaterial(authorityMaterialSchema.parse(input));
  return responsiveImageAuthoritySchema.parse({
    ...material,
    fingerprint: responsiveImageAuthorityFingerprint(material),
  });
}

export function rectContains(
  outer: z.infer<typeof normalizedRectSchema>,
  inner: z.infer<typeof normalizedRectSchema>,
) {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height
  );
}
