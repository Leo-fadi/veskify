import { describe, expect, it } from "vitest";
import {
  applyDynamicCommerceArchetypePage,
  DynamicCommerceRouteAuthorityError,
  expandDynamicCommerceRoutePages,
  migrateLegacyDynamicCommerceRoutes,
  projectDynamicCommerceArchetypePages,
  resolveCollectionContextArchetype,
  resolveDynamicCommerceRoutePage,
  resolveProductComplexityArchetype,
} from "@/application/dynamic-commerce-routes";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  createDynamicCommercePresentationAuthority,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";
import type { ProjectAggregate } from "@/services/storage";
import {
  createLegacyDynamicCommerceRouteScenario,
  scaleCurrentDynamicCommerceProducts,
} from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";

function migratedScenario() {
  const scenario = createLegacyDynamicCommerceRouteScenario();
  const result = migrateLegacyDynamicCommerceRoutes(scenario.legacySnapshot, scenario.catalogue);
  if (result.status !== "migrated") {
    throw new Error(`Expected deterministic migration, received ${result.status}.`);
  }
  return { ...scenario, result };
}

function expectInvalidPresentation(operation: () => unknown, message: RegExp): void {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(DynamicCommerceRouteAuthorityError);
    if (!(error instanceof DynamicCommerceRouteAuthorityError)) throw error;
    expect(error.code).toBe("invalid-presentation");
    expect(error.message).toMatch(message);
    return;
  }
  throw new Error("Expected matching-rule selection to fail closed.");
}

describe("P10B-16P-01 dynamic commerce route archetype authority", () => {
  it("migrates ten PDP and nine collection routes into bounded archetype authority", () => {
    const { catalogue, result } = migratedScenario();
    const authority = result.authority;
    const projections = projectDynamicCommerceArchetypePages(result.snapshot, catalogue);
    const productProjections = projections.filter(
      ({ archetype }) => archetype.family === "product-detail",
    );
    const collectionProjections = projections.filter(
      ({ archetype }) => archetype.family === "collection-search",
    );

    expect(catalogue.products).toHaveLength(10);
    expect(catalogue.collections).toHaveLength(9);
    expect(authority.routeInventory.filter(({ kind }) => kind === "product")).toHaveLength(10);
    expect(authority.routeInventory.filter(({ kind }) => kind === "collection")).toHaveLength(9);
    expect(authority.routeInventory.filter(({ kind }) => kind === "search")).toHaveLength(1);
    expect(productProjections).toHaveLength(authority.productDetailArchetypes.length);
    expect(collectionProjections).toHaveLength(authority.collectionSearchArchetypes.length);
    expect(productProjections.length).toBeLessThan(10);
    expect(collectionProjections.length).toBeLessThan(9);
    const frameProfileId = result.snapshot.sharedFrame?.profileId;
    expect(frameProfileId).toBeTruthy();
    expect(
      [...authority.collectionSearchArchetypes, ...authority.productDetailArchetypes].every(
        ({ compatibleSharedFrameProfileIds }) =>
          frameProfileId ? compatibleSharedFrameProfileIds.includes(frameProfileId) : true,
      ),
    ).toBe(true);
    expect(
      authority.collectionSearchArchetypes.find(({ id }) => id === authority.searchArchetypeId)
        ?.supportedContexts,
    ).toContain("search");
    expect(
      authority.collectionSearchArchetypes.some(
        ({ id }) => id === authority.fallbacks.collectionArchetypeId,
      ),
    ).toBe(true);
    expect(
      authority.productDetailArchetypes.some(
        ({ id }) => id === authority.fallbacks.productDetailArchetypeId,
      ),
    ).toBe(true);
    expect(
      result.snapshot.pages.some(({ pageFamily }) => pageFamily?.familyId === "product-detail"),
    ).toBe(false);
    expect(
      result.snapshot.pages.some(({ pageFamily }) => pageFamily?.familyId === "collection"),
    ).toBe(false);
    expect(
      result.snapshot.pages.some(({ pageFamily }) => pageFamily?.familyId === "search-results"),
    ).toBe(false);
  });

  it("keeps editable design cardinality stable when the catalogue grows to 1,000 products", () => {
    const { catalogue, result } = migratedScenario();
    const baselineProjections = projectDynamicCommerceArchetypePages(result.snapshot, catalogue);
    const scaled = scaleCurrentDynamicCommerceProducts(result.snapshot, catalogue, 1_000);
    const scaledProjections = projectDynamicCommerceArchetypePages(
      scaled.snapshot,
      scaled.catalogue,
    );

    expect(scaled.catalogue.products).toHaveLength(1_000);
    expect(
      scaled.snapshot.dynamicCommercePresentation?.routeInventory.filter(
        ({ kind }) => kind === "product",
      ),
    ).toHaveLength(1_000);
    expect(scaledProjections.map(({ archetype }) => archetype.id)).toEqual(
      baselineProjections.map(({ archetype }) => archetype.id),
    );
    expect(scaled.snapshot.pages).toHaveLength(result.snapshot.pages.length);
  });

  it("executes stored matching rules deterministically while runtime requires a type mapping", () => {
    const { catalogue, result } = migratedScenario();
    const authority = result.authority;
    const productRoute = authority.routeInventory.find(({ kind }) => kind === "product");
    if (!productRoute || productRoute.kind !== "product") {
      throw new Error("Expected a product route.");
    }
    const product = catalogue.products.find(({ id }) => id === productRoute.productId);
    if (!product) throw new Error("Expected the exact routed product.");
    const productTypeId = canonicalProductTypePresentationId(product.productType);
    const { authorityFingerprint: _fingerprint, ...sourceMaterial } = authority;
    void _fingerprint;
    const ruleOnlyAuthority = createDynamicCommercePresentationAuthority({
      ...structuredClone(sourceMaterial),
      productTypeMappings: sourceMaterial.productTypeMappings.filter(
        (mapping) => mapping.productTypeId !== productTypeId,
      ),
    });
    const ruleOnlySnapshot = storefrontSnapshotSchema.parse({
      ...result.snapshot,
      dynamicCommercePresentation: ruleOnlyAuthority,
    });
    const baselineProductArchetype = resolveProductComplexityArchetype({
      product,
      rules: ruleOnlyAuthority.productComplexityRules,
    });
    const alternativeProductArchetype = authority.productDetailArchetypes.find(
      ({ id }) => id !== baselineProductArchetype,
    )?.id;
    if (!alternativeProductArchetype) throw new Error("Expected a second PDP archetype.");
    const changedProductAuthority = createDynamicCommercePresentationAuthority({
      ...structuredClone(sourceMaterial),
      productTypeMappings: sourceMaterial.productTypeMappings.filter(
        (mapping) => mapping.productTypeId !== productTypeId,
      ),
      productComplexityRules: sourceMaterial.productComplexityRules.map((rule) => ({
        ...structuredClone(rule),
        archetypeId: alternativeProductArchetype,
      })),
    });
    const changedProductSnapshot = storefrontSnapshotSchema.parse({
      ...result.snapshot,
      dynamicCommercePresentation: changedProductAuthority,
    });
    expect(
      resolveProductComplexityArchetype({
        product,
        rules: changedProductAuthority.productComplexityRules,
      }),
    ).toBe(alternativeProductArchetype);
    expect(
      resolveDynamicCommerceRoutePage({
        snapshot: ruleOnlySnapshot,
        catalogue,
        routeId: productRoute.id,
      }).archetype.id,
    ).toBe(ruleOnlyAuthority.fallbacks.productDetailArchetypeId);
    expect(
      resolveDynamicCommerceRoutePage({
        snapshot: changedProductSnapshot,
        catalogue,
        routeId: productRoute.id,
      }).archetype.id,
    ).toBe(changedProductAuthority.fallbacks.productDetailArchetypeId);

    const collectionContext = {
      depth: 0,
      productCount: 2,
      childCollections: false,
      campaignEvidence: false,
      merchandisingDensity: "standard" as const,
    };
    const baselineCollectionArchetype = resolveCollectionContextArchetype({
      context: collectionContext,
      rules: authority.collectionContextRules,
    });
    const alternativeCollectionArchetype = authority.collectionSearchArchetypes.find(
      ({ id }) => id !== baselineCollectionArchetype,
    )?.id;
    if (!alternativeCollectionArchetype) {
      throw new Error("Expected a second collection archetype.");
    }
    expect(
      resolveCollectionContextArchetype({
        context: collectionContext,
        rules: authority.collectionContextRules.map((rule) => ({
          ...structuredClone(rule),
          archetypeId: alternativeCollectionArchetype,
        })),
      }),
    ).toBe(alternativeCollectionArchetype);
  });

  it("fails closed with typed deterministic errors for unsupported or ambiguous matching rules", () => {
    const { catalogue, result } = migratedScenario();
    const product = catalogue.products[0];
    const productArchetypeId = result.authority.productDetailArchetypes[0].id;
    const collectionArchetypeId = result.authority.collectionSearchArchetypes[0].id;

    expectInvalidPresentation(
      () => resolveProductComplexityArchetype({ product, rules: [] }),
      /No registered product matching rule/i,
    );
    expectInvalidPresentation(
      () =>
        resolveProductComplexityArchetype({
          product,
          rules: [
            {
              id: "ambiguous_product_a",
              priority: 10,
              match: {
                optionStructure: "any",
                mediaAvailability: "any",
                highConsideration: "any",
              },
              archetypeId: productArchetypeId,
            },
            {
              id: "ambiguous_product_b",
              priority: 10,
              match: {
                optionStructure: "any",
                mediaAvailability: "any",
                highConsideration: "any",
              },
              archetypeId: productArchetypeId,
            },
          ],
        }),
      /ambiguous rules at priority 10/i,
    );

    const collectionContext = {
      depth: 0,
      productCount: 2,
      childCollections: false,
      campaignEvidence: false,
      merchandisingDensity: "standard" as const,
    };
    expectInvalidPresentation(
      () => resolveCollectionContextArchetype({ context: collectionContext, rules: [] }),
      /No registered collection matching rule/i,
    );
    expectInvalidPresentation(
      () =>
        resolveCollectionContextArchetype({
          context: collectionContext,
          rules: [
            {
              id: "ambiguous_collection_a",
              priority: 20,
              match: {
                childCollections: "any",
                campaignEvidence: "any",
                merchandisingDensity: "any",
              },
              archetypeId: collectionArchetypeId,
            },
            {
              id: "ambiguous_collection_b",
              priority: 20,
              match: {
                childCollections: "any",
                campaignEvidence: "any",
                merchandisingDensity: "any",
              },
              archetypeId: collectionArchetypeId,
            },
          ],
        }),
      /ambiguous rules at priority 20/i,
    );
  });

  it("resolves every compact route through exact collection, search, product-type, or matching-rule authority", () => {
    const { catalogue, legacySnapshot, result } = migratedScenario();
    const authority = result.authority;
    for (const route of authority.routeInventory) {
      if (route.kind === "search") {
        expect(() =>
          resolveDynamicCommerceRoutePage({
            snapshot: result.snapshot,
            catalogue,
            routeId: route.id,
          }),
        ).toThrow(/exact transient canonical search-result projection/i);
        continue;
      }
      const resolved = resolveDynamicCommerceRoutePage({
        snapshot: result.snapshot,
        catalogue,
        routeId: route.id,
      });
      expect(resolved.route).toEqual(route);
      expect(resolved.page.slug).toBe(route.route);
      expect(resolved.page.id).toBe(route.id);
      if (route.kind === "collection") {
        const mapping = authority.collectionRouteMappings.find(
          ({ routeId }) => routeId === route.id,
        );
        expect(resolved.archetype.id).toBe(mapping?.archetypeId);
        expect(resolved.page.sections[0]?.content).toMatchObject({
          collectionId: route.collectionId,
          productIds: catalogue.collections.find(({ id }) => id === route.collectionId)?.productIds,
        });
      } else {
        const product = catalogue.products.find(({ id }) => id === route.productId)!;
        const mapping = authority.productTypeMappings.find(
          ({ productTypeId }) =>
            productTypeId === canonicalProductTypePresentationId(product.productType),
        );
        expect(resolved.archetype.id).toBe(
          mapping?.archetypeId ?? authority.fallbacks.productDetailArchetypeId,
        );
        const legacyPage = legacySnapshot.pages.find(({ id }) => id === route.id);
        const expectedRelatedProductIds = legacyPage?.sections[0]?.content.relatedProductIds;
        expect(Array.isArray(expectedRelatedProductIds)).toBe(true);
        expect(route.relatedProductIds).toEqual(expectedRelatedProductIds);
        expect(resolved.page.sections[0]?.content).toMatchObject({
          productId: route.productId,
          relatedProductIds: expectedRelatedProductIds,
        });
      }
    }

    expect(new Set(catalogue.products.map(({ productType }) => productType)).size).toBeGreaterThan(
      2,
    );
    expect(new Set(authority.productTypeMappings.map(({ archetypeId }) => archetypeId)).size).toBe(
      1,
    );

    const fallbackProduct = catalogue.products.find(({ productType }) =>
      productType.startsWith("scale-type-"),
    )!;
    expect(fallbackProduct.orderOptions ?? []).toHaveLength(0);
    expect(fallbackProduct.variants).toHaveLength(0);
    expect(fallbackProduct.images).toHaveLength(1);
    const fallbackRoute = authority.routeInventory.find(
      (route) => route.kind === "product" && route.productId === fallbackProduct.id,
    )!;
    const fallbackTypeId = canonicalProductTypePresentationId(fallbackProduct.productType);
    const { authorityFingerprint: _fingerprint, ...material } = authority;
    void _fingerprint;
    const fallbackAuthority = createDynamicCommercePresentationAuthority({
      ...structuredClone(material),
      productTypeMappings: authority.productTypeMappings.filter(
        ({ productTypeId }) => productTypeId !== fallbackTypeId,
      ),
    });
    const fallbackSnapshot = storefrontSnapshotSchema.parse({
      ...result.snapshot,
      dynamicCommercePresentation: fallbackAuthority,
    });
    expect(
      resolveDynamicCommerceRoutePage({
        snapshot: fallbackSnapshot,
        catalogue,
        routeId: fallbackRoute.id,
      }).archetype.id,
    ).toBe(fallbackAuthority.fallbacks.productDetailArchetypeId);
  });

  it("uses the generic fallback for an unmapped high-consideration type without changing commerce", () => {
    const { catalogue, project, result } = migratedScenario();
    const authority = result.authority;
    const fallbackArchetypeId = authority.fallbacks.productDetailArchetypeId;
    const configurableProduct = catalogue.products.find(
      (product) =>
        (product.orderOptions?.length ?? 0) > 1 &&
        product.images.length > 1 &&
        resolveProductComplexityArchetype({
          product,
          rules: authority.productComplexityRules,
        }) !== fallbackArchetypeId,
    );
    if (!configurableProduct) {
      throw new Error("Expected a configurable, media-rich product with a non-generic rule match.");
    }
    const productRoute = authority.routeInventory.find(
      (route) => route.kind === "product" && route.productId === configurableProduct.id,
    );
    if (!productRoute) throw new Error("Expected the configurable product route.");
    const renamedCatalogue = structuredClone(catalogue);
    const renamedProduct = renamedCatalogue.products.find(
      ({ id }) => id === configurableProduct.id,
    )!;
    renamedProduct.productType = "new-unregistered-configurable-product-type";
    const renamedProductTypeId = canonicalProductTypePresentationId(renamedProduct.productType);
    expect(renamedProduct.orderOptions?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(renamedProduct.variants.length).toBeGreaterThan(1);
    expect(renamedProduct.images.length).toBeGreaterThan(1);

    expect(
      authority.productTypeMappings.some(
        ({ productTypeId }) => productTypeId === renamedProductTypeId,
      ),
    ).toBe(false);
    expect(
      resolveProductComplexityArchetype({
        product: renamedProduct,
        rules: authority.productComplexityRules,
      }),
    ).not.toBe(fallbackArchetypeId);
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot: result.snapshot,
      catalogue: renamedCatalogue,
      routeId: productRoute.id,
    });
    expect(resolved.archetype.id).toBe(fallbackArchetypeId);
    expect(resolved.page.sections[0]?.content).toMatchObject({
      productId: renamedProduct.id,
    });

    const aggregate: ProjectAggregate = {
      project: structuredClone(project),
      catalogue: structuredClone(renamedCatalogue),
      snapshots: [structuredClone(result.snapshot)],
    };
    const protectedBaseline = structuredClone(aggregate.catalogue);
    const protectedProduct = aggregate.catalogue.products.find(
      ({ id }) => id === renamedProduct.id,
    )!;
    const presentation = createCatalogueStorefrontCommerceRouteAdapter().product({
      aggregate,
      snapshot: result.snapshot,
      page: resolved.page,
      product: protectedProduct,
    });

    expect(presentation?.instance.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slotId: "primaryProduct",
          source: "product",
          productId: protectedProduct.id,
        }),
      ]),
    );
    expect(presentation?.productContext).toMatchObject({
      productId: protectedProduct.id,
      productTypeId: renamedProductTypeId,
      sku: protectedProduct.sku,
      price: protectedProduct.price,
      availability: protectedProduct.availabilityLabel,
    });
    expect(presentation?.productContext.optionGroups.length).toBeGreaterThanOrEqual(
      protectedProduct.orderOptions?.length ?? 0,
    );
    expect(presentation?.productContext.media.map(({ assetId }) => assetId)).toEqual(
      protectedProduct.images.map(({ id }) => id),
    );
    expect(aggregate.catalogue).toEqual(protectedBaseline);
  });

  it("recomputes runtime archetypes from canonical mappings and reserves overrides for editor projection", () => {
    const { catalogue, result } = migratedScenario();
    const authority = result.authority;
    const productRoute = authority.routeInventory.find(({ kind }) => kind === "product");
    if (!productRoute || productRoute.kind !== "product") {
      throw new Error("Expected a product route.");
    }
    const product = catalogue.products.find(({ id }) => id === productRoute.productId);
    if (!product) throw new Error("Expected the exact routed product.");
    const canonicalArchetypeId = authority.productTypeMappings.find(
      ({ productTypeId }) =>
        productTypeId === canonicalProductTypePresentationId(product.productType),
    )?.archetypeId;
    if (!canonicalArchetypeId) throw new Error("Expected a canonical product-type mapping.");
    const alternativeArchetypeId = authority.productDetailArchetypes.find(
      ({ id }) => id !== canonicalArchetypeId,
    )?.id;
    if (!alternativeArchetypeId) throw new Error("Expected an alternative PDP archetype.");

    const forgedRuntimeInput = {
      snapshot: result.snapshot,
      catalogue,
      routeId: productRoute.id,
      archetypeId: alternativeArchetypeId,
      projection: "runtime",
    } as unknown as Parameters<typeof resolveDynamicCommerceRoutePage>[0];
    const runtime = resolveDynamicCommerceRoutePage(forgedRuntimeInput);
    expect(runtime.archetype.id).toBe(canonicalArchetypeId);
    expect(runtime.page.id).toBe(productRoute.id);

    const editor = resolveDynamicCommerceRoutePage({
      snapshot: result.snapshot,
      catalogue,
      routeId: productRoute.id,
      archetypeId: alternativeArchetypeId,
      projection: "editor",
    });
    expect(editor.archetype.id).toBe(alternativeArchetypeId);
    expect(editor.page.id).toBe(alternativeArchetypeId);
  });

  it("expands only exact concrete commerce routes for legacy consumers", () => {
    const { catalogue, result } = migratedScenario();
    const expanded = expandDynamicCommerceRoutePages(result.snapshot, catalogue);

    expect(expanded.dynamicCommercePresentation).toBeUndefined();
    expect(expanded.pages.filter(({ type }) => type === "product")).toHaveLength(
      catalogue.products.length,
    );
    expect(expanded.pages.filter(({ type }) => type === "collection")).toHaveLength(
      catalogue.collections.length,
    );
    expect(expanded.pages.some(({ slug }) => slug === "/search")).toBe(false);
    expect(
      [...expanded.navigation.primary, ...expanded.navigation.footer].some(
        ({ target }) =>
          target.type === "page" && !expanded.pages.some(({ id }) => id === target.pageId),
      ),
    ).toBe(false);
  });

  it("projects configurable options, canonical media, and protected commerce from the exact current product", () => {
    const { catalogue, project, result } = migratedScenario();
    const configurable = catalogue.products.find(
      ({ orderOptions, variants }) => (orderOptions?.length ?? 0) > 1 && variants.length > 1,
    )!;
    const route = result.authority.routeInventory.find(
      (candidate) => candidate.kind === "product" && candidate.productId === configurable.id,
    )!;
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot: result.snapshot,
      catalogue,
      routeId: route.id,
    });
    const aggregate: ProjectAggregate = {
      project: structuredClone(project),
      catalogue: structuredClone(catalogue),
      snapshots: [structuredClone(result.snapshot)],
    };
    const protectedBaseline = structuredClone(aggregate.catalogue);
    const presentation = createCatalogueStorefrontCommerceRouteAdapter().product({
      aggregate,
      snapshot: result.snapshot,
      page: resolved.page,
      product: configurable,
    });

    expect(presentation).not.toBeNull();
    expect(presentation?.instance.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slotId: "primaryProduct",
          source: "product",
          productId: configurable.id,
        }),
      ]),
    );
    expect(presentation?.productContext.productId).toBe(configurable.id);
    expect(presentation?.productContext.price?.amount).toBe(configurable.price?.amount);
    expect(presentation?.productContext.optionGroups.length).toBeGreaterThanOrEqual(
      configurable.orderOptions?.length ?? 0,
    );
    expect(presentation?.productContext.media.map(({ assetId }) => assetId)).toEqual(
      configurable.images.map(({ id }) => id),
    );
    expect(aggregate.catalogue).toEqual(protectedBaseline);
  });

  it("migrates identical legacy authority deterministically and fails closed on conflicting choices", () => {
    const scenario = createLegacyDynamicCommerceRouteScenario();
    const first = migrateLegacyDynamicCommerceRoutes(scenario.legacySnapshot, scenario.catalogue);
    const second = migrateLegacyDynamicCommerceRoutes(scenario.legacySnapshot, scenario.catalogue);
    expect(first).toEqual(second);
    expect(first.status).toBe("migrated");

    const conflicting = structuredClone(scenario.legacySnapshot);
    const collectionPages = conflicting.pages.filter(
      ({ pageFamily }) => pageFamily?.familyId === "collection",
    );
    expect(collectionPages.length).toBeGreaterThan(1);
    collectionPages[1].sections[0].props = {
      ...collectionPages[1].sections[0].props,
      gridDensity:
        collectionPages[1].sections[0].props.gridDensity === "compact" ? "comfortable" : "compact",
    };
    const result = migrateLegacyDynamicCommerceRoutes(conflicting, scenario.catalogue);
    expect(result.status).toBe("requires-decision");
    if (result.status === "requires-decision") {
      expect(result.decisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "conflicting-legacy-presentation" }),
        ]),
      );
    }
  });

  it("returns typed decisions for incomplete, mismatched, unknown, or invalid legacy inputs", () => {
    const scenario = createLegacyDynamicCommerceRouteScenario();
    const decisionCodes = (
      snapshot: typeof scenario.legacySnapshot,
      catalogue = scenario.catalogue,
    ) => {
      const result = migrateLegacyDynamicCommerceRoutes(snapshot, catalogue);
      expect(result.status).toBe("requires-decision");
      if (result.status !== "requires-decision") {
        throw new Error("Expected a typed migration decision.");
      }
      return result.decisions.map(({ code }) => code);
    };

    const missingProfile = structuredClone(scenario.legacySnapshot);
    const missingProfilePage = missingProfile.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "product-detail",
    )!;
    missingProfilePage.pageFamily = undefined;
    expect(decisionCodes(missingProfile)).toContain("missing-profile-identity");

    const unknownProfile = structuredClone(scenario.legacySnapshot);
    const unknownProfilePage = unknownProfile.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "collection",
    )!;
    unknownProfilePage.pageFamily = {
      ...unknownProfilePage.pageFamily!,
      profileId: "collection-profile-not-registered",
    };
    expect(decisionCodes(unknownProfile)).toContain("unknown-profile");

    const mismatchedFamily = structuredClone(scenario.legacySnapshot);
    const mismatchedPage = mismatchedFamily.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "collection",
    )!;
    mismatchedPage.sections[0].component = "dynamicProductDetail";
    expect(decisionCodes(mismatchedFamily)).toContain("route-family-component-mismatch");

    const hiddenRequiredComposite = structuredClone(scenario.legacySnapshot);
    const hiddenRequiredPage = hiddenRequiredComposite.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "collection",
    )!;
    hiddenRequiredPage.sections[0].visible = false;
    expect(decisionCodes(hiddenRequiredComposite)).toContain("unsupported-legacy-layout");

    const unknownProduct = structuredClone(scenario.legacySnapshot);
    const unknownProductPage = unknownProduct.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "product-detail",
    )!;
    unknownProductPage.pageFamily = {
      ...unknownProductPage.pageFamily!,
      commerceContext: { kind: "product", productId: "product_not_in_catalogue" },
    };
    unknownProductPage.sections[0].content = {
      ...unknownProductPage.sections[0].content,
      productId: "product_not_in_catalogue",
    };
    expect(decisionCodes(unknownProduct)).toContain("unknown-commerce-identity");

    const unknownRelatedProduct = structuredClone(scenario.legacySnapshot);
    const unknownRelatedProductPage = unknownRelatedProduct.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "product-detail",
    )!;
    unknownRelatedProductPage.sections[0].content = {
      ...unknownRelatedProductPage.sections[0].content,
      relatedProductIds: ["related_product_not_in_catalogue"],
    };
    expect(decisionCodes(unknownRelatedProduct)).toContain("unknown-commerce-identity");

    const unknownCollection = structuredClone(scenario.legacySnapshot);
    const unknownCollectionPage = unknownCollection.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "collection",
    )!;
    unknownCollectionPage.pageFamily = {
      ...unknownCollectionPage.pageFamily!,
      commerceContext: { kind: "collection", collectionId: "collection_not_in_catalogue" },
    };
    unknownCollectionPage.sections[0].content = {
      ...unknownCollectionPage.sections[0].content,
      collectionId: "collection_not_in_catalogue",
    };
    expect(decisionCodes(unknownCollection)).toContain("unknown-commerce-identity");

    const missingComponentIdentity = structuredClone(scenario.legacySnapshot);
    const missingComponentIdentityPage = missingComponentIdentity.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "product-detail",
    )!;
    delete missingComponentIdentityPage.sections[0].content.productId;
    expect(decisionCodes(missingComponentIdentity)).toEqual(
      expect.arrayContaining(["missing-catalogue-identity", "invalid-legacy-schema"]),
    );

    const invalidComponentSchema = structuredClone(scenario.legacySnapshot);
    const invalidComponentPage = invalidComponentSchema.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "product-detail",
    )!;
    invalidComponentPage.sections[0].content.primaryActionLabel = undefined;
    expect(decisionCodes(invalidComponentSchema)).toContain("invalid-legacy-schema");

    const invalidSnapshotSchema = structuredClone(scenario.legacySnapshot);
    invalidSnapshotSchema.pages[0].slug = "not-a-canonical-route";
    expect(decisionCodes(invalidSnapshotSchema)).toContain("invalid-legacy-schema");

    const invalidNamespace = structuredClone(scenario.legacySnapshot);
    const invalidNamespacePage = invalidNamespace.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "product-detail",
    )!;
    invalidNamespacePage.slug = "/collections/not-a-product-route";
    expect(decisionCodes(invalidNamespace)).toContain("invalid-route-namespace");

    const mismatchedCatalogue = structuredClone(scenario.catalogue);
    mismatchedCatalogue.id = "catalogue_other";
    expect(decisionCodes(scenario.legacySnapshot, mismatchedCatalogue)).toContain(
      "missing-catalogue-identity",
    );
  });

  it("projects bounded soft surfaces canonically, preserves no-op edits, and rejects conflicts", () => {
    const { catalogue, result } = migratedScenario();
    const route = result.authority.routeInventory.find(({ kind }) => kind === "product")!;
    if (route.kind !== "product") throw new Error("Expected a product route.");
    const product = catalogue.products.find(({ id }) => id === route.productId)!;
    const mappedArchetypeId = result.authority.productTypeMappings.find(
      ({ productTypeId }) =>
        productTypeId === canonicalProductTypePresentationId(product.productType),
    )!.archetypeId;
    const { authorityFingerprint: _fingerprint, ...material } = result.authority;
    void _fingerprint;
    const softAuthority = createDynamicCommercePresentationAuthority({
      ...structuredClone(material),
      productDetailArchetypes: result.authority.productDetailArchetypes.map((archetype) =>
        archetype.id === mappedArchetypeId
          ? {
              ...structuredClone(archetype),
              componentPresentations: archetype.componentPresentations.map((presentation) => ({
                ...structuredClone(presentation),
                styleOverrides: { surfaceTreatment: "soft" as const },
              })),
            }
          : structuredClone(archetype),
      ),
    });
    const softSnapshot = storefrontSnapshotSchema.parse({
      ...result.snapshot,
      dynamicCommercePresentation: softAuthority,
    });
    const projection = resolveDynamicCommerceRoutePage({
      snapshot: softSnapshot,
      catalogue,
      routeId: route.id,
      projection: "editor",
    });
    expect(projection.page.sections[0]?.styleOverrides).toEqual({ surface: "surface" });
    expect(applyDynamicCommerceArchetypePage(softSnapshot, projection.page)).toEqual(softSnapshot);

    const conflictingAuthority = createDynamicCommercePresentationAuthority({
      ...structuredClone(material),
      productDetailArchetypes: result.authority.productDetailArchetypes.map((archetype) =>
        archetype.id === mappedArchetypeId
          ? {
              ...structuredClone(archetype),
              componentPresentations: archetype.componentPresentations.map((presentation) => ({
                ...structuredClone(presentation),
                styleOverrides: {
                  surface: "primary" as const,
                  surfaceTreatment: "soft" as const,
                },
              })),
            }
          : structuredClone(archetype),
      ),
    });
    const conflictingSnapshot = storefrontSnapshotSchema.parse({
      ...result.snapshot,
      dynamicCommercePresentation: conflictingAuthority,
    });
    expect(() =>
      resolveDynamicCommerceRoutePage({
        snapshot: conflictingSnapshot,
        catalogue,
        routeId: route.id,
      }),
    ).toThrow(/registered component schema/i);
  });

  it("fails closed when stored archetype presentation drifts outside its registered profile", () => {
    const { catalogue, result } = migratedScenario();
    const route = result.authority.routeInventory.find(({ kind }) => kind === "product")!;
    if (route.kind !== "product") throw new Error("Expected a product route.");
    const product = catalogue.products.find(({ id }) => id === route.productId)!;
    const archetypeId = result.authority.productTypeMappings.find(
      ({ productTypeId }) =>
        productTypeId === canonicalProductTypePresentationId(product.productType),
    )!.archetypeId;
    const { authorityFingerprint: _fingerprint, ...material } = result.authority;
    void _fingerprint;
    const invalidAuthority = createDynamicCommercePresentationAuthority({
      ...structuredClone(material),
      productDetailArchetypes: material.productDetailArchetypes.map((archetype) =>
        archetype.id === archetypeId
          ? {
              ...structuredClone(archetype),
              componentPresentations: archetype.componentPresentations.map((presentation) => ({
                ...structuredClone(presentation),
                component: "dynamicCollectionCommerce",
              })),
            }
          : structuredClone(archetype),
      ),
    });
    const invalidSnapshot = storefrontSnapshotSchema.parse({
      ...result.snapshot,
      dynamicCommercePresentation: invalidAuthority,
    });

    expect(() =>
      resolveDynamicCommerceRoutePage({
        snapshot: invalidSnapshot,
        catalogue,
        routeId: route.id,
      }),
    ).toThrow(/registered PageBlueprint presentation/i);
  });

  it("requires every executable archetype metadata field to match registered authority", () => {
    const { catalogue, result } = migratedScenario();
    const route = result.authority.routeInventory.find(({ kind }) => kind === "product")!;
    if (route.kind !== "product") throw new Error("Expected a product route.");
    const product = catalogue.products.find(({ id }) => id === route.productId)!;
    const archetypeId = result.authority.productTypeMappings.find(
      ({ productTypeId }) =>
        productTypeId === canonicalProductTypePresentationId(product.productType),
    )!.archetypeId;
    const { authorityFingerprint: _fingerprint, ...sourceMaterial } = result.authority;
    void _fingerprint;
    type ProductArchetype = (typeof sourceMaterial.productDetailArchetypes)[number];
    const mutations: ReadonlyArray<readonly [string, (archetype: ProductArchetype) => void]> = [
      [
        "default frame",
        (archetype) => {
          const alternative = archetype.compatibleSharedFrameProfileIds.find(
            (profileId) => profileId !== archetype.defaultSharedFrameProfileId,
          );
          if (!alternative) throw new Error("Expected an alternative compatible frame.");
          archetype.defaultSharedFrameProfileId = alternative;
        },
      ],
      [
        "responsive posture",
        (archetype) => {
          archetype.responsivePosture[0].transformationIds = [
            ...archetype.responsivePosture[0].transformationIds,
            "staleResponsiveTransformation",
          ];
        },
      ],
      [
        "anatomy",
        (archetype) => {
          archetype.componentPresentations[0].anatomyId = "staleAnatomy";
        },
      ],
      [
        "bounded parameters",
        (archetype) => {
          archetype.componentPresentations[0].boundedParameters = { density: "compact" };
        },
      ],
      [
        "art direction",
        (archetype) => {
          archetype.artDirectionPosture.overlay = "gradient";
        },
      ],
      [
        "required visibility",
        (archetype) => {
          archetype.componentPresentations[0].visible = false;
        },
      ],
    ];

    for (const [label, mutate] of mutations) {
      const material = structuredClone(sourceMaterial);
      const archetype = material.productDetailArchetypes.find(({ id }) => id === archetypeId)!;
      mutate(archetype);
      const snapshot = storefrontSnapshotSchema.parse({
        ...result.snapshot,
        dynamicCommercePresentation: createDynamicCommercePresentationAuthority(material),
      });
      expect(
        () =>
          resolveDynamicCommerceRoutePage({
            snapshot,
            catalogue,
            routeId: route.id,
          }),
        label,
      ).toThrow();
    }

    const unsupportedFallback = structuredClone(sourceMaterial);
    Reflect.set(unsupportedFallback.productDetailArchetypes[0], "fallbackBehavior", "fail-closed");
    expect(() => createDynamicCommercePresentationAuthority(unsupportedFallback)).toThrow();
  });
});
