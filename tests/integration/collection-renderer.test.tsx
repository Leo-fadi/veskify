import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createStorefrontRenderContext, validateRegisteredPage } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";

function setup(locale: "en" | "fi" = "en") {
  const page = structuredClone(
    aurumNordicSeed.draftSnapshot.pages.find((item) => item.type === "collection")!,
  );
  const context = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });
  return { page, context };
}

describe("Aurum Nordic collection renderer", () => {
  it("renders the exact canonical five-section composition in order", () => {
    const { page, context } = setup();
    expect(page.sections.map((section) => section.component)).toEqual([
      "header",
      "collectionHeader",
      "filterBar",
      "productGrid",
      "footer",
    ]);
    const { container } = render(<>{renderStorefrontPage(page, context)}</>);
    expect(Array.from(container.children).map((node) => node.tagName)).toEqual([
      "HEADER",
      "MAIN",
      "FOOTER",
    ]);
    expect(within(container.querySelector("main")!).getAllByRole("region")).toHaveLength(3);
  });

  it("resolves English collection content, navigation, media, products, price and stock", () => {
    const { page, context } = setup();
    render(<>{renderStorefrontPage(page, context)}</>);
    expect(screen.getByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
    expect(screen.getByText("Gold rings for lasting moments.")).toBeVisible();
    expect(screen.getAllByAltText("Aurora yellow-gold diamond ring")).toHaveLength(2);
    expect(screen.getAllByText("Aurora Ring 585").length).toBeGreaterThan(0);
    expect(screen.getByText("Lumi Halo Ring")).toBeVisible();
    expect(screen.getByText(/1\s?290\s?€/)).toBeVisible();
    expect(screen.getByText("Limited availability")).toBeVisible();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("renders Finnish and falls back to the primary locale", () => {
    const { page, context } = setup("fi");
    page.title = { en: "Rings" };
    render(<>{renderStorefrontPage(page, context)}</>);
    expect(screen.getByRole("heading", { level: 1, name: "Sormukset" })).toBeVisible();
    expect(screen.getByText("Kultasormuksia elämän tärkeisiin hetkiin.")).toBeVisible();
    expect(screen.getByText("Malliston sormukset")).toBeVisible();
  });

  it("does not render hidden sections but still validates them", () => {
    const { page, context } = setup();
    page.sections[2].visible = false;
    const { rerender } = render(<>{renderStorefrontPage(page, context)}</>);
    expect(screen.queryByRole("button", { name: "Material" })).not.toBeInTheDocument();
    page.sections[2].content = { filters: ["unknown"] };
    expect(() => validateRegisteredPage(page, context)).toThrow();
    expect(() => rerender(<>{renderStorefrontPage(page, context)}</>)).toThrow();
  });

  it("leaves the homepage and merged product composition unchanged", () => {
    expect(
      aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")?.sections,
    ).toHaveLength(10);
    expect(
      aurumNordicSeed.draftSnapshot.pages
        .find((page) => page.type === "product")
        ?.sections.map((section) => section.component),
    ).toEqual([
      "header",
      "productGallery",
      "productInfo",
      "productOptions",
      "benefitIcons",
      "imageText",
      "relatedProducts",
      "footer",
    ]);
  });

  it("renders reordered global sections exactly once", () => {
    const { page, context } = setup();
    const footer = page.sections.find((section) => section.component === "footer")!;
    page.sections = [footer, ...page.sections.filter((section) => section !== footer)];

    render(<>{renderStorefrontPage(page, context)}</>);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1, name: "Rings" })).toHaveLength(1);
    expect(screen.getAllByRole("region", { name: "Collection controls" })).toHaveLength(1);
  });
});
