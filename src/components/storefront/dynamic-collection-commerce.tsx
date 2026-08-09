"use client";

import { useEffect, useId, useState } from "react";
import { z } from "zod";
import {
  componentProjectionContextSchema,
  type CollectionPresentationContext,
  type ProductPresentationContext,
  type StorefrontAssetMetadata,
} from "@/domain/component-platform";
import {
  assetRefSchema,
  idSchema,
  localeSchema,
  resolveLocalizedText,
  type AssetRef,
  type Locale,
  type LocalizedText,
} from "@/domain/shared";
import {
  dynamicCollectionCommerceContentSchema,
  dynamicCollectionCommercePropsSchema,
  dynamicCollectionCommerceStyleOverridesSchema,
  dynamicCollectionCommerceVariantSchema,
  type DynamicCollectionCommerceContent,
  type DynamicCollectionCommerceProps,
  type DynamicCollectionCommerceStyleOverrides,
  type DynamicCollectionCommerceVariant,
} from "@/components/registry/dynamic-collection-commerce";
import { veskifyComponentRegistryV2 } from "@/components/registry/v2-registry";
import styles from "./dynamic-collection-commerce.module.css";
import { validateRouteUsedAssetConformance } from "./storefront-asset-conformance";
import { ResponsiveStorefrontImage } from "./responsive-storefront-image";
import { CanonicalProductCard } from "./canonical-product-card";
import type { CanonicalProductCardContext } from "@/domain/product-card";

export const collectionLoadingPresentationSchema = z
  .object({ status: z.enum(["ready", "loading"]) })
  .strict();

export const productNavigationIntentSchema = z
  .object({
    type: z.literal("navigateToProduct"),
    productId: idSchema,
    catalogueRevision: z.string().trim().min(1).max(120),
  })
  .strict();

export const collectionNavigationIntentSchema = z
  .object({
    type: z.literal("navigateToCollection"),
    collectionId: idSchema,
    collectionRevision: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const collectionRangeFilterIntentSchema = z
  .object({
    type: z.literal("setCollectionFilterRange"),
    collectionId: idSchema,
    collectionRevision: z.string().trim().min(1).max(120),
    filterId: idSchema,
    min: z.number().finite(),
    max: z.number().finite(),
  })
  .strict()
  .refine((intent) => intent.min <= intent.max, {
    message: "Collection range filter minimum cannot exceed its maximum.",
    path: ["min"],
  });

export const collectionFilterIntentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("setCollectionFilterValue"),
      collectionId: idSchema,
      collectionRevision: z.string().trim().min(1).max(120),
      filterId: idSchema,
      valueId: idSchema,
      selected: z.boolean(),
    })
    .strict(),
  collectionRangeFilterIntentSchema,
  z
    .object({
      type: z.literal("clearCollectionFilter"),
      collectionId: idSchema,
      collectionRevision: z.string().trim().min(1).max(120),
      filterId: idSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("clearAllCollectionFilters"),
      collectionId: idSchema,
      collectionRevision: z.string().trim().min(1).max(120),
    })
    .strict(),
]);

export const collectionSortIntentSchema = z
  .object({
    type: z.literal("sortCollectionProducts"),
    collectionId: idSchema,
    collectionRevision: z.string().trim().min(1).max(120),
    sortId: idSchema,
  })
  .strict();

export type ProductNavigationIntent = z.infer<typeof productNavigationIntentSchema>;
export type CollectionNavigationIntent = z.infer<typeof collectionNavigationIntentSchema>;
export type CollectionFilterIntent = z.infer<typeof collectionFilterIntentSchema>;
export type CollectionSortIntent = z.infer<typeof collectionSortIntentSchema>;

export type DynamicCollectionCommerceRendererInput = {
  target: "editor" | "preview" | "published";
  instance: unknown;
  projection: unknown;
  activeLocale: Locale;
  primaryLocale: Locale;
  loading: { status: "ready" | "loading" };
  resolveAssetUrl: (assetId: string) => string;
  onNavigateProduct: (intent: ProductNavigationIntent) => void;
  onNavigateCollection: (intent: CollectionNavigationIntent) => void;
  onFilterIntent: (intent: CollectionFilterIntent) => void;
  onSortIntent: (intent: CollectionSortIntent) => void;
};

type LocaleContext = { activeLocale: Locale; primaryLocale: Locale };
type ResolvedAsset = {
  asset: AssetRef;
  metadata: StorefrontAssetMetadata;
  provenance: StorefrontAssetMetadata["provenance"];
  role: StorefrontAssetMetadata["role"];
  artDirection?: StorefrontAssetMetadata["artDirection"];
};
type ProductMediaPresentation = ProductPresentationContext["media"][number];
type CollectionCommerceAssetRole =
  "collectionImage" | "productMainImage" | "productAlternativeImage" | "editorialImage";
type SelectedCardMedia = {
  media: ProductMediaPresentation;
  role: Exclude<CollectionCommerceAssetRole, "collectionImage">;
};

type PreparedDynamicCollectionCommerce = Omit<
  DynamicCollectionCommerceRendererInput,
  "instance" | "projection" | "loading" | "resolveAssetUrl"
> & {
  collection: CollectionPresentationContext;
  products: ProductPresentationContext[];
  childCollections: CollectionPresentationContext[];
  variant: DynamicCollectionCommerceVariant;
  content: DynamicCollectionCommerceContent;
  props: DynamicCollectionCommerceProps;
  styleOverrides: DynamicCollectionCommerceStyleOverrides;
  loading: z.infer<typeof collectionLoadingPresentationSchema>;
  assetFor: (assetId: string, alt?: LocalizedText) => ResolvedAsset;
  cardMediaFor: (productId: string) => ProductMediaPresentation | undefined;
};

const arraysEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const text = (value: LocalizedText, locale: LocaleContext) =>
  resolveLocalizedText(value, locale.activeLocale, locale.primaryLocale);

const fallback = (en: string, fi: string, locale: LocaleContext) =>
  locale.activeLocale === "fi" ? fi : en;

function productMediaAssetRole(role: ProductMediaPresentation["role"]): SelectedCardMedia["role"] {
  if (role === "main") return "productMainImage";
  if (role === "editorial") return "editorialImage";
  return "productAlternativeImage";
}

function selectCardMedia(product: ProductPresentationContext): SelectedCardMedia | undefined {
  const media = product.media.find(({ role }) => role !== "editorial");
  return media ? { media, role: productMediaAssetRole(media.role) } : undefined;
}

function requiredAssetRoles(
  collection: CollectionPresentationContext,
  selectedCardMedia: ReadonlyMap<string, SelectedCardMedia>,
  assetMetadata: ReadonlyMap<string, StorefrontAssetMetadata>,
) {
  const required = new Map<string, CollectionCommerceAssetRole>();
  const add = (assetId: string, role: CollectionCommerceAssetRole) => {
    const existing = required.get(assetId);
    if (existing !== undefined && existing !== role) {
      throw new Error(`Canonical asset ${assetId} cannot fill conflicting collection roles.`);
    }
    required.set(assetId, role);
  };
  const hero = collection.assets.find((asset) => asset.role === "hero");
  if (hero) {
    const heroRole = assetMetadata.get(hero.assetId)?.role ?? "collectionImage";
    if (
      ![
        "collectionImage",
        "productMainImage",
        "productAlternativeImage",
        "editorialImage",
      ].includes(heroRole)
    ) {
      throw new Error(`Canonical collection hero role is not supported: ${hero.assetId}.`);
    }
    add(hero.assetId, heroRole as CollectionCommerceAssetRole);
  }
  selectedCardMedia.forEach(({ media, role }) => add(media.assetId, role));
  return required;
}

export function validateDynamicCollectionCommerceRoutePresentation(
  instanceInput: unknown,
  projectionInput: unknown,
) {
  const instance = veskifyComponentRegistryV2.validateInstanceConformance(
    instanceInput,
    projectionInput,
  );
  if (instance.component !== "dynamicCollectionCommerce") {
    throw new Error("The collection renderer requires a dynamicCollectionCommerce instance.");
  }
  const projection = componentProjectionContextSchema.parse(projectionInput);
  const collectionBinding = instance.bindings.find(
    (binding) => binding.slotId === "primaryCollection" && binding.source === "collection",
  );
  const productBinding = instance.bindings.find(
    (binding) => binding.slotId === "collectionProducts" && binding.source === "productList",
  );
  if (collectionBinding?.source !== "collection" || productBinding?.source !== "productList") {
    throw new Error(
      "The collection renderer requires canonical collection and product-list bindings.",
    );
  }
  const collection = projection.collections.find(
    (candidate) => candidate.collectionId === collectionBinding.collectionId,
  );
  if (!collection) throw new Error(`Unknown collection: ${collectionBinding.collectionId}.`);
  if (!arraysEqual(productBinding.productIds, collection.productIds)) {
    throw new Error(
      "The product-list binding must exactly match canonical collection membership and order.",
    );
  }
  const products = productBinding.productIds.map((productId) => {
    const product = projection.products.find((candidate) => candidate.productId === productId);
    if (!product) throw new Error(`Unknown collection product: ${productId}.`);
    return product;
  });

  const childBinding = instance.bindings.find(
    (binding) => binding.slotId === "childCollections" && binding.source === "collectionList",
  );
  if (
    childBinding?.source === "collectionList" &&
    !arraysEqual(childBinding.collectionIds, collection.childCollectionIds ?? [])
  ) {
    throw new Error(
      "The child-collection binding must exactly match canonical child collection order.",
    );
  }
  const childCollections =
    childBinding?.source === "collectionList"
      ? childBinding.collectionIds.map((collectionId) => {
          const child = projection.collections.find(
            (candidate) => candidate.collectionId === collectionId,
          );
          if (!child) throw new Error(`Unknown child collection: ${collectionId}.`);
          return child;
        })
      : [];

  const assetMetadata = new Map(projection.assets.map((asset) => [asset.assetId, asset]));
  const selectedCardMedia = new Map(
    products.flatMap((product) => {
      const selected = selectCardMedia(product);
      return selected ? [[product.productId, selected] as const] : [];
    }),
  );
  const requiredAssets = requiredAssetRoles(collection, selectedCardMedia, assetMetadata);
  validateRouteUsedAssetConformance({
    instance,
    projection,
    requiredAssets,
    boundary: "collection",
  });
  return {
    instance,
    projection,
    collection,
    products,
    childCollections,
    selectedCardMedia,
    requiredAssets,
    assetMetadata,
  };
}

function prepareDynamicCollectionCommerce(
  input: DynamicCollectionCommerceRendererInput,
): PreparedDynamicCollectionCommerce {
  const {
    instance,
    collection,
    products,
    childCollections,
    selectedCardMedia,
    requiredAssets,
    assetMetadata,
  } = validateDynamicCollectionCommerceRoutePresentation(input.instance, input.projection);

  return {
    target: input.target,
    collection,
    products,
    childCollections,
    variant: dynamicCollectionCommerceVariantSchema.parse(instance.variant),
    content: dynamicCollectionCommerceContentSchema.parse(instance.content),
    props: dynamicCollectionCommercePropsSchema.parse(instance.props),
    styleOverrides: dynamicCollectionCommerceStyleOverridesSchema.parse(instance.styleOverrides),
    activeLocale: localeSchema.parse(input.activeLocale),
    primaryLocale: localeSchema.parse(input.primaryLocale),
    loading: collectionLoadingPresentationSchema.parse(input.loading),
    onNavigateProduct: input.onNavigateProduct,
    onNavigateCollection: input.onNavigateCollection,
    onFilterIntent: input.onFilterIntent,
    onSortIntent: input.onSortIntent,
    cardMediaFor(productId) {
      return selectedCardMedia.get(productId)?.media;
    },
    assetFor(assetId, alt) {
      const metadata = assetMetadata.get(assetId);
      if (!metadata || metadata.approvalStatus !== "approved") {
        throw new Error(`Collection media requires approved asset metadata: ${assetId}.`);
      }
      const expectedRole = requiredAssets.get(assetId);
      if (!expectedRole || metadata.role !== expectedRole) {
        throw new Error(`Collection media requires its canonical approved role: ${assetId}.`);
      }
      return {
        asset: assetRefSchema.parse({
          id: assetId,
          url: input.resolveAssetUrl(assetId),
          alt: alt ?? metadata.alt,
          decorative: metadata.decorative,
        }),
        metadata,
        provenance: metadata.provenance,
        role: metadata.role,
        ...(metadata.artDirection === undefined ? {} : { artDirection: metadata.artDirection }),
      };
    },
  };
}

function CommerceImage({ resolved, locale }: { resolved: ResolvedAsset; locale: LocaleContext }) {
  const alt =
    resolved.asset.decorative || !resolved.asset.alt ? "" : text(resolved.asset.alt, locale);
  return (
    <ResponsiveStorefrontImage alt={alt} asset={resolved.asset} authority={resolved.artDirection} />
  );
}

export function DynamicCollectionProductCard({
  product,
  media,
  locale,
  assetFor,
  content,
  props,
  onNavigateProduct,
  context = "collectionResults",
}: {
  product: ProductPresentationContext;
  media?: ProductMediaPresentation;
  locale: LocaleContext;
  assetFor: PreparedDynamicCollectionCommerce["assetFor"];
  content: DynamicCollectionCommerceContent;
  props: DynamicCollectionCommerceProps;
  onNavigateProduct: DynamicCollectionCommerceRendererInput["onNavigateProduct"];
  context?: CanonicalProductCardContext;
}) {
  const image = media ? assetFor(media.assetId, media.alt ?? product.title) : undefined;
  return (
    <CanonicalProductCard
      locale={locale}
      mediaPlaceholder={text(content.mediaPlaceholderLabel, locale)}
      onNavigateProduct={(intent) => onNavigateProduct(productNavigationIntentSchema.parse(intent))}
      request={{
        anatomyId: props.cardVariant,
        context,
        product,
        ...(media && image ? { media, asset: image.metadata } : {}),
        showCanonicalBadge: props.showBadges,
        conciseAttributeLimit: props.conciseAttributeLimit,
      }}
      resolvedAsset={image?.asset}
    />
  );
}

function CollectionHeader({
  input,
  locale,
}: {
  input: PreparedDynamicCollectionCommerce;
  locale: LocaleContext;
}) {
  const titleId = useId();
  const hero = input.collection.assets.find((asset) => asset.role === "hero");
  const image = hero ? input.assetFor(hero.assetId, input.collection.title) : undefined;
  return (
    <header className={styles.collectionHeader}>
      {input.collection.breadcrumbs?.length ? (
        <nav aria-label={fallback("Breadcrumb", "Murupolku", locale)}>
          <ol>
            {input.collection.breadcrumbs.map((item) => (
              <li key={item.collectionId}>
                <button
                  onClick={() =>
                    input.onNavigateCollection({
                      type: "navigateToCollection",
                      collectionId: item.collectionId,
                    })
                  }
                  type="button"
                >
                  {text(item.label, locale)}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className={styles.collectionHeaderLayout}>
        <div>
          <h1 id={titleId}>{text(input.collection.title, locale)}</h1>
          {input.props.showDescription && input.collection.description ? (
            <p>{text(input.collection.description, locale)}</p>
          ) : null}
          {input.props.showProductCount ? (
            <p aria-live="polite">
              {input.collection.productIds.length} {fallback("products", "tuotetta", locale)}
            </p>
          ) : null}
        </div>
        {image ? (
          <figure
            data-asset-id={hero!.assetId}
            data-asset-provenance={image.provenance.kind}
            data-asset-role={image.role}
          >
            <CommerceImage locale={locale} resolved={image} />
          </figure>
        ) : null}
      </div>
    </header>
  );
}

function ChildCollectionNavigation({
  input,
  locale,
}: {
  input: PreparedDynamicCollectionCommerce;
  locale: LocaleContext;
}) {
  if (!input.props.showChildCollections || input.childCollections.length === 0) return null;
  return (
    <nav aria-label={fallback("Related collections", "Liittyvät mallistot", locale)}>
      <ul className={styles.childCollections}>
        {input.childCollections.map((collection) => (
          <li key={collection.collectionId}>
            <button
              onClick={() =>
                input.onNavigateCollection({
                  type: "navigateToCollection",
                  collectionId: collection.collectionId,
                  collectionRevision: collection.revision,
                })
              }
              type="button"
            >
              {text(collection.title, locale)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type CollectionRangePresentation = NonNullable<
  CollectionPresentationContext["filters"][number]["range"]
>;

function decimalPlaces(value: number) {
  const [coefficient = "", exponentText] = Math.abs(value).toString().toLowerCase().split("e");
  const [, decimals = ""] = coefficient.split(".");
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  return Math.max(0, decimals.length - exponent);
}

function normalizeRangeValue(
  rawValue: number,
  range: CollectionRangePresentation,
  lowerBound: number,
  upperBound: number,
) {
  if (!Number.isFinite(rawValue)) return undefined;
  const clamped = Math.min(upperBound, Math.max(lowerBound, rawValue));
  if (range.step === undefined) return clamped;
  const snapped = range.min + Math.round((clamped - range.min) / range.step) * range.step;
  const precision = Math.max(decimalPlaces(range.min), decimalPlaces(range.step));
  return Math.min(upperBound, Math.max(lowerBound, Number(snapped.toFixed(precision))));
}

export function createCollectionRangeFilterIntent({
  collectionId,
  collectionRevision,
  filterId,
  range,
  changedBound,
  rawValue,
}: {
  collectionId: string;
  collectionRevision: string;
  filterId: string;
  range: CollectionRangePresentation;
  changedBound: "min" | "max";
  rawValue: number;
}) {
  const currentMin = range.selectedMin ?? range.min;
  const currentMax = range.selectedMax ?? range.max;
  const normalized = normalizeRangeValue(
    rawValue,
    range,
    changedBound === "min" ? range.min : currentMin,
    changedBound === "min" ? currentMax : range.max,
  );
  if (normalized === undefined) return undefined;
  return collectionRangeFilterIntentSchema.parse({
    type: "setCollectionFilterRange",
    collectionId,
    collectionRevision,
    filterId,
    min: changedBound === "min" ? normalized : currentMin,
    max: changedBound === "max" ? normalized : currentMax,
  });
}

function CollectionRangeFilter({
  filter,
  range,
  collection,
  locale,
  emit,
}: {
  filter: CollectionPresentationContext["filters"][number];
  range: CollectionRangePresentation;
  collection: CollectionPresentationContext;
  locale: LocaleContext;
  emit: (intent: CollectionFilterIntent) => void;
}) {
  const descriptionId = useId();
  const currentMin = range.selectedMin ?? range.min;
  const currentMax = range.selectedMax ?? range.max;
  const unit = range.unit ? ` ${text(range.unit, locale)}` : "";
  const step = range.step ? ` ${fallback("Step", "Askel", locale)} ${range.step}${unit}.` : "";
  const emitBound = (changedBound: "min" | "max", rawValue: number) => {
    const intent = createCollectionRangeFilterIntent({
      collectionId: collection.collectionId,
      collectionRevision: collection.revision,
      filterId: filter.id,
      range,
      changedBound,
      rawValue,
    });
    if (intent) emit(intent);
  };
  return (
    <div className={styles.rangeControls}>
      <label>
        {fallback("Minimum", "Vähimmäisarvo", locale)}
        <input
          aria-describedby={`${descriptionId}-minimum`}
          aria-label={`${text(filter.label, locale)} ${fallback("minimum", "vähimmäisarvo", locale)}`}
          max={currentMax}
          min={range.min}
          onChange={(event) => emitBound("min", Number(event.currentTarget.value))}
          step={range.step}
          type="range"
          value={currentMin}
        />
        <span className={styles.rangeDescription} id={`${descriptionId}-minimum`}>
          {fallback("Allowed", "Sallittu", locale)} {range.min}–{currentMax}
          {unit}.{step}
        </span>
      </label>
      <label>
        {fallback("Maximum", "Enimmäisarvo", locale)}
        <input
          aria-describedby={`${descriptionId}-maximum`}
          aria-label={`${text(filter.label, locale)} ${fallback("maximum", "enimmäisarvo", locale)}`}
          max={range.max}
          min={currentMin}
          onChange={(event) => emitBound("max", Number(event.currentTarget.value))}
          step={range.step}
          type="range"
          value={currentMax}
        />
        <span className={styles.rangeDescription} id={`${descriptionId}-maximum`}>
          {fallback("Allowed", "Sallittu", locale)} {currentMin}–{range.max}
          {unit}.{step}
        </span>
      </label>
    </div>
  );
}

function CollectionFilters({
  input,
  locale,
}: {
  input: PreparedDynamicCollectionCommerce;
  locale: LocaleContext;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const expandedRail = window.matchMedia(
      input.props.filterLayout === "horizontal" ? "(min-width: 48rem)" : "(min-width: 64rem)",
    );
    const syncWithViewport = () => setOpen(expandedRail.matches);
    syncWithViewport();
    expandedRail.addEventListener("change", syncWithViewport);
    return () => expandedRail.removeEventListener("change", syncWithViewport);
  }, [input.props.filterLayout]);
  if (input.collection.filters.length === 0) return null;
  const hasSelected = input.collection.filters.some(
    (filter) =>
      filter.values.some((value) => value.selected) ||
      (filter.presentation === "range" &&
        filter.range !== undefined &&
        (filter.range.selectedMin !== undefined || filter.range.selectedMax !== undefined)),
  );
  const emit = (intent: CollectionFilterIntent) =>
    input.onFilterIntent(collectionFilterIntentSchema.parse(intent));
  return (
    <details
      className={`${styles.filters} ${styles[`filters_${input.props.filterLayout}`]}`}
      data-layout-region="filters"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary role="button">{text(input.content.filterTriggerLabel, locale)}</summary>
      <div className={styles.filterPanel}>
        <div className={styles.filterHeading}>
          <h2>{text(input.content.filtersHeading, locale)}</h2>
          <button
            disabled={!hasSelected}
            onClick={() =>
              emit({
                type: "clearAllCollectionFilters",
                collectionId: input.collection.collectionId,
                collectionRevision: input.collection.revision,
              })
            }
            type="button"
          >
            {text(input.content.clearAllLabel, locale)}
          </button>
        </div>
        {input.collection.filters.map((filter) => {
          const isRange = filter.presentation === "range";
          const range = filter.range;
          return (
            <fieldset key={filter.id}>
              <legend>{text(filter.label, locale)}</legend>
              {isRange && range ? (
                <CollectionRangeFilter
                  collection={input.collection}
                  emit={emit}
                  filter={filter}
                  locale={locale}
                  range={range}
                />
              ) : (
                <ul>
                  {filter.values.map((value) => (
                    <li key={value.id}>
                      <label>
                        <input
                          checked={value.selected ?? false}
                          disabled={value.disabled ?? false}
                          onChange={() => {
                            if (!value.disabled) {
                              emit({
                                type: "setCollectionFilterValue",
                                collectionId: input.collection.collectionId,
                                collectionRevision: input.collection.revision,
                                filterId: filter.id,
                                valueId: value.id,
                                selected: !(value.selected ?? false),
                              });
                            }
                          }}
                          type="checkbox"
                        />
                        <span>{text(value.label, locale)}</span>
                        {value.count !== undefined ? <span>({value.count})</span> : null}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <button
                disabled={
                  !filter.values.some((value) => value.selected) &&
                  !(
                    isRange &&
                    range &&
                    (range.selectedMin !== undefined || range.selectedMax !== undefined)
                  )
                }
                onClick={() =>
                  emit({
                    type: "clearCollectionFilter",
                    collectionId: input.collection.collectionId,
                    collectionRevision: input.collection.revision,
                    filterId: filter.id,
                  })
                }
                type="button"
              >
                {text(input.content.clearLabel, locale)} {text(filter.label, locale)}
              </button>
            </fieldset>
          );
        })}
      </div>
    </details>
  );
}

function CollectionSort({
  input,
  locale,
}: {
  input: PreparedDynamicCollectionCommerce;
  locale: LocaleContext;
}) {
  if (input.collection.sorting.length === 0) return null;
  const defaultSort =
    input.collection.sorting.find((sort) => sort.default) ?? input.collection.sorting[0];
  return (
    <label className={styles.sortControl}>
      <span>{text(input.content.sortLabel, locale)}</span>
      <select
        defaultValue={defaultSort.id}
        onChange={(event) => {
          if (!input.collection.sorting.some((sort) => sort.id === event.target.value)) return;
          input.onSortIntent(
            collectionSortIntentSchema.parse({
              type: "sortCollectionProducts",
              collectionId: input.collection.collectionId,
              collectionRevision: input.collection.revision,
              sortId: event.target.value,
            }),
          );
        }}
      >
        {input.collection.sorting.map((sort) => (
          <option key={sort.id} value={sort.id}>
            {text(sort.label, locale)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DynamicCollectionCommerce(input: PreparedDynamicCollectionCommerce) {
  const productsHeadingId = useId();
  const locale = { activeLocale: input.activeLocale, primaryLocale: input.primaryLocale };
  return (
    <main
      className={`${styles.root} ${styles[`variant_${input.variant}`]} ${styles[`surface_${input.styleOverrides.surfaceTreatment}`]}`}
      data-component="dynamicCollectionCommerce"
      data-render-target={input.target}
      data-variant={input.variant}
      data-responsive-layout="content-driven"
    >
      <CollectionHeader input={input} locale={locale} />
      <ChildCollectionNavigation input={input} locale={locale} />
      <div
        className={`${styles.commerceLayout} ${styles[`layout_${input.props.filterLayout}`]}`}
        data-filter-layout={input.props.filterLayout}
      >
        <CollectionFilters input={input} locale={locale} />
        <section
          aria-busy={input.loading.status === "loading"}
          aria-labelledby={productsHeadingId}
          className={styles.productResults}
          data-layout-region="products"
        >
          <div className={styles.productGridHeading}>
            <h2 id={productsHeadingId}>{text(input.content.productsHeading, locale)}</h2>
            <CollectionSort input={input} locale={locale} />
          </div>
          {input.loading.status === "loading" ? (
            <p aria-live="polite" className={styles.loadingState}>
              {text(input.content.loadingLabel, locale)}
            </p>
          ) : input.products.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>{text(input.collection.emptyState.title, locale)}</h3>
              {input.collection.emptyState.description ? (
                <p>{text(input.collection.emptyState.description, locale)}</p>
              ) : null}
            </div>
          ) : (
            <div
              className={`${styles.productGrid} ${styles[`density_${input.props.gridDensity}`]}`}
              data-product-count={input.products.length}
            >
              {input.products.map((product) => (
                <DynamicCollectionProductCard
                  assetFor={input.assetFor}
                  content={input.content}
                  key={product.productId}
                  locale={locale}
                  onNavigateProduct={input.onNavigateProduct}
                  media={input.cardMediaFor(product.productId)}
                  product={product}
                  props={input.props}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export const dynamicCollectionCommerceComponentByTarget = {
  editor: DynamicCollectionCommerce,
  preview: DynamicCollectionCommerce,
  published: DynamicCollectionCommerce,
} as const;

export function renderDynamicCollectionCommerce(input: DynamicCollectionCommerceRendererInput) {
  return <DynamicCollectionCommerce {...prepareDynamicCollectionCommerce(input)} />;
}
