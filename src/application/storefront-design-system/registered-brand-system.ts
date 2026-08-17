import {
  brandSystemSchema,
  designDnaSchema,
  migrateLegacyFoundationToDesignDna,
  modernTechnicalDesignDna,
  premiumEditorialDesignDna,
  premiumVisualPresets,
  type BrandSystem,
  type DesignDna,
} from "@/domain/design-system";
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

type RegisteredSpacingDensity = "compact" | "standard" | "spacious";
type RegisteredSurfaceDepth = "flat" | "subtle" | "layered";

const spacingDomainByDensity = {
  compact: {
    scale: "compact",
    sectionRhythm: "compact",
    pageGutter: "compact",
    gridGap: "tight",
    cardInset: "compact",
  },
  standard: {
    scale: "balanced",
    sectionRhythm: "balanced",
    pageGutter: "standard",
    gridGap: "standard",
    cardInset: "standard",
  },
  spacious: {
    scale: "generous",
    sectionRhythm: "expansive",
    pageGutter: "generous",
    gridGap: "open",
    cardInset: "generous",
  },
} as const;

const designDnaDensityBySpacing = {
  compact: "compact",
  standard: "balanced",
  spacious: "spacious",
} as const;

const controlHeightBySpacing = {
  compact: "compact",
  standard: "standard",
  spacious: "prominent",
} as const;

const elevationBySurfaceDepth = {
  flat: "flat",
  subtle: "subtle",
  layered: "raised",
} as const;

/**
 * Applies the bounded global-density domain without replacing a direction's
 * typography, media, shape, action hierarchy, or container identity.
 */
function applyRegisteredDensityDomain(
  input: DesignDna,
  spacingDensity: RegisteredSpacingDensity,
  surfaceDepth: RegisteredSurfaceDepth,
): DesignDna {
  const density = designDnaDensityBySpacing[spacingDensity];
  return designDnaSchema.parse({
    ...structuredClone(input),
    spacing: {
      ...structuredClone(input.spacing),
      ...spacingDomainByDensity[spacingDensity],
    },
    surfaces: {
      ...structuredClone(input.surfaces),
      elevation: elevationBySurfaceDepth[surfaceDepth],
    },
    controls: {
      ...structuredClone(input.controls),
      height: controlHeightBySpacing[spacingDensity],
      density,
    },
    density: {
      posture: density,
      navigation: density,
      content: density,
      // Spacious editorial/minimal composition keeps purchase controls
      // deliberate rather than inflating the commerce region.
      commerce: density === "spacious" ? "balanced" : density,
    },
  });
}

/** Materializes only server-registered values for a validated direction ID. */
export function registeredBrandSystemForDirection(
  baseline: BrandSystem,
  designSystem: StorefrontDesignSystemV1,
  directionId: StorefrontDesignDirectionId,
  narrowing?: Readonly<{
    spacingDensity: "compact" | "standard" | "spacious";
    surfaceDepth: "flat" | "subtle" | "layered";
  }>,
): BrandSystem {
  const direction = designSystem.directions.find((candidate) => candidate.id === directionId);
  const typography = designSystem.typographyDirections.find(
    (candidate) => candidate.id === direction?.typographyDirectionId,
  );
  if (!direction || !typography) {
    throw new Error("The selected registered storefront direction is unavailable.");
  }
  const selected = { ...direction, ...narrowing };
  const materialized = brandSystemSchema.parse({
    ...structuredClone(baseline),
    typography: {
      ...structuredClone(baseline.typography),
      headingFont: typography.headingFont,
      bodyFont: typography.bodyFont,
      scaleRatio: typography.scaleRatio,
    },
    shape: { radius: radiusByCornerTreatment[selected.cornerTreatment] },
    spacing: { density: densityBySpacing[selected.spacingDensity] },
    imagery: { style: imageryByTreatment[selected.imageTreatmentId] },
    visualSystem: {
      ...structuredClone(baseline.visualSystem ?? premiumVisualPresets.premiumEditorial),
      surfaceDepth: selected.surfaceDepth,
      imageTreatment: visualImageTreatmentByTreatment[selected.imageTreatmentId],
    },
  });
  const migratedDesignDna = migrateLegacyFoundationToDesignDna(materialized);
  const directionalDesignDna =
    directionId === "premiumEditorial"
      ? {
          ...structuredClone(premiumEditorialDesignDna),
          colour: structuredClone(migratedDesignDna.colour),
        }
      : directionId === "modernTechnical"
        ? {
            ...structuredClone(modernTechnicalDesignDna),
            colour: structuredClone(migratedDesignDna.colour),
          }
        : migratedDesignDna;
  const designDna = applyRegisteredDensityDomain(
    directionalDesignDna,
    selected.spacingDensity,
    selected.surfaceDepth,
  );
  return brandSystemSchema.parse({
    ...materialized,
    designDna,
  });
}
