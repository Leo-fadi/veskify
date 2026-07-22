import {
  dynamicProductDetailDefaultContent,
  dynamicProductDetailDefaultProps,
  dynamicProductDetailDefaultStyleOverrides,
} from "@/components/registry";
import type {
  ProductPresentationContext,
  StorefrontAssetMetadata,
} from "@/domain/component-platform";
import type { CanonicalProductConfigurationResolver } from "@/domain/product-presentation";

export const localized = (en: string, fi = en) => ({ en, fi });

function value(groupId: string, id: string) {
  return {
    id: `${groupId}_${id}`,
    label: localized(id.replaceAll("_", " ")),
    value: id,
    disabled: false,
    metadata: {},
  };
}

function group(
  id: string,
  values: string[],
  options: {
    required?: boolean;
    dependsOn?: Array<{ groupId: string; valueIds?: string[] }>;
    presentation?: "swatch" | "buttonGroup" | "dropdown" | "radio";
  } = {},
) {
  return {
    id,
    label: localized(id.replaceAll("_", " ")),
    source: "variantDimension" as const,
    required: options.required ?? true,
    presentation: options.presentation ?? ("buttonGroup" as const),
    values: values.map((item) => value(id, item)),
    dependsOn: options.dependsOn ?? [],
  };
}

export const watchProductFixture: ProductPresentationContext = {
  productId: "product_watch",
  productTypeId: "watch",
  sku: "WATCH-001",
  title: localized("Nordic field watch"),
  description: localized("A compact everyday watch."),
  price: { amount: 349, currency: "EUR", formatted: localized("€349") },
  compareAtPrice: { amount: 399, currency: "EUR", formatted: localized("€399") },
  availability: localized("Choose a colour"),
  media: [
    {
      assetId: "asset_watch_silver",
      role: "variant",
      alt: localized("Silver watch"),
      variantIds: ["variant_watch_silver"],
    },
    {
      assetId: "asset_watch_black",
      role: "variant",
      alt: localized("Black watch"),
      variantIds: ["variant_watch_black"],
    },
  ],
  attributeGroups: [
    {
      id: "watch_specs",
      title: localized("Technical details"),
      attributes: [{ id: "movement", label: localized("Movement"), value: localized("Automatic") }],
    },
  ],
  optionGroups: [group("colour", ["silver", "black"], { presentation: "swatch" })],
  selectedValues: [],
  unavailableCombinations: [],
  relatedProductIds: [],
  revision: "watch-revision-1",
};

export const ringProductFixture: ProductPresentationContext = {
  productId: "product_ring",
  productTypeId: "ring",
  sku: "RING-CONFIGURABLE",
  title: localized("Aurora ring"),
  price: { amount: 1290, currency: "EUR", formatted: localized("From €1,290") },
  availability: localized("Choose options"),
  media: [
    { assetId: "asset_ring_yellow", role: "variant", alt: localized("Yellow-gold ring") },
    { assetId: "asset_ring_white", role: "variant", alt: localized("White-gold ring") },
  ],
  attributeGroups: [],
  optionGroups: [
    group("ring_size", ["16", "17"]),
    group("metal", ["yellow", "white"], { presentation: "swatch" }),
    group("karat", ["14", "18"], { dependsOn: [{ groupId: "metal" }] }),
    group("stone", ["diamond", "sapphire"], {
      dependsOn: [{ groupId: "karat", valueIds: ["karat_14", "karat_18"] }],
    }),
    group("quality", ["si", "vs"], {
      dependsOn: [{ groupId: "stone", valueIds: ["stone_diamond", "stone_sapphire"] }],
      presentation: "radio",
    }),
    {
      id: "engraving",
      label: localized("Engraving"),
      source: "orderOption",
      required: false,
      presentation: "textInput",
      values: [],
      dependsOn: [],
      textEntryConstraints: {
        minLength: 2,
        maxLength: 12,
        characterPolicy: "lettersNumbersAndSpaces",
        placeholder: localized("Initials"),
      },
    },
  ],
  selectedValues: [],
  unavailableCombinations: [
    {
      selections: [
        { groupId: "metal", valueId: "metal_white" },
        { groupId: "karat", valueId: "karat_14" },
      ],
      reason: localized("White gold is available only in 18 karat."),
    },
  ],
  relatedProductIds: [],
  revision: "ring-revision-1",
};

export const zeroOptionProductFixture: ProductPresentationContext = {
  productId: "product_gift_card",
  productTypeId: "gift_card",
  sku: "GIFT-100",
  title: localized("Gift card"),
  price: { amount: 100, currency: "EUR", formatted: localized("€100") },
  availability: localized("Available"),
  media: [{ assetId: "asset_gift_card", role: "main", alt: localized("Gift card") }],
  attributeGroups: [],
  optionGroups: [],
  selectedValues: [],
  unavailableCombinations: [],
  relatedProductIds: [],
  revision: "gift-card-revision-1",
};

export const unavailablePriceProductFixture: ProductPresentationContext = {
  ...structuredClone(zeroOptionProductFixture),
  productId: "product_consultation",
  sku: "CONSULT-PRICE",
  price: undefined,
  priceUnavailableReason: localized("Request a price"),
  revision: "consultation-revision-1",
};

export const canonicalProductResolver: CanonicalProductConfigurationResolver = {
  async resolve(input) {
    await Promise.resolve();
    const values = new Map(
      input.selectedValues.map((selection) => [selection.groupId, selection.valueId]),
    );
    if (input.productId === watchProductFixture.productId) {
      const colour = values.get("colour");
      if (!colour) return { purchasable: false };
      const black = colour === "colour_black";
      return {
        resolvedConfiguration: {
          kind: "variant",
          variantId: black ? "variant_watch_black" : "variant_watch_silver",
        },
        purchasable: true,
        price: { amount: black ? 359 : 349, currency: "EUR" },
        ...(black ? {} : { compareAtPrice: { amount: 399, currency: "EUR" } }),
        availability: localized(black ? "Low stock" : "In stock"),
        mediaAssetIds: [black ? "asset_watch_black" : "asset_watch_silver"],
      };
    }
    if (input.productId === ringProductFixture.productId) {
      const complete = ["ring_size", "metal", "karat", "stone", "quality"].every((groupId) =>
        values.has(groupId),
      );
      if (!complete) return { purchasable: false };
      const premium = values.get("karat") === "karat_18";
      const white = values.get("metal") === "metal_white";
      return {
        resolvedConfiguration: { kind: "configuration", configurationId: "ring_configuration_1" },
        purchasable: true,
        price: { amount: premium ? 1590 : 1390, currency: "EUR" },
        compareAtPrice: { amount: premium ? 1690 : 1490, currency: "EUR" },
        availability: localized("Made to order in two weeks"),
        mediaAssetIds: [white ? "asset_ring_white" : "asset_ring_yellow"],
      };
    }
    if (input.productId === unavailablePriceProductFixture.productId) {
      return {
        resolvedConfiguration: { kind: "baseProduct" },
        purchasable: false,
        priceUnavailableReason: localized("Price available after consultation"),
        availability: localized("Contact the store"),
      };
    }
    return {
      resolvedConfiguration: { kind: "baseProduct" },
      purchasable: true,
      price: { amount: 100, currency: "EUR" },
      availability: localized("Available"),
      mediaAssetIds: ["asset_gift_card"],
    };
  },
};

function assetMetadata(product: ProductPresentationContext): StorefrontAssetMetadata[] {
  return product.media.map((media) => ({
    assetId: media.assetId,
    role:
      media.role === "main"
        ? "productMainImage"
        : media.role === "editorial"
          ? "editorialImage"
          : "productAlternativeImage",
    alt: media.alt ?? product.title,
    decorative: false,
    provenance: { kind: "canonicalProductMedia", sourceId: `source_${media.assetId}` },
    approvalStatus: "approved",
    usageRights: "merchantOwned",
    responsiveCrops: [],
    revision: `revision_${media.assetId}`,
  }));
}

export function dynamicPdpRendererFixture(product: ProductPresentationContext) {
  return {
    instance: {
      id: `section_${product.productId}`,
      component: "dynamicProductDetail",
      componentVersion: { major: 2, minor: 0, patch: 0 },
      variant: "balanced",
      content: dynamicProductDetailDefaultContent,
      props: dynamicProductDetailDefaultProps,
      styleOverrides: dynamicProductDetailDefaultStyleOverrides,
      bindings: [
        {
          slotId: "primaryProduct",
          source: "product",
          productId: product.productId,
          revision: product.revision,
        },
      ],
      assetAssignments: [],
    },
    projection: {
      products: [product],
      collections: [],
      assets: assetMetadata(product),
      navigation: [],
      projectBrandContexts: [],
      localizedContents: [],
      productListRevision: "product-list-revision-1",
    },
  };
}
