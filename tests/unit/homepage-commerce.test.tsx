import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  homepageCommerceDefinitions,
  homepageHeroDefinition,
  homepagePromotionDefinition,
  homepageTrustDefinition,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import {
  homepageCommerceComponentByTarget,
  renderHomepageCommerce,
  type HomepageCommerceRendererInput,
} from "@/components/storefront/homepage-commerce";
import type {
  CollectionPresentationContext,
  ComponentInstanceV2,
  ComponentProjectionContext,
  ProductPresentationContext,
  StorefrontAssetMetadata,
} from "@/domain/component-platform";
import { createResponsiveImageAuthority } from "@/domain/asset-presentation";
import { canonicalValueFingerprint } from "@/domain/storefront";

type JsonFixture = ComponentInstanceV2["content"][string];

function jsonFixture<Value extends JsonFixture>(value: Value): Value {
  return value;
}

const localized = (en: string, fi = en) => ({ en, fi });

const watch: ProductPresentationContext = {
  productId: "product_watch",
  productTypeId: "watch",
  sku: "WATCH-001",
  title: localized("Nordic watch", "Pohjoismainen kello"),
  description: localized("A compact everyday watch.", "Kompakti arkikello."),
  price: { amount: 349, currency: "EUR", formatted: localized("€349", "349 €") },
  compareAtPrice: { amount: 399, currency: "EUR", formatted: localized("€399", "399 €") },
  availability: localized("In stock", "Varastossa"),
  media: [
    { assetId: "asset_watch", role: "main", alt: localized("Silver watch", "Hopeinen kello") },
  ],
  attributeGroups: [],
  optionGroups: [],
  selectedValues: [],
  unavailableCombinations: [],
  relatedProductIds: [],
  revision: "product-rev-watch",
};

const ring: ProductPresentationContext = {
  productId: "product_ring",
  productTypeId: "ring",
  sku: "RING-001",
  title: localized("Aurora ring", "Aurora-sormus"),
  priceUnavailableReason: localized("Price on request", "Hinta pyydettäessä"),
  availability: localized("Made to order", "Valmistetaan tilauksesta"),
  media: [],
  attributeGroups: [],
  optionGroups: [],
  selectedValues: [],
  unavailableCombinations: [],
  relatedProductIds: [],
  revision: "product-rev-ring",
};

const rings: CollectionPresentationContext = {
  collectionId: "collection_rings",
  title: localized("Rings", "Sormukset"),
  description: localized("Rings for every day.", "Sormuksia jokaiseen päivään."),
  assets: [{ assetId: "asset_rings", role: "card" }],
  productIds: [ring.productId],
  filters: [],
  sorting: [],
  emptyState: { title: localized("No rings", "Ei sormuksia") },
  revision: "collection-rev-rings",
};

const watches: CollectionPresentationContext = {
  collectionId: "collection_watches",
  title: localized("Watches", "Kellot"),
  description: localized("Mechanical watches.", "Mekaanisia kelloja."),
  assets: [],
  productIds: [watch.productId],
  filters: [],
  sorting: [],
  emptyState: { title: localized("No watches", "Ei kelloja") },
  revision: "collection-rev-watches",
};

function asset(
  assetId: string,
  role: StorefrontAssetMetadata["role"],
  approvalStatus: StorefrontAssetMetadata["approvalStatus"] = "approved",
  provenanceKind: StorefrontAssetMetadata["provenance"]["kind"] = "merchantProvided",
): StorefrontAssetMetadata {
  const sourceOwnerId = `product_${assetId.split("_")[1] ?? "unknown"}`;
  const canonicalRole =
    role === "productMainImage" || role === "productAlternativeImage" ? role : undefined;
  const revision = `revision_${assetId}`;
  const source =
    canonicalRole && provenanceKind === "canonicalProductMedia"
      ? {
          assetId,
          role: canonicalRole,
          revision,
          materialFingerprint: `fixture-${canonicalValueFingerprint({ assetId, sourceOwnerId, role })}`,
          provenanceKind: "canonicalProductMedia" as const,
          sourceOwnerId,
        }
      : undefined;
  return {
    assetId,
    role,
    alt: localized(`${assetId} alt`, `${assetId} vaihtoehtoinen teksti`),
    decorative: false,
    provenance: { kind: provenanceKind, sourceId: sourceOwnerId },
    approvalStatus,
    usageRights: "merchantOwned",
    responsiveCrops: [],
    revision,
    ...(source
      ? {
          artDirection: createResponsiveImageAuthority({
            contractVersion: "1.0.0",
            source,
            placement: {
              componentType: "homepageFeaturedProducts",
              componentVersion: "2.0.0",
              variant: "standard",
              anatomyContractVersion: "1.0.0",
              anatomyIdentity: "homepageFeaturedProducts.anatomy",
              anatomyVersion: "1.0.0",
              anatomyRegion: "media",
              assetSlotId: "productMedia",
              required: false,
            },
            sourceTreatment: {
              ratio: "natural",
              crop: { mode: "contain" },
              focalPoint: { x: 0.5, y: 0.5 },
              overlay: "none",
            },
            responsiveTreatments: [],
            derivatives: [],
          }),
        }
      : {}),
  };
}

const projection: ComponentProjectionContext = {
  products: [watch, ring],
  collections: [rings, watches],
  assets: [
    asset("asset_hero", "heroDesktop"),
    asset("asset_promotion", "editorialImage"),
    asset("asset_rings", "collectionImage"),
    asset("asset_watch", "productMainImage", "approved", "canonicalProductMedia"),
  ],
  navigation: [
    { navigationId: "navigation_shop", revision: "navigation-rev-shop" },
    { navigationId: "navigation_support", revision: "navigation-rev-support" },
  ],
  projectBrandContexts: [
    {
      projectId: "project_home",
      brandSystemRefs: ["brand_home"],
      revision: "brand-rev-home",
    },
  ],
  localizedContents: [],
  productListRevision: "product-list-rev-home",
  collectionListRevision: "collection-list-rev-home",
};

const presentationBinding = {
  slotId: "presentationContext",
  source: "projectBrandContext" as const,
  projectId: "project_home",
  brandSystemRef: "brand_home",
  revision: "brand-rev-home",
};

function instance(
  component: string,
  variant: string,
  content: ComponentInstanceV2["content"],
  props: ComponentInstanceV2["props"],
  bindings: ComponentInstanceV2["bindings"] = [],
  styleOverrides: ComponentInstanceV2["styleOverrides"] = { surface: "plain" },
): ComponentInstanceV2 {
  return {
    id: `section_${component.replaceAll(/([A-Z])/g, "_$1").toLowerCase()}`,
    component,
    componentVersion: { major: 2, minor: 0, patch: 0 },
    variant,
    content,
    props,
    styleOverrides,
    bindings: [presentationBinding, ...bindings],
    assetAssignments: [],
  };
}

function heroInstance(withMedia = true): ComponentInstanceV2 {
  const value = instance(
    "homepageHero",
    "editorialSplit",
    {
      heading: localized("Designed for everyday", "Suunniteltu arkeen"),
      supportingCopy: localized("Canonical commerce, considered presentation."),
      primaryActionLabel: localized("Shop now", "Osta nyt"),
    },
    { mediaPosition: "right", imagePresentation: "cover", textAlignment: "left" },
    [
      {
        slotId: "primaryAction",
        source: "navigation",
        navigationId: "navigation_shop",
        revision: "navigation-rev-shop",
      },
      ...(withMedia
        ? [
            {
              slotId: "heroAsset",
              source: "asset" as const,
              assetId: "asset_hero",
              role: "heroDesktop" as const,
              revision: "revision_asset_hero",
            },
          ]
        : []),
    ],
  );
  if (withMedia) {
    value.assetAssignments = [{ slotId: "heroMedia", assetId: "asset_hero", role: "heroDesktop" }];
  }
  return value;
}

function featuredCollectionsInstance(): ComponentInstanceV2 {
  return instance(
    "homepageFeaturedCollections",
    "standard",
    {
      heading: localized("Shop collections", "Selaa mallistoja"),
      supportingCopy: localized("Canonical groups, in a deliberate order."),
      mediaPlaceholderLabel: localized("Collection image unavailable", "Malliston kuva puuttuu"),
    },
    { layout: "grid", cardPresentation: "image", columns: 2, showDescriptions: true },
    [
      {
        slotId: "collections",
        source: "collectionList",
        collectionIds: [watches.collectionId, rings.collectionId],
        revision: "collection-list-rev-home",
      },
    ],
  );
}

function featuredProductsInstance(): ComponentInstanceV2 {
  return instance(
    "homepageFeaturedProducts",
    "standard",
    {
      heading: localized("Featured products", "Nostetut tuotteet"),
      supportingCopy: localized("Selected from Vesko."),
      mediaPlaceholderLabel: localized("Product image unavailable", "Tuotekuva puuttuu"),
      emptyStateMessage: localized("No featured products", "Ei nostettuja tuotteita"),
    },
    { layout: "grid", cardVariant: "standard", columns: 2 },
    [
      {
        slotId: "products",
        source: "productList",
        productIds: [watch.productId, ring.productId],
        revision: "product-list-rev-home",
      },
    ],
  );
}

function promotionInstance(withAction = true): ComponentInstanceV2 {
  const value = instance(
    "homepagePromotion",
    "split",
    {
      heading: localized("A considered edit", "Harkittu kokonaisuus"),
      description: localized("Explore the current collection.", "Tutustu nykyiseen mallistoon."),
      ...(withAction ? { actionLabel: localized("Explore", "Tutustu") } : {}),
    },
    { mediaPosition: "background", actionPresentation: "primary", textAlignment: "left" },
    [
      {
        slotId: "promotionAsset",
        source: "asset",
        assetId: "asset_promotion",
        role: "editorialImage",
        revision: "revision_asset_promotion",
      },
      ...(withAction
        ? [
            {
              slotId: "promotionAction",
              source: "navigation" as const,
              navigationId: "navigation_shop",
              revision: "navigation-rev-shop",
            },
          ]
        : []),
    ],
  );
  value.assetAssignments = [
    { slotId: "promotionMedia", assetId: "asset_promotion", role: "editorialImage" },
  ];
  return value;
}

function trustInstance(): ComponentInstanceV2 {
  return instance(
    "homepageTrust",
    "cards",
    {
      heading: localized("Here to help", "Autamme mielellämme"),
      items: [
        {
          id: "trust_delivery",
          kind: "delivery",
          title: localized("Delivery", "Toimitus"),
          description: localized("Review delivery details.", "Tarkista toimitustiedot."),
        },
      ],
    },
    { columns: 3, textAlignment: "left" },
  );
}

function rendererInput(
  value: ComponentInstanceV2,
  overrides: Partial<HomepageCommerceRendererInput> = {},
): HomepageCommerceRendererInput {
  return {
    target: "preview",
    instance: value,
    projection,
    activeLocale: "en",
    primaryLocale: "en",
    resolveAssetUrl: (assetId) => `/seed-assets/${assetId}.svg`,
    onNavigate: vi.fn(),
    ...overrides,
  };
}

describe("P6-05 dynamic homepage commerce component family", () => {
  it("renders approved hero media, localized content and provenance", () => {
    render(renderHomepageCommerce(rendererInput(heroInstance())));
    expect(screen.getByRole("heading", { level: 1, name: "Designed for everyday" })).toBeVisible();
    expect(screen.getByRole("img", { name: "asset_hero alt" })).toBeVisible();
    expect(document.querySelector("figure[data-asset-id='asset_hero']")).toHaveAttribute(
      "data-asset-provenance",
      "merchantProvided",
    );
  });

  it("renders the hero safely when optional media is omitted", () => {
    const hero = heroInstance(false);
    hero.variant = "fullBleedOverlay";
    hero.props = { ...hero.props, mediaPosition: "background" };
    const rendered = render(renderHomepageCommerce(rendererInput(hero)));
    expect(screen.getByRole("heading", { name: "Designed for everyday" })).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
    expect(rendered.container.querySelector("[data-media-state='omitted']")).toHaveAttribute(
      "data-copy-treatment",
      "default",
    );
  });

  it("emits one typed approved hero navigation intent from keyboard activation", async () => {
    const onNavigate = vi.fn();
    render(renderHomepageCommerce(rendererInput(heroInstance(), { onNavigate })));
    const action = screen.getByRole("button", { name: "Shop now" });
    action.focus();
    await userEvent.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith({
      type: "navigateToApprovedAction",
      navigationId: "navigation_shop",
    });
  });

  it("renders featured collections only in canonical collection-list binding order", () => {
    const rendered = render(renderHomepageCommerce(rendererInput(featuredCollectionsInstance())));
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual(["Watches", "Rings"]);
    expect(screen.queryByText("Unknown collection")).toBeNull();
    expect(rendered.container.querySelector("[data-item-count]")).toHaveAttribute(
      "data-item-count",
      "2",
    );
    expect(rendered.container.querySelector("[data-item-count]")).toHaveStyle(
      "--homepage-columns: 2",
    );
    expect(rendered.container.querySelector("[data-item-count]")).toHaveAttribute(
      "data-column-count",
      "2",
    );
  });

  it("derives single-card media treatment and tablet collection capacity from rendered content", () => {
    const bindCollections = (value: ComponentInstanceV2, collectionIds: string[]) => {
      value.bindings = value.bindings.map((binding) =>
        binding.slotId === "collections" && binding.source === "collectionList"
          ? { ...binding, collectionIds }
          : binding,
      );
    };

    const textOnly = featuredCollectionsInstance();
    textOnly.props = { ...textOnly.props, cardPresentation: "text", columns: 4 };
    bindCollections(textOnly, [rings.collectionId]);
    const textOnlyRendered = render(renderHomepageCommerce(rendererInput(textOnly)));
    const textOnlyGrid = textOnlyRendered.container.querySelector("[data-item-count]");
    expect(textOnlyGrid).toHaveAttribute("data-item-count", "1");
    expect(textOnlyGrid).toHaveAttribute("data-column-count", "1");
    expect(textOnlyGrid?.querySelector("article")).toHaveAttribute("data-has-media", "false");
    expect(textOnlyGrid?.querySelector("figure, .placeholder")).toBeNull();
    textOnlyRendered.unmount();

    const image = featuredCollectionsInstance();
    image.props = { ...image.props, cardPresentation: "image", columns: 4 };
    bindCollections(image, [rings.collectionId]);
    const imageRendered = render(renderHomepageCommerce(rendererInput(image)));
    const imageGrid = imageRendered.container.querySelector("[data-item-count]");
    expect(imageGrid).toHaveAttribute("data-item-count", "1");
    expect(imageGrid).toHaveAttribute("data-column-count", "1");
    expect(imageGrid?.querySelector("article")).toHaveAttribute("data-has-media", "true");
    expect(imageGrid?.querySelector("figure")).toBeVisible();
    imageRendered.unmount();

    const thirdCollection = {
      ...rings,
      collectionId: "collection_bracelets",
      revision: "collection-rev-bracelets",
      title: localized("Bracelets", "Rannekorut"),
    };
    const fourthCollection = {
      ...rings,
      collectionId: "collection_necklaces",
      revision: "collection-rev-necklaces",
      title: localized("Necklaces", "Kaulakorut"),
    };
    const countAwareProjection = {
      ...projection,
      collections: [...projection.collections, thirdCollection, fourthCollection],
    };
    const three = featuredCollectionsInstance();
    three.props = { ...three.props, columns: 4 };
    bindCollections(three, [
      watches.collectionId,
      rings.collectionId,
      thirdCollection.collectionId,
    ]);
    const threeRendered = render(
      renderHomepageCommerce(rendererInput(three, { projection: countAwareProjection })),
    );
    expect(threeRendered.container.querySelector("[data-item-count]")).toHaveAttribute(
      "data-column-count",
      "3",
    );
    threeRendered.unmount();

    const many = featuredCollectionsInstance();
    many.props = { ...many.props, columns: 4 };
    bindCollections(many, [
      watches.collectionId,
      rings.collectionId,
      thirdCollection.collectionId,
      fourthCollection.collectionId,
    ]);
    const manyRendered = render(
      renderHomepageCommerce(rendererInput(many, { projection: countAwareProjection })),
    );
    expect(manyRendered.container.querySelector("[data-item-count]")).toHaveAttribute(
      "data-column-count",
      "4",
    );

    const css = readFileSync("src/components/storefront/homepage-commerce.module.css", "utf8");
    expect(css).toContain(
      '.collectionGrid[data-item-count="1"] .collectionCard[data-has-media="true"]',
    );
    expect(css).toContain('.collectionGrid[data-item-count="3"][data-column-count="3"]');
  });

  it("renders reusable product cards only from canonical product-list bindings", () => {
    const value = featuredProductsInstance();
    value.props = { ...value.props, columns: 4 };
    const rendered = render(renderHomepageCommerce(rendererInput(value)));
    expect(screen.getByRole("button", { name: "Nordic watch" })).toBeVisible();
    expect(screen.getByText("€349")).toBeVisible();
    expect(screen.getByText("€399")).toBeVisible();
    expect(screen.getByText("In stock")).toBeVisible();
    expect(screen.getByRole("button", { name: "Aurora ring" })).toBeVisible();
    expect(screen.getByText("Price on request")).toBeVisible();
    expect(document.querySelector("[data-asset-id='asset_watch']")).toHaveAttribute(
      "data-asset-provenance",
      "canonicalProductMedia",
    );
    expect(rendered.container.querySelector("[data-item-count]")).toHaveAttribute(
      "data-item-count",
      "2",
    );
    expect(rendered.container.querySelector("[data-item-count]")).toHaveStyle(
      "--homepage-columns: 2",
    );
  });

  it("accepts complete explicit product media belonging to bound products", () => {
    const value = featuredProductsInstance();
    value.assetAssignments = [
      { slotId: "productMedia", assetId: "asset_watch", role: "productMainImage" },
    ];
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(value, projection),
    ).not.toThrow();
    render(renderHomepageCommerce(rendererInput(value)));
    expect(document.querySelector("[data-asset-id='asset_watch']")).toBeVisible();
  });

  it("rejects stale, unrelated and unbound-product media assignments before rendering", () => {
    const stale = featuredProductsInstance();
    stale.assetAssignments = [
      { slotId: "productMedia", assetId: "asset_stale", role: "productMainImage" },
    ];
    const staleProjection = {
      ...projection,
      assets: [
        ...projection.assets,
        asset("asset_stale", "productMainImage", "approved", "canonicalProductMedia"),
      ],
    };
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(stale, staleProjection),
    ).toThrow(/does not belong to a product in the bound product list/i);

    const unboundProduct = {
      ...structuredClone(watch),
      productId: "product_unbound",
      sku: "UNBOUND-001",
      media: [{ assetId: "asset_unbound", role: "main" as const, alt: localized("Unbound") }],
      revision: "product-rev-unbound",
    };
    const unbound = featuredProductsInstance();
    unbound.assetAssignments = [
      { slotId: "productMedia", assetId: "asset_unbound", role: "productMainImage" },
    ];
    const unboundProjection = {
      ...projection,
      products: [...projection.products, unboundProduct],
      assets: [
        ...projection.assets,
        asset("asset_unbound", "productMainImage", "approved", "canonicalProductMedia"),
      ],
    };
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(unbound, unboundProjection),
    ).toThrow(/does not belong to a product in the bound product list/i);
  });

  it("does not let unrelated approved media suppress canonical fallback media", () => {
    const invalid = featuredProductsInstance();
    invalid.assetAssignments = [
      { slotId: "productMedia", assetId: "asset_hero", role: "heroDesktop" },
    ];
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(invalid, projection),
    ).toThrow(/does not accept|does not belong/i);

    render(renderHomepageCommerce(rendererInput(featuredProductsInstance())));
    expect(document.querySelector("[data-asset-id='asset_watch']")).toBeVisible();
  });

  it("rejects incomplete, non-canonical-provenance and non-deterministic product assignments", () => {
    const alternateProduct = structuredClone(watch);
    alternateProduct.media = [
      ...alternateProduct.media,
      {
        assetId: "asset_watch_alternative",
        role: "alternative",
        alt: localized("Alternative watch"),
      },
    ];
    const extendedProjection = {
      ...projection,
      products: [alternateProduct, ring],
      assets: [
        ...projection.assets,
        asset(
          "asset_watch_alternative",
          "productAlternativeImage",
          "approved",
          "canonicalProductMedia",
        ),
      ],
    };
    const alternate = featuredProductsInstance();
    alternate.assetAssignments = [
      {
        slotId: "productMedia",
        assetId: "asset_watch_alternative",
        role: "productAlternativeImage",
      },
    ];
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(alternate, extendedProjection),
    ).toThrow(/not the deterministic first compatible media/i);

    const wrongProvenance = featuredProductsInstance();
    wrongProvenance.assetAssignments = [
      { slotId: "productMedia", assetId: "asset_watch", role: "productMainImage" },
    ];
    const merchantMediaProjection = {
      ...projection,
      assets: projection.assets.map((item) =>
        item.assetId === "asset_watch"
          ? { ...item, provenance: { kind: "merchantProvided" as const, sourceId: "source_watch" } }
          : item,
      ),
    };
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(
        wrongProvenance,
        merchantMediaProjection,
      ),
    ).toThrow(/canonical product-media provenance/i);

    const ringWithMedia = structuredClone(ring);
    ringWithMedia.media = [
      { assetId: "asset_ring", role: "main", alt: localized("Canonical ring") },
    ];
    const incompleteProjection = {
      ...projection,
      products: [watch, ringWithMedia],
      assets: [
        ...projection.assets,
        asset("asset_ring", "productMainImage", "approved", "canonicalProductMedia"),
      ],
    };
    const incomplete = featuredProductsInstance();
    incomplete.assetAssignments = [
      { slotId: "productMedia", assetId: "asset_watch", role: "productMainImage" },
    ];
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(incomplete, incompleteProjection),
    ).toThrow(/Missing canonical homepage product-media assignment: asset_ring/i);
  });

  it("rejects copied product price, availability and membership in editable content", () => {
    for (const protectedField of [
      "price",
      "availability",
      "productIds",
      "collectionIds",
    ] as const) {
      const value = featuredProductsInstance();
      value.content = {
        ...value.content,
        [protectedField]: protectedField === "price" ? "€1" : [],
      };
      expect(() => veskifyComponentRegistryV2.validateInstance(value)).toThrow(
        /Invalid component content/i,
      );
    }
  });

  it("rejects unknown product and collection binding targets during projection conformance", () => {
    const unknownProduct = featuredProductsInstance();
    unknownProduct.bindings = unknownProduct.bindings.map((binding) =>
      binding.slotId === "products" && binding.source === "productList"
        ? { ...binding, productIds: ["product_unknown"] }
        : binding,
    );
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(unknownProduct, projection),
    ).toThrow(/Unknown product list binding target/i);

    const unknownCollection = featuredCollectionsInstance();
    unknownCollection.bindings = unknownCollection.bindings.map((binding) =>
      binding.slotId === "collections" && binding.source === "collectionList"
        ? { ...binding, collectionIds: ["collection_unknown"] }
        : binding,
    );
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(unknownCollection, projection),
    ).toThrow(/Unknown collection list binding target/i);
  });

  it("rejects missing or wrong-source product-list bindings safely", () => {
    const missing = featuredProductsInstance();
    missing.bindings = missing.bindings.filter((binding) => binding.slotId !== "products");
    expect(() => veskifyComponentRegistryV2.validateInstance(missing)).toThrow(
      /Missing required commerce binding slot: products/i,
    );

    const wrongSource = featuredProductsInstance();
    wrongSource.bindings = wrongSource.bindings.map((binding) =>
      binding.slotId === "products"
        ? {
            slotId: "products",
            source: "collectionList" as const,
            collectionIds: [rings.collectionId],
            revision: "collection-list-rev-home",
          }
        : binding,
    );
    expect(() => veskifyComponentRegistryV2.validateInstance(wrongSource)).toThrow(
      /Binding slot products does not accept collectionList/i,
    );
  });

  it("rejects unknown, rejected and pending explicit hero assets", () => {
    const unknown = heroInstance();
    unknown.bindings = unknown.bindings.map((binding) =>
      binding.slotId === "heroAsset" && binding.source === "asset"
        ? { ...binding, assetId: "asset_unknown" }
        : binding,
    );
    unknown.assetAssignments = [
      { slotId: "heroMedia", assetId: "asset_unknown", role: "heroDesktop" },
    ];
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(unknown, projection),
    ).toThrow(/missing from inventory|Unknown asset binding target/i);

    for (const approvalStatus of ["rejected", "pending"] as const) {
      const altered = {
        ...projection,
        assets: projection.assets.map((item) =>
          item.assetId === "asset_hero" ? { ...item, approvalStatus } : item,
        ),
      };
      expect(() =>
        veskifyComponentRegistryV2.validateInstanceConformance(heroInstance(), altered),
      ).toThrow(/not approved/i);
    }
  });

  it("uses safe collection and product placeholders when optional media is unavailable", () => {
    const noMediaProjection = { ...projection, assets: projection.assets.slice(0, 2) };
    const { rerender } = render(
      renderHomepageCommerce(
        rendererInput(featuredCollectionsInstance(), { projection: noMediaProjection }),
      ),
    );
    expect(screen.getAllByText("Collection image unavailable")).toHaveLength(2);

    rerender(
      renderHomepageCommerce(
        rendererInput(featuredProductsInstance(), { projection: noMediaProjection }),
      ),
    );
    expect(screen.getAllByText("Product image unavailable")).toHaveLength(2);
  });

  it("emits category navigation only for the canonical bound collection", () => {
    const onNavigate = vi.fn();
    const value = instance(
      "homepageCollectionNavigation",
      "standard",
      {
        heading: localized("Browse"),
        mediaPlaceholderLabel: localized("No collection image"),
      },
      { presentation: "compact", columns: 2 },
      [
        {
          slotId: "collections",
          source: "collectionList",
          collectionIds: [rings.collectionId],
          revision: "collection-list-rev-home",
        },
      ],
    );
    render(renderHomepageCommerce(rendererInput(value, { onNavigate })));
    fireEvent.click(screen.getByRole("button", { name: "Rings" }));
    expect(onNavigate).toHaveBeenCalledWith({
      type: "navigateToCollection",
      collectionId: "collection_rings",
      collectionRevision: "collection-rev-rings",
    });
  });

  it("keeps promotional and trust content presentation-only", () => {
    expect(homepagePromotionDefinition.protectedFields.readOnlyPaths).toContain(
      "commerce.product.price",
    );
    expect(
      homepageTrustDefinition.commerceBindingSlots.map((slot) => slot.acceptedSourceTypes),
    ).not.toContainEqual(
      expect.arrayContaining(["product", "productList", "collection", "collectionList"]),
    );
    const promotion = instance(
      "homepagePromotion",
      "minimal",
      { heading: localized("Studio visit"), description: localized("Meet our team.") },
      { mediaPosition: "right", actionPresentation: "text", textAlignment: "left" },
    );
    promotion.content = { ...promotion.content, sku: "FORBIDDEN" };
    expect(() => veskifyComponentRegistryV2.validateInstance(promotion)).toThrow(
      /Invalid component content/i,
    );
  });

  it("renders structured trust copy in EN and FI without operational controls", () => {
    const trust = trustInstance();
    const { rerender } = render(renderHomepageCommerce(rendererInput(trust)));
    expect(screen.getByRole("heading", { name: "Here to help" })).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(
      renderHomepageCommerce(rendererInput(trust, { activeLocale: "fi", primaryLocale: "en" })),
    );
    expect(screen.getByRole("heading", { name: "Autamme mielellämme" })).toBeVisible();
    expect(screen.getByText("Tarkista toimitustiedot.")).toBeVisible();
  });

  it("retains trust-item uniqueness in registered instance validation", () => {
    const unique = trustInstance();
    expect(() => veskifyComponentRegistryV2.validateInstance(unique)).not.toThrow();

    const duplicate = trustInstance();
    duplicate.content = {
      ...duplicate.content,
      items: jsonFixture([
        {
          id: "trust_delivery",
          kind: "delivery",
          title: localized("Delivery"),
          description: localized("Review delivery details."),
        },
        {
          id: "trust_delivery",
          kind: "returns",
          title: localized("Returns"),
          description: localized("Review returns details."),
        },
      ]),
    };
    expect(() => veskifyComponentRegistryV2.validateInstance(duplicate)).toThrow(
      /Trust item IDs must be unique/i,
    );
  });

  it("retains localized-content refinements in registered instance validation", () => {
    const invalidHeadings: JsonFixture[] = [
      jsonFixture({}),
      jsonFixture({ en: "   " }),
      jsonFixture({ en: "English", sv: "Svenska" }),
    ];
    for (const invalidHeading of invalidHeadings) {
      const invalid = heroInstance();
      invalid.content = { ...invalid.content, heading: invalidHeading };
      expect(() => veskifyComponentRegistryV2.validateInstance(invalid)).toThrow(
        /Invalid component content/i,
      );
    }

    const validHeadings: JsonFixture[] = [
      jsonFixture({ en: "English" }),
      jsonFixture({ fi: "Suomi" }),
      jsonFixture(localized("English", "Suomi")),
    ];
    for (const heading of validHeadings) {
      const valid = heroInstance();
      valid.content = { ...valid.content, heading };
      expect(() => veskifyComponentRegistryV2.validateInstance(valid)).not.toThrow();
    }
  });

  it("validates every homepage localized field before rendering", () => {
    const invalidValues = [
      {
        value: heroInstance(),
        mutate: (value: ComponentInstanceV2) => {
          value.content = { ...value.content, supportingCopy: {} };
        },
      },
      {
        value: heroInstance(),
        mutate: (value: ComponentInstanceV2) => {
          value.content = { ...value.content, primaryActionLabel: { fi: "   " } };
        },
      },
      {
        value: featuredCollectionsInstance(),
        mutate: (value: ComponentInstanceV2) => {
          value.content = { ...value.content, heading: {} };
        },
      },
      {
        value: featuredProductsInstance(),
        mutate: (value: ComponentInstanceV2) => {
          value.content = { ...value.content, mediaPlaceholderLabel: {} };
        },
      },
      {
        value: featuredProductsInstance(),
        mutate: (value: ComponentInstanceV2) => {
          value.content = { ...value.content, emptyStateMessage: { en: "   " } };
        },
      },
      {
        value: instance(
          "homepageCollectionNavigation",
          "standard",
          {
            heading: localized("Browse"),
            mediaPlaceholderLabel: localized("No collection image"),
          },
          { presentation: "compact", columns: 2 },
          [
            {
              slotId: "collections",
              source: "collectionList",
              collectionIds: [rings.collectionId],
              revision: "collection-list-rev-home",
            },
          ],
        ),
        mutate: (value: ComponentInstanceV2) => {
          value.content = { ...value.content, mediaPlaceholderLabel: {} };
        },
      },
      {
        value: promotionInstance(),
        mutate: (value: ComponentInstanceV2) => {
          value.content = { ...value.content, description: { fi: "   " } };
        },
      },
      {
        value: trustInstance(),
        mutate: (value: ComponentInstanceV2) => {
          value.content = {
            ...value.content,
            items: jsonFixture([
              {
                id: "trust_delivery",
                kind: "delivery",
                title: {},
                description: localized("Review delivery details."),
              },
            ]),
          };
        },
      },
      {
        value: trustInstance(),
        mutate: (value: ComponentInstanceV2) => {
          value.content = {
            ...value.content,
            items: jsonFixture([
              {
                id: "trust_delivery",
                kind: "delivery",
                title: localized("Delivery"),
                description: { en: "   " },
              },
            ]),
          };
        },
      },
    ];
    for (const candidate of invalidValues) {
      candidate.mutate(candidate.value);
      expect(() => veskifyComponentRegistryV2.validateInstance(candidate.value)).toThrow(
        /Invalid component content/i,
      );
    }
  });

  it("rejects unpaired action labels and navigation bindings before render", () => {
    const labelWithoutBinding = heroInstance();
    labelWithoutBinding.bindings = labelWithoutBinding.bindings.filter(
      (binding) => binding.slotId !== "primaryAction",
    );
    expect(() => veskifyComponentRegistryV2.validateInstance(labelWithoutBinding)).toThrow(
      /must be supplied together/i,
    );

    const bindingWithoutLabel = heroInstance();
    bindingWithoutLabel.content = {
      heading: bindingWithoutLabel.content.heading,
      supportingCopy: bindingWithoutLabel.content.supportingCopy,
    };
    expect(() => veskifyComponentRegistryV2.validateInstance(bindingWithoutLabel)).toThrow(
      /must be supplied together/i,
    );

    const secondaryWithoutBinding = heroInstance();
    secondaryWithoutBinding.content = {
      ...secondaryWithoutBinding.content,
      secondaryActionLabel: localized("Learn more"),
    };
    expect(() => veskifyComponentRegistryV2.validateInstance(secondaryWithoutBinding)).toThrow(
      /secondaryAction must be supplied together/i,
    );

    const unknownTarget = heroInstance();
    unknownTarget.bindings = unknownTarget.bindings.map((binding) =>
      binding.slotId === "primaryAction" && binding.source === "navigation"
        ? { ...binding, navigationId: "navigation_unknown" }
        : binding,
    );
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(unknownTarget, projection),
    ).toThrow(/Unknown navigation binding target/i);

    const unsupportedSlot = heroInstance();
    unsupportedSlot.bindings = unsupportedSlot.bindings.map((binding) =>
      binding.slotId === "primaryAction" ? { ...binding, slotId: "tertiaryAction" } : binding,
    );
    expect(() => veskifyComponentRegistryV2.validateInstance(unsupportedSlot)).toThrow(
      /Invalid commerce binding slot/i,
    );
  });

  it("enforces promotion and trust action pairs while omitted actions render safely", () => {
    const promotion = promotionInstance(false);
    expect(() => veskifyComponentRegistryV2.validateInstance(promotion)).not.toThrow();
    const trust = trustInstance();
    expect(() => veskifyComponentRegistryV2.validateInstance(trust)).not.toThrow();

    const invalidPromotion = promotionInstance(false);
    invalidPromotion.bindings.push({
      slotId: "promotionAction",
      source: "navigation",
      navigationId: "navigation_shop",
      revision: "navigation-rev-shop",
    });
    expect(() => veskifyComponentRegistryV2.validateInstance(invalidPromotion)).toThrow(
      /promotionAction must be supplied together/i,
    );

    const invalidTrust = trustInstance();
    invalidTrust.content = { ...invalidTrust.content, actionLabel: localized("Support") };
    expect(() => veskifyComponentRegistryV2.validateInstance(invalidTrust)).toThrow(
      /supportAction must be supplied together/i,
    );

    const { rerender } = render(renderHomepageCommerce(rendererInput(promotion)));
    expect(screen.queryByRole("button")).toBeNull();
    rerender(renderHomepageCommerce(rendererInput(trust)));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders background hero and promotion variants in isolated clickable sections", () => {
    const onNavigate = vi.fn();
    for (const variant of ["editorialSplit", "imageLed", "minimal"] as const) {
      const hero = heroInstance();
      hero.variant = variant;
      hero.props = { ...hero.props, mediaPosition: "background" };
      const rendered = render(renderHomepageCommerce(rendererInput(hero, { onNavigate })));
      expect(rendered.container.querySelector("[data-media-position='background']")).toBeVisible();
      expect(screen.getByRole("button", { name: "Shop now" })).toBeEnabled();
      rendered.unmount();
    }
    const overlayHero = heroInstance();
    overlayHero.variant = "fullBleedOverlay";
    overlayHero.props = { ...overlayHero.props, mediaPosition: "background" };
    const overlay = render(renderHomepageCommerce(rendererInput(overlayHero, { onNavigate })));
    expect(overlay.container.querySelector("[data-media-state='approved']")).toHaveAttribute(
      "data-copy-treatment",
      "overlay",
    );
    overlay.unmount();
    for (const variant of ["split", "overlay", "minimal"] as const) {
      const promotion = promotionInstance();
      promotion.variant = variant;
      const rendered = render(renderHomepageCommerce(rendererInput(promotion, { onNavigate })));
      expect(rendered.container.querySelector("[data-media-position='background']")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Explore" }));
      rendered.unmount();
    }
    expect(onNavigate).toHaveBeenCalledWith({
      type: "navigateToApprovedAction",
      navigationId: "navigation_shop",
    });
  });

  it("uses canonical brand tokens and safe stacking for all homepage surfaces", () => {
    const css = readFileSync("src/components/storefront/homepage-commerce.module.css", "utf8");
    expect(css).not.toMatch(/--color-/);
    for (const token of [
      "--brand-color-primary",
      "--brand-color-accent",
      "--brand-color-background",
      "--brand-color-surface",
      "--brand-color-text",
      "--brand-color-muted-text",
      "--brand-color-border",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toMatch(/\.root\s*\{[\s\S]*isolation:\s*isolate;[\s\S]*position:\s*relative;/);
    expect(css).toMatch(
      /\.media_background\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*pointer-events:\s*none;[\s\S]*z-index:\s*0;/,
    );
    expect(css).not.toMatch(/z-index:\s*-\d/);
    expect(css).toMatch(/\.heroCopy,[\s\S]*\.editorialCopy\s*\{[\s\S]*z-index:\s*2;/);
  });

  it("caps navigation columns at the registered responsive maximum", () => {
    const navigation = instance(
      "homepageCollectionNavigation",
      "standard",
      {
        heading: localized("Browse"),
        mediaPlaceholderLabel: localized("No collection image"),
      },
      { presentation: "compact", columns: 4 },
      [
        {
          slotId: "collections",
          source: "collectionList",
          collectionIds: [rings.collectionId],
          revision: "collection-list-rev-home",
        },
      ],
    );
    expect(() => veskifyComponentRegistryV2.validateInstance(navigation)).not.toThrow();
    navigation.props = { ...navigation.props, columns: 5 };
    expect(() => veskifyComponentRegistryV2.validateInstance(navigation)).toThrow(
      /Invalid component props/i,
    );
    expect(
      homepageCommerceDefinitions.find(
        (definition) => definition.type === "homepageCollectionNavigation",
      )?.responsiveRules[0],
    ).toMatchObject({
      breakpoints: ["mobile", "tablet", "desktop", "wide"],
      maxColumns: 4,
    });
    for (const component of [
      "homepageFeaturedCollections",
      "homepageFeaturedProducts",
      "homepageCollectionNavigation",
      "homepageTrust",
    ]) {
      const definition = homepageCommerceDefinitions.find(
        (candidate) => candidate.type === component,
      );
      const columnSchema = definition?.propsSchema.properties.columns as
        { maximum?: number } | undefined;
      expect(columnSchema?.maximum).toBe(definition?.responsiveRules[0]?.maxColumns);
    }
  });

  it("renders a localized accessible empty state without an empty product control region", () => {
    const empty = featuredProductsInstance();
    empty.bindings = empty.bindings.map((binding) =>
      binding.slotId === "products" && binding.source === "productList"
        ? { ...binding, productIds: [] }
        : binding,
    );
    const { rerender } = render(renderHomepageCommerce(rendererInput(empty)));
    expect(screen.getByRole("status")).toHaveTextContent("No featured products");
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("[data-empty-state='products']")).toBeVisible();

    empty.props = { ...empty.props, layout: "carousel" };
    rerender(
      renderHomepageCommerce(rendererInput(empty, { activeLocale: "fi", primaryLocale: "fi" })),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Ei nostettuja tuotteita");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses the same registered implementation for editor, preview and published targets", () => {
    for (const definition of homepageCommerceDefinitions) {
      const targets = homepageCommerceComponentByTarget[definition.type];
      expect(targets.editor).toBe(targets.preview);
      expect(targets.preview).toBe(targets.published);
      expect(definition.renderer.supportedTargets).toEqual(["editor", "preview", "published"]);
    }
    for (const target of ["editor", "preview", "published"] as const) {
      const rendered = render(
        renderHomepageCommerce(rendererInput(featuredCollectionsInstance(), { target })),
      );
      expect(rendered.container.querySelector("[data-render-target]")).toHaveAttribute(
        "data-render-target",
        target,
      );
      expect(rendered.container.querySelector("[data-item-count]")).toHaveAttribute(
        "data-item-count",
        "2",
      );
      rendered.unmount();
    }
  });

  it("rejects unknown props, content and style fields through strict schemas", () => {
    for (const [field, value] of [
      ["content", { ...heroInstance().content, unknown: true }],
      ["props", { ...heroInstance().props, arbitraryCss: "position:fixed" }],
      ["styleOverrides", { surface: "plain", padding: "999px" }],
    ] as const) {
      const candidate = heroInstance();
      candidate[field] = value;
      expect(() => veskifyComponentRegistryV2.validateInstance(candidate)).toThrow(
        new RegExp(
          `Invalid component ${field === "styleOverrides" ? "styleOverrides" : field}`,
          "i",
        ),
      );
    }
  });

  it("registers accessible product-type-independent responsive contracts", () => {
    expect(homepageCommerceDefinitions).toHaveLength(6);
    expect(homepageHeroDefinition.industryTags).toEqual([]);
    for (const definition of homepageCommerceDefinitions) {
      expect(definition.supportedPageTypes).toEqual(["home"]);
      expect(definition.responsiveRules[0]?.breakpoints).toEqual([
        "mobile",
        "tablet",
        "desktop",
        "wide",
      ]);
      expect(definition.responsiveRules[0]?.allowHorizontalOverflow).toBe(false);
      expect(definition.accessibilityRequirements.keyboard).toMatch(/keyboard/i);
    }
    render(renderHomepageCommerce(rendererInput(featuredProductsInstance())));
    expect(
      document.querySelector("[data-responsive-layout='product-type-independent']"),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-product-type='watch']")).toBeInTheDocument();
    expect(document.querySelector("[data-product-type='ring']")).toBeInTheDocument();
  });

  it("keeps homepage modules free of route, Puck, provider, storage and commerce-mutation imports", () => {
    for (const path of [
      "src/components/registry/homepage-commerce.ts",
      "src/components/storefront/homepage-commerce.tsx",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(
        /@puckeditor|integrations\/puck|indexed-db|ai-provider|publishing/,
      );
      expect(source).not.toMatch(/addToCart|checkout|updateStock|createOrder|setPrice/);
    }
  });
});
