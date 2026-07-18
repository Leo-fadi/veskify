import { describe, expect, it } from "vitest";
import { aurumNordicBrandSystem } from "@/domain/design-system";
import { normalizeBrief } from "@/domain/design-brief";
import { validateRegisteredSnapshot } from "@/components/registry";
import {
  materializeInitialStorefront,
  planStorefrontTemplateSelection,
} from "@/application/storefront-templates";

describe("initial storefront generation boundary", () => {
  it("selects a controlled foundation, materializes it, and validates the snapshot without persistence", () => {
    const brief = normalizeBrief({
      id: "brief_materializer_integration",
      creationContext: { type: "new-storefront" },
      businessIdentity: {
        businessName: "North Star Goods",
        shortDescription: "A calm collection for thoughtful homes.",
        industry: "home",
        targetCustomer: "Thoughtful shoppers",
        primaryMarket: "Finland",
      },
      storefrontStructure: { pageTypes: ["home", "collection", "product"] },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
      catalogueContext: "controlled-demo-catalogue",
      generationPreferences: {
        merchandisingEmphasis: "high",
        sectionRichness: "rich",
      },
    });
    const selection = planStorefrontTemplateSelection({ brief });
    const generation = materializeInitialStorefront({
      brief,
      templateSelectionPlan: selection,
      brandSystem: aurumNordicBrandSystem,
      projectId: "project_materializer_integration",
      snapshotId: "snapshot_materializer_integration",
      catalogueRef: "catalogue_demo_integration",
      createdAt: "2026-07-18T12:30:00.000Z",
    });

    expect(selection.selectedTemplateId).toBeDefined();
    expect(generation.generatedSnapshot).not.toBeNull();
    expect(() => validateRegisteredSnapshot(generation.generatedSnapshot!)).not.toThrow();
    expect(generation.generatedSnapshot?.pages).toHaveLength(3);
  });
});
