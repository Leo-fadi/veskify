import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import type { StorefrontSnapshot } from "@/domain/storefront";
import {
  composedStaticDraftOperationsFor,
  DraftConflictError,
  type ComposedStaticDraftCapability,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage/project-repository";
import { composedDraftContextFingerprint } from "./composed-draft-validation";
import {
  allocateEditorDraftIdentity,
  canonicalSnapshotsEqual,
  currentDraft,
  EditorDraftValidationError,
  readBackEditorDraft,
  StaleEditorDraftError,
} from "./save-editor-draft";

/** Explicit complete canonical input. Puck data and persisted authority strings are not accepted. */
export async function saveComposedEditorDraft({
  repository,
  capability,
  loadedAggregate,
  workingSnapshot,
  now = () => new Date(),
  createSnapshotId,
}: {
  repository: ProjectRepository;
  capability: ComposedStaticDraftCapability;
  loadedAggregate: ProjectAggregate;
  workingSnapshot: StorefrontSnapshot;
  now?: () => Date;
  createSnapshotId?: (date: Date) => string;
}) {
  const loaded = structuredClone(loadedAggregate);
  const working = structuredClone(workingSnapshot);
  const base = currentDraft(loaded);
  const operations = composedStaticDraftOperationsFor(capability);
  if (!operations || !("compositionExtensionVersion" in working))
    throw new EditorDraftValidationError();
  if (
    ["id", "revision", "projectId", "catalogueRef", "createdAt", "createdBy"].some(
      (key) => Reflect.get(working, key) !== Reflect.get(base, key),
    )
  )
    throw new EditorDraftValidationError();
  const latest = await repository.get(loaded.project.id);
  const latestDraft = currentDraft(latest);
  if (
    !canonicalSnapshotsEqual(base, latestDraft) ||
    composedDraftContextFingerprint(loaded) !== composedDraftContextFingerprint(latest)
  )
    throw new StaleEditorDraftError();
  let draft: StorefrontSnapshot;
  try {
    draft = operations.validateSnapshot(
      { ...working, ...allocateEditorDraftIdentity(base, now, createSnapshotId) },
      latest,
    );
  } catch (cause) {
    throw new EditorDraftValidationError({ cause });
  }
  try {
    await repository.saveDraft(loaded.project.id, draft, {
      id: base.id,
      revision: base.revision,
      snapshotFingerprint: canonicalValueFingerprint(base),
      contextFingerprint: composedDraftContextFingerprint(loaded),
    });
  } catch (cause) {
    if (cause instanceof DraftConflictError) throw new StaleEditorDraftError();
    throw cause;
  }
  return readBackEditorDraft(repository, loaded.project.id, draft);
}
