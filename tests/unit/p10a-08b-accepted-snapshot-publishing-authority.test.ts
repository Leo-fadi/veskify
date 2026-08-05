// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AcceptedSnapshotPublishingAuthorityService,
  type AcceptedSnapshotMintAuthority,
} from "@/application/accepted-snapshot-publishing/index.server";
import {
  AcceptedSnapshotReceiptError,
  acceptedSnapshotPublishReceiptFingerprint,
  assertAcceptedSnapshotReceiptCurrent,
  InMemoryAcceptedSnapshotPublishReceiptRepository,
  resolveAcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotCurrentAuthority,
  type AcceptedSnapshotCurrentAuthoritySource,
  type AcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceiptRepository,
} from "@/application/accepted-snapshot-publishing";
import {
  executeGovernedFollowUpEditing,
  governedSkillPackageRegistry,
  skillCapabilityKnowledge,
  type GovernedFollowUpEditingRequest,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills";
import { planRegisteredTokenRefinement } from "@/application/ai-storefront-generation";
import { confirmPublish, preparePublish } from "@/application/publishing";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
} from "@/application/whole-storefront-generation-plan";
import {
  WholeStorefrontProposalAcceptanceCoordinator,
  compileWholeStorefrontProposal,
  type WholeStorefrontProposal,
  type WholeStorefrontProposalAuthorityInput,
  type WholeStorefrontProposalLifecycleSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";

const acceptedAt = "2026-08-05T10:00:00.000Z";

function acceptedLifecycle(
  proposal: WholeStorefrontProposal,
  currentInput: () => WholeStorefrontProposalAuthorityInput,
): WholeStorefrontProposalLifecycleSnapshot {
  const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
    proposal,
    currentInput,
  });
  return coordinator.accept();
}

function initialHarness() {
  const fixture = createP905aFreshMerchantFixture("modernTechnical");
  const planningInput = structuredClone(fixture.planningInput);
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId: "modernTechnical",
  });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const lifecycle = acceptedLifecycle(proposal, () => ({ plan, planningInput }));
  const projectRepository = new InMemoryProjectRepository([fixture.aggregate]);
  const receiptRepository = new InMemoryAcceptedSnapshotPublishReceiptRepository();
  const target = createWholeStorefrontGenerationTarget(planningInput);
  const authority: AcceptedSnapshotMintAuthority = {
    proposalRevision: 1,
    reviewRevision: 1,
    componentRegistryFingerprint: target.registryFingerprint,
    manifest: skillCapabilityKnowledge.getManifestReference(),
    packageRegistry: {
      version: governedSkillPackageRegistry.version,
      fingerprint: governedSkillPackageRegistry.fingerprint,
    },
    profileAuthorities: [],
    commerceFingerprint: target.canonicalCommerceFingerprint,
    approvedAssetFingerprint: target.approvedAssetContextFingerprint,
  };
  const service = new AcceptedSnapshotPublishingAuthorityService({
    projectRepository,
    receiptRepository,
  });
  return {
    fixture,
    plan,
    proposal,
    lifecycle,
    projectRepository,
    receiptRepository,
    authority,
    service,
  };
}

function followUpHarness() {
  const fixture = createP905aFreshMerchantFixture("modernTechnical");
  const planningInput = structuredClone(fixture.planningInput);
  const target = createWholeStorefrontGenerationTarget(planningInput);
  const authority: GovernedSkillAuthorityEnvelope = {
    projectId: planningInput.project.id,
    projectRevision: planningInput.project.revision,
    draftSnapshotId: planningInput.draft.id,
    draftRevision: planningInput.draft.revision,
    snapshotFingerprint: target.activeDraftFingerprint,
    manifest: skillCapabilityKnowledge.getManifestReference(),
    packageRegistry: {
      version: governedSkillPackageRegistry.version,
      fingerprint: governedSkillPackageRegistry.fingerprint,
    },
    componentRegistryFingerprint: target.registryFingerprint,
    commerceFingerprint: target.canonicalCommerceFingerprint,
    approvedAssetFingerprint: target.approvedAssetContextFingerprint,
    locale: "en",
    requestIdentity: "p10a-08b-follow-up-request",
  };
  const tokenRefinementPlan = planRegisteredTokenRefinement(
    "Set primary #B54708, secondary #111111, accent #B54708, background #FFFFFF, surface #FFFFFF, text #111111, muted text #333333, and border #111111. Preserve all layouts and commerce.",
    planningInput.draft.brandSystem,
  );
  if (!tokenRefinementPlan) throw new Error("Expected a bounded token refinement.");
  const descriptor = governedSkillPackageRegistry.resolve(
    "applyExactBrandPalette",
    "followUpEditing",
  ).descriptor;
  const request: GovernedFollowUpEditingRequest = {
    authority: {
      executionKind: "followUpEditing",
      packageId: "applyExactBrandPalette",
      packageVersion: descriptor.version,
      scope: descriptor.scope,
      authority,
      pages: [],
    },
    planningInput,
    tokenRefinementPlan,
  };
  const result = executeGovernedFollowUpEditing(request, authority);
  if (!result.valid) throw new Error(result.failure.message);
  const lifecycle = acceptedLifecycle(result.proposal, () => ({
    plan: result.coordinatedPlan,
    planningInput: result.planningInput,
  }));
  return { fixture, authority, result, lifecycle };
}

function currentAuthority(
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

function sourceFor(
  receipt: AcceptedSnapshotPublishReceipt,
  mutate: (authority: AcceptedSnapshotCurrentAuthority) => AcceptedSnapshotCurrentAuthority = (
    authority,
  ) => authority,
) {
  return {
    resolveCurrentAuthority: vi.fn(() => Promise.resolve(mutate(currentAuthority(receipt)))),
  } satisfies AcceptedSnapshotCurrentAuthoritySource;
}

async function mintInitial(
  overrides: {
    actionId?: string;
    authority?: AcceptedSnapshotMintAuthority;
    lifecycle?: WholeStorefrontProposalLifecycleSnapshot;
  } = {},
) {
  const harness = initialHarness();
  const receipt = await harness.service.mintAfterAcceptance({
    lifecycle: overrides.lifecycle ?? harness.lifecycle,
    acceptedSnapshot: harness.fixture.draft,
    authority: overrides.authority ?? harness.authority,
    acceptanceActionId: overrides.actionId ?? "acceptance_action_initial",
    acceptedAt,
    sourceKind: "initialGeneration",
  });
  return { ...harness, receipt };
}

describe("P10A-08B authoritative accepted snapshot receipt", () => {
  it("mints one deterministic immutable receipt after accepted initial generation", async () => {
    const first = await mintInitial();
    const stored = await resolveAcceptedSnapshotPublishReceipt(
      first.receiptRepository,
      first.receipt.id,
    );
    expect(stored).toEqual(first.receipt);
    expect(stored.fingerprint).toBe(
      acceptedSnapshotPublishReceiptFingerprint(
        Object.fromEntries(Object.entries(stored).filter(([key]) => key !== "fingerprint")) as Omit<
          AcceptedSnapshotPublishReceipt,
          "fingerprint"
        >,
      ),
    );
    first.receipt.profileAuthorities.push({ profileId: "client", fingerprint: "changed" });
    expect(await resolveAcceptedSnapshotPublishReceipt(first.receiptRepository, stored.id)).toEqual(
      stored,
    );

    const second = await mintInitial();
    expect(second.receipt).toEqual(stored);

    await expect(
      first.service.mintAfterAcceptance({
        lifecycle: first.lifecycle,
        acceptedSnapshot: first.fixture.draft,
        authority: first.authority,
        acceptanceActionId: "acceptance_action_initial",
        acceptedAt,
        sourceKind: "initialGeneration",
      }),
    ).rejects.toMatchObject({ code: "receipt-replay" });
  });

  it("mints governed follow-up evidence only after the accepted lifecycle", async () => {
    const harness = followUpHarness();
    const projectRepository = new InMemoryProjectRepository([harness.fixture.aggregate]);
    const receiptRepository = new InMemoryAcceptedSnapshotPublishReceiptRepository();
    const service = new AcceptedSnapshotPublishingAuthorityService({
      projectRepository,
      receiptRepository,
    });
    const receipt = await service.mintAfterAcceptance({
      lifecycle: harness.lifecycle,
      acceptedSnapshot: harness.fixture.draft,
      authority: {
        proposalRevision: 3,
        reviewRevision: 2,
        componentRegistryFingerprint: harness.authority.componentRegistryFingerprint,
        manifest: harness.authority.manifest,
        packageRegistry: harness.authority.packageRegistry,
        profileAuthorities: [],
        commerceFingerprint: harness.authority.commerceFingerprint,
        approvedAssetFingerprint: harness.authority.approvedAssetFingerprint,
      },
      acceptanceActionId: "acceptance_action_follow_up",
      acceptedAt,
      sourceKind: "governedFollowUp",
    });
    expect(receipt).toMatchObject({
      sourceKind: "governedFollowUp",
      proposalId: harness.result.proposal.id,
      proposalRevision: 3,
      reviewRevision: 2,
    });
  });

  it("does not mint for preview, rejection, or malformed accepted lifecycle evidence", async () => {
    const harness = initialHarness();
    const createOnce = vi.spyOn(harness.receiptRepository, "createOnce");
    const before = harness.lifecycle;
    const cases = [
      {
        ...before,
        state: "ready" as const,
        proposal: { ...before.proposal, status: "pending" as const },
      },
      {
        ...before,
        state: "rejected" as const,
        proposal: { ...before.proposal, status: "rejected" as const },
      },
      { ...before, transaction: { ...before.transaction!, proposalId: "different_proposal" } },
    ];
    for (const lifecycle of cases) {
      await expect(
        harness.service.mintAfterAcceptance({
          lifecycle,
          acceptedSnapshot: harness.fixture.draft,
          authority: harness.authority,
          acceptanceActionId: "acceptance_action_not_accepted",
          acceptedAt,
          sourceKind: "initialGeneration",
        }),
      ).rejects.toBeInstanceOf(AcceptedSnapshotReceiptError);
    }
    expect(createOnce).not.toHaveBeenCalled();
    expect(await harness.receiptRepository.get("acceptance_action_not_accepted")).toBeNull();
  });

  it("keeps minting behind the server-only module and never trusts caller receipt content", async () => {
    const publicIndex = readFileSync(
      "src/application/accepted-snapshot-publishing/index.ts",
      "utf8",
    );
    const serverService = readFileSync(
      "src/application/accepted-snapshot-publishing/service.server.ts",
      "utf8",
    );
    expect(publicIndex).not.toContain("service.server");
    expect(serverService).toMatch(/^import "server-only";/);

    const harness = await mintInitial();
    const altered = { ...harness.receipt, projectId: "project_client_forgery" };
    const fakeRepository: AcceptedSnapshotPublishReceiptRepository = {
      createOnce: vi.fn(),
      get: vi.fn(() => Promise.resolve(altered)),
    };
    await expect(
      resolveAcceptedSnapshotPublishReceipt(fakeRepository, harness.receipt.id),
    ).rejects.toMatchObject({ code: "untrusted-receipt" });
  });

  it("detects receipt replay, identity collision, malformed, unsupported, and missing receipts", async () => {
    const first = await mintInitial();
    const collidingRepository = new InMemoryAcceptedSnapshotPublishReceiptRepository();
    const collisionService = new AcceptedSnapshotPublishingAuthorityService({
      projectRepository: first.projectRepository,
      receiptRepository: collidingRepository,
      createReceiptId: () => "acceptance_receipt_collision",
    });
    await collisionService.mintAfterAcceptance({
      lifecycle: first.lifecycle,
      acceptedSnapshot: first.fixture.draft,
      authority: first.authority,
      acceptanceActionId: "acceptance_action_collision_one",
      acceptedAt,
      sourceKind: "initialGeneration",
    });
    await expect(
      collisionService.mintAfterAcceptance({
        lifecycle: first.lifecycle,
        acceptedSnapshot: first.fixture.draft,
        authority: first.authority,
        acceptanceActionId: "acceptance_action_collision_two",
        acceptedAt,
        sourceKind: "initialGeneration",
      }),
    ).rejects.toMatchObject({ code: "receipt-collision" });

    for (const [value, code] of [
      [{ ...first.receipt, version: "2.0.0" }, "unsupported-receipt-version"],
      [{ ...first.receipt, fingerprint: "altered" }, "untrusted-receipt"],
      [{ id: first.receipt.id }, "malformed-receipt"],
    ] as const) {
      const repository: AcceptedSnapshotPublishReceiptRepository = {
        createOnce: vi.fn(),
        get: vi.fn(() => Promise.resolve(value)),
      };
      await expect(
        resolveAcceptedSnapshotPublishReceipt(repository, first.receipt.id),
      ).rejects.toMatchObject({ code });
    }
    await expect(
      resolveAcceptedSnapshotPublishReceipt(
        new InMemoryAcceptedSnapshotPublishReceiptRepository(),
        first.receipt.id,
      ),
    ).rejects.toMatchObject({ code: "missing-trusted-receipt" });
  });

  it("fails exact project, draft, proposal, review, snapshot, registry, manifest, profile, commerce, and asset drift", async () => {
    const harness = await mintInitial();
    const aggregate = await harness.projectRepository.get(harness.receipt.projectId);
    const authority = currentAuthority(harness.receipt);
    const checks: ReadonlyArray<{
      expected: string;
      aggregate?: ProjectAggregate;
      authority?: AcceptedSnapshotCurrentAuthority;
    }> = [
      {
        expected: "project-mismatch",
        aggregate: { ...aggregate, project: { ...aggregate.project, id: "project_other" } },
      },
      {
        expected: "draft-mismatch",
        aggregate: {
          ...aggregate,
          project: { ...aggregate.project, draftSnapshotId: aggregate.project.publishedSnapshotId },
        },
      },
      { expected: "proposal-mismatch", authority: { ...authority, proposalId: "proposal_other" } },
      {
        expected: "proposal-revision-mismatch",
        authority: { ...authority, proposalRevision: authority.proposalRevision + 1 },
      },
      {
        expected: "review-revision-mismatch",
        authority: { ...authority, reviewRevision: authority.reviewRevision + 1 },
      },
      {
        expected: "stale-project",
        aggregate: {
          ...aggregate,
          project: { ...aggregate.project, revision: aggregate.project.revision + 1 },
        },
      },
      {
        expected: "stale-draft",
        aggregate: {
          ...aggregate,
          snapshots: aggregate.snapshots.map((snapshot) =>
            snapshot.id === aggregate.project.draftSnapshotId
              ? { ...snapshot, revision: snapshot.revision + 1 }
              : snapshot,
          ),
        },
      },
      {
        expected: "component-registry-mismatch",
        authority: { ...authority, componentRegistryFingerprint: "registry_changed" },
      },
      {
        expected: "manifest-mismatch",
        authority: { ...authority, manifest: { version: "changed", fingerprint: "changed" } },
      },
      {
        expected: "package-registry-mismatch",
        authority: {
          ...authority,
          packageRegistry: { version: "changed", fingerprint: "changed" },
        },
      },
      {
        expected: "profile-authority-mismatch",
        authority: {
          ...authority,
          profileAuthorities: [{ profileId: "profile_changed", fingerprint: "changed" }],
        },
      },
      {
        expected: "commerce-mismatch",
        authority: { ...authority, commerceFingerprint: "commerce_changed" },
      },
      {
        expected: "approved-asset-mismatch",
        authority: { ...authority, approvedAssetFingerprint: "assets_changed" },
      },
      {
        expected: "accepted-lifecycle-mismatch",
        authority: { ...authority, acceptedRuntimeFingerprint: "runtime_after_undo" },
      },
    ];
    for (const check of checks) {
      expect(() =>
        assertAcceptedSnapshotReceiptCurrent(
          harness.receipt,
          check.aggregate ?? aggregate,
          check.authority ?? authority,
        ),
      ).toThrow(expect.objectContaining({ code: check.expected }));
    }
    const divergent = structuredClone(aggregate);
    divergent.snapshots.find(
      ({ id }) => id === divergent.project.draftSnapshotId,
    )!.pages[0].title.en = "Diverged";
    expect(() =>
      assertAcceptedSnapshotReceiptCurrent(harness.receipt, divergent, authority),
    ).toThrow(expect.objectContaining({ code: "stale-current-snapshot" }));
  });

  it("prepare and confirm resolve trusted storage, preserve identity, and revalidate independently", async () => {
    const harness = await mintInitial();
    const get = vi.spyOn(harness.receiptRepository, "get");
    const authoritySource = sourceFor(harness.receipt);
    const preparation = await preparePublish(harness.receipt.projectId, harness.projectRepository, {
      now: () => new Date(acceptedAt),
      createPreparationId: () => "publish_preparation_accepted_ai",
      authority: {
        kind: "accepted-ai",
        receiptId: harness.receipt.id,
        receiptRepository: harness.receiptRepository,
        currentAuthoritySource: authoritySource,
      },
    });
    expect(preparation.authority).toMatchObject({
      kind: "accepted-ai",
      receiptId: harness.receipt.id,
      receiptFingerprint: harness.receipt.fingerprint,
      proposalId: harness.receipt.proposalId,
    });

    const publish = vi.spyOn(harness.projectRepository, "publish");
    const staleSource = sourceFor(harness.receipt, (authority) => ({
      ...authority,
      acceptedRuntimeFingerprint: "runtime_after_undo",
    }));
    await expect(
      confirmPublish(preparation, harness.projectRepository, {
        authority: {
          kind: "accepted-ai",
          receiptRepository: harness.receiptRepository,
          currentAuthoritySource: staleSource,
        },
      }),
    ).rejects.toMatchObject({ code: "accepted-lifecycle-mismatch" });
    expect(get).toHaveBeenCalledTimes(2);
    expect(authoritySource.resolveCurrentAuthority).toHaveBeenCalledTimes(1);
    expect(staleSource.resolveCurrentAuthority).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it("invalidates accept-then-undo, permits exact redo authority, and rejects revision-only drift", async () => {
    const harness = await mintInitial();
    const aggregate = await harness.projectRepository.get(harness.receipt.projectId);
    const authority = currentAuthority(harness.receipt);
    expect(() =>
      assertAcceptedSnapshotReceiptCurrent(harness.receipt, aggregate, authority),
    ).not.toThrow();
    expect(() =>
      assertAcceptedSnapshotReceiptCurrent(harness.receipt, aggregate, {
        ...authority,
        acceptedRuntimeFingerprint: `accepted-runtime-${canonicalValueFingerprint(harness.proposal.originalStorefront)}`,
      }),
    ).toThrow(expect.objectContaining({ code: "accepted-lifecycle-mismatch" }));
    expect(() =>
      assertAcceptedSnapshotReceiptCurrent(harness.receipt, aggregate, authority),
    ).not.toThrow();
    expect(() =>
      assertAcceptedSnapshotReceiptCurrent(
        harness.receipt,
        {
          ...aggregate,
          project: { ...aggregate.project, revision: aggregate.project.revision + 1 },
        },
        authority,
      ),
    ).toThrow(expect.objectContaining({ code: "stale-project" }));
  });

  it("keeps manual publication explicit and prevents AI/manual authority fallback", async () => {
    const harness = await mintInitial();
    await expect(
      preparePublish(harness.receipt.projectId, harness.projectRepository, {
        authority: {
          kind: "accepted-ai",
          receiptId: harness.receipt.id,
          receiptRepository: new InMemoryAcceptedSnapshotPublishReceiptRepository(),
          currentAuthoritySource: sourceFor(harness.receipt),
        },
      }),
    ).rejects.toMatchObject({ code: "missing-trusted-receipt" });
    const manual = await preparePublish(harness.receipt.projectId, harness.projectRepository, {
      authority: { kind: "manual" },
    });
    expect(manual.authority).toEqual({ kind: "manual" });
    await expect(
      confirmPublish(manual, harness.projectRepository, {
        authority: {
          kind: "accepted-ai",
          receiptRepository: harness.receiptRepository,
          currentAuthoritySource: sourceFor(harness.receipt),
        },
      }),
    ).rejects.toMatchObject({ code: "publication-authority-confusion" });

    const aiPreparation = await preparePublish(
      harness.receipt.projectId,
      harness.projectRepository,
      {
        authority: {
          kind: "accepted-ai",
          receiptId: harness.receipt.id,
          receiptRepository: harness.receiptRepository,
          currentAuthoritySource: sourceFor(harness.receipt),
        },
      },
    );
    await expect(confirmPublish(aiPreparation, harness.projectRepository)).rejects.toMatchObject({
      code: "publication-authority-confusion",
    });
  });
});
