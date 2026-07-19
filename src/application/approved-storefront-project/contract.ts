import type { InitialProjectAggregateInput } from "@/application/initial-project-aggregate";
import type { ProjectRepository } from "@/services/storage";

export type ApprovedStorefrontProjectInput = Readonly<
  InitialProjectAggregateInput & {
    repository: ProjectRepository;
  }
>;

export type ApprovedStorefrontProjectResult = Readonly<{
  projectId: string;
  editorRoute: string;
  draftSnapshotId: string;
  publishedSnapshotId: string;
}>;

export type ApprovedStorefrontProjectErrorCode =
  | "invalid-input"
  | "inconsistent-generation-review"
  | "review-not-ready"
  | "aggregate-construction-failed"
  | "project-identity-conflict"
  | "catalogue-identity-conflict"
  | "snapshot-identity-conflict"
  | "repository-failure";

export class ApprovedStorefrontProjectError extends Error {
  readonly causeValue: unknown;

  constructor(
    readonly code: ApprovedStorefrontProjectErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ApprovedStorefrontProjectError";
    this.causeValue = cause;
  }
}
