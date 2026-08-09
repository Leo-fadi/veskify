import { z } from "zod";
import { productPriceSchema } from "@/domain/catalogue";
import { idSchema, localizedTextSchema, safeExternalUrlSchema } from "@/domain/shared";

/**
 * Read-only commerce/runtime data supplied by the active commerce adapter to a
 * utility renderer. It is intentionally transient: storefront configuration
 * selects a presentation profile, never a customer's cart or checkout state.
 */
export const commerceUtilityActionIdSchema = z.enum([
  "change-quantity",
  "remove-line",
  "continue-checkout",
  "continue-shopping",
  "clear-search",
  "clear-filters",
  "return-home",
  "retry",
]);
export type CommerceUtilityActionId = z.infer<typeof commerceUtilityActionIdSchema>;

const runtimeRevisionSchema = z.string().trim().min(1).max(160);
const cartLineSchema = z
  .object({
    lineId: idSchema,
    productId: idSchema,
    quantity: z.number().int().positive(),
    minimumQuantity: z.number().int().positive().default(1),
    maximumQuantity: z.number().int().positive().optional(),
    unitPrice: productPriceSchema.optional(),
    linePrice: productPriceSchema.optional(),
  })
  .strict()
  .superRefine((line, context) => {
    if (line.maximumQuantity !== undefined && line.maximumQuantity < line.minimumQuantity) {
      context.addIssue({
        code: "custom",
        path: ["maximumQuantity"],
        message: "The canonical cart quantity range is invalid.",
      });
    }
  });

const actionIdsSchema = z
  .array(commerceUtilityActionIdSchema)
  .max(8)
  .default([])
  .superRefine((actions, context) => {
    if (new Set(actions).size !== actions.length) {
      context.addIssue({ code: "custom", message: "Utility actions must be unique." });
    }
  });

export const commerceUtilityRuntimeStateSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("cart"),
      revision: runtimeRevisionSchema,
      lines: z.array(cartLineSchema),
      subtotal: productPriceSchema.optional(),
      total: productPriceSchema.optional(),
      actions: actionIdsSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("checkout"),
      revision: runtimeRevisionSchema,
      boundaryLabel: localizedTextSchema,
      checkoutUrl: safeExternalUrlSchema.optional(),
      actions: actionIdsSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("no-results"),
      revision: runtimeRevisionSchema,
      query: z.string().trim().max(200),
      activeFilters: z.array(localizedTextSchema).max(20).default([]),
      actions: actionIdsSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("empty"),
      revision: runtimeRevisionSchema,
      message: localizedTextSchema,
      actions: actionIdsSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("error"),
      revision: runtimeRevisionSchema,
      message: localizedTextSchema,
      recoverable: z.boolean(),
      actions: actionIdsSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("not-found"),
      revision: runtimeRevisionSchema,
      actions: actionIdsSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("loading"),
      revision: runtimeRevisionSchema,
      message: localizedTextSchema,
      actions: actionIdsSchema,
    })
    .strict(),
]);

export type CommerceUtilityRuntimeState = z.infer<typeof commerceUtilityRuntimeStateSchema>;

export type CommerceUtilityIntent = Readonly<{
  action: CommerceUtilityActionId;
  runtimeRevision: string;
  lineId?: string;
  quantity?: number;
  checkoutUrl?: string;
}>;

export function parseCommerceUtilityRuntimeState(input: unknown): CommerceUtilityRuntimeState {
  return commerceUtilityRuntimeStateSchema.parse(input);
}
