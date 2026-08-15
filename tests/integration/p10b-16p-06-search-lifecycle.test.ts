import { describe, expect, it } from "vitest";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import {
  STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
  type StorefrontSearchRequestV1,
} from "@/application/storefront-search";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import { canonicalStorefrontContentFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  createStandaloneCatalogueProductSearchAdapter,
  createStandaloneStorefrontSearchAuthority,
} from "@/integrations/storefront-search";
import { InMemoryProjectRepository } from "@/services/storage";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

function runtime() {
  const aggregate = p10b16p01DynamicCommerceAggregate();
  const snapshot = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
  const authority = snapshot.dynamicCommercePresentation!;
  const searchRoute = authority.routeInventory.find(({ kind }) => kind === "search")!;
  const searchAuthority = createStandaloneStorefrontSearchAuthority({
    catalogue: aggregate.catalogue,
    primaryLocale: aggregate.project.primaryLocale,
    enabledLocales: aggregate.project.enabledLocales,
    productRoutes: authority.routeInventory.flatMap((route) =>
      route.kind === "product" ? [{ productId: route.productId, route: route.route }] : [],
    ),
  });
  return {
    aggregate,
    snapshot,
    authority,
    searchRoute,
    searchAuthority,
    search: createStandaloneCatalogueProductSearchAdapter({ catalogue: aggregate.catalogue }),
  };
}

function request(rawQuery: string, locale: "en" | "fi" = "en"): StorefrontSearchRequestV1 {
  return {
    contractVersion: STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
    rawQuery,
    locale,
    page: 1,
    pageSize: 24,
    sort: "relevance",
    filters: [],
  };
}

describe("P10B-16P-06 search lifecycle boundaries", () => {
  it("keeps every query and result page outside snapshot, save, history, and route cardinality", async () => {
    const state = runtime();
    const beforeSnapshot = canonicalValueString(state.snapshot);
    const beforeFingerprint = canonicalStorefrontContentFingerprint(state.snapshot);
    const beforeAuthorityFingerprint = state.authority.authorityFingerprint;

    for (const query of ["ring", "925", "query-never-persisted-06"]) {
      const result = state.search.search(request(query), state.searchAuthority);
      const resolved = resolveDynamicCommerceRoutePage({
        snapshot: state.snapshot,
        catalogue: state.aggregate.catalogue,
        routeId: state.searchRoute.id,
        searchBinding: {
          canonicalRevision: `canonical-commerce-${result.catalogueFingerprint}`,
          resultProductIds: result.productIds,
        },
      });
      expect(resolved.route.id).toBe(state.searchRoute.id);
      expect(resolved.page.id).toBe(state.searchRoute.id);
      expect(resolved.page.pageFamily?.commerceContext).toEqual({ kind: "search" });
    }

    expect(state.authority.routeInventory.filter(({ kind }) => kind === "search")).toHaveLength(1);
    expect(canonicalValueString(state.snapshot)).toBe(beforeSnapshot);
    expect(canonicalStorefrontContentFingerprint(state.snapshot)).toBe(beforeFingerprint);
    expect(state.snapshot.dynamicCommercePresentation?.authorityFingerprint).toBe(
      beforeAuthorityFingerprint,
    );
    expect(beforeSnapshot).not.toContain("query-never-persisted-06");

    const publishedSnapshotId = state.aggregate.project.publishedSnapshotId;
    if (!publishedSnapshotId) throw new Error("The search lifecycle fixture requires publication.");
    const publishedIndex = state.aggregate.snapshots.findIndex(
      ({ id }) => id === publishedSnapshotId,
    );
    const publishedMetadata = state.aggregate.snapshots[publishedIndex];
    if (!publishedMetadata) throw new Error("The published search fixture is unavailable.");
    state.aggregate.snapshots[publishedIndex] = {
      ...structuredClone(state.snapshot),
      id: publishedSnapshotId,
      revision: publishedMetadata.revision,
      createdAt: publishedMetadata.createdAt,
    };
    const repository = new InMemoryProjectRepository([state.aggregate]);
    await repository.saveDraft(state.aggregate.project.id, structuredClone(state.snapshot), {
      id: state.snapshot.id,
      revision: state.snapshot.revision,
    });
    const reloaded = await repository.get(state.aggregate.project.id);
    const reloadedDraft = reloaded.snapshots.find(
      ({ id }) => id === reloaded.project.draftSnapshotId,
    )!;
    expect(canonicalStorefrontContentFingerprint(reloadedDraft)).toBe(beforeFingerprint);
    expect(canonicalValueString(reloaded)).not.toContain("query-never-persisted-06");
    expect(
      reloadedDraft.dynamicCommercePresentation?.routeInventory.filter(
        ({ kind }) => kind === "search",
      ),
    ).toHaveLength(1);

    const restored = await repository.restore(state.aggregate.project.id, publishedSnapshotId);
    expect(restored.id).not.toBe(publishedSnapshotId);
    expect(
      restored.dynamicCommercePresentation?.routeInventory.filter(({ kind }) => kind === "search"),
    ).toHaveLength(1);
    expect(canonicalValueString(restored)).not.toContain("query-never-persisted-06");
  });

  it("publishes the selected search presentation without transient query or result authority", () => {
    const state = runtime();
    const runtimeResult = state.search.search(
      request("publication-query-never-persisted-06", "fi"),
      state.searchAuthority,
    );
    expect(runtimeResult.requestFingerprint).toBeTruthy();
    expect(runtimeResult.productIds).toBeDefined();

    const compilation = compileStorefrontPublication(
      createCurrentPublishCompilerInput({
        aggregate: state.aggregate,
        snapshot: state.snapshot,
        sourceAuthority: { kind: "manual" },
      }),
    );
    const publishedAuthority = compilation.result.dynamicCommercePresentation!;
    expect(publishedAuthority.routeInventory.filter(({ kind }) => kind === "search")).toEqual([
      state.searchRoute,
    ]);
    expect(publishedAuthority.searchArchetypeId).toBe(state.authority.searchArchetypeId);
    expect(publishedAuthority.authorityFingerprint).toBe(state.authority.authorityFingerprint);
    const compiledBytes = canonicalValueString(compilation.result);
    expect(compiledBytes).not.toContain("publication-query-never-persisted-06");
    expect(compiledBytes).not.toContain(runtimeResult.requestFingerprint);
    expect(compiledBytes).not.toContain(runtimeResult.resultFingerprint);
    expect(compilation.result.pages.some(({ page }) => page.slug === "/search")).toBe(false);
  });
});
