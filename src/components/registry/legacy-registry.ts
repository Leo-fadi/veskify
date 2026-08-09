import { aurumHeroDefinition } from "./aurum-hero";
import { collectionDefinitions } from "./collection";
import type { ComponentDefinition } from "./contract";
import { dynamicCommerceBridgeDefinitions } from "./dynamic-commerce-bridge";
import { homepageDefinitions } from "./homepage";
import { productDefinitions } from "./product";
import { commerceUtilityDefinition } from "./commerce-utility";

/** The V1 definitions that can be adapted without importing V2 bridge renderers. */
export const veskifyLegacyComponentRegistry = {
  ...homepageDefinitions,
  ...collectionDefinitions,
  ...productDefinitions,
  ...dynamicCommerceBridgeDefinitions,
  commerceUtility: commerceUtilityDefinition,
  hero: aurumHeroDefinition,
} as const satisfies Record<string, ComponentDefinition>;
