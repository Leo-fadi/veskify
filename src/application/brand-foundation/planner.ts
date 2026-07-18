import { validateStorefrontDesignBrief, type StorefrontDesignBrief } from "@/domain/design-brief";
import {
  brandSystemSchema,
  contrastRatio,
  highContrastTextMinimum,
  standardTextContrastMinimum,
  type BrandSystem,
} from "@/domain/design-system";
import { brandFoundationPresetRegistry } from "./presets";
import {
  BRAND_FOUNDATION_PLAN_SCHEMA_VERSION,
  BRAND_FOUNDATION_PLANNER_SOURCE_VERSION,
  brandFoundationPlanSchema,
  type BrandFoundationPlan,
  type BrandFoundationProvenance,
  type BrandFoundationWarning,
  type LocalizedPlanCopy,
  BrandFoundationPlannerError,
} from "./contract";

const copy = (en: string, fi: string): LocalizedPlanCopy => ({ en, fi });

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeHex(value: string): string {
  return value.trim().toLowerCase();
}

function normalizedPlanningBrief(brief: StorefrontDesignBrief): StorefrontDesignBrief {
  const clone = structuredClone(brief);
  clone.brandDirection.preferredBrandColours =
    clone.brandDirection.preferredBrandColours.map(normalizeHex);
  clone.brandDirection.toneKeywords = [...clone.brandDirection.toneKeywords];
  return clone;
}

function selectedPreset(brief: StorefrontDesignBrief) {
  const style = brief.brandDirection.visualStyleDirection;
  if (style) {
    return (
      brandFoundationPresetRegistry.find((preset) =>
        preset.supportedVisualStyleDirections.includes(style),
      ) ?? brandFoundationPresetRegistry[0]
    );
  }

  const industry = brief.businessIdentity.industry;
  return [...brandFoundationPresetRegistry].sort((left, right) => {
    const leftScore = industry ? (left.suitability.industryWeights[industry] ?? 0) : 0;
    const rightScore = industry ? (right.suitability.industryWeights[industry] ?? 0) : 0;
    return rightScore - leftScore || left.suitability.defaultRank - right.suitability.defaultRank;
  })[0];
}

function warning(code: string, en: string, fi: string): BrandFoundationWarning {
  return { code, severity: "warning", message: copy(en, fi) };
}

function source(source: BrandFoundationProvenance["colors"]["source"], en: string, fi: string) {
  return { source, detail: copy(en, fi) };
}

function typographyFor(
  direction: StorefrontDesignBrief["brandDirection"]["typographyDirection"],
  base: BrandSystem["typography"],
): BrandSystem["typography"] {
  if (direction === "serif-led")
    return { ...base, headingFont: "georgia", bodyFont: "system-serif" };
  if (direction === "sans-led") return { ...base, headingFont: "inter", bodyFont: "inter" };
  if (direction === "mixed") return { ...base, headingFont: "georgia", bodyFont: "inter" };
  if (direction === "strong") return { ...base, headingWeight: 700, bodyWeight: 500 };
  if (direction === "soft") return { ...base, headingWeight: 400, bodyWeight: 400 };
  return base;
}

function voiceFor(brief: StorefrontDesignBrief, base: BrandSystem["voice"]): BrandSystem["voice"] {
  const style = brief.brandDirection.visualStyleDirection;
  const voice = { ...base };
  if (style === "luxury" || style === "editorial") voice.positioning = "premium";
  if (style === "playful" || style === "natural") voice.positioning = "accessible";
  if (style === "minimal") voice.energy = "direct";
  if (style === "bold") voice.energy = "direct";
  if (style === "playful" || style === "natural") voice.warmth = "warm";

  for (const keyword of brief.brandDirection.toneKeywords) {
    const normalized = keyword.toLocaleLowerCase();
    if (normalized === "elegant") {
      voice.formality = "formal";
      voice.positioning = "premium";
    }
    if (normalized === "modern" || normalized === "bold") voice.energy = "direct";
    if (normalized === "warm") voice.warmth = "warm";
    if (normalized === "minimal") voice.detail = "concise";
    if (normalized === "playful") {
      voice.formality = "casual";
      voice.positioning = "accessible";
      voice.energy = "inspirational";
    }
    if (normalized === "technical") {
      voice.formality = "formal";
      voice.detail = "concise";
      voice.energy = "direct";
    }
  }
  const emphasis = brief.generationPreferences.contentEmphasis;
  if (emphasis === "concise") voice.detail = "concise";
  if (emphasis === "storytelling") voice.detail = "descriptive";
  return voice;
}

function applyColours(
  brand: BrandSystem,
  brief: StorefrontDesignBrief,
  warnings: BrandFoundationWarning[],
): BrandSystem["colors"] {
  const colours = { ...brand.colors };
  const preferred = [...new Set(brief.brandDirection.preferredBrandColours.map(normalizeHex))];
  let preserved = false;
  for (const [index, colour] of preferred.entries()) {
    const safeForEmphasis = contrastRatio(colour, colours.background) >= 3;
    if (index === 0) {
      if (safeForEmphasis) {
        colours.primary = colour;
        preserved = true;
      } else {
        colours.secondary = colour;
        preserved = true;
        warnings.push(
          warning(
            "preferred-colour-low-contrast",
            "A preferred colour was kept as an accent colour because it is not strong enough for the primary emphasis.",
            "Yksi toivottu väri säilytettiin korostusvärinä, koska sen kontrasti ei riitä pääkorostukseen.",
          ),
        );
      }
    } else if (index === 1) {
      if (safeForEmphasis) colours.accent = colour;
      else
        warnings.push(
          warning(
            "preferred-colour-low-contrast",
            "A preferred colour was kept out of the primary emphasis because its contrast is too low.",
            "Yksi toivottu väri jätettiin pääkorostuksen ulkopuolelle liian matalan kontrastin vuoksi.",
          ),
        );
    } else if (index === 2) {
      colours.secondary = colour;
      preserved = true;
    }
  }
  if (preferred.length > 0 && !preserved) colours.secondary = preferred[0];
  return colours;
}

function enforceAccessibility(
  brand: BrandSystem,
  preference: StorefrontDesignBrief["generationPreferences"]["accessibilityPreference"],
  warnings: BrandFoundationWarning[],
) {
  const required =
    preference === "high-contrast" ? highContrastTextMinimum : standardTextContrastMinimum;
  if (
    contrastRatio(brand.colors.text, brand.colors.background) >= required &&
    contrastRatio(brand.colors.text, brand.colors.surface) >= required
  )
    return brand;

  warnings.push(
    warning(
      "accessibility-colour-adjustment",
      "Text and surface colours were adjusted to keep the storefront easy to read.",
      "Tekstin ja pintojen värejä säädettiin, jotta kauppa säilyy helppolukuisena.",
    ),
  );
  return {
    ...brand,
    colors: {
      ...brand.colors,
      background: "#FFFFFF",
      surface: "#FFFFFF",
      text: "#111111",
      mutedText: "#333333",
      border: "#555555",
    },
  };
}

export function planBrandFoundation(input: unknown): BrandFoundationPlan {
  let brief: StorefrontDesignBrief;
  try {
    brief = validateStorefrontDesignBrief(input);
  } catch {
    throw new BrandFoundationPlannerError(
      "invalid-brief",
      "The storefront design brief is not valid enough to create a brand foundation.",
    );
  }

  const planningBrief = normalizedPlanningBrief(brief);
  const preset = selectedPreset(planningBrief);
  const warnings: BrandFoundationWarning[] = [];
  const assumptions = { en: [] as string[], fi: [] as string[] };
  const style = planningBrief.brandDirection.visualStyleDirection;
  if (!style) {
    assumptions.en.push(
      `The ${preset.name.en} foundation was selected from the available business context.`,
    );
    assumptions.fi.push(
      `${preset.name.fi}-pohja valittiin saatavilla olevan yrityskontekstin perusteella.`,
    );
  }
  if (!planningBrief.brandDirection.typographyDirection) {
    assumptions.en.push(
      "The preset typography was kept because no typography preference was provided.",
    );
    assumptions.fi.push(
      "Esiasetuksen typografia säilytettiin, koska typografiatoivetta ei annettu.",
    );
  }
  if (!planningBrief.brandDirection.imageryDirection) {
    assumptions.en.push(
      "The preset imagery direction was kept because no imagery preference was provided.",
    );
    assumptions.fi.push("Esiasetuksen kuvasuunta säilytettiin, koska kuvasuuntaa ei annettu.");
  }
  if (planningBrief.brandDirection.preferredBrandColours.length === 0) {
    assumptions.en.push(
      "The preset colour roles were used because no preferred brand colours were provided.",
    );
    assumptions.fi.push(
      "Esiasetuksen värien roolit otettiin käyttöön, koska toivottuja brändivärejä ei annettu.",
    );
  }

  let brand: BrandSystem = structuredClone(preset.brandSystem);
  brand = {
    ...brand,
    typography: typographyFor(planningBrief.brandDirection.typographyDirection, brand.typography),
    colors: applyColours(brand, planningBrief, warnings),
    spacing: { density: planningBrief.generationPreferences.visualDensity },
    imagery: planningBrief.brandDirection.imageryDirection
      ? { style: planningBrief.brandDirection.imageryDirection }
      : brand.imagery,
    voice: voiceFor(planningBrief, brand.voice),
  };
  if (planningBrief.generationPreferences.visualDensity === "compact")
    brand.shape = { radius: style === "playful" ? "rounded" : brand.shape.radius };
  brand = enforceAccessibility(
    brand,
    planningBrief.generationPreferences.accessibilityPreference,
    warnings,
  );
  brand = brandSystemSchema.parse(brand);

  const provenance: BrandFoundationProvenance = {
    colors: source(
      planningBrief.brandDirection.preferredBrandColours.length > 0
        ? "merchant-preference"
        : "visual-style-preset",
      planningBrief.brandDirection.preferredBrandColours.length > 0
        ? "Preferred merchant colours were applied only to safe emphasis roles."
        : "Colour roles come from the selected visual-style preset.",
      planningBrief.brandDirection.preferredBrandColours.length > 0
        ? "Kauppiaan toivomia värejä käytettiin vain turvallisissa korostusrooleissa."
        : "Värien roolit tulevat valitusta visuaalisesta esiasetuksesta.",
    ),
    typography: source(
      planningBrief.brandDirection.typographyDirection
        ? "typography-preference"
        : "visual-style-preset",
      planningBrief.brandDirection.typographyDirection
        ? "The merchant typography direction selected the approved font pairing."
        : "The selected preset supplied the approved font pairing.",
      planningBrief.brandDirection.typographyDirection
        ? "Kauppiaan typografiatoive valitsi hyväksytyn fonttiparin."
        : "Valittu esiasetus toimitti hyväksytyn fonttiparin.",
    ),
    shape: source(
      "visual-style-preset",
      "Shape and type scale follow the selected visual-style preset.",
      "Muoto ja typografinen asteikko seuraavat valittua visuaalista esiasetusta.",
    ),
    spacing: source(
      "generation-preference",
      "Spacing density follows the generation preference.",
      "Väljyys seuraa generointiasetusta.",
    ),
    imagery: source(
      planningBrief.brandDirection.imageryDirection ? "merchant-preference" : "visual-style-preset",
      planningBrief.brandDirection.imageryDirection
        ? "The merchant imagery direction selected the approved imagery style."
        : "The selected preset supplied the imagery style.",
      planningBrief.brandDirection.imageryDirection
        ? "Kauppiaan kuvasuunta valitsi hyväksytyn kuvatyylin."
        : "Valittu esiasetus toimitti kuvatyylin.",
    ),
    voice: source(
      planningBrief.brandDirection.toneKeywords.length > 0 ||
        planningBrief.generationPreferences.contentEmphasis !== "balanced"
        ? "merchant-preference"
        : "visual-style-preset",
      "Tone keywords and content emphasis shape the approved brand voice.",
      "Sävyavainsanat ja sisällön painotus muokkaavat hyväksyttyä brändiääntä.",
    ),
  };

  if (planningBrief.generationPreferences.accessibilityPreference === "high-contrast") {
    assumptions.en.push(
      "High contrast takes priority over visual styling where readability requires it.",
    );
    assumptions.fi.push("Suuri kontrasti ohittaa visuaalisen tyylin, kun luettavuus sitä vaatii.");
    provenance.colors = source(
      "accessibility",
      "High-contrast safeguards take priority over visual styling.",
      "Suuren kontrastin suojaukset ohittavat visuaalisen tyylin.",
    );
  }

  const status = warnings.length > 0 ? "ready-with-warnings" : "ready";
  const sourceForId = JSON.stringify({
    sourceVersion: BRAND_FOUNDATION_PLANNER_SOURCE_VERSION,
    brief: planningBrief,
  });
  const plan = {
    schemaVersion: BRAND_FOUNDATION_PLAN_SCHEMA_VERSION,
    sourceVersion: BRAND_FOUNDATION_PLANNER_SOURCE_VERSION,
    id: `brand-foundation-plan-${stableHash(sourceForId)}`,
    briefId: planningBrief.id,
    status,
    brandSystem: brand,
    selectedPresetId: preset.id,
    explanation: copy(
      `A safe ${preset.name.en.toLocaleLowerCase()} starting point is ready for editing.`,
      `Turvallinen ${preset.name.fi.toLocaleLowerCase()}-pohja on valmis muokattavaksi.`,
    ),
    assumptions,
    warnings,
    provenance,
  } satisfies BrandFoundationPlan;
  try {
    return deepFreeze(brandFoundationPlanSchema.parse(structuredClone(plan)));
  } catch {
    throw new BrandFoundationPlannerError(
      "invalid-plan",
      "The brand foundation planner could not produce a valid canonical BrandSystem.",
    );
  }
}

export function cloneBrandFoundationPlan(plan: BrandFoundationPlan): BrandFoundationPlan {
  return deepFreeze(brandFoundationPlanSchema.parse(structuredClone(plan)));
}
