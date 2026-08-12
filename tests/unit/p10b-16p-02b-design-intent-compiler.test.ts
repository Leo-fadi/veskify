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
  resolvePromptedStorefrontResponsiveVariantContexts,
  resolvePromptedStorefrontExactSlotOverrides,
  type LocatedPreference,
} from "@/application/prompted-storefront-design-compiler/compiler";
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
import {
  getCommercialCollectionSearchProfile,
  getCommercialHomepageProfile,
  resolveCommercialHomepageProfileSlots,
} from "@/application/storefront-templates";
import {
  veskifyComponentCapabilityManifest,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import {
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
} from "@/domain/storefront";
import {
  replayWholeStorefrontProposalOperations,
  WholeStorefrontProposalAcceptanceCoordinator,
} from "@/application/whole-storefront-proposal-lifecycle";

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
    const boundedParameterDefaults = first.diagnostics.filter(
      ({ outcome, preferencePath }) =>
        outcome === "defaulted" &&
        preferencePath.startsWith("defaults.component.bounded-parameter."),
    );
    expect(boundedParameterDefaults.length).toBeGreaterThan(0);
    expect(
      boundedParameterDefaults.every(
        ({ requestedValue, selectedAuthority }) =>
          requestedValue !== null &&
          selectedAuthority?.dimension === "component.bounded-parameter" &&
          selectedAuthority.authorityKind === "component-manifest",
      ),
    ).toBe(true);
    expect(
      first.diagnostics.some(
        ({ outcome, preferenceKey }) =>
          outcome === "defaulted" &&
          preferenceKey === "component.bounded-parameter.homepageHero.contentAlignment",
      ),
    ).toBe(false);
    expect(first.exactAuthorityFingerprints).toEqual([...first.exactAuthorityFingerprints].sort());
    expect(JSON.stringify(first)).not.toMatch(/proposal|snapshot\s*:/i);
    expect(canonicalValueString(fixture.currentRequestInput.draft)).toBe(draftBefore);
  });

  it("keeps route cardinality out of the compiled structural fingerprint", () => {
    const fixture = sharedFixture;
    const baseline = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: sharedIntent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const current = fixture.currentRequestInput.draft.dynamicCommercePresentation;
    if (!current) throw new Error("Missing dynamic-commerce route authority.");
    const retainedSiteMapPageIds = new Set(
      fixture.compatibilityInput.siteMapDecision.pages.flatMap(({ existingPageId }) =>
        existingPageId ? [existingPageId] : [],
      ),
    );
    const removableRoute = current.routeInventory.find(
      ({ id, kind }) => kind === "product" && !retainedSiteMapPageIds.has(id),
    );
    if (!removableRoute) throw new Error("Missing an unreferenced product route fixture.");
    const { authorityFingerprint: _authorityFingerprint, ...authorityMaterial } =
      structuredClone(current);
    void _authorityFingerprint;
    const draft = {
      ...fixture.currentRequestInput.draft,
      navigation: Object.fromEntries(
        Object.entries(fixture.currentRequestInput.draft.navigation).map(([area, items]) => [
          area,
          items.filter(
            ({ target }) =>
              target.type !== "dynamic-commerce-route" || target.routeId !== removableRoute.id,
          ),
        ]),
      ) as typeof fixture.currentRequestInput.draft.navigation,
      dynamicCommercePresentation: createDynamicCommercePresentationAuthority({
        ...authorityMaterial,
        routeInventory: authorityMaterial.routeInventory.filter(
          ({ id }) => id !== removableRoute.id,
        ),
      }),
    };
    const currentRequestInput = { ...fixture.currentRequestInput, draft };
    const currentRequest = createPromptedStorefrontDesignRequestV2(currentRequestInput);
    const { intentFingerprint: _intentFingerprint, ...intentMaterial } = sharedIntent;
    void _intentFingerprint;
    const reboundMaterial = {
      ...intentMaterial,
      requestFingerprint: currentRequest.request.requestFingerprint,
      promptFingerprint: currentRequest.request.promptFingerprint,
    };
    const reboundIntent = promptedStorefrontDesignIntentV2Schema.parse({
      ...reboundMaterial,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(reboundMaterial),
    });
    const changed = compilePromptedStorefrontDesignIntentV2({
      originalRequest: currentRequest.request,
      providerIntent: reboundIntent,
      currentRequestInput,
      compatibilityInput: {
        ...fixture.compatibilityInput,
        planningInput: { ...fixture.compatibilityInput.planningInput, draft },
      },
    });

    expect(changed.dynamicRoutePresentationFingerprint).not.toBe(
      baseline.dynamicRoutePresentationFingerprint,
    );
    expect(changed.structuralFingerprint).toBe(baseline.structuralFingerprint);
  });

  it("resolves independent material axes in one preference list", () => {
    const fixture = sharedFixture;
    const base = sharedIntent;
    const authority = fixture.requestAuthority.capabilityAuthority;
    const baseCompiled = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: base,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const typography = entryByReference(
      authority,
      (reference) =>
        reference?.authorityId ===
        `typography.pairing:${baseCompiled.designDna.value.typography.pairing}`,
      "design-dna.typography-pairing",
    );
    const spacingReference = baseCompiled.diagnostics.find(
      ({ outcome, selectedAuthority }) =>
        outcome === "defaulted" && selectedAuthority?.dimension === "design-dna.spacing",
    )?.selectedAuthority;
    if (!spacingReference) throw new Error("Missing exact compiled spacing default authority.");
    const spacing = authority.projection.capabilities.find(
      ({ key }) => key === spacingReference.key,
    );
    if (!spacing) throw new Error("Missing exact compiled spacing capability.");
    const { intentFingerprint: _fingerprint, ...material } = structuredClone(base);
    void _fingerprint;
    material.designDna.preferences = [
      preference(typography, "soft", 1),
      preference(spacing, "soft", 2),
    ];
    const intent = promptedStorefrontDesignIntentV2Schema.parse({
      ...material,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
    });

    const compiled = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });

    expect(
      compiled.diagnostics.find(
        ({ preferencePath }) => preferencePath === "designDna.preferences[0]",
      )?.outcome,
    ).toBe("accepted");
    expect(
      compiled.diagnostics.find(
        ({ preferencePath }) => preferencePath === "designDna.preferences[1]",
      )?.outcome,
    ).toBe("accepted");
    expect(
      compiled.diagnostics.some(
        ({ outcome, preferenceKey }) => outcome === "defaulted" && preferenceKey === spacing.key,
      ),
    ).toBe(false);
  });

  it("enforces an avoided required utility profile during candidate selection", () => {
    const fixture = sharedFixture;
    const base = sharedIntent;
    const authority = fixture.requestAuthority.capabilityAuthority;
    const compiled = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: base,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const utilityIdentity = compiled.utilityPresentationSelections[0];
    if (!utilityIdentity) throw new Error("Missing required utility selection.");
    const utility = entryByReference(
      authority,
      (reference) =>
        reference?.dimension === "utility.profile" && reference.authorityId === utilityIdentity,
      "utility.profile",
    );
    const { intentFingerprint: _fingerprint, ...material } = structuredClone(base);
    void _fingerprint;
    material.constraints.avoid = [preference(utility, "avoid")];
    const intent = promptedStorefrontDesignIntentV2Schema.parse({
      ...material,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
    });

    expect(() =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: intent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      }),
    ).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "no-compatible-selection",
      }),
    );
  });

  it("accepts and executes an exact current approved content/support profile", () => {
    const fixture = sharedFixture;
    const page = fixture.compatibilityInput.siteMapDecision.pages.find(
      ({ familyId, evidenceReferences }) => familyId === "about" && evidenceReferences.length > 0,
    );
    if (!page) throw new Error("Missing current approved content/support page.");
    const identity = `${page.profile.id}@${page.profile.version}`;
    const contentProfile = entryByReference(
      fixture.requestAuthority.capabilityAuthority,
      (reference) =>
        reference?.dimension === "content-support.profile" &&
        reference.authorityId === `${identity}:${page.familyId}`,
      "content-support.profile",
    );
    const { intentFingerprint: _fingerprint, ...material } = structuredClone(sharedIntent);
    void _fingerprint;
    material.contentSupport.pageFamilyPreferences = [preference(contentProfile, "hard")];
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
    expect(decision.staticContentSupportSelections).toContain(identity);
    expect(
      decision.diagnostics.find(
        ({ preferencePath }) => preferencePath === "contentSupport.pageFamilyPreferences[0]",
      ),
    ).toMatchObject({
      outcome: "accepted",
      selectedAuthority: { authorityId: `${identity}:${page.familyId}` },
    });

    const execution = executeCompiledPromptedStorefrontDesignDecisionV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      compiledDecision: decision,
      pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
      contentFactAuthority: fixture.source.contentFactAuthority,
      approvedAssetPresentations: fixture.source.fixture.assetPresentations,
    });
    expect(execution.synthesisDecision.pageProfileSelections).toContainEqual(
      expect.objectContaining({
        familyId: page.familyId,
        profileId: page.profile.id,
        profileVersion: page.profile.version,
      }),
    );
    expect(
      execution.synthesis.materialization.snapshot.pages.find(
        ({ pageFamily }) => pageFamily?.familyId === page.familyId,
      ),
    ).toMatchObject({
      pageFamily: { profileId: page.profile.id, profileVersion: page.profile.version },
      sections: [expect.objectContaining({ component: "contentSupport" })],
    });
  });

  it("fails hard and omits soft or optional content/support selections without current evidence", () => {
    const fixture = sharedFixture;
    const targetPage = fixture.compatibilityInput.siteMapDecision.pages.find(
      ({ familyId, evidenceReferences }) => familyId === "about" && evidenceReferences.length > 0,
    );
    const evidence = targetPage?.evidenceReferences[0];
    if (!targetPage || !evidence) throw new Error("Missing content/support evidence fixture.");
    const identity = `${targetPage.profile.id}@${targetPage.profile.version}`;
    const contentProfile = entryByReference(
      fixture.requestAuthority.capabilityAuthority,
      (reference) =>
        reference?.dimension === "content-support.profile" &&
        reference.authorityId === `${identity}:${targetPage.familyId}`,
      "content-support.profile",
    );
    const compatibilityInput = {
      ...fixture.compatibilityInput,
      siteMapDecision: {
        ...fixture.compatibilityInput.siteMapDecision,
        pages: fixture.compatibilityInput.siteMapDecision.pages.map((page) =>
          page.key === targetPage.key ? { ...page, required: false } : page,
        ),
      },
      approvedEvidenceReferences: fixture.compatibilityInput.approvedEvidenceReferences.filter(
        (reference) =>
          reference.source !== evidence.source ||
          reference.authorityId !== evidence.authorityId ||
          reference.revision !== evidence.revision,
      ),
    };
    const intentFor = (semantics: Preference["semantics"]) => {
      const { intentFingerprint: _fingerprint, ...material } = structuredClone(sharedIntent);
      void _fingerprint;
      material.contentSupport.pageFamilyPreferences = [preference(contentProfile, semantics)];
      return promptedStorefrontDesignIntentV2Schema.parse({
        ...material,
        intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
      });
    };
    const compile = (semantics: Preference["semantics"]) => {
      const intent = intentFor(semantics);
      return {
        intent,
        decision: compilePromptedStorefrontDesignIntentV2({
          originalRequest: fixture.requestAuthority.request,
          providerIntent: intent,
          currentRequestInput: fixture.currentRequestInput,
          compatibilityInput,
        }),
      };
    };

    expect(() => compile("hard")).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "no-compatible-selection",
      }),
    );
    const soft = compile("soft");
    expect(
      soft.decision.diagnostics.find(
        ({ preferencePath }) => preferencePath === "contentSupport.pageFamilyPreferences[0]",
      ),
    ).toMatchObject({
      outcome: "rejected",
      reasonCode: "missing-approved-evidence",
      selectedAuthority: null,
    });
    const optional = compile("optional");
    expect(optional.decision.staticContentSupportSelections).not.toContain(identity);
    expect(optional.decision.evidenceBackedOmissions).toContain(contentProfile.key);
    expect(
      optional.decision.diagnostics.find(
        ({ preferencePath }) => preferencePath === "contentSupport.pageFamilyPreferences[0]",
      ),
    ).toMatchObject({
      outcome: "omitted",
      reasonCode: "missing-approved-evidence",
      selectedAuthority: null,
    });

    const execution = executeCompiledPromptedStorefrontDesignDecisionV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: optional.intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput,
      compiledDecision: optional.decision,
      pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
      contentFactAuthority: fixture.source.contentFactAuthority,
      approvedAssetPresentations: fixture.source.fixture.assetPresentations,
    });
    expect(
      execution.synthesisDecision.pageProfileSelections.some(
        ({ familyId }) => familyId === targetPage.familyId,
      ),
    ).toBe(false);
    expect(
      execution.synthesis.materialization.snapshot.pages.some(
        ({ pageFamily }) => pageFamily?.familyId === targetPage.familyId,
      ),
    ).toBe(false);
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

  it("redesigns a migrated route-backed site map through the prompted compiler and executor", () => {
    const fixture = currentCompilerAuthority();
    const authority = fixture.currentRequestInput.draft.dynamicCommercePresentation;
    if (!authority) throw new Error("Missing migrated dynamic-commerce authority.");
    const routeForPage = (
      page: (typeof fixture.compatibilityInput.siteMapDecision.pages)[number],
    ) =>
      authority.routeInventory.find((route) => {
        if (route.route !== page.route) return false;
        if (route.kind === "collection") {
          return (
            page.familyId === "collection" &&
            page.commerceContext.kind === "collection" &&
            page.commerceContext.collectionId === route.collectionId
          );
        }
        if (route.kind === "product") {
          return (
            page.familyId === "product-detail" &&
            page.commerceContext.kind === "product" &&
            page.commerceContext.productId === route.productId
          );
        }
        return page.familyId === "search-results" && page.commerceContext.kind === "search";
      });
    const compatibilityInput = {
      ...fixture.compatibilityInput,
      siteMapDecision: {
        ...fixture.compatibilityInput.siteMapDecision,
        pages: fixture.compatibilityInput.siteMapDecision.pages.map((page) => {
          const route = routeForPage(page);
          return route ? { ...page, existingPageId: route.id } : page;
        }),
      },
    };
    const requestAuthority = createPromptedStorefrontDesignRequestV2(fixture.currentRequestInput);
    const compatible = listCompatibleCoordinatedDirectionSelectionNarrowings(compatibilityInput);
    if (!compatible[0]) throw new Error("Missing migrated compatible narrowing.");
    const migratedFixture = {
      ...fixture,
      compatibilityInput,
      requestAuthority,
      seed: compatible[0],
    };
    const intent = providerIntent(migratedFixture);
    const compiledDecision = compilePromptedStorefrontDesignIntentV2({
      originalRequest: requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: migratedFixture.currentRequestInput,
      compatibilityInput: migratedFixture.compatibilityInput,
    });
    const execution = executeCompiledPromptedStorefrontDesignDecisionV2({
      originalRequest: requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: migratedFixture.currentRequestInput,
      compatibilityInput: migratedFixture.compatibilityInput,
      compiledDecision,
      pageEvidenceAuthority: migratedFixture.source.pageEvidenceAuthority,
      contentFactAuthority: migratedFixture.source.contentFactAuthority,
      approvedAssetPresentations: migratedFixture.source.fixture.assetPresentations,
    });
    const materialization = execution.synthesis.materialization;
    const routeIds = new Set(authority.routeInventory.map(({ id }) => id));

    expect(materialization.snapshot.dynamicCommercePresentation?.routeInventory).toEqual(
      authority.routeInventory,
    );
    expect(materialization.snapshot.pages.every(({ id }) => !routeIds.has(id))).toBe(true);
    expect(materialization.snapshot.dynamicCommercePresentation?.collectionRouteMappings).toEqual(
      materialization.proposal.proposedStorefront.dynamicCommercePresentation
        ?.collectionRouteMappings,
    );
    expect(
      replayWholeStorefrontProposalOperations(
        materialization.proposal.originalStorefront,
        materialization.proposal.operations,
      ).dynamicCommercePresentation,
    ).toEqual(materialization.proposal.proposedStorefront.dynamicCommercePresentation);
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

  it.each([
    "recentAcceptedStructuralFingerprints",
    "recentRejectedStructuralFingerprints",
  ] as const)("skips the exact top-ranked structure recorded in %s", (field) => {
    const fixture = sharedFixture;
    const baseline = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: sharedIntent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input = {
      ...fixture.currentRequestInput,
      priorDiversityEvidence: {
        recentAcceptedStructuralFingerprints:
          field === "recentAcceptedStructuralFingerprints" ? [baseline.structuralFingerprint] : [],
        recentRejectedStructuralFingerprints:
          field === "recentRejectedStructuralFingerprints" ? [baseline.structuralFingerprint] : [],
        recentlyUsedPostureKeys: [],
        merchantAvoidancePreferenceKeys: [],
      },
    };
    const current = createPromptedStorefrontDesignRequestV2(currentRequestInput);
    const { intentFingerprint: _intentFingerprint, ...intentMaterial } = sharedIntent;
    void _intentFingerprint;
    const reboundMaterial = {
      ...intentMaterial,
      requestFingerprint: current.request.requestFingerprint,
      promptFingerprint: current.request.promptFingerprint,
    };
    const reboundIntent = promptedStorefrontDesignIntentV2Schema.parse({
      ...reboundMaterial,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(reboundMaterial),
    });

    const alternative = compilePromptedStorefrontDesignIntentV2({
      originalRequest: current.request,
      providerIntent: reboundIntent,
      currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });

    expect(alternative.structuralFingerprint).not.toBe(baseline.structuralFingerprint);
    expect(alternative.exactSelection).not.toEqual(baseline.exactSelection);
  });

  it("fails closed when hard constraints leave only a previously used structure", () => {
    const fixture = sharedFixture;
    const authority = fixture.requestAuthority.capabilityAuthority;
    const initial = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: sharedIntent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const exactEntry = (
      dimension: PromptedStorefrontCapabilityEntry["dimension"],
      authorityId: string,
    ) =>
      entryByReference(authority, (reference) => reference?.authorityId === authorityId, dimension);
    const designDna = exactEntry(
      "design-dna.media",
      `media.posture:${initial.designDna.value.media.posture}`,
    );
    const frame = exactEntry("shared-frame.profile", initial.sharedFrame.profileId);
    const homepage = entryByReference(
      authority,
      (reference) =>
        reference?.authorityKind === "page-blueprint" &&
        reference.authorityId.startsWith(`${initial.exactSelection.homepageProfileId}@`),
      "homepage.profile",
    );
    const collection = entryByReference(
      authority,
      (reference) =>
        reference?.authorityKind === "page-blueprint" &&
        reference.authorityId.startsWith(`${initial.exactSelection.collectionProfileId}@`),
      "collection-search.archetype",
    );
    const productDetail = entryByReference(
      authority,
      (reference) =>
        reference?.authorityKind === "page-blueprint" &&
        reference.authorityId.startsWith(`${initial.exactSelection.pdpProfileId}@`),
      "pdp.archetype",
    );
    const productDetailReference = authority.referencesByPreferenceKey.get(productDetail.key);
    if (!productDetailReference?.intentRoles?.[0]) {
      throw new Error("Missing exact PDP intent-role authority.");
    }
    const optionalPagePreferences = fixture.compatibilityInput.siteMapDecision.pages
      .filter(
        ({ required, familyId }) =>
          !required && initial.exactSelection.includedOptionalPageFamilyIds.includes(familyId),
      )
      .map(({ familyId, profile }) => {
        const profileIdentity = `${profile.id}@${profile.version}`;
        const entry = authority.projection.capabilities.find((candidate) => {
          const reference = authority.referencesByPreferenceKey.get(candidate.key);
          return (
            candidate.availability === "available" &&
            reference?.authorityKind === "page-blueprint" &&
            (reference.authorityId === profileIdentity ||
              reference.authorityId === `${profileIdentity}:${familyId}`)
          );
        });
        if (!entry) throw new Error(`Missing exact ${familyId} profile authority.`);
        return preference(entry, "hard");
      });
    const { intentFingerprint: _intentFingerprint, ...lockedMaterial } =
      structuredClone(sharedIntent);
    void _intentFingerprint;
    lockedMaterial.constraints.hard = [preference(frame, "hard"), ...optionalPagePreferences];
    lockedMaterial.designDna.preferences = [preference(designDna, "hard")];
    lockedMaterial.sharedFrame.preferences = [preference(frame, "hard")];
    lockedMaterial.homepage.profilePreferences = [preference(homepage, "hard")];
    lockedMaterial.collectionSearch.archetypePreferences = [preference(collection, "hard")];
    lockedMaterial.productDetail.standardSimplePreferences = [];
    lockedMaterial.productDetail.configurablePreferences = [];
    lockedMaterial.productDetail.galleryLedPreferences = [];
    lockedMaterial.productDetail.highConsiderationPreferences = [];
    lockedMaterial.productDetail.genericFallbackPreferences = [];
    lockedMaterial.productDetail.productTypeIntentions = [];
    const exactProductDetailPreference = preference(productDetail, "hard");
    const productDetailRole = productDetailReference.intentRoles[0];
    if (productDetailRole === "pdp-standard-simple") {
      lockedMaterial.productDetail.standardSimplePreferences = [exactProductDetailPreference];
    } else if (productDetailRole === "pdp-configurable") {
      lockedMaterial.productDetail.configurablePreferences = [exactProductDetailPreference];
    } else if (productDetailRole === "pdp-gallery-led") {
      lockedMaterial.productDetail.galleryLedPreferences = [exactProductDetailPreference];
    } else if (productDetailRole === "pdp-high-consideration") {
      lockedMaterial.productDetail.highConsiderationPreferences = [exactProductDetailPreference];
    } else {
      lockedMaterial.productDetail.genericFallbackPreferences = [exactProductDetailPreference];
    }
    const lockedIntent = promptedStorefrontDesignIntentV2Schema.parse({
      ...lockedMaterial,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(lockedMaterial),
    });
    const lockedBaseline = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: lockedIntent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    const compileWithPrior = (priorStructuralFingerprints: readonly string[]) => {
      const currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input = {
        ...fixture.currentRequestInput,
        priorDiversityEvidence: {
          recentAcceptedStructuralFingerprints: [...priorStructuralFingerprints],
          recentRejectedStructuralFingerprints: [],
          recentlyUsedPostureKeys: [],
          merchantAvoidancePreferenceKeys: [],
        },
      };
      const current = createPromptedStorefrontDesignRequestV2(currentRequestInput);
      const reboundMaterial = {
        ...lockedMaterial,
        requestFingerprint: current.request.requestFingerprint,
        promptFingerprint: current.request.promptFingerprint,
      };
      const reboundIntent = promptedStorefrontDesignIntentV2Schema.parse({
        ...reboundMaterial,
        intentFingerprint: promptedStorefrontDesignIntentFingerprint(reboundMaterial),
      });
      return compilePromptedStorefrontDesignIntentV2({
        originalRequest: current.request,
        providerIntent: reboundIntent,
        currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      });
    };
    const priorStructuralFingerprints = [lockedBaseline.structuralFingerprint];
    const alternative = compileWithPrior(priorStructuralFingerprints);
    expect(priorStructuralFingerprints).not.toContain(alternative.structuralFingerprint);
    priorStructuralFingerprints.push(alternative.structuralFingerprint);

    expect(() => compileWithPrior(priorStructuralFingerprints)).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "no-compatible-selection",
      }),
    );
  });

  it("excludes evidence-omitted homepage slots from exact variant and parameter selection", () => {
    const fixture = sharedFixture;
    const authority = fixture.requestAuthority.capabilityAuthority;
    const plan = getCommercialHomepageProfile("homepage-editorial-storytelling");
    const proofSelection = plan?.profile?.componentSelections.find(
      ({ slotId }) => slotId === "approved-proof",
    );
    const proofVariantId = proofSelection?.variants[0];
    if (!plan?.profile || !proofVariantId) {
      throw new Error("Missing optional homepage proof slot authority.");
    }
    const proofVariant = entryByReference(
      authority,
      (reference) => reference?.authorityId === `homepageProof:${proofVariantId}`,
      "homepage.meaningful-variant",
    );
    const proofAlignment = authority.projection.capabilities.find(
      ({ key }) => key === "component.bounded-parameter.homepageProof.contentAlignment",
    );
    if (!proofAlignment) throw new Error("Missing homepage proof alignment capability.");
    const proofAlignmentReference = authority.referencesByPreferenceKey.get(proofAlignment.key);
    if (!proofAlignmentReference) throw new Error("Missing homepage proof alignment reference.");
    const exactSlotAuthority = {
      referencesByPreferenceKey: new Map(authority.referencesByPreferenceKey),
    };
    // Runtime projection is a separate gate. This synthetic current reference isolates whether
    // an evidence-omitted slot can become an exact selection target.
    exactSlotAuthority.referencesByPreferenceKey.set(proofAlignment.key, {
      ...proofAlignmentReference,
      availability: "available",
    });
    const evidenceResolution = resolveCommercialHomepageProfileSlots(plan.profile.id, {
      canonicalCommerce: true,
      canonicalProductCount: fixture.currentRequestInput.catalogue.products.length,
      canonicalCollectionCount: fixture.currentRequestInput.catalogue.collections.length,
      approvedMerchantEvidence: false,
      approvedMediaSlotIds: [],
    });
    expect(evidenceResolution).toEqual({
      includedSlotIds: ["hero", "curated-products", "continuation"],
      omittedSlotIds: ["brand-story", "editorial-lookbook", "approved-proof"],
    });

    // Exercise the same evidence-resolved target boundary with the proof slot excluded as an
    // omitted optional slot. Exact hard preferences cannot bind to a slot that will not exist;
    // softer preferences remain explicitly unselected.
    const located = (
      entry: PromptedStorefrontCapabilityEntry,
      path: string,
      semantics: LocatedPreference["semantics"],
      value: string | number | null = null,
    ): LocatedPreference => ({
      path,
      key: entry.key,
      dimension: entry.dimension,
      semantics,
      rank: semantics === "soft" ? 1 : null,
      value,
    });
    const resolve = (preferences: readonly LocatedPreference[]) =>
      resolvePromptedStorefrontExactSlotOverrides({
        selectionNarrowing: fixture.seed,
        componentDefinitions: [...veskifyComponentDefinitionsV2],
        authority: exactSlotAuthority,
        preferences,
        includedHomepageSlotIds: evidenceResolution.includedSlotIds,
      });

    expect(() =>
      resolve([located(proofVariant, "homepage.meaningfulVariantPreferences[0]", "hard")]),
    ).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "unsatisfied-hard-preference",
      }),
    );
    expect(() =>
      resolve([
        located(proofAlignment, "components.boundedParameterPreferences[0]", "hard", "center"),
      ]),
    ).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "unsatisfied-hard-preference",
      }),
    );

    const softer = resolve([
      located(proofVariant, "homepage.meaningfulVariantPreferences[0]", "soft"),
      located(proofAlignment, "components.boundedParameterPreferences[0]", "optional", "center"),
    ]);
    expect([...softer.selectedPreferencePaths]).toEqual([]);
    expect(
      softer.slotOverrides.some(({ slotSelections }) =>
        slotSelections.some(({ slotId }) => slotId === "approved-proof"),
      ),
    ).toBe(false);
  });

  it("rejects unavailable asset preferences and retains evidence-resolved homepage order", () => {
    const fixture = sharedFixture;
    const base = sharedIntent;
    const authority = fixture.requestAuthority.capabilityAuthority;
    const assetRole = authority.projection.capabilities.find(
      ({ key }) =>
        key ===
        "homepage.asset-role.homepage-editorial-storytelling.editorial-lookbook.storyMedia.heroMobile",
    );
    if (!assetRole) throw new Error("Missing optional lookbook asset-role capability.");
    expect(assetRole.availability).toBe("evidence-dependent");

    const intentWithAsset = (semantics: Preference["semantics"]) => {
      const { intentFingerprint: _fingerprint, ...material } = structuredClone(base);
      void _fingerprint;
      material.homepage.approvedAssetRolePreferences = [preference(assetRole, semantics)];
      return promptedStorefrontDesignIntentV2Schema.parse({
        ...material,
        intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
      });
    };
    const compile = (intent: PromptedStorefrontDesignIntentV2) =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: intent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      });

    expect(() => compile(intentWithAsset("hard"))).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "invalid-input",
      }),
    );
    expect(
      compile(intentWithAsset("soft")).diagnostics.find(
        ({ preferencePath }) => preferencePath === "homepage.approvedAssetRolePreferences[0]",
      ),
    ).toMatchObject({ outcome: "rejected", selectedAuthority: null });
    expect(
      compile(intentWithAsset("optional")).diagnostics.find(
        ({ preferencePath }) => preferencePath === "homepage.approvedAssetRolePreferences[0]",
      ),
    ).toMatchObject({
      outcome: "omitted",
      reasonCode: "missing-approved-asset",
      selectedAuthority: null,
    });

    const decision = compile(base);
    expect(decision.narrative.homepageRoleSequence).toEqual([
      "orientation",
      "brand-story",
      "primary-discovery",
      "education",
      "brand-proof",
      "continuation",
    ]);
    expect(
      decision.diagnostics.find(({ preferencePath }) => preferencePath === "homepage.sectionCount"),
    ).toMatchObject({ outcome: "accepted", requestedValue: 6 });
  });

  it("checks responsive authority against the exact selected slot variant", () => {
    const fixture = sharedFixture;
    const base = sharedIntent;
    const authority = fixture.requestAuthority.capabilityAuthority;
    const homepage = entryByReference(
      authority,
      (reference) =>
        reference?.authorityKind === "page-blueprint" &&
        reference.authorityId.startsWith("homepage-editorial-storytelling@"),
      "homepage.profile",
    );
    const responsive = entryByReference(
      authority,
      (reference) => reference?.authorityId === "responsive:switch-layout",
      "responsive.posture",
    );
    const overlayVariant = entryByReference(
      authority,
      (reference) => reference?.authorityId === "homepageHero:fullBleedOverlay",
      "homepage.meaningful-variant",
    );
    const intentWith = (responsiveSemantics: Preference["semantics"], selectOverlay: boolean) => {
      const { intentFingerprint: _fingerprint, ...material } = structuredClone(base);
      void _fingerprint;
      material.homepage.profilePreferences = [preference(homepage, "hard")];
      material.homepage.meaningfulVariantPreferences = selectOverlay
        ? [preference(overlayVariant, "hard")]
        : [];
      material.components.meaningfulVariantPreferences = [];
      material.responsiveArtDirection.responsivePosturePreferences = [
        preference(responsive, responsiveSemantics),
      ];
      return promptedStorefrontDesignIntentV2Schema.parse({
        ...material,
        intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
      });
    };
    const compile = (intent: PromptedStorefrontDesignIntentV2) =>
      compilePromptedStorefrontDesignIntentV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: intent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      });

    expect(() => compile(intentWith("hard", false))).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "no-compatible-selection",
      }),
    );

    const softDecision = compile(intentWith("soft", false));
    expect(
      softDecision.diagnostics.find(
        ({ preferencePath }) =>
          preferencePath === "responsiveArtDirection.responsivePosturePreferences[0]",
      ),
    ).toMatchObject({ outcome: "rejected", selectedAuthority: null });

    const { intentFingerprint: _avoidFingerprint, ...avoidMaterial } = structuredClone(
      intentWith("soft", true),
    );
    void _avoidFingerprint;
    avoidMaterial.responsiveArtDirection.responsivePosturePreferences = [
      preference(responsive, "avoid"),
    ];
    const avoidedResponsiveIntent = promptedStorefrontDesignIntentV2Schema.parse({
      ...avoidMaterial,
      intentFingerprint: promptedStorefrontDesignIntentFingerprint(avoidMaterial),
    });
    expect(() => compile(avoidedResponsiveIntent)).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "no-compatible-selection",
      }),
    );

    const overlayIntent = intentWith("hard", true);
    const overlayDecision = compile(overlayIntent);
    const defaultIntent = intentWith("soft", false);
    const defaultDecision = compile(defaultIntent);
    expect(defaultDecision.exactSelection.directionId).toBe(
      overlayDecision.exactSelection.directionId,
    );
    expect(defaultDecision.structuralFingerprint).not.toBe(overlayDecision.structuralFingerprint);
    expect(defaultDecision.compiledDecisionFingerprint).not.toBe(
      overlayDecision.compiledDecisionFingerprint,
    );
    expect(
      overlayDecision.pageBlueprintSelectionOverrides
        .find(({ profileId }) => profileId === "homepage-editorial-storytelling")
        ?.slotSelections.find(({ slotId }) => slotId === "hero"),
    ).toMatchObject({ component: "homepageHero", variant: "fullBleedOverlay" });
    expect(
      overlayDecision.diagnostics.find(
        ({ preferencePath }) =>
          preferencePath === "responsiveArtDirection.responsivePosturePreferences[0]",
      ),
    ).toMatchObject({
      outcome: "accepted",
      selectedAuthority: { authorityId: "responsive:switch-layout" },
    });

    const execution = executeCompiledPromptedStorefrontDesignDecisionV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: overlayIntent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      compiledDecision: overlayDecision,
      pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
      contentFactAuthority: fixture.source.contentFactAuthority,
      approvedAssetPresentations: fixture.source.fixture.assetPresentations,
    });
    const materializedHomepage = execution.synthesis.materialization.snapshot.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "home",
    );
    expect(
      materializedHomepage?.sections.find(({ component }) => component === "homepageHero"),
    ).toMatchObject({ variant: "fullBleedOverlay" });

    const materializedResponsiveAuthorities = new Set(
      execution.synthesis.materialization.snapshot.pages.flatMap(({ sections }) =>
        sections.flatMap(({ component, variant }) => {
          const anatomy =
            veskifyComponentCapabilityManifest.getByComponentType(component)?.commercialAnatomy;
          const selectedVariant = anatomy?.variants.find(({ variantId }) => variantId === variant);
          return (
            selectedVariant?.structure.responsiveTransformationIds.map((transformationId) => {
              const transformation = anatomy?.responsiveTransformations.find(
                ({ id }) => id === transformationId,
              );
              if (!transformation) {
                throw new Error(`Missing responsive transformation ${transformationId}.`);
              }
              return `responsive:${transformation.mode}`;
            }) ?? []
          );
        }),
      ),
    );
    const responsiveDiagnostic = overlayDecision.diagnostics.find(
      ({ preferencePath }) =>
        preferencePath === "responsiveArtDirection.responsivePosturePreferences[0]",
    );
    expect(responsiveDiagnostic?.outcome).toBe("accepted");
    expect(materializedResponsiveAuthorities).toContain(
      responsiveDiagnostic?.selectedAuthority?.authorityId,
    );
  });

  it("keeps collection overrides separate from an unoverridden search using the same profile", () => {
    const fixture = sharedFixture;
    const narrowing = listCompatibleCoordinatedDirectionSelectionNarrowings(
      fixture.compatibilityInput,
    ).find((candidate) => {
      if (candidate.collectionProfileId !== candidate.searchProfileId) return false;
      const plan = getCommercialCollectionSearchProfile(candidate.collectionProfileId);
      return ["denseSearch", "catalogueComparison"].includes(plan?.slots[0]?.defaultVariant ?? "");
    });
    if (!narrowing) throw new Error("Missing a shared collection/search profile fixture.");
    const collectionPlan = getCommercialCollectionSearchProfile(narrowing.collectionProfileId);
    const homepagePlan = getCommercialHomepageProfile(narrowing.homepageProfileId);
    const collectionSlot = collectionPlan?.slots[0];
    if (!collectionPlan?.profile || !collectionSlot || !homepagePlan?.profile) {
      throw new Error("Missing exact shared-profile PageBlueprint authority.");
    }
    const contexts = resolvePromptedStorefrontResponsiveVariantContexts({
      compilerInput: {
        originalRequest: fixture.requestAuthority.request,
        providerIntent: sharedIntent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
      },
      candidate: {
        narrowing,
        homepageSlotIds: homepagePlan.slots.map(({ id }) => id),
      },
      slotOverrides: [
        {
          pageType: "collection",
          profileId: collectionPlan.profile.id,
          slotSelections: [
            {
              slotId: collectionSlot.id,
              component: collectionSlot.sectionType,
              variant: "editorialDiscovery",
            },
          ],
        },
      ],
    });
    const collection = contexts.find(
      ({ executionContext, profileId, slotId }) =>
        executionContext === "collection" &&
        profileId === collectionPlan.profile!.id &&
        slotId === collectionSlot.id,
    );
    const search = contexts.find(
      ({ executionContext, profileId, slotId }) =>
        executionContext === "search" &&
        profileId === collectionPlan.profile!.id &&
        slotId === collectionSlot.id,
    );

    expect(collection?.variant).toBe("editorialDiscovery");
    expect(collection?.authorityIds).toContain("responsive:stack");
    expect(collection?.authorityIds).not.toContain("responsive:reflow");
    expect(search?.variant).toBe(collectionSlot.defaultVariant);
    expect(search?.authorityIds).toContain("responsive:reflow");
    expect(search?.authorityIds).not.toContain("responsive:stack");
  });

  it("compiles an exact homepage asset-role preference and materializes that approved asset", () => {
    const fixture = sharedFixture;
    const base = sharedIntent;
    const authority = fixture.requestAuthority.capabilityAuthority;
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
        reference?.authorityKind === "approved-assets" &&
        reference.key ===
          "homepage.asset-role.homepage-editorial-storytelling.hero.heroMedia.heroDesktop",
      "homepage.asset-role",
    );
    const exactAsset = fixture.currentRequestInput.approvedAssetContext?.assets.find(
      ({ role }) => role === "heroDesktop",
    );
    if (!exactAsset) throw new Error("Missing exact approved homepage hero asset.");
    const assetReference = authority.referencesByPreferenceKey.get(assetRole.key);
    if (!assetReference) throw new Error("Missing exact approved homepage asset reference.");
    const { intentFingerprint: _fingerprint, ...material } = structuredClone(base);
    void _fingerprint;
    material.homepage.profilePreferences = [preference(homepage, "hard")];
    material.homepage.meaningfulVariantPreferences = [];
    material.homepage.approvedAssetRolePreferences = [preference(assetRole, "hard")];
    material.components.meaningfulVariantPreferences = [];
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

    expect(decision.approvedAssetRoleSelections).toEqual([
      {
        profileId: "homepage-editorial-storytelling",
        slotId: "hero",
        component: "homepageHero",
        assetSlotId: "heroMedia",
        role: "heroDesktop",
        assetId: exactAsset.assetId,
        assetRevision: exactAsset.revision,
        materialFingerprint: exactAsset.materialFingerprint,
        authorityFingerprint: fixture.currentRequestInput.approvedAssetContext?.fingerprint,
      },
    ]);
    expect(decision.responsiveArtDirection.approvedAssetRoleKeys).toEqual([assetRole.key]);
    expect(
      decision.diagnostics.find(({ preferenceKey }) => preferenceKey === assetRole.key),
    ).toMatchObject({
      outcome: "accepted",
      selectedAuthority: {
        authorityKind: "approved-assets",
        authorityId: assetReference.authorityId,
      },
    });

    const execution = executeCompiledPromptedStorefrontDesignDecisionV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      compiledDecision: decision,
      pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
      contentFactAuthority: fixture.source.contentFactAuthority,
      approvedAssetPresentations: fixture.source.fixture.assetPresentations,
    });
    const hero = execution.synthesis.materialization.snapshot.pages
      .find(({ pageFamily }) => pageFamily?.familyId === "home")
      ?.sections.find(({ component }) => component === "homepageHero");

    expect(hero?.approvedAssetPlacements).toContainEqual(
      expect.objectContaining({
        assetSlotId: "heroMedia",
        assetId: exactAsset.assetId,
        role: exactAsset.role,
      }),
    );
    expect(hero?.approvedAssetPresentations).toContainEqual(
      expect.objectContaining({
        assetId: exactAsset.assetId,
        role: exactAsset.role,
        revision: exactAsset.revision,
        materialFingerprint: exactAsset.materialFingerprint,
      }),
    );
    expect(execution.synthesis.materialization.proposal.status).toBe("pending");
  });

  it("honors an avoided exact asset by selecting a compatible approved slot alternative", () => {
    const fixture = sharedFixture;
    const authority = fixture.requestAuthority.capabilityAuthority;
    const homepage = entryByReference(
      authority,
      (reference) =>
        reference?.authorityKind === "page-blueprint" &&
        reference.authorityId.startsWith("homepage-editorial-storytelling@"),
      "homepage.profile",
    );
    const heroDesktop = entryByReference(
      authority,
      (reference) =>
        reference?.key ===
        "homepage.asset-role.homepage-editorial-storytelling.hero.heroMedia.heroDesktop",
      "homepage.asset-role",
    );
    const editorialImage = entryByReference(
      authority,
      (reference) =>
        reference?.key ===
        "homepage.asset-role.homepage-editorial-storytelling.hero.heroMedia.editorialImage",
      "homepage.asset-role",
    );
    const editorialAsset = fixture.currentRequestInput.approvedAssetContext?.assets.find(
      ({ role }) => role === "editorialImage",
    );
    if (!editorialAsset) throw new Error("Missing approved editorial alternative asset.");
    const { intentFingerprint: _fingerprint, ...material } = structuredClone(sharedIntent);
    void _fingerprint;
    material.homepage.profilePreferences = [preference(homepage, "hard")];
    material.homepage.meaningfulVariantPreferences = [];
    material.homepage.approvedAssetRolePreferences = [
      { ...preference(heroDesktop, "avoid"), rank: null },
      { ...preference(editorialImage, "soft"), rank: 1 },
    ];
    material.components.meaningfulVariantPreferences = [];
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

    expect(decision.approvedAssetRoleSelections).toEqual([
      expect.objectContaining({
        profileId: "homepage-editorial-storytelling",
        slotId: "hero",
        assetSlotId: "heroMedia",
        role: "editorialImage",
        assetId: editorialAsset.assetId,
      }),
    ]);
    expect(
      decision.diagnostics.find(({ preferenceKey }) => preferenceKey === heroDesktop.key),
    ).toMatchObject({ outcome: "rejected", reasonCode: "avoided-selection" });
    expect(
      decision.diagnostics.find(({ preferenceKey }) => preferenceKey === editorialImage.key),
    ).toMatchObject({
      outcome: "accepted",
      selectedAuthority: { key: editorialImage.key },
    });
  });

  it("fails atomically before producing a proposal when exact asset presentation is missing", () => {
    const fixture = sharedFixture;
    const base = sharedIntent;
    const authority = fixture.requestAuthority.capabilityAuthority;
    const assetRole = entryByReference(
      authority,
      (reference) =>
        reference?.authorityKind === "approved-assets" &&
        reference.key ===
          `homepage.asset-role.${fixture.seed.homepageProfileId}.hero.heroMedia.heroDesktop`,
      "homepage.asset-role",
    );
    const exactAsset = fixture.currentRequestInput.approvedAssetContext?.assets.find(
      ({ role }) => role === "heroDesktop",
    );
    if (!exactAsset) throw new Error("Missing exact approved homepage hero asset.");
    const { intentFingerprint: _fingerprint, ...material } = structuredClone(base);
    void _fingerprint;
    material.homepage.meaningfulVariantPreferences = [];
    material.homepage.approvedAssetRolePreferences = [preference(assetRole, "hard")];
    material.components.meaningfulVariantPreferences = [];
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
    const draftBefore = canonicalValueString(fixture.currentRequestInput.draft);
    let caught: unknown;

    try {
      executeCompiledPromptedStorefrontDesignDecisionV2({
        originalRequest: fixture.requestAuthority.request,
        providerIntent: intent,
        currentRequestInput: fixture.currentRequestInput,
        compatibilityInput: fixture.compatibilityInput,
        compiledDecision: decision,
        pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
        contentFactAuthority: fixture.source.contentFactAuthority,
        approvedAssetPresentations: fixture.source.fixture.assetPresentations.filter(
          ({ assetId }) => assetId !== exactAsset.assetId,
        ),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject<Partial<PromptedStorefrontDesignCompilerError>>({
      code: "materialization-failed",
    });
    expect((caught as Error & { cause?: unknown }).cause).toMatchObject({
      code: "stale-approved-asset",
    });
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
    expect(result.evidence.protectedCommerceAfterFingerprint).toMatch(
      /^protected-commerce-v1_\d+_[a-f0-9]{64}$/,
    );
    expect(result.evidence.protectedMediaAfterFingerprint).toMatch(
      /^protected-product-media-v1_\d+_[a-f0-9]{64}$/,
    );
    expect(result.evidence.protectedCommerceAfterFingerprint).not.toContain(
      fixture.currentRequestInput.catalogue.products[0]?.id ?? "missing-product",
    );
    expect(canonicalValueString(fixture.currentRequestInput.draft)).toBe(draftBefore);
    expect(result.execution.synthesis.materialization.proposal.status).toBe("pending");
  });

  it("rejects a materialized proposal whose runtime no longer carries exact commerce authority", async () => {
    const fixture = sharedFixture;
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
      createDesignIntent: vi.fn(() => Promise.resolve(sharedIntent)),
    };
    const execute = vi.fn(
      (input: Parameters<typeof executeCompiledPromptedStorefrontDesignDecisionV2>[0]) => {
        const valid = executeCompiledPromptedStorefrontDesignDecisionV2(input);
        return {
          ...valid,
          synthesis: {
            ...valid.synthesis,
            materialization: {
              ...valid.synthesis.materialization,
              proposal: {
                ...valid.synthesis.materialization.proposal,
                proposedStorefront: {
                  ...valid.synthesis.materialization.proposal.proposedStorefront,
                  canonicalCommerceFingerprint: "canonical-commerce-tampered",
                },
              },
            },
          },
        };
      },
    );

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider,
        loadCurrentAuthority: () => authority,
        executeCompiledDecision: execute,
      }),
    ).rejects.toMatchObject({
      code: "stale-authority",
    });
    expect(provider.createDesignIntent).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
  });

  it("rejects approved-asset replacement of protected product media in materialized runtime", async () => {
    const fixture = sharedFixture;
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
      createDesignIntent: vi.fn(() => Promise.resolve(sharedIntent)),
    };
    const execute = vi.fn(
      (input: Parameters<typeof executeCompiledPromptedStorefrontDesignDecisionV2>[0]) => {
        const valid = executeCompiledPromptedStorefrontDesignDecisionV2(input);
        const proposedStorefront = valid.synthesis.materialization.proposal.proposedStorefront;
        const firstPage = proposedStorefront.pages[0];
        const firstComponent = firstPage?.components[0];
        const mediaId = fixture.currentRequestInput.catalogue.products[0]?.images[0]?.id;
        if (!firstPage || !firstComponent || !mediaId) {
          throw new Error("Missing materialized component or canonical media fixture.");
        }
        return {
          ...valid,
          synthesis: {
            ...valid.synthesis,
            materialization: {
              ...valid.synthesis.materialization,
              proposal: {
                ...valid.synthesis.materialization.proposal,
                proposedStorefront: {
                  ...proposedStorefront,
                  pages: proposedStorefront.pages.map((page, pageIndex) =>
                    pageIndex === 0
                      ? {
                          ...page,
                          components: page.components.map((component, componentIndex) =>
                            componentIndex === 0
                              ? {
                                  ...component,
                                  assetAssignments: [
                                    ...component.assetAssignments,
                                    {
                                      slotId: "productMedia",
                                      assetId: mediaId,
                                      role: "productMainImage" as const,
                                    },
                                  ],
                                }
                              : component,
                          ),
                        }
                      : page,
                  ),
                },
              },
            },
          },
        };
      },
    );

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider,
        loadCurrentAuthority: () => authority,
        executeCompiledDecision: execute,
      }),
    ).rejects.toMatchObject({
      code: "stale-authority",
    });
    expect(provider.createDesignIntent).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
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
