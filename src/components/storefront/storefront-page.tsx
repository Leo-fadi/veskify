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
  if (context.sharedFrame) {
    const content = visibleSections.filter(
      (section) => !["announcementBar", "header", "footer"].includes(section.component),
    );
    return (
      <Fragment>
        {context.sharedFrame.announcement
          ? renderRegisteredSection(context.sharedFrame.announcement, context)
          : null}
        {renderRegisteredSection(context.sharedFrame.header, context)}
        <main>
          {content.map((section) => (
            <Fragment key={section.id}>
              {renderRegisteredSection(section, context, page.type)}
            </Fragment>
          ))}
        </main>
        {renderRegisteredSection(context.sharedFrame.footer, context)}
      </Fragment>
    );
  }
  const headerIndex = visibleSections.findIndex((section) => section.component === "header");
  const header = visibleSections.find((section) => section.component === "header");
  const footer = visibleSections.find((section) => section.component === "footer");
  const beforeHeader =
    headerIndex < 1
      ? []
      : visibleSections
          .slice(0, headerIndex)
          .filter((section) => section.component !== "header" && section.component !== "footer");
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
