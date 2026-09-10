import { failDynamicCommerceRouteAuthority as fail } from "./route-errors";
import { resolveProductComplexityArchetype } from "./route-selection";
import { type CatalogueDisplayModel } from "@/domain/catalogue";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommerceRouteInventoryEntry,
  type DynamicCommerceProductDetailArchetype,
  type PageFamilyAuthority,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { assertCurrentArchetype, exactAuthority } from "./current-authority";
import {
  pageAuthority,
  routeSection,
  type DynamicCommerceSearchRuntimeBinding,
} from "./route-projection";
export type { DynamicCommerceSearchRuntimeBinding } from "./route-projection";

export type ResolvedDynamicCommerceRoutePage = Readonly<{
  route: DynamicCommerceRouteInventoryEntry;
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype;
  page: PageModel;
}>;

export type DynamicCommerceRuntimeBindingPolicy =
  "runtime-collection-membership" | "runtime-search-results";

/**
 * The persisted v1 field describes the collection half of a shared collection/search archetype.
 * Runtime execution is truthfully discriminated by the selected route context without changing
 * historical snapshot or compiled-artifact fingerprints.
 */
export function resolveDynamicCommerceRuntimeBindingPolicy(
  archetype: DynamicCommerceCollectionSearchArchetype,
  context: "collection" | "search",
): DynamicCommerceRuntimeBindingPolicy {
  if (!archetype.supportedContexts.includes(context)) {
    return fail(
      "unknown-archetype",
      `The selected collection/search archetype does not support ${context} runtime binding.`,
    );
  }
  return context === "search" ? "runtime-search-results" : "runtime-collection-membership";
}

type DynamicCommerceRouteResolutionInput = Readonly<{
  snapshot: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  route?: string;
  routeId?: string;
  searchBinding?: DynamicCommerceSearchRuntimeBinding;
}> &
  (
    | Readonly<{ projection: "editor"; archetypeId?: string }>
    | Readonly<{ projection?: "runtime"; archetypeId?: never }>
  );

export function resolveDynamicCommerceRoutePage(
  input: DynamicCommerceRouteResolutionInput,
): ResolvedDynamicCommerceRoutePage {
  const authority = exactAuthority(input.snapshot);
  const route = authority.routeInventory.find((candidate) =>
    input.routeId ? candidate.id === input.routeId : candidate.route === input.route,
  );
  if (!route) return fail("unknown-route", "The requested dynamic commerce route is unavailable.");
  // Runtime selection is always recomputed from the snapshot's canonical
  // route/type mappings. A caller may select a different registered archetype
  // only while explicitly projecting that archetype into the editor.
  let archetypeId = input.projection === "editor" ? input.archetypeId : undefined;
  if (!archetypeId && route.kind === "collection") {
    archetypeId =
      authority.collectionRouteMappings.find(({ routeId }) => routeId === route.id)?.archetypeId ??
      authority.fallbacks.collectionArchetypeId;
  }
  if (!archetypeId && route.kind === "search") archetypeId = authority.searchArchetypeId;
  if (!archetypeId && route.kind === "product") {
    const product = input.catalogue.products.find(({ id }) => id === route.productId);
    if (!product) return fail("unknown-commerce-identity", "The route product is unavailable.");
    const knownType = authority.productTypeMappings.some(
      ({ productTypeId }) =>
        productTypeId === canonicalProductTypePresentationId(product.productType),
    );
    archetypeId = knownType
      ? resolveProductComplexityArchetype({ product, rules: authority.productComplexityRules })
      : authority.fallbacks.productDetailArchetypeId;
  }
  const archetype =
    authority.collectionSearchArchetypes.find(({ id }) => id === archetypeId) ??
    authority.productDetailArchetypes.find(({ id }) => id === archetypeId);
  if (!archetype)
    return fail("unknown-archetype", "The selected dynamic-commerce archetype is unavailable.");
  if (route.kind === "search" && archetype.family === "collection-search") {
    resolveDynamicCommerceRuntimeBindingPolicy(archetype, "search");
  }
  assertCurrentArchetype(input.snapshot, archetype);
  const product =
    route.kind === "product"
      ? input.catalogue.products.find(({ id }) => id === route.productId)
      : undefined;
  const collection =
    route.kind === "collection"
      ? input.catalogue.collections.find(({ id }) => id === route.collectionId)
      : undefined;
  if (route.kind === "product" && !product)
    return fail("unknown-commerce-identity", "The route product is unavailable.");
  if (route.kind === "collection" && !collection)
    return fail("unknown-commerce-identity", "The route collection is unavailable.");
  const commerceContext: PageFamilyAuthority["commerceContext"] =
    route.kind === "product"
      ? { kind: "product", productId: route.productId }
      : route.kind === "collection"
        ? { kind: "collection", collectionId: route.collectionId }
        : { kind: "search" };
  const title = product?.title ?? collection?.title ?? ({ en: "Search", fi: "Haku" } as const);
  const description =
    product?.description ??
    collection?.description ??
    ({ en: "Search the storefront catalogue.", fi: "Hae verkkokaupan valikoimasta." } as const);
  return {
    route: structuredClone(route),
    archetype: structuredClone(archetype),
    page: {
      id: input.projection === "editor" ? archetype.id : route.id,
      type: route.kind === "product" ? "product" : "collection",
      slug: route.route,
      title: structuredClone(title),
      seo: product?.seo ?? {
        title: structuredClone(title),
        metaDescription: structuredClone(description),
      },
      pageFamily: pageAuthority(input.snapshot, archetype, commerceContext),
      sections: [
        routeSection(
          archetype,
          route,
          input.catalogue,
          input.projection,
          input.searchBinding,
          new Set(
            authority.routeInventory.flatMap((candidate) =>
              candidate.kind === "product" ? [candidate.productId] : [],
            ),
          ),
        ),
      ],
    },
  };
}

export function dynamicCommerceRouteForProduct(
  snapshot: StorefrontSnapshot,
  productId: string,
): string | undefined {
  return snapshot.dynamicCommercePresentation?.routeInventory.find(
    (route) => route.kind === "product" && route.productId === productId,
  )?.route;
}

export function dynamicCommerceRouteForCollection(
  snapshot: StorefrontSnapshot,
  collectionId: string,
): string | undefined {
  return snapshot.dynamicCommercePresentation?.routeInventory.find(
    (route) => route.kind === "collection" && route.collectionId === collectionId,
  )?.route;
}
