// @vitest-environment node

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  InMemoryAcceptedSnapshotPublishReceiptRepository,
  acceptedSnapshotPublishReceiptFingerprint,
  type AcceptedSnapshotCurrentAuthority,
  type AcceptedSnapshotCurrentAuthoritySource,
  type AcceptedSnapshotPublishReceipt,
} from "@/application/accepted-snapshot-publishing";
import { FileSystemAcceptedSnapshotPublishReceiptRepository } from "@/application/accepted-snapshot-publishing/index.server";
import { createAuthoritativeMerchantPublishRouteHandler } from "@/app/api/storefront-publish/handler";
import {
  AuthoritativeMerchantPublishError,
  AuthoritativeMerchantPublishService,
  InMemoryMerchantPublishPreparationStore,
} from "@/application/publishing/authoritative-merchant-publish.server";
import { createStandaloneMerchantProjectContextPort } from "@/application/merchant-project-context";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import {
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { createStandaloneAuthoritativePublishingAdapter } from "@/integrations/vesko-publishing";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";

const identity = {
  tenantId: "tenant_standalone",
  userId: "user_standalone",
  merchantId: "merchant_standalone",
  organizationId: "organization_standalone",
  storeId: "store_standalone",
} as const;

function aggregate(seed: typeof aurumNordicSeed | typeof karvonenSeed): ProjectAggregate {
  return {
    project: structuredClone(seed.project),
    catalogue: structuredClone(seed.catalogue),
    snapshots: [structuredClone(seed.publishedSnapshot), structuredClone(seed.draftSnapshot)],
  };
}

function request() {
  return new Request("https://studio.test/api/storefront-publish", {
    method: "POST",
    headers: { origin: "https://studio.test" },
  });
}

function routeRequest(body: unknown, origin = "https://studio.test") {
  return new Request("https://studio.test/api/storefront-publish", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

async function saveChangedDraft(
  repository: InMemoryProjectRepository,
  projectId: string,
  label: string,
): Promise<StorefrontSnapshot> {
  const current = await repository.get(projectId);
  const currentDraft = current.snapshots.find(
    (snapshot) => snapshot.id === current.project.draftSnapshotId,
  )!;
  const draft = structuredClone(currentDraft);
  draft.id = `snapshot_gateway_${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_")}`;
  draft.createdAt = new Date(Date.parse(draft.createdAt) + 1_000).toISOString();
  draft.pages[0].title.en = label;
  await repository.saveDraft(projectId, draft, {
    id: currentDraft.id,
    revision: currentDraft.revision,
  });
  return draft;
}

async function trustedReceipt(
  repository: InMemoryProjectRepository,
  projectId: string,
): Promise<AcceptedSnapshotPublishReceipt> {
  const aggregate = await repository.get(projectId);
  const draft = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
  )!;
  const unsigned = {
    id: "acceptance_receipt_gateway",
    version: "1.0.0" as const,
    projectId,
    draftId: draft.id,
    proposalId: "whole_storefront_proposal_gateway",
    proposalRevision: 1,
    proposalFingerprint: "proposal_gateway",
    reviewRevision: 1,
    reviewFingerprint: "review_gateway",
    acceptedRuntimeFingerprint: "accepted_runtime_gateway",
    acceptedSnapshotId: draft.id,
    acceptedSnapshotFingerprint: canonicalStorefrontContentFingerprint(draft),
    projectRevision: aggregate.project.revision,
    draftRevision: draft.revision,
    componentRegistryFingerprint: "registry_gateway",
    manifest: null,
    packageRegistry: null,
    profileAuthorities: [],
    commerceFingerprint: "commerce_gateway",
    approvedAssetFingerprint: null,
    acceptanceActionId: "acceptance_action_gateway",
    acceptedAt: "2026-08-05T10:00:00.000Z",
    sourceKind: "initialGeneration" as const,
  };
  return { ...unsigned, fingerprint: acceptedSnapshotPublishReceiptFingerprint(unsigned) };
}

function authorityRecordedAtAcceptance(
  receipt: AcceptedSnapshotPublishReceipt,
): AcceptedSnapshotCurrentAuthority {
  return {
    proposalId: receipt.proposalId,
    proposalRevision: receipt.proposalRevision,
    proposalFingerprint: receipt.proposalFingerprint,
    reviewRevision: receipt.reviewRevision,
    reviewFingerprint: receipt.reviewFingerprint,
    acceptedRuntimeFingerprint: receipt.acceptedRuntimeFingerprint,
    componentRegistryFingerprint: receipt.componentRegistryFingerprint,
    manifest: receipt.manifest,
    packageRegistry: receipt.packageRegistry,
    profileAuthorities: receipt.profileAuthorities,
    commerceFingerprint: receipt.commerceFingerprint,
    approvedAssetFingerprint: receipt.approvedAssetFingerprint,
  };
}

function createHarness(
  options: {
    projects?: Array<typeof aurumNordicSeed | typeof karvonenSeed>;
    permissions?: Array<"readStorefront" | "saveDraft" | "restoreDraft" | "publishStorefront">;
    authority?: AcceptedSnapshotCurrentAuthority;
  } = {},
) {
  const repository = new InMemoryProjectRepository(
    (options.projects ?? [aurumNordicSeed]).map(aggregate),
  );
  const preparationStore = new InMemoryMerchantPublishPreparationStore();
  const receiptRepository = new InMemoryAcceptedSnapshotPublishReceiptRepository();
  const contextPort = createStandaloneMerchantProjectContextPort({
    projectRepository: repository,
    ...identity,
    permissions: options.permissions,
  });
  let currentAuthority: AcceptedSnapshotCurrentAuthority | undefined = options.authority;
  const resolveCurrentAuthority = vi.fn(() => Promise.resolve(currentAuthority));
  const currentAuthoritySource: AcceptedSnapshotCurrentAuthoritySource = {
    resolveCurrentAuthority,
  };
  const publishingGateway = createStandaloneAuthoritativePublishingAdapter({
    projectRepository: repository,
    contextPort,
    publishPreparations: {
      async load(preparationId) {
        return (await preparationStore.load(preparationId))?.preparation ?? null;
      },
    },
    acceptedSnapshotAuthority: { receiptRepository, currentAuthoritySource },
  });
  const authenticatedContext = {
    resolve: vi.fn(({ projectId }: { projectId: string }) =>
      contextPort.load({ tenantId: identity.tenantId, storefrontProjectId: projectId }),
    ),
  };
  const service = new AuthoritativeMerchantPublishService({
    projectRepository: repository,
    publishingGateway,
    authenticatedContext,
    preparationStore,
    revisionMapper: {
      projectRevision: (revision) => `standalone-project-revision-${revision}`,
      snapshotRevision: (revision) => `standalone-snapshot-revision-${revision}`,
    },
    acceptedAiAuthority: { receiptRepository, currentAuthoritySource },
  });
  return {
    repository,
    preparationStore,
    receiptRepository,
    setCurrentAuthority: (authority: AcceptedSnapshotCurrentAuthority | undefined) => {
      currentAuthority = authority;
    },
    currentAuthoritySource: { resolveCurrentAuthority },
    authenticatedContext,
    service,
  };
}

function manualRequest(projectId: string, requestId = "publish_request_gateway") {
  return { projectId, requestId, authority: { kind: "manual" as const } };
}

describe("P10A-08C-01 authoritative merchant publish gateway", () => {
  it("uses the same-origin merchant route to invoke the server gateway", async () => {
    const harness = createHarness();
    const projectId = aurumNordicSeed.project.id;
    await saveChangedDraft(harness.repository, projectId, "Route gateway draft");
    const handler = createAuthoritativeMerchantPublishRouteHandler({ service: harness.service });
    const publish = vi.spyOn(harness.repository, "publish");

    const prepared = await handler(
      routeRequest({
        action: "prepare",
        request: manualRequest(projectId, "publish_request_route"),
      }),
    );
    expect(prepared.status).toBe(200);
    const body: unknown = await prepared.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("preparation" in body) ||
      !body.preparation ||
      typeof body.preparation !== "object" ||
      !("preparationId" in body.preparation) ||
      typeof body.preparation.preparationId !== "string"
    ) {
      throw new Error("Expected a server-owned publication preparation.");
    }
    expect(publish).not.toHaveBeenCalled();

    const confirmed = await handler(
      routeRequest({
        action: "confirm",
        request: {
          projectId,
          requestId: "publish_request_route",
          preparationId: body.preparation.preparationId,
        },
      }),
    );
    expect(confirmed.status).toBe(200);
    expect(publish).toHaveBeenCalledTimes(1);

    const crossOrigin = await handler(
      routeRequest({ action: "prepare", request: manualRequest(projectId) }, "https://other.test"),
    );
    expect(crossOrigin.status).toBe(403);
  });

  it("persists and reparses immutable receipts in narrow server storage", async () => {
    const harness = createHarness();
    const projectId = aurumNordicSeed.project.id;
    await saveChangedDraft(harness.repository, projectId, "Durable receipt");
    const receipt = await trustedReceipt(harness.repository, projectId);
    const directory = await mkdtemp(join(tmpdir(), "veskify-receipt-store-"));
    const writer = new FileSystemAcceptedSnapshotPublishReceiptRepository(directory);
    await writer.createOnce(receipt);
    const reader = new FileSystemAcceptedSnapshotPublishReceiptRepository(directory);
    expect(await reader.get(receipt.id)).toEqual(receipt);
  });

  it("authenticates, authorizes, prepares, confirms, and publishes only through the gateway", async () => {
    const harness = createHarness();
    const projectId = aurumNordicSeed.project.id;
    await saveChangedDraft(harness.repository, projectId, "Gateway published draft");
    const before = await harness.repository.get(projectId);
    const publish = vi.spyOn(harness.repository, "publish");

    const preparation = await harness.service.prepare(manualRequest(projectId), request());
    expect(preparation.authority).toEqual({ kind: "manual" });
    expect(preparation).not.toHaveProperty("compilation");
    const trustedPreparation = await harness.preparationStore.load(preparation.preparationId);
    expect(trustedPreparation?.preparation.compilation.receipt.sourceAuthorityKind).toBe("manual");
    expect(trustedPreparation?.preparation.compilation).not.toHaveProperty("result");
    expect(harness.authenticatedContext.resolve).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();

    const result = await harness.service.confirm(
      { projectId, requestId: "publish_request_gateway", preparationId: preparation.preparationId },
      request(),
    );
    expect(result.projectRevision).toBe(before.project.revision + 1);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("requires authenticated publishStorefront authority before preparation", async () => {
    const projectId = aurumNordicSeed.project.id;
    const unauthorized = createHarness({
      permissions: ["readStorefront", "saveDraft", "restoreDraft"],
    });
    await saveChangedDraft(unauthorized.repository, projectId, "No permission");
    await expect(
      unauthorized.service.prepare(manualRequest(projectId), request()),
    ).rejects.toMatchObject({
      code: "permission-denied",
    });

    const missingAuthentication = createHarness();
    await saveChangedDraft(missingAuthentication.repository, projectId, "No authentication");
    missingAuthentication.authenticatedContext.resolve.mockRejectedValueOnce(
      new AuthoritativeMerchantPublishError("authentication-required"),
    );
    await expect(
      missingAuthentication.service.prepare(manualRequest(projectId), request()),
    ).rejects.toMatchObject({ code: "authentication-required" });
  });

  it("resolves a trusted persisted AI receipt during both preparation and confirmation", async () => {
    const harness = createHarness();
    const projectId = aurumNordicSeed.project.id;
    await saveChangedDraft(harness.repository, projectId, "Accepted AI draft");
    const receipt = await trustedReceipt(harness.repository, projectId);
    await harness.receiptRepository.createOnce(receipt);
    harness.setCurrentAuthority(authorityRecordedAtAcceptance(receipt));
    const get = vi.spyOn(harness.receiptRepository, "get");

    const preparation = await harness.service.prepare(
      {
        projectId,
        requestId: "publish_request_accepted_ai",
        authority: { kind: "accepted-ai", receiptId: receipt.id },
      },
      request(),
    );
    expect(preparation.authority).toMatchObject({ kind: "accepted-ai", receiptId: receipt.id });
    await harness.service.confirm(
      {
        projectId,
        requestId: "publish_request_accepted_ai",
        preparationId: preparation.preparationId,
      },
      request(),
    );
    expect(get).toHaveBeenCalledTimes(2);
    expect(harness.currentAuthoritySource.resolveCurrentAuthority).toHaveBeenCalledTimes(2);
  });

  it("does not trust client-provided receipt content and keeps manual and AI authority distinct", async () => {
    const harness = createHarness();
    const projectId = aurumNordicSeed.project.id;
    await saveChangedDraft(harness.repository, projectId, "Receipt identity only");
    const publish = vi.spyOn(harness.repository, "publish");

    await expect(
      harness.service.prepare(
        {
          ...manualRequest(projectId, "publish_request_receipt_content"),
          authority: {
            kind: "accepted-ai",
            receiptId: "acceptance_receipt_missing",
            receipt: { projectId },
          },
        },
        request(),
      ),
    ).rejects.toMatchObject({ code: "invalid-request" });
    await expect(
      harness.service.confirm(
        {
          projectId,
          requestId: "publish_request_receipt_content",
          preparationId: "publish_preparation_untrusted_compile",
          compileReceipt: { fingerprint: "browser-supplied" },
        },
        request(),
      ),
    ).rejects.toMatchObject({ code: "invalid-request" });
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects another project, another proposal authority, accept-then-undo, and stale draft without changing publication", async () => {
    const projectId = aurumNordicSeed.project.id;
    const harness = createHarness({ projects: [aurumNordicSeed, karvonenSeed] });
    await saveChangedDraft(harness.repository, projectId, "Accepted then undo");
    const receipt = await trustedReceipt(harness.repository, projectId);
    await harness.receiptRepository.createOnce(receipt);
    harness.setCurrentAuthority(authorityRecordedAtAcceptance(receipt));
    const before = await harness.repository.get(projectId);
    const publish = vi.spyOn(harness.repository, "publish");

    await expect(
      harness.service.prepare(
        {
          projectId: karvonenSeed.project.id,
          requestId: "publish_request_cross_project",
          authority: { kind: "accepted-ai", receiptId: receipt.id },
        },
        request(),
      ),
    ).rejects.toMatchObject({ code: "project-mismatch" });

    const preparation = await harness.service.prepare(
      {
        projectId,
        requestId: "publish_request_stale_accepted",
        authority: { kind: "accepted-ai", receiptId: receipt.id },
      },
      request(),
    );
    await saveChangedDraft(harness.repository, projectId, "Undo changed accepted draft");
    await expect(
      harness.service.confirm(
        {
          projectId,
          requestId: "publish_request_stale_accepted",
          preparationId: preparation.preparationId,
        },
        request(),
      ),
    ).rejects.toMatchObject({ code: "savedDraftMismatch" });
    const after = await harness.repository.get(projectId);
    expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
    expect(publish).not.toHaveBeenCalled();

    const proposalMismatch = createHarness({
      authority: {
        ...authorityRecordedAtAcceptance(receipt),
        proposalId: "proposal_other",
      },
    });
    await saveChangedDraft(proposalMismatch.repository, projectId, "Proposal mismatch");
    await proposalMismatch.receiptRepository.createOnce(
      await trustedReceipt(proposalMismatch.repository, projectId),
    );
    await expect(
      proposalMismatch.service.prepare(
        {
          projectId,
          requestId: "publish_request_proposal_other",
          authority: { kind: "accepted-ai", receiptId: receipt.id },
        },
        request(),
      ),
    ).rejects.toMatchObject({ code: "proposal-mismatch" });
  });

  it("is durably idempotent for an identical request and rejects conflicting duplicate data", async () => {
    const harness = createHarness();
    const projectId = aurumNordicSeed.project.id;
    await saveChangedDraft(harness.repository, projectId, "Idempotent gateway");
    const receipt = await trustedReceipt(harness.repository, projectId);
    await harness.receiptRepository.createOnce(receipt);
    harness.setCurrentAuthority(authorityRecordedAtAcceptance(receipt));
    const first = await harness.service.prepare(
      manualRequest(projectId, "publish_request_duplicate"),
      request(),
    );
    const replay = await harness.service.prepare(
      manualRequest(projectId, "publish_request_duplicate"),
      request(),
    );
    expect(replay).toEqual(first);
    await expect(
      harness.service.prepare(
        {
          projectId,
          requestId: "publish_request_duplicate",
          authority: { kind: "accepted-ai", receiptId: receipt.id },
        },
        request(),
      ),
    ).rejects.toMatchObject({ code: "idempotency-conflict" });

    const record = await harness.preparationStore.load(first.preparationId);
    expect(record).toMatchObject({
      version: 1,
      projectId,
      requestId: "publish_request_duplicate",
    });
    expect(record?.gatewayRequest).toMatchObject({
      requestId: "publish_request_duplicate",
      publishPreparationId: first.preparationId,
    });
    if (!record) throw new Error("Expected stored authoritative publication preparation.");
    await expect(
      harness.preparationStore.createOrResolve({
        version: 1,
        projectId,
        requestId: "publish_request_duplicate",
        requestFingerprint: "different_request",
        preparation: record.preparation,
        gatewayRequest: record.gatewayRequest,
      }),
    ).rejects.toMatchObject({ code: "idempotency-conflict" });

    const [firstResult, replayResult] = await Promise.all([
      harness.service.confirm(
        { projectId, requestId: "publish_request_duplicate", preparationId: first.preparationId },
        request(),
      ),
      harness.service.confirm(
        { projectId, requestId: "publish_request_duplicate", preparationId: first.preparationId },
        request(),
      ),
    ]);
    expect(replayResult).toEqual(firstResult);
  });
});
