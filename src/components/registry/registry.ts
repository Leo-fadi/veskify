import type { ReactNode } from "react";
import {
  pageModelSchema,
  sectionInstanceSchema,
  storefrontSnapshotSchema,
  type PageModel,
  type PageType,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { aurumHeroDefinition } from "./aurum-hero";
import type { ComponentDefinition } from "./contract";

export const veskifyComponentRegistry = {
  hero: aurumHeroDefinition,
} as const satisfies Record<string, ComponentDefinition>;

export type RegisteredComponentType = keyof typeof veskifyComponentRegistry;

export function getComponentDefinition(component: string): ComponentDefinition {
  if (!Object.hasOwn(veskifyComponentRegistry, component)) {
    throw new Error(`Unknown storefront component: ${component}.`);
  }
  return veskifyComponentRegistry[component as RegisteredComponentType];
}

export function validateRegisteredSection(input: unknown, pageType?: PageType): SectionInstance {
  const section = sectionInstanceSchema.parse(input);
  return getComponentDefinition(section.component).validate(section, pageType);
}

export function renderRegisteredSection(input: unknown, pageType?: PageType): ReactNode {
  const section = validateRegisteredSection(input, pageType);
  return getComponentDefinition(section.component).render(section, pageType);
}

export function validateRegisteredPage(input: unknown): PageModel {
  const page = pageModelSchema.parse(input);
  page.sections.forEach((section) => validateRegisteredSection(section, page.type));
  return page;
}

export function validateRegisteredSnapshot(input: unknown): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(input);
  snapshot.pages.forEach(validateRegisteredPage);
  return snapshot;
}
