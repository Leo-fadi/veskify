// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AuthoritativeAcceptedAiReceiptService,
  type AuthoritativeGovernedProposalAcceptanceSource,
  type TrustedRecordedProposalAcceptance,
} from "@/application/accepted-ai-receipt-wiring/index.server";
import {
  AcceptedSnapshotReceiptError,
  InMemoryAcceptedSnapshotPublishReceiptRepository,
  type AcceptedSnapshotCurrentAuthority,
  type AcceptedSnapshotPublishReceipt,
} from "@/application/accepted-snapshot-publishing";
import {
  executeGovernedFollowUpEditing,
  governedSkillPackageRegistry,
  skillCapabilityKnowledge,
  type GovernedFollowUpEditingRequest,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills";
import { planRegisteredTokenRefinement } from "@/application/ai-storefront-generation";
import {
  createMerchantProjectAuthorization,
  createStandaloneMerchantProjectContextPort,
} from "@/application/merchant-project-context";
import { confirmPublish, preparePublish } from "@/application/publishing";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
} from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  type WholeStorefrontProposalAuthorityInput,
} from "@/application/whole-storefront-proposal-lifecycle";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { canonicalValueString } from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";

const acceptedAt = "2026-08-07T09:30:00.000Z";

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

function followUpProposal() {
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
    requestIdentity: "p10a-08b-02-follow-up",
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
  return {
    fixture,
    planningInput: result.planningInput,
    currentInput: {
      plan: result.coordinatedPlan,
      planningInput: result.planningInput,
    } satisfies WholeStorefrontProposalAuthorityInput,
    proposal: result.proposal,
  };
}

async function harness(
  sourceKind: "initialGeneration" | "governedFollowUp" = "initialGeneration",
  options: {
    omitFirstReceiptRecord?: boolean;
    permissionDenied?: boolean;
    receiptRepository?: InMemoryAcceptedSnapshotPublishReceiptRepository;
  } = {},
) {
  const initial = (() => {
    if (sourceKind === "governedFollowUp") return followUpProposal();
    const fixture = createP905aFreshMerchantFixture("modernTechnical");
    const planningInput = structuredClone(fixture.planningInput);
    const plan = createWholeStorefrontGenerationPlan(planningInput, {
      directionId: "modernTechnical",
    });
    return {
      fixture,
      planningInput,
      currentInput: { plan, planningInput } satisfies WholeStorefrontProposalAuthorityInput,
      proposal: compileWholeStorefrontProposal({ plan, planningInput }),
    };
  })();
  const projectRepository = new InMemoryProjectRepository([initial.fixture.aggregate]);
  const receiptRepository =
    options.receiptRepository ?? new InMemoryAcceptedSnapshotPublishReceiptRepository();
  const target = createWholeStorefrontGenerationTarget(initial.planningInput);
  let authoritativeRevision = 4;
  let accepted: TrustedRecordedProposalAcceptance | null = null;
  let omitReceiptRecord = options.omitFirstReceiptRecord ?? false;
  let currentAuthorityMutation = (
    authority: AcceptedSnapshotCurrentAuthority,
  ): AcceptedSnapshotCurrentAuthority => authority;
  const contextPort = createStandaloneMerchantProjectContextPort({
    projectRepository,
    tenantId: "tenant_accepted_ai",
    userId: "user_accepted_ai",
    merchantId: "merchant_accepted_ai",
    organizationId: "organization_accepted_ai",
    storeId: "store_accepted_ai",
  });
  const authorized = createMerchantProjectAuthorization(
    await contextPort.load({
      tenantId: "tenant_accepted_ai",
      storefrontProjectId: initial.planningInput.project.id,
    }),
  );
  const authorization = options.permissionDenied ? { ...authorized, actions: [] } : authorized;
  const resolveForAcceptance = vi.fn<
    AuthoritativeGovernedProposalAcceptanceSource["resolveForAcceptance"]
  >(() =>
    Promise.resolve({
      authorization,
      authorityRevision: authoritativeRevision,
      browserProposalId: `browser_${initial.proposal.id}`,
      proposalRevision: 2,
      reviewRevision: 3,
      reviewed: true,
      proposal: structuredClone(initial.proposal),
      currentInput: structuredClone(initial.currentInput),
      materialization: {
        planningInput: structuredClone(initial.planningInput),
        approvedAssetPresentations: structuredClone(initial.fixture.assetPresentations),
      },
      mintAuthority: {
        proposalRevision: 2,
        reviewRevision: 3,
        componentRegistryFingerprint: target.registryFingerprint,
        manifest: skillCapabilityKnowledge.getManifestReference(),
        packageRegistry: {
          version: governedSkillPackageRegistry.version,
          fingerprint: governedSkillPackageRegistry.fingerprint,
        },
        profileAuthorities: [],
        commerceFingerprint: target.canonicalCommerceFingerprint,
        approvedAssetFingerprint: target.approvedAssetContextFingerprint,
      },
      sourceKind,
      accepted: accepted === null ? null : structuredClone(accepted),
    }),
  );
  const commitAcceptance = vi.fn<AuthoritativeGovernedProposalAcceptanceSource["commitAcceptance"]>(
    async ({ request, lifecycle, acceptedSnapshot, acceptedAt: time }) => {
      await projectRepository.saveDraft(initial.planningInput.project.id, acceptedSnapshot, {
        id: initial.planningInput.draft.id,
        revision: initial.planningInput.draft.revision,
      });
      authoritativeRevision += 1;
      accepted = {
        request: structuredClone(request),
        acceptedAt: time,
        authoritativeRevision,
        lifecycle: structuredClone(lifecycle),
        acceptedSnapshot: structuredClone(acceptedSnapshot),
        receiptId: null,
      };
      return { authoritativeRevision };
    },
  );
  const recordReceipt = vi.fn<AuthoritativeGovernedProposalAcceptanceSource["recordReceipt"]>(
    ({ receipt }) => {
      if (omitReceiptRecord) {
        omitReceiptRecord = false;
        return Promise.resolve();
      }
      if (!accepted) throw new Error("Acceptance must precede receipt retention.");
      accepted = { ...accepted, receiptId: receipt.id };
      return Promise.resolve();
    },
  );
  const resolveCurrentAuthority = vi.fn<
    AuthoritativeGovernedProposalAcceptanceSource["resolveCurrentAuthority"]
  >(({ receipt }) => Promise.resolve(currentAuthorityMutation(currentAuthority(receipt))));
  const source: AuthoritativeGovernedProposalAcceptanceSource = {
    resolveForAcceptance,
    commitAcceptance,
    recordReceipt,
    resolveCurrentAuthority,
  };
  const service = new AuthoritativeAcceptedAiReceiptService({
    projectRepository,
    receiptRepository,
    authoritySource: source,
    now: () => new Date(acceptedAt),
  });
  const request = {
    projectId: initial.planningInput.project.id,
    proposalId: `browser_${initial.proposal.id}`,
    acceptanceActionId: `acceptance_action_${sourceKind.toLocaleLowerCase()}`,
    expectedAuthorityRevision: 4,
    expectedProjectRevision: initial.planningInput.project.revision,
    expectedDraftId: initial.planningInput.draft.id,
    expectedDraftRevision: initial.planningInput.draft.revision,
  } as const;
  return {
    ...initial,
    projectRepository,
    receiptRepository,
    source,
    commitAcceptance,
    recordReceipt,
    resolveCurrentAuthority,
    service,
    request,
    setCurrentAuthorityMutation(mutation: typeof currentAuthorityMutation) {
      currentAuthorityMutation = mutation;
    },
  };
}

const httpRequest = new Request("http://localhost/api/demo/p9-05b/accept", {
  method: "POST",
});

describe("P10A-08B-02 accepted-AI acceptance-to-receipt wiring", () => {
  it("accepts the exact server proposal, persists its canonical snapshot, and returns only receipt identity", async () => {
    const setup = await harness();
    const before = await setup.projectRepository.get(setup.request.projectId);

    const result = await setup.service.accept(setup.request, httpRequest);
    const after = await setup.projectRepository.get(setup.request.projectId);
    const receipt = await setup.receiptRepository.get(result.receiptId);

    expect(typeof result.receiptId).toBe("string");
    expect(result).toStrictEqual({ receiptId: result.receiptId, authoritativeRevision: 5 });
    expect(Object.keys(result).sort()).toEqual(["authoritativeRevision", "receiptId"]);
    expect(canonicalValueString(after)).not.toBe(canonicalValueString(before));
    expect(receipt).toMatchObject({
      projectId: setup.request.projectId,
      proposalId: setup.proposal.id,
      sourceKind: "initialGeneration",
      acceptanceActionId: setup.request.acceptanceActionId,
    });
    expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
  });

  it("mints once and recovers the same durable receipt after acceptance/receipt-record interruption", async () => {
    const setup = await harness("initialGeneration", { omitFirstReceiptRecord: true });
    const first = await setup.service.accept(setup.request, httpRequest);
    const second = await setup.service.accept(setup.request, httpRequest);

    expect(second).toStrictEqual(first);
    expect(setup.commitAcceptance).toHaveBeenCalledTimes(1);
    expect(setup.recordReceipt).toHaveBeenCalledTimes(2);
  });

  it("rejects conflicting reuse, stale preconditions, and missing merchant acceptance permission without a receipt", async () => {
    const collision = await harness();
    await collision.service.accept(collision.request, httpRequest);
    await expect(
      collision.service.accept(
        {
          ...collision.request,
          expectedDraftRevision: collision.request.expectedDraftRevision + 1,
        },
        httpRequest,
      ),
    ).rejects.toMatchObject({ code: "receipt-collision" });

    const stale = await harness();
    await expect(
      stale.service.accept({ ...stale.request, expectedAuthorityRevision: 99 }, httpRequest),
    ).rejects.toMatchObject({ code: "stale-authority" });
    expect(await stale.receiptRepository.get("acceptance_receipt_missing")).toBeNull();

    const denied = await harness("initialGeneration", { permissionDenied: true });
    await expect(denied.service.accept(denied.request, httpRequest)).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(denied.commitAcceptance).not.toHaveBeenCalled();
  });

  it("uses the same server acceptance authority for governed follow-up proposals", async () => {
    const setup = await harness("governedFollowUp");
    const result = await setup.service.accept(setup.request, httpRequest);

    await expect(setup.receiptRepository.get(result.receiptId)).resolves.toMatchObject({
      proposalId: setup.proposal.id,
      sourceKind: "governedFollowUp",
    });
  });

  it("mints a different receipt for a later governed proposal acceptance", async () => {
    const receipts = new InMemoryAcceptedSnapshotPublishReceiptRepository();
    const initial = await harness("initialGeneration", { receiptRepository: receipts });
    const followUp = await harness("governedFollowUp", { receiptRepository: receipts });

    const first = await initial.service.accept(initial.request, httpRequest);
    const second = await followUp.service.accept(followUp.request, httpRequest);

    expect(followUp.proposal.id).not.toBe(initial.proposal.id);
    expect(second.receiptId).not.toBe(first.receiptId);
  });

  it("prepares and confirms accepted-AI publication by independently resolving receipt and current authority", async () => {
    const setup = await harness();
    const acceptance = await setup.service.accept(setup.request, httpRequest);
    const preparation = await preparePublish(setup.request.projectId, setup.projectRepository, {
      now: () => new Date("2026-08-07T10:00:00.000Z"),
      authority: {
        kind: "accepted-ai",
        receiptId: acceptance.receiptId,
        receiptRepository: setup.receiptRepository,
        currentAuthoritySource: setup.service,
      },
    });
    const published = await confirmPublish(preparation, setup.projectRepository, {
      authority: {
        kind: "accepted-ai",
        receiptRepository: setup.receiptRepository,
        currentAuthoritySource: setup.service,
      },
    });

    expect(preparation.authority).toMatchObject({
      kind: "accepted-ai",
      receiptId: acceptance.receiptId,
    });
    expect(published.aggregate.project.revision).toBe(setup.planningInput.project.revision + 1);
    expect(setup.resolveCurrentAuthority).toHaveBeenCalledTimes(2);
  });

  it("fails closed before publication when current proposal authority changes after acceptance", async () => {
    const setup = await harness();
    const acceptance = await setup.service.accept(setup.request, httpRequest);
    setup.setCurrentAuthorityMutation((authority) => ({
      ...authority,
      proposalRevision: authority.proposalRevision + 1,
    }));

    await expect(
      preparePublish(setup.request.projectId, setup.projectRepository, {
        authority: {
          kind: "accepted-ai",
          receiptId: acceptance.receiptId,
          receiptRepository: setup.receiptRepository,
          currentAuthoritySource: setup.service,
        },
      }),
    ).rejects.toEqual(expect.any(AcceptedSnapshotReceiptError));
  });
});
