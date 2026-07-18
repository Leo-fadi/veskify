import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { Project } from "@/domain/project";
import type { StorefrontSnapshot } from "@/domain/storefront";
import type { SnapshotHistoryMetadata } from "./snapshot-history-metadata";

export type ProjectAggregate = {
  project: Project;
  catalogue: CatalogueDisplayModel;
  snapshots: StorefrontSnapshot[];
  snapshotHistoryMetadata?: SnapshotHistoryMetadata[];
};

export type ProjectSummary = Pick<
  Project,
  | "id"
  | "name"
  | "industry"
  | "primaryLocale"
  | "enabledLocales"
  | "publishedSnapshotId"
  | "draftSnapshotId"
  | "revision"
  | "updatedAt"
>;

export type DraftBaseIdentity = Pick<StorefrontSnapshot, "id" | "revision">;

export type PublishSnapshotExpectation = DraftBaseIdentity & {
  contentFingerprint: string;
};

export type PublishExpectation = {
  projectRevision: number;
  draft: PublishSnapshotExpectation;
  published: PublishSnapshotExpectation;
};

export type RestoreExpectation = {
  projectRevision: number;
  draft: PublishSnapshotExpectation;
  target: PublishSnapshotExpectation;
};

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(projectId: string): Promise<ProjectAggregate>;
  create(aggregate: ProjectAggregate): Promise<ProjectAggregate>;
  saveDraft(
    projectId: string,
    snapshot: StorefrontSnapshot,
    expectedBase?: DraftBaseIdentity,
  ): Promise<void>;
  publish(projectId: string, expectation: PublishExpectation): Promise<ProjectAggregate>;
  restore(
    projectId: string,
    snapshotId: string,
    expectation?: RestoreExpectation,
  ): Promise<StorefrontSnapshot>;
}

export class ProjectAlreadyExistsError extends Error {
  readonly code = "PROJECT_ALREADY_EXISTS";

  constructor(readonly projectId: string) {
    super(`Project already exists: ${projectId}.`);
    this.name = "ProjectAlreadyExistsError";
  }
}

export class CatalogueAlreadyExistsError extends Error {
  readonly code = "CATALOGUE_ALREADY_EXISTS";

  constructor(readonly catalogueId: string) {
    super(`Catalogue already exists: ${catalogueId}.`);
    this.name = "CatalogueAlreadyExistsError";
  }
}

export class SnapshotAlreadyExistsError extends Error {
  readonly code = "SNAPSHOT_ALREADY_EXISTS";

  constructor(readonly snapshotId: string) {
    super(`Snapshot already exists: ${snapshotId}.`);
    this.name = "SnapshotAlreadyExistsError";
  }
}

export class ProjectNotFoundError extends Error {
  readonly code = "PROJECT_NOT_FOUND";

  constructor(readonly projectId: string) {
    super(`Project not found: ${projectId}.`);
    this.name = "ProjectNotFoundError";
  }
}

export class SnapshotNotFoundError extends Error {
  readonly code = "SNAPSHOT_NOT_FOUND";

  constructor(
    readonly projectId: string,
    readonly snapshotId: string,
  ) {
    super(`Snapshot ${snapshotId} was not found for project ${projectId}.`);
    this.name = "SnapshotNotFoundError";
  }
}

export class InvalidRestoreTargetError extends Error {
  readonly code = "INVALID_RESTORE_TARGET";

  constructor(
    readonly projectId: string,
    readonly snapshotId: string,
  ) {
    super(`Snapshot ${snapshotId} is already the current draft for project ${projectId}.`);
    this.name = "InvalidRestoreTargetError";
  }
}

export class RestoreContentConflictError extends Error {
  readonly code = "RESTORE_CONTENT_CONFLICT";

  constructor(
    readonly projectId: string,
    readonly target: "draft" | "target",
  ) {
    super(`Project ${projectId} ${target} content changed after restore preparation.`);
    this.name = "RestoreContentConflictError";
  }
}

export class RevisionConflictError extends Error {
  readonly code = "REVISION_CONFLICT";

  constructor(
    readonly projectId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `Project ${projectId} revision conflict: expected ${expectedRevision}, actual ${actualRevision}.`,
    );
    this.name = "RevisionConflictError";
  }
}

export class DraftConflictError extends Error {
  readonly code = "DRAFT_CONFLICT";

  constructor(
    readonly projectId: string,
    readonly expectedBase: DraftBaseIdentity,
    readonly actualBase: DraftBaseIdentity,
  ) {
    super(
      `Project ${projectId} draft conflict: expected ${expectedBase.id}@${expectedBase.revision}, actual ${actualBase.id}@${actualBase.revision}.`,
    );
    this.name = "DraftConflictError";
  }
}

export class PublishedConflictError extends Error {
  readonly code = "PUBLISHED_CONFLICT";

  constructor(
    readonly projectId: string,
    readonly expectedBase: DraftBaseIdentity,
    readonly actualBase: DraftBaseIdentity,
  ) {
    super(
      `Project ${projectId} published conflict: expected ${expectedBase.id}@${expectedBase.revision}, actual ${actualBase.id}@${actualBase.revision}.`,
    );
    this.name = "PublishedConflictError";
  }
}

export class PublishContentConflictError extends Error {
  readonly code = "PUBLISH_CONTENT_CONFLICT";

  constructor(
    readonly projectId: string,
    readonly target: "draft" | "published",
  ) {
    super(`Project ${projectId} ${target} content changed after publish preparation.`);
    this.name = "PublishContentConflictError";
  }
}

export class NoStorefrontChangesError extends Error {
  readonly code = "NO_STOREFRONT_CHANGES";

  constructor(readonly projectId: string) {
    super(`Project ${projectId} has no storefront changes to publish.`);
    this.name = "NoStorefrontChangesError";
  }
}

export class SnapshotProjectMismatchError extends Error {
  readonly code = "SNAPSHOT_PROJECT_MISMATCH";

  constructor(
    readonly projectId: string,
    readonly snapshotProjectId: string,
  ) {
    super(`Snapshot belongs to ${snapshotProjectId}, not ${projectId}.`);
    this.name = "SnapshotProjectMismatchError";
  }
}

export class RepositoryValidationError extends Error {
  readonly code = "REPOSITORY_VALIDATION_FAILED";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RepositoryValidationError";
  }
}
