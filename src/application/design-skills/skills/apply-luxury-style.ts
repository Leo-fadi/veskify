import type { DesignSkillDefinition } from "../contract";
import {
  createStyleOperations,
  luxuryShape,
  luxuryTypography,
  operationArraySchema,
  protectedDesignPaths,
  requiredValidationRules,
} from "./shared";

const luxuryVariants: Readonly<Record<string, string>> = {
  announcementBar: "minimal",
  header: "transparent",
  featuredCategories: "imageLed",
  productGrid: "editorial",
  campaignBanner: "imageOverlay",
  brandStory: "imageLed",
  benefitIcons: "minimal",
  newsletter: "card",
  footer: "editorial",
};

export const applyLuxuryStyleSkill: DesignSkillDefinition = {
  id: "applyLuxuryStyle",
  version: "1.0.0",
  title: { en: "Refine the luxury direction", fi: "Viimeistele ylellinen ilme" },
  description: {
    en: "Uses the existing palette, approved variants and controlled style tokens.",
    fi: "Käyttää nykyistä väripalettia, hyväksyttyjä versioita ja hallittuja tyylivalintoja.",
  },
  supportedIntents: ["luxuryStyle"],
  scope: "page",
  supportedPageTypes: ["home", "landing"],
  requiredContext: ["activeLocale", "page", "brandSystem"],
  optionalContext: ["selectedSection", "catalogue"],
  allowedComponentTypes: [
    "announcementBar",
    "header",
    "hero",
    "featuredCategories",
    "productGrid",
    "campaignBanner",
    "brandStory",
    "benefitIcons",
    "newsletter",
    "footer",
  ],
  allowedOperationTypes: [
    "CHANGE_SECTION_VARIANT",
    "CHANGE_BACKGROUND",
    "CHANGE_TYPOGRAPHY",
    "CHANGE_DENSITY",
    "CHANGE_SHAPE",
  ],
  protectedPaths: [...protectedDesignPaths],
  preconditions: [{ type: "pageTypeSupported" }],
  outputSchema: operationArraySchema,
  validationRules: requiredValidationRules,
  execute: ({ page, brandSystem }) =>
    createStyleOperations(page, {
      variants: luxuryVariants,
      background: (section, index) =>
        section.component === "campaignBanner" || index % 3 === 0 ? "surface" : "background",
      typography: luxuryTypography(brandSystem),
      density: "spacious",
      shape: luxuryShape(brandSystem),
    }),
  summarize: ({ operationCount }) => ({
    en: `Refine the page with ${operationCount} approved luxury-style adjustments while keeping the existing brand palette.`,
    fi: `Viimeistele sivu ${operationCount} hyväksytyllä ylellisen tyylin muutoksella nykyinen väripaletti säilyttäen.`,
  }),
};
