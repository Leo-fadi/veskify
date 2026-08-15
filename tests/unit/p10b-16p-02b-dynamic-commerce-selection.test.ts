import { describe, expect, it } from "vitest";
import {
  applyDynamicCommerceDesignSelection,
  materializeDynamicCommerceDesignSelectionFromAuthority,
  requireMigratedDynamicCommerceSnapshot,
  resolveDynamicCommerceRoutePage,
  type DynamicCommerceDesignSelectionError,
} from "@/application/dynamic-commerce-routes";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  dynamicCollectionCommerceBridgeDefinition,
  dynamicProductDetailBridgeDefinition,
} from "@/components/registry";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  PAGE_FAMILY_AUTHORITY_VERSION,
  SITE_MAP_SHARED_FRAME,
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
  storefrontSnapshotSchema,
  type DynamicCommerceRouteInventoryEntry,
} from "@/domain/storefront";

function currentAuthority() {
  const fixture = createP905aFreshMerchantFixture("premiumEditorial");
  const legacy = structuredClone(fixture.planningInput.draft);
  legacy.pages = legacy.pages.map((page) => {
    if (page.type === "collection") {
      const collection = fixture.planningInput.catalogue.collections[0];
      if (!collection) throw new Error("Missing collection fixture.");
      return {
        ...page,
        pageFamily: {
          familyId: "collection" as const,
          familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
          profileId: "collection-editorial-discovery",
          profileVersion: "1.0.0",
          localeCoverage: ["en" as const, "fi" as const],
          sharedFrameId: SITE_MAP_SHARED_FRAME.id,
          sharedFrameVersion: SITE_MAP_SHARED_FRAME.version,
          commerceContext: { kind: "collection" as const, collectionId: collection.id },
          commerceOperationAuthority: "read-only-presentation" as const,
          navigationAreas: [],
          evidenceReferences: [],
        },
        sections: [
          {
            id: "section_dynamic_collection_fixture",
            component: "dynamicCollectionCommerce",
            variant: "editorialDiscovery",
            visible: true,
            content: {
              ...structuredClone(dynamicCollectionCommerceBridgeDefinition.defaultContent),
              collectionId: collection.id,
              productIds: [...collection.productIds],
              canonicalRevision: "canonical_fixture_revision",
            },
            props: {
              ...structuredClone(dynamicCollectionCommerceBridgeDefinition.defaultProps),
              cardVariant: "editorial",
            },
          },
        ],
      };
    }
    if (page.type === "product") {
      const product = fixture.planningInput.catalogue.products[0];
      if (!product) throw new Error("Missing product fixture.");
      return {
        ...page,
        pageFamily: {
          familyId: "product-detail" as const,
          familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
          profileId: "pdp-standard-commerce",
          profileVersion: "1.0.0",
          localeCoverage: ["en" as const, "fi" as const],
          sharedFrameId: SITE_MAP_SHARED_FRAME.id,
          sharedFrameVersion: SITE_MAP_SHARED_FRAME.version,
          commerceContext: { kind: "product" as const, productId: product.id },
          commerceOperationAuthority: "read-only-presentation" as const,
          navigationAreas: [],
          evidenceReferences: [],
        },
        sections: [
          {
            id: "section_dynamic_product_fixture",
            component: "dynamicProductDetail",
            variant: "balanced",
            visible: true,
            content: {
              ...structuredClone(dynamicProductDetailBridgeDefinition.defaultContent),
              productId: product.id,
              relatedProductIds: [],
              canonicalRevision: "canonical_fixture_revision",
            },
            props: structuredClone(dynamicProductDetailBridgeDefinition.defaultProps),
          },
        ],
      };
    }
    return page;
  });
  const snapshot = requireMigratedDynamicCommerceSnapshot(
    storefrontSnapshotSchema.parse(legacy),
    fixture.planningInput.catalogue,
  );
  const authority = snapshot.dynamicCommercePresentation;
  if (!authority) throw new Error("Missing migrated dynamic-commerce fixture authority.");
  return { authority, catalogue: fixture.planningInput.catalogue, snapshot };
}

function exactSelection(result: ReturnType<typeof currentAuthority>) {
  const collection = result.authority.collectionSearchArchetypes.find(({ supportedContexts }) =>
    supportedContexts.includes("collection"),
  );
  const search = result.authority.collectionSearchArchetypes.find(({ supportedContexts }) =>
    supportedContexts.includes("search"),
  );
  const product = result.authority.productDetailArchetypes.find(
    ({ id }) => id !== result.authority.fallbacks.productDetailArchetypeId,
  );
  if (!collection || !search || !product) throw new Error("Incomplete dynamic fixture authority.");
  return {
    authorityFingerprint: result.authority.authorityFingerprint,
    collectionArchetypeId: collection.id,
    searchArchetypeId: search.id,
    standardSimpleArchetypeId: product.id,
    configurableArchetypeId: product.id,
    galleryLedArchetypeId: product.id,
    highConsiderationArchetypeId: product.id,
    genericFallbackArchetypeId: result.authority.fallbacks.productDetailArchetypeId,
    productTypeMappings: Object.fromEntries(
      result.catalogue.products.map(({ productType }) => [
        canonicalProductTypePresentationId(productType),
        product.id,
      ]),
    ),
  };
}

describe("P10B-16P-02B exact dynamic-commerce selection", () => {
  it("updates only aggregate presentation authority and drives every concrete dynamic route", () => {
    const current = currentAuthority();
    const selection = exactSelection(current);
    const pagesBefore = canonicalValueString(current.snapshot.pages);
    const routesBefore = canonicalValueString(current.authority.routeInventory);
    const catalogueBefore = canonicalValueString(current.catalogue);

    const selected = applyDynamicCommerceDesignSelection(
      current.snapshot,
      current.catalogue,
      selection,
    );
    const authority = selected.dynamicCommercePresentation!;

    expect(authority.authorityRevision).toBe(current.authority.authorityRevision + 1);
    expect(authority.authorityFingerprint).not.toBe(current.authority.authorityFingerprint);
    expect(canonicalValueString(authority.routeInventory)).toBe(routesBefore);
    expect(canonicalValueString(selected.pages)).toBe(pagesBefore);
    expect(canonicalValueString(current.catalogue)).toBe(catalogueBefore);
    expect(
      authority.collectionRouteMappings.every(
        ({ archetypeId }) => archetypeId === selection.collectionArchetypeId,
      ),
    ).toBe(true);
    expect(
      authority.collectionContextRules.every(
        ({ archetypeId }) => archetypeId === selection.collectionArchetypeId,
      ),
    ).toBe(true);
    expect(authority.fallbacks.collectionArchetypeId).toBe(selection.collectionArchetypeId);
    expect(authority.searchArchetypeId).toBe(selection.searchArchetypeId);
    expect(authority.fallbacks.searchArchetypeId).toBe(selection.searchArchetypeId);
    expect(authority.productTypeMappings).toEqual(
      Object.entries(selection.productTypeMappings)
        .map(([productTypeId, archetypeId]) => ({ productTypeId, archetypeId }))
        .sort((left, right) => left.productTypeId.localeCompare(right.productTypeId)),
    );
    expect(
      Object.fromEntries(
        authority.productComplexityRules.map(({ id, archetypeId }) => [id, archetypeId]),
      ),
    ).toEqual({
      product_rule_considered: selection.highConsiderationArchetypeId,
      product_rule_options: selection.highConsiderationArchetypeId,
      product_rule_configurable: selection.configurableArchetypeId,
      product_rule_gallery: selection.galleryLedArchetypeId,
      product_rule_simple: selection.standardSimpleArchetypeId,
    });
    expect(authority.fallbacks.productDetailArchetypeId).toBe("archetype_pdp_generic_fallback");

    for (const route of authority.routeInventory.filter(
      (entry): entry is Extract<DynamicCommerceRouteInventoryEntry, { kind: "collection" }> =>
        entry.kind === "collection",
    )) {
      expect(
        resolveDynamicCommerceRoutePage({
          snapshot: selected,
          catalogue: current.catalogue,
          routeId: route.id,
        }).archetype.id,
      ).toBe(selection.collectionArchetypeId);
    }
    for (const route of authority.routeInventory.filter(
      (entry): entry is Extract<DynamicCommerceRouteInventoryEntry, { kind: "product" }> =>
        entry.kind === "product",
    )) {
      const product = current.catalogue.products.find(({ id }) => id === route.productId)!;
      expect(
        resolveDynamicCommerceRoutePage({
          snapshot: selected,
          catalogue: current.catalogue,
          routeId: route.id,
        }).archetype.id,
      ).toBe(
        selection.productTypeMappings[canonicalProductTypePresentationId(product.productType)],
      );
    }
    const searchRoute = authority.routeInventory.find(({ kind }) => kind === "search")!;
    expect(() =>
      resolveDynamicCommerceRoutePage({
        snapshot: selected,
        catalogue: current.catalogue,
        routeId: searchRoute.id,
      }),
    ).toThrow(/transient canonical search-result projection/i);
  });

  it("fails atomically for missing current product types or incompatible archetypes", () => {
    const current = currentAuthority();
    const before = canonicalValueString(current.snapshot);
    const selection = exactSelection(current);
    const [firstProductTypeId] = Object.keys(selection.productTypeMappings);
    if (!firstProductTypeId) throw new Error("Missing product-type selection.");
    const incomplete = structuredClone(selection);
    delete incomplete.productTypeMappings[firstProductTypeId];

    expect(() =>
      applyDynamicCommerceDesignSelection(current.snapshot, current.catalogue, incomplete),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicCommerceDesignSelectionError>>({
        code: "stale-product-type-authority",
      }),
    );
    expect(() =>
      applyDynamicCommerceDesignSelection(current.snapshot, current.catalogue, {
        ...selection,
        collectionArchetypeId: "archetype_unknown",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicCommerceDesignSelectionError>>({
        code: "unknown-archetype",
      }),
    );
    expect(() =>
      applyDynamicCommerceDesignSelection(current.snapshot, current.catalogue, {
        ...selection,
        highConsiderationArchetypeId: "archetype_unknown",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicCommerceDesignSelectionError>>({
        code: "unknown-archetype",
      }),
    );
    expect(() =>
      applyDynamicCommerceDesignSelection(current.snapshot, current.catalogue, {
        ...selection,
        standardSimpleArchetypeId: selection.genericFallbackArchetypeId,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicCommerceDesignSelectionError>>({
        code: "unknown-archetype",
      }),
    );
    expect(canonicalValueString(current.snapshot)).toBe(before);
  });

  it("materializes each exact PDP role into canonical complexity authority", () => {
    const current = currentAuthority();
    const selection = exactSelection(current);
    const nonFallback = current.authority.productDetailArchetypes.filter(
      ({ id }) => id !== current.authority.fallbacks.productDetailArchetypeId,
    );
    const standard = nonFallback[0];
    const alternative = nonFallback.find(({ id }) => id !== standard?.id);
    if (!standard || !alternative)
      throw new Error("Expected two current non-fallback PDP archetypes.");
    const roleSelection = {
      ...selection,
      standardSimpleArchetypeId: standard.id,
      configurableArchetypeId: alternative.id,
      galleryLedArchetypeId: standard.id,
      highConsiderationArchetypeId: alternative.id,
    };

    const baseline = applyDynamicCommerceDesignSelection(
      current.snapshot,
      current.catalogue,
      selection,
    ).dynamicCommercePresentation!;
    const selected = applyDynamicCommerceDesignSelection(
      current.snapshot,
      current.catalogue,
      roleSelection,
    ).dynamicCommercePresentation!;

    expect(selected.authorityFingerprint).not.toBe(baseline.authorityFingerprint);
    expect(selected.productTypeMappings).toEqual(baseline.productTypeMappings);
    expect(
      Object.fromEntries(
        selected.productComplexityRules.map(({ id, archetypeId }) => [id, archetypeId]),
      ),
    ).toEqual({
      product_rule_considered: alternative.id,
      product_rule_options: alternative.id,
      product_rule_configurable: alternative.id,
      product_rule_gallery: standard.id,
      product_rule_simple: standard.id,
    });

    const { authorityFingerprint: _fingerprint, ...material } = current.authority;
    void _fingerprint;
    const staleRules = createDynamicCommercePresentationAuthority({
      ...structuredClone(material),
      productComplexityRules: material.productComplexityRules.map((rule) =>
        rule.id === "product_rule_simple"
          ? { ...structuredClone(rule), id: "product_rule_unknown" }
          : structuredClone(rule),
      ),
    });
    expect(() =>
      materializeDynamicCommerceDesignSelectionFromAuthority(staleRules, {
        ...roleSelection,
        authorityFingerprint: staleRules.authorityFingerprint,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicCommerceDesignSelectionError>>({
        code: "stale-authority",
      }),
    );
  });

  it("fails atomically for stale presentation or canonical commerce authority", () => {
    const current = currentAuthority();
    const before = canonicalValueString(current.snapshot);
    const selection = exactSelection(current);

    expect(() =>
      applyDynamicCommerceDesignSelection(current.snapshot, current.catalogue, {
        ...selection,
        authorityFingerprint: `${selection.authorityFingerprint}-stale`,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicCommerceDesignSelectionError>>({
        code: "stale-authority",
      }),
    );

    const productRoute = current.authority.routeInventory.find(
      (route): route is Extract<DynamicCommerceRouteInventoryEntry, { kind: "product" }> =>
        route.kind === "product",
    );
    if (!productRoute) throw new Error("Missing product route fixture.");
    const catalogueWithoutRouteProduct = {
      ...structuredClone(current.catalogue),
      products: current.catalogue.products.filter(({ id }) => id !== productRoute.productId),
      collections: current.catalogue.collections.map((collection) => ({
        ...structuredClone(collection),
        productIds: collection.productIds.filter((id) => id !== productRoute.productId),
      })),
    };
    expect(() =>
      applyDynamicCommerceDesignSelection(
        current.snapshot,
        catalogueWithoutRouteProduct,
        selection,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicCommerceDesignSelectionError>>({
        code: "stale-commerce-authority",
      }),
    );
    expect(canonicalValueString(current.snapshot)).toBe(before);
  });
});
