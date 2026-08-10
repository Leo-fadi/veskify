import { createComponentRegistryV2 } from "@/domain/component-platform";
import {
  dynamicProductDetailDefinition,
  dynamicProductDetailInstanceValidationContracts,
} from "./dynamic-product-detail";
import { dynamicCollectionCommerceDefinition } from "./dynamic-collection-commerce";
import {
  homepageCommerceDefinitions,
  homepageCommerceInstanceValidationContracts,
} from "./homepage-commerce";
import {
  contentSupportDefinition,
  contentSupportInstanceValidationContracts,
} from "./content-support";
import { veskifyLegacyComponentRegistry } from "./legacy-registry";
import { adaptV1ComponentRegistryToV2 } from "./v2-compatibility";

export const veskifyComponentDefinitionsV2 = [
  ...adaptV1ComponentRegistryToV2(
    Object.fromEntries(
      Object.entries(veskifyLegacyComponentRegistry).filter(
        ([type]) =>
          type !== "dynamicCollectionCommerce" &&
          type !== "dynamicProductDetail" &&
          !homepageCommerceDefinitions.some((definition) => definition.type === type),
      ),
    ),
  ),
  dynamicCollectionCommerceDefinition,
  dynamicProductDetailDefinition,
  ...homepageCommerceDefinitions,
  contentSupportDefinition,
] as const;

export const veskifyComponentRegistryV2 = createComponentRegistryV2(veskifyComponentDefinitionsV2, {
  ...dynamicProductDetailInstanceValidationContracts,
  ...homepageCommerceInstanceValidationContracts,
  ...contentSupportInstanceValidationContracts,
});
