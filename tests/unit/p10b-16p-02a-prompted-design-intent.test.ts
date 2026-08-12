import { describe, expect, it } from "vitest";
import {
  createApprovedGenerationAssetContextFingerprint,
  type ApprovedGenerationAssetContext,
} from "@/application/ai-storefront-generation";
import {
  PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
  createPromptedStorefrontCapabilityAuthority,
  createPromptedStorefrontDesignRequestV2,
  validatePromptedStorefrontDesignIntentV2,
  type PromptedStorefrontCapabilityEntry,
  type PromptedStorefrontDesignIntentError,
  type PromptedStorefrontDesignIntentV2,
} from "@/application/prompted-storefront-design-intent";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { resolveCommercialHomepageEvidenceAvailability } from "@/application/storefront-templates";
import {
  canonicalValueString,
  createContentSupportFactDocument,
  createDynamicCommercePresentationAuthority,
  type DynamicCommerceCollectionSearchArchetype,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { sourceEvidenceSchema, sourceReferenceSchema } from "@/domain/source-discovery";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

const now = "2026-08-11T09:00:00.000Z";

function approvedRequestInput(
  prompt = "  Build a calm editorial store — keep my exact spacing.  ",
  options: Readonly<{
    approvedResponsiveCrop?: boolean;
    approvedLogoOnly?: boolean;
    omitSourceEvidence?: boolean;
    emptyMerchantDescription?: boolean;
  }> = {},
) {
  const aggregate = p10b16p01DynamicCommerceAggregate();
  const source = sourceReferenceSchema.parse({
    id: "source_prompted_v2",
    sourceType: "deterministic-fixture",
    url: "https://private-merchant.example/source",
    normalizedOrigin: "https://private-merchant.example",
    requestedLocale: "en",
    discoveredAt: now,
    allowedDiscoveryPolicy: {
      mode: "deterministic",
      maxPages: 5,
      maxAssets: 10,
      followSameOriginOnly: true,
    },
    status: "complete",
    warnings: [],
    failure: null,
  });
  const evidence = sourceEvidenceSchema.parse({
    id: "evidence_prompted_v2_private",
    kind: "page-identity",
    provenance: { sourceReferenceId: source.id, sourceUrl: source.url, observedAt: now },
    sourceUrl: source.url,
    confidence: 1,
    observedValue: { title: "Private evidence body must never cross the provider boundary" },
    extractionMethod: "deterministic-test-fixture",
    locale: "en",
    warnings: [],
    uncertainty: { isUncertain: false, reason: null },
  });
  const hasApprovedAsset = options.approvedResponsiveCrop || options.approvedLogoOnly;
  const approvedAssetId = options.approvedLogoOnly
    ? "asset_prompted_v2_logo"
    : "asset_prompted_v2_editorial";
  const approvedAssetAssignment = {
    assetId: approvedAssetId,
    role: options.approvedLogoOnly ? ("logo" as const) : ("editorialImage" as const),
    revision: "1",
    fingerprint: "asset-material-prompted-v2-editorial",
  };
  const brief = approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: "brief_prompted_v2",
      now,
      businessIdentity: {
        businessName: "Aurum Nordic",
        shortDescription: options.emptyMerchantDescription
          ? ""
          : "A considered Nordic jewellery storefront.",
        industry: "jewellery",
        targetCustomer: "Design-conscious adults",
        primaryMarket: "Finland",
      },
      languagePlan: { selectedLanguages: ["fi", "en"], primaryLanguage: "en" },
      sourceReferenceIds: options.omitSourceEvidence ? [] : [source.id],
      sourceEvidenceIds: options.omitSourceEvidence ? [] : [evidence.id],
      materialEvidence: {
        sourceReferences: options.omitSourceEvidence ? [] : [source],
        evidence: options.omitSourceEvidence ? [] : [evidence],
        assetCandidates: [],
        reconciliation: null,
      },
      canonicalCommerceProjectionRef: aggregate.catalogue.id,
      pagePlan: { pageTypes: ["home", "collection", "product"] },
      approvedBrandDirection: {
        logoAssetRef: null,
        supportingImageAssetRefs: [],
        preferredBrandColours: ["#223344"],
        typographyDirection: "serif-led",
        visualStyleDirection: "editorial",
        imageryDirection: "studio",
        toneKeywords: ["warm"],
      },
      visualPriorities: ["Editorial hierarchy"],
      excludedClaims: ["No invented delivery promise"],
      ...(hasApprovedAsset
        ? {
            approvedReusableAssetIds: [approvedAssetId],
            approvedAssetAssignments: [approvedAssetAssignment],
            assetReviewFingerprint: "asset-review-prompted-v2-responsive",
            generationPermissions: { allowAssetReuse: true },
          }
        : {}),
    }),
    { actorId: "merchant_prompted_v2", approvedAt: now },
  );
  const assetMaterial = {
    briefId: brief.id,
    briefRevision: brief.revision,
    approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint!,
    assetReviewFingerprint: brief.assetReviewFingerprint,
    assets: hasApprovedAsset
      ? [
          {
            assetId: approvedAssetId,
            role: approvedAssetAssignment.role,
            sourceReferenceId: source.id,
            revision: approvedAssetAssignment.revision,
            materialFingerprint: approvedAssetAssignment.fingerprint,
            provenance: { location: "merchant-upload" as const, observedAt: now },
            alt: { en: "Approved editorial image", fi: "Hyväksytty toimituksellinen kuva" },
            presentation: {
              decorative: false,
              mediaType: "image/jpeg",
              responsiveCrops: options.approvedResponsiveCrop
                ? [
                    {
                      cropId: "crop_prompted_v2_mobile",
                      breakpoint: "mobile" as const,
                      aspectRatio: "4:5",
                      focalPoint: { x: 0.5, y: 0.4 },
                    },
                  ]
                : [],
            },
            approval: { actorId: "merchant_prompted_v2", actorReference: null },
          },
        ]
      : [],
  };
  const approvedAssetContext: ApprovedGenerationAssetContext = {
    ...assetMaterial,
    fingerprint: createApprovedGenerationAssetContextFingerprint(assetMaterial),
  };
  const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
  return {
    merchantPrompt: prompt,
    project: aggregate.project,
    draft,
    catalogue: aggregate.catalogue,
    approvedBrief: brief,
    approvedAssetContext,
  };
}

function withCollectionArchetype(
  draft: StorefrontSnapshot,
  transform: (
    archetype: DynamicCommerceCollectionSearchArchetype,
  ) => DynamicCommerceCollectionSearchArchetype,
): StorefrontSnapshot {
  const current = draft.dynamicCommercePresentation;
  const first = current?.collectionSearchArchetypes[0];
  if (!current || !first) throw new Error("Missing dynamic collection authority fixture.");
  const { authorityFingerprint: _authorityFingerprint, ...material } = structuredClone(current);
  void _authorityFingerprint;
  return {
    ...draft,
    dynamicCommercePresentation: createDynamicCommercePresentationAuthority({
      ...material,
      collectionSearchArchetypes: [
        transform(structuredClone(first)),
        ...material.collectionSearchArchetypes.slice(1),
      ],
    }),
  };
}

function emptyCatalogueRequestInput() {
  const input = approvedRequestInput("Use only capabilities executable without commerce rows.");
  const current = input.draft.dynamicCommercePresentation;
  if (!current) throw new Error("Missing dynamic commerce authority fixture.");
  const { authorityFingerprint: _authorityFingerprint, ...material } = structuredClone(current);
  void _authorityFingerprint;
  const routeInventory = material.routeInventory.filter(({ kind }) => kind === "search");
  const retainedRouteIds = new Set(routeInventory.map(({ id }) => id));
  const navigation = Object.fromEntries(
    Object.entries(input.draft.navigation).map(([area, items]) => [
      area,
      items.filter(
        ({ target }) =>
          target.type !== "dynamic-commerce-route" || retainedRouteIds.has(target.routeId),
      ),
    ]),
  ) as StorefrontSnapshot["navigation"];
  return {
    ...input,
    catalogue: { ...input.catalogue, products: [], collections: [] },
    draft: {
      ...input.draft,
      navigation,
      dynamicCommercePresentation: createDynamicCommercePresentationAuthority({
        ...material,
        routeInventory,
        collectionRouteMappings: [],
        productTypeMappings: [],
      }),
    },
  };
}

type Preference = PromptedStorefrontDesignIntentV2["designDna"]["preferences"][number];

function capability(
  created: ReturnType<typeof createPromptedStorefrontDesignRequestV2>,
  dimension: PromptedStorefrontCapabilityEntry["dimension"],
  availability?: PromptedStorefrontCapabilityEntry["availability"],
) {
  const result = created.request.capabilityProjection.capabilities.find(
    (entry) =>
      entry.dimension === dimension &&
      (availability === undefined || entry.availability === availability),
  );
  if (!result) throw new Error(`Missing test capability ${dimension}/${availability ?? "any"}.`);
  return result;
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

function validIntent(created: ReturnType<typeof createPromptedStorefrontDesignRequestV2>) {
  const dna = capability(created, "design-dna.typography-scale", "available");
  const frame = capability(created, "shared-frame.profile", "available");
  const homepage = capability(created, "homepage.profile", "available");
  const homepageSectionCount = created.request.capabilityProjection.capabilities.find(
    ({ key }) => key === `homepage.section-count.${homepage.key.slice("homepage.profile.".length)}`,
  );
  if (!homepageSectionCount || homepageSectionCount.selection.kind !== "number") {
    throw new Error("Missing numeric section-count authority for the selected homepage profile.");
  }
  const role = capability(created, "homepage.narrative-role", "available");
  const homepageFamily = capability(created, "homepage.component-family", "available");
  const homepageVariant = capability(created, "homepage.meaningful-variant", "available");
  const rhythm = capability(created, "homepage.section-rhythm", "available");
  const homepageAssetRole = created.request.capabilityProjection.capabilities.find(
    ({ dimension, availability }) =>
      dimension === "homepage.asset-role" && availability === "available",
  );
  const collection = capability(created, "collection-search.archetype", "available");
  const discovery = capability(created, "collection-search.discovery", "available");
  const collectionDensity = capability(created, "collection-search.density", "available");
  const filterSort = capability(created, "collection-search.filter-sort", "available");
  const childCollection = capability(created, "collection-search.child-collection", "available");
  const merchandising = capability(created, "collection-search.merchandising", "available");
  const collectionCard = capability(created, "collection-search.product-card", "available");
  const search = capability(created, "collection-search.search-relationship", "available");
  const pdpStandard = created.request.capabilityProjection.capabilities.find(
    ({ key, availability }) =>
      key.startsWith("pdp.archetype.profile.pdp-standard-commerce.") &&
      availability === "available",
  );
  const pdpConfigurable = created.request.capabilityProjection.capabilities.find(
    ({ key, availability }) =>
      key.startsWith("pdp.archetype.profile.pdp-variant-led.") && availability === "available",
  );
  const pdpGallery = created.request.capabilityProjection.capabilities.find(
    ({ key, availability }) =>
      key.startsWith("pdp.archetype.profile.pdp-gallery-led.") && availability === "available",
  );
  const pdpHighConsideration = created.request.capabilityProjection.capabilities.find(
    ({ key, availability }) =>
      key.startsWith("pdp.archetype.profile.pdp-high-consideration.") &&
      availability === "available",
  );
  const pdpFallback = created.request.capabilityProjection.capabilities.find(
    ({ key, availability }) => key.includes(".generic-fallback.") && availability === "available",
  );
  if (!pdpStandard || !pdpConfigurable || !pdpGallery || !pdpHighConsideration || !pdpFallback) {
    throw new Error("Missing exact registered PDP intent-role authority.");
  }
  const productType = capability(created, "pdp.product-type", "available");
  const option = capability(created, "pdp.option-complexity", "available");
  const pdpMedia = capability(created, "pdp.media", "available");
  const purchase = capability(created, "pdp.purchase-hierarchy", "available");
  const related = capability(created, "pdp.related-merchandising", "available");
  const pdpCard = capability(created, "pdp.product-card", "available");
  const content = capability(created, "content-support.profile");
  const contentPurpose = capability(created, "content-support.narrative-purpose");
  const componentFamily = capability(created, "component.family", "available");
  const componentVariant = capability(created, "component.meaningful-variant", "available");
  const parameter = capability(created, "component.bounded-parameter", "available");
  const parameterValue =
    parameter.selection.kind === "enum"
      ? parameter.selection.allowedValues[0]
      : parameter.selection.kind === "number"
        ? parameter.selection.minimum
        : "registered";
  const responsive = capability(created, "responsive.posture", "available");
  const mobile = capability(created, "responsive.mobile-hierarchy", "available");
  const responsiveDensity = capability(created, "responsive.density", "available");
  const image = capability(created, "responsive.image", "available");
  const crop = capability(created, "responsive.crop", "available");
  const overlay = capability(created, "responsive.overlay", "available");
  const intent = {
    contractVersion: PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
    requestFingerprint: created.request.requestFingerprint,
    promptFingerprint: created.request.promptFingerprint,
    concept: {
      summary: "A calm editorial commerce system with confident product focus.",
      commercialPosture: "Premium but approachable",
      intendedCustomerExperience: "Clear discovery followed by considered purchase decisions.",
    },
    constraints: {
      hard: [preference(frame, "hard")],
      soft: [preference(dna)],
      optional: [preference(content, "optional")],
      avoid: [preference(search, "avoid")],
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
      componentFamilyPreferences: [preference(homepageFamily)],
      meaningfulVariantPreferences: [preference(homepageVariant)],
      sectionCount: {
        key: homepageSectionCount.key,
        dimension: "homepage.section-count" as const,
        minimum: homepageSectionCount.selection.minimum,
        ideal: homepageSectionCount.selection.minimum,
        maximum: homepageSectionCount.selection.maximum,
      },
      sectionRhythmPreferences: [preference(rhythm)],
      evidenceDependentOmission: "omit" as const,
      approvedAssetRolePreferences: homepageAssetRole ? [preference(homepageAssetRole)] : [],
    },
    collectionSearch: {
      archetypePreferences: [preference(collection)],
      discoveryPreferences: [preference(discovery)],
      densityPreferences: [preference(collectionDensity)],
      filterSortPreferences: [preference(filterSort)],
      childCollectionPreferences: [preference(childCollection)],
      merchandisingPreferences: [preference(merchandising)],
      productCardPreferences: [preference(collectionCard)],
      searchRelationshipPreferences: [preference(search, "avoid")],
      searchExecutionExpectation: "registered-presentation-fail-closed-runtime" as const,
    },
    productDetail: {
      standardSimplePreferences: [preference(pdpStandard)],
      configurablePreferences: [preference(pdpConfigurable)],
      galleryLedPreferences: [preference(pdpGallery)],
      highConsiderationPreferences: [preference(pdpHighConsideration)],
      genericFallbackPreferences: [preference(pdpFallback)],
      productTypeIntentions: [
        { productTypeKey: productType.key, preferences: [preference(pdpStandard)] },
      ],
      optionComplexityPreferences: [preference(option)],
      mediaPreferences: [preference(pdpMedia)],
      purchaseDecisionHierarchyPreferences: [preference(purchase)],
      relatedMerchandisingPreferences: [preference(related)],
      productCardPreferences: [preference(pdpCard)],
    },
    contentSupport: {
      pageFamilyPreferences: [preference(content, "optional")],
      narrativePurposePreferences: [preference(contentPurpose, "optional")],
      evidenceRequirements: [{ key: content.key, dimension: content.dimension }],
      safeOmissionBehavior: "omit" as const,
    },
    components: {
      familyPreferences: [preference(componentFamily)],
      meaningfulVariantPreferences: [preference(componentVariant)],
      boundedParameterPreferences: [
        {
          key: parameter.key,
          dimension: "component.bounded-parameter" as const,
          semantics: "soft" as const,
          rank: 1,
          value: parameterValue,
        },
      ],
    },
    responsiveArtDirection: {
      responsivePosturePreferences: [preference(responsive)],
      mobileHierarchyPreferences: [preference(mobile)],
      densityTransformationPreferences: [preference(responsiveDensity)],
      desktopNarrativePriority: [{ key: role.key, dimension: role.dimension }],
      mobileNarrativePriority: [{ key: role.key, dimension: role.dimension }],
      imagePosturePreferences: [preference(image)],
      cropFocalPreferences: [preference(crop)],
      overlayPreferences: [preference(overlay)],
      approvedMediaRolePreferences: [],
    },
  };
  return intent;
}

function validate(
  created: ReturnType<typeof createPromptedStorefrontDesignRequestV2>,
  intent: unknown,
) {
  return validatePromptedStorefrontDesignIntentV2({
    request: created.request,
    capabilityAuthority: created.capabilityAuthority,
    currentAuthority: created.request.currentAuthority,
    intent,
  });
}

describe("P10B-16P-02A prompted storefront design intent", () => {
  it("preserves the exact arbitrary prompt and creates a compact deterministic authority request", () => {
    const input = approvedRequestInput();
    const before = canonicalValueString(input.draft);
    const first = createPromptedStorefrontDesignRequestV2(input);
    const reordered = createPromptedStorefrontDesignRequestV2({
      ...input,
      catalogue: {
        ...input.catalogue,
        products: [...input.catalogue.products].reverse(),
        collections: [...input.catalogue.collections].reverse(),
      },
    });

    expect(first.request.merchantPrompt).toBe(input.merchantPrompt);
    expect(first.request.promptFingerprint).toBe(reordered.request.promptFingerprint);
    expect(first.request.requestFingerprint).toBe(reordered.request.requestFingerprint);
    expect(first.request.capabilityProjection.fingerprint).toBe(
      reordered.request.capabilityProjection.fingerprint,
    );
    expect(first.request.catalogueCharacteristics.productCount).toBe(
      input.catalogue.products.length,
    );
    expect(first.request.catalogueCharacteristics.collectionCount).toBe(
      input.catalogue.collections.length,
    );
    expect(first.request.catalogueCharacteristics.productTypes.length).toBeLessThanOrEqual(32);
    expect(first.request.catalogueCharacteristics.productTypes.length).toBeLessThan(
      input.catalogue.products.length,
    );
    const advertisedProductTypeKeys = new Set(
      first.request.capabilityProjection.capabilities
        .filter(({ dimension }) => dimension === "pdp.product-type")
        .map(({ key }) => key),
    );
    expect(
      first.request.catalogueCharacteristics.productTypes.every(({ productTypeKey }) =>
        advertisedProductTypeKeys.has(productTypeKey),
      ),
    ).toBe(true);
    expect(first.request.capabilityProjection.search).toEqual({
      registration: "registered-presentation-authority",
      execution: "unavailable",
      behavior: "fail-closed",
      reason: "missing-canonical-search-results-adapter",
    });
    expect(
      first.request.capabilityProjection.capabilities.some(
        ({ dimension }) => dimension === "collection-search.archetype",
      ),
    ).toBe(true);
    expect(
      first.request.capabilityProjection.capabilities.some(
        ({ dimension }) => dimension === "pdp.archetype",
      ),
    ).toBe(true);
    const serialized = JSON.stringify(first.request);
    expect(serialized).not.toContain("private-merchant.example");
    expect(serialized).not.toContain("Private evidence body");
    expect(serialized).not.toContain(input.catalogue.products[0]?.id);
    expect(serialized).not.toContain(input.catalogue.collections[0]?.id);
    expect(serialized).not.toMatch(/"(?:price|stock|sku|productIds|images)"\s*:/i);
    expect(canonicalValueString(input.draft)).toBe(before);
  });

  it("keeps content/support profile authority exact to the approved fact family", () => {
    const input = approvedRequestInput();
    const shippingFact = createContentSupportFactDocument({
      evidence: {
        source: "approved-source-evidence",
        authorityId: "evidence_prompted_v2_shipping",
        revision: "1",
        status: "approved",
        approvalAuthorityId: input.approvedBrief.id,
        approvalFingerprint: input.approvedBrief.approvedEvidenceFingerprint!,
      },
      payload: {
        familyId: "shipping-information",
        title: { en: "Shipping", fi: "Toimitus" },
        blocks: [
          {
            kind: "policy-section",
            id: "shipping-details",
            heading: { en: "Approved shipping details", fi: "Hyväksytyt toimitustiedot" },
            body: {
              en: "Shipping information comes from approved merchant evidence.",
              fi: "Toimitustiedot perustuvat kauppiaan hyväksymään aineistoon.",
            },
          },
        ],
      },
    });
    const created = createPromptedStorefrontDesignRequestV2({
      ...input,
      draft: {
        ...input.draft,
        contentSupportFactDocuments: [shippingFact],
      },
    });
    const byKey = new Map(
      created.request.capabilityProjection.capabilities.map((entry) => [entry.key, entry]),
    );

    expect(
      byKey.get("content-support.profile.content-service-details.shipping-information"),
    ).toMatchObject({
      contexts: ["shipping-information"],
      availability: "registered-fail-closed",
    });
    expect(
      byKey.get("content-support.profile.content-service-details.returns-information"),
    ).toMatchObject({
      contexts: ["returns-information"],
      availability: "registered-fail-closed",
    });
  });

  it("advertises every registered collection and PDP PageBlueprint independently of current route selection", () => {
    const created = createPromptedStorefrontDesignRequestV2(approvedRequestInput());
    const projected = created.request.capabilityProjection.capabilities;
    const collectionProfiles = projected.filter(
      ({ dimension, key }) =>
        dimension === "collection-search.archetype" &&
        key.startsWith("collection-search.archetype.profile."),
    );
    const pdpProfiles = projected.filter(
      ({ dimension, key }) =>
        dimension === "pdp.archetype" && key.startsWith("pdp.archetype.profile."),
    );

    expect(collectionProfiles.map(({ contexts }) => contexts[1]).sort()).toEqual([
      "collection-campaign-led-discovery",
      "collection-catalogue-comparison",
      "collection-dense-search",
      "collection-editorial-discovery",
    ]);
    expect(pdpProfiles.map(({ contexts }) => contexts[1]).sort()).toEqual([
      "pdp-gallery-led",
      "pdp-high-consideration",
      "pdp-standard-commerce",
      "pdp-variant-led",
    ]);
    expect(
      collectionProfiles.find(
        ({ contexts }) => contexts[1] === "collection-campaign-led-discovery",
      ),
    ).toMatchObject({ availability: "evidence-dependent" });
    expect(
      collectionProfiles
        .filter(({ contexts }) => contexts[1] !== "collection-campaign-led-discovery")
        .every(({ availability }) => availability === "available"),
    ).toBe(true);
    expect(pdpProfiles.every(({ availability }) => availability === "available")).toBe(true);
    expect(
      projected.some(
        ({ dimension, key }) => dimension === "pdp.archetype" && key.includes(".generic-fallback."),
      ),
    ).toBe(true);
    for (const entry of [...collectionProfiles, ...pdpProfiles]) {
      expect(created.capabilityAuthority.referencesByPreferenceKey.get(entry.key)).toMatchObject({
        authorityKind: "page-blueprint",
      });
    }
  });

  it("keeps optional homepage roles exact to their materialized slot evidence", () => {
    const created = createPromptedStorefrontDesignRequestV2(approvedRequestInput());
    const availableProfileIds = new Set(
      created.request.capabilityProjection.capabilities
        .filter(
          ({ dimension, availability }) =>
            dimension === "homepage.profile" && availability === "available",
        )
        .map(({ key }) => key.slice("homepage.profile.".length)),
    );
    const evidenceDependentRole = created.request.capabilityProjection.capabilities.find(
      (entry) =>
        entry.dimension === "homepage.narrative-role" &&
        entry.availability === "evidence-dependent" &&
        entry.contexts.length === 3 &&
        availableProfileIds.has(entry.contexts[1]),
    );
    if (!evidenceDependentRole) {
      throw new Error("Missing an evidence-dependent role in an otherwise available homepage.");
    }
    const profileId = evidenceDependentRole.contexts[1];
    expect(
      created.request.capabilityProjection.capabilities.find(
        ({ key }) => key === `homepage.profile.${profileId}`,
      ),
    ).toMatchObject({ availability: "available" });

    const candidate = validIntent(created);
    candidate.homepage.requiredRoles = [
      { key: evidenceDependentRole.key, dimension: evidenceDependentRole.dimension },
    ];
    expect(() => validate(created, candidate)).toThrow(
      expect.objectContaining({ code: "unavailable-capability" }),
    );
  });

  it("uses the approved merchant description as the exact homepage evidence authority without source evidence", () => {
    const created = createPromptedStorefrontDesignRequestV2(
      approvedRequestInput("Use the approved merchant description.", {
        omitSourceEvidence: true,
      }),
    );

    expect(created.request.evidenceAndAssets.approvedEvidenceFamilies).not.toContain(
      "approved.source-evidence",
    );
    expect(
      created.request.capabilityProjection.capabilities.find(
        ({ key }) =>
          key === "homepage.narrative-role.homepage-editorial-storytelling.brand-story.brand-story",
      ),
    ).toMatchObject({ availability: "available" });
  });

  it("shares the planner's both-resource commerce predicate for homepage authority", () => {
    expect(
      resolveCommercialHomepageEvidenceAvailability({
        canonicalProductCount: 4,
        canonicalCollectionCount: 0,
        merchantDescription: "Approved merchant description",
        briefApprovalStatus: "approved",
        approvedEvidenceFingerprint: "approved-evidence-current",
      }),
    ).toMatchObject({
      canonicalCommerce: false,
      approvedMerchantEvidence: true,
    });
  });

  it("marks content-cardinality-dependent homepage profiles unavailable for an empty catalogue", () => {
    const input = emptyCatalogueRequestInput();
    const created = createPromptedStorefrontCapabilityAuthority(input);

    expect(
      created.projection.capabilities.find(
        ({ key }) => key === "homepage.profile.homepage-editorial-storytelling",
      ),
    ).toMatchObject({
      availability: "evidence-dependent",
      requirements: ["Requires current canonical commerce authority."],
    });
  });

  it("clamps homepage section-count authority to slots includable by current evidence", () => {
    const created = createPromptedStorefrontDesignRequestV2(
      approvedRequestInput("Use only currently supported homepage evidence.", {
        omitSourceEvidence: true,
        emptyMerchantDescription: true,
      }),
    );
    const sectionCount = created.request.capabilityProjection.capabilities.find(
      ({ key }) => key === "homepage.section-count.homepage-editorial-storytelling",
    );

    expect(sectionCount).toMatchObject({
      availability: "available",
      selection: { kind: "number", minimum: 3, maximum: 3 },
    });
  });

  it("does not infer safe-area authority from an approved responsive focal crop", () => {
    const created = createPromptedStorefrontDesignRequestV2(
      approvedRequestInput("Use the approved editorial crop.", { approvedResponsiveCrop: true }),
    );
    const byKey = new Map(
      created.request.capabilityProjection.capabilities.map((entry) => [entry.key, entry]),
    );

    expect(byKey.get("responsive.crop.approved-responsive-focal-treatment")).toMatchObject({
      availability: "evidence-dependent",
      requirements: [
        "Approved focal or responsive-crop evidence exists, but exact asset, placement, and presentation authority must be bound before selection.",
      ],
    });
    expect(byKey.get("responsive.crop.safe-area.unavailable")).toMatchObject({
      availability: "unavailable",
    });
  });

  it("projects approved homepage asset roles from reachable components without exposing asset identity or product media", () => {
    const created = createPromptedStorefrontDesignRequestV2(
      approvedRequestInput("Use the approved editorial imagery.", {
        approvedResponsiveCrop: true,
      }),
    );
    const homepageAssetRoles = created.request.capabilityProjection.capabilities.filter(
      ({ dimension }) => dimension === "homepage.asset-role",
    );
    const availableEditorialRole = homepageAssetRoles.find(
      ({ key, availability }) => key.endsWith(".editorialImage") && availability === "available",
    );

    expect(homepageAssetRoles.length).toBeGreaterThan(0);
    expect(availableEditorialRole).toBeDefined();
    expect(
      homepageAssetRoles.every(
        ({ key }) =>
          !key.endsWith(".productMainImage") && !key.endsWith(".productAlternativeImage"),
      ),
    ).toBe(true);
    expect(
      homepageAssetRoles.every(({ key }) =>
        created.capabilityAuthority.referencesByPreferenceKey.has(key),
      ),
    ).toBe(true);
    expect(JSON.stringify(created.request)).not.toContain("asset_prompted_v2_editorial");

    const intent = validIntent(created);
    expect(intent.homepage.approvedAssetRolePreferences).toHaveLength(1);
    expect(intent.homepage.approvedAssetRolePreferences[0]?.key).toContain("homepage.asset-role.");
    expect(intent.homepage.approvedAssetRolePreferences[0]?.dimension).toBe("homepage.asset-role");
    expect(validate(created, intent).homepage.approvedAssetRolePreferences).toHaveLength(1);
  });

  it("does not satisfy exact homepage media evidence with an unrelated approved logo", () => {
    const created = createPromptedStorefrontDesignRequestV2(
      approvedRequestInput("Keep the logo and use a campaign composition.", {
        approvedLogoOnly: true,
      }),
    );

    expect(
      created.request.capabilityProjection.capabilities.find(
        ({ key }) => key === "homepage.profile.homepage-campaign-led",
      ),
    ).toMatchObject({
      availability: "evidence-dependent",
      requirements: ["Requires current approved media authority."],
    });
  });

  it("fails closed when dynamic profile, component schema, or bounded parameters are stale", () => {
    const input = approvedRequestInput();
    const staleDrafts = [
      withCollectionArchetype(input.draft, (archetype) => ({
        ...archetype,
        profile: { ...archetype.profile, fingerprint: "page-blueprint-stale-authority" },
      })),
      withCollectionArchetype(input.draft, (archetype) => ({
        ...archetype,
        componentPresentations: archetype.componentPresentations.map((presentation, index) =>
          index === 0
            ? { ...presentation, content: { ...presentation.content, invented: "not registered" } }
            : presentation,
        ),
      })),
      withCollectionArchetype(input.draft, (archetype) => ({
        ...archetype,
        componentPresentations: archetype.componentPresentations.map((presentation, index) =>
          index === 0
            ? {
                ...presentation,
                boundedParameters: { ...presentation.boundedParameters, density: "compact" },
              }
            : presentation,
        ),
      })),
    ];

    staleDrafts.forEach((draft) => {
      expect(() => createPromptedStorefrontDesignRequestV2({ ...input, draft })).toThrow(
        expect.objectContaining({ code: "stale-authority" }),
      );
    });
  });

  it("validates hard, ranked soft, optional and avoid semantics across every design area", () => {
    const created = createPromptedStorefrontDesignRequestV2(approvedRequestInput());
    const result = validate(created, validIntent(created));

    expect(result.constraints).toMatchObject({
      hard: [{ semantics: "hard", rank: null }],
      soft: [{ semantics: "soft", rank: 1 }],
      optional: [{ semantics: "optional", rank: null }],
      avoid: [{ semantics: "avoid", rank: null }],
    });
    expect(result.designDna.preferences).toHaveLength(1);
    expect(result.sharedFrame.preferences).toHaveLength(1);
    expect(result.homepage.profilePreferences).toHaveLength(1);
    expect(result.collectionSearch.archetypePreferences).toHaveLength(1);
    expect(result.productDetail.productTypeIntentions).toHaveLength(1);
    expect(result.components.boundedParameterPreferences).toHaveLength(1);
    expect(result.responsiveArtDirection.responsivePosturePreferences).toHaveLength(1);
    expect(result).not.toHaveProperty("executableIntentId");
    expect(result).not.toHaveProperty("pages");
    expect(result).not.toHaveProperty("proposal");
    expect(result.intentFingerprint).toMatch(/^prompted-storefront-design-intent-/);
  });

  it("rejects a registered PDP archetype when it is used in the wrong presentation field", () => {
    const created = createPromptedStorefrontDesignRequestV2(approvedRequestInput());
    const candidate = validIntent(created);
    candidate.productDetail.standardSimplePreferences =
      candidate.productDetail.galleryLedPreferences;

    expect(() => validate(created, candidate)).toThrow(
      expect.objectContaining({ code: "wrong-capability-dimension" }),
    );
  });

  it("allows presentation-oriented material language without a commerce fact claim", () => {
    const created = createPromptedStorefrontDesignRequestV2(approvedRequestInput());
    const candidate = validIntent(created);
    candidate.concept.summary = "A calm editorial experience crafted with warm gold accents.";

    expect(() => validate(created, candidate)).not.toThrow();
  });

  it("fails closed for unknown, wrong-dimension, unavailable, product-type, route and code output", () => {
    const created = createPromptedStorefrontDesignRequestV2(approvedRequestInput());
    const base = validIntent(created);
    const dna = base.designDna.preferences[0];
    const unavailable = capability(
      created,
      "component.bounded-parameter",
      "registered-fail-closed",
    );
    const cases: readonly [unknown, PromptedStorefrontDesignIntentError["code"]][] = [
      [
        {
          ...base,
          designDna: { preferences: [{ ...dna, key: "dna.invented.capability" }] },
        },
        "unknown-capability",
      ],
      [
        {
          ...base,
          designDna: { preferences: [{ ...dna, dimension: "shared-frame.profile" }] },
        },
        "wrong-capability-dimension",
      ],
      [
        {
          ...base,
          homepage: {
            ...base.homepage,
            approvedAssetRolePreferences: [dna],
          },
        },
        "wrong-capability-dimension",
      ],
      [
        {
          ...base,
          constraints: {
            ...base.constraints,
            hard: [preference(unavailable, "hard")],
            avoid: [],
          },
          collectionSearch: {
            ...base.collectionSearch,
            searchRelationshipPreferences: [],
          },
        },
        "unavailable-capability",
      ],
      [
        {
          ...base,
          productDetail: {
            ...base.productDetail,
            productTypeIntentions: [
              {
                productTypeKey: "pdp.product-type.product_concrete_123",
                preferences: base.productDetail.standardSimplePreferences,
              },
            ],
          },
        },
        "unknown-product-type",
      ],
      [
        {
          ...base,
          concept: { ...base.concept, summary: "Feature /collections/private-selection." },
        },
        "route-instance-reference",
      ],
      [
        {
          ...base,
          concept: { ...base.concept, summary: "Send customers to /search." },
        },
        "route-instance-reference",
      ],
      [
        {
          ...base,
          concept: { ...base.concept, summary: ".hero { display: none; }" },
        },
        "executable-content",
      ],
      [
        {
          ...base,
          concept: { ...base.concept, summary: "Read document.cookie and fetch('/private')." },
        },
        "executable-content",
      ],
      [
        {
          ...base,
          concept: { ...base.concept, summary: "```sh\ncurl https://private.example\n```" },
        },
        "executable-content",
      ],
      [
        {
          ...base,
          concept: {
            ...base.concept,
            summary: "const token = 1; console.log(token);",
          },
        },
        "executable-content",
      ],
      [
        {
          ...base,
          concept: { ...base.concept, summary: "alert(1)" },
        },
        "executable-content",
      ],
      [
        {
          ...base,
          concept: {
            ...base.concept,
            summary: "All products are €99, in stock, and include guaranteed delivery.",
          },
        },
        "protected-content",
      ],
      [
        {
          ...base,
          concept: { ...base.concept, summary: "Use asset:private_hero_123." },
        },
        "protected-content",
      ],
      [
        {
          ...base,
          concept: {
            ...base.concept,
            summary: "Everything is 20% off and comes with a two-year warranty.",
          },
        },
        "protected-content",
      ],
      [
        {
          ...base,
          concept: {
            ...base.concept,
            summary: "Prioritize SKU ABC-123; all products are ready to ship and half price.",
          },
        },
        "protected-content",
      ],
      [
        {
          ...base,
          concept: {
            ...base.concept,
            summary: "Every ring is made from solid gold.",
          },
        },
        "protected-content",
      ],
      [
        {
          ...base,
          concept: {
            ...base.concept,
            summary: "Our rings are made from solid gold for lasting wear.",
          },
        },
        "protected-content",
      ],
      [
        {
          ...base,
          concept: {
            ...base.concept,
            summary: "Products cost 99 euros and ship in two days.",
          },
        },
        "protected-content",
      ],
      [
        {
          ...base,
          concept: {
            ...base.concept,
            summary: "Kaikki tuotteet maksavat 99 euroa ja toimitetaan kahdessa päivässä.",
          },
        },
        "protected-content",
      ],
      [
        {
          ...base,
          concept: {
            ...base.concept,
            summary: "Tilaukset toimitetaan kahdessa päivässä.",
          },
        },
        "protected-content",
      ],
      [{ ...base, invented: "not allowed" }, "strict-schema-invalid"],
      [
        { ...base, requestFingerprint: "prompted-storefront-request-stale" },
        "request-fingerprint-mismatch",
      ],
    ];
    for (const [candidate, code] of cases) {
      expect(() => validate(created, candidate)).toThrow(expect.objectContaining({ code }));
    }
  });

  it("computes the intent fingerprint from every material preference and rejects stale authority", () => {
    const created = createPromptedStorefrontDesignRequestV2(approvedRequestInput());
    const first = validate(created, validIntent(created));
    const changedInput = validIntent(created);
    changedInput.concept.summary = "A materially different restrained technical concept.";
    const changed = validate(created, changedInput);
    expect(changed.intentFingerprint).not.toBe(first.intentFingerprint);

    expect(() =>
      validatePromptedStorefrontDesignIntentV2({
        request: created.request,
        capabilityAuthority: created.capabilityAuthority,
        currentAuthority: {
          ...created.request.currentAuthority,
          draftRevision: created.request.currentAuthority.draftRevision + 1,
        },
        intent: validIntent(created),
      }),
    ).toThrow(expect.objectContaining({ code: "stale-authority" }));
  });

  it("returns typed failures for invalid request input", () => {
    const input = approvedRequestInput();
    expect(() =>
      createPromptedStorefrontDesignRequestV2({ ...input, merchantPrompt: "   " }),
    ).toThrow(expect.objectContaining({ code: "invalid-request" }));
    expect(() =>
      createPromptedStorefrontDesignRequestV2({
        ...input,
        priorDiversityEvidence: {
          recentAcceptedStructuralFingerprints: [],
          recentRejectedStructuralFingerprints: [],
          recentlyUsedPostureKeys: [],
          merchantAvoidancePreferenceKeys: ["unknown.capability"],
        },
      }),
    ).toThrow(expect.objectContaining({ code: "unknown-capability" }));
    expect(() =>
      createPromptedStorefrontDesignRequestV2({
        ...input,
        priorDiversityEvidence: {
          recentAcceptedStructuralFingerprints: Array.from(
            { length: 21 },
            (_, index) => `fingerprint-${index}`,
          ),
          recentRejectedStructuralFingerprints: [],
          recentlyUsedPostureKeys: [],
          merchantAvoidancePreferenceKeys: [],
        },
      }),
    ).toThrow(expect.objectContaining({ code: "invalid-request" }));
  });
});
