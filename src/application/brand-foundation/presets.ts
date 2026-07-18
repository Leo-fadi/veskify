import {
  brandFoundationPresetSchema,
  type BrandFoundationPreset,
  type LocalizedPlanCopy,
} from "./contract";

const styles = ["minimal", "editorial", "luxury", "playful", "bold", "natural"] as const;

const copy = (en: string, fi: string): LocalizedPlanCopy => ({ en, fi });

const presetDefinitions: readonly BrandFoundationPreset[] = [
  {
    id: "clean-minimal-v1",
    version: 1,
    name: copy("Clean minimal", "Puhdas minimalismi"),
    description: copy(
      "Calm structure, generous whitespace and quiet contrast.",
      "Rauhallinen rakenne, väljä tila ja hillitty kontrasti.",
    ),
    supportedVisualStyleDirections: ["minimal"],
    suitability: {
      defaultRank: 10,
      industryWeights: { health: 10, services: 9, electronics: 8, other: 8 },
    },
    brandSystem: {
      colors: {
        primary: "#1F2937",
        secondary: "#6B7280",
        accent: "#9CA3AF",
        background: "#F7F7F5",
        surface: "#FFFFFF",
        text: "#171717",
        mutedText: "#5B5B5B",
        border: "#D8D8D2",
      },
      typography: {
        headingFont: "system-sans",
        bodyFont: "system-sans",
        baseSize: 16,
        scaleRatio: 1.2,
        headingWeight: 600,
        bodyWeight: 400,
      },
      shape: { radius: "subtle" },
      spacing: { density: "airy" },
      imagery: { style: "studio" },
      voice: {
        formality: "balanced",
        detail: "concise",
        positioning: "balanced",
        warmth: "neutral",
        energy: "direct",
      },
    },
  },
  {
    id: "editorial-v1",
    version: 1,
    name: copy("Editorial", "Redaktionaalinen"),
    description: copy(
      "A considered magazine-like foundation for stories and collections.",
      "Harkittu aikakauslehtimäinen pohja tarinoille ja kokoelmille.",
    ),
    supportedVisualStyleDirections: ["editorial"],
    suitability: {
      defaultRank: 20,
      industryWeights: { fashion: 10, jewellery: 9, watches: 9, services: 8, other: 7 },
    },
    brandSystem: {
      colors: {
        primary: "#6B4F3A",
        secondary: "#75665A",
        accent: "#B9895B",
        background: "#FAF8F3",
        surface: "#FFFFFF",
        text: "#29231D",
        mutedText: "#65594E",
        border: "#DCCFC0",
      },
      typography: {
        headingFont: "georgia",
        bodyFont: "inter",
        baseSize: 16,
        scaleRatio: 1.3,
        headingWeight: 600,
        bodyWeight: 400,
      },
      shape: { radius: "subtle" },
      spacing: { density: "airy" },
      imagery: { style: "editorial" },
      voice: {
        formality: "formal",
        detail: "descriptive",
        positioning: "premium",
        warmth: "balanced",
        energy: "inspirational",
      },
    },
  },
  {
    id: "premium-luxury-v1",
    version: 1,
    name: copy("Premium luxury", "Ensiluokkainen ylellisyys"),
    description: copy(
      "Warm materials, confident type and a high-trust premium feel.",
      "Lämpimät materiaalit, varma typografia ja luottamusta rakentava ylellinen tunnelma.",
    ),
    supportedVisualStyleDirections: ["luxury"],
    suitability: {
      defaultRank: 30,
      industryWeights: { jewellery: 10, watches: 10, fashion: 8, beauty: 8, other: 6 },
    },
    brandSystem: {
      colors: {
        primary: "#6E4525",
        secondary: "#1F2A44",
        accent: "#B5894A",
        background: "#FCF8F1",
        surface: "#FFFFFF",
        text: "#1A1714",
        mutedText: "#5C5147",
        border: "#DCCBB2",
      },
      typography: {
        headingFont: "georgia",
        bodyFont: "georgia",
        baseSize: 16,
        scaleRatio: 1.28,
        headingWeight: 600,
        bodyWeight: 400,
      },
      shape: { radius: "rounded" },
      spacing: { density: "airy" },
      imagery: { style: "studio" },
      voice: {
        formality: "formal",
        detail: "balanced",
        positioning: "premium",
        warmth: "warm",
        energy: "inspirational",
      },
    },
  },
  {
    id: "playful-v1",
    version: 1,
    name: copy("Playful", "Leikkisä"),
    description: copy(
      "Bright accents and friendly rhythm for an approachable storefront.",
      "Kirkkaat korostukset ja ystävällinen rytmi helposti lähestyttävään kauppaan.",
    ),
    supportedVisualStyleDirections: ["playful"],
    suitability: {
      defaultRank: 40,
      industryWeights: { beauty: 10, food: 9, fashion: 8, sports: 8, other: 7 },
    },
    brandSystem: {
      colors: {
        primary: "#6D28D9",
        secondary: "#DB2777",
        accent: "#D97706",
        background: "#FFFDF8",
        surface: "#FFFFFF",
        text: "#1F2937",
        mutedText: "#5B6472",
        border: "#E7DCCB",
      },
      typography: {
        headingFont: "inter",
        bodyFont: "inter",
        baseSize: 16,
        scaleRatio: 1.2,
        headingWeight: 700,
        bodyWeight: 400,
      },
      shape: { radius: "pill" },
      spacing: { density: "balanced" },
      imagery: { style: "lifestyle" },
      voice: {
        formality: "casual",
        detail: "concise",
        positioning: "accessible",
        warmth: "warm",
        energy: "inspirational",
      },
    },
  },
  {
    id: "bold-v1",
    version: 1,
    name: copy("Bold", "Rohkea"),
    description: copy(
      "Strong contrast and direct hierarchy for confident product presentation.",
      "Vahva kontrasti ja suora hierarkia vakuuttavaan tuote-esittelyyn.",
    ),
    supportedVisualStyleDirections: ["bold"],
    suitability: {
      defaultRank: 50,
      industryWeights: { electronics: 10, sports: 10, fashion: 8, food: 7, other: 7 },
    },
    brandSystem: {
      colors: {
        primary: "#111827",
        secondary: "#B91C1C",
        accent: "#D97706",
        background: "#FFFFFF",
        surface: "#F8FAFC",
        text: "#111827",
        mutedText: "#4B5563",
        border: "#CBD5E1",
      },
      typography: {
        headingFont: "inter",
        bodyFont: "inter",
        baseSize: 16,
        scaleRatio: 1.3,
        headingWeight: 700,
        bodyWeight: 500,
      },
      shape: { radius: "square" },
      spacing: { density: "compact" },
      imagery: { style: "mixed" },
      voice: {
        formality: "balanced",
        detail: "balanced",
        positioning: "balanced",
        warmth: "neutral",
        energy: "direct",
      },
    },
  },
  {
    id: "natural-v1",
    version: 1,
    name: copy("Natural", "Luonnollinen"),
    description: copy(
      "Grounded greens and warm neutrals for an honest, welcoming feel.",
      "Maanläheiset vihreät ja lämpimät neutraalit rehelliseen, kutsuvaan tunnelmaan.",
    ),
    supportedVisualStyleDirections: ["natural"],
    suitability: {
      defaultRank: 60,
      industryWeights: { home: 10, food: 10, beauty: 9, health: 9, other: 8 },
    },
    brandSystem: {
      colors: {
        primary: "#356859",
        secondary: "#6A8D73",
        accent: "#B8753B",
        background: "#F5F7F0",
        surface: "#FFFFFF",
        text: "#203229",
        mutedText: "#52645A",
        border: "#D1DCCF",
      },
      typography: {
        headingFont: "system-serif",
        bodyFont: "inter",
        baseSize: 16,
        scaleRatio: 1.22,
        headingWeight: 600,
        bodyWeight: 400,
      },
      shape: { radius: "rounded" },
      spacing: { density: "balanced" },
      imagery: { style: "lifestyle" },
      voice: {
        formality: "balanced",
        detail: "descriptive",
        positioning: "accessible",
        warmth: "warm",
        energy: "balanced",
      },
    },
  },
];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

export const brandFoundationPresetRegistry: readonly BrandFoundationPreset[] = deepFreeze(
  presetDefinitions.map((preset) => brandFoundationPresetSchema.parse(structuredClone(preset))),
);

export function listBrandFoundationPresets(): readonly BrandFoundationPreset[] {
  return structuredClone(brandFoundationPresetRegistry).map((preset) => deepFreeze(preset));
}

export function getBrandFoundationPreset(id: string): BrandFoundationPreset | undefined {
  const preset = brandFoundationPresetRegistry.find((candidate) => candidate.id === id);
  return preset ? deepFreeze(structuredClone(preset)) : undefined;
}

export function validateBrandFoundationRegistry(): true {
  const ids = new Set<string>();
  for (const preset of brandFoundationPresetRegistry) {
    brandFoundationPresetSchema.parse(preset);
    if (ids.has(preset.id)) throw new Error(`Duplicate brand foundation preset: ${preset.id}`);
    ids.add(preset.id);
  }
  return true;
}

export const brandFoundationPresetIds = Object.freeze(styles.map((style) => `${style}-v1`));
