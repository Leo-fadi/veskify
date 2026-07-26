import { describe, expect, it } from "vitest";
import {
  createStandaloneMerchantProjectContextPort,
  toStandaloneProjectRevision,
  type MerchantProjectContext,
} from "@/application/merchant-project-context";
import {
  createStorefrontDraftPersistenceAdapter,
  toStandaloneSnapshotRevision,
  type AcceptedStorefrontDraftCandidate,
  type AcceptedStorefrontDraftSource,
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
const fixedDate = "2026-07-26T09:00:00.000Z";
type SaveStorefrontDraftRequest = Parameters<StorefrontDraftPersistencePort["save"]>[0];

function aggregate(seed: typeof aurumNordicSeed | typeof karvonenSeed): ProjectAggregate {
  return {
    project: structuredClone(seed.project),
    catalogue: structuredClone(seed.catalogue),
    snapshots: [structuredClone(seed.publishedSnapshot), structuredClone(seed.draftSnapshot)],
  };
}

type CanonicalSeed = typeof aurumNordicSeed | typeof karvonenSeed;

function repository(
  seeds: readonly CanonicalSeed[] = [aurumNordicSeed],
): InMemoryProjectRepository {
  return new InMemoryProjectRepository(seeds.map((seed) => aggregate(seed)));
}

function contextPort(
  projectRepository: InMemoryProjectRepository,
  permissions = ["readStorefront", "saveDraft", "restoreDraft"] as const,
) {
  return createStandaloneMerchantProjectContextPort({
    projectRepository,
    tenantId,
    userId: "user_standalone",
    merchantId: "merchant_standalone",
    organizationId: "organization_standalone",
    storeId: "store_standalone",
    permissions,
  });
}

function acceptedSource() {
  const candidates = new Map<string, AcceptedStorefrontDraftCandidate>();
  const source: AcceptedStorefrontDraftSource = {
    resolveAcceptedDraft: ({ requestId }) => {
      const candidate = candidates.get(requestId);
      return candidate
        ? Promise.resolve(structuredClone(candidate))
        : Promise.reject(new Error("Accepted proposal result was not found."));
    },
  };
  return { candidates, source };
}

function expectation(snapshot: StorefrontSnapshot) {
  return {
    id: snapshot.id,
    revision: toStandaloneSnapshotRevision(snapshot.revision),
    contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
  };
}

function changedSnapshot(
  base: StorefrontSnapshot,
  id = "snapshot_accepted_storefront",
): StorefrontSnapshot {
  const candidate = structuredClone(base);
  candidate.id = id;
  candidate.revision += 1;
  candidate.createdAt = fixedDate;
  candidate.createdBy = "user";
  candidate.pages[0].title.en = "Accepted storefront";
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
  requestId = "request_save_accepted",
}: {
  context: MerchantProjectContext;
  base: StorefrontSnapshot;
  candidate: StorefrontSnapshot;
  requestId?: string;
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

function registerAccepted(
  candidates: Map<string, AcceptedStorefrontDraftCandidate>,
  request: SaveStorefrontDraftRequest,
  candidate = request.draft.snapshot,
): void {
  candidates.set(request.requestId, {
    state: "accepted",
    requestId: request.requestId,
    tenantId: request.context.tenantId,
    storefrontProjectId: request.context.storefrontProjectId,
    expectedBase: request.expectedCurrentDraft!,
    snapshot: structuredClone(candidate),
  });
}

describe("P9-05A canonical storefront draft persistence adapter", () => {
  it("is exactly assignable to the canonical P9-01 draft port", () => {
    const projectRepository = repository();
    const accepted = acceptedSource();
    const port: StorefrontDraftPersistencePort = createStorefrontDraftPersistenceAdapter({
      projectRepository,
      contextPort: contextPort(projectRepository),
      acceptedDraftSource: accepted.source,
    });

    expect(typeof port.load).toBe("function");
    expect(typeof port.save).toBe("function");
    expect(typeof port.restore).toBe("function");
  });

  it("saves only the server-resolved accepted candidate with canonical identity fields", async () => {
    const projectRepository = repository();
    const accepted = acceptedSource();
    const port = createStorefrontDraftPersistenceAdapter({
      projectRepository,
      contextPort: contextPort(projectRepository),
      acceptedDraftSource: accepted.source,
    });
    const context = await contextFor(projectRepository);
    const candidate = changedSnapshot(aurumNordicSeed.draftSnapshot);
    const request = saveRequest({
      context,
      base: aurumNordicSeed.draftSnapshot,
      candidate,
    });
    registerAccepted(accepted.candidates, request);

    const saved = await port.save(request);
    const stored = await projectRepository.get(context.storefrontProjectId);

    expect(saved).toMatchObject({
      tenantId,
      storefrontProjectId: context.storefrontProjectId,
      revision: toStandaloneSnapshotRevision(candidate.revision),
      contentFingerprint: canonicalStorefrontContentFingerprint(candidate),
      snapshot: { id: candidate.id },
    });
    expect(stored.project.draftSnapshotId).toBe(candidate.id);
    expect(stored.snapshots.find(({ id }) => id === candidate.id)).toEqual(candidate);
  });

  it("rejects stale project or draft revisions and replay without mutation", async () => {
    const projectRepository = repository();
    const accepted = acceptedSource();
    const port = createStorefrontDraftPersistenceAdapter({
      projectRepository,
      contextPort: contextPort(projectRepository),
      acceptedDraftSource: accepted.source,
    });
    const context = await contextFor(projectRepository);
    const candidate = changedSnapshot(aurumNordicSeed.draftSnapshot);
    const stale = saveRequest({
      context: {
        ...context,
        projectRevision: toStandaloneProjectRevision(aurumNordicSeed.project.revision + 1),
      },
      base: aurumNordicSeed.draftSnapshot,
      candidate,
      requestId: "request_stale_revision",
    });
    registerAccepted(accepted.candidates, stale);
    const before = await projectRepository.get(context.storefrontProjectId);

    await expect(port.save(stale)).rejects.toMatchObject({ code: "staleProjectRevision" });
    expect(await projectRepository.get(context.storefrontProjectId)).toEqual(before);

    const valid = saveRequest({
      context,
      base: aurumNordicSeed.draftSnapshot,
      candidate,
      requestId: "request_replay",
    });
    registerAccepted(accepted.candidates, valid);
    await port.save(valid);
    const afterFirstSave = await projectRepository.get(context.storefrontProjectId);
    await expect(port.save(valid)).rejects.toMatchObject({ code: "draftRevisionConflict" });
    expect(await projectRepository.get(context.storefrontProjectId)).toEqual(afterFirstSave);
  });

  it("rejects fingerprint and arbitrary client-snapshot mismatches without mutation", async () => {
    const projectRepository = repository();
    const accepted = acceptedSource();
    const port = createStorefrontDraftPersistenceAdapter({
      projectRepository,
      contextPort: contextPort(projectRepository),
      acceptedDraftSource: accepted.source,
    });
    const context = await contextFor(projectRepository);
    const authoritative = changedSnapshot(aurumNordicSeed.draftSnapshot);
    const submitted = structuredClone(authoritative);
    submitted.pages[0].title.en = "Unapproved client change";
    const request = saveRequest({
      context,
      base: aurumNordicSeed.draftSnapshot,
      candidate: submitted,
      requestId: "request_unapproved_snapshot",
    });
    registerAccepted(accepted.candidates, request, authoritative);
    const before = await projectRepository.get(context.storefrontProjectId);

    await expect(port.save(request)).rejects.toMatchObject({ code: "draftRevisionConflict" });
    expect(await projectRepository.get(context.storefrontProjectId)).toEqual(before);
    expect(accepted.candidates.get(request.requestId)?.state).toBe("accepted");
  });

  it("rejects cross-tenant and cross-project access before repository mutation", async () => {
    const projectRepository = repository([aurumNordicSeed, karvonenSeed]);
    const accepted = acceptedSource();
    const port = createStorefrontDraftPersistenceAdapter({
      projectRepository,
      contextPort: contextPort(projectRepository),
      acceptedDraftSource: accepted.source,
    });
    const beforeAurum = await projectRepository.get(aurumNordicSeed.project.id);
    const beforeKarvonen = await projectRepository.get(karvonenSeed.project.id);

    await expect(
      port.load({
        tenantId: "tenant_other",
        storefrontProjectId: aurumNordicSeed.project.id,
      }),
    ).rejects.toMatchObject({ code: "tenantMismatch" });

    const context = await contextFor(projectRepository);
    await expect(
      port.restore({
        context,
        requestId: "request_cross_project_restore",
        expectedProjectRevision: context.projectRevision,
        expectedCurrentDraft: expectation(aurumNordicSeed.draftSnapshot),
        target: expectation(karvonenSeed.publishedSnapshot),
      }),
    ).rejects.toMatchObject({ code: "historyTargetUnavailable" });
    expect(await projectRepository.get(aurumNordicSeed.project.id)).toEqual(beforeAurum);
    expect(await projectRepository.get(karvonenSeed.project.id)).toEqual(beforeKarvonen);
  });

  it("restores an immutable repository target by identity into a new active draft", async () => {
    const projectRepository = repository();
    const accepted = acceptedSource();
    const port = createStorefrontDraftPersistenceAdapter({
      projectRepository,
      contextPort: contextPort(projectRepository),
      acceptedDraftSource: accepted.source,
    });
    const context = await contextFor(projectRepository);
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

  it("keeps draft, history and published state unchanged after a failed restore", async () => {
    const projectRepository = repository();
    const accepted = acceptedSource();
    const port = createStorefrontDraftPersistenceAdapter({
      projectRepository,
      contextPort: contextPort(projectRepository),
      acceptedDraftSource: accepted.source,
    });
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
  });

  it("loads Aurum Nordic and Karvonen deterministically without cross-project leakage", async () => {
    const projectRepository = repository([aurumNordicSeed, karvonenSeed]);
    const accepted = acceptedSource();
    const port = createStorefrontDraftPersistenceAdapter({
      projectRepository,
      contextPort: contextPort(projectRepository),
      acceptedDraftSource: accepted.source,
    });

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
