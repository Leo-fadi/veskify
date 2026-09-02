import { describe, expect, it } from "vitest";

import {
  MAX_STRUCTURAL_STOREFRONT_SELECTION_COMBINATION_EVALUATIONS,
  STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION,
  STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_RECEIPT_SCHEMA_VERSION,
  STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_REQUEST_SCHEMA_VERSION,
  STRUCTURAL_STOREFRONT_SELECTED_COMPLETE_TOPOLOGY_SCHEMA_VERSION,
  createStructuralStorefrontDeterministicSelectionReceipt,
  createStructuralStorefrontDeterministicSelectionRequest,
  createStructuralStorefrontSelectedCompleteTopology,
  parseStructuralStorefrontDeterministicSelectionRequest,
  structuralStorefrontDeterministicSelectionErrorCodes,
  structuralStorefrontDeterministicSelectionReceiptV1Schema,
  structuralStorefrontFamilyCompatibilityPrecedence,
  structuralStorefrontPageBlueprintCompatibilityPrecedence,
  structuralStorefrontSelectedCompleteTopologyV1Schema,
  structuralStorefrontPageFamilyDecisionV1Schema,
  structuralStorefrontSelectionResolutionModeSchema,
  type StructuralStorefrontSelectedPageFamilyCandidateV1,
} from "@/application/storefront-templates/structural-storefront-selection-contract";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  structuralStorefrontPageFamilyIds,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family";

const digest = (character: string) => character.repeat(64);
const compatibilityEvaluationFingerprint = `structural-storefront-candidate-compatibility-evaluation-v1_1_${digest("a")}`;
const otherCompatibilityEvaluationFingerprint = `structural-storefront-candidate-compatibility-evaluation-v1_1_${digest("b")}`;

const familyTopologyFingerprints = [
  `structural-storefront-family-normalized-topology-v1_1_${digest("b")}`,
  `structural-storefront-family-normalized-topology-v1_1_${digest("a")}`,
] as const;
const completeTopologyExclusions = [
  `structural-storefront-selected-complete-topology-v1_1_${digest("d")}`,
  `structural-storefront-selected-complete-topology-v1_1_${digest("c")}`,
] as const;
const familyIdentityExclusions = [
  "campaign-modular@1.0.0",
  "editorial-offset@1.10.0",
  "editorial-offset@1.2.0",
] as const;

const canonicalEligibleFamilyIds = ["editorial-offset", "campaign-modular"] as const;
const canonicalFamilyIdentityExclusions = [
  "editorial-offset@1.2.0",
  "editorial-offset@1.10.0",
  "campaign-modular@1.0.0",
] as const;
const canonicalFamilyTopologyExclusions = [
  familyTopologyFingerprints[1],
  familyTopologyFingerprints[0],
] as const;
const canonicalCompleteTopologyExclusions = [
  completeTopologyExclusions[1],
  completeTopologyExclusions[0],
] as const;

function requestInput() {
  return {
    requestSchemaVersion: STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_REQUEST_SCHEMA_VERSION,
    selectionPolicyVersion: STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION,
    selectionCaseId: "test-case-001",
    compatibilityEvaluationFingerprint,
    eligibleFamilyIds: ["campaign-modular", "editorial-offset"],
    excludedFamilyCandidateIdentityKeys: [...familyIdentityExclusions],
    excludedFamilyTopologyFingerprints: [...familyTopologyFingerprints],
    excludedCompleteStoreTopologyFingerprints: [...completeTopologyExclusions],
  };
}

function canonicalRequestMaterial() {
  return {
    requestSchemaVersion: "1.0.0",
    selectionPolicyVersion: "1.0.0",
    selectionCaseId: "test-case-001",
    compatibilityEvaluationFingerprint,
    eligibleFamilyIds: [...canonicalEligibleFamilyIds],
    excludedFamilyCandidateIdentityKeys: [...canonicalFamilyIdentityExclusions],
    excludedFamilyTopologyFingerprints: [...canonicalFamilyTopologyExclusions],
    excludedCompleteStoreTopologyFingerprints: [...canonicalCompleteTopologyExclusions],
  };
}

function createRequest() {
  return createStructuralStorefrontDeterministicSelectionRequest(
    compatibilityEvaluationFingerprint,
    requestInput(),
  );
}

function pageTopologyFingerprint(index: number): string {
  return `page-blueprint-v2-normalized-topology-v1_1_${digest("123456"[index])}`;
}

const canonicalRelationships = [
  {
    sourcePageFamilyId: "home",
    relationshipKind: "frame-continuity",
    targetPageFamilyId: "collection",
  },
  {
    sourcePageFamilyId: "collection",
    relationshipKind: "commerce-transition",
    targetPageFamilyId: "product-detail",
  },
] as const;

function topologyMaterial(options: Readonly<{ omissions?: boolean; reversed?: boolean }> = {}) {
  const pageFamilyTopologies = structuralStorefrontPageFamilyIds.map((pageFamilyId, index) => ({
    pageFamilyId,
    effectivePageBlueprintTopologyFingerprint: pageTopologyFingerprint(index),
    omittedTopologyRegionIds: options.omissions && pageFamilyId === "home" ? ["r10", "r2"] : [],
  }));
  return {
    topologySchemaVersion: STRUCTURAL_STOREFRONT_SELECTED_COMPLETE_TOPOLOGY_SCHEMA_VERSION,
    pageFamilyTopologies: options.reversed
      ? [...pageFamilyTopologies].reverse()
      : pageFamilyTopologies,
    crossPageRelationships: options.reversed
      ? [...canonicalRelationships].reverse()
      : [...canonicalRelationships],
  };
}

function canonicalTopologyMaterial(omissions = false) {
  return {
    topologySchemaVersion: "1.0.0",
    pageFamilyTopologies: structuralStorefrontPageFamilyIds.map((pageFamilyId, index) => ({
      pageFamilyId,
      effectivePageBlueprintTopologyFingerprint: pageTopologyFingerprint(index),
      omittedTopologyRegionIds: omissions && pageFamilyId === "home" ? ["r2", "r10"] : [],
    })),
    crossPageRelationships: [...canonicalRelationships],
  };
}

function pageCandidateFingerprint(index: number): string {
  return `page-blueprint-v2-candidate-v1_1_${digest("abcdef"[index])}`;
}

function directPageSelection(
  pageFamilyId: StructuralStorefrontPageFamilyId,
  index: number,
): StructuralStorefrontSelectedPageFamilyCandidateV1 {
  const identityKey = `${pageFamilyId}-source@1.0.0`;
  return structuralStorefrontPageFamilyDecisionV1Schema.parse({
    pageFamilyId,
    sourceCandidateIdentityKey: identityKey,
    sourceExactCandidateFingerprint: pageCandidateFingerprint(index),
    sourceNormalizedTopologyFingerprint: pageTopologyFingerprint(index),
    sourceCompatibilityStatus: "directly-compatible",
    resolutionMode: "direct",
    substitutionPathCandidateIdentityKeys: [],
    effectiveCandidateIdentityKey: identityKey,
    effectiveExactCandidateFingerprint: pageCandidateFingerprint(index),
    effectiveNormalizedTopologyFingerprint: pageTopologyFingerprint(index),
    terminalCompatibilityStatus: "directly-compatible",
    omittedRegionIds: [],
  });
}

function directPageSelectionInput(pageFamilyId: StructuralStorefrontPageFamilyId, index: number) {
  return structuredClone(directPageSelection(pageFamilyId, index));
}

function canonicalPageSelections() {
  return structuralStorefrontPageFamilyIds.map(directPageSelection);
}

function receiptMaterial(reversed = false) {
  const selections = canonicalPageSelections();
  return {
    receiptSchemaVersion: STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_RECEIPT_SCHEMA_VERSION,
    selectionPolicyVersion: STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION,
    selectionRequestFingerprint: createRequest().requestFingerprint,
    compatibilityEvaluationFingerprint,
    selectedFamilyCandidate: {
      candidateIdentityKey: "editorial-offset@1.0.0",
      familyId: "editorial-offset",
      familyVersion: "1.0.0",
      exactCandidateFingerprint: `structural-storefront-family-candidate-v1_1_${digest("e")}`,
      normalizedTopologyFingerprint: `structural-storefront-family-normalized-topology-v1_1_${digest("f")}`,
      compatibilityStatus: "directly-compatible",
    },
    pageFamilySelections: reversed ? [...selections].reverse() : selections,
    selectedCompleteStoreTopology:
      createStructuralStorefrontSelectedCompleteTopology(topologyMaterial()),
  };
}

function staleFingerprint(value: string): string {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

function deeplyFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value as Record<string, unknown>).every((entry) => deeplyFrozen(entry, seen))
  );
}

describe("P10B-19A-08C deterministic selection request contract", () => {
  it("owns the exact versions, bounded policy and scoring-free precedence", () => {
    expect(STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_REQUEST_SCHEMA_VERSION).toBe("1.0.0");
    expect(STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION).toBe("1.0.0");
    expect(STRUCTURAL_STOREFRONT_SELECTED_COMPLETE_TOPOLOGY_SCHEMA_VERSION).toBe("1.0.0");
    expect(STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_RECEIPT_SCHEMA_VERSION).toBe("1.0.0");
    expect(MAX_STRUCTURAL_STOREFRONT_SELECTION_COMBINATION_EVALUATIONS).toBe(4_096);
    expect(structuralStorefrontFamilyCompatibilityPrecedence).toStrictEqual([
      "directly-compatible",
      "conditionally-compatible",
    ]);
    expect(structuralStorefrontPageBlueprintCompatibilityPrecedence).toStrictEqual([
      "directly-compatible",
      "substitution-compatible",
      "omission-compatible",
    ]);
    expect(structuralStorefrontSelectionResolutionModeSchema.options).toStrictEqual([
      "direct",
      "substitution",
      "omission",
    ]);
    expect(structuralStorefrontDeterministicSelectionErrorCodes).toStrictEqual([
      "stale-selection-authority",
      "no-eligible-family-candidates",
      "no-compatible-family-candidates",
      "no-compatible-page-family-candidates",
      "invalid-substitution-resolution",
      "selection-combination-budget-exhausted",
      "insufficient-distinct-selection-capacity",
    ]);
  });

  it.each([
    [
      "missing request version",
      (input: Record<string, unknown>) => delete input.requestSchemaVersion,
    ],
    [
      "unsupported request version",
      (input: Record<string, unknown>) => (input.requestSchemaVersion = "1.0.1"),
    ],
    [
      "missing policy version",
      (input: Record<string, unknown>) => delete input.selectionPolicyVersion,
    ],
    [
      "unsupported policy version",
      (input: Record<string, unknown>) => (input.selectionPolicyVersion = "1.0.1"),
    ],
    ["unknown root field", (input: Record<string, unknown>) => (input.unknown = true)],
  ])("rejects %s", (_label, change) => {
    const input: Record<string, unknown> = structuredClone(requestInput());
    change(input);
    expect(() =>
      createStructuralStorefrontDeterministicSelectionRequest(
        compatibilityEvaluationFingerprint,
        input,
      ),
    ).toThrow();
  });

  it.each([
    "",
    "Primary-concept",
    "primary concept",
    "../primary-concept",
    "primary/concept",
    "make-this-storefront-prettier!",
    "case-2026-09-02",
    "a1234567-1234-1234-1234-123456789abc",
    "a".repeat(129),
  ])("rejects nontechnical case identity %j", (selectionCaseId) => {
    expect(() =>
      createStructuralStorefrontDeterministicSelectionRequest(compatibilityEvaluationFingerprint, {
        ...requestInput(),
        selectionCaseId,
      }),
    ).toThrow();
  });

  it("requires nonempty unique family eligibility and unique explicit exclusions", () => {
    const duplicateCases = [
      { eligibleFamilyIds: [] },
      { eligibleFamilyIds: ["editorial-offset", "editorial-offset"] },
      {
        excludedFamilyCandidateIdentityKeys: ["editorial-offset@1.0.0", "editorial-offset@1.0.0"],
      },
      {
        excludedFamilyTopologyFingerprints: [
          familyTopologyFingerprints[0],
          familyTopologyFingerprints[0],
        ],
      },
      {
        excludedCompleteStoreTopologyFingerprints: [
          completeTopologyExclusions[0],
          completeTopologyExclusions[0],
        ],
      },
    ];
    for (const replacement of duplicateCases) {
      expect(() =>
        createStructuralStorefrontDeterministicSelectionRequest(
          compatibilityEvaluationFingerprint,
          { ...requestInput(), ...replacement },
        ),
      ).toThrow();
    }
  });

  it.each([
    ["family identity wildcard", { excludedFamilyCandidateIdentityKeys: ["editorial-offset@*"] }],
    [
      "malformed family identity",
      { excludedFamilyCandidateIdentityKeys: ["editorial-offset@1.0"] },
    ],
    ["family topology wildcard", { excludedFamilyTopologyFingerprints: ["*"] }],
    [
      "wrong family topology kind",
      { excludedFamilyTopologyFingerprints: [pageTopologyFingerprint(0)] },
    ],
    ["complete topology wildcard", { excludedCompleteStoreTopologyFingerprints: ["*"] }],
    [
      "wrong complete topology kind",
      { excludedCompleteStoreTopologyFingerprints: [familyTopologyFingerprints[0]] },
    ],
  ])("rejects %s", (_label, replacement) => {
    expect(() =>
      createStructuralStorefrontDeterministicSelectionRequest(compatibilityEvaluationFingerprint, {
        ...requestInput(),
        ...replacement,
      }),
    ).toThrow();
  });

  it("canonicalizes every request collection but parsing rejects noncanonical order", () => {
    const request = createRequest();
    expect(request.eligibleFamilyIds).toStrictEqual(canonicalEligibleFamilyIds);
    expect(request.excludedFamilyCandidateIdentityKeys).toStrictEqual(
      canonicalFamilyIdentityExclusions,
    );
    expect(request.excludedFamilyTopologyFingerprints).toStrictEqual(
      canonicalFamilyTopologyExclusions,
    );
    expect(request.excludedCompleteStoreTopologyFingerprints).toStrictEqual(
      canonicalCompleteTopologyExclusions,
    );

    const collectionKeys = [
      "eligibleFamilyIds",
      "excludedFamilyCandidateIdentityKeys",
      "excludedFamilyTopologyFingerprints",
      "excludedCompleteStoreTopologyFingerprints",
    ] as const;
    for (const key of collectionKeys) {
      expect(() =>
        parseStructuralStorefrontDeterministicSelectionRequest(compatibilityEvaluationFingerprint, {
          ...request,
          [key]: [...request[key]].reverse(),
        }),
      ).toThrow(/stale|noncanonical/iu);
    }
  });

  it("binds the exact compatibility evaluation on creation and parsing", () => {
    expect(() =>
      createStructuralStorefrontDeterministicSelectionRequest(
        otherCompatibilityEvaluationFingerprint,
        requestInput(),
      ),
    ).toThrow(/bind/iu);
    expect(() =>
      parseStructuralStorefrontDeterministicSelectionRequest(
        otherCompatibilityEvaluationFingerprint,
        createRequest(),
      ),
    ).toThrow(/bind/iu);
  });

  it("uses exact independent deterministic fingerprint material and rejects staleness", () => {
    const request = createRequest();
    expect(request).toStrictEqual({
      ...canonicalRequestMaterial(),
      requestFingerprint: `structural-storefront-deterministic-selection-request-${canonicalValueFingerprint(canonicalRequestMaterial())}`,
    });
    expect(request.requestFingerprint).toMatch(
      /^structural-storefront-deterministic-selection-request-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(
      createStructuralStorefrontDeterministicSelectionRequest(
        compatibilityEvaluationFingerprint,
        canonicalRequestMaterial(),
      ),
    ).toStrictEqual(request);
    expect(
      createStructuralStorefrontDeterministicSelectionRequest(compatibilityEvaluationFingerprint, {
        ...canonicalRequestMaterial(),
        selectionCaseId: "test-case-002",
      }).requestFingerprint,
    ).not.toBe(request.requestFingerprint);
    expect(() =>
      parseStructuralStorefrontDeterministicSelectionRequest(compatibilityEvaluationFingerprint, {
        ...request,
        selectionCaseId: "test-case-002",
      }),
    ).toThrow(/stale|noncanonical/iu);
    expect(() =>
      parseStructuralStorefrontDeterministicSelectionRequest(compatibilityEvaluationFingerprint, {
        ...request,
        requestFingerprint: staleFingerprint(request.requestFingerprint),
      }),
    ).toThrow(/stale|noncanonical/iu);
    expect(deeplyFrozen(request)).toBe(true);
  });
});

describe("P10B-19A-08C selected complete-store topology contract", () => {
  it("canonicalizes exactly six page roles and fingerprints only identity-free topology material", () => {
    const topology = createStructuralStorefrontSelectedCompleteTopology(
      topologyMaterial({ omissions: true, reversed: true }),
    );
    const expectedMaterial = canonicalTopologyMaterial(true);
    expect(topology).toStrictEqual({
      ...expectedMaterial,
      topologyFingerprint: `structural-storefront-selected-complete-topology-${canonicalValueFingerprint(expectedMaterial)}`,
    });
    expect(topology.pageFamilyTopologies.map(({ pageFamilyId }) => pageFamilyId)).toStrictEqual(
      structuralStorefrontPageFamilyIds,
    );
    expect(topology.pageFamilyTopologies[0].omittedTopologyRegionIds).toStrictEqual(["r2", "r10"]);
    expect(topology.topologyFingerprint).toMatch(
      /^structural-storefront-selected-complete-topology-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(Object.keys(topology)).toStrictEqual([
      "topologySchemaVersion",
      "pageFamilyTopologies",
      "crossPageRelationships",
      "topologyFingerprint",
    ]);
    expect(Object.keys(topology.pageFamilyTopologies[0])).toStrictEqual([
      "pageFamilyId",
      "effectivePageBlueprintTopologyFingerprint",
      "omittedTopologyRegionIds",
    ]);
    for (const forbidden of [
      "familyId",
      "familyVersion",
      "candidateIdentityKey",
      "sourceCandidateIdentityKey",
      "effectiveCandidateIdentityKey",
      "substitutionPathCandidateIdentityKeys",
      "selectionRequestFingerprint",
      "compatibilityStatus",
    ]) {
      expect(canonicalValueString(topology)).not.toContain(`"${forbidden}"`);
      expect(() =>
        createStructuralStorefrontSelectedCompleteTopology({
          ...topologyMaterial(),
          [forbidden]: "forbidden",
        }),
      ).toThrow();
    }
    expect(deeplyFrozen(topology)).toBe(true);
  });

  it("rejects missing, unsupported, duplicate and malformed topology authority", () => {
    const missingVersion: Record<string, unknown> = structuredClone(topologyMaterial());
    delete missingVersion.topologySchemaVersion;
    const duplicateFamilies = topologyMaterial().pageFamilyTopologies.map((entry, index, all) =>
      index === all.length - 1 ? all[0] : entry,
    );
    const invalidCases = [
      missingVersion,
      { ...topologyMaterial(), topologySchemaVersion: "1.0.1" },
      {
        ...topologyMaterial(),
        pageFamilyTopologies: topologyMaterial().pageFamilyTopologies.slice(1),
      },
      { ...topologyMaterial(), pageFamilyTopologies: duplicateFamilies },
      {
        ...topologyMaterial(),
        pageFamilyTopologies: topologyMaterial().pageFamilyTopologies.map((entry, index) =>
          index === 0 ? { ...entry, omittedTopologyRegionIds: ["r1", "r1"] } : entry,
        ),
      },
      {
        ...topologyMaterial(),
        pageFamilyTopologies: topologyMaterial().pageFamilyTopologies.map((entry, index) =>
          index === 0 ? { ...entry, omittedTopologyRegionIds: ["r01"] } : entry,
        ),
      },
      { ...topologyMaterial(), unknown: true },
    ];
    invalidCases.forEach((input) =>
      expect(() => createStructuralStorefrontSelectedCompleteTopology(input)).toThrow(),
    );
  });

  it("parses only canonical, current and fingerprint-consistent topology records", () => {
    const topology = createStructuralStorefrontSelectedCompleteTopology(
      topologyMaterial({ omissions: true }),
    );
    expect(structuralStorefrontSelectedCompleteTopologyV1Schema.parse(topology)).toStrictEqual(
      topology,
    );
    expect(() =>
      structuralStorefrontSelectedCompleteTopologyV1Schema.parse({
        ...topology,
        pageFamilyTopologies: [...topology.pageFamilyTopologies].reverse(),
      }),
    ).toThrow(/stale|noncanonical/iu);
    expect(() =>
      structuralStorefrontSelectedCompleteTopologyV1Schema.parse({
        ...topology,
        pageFamilyTopologies: topology.pageFamilyTopologies.map((entry, index) =>
          index === 0
            ? { ...entry, omittedTopologyRegionIds: [...entry.omittedTopologyRegionIds].reverse() }
            : entry,
        ),
      }),
    ).toThrow(/stale|noncanonical/iu);
    expect(() =>
      structuralStorefrontSelectedCompleteTopologyV1Schema.parse({
        ...topology,
        topologyFingerprint: staleFingerprint(topology.topologyFingerprint),
      }),
    ).toThrow(/stale|noncanonical/iu);
  });

  it("changes identity for omitted tokens, effective topology or cross-page relationships", () => {
    const baseline = createStructuralStorefrontSelectedCompleteTopology(topologyMaterial());
    const omitted = createStructuralStorefrontSelectedCompleteTopology(
      topologyMaterial({ omissions: true }),
    );
    const changedEffective = createStructuralStorefrontSelectedCompleteTopology({
      ...topologyMaterial(),
      pageFamilyTopologies: topologyMaterial().pageFamilyTopologies.map((entry, index) =>
        index === 0
          ? { ...entry, effectivePageBlueprintTopologyFingerprint: pageTopologyFingerprint(1) }
          : entry,
      ),
    });
    const changedRelationship = createStructuralStorefrontSelectedCompleteTopology({
      ...topologyMaterial(),
      crossPageRelationships: [
        {
          sourcePageFamilyId: "home",
          relationshipKind: "navigation-continuity",
          targetPageFamilyId: "collection",
        },
      ],
    });
    expect(
      new Set(
        [baseline, omitted, changedEffective, changedRelationship].map(
          ({ topologyFingerprint }) => topologyFingerprint,
        ),
      ).size,
    ).toBe(4);
  });
});

describe("P10B-19A-08C selected page-family record contract", () => {
  it("accepts exact direct, substitution and omission decisions", () => {
    const direct = directPageSelectionInput("home", 0);
    const substitution = {
      ...direct,
      sourceCandidateIdentityKey: "home-source@1.0.0",
      sourceCompatibilityStatus: "substitution-compatible",
      resolutionMode: "substitution",
      substitutionPathCandidateIdentityKeys: ["home-middle@1.0.0", "home-target@1.0.0"],
      effectiveCandidateIdentityKey: "home-target@1.0.0",
      effectiveExactCandidateFingerprint: `page-blueprint-v2-candidate-v1_1_${digest("1")}`,
      effectiveNormalizedTopologyFingerprint: pageTopologyFingerprint(1),
    };
    const omission = {
      ...direct,
      sourceCompatibilityStatus: "omission-compatible",
      resolutionMode: "omission",
      terminalCompatibilityStatus: "omission-compatible",
      omittedRegionIds: ["optional-region"],
    };
    const substitutionToOmission = {
      ...substitution,
      terminalCompatibilityStatus: "omission-compatible",
      omittedRegionIds: ["optional-region"],
    };
    [direct, substitution, omission, substitutionToOmission].forEach((input) =>
      expect(() => structuralStorefrontPageFamilyDecisionV1Schema.parse(input)).not.toThrow(),
    );
  });

  it("rejects contradictory modes, statuses, paths, terminals and omissions", () => {
    const direct = directPageSelectionInput("home", 0);
    const substitution = {
      ...direct,
      sourceCompatibilityStatus: "substitution-compatible",
      resolutionMode: "substitution",
      substitutionPathCandidateIdentityKeys: ["home-target@1.0.0"],
      effectiveCandidateIdentityKey: "home-target@1.0.0",
      effectiveExactCandidateFingerprint: `page-blueprint-v2-candidate-v1_1_${digest("1")}`,
      effectiveNormalizedTopologyFingerprint: pageTopologyFingerprint(1),
    };
    const invalidCases = [
      { ...direct, sourceCompatibilityStatus: "omission-compatible" },
      { ...direct, substitutionPathCandidateIdentityKeys: ["home-target@1.0.0"] },
      { ...direct, effectiveCandidateIdentityKey: "home-target@1.0.0" },
      { ...direct, terminalCompatibilityStatus: "omission-compatible" },
      { ...direct, omittedRegionIds: ["optional-region"] },
      {
        ...direct,
        sourceCompatibilityStatus: "omission-compatible",
        resolutionMode: "omission",
        terminalCompatibilityStatus: "omission-compatible",
      },
      { ...substitution, sourceCompatibilityStatus: "directly-compatible" },
      { ...substitution, substitutionPathCandidateIdentityKeys: [] },
      { ...substitution, substitutionPathCandidateIdentityKeys: ["home-other@1.0.0"] },
      { ...substitution, omittedRegionIds: ["optional-region"] },
      {
        ...substitution,
        terminalCompatibilityStatus: "omission-compatible",
        omittedRegionIds: [],
      },
      {
        ...substitution,
        substitutionPathCandidateIdentityKeys: ["home-target@1.0.0", "home-target@1.0.0"],
      },
      {
        ...direct,
        sourceCompatibilityStatus: "omission-compatible",
        resolutionMode: "omission",
        terminalCompatibilityStatus: "omission-compatible",
        omittedRegionIds: ["optional-region", "optional-region"],
      },
      { ...direct, sourceCompatibilityStatus: "incompatible" },
      { ...direct, sourceCandidateIdentityKey: `${"a".repeat(81)}@1.0.0` },
      { ...direct, score: 1 },
    ];
    invalidCases.forEach((input) =>
      expect(() => structuralStorefrontPageFamilyDecisionV1Schema.parse(input)).toThrow(),
    );
  });
});

describe("P10B-19A-08C exact immutable selection receipt contract", () => {
  it("canonicalizes six exact page decisions and fingerprints the complete receipt material", () => {
    const receipt = createStructuralStorefrontDeterministicSelectionReceipt(receiptMaterial(true));
    const expectedMaterial = receiptMaterial(false);
    expect(receipt).toStrictEqual({
      ...expectedMaterial,
      selectionFingerprint: `structural-storefront-deterministic-selection-${canonicalValueFingerprint(expectedMaterial)}`,
    });
    expect(receipt.pageFamilySelections.map(({ pageFamilyId }) => pageFamilyId)).toStrictEqual(
      structuralStorefrontPageFamilyIds,
    );
    expect(receipt.selectionFingerprint).toMatch(
      /^structural-storefront-deterministic-selection-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(receipt.selectedFamilyCandidate).toStrictEqual({
      candidateIdentityKey: "editorial-offset@1.0.0",
      familyId: "editorial-offset",
      familyVersion: "1.0.0",
      exactCandidateFingerprint: `structural-storefront-family-candidate-v1_1_${digest("e")}`,
      normalizedTopologyFingerprint: `structural-storefront-family-normalized-topology-v1_1_${digest("f")}`,
      compatibilityStatus: "directly-compatible",
    });
    expect(receipt.pageFamilySelections[0]).toStrictEqual(directPageSelection("home", 0));
    expect(deeplyFrozen(receipt)).toBe(true);
  });

  it("parses only exact canonical current receipts", () => {
    const receipt = createStructuralStorefrontDeterministicSelectionReceipt(receiptMaterial());
    expect(structuralStorefrontDeterministicSelectionReceiptV1Schema.parse(receipt)).toStrictEqual(
      receipt,
    );
    const invalidCases = [
      { ...receipt, receiptSchemaVersion: "1.0.1" },
      { ...receipt, selectionPolicyVersion: "1.0.1" },
      { ...receipt, pageFamilySelections: [...receipt.pageFamilySelections].reverse() },
      { ...receipt, selectionFingerprint: staleFingerprint(receipt.selectionFingerprint) },
      { ...receipt, unknown: true },
    ];
    invalidCases.forEach((input) =>
      expect(() =>
        structuralStorefrontDeterministicSelectionReceiptV1Schema.parse(input),
      ).toThrow(),
    );
  });

  it("rejects missing or duplicate page roles and contradictory topology or family authority", () => {
    const material = receiptMaterial();
    const duplicateSelections = material.pageFamilySelections.map((entry, index, all) =>
      index === all.length - 1 ? all[0] : entry,
    );
    const invalidCases = [
      { ...material, pageFamilySelections: material.pageFamilySelections.slice(1) },
      { ...material, pageFamilySelections: duplicateSelections },
      {
        ...material,
        selectedCompleteStoreTopology: createStructuralStorefrontSelectedCompleteTopology({
          ...topologyMaterial(),
          pageFamilyTopologies: topologyMaterial().pageFamilyTopologies.map((entry, index) =>
            index === 0
              ? { ...entry, effectivePageBlueprintTopologyFingerprint: pageTopologyFingerprint(1) }
              : entry,
          ),
        }),
      },
      {
        ...material,
        selectedFamilyCandidate: {
          ...material.selectedFamilyCandidate,
          familyId: "campaign-modular",
        },
      },
      {
        ...material,
        selectedFamilyCandidate: {
          ...material.selectedFamilyCandidate,
          compatibilityStatus: "incompatible",
        },
      },
    ];
    invalidCases.forEach((input) =>
      expect(() => createStructuralStorefrontDeterministicSelectionReceipt(input)).toThrow(),
    );
  });

  const forbiddenFields = [
    "prompt",
    "merchantId",
    "projectId",
    "storeId",
    "providerId",
    "providerPayload",
    "model",
    "temperature",
    "score",
    "weight",
    "penalty",
    "bonus",
    "rank",
    "ranking",
    "confidence",
    "preferredCandidate",
    "winner",
    "randomSeed",
    "timestamp",
    "createdAt",
    "updatedAt",
    "componentId",
    "componentVariant",
    "assetId",
    "assetUrl",
    "assetRevision",
    "productId",
    "collectionId",
    "price",
    "inventory",
    "palette",
    "font",
    "css",
    "html",
    "visualRecipe",
    "brandSystem",
    "snapshot",
    "puckData",
    "publication",
    "activationEvidence",
    "meaningfulnessScore",
  ] as const;

  it.each(forbiddenFields)("rejects forbidden request and receipt field %s", (field) => {
    expect(() =>
      createStructuralStorefrontDeterministicSelectionRequest(compatibilityEvaluationFingerprint, {
        ...requestInput(),
        [field]: "forbidden",
      }),
    ).toThrow();
    expect(() =>
      createStructuralStorefrontDeterministicSelectionReceipt({
        ...receiptMaterial(),
        [field]: "forbidden",
      }),
    ).toThrow();
  });
});
