// @vitest-environment node

import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectCompatibleCoordinatedDirectionCandidateInventory } from "@/application/bounded-storefront-synthesis";
import { createRawKarvonenStorefrontFixture } from "@/data/demo/raw-karvonen-storefront-fixture";
import { collectionCardinalityClass } from "@/components/storefront/dynamic-collection-commerce";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  compileP10b18aAuditCase,
  createP10b18aShapeAuthorities,
  p10b18aDirectionLabelFreeNormalizedDesignTopologyFingerprint,
  p10b18aMaterializerConsumedDesignAuthority,
  p10b18aMaterializerDesignAuthorityFingerprint,
  p10b18aNormalizedDesignTopologyFingerprint,
  p10b18aSemanticVariations,
  type P10b18aCompiledAuditResult,
  type P10b18aShapeAuthority,
} from "../helpers/p10b-18a-commercial-authority";

function distribution(values: readonly string[]) {
  return Object.fromEntries(
    [...new Set(values)]
      .sort((left, right) => left.localeCompare(right))
      .map((value) => [value, values.filter((candidate) => candidate === value).length]),
  );
}

function influenceModeDistribution(
  authority: ReturnType<typeof createP10b18aShapeAuthorities>[number]["semanticCapabilityIndex"],
) {
  return distribution(
    authority.semanticInfluenceAuthority.fields.flatMap(({ relationships }) =>
      relationships.map(({ mode }) => mode),
    ),
  );
}

function homepageComposition(result: P10b18aCompiledAuditResult) {
  const homepageProfileId = result.compiledDecision.profiles.homepage.profileId;
  const homepageProfile = result.synthesisDecision.pageProfileSelections.find(
    ({ profileId }) => profileId === homepageProfileId,
  );
  if (!homepageProfile) {
    return {
      availability: "unavailable-no-compiled-homepage-profile" as const,
      profileId: null,
      sectionCount: 0,
      narrativeRoleSequence: [],
      componentFamilyVariantSequence: [],
    };
  }
  const components = result.synthesisDecision.componentChoices.filter(
    ({ pageKey }) => pageKey === homepageProfile.pageKey,
  );
  return {
    availability: "available" as const,
    profileId: homepageProfile.profileId,
    sectionCount: components.length,
    narrativeRoleSequence: [...homepageProfile.narrativeRoles],
    componentFamilyVariantSequence: components.map(({ slotId, component, variant, anatomyId }) => ({
      slotId,
      componentFamily: component,
      variant,
      anatomyId,
    })),
  };
}

function dynamicArchetypeMetrics(result: P10b18aCompiledAuditResult) {
  const selection = result.synthesisDecision.dynamicCommerceSelection;
  if (!selection) {
    return {
      availability: "unavailable-no-compiled-dynamic-commerce-selection" as const,
      collection: null,
      search: null,
      simple: null,
      configurable: null,
      gallery: null,
      highConsideration: null,
      genericFallback: null,
    };
  }
  return {
    availability: "available" as const,
    collection: selection.collectionArchetypeId,
    search: selection.searchArchetypeId,
    simple: selection.standardSimpleArchetypeId,
    configurable: selection.configurableArchetypeId,
    gallery: selection.galleryLedArchetypeId,
    highConsideration: selection.highConsiderationArchetypeId,
    genericFallback: selection.genericFallbackArchetypeId,
  };
}

function approvedAssetSelectionDiagnostics(
  authority: P10b18aShapeAuthority,
  result: P10b18aCompiledAuditResult,
) {
  const availableApprovedRoles = [
    ...new Set(
      authority.compatibilityInput.planningInput.approvedAssetContext?.assets.map(
        ({ role }) => role,
      ) ?? [],
    ),
  ].sort((left, right) => left.localeCompare(right));
  const selectedPlacements = result.synthesisDecision.approvedAssetRoleSelections.map(
    ({
      profileId,
      slotId,
      component,
      assetSlotId,
      role,
      assetId,
      placementContext,
      placementPurpose,
      reusePolicy,
      affinity,
      responsiveSourceAssetIds,
    }) => ({
      profileId,
      slotId,
      component,
      assetSlotId,
      role,
      assetId,
      placementContext: placementContext ?? "page",
      placementPurpose: placementPurpose ?? "legacy",
      reusePolicy: reusePolicy ?? "legacy",
      affinity: affinity ?? "legacy",
      responsiveSourceAssetIds: responsiveSourceAssetIds ?? [],
    }),
  );
  const pairedApprovedRoles = selectedPlacements.flatMap(({ responsiveSourceAssetIds }) =>
    responsiveSourceAssetIds.flatMap((assetId) => {
      const paired = authority.compatibilityInput.planningInput.approvedAssetContext?.assets.find(
        (asset) => asset.assetId === assetId,
      );
      return paired ? [paired.role] : [];
    }),
  );
  const selectedApprovedRoles = [
    ...new Set([...selectedPlacements.map(({ role }) => role), ...pairedApprovedRoles]),
  ].sort((left, right) => left.localeCompare(right));
  const omittedApprovedRoles = availableApprovedRoles
    .filter((role) => !selectedApprovedRoles.includes(role))
    .map((role) => ({ role, reasonCode: "available-approved-role-not-selected" as const }));
  return {
    availability:
      availableApprovedRoles.length === 0
        ? ("unavailable-no-approved-presentation-assets" as const)
        : ("available" as const),
    availableApprovedRoles,
    selectedApprovedRoles,
    selectedPlacements,
    omittedApprovedRoles,
  };
}

function writeOptionalAuditOutput(report: unknown) {
  const outputPath = process.env.P10B18A_AUDIT_OUTPUT;
  if (!outputPath) return;
  if (!outputPath.startsWith("/private/tmp/")) {
    throw new Error("P10B18A_AUDIT_OUTPUT must select a file below /private/tmp.");
  }
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

describe("P10B-18A commercial authority audit", () => {
  let cachedAuthorities: ReturnType<typeof createP10b18aShapeAuthorities> | undefined;
  const shapeAuthorities = () => (cachedAuthorities ??= createP10b18aShapeAuthorities());

  it("selects each shape's largest truthful representative collection", () => {
    const authorities = shapeAuthorities();

    for (const authority of authorities) {
      const maximumMembership = Math.max(
        ...authority.catalogue.collections.map(({ productIds }) => productIds.length),
      );
      const expectedCollection = authority.catalogue.collections.find(
        ({ productIds }) => productIds.length === maximumMembership,
      );
      const selectedPage = authority.siteMapDecision.pages.find(
        ({ route }) => route === authority.representativeRoutes.collection,
      );

      expect(expectedCollection).toBeDefined();
      expect(selectedPage?.commerceContext).toEqual({
        kind: "collection",
        collectionId: expectedCollection?.id,
      });
    }

    const medium = authorities.find(({ id }) => id === "medium-mixed-jewellery");
    expect(medium?.representativeRoutes.collection).toBe("/collections/pihka");
    expect(
      medium?.catalogue.collections.find(({ id }) => id === "collection_karvonen_pihka")
        ?.productIds,
    ).toEqual(["product_karvonen_08", "product_karvonen_09"]);
  }, 300_000);

  it("compiles a deterministic 72-case catalogue-shape and semantic-intent audit matrix", () => {
    const before = canonicalValueString(
      createRawKarvonenStorefrontFixture().planningInput.catalogue,
    );
    const authorities = shapeAuthorities();
    const outcomes = authorities.flatMap((authority) =>
      p10b18aSemanticVariations.map((variation) => {
        const result = compileP10b18aAuditCase(authority, variation);
        const compiledHomepageComposition = homepageComposition(result);
        const dynamicArchetypes = dynamicArchetypeMetrics(result);
        const approvedAssetDiagnostics = approvedAssetSelectionDiagnostics(authority, result);
        const representativeCollectionProductCount = Math.max(
          ...authority.catalogue.collections.map(({ productIds }) => productIds.length),
        );
        const materializerConsumedDesignAuthority =
          p10b18aMaterializerConsumedDesignAuthority(result);
        return {
          shapeId: authority.id,
          variationId: variation.id,
          productCount: authority.catalogue.products.length,
          collectionCount: authority.catalogue.collections.length,
          representativeCollectionProductCount,
          collectionCardinalityClass: collectionCardinalityClass(
            representativeCollectionProductCount,
          ),
          fixtureKind: authority.fixtureKind,
          productTypes: [
            ...new Set(authority.catalogue.products.map(({ productType }) => productType)),
          ].sort((left, right) => left.localeCompare(right)),
          simpleProductCount: authority.request.catalogueCharacteristics.simpleProductCount,
          configurableProductCount:
            authority.request.catalogueCharacteristics.configurableProductCount,
          highConsiderationProductCount:
            authority.request.catalogueCharacteristics.highConsiderationProductCount,
          compiledDecisionFingerprint: result.compiledDecision.compiledDecisionFingerprint,
          structuralFingerprint: result.compiledDecision.structuralFingerprint,
          materializerDesignAuthorityFingerprint:
            p10b18aMaterializerDesignAuthorityFingerprint(result),
          materializerConsumedDesignAuthority,
          normalizedDesignTopologyFingerprint: p10b18aNormalizedDesignTopologyFingerprint(result),
          directionLabelFreeNormalizedDesignTopologyFingerprint:
            p10b18aDirectionLabelFreeNormalizedDesignTopologyFingerprint(result),
          direction: result.compiledDecision.designDna.directionId,
          designDnaFingerprint: canonicalValueFingerprint(result.compiledDecision.designDna.value),
          designDnaDimensions: result.compiledDecision.designDna.value,
          frame: result.compiledDecision.sharedFrame.profileId,
          homepage: result.compiledDecision.profiles.homepage.profileId,
          collection: result.compiledDecision.profiles.collection.profileId,
          search: result.synthesisDecision.commercialProfiles.searchProfileId,
          pdp: result.compiledDecision.profiles.productDetail.profileId,
          homepageComposition: compiledHomepageComposition,
          dynamicArchetypes,
          productCardAnatomies: result.compiledDecision.productCardAnatomyIds,
          declaredResponsivePosture: result.synthesisDecision.responsivePosture.mode,
          declaredArtDirectionPosture: result.synthesisDecision.artDirectionPosture,
          declaredNarrativePosture: result.synthesisDecision.narrative.posture,
          declaredDensityPosture: result.synthesisDecision.informationDensityPosture,
          declaredMerchandisingPosture: result.synthesisDecision.merchandisingPosture,
          acceptedSemanticPaths:
            result.compiledDecision.semanticResolution?.acceptedSemanticPaths ?? [],
          substitutedSemanticPaths:
            result.compiledDecision.semanticResolution?.substitutedSemanticPaths ?? [],
          candidateStages: result.resolution.diagnostic.stages,
          factorEvaluationCount: result.resolution.diagnostic.factorEvaluationCount,
          approvedAssetDiagnostics,
        };
      }),
    );

    expect(outcomes).toHaveLength(72);
    expect(authorities).toHaveLength(9);
    for (const authority of authorities) {
      expect(outcomes.filter(({ shapeId }) => shapeId === authority.id)).toHaveLength(8);
      if (authority.assertions.includes("high-consideration")) {
        expect(authority.request.catalogueCharacteristics.highConsiderationProductCount).toBe(1);
        expect(
          Math.max(
            ...authority.catalogue.products.map(({ orderOptions }) => orderOptions?.length ?? 0),
          ),
        ).toBeGreaterThanOrEqual(4);
      }
      if (authority.assertions.includes("mixed-jewellery-watch")) {
        const productTypes = authority.catalogue.products.map(({ productType }) => productType);
        expect(productTypes).toContain("watch");
        expect(productTypes.some((productType) => productType !== "watch")).toBe(true);
      }
      if (authority.assertions.includes("approved-presentation-assets")) {
        expect(authority.fixtureAuthority).toBe("p10b16p04j-aurum-approved");
        expect(authority.fixtureKind).toBe("approved-fictional-merchant");
        expect(authority.fixtureSetup).toEqual({
          sourceDraftId: "snapshot_p10b16p04_aurum_commercial_draft",
          sourceDraftKind: "p04j-raw-draft",
          fixtureBootstrapMaterializationCount: 1,
          matrixCaseMaterializationCount: 0,
        });
        expect(authority.currentRequestInput.draft.pages).toHaveLength(1);
        expect(
          authority.currentRequestInput.draft.pages[0]?.sections.map(({ component }) => component),
        ).toEqual(["header", "footer"]);
        expect(authority.request.assetAvailability.approvedRoleCount).toBe(5);
        expect(authority.request.assetAvailability.editorialOrBrandImageryAvailable).toBe(true);
        expect(authority.approvedAssetPresentations.map(({ role }) => role).sort()).toEqual([
          "collectionImage",
          "editorialImage",
          "editorialImage",
          "heroDesktop",
          "heroMobile",
          "logo",
        ]);
        expect(authority.approvedEvidenceFingerprint).toBeTruthy();
        expect(authority.approvedAssetContextFingerprint).toBeTruthy();
        expect(authority.approvedAssetPresentationFingerprint).toBeTruthy();
      }
    }
    expect(
      outcomes.every(({ materializerDesignAuthorityFingerprint }) =>
        materializerDesignAuthorityFingerprint.startsWith("p10b18a-materializer-design-authority-"),
      ),
    ).toBe(true);
    for (const outcome of outcomes) {
      expect(outcome.directionLabelFreeNormalizedDesignTopologyFingerprint).toMatch(
        /^p10b18a-direction-label-free-design-topology-/,
      );
      expect(outcome.homepageComposition.availability).toBe("available");
      expect(outcome.homepageComposition.sectionCount).toBeGreaterThan(0);
      expect(outcome.homepageComposition.narrativeRoleSequence).toHaveLength(
        outcome.homepageComposition.sectionCount,
      );
      expect(outcome.homepageComposition.componentFamilyVariantSequence).toHaveLength(
        outcome.homepageComposition.sectionCount,
      );
      expect(outcome.dynamicArchetypes.availability).toBe("available");
      const {
        colour: _protectedColour,
        version: _version,
        ...expectedNonColourDesignDna
      } = outcome.designDnaDimensions;
      void _protectedColour;
      void _version;
      expect(outcome.materializerConsumedDesignAuthority.designDnaCategories).toEqual(
        expectedNonColourDesignDna,
      );
      for (const archetypeId of [
        outcome.dynamicArchetypes.collection,
        outcome.dynamicArchetypes.search,
        outcome.dynamicArchetypes.simple,
        outcome.dynamicArchetypes.configurable,
        outcome.dynamicArchetypes.gallery,
        outcome.dynamicArchetypes.highConsideration,
        outcome.dynamicArchetypes.genericFallback,
      ]) {
        expect(archetypeId).toEqual(expect.any(String));
      }
      expect(
        outcome.approvedAssetDiagnostics.selectedApprovedRoles.every((role) =>
          outcome.approvedAssetDiagnostics.availableApprovedRoles.includes(role),
        ),
      ).toBe(true);
      expect(
        outcome.approvedAssetDiagnostics.selectedApprovedRoles.length +
          outcome.approvedAssetDiagnostics.omittedApprovedRoles.length,
      ).toBe(outcome.approvedAssetDiagnostics.availableApprovedRoles.length);
    }
    expect(canonicalValueString(createRawKarvonenStorefrontFixture().planningInput.catalogue)).toBe(
      before,
    );

    const stratumDistributions = authorities.flatMap((authority) =>
      [
        ...new Set(
          outcomes
            .filter(({ shapeId }) => shapeId === authority.id)
            .map(({ direction }) => direction),
        ),
      ]
        .sort((left, right) => left.localeCompare(right))
        .map((direction) => {
          const cases = outcomes.filter(
            ({ shapeId, direction: selectedDirection }) =>
              shapeId === authority.id && selectedDirection === direction,
          );
          return {
            shapeId: authority.id,
            direction,
            caseCount: cases.length,
            materializerDesignAuthorityCount: new Set(
              cases.map(
                ({ materializerDesignAuthorityFingerprint }) =>
                  materializerDesignAuthorityFingerprint,
              ),
            ).size,
            normalizedDesignTopologyCount: new Set(
              cases.map(
                ({ normalizedDesignTopologyFingerprint }) => normalizedDesignTopologyFingerprint,
              ),
            ).size,
            directionLabelFreeNormalizedDesignTopologyCount: new Set(
              cases.map(
                ({ directionLabelFreeNormalizedDesignTopologyFingerprint }) =>
                  directionLabelFreeNormalizedDesignTopologyFingerprint,
              ),
            ).size,
            compiledDecisionCount: new Set(
              cases.map(({ compiledDecisionFingerprint }) => compiledDecisionFingerprint),
            ).size,
            structuralFingerprintCount: new Set(
              cases.map(({ structuralFingerprint }) => structuralFingerprint),
            ).size,
          };
        }),
    );
    const collapseWitnesses = outcomes
      .map(({ shapeId, normalizedDesignTopologyFingerprint }) => ({
        shapeId,
        normalizedDesignTopologyFingerprint,
      }))
      .filter(
        (key, index, keys) =>
          keys.findIndex(
            (candidate) =>
              candidate.shapeId === key.shapeId &&
              candidate.normalizedDesignTopologyFingerprint ===
                key.normalizedDesignTopologyFingerprint,
          ) === index,
      )
      .map(({ shapeId, normalizedDesignTopologyFingerprint }) => {
        const cases = outcomes.filter(
          (outcome) =>
            outcome.shapeId === shapeId &&
            outcome.normalizedDesignTopologyFingerprint === normalizedDesignTopologyFingerprint,
        );
        return {
          shapeId,
          normalizedDesignTopologyFingerprint,
          variationIds: cases.map(({ variationId }) => variationId),
          compiledDecisionFingerprints: [
            ...new Set(cases.map(({ compiledDecisionFingerprint }) => compiledDecisionFingerprint)),
          ],
          structuralFingerprints: [
            ...new Set(cases.map(({ structuralFingerprint }) => structuralFingerprint)),
          ],
          declaredResponsivePostures: [
            ...new Set(cases.map(({ declaredResponsivePosture }) => declaredResponsivePosture)),
          ],
          declaredArtDirectionPostures: [
            ...new Set(cases.map(({ declaredArtDirectionPosture }) => declaredArtDirectionPosture)),
          ],
          declaredNarrativePostures: [
            ...new Set(cases.map(({ declaredNarrativePosture }) => declaredNarrativePosture)),
          ],
        };
      })
      .filter(
        ({ variationIds, compiledDecisionFingerprints, structuralFingerprints }) =>
          variationIds.length > 1 &&
          (compiledDecisionFingerprints.length > 1 || structuralFingerprints.length > 1),
      );

    const directionLabelFreeTopologyClasses = [
      ...new Set(
        outcomes.map(
          ({ directionLabelFreeNormalizedDesignTopologyFingerprint }) =>
            directionLabelFreeNormalizedDesignTopologyFingerprint,
        ),
      ),
    ]
      .sort((left, right) => left.localeCompare(right))
      .map((directionLabelFreeNormalizedDesignTopologyFingerprint) => {
        const cases = outcomes.filter(
          (outcome) =>
            outcome.directionLabelFreeNormalizedDesignTopologyFingerprint ===
            directionLabelFreeNormalizedDesignTopologyFingerprint,
        );
        return {
          directionLabelFreeNormalizedDesignTopologyFingerprint,
          caseCount: cases.length,
          directions: [...new Set(cases.map(({ direction }) => direction))].sort((left, right) =>
            left.localeCompare(right),
          ),
          shapeIds: [...new Set(cases.map(({ shapeId }) => shapeId))].sort((left, right) =>
            left.localeCompare(right),
          ),
          variationIds: [...new Set(cases.map(({ variationId }) => variationId))].sort(
            (left, right) => left.localeCompare(right),
          ),
        };
      });
    const directionOverlapWitnesses = directionLabelFreeTopologyClasses.filter(
      ({ directions }) => directions.length > 1,
    );
    const compatibilityFunnels = authorities.map((authority) => ({
      shapeId: authority.id,
      ...inspectCompatibleCoordinatedDirectionCandidateInventory(authority.compatibilityInput),
      finalFrameDistribution: distribution(
        authority.semanticCapabilityIndex.candidates.map(
          ({ selection }) => selection.sharedFrameProfileId,
        ),
      ),
    }));

    const report = {
      contract: {
        caseCount: outcomes.length,
        shapeCount: authorities.length,
        semanticVariationCount: p10b18aSemanticVariations.length,
        materializerConsumedDesignAuthorityFields: [
          "directionId",
          "exact non-colour Design DNA categories after compiled/synthesis fingerprint equality",
          "designSystemNarrowing.spacingDensity",
          "designSystemNarrowing.surfaceDepth",
          "sharedFrameProfileId",
          "includedPageKeys",
          "pageProfiles.{pageKey,familyId,profileId,profileVersion}",
          "pageBlueprintSelectionOverrides",
          "approvedAssetRoleSelections with exact placement purpose, reuse, affinity and responsive pairing; without authorityFingerprint",
          "dynamicCommerceSelection without authorityFingerprint",
        ],
        normalizedDesignTopologyFields: [
          "directionId and non-colour Design DNA categories",
          "sharedFrameProfileId",
          "unique page family/profile/version sequence",
          "unique family/slot/component/variant/anatomy sequence",
          "bounded layout parameters",
          "approved asset placement purpose/reuse/affinity/pairing modes without asset identity",
          "dynamic archetype roles without product-type identity",
          "responsive consumer marked unavailable (declared posture reported separately)",
        ],
        directionLabelFreeNormalizedDesignTopologyFields: [
          "all normalizedDesignTopology fields except directionId",
          "non-colour Design DNA categories remain included as rendered design authority",
        ],
        compatibilityFunnelStages: [
          "registered-direction-tuples",
          "approved-asset-posture",
          "profile-design-dna",
          "dynamic-commerce-profile-context",
          "page-set-shared-frame",
        ],
        descriptiveMetrics: {
          orderedHomepageComposition: "available-from-exact-synthesis-decision",
          dynamicArchetypes: "available-from-exact-dynamic-commerce-selection",
          responsivePosture: "declared-only-materializer-consumer-unavailable",
          artDirectionPosture:
            "material when selected approved presentation assets reach responsive art-direction execution; otherwise unavailable",
          approvedAssetOmissionReason:
            "limited-to-available-approved-role-not-selected-without-inferred-causality",
        },
        excludedFalseVarietyFields: [
          "narrative.posture",
          "merchandisingPosture",
          "informationDensityPosture",
          "artDirectionPosture",
          "responsivePosture",
          "diagnostic/decision/authority fingerprints",
          "copy/colour/merchant/catalogue/route/generated identities",
        ],
        materializationAccounting: {
          fixtureBootstrap: {
            authority: "cached P10B-16P-04J raw Aurum authority bootstrap",
            maximumPerProcess: 1,
            purpose: "derive dynamic-commerce authority for the raw draft",
            sampledAuditStore: false,
          },
          matrixCompileCases: {
            caseCount: outcomes.length,
            completeStorefrontMaterializationCount: 0,
          },
          representativeBrowserStores: {
            plannedStoreCount: 18,
            materializationsPerSelectedStore: 1,
          },
        },
      },
      shapes: authorities.map((authority) => ({
        shapeId: authority.id,
        fixtureAuthority: authority.fixtureAuthority,
        fixtureKind: authority.fixtureKind,
        fixtureSetup: authority.fixtureSetup,
        merchantPrompt: authority.currentRequestInput.merchantPrompt,
        productCount: authority.catalogue.products.length,
        collectionCount: authority.catalogue.collections.length,
        productTypes: [
          ...new Set(authority.catalogue.products.map(({ productType }) => productType)),
        ].sort((left, right) => left.localeCompare(right)),
        catalogueCharacteristics: authority.request.catalogueCharacteristics,
        approvedPresentationAssetRoleCount: authority.request.assetAvailability.approvedRoleCount,
        editorialOrBrandImageryAvailable:
          authority.request.assetAvailability.editorialOrBrandImageryAvailable,
        semanticInfluenceModes: influenceModeDistribution(authority.semanticCapabilityIndex),
        representativeRoutes: authority.representativeRoutes,
        approvedEvidenceFingerprint: authority.approvedEvidenceFingerprint,
        approvedAssetContextFingerprint: authority.approvedAssetContextFingerprint,
        approvedAssetPresentationFingerprint: authority.approvedAssetPresentationFingerprint,
        catalogueFingerprint: authority.catalogueFingerprint,
        commerceFingerprint: authority.commerceFingerprint,
        mediaFingerprint: authority.mediaFingerprint,
      })),
      distributions: {
        materializerDesignAuthority: distribution(
          outcomes.map(
            ({ materializerDesignAuthorityFingerprint }) => materializerDesignAuthorityFingerprint,
          ),
        ),
        normalizedDesignTopology: distribution(
          outcomes.map(
            ({ normalizedDesignTopologyFingerprint }) => normalizedDesignTopologyFingerprint,
          ),
        ),
        directionLabelFreeNormalizedDesignTopology: distribution(
          outcomes.map(
            ({ directionLabelFreeNormalizedDesignTopologyFingerprint }) =>
              directionLabelFreeNormalizedDesignTopologyFingerprint,
          ),
        ),
        compiledDecision: distribution(
          outcomes.map(({ compiledDecisionFingerprint }) => compiledDecisionFingerprint),
        ),
        structural: distribution(
          outcomes.map(({ structuralFingerprint }) => structuralFingerprint),
        ),
        direction: distribution(outcomes.map(({ direction }) => direction)),
        designDna: distribution(outcomes.map(({ designDnaFingerprint }) => designDnaFingerprint)),
        frame: distribution(outcomes.map(({ frame }) => frame)),
        homepage: distribution(outcomes.map(({ homepage }) => homepage)),
        homepageSectionCount: distribution(
          outcomes.map(({ homepageComposition: { sectionCount } }) => String(sectionCount)),
        ),
        homepageNarrativeRoleSequence: distribution(
          outcomes.map(({ homepageComposition: { narrativeRoleSequence } }) =>
            canonicalValueString(narrativeRoleSequence),
          ),
        ),
        homepageComponentFamilyVariantSequence: distribution(
          outcomes.map(({ homepageComposition: { componentFamilyVariantSequence } }) =>
            canonicalValueString(componentFamilyVariantSequence),
          ),
        ),
        collection: distribution(outcomes.map(({ collection }) => collection)),
        collectionCardinalityClass: distribution(
          outcomes.map(({ collectionCardinalityClass }) => collectionCardinalityClass),
        ),
        search: distribution(outcomes.map(({ search }) => search)),
        pdp: distribution(outcomes.map(({ pdp }) => pdp)),
        dynamicCollectionArchetype: distribution(
          outcomes.map(({ dynamicArchetypes }) => dynamicArchetypes.collection ?? "unavailable"),
        ),
        dynamicSearchArchetype: distribution(
          outcomes.map(({ dynamicArchetypes }) => dynamicArchetypes.search ?? "unavailable"),
        ),
        dynamicSimplePdpArchetype: distribution(
          outcomes.map(({ dynamicArchetypes }) => dynamicArchetypes.simple ?? "unavailable"),
        ),
        dynamicConfigurablePdpArchetype: distribution(
          outcomes.map(({ dynamicArchetypes }) => dynamicArchetypes.configurable ?? "unavailable"),
        ),
        dynamicGalleryPdpArchetype: distribution(
          outcomes.map(({ dynamicArchetypes }) => dynamicArchetypes.gallery ?? "unavailable"),
        ),
        dynamicHighConsiderationPdpArchetype: distribution(
          outcomes.map(
            ({ dynamicArchetypes }) => dynamicArchetypes.highConsideration ?? "unavailable",
          ),
        ),
        declaredResponsivePosture: distribution(
          outcomes.map(({ declaredResponsivePosture }) => declaredResponsivePosture),
        ),
        declaredArtDirectionPosture: distribution(
          outcomes.map(({ declaredArtDirectionPosture }) => declaredArtDirectionPosture),
        ),
        approvedAssetAvailability: distribution(
          outcomes.map(({ approvedAssetDiagnostics }) => approvedAssetDiagnostics.availability),
        ),
        approvedAssetSelectedRole: distribution(
          outcomes.flatMap(
            ({ approvedAssetDiagnostics }) => approvedAssetDiagnostics.selectedApprovedRoles,
          ),
        ),
        approvedAssetOmittedRole: distribution(
          outcomes.flatMap(({ approvedAssetDiagnostics }) =>
            approvedAssetDiagnostics.omittedApprovedRoles.map(({ role }) => role),
          ),
        ),
        productCardAnatomy: distribution(
          outcomes.flatMap(({ productCardAnatomies }) => productCardAnatomies),
        ),
      },
      stratumDistributions,
      compatibilityFunnels,
      directionLabelFreeTopologyClasses,
      directionOverlapWitnesses,
      collapseWitnesses,
      outcomes,
    };

    expect(
      Object.values(report.distributions.search).reduce((total, count) => total + count, 0),
    ).toBe(72);
    expect(
      Object.values(report.distributions.homepageSectionCount).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(72);
    expect(
      Object.values(report.distributions.directionLabelFreeNormalizedDesignTopology).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(72);
    expect(report.directionLabelFreeTopologyClasses).toHaveLength(
      new Set(
        outcomes.map(
          ({ directionLabelFreeNormalizedDesignTopologyFingerprint }) =>
            directionLabelFreeNormalizedDesignTopologyFingerprint,
        ),
      ).size,
    );
    expect(report.compatibilityFunnels.map(({ shapeId }) => shapeId)).toEqual([
      "neutral-true-high-consideration",
      "mixed-jewellery-watch",
      "simple-product-heavy-small",
      "configurable-product-heavy-medium",
      "canonical-product-media-rich-presentation-asset-poor",
      "image-evidence-poor",
      "small-catalogue",
      "medium-mixed-jewellery",
      "aurum-approved-presentation-image-rich",
    ]);
    for (const funnel of report.compatibilityFunnels) {
      expect(funnel.stages.map(({ stage }) => stage)).toEqual(
        report.contract.compatibilityFunnelStages,
      );
      expect(funnel.initialCandidateCount).toBe(funnel.stages[0]?.enteringCandidateCount);
      expect(funnel.finalCandidateCount).toBe(funnel.stages.at(-1)?.remainingCandidateCount);
      expect(funnel.firstEmptyStage).toBeNull();
      expect(
        Object.values(funnel.finalFrameDistribution).reduce((total, count) => total + count, 0),
      ).toBe(funnel.finalCandidateCount);
      expect(funnel.finalFrameDistribution["compact-technical"]).toBeGreaterThan(0);
    }
    expect(
      report.outcomes.every(
        ({ homepageComposition: composition, dynamicArchetypes, approvedAssetDiagnostics }) =>
          composition.narrativeRoleSequence.length === composition.sectionCount &&
          composition.componentFamilyVariantSequence.length === composition.sectionCount &&
          dynamicArchetypes.availability === "available" &&
          approvedAssetDiagnostics.availableApprovedRoles.length ===
            approvedAssetDiagnostics.selectedApprovedRoles.length +
              approvedAssetDiagnostics.omittedApprovedRoles.length,
      ),
    ).toBe(true);

    writeOptionalAuditOutput(report);
  }, 900_000);
});
