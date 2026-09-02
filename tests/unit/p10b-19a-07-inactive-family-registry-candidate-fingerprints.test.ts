import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import * as storefrontTemplateAuthority from "@/application/storefront-templates";
import {
  INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_REGISTRY_SCHEMA_VERSION,
  PAGE_BLUEPRINT_V2_CANDIDATE_SCHEMA_VERSION,
  STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_SCHEMA_VERSION,
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  canonicalizePageBlueprintV2AssetRoleCompatibilityContract,
  canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract,
  canonicalizePageBlueprintV2ResponsiveRuleContract,
  canonicalizePageBlueprintV2StructuralContract,
  createPageBlueprintV2CandidateAuthority,
  createPageBlueprintV2CandidateAuthorityIdentityKey,
  createPageBlueprintV2CandidateReferenceIdentityKey,
  createStructuralStorefrontFamilyCandidate,
  inactiveStructuralStorefrontFamilyCandidateRegistry,
  inactiveStructuralStorefrontFamilyCandidateRegistryV1Schema,
  pageBlueprintV2CandidateAuthorityV1Schema,
  pageBlueprintV2CandidateReferenceSchema,
  parsePageBlueprintV2CandidateAuthority,
  parseStructuralStorefrontFamilyCandidate,
  structuralStorefrontFamilyCandidateV1Schema,
  type PageBlueprintV2CandidateAuthorityV1,
  type PageBlueprintV2CandidateReference,
  type StructuralStorefrontFamilyCandidateV1,
} from "@/application/storefront-templates";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import {
  structuralStorefrontPageFamilyIds,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family/cross-page-relationships";
import {
  structuralStorefrontFamilyIdentityKey,
  structuralStorefrontFamilyIds,
  type StructuralStorefrontFamilyId,
} from "@/domain/structural-storefront-family/identity";
import { isStructuralStorefrontFamilySelectable } from "@/domain/structural-storefront-family/lifecycle";

const approvedProtectedAuthorityFingerprint =
  "sha256:21ef43c86f36bd9967fb4b8caf59039bc6b0dc0909d45d51dd81a666c6dddd03";
const protectedAuthorityPaths = [
  "src/domain/structural-storefront-family",
  "src/application/storefront-templates/page-blueprint-v2-contract.ts",
  "src/application/storefront-templates/page-blueprint-version-dispatch.ts",
  "src/application/storefront-templates/page-blueprint-v2-asset-role-contract.ts",
  "src/application/storefront-templates/page-blueprint-v2-responsive-rule-contract.ts",
  "src/application/storefront-templates/page-blueprint-v2-omission-substitution-fallback-contract.ts",
  "src/application/storefront-templates/contract.ts",
  "src/application/storefront-templates/registry.ts",
  "src/application/storefront-templates/resolver.ts",
  "src/application/storefront-templates/profile-materializer.ts",
  "src/application/storefront-templates/materializer.ts",
  "src/application/storefront-templates/materializer-contract.ts",
  "src/application/storefront-templates/selection-contract.ts",
  "src/application/storefront-templates/selection-planner.ts",
  "src/application/storefront-templates/page-family-baselines.ts",
  "src/application/storefront-templates/profile-authority.ts",
  "src/application/storefront-templates/design-vocabulary-validation.ts",
  "src/application/storefront-templates/commercial-homepage-profiles.ts",
  "src/application/storefront-templates/commercial-collection-search-profiles.ts",
  "src/application/storefront-templates/commercial-content-support-profiles.ts",
  "src/application/storefront-templates/commercial-pdp-profiles.ts",
  "src/application/storefront-templates/commercial-utility-profiles.ts",
  "src/application/storefront-templates/commerce-utility-materializer.ts",
  "src/application/bounded-storefront-synthesis/direction-registry.ts",
  "src/application/bounded-storefront-synthesis/direction-contract.ts",
  "src/application/bounded-storefront-synthesis/compatible-direction-selections.ts",
  "src/application/prompted-storefront-design-compiler/semantic-compatibility-resolution.ts",
  "src/domain/storefront/canonical-storefront.ts",
  "src/domain/storefront/storefront.ts",
  "src/application/storefront-draft-persistence",
  "src/application/publishing",
  "src/application/accepted-snapshot-publishing",
] as const;

function staleFingerprint(value: string): string {
  const replacement = value.endsWith("0") ? "1" : "0";
  return `${value.slice(0, -1)}${replacement}`;
}

const minimumRolesByPageFamily: Readonly<
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

function candidateInput(options: CandidateFixtureOptions = {}) {
  const pageFamilyId = options.pageFamilyId ?? "home";
  const id = options.id ?? `${pageFamilyId}-candidate`;
  const version = options.version ?? "1.0.0";
  const regions = [
    ...minimumRolesByPageFamily[pageFamilyId].map((role, index) => ({
      id: `${role}-required-${index + 1}`,
      role,
      requirement: "required",
      cardinality: { minimum: 1, ideal: 1, maximum: 2 },
      visualWeight: "medium",
    })),
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
      cardinality: { minimum: 0, ideal: 1, maximum: 2 },
      visualWeight: "light",
    },
  ];
  const regionIds = regions.map(({ id: regionId }) => regionId);

  return {
    candidateSchemaVersion: "1.0.0",
    structural: {
      id,
      version,
      pageFamilyId,
      regions,
      relationships: [],
      orderAlternatives: [{ id: "canonical-order", regionIds }],
      defaultOrderAlternativeId: "canonical-order",
    },
    assetRoleCompatibility: {
      contractSchemaVersion: "1.0.0",
      blueprintId: id,
      blueprintVersion: version,
      regionAssetRequirements: [
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
        orderAlternativeId: "canonical-order",
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
      blueprintVersion: version,
      blueprintSubstitutionCandidates: (options.substitutionTargets ?? []).map((reference) => ({
        ...reference,
      })),
      regionFallbackRules: ["proof-region", "story-region"].map((regionId) => ({
        regionId,
        trigger: "required-asset-role-cardinality-unsatisfied",
        terminalResolution: "omit-region",
      })),
    },
  };
}

function referenceFor(candidate: PageBlueprintV2CandidateAuthorityV1) {
  return {
    blueprintId: candidate.structural.id,
    blueprintVersion: candidate.structural.version,
  };
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

function createPageFamilyCandidates(): readonly PageBlueprintV2CandidateAuthorityV1[] {
  return structuralStorefrontPageFamilyIds.map((pageFamilyId) =>
    createPageBlueprintV2CandidateAuthority(candidateInput({ pageFamilyId })),
  );
}

function createFamilyForCandidates(
  candidates: readonly PageBlueprintV2CandidateAuthorityV1[],
  options: Readonly<{ familyId?: StructuralStorefrontFamilyId; familyVersion?: string }> = {},
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

function canonicalRegistry(
  pageBlueprintCandidates: readonly PageBlueprintV2CandidateAuthorityV1[],
  familyCandidates: readonly StructuralStorefrontFamilyCandidateV1[] = [],
) {
  return canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry({
    contractSchemaVersion: "1.0.0",
    pageBlueprintCandidates,
    familyCandidates,
  });
}

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => deepFrozen(child, seen));
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.[cm]?tsx?$/u.test(entry.name) ? [path] : [];
  });
}

function collectFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    collectFiles(join(path, entry.name)),
  );
}

function fingerprintProtectedAuthority(repositoryRoot: string): string {
  const files = protectedAuthorityPaths
    .flatMap((path) => collectFiles(resolve(repositoryRoot, path)))
    .map((path) => relative(repositoryRoot, path))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const hash = createHash("sha256");

  for (const path of files) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(resolve(repositoryRoot, path)));
    hash.update("\0");
  }

  return `sha256:${hash.digest("hex")}`;
}

describe("P10B-19A-07 PageBlueprint candidate composition", () => {
  it("composes exact A-03 through A-06 authority and derives identity only from structural authority", () => {
    const input = candidateInput({ id: "home-composed", version: "1.7.4" });
    const before = clone(input);
    const candidate = createPageBlueprintV2CandidateAuthority(input);
    const structural = canonicalizePageBlueprintV2StructuralContract(input.structural);
    const assetRoleCompatibility = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
      structural,
      input.assetRoleCompatibility,
    );
    const responsiveRules = canonicalizePageBlueprintV2ResponsiveRuleContract(
      structural,
      input.responsiveRules,
    );
    const omissionSubstitutionFallback =
      canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract(
        structural,
        assetRoleCompatibility,
        responsiveRules,
        input.omissionSubstitutionFallback,
      );

    expect(candidate).toMatchObject({
      candidateSchemaVersion: PAGE_BLUEPRINT_V2_CANDIDATE_SCHEMA_VERSION,
      structural: { id: "home-composed", version: "1.7.4", pageFamilyId: "home" },
    });
    expect(createPageBlueprintV2CandidateAuthorityIdentityKey(candidate)).toBe(
      "home-composed@1.7.4",
    );
    expect(candidate.structural).toStrictEqual(structural);
    expect(candidate.assetRoleCompatibility).toStrictEqual(assetRoleCompatibility);
    expect(candidate.responsiveRules).toStrictEqual(responsiveRules);
    expect(candidate.omissionSubstitutionFallback).toStrictEqual(omissionSubstitutionFallback);
    expect(input).toStrictEqual(before);
    expect(deepFrozen(candidate)).toBe(true);
  });

  it.each([
    ["A-04 ID", "assetRoleCompatibility", "blueprintId"],
    ["A-05 ID", "responsiveRules", "blueprintId"],
    ["A-06 ID", "omissionSubstitutionFallback", "blueprintId"],
    ["A-04 version", "assetRoleCompatibility", "blueprintVersion"],
    ["A-05 version", "responsiveRules", "blueprintVersion"],
    ["A-06 version", "omissionSubstitutionFallback", "blueprintVersion"],
  ])("fails closed for a mismatched %s", (_label, child, field) => {
    const input = candidateInput();
    const target = input[child as keyof typeof input] as unknown as Record<string, unknown>;
    target[field] = field === "blueprintId" ? "other-candidate" : "1.0.1";
    expect(() => createPageBlueprintV2CandidateAuthority(input)).toThrow();
  });

  it("rejects an unknown wrapper field without discarding it", () => {
    expect(() =>
      createPageBlueprintV2CandidateAuthority({ ...candidateInput(), metadata: {} }),
    ).toThrow();
  });
});

describe("P10B-19A-07 exact PageBlueprint candidate fingerprint", () => {
  it("matches independently constructed exact material and is deterministic", () => {
    const first = createPageBlueprintV2CandidateAuthority(candidateInput());
    const second = createPageBlueprintV2CandidateAuthority(candidateInput());
    const expected = `page-blueprint-v2-candidate-${canonicalValueFingerprint({
      candidateSchemaVersion: first.candidateSchemaVersion,
      structural: first.structural,
      assetRoleCompatibility: first.assetRoleCompatibility,
      responsiveRules: first.responsiveRules,
      omissionSubstitutionFallback: first.omissionSubstitutionFallback,
    })}`;

    expect(first.candidateFingerprint).toBe(expected);
    expect(first.candidateFingerprint).toMatch(
      /^page-blueprint-v2-candidate-v1_[1-9][0-9]*_[0-9a-f]{64}$/u,
    );
    expect(second).toStrictEqual(first);
    expect(Object.keys(first)).toStrictEqual([
      "candidateSchemaVersion",
      "structural",
      "assetRoleCompatibility",
      "responsiveRules",
      "omissionSubstitutionFallback",
      "candidateFingerprint",
    ]);
    expect(first).not.toHaveProperty("normalizedTopologyIdentity");
  });

  it("rejects a stale supplied fingerprint instead of repairing it", () => {
    const candidate = createPageBlueprintV2CandidateAuthority(candidateInput());
    const stale = {
      ...candidate,
      candidateFingerprint: staleFingerprint(candidate.candidateFingerprint),
    };
    expect(() => parsePageBlueprintV2CandidateAuthority(stale)).toThrow(/fingerprint/u);
    expect(pageBlueprintV2CandidateAuthorityV1Schema.safeParse(stale).success).toBe(false);
  });

  it.each([
    [
      "structural authority",
      (input: ReturnType<typeof candidateInput>) => {
        input.structural.regions[0].visualWeight = "heavy";
      },
    ],
    [
      "asset-role authority",
      (input: ReturnType<typeof candidateInput>) => {
        input.assetRoleCompatibility.regionAssetRequirements[0].roleRequirements[0].cardinality = {
          minimum: 1,
          ideal: 2,
          maximum: 2,
        };
      },
    ],
    [
      "responsive authority",
      (input: ReturnType<typeof candidateInput>) => {
        input.responsiveRules.breakpointRules[0].regionProportionRules[0].proportionMode =
          "compress";
      },
    ],
    [
      "fallback terminal authority",
      (input: ReturnType<typeof candidateInput>) => {
        input.omissionSubstitutionFallback.regionFallbackRules[0].terminalResolution =
          "fail-closed";
      },
    ],
  ])("changes when %s changes", (_label, mutate) => {
    const baseline = createPageBlueprintV2CandidateAuthority(candidateInput());
    const changedInput = candidateInput();
    mutate(changedInput);
    expect(createPageBlueprintV2CandidateAuthority(changedInput).candidateFingerprint).not.toBe(
      baseline.candidateFingerprint,
    );
  });

  it("changes for fallback target identity and priority order", () => {
    const targets = [
      { blueprintId: "z-priority-target", blueprintVersion: "1.0.0" },
      { blueprintId: "a-secondary-target", blueprintVersion: "1.7.0" },
    ] as const;
    const baseline = createPageBlueprintV2CandidateAuthority(
      candidateInput({ substitutionTargets: targets }),
    );
    const changedTarget = createPageBlueprintV2CandidateAuthority(
      candidateInput({
        substitutionTargets: [targets[0], { blueprintId: "b-target", blueprintVersion: "1.7.0" }],
      }),
    );
    const reversed = createPageBlueprintV2CandidateAuthority(
      candidateInput({ substitutionTargets: [...targets].reverse() }),
    );

    expect(changedTarget.candidateFingerprint).not.toBe(baseline.candidateFingerprint);
    expect(reversed.candidateFingerprint).not.toBe(baseline.candidateFingerprint);
    expect(baseline.omissionSubstitutionFallback.blueprintSubstitutionCandidates).toStrictEqual(
      targets,
    );
  });

  it("normalizes only semantically irrelevant child collection ordering", () => {
    const baselineInput = candidateInput({
      substitutionTargets: [
        { blueprintId: "z-priority-target", blueprintVersion: "1.0.0" },
        { blueprintId: "a-secondary-target", blueprintVersion: "1.0.0" },
      ],
    });
    const permuted = clone(baselineInput);
    permuted.structural.regions.reverse();
    permuted.assetRoleCompatibility.regionAssetRequirements.reverse();
    permuted.responsiveRules.breakpointRules.reverse();
    permuted.responsiveRules.breakpointRules.forEach((rule) =>
      rule.regionProportionRules.reverse(),
    );
    permuted.omissionSubstitutionFallback.regionFallbackRules.reverse();

    expect(createPageBlueprintV2CandidateAuthority(permuted)).toStrictEqual(
      createPageBlueprintV2CandidateAuthority(baselineInput),
    );
  });
});

describe("P10B-19A-07 exact PageBlueprint candidate references", () => {
  it("accepts only exact ID/version authority and derives deterministic identity", () => {
    const first = { blueprintId: "home-candidate", blueprintVersion: "1.2.0" };
    const second = { blueprintId: "home-candidate", blueprintVersion: "1.10.0" };
    expect(pageBlueprintV2CandidateReferenceSchema.parse(first)).toStrictEqual(first);
    expect(createPageBlueprintV2CandidateReferenceIdentityKey(first)).toBe("home-candidate@1.2.0");
    expect(createPageBlueprintV2CandidateReferenceIdentityKey(second)).not.toBe(
      createPageBlueprintV2CandidateReferenceIdentityKey(first),
    );
  });

  it.each([
    ["malformed ID", { blueprintId: "Home Candidate", blueprintVersion: "1.0.0" }],
    ["malformed version", { blueprintId: "home-candidate", blueprintVersion: "v1" }],
    ["unknown field", { blueprintId: "home-candidate", blueprintVersion: "1.0.0", priority: 1 }],
  ])("rejects %s", (_label, reference) => {
    expect(pageBlueprintV2CandidateReferenceSchema.safeParse(reference).success).toBe(false);
  });
});

describe("P10B-19A-07 Structural Storefront Family candidate composition", () => {
  it("accepts exact A-01 candidate identity/lifecycle and all six A-02 page families", () => {
    const candidate = createStructuralStorefrontFamilyCandidate(familyCandidateInput());
    expect(candidate).toMatchObject({
      candidateSchemaVersion: STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_SCHEMA_VERSION,
      familyId: "editorial-offset",
      familyVersion: "1.0.0",
      lifecycleState: "candidate",
    });
    expect(
      structuralStorefrontFamilyIdentityKey({
        familyId: candidate.familyId,
        familyVersion: candidate.familyVersion,
      }),
    ).toBe("editorial-offset@1.0.0");
    expect(candidate.pageFamilyProfiles.map(({ pageFamilyId }) => pageFamilyId)).toStrictEqual(
      structuralStorefrontPageFamilyIds,
    );
    expect(deepFrozen(candidate)).toBe(true);
  });

  it.each(["active", "deprecated", "unknown"])("rejects %s lifecycle", (lifecycleState) => {
    expect(() =>
      createStructuralStorefrontFamilyCandidate({
        ...familyCandidateInput(),
        lifecycleState,
      }),
    ).toThrow();
  });

  it("rejects a missing lifecycle without defaulting it", () => {
    const input = familyCandidateInput() as Record<string, unknown>;
    delete input.lifecycleState;
    expect(() => createStructuralStorefrontFamilyCandidate(input)).toThrow();
  });

  it("rejects missing, duplicate and unknown page-family profiles", () => {
    const missing = familyCandidateInput();
    missing.pageFamilyProfiles.pop();
    expect(() => createStructuralStorefrontFamilyCandidate(missing)).toThrow();

    const duplicate = familyCandidateInput();
    duplicate.pageFamilyProfiles[5] = clone(duplicate.pageFamilyProfiles[0]);
    expect(() => createStructuralStorefrontFamilyCandidate(duplicate)).toThrow(/page-family/u);

    const unknown = familyCandidateInput();
    (unknown.pageFamilyProfiles[0] as { pageFamilyId: string }).pageFamilyId = "checkout";
    expect(() => createStructuralStorefrontFamilyCandidate(unknown)).toThrow();
  });

  it("rejects empty, oversized and duplicate exact references", () => {
    const empty = familyCandidateInput();
    empty.pageFamilyProfiles[0].blueprintCandidates = [];
    expect(() => createStructuralStorefrontFamilyCandidate(empty)).toThrow();

    const oversized = familyCandidateInput();
    oversized.pageFamilyProfiles[0].blueprintCandidates = Array.from({ length: 9 }, (_, index) => ({
      blueprintId: "home-candidate",
      blueprintVersion: `1.0.${index}`,
    }));
    expect(() => createStructuralStorefrontFamilyCandidate(oversized)).toThrow();

    const duplicate = familyCandidateInput();
    duplicate.pageFamilyProfiles[0].blueprintCandidates.push(
      clone(duplicate.pageFamilyProfiles[0].blueprintCandidates[0]),
    );
    expect(() => createStructuralStorefrontFamilyCandidate(duplicate)).toThrow(/Duplicate/u);
  });

  it("keeps distinct versions distinct inside one profile", () => {
    const input = familyCandidateInput();
    input.pageFamilyProfiles[0].blueprintCandidates.push({
      blueprintId: "home-candidate",
      blueprintVersion: "1.10.0",
    });
    const candidate = createStructuralStorefrontFamilyCandidate(input);
    expect(candidate.pageFamilyProfiles[0].blueprintCandidates).toStrictEqual([
      { blueprintId: "home-candidate", blueprintVersion: "1.0.0" },
      { blueprintId: "home-candidate", blueprintVersion: "1.10.0" },
    ]);
  });

  it("rejects unknown candidate authority", () => {
    expect(() =>
      createStructuralStorefrontFamilyCandidate({
        ...familyCandidateInput(),
        purpose: "forbidden",
      }),
    ).toThrow();
  });
});

describe("P10B-19A-07 A-02 relationship composition", () => {
  const relationships = [
    {
      sourcePageFamilyId: "search",
      relationshipKind: "hierarchy-continuity",
      targetPageFamilyId: "home",
    },
    {
      sourcePageFamilyId: "home",
      relationshipKind: "frame-continuity",
      targetPageFamilyId: "collection",
    },
    {
      sourcePageFamilyId: "collection",
      relationshipKind: "navigation-continuity",
      targetPageFamilyId: "search",
    },
  ] as const;

  it("accepts nonempty directed cycles and canonicalizes deterministically", () => {
    const forward = createStructuralStorefrontFamilyCandidate(
      familyCandidateInput({ relationships }),
    );
    const reverseInput = familyCandidateInput({ relationships: [...relationships].reverse() });
    reverseInput.pageFamilyProfiles.reverse();
    const reversed = createStructuralStorefrontFamilyCandidate(reverseInput);
    expect(reversed).toStrictEqual(forward);
  });

  it("keeps reverse directional relationships distinct", () => {
    const candidate = createStructuralStorefrontFamilyCandidate(
      familyCandidateInput({
        relationships: [
          relationships[1],
          {
            sourcePageFamilyId: "collection",
            relationshipKind: "frame-continuity",
            targetPageFamilyId: "home",
          },
        ],
      }),
    );
    expect(candidate.crossPageRelationships).toHaveLength(2);
  });

  it.each([
    ["empty set", []],
    ["exact duplicate", [relationships[1], relationships[1]]],
    [
      "self relationship",
      [
        {
          sourcePageFamilyId: "home",
          relationshipKind: "frame-continuity",
          targetPageFamilyId: "home",
        },
      ],
    ],
  ])("rejects %s", (_label, invalidRelationships) => {
    expect(() =>
      createStructuralStorefrontFamilyCandidate(
        familyCandidateInput({ relationships: invalidRelationships }),
      ),
    ).toThrow();
  });
});

describe("P10B-19A-07 exact Structural Storefront Family candidate fingerprint", () => {
  it("matches exact lifecycle-excluding material and rejects stale content", () => {
    const candidate = createStructuralStorefrontFamilyCandidate(familyCandidateInput());
    const material = {
      candidateSchemaVersion: candidate.candidateSchemaVersion,
      familyId: candidate.familyId,
      familyVersion: candidate.familyVersion,
      pageFamilyProfiles: candidate.pageFamilyProfiles,
      crossPageRelationships: candidate.crossPageRelationships,
    };
    const expected = `structural-storefront-family-candidate-${canonicalValueFingerprint(material)}`;
    const lifecycleIncluded = `structural-storefront-family-candidate-${canonicalValueFingerprint({
      ...material,
      lifecycleState: candidate.lifecycleState,
    })}`;

    expect(candidate.candidateFingerprint).toBe(expected);
    expect(candidate.candidateFingerprint).not.toBe(lifecycleIncluded);
    expect(candidate.candidateFingerprint).toMatch(
      /^structural-storefront-family-candidate-v1_[1-9][0-9]*_[0-9a-f]{64}$/u,
    );
    expect(createStructuralStorefrontFamilyCandidate(familyCandidateInput())).toStrictEqual(
      candidate,
    );
    expect(() =>
      parseStructuralStorefrontFamilyCandidate({
        ...candidate,
        candidateFingerprint: staleFingerprint(candidate.candidateFingerprint),
      }),
    ).toThrow(/stale/u);
    expect(candidate).not.toHaveProperty("normalizedTopologyIdentity");
  });

  it.each([
    ["family ID", { familyId: "campaign-modular" }],
    ["family version", { familyVersion: "1.0.1" }],
  ])("changes for %s", (_label, identity) => {
    const baseline = createStructuralStorefrontFamilyCandidate(familyCandidateInput());
    const changed = createStructuralStorefrontFamilyCandidate(
      familyCandidateInput(identity as FamilyFixtureOptions),
    );
    expect(changed.candidateFingerprint).not.toBe(baseline.candidateFingerprint);
  });

  it("changes for an exact reference or relationship change", () => {
    const baseline = createStructuralStorefrontFamilyCandidate(familyCandidateInput());
    const referenceInput = familyCandidateInput();
    referenceInput.pageFamilyProfiles[0].blueprintCandidates[0].blueprintVersion = "1.0.1";
    const relationshipInput = familyCandidateInput({
      relationships: [
        {
          sourcePageFamilyId: "home",
          relationshipKind: "navigation-continuity",
          targetPageFamilyId: "collection",
        },
      ],
    });

    expect(createStructuralStorefrontFamilyCandidate(referenceInput).candidateFingerprint).not.toBe(
      baseline.candidateFingerprint,
    );
    expect(
      createStructuralStorefrontFamilyCandidate(relationshipInput).candidateFingerprint,
    ).not.toBe(baseline.candidateFingerprint);
  });

  it("is stable across profile, reference and relationship input permutations", () => {
    const relationships = [
      {
        sourcePageFamilyId: "home",
        relationshipKind: "frame-continuity",
        targetPageFamilyId: "collection",
      },
      {
        sourcePageFamilyId: "collection",
        relationshipKind: "navigation-continuity",
        targetPageFamilyId: "search",
      },
    ] as const;
    const baselineInput = familyCandidateInput({ relationships });
    baselineInput.pageFamilyProfiles[0].blueprintCandidates.push({
      blueprintId: "a-home-candidate",
      blueprintVersion: "1.10.0",
    });
    const permuted = clone(baselineInput);
    permuted.pageFamilyProfiles.reverse();
    permuted.pageFamilyProfiles
      .find(({ pageFamilyId }) => pageFamilyId === "home")
      ?.blueprintCandidates.reverse();
    permuted.crossPageRelationships = [...permuted.crossPageRelationships].reverse();
    expect(createStructuralStorefrontFamilyCandidate(permuted)).toStrictEqual(
      createStructuralStorefrontFamilyCandidate(baselineInput),
    );
  });
});

describe("P10B-19A-07 empty inactive production registry", () => {
  it("exports exactly the strict, empty, deeply readonly registry", () => {
    expect(INACTIVE_STRUCTURAL_STOREFRONT_FAMILY_CANDIDATE_REGISTRY_SCHEMA_VERSION).toBe("1.0.0");
    expect(inactiveStructuralStorefrontFamilyCandidateRegistry).toStrictEqual({
      contractSchemaVersion: "1.0.0",
      pageBlueprintCandidates: [],
      familyCandidates: [],
    });
    expect(deepFrozen(inactiveStructuralStorefrontFamilyCandidateRegistry)).toBe(true);
    expect(
      inactiveStructuralStorefrontFamilyCandidateRegistry.pageBlueprintCandidates,
    ).toHaveLength(0);
    expect(inactiveStructuralStorefrontFamilyCandidateRegistry.familyCandidates).toHaveLength(0);
    expect(
      inactiveStructuralStorefrontFamilyCandidateRegistry.familyCandidates.filter(
        ({ lifecycleState }) => String(lifecycleState) === "active",
      ),
    ).toHaveLength(0);
    expect(
      inactiveStructuralStorefrontFamilyCandidateRegistry.familyCandidates.filter(
        ({ lifecycleState }) => isStructuralStorefrontFamilySelectable(lifecycleState),
      ),
    ).toHaveLength(0);
    expect(
      new Set(
        inactiveStructuralStorefrontFamilyCandidateRegistry.familyCandidates.map(
          ({ familyId }) => familyId,
        ),
      ),
    ).not.toStrictEqual(new Set(structuralStorefrontFamilyIds));
  });

  it("accepts empty collections but rejects missing and unknown registry authority", () => {
    expect(
      inactiveStructuralStorefrontFamilyCandidateRegistryV1Schema.parse({
        contractSchemaVersion: "1.0.0",
        pageBlueprintCandidates: [],
        familyCandidates: [],
      }),
    ).toStrictEqual(inactiveStructuralStorefrontFamilyCandidateRegistry);
    expect(
      inactiveStructuralStorefrontFamilyCandidateRegistryV1Schema.safeParse({
        contractSchemaVersion: "1.0.0",
        familyCandidates: [],
      }).success,
    ).toBe(false);
    expect(
      inactiveStructuralStorefrontFamilyCandidateRegistryV1Schema.safeParse({
        ...inactiveStructuralStorefrontFamilyCandidateRegistry,
        selected: null,
      }).success,
    ).toBe(false);
  });

  it("exports no production candidate record, placeholder family set or registry fingerprint", () => {
    const registryExports = Object.entries(storefrontTemplateAuthority).filter(
      ([, value]) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.hasOwn(value, "contractSchemaVersion") &&
        Object.hasOwn(value, "pageBlueprintCandidates") &&
        Object.hasOwn(value, "familyCandidates"),
    );
    const candidateRecords = Object.entries(storefrontTemplateAuthority).filter(
      ([, value]) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.hasOwn(value, "candidateSchemaVersion") &&
        Object.hasOwn(value, "candidateFingerprint"),
    );
    expect(registryExports).toStrictEqual([
      [
        "inactiveStructuralStorefrontFamilyCandidateRegistry",
        inactiveStructuralStorefrontFamilyCandidateRegistry,
      ],
    ]);
    expect(candidateRecords).toStrictEqual([]);
    expect(inactiveStructuralStorefrontFamilyCandidateRegistry).not.toHaveProperty(
      "registryFingerprint",
    );
  });
});

describe("P10B-19A-07 registry identity, references and canonical order", () => {
  it("accepts one test-only nonempty registry with exact references", () => {
    const candidates = createPageFamilyCandidates();
    const family = createFamilyForCandidates(candidates);
    const registry = canonicalRegistry(candidates, [family]);
    expect(registry.pageBlueprintCandidates).toHaveLength(6);
    expect(registry.familyCandidates).toHaveLength(1);
    expect(deepFrozen(registry)).toBe(true);
  });

  it("rejects duplicate PageBlueprint and family identities", () => {
    const candidates = createPageFamilyCandidates();
    const family = createFamilyForCandidates(candidates);
    expect(() => canonicalRegistry([...candidates, candidates[0]], [family])).toThrow(
      /Duplicate PageBlueprint/u,
    );
    expect(() => canonicalRegistry(candidates, [family, family])).toThrow(
      /Duplicate Structural Storefront Family/u,
    );
  });

  it("rejects unknown and wrong-page-family family references", () => {
    const candidates = createPageFamilyCandidates();
    const unknownInput = familyCandidateInput();
    unknownInput.pageFamilyProfiles[0].blueprintCandidates = [
      { blueprintId: "missing-home", blueprintVersion: "1.0.0" },
    ];
    const unknownFamily = createStructuralStorefrontFamilyCandidate(unknownInput);
    expect(() => canonicalRegistry(candidates, [unknownFamily])).toThrow(/Unknown/u);

    const wrongInput = familyCandidateInput();
    wrongInput.pageFamilyProfiles[0].blueprintCandidates = [referenceFor(candidates[1])];
    const wrongFamily = createStructuralStorefrontFamilyCandidate(wrongInput);
    expect(() => canonicalRegistry(candidates, [wrongFamily])).toThrow(/does not belong/u);
  });

  it("allows shared and unreferenced PageBlueprint candidates without selecting either", () => {
    const candidates = createPageFamilyCandidates();
    const extra = createPageBlueprintV2CandidateAuthority(
      candidateInput({ id: "unreferenced-home", pageFamilyId: "home" }),
    );
    const firstFamily = createFamilyForCandidates(candidates, { familyId: "editorial-offset" });
    const secondFamily = createFamilyForCandidates(candidates, { familyId: "campaign-modular" });
    const registry = canonicalRegistry([...candidates, extra], [secondFamily, firstFamily]);
    expect(registry.pageBlueprintCandidates).toContainEqual(extra);
    expect(registry.familyCandidates).toHaveLength(2);
    expect(registry).not.toHaveProperty("selected");
  });

  it("allows identical structural topology under distinct exact identities", () => {
    const first = createPageBlueprintV2CandidateAuthority(
      candidateInput({ id: "home-topology-a" }),
    );
    const second = createPageBlueprintV2CandidateAuthority(
      candidateInput({ id: "home-topology-b" }),
    );
    expect(() => canonicalRegistry([first, second])).not.toThrow();
    expect(first.candidateFingerprint).not.toBe(second.candidateFingerprint);
  });

  it("keeps one ID at distinct versions and orders versions without precision loss", () => {
    const versions = [
      "1.900719925474099312345678901234567890.0",
      "1.10.0",
      "1.90071992547409931234567890123456789.0",
      "1.2.0",
    ];
    const candidates = versions.map((version) =>
      createPageBlueprintV2CandidateAuthority(candidateInput({ id: "home-versioned", version })),
    );
    const registry = canonicalRegistry(candidates);
    expect(
      registry.pageBlueprintCandidates.map(({ structural }) => structural.version),
    ).toStrictEqual([
      "1.2.0",
      "1.10.0",
      "1.90071992547409931234567890123456789.0",
      "1.900719925474099312345678901234567890.0",
    ]);
  });

  it("canonicalizes PageBlueprint and family arrays by their binding authority order", () => {
    const candidates = createPageFamilyCandidates();
    const homeZ = createPageBlueprintV2CandidateAuthority(
      candidateInput({ id: "z-home", pageFamilyId: "home", version: "1.10.0" }),
    );
    const homeA = createPageBlueprintV2CandidateAuthority(
      candidateInput({ id: "a-home", pageFamilyId: "home", version: "1.2.0" }),
    );
    const firstFamily = createFamilyForCandidates(candidates, {
      familyId: "editorial-offset",
      familyVersion: "1.10.0",
    });
    const secondFamily = createFamilyForCandidates(candidates, {
      familyId: "editorial-offset",
      familyVersion: "1.2.0",
    });
    const thirdFamily = createFamilyForCandidates(candidates, {
      familyId: "campaign-modular",
      familyVersion: "1.0.0",
    });
    const registry = canonicalRegistry(
      [candidates[5], homeZ, candidates[1], homeA, candidates[0], ...candidates.slice(2, 5)],
      [thirdFamily, firstFamily, secondFamily],
    );

    expect(
      registry.pageBlueprintCandidates
        .slice(0, 4)
        .map(createPageBlueprintV2CandidateAuthorityIdentityKey),
    ).toStrictEqual([
      "a-home@1.2.0",
      "home-candidate@1.0.0",
      "z-home@1.10.0",
      "collection-candidate@1.0.0",
    ]);
    expect(
      registry.familyCandidates.map(({ familyId, familyVersion }) =>
        structuralStorefrontFamilyIdentityKey({ familyId, familyVersion }),
      ),
    ).toStrictEqual([
      "editorial-offset@1.2.0",
      "editorial-offset@1.10.0",
      "campaign-modular@1.0.0",
    ]);
  });
});

describe("P10B-19A-07 A-06 substitution-target integrity", () => {
  function graphCandidate(
    id: string,
    targets: readonly PageBlueprintV2CandidateReference[] = [],
    options: Readonly<{
      version?: string;
      pageFamilyId?: StructuralStorefrontPageFamilyId;
    }> = {},
  ) {
    return createPageBlueprintV2CandidateAuthority(
      candidateInput({
        id,
        version: options.version,
        pageFamilyId: options.pageFamilyId,
        substitutionTargets: targets,
      }),
    );
  }

  it("accepts a same-page-family target and an acyclic chain", () => {
    const terminal = graphCandidate("terminal");
    const middle = graphCandidate("middle", [referenceFor(terminal)]);
    const source = graphCandidate("source", [referenceFor(middle)]);
    expect(canonicalRegistry([source, middle, terminal]).pageBlueprintCandidates).toHaveLength(3);
  });

  it("rejects a missing or wrong-page-family target", () => {
    const missingSource = graphCandidate("missing-source", [
      { blueprintId: "absent", blueprintVersion: "1.0.0" },
    ]);
    expect(() => canonicalRegistry([missingSource])).toThrow(/Unknown/u);

    const collectionTarget = graphCandidate("collection-target", [], {
      pageFamilyId: "collection",
    });
    const wrongSource = graphCandidate("wrong-source", [referenceFor(collectionTarget)]);
    expect(() => canonicalRegistry([wrongSource, collectionTarget])).toThrow(/does not belong/u);
  });

  it("rejects a direct self-reference before registry repair is possible", () => {
    expect(() =>
      graphCandidate("self-source", [{ blueprintId: "self-source", blueprintVersion: "1.0.0" }]),
    ).toThrow();
  });

  it("rejects two-node, indirect and cross-version cycles", () => {
    const a = graphCandidate("cycle-a", [{ blueprintId: "cycle-b", blueprintVersion: "1.0.0" }]);
    const b = graphCandidate("cycle-b", [referenceFor(a)]);
    expect(() => canonicalRegistry([a, b])).toThrow(/acyclic/u);

    const indirectA = graphCandidate("indirect-a", [
      { blueprintId: "indirect-b", blueprintVersion: "1.0.0" },
    ]);
    const indirectB = graphCandidate("indirect-b", [
      { blueprintId: "indirect-c", blueprintVersion: "1.0.0" },
    ]);
    const indirectC = graphCandidate("indirect-c", [referenceFor(indirectA)]);
    expect(() => canonicalRegistry([indirectC, indirectA, indirectB])).toThrow(/acyclic/u);

    const versionedA = graphCandidate(
      "versioned-a",
      [{ blueprintId: "versioned-b", blueprintVersion: "1.10.0" }],
      { version: "1.2.0" },
    );
    const versionedB = graphCandidate("versioned-b", [referenceFor(versionedA)], {
      version: "1.10.0",
    });
    expect(() => canonicalRegistry([versionedA, versionedB])).toThrow(/acyclic/u);
  });

  it("allows multiple sources to one terminal target", () => {
    const target = graphCandidate("shared-target");
    const first = graphCandidate("first-source", [referenceFor(target)]);
    const second = graphCandidate("second-source", [referenceFor(target)]);
    expect(canonicalRegistry([second, target, first]).pageBlueprintCandidates).toHaveLength(3);
  });

  it("preserves declared A-06 target priority exactly", () => {
    const zTarget = graphCandidate("z-target");
    const aTarget = graphCandidate("a-target");
    const source = graphCandidate("priority-source", [
      referenceFor(zTarget),
      referenceFor(aTarget),
    ]);
    const registry = canonicalRegistry([aTarget, source, zTarget]);
    const canonicalSource = registry.pageBlueprintCandidates.find(
      ({ structural }) => structural.id === "priority-source",
    );
    expect(
      canonicalSource?.omissionSubstitutionFallback.blueprintSubstitutionCandidates.map(
        createPageBlueprintV2CandidateReferenceIdentityKey,
      ),
    ).toStrictEqual(["z-target@1.0.0", "a-target@1.0.0"]);
  });
});

describe("P10B-19A-07 forbidden later authority", () => {
  const forbiddenFields = [
    "purpose",
    "supportedConditions",
    "frameComposition",
    "componentFamilyCompatibility",
    "visualRecipeConstraints",
    "normalizedTopologyIdentity",
    "selectionScore",
    "selected",
    "default",
    "activationEvidence",
    "merchantId",
    "providerPayload",
    "componentId",
    "assetId",
    "snapshot",
    "puckData",
    "createdAt",
  ] as const;

  it.each(forbiddenFields)("rejects %s at every A-07 root", (field) => {
    expect(() =>
      createPageBlueprintV2CandidateAuthority({
        ...candidateInput(),
        [field]: "forbidden",
      }),
    ).toThrow();
    expect(() =>
      createStructuralStorefrontFamilyCandidate({
        ...familyCandidateInput(),
        [field]: "forbidden",
      }),
    ).toThrow();
    expect(
      inactiveStructuralStorefrontFamilyCandidateRegistryV1Schema.safeParse({
        ...inactiveStructuralStorefrontFamilyCandidateRegistry,
        [field]: "forbidden",
      }).success,
    ).toBe(false);
  });
});

describe("P10B-19A-07 architecture and inactivity boundary", () => {
  it("keeps A-01 through A-06 and current v1/runtime authority byte-identical", () => {
    expect(fingerprintProtectedAuthority(resolve(process.cwd()))).toBe(
      approvedProtectedAuthorityFingerprint,
    );
  });

  it("keeps the candidate registry confined to inactive authority modules", () => {
    const repositoryRoot = resolve(process.cwd());
    const consumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .filter((path) =>
        readFileSync(path, "utf8").includes("structural-storefront-family-candidate-registry"),
      )
      .map((path) => relative(repositoryRoot, path));
    expect(consumers).toStrictEqual([
      "src/application/storefront-templates/index.ts",
      "src/application/storefront-templates/structural-storefront-candidate-compatibility-evaluation.ts",
      "src/application/storefront-templates/structural-storefront-compatibility-contract.ts",
      "src/application/storefront-templates/structural-storefront-family-normalized-topology.ts",
    ]);
  });

  it("exports A-08B compatibility but no A-08C selection authority", () => {
    const forbiddenExports = Object.keys(storefrontTemplateAuthority).filter((name) =>
      /StructuralStorefrontFamily.*(?:select|score|rank|winner)|(?:select|score|rank|winner).*StructuralStorefrontFamily/iu.test(
        name,
      ),
    );
    expect(forbiddenExports).toStrictEqual([]);
    expect(
      storefrontTemplateAuthority.deriveStructuralStorefrontFamilyNormalizedTopology,
    ).toBeTypeOf("function");
    expect(
      storefrontTemplateAuthority.evaluateInactiveStructuralStorefrontCandidateCompatibility,
    ).toBeTypeOf("function");
    expect(structuralStorefrontFamilyCandidateV1Schema).toBeDefined();
  });
});
