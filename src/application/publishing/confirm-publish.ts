import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  DraftConflictError,
  NoStorefrontChangesError,
  PublishedConflictError,
  PublishContentConflictError,
  RevisionConflictError,
  type ProjectAggregate,
  type ProjectRepository,
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

export type PublishConfirmationResult = {
  aggregate: ProjectAggregate;
  publishedSnapshot: StorefrontSnapshot;
  synchronizedDraftSnapshot: StorefrontSnapshot;
};

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
    cause instanceof PublishContentConflictError
  );
}

export async function confirmPublish(
  preparationInput: unknown,
  repository: ProjectRepository,
): Promise<PublishConfirmationResult> {
  const preparation = parsePreparation(preparationInput);
  if (!preparation.publishPermitted) throw new NoPublishableChangesError();

  let latest: ProjectAggregate;
  try {
    latest = validateProjectAggregate(await repository.get(preparation.projectId));
    assertCurrentPreparation(preparation, latest);
  } catch (cause) {
    if (
      cause instanceof StalePublishPreparationError ||
      cause instanceof PublishConfirmationError
    ) {
      throw cause;
    }
    throw new PublishConfirmationError({ cause });
  }

  let aggregate: ProjectAggregate;
  try {
    aggregate = validateProjectAggregate(
      await repository.publish(preparation.projectId, {
        projectRevision: preparation.expectedProjectRevision,
        draft: preparation.expectedDraft,
        published: preparation.expectedPublished,
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
