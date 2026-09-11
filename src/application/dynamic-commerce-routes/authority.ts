export { validateCurrentDynamicCommercePresentationAuthority } from "./current-authority";
export {
  dynamicCommerceRouteSectionId,
  type DynamicCommerceSearchRuntimeBinding,
} from "./route-projection";
export {
  type ResolvedDynamicCommerceRoutePage,
  type DynamicCommerceRuntimeBindingPolicy,
  resolveDynamicCommerceRuntimeBindingPolicy,
  resolveDynamicCommerceRoutePage,
  dynamicCommerceRouteForProduct,
  dynamicCommerceRouteForCollection,
} from "./route-resolution";

export {
  DynamicCommerceMigrationError,
  type DynamicCommerceMigrationDecision,
  type DynamicCommerceMigrationResult,
} from "./migration-contract";
export {
  dynamicCommerceRouteAuthorityErrorCodes,
  DynamicCommerceRouteAuthorityError,
  type DynamicCommerceRouteAuthorityErrorCode,
} from "./route-errors";
export {
  resolveCollectionContextArchetype,
  resolveProductComplexityArchetype,
  type DynamicCommerceCollectionMatchContext,
} from "./route-selection";
export {
  createDynamicCommerceProductMatchContext,
  type DynamicCommerceProductMatchContext,
} from "./product-match-context";

export {
  dynamicCommerceDesignSelectionSchema,
  DynamicCommerceDesignSelectionError,
  type DynamicCommerceDesignSelection,
  type DynamicCommerceDesignSelectionErrorCode,
} from "./design-selection-contract";
export {
  validateDynamicCommerceDesignSelection,
  materializeDynamicCommerceDesignSelectionFromAuthority,
  materializeDynamicCommerceDesignSelectionAuthority,
  applyDynamicCommerceDesignSelection,
} from "./design-selection";
export {
  type DynamicCommerceEditorProjection,
  projectDynamicCommerceArchetypePages,
  applyDynamicCommerceArchetypePage,
} from "./editor-projection";
export { registeredDynamicCommerceCollectionArchetypeId } from "./archetype-presentation";
export {
  migrateLegacyDynamicCommerceRoutes,
  requireMigratedDynamicCommerceSnapshot,
  materializeCurrentDynamicCommercePresentationAuthority,
} from "./legacy-migration";
export { expandDynamicCommerceRoutePages } from "./legacy-route-projection";
