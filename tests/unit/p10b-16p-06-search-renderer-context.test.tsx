import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import {
  STOREFRONT_SEARCH_RESULTS_CONTRACT_VERSION,
  storefrontSearchResultFingerprint,
  type StorefrontSearchResultMaterialV1,
  type StorefrontSearchResultPageV1,
} from "@/application/storefront-search";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderDynamicCollectionCommerce } from "@/components/storefront/dynamic-collection-commerce";
import { StorefrontSearchCommerceRoute } from "@/components/storefront/storefront-commerce-route";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

function resultPage(
  productIds: readonly string[],
  overrides: Partial<StorefrontSearchResultMaterialV1> = {},
): StorefrontSearchResultPageV1 {
  const aggregate = p10b16p01DynamicCommerceAggregate();
  const material: StorefrontSearchResultMaterialV1 = {
    contractVersion: STOREFRONT_SEARCH_RESULTS_CONTRACT_VERSION,
    state: "results",
    requestFingerprint: "request-fingerprint",
    catalogueFingerprint: canonicalValueFingerprint(aggregate.catalogue),
    authorityFingerprint: "authority-fingerprint",
    normalizedQuery: "ring",
    normalizedTerms: ["ring"],
    totalCount: productIds.length,
    page: 1,
    pageSize: 12,
    productIds: [...productIds],
    availableFacets: [],
    appliedFilters: [],
    sort: "relevance",
    ...overrides,
  };
  return { ...material, resultFingerprint: storefrontSearchResultFingerprint(material) };
}

function searchPresentation(result: StorefrontSearchResultPageV1) {
  const aggregate = p10b16p01DynamicCommerceAggregate();
  const snapshot = aggregate.snapshots[1];
  const searchRoute = snapshot.dynamicCommercePresentation!.routeInventory.find(
    ({ kind }) => kind === "search",
  );
  if (!searchRoute) throw new Error("The search renderer fixture has no search route.");
  const page = resolveDynamicCommerceRoutePage({
    snapshot,
    catalogue: aggregate.catalogue,
    routeId: searchRoute.id,
    searchBinding: {
      canonicalRevision: `canonical-commerce-${canonicalValueFingerprint(aggregate.catalogue)}`,
      resultProductIds: result.productIds,
    },
  }).page;
  const presentation = createCatalogueStorefrontCommerceRouteAdapter().search({
    aggregate,
    snapshot,
    page,
    results: result,
  });
  if (!presentation) throw new Error("The search renderer fixture has no presentation.");
  return { aggregate, page, presentation, snapshot };
}

function rendererInput(
  presentation: ReturnType<typeof searchPresentation>["presentation"],
  overrides: Partial<Parameters<typeof renderDynamicCollectionCommerce>[0]> = {},
): Parameters<typeof renderDynamicCollectionCommerce>[0] {
  return {
    target: "preview",
    instance: presentation.instance,
    projection: presentation.projection,
    activeLocale: "en",
    primaryLocale: "en",
    loading: { status: "ready" },
    search: presentation.search,
    resolveAssetUrl: presentation.resolveAssetUrl,
    onNavigateProduct: () => undefined,
    onNavigateCollection: () => undefined,
    onFilterIntent: () => undefined,
    onSortIntent: () => undefined,
    onContinueShopping: () => undefined,
    ...overrides,
  };
}

describe("P10B-16P-06 canonical search renderer context", () => {
  it("projects exact transient result membership without synthetic collection authority", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const productIds = aggregate.catalogue.products.slice(0, 2).map(({ id }) => id);
    const result = resultPage(productIds);
    const { presentation } = searchPresentation(result);

    expect(presentation.search).toEqual(result);
    expect(presentation.instance.bindings).toEqual([
      {
        slotId: "collectionProducts",
        source: "productList",
        productIds,
        revision: result.resultFingerprint,
      },
    ]);
    expect(presentation.projection.collections).toEqual([]);
    expect(presentation.projection.products.map(({ productId }) => productId)).toEqual(productIds);
    expect(presentation.projection.productListRevision).toBe(result.resultFingerprint);
    expect(
      presentation.projection.assets.every(
        ({ provenance }) => provenance.kind === "canonicalProductMedia",
      ),
    ).toBe(true);
  });

  it("reuses exact product cards while suppressing collection-only campaign and controls", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const productIds = aggregate.catalogue.products.slice(0, 3).map(({ id }) => id);
    const { page, presentation, snapshot } = searchPresentation(resultPage(productIds));
    const markup = renderToStaticMarkup(
      renderDynamicCollectionCommerce(rendererInput(presentation)),
    );
    const routeMarkup = renderToStaticMarkup(
      <StorefrontSearchCommerceRoute
        activeLocale="en"
        context={createStorefrontRenderContext({
          activeLocale: "en",
          primaryLocale: "en",
          catalogue: aggregate.catalogue,
          snapshot,
        })}
        onContinueShopping={() => undefined}
        onNavigateProduct={() => undefined}
        page={page}
        presentation={presentation}
        primaryLocale="en"
        target="preview"
      />,
    );

    expect(markup).toContain('data-search-context="transient-canonical-results"');
    expect(markup).toContain('data-search-query="ring"');
    expect(markup).toContain('data-search-result-count="3"');
    expect(markup).toContain('data-card-context="searchResults"');
    expect(routeMarkup).toMatch(/<main[^>]*id="storefront-main-content"[^>]*tabindex="-1"/);
    expect(routeMarkup.match(/<main(?:\s|>)/g)).toHaveLength(1);
    expect(markup.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(markup).toMatch(/<h1[^>]*>Search results<\/h1>[\s\S]*<h2[^>]*>Products<\/h2>[\s\S]*<h3/);
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain("data-collection-hero-treatment");
    expect(markup).not.toContain('data-layout-region="campaign-lead"');
    expect(markup).not.toContain('data-layout-region="filters"');
    expect(markup).not.toContain("Sort products");
    expect(markup).not.toContain("Related collections");
  });

  it("localizes the query, result count, empty-query orientation, and no-results continuation", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const productId = aggregate.catalogue.products[0].id;
    const result = resultPage([productId]);
    const { presentation } = searchPresentation(result);
    const finnishMarkup = renderToStaticMarkup(
      renderDynamicCollectionCommerce(
        rendererInput(presentation, { activeLocale: "fi", primaryLocale: "fi" }),
      ),
    );
    expect(finnishMarkup).toContain("Hakutulokset haulle");
    expect(finnishMarkup).toContain("1 tuote");

    const emptyQuery = resultPage([], {
      state: "empty-query",
      normalizedQuery: "",
      normalizedTerms: [],
      totalCount: 0,
    });
    const emptyPresentation = searchPresentation(emptyQuery).presentation;
    const emptyMarkup = renderToStaticMarkup(
      renderDynamicCollectionCommerce(rendererInput(emptyPresentation)),
    );
    expect(emptyMarkup).toContain('data-search-empty-query="true"');
    expect(emptyMarkup).toContain("Enter a product name or detail to begin.");

    const noResults = resultPage([], {
      normalizedQuery: "nonexistent ring",
      normalizedTerms: ["nonexistent", "ring"],
    });
    const noResultsPresentation = searchPresentation(noResults).presentation;
    const onContinueShopping = vi.fn();
    render(
      renderDynamicCollectionCommerce(rendererInput(noResultsPresentation, { onContinueShopping })),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue shopping" }));
    expect(onContinueShopping).toHaveBeenCalledOnce();
    expect(screen.getByText(/No products match/)).toBeVisible();
    expect(screen.queryByText(/Browse this collection/i)).not.toBeInTheDocument();
  });

  it("fails closed for stale result bindings and any synthetic collection binding", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const productIds = aggregate.catalogue.products.slice(0, 2).map(({ id }) => id);
    const { presentation } = searchPresentation(resultPage(productIds));
    const stale = {
      ...presentation,
      instance: structuredClone(presentation.instance),
      projection: structuredClone(presentation.projection),
      search: structuredClone(presentation.search),
    };
    const productBinding = stale.instance.bindings.find(
      (binding) => binding.source === "productList",
    );
    if (productBinding?.source !== "productList")
      throw new Error("Missing search product binding.");
    productBinding.revision = "stale-search-result";
    expect(() => renderDynamicCollectionCommerce(rendererInput(stale))).toThrow(
      /revision must match|exact result fingerprint/i,
    );

    const synthetic = {
      ...presentation,
      instance: structuredClone(presentation.instance),
      projection: structuredClone(presentation.projection),
      search: structuredClone(presentation.search),
    };
    synthetic.instance.bindings.push({
      slotId: "primaryCollection",
      source: "collection",
      collectionId: aggregate.catalogue.collections[0].id,
      revision: "synthetic-collection",
    });
    expect(() => renderDynamicCollectionCommerce(rendererInput(synthetic))).toThrow();
  });

  it("keeps collection runtime validation and rendering unchanged", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots[1];
    const route = snapshot.dynamicCommercePresentation!.routeInventory.find(
      ({ kind }) => kind === "collection",
    );
    if (!route || route.kind !== "collection") throw new Error("Missing collection route.");
    const collection = aggregate.catalogue.collections.find(({ id }) => id === route.collectionId)!;
    const page = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue: aggregate.catalogue,
      routeId: route.id,
    }).page;
    const presentation = createCatalogueStorefrontCommerceRouteAdapter().collection({
      aggregate,
      snapshot,
      page,
      collection,
    });
    if (!presentation) throw new Error("Missing collection presentation.");
    const input = {
      target: "preview" as const,
      instance: presentation.instance,
      projection: presentation.projection,
      activeLocale: "en" as const,
      primaryLocale: "en" as const,
      loading: { status: "ready" as const },
      resolveAssetUrl: presentation.resolveAssetUrl,
      onNavigateProduct: () => undefined,
      onNavigateCollection: () => undefined,
      onFilterIntent: () => undefined,
      onSortIntent: () => undefined,
    };
    const markup = renderToStaticMarkup(renderDynamicCollectionCommerce(input));
    expect(markup).toContain(`>${collection.title.en}<`);
    expect(markup).toContain('data-search-context="none"');

    const missingCollection = {
      ...presentation,
      instance: structuredClone(presentation.instance),
      projection: structuredClone(presentation.projection),
    };
    missingCollection.instance.bindings = missingCollection.instance.bindings.filter(
      ({ slotId }) => slotId !== "primaryCollection",
    );
    expect(() =>
      renderDynamicCollectionCommerce({ ...input, instance: missingCollection.instance }),
    ).toThrow(/requires one canonical collection binding/i);
  });
});
