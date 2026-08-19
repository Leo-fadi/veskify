"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import { z } from "zod";
import {
  componentProjectionContextSchema,
  presentationRevisionSchema,
  type ProductPresentationContext,
  type StorefrontAssetMetadata,
} from "@/domain/component-platform";
import {
  productOptionResolutionResultSchema,
  type ProductOptionResolutionResult,
} from "@/domain/product-presentation";
import {
  assetRefSchema,
  idSchema,
  localeSchema,
  localizedTextSchema,
  resolveLocalizedText,
  type AssetRef,
  type Locale,
  type LocalizedText,
} from "@/domain/shared";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  dynamicProductDetailContentSchema,
  dynamicProductDetailPropsSchema,
  dynamicProductDetailStyleOverridesSchema,
  dynamicProductDetailVariantSchema,
  type DynamicProductDetailContent,
  type DynamicProductDetailProps,
  type DynamicProductDetailStyleOverrides,
  type DynamicProductDetailVariant,
} from "@/components/registry/dynamic-product-detail";
import { veskifyComponentRegistryV2 } from "@/components/registry/v2-registry";
import styles from "./dynamic-product-detail.module.css";
import { validateRouteUsedAssetConformance } from "./storefront-asset-conformance";
import {
  ResponsiveStorefrontImage,
  type StorefrontImageLoadingRole,
} from "./responsive-storefront-image";
import {
  resolveResponsiveExecutionAuthority,
  responsiveExecutionDataAttributes,
} from "./responsive-execution";
import {
  CanonicalProductCard,
  type CanonicalProductCardNavigationIntent,
} from "./canonical-product-card";
import type { CanonicalProductCardAnatomyId } from "@/domain/product-card";

export const productPrimaryActionPresentationSchema = z
  .object({
    enabled: z.boolean(),
    state: z.enum(["ready", "incomplete", "unavailable"]),
    message: localizedTextSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.enabled !== (value.state === "ready")) {
      context.addIssue({
        code: "custom",
        message: "Only a ready primary action may be enabled.",
        path: ["enabled"],
      });
    }
  });

export type ProductPrimaryActionPresentation = z.infer<
  typeof productPrimaryActionPresentationSchema
>;

export type ProductOptionIntentCallbacks = {
  onSelectOption: (groupId: string, valueId: string) => void;
  onTextOptionChange: (groupId: string, enteredValue: string) => void;
  onClearOption?: (groupId: string) => void;
  onResetOptions?: () => void;
};

export const productTextEntryDraftSchema = z
  .object({ groupId: idSchema, value: z.string().max(500) })
  .strict();

export type ProductTextEntryDraft = z.infer<typeof productTextEntryDraftSchema>;

export const productResolutionLifecyclePresentationSchema = z
  .object({
    state: z.enum(["ready", "pending", "failure"]),
    message: localizedTextSchema.optional(),
    warnings: z.array(localizedTextSchema).default([]),
  })
  .strict();

export type ProductResolutionLifecyclePresentation = z.infer<
  typeof productResolutionLifecyclePresentationSchema
>;

const resolvedConfigurationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("baseProduct") }).strict(),
  z.object({ kind: z.literal("variant"), variantId: idSchema }).strict(),
  z.object({ kind: z.literal("configuration"), configurationId: idSchema }).strict(),
]);

const selectedEnumeratedValueSchema = z.object({ groupId: idSchema, valueId: idSchema }).strict();

export const dynamicProductOptionPresentationSchema = productOptionResolutionResultSchema;

export type DynamicProductOptionPresentation = ProductOptionResolutionResult;

export const productPrimaryActionIntentSchema = z
  .object({
    type: z.literal("activatePrimaryProductAction"),
    action: z.literal("addToCart"),
    productId: idSchema,
    catalogueRevision: presentationRevisionSchema,
    resolvedConfiguration: resolvedConfigurationSchema.optional(),
    selectedValues: z.array(selectedEnumeratedValueSchema),
    textEntries: z.array(z.object({ groupId: idSchema, value: z.string().max(500) }).strict()),
  })
  .strict();

export type ProductPrimaryActionIntent = z.infer<typeof productPrimaryActionIntentSchema>;

export type ProductPrimaryActionIntentCallback = (
  intent: ProductPrimaryActionIntent,
) => void | Promise<void>;

export type DynamicProductDetailRendererInput = ProductOptionIntentCallbacks & {
  target: "editor" | "preview" | "published";
  instance: unknown;
  projection: unknown;
  activeLocale: Locale;
  primaryLocale: Locale;
  primaryAction: ProductPrimaryActionPresentation;
  resolutionLifecycle?: ProductResolutionLifecyclePresentation;
  resolvedOptions: DynamicProductOptionPresentation;
  textEntryDrafts?: readonly ProductTextEntryDraft[];
  resolveAssetUrl: (assetId: string) => string;
  onPrimaryAction: ProductPrimaryActionIntentCallback;
  onNavigateProduct?: (intent: CanonicalProductCardNavigationIntent) => void;
};

type ResolvedAsset = {
  asset: AssetRef;
  metadata: StorefrontAssetMetadata;
  provenance: StorefrontAssetMetadata["provenance"];
  artDirection?: StorefrontAssetMetadata["artDirection"];
};

type PreparedDynamicProductDetail = ProductOptionIntentCallbacks & {
  target: DynamicProductDetailRendererInput["target"];
  product: ProductPresentationContext;
  variant: DynamicProductDetailVariant;
  relatedProducts: ProductPresentationContext[];
  content: DynamicProductDetailContent;
  props: DynamicProductDetailProps;
  styleOverrides: DynamicProductDetailStyleOverrides;
  activeLocale: Locale;
  primaryLocale: Locale;
  primaryAction: ProductPrimaryActionPresentation;
  resolutionLifecycle: ProductResolutionLifecyclePresentation;
  resolvedOptions: DynamicProductOptionPresentation;
  textEntryDrafts: readonly ProductTextEntryDraft[];
  assetFor: (assetId: string, alt?: LocalizedText, decorative?: boolean) => ResolvedAsset;
  onPrimaryAction: ProductPrimaryActionIntentCallback;
  onNavigateProduct?: (intent: CanonicalProductCardNavigationIntent) => void;
};

const arraysEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

function requiredAssetRoles(
  product: ProductPresentationContext,
  relatedProducts: readonly ProductPresentationContext[],
) {
  const required = new Map<
    string,
    "productMainImage" | "productAlternativeImage" | "editorialImage"
  >();
  const add = (
    assetId: string,
    role: "productMainImage" | "productAlternativeImage" | "editorialImage",
  ) => {
    const existing = required.get(assetId);
    if (existing !== undefined && existing !== role) {
      throw new Error(`Canonical asset ${assetId} cannot fill conflicting PDP media roles.`);
    }
    required.set(assetId, role);
  };
  const addProductMedia = (item: ProductPresentationContext, related: boolean) => {
    const selectedRelated = item.media.find(({ role }) => role !== "editorial");
    const media = related ? (selectedRelated ? [selectedRelated] : []) : item.media;
    media.forEach((entry) =>
      add(
        entry.assetId,
        entry.role === "main"
          ? "productMainImage"
          : entry.role === "editorial"
            ? "editorialImage"
            : "productAlternativeImage",
      ),
    );
  };
  addProductMedia(product, false);
  product.optionGroups.forEach((group) =>
    group.values.forEach((value) => {
      if (value.swatch?.assetId) add(value.swatch.assetId, "productAlternativeImage");
    }),
  );
  relatedProducts.forEach((item) => addProductMedia(item, true));
  return required;
}

export function validateDynamicProductDetailRoutePresentation(
  instanceInput: unknown,
  projectionInput: unknown,
) {
  const instance = veskifyComponentRegistryV2.validateInstanceConformance(
    instanceInput,
    projectionInput,
  );
  if (instance.component !== "dynamicProductDetail") {
    throw new Error("The dynamic PDP renderer requires a dynamicProductDetail instance.");
  }
  const projection = componentProjectionContextSchema.parse(projectionInput);
  const productsById = new Map(
    projection.products.map((candidate) => [candidate.productId, candidate] as const),
  );
  const productBinding = instance.bindings.find(
    (binding) => binding.slotId === "primaryProduct" && binding.source === "product",
  );
  if (!productBinding || productBinding.source !== "product") {
    throw new Error("The dynamic PDP renderer requires one canonical product binding.");
  }
  const product = productsById.get(productBinding.productId);
  if (!product) throw new Error(`Unknown PDP product: ${productBinding.productId}.`);

  const relatedBinding = instance.bindings.find(
    (binding) => binding.slotId === "relatedProducts" && binding.source === "productList",
  );
  if (
    relatedBinding?.source === "productList" &&
    !arraysEqual(relatedBinding.productIds, product.relatedProductIds)
  ) {
    throw new Error(
      "Related-product bindings must exactly match the canonical product presentation context.",
    );
  }
  const relatedIds =
    relatedBinding?.source === "productList" ? relatedBinding.productIds : ([] as string[]);
  const relatedProducts = relatedIds.map((productId) => {
    const related = productsById.get(productId);
    if (!related) throw new Error(`Unknown related product: ${productId}.`);
    return related;
  });
  const requiredAssets = requiredAssetRoles(product, relatedProducts);
  const assetMetadata = validateRouteUsedAssetConformance({
    instance,
    projection,
    requiredAssets,
    boundary: "PDP",
  });
  return { instance, projection, product, relatedProducts, requiredAssets, assetMetadata };
}

function validateResolvedOptionPresentation(
  input: unknown,
  product: ProductPresentationContext,
): DynamicProductOptionPresentation {
  const resolved = dynamicProductOptionPresentationSchema.parse(input);
  if (resolved.productId !== product.productId || resolved.catalogueRevision !== product.revision) {
    throw new Error("Resolved PDP option state must match the canonical product revision.");
  }
  if (
    canonicalValueString(resolved.unavailableCombinations) !==
    canonicalValueString(product.unavailableCombinations)
  ) {
    throw new Error("Resolved PDP option state must preserve canonical unavailable combinations.");
  }

  const groups = new Map(product.optionGroups.map((group) => [group.id, group]));
  const groupIds = product.optionGroups.map((group) => group.id);
  if (
    !arraysEqual(
      resolved.dependencyState.map((state) => state.groupId),
      groupIds,
    )
  ) {
    throw new Error("Resolved PDP dependency state must cover option groups in canonical order.");
  }
  const ensureUnique = (keys: readonly string[], message: string) => {
    if (new Set(keys).size !== keys.length) throw new Error(message);
  };
  ensureUnique(
    resolved.selectedValues.map((selection) => selection.groupId),
    "Resolved PDP selections must contain at most one value per group.",
  );
  ensureUnique(
    resolved.textEntryValues.map((entry) => entry.groupId),
    "Resolved PDP text state must contain at most one value per group.",
  );
  ensureUnique(
    resolved.disabledOptionValues.map((value) => `${value.groupId}:${value.valueId}`),
    "Resolved PDP disabled values must be unique.",
  );
  ensureUnique(
    resolved.incompleteRequiredGroupIds,
    "Resolved PDP incomplete required groups must be unique.",
  );

  resolved.selectedValues.forEach((selection) => {
    const group = groups.get(selection.groupId);
    if (
      !group ||
      group.presentation === "textInput" ||
      !group.values.some((value) => value.id === selection.valueId)
    ) {
      throw new Error("Resolved PDP selections must reference canonical enumerated values.");
    }
  });
  resolved.textEntryValues.forEach((entry) => {
    if (groups.get(entry.groupId)?.presentation !== "textInput") {
      throw new Error("Resolved PDP text state must reference canonical text-option groups.");
    }
  });
  resolved.disabledOptionValues.forEach((disabled) => {
    const group = groups.get(disabled.groupId);
    if (
      !group ||
      group.presentation === "textInput" ||
      !group.values.some((value) => value.id === disabled.valueId)
    ) {
      throw new Error("Resolved PDP disabled state must reference canonical option values.");
    }
  });
  resolved.dependencyState.forEach((state) => {
    if (state.unmetGroupIds.some((groupId) => !groups.has(groupId))) {
      throw new Error("Resolved PDP dependency state references an unknown prerequisite group.");
    }
    if (state.satisfied !== (state.unmetGroupIds.length === 0)) {
      throw new Error("Resolved PDP dependency state is internally inconsistent.");
    }
  });
  resolved.incompleteRequiredGroupIds.forEach((groupId) => {
    if (!groups.get(groupId)?.required) {
      throw new Error("Resolved PDP incomplete state must reference required option groups.");
    }
  });
  const canonicalMedia = new Map(product.media.map((media) => [media.assetId, media]));
  resolved.selectedMediaReferences.forEach((media) => {
    const canonical = canonicalMedia.get(media.assetId);
    if (!canonical || canonicalValueString(canonical) !== canonicalValueString(media)) {
      throw new Error("Resolved PDP media must preserve canonical product media references.");
    }
  });
  return resolved;
}

function prepareDynamicProductDetail(
  input: DynamicProductDetailRendererInput,
): PreparedDynamicProductDetail {
  const { instance, product, relatedProducts, requiredAssets, assetMetadata } =
    validateDynamicProductDetailRoutePresentation(input.instance, input.projection);

  const resolvedOptions = validateResolvedOptionPresentation(input.resolvedOptions, product);
  const textEntryDrafts = z.array(productTextEntryDraftSchema).parse(
    input.textEntryDrafts ??
      resolvedOptions.textEntryValues.map((entry) => ({
        groupId: entry.groupId,
        value: entry.value,
      })),
  );
  if (new Set(textEntryDrafts.map((draft) => draft.groupId)).size !== textEntryDrafts.length) {
    throw new Error("PDP text-entry drafts must contain at most one value per group.");
  }
  textEntryDrafts.forEach((draft) => {
    if (
      product.optionGroups.find((group) => group.id === draft.groupId)?.presentation !== "textInput"
    ) {
      throw new Error("PDP text-entry drafts must reference canonical text-option groups.");
    }
  });
  const primaryAction = productPrimaryActionPresentationSchema.parse(input.primaryAction);
  if (
    primaryAction.enabled &&
    (!resolvedOptions.canAddToCart || resolvedOptions.resolvedConfiguration === undefined)
  ) {
    throw new Error("The PDP primary action requires a purchasable canonical configuration.");
  }
  return {
    target: input.target,
    product,
    variant: dynamicProductDetailVariantSchema.parse(instance.variant),
    relatedProducts,
    content: dynamicProductDetailContentSchema.parse(instance.content),
    props: dynamicProductDetailPropsSchema.parse(instance.props),
    styleOverrides: dynamicProductDetailStyleOverridesSchema.parse(instance.styleOverrides),
    activeLocale: localeSchema.parse(input.activeLocale),
    primaryLocale: localeSchema.parse(input.primaryLocale),
    primaryAction,
    resolutionLifecycle: productResolutionLifecyclePresentationSchema.parse(
      input.resolutionLifecycle ?? { state: "ready", warnings: [] },
    ),
    resolvedOptions,
    textEntryDrafts,
    onSelectOption: input.onSelectOption,
    onTextOptionChange: input.onTextOptionChange,
    onClearOption: input.onClearOption,
    onResetOptions: input.onResetOptions,
    onPrimaryAction: input.onPrimaryAction,
    onNavigateProduct: input.onNavigateProduct,
    assetFor(assetId, alt, decorative = false) {
      const metadata = assetMetadata.get(assetId);
      if (!metadata || metadata.approvalStatus !== "approved") {
        throw new Error(`PDP media requires approved asset metadata: ${assetId}.`);
      }
      const expectedRole = requiredAssets.get(assetId);
      if (!expectedRole || metadata.role !== expectedRole) {
        throw new Error(`PDP media requires its canonical approved role: ${assetId}.`);
      }
      const asset = assetRefSchema.parse({
        id: assetId,
        url: input.resolveAssetUrl(assetId),
        alt: decorative ? undefined : (alt ?? metadata.alt),
        decorative,
      });
      return {
        asset,
        metadata,
        provenance: metadata.provenance,
        ...(metadata.artDirection === undefined ? {} : { artDirection: metadata.artDirection }),
      };
    },
  };
}

type LocaleContext = Pick<PreparedDynamicProductDetail, "activeLocale" | "primaryLocale">;

const text = (value: LocalizedText, context: LocaleContext) =>
  resolveLocalizedText(value, context.activeLocale, context.primaryLocale);

const fallbackLabel = (en: string, fi: string, context: LocaleContext) =>
  context.activeLocale === "fi" ? fi : en;

function ProductAssetImage({
  asset,
  artDirection,
  locale,
  className,
  loadingRole = "content",
}: {
  asset: AssetRef;
  artDirection?: StorefrontAssetMetadata["artDirection"];
  locale: LocaleContext;
  className?: string;
  loadingRole?: StorefrontImageLoadingRole;
}) {
  const alt = asset.decorative || !asset.alt ? "" : text(asset.alt, locale);
  return (
    <ResponsiveStorefrontImage
      alt={alt}
      asset={asset}
      authority={artDirection}
      className={className}
      loadingRole={loadingRole}
    />
  );
}

function moneyLabel(
  value: NonNullable<ProductPresentationContext["price"]>,
  context: LocaleContext,
) {
  if (value.formatted) return text(value.formatted, context);
  return new Intl.NumberFormat(context.activeLocale === "fi" ? "fi-FI" : "en-GB", {
    style: "currency",
    currency: value.currency,
  }).format(value.amount);
}

function mediaPresentation(
  product: ProductPresentationContext,
  mediaByAssetId: ReadonlyMap<string, ProductPresentationContext["media"][number]>,
  assetId: string,
) {
  const media = mediaByAssetId.get(assetId);
  return {
    alt: media?.decorative ? undefined : (media?.alt ?? product.title),
    decorative: media?.decorative ?? false,
  };
}

export const PDP_PRESENTED_MEDIA_LIMIT = 8;
export const PDP_PRESENTED_RELATED_PRODUCT_LIMIT = 8;

export function DynamicProductGallery({
  product,
  media,
  assetFor,
  layout,
  treatment,
  locale,
}: {
  product: ProductPresentationContext;
  media: DynamicProductOptionPresentation["selectedMediaReferences"];
  assetFor: PreparedDynamicProductDetail["assetFor"];
  layout: DynamicProductDetailProps["galleryLayout"];
  treatment: DynamicProductDetailProps["mediaTreatment"];
  locale: LocaleContext;
}) {
  const mediaByAssetId = new Map(
    product.media.map((candidate) => [candidate.assetId, candidate] as const),
  );
  const canonicalGalleryMedia = product.media.filter(({ role }) => role !== "editorial");
  const galleryMedia = media.filter(
    (item) => mediaByAssetId.get(item.assetId)?.role !== "editorial",
  );
  type PresentationMedia = {
    reference: (typeof galleryMedia)[number];
    resolved: ResolvedAsset;
    presentationKey: string;
  };
  const presentationByKey = new Map<string, PresentationMedia>();
  galleryMedia.forEach((reference) => {
    const presentation = mediaPresentation(product, mediaByAssetId, reference.assetId);
    const resolved = assetFor(reference.assetId, presentation.alt, presentation.decorative);
    const presentationKey = canonicalValueString({
      url: resolved.asset.url,
      safeArea: resolved.artDirection?.safeArea,
      sourceTreatment: resolved.artDirection?.sourceTreatment,
      responsiveTreatments: resolved.artDirection?.responsiveTreatments,
      derivativeTreatments: resolved.artDirection?.derivatives.map(({ breakpoint, transform }) => ({
        breakpoint,
        transform,
      })),
    });
    if (!presentationByKey.has(presentationKey)) {
      presentationByKey.set(presentationKey, { reference, resolved, presentationKey });
    }
  });
  const allPresentationMedia = [...presentationByKey.values()];
  const presentationMedia = allPresentationMedia.slice(0, PDP_PRESENTED_MEDIA_LIMIT);
  const canonicalMediaFingerprint = canonicalValueFingerprint(
    canonicalGalleryMedia.map(({ assetId, role }) => ({ assetId, role })),
  );
  const mediaFingerprint = canonicalValueFingerprint(
    presentationMedia.map(({ reference, resolved }) => [reference.assetId, resolved.asset.url]),
  );
  const [selection, setSelection] = useState(() => ({
    mediaFingerprint,
    assetId: presentationMedia[0]?.reference.assetId,
  }));
  if (presentationMedia.length === 0) {
    return (
      <section
        aria-label={fallbackLabel("Product gallery", "Tuotegalleria", locale)}
        className={styles.emptyGallery}
      >
        <p>
          {fallbackLabel("Product media is unavailable.", "Tuotemediaa ei ole saatavilla.", locale)}
        </p>
      </section>
    );
  }
  const selectedAssetId =
    selection.mediaFingerprint === mediaFingerprint &&
    presentationMedia.some(({ reference }) => reference.assetId === selection.assetId)
      ? selection.assetId
      : presentationMedia[0].reference.assetId;
  const selected =
    presentationMedia.find(({ reference }) => reference.assetId === selectedAssetId) ??
    presentationMedia[0];
  return (
    <section
      aria-label={fallbackLabel("Product gallery", "Tuotegalleria", locale)}
      className={`${styles.gallery} ${styles[`gallery_${layout}`]} ${styles[`media_${treatment}`]}`}
      data-canonical-media-count={canonicalGalleryMedia.length}
      data-canonical-media-fingerprint={canonicalMediaFingerprint}
      data-deduplicated-media-count={allPresentationMedia.length}
      data-layout={layout}
      data-presented-media-count={presentationMedia.length}
      data-resolved-media-count={galleryMedia.length}
      data-source-quality-authority="unavailable-bounded-stage"
    >
      <figure
        className={styles.primaryMedia}
        data-asset-id={selected.reference.assetId}
        data-asset-provenance={selected.resolved.provenance.kind}
      >
        <ProductAssetImage
          artDirection={selected.resolved.artDirection}
          asset={selected.resolved.asset}
          className={styles.primaryImage}
          locale={locale}
          loadingRole="primary"
        />
      </figure>
      {presentationMedia.length > 1 ? (
        <div
          aria-label={fallbackLabel("Choose product image", "Valitse tuotekuva", locale)}
          className={styles.thumbnails}
          role="group"
        >
          {presentationMedia.map(({ reference, resolved }, index) => {
            return (
              <button
                aria-label={`${fallbackLabel("View product image", "Näytä tuotekuva", locale)} ${index + 1}`}
                aria-pressed={reference.assetId === selected.reference.assetId}
                data-asset-provenance={resolved.provenance.kind}
                key={reference.assetId}
                onClick={() => setSelection({ mediaFingerprint, assetId: reference.assetId })}
                type="button"
              >
                <ProductAssetImage
                  artDirection={resolved.artDirection}
                  asset={resolved.asset}
                  locale={locale}
                  loadingRole="thumbnail"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function DynamicProductIdentity({
  product,
  resolvedOptions,
  showSku,
  locale,
  titleId,
}: {
  product: ProductPresentationContext;
  resolvedOptions: DynamicProductOptionPresentation;
  showSku: boolean;
  locale: LocaleContext;
  titleId: string;
}) {
  return (
    <header className={styles.identity}>
      <h1 id={titleId}>{text(product.title, locale)}</h1>
      {showSku && resolvedOptions.displayedSku ? (
        <p className={styles.sku}>
          <span>{fallbackLabel("SKU", "Tuotetunnus", locale)}:</span> {resolvedOptions.displayedSku}
        </p>
      ) : null}
    </header>
  );
}

export function DynamicProductPurchaseState({
  product,
  resolvedOptions,
  showDescription,
  locale,
}: {
  product: ProductPresentationContext;
  resolvedOptions: DynamicProductOptionPresentation;
  showDescription: boolean;
  locale: LocaleContext;
}) {
  return (
    <div className={styles.purchaseState} data-product-region="purchase-state">
      <div aria-label={fallbackLabel("Price", "Hinta", locale)} className={styles.priceRow}>
        {resolvedOptions.displayedPrice ? (
          <>
            <span className={styles.price}>
              {moneyLabel(resolvedOptions.displayedPrice, locale)}
            </span>
            {resolvedOptions.displayedCompareAtPrice ? (
              <del className={styles.compareAtPrice}>
                {moneyLabel(resolvedOptions.displayedCompareAtPrice, locale)}
              </del>
            ) : null}
          </>
        ) : (
          <span className={styles.priceUnavailable}>
            {text(resolvedOptions.displayedPriceUnavailableReason!, locale)}
          </span>
        )}
      </div>
      {resolvedOptions.displayedAvailability ? (
        <p aria-live="polite" className={styles.availability}>
          {text(resolvedOptions.displayedAvailability, locale)}
        </p>
      ) : null}
      {showDescription && product.description ? (
        <p className={styles.description} data-product-region="description">
          {text(product.description, locale)}
        </p>
      ) : null}
    </div>
  );
}

export function DynamicProductConfigurationSummary({
  product,
  resolvedOptions,
  locale,
}: {
  product: ProductPresentationContext;
  resolvedOptions: DynamicProductOptionPresentation;
  locale: LocaleContext;
}) {
  if (product.optionGroups.length === 0) return null;
  const selectedValues = new Map(
    resolvedOptions.selectedValues.map(({ groupId, valueId }) => [groupId, valueId]),
  );
  const textValues = new Map(
    resolvedOptions.textEntryValues.map(({ groupId, value }) => [groupId, value]),
  );
  const selections = product.optionGroups.flatMap((group) => {
    if (group.presentation === "textInput") {
      const value = textValues.get(group.id);
      return value ? [{ group, value }] : [];
    }
    const selectedId = selectedValues.get(group.id);
    const selected = group.values.find(({ id }) => id === selectedId);
    return selected ? [{ group, value: text(selected.label, locale) }] : [];
  });
  const selectionComplete = resolvedOptions.incompleteRequiredGroupIds.length === 0;
  const ready = resolvedOptions.canAddToCart;
  return (
    <section
      aria-label={fallbackLabel("Current configuration", "Nykyinen kokoonpano", locale)}
      aria-live="polite"
      className={styles.configurationSummary}
      data-configuration-ready={resolvedOptions.canAddToCart}
      data-selected-option-count={selections.length}
    >
      <div className={styles.configurationSummaryHeading}>
        <h2>{fallbackLabel("Current configuration", "Nykyinen kokoonpano", locale)}</h2>
        <span data-ready={ready}>
          {ready
            ? fallbackLabel("Ready", "Valmis", locale)
            : selectionComplete
              ? fallbackLabel("Unavailable", "Ei saatavilla", locale)
              : fallbackLabel("Needs selections", "Valintoja puuttuu", locale)}
        </span>
      </div>
      {selections.length > 0 ? (
        <ul>
          {selections.map(({ group, value }) => (
            <li key={group.id}>
              <span>{text(group.label, locale)}</span>
              <strong>{value}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {fallbackLabel("No options selected yet.", "Vaihtoehtoja ei ole vielä valittu.", locale)}
        </p>
      )}
    </section>
  );
}

function selectedEnumeratedState(resolved: DynamicProductOptionPresentation, groupId: string) {
  return resolved.selectedValues.find((selection) => selection.groupId === groupId);
}

function selectedTextState(resolved: DynamicProductOptionPresentation, groupId: string) {
  return resolved.textEntryValues.find((entry) => entry.groupId === groupId);
}

function dependencyState(resolved: DynamicProductOptionPresentation, groupId: string) {
  return resolved.dependencyState.find((state) => state.groupId === groupId)!;
}

function dependencyMessage(
  product: ProductPresentationContext,
  resolved: DynamicProductOptionPresentation,
  groupId: string,
  locale: LocaleContext,
) {
  const dependency = dependencyState(resolved, groupId);
  if (dependency.satisfied) return undefined;
  const labels = dependency.unmetGroupIds.map((dependencyId) => {
    const group = product.optionGroups.find((candidate) => candidate.id === dependencyId)!;
    return text(group.label, locale);
  });
  return locale.activeLocale === "fi"
    ? `Valitse ensin: ${labels.join(", ")}.`
    : `Choose first: ${labels.join(", ")}.`;
}

function resolvedValuePresentation(
  product: ProductPresentationContext,
  group: ProductPresentationContext["optionGroups"][number],
  value: ProductPresentationContext["optionGroups"][number]["values"][number],
  resolved: DynamicProductOptionPresentation,
  locale: LocaleContext,
) {
  const resolvedDisabled = resolved.disabledOptionValues.find(
    (candidate) => candidate.groupId === group.id && candidate.valueId === value.id,
  );
  const dependencyReason = dependencyMessage(product, resolved, group.id, locale);
  const disabled =
    value.disabled || resolvedDisabled !== undefined || dependencyReason !== undefined;
  if (!disabled) return { disabled: false, reason: undefined } as const;
  if (value.unavailableReason) {
    return { disabled: true, reason: text(value.unavailableReason, locale) } as const;
  }
  if (dependencyReason) return { disabled: true, reason: dependencyReason } as const;
  const reasons = resolvedDisabled?.reasons ?? [];
  if (reasons.includes("unavailableCombination")) {
    return {
      disabled: true,
      reason: fallbackLabel(
        "Unavailable with the current selection.",
        "Ei saatavilla nykyisellä valinnalla.",
        locale,
      ),
    } as const;
  }
  if (reasons.includes("resolver")) {
    return {
      disabled: true,
      reason: fallbackLabel(
        "Unavailable for this product configuration.",
        "Ei saatavilla tällä tuotekokoonpanolla.",
        locale,
      ),
    } as const;
  }
  return {
    disabled: true,
    reason: fallbackLabel("Unavailable", "Ei saatavilla", locale),
  } as const;
}

function OptionGroupStatus({
  required,
  complete,
  locale,
}: {
  required: boolean;
  complete: boolean;
  locale: LocaleContext;
}) {
  if (!required) {
    return (
      <span className={styles.optionStatus}>
        {fallbackLabel("Optional", "Valinnainen", locale)}
      </span>
    );
  }
  return (
    <span className={styles.optionStatus} data-complete={complete}>
      {complete
        ? fallbackLabel("Selected", "Valittu", locale)
        : fallbackLabel("Required selection", "Pakollinen valinta", locale)}
    </span>
  );
}

function EnumeratedOptionGroup({
  group,
  product,
  locale,
  assetFor,
  resolvedOptions,
  onSelectOption,
  onClearOption,
  interactionDisabled,
}: {
  group: ProductPresentationContext["optionGroups"][number];
  product: ProductPresentationContext;
  locale: LocaleContext;
  assetFor: PreparedDynamicProductDetail["assetFor"];
  resolvedOptions: DynamicProductOptionPresentation;
  onSelectOption: ProductOptionIntentCallbacks["onSelectOption"];
  onClearOption: ProductOptionIntentCallbacks["onClearOption"];
  interactionDisabled: boolean;
}) {
  const describedById = useId();
  const selection = selectedEnumeratedState(resolvedOptions, group.id);
  const selectedValueId = selection?.valueId;
  const complete = !resolvedOptions.incompleteRequiredGroupIds.includes(group.id);
  const groupDependencyReason = dependencyMessage(product, resolvedOptions, group.id, locale);
  const groupHelpId = `${describedById}-help`;
  const groupDependencyReasonId = `${describedById}-dependency`;
  const groupDescriptions = [
    group.helpText ? groupHelpId : undefined,
    groupDependencyReason ? groupDependencyReasonId : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  if (group.presentation === "dropdown") {
    return (
      <div className={styles.dropdownGroup} data-option-group-id={group.id}>
        <label htmlFor={`${describedById}-select`}>
          <span>{text(group.label, locale)}</span>
          <OptionGroupStatus complete={complete} locale={locale} required={group.required} />
        </label>
        {group.helpText ? <p id={groupHelpId}>{text(group.helpText, locale)}</p> : null}
        {groupDependencyReason ? <p id={groupDependencyReasonId}>{groupDependencyReason}</p> : null}
        <select
          aria-describedby={groupDescriptions || undefined}
          aria-invalid={group.required && !complete}
          disabled={interactionDisabled || groupDependencyReason !== undefined}
          id={`${describedById}-select`}
          onChange={(event) => {
            const value = group.values.find((candidate) => candidate.id === event.target.value);
            if (!value && !group.required && !interactionDisabled) {
              onClearOption?.(group.id);
              return;
            }
            if (
              value &&
              !resolvedValuePresentation(product, group, value, resolvedOptions, locale).disabled
            ) {
              if (!interactionDisabled) onSelectOption(group.id, value.id);
            }
          }}
          required={group.required}
          value={selectedValueId ?? ""}
        >
          <option value="">
            {fallbackLabel("Choose an option", "Valitse vaihtoehto", locale)}
          </option>
          {group.values.map((value) => {
            const presentation = resolvedValuePresentation(
              product,
              group,
              value,
              resolvedOptions,
              locale,
            );
            return (
              <option disabled={presentation.disabled} key={value.id} value={value.id}>
                {text(value.label, locale)}
                {presentation.reason ? ` — ${presentation.reason}` : ""}
              </option>
            );
          })}
        </select>
      </div>
    );
  }

  if (group.presentation === "radio") {
    return (
      <fieldset
        aria-describedby={groupDescriptions || undefined}
        aria-invalid={group.required && !complete}
        className={styles.radioGroup}
        data-option-group-id={group.id}
      >
        <legend>
          {text(group.label, locale)}
          <OptionGroupStatus complete={complete} locale={locale} required={group.required} />
        </legend>
        {group.helpText ? <p id={groupHelpId}>{text(group.helpText, locale)}</p> : null}
        {groupDependencyReason ? <p id={groupDependencyReasonId}>{groupDependencyReason}</p> : null}
        {group.values.map((value) => {
          const presentation = resolvedValuePresentation(
            product,
            group,
            value,
            resolvedOptions,
            locale,
          );
          return (
            <label key={value.id}>
              <input
                checked={selectedValueId === value.id}
                disabled={interactionDisabled || presentation.disabled}
                name={group.id}
                onChange={() => {
                  if (!interactionDisabled && !presentation.disabled) {
                    onSelectOption(group.id, value.id);
                  }
                }}
                type="radio"
                required={group.required}
                value={value.id}
              />
              <span>{text(value.label, locale)}</span>
              {presentation.reason ? <small>{presentation.reason}</small> : null}
            </label>
          );
        })}
      </fieldset>
    );
  }

  return (
    <fieldset
      aria-describedby={groupDescriptions || undefined}
      aria-invalid={group.required && !complete}
      className={styles.buttonGroup}
      data-option-group-id={group.id}
    >
      <legend>
        {text(group.label, locale)}
        <OptionGroupStatus complete={complete} locale={locale} required={group.required} />
      </legend>
      {group.helpText ? <p id={groupHelpId}>{text(group.helpText, locale)}</p> : null}
      {groupDependencyReason ? <p id={groupDependencyReasonId}>{groupDependencyReason}</p> : null}
      <div className={styles.optionValues}>
        {group.values.map((value) => {
          const reasonId = `${describedById}-${value.id}`;
          const presentation = resolvedValuePresentation(
            product,
            group,
            value,
            resolvedOptions,
            locale,
          );
          const image = value.swatch?.assetId
            ? assetFor(value.swatch.assetId, value.label)
            : undefined;
          const swatchStyle = value.swatch?.color
            ? ({ "--option-swatch": value.swatch.color } as CSSProperties)
            : undefined;
          return (
            <div className={styles.optionValue} key={value.id}>
              <button
                aria-describedby={presentation.disabled ? reasonId : undefined}
                aria-label={text(value.label, locale)}
                aria-pressed={selectedValueId === value.id}
                className={`${styles.optionButton} ${styles[`option_${group.presentation}`]}`}
                disabled={interactionDisabled || presentation.disabled}
                onClick={() => {
                  if (!interactionDisabled && !presentation.disabled) {
                    onSelectOption(group.id, value.id);
                  }
                }}
                style={swatchStyle}
                type="button"
              >
                {group.presentation === "swatch" && value.swatch?.color ? (
                  <span aria-hidden="true" className={styles.swatch} />
                ) : null}
                {group.presentation === "imageChoice" && image ? (
                  <ProductAssetImage
                    artDirection={image.artDirection}
                    asset={image.asset}
                    locale={locale}
                    loadingRole="thumbnail"
                  />
                ) : null}
                <span>{text(value.label, locale)}</span>
              </button>
              {presentation.reason ? <small id={reasonId}>{presentation.reason}</small> : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function TextOptionGroup({
  group,
  product,
  locale,
  resolvedOptions,
  onTextOptionChange,
  draftValue,
}: {
  group: ProductPresentationContext["optionGroups"][number];
  product: ProductPresentationContext;
  locale: LocaleContext;
  resolvedOptions: DynamicProductOptionPresentation;
  onTextOptionChange: ProductOptionIntentCallbacks["onTextOptionChange"];
  draftValue: string | undefined;
}) {
  const inputId = useId();
  const constraintsId = `${inputId}-constraints`;
  const helpId = `${inputId}-help`;
  const dependencyId = `${inputId}-dependency`;
  const selection = selectedTextState(resolvedOptions, group.id);
  const enteredText = draftValue ?? selection?.value ?? "";
  const constraints = group.textEntryConstraints!;
  const blockedReason = dependencyMessage(product, resolvedOptions, group.id, locale);
  const complete = !resolvedOptions.incompleteRequiredGroupIds.includes(group.id);
  const policyGuidance: Record<typeof constraints.characterPolicy, { en: string; fi: string }> = {
    unicodeText: {
      en: "Use letters, numbers, spaces and standard symbols.",
      fi: "Käytä kirjaimia, numeroita, välilyöntejä ja tavallisia symboleita.",
    },
    lettersAndSpaces: {
      en: "Use letters, spaces, apostrophes and hyphens only.",
      fi: "Käytä vain kirjaimia, välilyöntejä, heittomerkkejä ja yhdysmerkkejä.",
    },
    lettersNumbersAndSpaces: {
      en: "Use letters, numbers, spaces and common punctuation only.",
      fi: "Käytä vain kirjaimia, numeroita, välilyöntejä ja yleisiä välimerkkejä.",
    },
    asciiPrintable: {
      en: "Use standard Latin letters, numbers, spaces and common symbols only.",
      fi: "Käytä vain latinalaisia peruskirjaimia, numeroita, välilyöntejä ja yleisiä symboleja.",
    },
  };
  const constraintsDescription =
    locale.activeLocale === "fi"
      ? `${enteredText.length}/${constraints.maxLength} merkkiä. Kirjoita ${constraints.minLength}-${constraints.maxLength} merkkiä. ${policyGuidance[constraints.characterPolicy].fi}`
      : `${enteredText.length}/${constraints.maxLength} characters. Enter ${constraints.minLength}-${constraints.maxLength} characters. ${policyGuidance[constraints.characterPolicy].en}`;
  return (
    <div className={styles.textOption} data-option-group-id={group.id}>
      <label htmlFor={inputId}>
        <span>{text(group.label, locale)}</span>
        <OptionGroupStatus complete={complete} locale={locale} required={group.required} />
      </label>
      {group.helpText ? <p id={helpId}>{text(group.helpText, locale)}</p> : null}
      {blockedReason ? <p id={dependencyId}>{blockedReason}</p> : null}
      <input
        aria-describedby={[
          group.helpText ? helpId : undefined,
          constraintsId,
          blockedReason ? dependencyId : undefined,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={group.required && !complete}
        disabled={blockedReason !== undefined}
        id={inputId}
        maxLength={constraints.maxLength}
        minLength={constraints.minLength}
        onChange={(event) => {
          if (!blockedReason) {
            onTextOptionChange(group.id, event.target.value);
          }
        }}
        placeholder={constraints.placeholder ? text(constraints.placeholder, locale) : undefined}
        required={group.required}
        type="text"
        value={enteredText}
      />
      <small id={constraintsId}>{constraintsDescription}</small>
    </div>
  );
}

export function DynamicProductOptionGroups({
  product,
  locale,
  density,
  assetFor,
  resolvedOptions,
  onSelectOption,
  onTextOptionChange,
  onClearOption,
  onResetOptions,
  interactionDisabled,
  textEntryDrafts,
}: {
  product: ProductPresentationContext;
  locale: LocaleContext;
  density: DynamicProductDetailProps["optionDensity"];
  assetFor: PreparedDynamicProductDetail["assetFor"];
  resolvedOptions: DynamicProductOptionPresentation;
  interactionDisabled: boolean;
  textEntryDrafts: readonly ProductTextEntryDraft[];
} & ProductOptionIntentCallbacks) {
  const headingId = useId();
  if (product.optionGroups.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className={`${styles.options} ${styles[`options_${density}`]}`}
      data-option-group-count={product.optionGroups.length}
    >
      <h2 id={headingId}>
        {fallbackLabel("Choose product options", "Valitse tuotevaihtoehdot", locale)}
      </h2>
      {product.optionGroups.map((group) =>
        group.presentation === "textInput" ? (
          <TextOptionGroup
            draftValue={textEntryDrafts.find((draft) => draft.groupId === group.id)?.value}
            group={group}
            key={group.id}
            locale={locale}
            onTextOptionChange={onTextOptionChange}
            product={product}
            resolvedOptions={resolvedOptions}
          />
        ) : (
          <EnumeratedOptionGroup
            assetFor={assetFor}
            group={group}
            interactionDisabled={interactionDisabled}
            key={group.id}
            locale={locale}
            onClearOption={onClearOption}
            onSelectOption={onSelectOption}
            product={product}
            resolvedOptions={resolvedOptions}
          />
        ),
      )}
      {onResetOptions &&
      (resolvedOptions.selectedValues.length > 0 ||
        textEntryDrafts.some((draft) => draft.value.length > 0)) ? (
        <button className={styles.resetOptions} onClick={onResetOptions} type="button">
          {fallbackLabel("Reset options", "Tyhjennä valinnat", locale)}
        </button>
      ) : null}
    </section>
  );
}

export function DynamicProductResolutionStatus({
  lifecycle,
  locale,
}: {
  lifecycle: ProductResolutionLifecyclePresentation;
  locale: LocaleContext;
}) {
  if (!lifecycle.message && lifecycle.warnings.length === 0) return null;
  return (
    <section
      aria-atomic="true"
      aria-busy={lifecycle.state === "pending" || undefined}
      aria-live={lifecycle.state === "failure" ? "assertive" : "polite"}
      className={styles.resolutionStatus}
      data-resolution-state={lifecycle.state}
      role={lifecycle.state === "failure" ? "alert" : "status"}
    >
      {lifecycle.message ? <p>{text(lifecycle.message, locale)}</p> : null}
      {lifecycle.warnings.length > 0 ? (
        <ul>
          {lifecycle.warnings.map((warning) => (
            <li key={canonicalValueString(warning)}>{text(warning, locale)}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function DynamicProductSpecifications({
  product,
  locale,
  layout,
}: {
  product: ProductPresentationContext;
  locale: LocaleContext;
  layout: DynamicProductDetailProps["attributeLayout"];
}) {
  const headingId = useId();
  if (product.attributeGroups.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className={`${styles.specifications} ${styles[`specifications_${layout}`]}`}
    >
      <h2 id={headingId}>{fallbackLabel("Specifications", "Tekniset tiedot", locale)}</h2>
      <div className={styles.specificationGroups}>
        {product.attributeGroups.map((group, index) => (
          <details
            className={styles.specificationGroup}
            data-attribute-count={group.attributes.length}
            key={group.id}
            open={index === 0}
          >
            <summary aria-label={text(group.title, locale)}>
              <span className={styles.specificationGroupTitle}>{text(group.title, locale)}</span>
              <span aria-hidden="true">
                {group.attributes.length} {fallbackLabel("details", "tietoa", locale)}
              </span>
            </summary>
            <dl>
              {group.attributes.map((attribute) => (
                <div key={attribute.id}>
                  <dt>{text(attribute.label, locale)}</dt>
                  <dd>
                    {text(attribute.value, locale)}
                    {attribute.unit ? ` ${text(attribute.unit, locale)}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
}

export function DynamicProductSupportingContent({
  content,
  locale,
  product,
  assetFor,
}: {
  content: DynamicProductDetailContent;
  locale: LocaleContext;
  product: ProductPresentationContext;
  assetFor: PreparedDynamicProductDetail["assetFor"];
}) {
  const headingId = useId();
  const supportingMedia = product.media.find((media) => media.role === "editorial");
  const image = supportingMedia
    ? assetFor(
        supportingMedia.assetId,
        supportingMedia.decorative ? undefined : (supportingMedia.alt ?? product.title),
        supportingMedia.decorative,
      )
    : undefined;
  if (
    !content.supportingHeading &&
    !content.supportingBody &&
    content.trustItems.length === 0 &&
    !image
  ) {
    return null;
  }
  return (
    <aside aria-labelledby={headingId} className={styles.supportingContent}>
      <h2 id={headingId}>
        {content.supportingHeading
          ? text(content.supportingHeading, locale)
          : fallbackLabel("Service and support", "Palvelu ja tuki", locale)}
      </h2>
      {content.supportingBody ? <p>{text(content.supportingBody, locale)}</p> : null}
      {image && supportingMedia ? (
        <figure
          data-asset-id={supportingMedia.assetId}
          data-asset-provenance={image.provenance.kind}
          data-asset-role="editorialImage"
        >
          <ProductAssetImage
            artDirection={image.artDirection}
            asset={image.asset}
            locale={locale}
            loadingRole="content"
          />
        </figure>
      ) : null}
      {content.trustItems.length ? (
        <div className={styles.trustItems}>
          {content.trustItems.map((item) => (
            <section key={item.id}>
              <h3>{text(item.title, locale)}</h3>
              {item.body ? <p>{text(item.body, locale)}</p> : null}
            </section>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

export function DynamicRelatedProducts({
  products,
  heading,
  locale,
  assetFor,
  anatomyId = "standard",
  onNavigateProduct,
}: {
  products: readonly ProductPresentationContext[];
  heading: LocalizedText;
  locale: LocaleContext;
  assetFor: PreparedDynamicProductDetail["assetFor"];
  anatomyId?: CanonicalProductCardAnatomyId;
  onNavigateProduct?: PreparedDynamicProductDetail["onNavigateProduct"];
}) {
  const headingId = useId();
  if (products.length === 0) return null;
  const presentedProducts = products.slice(0, PDP_PRESENTED_RELATED_PRODUCT_LIMIT);
  const canonicalRelatedFingerprint = canonicalValueFingerprint(
    products.map(({ productId, revision }) => ({ productId, revision })),
  );
  return (
    <section aria-labelledby={headingId} className={styles.relatedProducts}>
      <h2 id={headingId}>{text(heading, locale)}</h2>
      <div
        className={styles.relatedGrid}
        data-canonical-related-product-count={products.length}
        data-canonical-related-product-fingerprint={canonicalRelatedFingerprint}
        data-presented-related-product-count={presentedProducts.length}
        data-related-product-count={presentedProducts.length}
      >
        {presentedProducts.map((product) => {
          const media = product.media.find(({ role }) => role !== "editorial");
          const image = media
            ? assetFor(
                media.assetId,
                media.decorative ? undefined : (media.alt ?? product.title),
                media.decorative,
              )
            : undefined;
          return (
            <CanonicalProductCard
              key={product.productId}
              locale={locale}
              mediaPlaceholder={fallbackLabel(
                "Product image unavailable",
                "Tuotekuva ei ole saatavilla",
                locale,
              )}
              request={{
                anatomyId,
                context: "relatedProducts",
                product,
                ...(media && image ? { media, asset: image.metadata } : {}),
                showCanonicalBadge: true,
                conciseAttributeLimit: 1,
              }}
              onNavigateProduct={onNavigateProduct}
              resolvedAsset={image?.asset}
            />
          );
        })}
      </div>
    </section>
  );
}

export function DynamicProductPrimaryAction({
  label,
  state,
  locale,
  sticky,
  product,
  resolvedOptions,
  onPrimaryAction,
}: {
  label: LocalizedText;
  state: ProductPrimaryActionPresentation;
  locale: LocaleContext;
  sticky: boolean;
  product: ProductPresentationContext;
  resolvedOptions: DynamicProductOptionPresentation;
  onPrimaryAction: ProductPrimaryActionIntentCallback;
}) {
  const messageId = useId();
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const emitPrimaryAction = () => {
    if (
      !state.enabled ||
      !resolvedOptions.canAddToCart ||
      resolvedOptions.resolvedConfiguration === undefined ||
      inFlight.current
    ) {
      return;
    }
    const intent = productPrimaryActionIntentSchema.parse({
      type: "activatePrimaryProductAction",
      action: "addToCart",
      productId: product.productId,
      catalogueRevision: resolvedOptions.catalogueRevision,
      resolvedConfiguration: resolvedOptions.resolvedConfiguration,
      selectedValues: resolvedOptions.selectedValues,
      textEntries: resolvedOptions.textEntryValues.map((entry) => ({
        groupId: entry.groupId,
        value: entry.value,
      })),
    });
    inFlight.current = true;
    let result: void | Promise<void>;
    try {
      result = onPrimaryAction(intent);
    } catch (error) {
      inFlight.current = false;
      throw error;
    }
    if (result instanceof Promise) {
      setSubmitting(true);
      const resetSubmission = () => {
        inFlight.current = false;
        setSubmitting(false);
      };
      void result.then(resetSubmission, resetSubmission);
      return;
    }
    inFlight.current = false;
  };
  return (
    <section
      aria-label={fallbackLabel("Purchase action", "Ostotoiminto", locale)}
      aria-busy={submitting || undefined}
      className={`${styles.primaryAction} ${sticky ? styles.primaryAction_sticky : ""}`}
      data-action-state={state.state}
    >
      <button
        aria-describedby={state.message || submitting ? messageId : undefined}
        aria-disabled={!state.enabled || submitting}
        disabled={!state.enabled || submitting}
        onClick={emitPrimaryAction}
        type="button"
      >
        {text(label, locale)}
      </button>
      {state.message || submitting ? (
        <p aria-live="polite" id={messageId} role="status">
          {submitting
            ? fallbackLabel("Processing product action…", "Käsitellään tuotetoimintoa…", locale)
            : text(state.message!, locale)}
        </p>
      ) : null}
    </section>
  );
}

function productDetailAnatomyIdentity(variantId: DynamicProductDetailVariant) {
  const anatomy = veskifyComponentRegistryV2.get("dynamicProductDetail").commercialAnatomy;
  if (!anatomy) throw new Error("Dynamic product detail requires registered anatomy.");
  const variant = anatomy.variants.find((candidate) => candidate.variantId === variantId);
  if (!variant) throw new Error(`Missing product-detail anatomy variant: ${variantId}.`);
  const responsive = resolveResponsiveExecutionAuthority(anatomy, variantId);
  return {
    presentationMode: variant.structure.presentationMode,
    responsiveAttributes: responsiveExecutionDataAttributes(responsive),
  };
}

function productPresentationComplexity(product: ProductPresentationContext) {
  if (product.optionGroups.length === 0) return "simple";
  if (product.optionGroups.length === 1) return "light";
  if (
    product.optionGroups.length <= 3 &&
    product.optionGroups.every(({ dependsOn }) => dependsOn.length === 0)
  ) {
    return "moderate";
  }
  return "complex";
}

function productMediaDepth(product: ProductPresentationContext) {
  const count = product.media.filter(({ role }) => role !== "editorial").length;
  return count <= 1 ? "sparse" : count === 2 ? "standard" : "rich";
}

export function DynamicProductDetail(input: PreparedDynamicProductDetail) {
  const titleId = useId();
  const locale = {
    activeLocale: input.activeLocale,
    primaryLocale: input.primaryLocale,
  };
  const gallery = (
    <DynamicProductGallery
      assetFor={input.assetFor}
      layout={input.props.galleryLayout}
      locale={locale}
      media={input.resolvedOptions.selectedMediaReferences}
      product={input.product}
      treatment={input.props.mediaTreatment}
    />
  );
  const identity = (
    <>
      <DynamicProductIdentity
        locale={locale}
        product={input.product}
        resolvedOptions={input.resolvedOptions}
        showSku={input.props.showSku}
        titleId={titleId}
      />
    </>
  );
  const purchase = (
    <>
      <DynamicProductPurchaseState
        locale={locale}
        product={input.product}
        resolvedOptions={input.resolvedOptions}
        showDescription={input.props.showDescription}
      />
      <DynamicProductOptionGroups
        assetFor={input.assetFor}
        density={input.props.optionDensity}
        interactionDisabled={input.resolutionLifecycle.state === "pending"}
        locale={locale}
        onClearOption={input.onClearOption}
        onResetOptions={input.onResetOptions}
        onSelectOption={input.onSelectOption}
        onTextOptionChange={input.onTextOptionChange}
        product={input.product}
        resolvedOptions={input.resolvedOptions}
        textEntryDrafts={input.textEntryDrafts}
      />
      <DynamicProductConfigurationSummary
        locale={locale}
        product={input.product}
        resolvedOptions={input.resolvedOptions}
      />
      <DynamicProductResolutionStatus lifecycle={input.resolutionLifecycle} locale={locale} />
      <DynamicProductPrimaryAction
        label={input.content.primaryActionLabel}
        locale={locale}
        onPrimaryAction={input.onPrimaryAction}
        product={input.product}
        resolvedOptions={input.resolvedOptions}
        state={input.primaryAction}
        sticky={input.props.stickyMobileAction}
      />
    </>
  );
  const specifications = (
    <DynamicProductSpecifications
      layout={input.props.attributeLayout}
      locale={locale}
      product={input.product}
    />
  );
  const supporting = (
    <DynamicProductSupportingContent
      assetFor={input.assetFor}
      content={input.content}
      locale={locale}
      product={input.product}
    />
  );
  const related = (
    <DynamicRelatedProducts
      anatomyId={input.props.relatedCardVariant}
      assetFor={input.assetFor}
      heading={input.content.relatedHeading}
      locale={locale}
      onNavigateProduct={input.onNavigateProduct}
      products={input.relatedProducts}
    />
  );
  const composition =
    input.variant === "galleryDominant"
      ? "gallery-led"
      : input.variant === "compact"
        ? "variant-led"
        : input.variant === "editorial" || input.variant === "editorialSplit"
          ? "high-consideration"
          : "standard-commerce";
  const anatomy = productDetailAnatomyIdentity(input.variant);
  return (
    <article
      aria-busy={input.resolutionLifecycle.state === "pending" || undefined}
      aria-labelledby={titleId}
      className={`${styles.root} ${styles[`variant_${input.variant}`]} ${styles[`surface_${input.styleOverrides.surfaceTreatment}`]}`}
      data-component="dynamicProductDetail"
      data-pdp-composition={composition}
      data-product-configuration-complexity={productPresentationComplexity(input.product)}
      data-product-media-depth={productMediaDepth(input.product)}
      data-presentation-mode={anatomy.presentationMode}
      data-render-target={input.target}
      data-variant={input.variant}
      data-responsive-layout="content-driven"
      {...anatomy.responsiveAttributes}
    >
      {composition === "standard-commerce" ? (
        <>
          <div className={styles.productCore}>
            {gallery}
            <div
              className={styles.productInformation}
              data-layout-region="product-purchase-hierarchy"
              data-purchase-region="opening"
            >
              {identity}
              {purchase}
            </div>
          </div>
          {specifications}
          {supporting}
          {related}
        </>
      ) : null}
      {composition === "high-consideration" ? (
        <>
          <div className={styles.highConsiderationLayout}>
            <div className={styles.highConsiderationGallery}>{gallery}</div>
            <div
              className={styles.highConsiderationDecision}
              data-layout-region="product-purchase-hierarchy"
              data-purchase-region="opening"
            >
              {identity}
              <div className={styles.purchasePanel}>{purchase}</div>
            </div>
          </div>
          <div className={styles.highConsiderationEvidence}>
            {supporting}
            {specifications}
          </div>
          {related}
        </>
      ) : null}
      {composition === "gallery-led" ? (
        <>
          <div className={styles.galleryLedOpening}>
            <div className={styles.galleryLedStage}>{gallery}</div>
            <div
              className={styles.galleryLedPurchase}
              data-layout-region="product-purchase-hierarchy"
              data-purchase-region="opening"
            >
              <div className={styles.galleryLedIdentity}>{identity}</div>
              <div className={styles.purchasePanel}>{purchase}</div>
            </div>
          </div>
          <div className={styles.galleryLedDetail}>
            {supporting}
            {specifications}
          </div>
          {related}
        </>
      ) : null}
      {composition === "variant-led" ? (
        <>
          <div className={styles.variantLedLayout}>
            <div
              className={styles.variantLedPurchase}
              data-layout-region="product-purchase-hierarchy"
              data-purchase-region="opening"
            >
              {identity}
              <div className={styles.purchasePanel}>{purchase}</div>
            </div>
            <div className={styles.variantLedGallery}>{gallery}</div>
          </div>
          <div className={styles.variantLedDetail}>
            {specifications}
            {supporting}
          </div>
          {related}
        </>
      ) : null}
    </article>
  );
}

export const dynamicProductDetailComponentByTarget = {
  editor: DynamicProductDetail,
  preview: DynamicProductDetail,
  published: DynamicProductDetail,
} as const;

export function renderDynamicProductDetail(input: DynamicProductDetailRendererInput) {
  return <DynamicProductDetail {...prepareDynamicProductDetail(input)} />;
}
