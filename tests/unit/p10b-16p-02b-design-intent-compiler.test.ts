import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  listCompatibleCoordinatedDirectionSelectionNarrowings,
  type CompatibleCoordinatedDirectionNarrowingInput,
} from "@/application/bounded-storefront-synthesis";
import {
  compilePromptedStorefrontDesignIntentV2,
  executeCompiledPromptedStorefrontDesignDecisionV2,
  runPromptedStorefrontDesignCompilation,
  type PromptedStorefrontDesignCompilerError,
} from "@/application/prompted-storefront-design-compiler";
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
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { canonicalValueString } from "@/domain/storefront";
import { WholeStorefrontProposalAcceptanceCoordinator } from "@/application/whole-storefront-proposal-lifecycle";

type Preference = PromptedStorefrontDesignIntentV2["designDna"]["preferences"][number];

function currentCompilerAuthority() {
  const source = createP10B14PremiumEditorialFixture();
  const migrated = migrateLegacyDynamicCommerceRoutes(
    source.slice.snapshot,
    source.fixture.planningInput.catalogue,
  );
  if (migrated.status === "requires-decision") {
    throw new Error(`Dynamic migration fixture failed: ${migrated.decisions[0]?.code}`);
  }
  const draft = migrated.snapshot;
  const merchantPrompt = "Build a warm editorial storefront with clear product discovery.";
  const currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input = {
    merchantPrompt,
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
  const compatible = listCompatibleCoordinatedDirectionSelectionNarrowings(compatibilityInput);
  if (compatible.length === 0) throw new Error("Missing compatible compiler fixture narrowing.");
  return { source, currentRequestInput, compatibilityInput, requestAuthority, seed: compatible[0] };
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

function providerIntent(
  fixture: ReturnType<typeof currentCompilerAuthority>,
): PromptedStorefrontDesignIntentV2 {
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
  if (!plan?.profile || !plan.slots[0]) throw new Error("Missing selected homepage profile.");
  const profile = plan.profile;
  const firstSlot = plan.slots[0];
  const role = entryByReference(
    authority,
    (reference) =>
      reference?.authorityKind === "page-blueprint" &&
      reference.authorityId === `${profile.id}@${profile.version}:${firstSlot.id}`,
    "homepage.narrative-role",
  );
  const dna = available(authority, "design-dna.typography-pairing");
  const standard = entryByReference(
    authority,
    (reference) => reference?.intentRoles?.includes("pdp-standard-simple") === true,
    "pdp.archetype",
  );
  const configurable = entryByReference(
    authority,
    (reference) => reference?.intentRoles?.includes("pdp-configurable") === true,
    "pdp.archetype",
  );
  const gallery = entryByReference(
    authority,
    (reference) => reference?.intentRoles?.includes("pdp-gallery-led") === true,
    "pdp.archetype",
  );
  const high = entryByReference(
    authority,
    (reference) => reference?.intentRoles?.includes("pdp-high-consideration") === true,
    "pdp.archetype",
  );
  const fallback = entryByReference(
    authority,
    (reference) => reference?.intentRoles?.includes("pdp-generic-fallback") === true,
    "pdp.archetype",
  );
  const search = authority.projection.capabilities.find(
    ({ dimension }) => dimension === "collection-search.search-relationship",
  )!;
  const parameter = authority.projection.capabilities.find(
    ({ key, availability }) =>
      key === "component.bounded-parameter.homepageHero.contentAlignment" &&
      availability === "available",
  );
  const homepageVariant = plan.profile.componentSelections
    .flatMap((selection) =>
      selection.variants
        .filter((variant) => variant !== selection.defaultVariant)
        .map((variant) => ({ selection, variant })),
    )
    .map(({ selection, variant }) =>
      authority.projection.capabilities.find(
        ({ dimension, key, availability }) =>
          dimension === "homepage.meaningful-variant" &&
          key.endsWith(`.${selection.component}.${variant}`) &&
          availability === "available",
      ),
    )
    .find(Boolean);
  const productType = available(authority, "pdp.product-type");
  const sectionCount = authority.projection.capabilities.find(
    ({ key }) => key === `homepage.section-count.${fixture.seed.homepageProfileId}`,
  );
  if (!sectionCount || sectionCount.selection.kind !== "number") {
    throw new Error("Missing exact homepage section count.");
  }
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
      componentFamilyPreferences: [preference(available(authority, "homepage.component-family"))],
      meaningfulVariantPreferences: homepageVariant ? [preference(homepageVariant)] : [],
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
      searchRelationshipPreferences: [preference(search, "avoid")],
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
      boundedParameterPreferences: parameter
        ? [
            {
              ...preference(parameter),
              dimension: "component.bounded-parameter" as const,
              value: "center",
            },
          ]
        : [],
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

describe("P10B-16P-02B deterministic design intent compiler", () => {
  let sharedFixture: ReturnType<typeof currentCompilerAuthority>;
  let sharedIntent: PromptedStorefrontDesignIntentV2;

  beforeAll(() => {
    sharedFixture = currentCompilerAuthority();
    sharedIntent = providerIntent(sharedFixture);
  });

  it("refreshes exact authority and compiles one deterministic metadata-only decision", () => {
    const fixture = sharedFixture;
    const intent = sharedIntent;
    const draftBefore = canonicalValueString(fixture.currentRequestInput.draft);
    const compile = () =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: intent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      });

    const first = compile();
    const second = compile();

    expect(second).toEqual(first);
    expect(first.contractVersion).toBe("2.0.0");
    expect(first.identity.providerIntentFingerprint).toBe(intent.intentFingerprint);
    expect(first.pageBlueprintSelectionOverrides).toHaveLength(1);
    expect(first.pageBlueprintSelectionOverrides[0]?.pageType).toBe("home");
    expect(first.dynamicCommerceSelection.productTypeMappings.length).toBeGreaterThan(0);
    expect(first.dynamicCommerceSelection.searchExecution).toBe(
      "registered-presentation-fail-closed-runtime",
    );
    expect(first.diagnostics.some(({ outcome }) => outcome === "accepted")).toBe(true);
    expect(first.diagnostics.some(({ outcome }) => outcome === "defaulted")).toBe(true);
    expect(first.exactAuthorityFingerprints).toEqual([...first.exactAuthorityFingerprints].sort());
    expect(JSON.stringify(first)).not.toMatch(/proposal|snapshot\s*:/i);
    expect(canonicalValueString(fixture.currentRequestInput.draft)).toBe(draftBefore);
  });

  it("fails closed for contradictory hard frame authority and a bounded candidate budget", () => {
    const fixture = sharedFixture;
    const intent = sharedIntent;
    const otherFrame = fixture.requestAuthority.request.capabilityProjection.capabilities.find(
      ({ dimension, availability, key }) =>
        dimension === "shared-frame.profile" &&
        availability === "available" &&
        key !== intent.sharedFrame.preferences[0].key,
    )!;
    const { intentFingerprint: _intentFingerprint, ...intentMaterial } = intent;
    void _intentFingerprint;
    const contradictoryMaterial = {
      ...intentMaterial,
      sharedFrame: {
        preferences: [...intent.sharedFrame.preferences, preference(otherFrame, "hard")],
      },
    };
    const contradictory = {
      ...contradictoryMaterial,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(contradictoryMaterial),
    };
    const compile = (providerIntent: PromptedStorefrontDesignIntentV2, maximum?: number) =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
        ...(maximum === undefined ? {} : { maximumCandidateEvaluations: maximum }),
      });

    expect(() => compile(contradictory)).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "no-compatible-selection",
      }),
    );
    expect(() => compile(intent, 1)).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "candidate-budget-exceeded",
      }),
    );
  });

  it("rejects stale authority and insufficient materially available core intent", () => {
    const fixture = sharedFixture;
    const intent = sharedIntent;
    expect(() =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: intent,
        currentRequestInput: {
          ...fixture.currentRequestInput,
          project: {
            ...fixture.currentRequestInput.project,
            revision: fixture.currentRequestInput.project.revision + 1,
          },
        },
        compatibilityInput: fixture.compatibilityInput,
      }),
    ).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "stale-authority",
      }),
    );

    const failClosedDna = fixture.requestAuthority.request.capabilityProjection.capabilities.find(
      ({ dimension, availability }) =>
        dimension.startsWith("design-dna.") && availability === "registered-fail-closed",
    )!;
    const { intentFingerprint: _intentFingerprint, ...intentMaterial } = intent;
    void _intentFingerprint;
    const insufficientMaterial = {
      ...intentMaterial,
      designDna: { preferences: [preference(failClosedDna)] },
    };
    const insufficient = {
      ...insufficientMaterial,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(insufficientMaterial),
    };
    expect(() =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: insufficient,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      }),
    ).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "insufficient-material-intent",
      }),
    );
  });

  it("consumes the exact compiled decision once through synthesis and an isolated proposal", () => {
    const fixture = sharedFixture;
    const intent = sharedIntent;
    const compiledDecision = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const draftBefore = canonicalValueString(fixture.currentRequestInput.draft);
    const result = executeCompiledPromptedStorefrontDesignDecisionV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      compiledDecision,
      pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
      contentFactAuthority: fixture.source.contentFactAuthority,
      approvedAssetPresentations: fixture.source.fixture.assetPresentations,
    });

    expect(result.synthesisDecision.pageBlueprintSelectionOverrides).toEqual(
      compiledDecision.pageBlueprintSelectionOverrides,
    );
    expect(result.synthesisDecision.dynamicCommerceSelection).toEqual({
      authorityFingerprint: compiledDecision.dynamicCommerceSelection.authorityFingerprint,
      collectionArchetypeId: compiledDecision.dynamicCommerceSelection.collectionArchetypeId,
      searchArchetypeId: compiledDecision.dynamicCommerceSelection.searchArchetypeId,
      standardSimpleArchetypeId:
        compiledDecision.dynamicCommerceSelection.standardSimpleArchetypeId,
      configurableArchetypeId: compiledDecision.dynamicCommerceSelection.configurableArchetypeId,
      galleryLedArchetypeId: compiledDecision.dynamicCommerceSelection.galleryLedArchetypeId,
      highConsiderationArchetypeId:
        compiledDecision.dynamicCommerceSelection.highConsiderationArchetypeId,
      genericFallbackArchetypeId:
        compiledDecision.dynamicCommerceSelection.genericFallbackArchetypeId,
      productTypeMappings: Object.fromEntries(
        compiledDecision.dynamicCommerceSelection.productTypeMappings.map(
          ({ productTypeId, archetypeId }) => [productTypeId, archetypeId],
        ),
      ),
    });
    expect(result.synthesis.materialization.proposal.status).toBe("pending");
    expect(
      result.synthesis.materialization.proposal.operations.some(
        ({ operation }) => operation.type === "APPLY_DYNAMIC_COMMERCE_PRESENTATION",
      ),
    ).toBe(true);
    expect(result.synthesis.materialization.snapshot.dynamicCommercePresentation).toEqual(
      result.synthesis.materialization.proposal.proposedStorefront.dynamicCommercePresentation,
    );
    const authorityInput = {
      plan: result.synthesis.materialization.plan,
      planningInput: result.synthesis.materialization.planningInput,
    };
    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal: result.synthesis.materialization.proposal,
      currentInput: () => authorityInput,
    });
    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    expect(coordinator.undo()).toEqual(
      result.synthesis.materialization.proposal.originalStorefront,
    );
    expect(coordinator.redo()).toEqual(
      result.synthesis.materialization.proposal.proposedStorefront,
    );
    expect(canonicalValueString(fixture.currentRequestInput.draft)).toBe(draftBefore);
  });

  it("fails atomically when the transient compiled decision is tampered", () => {
    const fixture = sharedFixture;
    const intent = sharedIntent;
    const compiledDecision = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const draftBefore = canonicalValueString(fixture.currentRequestInput.draft);

    expect(() =>
      executeCompiledPromptedStorefrontDesignDecisionV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: intent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
        compiledDecision: {
          ...compiledDecision,
          structuralFingerprint: "tampered-structural-fingerprint",
        },
        pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
        contentFactAuthority: fixture.source.contentFactAuthority,
        approvedAssetPresentations: fixture.source.fixture.assetPresentations,
      }),
    ).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "invalid-input",
      }),
    );
    expect(canonicalValueString(fixture.currentRequestInput.draft)).toBe(draftBefore);
  });

  it("calls an injected provider once, refreshes authority, and materializes exactly one isolated storefront", async () => {
    const fixture = sharedFixture;
    const intent = sharedIntent;
    const authority = {
      requestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
      contentFactAuthority: fixture.source.contentFactAuthority,
      approvedAssetPresentations: fixture.source.fixture.assetPresentations,
    };
    const provider = {
      id: "test-prompted-intent-provider",
      modelId: "test-model",
      createDesignIntent: vi.fn(() => Promise.resolve(intent)),
    };
    const execute = vi.fn(executeCompiledPromptedStorefrontDesignDecisionV2);
    const draftBefore = canonicalValueString(fixture.currentRequestInput.draft);

    const result = await runPromptedStorefrontDesignCompilation({
      provider,
      loadCurrentAuthority: () => authority,
      executeCompiledDecision: execute,
    });

    expect(provider.createDesignIntent).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(result.evidence.materializationCount).toBe(1);
    expect(result.evidence.requestFingerprint).toBe(
      fixture.requestAuthority.request.requestFingerprint,
    );
    expect(result.evidence.providerIntentFingerprint).toBe(intent.intentFingerprint);
    expect(result.evidence.compiledDecisionFingerprint).toBe(
      result.compiledDecision.compiledDecisionFingerprint,
    );
    expect(result.evidence.protectedCommerceBeforeFingerprint).toBe(
      result.evidence.protectedCommerceAfterFingerprint,
    );
    expect(result.evidence.protectedMediaBeforeFingerprint).toBe(
      result.evidence.protectedMediaAfterFingerprint,
    );
    expect(canonicalValueString(fixture.currentRequestInput.draft)).toBe(draftBefore);
    expect(result.execution.synthesis.materialization.proposal.status).toBe("pending");
  });

  it("fails stale post-provider authority before compilation or materialization without retry", async () => {
    const fixture = sharedFixture;
    const intent = sharedIntent;
    const authority = {
      requestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
      contentFactAuthority: fixture.source.contentFactAuthority,
      approvedAssetPresentations: fixture.source.fixture.assetPresentations,
    };
    const provider = {
      id: "test-prompted-intent-provider",
      modelId: "test-model",
      createDesignIntent: vi.fn(() => Promise.resolve(intent)),
    };
    const execute = vi.fn(executeCompiledPromptedStorefrontDesignDecisionV2);
    let loads = 0;

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider,
        loadCurrentAuthority: () => {
          loads += 1;
          return loads === 1
            ? authority
            : {
                ...authority,
                requestInput: {
                  ...authority.requestInput,
                  merchantPrompt: "A changed merchant request after provider response.",
                },
              };
        },
        executeCompiledDecision: execute,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
    expect(provider.createDesignIntent).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
  });

  it("enforces final PDP avoids and selects the highest-ranked aggregate-compatible product-type intent", () => {
    const fixture = sharedFixture;
    const base = sharedIntent;
    const authority = fixture.requestAuthority.capabilityAuthority;
    const standard = entryByReference(
      authority,
      (reference) =>
        reference?.authorityKind === "dynamic-commerce" &&
        reference.intentRoles?.includes("pdp-standard-simple") === true &&
        reference.intentRoles?.includes("pdp-generic-fallback") !== true,
      "pdp.archetype",
    );
    const high = entryByReference(
      authority,
      (reference) =>
        reference?.authorityKind === "dynamic-commerce" &&
        reference.intentRoles?.includes("pdp-high-consideration") === true,
      "pdp.archetype",
    );
    const standardArchetypeId = authority.referencesByPreferenceKey.get(standard.key)!.authorityId;
    const simpleType = fixture.requestAuthority.request.catalogueCharacteristics.productTypes.find(
      ({ productCount, simpleProductCount, mediaDepthRange }) =>
        productCount === simpleProductCount && mediaDepthRange.maximum === 1,
    );
    if (!simpleType) throw new Error("Missing simple single-media product-type fixture.");
    const productTypeEntry = authority.projection.capabilities.find(
      ({ key }) => key === simpleType.productTypeKey,
    );
    if (!productTypeEntry) throw new Error("Missing exact product-type capability.");
    const compile = (intent: PromptedStorefrontDesignIntentV2) =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: intent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      });
    const intentWith = (
      update: (material: Omit<PromptedStorefrontDesignIntentV2, "intentFingerprint">) => void,
    ) => {
      const { intentFingerprint: _fingerprint, ...material } = structuredClone(base);
      void _fingerprint;
      update(material);
      return promptedStorefrontDesignIntentV2Schema.parse({
        ...material,
        intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
      });
    };

    const ranked = compile(
      intentWith((material) => {
        material.productDetail.productTypeIntentions = [
          {
            productTypeKey: productTypeEntry.key,
            preferences: [preference(high, "soft", 1), preference(standard, "soft", 2)],
          },
        ];
      }),
    );
    const productTypeId = authority.referencesByPreferenceKey
      .get(productTypeEntry.key)!
      .authorityId.split(":")[0];
    expect(
      ranked.dynamicCommerceSelection.productTypeMappings.find(
        (mapping) => mapping.productTypeId === productTypeId,
      )?.archetypeId,
    ).toBe(standardArchetypeId);
    expect(
      ranked.diagnostics.find(
        ({ preferencePath }) =>
          preferencePath === "productDetail.productTypeIntentions[0].preferences[0]",
      )?.outcome,
    ).not.toBe("accepted");
    expect(
      ranked.diagnostics.find(
        ({ preferencePath }) =>
          preferencePath === "productDetail.productTypeIntentions[0].preferences[1]",
      )?.outcome,
    ).toBe("accepted");

    expect(() =>
      compile(
        intentWith((material) => {
          material.productDetail.standardSimplePreferences = [preference(standard, "avoid")];
          material.productDetail.productTypeIntentions = [
            {
              productTypeKey: productTypeEntry.key,
              preferences: [preference(standard, "avoid")],
            },
          ];
        }),
      ),
    ).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "no-compatible-selection",
      }),
    );
  });
});
