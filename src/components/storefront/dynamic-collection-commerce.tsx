"use client";

import { useId, useState } from "react";
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
import { canonicalValueFingerprint } from "@/domain/storefront";
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
import {
  ResponsiveStorefrontImage,
  type StorefrontImageLoadingRole,
} from "./responsive-storefront-image";
import {
  resolveResponsiveExecutionAuthority,
  responsiveExecutionDataAttributes,
} from "./responsive-execution";
import { CanonicalProductCard } from "./canonical-product-card";
import type { CanonicalProductCardContext } from "@/domain/product-card";
import {
  storefrontSearchResultPageV1Schema,
  type StorefrontSearchResultPageV1,
} from "@/application/storefront-search";

export const collectionLoadingPresentationSchema = z
  .object({ status: z.enum(["ready", "loading"]) })
  .strict();

/** Transient canonical search authority; retained as an alias for renderer consumers. */
export const collectionSearchPresentationSchema = storefrontSearchResultPageV1Schema;

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
  search?: StorefrontSearchResultPageV1;
  resolveAssetUrl: (assetId: string) => string;
  onNavigateProduct: (intent: ProductNavigationIntent) => void;
  onNavigateCollection: (intent: CollectionNavigationIntent) => void;
  onFilterIntent: (intent: CollectionFilterIntent) => void;
  onSortIntent: (intent: CollectionSortIntent) => void;
  /** Executable search routes supply this continuation without creating collection authority. */
  onContinueShopping?: () => void;
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

type PreparedDynamicCollectionCommerceBase = Omit<
  DynamicCollectionCommerceRendererInput,
  "instance" | "projection" | "loading" | "resolveAssetUrl" | "search"
> & {
  products: ProductPresentationContext[];
  variant: DynamicCollectionCommerceVariant;
  content: DynamicCollectionCommerceContent;
  props: DynamicCollectionCommerceProps;
  styleOverrides: DynamicCollectionCommerceStyleOverrides;
  loading: z.infer<typeof collectionLoadingPresentationSchema>;
  assetFor: (assetId: string, alt?: LocalizedText) => ResolvedAsset;
  cardMediaFor: (productId: string) => ProductMediaPresentation | undefined;
};

type PreparedDynamicCollectionCommerce =
  | (PreparedDynamicCollectionCommerceBase & {
      runtimeContext: "collection";
      collection: CollectionPresentationContext;
      childCollections: CollectionPresentationContext[];
      search?: undefined;
    })
  | (PreparedDynamicCollectionCommerceBase & {
      runtimeContext: "search-results";
      search: StorefrontSearchResultPageV1;
      collection?: undefined;
      childCollections: [];
    });

type PreparedCollectionCommerce = Extract<
  PreparedDynamicCollectionCommerce,
  { runtimeContext: "collection" }
>;
type PreparedSearchCommerce = Extract<
  PreparedDynamicCollectionCommerce,
  { runtimeContext: "search-results" }
>;

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
  collection: CollectionPresentationContext | undefined,
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
  const hero = collection?.assets.find((asset) => asset.role === "hero");
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
  collection?.assets
    .filter((asset) => asset.role !== "hero")
    .forEach((asset) => {
      const expectedRole =
        asset.role === "editorial"
          ? "editorialImage"
          : (assetMetadata.get(asset.assetId)?.role ?? "collectionImage");
      if (
        ![
          "collectionImage",
          "productMainImage",
          "productAlternativeImage",
          "editorialImage",
        ].includes(expectedRole)
      ) {
        throw new Error(`Canonical collection asset role is not supported: ${asset.assetId}.`);
      }
      add(asset.assetId, expectedRole as CollectionCommerceAssetRole);
    });
  selectedCardMedia.forEach(({ media, role }) => add(media.assetId, role));
  return required;
}

type ValidatedCollectionPresentation = Readonly<{
  runtimeContext: "collection";
  instance: ReturnType<typeof veskifyComponentRegistryV2.validateInstanceConformance>;
  projection: z.infer<typeof componentProjectionContextSchema>;
  collection: CollectionPresentationContext;
  products: ProductPresentationContext[];
  childCollections: CollectionPresentationContext[];
  selectedCardMedia: Map<string, SelectedCardMedia>;
  requiredAssets: Map<string, CollectionCommerceAssetRole>;
  assetMetadata: Map<string, StorefrontAssetMetadata>;
}>;

type ValidatedSearchPresentation = Readonly<{
  runtimeContext: "search-results";
  instance: ReturnType<typeof veskifyComponentRegistryV2.validateInstanceConformance>;
  projection: z.infer<typeof componentProjectionContextSchema>;
  search: StorefrontSearchResultPageV1;
  products: ProductPresentationContext[];
  childCollections: [];
  selectedCardMedia: Map<string, SelectedCardMedia>;
  requiredAssets: Map<string, CollectionCommerceAssetRole>;
  assetMetadata: Map<string, StorefrontAssetMetadata>;
}>;

export function validateDynamicCollectionCommerceRoutePresentation(
  instanceInput: unknown,
  projectionInput: unknown,
): ValidatedCollectionPresentation;
export function validateDynamicCollectionCommerceRoutePresentation(
  instanceInput: unknown,
  projectionInput: unknown,
  searchInput: StorefrontSearchResultPageV1,
): ValidatedSearchPresentation;
export function validateDynamicCollectionCommerceRoutePresentation(
  instanceInput: unknown,
  projectionInput: unknown,
  searchInput?: StorefrontSearchResultPageV1,
): ValidatedCollectionPresentation | ValidatedSearchPresentation {
  const instance = veskifyComponentRegistryV2.validateInstanceConformance(
    instanceInput,
    projectionInput,
  );
  if (instance.component !== "dynamicCollectionCommerce") {
    throw new Error("The collection renderer requires a dynamicCollectionCommerce instance.");
  }
  const projection = componentProjectionContextSchema.parse(projectionInput);
  const productsById = new Map(
    projection.products.map((product) => [product.productId, product] as const),
  );
  const collectionsById = new Map(
    projection.collections.map((collection) => [collection.collectionId, collection] as const),
  );
  const collectionBinding = instance.bindings.find(
    (binding) => binding.slotId === "primaryCollection" && binding.source === "collection",
  );
  const productBinding = instance.bindings.find(
    (binding) => binding.slotId === "collectionProducts" && binding.source === "productList",
  );
  if (productBinding?.source !== "productList") {
    throw new Error("The collection/search renderer requires one canonical product-list binding.");
  }
  const childBinding = instance.bindings.find(
    (binding) => binding.slotId === "childCollections" && binding.source === "collectionList",
  );

  if (searchInput !== undefined) {
    const search = collectionSearchPresentationSchema.parse(searchInput);
    if (collectionBinding !== undefined || childBinding !== undefined) {
      throw new Error(
        "Search-result presentation cannot claim collection or child-collection authority.",
      );
    }
    if (projection.collections.length > 0) {
      throw new Error("Search-result presentation cannot project a synthetic collection.");
    }
    if (!arraysEqual(productBinding.productIds, search.productIds)) {
      throw new Error("Search product binding must exactly match transient result membership.");
    }
    if (
      productBinding.revision !== search.resultFingerprint ||
      projection.productListRevision !== search.resultFingerprint
    ) {
      throw new Error("Search product binding must retain the exact result fingerprint.");
    }
    if (
      !arraysEqual(
        projection.products.map(({ productId }) => productId),
        search.productIds,
      )
    ) {
      throw new Error("Search product projection must contain only the exact current result page.");
    }
    const products = productBinding.productIds.map((productId) => {
      const product = productsById.get(productId);
      if (!product) throw new Error(`Unknown search product: ${productId}.`);
      return product;
    });
    const assetMetadata = new Map(projection.assets.map((asset) => [asset.assetId, asset]));
    const selectedCardMedia = new Map(
      products.flatMap((product) => {
        const selected = selectCardMedia(product);
        return selected ? [[product.productId, selected] as const] : [];
      }),
    );
    const requiredAssets = requiredAssetRoles(undefined, selectedCardMedia, assetMetadata);
    validateRouteUsedAssetConformance({
      instance,
      projection,
      requiredAssets,
      boundary: "search result",
    });
    return {
      runtimeContext: "search-results",
      instance,
      projection,
      search,
      products,
      childCollections: [],
      selectedCardMedia,
      requiredAssets,
      assetMetadata,
    };
  }

  if (collectionBinding?.source !== "collection") {
    throw new Error("The collection renderer requires one canonical collection binding.");
  }
  const collection = collectionsById.get(collectionBinding.collectionId);
  if (!collection) throw new Error(`Unknown collection: ${collectionBinding.collectionId}.`);
  if (!arraysEqual(productBinding.productIds, collection.productIds)) {
    throw new Error(
      "The product-list binding must exactly match canonical collection membership and order.",
    );
  }
  const products = productBinding.productIds.map((productId) => {
    const product = productsById.get(productId);
    if (!product) throw new Error(`Unknown collection product: ${productId}.`);
    return product;
  });

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
          const child = collectionsById.get(collectionId);
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
    runtimeContext: "collection",
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
  const search =
    input.search === undefined ? undefined : collectionSearchPresentationSchema.parse(input.search);
  if (
    search?.state === "results" &&
    search.totalCount === 0 &&
    input.onContinueShopping === undefined
  ) {
    throw new Error("Search no-results presentation requires a valid continue-shopping action.");
  }
  if (search && search.totalCount < search.productIds.length) {
    throw new Error("Search result totals cannot be smaller than the current result page.");
  }
  const validated = search
    ? validateDynamicCollectionCommerceRoutePresentation(input.instance, input.projection, search)
    : validateDynamicCollectionCommerceRoutePresentation(input.instance, input.projection);
  const variant = dynamicCollectionCommerceVariantSchema.parse(validated.instance.variant);
  if (
    validated.runtimeContext === "collection" &&
    variant === "campaignLedDiscovery" &&
    !validated.collection.assets.some((asset) => asset.role === "editorial")
  ) {
    throw new Error("Campaign-led collection discovery requires approved editorial media.");
  }

  const common = {
    target: input.target,
    products: validated.products,
    variant,
    content: dynamicCollectionCommerceContentSchema.parse(validated.instance.content),
    props: dynamicCollectionCommercePropsSchema.parse(validated.instance.props),
    styleOverrides: dynamicCollectionCommerceStyleOverridesSchema.parse(
      validated.instance.styleOverrides,
    ),
    activeLocale: localeSchema.parse(input.activeLocale),
    primaryLocale: localeSchema.parse(input.primaryLocale),
    loading: collectionLoadingPresentationSchema.parse(input.loading),
    onNavigateProduct: input.onNavigateProduct,
    onNavigateCollection: input.onNavigateCollection,
    onFilterIntent: input.onFilterIntent,
    onSortIntent: input.onSortIntent,
    onContinueShopping: input.onContinueShopping,
    cardMediaFor(productId: string) {
      return validated.selectedCardMedia.get(productId)?.media;
    },
    assetFor(assetId: string, alt?: LocalizedText) {
      const metadata = validated.assetMetadata.get(assetId);
      if (!metadata || metadata.approvalStatus !== "approved") {
        throw new Error(`Commerce media requires approved asset metadata: ${assetId}.`);
      }
      const expectedRole = validated.requiredAssets.get(assetId);
      if (!expectedRole || metadata.role !== expectedRole) {
        throw new Error(`Commerce media requires its canonical approved role: ${assetId}.`);
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
  return validated.runtimeContext === "search-results"
    ? {
        ...common,
        runtimeContext: "search-results",
        search: validated.search,
        childCollections: [],
      }
    : {
        ...common,
        runtimeContext: "collection",
        collection: validated.collection,
        childCollections: validated.childCollections,
      };
}

function collectionAnatomyIdentity(variantId: DynamicCollectionCommerceVariant) {
  const anatomy = veskifyComponentRegistryV2.get("dynamicCollectionCommerce").commercialAnatomy;
  if (!anatomy) throw new Error("Dynamic collection commerce requires registered anatomy.");
  const variant = anatomy.variants.find((candidate) => candidate.variantId === variantId);
  if (!variant) throw new Error(`Missing collection anatomy variant: ${variantId}.`);
  const responsive = resolveResponsiveExecutionAuthority(anatomy, variantId);
  return {
    presentationMode: variant.structure.presentationMode,
    responsiveAttributes: responsiveExecutionDataAttributes(responsive),
  };
}

function CommerceImage({
  resolved,
  locale,
  loadingRole = "content",
}: {
  resolved: ResolvedAsset;
  locale: LocaleContext;
  loadingRole?: StorefrontImageLoadingRole;
}) {
  const alt =
    resolved.asset.decorative || !resolved.asset.alt ? "" : text(resolved.asset.alt, locale);
  return (
    <ResponsiveStorefrontImage
      alt={alt}
      asset={resolved.asset}
      authority={resolved.artDirection}
      loadingRole={loadingRole}
    />
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
  input: PreparedCollectionCommerce;
  locale: LocaleContext;
}) {
  const titleId = useId();
  const hero = input.collection.assets.find((asset) => asset.role === "hero");
  const image = hero ? input.assetFor(hero.assetId, input.collection.title) : undefined;
  const campaignEditorial =
    input.variant === "campaignLedDiscovery"
      ? input.collection.assets.find((asset) => asset.role === "editorial")
      : undefined;
  const campaignImage = campaignEditorial
    ? input.assetFor(campaignEditorial.assetId, input.collection.title)
    : undefined;
  const repeatsAdjacentCampaignMedia = Boolean(
    image &&
    campaignImage &&
    (image.asset.id === campaignImage.asset.id || image.asset.url === campaignImage.asset.url),
  );
  return (
    <header
      className={styles.collectionHeader}
      data-collection-hero-treatment={
        repeatsAdjacentCampaignMedia
          ? "text-only-adjacent-media-deduped"
          : image
            ? "media"
            : "text-only"
      }
    >
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
        {image && !repeatsAdjacentCampaignMedia ? (
          <figure
            data-asset-id={hero!.assetId}
            data-asset-provenance={image.provenance.kind}
            data-asset-role={image.role}
          >
            <CommerceImage
              loadingRole={input.variant === "campaignLedDiscovery" ? "content" : "primary"}
              locale={locale}
              resolved={image}
            />
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
  input: PreparedCollectionCommerce;
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

function CampaignLead({
  input,
  locale,
}: {
  input: PreparedCollectionCommerce;
  locale: LocaleContext;
}) {
  if (input.variant !== "campaignLedDiscovery") return null;
  const editorial = input.collection.assets.find((asset) => asset.role === "editorial");
  if (!editorial)
    throw new Error("Campaign-led collection discovery requires approved editorial media.");
  const image = input.assetFor(editorial.assetId, input.collection.title);
  return (
    <section
      aria-label={fallback("Collection editorial", "Malliston toimituksellinen kuva", locale)}
      className={styles.campaignLead}
      data-layout-region="campaign-lead"
      data-asset-id={editorial.assetId}
      data-asset-provenance={image.provenance.kind}
      data-asset-role={image.role}
    >
      <figure>
        <CommerceImage loadingRole="primary" locale={locale} resolved={image} />
      </figure>
    </section>
  );
}

function SearchResultsContext({
  input,
  locale,
}: {
  input: PreparedSearchCommerce;
  locale: LocaleContext;
}) {
  const count = input.search.totalCount;
  if (input.search.state === "empty-query") {
    return (
      <p className={styles.searchContext} data-search-state="empty-query">
        {fallback(
          "Enter a product name or detail to search the storefront.",
          "Hae verkkokaupasta kirjoittamalla tuotteen nimi tai tuotetieto.",
          locale,
        )}
      </p>
    );
  }
  return (
    <p
      aria-atomic="true"
      aria-live="polite"
      className={styles.searchContext}
      data-search-query={input.search.normalizedQuery}
      data-search-result-count={count}
      data-search-state="results"
      role="status"
    >
      {fallback("Search results for", "Hakutulokset haulle", locale)}{" "}
      <strong>“{input.search.normalizedQuery}”</strong>: {count}{" "}
      {fallback(count === 1 ? "product" : "products", count === 1 ? "tuote" : "tuotetta", locale)}
    </p>
  );
}

function SearchZeroResults({
  input,
  locale,
}: {
  input: PreparedSearchCommerce;
  locale: LocaleContext;
}) {
  if (input.search.state === "empty-query") {
    return (
      <div className={styles.emptyState} data-search-empty-query="true">
        <h2>{fallback("Search products", "Hae tuotteita", locale)}</h2>
        <p>
          {fallback(
            "Enter a product name or detail to begin.",
            "Aloita kirjoittamalla tuotteen nimi tai tuotetieto.",
            locale,
          )}
        </p>
      </div>
    );
  }
  return (
    <div
      className={styles.emptyState}
      data-search-zero-results="true"
      data-search-query={input.search.normalizedQuery}
    >
      <h2>{fallback("No results found", "Hakutuloksia ei löytynyt", locale)}</h2>
      <p>
        {fallback("No products match", "Tuotteita ei löytynyt haulla", locale)} “
        {input.search.normalizedQuery}”.
      </p>
      {input.onContinueShopping ? (
        <button onClick={input.onContinueShopping} type="button">
          {fallback("Continue shopping", "Jatka ostoksia", locale)}
        </button>
      ) : null}
    </div>
  );
}

function CollectionEmptyState({
  input,
  locale,
}: {
  input: PreparedCollectionCommerce;
  locale: LocaleContext;
}) {
  return (
    <div className={styles.emptyState}>
      <h3>{text(input.collection.emptyState.title, locale)}</h3>
      {input.collection.emptyState.description ? (
        <p>{text(input.collection.emptyState.description, locale)}</p>
      ) : null}
    </div>
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

type CollectionFilterPresentation = CollectionPresentationContext["filters"][number];

const PRIMARY_COLLECTION_FILTER_LIMIT = 4;

function collectionFilterIsSelected(filter: CollectionFilterPresentation): boolean {
  return (
    filter.values.some((value) => value.selected) ||
    (filter.presentation === "range" &&
      filter.range !== undefined &&
      (filter.range.selectedMin !== undefined || filter.range.selectedMax !== undefined))
  );
}

function collectionFilterIsEligible(filter: CollectionFilterPresentation): boolean {
  if (collectionFilterIsSelected(filter)) return true;
  if (filter.presentation === "range") {
    return filter.range !== undefined && filter.range.min < filter.range.max;
  }
  return filter.values.filter((value) => !value.disabled && (value.count ?? 1) > 0).length >= 2;
}

function CollectionFilterFieldset({
  collection,
  emit,
  filter,
  content,
  locale,
}: {
  collection: CollectionPresentationContext;
  emit: (intent: CollectionFilterIntent) => void;
  filter: CollectionFilterPresentation;
  content: DynamicCollectionCommerceContent;
  locale: LocaleContext;
}) {
  const isRange = filter.presentation === "range";
  const range = filter.range;
  const selected = collectionFilterIsSelected(filter);
  const visibleValues = filter.values.filter(
    (value) => (value.count ?? 1) > 0 || value.selected === true,
  );
  return (
    <fieldset
      data-filter-id={filter.id}
      data-filter-value-count={isRange ? 2 : visibleValues.length}
    >
      <legend>{text(filter.label, locale)}</legend>
      {isRange && range ? (
        <CollectionRangeFilter
          collection={collection}
          emit={emit}
          filter={filter}
          locale={locale}
          range={range}
        />
      ) : (
        <ul>
          {visibleValues.map((value) => (
            <li key={value.id}>
              <label>
                <input
                  checked={value.selected ?? false}
                  disabled={value.disabled ?? false}
                  onChange={() => {
                    if (!value.disabled) {
                      emit({
                        type: "setCollectionFilterValue",
                        collectionId: collection.collectionId,
                        collectionRevision: collection.revision,
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
      {selected ? (
        <button
          onClick={() =>
            emit({
              type: "clearCollectionFilter",
              collectionId: collection.collectionId,
              collectionRevision: collection.revision,
              filterId: filter.id,
            })
          }
          type="button"
        >
          {text(content.clearLabel, locale)} {text(filter.label, locale)}
        </button>
      ) : null}
    </fieldset>
  );
}

function CollectionFilters({
  input,
  locale,
}: {
  input: PreparedCollectionCommerce;
  locale: LocaleContext;
}) {
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const filterPanelId = useId();
  const filterGroupsId = useId();
  const filters = input.collection.filters.filter(collectionFilterIsEligible);
  if (filters.length === 0) return null;
  const activeFilters = filters.filter(collectionFilterIsSelected);
  const visibleFilters = showAllFilters
    ? filters
    : filters.slice(0, PRIMARY_COLLECTION_FILTER_LIMIT);
  const groups = [
    {
      id: "details",
      label: fallback("Product details", "Tuotetiedot", locale),
      filters: visibleFilters.filter((filter) => filter.id !== "price"),
    },
    {
      id: "commerce",
      label: fallback("Price", "Hinta", locale),
      filters: visibleFilters.filter((filter) => filter.id === "price"),
    },
  ].filter(({ filters: groupFilters }) => groupFilters.length > 0);
  const emit = (intent: CollectionFilterIntent) =>
    input.onFilterIntent(collectionFilterIntentSchema.parse(intent));
  return (
    <div
      className={styles.filterToolbar}
      data-additional-filter-count={Math.max(0, filters.length - PRIMARY_COLLECTION_FILTER_LIMIT)}
      data-eligible-filter-count={filters.length}
      data-layout-region="filters"
      data-primary-filter-count={Math.min(filters.length, PRIMARY_COLLECTION_FILTER_LIMIT)}
    >
      <div
        className={`${styles.filters} ${styles[`filters_${input.props.filterLayout}`]}`}
        data-filter-panel-mode="disclosure"
      >
        <button
          aria-controls={filterPanelId}
          aria-expanded={disclosureOpen}
          className={styles.filterTrigger}
          onClick={() => setDisclosureOpen((current) => !current)}
          type="button"
        >
          {text(input.content.filterTriggerLabel, locale)}
          {activeFilters.length ? (
            <span aria-label={fallback("active filters", "aktiivista suodatinta", locale)}>
              {activeFilters.length}
            </span>
          ) : null}
        </button>
        <div
          className={styles.filterPanel}
          data-disclosure-expanded={disclosureOpen}
          data-filter-panel-content="true"
          id={filterPanelId}
        >
          <div className={styles.filterHeading}>
            <h2>{text(input.content.filtersHeading, locale)}</h2>
            {activeFilters.length ? (
              <button
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
            ) : null}
          </div>
          <div className={styles.filterGroups} id={filterGroupsId}>
            {groups.map((group) => (
              <section
                aria-label={group.label}
                className={styles.filterGroup}
                data-filter-group={group.id}
                data-filter-group-count={group.filters.length}
                key={group.id}
              >
                <h3>{group.label}</h3>
                <div className={styles.filterGroupFields}>
                  {group.filters.map((filter) => (
                    <CollectionFilterFieldset
                      collection={input.collection}
                      content={input.content}
                      emit={emit}
                      filter={filter}
                      key={filter.id}
                      locale={locale}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          {filters.length > PRIMARY_COLLECTION_FILTER_LIMIT ? (
            <button
              aria-controls={filterGroupsId}
              aria-expanded={showAllFilters}
              className={styles.filterDisclosure}
              onClick={() => setShowAllFilters((current) => !current)}
              type="button"
            >
              {showAllFilters
                ? fallback("Show fewer filters", "Näytä vähemmän suodattimia", locale)
                : `${fallback("Show more filters", "Näytä lisää suodattimia", locale)} (${filters.length - PRIMARY_COLLECTION_FILTER_LIMIT})`}
            </button>
          ) : null}
        </div>
      </div>
      {activeFilters.length ? (
        <div
          aria-label={fallback("Active filters", "Aktiiviset suodattimet", locale)}
          className={styles.activeFilterChips}
          role="group"
        >
          {activeFilters.map((filter) => (
            <button
              key={filter.id}
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
              {text(filter.label, locale)} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CollectionSort({
  input,
  locale,
}: {
  input: PreparedCollectionCommerce;
  locale: LocaleContext;
}) {
  if (input.collection.sorting.length < 2) return null;
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

function wideCollectionGridColumns(productCount: number): 1 | 2 | 3 | 4 {
  if (productCount <= 1) return 1;
  if (productCount === 2) return 2;
  if (productCount === 3) return 3;
  if (productCount === 4) return 4;
  if (productCount % 4 === 1 && productCount % 3 !== 1) return 3;
  return 4;
}

export const COLLECTION_PRESENTATION_WINDOW_SIZE = 24;

function CollectionWindowNavigation({
  currentWindow,
  windowCount,
  locale,
  onChange,
}: {
  currentWindow: number;
  windowCount: number;
  locale: LocaleContext;
  onChange: (windowIndex: number) => void;
}) {
  if (windowCount <= 1) return null;
  return (
    <nav
      aria-label={fallback("Product pages", "Tuotesivut", locale)}
      className={styles.productWindowNavigation}
    >
      <button
        disabled={currentWindow === 0}
        onClick={() => onChange(currentWindow - 1)}
        type="button"
      >
        {fallback("Previous products", "Edelliset tuotteet", locale)}
      </button>
      <p aria-atomic="true" aria-live="polite" role="status">
        {fallback("Page", "Sivu", locale)} {currentWindow + 1} / {windowCount}
      </p>
      <button
        disabled={currentWindow === windowCount - 1}
        onClick={() => onChange(currentWindow + 1)}
        type="button"
      >
        {fallback("Next products", "Seuraavat tuotteet", locale)}
      </button>
    </nav>
  );
}

export function DynamicCollectionCommerce(input: PreparedDynamicCollectionCommerce) {
  const productsHeadingId = useId();
  const locale = { activeLocale: input.activeLocale, primaryLocale: input.primaryLocale };
  const collectionInput = input.runtimeContext === "collection" ? input : undefined;
  const searchInput = input.runtimeContext === "search-results" ? input : undefined;
  const canonicalProductFingerprint = canonicalValueFingerprint(
    input.products.map(({ productId, revision }) => ({ productId, revision })),
  );
  const windowAuthorityKey = collectionInput
    ? `${collectionInput.collection.collectionId}:${collectionInput.collection.revision}:${canonicalProductFingerprint}`
    : `search:${searchInput?.search.resultFingerprint ?? canonicalProductFingerprint}`;
  const [windowSelection, setWindowSelection] = useState({
    authorityKey: windowAuthorityKey,
    index: 0,
  });
  const windowCount = collectionInput
    ? Math.max(1, Math.ceil(input.products.length / COLLECTION_PRESENTATION_WINDOW_SIZE))
    : 1;
  const currentWindow =
    windowSelection.authorityKey === windowAuthorityKey
      ? Math.min(windowSelection.index, windowCount - 1)
      : 0;
  const presentedProducts = collectionInput
    ? input.products.slice(
        currentWindow * COLLECTION_PRESENTATION_WINDOW_SIZE,
        (currentWindow + 1) * COLLECTION_PRESENTATION_WINDOW_SIZE,
      )
    : input.products;
  const anatomy = collectionAnatomyIdentity(input.variant);
  const childCollections = collectionInput ? (
    <ChildCollectionNavigation input={collectionInput} locale={locale} />
  ) : null;
  const commerce = (
    <div
      className={`${styles.commerceLayout} ${styles[`layout_${input.props.filterLayout}`]}`}
      data-filter-layout={input.props.filterLayout}
    >
      {collectionInput ? <CollectionFilters input={collectionInput} locale={locale} /> : null}
      <section
        aria-busy={input.loading.status === "loading"}
        aria-labelledby={productsHeadingId}
        className={styles.productResults}
        data-layout-region="products"
      >
        <div className={styles.productGridHeading}>
          <div>
            {searchInput ? (
              <h1 id={productsHeadingId}>{fallback("Search results", "Hakutulokset", locale)}</h1>
            ) : (
              <h2 id={productsHeadingId}>{text(input.content.productsHeading, locale)}</h2>
            )}
            {searchInput ? <SearchResultsContext input={searchInput} locale={locale} /> : null}
          </div>
          {collectionInput ? <CollectionSort input={collectionInput} locale={locale} /> : null}
        </div>
        {input.loading.status === "loading" ? (
          <p aria-atomic="true" aria-live="polite" className={styles.loadingState} role="status">
            {text(input.content.loadingLabel, locale)}
          </p>
        ) : input.products.length === 0 ? (
          searchInput ? (
            <SearchZeroResults input={searchInput} locale={locale} />
          ) : collectionInput ? (
            <CollectionEmptyState input={collectionInput} locale={locale} />
          ) : null
        ) : (
          <>
            {searchInput ? (
              <h2 className={styles.visuallyHidden}>
                {text(input.content.productsHeading, locale)}
              </h2>
            ) : null}
            <div
              className={`${styles.productGrid} ${styles[`density_${input.props.gridDensity}`]}`}
              data-canonical-product-count={input.products.length}
              data-canonical-product-fingerprint={canonicalProductFingerprint}
              data-presented-product-count={presentedProducts.length}
              data-product-count={presentedProducts.length}
              data-product-window-index={currentWindow}
              data-product-window-size={COLLECTION_PRESENTATION_WINDOW_SIZE}
              data-wide-grid-columns={wideCollectionGridColumns(presentedProducts.length)}
            >
              {presentedProducts.map((product) => (
                <DynamicCollectionProductCard
                  assetFor={input.assetFor}
                  content={input.content}
                  context={searchInput ? "searchResults" : "collectionResults"}
                  key={product.productId}
                  locale={locale}
                  onNavigateProduct={input.onNavigateProduct}
                  media={input.cardMediaFor(product.productId)}
                  product={product}
                  props={input.props}
                />
              ))}
            </div>
          </>
        )}
        {collectionInput && input.loading.status === "ready" && input.products.length > 0 ? (
          <CollectionWindowNavigation
            currentWindow={currentWindow}
            locale={locale}
            onChange={(index) => setWindowSelection({ authorityKey: windowAuthorityKey, index })}
            windowCount={windowCount}
          />
        ) : null}
      </section>
    </div>
  );
  return (
    <div
      className={`${styles.root} ${styles[`variant_${input.variant}`]} ${styles[`surface_${input.styleOverrides.surfaceTreatment}`]}`}
      data-component="dynamicCollectionCommerce"
      data-presentation-mode={anatomy.presentationMode}
      data-render-target={input.target}
      data-variant={input.variant}
      data-results-treatment={
        input.variant === "editorialDiscovery"
          ? "curated"
          : input.variant === "catalogueComparison"
            ? "comparison"
            : input.variant === "campaignLedDiscovery"
              ? "campaign-transition"
              : input.variant === "denseSearch"
                ? "dense-scan"
                : "standard"
      }
      data-search-context={searchInput ? "transient-canonical-results" : "none"}
      data-responsive-layout="content-driven"
      {...anatomy.responsiveAttributes}
    >
      {collectionInput ? <CampaignLead input={collectionInput} locale={locale} /> : null}
      {collectionInput ? <CollectionHeader input={collectionInput} locale={locale} /> : null}
      {input.variant === "catalogueComparison" ? (
        <>
          {commerce}
          {childCollections}
        </>
      ) : (
        <>
          {childCollections}
          {commerce}
        </>
      )}
    </div>
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
