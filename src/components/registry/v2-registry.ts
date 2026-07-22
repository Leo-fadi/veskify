import { createComponentRegistryV2 } from "@/domain/component-platform";
import { dynamicProductDetailDefinition } from "./dynamic-product-detail";
import { dynamicCollectionCommerceDefinition } from "./dynamic-collection-commerce";
import { homepageCommerceDefinitions } from "./homepage-commerce";
import { veskifyComponentRegistry } from "./registry";
import { adaptV1ComponentRegistryToV2 } from "./v2-compatibility";

export const veskifyComponentDefinitionsV2 = [
  ...adaptV1ComponentRegistryToV2(veskifyComponentRegistry),
  dynamicCollectionCommerceDefinition,
  dynamicProductDetailDefinition,
  ...homepageCommerceDefinitions,
] as const;

export const veskifyComponentRegistryV2 = createComponentRegistryV2(veskifyComponentDefinitionsV2);
