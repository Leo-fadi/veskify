import Image from "next/image";
import type { CSSProperties } from "react";
import {
  resolveLocalizedText,
  safeExternalUrlSchema,
  type AssetRef,
  type LocalizedText,
} from "@/domain/shared";
import type { StorefrontRenderContext } from "@/components/registry/contract";
import { CanonicalProductCard } from "./canonical-product-card";
import { projectLegacyProductCardProduct } from "@/domain/product-card";
import type { CanonicalProductCardAnatomyId } from "@/domain/product-card";

export type SafeLink = { label: LocalizedText; href: string };

type ContentLayout = "single" | "split" | "triple" | "many";

const contentLayout = (itemCount: number): ContentLayout =>
  itemCount === 1 ? "single" : itemCount === 2 ? "split" : itemCount === 3 ? "triple" : "many";

const productColumnCount = {
  two: 2,
  three: 3,
  four: 4,
} as const;

const text = (value: LocalizedText, context: StorefrontRenderContext) =>
  resolveLocalizedText(value, context.activeLocale, context.primaryLocale);

const assetAlt = (asset: AssetRef, context: StorefrontRenderContext) =>
  asset.decorative || !asset.alt ? "" : text(asset.alt, context);

export function StorefrontImage({
  asset,
  context,
  className = "",
}: {
  asset: AssetRef;
  context: StorefrontRenderContext;
  className?: string;
}) {
  const externalUrl = safeExternalUrlSchema.safeParse(asset.url);
  if (externalUrl.success) {
    const normalizedUrl = new URL(externalUrl.data.trim()).href;
    return (
      // The canonical asset schema permits HTTPS only; native rendering avoids unsafe wildcard hosts.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={assetAlt(asset, context)}
        className={className}
        height={900}
        src={normalizedUrl}
        width={1200}
      />
    );
  }
  return (
    <Image
      alt={assetAlt(asset, context)}
      className={className}
      height={900}
      src={asset.url}
      width={1200}
    />
  );
}

export function AnnouncementBar({
  message,
  link,
  tone,
  context,
  className,
}: {
  message: LocalizedText;
  link?: SafeLink;
  tone: "primary" | "accent";
  context: StorefrontRenderContext;
  className?: string;
}) {
  return (
    <aside
      aria-label={text({ en: "Store announcement", fi: "Kaupan tiedote" }, context)}
      className={`store-announcement store-announcement--${tone} ${className ?? ""}`}
    >
      <span>{text(message, context)}</span>
      {link ? <a href={link.href}>{text(link.label, context)}</a> : null}
    </aside>
  );
}

function navigationHref(
  item: StorefrontRenderContext["navigation"]["primary"][number],
  context: StorefrontRenderContext,
) {
  return item.target.type === "external"
    ? item.target.url
    : (context.pagePaths[item.target.pageId] ?? "#");
}

export function StoreHeader({
  brandName,
  showSearch,
  showCart,
  context,
  className,
}: {
  brandName: string;
  showSearch: boolean;
  showCart: boolean;
  context: StorefrontRenderContext;
  className?: string;
}) {
  return (
    <header className={`store-header ${className ?? ""}`}>
      <a className="store-brand" href={context.homePath ?? "/"}>
        {brandName}
      </a>
      <nav aria-label={text({ en: "Primary navigation", fi: "Päänavigaatio" }, context)}>
        <ul>
          {context.navigation.primary.map((item) => (
            <li key={item.id}>
              <a href={navigationHref(item, context)}>{text(item.label, context)}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="store-header__tools">
        {showSearch ? (
          <button
            aria-label={text({ en: "Search (demo)", fi: "Haku (demo)" }, context)}
            type="button"
          >
            ⌕
          </button>
        ) : null}
        {showCart ? (
          <button
            aria-label={text({ en: "Cart (demo)", fi: "Ostoskori (demo)" }, context)}
            type="button"
          >
            Bag <span aria-hidden="true">0</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function EditorialHero({
  eyebrow,
  title,
  body,
  cta,
  media,
  mediaPosition,
  context,
  className,
}: {
  eyebrow: LocalizedText;
  title: LocalizedText;
  body: LocalizedText;
  cta: SafeLink;
  media: AssetRef;
  mediaPosition: "left" | "right";
  context: StorefrontRenderContext;
  className?: string;
}) {
  return (
    <section className={`store-hero store-split--media-${mediaPosition} ${className ?? ""}`}>
      <div className="store-hero__copy">
        <p className="store-eyebrow">{text(eyebrow, context)}</p>
        <h2>{text(title, context)}</h2>
        <p>{text(body, context)}</p>
        <a className="store-button" href={cta.href}>
          {text(cta.label, context)}
        </a>
      </div>
      <StorefrontImage asset={media} className="store-hero__image" context={context} />
    </section>
  );
}

export function FeaturedCategories({
  heading,
  collectionIds,
  cardAspect,
  context,
  className,
}: {
  heading: LocalizedText;
  collectionIds: string[];
  cardAspect: "portrait" | "square";
  context: StorefrontRenderContext;
  className?: string;
}) {
  const collections = collectionIds.flatMap((id) => {
    const collection = context.catalogue.collections.find((item) => item.id === id);
    return collection ? [collection] : [];
  });
  return (
    <section
      className={`store-section ${className ?? ""}`}
      aria-labelledby="featured-categories-heading"
    >
      <div className="store-section__heading">
        <p className="store-eyebrow">{text({ en: "Explore", fi: "Tutustu" }, context)}</p>
        <h2 id="featured-categories-heading">{text(heading, context)}</h2>
      </div>
      {collections.length ? (
        <div
          className={`category-grid category-grid--${cardAspect}`}
          data-content-layout={contentLayout(collections.length)}
          data-item-count={collections.length}
        >
          {collections.map((collection) => {
            const product = context.catalogue.products.find(
              (item) => item.id === collection.productIds[0],
            );
            return (
              <article className="category-card" key={collection.id}>
                {product ? <StorefrontImage asset={product.images[0]} context={context} /> : null}
                <div>
                  <h3>{text(collection.title, context)}</h3>
                  <p>{text(collection.description, context)}</p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="store-empty">
          {text(
            {
              en: "Collections will appear here when they are available.",
              fi: "Mallistoja näytetään tässä, kun niitä on saatavilla.",
            },
            context,
          )}
        </p>
      )}
    </section>
  );
}

export function ProductGrid({
  heading,
  productIds,
  columns,
  context,
  className,
  anatomyId = "standard",
}: {
  heading: LocalizedText;
  productIds: string[];
  columns: "two" | "three" | "four";
  context: StorefrontRenderContext;
  className?: string;
  anatomyId?: CanonicalProductCardAnatomyId;
}) {
  const products = productIds.flatMap((id) => {
    const product = context.catalogue.products.find((item) => item.id === id);
    return product ? [product] : [];
  });
  return (
    <section
      className={`store-section store-section--surface ${className ?? ""}`}
      aria-labelledby="product-grid-heading"
    >
      <div className="store-section__heading">
        <p className="store-eyebrow">
          {text({ en: "Selected pieces", fi: "Valitut tuotteet" }, context)}
        </p>
        <h2 id="product-grid-heading">{text(heading, context)}</h2>
      </div>
      {products.length ? (
        <div
          className={`product-grid product-grid--${columns}`}
          data-content-layout={contentLayout(products.length)}
          data-item-count={products.length}
          style={
            {
              "--content-item-columns": Math.min(products.length, productColumnCount[columns]),
            } as CSSProperties
          }
        >
          {products.map((source) => {
            const projected = projectLegacyProductCardProduct(source);
            const media = projected.product.media[0];
            const asset = projected.assets[0];
            return (
              <CanonicalProductCard
                key={source.id}
                locale={context}
                mediaPlaceholder={text(
                  { en: "Product image unavailable", fi: "Tuotekuva ei ole saatavilla" },
                  context,
                )}
                request={{
                  anatomyId,
                  context: "legacyHomepageGrid",
                  product: projected.product,
                  ...(media && asset ? { media, asset } : {}),
                  showCanonicalBadge: true,
                  conciseAttributeLimit: 0,
                }}
                resolvedAsset={source.images[0]}
              />
            );
          })}
        </div>
      ) : (
        <p className="store-empty">
          {text(
            {
              en: "Products will appear here when they are available.",
              fi: "Tuotteita näytetään tässä, kun niitä on saatavilla.",
            },
            context,
          )}
        </p>
      )}
    </section>
  );
}

export function CampaignBanner({
  heading,
  body,
  cta,
  media,
  mediaPosition,
  ctaPresentation = "primary",
  context,
  className,
}: {
  heading: LocalizedText;
  body: LocalizedText;
  cta: SafeLink;
  media?: AssetRef;
  mediaPosition: "left" | "right";
  ctaPresentation?: "primary" | "secondary" | "text";
  context: StorefrontRenderContext;
  className?: string;
}) {
  return (
    <section className={`campaign-banner store-split--media-${mediaPosition} ${className ?? ""}`}>
      {media ? <StorefrontImage asset={media} context={context} /> : null}
      <div>
        <p className="store-eyebrow">
          {text({ en: "Aurum edit", fi: "Aurum-valikoima" }, context)}
        </p>
        <h2>{text(heading, context)}</h2>
        <p>{text(body, context)}</p>
        <a
          className={`store-button store-button--light store-button--${ctaPresentation}`}
          href={cta.href}
        >
          {text(cta.label, context)}
        </a>
      </div>
    </section>
  );
}

export function BrandStory({
  eyebrow,
  heading,
  body,
  media,
  facts,
  imagePosition,
  context,
  className,
}: {
  eyebrow?: LocalizedText;
  heading: LocalizedText;
  body: LocalizedText;
  media?: AssetRef;
  facts: Array<{ value: string; label: LocalizedText }>;
  imagePosition: "left" | "right";
  context: StorefrontRenderContext;
  className?: string;
}) {
  return (
    <section className={`brand-story store-split--media-${imagePosition} ${className ?? ""}`}>
      <div>
        <p className="store-eyebrow">
          {text(eyebrow ?? { en: "Our story", fi: "Tarina" }, context)}
        </p>
        <h2>{text(heading, context)}</h2>
        <p>{text(body, context)}</p>
        <dl>
          {facts.map((fact) => (
            <div key={fact.value}>
              <dt>{fact.value}</dt>
              <dd>{text(fact.label, context)}</dd>
            </div>
          ))}
        </dl>
      </div>
      {media ? <StorefrontImage asset={media} context={context} /> : null}
    </section>
  );
}

const benefitIcon: Record<string, string> = { craft: "✦", delivery: "◇", care: "○" };
export function BenefitIcons({
  benefits,
  context,
  className,
}: {
  benefits: Array<{ icon: string; title: LocalizedText; text: LocalizedText }>;
  context: StorefrontRenderContext;
  className?: string;
}) {
  return (
    <section
      className={`benefits ${className ?? ""}`}
      aria-label={text(
        { en: "Why shop with Aurum Nordic", fi: "Miksi valita Aurum Nordic" },
        context,
      )}
    >
      {benefits.map((benefit) => (
        <article key={benefit.icon}>
          <span aria-hidden="true">{benefitIcon[benefit.icon]}</span>
          <h2>{text(benefit.title, context)}</h2>
          <p>{text(benefit.text, context)}</p>
          {benefit.icon === "delivery" ? (
            <p>
              {text(
                {
                  en: "Draft placeholder — review before publishing",
                  fi: "Luonnospaikkamerkki — tarkista ennen julkaisua",
                },
                context,
              )}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export function Newsletter({
  heading,
  body,
  emailLabel,
  buttonLabel,
  sectionId,
  context,
  className,
}: {
  heading: LocalizedText;
  body: LocalizedText;
  emailLabel: LocalizedText;
  buttonLabel: LocalizedText;
  sectionId: string;
  context: StorefrontRenderContext;
  className?: string;
}) {
  const emailInputId = `${sectionId}-email`;
  return (
    <section className={`newsletter ${className ?? ""}`}>
      <div>
        <p className="store-eyebrow">Aurum journal</p>
        <h2>{text(heading, context)}</h2>
        <p>{text(body, context)}</p>
      </div>
      <form onSubmit={(event) => event.preventDefault()}>
        <label htmlFor={emailInputId}>{text(emailLabel, context)}</label>
        <div>
          <input id={emailInputId} name="email" placeholder="name@example.com" type="email" />
          <button type="submit">{text(buttonLabel, context)}</button>
        </div>
        <p>
          {text(
            {
              en: "Demo only — no email is submitted.",
              fi: "Vain demo — sähköpostia ei lähetetä.",
            },
            context,
          )}
        </p>
      </form>
    </section>
  );
}

export function StoreFooter({
  brandName,
  contact,
  policyLabel,
  copyright,
  showPolicies,
  context,
  className,
}: {
  brandName: string;
  contact: LocalizedText;
  policyLabel: LocalizedText;
  copyright: LocalizedText;
  showPolicies: boolean;
  context: StorefrontRenderContext;
  className?: string;
}) {
  return (
    <footer className={`store-footer ${className ?? ""}`}>
      {showPolicies ? (
        <div>
          <a className="store-brand" href={context.homePath ?? "/"}>
            {brandName}
          </a>
          <p>{text(contact, context)}</p>
        </div>
      ) : null}
      <nav aria-label={text({ en: "Footer navigation", fi: "Alatunnisteen navigaatio" }, context)}>
        <h2>{text({ en: "Explore", fi: "Tutustu" }, context)}</h2>
        <ul>
          {context.navigation.footer.map((item) => (
            <li key={item.id}>
              <a href={navigationHref(item, context)}>{text(item.label, context)}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div>
        <h2>{text({ en: "Information", fi: "Tiedot" }, context)}</h2>
        <p>{text(policyLabel, context)}</p>
        <p className="store-footer__legal">
          {text(
            {
              en: "Draft placeholder — review before publishing",
              fi: "Luonnospaikkamerkki — tarkista ennen julkaisua",
            },
            context,
          )}
        </p>
      </div>
      <p className="store-footer__copyright">{text(copyright, context)}</p>
    </footer>
  );
}
