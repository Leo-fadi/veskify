import { designOperationSchema, type DesignOperation } from "@/application/design-operations";
import { brandSystemSchema, type BrandSystem } from "@/domain/design-system";
import type { DesignSkillDefinition } from "../contract";
import { storefrontStyleComponents } from "./apply-storefront-style";
import { operationArraySchema, protectedDesignPaths, requiredValidationRules } from "./shared";

export function createExactBrandPaletteOperation(
  colorsInput: BrandSystem["colors"],
): DesignOperation {
  const colors = brandSystemSchema.shape.colors.parse(structuredClone(colorsInput));
  return designOperationSchema.parse({ type: "APPLY_APPROVED_BRAND_COLOURS", colors });
}

export const applyExactBrandPaletteSkill: DesignSkillDefinition = {
  id: "applyExactBrandPalette",
  version: "1.0.0",
  title: { en: "Apply an exact brand palette", fi: "Käytä tarkkaa brändiväripalettia" },
  description: {
    en: "Maps approved named or hexadecimal colours to the canonical storefront colour tokens.",
    fi: "Kohdistaa hyväksytyt nimettyjen tai heksadesimaalisten värien arvot kaupan vakioväritunnisteisiin.",
  },
  supportedIntents: ["exactBrandPalette"],
  scope: "storefront",
  supportedPageTypes: ["home", "collection", "product", "content", "cart", "checkout", "landing"],
  requiredContext: ["brandSystem"],
  optionalContext: ["activeLocale"],
  allowedComponentTypes: [...storefrontStyleComponents],
  allowedOperationTypes: ["APPLY_APPROVED_BRAND_COLOURS"],
  protectedPaths: [...protectedDesignPaths],
  preconditions: [{ type: "pageTypeSupported" }],
  outputSchema: operationArraySchema,
  validationRules: requiredValidationRules,
  execute: ({ brandSystem }) => [createExactBrandPaletteOperation(brandSystem.colors)],
  summarize: ({ operationCount }) => ({
    en: `Apply ${operationCount} validated brand colour update without changing layout or content.`,
    fi: `Käytä ${operationCount} validoitua brändivärimuutosta muuttamatta asettelua tai sisältöä.`,
  }),
};
