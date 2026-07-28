import { designOperationSchema, type DesignOperation } from "@/application/design-operations";
import { getComponentDefinition, type RegisteredComponentType } from "@/components/registry";
import type { BrandSystem } from "@/domain/design-system";
import type { PageModel } from "@/domain/storefront";
import type { DesignSkillDefinition } from "../contract";
import { operationArraySchema, protectedDesignPaths, requiredValidationRules } from "./shared";

export type StorefrontStyleDirection = "warmPremium" | "minimalNordic" | "warmApproachable";

export const storefrontStyleComponents = [
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
  "collectionHeader",
  "filterBar",
  "productGallery",
  "productInfo",
  "productOptions",
  "imageText",
  "relatedProducts",
] as const satisfies readonly RegisteredComponentType[];

export const storefrontStyleDesignSystems = {
  warmPremium: {
    colors: {
      primary: "#7B4A2D",
      secondary: "#2A1F1B",
      accent: "#C7975D",
      background: "#FFF9F3",
      surface: "#FFFFFF",
      text: "#211A17",
      mutedText: "#6C5B52",
      border: "#E3D3C7",
    },
    typography: {
      headingFont: "georgia",
      bodyFont: "inter",
      baseSize: 16,
      scaleRatio: 1.25,
      headingWeight: 600,
      bodyWeight: 400,
    },
    sectionTypography: "serif",
  },
  minimalNordic: {
    colors: {
      primary: "#243238",
      secondary: "#526168",
      accent: "#B18B5E",
      background: "#F7F8F6",
      surface: "#FFFFFF",
      text: "#172026",
      mutedText: "#5E6C76",
      border: "#D9DEDA",
    },
    typography: {
      headingFont: "system-sans",
      bodyFont: "inter",
      baseSize: 16,
      scaleRatio: 1.2,
      headingWeight: 600,
      bodyWeight: 400,
    },
    sectionTypography: "sans",
  },
  warmApproachable: {
    colors: {
      primary: "#8B573E",
      secondary: "#5E6B4E",
      accent: "#D69A62",
      background: "#FFF8F0",
      surface: "#FFFFFF",
      text: "#2A211D",
      mutedText: "#75645A",
      border: "#E7D6C7",
    },
    typography: {
      headingFont: "georgia",
      bodyFont: "system-sans",
      baseSize: 17,
      scaleRatio: 1.25,
      headingWeight: 600,
      bodyWeight: 400,
    },
    sectionTypography: "serif",
  },
} as const satisfies Record<
  StorefrontStyleDirection,
  {
    colors: BrandSystem["colors"];
    typography: BrandSystem["typography"];
    sectionTypography: "serif" | "sans";
  }
>;

export function createStorefrontStyleOperations(
  page: PageModel,
  direction: StorefrontStyleDirection,
): DesignOperation[] {
  const approved = storefrontStyleDesignSystems[direction];
  const operations: DesignOperation[] = [];
  page.sections.forEach((section, index) => {
    const definition = getComponentDefinition(section.component);
    if (definition.editorFields.background) {
      const background = index % 2 === 0 ? "background" : "surface";
      operations.push(
        designOperationSchema.parse({
          type: "CHANGE_BACKGROUND",
          sectionId: section.id,
          background,
        }),
      );
    }
    if (definition.editorFields.typography) {
      operations.push(
        designOperationSchema.parse({
          type: "CHANGE_TYPOGRAPHY",
          sectionId: section.id,
          typography: approved.sectionTypography,
        }),
      );
    }
  });
  return operations;
}

export function createStorefrontDesignSystemOperations(
  direction: StorefrontStyleDirection,
): DesignOperation[] {
  const approved = storefrontStyleDesignSystems[direction];
  return [
    designOperationSchema.parse({
      type: "APPLY_APPROVED_BRAND_COLOURS",
      colors: approved.colors,
    }),
    designOperationSchema.parse({
      type: "APPLY_APPROVED_BRAND_TYPOGRAPHY",
      typography: approved.typography,
    }),
  ];
}

const sharedDefinition: Omit<
  DesignSkillDefinition,
  "id" | "title" | "description" | "supportedIntents" | "execute" | "summarize"
> = {
  version: "1.0.0",
  scope: "storefront",
  supportedPageTypes: ["home", "collection", "product", "content", "cart", "checkout", "landing"],
  requiredContext: ["activeLocale", "page", "brandSystem"],
  optionalContext: [],
  allowedComponentTypes: [...storefrontStyleComponents],
  allowedOperationTypes: [
    "CHANGE_SECTION_VARIANT",
    "CHANGE_BACKGROUND",
    "CHANGE_TYPOGRAPHY",
    "CHANGE_DENSITY",
    "CHANGE_SHAPE",
    "REORDER_SECTIONS",
    "APPLY_REGISTERED_PAGE_SECTIONS",
    "APPLY_APPROVED_BRAND_COLOURS",
    "APPLY_APPROVED_BRAND_TYPOGRAPHY",
    "APPLY_REGISTERED_BRAND_SYSTEM",
  ],
  protectedPaths: [...protectedDesignPaths],
  preconditions: [{ type: "pageTypeSupported" }],
  outputSchema: operationArraySchema,
  validationRules: requiredValidationRules,
};

export const applyWarmPremiumStorefrontStyleSkill: DesignSkillDefinition = {
  ...sharedDefinition,
  id: "applyWarmPremiumStorefrontStyle",
  title: { en: "Apply a warm premium storefront style", fi: "Käytä lämmintä premium-ilmettä" },
  description: {
    en: "Coordinates approved colour and typography choices across explicit storefront pages.",
    fi: "Yhtenäistää hyväksytyt väri- ja typografiavalinnat valituilla kaupan sivuilla.",
  },
  supportedIntents: ["luxuryStyle"],
  execute: ({ page }) => createStorefrontStyleOperations(page, "warmPremium"),
  summarize: ({ operationCount }) => ({
    en: `Apply ${operationCount} approved warm premium colour and typography adjustments.`,
    fi: `Käytä ${operationCount} hyväksyttyä lämpimän premium-ilmeen väri- ja typografiamuutosta.`,
  }),
};

export const applyMinimalNordicStorefrontStyleSkill: DesignSkillDefinition = {
  ...sharedDefinition,
  id: "applyMinimalNordicStorefrontStyle",
  title: {
    en: "Apply a minimal Nordic storefront style",
    fi: "Käytä pelkistettyä pohjoismaista ilmettä",
  },
  description: {
    en: "Coordinates approved restrained colours and sans-serif typography across explicit pages.",
    fi: "Yhtenäistää hyväksytyt hillityt värit ja groteskitypografian valituilla sivuilla.",
  },
  supportedIntents: ["minimalNordicStyle"],
  execute: ({ page }) => createStorefrontStyleOperations(page, "minimalNordic"),
  summarize: ({ operationCount }) => ({
    en: `Apply ${operationCount} approved minimal Nordic colour and typography adjustments.`,
    fi: `Käytä ${operationCount} hyväksyttyä pelkistetyn pohjoismaisen ilmeen väri- ja typografiamuutosta.`,
  }),
};
