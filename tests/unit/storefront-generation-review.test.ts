import { describe, expect, it } from "vitest";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";
import { createStorefrontDesignBriefFingerprint } from "@/domain/design-brief";
import { generateGuidedStorefront } from "@/application/guided-storefront-generation";
import {
  cloneStorefrontGenerationReview,
  createStorefrontGenerationReview,
  createStorefrontGenerationReviewId,
  StorefrontGenerationReviewError,
  validateStorefrontGenerationReview,
} from "@/application/storefront-generation-review";

const createdAt = "2026-07-19T10:00:00.000Z";

function brief(overrides: Record<string, unknown> = {}) {
  return normalizeStorefrontDesignBriefInput({
    id: "brief_review_test",
    createdAt,
    updatedAt: createdAt,
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: "North Star Jewellery",
      shortDescription: "Quietly considered jewellery.",
      industry: "jewellery",
      targetCustomer: "Thoughtful gift shoppers",
      primaryMarket: "Finland",
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    catalogueContext: "controlled-demo-catalogue",
    ...overrides,
  });
}

function generation(overrides: Record<string, unknown> = {}) {
  const currentBrief = brief(overrides);
  return {
    currentBrief,
    plan: generateGuidedStorefront({
      brief: currentBrief,
      projectId: "project_review_test",
      snapshotId: "snapshot_review_test",
      catalogueRef: "catalogue_review_test",
      createdAt,
      preferredTemplateId: "template_balanced_commerce",
    }),
  };
}

describe("storefront generation review projection", () => {
  it("projects a ready generation into fixed merchant-readable sections", () => {
    const { plan, currentBrief } = generation();
    const review = createStorefrontGenerationReview(plan, currentBrief);
    expect(review.briefFingerprint).toBe(plan.briefFingerprint);
    expect(review.status).toBe("ready-with-warnings");
    expect(review.canCreateProject).toBe(true);
    expect(review.sections.map((section) => section.id)).toEqual([
      "business",
      "brand-foundation",
      "storefront-template",
      "storefront-pages",
      "languages",
      "catalogue",
      "assumptions",
      "warnings",
      "blockers",
    ]);
    expect(review.title.en).toBeTruthy();
    expect(review.title.fi).toBeTruthy();
    expect(review.sections.find((section) => section.id === "business")?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "business-name", value: "North Star Jewellery" }),
        expect.objectContaining({ id: "target-customer", value: "Thoughtful gift shoppers" }),
      ]),
    );
    expect(review.pageSummaries.map((page) => page.type)).toEqual([
      "home",
      "collection",
      "product",
    ]);
    expect(
      review.pageSummaries.every((page) => page.componentIds.length === page.totalSectionCount),
    ).toBe(true);
    expect(
      review.sourceDiagnostics.every(
        (diagnostic) => diagnostic.context.en.length > 0 && diagnostic.context.fi.length > 0,
      ),
    ).toBe(true);
  });

  it("preserves merchant text and exact language selection without translating it", () => {
    const currentBrief = brief({
      businessIdentity: {
        businessName: "Pohjoinen Studio",
        shortDescription: "Harkittuja koruja.",
        industry: "jewellery",
      },
      languagePlan: { selectedLanguages: ["fi"], primaryLanguage: "fi" },
    });
    const plan = generateGuidedStorefront({
      brief: currentBrief,
      projectId: "project_review_fi",
      snapshotId: "snapshot_review_fi",
      catalogueRef: "catalogue_review_fi",
      createdAt,
    });
    const review = createStorefrontGenerationReview(plan, currentBrief);
    expect(review.languagePlan).toEqual({ selectedLanguages: ["fi"], primaryLanguage: "fi" });
    expect(review.sections.find((section) => section.id === "business")?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "business-name", value: "Pohjoinen Studio" }),
        expect.objectContaining({ id: "short-description", value: "Harkittuja koruja." }),
      ]),
    );
  });

  it("preserves warning diagnostics and catalogue context", () => {
    const { plan, currentBrief } = generation({ catalogueContext: "empty-catalogue" });
    const review = createStorefrontGenerationReview(plan, currentBrief);
    expect(review.status).toBe("ready-with-warnings");
    expect(review.catalogueContext).toBe("empty-catalogue");
    expect(review.warnings.map((warning) => warning.code)).toContain(
      "EMPTY_CATALOGUE_MERCHANDISING",
    );
    expect(review.sections.find((section) => section.id === "catalogue")?.status).toBe("warning");
  });

  it("rejects every same-ID canonical brief mutation while accepting detached equivalents", () => {
    const { plan, currentBrief } = generation();
    const detached = structuredClone(currentBrief);
    expect(createStorefrontGenerationReview(plan, detached).briefFingerprint).toBe(
      createStorefrontDesignBriefFingerprint(detached),
    );
    const mutations = [
      { businessIdentity: { businessName: "Changed" } },
      { businessIdentity: { shortDescription: "Changed description" } },
      { creationContext: { type: "demo-storefront" } },
      { languagePlan: { selectedLanguages: ["fi"], primaryLanguage: "fi" } },
      { catalogueContext: "empty-catalogue" },
      { brandDirection: { visualStyleDirection: "editorial" } },
    ];
    mutations.forEach((mutation) => {
      const changed = brief(mutation);
      expect(() => createStorefrontGenerationReview(plan, changed)).toThrow(
        expect.objectContaining({ code: "inconsistent-review-source" }),
      );
    });
  });

  it("projects blocked plans without fabricated pages and disables creation", () => {
    const currentBrief = brief();
    const plan = generateGuidedStorefront({
      brief: currentBrief,
      projectId: "project_review_blocked",
      snapshotId: "snapshot_review_blocked",
      catalogueRef: "catalogue_review_blocked",
      createdAt,
      preferredTemplateId: "template_unknown",
    });
    const review = createStorefrontGenerationReview(plan, currentBrief);
    expect(review.status).toBe("blocked");
    expect(review.canCreateProject).toBe(false);
    expect(review.pageSummaries).toEqual([]);
    expect(review.sections.find((section) => section.id === "storefront-pages")?.status).toBe(
      "not-applicable",
    );
    expect(review.sections.find((section) => section.id === "blockers")?.status).toBe("blocked");
  });

  it("keeps IDs deterministic and results immutable", () => {
    const { plan, currentBrief } = generation();
    const first = createStorefrontGenerationReview(plan, currentBrief);
    const second = createStorefrontGenerationReview(plan, currentBrief);
    expect(first).toEqual(second);
    expect(first.id).toBe(createStorefrontGenerationReviewId(plan));
    expect(Object.isFrozen(first)).toBe(true);
    const clone = structuredClone(first);
    clone.sections[0].facts[0].value = "Changed";
    expect(first.sections[0].facts[0].value).not.toBe("Changed");
    expect(cloneStorefrontGenerationReview(first)).toEqual(first);
    expect(validateStorefrontGenerationReview(first)).toEqual(first);
  });

  it("rejects corrupted guided plans and corrupted review readiness/counts", () => {
    const { plan, currentBrief } = generation();
    const invalidPlan = structuredClone(plan);
    invalidPlan.generatedSnapshot!.projectId = "project_other";
    expect(() => createStorefrontGenerationReview(invalidPlan, currentBrief)).toThrow(
      StorefrontGenerationReviewError,
    );

    const review = createStorefrontGenerationReview(plan, currentBrief);
    const invalidReview = structuredClone(review);
    invalidReview.canCreateProject = false;
    expect(() => validateStorefrontGenerationReview(invalidReview)).toThrow();
    const invalidCounts = structuredClone(review);
    invalidCounts.pageSummaries[0].visibleSectionCount += 1;
    expect(() => validateStorefrontGenerationReview(invalidCounts)).toThrow();
  });

  it("rejects corrupted stage-status combinations and preserves not-run semantics", () => {
    const currentBrief = brief();
    const blockedPlan = generateGuidedStorefront({
      brief: currentBrief,
      projectId: "project_stage_status",
      snapshotId: "snapshot_stage_status",
      catalogueRef: "catalogue_stage_status",
      createdAt,
      preferredTemplateId: "template_unknown",
    });
    const review = createStorefrontGenerationReview(blockedPlan, currentBrief);
    expect(review.stageStatuses).toEqual([
      { stage: "brand-foundation", status: "executed" },
      { stage: "template-selection", status: "executed" },
      { stage: "storefront-materialization", status: "not-run" },
    ]);
    expect(review.sections.find((section) => section.id === "storefront-pages")?.status).toBe(
      "not-applicable",
    );
    expect(
      review.sourceDiagnostics.some((item) => item.stage === "storefront-materialization"),
    ).toBe(false);

    const invalid = structuredClone(blockedPlan);
    invalid.stageDiagnostics = invalid.stageDiagnostics.filter(
      (entry) => entry.stage !== "storefront-materialization",
    );
    expect(() => createStorefrontGenerationReview(invalid, currentBrief)).toThrow(
      expect.objectContaining({ code: "inconsistent-review-source" }),
    );

    const snapshotWithNotRun = structuredClone(blockedPlan);
    snapshotWithNotRun.status = "ready";
    snapshotWithNotRun.blockers = [];
    snapshotWithNotRun.stageDiagnostics = snapshotWithNotRun.stageDiagnostics.map((entry) =>
      entry.stage === "storefront-materialization"
        ? { ...entry, status: "not-run" as const }
        : entry,
    );
    snapshotWithNotRun.generatedSnapshot = {
      ...generation().plan.generatedSnapshot!,
      id: snapshotWithNotRun.snapshotId,
      projectId: snapshotWithNotRun.projectId,
      catalogueRef: snapshotWithNotRun.catalogueRef,
      createdAt: snapshotWithNotRun.createdAt,
    };
    expect(() => createStorefrontGenerationReview(snapshotWithNotRun, currentBrief)).toThrow(
      expect.objectContaining({ code: "inconsistent-review-source" }),
    );
  });
});
