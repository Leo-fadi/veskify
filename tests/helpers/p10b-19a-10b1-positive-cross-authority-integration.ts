import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import {
  createPageBlueprintV2CandidateAuthority,
  createPageBlueprintV2CandidateAuthorityIdentityKey,
  type PageBlueprintV2CandidateAuthorityV1,
  type PageBlueprintV2CandidateReference,
} from "@/application/storefront-templates/page-blueprint-v2-candidate-authority";
import {
  createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
  createStructuralStorefrontCapabilityContext,
  createStructuralStorefrontFamilyCompatibilityProfile,
} from "@/application/storefront-templates/structural-storefront-compatibility-contract";
import {
  evaluateInactiveStructuralStorefrontCandidateCompatibility,
  type StructuralStorefrontCandidateCompatibilityEvaluationV1,
} from "@/application/storefront-templates/structural-storefront-candidate-compatibility-evaluation";
import {
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  createStructuralStorefrontFamilyCandidate,
  type StructuralStorefrontFamilyCandidateV1,
} from "@/application/storefront-templates/structural-storefront-family-candidate-registry";
import { deriveInactiveCandidateNormalizedTopologyIndex } from "@/application/storefront-templates/structural-storefront-family-normalized-topology";
import {
  parseStructuralStorefrontDeterministicSelectionReceipt,
  selectDeterministicStructuralStorefrontCandidate,
} from "@/application/storefront-templates/structural-storefront-deterministic-selection";
import {
  createStructuralStorefrontDeterministicSelectionRequest,
  type StructuralStorefrontDeterministicSelectionReceiptV1,
  type StructuralStorefrontDeterministicSelectionRequestV1,
} from "@/application/storefront-templates/structural-storefront-selection-contract";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  structuralStorefrontFamilyIdSchema,
  structuralStorefrontFamilyIds,
  structuralStorefrontFamilyIdentityKey,
  structuralStorefrontPageFamilyIds,
  type StructuralStorefrontFamilyId,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family";

import {
  readA09Baselines,
  readRetainedInventory,
  retainedInventoryPath,
  type RetainedInventory,
} from "./p10b-19a-10a-retained-matrix-inventory";

const taskBase = "d946a4a60d3edb5afd8cdb7a162e104750e8fd5d" as const;
const candidateVersion = "1.0.0" as const;
// prettier-ignore
const candidateIds = { home: "test-a10b1-home-primary", collection: "test-a10b1-collection-primary", search: "test-a10b1-search-primary", "product-detail": "test-a10b1-product-detail-primary", "content-support": "test-a10b1-content-support-primary", utility: "test-a10b1-utility-primary", productIntermediate: "test-a10b1-product-detail-intermediate", productTerminal: "test-a10b1-product-detail-terminal" } as const;
// prettier-ignore
const minimumRolesByPageFamily = { home: ["orientation", "primary-discovery"], collection: ["orientation", "primary-discovery"], search: ["orientation", "primary-discovery"], "product-detail": ["product-focus", "conversion"], "content-support": ["orientation"], utility: ["orientation"] } as const;
// prettier-ignore
const assetRoleByPageFamily = { home: "logo", collection: "collectionImage", search: "productMainImage", "product-detail": "productMainImage", "content-support": "editorialImage", utility: "logo" } as const;
// prettier-ignore
const relationshipKindByFamily = { "editorial-offset": "frame-continuity", "campaign-modular": "frame-continuity", "product-first-commerce": "hierarchy-continuity", "technical-comparison": "hierarchy-continuity", "warm-narrative": "recurring-anchor", "restrained-gallery": "recurring-anchor" } as const;

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}

const reference = (
  candidate: PageBlueprintV2CandidateAuthorityV1,
): PageBlueprintV2CandidateReference => ({
  blueprintId: candidate.structural.id,
  blueprintVersion: candidate.structural.version,
});

type CandidateOptions = Readonly<{
  id: string;
  pageFamilyId: StructuralStorefrontPageFamilyId;
  substitutions?: readonly PageBlueprintV2CandidateReference[];
}>;
const unitCardinality = { minimum: 1, ideal: 1, maximum: 1 } as const;
// prettier-ignore
const breakpoints = [["mobile", 375], ["tablet", 768], ["desktop", 1024], ["wide", 1440]] as const;

function createCandidate(options: CandidateOptions): PageBlueprintV2CandidateAuthorityV1 {
  const requiredRegions = minimumRolesByPageFamily[options.pageFamilyId].map((role, index) => ({
    id: `${options.id}-${role}-region`,
    role,
    requirement: "required" as const,
    cardinality: unitCardinality,
    visualWeight: index === 0 ? ("heavy" as const) : ("medium" as const),
  }));
  const optionalContentRegion =
    options.pageFamilyId === "content-support"
      ? [
          {
            id: "test-a10b1-brand-story-region",
            role: "brand-story" as const,
            requirement: "optional" as const,
            cardinality: { minimum: 0, ideal: 1, maximum: 1 },
            visualWeight: "medium" as const,
          },
        ]
      : [];
  const regions = [...requiredRegions, ...optionalContentRegion];
  const assetRegionId =
    options.pageFamilyId === "content-support"
      ? "test-a10b1-brand-story-region"
      : requiredRegions[0].id;
  const identity = { blueprintId: options.id, blueprintVersion: candidateVersion };

  return createPageBlueprintV2CandidateAuthority({
    candidateSchemaVersion: "1.0.0",
    structural: {
      id: options.id,
      version: candidateVersion,
      pageFamilyId: options.pageFamilyId,
      regions,
      relationships: [],
      orderAlternatives: [
        { id: "test-a10b1-canonical-order", regionIds: regions.map(({ id }) => id) },
      ],
      defaultOrderAlternativeId: "test-a10b1-canonical-order",
    },
    assetRoleCompatibility: {
      contractSchemaVersion: "1.0.0",
      ...identity,
      regionAssetRequirements: [
        {
          regionId: assetRegionId,
          roleRequirements: [
            {
              role: assetRoleByPageFamily[options.pageFamilyId],
              requirement: "required",
              cardinality: unitCardinality,
            },
          ],
        },
      ],
    },
    responsiveRules: {
      contractSchemaVersion: "1.0.0",
      ...identity,
      breakpointRules: breakpoints.map(([breakpoint, viewport]) => ({
        breakpoint,
        viewport,
        orderAlternativeId: "test-a10b1-canonical-order",
        regionProportionRules: regions.map(({ id: regionId }) => ({
          regionId,
          proportionMode: "preserve",
        })),
        relationshipTransformations: [],
      })),
    },
    omissionSubstitutionFallback: {
      contractSchemaVersion: "1.0.0",
      ...identity,
      blueprintSubstitutionCandidates: options.substitutions ?? [],
      regionFallbackRules: [
        {
          regionId: assetRegionId,
          trigger: "required-asset-role-cardinality-unsatisfied",
          terminalResolution:
            options.pageFamilyId === "content-support" ? "omit-region" : "fail-closed",
        },
      ],
    },
  });
}

function createCandidates(): readonly PageBlueprintV2CandidateAuthorityV1[] {
  // prettier-ignore
  const terminal = createCandidate({ id: candidateIds.productTerminal, pageFamilyId: "product-detail" });
  // prettier-ignore
  const intermediate = createCandidate({ id: candidateIds.productIntermediate, pageFamilyId: "product-detail", substitutions: [reference(terminal)] });
  // prettier-ignore
  const primaryProduct = createCandidate({ id: candidateIds["product-detail"], pageFamilyId: "product-detail", substitutions: [reference(intermediate)] });
  const primaries = structuralStorefrontPageFamilyIds.map((pageFamilyId) =>
    pageFamilyId === "product-detail"
      ? primaryProduct
      : createCandidate({ id: candidateIds[pageFamilyId], pageFamilyId }),
  );
  return deepFreeze([...primaries, intermediate, terminal]);
}

function createFamilies(
  candidates: readonly PageBlueprintV2CandidateAuthorityV1[],
): readonly StructuralStorefrontFamilyCandidateV1[] {
  const primary = (pageFamilyId: StructuralStorefrontPageFamilyId) => {
    const candidate = candidates.find(
      ({ structural }) => structural.id === candidateIds[pageFamilyId],
    );
    if (!candidate) throw new Error(`Missing A-10B1 primary ${pageFamilyId} candidate.`);
    return candidate;
  };
  return structuralStorefrontFamilyIds.map((familyId) =>
    createStructuralStorefrontFamilyCandidate({
      candidateSchemaVersion: "1.0.0",
      familyId,
      familyVersion: candidateVersion,
      lifecycleState: "candidate",
      pageFamilyProfiles: structuralStorefrontPageFamilyIds.map((pageFamilyId) => ({
        pageFamilyId,
        blueprintCandidates: [reference(primary(pageFamilyId))],
      })),
      crossPageRelationships: [
        {
          sourcePageFamilyId: "home",
          relationshipKind: relationshipKindByFamily[familyId],
          targetPageFamilyId: "collection",
        },
      ],
    }),
  );
}

// prettier-ignore
const exactCompatibilityPolicies = () => [
  { dimension: "catalogue-cardinality", supportedValues: ["standard"], incompatibleValues: ["sparse", "rich"] },
  { dimension: "fact-depth", supportedValues: ["standard"], incompatibleValues: ["sparse", "rich"] },
  { dimension: "product-complexity", supportedValues: ["mixed"], incompatibleValues: ["simple", "configurable"] },
  { dimension: "navigation-depth", supportedValues: ["standard"], incompatibleValues: ["shallow", "deep"] },
  { dimension: "locale", supportedValues: ["en", "fi"], incompatibleValues: [] },
] as const;

type Registry = ReturnType<typeof canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry>;

function createContext(
  registry: Registry,
  activeLocale: "en" | "fi",
  capacityMode: "direct" | "mixed",
) {
  const unavailable = new Set(
    capacityMode === "mixed"
      ? [
          `${candidateIds["product-detail"]}@${candidateVersion}`,
          `${candidateIds.productIntermediate}@${candidateVersion}`,
          `${candidateIds["content-support"]}@${candidateVersion}`,
        ]
      : [],
  );
  return createStructuralStorefrontCapabilityContext(registry, {
    contextSchemaVersion: "1.0.0",
    catalogueCardinality: "standard",
    factDepth: "standard",
    productComplexity: "mixed",
    navigationDepth: "standard",
    activeLocale,
    availableLocales: ["en", "fi"],
    pageBlueprintAssetRoleCapacityEvidence: registry.pageBlueprintCandidates.map((candidate) => ({
      blueprintId: candidate.structural.id,
      blueprintVersion: candidate.structural.version,
      exactCandidateFingerprint: candidate.candidateFingerprint,
      requiredRoleCapacities: candidate.assetRoleCompatibility.regionAssetRequirements.flatMap(
        ({ regionId, roleRequirements }) =>
          roleRequirements
            .filter(({ requirement }) => requirement === "required")
            .map(({ role }) => ({
              regionId,
              role,
              satisfiableMinimumCapacity: unavailable.has(
                createPageBlueprintV2CandidateAuthorityIdentityKey(candidate),
              )
                ? 0
                : 1,
            })),
      ),
    })),
  });
}

type Context = ReturnType<typeof createContext>;
type TopologyIndex = ReturnType<typeof deriveInactiveCandidateNormalizedTopologyIndex>;
type ProfileCatalogue = ReturnType<
  typeof createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue
>;

function evaluate(
  candidateRegistry: Registry,
  normalizedTopologyIndex: TopologyIndex,
  capabilityContext: Context,
  compatibilityProfileCatalogue: ProfileCatalogue,
) {
  return evaluateInactiveStructuralStorefrontCandidateCompatibility({
    candidateRegistry,
    normalizedTopologyIndex,
    capabilityContext,
    compatibilityProfileCatalogue,
  });
}

type SelectionBundle = Readonly<{
  selectionRequest: StructuralStorefrontDeterministicSelectionRequestV1;
  selectionReceipt: StructuralStorefrontDeterministicSelectionReceiptV1;
}>;

function select(
  authority: Readonly<{
    candidateRegistry: Registry;
    normalizedTopologyIndex: TopologyIndex;
    capabilityContext: Context;
    compatibilityProfileCatalogue: ProfileCatalogue;
    compatibilityEvaluation: StructuralStorefrontCandidateCompatibilityEvaluationV1;
  }>,
  input: Readonly<{
    selectionCaseId: string;
    eligibleFamilyIds: readonly StructuralStorefrontFamilyId[];
    excludedFamilyTopologyFingerprints?: readonly string[];
    excludedCompleteStoreTopologyFingerprints?: readonly string[];
  }>,
): SelectionBundle {
  const selectionRequest = createStructuralStorefrontDeterministicSelectionRequest(
    authority.compatibilityEvaluation.evaluationFingerprint,
    {
      requestSchemaVersion: "1.0.0",
      selectionPolicyVersion: "1.0.0",
      selectionCaseId: input.selectionCaseId,
      compatibilityEvaluationFingerprint: authority.compatibilityEvaluation.evaluationFingerprint,
      eligibleFamilyIds: input.eligibleFamilyIds,
      excludedFamilyCandidateIdentityKeys: [],
      excludedFamilyTopologyFingerprints: input.excludedFamilyTopologyFingerprints ?? [],
      excludedCompleteStoreTopologyFingerprints:
        input.excludedCompleteStoreTopologyFingerprints ?? [],
    },
  );
  const selectorAuthority = {
    candidateRegistry: authority.candidateRegistry,
    normalizedTopologyIndex: authority.normalizedTopologyIndex,
    capabilityContext: authority.capabilityContext,
    compatibilityProfileCatalogue: authority.compatibilityProfileCatalogue,
    compatibilityEvaluation: authority.compatibilityEvaluation,
    selectionRequest,
  };
  const selectionReceipt = selectDeterministicStructuralStorefrontCandidate(selectorAuthority);
  parseStructuralStorefrontDeterministicSelectionReceipt(selectorAuthority, selectionReceipt);
  return deepFreeze({ selectionRequest, selectionReceipt });
}

export function createPositiveCrossAuthorityIntegrationAuthority() {
  const pageBlueprintCandidates = createCandidates();
  const familyCandidates = createFamilies(pageBlueprintCandidates);
  const candidateRegistry = canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry({
    contractSchemaVersion: "1.0.0",
    pageBlueprintCandidates,
    familyCandidates,
  });
  const normalizedTopologyIndex = deriveInactiveCandidateNormalizedTopologyIndex(candidateRegistry);
  const compatibilityProfileCatalogue =
    createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
      contractSchemaVersion: "1.0.0",
      profiles: candidateRegistry.familyCandidates.map((familyCandidate) =>
        createStructuralStorefrontFamilyCompatibilityProfile(familyCandidate, {
          profileSchemaVersion: "1.0.0",
          familyId: familyCandidate.familyId,
          familyVersion: familyCandidate.familyVersion,
          exactFamilyCandidateFingerprint: familyCandidate.candidateFingerprint,
          conditionPolicies: exactCompatibilityPolicies(),
        }),
      ),
    });
  const contexts = deepFreeze({
    directEn: createContext(candidateRegistry, "en", "direct"),
    directFi: createContext(candidateRegistry, "fi", "direct"),
    mixedEn: createContext(candidateRegistry, "en", "mixed"),
  });
  const evaluationFor = (capabilityContext: Context) =>
    evaluate(
      candidateRegistry,
      normalizedTopologyIndex,
      capabilityContext,
      compatibilityProfileCatalogue,
    );
  const evaluations = deepFreeze({
    directEn: evaluationFor(contexts.directEn),
    directFi: evaluationFor(contexts.directFi),
    mixedEn: evaluationFor(contexts.mixedEn),
  });
  const selectionAuthority = (
    capabilityContext: Context,
    compatibilityEvaluation: StructuralStorefrontCandidateCompatibilityEvaluationV1,
  ) => ({
    candidateRegistry,
    normalizedTopologyIndex,
    capabilityContext,
    compatibilityProfileCatalogue,
    compatibilityEvaluation,
  });
  const directEnAuthority = selectionAuthority(contexts.directEn, evaluations.directEn);
  const familyConstrainedDirect = candidateRegistry.familyCandidates.map((familyCandidate) => ({
    familyId: familyCandidate.familyId,
    ...select(directEnAuthority, {
      selectionCaseId: `test-a10b1-direct-${familyCandidate.familyId}`,
      eligibleFamilyIds: [familyCandidate.familyId],
    }),
  }));
  const localeEquivalent = (["en", "fi"] as const).map((locale) => ({
    locale,
    ...select(
      selectionAuthority(
        contexts[locale === "en" ? "directEn" : "directFi"],
        evaluations[locale === "en" ? "directEn" : "directFi"],
      ),
      {
        selectionCaseId: `test-a10b1-locale-equivalent-${locale}`,
        eligibleFamilyIds: ["editorial-offset", "campaign-modular"],
      },
    ),
  }));
  const mixed = select(selectionAuthority(contexts.mixedEn, evaluations.mixedEn), {
    selectionCaseId: "test-a10b1-mixed-positive-path",
    eligibleFamilyIds: ["editorial-offset"],
  });
  const sequential: SelectionBundle[] = [];
  for (let index = 0; index < 3; index += 1) {
    const receipts = sequential.map(({ selectionReceipt }) => selectionReceipt);
    sequential.push(
      select(directEnAuthority, {
        selectionCaseId: `test-a10b1-sequential-${index + 1}`,
        eligibleFamilyIds: structuralStorefrontFamilyIds,
        excludedFamilyTopologyFingerprints: receipts.map(
          ({ selectedFamilyCandidate }) => selectedFamilyCandidate.normalizedTopologyFingerprint,
        ),
        excludedCompleteStoreTopologyFingerprints: receipts.map(
          ({ selectedCompleteStoreTopology }) => selectedCompleteStoreTopology.topologyFingerprint,
        ),
      }),
    );
  }

  return deepFreeze({
    candidateRegistry,
    normalizedTopologyIndex,
    compatibilityProfileCatalogue,
    contexts,
    evaluations,
    selections: { familyConstrainedDirect, localeEquivalent, mixed, sequential },
    retainedInventory: readRetainedInventory(),
  });
}

export type PositiveCrossAuthorityIntegrationAuthority = ReturnType<
  typeof createPositiveCrossAuthorityIntegrationAuthority
>;

const fingerprintSchema = z.string().regex(/^(?:[a-z0-9-]+-)?v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
// prettier-ignore
const identitySchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*@1\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u);
const countSchema = z.number().int().nonnegative();
// prettier-ignore
const readonlyStrict = <Shape extends z.ZodRawShape>(shape: Shape) => z.strictObject(shape).readonly();
// prettier-ignore
const statusCountsSchema = readonlyStrict({ direct: countSchema, substitution: countSchema, omission: countSchema, incompatible: countSchema });
// prettier-ignore
const familyStatusCountsSchema = readonlyStrict({ direct: countSchema, conditional: countSchema, incompatible: countSchema });
// prettier-ignore
const evaluationEvidenceSchema = readonlyStrict({
  evaluationId: z.enum(["direct-en", "direct-fi", "mixed-fallback-en"]), activeLocale: z.enum(["en", "fi"]), contextFingerprint: fingerprintSchema, evaluationFingerprint: fingerprintSchema,
  pageStatusCounts: statusCountsSchema, familyStatusCounts: familyStatusCountsSchema,
});
// prettier-ignore
const selectionCoreShape = {
  selectionCaseId: z.string().min(1), requestFingerprint: fingerprintSchema, selectionFingerprint: fingerprintSchema,
  selectedFamilyIdentityKey: identitySchema, selectedFamilyTopologyFingerprint: fingerprintSchema, selectedCompleteStoreTopologyFingerprint: fingerprintSchema,
  selectedPageCandidateIdentityKeys: z.array(identitySchema).length(6).readonly(),
} as const;
// prettier-ignore
const familyDirectSelectionSchema = readonlyStrict({ familyId: structuralStorefrontFamilyIdSchema, ...selectionCoreShape });
const localeSelectionSchema = readonlyStrict({
  locale: z.enum(["en", "fi"]),
  ...selectionCoreShape,
});
// prettier-ignore
const mixedSelectionSchema = readonlyStrict({ ...selectionCoreShape, resolutionModeCounts: readonlyStrict({ direct: countSchema, substitution: countSchema, omission: countSchema }), productDetailSubstitutionPath: z.array(identitySchema).length(2).readonly(), productDetailTerminalCandidateIdentityKey: identitySchema, contentSupportOmittedRegionIds: z.array(z.string().min(1)).length(1).readonly() });
// prettier-ignore
const sequentialSelectionSchema = readonlyStrict({ ...selectionCoreShape, eligibleFamilyIds: z.array(structuralStorefrontFamilyIdSchema).length(6).readonly(), excludedFamilyTopologyFingerprints: z.array(fingerprintSchema).max(2).readonly(), excludedCompleteStoreTopologyFingerprints: z.array(fingerprintSchema).max(2).readonly() });
// prettier-ignore
const a10aAuthoritySchema = readonlyStrict({ inventoryFingerprint: fingerprintSchema, fixtureSha256: sha256Schema, retainedSemanticMetricsFingerprint: fingerprintSchema, matrixEntryCount: z.literal(24), protectedProductionHashCount: z.literal(76), productionInactivityAssertionCount: z.literal(9), completeCaseCount: z.literal(126), frozenCaseCount: z.literal(72) });
// prettier-ignore
const fixtureCountsSchema = readonlyStrict({ pageBlueprintCandidateCount: z.literal(8), primaryPageBlueprintCandidateCount: z.literal(6), fallbackOnlyPageBlueprintCandidateCount: z.literal(2), structuralFamilyCandidateCount: z.literal(6), compatibilityProfileCount: z.literal(6), capabilityContextCount: z.literal(3), canonicalPageFamilyRoleCount: z.literal(6), canonicalStructuralFamilyIdCount: z.literal(6) });
// prettier-ignore
const topologyEvidenceSchema = readonlyStrict({ pageBlueprintTopologyCount: z.literal(8), structuralFamilyTopologyCount: z.literal(6), duplicateFamilyTopologyClusterCount: z.literal(3), identitiesPerDuplicateCluster: z.literal(2), pageBlueprintTopologies: z.array(z.string().min(1)).length(8).readonly(), structuralFamilyTopologies: z.array(z.string().min(1)).length(6).readonly(), duplicateFamilyTopologyClusters: z.array(z.string().min(1)).length(3).readonly() });
// prettier-ignore
const compatibilityEvidenceSchema = readonlyStrict({ profileCatalogueFingerprint: fingerprintSchema, evaluationCount: z.literal(3), evaluations: z.array(evaluationEvidenceSchema).length(3).readonly() });
// prettier-ignore
const selectionEvidenceGroupSchema = readonlyStrict({ familyConstrainedDirect: z.array(familyDirectSelectionSchema).length(6).readonly(), localeEquivalent: z.array(localeSelectionSchema).length(2).readonly(), mixedFallback: mixedSelectionSchema, sequentialDistinct: z.array(sequentialSelectionSchema).length(3).readonly() });
// prettier-ignore
const legacyCompatibilityEvidenceSchema = readonlyStrict({ legacyAliasCount: z.literal(3), historicalRepresentativeCount: z.literal(3), previewObservationExpectedCount: z.literal(36), previewObservationActualCount: z.literal(36), previewLocaleCount: z.literal(2), previewSurfaceCount: z.literal(6), previewRepositoryWriteCount: z.literal(0), previewSourceMutationCount: z.literal(0), directCompilationExpectedCount: z.literal(3), directCompilationActualCount: z.literal(3), preparationExpectedCount: z.literal(3), preparationActualCount: z.literal(3), isolatedConfirmationExpectedCount: z.literal(3), isolatedConfirmationActualCount: z.literal(3), publishedObservationExpectedCount: z.literal(36), publishedObservationActualCount: z.literal(36), previewPublishedParityExpectedCount: z.literal(36), previewPublishedParityActualCount: z.literal(36), migrationCurrentExpectedCount: z.literal(3), migrationCurrentActualCount: z.literal(3), externalPublicationCallCount: z.literal(0), providerCallCount: z.literal(0), veskoCallCount: z.literal(0), commerceMutationCount: z.literal(0), mediaMutationCount: z.literal(0), a09bBaselineFileSha256: sha256Schema, a09bBaselineMaterialSha256: sha256Schema, a09cBaselineFileSha256: sha256Schema, a09cBaselineMaterialSha256: sha256Schema });
// prettier-ignore
const inactivityAssertionSchema = readonlyStrict({ assertionId: z.string().min(1), expectedCount: z.literal(0) });
// prettier-ignore
const productionInactivityEvidenceSchema = readonlyStrict({ assertions: z.array(inactivityAssertionSchema).length(9).readonly(), allProductionV2Count: z.literal(0), clientRuntimeLeakCount: z.literal(0), currentGenerationV2ConsumerCount: z.literal(0), providerCallCount: z.literal(0), veskoCallCount: z.literal(0), externalPublicationCallCount: z.literal(0), commerceMutationCount: z.literal(0), mediaMutationCount: z.literal(0) });
// prettier-ignore
const baselineMaterialShape = {
  schemaVersion: z.literal("1.0.0"), authorityKind: z.literal("p10b-19a-positive-cross-authority-integration"), baseCommit: z.literal(taskBase),
  a10aAuthority: a10aAuthoritySchema, fixtureCounts: fixtureCountsSchema, topologyEvidence: topologyEvidenceSchema, compatibilityEvidence: compatibilityEvidenceSchema,
  selectionEvidence: selectionEvidenceGroupSchema, legacyCompatibilityEvidence: legacyCompatibilityEvidenceSchema, productionInactivityEvidence: productionInactivityEvidenceSchema,
} as const;
const baselineMaterialSchema = readonlyStrict(baselineMaterialShape);
// prettier-ignore
const positiveIntegrationBaselineSchema = readonlyStrict({ ...baselineMaterialShape, baselineFingerprint: z.string().regex(/^p10b-19a-positive-cross-authority-integration-v1_[1-9][0-9]*_[a-f0-9]{64}$/u) });

export type PositiveIntegrationBaseline = z.infer<typeof positiveIntegrationBaselineSchema>;

const repositoryRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
// prettier-ignore
export const positiveIntegrationBaselinePath = path.join(repositoryRoot, "tests/fixtures/p10b-19a-10b1-positive-cross-authority-integration.v1.json");

// prettier-ignore
const counts = (values: readonly string[]) => (value: string): number => values.filter((candidate) => candidate === value).length;

function projectEvaluation(
  evaluationId: "direct-en" | "direct-fi" | "mixed-fallback-en",
  context: Context,
  evaluation: StructuralStorefrontCandidateCompatibilityEvaluationV1,
) {
  const pageStatus = counts(evaluation.pageBlueprintEvaluations.map(({ status }) => status));
  const familyStatus = counts(evaluation.familyEvaluations.map(({ status }) => status));
  // prettier-ignore
  return {
    evaluationId, activeLocale: context.activeLocale, contextFingerprint: context.contextFingerprint, evaluationFingerprint: evaluation.evaluationFingerprint,
    pageStatusCounts: { direct: pageStatus("directly-compatible"), substitution: pageStatus("substitution-compatible"), omission: pageStatus("omission-compatible"), incompatible: pageStatus("incompatible") },
    familyStatusCounts: { direct: familyStatus("directly-compatible"), conditional: familyStatus("conditionally-compatible"), incompatible: familyStatus("incompatible") },
  };
}

function projectSelectionCore(bundle: SelectionBundle) {
  const { selectionRequest, selectionReceipt } = bundle;
  // prettier-ignore
  const selectedPageCandidateIdentityKeys = selectionReceipt.pageFamilySelections.map(({ effectiveCandidateIdentityKey }) => effectiveCandidateIdentityKey);
  // prettier-ignore
  return {
    selectionCaseId: selectionRequest.selectionCaseId, requestFingerprint: selectionRequest.requestFingerprint, selectionFingerprint: selectionReceipt.selectionFingerprint,
    selectedFamilyIdentityKey: selectionReceipt.selectedFamilyCandidate.candidateIdentityKey, selectedFamilyTopologyFingerprint: selectionReceipt.selectedFamilyCandidate.normalizedTopologyFingerprint, selectedCompleteStoreTopologyFingerprint: selectionReceipt.selectedCompleteStoreTopology.topologyFingerprint,
    selectedPageCandidateIdentityKeys,
  };
}

function projectMixedSelection(bundle: SelectionBundle) {
  const decisions = bundle.selectionReceipt.pageFamilySelections;
  const modeCount = counts(decisions.map(({ resolutionMode }) => resolutionMode));
  const product = decisions.find(({ pageFamilyId }) => pageFamilyId === "product-detail");
  const content = decisions.find(({ pageFamilyId }) => pageFamilyId === "content-support");
  if (!product || !content) throw new Error("A-10B1 selection is missing a governed page family.");
  // prettier-ignore
  return { ...projectSelectionCore(bundle), resolutionModeCounts: { direct: modeCount("direct"), substitution: modeCount("substitution"), omission: modeCount("omission") }, productDetailSubstitutionPath: product.substitutionPathCandidateIdentityKeys, productDetailTerminalCandidateIdentityKey: product.effectiveCandidateIdentityKey, contentSupportOmittedRegionIds: content.omittedRegionIds };
}

function projectSequentialSelection(bundle: SelectionBundle) {
  const request = bundle.selectionRequest;
  // prettier-ignore
  return { ...projectSelectionCore(bundle), eligibleFamilyIds: request.eligibleFamilyIds, excludedFamilyTopologyFingerprints: request.excludedFamilyTopologyFingerprints, excludedCompleteStoreTopologyFingerprints: request.excludedCompleteStoreTopologyFingerprints };
}

// prettier-ignore
const metric = (inventory: RetainedInventory, key: string): number => { const value = inventory.expectedSemanticMetrics[key]; if (typeof value !== "number") throw new Error(`A-10A metric ${key} is not numeric.`); return value; };
// prettier-ignore
const textMetric = (inventory: RetainedInventory, key: string): string => { const value = inventory.expectedSemanticMetrics[key]; if (typeof value !== "string") throw new Error(`A-10A metric ${key} is not textual.`); return value; };
// prettier-ignore
const matrixOutcome = (inventory: RetainedInventory, matrixId: string, key: string): number => { const value = inventory.matrixEntries.find((entry) => entry.matrixId === matrixId)?.expectedOutcomes[key]; if (typeof value !== "number") throw new Error(`A-10A outcome ${matrixId}.${key} is not numeric.`); return value; };
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const numericMetrics = (inventory: RetainedInventory, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, metric(inventory, key)]));
// prettier-ignore
const legacyMetricKeys = "legacyAliasCount historicalRepresentativeCount previewObservationExpectedCount previewObservationActualCount previewLocaleCount previewSurfaceCount previewRepositoryWriteCount previewSourceMutationCount directCompilationExpectedCount directCompilationActualCount preparationExpectedCount preparationActualCount isolatedConfirmationExpectedCount isolatedConfirmationActualCount publishedObservationExpectedCount publishedObservationActualCount previewPublishedParityExpectedCount previewPublishedParityActualCount migrationCurrentExpectedCount migrationCurrentActualCount externalPublicationCallCount providerCallCount veskoCallCount commerceMutationCount mediaMutationCount".split(" ");
// prettier-ignore
const activityMetricKeys = "providerCallCount veskoCallCount externalPublicationCallCount commerceMutationCount mediaMutationCount".split(" ");

export function positiveIntegrationBaselineFingerprint(
  value: Omit<PositiveIntegrationBaseline, "baselineFingerprint"> | PositiveIntegrationBaseline,
): string {
  const { baselineFingerprint: _ignored, ...material } = value as PositiveIntegrationBaseline;
  void _ignored;
  return `p10b-19a-positive-cross-authority-integration-${canonicalValueFingerprint(material)}`;
}

function projectA10AAuthority(inventory: RetainedInventory) {
  // prettier-ignore
  return {
    inventoryFingerprint: inventory.inventoryFingerprint, fixtureSha256: sha256(readFileSync(retainedInventoryPath)), retainedSemanticMetricsFingerprint: canonicalValueFingerprint(inventory.expectedSemanticMetrics),
    matrixEntryCount: inventory.matrixEntries.length, protectedProductionHashCount: inventory.protectedProductionAuthorities.length, productionInactivityAssertionCount: inventory.productionInactivityAssertions.length,
    completeCaseCount: metric(inventory, "completeCaseCount"), frozenCaseCount: metric(inventory, "frozenCaseCount"),
  };
}

function projectFixtureCounts(authority: PositiveCrossAuthorityIntegrationAuthority) {
  const primaryIds = new Set(structuralStorefrontPageFamilyIds.map((id) => candidateIds[id]));
  const primaryPageBlueprintCandidateCount = authority.candidateRegistry.pageBlueprintCandidates
    .map(({ structural }) => structural.id)
    .filter((id) =>
      primaryIds.has(id as (typeof candidateIds)[StructuralStorefrontPageFamilyId]),
    ).length;
  // prettier-ignore
  return {
    pageBlueprintCandidateCount: authority.candidateRegistry.pageBlueprintCandidates.length, primaryPageBlueprintCandidateCount,
    fallbackOnlyPageBlueprintCandidateCount: authority.candidateRegistry.pageBlueprintCandidates.length - primaryPageBlueprintCandidateCount,
    structuralFamilyCandidateCount: authority.candidateRegistry.familyCandidates.length, compatibilityProfileCount: authority.compatibilityProfileCatalogue.profiles.length, capabilityContextCount: Object.keys(authority.contexts).length,
    canonicalPageFamilyRoleCount: structuralStorefrontPageFamilyIds.length, canonicalStructuralFamilyIdCount: structuralStorefrontFamilyIds.length,
  };
}

function projectTopologyEvidence(authority: PositiveCrossAuthorityIntegrationAuthority) {
  // prettier-ignore
  const pages = new Map(authority.candidateRegistry.pageBlueprintCandidates.map((candidate) => [createPageBlueprintV2CandidateAuthorityIdentityKey(candidate), candidate]));
  const families = new Map<string, (typeof authority.candidateRegistry.familyCandidates)[number]>(
    authority.candidateRegistry.familyCandidates.map((candidate) => [
      structuralStorefrontFamilyIdentityKey({
        familyId: candidate.familyId,
        familyVersion: candidate.familyVersion,
      }),
      candidate,
    ]),
  );
  const pageBlueprintTopologies = authority.normalizedTopologyIndex.pageBlueprintEntries.map(
    (entry) => {
      const candidate = pages.get(entry.candidateIdentityKey);
      if (!candidate) throw new Error(`Missing topology candidate ${entry.candidateIdentityKey}.`);
      // prettier-ignore
      return `${entry.candidateIdentityKey}|${candidate.structural.pageFamilyId}|${entry.exactCandidateFingerprint}|${entry.normalizedTopology.topologyFingerprint}`;
    },
  );
  const structuralFamilyTopologies = authority.normalizedTopologyIndex.familyEntries.map(
    (entry) => {
      const candidate = families.get(entry.candidateIdentityKey);
      if (!candidate) throw new Error(`Missing topology family ${entry.candidateIdentityKey}.`);
      // prettier-ignore
      return `${entry.candidateIdentityKey}|${candidate.familyId}|${entry.exactCandidateFingerprint}|${entry.normalizedTopology.topologyFingerprint}`;
    },
  );
  // prettier-ignore
  return {
    pageBlueprintTopologyCount: pageBlueprintTopologies.length, structuralFamilyTopologyCount: structuralFamilyTopologies.length,
    duplicateFamilyTopologyClusterCount: authority.normalizedTopologyIndex.duplicateFamilyTopologyClusters.length, identitiesPerDuplicateCluster: 2,
    pageBlueprintTopologies, structuralFamilyTopologies, duplicateFamilyTopologyClusters: authority.normalizedTopologyIndex.duplicateFamilyTopologyClusters.map(({ topologyFingerprint, candidateIdentityKeys }) => `${topologyFingerprint}|${candidateIdentityKeys.join(",")}`),
  };
}

function projectLegacyCompatibilityEvidence(inventory: RetainedInventory) {
  const current = readA09Baselines();
  // prettier-ignore
  const currentHashes = [current.file09b, current.material09b, current.file09c, current.material09c];
  // prettier-ignore
  const retainedHashes = [
    textMetric(inventory, "a09bBaselineFileSha256"), textMetric(inventory, "a09bBaselineMaterialSha256"),
    textMetric(inventory, "a09cBaselineFileSha256"), textMetric(inventory, "a09cBaselineMaterialSha256"),
  ];
  exact(currentHashes, retainedHashes, "A-09 baseline hashes");
  // prettier-ignore
  return {
    ...numericMetrics(inventory, legacyMetricKeys),
    a09bBaselineFileSha256: current.file09b, a09bBaselineMaterialSha256: current.material09b,
    a09cBaselineFileSha256: current.file09c, a09cBaselineMaterialSha256: current.material09c,
  };
}

function projectProductionInactivityEvidence(inventory: RetainedInventory) {
  // prettier-ignore
  return {
    assertions: inventory.productionInactivityAssertions.map(({ assertionId, expectedCount }) => ({ assertionId, expectedCount })),
    allProductionV2Count: matrixOutcome(inventory, "production-v2-inactivity", "all-production-v2-counts"),
    clientRuntimeLeakCount: matrixOutcome(inventory, "client-runtime-isolation", "client-runtime-leaks"),
    currentGenerationV2ConsumerCount: matrixOutcome(inventory, "current-generation-isolation", "current-generation-v2-consumers"),
    ...numericMetrics(inventory, activityMetricKeys),
  };
}

function projectBaselineMaterial(authority: PositiveCrossAuthorityIntegrationAuthority) {
  const inventory = authority.retainedInventory;
  // prettier-ignore
  const evaluations = [projectEvaluation("direct-en", authority.contexts.directEn, authority.evaluations.directEn), projectEvaluation("direct-fi", authority.contexts.directFi, authority.evaluations.directFi), projectEvaluation("mixed-fallback-en", authority.contexts.mixedEn, authority.evaluations.mixedEn)];
  // prettier-ignore
  const familyConstrainedDirect = authority.selections.familyConstrainedDirect.map(({ familyId, ...bundle }) => ({ familyId, ...projectSelectionCore(bundle) }));
  // prettier-ignore
  const localeEquivalent = authority.selections.localeEquivalent.map(({ locale, ...bundle }) => ({ locale, ...projectSelectionCore(bundle) }));
  // prettier-ignore
  return baselineMaterialSchema.parse({
    schemaVersion: "1.0.0", authorityKind: "p10b-19a-positive-cross-authority-integration", baseCommit: taskBase,
    a10aAuthority: projectA10AAuthority(inventory), fixtureCounts: projectFixtureCounts(authority), topologyEvidence: projectTopologyEvidence(authority),
    compatibilityEvidence: { profileCatalogueFingerprint: authority.compatibilityProfileCatalogue.catalogueFingerprint, evaluationCount: evaluations.length, evaluations },
    selectionEvidence: { familyConstrainedDirect, localeEquivalent, mixedFallback: projectMixedSelection(authority.selections.mixed), sequentialDistinct: authority.selections.sequential.map(projectSequentialSelection) },
    legacyCompatibilityEvidence: projectLegacyCompatibilityEvidence(inventory), productionInactivityEvidence: projectProductionInactivityEvidence(inventory),
  });
}

export function createPositiveIntegrationBaseline(
  authority: PositiveCrossAuthorityIntegrationAuthority = createPositiveCrossAuthorityIntegrationAuthority(),
): PositiveIntegrationBaseline {
  const material = projectBaselineMaterial(authority);
  // prettier-ignore
  return parsePositiveIntegrationBaseline({ ...material, baselineFingerprint: positiveIntegrationBaselineFingerprint(material) });
}

function exact(actual: unknown, expected: unknown, label: string): void {
  if (canonicalValueString(actual) !== canonicalValueString(expected))
    throw new Error(`${label} is incomplete, duplicated or noncanonical.`);
}

export function parsePositiveIntegrationBaseline(value: unknown): PositiveIntegrationBaseline {
  const parsed = positiveIntegrationBaselineSchema.parse(value);
  if (positiveIntegrationBaselineFingerprint(parsed) !== parsed.baselineFingerprint)
    throw new Error("Positive cross-authority integration baseline fingerprint is stale.");
  const { baselineFingerprint: _fingerprint, ...material } = parsed;
  void _fingerprint;
  // prettier-ignore
  exact(material, projectBaselineMaterial(createPositiveCrossAuthorityIntegrationAuthority()), "Positive cross-authority baseline material");
  const { localeEquivalent, mixedFallback, sequentialDistinct } = parsed.selectionEvidence;
  // prettier-ignore
  const localeTopology = localeEquivalent.map((selection) => ({ family: selection.selectedFamilyTopologyFingerprint, completeStore: selection.selectedCompleteStoreTopologyFingerprint, pages: selection.selectedPageCandidateIdentityKeys }));
  exact(localeTopology, [localeTopology[0], localeTopology[0]], "Locale-equivalent topology");
  // prettier-ignore
  exact(mixedFallback.productDetailSubstitutionPath, [`${candidateIds.productIntermediate}@${candidateVersion}`, `${candidateIds.productTerminal}@${candidateVersion}`], "Mixed product-detail path");
  if (
    mixedFallback.productDetailTerminalCandidateIdentityKey !==
    `${candidateIds.productTerminal}@${candidateVersion}`
  )
    throw new Error("Mixed product-detail terminal is noncanonical.");
  // prettier-ignore
  exact(mixedFallback.contentSupportOmittedRegionIds, ["test-a10b1-brand-story-region"], "Mixed content-support omission");
  sequentialDistinct.forEach((selection, index) => {
    const prior = sequentialDistinct.slice(0, index);
    exact(selection.eligibleFamilyIds, structuralStorefrontFamilyIds, "Sequential eligibility");
    // prettier-ignore
    exact(selection.excludedFamilyTopologyFingerprints, prior.map(({ selectedFamilyTopologyFingerprint }) => selectedFamilyTopologyFingerprint).sort(compare), "Sequential family exclusions");
    // prettier-ignore
    exact(selection.excludedCompleteStoreTopologyFingerprints, prior.map(({ selectedCompleteStoreTopologyFingerprint }) => selectedCompleteStoreTopologyFingerprint).sort(compare), "Sequential complete-store exclusions");
  });
  return deepFreeze(parsed);
}

export function readPositiveIntegrationBaseline(): PositiveIntegrationBaseline {
  // prettier-ignore
  return parsePositiveIntegrationBaseline(JSON.parse(readFileSync(positiveIntegrationBaselinePath, "utf8")));
}
