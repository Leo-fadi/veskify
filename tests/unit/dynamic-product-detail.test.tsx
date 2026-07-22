import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  dynamicProductDetailComponentByTarget,
  renderDynamicProductDetail,
  type DynamicProductDetailRendererInput,
} from "@/components/storefront/dynamic-product-detail";
import {
  dynamicProductDetailDefaultContent,
  dynamicProductDetailDefaultProps,
  dynamicProductDetailDefaultStyleOverrides,
  dynamicProductDetailDefinition,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import type {
  ProductPresentationContext,
  StorefrontAssetMetadata,
} from "@/domain/component-platform";

const localized = (en: string, fi = en) => ({ en, fi });

function value(
  groupId: string,
  id: string,
  overrides: Partial<ProductPresentationContext["optionGroups"][number]["values"][number]> = {},
) {
  return {
    id: `${groupId}_${id}`,
    label: localized(id.replaceAll("_", " ")),
    value: id,
    disabled: false,
    metadata: {},
    ...overrides,
  };
}

function group(
  id: string,
  presentation: "swatch" | "buttonGroup" | "dropdown" | "imageChoice" | "radio",
  values: ProductPresentationContext["optionGroups"][number]["values"],
  overrides: Partial<ProductPresentationContext["optionGroups"][number]> = {},
) {
  return {
    id,
    label: localized(id.replaceAll("_", " ")),
    source: "variantDimension" as const,
    required: true,
    presentation,
    values,
    dependsOn: [],
    ...overrides,
  };
}

const watchProduct: ProductPresentationContext = {
  productId: "product_watch",
  productTypeId: "watch",
  sku: "WATCH-001",
  title: localized("Nordic field watch"),
  description: localized("A compact everyday watch."),
  price: { amount: 349, currency: "EUR", formatted: localized("€349") },
  compareAtPrice: { amount: 399, currency: "EUR", formatted: localized("€399") },
  availability: localized("In stock"),
  media: [{ assetId: "asset_watch_main", role: "main", alt: localized("Silver watch") }],
  attributeGroups: [
    {
      id: "watch_specs",
      title: localized("Technical details"),
      attributes: [{ id: "movement", label: localized("Movement"), value: localized("Automatic") }],
    },
  ],
  optionGroups: [
    group("colour", "swatch", [value("colour", "silver", { swatch: { color: "#D8D8D8" } })], {
      selectedValueId: "colour_silver",
    }),
  ],
  selectedValues: [{ groupId: "colour", valueId: "colour_silver", complete: true }],
  unavailableCombinations: [],
  relatedProductIds: [],
  revision: "product-rev-watch",
};

const ringProduct: ProductPresentationContext = {
  productId: "product_ring",
  productTypeId: "ring",
  sku: "RING-CONFIGURABLE",
  title: localized("Aurora ring"),
  price: { amount: 1290, currency: "EUR", formatted: localized("From €1,290") },
  availability: localized("Made to order"),
  media: [
    { assetId: "asset_ring_main", role: "main", alt: localized("Gold ring") },
    { assetId: "asset_ring_side", role: "alternative", alt: localized("Ring side view") },
  ],
  attributeGroups: [
    {
      id: "materials",
      title: localized("Materials"),
      attributes: [
        { id: "origin", label: localized("Gold origin"), value: localized("Recycled gold") },
      ],
    },
  ],
  optionGroups: [
    group("size", "buttonGroup", [value("size", "16"), value("size", "17")]),
    group("metal_colour", "swatch", [
      value("metal_colour", "yellow_gold", { swatch: { color: "#C2A35A" } }),
      value("metal_colour", "white_gold", {
        swatch: { color: "#D8D8D8" },
        disabled: true,
        unavailableReason: localized("Unavailable with the current selection"),
      }),
    ]),
    group("karat", "dropdown", [value("karat", "14k"), value("karat", "18k")]),
    group("stone", "imageChoice", [
      value("stone", "diamond", { swatch: { assetId: "asset_stone_diamond" } }),
      value("stone", "sapphire", { swatch: { assetId: "asset_stone_sapphire" } }),
    ]),
    group("diamond_quality", "radio", [
      value("diamond_quality", "si"),
      value("diamond_quality", "vs"),
    ]),
    {
      id: "engraving",
      label: localized("Engraving"),
      source: "orderOption",
      required: false,
      presentation: "textInput",
      values: [],
      dependsOn: [],
      textEntryConstraints: {
        maxLength: 20,
        minLength: 2,
        characterPolicy: "lettersNumbersAndSpaces",
        placeholder: localized("Initials or short message"),
      },
      helpText: localized("Optional personalisation"),
    },
  ],
  selectedValues: [
    { groupId: "size", valueId: "size_16", complete: true },
    { groupId: "metal_colour", valueId: "metal_colour_yellow_gold", complete: true },
    { groupId: "engraving", enteredText: "Leo 2026", complete: true },
  ],
  unavailableCombinations: [],
  relatedProductIds: ["product_related_ring"],
  revision: "product-rev-ring",
};

const relatedRing: ProductPresentationContext = {
  ...structuredClone(watchProduct),
  productId: "product_related_ring",
  productTypeId: "ring",
  sku: "RING-RELATED",
  title: localized("Related wedding ring"),
  media: [{ assetId: "asset_related_ring", role: "main", alt: localized("Wedding ring") }],
  optionGroups: [],
  selectedValues: [],
  relatedProductIds: [],
  revision: "product-rev-related",
};

function asset(
  assetId: string,
  role: StorefrontAssetMetadata["role"],
  approvalStatus: StorefrontAssetMetadata["approvalStatus"] = "approved",
): StorefrontAssetMetadata {
  return {
    assetId,
    role,
    alt: localized(`${assetId} alt`),
    decorative: false,
    provenance: { kind: "canonicalProductMedia", sourceId: `source_${assetId}` },
    approvalStatus,
    usageRights: "merchantOwned",
    responsiveCrops: [],
    revision: `revision_${assetId}`,
  };
}

const allAssets = [
  asset("asset_watch_main", "productMainImage"),
  asset("asset_ring_main", "productMainImage"),
  asset("asset_ring_side", "productAlternativeImage"),
  asset("asset_stone_diamond", "productAlternativeImage"),
  asset("asset_stone_sapphire", "productAlternativeImage"),
  asset("asset_related_ring", "productMainImage"),
];

function assetAssignments(product: ProductPresentationContext) {
  const related = product.relatedProductIds.includes(relatedRing.productId) ? [relatedRing] : [];
  const entries = [
    ...product.media.map((media) => ({
      assetId: media.assetId,
      role:
        media.role === "main"
          ? ("productMainImage" as const)
          : media.role === "editorial"
            ? ("editorialImage" as const)
            : ("productAlternativeImage" as const),
    })),
    ...product.optionGroups.flatMap((optionGroup) =>
      optionGroup.values.flatMap((optionValue) =>
        optionValue.swatch?.assetId
          ? [
              {
                assetId: optionValue.swatch.assetId,
                role: "productAlternativeImage" as const,
              },
            ]
          : [],
      ),
    ),
    ...related.flatMap((item) =>
      item.media.slice(0, 1).map((media) => ({
        assetId: media.assetId,
        role: "productMainImage" as const,
      })),
    ),
  ];
  return entries.map((entry) => ({ slotId: "productMedia", ...entry }));
}

function instance(product: ProductPresentationContext, overrides: Record<string, unknown> = {}) {
  return {
    id: `section_${product.productId}`,
    component: "dynamicProductDetail",
    componentVersion: { major: 2, minor: 0, patch: 0 },
    variant: "balanced",
    content: {
      ...dynamicProductDetailDefaultContent,
      supportingHeading: localized("Service and support"),
      supportingBody: localized("Contact the merchant for product guidance."),
      trustItems: [{ id: "trust_care", title: localized("Product care") }],
    },
    props: dynamicProductDetailDefaultProps,
    styleOverrides: dynamicProductDetailDefaultStyleOverrides,
    bindings: [
      {
        slotId: "primaryProduct",
        source: "product",
        productId: product.productId,
        revision: product.revision,
      },
      ...(product.relatedProductIds.length
        ? [
            {
              slotId: "relatedProducts",
              source: "productList",
              productIds: product.relatedProductIds,
              revision: "product-list-rev-1",
            },
          ]
        : []),
    ],
    assetAssignments: assetAssignments(product),
    ...overrides,
  };
}

function rendererInput(
  product: ProductPresentationContext,
  overrides: Partial<DynamicProductDetailRendererInput> = {},
): DynamicProductDetailRendererInput {
  return {
    target: "preview",
    instance: instance(product),
    projection: {
      products: [product, ...(product.relatedProductIds.length ? [relatedRing] : [])],
      collections: [],
      assets: allAssets,
      navigation: [],
      projectBrandContexts: [],
      localizedContents: [],
      productListRevision: "product-list-rev-1",
    },
    activeLocale: "en",
    primaryLocale: "en",
    primaryAction: { enabled: true, state: "ready" },
    resolveAssetUrl: (assetId) => `/seed-assets/${assetId}.svg`,
    onSelectOption: vi.fn(),
    onTextOptionChange: vi.fn(),
    ...overrides,
  };
}

describe("P6-02 dynamic product-detail component family", () => {
  it("renders a simple watch with one colour option and no jewellery assumptions", () => {
    const input = rendererInput(watchProduct);
    render(renderDynamicProductDetail(input));

    expect(screen.getByRole("heading", { level: 1, name: "Nordic field watch" })).toBeVisible();
    expect(screen.getByRole("group", { name: /colour/i })).toBeVisible();
    expect(screen.getByRole("button", { name: "silver" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/ring size/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/karat/i)).not.toBeInTheDocument();
    expect(screen.getByText("Automatic")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });

  it("renders every complex ring option group in canonical order", () => {
    const { container } = render(
      renderDynamicProductDetail(
        rendererInput(ringProduct, {
          primaryAction: {
            enabled: false,
            state: "incomplete",
            message: localized("Choose every required option."),
          },
        }),
      ),
    );

    expect(
      Array.from(container.querySelectorAll<HTMLElement>("[data-option-group-id]")).map(
        (element) => element.dataset.optionGroupId,
      ),
    ).toEqual(["size", "metal_colour", "karat", "stone", "diamond_quality", "engraving"]);
    expect(screen.getByRole("combobox", { name: /karat/i })).toBeVisible();
    expect(screen.getByRole("radio", { name: "si" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: /engraving/i })).toBeVisible();
    expect(screen.getByText("From €1,290")).toBeVisible();
    expect(screen.getByText("Made to order")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(screen.getByText("Choose every required option.")).toBeVisible();
  });

  it("renders a zero-option product without an empty complex selector shell", () => {
    const product = {
      ...structuredClone(watchProduct),
      productId: "product_simple",
      productTypeId: "future_product_type",
      sku: "SIMPLE-001",
      title: localized("Simple pendant"),
      optionGroups: [],
      selectedValues: [],
      revision: "product-rev-simple",
    };
    render(renderDynamicProductDetail(rendererInput(product)));

    expect(screen.getByRole("heading", { level: 1, name: "Simple pendant" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Choose product options" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });

  it("does not emit selection intent for a disabled canonical value", () => {
    const onSelectOption = vi.fn();
    render(
      renderDynamicProductDetail(
        rendererInput(ringProduct, {
          onSelectOption,
          primaryAction: {
            enabled: false,
            state: "incomplete",
            message: localized("Choose every required option."),
          },
        }),
      ),
    );
    const disabled = screen.getByRole("button", { name: "white gold" });

    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAccessibleDescription("Unavailable with the current selection");
    fireEvent.click(disabled);
    expect(onSelectOption).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  });

  it("associates text-entry constraints with supplied state and emits text intent only", () => {
    const onTextOptionChange = vi.fn();
    render(renderDynamicProductDetail(rendererInput(ringProduct, { onTextOptionChange })));
    const engraving = screen.getByRole("textbox", { name: /engraving/i });

    expect(engraving).toHaveValue("Leo 2026");
    expect(engraving).toHaveAttribute("maxlength", "20");
    expect(engraving).toHaveAttribute("minlength", "2");
    expect(engraving).toHaveAccessibleDescription(/8\/20.*lettersNumbersAndSpaces/i);
    fireEvent.change(engraving, { target: { value: "LF 2026" } });
    expect(onTextOptionChange).toHaveBeenCalledWith("engraving", "LF 2026");
  });

  it("renders protected price, compare-at price, identity and SKU only from context", () => {
    const { rerender } = render(renderDynamicProductDetail(rendererInput(watchProduct)));

    expect(screen.getByText("€349")).toBeVisible();
    expect(screen.getByText("€399").tagName).toBe("DEL");
    expect(screen.getByText("WATCH-001")).toBeVisible();
    const changed = {
      ...structuredClone(watchProduct),
      price: { amount: 329, currency: "EUR", formatted: localized("€329") },
      compareAtPrice: undefined,
      availability: localized("Limited availability"),
    };
    rerender(renderDynamicProductDetail(rendererInput(changed)));
    expect(screen.getByText("€329")).toBeVisible();
    expect(screen.getByText("Limited availability")).toBeVisible();
    expect(screen.queryByText("€399")).not.toBeInTheDocument();
  });

  it("keeps product identity, SKU and all commerce truth outside editable fields", () => {
    const editablePaths = dynamicProductDetailDefinition.editablePresentationFields.map(
      (field) => field.path,
    );

    expect(editablePaths.filter((path) => /^(?:bindings|commerce)\./.test(path))).toEqual([]);
    expect(editablePaths).not.toEqual(
      expect.arrayContaining([
        "content.sku",
        "content.price",
        "content.productId",
        "props.sku",
        "props.price",
        "props.productId",
      ]),
    );
    expect(dynamicProductDetailDefinition.protectedFields.readOnlyPaths).toEqual(
      expect.arrayContaining([
        "bindings.product.productId",
        "bindings.product.sku",
        "bindings.product.price",
        "commerce.product.selectedValues",
        "assets.*.provenance",
      ]),
    );
    expect(() =>
      veskifyComponentRegistryV2.validateInstance(
        instance(watchProduct, {
          content: { ...dynamicProductDetailDefaultContent, sku: "EDITED" },
        }),
      ),
    ).toThrow(/Invalid component content/i);
  });

  it("rejects unknown props, invalid style values and unsupported variants", () => {
    expect(() =>
      veskifyComponentRegistryV2.validateInstance(
        instance(watchProduct, {
          props: { ...dynamicProductDetailDefaultProps, productTypeLayout: "ring" },
        }),
      ),
    ).toThrow(/Invalid component props/i);
    expect(() =>
      veskifyComponentRegistryV2.validateInstance(
        instance(watchProduct, { styleOverrides: { surfaceTreatment: "merchantCss" } }),
      ),
    ).toThrow(/Invalid component styleOverrides/i);
    expect(() =>
      veskifyComponentRegistryV2.validateInstance(
        instance(watchProduct, { variant: "ringSpecific" }),
      ),
    ).toThrow(/Unsupported/i);
  });

  it("rejects a missing required canonical product binding", () => {
    expect(() =>
      veskifyComponentRegistryV2.validateInstance(instance(watchProduct, { bindings: [] })),
    ).toThrow(/Missing required commerce binding slot: primaryProduct/i);
  });

  it("rejects unknown, unapproved and wrong-role assets before rendering", () => {
    const unknown = rendererInput(watchProduct);
    unknown.projection = { ...(unknown.projection as object), assets: [] };
    expect(() => renderDynamicProductDetail(unknown)).toThrow(/missing from inventory/i);

    const unapproved = rendererInput(watchProduct);
    unapproved.projection = {
      ...(unapproved.projection as object),
      assets: [asset("asset_watch_main", "productMainImage", "pending")],
    };
    expect(() => renderDynamicProductDetail(unapproved)).toThrow(/not approved/i);

    const wrongRole = rendererInput(watchProduct);
    wrongRole.projection = {
      ...(wrongRole.projection as object),
      assets: [asset("asset_watch_main", "editorialImage")],
    };
    expect(() => renderDynamicProductDetail(wrongRole)).toThrow(/role does not match/i);
  });

  it("uses the same implementation for editor, preview and published targets", () => {
    expect(dynamicProductDetailDefinition.renderer.supportedTargets).toEqual([
      "editor",
      "preview",
      "published",
    ]);
    expect(dynamicProductDetailComponentByTarget.editor).toBe(
      dynamicProductDetailComponentByTarget.preview,
    );
    expect(dynamicProductDetailComponentByTarget.preview).toBe(
      dynamicProductDetailComponentByTarget.published,
    );
    for (const target of ["editor", "preview", "published"] as const) {
      const { container, unmount } = render(
        renderDynamicProductDetail(rendererInput(watchProduct, { target })),
      );
      expect(container.querySelector("[data-render-target]")).toHaveAttribute(
        "data-render-target",
        target,
      );
      unmount();
    }
  });

  it("supports keyboard option selection and accessible labels", async () => {
    const user = userEvent.setup();
    const onSelectOption = vi.fn();
    render(renderDynamicProductDetail(rendererInput(watchProduct, { onSelectOption })));
    const silver = screen.getByRole("button", { name: "silver" });

    silver.focus();
    expect(silver).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelectOption).toHaveBeenCalledWith("colour", "colour_silver");
    expect(screen.getByRole("region", { name: "Purchase action" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Product gallery" })).toBeVisible();
  });

  it("uses content-driven responsive contracts rather than fixed product-type layouts", () => {
    const definition = veskifyComponentRegistryV2.get("dynamicProductDetail");
    expect(definition.industryTags).toEqual([]);
    expect(definition.responsiveRules).toEqual([
      expect.objectContaining({
        breakpoints: ["mobile", "tablet", "desktop", "wide"],
        allowHorizontalOverflow: false,
        maxColumns: 2,
      }),
    ]);

    const watch = render(renderDynamicProductDetail(rendererInput(watchProduct)));
    expect(watch.container.querySelector("[data-responsive-layout]")).toHaveAttribute(
      "data-responsive-layout",
      "content-driven",
    );
    watch.unmount();
    const ring = render(renderDynamicProductDetail(rendererInput(ringProduct)));
    expect(ring.container.querySelector("[data-responsive-layout]")).toHaveAttribute(
      "data-responsive-layout",
      "content-driven",
    );
  });

  it("renders trust content, related products and approved asset provenance", () => {
    const { container } = render(renderDynamicProductDetail(rendererInput(ringProduct)));

    expect(screen.getByRole("heading", { name: "Service and support" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Product care" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Related wedding ring" })).toBeVisible();
    expect(container.querySelector('[data-asset-id="asset_ring_main"]')).toHaveAttribute(
      "data-asset-provenance",
      "canonicalProductMedia",
    );
  });
});
