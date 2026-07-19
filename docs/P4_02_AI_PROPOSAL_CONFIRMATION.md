# P4-02 — AI proposal confirmation, acceptance and rejection

P4-02 consumes the ready-for-review envelope produced by the canonical P4-03
`AiProposalGenerationOrchestrator` and the existing `DesignProposal` lifecycle. P4-03 and
P4-02 share one `InMemoryDesignProposalStore`; this layer does not introduce another
provider, planner, operation model, permission model, page model or React-only proposal
store.

## Merchant flow

A validated proposal is rendered as a read-only canvas preview and an EN/FI
confirmation card before draft mutation. The card presents the requested outcome,
affected page and scope, operation count, grouped merchant-readable changes,
assumptions, warnings and diagnostics. It never renders raw operations, provider
prompts, schemas, stack traces or protected commerce content.

The P4-03 handoff preserves project, draft snapshot/revision, page, section, editor target,
provider request, canonical target fingerprint and target-bound permission grants without
flattening or reconstructing them in React. A canonical permission fingerprint rejects any
changed handoff grant set before review. The confirmation lifecycle includes `ready`,
`accepting`, `accepted`, `rejected`, retryable `failed`, `stale` and `closed`. Selecting
Accept checks the P4-03 identity and fingerprint again, then replays every structured
operation through the existing design-operation and registry guards before one canonical
editor-history transaction is committed. Repeated activation cannot apply the proposal
twice. Rejection leaves the active draft and published snapshot unchanged.

If validation or draft application fails, the pending proposal remains available for a
safe retry or explicit rejection. No accepted state is recorded and no partial editor
history is created. A proposal whose P4-03 project, draft revision, editor target or
canonical target fingerprint no longer matches the active editor is closed as stale and
must be regenerated from the current storefront. Superseded, failed or unavailable
generation results contain no acceptable proposal and are never rendered as ready.

## Boundaries and traceability

- The active draft changes only after explicit acceptance; Save draft and Publish
  changes remain separate actions (SDD §§4.2, 6.5, 7.3–7.4 and ADR-002 §3.5).
- Acceptance reuses `applyDesignOperations`, registered-component validation,
  protected-field guards and `CanonicalEditorHistory` (FR-026, FR-028, FR-042,
  AC-004, AC-006 and AC-016).
- Provider, validation and application failures preserve the usable draft and expose
  localized retry guidance without executable AI output (NFR-006, NFR-007 and
  NFR-009).
- Proposal controls are semantic, keyboard operable, live states are announced and
  the card is checked at 375, 768, 1024 and 1440 pixels (AC-018 and AC-019).
- `ai_proposal_generated`, `ai_proposal_accepted` and `ai_proposal_rejected` use the
  schema-limited analytics boundary from SDD §19.1. Event payloads contain project,
  route, target and timestamp only; merchant prompts, imported content and provider
  secrets are rejected.

The authoritative product contract remains `docs/VESKIFY_SDD.md`; this document records
the focused P4-02 implementation and does not replace the SDD or ADR-002.
