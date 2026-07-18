import { z } from "zod";

const colorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{6})$/, "Use six-digit hex colours.");

export const approvedFontTokens = ["inter", "georgia", "system-sans", "system-serif"] as const;
export const fontTokenSchema = z.enum(approvedFontTokens);

export const brandVoiceSchema = z
  .object({
    formality: z.enum(["casual", "balanced", "formal"]),
    detail: z.enum(["concise", "balanced", "descriptive"]),
    positioning: z.enum(["accessible", "balanced", "premium"]),
    warmth: z.enum(["neutral", "balanced", "warm"]),
    energy: z.enum(["direct", "balanced", "inspirational"]),
  })
  .strict();

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
  })
  .strict();

export type FontToken = z.infer<typeof fontTokenSchema>;
export type BrandSystem = z.infer<typeof brandSystemSchema>;

const fontStacks: Record<FontToken, string> = {
  inter: '"Inter", "Arial", sans-serif',
  georgia: '"Georgia", "Times New Roman", serif',
  "system-sans": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "system-serif": 'Georgia, Cambria, "Times New Roman", serif',
};

const radiusValues: Record<BrandSystem["shape"]["radius"], string> = {
  square: "0rem",
  subtle: "0.375rem",
  rounded: "0.75rem",
  pill: "9999px",
};

const densityValues: Record<BrandSystem["spacing"]["density"], string> = {
  compact: "0.85",
  balanced: "1",
  airy: "1.2",
};

export function brandSystemToCssVariables(input: BrandSystem): Record<string, string> {
  const brand = brandSystemSchema.parse(input);

  return {
    "--brand-color-primary": brand.colors.primary,
    "--brand-color-secondary": brand.colors.secondary,
    "--brand-color-accent": brand.colors.accent,
    "--brand-color-background": brand.colors.background,
    "--brand-color-surface": brand.colors.surface,
    "--brand-color-text": brand.colors.text,
    "--brand-color-muted-text": brand.colors.mutedText,
    "--brand-color-border": brand.colors.border,
    "--brand-font-heading": fontStacks[brand.typography.headingFont],
    "--brand-font-body": fontStacks[brand.typography.bodyFont],
    "--brand-type-base-size": `${brand.typography.baseSize}px`,
    "--brand-type-scale-ratio": String(brand.typography.scaleRatio),
    "--brand-type-heading-weight": String(brand.typography.headingWeight),
    "--brand-type-body-weight": String(brand.typography.bodyWeight),
    "--brand-radius": radiusValues[brand.shape.radius],
    "--brand-spacing-density": densityValues[brand.spacing.density],
    "--brand-imagery-style": brand.imagery.style,
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
