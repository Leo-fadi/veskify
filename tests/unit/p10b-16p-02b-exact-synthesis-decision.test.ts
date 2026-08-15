import { describe, expect, it } from "vitest";
import {
  BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION,
  boundedStorefrontSynthesisDecisionSchema,
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
  validateBoundedStorefrontSynthesisDecision,
  type BoundedStorefrontSynthesisError,
} from "@/application/bounded-storefront-synthesis";
import {
  resolveDynamicCommerceRoutePage,
  type DynamicCommerceDesignSelection,
} from "@/application/dynamic-commerce-routes";
import {
  replayWholeStorefrontProposalOperations,
  validateWholeStorefrontProposal,
} from "@/application/whole-storefront-proposal-lifecycle";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
} from "@/domain/storefront";

function exactInput() {
  const source = createP10B14PremiumEditorialFixture();
  const draft = {
    ...structuredClone(source.fixture.planningInput.draft),
    dynamicCommercePresentation: structuredClone(source.slice.snapshot.dynamicCommercePresentation),
  };
  const authority = draft.dynamicCommercePresentation;
  if (!authority) throw new Error("Missing current dynamic-commerce test authority.");
  const collection = authority.collectionSearchArchetypes.find(({ supportedContexts }) =>
    supportedContexts.includes("collection"),
  );
  const search = authority.collectionSearchArchetypes.find(({ supportedContexts }) =>
    supportedContexts.includes("search"),
  );
  if (!collection || !search) throw new Error("Missing current collection/search archetypes.");
  const product = authority.productDetailArchetypes.find(
    ({ id }) => id !== authority.fallbacks.productDetailArchetypeId,
  );
  if (!product) throw new Error("Missing current product archetype.");
  const productTypeMappings = Object.fromEntries(
    [...authority.productTypeMappings]
      .reverse()
      .map(({ productTypeId, archetypeId }) => [productTypeId, archetypeId]),
  );
  const dynamicCommerceSelection: DynamicCommerceDesignSelection = {
    authorityFingerprint: authority.authorityFingerprint,
    collectionArchetypeId: collection.id,
    searchArchetypeId: search.id,
    standardSimpleArchetypeId: product.id,
    configurableArchetypeId: product.id,
    galleryLedArchetypeId: product.id,
    highConsiderationArchetypeId: product.id,
    genericFallbackArchetypeId: authority.fallbacks.productDetailArchetypeId,
    productTypeMappings,
  };
  const pageBlueprintSelectionOverrides = [
    {
      pageType: "home" as const,
      profileId: "homepage-editorial-storytelling",
      slotSelections: [
        {
          slotId: "hero",
          component: "homepageHero",
          variant: "fullBleedOverlay",
          boundedParameters: { mediaPlacement: "background" },
        },
      ],
    },
  ];
  return {
    source,
    authority,
    input: {
      planningInput: { ...source.fixture.planningInput, draft },
      siteMapDecision: source.siteMapDecision,
      approvedEvidenceReferences: source.approvedEvidenceReferences,
      request: { intent: "editorial-led" as const, deterministicSeed: "exact-p02b" },
      pageBlueprintSelectionOverrides,
      dynamicCommerceSelection,
    },
  };
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return (error as BoundedStorefrontSynthesisError).code;
  }
  return undefined;
}

describe("P10B-16P-02B exact extended synthesis decision", () => {
  it("fingerprints, replays, and canonically materializes exact execution selections", () => {
    const { source, authority, input } = exactInput();
    const draftBefore = canonicalValueString(input.planningInput.draft);
    const first = createBoundedStorefrontSynthesisDecision(input);
    const second = createBoundedStorefrontSynthesisDecision({
      ...input,
      dynamicCommerceSelection: {
        ...input.dynamicCommerceSelection,
        productTypeMappings: Object.fromEntries(
          Object.entries(input.dynamicCommerceSelection.productTypeMappings).reverse(),
        ),
      },
    });

    expect(first).toEqual(second);
    expect(first.contractVersion).toBe(BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION);
    expect(first.pageBlueprintSelectionOverrides).toEqual(input.pageBlueprintSelectionOverrides);
    expect(first.dynamicCommerceSelection).toEqual({
      ...input.dynamicCommerceSelection,
      productTypeMappings: Object.fromEntries(
        Object.entries(input.dynamicCommerceSelection.productTypeMappings).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    });
    expect(first.exactSelectionAuthority.pageBlueprintSelectionFingerprint).toMatch(
      /^bounded-page-blueprint-selections-/,
    );
    expect(first.exactSelectionAuthority.dynamicCommerceAuthorityFingerprint).toBe(
      authority.authorityFingerprint,
    );
    expect(first.exactSelectionAuthority.dynamicCommerceSelectionFingerprint).toMatch(
      /^bounded-dynamic-commerce-selection-/,
    );
    expect(first.componentChoices).toContainEqual(
      expect.objectContaining({
        slotId: "hero",
        component: "homepageHero",
        variant: "fullBleedOverlay",
      }),
    );
    expect(validateBoundedStorefrontSynthesisDecision(first, input)).toEqual(first);
    expect(canonicalValueString(input.planningInput.draft)).toBe(draftBefore);

    const result = executeBoundedStorefrontSynthesis({
      ...input,
      decision: first,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });
    const homepage = result.materialization.snapshot.pages.find(({ type }) => type === "home");
    expect(homepage?.sections.find(({ component }) => component === "homepageHero")).toMatchObject({
      variant: "fullBleedOverlay",
      props: { mediaPosition: "background" },
    });
    expect(
      result.materialization.snapshot.dynamicCommercePresentation?.collectionRouteMappings.every(
        ({ archetypeId }) => archetypeId === input.dynamicCommerceSelection.collectionArchetypeId,
      ),
    ).toBe(true);
    expect(result.materialization.snapshot.dynamicCommercePresentation?.searchArchetypeId).toBe(
      input.dynamicCommerceSelection.searchArchetypeId,
    );
    expect(
      Object.fromEntries(
        result.materialization.snapshot.dynamicCommercePresentation?.productTypeMappings.map(
          ({ productTypeId, archetypeId }) => [productTypeId, archetypeId],
        ) ?? [],
      ),
    ).toEqual(first.dynamicCommerceSelection?.productTypeMappings);
  });

  it("reconciles migrated route identities before exact site-map rematerialization", () => {
    const { source, authority, input } = exactInput();
    const routeForPage = (page: (typeof input.siteMapDecision.pages)[number]) =>
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
    const migratedRouteIds = new Set(authority.routeInventory.map(({ id }) => id));
    expect(input.planningInput.draft.pages.every(({ id }) => !migratedRouteIds.has(id))).toBe(true);

    const siteMapDecision = {
      ...input.siteMapDecision,
      pages: input.siteMapDecision.pages.map((page) => {
        const route = routeForPage(page);
        return route ? { ...page, existingPageId: route.id } : page;
      }),
    };
    expect(
      siteMapDecision.pages
        .filter(({ familyId }) =>
          ["collection", "search-results", "product-detail"].includes(familyId),
        )
        .every(({ existingPageId }) => migratedRouteIds.has(existingPageId ?? "")),
    ).toBe(true);

    const migratedInput = { ...input, siteMapDecision };
    const decision = createBoundedStorefrontSynthesisDecision(migratedInput);
    const result = executeBoundedStorefrontSynthesis({
      ...migratedInput,
      decision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });
    const { plan, planningInput, proposal, snapshot } = result.materialization;
    const materializedAuthority = snapshot.dynamicCommercePresentation;
    expect(materializedAuthority?.routeInventory).toEqual(authority.routeInventory);
    expect(materializedAuthority?.collectionRouteMappings.map(({ routeId }) => routeId)).toEqual(
      authority.collectionRouteMappings.map(({ routeId }) => routeId),
    );
    expect(materializedAuthority?.productTypeMappings).toEqual(
      proposal.proposedStorefront.dynamicCommercePresentation?.productTypeMappings,
    );
    expect(materializedAuthority?.searchArchetypeId).toBe(
      input.dynamicCommerceSelection.searchArchetypeId,
    );
    expect(snapshot.pages.every(({ id }) => !migratedRouteIds.has(id))).toBe(true);

    for (const route of authority.routeInventory.filter(({ kind }) => kind !== "search")) {
      expect(
        resolveDynamicCommerceRoutePage({
          snapshot,
          catalogue: planningInput.catalogue,
          routeId: route.id,
        }).page.id,
      ).toBe(route.id);
    }
    expect(validateWholeStorefrontProposal(proposal, { plan, planningInput })).toEqual(proposal);
    expect(
      replayWholeStorefrontProposalOperations(proposal.originalStorefront, proposal.operations)
        .dynamicCommercePresentation,
    ).toEqual(proposal.proposedStorefront.dynamicCommercePresentation);
  });

  it("fails closed without mutation when a migrated route identity does not match the site-map page", () => {
    const { source, authority, input } = exactInput();
    const collectionPage = input.siteMapDecision.pages.find(
      ({ familyId }) => familyId === "collection",
    );
    const productRoute = authority.routeInventory.find(({ kind }) => kind === "product");
    if (!collectionPage || !productRoute) {
      throw new Error("Missing collection page or product route fixture authority.");
    }
    const siteMapDecision = {
      ...input.siteMapDecision,
      pages: input.siteMapDecision.pages.map((page) =>
        page.key === collectionPage.key ? { ...page, existingPageId: productRoute.id } : page,
      ),
    };
    const mismatchedInput = { ...input, siteMapDecision };
    const decision = createBoundedStorefrontSynthesisDecision(mismatchedInput);
    const draftBefore = canonicalValueString(input.planningInput.draft);

    expect(() =>
      executeBoundedStorefrontSynthesis({
        ...mismatchedInput,
        decision,
        pageEvidenceAuthority: source.pageEvidenceAuthority,
        contentFactAuthority: source.contentFactAuthority,
        approvedAssetPresentations: source.fixture.assetPresentations,
      }),
    ).toThrow(expect.objectContaining({ code: "missing-existing-page" }));
    expect(canonicalValueString(input.planningInput.draft)).toBe(draftBefore);
  });

  it("preserves omitted and explicit-empty migrated related-product lists as empty", () => {
    const { source, authority, input } = exactInput();
    const retainedProductRoute = authority.routeInventory.find(({ kind }) => kind === "product");
    if (!retainedProductRoute || retainedProductRoute.kind !== "product") {
      throw new Error("Missing retained product-route fixture authority.");
    }
    for (const relatedProductsMode of ["omitted", "explicit-empty"] as const) {
      const routeInventory = authority.routeInventory.map((route) => {
        if (route.id !== retainedProductRoute.id || route.kind !== "product") return route;
        if (relatedProductsMode === "explicit-empty") {
          return { ...route, relatedProductIds: [] };
        }
        const { relatedProductIds: _relatedProductIds, ...withoutRelatedProducts } = route;
        void _relatedProductIds;
        return withoutRelatedProducts;
      });
      const { authorityFingerprint: _authorityFingerprint, ...authorityMaterial } = authority;
      void _authorityFingerprint;
      const retainedAuthority = createDynamicCommercePresentationAuthority({
        ...authorityMaterial,
        routeInventory,
      });
      const planningInput = {
        ...input.planningInput,
        draft: {
          ...input.planningInput.draft,
          dynamicCommercePresentation: retainedAuthority,
        },
      };
      const siteMapDecision = {
        ...input.siteMapDecision,
        pages: input.siteMapDecision.pages.map((page) =>
          page.familyId === "product-detail" &&
          page.commerceContext.kind === "product" &&
          page.commerceContext.productId === retainedProductRoute.productId
            ? { ...page, existingPageId: retainedProductRoute.id }
            : page,
        ),
      };
      const retainedInput = {
        ...input,
        planningInput,
        siteMapDecision,
        dynamicCommerceSelection: {
          ...input.dynamicCommerceSelection,
          authorityFingerprint: retainedAuthority.authorityFingerprint,
        },
      };
      const decision = createBoundedStorefrontSynthesisDecision(retainedInput);
      const result = executeBoundedStorefrontSynthesis({
        ...retainedInput,
        decision,
        pageEvidenceAuthority: source.pageEvidenceAuthority,
        contentFactAuthority: source.contentFactAuthority,
        approvedAssetPresentations: source.fixture.assetPresentations,
      });
      const finalRoute =
        result.materialization.snapshot.dynamicCommercePresentation?.routeInventory.find(
          ({ id }) => id === retainedProductRoute.id,
        );

      expect(finalRoute).toMatchObject({ id: retainedProductRoute.id, kind: "product" });
      expect({
        relatedProductsMode,
        relatedProductIds:
          finalRoute?.kind === "product" ? (finalRoute.relatedProductIds ?? []) : null,
      }).toEqual({ relatedProductsMode, relatedProductIds: [] });
    }
  });

  it("fails closed for mismatched profile, stale dynamic authority, or replay without selections", () => {
    const { input } = exactInput();
    const decision = createBoundedStorefrontSynthesisDecision(input);
    const tamperedAuthority = {
      ...decision,
      exactSelectionAuthority: {
        ...decision.exactSelectionAuthority,
        dynamicCommerceAuthorityFingerprint: "tampered-authority",
      },
    };
    const { synthesisFingerprint: _fingerprint, ...tamperedMaterial } = tamperedAuthority;
    void _fingerprint;
    expect(
      boundedStorefrontSynthesisDecisionSchema.safeParse({
        ...tamperedAuthority,
        synthesisFingerprint: `bounded-storefront-synthesis-${canonicalValueFingerprint(
          tamperedMaterial,
        )}`,
      }).success,
    ).toBe(false);
    expect(
      errorCode(() =>
        createBoundedStorefrontSynthesisDecision({
          ...input,
          pageBlueprintSelectionOverrides: [
            {
              ...input.pageBlueprintSelectionOverrides[0],
              profileId: "homepage-campaign-led",
            },
          ],
        }),
      ),
    ).toBe("invalid-bounded-override");
    expect(
      errorCode(() =>
        createBoundedStorefrontSynthesisDecision({
          ...input,
          dynamicCommerceSelection: {
            ...input.dynamicCommerceSelection,
            authorityFingerprint: "stale-dynamic-authority",
          },
        }),
      ),
    ).toBe("stale-authority");
    expect(
      errorCode(() =>
        createBoundedStorefrontSynthesisDecision({
          ...input,
          dynamicCommerceSelection: {
            ...input.dynamicCommerceSelection,
            productTypeMappings: {},
          },
        }),
      ),
    ).toBe("invalid-bounded-override");
    expect(
      errorCode(() =>
        validateBoundedStorefrontSynthesisDecision(decision, {
          planningInput: input.planningInput,
          siteMapDecision: input.siteMapDecision,
          approvedEvidenceReferences: input.approvedEvidenceReferences,
          request: input.request,
        }),
      ),
    ).toBe("stale-authority");
  });
});
