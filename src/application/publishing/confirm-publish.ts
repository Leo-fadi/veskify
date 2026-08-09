import {
  AcceptedSnapshotReceiptError,
  assertAcceptedSnapshotReceiptCurrent,
  resolveAcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotCurrentAuthoritySource,
  type AcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceiptRepository,
} from "@/application/accepted-snapshot-publishing";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  DraftConflictError,
  ActivePublicationConflictError,
  NoStorefrontChangesError,
  PublishedConflictError,
  PublishContentConflictError,
  RevisionConflictError,
  type ProjectAggregate,
  type ProjectRepository,
  type PublicationOperationWrite,
} from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import {
  InvalidPublishPreparationError,
  NoPublishableChangesError,
  publishPreparationSchema,
  PublishConfirmationError,
  StalePublishPreparationError,
  type PublishPreparation,
} from "./contract";
import {
  assertMatchingPublishCompilation,
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
  PublishCompilerError,
  type PublishCompilerInput,
} from "./publish-compiler";

export type PublishConfirmationResult = {
  aggregate: ProjectAggregate;
  publishedSnapshot: StorefrontSnapshot;
  synchronizedDraftSnapshot: StorefrontSnapshot;
};

export type PublishConfirmationOptions = Readonly<{
  publicationOperation?: PublicationOperationWrite;
  authority?:
    | Readonly<{
        kind: "manual";
        currentEvidenceReferences?: PublishCompilerInput["currentEvidenceReferences"];
      }>
    | Readonly<{
        kind: "accepted-ai";
        receiptRepository: AcceptedSnapshotPublishReceiptRepository;
        currentAuthoritySource: AcceptedSnapshotCurrentAuthoritySource;
      }>;
}>;

function snapshotById(aggregate: ProjectAggregate, snapshotId: string): StorefrontSnapshot {
  const snapshot = aggregate.snapshots.find(({ id }) => id === snapshotId);
  if (!snapshot) throw new PublishConfirmationError();
  return snapshot;
}

function parsePreparation(input: unknown): PublishPreparation {
  const parsed = publishPreparationSchema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidPublishPreparationError({ cause: parsed.error });
  }
  return parsed.data;
}

function assertCurrentPreparation(
  preparation: PublishPreparation,
  aggregate: ProjectAggregate,
): void {
  const draft = snapshotById(aggregate, aggregate.project.draftSnapshotId);
  const published = snapshotById(aggregate, aggregate.project.publishedSnapshotId);
  if (
    aggregate.project.id !== preparation.projectId ||
    aggregate.project.revision !== preparation.expectedProjectRevision ||
    draft.id !== preparation.expectedDraft.id ||
    draft.revision !== preparation.expectedDraft.revision ||
    published.id !== preparation.expectedPublished.id ||
    published.revision !== preparation.expectedPublished.revision ||
    canonicalStorefrontContentFingerprint(draft) !== preparation.expectedDraft.contentFingerprint ||
    canonicalStorefrontContentFingerprint(published) !==
      preparation.expectedPublished.contentFingerprint
  ) {
    throw new StalePublishPreparationError();
  }
}

function isStaleRepositoryError(cause: unknown): boolean {
  return (
    cause instanceof RevisionConflictError ||
    cause instanceof DraftConflictError ||
    cause instanceof PublishedConflictError ||
    cause instanceof PublishContentConflictError ||
    cause instanceof ActivePublicationConflictError
  );
}

export async function confirmPublish(
  preparationInput: unknown,
  repository: ProjectRepository,
  options: PublishConfirmationOptions = {},
): Promise<PublishConfirmationResult> {
  const preparation = parsePreparation(preparationInput);
  const confirmationAuthority = options.authority ?? { kind: "manual" as const };
  if (confirmationAuthority.kind !== preparation.authority.kind) {
    throw new AcceptedSnapshotReceiptError("publication-authority-confusion");
  }

  let latest: ProjectAggregate;
  let acceptedReceipt: AcceptedSnapshotPublishReceipt | null = null;
  let currentEvidenceReferences: NonNullable<
    ReturnType<typeof assertAcceptedSnapshotReceiptCurrent>["evidenceReferences"]
  > =
    confirmationAuthority.kind === "manual"
      ? (confirmationAuthority.currentEvidenceReferences ?? [])
      : [];
  let currentCompilation: ReturnType<typeof compileStorefrontPublication>;
  try {
    latest = validateProjectAggregate(await repository.get(preparation.projectId));
    assertCurrentPreparation(preparation, latest);
    if (preparation.authority.kind === "accepted-ai") {
      if (confirmationAuthority.kind !== "accepted-ai") {
        throw new AcceptedSnapshotReceiptError("publication-authority-confusion");
      }
      const receipt = await resolveAcceptedSnapshotPublishReceipt(
        confirmationAuthority.receiptRepository,
        preparation.authority.receiptId,
      );
      acceptedReceipt = receipt;
      if (
        receipt.fingerprint !== preparation.authority.receiptFingerprint ||
        receipt.proposalId !== preparation.authority.proposalId ||
        receipt.proposalRevision !== preparation.authority.proposalRevision ||
        receipt.reviewRevision !== preparation.authority.reviewRevision ||
        receipt.acceptedSnapshotId !== preparation.authority.acceptedSnapshotId ||
        receipt.acceptedSnapshotFingerprint !== preparation.authority.acceptedSnapshotFingerprint
      ) {
        throw new AcceptedSnapshotReceiptError("untrusted-receipt");
      }
      const currentAuthority =
        await confirmationAuthority.currentAuthoritySource.resolveCurrentAuthority({
          receipt,
          aggregate: latest,
        });
      currentEvidenceReferences =
        assertAcceptedSnapshotReceiptCurrent(receipt, latest, currentAuthority)
          .evidenceReferences ?? [];
    }
    const draft = snapshotById(latest, latest.project.draftSnapshotId);
    currentCompilation = compileStorefrontPublication(
      createCurrentPublishCompilerInput({
        aggregate: latest,
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
        currentEvidenceReferences,
      }),
    );
    assertMatchingPublishCompilation(preparation.compilation, currentCompilation);
  } catch (cause) {
    if (cause instanceof AcceptedSnapshotReceiptError) throw cause;
    if (cause instanceof PublishCompilerError) throw cause;
    if (
      cause instanceof StalePublishPreparationError ||
      cause instanceof PublishConfirmationError
    ) {
      throw cause;
    }
    throw new PublishConfirmationError({ cause });
  }

  if (!preparation.publishPermitted) throw new NoPublishableChangesError();

  let aggregate: ProjectAggregate;
  try {
    const publicationOperation =
      options.publicationOperation ??
      ({
        tenantId: "tenant_standalone",
        merchantId: "merchant_standalone",
        organizationId: "organization_standalone",
        storeId: "store_standalone",
        storefrontProjectId: preparation.projectId,
        operationType: "publish",
        requestId: preparation.preparationId,
        requestFingerprint: `standalone-publication-${preparation.compilation.receipt.fingerprint}`,
        result: {
          requestId: preparation.preparationId,
          storefrontProjectId: preparation.projectId,
          publishedRevision: `standalone-snapshot-revision-${preparation.expectedProjectRevision + 1}`,
          status: "published",
        },
      } satisfies PublicationOperationWrite);
    aggregate = validateProjectAggregate(
      await repository.publish(preparation.projectId, {
        projectRevision: preparation.expectedProjectRevision,
        draft: preparation.expectedDraft,
        published: preparation.expectedPublished,
        operation: publicationOperation,
        compiledPublication: {
          compilation: currentCompilation,
          authority: preparation.authority,
          operation: publicationOperation,
          expectedActiveVersionId: preparation.expectedActivePublicationVersionId,
        },
      }),
    );
  } catch (cause) {
    if (isStaleRepositoryError(cause)) throw new StalePublishPreparationError();
    if (cause instanceof NoStorefrontChangesError) throw new NoPublishableChangesError();
    throw new PublishConfirmationError({ cause });
  }

  try {
    const publishedSnapshot = snapshotById(aggregate, aggregate.project.publishedSnapshotId);
    const synchronizedDraftSnapshot = snapshotById(aggregate, aggregate.project.draftSnapshotId);
    const priorPublished = snapshotById(aggregate, preparation.expectedPublished.id);
    if (
      aggregate.project.revision !== preparation.expectedProjectRevision + 1 ||
      publishedSnapshot.id === synchronizedDraftSnapshot.id ||
      publishedSnapshot.id === preparation.expectedPublished.id ||
      synchronizedDraftSnapshot.id === preparation.expectedDraft.id ||
      publishedSnapshot.revision !== aggregate.project.revision ||
      synchronizedDraftSnapshot.revision !== aggregate.project.revision ||
      canonicalStorefrontContentFingerprint(priorPublished) !==
        preparation.expectedPublished.contentFingerprint ||
      canonicalStorefrontContentFingerprint(publishedSnapshot) !==
        preparation.expectedDraft.contentFingerprint ||
      !canonicalStorefrontContentEqual(publishedSnapshot, synchronizedDraftSnapshot)
    ) {
      throw new PublishConfirmationError();
    }
    return {
      aggregate,
      publishedSnapshot: structuredClone(publishedSnapshot),
      synchronizedDraftSnapshot: structuredClone(synchronizedDraftSnapshot),
    };
  } catch (cause) {
    if (cause instanceof PublishConfirmationError) throw cause;
    throw new PublishConfirmationError({ cause });
  }
}
