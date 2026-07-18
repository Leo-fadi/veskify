import { describe, expect, it } from "vitest";
import {
  BrandFoundationPlannerError,
  brandFoundationPresetIds,
  cloneBrandFoundationPlan,
  getBrandFoundationPreset,
  listBrandFoundationPresets,
  planBrandFoundation,
  validateBrandFoundationRegistry,
} from "@/application/brand-foundation";
import {
  brandSystemSchema,
  contrastRatio,
  highContrastTextMinimum,
  standardTextContrastMinimum,
} from "@/domain/design-system";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";

const now = "2026-07-18T10:00:00.000Z";

function brief(overrides: Record<string, unknown> = {}) {
  return normalizeStorefrontDesignBriefInput({
    id: "brief_foundation",
    createdAt: now,
    updatedAt: now,
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: "North Star",
      shortDescription: "A considered independent shop.",
      industry: "jewellery",
      targetCustomer: "People who value lasting design.",
      primaryMarket: "Finland",
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    catalogueContext: "controlled-demo-catalogue",
    ...overrides,
  });
}

describe("brand foundation preset registry", () => {
  it("validates with unique, canonical presets", () => {
    expect(validateBrandFoundationRegistry()).toBe(true);
    const presets = listBrandFoundationPresets();
    expect(presets.map((preset) => preset.id)).toEqual([
      "clean-minimal-v1",
      "editorial-v1",
      "premium-luxury-v1",
      "playful-v1",
      "bold-v1",
      "natural-v1",
    ]);
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
    for (const preset of presets)
      expect(() => brandSystemSchema.parse(preset.brandSystem)).not.toThrow();
  });

  it("does not expose mutable registry state", () => {
    const first = listBrandFoundationPresets()[0];
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.brandSystem)).toBe(true);
    expect(getBrandFoundationPreset(first.id)).not.toBe(first);
  });

  it("round-trips immutable canonical preset IDs in registry order", () => {
    const listedIds = listBrandFoundationPresets().map((preset) => preset.id);

    expect(brandFoundationPresetIds).toEqual(listedIds);
    expect(brandFoundationPresetIds).toEqual([
      "clean-minimal-v1",
      "editorial-v1",
      "premium-luxury-v1",
      "playful-v1",
      "bold-v1",
      "natural-v1",
    ]);
    expect(brandFoundationPresetIds).not.toEqual(
      expect.arrayContaining(["minimal-v1", "luxury-v1"]),
    );
    expect(brandFoundationPresetIds.every((id) => getBrandFoundationPreset(id))).toBe(true);
    expect(Object.isFrozen(brandFoundationPresetIds)).toBe(true);

    const before = listBrandFoundationPresets();
    expect(() => (brandFoundationPresetIds as string[]).push("unexpected-v1")).toThrow();
    expect(brandFoundationPresetIds).toEqual(listedIds);
    expect(listBrandFoundationPresets()).toEqual(before);
  });
});

describe("planBrandFoundation", () => {
  it("maps every visual direction to its controlled preset", () => {
    for (const [direction, presetId] of [
      ["minimal", "clean-minimal-v1"],
      ["editorial", "editorial-v1"],
      ["luxury", "premium-luxury-v1"],
      ["playful", "playful-v1"],
      ["bold", "bold-v1"],
      ["natural", "natural-v1"],
    ] as const) {
      expect(
        planBrandFoundation(brief({ brandDirection: { visualStyleDirection: direction } }))
          .selectedPresetId,
      ).toBe(presetId);
    }
  });

  it.each([
    ["serif-led", "georgia", "system-serif"],
    ["sans-led", "inter", "inter"],
    ["mixed", "georgia", "inter"],
  ] as const)("maps %s typography to approved font tokens", (direction, headingFont, bodyFont) => {
    const plan = planBrandFoundation(brief({ brandDirection: { typographyDirection: direction } }));
    expect(plan.brandSystem.typography).toMatchObject({ headingFont, bodyFont });
  });

  it.each([
    ["strong", 700, 500],
    ["soft", 400, 400],
  ] as const)(
    "maps %s typography to deterministic weights",
    (direction, headingWeight, bodyWeight) => {
      const plan = planBrandFoundation(
        brief({ brandDirection: { typographyDirection: direction } }),
      );
      expect(plan.brandSystem.typography).toMatchObject({ headingWeight, bodyWeight });
    },
  );

  it("maps density, imagery, content emphasis and tone without new enum values", () => {
    const plan = planBrandFoundation(
      brief({
        brandDirection: {
          visualStyleDirection: "natural",
          imageryDirection: "editorial",
          toneKeywords: ["elegant", "warm"],
        },
        generationPreferences: { visualDensity: "compact", contentEmphasis: "storytelling" },
      }),
    );
    expect(plan.brandSystem.spacing.density).toBe("compact");
    expect(plan.brandSystem.imagery.style).toBe("editorial");
    expect(plan.brandSystem.voice).toMatchObject({
      detail: "descriptive",
      formality: "formal",
      positioning: "premium",
      warmth: "warm",
    });
  });

  it("uses business suitability when visual style is not specified", () => {
    expect(planBrandFoundation(brief()).selectedPresetId).toBe("premium-luxury-v1");
  });

  it("normalizes and preserves safe preferred colours", () => {
    const plan = planBrandFoundation(
      brief({ brandDirection: { preferredBrandColours: ["#123456", "#334455"] } }),
    );
    expect(plan.brandSystem.colors.primary).toBe("#123456");
    expect(plan.brandSystem.colors.accent).toBe("#334455");
  });

  it("adjusts unsafe preferred emphasis colours with a structured warning", () => {
    const plan = planBrandFoundation(
      brief({ brandDirection: { preferredBrandColours: ["#FFFFFF"] } }),
    );
    expect(plan.status).toBe("ready-with-warnings");
    expect(plan.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "preferred-colour-low-contrast" })]),
    );
    expect(plan.brandSystem.colors.secondary).toBe("#ffffff");
    expect(
      contrastRatio(plan.brandSystem.colors.text, plan.brandSystem.colors.background),
    ).toBeGreaterThanOrEqual(standardTextContrastMinimum);
  });

  it("keeps high-contrast text pairings readable and records the accessibility precedence", () => {
    const plan = planBrandFoundation(
      brief({
        brandDirection: { visualStyleDirection: "luxury" },
        generationPreferences: { accessibilityPreference: "high-contrast" },
      }),
    );
    expect(
      contrastRatio(plan.brandSystem.colors.text, plan.brandSystem.colors.background),
    ).toBeGreaterThanOrEqual(highContrastTextMinimum);
    expect(
      contrastRatio(plan.brandSystem.colors.text, plan.brandSystem.colors.surface),
    ).toBeGreaterThanOrEqual(highContrastTextMinimum);
    expect(plan.assumptions.en).toContain(
      "High contrast takes priority over visual styling where readability requires it.",
    );
    expect(plan.provenance.colors.source).toBe("accessibility");
  });

  it("is deterministic, immutable and does not mutate the brief", () => {
    const input = brief({
      brandDirection: { visualStyleDirection: "editorial", preferredBrandColours: ["#AABBCC"] },
    });
    const before = structuredClone(input);
    const first = planBrandFoundation(input);
    const second = planBrandFoundation(input);
    expect(first).toEqual(second);
    expect(input).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    const clone = cloneBrandFoundationPlan(first);
    expect(clone).toEqual(first);
    expect(Object.isFrozen(clone)).toBe(true);
  });

  it("uses safe defaults for optional preferences", () => {
    const plan = planBrandFoundation(brief());
    expect(plan.status).toBe("ready");
    expect(plan.assumptions.en.length).toBeGreaterThan(0);
    expect(plan.brandSystem).toBeDefined();
  });

  it("rejects corrupt input with a typed planner error", () => {
    expect(() => planBrandFoundation({ id: "not-a-brief" })).toThrow(BrandFoundationPlannerError);
  });
});
