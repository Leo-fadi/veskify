import { validateRegisteredSnapshot } from "@/components/registry";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { projectSchema } from "@/domain/project";
import { storefrontSnapshotSchema, type StorefrontSnapshot } from "@/domain/storefront";
import { RepositoryValidationError, type ProjectAggregate } from "./project-repository";

export function repositoryValidationError(
  message: string,
  cause: unknown,
): RepositoryValidationError {
  return new RepositoryValidationError(message, { cause });
}

export function validateRepositorySnapshot(input: unknown): StorefrontSnapshot {
  try {
    return validateRegisteredSnapshot(storefrontSnapshotSchema.parse(input));
  } catch (cause) {
    throw repositoryValidationError(
      "Snapshot failed canonical or component-registry validation.",
      cause,
    );
  }
}

export function validateProjectAggregate(input: ProjectAggregate): ProjectAggregate {
  try {
    const project = projectSchema.parse(input.project);
    const catalogue = catalogueDisplayModelSchema.parse(input.catalogue);
    const snapshots = input.snapshots.map(validateRepositorySnapshot);
    const snapshotIds = snapshots.map((snapshot) => snapshot.id);

    if (new Set(snapshotIds).size !== snapshotIds.length) {
      throw new Error("Snapshot IDs must be unique within a project aggregate.");
    }
    if (!snapshotIds.includes(project.draftSnapshotId)) {
      throw new Error("The draft snapshot reference must resolve.");
    }
    if (!snapshotIds.includes(project.publishedSnapshotId)) {
      throw new Error("The published snapshot reference must resolve.");
    }
    if (
      snapshots.some(
        (snapshot) => snapshot.projectId !== project.id || snapshot.catalogueRef !== catalogue.id,
      )
    ) {
      throw new Error("Snapshot project and catalogue references must resolve.");
    }

    return { project, catalogue, snapshots };
  } catch (cause) {
    if (cause instanceof RepositoryValidationError) {
      throw cause;
    }
    throw repositoryValidationError("Project aggregate failed repository validation.", cause);
  }
}
