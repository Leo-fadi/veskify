import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { approvedAssetPlacementPurposeSchema } from "@/domain/storefront/approved-asset-placement";

describe("P10B-18C helper placement-purpose authority", () => {
  it("uses only canonical placement-purpose values", () => {
    const source = readFileSync(
      resolve(process.cwd(), "tests/helpers/p10b-18c-commercial-quality.ts"),
      "utf8",
    );
    const comparedPurposes = [...source.matchAll(/placementPurpose\s*===\s*"([^"]+)"/g)].map(
      ([, purpose]) => purpose,
    );

    expect(comparedPurposes).toContain("campaign-primary");
    expect(comparedPurposes).not.toContain("campaign-media");
    for (const purpose of comparedPurposes) {
      expect(approvedAssetPlacementPurposeSchema.safeParse(purpose).success).toBe(true);
    }
  });
});
