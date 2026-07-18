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
      brandDirection: { visualStyleDirection: "editorial", toneKeywords: ["storytelling"] },
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

  it("uses high merchandising emphasis in template candidate scoring", () => {
    const plan = planStorefrontTemplateSelection({
      brief: brief({ generationPreferences: { merchandisingEmphasis: "high" } }),
    });
    expect(
      plan.candidates.find(
        (candidate) => candidate.templateId === "template_catalogue_forward_commerce",
      )?.reasonCodes,
    ).toContain("high-merchandising-emphasis");
  });

  it("passes high contrast and canonical tone keywords to brand planning", () => {
    const plan = planBrandFoundation(
      brief({
        brandDirection: { toneKeywords: ["warm", "storytelling"] },
        generationPreferences: { accessibilityPreference: "high-contrast" },
      }),
    );
    expect(plan.brandSystem.voice.warmth).toBe("warm");
    expect(plan.brandSystem.voice.detail).toBe("descriptive");
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
});
