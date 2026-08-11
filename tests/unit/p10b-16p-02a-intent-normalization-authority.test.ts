import { describe, expect, it } from "vitest";
import {
  PROMPTED_STOREFRONT_CAPABILITY_PROJECTION_VERSION,
  PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
  assertPromptedStorefrontCurrentAuthority,
  promptedStorefrontCapabilityReferenceAuthorityFingerprint,
  promptedStorefrontCapabilityProjectionFingerprint,
  promptedStorefrontCapabilityProjectionSchema,
  promptedStorefrontCatalogueProjectionFingerprint,
  promptedStorefrontDesignRequestFingerprint,
  promptedStorefrontDesignRequestV2Schema,
  promptedStorefrontPromptFingerprint,
  promptedStorefrontCanonicalCommerceAuthorityFingerprint,
  validatePromptedStorefrontDesignIntentV2,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCapabilityDimension,
  type PromptedStorefrontCapabilityEntry,
  type PromptedStorefrontCurrentAuthorityIdentity,
  type PromptedStorefrontDesignRequestV2,
  type PromptedStorefrontPreferenceSemantics,
} from "@/application/prompted-storefront-design-intent";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

type CapabilityInput = Readonly<{
  key: string;
  dimension: PromptedStorefrontCapabilityDimension;
  selection?: PromptedStorefrontCapabilityEntry["selection"];
  productTypeKey?: boolean;
}>;

const capabilityInputs: readonly CapabilityInput[] = [
  {
    key: "designDna.typographyPairing.editorial",
    dimension: "design-dna.typography-pairing",
  },
  {
    key: "designDna.typographyPairing.technical",
    dimension: "design-dna.typography-pairing",
  },
  {
    key: "sharedFrame.profile.editorial",
    dimension: "shared-frame.profile",
  },
  {
    key: "homepage.role.brandStory",
    dimension: "homepage.narrative-role",
  },
  {
    key: "homepage.role.merchandising",
    dimension: "homepage.narrative-role",
  },
  {
    key: "homepage.sectionCount.commercial",
    dimension: "homepage.section-count",
    selection: { kind: "number", minimum: 3, maximum: 12 },
  },
  {
    key: "collectionSearch.archetype.editorial",
    dimension: "collection-search.archetype",
  },
  {
    key: "pdp.archetype.standard",
    dimension: "pdp.archetype",
  },
  {
    key: "pdp.productType.ring",
    dimension: "pdp.product-type",
    productTypeKey: true,
  },
  {
    key: "pdp.productType.watch",
    dimension: "pdp.product-type",
    productTypeKey: true,
  },
  {
    key: "contentSupport.profile.about",
    dimension: "content-support.profile",
  },
  {
    key: "contentSupport.profile.faq",
    dimension: "content-support.profile",
  },
  {
    key: "component.family.hero",
    dimension: "component.family",
  },
  {
    key: "responsive.posture.contentFirst",
    dimension: "responsive.posture",
  },
];

function capabilityAuthority(): PromptedStorefrontCapabilityAuthority {
  const capabilities = capabilityInputs
    .map((entry) => ({
      key: entry.key,
      dimension: entry.dimension,
      description: `Safe capability ${entry.key}.`,
      contexts: ["storefront"],
      availability: "available" as const,
      requirements: [],
      selection: entry.selection ?? { kind: "capability" as const },
    }))
    .sort((left, right) =>
      `${left.dimension}:${left.key}`.localeCompare(`${right.dimension}:${right.key}`),
    );
  const material: Parameters<typeof promptedStorefrontCapabilityProjectionFingerprint>[0] = {
    version: PROMPTED_STOREFRONT_CAPABILITY_PROJECTION_VERSION,
    capabilities,
    search: {
      registration: "registered-presentation-authority",
      execution: "unavailable",
      behavior: "fail-closed",
      reason: "missing-canonical-search-results-adapter",
    },
  };
  const projection = promptedStorefrontCapabilityProjectionSchema.parse({
    ...material,
    fingerprint: promptedStorefrontCapabilityProjectionFingerprint(material),
  });
  return {
    projection,
    referencesByPreferenceKey: new Map(
      capabilityInputs.map((entry) => [
        entry.key,
        {
          key: entry.key,
          dimension: entry.dimension,
          availability: "available" as const,
          authorityKind:
            entry.dimension === "pdp.product-type"
              ? ("catalogue" as const)
              : entry.dimension.startsWith("pdp")
                ? ("dynamic-commerce" as const)
                : entry.dimension.startsWith("content-support")
                  ? ("page-blueprint" as const)
                  : ("commercial-grammar" as const),
          authorityId: `authority-${entry.key}`,
          authorityFingerprint: `authority-fingerprint-${entry.key}`,
          selection: entry.selection ?? { kind: "capability" as const },
          productTypeKey: entry.productTypeKey ?? false,
        },
      ]),
    ),
  };
}

function currentAuthority(
  projectionFingerprint: string,
  capabilityReferenceAuthorityFingerprint: string,
  canonicalCommerceAuthorityFingerprint = "canonical-commerce-current",
): PromptedStorefrontCurrentAuthorityIdentity {
  return {
    projectId: "project_prompted_normalization",
    projectRevision: 1,
    draftSnapshotId: "snapshot_prompted_normalization",
    draftRevision: 1,
    storefrontSnapshotFingerprint: "storefront-current",
    dynamicCommercePresentationFingerprint: "dynamic-commerce-current",
    capabilityManifestFingerprint: "capability-manifest-current",
    pageBlueprintAuthorityFingerprint: "page-blueprint-current",
    designDnaAuthorityFingerprint: "design-dna-current",
    approvedBriefFingerprint: "approved-brief-current",
    approvedBriefEvidenceFingerprint: "approved-evidence-current",
    approvedAssetAuthorityFingerprint: null,
    canonicalCommerceAuthorityFingerprint,
    catalogueProjectionFingerprint: "catalogue-projection-current",
    capabilityProjectionFingerprint: projectionFingerprint,
    capabilityReferenceAuthorityFingerprint,
  };
}

function requestFixture(
  authority: PromptedStorefrontCapabilityAuthority,
): PromptedStorefrontDesignRequestV2 {
  const prompt = "Create a deliberately ranked storefront direction.";
  const material: Parameters<typeof promptedStorefrontDesignRequestFingerprint>[0] = {
    contractVersion: PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
    requestId: "request_prompted_normalization",
    merchantPrompt: prompt,
    promptFingerprint: promptedStorefrontPromptFingerprint(prompt),
    currentAuthority: currentAuthority(
      authority.projection.fingerprint,
      promptedStorefrontCapabilityReferenceAuthorityFingerprint(
        authority.referencesByPreferenceKey.values(),
      ),
    ),
    approvedMerchantContext: {
      businessName: "Aurum Nordic",
      industry: "Jewellery",
      approvedBrandSummary: "A safe approved brand summary.",
      targetCustomer: "Design-conscious adults",
      primaryMarket: "Finland",
      approvedToneOrVisualPriorities: [],
      supportedLocales: ["en"],
      excludedClaimsOrUnsupportedRequirements: [],
    },
    catalogueCharacteristics: {
      productCount: 2,
      collectionCount: 1,
      productTypes: [
        {
          productTypeKey: "pdp.productType.ring",
          safeLabel: "Ring",
          productCount: 1,
          simpleProductCount: 1,
          configurableProductCount: 0,
          optionGroupCountRange: { minimum: 0, maximum: 0 },
          mediaDepthRange: { minimum: 1, maximum: 1 },
          highConsiderationPresentationCount: 0,
        },
        {
          productTypeKey: "pdp.productType.watch",
          safeLabel: "Watch",
          productCount: 1,
          simpleProductCount: 1,
          configurableProductCount: 0,
          optionGroupCountRange: { minimum: 0, maximum: 0 },
          mediaDepthRange: { minimum: 1, maximum: 1 },
          highConsiderationPresentationCount: 0,
        },
      ],
      simpleProductCount: 2,
      configurableProductCount: 0,
      optionGroupComplexity: { none: 2, one: 0, twoToThree: 0, fourOrMore: 0 },
      mediaDepth: { none: 0, one: 2, twoToThree: 0, fourOrMore: 0 },
      highConsiderationPresentationCount: 0,
      collectionMembershipSize: { minimum: 2, maximum: 2, averageRounded: 2 },
      collectionHierarchy: { depth: "unavailable", childCollections: "unavailable" },
    },
    evidenceAndAssets: {
      approvedEvidenceFamilies: [],
      approvedPresentationAssetRoles: [],
      editorialOrBrandImageryAvailable: false,
      responsiveAssetTreatmentAvailable: false,
      evidenceDependentCapabilityKeys: [],
      unresolvedSafeOmissions: [],
    },
    capabilityProjection: authority.projection,
    priorDiversityEvidence: {
      recentAcceptedStructuralFingerprints: [],
      recentRejectedStructuralFingerprints: [],
      recentlyUsedPostureKeys: [],
      merchantAvoidancePreferenceKeys: [],
    },
  };
  return promptedStorefrontDesignRequestV2Schema.parse({
    ...material,
    requestFingerprint: promptedStorefrontDesignRequestFingerprint(material),
  });
}

function preference(
  key: string,
  dimension: PromptedStorefrontCapabilityDimension,
  rank: number,
  semantics: PromptedStorefrontPreferenceSemantics = "soft",
) {
  return { key, dimension, semantics, rank: semantics === "soft" ? rank : null };
}

function intentFixture(request: PromptedStorefrontDesignRequestV2) {
  const editorial = preference(
    "designDna.typographyPairing.editorial",
    "design-dna.typography-pairing",
    2,
  );
  const technical = preference(
    "designDna.typographyPairing.technical",
    "design-dna.typography-pairing",
    1,
  );
  const frame = preference("sharedFrame.profile.editorial", "shared-frame.profile", 1);
  const story = { key: "homepage.role.brandStory", dimension: "homepage.narrative-role" as const };
  const merchandising = {
    key: "homepage.role.merchandising",
    dimension: "homepage.narrative-role" as const,
  };
  const pdp = preference("pdp.archetype.standard", "pdp.archetype", 1);
  const collection = preference(
    "collectionSearch.archetype.editorial",
    "collection-search.archetype",
    1,
  );
  const component = preference("component.family.hero", "component.family", 1);
  const responsive = preference("responsive.posture.contentFirst", "responsive.posture", 1);
  const about = {
    key: "contentSupport.profile.about",
    dimension: "content-support.profile" as const,
  };
  const faq = {
    key: "contentSupport.profile.faq",
    dimension: "content-support.profile" as const,
  };
  return {
    contractVersion: PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
    requestFingerprint: request.requestFingerprint,
    promptFingerprint: request.promptFingerprint,
    concept: {
      summary: "A ranked commercial direction.",
      commercialPosture: "Editorial",
      intendedCustomerExperience: "Considered discovery.",
    },
    constraints: { hard: [], soft: [editorial, technical], optional: [], avoid: [] },
    designDna: { preferences: [editorial, technical] },
    sharedFrame: { preferences: [frame] },
    homepage: {
      profilePreferences: [],
      narrativeRoleSequence: [merchandising, story],
      requiredRoles: [merchandising, story],
      preferredRoles: [],
      optionalRoles: [],
      avoidedRoles: [],
      componentFamilyPreferences: [],
      meaningfulVariantPreferences: [],
      sectionCount: {
        key: "homepage.sectionCount.commercial",
        dimension: "homepage.section-count" as const,
        minimum: 3,
        ideal: 6,
        maximum: 12,
      },
      sectionRhythmPreferences: [],
      evidenceDependentOmission: "omit" as const,
      approvedAssetRolePreferences: [],
    },
    collectionSearch: {
      archetypePreferences: [collection],
      discoveryPreferences: [],
      densityPreferences: [],
      filterSortPreferences: [],
      childCollectionPreferences: [],
      merchandisingPreferences: [],
      productCardPreferences: [],
      searchRelationshipPreferences: [],
      searchExecutionExpectation: "registered-presentation-fail-closed-runtime" as const,
    },
    productDetail: {
      standardSimplePreferences: [],
      configurablePreferences: [],
      galleryLedPreferences: [],
      highConsiderationPreferences: [],
      genericFallbackPreferences: [],
      productTypeIntentions: [
        { productTypeKey: "pdp.productType.watch", preferences: [pdp] },
        { productTypeKey: "pdp.productType.ring", preferences: [pdp] },
      ],
      optionComplexityPreferences: [],
      mediaPreferences: [],
      purchaseDecisionHierarchyPreferences: [],
      relatedMerchandisingPreferences: [],
      productCardPreferences: [],
    },
    contentSupport: {
      pageFamilyPreferences: [],
      narrativePurposePreferences: [],
      evidenceRequirements: [faq, about],
      safeOmissionBehavior: "omit" as const,
    },
    components: {
      familyPreferences: [component],
      meaningfulVariantPreferences: [],
      boundedParameterPreferences: [],
    },
    responsiveArtDirection: {
      responsivePosturePreferences: [responsive],
      mobileHierarchyPreferences: [],
      densityTransformationPreferences: [],
      desktopNarrativePriority: [merchandising, story],
      mobileNarrativePriority: [story, merchandising],
      imagePosturePreferences: [],
      cropFocalPreferences: [],
      overlayPreferences: [],
      approvedMediaRolePreferences: [],
    },
  };
}

function validate(
  authority: PromptedStorefrontCapabilityAuthority,
  request: PromptedStorefrontDesignRequestV2,
  intent: unknown,
) {
  return validatePromptedStorefrontDesignIntentV2({
    request,
    capabilityAuthority: authority,
    currentAuthority: request.currentAuthority,
    intent,
  });
}

describe("P10B-16P-02A intent normalization and exact authority", () => {
  it("normalizes sets and ranked lists while preserving true narrative sequences", () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);
    const original = intentFixture(request);
    const first = validate(authority, request, original);

    expect(first.constraints.soft.map(({ rank }) => rank)).toEqual([1, 2]);
    expect(first.designDna.preferences.map(({ rank }) => rank)).toEqual([1, 2]);
    expect(first.homepage.requiredRoles.map(({ key }) => key)).toEqual([
      "homepage.role.brandStory",
      "homepage.role.merchandising",
    ]);
    expect(first.homepage.narrativeRoleSequence).toEqual(original.homepage.narrativeRoleSequence);
    expect(
      first.productDetail.productTypeIntentions.map(({ productTypeKey }) => productTypeKey),
    ).toEqual(["pdp.productType.ring", "pdp.productType.watch"]);

    const reordered = structuredClone(original);
    reordered.constraints.soft.reverse();
    reordered.designDna.preferences.reverse();
    reordered.homepage.requiredRoles.reverse();
    reordered.contentSupport.evidenceRequirements.reverse();
    reordered.productDetail.productTypeIntentions.reverse();
    const equivalent = validate(authority, request, reordered);
    expect(equivalent.intentFingerprint).toBe(first.intentFingerprint);

    const changedSequence = structuredClone(original);
    changedSequence.homepage.narrativeRoleSequence.reverse();
    const changed = validate(authority, request, changedSequence);
    expect(changed.homepage.narrativeRoleSequence).toEqual(
      changedSequence.homepage.narrativeRoleSequence,
    );
    expect(changed.intentFingerprint).not.toBe(first.intentFingerprint);
  });

  it("rejects duplicates, duplicate ranks, duplicate product types and contradictory semantics", () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);
    const cases = [
      (intent: ReturnType<typeof intentFixture>) => {
        intent.designDna.preferences.push({
          ...intent.designDna.preferences[0],
          rank: 3,
        });
      },
      (intent: ReturnType<typeof intentFixture>) => {
        intent.designDna.preferences[0].rank = 1;
      },
      (intent: ReturnType<typeof intentFixture>) => {
        intent.productDetail.productTypeIntentions.push(
          structuredClone(intent.productDetail.productTypeIntentions[0]),
        );
      },
      (intent: ReturnType<typeof intentFixture>) => {
        intent.designDna.preferences = [
          {
            ...intent.constraints.soft[0],
            semantics: "hard",
            rank: null,
          },
        ];
      },
      (intent: ReturnType<typeof intentFixture>) => {
        intent.homepage.requiredRoles.push(structuredClone(intent.homepage.requiredRoles[0]));
      },
    ];

    for (const mutate of cases) {
      const candidate = intentFixture(request);
      mutate(candidate);
      expect(() => validate(authority, request, candidate)).toThrow(
        expect.objectContaining({ code: "strict-schema-invalid" }),
      );
    }
  });

  it("rejects blank concepts, effectively empty core domains and implicit role contradictions", () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);

    const blankConcept = intentFixture(request);
    blankConcept.concept.summary = "   ";
    expect(() => validate(authority, request, blankConcept)).toThrow(
      expect.objectContaining({ code: "strict-schema-invalid" }),
    );

    const missingCoreDomain = intentFixture(request);
    missingCoreDomain.sharedFrame.preferences = [];
    expect(() => validate(authority, request, missingCoreDomain)).toThrow(
      expect.objectContaining({ code: "strict-schema-invalid" }),
    );

    const contradictoryRole = intentFixture(request);
    (
      contradictoryRole.homepage.avoidedRoles as Array<{
        key: string;
        dimension: "homepage.narrative-role";
      }>
    ).push(structuredClone(contradictoryRole.homepage.requiredRoles[0]));
    expect(() => validate(authority, request, contradictoryRole)).toThrow(
      expect.objectContaining({ code: "strict-schema-invalid" }),
    );

    const emptyProductTypeIntention = intentFixture(request);
    Object.assign(emptyProductTypeIntention.productDetail, {
      standardSimplePreferences: [],
      configurablePreferences: [],
      galleryLedPreferences: [],
      highConsiderationPreferences: [],
      genericFallbackPreferences: [],
      optionComplexityPreferences: [],
      mediaPreferences: [],
      purchaseDecisionHierarchyPreferences: [],
      relatedMerchandisingPreferences: [],
      productCardPreferences: [],
      productTypeIntentions: [
        {
          ...emptyProductTypeIntention.productDetail.productTypeIntentions[0],
          preferences: [],
        },
      ],
    });
    expect(() => validate(authority, request, emptyProductTypeIntention)).toThrow(
      expect.objectContaining({ code: "strict-schema-invalid" }),
    );

    const contradictoryResponsivePriority = intentFixture(request);
    (
      contradictoryResponsivePriority.homepage.avoidedRoles as Array<{
        key: string;
        dimension: "homepage.narrative-role";
      }>
    ).push(
      structuredClone(
        contradictoryResponsivePriority.responsiveArtDirection.desktopNarrativePriority[0],
      ),
    );
    expect(() => validate(authority, request, contradictoryResponsivePriority)).toThrow(
      expect.objectContaining({ code: "strict-schema-invalid" }),
    );
  });

  it("binds exact private capability-reference roles and their authority fingerprint", () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);
    const original = authority.referencesByPreferenceKey.get("pdp.archetype.standard");
    if (!original) throw new Error("The exact-authority fixture requires the standard PDP role.");

    const tamperedReferences = new Map(authority.referencesByPreferenceKey);
    tamperedReferences.set(original.key, {
      ...original,
      intentRoles: ["pdp-configurable"],
    });
    expect(() =>
      validate(
        { ...authority, referencesByPreferenceKey: tamperedReferences },
        request,
        intentFixture(request),
      ),
    ).toThrow(expect.objectContaining({ code: "stale-authority" }));

    const { requestFingerprint: _requestFingerprint, ...requestMaterial } = request;
    void _requestFingerprint;
    const tamperedRequestMaterial = {
      ...requestMaterial,
      currentAuthority: {
        ...request.currentAuthority,
        capabilityReferenceAuthorityFingerprint: "prompted-capability-reference-authority-tampered",
      },
    };
    const tamperedRequest = promptedStorefrontDesignRequestV2Schema.parse({
      ...tamperedRequestMaterial,
      requestFingerprint: promptedStorefrontDesignRequestFingerprint(tamperedRequestMaterial),
    });
    expect(() => validate(authority, tamperedRequest, intentFixture(tamperedRequest))).toThrow(
      expect.objectContaining({ code: "stale-authority" }),
    );
  });

  it("binds homepage section counts to the exact advertised numeric authority", () => {
    const authority = capabilityAuthority();
    const request = requestFixture(authority);
    expect(() => validate(authority, request, intentFixture(request))).not.toThrow();

    const outsideRange = intentFixture(request);
    outsideRange.homepage.sectionCount.minimum = 2;
    expect(() => validate(authority, request, outsideRange)).toThrow(
      expect.objectContaining({ code: "invalid-bounded-parameter" }),
    );

    const unknownAuthority = intentFixture(request);
    unknownAuthority.homepage.sectionCount.key = "homepage.sectionCount.invented";
    expect(() => validate(authority, request, unknownAuthority)).toThrow(
      expect.objectContaining({ code: "unknown-capability" }),
    );
  });

  it("rejects exact catalogue drift even when aggregate characteristics are unchanged", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const changedCatalogue = structuredClone(aggregate.catalogue);
    const product = changedCatalogue.products[0];
    if (!product) throw new Error("The exact-commerce test requires one canonical product.");
    product.title.en = `${product.title.en} revised`;

    expect(promptedStorefrontCatalogueProjectionFingerprint(changedCatalogue)).toBe(
      promptedStorefrontCatalogueProjectionFingerprint(aggregate.catalogue),
    );
    const expectedExact = promptedStorefrontCanonicalCommerceAuthorityFingerprint(
      aggregate.catalogue,
    );
    const changedExact = promptedStorefrontCanonicalCommerceAuthorityFingerprint(changedCatalogue);
    expect(changedExact).not.toBe(expectedExact);

    const expected = currentAuthority(
      "capability-projection",
      "capability-reference-authority",
      expectedExact,
    );
    const changed = currentAuthority(
      "capability-projection",
      "capability-reference-authority",
      changedExact,
    );
    expect(() => assertPromptedStorefrontCurrentAuthority(expected, changed)).toThrow(
      expect.objectContaining({ code: "stale-authority" }),
    );

    expect(
      promptedStorefrontCanonicalCommerceAuthorityFingerprint({
        ...aggregate.catalogue,
        products: [...aggregate.catalogue.products].reverse(),
        collections: [...aggregate.catalogue.collections].reverse(),
      }),
    ).toBe(expectedExact);
  });
});
