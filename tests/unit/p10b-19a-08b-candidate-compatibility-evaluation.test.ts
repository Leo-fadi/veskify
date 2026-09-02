import { describe, expect, it } from "vitest";

import * as storefrontTemplateAuthority from "@/application/storefront-templates";
import {
  createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
  createPageBlueprintV2CandidateAuthority,
  createStructuralStorefrontCapabilityContext,
  createStructuralStorefrontFamilyCandidate,
  createStructuralStorefrontFamilyCompatibilityProfile,
  deriveInactiveCandidateNormalizedTopologyIndex,
  evaluateInactiveStructuralStorefrontCandidateCompatibility,
  inactiveStructuralStorefrontFamilyCandidateRegistry,
  inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
  pageBlueprintV2CandidateCompatibilityStatuses,
  pageBlueprintV2CandidateCompatibilityTerminalDispositions,
  parseStructuralStorefrontCandidateCompatibilityEvaluation,
  structuralStorefrontFamilyCandidateCompatibilityStatuses,
  type InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  type PageBlueprintV2CandidateAuthorityV1,
  type PageBlueprintV2CandidateReference,
  type StructuralStorefrontFamilyCandidateV1,
} from "@/application/storefront-templates";
import {
  structuralStorefrontPageFamilyIds,
  type StructuralStorefrontFamilyId,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family";

const minimumRoles = {
  home: ["orientation", "primary-discovery"],
  collection: ["orientation", "primary-discovery"],
  search: ["orientation", "primary-discovery"],
  "product-detail": ["product-focus", "conversion"],
  "content-support": ["orientation"],
  utility: ["orientation"],
} as const;

type CandidateOptions = Readonly<{
  id: string;
  pageFamilyId?: StructuralStorefrontPageFamilyId;
  requiredAsset?: "none" | "required-region" | "optional-region";
  terminalResolution?: "omit-region" | "fail-closed";
  substitutions?: readonly PageBlueprintV2CandidateReference[];
}>;

function candidate(options: CandidateOptions): PageBlueprintV2CandidateAuthorityV1 {
  const pageFamilyId = options.pageFamilyId ?? "home";
  const requiredRegions = minimumRoles[pageFamilyId].map((role, index) => ({
    id: `${role}-${index + 1}`,
    role,
    requirement: "required" as const,
    cardinality: { minimum: 1, ideal: 1, maximum: 1 },
    visualWeight: index === 0 ? ("heavy" as const) : ("medium" as const),
  }));
  const usesOptionalAsset = options.requiredAsset === "optional-region";
  const assetRegion = usesOptionalAsset
    ? {
        id: "asset-region",
        role: "brand-story" as const,
        requirement: "optional" as const,
        cardinality: { minimum: 0, ideal: 1, maximum: 1 },
        visualWeight: "medium" as const,
      }
    : undefined;
  const regions = assetRegion ? [...requiredRegions, assetRegion] : requiredRegions;
  const assetRegionId = usesOptionalAsset ? "asset-region" : requiredRegions[0].id;
  const hasRequiredAsset = options.requiredAsset !== undefined && options.requiredAsset !== "none";
  const regionAssetRequirements = hasRequiredAsset
    ? [
        {
          regionId: assetRegionId,
          roleRequirements: [
            {
              role: "heroDesktop" as const,
              requirement: "required" as const,
              cardinality: { minimum: 1, ideal: 1, maximum: 2 },
            },
          ],
        },
      ]
    : [];
  return createPageBlueprintV2CandidateAuthority({
    candidateSchemaVersion: "1.0.0",
    structural: {
      id: options.id,
      version: "1.0.0",
      pageFamilyId,
      regions,
      relationships: [],
      orderAlternatives: [{ id: "default-order", regionIds: regions.map(({ id }) => id) }],
      defaultOrderAlternativeId: "default-order",
    },
    assetRoleCompatibility: {
      contractSchemaVersion: "1.0.0",
      blueprintId: options.id,
      blueprintVersion: "1.0.0",
      regionAssetRequirements,
    },
    responsiveRules: {
      contractSchemaVersion: "1.0.0",
      blueprintId: options.id,
      blueprintVersion: "1.0.0",
      breakpointRules: [
        ["mobile", 375],
        ["tablet", 768],
        ["desktop", 1024],
        ["wide", 1440],
      ].map(([breakpoint, viewport]) => ({
        breakpoint,
        viewport,
        orderAlternativeId: "default-order",
        regionProportionRules: regions.map(({ id }) => ({
          regionId: id,
          proportionMode: "preserve",
        })),
        relationshipTransformations: [],
      })),
    },
    omissionSubstitutionFallback: {
      contractSchemaVersion: "1.0.0",
      blueprintId: options.id,
      blueprintVersion: "1.0.0",
      blueprintSubstitutionCandidates: options.substitutions ?? [],
      regionFallbackRules: hasRequiredAsset
        ? [
            {
              regionId: assetRegionId,
              trigger: "required-asset-role-cardinality-unsatisfied",
              terminalResolution: options.terminalResolution ?? "fail-closed",
            },
          ]
        : [],
    },
  });
}

function multiAssetCandidate(): PageBlueprintV2CandidateAuthorityV1 {
  const regions = [
    ...minimumRoles.home.map((role, index) => ({
      id: `${role}-${index + 1}`,
      role,
      requirement: "required" as const,
      cardinality: { minimum: 1, ideal: 1, maximum: 1 },
      visualWeight: index === 0 ? ("heavy" as const) : ("medium" as const),
    })),
    {
      id: "asset-alpha",
      role: "brand-story" as const,
      requirement: "optional" as const,
      cardinality: { minimum: 0, ideal: 1, maximum: 1 },
      visualWeight: "medium" as const,
    },
    {
      id: "asset-beta",
      role: "education" as const,
      requirement: "optional" as const,
      cardinality: { minimum: 0, ideal: 1, maximum: 1 },
      visualWeight: "light" as const,
    },
  ];
  return createPageBlueprintV2CandidateAuthority({
    candidateSchemaVersion: "1.0.0",
    structural: {
      id: "home-multi-asset",
      version: "1.0.0",
      pageFamilyId: "home",
      regions,
      relationships: [],
      orderAlternatives: [{ id: "default-order", regionIds: regions.map(({ id }) => id) }],
      defaultOrderAlternativeId: "default-order",
    },
    assetRoleCompatibility: {
      contractSchemaVersion: "1.0.0",
      blueprintId: "home-multi-asset",
      blueprintVersion: "1.0.0",
      regionAssetRequirements: [
        {
          regionId: "asset-beta",
          roleRequirements: [
            {
              role: "editorialImage",
              requirement: "required",
              cardinality: { minimum: 2, ideal: 2, maximum: 3 },
            },
          ],
        },
        {
          regionId: "asset-alpha",
          roleRequirements: [
            {
              role: "heroMobile",
              requirement: "required",
              cardinality: { minimum: 2, ideal: 2, maximum: 3 },
            },
            {
              role: "logo",
              requirement: "required",
              cardinality: { minimum: 1, ideal: 1, maximum: 2 },
            },
          ],
        },
      ],
    },
    responsiveRules: {
      contractSchemaVersion: "1.0.0",
      blueprintId: "home-multi-asset",
      blueprintVersion: "1.0.0",
      breakpointRules: [
        ["mobile", 375],
        ["tablet", 768],
        ["desktop", 1024],
        ["wide", 1440],
      ].map(([breakpoint, viewport]) => ({
        breakpoint,
        viewport,
        orderAlternativeId: "default-order",
        regionProportionRules: regions.map(({ id }) => ({
          regionId: id,
          proportionMode: "preserve",
        })),
        relationshipTransformations: [],
      })),
    },
    omissionSubstitutionFallback: {
      contractSchemaVersion: "1.0.0",
      blueprintId: "home-multi-asset",
      blueprintVersion: "1.0.0",
      blueprintSubstitutionCandidates: [],
      regionFallbackRules: ["asset-beta", "asset-alpha"].map((regionId) => ({
        regionId,
        trigger: "required-asset-role-cardinality-unsatisfied",
        terminalResolution: "omit-region",
      })),
    },
  });
}

const reference = (
  value: PageBlueprintV2CandidateAuthorityV1,
): PageBlueprintV2CandidateReference => ({
  blueprintId: value.structural.id,
  blueprintVersion: value.structural.version,
});

function family(
  familyId: StructuralStorefrontFamilyId,
  candidates: readonly PageBlueprintV2CandidateAuthorityV1[],
  homeCandidates: readonly PageBlueprintV2CandidateAuthorityV1[],
): StructuralStorefrontFamilyCandidateV1 {
  return createStructuralStorefrontFamilyCandidate({
    candidateSchemaVersion: "1.0.0",
    familyId,
    familyVersion: "1.0.0",
    lifecycleState: "candidate",
    pageFamilyProfiles: structuralStorefrontPageFamilyIds.map((pageFamilyId) => ({
      pageFamilyId,
      blueprintCandidates:
        pageFamilyId === "home"
          ? homeCandidates.map(reference)
          : [
              reference(
                candidates.find((entry) => entry.structural.pageFamilyId === pageFamilyId)!,
              ),
            ],
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

const allSupportedPolicies = () =>
  [
    {
      dimension: "catalogue-cardinality",
      supportedValues: ["sparse", "standard", "rich"],
      incompatibleValues: [],
    },
    {
      dimension: "fact-depth",
      supportedValues: ["sparse", "standard", "rich"],
      incompatibleValues: [],
    },
    {
      dimension: "product-complexity",
      supportedValues: ["simple", "configurable", "mixed"],
      incompatibleValues: [],
    },
    {
      dimension: "navigation-depth",
      supportedValues: ["shallow", "standard", "deep"],
      incompatibleValues: [],
    },
    { dimension: "locale", supportedValues: ["en", "fi"], incompatibleValues: [] },
  ] as const;

function fixture() {
  const pageCandidates = structuralStorefrontPageFamilyIds
    .filter((pageFamilyId) => pageFamilyId !== "home")
    .map((pageFamilyId) => candidate({ id: `${pageFamilyId}-direct`, pageFamilyId }));
  const omit = candidate({
    id: "home-omit",
    requiredAsset: "optional-region",
    terminalResolution: "omit-region",
  });
  const fail = candidate({
    id: "home-fail",
    requiredAsset: "required-region",
    terminalResolution: "fail-closed",
  });
  const direct = candidate({
    id: "home-direct",
    requiredAsset: "optional-region",
    substitutions: [reference(fail), reference(omit)],
  });
  const middle = candidate({
    id: "home-middle",
    requiredAsset: "optional-region",
    terminalResolution: "omit-region",
    substitutions: [reference(omit)],
  });
  const source = candidate({
    id: "home-source",
    requiredAsset: "optional-region",
    terminalResolution: "omit-region",
    substitutions: [reference(middle), reference(direct), reference(omit), reference(fail)],
  });
  const multi = multiAssetCandidate();
  const allCandidates = [...pageCandidates, direct, omit, fail, middle, source, multi];
  const families = [
    family("editorial-offset", allCandidates, [source, direct, omit]),
    family("campaign-modular", allCandidates, [source]),
    family("product-first-commerce", allCandidates, [fail]),
  ];
  const registry: InactiveStructuralStorefrontFamilyCandidateRegistryV1 =
    storefrontTemplateAuthority.canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry({
      contractSchemaVersion: "1.0.0",
      pageBlueprintCandidates: allCandidates,
      familyCandidates: families,
    });
  const capacities = new Map([
    ["home-direct@1.0.0", 1],
    ["home-omit@1.0.0", 0],
    ["home-fail@1.0.0", 0],
    ["home-middle@1.0.0", 0],
    ["home-source@1.0.0", 0],
  ]);
  const capabilityContext = createStructuralStorefrontCapabilityContext(registry, {
    contextSchemaVersion: "1.0.0",
    catalogueCardinality: "standard",
    factDepth: "standard",
    productComplexity: "mixed",
    navigationDepth: "standard",
    activeLocale: "en",
    availableLocales: ["en", "fi"],
    pageBlueprintAssetRoleCapacityEvidence: registry.pageBlueprintCandidates.map((entry) => ({
      blueprintId: entry.structural.id,
      blueprintVersion: entry.structural.version,
      exactCandidateFingerprint: entry.candidateFingerprint,
      requiredRoleCapacities: entry.assetRoleCompatibility.regionAssetRequirements.flatMap(
        ({ regionId, roleRequirements }) =>
          roleRequirements
            .filter(({ requirement }) => requirement === "required")
            .map(({ role }) => ({
              regionId,
              role,
              satisfiableMinimumCapacity:
                capacities.get(`${entry.structural.id}@${entry.structural.version}`) ?? 0,
            })),
      ),
    })),
  });
  const profiles = families.map((entry) =>
    createStructuralStorefrontFamilyCompatibilityProfile(entry, {
      profileSchemaVersion: "1.0.0",
      familyId: entry.familyId,
      familyVersion: entry.familyVersion,
      exactFamilyCandidateFingerprint: entry.candidateFingerprint,
      conditionPolicies: allSupportedPolicies(),
    }),
  );
  const compatibilityProfileCatalogue =
    createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion: "1.0.0",
      profiles: [...profiles].reverse(),
    });
  const normalizedTopologyIndex = deriveInactiveCandidateNormalizedTopologyIndex(registry);
  const authority = {
    candidateRegistry: registry,
    normalizedTopologyIndex,
    capabilityContext,
    compatibilityProfileCatalogue,
  };
  return {
    authority,
    registry,
    families,
    profiles,
    capabilityContext,
    compatibilityProfileCatalogue,
    normalizedTopologyIndex,
  };
}

function deeplyFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value as Record<string, unknown>).every((child) => deeplyFrozen(child, seen))
  );
}

function objectKeys(value: unknown, keys = new Set<string>()): ReadonlySet<string> {
  if (value === null || typeof value !== "object") return keys;
  if (Array.isArray(value)) value.forEach((entry) => objectKeys(entry, keys));
  else
    Object.entries(value).forEach(([key, entry]) => {
      keys.add(key);
      objectKeys(entry, keys);
    });
  return keys;
}

describe("P10B-19A-08B PageBlueprint compatibility evaluation", () => {
  it("owns the exact ordered statuses and terminal dispositions", () => {
    expect(pageBlueprintV2CandidateCompatibilityStatuses).toStrictEqual([
      "directly-compatible",
      "substitution-compatible",
      "omission-compatible",
      "incompatible",
    ]);
    expect(pageBlueprintV2CandidateCompatibilityTerminalDispositions).toStrictEqual([
      "not-needed",
      "substitution-candidates-available",
      "omit-triggered-regions",
      "fail-closed",
    ]);
  });

  it("evaluates direct, recursive substitution, omission and fail-closed paths", () => {
    const { authority, registry } = fixture();
    const before = JSON.stringify(registry.pageBlueprintCandidates);
    const evaluation = evaluateInactiveStructuralStorefrontCandidateCompatibility(authority);
    const byIdentity = new Map(
      evaluation.pageBlueprintEvaluations.map((entry) => [entry.candidateIdentityKey, entry]),
    );
    expect(byIdentity.get("home-direct@1.0.0")).toMatchObject({
      status: "directly-compatible",
      terminalDisposition: "not-needed",
      triggeredRegionIds: [],
      compatibleSubstitutionCandidateIdentityKeys: [],
    });
    expect(byIdentity.get("collection-direct@1.0.0")).toMatchObject({
      status: "directly-compatible",
      requiredRoleEvaluations: [],
      triggeredRegionIds: [],
    });
    expect(byIdentity.get("home-omit@1.0.0")).toMatchObject({
      status: "omission-compatible",
      terminalDisposition: "omit-triggered-regions",
      triggeredRegionIds: ["asset-region"],
    });
    expect(byIdentity.get("home-fail@1.0.0")).toMatchObject({
      status: "incompatible",
      terminalDisposition: "fail-closed",
    });
    expect(byIdentity.get("home-middle@1.0.0")).toMatchObject({
      status: "substitution-compatible",
      compatibleSubstitutionCandidateIdentityKeys: ["home-omit@1.0.0"],
    });
    expect(byIdentity.get("home-source@1.0.0")).toMatchObject({
      status: "substitution-compatible",
      compatibleSubstitutionCandidateIdentityKeys: [
        "home-middle@1.0.0",
        "home-direct@1.0.0",
        "home-omit@1.0.0",
      ],
    });
    expect(byIdentity.get("home-multi-asset@1.0.0")).toMatchObject({
      status: "omission-compatible",
      terminalDisposition: "omit-triggered-regions",
      triggeredRegionIds: ["asset-alpha", "asset-beta"],
      requiredRoleEvaluations: [
        {
          regionId: "asset-alpha",
          role: "logo",
          requiredMinimum: 1,
          satisfiableMinimumCapacity: 0,
          satisfied: false,
        },
        {
          regionId: "asset-alpha",
          role: "heroMobile",
          requiredMinimum: 2,
          satisfiableMinimumCapacity: 0,
          satisfied: false,
        },
        {
          regionId: "asset-beta",
          role: "editorialImage",
          requiredMinimum: 2,
          satisfiableMinimumCapacity: 0,
          satisfied: false,
        },
      ],
    });
    expect(byIdentity.get("home-direct@1.0.0")?.requiredRoleEvaluations[0]).toMatchObject({
      requiredMinimum: 1,
      satisfiableMinimumCapacity: 1,
      satisfied: true,
    });
    evaluation.pageBlueprintEvaluations.forEach((entry) =>
      expect(entry.normalizedTopologyFingerprint).toBe(
        authority.normalizedTopologyIndex.pageBlueprintEntries.find(
          ({ candidateIdentityKey }) => candidateIdentityKey === entry.candidateIdentityKey,
        )?.normalizedTopology.topologyFingerprint,
      ),
    );
    expect(byIdentity.get("home-direct@1.0.0")?.normalizedTopologyFingerprint).toBe(
      byIdentity.get("home-omit@1.0.0")?.normalizedTopologyFingerprint,
    );
    expect(byIdentity.get("home-direct@1.0.0")?.status).not.toBe(
      byIdentity.get("home-omit@1.0.0")?.status,
    );
    expect(JSON.stringify(registry.pageBlueprintCandidates)).toBe(before);
  });

  it("treats capacity above the required minimum as directly compatible", () => {
    const state = fixture();
    const capabilityContext = createStructuralStorefrontCapabilityContext(state.registry, {
      contextSchemaVersion: "1.0.0",
      catalogueCardinality: state.capabilityContext.catalogueCardinality,
      factDepth: state.capabilityContext.factDepth,
      productComplexity: state.capabilityContext.productComplexity,
      navigationDepth: state.capabilityContext.navigationDepth,
      activeLocale: state.capabilityContext.activeLocale,
      availableLocales: state.capabilityContext.availableLocales,
      pageBlueprintAssetRoleCapacityEvidence:
        state.capabilityContext.pageBlueprintAssetRoleCapacityEvidence.map((entry) => ({
          ...entry,
          requiredRoleCapacities: entry.requiredRoleCapacities.map((capacity) =>
            entry.blueprintId === "home-direct"
              ? { ...capacity, satisfiableMinimumCapacity: capacity.satisfiableMinimumCapacity + 1 }
              : capacity,
          ),
        })),
    });
    const evaluation = evaluateInactiveStructuralStorefrontCandidateCompatibility({
      ...state.authority,
      capabilityContext,
    });
    expect(
      evaluation.pageBlueprintEvaluations.find(
        ({ candidateIdentityKey }) => candidateIdentityKey === "home-direct@1.0.0",
      ),
    ).toMatchObject({
      status: "directly-compatible",
      requiredRoleEvaluations: [
        {
          regionId: "asset-region",
          role: "heroDesktop",
          requiredMinimum: 1,
          satisfiableMinimumCapacity: 2,
          satisfied: true,
        },
      ],
    });
  });
});

describe("P10B-19A-08B Structural Family compatibility evaluation", () => {
  it("reports exact direct, conditional and incompatible family statuses", () => {
    const state = fixture();
    const evaluation = evaluateInactiveStructuralStorefrontCandidateCompatibility(state.authority);
    expect(structuralStorefrontFamilyCandidateCompatibilityStatuses).toStrictEqual([
      "directly-compatible",
      "conditionally-compatible",
      "incompatible",
    ]);
    expect(
      evaluation.familyEvaluations.map(({ candidateIdentityKey, status }) => [
        candidateIdentityKey,
        status,
      ]),
    ).toStrictEqual([
      ["editorial-offset@1.0.0", "directly-compatible"],
      ["campaign-modular@1.0.0", "conditionally-compatible"],
      ["product-first-commerce@1.0.0", "incompatible"],
    ]);
    expect(evaluation.familyEvaluations[0].pageFamilyEvaluations[0]).toMatchObject({
      pageFamilyId: "home",
      candidateStatuses: [
        { candidateIdentityKey: "home-direct@1.0.0", status: "directly-compatible" },
        { candidateIdentityKey: "home-omit@1.0.0", status: "omission-compatible" },
        { candidateIdentityKey: "home-source@1.0.0", status: "substitution-compatible" },
      ],
      directlyCompatibleCandidateIdentityKeys: ["home-direct@1.0.0"],
      conditionallyCompatibleCandidateIdentityKeys: ["home-omit@1.0.0", "home-source@1.0.0"],
      incompatibleCandidateIdentityKeys: [],
    });
    expect(evaluation.familyEvaluations[1].pageFamilyEvaluations[0]).toMatchObject({
      pageFamilyId: "home",
      directlyCompatibleCandidateIdentityKeys: [],
      conditionallyCompatibleCandidateIdentityKeys: ["home-source@1.0.0"],
      incompatibleCandidateIdentityKeys: [],
    });
    expect(evaluation.familyEvaluations[2].incompatiblePageFamilyIds).toStrictEqual(["home"]);
    expect(
      evaluation.familyEvaluations[0].conditionEvaluations.map(({ dimension }) => dimension),
    ).toStrictEqual([
      "catalogue-cardinality",
      "fact-depth",
      "product-complexity",
      "navigation-depth",
      "locale",
    ]);
    expect(
      evaluation.familyEvaluations[0].pageFamilyEvaluations.map(({ pageFamilyId }) => pageFamilyId),
    ).toStrictEqual(structuralStorefrontPageFamilyIds);
    expect(evaluation.familyEvaluations[0].normalizedTopologyFingerprint).toBe(
      state.normalizedTopologyIndex.familyEntries[0].normalizedTopology.topologyFingerprint,
    );
  });

  it("makes an explicit incompatible condition terminal without selecting a family", () => {
    const state = fixture();
    const target = state.families[0];
    const policies = allSupportedPolicies().map((policy) =>
      policy.dimension === "locale"
        ? {
            dimension: "locale" as const,
            supportedValues: ["fi"] as const,
            incompatibleValues: ["en"] as const,
          }
        : policy,
    );
    const changed = createStructuralStorefrontFamilyCompatibilityProfile(target, {
      profileSchemaVersion: "1.0.0",
      familyId: target.familyId,
      familyVersion: target.familyVersion,
      exactFamilyCandidateFingerprint: target.candidateFingerprint,
      conditionPolicies: policies,
    });
    const catalogue = createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion: "1.0.0",
      profiles: [changed, ...state.profiles.slice(1)],
    });
    const evaluation = evaluateInactiveStructuralStorefrontCandidateCompatibility({
      ...state.authority,
      compatibilityProfileCatalogue: catalogue,
    });
    expect(evaluation.familyEvaluations[0]).toMatchObject({
      status: "incompatible",
      incompatibleConditionDimensions: ["locale"],
    });
  });
});

describe("P10B-19A-08B aggregate identity and boundaries", () => {
  it("is deterministic, stale-checked, topology-bound and deeply readonly", () => {
    const state = fixture();
    const first = evaluateInactiveStructuralStorefrontCandidateCompatibility(state.authority);
    const second = evaluateInactiveStructuralStorefrontCandidateCompatibility(state.authority);
    expect(second).toStrictEqual(first);
    expect(first.evaluationFingerprint).toMatch(
      /^structural-storefront-candidate-compatibility-evaluation-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(
      parseStructuralStorefrontCandidateCompatibilityEvaluation(state.authority, first),
    ).toStrictEqual(first);
    expect(deeplyFrozen(first)).toBe(true);
    expect(() =>
      parseStructuralStorefrontCandidateCompatibilityEvaluation(state.authority, {
        ...first,
        evaluationFingerprint: first.evaluationFingerprint.replace(/[a-f0-9]$/u, (value) =>
          value === "0" ? "1" : "0",
        ),
      }),
    ).toThrow(/stale|noncanonical/iu);
    expect(() =>
      evaluateInactiveStructuralStorefrontCandidateCompatibility({
        ...state.authority,
        normalizedTopologyIndex: { ...state.normalizedTopologyIndex, familyEntries: [] },
      }),
    ).toThrow(/topology/iu);
    expect(() =>
      evaluateInactiveStructuralStorefrontCandidateCompatibility({
        ...state.authority,
        normalizedTopologyIndex: {
          ...state.normalizedTopologyIndex,
          unexpected: undefined,
        },
      }),
    ).toThrow(/topology/iu);
    for (const invalid of [
      { ...first, evaluationSchemaVersion: "1.0.1" },
      { ...first, selectedCandidateIdentityKey: "home-direct@1.0.0" },
      { ...first, pageBlueprintEvaluations: [...first.pageBlueprintEvaluations].reverse() },
    ]) {
      expect(() =>
        parseStructuralStorefrontCandidateCompatibilityEvaluation(state.authority, invalid),
      ).toThrow();
    }
  });

  it("changes identity with context or profile material but not canonicalizable input order", () => {
    const state = fixture();
    const baseline = evaluateInactiveStructuralStorefrontCandidateCompatibility(state.authority);
    const contextMaterial = {
      contextSchemaVersion: "1.0.0" as const,
      catalogueCardinality: "standard" as const,
      factDepth: "rich" as const,
      productComplexity: "mixed" as const,
      navigationDepth: "standard" as const,
      activeLocale: "en" as const,
      availableLocales: ["fi", "en"] as const,
      pageBlueprintAssetRoleCapacityEvidence: [
        ...state.capabilityContext.pageBlueprintAssetRoleCapacityEvidence,
      ].reverse(),
    };
    const changedContext = createStructuralStorefrontCapabilityContext(
      state.registry,
      contextMaterial,
    );
    const changed = evaluateInactiveStructuralStorefrontCandidateCompatibility({
      ...state.authority,
      capabilityContext: changedContext,
    });
    expect(changed.evaluationFingerprint).not.toBe(baseline.evaluationFingerprint);
    const sameContext = createStructuralStorefrontCapabilityContext(state.registry, {
      ...contextMaterial,
      factDepth: "standard",
    });
    const sameCatalogue = createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion: "1.0.0",
      profiles: [...state.profiles].reverse(),
    });
    expect(
      evaluateInactiveStructuralStorefrontCandidateCompatibility({
        ...state.authority,
        capabilityContext: sameContext,
        compatibilityProfileCatalogue: sameCatalogue,
      }).evaluationFingerprint,
    ).toBe(baseline.evaluationFingerprint);

    const target = state.families[0];
    const changedProfile = createStructuralStorefrontFamilyCompatibilityProfile(target, {
      profileSchemaVersion: "1.0.0",
      familyId: target.familyId,
      familyVersion: target.familyVersion,
      exactFamilyCandidateFingerprint: target.candidateFingerprint,
      conditionPolicies: allSupportedPolicies().map((policy) =>
        policy.dimension === "fact-depth"
          ? {
              dimension: "fact-depth" as const,
              supportedValues: ["sparse", "standard"] as const,
              incompatibleValues: ["rich"] as const,
            }
          : policy,
      ),
    });
    const changedCatalogue = createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion: "1.0.0",
      profiles: [changedProfile, ...state.profiles.slice(1)],
    });
    const changedProfileEvaluation = evaluateInactiveStructuralStorefrontCandidateCompatibility({
      ...state.authority,
      compatibilityProfileCatalogue: changedCatalogue,
    });
    expect(changedProfileEvaluation.profileCatalogueFingerprint).not.toBe(
      baseline.profileCatalogueFingerprint,
    );
    expect(changedProfileEvaluation.evaluationFingerprint).not.toBe(baseline.evaluationFingerprint);
  });

  it("keeps production authority empty and exports no context, evaluation or selection record", () => {
    const context = createStructuralStorefrontCapabilityContext(
      inactiveStructuralStorefrontFamilyCandidateRegistry,
      {
        contextSchemaVersion: "1.0.0",
        catalogueCardinality: "sparse",
        factDepth: "sparse",
        productComplexity: "simple",
        navigationDepth: "shallow",
        activeLocale: "en",
        availableLocales: ["en"],
        pageBlueprintAssetRoleCapacityEvidence: [],
      },
    );
    const authority = {
      candidateRegistry: inactiveStructuralStorefrontFamilyCandidateRegistry,
      normalizedTopologyIndex: deriveInactiveCandidateNormalizedTopologyIndex(
        inactiveStructuralStorefrontFamilyCandidateRegistry,
      ),
      capabilityContext: context,
      compatibilityProfileCatalogue:
        inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
    };
    const evaluation = evaluateInactiveStructuralStorefrontCandidateCompatibility(authority);
    expect(evaluation.pageBlueprintEvaluations).toStrictEqual([]);
    expect(evaluation.familyEvaluations).toStrictEqual([]);
    expect(inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue.profiles).toStrictEqual(
      [],
    );
    const recordExports = Object.entries(storefrontTemplateAuthority).filter(
      ([, value]) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (Object.hasOwn(value, "contextFingerprint") ||
          Object.hasOwn(value, "evaluationFingerprint")),
    );
    expect(recordExports).toStrictEqual([]);
  });

  it("contains no scoring, ranking, winner, selected-candidate or receipt output", () => {
    const evaluation = evaluateInactiveStructuralStorefrontCandidateCompatibility(
      fixture().authority,
    );
    const keys = [...objectKeys(evaluation)];
    [
      "score",
      "rank",
      "weight",
      "priority",
      "selected",
      "preferred",
      "winner",
      "selectionReceipt",
    ].forEach((forbidden) => expect(keys).not.toContain(forbidden));
  });
});
