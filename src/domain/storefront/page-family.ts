import type { CatalogueDisplayModel } from "@/domain/catalogue";
import { canonicalLocaleOrder, type Locale } from "@/domain/shared";
import { canonicalValueFingerprint } from "./canonical-storefront";
import type { PageFamilyId, PageModel, PageType, StorefrontSnapshot } from "./storefront";

export const PAGE_FAMILY_AUTHORITY_VERSION = "1.0.0" as const;
export const SITE_MAP_SHARED_FRAME = Object.freeze({
  id: "blueprint-shared-storefront-frame",
  version: "1.0.0",
});

export const pageFamilyRouteClassValues = [
  "root",
  "collection-detail",
  "search",
  "product-detail",
  "content",
  "campaign",
  "cart",
  "checkout",
  "state",
  "not-found",
] as const;
export type PageFamilyRouteClass = (typeof pageFamilyRouteClassValues)[number];
export type PageFamilyCommerceContextRequirement = "none" | "search" | "collection" | "product";
export type PageFamilyEvidenceRequirement = "none" | "approved-facts";

export type PageFamilyDefinition = Readonly<{
  id: PageFamilyId;
  version: typeof PAGE_FAMILY_AUTHORITY_VERSION;
  pageType: PageType;
  routeClass: PageFamilyRouteClass;
  commerceContext: PageFamilyCommerceContextRequirement;
  allowedProfileReferences: readonly Readonly<{ id: string; version: "1.0.0" }>[];
  navigationEligibility: readonly ("primary" | "footer")[];
  localizationRequirement: "all-enabled-locales";
  sharedFrameRequirement: typeof SITE_MAP_SHARED_FRAME;
  evidenceRequirement: PageFamilyEvidenceRequirement;
  omissionBehavior: "never" | "omit-optional-or-fail-required";
  commerceOperationAuthority: "read-only-presentation" | "presentation-only";
}>;

const profile = (id: string) => Object.freeze({ id, version: "1.0.0" as const });
const bothNavigation = ["primary", "footer"] as const;
const contentProfile = profile("blueprint-site-map-content-baseline");
const stateProfile = profile("blueprint-site-map-state-baseline");

function definition(
  input: Omit<
    PageFamilyDefinition,
    "version" | "localizationRequirement" | "sharedFrameRequirement"
  >,
): PageFamilyDefinition {
  return Object.freeze({
    ...input,
    allowedProfileReferences: Object.freeze([...input.allowedProfileReferences]),
    navigationEligibility: Object.freeze([...input.navigationEligibility]),
    version: PAGE_FAMILY_AUTHORITY_VERSION,
    localizationRequirement: "all-enabled-locales",
    sharedFrameRequirement: SITE_MAP_SHARED_FRAME,
  });
}

export const pageFamilyDefinitions: readonly PageFamilyDefinition[] = Object.freeze([
  definition({
    id: "home",
    pageType: "home",
    routeClass: "root",
    commerceContext: "none",
    allowedProfileReferences: [profile("blueprint-site-map-home-baseline")],
    navigationEligibility: bothNavigation,
    evidenceRequirement: "none",
    omissionBehavior: "never",
    commerceOperationAuthority: "read-only-presentation",
  }),
  definition({
    id: "collection",
    pageType: "collection",
    routeClass: "collection-detail",
    commerceContext: "collection",
    allowedProfileReferences: [profile("blueprint-site-map-collection-baseline")],
    navigationEligibility: bothNavigation,
    evidenceRequirement: "none",
    omissionBehavior: "never",
    commerceOperationAuthority: "read-only-presentation",
  }),
  definition({
    id: "search-results",
    pageType: "collection",
    routeClass: "search",
    commerceContext: "search",
    allowedProfileReferences: [profile("blueprint-site-map-search-baseline")],
    navigationEligibility: ["primary"],
    evidenceRequirement: "none",
    omissionBehavior: "never",
    commerceOperationAuthority: "read-only-presentation",
  }),
  definition({
    id: "product-detail",
    pageType: "product",
    routeClass: "product-detail",
    commerceContext: "product",
    allowedProfileReferences: [profile("blueprint-site-map-product-baseline")],
    navigationEligibility: bothNavigation,
    evidenceRequirement: "none",
    omissionBehavior: "never",
    commerceOperationAuthority: "read-only-presentation",
  }),
  ...(
    [
      ["about", "approved-facts"],
      ["contact", "approved-facts"],
      ["store-locations", "approved-facts"],
      ["faq", "approved-facts"],
      ["shipping-information", "approved-facts"],
      ["returns-information", "approved-facts"],
      ["policy-legal", "approved-facts"],
      ["generic-content", "none"],
    ] as const
  ).map(([id, evidenceRequirement]) =>
    definition({
      id,
      pageType: "content",
      routeClass: "content",
      commerceContext: "none",
      allowedProfileReferences: [contentProfile],
      navigationEligibility: bothNavigation,
      evidenceRequirement,
      omissionBehavior: evidenceRequirement === "none" ? "never" : "omit-optional-or-fail-required",
      commerceOperationAuthority: "read-only-presentation",
    }),
  ),
  definition({
    id: "campaign-editorial",
    pageType: "landing",
    routeClass: "campaign",
    commerceContext: "none",
    allowedProfileReferences: [profile("blueprint-site-map-campaign-baseline")],
    navigationEligibility: bothNavigation,
    evidenceRequirement: "approved-facts",
    omissionBehavior: "omit-optional-or-fail-required",
    commerceOperationAuthority: "read-only-presentation",
  }),
  definition({
    id: "cart",
    pageType: "cart",
    routeClass: "cart",
    commerceContext: "none",
    allowedProfileReferences: [profile("blueprint-site-map-cart-baseline")],
    navigationEligibility: [],
    evidenceRequirement: "none",
    omissionBehavior: "never",
    commerceOperationAuthority: "presentation-only",
  }),
  definition({
    id: "checkout",
    pageType: "checkout",
    routeClass: "checkout",
    commerceContext: "none",
    allowedProfileReferences: [profile("blueprint-site-map-checkout-baseline")],
    navigationEligibility: [],
    evidenceRequirement: "none",
    omissionBehavior: "never",
    commerceOperationAuthority: "presentation-only",
  }),
  ...(["no-results", "empty-state", "error-state"] as const).map((id) =>
    definition({
      id,
      pageType: "content",
      routeClass: "state",
      commerceContext: "none",
      allowedProfileReferences: [stateProfile],
      navigationEligibility: [],
      evidenceRequirement: "none",
      omissionBehavior: "never",
      commerceOperationAuthority: "presentation-only",
    }),
  ),
  definition({
    id: "not-found",
    pageType: "content",
    routeClass: "not-found",
    commerceContext: "none",
    allowedProfileReferences: [stateProfile],
    navigationEligibility: [],
    evidenceRequirement: "none",
    omissionBehavior: "never",
    commerceOperationAuthority: "presentation-only",
  }),
]);

const pageFamiliesById = new Map(pageFamilyDefinitions.map((entry) => [entry.id, entry]));

export const pageFamilyValidationCodes = [
  "unsupported-page-family",
  "stale-page-family-version",
  "stale-profile-reference",
  "duplicate-route",
  "unsafe-route",
  "route-family-mismatch",
  "missing-homepage",
  "duplicate-homepage",
  "orphan-navigation",
  "navigation-target-missing",
  "invalid-commerce-context",
  "invalid-locale-coverage",
  "conflicting-route-namespace",
  "missing-evidence",
  "invalid-parent",
  "invalid-shared-frame",
  "commerce-authority-violation",
  "mixed-page-family-authority",
] as const;
export type PageFamilyValidationCode = (typeof pageFamilyValidationCodes)[number];

export class PageFamilyValidationError extends Error {
  constructor(
    readonly code: PageFamilyValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "PageFamilyValidationError";
  }
}

export function getPageFamilyDefinition(id: PageFamilyId): PageFamilyDefinition {
  const entry = pageFamiliesById.get(id);
  if (!entry) {
    throw new PageFamilyValidationError(
      "unsupported-page-family",
      `Unsupported page family ${id}.`,
    );
  }
  return entry;
}

export function listPageFamilyDefinitions(): readonly PageFamilyDefinition[] {
  return Object.freeze(pageFamilyDefinitions.map((entry) => structuredClone(entry)));
}

export function validatePageFamilyRegistry(
  entries: readonly PageFamilyDefinition[] = pageFamilyDefinitions,
): readonly PageFamilyDefinition[] {
  if (new Set(entries.map(({ id }) => id)).size !== entries.length) {
    throw new PageFamilyValidationError(
      "unsupported-page-family",
      "Page-family IDs must be unique.",
    );
  }
  entries.forEach((entry) => {
    const candidateVersion: string = entry.version;
    if (candidateVersion !== PAGE_FAMILY_AUTHORITY_VERSION) {
      throw new PageFamilyValidationError(
        "stale-page-family-version",
        `Page family ${entry.id} has unsupported version ${candidateVersion}.`,
      );
    }
    if (entry.allowedProfileReferences.length === 0) {
      throw new PageFamilyValidationError(
        "stale-profile-reference",
        `Page family ${entry.id} must allow at least one registered PageBlueprint profile.`,
      );
    }
  });
  return Object.freeze(entries.map((entry) => structuredClone(entry)));
}

function routeMatches(routeClass: PageFamilyRouteClass, route: string): boolean {
  switch (routeClass) {
    case "root":
      return route === "/";
    case "collection-detail":
      return /^\/collections\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route);
    case "search":
      return route === "/search";
    case "product-detail":
      return /^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route);
    case "content":
      return /^\/pages\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route);
    case "campaign":
      return /^\/campaigns\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route);
    case "cart":
      return route === "/cart";
    case "checkout":
      return route === "/checkout";
    case "state":
      return ["/states/no-results", "/states/empty", "/states/error"].includes(route);
    case "not-found":
      return route === "/404";
  }
}

function routeNamespace(route: string): PageFamilyRouteClass | undefined {
  if (route === "/") return "root";
  if (route === "/search") return "search";
  if (route === "/cart") return "cart";
  if (route === "/checkout") return "checkout";
  if (route === "/404") return "not-found";
  if (route.startsWith("/collections/")) return "collection-detail";
  if (route.startsWith("/products/")) return "product-detail";
  if (route.startsWith("/pages/")) return "content";
  if (route.startsWith("/campaigns/")) return "campaign";
  if (route.startsWith("/states/")) return "state";
  return undefined;
}

const exactFamilyRoutes: Readonly<Partial<Record<PageFamilyId, string>>> = Object.freeze({
  home: "/",
  "search-results": "/search",
  cart: "/cart",
  checkout: "/checkout",
  "no-results": "/states/no-results",
  "empty-state": "/states/empty",
  "error-state": "/states/error",
  "not-found": "/404",
});

function assertLocaleCoverage(page: PageModel, enabledLocales?: readonly Locale[]): void {
  const coverage = page.pageFamily!.localeCoverage;
  if (
    enabledLocales &&
    (coverage.length !== enabledLocales.length ||
      canonicalLocaleOrder(enabledLocales).some((locale, index) => coverage[index] !== locale))
  ) {
    throw new PageFamilyValidationError(
      "invalid-locale-coverage",
      `Page ${page.id} does not cover the enabled locale set.`,
    );
  }
  for (const locale of coverage) {
    if (!page.title[locale] || !page.seo.title[locale] || !page.seo.metaDescription[locale]) {
      throw new PageFamilyValidationError(
        "invalid-locale-coverage",
        `Page ${page.id} lacks ${locale} title or SEO coverage.`,
      );
    }
  }
}

function assertCommerceContext(
  page: PageModel,
  definition: PageFamilyDefinition,
  catalogue?: CatalogueDisplayModel,
): void {
  const context = page.pageFamily!.commerceContext;
  if (context.kind !== definition.commerceContext) {
    throw new PageFamilyValidationError(
      "invalid-commerce-context",
      `Page ${page.id} has incompatible ${context.kind} context for ${definition.id}.`,
    );
  }
  if (context.kind === "collection") {
    const collection = catalogue?.collections.find(({ id }) => id === context.collectionId);
    if (catalogue && !collection) {
      throw new PageFamilyValidationError(
        "invalid-commerce-context",
        `Page ${page.id} references an unknown collection.`,
      );
    }
    if (collection && page.slug !== `/collections/${collection.slug}`) {
      throw new PageFamilyValidationError(
        "route-family-mismatch",
        `Page ${page.id} route does not match its canonical collection context.`,
      );
    }
    const boundIds = page.sections.flatMap((section) =>
      typeof section.content.collectionId === "string" ? [section.content.collectionId] : [],
    );
    if (boundIds.some((id) => id !== context.collectionId)) {
      throw new PageFamilyValidationError(
        "invalid-commerce-context",
        `Page ${page.id} changes its protected collection binding.`,
      );
    }
  }
  if (context.kind === "product") {
    if (catalogue && !catalogue.products.some(({ id }) => id === context.productId)) {
      throw new PageFamilyValidationError(
        "invalid-commerce-context",
        `Page ${page.id} references an unknown product.`,
      );
    }
    const boundIds = page.sections.flatMap((section) =>
      typeof section.content.productId === "string" ? [section.content.productId] : [],
    );
    if (boundIds.some((id) => id !== context.productId)) {
      throw new PageFamilyValidationError(
        "invalid-commerce-context",
        `Page ${page.id} changes its protected product binding.`,
      );
    }
  }
}

export function validateCanonicalStorefrontSiteMap(
  snapshot: StorefrontSnapshot,
  options: Readonly<{
    catalogue?: CatalogueDisplayModel;
    enabledLocales?: readonly Locale[];
  }> = {},
): StorefrontSnapshot {
  const governedPages = snapshot.pages.filter((page) => page.pageFamily !== undefined);
  if (governedPages.length === 0) return snapshot;
  if (governedPages.length !== snapshot.pages.length) {
    throw new PageFamilyValidationError(
      "mixed-page-family-authority",
      "A governed page set cannot mix registered and unregistered page-family authority.",
    );
  }

  const routes = new Set<string>();
  const pagesById = new Map(snapshot.pages.map((page) => [page.id, page]));
  const homePages = snapshot.pages.filter((page) => page.pageFamily!.familyId === "home");
  if (homePages.length === 0) {
    throw new PageFamilyValidationError("missing-homepage", "The page set requires one homepage.");
  }
  if (homePages.length > 1) {
    throw new PageFamilyValidationError(
      "duplicate-homepage",
      "The page set has multiple homepages.",
    );
  }
  for (const page of snapshot.pages) {
    const authority = page.pageFamily!;
    const definition = getPageFamilyDefinition(authority.familyId);
    if (authority.familyVersion !== definition.version) {
      throw new PageFamilyValidationError(
        "stale-page-family-version",
        `Page ${page.id} references stale family authority.`,
      );
    }
    if (page.type !== definition.pageType) {
      throw new PageFamilyValidationError(
        "route-family-mismatch",
        `Page ${page.id} type does not match ${definition.id}.`,
      );
    }
    if (routes.has(page.slug)) {
      throw new PageFamilyValidationError("duplicate-route", `Duplicate route ${page.slug}.`);
    }
    routes.add(page.slug);
    const namespace = routeNamespace(page.slug);
    if (namespace && namespace !== definition.routeClass) {
      throw new PageFamilyValidationError(
        "conflicting-route-namespace",
        `Page ${page.id} uses the reserved ${namespace} namespace.`,
      );
    }
    if (!routeMatches(definition.routeClass, page.slug)) {
      throw new PageFamilyValidationError(
        page.slug.startsWith("/") ? "route-family-mismatch" : "unsafe-route",
        `Page ${page.id} route is incompatible with ${definition.id}.`,
      );
    }
    if (exactFamilyRoutes[definition.id] && exactFamilyRoutes[definition.id] !== page.slug) {
      throw new PageFamilyValidationError(
        "route-family-mismatch",
        `Page ${page.id} does not use the canonical ${definition.id} route.`,
      );
    }
    if (
      !definition.allowedProfileReferences.some(
        ({ id, version }) => id === authority.profileId && version === authority.profileVersion,
      )
    ) {
      throw new PageFamilyValidationError(
        "stale-profile-reference",
        `Page ${page.id} references an unavailable PageBlueprint profile.`,
      );
    }
    if (
      authority.sharedFrameId !== definition.sharedFrameRequirement.id ||
      authority.sharedFrameVersion !== definition.sharedFrameRequirement.version
    ) {
      throw new PageFamilyValidationError(
        "invalid-shared-frame",
        `Page ${page.id} does not use the registered shared frame.`,
      );
    }
    if (authority.commerceOperationAuthority !== definition.commerceOperationAuthority) {
      throw new PageFamilyValidationError(
        "commerce-authority-violation",
        `Page ${page.id} claims commerce authority outside ${definition.id}.`,
      );
    }
    if (
      authority.navigationAreas.some((area) => !definition.navigationEligibility.includes(area))
    ) {
      throw new PageFamilyValidationError(
        "orphan-navigation",
        `Page ${page.id} uses an ineligible navigation area.`,
      );
    }
    if (
      definition.evidenceRequirement === "approved-facts" &&
      authority.evidenceReferences.length === 0
    ) {
      throw new PageFamilyValidationError(
        "missing-evidence",
        `Page ${page.id} requires approved factual authority.`,
      );
    }
    assertLocaleCoverage(page, options.enabledLocales);
    assertCommerceContext(page, definition, options.catalogue);
  }

  for (const page of snapshot.pages) {
    const parentId = page.pageFamily!.parentPageId;
    if (parentId && (!pagesById.has(parentId) || parentId === page.id)) {
      throw new PageFamilyValidationError(
        "invalid-parent",
        `Page ${page.id} has an invalid parent page.`,
      );
    }
    const visited = new Set([page.id]);
    let cursor = parentId;
    while (cursor) {
      if (visited.has(cursor)) {
        throw new PageFamilyValidationError(
          "invalid-parent",
          "Page parent relationships are cyclic.",
        );
      }
      visited.add(cursor);
      cursor = pagesById.get(cursor)?.pageFamily?.parentPageId;
    }
  }

  for (const [area, items] of Object.entries(snapshot.navigation) as Array<
    ["primary" | "footer", StorefrontSnapshot["navigation"]["primary"]]
  >) {
    for (const item of items) {
      if (item.target.type !== "page") continue;
      const page = pagesById.get(item.target.pageId);
      if (!page) {
        throw new PageFamilyValidationError(
          "navigation-target-missing",
          `Navigation ${item.id} targets a missing page.`,
        );
      }
      if (!page.pageFamily!.navigationAreas.includes(area)) {
        throw new PageFamilyValidationError(
          "orphan-navigation",
          `Navigation ${item.id} is not declared by page ${page.id}.`,
        );
      }
    }
  }
  for (const page of snapshot.pages) {
    for (const area of page.pageFamily!.navigationAreas) {
      const count = snapshot.navigation[area].filter(
        (item) => item.target.type === "page" && item.target.pageId === page.id,
      ).length;
      if (count !== 1) {
        throw new PageFamilyValidationError(
          "orphan-navigation",
          `Page ${page.id} must resolve exactly once in ${area} navigation.`,
        );
      }
    }
    const definition = getPageFamilyDefinition(page.pageFamily!.familyId);
    if (
      definition.navigationEligibility.length > 0 &&
      page.pageFamily!.navigationAreas.length === 0 &&
      !page.pageFamily!.parentPageId
    ) {
      throw new PageFamilyValidationError(
        "orphan-navigation",
        `Page ${page.id} is unreachable from canonical navigation or a parent page.`,
      );
    }
  }
  return snapshot;
}

export function canonicalStorefrontSiteMapFingerprint(snapshot: StorefrontSnapshot): string {
  validateCanonicalStorefrontSiteMap(snapshot);
  return `site-map-${canonicalValueFingerprint({
    pages: snapshot.pages.map(({ id, type, slug, pageFamily }) => ({ id, type, slug, pageFamily })),
    navigation: snapshot.navigation,
  })}`;
}
