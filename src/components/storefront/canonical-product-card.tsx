"use client";

import { useId, type ReactNode } from "react";
import {
  canonicalProductCardAuthorityVersion,
  canonicalProductCardFactsFingerprint,
  canonicalProductCardRequestSchema,
  requireCanonicalProductCardAnatomy,
} from "@/domain/product-card";
import { resolveLocalizedText, type AssetRef, type Locale } from "@/domain/shared";
import { ResponsiveStorefrontImage } from "./responsive-storefront-image";
import styles from "./canonical-product-card.module.css";

type LocaleContext = Readonly<{ activeLocale: Locale; primaryLocale: Locale }>;

export type CanonicalProductCardNavigationIntent = Readonly<{
  type: "navigateToProduct";
  productId: string;
  catalogueRevision: string;
}>;

export type CanonicalProductCardProps = Readonly<{
  request: unknown;
  locale: LocaleContext;
  resolvedAsset?: AssetRef;
  mediaPlaceholder: string;
  onNavigateProduct?: (intent: CanonicalProductCardNavigationIntent) => void;
}>;

const text = (value: Parameters<typeof resolveLocalizedText>[0], locale: LocaleContext) =>
  resolveLocalizedText(value, locale.activeLocale, locale.primaryLocale);

function moneyLabel(
  value: NonNullable<
    ReturnType<typeof canonicalProductCardRequestSchema.parse>["product"]["price"]
  >,
  locale: LocaleContext,
) {
  if (value.formatted) return text(value.formatted, locale);
  return new Intl.NumberFormat(locale.activeLocale === "fi" ? "fi-FI" : "en-FI", {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: Number.isInteger(value.amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value.amount);
}

export function CanonicalProductCard({
  request: requestValue,
  locale,
  resolvedAsset,
  mediaPlaceholder,
  onNavigateProduct,
}: CanonicalProductCardProps) {
  const request = canonicalProductCardRequestSchema.parse(requestValue);
  const anatomy = requireCanonicalProductCardAnatomy(request.anatomyId, request.context);
  const responsiveIds = (breakpoint: "mobile" | "tablet" | "desktop" | "wide") =>
    anatomy.responsiveTransformations
      .filter(({ breakpoints }) => breakpoints.includes(breakpoint))
      .map(({ id }) => id)
      .join(" ");
  const titleId = useId();
  if (resolvedAsset && (!request.media || resolvedAsset.id !== request.media.assetId)) {
    throw new Error("Resolved product-card asset must match exact canonical media authority.");
  }
  const product = request.product;
  const attributes = product.attributeGroups
    .flatMap((group) => group.attributes)
    .slice(0, request.conciseAttributeLimit);
  const sale =
    product.price !== undefined &&
    product.compareAtPrice !== undefined &&
    product.compareAtPrice.amount > product.price.amount;
  const emitNavigation = () =>
    onNavigateProduct?.({
      type: "navigateToProduct",
      productId: product.productId,
      catalogueRevision: product.revision,
    });
  const title = (
    <h3 className={styles.title} data-card-region="heading" id={titleId}>
      {onNavigateProduct ? (
        <button onClick={emitNavigation} type="button">
          {text(product.title, locale)}
        </button>
      ) : (
        text(product.title, locale)
      )}
    </h3>
  );
  const media = (
    <div className={styles.media} data-card-region="media">
      {request.media && request.asset && resolvedAsset ? (
        <figure
          data-asset-id={request.media.assetId}
          data-asset-provenance={request.asset.provenance.kind}
          data-asset-role={request.asset.role}
          data-product-media-owner={request.asset.provenance.sourceId}
        >
          <ResponsiveStorefrontImage
            alt={
              resolvedAsset.decorative || !resolvedAsset.alt ? "" : text(resolvedAsset.alt, locale)
            }
            asset={resolvedAsset}
            authority={request.asset.artDirection}
            loadingRole="merchandising"
          />
        </figure>
      ) : (
        <p className={styles.mediaPlaceholder}>{mediaPlaceholder}</p>
      )}
    </div>
  );
  const badge =
    request.showCanonicalBadge && (sale || product.priceUnavailableReason) ? (
      <p className={styles.badge} data-card-region="merchandising">
        {sale
          ? locale.activeLocale === "fi"
            ? "Alennus"
            : "Sale"
          : locale.activeLocale === "fi"
            ? "Hinta ei ole saatavilla"
            : "Price unavailable"}
      </p>
    ) : null;
  const price = (
    <div className={styles.priceRow} data-card-region="price">
      {product.price ? (
        <span className={styles.price}>{moneyLabel(product.price, locale)}</span>
      ) : (
        <span className={styles.priceUnavailable}>
          {text(product.priceUnavailableReason!, locale)}
        </span>
      )}
      {product.compareAtPrice ? <del>{moneyLabel(product.compareAtPrice, locale)}</del> : null}
    </div>
  );
  const metadata = (
    <div className={styles.metadata} data-card-region="metadata">
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
  );
  const action = onNavigateProduct ? (
    <div className={styles.actions} data-card-region="actions">
      <button onClick={emitNavigation} type="button">
        {locale.activeLocale === "fi" ? "Näytä tuote" : "View product"}
      </button>
    </div>
  ) : null;
  const content = (
    <div className={styles.content} data-card-region="content">
      {badge}
      {title}
      {price}
      {metadata}
    </div>
  );

  let body: ReactNode;
  switch (request.anatomyId) {
    case "editorial":
      body = (
        <>
          <div className={styles.editorialStage}>
            {media}
            <div className={styles.editorialOverlay}>
              {badge}
              {action}
            </div>
          </div>
          <div className={styles.editorialCopy}>
            {title}
            {price}
            {metadata}
          </div>
        </>
      );
      break;
    case "compact":
      body = (
        <div className={styles.compactFrame}>
          <div className={styles.compactLead}>
            {title}
            {price}
          </div>
          {media}
          {badge}
          {action}
        </div>
      );
      break;
    case "imageFirst":
      body = (
        <>
          <div className={styles.imageFirstStage}>
            {media}
            <div className={styles.imageFirstAction}>{action}</div>
          </div>
          <div className={styles.imageFirstCopy}>
            {badge}
            {title}
            {price}
            {metadata}
          </div>
        </>
      );
      break;
    case "horizontal":
      body = (
        <div className={styles.horizontalFrame}>
          {media}
          <div className={styles.horizontalFacts}>
            {title}
            {price}
            {metadata}
          </div>
          {action}
        </div>
      );
      break;
    default:
      body = (
        <>
          {media}
          <div className={styles.standardFrame}>
            {content}
            <aside className={styles.standardAction}>{action}</aside>
          </div>
        </>
      );
  }

  return (
    <article
      aria-labelledby={titleId}
      className={`${styles.card} ${styles[`anatomy_${request.anatomyId}`]}`}
      data-card-anatomy={request.anatomyId}
      data-card-anatomy-version={canonicalProductCardAuthorityVersion}
      data-card-context={request.context}
      data-card-semantic-anatomy={anatomy.semanticName}
      data-card-facts-fingerprint={canonicalProductCardFactsFingerprint(request)}
      data-card-presentation-mode={anatomy.semantics.structure.presentationMode}
      data-responsive-transformations={anatomy.responsiveTransformations
        .map(({ id }) => id)
        .join(" ")}
      data-responsive-mobile={responsiveIds("mobile")}
      data-responsive-tablet={responsiveIds("tablet")}
      data-responsive-desktop={responsiveIds("desktop")}
      data-responsive-wide={responsiveIds("wide")}
      data-product-id={product.productId}
      data-product-type={product.productTypeId}
    >
      {body}
    </article>
  );
}
