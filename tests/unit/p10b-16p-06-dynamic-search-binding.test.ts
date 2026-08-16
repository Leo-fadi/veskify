import { describe, expect, it } from "vitest";
import {
  DynamicCommerceRouteAuthorityError,
  resolveDynamicCommerceRoutePage,
  resolveDynamicCommerceRuntimeBindingPolicy,
} from "@/application/dynamic-commerce-routes";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  createDynamicCommercePresentationAuthority,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

describe("P10B-16P-06 transient dynamic search binding", () => {
  it("derives a truthful search policy without changing persisted v1 authority", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots[1];
    const authority = snapshot.dynamicCommercePresentation!;
    const archetype = authority.collectionSearchArchetypes.find(
      ({ id }) => id === authority.searchArchetypeId,
    )!;
    const before = canonicalStorefrontContentFingerprint(snapshot);

    expect(archetype.commerceBindingPolicy).toBe("runtime-collection-membership");
    expect(resolveDynamicCommerceRuntimeBindingPolicy(archetype, "collection")).toBe(
      "runtime-collection-membership",
    );
    expect(resolveDynamicCommerceRuntimeBindingPolicy(archetype, "search")).toBe(
      "runtime-search-results",
    );
    expect(canonicalStorefrontContentFingerprint(snapshot)).toBe(before);
  });

  it("materializes one transient search route page from exact current result IDs", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots[1];
    const searchRoute = snapshot.dynamicCommercePresentation!.routeInventory.find(
      ({ kind }) => kind === "search",
    )!;
    const resultProductIds = aggregate.catalogue.products.slice(1, 4).map(({ id }) => id);
    const canonicalRevision = `canonical-commerce-${canonicalValueFingerprint(
      aggregate.catalogue,
    )}`;
    const before = canonicalStorefrontContentFingerprint(snapshot);

    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue: aggregate.catalogue,
      routeId: searchRoute.id,
      searchBinding: { canonicalRevision, resultProductIds },
    });

    expect(resolved.route).toEqual(searchRoute);
    expect(resolved.page.slug).toBe("/search");
    expect(resolved.page.pageFamily?.commerceContext).toEqual({ kind: "search" });
    expect(resolved.page.sections).toHaveLength(1);
    expect(resolved.page.sections[0]?.content).toMatchObject({
      productIds: resultProductIds,
      canonicalRevision,
    });
    expect(canonicalStorefrontContentFingerprint(snapshot)).toBe(before);
  });

  it("fails closed for missing, stale, duplicate, or unknown transient membership", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots[1];
    const searchRoute = snapshot.dynamicCommercePresentation!.routeInventory.find(
      ({ kind }) => kind === "search",
    )!;
    const productId = aggregate.catalogue.products[0].id;
    const invoke = (searchBinding?: {
      canonicalRevision: string;
      resultProductIds: readonly string[];
    }) =>
      resolveDynamicCommerceRoutePage({
        snapshot,
        catalogue: aggregate.catalogue,
        routeId: searchRoute.id,
        ...(searchBinding ? { searchBinding } : {}),
      });

    expect(() => invoke()).toThrow(/exact transient canonical search-result projection/i);
    expect(() => invoke({ canonicalRevision: "stale", resultProductIds: [productId] })).toThrow(
      /no longer matches the canonical catalogue/i,
    );
    expect(() =>
      invoke({
        canonicalRevision: `canonical-commerce-${canonicalValueFingerprint(aggregate.catalogue)}`,
        resultProductIds: [productId, productId],
      }),
    ).toThrow(/must be unique/i);
    try {
      invoke({
        canonicalRevision: `canonical-commerce-${canonicalValueFingerprint(aggregate.catalogue)}`,
        resultProductIds: ["product_unknown"],
      });
      throw new Error("Expected unknown search membership to fail closed.");
    } catch (error) {
      expect(error).toBeInstanceOf(DynamicCommerceRouteAuthorityError);
      expect((error as DynamicCommerceRouteAuthorityError).code).toBe("unknown-commerce-identity");
    }
  });

  it("rejects a canonical product that has no current public PDP route", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots[1];
    const authority = snapshot.dynamicCommercePresentation!;
    const productId = aggregate.catalogue.products[0].id;
    const removedRouteId = authority.routeInventory.find(
      (route) => route.kind === "product" && route.productId === productId,
    )!.id;
    const { authorityFingerprint: _authorityFingerprint, ...material } = authority;
    void _authorityFingerprint;
    const withoutProductRoute = createDynamicCommercePresentationAuthority({
      ...structuredClone(material),
      routeInventory: material.routeInventory.filter(
        (route) => route.kind !== "product" || route.productId !== productId,
      ),
    });
    const snapshotWithoutRoute = storefrontSnapshotSchema.parse({
      ...snapshot,
      dynamicCommercePresentation: withoutProductRoute,
      navigation: Object.fromEntries(
        Object.entries(snapshot.navigation).map(([area, items]) => [
          area,
          items.filter(
            ({ target }) =>
              target.type !== "dynamic-commerce-route" || target.routeId !== removedRouteId,
          ),
        ]),
      ),
    });
    const searchRoute = withoutProductRoute.routeInventory.find(({ kind }) => kind === "search")!;

    expect(() =>
      resolveDynamicCommerceRoutePage({
        snapshot: snapshotWithoutRoute,
        catalogue: aggregate.catalogue,
        routeId: searchRoute.id,
        searchBinding: {
          canonicalRevision: `canonical-commerce-${canonicalValueFingerprint(aggregate.catalogue)}`,
          resultProductIds: [productId],
        },
      }),
    ).toThrow(/no current public product route authority/i);
  });
});
