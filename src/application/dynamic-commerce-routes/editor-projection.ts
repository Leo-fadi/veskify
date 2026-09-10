import { collectionPresentation, productPresentation } from "./archetype-presentation";
import { exactAuthority } from "./current-authority";
import { projectSectionStyleOverrides } from "./presentation-style";
import { failDynamicCommerceRouteAuthority as fail } from "./route-errors";
import {
  resolveDynamicCommerceRoutePage,
  type ResolvedDynamicCommerceRoutePage,
} from "./route-resolution";
import { type CatalogueDisplayModel } from "@/domain/catalogue";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
  isDynamicCommerceArchetypeCompatibleWithSharedFrame,
  storefrontSnapshotSchema,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommerceProductDetailArchetype,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";

export type DynamicCommerceEditorProjection = ResolvedDynamicCommerceRoutePage &
  Readonly<{ representativeRouteId: string }>;

export function projectDynamicCommerceArchetypePages(
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
  representativeRouteIds: Readonly<Record<string, string>> = {},
): DynamicCommerceEditorProjection[] {
  const authority = exactAuthority(snapshot);
  const projections: DynamicCommerceEditorProjection[] = [];
  for (const archetype of authority.collectionSearchArchetypes) {
    if (
      snapshot.sharedFrame &&
      !isDynamicCommerceArchetypeCompatibleWithSharedFrame(
        archetype,
        snapshot.sharedFrame.profileId,
      )
    ) {
      continue;
    }
    const mapped = authority.collectionRouteMappings.find(
      ({ archetypeId }) => archetypeId === archetype.id,
    );
    const fallbackRoute = authority.routeInventory.find(({ kind }) => kind === "collection");
    const requested = authority.routeInventory.find(
      ({ id, kind }) => id === representativeRouteIds[archetype.id] && kind === "collection",
    );
    const routeId = requested?.id ?? mapped?.routeId ?? fallbackRoute?.id;
    if (!routeId) continue;
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue,
      routeId,
      archetypeId: archetype.id,
      projection: "editor",
    });
    projections.push({ ...resolved, representativeRouteId: routeId });
  }
  for (const archetype of authority.productDetailArchetypes) {
    const mappedType = authority.productTypeMappings.find(
      ({ archetypeId }) => archetypeId === archetype.id,
    );
    const mappedProduct = mappedType
      ? catalogue.products.find(
          (product) =>
            canonicalProductTypePresentationId(product.productType) === mappedType.productTypeId,
        )
      : undefined;
    const fallbackRoute = authority.routeInventory.find(
      (route) =>
        route.kind === "product" && (!mappedProduct || route.productId === mappedProduct.id),
    );
    const requested = authority.routeInventory.find(
      ({ id, kind }) => id === representativeRouteIds[archetype.id] && kind === "product",
    );
    const routeId = requested?.id ?? fallbackRoute?.id;
    if (!routeId) continue;
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue,
      routeId,
      archetypeId: archetype.id,
      projection: "editor",
    });
    projections.push({ ...resolved, representativeRouteId: routeId });
  }
  return projections;
}

export function applyDynamicCommerceArchetypePage(
  snapshotInput: StorefrontSnapshot,
  page: PageModel,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const authority = exactAuthority(snapshot);
  const collectionIndex = authority.collectionSearchArchetypes.findIndex(
    ({ id }) => id === page.id,
  );
  const productIndex = authority.productDetailArchetypes.findIndex(({ id }) => id === page.id);
  if (collectionIndex < 0 && productIndex < 0) return snapshot;
  if (page.sections.length !== 1)
    return fail("invalid-presentation", "An archetype must retain one composite section.");
  const section = page.sections[0];
  const current =
    collectionIndex >= 0
      ? authority.collectionSearchArchetypes[collectionIndex]
      : authority.productDetailArchetypes[productIndex];
  const presentation =
    current.family === "collection-search"
      ? collectionPresentation(current.profile.profileId, section)
      : productPresentation(current.profile.profileId, section);
  const currentPresentation = current.componentPresentations[0];
  const presentationWithRetainedAssets = {
    ...presentation,
    approvedAssetSelections: (currentPresentation?.approvedAssetSelections ?? []).map((selection) =>
      structuredClone(selection),
    ),
  };
  const canonicalPresentation =
    currentPresentation &&
    canonicalValueString(projectSectionStyleOverrides(currentPresentation.styleOverrides)) ===
      canonicalValueString(
        projectSectionStyleOverrides(presentationWithRetainedAssets.styleOverrides),
      )
      ? {
          ...presentationWithRetainedAssets,
          styleOverrides: structuredClone(currentPresentation.styleOverrides),
        }
      : presentationWithRetainedAssets;
  if (
    canonicalValueString(current.componentPresentations) ===
    canonicalValueString([canonicalPresentation])
  ) {
    return snapshot;
  }
  const nextArchetype = {
    ...structuredClone(current),
    componentPresentations: [canonicalPresentation],
  } as typeof current;
  const nextAuthorityWithoutFingerprint = {
    ...structuredClone(authority),
    authorityRevision: authority.authorityRevision + 1,
    collectionSearchArchetypes:
      collectionIndex >= 0
        ? authority.collectionSearchArchetypes.map((entry, index) =>
            index === collectionIndex
              ? (nextArchetype as DynamicCommerceCollectionSearchArchetype)
              : entry,
          )
        : authority.collectionSearchArchetypes,
    productDetailArchetypes:
      productIndex >= 0
        ? authority.productDetailArchetypes.map((entry, index) =>
            index === productIndex
              ? (nextArchetype as DynamicCommerceProductDetailArchetype)
              : entry,
          )
        : authority.productDetailArchetypes,
  };
  const { authorityFingerprint: _authorityFingerprint, ...material } =
    nextAuthorityWithoutFingerprint;
  void _authorityFingerprint;
  const dynamicCommercePresentation = createDynamicCommercePresentationAuthority(material);
  return storefrontSnapshotSchema.parse({ ...snapshot, dynamicCommercePresentation });
}
