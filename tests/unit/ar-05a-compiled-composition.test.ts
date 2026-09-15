import { describe, expect, it } from "vitest";
import { compilePageBlueprintComposition as compile } from "@/application/storefront-templates/compile-page-blueprint-composition";
import { validateCompiledPageBlueprintComposition as validate } from "@/application/storefront-templates/validate-page-blueprint-composition";
import { createPageBlueprintV2CandidateAuthority } from "@/application/storefront-templates/page-blueprint-v2-candidate-authority";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import {
  createCompiledPageBlueprintCompositionV1 as create,
  parseCompiledPageBlueprintCompositionV1 as parse,
} from "@/domain/storefront/compiled-page-blueprint-composition";
import { ar05aFixture, ar05aReplaceCandidate } from "../helpers/ar-05a-composition-fixtures";

const clone = <T>(input: T): T => structuredClone(input);
function frozen(value: unknown): boolean {
  return (
    !value ||
    typeof value !== "object" ||
    (Object.isFrozen(value) && Object.values(value).every(frozen))
  );
}
describe("AR-05A reference-only composition", () => {
  it.each(["home", "collection", "product-detail"] as const)(
    "compiles and independently reads complete canonical static %s inventory",
    (family) => {
      const fixture = ar05aFixture({ family });
      const before = JSON.stringify(fixture);
      const value = compile(fixture.selection, fixture.authority);
      expect(validate(clone(value), fixture.authority)).toEqual(value);
      expect(compile(fixture.selection, fixture.authority)).toEqual(value);
      expect(value.regionAssignments.flatMap((entry) => entry.units).length).toBe(
        fixture.page.sections.filter((section) => section.visible).length,
      );
      expect(frozen(value)).toBe(true);
      expect(JSON.stringify(value)).not.toMatch(
        /"(?:content|props|styleOverrides|price|productId|assetId|sections)":/u,
      );
      expect(JSON.stringify(fixture)).toBe(before);
      expect(() => (value.regionAssignments[0].units as unknown[]).push({})).toThrow();
    },
  );
  it("separates syntax validity from semantic acceptance", () => {
    const { selection, authority } = ar05aFixture();
    const value = compile(selection, authority);
    const { compositionFingerprint: _fingerprint, ...material } = clone(value);
    void _fingerprint;
    const forged = create({
      ...material,
      owner: { ...value.owner, id: "foreign_owner" },
    });
    expect(parse(forged)).toEqual(forged);
    expect(() => validate(forged, authority)).toThrow(/owner/);
  });
  it.each([
    [
      "unknown root",
      (value: Record<string, unknown>) => {
        value.content = {};
      },
    ],
    [
      "unsupported version",
      (value: Record<string, unknown>) => {
        value.compositionVersion = "2.0.0";
      },
    ],
    [
      "tampered fingerprint",
      (value: Record<string, unknown>) => {
        value.compositionFingerprint = "tampered";
      },
    ],
    [
      "unbounded identifier",
      (value: Record<string, unknown>) => {
        value.orderAlternativeId = "x".repeat(161);
      },
    ],
    [
      "unbounded regions",
      (value: Record<string, unknown>) => {
        value.regionAssignments = Array(33).fill((value.regionAssignments as unknown[])[0]);
      },
    ],
    [
      "unbounded relationships",
      (value: Record<string, unknown>) => {
        value.relationshipRealizations = Array(193).fill(
          (value.relationshipRealizations as unknown[])[0],
        );
      },
    ],
  ] as const)("rejects %s", (_label, mutate) => {
    const { selection, authority } = ar05aFixture();
    const value = clone(compile(selection, authority));
    mutate(value);
    expect(() => validate(value, authority)).toThrow();
  });
  it("canonicalizes storage permutations while preserving meaningful unit sequence", () => {
    const { selection, authority } = ar05aFixture();
    const first = compile(selection, authority);
    const page = authority.owner.kind === "static-page" ? authority.owner.page : undefined;
    if (!page) throw new Error("static fixture");
    const permuted = compile(
      {
        ...selection,
        regionAssignments: [...selection.regionAssignments].reverse(),
        breakpoints: [...selection.breakpoints].reverse(),
        relationshipRealizations: [...selection.relationshipRealizations].reverse(),
      },
      {
        ...authority,
        owner: { kind: "static-page", page: { ...page, sections: [...page.sections].reverse() } },
        componentDefinitions: [...authority.componentDefinitions].reverse(),
      },
    );
    expect(permuted).toEqual(first);
    const changed = clone(selection);
    const multi = changed.regionAssignments.find((entry) => entry.units.length > 1)!;
    expect(multi.units.length).toBeGreaterThan(1);
    multi.units.reverse();
    expect(compile(changed, authority).compositionFingerprint).not.toBe(
      first.compositionFingerprint,
    );
    const changedContent = clone(page);
    changedContent.title.en = "Changed presentation copy";
    expect(
      compile(selection, { ...authority, owner: { kind: "static-page", page: changedContent } })
        .bindingFingerprint,
    ).toBe(first.bindingFingerprint);
  });
  it.each([
    "foreign",
    "invisible",
    "duplicate",
    "anatomy",
    "variant",
    "missing-definition",
    "wrong-role",
    "stale-definition",
    "stale-candidate",
    "missing-support",
    "throwing-support",
  ] as const)("fails closed for %s without mutation", (kind) => {
    const fixture = ar05aFixture();
    const accepted = compile(fixture.selection, fixture.authority);
    const first = fixture.selection.regionAssignments[0].units[0];
    if (first.kind !== "section" || fixture.authority.owner.kind !== "static-page")
      throw new Error("static fixture");
    const section = fixture.authority.owner.page.sections.find(
      (entry) => entry.id === first.sectionId,
    )!;
    if (kind === "foreign") first.sectionId = "foreign_section";
    if (kind === "invisible") section.visible = false;
    if (kind === "duplicate") fixture.selection.regionAssignments[0].units.push(first);
    if (kind === "anatomy")
      fixture.selection.regionAssignments[0].units[0] = {
        kind: "anatomy",
        parent: first,
        anatomySlotId: "imagined_hook",
      };
    if (kind === "variant") section.variant = "missingVariant";
    if (kind === "missing-definition")
      fixture.authority = { ...fixture.authority, componentDefinitions: [] };
    if (kind === "wrong-role")
      fixture.selection.regionAssignments.find(
        (entry) => entry.regionId === "orientation",
      )!.units[0] = fixture.selection.regionAssignments.find(
        (entry) => entry.regionId === "primary-discovery",
      )!.units[0];
    if (kind === "stale-definition")
      fixture.authority = {
        ...fixture.authority,
        componentDefinitions: fixture.authority.componentDefinitions.map((entry) => {
          const def = clone(entry) as { type: string; title: { en: string } };
          if (def.type === section.component) def.title.en += " changed";
          return def;
        }),
      };
    if (kind === "stale-candidate")
      fixture.authority = {
        ...fixture.authority,
        candidate: { ...fixture.candidate, candidateFingerprint: "stale" },
      };
    if (kind === "missing-support")
      fixture.authority = { ...fixture.authority, support: undefined as never };
    if (kind === "throwing-support")
      fixture.authority = {
        ...fixture.authority,
        support: {
          ...fixture.authority.support,
          resolve: () => {
            throw new Error("sensitive unexpected detail");
          },
        },
      };
    const before = JSON.stringify(fixture);
    expect(() =>
      kind === "stale-definition"
        ? validate(accepted, fixture.authority)
        : compile(fixture.selection, fixture.authority),
    ).toThrow(/Compiled composition rejected/);
    expect(JSON.stringify(fixture)).toBe(before);
    if (kind === "throwing-support")
      expect(() => compile(fixture.selection, fixture.authority)).not.toThrow(/sensitive/);
  });
  it.each(["precedes", "pairs-with", "offsets", "contains", "spans", "anchors"] as const)(
    "binds actual %s relationship and all four transformation rules",
    (relationship) => {
      const { selection, authority } = ar05aFixture({ relationship });
      const seen: unknown[] = [];
      const support = {
        ...authority.support,
        resolve: (request: Parameters<typeof authority.support.resolve>[0]) => {
          seen.push(request);
          return authority.support.resolve(request);
        },
      };
      const value = compile(selection, { ...authority, support });
      expect(value.breakpoints.map((entry) => entry.viewport)).toEqual([375, 768, 1024, 1440]);
      expect(
        seen.filter((entry) => (entry as { kind: string }).kind === "relationship"),
      ).toHaveLength(5);
      for (let index = 0; index < 4; index++) {
        const altered = clone(selection);
        altered.breakpoints[index].relationshipRealizations[0].realizationId = "unsupported";
        expect(() => compile(altered, authority)).toThrow(/unresolved relationship/);
        altered.breakpoints[index].relationshipRealizations = [];
        expect(() => compile(altered, authority)).toThrow(/coverage/);
        altered.breakpoints = altered.breakpoints.filter((_, i) => i !== index);
        expect(() => compile(altered, authority)).toThrow();
      }
    },
  );
  it("rejects stale responsive/order/support identities and duplicate coverage", () => {
    const { selection, authority } = ar05aFixture();
    for (const mutate of [
      (s: typeof selection) => {
        s.breakpoints[0].ruleFingerprint = "stale";
      },
      (s: typeof selection) => {
        s.breakpoints[1].viewport = 375;
      },
      (s: typeof selection) => {
        s.breakpoints[0].orderAlternativeId = "missing";
      },
      (s: typeof selection) => {
        s.orderAlternativeId = "missing";
      },
      (s: typeof selection) => {
        s.relationshipRealizations.push(s.relationshipRealizations[0]);
      },
      (s: typeof selection) => {
        s.regionAssignments.push(s.regionAssignments[0]);
      },
      (s: typeof selection) => {
        s.regionAssignments[0].realizationId = "unsupported";
      },
    ]) {
      const altered = clone(selection);
      mutate(altered);
      expect(() => compile(altered, authority)).toThrow();
    }
    const value = compile(selection, authority);
    expect(() =>
      validate(value, { ...authority, support: { ...authority.support, version: "1.0.1" } }),
    ).toThrow(/support identity/);
  });
  it("rejects an owner-family mismatch and component-page mismatch", () => {
    const fixture = ar05aFixture();
    const { candidateFingerprint: _fingerprint, ...material } = fixture.candidate;
    void _fingerprint;
    const candidate = createPageBlueprintV2CandidateAuthority({
      ...material,
      structural: { ...fixture.candidate.structural, pageFamilyId: "collection" },
    });
    ar05aReplaceCandidate(fixture, candidate);
    expect(() => compile(fixture.selection, fixture.authority)).toThrow(/page family/);
  });
  it("fingerprints effective candidate changes and rejects an old read", () => {
    const fixture = ar05aFixture();
    const first = compile(fixture.selection, fixture.authority);
    const { candidateFingerprint: _old, ...material } = fixture.candidate;
    void _old;
    ar05aReplaceCandidate(
      fixture,
      createPageBlueprintV2CandidateAuthority({
        ...material,
        structural: {
          ...material.structural,
          regions: material.structural.regions.map((region, index) =>
            index === 0 ? { ...region, visualWeight: "heavy" } : region,
          ),
        },
      }),
    );
    expect(compile(fixture.selection, fixture.authority).compositionFingerprint).not.toBe(
      first.compositionFingerprint,
    );
    expect(() => validate(first, fixture.authority)).toThrow(/blueprint reference/);
  });
  it("requires current capacity evidence even without omissions", () => {
    const { selection, authority } = ar05aFixture();
    expect(() =>
      compile(selection, { ...authority, requiredAssetRoleCapacityEvidence: undefined }),
    ).toThrow();
    expect(canonicalValueFingerprint(selection)).toBe(canonicalValueFingerprint(clone(selection)));
  });
});
