import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
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
import { createResponsiveImageAuthority } from "@/domain/asset-presentation";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";

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
  const sourceOwnerId =
    assetId === "asset_related_ring"
      ? "product_related_ring"
      : assetId.startsWith("asset_watch")
        ? "product_watch"
        : "product_ring";
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
              componentType: "dynamicProductDetail",
              componentVersion: "2.0.0",
              variant: "balanced",
              anatomyContractVersion: "1.0.0",
              anatomyIdentity: "dynamicProductDetail.anatomy",
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
  const selectedValues = product.selectedValues.flatMap((selection) =>
    "valueId" in selection ? [{ groupId: selection.groupId, valueId: selection.valueId }] : [],
  );
  const textEntryValues = product.selectedValues.flatMap((selection) =>
    "enteredText" in selection
      ? [
          {
            groupId: selection.groupId,
            value: selection.enteredText,
            valid: selection.complete,
            validationMessages: [],
          },
        ]
      : [],
  );
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
    resolvedOptions: {
      productId: product.productId,
      catalogueRevision: product.revision,
      selectedValues,
      textEntryValues,
      incompleteRequiredGroupIds: product.optionGroups.flatMap((optionGroup) => {
        if (!optionGroup.required) return [];
        const completed = product.selectedValues.find(
          (selection) => selection.groupId === optionGroup.id,
        )?.complete;
        return completed ? [] : [optionGroup.id];
      }),
      disabledOptionValues: product.optionGroups.flatMap((optionGroup) =>
        optionGroup.values.flatMap((optionValue) =>
          optionValue.disabled
            ? [
                {
                  groupId: optionGroup.id,
                  valueId: optionValue.id,
                  reasons: ["canonical" as const],
                },
              ]
            : [],
        ),
      ),
      unavailableCombinations: product.unavailableCombinations,
      dependencyState: product.optionGroups.map((optionGroup) => ({
        groupId: optionGroup.id,
        satisfied: true,
        unmetGroupIds: [],
      })),
      resolvedConfiguration: { kind: "baseProduct" },
      displayedPrice: product.price,
      displayedPriceUnavailableReason: product.priceUnavailableReason,
      displayedCompareAtPrice: product.compareAtPrice,
      displayedAvailability: product.availability,
      displayedSku: product.sku,
      selectedMediaReferences: product.media,
      validationWarnings: [],
      canAddToCart: true,
    },
    resolveAssetUrl: (assetId) => `/seed-assets/${assetId}.svg`,
    onSelectOption: vi.fn(),
    onTextOptionChange: vi.fn(),
    onPrimaryAction: vi.fn(),
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
    expect(engraving).toHaveAccessibleDescription(
      /8\/20 characters.*Enter 2-20.*letters, numbers, spaces and common punctuation/i,
    );
    expect(screen.queryByText(/lettersNumbersAndSpaces/i)).not.toBeInTheDocument();
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

  it("renders the selected variant SKU and preserves decorative media semantics", () => {
    const product = structuredClone(watchProduct);
    product.revision = "r".repeat(160);
    product.media[0] = {
      assetId: "asset_watch_main",
      role: "main",
      decorative: true,
    };
    const onPrimaryAction = vi.fn();
    const input = rendererInput(product, { onPrimaryAction });
    input.resolvedOptions = {
      ...input.resolvedOptions,
      resolvedConfiguration: { kind: "variant", variantId: "variant_watch_black" },
      displayedSku: "WATCH-BLACK-001",
      selectedMediaReferences: product.media,
    };
    input.projection = {
      ...(input.projection as object),
      assets: [
        {
          ...asset("asset_watch_main", "productMainImage"),
          alt: undefined,
          decorative: true,
        },
      ],
    };

    const { container } = render(renderDynamicProductDetail(input));

    expect(screen.getByText("WATCH-BLACK-001")).toBeVisible();
    expect(screen.queryByText("WATCH-001")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(onPrimaryAction).toHaveBeenCalledWith(
      expect.objectContaining({ catalogueRevision: product.revision }),
    );
  });

  it("selects the first canonical media item whenever the resolved media order changes", () => {
    const input = rendererInput(ringProduct);
    const { rerender } = render(renderDynamicProductDetail(input));
    expect(document.querySelector("figure[data-asset-id]")).toHaveAttribute(
      "data-asset-id",
      "asset_ring_main",
    );

    input.resolvedOptions = {
      ...input.resolvedOptions,
      selectedMediaReferences: [ringProduct.media[1], ringProduct.media[0]],
    };
    rerender(renderDynamicProductDetail(input));
    expect(document.querySelector("figure[data-asset-id]")).toHaveAttribute(
      "data-asset-id",
      "asset_ring_side",
    );
  });

  it("preserves a chosen thumbnail only while the resolved media fingerprint is unchanged", async () => {
    const input = rendererInput(ringProduct);
    const { rerender } = render(renderDynamicProductDetail(input));
    await userEvent.click(screen.getByRole("button", { name: "View product image 2" }));
    expect(document.querySelector("figure[data-asset-id]")).toHaveAttribute(
      "data-asset-id",
      "asset_ring_side",
    );

    rerender(
      renderDynamicProductDetail({
        ...input,
        resolutionLifecycle: { state: "ready", warnings: [] },
      }),
    );
    expect(document.querySelector("figure[data-asset-id]")).toHaveAttribute(
      "data-asset-id",
      "asset_ring_side",
    );
  });

  it("falls back to the new first media item when the selected thumbnail is removed", async () => {
    const input = rendererInput(ringProduct);
    const { rerender } = render(renderDynamicProductDetail(input));
    await userEvent.click(screen.getByRole("button", { name: "View product image 2" }));

    input.resolvedOptions = {
      ...input.resolvedOptions,
      selectedMediaReferences: [ringProduct.media[0]],
    };
    rerender(renderDynamicProductDetail(input));
    expect(document.querySelector("figure[data-asset-id]")).toHaveAttribute(
      "data-asset-id",
      "asset_ring_main",
    );
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
        maxColumns: 3,
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

  it("deduplicates identical presentation sources without mutating canonical media authority", () => {
    const before = canonicalValueString(ringProduct.media);
    const { container } = render(
      renderDynamicProductDetail(
        rendererInput(ringProduct, {
          resolveAssetUrl: (assetId) =>
            assetId === "asset_ring_main" || assetId === "asset_ring_side"
              ? "/seed-assets/shared-ring.svg"
              : `/seed-assets/${assetId}.svg`,
        }),
      ),
    );

    const gallery = container.querySelector('[aria-label="Product gallery"]');
    expect(gallery).toHaveAttribute("data-canonical-media-count", "2");
    expect(gallery).toHaveAttribute("data-presented-media-count", "1");
    expect(screen.queryByRole("group", { name: "Choose product image" })).not.toBeInTheDocument();
    expect(canonicalValueString(ringProduct.media)).toBe(before);
  });

  it("keeps high-consideration identity and actions in one opening purchase region", () => {
    const input = rendererInput(ringProduct, {
      instance: instance(ringProduct, {
        variant: "editorialSplit",
        content: dynamicProductDetailDefaultContent,
      }),
    });
    const { container } = render(renderDynamicProductDetail(input));

    const opening = container.querySelector('[data-purchase-region="opening"]');
    expect(opening).toHaveAttribute("data-layout-region", "product-purchase-hierarchy");
    expect(within(opening as HTMLElement).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Aurora ring",
    );
    expect(
      within(opening as HTMLElement).getByRole("heading", { name: "Choose product options" }),
    ).toBeVisible();
    expect(
      within(opening as HTMLElement).getByRole("region", { name: "Purchase action" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Specifications" })).toBeVisible();
    expect(container.querySelectorAll("details[data-attribute-count]").length).toBeGreaterThan(0);
    const disclosure = screen.getByLabelText("Materials");
    expect(disclosure.tagName).toBe("SUMMARY");
    expect(disclosure).toHaveAccessibleName("Materials");
    disclosure.focus();
    expect(disclosure).toHaveFocus();
  });

  it("emits exact related-product navigation without mutating commerce or media", async () => {
    const user = userEvent.setup();
    const onNavigateProduct = vi.fn();
    const before = canonicalValueString({ product: ringProduct, relatedProduct: relatedRing });
    const { container } = render(
      renderDynamicProductDetail(rendererInput(ringProduct, { onNavigateProduct })),
    );

    const relatedCard = container.querySelector('[data-product-id="product_related_ring"]');
    if (!(relatedCard instanceof HTMLElement))
      throw new Error("Expected one related-product card.");
    await user.click(within(relatedCard).getByRole("button", { name: "View product" }));

    expect(onNavigateProduct).toHaveBeenCalledTimes(1);
    expect(onNavigateProduct).toHaveBeenCalledWith({
      type: "navigateToProduct",
      productId: "product_related_ring",
      catalogueRevision: "product-rev-related",
    });
    expect(canonicalValueString({ product: ringProduct, relatedProduct: relatedRing })).toBe(
      before,
    );
  });

  it("emits one typed primary-action intent without performing commerce mutations", async () => {
    const user = userEvent.setup();
    const onPrimaryAction = vi.fn();
    render(renderDynamicProductDetail(rendererInput(watchProduct, { onPrimaryAction })));

    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction).toHaveBeenCalledWith({
      type: "activatePrimaryProductAction",
      action: "addToCart",
      productId: "product_watch",
      catalogueRevision: "product-rev-watch",
      resolvedConfiguration: { kind: "baseProduct" },
      selectedValues: [{ groupId: "colour", valueId: "colour_silver" }],
      textEntries: [],
    });
  });

  it("does not emit a primary-action intent while the supplied action is disabled", () => {
    const onPrimaryAction = vi.fn();
    render(
      renderDynamicProductDetail(
        rendererInput(watchProduct, {
          onPrimaryAction,
          primaryAction: {
            enabled: false,
            state: "unavailable",
            message: localized("This product is unavailable."),
          },
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(onPrimaryAction).not.toHaveBeenCalled();
  });

  it("honours supplied unavailable-combination state and never resolves combinations in React", () => {
    const product = structuredClone(watchProduct);
    product.optionGroups[0].values.push(value("colour", "gold"));
    product.unavailableCombinations = [
      {
        selections: [{ groupId: "colour", valueId: "colour_gold" }],
        reason: localized("This colour is unavailable for the current configuration."),
      },
    ];
    const input = rendererInput(product);
    input.resolvedOptions = {
      ...input.resolvedOptions,
      disabledOptionValues: [
        {
          groupId: "colour",
          valueId: "colour_gold",
          reasons: ["unavailableCombination"],
        },
      ],
    };
    const onSelectOption = vi.fn();
    input.onSelectOption = onSelectOption;
    render(renderDynamicProductDetail(input));

    const gold = screen.getByRole("button", { name: "gold" });
    expect(gold).toBeDisabled();
    expect(gold).toHaveAccessibleDescription("Unavailable with the current selection.");
    fireEvent.click(gold);
    expect(onSelectOption).not.toHaveBeenCalled();

    const malformed = rendererInput(product);
    malformed.resolvedOptions = { ...malformed.resolvedOptions, unavailableCombinations: [] };
    expect(() => renderDynamicProductDetail(malformed)).toThrow(
      /must preserve canonical unavailable combinations/i,
    );
  });

  it("renders dependency-blocked controls with accessible guidance and emits no intent", () => {
    const product = structuredClone(ringProduct);
    const karat = product.optionGroups.find((optionGroup) => optionGroup.id === "karat")!;
    karat.dependsOn = [{ groupId: "size" }];
    const input = rendererInput(product);
    input.resolvedOptions = {
      ...input.resolvedOptions,
      dependencyState: input.resolvedOptions.dependencyState.map((state) =>
        state.groupId === "karat"
          ? { groupId: "karat", satisfied: false, unmetGroupIds: ["size"] }
          : state,
      ),
      disabledOptionValues: [
        ...input.resolvedOptions.disabledOptionValues,
        ...karat.values.map((optionValue) => ({
          groupId: "karat",
          valueId: optionValue.id,
          reasons: ["dependency" as const],
        })),
      ],
    };
    const onSelectOption = vi.fn();
    input.onSelectOption = onSelectOption;
    render(renderDynamicProductDetail(input));

    const select = screen.getByRole("combobox", { name: /karat/i });
    expect(select).toBeDisabled();
    expect(select).toHaveAccessibleDescription("Choose first: size.");
    fireEvent.change(select, { target: { value: "karat_18k" } });
    expect(onSelectOption).not.toHaveBeenCalled();
  });

  it("uses supplied resolved selections instead of deriving selection state from the product", () => {
    const product = structuredClone(watchProduct);
    product.optionGroups[0].values.push(value("colour", "gold"));
    const input = rendererInput(product);
    input.resolvedOptions = {
      ...input.resolvedOptions,
      selectedValues: [{ groupId: "colour", valueId: "colour_gold" }],
    };
    render(renderDynamicProductDetail(input));

    expect(screen.getByRole("button", { name: "gold" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "silver" })).toHaveAttribute("aria-pressed", "false");
  });

  it("allows the optional related-products binding to be omitted", () => {
    const input = rendererInput(ringProduct);
    input.instance = instance(ringProduct, {
      bindings: [
        {
          slotId: "primaryProduct",
          source: "product",
          productId: ringProduct.productId,
          revision: ringProduct.revision,
        },
      ],
      assetAssignments: [],
    });
    render(renderDynamicProductDetail(input));

    expect(screen.queryByRole("heading", { name: "Related wedding ring" })).not.toBeInTheDocument();
  });

  it("requires a present related-products binding to match canonical IDs exactly", () => {
    const input = rendererInput(ringProduct);
    input.projection = {
      ...(input.projection as object),
      products: [ringProduct, relatedRing, watchProduct],
    };
    input.instance = instance(ringProduct, {
      bindings: [
        {
          slotId: "primaryProduct",
          source: "product",
          productId: ringProduct.productId,
          revision: ringProduct.revision,
        },
        {
          slotId: "relatedProducts",
          source: "productList",
          productIds: [watchProduct.productId],
          revision: "product-list-rev-1",
        },
      ],
    });

    expect(() => renderDynamicProductDetail(input)).toThrow(/must exactly match/i);
  });

  it("localizes every text character policy in EN and FI without exposing enum names", () => {
    const policies = [
      {
        policy: "unicodeText" as const,
        en: "standard symbols",
        fi: "tavallisia symboleita",
      },
      {
        policy: "lettersAndSpaces" as const,
        en: "apostrophes and hyphens only",
        fi: "heittomerkkejä ja yhdysmerkkejä",
      },
      {
        policy: "lettersNumbersAndSpaces" as const,
        en: "common punctuation only",
        fi: "yleisiä välimerkkejä",
      },
      {
        policy: "asciiPrintable" as const,
        en: "standard Latin letters",
        fi: "latinalaisia peruskirjaimia",
      },
    ];

    for (const { policy, en, fi } of policies) {
      const product = structuredClone(ringProduct);
      product.optionGroups.find(
        (optionGroup) => optionGroup.id === "engraving",
      )!.textEntryConstraints!.characterPolicy = policy;
      const engravingSelection = product.selectedValues.find(
        (selection) => selection.groupId === "engraving",
      );
      if (engravingSelection && "enteredText" in engravingSelection) {
        engravingSelection.enteredText = "Leo";
      }
      const english = render(renderDynamicProductDetail(rendererInput(product)));
      expect(screen.getByRole("textbox", { name: /engraving/i })).toHaveAccessibleDescription(
        new RegExp(en, "i"),
      );
      expect(english.container).not.toHaveTextContent(policy);
      english.unmount();

      const finnish = render(
        renderDynamicProductDetail(
          rendererInput(product, { activeLocale: "fi", primaryLocale: "fi" }),
        ),
      );
      expect(screen.getByRole("textbox", { name: /engraving/i })).toHaveAccessibleDescription(
        new RegExp(fi, "i"),
      );
      expect(finnish.container).not.toHaveTextContent(policy);
      finnish.unmount();
    }
  });

  it("rejects unknown text character policies at the canonical schema boundary", () => {
    const invalid = structuredClone(ringProduct);
    Object.assign(
      invalid.optionGroups.find((optionGroup) => optionGroup.id === "engraving")!
        .textEntryConstraints!,
      { characterPolicy: "rawDeveloperPolicy" },
    );

    expect(() => renderDynamicProductDetail(rendererInput(invalid))).toThrow();
  });

  it("uses explicit approved media assignments and approved canonical fallback media", () => {
    const explicit = render(renderDynamicProductDetail(rendererInput(watchProduct)));
    expect(explicit.container.querySelector('[data-asset-id="asset_watch_main"]')).toBeVisible();
    explicit.unmount();

    const fallback = rendererInput(watchProduct);
    fallback.instance = instance(watchProduct, { assetAssignments: [] });
    const renderedFallback = render(renderDynamicProductDetail(fallback));
    expect(
      renderedFallback.container.querySelector('[data-asset-id="asset_watch_main"]'),
    ).toHaveAttribute("data-asset-provenance", "canonicalProductMedia");
  });

  it("rejects unknown or unapproved fallback media while zero-media products render safely", () => {
    const unknown = rendererInput(watchProduct);
    unknown.instance = instance(watchProduct, { assetAssignments: [] });
    unknown.projection = { ...(unknown.projection as object), assets: [] };
    expect(() => renderDynamicProductDetail(unknown)).toThrow(/missing from inventory/i);

    const unapproved = rendererInput(watchProduct);
    unapproved.instance = instance(watchProduct, { assetAssignments: [] });
    unapproved.projection = {
      ...(unapproved.projection as object),
      assets: [asset("asset_watch_main", "productMainImage", "rejected")],
    };
    expect(() => renderDynamicProductDetail(unapproved)).toThrow(/not approved/i);

    const product = structuredClone(watchProduct);
    product.productId = "product_no_media";
    product.revision = "product-rev-no-media";
    product.media = [];
    const noMedia = rendererInput(product);
    noMedia.instance = instance(product, { assetAssignments: [] });
    render(renderDynamicProductDetail(noMedia));
    expect(screen.getByText("Product media is unavailable.")).toBeVisible();
  });

  it("documents the final dynamicProductDetail binding and renderer contract", () => {
    const sdd = readFileSync("docs/VESKIFY_SDD.md", "utf8");

    expect(sdd).toContain("Registered `dynamicProductDetail` contract");
    expect(sdd).toContain("`primaryProduct`");
    expect(sdd).toContain("`relatedProducts`");
    expect(sdd).toContain("`productMedia`");
    expect(sdd).toContain("primary-action intent");
    expect(sdd).toContain("P6 option-resolution engine");
  });
});
