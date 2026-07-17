import type { DesignSkillDefinition } from "../contract";
import {
  createStyleOperations,
  minimalShape,
  operationArraySchema,
  protectedDesignPaths,
  requiredValidationRules,
} from "./shared";

const minimalVariants: Readonly<Record<string, string>> = {
  announcementBar: "minimal",
  header: "compact",
  featuredCategories: "grid",
  productGrid: "standard",
  campaignBanner: "minimal",
  brandStory: "minimal",
  benefitIcons: "minimal",
  newsletter: "inline",
  footer: "compact",
};

export const applyMinimalNordicStyleSkill: DesignSkillDefinition = {
  id: "applyMinimalNordicStyle",
  version: "1.0.0",
  title: { en: "Simplify the Nordic layout", fi: "Pelkistä pohjoismainen asettelu" },
  description: {
    en: "Reduces decorative emphasis and adds controlled whitespace with approved presets.",
    fi: "Vähentää koristeellisuutta ja lisää hallittua väljyyttä hyväksytyillä valinnoilla.",
  },
  supportedIntents: ["minimalNordicStyle"],
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
      variants: minimalVariants,
      background: (_section, index) => (index % 4 === 0 ? "surface" : "background"),
      typography: "sans",
      density: "spacious",
      shape: minimalShape(brandSystem),
    }),
  summarize: ({ operationCount }) => ({
    en: `Simplify the layout with ${operationCount} approved Nordic-style adjustments and more controlled whitespace.`,
    fi: `Pelkistä asettelua ${operationCount} hyväksytyllä pohjoismaisen tyylin muutoksella ja lisää hallittua väljyyttä.`,
  }),
};
