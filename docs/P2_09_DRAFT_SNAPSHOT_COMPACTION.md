# P2-09 Draft Snapshot Compaction

## Specification baseline

This storage milestone implements the bounded draft-retention portion of SDD §§2–2.1, 6.5,
13.1–13.6, 15.1, 15.3, 15.7, 16.2, 16.4, 17.1, 17.4, 18.2, 19.2, 21 and 23. It supports
FR-041, FR-044, FR-048 and FR-050; AC-008, AC-010 and AC-011; and NFR-003 and NFR-006.

## Retention invariant

After every new draft save, a project retains the current draft, every immutable published snapshot
and history entry, every unknown or legacy snapshot whose provenance is not safe to remove, and the
newest repository-managed draft history needed to retain at least 20 total snapshots. Published or
unknown snapshots can therefore make the total exceed 20.

Only snapshots recorded by the repository as drafts created through new save or restore operations
are pruning candidates. The oldest eligible managed drafts are removed first, never below 20 total
snapshots and never while referenced by the project or protected as the source of the current
restore. Snapshot IDs and filename-like prefixes are never used as evidence that deletion is safe.

This makes all new normal saves bounded while preserving published history and unknown legacy data.
For the normal seeded project, 100 saves retain 20 snapshots: one current draft, one published
snapshot and the 18 newest superseded managed drafts. Publishing then adds a legitimate immutable
snapshot without deleting earlier published history.

## Atomic save sequence

Both repository adapters perform the same observable sequence:

1. Read the project and its current draft.
2. Check the optional expected draft identity.
3. Validate project ownership, catalogue ownership, the candidate snapshot and the complete proposed
   aggregate.
4. Stage the unique candidate draft and next `draftSnapshotId`.
5. Record the candidate as a repository-managed draft.
6. Select only the oldest unreferenced managed drafts required to bring the total down to 20.
7. Atomically write the candidate, update the project pointer and remove the selected managed drafts
   and their provenance records.

The in-memory adapter validates a staged map before replacing stored state. IndexedDB uses one
read-write transaction across projects, catalogues, snapshots and draft-provenance metadata and
explicitly aborts if a commit request fails. Validation and stale-base failures occur before
mutation.

## Restore behaviour

Restore clones the selected historical snapshot into a new uniquely identified current draft. The
historical source, all published snapshots and the current `publishedSnapshotId` remain unchanged.
The previous current draft becomes eligible for the same oldest-first managed-draft retention. A
request to restore the already-current draft is rejected before any write so repeated calls cannot
grow storage. Project revision is preserved because restore does not publish.

## Stale and failure behaviour

A stale expected base rejects before candidate insertion, pointer update or compaction. Invalid
snapshots, project or catalogue mismatches, reused history IDs, complete-aggregate validation
failures and IndexedDB transaction failures likewise leave the complete repository state unchanged.
The editor therefore retains retryable in-memory work under the P2-07 workflow.

After a successful write, the application rereads repository state and verifies that both the
current draft ID and its canonical value match the candidate committed by that call. A concurrent
save in this interval produces a stale result instead of replacing the editor baseline with another
client's content.

## Published-history and commerce protection

Draft saving and restore never delete the current published snapshot or any older snapshot not
proven to be the superseded current draft. Publishing after repeated saves continues to create a new
immutable published snapshot. Project revision and `publishedSnapshotId` remain unchanged during
draft save and restore. Catalogue data is not part of compaction, so product identity, SKU, price,
stock and catalogue media remain untouched.

## Existing IndexedDB data

All new saves use bounded rolling-draft retention backed by explicit repository provenance. P2-09
intentionally does not classify or delete orphan snapshots created before this policy, because the
legacy schema does not record enough provenance to prove they are obsolete drafts. A future storage
migration may compact legacy orphan data after explicit provenance is available.

## Deferred work

Publish-history UI, user-selectable history retention limits, legacy-orphan migration and
server-backed retention policies remain separate milestones.
