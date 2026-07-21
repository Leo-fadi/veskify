import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.getByRole("button", { name: "Zoom product image — placeholder" })).toBeVisible();
    expect(
      screen.getAllByText("Draft placeholder — review before publishing").length,
    ).toBeGreaterThan(0);
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
    expect(screen.getByRole("button", { name: "Suurenna tuotekuva — paikkamerkki" })).toBeVisible();
    expect(
      screen.getAllByText("Luonnospaikkamerkki — tarkista ennen julkaisua").length,
    ).toBeGreaterThan(0);
  });

  it.each([
    ["inStock", "In stock"],
    ["lowStock", "Limited availability"],
    ["outOfStock", "Currently unavailable"],
    [undefined, "Availability not provided"],
  ] as const)(
    "renders %s stock consistently in product and related cards",
    (stockStatus, expected) => {
      const catalogue = structuredClone(aurumNordicSeed.catalogue);
      catalogue.products[0].stockStatus = stockStatus;
      const stockPage = structuredClone(page);
      stockPage.sections[6].content.productIds = ["product_aurora_ring_585"];
      render(
        <>
          {renderStorefrontPage(
            stockPage,
            createStorefrontRenderContext({
              activeLocale: "en",
              primaryLocale: "en",
              catalogue,
              snapshot: aurumNordicSeed.draftSnapshot,
            }),
          )}
        </>,
      );
      expect(screen.getAllByText(new RegExp(expected))).toHaveLength(2);
    },
  );

  it("updates the primary gallery image by pointer and keyboard activation", async () => {
    const user = userEvent.setup();
    renderPage("en");
    const first = screen.getByRole("button", { name: /View image 1:/ });
    const second = screen.getByRole("button", { name: /View image 2:/ });
    expect(first).toHaveAttribute("aria-pressed", "true");
    await user.click(second);
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByAltText("Aurora ring side detail")[0]).toHaveClass(/primaryImage/);
    first.focus();
    await user.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Zoom product image — placeholder" })).toBeVisible();
  });

  it.each([
    [1290, /1\s?290\s?€/],
    [1290.5, /1\s?290,50\s?€/],
  ])("preserves the catalogue price %s in product and related presentation", (amount, expected) => {
    const catalogue = structuredClone(aurumNordicSeed.catalogue);
    catalogue.products[0].price!.amount = amount;
    const pricePage = structuredClone(page);
    pricePage.sections[6].content.productIds = ["product_aurora_ring_585"];
    render(
      <>
        {renderStorefrontPage(
          pricePage,
          createStorefrontRenderContext({
            activeLocale: "en",
            primaryLocale: "en",
            catalogue,
            snapshot: aurumNordicSeed.draftSnapshot,
          }),
        )}
      </>,
    );
    expect(screen.getAllByText(expected)).toHaveLength(2);
  });

  it("renders optional and required text options from canonical option metadata", () => {
    const optional = renderPage("en");
    const optionalInput = screen.getByLabelText(/Engraving \(optional\)/);
    expect(optionalInput).not.toBeRequired();
    expect(optionalInput).toHaveAttribute("maxlength", "20");
    optional.unmount();

    const catalogue = structuredClone(aurumNordicSeed.catalogue);
    const engraving = catalogue.products[0].orderOptions?.find(
      (option) => option.id === "option_aurora_engraving",
    );
    if (!engraving) throw new Error("Expected engraving option fixture.");
    engraving.required = true;
    render(
      <>
        {renderStorefrontPage(
          page,
          createStorefrontRenderContext({
            activeLocale: "en",
            primaryLocale: "en",
            catalogue,
            snapshot: aurumNordicSeed.draftSnapshot,
          }),
        )}
      </>,
    );
    const requiredInput = screen.getByLabelText(/Engraving \(required\)/);
    expect(requiredInput).toBeRequired();
    expect(requiredInput).toHaveAttribute("maxlength", "20");
    expect(screen.queryByLabelText(/Engraving \(optional\)/)).not.toBeInTheDocument();
  });

  it("uses the shared safe image boundary for local and normalized HTTPS product media", () => {
    const catalogue = structuredClone(aurumNordicSeed.catalogue);
    catalogue.products[0].images = [
      {
        id: "asset_remote_product",
        url: "  HTTPS://media.example.test/aurora.jpg  ",
        alt: { en: "Remote Aurora ring", fi: "Aurora-sormus verkossa" },
        decorative: false,
      },
    ];
    const remotePage = structuredClone(page);
    remotePage.sections[6].content.productIds = ["product_aurora_ring_585"];
    render(
      <>
        {renderStorefrontPage(
          remotePage,
          createStorefrontRenderContext({
            activeLocale: "en",
            primaryLocale: "en",
            catalogue,
            snapshot: aurumNordicSeed.draftSnapshot,
          }),
        )}
      </>,
    );
    const gallery = screen.getByRole("region", { name: "Product gallery" });
    const remoteImages = within(gallery).getAllByAltText("Remote Aurora ring");
    expect(remoteImages).toHaveLength(2);
    expect(remoteImages[0]).toHaveAttribute("src", "https://media.example.test/aurora.jpg");
    expect(remoteImages[0]).not.toHaveAttribute("data-nimg");
    expect(screen.getAllByAltText("Remote Aurora ring")).toHaveLength(3);
  });

  it("renders one image safely and rejects zero or unsafe product images", () => {
    const oneImage = structuredClone(aurumNordicSeed.catalogue);
    oneImage.products[0].images = [oneImage.products[0].images[0]];
    const view = render(
      <>
        {renderStorefrontPage(
          page,
          createStorefrontRenderContext({
            activeLocale: "en",
            primaryLocale: "en",
            catalogue: oneImage,
            snapshot: aurumNordicSeed.draftSnapshot,
          }),
        )}
      </>,
    );
    expect(screen.getAllByRole("button", { name: /View image/ })).toHaveLength(1);
    view.unmount();

    for (const url of ["http://media.example.test/ring.jpg", "javascript:alert(1)", "not a url"]) {
      const invalid = structuredClone(aurumNordicSeed.catalogue);
      invalid.products[0].images[0].url = url;
      expect(() =>
        createStorefrontRenderContext({
          activeLocale: "en",
          primaryLocale: "en",
          catalogue: invalid,
          snapshot: aurumNordicSeed.draftSnapshot,
        }),
      ).toThrow();
    }
    const empty = structuredClone(aurumNordicSeed.catalogue);
    empty.products[0].images = [];
    expect(() =>
      createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: "en",
        catalogue: empty,
        snapshot: aurumNordicSeed.draftSnapshot,
      }),
    ).toThrow();
  });
});
