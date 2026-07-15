import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { Project } from "@/domain/project";
import type { StorefrontSnapshot } from "@/domain/storefront";

export type ProjectAggregate = {
  project: Project;
  catalogue: CatalogueDisplayModel;
  snapshots: StorefrontSnapshot[];
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

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(projectId: string): Promise<ProjectAggregate>;
  saveDraft(projectId: string, snapshot: StorefrontSnapshot): Promise<void>;
  publish(projectId: string, expectedRevision: number): Promise<ProjectAggregate>;
  restore(projectId: string, snapshotId: string): Promise<StorefrontSnapshot>;
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
