import { z } from "zod";
import { assetRoleSchema, idSchema } from "@/domain/shared";
import {
  approvedAssetAffinitySchema,
  approvedAssetPlacementPurposeSchema,
  approvedAssetPresentationSchema,
  approvedAssetReusePolicySchema,
} from "./approved-asset-placement";
import { canonicalValueFingerprint } from "./canonical-storefront";

export const DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION = "1.0.0" as const;

const semanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const fingerprintSchema = z.string().trim().min(1).max(240);
const designTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z][A-Za-z0-9]*(?:[._-][a-z][A-Za-z0-9]*)*$/);

const dynamicCommerceCollectionRoutePathSchema = z
  .string()
  .trim()
  .regex(/^\/collections\/[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Collection routes must use /collections/<slug>.",
  });

const dynamicCommerceProductRoutePathSchema = z
  .string()
  .trim()
  .regex(/^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Product routes must use /products/<slug>.",
  });

export const dynamicCommerceRoutePathSchema = z.union([
  dynamicCommerceCollectionRoutePathSchema,
  dynamicCommerceProductRoutePathSchema,
  z.literal("/search"),
]);

export type DynamicCommerceDesignJsonValue =
  | null
  | boolean
  | number
  | string
  | DynamicCommerceDesignJsonValue[]
  | { [key: string]: DynamicCommerceDesignJsonValue };

const designJsonValueSchema: z.ZodType<DynamicCommerceDesignJsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string().max(20_000),
    z.array(designJsonValueSchema).max(500),
    z.record(z.string().min(1).max(160), designJsonValueSchema),
  ]),
);

export const protectedDynamicCommerceBindingKeys = [
  "productId",
  "relatedProductIds",
  "collectionId",
  "productIds",
  "childCollectionIds",
  "canonicalRevision",
  "sku",
  "price",
  "compareAtPrice",
  "stock",
  "stockStatus",
  "availability",
  "variantId",
  "variants",
  "variantDimensions",
  "options",
  "optionGroups",
  "optionValues",
  "media",
  "images",
  "productMedia",
] as const;

const protectedBindingKeySet = new Set<string>(protectedDynamicCommerceBindingKeys);

function findProtectedBindingPath(
  value: DynamicCommerceDesignJsonValue,
  path: readonly (string | number)[] = [],
): readonly (string | number)[] | undefined {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      const found = findProtectedBindingPath(entry, [...path, index]);
      if (found) return found;
    }
    return undefined;
  }
  if (value === null || typeof value !== "object") return undefined;
  for (const [key, entry] of Object.entries(value)) {
    if (protectedBindingKeySet.has(key)) return [...path, key];
    const found = findProtectedBindingPath(entry, [...path, key]);
    if (found) return found;
  }
  return undefined;
}

export const dynamicCommerceDesignStateSchema = z
  .record(z.string().min(1).max(160), designJsonValueSchema)
  .superRefine((state, context) => {
    const protectedPath = findProtectedBindingPath(state);
    if (protectedPath) {
      context.addIssue({
        code: "custom",
        path: [...protectedPath],
        message:
          "Dynamic commerce archetype design state cannot contain protected commerce bindings.",
      });
    }
  });

export const dynamicCommerceBoundedParameterValueSchema = z.union([
  z.string().trim().min(1).max(240),
  z.number().finite().min(-100_000).max(100_000),
  z.boolean(),
  z.array(z.string().trim().min(1).max(240)).max(32),
  z.array(z.number().finite().min(-100_000).max(100_000)).max(32),
]);

export const dynamicCommerceStyleOverridesSchema = z
  .object({
    alignment: z.enum(["left", "center", "right"]).optional(),
    spacing: z.enum(["compact", "standard", "spacious"]).optional(),
    contentWidth: z.enum(["narrow", "standard", "wide"]).optional(),
    surface: z.enum(["default", "surface", "primary", "secondary", "accent"]).optional(),
    surfaceTreatment: z.enum(["plain", "soft"]).optional(),
  })
  .strict();

/**
 * Exact reusable approved presentation authority retained while concrete dynamic route pages are
 * folded into the compact route authority. Route and component placement identities stay derived
 * by the route resolver because one archetype can serve several canonical routes.
 */
export const dynamicCommerceApprovedAssetSelectionSchema = z
  .object({
    assetSlotId: z.string().trim().min(1).max(80),
    assetId: idSchema,
    role: assetRoleSchema,
    assetRevision: z.string().trim().min(1).max(120),
    materialFingerprint: fingerprintSchema,
    sourceReferenceId: idSchema,
    sourceProvenanceKind: z
      .enum(["merchantProvided", "sourceDiscovered", "generated", "preset"])
      .optional(),
    placementContext: z.enum(["page", "sharedFrame"]).optional(),
    placementPurpose: approvedAssetPlacementPurposeSchema.optional(),
    reusePolicy: approvedAssetReusePolicySchema.optional(),
    affinity: approvedAssetAffinitySchema.optional(),
    responsiveSourceAssetIds: z.array(idSchema).max(4).optional(),
    required: z.boolean(),
    presentation: approvedAssetPresentationSchema,
  })
  .strict()
  .superRefine((selection, context) => {
    if (
      selection.presentation.assetId !== selection.assetId ||
      selection.presentation.asset.id !== selection.assetId ||
      selection.presentation.role !== selection.role ||
      selection.presentation.revision !== selection.assetRevision ||
      selection.presentation.materialFingerprint !== selection.materialFingerprint
    ) {
      context.addIssue({
        code: "custom",
        path: ["presentation"],
        message: "Compact dynamic-commerce asset presentation must match its approved selection.",
      });
    }
  });

export const dynamicCommerceComponentPresentationSchema = z
  .object({
    slotId: designTokenSchema,
    component: designTokenSchema,
    variant: designTokenSchema,
    anatomyId: designTokenSchema.optional(),
    visible: z.boolean(),
    content: dynamicCommerceDesignStateSchema,
    props: dynamicCommerceDesignStateSchema,
    styleOverrides: dynamicCommerceStyleOverridesSchema.optional(),
    boundedParameters: z.record(designTokenSchema, dynamicCommerceBoundedParameterValueSchema),
    // Optional preserves the fingerprints of pre-asset compact authorities. New authorities
    // always materialize an explicit list and never infer approved assets from repository files.
    approvedAssetSelections: z.array(dynamicCommerceApprovedAssetSelectionSchema).optional(),
  })
  .strict()
  .superRefine((presentation, context) => {
    const identities = (presentation.approvedAssetSelections ?? []).map(
      ({ assetSlotId, assetId }) => `${assetSlotId}:${assetId}`,
    );
    if (new Set(identities).size !== identities.length) {
      context.addIssue({
        code: "custom",
        path: ["approvedAssetSelections"],
        message: "Compact dynamic-commerce approved asset selections must be unique.",
      });
    }
  });

export const dynamicCommerceProfileReferenceSchema = z
  .object({
    profileId: z.string().trim().min(1).max(160),
    profileVersion: semanticVersionSchema,
    fingerprint: fingerprintSchema,
  })
  .strict();

export const dynamicCommerceDesignDnaNarrowingSchema = z
  .object({
    spacingDensity: z
      .array(z.enum(["compact", "standard", "spacious"]))
      .min(1)
      .max(3),
    surfaceDepth: z
      .array(z.enum(["flat", "subtle", "layered"]))
      .min(1)
      .max(3),
    imagePosture: z
      .array(z.enum(["contained", "editorial", "immersive"]))
      .min(1)
      .max(3),
  })
  .strict();

const responsiveTransformationSchema = z
  .object({
    breakpoint: z.enum(["mobile", "tablet", "desktop", "wide"]),
    viewport: z.union([z.literal(375), z.literal(768), z.literal(1024), z.literal(1440)]),
    transformationIds: z.array(designTokenSchema).max(24),
  })
  .strict();

export const dynamicCommerceResponsivePostureSchema = z
  .tuple([
    responsiveTransformationSchema,
    responsiveTransformationSchema,
    responsiveTransformationSchema,
    responsiveTransformationSchema,
  ])
  .superRefine((posture, context) => {
    const expected = [
      ["mobile", 375],
      ["tablet", 768],
      ["desktop", 1024],
      ["wide", 1440],
    ] as const;
    posture.forEach((entry, index) => {
      if (entry.breakpoint !== expected[index][0] || entry.viewport !== expected[index][1]) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Dynamic commerce responsive posture must use canonical breakpoint order.",
        });
      }
      if (new Set(entry.transformationIds).size !== entry.transformationIds.length) {
        context.addIssue({
          code: "custom",
          path: [index, "transformationIds"],
          message: "Responsive transformation identities must be unique per breakpoint.",
        });
      }
    });
  });

export const dynamicCommerceArtDirectionPostureSchema = z
  .object({
    imagePosture: z.enum(["contained", "editorial", "immersive", "product-led"]),
    ratio: z.enum(["natural", "square", "portrait", "landscape", "wide"]),
    crop: z.enum(["contain", "cover", "editorial"]),
    overlay: z.enum(["none", "subtle", "contrast", "gradient"]),
  })
  .strict();

/**
 * Archetype-local fallback metadata is descriptive registered authority. The
 * executable resolver supports the authority root's explicit family fallback;
 * it does not implement an archetype-local fail-closed mode.
 */
export const dynamicCommerceFallbackBehaviorSchema = z.literal("use-family-fallback");

const archetypeBaseShape = {
  id: idSchema,
  archetypeVersion: semanticVersionSchema,
  profile: dynamicCommerceProfileReferenceSchema,
  compatibleSharedFrameProfileIds: z.array(z.string().trim().min(1).max(160)).min(1),
  defaultSharedFrameProfileId: z.string().trim().min(1).max(160),
  designDnaNarrowing: dynamicCommerceDesignDnaNarrowingSchema,
  componentPresentations: z.array(dynamicCommerceComponentPresentationSchema).min(1).max(32),
  responsivePosture: dynamicCommerceResponsivePostureSchema,
  artDirectionPosture: dynamicCommerceArtDirectionPostureSchema,
  fallbackBehavior: dynamicCommerceFallbackBehaviorSchema,
} as const;

/**
 * Uses the registered archetype/frame relationship as the single compatibility predicate for
 * metadata narrowing, exact selection and execution validation.
 */
export function isDynamicCommerceArchetypeCompatibleWithSharedFrame(
  archetype: Readonly<{ compatibleSharedFrameProfileIds: readonly string[] }>,
  sharedFrameProfileId: string,
): boolean {
  return archetype.compatibleSharedFrameProfileIds.includes(sharedFrameProfileId);
}

function refineArchetype(
  archetype: {
    compatibleSharedFrameProfileIds: readonly string[];
    defaultSharedFrameProfileId: string;
    componentPresentations: readonly { slotId: string }[];
  },
  context: z.RefinementCtx,
): void {
  if (
    new Set(archetype.compatibleSharedFrameProfileIds).size !==
    archetype.compatibleSharedFrameProfileIds.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["compatibleSharedFrameProfileIds"],
      message: "Compatible shared-frame profile identities must be unique.",
    });
  }
  if (!archetype.compatibleSharedFrameProfileIds.includes(archetype.defaultSharedFrameProfileId)) {
    context.addIssue({
      code: "custom",
      path: ["defaultSharedFrameProfileId"],
      message: "The default shared frame must be compatible with the archetype.",
    });
  }
  const slotIds = archetype.componentPresentations.map(({ slotId }) => slotId);
  if (new Set(slotIds).size !== slotIds.length) {
    context.addIssue({
      code: "custom",
      path: ["componentPresentations"],
      message: "Archetype component slot identities must be unique.",
    });
  }
}

export const dynamicCommerceCollectionSearchArchetypeSchema = z
  .object({
    ...archetypeBaseShape,
    family: z.literal("collection-search"),
    supportedContexts: z
      .array(z.enum(["collection", "search"]))
      .min(1)
      .max(2),
    commerceBindingPolicy: z.literal("runtime-collection-membership"),
  })
  .strict()
  .superRefine((archetype, context) => {
    refineArchetype(archetype, context);
    if (new Set(archetype.supportedContexts).size !== archetype.supportedContexts.length) {
      context.addIssue({
        code: "custom",
        path: ["supportedContexts"],
        message: "Collection/search supported contexts must be unique.",
      });
    }
  });

export const dynamicCommerceProductDetailArchetypeSchema = z
  .object({
    ...archetypeBaseShape,
    family: z.literal("product-detail"),
    optionArchitecture: z.literal("generic-canonical-options"),
    commerceBindingPolicy: z.literal("runtime-protected-product"),
  })
  .strict()
  .superRefine(refineArchetype);

const routeBaseShape = {
  id: idSchema,
} as const;

export const dynamicCommerceRouteInventoryEntrySchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...routeBaseShape,
      kind: z.literal("collection"),
      route: dynamicCommerceCollectionRoutePathSchema,
      collectionId: idSchema,
    })
    .strict(),
  z
    .object({
      ...routeBaseShape,
      kind: z.literal("product"),
      route: dynamicCommerceProductRoutePathSchema,
      productId: idSchema,
      relatedProductIds: z.array(idSchema).max(100).optional(),
    })
    .strict(),
  z.object({ ...routeBaseShape, kind: z.literal("search"), route: z.literal("/search") }).strict(),
]);

export const dynamicCommerceCollectionRouteMappingSchema = z
  .object({ routeId: idSchema, archetypeId: idSchema })
  .strict();

export const dynamicCommerceProductTypeMappingSchema = z
  .object({ productTypeId: idSchema, archetypeId: idSchema })
  .strict();

const boundedIntegerRangeSchema = z
  .object({
    minimum: z.number().int().nonnegative(),
    maximum: z.number().int().nonnegative(),
  })
  .strict()
  .refine(({ minimum, maximum }) => minimum <= maximum, {
    message: "A bounded match range requires minimum <= maximum.",
    path: ["maximum"],
  });

export const dynamicCommerceProductComplexityRuleSchema = z
  .object({
    id: idSchema,
    priority: z.number().int().nonnegative().max(10_000),
    match: z
      .object({
        optionStructure: z.enum(["any", "simple", "configurable"]),
        optionGroupCount: boundedIntegerRangeSchema.optional(),
        mediaAvailability: z.enum(["any", "none", "single", "multiple"]),
        highConsideration: z.enum(["any", "required", "excluded"]),
      })
      .strict(),
    archetypeId: idSchema,
  })
  .strict();

export const dynamicCommerceCollectionContextRuleSchema = z
  .object({
    id: idSchema,
    priority: z.number().int().nonnegative().max(10_000),
    match: z
      .object({
        depth: boundedIntegerRangeSchema.optional(),
        productCount: boundedIntegerRangeSchema.optional(),
        childCollections: z.enum(["any", "present", "absent"]),
        campaignEvidence: z.enum(["any", "present", "absent"]),
        merchandisingDensity: z.enum(["any", "compact", "standard", "spacious"]),
      })
      .strict(),
    archetypeId: idSchema,
  })
  .strict();

export const dynamicCommerceNavigationTargetSchema = z
  .object({ type: z.literal("dynamic-commerce-route"), routeId: idSchema })
  .strict();

const fallbackSchema = z
  .object({
    collectionArchetypeId: idSchema,
    searchArchetypeId: idSchema,
    productDetailArchetypeId: idSchema,
  })
  .strict();

const authorityMaterialShape = {
  contractVersion: z.literal(DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION),
  authorityId: idSchema,
  authorityRevision: z.number().int().nonnegative(),
  routeInventory: z.array(dynamicCommerceRouteInventoryEntrySchema),
  collectionSearchArchetypes: z.array(dynamicCommerceCollectionSearchArchetypeSchema).min(1),
  productDetailArchetypes: z.array(dynamicCommerceProductDetailArchetypeSchema).min(1),
  collectionRouteMappings: z.array(dynamicCommerceCollectionRouteMappingSchema),
  collectionContextRules: z.array(dynamicCommerceCollectionContextRuleSchema).min(1),
  productTypeMappings: z.array(dynamicCommerceProductTypeMappingSchema),
  productComplexityRules: z.array(dynamicCommerceProductComplexityRuleSchema).min(1),
  searchArchetypeId: idSchema,
  fallbacks: fallbackSchema,
} as const;

const authorityMaterialObjectSchema = z.object(authorityMaterialShape).strict();

function addDuplicateIssue(
  values: readonly string[],
  path: readonly (string | number)[],
  message: string,
  context: z.RefinementCtx,
): void {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", path: [...path], message });
  }
}

function refineAuthorityMaterial(
  authority: z.output<typeof authorityMaterialObjectSchema>,
  context: z.RefinementCtx,
): void {
  addDuplicateIssue(
    authority.routeInventory.map(({ id }) => id),
    ["routeInventory"],
    "Dynamic commerce route identities must be unique.",
    context,
  );
  addDuplicateIssue(
    authority.routeInventory.map(({ route }) => route),
    ["routeInventory"],
    "Dynamic commerce route paths must be unique.",
    context,
  );
  addDuplicateIssue(
    authority.routeInventory.flatMap((entry) =>
      entry.kind === "product" ? [entry.productId] : [],
    ),
    ["routeInventory"],
    "Product route bindings must reference each product at most once.",
    context,
  );
  addDuplicateIssue(
    authority.routeInventory.flatMap((entry) =>
      entry.kind === "collection" ? [entry.collectionId] : [],
    ),
    ["routeInventory"],
    "Collection route bindings must reference each collection at most once.",
    context,
  );

  const searchRoutes = authority.routeInventory.filter(({ kind }) => kind === "search");
  if (searchRoutes.length !== 1) {
    context.addIssue({
      code: "custom",
      path: ["routeInventory"],
      message: "Dynamic commerce authority requires exactly one search route.",
    });
  }

  const collectionArchetypeIds = authority.collectionSearchArchetypes.map(({ id }) => id);
  const productArchetypeIds = authority.productDetailArchetypes.map(({ id }) => id);
  const routeIds = authority.routeInventory.map(({ id }) => id);
  addDuplicateIssue(
    [...collectionArchetypeIds, ...productArchetypeIds],
    ["collectionSearchArchetypes"],
    "Dynamic commerce archetype identities must be globally unique.",
    context,
  );
  const routeArchetypeCollisions = [...collectionArchetypeIds, ...productArchetypeIds].filter(
    (id) => routeIds.includes(id),
  );
  if (routeArchetypeCollisions.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["routeInventory"],
      message: "Dynamic commerce route and archetype identities must be globally unique.",
    });
  }

  const collectionArchetypes = new Map(
    authority.collectionSearchArchetypes.map((archetype) => [archetype.id, archetype]),
  );
  const productArchetypes = new Set(productArchetypeIds);
  const routes = new Map(authority.routeInventory.map((route) => [route.id, route]));

  addDuplicateIssue(
    authority.collectionRouteMappings.map(({ routeId }) => routeId),
    ["collectionRouteMappings"],
    "Each collection route may have only one archetype mapping.",
    context,
  );
  const mappedCollectionRoutes = new Set<string>();
  authority.collectionRouteMappings.forEach((mapping, index) => {
    const route = routes.get(mapping.routeId);
    if (route?.kind !== "collection") {
      context.addIssue({
        code: "custom",
        path: ["collectionRouteMappings", index, "routeId"],
        message: "Collection mappings must reference a collection route inventory entry.",
      });
    } else {
      mappedCollectionRoutes.add(route.id);
    }
    if (!collectionArchetypes.get(mapping.archetypeId)?.supportedContexts.includes("collection")) {
      context.addIssue({
        code: "custom",
        path: ["collectionRouteMappings", index, "archetypeId"],
        message: "Collection mappings must reference a collection-compatible archetype.",
      });
    }
  });
  authority.routeInventory.forEach((route, index) => {
    if (route.kind === "product") {
      const relatedProductIds = route.relatedProductIds ?? [];
      addDuplicateIssue(
        relatedProductIds,
        ["routeInventory", index, "relatedProductIds"],
        "Product route related-product bindings must be unique.",
        context,
      );
      if (relatedProductIds.includes(route.productId)) {
        context.addIssue({
          code: "custom",
          path: ["routeInventory", index, "relatedProductIds"],
          message: "A product route cannot bind its primary product as a related product.",
        });
      }
    }
    if (route.kind === "collection" && !mappedCollectionRoutes.has(route.id)) {
      context.addIssue({
        code: "custom",
        path: ["routeInventory", index, "id"],
        message: "Every collection route requires one explicit archetype mapping.",
      });
    }
  });

  addDuplicateIssue(
    authority.productTypeMappings.map(({ productTypeId }) => productTypeId),
    ["productTypeMappings"],
    "Each product type may have only one PDP archetype mapping.",
    context,
  );
  authority.productTypeMappings.forEach((mapping, index) => {
    if (!productArchetypes.has(mapping.archetypeId)) {
      context.addIssue({
        code: "custom",
        path: ["productTypeMappings", index, "archetypeId"],
        message: "Product-type mappings must reference a PDP archetype.",
      });
    }
  });

  for (const [path, rules, knownArchetypes] of [
    ["productComplexityRules", authority.productComplexityRules, productArchetypes],
    ["collectionContextRules", authority.collectionContextRules, new Set(collectionArchetypeIds)],
  ] as const) {
    addDuplicateIssue(
      rules.map(({ id }) => id),
      [path],
      "Dynamic commerce matching-rule identities must be unique.",
      context,
    );
    addDuplicateIssue(
      rules.map(({ priority }) => String(priority)),
      [path],
      "Dynamic commerce matching-rule priorities must be unique and deterministic.",
      context,
    );
    rules.forEach((rule, index) => {
      if (!knownArchetypes.has(rule.archetypeId)) {
        context.addIssue({
          code: "custom",
          path: [path, index, "archetypeId"],
          message: "Dynamic commerce matching rules must reference a known family archetype.",
        });
      }
    });
  }

  const collectionFallback = collectionArchetypes.get(authority.fallbacks.collectionArchetypeId);
  if (!collectionFallback?.supportedContexts.includes("collection")) {
    context.addIssue({
      code: "custom",
      path: ["fallbacks", "collectionArchetypeId"],
      message: "The collection fallback must reference a collection-compatible archetype.",
    });
  }
  const searchFallback = collectionArchetypes.get(authority.fallbacks.searchArchetypeId);
  if (!searchFallback?.supportedContexts.includes("search")) {
    context.addIssue({
      code: "custom",
      path: ["fallbacks", "searchArchetypeId"],
      message: "The search fallback must reference a search-compatible archetype.",
    });
  }
  if (
    !collectionArchetypes.get(authority.searchArchetypeId)?.supportedContexts.includes("search")
  ) {
    context.addIssue({
      code: "custom",
      path: ["searchArchetypeId"],
      message: "Search presentation must reference a search-compatible archetype.",
    });
  }
  if (!productArchetypes.has(authority.fallbacks.productDetailArchetypeId)) {
    context.addIssue({
      code: "custom",
      path: ["fallbacks", "productDetailArchetypeId"],
      message: "The generic PDP fallback must reference a known PDP archetype.",
    });
  }
}

export const dynamicCommercePresentationAuthorityMaterialSchema = authorityMaterialObjectSchema
  .superRefine(refineAuthorityMaterial)
  .transform(normalizeAuthorityMaterial);

function sortStrings<T extends string>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizeCollectionSearchArchetype(
  archetype: z.output<typeof dynamicCommerceCollectionSearchArchetypeSchema>,
): z.output<typeof dynamicCommerceCollectionSearchArchetypeSchema> {
  return {
    ...archetype,
    compatibleSharedFrameProfileIds: sortStrings(archetype.compatibleSharedFrameProfileIds),
    designDnaNarrowing: {
      spacingDensity: sortStrings(archetype.designDnaNarrowing.spacingDensity),
      surfaceDepth: sortStrings(archetype.designDnaNarrowing.surfaceDepth),
      imagePosture: sortStrings(archetype.designDnaNarrowing.imagePosture),
    },
    supportedContexts: sortStrings(archetype.supportedContexts),
  };
}

function normalizeProductDetailArchetype(
  archetype: z.output<typeof dynamicCommerceProductDetailArchetypeSchema>,
): z.output<typeof dynamicCommerceProductDetailArchetypeSchema> {
  return {
    ...archetype,
    compatibleSharedFrameProfileIds: sortStrings(archetype.compatibleSharedFrameProfileIds),
    designDnaNarrowing: {
      spacingDensity: sortStrings(archetype.designDnaNarrowing.spacingDensity),
      surfaceDepth: sortStrings(archetype.designDnaNarrowing.surfaceDepth),
      imagePosture: sortStrings(archetype.designDnaNarrowing.imagePosture),
    },
  };
}

function normalizeAuthorityMaterial(
  authority: z.output<typeof authorityMaterialObjectSchema>,
): z.output<typeof authorityMaterialObjectSchema> {
  return {
    ...authority,
    routeInventory: [...authority.routeInventory].sort((left, right) =>
      left.route.localeCompare(right.route),
    ),
    collectionSearchArchetypes: authority.collectionSearchArchetypes
      .map(normalizeCollectionSearchArchetype)
      .sort((left, right) => left.id.localeCompare(right.id)),
    productDetailArchetypes: authority.productDetailArchetypes
      .map(normalizeProductDetailArchetype)
      .sort((left, right) => left.id.localeCompare(right.id)),
    collectionRouteMappings: [...authority.collectionRouteMappings].sort((left, right) =>
      left.routeId.localeCompare(right.routeId),
    ),
    collectionContextRules: [...authority.collectionContextRules].sort(
      (left, right) => left.priority - right.priority || left.id.localeCompare(right.id),
    ),
    productTypeMappings: [...authority.productTypeMappings].sort((left, right) =>
      left.productTypeId.localeCompare(right.productTypeId),
    ),
    productComplexityRules: [...authority.productComplexityRules].sort(
      (left, right) => left.priority - right.priority || left.id.localeCompare(right.id),
    ),
  };
}

export function dynamicCommercePresentationAuthorityFingerprint(
  input: z.input<typeof dynamicCommercePresentationAuthorityMaterialSchema>,
): string {
  const material = dynamicCommercePresentationAuthorityMaterialSchema.parse(input);
  return `dynamic-commerce-presentation-${canonicalValueFingerprint(material)}`;
}

const authorityWithFingerprintObjectSchema = z
  .object({ ...authorityMaterialShape, authorityFingerprint: fingerprintSchema })
  .strict();

export const dynamicCommercePresentationAuthoritySchema = authorityWithFingerprintObjectSchema
  .superRefine((authority, context) => {
    const { authorityFingerprint, ...material } = authority;
    const result = dynamicCommercePresentationAuthorityMaterialSchema.safeParse(material);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        context.addIssue({ code: "custom", path: issue.path, message: issue.message }),
      );
      return;
    }
    const expected = `dynamic-commerce-presentation-${canonicalValueFingerprint(result.data)}`;
    if (authorityFingerprint !== expected) {
      context.addIssue({
        code: "custom",
        path: ["authorityFingerprint"],
        message: "Dynamic commerce presentation authority fingerprint is stale.",
      });
    }
  })
  .transform((authority) => {
    const { authorityFingerprint, ...material } = authority;
    return {
      ...dynamicCommercePresentationAuthorityMaterialSchema.parse(material),
      authorityFingerprint,
    };
  });

export type DynamicCommercePresentationAuthorityMaterial = z.output<
  typeof dynamicCommercePresentationAuthorityMaterialSchema
>;
export type DynamicCommercePresentationAuthority = z.output<
  typeof dynamicCommercePresentationAuthoritySchema
>;
export type DynamicCommerceRouteInventoryEntry = z.infer<
  typeof dynamicCommerceRouteInventoryEntrySchema
>;
export type DynamicCommerceCollectionSearchArchetype = z.infer<
  typeof dynamicCommerceCollectionSearchArchetypeSchema
>;
export type DynamicCommerceProductDetailArchetype = z.infer<
  typeof dynamicCommerceProductDetailArchetypeSchema
>;
export type DynamicCommerceCollectionContextRule = z.infer<
  typeof dynamicCommerceCollectionContextRuleSchema
>;
export type DynamicCommerceProductComplexityRule = z.infer<
  typeof dynamicCommerceProductComplexityRuleSchema
>;
export type DynamicCommerceApprovedAssetSelection = z.infer<
  typeof dynamicCommerceApprovedAssetSelectionSchema
>;
export type DynamicCommerceComponentPresentation = z.infer<
  typeof dynamicCommerceComponentPresentationSchema
>;
export type DynamicCommerceNavigationTarget = z.infer<typeof dynamicCommerceNavigationTargetSchema>;

export function createDynamicCommercePresentationAuthority(
  input: z.input<typeof dynamicCommercePresentationAuthorityMaterialSchema>,
): DynamicCommercePresentationAuthority {
  const material = dynamicCommercePresentationAuthorityMaterialSchema.parse(input);
  return dynamicCommercePresentationAuthoritySchema.parse({
    ...material,
    authorityFingerprint: `dynamic-commerce-presentation-${canonicalValueFingerprint(material)}`,
  });
}
