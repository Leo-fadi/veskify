import {
  benefitIconsContentSchema,
  collectionHeaderContentSchema,
  dynamicCollectionCommerceDefaultContent,
  dynamicCollectionCommerceDefaultProps,
  dynamicCollectionCommerceDefaultStyleOverrides,
  dynamicProductDetailDefaultContent,
  dynamicProductDetailDefaultProps,
  dynamicProductDetailDefaultStyleOverrides,
  filterBarContentSchema,
  imageTextContentSchema,
  productGalleryContentSchema,
  productGridContentSchema,
  relatedProductsContentSchema,
} from "@/components/registry";
import type {
  CollectionPresentationContext,
  ComponentProjectionContext,
  ProductPresentationContext,
  StorefrontAssetMetadata,
} from "@/domain/component-platform";
import type {
  CatalogueDisplayModel,
  CollectionDisplayModel,
  ProductDisplayModel,
} from "@/domain/catalogue";
import type {
  CanonicalProductConfigurationInput,
  CanonicalProductConfigurationResolver,
} from "@/domain/product-presentation";
import type { LocalizedText } from "@/domain/shared";
import type { PageModel } from "@/domain/storefront";
import type {
  CollectionCommerceRouteInput,
  CollectionCommerceRoutePresentation,
  ProductCommerceRouteInput,
  ProductCommerceRoutePresentation,
  StorefrontCommerceRouteAdapter,
} from "./contract";

const PRODUCT_COMPONENTS = new Set([
  "header",
  "productGallery",
  "productInfo",
  "productOptions",
  "benefitIcons",
  "imageText",
  "relatedProducts",
  "footer",
]);
const COLLECTION_COMPONENTS = new Set([
  "header",
  "collectionHeader",
  "filterBar",
  "productGrid",
  "footer",
]);

function presentationId(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  const candidate = normalized.length >= 3 ? normalized : fallback;
  return candidate.slice(0, 80);
}

function localizedValue(value: unknown): LocalizedText {
  const rendered = Array.isArray(value)
    ? value.map(String).join(", ")
    : typeof value === "number"
      ? String(value)
      : String(value);
  return { en: rendered, fi: rendered };
}

function labelForToken(value: string): LocalizedText {
  const label = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
  return { en: label, fi: label };
}

function money(value: ProductDisplayModel["price"]) {
  if (!value) return undefined;
  return {
    ...value,
    formatted: {
      en: new Intl.NumberFormat("en-FI", {
        style: "currency",
        currency: value.currency,
      }).format(value.amount),
      fi: new Intl.NumberFormat("fi-FI", {
        style: "currency",
        currency: value.currency,
      }).format(value.amount),
    },
  };
}

function availability(product: ProductDisplayModel): LocalizedText | undefined {
  if (product.availabilityLabel) return product.availabilityLabel;
  if (product.stockStatus === "inStock") return { en: "In stock", fi: "Varastossa" };
  if (product.stockStatus === "lowStock")
    return { en: "Limited availability", fi: "Rajoitetusti saatavilla" };
  if (product.stockStatus === "outOfStock")
    return { en: "Currently unavailable", fi: "Ei tällä hetkellä saatavilla" };
  return undefined;
}

function revisionFor(input: ProductCommerceRouteInput | CollectionCommerceRouteInput): string {
  return `${input.aggregate.catalogue.id}_${input.aggregate.project.revision}`.slice(0, 120);
}

function productContext(
  product: ProductDisplayModel,
  revision: string,
  relatedProductIds: readonly string[] = [],
): ProductPresentationContext {
  const variantGroup =
    product.variants.length === 0
      ? []
      : [
          {
            id: presentationId(`${product.id}_variant`, "product_variant"),
            label: { en: "Product option", fi: "Tuotevaihtoehto" },
            source: "variantDimension" as const,
            required: true,
            presentation:
              product.variants.length > 8 ? ("dropdown" as const) : ("buttonGroup" as const),
            values: product.variants.map((variant) => ({
              id: variant.id,
              label: variant.label,
              value: variant.id,
              disabled: false,
              metadata: {},
            })),
            dependsOn: [],
          },
        ];
  const orderOptionGroups = (product.orderOptions ?? []).map((option) =>
    option.type === "text"
      ? {
          id: option.id,
          label: option.label,
          source: "orderOption" as const,
          required: option.required,
          presentation: "textInput" as const,
          values: [],
          dependsOn: [],
          textEntryConstraints: {
            minLength: option.required ? 1 : 0,
            maxLength: option.maxLength!,
            characterPolicy: "unicodeText" as const,
          },
        }
      : {
          id: option.id,
          label: option.label,
          source: "orderOption" as const,
          required: option.required,
          presentation:
            (option.values?.length ?? 0) > 8 ? ("dropdown" as const) : ("buttonGroup" as const),
          values: (option.values ?? []).map((label, index) => ({
            id: presentationId(`${option.id}_${index + 1}`, `option_value_${index + 1}`),
            label,
            value: `${index + 1}`,
            disabled: false,
            metadata: {},
          })),
          dependsOn: [],
        },
  );
  return {
    productId: product.id,
    productTypeId: presentationId(product.productType, "product_type"),
    sku: product.sku,
    title: product.title,
    description: product.description,
    price: money(product.price),
    compareAtPrice: money(product.compareAtPrice),
    priceUnavailableReason: product.priceUnavailableReason,
    availability: availability(product),
    media: product.images.map((image, index) => ({
      assetId: image.id,
      role: index === 0 ? ("main" as const) : ("alternative" as const),
      alt: image.alt,
    })),
    attributeGroups:
      Object.keys(product.attributes).length === 0
        ? []
        : [
            {
              id: presentationId(`${product.id}_specifications`, "product_specifications"),
              title: { en: "Specifications", fi: "Tuotetiedot" },
              attributes: Object.entries(product.attributes).map(([key, value], index) => ({
                id: presentationId(`${product.id}_${key}`, `attribute_${index + 1}`),
                label: labelForToken(key),
                value: localizedValue(value),
              })),
            },
          ],
    optionGroups: [...variantGroup, ...orderOptionGroups],
    selectedValues: [],
    unavailableCombinations: [],
    relatedProductIds: [...relatedProductIds],
    revision,
  };
}

function productAssets(contexts: readonly ProductPresentationContext[]): StorefrontAssetMetadata[] {
  return contexts.flatMap((product) =>
    product.media.map((media) => ({
      assetId: media.assetId,
      role:
        media.role === "main"
          ? ("productMainImage" as const)
          : media.role === "editorial"
            ? ("editorialImage" as const)
            : ("productAlternativeImage" as const),
      alt: media.alt ?? product.title,
      decorative: false,
      provenance: { kind: "canonicalProductMedia" as const, sourceId: product.productId },
      approvalStatus: "approved" as const,
      usageRights: "merchantOwned" as const,
      responsiveCrops: [],
      revision: product.revision,
    })),
  );
}

function assetUrlResolver(catalogue: CatalogueDisplayModel) {
  const urls = new Map(
    catalogue.products.flatMap((product) =>
      product.images.map((image) => [image.id, image.url] as const),
    ),
  );
  return (assetId: string) => urls.get(assetId) ?? "/images/storefront-media-unavailable.svg";
}

function productResolver(
  product: ProductDisplayModel,
  context: ProductPresentationContext,
): CanonicalProductConfigurationResolver {
  const variantGroup = context.optionGroups.find((group) => group.source === "variantDimension");
  return {
    async resolve(input: CanonicalProductConfigurationInput) {
      await Promise.resolve();
      if (input.productId !== product.id || input.catalogueRevision !== context.revision) {
        throw new Error("The product revision no longer matches this route.");
      }
      const selected = new Map(
        input.selectedValues.map((selection) => [selection.groupId, selection.valueId]),
      );
      const text = new Map(input.textEntries.map((entry) => [entry.groupId, entry.value]));
      const complete = context.optionGroups.every((group) => {
        if (!group.required) return true;
        return group.presentation === "textInput"
          ? (text.get(group.id)?.length ?? 0) >= (group.textEntryConstraints?.minLength ?? 0)
          : selected.has(group.id);
      });
      if (!complete) return { purchasable: false };
      const selectedVariantId = variantGroup ? selected.get(variantGroup.id) : undefined;
      const variant = selectedVariantId
        ? product.variants.find((candidate) => candidate.id === selectedVariantId)
        : undefined;
      if (variantGroup && !variant) throw new Error("The selected product variant is unavailable.");
      const resolvedConfiguration = variant
        ? { kind: "variant" as const, variantId: variant.id }
        : { kind: "baseProduct" as const };
      const resolvedPrice = money(variant?.price ?? product.price);
      const priceUnavailableReason = resolvedPrice ? undefined : product.priceUnavailableReason;
      return {
        resolvedConfiguration,
        purchasable: product.stockStatus !== "outOfStock" && resolvedPrice !== undefined,
        price: resolvedPrice,
        priceUnavailableReason,
        compareAtPrice: money(product.compareAtPrice),
        availability: availability(product),
        mediaAssetIds: product.images.map((image) => image.id),
        disabledOptionValues: [],
        warnings: [],
      };
    },
  };
}

function visibleComponentsAreSupported(page: PageModel, supported: ReadonlySet<string>): boolean {
  return page.sections
    .filter((section) => section.visible)
    .every((section) => supported.has(section.component));
}

function productPresentation(
  input: ProductCommerceRouteInput,
): ProductCommerceRoutePresentation | null {
  if (!visibleComponentsAreSupported(input.page, PRODUCT_COMPONENTS)) return null;
  const core = ["productGallery", "productInfo", "productOptions"].map((component) =>
    input.page.sections.find((section) => section.visible && section.component === component),
  );
  if (core.some((section) => section === undefined)) return null;
  const references = core.map(
    (section) => productGalleryContentSchema.parse(section!.content).productId,
  );
  if (references.some((productId) => productId !== input.product.id)) {
    throw new Error("Product route bindings do not reference one canonical product.");
  }
  const relatedSection = input.page.sections.find(
    (section) => section.visible && section.component === "relatedProducts",
  );
  const related = relatedSection
    ? relatedProductsContentSchema.parse(relatedSection.content)
    : { heading: dynamicProductDetailDefaultContent.relatedHeading, productIds: [] };
  const relatedProducts = related.productIds.map((productId) => {
    const product = input.aggregate.catalogue.products.find(
      (candidate) => candidate.id === productId,
    );
    if (!product) throw new Error("A related-product binding does not resolve.");
    return product;
  });
  const revision = revisionFor(input);
  const primaryContext = productContext(input.product, revision, related.productIds);
  const relatedContexts = relatedProducts.map((product) => productContext(product, revision));
  const products = [primaryContext, ...relatedContexts];
  const benefitSection = input.page.sections.find(
    (section) => section.visible && section.component === "benefitIcons",
  );
  const benefits = benefitSection
    ? benefitIconsContentSchema.parse(benefitSection.content).benefits
    : [];
  const supportingSection = input.page.sections.find(
    (section) => section.visible && section.component === "imageText",
  );
  const supporting = supportingSection
    ? imageTextContentSchema.parse(supportingSection.content)
    : undefined;
  const projection: ComponentProjectionContext = {
    products,
    collections: [],
    assets: productAssets(products),
    navigation: [],
    projectBrandContexts: [],
    localizedContents: [],
    productListRevision: revision,
  };
  return {
    instance: {
      id: core[0]!.id,
      component: "dynamicProductDetail",
      componentVersion: { major: 2, minor: 0, patch: 0 },
      variant: "balanced",
      content: {
        ...dynamicProductDetailDefaultContent,
        ...(supporting
          ? { supportingHeading: supporting.heading, supportingBody: supporting.body }
          : {}),
        trustItems: benefits.map((benefit, index) => ({
          id: presentationId(`${core[0]!.id}_trust_${index + 1}`, `trust_${index + 1}`),
          title: benefit.title,
          body: benefit.text,
        })),
        relatedHeading: related.heading,
      },
      props: dynamicProductDetailDefaultProps,
      styleOverrides: dynamicProductDetailDefaultStyleOverrides,
      bindings: [
        {
          slotId: "primaryProduct",
          source: "product",
          productId: input.product.id,
          revision,
        },
        ...(related.productIds.length
          ? [
              {
                slotId: "relatedProducts" as const,
                source: "productList" as const,
                productIds: related.productIds,
                revision,
              },
            ]
          : []),
      ],
      assetAssignments: [],
    },
    projection,
    productContext: primaryContext,
    resolver: productResolver(input.product, primaryContext),
    resolveAssetUrl: assetUrlResolver(input.aggregate.catalogue),
  };
}

function collectionFilter(
  filterId: string,
  products: readonly ProductDisplayModel[],
): CollectionPresentationContext["filters"][number] | null {
  if (filterId === "price") {
    const values = products.flatMap((product) => (product.price ? [product.price.amount] : []));
    if (values.length === 0) return null;
    return {
      id: "price",
      label: { en: "Price", fi: "Hinta" },
      presentation: "range",
      values: [],
      range: { min: Math.min(...values), max: Math.max(...values), unit: { en: "EUR", fi: "EUR" } },
    };
  }
  const rawValues =
    filterId === "availability"
      ? products.flatMap((product) => (product.stockStatus ? [product.stockStatus] : []))
      : products.flatMap((product) => {
          const value = product.attributes[filterId];
          return value === undefined
            ? []
            : Array.isArray(value)
              ? value.map(String)
              : [String(value)];
        });
  const values = [...new Set(rawValues)];
  if (values.length === 0) return null;
  return {
    id: presentationId(filterId, "filter_value"),
    label: labelForToken(filterId),
    presentation: "enumerated",
    values: values.map((value, index) => ({
      id: presentationId(`${filterId}_${value}`, `filter_value_${index + 1}`),
      label: localizedValue(value),
      count: rawValues.filter((candidate) => candidate === value).length,
      selected: false,
      disabled: false,
    })),
  };
}

function collectionContext(
  collection: CollectionDisplayModel,
  products: readonly ProductDisplayModel[],
  filters: readonly string[],
  revision: string,
): CollectionPresentationContext {
  return {
    collectionId: collection.id,
    title: collection.title,
    description: collection.description,
    assets: [],
    productIds: [...collection.productIds],
    filters: filters.flatMap((filterId) => {
      const filter = collectionFilter(filterId, products);
      return filter ? [filter] : [];
    }),
    sorting: [{ id: "featured", label: { en: "Featured", fi: "Suositellut" }, default: true }],
    emptyState: {
      title: { en: "No products in this collection", fi: "Tässä mallistossa ei ole tuotteita" },
    },
    revision,
  };
}

function collectionPresentation(
  input: CollectionCommerceRouteInput,
): CollectionCommerceRoutePresentation | null {
  if (!visibleComponentsAreSupported(input.page, COLLECTION_COMPONENTS)) return null;
  const headerSection = input.page.sections.find(
    (section) => section.visible && section.component === "collectionHeader",
  );
  const gridSection = input.page.sections.find(
    (section) => section.visible && section.component === "productGrid",
  );
  if (!headerSection || !gridSection) return null;
  const header = collectionHeaderContentSchema.parse(headerSection.content);
  const grid = productGridContentSchema.parse(gridSection.content);
  if (header.collectionId !== input.collection.id) {
    throw new Error("Collection route binding does not reference the canonical collection.");
  }
  if (
    grid.productIds.length !== input.collection.productIds.length ||
    grid.productIds.some((productId, index) => productId !== input.collection.productIds[index])
  ) {
    throw new Error("Collection route membership must preserve canonical order.");
  }
  const products = input.collection.productIds.map((productId) => {
    const product = input.aggregate.catalogue.products.find(
      (candidate) => candidate.id === productId,
    );
    if (!product) throw new Error("A collection product binding does not resolve.");
    return product;
  });
  const filterSection = input.page.sections.find(
    (section) => section.visible && section.component === "filterBar",
  );
  const filters = filterSection ? filterBarContentSchema.parse(filterSection.content).filters : [];
  const revision = revisionFor(input);
  const productContexts = products.map((product) => productContext(product, revision));
  const collection = collectionContext(input.collection, products, filters, revision);
  const projection: ComponentProjectionContext = {
    products: productContexts,
    collections: [collection],
    assets: productAssets(productContexts),
    navigation: [],
    projectBrandContexts: [],
    localizedContents: [],
    productListRevision: revision,
    collectionListRevision: revision,
  };
  return {
    instance: {
      id: headerSection.id,
      component: "dynamicCollectionCommerce",
      componentVersion: { major: 2, minor: 0, patch: 0 },
      variant: "standard",
      content: { ...dynamicCollectionCommerceDefaultContent, productsHeading: grid.heading },
      props: {
        ...dynamicCollectionCommerceDefaultProps,
        cardVariant: gridSection.variant === "editorial" ? "editorial" : "standard",
        filterLayout: filterSection ? "horizontal" : "sidebar",
      },
      styleOverrides: dynamicCollectionCommerceDefaultStyleOverrides,
      bindings: [
        {
          slotId: "primaryCollection",
          source: "collection",
          collectionId: input.collection.id,
          revision,
        },
        {
          slotId: "collectionProducts",
          source: "productList",
          productIds: [...input.collection.productIds],
          revision,
        },
      ],
      assetAssignments: [],
    },
    projection,
    resolveAssetUrl: assetUrlResolver(input.aggregate.catalogue),
  };
}

export function createCatalogueStorefrontCommerceRouteAdapter(): StorefrontCommerceRouteAdapter {
  return { product: productPresentation, collection: collectionPresentation };
}
