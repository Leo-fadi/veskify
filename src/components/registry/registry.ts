import type { ReactNode } from "react";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { localeSchema, type Locale } from "@/domain/shared";
import {
  navigationModelSchema,
  pageModelSchema,
  sectionInstanceSchema,
  storefrontSnapshotSchema,
  type PageModel,
  type PageType,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { aurumHeroDefinition } from "./aurum-hero";
import { homepageDefinitions } from "./homepage";
import type { ComponentDefinition, StorefrontRenderContext } from "./contract";

export const veskifyComponentRegistry = {
  ...homepageDefinitions,
  hero: aurumHeroDefinition,
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
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(input);
  const context = catalogue
    ? createStorefrontRenderContext({ activeLocale, primaryLocale, catalogue, snapshot })
    : undefined;
  snapshot.pages.forEach((page) => validateRegisteredPage(page, context));
  return snapshot;
}

export function createStorefrontRenderContext({
  activeLocale,
  primaryLocale,
  catalogue,
  snapshot,
}: {
  activeLocale: Locale;
  primaryLocale: Locale;
  catalogue: CatalogueDisplayModel;
  snapshot: Pick<StorefrontSnapshot, "navigation" | "pages">;
}): StorefrontRenderContext {
  return {
    activeLocale: localeSchema.parse(activeLocale),
    primaryLocale: localeSchema.parse(primaryLocale),
    catalogue: catalogueDisplayModelSchema.parse(catalogue),
    navigation: navigationModelSchema.parse(snapshot.navigation),
    pagePaths: Object.fromEntries(snapshot.pages.map((page) => [page.id, page.slug])),
  };
}
