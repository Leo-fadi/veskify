import { z } from "zod";
import {
  tenantIdSchema,
  merchantIdSchema,
  organizationIdSchema,
  storeIdSchema,
  storefrontRoleSchema,
  userIdSchema,
  merchantProjectContextSchema as veskoMerchantProjectContextSchema,
} from "@/application/vesko-integration/contract";

export {
  tenantIdSchema,
  merchantIdSchema,
  organizationIdSchema,
  storeIdSchema,
  userIdSchema,
  storefrontRoleSchema,
};

export const merchantProjectPermissionSchema = z.enum([
  "view-storefront",
  "edit-storefront-draft",
  "request-ai-design",
  "accept-design-proposal",
  "publish-storefront",
]);

export const merchantProjectContextSchema = veskoMerchantProjectContextSchema
  .extend({
    permissions: z.array(merchantProjectPermissionSchema),
  })
  .superRefine((context, refinement) => {
    if (new Set(context.permissions).size !== context.permissions.length) {
      refinement.addIssue({
        code: "custom",
        path: ["permissions"],
        message: "Merchant project permissions must be unique.",
      });
    }
  });

export const merchantProjectContextLookupSchema = veskoMerchantProjectContextSchema.pick({
  tenantId: true,
  storefrontProjectId: true,
});

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
