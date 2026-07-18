# P2-14 Published History and Restore-to-Draft UI

## Specification baseline

This milestone implements SDD §§13.1–13.6, 16.4–16.5 and 17.1/17.4; FR-041, FR-045, FR-048 and
FR-050; and AC-010–AC-011. It builds on P2-09 bounded snapshot retention, P2-11 atomic publish
preparation and P2-12 explicit publish confirmation.

## History and preview

`/projects/[projectId]/history` lists every retained canonical snapshot newest first. The publish
page and its success state provide a normal in-product **Version history** entry point. History
labels only facts proven by project pointers and repository-managed metadata: the current published
storefront, current saved draft, published content, a publish-synchronized draft, a restored draft,
or a safe **Previous version** fallback. Dates, page counts and the stored author role are shown
without exposing snapshot IDs, revisions, storage provenance or schemas.

Historical homepage, collection and product routes are pinned to the selected snapshot ID. Their
links remain under `/projects/[projectId]/history/[snapshotId]`, so a previous-version preview can
never fall through to current draft or published content.

## Restore boundary

`src/application/history` is React-independent. `listProjectHistory` and
`readHistoricalSnapshot` validate canonical aggregates before returning values. `prepareRestore`
returns a frozen exact preparation containing project, current draft, selected target and published
expectations. `confirmRestore` rechecks them, uses the repository's atomic restore expectation and
then verifies the committed new draft.

Restore clones the selected snapshot into a new draft identity. It preserves the published pointer,
published snapshot, project revision and catalogue. Snapshot compaction also protects both the
selected historical source and the saved draft that was current immediately before restore, even
when published history already exceeds the retention threshold. The merchant can therefore reverse
the restore by restoring that prior saved draft. Restore never autosaves or publishes. A stale or
duplicate confirmation performs no additional restore.

## History metadata and legacy compatibility

New publish and restore transactions atomically persist typed, localized reason and concise summary
metadata beside their snapshots. IndexedDB schema version 3 adds this metadata as a separate,
project-indexed store; upgrading an existing database leaves older snapshots untouched and readable.
Where durable reason metadata is unavailable, the UI uses **Previous version** and **Details
unavailable for this older version.** (with equivalent Finnish copy) rather than inventing a
merchant action. P2-09's unknown legacy snapshot retention rules remain unchanged.
