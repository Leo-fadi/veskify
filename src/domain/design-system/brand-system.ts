import { z } from "zod";
import {
  designDnaFingerprint,
  designDnaSchema,
  fontTokenSchema,
  migrateLegacyFoundationToDesignDna,
  projectDesignDna,
  readableForegroundAcrossBackgrounds,
  type DesignDna,
  type EffectiveDesignDnaProjection,
} from "./design-dna";

const colorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{6})$/, "Use six-digit hex colours.");

export { approvedFontTokens, fontTokenSchema } from "./design-dna";
export type { DesignDna, EffectiveDesignDnaProjection, FontToken } from "./design-dna";

export const brandVoiceSchema = z
  .object({
    formality: z.enum(["casual", "balanced", "formal"]),
    detail: z.enum(["concise", "balanced", "descriptive"]),
    positioning: z.enum(["accessible", "balanced", "premium"]),
    warmth: z.enum(["neutral", "balanced", "warm"]),
    energy: z.enum(["direct", "balanced", "inspirational"]),
  })
  .strict();

export const premiumVisualPresetIds = [
  "premiumEditorial",
  "modernMinimal",
  "futureLuxury",
] as const;
export const premiumVisualPresetIdSchema = z.enum(premiumVisualPresetIds);

export const visualSystemSchema = z
  .object({
    preset: premiumVisualPresetIdSchema,
    contentWidth: z.enum(["narrow", "standard", "wide"]),
    surface: z.enum(["quiet", "layered", "contrast"]),
    divider: z.enum(["none", "subtle", "strong"]),
    buttonHierarchy: z.enum(["quiet", "balanced", "strong"]),
    imageTreatment: z.enum(["contained", "crop", "editorial"]),
    theme: z.enum(["light", "dark"]),
    borderTreatment: z.enum(["none", "subtle", "defined"]).optional(),
    surfaceDepth: z.enum(["flat", "subtle", "layered"]).optional(),
    imageAspect: z.enum(["natural", "portrait", "landscape", "square"]).optional(),
    cropTreatment: z.enum(["contain", "cover", "editorial"]).optional(),
  })
  .strict();

export const semanticPresentationRolesSchema = z
  .object({
    emphasis: colorSchema,
    success: colorSchema,
    warning: colorSchema,
    unavailable: colorSchema,
  })
  .strict();

export const premiumVisualPresets = {
  premiumEditorial: {
    preset: "premiumEditorial",
    contentWidth: "wide",
    surface: "layered",
    divider: "subtle",
    buttonHierarchy: "balanced",
    imageTreatment: "editorial",
    theme: "light",
  },
  modernMinimal: {
    preset: "modernMinimal",
    contentWidth: "standard",
    surface: "quiet",
    divider: "subtle",
    buttonHierarchy: "quiet",
    imageTreatment: "contained",
    theme: "light",
  },
  futureLuxury: {
    preset: "futureLuxury",
    contentWidth: "wide",
    surface: "contrast",
    divider: "strong",
    buttonHierarchy: "strong",
    imageTreatment: "crop",
    theme: "dark",
  },
} as const satisfies Record<
  z.infer<typeof premiumVisualPresetIdSchema>,
  z.infer<typeof visualSystemSchema>
>;

export const premiumVisualPresetLabels: Record<
  z.infer<typeof premiumVisualPresetIdSchema>,
  { en: string; fi: string }
> = {
  premiumEditorial: { en: "Premium editorial", fi: "Ensiluokkainen editorial" },
  modernMinimal: { en: "Modern minimal", fi: "Moderni minimalismi" },
  futureLuxury: { en: "Future luxury", fi: "Tulevaisuuden luksus" },
};

export const brandSystemSchema = z
  .object({
    colors: z
      .object({
        primary: colorSchema,
        secondary: colorSchema,
        accent: colorSchema,
        background: colorSchema,
        surface: colorSchema,
        text: colorSchema,
        mutedText: colorSchema,
        border: colorSchema,
      })
      .strict(),
    typography: z
      .object({
        headingFont: fontTokenSchema,
        bodyFont: fontTokenSchema,
        baseSize: z.number().int().min(14).max(20),
        scaleRatio: z.number().min(1.125).max(1.5),
        headingWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
        bodyWeight: z.union([z.literal(400), z.literal(500)]),
      })
      .strict(),
    shape: z.object({ radius: z.enum(["square", "subtle", "rounded", "pill"]) }).strict(),
    spacing: z.object({ density: z.enum(["airy", "balanced", "compact"]) }).strict(),
    imagery: z
      .object({
        style: z.enum(["studio", "lifestyle", "editorial", "product-focused", "mixed"]),
      })
      .strict(),
    voice: brandVoiceSchema,
    visualSystem: visualSystemSchema.optional(),
    semanticPresentation: semanticPresentationRolesSchema.optional(),
    designDna: designDnaSchema.optional(),
  })
  .strict();

export type BrandSystem = z.infer<typeof brandSystemSchema>;
export type VisualSystem = z.infer<typeof visualSystemSchema>;

export function resolveBrandSystemDesignDna(input: BrandSystem): DesignDna {
  const brand = brandSystemSchema.parse(input);
  return brand.designDna ?? migrateLegacyFoundationToDesignDna(brand);
}

/** Deterministically upgrades a legacy BrandSystem while preserving its existing merchant intent. */
export function migrateBrandSystemDesignDna(input: unknown): BrandSystem {
  const brand = brandSystemSchema.parse(structuredClone(input));
  return brandSystemSchema.parse({
    ...brand,
    designDna: resolveBrandSystemDesignDna(brand),
  });
}

export function brandSystemDesignDnaFingerprint(input: BrandSystem): string {
  return designDnaFingerprint(resolveBrandSystemDesignDna(input));
}

export function projectBrandSystemDesignDna(input: BrandSystem): EffectiveDesignDnaProjection {
  const brand = brandSystemSchema.parse(input);
  return projectDesignDna(resolveBrandSystemDesignDna(brand), brand.typography.baseSize);
}

export type BrandSystemFoundationPatch = Readonly<
  Partial<
    Pick<
      BrandSystem,
      | "colors"
      | "typography"
      | "shape"
      | "spacing"
      | "imagery"
      | "visualSystem"
      | "semanticPresentation"
    >
  >
>;

/** Applies compatibility-field changes and synchronizes only their canonical Design DNA domains. */
export function applyBrandSystemFoundationPatch(
  baseline: BrandSystem,
  patch: BrandSystemFoundationPatch,
): BrandSystem {
  const current = resolveBrandSystemDesignDna(baseline);
  const candidate = brandSystemSchema.parse({
    ...structuredClone(baseline),
    ...structuredClone(patch),
  });
  const derived = migrateLegacyFoundationToDesignDna(candidate);
  const changesColour = "colors" in patch || "semanticPresentation" in patch;
  const changesSurfaces = "shape" in patch || "visualSystem" in patch;
  const changesMedia = "imagery" in patch || "visualSystem" in patch;
  const changesControls = "spacing" in patch || changesSurfaces;
  return brandSystemSchema.parse({
    ...candidate,
    designDna: {
      ...current,
      ...(changesColour ? { colour: derived.colour } : {}),
      ...(patch.typography === undefined ? {} : { typography: derived.typography }),
      ...(patch.spacing === undefined
        ? {}
        : { spacing: derived.spacing, density: derived.density }),
      ...(changesSurfaces ? { surfaces: derived.surfaces } : {}),
      ...(changesControls ? { controls: derived.controls } : {}),
      ...(changesMedia ? { media: derived.media } : {}),
    },
  });
}

const compatibilityDensityValues: Readonly<Record<BrandSystem["spacing"]["density"], string>> = {
  compact: "0.85",
  balanced: "1",
  airy: "1.2",
};

export function brandSystemToCssVariables(input: BrandSystem): Record<string, string> {
  const brand = brandSystemSchema.parse(input);
  const projection = projectBrandSystemDesignDna(brand);
  const dna = resolveBrandSystemDesignDna(brand);
  const visualSystem = visualSystemSchema.parse(
    brand.visualSystem ?? premiumVisualPresets.premiumEditorial,
  );
  const primaryText = readableForegroundAcrossBackgrounds(
    [brand.colors.primary],
    [brand.colors.surface, brand.colors.text],
  );
  const secondaryText = readableForegroundAcrossBackgrounds(
    [brand.colors.secondary],
    [brand.colors.surface, brand.colors.text],
  );
  const accentText = readableForegroundAcrossBackgrounds(
    [brand.colors.accent],
    [brand.colors.text, brand.colors.surface],
  );
  return {
    ...projection.cssVariables,
    "--brand-color-primary": brand.colors.primary,
    "--brand-color-secondary": brand.colors.secondary,
    "--brand-color-accent": brand.colors.accent,
    "--brand-color-background": brand.colors.background,
    "--brand-color-surface": brand.colors.surface,
    "--brand-color-text": brand.colors.text,
    "--brand-color-muted-text": brand.colors.mutedText,
    "--brand-color-border": brand.colors.border,
    "--brand-surface-section": dna.colour.surface,
    "--brand-surface-subtle": dna.colour.mutedSurface,
    "--brand-action-primary": brand.colors.primary,
    "--brand-action-primary-text": primaryText,
    "--brand-color-primary-text": primaryText,
    "--brand-color-secondary-text": secondaryText,
    "--brand-color-accent-text": accentText,
    "--brand-highlight": brand.colors.accent,
    "--brand-highlight-text": accentText,
    "--brand-action-disabled-surface": brand.colors.surface,
    "--brand-action-disabled-text":
      brand.semanticPresentation?.unavailable ?? brand.colors.mutedText,
    "--brand-action-disabled-border":
      brand.semanticPresentation?.unavailable ?? brand.colors.mutedText,
    "--brand-spacing-density": compatibilityDensityValues[brand.spacing.density],
    "--brand-imagery-style": brand.imagery.style,
    "--brand-content-width": projection.cssVariables["--brand-container-content"],
    "--brand-surface-treatment": dna.surfaces.posture,
    "--brand-divider-treatment": dna.surfaces.border,
    "--brand-button-hierarchy": dna.controls.emphasis,
    "--brand-image-treatment": visualSystem.imageTreatment,
    "--brand-theme": visualSystem.theme,
    "--brand-border-treatment": dna.surfaces.border,
    "--brand-surface-depth": dna.surfaces.elevation,
    "--brand-image-aspect": dna.media.ratio,
    "--brand-crop-treatment": dna.media.crop,
  };
}

export const aurumNordicBrandSystem = brandSystemSchema.parse({
  colors: {
    primary: "#8A5A2B",
    secondary: "#1F2A44",
    accent: "#D6A84F",
    background: "#FFFAF3",
    surface: "#FFFFFF",
    text: "#1D1A16",
    mutedText: "#5F574F",
    border: "#DDD2C2",
  },
  typography: {
    headingFont: "georgia",
    bodyFont: "inter",
    baseSize: 16,
    scaleRatio: 1.25,
    headingWeight: 600,
    bodyWeight: 400,
  },
  shape: { radius: "rounded" },
  spacing: { density: "balanced" },
  imagery: { style: "studio" },
  voice: {
    formality: "balanced",
    detail: "concise",
    positioning: "premium",
    warmth: "warm",
    energy: "inspirational",
  },
});
