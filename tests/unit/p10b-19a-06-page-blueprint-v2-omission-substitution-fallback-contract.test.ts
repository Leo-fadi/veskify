import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ZodError } from "zod";
import { describe, expect, it } from "vitest";
import * as storefrontTemplateAuthority from "@/application/storefront-templates";
import {
  PAGE_BLUEPRINT_V2_OMISSION_SUBSTITUTION_FALLBACK_CONTRACT_SCHEMA_VERSION,
  canonicalizePageBlueprintV2AssetRoleCompatibilityContract,
  canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract,
  canonicalizePageBlueprintV2ResponsiveRuleContract,
  canonicalizePageBlueprintV2StructuralContract,
  createPageBlueprintV2RegionRelationshipKey,
  listExecutablePageBlueprintProfiles,
  pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema,
} from "@/application/storefront-templates";

const blueprintId = "home-fallback-structure";
const blueprintVersion = "1.4.0";

function structuralFixture() {
  return {
    id: blueprintId,
    version: blueprintVersion,
    pageFamilyId: "home",
    regions: [
      {
        id: "proof-region",
        role: "brand-proof",
        requirement: "optional",
        cardinality: { minimum: 0, ideal: 1, maximum: 2 },
        visualWeight: "light",
      },
      {
        id: "discovery-region",
        role: "primary-discovery",
        requirement: "required",
        cardinality: { minimum: 1, ideal: 1, maximum: 2 },
        visualWeight: "heavy",
      },
      {
        id: "decoration-region",
        role: "education",
        requirement: "optional",
        cardinality: { minimum: 0, ideal: 1, maximum: 2 },
        visualWeight: "light",
      },
      {
        id: "story-region",
        role: "brand-story",
        requirement: "optional",
        cardinality: { minimum: 0, ideal: 1, maximum: 2 },
        visualWeight: "medium",
      },
      {
        id: "orientation-region",
        role: "orientation",
        requirement: "required",
        cardinality: { minimum: 1, ideal: 1, maximum: 2 },
        visualWeight: "medium",
      },
    ],
    relationships: [
      {
        sourceRegionId: "proof-region",
        relationshipKind: "anchors",
        targetRegionId: "discovery-region",
      },
      {
        sourceRegionId: "story-region",
        relationshipKind: "pairs-with",
        targetRegionId: "proof-region",
      },
      {
        sourceRegionId: "story-region",
        relationshipKind: "offsets",
        targetRegionId: "discovery-region",
      },
      {
        sourceRegionId: "orientation-region",
        relationshipKind: "contains",
        targetRegionId: "story-region",
      },
      {
        sourceRegionId: "orientation-region",
        relationshipKind: "precedes",
        targetRegionId: "discovery-region",
      },
    ],
    orderAlternatives: [
      {
        id: "alternate-reading-order",
        regionIds: [
          "orientation-region",
          "proof-region",
          "story-region",
          "discovery-region",
          "decoration-region",
        ],
      },
      {
        id: "default-reading-order",
        regionIds: [
          "orientation-region",
          "story-region",
          "proof-region",
          "discovery-region",
          "decoration-region",
        ],
      },
    ],
    defaultOrderAlternativeId: "default-reading-order",
  };
}

function requiredRole(role: string) {
  return {
    role,
    requirement: "required",
    cardinality: { minimum: 1, ideal: 1, maximum: 1 },
  };
}

function optionalRole(role: string) {
  return {
    role,
    requirement: "optional",
    cardinality: { minimum: 0, ideal: 1, maximum: 1 },
  };
}

function assetRoleFixture(regionAssetRequirements: readonly unknown[] = defaultAssetRoles()) {
  return {
    contractSchemaVersion: "1.0.0",
    blueprintId,
    blueprintVersion,
    regionAssetRequirements,
  };
}

function defaultAssetRoles() {
  return [
    {
      regionId: "decoration-region",
      roleRequirements: [optionalRole("iconDecorative")],
    },
    {
      regionId: "discovery-region",
      roleRequirements: [requiredRole("heroMobile"), requiredRole("heroDesktop")],
    },
    {
      regionId: "proof-region",
      roleRequirements: [requiredRole("supportingContentImage")],
    },
    {
      regionId: "orientation-region",
      roleRequirements: [requiredRole("logo")],
    },
    {
      regionId: "story-region",
      roleRequirements: [requiredRole("editorialImage")],
    },
  ];
}

function responsiveFixture() {
  const structural = canonicalizePageBlueprintV2StructuralContract(structuralFixture());
  const relationshipTransformations = structural.relationships.map((relationship) => ({
    relationshipKey: createPageBlueprintV2RegionRelationshipKey(relationship),
    transformation: "preserve",
  }));
  const breakpoints = [
    { breakpoint: "mobile", viewport: 375, orderAlternativeId: "alternate-reading-order" },
    { breakpoint: "tablet", viewport: 768, orderAlternativeId: "alternate-reading-order" },
    { breakpoint: "desktop", viewport: 1024, orderAlternativeId: "default-reading-order" },
    { breakpoint: "wide", viewport: 1440, orderAlternativeId: "default-reading-order" },
  ] as const;
  const orders = new Map(
    structural.orderAlternatives.map((alternative) => [alternative.id, alternative.regionIds]),
  );
  return {
    contractSchemaVersion: "1.0.0",
    blueprintId,
    blueprintVersion,
    breakpointRules: breakpoints.map(({ breakpoint, viewport, orderAlternativeId }) => ({
      breakpoint,
      viewport,
      orderAlternativeId,
      regionProportionRules: (orders.get(orderAlternativeId) ?? []).map((regionId) => ({
        regionId,
        proportionMode: "preserve",
      })),
      relationshipTransformations: relationshipTransformations.map((entry) => ({ ...entry })),
    })),
  };
}

function rule(regionId: string, terminalResolution: "omit-region" | "fail-closed" = "fail-closed") {
  return {
    regionId,
    trigger: "required-asset-role-cardinality-unsatisfied",
    terminalResolution,
  };
}

function defaultRules() {
  return [
    rule("proof-region", "omit-region"),
    rule("discovery-region"),
    rule("orientation-region"),
    rule("story-region", "omit-region"),
  ];
}

function fallbackFixture(
  overrides: Partial<{
    contractSchemaVersion: unknown;
    blueprintId: unknown;
    blueprintVersion: unknown;
    blueprintSubstitutionCandidates: readonly unknown[];
    regionFallbackRules: readonly unknown[];
  }> = {},
) {
  return {
    contractSchemaVersion: "1.0.0",
    blueprintId,
    blueprintVersion,
    blueprintSubstitutionCandidates: [
      { blueprintId: "z-priority-target", blueprintVersion: "1.0.0" },
      { blueprintId: "a-secondary-target", blueprintVersion: "1.7.0" },
    ],
    regionFallbackRules: defaultRules(),
    ...overrides,
  };
}

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((entry) => deepFrozen(entry, seen));
}

function canonicalize(
  fallbackInput: unknown = fallbackFixture(),
  options: {
    structuralInput?: unknown;
    assetRoleInput?: unknown;
    responsiveInput?: unknown;
  } = {},
) {
  return canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract(
    options.structuralInput ?? structuralFixture(),
    options.assetRoleInput ?? assetRoleFixture(),
    options.responsiveInput ?? responsiveFixture(),
    fallbackInput,
  );
}

function issueMessages(fallbackInput: unknown): readonly string[] {
  try {
    canonicalize(fallbackInput);
  } catch (error) {
    if (error instanceof ZodError) return error.issues.map(({ message }) => message);
    throw error;
  }
  throw new Error("Expected fallback validation to fail.");
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

describe("P10B-19A-06 versioned fallback companion and exact binding", () => {
  it("owns only contract version 1.0.0 and returns the exact bounded record shape", () => {
    expect(PAGE_BLUEPRINT_V2_OMISSION_SUBSTITUTION_FALLBACK_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    const parsed = canonicalize();
    expect(Object.keys(parsed)).toStrictEqual([
      "contractSchemaVersion",
      "blueprintId",
      "blueprintVersion",
      "blueprintSubstitutionCandidates",
      "regionFallbackRules",
    ]);
    expect(parsed).toMatchObject({
      contractSchemaVersion: "1.0.0",
      blueprintId,
      blueprintVersion,
    });
  });

  it.each([
    ["missing version", { contractSchemaVersion: undefined }],
    ["malformed version", { contractSchemaVersion: "v1" }],
    ["unsupported version", { contractSchemaVersion: "2.0.0" }],
    ["missing blueprint ID", { blueprintId: undefined }],
    ["missing blueprint version", { blueprintVersion: undefined }],
    ["unknown top-level field", { metadata: {} }],
  ])("rejects %s without a default or upgrade", (_label, replacement) => {
    expect(
      pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.safeParse({
        ...fallbackFixture(),
        ...replacement,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["fallback blueprint ID", "fallback", { blueprintId: "other-blueprint" }],
    ["fallback blueprint version", "fallback", { blueprintVersion: "1.4.1" }],
    ["A-04 blueprint ID", "asset", { blueprintId: "other-blueprint" }],
    ["A-04 blueprint version", "asset", { blueprintVersion: "1.4.1" }],
    ["A-05 blueprint ID", "responsive", { blueprintId: "other-blueprint" }],
    ["A-05 blueprint version", "responsive", { blueprintVersion: "1.4.1" }],
  ])("fails closed for an exact %s mismatch", (_label, owner, replacement) => {
    const fallback = fallbackFixture(owner === "fallback" ? replacement : {});
    const assetRoleInput =
      owner === "asset" ? { ...assetRoleFixture(), ...replacement } : assetRoleFixture();
    const responsiveInput =
      owner === "responsive" ? { ...responsiveFixture(), ...replacement } : responsiveFixture();
    expect(() => canonicalize(fallback, { assetRoleInput, responsiveInput })).toThrow();
  });

  it("validates A-03, A-04 and A-05 before accepting fallback authority", () => {
    const structural = structuralFixture();
    const invalidStructural = {
      ...structural,
      regions: structural.regions.map((region) => ({ ...region, id: "duplicate-region" })),
    };
    expect(() => canonicalize(fallbackFixture(), { structuralInput: invalidStructural })).toThrow(
      /Duplicate region IDs/u,
    );

    const invalidAsset = {
      ...assetRoleFixture(),
      regionAssetRequirements: [
        { regionId: "foreign-region", roleRequirements: [requiredRole("logo")] },
      ],
    };
    expect(() => canonicalize(fallbackFixture(), { assetRoleInput: invalidAsset })).toThrow(
      /unknown structural regions/u,
    );

    const invalidResponsive = responsiveFixture();
    invalidResponsive.breakpointRules.pop();
    expect(() => canonicalize(fallbackFixture(), { responsiveInput: invalidResponsive })).toThrow();
  });
});

describe("P10B-19A-06 fixed trigger and exact region-rule coverage", () => {
  it("accepts exactly one rule for every region with at least one required A-04 role", () => {
    const parsed = canonicalize();
    expect(parsed.regionFallbackRules.map(({ regionId }) => regionId)).toStrictEqual([
      "orientation-region",
      "story-region",
      "proof-region",
      "discovery-region",
    ]);
    expect(
      parsed.regionFallbackRules.every(
        ({ trigger }) => trigger === "required-asset-role-cardinality-unsatisfied",
      ),
    ).toBe(true);
    expect(
      parsed.regionFallbackRules.some(({ regionId }) => regionId === "decoration-region"),
    ).toBe(false);
  });

  it.each([
    ["missing rule", defaultRules().slice(1)],
    ["duplicate rule", [...defaultRules(), rule("story-region", "omit-region")]],
    ["extra optional-role-only rule", [...defaultRules(), rule("decoration-region")]],
    ["unknown structural region", [...defaultRules(), rule("foreign-region")]],
    ["wildcard rule", [...defaultRules(), rule("*")]],
  ])("rejects a %s instead of repairing coverage", (_label, regionFallbackRules) => {
    expect(() => canonicalize(fallbackFixture({ regionFallbackRules }))).toThrow();
  });

  it("requires only one region rule when that region declares multiple required roles", () => {
    const discoveryRequirements = defaultAssetRoles().find(
      (entry) => entry.regionId === "discovery-region",
    );
    expect(discoveryRequirements?.roleRequirements).toHaveLength(2);
    expect(
      canonicalize().regionFallbackRules.filter(({ regionId }) => regionId === "discovery-region"),
    ).toHaveLength(1);
  });

  it.each([
    ["missing trigger", { trigger: undefined }],
    ["unknown trigger", { trigger: "asset-unavailable" }],
    ["free-form condition", { condition: "if media is missing" }],
    ["generic when", { when: "unavailable" }],
    ["asset role", { assetRole: "logo" }],
    ["availability", { availableCount: 0 }],
    ["evidence ID", { evidenceId: "evidence-1" }],
  ])("rejects %s inside a fallback rule", (_label, replacement) => {
    const regionFallbackRules = defaultRules().map((entry, index) =>
      index === 0 ? { ...entry, ...replacement } : entry,
    );
    expect(
      pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.safeParse(
        fallbackFixture({ regionFallbackRules }),
      ).success,
    ).toBe(false);
  });

  it("allows a fully empty declaration only when A-04 has no required roles", () => {
    const optionalOnlyAssetRoles = assetRoleFixture([
      {
        regionId: "decoration-region",
        roleRequirements: [optionalRole("iconDecorative")],
      },
      { regionId: "story-region", roleRequirements: [optionalRole("editorialImage")] },
    ]);
    expect(
      canonicalize(
        fallbackFixture({ blueprintSubstitutionCandidates: [], regionFallbackRules: [] }),
        { assetRoleInput: optionalOnlyAssetRoles },
      ),
    ).toStrictEqual({
      contractSchemaVersion: "1.0.0",
      blueprintId,
      blueprintVersion,
      blueprintSubstitutionCandidates: [],
      regionFallbackRules: [],
    });
    expect(() =>
      canonicalize(fallbackFixture({ regionFallbackRules: [] }), {
        assetRoleInput: optionalOnlyAssetRoles,
      }),
    ).toThrow();
    expect(() =>
      canonicalize(
        fallbackFixture({
          blueprintSubstitutionCandidates: [],
          regionFallbackRules: [rule("story-region", "omit-region")],
        }),
        { assetRoleInput: optionalOnlyAssetRoles },
      ),
    ).toThrow();
  });

  it("does not infer rules, targets or a terminal policy", () => {
    expect(() => canonicalize(fallbackFixture({ regionFallbackRules: [] }))).toThrow();
    expect(
      pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.safeParse({
        ...fallbackFixture(),
        regionFallbackRules: defaultRules().map(({ regionId, trigger }) => ({
          regionId,
          trigger,
        })),
      }).success,
    ).toBe(false);
  });
});

describe("P10B-19A-06 terminal-resolution restrictions", () => {
  it("accepts omit-region or fail-closed for optional structural regions", () => {
    expect(() => canonicalize()).not.toThrow();
    const optionalFailClosed = defaultRules().map((entry) =>
      entry.regionId === "story-region" ? rule("story-region", "fail-closed") : entry,
    );
    expect(() =>
      canonicalize(fallbackFixture({ regionFallbackRules: optionalFailClosed })),
    ).not.toThrow();
  });

  it("accepts only fail-closed for a required structural region", () => {
    expect(
      canonicalize().regionFallbackRules.find(({ regionId }) => regionId === "orientation-region"),
    ).toMatchObject({ terminalResolution: "fail-closed" });
    const requiredOmission = defaultRules().map((entry) =>
      entry.regionId === "orientation-region" ? rule("orientation-region", "omit-region") : entry,
    );
    expect(() => canonicalize(fallbackFixture({ regionFallbackRules: requiredOmission }))).toThrow(
      /optional.*omit-region/iu,
    );
  });

  it.each(["hide", "preserve", "placeholder", "degrade", "best-effort", "ignore", "continue"])(
    "rejects terminal resolution %s",
    (terminalResolution) => {
      const regionFallbackRules = defaultRules().map((entry, index) =>
        index === 0 ? { ...entry, terminalResolution } : entry,
      );
      expect(
        pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.safeParse(
          fallbackFixture({ regionFallbackRules }),
        ).success,
      ).toBe(false);
    },
  );
});

describe("P10B-19A-06 ordered whole-blueprint substitution references", () => {
  it("allows an empty chain when triggerable rules exist", () => {
    expect(
      canonicalize(fallbackFixture({ blueprintSubstitutionCandidates: [] }))
        .blueprintSubstitutionCandidates,
    ).toStrictEqual([]);
  });

  it("accepts unresolved external references without registering or selecting them", () => {
    const candidates = [{ blueprintId: "not-registered-anywhere", blueprintVersion: "1.22.3" }];
    const parsed = canonicalize(fallbackFixture({ blueprintSubstitutionCandidates: candidates }));
    expect(parsed.blueprintSubstitutionCandidates).toStrictEqual(candidates);
    expect(parsed).not.toHaveProperty("selectedCandidate");
    expect(parsed).not.toHaveProperty("resolvedCandidate");
  });

  it("preserves declared candidate priority instead of alphabetizing it", () => {
    const parsed = canonicalize();
    expect(parsed.blueprintSubstitutionCandidates.map(({ blueprintId: id }) => id)).toStrictEqual([
      "z-priority-target",
      "a-secondary-target",
    ]);
    const reversed = canonicalize(
      fallbackFixture({
        blueprintSubstitutionCandidates: [
          { blueprintId: "a-secondary-target", blueprintVersion: "1.7.0" },
          { blueprintId: "z-priority-target", blueprintVersion: "1.0.0" },
        ],
      }),
    );
    expect(reversed).not.toStrictEqual(parsed);
    expect(JSON.stringify(reversed)).not.toBe(JSON.stringify(parsed));
  });

  it("accepts exactly eight candidate references and rejects nine", () => {
    const eight = Array.from({ length: 8 }, (_, index) => ({
      blueprintId: `target-${index}`,
      blueprintVersion: `1.${index}.0`,
    }));
    expect(
      canonicalize(fallbackFixture({ blueprintSubstitutionCandidates: eight }))
        .blueprintSubstitutionCandidates,
    ).toHaveLength(8);
    expect(
      pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.safeParse(
        fallbackFixture({
          blueprintSubstitutionCandidates: [
            ...eight,
            { blueprintId: "target-8", blueprintVersion: "1.8.0" },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it.each([
    [
      "duplicate identity",
      [
        { blueprintId: "target-one", blueprintVersion: "1.0.0" },
        { blueprintId: "target-one", blueprintVersion: "1.0.0" },
      ],
    ],
    [
      "duplicate target ID at another version",
      [
        { blueprintId: "target-one", blueprintVersion: "1.0.0" },
        { blueprintId: "target-one", blueprintVersion: "1.9.0" },
      ],
    ],
    ["exact source identity", [{ blueprintId, blueprintVersion }]],
    ["source ID at another version", [{ blueprintId, blueprintVersion: "1.9.0" }]],
  ])("rejects %s", (_label, blueprintSubstitutionCandidates) => {
    expect(() => canonicalize(fallbackFixture({ blueprintSubstitutionCandidates }))).toThrow();
  });

  it.each([
    ["malformed ID", { blueprintId: "Target One", blueprintVersion: "1.0.0" }],
    ["malformed version", { blueprintId: "target-one", blueprintVersion: "v1" }],
    ["unsupported version", { blueprintId: "target-one", blueprintVersion: "2.0.0" }],
    ["page family", { blueprintId: "target-one", blueprintVersion: "1.0.0", pageFamilyId: "home" }],
    [
      "family ID",
      { blueprintId: "target-one", blueprintVersion: "1.0.0", familyId: "editorial-offset" },
    ],
    ["score", { blueprintId: "target-one", blueprintVersion: "1.0.0", score: 1 }],
    ["priority", { blueprintId: "target-one", blueprintVersion: "1.0.0", priority: 1 }],
    ["condition", { blueprintId: "target-one", blueprintVersion: "1.0.0", condition: "available" }],
    ["target regions", { blueprintId: "target-one", blueprintVersion: "1.0.0", targetRegions: [] }],
    [
      "component substitution",
      { blueprintId: "target-one", blueprintVersion: "1.0.0", componentSubstitution: {} },
    ],
    [
      "asset substitution",
      { blueprintId: "target-one", blueprintVersion: "1.0.0", assetSubstitution: {} },
    ],
  ])("rejects candidate %s authority", (_label, candidate) => {
    expect(
      pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.safeParse(
        fallbackFixture({ blueprintSubstitutionCandidates: [candidate] }),
      ).success,
    ).toBe(false);
  });

  it("keeps duplicate-target diagnosis deterministic without reordering valid candidates", () => {
    const candidates = [
      { blueprintId: "z-target", blueprintVersion: "1.0.0" },
      { blueprintId: "a-target", blueprintVersion: "1.0.0" },
      { blueprintId: "z-target", blueprintVersion: "1.1.0" },
      { blueprintId: "a-target", blueprintVersion: "1.2.0" },
    ];
    const first = issueMessages(fallbackFixture({ blueprintSubstitutionCandidates: candidates }));
    const second = issueMessages(
      fallbackFixture({ blueprintSubstitutionCandidates: [...candidates].reverse() }),
    );
    expect(second).toStrictEqual(first);
  });
});

describe("P10B-19A-06 omission-safety and responsive boundaries", () => {
  it("accepts the maximum simultaneous optional omit set without mutating source structure", () => {
    const structural = structuralFixture();
    const before = clone(structural);
    const parsed = canonicalize(fallbackFixture(), { structuralInput: structural });
    expect(
      parsed.regionFallbackRules
        .filter(({ terminalResolution }) => terminalResolution === "omit-region")
        .map(({ regionId }) => regionId),
    ).toStrictEqual(["story-region", "proof-region"]);
    expect(structural).toStrictEqual(before);
    expect(parsed).not.toHaveProperty("projectedBlueprint");
    expect(parsed).not.toHaveProperty("regions");
    expect(parsed).not.toHaveProperty("relationships");
    expect(parsed).not.toHaveProperty("orderAlternatives");
  });

  it("keeps structural, asset-role, responsive and fallback inputs unchanged", () => {
    const structuralInput = structuralFixture();
    const assetRoleInput = assetRoleFixture();
    const responsiveInput = responsiveFixture();
    const fallbackInput = fallbackFixture();
    const before = clone({ structuralInput, assetRoleInput, responsiveInput, fallbackInput });

    const parsed = canonicalize(fallbackInput, {
      structuralInput,
      assetRoleInput,
      responsiveInput,
    });

    expect({ structuralInput, assetRoleInput, responsiveInput, fallbackInput }).toStrictEqual(
      before,
    );
    expect(parsed).not.toHaveProperty("responsiveRule");
    expect(JSON.stringify(parsed)).not.toMatch(/breakpoint|viewport|proportion|transformation/iu);
  });

  it("leaves A-03, A-04 and A-05 canonical outputs exactly unchanged", () => {
    const structuralInput = structuralFixture();
    const assetRoleInput = assetRoleFixture();
    const responsiveInput = responsiveFixture();
    const structuralBefore = canonicalizePageBlueprintV2StructuralContract(structuralInput);
    const assetBefore = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
      structuralInput,
      assetRoleInput,
    );
    const responsiveBefore = canonicalizePageBlueprintV2ResponsiveRuleContract(
      structuralInput,
      responsiveInput,
    );

    canonicalize(fallbackFixture(), { structuralInput, assetRoleInput, responsiveInput });

    expect(canonicalizePageBlueprintV2StructuralContract(structuralInput)).toStrictEqual(
      structuralBefore,
    );
    expect(
      canonicalizePageBlueprintV2AssetRoleCompatibilityContract(structuralInput, assetRoleInput),
    ).toStrictEqual(assetBefore);
    expect(
      canonicalizePageBlueprintV2ResponsiveRuleContract(structuralInput, responsiveInput),
    ).toStrictEqual(responsiveBefore);
  });

  it.each([
    ["breakpoint fallback", { breakpoint: "mobile" }],
    ["viewport fallback", { viewport: 375 }],
    ["responsive rule", { responsiveRule: "omit" }],
    ["visibility", { visibility: "hidden" }],
    ["responsive source", { responsiveSource: "hero-mobile" }],
  ])("rejects %s authority from a region rule", (_label, foreignField) => {
    const regionFallbackRules = defaultRules().map((entry, index) =>
      index === 0 ? { ...entry, ...foreignField } : entry,
    );
    expect(
      pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.safeParse(
        fallbackFixture({ regionFallbackRules }),
      ).success,
    ).toBe(false);
  });
});

describe("P10B-19A-06 deterministic canonicalization and readonly output", () => {
  it("orders region rules by the A-03 default reading order", () => {
    const parsed = canonicalize(
      fallbackFixture({ regionFallbackRules: [...defaultRules()].reverse() }),
    );
    expect(parsed.regionFallbackRules.map(({ regionId }) => regionId)).toStrictEqual([
      "orientation-region",
      "story-region",
      "proof-region",
      "discovery-region",
    ]);
  });

  it("canonicalizes every valid region-rule permutation identically", () => {
    const rules = defaultRules();
    const first = canonicalize(fallbackFixture({ regionFallbackRules: rules }));
    const second = canonicalize(
      fallbackFixture({ regionFallbackRules: [rules[2], rules[0], rules[3], rules[1]] }),
    );
    expect(second).toStrictEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("preserves exact candidate versions and terminal outcomes", () => {
    const parsed = canonicalize();
    expect(parsed.blueprintSubstitutionCandidates).toStrictEqual([
      { blueprintId: "z-priority-target", blueprintVersion: "1.0.0" },
      { blueprintId: "a-secondary-target", blueprintVersion: "1.7.0" },
    ]);
    expect(
      Object.fromEntries(
        parsed.regionFallbackRules.map(({ regionId, terminalResolution }) => [
          regionId,
          terminalResolution,
        ]),
      ),
    ).toStrictEqual({
      "orientation-region": "fail-closed",
      "story-region": "omit-region",
      "proof-region": "omit-region",
      "discovery-region": "fail-closed",
    });
  });

  it("returns a deeply readonly output with no fingerprint or topology identity", () => {
    const parsed = canonicalize();
    expect(deepFrozen(parsed)).toBe(true);
    expect(parsed).not.toHaveProperty("fingerprint");
    expect(parsed).not.toHaveProperty("normalizedTopology");
    expect(JSON.stringify(parsed)).not.toMatch(/fingerprint|normalizedTopology/iu);
  });

  it("never silently deduplicates or supplies missing authority", () => {
    const duplicateRules = [...defaultRules(), { ...defaultRules()[0] }];
    expect(() => canonicalize(fallbackFixture({ regionFallbackRules: duplicateRules }))).toThrow();
    expect(() =>
      canonicalize(fallbackFixture({ regionFallbackRules: defaultRules().slice(1) })),
    ).toThrow();
  });
});

describe("P10B-19A-06 forbidden authority and zero production reachability", () => {
  it.each([
    "assetId",
    "assetIds",
    "assetRole",
    "availableAssets",
    "availableCount",
    "evidenceId",
    "evidence",
    "provenanceKind",
    "approvalStatus",
    "condition",
    "when",
    "pageFamilyId",
    "familyId",
    "familyVersion",
    "lifecycleState",
    "route",
    "slug",
    "pageId",
    "component",
    "componentId",
    "componentFamily",
    "variant",
    "props",
    "responsiveRule",
    "breakpoint",
    "viewport",
    "visibility",
    "hidden",
    "display",
    "hide",
    "replacementRegionId",
    "targetRegions",
    "sourceRegionIds",
    "productId",
    "collectionId",
    "commerce",
    "media",
    "palette",
    "font",
    "css",
    "html",
    "className",
    "style",
    "score",
    "weight",
    "priority",
    "compatibilityScore",
    "selectedCandidate",
    "resolvedCandidate",
    "selectedAsset",
    "reuse",
    "crop",
    "focalPoint",
    "placeholder",
    "repair",
    "providerPayload",
    "visualRecipe",
    "fingerprint",
    "normalizedTopology",
    "migrationAlias",
  ])("rejects foreign root authority %s", (field) => {
    expect(
      pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.safeParse({
        ...fallbackFixture(),
        [field]: "forbidden",
      }).success,
    ).toBe(false);
  });

  it.each([
    ["replacement region", { replacementRegionId: "other-region" }],
    ["target regions", { targetRegions: ["other-region"] }],
    ["source regions", { sourceRegionIds: ["story-region"] }],
    ["component", { componentId: "homepageHero" }],
    ["asset", { assetId: "asset-1" }],
    ["placeholder", { placeholder: true }],
    ["priority", { priority: 1 }],
  ])("rejects region-rule %s authority", (_label, foreignField) => {
    const regionFallbackRules = defaultRules().map((entry, index) =>
      index === 0 ? { ...entry, ...foreignField } : entry,
    );
    expect(
      pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.safeParse(
        fallbackFixture({ regionFallbackRules }),
      ).success,
    ).toBe(false);
  });

  it("imports only Zod and direct A-03, A-04 and A-05 sibling authorities", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/application/storefront-templates/page-blueprint-v2-omission-substitution-fallback-contract.ts",
      ),
      "utf8",
    );
    const importSources = [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map(
      (match) => match[1],
    );
    expect([...new Set(importSources)].sort()).toStrictEqual([
      "./page-blueprint-v2-asset-role-contract",
      "./page-blueprint-v2-contract",
      "./page-blueprint-v2-responsive-rule-contract",
      "zod",
    ]);
  });

  it("exports schemas and a pure canonicalizer but no fallback record or target", () => {
    const records = Object.entries(storefrontTemplateAuthority).filter(
      ([, value]) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.hasOwn(value, "contractSchemaVersion") &&
        Object.hasOwn(value, "regionFallbackRules"),
    );
    expect(records).toStrictEqual([]);
    expect(
      Object.keys(storefrontTemplateAuthority).filter((name) =>
        /default.*fallback|fallback.*registry|fallback.*record|selected.*candidate/iu.test(name),
      ),
    ).toStrictEqual([]);
    expect(listExecutablePageBlueprintProfiles()).toHaveLength(53);
  });

  it("keeps the companion unreachable from every current production consumer", () => {
    const repositoryRoot = resolve(process.cwd());
    const allowedAuthorityFiles = new Set([
      "src/application/storefront-templates/page-blueprint-v2-omission-substitution-fallback-contract.ts",
      "src/application/storefront-templates/page-blueprint-v2-candidate-authority.ts",
      "src/application/storefront-templates/index.ts",
    ]);
    const consumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) =>
        /page-blueprint-v2-omission-substitution-fallback-contract|PageBlueprintV2OmissionSubstitutionFallback|pageBlueprintV2OmissionSubstitutionFallback|PAGE_BLUEPRINT_V2_OMISSION_SUBSTITUTION_FALLBACK/u.test(
          source,
        ),
      )
      .map(({ path }) => relative(repositoryRoot, path))
      .filter((path) => !allowedAuthorityFiles.has(path));
    expect(consumers).toStrictEqual([]);

    [
      "src/application/storefront-templates/page-blueprint-version-dispatch.ts",
      "src/application/storefront-templates/registry.ts",
      "src/application/storefront-templates/resolver.ts",
      "src/application/storefront-templates/profile-materializer.ts",
      "src/application/storefront-templates/materializer.ts",
      "src/application/storefront-templates/selection-planner.ts",
      "src/application/whole-storefront-generation-plan/planner.ts",
      "src/domain/storefront/storefront.ts",
    ].forEach((path) => {
      expect(readFileSync(resolve(repositoryRoot, path), "utf8")).not.toMatch(
        /page-blueprint-v2-omission-substitution-fallback-contract|PageBlueprintV2OmissionSubstitutionFallback|pageBlueprintV2OmissionSubstitutionFallback|PAGE_BLUEPRINT_V2_OMISSION_SUBSTITUTION_FALLBACK/u,
      );
    });
  });

  it.each(
    Object.entries({
      "src/application/storefront-templates/page-blueprint-v2-contract.ts":
        "4a050629af7b792e59b54c229891020cde65fffc793ae88c9049b2a3e143da69",
      "src/application/storefront-templates/page-blueprint-version-dispatch.ts":
        "56a72d7dc001249b64b355991cdf04cc441149a6c7d0e248d64993d29afc9331",
      "src/application/storefront-templates/page-blueprint-v2-asset-role-contract.ts":
        "253ea3e99e3c4728bef0df0fc5c452f817c56affecb6f10fe73bafec462dd68d",
      "src/application/storefront-templates/page-blueprint-v2-responsive-rule-contract.ts":
        "c2799603ff03b735cc5171156494e8031a346d3fe99172b38c4c72ea7acfd337",
    }),
  )("keeps protected A-03/A-04/A-05 authority byte-identical: %s", (path, expectedHash) => {
    expect(
      createHash("sha256")
        .update(readFileSync(resolve(process.cwd(), path)))
        .digest("hex"),
    ).toBe(expectedHash);
  });
});
