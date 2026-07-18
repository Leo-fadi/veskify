# P3-11 — Atomic project aggregate creation

## Ownership and outcome

`src/services/storage` owns persistence of complete canonical `ProjectAggregate` values. P3-11 adds
`ProjectRepository.create(aggregate)`, allowing a later project-creation workflow to persist a
validated project, catalogue, snapshots and optional history metadata in one operation. Project
construction, onboarding, generation and editor navigation remain application/UI boundaries; this
repository method does not construct an aggregate or publish it.

## Validation and conflicts

Creation clones and validates the complete aggregate through the shared repository-validation
boundary before any adapter state changes. Validation covers the project and catalogue schemas,
registered snapshot composition, unique snapshot IDs, project/catalogue references, draft and
published pointers, and metadata that must resolve to snapshots in the same project.

The adapters expose the same typed identity conflicts:

- `ProjectAlreadyExistsError` (`PROJECT_ALREADY_EXISTS`)
- `CatalogueAlreadyExistsError` (`CATALOGUE_ALREADY_EXISTS`)
- `SnapshotAlreadyExistsError` (`SNAPSHOT_ALREADY_EXISTS`)

Existing identities cannot be overwritten, even when the content is identical. Every conflict and
validation failure leaves the existing project count, catalogue records, snapshots and metadata
unchanged.

Snapshot identity is repository-global for the complete lifecycle, not only during creation. All
later draft-save, publish, restore and synchronized-draft writes enforce the same namespace. The
repository-generated IDs for new snapshots are project-scoped (`snapshot_<projectId>_<reason>_<revision>_<sequence>`;
a deterministic hashed compact form is used only when the 80-character ID limit requires it), while
existing persisted IDs are read as-is and are never migrated or renamed. Injected generators are
still checked globally and a collision fails with `SnapshotAlreadyExistsError`; the repository never
silently overwrites, retries or invents a replacement identity.

## Adapter atomicity

The in-memory adapter performs all validation and global identity checks before installing frozen
internal values in its project map. It returns a detached clone, so later mutations of either the
input or returned aggregate cannot alter repository state.

The IndexedDB adapter uses one read/write transaction over `projects`, `catalogues`, `snapshots`,
`snapshotProvenance` and `snapshotHistoryMetadata`. It checks every identity in that transaction,
performs no puts before those checks succeed, awaits transaction completion, and aborts on failure.
No database version or store schema change is required.

## Snapshot provenance and bootstrap

Creation preserves supplied valid history metadata and does not invent publish or restore events.
Only the aggregate's current draft receives `managedDraft` provenance, so later bounded compaction
can identify drafts created by repository operations without classifying the inserted published
snapshot as a managed draft. Existing IndexedDB bootstrap and migration rules remain unchanged:
creating another project after Aurum Nordic succeeds, reopening does not reseed, and the seed is
never overwritten by creation.

## Specification traceability

This boundary implements SDD §13.5, §15.7, §16.2, §17.1 and §17.4. It supports FR-001, FR-009,
FR-041, FR-044, FR-045 and FR-050; NFR-006; and AC-001, AC-008, AC-010, AC-011 and AC-025. The
operation persists an already complete aggregate only; onboarding, project factories, P3-08
materialization, P3-10 orchestration, editor routes, publishing UI and live Vesko integration are
deferred to their respective milestones.
