# P2-08 deterministic design-agent orchestration

This React-independent slice completes the controlled request-to-proposal lifecycle described by
SDD §§2, 4.2, 6.3–6.5, 7.3–7.4, 12.1–12.10, 13.1, 15.1, 15.4, 15.6, 16.2–16.4, 17.1–17.2,
18, 21, and Addendum A. It covers FR-014–016, FR-022, FR-027–028, FR-031, FR-039–042, FR-050,
NFR-006, NFR-008–009, and the non-UI portions of AC-004, AC-012, AC-016, and AC-017.

The implementation is isolated under `src/application/design-agent`. It coordinates the existing
classifier, planner, skills, operation executor, canonical page validator, deterministic provider,
and `InMemoryDesignProposalStore`. It does not import React, Puck, repository adapters, IndexedDB,
draft-save commands, publishing, or storefront renderers.

## Public API

`@/application/design-agent` exports:

- `designAgentSessionSchema`, `designAgentSessionStateSchema`, and controlled failure schemas;
- `InMemoryDesignAgentSessionStore` for cloned in-memory session values and guarded transitions;
- `DeterministicDesignAgent` and `createDeterministicDesignAgent`;
- instance methods `startSession`, `submitRequest`, `answerClarification`, `inspectSession`,
  `inspectProposal`, `listActiveSessions`, `reviseProposal`, `acceptProposal`, `rejectProposal`,
  `cancelSession`, and `restartSession`;
- `classifyRevisionInstruction`, `designAgentRevisionKindSchema`, and the bounded plan-constraint
  helpers used by revision.

Each agent instance owns or receives one session store and one retained deterministic proposal
provider. Callers may inject the existing proposal store or provider for application composition and
testing. Separate agent instances do not share state.

## Session state machine

```text
idle
  -> classifying
     -> needsClarification -> classifying
     -> planning -> generating -> proposalReady
     -> failed

proposalReady
  -> revising -> proposalReady
  -> accepted
  -> rejected
  -> cancelled
  -> idle (explicit restart)

accepted | rejected | cancelled | failed
  -> idle (explicit restart)
```

The store rejects every transition not listed by the state table. Sessions include the canonical
original page, current and initial requests, selection, classification, plan, proposal reference,
revision count, assumptions, clarification, bilingual merchant status, failure information, and
timestamps. Stored and returned values are cloned. Sessions only reference proposals; they do not
duplicate proposal state.

## Clarification rules

The deterministic flow asks exactly one concise question only when the missing answer changes the
safe result:

- `Make it better.` / `Tee siitä parempi.` asks whether the merchant wants a more luxurious look or
  a more minimal layout. The answer must resolve to an approved request; unsupported answers remain
  controlled unsupported results.
- `Add a campaign section.` / `Lisää kampanjaosio.` asks what the campaign should highlight only
  when neither supplied campaign direction nor existing collection context can safely provide it.
  The answer becomes presentation-only campaign context.

Clarification preserves EN/FI locale. The orchestrator does not invent discounts, dates, prices,
delivery promises, legal statements, certifications, or commercial claims.

## Revision rules

Supported deterministic revision instructions are:

| English                        | Finnish                   | Constraint                                                              |
| ------------------------------ | ------------------------- | ----------------------------------------------------------------------- |
| Keep the hero unchanged.       | Pidä hero ennallaan.      | Exclude `improveHero` from the rebuilt plan.                            |
| Make it more minimal.          | Tee siitä pelkistetympi.  | Replan using the approved minimal request.                              |
| Do not add a campaign section. | Älä lisää kampanjaosiota. | Exclude `addCampaignSection`; a valid no-change proposal is allowed.    |
| Start over.                    | Aloita alusta.            | Reject the pending proposal and reset the session to the original page. |

Every successful revision starts from `session.originalPage`, never the previous proposed page. A
session-and-revision identity is supplied to the existing proposal store so simultaneous same-page
sessions and successive revisions receive distinct proposal IDs without changing the proposal
model. After a replacement validates, the previous pending proposal is rejected. If replacement
validation fails, the previous proposal remains pending and inspectable, and the session returns to
`proposalReady` with controlled failure information. Accepted or rejected sessions require explicit
restart before revision.

## Stale-base behaviour

Accept and revision first parse and validate the supplied current canonical page, then compare it
with the session's original proposal base. A mismatch returns a controlled stale result, preserves
the active page, and leaves the pending proposal unconsumed. The merchant is instructed to start a
new request. Active-locale switching is external context and is not part of the canonical page
fingerprint, so locale-only UI changes do not make a session stale.

## Proposal lifecycle reuse

- Successful generation creates a pending proposal through the retained deterministic provider and
  existing `InMemoryDesignProposalStore`.
- Accept revalidates through that store and returns the accepted canonical page without persisting it.
- Reject and cancel close only the referenced pending proposal and return the original page.
- Restart closes a pending proposal when necessary and resets session workflow fields.
- Invalid plans and executions create no proposal.

The optional proposal identity added for orchestration is used only in deterministic ID generation.
It does not add fields to `DesignProposal`, change operation schemas, or create a second lifecycle.

## Safety boundaries

All proposal pages and operations still pass the existing skill permissions, operation schemas,
protected-field guards, component registry, and canonical page validation. The orchestration layer:

- cannot modify price, SKU, product identity, stock, catalogue media, payments, shipping, tax,
  orders, inventory, or operational checkout behavior;
- cannot introduce unknown components, unsupported variants, arbitrary markup, CSS, scripts, or
  executable code;
- never mutates supplied pages, brand data, catalogue/display context, stored draft, or published
  state;
- has no repository, IndexedDB, editor, Puck, renderer, save, or publish dependency.

## Deferred integration

- React chat, progress, clarification, and proposal controls remain W2/editor work.
- Applying an accepted canonical page to the active editor draft remains a separate application/UI
  integration step.
- Session persistence is deferred; the P2-08 store is intentionally process-local.
- A real AI provider remains deferred behind the existing provider boundary.
- Save draft and explicit publishing remain separate workflows.
