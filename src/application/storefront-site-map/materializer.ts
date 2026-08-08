import {
  getExecutablePageBlueprintProfile,
  materializeExecutablePageBlueprint,
} from "@/application/storefront-templates";
import { validateRegisteredSnapshot, veskifyComponentDefinitionsV2 } from "@/components/registry";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import { canonicalLocaleOrder } from "@/domain/shared";
import {
  canonicalStorefrontSiteMapFingerprint,
  canonicalValueFingerprint,
  getPageFamilyDefinition,
  PAGE_FAMILY_AUTHORITY_VERSION,
  PageFamilyValidationError,
  SITE_MAP_SHARED_FRAME,
  storefrontRouteSchema,
  storefrontSnapshotSchema,
  validateCanonicalStorefrontSiteMap,
  validatePageFamilyRegistry,
  type NavigationModel,
  type PageFamilyAuthority,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  storefrontSiteMapDecisionSchema,
  type SiteMapPageDecision,
  type StorefrontSiteMapDecision,
} from "./contract";

export const siteMapMaterializationErrorCodes = [
  "invalid-decision",
  "project-mismatch",
  "missing-existing-page",
  "duplicate-route",
  "unsafe-route",
  "unsupported-page-family",
  "stale-page-family-version",
  "stale-profile-reference",
  "missing-evidence",
  "invalid-parent",
  "invalid-locale-coverage",
  "invalid-shared-frame",
] as const;
export type SiteMapMaterializationErrorCode = (typeof siteMapMaterializationErrorCodes)[number];

export class SiteMapMaterializationError extends Error {
  constructor(
    readonly code: SiteMapMaterializationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SiteMapMaterializationError";
  }
}

export type StorefrontSiteMapMaterialization = Readonly<{
  decision: StorefrontSiteMapDecision;
  snapshot: StorefrontSnapshot;
  omittedPages: readonly Readonly<{
    key: string;
    familyId: SiteMapPageDecision["familyId"];
    reason: "missing-approved-evidence";
  }>[];
  fingerprint: string;
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

function parseDecision(input: unknown): StorefrontSiteMapDecision {
  const parsed = storefrontSiteMapDecisionSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const unknownFamily = parsed.error.issues.some((issue) => issue.path.at(-1) === "familyId");
  const duplicateRoute = parsed.error.issues.some((issue) =>
    issue.message.includes("routes must be unique"),
  );
  throw new SiteMapMaterializationError(
    unknownFamily
      ? "unsupported-page-family"
      : duplicateRoute
        ? "duplicate-route"
        : "invalid-decision",
    unknownFamily
      ? "The site-map decision references an unsupported page family."
      : duplicateRoute
        ? "The site-map decision contains duplicate routes."
        : "The site-map decision is invalid.",
    { cause: parsed.error },
  );
}

function deterministicPageId(projectId: string, page: SiteMapPageDecision): string {
  return `page_${canonicalValueFingerprint({ projectId, familyId: page.familyId, route: page.route }).slice(-24)}`;
}

function deterministicNavigationId(pageId: string, area: "primary" | "footer"): string {
  return `nav_${canonicalValueFingerprint({ pageId, area }).slice(-24)}`;
}

function assertProfile(page: SiteMapPageDecision): void {
  const definition = getPageFamilyDefinition(page.familyId);
  if (page.familyVersion !== PAGE_FAMILY_AUTHORITY_VERSION) {
    throw new SiteMapMaterializationError(
      "stale-page-family-version",
      `Page ${page.key} references a stale family version.`,
    );
  }
  if (
    !definition.allowedProfileReferences.some(
      ({ id, version }) => id === page.profile.id && version === page.profile.version,
    )
  ) {
    throw new SiteMapMaterializationError(
      "stale-profile-reference",
      `Page ${page.key} references a profile outside its registered family authority.`,
    );
  }
  const pagePlan = getExecutablePageBlueprintProfile(page.profile.id);
  if (!pagePlan?.profile || pagePlan.profile.version !== page.profile.version) {
    throw new SiteMapMaterializationError(
      "stale-profile-reference",
      `Page ${page.key} references a stale executable PageBlueprint profile.`,
    );
  }
  materializeExecutablePageBlueprint({
    pagePlan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: pagePlan.profile.requiredBindingCategories,
  });
}

function assertLocales(decision: StorefrontSiteMapDecision, page: SiteMapPageDecision): void {
  const canonical = canonicalLocaleOrder(decision.localeCoverage);
  if (
    canonical.length !== decision.localeCoverage.length ||
    canonical.some((locale, index) => decision.localeCoverage[index] !== locale) ||
    page.localeCoverage.length !== canonical.length ||
    canonical.some((locale, index) => page.localeCoverage[index] !== locale)
  ) {
    throw new SiteMapMaterializationError(
      "invalid-locale-coverage",
      `Page ${page.key} does not cover the canonical site-map locale set.`,
    );
  }
}

function pageAuthority(
  decision: StorefrontSiteMapDecision,
  page: SiteMapPageDecision,
  parentPageId: string | undefined,
): PageFamilyAuthority {
  const definition = getPageFamilyDefinition(page.familyId);
  return {
    familyId: page.familyId,
    familyVersion: page.familyVersion,
    profileId: page.profile.id,
    profileVersion: page.profile.version,
    localeCoverage: [...page.localeCoverage],
    sharedFrameId: decision.sharedFrame.id,
    sharedFrameVersion: decision.sharedFrame.version,
    commerceContext: structuredClone(page.commerceContext),
    commerceOperationAuthority: definition.commerceOperationAuthority,
    navigationAreas: page.navigation.map(({ area }) => area),
    ...(parentPageId ? { parentPageId } : {}),
    evidenceReferences: structuredClone(page.evidenceReferences),
  };
}

function navigationFor(
  pages: readonly SiteMapPageDecision[],
  pageIds: ReadonlyMap<string, string>,
): NavigationModel {
  const build = (area: "primary" | "footer") =>
    pages
      .flatMap((page) =>
        page.navigation
          .filter((placement) => placement.area === area)
          .map((placement) => ({ page, placement })),
      )
      .sort(
        (left, right) =>
          left.placement.order - right.placement.order ||
          left.page.key.localeCompare(right.page.key),
      )
      .map(({ page, placement }) => {
        const pageId = pageIds.get(page.key)!;
        return {
          id: deterministicNavigationId(pageId, area),
          label: structuredClone(placement.label),
          target: { type: "page" as const, pageId },
        };
      });
  return { primary: build("primary"), footer: build("footer") };
}

export function materializeStorefrontSiteMap(
  input: Readonly<{
    decision: unknown;
    baseSnapshot: StorefrontSnapshot;
    catalogue: CatalogueDisplayModel;
  }>,
): StorefrontSiteMapMaterialization {
  const decision = parseDecision(input.decision);
  if (decision.projectId !== input.baseSnapshot.projectId) {
    throw new SiteMapMaterializationError(
      "project-mismatch",
      "The site-map decision does not belong to the base snapshot project.",
    );
  }
  validatePageFamilyRegistry();
  if (
    decision.sharedFrame.id !== SITE_MAP_SHARED_FRAME.id ||
    decision.sharedFrame.version !== SITE_MAP_SHARED_FRAME.version
  ) {
    throw new SiteMapMaterializationError(
      "invalid-shared-frame",
      "The site-map decision references an unavailable shared frame.",
    );
  }

  const omittedPages: Array<{
    key: string;
    familyId: SiteMapPageDecision["familyId"];
    reason: "missing-approved-evidence";
  }> = [];
  const includedPages = decision.pages.filter((page) => {
    if (!storefrontRouteSchema.safeParse(page.route).success) {
      throw new SiteMapMaterializationError(
        "unsafe-route",
        `Page ${page.key} has an unsafe route.`,
      );
    }
    assertProfile(page);
    assertLocales(decision, page);
    const definition = getPageFamilyDefinition(page.familyId);
    if (
      definition.evidenceRequirement === "approved-facts" &&
      page.evidenceReferences.length === 0
    ) {
      if (!page.required && definition.omissionBehavior === "omit-optional-or-fail-required") {
        omittedPages.push({
          key: page.key,
          familyId: page.familyId,
          reason: "missing-approved-evidence",
        });
        return false;
      }
      throw new SiteMapMaterializationError(
        "missing-evidence",
        `Required page ${page.key} lacks approved factual authority.`,
      );
    }
    return true;
  });

  const basePagesById = new Map(input.baseSnapshot.pages.map((page) => [page.id, page]));
  const pageIds = new Map(
    includedPages.map((page) => [
      page.key,
      page.existingPageId ?? deterministicPageId(decision.projectId, page),
    ]),
  );
  const pages: PageModel[] = includedPages.map((page) => {
    const existing = page.existingPageId ? basePagesById.get(page.existingPageId) : undefined;
    if (page.existingPageId && !existing) {
      throw new SiteMapMaterializationError(
        "missing-existing-page",
        `Page ${page.key} references a missing canonical page.`,
      );
    }
    const parentPageId = page.parentKey ? pageIds.get(page.parentKey) : undefined;
    if (page.parentKey && !parentPageId) {
      throw new SiteMapMaterializationError(
        "invalid-parent",
        `Page ${page.key} references an omitted or missing parent page.`,
      );
    }
    return {
      ...(existing ? structuredClone(existing) : { sections: [] }),
      id: pageIds.get(page.key)!,
      type: getPageFamilyDefinition(page.familyId).pageType,
      slug: page.route,
      title: structuredClone(page.title),
      seo: structuredClone(page.seo),
      pageFamily: pageAuthority(decision, page, parentPageId),
    };
  });
  const snapshot = storefrontSnapshotSchema.parse({
    ...structuredClone(input.baseSnapshot),
    navigation: navigationFor(includedPages, pageIds),
    pages,
  });
  try {
    validateCanonicalStorefrontSiteMap(snapshot, {
      catalogue: input.catalogue,
      enabledLocales: decision.localeCoverage,
    });
    validateRegisteredSnapshot(
      snapshot,
      input.catalogue,
      decision.localeCoverage[0],
      decision.localeCoverage[0],
      decision.localeCoverage,
    );
  } catch (cause) {
    if (cause instanceof PageFamilyValidationError) throw cause;
    throw new SiteMapMaterializationError(
      "invalid-decision",
      "The materialized site map failed canonical snapshot validation.",
      { cause },
    );
  }
  const fingerprint = canonicalStorefrontSiteMapFingerprint(snapshot);
  return deepFreeze({
    decision: structuredClone(decision),
    snapshot: structuredClone(snapshot),
    omittedPages,
    fingerprint,
  });
}
