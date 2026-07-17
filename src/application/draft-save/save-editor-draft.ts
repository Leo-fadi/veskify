import {
  createStorefrontRenderContext,
  validateRegisteredPage,
  validateRegisteredSnapshot,
} from "@/components/registry";
import type { Locale } from "@/domain/shared";
import type { PageModel, StorefrontSnapshot } from "@/domain/storefront";
import {
  DraftConflictError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";

export class StaleEditorDraftError extends Error {
  readonly code = "STALE_EDITOR_DRAFT";

  constructor() {
    super("The stored draft changed after this editor loaded.");
    this.name = "StaleEditorDraftError";
  }
}

export class EditorDraftValidationError extends Error {
  readonly code = "EDITOR_DRAFT_VALIDATION_FAILED";

  constructor(options?: ErrorOptions) {
    super("The assembled editor draft failed validation.", options);
    this.name = "EditorDraftValidationError";
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function canonicalSnapshotsEqual(left: StorefrontSnapshot, right: StorefrontSnapshot) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function currentDraft(aggregate: ProjectAggregate) {
  const draft = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
  );
  if (!draft) throw new EditorDraftValidationError();
  return draft;
}

export function assembleValidatedEditorDraft({
  baseDraft,
  changedPages,
  aggregate,
  primaryLocale,
  identity,
}: {
  baseDraft: StorefrontSnapshot;
  changedPages: readonly PageModel[];
  aggregate: Pick<ProjectAggregate, "catalogue">;
  primaryLocale: Locale;
  identity?: Pick<StorefrontSnapshot, "id" | "createdAt" | "createdBy">;
}): StorefrontSnapshot {
  try {
    const changedById = new Map(changedPages.map((page) => [page.id, structuredClone(page)]));
    if (changedById.size !== changedPages.length) {
      throw new Error("Changed page IDs must be unique.");
    }
    for (const pageId of changedById.keys()) {
      if (!baseDraft.pages.some((page) => page.id === pageId)) {
        throw new Error(`Changed page ${pageId} is not part of the stored draft.`);
      }
    }

    const candidate: StorefrontSnapshot = {
      ...structuredClone(baseDraft),
      ...(identity ?? {}),
      pages: baseDraft.pages.map((page) => changedById.get(page.id) ?? structuredClone(page)),
    };
    const context = createStorefrontRenderContext({
      activeLocale: primaryLocale,
      primaryLocale,
      catalogue: aggregate.catalogue,
      snapshot: candidate,
    });
    changedPages.forEach((page) => validateRegisteredPage(page, context));
    return validateRegisteredSnapshot(candidate, aggregate.catalogue, primaryLocale, primaryLocale);
  } catch (cause) {
    if (cause instanceof EditorDraftValidationError) throw cause;
    throw new EditorDraftValidationError({ cause });
  }
}

export async function saveValidatedEditorDraft({
  repository,
  projectId,
  loadedDraft,
  changedPages,
  primaryLocale,
  now = () => new Date(),
  createSnapshotId,
}: {
  repository: ProjectRepository;
  projectId: string;
  loadedDraft: StorefrontSnapshot;
  changedPages: readonly PageModel[];
  primaryLocale: Locale;
  now?: () => Date;
  createSnapshotId?: (date: Date) => string;
}): Promise<{ aggregate: ProjectAggregate; draft: StorefrontSnapshot }> {
  const latest = await repository.get(projectId);
  const latestDraft = currentDraft(latest);
  if (
    latestDraft.id !== loadedDraft.id ||
    latestDraft.revision !== loadedDraft.revision ||
    !canonicalSnapshotsEqual(latestDraft, loadedDraft)
  ) {
    throw new StaleEditorDraftError();
  }

  const date = now();
  const snapshotId =
    createSnapshotId?.(date) ??
    `snapshot_draft_${date.getTime().toString(36)}_${stableHash(latestDraft.id)}`;
  const draft = assembleValidatedEditorDraft({
    baseDraft: latestDraft,
    changedPages,
    aggregate: latest,
    primaryLocale,
    identity: {
      id: snapshotId,
      createdAt: date.toISOString(),
      createdBy: "user",
    },
  });

  try {
    await repository.saveDraft(projectId, draft, {
      id: latestDraft.id,
      revision: latestDraft.revision,
    });
  } catch (cause) {
    if (cause instanceof DraftConflictError) throw new StaleEditorDraftError();
    throw cause;
  }

  const aggregate = await repository.get(projectId);
  return { aggregate, draft: structuredClone(currentDraft(aggregate)) };
}
