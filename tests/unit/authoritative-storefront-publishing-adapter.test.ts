import { describe, expect, it, vi } from "vitest";
import { preparePublish, type PublishPreparation } from "@/application/publishing";
import {
  createStandaloneMerchantProjectContextPort,
  toStandaloneProjectRevision,
} from "@/application/merchant-project-context";
import {
  publishStorefrontRequestSchema,
  type MerchantProjectContext,
  type MerchantProjectContextPort,
  type StorefrontPublishingGateway,
  type VeskoIntegrationPorts,
} from "@/application/vesko-integration";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  createAuthoritativeStorefrontPublishingAdapter,
  createStandaloneAuthoritativePublishingAdapter,
  standalonePublishingRevisionMapper,
  toStandaloneSnapshotRevision,
  type AuthoritativePublishPreparationReader,
  type AuthoritativePublishingRevisionMapper,
} from "@/integrations/vesko-publishing";
import { InMemoryProjectRepository } from "@/services/storage";

const standaloneIdentity = {
  tenantId: "tenant_standalone",
  userId: "user_standalone",
  merchantId: "merchant_standalone",
  organizationId: "organization_standalone",
  storeId: "store_standalone",
} as const;

type PublishRequest = Parameters<StorefrontPublishingGateway["publish"]>[0];

function projectInput(seed: typeof aurumNordicSeed | typeof karvonenSeed) {
  return {
    project: structuredClone(seed.project),
    catalogue: structuredClone(seed.catalogue),
    snapshots: [structuredClone(seed.publishedSnapshot), structuredClone(seed.draftSnapshot)],
  };
}

function createHarness(
  options: {
    projects?: Array<typeof aurumNordicSeed | typeof karvonenSeed>;
    permissions?: MerchantProjectContext["permissions"];
  } = {},
) {
  const repository = new InMemoryProjectRepository(
    (options.projects ?? [aurumNordicSeed]).map(projectInput),
  );
  const preparations = new Map<string, PublishPreparation>();
  const publishPreparations: AuthoritativePublishPreparationReader = {
    load(preparationId: string) {
      return Promise.resolve(preparations.get(preparationId) ?? null);
    },
  };
  const contextPort = createStandaloneMerchantProjectContextPort({
    projectRepository: repository,
    ...standaloneIdentity,
    permissions: options.permissions,
  });
  const adapter = createStandaloneAuthoritativePublishingAdapter({
    projectRepository: repository,
    contextPort,
    publishPreparations,
  });
  return { adapter, contextPort, preparations, publishPreparations, repository };
}

async function saveChangedDraft(
  repository: InMemoryProjectRepository,
  projectId: string,
  label: string,
): Promise<StorefrontSnapshot> {
  const aggregate = await repository.get(projectId);
  const current = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
  const draft = structuredClone(current);
  draft.id = `snapshot_p9_05b_${label}`;
  draft.createdAt = new Date(Date.parse(current.createdAt) + 1_000).toISOString();
  draft.pages[0].title.en = `P9-05B ${label}`;
  await repository.saveDraft(projectId, draft, {
    id: current.id,
    revision: current.revision,
  });
  return draft;
}

async function canonicalRequest(
  harness: ReturnType<typeof createHarness>,
  projectId: string,
  label: string,
  options: {
    contextPort?: MerchantProjectContextPort;
    revisionMapper?: AuthoritativePublishingRevisionMapper;
  } = {},
): Promise<PublishRequest> {
  const preparation = await preparePublish(projectId, harness.repository, {
    createPreparationId: () => `publish_preparation_p9_05b_${label}`,
  });
  harness.preparations.set(preparation.preparationId, preparation);
  const context = await (options.contextPort ?? harness.contextPort).load({
    tenantId: standaloneIdentity.tenantId,
    storefrontProjectId: projectId,
  });
  const aggregate = await harness.repository.get(projectId);
  const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
  const published = aggregate.snapshots.find(
    ({ id }) => id === aggregate.project.publishedSnapshotId,
  )!;

  return publishStorefrontRequestSchema.parse({
    context,
    requestId: `publish_request_p9_05b_${label}`,
    publishPreparationId: preparation.preparationId,
    expectedProjectRevision: context.projectRevision,
    expectedSavedDraft: {
      id: draft.id,
      revision: (options.revisionMapper ?? standalonePublishingRevisionMapper).snapshotRevision(
        draft.revision,
      ),
      contentFingerprint: canonicalStorefrontContentFingerprint(draft),
    },
    expectedPublished: {
      id: published.id,
      revision: (options.revisionMapper ?? standalonePublishingRevisionMapper).snapshotRevision(
        published.revision,
      ),
      contentFingerprint: canonicalStorefrontContentFingerprint(published),
    },
  });
}

describe("P9-05B authoritative storefront publishing adapter", () => {
  it("satisfies the exact canonical P9-01 publishing port", () => {
    const harness = createHarness();
    const port: VeskoIntegrationPorts["publishing"] = harness.adapter;

    expect(port).toBe(harness.adapter);
  });

  it("keeps the standalone numeric-to-opaque revision authority explicit", () => {
    expect(standalonePublishingRevisionMapper.projectRevision(42)).toBe(
      toStandaloneProjectRevision(42),
    );
    expect(standalonePublishingRevisionMapper.snapshotRevision(42)).toBe(
      toStandaloneSnapshotRevision(42),
    );
  });

  it("publishes the authoritative saved draft through the atomic repository flow", async () => {
    const harness = createHarness();
    await saveChangedDraft(harness.repository, aurumNordicSeed.project.id, "valid");
    const before = await harness.repository.get(aurumNordicSeed.project.id);
    const revisionMapper: AuthoritativePublishingRevisionMapper = {
      projectRevision: () => "vesko-etag-abc123",
      snapshotRevision: (revision) => `vesko-snapshot-etag-${revision}`,
    };
    const opaqueContextPort: MerchantProjectContextPort = {
      async load(input) {
        const context = await harness.contextPort.load(input);
        return {
          ...context,
          projectRevision: revisionMapper.projectRevision(before.project.revision),
        };
      },
    };
    const adapter = createAuthoritativeStorefrontPublishingAdapter({
      projectRepository: harness.repository,
      contextPort: opaqueContextPort,
      publishPreparations: harness.publishPreparations,
      revisionMapper,
    });
    const request = await canonicalRequest(harness, aurumNordicSeed.project.id, "valid", {
      contextPort: opaqueContextPort,
      revisionMapper,
    });

    const mismatchedRevisionAdapter = createAuthoritativeStorefrontPublishingAdapter({
      projectRepository: harness.repository,
      contextPort: opaqueContextPort,
      publishPreparations: harness.publishPreparations,
      revisionMapper: {
        ...revisionMapper,
        projectRevision: () => "vesko-etag-mismatch",
      },
    });
    await expect(mismatchedRevisionAdapter.publish(request)).rejects.toMatchObject({
      code: "stalePublishConfirmation",
    });

    const result = await adapter.publish(request);
    const after = await harness.repository.get(aurumNordicSeed.project.id);
    const published = after.snapshots.find(({ id }) => id === after.project.publishedSnapshotId)!;

    expect(result).toEqual({
      requestId: request.requestId,
      storefrontProjectId: aurumNordicSeed.project.id,
      publishedRevision: revisionMapper.snapshotRevision(published.revision),
      status: "published",
    });
    expect(after.project.revision).toBe(before.project.revision + 1);
    expect(canonicalStorefrontContentFingerprint(published)).toBe(
      request.expectedSavedDraft.contentFingerprint,
    );
  });

  it("rejects arbitrary client snapshot content as a publishing source", async () => {
    const harness = createHarness();
    await saveChangedDraft(harness.repository, aurumNordicSeed.project.id, "client_snapshot");
    const request = await canonicalRequest(harness, aurumNordicSeed.project.id, "client_snapshot");
    const publish = vi.spyOn(harness.repository, "publish");

    await expect(
      harness.adapter.publish({
        ...request,
        snapshot: structuredClone(aurumNordicSeed.publishedSnapshot),
      } as never),
    ).rejects.toMatchObject({ code: "malformedIntegrationResponse" });
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects stale draft identity or fingerprint without changing published state", async () => {
    const harness = createHarness();
    await saveChangedDraft(harness.repository, aurumNordicSeed.project.id, "stale_base");
    const request = await canonicalRequest(harness, aurumNordicSeed.project.id, "stale_base");
    const before = await harness.repository.get(aurumNordicSeed.project.id);

    await expect(
      harness.adapter.publish({
        ...request,
        expectedSavedDraft: {
          ...request.expectedSavedDraft,
          contentFingerprint: "v1_stale_fingerprint",
        },
      }),
    ).rejects.toMatchObject({ code: "stalePublishConfirmation" });

    await saveChangedDraft(harness.repository, aurumNordicSeed.project.id, "newer_saved_draft");
    const afterSave = await harness.repository.get(aurumNordicSeed.project.id);
    await expect(harness.adapter.publish(request)).rejects.toMatchObject({
      code: "savedDraftMismatch",
    });
    const after = await harness.repository.get(aurumNordicSeed.project.id);
    expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
    expect(after.project.draftSnapshotId).toBe(afterSave.project.draftSnapshotId);
  });

  it("requires explicit canonical publish permission", async () => {
    const harness = createHarness({
      permissions: ["readStorefront", "saveDraft", "restoreDraft"],
    });
    await saveChangedDraft(harness.repository, aurumNordicSeed.project.id, "permission");
    const request = await canonicalRequest(harness, aurumNordicSeed.project.id, "permission");

    await expect(harness.adapter.publish(request)).rejects.toMatchObject({
      code: "permissionDenied",
    });
  });

  it("rejects cross-tenant and cross-project publication", async () => {
    const harness = createHarness({ projects: [aurumNordicSeed, karvonenSeed] });
    await saveChangedDraft(harness.repository, aurumNordicSeed.project.id, "identity");
    const request = await canonicalRequest(harness, aurumNordicSeed.project.id, "identity");

    await expect(
      harness.adapter.publish({
        ...request,
        context: { ...request.context, tenantId: "tenant_other" },
      }),
    ).rejects.toMatchObject({ code: "tenantMismatch" });

    const karvonenContext = await harness.contextPort.load({
      tenantId: standaloneIdentity.tenantId,
      storefrontProjectId: karvonenSeed.project.id,
    });
    await expect(
      harness.adapter.publish({
        ...request,
        context: karvonenContext,
        expectedProjectRevision: karvonenContext.projectRevision,
      }),
    ).rejects.toMatchObject({ code: "projectNotFound" });
  });

  it("uses durable scoped operations for exact, ambiguous and inconsistent replays", async () => {
    const harness = createHarness();
    await saveChangedDraft(harness.repository, aurumNordicSeed.project.id, "idempotent");
    const request = await canonicalRequest(harness, aurumNordicSeed.project.id, "idempotent");
    const before = await harness.repository.get(aurumNordicSeed.project.id);
    const publish = vi.spyOn(harness.repository, "publish");

    const [first, concurrentReplay] = await Promise.all([
      harness.adapter.publish(request),
      harness.adapter.publish(request),
    ]);
    const afterFirst = await harness.repository.get(aurumNordicSeed.project.id);
    const reloadedAdapter = createStandaloneAuthoritativePublishingAdapter({
      projectRepository: harness.repository,
      contextPort: harness.contextPort,
      publishPreparations: harness.publishPreparations,
    });
    const sequentialReplay = await reloadedAdapter.publish(request);
    const afterReplay = await harness.repository.get(aurumNordicSeed.project.id);

    expect(concurrentReplay).toEqual(first);
    expect(sequentialReplay).toEqual(first);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(afterReplay).toEqual(afterFirst);
    expect(afterFirst.snapshotHistoryMetadata).toHaveLength(
      (before.snapshotHistoryMetadata?.length ?? 0) + 2,
    );
    const currentContext = await harness.contextPort.load({
      tenantId: standaloneIdentity.tenantId,
      storefrontProjectId: aurumNordicSeed.project.id,
    });
    const contextLoad = vi.spyOn(harness.contextPort, "load").mockResolvedValue({
      ...currentContext,
      permissions: ["readStorefront"],
    });
    await expect(reloadedAdapter.publish(request)).rejects.toMatchObject({
      code: "permissionDenied",
    });
    contextLoad.mockRestore();
    expect(await reloadedAdapter.publish(request)).toEqual(first);
    await expect(
      reloadedAdapter.publish({
        ...request,
        expectedSavedDraft: {
          ...request.expectedSavedDraft,
          contentFingerprint: "v1_inconsistent_replay",
        },
      }),
    ).rejects.toMatchObject({ code: "stalePublishConfirmation" });

    const ambiguous = createHarness();
    await saveChangedDraft(ambiguous.repository, aurumNordicSeed.project.id, "ambiguous_commit");
    const ambiguousRequest = await canonicalRequest(
      ambiguous,
      aurumNordicSeed.project.id,
      "ambiguous_commit",
    );
    const originalPublish = ambiguous.repository.publish.bind(ambiguous.repository);
    vi.spyOn(ambiguous.repository, "publish").mockImplementationOnce(
      async (projectId, expectation) => {
        await originalPublish(projectId, expectation);
        throw new Error("Response lost after the atomic commit.");
      },
    );
    const operationLookup = vi.spyOn(ambiguous.repository, "getPublicationOperation");
    const reconciled = await ambiguous.adapter.publish(ambiguousRequest);
    const afterAmbiguousCommit = await ambiguous.repository.get(aurumNordicSeed.project.id);
    const durableOperation = await ambiguous.repository.getPublicationOperation({
      tenantId: standaloneIdentity.tenantId,
      merchantId: standaloneIdentity.merchantId,
      organizationId: standaloneIdentity.organizationId,
      storeId: standaloneIdentity.storeId,
      storefrontProjectId: aurumNordicSeed.project.id,
      operationType: "publish",
      requestId: ambiguousRequest.requestId,
    });
    expect(reconciled.status).toBe("published");
    expect(await ambiguous.adapter.publish(ambiguousRequest)).toEqual(reconciled);
    expect(operationLookup).toHaveBeenCalled();
    expect(typeof durableOperation?.requestFingerprint).toBe("string");
    expect(durableOperation?.result).toEqual(reconciled);
    expect(await ambiguous.repository.get(aurumNordicSeed.project.id)).toEqual(
      afterAmbiguousCommit,
    );
  });

  it("reauthorizes an in-flight duplicate before joining the publication", async () => {
    const harness = createHarness();
    await saveChangedDraft(harness.repository, aurumNordicSeed.project.id, "in_flight");
    const request = await canonicalRequest(harness, aurumNordicSeed.project.id, "in_flight");
    const originalPublish = harness.repository.publish.bind(harness.repository);
    let releasePublish!: () => void;
    let publishStarted!: () => void;
    const release = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    const started = new Promise<void>((resolve) => {
      publishStarted = resolve;
    });
    const publish = vi
      .spyOn(harness.repository, "publish")
      .mockImplementationOnce(async (projectId, expectation) => {
        publishStarted();
        await release;
        return originalPublish(projectId, expectation);
      });

    const first = harness.adapter.publish(request);
    await started;
    const currentContext = await harness.contextPort.load({
      tenantId: standaloneIdentity.tenantId,
      storefrontProjectId: aurumNordicSeed.project.id,
    });
    const contextLoad = vi.spyOn(harness.contextPort, "load").mockResolvedValue({
      ...currentContext,
      permissions: ["readStorefront"],
    });

    await expect(harness.adapter.publish(request)).rejects.toMatchObject({
      code: "permissionDenied",
    });
    expect(publish).toHaveBeenCalledTimes(1);
    contextLoad.mockRestore();
    releasePublish();
    await expect(first).resolves.toMatchObject({ status: "published" });
  });

  it("publishes Aurum and Karvonen while preserving draft separation and publication history", async () => {
    const harness = createHarness({ projects: [aurumNordicSeed, karvonenSeed] });

    for (const [seed, label] of [
      [aurumNordicSeed, "aurum"],
      [karvonenSeed, "karvonen"],
    ] as const) {
      const sourceDraft = await saveChangedDraft(harness.repository, seed.project.id, label);
      const request = {
        ...(await canonicalRequest(harness, seed.project.id, label)),
        requestId: "publish_request_shared_across_project_scopes",
      };
      await harness.adapter.publish(request);
      const after = await harness.repository.get(seed.project.id);
      const activeDraft = after.snapshots.find(({ id }) => id === after.project.draftSnapshotId)!;
      const published = after.snapshots.find(({ id }) => id === after.project.publishedSnapshotId)!;

      expect(after.snapshots.map(({ id }) => id)).toContain(sourceDraft.id);
      expect(activeDraft.id).not.toBe(published.id);
      expect(canonicalStorefrontContentEqual(activeDraft, published)).toBe(true);
      expect(after.snapshotHistoryMetadata?.map(({ reason }) => reason)).toEqual(
        expect.arrayContaining(["published", "publishedDraftSynchronized"]),
      );
    }
  });
});
