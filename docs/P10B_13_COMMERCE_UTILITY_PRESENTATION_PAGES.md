# P10B-13 — Commerce Utility Presentation Pages

**Status:** Baseline

**Date:** 9 August 2026
**Provider calls:** Zero

## Outcome

P10B-13 supplies six versioned registered PageBlueprint profiles for cart, checkout boundary,
search no-results, generic empty, recoverable error, and 404 presentation. Each profile
materializes one canonical `commerceUtility` component into the existing P10B-05 page-family page;
it selects a compatible current P10B-06 shared frame, carries an exact fingerprint, and has
explicit 375/768/1024/1440 responsive authority. The registered loading runtime state renders on
the current cart, checkout, or state route while its adapter data is pending; it never replaces the
404 route or persists a loading page. This does not add a utility registry, cart model, checkout
engine, page graph, or persistence aggregate.

## Commerce boundary and actions

The utility renderer receives a transient read-only runtime projection from a commerce adapter. A
cart line binds only a canonical product ID and adapter-supplied canonical unit/line/total price;
the renderer resolves title and canonical product media from the existing catalogue projection and
does not calculate, discount, tax, ship, or invent availability. Cart contents, checkout sessions,
filters, queries, and operational state are never written to `StorefrontSnapshot`.

Rendered buttons appear only when the runtime projection both declares a capability and supplies
the corresponding adapter intent handler. The bounded mapping is quantity change, line removal,
checkout continuation, continue shopping, clear search, clear filters, return home, and retry.
Unsupported actions are absent. Checkout remains a factual boundary/continuation to existing
commerce authority; it has no local address, payment, shipping, tax, or order workflow.

## State semantics

- Cart distinguishes populated and empty canonical cart state without auto-filled merchandising.
- A cart with no matching current runtime state renders an explicit unavailable state; a loading
  runtime renders on the current route rather than silently returning an empty page or claiming
  `/404`.
- P10B-10 no-results retains the exact query and active filter labels, renders no products, and
  exposes only supported clear/recovery actions.
- Generic empty, recoverable error, 404, and route-local loading are distinct registered states.
  Error copy exposes no stack trace, provider material, or internal identifiers; 404 never
  fabricates content or silently redirects.

## Lifecycle and evidence

```text
registered utility profile → P10B-05 PageBlueprint/page family → utility presentation section
→ StorefrontSnapshot configuration → save/reload and deterministic publication compilation
→ shared editor/preview/published renderer
```

Only the profile/section configuration crosses this lifecycle. Current commerce/runtime state is
deliberately excluded. Focused tests prove registration, deterministic fingerprints, canonical
state rendering, action gating, state distinction, shared-frame/Design DNA consumption, and
non-persistence. Chromium evidence retains cart, no-results, error, and 404 at 375, 768, 1024,
and 1440 px plus cart action dispatch. P10B-13 does not claim P10B-17 accessibility/performance
closure or P10B-18 commercial scale acceptance.

## Remaining gaps

Production Vesko cart, checkout, search, authentication, and payment adapters remain P11
integration work. This delivery defines only the bounded presentation seam and will fail closed
when a current runtime adapter does not supply a matching state or executable action.
