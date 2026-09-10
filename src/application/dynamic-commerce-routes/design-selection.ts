import { GENERIC_PDP_ARCHETYPE_ID } from "./archetype-presentation";
import {
  assertCurrentArchetype,
  validateCurrentDynamicCommercePresentationAuthority,
} from "./current-authority";
import {
  dynamicCommerceDesignSelectionSchema,
  DynamicCommerceDesignSelectionError,
  type DynamicCommerceDesignSelection,
} from "./design-selection-contract";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
  dynamicCommercePresentationAuthoritySchema,
  storefrontSnapshotSchema,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommercePresentationAuthority,
  type DynamicCommerceProductComplexityRule,
  type DynamicCommerceProductDetailArchetype,
  type StorefrontSnapshot,
} from "@/domain/storefront";

type ValidatedDynamicCommerceDesignSelection = Readonly<{
  snapshot: StorefrontSnapshot;
  selection: DynamicCommerceDesignSelection;
  authority: DynamicCommercePresentationAuthority;
  collectionArchetype: DynamicCommerceCollectionSearchArchetype;
  searchArchetype: DynamicCommerceCollectionSearchArchetype;
  productTypeMappings: readonly Readonly<{ productTypeId: string; archetypeId: string }>[];
}>;

function selectedPdpRoleArchetypes(
  authority: DynamicCommercePresentationAuthority,
  selection: DynamicCommerceDesignSelection,
): readonly DynamicCommerceProductDetailArchetype[] {
  const knownRoleIds = [
    selection.standardSimpleArchetypeId,
    selection.configurableArchetypeId,
    selection.galleryLedArchetypeId,
    selection.highConsiderationArchetypeId,
  ];
  const selected = knownRoleIds.map((archetypeId) =>
    authority.productDetailArchetypes.find(({ id }) => id === archetypeId),
  );
  if (
    selected.some((archetype) => !archetype) ||
    knownRoleIds.some((archetypeId) => archetypeId === authority.fallbacks.productDetailArchetypeId)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "Each known PDP intent role must select an exact current non-fallback archetype.",
    );
  }
  if (
    selection.genericFallbackArchetypeId !== authority.fallbacks.productDetailArchetypeId ||
    selection.genericFallbackArchetypeId !== GENERIC_PDP_ARCHETYPE_ID ||
    !authority.productDetailArchetypes.some(({ id }) => id === selection.genericFallbackArchetypeId)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "Unknown product types require the exact registered generic PDP fallback.",
    );
  }
  return selected as readonly DynamicCommerceProductDetailArchetype[];
}

const PDP_ROLE_SELECTION_BY_COMPLEXITY_RULE_ID = {
  product_rule_considered: "highConsiderationArchetypeId",
  product_rule_options: "highConsiderationArchetypeId",
  product_rule_configurable: "configurableArchetypeId",
  product_rule_gallery: "galleryLedArchetypeId",
  product_rule_simple: "standardSimpleArchetypeId",
} as const satisfies Readonly<
  Record<
    string,
    | "standardSimpleArchetypeId"
    | "configurableArchetypeId"
    | "galleryLedArchetypeId"
    | "highConsiderationArchetypeId"
  >
>;

function materializeSelectedPdpComplexityRules(
  authority: DynamicCommercePresentationAuthority,
  selection: DynamicCommerceDesignSelection,
): DynamicCommerceProductComplexityRule[] {
  const expectedRuleIds = Object.keys(PDP_ROLE_SELECTION_BY_COMPLEXITY_RULE_ID);
  const currentRuleIds = authority.productComplexityRules.map(({ id }) => id);
  if (
    currentRuleIds.length !== expectedRuleIds.length ||
    expectedRuleIds.some((ruleId) => !currentRuleIds.includes(ruleId))
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-authority",
      "Dynamic-commerce PDP role selection requires the exact current product-complexity rule authority.",
    );
  }
  return authority.productComplexityRules.map((rule) => {
    const selectionKey =
      PDP_ROLE_SELECTION_BY_COMPLEXITY_RULE_ID[
        rule.id as keyof typeof PDP_ROLE_SELECTION_BY_COMPLEXITY_RULE_ID
      ];
    if (!selectionKey) {
      throw new DynamicCommerceDesignSelectionError(
        "stale-authority",
        "Dynamic-commerce PDP role selection encountered an unknown product-complexity rule.",
      );
    }
    return { ...structuredClone(rule), archetypeId: selection[selectionKey] };
  });
}

function validatedDynamicCommerceDesignSelection(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
  selectionInput: DynamicCommerceDesignSelection,
  authorityInput?: DynamicCommercePresentationAuthority,
): ValidatedDynamicCommerceDesignSelection {
  const parsedSelection = dynamicCommerceDesignSelectionSchema.safeParse(selectionInput);
  if (!parsedSelection.success) {
    throw new DynamicCommerceDesignSelectionError(
      "invalid-selection",
      "Dynamic-commerce design selection does not satisfy its strict contract.",
      { cause: parsedSelection.error },
    );
  }
  const selection = parsedSelection.data;
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const catalogue = catalogueDisplayModelSchema.parse(structuredClone(catalogueInput));
  if (snapshot.catalogueRef !== catalogue.id) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-product-type-authority",
      "Dynamic-commerce selection does not target the snapshot's current catalogue.",
    );
  }
  if (!snapshot.dynamicCommercePresentation && !authorityInput) {
    throw new DynamicCommerceDesignSelectionError(
      "missing-authority",
      "Dynamic-commerce selection requires canonical migrated presentation authority.",
    );
  }
  const authority = dynamicCommercePresentationAuthoritySchema.parse(
    structuredClone(authorityInput ?? snapshot.dynamicCommercePresentation),
  );
  if (selection.authorityFingerprint !== authority.authorityFingerprint) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-authority",
      "Dynamic-commerce selection does not target the exact current presentation authority.",
    );
  }
  const currentProductIds = new Set(catalogue.products.map(({ id }) => id));
  const currentCollectionIds = new Set(catalogue.collections.map(({ id }) => id));
  const staleRoute = authority.routeInventory.find((route) => {
    if (route.kind === "collection") return !currentCollectionIds.has(route.collectionId);
    if (route.kind !== "product") return false;
    return (
      !currentProductIds.has(route.productId) ||
      (route.relatedProductIds ?? []).some((productId) => !currentProductIds.has(productId))
    );
  });
  if (staleRoute) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-commerce-authority",
      "Dynamic-commerce route inventory does not resolve through the supplied canonical catalogue.",
    );
  }
  const collectionArchetype = authority.collectionSearchArchetypes.find(
    ({ id }) => id === selection.collectionArchetypeId,
  );
  if (!collectionArchetype) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "The selected collection archetype is absent from current authority.",
    );
  }
  if (!collectionArchetype.supportedContexts.includes("collection")) {
    throw new DynamicCommerceDesignSelectionError(
      "incompatible-context",
      "The selected collection archetype is not collection-compatible.",
    );
  }
  const searchArchetype = authority.collectionSearchArchetypes.find(
    ({ id }) => id === selection.searchArchetypeId,
  );
  if (!searchArchetype) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "The selected search archetype is absent from current authority.",
    );
  }
  if (!searchArchetype.supportedContexts.includes("search")) {
    throw new DynamicCommerceDesignSelectionError(
      "incompatible-context",
      "The selected search archetype is not search-compatible.",
    );
  }
  assertCurrentArchetype(snapshot, collectionArchetype);
  assertCurrentArchetype(snapshot, searchArchetype);
  selectedPdpRoleArchetypes(authority, selection).forEach((archetype) =>
    assertCurrentArchetype(snapshot, archetype),
  );
  materializeSelectedPdpComplexityRules(authority, selection);

  const currentProductTypeIds = [
    ...new Set(
      catalogue.products.map(({ productType }) => canonicalProductTypePresentationId(productType)),
    ),
  ].sort();
  const selectedProductTypeIds = Object.keys(selection.productTypeMappings).sort();
  if (
    canonicalValueString(currentProductTypeIds) !== canonicalValueString(selectedProductTypeIds)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-product-type-authority",
      "Product-type design mappings must exactly cover current canonical product types.",
    );
  }
  const productTypeMappings = currentProductTypeIds.map((productTypeId) => {
    const archetypeId = selection.productTypeMappings[productTypeId];
    const archetype = authority.productDetailArchetypes.find(({ id }) => id === archetypeId);
    if (!archetype || archetype.id === authority.fallbacks.productDetailArchetypeId) {
      throw new DynamicCommerceDesignSelectionError(
        "unknown-archetype",
        "A known product type must select an exact non-fallback current PDP archetype.",
      );
    }
    assertCurrentArchetype(snapshot, archetype);
    return { productTypeId, archetypeId };
  });
  const genericFallback = authority.productDetailArchetypes.find(
    ({ id }) => id === authority.fallbacks.productDetailArchetypeId,
  );
  if (
    !genericFallback ||
    genericFallback.id !== GENERIC_PDP_ARCHETYPE_ID ||
    genericFallback.id !== selection.genericFallbackArchetypeId
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "Unknown product types require the registered generic PDP fallback.",
    );
  }
  assertCurrentArchetype(snapshot, genericFallback);

  return {
    snapshot,
    selection: dynamicCommerceDesignSelectionSchema.parse({
      ...selection,
      productTypeMappings: Object.fromEntries(
        productTypeMappings.map(({ productTypeId, archetypeId }) => [productTypeId, archetypeId]),
      ),
    }),
    authority,
    collectionArchetype,
    searchArchetype,
    productTypeMappings: productTypeMappings.map((mapping) => ({ ...mapping })),
  };
}

/**
 * Proves that one exact selection is executable against current aggregate and
 * catalogue authority without constructing a candidate StorefrontSnapshot.
 */
export function validateDynamicCommerceDesignSelection(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
  selectionInput: DynamicCommerceDesignSelection,
  authorityInput?: DynamicCommercePresentationAuthority,
): DynamicCommerceDesignSelection {
  return structuredClone(
    validatedDynamicCommerceDesignSelection(
      snapshotInput,
      catalogueInput,
      selectionInput,
      authorityInput,
    ).selection,
  );
}

/**
 * Replays one already-bound selection against its exact source aggregate. It
 * is intentionally independent of the page graph and catalogue so proposal
 * acceptance can verify every mutable presentation field deterministically.
 */
export function materializeDynamicCommerceDesignSelectionFromAuthority(
  authorityInput: DynamicCommercePresentationAuthority,
  selectionInput: DynamicCommerceDesignSelection,
): DynamicCommercePresentationAuthority {
  const authority = dynamicCommercePresentationAuthoritySchema.parse(
    structuredClone(authorityInput),
  );
  const selection = dynamicCommerceDesignSelectionSchema.parse(structuredClone(selectionInput));
  if (selection.authorityFingerprint !== authority.authorityFingerprint) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-authority",
      "Dynamic-commerce selection does not target the exact source presentation authority.",
    );
  }
  const collectionArchetype = authority.collectionSearchArchetypes.find(
    ({ id, supportedContexts }) =>
      id === selection.collectionArchetypeId && supportedContexts.includes("collection"),
  );
  const searchArchetype = authority.collectionSearchArchetypes.find(
    ({ id, supportedContexts }) =>
      id === selection.searchArchetypeId && supportedContexts.includes("search"),
  );
  if (!collectionArchetype || !searchArchetype) {
    throw new DynamicCommerceDesignSelectionError(
      "incompatible-context",
      "Dynamic-commerce selection references an unavailable collection or search archetype.",
    );
  }
  selectedPdpRoleArchetypes(authority, selection);
  const productComplexityRules = materializeSelectedPdpComplexityRules(authority, selection);
  const currentProductTypeIds = authority.productTypeMappings
    .map(({ productTypeId }) => productTypeId)
    .sort();
  const selectedProductTypeIds = Object.keys(selection.productTypeMappings).sort();
  if (
    canonicalValueString(currentProductTypeIds) !== canonicalValueString(selectedProductTypeIds)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-product-type-authority",
      "Dynamic-commerce selection does not exactly cover source product-type authority.",
    );
  }
  const productTypeMappings = currentProductTypeIds.map((productTypeId) => {
    const archetypeId = selection.productTypeMappings[productTypeId];
    const archetype = authority.productDetailArchetypes.find(({ id }) => id === archetypeId);
    if (!archetype || archetypeId === authority.fallbacks.productDetailArchetypeId) {
      throw new DynamicCommerceDesignSelectionError(
        "unknown-archetype",
        "Known product types must select current non-fallback PDP archetypes.",
      );
    }
    return { productTypeId, archetypeId };
  });
  if (
    authority.fallbacks.productDetailArchetypeId !== GENERIC_PDP_ARCHETYPE_ID ||
    !authority.productDetailArchetypes.some(({ id }) => id === GENERIC_PDP_ARCHETYPE_ID)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "Dynamic-commerce authority has no registered generic PDP fallback.",
    );
  }
  const { authorityFingerprint: _authorityFingerprint, ...currentMaterial } = authority;
  const nextAuthority = createDynamicCommercePresentationAuthority({
    ...structuredClone(currentMaterial),
    authorityRevision: authority.authorityRevision + 1,
    collectionRouteMappings: authority.collectionRouteMappings.map(({ routeId }) => ({
      routeId,
      archetypeId: collectionArchetype.id,
    })),
    collectionContextRules: authority.collectionContextRules.map((rule) => ({
      ...structuredClone(rule),
      archetypeId: collectionArchetype.id,
    })),
    productTypeMappings,
    productComplexityRules,
    searchArchetypeId: searchArchetype.id,
    fallbacks: {
      collectionArchetypeId: collectionArchetype.id,
      searchArchetypeId: searchArchetype.id,
      productDetailArchetypeId: GENERIC_PDP_ARCHETYPE_ID,
    },
  });
  void _authorityFingerprint;
  return nextAuthority;
}

/**
 * Materializes only the next aggregate presentation authority. This is the
 * proposal compiler boundary: it does not construct a candidate storefront.
 */
export function materializeDynamicCommerceDesignSelectionAuthority(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
  selectionInput: DynamicCommerceDesignSelection,
  authorityInput?: DynamicCommercePresentationAuthority,
): DynamicCommercePresentationAuthority {
  const validated = validatedDynamicCommerceDesignSelection(
    snapshotInput,
    catalogueInput,
    selectionInput,
    authorityInput,
  );
  return materializeDynamicCommerceDesignSelectionFromAuthority(
    validated.authority,
    validated.selection,
  );
}

/**
 * Applies one deterministic design selection to the canonical aggregate-level
 * dynamic-commerce presentation authority. Route inventory and protected
 * commerce remain untouched; no per-route design state is introduced.
 */
export function applyDynamicCommerceDesignSelection(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
  selectionInput: DynamicCommerceDesignSelection,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const nextAuthority = materializeDynamicCommerceDesignSelectionAuthority(
    snapshot,
    catalogueInput,
    selectionInput,
  );
  const result = storefrontSnapshotSchema.parse({
    ...structuredClone(snapshot),
    dynamicCommercePresentation: nextAuthority,
  });
  validateCurrentDynamicCommercePresentationAuthority(result);
  return result;
}
