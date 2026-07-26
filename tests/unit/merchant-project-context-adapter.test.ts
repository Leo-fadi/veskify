import { describe, expect, it, vi } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import {
  MerchantProjectContextTransportFailure,
  assertCurrentStandaloneProjectRevision,
  createMerchantProjectAuthorization,
  createMerchantProjectContextPort,
  createStandaloneMerchantProjectContextPort,
  requireMerchantProjectAction,
  toStandaloneProjectRevision,
  type MerchantProjectContext,
  type MerchantProjectContextLookup,
  type MerchantProjectContextPort,
  type MerchantProjectContextTransport,
} from "@/application/merchant-project-context";
import type { ProjectRepository } from "@/services/storage";
import { InMemoryProjectRepository } from "@/services/storage/in-memory-project-repository";

const lookup: MerchantProjectContextLookup = {
  tenantId: "tenant_external",
  storefrontProjectId: aurumNordicSeed.project.id,
};

const canonicalPermissions = [
  "readStorefront",
  "saveDraft",
  "restoreDraft",
  "publishStorefront",
] as const;

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
    permissions: [...canonicalPermissions],
    primaryLocale: aurumNordicSeed.project.primaryLocale,
    enabledLocales: aurumNordicSeed.project.enabledLocales,
    market: aurumNordicSeed.project.businessProfile.market,
    projectRevision: "project-revision-1",
    ...overrides,
  };
}

function createTransport(context: unknown): MerchantProjectContextTransport {
  return { fetchContext: vi.fn(() => Promise.resolve(context)) };
}

describe("P9-02 merchant project context adapter", () => {
  it("imports without evaluating a refined-schema extension", async () => {
    await expect(import("@/application/merchant-project-context")).resolves.toBeDefined();
  });

  it("implements the canonical P9-01 load port and preserves opaque transport revisions", async () => {
    const adapter: MerchantProjectContextPort = createMerchantProjectContextPort({
      transport: createTransport(baseContext()),
    });

    const context = await adapter.load(lookup);

    expect(context).toMatchObject({
      tenantId: lookup.tenantId,
      storefrontProjectId: lookup.storefrontProjectId,
      projectRevision: "project-revision-1",
      permissions: canonicalPermissions,
    });
  });

  it("rejects tenant and project mismatches before exposing a context", async () => {
    const tenantMismatch = createMerchantProjectContextPort({
      transport: createTransport(baseContext({ tenantId: "tenant_other" })),
    });
    const projectMismatch = createMerchantProjectContextPort({
      transport: createTransport(baseContext({ storefrontProjectId: "project_other" })),
    });

    await expect(tenantMismatch.load(lookup)).rejects.toMatchObject({ code: "tenantMismatch" });
    await expect(projectMismatch.load(lookup)).rejects.toMatchObject({ code: "projectNotFound" });
  });

  it("keeps restore-only authority least-privileged while valid draft authority enables design actions", () => {
    const restoreOnly = createMerchantProjectAuthorization(
      baseContext({ permissions: ["restoreDraft"] }),
    );
    const draftEditor = createMerchantProjectAuthorization(
      baseContext({ permissions: ["readStorefront", "saveDraft"] }),
    );

    expect(restoreOnly.actions).toEqual(["restore-storefront-draft"]);
    expect(() => requireMerchantProjectAction(restoreOnly, "request-ai-design")).toThrow(
      expect.objectContaining({ code: "permissionDenied" }),
    );
    expect(() => requireMerchantProjectAction(restoreOnly, "accept-design-proposal")).toThrow(
      expect.objectContaining({ code: "permissionDenied" }),
    );
    expect(() => requireMerchantProjectAction(restoreOnly, "edit-storefront-draft")).toThrow(
      expect.objectContaining({ code: "permissionDenied" }),
    );
    expect(requireMerchantProjectAction(draftEditor, "request-ai-design")).toStrictEqual(
      draftEditor.context,
    );
    expect(requireMerchantProjectAction(draftEditor, "accept-design-proposal")).toStrictEqual(
      draftEditor.context,
    );
  });

  it("maps typed and malformed transport failures into the P9-01 taxonomy", async () => {
    const deniedAdapter = createMerchantProjectContextPort({
      transport: {
        fetchContext: () =>
          Promise.reject(
            new MerchantProjectContextTransportFailure("permissionDenied", "not granted"),
          ),
      },
    });
    const malformedAdapter = createMerchantProjectContextPort({
      transport: createTransport({ unexpected: true }),
    });

    await expect(deniedAdapter.load(lookup)).rejects.toMatchObject({ code: "permissionDenied" });
    await expect(malformedAdapter.load(lookup)).rejects.toMatchObject({
      code: "malformedIntegrationResponse",
    });
  });

  it("keeps the standalone adapter credential-free and normalizes missing projects", async () => {
    const adapter = createStandaloneMerchantProjectContextPort({
      projectRepository: createAurumRepository(),
      tenantId: "tenant_standalone",
      userId: "user_standalone",
      merchantId: "merchant_standalone",
      organizationId: "organization_standalone",
      storeId: "store_standalone",
    });

    const context = await adapter.load({
      tenantId: "tenant_standalone",
      storefrontProjectId: aurumNordicSeed.project.id,
    });

    expect(context.projectRevision).toBe(
      toStandaloneProjectRevision(aurumNordicSeed.project.revision),
    );
    expect("accessToken" in context).toBe(false);
    await expect(
      adapter.load({ tenantId: "tenant_standalone", storefrontProjectId: "project_missing" }),
    ).rejects.toMatchObject({ code: "projectNotFound" });
  });

  it("uses one deterministic standalone revision mapping for creation and stale validation", async () => {
    const adapter = createStandaloneMerchantProjectContextPort({
      projectRepository: createAurumRepository(),
      tenantId: "tenant_standalone",
      userId: "user_standalone",
      merchantId: "merchant_standalone",
      organizationId: "organization_standalone",
      storeId: "store_standalone",
    });
    const context = await adapter.load({
      tenantId: "tenant_standalone",
      storefrontProjectId: aurumNordicSeed.project.id,
    });

    expect(toStandaloneProjectRevision(3)).toBe("standalone-project-revision-3");
    expect(() =>
      assertCurrentStandaloneProjectRevision(context, aurumNordicSeed.project.revision + 1),
    ).toThrow(expect.objectContaining({ code: "staleProjectRevision" }));
  });

  it("does not mutate storefront or commerce state while loading context", async () => {
    const projectRepository: ProjectRepository = createAurumRepository();
    const before = await projectRepository.get(lookup.storefrontProjectId);
    const adapter = createStandaloneMerchantProjectContextPort({
      projectRepository,
      tenantId: "tenant_standalone",
      userId: "user_standalone",
      merchantId: "merchant_standalone",
      organizationId: "organization_standalone",
      storeId: "store_standalone",
    });

    await adapter.load({
      tenantId: "tenant_standalone",
      storefrontProjectId: lookup.storefrontProjectId,
    });
    const after = await projectRepository.get(lookup.storefrontProjectId);

    expect(before).toEqual(after);
  });
});
