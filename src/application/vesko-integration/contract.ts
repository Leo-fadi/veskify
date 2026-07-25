import { z } from "zod";
import {
  productMediaPresentationSchema,
  productOptionGroupSchema,
} from "@/domain/component-platform";
import { storefrontSnapshotSchema, type StorefrontSnapshot } from "@/domain/storefront";
import { idSchema, localeSchema, localizedTextSchema } from "@/domain/shared";

export const integrationRevisionSchema = z.string().trim().min(1).max(160);
export const tenantIdSchema = idSchema;
export const merchantIdSchema = idSchema;
export const organizationIdSchema = idSchema;
export const storeIdSchema = idSchema;
export const userIdSchema = idSchema;
export const categoryIdSchema = idSchema;

export const storefrontRoleSchema = z.enum(["owner", "admin", "designer", "viewer"]);
export const storefrontPermissionSchema = z.enum([
  "readStorefront",
  "saveDraft",
  "restoreDraft",
  "publishStorefront",
]);

export const merchantProjectContextSchema = z
  .object({
    userId: userIdSchema,
    tenantId: tenantIdSchema,
    merchantId: merchantIdSchema,
    organizationId: organizationIdSchema,
    storeId: storeIdSchema,
    storefrontProjectId: idSchema,
    roles: z.array(storefrontRoleSchema).min(1),
    permissions: z.array(storefrontPermissionSchema),
    primaryLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1).max(2),
    market: z.string().trim().min(2).max(80),
    projectRevision: integrationRevisionSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.enabledLocales.includes(value.primaryLocale)) {
      context.addIssue({
        code: "custom",
        path: ["primaryLocale"],
        message: "The primary locale must be enabled.",
      });
    }
    if (new Set(value.roles).size !== value.roles.length) {
      context.addIssue({ code: "custom", path: ["roles"], message: "Roles must be unique." });
    }
    if (new Set(value.permissions).size !== value.permissions.length) {
      context.addIssue({
        code: "custom",
        path: ["permissions"],
        message: "Permissions must be unique.",
      });
    }
  });

const moneySchema = z
  .object({ amount: z.number().finite().nonnegative(), currency: z.literal("EUR") })
  .strict();

export const storefrontSafeProductProjectionSchema = z
  .object({
    productId: idSchema,
    slug: z.string().trim().min(1).max(160),
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),
    productTypeId: idSchema,
    sku: z.string().trim().min(1).max(120).optional(),
    price: moneySchema.optional(),
    compareAtPrice: moneySchema.optional(),
    priceUnavailableReason: localizedTextSchema.optional(),
    availabilityLabel: localizedTextSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.price === undefined) === (value.priceUnavailableReason === undefined)) {
      context.addIssue({
        code: "custom",
        path: value.price ? ["priceUnavailableReason"] : ["price"],
        message: "Exactly one price state is required.",
      });
    }
  });

export const storefrontCollectionProjectionSchema = z
  .object({
    collectionId: idSchema,
    slug: z.string().trim().min(1).max(160),
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),
    productIds: z.array(idSchema),
    categoryId: categoryIdSchema.optional(),
  })
  .strict();

export const categoryHierarchyNodeSchema = z
  .object({
    categoryId: categoryIdSchema,
    parentCategoryId: categoryIdSchema.nullable(),
    slug: z.string().trim().min(1).max(160),
    title: localizedTextSchema,
  })
  .strict();

const supportedStorefrontDestinationSchema = z.enum(["home"]);

export const storefrontNavigationReferenceSchema = z
  .object({
    navigationId: idSchema,
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("product"), productId: idSchema }).strict(),
      z.object({ kind: z.literal("collection"), collectionId: idSchema }).strict(),
      z.object({ kind: z.literal("category"), categoryId: categoryIdSchema }).strict(),
      z
        .object({
          kind: z.literal("storefront"),
          destination: supportedStorefrontDestinationSchema,
        })
        .strict(),
    ]),
  })
  .strict();

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function catalogueIssue(
  context: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}

export const catalogueProjectionSchema = z
  .object({
    tenantId: tenantIdSchema,
    storeId: storeIdSchema,
    storefrontProjectId: idSchema,
    catalogueId: idSchema,
    revision: integrationRevisionSchema,
    products: z.array(storefrontSafeProductProjectionSchema),
    collections: z.array(storefrontCollectionProjectionSchema),
    categories: z.array(categoryHierarchyNodeSchema),
    navigation: z.array(storefrontNavigationReferenceSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const productIds = new Set(value.products.map((product) => product.productId));
    const collectionIds = new Set(value.collections.map((collection) => collection.collectionId));
    const categoryIds = new Set(value.categories.map((category) => category.categoryId));
    const identityGroups = [
      ["products", value.products.map((product) => product.productId)],
      ["collections", value.collections.map((collection) => collection.collectionId)],
      ["categories", value.categories.map((category) => category.categoryId)],
      ["navigation", value.navigation.map((item) => item.navigationId)],
    ] as const;

    identityGroups.forEach(([key, ids]) => {
      if (!unique(ids)) catalogueIssue(context, [key], "Canonical IDs must be unique.");
    });

    const entityKinds = new Map<string, "product" | "collection" | "category">();
    const canonicalEntityIds = [
      ["product", productIds],
      ["collection", collectionIds],
      ["category", categoryIds],
    ] as const;
    canonicalEntityIds
      .flatMap(([kind, ids]) => [...ids].map((id) => [kind, id] as const))
      .forEach(([kind, id]) => {
        const prior = entityKinds.get(id);
        if (prior !== undefined && prior !== kind) {
          catalogueIssue(
            context,
            [],
            "Canonical entity IDs cannot resolve to multiple entity types.",
          );
          return;
        }
        entityKinds.set(id, kind);
      });

    const routedSlugs = [
      ...value.products.map((product) => product.slug),
      ...value.collections.map((collection) => collection.slug),
      ...value.categories.map((category) => category.slug),
    ];
    if (!unique(routedSlugs)) {
      catalogueIssue(context, [], "Canonical routing slugs must be unique.");
    }

    value.collections.forEach((collection, index) => {
      if (!unique(collection.productIds)) {
        catalogueIssue(
          context,
          ["collections", index, "productIds"],
          "Collection product IDs must be unique.",
        );
      }
      collection.productIds.forEach((productId, productIndex) => {
        if (!productIds.has(productId)) {
          catalogueIssue(
            context,
            ["collections", index, "productIds", productIndex],
            "Collection membership must use canonical product IDs.",
          );
        }
      });
      if (collection.categoryId !== undefined && !categoryIds.has(collection.categoryId)) {
        catalogueIssue(
          context,
          ["collections", index, "categoryId"],
          "Collection categories must resolve to canonical category IDs.",
        );
      }
    });

    value.categories.forEach((category, index) => {
      if (category.parentCategoryId !== null && !categoryIds.has(category.parentCategoryId)) {
        catalogueIssue(
          context,
          ["categories", index, "parentCategoryId"],
          "Category parents must resolve to canonical category IDs.",
        );
      }
      if (category.parentCategoryId === category.categoryId) {
        catalogueIssue(
          context,
          ["categories", index, "parentCategoryId"],
          "Categories cannot parent themselves.",
        );
      }
    });

    value.navigation.forEach((item, index) => {
      switch (item.target.kind) {
        case "product":
          if (!productIds.has(item.target.productId)) {
            catalogueIssue(
              context,
              ["navigation", index, "target", "productId"],
              "Navigation product targets must resolve.",
            );
          }
          break;
        case "collection":
          if (!collectionIds.has(item.target.collectionId)) {
            catalogueIssue(
              context,
              ["navigation", index, "target", "collectionId"],
              "Navigation collection targets must resolve.",
            );
          }
          break;
        case "category":
          if (!categoryIds.has(item.target.categoryId)) {
            catalogueIssue(
              context,
              ["navigation", index, "target", "categoryId"],
              "Navigation category targets must resolve.",
            );
          }
          break;
        case "storefront":
          break;
      }
    });
  });

export const storefrontOptionGroupProjectionSchema = productOptionGroupSchema;
export const canonicalProductMediaProjectionSchema = productMediaPresentationSchema;

export const availabilityOptionMediaProjectionSchema = z
  .object({
    tenantId: tenantIdSchema,
    storeId: storeIdSchema,
    storefrontProjectId: idSchema,
    productId: idSchema,
    revision: integrationRevisionSchema,
    availability: z.enum(["inStock", "lowStock", "outOfStock", "unavailable"]),
    stockDisplay: z.enum(["show", "limited", "hide"]),
    attributes: z.array(
      z
        .object({ attributeId: idSchema, label: localizedTextSchema, value: localizedTextSchema })
        .strict(),
    ),
    optionGroups: z.array(storefrontOptionGroupProjectionSchema),
    variants: z.array(
      z
        .object({
          variantId: idSchema,
          optionValueIds: z.array(idSchema),
          price: moneySchema.optional(),
          availability: z.enum(["inStock", "lowStock", "outOfStock", "unavailable"]),
        })
        .strict(),
    ),
    media: z.array(canonicalProductMediaProjectionSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const optionGroups = new Map(value.optionGroups.map((group) => [group.id, group]));
    const optionValues = new Map<string, string>();
    const variantIds = new Set(value.variants.map((variant) => variant.variantId));

    if (!unique(value.optionGroups.map((group) => group.id))) {
      catalogueIssue(context, ["optionGroups"], "Canonical option group IDs must be unique.");
    }
    value.optionGroups.forEach((group, groupIndex) => {
      group.values.forEach((optionValue, valueIndex) => {
        const owner = optionValues.get(optionValue.id);
        if (owner !== undefined && owner !== group.id) {
          catalogueIssue(
            context,
            ["optionGroups", groupIndex, "values", valueIndex, "id"],
            "Canonical option value IDs must resolve unambiguously.",
          );
          return;
        }
        optionValues.set(optionValue.id, group.id);
      });
      group.dependsOn.forEach((dependency, dependencyIndex) => {
        const target = optionGroups.get(dependency.groupId);
        if (target === undefined || dependency.groupId === group.id) {
          catalogueIssue(
            context,
            ["optionGroups", groupIndex, "dependsOn", dependencyIndex, "groupId"],
            "Option dependencies must reference another canonical option group.",
          );
          return;
        }
        dependency.valueIds?.forEach((valueId, valueIndex) => {
          if (!target.values.some((optionValue) => optionValue.id === valueId)) {
            catalogueIssue(
              context,
              ["optionGroups", groupIndex, "dependsOn", dependencyIndex, "valueIds", valueIndex],
              "Option dependency values must resolve within the referenced option group.",
            );
          }
        });
      });
    });

    if (!unique(value.variants.map((variant) => variant.variantId))) {
      catalogueIssue(context, ["variants"], "Canonical variant IDs must be unique.");
    }
    value.variants.forEach((variant, variantIndex) => {
      if (!unique(variant.optionValueIds)) {
        catalogueIssue(
          context,
          ["variants", variantIndex, "optionValueIds"],
          "Variant option value IDs must be unique.",
        );
      }
      variant.optionValueIds.forEach((valueId, valueIndex) => {
        if (!optionValues.has(valueId)) {
          catalogueIssue(
            context,
            ["variants", variantIndex, "optionValueIds", valueIndex],
            "Variants must reference canonical option values.",
          );
        }
      });
    });

    value.media.forEach((media, mediaIndex) => {
      if (
        media.role === "variant" &&
        (media.variantIds === undefined || media.variantIds.length === 0)
      ) {
        catalogueIssue(
          context,
          ["media", mediaIndex, "variantIds"],
          "Variant media must reference canonical variants.",
        );
      }
      if (media.variantIds !== undefined && !unique(media.variantIds)) {
        catalogueIssue(
          context,
          ["media", mediaIndex, "variantIds"],
          "Variant media references must be unique.",
        );
      }
      media.variantIds?.forEach((variantId, variantIndex) => {
        if (!variantIds.has(variantId)) {
          catalogueIssue(
            context,
            ["media", mediaIndex, "variantIds", variantIndex],
            "Variant media must reference a variant on this product.",
          );
        }
      });
    });
  });

export const storefrontSnapshotExpectationSchema = z
  .object({
    id: idSchema,
    revision: integrationRevisionSchema,
    contentFingerprint: z.string().trim().min(1).max(200),
  })
  .strict();

export const authoritativeStorefrontSnapshotSchema = storefrontSnapshotExpectationSchema
  .extend({ tenantId: tenantIdSchema, storefrontProjectId: idSchema })
  .strict();

export const immutableHistoryTargetSchema = authoritativeStorefrontSnapshotSchema
  .extend({ immutable: z.literal(true) })
  .strict();

export const storefrontDraftSchema = z
  .object({
    tenantId: tenantIdSchema,
    storefrontProjectId: idSchema,
    revision: integrationRevisionSchema,
    contentFingerprint: z.string().trim().min(1).max(200),
    snapshot: storefrontSnapshotSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.snapshot.projectId !== value.storefrontProjectId) {
      context.addIssue({
        code: "custom",
        path: ["snapshot", "projectId"],
        message: "Draft snapshot must belong to the storefront project.",
      });
    }
  });

export const saveStorefrontDraftRequestSchema = z
  .object({
    context: merchantProjectContextSchema,
    requestId: idSchema,
    expectedProjectRevision: integrationRevisionSchema,
    expectedCurrentDraft: storefrontSnapshotExpectationSchema.nullable(),
    draft: storefrontDraftSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.context.tenantId !== value.draft.tenantId ||
      value.context.storefrontProjectId !== value.draft.storefrontProjectId
    ) {
      context.addIssue({
        code: "custom",
        path: ["draft"],
        message: "Draft identity must match the merchant project context.",
      });
    }
    if (value.expectedProjectRevision !== value.context.projectRevision) {
      context.addIssue({
        code: "custom",
        path: ["expectedProjectRevision"],
        message: "Draft saves require the current project revision.",
      });
    }
  });

export const restoreStorefrontHistoryRequestSchema = z
  .object({
    context: merchantProjectContextSchema,
    requestId: idSchema,
    expectedProjectRevision: integrationRevisionSchema,
    expectedCurrentDraft: storefrontSnapshotExpectationSchema,
    target: storefrontSnapshotExpectationSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.expectedProjectRevision !== value.context.projectRevision) {
      context.addIssue({
        code: "custom",
        path: ["expectedProjectRevision"],
        message: "History restoration requires the current project revision.",
      });
    }
    if (value.target.id === value.expectedCurrentDraft.id) {
      context.addIssue({
        code: "custom",
        path: ["target", "id"],
        message: "The current draft cannot be used as an immutable history target.",
      });
    }
  });

export const publishStorefrontRequestSchema = z
  .object({
    context: merchantProjectContextSchema,
    requestId: idSchema,
    publishPreparationId: idSchema,
    expectedProjectRevision: integrationRevisionSchema,
    expectedSavedDraft: storefrontSnapshotExpectationSchema,
    expectedPublished: storefrontSnapshotExpectationSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.expectedProjectRevision !== value.context.projectRevision) {
      context.addIssue({
        code: "custom",
        path: ["expectedProjectRevision"],
        message: "Publishing requires the current project revision.",
      });
    }
    if (value.expectedSavedDraft.id === value.expectedPublished.id) {
      context.addIssue({
        code: "custom",
        path: ["expectedSavedDraft", "id"],
        message: "Saved draft and published snapshot identities must remain distinct.",
      });
    }
  });

export const publicationResultSchema = z
  .object({
    requestId: idSchema,
    storefrontProjectId: idSchema,
    publishedRevision: integrationRevisionSchema,
    status: z.enum(["published", "rejected"]),
    rejection: z
      .enum(["permissionDenied", "revisionConflict", "validationFailed", "unavailable"])
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.status === "rejected") !== (value.rejection !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["rejection"],
        message: "Publication rejection must match its status.",
      });
    }
  });

export const veskoIntegrationCapabilitySchema = z.enum([
  "merchantContext",
  "catalogueProjection",
  "availabilityProjection",
  "optionResolution",
  "canonicalMedia",
  "draftPersistence",
  "publishing",
  "historyRestoration",
]);
export const capabilityAvailabilitySchema = z.enum(["available", "unavailable"]);
export const veskoIntegrationCapabilitiesSchema = z
  .object(
    Object.fromEntries(
      veskoIntegrationCapabilitySchema.options.map((capability) => [
        capability,
        capabilityAvailabilitySchema,
      ]),
    ) as Record<
      z.infer<typeof veskoIntegrationCapabilitySchema>,
      typeof capabilityAvailabilitySchema
    >,
  )
  .strict();

export const integrationFailureCodeSchema = z.enum([
  "authenticationUnavailable",
  "permissionDenied",
  "tenantMismatch",
  "merchantNotFound",
  "projectNotFound",
  "staleProjectRevision",
  "catalogueUnavailable",
  "staleCatalogueProjection",
  "availabilityUnavailable",
  "draftRevisionConflict",
  "historyTargetUnavailable",
  "staleHistoryTarget",
  "historyTargetFingerprintMismatch",
  "duplicateCanonicalIdentity",
  "brokenCatalogueReference",
  "savedDraftMismatch",
  "stalePublishConfirmation",
  "publishedStateConflict",
  "publishingUnavailable",
  "unsupportedCapability",
  "malformedIntegrationResponse",
]);
export type IntegrationFailureCode = z.infer<typeof integrationFailureCodeSchema>;

const safeFailureMessages: Record<IntegrationFailureCode, string> = {
  authenticationUnavailable: "Your Storefront Studio access is temporarily unavailable.",
  permissionDenied: "You do not have permission to complete this storefront action.",
  tenantMismatch: "This storefront belongs to a different merchant account.",
  merchantNotFound: "The merchant account could not be found.",
  projectNotFound: "The storefront project could not be found.",
  staleProjectRevision: "The storefront changed. Refresh and try again.",
  catalogueUnavailable: "Products from Vesko are temporarily unavailable.",
  staleCatalogueProjection: "Product information changed. Refresh and try again.",
  availabilityUnavailable: "Product availability is temporarily unavailable.",
  draftRevisionConflict: "This draft changed elsewhere. Refresh before saving.",
  historyTargetUnavailable: "The selected storefront version is no longer available.",
  staleHistoryTarget: "The selected storefront version changed. Refresh and try again.",
  historyTargetFingerprintMismatch: "The selected storefront version could not be verified.",
  duplicateCanonicalIdentity: "Vesko returned duplicate catalogue information.",
  brokenCatalogueReference: "Vesko returned incomplete catalogue information.",
  savedDraftMismatch: "The saved storefront draft changed. Refresh before continuing.",
  stalePublishConfirmation: "The publish review is no longer current. Review the latest draft.",
  publishedStateConflict: "The published storefront changed. Refresh before publishing.",
  publishingUnavailable: "Publishing is temporarily unavailable.",
  unsupportedCapability: "This Storefront Studio capability is not available in this environment.",
  malformedIntegrationResponse: "The storefront service returned an invalid response.",
};

export class VeskoIntegrationError extends Error {
  constructor(readonly code: IntegrationFailureCode) {
    super(safeFailureMessages[code]);
    this.name = "VeskoIntegrationError";
  }
}

type StorefrontSnapshotExpectation = z.infer<typeof storefrontSnapshotExpectationSchema>;
type AuthoritativeStorefrontSnapshot = z.infer<typeof authoritativeStorefrontSnapshotSchema>;
type ImmutableHistoryTarget = z.infer<typeof immutableHistoryTargetSchema>;

function matchesSnapshotExpectation(
  expected: StorefrontSnapshotExpectation,
  actual: StorefrontSnapshotExpectation,
): boolean {
  return (
    expected.id === actual.id &&
    expected.revision === actual.revision &&
    expected.contentFingerprint === actual.contentFingerprint
  );
}

function belongsToContext(
  snapshot: AuthoritativeStorefrontSnapshot,
  context: z.infer<typeof merchantProjectContextSchema>,
): boolean {
  return (
    snapshot.tenantId === context.tenantId &&
    snapshot.storefrontProjectId === context.storefrontProjectId
  );
}

export function assertAuthoritativeDraftSavePreconditions(
  request: z.infer<typeof saveStorefrontDraftRequestSchema>,
  currentDraft: AuthoritativeStorefrontSnapshot | null,
  currentProjectRevision: string,
): void {
  if (request.expectedProjectRevision !== currentProjectRevision) {
    throw new VeskoIntegrationError("staleProjectRevision");
  }
  if (request.expectedCurrentDraft === null) {
    if (currentDraft !== null) throw new VeskoIntegrationError("draftRevisionConflict");
    return;
  }
  if (currentDraft !== null && !belongsToContext(currentDraft, request.context)) {
    throw new VeskoIntegrationError("tenantMismatch");
  }
  if (
    currentDraft === null ||
    !matchesSnapshotExpectation(request.expectedCurrentDraft, currentDraft)
  ) {
    throw new VeskoIntegrationError("draftRevisionConflict");
  }
}

export function assertAuthoritativeRestorePreconditions(
  request: z.infer<typeof restoreStorefrontHistoryRequestSchema>,
  currentDraft: AuthoritativeStorefrontSnapshot | null,
  target: ImmutableHistoryTarget | null,
  currentProjectRevision: string,
): void {
  if (request.expectedProjectRevision !== currentProjectRevision) {
    throw new VeskoIntegrationError("staleProjectRevision");
  }
  if (
    currentDraft === null ||
    !matchesSnapshotExpectation(request.expectedCurrentDraft, currentDraft)
  ) {
    throw new VeskoIntegrationError("draftRevisionConflict");
  }
  if (!belongsToContext(currentDraft, request.context)) {
    throw new VeskoIntegrationError("tenantMismatch");
  }
  if (target === null || target.id !== request.target.id) {
    throw new VeskoIntegrationError("historyTargetUnavailable");
  }
  if (!belongsToContext(target, request.context)) {
    throw new VeskoIntegrationError("tenantMismatch");
  }
  if (target.revision !== request.target.revision) {
    throw new VeskoIntegrationError("staleHistoryTarget");
  }
  if (target.contentFingerprint !== request.target.contentFingerprint) {
    throw new VeskoIntegrationError("historyTargetFingerprintMismatch");
  }
}

export function assertAuthoritativePublishPreconditions(
  request: z.infer<typeof publishStorefrontRequestSchema>,
  savedDraft: AuthoritativeStorefrontSnapshot | null,
  published: AuthoritativeStorefrontSnapshot | null,
  currentProjectRevision: string,
  currentPublishPreparationId: string | null,
): void {
  if (request.expectedProjectRevision !== currentProjectRevision) {
    throw new VeskoIntegrationError("staleProjectRevision");
  }
  if (savedDraft === null || !matchesSnapshotExpectation(request.expectedSavedDraft, savedDraft)) {
    throw new VeskoIntegrationError("savedDraftMismatch");
  }
  if (published === null || !matchesSnapshotExpectation(request.expectedPublished, published)) {
    throw new VeskoIntegrationError("publishedStateConflict");
  }
  if (
    !belongsToContext(savedDraft, request.context) ||
    !belongsToContext(published, request.context)
  ) {
    throw new VeskoIntegrationError("tenantMismatch");
  }
  if (currentPublishPreparationId !== request.publishPreparationId) {
    throw new VeskoIntegrationError("stalePublishConfirmation");
  }
}

export interface MerchantProjectContextPort {
  load(context: {
    tenantId: string;
    storefrontProjectId: string;
  }): Promise<z.infer<typeof merchantProjectContextSchema>>;
}
export interface CatalogueProjectionPort {
  load(context: {
    tenantId: string;
    storeId: string;
    storefrontProjectId: string;
    expectedRevision?: string;
  }): Promise<z.infer<typeof catalogueProjectionSchema>>;
}
export interface AvailabilityOptionMediaProjectionPort {
  load(context: {
    tenantId: string;
    storeId: string;
    storefrontProjectId: string;
    productId: string;
    expectedRevision?: string;
  }): Promise<z.infer<typeof availabilityOptionMediaProjectionSchema>>;
}
export interface StorefrontDraftPersistencePort {
  load(context: {
    tenantId: string;
    storefrontProjectId: string;
  }): Promise<z.infer<typeof storefrontDraftSchema> | null>;
  save(
    request: z.infer<typeof saveStorefrontDraftRequestSchema>,
  ): Promise<z.infer<typeof storefrontDraftSchema>>;
  restore(
    request: z.infer<typeof restoreStorefrontHistoryRequestSchema>,
  ): Promise<z.infer<typeof storefrontDraftSchema>>;
}
export interface StorefrontPublishingGateway {
  publish(
    request: z.infer<typeof publishStorefrontRequestSchema>,
  ): Promise<z.infer<typeof publicationResultSchema>>;
}

export type VeskoIntegrationPorts = Readonly<{
  context: MerchantProjectContextPort;
  catalogue: CatalogueProjectionPort;
  availability: AvailabilityOptionMediaProjectionPort;
  drafts: StorefrontDraftPersistencePort;
  publishing: StorefrontPublishingGateway;
  capabilities: z.infer<typeof veskoIntegrationCapabilitiesSchema>;
}>;

export function createStandaloneVeskoIntegrationBoundary(
  ports: VeskoIntegrationPorts,
): VeskoIntegrationPorts {
  return ports;
}

export type StorefrontDraft = z.infer<typeof storefrontDraftSchema>;
export type MerchantProjectContext = z.infer<typeof merchantProjectContextSchema>;
export type CatalogueProjection = z.infer<typeof catalogueProjectionSchema>;
export type AvailabilityOptionMediaProjection = z.infer<
  typeof availabilityOptionMediaProjectionSchema
>;
export type PublicationResult = z.infer<typeof publicationResultSchema>;
export type StorefrontPresentationSnapshot = StorefrontSnapshot;
