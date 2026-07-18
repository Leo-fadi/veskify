import { describe, expect, it } from "vitest";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";
import { validateRegisteredSnapshot } from "@/components/registry";
import {
  generateGuidedStorefront,
  validateGuidedStorefrontGenerationPlan,
} from "@/application/guided-storefront-generation";
import { validateInitialStorefrontGenerationPlan } from "@/application/storefront-templates";

const createdAt = "2026-07-18T14:00:00.000Z";

function makeBrief(
  primaryLanguage: "en" | "fi",
  catalogueContext: "empty-catalogue" | "controlled-demo-catalogue",
) {
  return normalizeStorefrontDesignBriefInput({
    id: `brief_integration_${primaryLanguage}_${catalogueContext}`,
    createdAt,
    updatedAt: createdAt,
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: primaryLanguage === "fi" ? "Pohjoinen Studio" : "Northern Light Studio",
      shortDescription:
        primaryLanguage === "fi" ? "Harkittuja koruja." : "Quietly considered jewellery.",
      industry: "jewellery",
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: {
      selectedLanguages: primaryLanguage === "en" ? ["en"] : ["en", "fi"],
      primaryLanguage,
    },
    catalogueContext,
  });
}

describe("guided storefront generation application boundary", () => {
  it.each([
    ["English", "en" as const, "empty-catalogue" as const],
    ["Finnish", "fi" as const, "controlled-demo-catalogue" as const],
  ])(
    "composes a valid %s generation without persistence",
    (_label, primaryLanguage, catalogueContext) => {
      const result = generateGuidedStorefront({
        brief: makeBrief(primaryLanguage, catalogueContext),
        projectId: "project_guided_integration",
        snapshotId: `snapshot_guided_${primaryLanguage}`,
        catalogueRef: `catalogue_${catalogueContext}`,
        createdAt,
        preferredTemplateId: "template_balanced_commerce",
      });
      expect(result.status).toMatch(/ready/);
      expect(result.templateSelectionPlan?.briefFingerprint).toMatch(/^brief-selection-v1_/);
      expect(result.initialStorefrontGenerationPlan).not.toBeNull();
      expect(() =>
        validateInitialStorefrontGenerationPlan(result.initialStorefrontGenerationPlan),
      ).not.toThrow();
      expect(() => validateGuidedStorefrontGenerationPlan(result)).not.toThrow();
      expect(result.generatedSnapshot).not.toBeNull();
      expect(result.generatedSnapshot?.pages.map((page) => page.type)).toEqual([
        "home",
        "collection",
        "product",
      ]);
      expect(() => validateRegisteredSnapshot(result.generatedSnapshot!)).not.toThrow();
    },
  );
});
