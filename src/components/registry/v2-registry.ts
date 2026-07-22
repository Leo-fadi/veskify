import { createComponentRegistryV2 } from "@/domain/component-platform";
import { dynamicProductDetailDefinition } from "./dynamic-product-detail";
import { veskifyComponentRegistry } from "./registry";
import { adaptV1ComponentRegistryToV2 } from "./v2-compatibility";

export const veskifyComponentDefinitionsV2 = [
  ...adaptV1ComponentRegistryToV2(veskifyComponentRegistry),
  dynamicProductDetailDefinition,
] as const;

export const veskifyComponentRegistryV2 = createComponentRegistryV2(veskifyComponentDefinitionsV2);
