import { createComponentRegistryV2 } from "@/domain/component-platform";
import { dynamicProductDetailDefinition } from "./dynamic-product-detail";
import { dynamicCollectionCommerceDefinition } from "./dynamic-collection-commerce";
import {
  homepageCommerceDefinitions,
  homepageCommerceInstanceValidationContracts,
} from "./homepage-commerce";
import { veskifyComponentRegistry } from "./registry";
import { adaptV1ComponentRegistryToV2 } from "./v2-compatibility";

export const veskifyComponentDefinitionsV2 = [
  ...adaptV1ComponentRegistryToV2(
    Object.fromEntries(
      Object.entries(veskifyComponentRegistry).filter(
        ([type]) => type !== "dynamicCollectionCommerce" && type !== "dynamicProductDetail",
      ),
    ),
  ),
  dynamicCollectionCommerceDefinition,
  dynamicProductDetailDefinition,
  ...homepageCommerceDefinitions,
] as const;

export const veskifyComponentRegistryV2 = createComponentRegistryV2(
  veskifyComponentDefinitionsV2,
  homepageCommerceInstanceValidationContracts,
);
