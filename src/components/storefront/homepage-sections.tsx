import Image from "next/image";
import { resolveLocalizedText, type AssetRef, type LocalizedText } from "@/domain/shared";
import type { StorefrontRenderContext } from "@/components/registry/contract";

export type SafeLink = { label: LocalizedText; href: string };

const text = (value: LocalizedText, context: StorefrontRenderContext) =>
  resolveLocalizedText(value, context.activeLocale, context.primaryLocale);

const assetAlt = (asset: AssetRef, context: StorefrontRenderContext) =>
  asset.decorative || !asset.alt ? "" : text(asset.alt, context);

function StorefrontImage({
  asset,
  context,
  className = "",
}: {
  asset: AssetRef;
  context: StorefrontRenderContext;
  className?: string;
}) {
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
}: {
  message: LocalizedText;
  link?: SafeLink;
  tone: "primary" | "accent";
  context: StorefrontRenderContext;
}) {
  return (
    <aside
      aria-label={text({ en: "Store announcement", fi: "Kaupan tiedote" }, context)}
      className={`store-announcement store-announcement--${tone}`}
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
}: {
  brandName: string;
  showSearch: boolean;
  showCart: boolean;
  context: StorefrontRenderContext;
}) {
  return (
    <header className="store-header">
      <a className="store-brand" href={context.pagePaths.page_home ?? "/"}>
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
}: {
  eyebrow: LocalizedText;
  title: LocalizedText;
  body: LocalizedText;
  cta: SafeLink;
  media: AssetRef;
  mediaPosition: "left" | "right";
  context: StorefrontRenderContext;
}) {
  return (
    <section className={`store-hero store-split--media-${mediaPosition}`}>
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
  context,
}: {
  heading: LocalizedText;
  collectionIds: string[];
  context: StorefrontRenderContext;
}) {
  const collections = collectionIds.flatMap((id) => {
    const collection = context.catalogue.collections.find((item) => item.id === id);
    return collection ? [collection] : [];
  });
  return (
    <section className="store-section" aria-labelledby="featured-categories-heading">
      <div className="store-section__heading">
        <p className="store-eyebrow">{text({ en: "Explore", fi: "Tutustu" }, context)}</p>
        <h2 id="featured-categories-heading">{text(heading, context)}</h2>
      </div>
      {collections.length ? (
        <div className="category-grid">
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

const price = new Intl.NumberFormat("fi-FI", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const stockLabel = (stock: string | undefined, context: StorefrontRenderContext) =>
  text(
    stock === "lowStock"
      ? { en: "Limited availability", fi: "Rajoitetusti saatavilla" }
      : stock === "outOfStock"
        ? { en: "Currently unavailable", fi: "Ei juuri nyt saatavilla" }
        : { en: "In stock", fi: "Varastossa" },
    context,
  );

export function ProductGrid({
  heading,
  productIds,
  columns,
  context,
}: {
  heading: LocalizedText;
  productIds: string[];
  columns: "two" | "three" | "four";
  context: StorefrontRenderContext;
}) {
  const products = productIds.flatMap((id) => {
    const product = context.catalogue.products.find((item) => item.id === id);
    return product ? [product] : [];
  });
  return (
    <section
      className="store-section store-section--surface"
      aria-labelledby="product-grid-heading"
    >
      <div className="store-section__heading">
        <p className="store-eyebrow">
          {text({ en: "Selected pieces", fi: "Valitut tuotteet" }, context)}
        </p>
        <h2 id="product-grid-heading">{text(heading, context)}</h2>
      </div>
      {products.length ? (
        <div className={`product-grid product-grid--${columns}`}>
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <StorefrontImage asset={product.images[0]} context={context} />
              <div>
                <h3>{text(product.title, context)}</h3>
                <p>{price.format(product.price.amount)}</p>
                <p className="product-card__stock">{stockLabel(product.stockStatus, context)}</p>
              </div>
            </article>
          ))}
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
  context,
}: {
  heading: LocalizedText;
  body: LocalizedText;
  cta: SafeLink;
  media: AssetRef;
  mediaPosition: "left" | "right";
  context: StorefrontRenderContext;
}) {
  return (
    <section className={`campaign-banner store-split--media-${mediaPosition}`}>
      <StorefrontImage asset={media} context={context} />
      <div>
        <p className="store-eyebrow">
          {text({ en: "Aurum edit", fi: "Aurum-valikoima" }, context)}
        </p>
        <h2>{text(heading, context)}</h2>
        <p>{text(body, context)}</p>
        <a className="store-button store-button--light" href={cta.href}>
          {text(cta.label, context)}
        </a>
      </div>
    </section>
  );
}

export function BrandStory({
  heading,
  body,
  media,
  facts,
  imagePosition,
  context,
}: {
  heading: LocalizedText;
  body: LocalizedText;
  media: AssetRef;
  facts: Array<{ value: string; label: LocalizedText }>;
  imagePosition: "left" | "right";
  context: StorefrontRenderContext;
}) {
  return (
    <section className={`brand-story store-split--media-${imagePosition}`}>
      <div>
        <p className="store-eyebrow">Aurum Nordic</p>
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
      <StorefrontImage asset={media} context={context} />
    </section>
  );
}

const benefitIcon: Record<string, string> = { craft: "✦", delivery: "◇", care: "○" };
export function BenefitIcons({
  benefits,
  context,
}: {
  benefits: Array<{ icon: string; title: LocalizedText; text: LocalizedText }>;
  context: StorefrontRenderContext;
}) {
  return (
    <section
      className="benefits"
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
  context,
}: {
  heading: LocalizedText;
  body: LocalizedText;
  emailLabel: LocalizedText;
  buttonLabel: LocalizedText;
  context: StorefrontRenderContext;
}) {
  return (
    <section className="newsletter">
      <div>
        <p className="store-eyebrow">Aurum journal</p>
        <h2>{text(heading, context)}</h2>
        <p>{text(body, context)}</p>
      </div>
      <form onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="demo-newsletter-email">{text(emailLabel, context)}</label>
        <div>
          <input
            id="demo-newsletter-email"
            name="email"
            placeholder="name@example.com"
            type="email"
          />
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
}: {
  brandName: string;
  contact: LocalizedText;
  policyLabel: LocalizedText;
  copyright: LocalizedText;
  showPolicies: boolean;
  context: StorefrontRenderContext;
}) {
  return (
    <footer className="store-footer">
      {showPolicies ? (
        <div>
          <a className="store-brand" href={context.pagePaths.page_home ?? "/"}>
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
              en: "Draft policy placeholder — review before publishing.",
              fi: "Luonnos käytäntötekstistä — tarkista ennen julkaisua.",
            },
            context,
          )}
        </p>
      </div>
      <p className="store-footer__copyright">{text(copyright, context)}</p>
    </footer>
  );
}
