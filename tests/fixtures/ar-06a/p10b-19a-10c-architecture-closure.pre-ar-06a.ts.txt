import { createHash } from "node:crypto";
// prettier-ignore
import { chmodSync, closeSync, existsSync, fsyncSync, linkSync, lstatSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

// prettier-ignore
import { inactiveStructuralStorefrontFamilyCandidateRegistry, pageBlueprintV2ResponsiveBreakpointAuthority } from "@/application/storefront-templates";
import { MAX_STRUCTURAL_STOREFRONT_SELECTION_COMBINATION_EVALUATIONS } from "@/application/storefront-templates/structural-storefront-selection-contract";
import { assetRoleValues } from "@/domain/shared/asset-role";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
// prettier-ignore
import { structuralStorefrontCrossPageRelationshipKinds, structuralStorefrontFamilyIds, structuralStorefrontPageFamilyIds } from "@/domain/structural-storefront-family";

import { parseStrictJson } from "../../scripts/lib/task-governance/index.js";
import { readRetainedSource } from "./ar-02-retained-source-transition";
// prettier-ignore
import { readRetainedInventory, retainedInventoryPath, type RetainedInventory } from "./p10b-19a-10a-retained-matrix-inventory";
// prettier-ignore
import { failureBaselineMaterialSha256, parseFailureBaseline } from "./p10b-19a-10b2-fail-closed-cross-authority-matrix";

export const repositoryRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
export const taskBase = "f9af2b2f007ff1bcb0f20a046edf33bc1f10ea37" as const;
export const exactNextTask = "P10B-19B-01" as const;
export const closureCandidatePath = "/private/tmp/veskify-p10b-19a-10c-closure-candidate.json";
export const productOwnerReviewPacketPath =
  "/private/tmp/veskify-p10b-19a-10c-product-owner-architecture-review.md";
export const productOwnerDecisionPath =
  "/private/tmp/veskify-p10b-19a-10c-product-owner-decision.json";
export const externalClosureBaselinePath =
  "/private/tmp/veskify-p10b-19a-10c-architecture-closure-baseline.json";
export const closureManifestRelativePath =
  "tests/fixtures/p10b-19a-10c-architecture-closure-manifest.v1.json";
export const closureManifestPath = path.join(repositoryRoot, closureManifestRelativePath);
export const exactProductOwnerDecisionText =
  "ACCEPT P10B-19A STRUCTURAL ARCHITECTURE CLOSURE" as const;
export const acceptedClosureCandidateFingerprint =
  "p10b-19a-structural-architecture-closure-candidate-v1_11823_e1482cb9f76b470302823bc25f767243cf108776cfe318dd9194821e0ce55e8e" as const;
export const finalAuthorityGenerationIdentity =
  "p10b-19a-10c-product-owner-accepted-architecture-closure-v1" as const;
export const expectedClosureFingerprint =
  "p10b-19a-structural-architecture-closure-v1_12651_76316ec1e4c4edc48b02942ec27624b6a05926b91cf11dbcf08a64c65d18e728" as const;
export const closureManifestCanonicalMaterialSha256 =
  "76316ec1e4c4edc48b02942ec27624b6a05926b91cf11dbcf08a64c65d18e728" as const;
export const closureManifestFixtureSha256 =
  "757c0febf40da2e893f99795dc12bbf1e5bf933fe55b326cab512f80f35d67b1" as const;
export const externalClosureBaselineSha256 =
  "529da1152e5d088a9ff3bff075829d8f22f5b4bed95446eac119f9d79e338122" as const;
const architecturePath = "docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md";
const architectureSha = "5292792dae97273411702eeaf468575172c0cf46b026103216423de29eaf47fd";
const a10aFingerprint =
  "p10b-19a-retained-matrix-inventory-v1_32375_1b97e7da8eebdcda779b51b91b2f540263c97e9d2b40950b7f002721b6a5eb7d";
const a10aMetricsFingerprint =
  "v1_1819_33c603143044e4eacb21bba49f0717be3ee16f34e8c279b1dfb7f54051681d4e";
const a10b1Fingerprint =
  "p10b-19a-positive-cross-authority-integration-v1_23279_e195aad8126b74a9990d923a6ef08d82c637589919f362e8c5e90263092a002d";
const a10b1ProfileFingerprint =
  "inactive-structural-storefront-family-compatibility-profile-catalogue-v1_5450_835a5a452751802c39be1c82a9858d854cc83f97b98fefe4c8377d0a346ad922";
const a10b2Fingerprint =
  "p10b-19a-fail-closed-cross-authority-matrix-v1_30308_ffae8e9700b84c08fcf1fe7315846077b01170f0be0d82743dce4e8a0ac8d307";
const a10b2MaterialSha = "ffae8e9700b84c08fcf1fe7315846077b01170f0be0d82743dce4e8a0ac8d307";
const a10b2ExternalPath = "/private/tmp/veskify-p10b-19a-10b2-fail-closed-baseline.json";
const a10b2ExternalSha = "67945a1b29cc4e84623c17cc2d2c0454265717599cd1128c7adfbb0446935b0b";

// prettier-ignore
export const acceptedLimitations = Object.freeze(["no-active-v2-family", "no-v2-rendered-storefront", "no-visual-recipe", "no-design-dna-v2", "no-v2-frame-family", "no-v2-page-family-realization", "no-ai-design-director", "no-screenshot-critic", "no-live-ai-quality-evidence", "no-v2-commercial-quality-claim"] as const);
// prettier-ignore
export const exactStatusTransition = Object.freeze({ "P10B-19A-10C": "Baseline", "P10B-19A-10": "Baseline / closed", "P10B-19A": "Baseline / closed", "P10B-19B-01": "exact next implementation task", P10B: "Partial" } as const);
// prettier-ignore
const decisionMaterial = { decisionSchemaVersion: "1.0.0", authorityKind: "p10b-19a-product-owner-architecture-decision", decision: "accepted", decisionText: exactProductOwnerDecisionText, acceptedClosureCandidateFingerprint, acceptedLimitations, exactNextTask } as const;
export const acceptedDecisionFingerprint =
  "p10b-19a-product-owner-architecture-decision-v1_653_1e2f42c02bcac0e507b032eb81885aa3797d734ba94371f3f97047d22523e88b" as const;
const acceptedDecision = {
  ...decisionMaterial,
  decisionFingerprint: acceptedDecisionFingerprint,
} as const;
// prettier-ignore
const frozenFiles = Object.freeze([
  { path: "tests/fixtures/p10b-19a-10a-retained-matrix-inventory.v1.json", sha256: "2324cf405e12f4b06cbb288eac8d90dc759fc0eb87a39ba206eef784f3b0f4ab" },
  { path: "tests/helpers/p10b-19a-10a-retained-matrix-inventory.ts", sha256: "b100d6e3bff1c7cb3e25c83d886b991a7e95e9a231b1d6c0a98d0dc59c940073" },
  { path: "tests/unit/p10b-19a-10a-retained-matrix-inventory.test.ts", sha256: "14ee717cb1b6c682ae2c8013c0544b66d6aef6e1aa1a300eeb9e43c92785b50a" },
  { path: "tests/fixtures/p10b-19a-10b1-positive-cross-authority-integration.v1.json", sha256: "907a4d48cab6dacd0bc46e0fb16d4eca2ca82c87d7f00b605ca53f3f112490f2" },
  { path: "tests/helpers/p10b-19a-10b1-positive-cross-authority-integration.ts", sha256: "f86bcdb43825876c54a73f081873b30c78ce2349b26f1b1c1bd9549c4777178e" },
  { path: "tests/integration/p10b-19a-10b1-positive-cross-authority-integration.test.ts", sha256: "b118e511cfe760c0281b9a36c9813fa7de81cf3d0d385ce02a692c274a5b32f4" },
  { path: "tests/unit/p10b-19a-10b1-positive-integration-baseline.test.ts", sha256: "dd4c8c7459e4e7f0423f3e05d9f6ea814be40e2c5b396a944664920cb2836331" },
  { path: "tests/fixtures/p10b-19a-10b2-fail-closed-cross-authority-matrix.v1.json", sha256: "8708a2282749796c9d27d2dcd382384989c7738a5eb0b2f72f87c1ad73cb6a64" },
  { path: "tests/helpers/p10b-19a-10b2-fail-closed-cross-authority-matrix.ts", sha256: "cb4c55569b8ba536482e3d0797e4a9b55568dea9240fa0fa71c1f1940208ecfe" },
  { path: "tests/integration/p10b-19a-10b2-fail-closed-cross-authority-matrix.test.ts", sha256: "ace8815bdb5b536013936aefffefeb580bd96f8882859d58c9a074a929ec9525" },
  { path: "tests/unit/p10b-19a-10b2-failure-baseline.test.ts", sha256: "80e44aacc1c9ce174dd8b5415fdc42e655425442a5db828103262e73e9578f11" },
] as const);
// prettier-ignore
const structuralSources = Object.freeze({
  pageBlueprintV2Structural: { path: "src/application/storefront-templates/page-blueprint-v2-contract.ts", sha256: "4a050629af7b792e59b54c229891020cde65fffc793ae88c9049b2a3e143da69", state: "present-and-protected" },
  assetRoles: { path: "src/domain/shared/asset-role.ts", sha256: "da209602d1e1a6362b2692c6ad0e56a746ce30ad84b80da943861b95991505b4", state: "present-and-protected" },
  responsiveRules: { path: "src/application/storefront-templates/page-blueprint-v2-responsive-rule-contract.ts", sha256: "c2799603ff03b735cc5171156494e8031a346d3fe99172b38c4c72ea7acfd337", state: "present-and-protected" },
  omissionSubstitutionFallback: { path: "src/application/storefront-templates/page-blueprint-v2-omission-substitution-fallback-contract.ts", sha256: "607b5fa0160d0915fb457301b6a0031194151a5ccaa32d0e7fa7876372f9e91a", state: "present-and-protected" },
} as const);
// prettier-ignore
export const finalRetainedTestFiles = Object.freeze("tests/integration/p10b-19a-09b-historical-v1-render-replay.test.tsx tests/integration/p10b-19a-09c-publication-render-replay.test.tsx tests/integration/p10b-19a-10b1-positive-cross-authority-integration.test.ts tests/integration/p10b-19a-10b2-fail-closed-cross-authority-matrix.test.ts tests/integration/p10b-19a-10c-architecture-closure.test.ts tests/unit/devx-01f2-vitest-ci.test.ts tests/unit/p10b-18c-100-plus-commercial-quality-diversity-gate.test.ts tests/unit/p10b-19a-01-structural-storefront-family.test.ts tests/unit/p10b-19a-02-cross-page-relationships.test.ts tests/unit/p10b-19a-03-page-blueprint-v2-contract.test.ts tests/unit/p10b-19a-04-page-blueprint-v2-asset-role-contract.test.ts tests/unit/p10b-19a-05-page-blueprint-v2-responsive-rule-contract.test.ts tests/unit/p10b-19a-06-page-blueprint-v2-omission-substitution-fallback-contract.test.ts tests/unit/p10b-19a-07-inactive-family-registry-candidate-fingerprints.test.ts tests/unit/p10b-19a-08a-normalized-topology-identity.test.ts tests/unit/p10b-19a-08b-candidate-compatibility-evaluation.test.ts tests/unit/p10b-19a-08b-compatibility-contract.test.ts tests/unit/p10b-19a-08c-deterministic-selection.test.ts tests/unit/p10b-19a-08c-selection-contract.test.ts tests/unit/p10b-19a-09a-legacy-v1-replay-authority.test.ts tests/unit/p10b-19a-09b-historical-v1-snapshot-replay.test.ts tests/unit/p10b-19a-09c-legacy-v1-publication-replay.test.ts tests/unit/p10b-19a-10a-retained-matrix-inventory.test.ts tests/unit/p10b-19a-10b1-positive-integration-baseline.test.ts tests/unit/p10b-19a-10b2-failure-baseline.test.ts tests/unit/p10b-19a-10c-closure-manifest.test.ts".split(" "));
export const finalRetainedVitestCommand = `pnpm exec vitest run ${finalRetainedTestFiles.join(" ")}`;

// These are the exact bounded values accepted by A-10A/B1/B2 and the architecture lock.
// prettier-ignore
const expectedArchitecture = { path: architecturePath, fileSha256: architectureSha, numberedSectionCount: 21, mermaidDiagramCount: 4, acceptedArchitectureChildCount: 73, acceptedChildIdFingerprint: "v1_658_475b9d78ccc7069af6f781de9a1fe7c7130db989b1e3786360dc17a365f1cbbf", childDistribution: { A: 6, B: 7, C: 8, D: 8, E: 9, F: 8, G: 11, H: 6, I: 6, J: 4 }, nestedDeliveryDecompositionChildDelta: 0, p10b19aExitBoundary: "Versioned schemas, inactive candidate catalogue, registry/selector infrastructure, topology identity, and v1 compatibility; no active v2 family or visual output", p10b19bEntryDependency: "19A constraints" } as const;
// prettier-ignore
const expectedPredecessors = { frozenFileCount: 11, frozenPathSetFingerprint: "v1_744_6d346615ab964f33f6eba5dce2a4f5b48f496b57de6b6dda95b4716077f2d35e", frozenByteManifestFingerprint: "v1_1679_6d4aa24650888b1aceecdd58af6145dedab6d570d28d51cbc44f95edefe41196", a10a: { inventoryFingerprint: a10aFingerprint, fixtureSha256: frozenFiles[0].sha256, retainedSemanticMetricsFingerprint: a10aMetricsFingerprint }, a10b1: { baselineFingerprint: a10b1Fingerprint, fixtureSha256: frozenFiles[3].sha256 }, a10b2: { baselineFingerprint: a10b2Fingerprint, fixtureSha256: frozenFiles[7].sha256, canonicalMaterialSha256: a10b2MaterialSha, externalBaselineSha256: a10b2ExternalSha } } as const;
// prettier-ignore
const expectedStructural = { structuralFamilyIds: { count: 6, fingerprint: "v1_125_98afd676a5fc31c8543910e63a7d8682e3b4e268638f213ec9fc56fd44d9296d" }, structuralPageFamilyRoles: { count: 6, fingerprint: "v1_75_e389d18732c54b037065104c292247a968805207b4a354871b3a770fada6417a" }, crossPageRelationshipKinds: { count: 7, fingerprint: "v1_160_496eddc742a00d4fc84e524f87a2a5a49742c0ca851424e3a4fb4084aed8899d" }, pageBlueprintV2StructuralAuthority: structuralSources.pageBlueprintV2Structural, canonicalAssetRoles: { count: 9, fingerprint: "v1_157_c43d572c2ff202c0bf20a9e783605319fe4ad5fddddf49c39a98a217920066d3" }, assetRoleAuthority: structuralSources.assetRoles, responsiveBreakpoints: { count: 4, fingerprint: "v1_158_764a7cb74bace29414671d780a0dfb2c8dbfb79668219d8b433735d72588deeb" }, responsiveRuleAuthority: structuralSources.responsiveRules, omissionSubstitutionFallbackAuthority: structuralSources.omissionSubstitutionFallback, productionCandidateRegistry: { state: "empty", pageBlueprintCandidateCount: 0, structuralFamilyCandidateCount: 0 }, normalizedTopology: "deterministic", compatibilityEvaluation: "deterministic", selection: { method: "scoring-free-and-deterministic", combinationMaximum: 4096 }, positiveIntegrationBaselineFingerprint: a10b1Fingerprint, negativeIntegrationBaselineFingerprint: a10b2Fingerprint } as const;
// prettier-ignore
const expectedRetained = { inventoryFingerprint: a10aFingerprint, fixtureSha256: frozenFiles[0].sha256, retainedSemanticMetricsFingerprint: a10aMetricsFingerprint, matrixEntryCount: 24, protectedProductionHashCount: 76, productionInactivityAssertionCount: 9, completeMatrix: { caseCount: 126, successfulCompileCount: 126, successfulReplayCount: 126, consumedAuthorityLineageCount: 98, normalizedMaterialTopologyCount: 54, directionLabelFreeTopologyCount: 54, repeatedClusterCount: 34, repeatedMembershipCount: 106, largestRepeatedClusterSize: 14, singletonCount: 20, caseSetFingerprint: "v1_7127_741312a0b0d85a0a7dc330cd097863e1c6b95cfc65dda680dd97a296ba3cda38" }, frozenMatrix: { caseCount: 72, normalizedTopologyCount: 39, repeatedMembershipCount: 53, largestClusterSize: 7, singletonCount: 19, caseSetFingerprint: "v1_4064_0be3cc37dfb3fe0e842f9a728df868a9ceb3914f5b2f974ddfb24f77ef281f66" } } as const;
// prettier-ignore
const expectedLegacySource = { legacyAliasCount: 3, historicalRepresentativeCount: 3, previewObservationExpectedCount: 36, previewObservationActualCount: 36, previewLocaleCount: 2, previewSurfaceCount: 6, previewRepositoryWriteCount: 0, previewSourceMutationCount: 0, directCompilationExpectedCount: 3, directCompilationActualCount: 3, preparationExpectedCount: 3, preparationActualCount: 3, isolatedConfirmationExpectedCount: 3, isolatedConfirmationActualCount: 3, publishedObservationExpectedCount: 36, publishedObservationActualCount: 36, previewPublishedParityExpectedCount: 36, previewPublishedParityActualCount: 36, migrationCurrentExpectedCount: 3, migrationCurrentActualCount: 3, externalPublicationCallCount: 0, providerCallCount: 0, veskoCallCount: 0, commerceMutationCount: 0, mediaMutationCount: 0, a09bBaselineFileSha256: "e14bd08a18e63848a24fab161d50875c188fb3a49b22ae63ec9930b27a8fed06", a09bBaselineMaterialSha256: "b224390ba16a850821155874dbaf1f9a740f55004684f9982531f80716ca013f", a09cBaselineFileSha256: "e1a2eb36eed615945b100797886be4a0d345b579e7b84eb8f4629aa124d03653", a09cBaselineMaterialSha256: "92b2f872d10cd9777758c7cd6572e9b3fb598f1aa00703cbdaaf9e196c1e5b30" } as const;
const expectedLegacy = {
  ...expectedLegacySource,
  selectorEligibility: "legacy-v1-ineligible",
} as const;
// prettier-ignore
const expectedPositive = { baselineFingerprint: a10b1Fingerprint, fixtureSha256: frozenFiles[3].sha256, pageBlueprintCandidateCount: 8, primaryPageBlueprintCandidateCount: 6, fallbackOnlyPageBlueprintCandidateCount: 2, structuralFamilyCandidateCount: 6, compatibilityProfileCount: 6, capabilityContextCount: 3, compatibilityEvaluationCount: 3, profileCatalogueFingerprint: a10b1ProfileFingerprint, familyConstrainedDirectSelectionCount: 6, mixedPageStatusCounts: { direct: 5, substitution: 2, omission: 1, incompatible: 0 }, mixedFamilyStatusCounts: { direct: 0, conditional: 6, incompatible: 0 }, mixedReceiptResolutionCounts: { direct: 4, substitution: 1, omission: 1 }, sequentialDistinctSelectionCount: 3, sequentialDistinctFamilyTopologyCount: 3, sequentialDistinctCompleteStoreTopologyCount: 3 } as const;
// prettier-ignore
const expectedNegative = { baselineFingerprint: a10b2Fingerprint, fixtureSha256: frozenFiles[7].sha256, canonicalMaterialSha256: a10b2MaterialSha, externalBaselineSha256: a10b2ExternalSha, totalCaseCount: 36, passedCaseCount: 36, typedErrorObservationCount: 16, zodIssueObservationCount: 20, nativeErrorNullCodeCount: 3, authorityConfusionCaseCount: 4, ownerMismatchCount: 0, terminalPhaseMismatchCount: 0, downstreamExecutionCount: 0, partialOutputCount: 0, sourceMutationCount: 0, repositoryWriteCount: 0, productionFileChangeCount: 0, automaticRepairCount: 0, silentNormalizationCount: 0, fallbackToV1Count: 0, fallbackToV2Count: 0, defaultCandidateCount: 0, partialReceiptCount: 0, partialPublicationResultCount: 0, snapshotMutationCount: 0, catalogueMutationCount: 0, commerceMutationCount: 0, mediaMutationCount: 0, testOnlyPublicationConfirmationCount: 0, externalPublicationCallCount: 0, providerCallCount: 0, veskoCallCount: 0 } as const;
// prettier-ignore
const expectedRetainedPlan = { testFileCount: 26, testFileSetFingerprint: "v1_1686_7662d474cac69427306d3c810aa09bdf4b5310b3c34043f45927d35a36bae925", exactCommand: finalRetainedVitestCommand } as const;
const expectedIntegration = {
  retained: expectedRetained,
  positive: expectedPositive,
  negative: expectedNegative,
  retainedPlan: expectedRetainedPlan,
} as const;
// prettier-ignore
const expectedProduction = { productionPageBlueprintCandidateCount: 0, productionStructuralFamilyCandidateCount: 0, productionCompatibilityProfileCount: 0, productionCapabilityContextCount: 0, productionCompatibilityEvaluationCount: 0, productionSelectionRequestCount: 0, productionSelectionReceiptCount: 0, productionActiveStructuralFamilyCount: 0, productionSelectableStructuralFamilyCount: 0, currentGenerationP10b19aConsumerCount: 0, clientRuntimeConsumerCount: 0, productionSourceFileChangeCount: 0, merchantVisibleChangeCount: 0, providerCallCount: 0, veskoCallCount: 0, externalPublicationCallCount: 0, a10cPublicationPreparationCount: 0, a10cPublicationConfirmationCount: 0, imageGenerationCallCount: 0, secretFileAccessCount: 0, retainedA09PreparationExpectedCount: 3, retainedA09PreparationActualCount: 3, retainedA09IsolatedConfirmationExpectedCount: 3, retainedA09IsolatedConfirmationActualCount: 3 } as const;

function exactSchema(value: unknown): z.ZodTypeAny {
  if (Array.isArray(value)) {
    return z.tuple(value.map(exactSchema) as [z.ZodTypeAny, ...z.ZodTypeAny[]]).readonly();
  }
  if (value !== null && typeof value === "object") {
    return z
      .strictObject(
        Object.fromEntries(Object.entries(value).map(([key, child]) => [key, exactSchema(child)])),
      )
      .readonly();
  }
  return z.literal(value as string | number | boolean | null);
}
const exactValue = <Value>(value: Value) => exactSchema(value) as z.ZodType<Value>;
// prettier-ignore
const evidenceShape = { baseCommit: z.literal(taskBase), architectureLock: exactValue(expectedArchitecture), predecessorAuthority: exactValue(expectedPredecessors), structuralExitEvidence: exactValue(expectedStructural), legacyCompatibilityEvidence: exactValue(expectedLegacy), integrationEvidence: exactValue(expectedIntegration), productionBoundary: exactValue(expectedProduction) };
// prettier-ignore
const candidateMaterialShape = { candidateSchemaVersion: z.literal("1.0.0"), authorityKind: z.literal("p10b-19a-structural-architecture-closure-candidate"), ...evidenceShape, acceptedLimitations: exactValue(acceptedLimitations), exactNextTask: z.literal(exactNextTask) };
const candidateMaterialSchema = z.strictObject(candidateMaterialShape).readonly();
const closureCandidateSchema = z
  .strictObject({
    ...candidateMaterialShape,
    closureCandidateFingerprint: z
      .string()
      .regex(/^p10b-19a-structural-architecture-closure-candidate-v1_[1-9][0-9]*_[a-f0-9]{64}$/u),
  })
  .readonly();
// prettier-ignore
const productOwnerDecisionSchema = z.strictObject({ decisionSchemaVersion: z.literal("1.0.0"), authorityKind: z.literal("p10b-19a-product-owner-architecture-decision"), decision: z.literal("accepted"), decisionText: z.literal(exactProductOwnerDecisionText), acceptedClosureCandidateFingerprint: z.literal(acceptedClosureCandidateFingerprint), acceptedLimitations: exactValue(acceptedLimitations), exactNextTask: z.literal(exactNextTask), decisionFingerprint: z.string().regex(/^p10b-19a-product-owner-architecture-decision-v1_[1-9][0-9]*_[a-f0-9]{64}$/u) }).readonly();
// prettier-ignore
const productOwnerDecisionProjection = { decisionText: exactProductOwnerDecisionText, decisionFingerprint: acceptedDecisionFingerprint, acceptedClosureCandidateFingerprint, acceptedLimitations } as const;
// prettier-ignore
const closureMaterialShape = { schemaVersion: z.literal("1.0.0"), authorityKind: z.literal("p10b-19a-structural-architecture-closure"), ...evidenceShape, acceptedLimitations: exactValue(acceptedLimitations), productOwnerDecision: exactValue(productOwnerDecisionProjection), statusTransition: exactValue(exactStatusTransition), exactNextTask: z.literal(exactNextTask) };
const closureMaterialSchema = z.strictObject(closureMaterialShape).readonly();
const closureManifestSchema = z
  .strictObject({
    ...closureMaterialShape,
    closureFingerprint: z
      .string()
      .regex(/^p10b-19a-structural-architecture-closure-v1_[1-9][0-9]*_[a-f0-9]{64}$/u),
  })
  .readonly();
export type ClosureCandidate = z.infer<typeof closureCandidateSchema>;
export type ClosureCandidateMaterial = z.infer<typeof candidateMaterialSchema>;
export type ProductOwnerDecision = z.infer<typeof productOwnerDecisionSchema>;
export type ClosureManifest = z.infer<typeof closureManifestSchema>;

const directPage = { direct: 8, substitution: 0, omission: 0, incompatible: 0 } as const;
const directFamily = { direct: 6, conditional: 0, incompatible: 0 } as const;
const mixedPage = expectedPositive.mixedPageStatusCounts;
const mixedFamily = expectedPositive.mixedFamilyStatusCounts;
const b1Evaluation = (id: string, locale: string, pages: object, families: object) =>
  z
    .object({
      evaluationId: z.literal(id),
      activeLocale: z.literal(locale),
      pageStatusCounts: exactValue(pages),
      familyStatusCounts: exactValue(families),
    })
    .passthrough();
// prettier-ignore
const b1SourceSchema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  authorityKind: z.literal("p10b-19a-positive-cross-authority-integration"),
  baseCommit: z.literal("d946a4a60d3edb5afd8cdb7a162e104750e8fd5d"),
  a10aAuthority: z.unknown(),
  fixtureCounts: exactValue({ pageBlueprintCandidateCount: 8, primaryPageBlueprintCandidateCount: 6, fallbackOnlyPageBlueprintCandidateCount: 2, structuralFamilyCandidateCount: 6, compatibilityProfileCount: 6, capabilityContextCount: 3, canonicalPageFamilyRoleCount: 6, canonicalStructuralFamilyIdCount: 6 } as const),
  topologyEvidence: z.object({ pageBlueprintTopologyCount: z.literal(8), structuralFamilyTopologyCount: z.literal(6), duplicateFamilyTopologyClusterCount: z.literal(3) }).passthrough(),
  compatibilityEvidence: z.strictObject({
    profileCatalogueFingerprint: z.literal(a10b1ProfileFingerprint),
    evaluationCount: z.literal(3),
    evaluations: z.tuple([b1Evaluation("direct-en", "en", directPage, directFamily), b1Evaluation("direct-fi", "fi", directPage, directFamily), b1Evaluation("mixed-fallback-en", "en", mixedPage, mixedFamily)]),
  }),
  selectionEvidence: z.strictObject({
    familyConstrainedDirect: z.array(z.unknown()).length(6),
    localeEquivalent: z.array(z.unknown()).length(2),
    mixedFallback: z.object({ resolutionModeCounts: exactValue(expectedPositive.mixedReceiptResolutionCounts) }).passthrough(),
    sequentialDistinct: z.array(z.object({ selectedFamilyTopologyFingerprint: z.string(), selectedCompleteStoreTopologyFingerprint: z.string() }).passthrough()).length(3),
  }),
  legacyCompatibilityEvidence: exactValue(expectedLegacySource),
  productionInactivityEvidence: z.object({ assertions: z.array(z.unknown()).length(9), allProductionV2Count: z.literal(0), clientRuntimeLeakCount: z.literal(0), currentGenerationV2ConsumerCount: z.literal(0), providerCallCount: z.literal(0), veskoCallCount: z.literal(0), externalPublicationCallCount: z.literal(0), commerceMutationCount: z.literal(0), mediaMutationCount: z.literal(0) }).strict(),
  baselineFingerprint: z.literal(a10b1Fingerprint),
});

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}
function exact(actual: unknown, expected: unknown, label: string): void {
  if (canonicalValueString(actual) !== canonicalValueString(expected))
    throw new Error(`${label} is incomplete, reordered or stale.`);
}
function readRegular(filePath: string, label: string): Buffer {
  if (!existsSync(filePath)) throw new Error(`${label} is missing.`);
  const information = lstatSync(filePath);
  if (!information.isFile() || information.isSymbolicLink() || realpathSync(filePath) !== filePath)
    throw new Error(`${label} is not a regular non-symbolic file.`);
  return readFileSync(filePath);
}
function readRepository(relativePath: string, expectedSha: string): Buffer {
  const absolute = path.resolve(repositoryRoot, relativePath);
  if (!absolute.startsWith(`${repositoryRoot}${path.sep}`))
    throw new Error(`Repository authority escapes root: ${relativePath}.`);
  const bytes = readRegular(absolute, `Repository authority ${relativePath}`);
  if (sha256(bytes) !== expectedSha)
    throw new Error(`Repository authority hash is stale: ${relativePath}.`);
  return bytes;
}
const parseJson = (bytes: Buffer) => parseStrictJson(bytes.toString("utf8"));

export function verifyFrozenPredecessorBytes() {
  const ordered = [...frozenFiles].sort((left, right) => compare(left.path, right.path));
  // Historical predecessor identities: the reviewed A-10A successor verifies its archive;
  // the other ten predecessors still require their original current-source bytes.
  ordered.forEach(({ path: file, sha256: expected }) =>
    file === "tests/helpers/p10b-19a-10a-retained-matrix-inventory.ts"
      ? readRetainedSource({
          repositoryRoot,
          recordsPath: "tests/fixtures/ar-02-retained-source-transitions.v1.json",
          sourcePath: file,
          expectedHistoricalSha256: expected,
        })
      : readRepository(file, expected),
  );
  const evidence = {
    fileCount: ordered.length,
    pathSetFingerprint: canonicalValueFingerprint(ordered.map(({ path: file }) => file)),
    byteManifestFingerprint: canonicalValueFingerprint(ordered),
  };
  exact(
    evidence,
    {
      fileCount: 11,
      pathSetFingerprint: expectedPredecessors.frozenPathSetFingerprint,
      byteManifestFingerprint: expectedPredecessors.frozenByteManifestFingerprint,
    },
    "Frozen predecessor bytes",
  );
  return deepFreeze(evidence);
}

function architectureEvidence() {
  const source = readRepository(architecturePath, architectureSha).toString("utf8");
  const sections = [...source.matchAll(/^## ([1-9][0-9]*)\. [^\r\n]+$/gmu)].map((match) =>
    Number(match[1]),
  );
  exact(
    sections,
    Array.from({ length: 21 }, (_, index) => index + 1),
    "Architecture sections",
  );
  const childIds = [...source.matchAll(/^\|\s+(19[A-J]-[0-9]{2})\s+\|/gmu)].map(
    (match) => match[1],
  );
  const counts = Object.fromEntries(
    "ABCDEFGHIJ"
      .split("")
      .map((letter) => [letter, childIds.filter((id) => id.startsWith(`19${letter}-`)).length]),
  );
  const expectedIds = Object.entries(expectedArchitecture.childDistribution).flatMap(
    ([letter, count]) =>
      Array.from(
        { length: count },
        (_, index) => `19${letter}-${String(index + 1).padStart(2, "0")}`,
      ),
  );
  exact(childIds, expectedIds, "Architecture child IDs");
  const row = (id: "P10B-19A" | "P10B-19B") => {
    const text = source.match(new RegExp(`^\\|\\s+${id}\\s+\\|[^\\r\\n]+$`, "mu"))?.[0];
    if (!text) throw new Error(`Architecture parent row is missing: ${id}.`);
    return text
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
  };
  const actual = {
    path: architecturePath,
    fileSha256: architectureSha,
    numberedSectionCount: sections.length,
    mermaidDiagramCount: [...source.matchAll(/^```mermaid[ \t]*$/gmu)].length,
    acceptedArchitectureChildCount: childIds.length,
    acceptedChildIdFingerprint: canonicalValueFingerprint(childIds),
    childDistribution: counts,
    nestedDeliveryDecompositionChildDelta: 0,
    p10b19aExitBoundary: row("P10B-19A")[3],
    p10b19bEntryDependency: row("P10B-19B")[2],
  };
  return exactValue(expectedArchitecture).parse(actual);
}

function outcome(inventory: RetainedInventory, matrixId: string, key: string): unknown {
  const value = inventory.matrixEntries.find((entry) => entry.matrixId === matrixId)
    ?.expectedOutcomes[key];
  if (value === undefined) throw new Error(`Retained outcome is missing: ${matrixId}.${key}.`);
  return value;
}
function retainedEvidence(inventory: RetainedInventory) {
  const metric = inventory.expectedSemanticMetrics;
  // prettier-ignore
  const actual = {
    inventoryFingerprint: inventory.inventoryFingerprint, fixtureSha256: sha256(readFileSync(retainedInventoryPath)), retainedSemanticMetricsFingerprint: canonicalValueFingerprint(metric), matrixEntryCount: inventory.matrixEntries.length, protectedProductionHashCount: inventory.protectedProductionAuthorities.length, productionInactivityAssertionCount: inventory.productionInactivityAssertions.length,
    completeMatrix: { caseCount: metric.completeCaseCount, successfulCompileCount: metric.successfulCompileCount, successfulReplayCount: metric.successfulReplayCount, consumedAuthorityLineageCount: metric.consumedAuthorityLineageCount, normalizedMaterialTopologyCount: metric.normalizedMaterialTopologyCount, directionLabelFreeTopologyCount: metric.directionLabelFreeTopologyCount, repeatedClusterCount: metric.repeatedClusterCount, repeatedMembershipCount: metric.repeatedMembershipCount, largestRepeatedClusterSize: metric.largestRepeatedClusterSize, singletonCount: metric.singletonCount, caseSetFingerprint: metric.completeMatrixCaseSetFingerprint },
    frozenMatrix: { caseCount: metric.frozenCaseCount, normalizedTopologyCount: metric.frozenNormalizedTopologyCount, repeatedMembershipCount: metric.frozenRepeatedMembershipCount, largestClusterSize: metric.frozenLargestClusterSize, singletonCount: metric.frozenSingletonCount, caseSetFingerprint: metric.frozenMatrixCaseSetFingerprint },
  };
  return exactValue(expectedRetained).parse(actual);
}
function positiveEvidence() {
  const bytes = readRepository(frozenFiles[3].path, frozenFiles[3].sha256);
  const source = b1SourceSchema.parse(parseJson(bytes));
  const { baselineFingerprint, ...material } = source;
  if (
    `p10b-19a-positive-cross-authority-integration-${canonicalValueFingerprint(material)}` !==
    baselineFingerprint
  )
    throw new Error("A-10B1 baseline fingerprint is stale.");
  const mixed = source.compatibilityEvidence.evaluations[2];
  const sequential = source.selectionEvidence.sequentialDistinct;
  // prettier-ignore
  const evidence = {
    baselineFingerprint, fixtureSha256: sha256(bytes), pageBlueprintCandidateCount: source.fixtureCounts.pageBlueprintCandidateCount, primaryPageBlueprintCandidateCount: source.fixtureCounts.primaryPageBlueprintCandidateCount, fallbackOnlyPageBlueprintCandidateCount: source.fixtureCounts.fallbackOnlyPageBlueprintCandidateCount, structuralFamilyCandidateCount: source.fixtureCounts.structuralFamilyCandidateCount, compatibilityProfileCount: source.fixtureCounts.compatibilityProfileCount, capabilityContextCount: source.fixtureCounts.capabilityContextCount, compatibilityEvaluationCount: source.compatibilityEvidence.evaluationCount, profileCatalogueFingerprint: source.compatibilityEvidence.profileCatalogueFingerprint, familyConstrainedDirectSelectionCount: source.selectionEvidence.familyConstrainedDirect.length,
    mixedPageStatusCounts: mixed.pageStatusCounts, mixedFamilyStatusCounts: mixed.familyStatusCounts, mixedReceiptResolutionCounts: source.selectionEvidence.mixedFallback.resolutionModeCounts, sequentialDistinctSelectionCount: sequential.length, sequentialDistinctFamilyTopologyCount: new Set(sequential.map((entry) => entry.selectedFamilyTopologyFingerprint)).size, sequentialDistinctCompleteStoreTopologyCount: new Set(sequential.map((entry) => entry.selectedCompleteStoreTopologyFingerprint)).size,
  };
  return { source, evidence: exactValue(expectedPositive).parse(evidence) };
}
function negativeEvidence(requireExternal: boolean) {
  const bytes = readRepository(frozenFiles[7].path, frozenFiles[7].sha256);
  const baseline = parseFailureBaseline(parseJson(bytes), false);
  if (
    requireExternal &&
    sha256(readRegular(a10b2ExternalPath, "A-10B2 external baseline")) !== a10b2ExternalSha
  )
    throw new Error("A-10B2 external baseline hash is stale.");
  const aggregate = baseline.aggregateEvidence;
  const activity = aggregate.noRepairOrFallbackCounts;
  // prettier-ignore
  const evidence = {
    baselineFingerprint: baseline.baselineFingerprint, fixtureSha256: sha256(bytes), canonicalMaterialSha256: failureBaselineMaterialSha256(baseline), externalBaselineSha256: a10b2ExternalSha, totalCaseCount: aggregate.totalCaseCount, passedCaseCount: aggregate.passedCaseCount,
    typedErrorObservationCount: baseline.failureCases.filter((entry) => entry.failureAuthorityKind === "typed-error").length, zodIssueObservationCount: baseline.failureCases.filter((entry) => entry.failureAuthorityKind === "zod-issues").length, nativeErrorNullCodeCount: baseline.failureCases.filter((entry) => entry.errorName === "Error" && entry.errorCode === null).length, authorityConfusionCaseCount: baseline.failureCases.filter((entry) => entry.corruptionClass === "authority-confusion").length,
    ownerMismatchCount: aggregate.ownerMismatchCount, terminalPhaseMismatchCount: aggregate.terminalPhaseMismatchCount, downstreamExecutionCount: aggregate.downstreamExecutionCount, partialOutputCount: aggregate.partialOutputCount, sourceMutationCount: aggregate.sourceMutationCount, repositoryWriteCount: aggregate.repositoryWriteCount, productionFileChangeCount: aggregate.productionFileChangeCount, automaticRepairCount: activity.automaticRepairCount, silentNormalizationCount: activity.silentNormalizationCount, fallbackToV1Count: activity.fallbackToV1Count, fallbackToV2Count: activity.fallbackToV2Count, defaultCandidateCount: activity.defaultCandidateCount, partialReceiptCount: activity.partialReceiptCount, partialPublicationResultCount: activity.partialPublicationResultCount, snapshotMutationCount: activity.snapshotMutationCount, catalogueMutationCount: activity.catalogueMutationCount, commerceMutationCount: activity.commerceMutationCount, mediaMutationCount: activity.mediaMutationCount, testOnlyPublicationConfirmationCount: activity.testOnlyPublicationConfirmationCount, externalPublicationCallCount: aggregate.externalPublicationCount, providerCallCount: aggregate.providerCallCount, veskoCallCount: aggregate.veskoCallCount,
  };
  return { baseline, evidence: exactValue(expectedNegative).parse(evidence) };
}
function structuralEvidence(inventory: RetainedInventory) {
  Object.values(structuralSources).forEach(({ path: file, sha256: expected }) =>
    readRepository(file, expected),
  );
  // prettier-ignore
  const actual = {
    structuralFamilyIds: { count: structuralStorefrontFamilyIds.length, fingerprint: canonicalValueFingerprint(structuralStorefrontFamilyIds) }, structuralPageFamilyRoles: { count: structuralStorefrontPageFamilyIds.length, fingerprint: canonicalValueFingerprint(structuralStorefrontPageFamilyIds) }, crossPageRelationshipKinds: { count: structuralStorefrontCrossPageRelationshipKinds.length, fingerprint: canonicalValueFingerprint(structuralStorefrontCrossPageRelationshipKinds) }, pageBlueprintV2StructuralAuthority: structuralSources.pageBlueprintV2Structural,
    canonicalAssetRoles: { count: assetRoleValues.length, fingerprint: canonicalValueFingerprint(assetRoleValues) }, assetRoleAuthority: structuralSources.assetRoles, responsiveBreakpoints: { count: pageBlueprintV2ResponsiveBreakpointAuthority.length, fingerprint: canonicalValueFingerprint(pageBlueprintV2ResponsiveBreakpointAuthority) }, responsiveRuleAuthority: structuralSources.responsiveRules, omissionSubstitutionFallbackAuthority: structuralSources.omissionSubstitutionFallback,
    productionCandidateRegistry: { state: "empty", pageBlueprintCandidateCount: inactiveStructuralStorefrontFamilyCandidateRegistry.pageBlueprintCandidates.length, structuralFamilyCandidateCount: inactiveStructuralStorefrontFamilyCandidateRegistry.familyCandidates.length }, normalizedTopology: outcome(inventory, "normalized-topology", "family-topology-identity"), compatibilityEvaluation: "deterministic", selection: { method: "scoring-free-and-deterministic", combinationMaximum: MAX_STRUCTURAL_STOREFRONT_SELECTION_COMBINATION_EVALUATIONS }, positiveIntegrationBaselineFingerprint: a10b1Fingerprint, negativeIntegrationBaselineFingerprint: a10b2Fingerprint,
  };
  return exactValue(expectedStructural).parse(actual);
}

export function deriveFinalRetainedTestFiles(inventory: RetainedInventory) {
  const retained = [...new Set(inventory.matrixEntries.flatMap((entry) => entry.testFiles))].sort(
    compare,
  );
  if (retained.length !== 20) throw new Error("A-10A retained union is not 20 files.");
  const additions = [
    "tests/integration/p10b-19a-10b1-positive-cross-authority-integration.test.ts",
    "tests/integration/p10b-19a-10b2-fail-closed-cross-authority-matrix.test.ts",
    "tests/integration/p10b-19a-10c-architecture-closure.test.ts",
    "tests/unit/p10b-19a-10b1-positive-integration-baseline.test.ts",
    "tests/unit/p10b-19a-10b2-failure-baseline.test.ts",
    "tests/unit/p10b-19a-10c-closure-manifest.test.ts",
  ];
  const derived = [...new Set([...retained, ...additions])].sort(compare);
  exact(derived, finalRetainedTestFiles, "Final retained test plan");
  return deepFreeze(derived);
}
function authorityFingerprint(value: object, omittedKey: string, prefix: string): string {
  const material = { ...value } as Record<string, unknown>;
  delete material[omittedKey];
  return `${prefix}-${canonicalValueFingerprint(material)}`;
}
export function closureCandidateFingerprint(value: ClosureCandidateMaterial | ClosureCandidate) {
  return authorityFingerprint(
    value,
    "closureCandidateFingerprint",
    "p10b-19a-structural-architecture-closure-candidate",
  );
}
export function parseClosureCandidate(value: unknown): ClosureCandidate {
  const parsed = closureCandidateSchema.parse(value);
  if (
    closureCandidateFingerprint(parsed) !== parsed.closureCandidateFingerprint ||
    parsed.closureCandidateFingerprint !== acceptedClosureCandidateFingerprint
  )
    throw new Error("P10B-19A closure candidate fingerprint is stale.");
  return deepFreeze(parsed);
}
export function productOwnerDecisionFingerprint(value: object) {
  return authorityFingerprint(
    value,
    "decisionFingerprint",
    "p10b-19a-product-owner-architecture-decision",
  );
}
export function parseProductOwnerDecision(value: unknown): ProductOwnerDecision {
  const parsed = productOwnerDecisionSchema.parse(value);
  if (
    productOwnerDecisionFingerprint(parsed) !== parsed.decisionFingerprint ||
    parsed.decisionFingerprint !== acceptedDecisionFingerprint
  )
    throw new Error("P10B-19A product-owner decision fingerprint is stale.");
  return deepFreeze(parsed);
}
export function createProductOwnerDecision(
  candidate: ClosureCandidate,
  decisionText: unknown,
): ProductOwnerDecision {
  parseClosureCandidate(candidate);
  if (decisionText !== exactProductOwnerDecisionText)
    throw new Error("Exact product-owner architecture acceptance is required.");
  return parseProductOwnerDecision(acceptedDecision);
}
export function closureManifestFingerprint(value: object) {
  return authorityFingerprint(
    value,
    "closureFingerprint",
    "p10b-19a-structural-architecture-closure",
  );
}
export function parseClosureManifest(value: unknown): ClosureManifest {
  const parsed = closureManifestSchema.parse(value);
  if (
    closureManifestFingerprint(parsed) !== parsed.closureFingerprint ||
    parsed.closureFingerprint !== expectedClosureFingerprint
  )
    throw new Error("P10B-19A closure manifest fingerprint is stale.");
  return deepFreeze(parsed);
}
export function createClosureManifest(
  candidate: ClosureCandidate,
  decision: ProductOwnerDecision,
): ClosureManifest {
  const acceptedCandidate = parseClosureCandidate(candidate);
  const acceptedProductOwnerDecision = parseProductOwnerDecision(decision);
  // prettier-ignore
  const material = closureMaterialSchema.parse({
    schemaVersion: "1.0.0", authorityKind: "p10b-19a-structural-architecture-closure", baseCommit: acceptedCandidate.baseCommit, architectureLock: acceptedCandidate.architectureLock, predecessorAuthority: acceptedCandidate.predecessorAuthority, structuralExitEvidence: acceptedCandidate.structuralExitEvidence, legacyCompatibilityEvidence: acceptedCandidate.legacyCompatibilityEvidence, integrationEvidence: acceptedCandidate.integrationEvidence, productionBoundary: acceptedCandidate.productionBoundary, acceptedLimitations: acceptedCandidate.acceptedLimitations,
    productOwnerDecision: {
      decisionText: acceptedProductOwnerDecision.decisionText, decisionFingerprint: acceptedProductOwnerDecision.decisionFingerprint, acceptedClosureCandidateFingerprint: acceptedProductOwnerDecision.acceptedClosureCandidateFingerprint, acceptedLimitations: acceptedProductOwnerDecision.acceptedLimitations,
    },
    statusTransition: exactStatusTransition, exactNextTask: acceptedCandidate.exactNextTask,
  });
  return parseClosureManifest({
    ...material,
    closureFingerprint: closureManifestFingerprint(material),
  });
}
export function readClosureManifest(): ClosureManifest {
  return parseClosureManifest(
    parseJson(readRepository(closureManifestRelativePath, closureManifestFixtureSha256)),
  );
}
export function createClosureCandidate(): ClosureCandidate {
  const predecessorBytes = verifyFrozenPredecessorBytes();
  const inventory = readRetainedInventory();
  const positive = positiveEvidence();
  const negative = negativeEvidence(process.env.VESKIFY_A10C_WRITE_PRE_GATE === "1");
  exact(positive.source.legacyCompatibilityEvidence, expectedLegacySource, "A-09 compatibility");
  const retainedFiles = deriveFinalRetainedTestFiles(inventory);
  const production = negative.baseline.aggregateEvidence.productionV2AuthorityCounts;
  // prettier-ignore
  const actualProduction = {
    productionPageBlueprintCandidateCount: production.pageBlueprintCandidateCount, productionStructuralFamilyCandidateCount: production.structuralFamilyCandidateCount, productionCompatibilityProfileCount: production.compatibilityProfileCount, productionCapabilityContextCount: production.capabilityContextCount, productionCompatibilityEvaluationCount: production.compatibilityEvaluationCount, productionSelectionRequestCount: production.selectionRequestCount, productionSelectionReceiptCount: production.selectionReceiptCount, productionActiveStructuralFamilyCount: production.activeStructuralFamilyCount, productionSelectableStructuralFamilyCount: production.selectableStructuralFamilyCount,
    currentGenerationP10b19aConsumerCount: positive.source.productionInactivityEvidence.currentGenerationV2ConsumerCount, clientRuntimeConsumerCount: positive.source.productionInactivityEvidence.clientRuntimeLeakCount, productionSourceFileChangeCount: negative.evidence.productionFileChangeCount, merchantVisibleChangeCount: 0, providerCallCount: negative.evidence.providerCallCount, veskoCallCount: negative.evidence.veskoCallCount, externalPublicationCallCount: negative.evidence.externalPublicationCallCount, a10cPublicationPreparationCount: 0, a10cPublicationConfirmationCount: 0, imageGenerationCallCount: 0, secretFileAccessCount: 0,
    retainedA09PreparationExpectedCount: positive.source.legacyCompatibilityEvidence.preparationExpectedCount, retainedA09PreparationActualCount: positive.source.legacyCompatibilityEvidence.preparationActualCount, retainedA09IsolatedConfirmationExpectedCount: positive.source.legacyCompatibilityEvidence.isolatedConfirmationExpectedCount, retainedA09IsolatedConfirmationActualCount: positive.source.legacyCompatibilityEvidence.isolatedConfirmationActualCount,
  };
  const material = candidateMaterialSchema.parse({
    candidateSchemaVersion: "1.0.0",
    authorityKind: "p10b-19a-structural-architecture-closure-candidate",
    baseCommit: taskBase,
    architectureLock: architectureEvidence(),
    predecessorAuthority: {
      ...expectedPredecessors,
      frozenFileCount: predecessorBytes.fileCount,
      frozenPathSetFingerprint: predecessorBytes.pathSetFingerprint,
      frozenByteManifestFingerprint: predecessorBytes.byteManifestFingerprint,
    },
    structuralExitEvidence: structuralEvidence(inventory),
    legacyCompatibilityEvidence: {
      ...positive.source.legacyCompatibilityEvidence,
      selectorEligibility: "legacy-v1-ineligible",
    },
    integrationEvidence: {
      retained: retainedEvidence(inventory),
      positive: positive.evidence,
      negative: negative.evidence,
      retainedPlan: {
        testFileCount: retainedFiles.length,
        testFileSetFingerprint: canonicalValueFingerprint(retainedFiles),
        exactCommand: finalRetainedVitestCommand,
      },
    },
    productionBoundary: exactValue(expectedProduction).parse(actualProduction),
    acceptedLimitations,
    exactNextTask,
  });
  return parseClosureCandidate({
    ...material,
    closureCandidateFingerprint: closureCandidateFingerprint(material),
  });
}

export function rejectPreGateClosureDecision(decision: unknown): never {
  void decision;
  throw new Error("Accepted product-owner architecture authority is unavailable before the gate.");
}

export function createProductOwnerReviewPacket(candidate: ClosureCandidate): string {
  const retained = candidate.integrationEvidence.retained;
  const positive = candidate.integrationEvidence.positive;
  const negative = candidate.integrationEvidence.negative;
  const legacy = candidate.legacyCompatibilityEvidence;
  const limitations = candidate.acceptedLimitations.map((entry) => `- \`${entry}\``).join("\n");
  // prettier-ignore
  const sections = [
    ["Task base and closure candidate fingerprint", `- Task base: \`${candidate.baseCommit}\`\n- Candidate: \`${candidate.closureCandidateFingerprint}\``],
    ["What P10B-19A now proves", "The versioned structural contracts, inactive catalogue, topology, compatibility,\ndeterministic selection, legacy compatibility, and integration evidence are coherent."],
    ["What P10B-19A explicitly does not prove", "It proves no active or rendered v2 family, visual or commercial quality,\nlive-AI quality, or merchant-visible output."],
    ["A-10A retained matrix summary", `The retained authority has ${retained.matrixEntryCount} matrices,\n${retained.protectedProductionHashCount} protected hashes,\n${retained.productionInactivityAssertionCount} inactivity assertions,\n${retained.completeMatrix.caseCount} accepted cases, and\n${retained.frozenMatrix.caseCount} frozen cases.`],
    ["A-10B1 positive integration summary", `The accepted baseline binds ${positive.pageBlueprintCandidateCount} PageBlueprint\ncandidates, ${positive.structuralFamilyCandidateCount} Structural Family candidates,\n${positive.compatibilityProfileCount} profiles, ${positive.capabilityContextCount}\ncontexts, and ${positive.sequentialDistinctSelectionCount} distinct selections.`],
    ["A-10B2 36-case failure summary", `All ${negative.passedCaseCount}/${negative.totalCaseCount} cases fail closed with\nzero downstream execution, partial output, mutation, write, production change,\nrepair, fallback, provider, Vesko, or external-publication activity.`],
    ["A-09 legacy compatibility summary", `Legacy authority retains ${legacy.legacyAliasCount} aliases,\n${legacy.historicalRepresentativeCount} representatives,\n${legacy.previewObservationActualCount}/${legacy.previewObservationExpectedCount}\nPreview observations, ${legacy.publishedObservationActualCount}/${legacy.publishedObservationExpectedCount}\npublished observations, and exact structural parity. It is not v2-selector eligible.`],
    ["Production inactivity summary", "All nine production v2 counters and every current-generation, client-runtime,\nsource, merchant, A-10C-owned/external-publication, provider, Vesko, image, and\nsecret counter are zero. Retained deterministic A-09 preparation and isolated\nin-memory confirmation remain exactly three of three."],
    ["Architecture-lock integrity and 73-child result", `The byte-exact lock has ${candidate.architectureLock.numberedSectionCount} sections,\n${candidate.architectureLock.mermaidDiagramCount} diagrams, and\n${candidate.architectureLock.acceptedArchitectureChildCount} accepted children.\nNested delivery decomposition changes that count by zero.`],
    ["Accepted limitations", limitations],
    ["Exact next task", `\`${candidate.exactNextTask} — VisualRecipeIntentV1 Safe Schema and Capability Projection\``],
    ["Recommendation", "**ACCEPT**"],
  ] as const;
  return `# P10B-19A Architecture Closure Review\n\n${sections
    .map(([title, body], index) => `## ${index + 1}. ${title}\n\n${body}`)
    .join("\n\n")}\n`;
}

type Artifact = readonly [target: string, content: string, mode: number];
function existingArtifact(target: string, content: string, mode: number): boolean {
  if (!existsSync(target)) return false;
  const information = lstatSync(target);
  const existing = readRegular(target, `Existing governed artifact ${target}`);
  if ((information.mode & 0o777) !== mode || existing.toString("utf8") !== content)
    throw new Error(`Governed artifact replacement refused: ${target}.`);
  return true;
}
function writeArtifacts(artifacts: readonly Artifact[], flag: string): void {
  if (process.env[flag] !== "1") throw new Error("Governed artifact writing is not authorized.");
  const alreadyPresent = artifacts.map(([target, content, mode]) =>
    existingArtifact(target, content, mode),
  );
  artifacts.forEach(([target, content, mode], index) => {
    if (alreadyPresent[index]) return;
    const temporary = path.join(
      path.dirname(target),
      `.${path.basename(target)}.${process.pid}.tmp`,
    );
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, "wx", 0o600);
      writeFileSync(descriptor, content, "utf8");
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      chmodSync(temporary, mode);
      linkSync(temporary, target);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  });
}
export function writePreGateArtifacts(candidate: ClosureCandidate) {
  const checked = parseClosureCandidate(candidate);
  writeArtifacts(
    [
      [closureCandidatePath, `${JSON.stringify(checked, null, 2)}\n`, 0o444],
      [productOwnerReviewPacketPath, createProductOwnerReviewPacket(checked), 0o444],
    ],
    "VESKIFY_A10C_WRITE_PRE_GATE",
  );
  return deepFreeze({ closureCandidatePath, productOwnerReviewPacketPath });
}
export function writeAcceptedClosureArtifacts(decisionText: unknown) {
  if (process.env.VESKIFY_A10C_WRITE_FINAL !== "1")
    throw new Error("Final closure artifact writing is not authorized.");
  const candidate = parseClosureCandidate(
    parseJson(readRegular(closureCandidatePath, "Candidate")),
  );
  exact(candidate, createClosureCandidate(), "Accepted closure candidate");
  const decision = createProductOwnerDecision(candidate, decisionText);
  const manifest = createClosureManifest(candidate, decision);
  const decisionBytes = `${JSON.stringify(decision, null, 2)}\n`;
  const fixtureBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  if (sha256(fixtureBytes) !== closureManifestFixtureSha256)
    throw new Error("Closure manifest fixture bytes are stale.");
  const baselineBytes = `${JSON.stringify({ ...manifest, generationCommandIdentity: finalAuthorityGenerationIdentity, exactTaskBase: taskBase, checkedFixtureSha256: closureManifestFixtureSha256, canonicalMaterialSha256: closureManifestCanonicalMaterialSha256, productOwnerDecisionFingerprint: decision.decisionFingerprint }, null, 2)}\n`;
  if (sha256(baselineBytes) !== externalClosureBaselineSha256)
    throw new Error("External closure baseline bytes are stale.");
  writeArtifacts(
    [
      [productOwnerDecisionPath, decisionBytes, 0o444],
      [closureManifestPath, fixtureBytes, 0o644],
      [externalClosureBaselinePath, baselineBytes, 0o444],
    ],
    "VESKIFY_A10C_WRITE_FINAL",
  );
  return deepFreeze({ productOwnerDecisionPath, closureManifestPath, externalClosureBaselinePath });
}
