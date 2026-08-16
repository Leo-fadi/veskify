import { Fragment, type ReactNode } from "react";
import {
  renderRegisteredSection,
  storefrontMainContentId,
  validateRegisteredPage,
  withCurrentStorefrontPage,
  type StorefrontRenderContext,
} from "@/components/registry";
import type { PageModel } from "@/domain/storefront";

export function renderStorefrontPage(input: unknown, context: StorefrontRenderContext): ReactNode {
  const page = validateRegisteredPage(input, context);
  const pageContext = withCurrentStorefrontPage(context, page);
  const visibleSections = page.sections.filter((section) => section.visible);
  if (pageContext.sharedFrame) {
    const content = visibleSections.filter(
      (section) => !["announcementBar", "header", "footer"].includes(section.component),
    );
    return (
      <Fragment>
        {pageContext.sharedFrame.announcement
          ? renderRegisteredSection(pageContext.sharedFrame.announcement, pageContext)
          : null}
        {renderRegisteredSection(pageContext.sharedFrame.header, pageContext)}
        <main id={storefrontMainContentId} tabIndex={-1}>
          {content.map((section) => (
            <Fragment key={section.id}>
              {renderRegisteredSection(section, pageContext, page.type)}
            </Fragment>
          ))}
        </main>
        {renderRegisteredSection(pageContext.sharedFrame.footer, pageContext)}
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
        <Fragment key={section.id}>
          {renderRegisteredSection(section, pageContext, page.type)}
        </Fragment>
      ))}
      {header ? renderRegisteredSection(header, pageContext, page.type) : null}
      <main id={storefrontMainContentId} tabIndex={-1}>
        {content.map((section) => (
          <Fragment key={section.id}>
            {renderRegisteredSection(section, pageContext, page.type)}
          </Fragment>
        ))}
      </main>
      {footer ? renderRegisteredSection(footer, pageContext, page.type) : null}
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
