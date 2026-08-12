import { describe, expect, it } from "vitest";
import {
  listCompatibleCoordinatedDirectionSelectionNarrowings,
  type CompatibleCoordinatedDirectionNarrowingInput,
} from "@/application/bounded-storefront-synthesis";
import { compilePromptedStorefrontDesignIntentV2 } from "@/application/prompted-storefront-design-compiler";
import {
  createPromptedStorefrontDesignRequestV2,
  promptedStorefrontDesignIntentFingerprint,
  promptedStorefrontDesignIntentV2Schema,
  type CreatePromptedStorefrontDesignRequestV2Input,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCapabilityAuthorityReference,
  type PromptedStorefrontCapabilityEntry,
  type PromptedStorefrontDesignIntentV2,
} from "@/application/prompted-storefront-design-intent";
import { migrateLegacyDynamicCommerceRoutes } from "@/application/dynamic-commerce-routes";
import { getCommercialHomepageProfile } from "@/application/storefront-templates";
import {
  createApprovedGenerationAssetContextFingerprint,
  type ApprovedGenerationAssetContext,
} from "@/application/ai-storefront-generation";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { createDynamicCommercePresentationAuthority } from "@/domain/storefront";

type Preference = PromptedStorefrontDesignIntentV2["designDna"]["preferences"][number];

function compilerFixture() {
  const source = createP10B14PremiumEditorialFixture();
  const migrated = migrateLegacyDynamicCommerceRoutes(
    source.slice.snapshot,
    source.fixture.planningInput.catalogue,
  );
  if (migrated.status === "requires-decision") {
    throw new Error("Dynamic-commerce test fixture requires a migration decision.");
  }
  const draft = migrated.snapshot;
  const currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input = {
    merchantPrompt: "Build a warm editorial storefront with clear product discovery.",
    project: source.fixture.aggregate.project,
    draft,
    catalogue: source.fixture.planningInput.catalogue,
    approvedBrief: source.fixture.brief,
    approvedAssetContext: source.fixture.assetContext,
  };
  const compatibilityInput: CompatibleCoordinatedDirectionNarrowingInput = {
    planningInput: { ...source.fixture.planningInput, draft },
    siteMapDecision: source.siteMapDecision,
    approvedEvidenceReferences: source.approvedEvidenceReferences,
  };
  const requestAuthority = createPromptedStorefrontDesignRequestV2(currentRequestInput);
  const seed = listCompatibleCoordinatedDirectionSelectionNarrowings(compatibilityInput)[0];
  if (!seed) throw new Error("Missing compatible compiler fixture narrowing.");
  return { source, currentRequestInput, compatibilityInput, requestAuthority, seed };
}

function compilerFixtureWithAlternateSearchPresentation() {
  const fixture = compilerFixture();
  const current = fixture.currentRequestInput.draft.dynamicCommercePresentation;
  if (!current) throw new Error("Missing dynamic-commerce fixture authority.");
  const currentSearch = current.collectionSearchArchetypes.find(
    ({ id }) => id === current.searchArchetypeId,
  );
  if (!currentSearch) throw new Error("Missing current search presentation archetype.");
  const { authorityFingerprint: _authorityFingerprint, ...material } = current;
  void _authorityFingerprint;
  const dynamicCommercePresentation = createDynamicCommercePresentationAuthority({
    ...material,
    collectionSearchArchetypes: [
      ...material.collectionSearchArchetypes,
      { ...currentSearch, id: `${currentSearch.id}-alternative` },
    ],
  });
  const draft = {
    ...fixture.currentRequestInput.draft,
    dynamicCommercePresentation,
  };
  const currentRequestInput = { ...fixture.currentRequestInput, draft };
  const compatibilityInput = {
    ...fixture.compatibilityInput,
    planningInput: { ...fixture.compatibilityInput.planningInput, draft },
  };
  const requestAuthority = createPromptedStorefrontDesignRequestV2(currentRequestInput);
  const seed = listCompatibleCoordinatedDirectionSelectionNarrowings(compatibilityInput)[0];
  if (!seed) throw new Error("Missing alternate-search compatible narrowing.");
  return { ...fixture, currentRequestInput, compatibilityInput, requestAuthority, seed };
}

function preference(
  entry: PromptedStorefrontCapabilityEntry,
  semantics: Preference["semantics"] = "soft",
  rank = 1,
): Preference {
  return {
    key: entry.key,
    dimension: entry.dimension,
    semantics,
    rank: semantics === "soft" ? rank : null,
  };
}

function entryByReference(
  authority: PromptedStorefrontCapabilityAuthority,
  predicate: (reference: PromptedStorefrontCapabilityAuthorityReference | undefined) => boolean,
  dimension?: PromptedStorefrontCapabilityEntry["dimension"],
) {
  const entry = authority.projection.capabilities.find((candidate) => {
    const reference = authority.referencesByPreferenceKey.get(candidate.key);
    return (
      candidate.availability === "available" &&
      (dimension === undefined || candidate.dimension === dimension) &&
      predicate(reference)
    );
  });
  if (!entry) throw new Error(`Missing capability ${dimension ?? "by reference"}.`);
  return entry;
}

function available(
  authority: PromptedStorefrontCapabilityAuthority,
  dimension: PromptedStorefrontCapabilityEntry["dimension"],
) {
  const entry = authority.projection.capabilities.find(
    (candidate) => candidate.dimension === dimension && candidate.availability === "available",
  );
  if (!entry) throw new Error(`Missing available ${dimension}.`);
  return entry;
}

function providerIntent(fixture: ReturnType<typeof compilerFixture>) {
  const { capabilityAuthority: authority, request } = fixture.requestAuthority;
  const frame = entryByReference(
    authority,
    (reference) => reference?.authorityId === fixture.seed.sharedFrameProfileId,
    "shared-frame.profile",
  );
  const homepage = entryByReference(
    authority,
    (reference) =>
      reference?.authorityKind === "page-blueprint" &&
      reference.authorityId.startsWith(`${fixture.seed.homepageProfileId}@`),
    "homepage.profile",
  );
  const collection = entryByReference(
    authority,
    (reference) =>
      reference?.authorityKind === "page-blueprint" &&
      reference.authorityId.startsWith(`${fixture.seed.collectionProfileId}@`),
    "collection-search.archetype",
  );
  const plan = getCommercialHomepageProfile(fixture.seed.homepageProfileId);
  const profile = plan?.profile;
  const firstSlot = plan?.slots[0];
  if (!profile || !firstSlot) throw new Error("Missing selected homepage profile.");
  const role = entryByReference(
    authority,
    (reference) =>
      reference?.authorityKind === "page-blueprint" &&
      reference.authorityId === `${profile.id}@${profile.version}:${firstSlot.id}`,
    "homepage.narrative-role",
  );
  const dna = available(authority, "design-dna.typography-pairing");
  const pdp = (
    intentRole: NonNullable<PromptedStorefrontCapabilityAuthorityReference["intentRoles"]>[number],
  ) =>
    entryByReference(
      authority,
      (reference) => reference?.intentRoles?.includes(intentRole) === true,
      "pdp.archetype",
    );
  const standard = pdp("pdp-standard-simple");
  const configurable = pdp("pdp-configurable");
  const gallery = pdp("pdp-gallery-led");
  const high = pdp("pdp-high-consideration");
  const fallback = pdp("pdp-generic-fallback");
  const search = authority.projection.capabilities.find(
    ({ dimension }) => dimension === "collection-search.search-relationship",
  );
  const sectionCount = authority.projection.capabilities.find(
    ({ key }) => key === `homepage.section-count.${fixture.seed.homepageProfileId}`,
  );
  if (!search || !sectionCount || sectionCount.selection.kind !== "number") {
    throw new Error("Missing exact homepage or search capability.");
  }
  const productType = available(authority, "pdp.product-type");
  const material = {
    contractVersion: "2.0.0" as const,
    requestFingerprint: request.requestFingerprint,
    promptFingerprint: request.promptFingerprint,
    concept: {
      summary: "A warm editorial storefront with clear commerce hierarchy.",
      commercialPosture: "Considered and product-led",
      intendedCustomerExperience: "Move from narrative discovery into confident purchase.",
    },
    constraints: {
      hard: [preference(frame, "hard")],
      soft: [preference(dna)],
      optional: [],
      avoid: [],
    },
    designDna: { preferences: [preference(dna)] },
    sharedFrame: { preferences: [preference(frame, "hard")] },
    homepage: {
      profilePreferences: [preference(homepage)],
      narrativeRoleSequence: [{ key: role.key, dimension: role.dimension }],
      requiredRoles: [{ key: role.key, dimension: role.dimension }],
      preferredRoles: [{ key: role.key, dimension: role.dimension }],
      optionalRoles: [],
      avoidedRoles: [],
      componentFamilyPreferences: [preference(available(authority, "homepage.component-family"))],
      meaningfulVariantPreferences: [],
      sectionCount: {
        key: sectionCount.key,
        dimension: "homepage.section-count" as const,
        minimum: sectionCount.selection.minimum,
        ideal: sectionCount.selection.minimum,
        maximum: sectionCount.selection.maximum,
      },
      sectionRhythmPreferences: [preference(available(authority, "homepage.section-rhythm"))],
      evidenceDependentOmission: "omit" as const,
      approvedAssetRolePreferences: [],
    },
    collectionSearch: {
      archetypePreferences: [preference(collection)],
      discoveryPreferences: [preference(available(authority, "collection-search.discovery"))],
      densityPreferences: [preference(available(authority, "collection-search.density"))],
      filterSortPreferences: [preference(available(authority, "collection-search.filter-sort"))],
      childCollectionPreferences: [
        preference(available(authority, "collection-search.child-collection")),
      ],
      merchandisingPreferences: [
        preference(available(authority, "collection-search.merchandising")),
      ],
      productCardPreferences: [preference(available(authority, "collection-search.product-card"))],
      searchRelationshipPreferences: [],
      searchExecutionExpectation: "registered-presentation-fail-closed-runtime" as const,
    },
    productDetail: {
      standardSimplePreferences: [preference(standard)],
      configurablePreferences: [preference(configurable)],
      galleryLedPreferences: [preference(gallery)],
      highConsiderationPreferences: [preference(high)],
      genericFallbackPreferences: [preference(fallback)],
      productTypeIntentions: [
        { productTypeKey: productType.key, preferences: [preference(standard)] },
      ],
      optionComplexityPreferences: [preference(available(authority, "pdp.option-complexity"))],
      mediaPreferences: [preference(available(authority, "pdp.media"))],
      purchaseDecisionHierarchyPreferences: [
        preference(available(authority, "pdp.purchase-hierarchy")),
      ],
      relatedMerchandisingPreferences: [
        preference(available(authority, "pdp.related-merchandising")),
      ],
      productCardPreferences: [preference(available(authority, "pdp.product-card"))],
    },
    contentSupport: {
      pageFamilyPreferences: [],
      narrativePurposePreferences: [],
      evidenceRequirements: [],
      safeOmissionBehavior: "omit" as const,
    },
    components: {
      familyPreferences: [preference(available(authority, "component.family"))],
      meaningfulVariantPreferences: [
        preference(available(authority, "component.meaningful-variant")),
      ],
      boundedParameterPreferences: [],
    },
    responsiveArtDirection: {
      responsivePosturePreferences: [preference(available(authority, "responsive.posture"))],
      mobileHierarchyPreferences: [preference(available(authority, "responsive.mobile-hierarchy"))],
      densityTransformationPreferences: [preference(available(authority, "responsive.density"))],
      desktopNarrativePriority: [{ key: role.key, dimension: role.dimension }],
      mobileNarrativePriority: [{ key: role.key, dimension: role.dimension }],
      imagePosturePreferences: [preference(available(authority, "responsive.image"))],
      cropFocalPreferences: [preference(available(authority, "responsive.crop"))],
      overlayPreferences: [preference(available(authority, "responsive.overlay"))],
      approvedMediaRolePreferences: [],
    },
  };
  return promptedStorefrontDesignIntentV2Schema.parse({
    ...material,
    intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
  });
}

function reboundIntent(
  intent: PromptedStorefrontDesignIntentV2,
  request: ReturnType<typeof createPromptedStorefrontDesignRequestV2>["request"],
) {
  const { intentFingerprint: _fingerprint, ...material } = structuredClone(intent);
  void _fingerprint;
  const rebound = {
    ...material,
    requestFingerprint: request.requestFingerprint,
    promptFingerprint: request.promptFingerprint,
  };
  return promptedStorefrontDesignIntentV2Schema.parse({
    ...rebound,
    intentFingerprint: promptedStorefrontDesignIntentFingerprint(rebound),
  });
}

function withFingerprint(context: Omit<ApprovedGenerationAssetContext, "fingerprint">) {
  return {
    ...context,
    fingerprint: createApprovedGenerationAssetContextFingerprint(context),
  };
}

describe("P10B-16P-02B structural diversity candidate selection", () => {
  it("substitutes an exact prior top structure and retains a machine-readable diagnostic", () => {
    const fixture = compilerFixture();
    const intent = providerIntent(fixture);
    const baseline = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input = {
      ...fixture.currentRequestInput,
      priorDiversityEvidence: {
        recentAcceptedStructuralFingerprints: [baseline.structuralFingerprint],
        recentRejectedStructuralFingerprints: [],
        recentlyUsedPostureKeys: [],
        merchantAvoidancePreferenceKeys: [],
      },
    };
    const current = createPromptedStorefrontDesignRequestV2(currentRequestInput);
    const currentIntent = reboundIntent(intent, current.request);
    const compile = () =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: current.request,
        providerIntent: currentIntent,
        currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      });

    const alternative = compile();
    expect(compile()).toEqual(alternative);
    expect(alternative.structuralFingerprint).not.toBe(baseline.structuralFingerprint);
    expect(alternative.diagnostics).toContainEqual({
      preferencePath: "priorDiversityEvidence.recentAcceptedStructuralFingerprints[0]",
      preferenceKey: baseline.structuralFingerprint,
      semantics: "optional",
      requestedRank: null,
      requestedValue: null,
      outcome: "substituted",
      selectedAuthority: null,
      reasonCode: "recent-structural-repeat-substituted",
      authorityFingerprint: baseline.structuralFingerprint,
    });
  }, 60_000);

  it("keeps explicit and concrete approved asset identity out of structural diversity", () => {
    const fixture = compilerFixture();
    const authority = fixture.requestAuthority.capabilityAuthority;
    const baseIntent = providerIntent(fixture);
    const homepage = entryByReference(
      authority,
      (reference) =>
        reference?.authorityKind === "page-blueprint" &&
        reference.authorityId.startsWith("homepage-editorial-storytelling@"),
      "homepage.profile",
    );
    const assetRole = entryByReference(
      authority,
      (reference) =>
        reference?.key ===
        "homepage.asset-role.homepage-editorial-storytelling.hero.heroMedia.heroDesktop",
      "homepage.asset-role",
    );
    const buildIntent = (
      currentAuthority: PromptedStorefrontCapabilityAuthority,
      currentBaseIntent: PromptedStorefrontDesignIntentV2,
      includeAsset: boolean,
    ) => {
      const currentHomepage = entryByReference(
        currentAuthority,
        (reference) =>
          reference?.authorityKind === "page-blueprint" &&
          reference.authorityId.startsWith("homepage-editorial-storytelling@"),
        "homepage.profile",
      );
      const currentAssetRole = entryByReference(
        currentAuthority,
        (reference) =>
          reference?.key ===
          "homepage.asset-role.homepage-editorial-storytelling.hero.heroMedia.heroDesktop",
        "homepage.asset-role",
      );
      const { intentFingerprint: _fingerprint, ...material } = structuredClone(currentBaseIntent);
      void _fingerprint;
      material.homepage.profilePreferences = [preference(currentHomepage, "hard")];
      material.homepage.meaningfulVariantPreferences = [];
      material.homepage.approvedAssetRolePreferences = includeAsset
        ? [preference(currentAssetRole, "hard")]
        : [];
      material.components.meaningfulVariantPreferences = [];
      return promptedStorefrontDesignIntentV2Schema.parse({
        ...material,
        intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
      });
    };
    expect(homepage.key).toBeDefined();
    expect(assetRole.key).toBeDefined();
    const withoutPlacement = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: buildIntent(authority, baseIntent, false),
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const withPlacement = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: buildIntent(authority, baseIntent, true),
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    expect(withPlacement.exactSelection).toEqual(withoutPlacement.exactSelection);
    expect(withPlacement.structuralFingerprint).toBe(withoutPlacement.structuralFingerprint);
    expect(withPlacement.compiledDecisionFingerprint).not.toBe(
      withoutPlacement.compiledDecisionFingerprint,
    );

    const context = fixture.currentRequestInput.approvedAssetContext;
    if (!context) throw new Error("Missing approved asset context.");
    const { fingerprint: _contextFingerprint, ...contextMaterial } = structuredClone(context);
    void _contextFingerprint;
    const replacedAsset = contextMaterial.assets.find((asset) => asset.role === "heroDesktop");
    if (!replacedAsset) throw new Error("Missing approved hero desktop asset.");
    const replacementAssetId = `${replacedAsset.assetId}_replacement`;
    const replacementRevision = `${replacedAsset.revision}:replacement`;
    const replacementMaterialFingerprint = `${replacedAsset.materialFingerprint}-replacement`;
    const replacementContext = withFingerprint({
      ...contextMaterial,
      assets: contextMaterial.assets.map((asset) =>
        asset.role === "heroDesktop"
          ? {
              ...asset,
              assetId: replacementAssetId,
              revision: replacementRevision,
              materialFingerprint: replacementMaterialFingerprint,
            }
          : asset,
      ),
    });
    const replacementBrief = {
      ...fixture.currentRequestInput.approvedBrief,
      approvedReusableAssetIds:
        fixture.currentRequestInput.approvedBrief.approvedReusableAssetIds.map((assetId) =>
          assetId === replacedAsset.assetId ? replacementAssetId : assetId,
        ),
      approvedAssetAssignments:
        fixture.currentRequestInput.approvedBrief.approvedAssetAssignments.map((assignment) =>
          assignment.assetId === replacedAsset.assetId
            ? {
                ...assignment,
                assetId: replacementAssetId,
                revision: replacementRevision,
                fingerprint: replacementMaterialFingerprint,
              }
            : assignment,
        ),
    };
    const replacementRequestInput: CreatePromptedStorefrontDesignRequestV2Input = {
      ...fixture.currentRequestInput,
      approvedBrief: replacementBrief,
      approvedAssetContext: replacementContext,
    };
    const replacementCompatibilityInput = {
      ...fixture.compatibilityInput,
      planningInput: {
        ...fixture.compatibilityInput.planningInput,
        brief: replacementBrief,
        approvedAssetContext: replacementContext,
      },
    };
    const replacement = createPromptedStorefrontDesignRequestV2(replacementRequestInput);
    const replacementFixture: ReturnType<typeof compilerFixture> = {
      ...fixture,
      currentRequestInput: replacementRequestInput,
      compatibilityInput: replacementCompatibilityInput,
      requestAuthority: replacement,
    };
    const replacementIntent = buildIntent(
      replacement.capabilityAuthority,
      providerIntent(replacementFixture),
      true,
    );
    const replacementDecision = compilePromptedStorefrontDesignIntentV2({
      originalRequest: replacement.request,
      providerIntent: replacementIntent,
      currentRequestInput: replacementRequestInput,
      compatibilityInput: replacementCompatibilityInput,
    });
    expect(replacementDecision.approvedAssetRoleSelections[0]?.assetId).not.toBe(
      withPlacement.approvedAssetRoleSelections[0]?.assetId,
    );
    expect(replacementDecision.structuralFingerprint).toBe(withPlacement.structuralFingerprint);
  });

  it("selects registered search presentation while keeping runtime execution fail closed", () => {
    const fixture = compilerFixture();
    const baseIntent = providerIntent(fixture);
    const currentSearchId =
      fixture.currentRequestInput.draft.dynamicCommercePresentation?.searchArchetypeId;
    if (!currentSearchId) throw new Error("Missing current search archetype.");
    const searchPresentation =
      fixture.requestAuthority.request.capabilityProjection.capabilities.find(
        ({ dimension, availability, key }) =>
          dimension === "collection-search.search-relationship" &&
          availability === "available" &&
          key.includes(currentSearchId),
      );
    if (!searchPresentation) throw new Error("Missing registered search presentation capability.");
    const { intentFingerprint: _fingerprint, ...material } = structuredClone(baseIntent);
    void _fingerprint;
    material.constraints.avoid = material.constraints.avoid.filter(
      ({ dimension }) => dimension !== "collection-search.search-relationship",
    );
    material.collectionSearch.searchRelationshipPreferences = [
      preference(searchPresentation, "soft"),
    ];
    const intent = promptedStorefrontDesignIntentV2Schema.parse({
      ...material,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
    });
    const decision = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });

    expect(decision.dynamicCommerceSelection.searchArchetypeId).toBe(currentSearchId);
    expect(decision.dynamicCommerceSelection.searchExecution).toBe(
      "registered-presentation-fail-closed-runtime",
    );
    expect(
      decision.diagnostics.find(({ preferenceKey }) => preferenceKey === searchPresentation.key),
    ).toMatchObject({
      outcome: "accepted",
      selectedAuthority: {
        authorityId: currentSearchId,
        availability: "available",
      },
    });
  });

  it("honors dedicated and constraints-level search avoids and fails closed when none remain", () => {
    const fixture = compilerFixtureWithAlternateSearchPresentation();
    const baseIntent = providerIntent(fixture);
    const searchCapabilities = fixture.requestAuthority.request.capabilityProjection.capabilities
      .filter(
        ({ dimension, availability }) =>
          dimension === "collection-search.search-relationship" && availability === "available",
      )
      .sort((left, right) => left.key.localeCompare(right.key));
    expect(searchCapabilities.length).toBeGreaterThan(1);

    const compileWith = (intent: PromptedStorefrontDesignIntentV2) =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: intent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      });
    const materialFor = (
      dedicated: PromptedStorefrontDesignIntentV2["collectionSearch"]["searchRelationshipPreferences"],
      globalAvoid: PromptedStorefrontDesignIntentV2["constraints"]["avoid"] = [],
    ) => {
      const { intentFingerprint: _fingerprint, ...material } = structuredClone(baseIntent);
      void _fingerprint;
      material.constraints.avoid = [
        ...material.constraints.avoid.filter(
          ({ dimension }) => dimension !== "collection-search.search-relationship",
        ),
        ...globalAvoid,
      ];
      material.collectionSearch.searchRelationshipPreferences = dedicated;
      return promptedStorefrontDesignIntentV2Schema.parse({
        ...material,
        intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
      });
    };

    const baseline = compileWith(materialFor([]));
    const avoided = searchCapabilities.find((entry) => {
      const reference = fixture.requestAuthority.capabilityAuthority.referencesByPreferenceKey.get(
        entry.key,
      );
      return reference?.authorityId === baseline.dynamicCommerceSelection.searchArchetypeId;
    });
    if (!avoided) throw new Error("Missing exact selected search presentation capability.");

    const dedicatedAlternative = compileWith(materialFor([preference(avoided, "avoid")]));
    expect(dedicatedAlternative.dynamicCommerceSelection.searchArchetypeId).not.toBe(
      baseline.dynamicCommerceSelection.searchArchetypeId,
    );
    expect(dedicatedAlternative.dynamicCommerceSelection.searchExecution).toBe(
      "registered-presentation-fail-closed-runtime",
    );
    expect(
      dedicatedAlternative.diagnostics.find(({ preferenceKey }) => preferenceKey === avoided.key),
    ).toMatchObject({
      outcome: "rejected",
      reasonCode: "avoided-selection",
      selectedAuthority: null,
    });

    const globalAlternative = compileWith(materialFor([], [preference(avoided, "avoid")]));
    expect(globalAlternative.dynamicCommerceSelection.searchArchetypeId).not.toBe(
      baseline.dynamicCommerceSelection.searchArchetypeId,
    );

    expect(() =>
      compileWith(materialFor(searchCapabilities.map((entry) => preference(entry, "avoid")))),
    ).toThrowError(
      expect.objectContaining({
        code: "no-compatible-selection",
      }),
    );
  }, 120_000);
});
