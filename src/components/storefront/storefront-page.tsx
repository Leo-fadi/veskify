import { Fragment, type ReactNode } from "react";
import {
  renderRegisteredSection,
  validateRegisteredPage,
  type StorefrontRenderContext,
} from "@/components/registry";
import type { PageModel } from "@/domain/storefront";

export function renderStorefrontPage(input: unknown, context: StorefrontRenderContext): ReactNode {
  const page = validateRegisteredPage(input, context);
  return page.sections
    .filter((section) => section.visible)
    .map((section) => (
      <Fragment key={section.id}>{renderRegisteredSection(section, context, page.type)}</Fragment>
    ));
}

export function validateStorefrontHomepage(input: unknown): PageModel {
  const page = validateRegisteredPage(input);
  if (page.type !== "home") {
    throw new Error("The storefront homepage must use the home page type.");
  }
  return page;
}
