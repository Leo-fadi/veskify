import { describe, expect, it } from "vitest";
import { generateGuidedStorefront } from "@/application/guided-storefront-generation";
import { createStorefrontGenerationReview } from "@/application/storefront-generation-review";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";

describe("O-07 pages handoff", () => {
  it("carries required and optional page selections through P3-10 and P3-13", () => {
    const createdAt = "2026-07-18T08:00:00.000Z";
    const brief = normalizeStorefrontDesignBriefInput({
      id: "brief_o07_pages",
      createdAt,
      updatedAt: createdAt,
      creationContext: { type: "new-storefront" },
      businessIdentity: {
        businessName: "Aurum Nordic",
        shortDescription: "A Helsinki jewellery studio.",
        industry: "jewellery",
        targetCustomer: "Customers looking for Nordic jewellery.",
        primaryMarket: "Finland",
      },
      storefrontStructure: { pageTypes: ["home", "collection", "product", "content"] },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
      catalogueContext: "controlled-demo-catalogue",
    });

    const plan = generateGuidedStorefront({
      brief,
      projectId: "project_o07_pages",
      snapshotId: "snapshot_o07_pages",
      catalogueRef: "catalogue_o07_pages",
      createdAt,
    });
    const review = createStorefrontGenerationReview(plan, brief);

    expect(plan.status).toBe("ready-with-warnings");
    expect(plan.templateSelectionPlan?.resolvedPagePlans.map(({ pageType }) => pageType)).toEqual([
      "home",
      "collection",
      "product",
    ]);
    expect(review.pageSummaries.map(({ type }) => type)).toEqual(["home", "collection", "product"]);
    const templateSection = review.sections.find((section) => section.id === "storefront-template");
    expect(templateSection?.facts.find((fact) => fact.id === "requested-pages")?.value).toBe(
      "home, collection, product, content",
    );
  });
});
