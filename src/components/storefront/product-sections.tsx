"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveLocalizedText, type AssetRef, type LocalizedText } from "@/domain/shared";
import type { ProductDisplayModel } from "@/domain/catalogue";
import type { StorefrontRenderContext } from "@/components/registry/contract";
import styles from "./product-sections.module.css";

const text = (value: LocalizedText, context: StorefrontRenderContext) =>
  resolveLocalizedText(value, context.activeLocale, context.primaryLocale);
const productFor = (id: string, context: StorefrontRenderContext) =>
  context.catalogue.products.find((product) => product.id === id)!;
const price = new Intl.NumberFormat("fi-FI", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const label = (en: string, fi: string, context: StorefrontRenderContext) =>
  context.activeLocale === "fi" ? fi : en;
const stockLabel = (stock: ProductDisplayModel["stockStatus"], context: StorefrontRenderContext) =>
  stock === undefined
    ? label("Availability not provided", "Saatavuustietoa ei annettu", context)
    : stock === "lowStock"
      ? label("Limited availability", "Rajoitetusti saatavilla", context)
      : stock === "outOfStock"
        ? label("Currently unavailable", "Ei juuri nyt saatavilla", context)
        : label("In stock", "Varastossa", context);

function ProductImage({
  asset,
  context,
  className,
}: {
  asset: AssetRef;
  context: StorefrontRenderContext;
  className?: string;
}) {
  return (
    <Image
      alt={asset.decorative || !asset.alt ? "" : text(asset.alt, context)}
      className={className}
      height={1000}
      src={asset.url}
      width={1000}
    />
  );
}

export function ProductGallery({
  productId,
  context,
}: {
  productId: string;
  context: StorefrontRenderContext;
}) {
  const product = productFor(productId, context);
  const [selectedImageId, setSelectedImageId] = useState(product.images[0].id);
  const selectedImage =
    product.images.find((image) => image.id === selectedImageId) ?? product.images[0];
  return (
    <section
      aria-label={label("Product gallery", "Tuotekuvat", context)}
      className={styles.gallery}
    >
      <ProductImage asset={selectedImage} className={styles.primaryImage} context={context} />
      <div
        aria-label={label("Choose product image", "Valitse tuotekuva", context)}
        className={styles.thumbnails}
        role="group"
      >
        {product.images.map((image, index) => (
          <button
            aria-label={`${label("View image", "Näytä kuva", context)} ${index + 1}: ${
              image.alt ? text(image.alt, context) : text(product.title, context)
            }`}
            aria-pressed={image.id === selectedImage.id}
            key={image.id}
            onClick={() => setSelectedImageId(image.id)}
            type="button"
          >
            <ProductImage asset={image} context={context} />
          </button>
        ))}
      </div>
    </section>
  );
}

const attributeLabels: Record<string, [string, string]> = {
  material: ["Material", "Materiaali"],
  fineness: ["Fineness", "Pitoisuus"],
  karat: ["Karat", "Karaatti"],
  metalColour: ["Metal colour", "Metallin väri"],
  stoneType: ["Stone", "Kivi"],
  stoneShape: ["Stone shape", "Kiven muoto"],
  ringSizes: ["Ring sizes", "Sormuskoot"],
  ringWidthMm: ["Ring width", "Sormuksen leveys"],
  ringProfile: ["Profile", "Profiili"],
  engraving: ["Engraving", "Kaiverrus"],
};
const valueLabels: Record<string, [string, string]> = {
  gold: ["Gold", "Kulta"],
  yellow: ["Yellow gold", "Keltakulta"],
  diamond: ["Diamond", "Timantti"],
  round: ["Round", "Pyöreä"],
  comfort: ["Comfort", "Comfort"],
  available: ["Available", "Saatavilla"],
};

export function ProductInfo({
  productId,
  showRating,
  context,
}: {
  productId: string;
  showRating: boolean;
  context: StorefrontRenderContext;
}) {
  const product = productFor(productId, context);
  const entries = Object.entries(product.attributes).filter(([key]) => key in attributeLabels);
  const displayValue = (key: string, value: string | number | string[]) => {
    if (key === "ringWidthMm") return `${String(value)} mm`;
    if (Array.isArray(value)) return value.join("–");
    const translated = valueLabels[String(value)];
    return translated ? label(translated[0], translated[1], context) : String(value);
  };
  return (
    <section className={styles.info}>
      <p className={styles.eyebrow}>Aurum Nordic</p>
      <h1>{text(product.title, context)}</h1>
      {showRating ? (
        <p
          aria-label={label(
            "Visual rating placeholder, five stars",
            "Visuaalinen arvostelupaikka, viisi tähteä",
            context,
          )}
        >
          ★★★★★ <small>{label("Visual demo", "Visuaalinen demo", context)}</small>
        </p>
      ) : null}
      <p className={styles.price}>{price.format(product.price.amount)}</p>
      <p className={styles.stock}>
        {stockLabel(product.stockStatus, context)} · {label("Display only", "Vain esitys", context)}
      </p>
      {product.description ? (
        <p className={styles.description}>{text(product.description, context)}</p>
      ) : null}
      <dl className={styles.attributes}>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{label(attributeLabels[key][0], attributeLabels[key][1], context)}</dt>
            <dd>{displayValue(key, value)}</dd>
          </div>
        ))}
      </dl>
      <button className={styles.addButton} type="button">
        {label("Add to cart — demo only", "Lisää ostoskoriin — vain demo", context)}
      </button>
      <p className={styles.demoNote}>
        {label(
          "This button does not create a cart or transaction.",
          "Painike ei luo ostoskoria tai maksutapahtumaa.",
          context,
        )}
      </p>
    </section>
  );
}

export function ProductOptions({
  productId,
  context,
}: {
  productId: string;
  context: StorefrontRenderContext;
}) {
  const product = productFor(productId, context);
  const options = product.orderOptions ?? [];
  return (
    <section aria-labelledby="product-options-heading" className={styles.options}>
      <h2 id="product-options-heading">
        {label("Choose your details", "Valitse yksityiskohdat", context)}
      </h2>
      {options.length === 0 && product.variants.length === 0 ? (
        <p>
          {label(
            "This product has no options to choose.",
            "Tällä tuotteella ei ole valittavia vaihtoehtoja.",
            context,
          )}
        </p>
      ) : null}
      {product.variants.length ? (
        <div className={styles.optionGroup}>
          <p>{label("Variant", "Tuoteversio", context)}</p>
          {product.variants.map((variant) => (
            <button key={variant.id} type="button">
              {text(variant.label, context)}
            </button>
          ))}
        </div>
      ) : null}
      {options.map((option) =>
        option.type === "selection" ? (
          <fieldset className={styles.optionGroup} key={option.id}>
            <legend>
              {text(option.label, context)}
              {option.required ? " *" : ""}
            </legend>
            {option.values?.map((value, index) => (
              <label key={`${option.id}-${index}`}>
                <input name={option.id} type="radio" />
                <span>{text(value, context)}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <label className={styles.engraving} key={option.id}>
            {text(option.label, context)} ({label("optional", "valinnainen", context)})
            <input maxLength={option.maxLength} type="text" />
            <small>
              {label(
                `Maximum ${option.maxLength} characters`,
                `Enintään ${option.maxLength} merkkiä`,
                context,
              )}
            </small>
          </label>
        ),
      )}
      <p className={styles.demoNote}>
        {label(
          "Selections are visual demo controls and are not saved or submitted.",
          "Valinnat ovat demon visuaalisia ohjaimia, eikä niitä tallenneta tai lähetetä.",
          context,
        )}
      </p>
    </section>
  );
}

export function ImageText({
  heading,
  body,
  media,
  context,
}: {
  heading: LocalizedText;
  body: LocalizedText;
  media: AssetRef;
  context: StorefrontRenderContext;
}) {
  return (
    <section className={styles.imageText}>
      <div>
        <p className={styles.eyebrow}>{label("Product guide", "Tuoteopas", context)}</p>
        <h2>{text(heading, context)}</h2>
        <p>{text(body, context)}</p>
        <p className={styles.demoNote}>
          {label(
            "Delivery and returns information is placeholder presentation for this demo.",
            "Toimitus- ja palautustiedot ovat tämän demon paikkamerkkisisältöä.",
            context,
          )}
        </p>
      </div>
      <ProductImage asset={media} context={context} />
    </section>
  );
}

export function RelatedProducts({
  heading,
  productIds,
  context,
}: {
  heading: LocalizedText;
  productIds: string[];
  context: StorefrontRenderContext;
}) {
  const products = productIds.map((id) => productFor(id, context));
  return (
    <section aria-labelledby="related-products-heading" className={styles.related}>
      <h2 id="related-products-heading">{text(heading, context)}</h2>
      {products.length ? (
        <div className={styles.relatedGrid}>
          {products.map((product) => (
            <article key={product.id}>
              <ProductImage asset={product.images[0]} context={context} />
              <h3>{text(product.title, context)}</h3>
              <p>{price.format(product.price.amount)}</p>
              <p>
                {stockLabel(product.stockStatus, context)} ·{" "}
                {label("Display only", "Vain esitys", context)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>
          {label(
            "Related products will appear here when selected.",
            "Liittyvät tuotteet näkyvät tässä, kun ne on valittu.",
            context,
          )}
        </p>
      )}
    </section>
  );
}
