// @vitest-environment node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { format } from "prettier";
import { describe, expect, it } from "vitest";

import { canonicalValueString } from "@/domain/storefront";
// prettier-ignore
import { createPositiveCrossAuthorityIntegrationAuthority, createPositiveIntegrationBaseline, parsePositiveIntegrationBaseline, positiveIntegrationBaselineFingerprint, positiveIntegrationBaselinePath, readPositiveIntegrationBaseline, type PositiveIntegrationBaseline } from "../helpers/p10b-19a-10b1-positive-cross-authority-integration";

const expectedFingerprint =
  "p10b-19a-positive-cross-authority-integration-v1_23279_e195aad8126b74a9990d923a6ef08d82c637589919f362e8c5e90263092a002d";
const expectedFixtureSha256 = "907a4d48cab6dacd0bc46e0fb16d4eca2ca82c87d7f00b605ca53f3f112490f2";
const checked = readPositiveIntegrationBaseline();

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach((child) => expectDeepFrozen(child, seen));
}

function refingerprint(value: PositiveIntegrationBaseline): PositiveIntegrationBaseline {
  return { ...value, baselineFingerprint: positiveIntegrationBaselineFingerprint(value) };
}

describe("P10B-19A-10B1 positive integration baseline", () => {
  it("is byte-exact, deterministic and fresh-clone sufficient", async () => {
    const recreated = createPositiveIntegrationBaseline(
      createPositiveCrossAuthorityIntegrationAuthority(),
    );
    const bytes = readFileSync(positiveIntegrationBaselinePath);
    expect(recreated).toEqual(checked);
    expect(bytes.toString("utf8")).toBe(
      await format(JSON.stringify(recreated, null, 2), { parser: "json" }),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expectedFixtureSha256);
    expect(checked.baselineFingerprint).toBe(expectedFingerprint);
  });

  it("locks exact fixture, topology, compatibility, selection and inactivity counts", () => {
    // prettier-ignore
    expect(checked.fixtureCounts).toEqual({ pageBlueprintCandidateCount: 8, primaryPageBlueprintCandidateCount: 6, fallbackOnlyPageBlueprintCandidateCount: 2, structuralFamilyCandidateCount: 6, compatibilityProfileCount: 6, capabilityContextCount: 3, canonicalPageFamilyRoleCount: 6, canonicalStructuralFamilyIdCount: 6 });
    // prettier-ignore
    expect(checked.topologyEvidence).toMatchObject({ pageBlueprintTopologyCount: 8, structuralFamilyTopologyCount: 6, duplicateFamilyTopologyClusterCount: 3, identitiesPerDuplicateCluster: 2 });
    // prettier-ignore
    expect(checked.compatibilityEvidence.evaluations.map(({ pageStatusCounts, familyStatusCounts }) => [pageStatusCounts, familyStatusCounts])).toEqual([[{ direct: 8, substitution: 0, omission: 0, incompatible: 0 }, { direct: 6, conditional: 0, incompatible: 0 }], [{ direct: 8, substitution: 0, omission: 0, incompatible: 0 }, { direct: 6, conditional: 0, incompatible: 0 }], [{ direct: 5, substitution: 2, omission: 1, incompatible: 0 }, { direct: 0, conditional: 6, incompatible: 0 }]]);
    // prettier-ignore
    expect([checked.selectionEvidence.familyConstrainedDirect.length, checked.selectionEvidence.localeEquivalent.length, checked.selectionEvidence.sequentialDistinct.length]).toEqual([6, 2, 3]);
    // prettier-ignore
    expect(checked.a10aAuthority).toMatchObject({ matrixEntryCount: 24, protectedProductionHashCount: 76, productionInactivityAssertionCount: 9, completeCaseCount: 126, frozenCaseCount: 72 });
    const { assertions, ...zeroCounts } = checked.productionInactivityEvidence;
    expect(assertions.every(({ expectedCount }) => expectedCount === 0)).toBe(true);
    expect(Object.values(zeroCounts).every((value) => value === 0)).toBe(true);
    expectDeepFrozen(checked);
  });

  it("fingerprints fixture and selection changes but ignores JSON key order", () => {
    // prettier-ignore
    const changedCount = { ...checked, fixtureCounts: { ...checked.fixtureCounts, pageBlueprintCandidateCount: 9 } };
    // prettier-ignore
    expect(positiveIntegrationBaselineFingerprint(changedCount as unknown as PositiveIntegrationBaseline)).not.toBe(expectedFingerprint);
    // prettier-ignore
    const changedSelection = { ...checked, selectionEvidence: { ...checked.selectionEvidence, familyConstrainedDirect: [...checked.selectionEvidence.familyConstrainedDirect].reverse() } };
    expect(positiveIntegrationBaselineFingerprint(changedSelection)).not.toBe(expectedFingerprint);
    const reversed = Object.fromEntries(Object.entries(checked).reverse());
    expect(positiveIntegrationBaselineFingerprint(reversed as PositiveIntegrationBaseline)).toBe(
      expectedFingerprint,
    );
    expect(parsePositiveIntegrationBaseline(reversed)).toEqual(checked);
  });

  it("rejects unknown fields, stale identity and noncanonical collection order", () => {
    expect(() => parsePositiveIntegrationBaseline({ ...checked, unexpected: true })).toThrow();
    expect(() =>
      parsePositiveIntegrationBaseline({
        ...checked,
        baselineFingerprint: expectedFingerprint.replace(/.$/u, "e"),
      }),
    ).toThrow();
    // prettier-ignore
    const reordered = { ...checked, topologyEvidence: { ...checked.topologyEvidence, pageBlueprintTopologies: [...checked.topologyEvidence.pageBlueprintTopologies].reverse() } };
    expect(() => parsePositiveIntegrationBaseline(refingerprint(reordered))).toThrow(
      /incomplete, duplicated or noncanonical/u,
    );
    expect(canonicalValueString(checked)).not.toMatch(/merchant|price|rawHtml|providerPayload/iu);
  });
});
