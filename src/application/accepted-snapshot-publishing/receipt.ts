import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  pageFactEvidenceReferenceSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";

const fingerprintSchema = z.string().trim().min(1).max(240);
const authorityReferenceSchema = z
  .object({ version: z.string().trim().min(1).max(120), fingerprint: fingerprintSchema })
  .strict();
const profileAuthoritySchema = z
  .object({ profileId: z.string().trim().min(1).max(160), fingerprint: fingerprintSchema })
  .strict();

export const acceptedSnapshotPublishReceiptVersion = "1.0.0" as const;

export const acceptedSnapshotPublishReceiptSchema = z
  .object({
    id: idSchema,
    version: z.literal(acceptedSnapshotPublishReceiptVersion),
    projectId: idSchema,
    draftId: idSchema,
    proposalId: idSchema,
    proposalRevision: z.number().int().nonnegative(),
    proposalFingerprint: fingerprintSchema,
    reviewRevision: z.number().int().nonnegative(),
    reviewFingerprint: fingerprintSchema,
    acceptedRuntimeFingerprint: fingerprintSchema,
    acceptedSnapshotId: idSchema,
    acceptedSnapshotFingerprint: fingerprintSchema,
    projectRevision: z.number().int().nonnegative(),
    draftRevision: z.number().int().nonnegative(),
    componentRegistryFingerprint: fingerprintSchema,
    manifest: authorityReferenceSchema.nullable(),
    packageRegistry: authorityReferenceSchema.nullable(),
    profileAuthorities: z.array(profileAuthoritySchema).max(128),
    commerceFingerprint: fingerprintSchema,
    approvedAssetFingerprint: fingerprintSchema.nullable(),
    evidenceReferences: z.array(pageFactEvidenceReferenceSchema).optional(),
    acceptanceActionId: idSchema,
    acceptedAt: isoDateTimeSchema,
    sourceKind: z.enum(["initialGeneration", "governedFollowUp"]),
    fingerprint: fingerprintSchema,
  })
  .strict()
  .superRefine((receipt, context) => {
    const sorted = [...receipt.profileAuthorities].sort((left, right) =>
      left.profileId.localeCompare(right.profileId),
    );
    if (new Set(sorted.map(({ profileId }) => profileId)).size !== sorted.length) {
      context.addIssue({
        code: "custom",
        path: ["profileAuthorities"],
        message: "Accepted snapshot profile authorities must be unique.",
      });
    }
    if (
      sorted.some(
        (authority, index) => authority.profileId !== receipt.profileAuthorities[index]?.profileId,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["profileAuthorities"],
        message: "Accepted snapshot profile authorities must use canonical order.",
      });
    }
  });

export type AcceptedSnapshotPublishReceipt = z.infer<typeof acceptedSnapshotPublishReceiptSchema>;

/**
 * One authoritative acceptance action owns one durable receipt identity. The
 * receipt repository still distinguishes an exact replay from conflicting
 * content, so retry safety does not weaken create-once collision protection.
 */
export function acceptedSnapshotPublishReceiptIdForAcceptanceAction(
  acceptanceActionIdInput: string,
): string {
  const acceptanceActionId = idSchema.parse(acceptanceActionIdInput);
  return `acceptance_receipt_${canonicalValueFingerprint({ acceptanceActionId }).slice(-20)}`;
}

export function acceptedSnapshotProposalFingerprint(proposal: unknown): string {
  return `accepted-proposal-${canonicalValueFingerprint(proposal)}`;
}

export function acceptedSnapshotReviewFingerprint(review: unknown): string {
  return `accepted-review-${canonicalValueFingerprint(review)}`;
}

export function acceptedSnapshotRuntimeFingerprint(runtime: unknown): string {
  return `accepted-runtime-${canonicalValueFingerprint(runtime)}`;
}

export const acceptedSnapshotCurrentAuthoritySchema = z
  .object({
    proposalId: idSchema,
    proposalRevision: z.number().int().nonnegative(),
    proposalFingerprint: fingerprintSchema,
    reviewRevision: z.number().int().nonnegative(),
    reviewFingerprint: fingerprintSchema,
    acceptedRuntimeFingerprint: fingerprintSchema,
    componentRegistryFingerprint: fingerprintSchema,
    manifest: authorityReferenceSchema.nullable(),
    packageRegistry: authorityReferenceSchema.nullable(),
    profileAuthorities: z.array(profileAuthoritySchema).max(128),
    commerceFingerprint: fingerprintSchema,
    approvedAssetFingerprint: fingerprintSchema.nullable(),
    evidenceReferences: z.array(pageFactEvidenceReferenceSchema).optional(),
  })
  .strict();

export type AcceptedSnapshotCurrentAuthority = z.infer<
  typeof acceptedSnapshotCurrentAuthoritySchema
>;

export type AcceptedSnapshotReceiptErrorCode =
  | "malformed-receipt"
  | "unsupported-receipt-version"
  | "untrusted-receipt"
  | "missing-trusted-receipt"
  | "receipt-replay"
  | "receipt-collision"
  | "project-mismatch"
  | "draft-mismatch"
  | "proposal-mismatch"
  | "proposal-revision-mismatch"
  | "review-revision-mismatch"
  | "snapshot-mismatch"
  | "stale-project"
  | "stale-draft"
  | "stale-current-snapshot"
  | "component-registry-mismatch"
  | "manifest-mismatch"
  | "package-registry-mismatch"
  | "profile-authority-mismatch"
  | "commerce-mismatch"
  | "approved-asset-mismatch"
  | "evidence-authority-mismatch"
  | "proposal-not-accepted"
  | "accepted-lifecycle-mismatch"
  | "accepted-proposal-content-mismatch"
  | "publication-authority-confusion";

export class AcceptedSnapshotReceiptError extends Error {
  constructor(
    readonly code: AcceptedSnapshotReceiptErrorCode,
    options?: ErrorOptions,
  ) {
    super("The accepted snapshot publishing authority is invalid.", options);
    this.name = "AcceptedSnapshotReceiptError";
  }
}

export interface AcceptedSnapshotPublishReceiptRepository {
  createOnce(receipt: AcceptedSnapshotPublishReceipt): Promise<AcceptedSnapshotPublishReceipt>;
  get(receiptId: string): Promise<unknown>;
}

export interface AcceptedSnapshotCurrentAuthoritySource {
  resolveCurrentAuthority(input: {
    receipt: AcceptedSnapshotPublishReceipt;
    aggregate: ProjectAggregate;
  }): Promise<unknown>;
}

type ReceiptUnsigned = Omit<AcceptedSnapshotPublishReceipt, "fingerprint">;

export function acceptedSnapshotPublishReceiptFingerprint(value: ReceiptUnsigned): string {
  return `accepted-snapshot-receipt-${canonicalValueFingerprint(value)}`;
}

export function parseTrustedAcceptedSnapshotPublishReceipt(
  input: unknown,
): AcceptedSnapshotPublishReceipt {
  if (
    typeof input === "object" &&
    input !== null &&
    "version" in input &&
    input.version !== acceptedSnapshotPublishReceiptVersion
  ) {
    throw new AcceptedSnapshotReceiptError("unsupported-receipt-version");
  }
  const parsed = acceptedSnapshotPublishReceiptSchema.safeParse(input);
  if (!parsed.success) {
    throw new AcceptedSnapshotReceiptError("malformed-receipt", { cause: parsed.error });
  }
  const { fingerprint, ...unsigned } = parsed.data;
  if (fingerprint !== acceptedSnapshotPublishReceiptFingerprint(unsigned)) {
    throw new AcceptedSnapshotReceiptError("untrusted-receipt");
  }
  return parsed.data;
}

export async function resolveAcceptedSnapshotPublishReceipt(
  repository: AcceptedSnapshotPublishReceiptRepository,
  receiptId: string,
): Promise<AcceptedSnapshotPublishReceipt> {
  const trustedId = idSchema.safeParse(receiptId);
  if (!trustedId.success) {
    throw new AcceptedSnapshotReceiptError("malformed-receipt", {
      cause: trustedId.error,
    });
  }
  const receipt = await repository.get(trustedId.data);
  if (!receipt) throw new AcceptedSnapshotReceiptError("missing-trusted-receipt");
  const parsed = parseTrustedAcceptedSnapshotPublishReceipt(receipt);
  if (parsed.id !== trustedId.data) {
    throw new AcceptedSnapshotReceiptError("untrusted-receipt");
  }
  return parsed;
}

function currentDraft(aggregate: ProjectAggregate): StorefrontSnapshot {
  const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId);
  if (!draft) throw new AcceptedSnapshotReceiptError("stale-current-snapshot");
  return draft;
}

function sameAuthorityReference(
  left: { version: string; fingerprint: string } | null,
  right: { version: string; fingerprint: string } | null,
): boolean {
  return left?.version === right?.version && left?.fingerprint === right?.fingerprint;
}

function sameProfileAuthorities(
  left: readonly { profileId: string; fingerprint: string }[],
  right: readonly { profileId: string; fingerprint: string }[],
): boolean {
  return canonicalValueFingerprint(left) === canonicalValueFingerprint(right);
}

export function assertAcceptedSnapshotReceiptCurrent(
  receipt: AcceptedSnapshotPublishReceipt,
  aggregate: ProjectAggregate,
  currentAuthorityInput: unknown,
): AcceptedSnapshotCurrentAuthority {
  const currentAuthority = acceptedSnapshotCurrentAuthoritySchema.safeParse(currentAuthorityInput);
  if (!currentAuthority.success) {
    throw new AcceptedSnapshotReceiptError("malformed-receipt", {
      cause: currentAuthority.error,
    });
  }
  const current = currentAuthority.data;
  const draft = currentDraft(aggregate);
  if (aggregate.project.id !== receipt.projectId) {
    throw new AcceptedSnapshotReceiptError("project-mismatch");
  }
  if (aggregate.project.draftSnapshotId !== receipt.draftId) {
    throw new AcceptedSnapshotReceiptError("draft-mismatch");
  }
  if (current.proposalId !== receipt.proposalId) {
    throw new AcceptedSnapshotReceiptError("proposal-mismatch");
  }
  if (
    current.proposalRevision !== receipt.proposalRevision ||
    current.proposalFingerprint !== receipt.proposalFingerprint
  ) {
    throw new AcceptedSnapshotReceiptError("proposal-revision-mismatch");
  }
  if (
    current.reviewRevision !== receipt.reviewRevision ||
    current.reviewFingerprint !== receipt.reviewFingerprint
  ) {
    throw new AcceptedSnapshotReceiptError("review-revision-mismatch");
  }
  if (current.acceptedRuntimeFingerprint !== receipt.acceptedRuntimeFingerprint) {
    throw new AcceptedSnapshotReceiptError("accepted-lifecycle-mismatch");
  }
  if (aggregate.project.revision !== receipt.projectRevision) {
    throw new AcceptedSnapshotReceiptError("stale-project");
  }
  if (draft.id !== receipt.acceptedSnapshotId) {
    throw new AcceptedSnapshotReceiptError("snapshot-mismatch");
  }
  if (draft.revision !== receipt.draftRevision) {
    throw new AcceptedSnapshotReceiptError("stale-draft");
  }
  if (canonicalStorefrontContentFingerprint(draft) !== receipt.acceptedSnapshotFingerprint) {
    throw new AcceptedSnapshotReceiptError("stale-current-snapshot");
  }
  if (current.componentRegistryFingerprint !== receipt.componentRegistryFingerprint) {
    throw new AcceptedSnapshotReceiptError("component-registry-mismatch");
  }
  if (!sameAuthorityReference(current.manifest, receipt.manifest)) {
    throw new AcceptedSnapshotReceiptError("manifest-mismatch");
  }
  if (!sameAuthorityReference(current.packageRegistry, receipt.packageRegistry)) {
    throw new AcceptedSnapshotReceiptError("package-registry-mismatch");
  }
  if (!sameProfileAuthorities(current.profileAuthorities, receipt.profileAuthorities)) {
    throw new AcceptedSnapshotReceiptError("profile-authority-mismatch");
  }
  if (current.commerceFingerprint !== receipt.commerceFingerprint) {
    throw new AcceptedSnapshotReceiptError("commerce-mismatch");
  }
  if (current.approvedAssetFingerprint !== receipt.approvedAssetFingerprint) {
    throw new AcceptedSnapshotReceiptError("approved-asset-mismatch");
  }
  if (
    canonicalValueFingerprint(current.evidenceReferences ?? []) !==
    canonicalValueFingerprint(receipt.evidenceReferences ?? [])
  ) {
    throw new AcceptedSnapshotReceiptError("evidence-authority-mismatch");
  }
  return current;
}
