// @vitest-environment node

import { describe, expect, it } from "vitest";

import * as templates from "@/application/storefront-templates";
// prettier-ignore
import { parseStructuralStorefrontDeterministicSelectionReceipt, selectDeterministicStructuralStorefrontCandidate } from "@/application/storefront-templates/structural-storefront-deterministic-selection";
import { parseStructuralStorefrontDeterministicSelectionRequest } from "@/application/storefront-templates/structural-storefront-selection-contract";
import { canonicalValueString } from "@/domain/storefront";
// prettier-ignore
import { structuralStorefrontFamilyIds, structuralStorefrontPageFamilyIds } from "@/domain/structural-storefront-family";
import { readA09Baselines } from "../helpers/p10b-19a-10a-retained-matrix-inventory";
// prettier-ignore
import { createPositiveCrossAuthorityIntegrationAuthority, type PositiveCrossAuthorityIntegrationAuthority } from "../helpers/p10b-19a-10b1-positive-cross-authority-integration";

type Authority = PositiveCrossAuthorityIntegrationAuthority;
// prettier-ignore
type Bundle = Readonly<{ selectionRequest: Authority["selections"]["mixed"]["selectionRequest"]; selectionReceipt: Authority["selections"]["mixed"]["selectionReceipt"] }>;
type Context = Authority["contexts"]["directEn"];
type Evaluation = Authority["evaluations"]["directEn"];

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach((child) => expectDeepFrozen(child, seen));
}

function replay(authority: Authority, bundle: Bundle, context: Context, evaluation: Evaluation) {
  // prettier-ignore
  const input = { candidateRegistry: authority.candidateRegistry, normalizedTopologyIndex: authority.normalizedTopologyIndex, capabilityContext: context, compatibilityProfileCatalogue: authority.compatibilityProfileCatalogue, compatibilityEvaluation: evaluation, selectionRequest: bundle.selectionRequest };
  // prettier-ignore
  expect(parseStructuralStorefrontDeterministicSelectionRequest(evaluation.evaluationFingerprint, bundle.selectionRequest)).toEqual(bundle.selectionRequest);
  expect(selectDeterministicStructuralStorefrontCandidate(input)).toEqual(bundle.selectionReceipt);
  // prettier-ignore
  expect(parseStructuralStorefrontDeterministicSelectionReceipt(input, bundle.selectionReceipt)).toEqual(bundle.selectionReceipt);
}

const authority = createPositiveCrossAuthorityIntegrationAuthority();

describe("P10B-19A-10B1 positive cross-authority integration", () => {
  it("composes eight shared PageBlueprint candidates and six complete families through A-03 to A-07", () => {
    const { pageBlueprintCandidates: pages, familyCandidates: families } =
      authority.candidateRegistry;
    expect([pages.length, families.length]).toEqual([8, 6]);
    const ids = pages.map(({ structural }) => structural.id);
    // prettier-ignore
    expect(ids.filter((id) => id.endsWith("-primary"))).toEqual(["test-a10b1-home-primary", "test-a10b1-collection-primary", "test-a10b1-search-primary", "test-a10b1-product-detail-primary", "test-a10b1-content-support-primary", "test-a10b1-utility-primary"]);
    // prettier-ignore
    expect(ids.filter((id) => !id.endsWith("-primary"))).toEqual(["test-a10b1-product-detail-intermediate", "test-a10b1-product-detail-terminal"]);
    // prettier-ignore
    expect(pages.every(({ candidateSchemaVersion, structural }) => candidateSchemaVersion === "1.0.0" && structural.version === "1.0.0" && /^test-a10b1-[a-z-]+$/u.test(structural.id))).toBe(true);
    pages.forEach((candidate) => {
      // prettier-ignore
      const { structural, assetRoleCompatibility: assets, responsiveRules: responsive, omissionSubstitutionFallback: fallback } = candidate;
      expect([
        templates.canonicalizePageBlueprintV2StructuralContract(structural),
        templates.canonicalizePageBlueprintV2AssetRoleCompatibilityContract(structural, assets),
        templates.canonicalizePageBlueprintV2ResponsiveRuleContract(structural, responsive),
        // prettier-ignore
        templates.canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract(structural, assets, responsive, fallback),
        templates.parsePageBlueprintV2CandidateAuthority(candidate),
      ]).toEqual([structural, assets, responsive, fallback, candidate]);
    });
    // prettier-ignore
    expect(templates.canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry(authority.candidateRegistry)).toEqual(authority.candidateRegistry);
    const sharedProfiles = families[0].pageFamilyProfiles;
    expect(families.map(({ familyId }) => familyId)).toEqual(structuralStorefrontFamilyIds);
    // prettier-ignore
    expect(families.every(({ candidateSchemaVersion, familyVersion, lifecycleState }) => candidateSchemaVersion === "1.0.0" && familyVersion === "1.0.0" && lifecycleState === "candidate")).toBe(true);
    families.forEach((family) => {
      expect(templates.parseStructuralStorefrontFamilyCandidate(family)).toEqual(family);
      // prettier-ignore
      expect(family.pageFamilyProfiles.map(({ pageFamilyId }) => pageFamilyId)).toEqual(structuralStorefrontPageFamilyIds);
      // prettier-ignore
      expect(family.pageFamilyProfiles.map(({ blueprintCandidates }) => blueprintCandidates)).toEqual(sharedProfiles.map(({ blueprintCandidates }) => blueprintCandidates));
    });
    // prettier-ignore
    const referencedIds = new Set(families.flatMap(({ pageFamilyProfiles }) => pageFamilyProfiles.flatMap(({ blueprintCandidates }) => blueprintCandidates.map(({ blueprintId }) => blueprintId))));
    // prettier-ignore
    expect(ids.filter((id) => !id.endsWith("-primary")).every((id) => !referencedIds.has(id))).toBe(true);
    expect(new Set(pages.map(({ candidateFingerprint }) => candidateFingerprint)).size).toBe(8);
    expect(new Set(families.map(({ candidateFingerprint }) => candidateFingerprint)).size).toBe(6);
  });

  it("retains exact identities beside eight page and three paired family topology identities", () => {
    const index = authority.normalizedTopologyIndex;
    expect([index.pageBlueprintEntries.length, index.familyEntries.length]).toEqual([8, 6]);
    index.pageBlueprintEntries.forEach((entry) => {
      // prettier-ignore
      expect(templates.parsePageBlueprintV2NormalizedTopology(entry.normalizedTopology)).toEqual(entry.normalizedTopology);
      // prettier-ignore
      expect([entry.candidateIdentityKey, entry.exactCandidateFingerprint].some((value) => canonicalValueString(entry.normalizedTopology).includes(value))).toBe(false);
    });
    index.familyEntries.forEach((entry) => {
      // prettier-ignore
      expect(templates.parseStructuralStorefrontFamilyNormalizedTopology(entry.normalizedTopology)).toEqual(entry.normalizedTopology);
      // prettier-ignore
      expect([entry.candidateIdentityKey, entry.exactCandidateFingerprint].some((value) => canonicalValueString(entry.normalizedTopology).includes(value))).toBe(false);
    });
    expect(index.duplicateFamilyTopologyClusters).toHaveLength(3);
    // prettier-ignore
    expect(index.duplicateFamilyTopologyClusters.every(({ candidateIdentityKeys }) => candidateIdentityKeys.length === 2)).toBe(true);
    // prettier-ignore
    expect(new Set(index.familyEntries.map(({ normalizedTopology }) => normalizedTopology.topologyFingerprint)).size).toBe(3);
    // prettier-ignore
    const productPages = authority.candidateRegistry.pageBlueprintCandidates.filter(({ structural }) => structural.pageFamilyId === "product-detail");
    // prettier-ignore
    const productTopologies = index.pageBlueprintEntries.filter(({ candidateIdentityKey }) => candidateIdentityKey.includes("product-detail"));
    // prettier-ignore
    expect(new Set(productPages.map(({ structural }) => canonicalValueString(structural.regions.map(({ id }) => id)))).size).toBe(3);
    // prettier-ignore
    expect(new Set(productTopologies.map(({ normalizedTopology }) => normalizedTopology.topologyFingerprint)).size).toBe(1);
  });

  it("parses direct EN and FI contexts, profiles and evaluations without locale entering topology", () => {
    const { candidateRegistry: registry, compatibilityProfileCatalogue: catalogue } = authority;
    expect([catalogue.profiles.length, Object.keys(authority.contexts).length]).toEqual([6, 3]);
    // prettier-ignore
    expect(templates.parseInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue(catalogue)).toEqual(catalogue);
    // prettier-ignore
    expect(templates.validateInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogueBinding(registry, catalogue)).toEqual(catalogue);
    catalogue.profiles.forEach((profile, index) =>
      // prettier-ignore
      expect(templates.parseStructuralStorefrontFamilyCompatibilityProfile(registry.familyCandidates[index], profile)).toEqual(profile),
    );
    (["directEn", "directFi"] as const).forEach((key) => {
      const context = authority.contexts[key];
      const evaluation = authority.evaluations[key];
      expect(templates.parseStructuralStorefrontCapabilityContext(registry, context)).toEqual(
        context,
      );
      // prettier-ignore
      expect(templates.parseStructuralStorefrontCandidateCompatibilityEvaluation({ candidateRegistry: registry, normalizedTopologyIndex: authority.normalizedTopologyIndex, capabilityContext: context, compatibilityProfileCatalogue: catalogue }, evaluation)).toEqual(evaluation);
      expect(
        evaluation.pageBlueprintEvaluations.every(({ status }) => status === "directly-compatible"),
      ).toBe(true);
      expect(
        evaluation.familyEvaluations.every(({ status }) => status === "directly-compatible"),
      ).toBe(true);
    });
    expect(authority.contexts.directEn.contextFingerprint).not.toBe(
      authority.contexts.directFi.contextFingerprint,
    );
    expect(authority.evaluations.directEn.evaluationFingerprint).not.toBe(
      authority.evaluations.directFi.evaluationFingerprint,
    );
    // prettier-ignore
    expect(authority.selections.localeEquivalent[0].selectionReceipt.selectedCompleteStoreTopology.topologyFingerprint).toBe(authority.selections.localeEquivalent[1].selectionReceipt.selectedCompleteStoreTopology.topologyFingerprint);
  });

  it("resolves the mixed context through exact two-hop substitution and optional omission", () => {
    const evaluation = authority.evaluations.mixedEn;
    const statuses = evaluation.pageBlueprintEvaluations.map(({ status }) => status);
    // prettier-ignore
    expect(["directly-compatible", "substitution-compatible", "omission-compatible", "incompatible"].map((status) => statuses.filter((value) => value === status).length)).toEqual([5, 2, 1, 0]);
    expect(
      evaluation.familyEvaluations.every(({ status }) => status === "conditionally-compatible"),
    ).toBe(true);
    const decisions = authority.selections.mixed.selectionReceipt.pageFamilySelections;
    const product = decisions.find(({ pageFamilyId }) => pageFamilyId === "product-detail");
    const content = decisions.find(({ pageFamilyId }) => pageFamilyId === "content-support");
    // prettier-ignore
    expect(["direct", "substitution", "omission"].map((mode) => decisions.filter(({ resolutionMode }) => resolutionMode === mode).length)).toEqual([4, 1, 1]);
    // prettier-ignore
    expect(product).toMatchObject({ resolutionMode: "substitution", substitutionPathCandidateIdentityKeys: ["test-a10b1-product-detail-intermediate@1.0.0", "test-a10b1-product-detail-terminal@1.0.0"], effectiveCandidateIdentityKey: "test-a10b1-product-detail-terminal@1.0.0", terminalCompatibilityStatus: "directly-compatible" });
    // prettier-ignore
    expect(content).toMatchObject({ resolutionMode: "omission", omittedRegionIds: ["test-a10b1-brand-story-region"], terminalCompatibilityStatus: "omission-compatible" });
  });

  it("retains omission as immutable authority without removing structural or responsive material", () => {
    const before = canonicalValueString(authority);
    const content = authority.candidateRegistry.pageBlueprintCandidates.find(
      ({ structural }) => structural.pageFamilyId === "content-support",
    );
    expect(content?.structural.regions.map(({ id }) => id)).toContain(
      "test-a10b1-brand-story-region",
    );
    // prettier-ignore
    expect(content?.responsiveRules.breakpointRules.every(({ regionProportionRules }) => regionProportionRules.some(({ regionId }) => regionId === "test-a10b1-brand-story-region"))).toBe(true);
    // prettier-ignore
    const selected = authority.selections.mixed.selectionReceipt.selectedCompleteStoreTopology.pageFamilyTopologies.find(({ pageFamilyId }) => pageFamilyId === "content-support");
    expect(selected?.omittedTopologyRegionIds).toEqual(["r1"]);
    replay(
      authority,
      authority.selections.mixed,
      authority.contexts.mixedEn,
      authority.evaluations.mixedEn,
    );
    expect(canonicalValueString(authority)).toBe(before);
    expectDeepFrozen(authority);
  });

  it("deterministically replays every family-constrained, locale and mixed receipt", () => {
    // prettier-ignore
    expect(authority.selections.familyConstrainedDirect.map(({ selectionReceipt }) => selectionReceipt.selectedFamilyCandidate.familyId)).toEqual(structuralStorefrontFamilyIds);
    authority.selections.familyConstrainedDirect.forEach((bundle) => {
      expect(bundle.selectionReceipt.selectedFamilyCandidate.familyId).toBe(bundle.familyId);
      expect(bundle.selectionReceipt.pageFamilySelections).toHaveLength(6);
      // prettier-ignore
      expect(bundle.selectionReceipt.pageFamilySelections.every(({ resolutionMode, substitutionPathCandidateIdentityKeys, omittedRegionIds }) => resolutionMode === "direct" && substitutionPathCandidateIdentityKeys.length === 0 && omittedRegionIds.length === 0)).toBe(true);
      replay(authority, bundle, authority.contexts.directEn, authority.evaluations.directEn);
    });
    authority.selections.localeEquivalent.forEach((bundle) => {
      const key = bundle.locale === "en" ? "directEn" : "directFi";
      replay(authority, bundle, authority.contexts[key], authority.evaluations[key]);
    });
    replay(
      authority,
      authority.selections.mixed,
      authority.contexts.mixedEn,
      authority.evaluations.mixedEn,
    );
  });

  it("uses explicit sequential exclusions beside unchanged A-09/A-10A and zero production reachability", () => {
    const sequential = authority.selections.sequential;
    sequential.forEach((bundle, index) => {
      const prior = sequential.slice(0, index).map(({ selectionReceipt }) => selectionReceipt);
      // prettier-ignore
      expect(bundle.selectionRequest.excludedFamilyTopologyFingerprints).toEqual(prior.map(({ selectedFamilyCandidate }) => selectedFamilyCandidate.normalizedTopologyFingerprint).sort());
      // prettier-ignore
      expect(bundle.selectionRequest.excludedCompleteStoreTopologyFingerprints).toEqual(prior.map(({ selectedCompleteStoreTopology }) => selectedCompleteStoreTopology.topologyFingerprint).sort());
      replay(authority, bundle, authority.contexts.directEn, authority.evaluations.directEn);
    });
    const exactFamilyIdentities = sequential.map(
      ({ selectionReceipt }) => selectionReceipt.selectedFamilyCandidate.candidateIdentityKey,
    );
    // prettier-ignore
    expect([new Set(exactFamilyIdentities).size, new Set(sequential.map(({ selectionReceipt }) => selectionReceipt.selectedFamilyCandidate.normalizedTopologyFingerprint)).size, new Set(sequential.map(({ selectionReceipt }) => selectionReceipt.selectedCompleteStoreTopology.topologyFingerprint)).size]).toEqual([3, 3, 3]);
    // prettier-ignore
    expect(sequential.every(({ selectionReceipt }) => authority.candidateRegistry.familyCandidates.some(({ familyId, familyVersion, candidateFingerprint }) => `${familyId}@${familyVersion}` === selectionReceipt.selectedFamilyCandidate.candidateIdentityKey && candidateFingerprint === selectionReceipt.selectedFamilyCandidate.exactCandidateFingerprint))).toBe(true);

    const inventory = authority.retainedInventory;
    // prettier-ignore
    expect([inventory.matrixEntries.length, inventory.protectedProductionAuthorities.length, inventory.productionInactivityAssertions.length]).toEqual([24, 76, 9]);
    // prettier-ignore
    expect(inventory.expectedSemanticMetrics).toMatchObject({ completeCaseCount: 126, frozenCaseCount: 72, legacyAliasCount: 3, historicalRepresentativeCount: 3, previewObservationExpectedCount: 36, previewObservationActualCount: 36, previewLocaleCount: 2, previewSurfaceCount: 6, previewRepositoryWriteCount: 0, previewSourceMutationCount: 0, directCompilationExpectedCount: 3, directCompilationActualCount: 3, preparationExpectedCount: 3, preparationActualCount: 3, isolatedConfirmationExpectedCount: 3, isolatedConfirmationActualCount: 3, publishedObservationExpectedCount: 36, publishedObservationActualCount: 36, previewPublishedParityExpectedCount: 36, previewPublishedParityActualCount: 36, migrationCurrentExpectedCount: 3, migrationCurrentActualCount: 3, externalPublicationCallCount: 0, providerCallCount: 0, veskoCallCount: 0, commerceMutationCount: 0, mediaMutationCount: 0 });
    const a09 = readA09Baselines();
    // prettier-ignore
    expect([a09.file09b, a09.material09b, a09.file09c, a09.material09c]).toEqual([inventory.expectedSemanticMetrics.a09bBaselineFileSha256, inventory.expectedSemanticMetrics.a09bBaselineMaterialSha256, inventory.expectedSemanticMetrics.a09cBaselineFileSha256, inventory.expectedSemanticMetrics.a09cBaselineMaterialSha256]);

    // prettier-ignore
    expect([templates.inactiveStructuralStorefrontFamilyCandidateRegistry.pageBlueprintCandidates.length, templates.inactiveStructuralStorefrontFamilyCandidateRegistry.familyCandidates.length, templates.inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue.profiles.length]).toEqual([0, 0, 0]);
    // prettier-ignore
    const forbidden = ["createStructuralStorefrontDeterministicSelectionRequest", "parseStructuralStorefrontDeterministicSelectionRequest", "createStructuralStorefrontSelectedCompleteTopology", "createStructuralStorefrontDeterministicSelectionReceipt", "selectDeterministicStructuralStorefrontCandidate", "parseStructuralStorefrontDeterministicSelectionReceipt", "createPositiveCrossAuthorityIntegrationAuthority"];
    expect(forbidden.filter((name) => Object.hasOwn(templates, name))).toEqual([]);
    const records = (Object.values(templates) as unknown[]).filter(
      (value): value is Record<string, unknown> =>
        value !== null && typeof value === "object" && !Array.isArray(value),
    );
    // prettier-ignore
    expect(["contextFingerprint", "evaluationFingerprint", "requestFingerprint", "selectionFingerprint"].map((key) => records.filter((value) => Object.hasOwn(value, key)).length)).toEqual([0, 0, 0, 0]);
    expect(
      inventory.productionInactivityAssertions.every(({ expectedCount }) => expectedCount === 0),
    ).toBe(true);
    // prettier-ignore
    expect(canonicalValueString({ evaluations: authority.evaluations, selections: authority.selections })).not.toMatch(/"(?:score|rank)":/u);
  });
});
