# P2-01 Visual Editor Shell

## Specification baseline

This milestone implements the first read-only Phase 2 editor shell from SDD §§2–2.1, 6.1–6.3, 6.5, 7, 9, 13–16.7, 18, 20–22 and ADR-001. It addresses FR-007, FR-013–FR-017, the Puck foundation for FR-021–FR-026, FR-040–FR-043, FR-046 and FR-049–FR-050; AC-007, AC-008, AC-013, AC-016 and AC-018–AC-020; and NFR-001, NFR-003, NFR-004, NFR-006, NFR-008 and NFR-009.

## Delivered scope

- `/projects/[projectId]/editor` loads the canonical project aggregate and draft through `ProjectRepository.get` without storage writes or bootstrap changes.
- Retailer-facing navigation shows the project, current page, supported homepage/collection/product switcher, English/Finnish controls, selected draft preview link and a draft-versus-published status.
- The existing Puck integration maps the selected canonical `PageModel` to disposable Puck `Data`, derives its configuration from the Veskify registry for that page type and renders the same registered storefront components.
- Canonical content, props, variant, visibility and approved style overrides remain available to the transient adapter. Protected product/catalogue values are not exposed as Puck fields.
- Puck mutation permissions and header actions are disabled. This PR does not save Puck state, persist a second page tree, publish, run AI, or expose arbitrary code fields.
- Merchant-readable loading, missing-project, missing-draft, validation and storage failure states preserve existing IndexedDB data.

## Deferred

Manual field changes, insertion, reordering, duplication, deletion, hide/show, draft commands, undo/redo, save confirmation, publishing, history, AI chat and agent operations remain later Phase 2+ work. Cart and checkout editor surfaces are also outside this focused milestone.
