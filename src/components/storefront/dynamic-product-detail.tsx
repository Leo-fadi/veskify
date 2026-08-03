"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
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
  safeExternalUrlSchema,
  type AssetRef,
  type Locale,
  type LocalizedText,
} from "@/domain/shared";
import { canonicalValueString } from "@/domain/storefront";
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
};

type ResolvedAsset = {
  asset: AssetRef;
  provenance: StorefrontAssetMetadata["provenance"];
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
    const media = related ? item.media.slice(0, 1) : item.media;
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
  const productBinding = instance.bindings.find(
    (binding) => binding.slotId === "primaryProduct" && binding.source === "product",
  );
  if (!productBinding || productBinding.source !== "product") {
    throw new Error("The dynamic PDP renderer requires one canonical product binding.");
  }
  const product = projection.products.find(
    (candidate) => candidate.productId === productBinding.productId,
  );
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
    const related = projection.products.find((candidate) => candidate.productId === productId);
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
      return { asset, provenance: metadata.provenance };
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
  locale,
  className,
}: {
  asset: AssetRef;
  locale: LocaleContext;
  className?: string;
}) {
  const alt = asset.decorative || !asset.alt ? "" : text(asset.alt, locale);
  const externalUrl = safeExternalUrlSchema.safeParse(asset.url);
  if (externalUrl.success) {
    return (
      // Canonical asset references permit HTTPS only; native rendering avoids unsafe wildcard hosts.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={alt}
        className={className}
        height={900}
        src={new URL(externalUrl.data.trim()).href}
        width={1200}
      />
    );
  }
  return <Image alt={alt} className={className} height={900} src={asset.url} width={1200} />;
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

function mediaPresentation(product: ProductPresentationContext, assetId: string) {
  const media = product.media.find((item) => item.assetId === assetId);
  return {
    alt: media?.decorative ? undefined : (media?.alt ?? product.title),
    decorative: media?.decorative ?? false,
  };
}

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
  const galleryMedia = media.filter(
    (item) =>
      product.media.find((candidate) => candidate.assetId === item.assetId)?.role !== "editorial",
  );
  const mediaFingerprint = canonicalValueString(galleryMedia.map((item) => item.assetId));
  const [selection, setSelection] = useState(() => ({
    mediaFingerprint,
    assetId: galleryMedia[0]?.assetId,
  }));
  if (galleryMedia.length === 0) {
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
    galleryMedia.some((item) => item.assetId === selection.assetId)
      ? selection.assetId
      : galleryMedia[0].assetId;
  const selected = galleryMedia.find((item) => item.assetId === selectedAssetId) ?? galleryMedia[0];
  const selectedPresentation = mediaPresentation(product, selected.assetId);
  const resolved = assetFor(
    selected.assetId,
    selectedPresentation.alt,
    selectedPresentation.decorative,
  );
  return (
    <section
      aria-label={fallbackLabel("Product gallery", "Tuotegalleria", locale)}
      className={`${styles.gallery} ${styles[`gallery_${layout}`]} ${styles[`media_${treatment}`]}`}
      data-layout={layout}
    >
      <figure
        className={styles.primaryMedia}
        data-asset-id={selected.assetId}
        data-asset-provenance={resolved.provenance.kind}
      >
        <ProductAssetImage asset={resolved.asset} className={styles.primaryImage} locale={locale} />
      </figure>
      {galleryMedia.length > 1 ? (
        <div
          aria-label={fallbackLabel("Choose product image", "Valitse tuotekuva", locale)}
          className={styles.thumbnails}
          role="group"
        >
          {galleryMedia.map((mediaItem, index) => {
            const presentation = mediaPresentation(product, mediaItem.assetId);
            const item = assetFor(mediaItem.assetId, presentation.alt, presentation.decorative);
            return (
              <button
                aria-label={`${fallbackLabel("View product image", "Näytä tuotekuva", locale)} ${index + 1}`}
                aria-pressed={mediaItem.assetId === selected.assetId}
                data-asset-provenance={item.provenance.kind}
                key={mediaItem.assetId}
                onClick={() => setSelection({ mediaFingerprint, assetId: mediaItem.assetId })}
                type="button"
              >
                <ProductAssetImage asset={item.asset} locale={locale} />
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
  showDescription,
  showSku,
  locale,
  titleId,
}: {
  product: ProductPresentationContext;
  resolvedOptions: DynamicProductOptionPresentation;
  showDescription: boolean;
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
        <p className={styles.description}>{text(product.description, locale)}</p>
      ) : null}
    </header>
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
  const groupDependencyReasonId = `${describedById}-dependency`;

  if (group.presentation === "dropdown") {
    return (
      <div className={styles.dropdownGroup} data-option-group-id={group.id}>
        <label htmlFor={`${describedById}-select`}>
          <span>{text(group.label, locale)}</span>
          <OptionGroupStatus complete={complete} locale={locale} required={group.required} />
        </label>
        {group.helpText ? <p id={describedById}>{text(group.helpText, locale)}</p> : null}
        {groupDependencyReason ? <p id={groupDependencyReasonId}>{groupDependencyReason}</p> : null}
        <select
          aria-describedby={
            [group.helpText ? describedById : undefined, groupDependencyReasonId]
              .filter((id) => id && (id !== groupDependencyReasonId || groupDependencyReason))
              .join(" ") || undefined
          }
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
      <fieldset className={styles.radioGroup} data-option-group-id={group.id}>
        <legend>
          {text(group.label, locale)}
          <OptionGroupStatus complete={complete} locale={locale} required={group.required} />
        </legend>
        {group.helpText ? <p>{text(group.helpText, locale)}</p> : null}
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
    <fieldset className={styles.buttonGroup} data-option-group-id={group.id}>
      <legend>
        {text(group.label, locale)}
        <OptionGroupStatus complete={complete} locale={locale} required={group.required} />
      </legend>
      {group.helpText ? <p>{text(group.helpText, locale)}</p> : null}
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
                  <ProductAssetImage asset={image.asset} locale={locale} />
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
  const dependencyId = `${inputId}-dependency`;
  const selection = selectedTextState(resolvedOptions, group.id);
  const enteredText = draftValue ?? selection?.value ?? "";
  const constraints = group.textEntryConstraints!;
  const blockedReason = dependencyMessage(product, resolvedOptions, group.id, locale);
  const policyGuidance: Record<typeof constraints.characterPolicy, { en: string; fi: string }> = {
    unicodeText: {
      en: "Letters, numbers, spaces and symbols are allowed; control characters are not allowed.",
      fi: "Kirjaimet, numerot, välilyönnit ja symbolit sallitaan; ohjausmerkkejä ei sallita.",
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
      ? `${enteredText.length}/${constraints.maxLength} merkkiä. Sallittu pituus: ${constraints.minLength}-${constraints.maxLength} merkkiä. ${policyGuidance[constraints.characterPolicy].fi}`
      : `${enteredText.length}/${constraints.maxLength} characters. Allowed length: ${constraints.minLength}-${constraints.maxLength} characters. ${policyGuidance[constraints.characterPolicy].en}`;
  return (
    <div className={styles.textOption} data-option-group-id={group.id}>
      <label htmlFor={inputId}>
        <span>{text(group.label, locale)}</span>
        <OptionGroupStatus
          complete={!resolvedOptions.incompleteRequiredGroupIds.includes(group.id)}
          locale={locale}
          required={group.required}
        />
      </label>
      {group.helpText ? <p>{text(group.helpText, locale)}</p> : null}
      {blockedReason ? <p id={dependencyId}>{blockedReason}</p> : null}
      <input
        aria-describedby={[constraintsId, blockedReason ? dependencyId : undefined]
          .filter(Boolean)
          .join(" ")}
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
      aria-live="polite"
      className={styles.resolutionStatus}
      data-resolution-state={lifecycle.state}
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
        {product.attributeGroups.map((group) => (
          <section aria-labelledby={`${headingId}-${group.id}`} key={group.id}>
            <h3 id={`${headingId}-${group.id}`}>{text(group.title, locale)}</h3>
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
          </section>
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
          <ProductAssetImage asset={image.asset} locale={locale} />
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
}: {
  products: readonly ProductPresentationContext[];
  heading: LocalizedText;
  locale: LocaleContext;
  assetFor: PreparedDynamicProductDetail["assetFor"];
}) {
  const headingId = useId();
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className={styles.relatedProducts}>
      <h2 id={headingId}>{text(heading, locale)}</h2>
      <div className={styles.relatedGrid}>
        {products.map((product) => {
          const media = product.media[0];
          const image = media
            ? assetFor(
                media.assetId,
                media.decorative ? undefined : (media.alt ?? product.title),
                media.decorative,
              )
            : undefined;
          return (
            <article key={product.productId}>
              {image ? (
                <figure data-asset-id={media.assetId} data-asset-provenance={image.provenance.kind}>
                  <ProductAssetImage asset={image.asset} locale={locale} />
                </figure>
              ) : null}
              <h3>{text(product.title, locale)}</h3>
              <p>
                {product.price
                  ? moneyLabel(product.price, locale)
                  : text(product.priceUnavailableReason!, locale)}
              </p>
              {product.availability ? <p>{text(product.availability, locale)}</p> : null}
            </article>
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
      className={`${styles.primaryAction} ${sticky ? styles.primaryAction_sticky : ""}`}
      data-action-state={state.state}
    >
      <button
        aria-describedby={state.message ? messageId : undefined}
        aria-disabled={!state.enabled || submitting}
        disabled={!state.enabled || submitting}
        onClick={emitPrimaryAction}
        type="button"
      >
        {text(label, locale)}
      </button>
      {state.message ? (
        <p aria-live="polite" id={messageId}>
          {text(state.message, locale)}
        </p>
      ) : null}
    </section>
  );
}

export function DynamicProductDetail(input: PreparedDynamicProductDetail) {
  const titleId = useId();
  const locale = {
    activeLocale: input.activeLocale,
    primaryLocale: input.primaryLocale,
  };
  return (
    <article
      aria-labelledby={titleId}
      className={`${styles.root} ${styles[`variant_${input.variant}`]} ${styles[`surface_${input.styleOverrides.surfaceTreatment}`]}`}
      data-component="dynamicProductDetail"
      data-render-target={input.target}
      data-variant={input.variant}
      data-responsive-layout="content-driven"
    >
      <div className={styles.productCore}>
        <DynamicProductGallery
          assetFor={input.assetFor}
          layout={input.props.galleryLayout}
          locale={locale}
          media={input.resolvedOptions.selectedMediaReferences}
          product={input.product}
          treatment={input.props.mediaTreatment}
        />
        <div className={styles.productInformation}>
          <DynamicProductIdentity
            locale={locale}
            product={input.product}
            resolvedOptions={input.resolvedOptions}
            showDescription={input.props.showDescription}
            showSku={input.props.showSku}
            titleId={titleId}
          />
          <DynamicProductResolutionStatus lifecycle={input.resolutionLifecycle} locale={locale} />
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
          <DynamicProductPrimaryAction
            label={input.content.primaryActionLabel}
            locale={locale}
            onPrimaryAction={input.onPrimaryAction}
            product={input.product}
            resolvedOptions={input.resolvedOptions}
            state={input.primaryAction}
            sticky={input.props.stickyMobileAction}
          />
        </div>
      </div>
      <DynamicProductSpecifications
        layout={input.props.attributeLayout}
        locale={locale}
        product={input.product}
      />
      <DynamicProductSupportingContent
        assetFor={input.assetFor}
        content={input.content}
        locale={locale}
        product={input.product}
      />
      <DynamicRelatedProducts
        assetFor={input.assetFor}
        heading={input.content.relatedHeading}
        locale={locale}
        products={input.relatedProducts}
      />
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
