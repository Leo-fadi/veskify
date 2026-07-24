import { z } from "zod";
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

export const storefrontNavigationReferenceSchema = z
  .object({
    navigationId: idSchema,
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("collection"), collectionId: idSchema }).strict(),
      z.object({ kind: z.literal("category"), categoryId: categoryIdSchema }).strict(),
      z.object({ kind: z.literal("page"), pageId: idSchema }).strict(),
    ]),
  })
  .strict();

export const catalogueProjectionSchema = z
  .object({
    tenantId: tenantIdSchema,
    storeId: storeIdSchema,
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
    if (productIds.size !== value.products.length) {
      context.addIssue({
        code: "custom",
        path: ["products"],
        message: "Product IDs must be unique.",
      });
    }
    value.collections.forEach((collection, index) => {
      collection.productIds.forEach((productId, productIndex) => {
        if (!productIds.has(productId)) {
          context.addIssue({
            code: "custom",
            path: ["collections", index, "productIds", productIndex],
            message: "Collection membership must use canonical product IDs.",
          });
        }
      });
    });
  });

export const availabilityOptionMediaProjectionSchema = z
  .object({
    tenantId: tenantIdSchema,
    storeId: storeIdSchema,
    productId: idSchema,
    revision: integrationRevisionSchema,
    availability: z.enum(["inStock", "lowStock", "outOfStock", "unavailable"]),
    stockDisplay: z.enum(["show", "limited", "hide"]),
    attributes: z.array(
      z
        .object({ attributeId: idSchema, label: localizedTextSchema, value: localizedTextSchema })
        .strict(),
    ),
    optionGroups: z.array(
      z
        .object({
          optionGroupId: idSchema,
          label: localizedTextSchema,
          required: z.boolean(),
          valueIds: z.array(idSchema),
        })
        .strict(),
    ),
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
    media: z.array(
      z
        .object({
          mediaId: idSchema,
          role: z.enum(["main", "alternative", "editorial"]),
          alt: localizedTextSchema.optional(),
        })
        .strict(),
    ),
  })
  .strict();

const draftIdentitySchema = z
  .object({
    tenantId: tenantIdSchema,
    storefrontProjectId: idSchema,
    revision: integrationRevisionSchema,
  })
  .strict();

export const storefrontDraftSchema = draftIdentitySchema
  .extend({ snapshot: storefrontSnapshotSchema, fingerprint: z.string().trim().min(1).max(200) })
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
    expectedRevision: integrationRevisionSchema,
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
    if (value.expectedRevision !== value.context.projectRevision) {
      context.addIssue({
        code: "custom",
        path: ["expectedRevision"],
        message: "Draft saves require the current project revision.",
      });
    }
  });

export const publishStorefrontRequestSchema = z
  .object({
    context: merchantProjectContextSchema,
    expectedDraftRevision: integrationRevisionSchema,
    requestId: idSchema,
    snapshot: storefrontSnapshotSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.snapshot.projectId !== value.context.storefrontProjectId) {
      context.addIssue({
        code: "custom",
        path: ["snapshot", "projectId"],
        message: "Published snapshot must belong to the storefront project.",
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
    if ((value.status === "rejected") !== (value.rejection !== undefined))
      context.addIssue({
        code: "custom",
        path: ["rejection"],
        message: "Publication rejection must match its status.",
      });
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
    expectedRevision?: string;
  }): Promise<z.infer<typeof catalogueProjectionSchema>>;
}
export interface AvailabilityOptionMediaProjectionPort {
  load(context: {
    tenantId: string;
    storeId: string;
    productId: string;
    expectedRevision?: string;
  }): Promise<z.infer<typeof availabilityOptionMediaProjectionSchema>>;
}
export interface StorefrontDraftPersistencePort {
  load(context: {
    tenantId: string;
    storefrontProjectId: string;
  }): Promise<z.infer<typeof storefrontDraftSchema>>;
  save(
    request: z.infer<typeof saveStorefrontDraftRequestSchema>,
  ): Promise<z.infer<typeof storefrontDraftSchema>>;
  restore(
    request: z.infer<typeof saveStorefrontDraftRequestSchema>,
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
