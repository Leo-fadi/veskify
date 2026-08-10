import { describe, expect, it } from "vitest";
import { createP10B15SynthesisEvidenceManifest } from "@/application/bounded-storefront-synthesis";
import { createP10B15BoundedSynthesisFixture } from "@/data/demo/p10b-15-bounded-synthesis";
import { createP10B15HumanCommercialReviews } from "@/data/demo/p10b-15-human-commercial-review";

const fixture = createP10B15BoundedSynthesisFixture();

describe("P10B-15 retained synthesis evidence", () => {
  it("retains the current human commercial review protocol for every representative outcome", () => {
    const reviews = createP10B15HumanCommercialReviews(fixture);
    expect(reviews).toHaveLength(3);
    expect(reviews.every(({ evaluation }) => evaluation.scenarios.length === 160)).toBe(true);
    expect(reviews.every(({ record }) => record.overallDecision === "passed")).toBe(true);
    expect(new Set(reviews.map(({ record }) => record.fingerprint)).size).toBe(3);
  });

  it("produces a deterministic traceability-only evidence manifest", () => {
    const reviews = createP10B15HumanCommercialReviews(fixture);
    const input = {
      fixtureId: "p10b15-lumo-bounded-synthesis",
      outcomes: fixture.outcomes,
      browserEvidence: [
        {
          intent: "editorial-led",
          route: "/",
          viewport: 375 as const,
          reference: "p10b15-editorial-led-home-375px.png",
          fingerprint: "browser-editorial-home-375",
        },
        {
          intent: "commerce-led",
          route: "/collections/jewellery",
          viewport: 1440 as const,
          reference: "p10b15-commerce-led-collection-1440px.png",
          fingerprint: "browser-commerce-collection-1440",
        },
        {
          intent: "restrained-minimal",
          route: "/products/custom-halo-ring",
          viewport: 1440 as const,
          reference: "p10b15-restrained-minimal-pdp-1440px.png",
          fingerprint: "browser-restrained-pdp-1440",
        },
      ],
      humanReviews: reviews.map(({ intent, record }) => ({
        intent,
        reviewId: record.reviewId,
        fingerprint: record.fingerprint,
        outcome: "passed" as const,
      })),
    };
    const first = createP10B15SynthesisEvidenceManifest(input);
    const second = createP10B15SynthesisEvidenceManifest(structuredClone(input));
    expect(first).toEqual(second);
    expect(first.outcomes).toHaveLength(3);
    expect(first.browserEvidence).toHaveLength(3);
  });
});
