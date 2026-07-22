"use client";

import Image from "next/image";
import { useId } from "react";
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
  safeExternalUrlSchema,
  type AssetRef,
  type Locale,
  type LocalizedText,
} from "@/domain/shared";
import {
  dynamicCollectionCommerceContentSchema,
  dynamicCollectionCommercePropsSchema,
  dynamicCollectionCommerceStyleOverridesSchema,
  dynamicCollectionCommerceVariantSchema,
  veskifyComponentRegistryV2,
  type DynamicCollectionCommerceContent,
  type DynamicCollectionCommerceProps,
  type DynamicCollectionCommerceStyleOverrides,
  type DynamicCollectionCommerceVariant,
} from "@/components/registry";
import styles from "./dynamic-collection-commerce.module.css";

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
  z
    .object({
      type: z.literal("setCollectionFilterRange"),
      collectionId: idSchema,
      collectionRevision: z.string().trim().min(1).max(120),
      filterId: idSchema,
      min: z.number(),
      max: z.number(),
    })
    .strict(),
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
type ResolvedAsset = { asset: AssetRef; provenance: StorefrontAssetMetadata["provenance"] };

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
};

const arraysEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const text = (value: LocalizedText, locale: LocaleContext) =>
  resolveLocalizedText(value, locale.activeLocale, locale.primaryLocale);

const fallback = (en: string, fi: string, locale: LocaleContext) =>
  locale.activeLocale === "fi" ? fi : en;

function requiredAssetRoles(
  collection: CollectionPresentationContext,
  products: readonly ProductPresentationContext[],
) {
  const required = new Map<string, "collectionImage" | "productMainImage">();
  const add = (assetId: string, role: "collectionImage" | "productMainImage") => {
    const existing = required.get(assetId);
    if (existing !== undefined && existing !== role) {
      throw new Error(`Canonical asset ${assetId} cannot fill conflicting collection roles.`);
    }
    required.set(assetId, role);
  };
  const hero = collection.assets.find((asset) => asset.role === "hero");
  if (hero) add(hero.assetId, "collectionImage");
  products.forEach((product) => {
    const media = product.media[0];
    if (media) add(media.assetId, "productMainImage");
  });
  return required;
}

function prepareDynamicCollectionCommerce(
  input: DynamicCollectionCommerceRendererInput,
): PreparedDynamicCollectionCommerce {
  const instance = veskifyComponentRegistryV2.validateInstanceConformance(
    input.instance,
    input.projection,
  );
  if (instance.component !== "dynamicCollectionCommerce") {
    throw new Error("The collection renderer requires a dynamicCollectionCommerce instance.");
  }
  const projection = componentProjectionContextSchema.parse(input.projection);
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

  const requiredAssets = requiredAssetRoles(collection, products);
  const assignedAssets = new Map(
    instance.assetAssignments.map((assignment) => [assignment.assetId, assignment.role]),
  );
  const assetMetadata = new Map(projection.assets.map((asset) => [asset.assetId, asset]));
  if (assignedAssets.size > 0) {
    for (const [assetId, expectedRole] of requiredAssets) {
      if (assignedAssets.get(assetId) !== expectedRole) {
        throw new Error(`Missing canonical collection asset assignment: ${assetId}.`);
      }
    }
    for (const assetId of assignedAssets.keys()) {
      if (!requiredAssets.has(assetId)) {
        throw new Error(`Unused collection asset assignment is not permitted: ${assetId}.`);
      }
    }
  } else {
    for (const [assetId, expectedRole] of requiredAssets) {
      const metadata = assetMetadata.get(assetId);
      if (!metadata) throw new Error(`Collection media is missing from inventory: ${assetId}.`);
      if (metadata.approvalStatus !== "approved") {
        throw new Error(`Collection media is not approved: ${assetId}.`);
      }
      if (metadata.role !== expectedRole) {
        throw new Error(`Collection media role does not match metadata: ${assetId}.`);
      }
    }
  }

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
        provenance: metadata.provenance,
      };
    },
  };
}

function CommerceImage({ resolved, locale }: { resolved: ResolvedAsset; locale: LocaleContext }) {
  const alt =
    resolved.asset.decorative || !resolved.asset.alt ? "" : text(resolved.asset.alt, locale);
  const external = safeExternalUrlSchema.safeParse(resolved.asset.url);
  if (external.success) {
    return (
      // The canonical asset contract permits HTTPS only; native rendering avoids unsafe wildcard hosts.
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} height={900} src={new URL(external.data.trim()).href} width={1200} />
    );
  }
  return <Image alt={alt} height={900} src={resolved.asset.url} width={1200} />;
}

function moneyLabel(
  value: NonNullable<ProductPresentationContext["price"]>,
  locale: LocaleContext,
) {
  if (value.formatted) return text(value.formatted, locale);
  return new Intl.NumberFormat(locale.activeLocale === "fi" ? "fi-FI" : "en-FI", {
    style: "currency",
    currency: value.currency,
  }).format(value.amount);
}

export function DynamicCollectionProductCard({
  product,
  locale,
  assetFor,
  content,
  props,
  onNavigateProduct,
}: {
  product: ProductPresentationContext;
  locale: LocaleContext;
  assetFor: PreparedDynamicCollectionCommerce["assetFor"];
  content: DynamicCollectionCommerceContent;
  props: DynamicCollectionCommerceProps;
  onNavigateProduct: DynamicCollectionCommerceRendererInput["onNavigateProduct"];
}) {
  const titleId = useId();
  const media = product.media[0];
  const image = media ? assetFor(media.assetId, media.alt ?? product.title) : undefined;
  const attributes = product.attributeGroups
    .flatMap((group) => group.attributes)
    .slice(0, props.conciseAttributeLimit);
  const sale =
    product.price !== undefined &&
    product.compareAtPrice !== undefined &&
    product.compareAtPrice.amount > product.price.amount;
  const emitNavigation = () =>
    onNavigateProduct(
      productNavigationIntentSchema.parse({
        type: "navigateToProduct",
        productId: product.productId,
        catalogueRevision: product.revision,
      }),
    );
  return (
    <article
      aria-labelledby={titleId}
      className={`${styles.productCard} ${styles[`card_${props.cardVariant}`]}`}
      data-product-type={product.productTypeId}
    >
      <div className={styles.productMedia}>
        {image ? (
          <figure data-asset-id={media.assetId} data-asset-provenance={image.provenance.kind}>
            <CommerceImage locale={locale} resolved={image} />
          </figure>
        ) : (
          <p className={styles.mediaPlaceholder}>{text(content.mediaPlaceholderLabel, locale)}</p>
        )}
      </div>
      <div className={styles.productCopy}>
        {props.showBadges && (sale || product.priceUnavailableReason) ? (
          <p className={styles.badges}>
            {sale
              ? fallback("Sale", "Alennus", locale)
              : fallback("Price unavailable", "Hinta ei ole saatavilla", locale)}
          </p>
        ) : null}
        <h3 id={titleId}>
          <button onClick={emitNavigation} type="button">
            {text(product.title, locale)}
          </button>
        </h3>
        <div className={styles.priceRow}>
          {product.price ? (
            <span className={styles.price}>{moneyLabel(product.price, locale)}</span>
          ) : (
            <span className={styles.priceUnavailable}>
              {text(product.priceUnavailableReason!, locale)}
            </span>
          )}
          {product.compareAtPrice ? <del>{moneyLabel(product.compareAtPrice, locale)}</del> : null}
        </div>
        {product.availability ? (
          <p className={styles.availability}>{text(product.availability, locale)}</p>
        ) : null}
        {attributes.length ? (
          <dl className={styles.attributes}>
            {attributes.map((attribute) => (
              <div key={attribute.id}>
                <dt>{text(attribute.label, locale)}</dt>
                <dd>
                  {text(attribute.value, locale)}
                  {attribute.unit ? ` ${text(attribute.unit, locale)}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </article>
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
          <figure data-asset-id={hero!.assetId} data-asset-provenance={image.provenance.kind}>
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

function CollectionFilters({
  input,
  locale,
}: {
  input: PreparedDynamicCollectionCommerce;
  locale: LocaleContext;
}) {
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
    <details className={`${styles.filters} ${styles[`filters_${input.props.filterLayout}`]}`}>
      <summary>{text(input.content.filterTriggerLabel, locale)}</summary>
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
                <div className={styles.rangeControls}>
                  <label>
                    {fallback("Minimum", "Vähimmäisarvo", locale)}
                    <input
                      aria-label={`${text(filter.label, locale)} ${fallback("minimum", "vähimmäisarvo", locale)}`}
                      max={range.max}
                      min={range.min}
                      onChange={(event) =>
                        emit({
                          type: "setCollectionFilterRange",
                          collectionId: input.collection.collectionId,
                          collectionRevision: input.collection.revision,
                          filterId: filter.id,
                          min: Number(event.target.value),
                          max: range.selectedMax ?? range.max,
                        })
                      }
                      step={range.step}
                      type="range"
                      value={range.selectedMin ?? range.min}
                    />
                  </label>
                  <label>
                    {fallback("Maximum", "Enimmäisarvo", locale)}
                    <input
                      aria-label={`${text(filter.label, locale)} ${fallback("maximum", "enimmäisarvo", locale)}`}
                      max={range.max}
                      min={range.min}
                      onChange={(event) =>
                        emit({
                          type: "setCollectionFilterRange",
                          collectionId: input.collection.collectionId,
                          collectionRevision: input.collection.revision,
                          filterId: filter.id,
                          min: range.selectedMin ?? range.min,
                          max: Number(event.target.value),
                        })
                      }
                      step={range.step}
                      type="range"
                      value={range.selectedMax ?? range.max}
                    />
                  </label>
                  {range.unit ? <span>{text(range.unit, locale)}</span> : null}
                </div>
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
      data-responsive-layout="content-driven"
    >
      <CollectionHeader input={input} locale={locale} />
      <ChildCollectionNavigation input={input} locale={locale} />
      <div className={styles.commerceLayout}>
        <CollectionFilters input={input} locale={locale} />
        <section aria-busy={input.loading.status === "loading"} aria-labelledby={productsHeadingId}>
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
