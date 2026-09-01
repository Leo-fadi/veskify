import { describe, expect, it } from "vitest";

import {
  MAX_DUPLICATE_CROSS_PAGE_RELATIONSHIP_EVIDENCE,
  STRUCTURAL_STOREFRONT_CROSS_PAGE_RELATIONSHIP_CONTRACT_SCHEMA_VERSION,
  DuplicateStructuralStorefrontCrossPageRelationshipError,
  canonicalizeStructuralStorefrontCrossPageRelationships,
  createStructuralStorefrontCrossPageRelationshipKey,
  isStructuralStorefrontCrossPageRelationshipKind,
  isStructuralStorefrontPageFamilyId,
  structuralStorefrontCrossPageRelationshipKinds,
  structuralStorefrontCrossPageRelationshipV1Schema,
  structuralStorefrontPageFamilyIds,
  type StructuralStorefrontCrossPageRelationshipKind,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family";

const relationship = (
  sourcePageFamilyId: StructuralStorefrontPageFamilyId,
  relationshipKind: StructuralStorefrontCrossPageRelationshipKind,
  targetPageFamilyId: StructuralStorefrontPageFamilyId,
) => ({ sourcePageFamilyId, relationshipKind, targetPageFamilyId });

describe("P10B-19A-02 cross-page structural relationship contract", () => {
  it("locks the schema version and exact page-family role vocabulary", () => {
    expect(STRUCTURAL_STOREFRONT_CROSS_PAGE_RELATIONSHIP_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    expect(structuralStorefrontPageFamilyIds).toEqual([
      "home",
      "collection",
      "search",
      "product-detail",
      "content-support",
      "utility",
    ]);
    expect(Object.isFrozen(structuralStorefrontPageFamilyIds)).toBe(true);
  });

  it("locks the exact relationship-kind vocabulary", () => {
    expect(structuralStorefrontCrossPageRelationshipKinds).toEqual([
      "frame-continuity",
      "navigation-continuity",
      "hierarchy-continuity",
      "recurring-anchor",
      "merchandising-continuity",
      "commerce-transition",
      "state-anatomy-boundary",
    ]);
    expect(Object.isFrozen(structuralStorefrontCrossPageRelationshipKinds)).toBe(true);
  });

  it("provides exact guards without aliases or normalization", () => {
    expect(isStructuralStorefrontPageFamilyId("product-detail")).toBe(true);
    expect(isStructuralStorefrontPageFamilyId("product")).toBe(false);
    expect(isStructuralStorefrontPageFamilyId("HOME")).toBe(false);
    expect(isStructuralStorefrontCrossPageRelationshipKind("commerce-transition")).toBe(true);
    expect(isStructuralStorefrontCrossPageRelationshipKind("commerceTransition")).toBe(false);
  });

  it("parses and freezes one strict directed value object", () => {
    const parsed = structuralStorefrontCrossPageRelationshipV1Schema.parse(
      relationship("home", "frame-continuity", "collection"),
    );

    expect(parsed).toEqual({
      sourcePageFamilyId: "home",
      relationshipKind: "frame-continuity",
      targetPageFamilyId: "collection",
    });
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it("rejects unknown fields and all unknown vocabulary values", () => {
    expect(() =>
      structuralStorefrontCrossPageRelationshipV1Schema.parse({
        ...relationship("home", "frame-continuity", "collection"),
        weight: 1,
      }),
    ).toThrow();
    expect(() =>
      structuralStorefrontCrossPageRelationshipV1Schema.parse({
        ...relationship("home", "frame-continuity", "collection"),
        sourcePageFamilyId: "landing",
      }),
    ).toThrow();
    expect(() =>
      structuralStorefrontCrossPageRelationshipV1Schema.parse({
        ...relationship("home", "frame-continuity", "collection"),
        relationshipKind: "visual-continuity",
      }),
    ).toThrow();
    expect(() =>
      structuralStorefrontCrossPageRelationshipV1Schema.parse({
        ...relationship("home", "frame-continuity", "collection"),
        targetPageFamilyId: "checkout",
      }),
    ).toThrow();
  });

  it("fails closed on self relationships", () => {
    expect(() =>
      structuralStorefrontCrossPageRelationshipV1Schema.parse(
        relationship("home", "frame-continuity", "home"),
      ),
    ).toThrow("must connect distinct page families");
  });

  it("derives the exact deterministic directed key", () => {
    const parsed = structuralStorefrontCrossPageRelationshipV1Schema.parse(
      relationship("collection", "commerce-transition", "product-detail"),
    );

    expect(createStructuralStorefrontCrossPageRelationshipKey(parsed)).toBe(
      "collection->commerce-transition->product-detail",
    );
  });

  it("canonicalizes by source, relationship kind, then target vocabulary order", () => {
    const canonical = canonicalizeStructuralStorefrontCrossPageRelationships([
      relationship("utility", "state-anatomy-boundary", "home"),
      relationship("home", "navigation-continuity", "search"),
      relationship("home", "frame-continuity", "search"),
      relationship("home", "frame-continuity", "collection"),
      relationship("collection", "frame-continuity", "home"),
    ]);

    expect(canonical).toEqual([
      relationship("home", "frame-continuity", "collection"),
      relationship("home", "frame-continuity", "search"),
      relationship("home", "navigation-continuity", "search"),
      relationship("collection", "frame-continuity", "home"),
      relationship("utility", "state-anatomy-boundary", "home"),
    ]);
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(canonical.every((value) => Object.isFrozen(value))).toBe(true);
  });

  it("is deterministic across input permutations and reruns", () => {
    const input = [
      relationship("search", "commerce-transition", "product-detail"),
      relationship("home", "recurring-anchor", "content-support"),
      relationship("collection", "merchandising-continuity", "search"),
    ];

    const first = canonicalizeStructuralStorefrontCrossPageRelationships(input);
    const second = canonicalizeStructuralStorefrontCrossPageRelationships([
      input[2],
      input[0],
      input[1],
    ]);

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("fails closed on one exact duplicate relationship", () => {
    const duplicate = relationship("home", "navigation-continuity", "collection");

    expect(() =>
      canonicalizeStructuralStorefrontCrossPageRelationships([duplicate, duplicate]),
    ).toThrow(DuplicateStructuralStorefrontCrossPageRelationshipError);

    try {
      canonicalizeStructuralStorefrontCrossPageRelationships([duplicate, duplicate]);
      throw new Error("Expected duplicate relationships to fail closed.");
    } catch (error) {
      expect(error).toBeInstanceOf(DuplicateStructuralStorefrontCrossPageRelationshipError);
      if (!(error instanceof DuplicateStructuralStorefrontCrossPageRelationshipError)) {
        throw error;
      }
      expect(error.duplicateKeys).toEqual(["home->navigation-continuity->collection"]);
      expect(error.duplicateKeyCount).toBe(1);
      expect(error.duplicateOccurrenceCount).toBe(1);
      expect(Object.isFrozen(error.duplicateKeys)).toBe(true);
    }
  });

  it("bounds and canonically sorts duplicate evidence", () => {
    const duplicateRelationships = structuralStorefrontCrossPageRelationshipKinds
      .slice(0, 2)
      .flatMap((relationshipKind) =>
        structuralStorefrontPageFamilyIds
          .filter((targetPageFamilyId) => targetPageFamilyId !== "home")
          .map((targetPageFamilyId) => relationship("home", relationshipKind, targetPageFamilyId)),
      );

    try {
      canonicalizeStructuralStorefrontCrossPageRelationships(
        [...duplicateRelationships, ...duplicateRelationships].reverse(),
      );
      throw new Error("Expected duplicate relationships to fail closed.");
    } catch (error) {
      if (!(error instanceof DuplicateStructuralStorefrontCrossPageRelationshipError)) {
        throw error;
      }
      expect(error.duplicateKeyCount).toBe(10);
      expect(error.duplicateOccurrenceCount).toBe(10);
      expect(error.duplicateKeys).toHaveLength(MAX_DUPLICATE_CROSS_PAGE_RELATIONSHIP_EVIDENCE);
      expect(error.duplicateKeys).toEqual([
        "home->frame-continuity->collection",
        "home->frame-continuity->search",
        "home->frame-continuity->product-detail",
        "home->frame-continuity->content-support",
        "home->frame-continuity->utility",
        "home->navigation-continuity->collection",
        "home->navigation-continuity->search",
        "home->navigation-continuity->product-detail",
      ]);
      expect(error.message).toContain("(+2 more)");
    }
  });

  it("allows the same directed pair under different relationship kinds", () => {
    expect(
      canonicalizeStructuralStorefrontCrossPageRelationships([
        relationship("home", "frame-continuity", "collection"),
        relationship("home", "navigation-continuity", "collection"),
      ]),
    ).toHaveLength(2);
  });

  it("allows reverse relationships", () => {
    expect(
      canonicalizeStructuralStorefrontCrossPageRelationships([
        relationship("home", "frame-continuity", "collection"),
        relationship("collection", "frame-continuity", "home"),
      ]),
    ).toHaveLength(2);
  });

  it("allows cycles without imposing graph policy", () => {
    expect(
      canonicalizeStructuralStorefrontCrossPageRelationships([
        relationship("home", "recurring-anchor", "collection"),
        relationship("collection", "recurring-anchor", "search"),
        relationship("search", "recurring-anchor", "home"),
      ]),
    ).toHaveLength(3);
  });

  it("allows disconnected relationships and an empty collection", () => {
    expect(
      canonicalizeStructuralStorefrontCrossPageRelationships([
        relationship("home", "frame-continuity", "collection"),
        relationship("content-support", "state-anatomy-boundary", "utility"),
      ]),
    ).toHaveLength(2);
    const empty = canonicalizeStructuralStorefrontCrossPageRelationships([]);
    expect(empty).toEqual([]);
    expect(Object.isFrozen(empty)).toBe(true);
  });
});
