import { projectSchema, type Project } from "@/domain/project";
import type { StorefrontSnapshot } from "@/domain/storefront";
import {
  ProjectNotFoundError,
  RevisionConflictError,
  SnapshotNotFoundError,
  SnapshotProjectMismatchError,
  type ProjectAggregate,
  type ProjectRepository,
  type ProjectSummary,
} from "./project-repository";
import {
  repositoryValidationError,
  validateProjectAggregate,
  validateRepositorySnapshot,
} from "./repository-validation";

type StoredProject = {
  project: Project;
  catalogue: ProjectAggregate["catalogue"];
  snapshots: Map<string, StorefrontSnapshot>;
  operationSequence: number;
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

export class InMemoryProjectRepository implements ProjectRepository {
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
        snapshots: new Map(
          aggregate.snapshots.map((snapshot) => [snapshot.id, freeze(snapshot)]),
        ),
        operationSequence: aggregate.snapshots.length,
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

  async saveDraft(projectId: string, input: StorefrontSnapshot): Promise<void> {
    await Promise.resolve();
    const stored = this.#requireProject(projectId);
    const snapshot = validateRepositorySnapshot(clone(input));

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
    if (
      stored.snapshots.has(snapshot.id) &&
      snapshot.id !== stored.project.draftSnapshotId
    ) {
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
    stored.snapshots.set(snapshot.id, freeze(snapshot));
    stored.project = freeze(nextProject);
    this.#validatedAggregate(stored);
  }

  async publish(projectId: string, expectedRevision: number): Promise<ProjectAggregate> {
    await Promise.resolve();
    const stored = this.#requireProject(projectId);
    if (stored.project.revision !== expectedRevision) {
      throw new RevisionConflictError(projectId, expectedRevision, stored.project.revision);
    }

    const draft = stored.snapshots.get(stored.project.draftSnapshotId);
    if (!draft) {
      throw new SnapshotNotFoundError(projectId, stored.project.draftSnapshotId);
    }

    const revision = stored.project.revision + 1;
    const published = validateRepositorySnapshot({
      ...clone(draft),
      id: this.#nextSnapshotId(stored, "published", revision),
      revision,
      createdAt: this.#nextTimestamp(stored),
      createdBy: "user",
    });
    const nextProject = projectSchema.parse({
      ...stored.project,
      publishedSnapshotId: published.id,
      revision,
      updatedAt: published.createdAt,
    });

    stored.snapshots.set(published.id, freeze(published));
    stored.project = freeze(nextProject);
    return clone(this.#validatedAggregate(stored));
  }

  async restore(projectId: string, snapshotId: string): Promise<StorefrontSnapshot> {
    await Promise.resolve();
    const stored = this.#requireProject(projectId);
    const historical = stored.snapshots.get(snapshotId);
    if (!historical) {
      throw new SnapshotNotFoundError(projectId, snapshotId);
    }

    const restored = validateRepositorySnapshot({
      ...clone(historical),
      id: this.#nextSnapshotId(stored, "restored", stored.project.revision),
      createdAt: this.#nextTimestamp(stored),
      createdBy: "user",
    });
    const nextProject = projectSchema.parse({
      ...stored.project,
      draftSnapshotId: restored.id,
      updatedAt: restored.createdAt,
    });

    stored.snapshots.set(restored.id, freeze(restored));
    stored.project = freeze(nextProject);
    this.#validatedAggregate(stored);
    return clone(restored);
  }

  #requireProject(projectId: string): StoredProject {
    const project = this.#projects.get(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    return project;
  }

  #validatedAggregate(stored: StoredProject): ProjectAggregate {
    return validateProjectAggregate({
      project: stored.project,
      catalogue: stored.catalogue,
      snapshots: [...stored.snapshots.values()],
    });
  }

  #nextSnapshotId(
    stored: StoredProject,
    reason: "published" | "restored",
    revision: number,
  ): string {
    stored.operationSequence += 1;
    return `snapshot_${reason}_${revision}_${stored.operationSequence}`;
  }

  #nextTimestamp(stored: StoredProject): string {
    const latestTime = Math.max(
      Date.parse(stored.project.updatedAt),
      ...[...stored.snapshots.values()].map((snapshot) => Date.parse(snapshot.createdAt)),
    );
    return new Date(latestTime + stored.operationSequence * 1_000).toISOString();
  }
}
