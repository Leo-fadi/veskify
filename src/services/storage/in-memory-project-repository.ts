import { projectSchema, type Project } from "@/domain/project";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  DraftConflictError,
  CatalogueAlreadyExistsError,
  InvalidRestoreTargetError,
  NoStorefrontChangesError,
  ProjectAlreadyExistsError,
  ProjectNotFoundError,
  PublishedConflictError,
  PublishContentConflictError,
  RevisionConflictError,
  SnapshotNotFoundError,
  SnapshotAlreadyExistsError,
  SnapshotProjectMismatchError,
  type ProjectAggregate,
  type AuthoritativePublishingProjectRepository,
  type ProjectSummary,
  type PublishExpectation,
  type RestoreExpectation,
  projectScopedSnapshotId,
  RestoreContentConflictError,
} from "./project-repository";
import {
  completePublicationOperation,
  PublicationOperationAlreadyCompletedError,
  PublicationOperationConflictError,
  parsePublicationOperationWrite,
  publicationOperationKey,
  type PublicationOperationIdentity,
  type PublicationOperationRecord,
} from "./publication-operation";
import {
  compactManagedDraftHistory,
  repositoryValidationError,
  validateProjectAggregate,
  validateRepositorySnapshot,
} from "./repository-validation";
import {
  publishHistoryMetadata,
  restoreHistoryMetadata,
  type SnapshotHistoryMetadata,
} from "./snapshot-history-metadata";

type StoredProject = {
  project: Project;
  catalogue: ProjectAggregate["catalogue"];
  snapshots: Map<string, StorefrontSnapshot>;
  snapshotHistoryMetadata: Map<string, SnapshotHistoryMetadata>;
  managedDraftSnapshotIds: Set<string>;
  operationSequence: number;
  publicationOperations: Map<string, PublicationOperationRecord>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

export class InMemoryProjectRepository implements AuthoritativePublishingProjectRepository {
  readonly #projects = new Map<string, StoredProject>();

  constructor(initialProjects: readonly ProjectAggregate[]) {
    for (const input of initialProjects) {
      const aggregate = validateProjectAggregate(clone(input));
      if (this.#projects.has(aggregate.project.id)) {
        throw repositoryValidationError(
          `Duplicate seeded project ID: ${aggregate.project.id}.`,
          new Error("Project IDs must be unique."),
        );
      }

      this.#projects.set(aggregate.project.id, {
        project: freeze(aggregate.project),
        catalogue: freeze(aggregate.catalogue),
        snapshots: new Map(aggregate.snapshots.map((snapshot) => [snapshot.id, freeze(snapshot)])),
        snapshotHistoryMetadata: new Map(
          aggregate.snapshotHistoryMetadata?.map((metadata) => [
            metadata.snapshotId,
            freeze(metadata),
          ]),
        ),
        managedDraftSnapshotIds: new Set([aggregate.project.draftSnapshotId]),
        operationSequence: aggregate.snapshots.length,
        publicationOperations: new Map(),
      });
    }
  }

  async list(): Promise<ProjectSummary[]> {
    await Promise.resolve();
    return [...this.#projects.values()]
      .map(({ project }) =>
        clone({
          id: project.id,
          name: project.name,
          industry: project.industry,
          primaryLocale: project.primaryLocale,
          enabledLocales: project.enabledLocales,
          publishedSnapshotId: project.publishedSnapshotId,
          draftSnapshotId: project.draftSnapshotId,
          revision: project.revision,
          updatedAt: project.updatedAt,
        }),
      )
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async get(projectId: string): Promise<ProjectAggregate> {
    await Promise.resolve();
    return clone(this.#validatedAggregate(this.#requireProject(projectId)));
  }

  async create(input: ProjectAggregate): Promise<ProjectAggregate> {
    await Promise.resolve();
    const aggregate = validateProjectAggregate(clone(input));

    if (this.#projects.has(aggregate.project.id)) {
      throw new ProjectAlreadyExistsError(aggregate.project.id);
    }
    for (const stored of this.#projects.values()) {
      if (stored.catalogue.id === aggregate.catalogue.id) {
        throw new CatalogueAlreadyExistsError(aggregate.catalogue.id);
      }
      const existingSnapshot = aggregate.snapshots.find((snapshot) =>
        stored.snapshots.has(snapshot.id),
      );
      if (existingSnapshot) {
        throw new SnapshotAlreadyExistsError(existingSnapshot.id);
      }
    }

    this.#projects.set(aggregate.project.id, {
      project: freeze(aggregate.project),
      catalogue: freeze(aggregate.catalogue),
      snapshots: new Map(aggregate.snapshots.map((snapshot) => [snapshot.id, freeze(snapshot)])),
      snapshotHistoryMetadata: new Map(
        aggregate.snapshotHistoryMetadata?.map((metadata) => [
          metadata.snapshotId,
          freeze(metadata),
        ]),
      ),
      managedDraftSnapshotIds: new Set([aggregate.project.draftSnapshotId]),
      operationSequence: aggregate.snapshots.length,
      publicationOperations: new Map(),
    });

    return clone(aggregate);
  }

  async saveDraft(
    projectId: string,
    input: StorefrontSnapshot,
    expectedBase?: { id: string; revision: number },
  ): Promise<void> {
    await Promise.resolve();
    const stored = this.#requireProject(projectId);
    const currentDraft = stored.snapshots.get(stored.project.draftSnapshotId);
    if (!currentDraft) {
      throw new SnapshotNotFoundError(projectId, stored.project.draftSnapshotId);
    }
    if (
      expectedBase &&
      (currentDraft.id !== expectedBase.id || currentDraft.revision !== expectedBase.revision)
    ) {
      throw new DraftConflictError(projectId, expectedBase, {
        id: currentDraft.id,
        revision: currentDraft.revision,
      });
    }
    const snapshot = validateRepositorySnapshot(clone(input), stored.catalogue);

    const snapshotOwner = this.#snapshotOwner(snapshot.id);
    if (snapshotOwner && snapshotOwner !== projectId) {
      throw new SnapshotAlreadyExistsError(snapshot.id);
    }

    if (snapshot.projectId !== projectId) {
      throw new SnapshotProjectMismatchError(projectId, snapshot.projectId);
    }
    if (snapshot.catalogueRef !== stored.catalogue.id) {
      throw repositoryValidationError(
        "Draft snapshot references a catalogue outside the project aggregate.",
        new Error("Catalogue reference mismatch."),
      );
    }
    if (snapshot.id === stored.project.publishedSnapshotId) {
      throw repositoryValidationError(
        "A draft snapshot cannot reuse the current published snapshot ID.",
        new Error("Draft and published snapshots must remain separate."),
      );
    }
    if (stored.snapshots.has(snapshot.id) && snapshot.id !== stored.project.draftSnapshotId) {
      throw repositoryValidationError(
        "A draft snapshot cannot overwrite immutable history.",
        new Error("Historical snapshot IDs cannot be reused."),
      );
    }

    const nextProject = projectSchema.parse({
      ...stored.project,
      draftSnapshotId: snapshot.id,
      updatedAt: snapshot.createdAt,
    });
    const nextSnapshots = new Map(stored.snapshots);
    nextSnapshots.set(snapshot.id, snapshot);
    const nextManagedDraftSnapshotIds = new Set(stored.managedDraftSnapshotIds);
    nextManagedDraftSnapshotIds.add(snapshot.id);
    const compacted = compactManagedDraftHistory(
      [...nextSnapshots.values()],
      nextProject,
      nextManagedDraftSnapshotIds,
    );
    const nextSnapshotHistoryMetadata = new Map(stored.snapshotHistoryMetadata);
    nextSnapshotHistoryMetadata.delete(snapshot.id);
    for (const removedSnapshotId of compacted.removedSnapshotIds) {
      nextSnapshotHistoryMetadata.delete(removedSnapshotId);
    }
    const aggregate = validateProjectAggregate({
      project: nextProject,
      catalogue: stored.catalogue,
      snapshots: compacted.snapshots,
      ...(nextSnapshotHistoryMetadata.size > 0
        ? { snapshotHistoryMetadata: [...nextSnapshotHistoryMetadata.values()] }
        : {}),
    });

    stored.project = freeze(aggregate.project);
    stored.snapshots = new Map(
      aggregate.snapshots.map((candidate) => [candidate.id, freeze(candidate)]),
    );
    stored.managedDraftSnapshotIds = new Set(
      [...nextManagedDraftSnapshotIds].filter((id) => stored.snapshots.has(id)),
    );
    stored.snapshotHistoryMetadata = new Map(
      aggregate.snapshotHistoryMetadata?.map((metadata) => [metadata.snapshotId, freeze(metadata)]),
    );
  }

  async publish(projectId: string, expectation: PublishExpectation): Promise<ProjectAggregate> {
    await Promise.resolve();
    const stored = this.#requireProject(projectId);
    const operation = expectation.operation
      ? parsePublicationOperationWrite(expectation.operation)
      : undefined;
    if (operation && operation.storefrontProjectId !== projectId) {
      throw repositoryValidationError(
        "Publication operation references a different storefront project.",
        new Error("Publication operation project identity mismatch."),
      );
    }
    if (operation) {
      const operationKey = publicationOperationKey(operation);
      const existingOperation = stored.publicationOperations.get(operationKey);
      if (existingOperation) {
        if (existingOperation.requestFingerprint !== operation.requestFingerprint) {
          throw new PublicationOperationConflictError(operationKey);
        }
        throw new PublicationOperationAlreadyCompletedError(operationKey);
      }
    }
    const current = this.#validatedAggregate(stored);
    if (stored.project.revision !== expectation.projectRevision) {
      throw new RevisionConflictError(
        projectId,
        expectation.projectRevision,
        stored.project.revision,
      );
    }

    const draft = stored.snapshots.get(stored.project.draftSnapshotId);
    if (!draft) {
      throw new SnapshotNotFoundError(projectId, stored.project.draftSnapshotId);
    }
    const previousPublished = stored.snapshots.get(stored.project.publishedSnapshotId);
    if (!previousPublished) {
      throw new SnapshotNotFoundError(projectId, stored.project.publishedSnapshotId);
    }
    if (draft.id !== expectation.draft.id || draft.revision !== expectation.draft.revision) {
      throw new DraftConflictError(projectId, expectation.draft, {
        id: draft.id,
        revision: draft.revision,
      });
    }
    if (
      previousPublished.id !== expectation.published.id ||
      previousPublished.revision !== expectation.published.revision
    ) {
      throw new PublishedConflictError(projectId, expectation.published, {
        id: previousPublished.id,
        revision: previousPublished.revision,
      });
    }
    if (canonicalStorefrontContentFingerprint(draft) !== expectation.draft.contentFingerprint) {
      throw new PublishContentConflictError(projectId, "draft");
    }
    if (
      canonicalStorefrontContentFingerprint(previousPublished) !==
      expectation.published.contentFingerprint
    ) {
      throw new PublishContentConflictError(projectId, "published");
    }
    if (canonicalStorefrontContentEqual(draft, previousPublished)) {
      throw new NoStorefrontChangesError(projectId);
    }

    const revision = stored.project.revision + 1;
    const sequence = stored.operationSequence + 1;
    const createdAt = this.#nextTimestamp(stored, sequence);
    const published = validateRepositorySnapshot(
      {
        ...clone(draft),
        id: this.#snapshotId(projectId, "published", revision, sequence),
        revision,
        createdAt,
        createdBy: "user",
      },
      stored.catalogue,
    );
    const synchronizedDraft = validateRepositorySnapshot(
      {
        ...clone(published),
        id: this.#snapshotId(projectId, "synchronized", revision, sequence),
        createdBy: "system",
      },
      stored.catalogue,
    );
    if (
      published.id === synchronizedDraft.id ||
      this.#snapshotOwner(published.id) ||
      this.#snapshotOwner(synchronizedDraft.id)
    ) {
      const conflictingId = this.#snapshotOwner(published.id) ? published.id : synchronizedDraft.id;
      throw new SnapshotAlreadyExistsError(conflictingId);
    }
    const nextProject = projectSchema.parse({
      ...stored.project,
      publishedSnapshotId: published.id,
      draftSnapshotId: synchronizedDraft.id,
      revision,
      updatedAt: createdAt,
    });
    const nextSnapshots = new Map(stored.snapshots);
    nextSnapshots.set(published.id, published);
    nextSnapshots.set(synchronizedDraft.id, synchronizedDraft);
    const nextManagedDraftSnapshotIds = new Set(stored.managedDraftSnapshotIds);
    nextManagedDraftSnapshotIds.add(synchronizedDraft.id);
    const compacted = compactManagedDraftHistory(
      [...nextSnapshots.values()],
      nextProject,
      nextManagedDraftSnapshotIds,
    );
    const nextSnapshotHistoryMetadata = new Map(stored.snapshotHistoryMetadata);
    for (const metadata of publishHistoryMetadata(projectId, published.id, synchronizedDraft.id)) {
      nextSnapshotHistoryMetadata.set(metadata.snapshotId, metadata);
    }
    for (const removedSnapshotId of compacted.removedSnapshotIds) {
      nextSnapshotHistoryMetadata.delete(removedSnapshotId);
    }
    const aggregate = validateProjectAggregate({
      project: nextProject,
      catalogue: current.catalogue,
      snapshots: compacted.snapshots,
      snapshotHistoryMetadata: [...nextSnapshotHistoryMetadata.values()],
    });
    const completedOperation = operation
      ? completePublicationOperation(operation, nextProject.revision, published.id)
      : undefined;
    const nextPublicationOperations = new Map(stored.publicationOperations);
    if (completedOperation) {
      nextPublicationOperations.set(completedOperation.operationKey, freeze(completedOperation));
    }

    stored.project = freeze(aggregate.project);
    stored.snapshots = new Map(
      aggregate.snapshots.map((snapshot) => [snapshot.id, freeze(snapshot)]),
    );
    stored.managedDraftSnapshotIds = new Set(
      [...nextManagedDraftSnapshotIds].filter((id) => stored.snapshots.has(id)),
    );
    stored.snapshotHistoryMetadata = new Map(
      aggregate.snapshotHistoryMetadata?.map((metadata) => [metadata.snapshotId, freeze(metadata)]),
    );
    stored.operationSequence = sequence;
    stored.publicationOperations = nextPublicationOperations;
    return clone(aggregate);
  }

  async getPublicationOperation(
    identity: PublicationOperationIdentity,
  ): Promise<PublicationOperationRecord | null> {
    await Promise.resolve();
    const stored = this.#requireProject(identity.storefrontProjectId);
    const operation = stored.publicationOperations.get(publicationOperationKey(identity));
    return operation ? clone(operation) : null;
  }

  async restore(
    projectId: string,
    snapshotId: string,
    expectation?: RestoreExpectation,
  ): Promise<StorefrontSnapshot> {
    await Promise.resolve();
    const stored = this.#requireProject(projectId);
    const historical = stored.snapshots.get(snapshotId);
    if (!historical) {
      throw new SnapshotNotFoundError(projectId, snapshotId);
    }
    if (snapshotId === stored.project.draftSnapshotId) {
      throw new InvalidRestoreTargetError(projectId, snapshotId);
    }

    const currentDraft = stored.snapshots.get(stored.project.draftSnapshotId);
    if (!currentDraft) {
      throw new SnapshotNotFoundError(projectId, stored.project.draftSnapshotId);
    }
    if (expectation) {
      if (stored.project.revision !== expectation.projectRevision) {
        throw new RevisionConflictError(
          projectId,
          expectation.projectRevision,
          stored.project.revision,
        );
      }
      if (
        currentDraft.id !== expectation.draft.id ||
        currentDraft.revision !== expectation.draft.revision
      ) {
        throw new DraftConflictError(projectId, expectation.draft, currentDraft);
      }
      if (
        canonicalStorefrontContentFingerprint(currentDraft) !== expectation.draft.contentFingerprint
      ) {
        throw new RestoreContentConflictError(projectId, "draft");
      }
      if (
        historical.id !== expectation.target.id ||
        historical.revision !== expectation.target.revision ||
        canonicalStorefrontContentFingerprint(historical) !== expectation.target.contentFingerprint
      ) {
        throw new RestoreContentConflictError(projectId, "target");
      }
    }
    const sequence = stored.operationSequence + 1;
    const restored = validateRepositorySnapshot(
      {
        ...clone(historical),
        id: this.#snapshotId(projectId, "restored", stored.project.revision, sequence),
        createdAt: this.#nextTimestamp(stored, sequence),
        createdBy: "user",
      },
      stored.catalogue,
    );
    if (this.#snapshotOwner(restored.id)) {
      throw new SnapshotAlreadyExistsError(restored.id);
    }
    const nextProject = projectSchema.parse({
      ...stored.project,
      draftSnapshotId: restored.id,
      updatedAt: restored.createdAt,
    });

    const nextSnapshots = new Map(stored.snapshots);
    nextSnapshots.set(restored.id, restored);
    const nextManagedDraftSnapshotIds = new Set(stored.managedDraftSnapshotIds);
    nextManagedDraftSnapshotIds.add(restored.id);
    const compacted = compactManagedDraftHistory(
      [...nextSnapshots.values()],
      nextProject,
      nextManagedDraftSnapshotIds,
      [historical.id, currentDraft.id],
    );
    const nextSnapshotHistoryMetadata = new Map(stored.snapshotHistoryMetadata);
    const restoredMetadata = restoreHistoryMetadata(projectId, restored.id);
    nextSnapshotHistoryMetadata.set(restoredMetadata.snapshotId, restoredMetadata);
    for (const removedSnapshotId of compacted.removedSnapshotIds) {
      nextSnapshotHistoryMetadata.delete(removedSnapshotId);
    }
    const aggregate = validateProjectAggregate({
      project: nextProject,
      catalogue: stored.catalogue,
      snapshots: compacted.snapshots,
      snapshotHistoryMetadata: [...nextSnapshotHistoryMetadata.values()],
    });

    stored.project = freeze(aggregate.project);
    stored.snapshots = new Map(
      aggregate.snapshots.map((snapshot) => [snapshot.id, freeze(snapshot)]),
    );
    stored.managedDraftSnapshotIds = new Set(
      [...nextManagedDraftSnapshotIds].filter((id) => stored.snapshots.has(id)),
    );
    stored.snapshotHistoryMetadata = new Map(
      aggregate.snapshotHistoryMetadata?.map((metadata) => [metadata.snapshotId, freeze(metadata)]),
    );
    stored.operationSequence = sequence;
    return clone(restored);
  }

  #requireProject(projectId: string): StoredProject {
    const project = this.#projects.get(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    return project;
  }

  #snapshotOwner(snapshotId: string): string | undefined {
    for (const [projectId, stored] of this.#projects) {
      if (stored.snapshots.has(snapshotId)) return projectId;
    }
    return undefined;
  }

  #validatedAggregate(stored: StoredProject): ProjectAggregate {
    return validateProjectAggregate({
      project: stored.project,
      catalogue: stored.catalogue,
      snapshots: [...stored.snapshots.values()],
      ...(stored.snapshotHistoryMetadata.size > 0
        ? { snapshotHistoryMetadata: [...stored.snapshotHistoryMetadata.values()] }
        : {}),
    });
  }

  #snapshotId(
    projectId: string,
    reason: "published" | "restored" | "synchronized",
    revision: number,
    sequence: number,
  ): string {
    return projectScopedSnapshotId(projectId, reason, revision, sequence);
  }

  #nextTimestamp(stored: StoredProject, sequence: number): string {
    const latestTime = Math.max(
      Date.parse(stored.project.updatedAt),
      ...[...stored.snapshots.values()].map((snapshot) => Date.parse(snapshot.createdAt)),
    );
    return new Date(latestTime + sequence * 1_000).toISOString();
  }
}
