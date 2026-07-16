import { z } from "zod";
import { CollectionHeader, FilterBar } from "@/components/storefront/collection-sections";
import { defineComponent } from "./contract";

export const jewelleryFilterTokenSchema = z.enum([
  "material",
  "metalColour",
  "price",
  "availability",
  "stoneShape",
]);

export const collectionHeaderContentSchema = z.object({ collectionId: z.string().min(3) }).strict();
export const collectionHeaderPropsSchema = z.object({ mediaPosition: z.literal("right") }).strict();

export const collectionHeaderDefinition = defineComponent({
  type: "collectionHeader",
  label: "Collection header",
  allowedPageTypes: ["collection"],
  variants: ["editorial"] as const,
  defaultVariant: "editorial",
  contentSchema: collectionHeaderContentSchema,
  propsSchema: collectionHeaderPropsSchema,
  defaultContent: { collectionId: "collection_rings" },
  defaultProps: { mediaPosition: "right" },
  editorFields: {},
  protectedFields: {
    readOnlyPaths: ["collectionId", "catalogue.collections", "catalogue.products.*.images"],
  },
  validateContext: ({ content, context }) => {
    if (
      !context.catalogue.collections.some((collection) => collection.id === content.collectionId)
    ) {
      throw new Error(`Unknown collection reference: ${content.collectionId}.`);
    }
  },
  renderer: ({ content, context }) => <CollectionHeader {...content} context={context} />,
});

export const filterBarContentSchema = z
  .object({ filters: z.array(jewelleryFilterTokenSchema).min(1).max(5) })
  .strict();
export const filterBarPropsSchema = z.object({ demoOnly: z.literal(true) }).strict();

export const filterBarDefinition = defineComponent({
  type: "filterBar",
  label: "Collection filters",
  allowedPageTypes: ["collection"],
  variants: ["horizontal"] as const,
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
  renderer: ({ content, context }) => <FilterBar {...content} context={context} />,
});

export const collectionDefinitions = {
  collectionHeader: collectionHeaderDefinition,
  filterBar: filterBarDefinition,
} as const;
