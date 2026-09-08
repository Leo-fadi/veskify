# AR-03A approach

## Decision

Extract the existing route error tuple, type, and class into `route-errors.ts` unchanged.
Extract the complete matching closure into `route-selection.ts`: bounded-range matching,
highest-priority uniqueness, product and collection selectors, public product and collection
resolution helpers, and collection match context. `authority.ts` remains the compatible public
facade: it imports and re-exports the same error class and public resolution functions, retains
`productTypeMappings`, and directly imports only the internal product selector. The public barrel
remains unchanged; the product selector remains internal to the selection module and the collection
selector remains private.

## Authority and consumer

This extends the existing dynamic-commerce route authority over the canonical
`StorefrontSnapshot` and read-only commerce projection. Current consumers are the public
dynamic-commerce-route facade, `productTypeMappings`, runtime product and collection matching,
the publishing compiler's shared error `instanceof` check, and the existing composite editor and
migration paths.

## Rejected shortcut and failure behaviour

Do not duplicate or wrap the error class, make selection depend on authority or its barrel, expose
the internal selector publicly, move `productTypeMappings`, or change known-type gating, inclusive
ranges, tie handling, and unknown-type fallback. Invalid presentation, zero-match,
highest-priority-tie, stale, and invalid-route failures retain the existing class identity, name,
code, message, cause, and failure semantics; no failed resolution mutates canonical input.

## Conflicts

None identified. AR-03A remains a bounded extraction: resolver, editor projection/application,
migration, and expand/rematerialize/fold orchestration stay in their current authority. The task
does not complete AR-03 or authorize a successor.
