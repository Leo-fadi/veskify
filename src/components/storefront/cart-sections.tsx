import { resolveLocalizedText, type LocalizedText } from "@/domain/shared";
import type { StorefrontRenderContext } from "@/components/registry/contract";
import { StorefrontImage } from "./homepage-sections";
import styles from "./cart-sections.module.css";

type CartLineItem = { productId: string; quantity: number };

const text = (value: LocalizedText, context: StorefrontRenderContext) =>
  resolveLocalizedText(value, context.activeLocale, context.primaryLocale);

const formatPrice = (amount: number, locale: StorefrontRenderContext["activeLocale"]) =>
  new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-FI", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);

export function CartPage({
  heading,
  lineItems,
  quantityLabel,
  removeLabel,
  summaryHeading,
  subtotalLabel,
  totalLabel,
  checkoutLabel,
  demoNotice,
  emptyHeading,
  emptyBody,
  showQuantityControls,
  showRemoveControls,
  demoOnly,
  sectionId,
  variant,
  context,
}: {
  heading: LocalizedText;
  lineItems: CartLineItem[];
  quantityLabel: LocalizedText;
  removeLabel: LocalizedText;
  summaryHeading: LocalizedText;
  subtotalLabel: LocalizedText;
  totalLabel: LocalizedText;
  checkoutLabel: LocalizedText;
  demoNotice: LocalizedText;
  emptyHeading: LocalizedText;
  emptyBody: LocalizedText;
  showQuantityControls: boolean;
  showRemoveControls: boolean;
  demoOnly: true;
  sectionId: string;
  variant: "split";
  context: StorefrontRenderContext;
}) {
  const resolvedItems = lineItems.flatMap((lineItem) => {
    const product = context.catalogue.products.find((item) => item.id === lineItem.productId);
    return product ? [{ ...lineItem, product }] : [];
  });
  const subtotal = resolvedItems.reduce(
    (sum, item) => sum + item.product.price.amount * item.quantity,
    0,
  );
  const headingId = `${sectionId}-heading`;
  const noticeId = `${sectionId}-demo-notice`;

  return (
    <section
      aria-labelledby={headingId}
      className={`${styles.cartPage} ${styles[variant]}`}
      data-demo-only={demoOnly}
    >
      <h1 id={headingId}>{text(heading, context)}</h1>
      {resolvedItems.length === 0 ? (
        <div className={styles.empty}>
          <h2>{text(emptyHeading, context)}</h2>
          <p>{text(emptyBody, context)}</p>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.items}>
            {resolvedItems.map(({ product, quantity }) => {
              const productTitle = text(product.title, context);
              return (
                <article className={styles.lineItem} key={product.id}>
                  <StorefrontImage
                    asset={product.images[0]}
                    className={styles.productImage}
                    context={context}
                  />
                  <div className={styles.itemDetails}>
                    <h2>{productTitle}</h2>
                    <p className={styles.price} data-read-only-price="true">
                      {formatPrice(product.price.amount, context.activeLocale)}
                    </p>
                    <div className={styles.controls}>
                      {showQuantityControls ? (
                        <div
                          aria-label={`${text(quantityLabel, context)}: ${productTitle}`}
                          className={styles.quantity}
                          role="group"
                        >
                          <button
                            aria-describedby={noticeId}
                            aria-label={`${text({ en: "Decrease", fi: "Vähennä" }, context)}: ${productTitle}`}
                            type="button"
                          >
                            −
                          </button>
                          <output aria-live="off">{quantity}</output>
                          <button
                            aria-describedby={noticeId}
                            aria-label={`${text({ en: "Increase", fi: "Lisää" }, context)}: ${productTitle}`}
                            type="button"
                          >
                            +
                          </button>
                        </div>
                      ) : null}
                      {showRemoveControls ? (
                        <button aria-describedby={noticeId} className={styles.remove} type="button">
                          {text(removeLabel, context)} {productTitle}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className={styles.lineTotal} data-read-only-price="true">
                    {formatPrice(product.price.amount * quantity, context.activeLocale)}
                  </p>
                </article>
              );
            })}
          </div>
          <aside className={styles.summary}>
            <h2>{text(summaryHeading, context)}</h2>
            <dl>
              <div>
                <dt>{text(subtotalLabel, context)}</dt>
                <dd data-read-only-price="true">{formatPrice(subtotal, context.activeLocale)}</dd>
              </div>
              <div className={styles.total}>
                <dt>{text(totalLabel, context)}</dt>
                <dd data-read-only-price="true">{formatPrice(subtotal, context.activeLocale)}</dd>
              </div>
            </dl>
            <button aria-describedby={noticeId} className={styles.checkout} type="button">
              {text(checkoutLabel, context)}
            </button>
            <p className={styles.notice} id={noticeId}>
              {text(demoNotice, context)}
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
