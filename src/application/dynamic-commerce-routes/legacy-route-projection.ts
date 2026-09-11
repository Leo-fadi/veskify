import { storefrontSnapshotSchema, type StorefrontSnapshot } from "@/domain/storefront";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { StorefrontSiteMapDecision } from "@/application/storefront-site-map/contract";
import { exactAuthority } from "./current-authority";
import { resolveDynamicCommerceRoutePage } from "./route-resolution";

export function expandDynamicCommerceRoutePages(
  snapshotInput: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const authority = exactAuthority(snapshot);
  const pages = [
    ...snapshot.pages.map((page) => structuredClone(page)),
    ...authority.routeInventory
      .filter(({ kind }) => kind !== "search")
      .map(({ id }) => resolveDynamicCommerceRoutePage({ snapshot, catalogue, routeId: id }).page),
  ];
  const navigation = Object.fromEntries(
    Object.entries(snapshot.navigation).map(([area, items]) => [
      area,
      items.flatMap((item) => {
        const target = item.target;
        if (target.type !== "dynamic-commerce-route") return [structuredClone(item)];
        const route = authority.routeInventory.find(({ id }) => id === target.routeId);
        return route?.kind === "search"
          ? []
          : [{ ...item, target: { type: "page" as const, pageId: target.routeId } }];
      }),
    ]),
  );
  const { dynamicCommercePresentation: _authority, ...legacy } = snapshot;
  void _authority;
  return storefrontSnapshotSchema.parse({ ...legacy, pages, navigation });
}

type DynamicRouteInventoryEntry = NonNullable<
  StorefrontSnapshot["dynamicCommercePresentation"]
>["routeInventory"][number];

function routeIdentityMatchesSiteMapPage(
  route: DynamicRouteInventoryEntry,
  page: StorefrontSiteMapDecision["pages"][number],
): boolean {
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
}

/**
 * Migrated commerce routes are canonical identities even though they are no longer persisted as
 * concrete pages. Site-map rematerialization still needs an exact existing-page projection so it
 * can preserve those identities. The projection is deliberately transient: the later migration
 * boundary folds these pages back into the one compact dynamic-commerce authority.
 */
function reconcileMigratedRoutePageIdentities(
  draft: StorefrontSnapshot,
  decision: StorefrontSiteMapDecision,
): StorefrontSnapshot {
  const baseSnapshot = structuredClone(draft);
  const authority = baseSnapshot.dynamicCommercePresentation;
  if (!authority) return baseSnapshot;

  const existingPageIds = new Set(baseSnapshot.pages.map(({ id }) => id));
  const routesById = new Map(authority.routeInventory.map((route) => [route.id, route]));
  const transientRoutePages = decision.pages.flatMap((page) => {
    if (!page.existingPageId || existingPageIds.has(page.existingPageId)) return [];
    const route = routesById.get(page.existingPageId);
    if (!route || !routeIdentityMatchesSiteMapPage(route, page)) return [];
    return [
      {
        id: route.id,
        type: route.kind === "product" ? ("product" as const) : ("collection" as const),
        slug: route.route,
        title: structuredClone(page.title),
        seo: structuredClone(page.seo),
        sections: [],
      },
    ];
  });

  baseSnapshot.pages = [...baseSnapshot.pages, ...transientRoutePages];
  // A canonical snapshot cannot persist both concrete route pages and the compact route
  // inventory. Remove the compact authority only after its referenced identities are projected.
  delete baseSnapshot.dynamicCommercePresentation;
  return baseSnapshot;
}

export { reconcileMigratedRoutePageIdentities };
