import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  DraftConflictError,
  InvalidRestoreTargetError,
  RestoreContentConflictError,
  RevisionConflictError,
  SnapshotNotFoundError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import {
  historyEntrySchema,
  HistoryReadError,
  InvalidRestorePreparationError,
  restorePreparationSchema,
  RestoreConfirmationError,
  RestorePreparationError,
  StaleRestorePreparationError,
  type HistoryEntry,
  type RestorePreparation,
} from "./contract";

export type PrepareRestoreOptions = {
  now?: () => Date;
  createPreparationId?: (input: {
    projectId: string;
    snapshotId: string;
    preparedAt: string;
  }) => string;
};

function snapshotById(aggregate: ProjectAggregate, snapshotId: string): StorefrontSnapshot {
  const snapshot = aggregate.snapshots.find(({ id }) => id === snapshotId);
  if (!snapshot) throw new SnapshotNotFoundError(aggregate.project.id, snapshotId);
  return snapshot;
}
function expectation(snapshot: StorefrontSnapshot) {
  return {
    id: snapshot.id,
    revision: snapshot.revision,
    contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
  };
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function listProjectHistory(
  projectId: string,
  repository: ProjectRepository,
): Promise<HistoryEntry[]> {
  try {
    const aggregate = validateProjectAggregate(await repository.get(projectId));
    return aggregate.snapshots
      .map((snapshot) =>
        historyEntrySchema.parse({
          snapshotId: snapshot.id,
          createdAt: snapshot.createdAt,
          authorRole: snapshot.createdBy,
          kind:
            snapshot.id === aggregate.project.publishedSnapshotId
              ? "currentPublished"
              : snapshot.id === aggregate.project.draftSnapshotId
                ? "currentDraft"
                : "previousVersion",
          pageCount: snapshot.pages.length,
        }),
      )
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
          right.snapshotId.localeCompare(left.snapshotId),
      );
  } catch (cause) {
    throw new HistoryReadError({ cause });
  }
}

export async function readHistoricalSnapshot(
  projectId: string,
  snapshotId: string,
  repository: ProjectRepository,
): Promise<StorefrontSnapshot> {
  try {
    const aggregate = validateProjectAggregate(await repository.get(projectId));
    return structuredClone(snapshotById(aggregate, snapshotId));
  } catch (cause) {
    throw new HistoryReadError({ cause });
  }
}

export async function prepareRestore(
  projectId: string,
  snapshotId: string,
  repository: ProjectRepository,
  options: PrepareRestoreOptions = {},
): Promise<RestorePreparation> {
  try {
    const aggregate = validateProjectAggregate(await repository.get(projectId));
    if (snapshotId === aggregate.project.draftSnapshotId)
      throw new InvalidRestoreTargetError(projectId, snapshotId);
    const target = snapshotById(aggregate, snapshotId);
    const draft = snapshotById(aggregate, aggregate.project.draftSnapshotId);
    const published = snapshotById(aggregate, aggregate.project.publishedSnapshotId);
    const preparedAt = (options.now?.() ?? new Date()).toISOString();
    const preparationId =
      options.createPreparationId?.({ projectId, snapshotId, preparedAt }) ??
      `restore_preparation_${stableHash(`${projectId}|${snapshotId}|${preparedAt}|${canonicalStorefrontContentFingerprint(draft)}`)}`;
    return freeze(
      restorePreparationSchema.parse({
        preparationId,
        projectId,
        preparedAt,
        target: expectation(target),
        expectedProjectRevision: aggregate.project.revision,
        expectedDraft: expectation(draft),
        expectedPublished: expectation(published),
      }),
    );
  } catch (cause) {
    if (cause instanceof InvalidRestoreTargetError) throw cause;
    throw new RestorePreparationError({ cause });
  }
}

function parsePreparation(input: unknown): RestorePreparation {
  const parsed = restorePreparationSchema.safeParse(input);
  if (!parsed.success) throw new InvalidRestorePreparationError({ cause: parsed.error });
  return parsed.data;
}
function assertCurrent(preparation: RestorePreparation, aggregate: ProjectAggregate): void {
  const draft = snapshotById(aggregate, aggregate.project.draftSnapshotId);
  const target = snapshotById(aggregate, preparation.target.id);
  const published = snapshotById(aggregate, aggregate.project.publishedSnapshotId);
  if (
    aggregate.project.id !== preparation.projectId ||
    aggregate.project.revision !== preparation.expectedProjectRevision ||
    canonicalStorefrontContentFingerprint(draft) !== preparation.expectedDraft.contentFingerprint ||
    draft.id !== preparation.expectedDraft.id ||
    draft.revision !== preparation.expectedDraft.revision ||
    canonicalStorefrontContentFingerprint(target) !== preparation.target.contentFingerprint ||
    target.revision !== preparation.target.revision ||
    canonicalStorefrontContentFingerprint(published) !==
      preparation.expectedPublished.contentFingerprint ||
    published.id !== preparation.expectedPublished.id ||
    published.revision !== preparation.expectedPublished.revision
  )
    throw new StaleRestorePreparationError();
}

export async function confirmRestore(
  preparationInput: unknown,
  repository: ProjectRepository,
): Promise<{ aggregate: ProjectAggregate; restoredDraftSnapshot: StorefrontSnapshot }> {
  const preparation = parsePreparation(preparationInput);
  let before: ProjectAggregate;
  try {
    before = validateProjectAggregate(await repository.get(preparation.projectId));
    assertCurrent(preparation, before);
  } catch (cause) {
    if (cause instanceof StaleRestorePreparationError) throw cause;
    throw new RestoreConfirmationError({ cause });
  }
  try {
    await repository.restore(preparation.projectId, preparation.target.id, {
      projectRevision: preparation.expectedProjectRevision,
      draft: preparation.expectedDraft,
      target: preparation.target,
    });
  } catch (cause) {
    if (
      cause instanceof RevisionConflictError ||
      cause instanceof DraftConflictError ||
      cause instanceof RestoreContentConflictError ||
      cause instanceof InvalidRestoreTargetError
    )
      throw new StaleRestorePreparationError();
    throw new RestoreConfirmationError({ cause });
  }
  try {
    const aggregate = validateProjectAggregate(await repository.get(preparation.projectId));
    const restoredDraftSnapshot = snapshotById(aggregate, aggregate.project.draftSnapshotId);
    const target = snapshotById(aggregate, preparation.target.id);
    const published = snapshotById(aggregate, aggregate.project.publishedSnapshotId);
    if (
      aggregate.project.revision !== preparation.expectedProjectRevision ||
      aggregate.project.publishedSnapshotId !== preparation.expectedPublished.id ||
      canonicalStorefrontContentFingerprint(published) !==
        preparation.expectedPublished.contentFingerprint ||
      restoredDraftSnapshot.id === target.id ||
      !canonicalStorefrontContentEqual(restoredDraftSnapshot, target)
    )
      throw new RestoreConfirmationError();
    return { aggregate, restoredDraftSnapshot: structuredClone(restoredDraftSnapshot) };
  } catch (cause) {
    if (cause instanceof RestoreConfirmationError) throw cause;
    throw new RestoreConfirmationError({ cause });
  }
}
