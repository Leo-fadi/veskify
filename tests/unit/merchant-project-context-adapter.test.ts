import { describe, expect, it, vi } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import {
  MerchantProjectContextTransportFailure,
  createMerchantProjectContextPort,
  createStandaloneMerchantProjectContextPort,
  type MerchantProjectContextPort,
  type MerchantProjectContextTransport,
  type MerchantProjectContext,
  type MerchantProjectContextLookup,
} from "@/application/merchant-project-context";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import type { ProjectSummary } from "@/services/storage/project-repository";
import { InMemoryProjectRepository } from "@/services/storage/in-memory-project-repository";

const lookup: MerchantProjectContextLookup = {
  tenantId: "tenant_external",
  storefrontProjectId: aurumNordicSeed.project.id,
};

const allPermissions = [
  "view-storefront",
  "edit-storefront-draft",
  "request-ai-design",
  "accept-design-proposal",
  "publish-storefront",
] as const;
type MerchantProjectContextPermission = (typeof allPermissions)[number];

function createAurumRepository(): InMemoryProjectRepository {
  return new InMemoryProjectRepository([
    {
      project: aurumNordicSeed.project,
      catalogue: aurumNordicSeed.catalogue,
      snapshots: [aurumNordicSeed.publishedSnapshot, aurumNordicSeed.draftSnapshot],
    },
  ]);
}

function baseContext(overrides?: Partial<MerchantProjectContext>): MerchantProjectContext {
  return {
    userId: "user_external",
    tenantId: lookup.tenantId,
    merchantId: "merchant_external",
    organizationId: "organization_external",
    storeId: "store_external",
    storefrontProjectId: aurumNordicSeed.project.id,
    roles: ["owner"],
    permissions: [...allPermissions],
    primaryLocale: aurumNordicSeed.project.primaryLocale,
    enabledLocales: aurumNordicSeed.project.enabledLocales,
    market: aurumNordicSeed.project.businessProfile.market,
    projectRevision: String(aurumNordicSeed.project.revision),
    ...overrides,
  };
}

async function resolveContext(
  adapter: Pick<MerchantProjectContextPort, "resolve">,
  input: MerchantProjectContextLookup,
) {
  return adapter.resolve(input);
}

async function resolveContextWithPermission(
  adapter: Pick<MerchantProjectContextPort, "resolveWithPermission">,
  input: MerchantProjectContextLookup,
  permission: MerchantProjectContextPermission,
) {
  return adapter.resolveWithPermission(input, permission);
}

async function loadProject(projectRepository: Pick<ProjectRepository, "get">, projectId: string) {
  return projectRepository.get(projectId);
}

function createTransport(context: unknown): MerchantProjectContextTransport {
  return {
    fetchContext: vi.fn(() => Promise.resolve(context)),
  };
}

function createStaleRepository(aggregate: ProjectAggregate): ProjectRepository {
  return {
    list: async () => {
      await Promise.resolve();
      return [] as ProjectSummary[];
    },
    get: async () => {
      await Promise.resolve();
      return {
        ...aggregate,
        project: { ...aggregate.project, revision: 0 },
      };
    },
    create: async () => {
      await Promise.resolve();
      throw new Error("not expected");
    },
    saveDraft: async () => {
      await Promise.resolve();
      throw new Error("not expected");
    },
    publish: async () => {
      await Promise.resolve();
      throw new Error("not expected");
    },
    restore: async () => {
      await Promise.resolve();
      throw new Error("not expected");
    },
  };
}

describe("P9-02 merchant project context adapter", () => {
  it("resolves a valid transport context", async () => {
    const repository = createAurumRepository();
    const transport = createTransport(baseContext());

    const adapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport,
      projectRepository: repository,
    });

    const context = await resolveContext(adapter, lookup);

    expect(context).toMatchObject({
      tenantId: lookup.tenantId,
      storefrontProjectId: lookup.storefrontProjectId,
      projectRevision: String(aurumNordicSeed.project.revision),
      permissions: allPermissions,
    });
  });

  it("rejects tenant mismatch", async () => {
    const repository = createAurumRepository();
    const transport = createTransport(baseContext({ tenantId: "tenant_other" }));
    const adapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport,
      projectRepository: repository,
    });

    await expect(resolveContext(adapter, lookup)).rejects.toMatchObject({
      code: "tenantMismatch",
    });
  });

  it("rejects unknown storefront projects", async () => {
    const repository = createAurumRepository();
    const transport = createTransport(
      baseContext({ storefrontProjectId: "project_unknown_storefront" }),
    );
    const adapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport,
      projectRepository: repository,
    });

    await expect(resolveContext(adapter, lookup)).rejects.toMatchObject({
      code: "projectNotFound",
    });
  });

  it("enforces permission requirements", async () => {
    const repository = createAurumRepository();
    const transport = createTransport(
      baseContext({ permissions: ["view-storefront", "edit-storefront-draft"] }),
    );
    const adapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport,
      projectRepository: repository,
    });

    await expect(
      resolveContextWithPermission(adapter, lookup, "publish-storefront"),
    ).rejects.toMatchObject({
      code: "permissionDenied",
    });
  });

  it("maps P9-01 canonical permissions to legacy merchant-project permissions", async () => {
    const repository = createAurumRepository();
    const transport = createTransport({
      ...baseContext(),
      permissions: ["readStorefront", "saveDraft", "restoreDraft", "publishStorefront"],
    } as const);
    const adapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport,
      projectRepository: repository,
    });

    const context = await resolveContext(adapter, lookup);

    expect(context.permissions).toEqual(
      expect.arrayContaining([
        "view-storefront",
        "edit-storefront-draft",
        "request-ai-design",
        "accept-design-proposal",
        "publish-storefront",
      ]),
    );
  });

  it("rejects stale project revision", async () => {
    const projectRepository = createAurumRepository();
    const staleAggregate = await loadProject(projectRepository, lookup.storefrontProjectId);
    const staleRepository = createStaleRepository(staleAggregate);
    const transport = createTransport(baseContext());
    const adapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport,
      projectRepository: staleRepository,
    });

    await expect(resolveContext(adapter, lookup)).rejects.toMatchObject({
      code: "staleProjectRevision",
    });
  });

  it("maps transport failures to typed context failures", async () => {
    const repository = createAurumRepository();

    const transportFailure: MerchantProjectContextTransport = {
      fetchContext: () => {
        return Promise.reject(
          new MerchantProjectContextTransportFailure("permissionDenied", "not granted"),
        );
      },
    };
    const transportMalformed: MerchantProjectContextTransport = {
      fetchContext: () => Promise.resolve({ unexpected: true }),
    };

    const permissionAdapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport: transportFailure,
      projectRepository: repository,
    });
    const malformedAdapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport: transportMalformed,
      projectRepository: repository,
    });

    await expect(resolveContext(permissionAdapter, lookup)).rejects.toMatchObject({
      code: "permissionDenied",
    });

    await expect(resolveContext(malformedAdapter, lookup)).rejects.toMatchObject({
      code: "malformedIntegrationResponse",
    });
  });

  it("supports a standalone adapter without transport credentials", async () => {
    const repository = createAurumRepository();
    const adapter = createStandaloneMerchantProjectContextPort({
      projectRepository: repository,
      tenantId: "tenant_standalone",
      userId: "user_standalone",
      merchantId: "merchant_standalone",
      organizationId: "organization_standalone",
      storeId: "store_standalone",
    });

    const context = await resolveContext(adapter, {
      tenantId: "tenant_standalone",
      storefrontProjectId: aurumNordicSeed.project.id,
    });

    expect(context).toMatchObject({
      tenantId: "tenant_standalone",
      userId: "user_standalone",
      merchantId: "merchant_standalone",
      organizationId: "organization_standalone",
      storeId: "store_standalone",
    });
    expect(context.projectRevision).toBe(String(aurumNordicSeed.project.revision));
    expect(context.permissions).toEqual(allPermissions);
    expect("accessToken" in context).toBe(false);
  });

  it("does not mutate storefront state during context resolution", async () => {
    const projectRepository = createAurumRepository();
    const before = await loadProject(projectRepository, lookup.storefrontProjectId);
    const transport = createTransport(baseContext());

    const adapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport,
      projectRepository,
    });

    await resolveContext(adapter, lookup);
    const after = await loadProject(projectRepository, lookup.storefrontProjectId);

    expect(before.project).toEqual(after.project);
    expect(before.catalogue).toEqual(after.catalogue);
    expect(before.snapshots).toEqual(after.snapshots);
  });
});
