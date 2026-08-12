import { beforeAll, describe, expect, it, vi } from "vitest";
import { listCompatibleCoordinatedDirectionSelectionNarrowings } from "@/application/bounded-storefront-synthesis";
import { migrateLegacyDynamicCommerceRoutes } from "@/application/dynamic-commerce-routes";
import {
  compilePromptedStorefrontDesignIntentV2,
  executeCompiledPromptedStorefrontDesignDecisionV2,
  runPromptedStorefrontDesignCompilation,
  type ExecutedPromptedStorefrontDesignDecisionV2,
  type PromptedStorefrontDesignCompilationAuthority,
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
import { getCommercialHomepageProfile } from "@/application/storefront-templates";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";

type Preference = PromptedStorefrontDesignIntentV2["designDna"]["preferences"][number];
type RuntimePage =
  ExecutedPromptedStorefrontDesignDecisionV2["synthesis"]["materialization"]["proposal"]["proposedStorefront"]["pages"][number];
type RuntimeComponent = RuntimePage["components"][number];
type PageEvidenceResolveInput = Parameters<
  PromptedStorefrontDesignCompilationAuthority["pageEvidenceAuthority"]["resolve"]
>[0];
type ContentFactResolveInput = Parameters<
  PromptedStorefrontDesignCompilationAuthority["contentFactAuthority"]["resolve"]
>[0];

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
  const currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input = {
    merchantPrompt: "Build a warm editorial storefront with clear product discovery.",
    project: source.fixture.aggregate.project,
    draft,
    catalogue: source.fixture.planningInput.catalogue,
    approvedBrief: source.fixture.brief,
    approvedAssetContext: source.fixture.assetContext,
  };
  const compatibilityInput = {
    planningInput: { ...source.fixture.planningInput, draft },
    siteMapDecision: source.siteMapDecision,
    approvedEvidenceReferences: source.approvedEvidenceReferences,
  };
  const requestAuthority = createPromptedStorefrontDesignRequestV2(currentRequestInput);
  const compatible = listCompatibleCoordinatedDirectionSelectionNarrowings(compatibilityInput);
  if (!compatible[0]) throw new Error("Missing compatible compiler fixture narrowing.");
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
  const firstSlot = plan?.slots[0];
  if (!plan?.profile || !firstSlot) throw new Error("Missing selected homepage profile.");
  const role = entryByReference(
    authority,
    (reference) =>
      reference?.authorityKind === "page-blueprint" &&
      reference.authorityId === `${plan.profile?.id}@${plan.profile?.version}:${firstSlot.id}`,
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
  );
  if (!search) throw new Error("Missing search relationship capability.");
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
      searchRelationshipPreferences: [preference(search)],
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

function authority(
  fixture: ReturnType<typeof currentCompilerAuthority>,
): PromptedStorefrontDesignCompilationAuthority {
  return {
    requestInput: fixture.currentRequestInput,
    compatibilityInput: fixture.compatibilityInput,
    pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
    contentFactAuthority: fixture.source.contentFactAuthority,
    approvedAssetPresentations: fixture.source.fixture.assetPresentations,
  };
}

function mutateRouteComponent(
  execution: ExecutedPromptedStorefrontDesignDecisionV2,
  routeId: string,
  componentName: string,
  mutate: (component: RuntimeComponent) => RuntimeComponent,
): ExecutedPromptedStorefrontDesignDecisionV2 {
  const proposal = execution.synthesis.materialization.proposal;
  return {
    ...execution,
    synthesis: {
      ...execution.synthesis,
      materialization: {
        ...execution.synthesis.materialization,
        proposal: {
          ...proposal,
          proposedStorefront: {
            ...proposal.proposedStorefront,
            pages: proposal.proposedStorefront.pages.map((page) =>
              page.pageId === routeId
                ? {
                    ...page,
                    components: page.components.map((component) =>
                      component.component === componentName ? mutate(component) : component,
                    ),
                  }
                : page,
            ),
          },
        },
      },
    },
  };
}

describe("P10B-16P-02B coordinator authority regressions", () => {
  let fixture: ReturnType<typeof currentCompilerAuthority>;
  let intent: PromptedStorefrontDesignIntentV2;
  let baselineExecution: ExecutedPromptedStorefrontDesignDecisionV2;

  beforeAll(() => {
    fixture = currentCompilerAuthority();
    intent = providerIntent(fixture);
    const compiledDecision = compilePromptedStorefrontDesignIntentV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
    });
    baselineExecution = executeCompiledPromptedStorefrontDesignDecisionV2({
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      compiledDecision,
      pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
      contentFactAuthority: fixture.source.contentFactAuthority,
      approvedAssetPresentations: fixture.source.fixture.assetPresentations,
    });
  }, 120_000);

  function provider() {
    return {
      id: "deterministic-coordinator-regression-provider",
      modelId: "deterministic-test-model",
      createDesignIntent: vi.fn(() => Promise.resolve(intent)),
    };
  }

  it("measures exactly one complete execution invocation", async () => {
    const execute = vi.fn(executeCompiledPromptedStorefrontDesignDecisionV2);

    const result = await runPromptedStorefrontDesignCompilation({
      provider: provider(),
      loadCurrentAuthority: () => authority(fixture),
      executeCompiledDecision: execute,
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(result.evidence.materializationCount).toBe(1);
    expect(result.evidence.materializationAuthorityFingerprint).toMatch(
      /^materialization-authority-v1_\d+_[a-f0-9]{64}$/,
    );
  });

  it.each([
    [
      "site-map decision",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        compatibilityInput: {
          ...current.compatibilityInput,
          siteMapDecision: {
            ...current.compatibilityInput.siteMapDecision,
            pages: current.compatibilityInput.siteMapDecision.pages.map((page, index) =>
              index === 0
                ? { ...page, title: { ...page.title, en: `${page.title.en} changed` } }
                : page,
            ),
          },
        },
      }),
    ],
    [
      "approved evidence references",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        compatibilityInput: {
          ...current.compatibilityInput,
          approvedEvidenceReferences: current.compatibilityInput.approvedEvidenceReferences.map(
            (reference, index) =>
              index === 0
                ? {
                    ...reference,
                    approvalFingerprint: `${reference.approvalFingerprint}-changed`,
                  }
                : reference,
          ),
        },
      }),
    ],
    [
      "page evidence resolver",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        pageEvidenceAuthority: {
          resolve(input: PageEvidenceResolveInput) {
            const resolved = current.pageEvidenceAuthority.resolve(input);
            return {
              ...resolved,
              approvalFingerprint: `${resolved.approvalFingerprint}-changed`,
            };
          },
        },
      }),
    ],
    [
      "content fact resolver",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        contentFactAuthority: {
          resolve(input: ContentFactResolveInput) {
            const resolved = current.contentFactAuthority.resolve(input);
            return { ...resolved, fingerprint: `${resolved.fingerprint}-changed` };
          },
        },
      }),
    ],
    [
      "approved asset presentations",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        approvedAssetPresentations: current.approvedAssetPresentations.map((presentation, index) =>
          index === 0
            ? {
                ...presentation,
                materialFingerprint: `${presentation.materialFingerprint}-changed`,
              }
            : presentation,
        ),
      }),
    ],
    [
      "component definitions",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        compatibilityInput: {
          ...current.compatibilityInput,
          planningInput: {
            ...current.compatibilityInput.planningInput,
            componentDefinitions: current.compatibilityInput.planningInput.componentDefinitions.map(
              (definition, index) =>
                index === 0
                  ? {
                      ...definition,
                      merchantDescription: {
                        ...definition.merchantDescription,
                        en: `${definition.merchantDescription.en} changed`,
                      },
                    }
                  : definition,
            ),
          },
        },
      }),
    ],
    [
      "recipe context",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        compatibilityInput: {
          ...current.compatibilityInput,
          planningInput: {
            ...current.compatibilityInput.planningInput,
            recipeContext: {
              ...current.compatibilityInput.planningInput.recipeContext,
              fingerprint: `${current.compatibilityInput.planningInput.recipeContext.fingerprint}-changed`,
            },
          },
        },
      }),
    ],
    [
      "required asset placements",
      (current: PromptedStorefrontDesignCompilationAuthority) => {
        const asset = current.requestInput.approvedAssetContext?.assets[0];
        const page = current.requestInput.draft.pages[0];
        const section = page?.sections[0];
        if (!asset || !page || !section) throw new Error("Missing approved placement fixture.");
        return {
          ...current,
          compatibilityInput: {
            ...current.compatibilityInput,
            planningInput: {
              ...current.compatibilityInput.planningInput,
              requiredAssetPlacements: [
                {
                  type: "PLACE_APPROVED_SOURCE_ASSET" as const,
                  pageId: page.id,
                  componentId: section.id,
                  componentType: section.component,
                  assetSlotId: "reviewedAsset",
                  assetId: asset.assetId,
                  role: asset.role,
                  assetRevision: asset.revision,
                  materialFingerprint: asset.materialFingerprint,
                  sourceReferenceId: asset.sourceReferenceId,
                  required: true,
                },
              ],
            },
          },
        };
      },
    ],
  ] as const)("rejects refreshed %s drift before execution", async (_label, mutate) => {
    const initial = authority(fixture);
    const execute = vi.fn(executeCompiledPromptedStorefrontDesignDecisionV2);
    let loads = 0;

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider: provider(),
        loadCurrentAuthority: () => (loads++ === 0 ? initial : mutate(initial)),
        executeCompiledDecision: execute,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects request/planning authority mismatch before the provider call", async () => {
    const current = authority(fixture);
    const mismatched = {
      ...current,
      compatibilityInput: {
        ...current.compatibilityInput,
        planningInput: {
          ...current.compatibilityInput.planningInput,
          project: {
            ...current.compatibilityInput.planningInput.project,
            revision: current.compatibilityInput.planningInput.project.revision + 1,
          },
        },
      },
    };
    const injectedProvider = provider();
    const execute = vi.fn(executeCompiledPromptedStorefrontDesignDecisionV2);

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider: injectedProvider,
        loadCurrentAuthority: () => mismatched,
        executeCompiledDecision: execute,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
    expect(injectedProvider.createDesignIntent).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects request/planning authority mismatch at direct compiler and executor boundaries", () => {
    const compatibilityInput = {
      ...fixture.compatibilityInput,
      planningInput: {
        ...fixture.compatibilityInput.planningInput,
        project: {
          ...fixture.compatibilityInput.planningInput.project,
          revision: fixture.compatibilityInput.planningInput.project.revision + 1,
        },
      },
    };
    const compilerInput = {
      originalRequest: fixture.requestAuthority.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput,
    };

    expect(() => compilePromptedStorefrontDesignIntentV2(compilerInput)).toThrowError(
      expect.objectContaining({ code: "stale-authority" }),
    );
    expect(() =>
      executeCompiledPromptedStorefrontDesignDecisionV2({
        ...compilerInput,
        compiledDecision: baselineExecution.compiledDecision,
        pageEvidenceAuthority: fixture.source.pageEvidenceAuthority,
        contentFactAuthority: fixture.source.contentFactAuthority,
        approvedAssetPresentations: fixture.source.fixture.assetPresentations,
      }),
    ).toThrowError(expect.objectContaining({ code: "stale-authority" }));
  });

  it.each([
    [
      "draft",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        compatibilityInput: {
          ...current.compatibilityInput,
          planningInput: {
            ...current.compatibilityInput.planningInput,
            draft: {
              ...current.compatibilityInput.planningInput.draft,
              revision: current.compatibilityInput.planningInput.draft.revision + 1,
            },
          },
        },
      }),
    ],
    [
      "catalogue",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        compatibilityInput: {
          ...current.compatibilityInput,
          planningInput: {
            ...current.compatibilityInput.planningInput,
            catalogue: {
              ...current.compatibilityInput.planningInput.catalogue,
              products: [...current.compatibilityInput.planningInput.catalogue.products].reverse(),
            },
          },
        },
      }),
    ],
    [
      "approved brief",
      (current: PromptedStorefrontDesignCompilationAuthority) => ({
        ...current,
        compatibilityInput: {
          ...current.compatibilityInput,
          planningInput: {
            ...current.compatibilityInput.planningInput,
            brief: {
              ...current.compatibilityInput.planningInput.brief,
              revision: current.compatibilityInput.planningInput.brief.revision + 1,
            },
          },
        },
      }),
    ],
    [
      "approved asset context",
      (current: PromptedStorefrontDesignCompilationAuthority) => {
        const approvedAssetContext = current.compatibilityInput.planningInput.approvedAssetContext;
        if (!approvedAssetContext) throw new Error("Missing approved asset context fixture.");
        return {
          ...current,
          compatibilityInput: {
            ...current.compatibilityInput,
            planningInput: {
              ...current.compatibilityInput.planningInput,
              approvedAssetContext: {
                ...approvedAssetContext,
                fingerprint: `${approvedAssetContext.fingerprint}-changed`,
              },
            },
          },
        };
      },
    ],
  ] as const)(
    "rejects mismatched request/planning %s before the provider call",
    async (_, mutate) => {
      const mismatched = mutate(authority(fixture));
      const injectedProvider = provider();
      const execute = vi.fn(executeCompiledPromptedStorefrontDesignDecisionV2);

      await expect(
        runPromptedStorefrontDesignCompilation({
          provider: injectedProvider,
          loadCurrentAuthority: () => mismatched,
          executeCompiledDecision: execute,
        }),
      ).rejects.toMatchObject({ code: "stale-authority" });
      expect(injectedProvider.createDesignIntent).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it("requires the exact primary collection binding on a retained collection route", async () => {
    const current = authority(fixture);
    const route = current.requestInput.draft.dynamicCommercePresentation?.routeInventory.find(
      ({ kind }) => kind === "collection",
    );
    if (!route || route.kind !== "collection") {
      throw new Error("Missing canonical collection route authority.");
    }
    const tampered = mutateRouteComponent(
      baselineExecution,
      route.id,
      "dynamicCollectionCommerce",
      (component) => ({
        ...component,
        bindings: component.bindings.filter(
          (binding) => !(binding.source === "collection" && binding.slotId === "primaryCollection"),
        ),
      }),
    );

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider: provider(),
        loadCurrentAuthority: () => current,
        executeCompiledDecision: () => tampered,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
  });

  it("rejects reordered canonical membership on a retained collection route", async () => {
    const current = authority(fixture);
    const route = current.requestInput.draft.dynamicCommercePresentation?.routeInventory.find(
      ({ kind }) => kind === "collection",
    );
    const collection = current.requestInput.catalogue.collections.find(
      ({ id }) => route?.kind === "collection" && id === route.collectionId,
    );
    if (!route || route.kind !== "collection" || !collection || collection.productIds.length < 2) {
      throw new Error("Missing ordered collection-membership authority.");
    }
    const tampered = mutateRouteComponent(
      baselineExecution,
      route.id,
      "dynamicCollectionCommerce",
      (component) => ({
        ...component,
        bindings: component.bindings.map((binding) =>
          binding.source === "productList" && binding.slotId === "collectionProducts"
            ? { ...binding, productIds: [...collection.productIds].reverse() }
            : binding,
        ),
      }),
    );

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider: provider(),
        loadCurrentAuthority: () => current,
        executeCompiledDecision: () => tampered,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
  });

  it("rejects a different valid primary product on a retained product route", async () => {
    const current = authority(fixture);
    const route = current.requestInput.draft.dynamicCommercePresentation?.routeInventory.find(
      ({ kind }) => kind === "product",
    );
    const replacement = current.requestInput.catalogue.products.find(
      ({ id }) => route?.kind === "product" && id !== route.productId,
    );
    if (!route || route.kind !== "product" || !replacement) {
      throw new Error("Missing two canonical product authorities.");
    }
    const tampered = mutateRouteComponent(
      baselineExecution,
      route.id,
      "dynamicProductDetail",
      (component) => ({
        ...component,
        bindings: component.bindings.map((binding) =>
          binding.source === "product" && binding.slotId === "primaryProduct"
            ? { ...binding, productId: replacement.id }
            : binding,
        ),
      }),
    );

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider: provider(),
        loadCurrentAuthority: () => current,
        executeCompiledDecision: () => tampered,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
  });

  it("rejects reordered or substituted related-product authority on a retained product route", async () => {
    const current = authority(fixture);
    const route = current.requestInput.draft.dynamicCommercePresentation?.routeInventory.find(
      (candidate) => candidate.kind === "product" && (candidate.relatedProductIds?.length ?? 0) > 0,
    );
    if (!route || route.kind !== "product" || !route.relatedProductIds?.[0]) {
      throw new Error("Missing related-product route authority.");
    }
    const replacementIds =
      route.relatedProductIds.length > 1
        ? [...route.relatedProductIds].reverse()
        : [
            current.requestInput.catalogue.products.find(
              ({ id }) => id !== route.productId && id !== route.relatedProductIds?.[0],
            )?.id ?? route.productId,
          ];
    const tampered = mutateRouteComponent(
      baselineExecution,
      route.id,
      "dynamicProductDetail",
      (component) => ({
        ...component,
        bindings: component.bindings.map((binding) =>
          binding.source === "productList" && binding.slotId === "relatedProducts"
            ? { ...binding, productIds: replacementIds }
            : binding,
        ),
      }),
    );

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider: provider(),
        loadCurrentAuthority: () => current,
        executeCompiledDecision: () => tampered,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
  });

  it("rejects omission of an entire retained collection or product runtime page", async () => {
    const current = authority(fixture);
    const route = current.requestInput.draft.dynamicCommercePresentation?.routeInventory.find(
      ({ kind }) => kind === "product",
    );
    if (!route) throw new Error("Missing retained product route authority.");
    const proposal = baselineExecution.synthesis.materialization.proposal;
    const tampered: ExecutedPromptedStorefrontDesignDecisionV2 = {
      ...baselineExecution,
      synthesis: {
        ...baselineExecution.synthesis,
        materialization: {
          ...baselineExecution.synthesis.materialization,
          proposal: {
            ...proposal,
            proposedStorefront: {
              ...proposal.proposedStorefront,
              pages: proposal.proposedStorefront.pages.filter(({ pageId }) => pageId !== route.id),
            },
          },
        },
      },
    };

    await expect(
      runPromptedStorefrontDesignCompilation({
        provider: provider(),
        loadCurrentAuthority: () => current,
        executeCompiledDecision: () => tampered,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
  });

  it.each(["renamed", "duplicated"] as const)(
    "rejects a %s retained collection or product runtime page",
    async (mode) => {
      const current = authority(fixture);
      const route = current.requestInput.draft.dynamicCommercePresentation?.routeInventory.find(
        ({ kind }) => kind === "product",
      );
      if (!route) throw new Error("Missing retained product route authority.");
      const proposal = baselineExecution.synthesis.materialization.proposal;
      const routePage = proposal.proposedStorefront.pages.find(({ pageId }) => pageId === route.id);
      if (!routePage) throw new Error("Missing materialized route page fixture.");
      const pages =
        mode === "renamed"
          ? proposal.proposedStorefront.pages.map((page) =>
              page.pageId === route.id ? { ...page, pageId: `${page.pageId}-renamed` } : page,
            )
          : [...proposal.proposedStorefront.pages, structuredClone(routePage)];
      const tampered: ExecutedPromptedStorefrontDesignDecisionV2 = {
        ...baselineExecution,
        synthesis: {
          ...baselineExecution.synthesis,
          materialization: {
            ...baselineExecution.synthesis.materialization,
            proposal: {
              ...proposal,
              proposedStorefront: {
                ...proposal.proposedStorefront,
                pages,
              },
            },
          },
        },
      };

      await expect(
        runPromptedStorefrontDesignCompilation({
          provider: provider(),
          loadCurrentAuthority: () => current,
          executeCompiledDecision: () => tampered,
        }),
      ).rejects.toMatchObject({ code: "stale-authority" });
    },
  );
});
