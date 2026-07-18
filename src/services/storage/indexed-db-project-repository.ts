import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import { aurumNordicSeed } from "@/data/seed";
import { projectSchema, type Project } from "@/domain/project";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  DraftConflictError,
  InvalidRestoreTargetError,
  NoStorefrontChangesError,
  ProjectNotFoundError,
  PublishedConflictError,
  PublishContentConflictError,
  RevisionConflictError,
  SnapshotNotFoundError,
  SnapshotProjectMismatchError,
  type ProjectAggregate,
  type ProjectRepository,
  type ProjectSummary,
  type PublishExpectation,
  type RestoreExpectation,
  RestoreContentConflictError,
} from "./project-repository";
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

const DATABASE_VERSION = 3;
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
  snapshotProvenance: {
    key: string;
    value: {
      snapshotId: string;
      projectId: string;
      kind: "managedDraft";
    };
    indexes: { "by-project": string };
  };
  snapshotHistoryMetadata: {
    key: string;
    value: SnapshotHistoryMetadata;
    indexes: { "by-project": string };
  };
}

function managedDraftProvenance(projectId: string, snapshotId: string) {
  return { snapshotId, projectId, kind: "managedDraft" as const };
}

export type SnapshotIdentityInput = {
  reason: "published" | "restored" | "synchronized";
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

function defaultTimestamp({ latestTimestamp }: SnapshotTimeInput): string {
  return new Date(Date.parse(latestTimestamp) + 1_000).toISOString();
}

function latestTimestamp(project: Project, snapshots: StorefrontSnapshot[]): string {
  const time = Math.max(
    Date.parse(project.updatedAt),
    ...snapshots.map((snapshot) => Date.parse(snapshot.createdAt)),
  );
  return new Date(time).toISOString();
}

function nextSnapshotSequence(project: Project, snapshots: StorefrontSnapshot[]): number {
  return Date.parse(latestTimestamp(project, snapshots)) + 1;
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
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots", "snapshotHistoryMetadata"],
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
    const snapshotHistoryMetadata = await transaction
      .objectStore("snapshotHistoryMetadata")
      .index("by-project")
      .getAll(projectId);
    await transaction.done;

    if (!catalogue) {
      throw repositoryValidationError(
        `Catalogue for project ${projectId} was not found.`,
        new Error("Catalogue reference must resolve."),
      );
    }
    return clone(
      validateProjectAggregate({
        project,
        catalogue,
        snapshots,
        ...(snapshotHistoryMetadata.length > 0 ? { snapshotHistoryMetadata } : {}),
      }),
    );
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
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots", "snapshotProvenance", "snapshotHistoryMetadata"],
      "readwrite",
    );
    const projects = transaction.objectStore("projects");
    const snapshotsStore = transaction.objectStore("snapshots");
    const provenanceStore = transaction.objectStore("snapshotProvenance");
    const historyMetadataStore = transaction.objectStore("snapshotHistoryMetadata");
    const project = await projects.get(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
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
    const catalogue = await transaction.objectStore("catalogues").get(currentDraft.catalogueRef);
    if (!catalogue) {
      throw repositoryValidationError(
        `Catalogue for project ${projectId} was not found.`,
        new Error("Catalogue reference must resolve."),
      );
    }
    const snapshot = validateRepositorySnapshot(parsedInput, catalogue);
    if (snapshot.catalogueRef !== currentDraft.catalogueRef) {
      throw repositoryValidationError(
        "Draft snapshot references a catalogue outside the project aggregate.",
        new Error("Catalogue reference mismatch."),
      );
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
    const stagedSnapshots = existing
      ? snapshots.map((candidate) => (candidate.id === snapshot.id ? snapshot : candidate))
      : [...snapshots, snapshot];
    const provenance = await provenanceStore.index("by-project").getAll(projectId);
    const managedDraftSnapshotIds = new Set(provenance.map(({ snapshotId }) => snapshotId));
    managedDraftSnapshotIds.add(snapshot.id);
    const compacted = compactManagedDraftHistory(
      stagedSnapshots,
      nextProject,
      managedDraftSnapshotIds,
    );
    validateProjectAggregate({ project: nextProject, catalogue, snapshots: compacted.snapshots });

    try {
      await snapshotsStore.put(snapshot);
      await projects.put(nextProject);
      await provenanceStore.put(managedDraftProvenance(projectId, snapshot.id));
      await historyMetadataStore.delete(snapshot.id);
      for (const removedSnapshotId of compacted.removedSnapshotIds) {
        await snapshotsStore.delete(removedSnapshotId);
        await provenanceStore.delete(removedSnapshotId);
        await historyMetadataStore.delete(removedSnapshotId);
      }
      await transaction.done;
    } catch (cause) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted.
      }
      await transaction.done.catch(() => undefined);
      throw cause;
    }
  }

  async publish(projectId: string, expectation: PublishExpectation): Promise<ProjectAggregate> {
    const database = await this.#database();
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots", "snapshotProvenance", "snapshotHistoryMetadata"],
      "readwrite",
    );
    const projects = transaction.objectStore("projects");
    const snapshotsStore = transaction.objectStore("snapshots");
    const provenanceStore = transaction.objectStore("snapshotProvenance");
    const historyMetadataStore = transaction.objectStore("snapshotHistoryMetadata");

    try {
      const project = await projects.get(projectId);
      if (!project) {
        throw new ProjectNotFoundError(projectId);
      }
      if (project.revision !== expectation.projectRevision) {
        throw new RevisionConflictError(projectId, expectation.projectRevision, project.revision);
      }

      const snapshots = await snapshotsStore.index("by-project").getAll(projectId);
      const draft = snapshots.find((snapshot) => snapshot.id === project.draftSnapshotId);
      if (!draft) {
        throw new SnapshotNotFoundError(projectId, project.draftSnapshotId);
      }
      const previousPublished = snapshots.find(
        (snapshot) => snapshot.id === project.publishedSnapshotId,
      );
      if (!previousPublished) {
        throw new SnapshotNotFoundError(projectId, project.publishedSnapshotId);
      }
      const catalogue = await transaction.objectStore("catalogues").get(draft.catalogueRef);
      if (!catalogue) {
        throw repositoryValidationError(
          `Catalogue for project ${projectId} was not found.`,
          new Error("Catalogue reference must resolve."),
        );
      }
      validateProjectAggregate({ project, catalogue, snapshots });
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

      const revision = project.revision + 1;
      const sequence = nextSnapshotSequence(project, snapshots);
      const createdAt = this.#createTimestamp({
        latestTimestamp: latestTimestamp(project, snapshots),
        sequence,
      });
      const published = validateRepositorySnapshot(
        {
          ...clone(draft),
          id: this.#createSnapshotId({ reason: "published", revision, sequence }),
          revision,
          createdAt,
          createdBy: "user",
        },
        catalogue,
      );
      const synchronizedDraft = validateRepositorySnapshot(
        {
          ...clone(published),
          id: this.#createSnapshotId({ reason: "synchronized", revision, sequence }),
          createdBy: "system",
        },
        catalogue,
      );
      const existingIds = new Set(snapshots.map(({ id }) => id));
      if (
        published.id === synchronizedDraft.id ||
        existingIds.has(published.id) ||
        existingIds.has(synchronizedDraft.id)
      ) {
        throw repositoryValidationError(
          "Publishing must create two unique snapshot identities.",
          new Error("Generated snapshot IDs must remain unique."),
        );
      }
      const nextProject = projectSchema.parse({
        ...project,
        publishedSnapshotId: published.id,
        draftSnapshotId: synchronizedDraft.id,
        revision,
        updatedAt: createdAt,
      });
      const provenance = await provenanceStore.index("by-project").getAll(projectId);
      const managedDraftSnapshotIds = new Set(provenance.map(({ snapshotId }) => snapshotId));
      managedDraftSnapshotIds.add(synchronizedDraft.id);
      const compacted = compactManagedDraftHistory(
        [...snapshots, published, synchronizedDraft],
        nextProject,
        managedDraftSnapshotIds,
      );
      const aggregate = validateProjectAggregate({
        project: nextProject,
        catalogue,
        snapshots: compacted.snapshots,
        snapshotHistoryMetadata: [
          ...(await historyMetadataStore.index("by-project").getAll(projectId)).filter(
            ({ snapshotId }) => !compacted.removedSnapshotIds.includes(snapshotId),
          ),
          ...publishHistoryMetadata(projectId, published.id, synchronizedDraft.id),
        ],
      });

      await snapshotsStore.put(published);
      await snapshotsStore.put(synchronizedDraft);
      await projects.put(nextProject);
      await provenanceStore.put(managedDraftProvenance(projectId, synchronizedDraft.id));
      for (const metadata of publishHistoryMetadata(
        projectId,
        published.id,
        synchronizedDraft.id,
      )) {
        await historyMetadataStore.put(metadata);
      }
      for (const removedSnapshotId of compacted.removedSnapshotIds) {
        await snapshotsStore.delete(removedSnapshotId);
        await provenanceStore.delete(removedSnapshotId);
        await historyMetadataStore.delete(removedSnapshotId);
      }
      await transaction.done;
      return clone(aggregate);
    } catch (cause) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted.
      }
      await transaction.done.catch(() => undefined);
      throw cause;
    }
  }

  async restore(
    projectId: string,
    snapshotId: string,
    expectation?: RestoreExpectation,
  ): Promise<StorefrontSnapshot> {
    const database = await this.#database();
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots", "snapshotProvenance", "snapshotHistoryMetadata"],
      "readwrite",
    );
    const projects = transaction.objectStore("projects");
    const snapshotsStore = transaction.objectStore("snapshots");
    const provenanceStore = transaction.objectStore("snapshotProvenance");
    const historyMetadataStore = transaction.objectStore("snapshotHistoryMetadata");
    const project = await projects.get(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    if (snapshotId === project.draftSnapshotId) {
      throw new InvalidRestoreTargetError(projectId, snapshotId);
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

    const currentDraft = snapshots.find((snapshot) => snapshot.id === project.draftSnapshotId);
    if (!currentDraft) {
      throw new SnapshotNotFoundError(projectId, project.draftSnapshotId);
    }
    if (expectation) {
      if (project.revision !== expectation.projectRevision) {
        throw new RevisionConflictError(projectId, expectation.projectRevision, project.revision);
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
    const sequence = nextSnapshotSequence(project, snapshots);
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
    const provenance = await provenanceStore.index("by-project").getAll(projectId);
    const managedDraftSnapshotIds = new Set(provenance.map(({ snapshotId }) => snapshotId));
    managedDraftSnapshotIds.add(restored.id);
    const compacted = compactManagedDraftHistory(
      [...snapshots, restored],
      nextProject,
      managedDraftSnapshotIds,
      [historical.id, currentDraft.id],
    );
    validateProjectAggregate({
      project: nextProject,
      catalogue,
      snapshots: compacted.snapshots,
      snapshotHistoryMetadata: [
        ...(await historyMetadataStore.index("by-project").getAll(projectId)).filter(
          ({ snapshotId }) => !compacted.removedSnapshotIds.includes(snapshotId),
        ),
        restoreHistoryMetadata(projectId, restored.id),
      ],
    });

    try {
      await snapshotsStore.put(restored);
      await projects.put(nextProject);
      await provenanceStore.put(managedDraftProvenance(projectId, restored.id));
      await historyMetadataStore.put(restoreHistoryMetadata(projectId, restored.id));
      for (const removedSnapshotId of compacted.removedSnapshotIds) {
        await snapshotsStore.delete(removedSnapshotId);
        await provenanceStore.delete(removedSnapshotId);
        await historyMetadataStore.delete(removedSnapshotId);
      }
      await transaction.done;
    } catch (cause) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted.
      }
      await transaction.done.catch(() => undefined);
      throw cause;
    }
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
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore("projects", { keyPath: "id" });
          database.createObjectStore("catalogues", { keyPath: "id" });
          const snapshots = database.createObjectStore("snapshots", { keyPath: "id" });
          snapshots.createIndex("by-project", "projectId");
        }
        if (oldVersion < 2) {
          const provenance = database.createObjectStore("snapshotProvenance", {
            keyPath: "snapshotId",
          });
          provenance.createIndex("by-project", "projectId");
        }
        if (oldVersion < 3) {
          const historyMetadata = database.createObjectStore("snapshotHistoryMetadata", {
            keyPath: "snapshotId",
          });
          historyMetadata.createIndex("by-project", "projectId");
        }
      },
    });
    await this.#bootstrap(database);
    return database;
  }

  async #bootstrap(database: IDBPDatabase<VeskifyDatabase>): Promise<void> {
    const transaction = database.transaction(
      ["projects", "catalogues", "snapshots", "snapshotProvenance", "snapshotHistoryMetadata"],
      "readwrite",
    );
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
    await transaction
      .objectStore("snapshotProvenance")
      .put(managedDraftProvenance(aggregate.project.id, aggregate.project.draftSnapshotId));
    await projects.put(aggregate.project);
    await transaction.done;
  }
}

export function createBrowserProjectRepository(
  options?: IndexedDbProjectRepositoryOptions,
): IndexedDbProjectRepository {
  return new IndexedDbProjectRepository(options);
}
