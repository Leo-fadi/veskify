import { z } from "zod";
import { resolveLocalizedText, localizedTextSchema } from "@/domain/shared";
import { defineComponent, type StorefrontRenderContext } from "./contract";
import type { CommerceUtilityActionId } from "@/domain/commerce-utility";
import { ResponsiveStorefrontImage } from "@/components/storefront/responsive-storefront-image";
import {
  resolveResponsiveExecutionAuthority,
  responsiveExecutionDataAttributes,
} from "@/components/storefront/responsive-execution";
import { adaptV1ComponentDefinitionToV2 } from "./v2-compatibility";
import styles from "@/components/storefront/commerce-utility.module.css";

const variants = [
  "cart",
  "checkoutBoundary",
  "noResults",
  "emptyState",
  "recoverableError",
  "notFound",
  "loading",
] as const;

const labels = (context: StorefrontRenderContext) =>
  context.activeLocale === "fi"
    ? {
        quantity: "Määrä",
        remove: "Poista",
        subtotal: "Välisumma",
        total: "Yhteensä",
        checkout: "Siirry kassalle",
        continueShopping: "Jatka ostoksia",
        clearSearch: "Tyhjennä haku",
        clearFilters: "Tyhjennä suodattimet",
        returnHome: "Palaa etusivulle",
        retry: "Yritä uudelleen",
        loading: "Ladataan",
        cart: "Ostoskori",
        decreaseQuantity: "Vähennä määrää",
        increaseQuantity: "Lisää määrää",
      }
    : {
        quantity: "Quantity",
        remove: "Remove",
        subtotal: "Subtotal",
        total: "Total",
        checkout: "Continue to checkout",
        continueShopping: "Continue shopping",
        clearSearch: "Clear search",
        clearFilters: "Clear filters",
        returnHome: "Return home",
        retry: "Try again",
        loading: "Loading",
        cart: "Cart",
        decreaseQuantity: "Decrease quantity",
        increaseQuantity: "Increase quantity",
      };

const text = (value: z.infer<typeof localizedTextSchema>, context: StorefrontRenderContext) =>
  resolveLocalizedText(value, context.activeLocale, context.primaryLocale);
const money = (amount: number, currency: "EUR", context: StorefrontRenderContext) =>
  new Intl.NumberFormat(context.activeLocale === "fi" ? "fi-FI" : "en-FI", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);

function utilityResponsiveAttributes(variant: (typeof variants)[number]) {
  const anatomy = currentCommerceUtilityDefinition.commercialAnatomy;
  if (!anatomy) throw new Error("Commerce utility requires registered responsive anatomy.");
  return responsiveExecutionDataAttributes(resolveResponsiveExecutionAuthority(anatomy, variant));
}

export const commerceUtilityContentSchema = z
  .object({
    heading: localizedTextSchema,
    body: localizedTextSchema,
  })
  .strict();
export const commerceUtilityPropsSchema = z
  .object({
    summaryPlacement: z.enum(["inline", "aside"]).default("aside"),
  })
  .strict();

function supports(context: StorefrontRenderContext, action: CommerceUtilityActionId) {
  return Boolean(
    context.commerceUtilityRuntime?.actions.includes(action) && context.onCommerceUtilityIntent,
  );
}

function UtilityAction({
  action,
  label,
  context,
  lineId,
  quantity,
  checkoutUrl,
  accessibleLabel,
  tone = "secondary",
}: Readonly<{
  action: CommerceUtilityActionId;
  label: string;
  context: StorefrontRenderContext;
  lineId?: string;
  quantity?: number;
  checkoutUrl?: string;
  accessibleLabel?: string;
  tone?: "primary" | "secondary" | "quiet";
}>) {
  const runtime = context.commerceUtilityRuntime;
  if (!runtime || !supports(context, action)) return null;
  return (
    <button
      aria-label={accessibleLabel}
      className={styles.action}
      data-action-tone={tone}
      data-utility-action={action}
      onClick={() =>
        context.onCommerceUtilityIntent?.({
          action,
          runtimeRevision: runtime.revision,
          lineId,
          quantity,
          checkoutUrl,
        })
      }
      type="button"
    >
      {label}
    </button>
  );
}

function ContinueShopping({ context }: { context: StorefrontRenderContext }) {
  return (
    <UtilityAction
      action="continue-shopping"
      context={context}
      label={labels(context).continueShopping}
      tone="primary"
    />
  );
}

function CartPresentation({
  context,
  placement,
  variant,
}: {
  context: StorefrontRenderContext;
  placement: "inline" | "aside";
  variant: "cart";
}) {
  const runtime = context.commerceUtilityRuntime;
  const copy = labels(context);
  if (!runtime || runtime.kind !== "cart") {
    return (
      <section
        {...utilityResponsiveAttributes(variant)}
        className={styles.state}
        data-utility-state="unavailable"
        role="status"
      >
        <h1>{copy.cart}</h1>
        <p>
          {context.activeLocale === "fi"
            ? "Ostoskorin tietoja ei ole saatavilla."
            : "Cart information is unavailable."}
        </p>
      </section>
    );
  }
  const productById = new Map(context.catalogue.products.map((product) => [product.id, product]));
  const resolvedLines = runtime.lines.flatMap((line) => {
    const product = productById.get(line.productId);
    return product ? [{ line, product }] : [];
  });
  if (resolvedLines.length !== runtime.lines.length) {
    return (
      <section
        {...utilityResponsiveAttributes(variant)}
        className={styles.state}
        data-utility-state="unavailable"
        role="status"
      >
        <h1>{copy.cart}</h1>
        <p>
          {context.activeLocale === "fi"
            ? "Ostoskorin tietoja ei ole saatavilla."
            : "Cart information is unavailable."}
        </p>
      </section>
    );
  }
  if (runtime.lines.length === 0) {
    return (
      <section
        {...utilityResponsiveAttributes(variant)}
        aria-atomic="true"
        aria-live="polite"
        className={styles.empty}
        data-utility-state="cart-empty"
      >
        <h1>{copy.cart}</h1>
        <p>{context.activeLocale === "fi" ? "Ostoskorisi on tyhjä." : "Your cart is empty."}</p>
        <ContinueShopping context={context} />
      </section>
    );
  }
  return (
    <section
      {...utilityResponsiveAttributes(variant)}
      className={styles.cart}
      data-utility-state="cart-populated"
      data-summary-placement={placement}
      aria-labelledby="utility-cart-heading"
    >
      <div className={styles.lines} data-cart-region="line-items">
        <h1 id="utility-cart-heading">{copy.cart}</h1>
        <ul>
          {resolvedLines.map(({ line, product }) => {
            const productImage = product.images[0];
            const productTitle = text(product.title, context);
            return (
              <li
                key={line.lineId}
                className={styles.line}
                data-cart-line-id={line.lineId}
                data-product-id={product.id}
              >
                {productImage ? (
                  <ResponsiveStorefrontImage
                    alt={text(productImage.alt ?? product.title, context)}
                    asset={productImage}
                    className={styles.lineMedia}
                    loadingRole="merchandising"
                  />
                ) : null}
                <div className={styles.lineIdentity}>
                  <h2>{productTitle}</h2>
                  {line.unitPrice ? (
                    <p className={styles.unitPrice}>
                      {money(line.unitPrice.amount, line.unitPrice.currency, context)}
                    </p>
                  ) : null}
                  {product.availabilityLabel ? (
                    <p className={styles.lineAvailability}>
                      {text(product.availabilityLabel, context)}
                    </p>
                  ) : null}
                </div>
                <div className={styles.lineActions}>
                  <span aria-atomic="true" aria-live="polite">
                    {copy.quantity}: {line.quantity}
                  </span>
                  {supports(context, "change-quantity") ? (
                    <div className={styles.quantityActions}>
                      {line.quantity > line.minimumQuantity ? (
                        <UtilityAction
                          action="change-quantity"
                          accessibleLabel={`${copy.decreaseQuantity}: ${productTitle}`}
                          label="−"
                          context={context}
                          lineId={line.lineId}
                          quantity={line.quantity - 1}
                          tone="quiet"
                        />
                      ) : null}
                      {line.maximumQuantity === undefined ||
                      line.quantity < line.maximumQuantity ? (
                        <UtilityAction
                          action="change-quantity"
                          accessibleLabel={`${copy.increaseQuantity}: ${productTitle}`}
                          label="+"
                          context={context}
                          lineId={line.lineId}
                          quantity={line.quantity + 1}
                          tone="quiet"
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <UtilityAction
                    action="remove-line"
                    accessibleLabel={`${copy.remove}: ${productTitle}`}
                    label={copy.remove}
                    context={context}
                    lineId={line.lineId}
                    tone="quiet"
                  />
                </div>
                {line.linePrice ? (
                  <p className={styles.linePrice}>
                    {money(line.linePrice.amount, line.linePrice.currency, context)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      <aside className={styles.summary} aria-label={copy.total} data-cart-region="summary">
        {runtime.subtotal ? (
          <p>
            <span>{copy.subtotal}</span>
            <strong>{money(runtime.subtotal.amount, runtime.subtotal.currency, context)}</strong>
          </p>
        ) : null}
        {runtime.total ? (
          <p>
            <span>{copy.total}</span>
            <strong>{money(runtime.total.amount, runtime.total.currency, context)}</strong>
          </p>
        ) : null}
        <UtilityAction
          action="continue-checkout"
          label={copy.checkout}
          context={context}
          tone="primary"
        />
        <UtilityAction
          action="continue-shopping"
          context={context}
          label={copy.continueShopping}
          tone={supports(context, "continue-checkout") ? "secondary" : "primary"}
        />
      </aside>
    </section>
  );
}

function StatePresentation({
  content,
  context,
  variant,
}: {
  content: z.infer<typeof commerceUtilityContentSchema>;
  context: StorefrontRenderContext;
  variant: Exclude<(typeof variants)[number], "cart"> | "cart";
}) {
  const runtime = context.commerceUtilityRuntime;
  if (!runtime) {
    return (
      <section
        {...utilityResponsiveAttributes(variant)}
        className={styles.state}
        data-utility-state="unavailable"
        role="status"
      >
        <h1>{text(content.heading, context)}</h1>
        <p>{text(content.body, context)}</p>
      </section>
    );
  }
  const copy = labels(context);
  const body =
    runtime.kind === "no-results"
      ? runtime.query
        ? `${text(content.body, context)} “${runtime.query}”`
        : text(content.body, context)
      : runtime.kind === "empty" || runtime.kind === "error" || runtime.kind === "loading"
        ? text(runtime.message, context)
        : runtime.kind === "checkout"
          ? text(runtime.boundaryLabel, context)
          : text(content.body, context);
  const isCheckout = runtime.kind === "checkout";
  return (
    <section
      {...utilityResponsiveAttributes(variant)}
      aria-atomic={runtime.kind === "error" || runtime.kind === "loading" ? "true" : undefined}
      aria-busy={runtime.kind === "loading" ? "true" : undefined}
      aria-live={
        runtime.kind === "error" ? "assertive" : runtime.kind === "loading" ? "polite" : undefined
      }
      className={styles.state}
      data-utility-state={runtime.kind}
      role={runtime.kind === "error" ? "alert" : runtime.kind === "loading" ? "status" : undefined}
    >
      <h1>{runtime.kind === "loading" ? copy.loading : text(content.heading, context)}</h1>
      <p>{body}</p>
      {runtime.kind === "no-results" && runtime.activeFilters.length ? (
        <p className={styles.filters}>
          {runtime.activeFilters.map((filter) => text(filter, context)).join(" · ")}
        </p>
      ) : null}
      <div className={styles.actions}>
        {isCheckout ? (
          <UtilityAction
            action="continue-checkout"
            label={copy.checkout}
            context={context}
            checkoutUrl={runtime.checkoutUrl}
          />
        ) : null}
        {runtime.kind === "no-results" ? (
          <>
            <UtilityAction action="clear-search" label={copy.clearSearch} context={context} />
            <UtilityAction action="clear-filters" label={copy.clearFilters} context={context} />
          </>
        ) : null}
        {runtime.kind === "error" && runtime.recoverable ? (
          <UtilityAction action="retry" label={copy.retry} context={context} />
        ) : null}
        {runtime.kind === "not-found" ? (
          <UtilityAction action="return-home" label={copy.returnHome} context={context} />
        ) : null}
        {runtime.kind !== "checkout" && runtime.kind !== "loading" ? (
          <ContinueShopping context={context} />
        ) : null}
      </div>
    </section>
  );
}

const runtimeKindByVariant = {
  cart: "cart",
  checkoutBoundary: "checkout",
  noResults: "no-results",
  emptyState: "empty",
  recoverableError: "error",
  notFound: "not-found",
  loading: "loading",
} as const;

export const commerceUtilityDefinition = defineComponent({
  type: "commerceUtility",
  label: "Commerce utility presentation",
  allowedPageTypes: ["cart", "checkout", "content"],
  variants,
  defaultVariant: "cart",
  contentSchema: commerceUtilityContentSchema,
  propsSchema: commerceUtilityPropsSchema,
  defaultContent: {
    heading: { en: "Storefront status", fi: "Kaupan tila" },
    body: { en: "Review the current storefront state.", fi: "Tarkista kaupan nykyinen tila." },
  },
  defaultProps: { summaryPlacement: "aside" },
  editorFields: {},
  protectedFields: { readOnlyPaths: ["*"] },
  validateContext: ({ variant, context }) => {
    if (
      context.commerceUtilityRuntime &&
      context.commerceUtilityRuntime.kind !== "loading" &&
      context.commerceUtilityRuntime.kind !== runtimeKindByVariant[variant]
    )
      throw new Error(`Commerce utility ${variant} requires matching canonical runtime state.`);
  },
  renderer: ({ content, props, context, variant }) =>
    variant === "cart" && context.commerceUtilityRuntime?.kind !== "loading" ? (
      <CartPresentation context={context} placement={props.summaryPlacement} variant={variant} />
    ) : (
      <StatePresentation content={content} context={context} variant={variant} />
    ),
});

const currentCommerceUtilityDefinition = adaptV1ComponentDefinitionToV2(commerceUtilityDefinition);
