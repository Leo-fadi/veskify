# P2-11 Validated Publish Preparation and Atomic Publish Core

## Specification baseline

This milestone implements the application and repository core for SDD §§2–2.1, 4.1–4.4, 6.5,
13.1–13.6, 15.1–15.7, 16.2–16.4, 17.1/17.4, 18–21 and 23. It addresses FR-041,
FR-045, FR-048 and FR-050; AC-009–AC-011; and NFR-003, NFR-006 and NFR-008.

## Prepare and confirm separation

Publishing is a two-step application workflow. `preparePublish` reads and validates the complete
canonical aggregate, compares the saved draft with the current published snapshot and returns a
frozen preparation plus a deterministic merchant-safe change summary. It performs no repository
write. Dropping the preparation is cancellation and leaves the project byte-for-byte unchanged.

`confirmPublish` accepts that exact preparation. It never prepares again silently. Confirmation
rereads the aggregate and rejects the request if the project revision, draft, published base or
canonical storefront content changed after preparation.

## Public API

`src/application/publishing` exports:

- `preparePublish(projectId, repository, options?)`
- `confirmPublish(preparation, repository)`
- `createPublishChangeSummary(published, draft)`
- `publishPreparationSchema`
- `publishChangeSummarySchema`
- preparation, summary and confirmation result types
- controlled invalid-preparation, validation, no-change, stale and confirmation error types

The boundary is React-independent and has no editor, Puck, design-agent or renderer dependency.

## Preparation contract

A preparation contains its ID and timestamp, project ID, expected project revision, expected draft
and published identities, deterministic canonical-content fingerprints, the structured change
summary and `publishPermitted`. A content-identical saved draft returns a valid preparation with
`publishPermitted: false`; confirmation rejects it without calling the repository.

Preparation objects are parsed through a strict Zod schema and recursively frozen. Test-only clock
and preparation-ID factories keep fixtures deterministic without changing production behavior.

## Canonical comparison

Storefront comparison includes brand system, navigation, ordered pages and sections, page content,
section content/properties/variants/visibility and the catalogue reference. Snapshot identity fields
`id`, `projectId`, `revision`, `createdAt` and `createdBy` are excluded. Object keys are sorted before
comparison, while array order remains meaningful. The same canonical helper is used by preparation,
confirmation and both repository adapters.

## Change-summary rules

The summary reports localized EN/FI page titles without inventing missing translations. It lists
added and removed pages and sections, page and section order changes, page metadata and theme
overrides, section component/content/property/variant/visibility changes, changed brand-token paths,
changed navigation areas, and total changed-page and changed-section counts.

Only safe identifiers, localized page titles, component/variant names, visibility values and changed
field names are included. Raw snapshot JSON, catalogue records, price, SKU, stock and catalogue media
are not included.

## Atomic repository contract

`ProjectRepository.publish` accepts one typed expectation containing the expected project revision,
draft identity and fingerprint, and published identity and fingerprint. Both adapters apply this
sequence atomically:

1. Read and validate the current project aggregate, saved draft and published snapshot.
2. Verify project revision, both snapshot identities and both canonical-content fingerprints.
3. Reject a content-identical draft without writing.
4. Create a unique immutable published snapshot at project revision + 1.
5. Create a distinct synchronized draft from the same storefront content and revision.
6. Point `publishedSnapshotId` and `draftSnapshotId` to the new snapshots and update the project once.
7. Register only the new synchronized draft as new managed-draft provenance.
8. Apply P2-09 oldest-first compaction only to proven superseded managed drafts, never below 20.
9. Validate the complete staged aggregate.
10. Commit both snapshots, project, provenance and removals as one transaction and return the exact
    canonical committed aggregate.

The in-memory adapter commits a fully validated staged aggregate. IndexedDB uses one read-write
transaction across projects, catalogues, snapshots and provenance and aborts on any failed request.

## Synchronized post-publish draft

After success, the new published snapshot and saved draft have distinct IDs, share the new project
revision and have canonically equal storefront content. The synchronized draft is the clean saved
baseline. The prior published snapshot remains immutable and retrievable. Catalogue and protected
commerce values remain unchanged.

Starting from the normal seed, one save plus one publish leaves five snapshots below the retention
threshold: the current and previous published snapshots, the synchronized current draft and two
superseded managed drafts. Repeated publishing retains every published snapshot. Once published
history itself requires more than 20 snapshots, the total legitimately exceeds 20.

## Stale confirmation and failure atomicity

A later draft save, another publish, same-identity content rewrite, revision change or published-base
change makes the preparation stale. Confirmation returns `StalePublishPreparationError`, creates no
publish snapshots and does not consume the newer saved draft. A fresh preparation may then publish.

Invalid snapshots, identity reuse, project/catalogue mismatch, no-change publication, validation
failure, IndexedDB request failure and transaction abort leave the previous project, saved draft,
published snapshot and history unchanged.

## Published-history protection

Published snapshots never receive managed-draft provenance. Compaction considers only snapshots
explicitly created as managed drafts. Every previous published snapshot therefore remains immutable
and restorable into a new draft, and unknown legacy snapshots remain protected under P2-09.

## Deferred work

Publishing confirmation UI, the published route UI, persistent reason/summary history records,
history browsing UI and history-retention controls remain separate milestones. P2-11 provides no
editor action, autosave, silent publication or server publishing integration.
