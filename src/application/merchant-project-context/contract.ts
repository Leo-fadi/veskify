import { z } from "zod";
import {
  merchantProjectContextSchema,
  merchantIdSchema,
  organizationIdSchema,
  storeIdSchema,
  storefrontPermissionSchema,
  storefrontRoleSchema,
  tenantIdSchema,
  userIdSchema,
  type VeskoIntegrationPorts,
} from "@/application/vesko-integration/contract";
import { idSchema } from "@/domain/shared";

export {
  merchantProjectContextSchema,
  merchantIdSchema,
  organizationIdSchema,
  storeIdSchema,
  storefrontPermissionSchema,
  storefrontRoleSchema,
  tenantIdSchema,
  userIdSchema,
};

/** The canonical P9-01 context-port request shape. */
export const merchantProjectContextLookupSchema = z
  .object({
    tenantId: tenantIdSchema,
    storefrontProjectId: idSchema,
  })
  .strict();

export const merchantProjectContextActionSchema = z.enum([
  "view-storefront",
  "edit-storefront-draft",
  "request-ai-design",
  "accept-design-proposal",
  "publish-storefront",
  "restore-storefront-draft",
]);

export const merchantProjectAuthorizationSchema = z
  .object({
    context: merchantProjectContextSchema,
    actions: z.array(merchantProjectContextActionSchema),
  })
  .strict()
  .superRefine((value, refinement) => {
    if (new Set(value.actions).size !== value.actions.length) {
      refinement.addIssue({
        code: "custom",
        path: ["actions"],
        message: "Merchant project actions must be unique.",
      });
    }
  });

export type MerchantProjectContextLookup = z.infer<typeof merchantProjectContextLookupSchema>;
export type MerchantProjectContext = z.infer<typeof merchantProjectContextSchema>;
export type MerchantProjectRole = z.infer<typeof storefrontRoleSchema>;
export type MerchantProjectPermission = z.infer<typeof storefrontPermissionSchema>;
export type MerchantProjectContextAction = z.infer<typeof merchantProjectContextActionSchema>;
export type MerchantProjectAuthorization = z.infer<typeof merchantProjectAuthorizationSchema>;

/**
 * Low-level injected client failure. The adapter maps this to P9-01's
 * merchant-safe VeskoIntegrationError taxonomy before exposing it to callers.
 */
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

/** An injected client boundary; it deliberately assumes no Vesko HTTP endpoint. */
export interface MerchantProjectContextTransport {
  fetchContext(input: MerchantProjectContextLookup): Promise<unknown>;
}

/** The P9-01 canonical port; it intentionally exposes only load(...). */
export type MerchantProjectContextPort = VeskoIntegrationPorts["context"];

export const standaloneProjectRevisionPrefix = "standalone-project-revision-";

/** Converts the local numeric repository revision into P9-01's opaque revision. */
export function toStandaloneProjectRevision(revision: number): string {
  return `${standaloneProjectRevisionPrefix}${revision}`;
}
