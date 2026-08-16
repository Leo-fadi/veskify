"use client";

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
  homepageEditorialContentSchema,
  homepageEditorialPropsSchema,
  homepageHeroContentSchema,
  homepageHeroPropsSchema,
  homepageProofContentSchema,
  homepageProofPropsSchema,
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
  type HomepageEditorialContent,
  type HomepageEditorialProps,
  type HomepageHeroContent,
  type HomepageHeroProps,
  type HomepageProofContent,
  type HomepageProofProps,
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
import {
  resolveResponsiveExecutionAuthority,
  responsiveExecutionDataAttributes,
} from "./responsive-execution";
import { ResponsiveStorefrontImage } from "./responsive-storefront-image";

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
  metadata: StorefrontAssetMetadata;
  provenance: StorefrontAssetMetadata["provenance"];
  role: StorefrontAssetMetadata["role"];
  artDirection?: StorefrontAssetMetadata["artDirection"];
};

const homepageComponentTypes = new Set([
  "homepageHero",
  "homepageFeaturedCollections",
  "homepageFeaturedProducts",
  "homepageCollectionNavigation",
  "homepagePromotion",
  "homepageTrust",
  "homepageEditorial",
  "homepageProof",
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

function ImageAsset({
  resolved,
  locale,
  loadingRole = "content",
}: {
  resolved: ResolvedAsset;
  locale: LocaleContext;
  loadingRole?: "primary" | "content" | "merchandising";
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
    metadata,
    provenance: metadata.provenance,
    role: metadata.role,
    ...(metadata.artDirection === undefined ? {} : { artDirection: metadata.artDirection }),
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

function explicitAssets({
  instance,
  projection,
  input,
  bindingSlots,
  assignmentSlot,
  acceptedRoles,
}: {
  instance: ComponentInstanceV2;
  projection: Projection;
  input: HomepageCommerceRendererInput;
  bindingSlots: readonly string[];
  assignmentSlot: string;
  acceptedRoles: readonly StorefrontAssetMetadata["role"][];
}) {
  const bindings = bindingSlots
    .map((slotId) => bindingFor(instance, slotId, "asset"))
    .filter((binding) => binding !== undefined);
  const assigned = assignedAssetIds(instance, assignmentSlot);
  if (bindings.length === 0) {
    if (assigned) throw new Error(`Unused ${assignmentSlot} asset assignment is not permitted.`);
    return [];
  }
  const resolved = bindings.map((binding) => {
    const metadata = projection.assets.find((asset) => asset.assetId === binding.assetId);
    if (!metadata || metadata.approvalStatus !== "approved") {
      throw new Error(`Editorial media requires approved asset metadata: ${binding.assetId}.`);
    }
    if (!acceptedRoles.includes(metadata.role)) {
      throw new Error(`Editorial media uses an unsupported approved role: ${binding.assetId}.`);
    }
    return resolveAsset(metadata, input);
  });
  const resolvedIds = new Set(resolved.map((asset) => asset.asset.id));
  if (
    assigned &&
    (assigned.size !== resolvedIds.size ||
      [...assigned].some((assetId) => !resolvedIds.has(assetId)))
  ) {
    throw new Error("Editorial media assignments must exactly match the bound approved assets.");
  }
  return resolved;
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
    if (media.role === "editorial") continue;
    const expectedRole = media.role === "main" ? "productMainImage" : "productAlternativeImage";
    const metadata = projection.assets.find((asset) => asset.assetId === media.assetId);
    if (
      metadata?.approvalStatus === "approved" &&
      metadata.role === expectedRole &&
      metadata.provenance.kind === "canonicalProductMedia" &&
      metadata.provenance.sourceId === product.productId &&
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
    <header className={styles.sectionHeading} data-region="section-heading">
      {heading ? <h2 id={id}>{text(heading, locale)}</h2> : null}
      {supportingCopy ? <p>{text(supportingCopy, locale)}</p> : null}
    </header>
  );
}

function sectionClass(component: string, variant: string, style: HomepageSurfaceStyle) {
  return `${styles.root} ${styles[component]} ${styles[`variant_${variant}`]} ${styles[`surface_${style.surface}`]}`;
}

function anatomyIdentity(instance: ComponentInstanceV2) {
  const anatomy = veskifyComponentRegistryV2.get(instance.component).commercialAnatomy;
  if (!anatomy) throw new Error(`Missing commercial anatomy for ${instance.component}.`);
  const variant = anatomy.variants.find((candidate) => candidate.variantId === instance.variant);
  if (!variant)
    throw new Error(`Missing commercial anatomy for ${instance.component}:${instance.variant}.`);
  const responsive = resolveResponsiveExecutionAuthority(anatomy, instance.variant);
  return {
    presentationMode: variant.structure.presentationMode,
    responsiveAttributes: responsiveExecutionDataAttributes(responsive),
  };
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
  const anatomy = anatomyIdentity(instance);
  const isCampaignMerchandising = instance.variant === "campaignMerchandising";
  const actions = (
    <div className={styles.actions} data-region="actions">
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
  );
  const copy = (
    <div
      className={`${styles.heroCopy} ${styles[`align_${props.textAlignment}`]}`}
      data-region="content"
    >
      {content.eyebrow && !isCampaignMerchandising ? (
        <p className={styles.eyebrow}>{text(content.eyebrow, locale)}</p>
      ) : null}
      <h1 id={`${instance.id}-heading`}>{text(content.heading, locale)}</h1>
      {content.supportingCopy ? <p>{text(content.supportingCopy, locale)}</p> : null}
      {isCampaignMerchandising ? null : actions}
    </div>
  );
  const merchandising = isCampaignMerchandising ? (
    <div className={styles.heroMerchandising} data-region="merchandising">
      <p className={styles.eyebrow}>{text(content.eyebrow!, locale)}</p>
    </div>
  ) : null;
  const mediaFrame = media ? (
    <figure
      className={`${styles.heroMedia} ${styles[`media_${props.mediaPosition}`]} ${styles[`image_${props.imagePresentation}`]}`}
      data-asset-id={media.asset.id}
      data-asset-provenance={media.provenance.kind}
      data-asset-role={media.role}
      data-region="media"
    >
      <ImageAsset loadingRole="primary" locale={locale} resolved={media} />
    </figure>
  ) : null;
  const mediaFirst = [
    "imageLed",
    "asymmetric",
    "fullBleedOverlay",
    "fullBleed",
    "campaignMerchandising",
  ].includes(instance.variant);
  return (
    <section
      aria-labelledby={`${instance.id}-heading`}
      className={sectionClass("hero", instance.variant, style)}
      data-content-width={props.contentWidth}
      data-component={instance.component}
      data-variant={instance.variant}
      data-copy-treatment={usesOverlayCopy ? "overlay" : "default"}
      data-media-position={props.mediaPosition}
      data-media-state={media ? "approved" : "omitted"}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
      data-overlay-contrast={props.overlayContrast}
      data-presentation-mode={anatomy.presentationMode}
      data-surface={style.surface}
      {...anatomy.responsiveAttributes}
    >
      {isCampaignMerchandising ? (
        <>
          {mediaFrame}
          {merchandising}
          {copy}
          {actions}
        </>
      ) : (
        <>
          {mediaFirst ? mediaFrame : copy}
          {mediaFirst ? copy : mediaFrame}
        </>
      )}
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
            <ImageAsset loadingRole="merchandising" locale={locale} resolved={media} />
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
  const anatomy = anatomyIdentity(instance);
  return (
    <section
      aria-labelledby={content.heading ? headingId : undefined}
      className={sectionClass("featuredCollections", instance.variant, style)}
      data-component={instance.component}
      data-presentation-mode={anatomy.presentationMode}
      data-variant={instance.variant}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
      data-surface={style.surface}
      {...anatomy.responsiveAttributes}
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
        data-region="collection-grid"
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
  const anatomy = anatomyIdentity(instance);
  return (
    <section
      aria-labelledby={content.heading ? headingId : undefined}
      className={sectionClass("featuredProducts", instance.variant, style)}
      data-component={instance.component}
      data-presentation-mode={anatomy.presentationMode}
      data-variant={instance.variant}
      data-render-target={input.target}
      data-responsive-layout="product-type-independent"
      data-surface={style.surface}
      {...anatomy.responsiveAttributes}
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
          data-region="product-grid"
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
                context="homepageMerchandising"
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
  const anatomy = anatomyIdentity(instance);
  return (
    <nav
      aria-labelledby={content.heading ? headingId : undefined}
      aria-label={
        content.heading ? undefined : fallback("Shop collections", "Selaa mallistoja", locale)
      }
      className={sectionClass("collectionNavigation", instance.variant, style)}
      data-component={instance.component}
      data-presentation-mode={anatomy.presentationMode}
      data-variant={instance.variant}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
      data-surface={style.surface}
      {...anatomy.responsiveAttributes}
    >
      <SectionHeading heading={content.heading} id={headingId} locale={locale} />
      <div
        className={styles.collectionGrid}
        data-column-count={columnCount}
        data-item-count={collections.length}
        data-region="collection-navigation-grid"
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
  const anatomy = anatomyIdentity(instance);
  return (
    <section
      aria-labelledby={`${instance.id}-heading`}
      className={sectionClass(component, instance.variant, style)}
      data-component={instance.component}
      data-variant={instance.variant}
      data-media-position={mediaPosition}
      data-media-state={media ? "approved" : "omitted"}
      data-presentation-mode={anatomy.presentationMode}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
      data-surface={style.surface}
      {...anatomy.responsiveAttributes}
    >
      <div
        className={`${styles.editorialCopy} ${styles[`align_${textAlignment}`]}`}
        data-region="content"
      >
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
          data-region="media"
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
    acceptedRoles: ["collectionImage", "editorialImage", "heroDesktop", "heroMobile"],
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

function EditorialMediaGallery({
  assets,
  columns,
  locale,
  position,
}: {
  assets: readonly ResolvedAsset[];
  columns: number;
  locale: LocaleContext;
  position: "left" | "right";
}) {
  if (assets.length === 0) return null;
  return (
    <div
      className={`${styles.storyGallery} ${styles[`media_${position}`]}`}
      data-gallery-columns={Math.min(columns, assets.length)}
      data-region="editorial-media"
      style={{ "--homepage-columns": Math.min(columns, assets.length) } as CSSProperties}
    >
      {assets.map((asset) => (
        <figure
          className={styles.editorialMedia}
          data-asset-id={asset.asset.id}
          data-asset-provenance={asset.provenance.kind}
          data-asset-role={asset.role}
          key={asset.asset.id}
        >
          <ImageAsset locale={locale} resolved={asset} />
        </figure>
      ))}
    </div>
  );
}

export function HomepageEditorialSection(input: HomepageCommerceRendererInput) {
  const { instance, projection, locale } = prepare(input);
  if (instance.component !== "homepageEditorial") {
    throw new Error("Expected a homepageEditorial instance.");
  }
  const content: HomepageEditorialContent = homepageEditorialContentSchema.parse(instance.content);
  const props: HomepageEditorialProps = homepageEditorialPropsSchema.parse(instance.props);
  const style = homepageSurfaceStyleSchema.parse(instance.styleOverrides);
  const assets = explicitAssets({
    instance,
    projection,
    input,
    bindingSlots: ["storyPrimaryAsset", "storySecondaryAsset", "storyTertiaryAsset"],
    assignmentSlot: "storyMedia",
    acceptedRoles: ["editorialImage", "heroDesktop", "heroMobile"],
  });
  const action = bindingFor(instance, "editorialAction", "navigation");
  const anatomy = anatomyIdentity(instance);
  const gallery = (
    <EditorialMediaGallery
      assets={instance.variant === "continuationCta" ? [] : assets}
      columns={instance.variant === "lookbookGallery" ? props.galleryColumns : 1}
      locale={locale}
      position={props.mediaPosition}
    />
  );
  const copy = (
    <div
      className={`${styles.editorialCopy} ${styles[`align_${props.textAlignment}`]}`}
      data-region="content"
    >
      {content.eyebrow ? <p className={styles.eyebrow}>{text(content.eyebrow, locale)}</p> : null}
      <h2 id={`${instance.id}-heading`}>{text(content.heading, locale)}</h2>
      <p>{text(content.body, locale)}</p>
      {instance.variant === "craftProcess" ? (
        <ol className={styles.processList}>
          {content.steps.map((step) => (
            <li key={step.id}>
              <h3>{text(step.title, locale)}</h3>
              <p>{text(step.description, locale)}</p>
            </li>
          ))}
        </ol>
      ) : null}
      <ActionButton
        label={content.actionLabel}
        locale={locale}
        navigationId={action?.navigationId}
        onNavigate={input.onNavigate}
        presentation="text"
      />
    </div>
  );
  const mediaFirst = instance.variant === "lookbookGallery";
  return (
    <section
      aria-labelledby={`${instance.id}-heading`}
      className={sectionClass("editorialStory", instance.variant, style)}
      data-component={instance.component}
      data-media-state={assets.length > 0 ? "approved" : "omitted"}
      data-presentation-mode={anatomy.presentationMode}
      data-render-target={input.target}
      data-responsive-layout="governed-editorial"
      data-surface={style.surface}
      data-variant={instance.variant}
      {...anatomy.responsiveAttributes}
    >
      {mediaFirst ? gallery : copy}
      {mediaFirst ? copy : gallery}
    </section>
  );
}

export function HomepageProofSection(input: HomepageCommerceRendererInput) {
  const { instance, locale } = prepare(input);
  if (instance.component !== "homepageProof") throw new Error("Expected a homepageProof instance.");
  const content: HomepageProofContent = homepageProofContentSchema.parse(instance.content);
  const props: HomepageProofProps = homepageProofPropsSchema.parse(instance.props);
  const style = homepageSurfaceStyleSchema.parse(instance.styleOverrides);
  const anatomy = anatomyIdentity(instance);
  const headingId = useId();
  return (
    <section
      aria-label={
        content.heading ? undefined : fallback("Approved proof", "Hyväksytty näyttö", locale)
      }
      aria-labelledby={content.heading ? headingId : undefined}
      className={sectionClass("proof", instance.variant, style)}
      data-component={instance.component}
      data-evidence-state="approved"
      data-presentation-mode={anatomy.presentationMode}
      data-render-target={input.target}
      data-responsive-layout="governed-proof"
      data-surface={style.surface}
      data-variant={instance.variant}
      {...anatomy.responsiveAttributes}
    >
      <SectionHeading heading={content.heading} id={headingId} locale={locale} />
      <div
        className={`${styles.proofGrid} ${styles[`align_${props.textAlignment}`]}`}
        data-region="proof-grid"
        style={
          { "--homepage-columns": Math.min(props.columns, content.items.length) } as CSSProperties
        }
      >
        {content.items.map((item) => (
          <article
            data-evidence-authority={item.evidence.authorityId}
            data-evidence-source={item.evidence.source}
            key={item.id}
          >
            {item.kind === "quote" ? (
              <blockquote>
                <p>{text(item.statement, locale)}</p>
                {item.attribution ? <cite>{text(item.attribution, locale)}</cite> : null}
              </blockquote>
            ) : (
              <>
                <p>{text(item.statement, locale)}</p>
                {item.attribution ? (
                  <p className={styles.proofAttribution}>{text(item.attribution, locale)}</p>
                ) : null}
              </>
            )}
          </article>
        ))}
      </div>
    </section>
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
  const anatomy = anatomyIdentity(instance);
  return (
    <section
      aria-labelledby={content.heading ? headingId : undefined}
      aria-label={
        content.heading ? undefined : fallback("Store support", "Kaupan palvelut", locale)
      }
      className={sectionClass("trust", instance.variant, style)}
      data-component={instance.component}
      data-presentation-mode={anatomy.presentationMode}
      data-variant={instance.variant}
      data-render-target={input.target}
      data-responsive-layout="content-driven"
      data-surface={style.surface}
      {...anatomy.responsiveAttributes}
    >
      <SectionHeading heading={content.heading} id={headingId} locale={locale} />
      <div
        className={`${styles.trustGrid} ${styles[`align_${props.textAlignment}`]}`}
        data-region="trust-grid"
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
  homepageEditorial: HomepageEditorialSection,
  homepageProof: HomepageProofSection,
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
