# P2-13 — Canonical editor history and section actions

## Alignment

This slice implements the canonical editor behaviour required by SDD §§6.3, 7.2–7.4, 13.1–13.3,
15.4, 16.4 and 21; FR-023, FR-026, FR-027, FR-042, FR-046 and FR-047; and AC-006.
It preserves ADR-001's Puck boundary and ADR-002's separation between draft and published state.

## Public application API

`src/application/editor-history` is React-independent and operates only on canonical `PageModel`
values:

- `CanonicalEditorHistory` keeps one current canonical page per page ID and bounded past/future
  command transactions. It commits, undoes, redoes, resets to a supplied saved page and rebases
  after a successful draft save.
- `deriveCanonicalCommandTransaction` deterministically compares validated previous and next pages.
  It emits page-metadata patches, section insert/remove/replace, section reorder and visibility
  commands with an explicitly recorded inverse command list and one merchant-facing action label.
- `applyCanonicalCommands` applies a command list to a clone and validates the complete result before
  returning it.
- `createDuplicateSectionTransaction` and `createSectionVisibilityTransaction` build direct
  canonical transactions for the selected-section controls.
- `duplicateCanonicalSection` clones a safe selected section immediately after its source with a
  deterministic, project-unique section ID.
- `setCanonicalSectionVisibility` hides or shows a safe selected section without changing its
  identity, component or fields.
- `canDuplicateSection` and `canToggleSectionVisibility` expose the required header/footer guards
  to merchant controls.

History retains at most 50 command transactions per page by default; past and future entries never
store complete pages. Transaction and command payloads are cloned. A new transaction is accepted
only after its forward commands produce a valid complete page and its inverse commands restore the
exact prior page. Failed commit, Undo or Redo application leaves both the current page and stacks
unchanged. A divergent commit clears redo history.

## Editor behaviour

- Every valid manual Puck handoff is deterministically converted into one command transaction, even
  when content, metadata and section order change together.
- An accepted design-agent proposal is one entry regardless of its operation count. Preview,
  rejection and cancellation add no entry.
- Undo and redo are page-local and never write storage or published state. Their buttons and
  `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z` and `Ctrl+Y` shortcuts are disabled while proposal activity locks
  mutations; shortcuts ignore text fields, selects and editable content.
- Duplicate and hide/show use direct transactions for the actual selected Puck section. A visible
  header or footer cannot be hidden or duplicated, while a legacy-hidden required section can still
  be shown and included in Undo/Redo. Hidden sections keep an editor-only selectable placeholder.
- Page changes clear a selection that is no longer present. History navigation closes any stale
  design-agent workflow before showing the canonical historical page.
- Discard supplies the latest saved page as the reset target and clears that page's command stacks.
  It also invalidates an open proposal based on discarded edits.
- Save rebases the latest saved page without discarding earlier history. Undo after Save therefore
  creates new unsaved work; it does not reverse the repository write.

## Boundaries and deferred work

No operation schema, executor, storage repository, publishing service, design skill, commerce model
or storefront renderer is changed. History is deliberately session-only: it does not survive an
editor refresh. Broader section actions and cross-session history remain deferred.
