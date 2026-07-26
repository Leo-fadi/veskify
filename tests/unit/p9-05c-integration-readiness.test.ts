import { describe, expect, it } from "vitest";

import { preparePublish, type PublishPreparation } from "@/application/publishing";
import {
  createStandaloneVeskoIntegrationAssembly,
  integrationReadiness,
  type MerchantProjectContext,
  type StorefrontDraftPersistencePort,
  type VeskoIntegrationPorts,
} from "@/application/vesko-integration";
import {
  toStandaloneSnapshotRevision,
  type DraftSaveProvenance,
  type DraftSaveProvenanceSource,
} from "@/application/storefront-draft-persistence";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import {
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  createAvailabilityOptionMediaResolver,
  projectAvailabilityOptionMediaToProductPresentation,
} from "@/integrations/vesko-availability-options-media/availability-option-media-projection-adapter";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";

const identity = {
  tenantId: "tenant_p9_05c",
  userId: "user_p9_05c",
  merchantId: "merchant_p9_05c",
  organizationId: "organization_p9_05c",
  storeId: "store_p9_05c",
} as const;

type Seed = typeof aurumNordicSeed | typeof karvonenSeed;
type SaveRequest = Parameters<StorefrontDraftPersistencePort["save"]>[0];

function aggregate(seed: Seed): ProjectAggregate {
  return {
    project: structuredClone(seed.project),
    catalogue: structuredClone(seed.catalogue),
    snapshots: [structuredClone(seed.publishedSnapshot), structuredClone(seed.draftSnapshot)],
  };
}

function authoritativeSources() {
  const provenance = new Map<string, DraftSaveProvenance>();
  const preparations = new Map<string, PublishPreparation>();
  const key = (projectId: string, requestId: string) => `${projectId}:${requestId}`;
  const saveProvenanceSource: DraftSaveProvenanceSource = {
    resolveSaveProvenance({ context, requestId }) {
      const record = provenance.get(key(context.storefrontProjectId, requestId));
      return record === undefined
        ? Promise.reject(new Error("Missing authoritative save provenance."))
        : Promise.resolve(structuredClone(record));
    },
  };
  return {
    key,
    provenance,
    saveProvenanceSource,
    preparations,
    publishPreparations: {
      load(preparationId: string) {
        return Promise.resolve(preparations.get(preparationId) ?? null);
      },
    },
  };
}

function createHarness(
  seed: Seed = aurumNordicSeed,
  options: { permissions?: MerchantProjectContext["permissions"] } = {},
) {
  const repository = new InMemoryProjectRepository([
    aggregate(aurumNordicSeed),
    aggregate(karvonenSeed),
  ]);
  const sources = authoritativeSources();
  const ports = createStandaloneVeskoIntegrationAssembly({
    projectRepository: repository,
    catalogue: structuredClone(seed.catalogue),
    identity: { ...identity, storefrontProjectId: seed.project.id },
    saveProvenanceSource: sources.saveProvenanceSource,
    publishPreparations: sources.publishPreparations,
    permissions: options.permissions,
  });
  return { ports, repository, sources, seed };
}

function expectation(snapshot: StorefrontSnapshot) {
  return {
    id: snapshot.id,
    revision: toStandaloneSnapshotRevision(snapshot.revision),
    contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
  };
}

function changedSnapshot(base: StorefrontSnapshot, title: string): StorefrontSnapshot {
  const candidate = structuredClone(base);
  candidate.pages[0].title.en = title;
  return candidate;
}

function saveRequest(
  context: MerchantProjectContext,
  base: StorefrontSnapshot,
  candidate: StorefrontSnapshot,
  requestId: string,
): SaveRequest {
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

function registerManual(harness: ReturnType<typeof createHarness>, request: SaveRequest): void {
  harness.sources.provenance.set(
    harness.sources.key(request.context.storefrontProjectId, request.requestId),
    {
      requestId: request.requestId,
      tenantId: request.context.tenantId,
      merchantId: request.context.merchantId,
      storeId: request.context.storeId,
      storefrontProjectId: request.context.storefrontProjectId,
      expectedBase: request.expectedCurrentDraft!,
      origin: "manualEditor",
    },
  );
}

function registerAcceptedAi(
  harness: ReturnType<typeof createHarness>,
  request: SaveRequest,
  acceptedSnapshot: StorefrontSnapshot,
): void {
  harness.sources.provenance.set(
    harness.sources.key(request.context.storefrontProjectId, request.requestId),
    {
      requestId: request.requestId,
      tenantId: request.context.tenantId,
      merchantId: request.context.merchantId,
      storeId: request.context.storeId,
      storefrontProjectId: request.context.storefrontProjectId,
      expectedBase: request.expectedCurrentDraft!,
      origin: "aiProposal",
      proposalId: "proposal_p9_05c_accepted",
      proposalState: "accepted",
      acceptedSnapshot: structuredClone(acceptedSnapshot),
    },
  );
}

async function saveManualDraft(
  harness: ReturnType<typeof createHarness>,
  title: string,
  requestId: string,
) {
  const context = await harness.ports.context.load({
    tenantId: identity.tenantId,
    storefrontProjectId: harness.seed.project.id,
  });
  const current = await harness.ports.drafts.load({
    tenantId: context.tenantId,
    storefrontProjectId: context.storefrontProjectId,
  });
  if (current === null) throw new Error("Standalone fixture must contain an active draft.");
  const candidate = changedSnapshot(current.snapshot, title);
  const request = saveRequest(context, current.snapshot, candidate, requestId);
  registerManual(harness, request);
  return { context, candidate, saved: await harness.ports.drafts.save(request) };
}

describe("P9-05C Vesko integration assembly and readiness checkpoint", () => {
  it("assembles every canonical P9-01 port without casts", () => {
    const { ports } = createHarness();
    const exactPorts: VeskoIntegrationPorts = ports;

    expect(integrationReadiness(exactPorts)).toEqual({
      completeCanonicalPorts: true,
      standaloneCredentialFree: true,
      realStagingTransports: "notImplemented",
      phase10StagingAdapters: "readyForEnvironmentSpecificAdapters",
    });
  });

  it("resolves every canonical port for Karvonen", async () => {
    const harness = createHarness(karvonenSeed);
    const context = await harness.ports.context.load({
      tenantId: identity.tenantId,
      storefrontProjectId: karvonenSeed.project.id,
    });
    const catalogue = await harness.ports.catalogue.load({
      tenantId: context.tenantId,
      storeId: context.storeId,
      storefrontProjectId: context.storefrontProjectId,
    });
    const availability = await harness.ports.availability.load({
      tenantId: context.tenantId,
      storeId: context.storeId,
      storefrontProjectId: context.storefrontProjectId,
      productId: catalogue.products[0].productId,
    });

    expect(catalogue.catalogueId).toBe(karvonenSeed.catalogue.id);
    expect(availability.catalogueRevision).toBe(catalogue.revision);
    expect(
      await harness.ports.drafts.load({
        tenantId: context.tenantId,
        storefrontProjectId: context.storefrontProjectId,
      }),
    ).not.toBeNull();
    expect(typeof harness.ports.publishing.publish).toBe("function");
  });

  it("resolves every canonical port for Aurum", async () => {
    const harness = createHarness(aurumNordicSeed);
    const context = await harness.ports.context.load({
      tenantId: identity.tenantId,
      storefrontProjectId: aurumNordicSeed.project.id,
    });
    const catalogue = await harness.ports.catalogue.load({
      tenantId: context.tenantId,
      storeId: context.storeId,
      storefrontProjectId: context.storefrontProjectId,
    });
    const availability = await harness.ports.availability.load({
      tenantId: context.tenantId,
      storeId: context.storeId,
      storefrontProjectId: context.storefrontProjectId,
      productId: catalogue.products[0].productId,
    });

    expect(catalogue.catalogueId).toBe(aurumNordicSeed.catalogue.id);
    expect(availability.catalogueId).toBe(catalogue.catalogueId);
    expect(
      await harness.ports.drafts.load({
        tenantId: context.tenantId,
        storefrontProjectId: context.storefrontProjectId,
      }),
    ).not.toBeNull();
    expect(typeof harness.ports.publishing.publish).toBe("function");
  });

  it("rejects cross-tenant and cross-project port use before persistence", async () => {
    const harness = createHarness();

    await expect(
      harness.ports.context.load({
        tenantId: "tenant_other",
        storefrontProjectId: aurumNordicSeed.project.id,
      }),
    ).rejects.toMatchObject({ code: "tenantMismatch" });
    await expect(
      harness.ports.catalogue.load({
        tenantId: identity.tenantId,
        storeId: identity.storeId,
        storefrontProjectId: karvonenSeed.project.id,
      }),
    ).rejects.toMatchObject({ code: "projectMismatch" });
  });

  it("consumes catalogue and product projections only with matching identity and revision", async () => {
    const harness = createHarness();
    const context = await harness.ports.context.load({
      tenantId: identity.tenantId,
      storefrontProjectId: aurumNordicSeed.project.id,
    });
    const catalogue = await harness.ports.catalogue.load({
      tenantId: context.tenantId,
      storeId: context.storeId,
      storefrontProjectId: context.storefrontProjectId,
    });
    const projection = await harness.ports.availability.load({
      tenantId: context.tenantId,
      storeId: context.storeId,
      storefrontProjectId: context.storefrontProjectId,
      productId: catalogue.products[0].productId,
    });

    const product = projectAvailabilityOptionMediaToProductPresentation(projection, catalogue);
    const resolver = createAvailabilityOptionMediaResolver(projection, catalogue);
    expect(product.productId).toBe(projection.productId);
    expect(
      await resolver.resolve({
        productId: projection.productId,
        catalogueRevision: catalogue.revision,
        selectedValues: [],
        textEntries: [],
      }),
    ).toBeDefined();
    expect(() =>
      projectAvailabilityOptionMediaToProductPresentation(projection, {
        ...catalogue,
        revision: "catalogue-revision-other",
      }),
    ).toThrow(expect.objectContaining({ code: "staleCatalogueProjection" }));
  });

  it("persists a manual editor change without an accepted proposal", async () => {
    const harness = createHarness();
    const { candidate, saved } = await saveManualDraft(
      harness,
      "Manual P9-05C save",
      "request_p9_05c_manual",
    );
    const aggregateAfter = await harness.repository.get(aurumNordicSeed.project.id);

    expect(saved.snapshot.id).not.toBe(aurumNordicSeed.draftSnapshot.id);
    expect(saved.snapshot.pages[0].title.en).toBe(candidate.pages[0].title.en);
    expect(aggregateAfter.snapshots).toContainEqual(aurumNordicSeed.draftSnapshot);
  });

  it("persists an accepted AI proposal and mints its immutable saved identity", async () => {
    const harness = createHarness();
    const context = await harness.ports.context.load({
      tenantId: identity.tenantId,
      storefrontProjectId: aurumNordicSeed.project.id,
    });
    const current = (await harness.ports.drafts.load({
      tenantId: context.tenantId,
      storefrontProjectId: context.storefrontProjectId,
    }))!;
    const candidate = changedSnapshot(current.snapshot, "Accepted AI P9-05C save");
    const request = saveRequest(context, current.snapshot, candidate, "request_p9_05c_ai");
    registerAcceptedAi(harness, request, candidate);

    const saved = await harness.ports.drafts.save(request);

    expect(candidate.id).toBe(current.snapshot.id);
    expect(saved.snapshot.id).not.toBe(candidate.id);
    expect(saved.contentFingerprint).toBe(canonicalStorefrontContentFingerprint(candidate));
  });

  it("restores an immutable history target without mutating history or published state", async () => {
    const harness = createHarness();
    const { context, saved } = await saveManualDraft(
      harness,
      "Restore source P9-05C",
      "request_p9_05c_restore_save",
    );
    const beforeRestore = await harness.repository.get(context.storefrontProjectId);
    const target = beforeRestore.snapshots.find(
      (snapshot) => snapshot.id === aurumNordicSeed.draftSnapshot.id,
    )!;

    const restored = await harness.ports.drafts.restore({
      context,
      requestId: "request_p9_05c_restore",
      expectedProjectRevision: context.projectRevision.replace(
        /standalone-project-revision-\d+$/,
        `standalone-project-revision-${beforeRestore.project.revision}`,
      ),
      expectedCurrentDraft: expectation(saved.snapshot),
      target: expectation(target),
    });
    const afterRestore = await harness.repository.get(context.storefrontProjectId);

    expect(restored.snapshot.id).not.toBe(target.id);
    expect(afterRestore.project.publishedSnapshotId).toBe(
      beforeRestore.project.publishedSnapshotId,
    );
    expect(afterRestore.snapshots.find((snapshot) => snapshot.id === target.id)).toEqual(target);
  });

  it("publishes an authoritative saved draft while preserving its source snapshot", async () => {
    const harness = createHarness();
    const { context, saved } = await saveManualDraft(
      harness,
      "Publish P9-05C",
      "request_p9_05c_publish_save",
    );
    const preparation = await preparePublish(context.storefrontProjectId, harness.repository, {
      createPreparationId: () => "publish_preparation_p9_05c",
    });
    harness.sources.preparations.set(preparation.preparationId, preparation);
    const beforePublish = await harness.repository.get(context.storefrontProjectId);
    const published = beforePublish.snapshots.find(
      (snapshot) => snapshot.id === beforePublish.project.publishedSnapshotId,
    )!;
    const result = await harness.ports.publishing.publish({
      context: {
        ...context,
        projectRevision: `standalone-project-revision-${beforePublish.project.revision}`,
      },
      requestId: "request_p9_05c_publish",
      publishPreparationId: preparation.preparationId,
      expectedProjectRevision: `standalone-project-revision-${beforePublish.project.revision}`,
      expectedSavedDraft: expectation(saved.snapshot),
      expectedPublished: expectation(published),
    });
    const afterPublish = await harness.repository.get(context.storefrontProjectId);

    expect(result.status).toBe("published");
    expect(afterPublish.snapshots.find((snapshot) => snapshot.id === saved.snapshot.id)).toEqual(
      saved.snapshot,
    );
    expect(afterPublish.project.draftSnapshotId).not.toBe(saved.snapshot.id);
  });

  it("keeps authoritative state unchanged when a caller lacks publish authority", async () => {
    const harness = createHarness(aurumNordicSeed, {
      permissions: ["readStorefront", "saveDraft", "restoreDraft"],
    });
    const before = await harness.repository.get(aurumNordicSeed.project.id);
    const context = await harness.ports.context.load({
      tenantId: identity.tenantId,
      storefrontProjectId: aurumNordicSeed.project.id,
    });

    await expect(
      harness.ports.publishing.publish({
        context,
        requestId: "request_p9_05c_denied",
        publishPreparationId: "publish_preparation_missing",
        expectedProjectRevision: context.projectRevision,
        expectedSavedDraft: expectation(aurumNordicSeed.draftSnapshot),
        expectedPublished: expectation(aurumNordicSeed.publishedSnapshot),
      }),
    ).rejects.toMatchObject({ code: "permissionDenied" });
    expect(await harness.repository.get(aurumNordicSeed.project.id)).toEqual(before);
  });
});
