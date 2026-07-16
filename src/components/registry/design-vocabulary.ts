import { z } from "zod";

export const designVocabularyVariants = {
  announcementBar: ["singleLine", "rotating", "minimal", "bold"],
  header: ["centered", "split", "compact", "transparent"],
  featuredCategories: ["grid", "editorialCards", "carousel", "imageLed"],
  productGrid: ["standard", "editorial", "compact"],
  campaignBanner: ["imageOverlay", "split", "minimal"],
  imageText: ["imageLeft", "imageRight", "stacked"],
  brandStory: ["editorial", "timeline", "founder", "minimal", "imageLed"],
  benefitIcons: ["threeColumn", "fourColumn", "minimal", "cards"],
  newsletter: ["inline", "card", "fullWidth"],
  footer: ["columns", "editorial", "compact"],
} as const;

export const designVocabularyDefaults = {
  announcementBar: "singleLine",
  header: "centered",
  featuredCategories: "editorialCards",
  productGrid: "editorial",
  campaignBanner: "split",
  imageText: "imageRight",
  brandStory: "editorial",
  benefitIcons: "threeColumn",
  newsletter: "inline",
  footer: "columns",
} as const;

export const sectionBackgroundSchema = z.enum([
  "inherit",
  "background",
  "surface",
  "primary",
  "secondary",
  "accent",
]);
export const sectionDensitySchema = z.enum(["compact", "standard", "spacious"]);
export const sectionTypographySchema = z.enum(["inherit", "serif", "sans", "strong"]);
export const sectionShapeSchema = z.enum(["inherit", "square", "soft", "rounded"]);
export const sectionAlignmentSchema = z.enum(["left", "center"]);
export const ctaPresentationSchema = z.enum(["primary", "secondary", "text"]);

export const sectionForegroundByBackground = {
  inherit: "inherit",
  background: "text",
  surface: "text",
  primary: "surface",
  secondary: "surface",
  accent: "text",
} as const satisfies Record<
  z.infer<typeof sectionBackgroundSchema>,
  "inherit" | "text" | "surface"
>;

export const sectionStyleSchema = {
  background: sectionBackgroundSchema.default("inherit"),
  density: sectionDensitySchema.default("standard"),
  typography: sectionTypographySchema.default("inherit"),
  shape: sectionShapeSchema.default("inherit"),
};

export type SectionStyle = {
  background?: z.input<typeof sectionBackgroundSchema>;
  density?: z.input<typeof sectionDensitySchema>;
  typography?: z.input<typeof sectionTypographySchema>;
  shape?: z.input<typeof sectionShapeSchema>;
  alignment?: z.input<typeof sectionAlignmentSchema>;
};

export function sectionVocabularyClass(variant: string, style: SectionStyle = {}) {
  const background = style.background ?? "inherit";
  return [
    "store-vocabulary",
    `store-variant--${variant}`,
    `store-background--${background}`,
    `store-foreground--${sectionForegroundByBackground[background]}`,
    `store-density--${style.density ?? "standard"}`,
    `store-typography--${style.typography ?? "inherit"}`,
    `store-shape--${style.shape ?? "inherit"}`,
    `store-alignment--${style.alignment ?? "left"}`,
  ].join(" ");
}

export const sectionStyleEditorFields = {
  background: {
    source: "props" as const,
    control: "select" as const,
    label: "Section background",
    options: sectionBackgroundSchema.options.map((value) => ({ label: value, value })),
  },
  density: {
    source: "props" as const,
    control: "select" as const,
    label: "Spacing density",
    options: sectionDensitySchema.options.map((value) => ({ label: value, value })),
  },
  typography: {
    source: "props" as const,
    control: "select" as const,
    label: "Typography preset",
    options: sectionTypographySchema.options.map((value) => ({ label: value, value })),
  },
  shape: {
    source: "props" as const,
    control: "select" as const,
    label: "Shape treatment",
    options: sectionShapeSchema.options.map((value) => ({ label: value, value })),
  },
};

export const sectionAlignmentEditorField = {
  source: "props" as const,
  control: "select" as const,
  label: "Content alignment",
  options: [
    { label: "Left", value: "left" },
    { label: "Centre", value: "center" },
  ],
};

export const ctaPresentationEditorField = {
  source: "props" as const,
  control: "select" as const,
  label: "CTA presentation",
  options: [
    { label: "Primary", value: "primary" },
    { label: "Secondary", value: "secondary" },
    { label: "Text link", value: "text" },
  ],
};
