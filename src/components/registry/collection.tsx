import { CollectionHeader, FilterBar } from "@/components/storefront/collection-sections";
import { defineComponent } from "./contract";
import {
  collectionHeaderContentSchema,
  collectionHeaderMetadata,
  collectionHeaderPropsSchema,
  filterBarContentSchema,
  filterBarMetadata,
  filterBarPropsSchema,
  jewelleryFilterTokenSchema,
} from "./collection-metadata";

export {
  collectionHeaderContentSchema,
  collectionHeaderPropsSchema,
  filterBarContentSchema,
  filterBarPropsSchema,
  jewelleryFilterTokenSchema,
};

export const collectionHeaderDefinition = defineComponent({
  ...collectionHeaderMetadata,
  validateContext: ({ content, context }) => {
    if (
      !context.catalogue.collections.some((collection) => collection.id === content.collectionId)
    ) {
      throw new Error(`Unknown collection reference: ${content.collectionId}.`);
    }
  },
  renderer: ({ content, context }) => <CollectionHeader {...content} context={context} />,
});

export const filterBarDefinition = defineComponent({
  ...filterBarMetadata,
  renderer: ({ content, context }) => <FilterBar {...content} context={context} />,
});

export const collectionDefinitions = {
  collectionHeader: collectionHeaderDefinition,
  filterBar: filterBarDefinition,
} as const;
