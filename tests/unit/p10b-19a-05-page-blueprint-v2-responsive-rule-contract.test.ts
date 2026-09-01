import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ZodError } from "zod";
import { describe, expect, it } from "vitest";
import * as storefrontTemplateAuthority from "@/application/storefront-templates";
import {
  PAGE_BLUEPRINT_V2_RESPONSIVE_RULE_CONTRACT_SCHEMA_VERSION,
  canonicalizePageBlueprintV2ResponsiveRuleContract,
  listExecutablePageBlueprintProfiles,
  pageBlueprintV2ResponsiveBreakpointAuthority,
  pageBlueprintV2ResponsiveBreakpointRuleSchema,
  pageBlueprintV2ResponsiveBreakpointSchema,
  pageBlueprintV2ResponsiveRegionProportionModes,
  pageBlueprintV2ResponsiveRegionProportionModeSchema,
  pageBlueprintV2ResponsiveRegionProportionRuleSchema,
  pageBlueprintV2ResponsiveRelationshipTransformationPolicy,
  pageBlueprintV2ResponsiveRelationshipTransformationModeSchema,
  pageBlueprintV2ResponsiveRelationshipTransformationSchema,
  pageBlueprintV2ResponsiveRelationshipTransformations,
  pageBlueprintV2ResponsiveRuleContractV1Schema,
} from "@/application/storefront-templates";

const breakpointAuthority = [
  { breakpoint: "mobile", viewport: 375 },
  { breakpoint: "tablet", viewport: 768 },
  { breakpoint: "desktop", viewport: 1024 },
  { breakpoint: "wide", viewport: 1440 },
] as const;

const selectedOrderByBreakpoint = {
  mobile: "mobile-reading-order",
  tablet: "tablet-reading-order",
  desktop: "desktop-reading-order",
  wide: "wide-reading-order",
} as const;

const regionOrderByAlternative = {
  "mobile-reading-order": ["m-story", "z-orientation", "a-discovery", "n-proof"],
  "tablet-reading-order": ["z-orientation", "m-story", "n-proof", "a-discovery"],
  "desktop-reading-order": ["z-orientation", "a-discovery", "m-story", "n-proof"],
  "wide-reading-order": ["z-orientation", "n-proof", "a-discovery", "m-story"],
} as const;

const canonicalRelationshipKeys = [
  "z-orientation->precedes->a-discovery",
  "a-discovery->pairs-with->z-orientation",
  "z-orientation->contains->n-proof",
  "a-discovery->offsets->m-story",
  "m-story->spans->a-discovery",
  "n-proof->anchors->a-discovery",
] as const;

const variedRelationshipTransformations = [
  { relationshipKey: canonicalRelationshipKeys[0], transformation: "preserve" },
  { relationshipKey: canonicalRelationshipKeys[1], transformation: "stack" },
  { relationshipKey: canonicalRelationshipKeys[2], transformation: "flatten" },
  { relationshipKey: canonicalRelationshipKeys[3], transformation: "remove-offset" },
  { relationshipKey: canonicalRelationshipKeys[4], transformation: "reduce-span" },
  { relationshipKey: canonicalRelationshipKeys[5], transformation: "linearize" },
] as const;

const proportionByRegion = {
  "z-orientation": "compress",
  "a-discovery": "full-width",
  "m-story": "preserve",
  "n-proof": "expand",
} as const;

function structuralFixture(relationships = structuralRelationships()) {
  return {
    id: "home-responsive-structure",
    version: "1.4.0",
    pageFamilyId: "home",
    regions: [
      {
        id: "n-proof",
        role: "brand-proof",
        requirement: "optional",
        cardinality: { minimum: 0, ideal: 1, maximum: 2 },
        visualWeight: "light",
      },
      {
        id: "m-story",
        role: "brand-story",
        requirement: "optional",
        cardinality: { minimum: 0, ideal: 1, maximum: 2 },
        visualWeight: "medium",
      },
      {
        id: "a-discovery",
        role: "primary-discovery",
        requirement: "required",
        cardinality: { minimum: 1, ideal: 1, maximum: 2 },
        visualWeight: "heavy",
      },
      {
        id: "z-orientation",
        role: "orientation",
        requirement: "required",
        cardinality: { minimum: 1, ideal: 1, maximum: 2 },
        visualWeight: "medium",
      },
    ],
    relationships,
    orderAlternatives: [
      {
        id: "wide-reading-order",
        regionIds: [...regionOrderByAlternative["wide-reading-order"]],
      },
      {
        id: "mobile-reading-order",
        regionIds: [...regionOrderByAlternative["mobile-reading-order"]],
      },
      {
        id: "desktop-reading-order",
        regionIds: [...regionOrderByAlternative["desktop-reading-order"]],
      },
      {
        id: "tablet-reading-order",
        regionIds: [...regionOrderByAlternative["tablet-reading-order"]],
      },
    ],
    defaultOrderAlternativeId: "desktop-reading-order",
  };
}

function structuralRelationships() {
  return [
    {
      sourceRegionId: "n-proof",
      relationshipKind: "anchors",
      targetRegionId: "a-discovery",
    },
    {
      sourceRegionId: "m-story",
      relationshipKind: "spans",
      targetRegionId: "a-discovery",
    },
    {
      sourceRegionId: "a-discovery",
      relationshipKind: "offsets",
      targetRegionId: "m-story",
    },
    {
      sourceRegionId: "z-orientation",
      relationshipKind: "contains",
      targetRegionId: "n-proof",
    },
    {
      sourceRegionId: "z-orientation",
      relationshipKind: "pairs-with",
      targetRegionId: "a-discovery",
    },
    {
      sourceRegionId: "z-orientation",
      relationshipKind: "precedes",
      targetRegionId: "a-discovery",
    },
  ];
}

function responsiveFixture(options: { preserveOnly?: boolean; noRelationships?: boolean } = {}) {
  const transformations = options.noRelationships
    ? []
    : options.preserveOnly
      ? canonicalRelationshipKeys.map((relationshipKey) => ({
          relationshipKey,
          transformation: "preserve",
        }))
      : variedRelationshipTransformations.map((transformation) => ({ ...transformation }));

  return {
    contractSchemaVersion: "1.0.0",
    blueprintId: "home-responsive-structure",
    blueprintVersion: "1.4.0",
    breakpointRules: breakpointAuthority.map(({ breakpoint, viewport }) => {
      const orderAlternativeId = selectedOrderByBreakpoint[breakpoint];
      return {
        breakpoint,
        viewport,
        orderAlternativeId,
        regionProportionRules: [...regionOrderByAlternative[orderAlternativeId]]
          .reverse()
          .map((regionId) => ({ regionId, proportionMode: proportionByRegion[regionId] })),
        relationshipTransformations: transformations.map((transformation) => ({
          ...transformation,
        })),
      };
    }),
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

function issueMessages(structuralInput: unknown, responsiveInput: unknown): readonly string[] {
  try {
    canonicalizePageBlueprintV2ResponsiveRuleContract(structuralInput, responsiveInput);
  } catch (error) {
    if (error instanceof ZodError) return error.issues.map(({ message }) => message);
    throw error;
  }
  throw new Error("Expected responsive-rule validation to fail.");
}

function replaceRelationshipTransformation(
  responsiveInput: ReturnType<typeof responsiveFixture>,
  relationshipKey: string,
  transformation: string,
) {
  return {
    ...responsiveInput,
    breakpointRules: responsiveInput.breakpointRules.map((rule, index) => ({
      ...rule,
      relationshipTransformations: rule.relationshipTransformations.map((entry) =>
        index === 0 && entry.relationshipKey === relationshipKey
          ? { ...entry, transformation }
          : entry,
      ),
    })),
  };
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

describe("P10B-19A-05 exact structural breakpoint authority", () => {
  it("owns exactly the four ordered breakpoint and viewport pairs", () => {
    expect(pageBlueprintV2ResponsiveBreakpointAuthority).toStrictEqual(breakpointAuthority);
    expect(deepFrozen(pageBlueprintV2ResponsiveBreakpointAuthority)).toBe(true);
    breakpointAuthority.forEach((entry) =>
      expect(pageBlueprintV2ResponsiveBreakpointSchema.parse(entry)).toStrictEqual(entry),
    );
  });

  it.each(breakpointAuthority)(
    "accepts exact $breakpoint/$viewport pair without normalization",
    (entry) => {
      expect(pageBlueprintV2ResponsiveBreakpointSchema.parse(entry)).toStrictEqual(entry);
    },
  );

  it.each(["phone", "mobile-sm", "laptop", "xl", "Mobile", " mobile ", ""])(
    "rejects unknown or aliased breakpoint %j",
    (breakpoint) => {
      expect(
        pageBlueprintV2ResponsiveBreakpointSchema.safeParse({ breakpoint, viewport: 375 }).success,
      ).toBe(false);
    },
  );

  it.each([
    ["missing breakpoint", (rules: readonly unknown[]) => rules.slice(0, 3)],
    [
      "duplicate breakpoint",
      (rules: readonly Record<string, unknown>[]) => [
        ...rules.slice(0, 3),
        { ...rules[3], breakpoint: "mobile" },
      ],
    ],
    [
      "unknown breakpoint",
      (rules: readonly Record<string, unknown>[]) => [
        ...rules.slice(0, 3),
        { ...rules[3], breakpoint: "cinema" },
      ],
    ],
    [
      "duplicate viewport",
      (rules: readonly Record<string, unknown>[]) => [
        rules[0],
        { ...rules[1], viewport: 375 },
        ...rules.slice(2),
      ],
    ],
    [
      "viewport mismatch",
      (rules: readonly Record<string, unknown>[]) => [
        ...rules.slice(0, 2),
        { ...rules[2], viewport: 1440 },
        rules[3],
      ],
    ],
    [
      "arbitrary viewport",
      (rules: readonly Record<string, unknown>[]) => [
        { ...rules[0], viewport: 390 },
        ...rules.slice(1),
      ],
    ],
    [
      "unknown breakpoint-rule field",
      (rules: readonly Record<string, unknown>[]) => [
        { ...rules[0], mediaQuery: "(min-width: 375px)" },
        ...rules.slice(1),
      ],
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const input = responsiveFixture();
    expect(
      pageBlueprintV2ResponsiveRuleContractV1Schema.safeParse({
        ...input,
        breakpointRules: mutate(input.breakpointRules),
      }).success,
    ).toBe(false);
  });
});

describe("P10B-19A-05 versioned companion and exact structural identity", () => {
  it("keeps contract version explicit and distinct while accepting exact bound identity", () => {
    expect(PAGE_BLUEPRINT_V2_RESPONSIVE_RULE_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    const parsed = canonicalizePageBlueprintV2ResponsiveRuleContract(
      structuralFixture(),
      responsiveFixture(),
    );
    expect(parsed).toMatchObject({
      contractSchemaVersion: "1.0.0",
      blueprintId: "home-responsive-structure",
      blueprintVersion: "1.4.0",
    });
    expect(Object.keys(parsed)).toStrictEqual([
      "contractSchemaVersion",
      "blueprintId",
      "blueprintVersion",
      "breakpointRules",
    ]);
  });

  it.each([
    ["missing version", { contractSchemaVersion: undefined }],
    ["malformed version", { contractSchemaVersion: "v1" }],
    ["unsupported version", { contractSchemaVersion: "2.0.0" }],
    ["missing blueprint ID", { blueprintId: undefined }],
    ["missing blueprint version", { blueprintVersion: undefined }],
    ["unknown top-level field", { metadata: {} }],
  ])("rejects %s", (_label, replacement) => {
    expect(
      pageBlueprintV2ResponsiveRuleContractV1Schema.safeParse({
        ...responsiveFixture(),
        ...replacement,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["blueprint ID", { blueprintId: "other-blueprint" }],
    ["blueprint version", { blueprintVersion: "1.4.1" }],
  ])("rejects exact %s mismatch", (_label, replacement) => {
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(structuralFixture(), {
        ...responsiveFixture(),
        ...replacement,
      }),
    ).toThrow();
  });

  it("validates structural authority first and never repairs it", () => {
    const structural = structuralFixture();
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(
        {
          ...structural,
          orderAlternatives: structural.orderAlternatives.map((alternative, index) =>
            index === 0
              ? {
                  ...alternative,
                  regionIds: [
                    alternative.regionIds[0],
                    alternative.regionIds[0],
                    ...alternative.regionIds.slice(2),
                  ],
                }
              : alternative,
          ),
        },
        responsiveFixture(),
      ),
    ).toThrow();
  });
});

describe("P10B-19A-05 explicit structural order and region coverage", () => {
  it("allows every breakpoint to select a different complete structural order", () => {
    const parsed = canonicalizePageBlueprintV2ResponsiveRuleContract(
      structuralFixture(),
      responsiveFixture(),
    );
    expect(
      Object.fromEntries(
        parsed.breakpointRules.map((rule) => [rule.breakpoint, rule.orderAlternativeId]),
      ),
    ).toStrictEqual(selectedOrderByBreakpoint);
  });

  it.each([
    ["unknown order alternative", { orderAlternativeId: "inferred-order" }],
    ["missing order alternative", { orderAlternativeId: undefined }],
    ["direct custom order", { regionIds: ["z-orientation", "a-discovery"] }],
    ["default inference metadata", { useDefaultOrder: true }],
  ])("rejects %s", (_label, replacement) => {
    const responsive = responsiveFixture();
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(structuralFixture(), {
        ...responsive,
        breakpointRules: [
          { ...responsive.breakpointRules[0], ...replacement },
          ...responsive.breakpointRules.slice(1),
        ],
      }),
    ).toThrow();
  });

  it("owns exactly four region-proportion modes", () => {
    expect(pageBlueprintV2ResponsiveRegionProportionModes).toStrictEqual([
      "preserve",
      "compress",
      "expand",
      "full-width",
    ]);
    expect(pageBlueprintV2ResponsiveRegionProportionModeSchema.options).toStrictEqual([
      "preserve",
      "compress",
      "expand",
      "full-width",
    ]);
    expect(deepFrozen(pageBlueprintV2ResponsiveRegionProportionModes)).toBe(true);
  });

  it.each(["preserve", "compress", "expand", "full-width"])(
    "accepts exact proportion mode %s",
    (proportionMode) => {
      expect(
        pageBlueprintV2ResponsiveRegionProportionRuleSchema.safeParse({
          regionId: "z-orientation",
          proportionMode,
        }).success,
      ).toBe(true);
    },
  );

  it.each([
    ["missing region", (rules: readonly Record<string, unknown>[]) => rules.slice(1)],
    [
      "duplicate region",
      (rules: readonly Record<string, unknown>[]) => [...rules, { ...rules[0] }],
    ],
    [
      "unknown region",
      (rules: readonly Record<string, unknown>[]) => [
        { ...rules[0], regionId: "foreign-region" },
        ...rules.slice(1),
      ],
    ],
    [
      "unknown proportion",
      (rules: readonly Record<string, unknown>[]) => [
        { ...rules[0], proportionMode: "balance" },
        ...rules.slice(1),
      ],
    ],
    [
      "implicit preserve",
      (rules: readonly Record<string, unknown>[]) => [
        { regionId: rules[0]?.regionId },
        ...rules.slice(1),
      ],
    ],
    [
      "wildcard",
      (rules: readonly Record<string, unknown>[]) => [
        { ...rules[0], regionId: "*" },
        ...rules.slice(1),
      ],
    ],
  ])("rejects %s without repair", (_label, mutate) => {
    const responsive = responsiveFixture();
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(structuralFixture(), {
        ...responsive,
        breakpointRules: responsive.breakpointRules.map((rule, index) =>
          index === 0
            ? { ...rule, regionProportionRules: mutate(rule.regionProportionRules) }
            : rule,
        ),
      }),
    ).toThrow();
  });

  it.each([
    ["visibility", { visibility: "hidden" }],
    ["cardinality", { cardinality: { minimum: 0, ideal: 0, maximum: 0 } }],
    ["component", { componentId: "homepageHero" }],
    ["style", { style: { width: "50%" } }],
    ["percentage", { percentage: 50 }],
  ])("rejects foreign region-rule %s authority", (_label, foreignField) => {
    expect(
      pageBlueprintV2ResponsiveRegionProportionRuleSchema.safeParse({
        regionId: "z-orientation",
        proportionMode: "preserve",
        ...foreignField,
      }).success,
    ).toBe(false);
  });

  it("cannot alter structural region requirement, role, cardinality or visual weight", () => {
    const structural = structuralFixture();
    const before = clone(structural);
    const parsed = canonicalizePageBlueprintV2ResponsiveRuleContract(
      structural,
      responsiveFixture(),
    );
    expect(structural).toStrictEqual(before);
    expect(JSON.stringify(parsed)).not.toMatch(/cardinality|requirement|visualWeight|role/iu);
    parsed.breakpointRules.forEach((rule) =>
      expect(rule.regionProportionRules).toHaveLength(structural.regions.length),
    );
  });
});

describe("P10B-19A-05 relationship transformation integrity", () => {
  it("owns only the six bounded transformation names and per-kind policy", () => {
    expect(pageBlueprintV2ResponsiveRelationshipTransformations).toStrictEqual([
      "preserve",
      "stack",
      "remove-offset",
      "flatten",
      "reduce-span",
      "linearize",
    ]);
    expect(pageBlueprintV2ResponsiveRelationshipTransformationModeSchema.options).toStrictEqual([
      "preserve",
      "stack",
      "remove-offset",
      "flatten",
      "reduce-span",
      "linearize",
    ]);
    expect(pageBlueprintV2ResponsiveRelationshipTransformationPolicy).toStrictEqual({
      precedes: ["preserve"],
      "pairs-with": ["preserve", "stack"],
      offsets: ["preserve", "remove-offset"],
      contains: ["preserve", "flatten"],
      spans: ["preserve", "reduce-span"],
      anchors: ["preserve", "linearize"],
    });
    expect(deepFrozen(pageBlueprintV2ResponsiveRelationshipTransformations)).toBe(true);
    expect(deepFrozen(pageBlueprintV2ResponsiveRelationshipTransformationPolicy)).toBe(true);
  });

  it.each([
    [canonicalRelationshipKeys[0], "preserve"],
    [canonicalRelationshipKeys[1], "stack"],
    [canonicalRelationshipKeys[3], "remove-offset"],
    [canonicalRelationshipKeys[2], "flatten"],
    [canonicalRelationshipKeys[4], "reduce-span"],
    [canonicalRelationshipKeys[5], "linearize"],
  ])("accepts compatible transformation %s => %s", (relationshipKey, transformation) => {
    const preserveOnly = responsiveFixture({ preserveOnly: true });
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(
        structuralFixture(),
        replaceRelationshipTransformation(preserveOnly, relationshipKey, transformation),
      ),
    ).not.toThrow();
  });

  it.each([
    [canonicalRelationshipKeys[0], "stack"],
    [canonicalRelationshipKeys[1], "remove-offset"],
    [canonicalRelationshipKeys[3], "stack"],
    [canonicalRelationshipKeys[2], "linearize"],
    [canonicalRelationshipKeys[4], "flatten"],
    [canonicalRelationshipKeys[5], "reduce-span"],
  ])("rejects incompatible transformation %s => %s", (relationshipKey, transformation) => {
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(
        structuralFixture(),
        replaceRelationshipTransformation(responsiveFixture(), relationshipKey, transformation),
      ),
    ).toThrow();
  });

  it.each([
    [canonicalRelationshipKeys[0], "stack"],
    [canonicalRelationshipKeys[1], "remove-offset"],
    [canonicalRelationshipKeys[3], "stack"],
    [canonicalRelationshipKeys[2], "linearize"],
    [canonicalRelationshipKeys[4], "flatten"],
    [canonicalRelationshipKeys[5], "reduce-span"],
  ])(
    "rejects kind-incompatible transformation directly in the rule schema: %s => %s",
    (relationshipKey, transformation) => {
      expect(
        pageBlueprintV2ResponsiveRelationshipTransformationSchema.safeParse({
          relationshipKey,
          transformation,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects a complete standalone contract containing a kind-incompatible transformation", () => {
    const incompatible = replaceRelationshipTransformation(
      responsiveFixture(),
      canonicalRelationshipKeys[0],
      "stack",
    );
    expect(pageBlueprintV2ResponsiveRuleContractV1Schema.safeParse(incompatible).success).toBe(
      false,
    );
  });

  it.each([
    ["missing relationship", (rules: readonly Record<string, unknown>[]) => rules.slice(1)],
    [
      "duplicate relationship",
      (rules: readonly Record<string, unknown>[]) => [...rules, { ...rules[0] }],
    ],
    [
      "unknown relationship",
      (rules: readonly Record<string, unknown>[]) => [
        {
          ...rules[0],
          relationshipKey: "z-orientation->anchors->m-story",
        },
        ...rules.slice(1),
      ],
    ],
    [
      "malformed relationship key",
      (rules: readonly Record<string, unknown>[]) => [
        { ...rules[0], relationshipKey: "not-a-relationship-key" },
        ...rules.slice(1),
      ],
    ],
    [
      "reversed noncanonical pairs-with key",
      (rules: readonly Record<string, unknown>[]) =>
        rules.map((rule) =>
          rule.relationshipKey === "a-discovery->pairs-with->z-orientation"
            ? { ...rule, relationshipKey: "z-orientation->pairs-with->a-discovery" }
            : rule,
        ),
    ],
    [
      "unknown transformation",
      (rules: readonly Record<string, unknown>[]) => [
        { ...rules[0], transformation: "delete" },
        ...rules.slice(1),
      ],
    ],
    [
      "implicit preserve",
      (rules: readonly Record<string, unknown>[]) => [
        { relationshipKey: rules[0]?.relationshipKey },
        ...rules.slice(1),
      ],
    ],
    [
      "wildcard relationship",
      (rules: readonly Record<string, unknown>[]) => [
        { ...rules[0], relationshipKey: "*" },
        ...rules.slice(1),
      ],
    ],
  ])("rejects %s without creation, deletion or repair", (_label, mutate) => {
    const responsive = responsiveFixture();
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(structuralFixture(), {
        ...responsive,
        breakpointRules: responsive.breakpointRules.map((rule, index) =>
          index === 0
            ? { ...rule, relationshipTransformations: mutate(rule.relationshipTransformations) }
            : rule,
        ),
      }),
    ).toThrow();
  });

  it.each([
    ["parallel source", { sourceRegionId: "z-orientation" }],
    ["parallel target", { targetRegionId: "a-discovery" }],
    ["parallel kind", { relationshipKind: "precedes" }],
    ["operation payload", { payload: { delete: true } }],
  ])("rejects foreign relationship %s authority", (_label, foreignField) => {
    expect(
      pageBlueprintV2ResponsiveRelationshipTransformationSchema.safeParse({
        relationshipKey: canonicalRelationshipKeys[0],
        transformation: "preserve",
        ...foreignField,
      }).success,
    ).toBe(false);
  });

  it("requires explicit empty collections only for a structure with no relationships", () => {
    const noRelationshipStructural = structuralFixture([]);
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(
        noRelationshipStructural,
        responsiveFixture({ noRelationships: true }),
      ),
    ).not.toThrow();
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(
        structuralFixture(),
        responsiveFixture({ noRelationships: true }),
      ),
    ).toThrow();
    expect(() =>
      canonicalizePageBlueprintV2ResponsiveRuleContract(
        noRelationshipStructural,
        responsiveFixture({ preserveOnly: true }),
      ),
    ).toThrow();
  });
});

describe("P10B-19A-05 total deterministic canonicalization", () => {
  it("accepts an explicit preserve-only contract without inferred authority", () => {
    const parsed = canonicalizePageBlueprintV2ResponsiveRuleContract(
      structuralFixture(),
      responsiveFixture({ preserveOnly: true }),
    );
    expect(
      parsed.breakpointRules.every((rule) =>
        rule.relationshipTransformations.every(
          ({ transformation }) => transformation === "preserve",
        ),
      ),
    ).toBe(true);
  });

  it("orders breakpoints, regions and relationships by their distinct canonical owners", () => {
    const responsive = responsiveFixture();
    const permuted = {
      ...responsive,
      breakpointRules: [...responsive.breakpointRules].reverse().map((rule) => ({
        ...rule,
        regionProportionRules: [...rule.regionProportionRules].reverse(),
        relationshipTransformations: [...rule.relationshipTransformations].reverse(),
      })),
    };
    const parsed = canonicalizePageBlueprintV2ResponsiveRuleContract(structuralFixture(), permuted);

    expect(parsed.breakpointRules.map(({ breakpoint }) => breakpoint)).toStrictEqual([
      "mobile",
      "tablet",
      "desktop",
      "wide",
    ]);
    parsed.breakpointRules.forEach((rule) => {
      const selectedOrder = Object.entries(regionOrderByAlternative).find(
        ([alternativeId]) => alternativeId === rule.orderAlternativeId,
      )?.[1];
      expect(selectedOrder).toBeDefined();
      expect(rule.regionProportionRules.map(({ regionId }) => regionId)).toStrictEqual(
        selectedOrder,
      );
      expect(
        rule.relationshipTransformations.map(({ relationshipKey }) => relationshipKey),
      ).toStrictEqual(canonicalRelationshipKeys);
    });
  });

  it("preserves exact viewport, proportion-mode and relationship-transformation values", () => {
    const responsive = responsiveFixture();
    const before = clone(responsive);
    const parsed = canonicalizePageBlueprintV2ResponsiveRuleContract(
      structuralFixture(),
      responsive,
    );

    parsed.breakpointRules.forEach((canonicalRule) => {
      const sourceRule = before.breakpointRules.find(
        ({ breakpoint }) => breakpoint === canonicalRule.breakpoint,
      );
      expect(sourceRule).toBeDefined();
      expect(canonicalRule.viewport).toBe(sourceRule?.viewport);
      expect(
        Object.fromEntries(
          canonicalRule.regionProportionRules.map(({ regionId, proportionMode }) => [
            regionId,
            proportionMode,
          ]),
        ),
      ).toStrictEqual(
        Object.fromEntries(
          (sourceRule?.regionProportionRules ?? []).map(({ regionId, proportionMode }) => [
            regionId,
            proportionMode,
          ]),
        ),
      );
      expect(
        Object.fromEntries(
          canonicalRule.relationshipTransformations.map(({ relationshipKey, transformation }) => [
            relationshipKey,
            transformation,
          ]),
        ),
      ).toStrictEqual(
        Object.fromEntries(
          (sourceRule?.relationshipTransformations ?? []).map(
            ({ relationshipKey, transformation }) => [relationshipKey, transformation],
          ),
        ),
      );
    });
    expect(responsive).toStrictEqual(before);
  });

  it("canonicalizes equivalent permutations identically without mutating either input", () => {
    const structural = structuralFixture();
    const firstInput = responsiveFixture();
    const secondInput = {
      ...responsiveFixture(),
      breakpointRules: [...responsiveFixture().breakpointRules].reverse().map((rule) => ({
        ...rule,
        regionProportionRules: [...rule.regionProportionRules].reverse(),
        relationshipTransformations: [...rule.relationshipTransformations].reverse(),
      })),
    };
    const structuralBefore = clone(structural);
    const firstBefore = clone(firstInput);
    const secondBefore = clone(secondInput);

    const first = canonicalizePageBlueprintV2ResponsiveRuleContract(structural, firstInput);
    const second = canonicalizePageBlueprintV2ResponsiveRuleContract(structural, secondInput);

    expect(second).toStrictEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(structural).toStrictEqual(structuralBefore);
    expect(firstInput).toStrictEqual(firstBefore);
    expect(secondInput).toStrictEqual(secondBefore);
    expect(deepFrozen(first)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/fingerprint|normalizedTopology/iu);
  });

  it("keeps duplicate-region diagnosis deterministic across input permutations", () => {
    const first = responsiveFixture();
    first.breakpointRules[0]?.regionProportionRules.push({
      ...first.breakpointRules[0].regionProportionRules[0],
    });
    const second = clone(first);
    second.breakpointRules[0]?.regionProportionRules.reverse();
    expect(issueMessages(structuralFixture(), first)).toStrictEqual(
      issueMessages(structuralFixture(), second),
    );
  });

  it("keeps duplicate-relationship diagnosis deterministic across input permutations", () => {
    const first = responsiveFixture();
    first.breakpointRules[0]?.relationshipTransformations.push({
      ...first.breakpointRules[0].relationshipTransformations[0],
    });
    const second = clone(first);
    second.breakpointRules[0]?.relationshipTransformations.reverse();
    expect(issueMessages(structuralFixture(), first)).toStrictEqual(
      issueMessages(structuralFixture(), second),
    );
  });
});

describe("P10B-19A-05 forbidden authority and zero reachability", () => {
  it.each([
    "route",
    "slug",
    "pageId",
    "pageInstanceId",
    "familyId",
    "familyVersion",
    "lifecycleState",
    "component",
    "componentId",
    "componentFamily",
    "variant",
    "props",
    "assetId",
    "assetRole",
    "assetRevision",
    "responsiveSource",
    "crop",
    "focalPoint",
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
    "grid",
    "gridArea",
    "column",
    "row",
    "coordinates",
    "percentage",
    "minWidth",
    "maxWidth",
    "mediaQuery",
    "visibility",
    "hidden",
    "display",
    "omit",
    "omitWhen",
    "substitution",
    "fallback",
    "placeholder",
    "animation",
    "motion",
    "duration",
    "easing",
    "providerPayload",
    "visualRecipe",
    "fingerprint",
    "normalizedTopology",
    "migrationAlias",
    "metadata",
    "allOthers",
  ])("rejects foreign root authority %s", (field) => {
    expect(
      pageBlueprintV2ResponsiveRuleContractV1Schema.safeParse({
        ...responsiveFixture(),
        [field]: "forbidden",
      }).success,
    ).toBe(false);
  });

  it.each([
    ["visibility", { visibility: "visible" }],
    ["asset selection", { responsiveSource: "hero-mobile" }],
    ["CSS grid", { grid: "1fr 2fr" }],
    ["fallback", { fallback: "desktop" }],
    ["wildcard metadata", { allOthers: "preserve" }],
  ])("rejects foreign breakpoint-rule %s authority", (_label, foreignField) => {
    const rule = responsiveFixture().breakpointRules[0];
    expect(
      pageBlueprintV2ResponsiveBreakpointRuleSchema.safeParse({
        ...rule,
        ...foreignField,
      }).success,
    ).toBe(false);
  });

  it("imports only Zod and the unchanged direct A-03 sibling authority", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/application/storefront-templates/page-blueprint-v2-responsive-rule-contract.ts",
      ),
      "utf8",
    );
    const importSources = [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map(
      (match) => match[1],
    );
    expect([...new Set(importSources)].sort()).toStrictEqual([
      "./page-blueprint-v2-contract",
      "zod",
    ]);
  });

  it("exports schemas and a pure canonicalizer but no responsive contract record", () => {
    const records = Object.entries(storefrontTemplateAuthority).filter(
      ([, value]) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.hasOwn(value, "contractSchemaVersion") &&
        Object.hasOwn(value, "breakpointRules"),
    );
    expect(records).toStrictEqual([]);
    expect(
      Object.keys(storefrontTemplateAuthority).filter((name) =>
        /default.*responsive|responsive.*registry|responsive.*record/iu.test(name),
      ),
    ).toStrictEqual([]);
    expect(listExecutablePageBlueprintProfiles()).toHaveLength(53);
  });

  it("keeps the companion unreachable from current production consumers", () => {
    const repositoryRoot = resolve(process.cwd());
    const allowedAuthorityFiles = new Set([
      "src/application/storefront-templates/page-blueprint-v2-responsive-rule-contract.ts",
      "src/application/storefront-templates/index.ts",
    ]);
    const consumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) =>
        /page-blueprint-v2-responsive-rule-contract|PageBlueprintV2Responsive|pageBlueprintV2Responsive|PAGE_BLUEPRINT_V2_RESPONSIVE/u.test(
          source,
        ),
      )
      .map(({ path }) => relative(repositoryRoot, path))
      .filter((path) => !allowedAuthorityFiles.has(path));
    expect(consumers).toStrictEqual([]);

    [
      "src/application/storefront-templates/registry.ts",
      "src/application/storefront-templates/resolver.ts",
      "src/application/storefront-templates/profile-materializer.ts",
      "src/application/storefront-templates/materializer.ts",
      "src/application/storefront-templates/selection-planner.ts",
      "src/application/whole-storefront-generation-plan/planner.ts",
      "src/domain/storefront/storefront.ts",
    ].forEach((path) => {
      expect(readFileSync(resolve(repositoryRoot, path), "utf8")).not.toMatch(
        /page-blueprint-v2-responsive-rule-contract|PageBlueprintV2Responsive|pageBlueprintV2Responsive|PAGE_BLUEPRINT_V2_RESPONSIVE/u,
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
      "src/application/storefront-templates/contract.ts":
        "399bca1b66120f3f4ad50d53700c5207f450e7e701821492efa4386a01970b0a",
      "src/domain/component-platform/commercial-design-grammar.ts":
        "6d1e47109ac688a9232732f294747d2594a6afe15bd5dcd91d0e10c427b3edef",
      "src/domain/component-platform/component-platform.ts":
        "bf0ebf58d155b580e9bfbf3ce8bb7d5059042496357f283d278cfee7ffa3e652",
      "src/domain/asset-presentation/responsive-image.ts":
        "7154a51147f22f800f5f85779b2b013c6ccf77f9ba37f8c086b00347102e02ed",
      "src/application/responsive-image-authority/index.ts":
        "eafd46bf82102c7ac6fabf3d76d385e078d70cc3e0352d82e2a1f92b5ac68e67",
      "src/application/responsive-image-authority/responsive-image-authority.ts":
        "aabc867314f59b52d0a2580c69e4227bcab1e2cac51997a582bb04adbe2c80a5",
      "src/components/storefront/responsive-storefront-image.tsx":
        "0136b765035a440413226bfc4678e61d82c74718705a64464d674fbf9957bdcc",
      "src/components/storefront/responsive-execution.ts":
        "e5f70a9a77279cfdf465943059bb7a5c33f46c999979542756410fe2be1e9b12",
      "src/domain/storefront/commercial-shared-frame.ts":
        "dbde4547b9b496c2ff94b8415926196402f375670fa4c3f20508ef56e5464cc8",
      "src/application/commercial-shared-frame/index.ts":
        "d8f1e7c5162979a5bffb194c004179f2f50fa226070d887f1cdf315eac3bff13",
      "src/application/commercial-shared-frame/commercial-shared-frame.ts":
        "2602ba6ceffe9d7c171319feb4d478b7af69121bab95c65b7d66013a6846353b",
      "src/components/storefront/commercial-storefront-frame.tsx":
        "61bba3a18bbcd2c1d62a0f579dc9ea51ee4158a464855809fd23de5f2eb8b6a5",
    }),
  )("keeps protected authority byte-identical: %s", (path, expectedHash) => {
    expect(
      createHash("sha256")
        .update(readFileSync(resolve(process.cwd(), path)))
        .digest("hex"),
    ).toBe(expectedHash);
  });
});
