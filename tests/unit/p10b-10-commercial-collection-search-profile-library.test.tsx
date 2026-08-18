import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  commercialCollectionSearchProfileIds,
  getCommercialCollectionSearchProfile,
  listCommercialCollectionSearchProfiles,
  materializeExecutablePageBlueprint,
  validateCommercialCollectionSearchProfileLibrary,
} from "@/application/storefront-templates";
import { createApprovedGenerationAssetContextFingerprint } from "@/application/ai-storefront-generation";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  materializeWholeStorefrontRuntimeSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import {
  STOREFRONT_SEARCH_RESULTS_CONTRACT_VERSION,
  storefrontSearchResultFingerprint,
  type StorefrontSearchResultMaterialV1,
} from "@/application/storefront-search";
import { createStorefrontRenderContext, renderRegisteredSection } from "@/components/registry";
import { dynamicCollectionCommerceBridgeDefinition } from "@/components/registry/dynamic-commerce-bridge";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { renderDynamicCollectionCommerce } from "@/components/storefront/dynamic-collection-commerce";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";
import {
  applyCommercialSharedFrame,
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  listPageFamilyDefinitions,
  type SectionInstance,
} from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";

const directionByProfile = {
  "collection-editorial-discovery": "premiumEditorial",
  "collection-catalogue-comparison": "modernTechnical",
  "collection-campaign-led-discovery": "premiumEditorial",
  "collection-dense-search": "modernTechnical",
} as const;

function currentProfile(profileId: (typeof commercialCollectionSearchProfileIds)[number]) {
  const profile = getCommercialCollectionSearchProfile(profileId);
  if (!profile?.profile?.commercialCollectionSearch) {
    throw new Error(`Missing commercial collection/search profile ${profileId}.`);
  }
  return profile;
}

function evidenceReferences(fixture: ReturnType<typeof createP905aFreshMerchantFixture>) {
  return [
    {
      source: "merchant-approved" as const,
      authorityId: fixture.brief.id,
      revision: String(fixture.brief.revision),
      status: "approved" as const,
      approvalAuthorityId: fixture.brief.approval.actorId!,
      approvalFingerprint: fixture.brief.approvedEvidenceFingerprint!,
    },
  ];
}

function lifecycle(profileId: (typeof commercialCollectionSearchProfileIds)[number]) {
  const directionId = directionByProfile[profileId];
  const fixture = createP905aFreshMerchantFixture(directionId);
  const profile = currentProfile(profileId);
  const authority = profile.profile!.commercialCollectionSearch!;
  const draft = applyCommercialSharedFrame(
    fixture.planningInput.draft,
    authority.defaultSharedFrameProfileId,
  );
  const approvedAssetContext = structuredClone(fixture.planningInput.approvedAssetContext);
  if (profileId === "collection-campaign-led-discovery" && approvedAssetContext) {
    const editorialAsset = approvedAssetContext.assets.find(
      (asset) => asset.role === "editorialImage",
    );
    if (!editorialAsset) throw new Error("Missing approved campaign asset fixture.");
    editorialAsset.presentation.placementAuthority = {
      purposes: ["editorial-story", "collection-campaign"],
      reusePolicy: "bounded-editorial",
      responsiveSourceGroupId: null,
      viewportApplicability: ["mobile", "tablet", "desktop", "wide"],
      collectionIds: [],
      priority: 0,
    };
    const { fingerprint: _fingerprint, ...assetMaterial } = approvedAssetContext;
    void _fingerprint;
    approvedAssetContext.fingerprint =
      createApprovedGenerationAssetContextFingerprint(assetMaterial);
  }
  const planningInput = { ...fixture.planningInput, draft, approvedAssetContext };
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId,
    collectionProfileId: profileId,
  });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const snapshot = materializeWholeStorefrontRuntimeSnapshot({
    runtime: proposal.proposedStorefront,
    planningInput,
    approvedAssetPresentations: fixture.assetPresentations,
  });
  const page = snapshot.pages.find((candidate) => candidate.type === "collection");
  const collection = fixture.aggregate.catalogue.collections[0];
  if (!page || !collection) throw new Error("Missing generated collection storefront evidence.");
  const presentation = createCatalogueStorefrontCommerceRouteAdapter().collection({
    aggregate: fixture.aggregate,
    snapshot,
    page,
    collection,
  });
  if (!presentation) throw new Error("Missing canonical collection route presentation.");
  return { authority, collection, fixture, page, plan, presentation, profile, snapshot };
}

function renderPresentation(
  result: ReturnType<typeof lifecycle>,
  target: "editor" | "preview" | "published",
) {
  return renderToStaticMarkup(
    renderDynamicCollectionCommerce({
      target,
      instance: result.presentation.instance,
      projection: result.presentation.projection,
      activeLocale: "en",
      primaryLocale: "en",
      loading: { status: "ready" },
      resolveAssetUrl: result.presentation.resolveAssetUrl,
      onNavigateProduct: () => undefined,
      onNavigateCollection: () => undefined,
      onFilterIntent: () => undefined,
      onSortIntent: () => undefined,
    }),
  );
}

describe("P10B-10 commercial collection and search profile library", () => {
  it("registers four stable PageBlueprint profiles with deterministic material structures", () => {
    const profiles = listCommercialCollectionSearchProfiles();
    expect(profiles).toHaveLength(4);
    expect(profiles.map((profile) => profile.profile!.id)).toEqual(
      commercialCollectionSearchProfileIds,
    );
    expect(
      new Set(
        profiles.map((profile) => profile.profile!.commercialCollectionSearch!.structuralSignature),
      ).size,
    ).toBe(4);
    expect(
      new Set(
        profiles.map(
          (profile) => profile.profile!.commercialCollectionSearch!.structuralFingerprint,
        ),
      ).size,
    ).toBe(4);
    expect(profiles.every((profile) => profile.profile!.version === "1.0.0")).toBe(true);
    expect(
      new Set(
        profiles.map((profile) => profile.profile!.commercialCollectionSearch!.presentationMode),
      ),
    ).toEqual(
      new Set([
        "editorial-discovery",
        "catalogue-comparison",
        "campaign-led-discovery",
        "dense-search",
      ]),
    );
    expect(
      Object.fromEntries(
        profiles.map((profile) => [
          profile.profile!.id,
          profile.profile!.commercialCollectionSearch!.productCardAnatomyId,
        ]),
      ),
    ).toEqual({
      "collection-editorial-discovery": "editorial",
      "collection-catalogue-comparison": "standard",
      "collection-campaign-led-discovery": "imageFirst",
      "collection-dense-search": "horizontal",
    });
  });

  it("materializes only the registered collection component and rejects shallow or stale authority", () => {
    for (const profileId of commercialCollectionSearchProfileIds) {
      const profile = currentProfile(profileId);
      const materialization = materializeExecutablePageBlueprint({
        pagePlan: profile,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: ["collection", "productList"],
      });
      expect(materialization.profileId).toBe(profileId);
      expect(materialization.commercialCollectionSearch?.structuralFingerprint).toBe(
        profile.profile!.commercialCollectionSearch!.structuralFingerprint,
      );
      expect(materialization.slots).toEqual([
        expect.objectContaining({ component: "dynamicCollectionCommerce" }),
      ]);
    }
    const profiles = listCommercialCollectionSearchProfiles();
    expect(() =>
      validateCommercialCollectionSearchProfileLibrary([...profiles, profiles[0]]),
    ).toThrow(/IDs must be unique|unique material structures/);
    const shallow = structuredClone(profiles[0]);
    shallow.profile!.id = "collection-shallow-copy";
    shallow.profile!.commercialCollectionSearch!.structuralFingerprint =
      "collection-search-shallow";
    expect(() =>
      validateCommercialCollectionSearchProfileLibrary([...profiles.slice(0, 3), shallow]),
    ).toThrow(/shallow near-duplicates|unique material structures/);
    const stale = structuredClone(profiles[0]);
    stale.profile!.commercialCollectionSearch!.gridDensity = "compact";
    expect(() =>
      validateCommercialCollectionSearchProfileLibrary([stale, ...profiles.slice(1)]),
    ).toThrow(/stale structural authority/);
  });

  it("fails the campaign profile closed until approved editorial media exists", () => {
    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    const profile = currentProfile("collection-campaign-led-discovery");
    const draft = applyCommercialSharedFrame(
      fixture.planningInput.draft,
      profile.profile!.commercialCollectionSearch!.defaultSharedFrameProfileId,
    );
    const withoutEditorial = {
      ...fixture.planningInput.approvedAssetContext,
      assets: fixture.planningInput.approvedAssetContext.assets.filter(
        (asset) => asset.role !== "editorialImage",
      ),
    };
    withoutEditorial.fingerprint =
      createApprovedGenerationAssetContextFingerprint(withoutEditorial);
    expect(() =>
      createWholeStorefrontGenerationPlan(
        { ...fixture.planningInput, draft, approvedAssetContext: withoutEditorial },
        {
          directionId: "premiumEditorial",
          collectionProfileId: "collection-campaign-led-discovery",
        },
      ),
    ).toThrow(/requires approved editorial campaign media/);
  });

  it("projects every registered collection profile safely through the legacy preview bridge", () => {
    const result = lifecycle("collection-editorial-discovery");
    const collection = result.collection;
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: result.fixture.aggregate.catalogue,
      snapshot: result.snapshot,
    });

    for (const [index, variant] of [
      "editorialDiscovery",
      "catalogueComparison",
      "campaignLedDiscovery",
      "denseSearch",
    ].entries()) {
      const section = {
        id: `legacy-preview-${index}`,
        component: "dynamicCollectionCommerce",
        variant,
        visible: true,
        content: {
          ...dynamicCollectionCommerceBridgeDefinition.defaultContent,
          collectionId: collection.id,
          productIds: collection.productIds,
          canonicalRevision: result.presentation.projection.collections[0].revision,
        },
        props: dynamicCollectionCommerceBridgeDefinition.defaultProps,
      } satisfies SectionInstance;
      expect(() => renderRegisteredSection(section, context, "collection")).not.toThrow();
    }
  });

  it("allows only search-compatible collection profiles on the search-result family", () => {
    const searchResultProfileIds = listPageFamilyDefinitions()
      .find((definition) => definition.id === "search-results")!
      .allowedProfileReferences.map((profile) => profile.id);
    expect(searchResultProfileIds).toEqual([
      "blueprint-site-map-search-baseline",
      "collection-catalogue-comparison",
      "collection-dense-search",
    ]);
    expect(searchResultProfileIds).not.toContain("collection-editorial-discovery");
    expect(searchResultProfileIds).not.toContain("collection-campaign-led-discovery");
  });

  it("preserves canonical membership, order, facts, filters, sorting and product-media lineage for every profile", () => {
    for (const profileId of commercialCollectionSearchProfileIds) {
      const result = lifecycle(profileId);
      const section = result.page.sections.find(
        (candidate) => candidate.component === "dynamicCollectionCommerce",
      )!;
      const props = section.props as {
        cardVariant: string;
        gridDensity: string;
        filterLayout: string;
      };
      expect(section.variant).toBe(result.profile.slots[0].defaultVariant);
      expect(props.cardVariant).toBe(result.authority.productCardAnatomyId);
      expect(props.gridDensity).toBe(result.authority.gridDensity);
      expect(props.filterLayout).toBe(result.authority.filterLayout);
      expect((section.content.productIds as string[]) ?? []).toEqual(result.collection.productIds);
      const projectionCollection = result.presentation.projection.collections[0];
      expect(projectionCollection.productIds).toEqual(result.collection.productIds);
      expect(projectionCollection.filters.length).toBeGreaterThan(0);
      expect(projectionCollection.filters.length).toBeLessThanOrEqual(8);
      projectionCollection.filters.forEach((filter) => {
        if (filter.presentation === "range") {
          expect(filter.range?.min).toBeLessThan(filter.range?.max ?? Number.NEGATIVE_INFINITY);
        } else {
          expect(filter.values.filter(({ disabled }) => !disabled).length).toBeGreaterThanOrEqual(
            2,
          );
        }
      });
      expect(projectionCollection.sorting).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "featured", default: true })]),
      );
      const productById = new Map(
        result.fixture.aggregate.catalogue.products.map((product) => [product.id, product]),
      );
      result.presentation.projection.products.forEach((product) => {
        const canonical = productById.get(product.productId)!;
        expect(product.price?.amount).toBe(canonical.price?.amount);
        expect(product.availability).toEqual(
          canonical.availabilityLabel ??
            (canonical.stockStatus === "inStock"
              ? { en: "In stock", fi: "Varastossa" }
              : canonical.stockStatus === "lowStock"
                ? { en: "Limited availability", fi: "Rajoitetusti saatavilla" }
                : { en: "Currently unavailable", fi: "Ei tällä hetkellä saatavilla" }),
        );
        expect(product.media.map((media) => media.assetId)).toEqual(
          canonical.images.map((image) => image.id),
        );
      });
      for (const target of ["editor", "preview", "published"] as const) {
        const markup = renderPresentation(result, target);
        expect(markup).toContain(`data-render-target="${target}"`);
        expect(markup).toContain('data-component="dynamicCollectionCommerce"');
        expect(markup).toContain('data-card-context="collectionResults"');
        expect(markup).toContain(`data-card-anatomy="${result.authority.productCardAnatomyId}"`);
      }
      expect(section.approvedAssetPlacements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            assetSlotId: "collectionCommerceMedia",
            role: "collectionImage",
          }),
        ]),
      );
      if (profileId === "collection-campaign-led-discovery") {
        const markup = renderPresentation(result, "preview");
        expect(markup).toContain('data-layout-region="campaign-lead"');
        expect(section.approvedAssetPlacements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              assetSlotId: "collectionCommerceMedia",
              role: "editorialImage",
            }),
          ]),
        );
        expect(section.approvedAssetPresentations).toHaveLength(2);
      } else {
        expect(section.approvedAssetPresentations).toHaveLength(1);
      }
      expect(canonicalValueString(result.fixture.aggregate.catalogue)).toBe(
        canonicalValueString(result.fixture.planningInput.catalogue),
      );
    }
  });

  it("retains canonical child-collection order and active commerce state when it is supplied", () => {
    const result = lifecycle("collection-editorial-discovery");
    const instance = structuredClone(result.presentation.instance);
    const projection = structuredClone(result.presentation.projection);
    const collection = projection.collections[0];
    const childCollections = [
      {
        ...collection,
        collectionId: "collection_related_one",
        title: { en: "Related one", fi: "Liittyvä yksi" },
        assets: [],
        productIds: [],
        filters: [],
        sorting: [],
        breadcrumbs: [],
        childCollectionIds: [],
        revision: "collection-related-one",
      },
      {
        ...collection,
        collectionId: "collection_related_two",
        title: { en: "Related two", fi: "Liittyvä kaksi" },
        assets: [],
        productIds: [],
        filters: [],
        sorting: [],
        breadcrumbs: [],
        childCollectionIds: [],
        revision: "collection-related-two",
      },
    ];
    collection.childCollectionIds = childCollections.map((child) => child.collectionId);
    collection.filters[0].values[0].selected = true;
    projection.collections.push(...childCollections);
    instance.bindings.push({
      slotId: "childCollections",
      source: "collectionList",
      collectionIds: collection.childCollectionIds,
      revision: projection.collectionListRevision,
    });

    const markup = renderToStaticMarkup(
      renderDynamicCollectionCommerce({
        target: "preview",
        instance,
        projection,
        activeLocale: "en",
        primaryLocale: "en",
        loading: { status: "ready" },
        resolveAssetUrl: result.presentation.resolveAssetUrl,
        onNavigateProduct: () => undefined,
        onNavigateCollection: () => undefined,
        onFilterIntent: () => undefined,
        onSortIntent: () => undefined,
      }),
    );
    expect(markup.indexOf("Related one")).toBeLessThan(markup.indexOf("Related two"));
    expect(markup).toContain('checked=""');

    const reordered = structuredClone(instance);
    const childBinding = reordered.bindings.find(
      (binding) => binding.slotId === "childCollections" && binding.source === "collectionList",
    );
    if (childBinding?.source !== "collectionList")
      throw new Error("Missing child collection binding.");
    childBinding.collectionIds.reverse();
    expect(() =>
      renderDynamicCollectionCommerce({
        target: "preview",
        instance: reordered,
        projection,
        activeLocale: "en",
        primaryLocale: "en",
        loading: { status: "ready" },
        resolveAssetUrl: result.presentation.resolveAssetUrl,
        onNavigateProduct: () => undefined,
        onNavigateCollection: () => undefined,
        onFilterIntent: () => undefined,
        onSortIntent: () => undefined,
      }),
    ).toThrow(/must exactly match canonical child collection order/);
  });

  it("preserves canonical search context and renders zero results without fabricated products", () => {
    const result = lifecycle("collection-dense-search");
    const instance = structuredClone(result.presentation.instance);
    const projection = structuredClone(result.presentation.projection);
    const material: StorefrontSearchResultMaterialV1 = {
      contractVersion: STOREFRONT_SEARCH_RESULTS_CONTRACT_VERSION,
      state: "results",
      requestFingerprint: "p10b10-no-results-request",
      catalogueFingerprint: canonicalValueFingerprint(result.fixture.aggregate.catalogue),
      authorityFingerprint: "p10b10-search-authority",
      normalizedQuery: "nonexistent ring",
      normalizedTerms: ["nonexistent", "ring"],
      totalCount: 0,
      page: 1,
      pageSize: 12,
      productIds: [],
      availableFacets: [],
      appliedFilters: [],
      sort: "relevance",
    };
    const search = {
      ...material,
      resultFingerprint: storefrontSearchResultFingerprint(material),
    };
    const productList = instance.bindings.find((binding) => binding.source === "productList");
    if (!productList || productList.source !== "productList")
      throw new Error("Missing product list.");
    productList.productIds = [];
    productList.revision = search.resultFingerprint;
    instance.bindings = instance.bindings.filter(
      ({ slotId }) => slotId !== "primaryCollection" && slotId !== "childCollections",
    );
    projection.products = [];
    projection.assets = [];
    projection.collections = [];
    projection.productListRevision = search.resultFingerprint;
    instance.assetAssignments = [];
    const markup = renderToStaticMarkup(
      renderDynamicCollectionCommerce({
        target: "preview",
        instance,
        projection,
        activeLocale: "en",
        primaryLocale: "en",
        loading: { status: "ready" },
        search,
        resolveAssetUrl: result.presentation.resolveAssetUrl,
        onNavigateProduct: () => undefined,
        onNavigateCollection: () => undefined,
        onFilterIntent: () => undefined,
        onSortIntent: () => undefined,
        onContinueShopping: () => undefined,
      }),
    );
    expect(markup).toContain('data-search-zero-results="true"');
    expect(markup).toContain('data-search-query="nonexistent ring"');
    expect(markup).toContain("No products match");
    expect(markup).not.toMatch(/canonical products/i);
    expect(markup).not.toContain('data-card-context="searchResults"');
  });

  it("renders comparison search as a query-led transient result experience", () => {
    const result = lifecycle("collection-catalogue-comparison");
    const instance = structuredClone(result.presentation.instance);
    const projection = structuredClone(result.presentation.projection);
    const productIds = projection.products.slice(0, 2).map(({ productId }) => productId);
    const material: StorefrontSearchResultMaterialV1 = {
      contractVersion: STOREFRONT_SEARCH_RESULTS_CONTRACT_VERSION,
      state: "results",
      requestFingerprint: "p10b18b03-comparison-search-request",
      catalogueFingerprint: canonicalValueFingerprint(result.fixture.aggregate.catalogue),
      authorityFingerprint: "p10b18b03-comparison-search-authority",
      normalizedQuery: "gold watch",
      normalizedTerms: ["gold", "watch"],
      totalCount: productIds.length,
      page: 1,
      pageSize: 12,
      productIds,
      availableFacets: [
        {
          field: "stockStatus",
          values: [
            { value: "inStock", count: 1 },
            { value: "lowStock", count: 1 },
          ],
        },
      ],
      appliedFilters: [{ field: "stockStatus", values: ["inStock"] }],
      sort: "price-ascending",
    };
    const search = { ...material, resultFingerprint: storefrontSearchResultFingerprint(material) };
    const productList = instance.bindings.find((binding) => binding.source === "productList");
    if (!productList || productList.source !== "productList") {
      throw new Error("Missing product list.");
    }
    productList.productIds = productIds;
    productList.revision = search.resultFingerprint;
    instance.bindings = instance.bindings.filter(
      ({ slotId }) => slotId !== "primaryCollection" && slotId !== "childCollections",
    );
    projection.products = projection.products.filter(({ productId }) =>
      productIds.includes(productId),
    );
    const productAssetIds = new Set(
      projection.products.flatMap((product) => product.media.map(({ assetId }) => assetId)),
    );
    projection.assets = projection.assets.filter(({ assetId }) => productAssetIds.has(assetId));
    projection.collections = [];
    projection.productListRevision = search.resultFingerprint;
    instance.assetAssignments = instance.assetAssignments.filter(({ assetId }) =>
      productAssetIds.has(assetId),
    );
    const markup = renderToStaticMarkup(
      renderDynamicCollectionCommerce({
        target: "preview",
        instance,
        projection,
        activeLocale: "en",
        primaryLocale: "en",
        loading: { status: "ready" },
        search,
        resolveAssetUrl: result.presentation.resolveAssetUrl,
        onNavigateProduct: () => undefined,
        onNavigateCollection: () => undefined,
        onFilterIntent: () => undefined,
        onSortIntent: () => undefined,
        onContinueShopping: () => undefined,
      }),
    );

    expect(markup).toContain("Search results");
    expect(markup).toContain("gold watch");
    expect(markup).toContain('data-search-state-summary="true"');
    expect(markup).toContain("Price, low to high");
    expect(markup).toContain('data-search-filter="stockStatus"');
    expect(markup).toContain('data-card-context="searchResults"');
    expect(markup).toContain('data-card-anatomy="standard"');
    expect(markup).toContain('data-catalogue-cardinality="small"');
    expect(markup).not.toContain("Canonical collection description");
  });

  it("retains every profile through save/reload and deterministic publication", async () => {
    for (const profileId of commercialCollectionSearchProfileIds) {
      const result = lifecycle(profileId);
      expect(
        result.snapshot.pages.flatMap((page) =>
          page.sections
            .filter((section) =>
              ["announcementBar", "header", "footer"].includes(section.component),
            )
            .map((section) => `${page.id}:${section.component}`),
        ),
      ).toEqual([]);
      const repository = new InMemoryProjectRepository([result.fixture.aggregate]);
      await repository.saveDraft(result.snapshot.projectId, result.snapshot, {
        id: result.fixture.draft.id,
        revision: result.fixture.draft.revision,
      });
      const aggregate = await repository.get(result.snapshot.projectId);
      const draft = aggregate.snapshots.find(
        (candidate) => candidate.id === aggregate.project.draftSnapshotId,
      )!;
      expect(canonicalStorefrontContentFingerprint(draft)).toBe(
        canonicalStorefrontContentFingerprint(result.snapshot),
      );
      const publication = compileStorefrontPublication(
        createCurrentPublishCompilerInput({
          aggregate,
          snapshot: draft,
          sourceAuthority: { kind: "manual" },
          currentEvidenceReferences: evidenceReferences(result.fixture),
        }),
      );
      expect(
        publication.result.pages
          .find((entry) => entry.page.type === "collection")!
          .page.sections.map((section) => [section.component, section.variant]),
      ).toEqual(
        draft.pages
          .find((page) => page.type === "collection")!
          .sections.map((section) => [section.component, section.variant]),
      );
    }
  });
});
