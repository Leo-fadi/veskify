import "server-only";

import type { z } from "zod";
import {
  type ApprovedAssetPresentation,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import {
  materializeWholeStorefrontRuntimeSnapshot,
  wholeStorefrontProposalSchema,
  WholeStorefrontSnapshotMaterializationError,
  type WholeStorefrontProposalLifecycleSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import type { ProjectRepository } from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import {
  AcceptedSnapshotReceiptError,
  acceptedSnapshotCurrentAuthoritySchema,
  acceptedSnapshotPublishReceiptIdForAcceptanceAction,
  acceptedSnapshotPublishReceiptFingerprint,
  acceptedSnapshotProposalFingerprint,
  acceptedSnapshotReviewFingerprint,
  acceptedSnapshotRuntimeFingerprint,
  acceptedSnapshotPublishReceiptSchema,
  acceptedSnapshotPublishReceiptVersion,
  resolveAcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceiptRepository,
} from "./receipt";

const mintAuthoritySchema = acceptedSnapshotCurrentAuthoritySchema.omit({
  proposalId: true,
  proposalFingerprint: true,
  reviewFingerprint: true,
  acceptedRuntimeFingerprint: true,
});

export type AcceptedSnapshotMintAuthority = z.infer<typeof mintAuthoritySchema>;

export type MintAcceptedSnapshotPublishReceiptInput = Readonly<{
  lifecycle: WholeStorefrontProposalLifecycleSnapshot;
  acceptedSnapshot: unknown;
  materialization: Readonly<{
    planningInput: WholeStorefrontPlanningInput;
    approvedAssetPresentations?: readonly ApprovedAssetPresentation[];
  }>;
  authority: AcceptedSnapshotMintAuthority;
  acceptanceActionId: string;
  acceptedAt: string;
  sourceKind: "initialGeneration" | "governedFollowUp";
}>;

export type AcceptedSnapshotPublishingAuthorityServiceOptions = Readonly<{
  projectRepository: ProjectRepository;
  receiptRepository: AcceptedSnapshotPublishReceiptRepository;
  createReceiptId?: (input: { acceptanceActionId: string; receiptFingerprint: string }) => string;
}>;

function defaultReceiptId(input: {
  acceptanceActionId: string;
  receiptFingerprint: string;
}): string {
  return acceptedSnapshotPublishReceiptIdForAcceptanceAction(input.acceptanceActionId);
}

function assertAcceptedLifecycle(
  lifecycle: WholeStorefrontProposalLifecycleSnapshot,
): z.infer<typeof wholeStorefrontProposalSchema> {
  const proposal = wholeStorefrontProposalSchema.safeParse(lifecycle.proposal);
  if (!proposal.success) {
    throw new AcceptedSnapshotReceiptError("malformed-receipt", { cause: proposal.error });
  }
  if (proposal.data.status !== "accepted" || lifecycle.state !== "accepted") {
    throw new AcceptedSnapshotReceiptError("proposal-not-accepted");
  }
  if (
    lifecycle.failure !== null ||
    lifecycle.transaction === null ||
    lifecycle.transaction.proposalId !== proposal.data.id ||
    canonicalValueString(lifecycle.transaction.original) !==
      canonicalValueString(proposal.data.originalStorefront) ||
    canonicalValueString(lifecycle.transaction.resulting) !==
      canonicalValueString(proposal.data.proposedStorefront) ||
    canonicalValueString(lifecycle.activeStorefront) !==
      canonicalValueString(proposal.data.proposedStorefront)
  ) {
    throw new AcceptedSnapshotReceiptError("accepted-lifecycle-mismatch");
  }
  return proposal.data;
}

export class AcceptedSnapshotPublishingAuthorityService {
  readonly #projectRepository: ProjectRepository;
  readonly #receiptRepository: AcceptedSnapshotPublishReceiptRepository;
  readonly #createReceiptId: NonNullable<
    AcceptedSnapshotPublishingAuthorityServiceOptions["createReceiptId"]
  >;

  constructor(options: AcceptedSnapshotPublishingAuthorityServiceOptions) {
    this.#projectRepository = options.projectRepository;
    this.#receiptRepository = options.receiptRepository;
    this.#createReceiptId = options.createReceiptId ?? defaultReceiptId;
  }

  async mintAfterAcceptance(
    input: MintAcceptedSnapshotPublishReceiptInput,
  ): Promise<AcceptedSnapshotPublishReceipt> {
    const proposal = assertAcceptedLifecycle(input.lifecycle);
    const snapshot = storefrontSnapshotSchema.safeParse(input.acceptedSnapshot);
    if (!snapshot.success) {
      throw new AcceptedSnapshotReceiptError("snapshot-mismatch", { cause: snapshot.error });
    }
    const authority = mintAuthoritySchema.safeParse(input.authority);
    if (!authority.success) {
      throw new AcceptedSnapshotReceiptError("malformed-receipt", {
        cause: authority.error,
      });
    }
    const acceptanceActionId = idSchema.safeParse(input.acceptanceActionId);
    const acceptedAt = isoDateTimeSchema.safeParse(input.acceptedAt);
    if (!acceptanceActionId.success || !acceptedAt.success) {
      throw new AcceptedSnapshotReceiptError("malformed-receipt", {
        cause: acceptanceActionId.success ? acceptedAt.error : acceptanceActionId.error,
      });
    }

    let proposalSnapshot: ReturnType<typeof materializeWholeStorefrontRuntimeSnapshot>;
    try {
      proposalSnapshot = materializeWholeStorefrontRuntimeSnapshot({
        runtime: proposal.proposedStorefront,
        planningInput: input.materialization.planningInput,
        approvedAssetPresentations: input.materialization.approvedAssetPresentations,
      });
    } catch (error) {
      if (error instanceof WholeStorefrontSnapshotMaterializationError) {
        throw new AcceptedSnapshotReceiptError("accepted-proposal-content-mismatch", {
          cause: error,
        });
      }
      throw error;
    }
    const snapshotFingerprint = canonicalStorefrontContentFingerprint(snapshot.data);
    if (
      canonicalStorefrontContentFingerprint(proposalSnapshot) !== snapshotFingerprint ||
      canonicalValueString(proposalSnapshot) !== canonicalValueString(snapshot.data)
    ) {
      throw new AcceptedSnapshotReceiptError("accepted-proposal-content-mismatch");
    }

    const aggregate = validateProjectAggregate(
      await this.#projectRepository.get(proposal.projectId),
    );
    const currentDraft = aggregate.snapshots.find(
      ({ id }) => id === aggregate.project.draftSnapshotId,
    );
    if (
      aggregate.project.id !== proposal.projectId ||
      snapshot.data.projectId !== proposal.projectId
    ) {
      throw new AcceptedSnapshotReceiptError("project-mismatch");
    }
    if (
      aggregate.project.draftSnapshotId !== proposal.draftSnapshotId ||
      snapshot.data.id !== proposal.draftSnapshotId
    ) {
      throw new AcceptedSnapshotReceiptError("draft-mismatch");
    }
    if (!currentDraft || currentDraft.id !== snapshot.data.id) {
      throw new AcceptedSnapshotReceiptError("stale-current-snapshot");
    }
    if (
      aggregate.project.revision !== proposal.preconditions.projectRevision ||
      proposal.proposedStorefront.projectRevision !== aggregate.project.revision
    ) {
      throw new AcceptedSnapshotReceiptError("stale-project");
    }
    if (
      snapshot.data.revision !== proposal.draftRevision ||
      proposal.proposedStorefront.draftRevision !== snapshot.data.revision
    ) {
      throw new AcceptedSnapshotReceiptError("stale-draft");
    }
    if (
      snapshotFingerprint !== canonicalStorefrontContentFingerprint(currentDraft) ||
      canonicalValueString(snapshot.data) !== canonicalValueString(currentDraft)
    ) {
      throw new AcceptedSnapshotReceiptError("snapshot-mismatch");
    }
    if (
      authority.data.componentRegistryFingerprint !==
        proposal.preconditions.componentRegistryFingerprint ||
      authority.data.componentRegistryFingerprint !==
        proposal.proposedStorefront.componentRegistryFingerprint
    ) {
      throw new AcceptedSnapshotReceiptError("component-registry-mismatch");
    }
    if (
      authority.data.commerceFingerprint !== proposal.preconditions.canonicalCommerceFingerprint ||
      authority.data.commerceFingerprint !==
        proposal.proposedStorefront.canonicalCommerceFingerprint
    ) {
      throw new AcceptedSnapshotReceiptError("commerce-mismatch");
    }
    if (
      authority.data.approvedAssetFingerprint !== proposal.preconditions.assetContextFingerprint ||
      authority.data.approvedAssetFingerprint !==
        proposal.proposedStorefront.approvedAssetContextFingerprint
    ) {
      throw new AcceptedSnapshotReceiptError("approved-asset-mismatch");
    }
    const proposalManifest =
      proposal.preconditions.manifestVersion && proposal.preconditions.manifestFingerprint
        ? {
            version: proposal.preconditions.manifestVersion,
            fingerprint: proposal.preconditions.manifestFingerprint,
          }
        : null;
    if (
      proposalManifest !== null &&
      canonicalValueString(authority.data.manifest) !== canonicalValueString(proposalManifest)
    ) {
      throw new AcceptedSnapshotReceiptError("manifest-mismatch");
    }
    const proposalPackageRegistry =
      proposal.preconditions.packageRegistryVersion &&
      proposal.preconditions.packageRegistryFingerprint
        ? {
            version: proposal.preconditions.packageRegistryVersion,
            fingerprint: proposal.preconditions.packageRegistryFingerprint,
          }
        : null;
    if (
      proposalPackageRegistry !== null &&
      canonicalValueString(authority.data.packageRegistry) !==
        canonicalValueString(proposalPackageRegistry)
    ) {
      throw new AcceptedSnapshotReceiptError("package-registry-mismatch");
    }
    if (input.sourceKind === "governedFollowUp" && authority.data.packageRegistry === null) {
      throw new AcceptedSnapshotReceiptError("package-registry-mismatch");
    }

    const unsignedWithoutId = {
      version: acceptedSnapshotPublishReceiptVersion,
      projectId: proposal.projectId,
      draftId: proposal.draftSnapshotId,
      proposalId: proposal.id,
      proposalRevision: authority.data.proposalRevision,
      proposalFingerprint: acceptedSnapshotProposalFingerprint(proposal),
      reviewRevision: authority.data.reviewRevision,
      reviewFingerprint: acceptedSnapshotReviewFingerprint(proposal.reviewSummary),
      acceptedRuntimeFingerprint: acceptedSnapshotRuntimeFingerprint(proposal.proposedStorefront),
      acceptedSnapshotId: snapshot.data.id,
      acceptedSnapshotFingerprint: snapshotFingerprint,
      projectRevision: aggregate.project.revision,
      draftRevision: snapshot.data.revision,
      componentRegistryFingerprint: authority.data.componentRegistryFingerprint,
      manifest: authority.data.manifest,
      packageRegistry: authority.data.packageRegistry,
      profileAuthorities: [...authority.data.profileAuthorities].sort((left, right) =>
        left.profileId.localeCompare(right.profileId),
      ),
      commerceFingerprint: authority.data.commerceFingerprint,
      approvedAssetFingerprint: authority.data.approvedAssetFingerprint,
      evidenceReferences:
        input.materialization.planningInput.brief.approvedEvidenceFingerprint &&
        input.materialization.planningInput.brief.approval.actorId &&
        input.materialization.planningInput.brief.businessIdentity.shortDescription.trim()
          ? [
              {
                source: "merchant-approved" as const,
                authorityId: input.materialization.planningInput.brief.id,
                revision: String(input.materialization.planningInput.brief.revision),
                status: "approved" as const,
                approvalAuthorityId: input.materialization.planningInput.brief.approval.actorId,
                approvalFingerprint:
                  input.materialization.planningInput.brief.approvedEvidenceFingerprint,
              },
            ]
          : [],
      acceptanceActionId: acceptanceActionId.data,
      acceptedAt: acceptedAt.data,
      sourceKind: input.sourceKind,
    } as const;
    const identityFingerprint = canonicalValueFingerprint(unsignedWithoutId);
    const id = idSchema.parse(
      this.#createReceiptId({
        acceptanceActionId: acceptanceActionId.data,
        receiptFingerprint: identityFingerprint,
      }),
    );
    const unsigned = { id, ...unsignedWithoutId };
    const receipt = acceptedSnapshotPublishReceiptSchema.parse({
      ...unsigned,
      fingerprint: acceptedSnapshotPublishReceiptFingerprint(unsigned),
    });
    await this.#receiptRepository.createOnce(receipt);
    return resolveAcceptedSnapshotPublishReceipt(this.#receiptRepository, receipt.id);
  }
}
