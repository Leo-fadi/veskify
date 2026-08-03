import {
  storefrontDesignBriefSchema,
  type CatalogueContext as BriefCatalogueContext,
  type StorefrontDesignBrief,
  validateStorefrontDesignBrief,
} from "@/domain/design-brief";
import type { PageType } from "@/domain/storefront";
import { canonicalValueString } from "@/domain/storefront";
import {
  cloneStorefrontTemplateSelectionPlan,
  currentStorefrontTemplateSelectionPlanSchema,
  STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION,
  type StorefrontTemplateCandidate,
  type StorefrontTemplateSelectionPlan,
} from "./selection-contract";
import { getTemplateById } from "./registry";
import { resolveTemplate } from "./resolver";
import type { TemplateCapability, CatalogueContext } from "./contract";

const requiredPageTypes = ["home", "collection", "product"] as const satisfies readonly PageType[];
const candidateOrder = [
  "template_brand_led_editorial",
  "template_balanced_commerce",
  "template_catalogue_forward_commerce",
] as const;
const tieBreakRank = new Map<string, number>([
  ["template_balanced_commerce", 0],
  ["template_brand_led_editorial", 1],
  ["template_catalogue_forward_commerce", 2],
]);

export type StorefrontTemplateSelectionInput = Readonly<{
  brief: StorefrontDesignBrief;
  preferredTemplateId?: string;
}>;

export type StorefrontTemplateCandidateEvaluation = Readonly<{
  candidates: readonly StorefrontTemplateCandidate[];
  blockers: readonly SelectionMessage[];
}>;

type SelectionMessage = { code: string; message: string };

const message = (code: string, text: string): SelectionMessage => ({ code, message: text });

/** Canonical boundary between the design brief vocabulary and template resolver vocabulary. */
export function mapBriefCatalogueContext(input: BriefCatalogueContext): CatalogueContext {
  const mapping: Record<BriefCatalogueContext, CatalogueContext> = {
    "existing-vesko-catalogue": "existing",
    "controlled-demo-catalogue": "demo",
    "empty-catalogue": "empty",
  };
  return mapping[input];
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint of the canonical brief inputs that can change template readiness,
 * compatibility, or deterministic candidate ranking. Merchant copy is deliberately
 * excluded so editing copy does not invalidate an otherwise usable selection.
 */
export function createStorefrontTemplateSelectionBriefFingerprint(
  briefInput: StorefrontDesignBrief,
): string {
  const brief = storefrontDesignBriefSchema.parse(briefInput);
  const projection = {
    creationContextType: brief.creationContext.type,
    industry: brief.businessIdentity.industry,
    visualStyleDirection: brief.brandDirection.visualStyleDirection,
    typographyDirection: brief.brandDirection.typographyDirection,
    imageryDirection: brief.brandDirection.imageryDirection,
    toneKeywords: [...brief.brandDirection.toneKeywords]
      .map((keyword) => keyword.trim().toLocaleLowerCase())
      .sort(),
    hasLogo: brief.brandDirection.logoAssetRef !== null,
    hasSupportingImagery: brief.brandDirection.supportingImageAssetRefs.length > 0,
    pageTypes: [...brief.storefrontStructure.pageTypes].sort(),
    catalogueContext: brief.catalogueContext,
    generationPreferences: brief.generationPreferences,
  };
  return `brief-selection-v1_${stableHash(canonicalValueString(projection))}`;
}

function hasKeyword(keywords: readonly string[], values: readonly string[]): boolean {
  const normalized = keywords.map((keyword) => keyword.toLocaleLowerCase());
  return values.some((value) => normalized.includes(value));
}

function scoreBrief(
  brief: StorefrontDesignBrief,
  templateId: string,
): {
  score: number;
  reasonCodes: string[];
} {
  const preferences = brief.generationPreferences;
  const visualStyle = brief.brandDirection.visualStyleDirection;
  const keywords = brief.brandDirection.toneKeywords;
  const context = brief.catalogueContext;
  let score = templateId === "template_balanced_commerce" ? 10 : 8;
  const reasonCodes: string[] = [];
  const add = (points: number, code: string) => {
    score += points;
    reasonCodes.push(code);
  };

  if (templateId === "template_brand_led_editorial") {
    if (visualStyle === "editorial" || visualStyle === "luxury")
      add(6, "story-led-visual-direction");
    if (preferences.contentEmphasis === "storytelling") add(5, "storytelling-content");
    if (preferences.visualDensity === "airy") add(3, "airy-presentation");
    if (preferences.merchandisingEmphasis === "subtle") add(3, "subtle-promotion-prominence");
    if (hasKeyword(keywords, ["elegant", "warm"])) {
      add(3, "brand-led-tone");
    }
  }

  if (templateId === "template_catalogue_forward_commerce") {
    if (preferences.merchandisingEmphasis === "campaign-led")
      add(6, "campaign-led-promotion-prominence");
    if (preferences.sectionRichness === "rich") add(4, "rich-section-preference");
    if (preferences.visualDensity === "compact") add(3, "compact-discovery-density");
    if (context === "existing-vesko-catalogue" || context === "controlled-demo-catalogue") {
      add(2, "catalogue-discovery-context");
    }
    if (hasKeyword(keywords, ["bold", "technical"])) {
      add(3, "product-forward-tone");
    }
  }

  if (templateId === "template_balanced_commerce") {
    if (visualStyle === "minimal") add(3, "minimal-safe-foundation");
    if (preferences.visualDensity === "balanced") add(2, "balanced-density");
    if (preferences.contentEmphasis === "balanced") add(2, "balanced-content");
    if (preferences.merchandisingEmphasis === "balanced") add(2, "balanced-merchandising");
    if (preferences.sectionRichness === "balanced") add(2, "balanced-section-richness");
  }

  return { score, reasonCodes };
}

function capabilitiesForBrief(brief: StorefrontDesignBrief): readonly TemplateCapability[] {
  const capabilities: TemplateCapability[] = [
    "collection-pages-requested",
    "product-pages-requested",
  ];
  if (brief.brandDirection.logoAssetRef) capabilities.push("logo-available");
  if (brief.brandDirection.supportingImageAssetRefs.length > 0) {
    capabilities.push("supporting-imagery-available");
  }
  if (brief.catalogueContext === "existing-vesko-catalogue")
    capabilities.push("catalogue-available");
  return capabilities;
}

function readinessBlockers(brief: StorefrontDesignBrief): readonly SelectionMessage[] {
  const blockers: SelectionMessage[] = [];
  if (!brief.creationContext.type) {
    blockers.push(
      message("missing-creation-context", "Choose how the storefront is being created."),
    );
  }
  if (!brief.businessIdentity.industry) {
    blockers.push(message("missing-industry", "Choose the business industry."));
  }
  for (const pageType of requiredPageTypes) {
    if (!brief.storefrontStructure.pageTypes.includes(pageType)) {
      const labels = { home: "homepage", collection: "collection page", product: "product page" };
      blockers.push(
        message(`missing-${pageType}-page`, `Select the required ${labels[pageType]}.`),
      );
    }
  }
  if (!brief.catalogueContext) {
    blockers.push(message("missing-catalogue-context", "Choose a catalogue context."));
  }
  return blockers;
}

function candidateMessages(result: ReturnType<typeof resolveTemplate>): {
  warnings: SelectionMessage[];
  errors: SelectionMessage[];
} {
  if (result.status === "not-found") return { warnings: [], errors: [result.error] };
  return {
    warnings: result.plan.warnings.map(({ code, message: text }) => ({ code, message: text })),
    errors: result.plan.errors.map(({ code, message: text }) => ({ code, message: text })),
  };
}

export function evaluateStorefrontTemplateCandidates(
  briefInput: StorefrontDesignBrief,
): StorefrontTemplateCandidateEvaluation {
  const brief = storefrontDesignBriefSchema.parse(briefInput);
  const blockers = readinessBlockers(brief);
  const candidates = candidateOrder.map((templateId) => {
    const score = scoreBrief(brief, templateId);
    const resolution = brief.catalogueContext
      ? resolveTemplate({
          templateId,
          catalogueContext: mapBriefCatalogueContext(brief.catalogueContext),
          availableCapabilities: capabilitiesForBrief(brief),
          requestedPageTypes: requiredPageTypes,
        })
      : null;
    const diagnostics = resolution ? candidateMessages(resolution) : { warnings: [], errors: [] };
    return {
      templateId,
      score: score.score,
      compatible: resolution?.status === "resolved" ? resolution.plan.compatible : false,
      reasonCodes: score.reasonCodes,
      resolverWarnings: diagnostics.warnings,
      resolverErrors: diagnostics.errors,
    } satisfies StorefrontTemplateCandidate;
  });
  return Object.freeze({
    candidates: Object.freeze(candidates),
    blockers: Object.freeze(blockers),
  });
}

function explanationFor(
  templateId: string | null,
  source: "recommended" | "merchant-override",
  blocked: boolean,
): { en: string; fi: string } {
  if (blocked) {
    return {
      en: "A storefront foundation cannot be selected until the missing requirements are provided.",
      fi: "Kaupan perustaa ei voida valita ennen puuttuvien tietojen täydentämistä.",
    };
  }
  if (source === "merchant-override") {
    return {
      en: "Selected using your preferred storefront foundation.",
      fi: "Valinta tehtiin valitsemasi kaupan perustan mukaan.",
    };
  }
  if (templateId === "template_brand_led_editorial") {
    return {
      en: "Selected because storytelling and an airy, brand-led presentation are the clearest signals.",
      fi: "Valinta perustuu tarinallisuuteen ja ilmavaan, brändivetoiseen esitystapaan.",
    };
  }
  if (templateId === "template_catalogue_forward_commerce") {
    return {
      en: "Selected because product discovery and merchandising are the strongest priorities.",
      fi: "Valinta perustuu siihen, että tuotteiden löytäminen ja valikoiman esittely ovat tärkeimmät tavoitteet.",
    };
  }
  return {
    en: "Selected as the safest balanced foundation for the current brief.",
    fi: "Valinta on turvallinen ja tasapainoinen perusta nykyiselle suunnitelmalle.",
  };
}

export function planStorefrontTemplateSelection(
  input: StorefrontTemplateSelectionInput,
): StorefrontTemplateSelectionPlan {
  const brief = validateStorefrontDesignBrief(input.brief);
  const evaluation = evaluateStorefrontTemplateCandidates(brief);
  const preferred = input.preferredTemplateId;
  const source = preferred ? "merchant-override" : "recommended";
  const blockers = [...evaluation.blockers];
  let selectedTemplateId: string | null = null;
  let selectedResolution: ReturnType<typeof resolveTemplate> | null = null;

  if (preferred && blockers.length === 0) {
    const template = getTemplateById(preferred);
    if (!template) {
      blockers.push(
        message("unknown-template-override", `The preferred template ${preferred} was not found.`),
      );
    } else if (brief.catalogueContext) {
      selectedResolution = resolveTemplate({
        templateId: preferred,
        catalogueContext: mapBriefCatalogueContext(brief.catalogueContext),
        availableCapabilities: capabilitiesForBrief(brief),
        requestedPageTypes: requiredPageTypes,
      });
      if (selectedResolution.status === "resolved" && selectedResolution.plan.compatible) {
        selectedTemplateId = preferred;
      } else {
        const errors =
          selectedResolution.status === "resolved"
            ? selectedResolution.plan.errors
            : [selectedResolution.error];
        blockers.push(
          message("incompatible-template-override", errors.map((error) => error.message).join(" ")),
        );
      }
    }
  } else if (blockers.length === 0) {
    const compatible = evaluation.candidates.filter((candidate) => candidate.compatible);
    const selected = [...compatible].sort(
      (left, right) =>
        right.score - left.score ||
        (tieBreakRank.get(left.templateId) ?? 99) - (tieBreakRank.get(right.templateId) ?? 99),
    )[0];
    if (selected) {
      selectedTemplateId = selected.templateId;
      selectedResolution = resolveTemplate({
        templateId: selected.templateId,
        catalogueContext: mapBriefCatalogueContext(brief.catalogueContext!),
        availableCapabilities: capabilitiesForBrief(brief),
        requestedPageTypes: requiredPageTypes,
      });
    } else {
      blockers.push(
        message(
          "no-compatible-template",
          "No controlled storefront foundation supports this brief.",
        ),
      );
    }
  }

  const resolverWarnings =
    selectedResolution?.status === "resolved"
      ? selectedResolution.plan.warnings.map(({ code, message: text }) => ({ code, message: text }))
      : [];
  const warnings = [...resolverWarnings];
  const status =
    blockers.length > 0 ? "blocked" : warnings.length > 0 ? "selected-with-warnings" : "selected";
  const resolvedPagePlans =
    selectedResolution?.status === "resolved" ? selectedResolution.plan.pagePlans : [];
  const planId = `selection_${stableHash(
    canonicalValueString({
      briefId: brief.id,
      briefFingerprint: createStorefrontTemplateSelectionBriefFingerprint(brief),
      preferredTemplateId: preferred ?? null,
      selectedTemplateId,
      status,
      candidates: evaluation.candidates,
    }),
  )}`;
  const briefFingerprint = createStorefrontTemplateSelectionBriefFingerprint(brief);
  const plan = {
    schemaVersion: STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION,
    id: planId,
    briefId: brief.id,
    briefFingerprint,
    selectedTemplateId,
    selectionSource: source,
    status,
    candidates: [...evaluation.candidates],
    explanation: explanationFor(selectedTemplateId, source, status === "blocked"),
    assumptions: [
      "Optional visual preferences use the brief's controlled defaults when unspecified.",
      "Template selection does not create storefront pages or sections.",
    ],
    warnings: [...warnings],
    blockers: [...blockers],
    resolvedPagePlans: [...resolvedPagePlans],
  };
  return cloneStorefrontTemplateSelectionPlan(
    currentStorefrontTemplateSelectionPlanSchema.parse(plan),
  );
}
