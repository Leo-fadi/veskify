import { z } from "zod";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import { contrastRatio, standardTextContrastMinimum } from "./color-contrast";

const colorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{6})$/, "Use six-digit hex colours.");
export const approvedFontTokens = ["inter", "georgia", "system-sans", "system-serif"] as const;
export const fontTokenSchema = z.enum(approvedFontTokens);
export type FontToken = z.infer<typeof fontTokenSchema>;
const weightSchema = z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]);
const lineHeightSchema = z.enum(["tight", "balanced", "relaxed"]);
const trackingSchema = z.enum(["tight", "normal", "open"]);
const densitySchema = z.enum(["compact", "balanced", "spacious"]);

export const designDnaVersion = "1.0.0" as const;

const typeRoleSchema = z
  .object({
    font: fontTokenSchema,
    scaleStep: z.number().int().min(-1).max(6),
    weight: weightSchema,
    lineHeight: lineHeightSchema,
    tracking: trackingSchema,
  })
  .strict();

export const designDnaSchema = z
  .object({
    version: z.literal(designDnaVersion),
    colour: z
      .object({
        page: colorSchema,
        surface: colorSchema,
        mutedSurface: colorSchema,
        contrastSurface: colorSchema,
        text: colorSchema,
        mutedText: colorSchema,
        contrastText: colorSchema,
        border: colorSchema,
        accent: colorSchema,
        primaryAction: colorSchema,
        primaryActionText: colorSchema,
        secondaryAction: colorSchema,
        secondaryActionText: colorSchema,
        success: colorSchema,
        warning: colorSchema,
        unavailable: colorSchema,
        surfaceRelationship: z.enum(["quiet", "layered", "contrast"]),
        actionRelationship: z.enum(["primary-led", "dual", "accent-led"]),
      })
      .strict(),
    typography: z
      .object({
        pairing: z.enum(["serif-led", "sans-led", "mixed"]),
        scale: z
          .object({
            posture: z.enum(["compact", "balanced", "expressive"]),
            ratio: z.number().min(1.125).max(1.5),
          })
          .strict(),
        weightPosture: z.enum(["light", "regular", "medium", "strong"]),
        lineHeightPosture: lineHeightSchema,
        trackingPosture: trackingSchema,
        roles: z
          .object({
            display: typeRoleSchema,
            heading: typeRoleSchema,
            body: typeRoleSchema,
            utility: typeRoleSchema,
            price: typeRoleSchema,
          })
          .strict(),
      })
      .strict(),
    spacing: z
      .object({
        scale: z.enum(["compact", "balanced", "generous"]),
        sectionRhythm: z.enum(["compact", "balanced", "expansive"]),
        pageGutter: z.enum(["compact", "standard", "generous"]),
        gridGap: z.enum(["tight", "standard", "open"]),
        cardInset: z.enum(["compact", "standard", "generous"]),
        containers: z
          .object({
            reading: z.enum(["narrow", "standard"]),
            content: z.enum(["standard", "wide"]),
            commerce: z.enum(["standard", "wide"]),
            wide: z.enum(["wide", "full"]),
            fullWidth: z.enum(["contained", "edge-to-edge"]),
          })
          .strict(),
      })
      .strict(),
    surfaces: z
      .object({
        posture: z.enum(["quiet", "layered", "contrast"]),
        border: z.enum(["none", "subtle", "defined", "strong"]),
        radius: z.enum(["square", "subtle", "rounded", "pill"]),
        elevation: z.enum(["flat", "subtle", "raised", "floating"]),
      })
      .strict(),
    controls: z
      .object({
        primaryAction: z.enum(["solid", "outline", "quiet"]),
        secondaryAction: z.enum(["outline", "quiet", "text"]),
        height: z.enum(["compact", "standard", "prominent"]),
        density: densitySchema,
        shape: z.enum(["square", "subtle", "rounded", "pill"]),
        emphasis: z.enum(["restrained", "balanced", "strong"]),
      })
      .strict(),
    density: z
      .object({
        posture: densitySchema,
        navigation: densitySchema,
        content: densitySchema,
        commerce: densitySchema,
      })
      .strict(),
    media: z
      .object({
        posture: z.enum(["restrained", "editorial", "product-led"]),
        ratio: z.enum(["natural", "square", "portrait", "landscape", "wide"]),
        crop: z.enum(["contain", "cover", "editorial"]),
        overlay: z.enum(["none", "subtle", "contrast", "gradient"]),
        prominence: z.enum(["supporting", "balanced", "leading", "immersive"]),
      })
      .strict(),
  })
  .strict()
  .superRefine((dna, context) => {
    const contrastPairs = [
      ["text", dna.colour.text, "page", dna.colour.page],
      ["text", dna.colour.text, "surface", dna.colour.surface],
      ["mutedText", dna.colour.mutedText, "page", dna.colour.page],
      ["mutedText", dna.colour.mutedText, "surface", dna.colour.surface],
      ["contrastText", dna.colour.contrastText, "contrastSurface", dna.colour.contrastSurface],
      [
        "primaryActionText",
        dna.colour.primaryActionText,
        "primaryAction",
        dna.colour.primaryAction,
      ],
      [
        "secondaryActionText",
        dna.colour.secondaryActionText,
        "secondaryAction",
        dna.colour.secondaryAction,
      ],
      ["success", dna.colour.success, "page", dna.colour.page],
      ["warning", dna.colour.warning, "page", dna.colour.page],
      ["unavailable", dna.colour.unavailable, "page", dna.colour.page],
    ] as const;
    for (const [foregroundRole, foreground, backgroundRole, background] of contrastPairs) {
      if (contrastRatio(foreground, background) < standardTextContrastMinimum) {
        context.addIssue({
          code: "custom",
          path: ["colour", foregroundRole],
          message: `${foregroundRole} must remain readable on ${backgroundRole}.`,
        });
      }
    }
    const roleFonts = Object.values(dna.typography.roles).map((role) => role.font);
    const serifCount = roleFonts.filter(
      (font) => font === "georgia" || font === "system-serif",
    ).length;
    const displayAndHeadingAreSerif = [
      dna.typography.roles.display.font,
      dna.typography.roles.heading.font,
    ].every((font) => font === "georgia" || font === "system-serif");
    if (dna.typography.pairing === "serif-led" && !displayAndHeadingAreSerif) {
      context.addIssue({
        code: "custom",
        path: ["typography", "pairing"],
        message: "A serif-led pairing requires serif authority for display and heading roles.",
      });
    }
    if (dna.typography.pairing === "sans-led" && serifCount > 0) {
      context.addIssue({
        code: "custom",
        path: ["typography", "pairing"],
        message: "A sans-led pairing cannot contain an unregistered serif role exception.",
      });
    }
  });

export type DesignDna = z.infer<typeof designDnaSchema>;

export type LegacyBrandFoundation = Readonly<{
  colors: Readonly<{
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
  }>;
  typography: Readonly<{
    headingFont: FontToken;
    bodyFont: FontToken;
    baseSize: number;
    scaleRatio: number;
    headingWeight: z.infer<typeof weightSchema>;
    bodyWeight: 400 | 500;
  }>;
  shape: Readonly<{ radius: "square" | "subtle" | "rounded" | "pill" }>;
  spacing: Readonly<{ density: "airy" | "balanced" | "compact" }>;
  imagery: Readonly<{
    style: "studio" | "lifestyle" | "editorial" | "product-focused" | "mixed";
  }>;
  visualSystem?: Readonly<{
    contentWidth: "narrow" | "standard" | "wide";
    surface: "quiet" | "layered" | "contrast";
    divider: "none" | "subtle" | "strong";
    buttonHierarchy: "quiet" | "balanced" | "strong";
    imageTreatment: "contained" | "crop" | "editorial";
    borderTreatment?: "none" | "subtle" | "defined";
    surfaceDepth?: "flat" | "subtle" | "layered";
    imageAspect?: "natural" | "portrait" | "landscape" | "square";
    cropTreatment?: "contain" | "cover" | "editorial";
  }>;
  semanticPresentation?: Readonly<{
    emphasis: string;
    success: string;
    warning: string;
    unavailable: string;
  }>;
}>;

export const approvedFontStacks: Readonly<Record<FontToken, string>> = {
  inter: '"Inter", "Arial", sans-serif',
  georgia: '"Georgia", "Times New Roman", serif',
  "system-sans": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "system-serif": 'Georgia, Cambria, "Times New Roman", serif',
};

function hexChannels(value: string): [number, number, number] {
  const normalized = colorSchema.parse(value);
  return [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function mixHex(foreground: string, background: string, foregroundWeight: number): string {
  const left = hexChannels(foreground);
  const right = hexChannels(background);
  return `#${left
    .map((channel, index) =>
      Math.round(channel * foregroundWeight + right[index] * (1 - foregroundWeight))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}

function squaredChannelDistance(left: string, right: string): number {
  const leftChannels = hexChannels(left);
  const rightChannels = hexChannels(right);
  return leftChannels.reduce(
    (total, channel, index) => total + (channel - rightChannels[index]) ** 2,
    0,
  );
}

function isReadableAcross(foreground: string, backgrounds: readonly string[]): boolean {
  return backgrounds.every(
    (background) => contrastRatio(foreground, background) >= standardTextContrastMinimum,
  );
}

/**
 * Resolves one deterministic foreground for every supplied background.
 *
 * Supplied semantic colours retain their declared priority. Only when none are
 * valid does the bounded 256-step neutral ramp select the closest valid colour
 * to the merchant's original foreground.
 */
export function readableForegroundAcrossBackgrounds(
  backgrounds: readonly string[],
  preferred: readonly string[],
): string {
  if (backgrounds.length === 0 || preferred.length === 0) {
    throw new Error("Readable foreground resolution requires backgrounds and a preferred colour.");
  }
  const normalizedBackgrounds = [...new Set(backgrounds.map((value) => colorSchema.parse(value)))];
  const supplied = [...new Set(preferred.map((value) => colorSchema.parse(value)))];
  const suppliedMatch = supplied.find((candidate) =>
    isReadableAcross(candidate, normalizedBackgrounds),
  );
  if (suppliedMatch !== undefined) return suppliedMatch;

  const original = supplied[0];
  const derived = Array.from({ length: 256 }, (_, channel) => {
    const pair = channel.toString(16).padStart(2, "0").toUpperCase();
    const colour = `#${pair}${pair}${pair}`;
    return {
      colour,
      distance: squaredChannelDistance(colour, original),
      minimumContrast: Math.min(
        ...normalizedBackgrounds.map((background) => contrastRatio(colour, background)),
      ),
    };
  })
    .filter(({ colour }) => isReadableAcross(colour, normalizedBackgrounds))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        right.minimumContrast - left.minimumContrast ||
        left.colour.localeCompare(right.colour),
    );
  if (derived.length === 0) {
    throw new Error("No bounded foreground satisfies every required background contrast.");
  }
  return derived[0].colour;
}

function readableForeground(background: string, preferred: readonly string[]): string {
  return readableForegroundAcrossBackgrounds([background], preferred);
}

function readableStatus(preferred: string, page: string, fallback: string): string {
  return contrastRatio(preferred, page) >= standardTextContrastMinimum
    ? preferred
    : readableForeground(page, [fallback, preferred]);
}

function closestReadableSurface(
  preferredSurface: string,
  page: string,
  foreground: string,
): string {
  for (let step = 255; step >= 0; step -= 1) {
    const candidate = mixHex(preferredSurface, page, step / 255);
    if (contrastRatio(foreground, candidate) >= standardTextContrastMinimum) return candidate;
  }
  throw new Error("Legacy semantic surfaces cannot satisfy the Design DNA contrast contract.");
}

function legacyTypographyPairing(input: LegacyBrandFoundation): DesignDna["typography"]["pairing"] {
  const headingSerif = ["georgia", "system-serif"].includes(input.typography.headingFont);
  const bodySerif = ["georgia", "system-serif"].includes(input.typography.bodyFont);
  if (headingSerif && !bodySerif) return "serif-led";
  if (!headingSerif && !bodySerif) return "sans-led";
  return "mixed";
}

function weightPosture(weight: number): DesignDna["typography"]["weightPosture"] {
  if (weight <= 400) return "regular";
  if (weight === 500) return "medium";
  return "strong";
}

export function migrateLegacyFoundationToDesignDna(input: LegacyBrandFoundation): DesignDna {
  const visual = input.visualSystem ?? {
    contentWidth: "wide" as const,
    surface: "layered" as const,
    divider: "subtle" as const,
    buttonHierarchy: "balanced" as const,
    imageTreatment: "editorial" as const,
  };
  const semantic = input.semanticPresentation ?? {
    emphasis: input.colors.accent,
    success: "#237A45",
    warning: "#9A5B13",
    unavailable: input.colors.mutedText,
  };
  const textCandidates = [
    input.colors.text,
    input.colors.mutedText,
    input.colors.primary,
    input.colors.secondary,
    input.colors.accent,
    input.colors.border,
  ];
  let surface = input.colors.surface;
  let text: string;
  try {
    text = readableForegroundAcrossBackgrounds([input.colors.background, surface], textCandidates);
  } catch {
    text = readableForeground(input.colors.background, textCandidates);
    surface = closestReadableSurface(surface, input.colors.background, text);
  }
  const requiredTextBackgrounds = [input.colors.background, surface];
  const mutedText = readableForegroundAcrossBackgrounds(requiredTextBackgrounds, [
    input.colors.mutedText,
    text,
    input.colors.text,
    input.colors.border,
    input.colors.secondary,
  ]);
  const contrastSurface = input.colors.secondary;
  const density =
    input.spacing.density === "airy"
      ? "spacious"
      : input.spacing.density === "compact"
        ? "compact"
        : "balanced";
  const spacingScale = input.spacing.density === "airy" ? "generous" : input.spacing.density;
  const mediaPosture =
    input.imagery.style === "product-focused" || input.imagery.style === "studio"
      ? "product-led"
      : input.imagery.style === "editorial"
        ? "editorial"
        : "restrained";
  const border = visual.borderTreatment ?? visual.divider;
  const elevation =
    visual.surfaceDepth === "layered"
      ? "raised"
      : visual.surfaceDepth === "subtle"
        ? "subtle"
        : "flat";
  const dna = {
    version: designDnaVersion,
    colour: {
      page: input.colors.background,
      surface,
      mutedSurface: mixHex(surface, input.colors.background, 0.72),
      contrastSurface,
      text,
      mutedText,
      contrastText: readableForeground(contrastSurface, [surface, text]),
      border: input.colors.border,
      accent: input.colors.accent,
      primaryAction: input.colors.primary,
      primaryActionText: readableForeground(input.colors.primary, [surface, text]),
      secondaryAction: input.colors.secondary,
      secondaryActionText: readableForeground(input.colors.secondary, [surface, text]),
      success: readableStatus(semantic.success, input.colors.background, text),
      warning: readableStatus(semantic.warning, input.colors.background, text),
      unavailable: readableStatus(semantic.unavailable, input.colors.background, mutedText),
      surfaceRelationship: visual.surface,
      actionRelationship:
        visual.buttonHierarchy === "strong"
          ? "dual"
          : visual.buttonHierarchy === "quiet"
            ? "accent-led"
            : "primary-led",
    },
    typography: {
      pairing: legacyTypographyPairing(input),
      scale: {
        posture:
          input.typography.scaleRatio < 1.2
            ? "compact"
            : input.typography.scaleRatio >= 1.35
              ? "expressive"
              : "balanced",
        ratio: input.typography.scaleRatio,
      },
      weightPosture: weightPosture(input.typography.headingWeight),
      lineHeightPosture: "balanced",
      trackingPosture: "normal",
      roles: {
        display: {
          font: input.typography.headingFont,
          scaleStep: 5,
          weight: input.typography.headingWeight,
          lineHeight: "tight",
          tracking: "tight",
        },
        heading: {
          font: input.typography.headingFont,
          scaleStep: 3,
          weight: input.typography.headingWeight,
          lineHeight: "tight",
          tracking: "tight",
        },
        body: {
          font: input.typography.bodyFont,
          scaleStep: 0,
          weight: input.typography.bodyWeight,
          lineHeight: "balanced",
          tracking: "normal",
        },
        utility: {
          font: input.typography.bodyFont,
          scaleStep: -1,
          weight: 500,
          lineHeight: "balanced",
          tracking: "open",
        },
        price: {
          font: input.typography.bodyFont,
          scaleStep: 1,
          weight: 700,
          lineHeight: "tight",
          tracking: "normal",
        },
      },
    },
    spacing: {
      scale: spacingScale,
      sectionRhythm:
        input.spacing.density === "airy"
          ? "expansive"
          : input.spacing.density === "compact"
            ? "compact"
            : "balanced",
      pageGutter:
        input.spacing.density === "airy"
          ? "generous"
          : input.spacing.density === "compact"
            ? "compact"
            : "standard",
      gridGap:
        input.spacing.density === "airy"
          ? "open"
          : input.spacing.density === "compact"
            ? "tight"
            : "standard",
      cardInset:
        input.spacing.density === "airy"
          ? "generous"
          : input.spacing.density === "compact"
            ? "compact"
            : "standard",
      containers: {
        reading: "narrow",
        content: visual.contentWidth === "wide" ? "wide" : "standard",
        commerce: visual.contentWidth === "wide" ? "wide" : "standard",
        wide: visual.contentWidth === "wide" ? "full" : "wide",
        fullWidth: "contained",
      },
    },
    surfaces: {
      posture: visual.surface,
      border: border === "defined" ? "defined" : border,
      radius: input.shape.radius,
      elevation,
    },
    controls: {
      primaryAction:
        visual.buttonHierarchy === "quiet"
          ? "quiet"
          : visual.buttonHierarchy === "strong"
            ? "solid"
            : "solid",
      secondaryAction: visual.buttonHierarchy === "quiet" ? "text" : "outline",
      height: input.spacing.density === "airy" ? "prominent" : "standard",
      density,
      shape: input.shape.radius,
      emphasis:
        visual.buttonHierarchy === "strong"
          ? "strong"
          : visual.buttonHierarchy === "quiet"
            ? "restrained"
            : "balanced",
    },
    density: { posture: density, navigation: density, content: density, commerce: density },
    media: {
      posture: mediaPosture,
      ratio: visual.imageAspect ?? "natural",
      crop:
        visual.cropTreatment ??
        (visual.imageTreatment === "contained"
          ? "contain"
          : visual.imageTreatment === "editorial"
            ? "editorial"
            : "cover"),
      overlay: visual.surface === "contrast" ? "contrast" : "none",
      prominence:
        visual.imageTreatment === "editorial"
          ? "leading"
          : visual.imageTreatment === "crop"
            ? "immersive"
            : "balanced",
    },
  } satisfies DesignDna;
  return designDnaSchema.parse(dna);
}

export function normalizeDesignDna(input: unknown): DesignDna {
  return designDnaSchema.parse(structuredClone(input));
}

export function designDnaFingerprint(input: unknown): string {
  const dna = normalizeDesignDna(input);
  return `design-dna-${canonicalValueFingerprint(dna)}`;
}

const scaleMultiplier = { compact: 0.92, balanced: 1, expressive: 1.08 } as const;
const lineHeightValue = { tight: "1.05", balanced: "1.5", relaxed: "1.7" } as const;
const trackingValue = { tight: "-0.025em", normal: "0", open: "0.08em" } as const;
const spacingScaleValue = { compact: "0.875", balanced: "1", generous: "1.2" } as const;
const sectionRhythmValue = {
  compact: "clamp(2.5rem, 5vw, 4rem)",
  balanced: "clamp(4rem, 8vw, 7rem)",
  expansive: "clamp(5.5rem, 10vw, 9rem)",
} as const;
const pageGutterValue = {
  compact: "clamp(1rem, 3vw, 2rem)",
  standard: "clamp(1rem, 5vw, 5rem)",
  generous: "clamp(1.25rem, 7vw, 7rem)",
} as const;
const gridGapValue = { tight: "0.75rem", standard: "1.5rem", open: "2.25rem" } as const;
const cardInsetValue = {
  compact: "0.75rem",
  standard: "1.25rem",
  generous: "2rem",
} as const;
const radiusValue = {
  square: "0rem",
  subtle: "0.375rem",
  rounded: "0.75rem",
  pill: "9999px",
} as const;
const shadowValue = {
  flat: "none",
  subtle: "0 1px 2px rgb(0 0 0 / 8%)",
  raised: "0 0.75rem 2rem rgb(0 0 0 / 12%)",
  floating: "0 1.5rem 4rem rgb(0 0 0 / 18%)",
} as const;
const controlHeightValue = {
  compact: "2.5rem",
  standard: "2.75rem",
  prominent: "3.25rem",
} as const;
const densityValue = { compact: "0.86", balanced: "1", spacious: "1.16" } as const;
const ratioValue = {
  natural: "auto",
  square: "1 / 1",
  portrait: "4 / 5",
  landscape: "4 / 3",
  wide: "16 / 9",
} as const;
const cropValue = { contain: "contain", cover: "cover", editorial: "cover" } as const;
const overlayValue = { none: "0", subtle: "0.16", contrast: "0.42", gradient: "0.28" } as const;
const prominenceValue = {
  supporting: "0.8",
  balanced: "1",
  leading: "1.18",
  immersive: "1.35",
} as const;
const borderWidthValue = { none: "0", subtle: "1px", defined: "1px", strong: "2px" } as const;
const weightEmphasisValue = { restrained: "600", balanced: "700", strong: "800" } as const;

function typeSize(
  baseSize: number,
  ratio: number,
  step: number,
  posture: keyof typeof scaleMultiplier,
) {
  return `${((baseSize / 16) * ratio ** step * scaleMultiplier[posture]).toFixed(4)}rem`;
}

function controlProjection(dna: DesignDna) {
  const primaryTransparentText = readableForeground(dna.colour.page, [
    dna.colour.primaryAction,
    dna.colour.text,
  ]);
  const secondaryTransparentText = readableForeground(dna.colour.page, [
    dna.colour.secondaryAction,
    dna.colour.text,
  ]);
  const primary =
    dna.controls.primaryAction === "solid"
      ? {
          background: dna.colour.primaryAction,
          border: dna.colour.primaryAction,
          text: dna.colour.primaryActionText,
        }
      : dna.controls.primaryAction === "outline"
        ? {
            background: "transparent",
            border: dna.colour.primaryAction,
            text: primaryTransparentText,
          }
        : { background: "transparent", border: "transparent", text: primaryTransparentText };
  const secondary =
    dna.controls.secondaryAction === "outline"
      ? {
          background: "transparent",
          border: dna.colour.secondaryAction,
          text: secondaryTransparentText,
        }
      : dna.controls.secondaryAction === "quiet"
        ? {
            background: dna.colour.mutedSurface,
            border: "transparent",
            text: dna.colour.text,
          }
        : { background: "transparent", border: "transparent", text: secondaryTransparentText };
  return { primary, secondary };
}

export type EffectiveDesignDnaProjection = Readonly<{
  version: typeof designDnaVersion;
  designDnaFingerprint: string;
  appliesTo: readonly ["sharedFrame", "home", "collection", "product"];
  cssVariables: Readonly<Record<string, string>>;
  fingerprint: string;
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

export function projectDesignDna(input: unknown, baseSize = 16): EffectiveDesignDnaProjection {
  const dna = normalizeDesignDna(input);
  const actions = controlProjection(dna);
  const display = dna.typography.roles.display;
  const heading = dna.typography.roles.heading;
  const body = dna.typography.roles.body;
  const utility = dna.typography.roles.utility;
  const price = dna.typography.roles.price;
  const cssVariables = {
    "--brand-color-primary": dna.colour.primaryAction,
    "--brand-color-secondary": dna.colour.secondaryAction,
    "--brand-color-accent": dna.colour.accent,
    "--brand-color-background": dna.colour.page,
    "--brand-color-surface": dna.colour.surface,
    "--brand-color-text": dna.colour.text,
    "--brand-color-muted-text": dna.colour.mutedText,
    "--brand-color-border": dna.colour.border,
    "--brand-surface-page": dna.colour.page,
    "--brand-surface-default": dna.colour.surface,
    "--brand-surface-muted": dna.colour.mutedSurface,
    "--brand-surface-contrast": dna.colour.contrastSurface,
    "--brand-surface-page-text": dna.colour.text,
    "--brand-surface-page-muted-text": dna.colour.mutedText,
    "--brand-surface-default-text": dna.colour.text,
    "--brand-surface-default-muted-text": dna.colour.mutedText,
    "--brand-surface-muted-text": readableForeground(dna.colour.mutedSurface, [
      dna.colour.text,
      dna.colour.mutedText,
    ]),
    "--brand-surface-contrast-text": dna.colour.contrastText,
    "--brand-surface-contrast-muted-text": dna.colour.contrastText,
    // The paired ring uses existing validated light/dark semantic roles. One
    // edge therefore remains visible on page, surface and contrast regions
    // without inventing another merchant palette authority.
    "--brand-focus-ring-inner": dna.colour.text,
    "--brand-focus-ring-outer": dna.colour.contrastText,
    "--brand-action-primary": actions.primary.background,
    "--brand-action-primary-background": actions.primary.background,
    "--brand-action-primary-border": actions.primary.border,
    "--brand-action-primary-text": actions.primary.text,
    "--brand-control-primary-background": actions.primary.background,
    "--brand-control-primary-border": actions.primary.border,
    "--brand-control-primary-text": actions.primary.text,
    "--brand-control-primary-context-text": readableForegroundAcrossBackgrounds(
      [dna.colour.page, dna.colour.surface],
      [dna.colour.primaryAction, dna.colour.text],
    ),
    "--brand-control-primary-surface": dna.colour.primaryAction,
    "--brand-control-primary-surface-text": dna.colour.primaryActionText,
    "--brand-action-secondary-background": actions.secondary.background,
    "--brand-action-secondary-border": actions.secondary.border,
    "--brand-action-secondary-text": actions.secondary.text,
    "--brand-control-secondary-background": actions.secondary.background,
    "--brand-control-secondary-border": actions.secondary.border,
    "--brand-control-secondary-text": actions.secondary.text,
    "--brand-control-secondary-context-text": readableForegroundAcrossBackgrounds(
      [dna.colour.page, dna.colour.surface],
      [dna.colour.secondaryAction, dna.colour.text],
    ),
    "--brand-control-secondary-surface": dna.colour.secondaryAction,
    "--brand-control-secondary-surface-text": dna.colour.secondaryActionText,
    "--brand-highlight": dna.colour.accent,
    "--brand-highlight-text": readableForeground(dna.colour.accent, [
      dna.colour.text,
      dna.colour.page,
    ]),
    "--brand-color-emphasis": dna.colour.accent,
    "--brand-color-success": dna.colour.success,
    "--brand-color-warning": dna.colour.warning,
    "--brand-color-unavailable": dna.colour.unavailable,
    "--brand-font-display": approvedFontStacks[display.font],
    "--brand-font-heading": approvedFontStacks[heading.font],
    "--brand-font-body": approvedFontStacks[body.font],
    "--brand-font-utility": approvedFontStacks[utility.font],
    "--brand-font-price": approvedFontStacks[price.font],
    "--brand-type-base-size": `${baseSize}px`,
    "--brand-type-scale-ratio": String(dna.typography.scale.ratio),
    "--brand-type-display-size": typeSize(
      baseSize,
      dna.typography.scale.ratio,
      display.scaleStep,
      dna.typography.scale.posture,
    ),
    "--brand-type-heading-size": typeSize(
      baseSize,
      dna.typography.scale.ratio,
      heading.scaleStep,
      dna.typography.scale.posture,
    ),
    "--brand-type-body-size": typeSize(
      baseSize,
      dna.typography.scale.ratio,
      body.scaleStep,
      dna.typography.scale.posture,
    ),
    "--brand-type-utility-size": typeSize(
      baseSize,
      dna.typography.scale.ratio,
      utility.scaleStep,
      dna.typography.scale.posture,
    ),
    "--brand-type-price-size": typeSize(
      baseSize,
      dna.typography.scale.ratio,
      price.scaleStep,
      dna.typography.scale.posture,
    ),
    "--brand-type-display-weight": String(display.weight),
    "--brand-type-heading-weight": String(heading.weight),
    "--brand-type-body-weight": String(body.weight),
    "--brand-type-utility-weight": String(utility.weight),
    "--brand-type-price-weight": String(price.weight),
    "--brand-type-display-line-height": lineHeightValue[display.lineHeight],
    "--brand-type-heading-line-height": lineHeightValue[heading.lineHeight],
    "--brand-type-body-line-height": lineHeightValue[body.lineHeight],
    "--brand-type-utility-line-height": lineHeightValue[utility.lineHeight],
    "--brand-type-price-line-height": lineHeightValue[price.lineHeight],
    "--brand-type-display-tracking": trackingValue[display.tracking],
    "--brand-type-heading-tracking": trackingValue[heading.tracking],
    "--brand-type-body-tracking": trackingValue[body.tracking],
    "--brand-type-utility-tracking": trackingValue[utility.tracking],
    "--brand-type-price-tracking": trackingValue[price.tracking],
    "--brand-spacing-scale": spacingScaleValue[dna.spacing.scale],
    "--brand-section-rhythm": sectionRhythmValue[dna.spacing.sectionRhythm],
    "--brand-page-gutter": pageGutterValue[dna.spacing.pageGutter],
    "--brand-grid-gap": gridGapValue[dna.spacing.gridGap],
    "--brand-card-inset": cardInsetValue[dna.spacing.cardInset],
    "--brand-container-reading": dna.spacing.containers.reading === "narrow" ? "38rem" : "44rem",
    "--brand-container-content": dna.spacing.containers.content === "wide" ? "92rem" : "78rem",
    "--brand-container-commerce": dna.spacing.containers.commerce === "wide" ? "90rem" : "80rem",
    "--brand-container-wide": dna.spacing.containers.wide === "full" ? "100rem" : "92rem",
    "--brand-container-full":
      dna.spacing.containers.fullWidth === "edge-to-edge" ? "100%" : "100rem",
    "--brand-border-width": borderWidthValue[dna.surfaces.border],
    "--brand-radius": radiusValue[dna.surfaces.radius],
    "--brand-control-radius": radiusValue[dna.controls.shape],
    "--brand-elevation-shadow": shadowValue[dna.surfaces.elevation],
    "--brand-control-height": controlHeightValue[dna.controls.height],
    "--brand-control-padding-inline":
      dna.controls.density === "compact"
        ? "0.75rem"
        : dna.controls.density === "spacious"
          ? "1.5rem"
          : "1rem",
    "--brand-control-emphasis": weightEmphasisValue[dna.controls.emphasis],
    "--brand-density-global": densityValue[dna.density.posture],
    "--brand-density-navigation": densityValue[dna.density.navigation],
    "--brand-density-content": densityValue[dna.density.content],
    "--brand-density-commerce": densityValue[dna.density.commerce],
    "--brand-media-ratio": ratioValue[dna.media.ratio],
    "--brand-media-crop": cropValue[dna.media.crop],
    "--brand-media-overlay-opacity": overlayValue[dna.media.overlay],
    "--brand-media-prominence": prominenceValue[dna.media.prominence],
    "--brand-design-dna-version": dna.version,
    "--brand-design-dna-fingerprint": designDnaFingerprint(dna),
  };
  const content = {
    version: designDnaVersion,
    designDnaFingerprint: designDnaFingerprint(dna),
    appliesTo: ["sharedFrame", "home", "collection", "product"] as const,
    cssVariables,
  };
  return deepFreeze({
    ...content,
    fingerprint: `design-dna-projection-${canonicalValueFingerprint(content)}`,
  });
}

const sharedExampleColour = {
  page: "#FFFAF3",
  surface: "#FFFFFF",
  mutedSurface: "#F4ECE1",
  contrastSurface: "#1F2A44",
  text: "#1D1A16",
  mutedText: "#5F574F",
  contrastText: "#FFFFFF",
  border: "#8A8178",
  accent: "#8A5A2B",
  primaryAction: "#6F431E",
  primaryActionText: "#FFFFFF",
  secondaryAction: "#1F2A44",
  secondaryActionText: "#FFFFFF",
  success: "#237A45",
  warning: "#8A4B08",
  unavailable: "#5F574F",
  surfaceRelationship: "layered",
  actionRelationship: "dual",
} as const;

export const premiumEditorialDesignDna = designDnaSchema.parse({
  version: designDnaVersion,
  colour: sharedExampleColour,
  typography: {
    pairing: "serif-led",
    scale: { posture: "expressive", ratio: 1.333 },
    weightPosture: "medium",
    lineHeightPosture: "relaxed",
    trackingPosture: "tight",
    roles: {
      display: {
        font: "georgia",
        scaleStep: 5,
        weight: 500,
        lineHeight: "tight",
        tracking: "tight",
      },
      heading: {
        font: "georgia",
        scaleStep: 3,
        weight: 600,
        lineHeight: "tight",
        tracking: "tight",
      },
      body: { font: "inter", scaleStep: 0, weight: 400, lineHeight: "relaxed", tracking: "normal" },
      utility: {
        font: "inter",
        scaleStep: -1,
        weight: 500,
        lineHeight: "balanced",
        tracking: "open",
      },
      price: {
        font: "georgia",
        scaleStep: 1,
        weight: 600,
        lineHeight: "tight",
        tracking: "normal",
      },
    },
  },
  spacing: {
    scale: "generous",
    sectionRhythm: "expansive",
    pageGutter: "generous",
    gridGap: "open",
    cardInset: "generous",
    containers: {
      reading: "narrow",
      content: "wide",
      commerce: "wide",
      wide: "full",
      fullWidth: "contained",
    },
  },
  surfaces: { posture: "layered", border: "subtle", radius: "subtle", elevation: "raised" },
  controls: {
    primaryAction: "solid",
    secondaryAction: "outline",
    height: "prominent",
    density: "spacious",
    shape: "subtle",
    emphasis: "balanced",
  },
  density: {
    posture: "spacious",
    navigation: "spacious",
    content: "spacious",
    commerce: "balanced",
  },
  media: {
    posture: "editorial",
    ratio: "portrait",
    crop: "editorial",
    overlay: "gradient",
    prominence: "leading",
  },
});

export const modernTechnicalDesignDna = designDnaSchema.parse({
  version: designDnaVersion,
  colour: sharedExampleColour,
  typography: {
    pairing: "sans-led",
    scale: { posture: "compact", ratio: 1.16 },
    weightPosture: "strong",
    lineHeightPosture: "balanced",
    trackingPosture: "normal",
    roles: {
      display: { font: "inter", scaleStep: 4, weight: 700, lineHeight: "tight", tracking: "tight" },
      heading: {
        font: "inter",
        scaleStep: 2,
        weight: 700,
        lineHeight: "tight",
        tracking: "normal",
      },
      body: {
        font: "system-sans",
        scaleStep: 0,
        weight: 400,
        lineHeight: "balanced",
        tracking: "normal",
      },
      utility: {
        font: "system-sans",
        scaleStep: -1,
        weight: 600,
        lineHeight: "tight",
        tracking: "open",
      },
      price: { font: "inter", scaleStep: 1, weight: 700, lineHeight: "tight", tracking: "normal" },
    },
  },
  spacing: {
    scale: "compact",
    sectionRhythm: "compact",
    pageGutter: "compact",
    gridGap: "tight",
    cardInset: "compact",
    containers: {
      reading: "standard",
      content: "standard",
      commerce: "standard",
      wide: "wide",
      fullWidth: "contained",
    },
  },
  surfaces: { posture: "quiet", border: "defined", radius: "square", elevation: "flat" },
  controls: {
    primaryAction: "solid",
    secondaryAction: "text",
    height: "compact",
    density: "compact",
    shape: "square",
    emphasis: "strong",
  },
  density: {
    posture: "compact",
    navigation: "compact",
    content: "compact",
    commerce: "compact",
  },
  media: {
    posture: "product-led",
    ratio: "square",
    crop: "contain",
    overlay: "none",
    prominence: "balanced",
  },
});
