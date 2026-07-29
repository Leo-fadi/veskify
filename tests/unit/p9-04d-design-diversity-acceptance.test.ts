// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  canonicalCommerceBaseline,
  knownColourOnlyDesignDirections,
  knownDistinctDesignDirections,
} from "../fixtures/p9-04d-design-diversity";
import {
  createDesignDiversityScreenshotMatrix,
  evaluateDesignDiversity,
} from "../helpers/design-diversity-evaluator";

function fixtures() {
  return structuredClone(knownDistinctDesignDirections);
}
function codes(value: ReturnType<typeof evaluateDesignDiversity>) {
  return value.failures.map((failure) => failure.code);
}

describe("P9-04D objective design-diversity acceptance harness", () => {
  it("accepts three coherent directions against the canonical commerce baseline", () => {
    const result = evaluateDesignDiversity(
      knownDistinctDesignDirections,
      canonicalCommerceBaseline,
    );
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
    expect(new Set(Object.values(result.fingerprints))).toHaveLength(3);
  });

  it("requires every page difference dimension and rejects colour-only variation", () => {
    const oneProperty = fixtures();
    oneProperty[1].pages.home.hero = oneProperty[0].pages.home.hero;
    expect(codes(evaluateDesignDiversity(oneProperty, canonicalCommerceBaseline))).toContain(
      "home-dimension-same",
    );
    expect(
      codes(evaluateDesignDiversity(knownColourOnlyDesignDirections, canonicalCommerceBaseline)),
    ).toEqual(
      expect.arrayContaining([
        "home-dimension-same",
        "collection-dimension-same",
        "product-dimension-same",
        "insufficient-non-colour-difference",
      ]),
    );
  });

  it("rejects shared protected-commerce drift from the canonical source baseline", () => {
    const changed = fixtures();
    changed.forEach((fixture) => {
      fixture.protectedCommerce = { changed: true };
    });
    expect(codes(evaluateDesignDiversity(changed, canonicalCommerceBaseline))).toContain(
      "protected-commerce-changed",
    );
  });

  it("rejects unsafe localized fixture or internal content", () => {
    const changed = fixtures();
    changed[0].localePresentation.fi.home = {
      merchantVisibleText: "Aurum heroComponent",
      leakage: ["fixture"],
    };
    expect(codes(evaluateDesignDiversity(changed, canonicalCommerceBaseline))).toContain(
      "unsafe-locale-presentation",
    );
  });

  it("rejects wrong-product asset assignment and mixed page direction identities", () => {
    const changed = fixtures();
    changed[0].assetUses[2].bindingTarget = { kind: "product", id: "product-ring-1" };
    changed[1].pages.product.recipeId = changed[0].pages.product.recipeId;
    expect(codes(evaluateDesignDiversity(changed, canonicalCommerceBaseline))).toEqual(
      expect.arrayContaining(["invalid-asset-assignment", "incoherent-direction"]),
    );
  });

  it("rejects responsive clipping and missing content cases in the executable matrix", () => {
    const changed = fixtures();
    changed[0].responsive[768].collection.clipping = true;
    changed[1].contentCases = changed[1].contentCases.filter(
      (entry) => entry.id !== "largeProductCount",
    );
    const result = evaluateDesignDiversity(changed, canonicalCommerceBaseline);
    expect(codes(result)).toEqual(
      expect.arrayContaining(["responsive-layout-failure", "missing-content-count-case"]),
    );
    expect(createDesignDiversityScreenshotMatrix(knownDistinctDesignDirections)).toHaveLength(
      3 * 5 * 3 * 2 * 4,
    );
  });

  it("normalizes design tokens and rejects duplicate, missing and unknown directions", () => {
    const normalized = structuredClone(knownColourOnlyDesignDirections);
    normalized[1].designSystem.spacingDensity = "Spacious ";
    normalized[1].designSystem.shapeRadius = "SQUARE ";
    expect(codes(evaluateDesignDiversity(normalized, canonicalCommerceBaseline))).toContain(
      "insufficient-non-colour-difference",
    );
    const invalid = fixtures();
    invalid.push(structuredClone(invalid[0]));
    invalid[2].directionId = "unknownDirection";
    expect(codes(evaluateDesignDiversity(invalid, canonicalCommerceBaseline))).toEqual(
      expect.arrayContaining(["duplicate-direction", "unknown-direction", "missing-direction"]),
    );
  });

  it("rejects invalid dead-space measurements and empty page structures", () => {
    const changed = fixtures();
    changed[0].contentCases[0].unexplainedEmptyAreas = Number.NaN;
    changed[1].contentCases[0].unexplainedEmptyAreas = -1;
    changed[2].pages.home.sections = [];
    expect(codes(evaluateDesignDiversity(changed, canonicalCommerceBaseline))).toEqual(
      expect.arrayContaining(["invalid-empty-area-measurement", "incomplete-page-structure"]),
    );
  });

  it("keeps direction content cases isolated", () => {
    const changed = fixtures();
    changed[0].contentCases[0].unexplainedEmptyAreas = 1;
    expect(changed[1].contentCases[0].unexplainedEmptyAreas).toBe(0);
    expect(changed[2].contentCases[0].unexplainedEmptyAreas).toBe(0);
  });
});
