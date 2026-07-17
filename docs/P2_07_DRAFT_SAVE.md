# P2-07 Validated Draft Save

## Specification baseline

This milestone implements the explicit draft-save portion of SDD §§2–2.1, 4.1–4.4, 6.3, 6.5,
7.3–7.5, 13.1–13.6, 15.3–15.7, 16.2–16.6, 17.1, 17.4, 18, 19.2, 21 and 23, together
with ADR-002. It addresses FR-027–FR-028, FR-040–FR-047 and FR-050; AC-008–AC-011,
AC-013, AC-016 and AC-018; and NFR-003–NFR-004, NFR-006–NFR-009.

## Merchant workflow

The editor keeps validated manual changes and accepted proposal pages in canonical in-memory session
state. **Save draft** becomes available only when at least one page differs from the latest saved
baseline and the complete candidate draft is valid. Proposal generation and preview must finish
through acceptance or rejection first. Saving is explicit; there is no autosave.

On success, all changed session pages become the new saved baseline, the dirty state clears, and the
merchant stays on the same page and locale. Later edits form a new dirty session. Discard then
restores the most recently saved baseline. Refreshing the editor reads the saved draft through the
repository and retains both manual and accepted-proposal changes.

## Application and repository boundaries

`src/application/draft-save` owns complete-draft assembly, canonical validation, optimistic base
checks and save orchestration. It starts from the latest repository draft, replaces only changed
canonical `PageModel` values, and passes a complete `StorefrontSnapshot` to `ProjectRepository`.
The editor never persists Puck `Data` and never writes browser storage directly.

`ProjectRepository.saveDraft` accepts an optional expected draft identity (`id` and `revision`). The
in-memory and IndexedDB adapters compare it atomically with the current draft before writing. This
keeps repository compatibility for existing callers while giving the editor an atomic stale-write
guard.

## Complete-draft validation

Every changed page is validated against the registered component contracts and assembled snapshot
context. The complete candidate is then validated through `StorefrontSnapshot`, navigation,
cross-page section identity, catalogue references and component-registry validation. Untouched
pages, brand system, navigation, catalogue reference, project identity and unrelated snapshot data
are cloned from the latest stored draft.

Validation failure occurs before the repository write and leaves both stored and in-memory state
unchanged.

## Stale-write behaviour

The application compares the loaded canonical draft with the latest stored draft by snapshot ID,
revision and canonical value. The repository repeats the identity check atomically inside the save
transaction. Either mismatch produces a stale-draft result, preserves the newer stored draft, keeps
the merchant's in-memory work dirty and asks the merchant to reload.

## Save-state transitions

```text
No changes -> Save disabled
Unsaved valid changes -> Save enabled
Proposal generating or preview ready -> Save disabled
Save requested -> Saving, actions disabled
Validated repository write -> Saved successfully, new clean baseline
Validation failure -> Work retained, Save blocked until valid
Storage failure -> Work retained, retry available
Stale draft -> Work retained, reload guidance
```

Status, success and failure messages use accessible live regions. The normal editable Puck canvas
remains the canvas after save and is remounted from the saved canonical page.

## Published-state and commerce protection

Save draft changes only `draftSnapshotId` and the saved draft snapshot. It does not call publish,
replace `publishedSnapshotId`, create publish history, or change the current published snapshot.
Catalogue data is outside editor page mutation and remains unchanged, including product identity,
SKU, price, stock and catalogue media.

## Deferred work

Explicit Publish changes confirmation, published routes and publish history UI remain deferred.
Draft save does not add autosave, undo/redo, proposal revision, W3 skill planning, a real AI provider,
or cart/checkout operations.
