import { describe, expect, it } from "vitest";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";
import { generateGuidedStorefront } from "@/application/guided-storefront-generation";
import {
  createStorefrontGenerationReview,
  validateStorefrontGenerationReview,
} from "@/application/storefront-generation-review";

const createdAt = "2026-07-19T11:00:00.000Z";

function runReview(
  primaryLanguage: "en" | "fi",
  catalogueContext: "controlled-demo-catalogue" | "empty-catalogue",
  preferredTemplateId?: string,
) {
  const brief = normalizeStorefrontDesignBriefInput({
    id: `brief_review_integration_${primaryLanguage}_${catalogueContext}`,
    createdAt,
    updatedAt: createdAt,
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: primaryLanguage === "fi" ? "Pohjoinen Studio" : "North Star Studio",
      shortDescription:
        primaryLanguage === "fi" ? "Harkittuja koruja." : "Quietly considered jewellery.",
      industry: "jewellery",
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: {
      selectedLanguages: primaryLanguage === "fi" ? ["fi"] : ["en", "fi"],
      primaryLanguage,
    },
    catalogueContext,
  });
  const plan = generateGuidedStorefront({
    brief,
    projectId: "project_review_integration",
    snapshotId: `snapshot_review_integration_${primaryLanguage}`,
    catalogueRef: `catalogue_${catalogueContext}`,
    createdAt,
    preferredTemplateId,
  });
  return { brief, plan, review: createStorefrontGenerationReview(plan, brief) };
}

describe("storefront generation review application boundary", () => {
  it("projects EN/FI and retains empty-catalogue readiness warnings", () => {
    const { plan, review } = runReview("en", "empty-catalogue", "template_balanced_commerce");
    expect(review.briefId).toBe(plan.briefId);
    expect(review.languagePlan).toEqual({ selectedLanguages: ["en", "fi"], primaryLanguage: "en" });
    expect(review.catalogueContext).toBe("empty-catalogue");
    expect(review.canCreateProject).toBe(true);
    expect(review.sections.map((section) => section.id)).toHaveLength(9);
    expect(validateStorefrontGenerationReview(review)).toEqual(review);
  });

  it("preserves Finnish primary language and merchant override", () => {
    const { review } = runReview("fi", "controlled-demo-catalogue", "template_brand_led_editorial");
    expect(review.languagePlan).toEqual({ selectedLanguages: ["fi"], primaryLanguage: "fi" });
    expect(review.selectedTemplateId).toBe("template_brand_led_editorial");
    expect(review.sections.find((section) => section.id === "storefront-template")?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "selection", value: "Merchant preference" }),
      ]),
    );
  });
});
