import type { DesignOperation } from "@/application/design-operations";
import { localizedTextSchema } from "@/domain/shared";
import type { DesignSkillDefinition } from "../contract";
import { operationArraySchema, protectedDesignPaths, requiredValidationRules } from "./shared";

function improvedBody(body: string, cta: string) {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length > 150) {
    const shortened = normalized.slice(0, 140).replace(/\s+\S*$/, "");
    return `${shortened}…`;
  }
  if (normalized.toLocaleLowerCase().includes(cta.toLocaleLowerCase())) return normalized;
  return `${normalized}${/[.!?]$/.test(normalized) ? "" : "."} ${cta}.`;
}

export const improveHeroSkill: DesignSkillDefinition = {
  id: "improveHero",
  version: "1.0.0",
  title: { en: "Improve the hero", fi: "Paranna hero-osiota" },
  description: {
    en: "Improves only the existing hero with approved localized copy and variants.",
    fi: "Parantaa vain nykyistä hero-osiota hyväksytyllä lokalisoidulla tekstillä ja versiolla.",
  },
  supportedIntents: ["heroImprovement", "luxuryStyle"],
  scope: "section",
  supportedPageTypes: ["home", "landing"],
  requiredContext: ["activeLocale", "page"],
  optionalContext: ["selectedSection", "brandSystem", "catalogue"],
  allowedComponentTypes: ["hero"],
  allowedOperationTypes: ["CHANGE_LOCALIZED_SECTION_TEXT", "CHANGE_SECTION_VARIANT"],
  protectedPaths: [...protectedDesignPaths],
  preconditions: [{ type: "pageTypeSupported" }, { type: "componentExists", component: "hero" }],
  outputSchema: operationArraySchema,
  validationRules: requiredValidationRules,
  execute: ({ activeLocale, page, selectedSectionId }) => {
    const hero = selectedSectionId
      ? page.sections.find((section) => section.id === selectedSectionId)
      : page.sections.find((section) => section.component === "hero");
    if (!hero || hero.component !== "hero") {
      throw new Error("The selected target is not an existing hero section.");
    }
    const body = localizedTextSchema.parse(hero.content.body);
    const cta = hero.content.cta as { label?: unknown } | undefined;
    const ctaLabel = localizedTextSchema.safeParse(cta?.label);
    const currentBody = body[activeLocale];
    const currentCta = ctaLabel.success ? ctaLabel.data[activeLocale] : undefined;
    if (!currentBody || !currentCta) {
      throw new Error(`The hero requires ${activeLocale.toUpperCase()} body and CTA copy.`);
    }
    const operations: DesignOperation[] = [];
    const nextBody = improvedBody(currentBody, currentCta);
    if (nextBody !== currentBody) {
      operations.push({
        type: "CHANGE_LOCALIZED_SECTION_TEXT",
        sectionId: hero.id,
        field: "body",
        locale: activeLocale,
        value: nextBody,
      });
    }
    if (hero.variant !== "editorial") {
      operations.push({ type: "CHANGE_SECTION_VARIANT", sectionId: hero.id, variant: "editorial" });
    }
    return operations;
  },
  summarize: ({ operationCount }) => ({
    en: `Improve only the existing hero with ${operationCount} approved localized change${operationCount === 1 ? "" : "s"}.`,
    fi: `Paranna vain nykyistä hero-osiota ${operationCount} hyväksytyllä lokalisoidulla muutoksella.`,
  }),
};
