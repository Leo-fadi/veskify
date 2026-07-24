import { z } from "zod";

import { idSchema, localeSchema } from "@/domain/shared";

export const tenantIdSchema = idSchema;
export const merchantIdSchema = idSchema;
export const organizationIdSchema = idSchema;
export const userIdSchema = idSchema;
export const storeIdSchema = idSchema;

export const storefrontRoleSchema = z.enum(["owner", "admin", "designer", "viewer"]);

export const merchantProjectPermissionSchema = z.enum([
  "view-storefront",
  "edit-storefront-draft",
  "request-ai-design",
  "accept-design-proposal",
  "publish-storefront",
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
    permissions: z.array(merchantProjectPermissionSchema),
    primaryLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1).max(3),
    market: z.string().trim().min(2).max(80),
    projectRevision: z.string().trim().min(1).max(120),
  })
  .strict()
  .superRefine((context, refinement) => {
    if (!context.enabledLocales.includes(context.primaryLocale)) {
      refinement.addIssue({
        code: "custom",
        path: ["primaryLocale"],
        message: "The primary locale must be enabled for the storefront.",
      });
    }
    if (new Set(context.roles).size !== context.roles.length) {
      refinement.addIssue({
        code: "custom",
        path: ["roles"],
        message: "Merchant project roles must be unique.",
      });
    }
    if (new Set(context.permissions).size !== context.permissions.length) {
      refinement.addIssue({
        code: "custom",
        path: ["permissions"],
        message: "Merchant permissions must be unique.",
      });
    }
  });

export const merchantProjectContextLookupSchema = z
  .object({
    tenantId: tenantIdSchema,
    storefrontProjectId: idSchema,
  })
  .strict();

export type MerchantProjectContext = z.infer<typeof merchantProjectContextSchema>;
export type MerchantProjectRole = z.infer<typeof storefrontRoleSchema>;
export type MerchantProjectPermission = z.infer<typeof merchantProjectPermissionSchema>;
export type MerchantProjectContextLookup = z.infer<typeof merchantProjectContextLookupSchema>;

export const merchantProjectContextFailureSchema = z.enum([
  "authenticationUnavailable",
  "tenantMismatch",
  "projectNotFound",
  "merchantNotFound",
  "permissionDenied",
  "staleProjectRevision",
  "malformedIntegrationResponse",
]);
export type MerchantProjectContextFailureCode = z.infer<typeof merchantProjectContextFailureSchema>;

const merchantProjectContextFailureMessage: Record<MerchantProjectContextFailureCode, string> = {
  authenticationUnavailable:
    "The Storefront Studio merchant context service is temporarily unavailable.",
  tenantMismatch: "This storefront belongs to a different tenant.",
  projectNotFound: "The storefront project could not be found.",
  merchantNotFound: "The merchant could not be found.",
  permissionDenied: "You do not have permission for this storefront action.",
  staleProjectRevision: "The storefront changed. Refresh and try again.",
  malformedIntegrationResponse:
    "The storefront context integration returned an invalid merchant context response.",
};

export class MerchantProjectContextFailure extends Error {
  constructor(readonly code: MerchantProjectContextFailureCode) {
    super(merchantProjectContextFailureMessage[code]);
    this.name = "MerchantProjectContextFailure";
  }
}

export const merchantProjectContextTransportFailureCodeSchema = z.enum([
  "unauthorized",
  "tenantMismatch",
  "projectNotFound",
  "merchantNotFound",
  "permissionDenied",
  "unavailable",
  "malformedResponse",
]);

export type MerchantProjectContextTransportFailureCode = z.infer<
  typeof merchantProjectContextTransportFailureCodeSchema
>;

export class MerchantProjectContextTransportFailure extends Error {
  constructor(
    readonly code: MerchantProjectContextTransportFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "MerchantProjectContextTransportFailure";
  }
}

export interface MerchantProjectContextTransport {
  fetchContext(input: MerchantProjectContextLookup): Promise<unknown>;
}

export interface MerchantProjectContextPort {
  resolve(input: MerchantProjectContextLookup): Promise<MerchantProjectContext>;
  resolveWithPermission(
    input: MerchantProjectContextLookup,
    permission: MerchantProjectPermission,
  ): Promise<MerchantProjectContext>;
}
