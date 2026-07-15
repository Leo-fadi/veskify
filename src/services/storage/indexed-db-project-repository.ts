import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import { aurumNordicSeed } from "@/data/seed";
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

const DATABASE_VERSION = 1;
export const VESKIFY_DATABASE_NAME = "veskify";

interface VeskifyDatabase extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  catalogues: {
    key: string;
    value: CatalogueDisplayModel;
  };
  snapshots: {
    key: string;
    value: StorefrontSnapshot;
    indexes: { "by-project": string };
  };
}

export type SnapshotIdentityInput = {
  reason: "published" | "restored";
  revision: number;
  sequence: number;
};

export type SnapshotTimeInput = {
  latestTimestamp: string;
  sequence: number;
};

export type IndexedDbProjectRepositoryOptions = {
  databaseName?: string;
  createSnapshotId?: (input: SnapshotIdentityInput) => string;
  createTimestamp?: (input: SnapshotTimeInput) => string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function defaultSnapshotId({
  reason,
  revision,
  sequence,
}: SnapshotIdentityInput): string {
  return `snapshot_${reason}_${revision}_${sequence}`;
}

function defaultTimestamp({ latestTimestamp, sequence }: SnapshotTimeInput): string {
  return new Date(Date.parse(latestTimestamp) + sequence * 1_000).toISOString();
}

function latestTimestamp(project: Project, snapshots: StorefrontSnapshot[]): string {
  const time = Math.max(
    Date.parse(project.updatedAt),
    ...snapshots.map((snapshot) => Date.parse(snapshot.createdAt)),
  );
  return new Date(time).toISOString();
}

function toSummary(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    industry: project.industry,
    primaryLocale: project.primaryLocale,
    enabledLocales: project.enabledLocales,
    publishedSnapshotId: project.publishedSnapshotId,
    draftSnapshotId: project.draftSnapshotId,
    revision: project.revision,
    updatedAt: project.updatedAt,
  };
}

export class IndexedDbProjectRepository implements ProjectRepository {
  readonly #databaseName: string;
  readonly #createSnapshotId: NonNullable<
    IndexedDbProjectRepositoryOptions["createSnapshotId"]
  >;
  readonly #createTimestamp: NonNullable<
    IndexedDbProjectRepositoryOptions["createTimestamp"]
  >;
  #databasePromise?: Promise<IDBPDatabase<VeskifyDatabase>>;

  constructor(options: IndexedDbProjectRepositoryOptions = {}) {
    this.#databaseName = options.databaseName ?? VESKIFY_DATABASE_NAME;
    this.#createSnapshotId = options.createSnapshotId ?? defaultSnapshotId;
    this.#createTimestamp = options.createTimestamp ?? defaultTimestamp;
  }

  async list(): Promise<ProjectSummary[]> {
    const database = await this.#database();
    const projects = await database.getAll("projects");
    return projects
      .map((project) => toSummary(projectSchema.parse(project)))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(clone);
  }

  async get(projectId: string): Promise<ProjectAggregate> {
    const database = await this.#database();
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots"],
      "readonly",
    );
    const project = await transaction.objectStore("projects").get(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    const snapshots = await transaction
      .objectStore("snapshots")
      .index("by-project")
      .getAll(projectId);
    const catalogue = snapshots[0]
      ? await transaction.objectStore("catalogues").get(snapshots[0].catalogueRef)
      : undefined;
    await transaction.done;

    if (!catalogue) {
      throw repositoryValidationError(
        `Catalogue for project ${projectId} was not found.`,
        new Error("Catalogue reference must resolve."),
      );
    }
    return clone(validateProjectAggregate({ project, catalogue, snapshots }));
  }

  async saveDraft(projectId: string, input: StorefrontSnapshot): Promise<void> {
    const snapshot = validateRepositorySnapshot(clone(input));
    if (snapshot.projectId !== projectId) {
      throw new SnapshotProjectMismatchError(projectId, snapshot.projectId);
    }

    const database = await this.#database();
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots"],
      "readwrite",
    );
    const projects = transaction.objectStore("projects");
    const snapshotsStore = transaction.objectStore("snapshots");
    const project = await projects.get(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    const catalogue = await transaction.objectStore("catalogues").get(snapshot.catalogueRef);
    if (!catalogue) {
      throw repositoryValidationError(
        "Draft snapshot references a catalogue outside the project aggregate.",
        new Error("Catalogue reference mismatch."),
      );
    }
    const snapshots = await snapshotsStore.index("by-project").getAll(projectId);
    const existing = snapshots.find((candidate) => candidate.id === snapshot.id);
    if (snapshot.id === project.publishedSnapshotId) {
      throw repositoryValidationError(
        "A draft snapshot cannot reuse the current published snapshot ID.",
        new Error("Draft and published snapshots must remain separate."),
      );
    }
    if (existing && snapshot.id !== project.draftSnapshotId) {
      throw repositoryValidationError(
        "A draft snapshot cannot overwrite immutable history.",
        new Error("Historical snapshot IDs cannot be reused."),
      );
    }

    const nextProject = projectSchema.parse({
      ...project,
      draftSnapshotId: snapshot.id,
      updatedAt: snapshot.createdAt,
    });
    const nextSnapshots = existing
      ? snapshots.map((candidate) => (candidate.id === snapshot.id ? snapshot : candidate))
      : [...snapshots, snapshot];
    validateProjectAggregate({ project: nextProject, catalogue, snapshots: nextSnapshots });

    await snapshotsStore.put(snapshot);
    await projects.put(nextProject);
    await transaction.done;
  }

  async publish(projectId: string, expectedRevision: number): Promise<ProjectAggregate> {
    const database = await this.#database();
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots"],
      "readwrite",
    );
    const projects = transaction.objectStore("projects");
    const snapshotsStore = transaction.objectStore("snapshots");
    const project = await projects.get(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    if (project.revision !== expectedRevision) {
      throw new RevisionConflictError(projectId, expectedRevision, project.revision);
    }

    const snapshots = await snapshotsStore.index("by-project").getAll(projectId);
    const draft = snapshots.find((snapshot) => snapshot.id === project.draftSnapshotId);
    if (!draft) {
      throw new SnapshotNotFoundError(projectId, project.draftSnapshotId);
    }
    const catalogue = await transaction.objectStore("catalogues").get(draft.catalogueRef);
    if (!catalogue) {
      throw repositoryValidationError(
        `Catalogue for project ${projectId} was not found.`,
        new Error("Catalogue reference must resolve."),
      );
    }

    const revision = project.revision + 1;
    const sequence = snapshots.length + 1;
    const published = validateRepositorySnapshot({
      ...clone(draft),
      id: this.#createSnapshotId({ reason: "published", revision, sequence }),
      revision,
      createdAt: this.#createTimestamp({
        latestTimestamp: latestTimestamp(project, snapshots),
        sequence,
      }),
      createdBy: "user",
    });
    if (snapshots.some((snapshot) => snapshot.id === published.id)) {
      throw repositoryValidationError(
        "Generated published snapshot ID already exists.",
        new Error("Snapshot IDs must remain unique."),
      );
    }
    const nextProject = projectSchema.parse({
      ...project,
      publishedSnapshotId: published.id,
      revision,
      updatedAt: published.createdAt,
    });
    const aggregate = validateProjectAggregate({
      project: nextProject,
      catalogue,
      snapshots: [...snapshots, published],
    });

    await snapshotsStore.put(published);
    await projects.put(nextProject);
    await transaction.done;
    return clone(aggregate);
  }

  async restore(projectId: string, snapshotId: string): Promise<StorefrontSnapshot> {
    const database = await this.#database();
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots"],
      "readwrite",
    );
    const projects = transaction.objectStore("projects");
    const snapshotsStore = transaction.objectStore("snapshots");
    const project = await projects.get(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    const historical = await snapshotsStore.get(snapshotId);
    if (!historical || historical.projectId !== projectId) {
      throw new SnapshotNotFoundError(projectId, snapshotId);
    }
    const snapshots = await snapshotsStore.index("by-project").getAll(projectId);
    const catalogue = await transaction.objectStore("catalogues").get(historical.catalogueRef);
    if (!catalogue) {
      throw repositoryValidationError(
        `Catalogue for project ${projectId} was not found.`,
        new Error("Catalogue reference must resolve."),
      );
    }

    const sequence = snapshots.length + 1;
    const restored = validateRepositorySnapshot({
      ...clone(historical),
      id: this.#createSnapshotId({
        reason: "restored",
        revision: project.revision,
        sequence,
      }),
      revision: project.revision,
      createdAt: this.#createTimestamp({
        latestTimestamp: latestTimestamp(project, snapshots),
        sequence,
      }),
      createdBy: "user",
    });
    if (snapshots.some((snapshot) => snapshot.id === restored.id)) {
      throw repositoryValidationError(
        "Generated restored snapshot ID already exists.",
        new Error("Snapshot IDs must remain unique."),
      );
    }
    const nextProject = projectSchema.parse({
      ...project,
      draftSnapshotId: restored.id,
      updatedAt: restored.createdAt,
    });
    validateProjectAggregate({
      project: nextProject,
      catalogue,
      snapshots: [...snapshots, restored],
    });

    await snapshotsStore.put(restored);
    await projects.put(nextProject);
    await transaction.done;
    return clone(restored);
  }

  async close(): Promise<void> {
    const databasePromise = this.#databasePromise;
    if (!databasePromise) return;
    (await databasePromise).close();
    this.#databasePromise = undefined;
  }

  async #database(): Promise<IDBPDatabase<VeskifyDatabase>> {
    this.#databasePromise ??= this.#openAndBootstrap();
    return this.#databasePromise;
  }

  async #openAndBootstrap(): Promise<IDBPDatabase<VeskifyDatabase>> {
    const database = await openDB<VeskifyDatabase>(this.#databaseName, DATABASE_VERSION, {
      upgrade(database) {
        database.createObjectStore("projects", { keyPath: "id" });
        database.createObjectStore("catalogues", { keyPath: "id" });
        const snapshots = database.createObjectStore("snapshots", { keyPath: "id" });
        snapshots.createIndex("by-project", "projectId");
      },
    });
    await this.#bootstrap(database);
    return database;
  }

  async #bootstrap(database: IDBPDatabase<VeskifyDatabase>): Promise<void> {
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots"],
      "readwrite",
    );
    const projects = transaction.objectStore("projects");
    if ((await projects.count()) > 0) {
      await transaction.done;
      return;
    }

    const aggregate = validateProjectAggregate({
      project: clone(aurumNordicSeed.project),
      catalogue: clone(aurumNordicSeed.catalogue),
      snapshots: [
        clone(aurumNordicSeed.publishedSnapshot),
        clone(aurumNordicSeed.draftSnapshot),
      ],
    });
    await transaction.objectStore("catalogues").put(aggregate.catalogue);
    for (const snapshot of aggregate.snapshots) {
      await transaction.objectStore("snapshots").put(snapshot);
    }
    await projects.put(aggregate.project);
    await transaction.done;
  }
}

export function createBrowserProjectRepository(
  options?: IndexedDbProjectRepositoryOptions,
): IndexedDbProjectRepository {
  return new IndexedDbProjectRepository(options);
}
