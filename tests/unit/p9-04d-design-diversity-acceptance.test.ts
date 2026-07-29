// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  knownColourOnlyDesignDirections,
  knownDistinctDesignDirections,
} from "../fixtures/p9-04d-design-diversity";
import {
  createDesignDiversityScreenshotMatrix,
  evaluateDesignDiversity,
} from "../helpers/design-diversity-evaluator";

describe("P9-04D objective design-diversity acceptance harness", () => {
  it("accepts three structurally distinct, coherent directions with equal commerce truth", () => {
    const result = evaluateDesignDiversity(knownDistinctDesignDirections);

    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
    expect(new Set(Object.values(result.fingerprints))).toHaveLength(3);
  });

  it("rejects a colour-only variation with identical home, collection and PDP presentations", () => {
    const result = evaluateDesignDiversity(knownColourOnlyDesignDirections);

    expect(result.pass).toBe(false);
    expect(new Set(result.failures.map((failure) => failure.code))).toEqual(
      new Set([
        "homepage-structure-same",
        "collection-presentation-same",
        "product-presentation-same",
        "insufficient-non-colour-difference",
      ]),
    );
  });

  it("defines the exact 72-case screenshot matrix for direction, page, locale and viewport", () => {
    const matrix = createDesignDiversityScreenshotMatrix(knownDistinctDesignDirections);

    expect(matrix).toHaveLength(3 * 3 * 2 * 4);
    expect(new Set(matrix.map((entry) => entry.snapshotName))).toHaveLength(matrix.length);
    expect(matrix).toContainEqual({
      directionId: "premiumEditorial",
      pageType: "home",
      locale: "en",
      viewport: 375,
      snapshotName: "premiumEditorial-home-en-375",
    });
    expect(matrix).toContainEqual({
      directionId: "warmApproachable",
      pageType: "product",
      locale: "fi",
      viewport: 1440,
      snapshotName: "warmApproachable-product-fi-1440",
    });
  });

  it("fails protected-commerce drift and unexplained content-count dead space", () => {
    const fixtures = structuredClone(knownDistinctDesignDirections);
    const technical = fixtures.find((fixture) => fixture.directionId === "modernTechnical");
    const warm = fixtures.find((fixture) => fixture.directionId === "warmApproachable");
    const oneCollection = warm?.contentCases.find(
      (contentCase) => contentCase.id === "oneCollection",
    );
    expect(technical).toBeDefined();
    expect(oneCollection).toBeDefined();
    if (!technical || !oneCollection) {
      throw new Error("Required diversity fixtures are missing.");
    }
    technical.protectedCommerce = { changed: true };
    oneCollection.unexplainedEmptyAreas = 1;

    const result = evaluateDesignDiversity(fixtures);

    expect(result.failures.map((failure) => failure.code)).toEqual(
      expect.arrayContaining(["protected-commerce-changed", "unexplained-empty-area"]),
    );
  });
});
