import { z } from "zod";
import { idSchema, localizedTextSchema } from "@/domain/shared";
import { CartPage } from "@/components/storefront/cart-sections";
import { defineComponent } from "./contract";

export const cartLineItemSchema = z
  .object({
    productId: idSchema,
    quantity: z.number().int().min(1).max(10),
  })
  .strict();

export const cartPageContentSchema = z
  .object({
    heading: localizedTextSchema,
    lineItems: z
      .array(cartLineItemSchema)
      .max(20)
      .superRefine((items, context) => {
        const productIds = items.map((item) => item.productId);
        if (new Set(productIds).size !== productIds.length) {
          context.addIssue({ code: "custom", message: "Cart product references must be unique." });
        }
      }),
    quantityLabel: localizedTextSchema,
    removeLabel: localizedTextSchema,
    summaryHeading: localizedTextSchema,
    subtotalLabel: localizedTextSchema,
    totalLabel: localizedTextSchema,
    checkoutLabel: localizedTextSchema,
    demoNotice: localizedTextSchema,
    emptyHeading: localizedTextSchema,
    emptyBody: localizedTextSchema,
  })
  .strict();

export const cartPagePropsSchema = z
  .object({
    showQuantityControls: z.boolean(),
    showRemoveControls: z.boolean(),
    demoOnly: z.literal(true),
  })
  .strict();

export const cartPageDefinition = defineComponent({
  type: "cartPage",
  label: "Cart page",
  allowedPageTypes: ["cart"],
  variants: ["split"] as const,
  defaultVariant: "split",
  contentSchema: cartPageContentSchema,
  propsSchema: cartPagePropsSchema,
  defaultContent: {
    heading: { en: "Your cart", fi: "Ostoskorisi" },
    lineItems: [
      { productId: "product_aurora_ring_585", quantity: 1 },
      { productId: "product_lumi_halo_ring", quantity: 2 },
    ],
    quantityLabel: { en: "Quantity", fi: "Määrä" },
    removeLabel: { en: "Remove", fi: "Poista" },
    summaryHeading: { en: "Order summary", fi: "Tilauksen yhteenveto" },
    subtotalLabel: { en: "Subtotal", fi: "Välisumma" },
    totalLabel: { en: "Total", fi: "Yhteensä" },
    checkoutLabel: { en: "Continue to checkout", fi: "Jatka kassalle" },
    demoNotice: {
      en: "Design preview only. Cart controls and checkout are not active.",
      fi: "Vain ulkoasun esikatselu. Ostoskorin toiminnot ja kassa eivät ole käytössä.",
    },
    emptyHeading: { en: "Your cart is empty", fi: "Ostoskorisi on tyhjä" },
    emptyBody: {
      en: "Products selected for this design will appear here.",
      fi: "Tähän ulkoasuun valitut tuotteet näkyvät täällä.",
    },
  },
  defaultProps: {
    showQuantityControls: true,
    showRemoveControls: true,
    demoOnly: true,
  },
  editorFields: {
    heading: { source: "content", control: "text", label: "Heading", localized: true },
  },
  protectedFields: {
    readOnlyPaths: [
      "lineItems",
      "demoOnly",
      "catalogue.products.*.price",
      "catalogue.products.*.stockStatus",
    ],
  },
  validateContext: ({ content, context }) => {
    const knownProducts = new Set(context.catalogue.products.map((product) => product.id));
    content.lineItems.forEach(({ productId }) => {
      if (!knownProducts.has(productId))
        throw new Error(`Unknown product reference: ${productId}.`);
    });
  },
  renderer: ({ sectionId, variant, content, props, context }) => (
    <CartPage {...content} {...props} context={context} sectionId={sectionId} variant={variant} />
  ),
});
