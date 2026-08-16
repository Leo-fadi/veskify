import {
  benefitIconsContentSchema,
  collectionHeaderContentSchema,
  dynamicCollectionCommerceBridgeContentSchema,
  dynamicCollectionCommerceContentSchema,
  dynamicCollectionCommerceDefaultContent,
  dynamicCollectionCommerceDefaultProps,
  dynamicCollectionCommerceDefaultStyleOverrides,
  dynamicCollectionCommercePropsSchema,
  dynamicCollectionCommerceStyleOverridesSchema,
  dynamicProductDetailBridgeContentSchema,
  dynamicProductDetailDefaultContent,
  dynamicProductDetailDefaultProps,
  dynamicProductDetailDefaultStyleOverrides,
  dynamicProductDetailPropsSchema,
  filterBarContentSchema,
  imageTextContentSchema,
  productGalleryContentSchema,
  productGridContentSchema,
  relatedProductsContentSchema,
} from "@/components/registry";
import { dynamicCollectionCommerceDefinition } from "@/components/registry/dynamic-collection-commerce";
import { dynamicProductDetailDefinition } from "@/components/registry/dynamic-product-detail";
import type {
  CollectionPresentationContext,
  ComponentProjectionContext,
  ProductPresentationContext,
  StorefrontAssetMetadata,
} from "@/domain/component-platform";
import type { ComponentDefinitionV2 } from "@/domain/component-platform";
import type { BrandSystem } from "@/domain/design-system";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import { createCanonicalProductMediaResponsiveAuthority } from "@/application/responsive-image-authority";
import type {
  CatalogueDisplayModel,
  CollectionDisplayModel,
  ProductDisplayModel,
} from "@/domain/catalogue";
import type {
  CanonicalProductConfigurationInput,
  CanonicalProductConfigurationResolver,
} from "@/domain/product-presentation";
import type { AssetRef, LocalizedText } from "@/domain/shared";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  type PageModel,
  type SectionInstance,
} from "@/domain/storefront";
import { storefrontSearchResultPageV1Schema } from "@/application/storefront-search";
import type {
  CollectionCommerceRouteInput,
  CollectionCommerceRoutePresentation,
  ProductCommerceRouteInput,
  ProductCommerceRoutePresentation,
  StorefrontSearchCommerceRouteAdapter,
  StorefrontSearchCommerceRouteInput,
  StorefrontSearchCommerceRoutePresentation,
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
const PRODUCT_COMPONENT_ORDER = [
  "header",
  "productGallery",
  "productInfo",
  "productOptions",
  "benefitIcons",
  "imageText",
  "relatedProducts",
  "footer",
] as const;
const COLLECTION_COMPONENT_ORDER = [
  "header",
  "collectionHeader",
  "filterBar",
  "productGrid",
  "footer",
] as const;

const dynamicSearchCommerceBridgeContentSchema = dynamicCollectionCommerceBridgeContentSchema.omit({
  collectionId: true,
});

function collectionCommerceStyleOverrides(
  section: SectionInstance,
): typeof dynamicCollectionCommerceDefaultStyleOverrides {
  const direct = dynamicCollectionCommerceStyleOverridesSchema.safeParse(section.styleOverrides);
  if (direct.success) return direct.data;
  return dynamicCollectionCommerceStyleOverridesSchema.parse({
    surfaceTreatment: section.styleOverrides?.surface === "surface" ? "soft" : "plain",
  });
}

const ATTRIBUTE_LABELS: Readonly<Record<string, LocalizedText>> = {
  material: { en: "Material", fi: "Materiaali" },
  fineness: { en: "Fineness", fi: "Pitoisuus" },
  karat: { en: "Karat", fi: "Karaatti" },
  metalColour: { en: "Metal colour", fi: "Metallin väri" },
  stoneType: { en: "Stone", fi: "Kivi" },
  stoneShape: { en: "Stone shape", fi: "Kiven muoto" },
  stoneColour: { en: "Stone colour", fi: "Kiven väri" },
  stoneClarity: { en: "Diamond quality", fi: "Timantin laatu" },
  ringSizes: { en: "Ring sizes", fi: "Sormuskoot" },
  ringSize: { en: "Ring size", fi: "Sormuskoko" },
  ringWidthMm: { en: "Ring width", fi: "Sormuksen leveys" },
  ringProfile: { en: "Profile", fi: "Profiili" },
  engraving: { en: "Engraving", fi: "Kaiverrus" },
  colour: { en: "Colour", fi: "Väri" },
};

const ATTRIBUTE_VALUE_LABELS: Readonly<Record<string, Readonly<Record<string, LocalizedText>>>> = {
  material: {
    gold: { en: "Gold", fi: "Kulta" },
    silver: { en: "Silver", fi: "Hopea" },
    steel: { en: "Steel", fi: "Teräs" },
  },
  metalColour: {
    yellow: { en: "Yellow gold", fi: "Keltakulta" },
    white: { en: "White gold", fi: "Valkokulta" },
    rose: { en: "Rose gold", fi: "Rosekulta" },
    silver: { en: "Silver", fi: "Hopea" },
    black: { en: "Black", fi: "Musta" },
  },
  colour: {
    yellow: { en: "Yellow", fi: "Keltainen" },
    white: { en: "White", fi: "Valkoinen" },
    rose: { en: "Rose", fi: "Roosa" },
    silver: { en: "Silver", fi: "Hopea" },
    black: { en: "Black", fi: "Musta" },
  },
  stoneType: {
    diamond: { en: "Diamond", fi: "Timantti" },
    sapphire: { en: "Sapphire", fi: "Safiiri" },
    zirconia: { en: "Zirconia", fi: "Zirkonia" },
  },
  stoneShape: {
    round: { en: "Round", fi: "Pyöreä" },
  },
  ringProfile: {
    comfort: { en: "Comfort", fi: "Comfort" },
  },
  engraving: {
    available: { en: "Available", fi: "Saatavilla" },
  },
};

const AVAILABILITY_LABELS = {
  inStock: { en: "In stock", fi: "Varastossa" },
  lowStock: { en: "Limited availability", fi: "Rajoitetusti saatavilla" },
  outOfStock: { en: "Currently unavailable", fi: "Ei tällä hetkellä saatavilla" },
} satisfies Record<NonNullable<ProductDisplayModel["stockStatus"]>, LocalizedText>;

type CanonicalVariantDimension = Readonly<{
  key: string;
  groupId: string;
  valueById: ReadonlyMap<string, string>;
  group: ProductPresentationContext["optionGroups"][number];
}>;

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

function labelForToken(value: string): LocalizedText {
  const label = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
  return { en: label, fi: label };
}

function attributeLabel(key: string): LocalizedText {
  return ATTRIBUTE_LABELS[key] ?? labelForToken(key);
}

function localizedAttributeScalar(key: string, value: string | number): LocalizedText {
  const rendered = String(value);
  return (
    ATTRIBUTE_VALUE_LABELS[key]?.[rendered] ??
    (/^[a-z0-9_-]+$/.test(rendered) ? labelForToken(rendered) : { en: rendered, fi: rendered })
  );
}

function localizedAttributeValue(
  key: string,
  value: ProductDisplayModel["attributes"][string],
): LocalizedText {
  if (!Array.isArray(value)) return localizedAttributeScalar(key, value);
  const labels = value.map((entry) => localizedAttributeScalar(key, entry));
  return {
    en: labels.map((label) => label.en).join(", "),
    fi: labels.map((label) => label.fi).join(", "),
  };
}

function money(value: ProductDisplayModel["price"]) {
  if (!value) return undefined;
  const format = (locale: "en-FI" | "fi-FI", amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: value.currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  return {
    ...value,
    formatted: {
      en: format("en-FI", value.amount),
      fi: format("fi-FI", value.amount),
    },
  };
}

function availabilityForStockStatus(
  stockStatus: ProductDisplayModel["stockStatus"],
): LocalizedText | undefined {
  return stockStatus === undefined ? undefined : AVAILABILITY_LABELS[stockStatus];
}

function availability(product: ProductDisplayModel): LocalizedText | undefined {
  return structuredClone(
    product.availabilityLabel ?? availabilityForStockStatus(product.stockStatus),
  );
}

function revisionFor(
  input:
    ProductCommerceRouteInput | CollectionCommerceRouteInput | StorefrontSearchCommerceRouteInput,
): string {
  return `canonical-commerce-${canonicalValueFingerprint(input.aggregate.catalogue)}`;
}

function canonicalVariantDimensions(
  product: ProductDisplayModel,
): readonly CanonicalVariantDimension[] | null {
  if (product.variants.length === 0) return [];
  const keys = Object.keys(product.variants[0].attributes);
  if (keys.length === 0) return null;
  const canonicalCombinations = new Set<string>();

  for (const variant of product.variants) {
    const variantKeys = Object.keys(variant.attributes);
    if (
      variantKeys.length !== keys.length ||
      variantKeys.some((key, index) => key !== keys[index])
    ) {
      return null;
    }
    const values = keys.map((key) => variant.attributes[key]);
    if (values.some((value) => Array.isArray(value) || value === undefined)) return null;
    const fingerprint = canonicalValueString(values);
    if (canonicalCombinations.has(fingerprint)) return null;
    canonicalCombinations.add(fingerprint);
  }

  const dimensions: CanonicalVariantDimension[] = [];
  for (const key of keys) {
    const groupId = presentationId(`${product.id}_variant_${key}`, "variant_dimension");
    const seenValues = new Set<string>();
    const seenIds = new Set<string>();
    const valueById = new Map<string, string>();
    const values: ProductPresentationContext["optionGroups"][number]["values"] = [];
    for (const variant of product.variants) {
      const rawValue = variant.attributes[key];
      if (Array.isArray(rawValue) || rawValue === undefined) return null;
      const canonicalValue = canonicalValueString(rawValue);
      if (seenValues.has(canonicalValue)) continue;
      seenValues.add(canonicalValue);
      const id = presentationId(
        `${product.id}_${key}_${String(rawValue)}`,
        `variant_value_${values.length + 1}`,
      );
      if (seenIds.has(id)) return null;
      seenIds.add(id);
      valueById.set(id, canonicalValue);
      values.push({
        id,
        label: localizedAttributeScalar(key, rawValue),
        value: String(rawValue),
        disabled: false,
        metadata: { canonicalDimension: key, canonicalValue: rawValue },
      });
    }
    dimensions.push({
      key,
      groupId,
      valueById,
      group: {
        id: groupId,
        label: attributeLabel(key),
        source: "variantDimension",
        required: true,
        presentation: values.length > 8 ? "dropdown" : "buttonGroup",
        values,
        dependsOn: [],
      },
    });
  }
  return dimensions;
}

function productContext(
  product: ProductDisplayModel,
  revision: string,
  variantDimensions: readonly CanonicalVariantDimension[] = [],
  relatedProductIds: readonly string[] = [],
  editorialMedia?: AssetRef,
): ProductPresentationContext {
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
    productTypeId: canonicalProductTypePresentationId(product.productType),
    sku: product.sku,
    title: product.title,
    description: structuredClone(product.description),
    price: money(product.price),
    compareAtPrice: money(product.compareAtPrice),
    priceUnavailableReason: product.priceUnavailableReason
      ? structuredClone(product.priceUnavailableReason)
      : product.price
        ? undefined
        : { en: "Price unavailable", fi: "Hinta ei ole saatavilla" },
    availability: availability(product),
    media: [
      ...product.images.map((image, index) => ({
        assetId: image.id,
        role: index === 0 ? ("main" as const) : ("alternative" as const),
        alt: image.alt,
        decorative: image.decorative,
      })),
      ...(editorialMedia
        ? [
            {
              assetId: editorialMedia.id,
              role: "editorial" as const,
              alt: editorialMedia.alt,
              decorative: editorialMedia.decorative,
            },
          ]
        : []),
    ],
    attributeGroups:
      Object.keys(product.attributes).length === 0
        ? []
        : [
            {
              id: presentationId(`${product.id}_specifications`, "product_specifications"),
              title: { en: "Specifications", fi: "Tuotetiedot" },
              attributes: Object.entries(product.attributes).map(([key, value], index) => ({
                id: presentationId(`${product.id}_${key}`, `attribute_${index + 1}`),
                label: attributeLabel(key),
                value: localizedAttributeValue(key, value),
              })),
            },
          ],
    optionGroups: [...variantDimensions.map((dimension) => dimension.group), ...orderOptionGroups],
    selectedValues: [],
    unavailableCombinations: [],
    relatedProductIds: [...relatedProductIds],
    revision,
  };
}

function productAssets(
  contexts: readonly ProductPresentationContext[],
  merchantProvidedAssetIds: ReadonlySet<string> = new Set(),
  artContext?: Readonly<{
    component: ComponentDefinitionV2;
    variant: string;
    brandSystem: BrandSystem;
  }>,
): StorefrontAssetMetadata[] {
  return contexts.flatMap((product) =>
    product.media.map((media) => {
      const role =
        media.role === "main"
          ? ("productMainImage" as const)
          : media.role === "editorial"
            ? ("editorialImage" as const)
            : ("productAlternativeImage" as const);
      const revision = product.revision ?? `product-${product.productId}`;
      const artDirection =
        artContext && role !== "editorialImage" && !merchantProvidedAssetIds.has(media.assetId)
          ? createCanonicalProductMediaResponsiveAuthority({
              component: artContext.component,
              variant: artContext.variant,
              brandSystem: artContext.brandSystem,
              productId: product.productId,
              media,
              revision,
              assetSlotId:
                artContext.component.type === "dynamicProductDetail"
                  ? "productMedia"
                  : "collectionCommerceMedia",
            })
          : undefined;
      return {
        assetId: media.assetId,
        role,
        alt: media.decorative ? undefined : (media.alt ?? product.title),
        decorative: media.decorative ?? false,
        provenance: merchantProvidedAssetIds.has(media.assetId)
          ? { kind: "merchantProvided" as const, sourceId: media.assetId }
          : { kind: "canonicalProductMedia" as const, sourceId: product.productId },
        approvalStatus: "approved" as const,
        usageRights: "merchantOwned" as const,
        responsiveCrops: [],
        revision,
        ...(artDirection === undefined ? {} : { artDirection }),
      };
    }),
  );
}

function assetUrlResolver(catalogue: CatalogueDisplayModel, extraAssets: readonly AssetRef[] = []) {
  const urls = new Map([
    ...catalogue.products.flatMap((product) =>
      product.images.map((image) => [image.id, image.url] as const),
    ),
    ...extraAssets.map((asset) => [asset.id, asset.url] as const),
  ]);
  return (assetId: string) => urls.get(assetId) ?? "/images/storefront-media-unavailable.svg";
}

function productResolver(
  product: ProductDisplayModel,
  context: ProductPresentationContext,
  variantDimensions: readonly CanonicalVariantDimension[],
): CanonicalProductConfigurationResolver {
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
      const variant =
        variantDimensions.length === 0
          ? undefined
          : product.variants.find((candidate) =>
              variantDimensions.every((dimension) => {
                const selectedValueId = selected.get(dimension.groupId);
                const canonicalSelection = selectedValueId
                  ? dimension.valueById.get(selectedValueId)
                  : undefined;
                return (
                  canonicalSelection !== undefined &&
                  canonicalSelection === canonicalValueString(candidate.attributes[dimension.key])
                );
              }),
            );
      if (variantDimensions.length > 0 && !variant) {
        throw new Error("The selected product variant is unavailable.");
      }
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

function hasCompatibleVisibleLayout(
  page: PageModel,
  supported: ReadonlySet<string>,
  canonicalOrder: readonly string[],
  required: readonly string[],
): boolean {
  const visible = page.sections
    .filter((section) => section.visible)
    .map((section) => section.component);
  if (visible.some((component) => !supported.has(component))) return false;
  const counts = new Map<string, number>();
  for (const component of visible) {
    const count = (counts.get(component) ?? 0) + 1;
    if (count > 1) return false;
    counts.set(component, count);
  }
  if (required.some((component) => counts.get(component) !== 1)) return false;
  let previousPosition = -1;
  for (const component of visible) {
    const position = canonicalOrder.indexOf(component);
    if (position <= previousPosition) return false;
    previousPosition = position;
  }
  return true;
}

function productPresentation(
  input: ProductCommerceRouteInput,
): ProductCommerceRoutePresentation | null {
  const dynamicSection = input.page.sections.find(
    (section) => section.visible && section.component === "dynamicProductDetail",
  );
  if (dynamicSection) {
    const { productId, relatedProductIds, canonicalRevision, ...content } =
      dynamicProductDetailBridgeContentSchema.parse(dynamicSection.content);
    if (productId !== input.product.id) {
      throw new Error("Product route bindings do not reference one canonical product.");
    }
    const variantDimensions = canonicalVariantDimensions(input.product);
    if (variantDimensions === null) return null;
    const relatedProducts = relatedProductIds.map((relatedProductId) => {
      const product = input.aggregate.catalogue.products.find(
        (candidate) => candidate.id === relatedProductId,
      );
      if (!product) throw new Error("A related-product binding does not resolve.");
      return product;
    });
    const revision = revisionFor(input);
    if (canonicalRevision !== revision) {
      throw new Error("Product route binding revision does not match the canonical catalogue.");
    }
    const primaryContext = productContext(
      input.product,
      revision,
      variantDimensions,
      relatedProductIds,
    );
    const relatedContexts = relatedProducts.map((product) => productContext(product, revision));
    const products = [primaryContext, ...relatedContexts];
    const projection: ComponentProjectionContext = {
      evidenceReferences: Array.from(input.evidenceReferences ?? [], (reference) =>
        structuredClone(reference),
      ),
      products,
      collections: [],
      assets: productAssets(products, new Set(), {
        component: dynamicProductDetailDefinition,
        variant: dynamicSection.variant,
        brandSystem: input.snapshot.brandSystem,
      }),
      navigation: [],
      projectBrandContexts: [],
      localizedContents: [],
      productListRevision: revision,
    };
    return {
      instance: {
        id: dynamicSection.id,
        component: "dynamicProductDetail",
        componentVersion: dynamicProductDetailDefinition.version,
        variant: dynamicSection.variant,
        content,
        props: dynamicProductDetailPropsSchema.parse(dynamicSection.props),
        styleOverrides: dynamicProductDetailDefaultStyleOverrides,
        bindings: [
          {
            slotId: "primaryProduct",
            source: "product",
            productId: input.product.id,
            revision,
          },
          ...(relatedProductIds.length
            ? [
                {
                  slotId: "relatedProducts" as const,
                  source: "productList" as const,
                  productIds: relatedProductIds,
                  revision,
                },
              ]
            : []),
        ],
        assetAssignments: [],
      },
      projection,
      productContext: primaryContext,
      resolver: productResolver(input.product, primaryContext, variantDimensions),
      resolveAssetUrl: assetUrlResolver(input.aggregate.catalogue),
    };
  }
  if (
    !hasCompatibleVisibleLayout(input.page, PRODUCT_COMPONENTS, PRODUCT_COMPONENT_ORDER, [
      "productGallery",
      "productInfo",
      "productOptions",
    ])
  ) {
    return null;
  }
  const variantDimensions = canonicalVariantDimensions(input.product);
  if (variantDimensions === null) return null;
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
  const revision = revisionFor(input);
  const primaryContext = productContext(
    input.product,
    revision,
    variantDimensions,
    related.productIds,
    supporting?.media,
  );
  const relatedContexts = relatedProducts.map((product) => productContext(product, revision));
  const products = [primaryContext, ...relatedContexts];
  const merchantProvidedAssetIds = new Set(supporting ? [supporting.media.id] : []);
  const projection: ComponentProjectionContext = {
    evidenceReferences: Array.from(input.evidenceReferences ?? [], (reference) =>
      structuredClone(reference),
    ),
    products,
    collections: [],
    assets: productAssets(products, merchantProvidedAssetIds, {
      component: dynamicProductDetailDefinition,
      variant: "balanced",
      brandSystem: input.snapshot.brandSystem,
    }),
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
      props: {
        ...dynamicProductDetailDefaultProps,
        relatedCardVariant: related.productIds.length ? "horizontal" : "standard",
      },
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
    resolver: productResolver(input.product, primaryContext, variantDimensions),
    resolveAssetUrl: assetUrlResolver(
      input.aggregate.catalogue,
      supporting ? [supporting.media] : [],
    ),
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
  const rawValues = products.flatMap((product) => {
    if (filterId === "availability") return product.stockStatus ? [product.stockStatus] : [];
    const value = product.attributes[filterId];
    return value === undefined ? [] : Array.isArray(value) ? value.map(String) : [String(value)];
  });
  const values = [...new Set(rawValues)];
  if (values.length === 0) return null;
  return {
    id: presentationId(filterId, "filter_value"),
    label: labelForToken(filterId),
    presentation: "enumerated",
    values: values.map((value, index) => ({
      id: presentationId(`${filterId}_${value}`, `filter_value_${index + 1}`),
      label:
        filterId === "availability"
          ? availabilityForStockStatus(value as NonNullable<ProductDisplayModel["stockStatus"]>)!
          : localizedAttributeScalar(filterId, value),
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
  heroAssetId?: string,
  additionalAssets: CollectionPresentationContext["assets"] = [],
): CollectionPresentationContext {
  const pricedProducts = products.filter((product) => product.price !== undefined);
  const sorting: CollectionPresentationContext["sorting"] = [
    { id: "featured", label: { en: "Featured", fi: "Suositellut" }, default: true },
    ...(pricedProducts.length >= 2
      ? [
          {
            id: "price_low",
            label: { en: "Price: low to high", fi: "Hinta: halvin ensin" },
            default: false,
          },
          {
            id: "price_high",
            label: { en: "Price: high to low", fi: "Hinta: kallein ensin" },
            default: false,
          },
        ]
      : []),
  ];
  return {
    collectionId: collection.id,
    title: collection.title,
    description: structuredClone(collection.description),
    assets: [
      ...(heroAssetId ? [{ assetId: heroAssetId, role: "hero" as const }] : []),
      ...additionalAssets,
    ],
    productIds: [...collection.productIds],
    filters: filters.flatMap((filterId) => {
      const filter = collectionFilter(filterId, products);
      return filter ? [filter] : [];
    }),
    sorting,
    emptyState: {
      title: { en: "No products in this collection", fi: "Tässä mallistossa ei ole tuotteita" },
    },
    revision,
  };
}

function approvedCollectionMedia(section: SectionInstance): Readonly<{
  assets: CollectionPresentationContext["assets"];
  metadata: readonly StorefrontAssetMetadata[];
  assignments: readonly {
    slotId: string;
    assetId: string;
    role: StorefrontAssetMetadata["role"];
  }[];
  urls: readonly AssetRef[];
}> {
  const placements = (section.approvedAssetPlacements ?? []).filter(
    (placement) =>
      placement.componentId === section.id &&
      placement.componentType === "dynamicCollectionCommerce" &&
      placement.assetSlotId === "collectionCommerceMedia",
  );
  const values = placements.map((placement) => {
    const presentation = (section.approvedAssetPresentations ?? []).find(
      (candidate) =>
        candidate.assetId === placement.assetId &&
        candidate.role === placement.role &&
        candidate.revision === placement.assetRevision &&
        candidate.materialFingerprint === placement.materialFingerprint,
    );
    if (!presentation) {
      throw new Error("Collection route approved asset placement lacks its approved presentation.");
    }
    return { placement, presentation };
  });
  return {
    assets: values.map(({ placement }) => ({
      assetId: placement.assetId,
      role: placement.role === "editorialImage" ? ("editorial" as const) : ("hero" as const),
    })),
    metadata: values.map(({ placement, presentation }) => ({
      assetId: placement.assetId,
      role: placement.role,
      ...(presentation.asset.alt === undefined
        ? { decorative: true }
        : { alt: presentation.asset.alt, decorative: false }),
      provenance: {
        kind:
          placement.sourceProvenanceKind === "merchantProvided"
            ? ("merchantProvided" as const)
            : ("sourceDiscovered" as const),
        sourceId: placement.sourceReferenceId,
      },
      approvalStatus: "approved" as const,
      usageRights:
        placement.sourceProvenanceKind === "merchantProvided"
          ? ("merchantOwned" as const)
          : ("unknown" as const),
      responsiveCrops: [],
      ...(presentation.artDirection === undefined
        ? {}
        : { artDirection: presentation.artDirection }),
      revision: presentation.revision,
    })),
    assignments: values.map(({ placement }) => ({
      slotId: placement.assetSlotId,
      assetId: placement.assetId,
      role: placement.role,
    })),
    urls: values.map(({ presentation }) => presentation.asset),
  };
}

const MAX_CONTEXTUAL_COLLECTION_FACETS = 8;
const INTERNAL_COLLECTION_FACET_TOKEN =
  /(?:^|[_-])(admin|barcode|canonical|cost|ean|fingerprint|gtin|handle|id|internal|inventory|revision|sku|slug|source)(?:$|[_-])/i;
const CONTEXTUAL_FACET_PRIORITY: Readonly<Record<string, number>> = {
  material: 50,
  colour: 48,
  color: 48,
  size: 46,
  style: 44,
  brand: 42,
  price: 40,
  availability: 38,
};

type ContextualCollectionFacet = Readonly<{
  id: string;
  coverage: number;
  distinctValues: number;
  priority: number;
}>;

function normalizedFacetValue(value: string | number): string {
  return String(value).normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function collectionIdentityTokens(collection: CollectionDisplayModel): ReadonlySet<string> {
  return new Set(
    [collection.title.en, collection.title.fi]
      .filter((value): value is string => typeof value === "string")
      .flatMap((value) =>
        value
          .normalize("NFKC")
          .toLocaleLowerCase("en-US")
          .split(/[^\p{L}\p{N}]+/u),
      )
      .filter(Boolean)
      .map((value) => (value.endsWith("s") && value.length > 3 ? value.slice(0, -1) : value)),
  );
}

function contextualAttributeFacet(
  attributeId: string,
  products: readonly ProductDisplayModel[],
  identityTokens: ReadonlySet<string>,
): ContextualCollectionFacet | null {
  const normalizedId = attributeId
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLocaleLowerCase("en-US");
  if (INTERNAL_COLLECTION_FACET_TOKEN.test(normalizedId)) return null;
  const idTokens = normalizedId.split(/[_-]+/).filter(Boolean);
  const soleIdToken = idTokens.length === 1 ? idTokens[0] : undefined;
  if (
    soleIdToken &&
    identityTokens.has(
      soleIdToken.endsWith("s") && soleIdToken.length > 3 ? soleIdToken.slice(0, -1) : soleIdToken,
    )
  ) {
    return null;
  }
  const productValues = products.flatMap((product) => {
    const value = product.attributes[attributeId];
    if (value === undefined) return [];
    const normalized = (Array.isArray(value) ? value : [value])
      .map(normalizedFacetValue)
      .filter(Boolean);
    return normalized.length ? [normalized] : [];
  });
  const distinctValues = new Set(productValues.flat()).size;
  if (productValues.length < 2 || distinctValues < 2 || distinctValues > 12) return null;
  return {
    id: attributeId,
    coverage: productValues.length,
    distinctValues,
    priority: CONTEXTUAL_FACET_PRIORITY[attributeId] ?? 20,
  };
}

function contextualCollectionFilterIds(
  collection: CollectionDisplayModel,
  products: readonly ProductDisplayModel[],
): readonly string[] {
  const identityTokens = collectionIdentityTokens(collection);
  const attributeIds = new Set<string>();
  products.forEach((product) => {
    Object.keys(product.attributes).forEach((attributeId) => attributeIds.add(attributeId));
  });
  const facets = [...attributeIds].flatMap((attributeId) => {
    const facet = contextualAttributeFacet(attributeId, products, identityTokens);
    return facet ? [facet] : [];
  });
  const prices = products.flatMap((product) => (product.price ? [product.price.amount] : []));
  if (prices.length >= 2 && new Set(prices).size >= 2) {
    facets.push({
      id: "price",
      coverage: prices.length,
      distinctValues: new Set(prices).size,
      priority: CONTEXTUAL_FACET_PRIORITY.price ?? 0,
    });
  }
  const availabilityValues = products.flatMap((product) =>
    product.stockStatus ? [product.stockStatus] : [],
  );
  if (availabilityValues.length >= 2 && new Set(availabilityValues).size >= 2) {
    facets.push({
      id: "availability",
      coverage: availabilityValues.length,
      distinctValues: new Set(availabilityValues).size,
      priority: CONTEXTUAL_FACET_PRIORITY.availability ?? 0,
    });
  }
  return facets
    .sort(
      (left, right) =>
        right.coverage - left.coverage ||
        right.priority - left.priority ||
        left.distinctValues - right.distinctValues ||
        left.id.localeCompare(right.id),
    )
    .slice(0, MAX_CONTEXTUAL_COLLECTION_FACETS)
    .map(({ id }) => id);
}

function collectionPresentation(
  input: CollectionCommerceRouteInput,
): CollectionCommerceRoutePresentation | null {
  const dynamicSection = input.page.sections.find(
    (section) => section.visible && section.component === "dynamicCollectionCommerce",
  );
  if (dynamicSection) {
    const { collectionId, productIds, canonicalRevision, ...content } =
      dynamicCollectionCommerceBridgeContentSchema.parse(dynamicSection.content);
    if (collectionId !== input.collection.id) {
      throw new Error("Collection route binding does not reference the canonical collection.");
    }
    if (
      productIds.length !== input.collection.productIds.length ||
      productIds.some((productId, index) => productId !== input.collection.productIds[index])
    ) {
      throw new Error("Collection route membership must preserve canonical order.");
    }
    const products = productIds.map((productId) => {
      const product = input.aggregate.catalogue.products.find(
        (candidate) => candidate.id === productId,
      );
      if (!product) throw new Error("A collection product binding does not resolve.");
      return product;
    });
    const revision = revisionFor(input);
    if (canonicalRevision !== revision) {
      throw new Error("Collection route binding revision does not match the canonical catalogue.");
    }
    const productContexts = products.map((product) => productContext(product, revision));
    const approvedMedia = approvedCollectionMedia(dynamicSection);
    const approvedCollectionHeroId = approvedMedia.metadata.find(
      ({ role }) => role === "collectionImage",
    )?.assetId;
    const collection = collectionContext(
      input.collection,
      products,
      contextualCollectionFilterIds(input.collection, products),
      revision,
      approvedCollectionHeroId ?? products[0]?.images[0]?.id,
      approvedMedia.assets.filter(({ assetId }) => assetId !== approvedCollectionHeroId),
    );
    const projection: ComponentProjectionContext = {
      evidenceReferences: [],
      products: productContexts,
      collections: [collection],
      assets: [
        ...productAssets(productContexts, new Set(), {
          component: dynamicCollectionCommerceDefinition,
          variant: dynamicSection.variant,
          brandSystem: input.snapshot.brandSystem,
        }),
        ...approvedMedia.metadata,
      ],
      navigation: [],
      projectBrandContexts: [],
      localizedContents: [],
      productListRevision: revision,
      collectionListRevision: revision,
    };
    return {
      instance: {
        id: dynamicSection.id,
        component: "dynamicCollectionCommerce",
        componentVersion: dynamicCollectionCommerceDefinition.version,
        variant: dynamicSection.variant,
        content,
        props: dynamicCollectionCommercePropsSchema.parse(dynamicSection.props),
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
            productIds,
            revision,
          },
        ],
        assetAssignments: [...approvedMedia.assignments],
      },
      projection,
      resolveAssetUrl: assetUrlResolver(input.aggregate.catalogue, approvedMedia.urls),
    };
  }
  if (
    !hasCompatibleVisibleLayout(input.page, COLLECTION_COMPONENTS, COLLECTION_COMPONENT_ORDER, [
      "collectionHeader",
      "productGrid",
    ])
  ) {
    return null;
  }
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
  const collection = collectionContext(
    input.collection,
    products,
    filters,
    revision,
    products[0]?.images[0]?.id,
  );
  const projection: ComponentProjectionContext = {
    evidenceReferences: [],
    products: productContexts,
    collections: [collection],
    assets: productAssets(productContexts, new Set(), {
      component: dynamicCollectionCommerceDefinition,
      variant: "standard",
      brandSystem: input.snapshot.brandSystem,
    }),
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

function searchPresentation(
  input: StorefrontSearchCommerceRouteInput,
): StorefrontSearchCommerceRoutePresentation | null {
  if (
    input.page.pageFamily?.familyId !== "search-results" ||
    input.page.pageFamily.commerceContext.kind !== "search"
  ) {
    throw new Error("Search commerce presentation requires the canonical search page family.");
  }
  const dynamicSection = input.page.sections.find(
    (section) => section.visible && section.component === "dynamicCollectionCommerce",
  );
  if (!dynamicSection) return null;

  const search = storefrontSearchResultPageV1Schema.parse(input.results);
  const currentCatalogueFingerprint = canonicalValueFingerprint(input.aggregate.catalogue);
  if (search.catalogueFingerprint !== currentCatalogueFingerprint) {
    throw new Error("Search results no longer match the current canonical catalogue.");
  }
  if (search.totalCount < search.productIds.length) {
    throw new Error("Search result totals cannot be smaller than the current result page.");
  }
  const {
    productIds: routeProductIds,
    canonicalRevision: routeCanonicalRevision,
    ...content
  } = dynamicSearchCommerceBridgeContentSchema.parse(dynamicSection.content);
  const canonicalRevision = revisionFor(input);
  if (routeCanonicalRevision !== canonicalRevision) {
    throw new Error("Search route bindings no longer match the current canonical catalogue.");
  }
  if (
    routeProductIds.length !== search.productIds.length ||
    routeProductIds.some((productId, index) => productId !== search.productIds[index])
  ) {
    throw new Error("Search route bindings must exactly match the transient result page.");
  }

  const currentProductRouteIds = new Set(
    (input.snapshot.dynamicCommercePresentation?.routeInventory ?? []).flatMap((route) =>
      route.kind === "product" ? [route.productId] : [],
    ),
  );
  const products = search.productIds.map((productId) => {
    const product = input.aggregate.catalogue.products.find(
      (candidate) => candidate.id === productId,
    );
    if (!product) throw new Error(`Search result product ${productId} is no longer available.`);
    if (!currentProductRouteIds.has(productId)) {
      throw new Error(`Search result product ${productId} has no current public product route.`);
    }
    return product;
  });
  const productContexts = products.map((product) => productContext(product, canonicalRevision));
  const projection: ComponentProjectionContext = {
    evidenceReferences: Array.from(input.evidenceReferences ?? [], (reference) =>
      structuredClone(reference),
    ),
    products: productContexts,
    collections: [],
    assets: productAssets(productContexts, new Set(), {
      component: dynamicCollectionCommerceDefinition,
      variant: dynamicSection.variant,
      brandSystem: input.snapshot.brandSystem,
    }),
    navigation: [],
    projectBrandContexts: [],
    localizedContents: [],
    productListRevision: search.resultFingerprint,
  };

  return {
    instance: {
      id: dynamicSection.id,
      component: "dynamicCollectionCommerce",
      componentVersion: dynamicCollectionCommerceDefinition.version,
      variant: dynamicSection.variant,
      content: dynamicCollectionCommerceContentSchema.parse(content),
      props: dynamicCollectionCommercePropsSchema.parse(dynamicSection.props),
      styleOverrides: collectionCommerceStyleOverrides(dynamicSection),
      bindings: [
        {
          slotId: "collectionProducts",
          source: "productList",
          productIds: [...search.productIds],
          revision: search.resultFingerprint,
        },
      ],
      assetAssignments: [],
    },
    projection,
    search,
    resolveAssetUrl: assetUrlResolver(input.aggregate.catalogue),
  };
}

export function createCatalogueStorefrontCommerceRouteAdapter(): StorefrontSearchCommerceRouteAdapter {
  const adapter = {
    product: productPresentation,
    collection: collectionPresentation,
    search: searchPresentation,
  } satisfies StorefrontSearchCommerceRouteAdapter;
  return adapter;
}
