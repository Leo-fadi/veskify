import { describe, expect, it } from "vitest";

import {
  INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_REGISTRY_SCHEMA_VERSION,
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  createPageBlueprintV2CandidateAuthority,
  createStructuralStorefrontFamilyCandidate,
  type PageBlueprintV2CandidateAuthorityV1,
  type StructuralStorefrontFamilyCandidateV1,
} from "@/application/storefront-templates";
import {
  INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
  STRUCTURAL_STOREFRONT_CAPABILITY_CONTEXT_SCHEMA_VERSION,
  STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_SCHEMA_VERSION,
  createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
  createStructuralStorefrontCapabilityContext,
  createStructuralStorefrontFamilyCompatibilityProfile,
  inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
  parseInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
  parseStructuralStorefrontCapabilityContext,
  parseStructuralStorefrontFamilyCompatibilityProfile,
  structuralStorefrontCapabilityContextValue,
  structuralStorefrontCatalogueCardinalitySchema,
  structuralStorefrontCatalogueCardinalityValues,
  structuralStorefrontCompatibilityDimensionSchema,
  structuralStorefrontCompatibilityDimensions,
  structuralStorefrontFactDepthSchema,
  structuralStorefrontFactDepthValues,
  structuralStorefrontNavigationDepthSchema,
  structuralStorefrontNavigationDepthValues,
  structuralStorefrontProductComplexitySchema,
  structuralStorefrontProductComplexityValues,
  validateInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueBinding,
} from "@/application/storefront-templates/structural-storefront-compatibility-contract";
import { localeSchema, localeValues } from "@/domain/shared/schemas";
import {
  structuralStorefrontPageFamilyIds,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family/cross-page-relationships";
import type { StructuralStorefrontFamilyId } from "@/domain/structural-storefront-family/identity";

const requiredNarrativeRoles: Readonly<
  Record<StructuralStorefrontPageFamilyId, readonly string[]>
> = {
  home: ["orientation", "primary-discovery"],
  collection: ["orientation", "primary-discovery"],
  search: ["orientation", "primary-discovery"],
  "product-detail": ["product-focus", "conversion"],
  "content-support": ["orientation"],
  utility: ["orientation"],
};

function candidateInput(pageFamilyId: StructuralStorefrontPageFamilyId) {
  const id = `${pageFamilyId}-compatibility-candidate`;
  const regions = [
    ...requiredNarrativeRoles[pageFamilyId].map((role, index) => ({
      id: `${role}-${index}`,
      role,
      requirement: "required",
      cardinality: { minimum: 1, ideal: 1, maximum: 2 },
      visualWeight: "medium",
    })),
    {
      id: "asset-story",
      role: "brand-story",
      requirement: "optional",
      cardinality: { minimum: 0, ideal: 1, maximum: 2 },
      visualWeight: "light",
    },
  ];
  const regionIds = regions.map(({ id: regionId }) => regionId);
  return {
    candidateSchemaVersion: "1.0.0",
    structural: {
      id,
      version: "1.0.0",
      pageFamilyId,
      regions,
      relationships: [],
      orderAlternatives: [{ id: "canonical", regionIds }],
      defaultOrderAlternativeId: "canonical",
    },
    assetRoleCompatibility: {
      contractSchemaVersion: "1.0.0",
      blueprintId: id,
      blueprintVersion: "1.0.0",
      regionAssetRequirements: [
        {
          regionId: "asset-story",
          roleRequirements: [
            {
              role: "logo",
              requirement: "optional",
              cardinality: { minimum: 0, ideal: 1, maximum: 2 },
            },
            {
              role: "editorialImage",
              requirement: "required",
              cardinality: { minimum: 2, ideal: 2, maximum: 3 },
            },
            {
              role: "supportingContentImage",
              requirement: "required",
              cardinality: { minimum: 1, ideal: 2, maximum: 3 },
            },
          ],
        },
      ],
    },
    responsiveRules: {
      contractSchemaVersion: "1.0.0",
      blueprintId: id,
      blueprintVersion: "1.0.0",
      breakpointRules: [
        ["mobile", 375],
        ["tablet", 768],
        ["desktop", 1024],
        ["wide", 1440],
      ].map(([breakpoint, viewport]) => ({
        breakpoint,
        viewport,
        orderAlternativeId: "canonical",
        regionProportionRules: regionIds.map((regionId) => ({
          regionId,
          proportionMode: "preserve",
        })),
        relationshipTransformations: [],
      })),
    },
    omissionSubstitutionFallback: {
      contractSchemaVersion: "1.0.0",
      blueprintId: id,
      blueprintVersion: "1.0.0",
      blueprintSubstitutionCandidates: [],
      regionFallbackRules: [
        {
          regionId: "asset-story",
          trigger: "required-asset-role-cardinality-unsatisfied",
          terminalResolution: "omit-region",
        },
      ],
    },
  };
}

function candidates(): readonly PageBlueprintV2CandidateAuthorityV1[] {
  return structuralStorefrontPageFamilyIds.map((pageFamilyId) =>
    createPageBlueprintV2CandidateAuthority(candidateInput(pageFamilyId)),
  );
}

function family(
  pageCandidates: readonly PageBlueprintV2CandidateAuthorityV1[],
  familyId: StructuralStorefrontFamilyId = "editorial-offset",
): StructuralStorefrontFamilyCandidateV1 {
  return createStructuralStorefrontFamilyCandidate({
    candidateSchemaVersion: "1.0.0",
    familyId,
    familyVersion: "1.0.0",
    lifecycleState: "candidate",
    pageFamilyProfiles: structuralStorefrontPageFamilyIds.map((pageFamilyId) => ({
      pageFamilyId,
      blueprintCandidates: pageCandidates
        .filter((candidate) => candidate.structural.pageFamilyId === pageFamilyId)
        .map((candidate) => ({
          blueprintId: candidate.structural.id,
          blueprintVersion: candidate.structural.version,
        })),
    })),
    crossPageRelationships: [
      {
        sourcePageFamilyId: "home",
        relationshipKind: "frame-continuity",
        targetPageFamilyId: "collection",
      },
    ],
  });
}

function registry(
  pageCandidates: readonly PageBlueprintV2CandidateAuthorityV1[],
  families: readonly StructuralStorefrontFamilyCandidateV1[] = [],
) {
  return canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry({
    contractSchemaVersion: INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_REGISTRY_SCHEMA_VERSION,
    pageBlueprintCandidates: pageCandidates,
    familyCandidates: families,
  });
}

function contextInput(pageCandidates: readonly PageBlueprintV2CandidateAuthorityV1[]) {
  return {
    contextSchemaVersion: STRUCTURAL_STOREFRONT_CAPABILITY_CONTEXT_SCHEMA_VERSION,
    catalogueCardinality: "standard",
    factDepth: "rich",
    productComplexity: "mixed",
    navigationDepth: "deep",
    activeLocale: "fi",
    availableLocales: ["fi", "en"],
    pageBlueprintAssetRoleCapacityEvidence: [...pageCandidates].reverse().map((candidate) => ({
      blueprintId: candidate.structural.id,
      blueprintVersion: candidate.structural.version,
      exactCandidateFingerprint: candidate.candidateFingerprint,
      requiredRoleCapacities: [
        {
          regionId: "asset-story",
          role: "supportingContentImage",
          satisfiableMinimumCapacity: 1,
        },
        {
          regionId: "asset-story",
          role: "editorialImage",
          satisfiableMinimumCapacity: 2,
        },
      ],
    })),
  };
}

const supportedByDimension = {
  "catalogue-cardinality": [...structuralStorefrontCatalogueCardinalityValues],
  "fact-depth": [...structuralStorefrontFactDepthValues],
  "product-complexity": [...structuralStorefrontProductComplexityValues],
  "navigation-depth": [...structuralStorefrontNavigationDepthValues],
  locale: [...localeValues],
};

function profileInput(candidate: StructuralStorefrontFamilyCandidateV1) {
  return {
    profileSchemaVersion: STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_SCHEMA_VERSION,
    familyId: candidate.familyId,
    familyVersion: candidate.familyVersion,
    exactFamilyCandidateFingerprint: candidate.candidateFingerprint,
    conditionPolicies: [...structuralStorefrontCompatibilityDimensions]
      .reverse()
      .map((dimension) => ({
        dimension,
        supportedValues: [...supportedByDimension[dimension]].reverse(),
        incompatibleValues: [],
      })),
  };
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => deepFrozen(child, seen));
}

function stale(value: string): string {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

type ContextFixture = ReturnType<typeof contextInput>;

function changedContext(
  pageCandidates: readonly PageBlueprintV2CandidateAuthorityV1[],
  change: (input: ContextFixture) => void,
): ContextFixture {
  const input = structuredClone(contextInput(pageCandidates));
  change(input);
  return input;
}

function replaceFirstCapacities(input: ContextFixture, requiredRoleCapacities: unknown[]) {
  return {
    ...input,
    pageBlueprintAssetRoleCapacityEvidence: input.pageBlueprintAssetRoleCapacityEvidence.map(
      (entry, index) => (index === 0 ? { ...entry, requiredRoleCapacities } : entry),
    ),
  };
}

describe("P10B-19A-08B compatibility dimensions and transient capability context", () => {
  it("owns exactly five ordered, closed compatibility vocabularies", () => {
    expect(structuralStorefrontCompatibilityDimensions).toStrictEqual([
      "catalogue-cardinality",
      "fact-depth",
      "product-complexity",
      "navigation-depth",
      "locale",
    ]);
    expect(structuralStorefrontCatalogueCardinalityValues).toStrictEqual([
      "sparse",
      "standard",
      "rich",
    ]);
    expect(structuralStorefrontFactDepthValues).toStrictEqual(["sparse", "standard", "rich"]);
    expect(structuralStorefrontProductComplexityValues).toStrictEqual([
      "simple",
      "configurable",
      "mixed",
    ]);
    expect(structuralStorefrontNavigationDepthValues).toStrictEqual([
      "shallow",
      "standard",
      "deep",
    ]);
    expect(localeValues).toStrictEqual(["en", "fi"]);
  });

  it("accepts every exact vocabulary value and rejects aliases, unknowns and defaults", () => {
    const vocabularies = [
      {
        schema: structuralStorefrontCompatibilityDimensionSchema,
        values: structuralStorefrontCompatibilityDimensions,
        invalid: ["visual-style", "catalogue_cardinality", "Catalogue-cardinality"],
      },
      {
        schema: structuralStorefrontCatalogueCardinalitySchema,
        values: structuralStorefrontCatalogueCardinalityValues,
        invalid: ["normal", "dense", " Standard"],
      },
      {
        schema: structuralStorefrontFactDepthSchema,
        values: structuralStorefrontFactDepthValues,
        invalid: ["limited", "deep", "RICH"],
      },
      {
        schema: structuralStorefrontProductComplexitySchema,
        values: structuralStorefrontProductComplexityValues,
        invalid: ["complex", "variable", " configurable"],
      },
      {
        schema: structuralStorefrontNavigationDepthSchema,
        values: structuralStorefrontNavigationDepthValues,
        invalid: ["compact", "broad", "Deep"],
      },
      { schema: localeSchema, values: localeValues, invalid: ["sv", "EN", " fi"] },
    ];

    for (const { schema, values, invalid } of vocabularies) {
      for (const value of values) expect(schema.safeParse(value).success).toBe(true);
      for (const value of [...invalid, undefined, null, 1]) {
        expect(schema.safeParse(value).success).toBe(false);
      }
    }
  });

  it("canonicalizes exact registry-bound evidence and produces deeply readonly authority", () => {
    const pageCandidates = candidates();
    const input = contextInput(pageCandidates);
    const before = structuredClone(input);
    const result = createStructuralStorefrontCapabilityContext(registry(pageCandidates), input);

    expect(input).toStrictEqual(before);
    expect(result.availableLocales).toStrictEqual(["en", "fi"]);
    expect(
      result.pageBlueprintAssetRoleCapacityEvidence.map(({ blueprintId }) => blueprintId),
    ).toStrictEqual(pageCandidates.map(({ structural }) => structural.id));
    expect(result.contextFingerprint).toMatch(
      /^structural-storefront-capability-context-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(deepFrozen(result)).toBe(true);
    expect(structuralStorefrontCapabilityContextValue(result, "locale")).toBe("fi");
    expect(structuralStorefrontCapabilityContextValue(result, "fact-depth")).toBe("rich");
  });

  it("rejects stale fingerprints, noncanonical parses and compatibility aliases", () => {
    const pageCandidates = candidates();
    const candidateRegistry = registry(pageCandidates);
    const created = createStructuralStorefrontCapabilityContext(
      candidateRegistry,
      contextInput(pageCandidates),
    );

    expect(() =>
      parseStructuralStorefrontCapabilityContext(candidateRegistry, created),
    ).not.toThrow();
    expect(() =>
      parseStructuralStorefrontCapabilityContext(candidateRegistry, {
        ...created,
        contextFingerprint: stale(created.contextFingerprint),
      }),
    ).toThrow(/stale|noncanonical/u);
    expect(() =>
      parseStructuralStorefrontCapabilityContext(candidateRegistry, {
        ...created,
        availableLocales: [...created.availableLocales].reverse(),
      }),
    ).toThrow(/stale|noncanonical/u);
    for (const catalogueCardinality of ["Standard", " standard", "normal", 2]) {
      expect(() =>
        createStructuralStorefrontCapabilityContext(candidateRegistry, {
          ...contextInput(pageCandidates),
          catalogueCardinality,
        }),
      ).toThrow();
    }
  });

  it("rejects wrong context versions, absent active locales, duplicates and unknown fields", () => {
    const pageCandidates = candidates();
    const candidateRegistry = registry(pageCandidates);
    const baseline = contextInput(pageCandidates);
    const invalidInputs = [
      { ...baseline, contextSchemaVersion: "1.0.1" },
      { ...baseline, activeLocale: "en", availableLocales: ["fi"] },
      { ...baseline, activeLocale: "sv" },
      { ...baseline, availableLocales: ["fi", "fi"] },
      { ...baseline, availableLocales: ["fi", "sv"] },
      { ...baseline, provider: "fixture" },
      { ...baseline, catalogueCardinality: undefined },
      { ...baseline, activeLocale: undefined },
      { ...baseline, pageBlueprintAssetRoleCapacityEvidence: undefined },
    ];
    for (const input of invalidInputs) {
      expect(() => createStructuralStorefrontCapabilityContext(candidateRegistry, input)).toThrow();
    }
  });

  it("requires exact candidate fingerprints and every and only required A-04 role capacity", () => {
    const pageCandidates = candidates();
    const candidateRegistry = registry(pageCandidates);
    const baseline = contextInput(pageCandidates);
    const firstEvidence = baseline.pageBlueprintAssetRoleCapacityEvidence[0];

    expect(() =>
      createStructuralStorefrontCapabilityContext(candidateRegistry, {
        ...baseline,
        pageBlueprintAssetRoleCapacityEvidence:
          baseline.pageBlueprintAssetRoleCapacityEvidence.slice(1),
      }),
    ).toThrow(/every|Missing/u);
    expect(() =>
      createStructuralStorefrontCapabilityContext(candidateRegistry, {
        ...baseline,
        pageBlueprintAssetRoleCapacityEvidence: [
          ...baseline.pageBlueprintAssetRoleCapacityEvidence,
          firstEvidence,
        ],
      }),
    ).toThrow(/Duplicate|every/u);
    expect(() =>
      createStructuralStorefrontCapabilityContext(candidateRegistry, {
        ...baseline,
        pageBlueprintAssetRoleCapacityEvidence: baseline.pageBlueprintAssetRoleCapacityEvidence.map(
          (entry, index) =>
            index === 0
              ? { ...entry, exactCandidateFingerprint: stale(entry.exactCandidateFingerprint) }
              : entry,
        ),
      }),
    ).toThrow(/stale/u);
    for (const requiredRoleCapacities of [
      [],
      [...firstEvidence.requiredRoleCapacities, firstEvidence.requiredRoleCapacities[0]],
      [{ ...firstEvidence.requiredRoleCapacities[0], role: "logo" }],
      [{ ...firstEvidence.requiredRoleCapacities[0], satisfiableMinimumCapacity: 33 }],
    ]) {
      expect(() =>
        createStructuralStorefrontCapabilityContext(candidateRegistry, {
          ...baseline,
          pageBlueprintAssetRoleCapacityEvidence:
            baseline.pageBlueprintAssetRoleCapacityEvidence.map((entry, index) =>
              index === 0 ? { ...entry, requiredRoleCapacities } : entry,
            ),
        }),
      ).toThrow();
    }
  });

  it("rejects extra or unknown candidates and optional, unknown-region or unknown-role evidence", () => {
    const pageCandidates = candidates();
    const candidateRegistry = registry(pageCandidates);
    const baseline = contextInput(pageCandidates);
    const first = baseline.pageBlueprintAssetRoleCapacityEvidence[0];
    const capacities = first.requiredRoleCapacities;
    const unknownCandidate = {
      ...first,
      blueprintId: "unknown-compatibility-candidate",
    };
    for (const evidence of [
      baseline.pageBlueprintAssetRoleCapacityEvidence.map((entry, index) =>
        index === 0 ? unknownCandidate : entry,
      ),
      [...baseline.pageBlueprintAssetRoleCapacityEvidence, unknownCandidate],
    ]) {
      expect(() =>
        createStructuralStorefrontCapabilityContext(candidateRegistry, {
          ...baseline,
          pageBlueprintAssetRoleCapacityEvidence: evidence,
        }),
      ).toThrow(/every|registry candidate/u);
    }

    const invalidCapacities = [
      [...capacities, { ...capacities[0], role: "logo" }],
      capacities.map((capacity, index) =>
        index === 0 ? { ...capacity, regionId: "unknown-region" } : capacity,
      ),
      capacities.map((capacity, index) =>
        index === 0 ? { ...capacity, role: "unapprovedRole" } : capacity,
      ),
    ];
    for (const requiredRoleCapacities of invalidCapacities) {
      expect(() =>
        createStructuralStorefrontCapabilityContext(
          candidateRegistry,
          replaceFirstCapacities(baseline, requiredRoleCapacities),
        ),
      ).toThrow();
    }
  });

  it("accepts inclusive 0..32 capacities, rejects invalid numbers and canonicalizes multi-role order", () => {
    const pageCandidates = candidates();
    const candidateRegistry = registry(pageCandidates);
    const baseline = contextInput(pageCandidates);
    for (const capacity of [0, 32]) {
      const input = changedContext(pageCandidates, (context) => {
        context.pageBlueprintAssetRoleCapacityEvidence[0].requiredRoleCapacities[0].satisfiableMinimumCapacity =
          capacity;
      });
      expect(() =>
        createStructuralStorefrontCapabilityContext(candidateRegistry, input),
      ).not.toThrow();
    }
    for (const capacity of [-1, 0.5, 33]) {
      const input = changedContext(pageCandidates, (context) => {
        context.pageBlueprintAssetRoleCapacityEvidence[0].requiredRoleCapacities[0].satisfiableMinimumCapacity =
          capacity;
      });
      expect(() => createStructuralStorefrontCapabilityContext(candidateRegistry, input)).toThrow();
    }
    const created = createStructuralStorefrontCapabilityContext(candidateRegistry, baseline);
    expect(created.pageBlueprintAssetRoleCapacityEvidence[0].requiredRoleCapacities).toStrictEqual([
      { regionId: "asset-story", role: "editorialImage", satisfiableMinimumCapacity: 2 },
      { regionId: "asset-story", role: "supportingContentImage", satisfiableMinimumCapacity: 1 },
    ]);
  });

  it("rejects asset identity, approval and provenance payloads at every capacity boundary", () => {
    const pageCandidates = candidates();
    const candidateRegistry = registry(pageCandidates);
    const baseline = contextInput(pageCandidates);
    const first = baseline.pageBlueprintAssetRoleCapacityEvidence[0];
    for (const input of [
      replaceFirstCapacities(baseline, [
        { ...first.requiredRoleCapacities[0], assetId: "asset-1" },
        first.requiredRoleCapacities[1],
      ]),
      replaceFirstCapacities(baseline, [
        { ...first.requiredRoleCapacities[0], provenance: "merchant-upload" },
        first.requiredRoleCapacities[1],
      ]),
      {
        ...baseline,
        pageBlueprintAssetRoleCapacityEvidence: baseline.pageBlueprintAssetRoleCapacityEvidence.map(
          (entry, index) => (index === 0 ? { ...entry, approvedAssets: ["asset-1"] } : entry),
        ),
      },
    ]) {
      expect(() => createStructuralStorefrontCapabilityContext(candidateRegistry, input)).toThrow();
    }
  });

  it("makes fingerprints order-insensitive after creation and sensitive to every capability input", () => {
    const pageCandidates = candidates();
    const candidateRegistry = registry(pageCandidates);
    const baseline = contextInput(pageCandidates);
    const first = createStructuralStorefrontCapabilityContext(candidateRegistry, baseline);
    const equivalent = createStructuralStorefrontCapabilityContext(candidateRegistry, {
      ...baseline,
      availableLocales: [...baseline.availableLocales].reverse(),
      pageBlueprintAssetRoleCapacityEvidence: [
        ...baseline.pageBlueprintAssetRoleCapacityEvidence,
      ].reverse(),
    });
    expect(equivalent).toStrictEqual(first);
    const variants = [
      { ...baseline, catalogueCardinality: "sparse" },
      { ...baseline, factDepth: "standard" },
      { ...baseline, productComplexity: "simple" },
      { ...baseline, navigationDepth: "shallow" },
      { ...baseline, activeLocale: "en" },
      { ...baseline, availableLocales: ["fi"] },
      changedContext(pageCandidates, (context) => {
        context.pageBlueprintAssetRoleCapacityEvidence[0].requiredRoleCapacities[0].satisfiableMinimumCapacity = 3;
      }),
    ];
    for (const variant of variants) {
      expect(
        createStructuralStorefrontCapabilityContext(candidateRegistry, variant).contextFingerprint,
      ).not.toBe(first.contextFingerprint);
    }
  });
});

describe("P10B-19A-08B family compatibility profiles and inactive catalogue", () => {
  it("canonicalizes one complete partition per dimension and binds the exact family candidate", () => {
    const pageCandidates = candidates();
    const familyCandidate = family(pageCandidates);
    const input = profileInput(familyCandidate);
    const profile = createStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, input);

    expect(profile.conditionPolicies.map(({ dimension }) => dimension)).toStrictEqual(
      structuralStorefrontCompatibilityDimensions,
    );
    expect(profile.conditionPolicies[0].supportedValues).toStrictEqual([
      "sparse",
      "standard",
      "rich",
    ]);
    expect(profile.profileFingerprint).toMatch(
      /^structural-storefront-family-compatibility-profile-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(deepFrozen(profile)).toBe(true);
    expect(Object.keys(profile)).toStrictEqual([
      "profileSchemaVersion",
      "familyId",
      "familyVersion",
      "exactFamilyCandidateFingerprint",
      "conditionPolicies",
      "profileFingerprint",
    ]);
  });

  it("rejects incomplete, duplicate, overlapping and empty-supported policies", () => {
    const pageCandidates = candidates();
    const familyCandidate = family(pageCandidates);
    const baseline = profileInput(familyCandidate);
    const duplicateDimension = structuredClone(baseline);
    duplicateDimension.conditionPolicies[4] = structuredClone(
      duplicateDimension.conditionPolicies[0],
    );
    expect(() =>
      createStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, duplicateDimension),
    ).toThrow(/Duplicate/u);

    const incomplete = structuredClone(baseline);
    const cataloguePolicy = incomplete.conditionPolicies.find(
      ({ dimension }) => dimension === "catalogue-cardinality",
    );
    if (!cataloguePolicy) throw new Error("Missing fixture policy.");
    cataloguePolicy.supportedValues = ["sparse", "standard"];
    expect(() =>
      createStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, incomplete),
    ).toThrow(/partition/u);

    const overlap = structuredClone(baseline);
    const overlappingPolicy = overlap.conditionPolicies.find(
      ({ dimension }) => dimension === "catalogue-cardinality",
    );
    if (!overlappingPolicy) throw new Error("Missing fixture policy.");
    (overlappingPolicy as unknown as { incompatibleValues: string[] }).incompatibleValues = [
      "sparse",
    ];
    expect(() =>
      createStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, overlap),
    ).toThrow(/partition/u);

    const empty = structuredClone(baseline);
    const emptyPolicy = empty.conditionPolicies.find(
      ({ dimension }) => dimension === "catalogue-cardinality",
    );
    if (!emptyPolicy) throw new Error("Missing fixture policy.");
    (emptyPolicy as unknown as { supportedValues: string[] }).supportedValues = [];
    (emptyPolicy as unknown as { incompatibleValues: string[] }).incompatibleValues = [
      "sparse",
      "standard",
      "rich",
    ];
    expect(() =>
      createStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, empty),
    ).toThrow();
  });

  it("rejects duplicate and unknown policy values plus wildcard or expression shortcuts", () => {
    const pageCandidates = candidates();
    const familyCandidate = family(pageCandidates);
    const invalidProfiles = [
      profileInput(familyCandidate),
      profileInput(familyCandidate),
      profileInput(familyCandidate),
      profileInput(familyCandidate),
      profileInput(familyCandidate),
    ];
    const policies: Array<
      Record<string, unknown> & {
        supportedValues: string[];
        incompatibleValues: string[];
      }
    > = invalidProfiles.map((profile) => {
      const policy = profile.conditionPolicies.find(
        ({ dimension }) => dimension === "catalogue-cardinality",
      );
      if (!policy) throw new Error("Missing fixture policy.");
      return policy;
    });
    policies[0].supportedValues = ["sparse", "standard", "rich", "rich"];
    policies[1].supportedValues = ["sparse"];
    policies[1].incompatibleValues = ["standard", "standard", "rich"];
    policies[2].supportedValues = ["sparse", "standard", "unknown"];
    policies[2].incompatibleValues = ["rich"];
    policies[3].wildcard = "*";
    policies[4].expression = { operator: "in", values: ["sparse"] };

    for (const input of invalidProfiles) {
      expect(() =>
        createStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, input),
      ).toThrow();
    }
  });

  it("requires canonical dimension and value order when parsing an existing profile", () => {
    const pageCandidates = candidates();
    const familyCandidate = family(pageCandidates);
    const input = profileInput(familyCandidate);
    const cataloguePolicy = input.conditionPolicies.find(
      ({ dimension }) => dimension === "catalogue-cardinality",
    );
    if (!cataloguePolicy) throw new Error("Missing fixture policy.");
    cataloguePolicy.supportedValues = ["sparse"];
    (cataloguePolicy as unknown as { incompatibleValues: string[] }).incompatibleValues = [
      "rich",
      "standard",
    ];
    const profile = createStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, input);
    expect(profile.conditionPolicies[0].incompatibleValues).toStrictEqual(["standard", "rich"]);

    const reversedDimensions = {
      ...profile,
      conditionPolicies: [...profile.conditionPolicies].reverse(),
    };
    const reversedValues = structuredClone(profile);
    (
      reversedValues.conditionPolicies[0] as unknown as { incompatibleValues: string[] }
    ).incompatibleValues.reverse();
    for (const noncanonical of [reversedDimensions, reversedValues]) {
      expect(() =>
        parseStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, noncanonical),
      ).toThrow(/stale|noncanonical/u);
    }
  });

  it("rejects changed candidate binding, stale fingerprints and noncanonical parsing", () => {
    const pageCandidates = candidates();
    const familyCandidate = family(pageCandidates);
    const profile = createStructuralStorefrontFamilyCompatibilityProfile(
      familyCandidate,
      profileInput(familyCandidate),
    );
    const changedCandidate = family(pageCandidates, "campaign-modular");

    expect(() =>
      parseStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, profile),
    ).not.toThrow();
    expect(() =>
      parseStructuralStorefrontFamilyCompatibilityProfile(changedCandidate, profile),
    ).toThrow(/exact/u);
    expect(() =>
      parseStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, {
        ...profile,
        profileFingerprint: stale(profile.profileFingerprint),
      }),
    ).toThrow(/stale|noncanonical/u);
    expect(() =>
      parseStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, {
        ...profile,
        conditionPolicies: [...profile.conditionPolicies].reverse(),
      }),
    ).toThrow(/stale|noncanonical/u);
  });

  it("rejects stale exact bindings, missing fields and forbidden lifecycle/ranking authority", () => {
    const pageCandidates = candidates();
    const familyCandidate = family(pageCandidates);
    const baseline = profileInput(familyCandidate);
    const invalidProfiles: unknown[] = [
      { ...baseline, exactFamilyCandidateFingerprint: stale(familyCandidate.candidateFingerprint) },
      { ...baseline, lifecycleState: "candidate" },
      { ...baseline, score: 1 },
      { ...baseline, priority: 1 },
      { ...baseline, selected: true },
      { ...baseline, topologyFingerprint: "topology" },
      { ...baseline, familyVersion: undefined },
      { ...baseline, conditionPolicies: undefined },
    ];
    for (const input of invalidProfiles) {
      expect(() =>
        createStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, input),
      ).toThrow();
    }
  });

  it("canonicalizes bounded catalogues and validates an exact registry identity set", () => {
    const pageCandidates = candidates();
    const firstFamily = family(pageCandidates, "editorial-offset");
    const secondFamily = family(pageCandidates, "campaign-modular");
    const firstProfile = createStructuralStorefrontFamilyCompatibilityProfile(
      firstFamily,
      profileInput(firstFamily),
    );
    const secondProfile = createStructuralStorefrontFamilyCompatibilityProfile(
      secondFamily,
      profileInput(secondFamily),
    );
    const catalogue = createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion:
        INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
      profiles: [secondProfile, firstProfile],
    });
    const candidateRegistry = registry(pageCandidates, [firstFamily, secondFamily]);

    expect(catalogue.profiles.map(({ familyId }) => familyId)).toStrictEqual([
      "editorial-offset",
      "campaign-modular",
    ]);
    expect(catalogue.catalogueFingerprint).toMatch(
      /^inactive-structural-storefront-family-compatibility-profile-catalogue-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(deepFrozen(catalogue)).toBe(true);
    expect(
      validateInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueBinding(
        candidateRegistry,
        catalogue,
      ),
    ).toStrictEqual(catalogue);
    expect(() =>
      validateInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueBinding(
        candidateRegistry,
        createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
          contractSchemaVersion:
            INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
          profiles: [firstProfile],
        }),
      ),
    ).toThrow(/exactly bind/u);
    expect(() =>
      parseInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue(catalogue),
    ).not.toThrow();
    expect(() =>
      parseInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
        ...catalogue,
        profiles: [...catalogue.profiles].reverse(),
      }),
    ).toThrow(/stale|noncanonical/u);
  });

  it("fails closed for extra profiles and both empty/nonempty registry mismatches", () => {
    const pageCandidates = candidates();
    const firstFamily = family(pageCandidates, "editorial-offset");
    const secondFamily = family(pageCandidates, "campaign-modular");
    const firstProfile = createStructuralStorefrontFamilyCompatibilityProfile(
      firstFamily,
      profileInput(firstFamily),
    );
    const secondProfile = createStructuralStorefrontFamilyCompatibilityProfile(
      secondFamily,
      profileInput(secondFamily),
    );
    const emptyCatalogue = inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue;
    const firstCatalogue = createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion:
        INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
      profiles: [firstProfile],
    });
    const extraCatalogue = createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion:
        INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
      profiles: [firstProfile, secondProfile],
    });

    expect(() =>
      validateInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueBinding(
        registry([], []),
        emptyCatalogue,
      ),
    ).not.toThrow();
    for (const [candidateRegistry, catalogue] of [
      [registry([], []), firstCatalogue],
      [registry(pageCandidates, [firstFamily]), emptyCatalogue],
      [registry(pageCandidates, [firstFamily]), extraCatalogue],
    ] as const) {
      expect(() =>
        validateInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueBinding(
          candidateRegistry,
          catalogue,
        ),
      ).toThrow(/exactly bind/u);
    }
  });

  it("rejects duplicate profiles plus stale and noncanonical catalogues", () => {
    const pageCandidates = candidates();
    const familyCandidate = family(pageCandidates);
    const profile = createStructuralStorefrontFamilyCompatibilityProfile(
      familyCandidate,
      profileInput(familyCandidate),
    );
    expect(() =>
      createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
        contractSchemaVersion:
          INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
        profiles: [profile, profile],
      }),
    ).toThrow(/duplicate/u);

    const catalogue = createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion:
        INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
      profiles: [profile],
    });
    expect(() =>
      parseInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue(catalogue),
    ).not.toThrow();
    expect(() =>
      parseInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
        ...catalogue,
        catalogueFingerprint: stale(catalogue.catalogueFingerprint),
      }),
    ).toThrow(/stale|noncanonical/u);
    expect(() =>
      createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
        contractSchemaVersion:
          INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
        profiles: [profile],
        selectedProfile: profile.profileFingerprint,
      }),
    ).toThrow();
  });

  it("keeps production registry/profile authority exactly empty and frozen", () => {
    expect(inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue).toStrictEqual(
      createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
        contractSchemaVersion:
          INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_COMPATIBILITY_PROFILE_CATALOGUE_SCHEMA_VERSION,
        profiles: [],
      }),
    );
    expect(inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue.profiles).toHaveLength(
      0,
    );
    expect(deepFrozen(inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue)).toBe(true);
  });
});
