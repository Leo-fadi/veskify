import { describe, expect, it } from "vitest";
import { humanCommercialReviewCriterionIds } from "@/application/human-commercial-review";
import { createP10B16HumanCommercialReviews } from "@/data/demo/p10b-16-human-commercial-review";

describe("P10B-16 retained human commercial review", () => {
  const reviews = createP10B16HumanCommercialReviews();

  it("retains one passed review for every canonical coordinated direction", () => {
    expect(reviews.map(({ directionId }) => directionId)).toEqual([
      "premium-editorial",
      "modern-technical",
      "minimal-commerce",
    ]);
    expect(
      reviews.every(({ record }) =>
        record.decisions.every(({ decision }) => decision === "passed"),
      ),
    ).toBe(true);
  });

  it("covers every review criterion and required viewport without aesthetic AI scoring", () => {
    for (const { record } of reviews) {
      expect(record.decisions.map(({ criterionId }) => criterionId)).toEqual(
        humanCommercialReviewCriterionIds,
      );
      expect(new Set(record.coverage.map(({ viewport }) => viewport))).toEqual(
        new Set([375, 768, 1024, 1440]),
      );
      expect(record.findings).toEqual([]);
    }
  });
});
