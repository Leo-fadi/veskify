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
membership. The current catalogue model does not yet provide pagination or a first-class search
route; P10B-10 therefore does not claim either as a second authority. P10B-13 remains responsible
for governed utility-page and search-route closure.

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
