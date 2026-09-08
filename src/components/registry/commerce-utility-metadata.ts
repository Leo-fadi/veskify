import { z } from "zod";
import { localizedTextSchema } from "@/domain/shared/schemas";
import type { defineComponent } from "./contract";

const variants = [
  "cart",
  "checkoutBoundary",
  "noResults",
  "emptyState",
  "recoverableError",
  "notFound",
  "loading",
] as const;

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

type CommerceUtilityMetadataInput = Omit<
  Parameters<
    typeof defineComponent<
      typeof commerceUtilityContentSchema,
      typeof commerceUtilityPropsSchema,
      typeof variants
    >
  >[0],
  "renderer" | "validateContext"
>;

/** The utility family's renderer-free declarative input. */
export const commerceUtilityMetadata = {
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
} as const satisfies CommerceUtilityMetadataInput;
