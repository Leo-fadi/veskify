# P10A-08D-01 — Published Route Render-Target Closure

## Evidence and boundary

Published route correctness has two independent requirements:

- snapshot selection chooses the immutable snapshot identified by
  `project.publishedSnapshotId`; and
- render target supplies the renderer with the explicit `"published"` mode.

Selecting a published snapshot is not sufficient to establish the renderer mode. The canonical
`createStorefrontRenderContext` defaults to `"preview"` when no target is supplied. P10A-08D-01
therefore keeps snapshot selection in the existing `SnapshotKind` contract and adds the smallest
typed route/client render-target prop. Published collection and product wrappers pass
`renderTarget="published"`; omitted callers derive the compatible target once from their snapshot
kind, while an explicit target remains independent.

## Corrected route behaviour

The homepage already passed its published render target and remains unchanged. The collection and
PDP clients now resolve one effective route target and propagate it to every canonical
render-context creation, including initial validation and the rendered route context, and to the
nested collection or PDP commerce renderer. No context or nested commerce target is inferred from
a snapshot ID, and no snapshot-selection, publishing receipt, gateway authority, compiler,
rollback, provider, or publication behaviour changes.

Focused deterministic integration coverage independently asserts homepage, collection and PDP
snapshot identity and render target; it also proves preview collection/PDP contexts remain preview,
published wrappers do not allow a nested client to fall back to the default, and canonical
collection/product bindings are unchanged. The injected repositories are read-only in these tests:
there are zero provider calls and zero external publications.

## Deferred closure

P10A-08C gateway/compiler closure remains the dependency for production gateway and compiler
evidence. Rollback evidence and full end-to-end published-route evidence remain deferred. This
task does not claim an external publication, compiler artifact, gateway authority change, or
rollback implementation.
