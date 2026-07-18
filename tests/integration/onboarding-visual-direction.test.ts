import { describe, expect, it } from "vitest";
import { planBrandFoundation } from "@/application/brand-foundation";
import { planStorefrontTemplateSelection } from "@/application/storefront-templates";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";

function brief(overrides: Record<string, unknown> = {}) {
  return normalizeStorefrontDesignBriefInput({
    id: "brief_visual_direction_integration",
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: "Aurum Nordic",
      shortDescription: "A Helsinki jewellery studio.",
      industry: "jewellery",
      targetCustomer: "Customers looking for Nordic jewellery.",
      primaryMarket: "Finland",
    },
    brandDirection: {},
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en"], primaryLanguage: "en" },
    catalogueContext: "empty-catalogue",
    generationPreferences: {},
    ...overrides,
  });
}

describe("O-05 visual direction planner integration", () => {
  it("passes a minimal style through the public brand planner", () => {
    const plan = planBrandFoundation(
      brief({ brandDirection: { visualStyleDirection: "minimal" } }),
    );
    expect(plan.selectedPresetId).toBe("clean-minimal-v1");
  });

  it("lets editorial direction reach both deterministic planners", () => {
    const input = brief({
      brandDirection: { visualStyleDirection: "editorial", toneKeywords: ["elegant"] },
      generationPreferences: { visualDensity: "airy", contentEmphasis: "storytelling" },
    });
    const brandPlan = planBrandFoundation(input);
    const templatePlan = planStorefrontTemplateSelection({ brief: input });
    expect(brandPlan.selectedPresetId).toBe("editorial-v1");
    expect(
      templatePlan.candidates.find(
        (candidate) => candidate.templateId === "template_brand_led_editorial",
      )?.reasonCodes,
    ).toContain("story-led-visual-direction");
  });

  it("uses campaign-led promotion prominence in template candidate scoring", () => {
    const plan = planStorefrontTemplateSelection({
      brief: brief({ generationPreferences: { merchandisingEmphasis: "campaign-led" } }),
    });
    expect(
      plan.candidates.find(
        (candidate) => candidate.templateId === "template_catalogue_forward_commerce",
      )?.reasonCodes,
    ).toContain("campaign-led-promotion-prominence");
  });

  it("passes high contrast and canonical tone keywords to brand planning", () => {
    const plan = planBrandFoundation(
      brief({
        brandDirection: { toneKeywords: ["warm", "technical"] },
        generationPreferences: { accessibilityPreference: "high-contrast" },
      }),
    );
    expect(plan.brandSystem.voice.warmth).toBe("warm");
    expect(plan.brandSystem.voice.detail).toBe("concise");
    expect(plan.assumptions.en).toContain(
      "High contrast takes priority over visual styling where readability requires it.",
    );
  });

  it("preserves planner-owned typography and imagery recommendations when unspecified", () => {
    const plan = planBrandFoundation(
      brief({ brandDirection: { visualStyleDirection: "minimal" } }),
    );
    expect(plan.provenance.typography.source).toBe("visual-style-preset");
    expect(plan.provenance.imagery.source).toBe("visual-style-preset");
  });

  it("passes product-focused imagery and strong or soft typography through P3-05", () => {
    const productFocused = planBrandFoundation(
      brief({ brandDirection: { imageryDirection: "product-focused" } }),
    );
    const strong = planBrandFoundation(
      brief({ brandDirection: { typographyDirection: "strong" } }),
    );
    const soft = planBrandFoundation(brief({ brandDirection: { typographyDirection: "soft" } }));

    expect(productFocused.brandSystem.imagery.style).toBe("product-focused");
    expect(strong.brandSystem.typography).toMatchObject({ headingWeight: 700, bodyWeight: 500 });
    expect(soft.brandSystem.typography).toMatchObject({ headingWeight: 400, bodyWeight: 400 });
  });

  it("keeps P3-05 and P3-06 deterministic for the corrected SDD choices", () => {
    const input = brief({
      brandDirection: {
        visualStyleDirection: "editorial",
        typographyDirection: "strong",
        imageryDirection: "product-focused",
        toneKeywords: ["elegant", "technical"],
      },
      generationPreferences: {
        visualDensity: "airy",
        merchandisingEmphasis: "campaign-led",
      },
    });
    expect(planBrandFoundation(input)).toEqual(planBrandFoundation(input));
    expect(planStorefrontTemplateSelection({ brief: input })).toEqual(
      planStorefrontTemplateSelection({ brief: input }),
    );
  });
});
