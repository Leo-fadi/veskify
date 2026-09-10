import { projectSectionStyleOverrides } from "./presentation-style";
import { failDynamicCommerceRouteAuthority as fail } from "./route-errors";
import { type CatalogueDisplayModel } from "@/domain/catalogue";
import { idSchema } from "@/domain/shared";
import {
  PAGE_FAMILY_AUTHORITY_VERSION,
  SITE_MAP_SHARED_FRAME,
  canonicalValueFingerprint,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommerceRouteInventoryEntry,
  type DynamicCommerceProductDetailArchetype,
  type PageFamilyAuthority,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";

export function pageAuthority(
  snapshot: StorefrontSnapshot,
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype,
  commerceContext: PageFamilyAuthority["commerceContext"],
): PageFamilyAuthority {
  const localeCoverage = [
    ...new Set(snapshot.pages.flatMap((page) => page.pageFamily?.localeCoverage ?? [])),
  ];
  return {
    familyId:
      archetype.family === "product-detail"
        ? "product-detail"
        : commerceContext.kind === "search"
          ? "search-results"
          : "collection",
    familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
    profileId: archetype.profile.profileId,
    profileVersion: archetype.profile.profileVersion,
    localeCoverage: localeCoverage.length > 0 ? localeCoverage : ["en"],
    sharedFrameId: SITE_MAP_SHARED_FRAME.id,
    sharedFrameVersion: SITE_MAP_SHARED_FRAME.version,
    commerceContext,
    commerceOperationAuthority: "read-only-presentation",
    navigationAreas: [],
    evidenceReferences: [],
  };
}

export function routeSection(
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype,
  route: DynamicCommerceRouteInventoryEntry,
  catalogue: CatalogueDisplayModel,
  projection: "runtime" | "editor" | undefined,
  searchBinding?: DynamicCommerceSearchRuntimeBinding,
  publicProductRouteIds: ReadonlySet<string> = new Set(),
): SectionInstance {
  const presentation = archetype.componentPresentations[0];
  if (!presentation) return fail("invalid-presentation", "The selected archetype is empty.");
  const revision = `canonical-commerce-${canonicalValueFingerprint(catalogue)}`;
  const approvedAssetSelections = presentation.approvedAssetSelections ?? [];
  const sectionId =
    projection === "editor"
      ? `section_${archetype.id}`
      : dynamicCommerceRouteSectionId(route.id, archetype.id);
  const approvedAssetPlacements = approvedAssetSelections.map((selection) => ({
    type: "PLACE_APPROVED_SOURCE_ASSET" as const,
    pageId: projection === "editor" ? archetype.id : route.id,
    componentId: sectionId,
    componentType: presentation.component,
    assetSlotId: selection.assetSlotId,
    assetId: selection.assetId,
    role: selection.role,
    assetRevision: selection.assetRevision,
    materialFingerprint: selection.materialFingerprint,
    sourceReferenceId: selection.sourceReferenceId,
    ...(selection.sourceProvenanceKind
      ? { sourceProvenanceKind: selection.sourceProvenanceKind }
      : {}),
    ...(selection.placementContext ? { placementContext: selection.placementContext } : {}),
    ...(selection.placementPurpose ? { placementPurpose: selection.placementPurpose } : {}),
    ...(selection.reusePolicy ? { reusePolicy: selection.reusePolicy } : {}),
    ...(selection.affinity ? { affinity: selection.affinity } : {}),
    ...(selection.responsiveSourceAssetIds
      ? { responsiveSourceAssetIds: [...selection.responsiveSourceAssetIds] }
      : {}),
    required: selection.required,
  }));
  const approvedAssetPresentations = approvedAssetSelections.map(({ presentation: asset }) =>
    structuredClone(asset),
  );
  if (route.kind === "product" && archetype.family === "product-detail") {
    const relatedProductIds = route.relatedProductIds ?? [];
    if (
      relatedProductIds.some(
        (relatedProductId) => !catalogue.products.some(({ id }) => id === relatedProductId),
      )
    ) {
      return fail(
        "unknown-commerce-identity",
        "A protected related-product binding is unavailable in the current catalogue.",
      );
    }
    return {
      id: sectionId,
      component: "dynamicProductDetail",
      variant: presentation.variant,
      visible: presentation.visible,
      content: {
        ...structuredClone(presentation.content),
        productId: route.productId,
        // This is an exact protected runtime binding retained from canonical
        // materialization or migration. Never infer relations from catalogue
        // order or place them in editable archetype design state.
        relatedProductIds: [...relatedProductIds],
        canonicalRevision: revision,
      },
      props: structuredClone(presentation.props),
      styleOverrides: structuredClone(projectSectionStyleOverrides(presentation.styleOverrides)),
      approvedAssetPlacements,
      approvedAssetPresentations,
    };
  }
  if (route.kind === "collection" && archetype.family === "collection-search") {
    const collection = catalogue.collections.find(({ id }) => id === route.collectionId);
    if (!collection)
      return fail("unknown-commerce-identity", "The route collection is unavailable.");
    return {
      id: sectionId,
      component: "dynamicCollectionCommerce",
      variant: presentation.variant,
      visible: presentation.visible,
      content: {
        ...structuredClone(presentation.content),
        collectionId: collection.id,
        productIds: [...collection.productIds],
        canonicalRevision: revision,
      },
      props: structuredClone(presentation.props),
      styleOverrides: structuredClone(projectSectionStyleOverrides(presentation.styleOverrides)),
      approvedAssetPlacements,
      approvedAssetPresentations,
    };
  }
  if (route.kind === "search" && archetype.family === "collection-search") {
    if (!searchBinding) {
      return fail(
        "unknown-commerce-identity",
        "Search presentation requires an exact transient canonical search-result projection.",
      );
    }
    if (searchBinding.canonicalRevision !== revision) {
      return fail(
        "stale-authority",
        "The transient search result revision no longer matches the canonical catalogue.",
      );
    }
    if (new Set(searchBinding.resultProductIds).size !== searchBinding.resultProductIds.length) {
      return fail("invalid-presentation", "Transient search result identities must be unique.");
    }
    for (const productId of searchBinding.resultProductIds) {
      if (!catalogue.products.some(({ id }) => id === productId)) {
        return fail(
          "unknown-commerce-identity",
          "A transient search result is unavailable in the current catalogue.",
        );
      }
      if (!publicProductRouteIds.has(productId)) {
        return fail(
          "unknown-commerce-identity",
          "A transient search result has no current public product route authority.",
        );
      }
    }
    return {
      id: sectionId,
      component: "dynamicCollectionCommerce",
      variant: presentation.variant,
      visible: presentation.visible,
      content: {
        ...structuredClone(presentation.content),
        productIds: [...searchBinding.resultProductIds],
        canonicalRevision: revision,
      },
      props: structuredClone(presentation.props),
      styleOverrides: structuredClone(projectSectionStyleOverrides(presentation.styleOverrides)),
      approvedAssetPlacements,
      approvedAssetPresentations,
    };
  }
  return fail(
    "unknown-archetype",
    "The selected archetype does not match the dynamic route family.",
  );
}

export function dynamicCommerceRouteSectionId(routeId: string, archetypeId: string): string {
  return idSchema.parse(`section_${routeId}_${archetypeId}`);
}

/**
 * Exact runtime-only product membership for the single persisted search route. This binding is
 * derived from the current catalogue by StorefrontProductSearchPort and is never snapshot state.
 */
export type DynamicCommerceSearchRuntimeBinding = Readonly<{
  canonicalRevision: string;
  resultProductIds: readonly string[];
}>;
