import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import * as storefrontTemplateAuthority from "@/application/storefront-templates";
import {
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
  createPageBlueprintV2CandidateAuthority,
  createStructuralStorefrontCapabilityContext,
  createStructuralStorefrontFamilyCandidate,
  createStructuralStorefrontFamilyCompatibilityProfile,
  deriveInactiveCandidateNormalizedTopologyIndex,
  evaluateInactiveStructuralStorefrontCandidateCompatibility,
  inactiveStructuralStorefrontFamilyCandidateRegistry,
  inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
  type InactiveStructuralStorefrontFamilyCandidateRegistryV1,
  type PageBlueprintV2CandidateAuthorityV1,
  type PageBlueprintV2CandidateReference,
  type StructuralStorefrontDeterministicSelectionInput,
  type StructuralStorefrontDeterministicSelectionRequestV1,
  type StructuralStorefrontFamilyCandidateV1,
} from "@/application/storefront-templates";
import {
  StructuralStorefrontDeterministicSelectionError,
  createStructuralStorefrontDeterministicSelectionRequest,
  structuralStorefrontFamilyCompatibilityPrecedence,
  structuralStorefrontPageBlueprintCompatibilityPrecedence,
} from "@/application/storefront-templates/structural-storefront-selection-contract";
import {
  parseStructuralStorefrontDeterministicSelectionReceipt,
  selectDeterministicStructuralStorefrontCandidate,
} from "@/application/storefront-templates/structural-storefront-deterministic-selection";
import { canonicalValueFingerprint } from "@/domain/storefront";
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
  pageFamilyId: StructuralStorefrontPageFamilyId;
  assetMode?: "none" | "optional" | "required";
  terminalResolution?: "omit-region" | "fail-closed";
  substitutions?: readonly PageBlueprintV2CandidateReference[];
  structuralVariant?: "base" | "alternate";
  optionalAssetRegionIds?: readonly string[];
}>;

function candidate(options: CandidateOptions): PageBlueprintV2CandidateAuthorityV1 {
  const requiredRegions = minimumRoles[options.pageFamilyId].map((role, index) => ({
    id: `${role}-${index + 1}`,
    role,
    requirement: "required" as const,
    cardinality: { minimum: 1, ideal: 1, maximum: 1 },
    visualWeight:
      options.structuralVariant === "alternate" && index === 0
        ? ("dominant" as const)
        : index === 0
          ? ("heavy" as const)
          : ("medium" as const),
  }));
  const optionalAssetRegions =
    options.assetMode === "optional"
      ? (options.optionalAssetRegionIds ?? ["asset-region"]).map((id, index) => ({
          id,
          role: index === 0 ? ("brand-story" as const) : ("education" as const),
          requirement: "optional" as const,
          cardinality: { minimum: 0, ideal: 1, maximum: 1 },
          visualWeight: "medium" as const,
        }))
      : [];
  const regions = [...requiredRegions, ...optionalAssetRegions];
  const hasAsset = options.assetMode !== undefined && options.assetMode !== "none";
  const assetRegionIds =
    optionalAssetRegions.length > 0
      ? optionalAssetRegions.map(({ id }) => id)
      : [requiredRegions[0].id];
  return createPageBlueprintV2CandidateAuthority({
    candidateSchemaVersion: "1.0.0",
    structural: {
      id: options.id,
      version: "1.0.0",
      pageFamilyId: options.pageFamilyId,
      regions,
      relationships: [],
      orderAlternatives: [{ id: "default-order", regionIds: regions.map(({ id }) => id) }],
      defaultOrderAlternativeId: "default-order",
    },
    assetRoleCompatibility: {
      contractSchemaVersion: "1.0.0",
      blueprintId: options.id,
      blueprintVersion: "1.0.0",
      regionAssetRequirements: hasAsset
        ? assetRegionIds.map((regionId, index) => ({
            regionId,
            roleRequirements: [
              {
                role: index === 0 ? ("heroDesktop" as const) : ("editorialImage" as const),
                requirement: "required" as const,
                cardinality: { minimum: 1, ideal: 1, maximum: 1 },
              },
            ],
          }))
        : [],
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
      regionFallbackRules: hasAsset
        ? assetRegionIds.map((regionId) => ({
            regionId,
            trigger: "required-asset-role-cardinality-unsatisfied" as const,
            terminalResolution: options.terminalResolution ?? "fail-closed",
          }))
        : [],
    },
  });
}

function reference(value: PageBlueprintV2CandidateAuthorityV1): PageBlueprintV2CandidateReference {
  return {
    blueprintId: value.structural.id,
    blueprintVersion: value.structural.version,
  };
}

type FamilySpec = Readonly<{
  familyId: StructuralStorefrontFamilyId;
  pageCandidates: Readonly<
    Partial<
      Record<StructuralStorefrontPageFamilyId, readonly PageBlueprintV2CandidateAuthorityV1[]>
    >
  >;
  relationshipKind?: "frame-continuity" | "hierarchy-continuity" | "recurring-anchor";
}>;

function family(spec: FamilySpec): StructuralStorefrontFamilyCandidateV1 {
  return createStructuralStorefrontFamilyCandidate({
    candidateSchemaVersion: "1.0.0",
    familyId: spec.familyId,
    familyVersion: "1.0.0",
    lifecycleState: "candidate",
    pageFamilyProfiles: structuralStorefrontPageFamilyIds.map((pageFamilyId) => ({
      pageFamilyId,
      blueprintCandidates: (spec.pageCandidates[pageFamilyId] ?? []).map(reference),
    })),
    crossPageRelationships: [
      {
        sourcePageFamilyId: "home",
        relationshipKind: spec.relationshipKind ?? "frame-continuity",
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

type State = Readonly<{
  registry: InactiveStructuralStorefrontFamilyCandidateRegistryV1;
  families: readonly StructuralStorefrontFamilyCandidateV1[];
  normalizedTopologyIndex: ReturnType<typeof deriveInactiveCandidateNormalizedTopologyIndex>;
  capabilityContext: ReturnType<typeof createStructuralStorefrontCapabilityContext>;
  compatibilityProfileCatalogue: ReturnType<
    typeof createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue
  >;
  compatibilityEvaluation: ReturnType<
    typeof evaluateInactiveStructuralStorefrontCandidateCompatibility
  >;
}>;

function stateFrom(
  candidates: readonly PageBlueprintV2CandidateAuthorityV1[],
  familySpecs: readonly FamilySpec[],
  capacities: Readonly<Record<string, number>> = {},
): State {
  const families = familySpecs.map(family);
  const registry = canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry({
    contractSchemaVersion: "1.0.0",
    pageBlueprintCandidates: candidates,
    familyCandidates: families,
  });
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
                capacities[`${entry.structural.id}@${entry.structural.version}`] ?? 0,
            })),
      ),
    })),
  });
  const compatibilityProfileCatalogue =
    createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion: "1.0.0",
      profiles: families.map((entry) =>
        createStructuralStorefrontFamilyCompatibilityProfile(entry, {
          profileSchemaVersion: "1.0.0",
          familyId: entry.familyId,
          familyVersion: entry.familyVersion,
          exactFamilyCandidateFingerprint: entry.candidateFingerprint,
          conditionPolicies: allSupportedPolicies(),
        }),
      ),
    });
  const normalizedTopologyIndex = deriveInactiveCandidateNormalizedTopologyIndex(registry);
  const evaluationAuthority = {
    candidateRegistry: registry,
    normalizedTopologyIndex,
    capabilityContext,
    compatibilityProfileCatalogue,
  };
  const compatibilityEvaluation =
    evaluateInactiveStructuralStorefrontCandidateCompatibility(evaluationAuthority);
  return {
    registry,
    families,
    normalizedTopologyIndex,
    capabilityContext,
    compatibilityProfileCatalogue,
    compatibilityEvaluation,
  };
}

function requestFor(
  state: State,
  input: Partial<StructuralStorefrontDeterministicSelectionRequestV1> &
    Pick<StructuralStorefrontDeterministicSelectionRequestV1, "eligibleFamilyIds">,
): StructuralStorefrontDeterministicSelectionRequestV1 {
  return createStructuralStorefrontDeterministicSelectionRequest(
    state.compatibilityEvaluation.evaluationFingerprint,
    {
      requestSchemaVersion: "1.0.0",
      selectionPolicyVersion: "1.0.0",
      selectionCaseId: "test-case-001",
      compatibilityEvaluationFingerprint: state.compatibilityEvaluation.evaluationFingerprint,
      excludedFamilyCandidateIdentityKeys: [],
      excludedFamilyTopologyFingerprints: [],
      excludedCompleteStoreTopologyFingerprints: [],
      ...input,
    },
  );
}

function inputFor(
  state: State,
  request: StructuralStorefrontDeterministicSelectionRequestV1,
  overrides: Partial<StructuralStorefrontDeterministicSelectionInput> = {},
): StructuralStorefrontDeterministicSelectionInput {
  return {
    candidateRegistry: state.registry,
    normalizedTopologyIndex: state.normalizedTopologyIndex,
    capabilityContext: state.capabilityContext,
    compatibilityProfileCatalogue: state.compatibilityProfileCatalogue,
    compatibilityEvaluation: state.compatibilityEvaluation,
    selectionRequest: request,
    ...overrides,
  };
}

function expectSelectionError(action: () => unknown, code: string, count?: number): void {
  try {
    action();
    throw new Error("Expected selection to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(StructuralStorefrontDeterministicSelectionError);
    expect((error as StructuralStorefrontDeterministicSelectionError).code).toBe(code);
    if (count !== undefined) {
      expect((error as StructuralStorefrontDeterministicSelectionError).details).toMatchObject({
        evaluatedCombinationCount: count,
      });
    }
  }
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
    Object.entries(value).forEach(([key, child]) => {
      keys.add(key);
      objectKeys(child, keys);
    });
  return keys;
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? collectTypeScriptFiles(path)
      : entry.isFile() && /\.tsx?$/u.test(entry.name)
        ? [path]
        : [];
  });
}

function standardFixture(): State {
  const shared = structuralStorefrontPageFamilyIds
    .filter((pageFamilyId) => pageFamilyId !== "home")
    .map((pageFamilyId) => candidate({ id: `${pageFamilyId}-direct`, pageFamilyId }));
  const omit = candidate({
    id: "home-omit",
    pageFamilyId: "home",
    assetMode: "optional",
    terminalResolution: "omit-region",
  });
  const fail = candidate({
    id: "home-fail",
    pageFamilyId: "home",
    assetMode: "required",
    terminalResolution: "fail-closed",
  });
  const direct = candidate({
    id: "home-direct",
    pageFamilyId: "home",
    assetMode: "optional",
    substitutions: [reference(fail), reference(omit)],
  });
  const middle = candidate({
    id: "home-middle",
    pageFamilyId: "home",
    assetMode: "optional",
    terminalResolution: "omit-region",
    substitutions: [reference(omit)],
  });
  const source = candidate({
    id: "home-source",
    pageFamilyId: "home",
    assetMode: "optional",
    terminalResolution: "omit-region",
    substitutions: [reference(middle), reference(direct), reference(omit), reference(fail)],
  });
  const byPage = Object.fromEntries(
    shared.map((entry) => [entry.structural.pageFamilyId, [entry]]),
  );
  const all = [...shared, omit, fail, direct, middle, source];
  return stateFrom(
    all,
    [
      {
        familyId: "editorial-offset",
        pageCandidates: { ...byPage, home: [source, direct, omit] },
      },
      {
        familyId: "campaign-modular",
        pageCandidates: { ...byPage, home: [source] },
        relationshipKind: "hierarchy-continuity",
      },
      {
        familyId: "technical-comparison",
        pageCandidates: { ...byPage, home: [source, omit] },
        relationshipKind: "recurring-anchor",
      },
      {
        familyId: "product-first-commerce",
        pageCandidates: { ...byPage, home: [fail] },
      },
    ],
    { "home-direct@1.0.0": 1 },
  );
}

describe("P10B-19A-08C compatibility precedence and family eligibility", () => {
  it("owns the exact typed safety-class precedence", () => {
    expect(structuralStorefrontFamilyCompatibilityPrecedence).toStrictEqual([
      "directly-compatible",
      "conditionally-compatible",
    ]);
    expect(structuralStorefrontPageBlueprintCompatibilityPrecedence).toStrictEqual([
      "directly-compatible",
      "substitution-compatible",
      "omission-compatible",
    ]);
  });

  it("selects a direct family before a conditional family and never selects incompatible", () => {
    const state = standardFixture();
    const selected = selectDeterministicStructuralStorefrontCandidate(
      inputFor(
        state,
        requestFor(state, {
          eligibleFamilyIds: ["editorial-offset", "campaign-modular", "product-first-commerce"],
        }),
      ),
    );
    expect(selected.selectedFamilyCandidate).toMatchObject({
      familyId: "editorial-offset",
      compatibilityStatus: "directly-compatible",
    });
    expect(selected.pageFamilySelections).toHaveLength(6);
    expect(selected.pageFamilySelections.map(({ pageFamilyId }) => pageFamilyId)).toStrictEqual(
      structuralStorefrontPageFamilyIds,
    );
    expect(selected.pageFamilySelections[0]).toMatchObject({
      sourceCandidateIdentityKey: "home-direct@1.0.0",
      sourceCompatibilityStatus: "directly-compatible",
      resolutionMode: "direct",
      substitutionPathCandidateIdentityKeys: [],
      effectiveCandidateIdentityKey: "home-direct@1.0.0",
      terminalCompatibilityStatus: "directly-compatible",
      omittedRegionIds: [],
    });
  });

  it("applies declared family IDs and exact identity and normalized-topology exclusions", () => {
    const state = standardFixture();
    const onlyCampaign = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["campaign-modular"] })),
    );
    expect(onlyCampaign.selectedFamilyCandidate.familyId).toBe("campaign-modular");

    const editorial = state.families.find(({ familyId }) => familyId === "editorial-offset")!;
    const campaign = state.families.find(({ familyId }) => familyId === "campaign-modular")!;
    const editorialTopology = state.normalizedTopologyIndex.familyEntries.find(
      ({ candidateIdentityKey }) => candidateIdentityKey === "editorial-offset@1.0.0",
    )!.normalizedTopology.topologyFingerprint;
    const exactExcluded = selectDeterministicStructuralStorefrontCandidate(
      inputFor(
        state,
        requestFor(state, {
          eligibleFamilyIds: ["editorial-offset", "campaign-modular"],
          excludedFamilyCandidateIdentityKeys: [`${editorial.familyId}@${editorial.familyVersion}`],
        }),
      ),
    );
    expect(exactExcluded.selectedFamilyCandidate.candidateIdentityKey).toBe(
      `${campaign.familyId}@${campaign.familyVersion}`,
    );
    const topologyExcluded = selectDeterministicStructuralStorefrontCandidate(
      inputFor(
        state,
        requestFor(state, {
          eligibleFamilyIds: ["editorial-offset", "campaign-modular"],
          excludedFamilyTopologyFingerprints: [editorialTopology],
        }),
      ),
    );
    expect(topologyExcluded.selectedFamilyCandidate.familyId).toBe("campaign-modular");
  });

  it("distinguishes absent candidates from eligible but incompatible candidates", () => {
    const state = standardFixture();
    expectSelectionError(
      () =>
        selectDeterministicStructuralStorefrontCandidate(
          inputFor(state, requestFor(state, { eligibleFamilyIds: ["warm-narrative"] })),
        ),
      "no-eligible-family-candidates",
    );
    expectSelectionError(
      () =>
        selectDeterministicStructuralStorefrontCandidate(
          inputFor(state, requestFor(state, { eligibleFamilyIds: ["product-first-commerce"] })),
        ),
      "no-compatible-family-candidates",
    );
  });

  it("uses the exact family tie material and is independent of registry input order", () => {
    const common = structuralStorefrontPageFamilyIds.map((pageFamilyId) =>
      candidate({ id: `${pageFamilyId}-base`, pageFamilyId }),
    );
    const byPage = Object.fromEntries(
      common.map((entry) => [entry.structural.pageFamilyId, [entry]]),
    );
    const state = stateFrom(common, [
      { familyId: "editorial-offset", pageCandidates: byPage },
      { familyId: "warm-narrative", pageCandidates: byPage },
    ]);
    const request = requestFor(state, {
      eligibleFamilyIds: ["editorial-offset", "warm-narrative"],
      selectionCaseId: "commercial-alternative",
    });
    const candidates = state.registry.familyCandidates.map((entry) => {
      const topology = state.normalizedTopologyIndex.familyEntries.find(
        ({ candidateIdentityKey }) =>
          candidateIdentityKey === `${entry.familyId}@${entry.familyVersion}`,
      )!;
      return {
        identity: `${entry.familyId}@${entry.familyVersion}`,
        tie: canonicalValueFingerprint({
          selectionPolicyVersion: "1.0.0",
          selectionRequestFingerprint: request.requestFingerprint,
          familyCandidateIdentityKey: `${entry.familyId}@${entry.familyVersion}`,
          exactFamilyCandidateFingerprint: entry.candidateFingerprint,
          familyNormalizedTopologyFingerprint: topology.normalizedTopology.topologyFingerprint,
        }),
      };
    });
    const expected = [...candidates].sort((left, right) =>
      left.tie < right.tie
        ? -1
        : left.tie > right.tie
          ? 1
          : left.identity < right.identity
            ? -1
            : 1,
    )[0].identity;
    const canonical = selectDeterministicStructuralStorefrontCandidate(inputFor(state, request));
    const reversedRegistry = {
      ...state.registry,
      pageBlueprintCandidates: [...state.registry.pageBlueprintCandidates].reverse(),
      familyCandidates: [...state.registry.familyCandidates].reverse(),
    };
    const reordered = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, request, { candidateRegistry: reversedRegistry }),
    );
    expect(canonical.selectedFamilyCandidate.candidateIdentityKey).toBe(expected);
    expect(reordered).toStrictEqual(canonical);
    expect(
      selectDeterministicStructuralStorefrontCandidate(inputFor(state, request)),
    ).toStrictEqual(canonical);
  });
});

describe("P10B-19A-08C page selection and fallback resolution", () => {
  it("orders direct before substitution before omission and excludes incompatible sources", () => {
    const state = standardFixture();
    const editorial = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["editorial-offset"] })),
    );
    const technical = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["technical-comparison"] })),
    );
    expect(editorial.pageFamilySelections[0].sourceCandidateIdentityKey).toBe("home-direct@1.0.0");
    expect(technical.pageFamilySelections[0].sourceCandidateIdentityKey).toBe("home-source@1.0.0");
    expect(
      technical.pageFamilySelections.some(
        ({ sourceCandidateIdentityKey }) => sourceCandidateIdentityKey === "home-fail@1.0.0",
      ),
    ).toBe(false);
  });

  it("uses the exact page tie material rather than profile or registry order", () => {
    const alpha = candidate({ id: "home-alpha", pageFamilyId: "home" });
    const zeta = candidate({ id: "home-zeta", pageFamilyId: "home" });
    const rest = structuralStorefrontPageFamilyIds
      .filter((pageFamilyId) => pageFamilyId !== "home")
      .map((pageFamilyId) => candidate({ id: `${pageFamilyId}-base`, pageFamilyId }));
    const byPage = Object.fromEntries(
      rest.map((entry) => [entry.structural.pageFamilyId, [entry]]),
    );
    const state = stateFrom(
      [zeta, ...rest, alpha],
      [
        {
          familyId: "editorial-offset",
          pageCandidates: { ...byPage, home: [zeta, alpha] },
        },
      ],
    );
    const request = requestFor(state, {
      eligibleFamilyIds: ["editorial-offset"],
      selectionCaseId: "exploratory-alternative",
    });
    const familyIdentity = "editorial-offset@1.0.0";
    const expected = [alpha, zeta]
      .map((entry) => ({
        identity: `${entry.structural.id}@${entry.structural.version}`,
        tie: canonicalValueFingerprint({
          selectionPolicyVersion: "1.0.0",
          selectionRequestFingerprint: request.requestFingerprint,
          selectedFamilyCandidateIdentityKey: familyIdentity,
          pageFamilyId: "home",
          pageBlueprintCandidateIdentityKey: `${entry.structural.id}@${entry.structural.version}`,
          exactPageBlueprintCandidateFingerprint: entry.candidateFingerprint,
          pageBlueprintNormalizedTopologyFingerprint:
            state.normalizedTopologyIndex.pageBlueprintEntries.find(
              ({ candidateIdentityKey }) =>
                candidateIdentityKey === `${entry.structural.id}@${entry.structural.version}`,
            )!.normalizedTopology.topologyFingerprint,
        }),
      }))
      .sort((left, right) =>
        left.tie < right.tie
          ? -1
          : left.tie > right.tie
            ? 1
            : left.identity < right.identity
              ? -1
              : 1,
      )[0].identity;
    expect(
      selectDeterministicStructuralStorefrontCandidate(inputFor(state, request))
        .pageFamilySelections[0].sourceCandidateIdentityKey,
    ).toBe(expected);
  });

  it("follows the first compatible A-06 target recursively and retains an omission terminal", () => {
    const state = standardFixture();
    const before = JSON.stringify(state.registry.pageBlueprintCandidates);
    const selected = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["campaign-modular"] })),
    );
    expect(selected.pageFamilySelections[0]).toMatchObject({
      sourceCandidateIdentityKey: "home-source@1.0.0",
      sourceCompatibilityStatus: "substitution-compatible",
      resolutionMode: "substitution",
      substitutionPathCandidateIdentityKeys: ["home-middle@1.0.0", "home-omit@1.0.0"],
      effectiveCandidateIdentityKey: "home-omit@1.0.0",
      terminalCompatibilityStatus: "omission-compatible",
      omittedRegionIds: ["asset-region"],
    });
    expect(selected.pageFamilySelections[0].substitutionPathCandidateIdentityKeys).not.toContain(
      "home-direct@1.0.0",
    );
    expect(JSON.stringify(state.registry.pageBlueprintCandidates)).toBe(before);
    expect(
      Object.keys(selected.pageFamilySelections[0]).some((key) =>
        /material|section|component/iu.test(key),
      ),
    ).toBe(false);
  });

  it("resolves a direct source to itself and a direct substitution terminal without omissions", () => {
    const state = standardFixture();
    const direct = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["editorial-offset"] })),
    ).pageFamilySelections[0];
    expect(direct.sourceCandidateIdentityKey).toBe(direct.effectiveCandidateIdentityKey);
    expect(direct.substitutionPathCandidateIdentityKeys).toStrictEqual([]);
    expect(direct.omittedRegionIds).toStrictEqual([]);

    const target = candidate({
      id: "home-target",
      pageFamilyId: "home",
      assetMode: "optional",
    });
    const source = candidate({
      id: "home-source-only",
      pageFamilyId: "home",
      assetMode: "optional",
      terminalResolution: "omit-region",
      substitutions: [reference(target)],
    });
    const rest = structuralStorefrontPageFamilyIds
      .filter((pageFamilyId) => pageFamilyId !== "home")
      .map((pageFamilyId) => candidate({ id: `${pageFamilyId}-base`, pageFamilyId }));
    const byPage = Object.fromEntries(
      rest.map((entry) => [entry.structural.pageFamilyId, [entry]]),
    );
    const substitutionState = stateFrom(
      [source, target, ...rest],
      [
        {
          familyId: "campaign-modular",
          pageCandidates: { ...byPage, home: [source] },
        },
      ],
      { "home-target@1.0.0": 1 },
    );
    expect(
      selectDeterministicStructuralStorefrontCandidate(
        inputFor(
          substitutionState,
          requestFor(substitutionState, { eligibleFamilyIds: ["campaign-modular"] }),
        ),
      ).pageFamilySelections[0],
    ).toMatchObject({
      resolutionMode: "substitution",
      substitutionPathCandidateIdentityKeys: ["home-target@1.0.0"],
      effectiveCandidateIdentityKey: "home-target@1.0.0",
      terminalCompatibilityStatus: "directly-compatible",
      omittedRegionIds: [],
    });
  });

  it("retains direct omission decisions in A-03 order and maps them to normalized tokens", () => {
    const omission = candidate({
      id: "home-multi-omission",
      pageFamilyId: "home",
      assetMode: "optional",
      terminalResolution: "omit-region",
      optionalAssetRegionIds: ["story-asset", "education-asset"],
    });
    const rest = structuralStorefrontPageFamilyIds
      .filter((pageFamilyId) => pageFamilyId !== "home")
      .map((pageFamilyId) => candidate({ id: `${pageFamilyId}-base`, pageFamilyId }));
    const byPage = Object.fromEntries(
      rest.map((entry) => [entry.structural.pageFamilyId, [entry]]),
    );
    const state = stateFrom(
      [omission, ...rest],
      [
        {
          familyId: "warm-narrative",
          pageCandidates: { ...byPage, home: [omission] },
        },
      ],
    );
    const before = JSON.stringify(omission);
    const receipt = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["warm-narrative"] })),
    );
    expect(receipt.pageFamilySelections[0]).toMatchObject({
      sourceCandidateIdentityKey: "home-multi-omission@1.0.0",
      sourceCompatibilityStatus: "omission-compatible",
      resolutionMode: "omission",
      substitutionPathCandidateIdentityKeys: [],
      effectiveCandidateIdentityKey: "home-multi-omission@1.0.0",
      terminalCompatibilityStatus: "omission-compatible",
      omittedRegionIds: ["story-asset", "education-asset"],
    });
    expect(
      receipt.selectedCompleteStoreTopology.pageFamilyTopologies[0].omittedTopologyRegionIds,
    ).toStrictEqual(["r2", "r3"]);
    expect(JSON.stringify(omission)).toBe(before);
  });

  it("fails stale wrong-family references and contradictory substitution diagnostics closed", () => {
    const state = standardFixture();
    const request = requestFor(state, { eligibleFamilyIds: ["campaign-modular"] });
    const wrongReferenceRegistry = {
      ...state.registry,
      familyCandidates: state.registry.familyCandidates.map((entry) =>
        entry.familyId === "campaign-modular"
          ? {
              ...entry,
              pageFamilyProfiles: entry.pageFamilyProfiles.map((profile) =>
                profile.pageFamilyId === "home"
                  ? {
                      ...profile,
                      blueprintCandidates: [
                        { blueprintId: "collection-direct", blueprintVersion: "1.0.0" },
                      ],
                    }
                  : profile,
              ),
            }
          : entry,
      ),
    };
    expectSelectionError(
      () =>
        selectDeterministicStructuralStorefrontCandidate(
          inputFor(state, request, { candidateRegistry: wrongReferenceRegistry }),
        ),
      "stale-selection-authority",
    );
    const contradictoryEvaluation = {
      ...state.compatibilityEvaluation,
      pageBlueprintEvaluations: state.compatibilityEvaluation.pageBlueprintEvaluations.map(
        (entry) =>
          entry.candidateIdentityKey === "home-source@1.0.0"
            ? { ...entry, compatibleSubstitutionCandidateIdentityKeys: [] }
            : entry,
      ),
    };
    expectSelectionError(
      () =>
        selectDeterministicStructuralStorefrontCandidate(
          inputFor(state, request, { compatibilityEvaluation: contradictoryEvaluation }),
        ),
      "stale-selection-authority",
    );
    expectSelectionError(
      () =>
        selectDeterministicStructuralStorefrontCandidate(
          inputFor(state, request, {
            normalizedTopologyIndex: {
              ...state.normalizedTopologyIndex,
              unexpected: undefined,
            },
          }),
        ),
      "stale-selection-authority",
    );
  });
});

function topologyCapacityFixture(candidateCount: number): State {
  const candidatesByPage = Object.fromEntries(
    structuralStorefrontPageFamilyIds.map((pageFamilyId) => [
      pageFamilyId,
      Array.from({ length: candidateCount }, (_, index) =>
        candidate({ id: `${pageFamilyId}-choice-${index + 1}`, pageFamilyId }),
      ),
    ]),
  ) as Record<StructuralStorefrontPageFamilyId, PageBlueprintV2CandidateAuthorityV1[]>;
  return stateFrom(
    structuralStorefrontPageFamilyIds.flatMap((pageFamilyId) => candidatesByPage[pageFamilyId]),
    [{ familyId: "editorial-offset", pageCandidates: candidatesByPage }],
  );
}

describe("P10B-19A-08C complete-store enumeration and topology", () => {
  it("selects the first deterministic combination and advances after exact topology exclusion", () => {
    const base = structuralStorefrontPageFamilyIds.map((pageFamilyId) =>
      candidate({ id: `${pageFamilyId}-base`, pageFamilyId }),
    );
    const utilityAlternate = candidate({
      id: "utility-alternate",
      pageFamilyId: "utility",
      structuralVariant: "alternate",
    });
    const byPage = Object.fromEntries(
      base.map((entry) => [entry.structural.pageFamilyId, [entry]]),
    );
    const utilityBase = base.find(({ structural }) => structural.pageFamilyId === "utility")!;
    const state = stateFrom(
      [...base, utilityAlternate],
      [
        {
          familyId: "editorial-offset",
          pageCandidates: { ...byPage, utility: [utilityAlternate, utilityBase] },
        },
      ],
    );
    const first = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["editorial-offset"] })),
    );
    const second = selectDeterministicStructuralStorefrontCandidate(
      inputFor(
        state,
        requestFor(state, {
          eligibleFamilyIds: ["editorial-offset"],
          excludedCompleteStoreTopologyFingerprints: [
            first.selectedCompleteStoreTopology.topologyFingerprint,
          ],
        }),
      ),
    );
    expect(second.pageFamilySelections.slice(0, 5)).toStrictEqual(
      first.pageFamilySelections.slice(0, 5),
    );
    expect(second.pageFamilySelections[5].sourceCandidateIdentityKey).not.toBe(
      first.pageFamilySelections[5].sourceCandidateIdentityKey,
    );
    expect(second.selectedCompleteStoreTopology.topologyFingerprint).not.toBe(
      first.selectedCompleteStoreTopology.topologyFingerprint,
    );
  });

  it("advances from an exhausted direct family to a conditional family", () => {
    const target = candidate({
      id: "home-target",
      pageFamilyId: "home",
      assetMode: "optional",
    });
    const source = candidate({
      id: "home-source",
      pageFamilyId: "home",
      assetMode: "optional",
      terminalResolution: "omit-region",
      substitutions: [reference(target)],
    });
    const rest = structuralStorefrontPageFamilyIds
      .filter((pageFamilyId) => pageFamilyId !== "home")
      .map((pageFamilyId) => candidate({ id: `${pageFamilyId}-base`, pageFamilyId }));
    const byPage = Object.fromEntries(
      rest.map((entry) => [entry.structural.pageFamilyId, [entry]]),
    );
    const state = stateFrom(
      [source, target, ...rest],
      [
        {
          familyId: "editorial-offset",
          pageCandidates: { ...byPage, home: [target] },
        },
        {
          familyId: "campaign-modular",
          pageCandidates: { ...byPage, home: [source] },
          relationshipKind: "hierarchy-continuity",
        },
      ],
      { "home-target@1.0.0": 1 },
    );
    const eligibleFamilyIds = ["editorial-offset", "campaign-modular"] as const;
    const first = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds })),
    );
    const next = selectDeterministicStructuralStorefrontCandidate(
      inputFor(
        state,
        requestFor(state, {
          eligibleFamilyIds,
          excludedCompleteStoreTopologyFingerprints: [
            first.selectedCompleteStoreTopology.topologyFingerprint,
          ],
        }),
      ),
    );
    expect(first.selectedFamilyCandidate.familyId).toBe("editorial-offset");
    expect(next.selectedFamilyCandidate.familyId).toBe("campaign-modular");
  });

  it("reports insufficient capacity after all 64 compatible combinations are excluded", () => {
    const state = topologyCapacityFixture(2);
    const first = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["editorial-offset"] })),
    );
    const excluded = requestFor(state, {
      eligibleFamilyIds: ["editorial-offset"],
      excludedCompleteStoreTopologyFingerprints: [
        first.selectedCompleteStoreTopology.topologyFingerprint,
      ],
    });
    expectSelectionError(
      () => selectDeterministicStructuralStorefrontCandidate(inputFor(state, excluded)),
      "insufficient-distinct-selection-capacity",
      64,
    );
  });

  it("stops before evaluating a 4,097th combination without a partial receipt", () => {
    const state = topologyCapacityFixture(5);
    const first = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["editorial-offset"] })),
    );
    const excluded = requestFor(state, {
      eligibleFamilyIds: ["editorial-offset"],
      excludedCompleteStoreTopologyFingerprints: [
        first.selectedCompleteStoreTopology.topologyFingerprint,
      ],
    });
    expectSelectionError(
      () => selectDeterministicStructuralStorefrontCandidate(inputFor(state, excluded)),
      "selection-combination-budget-exhausted",
      4_096,
    );
  });

  it("makes selected topology depend only on terminal structures, omissions and relationships", () => {
    const direct = candidate({
      id: "home-direct",
      pageFamilyId: "home",
      assetMode: "optional",
    });
    const source = candidate({
      id: "home-source",
      pageFamilyId: "home",
      assetMode: "optional",
      terminalResolution: "omit-region",
      substitutions: [reference(direct)],
    });
    const renamed = candidate({
      id: "home-renamed",
      pageFamilyId: "home",
      assetMode: "optional",
    });
    const rest = structuralStorefrontPageFamilyIds
      .filter((pageFamilyId) => pageFamilyId !== "home")
      .map((pageFamilyId) => candidate({ id: `${pageFamilyId}-base`, pageFamilyId }));
    const byPage = Object.fromEntries(
      rest.map((entry) => [entry.structural.pageFamilyId, [entry]]),
    );
    const state = stateFrom(
      [source, direct, renamed, ...rest],
      [
        {
          familyId: "editorial-offset",
          pageCandidates: { ...byPage, home: [direct] },
        },
        {
          familyId: "campaign-modular",
          pageCandidates: { ...byPage, home: [source] },
        },
        {
          familyId: "warm-narrative",
          pageCandidates: { ...byPage, home: [renamed] },
        },
      ],
      { "home-direct@1.0.0": 1, "home-renamed@1.0.0": 1 },
    );
    const fingerprints = ["editorial-offset", "campaign-modular", "warm-narrative"].map(
      (familyId) =>
        selectDeterministicStructuralStorefrontCandidate(
          inputFor(
            state,
            requestFor(state, {
              eligibleFamilyIds: [familyId as StructuralStorefrontFamilyId],
            }),
          ),
        ).selectedCompleteStoreTopology,
    );
    expect(fingerprints[1].topologyFingerprint).toBe(fingerprints[0].topologyFingerprint);
    expect(fingerprints[2].topologyFingerprint).toBe(fingerprints[0].topologyFingerprint);
    expect(Object.keys(fingerprints[0])).toStrictEqual([
      "topologySchemaVersion",
      "pageFamilyTopologies",
      "crossPageRelationships",
      "topologyFingerprint",
    ]);
    expect(JSON.stringify(fingerprints[0])).not.toMatch(
      /home-(?:source|direct|renamed)|editorial-offset|campaign-modular|warm-narrative/u,
    );
  });
});

describe("P10B-19A-08C receipt replay and fail-closed boundaries", () => {
  it("returns one exact deeply frozen receipt and replays every decision", () => {
    const state = standardFixture();
    const request = requestFor(state, { eligibleFamilyIds: ["campaign-modular"] });
    const input = inputFor(state, request);
    const receipt = selectDeterministicStructuralStorefrontCandidate(input);
    expect(receipt.receiptSchemaVersion).toBe("1.0.0");
    expect(receipt.selectionPolicyVersion).toBe("1.0.0");
    expect(receipt.selectionRequestFingerprint).toBe(request.requestFingerprint);
    expect(receipt.compatibilityEvaluationFingerprint).toBe(
      state.compatibilityEvaluation.evaluationFingerprint,
    );
    expect(receipt.selectionFingerprint).toMatch(
      /^structural-storefront-deterministic-selection-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(parseStructuralStorefrontDeterministicSelectionReceipt(input, receipt)).toStrictEqual(
      receipt,
    );
    expect(deeplyFrozen(receipt)).toBe(true);
  });

  it.each([
    [
      "family",
      (receipt: ReturnType<typeof selectDeterministicStructuralStorefrontCandidate>) => ({
        ...receipt,
        selectedFamilyCandidate: {
          ...receipt.selectedFamilyCandidate,
          familyVersion: "1.0.1",
        },
      }),
    ],
    [
      "page",
      (receipt: ReturnType<typeof selectDeterministicStructuralStorefrontCandidate>) => ({
        ...receipt,
        pageFamilySelections: receipt.pageFamilySelections.map((entry, index) =>
          index === 0 ? { ...entry, effectiveCandidateIdentityKey: "home-direct@1.0.0" } : entry,
        ),
      }),
    ],
    [
      "path",
      (receipt: ReturnType<typeof selectDeterministicStructuralStorefrontCandidate>) => ({
        ...receipt,
        pageFamilySelections: receipt.pageFamilySelections.map((entry, index) =>
          index === 0
            ? { ...entry, substitutionPathCandidateIdentityKeys: ["home-omit@1.0.0"] }
            : entry,
        ),
      }),
    ],
    [
      "topology",
      (receipt: ReturnType<typeof selectDeterministicStructuralStorefrontCandidate>) => ({
        ...receipt,
        selectedCompleteStoreTopology: {
          ...receipt.selectedCompleteStoreTopology,
          topologyFingerprint: receipt.selectedCompleteStoreTopology.topologyFingerprint.replace(
            /[a-f0-9]$/u,
            (value) => (value === "0" ? "1" : "0"),
          ),
        },
      }),
    ],
    [
      "fingerprint",
      (receipt: ReturnType<typeof selectDeterministicStructuralStorefrontCandidate>) => ({
        ...receipt,
        selectionFingerprint: receipt.selectionFingerprint.replace(/[a-f0-9]$/u, (value) =>
          value === "0" ? "1" : "0",
        ),
      }),
    ],
    [
      "unknown",
      (receipt: ReturnType<typeof selectDeterministicStructuralStorefrontCandidate>) => ({
        ...receipt,
        unexpected: true,
      }),
    ],
  ] as const)("rejects stale or contradictory %s receipt authority", (_label, mutate) => {
    const state = standardFixture();
    const request = requestFor(state, { eligibleFamilyIds: ["campaign-modular"] });
    const input = inputFor(state, request);
    const receipt = selectDeterministicStructuralStorefrontCandidate(input);
    expectSelectionError(
      () => parseStructuralStorefrontDeterministicSelectionReceipt(input, mutate(receipt)),
      "stale-selection-authority",
    );
  });

  it("maps an unreproducible receipt under changed valid request authority to stale", () => {
    const state = standardFixture();
    const request = requestFor(state, { eligibleFamilyIds: ["campaign-modular"] });
    const receipt = selectDeterministicStructuralStorefrontCandidate(inputFor(state, request));
    const changedRequest = requestFor(state, {
      eligibleFamilyIds: ["campaign-modular"],
      excludedCompleteStoreTopologyFingerprints: [
        receipt.selectedCompleteStoreTopology.topologyFingerprint,
      ],
    });
    expectSelectionError(
      () =>
        parseStructuralStorefrontDeterministicSelectionReceipt(
          inputFor(state, changedRequest),
          receipt,
        ),
      "stale-selection-authority",
    );
  });

  it("fails empty production authority without exporting a request, receipt or fallback", () => {
    const registry = inactiveStructuralStorefrontFamilyCandidateRegistry;
    const normalizedTopologyIndex = deriveInactiveCandidateNormalizedTopologyIndex(registry);
    const capabilityContext = createStructuralStorefrontCapabilityContext(registry, {
      contextSchemaVersion: "1.0.0",
      catalogueCardinality: "sparse",
      factDepth: "sparse",
      productComplexity: "simple",
      navigationDepth: "shallow",
      activeLocale: "en",
      availableLocales: ["en"],
      pageBlueprintAssetRoleCapacityEvidence: [],
    });
    const evaluationAuthority = {
      candidateRegistry: registry,
      normalizedTopologyIndex,
      capabilityContext,
      compatibilityProfileCatalogue:
        inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
    };
    const compatibilityEvaluation =
      evaluateInactiveStructuralStorefrontCandidateCompatibility(evaluationAuthority);
    const selectionRequest = createStructuralStorefrontDeterministicSelectionRequest(
      compatibilityEvaluation.evaluationFingerprint,
      {
        requestSchemaVersion: "1.0.0",
        selectionPolicyVersion: "1.0.0",
        selectionCaseId: "primary-concept",
        compatibilityEvaluationFingerprint: compatibilityEvaluation.evaluationFingerprint,
        eligibleFamilyIds: ["editorial-offset"],
        excludedFamilyCandidateIdentityKeys: [],
        excludedFamilyTopologyFingerprints: [],
        excludedCompleteStoreTopologyFingerprints: [],
      },
    );
    expectSelectionError(
      () =>
        selectDeterministicStructuralStorefrontCandidate({
          ...evaluationAuthority,
          compatibilityEvaluation,
          selectionRequest,
        }),
      "no-eligible-family-candidates",
    );
    const records = Object.values(storefrontTemplateAuthority).filter(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (Object.hasOwn(value, "requestFingerprint") ||
          Object.hasOwn(value, "selectionFingerprint")),
    );
    expect(records).toStrictEqual([]);
  });

  it("contains no numeric comparison fields or nondeterministic production primitives", () => {
    const state = standardFixture();
    const receipt = selectDeterministicStructuralStorefrontCandidate(
      inputFor(state, requestFor(state, { eligibleFamilyIds: ["editorial-offset"] })),
    );
    const keys = [...objectKeys(receipt)];
    ["score", "weight", "penalty", "bonus", "rank", "ranking", "confidence"].forEach((key) =>
      expect(keys).not.toContain(key),
    );
    const repositoryRoot = resolve(process.cwd());
    const productionSources = [
      "src/application/storefront-templates/structural-storefront-selection-contract.ts",
      "src/application/storefront-templates/structural-storefront-deterministic-selection.ts",
    ].map((path) => readFileSync(resolve(repositoryRoot, path), "utf8"));
    productionSources.forEach((source) => {
      expect(source).not.toMatch(/localeCompare|Math\.random|randomUUID|Date\.now|new Date/u);
      expect(source).not.toMatch(
        /\b(?:score|weight|penalty|bonus|rank|ranking|confidence|randomSeed)\b/iu,
      );
    });
  });

  it("limits A-08C named authority to its two modules and the barrel", () => {
    const repositoryRoot = resolve(process.cwd());
    const consumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) =>
        /structural-storefront-(?:selection-contract|deterministic-selection)/u.test(source),
      )
      .map(({ path }) => relative(repositoryRoot, path))
      .sort();
    expect(consumers).toStrictEqual([
      "src/application/storefront-templates/index.ts",
      "src/application/storefront-templates/structural-storefront-deterministic-selection.ts",
      "src/application/storefront-templates/structural-storefront-selection-contract.ts",
    ]);
    const namedRuntimeConsumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .map((path) => ({ path: relative(repositoryRoot, path), source: readFileSync(path, "utf8") }))
      .filter(
        ({ path }) =>
          ![
            "src/application/storefront-templates/structural-storefront-deterministic-selection.ts",
            "src/application/storefront-templates/structural-storefront-selection-contract.ts",
          ].includes(path),
      )
      .filter(({ source }) =>
        /(?:selectDeterministicStructuralStorefrontCandidate|parseStructuralStorefrontDeterministicSelectionReceipt|createStructuralStorefrontDeterministicSelectionRequest)/u.test(
          source,
        ),
      )
      .map(({ path }) => path);
    expect(namedRuntimeConsumers).toStrictEqual([]);
    const selector = readFileSync(
      resolve(
        repositoryRoot,
        "src/application/storefront-templates/structural-storefront-deterministic-selection.ts",
      ),
      "utf8",
    );
    expect(selector).toMatch(
      /familyTieFingerprint\(left, request\)[\s\S]*\|\|[\s\S]*compareCodeUnits\(left\.identityKey, right\.identityKey\)/u,
    );
    expect(selector).toMatch(
      /pageTieFingerprint\(left,[\s\S]*\|\| compareCodeUnits\(left\.identityKey, right\.identityKey\)/u,
    );
  });
});
