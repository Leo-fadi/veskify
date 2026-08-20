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

## P10B-16P-06 search continuation and remaining gaps

P10B-16P-06 now supplies the standalone canonical query/results adapter used by the registered
search presentation. Its transient result page reaches this existing orientation/no-results
authority and the existing `dynamicCollectionCommerce` result renderer; it does not create another
utility profile or persist query, filters, sort, page, result IDs, or result count in storefront
design state. Missing, invalid, stale, or unresolved search authority continues to fail closed.

Production Vesko cart, checkout, search, authentication, and payment adapters remain P11
integration work. This Baseline claims no Vesko endpoint, AI/semantic/vector/fuzzy search,
recommendations, personalization, analytics, or operational cart/checkout behavior. Runtime
adapters still fail closed when they do not supply a matching state or executable action.

## Current P10B-17 continuation

P10B-17 makes cart, checkout-boundary, empty, loading, error, no-results, and not-found surfaces
consume responsive execution derived from the existing utility anatomy. Bounded controls use the
paired Design DNA focus treatment and localized accessible labels; loading, quantity, empty, and
error changes expose appropriate busy/live/alert semantics. Cart-line product media uses the shared
merchandising loading role, and responsive layout remains governed by the selected utility variant.

Runtime utility state remains read-only and non-persistent; no cart, checkout, search, product,
snapshot, renderer, or media authority was added or mutated. P10B-18 remains the customer-facing
utility-quality and scale gate, while operational commerce remains Vesko/P11-owned.

## P10B-18B-05 accepted quality Baseline

The existing single `commerceUtility` family now has purposeful DOM anatomy for populated, empty
and unavailable cart, checkout boundary, query/filter no-results, generic empty, recoverable error,
not-found and loading. Actions require both the matching transient runtime capability and executable
handler, with at most one visually dominant action. Loading remains a polite busy status; errors use
assertive alert semantics; unavailable/unrecoverable states fail closed. No checkout fields,
recommendations or operational cart/error engine were added. Persisted utility design survives the
canonical lifecycle while cart/query/error/loading payloads remain outside snapshots and history.
The product owner accepted this bounded utility-quality Baseline on 20 August 2026.
