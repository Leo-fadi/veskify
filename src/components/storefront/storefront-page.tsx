import { Fragment, type ReactNode } from "react";
import {
  renderRegisteredSection,
  validateRegisteredPage,
  type StorefrontRenderContext,
} from "@/components/registry";
import type { PageModel } from "@/domain/storefront";

export function renderStorefrontPage(input: unknown, context: StorefrontRenderContext): ReactNode {
  const page = validateRegisteredPage(input, context);
  const visibleSections = page.sections.filter((section) => section.visible);
  const headerIndex = visibleSections.findIndex((section) => section.component === "header");
  const header = visibleSections.find((section) => section.component === "header");
  const footer = visibleSections.find((section) => section.component === "footer");
  const beforeHeader = headerIndex < 1 ? [] : visibleSections.slice(0, headerIndex);
  const content = visibleSections.filter(
    (section, index) =>
      index >= Math.max(headerIndex, 0) &&
      section.component !== "header" &&
      section.component !== "footer",
  );
  return (
    <Fragment>
      {beforeHeader.map((section) => (
        <Fragment key={section.id}>{renderRegisteredSection(section, context, page.type)}</Fragment>
      ))}
      {header ? renderRegisteredSection(header, context, page.type) : null}
      <main>
        {content.map((section) => (
          <Fragment key={section.id}>
            {renderRegisteredSection(section, context, page.type)}
          </Fragment>
        ))}
      </main>
      {footer ? renderRegisteredSection(footer, context, page.type) : null}
    </Fragment>
  );
}

export function validateStorefrontHomepage(input: unknown): PageModel {
  const page = validateRegisteredPage(input);
  if (page.type !== "home") {
    throw new Error("The storefront homepage must use the home page type.");
  }
  return page;
}
