# P4-05D — Editor integration for section, page, and entire-storefront AI proposals

Status: implemented on `codex/p4-05d-editor-storefront-integration`.

The authoritative product and architecture contract remains [VESKIFY_SDD.md](./VESKIFY_SDD.md). This note records the P4-05D editor adapter and does not replace or broaden that contract.

## Scope and traceability

P4-05D implements the editor-facing portion of SDD §§5.2, 6.3–6.5, 7.1–7.4, 12.1–12.10, 13.1–13.6, 15.3–15.5, 16.4, and 17.1–17.2. It traces to FR-020–FR-022, FR-026–FR-028, FR-040–FR-042, and FR-044–FR-050; NFR-004 and NFR-006–NFR-010; and AC-004, AC-006, AC-008–AC-012, and AC-016–AC-020.

ADR-002 remains binding: canonical storefront state, proposal validation, permission grants, fingerprints, acceptance, and history are owned by Veskify application/domain services rather than React or Puck.

## Target selector

The design-assistant panel exposes three localized targets:

- Selected section / Valittu osio;
- Current page / Nykyinen sivu;
- Entire storefront / Koko verkkokauppa.

Selected section is disabled until the canvas reports an eligible canonical selection. The existing automatic selected-section behavior remains until the merchant explicitly chooses a target. Choosing the already-active target is a no-op. A real target change supersedes target-bound clarification, generation, review, and retry state without mutating the draft.

The panel shows merchant page and section names only. Internal IDs, fingerprints, permission grants, operation codes, provider payloads, and raw errors are not rendered.

## Shared lifecycle and generation

One editor session façade presents the section, page, and storefront lifecycle. Section/page commands continue through the P4-03 generation orchestrator and P4-02 confirmation path. Entire-storefront commands pass the complete active storefront to the P4-05B request builder and orchestrator.

P4-05B remains authoritative for planner-resolved pages and sections, the optional design-system target, permission grants, request sequencing, provider validation, and target/permission/baseline fingerprints. The deterministic storefront provider is the local default; an injected provider can only enter through the existing provider interface.

Clarification, generating, ready, revising, retryable failure, failed, stale, superseded, accepted, rejected, and closed presentation states use the same panel and session boundary. Late results are discarded after target, locale, or canonical storefront changes. Retry is explicit and limited to controlled retryable failures.

## Review UI

Section and page proposals retain the P4-04 grouped merchant review. Entire-storefront review is projected from the validated canonical proposal and contains:

- affected page and operation totals;
- explicit shared colour and typography changes;
- one collapsible merchant-named group per affected page;
- grouped section changes;
- warnings and blockers.

Accept is disabled unless every operation, affected page, and shared design change is represented and no blocker exists. Review accordion expansion and focus are presentation state and do not stale the proposal.

## Accept, Reject, Revise, Retry, and Cancel

Section/page Accept continues through P4-02. Entire-storefront Accept delegates directly to the P4-05C `StorefrontProposalAcceptanceCoordinator`, which revalidates the proposal against the complete active draft before mutation. React does not replay operations or infer authorization.

Reject and Cancel close the active proposal without draft or history mutation. Revise and Regenerate create newer canonical requests; they do not edit a proposal in place. Cancelled or superseded provider results cannot become ready later. Provider failures preserve the editor session and expose only merchant-safe copy.

## Atomic history and draft separation

One accepted entire-storefront proposal produces one P4-05C composite history transaction. Editor Undo and Redo delegate to that transaction, restoring all affected pages and the complete original/resulting design system together. Page-level history remains available for ordinary page edits; the editor does not simulate storefront undo with multiple page operations.

Accept changes only the active editor draft. It does not write browser storage and does not publish. Save draft remains explicit and now assembles the accepted validated brand system together with changed pages. Publishing remains a separate review and confirmation workflow. Reject, Cancel, failed validation, and stale proposals leave active, stored, and published state unchanged.

## Stale and concurrency behavior

Storefront generation and acceptance remain bound to project, draft identity/revision, enabled and active locales, ordered pages, navigation, complete page content, and relevant design-system state through the P4-05A/B fingerprints. Canonical page edits, global design changes, locale changes, and real target changes make active work stale or superseded. Page browsing during an entire-storefront review and review accordion/focus changes do not alter canonical state.

Duplicate submission and duplicate Accept are blocked by the existing orchestrators and UI controls. Starting newer work prevents older asynchronous results from replacing the active session.

## Accessibility and responsiveness

Targets are native radio controls with localized labels and semantic disabled state. Status changes use the existing live region; failures and blockers use alert semantics. Ready review headings receive focus, retry receives focus when available, and review actions remain keyboard operable. The panel and collapsible page groups use min-width and wrapping rules intended for 375, 768, 1024, and 1440 pixel layouts.

## Explicit exclusions

P4-05D does not change provider key handling, server authority, structured provider output, fingerprint definitions, component registry contracts, publishing/restore behavior, onboarding, O-09, catalogue truth, protected commerce fields, or the P4-05A/B/C proposal and atomicity models.
