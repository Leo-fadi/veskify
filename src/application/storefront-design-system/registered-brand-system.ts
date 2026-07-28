import { brandSystemSchema, premiumVisualPresets, type BrandSystem } from "@/domain/design-system";
import type { StorefrontDesignDirectionId, StorefrontDesignSystemV1 } from "./contract";

const radiusByCornerTreatment = {
  square: "square",
  soft: "subtle",
  rounded: "rounded",
} as const;

const densityBySpacing = {
  compact: "compact",
  standard: "balanced",
  spacious: "airy",
} as const;

const imageryByTreatment = {
  fullBleed: "editorial",
  contained: "studio",
  editorialCrop: "editorial",
  productNeutral: "product-focused",
  split: "mixed",
  softFrame: "mixed",
} as const;

const visualImageTreatmentByTreatment = {
  fullBleed: "crop",
  contained: "contained",
  editorialCrop: "editorial",
  productNeutral: "contained",
  split: "crop",
  softFrame: "contained",
} as const;

/** Materializes only server-registered values for a validated direction ID. */
export function registeredBrandSystemForDirection(
  baseline: BrandSystem,
  designSystem: StorefrontDesignSystemV1,
  directionId: StorefrontDesignDirectionId,
): BrandSystem {
  const direction = designSystem.directions.find((candidate) => candidate.id === directionId);
  const typography = designSystem.typographyDirections.find(
    (candidate) => candidate.id === direction?.typographyDirectionId,
  );
  if (!direction || !typography) {
    throw new Error("The selected registered storefront direction is unavailable.");
  }
  return brandSystemSchema.parse({
    ...structuredClone(baseline),
    typography: {
      ...structuredClone(baseline.typography),
      headingFont: typography.headingFont,
      bodyFont: typography.bodyFont,
      scaleRatio: typography.scaleRatio,
    },
    shape: { radius: radiusByCornerTreatment[direction.cornerTreatment] },
    spacing: { density: densityBySpacing[direction.spacingDensity] },
    imagery: { style: imageryByTreatment[direction.imageTreatmentId] },
    visualSystem: {
      ...structuredClone(baseline.visualSystem ?? premiumVisualPresets.premiumEditorial),
      surfaceDepth: direction.surfaceDepth,
      imageTreatment: visualImageTreatmentByTreatment[direction.imageTreatmentId],
    },
  });
}
