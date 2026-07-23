import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CollectionPreviewClient } from "@/app/projects/[projectId]/collections/[collectionSlug]/collection-preview-client";
import { ProductPreviewClient } from "@/app/projects/[projectId]/products/[productSlug]/product-preview-client";
import {
  createCatalogueStorefrontCommerceRouteAdapter,
  type StorefrontCommerceRouteAdapter,
} from "@/integrations/storefront-commerce-routes";
import { aurumNordicSeed } from "@/data/seed";
import type { ProductPrimaryActionIntent } from "@/components/storefront/dynamic-product-detail";
import type {
  CollectionFilterIntent,
  CollectionSortIntent,
} from "@/components/storefront/dynamic-collection-commerce";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";

function aggregate(): ProjectAggregate {
  return {
    project: structuredClone(aurumNordicSeed.project),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    snapshots: [
      structuredClone(aurumNordicSeed.publishedSnapshot),
      structuredClone(aurumNordicSeed.draftSnapshot),
    ],
  };
}

function repository(value: ProjectAggregate): ProjectRepository {
  return {
    list: vi.fn(),
    get: vi.fn(() => Promise.resolve(value)),
    create: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    restore: vi.fn(),
  };
}

function pointProductPageAt(value: ProjectAggregate, productId: string, slug: string) {
  value.snapshots.forEach((snapshot) => {
    const page = snapshot.pages.find((candidate) => candidate.type === "product")!;
    page.slug = `/products/${slug}`;
    page.sections.forEach((section) => {
      if (["productGallery", "productInfo", "productOptions"].includes(section.component)) {
        section.content.productId = productId;
      }
      if (section.component === "relatedProducts") section.content.productIds = [];
    });
  });
}

function renderProduct(
  value: ProjectAggregate,
  slug = "aurora-ring-585",
  options: {
    snapshotKind?: "draft" | "published";
    commerceAdapter?: StorefrontCommerceRouteAdapter;
    onPrimaryAction?: (intent: ProductPrimaryActionIntent) => void;
  } = {},
) {
  return render(
    <ProductPreviewClient
      commerceAdapter={options.commerceAdapter}
      onPrimaryAction={options.onPrimaryAction}
      productId={value.project.id}
      productSlug={slug}
      repositoryFactory={() => repository(value)}
      snapshotKind={options.snapshotKind}
    />,
  );
}

function renderCollection(
  value: ProjectAggregate,
  options: {
    snapshotKind?: "draft" | "published";
    commerceAdapter?: StorefrontCommerceRouteAdapter;
    onFilterIntent?: (intent: CollectionFilterIntent) => void;
    onSortIntent?: (intent: CollectionSortIntent) => void;
  } = {},
) {
  return render(
    <CollectionPreviewClient
      collectionSlug="rings"
      commerceAdapter={options.commerceAdapter}
      onFilterIntent={options.onFilterIntent}
      onSortIntent={options.onSortIntent}
      projectId={value.project.id}
      repositoryFactory={() => repository(value)}
      snapshotKind={options.snapshotKind}
    />,
  );
}

const localized = (en: string, fi = en) => ({ en, fi });

function draftFor(value: ProjectAggregate) {
  return value.snapshots.find((snapshot) => snapshot.id === value.project.draftSnapshotId)!;
}

function productPageFor(value: ProjectAggregate) {
  return draftFor(value).pages.find((page) => page.type === "product")!;
}

function collectionPageFor(value: ProjectAggregate) {
  return draftFor(value).pages.find((page) => page.type === "collection")!;
}

function defaultProductPresentation(value: ProjectAggregate) {
  const page = productPageFor(value);
  const productId = page.sections.find((section) => section.component === "productInfo")!.content
    .productId;
  const product = value.catalogue.products.find((candidate) => candidate.id === productId)!;
  return createCatalogueStorefrontCommerceRouteAdapter().product({
    aggregate: value,
    snapshot: draftFor(value),
    page,
    product,
  });
}

function defaultCollectionPresentation(value: ProjectAggregate) {
  const collection = value.catalogue.collections[0];
  return createCatalogueStorefrontCommerceRouteAdapter().collection({
    aggregate: value,
    snapshot: draftFor(value),
    page: collectionPageFor(value),
    collection,
  });
}

describe("P6-06 storefront commerce route integration", () => {
  it.each([
    ["draft", "preview"],
    ["published", "published"],
  ] as const)("renders the shared dynamic PDP at the %s boundary", async (snapshotKind, target) => {
    const value = aggregate();
    renderProduct(value, "aurora-ring-585", { snapshotKind });

    expect(await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
    expect(document.querySelector('[data-component="dynamicProductDetail"]')).toHaveAttribute(
      "data-render-target",
      target,
    );
    expect(screen.getByText("RING-AUR-585")).toBeVisible();
    expect(screen.getByText("Yellow gold", { exact: true })).toBeVisible();
    expect(screen.getByText("14K", { exact: true })).toBeVisible();
    expect(screen.getByLabelText("Price").textContent).toBe("1 290 €");
    const supportingImage = screen.getAllByRole("img", {
      name: "Aurora yellow-gold ring detail",
    })[0];
    expect(supportingImage.closest("figure")).toHaveAttribute(
      "data-asset-provenance",
      "merchantProvided",
    );
    expect(supportingImage.closest("figure")).toHaveAttribute("data-asset-role", "editorialImage");
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("resolves a one-colour watch through canonical variant IDs and updates protected facts", async () => {
    const value = aggregate();
    const watch = value.catalogue.products.find(
      (product) => product.id === "product_sisu_automatic_watch",
    )!;
    watch.compareAtPrice = { amount: 760, currency: "EUR" };
    watch.availabilityLabel = localized("Choose a colour");
    watch.variants = [
      {
        id: "variant_watch_silver",
        label: localized("Silver"),
        attributes: { colour: "silver" },
        price: { amount: 690, currency: "EUR" },
      },
      {
        id: "variant_watch_black",
        label: localized("Black"),
        attributes: { colour: "black" },
        price: { amount: 710, currency: "EUR" },
      },
    ];
    pointProductPageAt(value, watch.id, "sisu-watch");
    const before = structuredClone(watch);
    const presentation = defaultProductPresentation(value);

    expect(presentation?.productContext.optionGroups).toMatchObject([
      {
        label: localized("Colour", "Väri"),
        values: [{ label: localized("Silver", "Hopea") }, { label: localized("Black", "Musta") }],
      },
    ]);
    expect(JSON.stringify(presentation?.productContext.optionGroups)).not.toContain(
      "variant_watch_silver",
    );

    renderProduct(value, "sisu-watch");
    await screen.findByRole("heading", { level: 1, name: "Sisu Automatic Watch" });
    await userEvent.click(screen.getByRole("button", { name: "Black" }));

    await waitFor(() => expect(screen.getByLabelText("Price")).toHaveTextContent("710"));
    expect(screen.getByText(/760/)).toBeVisible();
    expect(screen.getByText("Choose a colour")).toBeVisible();
    expect(watch).toEqual(before);
  });

  it("maps canonical multidimensional variants into separate ordered groups and canonical values", () => {
    const value = aggregate();
    const ring = value.catalogue.products[0];
    ring.orderOptions = [];
    ring.variants = [
      {
        id: "variant_ring_16_yellow",
        label: localized("Size 16, yellow gold"),
        attributes: { ringSize: 16, metalColour: "yellow" },
      },
      {
        id: "variant_ring_16_white",
        label: localized("Size 16, white gold"),
        attributes: { ringSize: 16, metalColour: "white" },
      },
      {
        id: "variant_ring_17_yellow",
        label: localized("Size 17, yellow gold"),
        attributes: { ringSize: 17, metalColour: "yellow" },
      },
    ];

    const presentation = defaultProductPresentation(value);

    expect(presentation?.productContext.optionGroups.map((group) => group.label.en)).toEqual([
      "Ring size",
      "Metal colour",
    ]);
    expect(
      presentation?.productContext.optionGroups.map((group) =>
        group.values.map((option) => option.label.en),
      ),
    ).toEqual([
      ["16", "17"],
      ["Yellow gold", "White gold"],
    ]);
    expect(JSON.stringify(presentation?.productContext.optionGroups)).not.toContain(
      "variant_ring_16_yellow",
    );
  });

  it("keeps products with unsafe or incomplete variant dimensions on the legacy renderer", async () => {
    const value = aggregate();
    const ring = value.catalogue.products[0];
    ring.variants = [
      {
        id: "variant_ring_yellow",
        label: localized("Yellow gold"),
        attributes: { metalColour: "yellow" },
      },
      {
        id: "variant_ring_white_18",
        label: localized("White gold, 18K"),
        attributes: { metalColour: "white", karat: "18K" },
      },
    ];

    expect(defaultProductPresentation(value)).toBeNull();
    renderProduct(value);
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });
    expect(document.querySelector('[data-component="dynamicProductDetail"]')).toBeNull();
    expect(screen.getAllByText("Yellow gold", { exact: true }).length).toBeGreaterThan(0);
  });

  it("renders a complex ring in canonical option order, keeps engraving typeable, and emits intent only", async () => {
    const value = aggregate();
    const ring = value.catalogue.products[0];
    const selectionOptions: Array<[string, string, string[]]> = [
      ["size", "Size", ["16", "17"]],
      ["metal", "Metal colour", ["Yellow", "White"]],
      ["karat", "Karat", ["14", "18"]],
      ["stone", "Stone", ["Diamond", "Sapphire"]],
      ["quality", "Diamond quality", ["SI", "VS"]],
    ];
    ring.orderOptions = selectionOptions.map(([id, label, values]) => ({
      id: `option_${id}`,
      type: "selection" as const,
      label: localized(label),
      required: true,
      values: values.map((value) => localized(value)),
    }));
    ring.orderOptions.push({
      id: "option_engraving",
      type: "text",
      label: localized("Engraving"),
      required: false,
      maxLength: 12,
    });
    const onPrimaryAction = vi.fn<(intent: ProductPrimaryActionIntent) => void>();
    renderProduct(value, "aurora-ring-585", { onPrimaryAction });
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });

    for (const name of ["16", "Yellow", "14", "Diamond", "SI"]) {
      await userEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(screen.queryByText("Updating product options…")).toBeNull());
    }
    const engraving = screen.getByRole("textbox", { name: /Engraving/ });
    fireEvent.change(engraving, { target: { value: "Leo 26" } });
    expect(engraving).toHaveValue("Leo 26");
    await waitFor(() => expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction.mock.calls[0][0].catalogueRevision.length).toBeGreaterThan(0);
    expect(onPrimaryAction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: ring.id,
        textEntries: [{ groupId: "option_engraving", value: "Leo 26" }],
      }),
    );
  });

  it("supports a zero-option product and emits its canonical base-product action", async () => {
    const value = aggregate();
    const watch = value.catalogue.products.find(
      (product) => product.id === "product_sisu_automatic_watch",
    )!;
    pointProductPageAt(value, watch.id, "sisu-watch");
    const onPrimaryAction = vi.fn<(intent: ProductPrimaryActionIntent) => void>();
    renderProduct(value, "sisu-watch", { onPrimaryAction });

    await screen.findByRole("heading", { level: 1, name: "Sisu Automatic Watch" });
    const action = await screen.findByRole("button", { name: "Add to cart" });
    await waitFor(() => expect(action).toBeEnabled());
    await userEvent.click(action);
    expect(onPrimaryAction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: watch.id,
        resolvedConfiguration: { kind: "baseProduct" },
        selectedValues: [],
      }),
    );
  });

  it("preserves the latest safe PDP result when canonical resolution fails", async () => {
    const value = aggregate();
    const baseAdapter = createCatalogueStorefrontCommerceRouteAdapter();
    let calls = 0;
    const adapter: StorefrontCommerceRouteAdapter = {
      collection: (input) => baseAdapter.collection(input),
      product(input) {
        const presentation = baseAdapter.product(input)!;
        return {
          ...presentation,
          resolver: {
            resolve(resolverInput) {
              calls += 1;
              if (calls > 1) throw new Error("resolver detail");
              return presentation.resolver!.resolve(resolverInput);
            },
          },
        };
      },
    };
    renderProduct(value, "aurora-ring-585", { commerceAdapter: adapter });
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });
    await userEvent.click(screen.getByRole("button", { name: "15" }));

    expect(
      await screen.findByText(
        "Product options are temporarily unavailable. Your previous selection is unchanged.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
    expect(screen.queryByText("resolver detail")).toBeNull();
  });

  it("renders canonical collection membership and ordering through preview and published targets", async () => {
    const value = aggregate();
    const preview = renderCollection(value);
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expect(document.querySelector('[data-component="dynamicCollectionCommerce"]')).toHaveAttribute(
      "data-render-target",
      "preview",
    );
    const cards = screen.getAllByRole("button", { name: /Ring/ });
    expect(cards.map((card) => card.textContent)).toEqual(["Aurora Ring 585", "Lumi Halo Ring"]);
    preview.unmount();

    renderCollection(value, { snapshotKind: "published" });
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expect(document.querySelector('[data-component="dynamicCollectionCommerce"]')).toHaveAttribute(
      "data-render-target",
      "published",
    );
    expect(
      screen.getAllByText(/1.?290/).some((element) => element.textContent?.includes("€")),
    ).toBe(true);
    const exactPrices = screen
      .getAllByRole("article")
      .map((article) => article.textContent)
      .filter((text): text is string => text !== null);
    expect(exactPrices.some((text) => text.includes("1 290 €"))).toBe(true);
    expect(exactPrices.some((text) => text.includes("1 890 €"))).toBe(true);
  });

  it("keeps availability IDs canonical while exposing localized EN/FI terminology", () => {
    const presentation = defaultCollectionPresentation(aggregate())!;
    const availabilityFilter = presentation.projection.collections[0].filters.find(
      (filter) => filter.id === "availability",
    )!;

    expect(availabilityFilter.values).toMatchObject([
      {
        id: "availability_instock",
        label: { en: "In stock", fi: "Varastossa" },
      },
      {
        id: "availability_lowstock",
        label: { en: "Limited availability", fi: "Rajoitetusti saatavilla" },
      },
    ]);
    expect(availabilityFilter.values.map((value) => value.label)).not.toContainEqual({
      en: "inStock",
      fi: "inStock",
    });
  });

  it.each([
    "imageText",
    "benefitIcons",
    "productGallery",
    "productInfo",
    "productOptions",
  ] as const)("keeps a product page with repeated %s sections on the V1 fallback", (component) => {
    const value = aggregate();
    const page = productPageFor(value);
    const source = page.sections.find((section) => section.component === component)!;
    page.sections.splice(page.sections.indexOf(source) + 1, 0, {
      ...structuredClone(source),
      id: `${source.id}_duplicate`,
    });

    expect(defaultProductPresentation(value)).toBeNull();
  });

  it.each(["filterBar", "productGrid", "collectionHeader"] as const)(
    "keeps a collection page with repeated %s sections on the V1 fallback",
    (component) => {
      const value = aggregate();
      const page = collectionPageFor(value);
      const source = page.sections.find((section) => section.component === component)!;
      page.sections.splice(page.sections.indexOf(source) + 1, 0, {
        ...structuredClone(source),
        id: `${source.id}_duplicate`,
      });

      expect(defaultCollectionPresentation(value)).toBeNull();
    },
  );

  it("rejects unsupported visible content and out-of-order singleton layouts from V2", () => {
    const unsupported = aggregate();
    const home = draftFor(unsupported).pages.find((page) => page.type === "home")!;
    const unsupportedSection = structuredClone(
      home.sections.find((section) => !["header", "footer"].includes(section.component))!,
    );
    productPageFor(unsupported).sections.splice(-1, 0, unsupportedSection);
    expect(defaultProductPresentation(unsupported)).toBeNull();

    const reordered = aggregate();
    const page = collectionPageFor(reordered);
    const filterIndex = page.sections.findIndex((section) => section.component === "filterBar");
    const [filter] = page.sections.splice(filterIndex, 1);
    page.sections.splice(
      page.sections.findIndex((section) => section.component === "productGrid") + 1,
      0,
      filter,
    );
    expect(defaultCollectionPresentation(reordered)).toBeNull();
  });

  it("suppresses filters when no filter section or no effective canonical values exist", async () => {
    const withoutFilterBar = aggregate();
    withoutFilterBar.snapshots.forEach((snapshot) => {
      const page = snapshot.pages.find((candidate) => candidate.type === "collection")!;
      page.sections = page.sections.filter((section) => section.component !== "filterBar");
    });
    const first = renderCollection(withoutFilterBar);
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expect(screen.queryByText("Show filters")).toBeNull();
    expect(screen.getByLabelText("Sort products")).toBeVisible();
    first.unmount();

    const emptyFilters = aggregate();
    emptyFilters.catalogue.collections[0].productIds.forEach((productId) => {
      const product = emptyFilters.catalogue.products.find(
        (candidate) => candidate.id === productId,
      )!;
      delete product.attributes.metalColour;
    });
    emptyFilters.snapshots.forEach((snapshot) => {
      const page = snapshot.pages.find((candidate) => candidate.type === "collection")!;
      const filter = page.sections.find((section) => section.component === "filterBar")!;
      filter.content.filters = ["metalColour"];
    });
    renderCollection(emptyFilters);
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expect(screen.queryByText("Show filters")).toBeNull();
    expect(screen.getByLabelText("Sort products")).toBeVisible();
  });

  it("clamps range intents and emits only a supported canonical sort value", async () => {
    const value = aggregate();
    const baseAdapter = createCatalogueStorefrontCommerceRouteAdapter();
    const adapter: StorefrontCommerceRouteAdapter = {
      product: (input) => baseAdapter.product(input),
      collection(input) {
        const base = baseAdapter.collection(input)!;
        const projection = structuredClone(base.projection);
        projection.collections[0].sorting.push({
          id: "price_low",
          label: localized("Price: low to high"),
          default: false,
        });
        return { ...base, projection };
      },
    };
    const onFilterIntent = vi.fn();
    const onSortIntent = vi.fn();
    renderCollection(value, { commerceAdapter: adapter, onFilterIntent, onSortIntent });
    await screen.findByRole("heading", { level: 1, name: "Rings" });

    fireEvent.change(screen.getByRole("slider", { name: "Price minimum" }), {
      target: { value: "99999" },
    });
    const rangeIntent = onFilterIntent.mock.calls[0][0] as CollectionFilterIntent & {
      min: number;
      max: number;
    };
    expect(rangeIntent.min).toBeLessThanOrEqual(rangeIntent.max);
    await userEvent.selectOptions(screen.getByLabelText("Sort products"), "price_low");
    expect(onSortIntent).toHaveBeenCalledWith(
      expect.objectContaining({ sortId: "price_low", collectionId: "collection_rings" }),
    );
  });

  it("renders empty and no-media states safely from a validated V2 route projection", async () => {
    const value = aggregate();
    const baseAdapter = createCatalogueStorefrontCommerceRouteAdapter();
    const emptyAdapter: StorefrontCommerceRouteAdapter = {
      product: (input) => baseAdapter.product(input),
      collection(input) {
        const base = baseAdapter.collection(input)!;
        const projection = structuredClone(base.projection);
        projection.collections[0].productIds = [];
        projection.products = [];
        const instance = structuredClone(base.instance);
        const binding = instance.bindings.find((item) => item.slotId === "collectionProducts")!;
        if (binding.source === "productList") binding.productIds = [];
        return { ...base, instance, projection };
      },
    };
    const empty = renderCollection(value, { commerceAdapter: emptyAdapter });
    expect(await screen.findByText("No products in this collection")).toBeVisible();
    empty.unmount();

    const noMediaAdapter: StorefrontCommerceRouteAdapter = {
      product: (input) => baseAdapter.product(input),
      collection(input) {
        const base = baseAdapter.collection(input)!;
        const projection = structuredClone(base.projection);
        projection.products.forEach((product) => (product.media = []));
        projection.collections[0].assets = [];
        projection.assets = [];
        return { ...base, projection };
      },
    };
    renderCollection(value, { commerceAdapter: noMediaAdapter });
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expect(screen.getAllByText("Product image unavailable")).toHaveLength(2);
  });

  it("rejects invalid V2 bindings and every unapproved route-used asset before rendering", async () => {
    const value = aggregate();
    const baseAdapter = createCatalogueStorefrontCommerceRouteAdapter();
    const invalidAdapter: StorefrontCommerceRouteAdapter = {
      collection: (input) => baseAdapter.collection(input),
      product(input) {
        const base = baseAdapter.product(input)!;
        const instance = structuredClone(base.instance);
        instance.bindings = instance.bindings.filter(
          (binding) => binding.slotId !== "primaryProduct",
        );
        return { ...base, instance };
      },
    };
    const invalid = renderProduct(value, "aurora-ring-585", { commerceAdapter: invalidAdapter });
    expect(
      await screen.findByRole("heading", { name: "Product page could not be displayed" }),
    ).toBeVisible();
    invalid.unmount();

    const rejectedAssetAdapter: StorefrontCommerceRouteAdapter = {
      collection(input) {
        const base = baseAdapter.collection(input)!;
        const projection = structuredClone(base.projection);
        projection.assets[0].approvalStatus = "rejected";
        const instance = structuredClone(base.instance);
        instance.assetAssignments = [
          {
            slotId: "collectionCommerceMedia",
            assetId: projection.assets[0].assetId,
            role: projection.assets[0].role,
          },
        ];
        return { ...base, instance, projection };
      },
      product: (input) => baseAdapter.product(input),
    };
    renderCollection(value, { commerceAdapter: rejectedAssetAdapter });
    expect(
      await screen.findByRole("heading", { name: "Collection could not be displayed" }),
    ).toBeVisible();
  });

  it("preflights implicit PDP, supporting and product-card assets before route success", async () => {
    const value = aggregate();
    const baseAdapter = createCatalogueStorefrontCommerceRouteAdapter();
    const pendingProductAsset: StorefrontCommerceRouteAdapter = {
      collection: (input) => baseAdapter.collection(input),
      product(input) {
        const base = baseAdapter.product(input)!;
        const projection = structuredClone(base.projection);
        projection.assets.find((asset) => asset.role === "editorialImage")!.approvalStatus =
          "pending";
        return { ...base, projection };
      },
    };
    const product = renderProduct(value, "aurora-ring-585", {
      commerceAdapter: pendingProductAsset,
    });
    expect(
      await screen.findByRole("heading", { name: "Product page could not be displayed" }),
    ).toBeVisible();
    product.unmount();

    const rejectedCardAsset: StorefrontCommerceRouteAdapter = {
      product: (input) => baseAdapter.product(input),
      collection(input) {
        const base = baseAdapter.collection(input)!;
        const projection = structuredClone(base.projection);
        projection.assets[0].approvalStatus = "rejected";
        return { ...base, projection };
      },
    };
    renderCollection(value, { commerceAdapter: rejectedCardAsset });
    expect(
      await screen.findByRole("heading", { name: "Collection could not be displayed" }),
    ).toBeVisible();
  });

  it("keeps the legacy renderer available when the adapter reports no V2 support", async () => {
    const value = aggregate();
    const legacyAdapter: StorefrontCommerceRouteAdapter = {
      product: () => null,
      collection: () => null,
    };
    renderProduct(value, "aurora-ring-585", { commerceAdapter: legacyAdapter });
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });
    expect(document.querySelector('[data-component="dynamicProductDetail"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Zoom product image — placeholder" })).toBeVisible();
  });
});
