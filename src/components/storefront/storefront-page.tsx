import { Fragment, type ReactNode } from "react";
import {
  renderRegisteredSection,
  validateRegisteredPage,
} from "@/components/registry";
import type { Locale } from "@/domain/shared";
import type { PageModel, SectionInstance } from "@/domain/storefront";

function withLocaleProps(
  section: SectionInstance,
  activeLocale: Locale,
  primaryLocale: Locale,
): SectionInstance {
  if (
    !Object.hasOwn(section.props, "activeLocale") ||
    !Object.hasOwn(section.props, "primaryLocale")
  ) {
    return section;
  }

  return {
    ...section,
    props: { ...section.props, activeLocale, primaryLocale },
  };
}

export function renderStorefrontPage(
  input: unknown,
  activeLocale: Locale,
  primaryLocale: Locale,
): ReactNode {
  const page = validateRegisteredPage(input);
  return page.sections.map((section) => (
    <Fragment key={section.id}>
      {renderRegisteredSection(
        withLocaleProps(section, activeLocale, primaryLocale),
        page.type,
      )}
    </Fragment>
  ));
}

export function validateStorefrontHomepage(input: unknown): PageModel {
  const page = validateRegisteredPage(input);
  if (page.type !== "home") {
    throw new Error("The storefront homepage must use the home page type.");
  }
  return page;
}
