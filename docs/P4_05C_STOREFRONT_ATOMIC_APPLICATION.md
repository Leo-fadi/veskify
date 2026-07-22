# P4-05C — Whole-storefront atomic proposal application and composite history

This document records the application and history foundation for accepting a validated P4-05A
whole-storefront proposal. The authoritative product and architecture baseline remains
[`docs/VESKIFY_SDD.md`](VESKIFY_SDD.md); the synchronized human-readable export is
[`docs/archive/VESKIFY_SDD_v1.1.docx`](archive/VESKIFY_SDD_v1.1.docx).

## Transactional executor

`executeAiStorefrontProposal` receives the complete current active `StorefrontSnapshot`, catalogue,
EN/FI locale context, and one pending P4-05A proposal. It revalidates the ready envelope, project and
draft identity, active storefront projection, target and permission fingerprints, operation order,
target-bound grants, component contracts, protected fields, and complete projection preservation.

The executor clones the complete active snapshot and applies page and section operations
sequentially only to that isolated clone. Global colour operations and the proposal's explicit
`affectedDesignState` may update only colour and typography state under a declared
`storefrontDesignSystem` target and matching target-bound grants. The affected design state must
exactly describe the corresponding original/proposed design-system difference.

Every changed page is checked through the existing design-operation and component-registry rules.
The complete result then passes canonical snapshot, catalogue-reference, registered-component, and
storefront-wide section-identity validation. The executor also requires the executed result to equal
the validated proposed storefront projection exactly. It returns one complete detached snapshot
only after all checks pass. It never mutates its input or writes repository state.

## Final acceptance validation

Only a pending proposal with `validation.valid: true` and no validation errors may apply. Accepted
or rejected envelopes are terminal. Acceptance rejects stale or tampered project, draft snapshot,
revision, full storefront, affected page/section, design-system target, target fingerprint,
permission fingerprint, active storefront fingerprint, grant, operation, registry, protected-field,
page-set, page-order, navigation, or final-projection state before commit.

Page addition/removal, page-order mutation, navigation mutation, catalogue mutation, operational
commerce mutation, automatic save, publishing, and published-history mutation are unsupported.

## Composite storefront history

`CanonicalStorefrontHistory` is additive to the existing page-local `CanonicalEditorHistory`. One
accepted proposal creates one `CompositeStorefrontHistoryTransaction` containing:

- transaction/proposal identity and acceptance timestamp;
- project, draft snapshot, and revision context;
- ordered original and resulting affected pages;
- complete original and resulting BrandSystem state;
- unaffected-page identities and canonical fingerprints;
- original and resulting complete storefront-content fingerprints;
- the localized proposal summary.

Commit validates both the complete forward result and inverse restoration before changing history.
Undo restores every affected page and the original design system together. Redo restores every
accepted page and resulting design system together. A partial page-level undo or redo is not exposed.
Failed commit, undo, or redo leaves the current storefront and both stacks unchanged. Existing
single-page history APIs and behavior are unchanged.

## Acceptance coordinator and rollback

`StorefrontProposalAcceptanceCoordinator` owns one proposal session and composes the executor with
composite history; it is not another proposal store. Explicit Accept executes once, commits one
composite transaction, and transitions the proposal to `accepted`. Duplicate Accept cannot create a
second mutation or transaction. Reject and Close transition the proposal to terminal rejected state
without changing active draft or history. A stale proposal is closed and cannot later apply.

Any validation, operation, fingerprint, permission, registry, final-snapshot, or history failure
leaves the active draft canonically unchanged, creates no transaction, and returns localized
merchant-safe failure metadata. A non-stale application failure may remain retryable; stale and
terminal proposals cannot reactivate.

## Active, stored, and published separation

Acceptance changes only the coordinator's complete active in-memory draft. The stored draft,
published snapshot, published history, catalogue, and protected commerce content are retained as
detached unchanged values. Save draft remains the only persistence boundary. Publish remains a
separate saved-draft preparation and explicit confirmation workflow. Restore remains a separate
repository operation that creates a new saved draft without publishing.

## Compatibility and exclusions

P4-02 single-page acceptance, page-local undo/redo, P2-07 draft save, P2-11/P2-12 publishing, and
P2-14 history/restore contracts are unchanged. P4-05C adds no provider invocation, proposal
generation, prompt UI, target selector, React lifecycle, repository write, autosave, publish action,
real provider, onboarding behavior, or P4-05B implementation.

P4-05D remains responsible for connecting editor selection and merchant confirmation UI to this
application boundary, synchronizing composite history with the active editor session, and exposing
whole-storefront generating/retry/stale/undo/redo presentation states.

## Traceability

The implementation follows SDD §§6.3–6.5, 7.3–7.4, 12.7–12.9, 13.1–13.6, 15.3–15.5,
16.4, 17.1, and 21; ADR-002 §§2–4 and 7; FR-020, FR-026–FR-028, FR-040–FR-042,
FR-044–FR-050; NFR-006–NFR-009; and AC-006, AC-008–AC-012, and AC-016.
