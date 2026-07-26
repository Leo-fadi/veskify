import {
  type MerchantProjectAuthorization,
  type MerchantProjectContext,
  type MerchantProjectContextAction,
  type MerchantProjectContextLookup,
  type MerchantProjectContextPort,
  type MerchantProjectContextTransport,
  type MerchantProjectPermission,
  type MerchantProjectRole,
  MerchantProjectContextTransportFailure,
  merchantProjectAuthorizationSchema,
  merchantProjectContextLookupSchema,
  merchantProjectContextSchema,
  merchantProjectContextTransportFailureCodeSchema,
  storefrontPermissionSchema,
  storefrontRoleSchema,
  toStandaloneProjectRevision,
} from "@/application/merchant-project-context/contract";
import { VeskoIntegrationError } from "@/application/vesko-integration/contract";
import { ProjectNotFoundError, type ProjectRepository } from "@/services/storage";

const actionPermissions: Readonly<
  Record<MerchantProjectContextAction, readonly MerchantProjectPermission[]>
> = {
  "view-storefront": ["readStorefront"],
  "edit-storefront-draft": ["saveDraft"],
  // Draft authority is the narrowly scoped P9-01 authority for creating or accepting a design.
  "request-ai-design": ["saveDraft"],
  "accept-design-proposal": ["saveDraft"],
  "publish-storefront": ["publishStorefront"],
  "restore-storefront-draft": ["restoreDraft"],
};

const defaultStandaloneRoles = ["owner"] as const;
const defaultStandalonePermissions = [
  "readStorefront",
  "saveDraft",
  "restoreDraft",
  "publishStorefront",
] as const;

type StandaloneAdapterInput = {
  projectRepository: ProjectRepository;
  tenantId: string;
  userId: string;
  merchantId: string;
  organizationId: string;
  storeId: string;
  roles?: readonly MerchantProjectRole[];
  permissions?: readonly MerchantProjectPermission[];
};

function parseLookup(input: unknown): MerchantProjectContextLookup {
  const parsed = merchantProjectContextLookupSchema.safeParse(input);
  if (!parsed.success) throw new VeskoIntegrationError("malformedIntegrationResponse");
  return parsed.data;
}

function parseContext(input: unknown): MerchantProjectContext {
  const parsed = merchantProjectContextSchema.safeParse(input);
  if (!parsed.success) throw new VeskoIntegrationError("malformedIntegrationResponse");
  return parsed.data;
}

function mapTransportFailure(error: unknown): VeskoIntegrationError {
  if (error instanceof VeskoIntegrationError) return error;

  if (error instanceof MerchantProjectContextTransportFailure) {
    const code = merchantProjectContextTransportFailureCodeSchema.parse(error.code);
    const mappedCode = {
      unauthorized: "authenticationUnavailable",
      tenantMismatch: "tenantMismatch",
      projectNotFound: "projectNotFound",
      merchantNotFound: "merchantNotFound",
      permissionDenied: "permissionDenied",
      unavailable: "authenticationUnavailable",
      malformedResponse: "malformedIntegrationResponse",
    } as const;
    return new VeskoIntegrationError(mappedCode[code]);
  }

  return new VeskoIntegrationError("authenticationUnavailable");
}

function actionsFor(context: MerchantProjectContext): MerchantProjectContextAction[] {
  return (
    Object.entries(actionPermissions) as [
      MerchantProjectContextAction,
      readonly MerchantProjectPermission[],
    ][]
  )
    .filter(([, requiredPermissions]) =>
      requiredPermissions.every((permission) => context.permissions.includes(permission)),
    )
    .map(([action]) => action);
}

/**
 * Derives Storefront Studio actions from a loaded P9-01 context without
 * changing the integration-port result contract.
 */
export function createMerchantProjectAuthorization(
  contextInput: unknown,
): MerchantProjectAuthorization {
  const context = parseContext(contextInput);
  return merchantProjectAuthorizationSchema.parse({ context, actions: actionsFor(context) });
}

/** Enforces one explicitly named Studio action after canonical context loading. */
export function requireMerchantProjectAction(
  authorization: MerchantProjectAuthorization,
  action: MerchantProjectContextAction,
): MerchantProjectContext {
  const parsedAuthorization = merchantProjectAuthorizationSchema.parse(authorization);
  if (!parsedAuthorization.actions.includes(action)) {
    throw new VeskoIntegrationError("permissionDenied");
  }
  return parsedAuthorization.context;
}

/**
 * Validates a standalone context at a local repository boundary using the same
 * opaque mapping used when that context was created.
 */
export function assertCurrentStandaloneProjectRevision(
  contextInput: unknown,
  currentRevision: number,
): void {
  const context = parseContext(contextInput);
  if (context.projectRevision !== toStandaloneProjectRevision(currentRevision)) {
    throw new VeskoIntegrationError("staleProjectRevision");
  }
}

export function createMerchantProjectContextPort({
  transport,
}: {
  transport: MerchantProjectContextTransport;
}): MerchantProjectContextPort {
  return {
    async load(input) {
      const lookup = parseLookup(input);
      let context: MerchantProjectContext;

      try {
        context = parseContext(await transport.fetchContext(lookup));
      } catch (error) {
        throw mapTransportFailure(error);
      }

      if (context.tenantId !== lookup.tenantId) {
        throw new VeskoIntegrationError("tenantMismatch");
      }
      if (context.storefrontProjectId !== lookup.storefrontProjectId) {
        throw new VeskoIntegrationError("projectNotFound");
      }

      // P9-01 integration revisions are opaque and are validated by the source
      // that issued them. Do not compare them with the standalone numeric counter.
      return context;
    },
  };
}

export function createStandaloneMerchantProjectContextPort({
  projectRepository,
  tenantId,
  userId,
  merchantId,
  organizationId,
  storeId,
  roles = defaultStandaloneRoles,
  permissions = defaultStandalonePermissions,
}: StandaloneAdapterInput): MerchantProjectContextPort {
  const validatedRoles = storefrontRoleSchema.array().parse([...roles]);
  const validatedPermissions = storefrontPermissionSchema.array().parse([...permissions]);

  return {
    async load(input) {
      const lookup = parseLookup(input);
      if (lookup.tenantId !== tenantId) throw new VeskoIntegrationError("tenantMismatch");

      try {
        const aggregate = await projectRepository.get(lookup.storefrontProjectId);
        return parseContext({
          userId,
          tenantId,
          merchantId,
          organizationId,
          storeId,
          storefrontProjectId: aggregate.project.id,
          roles: validatedRoles,
          permissions: validatedPermissions,
          primaryLocale: aggregate.project.primaryLocale,
          enabledLocales: aggregate.project.enabledLocales,
          market: aggregate.project.businessProfile.market,
          projectRevision: toStandaloneProjectRevision(aggregate.project.revision),
        });
      } catch (error) {
        if (error instanceof VeskoIntegrationError) throw error;
        if (error instanceof ProjectNotFoundError) {
          throw new VeskoIntegrationError("projectNotFound");
        }
        throw new VeskoIntegrationError("authenticationUnavailable");
      }
    },
  };
}
