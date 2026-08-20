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
        searchTerm: "Hakusana",
        activeFilters: "Aktiiviset suodattimet",
        notFoundCode: "Sivua ei löytynyt",
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
        searchTerm: "Search term",
        activeFilters: "Active filters",
        notFoundCode: "Page not found",
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

function ContinueShopping({
  context,
  tone = "primary",
}: {
  context: StorefrontRenderContext;
  tone?: "primary" | "secondary";
}) {
  return (
    <UtilityAction
      action="continue-shopping"
      context={context}
      label={labels(context).continueShopping}
      tone={tone}
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
        className={`${styles.state} ${styles.unavailable}`}
        data-utility-state="unavailable"
        role="status"
      >
        <div className={styles.stateIdentity} data-state-region="identity">
          <span className={styles.stateMarker} aria-hidden="true">
            —
          </span>
          <h1>{copy.cart}</h1>
        </div>
        <p data-state-region="explanation">
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
        className={`${styles.state} ${styles.unavailable}`}
        data-utility-state="unavailable"
        role="status"
      >
        <div className={styles.stateIdentity} data-state-region="identity">
          <span className={styles.stateMarker} aria-hidden="true">
            —
          </span>
          <h1>{copy.cart}</h1>
        </div>
        <p data-state-region="explanation">
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
        className={`${styles.empty} ${styles.cartEmpty}`}
        data-utility-state="cart-empty"
      >
        <div className={styles.stateIdentity} data-state-region="identity">
          <span className={styles.cartGlyph} aria-hidden="true">
            0
          </span>
          <h1>{copy.cart}</h1>
        </div>
        <p data-state-region="explanation">
          {context.activeLocale === "fi" ? "Ostoskorisi on tyhjä." : "Your cart is empty."}
        </p>
        <div className={styles.actions} data-state-region="actions">
          <ContinueShopping context={context} />
        </div>
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

function UtilityUnavailablePresentation({
  content,
  context,
  variant,
}: {
  content: z.infer<typeof commerceUtilityContentSchema>;
  context: StorefrontRenderContext;
  variant: (typeof variants)[number];
}) {
  const copy = labels(context);
  const heading =
    variant === "cart"
      ? copy.cart
      : variant === "checkoutBoundary"
        ? copy.checkout
        : text(content.heading, context);
  const body =
    variant === "cart"
      ? context.activeLocale === "fi"
        ? "Ostoskorin tietoja ei ole saatavilla."
        : "Cart information is unavailable."
      : variant === "checkoutBoundary"
        ? context.activeLocale === "fi"
          ? "Kassan tietoja ei ole saatavilla."
          : "Checkout information is unavailable."
        : text(content.body, context);
  return (
    <section
      {...utilityResponsiveAttributes(variant)}
      className={`${styles.state} ${styles.unavailable}`}
      data-utility-state="unavailable"
      role="status"
    >
      <div className={styles.stateIdentity} data-state-region="identity">
        <span className={styles.stateMarker} aria-hidden="true">
          —
        </span>
        <h1>{heading}</h1>
      </div>
      <p data-state-region="explanation">{body}</p>
    </section>
  );
}

function NoResultsPresentation({
  content,
  context,
  runtime,
}: {
  content: z.infer<typeof commerceUtilityContentSchema>;
  context: StorefrontRenderContext;
  runtime: {
    kind: "no-results";
    query: string;
    activeFilters: z.infer<typeof localizedTextSchema>[];
  };
}) {
  const copy = labels(context);
  const canClearSearch = Boolean(runtime.query && supports(context, "clear-search"));
  const canClearFilters = Boolean(
    runtime.activeFilters.length && supports(context, "clear-filters"),
  );
  const hasPrimaryRecovery = canClearSearch || canClearFilters;
  return (
    <section
      {...utilityResponsiveAttributes("noResults")}
      aria-live="polite"
      className={`${styles.state} ${styles.noResults}`}
      data-utility-state="no-results"
      role="status"
    >
      <header className={styles.noResultsIdentity} data-state-region="identity">
        <span className={styles.searchGlyph} aria-hidden="true">
          0
        </span>
        <div>
          <h1>{text(content.heading, context)}</h1>
          <p>{text(content.body, context)}</p>
        </div>
      </header>
      {runtime.query ? (
        <p className={styles.query} data-state-region="query">
          <span>{copy.searchTerm}</span>
          <strong>“{runtime.query}”</strong>
        </p>
      ) : null}
      {runtime.activeFilters.length ? (
        <div className={styles.filterRegion} data-state-region="filters">
          <span>{copy.activeFilters}</span>
          <ul className={styles.filters}>
            {runtime.activeFilters.map((filter, index) => (
              <li key={`${text(filter, context)}-${index}`}>{text(filter, context)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={styles.actions} data-state-region="actions">
        {canClearSearch ? (
          <UtilityAction
            action="clear-search"
            label={copy.clearSearch}
            context={context}
            tone="primary"
          />
        ) : null}
        {canClearFilters ? (
          <UtilityAction
            action="clear-filters"
            label={copy.clearFilters}
            context={context}
            tone={canClearSearch ? "secondary" : "primary"}
          />
        ) : null}
        <ContinueShopping context={context} tone={hasPrimaryRecovery ? "secondary" : "primary"} />
      </div>
    </section>
  );
}

function CheckoutBoundaryPresentation({
  content,
  context,
  runtime,
}: {
  content: z.infer<typeof commerceUtilityContentSchema>;
  context: StorefrontRenderContext;
  runtime: {
    kind: "checkout";
    boundaryLabel: z.infer<typeof localizedTextSchema>;
    checkoutUrl?: string;
  };
}) {
  const copy = labels(context);
  return (
    <section
      {...utilityResponsiveAttributes("checkoutBoundary")}
      className={`${styles.state} ${styles.checkout}`}
      data-utility-state="checkout"
    >
      <div className={styles.checkoutIdentity} data-state-region="identity">
        <span className={styles.checkoutStep} aria-hidden="true">
          01
        </span>
        <h1>{text(content.heading, context)}</h1>
      </div>
      <p data-state-region="boundary">{text(runtime.boundaryLabel, context)}</p>
      <div className={styles.actions} data-state-region="actions">
        <UtilityAction
          action="continue-checkout"
          label={copy.checkout}
          context={context}
          checkoutUrl={runtime.checkoutUrl}
          tone="primary"
        />
        <ContinueShopping context={context} tone="secondary" />
      </div>
    </section>
  );
}

function EmptyStatePresentation({
  content,
  context,
  runtime,
}: {
  content: z.infer<typeof commerceUtilityContentSchema>;
  context: StorefrontRenderContext;
  runtime: {
    kind: "empty";
    message: z.infer<typeof localizedTextSchema>;
  };
}) {
  return (
    <section
      {...utilityResponsiveAttributes("emptyState")}
      className={`${styles.state} ${styles.emptyState}`}
      data-utility-state="empty"
    >
      <div className={styles.emptyIdentity} data-state-region="identity">
        <span className={styles.emptyGlyph} aria-hidden="true">
          ○
        </span>
        <h1>{text(content.heading, context)}</h1>
      </div>
      <p data-state-region="explanation">{text(runtime.message, context)}</p>
      <div className={styles.actions} data-state-region="actions">
        <UtilityAction
          action="continue-shopping"
          context={context}
          label={labels(context).continueShopping}
          tone="primary"
        />
      </div>
    </section>
  );
}

function RecoverableErrorPresentation({
  content,
  context,
  runtime,
}: {
  content: z.infer<typeof commerceUtilityContentSchema>;
  context: StorefrontRenderContext;
  runtime: {
    kind: "error";
    message: z.infer<typeof localizedTextSchema>;
    recoverable: boolean;
  };
}) {
  const copy = labels(context);
  const hasRetry = runtime.recoverable && supports(context, "retry");
  return (
    <section
      {...utilityResponsiveAttributes("recoverableError")}
      aria-atomic="true"
      className={`${styles.state} ${styles.recoverableError}`}
      data-utility-state="error"
      role="alert"
      aria-live="assertive"
    >
      <div className={styles.errorIdentity} data-state-region="identity">
        <span className={styles.errorGlyph} aria-hidden="true">
          !
        </span>
        <h1>{text(content.heading, context)}</h1>
      </div>
      <p data-state-region="explanation">{text(runtime.message, context)}</p>
      <div className={styles.actions} data-state-region="actions">
        {hasRetry ? (
          <UtilityAction action="retry" label={copy.retry} context={context} tone="primary" />
        ) : null}
        <ContinueShopping context={context} tone={hasRetry ? "secondary" : "primary"} />
      </div>
    </section>
  );
}

function NotFoundPresentation({
  content,
  context,
}: {
  content: z.infer<typeof commerceUtilityContentSchema>;
  context: StorefrontRenderContext;
}) {
  const copy = labels(context);
  return (
    <section
      {...utilityResponsiveAttributes("notFound")}
      className={`${styles.state} ${styles.notFound}`}
      data-utility-state="not-found"
    >
      <div className={styles.notFoundIdentity} data-state-region="identity">
        <span className={styles.notFoundCode} aria-label={copy.notFoundCode}>
          404
        </span>
        <h1>{text(content.heading, context)}</h1>
      </div>
      <p data-state-region="explanation">{text(content.body, context)}</p>
      <div className={styles.actions} data-state-region="actions">
        <UtilityAction
          action="return-home"
          label={copy.returnHome}
          context={context}
          tone="primary"
        />
      </div>
    </section>
  );
}

function LoadingPresentation({
  context,
  runtime,
}: {
  context: StorefrontRenderContext;
  runtime: {
    kind: "loading";
    message: z.infer<typeof localizedTextSchema>;
  };
}) {
  const copy = labels(context);
  return (
    <section
      {...utilityResponsiveAttributes("loading")}
      aria-atomic="true"
      aria-busy="true"
      aria-live="polite"
      className={`${styles.state} ${styles.loading}`}
      data-utility-state="loading"
      role="status"
    >
      <div className={styles.loadingIdentity} data-state-region="identity">
        <span className={styles.loadingIndicator} aria-hidden="true" />
        <h1>{copy.loading}</h1>
      </div>
      <p data-state-region="explanation">{text(runtime.message, context)}</p>
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
    ) : context.commerceUtilityRuntime?.kind === "loading" ? (
      <LoadingPresentation context={context} runtime={context.commerceUtilityRuntime} />
    ) : context.commerceUtilityRuntime?.kind === "checkout" ? (
      <CheckoutBoundaryPresentation
        content={content}
        context={context}
        runtime={context.commerceUtilityRuntime}
      />
    ) : context.commerceUtilityRuntime?.kind === "no-results" ? (
      <NoResultsPresentation
        content={content}
        context={context}
        runtime={context.commerceUtilityRuntime}
      />
    ) : context.commerceUtilityRuntime?.kind === "empty" ? (
      <EmptyStatePresentation
        content={content}
        context={context}
        runtime={context.commerceUtilityRuntime}
      />
    ) : context.commerceUtilityRuntime?.kind === "error" ? (
      <RecoverableErrorPresentation
        content={content}
        context={context}
        runtime={context.commerceUtilityRuntime}
      />
    ) : context.commerceUtilityRuntime?.kind === "not-found" ? (
      <NotFoundPresentation content={content} context={context} />
    ) : (
      <UtilityUnavailablePresentation content={content} context={context} variant={variant} />
    ),
});

const currentCommerceUtilityDefinition = adaptV1ComponentDefinitionToV2(commerceUtilityDefinition);
