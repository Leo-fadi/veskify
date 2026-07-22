"use client";

import { useId, useState, type CSSProperties } from "react";
import Image from "next/image";
import { z } from "zod";
import {
  componentProjectionContextSchema,
  type ProductPresentationContext,
  type StorefrontAssetMetadata,
} from "@/domain/component-platform";
import {
  assetRefSchema,
  localeSchema,
  localizedTextSchema,
  resolveLocalizedText,
  safeExternalUrlSchema,
  type AssetRef,
  type Locale,
  type LocalizedText,
} from "@/domain/shared";
import {
  dynamicProductDetailContentSchema,
  dynamicProductDetailPropsSchema,
  dynamicProductDetailStyleOverridesSchema,
  dynamicProductDetailVariantSchema,
  veskifyComponentRegistryV2,
  type DynamicProductDetailContent,
  type DynamicProductDetailProps,
  type DynamicProductDetailStyleOverrides,
  type DynamicProductDetailVariant,
} from "@/components/registry";
import styles from "./dynamic-product-detail.module.css";

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
};

export type DynamicProductDetailRendererInput = ProductOptionIntentCallbacks & {
  target: "editor" | "preview" | "published";
  instance: unknown;
  projection: unknown;
  activeLocale: Locale;
  primaryLocale: Locale;
  primaryAction: ProductPrimaryActionPresentation;
  resolveAssetUrl: (assetId: string) => string;
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
  assetFor: (assetId: string, alt?: LocalizedText) => ResolvedAsset;
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

function prepareDynamicProductDetail(
  input: DynamicProductDetailRendererInput,
): PreparedDynamicProductDetail {
  const instance = veskifyComponentRegistryV2.validateInstanceConformance(
    input.instance,
    input.projection,
  );
  if (instance.component !== "dynamicProductDetail") {
    throw new Error("The dynamic PDP renderer requires a dynamicProductDetail instance.");
  }
  const projection = componentProjectionContextSchema.parse(input.projection);
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
  const relatedIds =
    relatedBinding?.source === "productList" ? relatedBinding.productIds : ([] as string[]);
  if (!arraysEqual(relatedIds, product.relatedProductIds)) {
    throw new Error(
      "Related-product bindings must exactly match the canonical product presentation context.",
    );
  }
  const relatedProducts = relatedIds.map((productId) => {
    const related = projection.products.find((candidate) => candidate.productId === productId);
    if (!related) throw new Error(`Unknown related product: ${productId}.`);
    return related;
  });

  const requiredAssets = requiredAssetRoles(product, relatedProducts);
  const assignedAssets = new Map(
    instance.assetAssignments.map((assignment) => [assignment.assetId, assignment.role]),
  );
  for (const [assetId, expectedRole] of requiredAssets) {
    if (assignedAssets.get(assetId) !== expectedRole) {
      throw new Error(`Missing canonical PDP asset assignment: ${assetId}.`);
    }
  }
  for (const assetId of assignedAssets.keys()) {
    if (!requiredAssets.has(assetId)) {
      throw new Error(`Unused PDP asset assignment is not permitted: ${assetId}.`);
    }
  }
  const assetMetadata = new Map(projection.assets.map((asset) => [asset.assetId, asset]));

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
    primaryAction: productPrimaryActionPresentationSchema.parse(input.primaryAction),
    onSelectOption: input.onSelectOption,
    onTextOptionChange: input.onTextOptionChange,
    assetFor(assetId, alt) {
      const metadata = assetMetadata.get(assetId);
      if (!metadata || metadata.approvalStatus !== "approved") {
        throw new Error(`PDP media requires approved asset metadata: ${assetId}.`);
      }
      const asset = assetRefSchema.parse({
        id: assetId,
        url: input.resolveAssetUrl(assetId),
        alt: alt ?? metadata.alt,
        decorative: false,
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

function mediaAlt(product: ProductPresentationContext, assetId: string) {
  return product.media.find((media) => media.assetId === assetId)?.alt ?? product.title;
}

export function DynamicProductGallery({
  product,
  assetFor,
  layout,
  locale,
}: {
  product: ProductPresentationContext;
  assetFor: PreparedDynamicProductDetail["assetFor"];
  layout: DynamicProductDetailProps["galleryLayout"];
  locale: LocaleContext;
}) {
  const [selectedAssetId, setSelectedAssetId] = useState(product.media[0]?.assetId);
  if (product.media.length === 0) {
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
  const selected =
    product.media.find((media) => media.assetId === selectedAssetId) ?? product.media[0];
  const resolved = assetFor(selected.assetId, mediaAlt(product, selected.assetId));
  return (
    <section
      aria-label={fallbackLabel("Product gallery", "Tuotegalleria", locale)}
      className={`${styles.gallery} ${styles[`gallery_${layout}`]}`}
      data-layout={layout}
    >
      <figure
        className={styles.primaryMedia}
        data-asset-id={selected.assetId}
        data-asset-provenance={resolved.provenance.kind}
      >
        <ProductAssetImage asset={resolved.asset} className={styles.primaryImage} locale={locale} />
      </figure>
      {product.media.length > 1 ? (
        <div
          aria-label={fallbackLabel("Choose product image", "Valitse tuotekuva", locale)}
          className={styles.thumbnails}
          role="group"
        >
          {product.media.map((media, index) => {
            const item = assetFor(media.assetId, mediaAlt(product, media.assetId));
            return (
              <button
                aria-label={`${fallbackLabel("View product image", "Näytä tuotekuva", locale)} ${index + 1}`}
                aria-pressed={media.assetId === selected.assetId}
                data-asset-provenance={item.provenance.kind}
                key={media.assetId}
                onClick={() => setSelectedAssetId(media.assetId)}
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
  showDescription,
  showSku,
  locale,
  titleId,
}: {
  product: ProductPresentationContext;
  showDescription: boolean;
  showSku: boolean;
  locale: LocaleContext;
  titleId: string;
}) {
  return (
    <header className={styles.identity}>
      <h1 id={titleId}>{text(product.title, locale)}</h1>
      {showSku && product.sku ? (
        <p className={styles.sku}>
          <span>{fallbackLabel("SKU", "Tuotetunnus", locale)}:</span> {product.sku}
        </p>
      ) : null}
      <div aria-label={fallbackLabel("Price", "Hinta", locale)} className={styles.priceRow}>
        {product.price ? (
          <>
            <span className={styles.price}>{moneyLabel(product.price, locale)}</span>
            {product.compareAtPrice ? (
              <del className={styles.compareAtPrice}>
                {moneyLabel(product.compareAtPrice, locale)}
              </del>
            ) : null}
          </>
        ) : (
          <span className={styles.priceUnavailable}>
            {text(product.priceUnavailableReason!, locale)}
          </span>
        )}
      </div>
      {product.availability ? (
        <p aria-live="polite" className={styles.availability}>
          {text(product.availability, locale)}
        </p>
      ) : null}
      {showDescription && product.description ? (
        <p className={styles.description}>{text(product.description, locale)}</p>
      ) : null}
    </header>
  );
}

function selectedState(product: ProductPresentationContext, groupId: string) {
  return product.selectedValues.find((selection) => selection.groupId === groupId);
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
  onSelectOption,
}: {
  group: ProductPresentationContext["optionGroups"][number];
  product: ProductPresentationContext;
  locale: LocaleContext;
  assetFor: PreparedDynamicProductDetail["assetFor"];
  onSelectOption: ProductOptionIntentCallbacks["onSelectOption"];
}) {
  const describedById = useId();
  const selection = selectedState(product, group.id);
  const selectedValueId =
    selection && "valueId" in selection ? selection.valueId : group.selectedValueId;
  const complete = selection?.complete ?? false;

  if (group.presentation === "dropdown") {
    return (
      <div className={styles.dropdownGroup} data-option-group-id={group.id}>
        <label htmlFor={`${describedById}-select`}>
          <span>{text(group.label, locale)}</span>
          <OptionGroupStatus complete={complete} locale={locale} required={group.required} />
        </label>
        {group.helpText ? <p id={describedById}>{text(group.helpText, locale)}</p> : null}
        <select
          aria-describedby={group.helpText ? describedById : undefined}
          id={`${describedById}-select`}
          onChange={(event) => {
            const value = group.values.find((candidate) => candidate.id === event.target.value);
            if (value && !value.disabled) onSelectOption(group.id, value.id);
          }}
          required={group.required}
          value={selectedValueId ?? ""}
        >
          <option value="">
            {fallbackLabel("Choose an option", "Valitse vaihtoehto", locale)}
          </option>
          {group.values.map((value) => (
            <option disabled={value.disabled} key={value.id} value={value.id}>
              {text(value.label, locale)}
              {value.disabled
                ? ` — ${value.unavailableReason ? text(value.unavailableReason, locale) : fallbackLabel("unavailable", "ei saatavilla", locale)}`
                : ""}
            </option>
          ))}
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
        {group.values.map((value) => (
          <label key={value.id}>
            <input
              checked={selectedValueId === value.id}
              disabled={value.disabled}
              name={group.id}
              onChange={() => {
                if (!value.disabled) onSelectOption(group.id, value.id);
              }}
              type="radio"
              value={value.id}
            />
            <span>{text(value.label, locale)}</span>
            {value.disabled ? (
              <small>
                {value.unavailableReason
                  ? text(value.unavailableReason, locale)
                  : fallbackLabel("Unavailable", "Ei saatavilla", locale)}
              </small>
            ) : null}
          </label>
        ))}
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
          const image = value.swatch?.assetId
            ? assetFor(value.swatch.assetId, value.label)
            : undefined;
          const swatchStyle = value.swatch?.color
            ? ({ "--option-swatch": value.swatch.color } as CSSProperties)
            : undefined;
          return (
            <div className={styles.optionValue} key={value.id}>
              <button
                aria-describedby={value.disabled ? reasonId : undefined}
                aria-label={text(value.label, locale)}
                aria-pressed={selectedValueId === value.id}
                className={`${styles.optionButton} ${styles[`option_${group.presentation}`]}`}
                disabled={value.disabled}
                onClick={() => {
                  if (!value.disabled) onSelectOption(group.id, value.id);
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
              {value.disabled ? (
                <small id={reasonId}>
                  {value.unavailableReason
                    ? text(value.unavailableReason, locale)
                    : fallbackLabel("Unavailable", "Ei saatavilla", locale)}
                </small>
              ) : null}
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
  onTextOptionChange,
}: {
  group: ProductPresentationContext["optionGroups"][number];
  product: ProductPresentationContext;
  locale: LocaleContext;
  onTextOptionChange: ProductOptionIntentCallbacks["onTextOptionChange"];
}) {
  const inputId = useId();
  const constraintsId = `${inputId}-constraints`;
  const selection = selectedState(product, group.id);
  const enteredText = selection && "enteredText" in selection ? selection.enteredText : "";
  const constraints = group.textEntryConstraints!;
  return (
    <div className={styles.textOption} data-option-group-id={group.id}>
      <label htmlFor={inputId}>
        <span>{text(group.label, locale)}</span>
        <OptionGroupStatus
          complete={selection?.complete ?? false}
          locale={locale}
          required={group.required}
        />
      </label>
      {group.helpText ? <p>{text(group.helpText, locale)}</p> : null}
      <input
        aria-describedby={constraintsId}
        id={inputId}
        maxLength={constraints.maxLength}
        minLength={constraints.minLength}
        onChange={(event) => onTextOptionChange(group.id, event.target.value)}
        placeholder={constraints.placeholder ? text(constraints.placeholder, locale) : undefined}
        required={group.required}
        type="text"
        value={enteredText}
      />
      <small id={constraintsId}>
        {fallbackLabel("Character limit", "Merkkiraja", locale)}: {enteredText.length}/
        {constraints.maxLength}. {fallbackLabel("Policy", "Sääntö", locale)}:{" "}
        {constraints.characterPolicy}.
      </small>
    </div>
  );
}

export function DynamicProductOptionGroups({
  product,
  locale,
  density,
  assetFor,
  onSelectOption,
  onTextOptionChange,
}: {
  product: ProductPresentationContext;
  locale: LocaleContext;
  density: DynamicProductDetailProps["optionDensity"];
  assetFor: PreparedDynamicProductDetail["assetFor"];
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
            group={group}
            key={group.id}
            locale={locale}
            onTextOptionChange={onTextOptionChange}
            product={product}
          />
        ) : (
          <EnumeratedOptionGroup
            assetFor={assetFor}
            group={group}
            key={group.id}
            locale={locale}
            onSelectOption={onSelectOption}
            product={product}
          />
        ),
      )}
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
}: {
  content: DynamicProductDetailContent;
  locale: LocaleContext;
}) {
  const headingId = useId();
  if (!content.supportingHeading && !content.supportingBody && content.trustItems.length === 0) {
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
          const image = media ? assetFor(media.assetId, media.alt ?? product.title) : undefined;
          return (
            <article key={product.productId}>
              {image ? (
                <figure
                  data-asset-id={media.assetId}
                  data-asset-provenance={image.provenance.kind}
                >
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
}: {
  label: LocalizedText;
  state: ProductPrimaryActionPresentation;
  locale: LocaleContext;
  sticky: boolean;
}) {
  const messageId = useId();
  return (
    <section
      aria-label={fallbackLabel("Purchase action", "Ostotoiminto", locale)}
      className={`${styles.primaryAction} ${sticky ? styles.primaryAction_sticky : ""}`}
      data-action-state={state.state}
    >
      <button
        aria-describedby={state.message ? messageId : undefined}
        aria-disabled={!state.enabled}
        disabled={!state.enabled}
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
          product={input.product}
        />
        <div className={styles.productInformation}>
          <DynamicProductIdentity
            locale={locale}
            product={input.product}
            showDescription={input.props.showDescription}
            showSku={input.props.showSku}
            titleId={titleId}
          />
          <DynamicProductOptionGroups
            assetFor={input.assetFor}
            density={input.props.optionDensity}
            locale={locale}
            onSelectOption={input.onSelectOption}
            onTextOptionChange={input.onTextOptionChange}
            product={input.product}
          />
          <DynamicProductPrimaryAction
            label={input.content.primaryActionLabel}
            locale={locale}
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
      <DynamicProductSupportingContent content={input.content} locale={locale} />
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
