import { z } from "zod";
import {
  designPlanIdFor,
  designPlanSchema,
  designSkillRegistry,
  type DesignPlan,
  type DesignSkillRegistry,
} from "@/application/design-skills";
import { localeSchema, type Locale, type LocalizedText } from "@/domain/shared";
import { pageModelSchema, type PageModel } from "@/domain/storefront";

export const designAgentRevisionKindSchema = z.enum([
  "keepHero",
  "makeMinimal",
  "omitCampaign",
  "startOver",
]);

export type DesignAgentRevisionKind = z.infer<typeof designAgentRevisionKindSchema>;

const supportedRevisionInstructions = new Map<string, DesignAgentRevisionKind>([
  ["keep the hero unchanged", "keepHero"],
  ["pidä hero ennallaan", "keepHero"],
  ["make it more minimal", "makeMinimal"],
  ["tee siitä pelkistetympi", "makeMinimal"],
  ["do not add a campaign section", "omitCampaign"],
  ["älä lisää kampanjaosiota", "omitCampaign"],
  ["start over", "startOver"],
  ["aloita alusta", "startOver"],
]);

function normalizeInstruction(instruction: string) {
  return instruction
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

export function classifyRevisionInstruction(instruction: string): DesignAgentRevisionKind | null {
  return supportedRevisionInstructions.get(normalizeInstruction(instruction)) ?? null;
}

export function minimalRevisionRequest(localeInput: Locale): string {
  return localeSchema.parse(localeInput) === "fi"
    ? "Tee asettelusta pelkistetympi."
    : "Make the layout more minimal.";
}

export function revisionSummary(kind: DesignAgentRevisionKind): LocalizedText {
  switch (kind) {
    case "keepHero":
      return {
        en: "The proposal was rebuilt from the original page with the hero unchanged.",
        fi: "Ehdotus rakennettiin uudelleen alkuperäisestä sivusta hero-osio ennallaan.",
      };
    case "makeMinimal":
      return {
        en: "The proposal was rebuilt from the original page with a more minimal layout.",
        fi: "Ehdotus rakennettiin uudelleen alkuperäisestä sivusta pelkistetymmällä asettelulla.",
      };
    case "omitCampaign":
      return {
        en: "The proposal was rebuilt from the original page without adding a campaign section.",
        fi: "Ehdotus rakennettiin uudelleen alkuperäisestä sivusta ilman uutta kampanjaosiota.",
      };
    case "startOver":
      return {
        en: "The proposal was closed and the request was restarted from the original page.",
        fi: "Ehdotus suljettiin ja pyyntö aloitettiin alusta alkuperäiseltä sivulta.",
      };
  }
}

export function constrainDesignPlanForRevision(
  planInput: DesignPlan,
  pageInput: PageModel,
  kind: Extract<DesignAgentRevisionKind, "keepHero" | "omitCampaign">,
  registry: DesignSkillRegistry = designSkillRegistry,
): DesignPlan {
  const plan = designPlanSchema.parse(structuredClone(planInput));
  const page = pageModelSchema.parse(structuredClone(pageInput));
  const excludedSkill = kind === "keepHero" ? "improveHero" : "addCampaignSection";
  const selectedSkills = plan.selectedSkills.filter((skill) => skill.id !== excludedSkill);
  const summary = revisionSummary(kind);
  const identity = {
    normalizedIntent: plan.normalizedIntent,
    locale: plan.locale,
    requestedScope: plan.requestedScope,
    selectedSkills,
    affectedPageIds: [page.id],
    affectedSectionIds: [...new Set(selectedSkills.flatMap((skill) => skill.targetSectionIds))],
    plannedOperationCategories: [
      ...new Set(selectedSkills.flatMap((skill) => registry.get(skill.id).allowedOperationTypes)),
    ],
    explanation: summary,
    assumptions: [...plan.assumptions, summary],
    requiredClarifications: [],
  };
  return designPlanSchema.parse({
    id: designPlanIdFor(identity),
    ...identity,
    validation: plan.validation,
  });
}
