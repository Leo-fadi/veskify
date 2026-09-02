import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import * as storefrontTemplateAuthority from "@/application/storefront-templates";
import {
  INACTIVE_CANDIDATE_NORMALIZED_TOPOLOGY_INDEX_SCHEMA_VERSION,
  PAGE_BLUEPRINT_V2_NORMALIZED_TOPOLOGY_SCHEMA_VERSION,
  STRUCTURAL_STOREFRONT_FAMILY_NORMALIZED_TOPOLOGY_SCHEMA_VERSION,
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  createPageBlueprintV2CandidateAuthority,
  createStructuralStorefrontFamilyCandidate,
  deriveInactiveCandidateNormalizedTopologyIndex,
  derivePageBlueprintV2NormalizedTopology,
  deriveStructuralStorefrontFamilyNormalizedTopology,
  inactiveStructuralStorefrontFamilyCandidateRegistry,
  parsePageBlueprintV2NormalizedTopology,
  parseStructuralStorefrontFamilyNormalizedTopology,
  type PageBlueprintV2CandidateAuthorityV1,
  type PageBlueprintV2CandidateReference,
  type StructuralStorefrontFamilyCandidateV1,
} from "@/application/storefront-templates";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import {
  structuralStorefrontPageFamilyIds,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family/cross-page-relationships";
import type { StructuralStorefrontFamilyId } from "@/domain/structural-storefront-family/identity";

const baseCommit = "b834a4606d60ce448a5d1e04224275672ea1d13d";

const requiredRolesByPageFamily: Readonly<
  Record<StructuralStorefrontPageFamilyId, readonly string[]>
> = {
  home: ["orientation", "primary-discovery"],
  collection: ["orientation", "primary-discovery"],
  search: ["orientation", "primary-discovery"],
  "product-detail": ["product-focus", "conversion"],
  "content-support": ["orientation"],
  utility: ["orientation"],
};

type CandidateFixtureOptions = Readonly<{
  id?: string;
  version?: string;
  pageFamilyId?: StructuralStorefrontPageFamilyId;
  substitutionTargets?: readonly PageBlueprintV2CandidateReference[];
}>;

function relationshipKey(relationship: {
  sourceRegionId: string;
  relationshipKind: string;
  targetRegionId: string;
}): string {
  if (relationship.relationshipKind !== "pairs-with") {
    return `${relationship.sourceRegionId}->${relationship.relationshipKind}->${relationship.targetRegionId}`;
  }
  const [first, second] = [relationship.sourceRegionId, relationship.targetRegionId].sort();
  return `${first}->pairs-with->${second}`;
}

function candidateInput(options: CandidateFixtureOptions = {}) {
  const pageFamilyId = options.pageFamilyId ?? "home";
  const id = options.id ?? `${pageFamilyId}-candidate`;
  const version = options.version ?? "1.0.0";
  const requiredRoles = requiredRolesByPageFamily[pageFamilyId];
  const regions = [
    {
      id: "lead-region",
      role: requiredRoles[0],
      requirement: "required",
      cardinality: { minimum: 1, ideal: 1, maximum: 2 },
      visualWeight: "dominant",
    },
    {
      id: "discovery-region",
      role: requiredRoles[1] ?? "primary-discovery",
      requirement: requiredRoles[1] ? "required" : "optional",
      cardinality: requiredRoles[1]
        ? { minimum: 1, ideal: 2, maximum: 4 }
        : { minimum: 0, ideal: 2, maximum: 4 },
      visualWeight: "heavy",
    },
    {
      id: "story-region",
      role: "brand-story",
      requirement: "optional",
      cardinality: { minimum: 0, ideal: 1, maximum: 2 },
      visualWeight: "medium",
    },
    {
      id: "proof-region",
      role: "brand-proof",
      requirement: "optional",
      cardinality: { minimum: 0, ideal: 1, maximum: 3 },
      visualWeight: "light",
    },
  ];
  const relationships = [
    {
      sourceRegionId: "lead-region",
      relationshipKind: "precedes",
      targetRegionId: "discovery-region",
    },
    {
      sourceRegionId: "lead-region",
      relationshipKind: "pairs-with",
      targetRegionId: "discovery-region",
    },
    {
      sourceRegionId: "discovery-region",
      relationshipKind: "offsets",
      targetRegionId: "story-region",
    },
    {
      sourceRegionId: "lead-region",
      relationshipKind: "contains",
      targetRegionId: "story-region",
    },
    {
      sourceRegionId: "discovery-region",
      relationshipKind: "spans",
      targetRegionId: "proof-region",
    },
    {
      sourceRegionId: "story-region",
      relationshipKind: "anchors",
      targetRegionId: "proof-region",
    },
  ];
  const orderAlternatives = [
    {
      id: "default-order",
      regionIds: ["lead-region", "discovery-region", "story-region", "proof-region"],
    },
    {
      id: "story-first",
      regionIds: ["lead-region", "story-region", "discovery-region", "proof-region"],
    },
    {
      id: "story-first-copy",
      regionIds: ["lead-region", "story-region", "discovery-region", "proof-region"],
    },
    {
      id: "proof-first",
      regionIds: ["lead-region", "discovery-region", "proof-region", "story-region"],
    },
  ];
  const selectedOrderByBreakpoint = {
    mobile: "story-first",
    tablet: "story-first-copy",
    desktop: "default-order",
    wide: "proof-first",
  } as const;
  const proportionByRegion = {
    "lead-region": "full-width",
    "discovery-region": "compress",
    "story-region": "expand",
    "proof-region": "preserve",
  } as const;

  return {
    candidateSchemaVersion: "1.0.0",
    structural: {
      id,
      version,
      pageFamilyId,
      regions,
      relationships,
      orderAlternatives,
      defaultOrderAlternativeId: "default-order",
    },
    assetRoleCompatibility: {
      contractSchemaVersion: "1.0.0",
      blueprintId: id,
      blueprintVersion: version,
      regionAssetRequirements: [
        {
          regionId: "story-region",
          roleRequirements: [
            {
              role: "editorialImage",
              requirement: "required",
              cardinality: { minimum: 1, ideal: 1, maximum: 2 },
            },
          ],
        },
        {
          regionId: "proof-region",
          roleRequirements: [
            {
              role: "supportingContentImage",
              requirement: "required",
              cardinality: { minimum: 1, ideal: 1, maximum: 2 },
            },
          ],
        },
      ],
    },
    responsiveRules: {
      contractSchemaVersion: "1.0.0",
      blueprintId: id,
      blueprintVersion: version,
      breakpointRules: [
        { breakpoint: "mobile", viewport: 375 },
        { breakpoint: "tablet", viewport: 768 },
        { breakpoint: "desktop", viewport: 1024 },
        { breakpoint: "wide", viewport: 1440 },
      ].map(({ breakpoint, viewport }) => ({
        breakpoint,
        viewport,
        orderAlternativeId:
          selectedOrderByBreakpoint[breakpoint as keyof typeof selectedOrderByBreakpoint],
        regionProportionRules: orderAlternatives[0].regionIds.map((regionId) => ({
          regionId,
          proportionMode: proportionByRegion[regionId as keyof typeof proportionByRegion],
        })),
        relationshipTransformations: relationships.map((relationship) => ({
          relationshipKey: relationshipKey(relationship),
          transformation:
            breakpoint !== "mobile"
              ? "preserve"
              : relationship.relationshipKind === "pairs-with"
                ? "stack"
                : relationship.relationshipKind === "offsets"
                  ? "remove-offset"
                  : relationship.relationshipKind === "contains"
                    ? "flatten"
                    : relationship.relationshipKind === "spans"
                      ? "reduce-span"
                      : relationship.relationshipKind === "anchors"
                        ? "linearize"
                        : "preserve",
        })),
      })),
    },
    omissionSubstitutionFallback: {
      contractSchemaVersion: "1.0.0",
      blueprintId: id,
      blueprintVersion: version,
      blueprintSubstitutionCandidates: (options.substitutionTargets ?? []).map((target) => ({
        ...target,
      })),
      regionFallbackRules: ["story-region", "proof-region"].map((regionId) => ({
        regionId,
        trigger: "required-asset-role-cardinality-unsatisfied",
        terminalResolution: "omit-region",
      })),
    },
  };
}

type CandidateInput = ReturnType<typeof candidateInput>;

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}

function exactCandidate(input: CandidateInput = candidateInput()) {
  return createPageBlueprintV2CandidateAuthority(input);
}

function topology(input: CandidateInput = candidateInput()) {
  return derivePageBlueprintV2NormalizedTopology(exactCandidate(input));
}

function referenceFor(candidate: PageBlueprintV2CandidateAuthorityV1) {
  return {
    blueprintId: candidate.structural.id,
    blueprintVersion: candidate.structural.version,
  };
}

function renameBlueprint(
  input: CandidateInput,
  blueprintId: string,
  blueprintVersion: string,
): CandidateInput {
  const renamed = clone(input);
  renamed.structural.id = blueprintId;
  renamed.structural.version = blueprintVersion;
  renamed.assetRoleCompatibility.blueprintId = blueprintId;
  renamed.assetRoleCompatibility.blueprintVersion = blueprintVersion;
  renamed.responsiveRules.blueprintId = blueprintId;
  renamed.responsiveRules.blueprintVersion = blueprintVersion;
  renamed.omissionSubstitutionFallback.blueprintId = blueprintId;
  renamed.omissionSubstitutionFallback.blueprintVersion = blueprintVersion;
  return renamed;
}

function renameRegions(input: CandidateInput): CandidateInput {
  const renamed = clone(input);
  const regionIdMap = new Map(
    input.structural.orderAlternatives[0].regionIds.map((regionId, index) => [
      regionId,
      `renamed-${index}`,
    ]),
  );
  const oldRelationships = input.structural.relationships;
  renamed.structural.regions.forEach((region) => {
    region.id = regionIdMap.get(region.id) ?? region.id;
  });
  renamed.structural.relationships.forEach((relationship) => {
    relationship.sourceRegionId =
      regionIdMap.get(relationship.sourceRegionId) ?? relationship.sourceRegionId;
    relationship.targetRegionId =
      regionIdMap.get(relationship.targetRegionId) ?? relationship.targetRegionId;
  });
  renamed.structural.orderAlternatives.forEach((alternative) => {
    alternative.regionIds = alternative.regionIds.map(
      (regionId) => regionIdMap.get(regionId) ?? regionId,
    );
  });
  renamed.assetRoleCompatibility.regionAssetRequirements.forEach((requirement) => {
    requirement.regionId = regionIdMap.get(requirement.regionId) ?? requirement.regionId;
  });
  const renamedRelationshipKeyByOldKey = new Map(
    oldRelationships.map((relationship, index) => [
      relationshipKey(relationship),
      relationshipKey(renamed.structural.relationships[index]),
    ]),
  );
  renamed.responsiveRules.breakpointRules.forEach((rule) => {
    rule.regionProportionRules.forEach((regionRule) => {
      regionRule.regionId = regionIdMap.get(regionRule.regionId) ?? regionRule.regionId;
    });
    rule.relationshipTransformations.forEach((transformation) => {
      transformation.relationshipKey =
        renamedRelationshipKeyByOldKey.get(transformation.relationshipKey) ??
        transformation.relationshipKey;
    });
  });
  renamed.omissionSubstitutionFallback.regionFallbackRules.forEach((rule) => {
    rule.regionId = regionIdMap.get(rule.regionId) ?? rule.regionId;
  });
  return renamed;
}

function renameOrderAlternatives(input: CandidateInput): CandidateInput {
  const renamed = clone(input);
  const orderIdMap = new Map(
    input.structural.orderAlternatives.map((alternative, index) => [
      alternative.id,
      `renamed-order-${index}`,
    ]),
  );
  renamed.structural.orderAlternatives.forEach((alternative) => {
    (alternative as { id: string }).id = orderIdMap.get(alternative.id) ?? alternative.id;
  });
  renamed.structural.defaultOrderAlternativeId =
    orderIdMap.get(renamed.structural.defaultOrderAlternativeId) ??
    renamed.structural.defaultOrderAlternativeId;
  renamed.responsiveRules.breakpointRules.forEach((rule) => {
    (rule as { orderAlternativeId: string }).orderAlternativeId =
      orderIdMap.get(rule.orderAlternativeId) ?? rule.orderAlternativeId;
  });
  return renamed;
}

function reverseCanonicalizableCollections(input: CandidateInput): CandidateInput {
  const reversed = clone(input);
  reversed.structural.regions.reverse();
  reversed.structural.relationships.reverse();
  reversed.structural.orderAlternatives.reverse();
  reversed.assetRoleCompatibility.regionAssetRequirements.reverse();
  reversed.responsiveRules.breakpointRules.reverse();
  reversed.responsiveRules.breakpointRules.forEach((rule) => {
    rule.regionProportionRules.reverse();
    rule.relationshipTransformations.reverse();
  });
  reversed.omissionSubstitutionFallback.regionFallbackRules.reverse();
  return reversed;
}

function replaceRelationship(
  input: CandidateInput,
  relationshipIndex: number,
  replacement: Partial<CandidateInput["structural"]["relationships"][number]>,
  mobileTransformation?: string,
): CandidateInput {
  const changed = clone(input);
  const relationship = changed.structural.relationships[relationshipIndex];
  const oldKey = relationshipKey(relationship);
  Object.assign(relationship, replacement);
  const newKey = relationshipKey(relationship);
  changed.responsiveRules.breakpointRules.forEach((rule) => {
    const transformation = rule.relationshipTransformations.find(
      (entry) => entry.relationshipKey === oldKey,
    );
    if (!transformation) return;
    transformation.relationshipKey = newKey;
    if (mobileTransformation && rule.breakpoint === "mobile") {
      transformation.transformation = mobileTransformation;
    }
  });
  return changed;
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((entry) => deepFrozen(entry, seen));
}

function staleFingerprint(value: string): string {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

type FamilyFixtureOptions = Readonly<{
  familyId?: StructuralStorefrontFamilyId;
  familyVersion?: string;
  referencesByPageFamily?: Partial<
    Readonly<Record<StructuralStorefrontPageFamilyId, readonly PageBlueprintV2CandidateReference[]>>
  >;
  relationships?: readonly unknown[];
}>;

function familyCandidateInput(options: FamilyFixtureOptions = {}) {
  return {
    candidateSchemaVersion: "1.0.0",
    familyId: options.familyId ?? "editorial-offset",
    familyVersion: options.familyVersion ?? "1.0.0",
    lifecycleState: "candidate",
    pageFamilyProfiles: structuralStorefrontPageFamilyIds.map((pageFamilyId) => ({
      pageFamilyId,
      blueprintCandidates: (
        options.referencesByPageFamily?.[pageFamilyId] ?? [
          { blueprintId: `${pageFamilyId}-candidate`, blueprintVersion: "1.0.0" },
        ]
      ).map((reference) => ({ ...reference })),
    })),
    crossPageRelationships: options.relationships ?? [
      {
        sourcePageFamilyId: "home",
        relationshipKind: "frame-continuity",
        targetPageFamilyId: "collection",
      },
    ],
  };
}

function pageFamilyCandidates(): readonly PageBlueprintV2CandidateAuthorityV1[] {
  return structuralStorefrontPageFamilyIds.map((pageFamilyId) =>
    exactCandidate(candidateInput({ pageFamilyId })),
  );
}

function familyForCandidates(
  candidates: readonly PageBlueprintV2CandidateAuthorityV1[],
  options: Omit<FamilyFixtureOptions, "referencesByPageFamily"> = {},
): StructuralStorefrontFamilyCandidateV1 {
  const referencesByPageFamily = Object.fromEntries(
    structuralStorefrontPageFamilyIds.map((pageFamilyId) => [
      pageFamilyId,
      candidates
        .filter((candidate) => candidate.structural.pageFamilyId === pageFamilyId)
        .map(referenceFor),
    ]),
  );
  return createStructuralStorefrontFamilyCandidate(
    familyCandidateInput({ ...options, referencesByPageFamily }),
  );
}

function registry(
  pageBlueprintCandidates: readonly PageBlueprintV2CandidateAuthorityV1[],
  familyCandidates: readonly StructuralStorefrontFamilyCandidateV1[] = [],
) {
  return canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry({
    contractSchemaVersion: "1.0.0",
    pageBlueprintCandidates,
    familyCandidates,
  });
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.[cm]?tsx?$/u.test(entry.name) ? [path] : [];
  });
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function collectObjectKeys(value: unknown, keys = new Set<string>()): ReadonlySet<string> {
  if (value === null || typeof value !== "object") return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectObjectKeys(child, keys);
  }
  return keys;
}

describe("P10B-19A-08A PageBlueprint normalized region identity", () => {
  it("uses the exact independent topology schema versions", () => {
    expect(PAGE_BLUEPRINT_V2_NORMALIZED_TOPOLOGY_SCHEMA_VERSION).toBe("1.0.0");
    expect(STRUCTURAL_STOREFRONT_FAMILY_NORMALIZED_TOPOLOGY_SCHEMA_VERSION).toBe("1.0.0");
    expect(INACTIVE_CANDIDATE_NORMALIZED_TOPOLOGY_INDEX_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("assigns contiguous r0 through rN tokens from canonical default reading order", () => {
    const normalized = topology(reverseCanonicalizableCollections(candidateInput()));
    expect(normalized.regions.map(({ topologyRegionId }) => topologyRegionId)).toStrictEqual([
      "r0",
      "r1",
      "r2",
      "r3",
    ]);
    expect(normalized.regions.map(({ role }) => role)).toStrictEqual([
      "orientation",
      "primary-discovery",
      "brand-story",
      "brand-proof",
    ]);
  });

  it("is invariant to a consistent source-region ID rename", () => {
    const original = exactCandidate();
    const renamed = exactCandidate(renameRegions(candidateInput()));
    expect(renamed.candidateFingerprint).not.toBe(original.candidateFingerprint);
    expect(derivePageBlueprintV2NormalizedTopology(renamed)).toStrictEqual(
      derivePageBlueprintV2NormalizedTopology(original),
    );
  });

  it("is invariant to source collection order", () => {
    const normal = topology();
    const reversed = topology(reverseCanonicalizableCollections(candidateInput()));
    expect(reversed).toStrictEqual(normal);
  });

  it("keeps duplicate semantic roles distinguishable by ordinal token", () => {
    const input = candidateInput();
    input.structural.regions[2].role = "brand-proof";
    const normalized = topology(input);
    expect(normalized.regions.slice(2)).toMatchObject([
      { topologyRegionId: "r2", role: "brand-proof" },
      { topologyRegionId: "r3", role: "brand-proof" },
    ]);
  });

  it.each([
    [
      "role",
      (input: CandidateInput) => {
        input.structural.regions[2].role = "education";
      },
    ],
    [
      "requirement",
      (input: CandidateInput) => {
        input.structural.regions[2].requirement = "required";
        input.structural.regions[2].cardinality.minimum = 1;
        input.omissionSubstitutionFallback.regionFallbackRules[0].terminalResolution =
          "fail-closed";
      },
    ],
    [
      "cardinality",
      (input: CandidateInput) => {
        input.structural.regions[2].cardinality.ideal = 2;
      },
    ],
    [
      "visual weight",
      (input: CandidateInput) => {
        input.structural.regions[2].visualWeight = "heavy";
      },
    ],
  ] as const)("changes topology when structural region %s changes", (_label, mutate) => {
    const changed = candidateInput();
    mutate(changed);
    expect(topology(changed).topologyFingerprint).not.toBe(topology().topologyFingerprint);
  });
});

describe("P10B-19A-08A normalized relationships", () => {
  it("projects every relationship and never infers another one", () => {
    const normalized = topology();
    expect(normalized.relationships).toHaveLength(candidateInput().structural.relationships.length);
    expect(normalized.relationships.map(({ relationshipKind }) => relationshipKind)).toEqual(
      expect.arrayContaining(["precedes", "pairs-with", "offsets", "contains", "spans", "anchors"]),
    );
  });

  it("removes source IDs from normalized relationships", () => {
    expect(topology(renameRegions(candidateInput())).relationships).toStrictEqual(
      topology().relationships,
    );
  });

  it("changes topology when a relationship kind changes", () => {
    const changed = replaceRelationship(
      candidateInput(),
      2,
      { relationshipKind: "anchors" },
      "linearize",
    );
    expect(topology(changed).topologyFingerprint).not.toBe(topology().topologyFingerprint);
  });

  it("preserves directional reversal", () => {
    const changed = replaceRelationship(candidateInput(), 2, {
      sourceRegionId: "story-region",
      targetRegionId: "discovery-region",
    });
    expect(topology(changed).topologyFingerprint).not.toBe(topology().topologyFingerprint);
  });

  it("canonicalizes reversed pairs-with endpoints to one identity", () => {
    const changed = replaceRelationship(candidateInput(), 1, {
      sourceRegionId: "discovery-region",
      targetRegionId: "lead-region",
    });
    expect(topology(changed)).toStrictEqual(topology());
  });

  it("orders multi-digit region tokens numerically, including pairs-with parser validation", () => {
    const expanded = candidateInput();
    for (let index = 4; index <= 10; index += 1) {
      const regionId = `extra-region-${index}`;
      expanded.structural.regions.push({
        id: regionId,
        role: "continuation",
        requirement: "optional",
        cardinality: { minimum: 0, ideal: 1, maximum: 2 },
        visualWeight: "light",
      });
      expanded.structural.orderAlternatives.forEach((alternative) =>
        alternative.regionIds.push(regionId),
      );
      expanded.responsiveRules.breakpointRules.forEach((rule) =>
        rule.regionProportionRules.push({ regionId, proportionMode: "preserve" }),
      );
    }
    const changed = replaceRelationship(expanded, 1, {
      sourceRegionId: "story-region",
      targetRegionId: "extra-region-10",
    });
    const normalized = topology(changed);
    expect(
      normalized.relationships.find(({ relationshipKind }) => relationshipKind === "pairs-with"),
    ).toMatchObject({ sourceTopologyRegionId: "r2", targetTopologyRegionId: "r10" });
    expect(parsePageBlueprintV2NormalizedTopology(normalized)).toStrictEqual(normalized);

    const alternateResponsiveBreakpoints = normalized.responsiveBreakpoints.map((breakpoint) => ({
      ...breakpoint,
      relationshipTransformations: breakpoint.relationshipTransformations.map((rule) => ({
        ...rule,
        normalizedRelationshipKey:
          rule.normalizedRelationshipKey === "r2->pairs-with->r10"
            ? "r10->pairs-with->r2"
            : rule.normalizedRelationshipKey,
      })),
    }));
    const { topologyFingerprint: originalFingerprint, ...material } = {
      ...normalized,
      responsiveBreakpoints: alternateResponsiveBreakpoints,
    };
    const topologyFingerprint = `page-blueprint-v2-normalized-topology-${canonicalValueFingerprint(material)}`;
    expect(topologyFingerprint).not.toBe(originalFingerprint);
    expect(() =>
      parsePageBlueprintV2NormalizedTopology({
        ...material,
        topologyFingerprint,
      }),
    ).toThrow(/unknown normalized relationship key/iu);
  });

  it("is invariant to relationship input order", () => {
    const changed = candidateInput();
    changed.structural.relationships.reverse();
    changed.responsiveRules.breakpointRules.forEach((rule) =>
      rule.relationshipTransformations.reverse(),
    );
    expect(topology(changed)).toStrictEqual(topology());
  });
});

describe("P10B-19A-08A normalized reading orders", () => {
  it("represents the default order explicitly and collapses duplicate alternatives", () => {
    const normalized = topology();
    expect(normalized.orderAlternatives.defaultOrder).toStrictEqual(["r0", "r1", "r2", "r3"]);
    expect(normalized.orderAlternatives.alternativeOrders).toStrictEqual([
      ["r0", "r1", "r3", "r2"],
      ["r0", "r2", "r1", "r3"],
    ]);
  });

  it("is invariant to every exact alternative-ID rename", () => {
    const original = exactCandidate();
    const renamed = exactCandidate(renameOrderAlternatives(candidateInput()));
    expect(renamed.candidateFingerprint).not.toBe(original.candidateFingerprint);
    expect(derivePageBlueprintV2NormalizedTopology(renamed)).toStrictEqual(
      derivePageBlueprintV2NormalizedTopology(original),
    );
  });

  it("is invariant to alternative input order", () => {
    const changed = candidateInput();
    changed.structural.orderAlternatives.reverse();
    expect(topology(changed)).toStrictEqual(topology());
  });

  it("changes topology when a non-default region sequence changes", () => {
    const changed = candidateInput();
    changed.structural.orderAlternatives[1].regionIds = [
      "lead-region",
      "story-region",
      "proof-region",
      "discovery-region",
    ];
    expect(topology(changed).topologyFingerprint).not.toBe(topology().topologyFingerprint);
  });

  it("changes topology when the explicit default order changes", () => {
    const changed = candidateInput();
    changed.structural.defaultOrderAlternativeId = "story-first";
    expect(topology(changed).topologyFingerprint).not.toBe(topology().topologyFingerprint);
  });

  it("retains A-03 fail-closed rejection for incomplete order authority", () => {
    const invalid = candidateInput();
    invalid.structural.orderAlternatives[1].regionIds.pop();
    expect(() => exactCandidate(invalid)).toThrow(/Missing regions|every region/iu);
  });
});

describe("P10B-19A-08A normalized responsive topology", () => {
  it("retains the exact four breakpoint/viewport pairs in canonical order", () => {
    expect(
      topology().responsiveBreakpoints.map(({ breakpoint, viewport }) => ({
        breakpoint,
        viewport,
      })),
    ).toStrictEqual([
      { breakpoint: "mobile", viewport: 375 },
      { breakpoint: "tablet", viewport: 768 },
      { breakpoint: "desktop", viewport: 1024 },
      { breakpoint: "wide", viewport: 1440 },
    ]);
  });

  it("is invariant to breakpoint and nested input order", () => {
    expect(topology(reverseCanonicalizableCollections(candidateInput()))).toStrictEqual(topology());
  });

  it("uses normalized selected reading order rather than alternative ID", () => {
    expect(topology(renameOrderAlternatives(candidateInput())).responsiveBreakpoints).toStrictEqual(
      topology().responsiveBreakpoints,
    );
  });

  it("changes topology when a responsive selected order changes", () => {
    const changed = candidateInput();
    changed.responsiveRules.breakpointRules[0].orderAlternativeId = "proof-first";
    expect(topology(changed).topologyFingerprint).not.toBe(topology().topologyFingerprint);
  });

  it("changes topology when a proportion mode changes", () => {
    const changed = candidateInput();
    changed.responsiveRules.breakpointRules[0].regionProportionRules[0].proportionMode = "preserve";
    expect(topology(changed).topologyFingerprint).not.toBe(topology().topologyFingerprint);
  });

  it("changes topology when a relationship transformation changes", () => {
    const changed = candidateInput();
    const pairsWith = changed.responsiveRules.breakpointRules[0].relationshipTransformations.find(
      ({ relationshipKey: key }) => key.includes("pairs-with"),
    );
    if (!pairsWith) throw new Error("Fixture is missing pairs-with responsive authority.");
    pairsWith.transformation = "preserve";
    expect(topology(changed).topologyFingerprint).not.toBe(topology().topologyFingerprint);
  });

  it("contains no responsive asset or visibility authority", () => {
    const keys = collectObjectKeys(topology());
    expect([...keys]).not.toEqual(
      expect.arrayContaining(["assetId", "assetRole", "responsiveSource", "visibility"]),
    );
  });
});

describe("P10B-19A-08A exact-content versus topology separation", () => {
  it("is deterministic for an identical exact candidate", () => {
    const candidate = exactCandidate();
    expect(derivePageBlueprintV2NormalizedTopology(candidate)).toStrictEqual(
      derivePageBlueprintV2NormalizedTopology(candidate),
    );
  });

  it("ignores blueprint ID and version while exact content changes", () => {
    const original = exactCandidate();
    const renamed = exactCandidate(renameBlueprint(candidateInput(), "renamed-blueprint", "1.9.4"));
    expect(renamed.candidateFingerprint).not.toBe(original.candidateFingerprint);
    expect(derivePageBlueprintV2NormalizedTopology(renamed)).toStrictEqual(
      derivePageBlueprintV2NormalizedTopology(original),
    );
  });

  it("ignores an A-04 asset-role change while exact content changes", () => {
    const changed = candidateInput();
    changed.assetRoleCompatibility.regionAssetRequirements[0].roleRequirements[0].cardinality.ideal = 2;
    const original = exactCandidate();
    const exactChanged = exactCandidate(changed);
    expect(exactChanged.candidateFingerprint).not.toBe(original.candidateFingerprint);
    expect(derivePageBlueprintV2NormalizedTopology(exactChanged)).toStrictEqual(
      derivePageBlueprintV2NormalizedTopology(original),
    );
  });

  it("ignores an A-06 terminal change while exact content changes", () => {
    const changed = candidateInput();
    changed.omissionSubstitutionFallback.regionFallbackRules[0].terminalResolution = "fail-closed";
    const original = exactCandidate();
    const exactChanged = exactCandidate(changed);
    expect(exactChanged.candidateFingerprint).not.toBe(original.candidateFingerprint);
    expect(derivePageBlueprintV2NormalizedTopology(exactChanged)).toStrictEqual(
      derivePageBlueprintV2NormalizedTopology(original),
    );
  });

  it("ignores A-06 target priority while exact content changes", () => {
    const targets = [
      { blueprintId: "z-target", blueprintVersion: "1.0.0" },
      { blueprintId: "a-target", blueprintVersion: "1.0.0" },
    ];
    const first = exactCandidate(candidateInput({ substitutionTargets: targets }));
    const second = exactCandidate(candidateInput({ substitutionTargets: [...targets].reverse() }));
    expect(second.candidateFingerprint).not.toBe(first.candidateFingerprint);
    expect(derivePageBlueprintV2NormalizedTopology(second)).toStrictEqual(
      derivePageBlueprintV2NormalizedTopology(first),
    );
  });

  it("changes both fingerprints for an A-03 structural change", () => {
    const changed = candidateInput();
    changed.structural.regions[2].visualWeight = "heavy";
    const original = exactCandidate();
    const exactChanged = exactCandidate(changed);
    expect(exactChanged.candidateFingerprint).not.toBe(original.candidateFingerprint);
    expect(derivePageBlueprintV2NormalizedTopology(exactChanged).topologyFingerprint).not.toBe(
      derivePageBlueprintV2NormalizedTopology(original).topologyFingerprint,
    );
  });

  it("changes both fingerprints for an A-05 responsive change", () => {
    const changed = candidateInput();
    changed.responsiveRules.breakpointRules[0].regionProportionRules[0].proportionMode = "preserve";
    const original = exactCandidate();
    const exactChanged = exactCandidate(changed);
    expect(exactChanged.candidateFingerprint).not.toBe(original.candidateFingerprint);
    expect(derivePageBlueprintV2NormalizedTopology(exactChanged).topologyFingerprint).not.toBe(
      derivePageBlueprintV2NormalizedTopology(original).topologyFingerprint,
    );
  });
});

describe("P10B-19A-08A PageBlueprint topology parser and fingerprint", () => {
  it("uses the exact fingerprint prefix and canonical helper format", () => {
    expect(topology().topologyFingerprint).toMatch(
      /^page-blueprint-v2-normalized-topology-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
  });

  it("parses a valid canonical topology without changing it", () => {
    const normalized = topology();
    expect(parsePageBlueprintV2NormalizedTopology(normalized)).toStrictEqual(normalized);
  });

  it("rejects a stale supplied fingerprint", () => {
    const normalized = topology();
    expect(() =>
      parsePageBlueprintV2NormalizedTopology({
        ...normalized,
        topologyFingerprint: staleFingerprint(normalized.topologyFingerprint),
      }),
    ).toThrow(/fingerprint/iu);
  });

  it("rejects unknown fields and unsupported versions", () => {
    const normalized = topology();
    expect(() =>
      parsePageBlueprintV2NormalizedTopology({ ...normalized, merchantId: "forbidden" }),
    ).toThrow();
    expect(() =>
      parsePageBlueprintV2NormalizedTopology({ ...normalized, topologySchemaVersion: "2.0.0" }),
    ).toThrow();
  });

  it("excludes every exact candidate identity field", () => {
    const normalized = topology();
    const keys = collectObjectKeys(normalized);
    expect([...keys]).not.toEqual(
      expect.arrayContaining([
        "blueprintId",
        "blueprintVersion",
        "candidateFingerprint",
        "regionId",
        "orderAlternativeId",
        "defaultOrderAlternativeId",
      ]),
    );
  });

  it("returns deeply readonly output", () => {
    expect(deepFrozen(topology())).toBe(true);
    expect(deepFrozen(parsePageBlueprintV2NormalizedTopology(topology()))).toBe(true);
  });
});

describe("P10B-19A-08A Structural Storefront Family topology", () => {
  it("emits exactly six page-family topology sets in canonical order", () => {
    const candidates = pageFamilyCandidates();
    const family = familyForCandidates(candidates);
    const normalized = deriveStructuralStorefrontFamilyNormalizedTopology(
      registry(candidates),
      family,
    );
    expect(normalized.pageFamilyTopologies.map(({ pageFamilyId }) => pageFamilyId)).toStrictEqual(
      structuralStorefrontPageFamilyIds,
    );
    normalized.pageFamilyTopologies.forEach(({ pageBlueprintTopologyFingerprints }) => {
      expect(pageBlueprintTopologyFingerprints).toHaveLength(1);
    });
  });

  it("resolves exact PageBlueprint references through the supplied A-07 registry", () => {
    const candidates = pageFamilyCandidates();
    const family = familyForCandidates(candidates);
    const normalized = deriveStructuralStorefrontFamilyNormalizedTopology(
      registry(candidates),
      family,
    );
    const expectedByPageFamily = new Map(
      candidates.map((candidate) => [
        candidate.structural.pageFamilyId,
        derivePageBlueprintV2NormalizedTopology(candidate).topologyFingerprint,
      ]),
    );
    normalized.pageFamilyTopologies.forEach((entry) => {
      expect(entry.pageBlueprintTopologyFingerprints).toStrictEqual([
        expectedByPageFamily.get(entry.pageFamilyId),
      ]);
    });
  });

  it("normalizes different exact references that resolve to one topology", () => {
    const candidates = pageFamilyCandidates();
    const alternateHome = exactCandidate(
      renameBlueprint(candidateInput(), "home-alternate", "1.4.0"),
    );
    const allCandidates = [...candidates, alternateHome];
    const withBothReferences = familyForCandidates(allCandidates);
    const normalized = deriveStructuralStorefrontFamilyNormalizedTopology(
      registry(allCandidates),
      withBothReferences,
    );
    expect(
      normalized.pageFamilyTopologies.find(({ pageFamilyId }) => pageFamilyId === "home")
        ?.pageBlueprintTopologyFingerprints,
    ).toHaveLength(1);
  });

  it("is invariant to family ID and version", () => {
    const candidates = pageFamilyCandidates();
    const canonicalRegistry = registry(candidates);
    const first = familyForCandidates(candidates, {
      familyId: "editorial-offset",
      familyVersion: "1.0.0",
    });
    const second = familyForCandidates(candidates, {
      familyId: "campaign-modular",
      familyVersion: "1.7.3",
    });
    expect(second.candidateFingerprint).not.toBe(first.candidateFingerprint);
    expect(
      deriveStructuralStorefrontFamilyNormalizedTopology(canonicalRegistry, second),
    ).toStrictEqual(deriveStructuralStorefrontFamilyNormalizedTopology(canonicalRegistry, first));
  });

  it("changes topology when canonical cross-page relationships change", () => {
    const candidates = pageFamilyCandidates();
    const canonicalRegistry = registry(candidates);
    const first = familyForCandidates(candidates);
    const second = familyForCandidates(candidates, {
      relationships: [
        {
          sourcePageFamilyId: "home",
          relationshipKind: "navigation-continuity",
          targetPageFamilyId: "collection",
        },
      ],
    });
    expect(
      deriveStructuralStorefrontFamilyNormalizedTopology(canonicalRegistry, second)
        .topologyFingerprint,
    ).not.toBe(
      deriveStructuralStorefrontFamilyNormalizedTopology(canonicalRegistry, first)
        .topologyFingerprint,
    );
  });

  it("changes topology when one referenced PageBlueprint topology changes", () => {
    const candidates = pageFamilyCandidates();
    const changedInput = renameBlueprint(candidateInput(), "home-structural-change", "1.0.0");
    changedInput.structural.regions[2].visualWeight = "heavy";
    const changedHome = exactCandidate(changedInput);
    const changedCandidates = candidates.map((candidate) =>
      candidate.structural.pageFamilyId === "home" ? changedHome : candidate,
    );
    const canonicalRegistry = registry([...candidates, changedHome]);
    const first = familyForCandidates(candidates);
    const second = familyForCandidates(changedCandidates);
    expect(
      deriveStructuralStorefrontFamilyNormalizedTopology(canonicalRegistry, second)
        .topologyFingerprint,
    ).not.toBe(
      deriveStructuralStorefrontFamilyNormalizedTopology(canonicalRegistry, first)
        .topologyFingerprint,
    );
  });

  it("is invariant to profile and exact-reference input order", () => {
    const candidates = pageFamilyCandidates();
    const alternateHome = exactCandidate(
      renameBlueprint(candidateInput(), "home-alternate", "1.4.0"),
    );
    const allCandidates = [...candidates, alternateHome];
    const input = familyCandidateInput({
      referencesByPageFamily: Object.fromEntries(
        structuralStorefrontPageFamilyIds.map((pageFamilyId) => [
          pageFamilyId,
          allCandidates
            .filter((candidate) => candidate.structural.pageFamilyId === pageFamilyId)
            .map(referenceFor),
        ]),
      ),
    });
    const reversed = clone(input);
    reversed.pageFamilyProfiles.reverse();
    reversed.pageFamilyProfiles.forEach((profile) => profile.blueprintCandidates.reverse());
    const first = createStructuralStorefrontFamilyCandidate(input);
    const second = createStructuralStorefrontFamilyCandidate(reversed);
    expect(
      deriveStructuralStorefrontFamilyNormalizedTopology(registry(allCandidates), second),
    ).toStrictEqual(
      deriveStructuralStorefrontFamilyNormalizedTopology(registry(allCandidates), first),
    );
  });

  it("rejects unresolved and wrong-page-family exact references", () => {
    const candidates = pageFamilyCandidates();
    const canonicalRegistry = registry(candidates);
    const unresolved = createStructuralStorefrontFamilyCandidate(
      familyCandidateInput({
        referencesByPageFamily: {
          home: [{ blueprintId: "missing-home", blueprintVersion: "1.0.0" }],
        },
      }),
    );
    expect(() =>
      deriveStructuralStorefrontFamilyNormalizedTopology(canonicalRegistry, unresolved),
    ).toThrow(/Unknown/iu);

    const wrongFamily = createStructuralStorefrontFamilyCandidate(
      familyCandidateInput({
        referencesByPageFamily: {
          home: [{ blueprintId: "collection-candidate", blueprintVersion: "1.0.0" }],
        },
      }),
    );
    expect(() =>
      deriveStructuralStorefrontFamilyNormalizedTopology(canonicalRegistry, wrongFamily),
    ).toThrow(/does not belong/iu);
  });

  it("uses the exact family topology fingerprint format", () => {
    const candidates = pageFamilyCandidates();
    expect(
      deriveStructuralStorefrontFamilyNormalizedTopology(
        registry(candidates),
        familyForCandidates(candidates),
      ).topologyFingerprint,
    ).toMatch(/^structural-storefront-family-normalized-topology-v1_[1-9][0-9]*_[a-f0-9]{64}$/u);
  });

  it("parses canonical family topology and rejects stale or unknown authority", () => {
    const candidates = pageFamilyCandidates();
    const normalized = deriveStructuralStorefrontFamilyNormalizedTopology(
      registry(candidates),
      familyForCandidates(candidates),
    );
    expect(parseStructuralStorefrontFamilyNormalizedTopology(normalized)).toStrictEqual(normalized);
    expect(() =>
      parseStructuralStorefrontFamilyNormalizedTopology({
        ...normalized,
        topologyFingerprint: staleFingerprint(normalized.topologyFingerprint),
      }),
    ).toThrow(/fingerprint/iu);
    expect(() =>
      parseStructuralStorefrontFamilyNormalizedTopology({
        ...normalized,
        familyId: "editorial-offset",
      }),
    ).toThrow();
  });

  it("rejects noncanonical page-family entry ordering without repair", () => {
    const candidates = pageFamilyCandidates();
    const normalized = deriveStructuralStorefrontFamilyNormalizedTopology(
      registry(candidates),
      familyForCandidates(candidates),
    );
    expect(() =>
      parseStructuralStorefrontFamilyNormalizedTopology({
        ...normalized,
        pageFamilyTopologies: [...normalized.pageFamilyTopologies].reverse(),
      }),
    ).toThrow(/canonical ordering/iu);
  });

  it("rejects noncanonical member-fingerprint ordering without repair", () => {
    const changedInput = renameBlueprint(candidateInput(), "home-distinct", "1.0.0");
    changedInput.structural.regions[2].visualWeight = "heavy";
    const candidates = [...pageFamilyCandidates(), exactCandidate(changedInput)];
    const normalized = deriveStructuralStorefrontFamilyNormalizedTopology(
      registry(candidates),
      familyForCandidates(candidates),
    );
    expect(() =>
      parseStructuralStorefrontFamilyNormalizedTopology({
        ...normalized,
        pageFamilyTopologies: normalized.pageFamilyTopologies.map((entry) =>
          entry.pageFamilyId === "home"
            ? {
                ...entry,
                pageBlueprintTopologyFingerprints: [
                  ...entry.pageBlueprintTopologyFingerprints,
                ].reverse(),
              }
            : entry,
        ),
      }),
    ).toThrow(/canonical ordering/iu);
  });

  it("rejects noncanonical cross-page relationship ordering without repair", () => {
    const candidates = pageFamilyCandidates();
    const normalized = deriveStructuralStorefrontFamilyNormalizedTopology(
      registry(candidates),
      familyForCandidates(candidates, {
        relationships: [
          {
            sourcePageFamilyId: "collection",
            relationshipKind: "navigation-continuity",
            targetPageFamilyId: "product-detail",
          },
          {
            sourcePageFamilyId: "home",
            relationshipKind: "frame-continuity",
            targetPageFamilyId: "collection",
          },
        ],
      }),
    );
    expect(() =>
      parseStructuralStorefrontFamilyNormalizedTopology({
        ...normalized,
        crossPageRelationships: [...normalized.crossPageRelationships].reverse(),
      }),
    ).toThrow(/canonical ordering/iu);
  });

  it("returns deeply readonly family output", () => {
    const candidates = pageFamilyCandidates();
    const normalized = deriveStructuralStorefrontFamilyNormalizedTopology(
      registry(candidates),
      familyForCandidates(candidates),
    );
    expect(deepFrozen(normalized)).toBe(true);
    expect(deepFrozen(parseStructuralStorefrontFamilyNormalizedTopology(normalized))).toBe(true);
  });
});

describe("P10B-19A-08A inactive normalized-topology index", () => {
  it("returns the exact empty diagnostic shape for the empty production registry", () => {
    expect(
      deriveInactiveCandidateNormalizedTopologyIndex(
        inactiveStructuralStorefrontFamilyCandidateRegistry,
      ),
    ).toStrictEqual({
      contractSchemaVersion: "1.0.0",
      pageBlueprintEntries: [],
      familyEntries: [],
      duplicatePageBlueprintTopologyClusters: [],
      duplicateFamilyTopologyClusters: [],
    });
  });

  it("reports exact PageBlueprint identities sharing one topology", () => {
    const first = exactCandidate();
    const second = exactCandidate(renameBlueprint(candidateInput(), "home-second", "1.2.0"));
    const index = deriveInactiveCandidateNormalizedTopologyIndex(registry([second, first]));
    expect(index.pageBlueprintEntries).toHaveLength(2);
    expect(index.duplicatePageBlueprintTopologyClusters).toStrictEqual([
      {
        topologyFingerprint: index.pageBlueprintEntries[0].normalizedTopology.topologyFingerprint,
        candidateIdentityKeys: ["home-candidate@1.0.0", "home-second@1.2.0"],
      },
    ]);
  });

  it("reports exact family identities sharing one topology", () => {
    const candidates = pageFamilyCandidates();
    const first = familyForCandidates(candidates, { familyId: "editorial-offset" });
    const second = familyForCandidates(candidates, { familyId: "campaign-modular" });
    const index = deriveInactiveCandidateNormalizedTopologyIndex(
      registry(candidates, [second, first]),
    );
    expect(index.familyEntries).toHaveLength(2);
    expect(index.duplicateFamilyTopologyClusters).toStrictEqual([
      {
        topologyFingerprint: index.familyEntries[0].normalizedTopology.topologyFingerprint,
        candidateIdentityKeys: ["campaign-modular@1.0.0", "editorial-offset@1.0.0"],
      },
    ]);
  });

  it("does not cluster distinct PageBlueprint or family topologies", () => {
    const first = exactCandidate();
    const changedInput = renameBlueprint(candidateInput(), "home-distinct", "1.0.0");
    changedInput.structural.regions[2].visualWeight = "heavy";
    const second = exactCandidate(changedInput);
    const baseCandidates = pageFamilyCandidates();
    const firstFamily = familyForCandidates(baseCandidates, { familyId: "editorial-offset" });
    const changedCandidates = baseCandidates.map((candidate) =>
      candidate.structural.pageFamilyId === "home" ? second : candidate,
    );
    const secondFamily = familyForCandidates(changedCandidates, { familyId: "campaign-modular" });
    const index = deriveInactiveCandidateNormalizedTopologyIndex(
      registry([...baseCandidates, second], [firstFamily, secondFamily]),
    );
    expect(
      index.duplicatePageBlueprintTopologyClusters.some(({ candidateIdentityKeys }) =>
        candidateIdentityKeys.includes("home-distinct@1.0.0"),
      ),
    ).toBe(false);
    expect(index.duplicateFamilyTopologyClusters).toStrictEqual([]);
    expect(first.candidateFingerprint).toBeDefined();
  });

  it("canonicalizes multiple clusters and member identities independently from input order", () => {
    const baseCandidates = pageFamilyCandidates();
    const sameBase = exactCandidate(renameBlueprint(candidateInput(), "home-second", "1.2.0"));
    const changedInput = renameBlueprint(candidateInput(), "home-distinct", "1.0.0");
    changedInput.structural.regions[2].visualWeight = "heavy";
    const changed = exactCandidate(changedInput);
    const sameChanged = exactCandidate(
      renameBlueprint(changedInput, "home-distinct-second", "1.1.0"),
    );
    const allCandidates = [...baseCandidates, sameBase, changed, sameChanged];
    const nonHomeCandidates = baseCandidates.filter(
      ({ structural }) => structural.pageFamilyId !== "home",
    );
    const families = [
      familyForCandidates([...baseCandidates, sameBase], { familyId: "editorial-offset" }),
      familyForCandidates([...baseCandidates, sameBase], { familyId: "campaign-modular" }),
      familyForCandidates([...nonHomeCandidates, changed, sameChanged], {
        familyId: "product-first-commerce",
      }),
      familyForCandidates([...nonHomeCandidates, changed, sameChanged], {
        familyId: "technical-comparison",
      }),
    ];
    const forward = deriveInactiveCandidateNormalizedTopologyIndex(
      registry(allCandidates, families),
    );
    const reverse = deriveInactiveCandidateNormalizedTopologyIndex(
      registry([...allCandidates].reverse(), [...families].reverse()),
    );
    expect(reverse).toStrictEqual(forward);
    for (const clusters of [
      forward.duplicatePageBlueprintTopologyClusters,
      forward.duplicateFamilyTopologyClusters,
    ]) {
      expect(clusters).toHaveLength(2);
      expect(clusters.map(({ topologyFingerprint }) => topologyFingerprint)).toStrictEqual(
        clusters.map(({ topologyFingerprint }) => topologyFingerprint).sort(),
      );
      clusters.forEach(({ candidateIdentityKeys }) => {
        expect(candidateIdentityKeys).toStrictEqual([...candidateIdentityKeys].sort());
      });
    }
  });

  it("reports duplicates without rejecting, scoring, ranking or selecting them", () => {
    const first = exactCandidate();
    const second = exactCandidate(renameBlueprint(candidateInput(), "home-second", "1.2.0"));
    const index = deriveInactiveCandidateNormalizedTopologyIndex(registry([first, second]));
    expect(index.duplicatePageBlueprintTopologyClusters).toHaveLength(1);
    const keys = collectObjectKeys(index);
    expect([...keys]).not.toEqual(
      expect.arrayContaining([
        "compatibilityScore",
        "selectionScore",
        "rank",
        "selected",
        "defaultCandidate",
        "activationEvidence",
      ]),
    );
  });

  it("returns deeply readonly diagnostics", () => {
    const first = exactCandidate();
    const second = exactCandidate(renameBlueprint(candidateInput(), "home-second", "1.2.0"));
    expect(
      deepFrozen(deriveInactiveCandidateNormalizedTopologyIndex(registry([first, second]))),
    ).toBe(true);
  });
});

describe("P10B-19A-08A strict forbidden-authority boundary", () => {
  const forbiddenFields = [
    "blueprintId",
    "blueprintVersion",
    "familyId",
    "familyVersion",
    "lifecycleState",
    "candidateFingerprint",
    "assetRole",
    "assetRoles",
    "assetId",
    "assetUrl",
    "assetRevision",
    "fallbackTarget",
    "fallbackPriority",
    "terminalResolution",
    "merchantId",
    "projectId",
    "storeId",
    "prompt",
    "providerPayload",
    "providerId",
    "model",
    "compatibilityScore",
    "selectionScore",
    "rank",
    "selected",
    "defaultCandidate",
    "activationEvidence",
    "meaningfulnessScore",
    "palette",
    "font",
    "css",
    "html",
    "componentId",
    "componentVariant",
    "snapshot",
    "puckData",
    "createdAt",
    "updatedAt",
  ] as const;

  it.each(forbiddenFields)("rejects forbidden PageBlueprint topology field %s", (field) => {
    expect(() =>
      parsePageBlueprintV2NormalizedTopology({ ...topology(), [field]: "forbidden" }),
    ).toThrow();
  });

  it.each(forbiddenFields)("rejects forbidden family topology field %s", (field) => {
    const candidates = pageFamilyCandidates();
    const familyTopology = deriveStructuralStorefrontFamilyNormalizedTopology(
      registry(candidates),
      familyForCandidates(candidates),
    );
    expect(() =>
      parseStructuralStorefrontFamilyNormalizedTopology({
        ...familyTopology,
        [field]: "forbidden",
      }),
    ).toThrow();
  });
});

describe("P10B-19A-08A architecture and zero-reachability boundary", () => {
  it("keeps both A-07 production modules byte-identical to the approved base", () => {
    const repositoryRoot = resolve(process.cwd());
    expect(
      fileSha256(
        resolve(
          repositoryRoot,
          "src/application/storefront-templates/page-blueprint-v2-candidate-authority.ts",
        ),
      ),
    ).toBe("954214c8abfcc9358ea2ba6d76e446c6e4137768e8eef21e8364898707b458a8");
    expect(
      fileSha256(
        resolve(
          repositoryRoot,
          "src/application/storefront-templates/structural-storefront-family-candidate-registry.ts",
        ),
      ),
    ).toBe("87793c1c280a006f3c9c06fe8573c3dd2a5be06d07773911a4c8dbb35b64e8e0");
  });

  it("limits production topology imports to two owners and the barrel", () => {
    const repositoryRoot = resolve(process.cwd());
    const consumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) =>
        /PageBlueprintV2NormalizedTopology|StructuralStorefrontFamilyNormalizedTopology|InactiveCandidateNormalizedTopologyIndex|page-blueprint-v2-normalized-topology|structural-storefront-family-normalized-topology/u.test(
          source,
        ),
      )
      .map(({ path }) => relative(repositoryRoot, path))
      .sort();
    expect(consumers).toStrictEqual([
      "src/application/storefront-templates/index.ts",
      "src/application/storefront-templates/page-blueprint-v2-normalized-topology.ts",
      "src/application/storefront-templates/structural-storefront-candidate-compatibility-evaluation.ts",
      "src/application/storefront-templates/structural-storefront-family-normalized-topology.ts",
    ]);
  });

  it("has no production call site for topology-index derivation", () => {
    const repositoryRoot = resolve(process.cwd());
    const callSites = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .filter((path) =>
        readFileSync(path, "utf8").includes("deriveInactiveCandidateNormalizedTopologyIndex("),
      )
      .map((path) => relative(repositoryRoot, path));
    expect(callSites).toStrictEqual([
      "src/application/storefront-templates/structural-storefront-candidate-compatibility-evaluation.ts",
      "src/application/storefront-templates/structural-storefront-family-normalized-topology.ts",
    ]);
  });

  it("keeps the production candidate registry and derived index exactly empty", () => {
    expect(inactiveStructuralStorefrontFamilyCandidateRegistry).toStrictEqual({
      contractSchemaVersion: "1.0.0",
      pageBlueprintCandidates: [],
      familyCandidates: [],
    });
    const index = deriveInactiveCandidateNormalizedTopologyIndex(
      inactiveStructuralStorefrontFamilyCandidateRegistry,
    );
    expect(index.pageBlueprintEntries).toHaveLength(0);
    expect(index.familyEntries).toHaveLength(0);
    expect(index.duplicatePageBlueprintTopologyClusters).toHaveLength(0);
    expect(index.duplicateFamilyTopologyClusters).toHaveLength(0);
  });

  it("exports no populated topology record", () => {
    const populated = Object.entries(storefrontTemplateAuthority).filter(
      ([, value]) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.hasOwn(value, "topologyFingerprint"),
    );
    expect(populated).toStrictEqual([]);
  });

  it("exports no compatibility, score, rank, selector, default or activation topology API", () => {
    const forbidden = Object.keys(storefrontTemplateAuthority).filter(
      (name) =>
        /NormalizedTopology/iu.test(name) &&
        /compatib|score|rank|select|default|activat|meaningful/iu.test(name),
    );
    expect(forbidden).toStrictEqual([]);
  });

  it("records the exact approved base for protected-source audits", () => {
    expect(baseCommit).toBe("b834a4606d60ce448a5d1e04224275672ea1d13d");
  });
});
