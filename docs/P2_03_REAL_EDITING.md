# P2-03 Real In-Memory Puck Editing

## Specification baseline

This milestone implements the in-memory portion of SDD §§2–2.1, 6.3, 6.5, 7, 9, 13–16.7, 18, 20–22 and ADR-001. It addresses FR-007, FR-013–FR-017, FR-021–FR-025, FR-030, FR-040–FR-043, FR-046, FR-048–FR-050; AC-007, AC-008, AC-013, AC-016 and AC-018–AC-020; and NFR-001–NFR-004, NFR-006, NFR-008 and NFR-009.

## Delivered scope

- Puck owns selection, approved field controls, insertion, drag reordering and optional-section deletion. Duplication remains disabled, and required header/footer definitions cannot be inserted or deleted.
- Every Puck `onChange` payload crosses the Veskify adapter and becomes a complete canonical `PageModel`. Registered component/page rules, schemas, variants, protected payloads and required global regions are validated before session state accepts it.
- Invalid changes remount Puck from the last valid canonical page and produce a retailer-readable alert.
- Product/catalogue identity, references, SKU, price, stock and media are absent from Puck fields. Unknown or tampered hidden properties are rejected.
- Each page has isolated in-memory session state. Dirty status compares canonical pages, page switches warn when the current page is dirty, and confirmed discard restores the originally loaded page.
- Locale changes edit only the active locale while keeping the draft brand variables and language inside the Puck iframe.
- The repository remains read-only. Neither IndexedDB, the stored draft nor the published snapshot is changed.

## PR #16 compatibility

Variant controls are derived from each registry definition's `variants`, and editor fields remain derived from registry metadata. This preserves the controlled design-vocabulary architecture from P2-02 without copying variant or token definitions into Puck.

## Deferred

Draft persistence, publishing, undo/redo history, hide/show, duplication, AI operations, cart/checkout editing and real commerce behavior remain deferred.
