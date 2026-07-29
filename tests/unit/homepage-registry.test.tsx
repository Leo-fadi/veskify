import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createStorefrontRenderContext,
  getComponentDefinition,
  renderRegisteredSection,
  validateRegisteredPage,
  veskifyComponentRegistry,
} from "@/components/registry";
import { StoreFooter, StoreHeader } from "@/components/storefront/homepage-sections";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const context = (locale: "en" | "fi" = "en") =>
  createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });
const expectedTypes = [
  "announcementBar",
  "header",
  "hero",
  "featuredCategories",
  "productGrid",
  "campaignBanner",
  "brandStory",
  "benefitIcons",
  "newsletter",
  "footer",
];

function contentAwareCatalogue(collectionCount: number) {
  const catalogue = structuredClone(aurumNordicSeed.catalogue);
  const source = catalogue.collections[0];
  while (catalogue.collections.length < collectionCount) {
    const index = catalogue.collections.length;
    catalogue.collections.push({
      ...structuredClone(source),
      id: `collection_content_aware_${index}`,
      slug: `content-aware-${index}`,
      title: {
        en: `Content-aware collection ${index}`,
        fi: `Sisältötietoinen mallisto ${index}`,
      },
    });
  }
  return catalogue;
}

describe("P1-01 homepage registry", () => {
  it("registers strict, valid defaults for every initial homepage component", () => {
    expect(Object.keys(veskifyComponentRegistry)).toEqual(expect.arrayContaining(expectedTypes));
    for (const definition of Object.values(veskifyComponentRegistry)) {
      expect(definition.contentSchema.parse(definition.defaultContent)).toEqual(
        definition.defaultContent,
      );
      expect(definition.propsSchema.parse(definition.defaultProps)).toEqual(
        definition.defaultProps,
      );
      expect(() =>
        definition.contentSchema.parse({ ...definition.defaultContent, unsafe: true }),
      ).toThrow();
      expect(definition.variants).toContain(definition.defaultVariant);
    }
  });

  it("rejects unsupported variants and disallowed page placement", () => {
    for (const section of homepage.sections) {
      const definition = getComponentDefinition(section.component);
      expect(() =>
        definition.validate({ ...section, variant: "unsupported" }, "home", context()),
      ).toThrow(/Unsupported/);
    }
    expect(() =>
      getComponentDefinition("header").validate(homepage.sections[1], "content", context()),
    ).toThrow(/not allowed/);
  });

  it("rejects duplicate and unknown catalogue references before rendering", () => {
    const productSection = structuredClone(
      homepage.sections.find((section) => section.component === "productGrid")!,
    );
    productSection.content.productIds = ["product_aurora_ring_585", "product_aurora_ring_585"];
    expect(() =>
      validateRegisteredPage({ ...homepage, sections: [productSection] }, context()),
    ).toThrow(/duplicates/);
    productSection.content.productIds = ["product_missing"];
    expect(() =>
      validateRegisteredPage({ ...homepage, sections: [productSection] }, context()),
    ).toThrow(/Unknown product/);

    const collectionSection = structuredClone(
      homepage.sections.find((section) => section.component === "featuredCategories")!,
    );
    collectionSection.content.collectionIds = ["collection_missing"];
    expect(() =>
      validateRegisteredPage({ ...homepage, sections: [collectionSection] }, context()),
    ).toThrow(/Unknown collection/);
  });

  it("marks catalogue commerce and runtime data as protected", () => {
    expect(getComponentDefinition("productGrid").protectedFields.readOnlyPaths).toEqual(
      expect.arrayContaining([
        "productIds",
        "catalogue.products.*.price",
        "catalogue.products.*.stockStatus",
      ]),
    );
    expect(getComponentDefinition("header").protectedFields.readOnlyPaths).toContain("navigation");
    expect(getComponentDefinition("footer").protectedFields.readOnlyPaths).toContain("navigation");
  });

  it("renders all ten sections in canonical order with catalogue and navigation data", () => {
    const { container } = render(<>{renderStorefrontPage(homepage, context())}</>);
    expect([...container.children].map((element) => element.tagName.toLowerCase())).toEqual([
      "aside",
      "header",
      "main",
      "footer",
    ]);
    expect(container.querySelector("main")?.children).toHaveLength(7);
    expect(screen.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Aurora Ring 585" })).toBeVisible();
    expect(screen.getByText((value) => value.replace(/\s/g, "") === "1290€")).toBeVisible();
    expect(screen.getByText("Limited availability")).toBeVisible();
    expect(
      within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", {
        name: "Rings",
      }),
    ).toHaveAttribute("href", "/collections/rings");
  });

  it("renders Finnish content and shared locale fallback", () => {
    const value = structuredClone(homepage);
    const campaign = value.sections.find((section) => section.component === "campaignBanner")!;
    campaign.content.heading = { en: "Primary fallback campaign" };
    render(<>{renderStorefrontPage(value, context("fi"))}</>);
    expect(screen.getByRole("heading", { name: "Tehty pohjoiseen valoon" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Aurora-sormus 585" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Primary fallback campaign" })).toBeVisible();
  });

  it("keeps the safe root fallback when a snapshot has no home page", () => {
    const snapshotWithoutHome = structuredClone(aurumNordicSeed.draftSnapshot);
    snapshotWithoutHome.pages = snapshotWithoutHome.pages.filter((page) => page.type !== "home");
    const missingHomeContext = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: snapshotWithoutHome,
    });

    expect(missingHomeContext.homePath).toBeUndefined();
    render(
      <>
        <StoreHeader
          brandName="Example"
          context={missingHomeContext}
          showCart={false}
          showSearch={false}
        />
        <StoreFooter
          brandName="Example"
          contact={{ en: "Example" }}
          context={missingHomeContext}
          copyright={{ en: "Example" }}
          policyLabel={{ en: "Example" }}
          showPolicies
        />
      </>,
    );
    for (const brandLink of screen.getAllByRole("link", { name: /^Example$/ })) {
      expect(brandLink).toHaveAttribute("href", "/");
    }
  });

  it("preserves a full accessible merchant brand name in the shared header", () => {
    const longBrand = "Pohjoisen Käsityöläiskorujen Ateljee ja Muotoilustudio";
    render(<StoreHeader brandName={longBrand} context={context()} showCart showSearch />);

    expect(screen.getByRole("link", { name: longBrand })).toHaveAttribute("href", "/");
  });

  it("renders useful catalogue-backed empty states", () => {
    const value = structuredClone(homepage);
    value.sections.find(
      (section) => section.component === "featuredCategories",
    )!.content.collectionIds = [];
    value.sections.find((section) => section.component === "productGrid")!.content.productIds = [];
    render(<>{renderStorefrontPage(value, context())}</>);
    expect(screen.getByText("Collections will appear here when they are available.")).toBeVisible();
    expect(screen.getByText("Products will appear here when they are available.")).toBeVisible();
  });

  it.each([
    [0, undefined],
    [1, "single"],
    [2, "split"],
    [3, "triple"],
    [5, "many"],
  ] as const)(
    "derives the featured-category composition from %i canonical collections",
    (collectionCount, expectedLayout) => {
      const catalogue = contentAwareCatalogue(collectionCount);
      const section = structuredClone(
        homepage.sections.find((item) => item.component === "featuredCategories")!,
      );
      section.content.collectionIds = catalogue.collections
        .slice(0, collectionCount)
        .map((collection) => collection.id);
      const rendered = render(
        <>
          {renderRegisteredSection(
            section,
            createStorefrontRenderContext({
              activeLocale: "en",
              primaryLocale: "en",
              catalogue,
              snapshot: aurumNordicSeed.draftSnapshot,
            }),
            "home",
          )}
        </>,
      );

      if (expectedLayout === undefined) {
        expect(rendered.container.querySelector(".category-grid")).not.toBeInTheDocument();
        expect(
          screen.getByText("Collections will appear here when they are available."),
        ).toBeVisible();
      } else {
        const grid = rendered.container.querySelector(".category-grid");
        expect(grid).toHaveAttribute("data-content-layout", expectedLayout);
        expect(grid).toHaveAttribute("data-item-count", String(collectionCount));
        expect(grid?.children).toHaveLength(collectionCount);
      }
    },
  );

  it.each([
    [1, "single", "1"],
    [2, "split", "2"],
    [3, "triple", "3"],
    [5, "many", "4"],
  ] as const)(
    "caps a four-column product grid at %i canonical products",
    (productCount, expectedLayout, expectedColumns) => {
      const section = structuredClone(
        homepage.sections.find((item) => item.component === "productGrid")!,
      );
      section.content.productIds = aurumNordicSeed.catalogue.products
        .slice(0, productCount)
        .map((product) => product.id);
      section.props.columns = "four";
      const rendered = render(<>{renderRegisteredSection(section, context(), "home")}</>);
      const grid = rendered.container.querySelector(".product-grid");

      expect(grid).toHaveAttribute("data-content-layout", expectedLayout);
      expect(grid).toHaveAttribute("data-item-count", String(productCount));
      expect(grid).toHaveStyle(`--content-item-columns: ${expectedColumns}`);
      expect(grid?.children).toHaveLength(productCount);
    },
  );

  it("keeps long English and Finnish collection copy intact", () => {
    const snapshot = structuredClone(aurumNordicSeed.draftSnapshot);
    const section = snapshot.pages
      .find((page) => page.type === "home")!
      .sections.find((item) => item.component === "featuredCategories")!;
    section.content.heading = {
      en: "A deliberately descriptive collection heading for considered everyday jewellery",
      fi: "Tarkkaan harkittujen jokapäiväisten korujen poikkeuksellisen pitkä mallisto-otsikko",
    };
    const catalogue = structuredClone(aurumNordicSeed.catalogue);
    catalogue.collections[0].description = {
      en: "A long English collection description that remains complete instead of being clipped.",
      fi: "Pitkä suomenkielinen mallistokuvaus säilyy kokonaisena eikä leikkaannu näkymästä.",
    };
    const longCopyContext = (activeLocale: "en" | "fi") =>
      createStorefrontRenderContext({
        activeLocale,
        primaryLocale: "en",
        catalogue,
        snapshot,
      });
    const rendered = render(<>{renderRegisteredSection(section, longCopyContext("en"), "home")}</>);
    expect(
      screen.getByRole("heading", {
        name: "A deliberately descriptive collection heading for considered everyday jewellery",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "A long English collection description that remains complete instead of being clipped.",
      ),
    ).toBeVisible();

    rendered.rerender(<>{renderRegisteredSection(section, longCopyContext("fi"), "home")}</>);
    expect(
      screen.getByRole("heading", {
        name: "Tarkkaan harkittujen jokapäiväisten korujen poikkeuksellisen pitkä mallisto-otsikko",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Pitkä suomenkielinen mallistokuvaus säilyy kokonaisena eikä leikkaannu näkymästä.",
      ),
    ).toBeVisible();
  });

  it("renders local and schema-valid HTTPS catalogue images safely", () => {
    const localRender = render(<>{renderStorefrontPage(homepage, context())}</>);
    expect(screen.getAllByAltText("Aurora yellow-gold diamond ring")[0]).toHaveAttribute(
      "src",
      "/seed-assets/aurora-ring.svg",
    );
    localRender.unmount();

    for (const remoteUrl of [
      "https://media.example.test/aurora-ring.jpg",
      "HTTPS://media.example.test/aurora-ring.jpg",
      "  https://media.example.test/aurora-ring.jpg  ",
    ]) {
      const catalogue = structuredClone(aurumNordicSeed.catalogue);
      catalogue.products[0].images[0].url = remoteUrl;
      const remoteContext = createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: "en",
        catalogue,
        snapshot: aurumNordicSeed.draftSnapshot,
      });
      const remoteRender = render(<>{renderStorefrontPage(homepage, remoteContext)}</>);
      for (const image of screen.getAllByAltText("Aurora yellow-gold diamond ring")) {
        expect(image).toHaveAttribute("src", "https://media.example.test/aurora-ring.jpg");
      }
      remoteRender.unmount();
    }

    const catalogue = structuredClone(aurumNordicSeed.catalogue);
    catalogue.products[0].images[0].url = "http://media.example.test/unsafe.jpg";
    expect(() =>
      createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: "en",
        catalogue,
        snapshot: aurumNordicSeed.draftSnapshot,
      }),
    ).toThrow();
  });

  it("uses unique accessible newsletter IDs for duplicated sections", () => {
    const value = structuredClone(homepage);
    const newsletter = value.sections.find((section) => section.component === "newsletter")!;
    const duplicate = structuredClone(newsletter);
    duplicate.id = "section_home_newsletter_duplicate";
    value.sections.splice(value.sections.indexOf(newsletter) + 1, 0, duplicate);

    const { container } = render(<>{renderStorefrontPage(value, context())}</>);
    const inputs = screen.getAllByLabelText("Email address");
    expect(inputs).toHaveLength(2);
    expect(inputs.map((input) => input.id)).toEqual([
      "section_home_newsletter-email",
      "section_home_newsletter_duplicate-email",
    ]);
    for (const input of inputs) {
      expect(container.querySelector(`label[for="${input.id}"]`)).toBeVisible();
    }
  });

  it("applies portrait and square featured-category card aspects", () => {
    const portrait = structuredClone(homepage);
    const portraitSection = portrait.sections.find(
      (section) => section.component === "featuredCategories",
    )!;
    portraitSection.props.cardAspect = "portrait";
    const { container, rerender } = render(<>{renderStorefrontPage(portrait, context())}</>);
    expect(container.querySelector(".category-grid--portrait")).toBeVisible();
    expect(container.querySelector(".category-grid--square")).not.toBeInTheDocument();

    const square = structuredClone(portrait);
    square.sections.find(
      (section) => section.component === "featuredCategories",
    )!.props.cardAspect = "square";
    rerender(<>{renderStorefrontPage(square, context())}</>);
    expect(container.querySelector(".category-grid--square")).toBeVisible();
    expect(container.querySelector(".category-grid--portrait")).not.toBeInTheDocument();
  });
});
