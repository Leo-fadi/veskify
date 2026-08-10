import { describe, expect, it } from "vitest";
import { createP10B16DirectionEvidenceManifest } from "@/application/bounded-storefront-synthesis";
import { createP10B16RepresentativeBatch } from "@/data/demo/p10b-16-coordinated-directions";
import { createP10B16HumanCommercialReviews } from "@/data/demo/p10b-16-human-commercial-review";

describe("P10B-16 retained direction/diversity evidence manifest", () => {
  it("retains nine representative outcomes, material pairwise variety and zero provider calls", () => {
    const fixture = createP10B16RepresentativeBatch();
    const manifest = createP10B16DirectionEvidenceManifest({
      outcomes: fixture.outcomes,
      reviews: createP10B16HumanCommercialReviews(fixture),
    });
    expect(manifest.outcomes).toHaveLength(9);
    expect(manifest.pairwise).toHaveLength(9);
    expect(
      manifest.pairwise.every(({ classification }) => classification === "materially-different"),
    ).toBe(true);
    expect(manifest.reviewFingerprints).toHaveLength(3);
    expect(manifest.providerCalls).toBe(0);
    expect(manifest.fingerprint).toMatch(/^p10b16-direction-evidence-/);
  });
});
