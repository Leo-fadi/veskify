# P10B-10 — Commercial Collection and Search Profiles

**Status:** Baseline

**Evidence date:** 9 August 2026

**Provider calls:** Zero

## Outcome and authority

P10B-10 adds four versioned commercial collection/search profiles to the existing executable
`PageBlueprint` authority. It does not add a collection model, search model, filter engine,
membership store, product-card renderer, page graph, asset authority, or publishing path.

The preserved chain is:

```text
approved merchant evidence + read-only canonical catalogue
→ P10B-02 Design DNA
→ registered collection/search PageBlueprint profile
→ compatible P10B-06 shared frame
→ P10B-03 dynamicCollectionCommerce anatomy
→ P10B-08 canonical product-card anatomy
→ P10B-04 approved presentation/media treatment
→ deterministic plan, proposal compiler, and StorefrontSnapshot
→ canonical collection route renderer in editor / preview / published targets
```

`StorefrontSnapshot` remains the only editable storefront aggregate. The small search presentation
input used by the renderer is transient, read-only route context: it carries only a query, exact
canonical result IDs, and the collection revision. It is not persisted as a second search state.

## Registered profiles

Every profile is version `1.0.0`, has a unique structural signature and fingerprint, narrows the
registered Design DNA, selects a compatible P10B-06 shared frame, and materializes one existing
`dynamicCollectionCommerce` PageBlueprint slot.

| Profile ID                          | Material structure                                                                    | Frame and card authority                   | Responsive treatment                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `collection-editorial-discovery`    | Collection context and related-collection discovery before editorial product browsing | `editorial-masthead`; P10B-08 `editorial`  | Editorial collection stack, filter disclosure, card stack         |
| `collection-catalogue-comparison`   | Collection context, comparison-first merchandising, then related collections          | `compact-technical`; P10B-08 `comparison`  | Comparison filter disclosure, grid reflow, compact simplification |
| `collection-campaign-led-discovery` | Required approved campaign lead, collection context, discovery, then commerce         | `editorial-masthead`; P10B-08 `imageFirst` | Campaign lead stack, filter disclosure, image-first reorder       |
| `collection-dense-search`           | Efficient result-led dense merchandising and related-collection continuation          | `commerce-utility`; P10B-08 `dense`        | Dense filter disclosure, grid reflow, compact simplification      |

Profile validation rejects duplicate IDs/signatures/fingerprints, stale structure fingerprints,
missing registered responsive transformations, non-meaningful collection anatomy, incompatible
frame, card anatomy, or Design DNA, and pairs that differ in fewer than three material dimensions.
Colour, typography, spacing, and other finishing values cannot make a profile distinct.

All four profiles are permitted on canonical collection pages. Only catalogue comparison and dense
search are permitted for the `search-results` page family because their `compact` card anatomy is
registered for the transient `searchResults` context. Editorial discovery and campaign-led
discovery remain collection-only; their editorial and image-first card anatomies intentionally
fail closed for search results.

## Commerce, media, and search protection

The existing catalogue route adapter constructs the existing projection and bindings. The renderer
requires its `productList` binding to exactly equal canonical collection membership and order; it
reads price, compare-at price, stock-derived availability, product title, and product media only
from the canonical projection. Every product is rendered by the P10B-08 `CanonicalProductCard` in
the `collectionResults` or transient `searchResults` context. A profile may alter presentation,
never catalogue ownership or facts.

Filters, selection state, and sort options remain canonical projection data and emit typed intent
only. Where the projection supplies child collections, their binding must exactly equal the
canonical child-collection IDs and order. The profile never invents, drops, reorders, or stores
membership. P10B-10 itself did not provide pagination or a first-class search adapter and did not
claim either as a second authority. P10B-13 remains responsible for governed search
orientation/no-results presentation; P10B-16P-06 now supplies the separate transient query/results
runtime authority.

The campaign-led profile requires an approved editorial collection asset before planning. The
existing P10B-04 art-direction metadata, provenance, crop/focal treatment, and approved placement
are revalidated at adapter and renderer boundaries. Canonical product media remains product-owned;
the campaign asset is an approved collection/editorial presentation alongside it, not a
replacement.

For a zero-result search context, the renderer verifies the exact canonical revision and empty
result IDs, keeps the merchant query visible, emits no product cards, and offers only canonical
collection navigation. It does not fabricate products, suggestions, counts, or claims.

## Lifecycle, compilation, and rendering evidence

The existing deterministic planner selects a profile only as an explicit generation option. Its
materialization authority is preserved in the plan, proposal compiler, runtime snapshot, and
compiler replay validation. Existing draft save/reload and deterministic publication compilation
retain the exact collection section component, variant, card anatomy, approved asset presentation,
and shared-frame ownership. P10B-10 changes no publishing gateway, accepted-snapshot receipt,
publication contract, active-version behavior, or rollback authority.

The proof route `/p10b-10-collection-search-proof` composes the existing planner, proposal
compiler, runtime snapshot, catalogue route adapter, shared frame, and collection renderer. It is
not a second compiler or collection renderer. It exposes profile, materialization, Design DNA,
frame, card, and snapshot correlation data for browser review.

## Responsive and visual evidence

The dedicated Chromium suite covers all four profiles at 375, 768, 1024, and 1440 px through the
canonical route renderer. It asserts profile-specific material hierarchy, P10B-06 frame identity,
P10B-08 card anatomy, campaign approved-media use, zero horizontal clipping, zero OpenAI requests,
and cross-profile structural distinction. Attached screenshots are retained in the Playwright
evidence report; no golden baseline was changed.

Manual review must still be repeated when canonical catalogue data, approved campaign media,
frames, card anatomies, or breakpoint CSS changes. It should verify information hierarchy,
filter discoverability, card scanability, touch targets, campaign media crop/focal behavior,
empty-result comprehension, keyboard access, and no clipping/overlap at each required width.
This task does not claim P10B-17 responsive/accessibility/performance closure or P10B-18 commercial
quality/scale acceptance.

## Evidence and non-goals

Focused deterministic coverage proves profile registration/fingerprint guards, required campaign
evidence, canonical membership/order/facts/product-media preservation, child collection ordering,
active filters, zero-result search behavior, all three renderer targets, save/reload, and
deterministic publication compilation. Existing `dynamicCollectionCommerce` coverage continues to
exercise filter, sorting, child-binding, media, and accessibility fail-closed behavior.

P10B-10 does not implement P10B-11 PDP profiles, P10B-12 content/support families, P10B-13
search/cart/checkout routes or operational search, P10B-14 complete-store proof, P10C editor
controls, provider calls, commerce writes, new schemas, generated media, or a second
collection/search/card/membership/filter engine.

## Current P10B-16P-01 convergence

The four P10B-10 profiles remain the registered collection/search design authority. P10B-16P-01
stores them once as maintained root archetypes and maps concrete collection/search routes to them;
it no longer copies their composite presentation into one editable `PageModel` per collection.
Exact collection membership, ordering, filters, search context, product cards, and media remain
runtime-bound canonical commerce. See
[`P10B_16P_01_DYNAMIC_COMMERCE_ROUTE_ARCHETYPES.md`](P10B_16P_01_DYNAMIC_COMMERCE_ROUTE_ARCHETYPES.md).
The `/search` route inventory entry and maintained archetype do not themselves own operational
search. Exact transient query/result authority remains required at materialization; missing,
invalid, stale, or unresolved authority fails closed and never treats a collection as search
results.

## Current P10B-16P-06 runtime continuation

P10B-16P-06 makes the selected P10B-10 search presentation executable without changing this profile
authority. One provider-neutral read-only port and standalone `CatalogueDisplayModel` adapter
validate the current query, supported filter/sort/page state, locale, catalogue fingerprint, and
public product-route authority, then return unique exact product IDs in deterministic ranked order.
The existing `dynamicCollectionCommerce`, P10B-08 product-card, shared-frame, Design DNA, and
P10B-13-governed orientation/no-results states consume that transient result page across draft,
proposal, saved/history, and published routes.

Only the `/search` route identity and selected presentation archetype persist. Query text, filters,
sort, page, result IDs, and result count remain runtime-only and are absent from `PageModel`,
`StorefrontSnapshot`, history, compiled design decisions, and publication records as editable
authority. This standalone Baseline does not claim a Vesko search endpoint, AI/semantic/vector/fuzzy
search, typo correction, recommendations, personalization, analytics, or any commerce/media write.

## Current P10B-17 continuation

P10B-17 derives collection/search responsive execution from the selected registered anatomy and
applies its filter disclosure, layout reflow, product-grid, child-collection, and density behavior
at the declared breakpoints. Search/result headings and loading/no-result counts use semantic live
state, while collection results use a deterministic 24-product presentation window with bounded
previous/next controls. Each window retains the full canonical product count and fingerprint;
search result identity remains the P10B-16P-06 transient query/result authority.

The four profiles, renderer, canonical card family, membership/order, snapshot, commerce, and media
authorities remain singular and unchanged. The presentation window is not persisted and cannot
write catalogue truth. P10B-18 retains broad catalogue visual quality, representative density, and
scale acceptance.

## Accepted P10B-18B-03 continuation

P10B-18B-03 keeps all four profile IDs, the canonical `PageBlueprint`, one dynamic renderer, one
product-card family, one catalogue and the P10B-16P-06 transient search adapter. Their accepted
purposes are now explicit:

| Profile                             | Context and accepted material purpose                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `collection-editorial-discovery`    | Collection-only curated identity and discovery; editorial cards and proportionate disclosed filters, including deliberate one/few-product composition. |
| `collection-catalogue-comparison`   | Collection or search comparison; standard fact-forward cards, `standardCondense` and useful stronger filters only for sufficient result complexity.    |
| `collection-campaign-led-discovery` | Collection-only approved campaign focal art, proposition and product continuation; image-first cards and fail-closed asset requirement.                |
| `collection-dense-search`           | Compact collection or explicit query/results scanning; horizontal cards, `denseReflow` and space-efficient filters/sort.                               |

The renderer derives presentation-only result cardinality as `micro` (1), `small` (2–4), `medium`
(5–12) or `dense` (13+). It never persists the class or changes product membership/order. Facets
with no decision value are suppressed unless selected, sort is omitted for zero/one results, active
filters remain operable, and persistent comparison/dense filters require medium/dense complexity.
Child collection identity/order remains canonical and renders as compact continuation distinct from
product cards.

Catalogue comparison and dense search are both executable for transient search results. Search
renders its exact query, result count and active sort/filter state without synthetic collection
identity or campaign language. Zero results render no cards or fake suggestions; one/few results use
bounded geometry; many results preserve the existing bounded result window.

The compact provider-facing capability now reports `canonical-transient-query-results`,
`read-only-bounded` behavior and the `p10b-16p-06-canonical-search-adapter` reason. It expressly does
not claim AI, semantic, vector, fuzzy, personalized or Vesko search, and the provider schema is
unchanged.

Accepted same-strata evidence records collection editorial 35 / dense 27 / comparison 9 / campaign
1, search dense 63 / comparison 9, 39 normalized topologies, 53/72 repeated memberships and a
largest cluster of seven. Twenty-one retained captures cover all four profiles, all five card
anatomies, three directions, four widths and zero/one/multiple search states with unchanged
protected commerce/media. This bounded acceptance does not redesign PDP/content/utility surfaces or
complete P10B-18C.
