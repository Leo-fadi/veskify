import type { ReactNode } from "react";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { localeSchema, type Locale } from "@/domain/shared";
import {
  navigationModelSchema,
  pageModelSchema,
  sectionInstanceSchema,
  storefrontSnapshotSchema,
  validateCanonicalStorefrontSiteMap,
  type PageModel,
  type PageType,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { homepageCommerceBridgeDefinitions } from "./homepage-commerce-bridge";
import type { ComponentDefinition, StorefrontRenderContext } from "./contract";
import { veskifyLegacyComponentRegistry } from "./legacy-registry";

export const veskifyComponentRegistry = {
  ...veskifyLegacyComponentRegistry,
  ...homepageCommerceBridgeDefinitions,
} as const satisfies Record<string, ComponentDefinition>;

export type RegisteredComponentType = keyof typeof veskifyComponentRegistry;

export function getComponentDefinition(component: string): ComponentDefinition {
  if (!Object.hasOwn(veskifyComponentRegistry, component)) {
    throw new Error(`Unknown storefront component: ${component}.`);
  }
  return veskifyComponentRegistry[component as RegisteredComponentType];
}

export function validateRegisteredSection(
  input: unknown,
  pageType?: PageType,
  context?: StorefrontRenderContext,
): SectionInstance {
  const section = sectionInstanceSchema.parse(input);
  return getComponentDefinition(section.component).validate(section, pageType, context);
}

export function renderRegisteredSection(
  input: unknown,
  context: StorefrontRenderContext,
  pageType?: PageType,
): ReactNode {
  const section = validateRegisteredSection(input, pageType, context);
  return getComponentDefinition(section.component).render(section, context, pageType);
}

export function validateRegisteredPage(
  input: unknown,
  context?: StorefrontRenderContext,
): PageModel {
  const page = pageModelSchema.parse(input);
  page.sections.forEach((section) => validateRegisteredSection(section, page.type, context));
  return page;
}

export function validateRegisteredSnapshot(
  input: unknown,
  catalogue?: CatalogueDisplayModel,
  activeLocale: Locale = "en",
  primaryLocale: Locale = "en",
  enabledLocales?: readonly Locale[],
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(input);
  const context = catalogue
    ? createStorefrontRenderContext({ activeLocale, primaryLocale, catalogue, snapshot })
    : undefined;
  snapshot.pages.forEach((page) => validateRegisteredPage(page, context));
  validateCanonicalStorefrontSiteMap(snapshot, { catalogue, enabledLocales });
  return snapshot;
}

/** Canonical public path projection shared by renderer navigation and publish validation. */
export function createStorefrontPagePaths({
  snapshot,
  pagePathPrefix = "",
  pagePathSuffix = "",
}: {
  snapshot: Pick<StorefrontSnapshot, "pages">;
  pagePathPrefix?: string;
  pagePathSuffix?: string;
}): Readonly<Record<string, string>> {
  return Object.fromEntries(
    snapshot.pages.map((page) => [
      page.id,
      `${pagePathPrefix ? `${pagePathPrefix}${page.slug === "/" ? "" : page.slug}` : page.slug}${pagePathSuffix}`,
    ]),
  );
}

export function createStorefrontRenderContext({
  activeLocale,
  primaryLocale,
  catalogue,
  snapshot,
  pagePathPrefix = "",
  pagePathSuffix = "",
  renderTarget = "preview",
}: {
  activeLocale: Locale;
  primaryLocale: Locale;
  catalogue: CatalogueDisplayModel;
  snapshot: Pick<StorefrontSnapshot, "navigation" | "pages">;
  pagePathPrefix?: string;
  pagePathSuffix?: string;
  renderTarget?: StorefrontRenderContext["renderTarget"];
}): StorefrontRenderContext {
  const pagePaths = createStorefrontPagePaths({ snapshot, pagePathPrefix, pagePathSuffix });
  const homePage = snapshot.pages.find((page) => page.type === "home");

  return {
    activeLocale: localeSchema.parse(activeLocale),
    primaryLocale: localeSchema.parse(primaryLocale),
    catalogue: catalogueDisplayModelSchema.parse(catalogue),
    navigation: navigationModelSchema.parse(snapshot.navigation),
    pages: snapshot.pages,
    pagePaths,
    homePath: homePage ? pagePaths[homePage.id] : undefined,
    renderTarget,
  };
}
