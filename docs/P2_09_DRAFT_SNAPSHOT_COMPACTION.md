# P2-09 Draft Snapshot Compaction

## Specification baseline

This storage milestone implements the bounded draft-retention portion of SDD §§2–2.1, 6.5,
13.1–13.6, 15.1, 15.3, 15.7, 16.2, 16.4, 17.1, 17.4, 18.2, 19.2, 21 and 23. It supports
FR-041, FR-044, FR-048 and FR-050; AC-008, AC-010 and AC-011; and NFR-003 and NFR-006.

## Retention invariant

After every new draft save, a project retains exactly one snapshot referenced as the current draft,
every immutable published snapshot and history entry, and any other snapshot whose provenance is not
safe to remove. The repository removes only the known superseded `draftSnapshotId` when that exact
snapshot is no longer referenced by the next project state. Snapshot IDs and filename-like prefixes
are never used as evidence that deletion is safe.

This makes all new normal saves bounded while preserving published history and unknown legacy data.

## Atomic save sequence

Both repository adapters perform the same observable sequence:

1. Read the project and its current draft.
2. Check the optional expected draft identity.
3. Validate project ownership, catalogue ownership, the candidate snapshot and the complete proposed
   aggregate.
4. Stage the unique candidate draft and next `draftSnapshotId`.
5. Determine whether the known superseded current draft is unreferenced in the next project state.
6. Atomically write the candidate, update the project pointer and remove only that safe superseded
   draft.

The in-memory adapter validates a staged map before replacing stored state. IndexedDB uses one
read-write transaction across projects, catalogues and snapshots and explicitly aborts if a commit
request fails. Validation and stale-base failures occur before mutation.

## Restore behaviour

Restore clones the selected historical snapshot into a new uniquely identified current draft. The
historical source, all published snapshots and the current `publishedSnapshotId` remain unchanged.
The previously current draft is removed only when it is neither the restore source nor referenced by
the next project state. Project revision is preserved because restore does not publish.

## Stale and failure behaviour

A stale expected base rejects before candidate insertion, pointer update or compaction. Invalid
snapshots, project or catalogue mismatches, reused history IDs, complete-aggregate validation
failures and IndexedDB transaction failures likewise leave the complete repository state unchanged.
The editor therefore retains retryable in-memory work under the P2-07 workflow.

## Published-history and commerce protection

Draft saving and restore never delete the current published snapshot or any older snapshot not
proven to be the superseded current draft. Publishing after repeated saves continues to create a new
immutable published snapshot. Project revision and `publishedSnapshotId` remain unchanged during
draft save and restore. Catalogue data is not part of compaction, so product identity, SKU, price,
stock and catalogue media remain untouched.

## Existing IndexedDB data

All new saves use bounded rolling-draft retention. P2-09 intentionally does not scan for or delete
orphan snapshots created before this policy, because the current schema does not record enough
provenance to prove they are obsolete drafts. A future storage migration may compact legacy orphan
data after explicit snapshot provenance is available.

## Deferred work

Publish-history UI, user-selectable history retention limits, legacy-orphan migration and
server-backed retention policies remain separate milestones.
