import { z } from "zod";
import type { defineComponent } from "./contract";

export const jewelleryFilterTokenSchema = z.enum([
  "material",
  "metalColour",
  "price",
  "availability",
  "stoneShape",
]);
export const collectionHeaderContentSchema = z.object({ collectionId: z.string().min(3) }).strict();
export const collectionHeaderPropsSchema = z.object({ mediaPosition: z.literal("right") }).strict();
export const filterBarContentSchema = z
  .object({ filters: z.array(jewelleryFilterTokenSchema).min(1).max(5) })
  .strict();
export const filterBarPropsSchema = z.object({ demoOnly: z.literal(true) }).strict();

type MetadataInput<
  TContent extends z.ZodType,
  TProps extends z.ZodType,
  TVariants extends readonly [string, ...string[]],
> = Omit<
  Parameters<typeof defineComponent<TContent, TProps, TVariants>>[0],
  "renderer" | "validateContext"
>;

export const collectionHeaderMetadata = {
  type: "collectionHeader",
  label: "Collection header",
  allowedPageTypes: ["collection"],
  variants: ["editorial"],
  defaultVariant: "editorial",
  contentSchema: collectionHeaderContentSchema,
  propsSchema: collectionHeaderPropsSchema,
  defaultContent: { collectionId: "collection_rings" },
  defaultProps: { mediaPosition: "right" },
  editorFields: {},
  protectedFields: {
    readOnlyPaths: ["collectionId", "catalogue.collections", "catalogue.products.*.images"],
  },
} as const satisfies MetadataInput<
  typeof collectionHeaderContentSchema,
  typeof collectionHeaderPropsSchema,
  readonly ["editorial"]
>;

export const filterBarMetadata = {
  type: "filterBar",
  label: "Collection filters",
  allowedPageTypes: ["collection"],
  variants: ["horizontal"],
  defaultVariant: "horizontal",
  contentSchema: filterBarContentSchema,
  propsSchema: filterBarPropsSchema,
  defaultContent: { filters: ["material", "metalColour", "price", "availability", "stoneShape"] },
  defaultProps: { demoOnly: true },
  editorFields: {},
  protectedFields: {
    readOnlyPaths: [
      "filters",
      "demoOnly",
      "catalogue.products.*.price",
      "catalogue.products.*.stockStatus",
    ],
  },
} as const satisfies MetadataInput<
  typeof filterBarContentSchema,
  typeof filterBarPropsSchema,
  readonly ["horizontal"]
>;

/** Ordered metadata group for the later V2 adapter consumer. */
export const collectionMetadataDefinitions = {
  collectionHeader: collectionHeaderMetadata,
  filterBar: filterBarMetadata,
} as const;
