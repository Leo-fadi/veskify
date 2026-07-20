# P4-QA-01 — Current-page AI loop regression and security hardening

## Scope and authoritative contracts

This regression pass verifies the existing P4-01 through P4-04 current-page design-agent loop. It does not introduce a new provider, proposal lifecycle, editor state model, or site-wide AI contract.

The tested behavior implements the controlled pipeline and draft-safety rules in `VESKIFY_SDD.md` sections 6.3–6.5, 7.1–7.4, 12.1–12.10, 13.1–13.2, 16.4, 17.1–17.5, 19.1–19.3, 20.1, and 21.1–21.2. The directly exercised requirements are FR-021–FR-028 and FR-040–FR-050, with NFR-006–NFR-009 and acceptance criteria AC-004, AC-006, AC-008, AC-016, and AC-018–AC-020. ADR-002 remains binding: providers return structured operations, validation precedes editor mutation, and accepted changes remain draft-only until explicit publication.

## Tested lifecycle

The regression suite follows one canonical path:

```text
merchant instruction
  -> current page or selected section target
  -> one provider invocation
  -> schema, permission, safety, locale and semantic validation
  -> one pending canonical proposal
  -> ready review without draft mutation
  -> Accept or Reject
  -> one undoable editor transaction after Accept
  -> Undo and Redo
  -> explicit Save draft
```

The application and route tests assert that proposal preview, rejection, cancellation, stale results, and provider failures do not mutate the active page or repository. Acceptance applies the validated multi-operation proposal once. Undo restores the exact pre-acceptance page, Redo restores the accepted page, and Save draft uses the existing canonical repository path. The immutable published snapshot is compared before and after the complete journey.

Clarification, revision, regeneration, cancellation, rejection, close, and restart all continue through `useDesignAgentSession`, `AiProposalGenerationOrchestrator`, and `AiProposalConfirmationOrchestrator`. Revision and regeneration receive new proposal identities; closing the previous pending proposal rejects it in the canonical proposal store, so it cannot later be accepted. No parallel React-only proposal lifecycle was added.

## Target and supersession matrix

| Change while work is active                       | Expected result                                             | Regression layer                        |
| ------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| Same selected section                             | No-op; ready proposal remains reviewable                    | Editor route integration                |
| Current page changes                              | Active work is closed or superseded; late result is ignored | Editor route integration and Playwright |
| Selected section changes                          | Active work is closed or superseded; late result is ignored | Editor route integration and Playwright |
| Locale changes                                    | Active work is closed or superseded; late result is ignored | Editor route integration and Playwright |
| Relevant page content changes                     | Work becomes stale; current canonical edit remains          | Generation and editor route integration |
| Target section is deleted, replaced, or reordered | Work becomes stale and cannot activate                      | Generation unit tests                   |
| Wrong page or section identity                    | Request or result is rejected before mutation               | Provider and generation unit tests      |
| Wrong project, snapshot, or revision identity     | Confirmation closes as stale before application             | Confirmation integration tests          |
| Older result arrives after a newer request        | Older result is superseded and cannot replace newer state   | Generation and editor route integration |

Whole-current-page and selected-section requests derive permissions from the existing design-skill registry. A registered component is still rejected when the request's permission grant does not authorize that component and target.

## Concurrency guarantees

- Canonically equivalent pending submissions share one provider request.
- The editor session also guards the local async wrapper, preventing two same-turn form activations from competing over the shared proposal.
- A newer request sequence supersedes older work; older completion cannot replace the newer state.
- Retry preserves the merchant instruction and rebuilds the command from current page, section, locale, revision, and permission context.
- One generation failure permits one Retry. Retry activation while pending is ignored, and a second failure requires a deliberate new submission.
- Cancelled, rejected, stale, and superseded proposals are terminal in the canonical proposal store and cannot reactivate.

## Provider security matrix

The provider boundary rejects these cases before proposal storage or draft application:

- JavaScript-shaped content, `javascript:` URLs, function syntax, and executable code shapes;
- CSS rules, style declarations, style elements, and fenced CSS;
- fenced JavaScript or HTML;
- raw HTML and unsupported markup;
- unknown, malformed, or disallowed operation types;
- unknown, disallowed, or registered-but-not-granted component types;
- sibling, foreign-page, and otherwise out-of-scope section changes;
- generated localized text for a disabled locale;
- attempts to address protected catalogue or commerce fields such as price, SKU, stock, inventory, or payment data;
- malformed provider envelopes and invalid validation metadata;
- stale project, page, section, snapshot, revision, target fingerprint, or permission fingerprint identities;
- provider unavailability and provider validation failure.

Failures retain the current draft and published snapshot, expose a controlled localized lifecycle state, and keep raw provider errors out of merchant-visible copy. Analytics contain event names, project/target identity, timing, operation counts, and validation state only; merchant instructions, imported content, provider payloads, and raw errors are excluded.

## English and Finnish behavior

The suite covers supported English and Finnish requests, localized clarification, Retry, unavailable, stale, validation-failure, Accept, Reject, and status copy. Localized proposal details use the active locale and the canonical primary-locale fallback. Browser and integration assertions ensure raw errors, prompts, JSON, and internal identifiers are not rendered to merchants.

## Browser coverage and test layering

Playwright covers keyboard submission, proposal review, Accept, Reject, Undo, Redo, duplicate activation, synchronous page/section/locale changes before an asynchronous result activates, explicit Save draft, published-state isolation, and horizontal overflow at 375, 768, 1024, and 1440 pixels.

The production browser route intentionally uses the local deterministic provider and has no network endpoint or failure switch. Provider-unavailable Retry and controllable out-of-order completion therefore remain browser-level integration tests with an injected `AIProvider`; adding a public browser fault-injection contract solely for Playwright would widen production architecture. Those tests exercise the real editor client and lifecycle while preserving deterministic provider timing and failure control.

## Deferred behavior

Whole-site and multi-page AI operations remain outside this current-page regression task. Their contract foundation belongs to P4-05A. Onboarding and O-09 generation-review behavior remain outside this task and are not modified. Publishing, history, restore, catalogue, and protected commerce models are unchanged.
