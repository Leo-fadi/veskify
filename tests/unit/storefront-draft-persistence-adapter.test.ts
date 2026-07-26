import { describe, expect, it } from "vitest";
import {
  createStandaloneMerchantProjectContextPort,
  toStandaloneProjectRevision,
  type MerchantProjectContext,
} from "@/application/merchant-project-context";
import {
  createPersistedDraftSnapshotId,
  createStorefrontDraftPersistenceAdapter,
  toStandaloneSnapshotRevision,
  type DraftSaveProvenance,
  type DraftSaveProvenanceSource,
  type PersistedDraftSaveLineage,
} from "@/application/storefront-draft-persistence";
import type { StorefrontDraftPersistencePort } from "@/application/vesko-integration/contract";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";

const tenantId = "tenant_standalone";
const fixedDate = new Date("2026-07-26T09:00:00.000Z");
type SaveStorefrontDraftRequest = Parameters<StorefrontDraftPersistencePort["save"]>[0];
type CanonicalSeed = typeof aurumNordicSeed | typeof karvonenSeed;

function aggregate(seed: CanonicalSeed): ProjectAggregate {
  return {
    project: structuredClone(seed.project),
    catalogue: structuredClone(seed.catalogue),
    snapshots: [structuredClone(seed.publishedSnapshot), structuredClone(seed.draftSnapshot)],
  };
}

function repository(
  seeds: readonly CanonicalSeed[] = [aurumNordicSeed],
): InMemoryProjectRepository {
  return new InMemoryProjectRepository(seeds.map((seed) => aggregate(seed)));
}

function contextPort(projectRepository: InMemoryProjectRepository) {
  return createStandaloneMerchantProjectContextPort({
    projectRepository,
    tenantId,
    userId: "user_standalone",
    merchantId: "merchant_standalone",
    organizationId: "organization_standalone",
    storeId: "store_standalone",
    permissions: ["readStorefront", "saveDraft", "restoreDraft"],
  });
}

function provenanceSource() {
  const records = new Map<string, DraftSaveProvenance>();
  const key = (projectId: string, requestId: string) => `${projectId}:${requestId}`;
  const source: DraftSaveProvenanceSource = {
    resolveSaveProvenance: ({ requestId, context }) => {
      const record = records.get(key(context.storefrontProjectId, requestId));
      return record
        ? Promise.resolve(structuredClone(record))
        : Promise.reject(new Error("Authoritative save provenance was not found."));
    },
  };
  return { records, key, source };
}

function createAdapter(
  projectRepository: InMemoryProjectRepository,
  source: DraftSaveProvenanceSource,
) {
  return createStorefrontDraftPersistenceAdapter({
    projectRepository,
    contextPort: contextPort(projectRepository),
    saveProvenanceSource: source,
    now: () => fixedDate,
  });
}

function expectation(snapshot: StorefrontSnapshot) {
  return {
    id: snapshot.id,
    revision: toStandaloneSnapshotRevision(snapshot.revision),
    contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
  };
}

function changedActiveSnapshot(
  base: StorefrontSnapshot,
  title = "Accepted storefront",
): StorefrontSnapshot {
  const candidate = structuredClone(base);
  candidate.pages[0].title.en = title;
  return candidate;
}

async function contextFor(
  projectRepository: InMemoryProjectRepository,
  projectId = aurumNordicSeed.project.id,
): Promise<MerchantProjectContext> {
  return contextPort(projectRepository).load({
    tenantId,
    storefrontProjectId: projectId,
  });
}

function saveRequest({
  context,
  base,
  candidate,
  requestId,
}: {
  context: MerchantProjectContext;
  base: StorefrontSnapshot;
  candidate: StorefrontSnapshot;
  requestId: string;
}): SaveStorefrontDraftRequest {
  return {
    context,
    requestId,
    expectedProjectRevision: context.projectRevision,
    expectedCurrentDraft: expectation(base),
    draft: {
      tenantId: context.tenantId,
      storefrontProjectId: context.storefrontProjectId,
      revision: toStandaloneSnapshotRevision(candidate.revision),
      contentFingerprint: canonicalStorefrontContentFingerprint(candidate),
      snapshot: structuredClone(candidate),
    },
  };
}

function baseProvenance(request: SaveStorefrontDraftRequest): Omit<DraftSaveProvenance, "origin"> {
  return {
    requestId: request.requestId,
    tenantId: request.context.tenantId,
    merchantId: request.context.merchantId,
    storeId: request.context.storeId,
    storefrontProjectId: request.context.storefrontProjectId,
    expectedBase: request.expectedCurrentDraft!,
  };
}

function registerManual(
  provenance: ReturnType<typeof provenanceSource>,
  request: SaveStorefrontDraftRequest,
): void {
  provenance.records.set(provenance.key(request.context.storefrontProjectId, request.requestId), {
    ...baseProvenance(request),
    origin: "manualEditor",
  });
}

function registerAi(
  provenance: ReturnType<typeof provenanceSource>,
  request: SaveStorefrontDraftRequest,
  proposalState: Extract<DraftSaveProvenance, { origin: "aiProposal" }>["proposalState"],
  acceptedSnapshot = request.draft.snapshot,
): void {
  provenance.records.set(provenance.key(request.context.storefrontProjectId, request.requestId), {
    ...baseProvenance(request),
    origin: "aiProposal",
    proposalId: "proposal_accepted_storefront",
    proposalState,
    acceptedSnapshot: structuredClone(acceptedSnapshot),
  });
}

describe("P9-05A canonical storefront draft persistence adapter", () => {
  it("is exactly assignable to the canonical P9-01 draft port", () => {
    const projectRepository = repository();
    const provenance = provenanceSource();
    const port: StorefrontDraftPersistencePort = createAdapter(
      projectRepository,
      provenance.source,
    );

    expect(typeof port.load).toBe("function");
    expect(typeof port.save).toBe("function");
    expect(typeof port.restore).toBe("function");
  });

  it("saves a validated manual editor draft without an accepted AI proposal", async () => {
    const projectRepository = repository();
    const provenance = provenanceSource();
    const port = createAdapter(projectRepository, provenance.source);
    const context = await contextFor(projectRepository);
    const invalid = changedActiveSnapshot(aurumNordicSeed.draftSnapshot, "Unrelated navigation");
    invalid.navigation.primary.reverse();
    const invalidRequest = saveRequest({
      context,
      base: aurumNordicSeed.draftSnapshot,
      candidate: invalid,
      requestId: "request_manual_invalid",
    });
    registerManual(provenance, invalidRequest);
    const before = await projectRepository.get(context.storefrontProjectId);

    await expect(port.save(invalidRequest)).rejects.toMatchObject({
      code: "draftRevisionConflict",
    });
    expect(await projectRepository.get(context.storefrontProjectId)).toEqual(before);

    const candidate = changedActiveSnapshot(aurumNordicSeed.draftSnapshot, "Manual editor save");
    const request = saveRequest({
      context,
      base: aurumNordicSeed.draftSnapshot,
      candidate,
      requestId: "request_manual_save",
    });
    registerManual(provenance, request);
    const saved = await port.save(request);

    expect(saved.snapshot.id).not.toBe(aurumNordicSeed.draftSnapshot.id);
    expect(saved.snapshot.pages[0].title.en).toBe("Manual editor save");
    expect(canonicalStorefrontContentEqual(saved.snapshot, candidate)).toBe(true);
  });

  it("requires accepted AI provenance and mints identity from source-draft lineage", async () => {
    const projectRepository = repository();
    const provenance = provenanceSource();
    const port = createAdapter(projectRepository, provenance.source);
    const context = await contextFor(projectRepository);
    const candidate = changedActiveSnapshot(aurumNordicSeed.draftSnapshot, "Accepted AI save");
    const request = saveRequest({
      context,
      base: aurumNordicSeed.draftSnapshot,
      candidate,
      requestId: "request_ai_save",
    });
    registerAi(provenance, request, "rejected");
    const before = await projectRepository.get(context.storefrontProjectId);

    await expect(port.save(request)).rejects.toMatchObject({ code: "draftRevisionConflict" });
    expect(await projectRepository.get(context.storefrontProjectId)).toEqual(before);

    registerAi(provenance, request, "accepted", candidate);
    const acceptedRecord = structuredClone(
      provenance.records.get(provenance.key(context.storefrontProjectId, request.requestId)),
    );
    const lineage: PersistedDraftSaveLineage = {
      tenantId,
      merchantId: context.merchantId,
      storeId: context.storeId,
      storefrontProjectId: context.storefrontProjectId,
      operation: "save",
      requestId: request.requestId,
      origin: "aiProposal",
      sourceDraft: expectation(aurumNordicSeed.draftSnapshot),
      proposalId: "proposal_accepted_storefront",
    };
    const saved = await port.save(request);
    const aggregateAfter = await projectRepository.get(context.storefrontProjectId);

    expect(candidate.id).toBe(aurumNordicSeed.draftSnapshot.id);
    expect(saved.snapshot.id).toBe(createPersistedDraftSnapshotId({ savedAt: fixedDate, lineage }));
    expect(saved.snapshot.id).not.toBe(candidate.id);
    expect(saved.contentFingerprint).toBe(canonicalStorefrontContentFingerprint(candidate));
    expect(aggregateAfter.snapshots).toContainEqual(aurumNordicSeed.draftSnapshot);
    expect(aggregateAfter.snapshots.find(({ id }) => id === saved.snapshot.id)).toEqual(
      saved.snapshot,
    );
    expect(
      provenance.records.get(provenance.key(context.storefrontProjectId, request.requestId)),
    ).toEqual(acceptedRecord);
  });

  it("rejects stale revisions and fingerprints without mutation", async () => {
    const projectRepository = repository();
    const provenance = provenanceSource();
    const port = createAdapter(projectRepository, provenance.source);
    const context = await contextFor(projectRepository);
    const candidate = changedActiveSnapshot(aurumNordicSeed.draftSnapshot);
    const stale = saveRequest({
      context: {
        ...context,
        projectRevision: toStandaloneProjectRevision(aurumNordicSeed.project.revision + 1),
      },
      base: aurumNordicSeed.draftSnapshot,
      candidate,
      requestId: "request_stale_revision",
    });
    registerManual(provenance, stale);
    const badFingerprint = saveRequest({
      context,
      base: aurumNordicSeed.draftSnapshot,
      candidate,
      requestId: "request_stale_fingerprint",
    });
    badFingerprint.expectedCurrentDraft!.contentFingerprint = "v1_stale";
    registerManual(provenance, badFingerprint);
    const before = await projectRepository.get(context.storefrontProjectId);

    await expect(port.save(stale)).rejects.toMatchObject({ code: "staleProjectRevision" });
    await expect(port.save(badFingerprint)).rejects.toMatchObject({
      code: "draftRevisionConflict",
    });
    expect(await projectRepository.get(context.storefrontProjectId)).toEqual(before);
  });

  it("isolates tenant/project access and scopes identical request IDs by project", async () => {
    const projectRepository = repository([aurumNordicSeed, karvonenSeed]);
    const provenance = provenanceSource();
    const port = createAdapter(projectRepository, provenance.source);

    await expect(
      port.load({
        tenantId: "tenant_other",
        storefrontProjectId: aurumNordicSeed.project.id,
      }),
    ).rejects.toMatchObject({ code: "tenantMismatch" });

    const aurumContext = await contextFor(projectRepository, aurumNordicSeed.project.id);
    await expect(
      port.restore({
        context: aurumContext,
        requestId: "request_cross_project",
        expectedProjectRevision: aurumContext.projectRevision,
        expectedCurrentDraft: expectation(aurumNordicSeed.draftSnapshot),
        target: expectation(karvonenSeed.publishedSnapshot),
      }),
    ).rejects.toMatchObject({ code: "historyTargetUnavailable" });

    const karvonenContext = await contextFor(projectRepository, karvonenSeed.project.id);
    const sharedRequestId = "request_shared_projects";
    const aurumRequest = saveRequest({
      context: aurumContext,
      base: aurumNordicSeed.draftSnapshot,
      candidate: changedActiveSnapshot(aurumNordicSeed.draftSnapshot, "Aurum scoped save"),
      requestId: sharedRequestId,
    });
    const karvonenRequest = saveRequest({
      context: karvonenContext,
      base: karvonenSeed.draftSnapshot,
      candidate: changedActiveSnapshot(karvonenSeed.draftSnapshot, "Karvonen scoped save"),
      requestId: sharedRequestId,
    });
    registerManual(provenance, aurumRequest);
    registerManual(provenance, karvonenRequest);

    const [savedAurum, savedKarvonen] = await Promise.all([
      port.save(aurumRequest),
      port.save(karvonenRequest),
    ]);
    expect(savedAurum.snapshot.projectId).toBe(aurumNordicSeed.project.id);
    expect(savedKarvonen.snapshot.projectId).toBe(karvonenSeed.project.id);
    expect(savedAurum.snapshot.id).not.toBe(savedKarvonen.snapshot.id);
  });

  it("separates save/restore replay keys and rejects inconsistent scoped replay", async () => {
    const projectRepository = repository();
    const provenance = provenanceSource();
    const port = createAdapter(projectRepository, provenance.source);
    const context = await contextFor(projectRepository);
    const requestId = "request_shared_operation";
    const save = saveRequest({
      context,
      base: aurumNordicSeed.draftSnapshot,
      candidate: changedActiveSnapshot(aurumNordicSeed.draftSnapshot, "Replay-safe save"),
      requestId,
    });
    registerManual(provenance, save);
    const saved = await port.save(save);

    await expect(port.save(save)).resolves.toEqual(saved);
    const inconsistentSave = structuredClone(save);
    inconsistentSave.draft.contentFingerprint = "v1_inconsistent";
    await expect(port.save(inconsistentSave)).rejects.toMatchObject({
      code: "draftRevisionConflict",
    });

    const restore = {
      context,
      requestId,
      expectedProjectRevision: context.projectRevision,
      expectedCurrentDraft: expectation(saved.snapshot),
      target: expectation(aurumNordicSeed.publishedSnapshot),
    };
    const restored = await port.restore(restore);
    await expect(port.restore(restore)).resolves.toEqual(restored);

    const inconsistentRestore = {
      ...restore,
      target: expectation(aurumNordicSeed.draftSnapshot),
    };
    await expect(port.restore(inconsistentRestore)).rejects.toMatchObject({
      code: "staleHistoryTarget",
    });
  });

  it("restores immutable repository identity and preserves state on failed restore", async () => {
    const projectRepository = repository();
    const provenance = provenanceSource();
    const port = createAdapter(projectRepository, provenance.source);
    const context = await contextFor(projectRepository);
    const before = await projectRepository.get(context.storefrontProjectId);

    await expect(
      port.restore({
        context,
        requestId: "request_bad_restore_fingerprint",
        expectedProjectRevision: context.projectRevision,
        expectedCurrentDraft: expectation(aurumNordicSeed.draftSnapshot),
        target: {
          ...expectation(aurumNordicSeed.publishedSnapshot),
          contentFingerprint: "v1_invalid",
        },
      }),
    ).rejects.toMatchObject({ code: "historyTargetFingerprintMismatch" });
    expect(await projectRepository.get(context.storefrontProjectId)).toEqual(before);

    const restored = await port.restore({
      context,
      requestId: "request_restore_published",
      expectedProjectRevision: context.projectRevision,
      expectedCurrentDraft: expectation(aurumNordicSeed.draftSnapshot),
      target: expectation(aurumNordicSeed.publishedSnapshot),
    });
    const aggregateAfter = await projectRepository.get(context.storefrontProjectId);

    expect(restored.snapshot.id).not.toBe(aurumNordicSeed.publishedSnapshot.id);
    expect(
      canonicalStorefrontContentEqual(restored.snapshot, aurumNordicSeed.publishedSnapshot),
    ).toBe(true);
    expect(aggregateAfter.project.draftSnapshotId).toBe(restored.snapshot.id);
    expect(aggregateAfter.project.publishedSnapshotId).toBe(aurumNordicSeed.publishedSnapshot.id);
  });

  it("loads Aurum Nordic and Karvonen deterministically without cross-project leakage", async () => {
    const projectRepository = repository([aurumNordicSeed, karvonenSeed]);
    const provenance = provenanceSource();
    const port = createAdapter(projectRepository, provenance.source);

    const [aurum, karvonen, aurumAgain] = await Promise.all([
      port.load({ tenantId, storefrontProjectId: aurumNordicSeed.project.id }),
      port.load({ tenantId, storefrontProjectId: karvonenSeed.project.id }),
      port.load({ tenantId, storefrontProjectId: aurumNordicSeed.project.id }),
    ]);

    expect(aurum?.snapshot).toEqual(aurumNordicSeed.draftSnapshot);
    expect(karvonen?.snapshot).toEqual(karvonenSeed.draftSnapshot);
    expect(aurumAgain).toEqual(aurum);
    expect(aurum?.snapshot.catalogueRef).not.toBe(karvonen?.snapshot.catalogueRef);
  });
});
