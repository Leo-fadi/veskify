import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  COLLECTION_PRESENTATION_WINDOW_SIZE,
  collectionCardinalityClass,
  collectionRangeFilterIntentSchema,
  createCollectionRangeFilterIntent,
  dynamicCollectionCommerceComponentByTarget,
  renderDynamicCollectionCommerce,
  type CollectionFilterIntent,
  type DynamicCollectionCommerceRendererInput,
} from "@/components/storefront/dynamic-collection-commerce";
import {
  dynamicCollectionCommerceDefaultContent,
  dynamicCollectionCommerceDefaultProps,
  dynamicCollectionCommerceDefaultStyleOverrides,
  dynamicCollectionCommerceDefinition,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import type {
  CollectionPresentationContext,
  ProductPresentationContext,
  StorefrontAssetMetadata,
} from "@/domain/component-platform";
import { createResponsiveImageAuthority } from "@/domain/asset-presentation";
import { canonicalValueFingerprint } from "@/domain/storefront";

const localized = (en: string, fi = en) => ({ en, fi });

const watch: ProductPresentationContext = {
  productId: "product_watch",
  productTypeId: "watch",
  sku: "WATCH-001",
  title: localized("Nordic watch", "Pohjoismainen kello"),
  price: { amount: 349, currency: "EUR", formatted: localized("€349", "349 €") },
  compareAtPrice: { amount: 399, currency: "EUR", formatted: localized("€399", "399 €") },
  availability: localized("In stock", "Varastossa"),
  media: [{ assetId: "asset_watch", role: "main", alt: localized("Silver watch") }],
  attributeGroups: [
    {
      id: "watch_specs",
      title: localized("Specifications"),
      attributes: [
        { id: "movement", label: localized("Movement", "Koneisto"), value: localized("Automatic") },
      ],
    },
  ],
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
  media: [{ assetId: "asset_ring", role: "main", alt: localized("Gold ring") }],
  attributeGroups: [
    {
      id: "ring_specs",
      title: localized("Materials"),
      attributes: [
        { id: "metal", label: localized("Metal", "Metalli"), value: localized("Recycled gold") },
      ],
    },
  ],
  optionGroups: [],
  selectedValues: [],
  unavailableCombinations: [],
  relatedProductIds: [],
  revision: "product-rev-ring",
};

const collection: CollectionPresentationContext = {
  collectionId: "collection_all",
  title: localized("All products", "Kaikki tuotteet"),
  description: localized("Canonical collection description", "Kanoninen mallistokuvaus"),
  assets: [{ assetId: "asset_collection", role: "hero" }],
  productIds: [watch.productId, ring.productId],
  filters: [
    {
      id: "material",
      label: localized("Material", "Materiaali"),
      presentation: "enumerated",
      values: [
        { id: "gold", label: localized("Gold", "Kulta"), count: 1, selected: true },
        { id: "steel", label: localized("Steel", "Teräs"), count: 1, disabled: true },
        { id: "silver", label: localized("Silver", "Hopea"), count: 1 },
      ],
    },
    {
      id: "price",
      label: localized("Price", "Hinta"),
      presentation: "range",
      values: [],
      range: {
        min: 0,
        max: 1000,
        selectedMin: 100,
        selectedMax: 800,
        step: 50,
        unit: localized("EUR"),
      },
    },
  ],
  sorting: [
    { id: "featured", label: localized("Featured", "Suositellut"), default: true },
    {
      id: "price_low",
      label: localized("Price: low to high", "Hinta: halvin ensin"),
      default: false,
    },
  ],
  breadcrumbs: [{ collectionId: "collection_root", label: localized("Store", "Kauppa") }],
  childCollectionIds: ["collection_watches"],
  emptyState: {
    title: localized("No products", "Ei tuotteita"),
    description: localized("Try clearing filters", "Kokeile tyhjentää suodattimet"),
  },
  revision: "collection-rev-all",
};

const childCollection: CollectionPresentationContext = {
  collectionId: "collection_watches",
  title: localized("Watches", "Kellot"),
  assets: [],
  productIds: [watch.productId],
  filters: [],
  sorting: [],
  emptyState: { title: localized("No watches") },
  revision: "collection-rev-watches",
};

function asset(
  assetId: string,
  role: StorefrontAssetMetadata["role"],
  approvalStatus: StorefrontAssetMetadata["approvalStatus"] = "approved",
): StorefrontAssetMetadata {
  const sourceOwnerId = assetId.replace(/^asset_/, "product_");
  const canonicalRole =
    role === "productMainImage" || role === "productAlternativeImage" ? role : undefined;
  const revision = `revision_${assetId}`;
  const source = canonicalRole
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
    alt: localized(`${assetId} alt`),
    decorative: false,
    provenance: { kind: "canonicalProductMedia", sourceId: sourceOwnerId },
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
              componentType: "dynamicCollectionCommerce",
              componentVersion: "2.0.0",
              variant: "standard",
              anatomyContractVersion: "1.0.0",
              anatomyIdentity: "dynamicCollectionCommerce.anatomy",
              anatomyVersion: "1.0.0",
              anatomyRegion: "media",
              assetSlotId: "collectionCommerceMedia",
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

const assets = [
  asset("asset_collection", "collectionImage"),
  asset("asset_watch", "productMainImage"),
  asset("asset_ring", "productMainImage"),
];

function instance(
  currentCollection: CollectionPresentationContext = collection,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `section_${currentCollection.collectionId}`,
    component: "dynamicCollectionCommerce",
    componentVersion: { major: 2, minor: 0, patch: 0 },
    variant: "standard",
    content: dynamicCollectionCommerceDefaultContent,
    props: dynamicCollectionCommerceDefaultProps,
    styleOverrides: dynamicCollectionCommerceDefaultStyleOverrides,
    bindings: [
      {
        slotId: "primaryCollection",
        source: "collection",
        collectionId: currentCollection.collectionId,
        revision: currentCollection.revision,
      },
      {
        slotId: "collectionProducts",
        source: "productList",
        productIds: currentCollection.productIds,
        revision: "product-list-rev-1",
      },
      ...(currentCollection.childCollectionIds?.length
        ? [
            {
              slotId: "childCollections",
              source: "collectionList",
              collectionIds: currentCollection.childCollectionIds,
              revision: "collection-list-rev-1",
            },
          ]
        : []),
    ],
    assetAssignments: [],
    ...overrides,
  };
}

function rendererInput(
  currentCollection: CollectionPresentationContext = collection,
  overrides: Partial<DynamicCollectionCommerceRendererInput> = {},
): DynamicCollectionCommerceRendererInput {
  const products = currentCollection.productIds.flatMap((productId) =>
    [watch, ring].filter((product) => product.productId === productId),
  );
  return {
    target: "preview",
    instance: instance(currentCollection),
    projection: {
      products,
      collections: [currentCollection, childCollection],
      assets,
      navigation: [],
      projectBrandContexts: [],
      localizedContents: [],
      productListRevision: "product-list-rev-1",
      collectionListRevision: "collection-list-rev-1",
    },
    activeLocale: "en",
    primaryLocale: "en",
    loading: { status: "ready" },
    resolveAssetUrl: (assetId) => `/assets/${assetId}.jpg`,
    onNavigateProduct: vi.fn(),
    onNavigateCollection: vi.fn(),
    onFilterIntent: vi.fn(),
    onSortIntent: vi.fn(),
    ...overrides,
  };
}

function collectionWithRange(
  rangeOverrides: Partial<NonNullable<CollectionPresentationContext["filters"][number]["range"]>>,
) {
  const next = structuredClone(collection);
  const range = next.filters.find((filter) => filter.id === "price")!.range!;
  Object.assign(range, rangeOverrides);
  return next;
}

function productMediaInput(
  product: ProductPresentationContext,
  productAssets: StorefrontAssetMetadata[],
  assetAssignments: Array<{
    slotId: "collectionCommerceMedia";
    assetId: string;
    role: StorefrontAssetMetadata["role"];
  }> = [],
) {
  const currentCollection: CollectionPresentationContext = {
    collectionId: `collection_${product.productId}`,
    title: localized("Product media collection"),
    assets: [],
    productIds: [product.productId],
    filters: [],
    sorting: [],
    emptyState: { title: localized("No products") },
    revision: `collection-rev-${product.productId}`,
  };
  const input = rendererInput(currentCollection);
  input.instance = instance(currentCollection, { assetAssignments });
  input.projection = {
    products: [product],
    collections: [currentCollection],
    assets: productAssets,
    navigation: [],
    projectBrandContexts: [],
    localizedContents: [],
    productListRevision: "product-list-rev-1",
    collectionListRevision: "collection-list-rev-1",
  };
  return input;
}

describe("P6-04 dynamic collection commerce", () => {
  it("renders canonical product facts, coherent price states and concise attributes", () => {
    render(renderDynamicCollectionCommerce(rendererInput()));

    expect(screen.getByRole("heading", { name: "Nordic watch" })).toBeVisible();
    expect(screen.getByText("€349")).toBeVisible();
    expect(screen.getByText("€399").tagName).toBe("DEL");
    expect(screen.getByText("In stock")).toBeVisible();
    expect(screen.getByText("Movement")).toBeVisible();
    expect(screen.getByText("Price on request")).toBeVisible();
    expect(screen.getByText("Made to order")).toBeVisible();
    expect(screen.getByText("Sale")).toBeVisible();
    expect(screen.getByText("Price unavailable")).toBeVisible();
    expect(screen.queryByText("WATCH-001")).not.toBeInTheDocument();
  });

  it("emits exactly one typed product-navigation intent", async () => {
    const user = userEvent.setup();
    const onNavigateProduct = vi.fn();
    render(renderDynamicCollectionCommerce(rendererInput(collection, { onNavigateProduct })));

    await user.click(screen.getByRole("button", { name: "Nordic watch" }));

    expect(onNavigateProduct).toHaveBeenCalledTimes(1);
    expect(onNavigateProduct).toHaveBeenCalledWith({
      type: "navigateToProduct",
      productId: "product_watch",
      catalogueRevision: "product-rev-watch",
    });
  });

  it("requires productList membership and order to match the canonical collection", () => {
    const input = rendererInput();
    input.instance = instance(collection, {
      bindings: [
        ...instance(collection).bindings.slice(0, 1),
        {
          slotId: "collectionProducts",
          source: "productList",
          productIds: [ring.productId, watch.productId],
          revision: "product-list-rev-1",
        },
      ],
    });

    expect(() => renderDynamicCollectionCommerce(input)).toThrow(/membership and order/i);
  });

  it("rejects missing collection and product-list bindings", () => {
    expect(() =>
      veskifyComponentRegistryV2.validateInstance(instance(collection, { bindings: [] })),
    ).toThrow(/Missing required commerce binding slot: collectionProducts/i);
    expect(() =>
      veskifyComponentRegistryV2.validateInstance(
        instance(collection, { bindings: instance(collection).bindings.slice(0, 1) }),
      ),
    ).toThrow(/Missing required commerce binding slot: collectionProducts/i);
    expect(() =>
      renderDynamicCollectionCommerce(
        rendererInput(collection, {
          instance: instance(collection, { bindings: instance(collection).bindings.slice(1, 2) }),
        }),
      ),
    ).toThrow(/requires one canonical collection binding/i);
  });

  it("renders an empty collection and a supplied loading state safely", () => {
    const empty: CollectionPresentationContext = {
      ...structuredClone(collection),
      collectionId: "collection_empty",
      assets: [],
      productIds: [],
      childCollectionIds: [],
      revision: "collection-rev-empty",
    };
    const emptyRender = render(renderDynamicCollectionCommerce(rendererInput(empty)));
    expect(screen.getByRole("heading", { name: "No products" })).toBeVisible();
    expect(screen.getByText("Try clearing filters")).toBeVisible();
    emptyRender.unmount();

    render(
      renderDynamicCollectionCommerce(
        rendererInput(collection, { loading: { status: "loading" } }),
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading products");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("heading", { name: "Nordic watch" })).not.toBeInTheDocument();
  });

  it("renders approved collection media and safely omits an absent hero", () => {
    const withHero = render(renderDynamicCollectionCommerce(rendererInput()));
    expect(withHero.container.querySelector('[data-asset-id="asset_collection"]')).toHaveAttribute(
      "data-asset-provenance",
      "canonicalProductMedia",
    );
    withHero.unmount();

    const noHero = { ...structuredClone(collection), assets: [] };
    render(renderDynamicCollectionCommerce(rendererInput(noHero)));
    expect(screen.getByRole("heading", { name: "All products" })).toBeVisible();
    expect(screen.queryByTestId("collection-hero-placeholder")).not.toBeInTheDocument();
  });

  it("renders canonical enumerated/range filters, counts and selected values", () => {
    render(renderDynamicCollectionCommerce(rendererInput()));

    expect(screen.getByRole("checkbox", { name: /Gold.*1/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Steel.*1/ })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Price minimum" })).toHaveValue("100");
    expect(screen.getByRole("slider", { name: "Price maximum" })).toHaveValue("800");
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeEnabled();
    expect(screen.getByRole("slider", { name: "Price minimum" })).toHaveAccessibleDescription(
      "Allowed 0–800 EUR. Step 50 EUR.",
    );
    expect(screen.getByRole("slider", { name: "Price maximum" })).toHaveAccessibleDescription(
      "Allowed 100–1000 EUR. Step 50 EUR.",
    );
  });

  it("keeps selected categorical and collapsed range filters visible and clearable", async () => {
    const user = userEvent.setup();
    const onFilterIntent = vi.fn();
    const collapsedFilters: CollectionPresentationContext = {
      ...structuredClone(collection),
      filters: [
        {
          id: "material",
          label: localized("Material", "Materiaali"),
          presentation: "enumerated",
          values: [
            { id: "gold", label: localized("Gold", "Kulta"), count: 0, selected: true },
            { id: "silver", label: localized("Silver", "Hopea"), count: 0 },
          ],
        },
        {
          id: "price",
          label: localized("Price", "Hinta"),
          presentation: "range",
          values: [],
          range: { min: 500, max: 500, selectedMin: 500, selectedMax: 500 },
        },
      ],
    };
    const rendered = render(
      renderDynamicCollectionCommerce(rendererInput(collapsedFilters, { onFilterIntent })),
    );

    expect(rendered.container.querySelector('[data-filter-id="material"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-filter-id="price"]')).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /Gold.*0/ })).toBeChecked();
    const activeFilters = screen.getByLabelText("Active filters");
    const materialChip = within(activeFilters).getByRole("button", { name: /Material/ });
    const priceChip = within(activeFilters).getByRole("button", { name: /Price/ });
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeEnabled();

    await user.click(materialChip);
    await user.click(priceChip);
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(onFilterIntent).toHaveBeenNthCalledWith(1, {
      type: "clearCollectionFilter",
      collectionId: collapsedFilters.collectionId,
      collectionRevision: collapsedFilters.revision,
      filterId: "material",
    });
    expect(onFilterIntent).toHaveBeenNthCalledWith(2, {
      type: "clearCollectionFilter",
      collectionId: collapsedFilters.collectionId,
      collectionRevision: collapsedFilters.revision,
      filterId: "price",
    });
    expect(onFilterIntent).toHaveBeenNthCalledWith(3, {
      type: "clearAllCollectionFilters",
      collectionId: collapsedFilters.collectionId,
      collectionRevision: collapsedFilters.revision,
    });
  });

  it("clamps minimum and maximum slider intents to the selected opposite bound", () => {
    const intents: CollectionFilterIntent[] = [];
    render(
      renderDynamicCollectionCommerce(
        rendererInput(collection, { onFilterIntent: (intent) => intents.push(intent) }),
      ),
    );

    fireEvent.change(screen.getByRole("slider", { name: "Price minimum" }), {
      target: { value: "950" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Price maximum" }), {
      target: { value: "50" },
    });

    expect(intents).toEqual([
      expect.objectContaining({ type: "setCollectionFilterRange", min: 800, max: 800 }),
      expect.objectContaining({ type: "setCollectionFilterRange", min: 100, max: 100 }),
    ]);
    expect(
      intents.every((intent) =>
        intent.type === "setCollectionFilterRange" ? intent.min <= intent.max : true,
      ),
    ).toBe(true);
  });

  it("uses canonical bounds for partially selected ranges", () => {
    const missingMinimum = collectionWithRange({ selectedMin: undefined });
    const minimumIntents: CollectionFilterIntent[] = [];
    const minimumRender = render(
      renderDynamicCollectionCommerce(
        rendererInput(missingMinimum, {
          onFilterIntent: (intent) => minimumIntents.push(intent),
        }),
      ),
    );
    fireEvent.change(screen.getByRole("slider", { name: "Price maximum" }), {
      target: { value: "700" },
    });
    expect(minimumIntents).toContainEqual(
      expect.objectContaining({ type: "setCollectionFilterRange", min: 0, max: 700 }),
    );
    minimumRender.unmount();

    const missingMaximum = collectionWithRange({ selectedMax: undefined });
    const maximumIntents: CollectionFilterIntent[] = [];
    render(
      renderDynamicCollectionCommerce(
        rendererInput(missingMaximum, {
          onFilterIntent: (intent) => maximumIntents.push(intent),
        }),
      ),
    );
    fireEvent.change(screen.getByRole("slider", { name: "Price minimum" }), {
      target: { value: "300" },
    });
    expect(maximumIntents).toContainEqual(
      expect.objectContaining({ type: "setCollectionFilterRange", min: 300, max: 1000 }),
    );
  });

  it("normalizes finite range values to canonical bounds and step before intent emission", () => {
    const range = collection.filters.find((filter) => filter.id === "price")!.range!;
    const base = {
      collectionId: collection.collectionId,
      collectionRevision: collection.revision,
      filterId: "price",
      range,
      changedBound: "min" as const,
    };

    expect(createCollectionRangeFilterIntent({ ...base, rawValue: 126 })).toEqual(
      expect.objectContaining({ min: 150, max: 800 }),
    );
    expect(createCollectionRangeFilterIntent({ ...base, rawValue: -500 })).toEqual(
      expect.objectContaining({ min: 0, max: 800 }),
    );
    expect(createCollectionRangeFilterIntent({ ...base, rawValue: Number.NaN })).toBeUndefined();
    expect(
      createCollectionRangeFilterIntent({ ...base, rawValue: Number.POSITIVE_INFINITY }),
    ).toBeUndefined();
    expect(() =>
      collectionRangeFilterIntentSchema.parse({
        type: "setCollectionFilterRange",
        collectionId: collection.collectionId,
        collectionRevision: collection.revision,
        filterId: "price",
        min: 900,
        max: 800,
      }),
    ).toThrow(/minimum cannot exceed/i);
  });

  it("rejects invalid initial selected range ordering, bounds, finiteness and step", () => {
    for (const invalid of [
      collectionWithRange({ selectedMin: 900, selectedMax: 800 }),
      collectionWithRange({ selectedMin: -50 }),
      collectionWithRange({ selectedMax: Number.POSITIVE_INFINITY }),
      collectionWithRange({ selectedMin: 125 }),
    ]) {
      expect(() => renderDynamicCollectionCommerce(rendererInput(invalid))).toThrow();
    }
  });

  it("never emits filter intent for a disabled value", () => {
    const onFilterIntent = vi.fn();
    render(renderDynamicCollectionCommerce(rendererInput(collection, { onFilterIntent })));

    fireEvent.click(screen.getByRole("checkbox", { name: /Steel.*1/ }));
    expect(onFilterIntent).not.toHaveBeenCalled();
  });

  it("emits typed filter, range, clear and clear-all intents without mutating projection", async () => {
    const user = userEvent.setup();
    const onFilterIntent = vi.fn();
    const input = rendererInput(collection, { onFilterIntent });
    const before = structuredClone(input.projection);
    render(renderDynamicCollectionCommerce(input));

    await user.click(screen.getByRole("checkbox", { name: /Gold.*1/ }));
    fireEvent.change(screen.getByRole("slider", { name: "Price minimum" }), {
      target: { value: "200" },
    });
    await user.click(screen.getByRole("button", { name: "Clear Material" }));
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(onFilterIntent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "setCollectionFilterValue" }),
    );
    expect(onFilterIntent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "setCollectionFilterRange" }),
    );
    expect(onFilterIntent).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ type: "clearCollectionFilter" }),
    );
    expect(onFilterIntent).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ type: "clearAllCollectionFilters" }),
    );
    expect(input.projection).toEqual(before);
  });

  it("emits sort intents only for canonical supported options", () => {
    const onSortIntent = vi.fn();
    render(renderDynamicCollectionCommerce(rendererInput(collection, { onSortIntent })));
    const sort = screen.getByRole("combobox", { name: "Sort products" });

    fireEvent.change(sort, { target: { value: "price_low" } });
    expect(onSortIntent).toHaveBeenCalledWith({
      type: "sortCollectionProducts",
      collectionId: "collection_all",
      collectionRevision: "collection-rev-all",
      sortId: "price_low",
    });
    fireEvent.change(sort, { target: { value: "raw_inventory_sort" } });
    expect(onSortIntent).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown product IDs and collection-membership substitutions", () => {
    const unknown = rendererInput();
    unknown.instance = instance(collection, {
      bindings: instance(collection).bindings.map((binding) =>
        binding.slotId === "collectionProducts"
          ? { ...binding, productIds: [watch.productId, "product_unknown"] }
          : binding,
      ),
    });
    expect(() => renderDynamicCollectionCommerce(unknown)).toThrow(/Unknown product list binding/i);

    const substitution = rendererInput();
    substitution.projection = {
      ...(substitution.projection as object),
      products: [watch, { ...ring, productId: "product_substitute" }],
    };
    expect(() => renderDynamicCollectionCommerce(substitution)).toThrow(
      /Unknown product list binding/i,
    );
  });

  it("renders canonical product media roles without relabelling and rejects editorial substitution", () => {
    const scenarios = [
      ["main", "productMainImage"],
      ["variant", "productAlternativeImage"],
      ["alternative", "productAlternativeImage"],
    ] as const;

    for (const [canonicalRole, inventoryRole] of scenarios) {
      const product = {
        ...structuredClone(watch),
        productId: `product_${canonicalRole}`,
        media: [
          {
            assetId: `asset_${canonicalRole}`,
            role: canonicalRole,
            alt: localized(`${canonicalRole} watch`),
          },
        ],
        revision: `product-rev-${canonicalRole}`,
      };
      const rendered = render(
        renderDynamicCollectionCommerce(
          productMediaInput(product, [asset(`asset_${canonicalRole}`, inventoryRole)]),
        ),
      );
      expect(
        rendered.container.querySelector(`[data-asset-id="asset_${canonicalRole}"]`),
      ).toHaveAttribute("data-asset-role", inventoryRole);
      rendered.unmount();
    }
    const editorialProduct = {
      ...structuredClone(watch),
      productId: "product_editorial",
      media: [{ assetId: "asset_editorial", role: "editorial" as const }],
      revision: "product-rev-editorial",
    };
    render(
      renderDynamicCollectionCommerce(
        productMediaInput(editorialProduct, [asset("asset_editorial", "editorialImage")]),
      ),
    );
    expect(screen.getByText("Product image unavailable")).toBeVisible();
  });

  it("rejects unsupported first canonical card media instead of silently substituting it", () => {
    const product = {
      ...structuredClone(watch),
      productId: "product_media_fallback",
      media: [
        { assetId: "asset_wrong_role", role: "main" as const, alt: localized("Wrong role") },
        {
          assetId: "asset_approved_alternative",
          role: "alternative" as const,
          alt: localized("Approved alternative"),
        },
      ],
      revision: "product-rev-media-fallback",
    };
    expect(() =>
      renderDynamicCollectionCommerce(
        productMediaInput(product, [
          asset("asset_wrong_role", "iconDecorative"),
          asset("asset_approved_alternative", "productAlternativeImage"),
        ]),
      ),
    ).toThrow(/role does not match/i);
  });

  it("rejects unknown canonical media and keeps the placeholder for a documented no-media state", () => {
    const product = {
      ...structuredClone(watch),
      productId: "product_media_placeholder",
      media: [
        { assetId: "asset_unknown", role: "main" as const, alt: localized("Unknown") },
        { assetId: "asset_rejected", role: "editorial" as const, alt: localized("Rejected") },
      ],
      revision: "product-rev-media-placeholder",
    };
    expect(() =>
      renderDynamicCollectionCommerce(
        productMediaInput(product, [asset("asset_rejected", "editorialImage", "rejected")]),
      ),
    ).toThrow(/missing from inventory/i);

    const noMedia = {
      ...structuredClone(watch),
      productId: "product_no_media_placeholder",
      media: [],
      revision: "product-rev-no-media-placeholder",
    };
    render(renderDynamicCollectionCommerce(productMediaInput(noMedia, [])));

    expect(screen.getByText("Product image unavailable")).toBeVisible();
    expect(screen.queryByRole("img", { name: /unknown|rejected/i })).not.toBeInTheDocument();
  });

  it("rejects unknown and unapproved explicitly assigned product media", () => {
    const unknownProduct = {
      ...structuredClone(watch),
      productId: "product_explicit_unknown",
      media: [{ assetId: "asset_explicit_unknown", role: "main" as const }],
      revision: "product-rev-explicit-unknown",
    };
    expect(() =>
      renderDynamicCollectionCommerce(
        productMediaInput(
          unknownProduct,
          [],
          [
            {
              slotId: "collectionCommerceMedia",
              assetId: "asset_explicit_unknown",
              role: "productMainImage",
            },
          ],
        ),
      ),
    ).toThrow(/missing from inventory/i);

    const unapprovedProduct = {
      ...structuredClone(watch),
      productId: "product_explicit_unapproved",
      media: [{ assetId: "asset_explicit_unapproved", role: "alternative" as const }],
      revision: "product-rev-explicit-unapproved",
    };
    expect(() =>
      renderDynamicCollectionCommerce(
        productMediaInput(
          unapprovedProduct,
          [asset("asset_explicit_unapproved", "productAlternativeImage", "pending")],
          [
            {
              slotId: "collectionCommerceMedia",
              assetId: "asset_explicit_unapproved",
              role: "productAlternativeImage",
            },
          ],
        ),
      ),
    ).toThrow(/not approved/i);
  });

  it("allows optional child collections to be omitted and validates them when present", () => {
    const input = rendererInput();
    input.instance = instance(collection, {
      bindings: instance(collection).bindings.filter(
        (binding) => binding.slotId !== "childCollections",
      ),
    });
    render(renderDynamicCollectionCommerce(input));
    expect(
      screen.queryByRole("navigation", { name: "Related collections" }),
    ).not.toBeInTheDocument();

    const invalid = rendererInput();
    invalid.instance = instance(collection, {
      bindings: instance(collection).bindings.map((binding) =>
        binding.slotId === "childCollections"
          ? { ...binding, collectionIds: ["collection_unknown"] }
          : binding,
      ),
    });
    expect(() => renderDynamicCollectionCommerce(invalid)).toThrow(
      /Unknown collection list binding/i,
    );
  });

  it("localizes merchant-facing labels in EN and FI", () => {
    const english = render(renderDynamicCollectionCommerce(rendererInput()));
    expect(screen.getByRole("button", { name: /Show filters/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nordic watch" })).toBeVisible();
    english.unmount();

    render(
      renderDynamicCollectionCommerce(
        rendererInput(collection, { activeLocale: "fi", primaryLocale: "fi" }),
      ),
    );
    expect(screen.getByRole("button", { name: /Näytä suodattimet/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Pohjoismainen kello" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Lajittele tuotteet" })).toBeVisible();
  });

  it("keeps the bounded filter toolbar collapsed until the merchant opens it", () => {
    const view = render(renderDynamicCollectionCommerce(rendererInput()));
    const filters = view.container.querySelector<HTMLElement>(
      '[data-filter-panel-mode="disclosure"]',
    );
    const trigger = screen.getByRole("button", { name: /Show filters/ });
    const panel = view.container.querySelector<HTMLElement>('[data-filter-panel-content="true"]');

    expect(filters).not.toBeNull();
    expect(trigger).toHaveAttribute("aria-controls", panel?.id);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("data-disclosure-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("data-disclosure-expanded", "true");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("data-disclosure-expanded", "false");
  });

  it("uses one server-stable panel with mobile disclosure and desktop CSS persistence", () => {
    const view = render(renderDynamicCollectionCommerce(rendererInput()));
    const trigger = screen.getByRole("button", { name: /Show filters/ });
    const panels = view.container.querySelectorAll<HTMLElement>(
      '[data-filter-panel-content="true"]',
    );
    const panel = panels[0];
    const css = readFileSync(
      "src/components/storefront/dynamic-collection-commerce.module.css",
      "utf8",
    );

    expect(panels).toHaveLength(1);
    expect(trigger).toHaveAttribute("aria-controls", panel.id);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("data-disclosure-expanded", "false");
    expect(css).toMatch(/\.filterPanel\[data-disclosure-expanded="false"\][^}]*display: none/s);
    expect(css).toMatch(
      /@media \(min-width: 64rem\)[\s\S]*data-filter-panel-mode="persistent"[^}]*\.filterTrigger[^}]*display: none[\s\S]*data-filter-panel-mode="persistent"[^}]*\.filterPanel\[data-disclosure-expanded\][^}]*display: grid/,
    );
    expect(css).toMatch(
      /\.filters input\[type="checkbox"\][^}]*min-width: 1\.5rem[^}]*min-height: 1\.5rem/s,
    );
    expect(css).toMatch(/\.rangeControls input\[type="range"\][^}]*min-height: 1\.5rem/s);
  });

  it("supports keyboard product/filter navigation with accessible names", async () => {
    const user = userEvent.setup();
    const onNavigateProduct = vi.fn();
    render(renderDynamicCollectionCommerce(rendererInput(collection, { onNavigateProduct })));
    const productButton = screen.getByRole("button", { name: "Nordic watch" });

    productButton.focus();
    expect(productButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onNavigateProduct).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Related collections" })).toBeVisible();
  });

  it("uses product-type-independent responsive contracts and one renderer across targets", () => {
    expect(dynamicCollectionCommerceDefinition.industryTags).toEqual([]);
    expect(dynamicCollectionCommerceDefinition.responsiveRules).toEqual([
      expect.objectContaining({
        breakpoints: ["mobile", "tablet", "desktop", "wide"],
        allowHorizontalOverflow: false,
        maxColumns: 4,
      }),
    ]);
    expect(dynamicCollectionCommerceComponentByTarget.editor).toBe(
      dynamicCollectionCommerceComponentByTarget.preview,
    );
    expect(dynamicCollectionCommerceComponentByTarget.preview).toBe(
      dynamicCollectionCommerceComponentByTarget.published,
    );
    for (const target of ["editor", "preview", "published"] as const) {
      const rendered = render(
        renderDynamicCollectionCommerce(rendererInput(collection, { target })),
      );
      expect(rendered.container.querySelector("[data-responsive-layout]")).toHaveAttribute(
        "data-responsive-layout",
        "content-driven",
      );
      expect(rendered.container.querySelector("[data-render-target]")).toHaveAttribute(
        "data-render-target",
        target,
      );
      expect(rendered.container.querySelector('[data-product-type="watch"]')).toBeVisible();
      expect(rendered.container.querySelector('[data-product-type="ring"]')).toBeVisible();
      rendered.unmount();
    }
  });

  it("executes the registered collection anatomy at exact responsive breakpoints", () => {
    const input = rendererInput();
    input.instance = instance(collection, { variant: "catalogueComparison" });
    const { container } = render(renderDynamicCollectionCommerce(input));
    const root = container.querySelector('[data-component="dynamicCollectionCommerce"]');
    const css = readFileSync(
      "src/components/storefront/dynamic-collection-commerce.module.css",
      "utf8",
    );

    expect(root).toHaveAttribute("data-presentation-mode", "comparisonRail");
    expect(root).toHaveAttribute(
      "data-responsive-transformations",
      "comparisonFilterDisclosure comparisonGridReflow",
    );
    expect(root).toHaveAttribute(
      "data-responsive-tablet",
      "comparisonFilterDisclosure comparisonGridReflow",
    );
    expect(root).toHaveAttribute("data-responsive-desktop", "comparisonGridReflow");
    expect(css).toContain("@media (min-width: 48rem) and (max-width: 63.999rem)");
    expect(css).toContain('[data-responsive-tablet~="comparisonGridReflow"]');
    expect(css).toContain("@media (min-width: 64rem)");
    expect(css).not.toMatch(
      /@media \(min-width: 48rem\)\s*\{\s*\.collectionHeaderLayout[^}]*grid-template-columns/s,
    );
  });

  it("windows large canonical collections at 24 without changing membership or order", async () => {
    const user = userEvent.setup();
    const manyProducts = Array.from({ length: 26 }, (_, index) => ({
      ...structuredClone(watch),
      productId: `product_window_${index + 1}`,
      sku: `WINDOW-${index + 1}`,
      title: localized(`Window product ${index + 1}`),
      media: [
        {
          assetId: `asset_window_${index + 1}`,
          role: "main" as const,
          alt: localized(`Window product ${index + 1}`),
        },
      ],
      revision: `product-rev-window-${index + 1}`,
    }));
    const manyCollection: CollectionPresentationContext = {
      ...structuredClone(collection),
      collectionId: "collection_windowed",
      productIds: manyProducts.map(({ productId }) => productId),
      childCollectionIds: [],
      revision: "collection-rev-windowed",
    };
    const input = rendererInput(manyCollection);
    input.projection = {
      products: manyProducts,
      collections: [manyCollection],
      assets: [
        asset("asset_collection", "collectionImage"),
        ...manyProducts.map((product) => asset(product.media[0].assetId, "productMainImage")),
      ],
      navigation: [],
      projectBrandContexts: [],
      localizedContents: [],
      productListRevision: "product-list-rev-1",
      collectionListRevision: "collection-list-rev-1",
    };
    const before = canonicalValueFingerprint({
      membership: manyCollection.productIds,
      products: manyProducts,
    });
    const { container } = render(renderDynamicCollectionCommerce(input));
    const firstWindow = container.querySelector("[data-product-window-index]");

    expect(COLLECTION_PRESENTATION_WINDOW_SIZE).toBe(24);
    expect(firstWindow).toHaveAttribute("data-canonical-product-count", "26");
    expect(firstWindow).toHaveAttribute("data-presented-product-count", "24");
    expect(container.querySelectorAll("article[data-card-anatomy]")).toHaveLength(24);
    expect(screen.getByRole("heading", { name: "Window product 1" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Window product 25" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next products" }));
    const secondWindow = container.querySelector("[data-product-window-index]");
    expect(secondWindow).toHaveAttribute("data-product-window-index", "1");
    expect(secondWindow).toHaveAttribute("data-canonical-product-count", "26");
    expect(secondWindow).toHaveAttribute("data-presented-product-count", "2");
    expect(screen.getByRole("heading", { name: "Window product 25" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Window product 26" })).toBeVisible();
    expect(
      canonicalValueFingerprint({ membership: manyCollection.productIds, products: manyProducts }),
    ).toBe(before);
  });

  it("uses a bounded one-column track for one product", () => {
    const singleProductCollection = {
      ...structuredClone(collection),
      productIds: [watch.productId],
    };
    const rendered = render(
      renderDynamicCollectionCommerce(rendererInput(singleProductCollection)),
    );
    const grid = rendered.container.querySelector("[data-product-count]");
    const css = readFileSync(
      "src/components/storefront/dynamic-collection-commerce.module.css",
      "utf8",
    );

    expect(grid).toHaveAttribute("data-product-count", "1");
    expect(grid).toHaveAttribute("data-cardinality", "micro");
    expect(grid).toHaveAttribute("data-wide-grid-columns", "1");
    expect(rendered.container.firstElementChild).toHaveAttribute(
      "data-catalogue-cardinality",
      "micro",
    );
    expect(grid?.children).toHaveLength(1);
    expect(css).toMatch(/\.productGrid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  });

  it("classifies transient result cardinality without changing canonical membership", () => {
    expect([
      collectionCardinalityClass(0),
      collectionCardinalityClass(1),
      collectionCardinalityClass(2),
      collectionCardinalityClass(4),
      collectionCardinalityClass(5),
      collectionCardinalityClass(12),
      collectionCardinalityClass(13),
    ]).toEqual(["zero", "micro", "small", "small", "medium", "medium", "dense"]);
    expect(() => collectionCardinalityClass(-1)).toThrow(/non-negative integer/);
    expect(() => collectionCardinalityClass(1.5)).toThrow(/non-negative integer/);
  });

  it("renders four canonical products as one deliberate wide row and two tablet columns", () => {
    const bracelet: ProductPresentationContext = {
      ...structuredClone(watch),
      productId: "product_bracelet",
      sku: "BRACELET-001",
      title: localized("Harbor bracelet"),
      media: [{ assetId: "asset_bracelet", role: "main", alt: localized("Harbor bracelet") }],
      revision: "product-rev-bracelet",
    };
    const pendant: ProductPresentationContext = {
      ...structuredClone(ring),
      productId: "product_pendant",
      sku: "PENDANT-001",
      title: localized("Harbor pendant"),
      media: [{ assetId: "asset_pendant", role: "main", alt: localized("Harbor pendant") }],
      revision: "product-rev-pendant",
    };
    const fourProducts = [watch, ring, bracelet, pendant];
    const fourProductCollection: CollectionPresentationContext = {
      ...structuredClone(collection),
      collectionId: "collection_harbor",
      title: localized("Harbor collection"),
      assets: [],
      productIds: fourProducts.map(({ productId }) => productId),
      childCollectionIds: [],
      revision: "collection-rev-harbor",
    };
    const input = rendererInput(fourProductCollection);
    input.projection = {
      products: fourProducts,
      collections: [fourProductCollection],
      assets: [
        asset("asset_watch", "productMainImage"),
        asset("asset_ring", "productMainImage"),
        asset("asset_bracelet", "productMainImage"),
        asset("asset_pendant", "productMainImage"),
      ],
      navigation: [],
      projectBrandContexts: [],
      localizedContents: [],
      productListRevision: "product-list-rev-1",
      collectionListRevision: "collection-list-rev-1",
    };
    const rendered = render(renderDynamicCollectionCommerce(input));
    const grid = rendered.container.querySelector('[data-product-count="4"]');
    const cards = [...rendered.container.querySelectorAll("article[data-card-anatomy]")];
    const css = readFileSync(
      "src/components/storefront/dynamic-collection-commerce.module.css",
      "utf8",
    );

    expect(grid).toHaveAttribute("data-wide-grid-columns", "4");
    expect(cards).toHaveLength(4);
    cards.forEach((card) => {
      expect(card.querySelector('[data-card-region="heading"]')).not.toBeNull();
      expect(card.querySelector('[data-card-region="price"]')).not.toBeNull();
      expect(card.querySelector('[data-card-region="actions"]')).not.toBeNull();
    });
    expect(css).toMatch(
      /@media \(min-width: 48rem\)[\s\S]*\.productGrid\s*\{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: 80rem\)[\s\S]*data-wide-grid-columns="4"[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/,
    );
  });

  it("bounds eligible non-merchant-specific facets behind progressive disclosure", async () => {
    const user = userEvent.setup();
    const contextualFilters: CollectionPresentationContext["filters"] = [
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `facet_${index + 1}`,
        label: localized(`Facet ${index + 1}`),
        presentation: "enumerated" as const,
        values: [
          { id: `facet_${index + 1}_a`, label: localized("First"), count: 1 },
          { id: `facet_${index + 1}_b`, label: localized("Second"), count: 1 },
          ...(index === 0
            ? [
                {
                  id: "facet_1_unavailable",
                  label: localized("Unavailable value"),
                  count: 0,
                },
              ]
            : []),
        ],
      })),
      {
        id: "length",
        label: localized("Length"),
        presentation: "range",
        values: [],
        range: { min: 1, max: 10, unit: localized("cm") },
      },
      {
        id: "constant_facet",
        label: localized("Constant facet"),
        presentation: "enumerated",
        values: [{ id: "constant", label: localized("Same"), count: 2 }],
      },
      {
        id: "constant_range",
        label: localized("Constant range"),
        presentation: "range",
        values: [],
        range: { min: 10, max: 10 },
      },
    ];
    const contextualCollection = {
      ...structuredClone(collection),
      collectionId: "collection_contextual_facets",
      filters: contextualFilters,
      revision: "collection-rev-contextual-facets",
    };
    const rendered = render(renderDynamicCollectionCommerce(rendererInput(contextualCollection)));
    const toolbar = rendered.container.querySelector('[data-layout-region="filters"]');

    expect(toolbar).toHaveAttribute("data-eligible-filter-count", "8");
    expect(toolbar).toHaveAttribute("data-primary-filter-count", "4");
    expect(toolbar).toHaveAttribute("data-additional-filter-count", "4");
    expect(rendered.container.querySelectorAll("fieldset[data-filter-id]")).toHaveLength(4);
    expect(rendered.container.querySelector('[data-filter-id="facet_1"]')).toHaveAttribute(
      "data-filter-value-count",
      "2",
    );
    expect(screen.queryByText("Unavailable value")).not.toBeInTheDocument();
    expect(rendered.container.querySelector('[data-filter-id="constant_facet"]')).toBeNull();
    expect(rendered.container.querySelector('[data-filter-id="constant_range"]')).toBeNull();

    const filterDisclosure = screen.getByRole("button", { name: /Show more filters/ });
    const controlledFilterGroups = filterDisclosure.getAttribute("aria-controls");
    expect(filterDisclosure).toHaveAttribute("aria-expanded", "false");
    expect(controlledFilterGroups).toBeTruthy();
    expect(document.getElementById(controlledFilterGroups!)).not.toBeNull();

    await user.click(filterDisclosure);
    expect(screen.getByRole("button", { name: /Show fewer filters/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(rendered.container.querySelectorAll("fieldset[data-filter-id]")).toHaveLength(8);
    expect(
      screen
        .getByRole("region", { name: "Product details" })
        .querySelector('[data-filter-id="length"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("region", { name: "Price" })).not.toBeInTheDocument();
  });

  it("uses one image-led campaign placement when adjacent approved media resolve identically", () => {
    const campaignCollection = {
      ...structuredClone(collection),
      assets: [
        { assetId: "asset_collection", role: "hero" as const },
        { assetId: "asset_editorial", role: "editorial" as const },
      ],
    };
    const input = rendererInput(campaignCollection, {
      resolveAssetUrl: (assetId) =>
        ["asset_collection", "asset_editorial"].includes(assetId)
          ? "/assets/shared-campaign.jpg"
          : `/assets/${assetId}.jpg`,
    });
    input.instance = instance(campaignCollection, { variant: "campaignLedDiscovery" });
    input.projection = {
      ...(input.projection as Record<string, unknown>),
      assets: [...assets, asset("asset_editorial", "editorialImage")],
    };
    const rendered = render(renderDynamicCollectionCommerce(input));

    expect(
      rendered.container.querySelector('[data-layout-region="campaign-lead"]'),
    ).toHaveAttribute("data-asset-id", "asset_editorial");
    expect(rendered.container.querySelector("[data-collection-hero-treatment]")).toHaveAttribute(
      "data-collection-hero-treatment",
      "text-only-adjacent-media-deduped",
    );
    expect(rendered.container.querySelector('[data-asset-id="asset_collection"]')).toBeNull();
    expect(screen.getAllByRole("heading", { name: "All products" })).toHaveLength(1);
  });

  it("prioritizes only the campaign lead when distinct approved header media is also present", () => {
    const campaignCollection = {
      ...structuredClone(collection),
      assets: [
        { assetId: "asset_collection", role: "hero" as const },
        { assetId: "asset_editorial", role: "editorial" as const },
      ],
    };
    const input = rendererInput(campaignCollection);
    input.instance = instance(campaignCollection, { variant: "campaignLedDiscovery" });
    input.projection = {
      ...(input.projection as Record<string, unknown>),
      assets: [...assets, asset("asset_editorial", "editorialImage")],
    };
    const rendered = render(renderDynamicCollectionCommerce(input));
    const headerImage = rendered.container.querySelector(
      '[data-collection-hero-treatment="media"] img',
    );
    const campaignImage = rendered.container.querySelector(
      '[data-layout-region="campaign-lead"] img',
    );

    expect(headerImage).toHaveAttribute("fetchpriority", "auto");
    expect(campaignImage).toHaveAttribute("fetchpriority", "high");
    expect(rendered.container.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
  });

  it("places horizontal filters and products on explicit full-width desktop rows", () => {
    const input = rendererInput();
    input.instance = instance(collection, {
      props: { ...dynamicCollectionCommerceDefaultProps, filterLayout: "horizontal" },
    });
    const rendered = render(renderDynamicCollectionCommerce(input));
    const layout = rendered.container.querySelector('[data-filter-layout="horizontal"]')!;
    const regions = layout.querySelectorAll("[data-layout-region]");
    const css = readFileSync(
      "src/components/storefront/dynamic-collection-commerce.module.css",
      "utf8",
    );

    expect(layout.className).toMatch(/layout_horizontal/);
    expect(regions[0]).toHaveAttribute("data-layout-region", "filters");
    expect(regions[1]).toHaveAttribute("data-layout-region", "products");
    expect(css).toContain(".layout_horizontal > .filterToolbar");
    expect(css).toContain(".layout_horizontal > .productResults");
    expect(css).toMatch(/\.layout_horizontal[^}]*grid-template-columns: minmax\(0, 1fr\)/s);
  });

  it("preserves the explicit sidebar and product-column desktop layout", () => {
    const rendered = render(renderDynamicCollectionCommerce(rendererInput()));
    const layout = rendered.container.querySelector('[data-filter-layout="sidebar"]')!;
    const css = readFileSync(
      "src/components/storefront/dynamic-collection-commerce.module.css",
      "utf8",
    );

    expect(layout.className).toMatch(/layout_sidebar/);
    expect(css).toMatch(
      /\.layout_sidebar[^}]*grid-template-columns: minmax\(14rem, 0\.25fr\) minmax\(0, 1fr\)/s,
    );
  });

  it("keeps protected commerce facts outside editable schemas and rejects unknown props", () => {
    const editablePaths = dynamicCollectionCommerceDefinition.editablePresentationFields.map(
      (field) => field.path,
    );
    expect(editablePaths.filter((path) => /^(?:bindings|commerce)\./.test(path))).toEqual([]);
    expect(dynamicCollectionCommerceDefinition.protectedFields.readOnlyPaths).toEqual(
      expect.arrayContaining([
        "bindings.collection.productIds",
        "bindings.product.price",
        "commerce.product.sku",
        "assets.*.provenance",
      ]),
    );
    expect(() =>
      veskifyComponentRegistryV2.validateInstance(
        instance(collection, {
          props: { ...dynamicCollectionCommerceDefaultProps, merchantProductArray: [] },
        }),
      ),
    ).toThrow(/Invalid component props/i);
    expect(() =>
      veskifyComponentRegistryV2.validateInstance(
        instance(collection, {
          content: { ...dynamicCollectionCommerceDefaultContent, productPrice: "€1" },
        }),
      ),
    ).toThrow(/Invalid component content/i);
  });

  it("documents the registered collection binding and typed-intent contract", () => {
    const sdd = readFileSync("docs/VESKIFY_SDD.md", "utf8");
    expect(sdd).toContain("Registered `dynamicCollectionCommerce` contract");
    expect(sdd).toContain("`primaryCollection`");
    expect(sdd).toContain("`collectionProducts`");
    expect(sdd).toContain("typed presentation intents");
  });
});
