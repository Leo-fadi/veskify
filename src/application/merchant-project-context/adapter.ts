import {
  type MerchantProjectContext,
  type MerchantProjectContextLookup,
  type MerchantProjectContextPort,
  type MerchantProjectContextTransport,
  type MerchantProjectPermission,
  type MerchantProjectRole,
  type MerchantProjectContextTransportFailureCode,
  type MerchantProjectContextFailureCode,
  merchantProjectContextLookupSchema,
  merchantProjectContextSchema,
  MerchantProjectContextFailure,
  MerchantProjectContextTransportFailure,
  merchantProjectContextTransportFailureCodeSchema,
} from "@/application/merchant-project-context/contract";
import {
  merchantProjectContextSchema as veskoMerchantProjectContextSchema,
  type storefrontPermissionSchema,
} from "@/application/vesko-integration/contract";
import { ProjectNotFoundError, type ProjectRepository } from "@/services/storage";
import { storefrontRoleSchema } from "./contract";

const canonicalPermissionToLegacyMap: Record<
  keyof typeof storefrontPermissionSchema.enum,
  readonly MerchantProjectPermission[]
> = {
  readStorefront: ["view-storefront"],
  saveDraft: ["edit-storefront-draft", "request-ai-design", "accept-design-proposal"],
  restoreDraft: ["request-ai-design"],
  publishStorefront: ["publish-storefront"],
};

const defaultStandaloneRoles = ["owner"] as const;
const defaultStandalonePermissions = [
  "view-storefront",
  "edit-storefront-draft",
  "request-ai-design",
  "accept-design-proposal",
  "publish-storefront",
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

function parseLookup(input: MerchantProjectContextLookup): MerchantProjectContextLookup {
  return merchantProjectContextLookupSchema.parse(input);
}

function parseContext(input: unknown): MerchantProjectContext {
  try {
    const canonicalContext = veskoMerchantProjectContextSchema.parse(input);
    return merchantProjectContextSchema.parse({
      ...canonicalContext,
      permissions: [
        ...new Set(
          canonicalContext.permissions.flatMap(
            (permission) => canonicalPermissionToLegacyMap[permission],
          ),
        ),
      ],
    });
  } catch {
    try {
      return merchantProjectContextSchema.parse(input);
    } catch {
      throw new MerchantProjectContextFailure("malformedIntegrationResponse");
    }
  }
}

function mapTransportFailure(error: unknown): MerchantProjectContextFailure {
  if (error instanceof MerchantProjectContextFailure) {
    return error;
  }

  if (error instanceof MerchantProjectContextTransportFailure) {
    const mappedCode: Record<
      MerchantProjectContextTransportFailureCode,
      MerchantProjectContextFailureCode
    > = {
      unauthorized: "authenticationUnavailable",
      tenantMismatch: "tenantMismatch",
      projectNotFound: "projectNotFound",
      merchantNotFound: "merchantNotFound",
      permissionDenied: "permissionDenied",
      unavailable: "authenticationUnavailable",
      malformedResponse: "malformedIntegrationResponse",
    };

    const code = merchantProjectContextTransportFailureCodeSchema.parse(error.code);
    return new MerchantProjectContextFailure(mappedCode[code]);
  }

  return new MerchantProjectContextFailure("authenticationUnavailable");
}

function assertPermission(
  context: MerchantProjectContext,
  permission: MerchantProjectPermission,
): void {
  if (!context.permissions.includes(permission)) {
    throw new MerchantProjectContextFailure("permissionDenied");
  }
}

async function resolveTransportContext(
  transport: MerchantProjectContextTransport,
  lookup: MerchantProjectContextLookup,
  projectRepository: ProjectRepository,
): Promise<MerchantProjectContext> {
  let context: MerchantProjectContext;

  try {
    context = parseContext(await transport.fetchContext(lookup));
  } catch (error) {
    throw mapTransportFailure(error);
  }

  if (context.tenantId !== lookup.tenantId) {
    throw new MerchantProjectContextFailure("tenantMismatch");
  }

  if (context.storefrontProjectId !== lookup.storefrontProjectId) {
    throw new MerchantProjectContextFailure("projectNotFound");
  }

  try {
    const aggregate = await projectRepository.get(context.storefrontProjectId);
    if (String(aggregate.project.revision) !== context.projectRevision) {
      throw new MerchantProjectContextFailure("staleProjectRevision");
    }
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      throw new MerchantProjectContextFailure("projectNotFound");
    }
    if (error instanceof MerchantProjectContextFailure) {
      throw error;
    }
    throw new MerchantProjectContextFailure("authenticationUnavailable");
  }

  return context;
}

export function createMerchantProjectContextPort({
  transport,
  projectRepository,
}: {
  transport: MerchantProjectContextTransport;
  projectRepository: ProjectRepository;
}): MerchantProjectContextPort {
  return {
    resolve(input) {
      const lookup = parseLookup(input);
      return resolveTransportContext(transport, lookup, projectRepository);
    },

    async resolveWithPermission(input, permission) {
      const lookup = parseLookup(input);
      const context = await resolveTransportContext(transport, lookup, projectRepository);
      assertPermission(context, permission);
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
  const validatedPermissions = merchantProjectContextSchema.shape.permissions.parse([
    ...permissions,
  ]);

  async function resolveStandalone(
    input: MerchantProjectContextLookup,
  ): Promise<MerchantProjectContext> {
    const lookup = parseLookup(input);
    if (lookup.tenantId !== tenantId) {
      throw new MerchantProjectContextFailure("tenantMismatch");
    }

    const aggregate = await projectRepository.get(lookup.storefrontProjectId);

    return merchantProjectContextSchema.parse({
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
      projectRevision: String(aggregate.project.revision),
    });
  }

  return {
    resolve: resolveStandalone,

    async resolveWithPermission(input, permission) {
      const context = await resolveStandalone(input);
      assertPermission(context, permission);
      return context;
    },
  };
}
