import { expect, type Page } from "@playwright/test";

const tolerance = 1;

type Rect = Readonly<{
  bottom: number;
  left: number;
  right: number;
  top: number;
}>;

export type StorefrontGeometryViolation = Readonly<{
  boundary: Rect;
  boundaryDescription: string;
  element: string;
  kind: "document-overflow" | "outside-boundary" | "outside-viewport";
  rect: Rect;
  route: string;
  viewport: string;
}>;

const formatViolation = (violation: StorefrontGeometryViolation) =>
  `${violation.kind} on ${violation.route} at ${violation.viewport}: ${violation.element} ` +
  `rect=${JSON.stringify(violation.rect)} exceeded ${violation.boundaryDescription} ` +
  `boundary=${JSON.stringify(violation.boundary)}`;

export async function storefrontGeometryViolations(
  page: Page,
): Promise<StorefrontGeometryViolation[]> {
  return page.evaluate((pixelTolerance) => {
    type BrowserRect = { bottom: number; left: number; right: number; top: number };
    type BrowserViolation = {
      boundary: BrowserRect;
      boundaryDescription: string;
      element: string;
      kind: "document-overflow" | "outside-boundary" | "outside-viewport";
      rect: BrowserRect;
      route: string;
      viewport: string;
    };

    const rect = (value: DOMRect): BrowserRect => ({
      bottom: Number(value.bottom.toFixed(2)),
      left: Number(value.left.toFixed(2)),
      right: Number(value.right.toFixed(2)),
      top: Number(value.top.toFixed(2)),
    });
    const viewport = `${window.innerWidth}x${window.innerHeight}`;
    const viewportRect = { bottom: window.innerHeight, left: 0, right: window.innerWidth, top: 0 };
    const route = `${window.location.pathname}${window.location.search}`;
    const isClippingOverflow = (style: CSSStyleDeclaration) =>
      style.overflowX === "hidden" || style.overflowX === "clip";
    const isScrollableOverflow = (style: CSSStyleDeclaration) =>
      style.overflowX === "auto" || style.overflowX === "scroll";
    const isMeaningful = (element: Element) =>
      element.matches(
        "a, button, input, select, textarea, summary, [role], h1, h2, h3, h4, h5, h6, p, li, label, img, video",
      );
    const isExcluded = (element: Element) =>
      Boolean(
        element.closest(
          "[aria-hidden='true'], [data-storefront-geometry-ignore], [hidden], dialog:not([open]), [role='dialog'][aria-hidden='true']",
        ) || element.matches("img[alt=''], [role='presentation'], [data-storefront-decorative]"),
      );
    const hasIntendedScroller = (element: Element) => {
      let current: Element | null = element.parentElement;
      while (current) {
        const style = window.getComputedStyle(current);
        if (
          isScrollableOverflow(style) &&
          current.scrollWidth > current.clientWidth + pixelTolerance
        ) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    };
    const clippingBoundaries = (element: Element) => {
      const boundaries: Element[] = [];
      let current: Element | null = element.parentElement;
      while (current) {
        if (isClippingOverflow(window.getComputedStyle(current))) boundaries.push(current);
        current = current.parentElement;
      }
      return boundaries;
    };
    const elementDescription = (element: Element) => {
      const id = element.id ? `#${element.id}` : "";
      const classes = Array.from(element.classList)
        .filter((className) => !className.startsWith("__"))
        .slice(0, 2)
        .map((className) => `.${className}`)
        .join("");
      const label =
        element.getAttribute("aria-label") ?? element.textContent?.trim().replace(/\s+/g, " ");
      return `${element.tagName.toLowerCase()}${id}${classes}${label ? ` (${label.slice(0, 80)})` : ""}`;
    };
    const outside = (value: DOMRect, boundary: BrowserRect) =>
      value.left < boundary.left - pixelTolerance || value.right > boundary.right + pixelTolerance;
    const visible = (element: Element, value: DOMRect) => {
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        value.width > pixelTolerance &&
        value.height > pixelTolerance &&
        value.right > pixelTolerance &&
        value.left < window.innerWidth - pixelTolerance
      );
    };

    const violations: BrowserViolation[] = [];
    if (document.documentElement.scrollWidth > window.innerWidth + pixelTolerance) {
      violations.push({
        boundary: viewportRect,
        boundaryDescription: "viewport",
        element: "document.documentElement",
        kind: "document-overflow",
        rect: {
          bottom: document.documentElement.scrollHeight,
          left: 0,
          right: document.documentElement.scrollWidth,
          top: 0,
        },
        route,
        viewport,
      });
    }

    for (const element of document.querySelectorAll(".project-preview__storefront *")) {
      if (!isMeaningful(element) || isExcluded(element) || hasIntendedScroller(element)) continue;
      const value = element.getBoundingClientRect();
      if (!visible(element, value)) continue;

      if (outside(value, viewportRect)) {
        violations.push({
          boundary: viewportRect,
          boundaryDescription: "viewport",
          element: elementDescription(element),
          kind: "outside-viewport",
          rect: rect(value),
          route,
          viewport,
        });
      }

      for (const boundaryElement of clippingBoundaries(element)) {
        const boundary = boundaryElement.getBoundingClientRect();
        const boundaryRect = rect(boundary);
        if (!outside(value, boundaryRect)) continue;
        violations.push({
          boundary: boundaryRect,
          boundaryDescription: elementDescription(boundaryElement),
          element: elementDescription(element),
          kind: "outside-boundary",
          rect: rect(value),
          route,
          viewport,
        });
      }
    }
    return violations;
  }, tolerance);
}

export async function expectNoStorefrontHorizontalClipping(page: Page) {
  const violations = await storefrontGeometryViolations(page);
  expect(
    violations,
    `Meaningful storefront content is clipped:\n${violations.map(formatViolation).join("\n")}`,
  ).toEqual([]);
}
