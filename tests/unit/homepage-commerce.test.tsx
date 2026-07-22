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
): StorefrontAssetMetadata {
  return {
    assetId,
    role,
    alt: localized(`${assetId} alt`, `${assetId} vaihtoehtoinen teksti`),
    decorative: false,
    provenance: { kind: "merchantProvided", sourceId: `source_${assetId}` },
    approvalStatus,
    usageRights: "merchantOwned",
    responsiveCrops: [],
    revision: `revision_${assetId}`,
  };
}

const projection: ComponentProjectionContext = {
  products: [watch, ring],
  collections: [rings, watches],
  assets: [
    asset("asset_hero", "heroDesktop"),
    asset("asset_promotion", "editorialImage"),
    asset("asset_rings", "collectionImage"),
    asset("asset_watch", "productMainImage"),
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
    render(renderHomepageCommerce(rendererInput(heroInstance(false))));
    expect(screen.getByRole("heading", { name: "Designed for everyday" })).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector("[data-media-state='omitted']")).toBeInTheDocument();
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
    render(renderHomepageCommerce(rendererInput(featuredCollectionsInstance())));
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual(["Watches", "Rings"]);
    expect(screen.queryByText("Unknown collection")).toBeNull();
  });

  it("renders reusable product cards only from canonical product-list bindings", () => {
    render(renderHomepageCommerce(rendererInput(featuredProductsInstance())));
    expect(screen.getByRole("button", { name: "Nordic watch" })).toBeVisible();
    expect(screen.getByText("€349")).toBeVisible();
    expect(screen.getByText("€399")).toBeVisible();
    expect(screen.getByText("In stock")).toBeVisible();
    expect(screen.getByRole("button", { name: "Aurora ring" })).toBeVisible();
    expect(screen.getByText("Price on request")).toBeVisible();
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
    const trust = instance(
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
    const { rerender } = render(renderHomepageCommerce(rendererInput(trust)));
    expect(screen.getByRole("heading", { name: "Here to help" })).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(
      renderHomepageCommerce(rendererInput(trust, { activeLocale: "fi", primaryLocale: "en" })),
    );
    expect(screen.getByRole("heading", { name: "Autamme mielellämme" })).toBeVisible();
    expect(screen.getByText("Tarkista toimitustiedot.")).toBeVisible();
  });

  it("uses the same registered implementation for editor, preview and published targets", () => {
    for (const definition of homepageCommerceDefinitions) {
      const targets = homepageCommerceComponentByTarget[definition.type];
      expect(targets.editor).toBe(targets.preview);
      expect(targets.preview).toBe(targets.published);
      expect(definition.renderer.supportedTargets).toEqual(["editor", "preview", "published"]);
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
