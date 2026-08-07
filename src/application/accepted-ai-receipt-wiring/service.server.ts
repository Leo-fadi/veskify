import "server-only";

import {
  AcceptedSnapshotPublishingAuthorityService,
  type AcceptedSnapshotMintAuthority,
} from "@/application/accepted-snapshot-publishing/index.server";
import {
  AcceptedSnapshotReceiptError,
  acceptedSnapshotPublishReceiptIdForAcceptanceAction,
  resolveAcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotCurrentAuthoritySource,
  type AcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceiptRepository,
} from "@/application/accepted-snapshot-publishing";
import {
  requireMerchantProjectAction,
  type MerchantProjectAuthorization,
} from "@/application/merchant-project-context";
import {
  WholeStorefrontProposalAcceptanceCoordinator,
  materializeWholeStorefrontRuntimeSnapshot,
  type WholeStorefrontProposal,
  type WholeStorefrontProposalAuthorityInput,
  type WholeStorefrontProposalLifecycleSnapshot,
  type WholeStorefrontRuntimeState,
} from "@/application/whole-storefront-proposal-lifecycle";
import type {
  ApprovedAssetPresentation,
  WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type { ProjectRepository } from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import {
  AcceptedAiReceiptWiringError,
  acceptedAiProposalAcceptanceRequestSchema,
  acceptedAiProposalAcceptanceResultSchema,
  type AcceptedAiProposalAcceptanceRequest,
  type AcceptedAiProposalAcceptanceResult,
} from "./contract";

export type TrustedGovernedProposalAcceptance = Readonly<{
  authorization: MerchantProjectAuthorization;
  authorityRevision: number;
  browserProposalId: string;
  proposalRevision: number;
  reviewRevision: number;
  reviewed: boolean;
  proposal: WholeStorefrontProposal;
  currentInput: WholeStorefrontProposalAuthorityInput;
  storedStorefront?: WholeStorefrontRuntimeState;
  publishedStorefront?: WholeStorefrontRuntimeState;
  materialization: Readonly<{
    planningInput: WholeStorefrontPlanningInput;
    approvedAssetPresentations?: readonly ApprovedAssetPresentation[];
  }>;
  mintAuthority: AcceptedSnapshotMintAuthority;
  sourceKind: "initialGeneration" | "governedFollowUp";
  accepted: TrustedRecordedProposalAcceptance | null;
}>;

export type TrustedRecordedProposalAcceptance = Readonly<{
  request: AcceptedAiProposalAcceptanceRequest;
  acceptedAt: string;
  authoritativeRevision: number;
  lifecycle: WholeStorefrontProposalLifecycleSnapshot;
  acceptedSnapshot: StorefrontSnapshot;
  receiptId: string | null;
}>;

export interface AuthoritativeGovernedProposalAcceptanceSource {
  resolveForAcceptance(input: {
    request: AcceptedAiProposalAcceptanceRequest;
    httpRequest: Request;
  }): Promise<TrustedGovernedProposalAcceptance>;
  commitAcceptance(input: {
    authority: TrustedGovernedProposalAcceptance;
    request: AcceptedAiProposalAcceptanceRequest;
    lifecycle: WholeStorefrontProposalLifecycleSnapshot;
    acceptedSnapshot: StorefrontSnapshot;
    acceptedAt: string;
  }): Promise<{ authoritativeRevision: number }>;
  recordReceipt(input: {
    authority: TrustedGovernedProposalAcceptance;
    request: AcceptedAiProposalAcceptanceRequest;
    receipt: AcceptedSnapshotPublishReceipt;
  }): Promise<void>;
  resolveCurrentAuthority: AcceptedSnapshotCurrentAuthoritySource["resolveCurrentAuthority"];
}

export type AuthoritativeAcceptedAiReceiptServiceOptions = Readonly<{
  projectRepository: ProjectRepository;
  receiptRepository: AcceptedSnapshotPublishReceiptRepository;
  authoritySource: AuthoritativeGovernedProposalAcceptanceSource;
  now?: () => Date;
}>;

function currentDraft(aggregate: ReturnType<typeof validateProjectAggregate>): StorefrontSnapshot {
  const draft = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
  );
  if (!draft) throw new AcceptedAiReceiptWiringError("stale-authority");
  return draft;
}

function assertAuthorizationAndProject(
  request: AcceptedAiProposalAcceptanceRequest,
  authority: TrustedGovernedProposalAcceptance,
  aggregate: ReturnType<typeof validateProjectAggregate>,
): void {
  let context;
  try {
    context = requireMerchantProjectAction(authority.authorization, "accept-design-proposal");
  } catch (cause) {
    throw new AcceptedAiReceiptWiringError("permission-denied", { cause });
  }
  currentDraft(aggregate);
  if (
    context.storefrontProjectId !== request.projectId ||
    aggregate.project.id !== request.projectId
  ) {
    throw new AcceptedAiReceiptWiringError("project-mismatch");
  }
}

function assertRequestAuthority(
  request: AcceptedAiProposalAcceptanceRequest,
  authority: TrustedGovernedProposalAcceptance,
  aggregate: ReturnType<typeof validateProjectAggregate>,
): void {
  assertAuthorizationAndProject(request, authority, aggregate);
  const draft = currentDraft(aggregate);
  if (
    authority.authorityRevision !== request.expectedAuthorityRevision ||
    aggregate.project.revision !== request.expectedProjectRevision ||
    aggregate.project.draftSnapshotId !== request.expectedDraftId ||
    draft.id !== request.expectedDraftId ||
    draft.revision !== request.expectedDraftRevision
  ) {
    throw new AcceptedAiReceiptWiringError("stale-authority");
  }
  if (
    authority.browserProposalId !== request.proposalId ||
    authority.proposal.projectId !== request.projectId ||
    authority.proposal.draftSnapshotId !== request.expectedDraftId
  ) {
    throw new AcceptedAiReceiptWiringError("proposal-mismatch");
  }
  if (!authority.reviewed) {
    throw new AcceptedAiReceiptWiringError("proposal-not-reviewed");
  }
  if (
    authority.materialization.planningInput.project.id !== aggregate.project.id ||
    authority.materialization.planningInput.project.revision !== aggregate.project.revision ||
    canonicalValueString(authority.materialization.planningInput.draft) !==
      canonicalValueString(draft)
  ) {
    throw new AcceptedAiReceiptWiringError("stale-authority");
  }
}

function assertExactRetry(
  request: AcceptedAiProposalAcceptanceRequest,
  accepted: TrustedRecordedProposalAcceptance,
): void {
  if (canonicalValueString(request) !== canonicalValueString(accepted.request)) {
    throw new AcceptedSnapshotReceiptError("receipt-collision");
  }
}

function assertStoredReceiptMatchesAcceptance(
  receipt: AcceptedSnapshotPublishReceipt,
  authority: TrustedGovernedProposalAcceptance,
  request: AcceptedAiProposalAcceptanceRequest,
  accepted: TrustedRecordedProposalAcceptance,
): void {
  if (
    receipt.acceptanceActionId !== request.acceptanceActionId ||
    receipt.proposalId !== authority.proposal.id ||
    receipt.proposalRevision !== authority.proposalRevision ||
    receipt.reviewRevision !== authority.reviewRevision ||
    receipt.acceptedAt !== accepted.acceptedAt ||
    receipt.sourceKind !== authority.sourceKind ||
    receipt.acceptedSnapshotId !== accepted.acceptedSnapshot.id ||
    receipt.acceptedSnapshotFingerprint !==
      canonicalStorefrontContentFingerprint(accepted.acceptedSnapshot)
  ) {
    throw new AcceptedSnapshotReceiptError("receipt-collision");
  }
}

export class AuthoritativeAcceptedAiReceiptService implements AcceptedSnapshotCurrentAuthoritySource {
  readonly #projectRepository: ProjectRepository;
  readonly #receiptRepository: AcceptedSnapshotPublishReceiptRepository;
  readonly #authoritySource: AuthoritativeGovernedProposalAcceptanceSource;
  readonly #minting: AcceptedSnapshotPublishingAuthorityService;
  readonly #now: () => Date;

  constructor(options: AuthoritativeAcceptedAiReceiptServiceOptions) {
    this.#projectRepository = options.projectRepository;
    this.#receiptRepository = options.receiptRepository;
    this.#authoritySource = options.authoritySource;
    this.#minting = new AcceptedSnapshotPublishingAuthorityService({
      projectRepository: options.projectRepository,
      receiptRepository: options.receiptRepository,
    });
    this.#now = options.now ?? (() => new Date());
  }

  resolveCurrentAuthority(
    input: Parameters<AcceptedSnapshotCurrentAuthoritySource["resolveCurrentAuthority"]>[0],
  ): Promise<unknown> {
    return this.#authoritySource.resolveCurrentAuthority(input);
  }

  async accept(
    inputValue: unknown,
    httpRequest: Request,
  ): Promise<AcceptedAiProposalAcceptanceResult> {
    const request = acceptedAiProposalAcceptanceRequestSchema.safeParse(inputValue);
    if (!request.success) throw new AcceptedAiReceiptWiringError("invalid-request");
    const authority = await this.#authoritySource.resolveForAcceptance({
      request: request.data,
      httpRequest,
    });
    const aggregate = validateProjectAggregate(
      await this.#projectRepository.get(request.data.projectId),
    );
    assertAuthorizationAndProject(request.data, authority, aggregate);

    if (authority.accepted !== null) {
      assertExactRetry(request.data, authority.accepted);
      const receiptId =
        authority.accepted.receiptId ??
        acceptedSnapshotPublishReceiptIdForAcceptanceAction(request.data.acceptanceActionId);
      let receipt: AcceptedSnapshotPublishReceipt;
      if (authority.accepted.receiptId === null) {
        const retained = await this.#receiptRepository.get(receiptId);
        if (retained === null) {
          try {
            receipt = await this.#minting.mintAfterAcceptance({
              lifecycle: authority.accepted.lifecycle,
              acceptedSnapshot: authority.accepted.acceptedSnapshot,
              materialization: authority.materialization,
              authority: authority.mintAuthority,
              acceptanceActionId: request.data.acceptanceActionId,
              acceptedAt: authority.accepted.acceptedAt,
              sourceKind: authority.sourceKind,
            });
          } catch (error) {
            if (
              !(error instanceof AcceptedSnapshotReceiptError) ||
              error.code !== "receipt-replay"
            ) {
              throw error;
            }
            receipt = await resolveAcceptedSnapshotPublishReceipt(
              this.#receiptRepository,
              receiptId,
            );
          }
        } else {
          receipt = await resolveAcceptedSnapshotPublishReceipt(this.#receiptRepository, receiptId);
        }
      } else {
        receipt = await resolveAcceptedSnapshotPublishReceipt(this.#receiptRepository, receiptId);
      }
      assertStoredReceiptMatchesAcceptance(receipt, authority, request.data, authority.accepted);
      if (authority.accepted.receiptId === null) {
        await this.#authoritySource.recordReceipt({
          authority,
          request: request.data,
          receipt,
        });
      }
      return acceptedAiProposalAcceptanceResultSchema.parse({
        receiptId: receipt.id,
        authoritativeRevision: authority.accepted.authoritativeRevision,
      });
    }

    const deterministicReceiptId = acceptedSnapshotPublishReceiptIdForAcceptanceAction(
      request.data.acceptanceActionId,
    );
    if ((await this.#receiptRepository.get(deterministicReceiptId)) !== null) {
      throw new AcceptedSnapshotReceiptError("receipt-collision");
    }

    assertRequestAuthority(request.data, authority, aggregate);

    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal: authority.proposal,
      currentInput: () => authority.currentInput,
      storedStorefront: authority.storedStorefront,
      publishedStorefront: authority.publishedStorefront,
    });
    const lifecycle = coordinator.accept();
    if (
      lifecycle.state !== "accepted" ||
      lifecycle.failure !== null ||
      lifecycle.transaction === null
    ) {
      throw new AcceptedAiReceiptWiringError(
        lifecycle.state === "stale" ? "stale-authority" : "acceptance-failed",
      );
    }
    const acceptedSnapshot = materializeWholeStorefrontRuntimeSnapshot({
      runtime: lifecycle.activeStorefront,
      planningInput: authority.materialization.planningInput,
      approvedAssetPresentations: authority.materialization.approvedAssetPresentations,
    });
    const acceptedAt = this.#now().toISOString();
    const committed = await this.#authoritySource.commitAcceptance({
      authority,
      request: request.data,
      lifecycle,
      acceptedSnapshot,
      acceptedAt,
    });
    const current = validateProjectAggregate(
      await this.#projectRepository.get(request.data.projectId),
    );
    const persistedDraft = currentDraft(current);
    if (
      canonicalValueString(persistedDraft) !== canonicalValueString(acceptedSnapshot) ||
      canonicalStorefrontContentFingerprint(persistedDraft) !==
        canonicalStorefrontContentFingerprint(acceptedSnapshot)
    ) {
      throw new AcceptedAiReceiptWiringError("stale-authority");
    }
    const receipt = await this.#minting.mintAfterAcceptance({
      lifecycle,
      acceptedSnapshot,
      materialization: authority.materialization,
      authority: authority.mintAuthority,
      acceptanceActionId: request.data.acceptanceActionId,
      acceptedAt,
      sourceKind: authority.sourceKind,
    });
    await this.#authoritySource.recordReceipt({
      authority,
      request: request.data,
      receipt,
    });
    return acceptedAiProposalAcceptanceResultSchema.parse({
      receiptId: receipt.id,
      authoritativeRevision: committed.authoritativeRevision,
    });
  }
}
