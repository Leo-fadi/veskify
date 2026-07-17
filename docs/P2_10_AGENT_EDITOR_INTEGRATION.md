# P2-10 design-agent editor integration

This milestone connects the existing deterministic design-agent orchestration to the merchant editor
described by SDD §§4.2, 5.2, 6.3–6.5, 7.3–7.4, 12, 13, 16.4, 18.1, and 21. It covers
FR-022, FR-027–028, FR-039–044, and FR-050; AC-004, AC-008, AC-013, AC-016–018, and AC-020.

## React integration boundary

The editor route remains responsible for presentation and in-memory active-page state only.
`use-design-agent-session.ts` adapts React events to the public P2-08 orchestrator API, while
`design-agent-panel.tsx` renders retailer-facing request, clarification, status, proposal, revision,
and decision controls. Neither file classifies requests, builds plans, executes skills, validates
proposals, compares stale bases, or implements a second proposal lifecycle.

The integration imports no Puck types. The existing Puck adapter continues to own canvas mechanics;
the route supplies a validated canonical proposal page to that adapter in read-only mode.

## Orchestrator ownership

One retained `createDeterministicDesignAgent()` instance belongs to each loaded editor-project
lifecycle. It is not recreated during normal React rendering or locale switching. Project changes,
explicit editor reloads, and unmount safely cancel an open process-local session before releasing the
instance.

The hook uses these public actions without duplicating their rules:

- `startSession` and `submitRequest`;
- `inspectSession` for the retained canonical session record;
- `answerClarification`;
- `reviseProposal` and `regenerateProposal`;
- `acceptProposal`, `rejectProposal`, and `cancelSession`;
- `restartSession`.

## UI state mapping

The panel represents idle, classifying, needs-clarification, planning, generating, proposal-ready,
revising, accepted, rejected, cancelled, and failed states. Current deterministic actions complete
quickly, so the React adapter yields one event-loop turn to expose classifying, generating, and
revising states without adding artificial latency. The panel and editor use `aria-busy`; status and
error changes use accessible live regions.

## Clarification

When the orchestrator returns `needsClarification`, the panel preserves the request and page context,
shows exactly one localized question, focuses the answer field, and offers Continue and Cancel.
No proposal page is rendered until `answerClarification` returns a validated proposal. English and
Finnish questions and answers use the session locale.

## Proposal preview, revision, and regeneration

A ready proposal replaces only the canvas input with the proposal's validated canonical page. The
active editor page in `sessionPages` remains unchanged, normal Puck editing is locked, and the card
shows the localized summary, affected page/section count, and assumptions without raw operations,
schemas, skill IDs, or JSON.

Revision and regeneration call the orchestrator against the current canonical active page. The old
preview remains visible until a replacement validates. Regeneration retains the original request and
clarification context and receives a new lifecycle identity from P2-08. A failed replacement leaves
the current editor page and last valid proposal safe.

## Accept to unsaved draft

Accept and apply calls `acceptProposal(sessionId, currentPage)`. Only an `accepted` result with a
returned validated canonical page may update `sessionPages`. The route remounts Puck from that page
and the existing dirty-state calculation enables Save draft. Acceptance performs no repository
write, does not invoke the P2-07 save command, and cannot publish.

Reject and cancel close the preview through the orchestrator and leave `sessionPages` unchanged.
Start over uses `restartSession` and returns the visible panel to a clean request state.

## Stale-session handling and page isolation

Accept, revision, and regeneration rely on the orchestrator's canonical stale-base result. When a
validated page mutation makes an active workflow obsolete, the adapter asks the orchestrator to
evaluate that changed page, cancels the obsolete pending proposal, preserves the merchant's newer
editor work, and shows localized guidance to start a new request. It does not maintain a second
React-side page fingerprint.

Page switching safely cancels the one visible workflow, so a proposal cannot appear on another
page. Accepted unsaved pages remain isolated in the existing `sessionPages` map. Locale switching
changes presentation context only and does not close a valid proposal.

## Save draft separation

The existing P2-07 contract remains unchanged:

- Save draft is disabled while classifying, clarifying, generating, revising, or previewing;
- active save disables agent controls and canvas mutations;
- acceptance creates an ordinary unsaved page change;
- only the merchant's later Save draft action persists the complete validated draft;
- save failure retains accepted in-memory work;
- discard restores the latest saved page baseline;
- published snapshot identity and content remain unchanged.

## Accessibility

All fields and actions have accessible names and native keyboard behavior. Clarification focuses its
answer field, and a ready proposal focuses its heading so keyboard and screen-reader users are moved
to the new decision surface. Preview-only state is announced in both the canvas label and proposal
card. Disabled controls are guarded in both markup and handlers.

## Deferred work

- A real provider remains behind the existing P2-08 provider boundary.
- Process-local conversations are not persisted.
- Persistent multi-page conversation history is deferred; only one current-page workflow is visible.
- Direct selected-section context will be passed when the existing Puck integration exposes a stable
  public selection callback; this milestone does not add a competing selection model.
- Save, IndexedDB behavior, explicit publishing, history, and storefront renderers remain separate
  application milestones.
