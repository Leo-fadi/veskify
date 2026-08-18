import { describe, expect, it } from "vitest";
import {
  projectDynamicCommerceArchetypePages,
  migrateLegacyDynamicCommerceRoutes,
} from "@/application/dynamic-commerce-routes";
import {
  composeActiveEditorDraft,
  projectCanonicalEditorPages,
  proposalCanonicalReviewSnapshot,
} from "@/app/projects/[projectId]/editor/editor-draft-state";
import { canonicalValueString } from "@/domain/storefront";
import { createLegacyDynamicCommerceRouteScenario } from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";

function currentScenario() {
  const scenario = createLegacyDynamicCommerceRouteScenario();
  const migration = migrateLegacyDynamicCommerceRoutes(scenario.legacySnapshot, scenario.catalogue);
  if (migration.status !== "migrated") throw new Error("The editor fixture did not migrate.");
  return { ...scenario, snapshot: migration.snapshot, authority: migration.authority };
}

describe("P10B-16P-01 dynamic commerce editor projection", () => {
  it("shows the canonical proposed snapshot during migration review without replacing the legacy acceptance baseline", () => {
    const { catalogue, legacySnapshot } = createLegacyDynamicCommerceRouteScenario();
    const migration = migrateLegacyDynamicCommerceRoutes(legacySnapshot, catalogue);
    if (migration.status !== "migrated") throw new Error("The editor fixture did not migrate.");
    const legacyBeforeReview = structuredClone(legacySnapshot);
    const proposedStorefront = {
      pageOrder: migration.snapshot.pages.map(({ id }) => id),
      pages: structuredClone(migration.snapshot.pages),
      navigation: structuredClone(migration.snapshot.navigation),
      brandSystem: structuredClone(migration.snapshot.brandSystem),
      dynamicCommercePresentation: structuredClone(migration.authority),
    };
    const preview = proposalCanonicalReviewSnapshot({
      proposal: {
        status: "pending",
        proposedStorefront,
        dynamicCommerceMigration: {
          kind: "canonicalDynamicCommerceMigration",
          contractVersion: "1.0.0",
          legacyProjectionFingerprint: `v1_1_${"a".repeat(64)}`,
          resultingProjectionFingerprint: `v1_1_${"b".repeat(64)}`,
          resultingAuthorityFingerprint: migration.authority.authorityFingerprint,
        },
      },
      previewActive: true,
      visibleState: "proposalReady",
      acceptanceBaseline: legacySnapshot,
    });

    if (!preview) throw new Error("The pending migration proposal did not produce a preview.");
    const archetypeCount =
      migration.authority.collectionSearchArchetypes.length +
      migration.authority.productDetailArchetypes.length;
    expect(preview.pages).toHaveLength(migration.snapshot.pages.length);
    expect(projectCanonicalEditorPages({ draft: preview, catalogue })).toHaveLength(
      migration.snapshot.pages.length + archetypeCount,
    );
    expect(legacySnapshot).toEqual(legacyBeforeReview);
    expect(legacySnapshot.pages.length).toBeGreaterThan(preview.pages.length);
    expect(legacySnapshot.dynamicCommercePresentation).toBeUndefined();
  });

  it("shows an already canonical prompted proposal without requiring a migration envelope", () => {
    const { catalogue, snapshot } = currentScenario();
    const baselineBeforeReview = structuredClone(snapshot);
    const proposedStorefront = {
      pageOrder: snapshot.pages.map(({ id }) => id),
      pages: structuredClone(snapshot.pages),
      navigation: structuredClone(snapshot.navigation),
      brandSystem: structuredClone(snapshot.brandSystem),
      dynamicCommercePresentation: structuredClone(snapshot.dynamicCommercePresentation),
    };
    proposedStorefront.brandSystem.colors.primary = "#123456";

    const preview = proposalCanonicalReviewSnapshot({
      proposal: {
        status: "pending",
        proposedStorefront,
      },
      previewActive: true,
      visibleState: "proposalReady",
      acceptanceBaseline: snapshot,
    });

    if (!preview) throw new Error("The canonical prompted proposal did not produce a preview.");
    expect(preview.brandSystem.colors.primary).toBe("#123456");
    expect(preview.dynamicCommercePresentation).toEqual(snapshot.dynamicCommercePresentation);
    expect(projectCanonicalEditorPages({ draft: preview, catalogue }).length).toBeGreaterThan(
      preview.pages.length,
    );
    expect(snapshot).toEqual(baselineBeforeReview);
  });

  it("lists bounded archetypes rather than every concrete collection and product route", () => {
    const { authority, catalogue, snapshot } = currentScenario();
    const editorPages = projectCanonicalEditorPages({ draft: snapshot, catalogue });
    const executableCollectionArchetypes = authority.collectionSearchArchetypes.filter(
      (archetype) =>
        !snapshot.sharedFrame ||
        archetype.compatibleSharedFrameProfileIds.includes(snapshot.sharedFrame.profileId),
    );
    const archetypeIds = new Set([
      ...executableCollectionArchetypes.map(({ id }) => id),
      ...authority.productDetailArchetypes.map(({ id }) => id),
    ]);
    const dynamicPages = editorPages.filter(({ id }) => archetypeIds.has(id));
    const routeIds = new Set(authority.routeInventory.map(({ id }) => id));

    expect(dynamicPages.map(({ id }) => id).sort()).toEqual([...archetypeIds].sort());
    expect(dynamicPages).toHaveLength(
      executableCollectionArchetypes.length + authority.productDetailArchetypes.length,
    );
    expect(dynamicPages.some(({ id }) => routeIds.has(id))).toBe(false);
    expect(dynamicPages.filter(({ type }) => type === "product").length).toBeLessThan(
      catalogue.products.length,
    );
    expect(dynamicPages.filter(({ type }) => type === "collection").length).toBeLessThan(
      catalogue.collections.length,
    );
  });

  it("switches representative product, collection, and search contexts without persisting the choice", () => {
    const { authority, catalogue, snapshot } = currentScenario();
    const productArchetype = authority.productDetailArchetypes[0];
    const productRoutes = authority.routeInventory.filter(({ kind }) => kind === "product");
    const productRepresentative = productRoutes[productRoutes.length - 1];
    if (productRepresentative.kind !== "product") throw new Error("Expected a product route.");
    const searchArchetype = authority.collectionSearchArchetypes.find(
      ({ id }) => id === authority.searchArchetypeId,
    )!;
    const searchRoute = authority.routeInventory.find(({ kind }) => kind === "search")!;
    const collectionArchetype = authority.collectionSearchArchetypes.find(
      ({ id }) => id !== searchArchetype.id,
    )!;
    const collectionRoute = authority.routeInventory.find(({ kind }) => kind === "collection")!;
    if (collectionRoute.kind !== "collection") throw new Error("Expected a collection route.");
    const representativeRouteIds = {
      [productArchetype.id]: productRepresentative.id,
      [searchArchetype.id]: searchRoute.id,
      [collectionArchetype.id]: collectionRoute.id,
    };
    const projections = projectDynamicCommerceArchetypePages(
      snapshot,
      catalogue,
      representativeRouteIds,
    );
    const productPage = projections.find(({ archetype }) => archetype.id === productArchetype.id)!;
    const searchPage = projections.find(({ archetype }) => archetype.id === searchArchetype.id)!;
    const collectionPage = projections.find(
      ({ archetype }) => archetype.id === collectionArchetype.id,
    )!;

    expect(productPage.representativeRouteId).toBe(productRepresentative.id);
    expect(productPage.page.sections[0]?.content.productId).toBe(productRepresentative.productId);
    expect(searchPage.representativeRouteId).not.toBe(searchRoute.id);
    expect(searchPage.route.kind).toBe("collection");
    expect(searchPage.page.pageFamily?.commerceContext.kind).toBe("collection");
    expect(collectionPage.representativeRouteId).toBe(collectionRoute.id);
    expect(collectionPage.page.pageFamily?.commerceContext).toEqual({
      kind: "collection",
      collectionId: collectionRoute.collectionId,
    });

    const composed = composeActiveEditorDraft({
      draft: snapshot,
      sessionPages: {
        [productPage.page.id]: productPage.page,
        [searchPage.page.id]: searchPage.page,
        [collectionPage.page.id]: collectionPage.page,
      },
    });
    expect(composed.dynamicCommercePresentation).toEqual(snapshot.dynamicCommercePresentation);
    expect(composed.pages).toEqual(snapshot.pages);
    expect(canonicalValueString(composed)).not.toContain("representativeRouteId");
  });

  it("persists only a real archetype presentation edit and keeps route authority unchanged", () => {
    const { authority, catalogue, snapshot } = currentScenario();
    const productArchetype = authority.productDetailArchetypes[0];
    const alternateRoute = authority.routeInventory.filter(({ kind }) => kind === "product")[1];
    if (alternateRoute.kind !== "product") throw new Error("Expected a product route.");
    const projection = projectDynamicCommerceArchetypePages(snapshot, catalogue, {
      [productArchetype.id]: alternateRoute.id,
    }).find(({ archetype }) => archetype.id === productArchetype.id)!;
    const editedPage = structuredClone(projection.page);
    const originalShowSku = Boolean(editedPage.sections[0].props.showSku);
    editedPage.sections[0].props = {
      ...editedPage.sections[0].props,
      showSku: !originalShowSku,
    };

    const composed = composeActiveEditorDraft({
      draft: snapshot,
      sessionPages: { [editedPage.id]: editedPage },
    });
    const changedAuthority = composed.dynamicCommercePresentation!;
    const changedArchetype = changedAuthority.productDetailArchetypes.find(
      ({ id }) => id === productArchetype.id,
    )!;

    expect(changedAuthority.authorityRevision).toBe(authority.authorityRevision + 1);
    expect(changedAuthority.authorityFingerprint).not.toBe(authority.authorityFingerprint);
    expect(changedAuthority.routeInventory).toEqual(authority.routeInventory);
    expect(changedAuthority.productTypeMappings).toEqual(authority.productTypeMappings);
    expect(changedArchetype.componentPresentations[0]?.props.showSku).toBe(!originalShowSku);
    expect(canonicalValueString(changedArchetype)).not.toContain(alternateRoute.productId);
  });
});
