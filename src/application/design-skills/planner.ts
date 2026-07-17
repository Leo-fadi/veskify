import { brandSystemSchema, type BrandSystem } from "@/domain/design-system";
import { localeSchema, type Locale } from "@/domain/shared";
import {
  pageModelSchema,
  pageTypeSchema,
  type PageModel,
  type PageType,
} from "@/domain/storefront";
import type { StorefrontRenderContext } from "@/components/registry";
import {
  campaignContextSchema,
  designPlanSchema,
  designRequestClassificationSchema,
  type CampaignContext,
  type DesignIntent,
  type DesignPlan,
  type DesignRequestClassification,
  type DesignSkillScope,
  type SelectedDesignSkill,
} from "./contract";
import { designSkillRegistry } from "./default-registry";
import type { DesignSkillRegistry } from "./registry";
import { nextSectionId } from "./skills";

export type DesignPlannerInput = {
  merchantRequest: string;
  activeLocale: Locale;
  page: PageModel;
  pageType: PageType;
  brandSystem: BrandSystem;
  displayContext: StorefrontRenderContext;
  selectedSectionId?: string;
  campaign?: CampaignContext;
};

type SupportedRequest = {
  intent: DesignIntent;
  locale: Locale;
  scope: DesignSkillScope;
  skillIds: string[];
};

const supportedRequests = new Map<string, SupportedRequest>([
  [
    "make the homepage feel more luxurious",
    {
      intent: "luxuryStyle",
      locale: "en",
      scope: "page",
      skillIds: ["applyLuxuryStyle", "improveHero"],
    },
  ],
  [
    "make homepage feel more luxurious",
    {
      intent: "luxuryStyle",
      locale: "en",
      scope: "page",
      skillIds: ["applyLuxuryStyle", "improveHero"],
    },
  ],
  [
    "add a campaign section",
    { intent: "campaignSection", locale: "en", scope: "page", skillIds: ["addCampaignSection"] },
  ],
  [
    "make the layout more minimal",
    {
      intent: "minimalNordicStyle",
      locale: "en",
      scope: "page",
      skillIds: ["applyMinimalNordicStyle"],
    },
  ],
  [
    "improve the hero",
    { intent: "heroImprovement", locale: "en", scope: "section", skillIds: ["improveHero"] },
  ],
  [
    "tee etusivusta ylellisempi",
    {
      intent: "luxuryStyle",
      locale: "fi",
      scope: "page",
      skillIds: ["applyLuxuryStyle", "improveHero"],
    },
  ],
  [
    "lisää kampanjaosio",
    { intent: "campaignSection", locale: "fi", scope: "page", skillIds: ["addCampaignSection"] },
  ],
  [
    "tee asettelusta pelkistetympi",
    {
      intent: "minimalNordicStyle",
      locale: "fi",
      scope: "page",
      skillIds: ["applyMinimalNordicStyle"],
    },
  ],
  [
    "paranna hero-osiota",
    { intent: "heroImprovement", locale: "fi", scope: "section", skillIds: ["improveHero"] },
  ],
]);

function normalizeRequest(request: string) {
  return request
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

const intentKeywords: ReadonlyArray<[DesignIntent, RegExp]> = [
  ["luxuryStyle", /\b(luxur|ylelli)/i],
  ["minimalNordicStyle", /\b(minimal|pelkistet)/i],
  ["campaignSection", /\b(campaign|kampanja)/i],
  ["heroImprovement", /\bhero/i],
];

export function classifyDesignRequest(
  merchantRequest: string,
  activeLocale: Locale = "en",
): DesignRequestClassification {
  const fallbackLocale = localeSchema.parse(activeLocale);
  const normalized = normalizeRequest(merchantRequest);
  if (normalized === "make it better" || normalized === "tee siitä parempi") {
    return designRequestClassificationSchema.parse({
      normalizedIntent: null,
      locale: normalized === "tee siitä parempi" ? "fi" : fallbackLocale,
      confidence: 0.25,
      requestedScope: null,
      selectedSkillIds: [],
      requiresClarification: true,
      clarifications: [
        {
          en: "What should feel better: a more luxurious look or a more minimal layout?",
          fi: "Mitä haluat parantaa: ylellisempää ilmettä vai pelkistetympää asettelua?",
        },
      ],
      unsupportedReason: null,
    });
  }
  const supported = supportedRequests.get(normalized);
  if (supported) {
    return designRequestClassificationSchema.parse({
      normalizedIntent: supported.intent,
      locale: supported.locale,
      confidence: 1,
      requestedScope: supported.scope,
      selectedSkillIds: supported.skillIds,
      requiresClarification: false,
      clarifications: [],
      unsupportedReason: null,
    });
  }

  const possibleIntents = intentKeywords
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([intent]) => intent);
  if (new Set(possibleIntents).size > 1) {
    return designRequestClassificationSchema.parse({
      normalizedIntent: null,
      locale: fallbackLocale,
      confidence: 0.5,
      requestedScope: null,
      selectedSkillIds: [],
      requiresClarification: true,
      clarifications: [
        {
          en: "Which single result should Veskify apply first?",
          fi: "Mikä yksittäinen muutos Veskifyn tulisi tehdä ensin?",
        },
      ],
      unsupportedReason: null,
    });
  }

  return designRequestClassificationSchema.parse({
    normalizedIntent: null,
    locale: fallbackLocale,
    confidence: 0,
    requestedScope: null,
    selectedSkillIds: [],
    requiresClarification: false,
    clarifications: [],
    unsupportedReason: {
      en: "This request does not match a currently approved design capability.",
      fi: "Pyyntö ei vastaa tällä hetkellä hyväksyttyä suunnittelutoimintoa.",
    },
  });
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

type PlanIdentity = Omit<DesignPlan, "id" | "validation">;

export function designPlanIdFor(identity: PlanIdentity) {
  return `plan_${stableHash(JSON.stringify(identity))}`;
}

function explanation(intent: DesignIntent | null, includesHeroImprovement = true) {
  switch (intent) {
    case "luxuryStyle":
      return includesHeroImprovement
        ? {
            en: "Refine the homepage using the existing brand palette, approved luxury styling and a focused hero improvement.",
            fi: "Viimeistele etusivu nykyisellä väripaletilla, hyväksytyllä ylellisellä tyylillä ja kohdennetulla hero-parannuksella.",
          }
        : {
            en: "Refine the homepage using the existing brand palette and approved luxury styling.",
            fi: "Viimeistele etusivu nykyisellä väripaletilla ja hyväksytyllä ylellisellä tyylillä.",
          };
    case "minimalNordicStyle":
      return {
        en: "Simplify the layout, reduce decoration and add controlled whitespace.",
        fi: "Pelkistä asettelua, vähennä koristeellisuutta ja lisää hallittua väljyyttä.",
      };
    case "campaignSection":
      return {
        en: "Add one approved campaign section without changing unrelated sections.",
        fi: "Lisää yksi hyväksytty kampanjaosio muuttamatta muita osioita.",
      };
    case "heroImprovement":
      return {
        en: "Improve only the existing hero and preserve the rest of the page.",
        fi: "Paranna vain nykyistä hero-osiota ja säilytä muu sivu ennallaan.",
      };
    default:
      return {
        en: "No safe design plan could be created for this request.",
        fi: "Pyynnölle ei voitu luoda turvallista suunnitelmaa.",
      };
  }
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

export function createDesignPlan(
  input: DesignPlannerInput,
  registry: DesignSkillRegistry = designSkillRegistry,
): DesignPlan {
  const inputPageJson = JSON.stringify(input.page);
  const page = pageModelSchema.parse(structuredClone(input.page));
  const pageType = pageTypeSchema.parse(input.pageType);
  const brandSystem = brandSystemSchema.parse(structuredClone(input.brandSystem));
  const activeLocale = localeSchema.parse(input.activeLocale);
  const campaign = input.campaign
    ? campaignContextSchema.parse(structuredClone(input.campaign))
    : undefined;
  void brandSystem;
  void campaign;

  const classification = classifyDesignRequest(input.merchantRequest, activeLocale);
  const errors: string[] = [];
  if (page.type !== pageType)
    errors.push("The supplied PageType does not match the canonical page.");
  if (classification.unsupportedReason)
    errors.push(
      classification.unsupportedReason.en ??
        classification.unsupportedReason.fi ??
        "Unsupported request.",
    );
  if (classification.requiresClarification)
    errors.push("The merchant request requires clarification.");
  const isSectionScopedRequest = classification.requestedScope === "section";
  if (
    isSectionScopedRequest &&
    input.selectedSectionId &&
    !page.sections.some((section) => section.id === input.selectedSectionId)
  ) {
    errors.push(`Unknown selected section: ${input.selectedSectionId}.`);
  }

  const pageHero = page.sections.find((section) => section.component === "hero");
  const selectedSection = input.selectedSectionId
    ? page.sections.find((section) => section.id === input.selectedSectionId)
    : undefined;
  const heroTarget = isSectionScopedRequest ? (selectedSection ?? pageHero) : pageHero;
  if (classification.normalizedIntent === "heroImprovement" && heroTarget?.component !== "hero") {
    errors.push("Hero improvement requires an existing hero selection.");
  }

  const selectedSkills: SelectedDesignSkill[] = [];
  for (const skillId of classification.selectedSkillIds) {
    const definition = registry.get(skillId);
    if (skillId === "improveHero" && !isSectionScopedRequest && !pageHero) continue;
    if (!definition.supportedPageTypes.includes(pageType)) {
      errors.push(`Skill ${skillId} does not support ${pageType} pages.`);
      continue;
    }
    for (const precondition of definition.preconditions) {
      if (
        precondition.type === "componentExists" &&
        !page.sections.some((section) => section.component === precondition.component)
      ) {
        errors.push(`Skill ${skillId} requires an existing ${precondition.component} section.`);
      }
      if (
        precondition.type === "campaignContextAvailableOrDerivable" &&
        input.displayContext.catalogue.collections.length === 0 &&
        !campaign
      ) {
        errors.push(`Skill ${skillId} requires campaign or catalogue context.`);
      }
    }
    const targetSectionIds =
      skillId === "addCampaignSection"
        ? [nextSectionId(page, "section_campaign_generated")]
        : skillId === "improveHero"
          ? heroTarget?.component === "hero"
            ? [heroTarget.id]
            : []
          : page.sections
              .filter((section) =>
                definition.allowedComponentTypes.some(
                  (component) => component === section.component,
                ),
              )
              .map((section) => section.id);
    selectedSkills.push({
      id: definition.id,
      version: definition.version,
      scope: definition.scope,
      targetSectionIds,
    });
  }

  const assumptions = [];
  if (classification.normalizedIntent === "luxuryStyle") {
    assumptions.push({
      en: "The existing merchant palette remains the colour source of truth.",
      fi: "Nykyinen kauppiaan väripaletti säilyy värien lähteenä.",
    });
    if (!pageHero) {
      assumptions.push({
        en: "No hero section is present, so the optional hero improvement is omitted.",
        fi: "Sivulla ei ole hero-osiota, joten valinnainen hero-parannus jätetään pois.",
      });
    }
  }
  if (classification.normalizedIntent === "campaignSection" && !input.campaign) {
    assumptions.push({
      en: "Campaign wording is derived from existing collection labels and contains no offer claims.",
      fi: "Kampanjateksti johdetaan nykyisistä kokoelmista eikä sisällä tarjousväitteitä.",
    });
  }

  const identity: PlanIdentity = {
    normalizedIntent: classification.normalizedIntent,
    locale: classification.locale,
    requestedScope: classification.requestedScope,
    selectedSkills,
    affectedPageIds: selectedSkills.length > 0 ? [page.id] : [],
    affectedSectionIds: unique(selectedSkills.flatMap((skill) => skill.targetSectionIds)),
    plannedOperationCategories: unique(
      selectedSkills.flatMap((skill) => registry.get(skill.id).allowedOperationTypes),
    ),
    explanation: explanation(
      classification.normalizedIntent,
      selectedSkills.some((skill) => skill.id === "improveHero"),
    ),
    assumptions,
    requiredClarifications: classification.clarifications,
  };
  const plan = designPlanSchema.parse({
    id: designPlanIdFor(identity),
    ...identity,
    validation: { valid: errors.length === 0, errors },
  });
  if (JSON.stringify(input.page) !== inputPageJson) {
    throw new Error("Planning must not mutate the input page.");
  }
  return plan;
}
