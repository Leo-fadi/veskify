import type { ComponentDefinition } from "./contract";
import { homepageMetadataDefinitions } from "./homepage-metadata";
import { collectionMetadataDefinitions } from "./collection-metadata";
import { productMetadataDefinitions } from "./product-metadata";
import { commerceUtilityMetadata } from "./commerce-utility-metadata";
import { aurumHeroMetadata } from "./aurum-hero-metadata";
import {
  dynamicCommerceBridgeDescriptions,
  homepageCommerceBridgeDescriptions,
  contentSupportBridgeDescription,
} from "./component-description-sources";

export type ComponentDescription = Readonly<
  Pick<ComponentDefinition, "type" | "label" | "variants" | "editorFields" | "protectedFields">
>;

const sources = {
  ...homepageMetadataDefinitions,
  ...collectionMetadataDefinitions,
  ...productMetadataDefinitions,
  ...dynamicCommerceBridgeDescriptions,
  commerceUtility: commerceUtilityMetadata,
  hero: aurumHeroMetadata,
  ...homepageCommerceBridgeDescriptions,
  contentSupport: contentSupportBridgeDescription,
};
const descriptions: Readonly<Record<string, ComponentDescription>> = Object.fromEntries(
  Object.entries(sources).map(([key, definition]) => [
    key,
    {
      type: definition.type,
      label: definition.label,
      variants: definition.variants,
      editorFields: definition.editorFields,
      protectedFields: definition.protectedFields,
    },
  ]),
);

/** Existing descriptive authority only; validation and rendering remain at their runtime owners. */
export function getComponentDescription(component: string): ComponentDescription {
  if (!Object.hasOwn(descriptions, component))
    throw new Error(`Unknown storefront component: ${component}.`);
  return descriptions[component];
}
