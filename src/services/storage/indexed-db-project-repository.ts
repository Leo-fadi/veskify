import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import { aurumNordicSeed } from "@/data/seed";
import { projectSchema, type Project } from "@/domain/project";
import type { StorefrontSnapshot } from "@/domain/storefront";
import {
  DraftConflictError,
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

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const currentHomepageHero = aurumNordicSeed.draftSnapshot.pages
  .find((page) => page.type === "home")
  ?.sections.find((section) => section.component === "hero");

function migrateLegacyPhase0Hero(snapshot: StorefrontSnapshot): StorefrontSnapshot {
  const migrated = clone(snapshot);
  let changed = false;
  for (const page of migrated.pages) {
    for (const section of page.sections) {
      if (
        section.component !== "hero" ||
        section.variant !== "editorial" ||
        !("activeLocale" in section.props || "primaryLocale" in section.props)
      ) {
        continue;
      }
      if (!currentHomepageHero) throw new Error("The current seed must contain a homepage hero.");
      section.content = {
        ...section.content,
        cta: section.content.cta ?? clone(currentHomepageHero.content.cta),
        media: section.content.media ?? clone(currentHomepageHero.content.media),
      };
      section.props = {
        mediaPosition: section.props.mediaPosition ?? currentHomepageHero.props.mediaPosition,
      };
      changed = true;
    }
  }
  return changed ? migrated : snapshot;
}

function phase0Snapshot(snapshot: StorefrontSnapshot): StorefrontSnapshot {
  const legacy = p1_01Snapshot(snapshot);
  const homepage = legacy.pages.find((page) => page.type === "home");
  if (!homepage) return legacy;
  homepage.sections = [
    {
      id: "section_home_hero",
      component: "hero",
      variant: "editorial",
      visible: true,
      content: {
        eyebrow: { en: "Aurum Nordic · Helsinki", fi: "Aurum Nordic · Helsinki" },
        title: { en: "Made for northern light", fi: "Tehty pohjoiseen valoon" },
        body: {
          en: "Jewellery and watches shaped by Nordic clarity and warm materials.",
          fi: "Pohjoismaisen selkeitä koruja ja kelloja lämpimistä materiaaleista.",
        },
      },
      props: { activeLocale: "en", primaryLocale: "en" },
    },
  ];
  return legacy;
}

function p1_01Snapshot(snapshot: StorefrontSnapshot): StorefrontSnapshot {
  const legacy = clone(snapshot);
  const collectionPage = legacy.pages.find((page) => page.type === "collection");
  if (collectionPage) collectionPage.sections = [];
  const productPage = legacy.pages.find((page) => page.type === "product");
  if (productPage) productPage.sections = [];
  return legacy;
}

function p1_02Snapshot(snapshot: StorefrontSnapshot): StorefrontSnapshot {
  const legacy = clone(snapshot);
  const productPage = legacy.pages.find((page) => page.type === "product");
  if (productPage) productPage.sections = [];
  return legacy;
}

function p1_02Catalogue(catalogue: CatalogueDisplayModel): CatalogueDisplayModel {
  const legacy = clone(catalogue);
  const aurora = legacy.products.find((product) => product.id === "product_aurora_ring_585");
  if (aurora)
    aurora.images = aurora.images.filter((image) => image.id !== "asset_aurora_ring_detail");
  return legacy;
}

export const aurumNordicP102SeedState = {
  project: clone(aurumNordicSeed.project),
  catalogue: p1_02Catalogue(aurumNordicSeed.catalogue),
  snapshots: [
    p1_02Snapshot(aurumNordicSeed.publishedSnapshot),
    p1_02Snapshot(aurumNordicSeed.draftSnapshot),
  ],
};

export const aurumNordicP101SeedState = {
  project: clone(aurumNordicSeed.project),
  catalogue: p1_02Catalogue(aurumNordicSeed.catalogue),
  snapshots: [
    p1_01Snapshot(aurumNordicSeed.publishedSnapshot),
    p1_01Snapshot(aurumNordicSeed.draftSnapshot),
  ],
};

export const aurumNordicPhase0SeedState = {
  project: clone(aurumNordicSeed.project),
  catalogue: p1_02Catalogue(aurumNordicSeed.catalogue),
  snapshots: [
    phase0Snapshot(aurumNordicSeed.publishedSnapshot),
    phase0Snapshot(aurumNordicSeed.draftSnapshot),
  ],
};

function defaultSnapshotId({ reason, revision, sequence }: SnapshotIdentityInput): string {
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
  readonly #createSnapshotId: NonNullable<IndexedDbProjectRepositoryOptions["createSnapshotId"]>;
  readonly #createTimestamp: NonNullable<IndexedDbProjectRepositoryOptions["createTimestamp"]>;
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
    const transaction = database.transaction(["projects", "catalogues", "snapshots"], "readonly");
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

  async saveDraft(
    projectId: string,
    input: StorefrontSnapshot,
    expectedBase?: { id: string; revision: number },
  ): Promise<void> {
    const parsedInput = clone(input);
    if (parsedInput.projectId !== projectId) {
      throw new SnapshotProjectMismatchError(projectId, parsedInput.projectId);
    }

    const database = await this.#database();
    const transaction = database.transaction(["projects", "catalogues", "snapshots"], "readwrite");
    const projects = transaction.objectStore("projects");
    const snapshotsStore = transaction.objectStore("snapshots");
    const project = await projects.get(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    const catalogue = await transaction.objectStore("catalogues").get(parsedInput.catalogueRef);
    if (!catalogue) {
      throw repositoryValidationError(
        "Draft snapshot references a catalogue outside the project aggregate.",
        new Error("Catalogue reference mismatch."),
      );
    }
    const snapshot = validateRepositorySnapshot(parsedInput, catalogue);
    const snapshots = await snapshotsStore.index("by-project").getAll(projectId);
    const currentDraft = snapshots.find((candidate) => candidate.id === project.draftSnapshotId);
    if (!currentDraft) {
      throw new SnapshotNotFoundError(projectId, project.draftSnapshotId);
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
    const transaction = database.transaction(["projects", "catalogues", "snapshots"], "readwrite");
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
    const published = validateRepositorySnapshot(
      {
        ...clone(draft),
        id: this.#createSnapshotId({ reason: "published", revision, sequence }),
        revision,
        createdAt: this.#createTimestamp({
          latestTimestamp: latestTimestamp(project, snapshots),
          sequence,
        }),
        createdBy: "user",
      },
      catalogue,
    );
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
    const transaction = database.transaction(["projects", "catalogues", "snapshots"], "readwrite");
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
    const restored = validateRepositorySnapshot(
      {
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
      },
      catalogue,
    );
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
    const transaction = database.transaction(["projects", "catalogues", "snapshots"], "readwrite");
    const projects = transaction.objectStore("projects");
    if ((await projects.count()) > 0) {
      const legacyProject = await projects.get(aurumNordicSeed.project.id);
      if (legacyProject) {
        const legacyCatalogue = await transaction
          .objectStore("catalogues")
          .get(aurumNordicSeed.catalogue.id);
        const legacySnapshots = await transaction
          .objectStore("snapshots")
          .index("by-project")
          .getAll(aurumNordicSeed.project.id);
        const untouched = [
          aurumNordicPhase0SeedState,
          aurumNordicP101SeedState,
          aurumNordicP102SeedState,
        ].some(
          (expectedState) =>
            sameValue(legacyProject, expectedState.project) &&
            sameValue(legacyCatalogue, expectedState.catalogue) &&
            expectedState.snapshots.length === legacySnapshots.length &&
            expectedState.snapshots.every((expected) =>
              legacySnapshots.some(
                (stored) => stored.id === expected.id && sameValue(stored, expected),
              ),
            ),
        );
        if (untouched) {
          await transaction.objectStore("catalogues").put(clone(aurumNordicSeed.catalogue));
          await transaction.objectStore("snapshots").put(clone(aurumNordicSeed.publishedSnapshot));
          await transaction.objectStore("snapshots").put(clone(aurumNordicSeed.draftSnapshot));
          await projects.put(clone(aurumNordicSeed.project));
        } else if (legacyCatalogue) {
          for (const snapshot of legacySnapshots) {
            const migrated = migrateLegacyPhase0Hero(snapshot);
            if (migrated !== snapshot) {
              await transaction
                .objectStore("snapshots")
                .put(validateRepositorySnapshot(migrated, legacyCatalogue));
            }
          }
        }
      }
      await transaction.done;
      return;
    }

    const aggregate = validateProjectAggregate({
      project: clone(aurumNordicSeed.project),
      catalogue: clone(aurumNordicSeed.catalogue),
      snapshots: [clone(aurumNordicSeed.publishedSnapshot), clone(aurumNordicSeed.draftSnapshot)],
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
