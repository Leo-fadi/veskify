import {
  AcceptedSnapshotReceiptError,
  assertAcceptedSnapshotReceiptCurrent,
  resolveAcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotCurrentAuthoritySource,
  type AcceptedSnapshotPublishReceiptRepository,
} from "@/application/accepted-snapshot-publishing";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type {
  AuthoritativePublishingProjectRepository,
  ProjectRepository,
} from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import { createPublishChangeSummary } from "./change-summary";
import {
  publishPreparationSchema,
  PublishPreparationValidationError,
  type PublishPreparation,
} from "./contract";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
  preparedPublishCompilation,
  PublishCompilerError,
} from "./publish-compiler";

export type PreparePublishOptions = {
  now?: () => Date;
  createPreparationId?: (input: {
    projectId: string;
    preparedAt: string;
    draftId: string;
    publishedId: string;
  }) => string;
  authority?:
    | Readonly<{ kind: "manual" }>
    | Readonly<{
        kind: "accepted-ai";
        receiptId: string;
        receiptRepository: AcceptedSnapshotPublishReceiptRepository;
        currentAuthoritySource: AcceptedSnapshotCurrentAuthoritySource;
      }>;
};

function currentSnapshot(
  snapshots: readonly StorefrontSnapshot[],
  snapshotId: string,
): StorefrontSnapshot {
  const snapshot = snapshots.find(({ id }) => id === snapshotId);
  if (!snapshot) throw new Error(`Snapshot ${snapshotId} does not resolve.`);
  return snapshot;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function supportsCompiledPublicationAuthority(
  repository: ProjectRepository,
): repository is AuthoritativePublishingProjectRepository {
  return "getActiveCompiledPublication" in repository;
}

export async function preparePublish(
  projectId: string,
  repository: ProjectRepository,
  options: PreparePublishOptions = {},
): Promise<PublishPreparation> {
  try {
    const aggregate = validateProjectAggregate(await repository.get(projectId));
    const activePublication = supportsCompiledPublicationAuthority(repository)
      ? await repository.getActiveCompiledPublication(projectId)
      : null;
    const draft = currentSnapshot(aggregate.snapshots, aggregate.project.draftSnapshotId);
    const published = currentSnapshot(aggregate.snapshots, aggregate.project.publishedSnapshotId);
    const preparedAt = (options.now?.() ?? new Date()).toISOString();
    const draftFingerprint = canonicalStorefrontContentFingerprint(draft);
    const publishedFingerprint = canonicalStorefrontContentFingerprint(published);
    const requestedAuthority = options.authority ?? { kind: "manual" as const };
    const resolvedAuthority: Readonly<{
      authority:
        | Readonly<{ kind: "manual" }>
        | Readonly<{
            kind: "accepted-ai";
            receiptId: string;
            receiptFingerprint: string;
            proposalId: string;
            proposalRevision: number;
            reviewRevision: number;
            acceptedSnapshotId: string;
            acceptedSnapshotFingerprint: string;
          }>;
      acceptedReceipt: AcceptedSnapshotPublishReceipt | null;
    }> =
      requestedAuthority.kind === "manual"
        ? { authority: requestedAuthority, acceptedReceipt: null }
        : await (async () => {
            const receipt = await resolveAcceptedSnapshotPublishReceipt(
              requestedAuthority.receiptRepository,
              requestedAuthority.receiptId,
            );
            const currentAuthority =
              await requestedAuthority.currentAuthoritySource.resolveCurrentAuthority({
                receipt,
                aggregate,
              });
            assertAcceptedSnapshotReceiptCurrent(receipt, aggregate, currentAuthority);
            if (
              receipt.acceptedSnapshotId !== draft.id ||
              receipt.acceptedSnapshotFingerprint !== draftFingerprint
            ) {
              throw new AcceptedSnapshotReceiptError("snapshot-mismatch");
            }
            return {
              acceptedReceipt: receipt,
              authority: {
                kind: "accepted-ai" as const,
                receiptId: receipt.id,
                receiptFingerprint: receipt.fingerprint,
                proposalId: receipt.proposalId,
                proposalRevision: receipt.proposalRevision,
                reviewRevision: receipt.reviewRevision,
                acceptedSnapshotId: receipt.acceptedSnapshotId,
                acceptedSnapshotFingerprint: receipt.acceptedSnapshotFingerprint,
              },
            };
          })();
    const { acceptedReceipt, authority } = resolvedAuthority;
    const compilation = compileStorefrontPublication(
      createCurrentPublishCompilerInput({
        aggregate,
        snapshot: draft,
        sourceAuthority:
          acceptedReceipt === null
            ? { kind: "manual" }
            : {
                kind: "accepted-ai",
                acceptedReceiptId: acceptedReceipt.id,
                acceptedReceiptFingerprint: acceptedReceipt.fingerprint,
                profileAuthorities: acceptedReceipt.profileAuthorities,
              },
      }),
    );
    const preparationId =
      options.createPreparationId?.({
        projectId,
        preparedAt,
        draftId: draft.id,
        publishedId: published.id,
      }) ??
      `publish_preparation_${stableHash(
        `${projectId}|${preparedAt}|${draft.id}|${published.id}|${draftFingerprint}|${publishedFingerprint}`,
      )}`;

    const preparation = publishPreparationSchema.parse({
      preparationId,
      projectId,
      preparedAt,
      expectedProjectRevision: aggregate.project.revision,
      expectedDraft: {
        id: draft.id,
        revision: draft.revision,
        contentFingerprint: draftFingerprint,
      },
      expectedPublished: {
        id: published.id,
        revision: published.revision,
        contentFingerprint: publishedFingerprint,
      },
      authority,
      compilation: preparedPublishCompilation(compilation),
      expectedActivePublicationVersionId: activePublication?.version.id ?? null,
      changeSummary: createPublishChangeSummary(published, draft),
      publishPermitted: !canonicalStorefrontContentEqual(published, draft),
    });

    return deepFreeze(preparation);
  } catch (cause) {
    if (cause instanceof AcceptedSnapshotReceiptError) throw cause;
    if (cause instanceof PublishCompilerError) throw cause;
    if (cause instanceof PublishPreparationValidationError) throw cause;
    throw new PublishPreparationValidationError({ cause });
  }
}
