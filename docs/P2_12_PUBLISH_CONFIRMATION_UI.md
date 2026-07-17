# P2-12 Explicit Publish Confirmation UI

## Specification baseline

This route implements SDD §§13.2–13.6, 17.1 and 17.4; FR-041, FR-045, FR-048 and FR-050;
AC-009 and AC-010; and NFR-004, NFR-006 and NFR-010.

## Route and merchant flow

`/projects/[projectId]/publish` loads the project and offers a separate **Review publish** action.
That action calls the public P2-11 `preparePublish` API without writing storage. The merchant sees
the saved-draft and current-published revisions, affected pages and a plain-language summary before
the distinct **Publish storefront** confirmation is available.

## Saved-draft-only rule

The route never reads editor session state, never autosaves and never publishes on load. Only the
last repository-persisted draft is reviewed or published. Changes still open in the editor are not
included until the merchant explicitly saves them there.

## Preparation and confirmation lifecycle

The UI keeps and passes the exact immutable preparation returned by `preparePublish` to
`confirmPublish`; it does not silently regenerate a preparation during confirmation. A no-change
preparation exposes no publish action. While confirmation is pending, both confirmation actions are
disabled to prevent duplicate publication.

## Stale recovery

Stale, invalid, conflict and missing-snapshot outcomes do not retry or publish automatically. The
route explains that the saved or published storefront changed and offers **Review latest draft**.
That explicit action creates a new read-only preparation. The prior current storefront remains
published until a later confirmation succeeds.

## Application/UI boundary

React components in `src/components/publishing/**` only present merchant-safe P2-11 summaries.
They do not compare snapshots, build expectations, validate publication or call repository methods.
`PublishClient` composes only `preparePublish` and `confirmPublish` with the repository boundary.
It never shows snapshot IDs, fingerprints, schemas or operation names.

## Published storefront and deferred work

The post-success link points to `/projects/[projectId]/published`, which renders the immutable
published snapshot through the existing read-only preview route. Editor navigation is deliberately
deferred until the parallel editor workflow PR is merged. History browsing and restore controls are
also deferred; this milestone adds no history UI or restore action.
