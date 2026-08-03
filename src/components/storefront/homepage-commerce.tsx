"use client";

import Image from "next/image";
import { useId, type CSSProperties, type ReactNode } from "react";
import { z } from "zod";
import {
  componentProjectionContextSchema,
  type CollectionPresentationContext,
  type ComponentInstanceV2,
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
  homepageCollectionNavigationContentSchema,
  homepageCollectionNavigationPropsSchema,
  homepageFeaturedCollectionsContentSchema,
  homepageFeaturedCollectionsPropsSchema,
  homepageFeaturedProductsContentSchema,
  homepageFeaturedProductsPropsSchema,
  homepageHeroContentSchema,
  homepageHeroPropsSchema,
  homepagePromotionContentSchema,
  homepagePromotionPropsSchema,
  homepageSurfaceStyleSchema,
  homepageTrustContentSchema,
  homepageTrustPropsSchema,
  type HomepageCollectionNavigationContent,
  type HomepageCollectionNavigationProps,
  type HomepageFeaturedCollectionsContent,
  type HomepageFeaturedCollectionsProps,
  type HomepageFeaturedProductsContent,
  type HomepageFeaturedProductsProps,
  type HomepageHeroContent,
  type HomepageHeroProps,
  type HomepagePromotionContent,
  type HomepagePromotionProps,
  type HomepageSurfaceStyle,
  type HomepageTrustContent,
  type HomepageTrustProps,
} from "@/components/registry/homepage-commerce";
import { veskifyComponentRegistryV2 } from "@/components/registry/v2-registry";
import {
  DynamicCollectionProductCard,
  collectionNavigationIntentSchema,
  productNavigationIntentSchema,
  type CollectionNavigationIntent,
  type ProductNavigationIntent,
} from "./dynamic-collection-commerce";
import {
  dynamicCollectionCommerceDefaultContent,
  dynamicCollectionCommerceDefaultProps,
} from "@/components/registry/dynamic-collection-commerce";
import styles from "./homepage-commerce.module.css";

export const approvedNavigationIntentSchema = z
  .object({
    type: z.literal("navigateToApprovedAction"),
    navigationId: idSchema,
  })
  .strict();

export const homepageNavigationIntentSchema = z.discriminatedUnion("type", [
  productNavigationIntentSchema,
  collectionNavigationIntentSchema,
  approvedNavigationIntentSchema,
]);

export type ApprovedNavigationIntent = z.infer<typeof approvedNavigationIntentSchema>;
export type HomepageNavigationIntent =
  ProductNavigationIntent | CollectionNavigationIntent | ApprovedNavigationIntent;

export type HomepageCommerceRendererInput = {
  target: "editor" | "preview" | "published";
  instance: unknown;
  projection: unknown;
  activeLocale: Locale;
  primaryLocale: Locale;
  resolveAssetUrl: (assetId: string) => string;
  onNavigate: (intent: HomepageNavigationIntent) => void;
};

type LocaleContext = { activeLocale: Locale; primaryLocale: Locale };
type Projection = z.infer<typeof componentProjectionContextSchema>;
type ResolvedAsset = {
  asset: AssetRef;
  provenance: StorefrontAssetMetadata["provenance"];
  role: StorefrontAssetMetadata["role"];
};

const homepageComponentTypes = new Set([
  "homepageHero",
  "homepageFeaturedCollections",
  "homepageFeaturedProducts",
  "homepageCollectionNavigation",
  "homepagePromotion",
  "homepageTrust",
]);

const text = (value: LocalizedText, locale: LocaleContext) =>
  resolveLocalizedText(value, locale.activeLocale, locale.primaryLocale);

const fallback = (en: string, fi: string, locale: LocaleContext) =>
  locale.activeLocale === "fi" ? fi : en;

function bindingFor<Source extends ComponentInstanceV2["bindings"][number]["source"]>(
  instance: ComponentInstanceV2,
  slotId: string,
  source: Source,
) {
  return instance.bindings.find(
    (binding): binding is Extract<ComponentInstanceV2["bindings"][number], { source: Source }> =>
      binding.slotId === slotId && binding.source === source,
  );
}

function prepare(input: HomepageCommerceRendererInput) {
  const instance = veskifyComponentRegistryV2.validateInstanceConformance(
    input.instance,
    input.projection,
  );
  if (!homepageComponentTypes.has(instance.component)) {
    throw new Error(`The homepage renderer does not support ${instance.component}.`);
  }
  return {
    input,
    instance,
    projection: componentProjectionContextSchema.parse(input.projection),
    locale: {
      activeLocale: localeSchema.parse(input.activeLocale),
      primaryLocale: localeSchema.parse(input.primaryLocale),
    },
  };
}

function ImageAsset({ resolved, locale }: { resolved: ResolvedAsset; locale: LocaleContext }) {
  const alt =
    resolved.asset.decorative || !resolved.asset.alt ? "" : text(resolved.asset.alt, locale);
  const external = safeExternalUrlSchema.safeParse(resolved.asset.url);
  if (external.success) {
    return (
      // Canonical remote assets are HTTPS-only; native rendering avoids unsafe wildcard hosts.
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} height={900} src={new URL(external.data.trim()).href} width={1200} />
    );
  }
  return <Image alt={alt} height={900} src={resolved.asset.url} width={1200} />;
}

function resolveAsset(
  metadata: StorefrontAssetMetadata,
  input: HomepageCommerceRendererInput,
  alt?: LocalizedText,
): ResolvedAsset {
  return {
    asset: assetRefSchema.parse({
      id: metadata.assetId,
      url: input.resolveAssetUrl(metadata.assetId),
      alt: alt ?? metadata.alt,
      decorative: metadata.decorative,
    }),
    provenance: metadata.provenance,
    role: metadata.role,
  };
}

function assignedAssetIds(instance: ComponentInstanceV2, slotId: string) {
  const assignments = instance.assetAssignments.filter(
    (assignment) => assignment.slotId === slotId,
  );
  return assignments.length
    ? new Set(assignments.map((assignment) => assignment.assetId))
    : undefined;
}

function explicitAsset({
  instance,
  projection,
  input,
  bindingSlot,
  assignmentSlot,
  acceptedRoles,
}: {
  instance: ComponentInstanceV2;
  projection: Projection;
  input: HomepageCommerceRendererInput;
  bindingSlot: string;
  assignmentSlot: string;
  acceptedRoles: readonly StorefrontAssetMetadata["role"][];
}) {
  const binding = bindingFor(instance, bindingSlot, "asset");
  const assigned = assignedAssetIds(instance, assignmentSlot);
  if (!binding) {
    if (assigned) throw new Error(`Unused ${assignmentSlot} asset assignment is not permitted.`);
    return undefined;
  }
  const metadata = projection.assets.find((asset) => asset.assetId === binding.assetId);
  if (!metadata || metadata.approvalStatus !== "approved") {
    throw new Error(`Homepage media requires approved asset metadata: ${binding.assetId}.`);
  }
  if (!acceptedRoles.includes(metadata.role)) {
    throw new Error(`Homepage media uses an unsupported approved role: ${binding.assetId}.`);
  }
  if (assigned && (assigned.size !== 1 || !assigned.has(binding.assetId))) {
    throw new Error(`Homepage media assignment must match the bound asset: ${binding.assetId}.`);
  }
  return resolveAsset(metadata, input);
}

function canonicalCollectionMedia(
  collection: CollectionPresentationContext,
  projection: Projection,
  input: HomepageCommerceRendererInput,
  allowed?: ReadonlySet<string>,
) {
  for (const candidate of collection.assets) {
    const expectedRole = candidate.role === "editorial" ? "editorialImage" : "collectionImage";
    const metadata = projection.assets.find((asset) => asset.assetId === candidate.assetId);
    if (
      metadata?.approvalStatus === "approved" &&
      metadata.role === expectedRole &&
      (!allowed || allowed.has(candidate.assetId))
    ) {
      return resolveAsset(metadata, input, collection.title);
    }
  }
  return undefined;
}

function canonicalProductMedia(
  product: ProductPresentationContext,
  projection: Projection,
  input: HomepageCommerceRendererInput,
  allowed?: ReadonlySet<string>,
) {
  for (const media of product.media) {
    const expectedRole =
      media.role === "main"
        ? "productMainImage"
        : media.role === "editorial"
          ? "editorialImage"
          : "productAlternativeImage";
    const metadata = projection.assets.find((asset) => asset.assetId === media.assetId);
    if (
      metadata?.approvalStatus === "approved" &&
      metadata.role === expectedRole &&
      metadata.provenance.kind === "canonicalProductMedia" &&
      (!allowed || allowed.has(media.assetId))
    ) {
      return { media, resolved: resolveAsset(metadata, input, media.alt ?? product.title) };
    }
  }
  return undefined;
}

function ActionButton({
  label,
  navigationId,
  locale,
  onNavigate,
  presentation = "primary",
}: {
  label: LocalizedText | undefined;
  navigationId: string | undefined;
  locale: LocaleContext;
  onNavigate: HomepageCommerceRendererInput["onNavigate"];
  presentation?: "primary" | "secondary" | "text";
}) {
  if ((label === undefined) !== (navigationId === undefined)) {
    throw new Error(
      "Homepage action labels and canonical navigation bindings must be supplied together.",
    );
  }
  if (!label || !navigationId) return null;
  return (
    <button
      className={`${styles.action} ${styles[`action_${presentation}`]}`}
      onClick={() =>
        onNavigate(
          approvedNavigationIntentSchema.parse({
            type: "navigateToApprovedAction",
            navigationId,
          }),
        )
      }
      type="button"
    >
      {text(label, locale)}
    </button>
  );
}

function SectionHeading({
  id,
  heading,
  supportingCopy,
  locale,
}: {
  id: string;
  heading?: LocalizedText;
  supportingCopy?: LocalizedText;
  locale: LocaleContext;
}) {
  if (!heading && !supportingCopy) return null;
  return (
    <header className={styles.sectionHeading}>
      {heading ? <h2 id={id}>{text(heading, locale)}</h2> : null}
      {supportingCopy ? <p>{text(supportingCopy, locale)}</p> : null}
    </header>
  );
}

function sectionClass(component: string, variant: string, style: HomepageSurfaceStyle) {
  return `${styles.root} ${styles[component]} ${styles[`variant_${variant}`]} ${styles[`surface_${style.surface}`]}`;
}

export function HomepageHeroSection(input: HomepageCommerceRendererInput) {
  const prepared = prepare(input);
  const { instance, projection, locale } = prepared;
  if (instance.component !== "homepageHero") throw new Error("Expected a homepageHero instance.");
  const content: HomepageHeroContent = homepageHeroContentSchema.parse(instance.content);
  const props: HomepageHeroProps = homepageHeroPropsSchema.parse(instance.props);
  const style = homepageSurfaceStyleSchema.parse(instance.styleOverrides);
  const media = explicitAsset({
    instance,
    projection,
    input,
    bindingSlot: "heroAsset",
    assignmentSlot: "heroMedia",
    acceptedRoles: ["heroDesktop", "heroMobile", "editorialImage"],
  });
  const primary = bindingFor(instance, "primaryAction", "navigation");
  const secondary = bindingFor(instance, "secondaryAction", "navigation");
  const usesOverlayCopy =
    instance.variant === "fullBleedOverlay" &&
    media !== undefined &&
    props.mediaPosition === "background";
  return (
    <section
      aria-labelledby={`${instance.id}-heading`}
      className={sectionClass("hero", instance.variant, style)}
      data-content-width={props.contentWidth}
      data-component={instance.component}
      data-copy-treatment={usesOverlayCopy ? "overlay" : "default"}
      data-media-position={props.mediaPosition}
      data-media-state={media ? "approved" : "omitted"}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
      data-overlay-contrast={props.overlayContrast}
    >
      <div className={`${styles.heroCopy} ${styles[`align_${props.textAlignment}`]}`}>
        <h1 id={`${instance.id}-heading`}>{text(content.heading, locale)}</h1>
        {content.supportingCopy ? <p>{text(content.supportingCopy, locale)}</p> : null}
        <div className={styles.actions}>
          <ActionButton
            label={content.primaryActionLabel}
            locale={locale}
            navigationId={primary?.navigationId}
            onNavigate={input.onNavigate}
          />
          <ActionButton
            label={content.secondaryActionLabel}
            locale={locale}
            navigationId={secondary?.navigationId}
            onNavigate={input.onNavigate}
            presentation="secondary"
          />
        </div>
      </div>
      {media ? (
        <figure
          className={`${styles.heroMedia} ${styles[`media_${props.mediaPosition}`]} ${styles[`image_${props.imagePresentation}`]}`}
          data-asset-id={media.asset.id}
          data-asset-provenance={media.provenance.kind}
          data-asset-role={media.role}
        >
          <ImageAsset locale={locale} resolved={media} />
        </figure>
      ) : null}
    </section>
  );
}

function collectionsFor(instance: ComponentInstanceV2, projection: Projection, slotId: string) {
  const binding = bindingFor(instance, slotId, "collectionList");
  if (!binding) throw new Error(`Missing canonical collection-list binding: ${slotId}.`);
  return binding.collectionIds.map((collectionId) => {
    const collection = projection.collections.find((item) => item.collectionId === collectionId);
    if (!collection) throw new Error(`Unknown canonical collection: ${collectionId}.`);
    return collection;
  });
}

function CollectionCards({
  collections,
  projection,
  input,
  locale,
  placeholder,
  showDescriptions,
  presentation,
  assigned,
}: {
  collections: readonly CollectionPresentationContext[];
  projection: Projection;
  input: HomepageCommerceRendererInput;
  locale: LocaleContext;
  placeholder: LocalizedText;
  showDescriptions: boolean;
  presentation: "image" | "text" | "compact";
  assigned?: ReadonlySet<string>;
}) {
  return collections.map((collection) => {
    const media =
      presentation === "text"
        ? undefined
        : canonicalCollectionMedia(collection, projection, input, assigned);
    return (
      <article
        className={`${styles.collectionCard} ${styles[`card_${presentation}`]}`}
        data-has-media={media ? "true" : "false"}
        key={collection.collectionId}
      >
        {media ? (
          <figure
            data-asset-id={media.asset.id}
            data-asset-provenance={media.provenance.kind}
            data-asset-role={media.role}
          >
            <ImageAsset locale={locale} resolved={media} />
          </figure>
        ) : presentation === "text" ? null : (
          <p className={styles.placeholder}>{text(placeholder, locale)}</p>
        )}
        <h3>
          <button
            onClick={() =>
              input.onNavigate(
                collectionNavigationIntentSchema.parse({
                  type: "navigateToCollection",
                  collectionId: collection.collectionId,
                  collectionRevision: collection.revision,
                }),
              )
            }
            type="button"
          >
            {text(collection.title, locale)}
          </button>
        </h3>
        {showDescriptions && collection.description ? (
          <p>{text(collection.description, locale)}</p>
        ) : null}
      </article>
    );
  });
}

export function HomepageFeaturedCollectionsSection(input: HomepageCommerceRendererInput) {
  const { instance, projection, locale } = prepare(input);
  if (instance.component !== "homepageFeaturedCollections") {
    throw new Error("Expected a homepageFeaturedCollections instance.");
  }
  const content: HomepageFeaturedCollectionsContent =
    homepageFeaturedCollectionsContentSchema.parse(instance.content);
  const props: HomepageFeaturedCollectionsProps = homepageFeaturedCollectionsPropsSchema.parse(
    instance.props,
  );
  const style = homepageSurfaceStyleSchema.parse(instance.styleOverrides);
  const headingId = useId();
  const collections = collectionsFor(instance, projection, "collections");
  const assigned = assignedAssetIds(instance, "collectionMedia");
  const columnCount = Math.min(props.columns, Math.max(collections.length, 1));
  return (
    <section
      aria-labelledby={content.heading ? headingId : undefined}
      className={sectionClass("featuredCollections", instance.variant, style)}
      data-component={instance.component}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
    >
      <SectionHeading
        heading={content.heading}
        id={headingId}
        locale={locale}
        supportingCopy={content.supportingCopy}
      />
      <div
        className={`${styles.collectionGrid} ${styles[`layout_${props.layout}`]}`}
        data-column-count={columnCount}
        data-item-count={collections.length}
        style={{ "--homepage-columns": columnCount } as CSSProperties}
      >
        <CollectionCards
          assigned={assigned}
          collections={collections}
          input={input}
          locale={locale}
          placeholder={content.mediaPlaceholderLabel}
          presentation={props.cardPresentation}
          projection={projection}
          showDescriptions={props.showDescriptions}
        />
      </div>
    </section>
  );
}

export function HomepageFeaturedProductsSection(input: HomepageCommerceRendererInput) {
  const { instance, projection, locale } = prepare(input);
  if (instance.component !== "homepageFeaturedProducts") {
    throw new Error("Expected a homepageFeaturedProducts instance.");
  }
  const content: HomepageFeaturedProductsContent = homepageFeaturedProductsContentSchema.parse(
    instance.content,
  );
  const props: HomepageFeaturedProductsProps = homepageFeaturedProductsPropsSchema.parse(
    instance.props,
  );
  const style = homepageSurfaceStyleSchema.parse(instance.styleOverrides);
  const headingId = useId();
  const binding = bindingFor(instance, "products", "productList");
  if (!binding) throw new Error("Missing canonical product-list binding: products.");
  const products = binding.productIds.map((productId) => {
    const product = projection.products.find((item) => item.productId === productId);
    if (!product) throw new Error(`Unknown canonical product: ${productId}.`);
    return product;
  });
  const columnCount = Math.min(props.columns, Math.max(products.length, 1));
  const assigned = assignedAssetIds(instance, "productMedia");
  const cardContent = {
    ...dynamicCollectionCommerceDefaultContent,
    mediaPlaceholderLabel: content.mediaPlaceholderLabel,
  };
  const cardProps = {
    ...dynamicCollectionCommerceDefaultProps,
    cardVariant: props.cardVariant,
    conciseAttributeLimit: 0,
  };
  return (
    <section
      aria-labelledby={content.heading ? headingId : undefined}
      className={sectionClass("featuredProducts", instance.variant, style)}
      data-component={instance.component}
      data-render-target={input.target}
      data-responsive-layout="product-type-independent"
    >
      <SectionHeading
        heading={content.heading}
        id={headingId}
        locale={locale}
        supportingCopy={content.supportingCopy}
      />
      {products.length === 0 ? (
        <p className={styles.emptyState} data-empty-state="products" role="status">
          {text(content.emptyStateMessage, locale)}
        </p>
      ) : (
        <div
          className={`${styles.productGrid} ${styles[`layout_${props.layout}`]}`}
          data-item-count={products.length}
          style={{ "--homepage-columns": columnCount } as CSSProperties}
        >
          {products.map((product) => {
            const selected = canonicalProductMedia(product, projection, input, assigned);
            return (
              <DynamicCollectionProductCard
                assetFor={(assetId) => {
                  if (!selected || selected.media.assetId !== assetId) {
                    throw new Error(
                      `Homepage product media is not selected canonically: ${assetId}.`,
                    );
                  }
                  return selected.resolved;
                }}
                content={cardContent}
                key={product.productId}
                locale={locale}
                media={selected?.media}
                onNavigateProduct={(intent) => input.onNavigate(intent)}
                product={product}
                props={cardProps}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export function HomepageCollectionNavigationSection(input: HomepageCommerceRendererInput) {
  const { instance, projection, locale } = prepare(input);
  if (instance.component !== "homepageCollectionNavigation") {
    throw new Error("Expected a homepageCollectionNavigation instance.");
  }
  const content: HomepageCollectionNavigationContent =
    homepageCollectionNavigationContentSchema.parse(instance.content);
  const props: HomepageCollectionNavigationProps = homepageCollectionNavigationPropsSchema.parse(
    instance.props,
  );
  const style = homepageSurfaceStyleSchema.parse(instance.styleOverrides);
  const headingId = useId();
  const collections = collectionsFor(instance, projection, "collections");
  const columnCount = Math.min(props.columns, Math.max(collections.length, 1));
  return (
    <nav
      aria-labelledby={content.heading ? headingId : undefined}
      aria-label={
        content.heading ? undefined : fallback("Shop collections", "Selaa mallistoja", locale)
      }
      className={sectionClass("collectionNavigation", instance.variant, style)}
      data-component={instance.component}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
    >
      <SectionHeading heading={content.heading} id={headingId} locale={locale} />
      <div
        className={styles.collectionGrid}
        data-column-count={columnCount}
        data-item-count={collections.length}
        style={{ "--homepage-columns": columnCount } as CSSProperties}
      >
        <CollectionCards
          assigned={assignedAssetIds(instance, "collectionMedia")}
          collections={collections}
          input={input}
          locale={locale}
          placeholder={content.mediaPlaceholderLabel}
          presentation={props.presentation}
          projection={projection}
          showDescriptions={false}
        />
      </div>
    </nav>
  );
}

function EditorialSection({
  component,
  instance,
  input,
  locale,
  style,
  heading,
  description,
  actionLabel,
  actionId,
  actionPresentation,
  media,
  mediaPosition,
  textAlignment,
}: {
  component: string;
  instance: ComponentInstanceV2;
  input: HomepageCommerceRendererInput;
  locale: LocaleContext;
  style: HomepageSurfaceStyle;
  heading: LocalizedText;
  description: LocalizedText;
  actionLabel?: LocalizedText;
  actionId?: string;
  actionPresentation: "primary" | "secondary" | "text";
  media?: ResolvedAsset;
  mediaPosition: "left" | "right" | "background";
  textAlignment: "left" | "center";
}) {
  return (
    <section
      aria-labelledby={`${instance.id}-heading`}
      className={sectionClass(component, instance.variant, style)}
      data-component={instance.component}
      data-media-position={mediaPosition}
      data-media-state={media ? "approved" : "omitted"}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
    >
      <div className={`${styles.editorialCopy} ${styles[`align_${textAlignment}`]}`}>
        <h2 id={`${instance.id}-heading`}>{text(heading, locale)}</h2>
        <p>{text(description, locale)}</p>
        <ActionButton
          label={actionLabel}
          locale={locale}
          navigationId={actionId}
          onNavigate={input.onNavigate}
          presentation={actionPresentation}
        />
      </div>
      {media ? (
        <figure
          className={`${styles.editorialMedia} ${styles[`media_${mediaPosition}`]}`}
          data-asset-id={media.asset.id}
          data-asset-provenance={media.provenance.kind}
          data-asset-role={media.role}
        >
          <ImageAsset locale={locale} resolved={media} />
        </figure>
      ) : null}
    </section>
  );
}

export function HomepagePromotionSection(input: HomepageCommerceRendererInput) {
  const { instance, projection, locale } = prepare(input);
  if (instance.component !== "homepagePromotion") {
    throw new Error("Expected a homepagePromotion instance.");
  }
  const content: HomepagePromotionContent = homepagePromotionContentSchema.parse(instance.content);
  const props: HomepagePromotionProps = homepagePromotionPropsSchema.parse(instance.props);
  const style = homepageSurfaceStyleSchema.parse(instance.styleOverrides);
  const media = explicitAsset({
    instance,
    projection,
    input,
    bindingSlot: "promotionAsset",
    assignmentSlot: "promotionMedia",
    acceptedRoles: ["heroDesktop", "heroMobile", "editorialImage"],
  });
  return (
    <EditorialSection
      actionId={bindingFor(instance, "promotionAction", "navigation")?.navigationId}
      actionLabel={content.actionLabel}
      actionPresentation={props.actionPresentation}
      component="promotion"
      description={content.description}
      heading={content.heading}
      input={input}
      instance={instance}
      locale={locale}
      media={media}
      mediaPosition={props.mediaPosition}
      style={style}
      textAlignment={props.textAlignment}
    />
  );
}

const trustIcons: Record<HomepageTrustContent["items"][number]["kind"], string> = {
  delivery: "↗",
  returns: "↩",
  service: "◇",
  storeSupport: "○",
};

export function HomepageTrustSection(input: HomepageCommerceRendererInput) {
  const { instance, locale } = prepare(input);
  if (instance.component !== "homepageTrust") throw new Error("Expected a homepageTrust instance.");
  const content: HomepageTrustContent = homepageTrustContentSchema.parse(instance.content);
  const props: HomepageTrustProps = homepageTrustPropsSchema.parse(instance.props);
  const style = homepageSurfaceStyleSchema.parse(instance.styleOverrides);
  const headingId = useId();
  return (
    <section
      aria-labelledby={content.heading ? headingId : undefined}
      aria-label={
        content.heading ? undefined : fallback("Store support", "Kaupan palvelut", locale)
      }
      className={sectionClass("trust", instance.variant, style)}
      data-component={instance.component}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
    >
      <SectionHeading heading={content.heading} id={headingId} locale={locale} />
      <div
        className={`${styles.trustGrid} ${styles[`align_${props.textAlignment}`]}`}
        style={{ "--homepage-columns": props.columns } as CSSProperties}
      >
        {content.items.map((item) => (
          <article key={item.id}>
            <span aria-hidden="true">{trustIcons[item.kind]}</span>
            <h3>{text(item.title, locale)}</h3>
            <p>{text(item.description, locale)}</p>
          </article>
        ))}
      </div>
      <ActionButton
        label={content.actionLabel}
        locale={locale}
        navigationId={bindingFor(instance, "supportAction", "navigation")?.navigationId}
        onNavigate={input.onNavigate}
        presentation="text"
      />
    </section>
  );
}

const rendererByComponent: Record<string, (input: HomepageCommerceRendererInput) => ReactNode> = {
  homepageHero: HomepageHeroSection,
  homepageFeaturedCollections: HomepageFeaturedCollectionsSection,
  homepageFeaturedProducts: HomepageFeaturedProductsSection,
  homepageCollectionNavigation: HomepageCollectionNavigationSection,
  homepagePromotion: HomepagePromotionSection,
  homepageTrust: HomepageTrustSection,
};

export const homepageCommerceComponentByTarget = Object.fromEntries(
  Object.entries(rendererByComponent).map(([component, renderer]) => [
    component,
    { editor: renderer, preview: renderer, published: renderer },
  ]),
) as Record<
  string,
  Record<"editor" | "preview" | "published", (input: HomepageCommerceRendererInput) => ReactNode>
>;

export function renderHomepageCommerce(input: HomepageCommerceRendererInput) {
  const instance = veskifyComponentRegistryV2.validateInstance(input.instance);
  const Renderer = rendererByComponent[instance.component];
  if (!Renderer) throw new Error(`Unknown homepage commerce component: ${instance.component}.`);
  return <Renderer {...input} />;
}
