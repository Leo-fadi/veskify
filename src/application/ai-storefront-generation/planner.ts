import { getComponentDefinition } from "@/components/registry";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { designSkillRegistry } from "@/application/design-skills";
import {
  aiStorefrontGenerationPlanSchema,
  type AiStorefrontGenerationCommand,
  type AiStorefrontGenerationPlan,
} from "./contract";
import {
  BrandPaletteInstructionError,
  containsProtectedCommerceMutation,
  planExactBrandPalette,
  type ExactBrandPalettePlan,
} from "./brand-palette";

export class AiStorefrontPlanError extends Error {
  constructor(
    readonly code: "unsupported-request" | "ambiguous-request" | "target-mismatch",
    message: string,
  ) {
    super(message);
    this.name = "AiStorefrontPlanError";
  }
}

export function normalizeStorefrontInstruction(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

const registeredDirectionSignals = {
  premiumEditorial: [
    /premium/,
    /editorial/,
    /craftsmanship/,
    /product imagery/,
    /ring discovery/,
    /ensiluokkainen/,
    /editoriaal/,
    /käsityö/,
    /tuotekuv/,
    /sormus(?:ten|valikoiman) löyt/,
  ],
  modernTechnical: [
    /modern/,
    /technical/,
    /minimal/,
    /nordic/,
    /compact spacing/,
    /crisp surfaces/,
    /commerce-focused/,
    /structured product discovery/,
    /specification-led/,
    /moderni/,
    /tekninen/,
    /pelkistet/,
    /pohjois/,
    /kompakti/,
    /terävä/,
  ],
  warmApproachable: [
    /warm/,
    /approachable/,
    /natural colou?r/,
    /welcoming/,
    /soft(?:er)? (?:typography|spacing|shapes|surfaces)/,
    /lämmin/,
    /lähestyttävä/,
    /luonnollinen väri/,
    /pehmeä(?:mpi)? (?:typografia|välistys|muoto|pinta)/,
  ],
} as const;

export type RegisteredWholeStorefrontRequestClassification =
  | {
      kind: "selected";
      direction: keyof typeof registeredDirectionSignals;
    }
  | { kind: "ambiguous" | "protected-commerce" | "unsupported" };

export function classifyRegisteredWholeStorefrontDirectionRequest(
  instruction: string,
): RegisteredWholeStorefrontRequestClassification {
  const normalized = normalizeStorefrontInstruction(instruction);
  if (containsProtectedCommerceMutation(normalized)) return { kind: "protected-commerce" };

  const legacyWarm = /\b(warm|premium|lämmin|premium-ilme)/iu.test(normalized);
  const legacyMinimal = /\b(minimal|nordic|pelkistet|pohjois)/iu.test(normalized);
  if (legacyWarm && legacyMinimal) return { kind: "ambiguous" };

  const ranked = Object.entries(registeredDirectionSignals)
    .map(([direction, signals]) => ({
      direction: direction as keyof typeof registeredDirectionSignals,
      score: signals.filter((signal) => signal.test(normalized)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) => right.score - left.score || left.direction.localeCompare(right.direction),
    );
  if (ranked.length === 0) return { kind: "unsupported" };
  if (ranked[1]?.score === ranked[0].score) {
    const tiedDirections = ranked
      .filter(({ score }) => score === ranked[0].score)
      .map(({ direction }) => direction);
    if (
      tiedDirections.length === 2 &&
      tiedDirections.includes("premiumEditorial") &&
      tiedDirections.includes("warmApproachable") &&
      /\bpremium\b/u.test(normalized)
    ) {
      return { kind: "selected", direction: "premiumEditorial" };
    }
    return { kind: "ambiguous" };
  }
  return { kind: "selected", direction: ranked[0].direction };
}

export function isRegisteredWholeStorefrontDirectionRequest(instruction: string): boolean {
  return classifyRegisteredWholeStorefrontDirectionRequest(instruction).kind === "selected";
}

type SupportedStorefrontRequest = {
  direction: AiStorefrontGenerationPlan["direction"];
  skillId: string;
  designSystem: "required" | "none";
  brandPalettePlan?: ExactBrandPalettePlan;
};

const supportedRequests = new Map<string, SupportedStorefrontRequest>([
  [
    "apply a warm premium style across the storefront",
    {
      direction: "warmPremium",
      skillId: "applyWarmPremiumStorefrontStyle",
      designSystem: "required",
    },
  ],
  [
    "apply warm premium style across the storefront",
    {
      direction: "warmPremium",
      skillId: "applyWarmPremiumStorefrontStyle",
      designSystem: "required",
    },
  ],
  [
    "apply a warm premium style across the selected pages",
    {
      direction: "warmPremium",
      skillId: "applyWarmPremiumStorefrontStyle",
      designSystem: "none",
    },
  ],
  [
    "use a minimal nordic colour and typography direction throughout the site",
    {
      direction: "minimalNordic",
      skillId: "applyMinimalNordicStorefrontStyle",
      designSystem: "required",
    },
  ],
  [
    "use a minimal nordic color and typography direction throughout the site",
    {
      direction: "minimalNordic",
      skillId: "applyMinimalNordicStorefrontStyle",
      designSystem: "required",
    },
  ],
  [
    "use a minimal nordic colour and typography direction on the selected pages",
    {
      direction: "minimalNordic",
      skillId: "applyMinimalNordicStorefrontStyle",
      designSystem: "none",
    },
  ],
  [
    "käytä lämmintä premium-ilmettä koko kaupassa",
    {
      direction: "warmPremium",
      skillId: "applyWarmPremiumStorefrontStyle",
      designSystem: "required",
    },
  ],
  [
    "käytä lämmintä premium-ilmettä valituilla sivuilla",
    {
      direction: "warmPremium",
      skillId: "applyWarmPremiumStorefrontStyle",
      designSystem: "none",
    },
  ],
  [
    "käytä pelkistettyä pohjoismaista väri- ja typografiailmettä koko sivustolla",
    {
      direction: "minimalNordic",
      skillId: "applyMinimalNordicStorefrontStyle",
      designSystem: "required",
    },
  ],
  [
    "käytä pelkistettyä pohjoismaista väri- ja typografiailmettä valituilla sivuilla",
    {
      direction: "minimalNordic",
      skillId: "applyMinimalNordicStorefrontStyle",
      designSystem: "none",
    },
  ],
]);

function classifyInstruction(command: AiStorefrontGenerationCommand): SupportedStorefrontRequest {
  if (command.capability === "registeredWholeStorefrontDirection") {
    const classification = classifyRegisteredWholeStorefrontDirectionRequest(
      command.merchantInstruction,
    );
    if (classification.kind === "ambiguous") {
      throw new AiStorefrontPlanError(
        "ambiguous-request",
        "Choose one registered whole-storefront design direction.",
      );
    }
    if (classification.kind === "protected-commerce") {
      throw new AiStorefrontPlanError(
        "unsupported-request",
        "Protected commerce data cannot be changed by a storefront design proposal.",
      );
    }
    if (classification.kind === "unsupported") {
      throw new AiStorefrontPlanError(
        "unsupported-request",
        "Choose a supported registered whole-storefront design direction.",
      );
    }
    return {
      direction: "registeredWholeStorefront",
      skillId: "applyRegisteredWholeStorefrontDirection",
      designSystem: "required",
    };
  }
  const instruction = command.merchantInstruction;
  const currentColors = command.storefront.brandSystem.colors;
  const normalized = normalizeStorefrontInstruction(instruction);
  const supported = supportedRequests.get(normalized);
  if (supported) return supported;
  try {
    const brandPalettePlan = planExactBrandPalette(instruction, currentColors);
    if (brandPalettePlan) {
      return {
        direction: "exactBrandPalette",
        skillId: "applyExactBrandPalette",
        designSystem: "required",
        brandPalettePlan,
      };
    }
  } catch (error) {
    if (error instanceof BrandPaletteInstructionError) {
      throw new AiStorefrontPlanError("unsupported-request", error.message);
    }
    throw error;
  }
  const warm = /\b(warm|premium|lämmin|premium-ilme)/i.test(normalized);
  const minimal = /\b(minimal|nordic|pelkistet|pohjois)/i.test(normalized);
  if (warm && minimal) {
    throw new AiStorefrontPlanError(
      "ambiguous-request",
      "Choose either the warm premium or minimal Nordic storefront direction.",
    );
  }
  throw new AiStorefrontPlanError(
    "unsupported-request",
    "Only the approved warm premium or minimal Nordic colour and typography direction is supported.",
  );
}

function approvedStyleOperations(componentType: string) {
  const definition = getComponentDefinition(componentType);
  return [
    "CHANGE_SECTION_VARIANT" as const,
    ...(definition.editorFields.background ? (["CHANGE_BACKGROUND"] as const) : []),
    ...(definition.editorFields.typography ? (["CHANGE_TYPOGRAPHY"] as const) : []),
    ...(definition.editorFields.density ? (["CHANGE_DENSITY"] as const) : []),
    ...(definition.editorFields.shape ? (["CHANGE_SHAPE"] as const) : []),
  ];
}

export function createAiStorefrontGenerationPlan(
  command: AiStorefrontGenerationCommand,
): AiStorefrontGenerationPlan {
  const normalizedInstruction = normalizeStorefrontInstruction(command.merchantInstruction);
  const classified = classifyInstruction(command);
  if (classified.designSystem === "required" && command.designSystemTarget === null) {
    throw new AiStorefrontPlanError(
      "target-mismatch",
      "This whole-storefront direction requires an explicit storefront design-system target.",
    );
  }
  if (classified.designSystem === "none" && command.designSystemTarget !== null) {
    throw new AiStorefrontPlanError(
      "target-mismatch",
      "The selected-pages direction does not authorize a global design-system change.",
    );
  }

  const skill = designSkillRegistry.get(classified.skillId);
  if (skill.scope !== "storefront") {
    throw new AiStorefrontPlanError(
      "unsupported-request",
      "The selected design skill does not support storefront scope.",
    );
  }
  const pagesById = new Map(command.storefront.pages.map((page) => [page.id, page]));
  const affectedPageIds = [...command.affectedPageIds].sort((left, right) =>
    left.localeCompare(right),
  );
  const explicitTargets = new Map(
    command.affectedSectionTargets.map((target) => [target.sectionId, target]),
  );
  if (classified.direction === "exactBrandPalette" && explicitTargets.size > 0) {
    throw new AiStorefrontPlanError(
      "target-mismatch",
      "A global brand palette request cannot use selected-section targets.",
    );
  }
  const sectionTargets =
    classified.direction === "exactBrandPalette"
      ? []
      : affectedPageIds.flatMap((pageId) => {
          const page = pagesById.get(pageId);
          if (!page) {
            throw new AiStorefrontPlanError(
              "target-mismatch",
              "An affected page no longer exists in the storefront projection.",
            );
          }
          if (!skill.supportedPageTypes.includes(page.type)) {
            throw new AiStorefrontPlanError(
              "unsupported-request",
              `The approved storefront style does not support ${page.type} pages.`,
            );
          }
          const candidates = page.sections.filter((section) =>
            explicitTargets.size > 0 ? explicitTargets.has(section.id) : true,
          );
          const targets = candidates.flatMap((section) => {
            if (!skill.allowedComponentTypes.some((component) => component === section.component)) {
              if (explicitTargets.has(section.id)) {
                throw new AiStorefrontPlanError(
                  "unsupported-request",
                  `The selected component ${section.component} is outside the approved storefront skill.`,
                );
              }
              return [];
            }
            const operationTypes = approvedStyleOperations(section.component).filter(
              (operationType) => skill.allowedOperationTypes.includes(operationType),
            );
            if (operationTypes.length === 0) {
              if (explicitTargets.has(section.id)) {
                throw new AiStorefrontPlanError(
                  "unsupported-request",
                  `The selected component ${section.component} has no approved colour or typography controls.`,
                );
              }
              return [];
            }
            return [
              { pageId, sectionId: section.id, componentType: section.component, operationTypes },
            ];
          });
          if (targets.length === 0) {
            throw new AiStorefrontPlanError(
              "unsupported-request",
              "Every affected page must contain an approved colour or typography target.",
            );
          }
          return targets;
        });
  if (explicitTargets.size > 0 && sectionTargets.length !== explicitTargets.size) {
    throw new AiStorefrontPlanError(
      "target-mismatch",
      "Every explicit section target must resolve exactly once on an affected page.",
    );
  }
  sectionTargets.sort(
    (left, right) =>
      left.pageId.localeCompare(right.pageId) || left.sectionId.localeCompare(right.sectionId),
  );
  const identity = {
    normalizedInstruction,
    direction: classified.direction,
    skillId: skill.id,
    skillVersion: skill.version,
    requestedScope: "storefront" as const,
    affectedPageIds,
    sectionTargets,
    designSystemTarget: command.designSystemTarget,
    brandPalettePlan: classified.brandPalettePlan ?? null,
    explanation:
      classified.direction === "exactBrandPalette"
        ? {
            en: "Apply the merchant’s validated brand colours across the storefront while preserving typography, layout, imagery, content, products, and section structure.",
            fi: "Käytä kauppiaan validoituja brändivärejä koko kaupassa säilyttäen typografia, asettelu, kuvat, sisältö, tuotteet ja osiorakenne.",
          }
        : classified.direction === "registeredWholeStorefront"
          ? {
              en: "Prepare one complete storefront proposal from a server-registered design direction selected through the authoritative planner.",
              fi: "Valmistele yksi koko kaupan ehdotus palvelimen rekisteröidystä, valtuutetun suunnittelijan valitsemasta tyylisuunnasta.",
            }
          : classified.direction === "warmPremium"
            ? {
                en: "Apply one approved warm premium colour and typography direction across the selected storefront pages.",
                fi: "Käytä yhtä hyväksyttyä lämmintä premium-väri- ja typografiailmettä valituilla kaupan sivuilla.",
              }
            : {
                en: "Apply one approved minimal Nordic colour and typography direction across the selected storefront pages.",
                fi: "Käytä yhtä hyväksyttyä pelkistettyä pohjoismaista väri- ja typografiailmettä valituilla kaupan sivuilla.",
              },
    validation: { valid: true, errors: [] as string[] },
  };
  return aiStorefrontGenerationPlanSchema.parse({
    id: `storefront_plan_${canonicalValueFingerprint(identity).slice(-8)}`,
    ...identity,
  });
}
