import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";

const page = aurumNordicSeed.draftSnapshot.pages.find((item) => item.type === "product")!;
const renderPage = (activeLocale: "en" | "fi") =>
  render(
    <>
      {renderStorefrontPage(
        page,
        createStorefrontRenderContext({
          activeLocale,
          primaryLocale: "en",
          catalogue: aurumNordicSeed.catalogue,
          snapshot: aurumNordicSeed.draftSnapshot,
        }),
      )}
    </>,
  );

describe("Aurum Nordic product composition", () => {
  it("renders all eight sections and catalogue-backed English details", () => {
    const { container } = renderPage("en");
    expect(page.sections.map((section) => section.component)).toEqual([
      "header",
      "productGallery",
      "productInfo",
      "productOptions",
      "benefitIcons",
      "imageText",
      "relatedProducts",
      "footer",
    ]);
    expect(screen.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeInTheDocument();
    expect(screen.getByText("Yellow gold")).toBeInTheDocument();
    expect(screen.getByText("14K")).toBeInTheDocument();
    expect(screen.getByText("Maximum 20 characters")).toBeInTheDocument();
    expect(screen.getByText("Lumi Halo Ring")).toBeInTheDocument();
    expect(Array.from(container.children).map((node) => node.tagName)).toEqual([
      "HEADER",
      "MAIN",
      "FOOTER",
    ]);
    expect(container.querySelector("main")?.children).toHaveLength(6);
  });

  it("renders Finnish product and option labels", () => {
    renderPage("fi");
    expect(
      screen.getByRole("heading", { level: 1, name: "Aurora-sormus 585" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Keltakulta")).toBeInTheDocument();
    expect(screen.getByText("Enintään 20 merkkiä")).toBeInTheDocument();
    expect(screen.getByText("Lumi Halo -sormus")).toBeInTheDocument();
  });
});
