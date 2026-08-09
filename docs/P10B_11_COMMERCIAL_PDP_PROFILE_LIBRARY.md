# P10B-11 — Commercial PDP Profile Library

**Status:** Baseline

**Date:** 9 August 2026

**Authority:** `BrandSystem / Design DNA → PageBlueprint → component anatomy / meaningful variant → bounded validated instance authority`

## Outcome

P10B-11 adds four materially different, versioned PDP PageBlueprint profiles without creating a
second PDP page tree, a product-specific component fork, an alternate option resolver, or another
product-media authority:

- `pdp-standard-commerce` — balanced gallery, identity/price, options, purchase, supporting and
  related-product hierarchy;
- `pdp-high-consideration` — approved detail, specification, proof/service context and a separated
  purchase panel, with factual support omitted unless current approved evidence is present;
- `pdp-gallery-led` — P10B-04 canonical media-led gallery hierarchy while title, price, generic
  options, availability and purchase action remain accessible;
- `pdp-variant-led` — generic multi-option configuration and purchase controls become primary,
  retaining selected configuration, price, availability and media resolution.

Each profile selects the canonical `dynamicProductDetail` runtime and one meaningful commercial
anatomy variant. The existing `editorial` variant remains only as a compatibility alias; P10B-11
uses `balanced`, `editorialSplit`, `galleryDominant`, and `compact` as structural authorities.

## Protected commerce and media

The profiles bind canonical product identity, variants, option groups/values/dependencies, SKU,
resolved price and compare-at price, availability, canonical media and canonical related products.
They do not copy or mutate those facts. The generic option architecture serves both a simple product
and a configurable product; it retains incomplete required selections, unavailable combinations,
resolved configuration, price, availability and selected media.

P10B-04 remains the only responsive product-media authority. Profile choices may use its approved
gallery composition, crop, focal behavior, ratio and responsive treatment; they cannot replace a
canonical product-media identity or lineage. Related merchandising delegates exclusively to the
P10B-08 canonical product-card renderer in the `relatedProducts` context.

High-consideration supporting/proof/service copy requires a current approved factual evidence
reference. Missing evidence omits that optional content; materials, certificates, warranties,
sizing, delivery, review and technical claims are never invented.

## Structure, compatibility and responsive behavior

Profile structural signatures include the dynamic PDP variant, gallery/purchase/information
arrangement, P10B-08 card anatomy, evidence posture, P10B-06 frame compatibility, responsive
transformations and narrowing-only Design DNA selections. Identity-bound fingerprints prevent exact
and shallow duplicate profiles. Stale signatures, unsupported transformations, incompatible shared
frames and Design DNA broadening fail closed.

All profiles declare concrete architecture at 375, 768, 1024 and 1440 px. The first two widths
apply a registered stack, reflow, gallery-containment or configuration-focus transformation; desktop
and wide retain the profile’s deliberate desktop hierarchy. The retained browser suite covers four
profiles × four widths and checks the canonical runtime, option groups, shared frame, geometry and
zero provider requests.

## Lifecycle reachability

`createWholeStorefrontGenerationPlan` accepts a registered PDP profile ID and materializes it through
the existing product `PageBlueprint`. The plan replaces the legacy product gallery/info/options
sections with one canonical `dynamicProductDetail` instance. Proposal compilation, runtime snapshot
materialization, save/reload, preview/published rendering and publication preserve the selected
variant and bounded profile props.

When a snapshot-level P10B-06 shared frame is already authoritative, normal homepage planning no
longer reintroduces page-local header/footer sections. This preserves the single frame authority for
PDP profile lifecycle work as well as the surrounding storefront.

## Evidence

`tests/unit/p10b-11-commercial-pdp-profile-library.test.ts` covers:

1. four registered profile identities and distinct structural fingerprints;
2. executable PageBlueprint and meaningful dynamic PDP anatomy materialization;
3. simple-product compatibility for every profile;
4. configurable variants/options, canonical price, availability, media and P10B-08 related cards;
5. stale, duplicate and shared-frame-incompatible selections;
6. high-consideration approved-evidence grounding and omission;
7. save/reload and publication preservation;
8. all four registered responsive width entries.

The existing dynamic PDP, P10B-03 anatomy, P10B-04 responsive-media, P10B-08 product-card,
PageBlueprint and P10A lifecycle suites remain the deeper regressions for generic option state,
dependency/unavailable behavior, exact media lineage, publication and protected truth.

`tests/e2e/p10b-11-commercial-pdp-profile-library.spec.ts` retains sixteen browser captures over
the same four widths. It asserts each profile’s structural fingerprint, canonical renderer,
configuration controls, shared frame, no horizontal clipping and zero provider traffic.

## Scope retained

P10B remains **Partial / active**. P10B-10 and P10B-12 through P10B-18 remain Planned. P10B-11 does
not implement collection/search profiles, content/support pages, commerce utility pages, Storefront
Studio editing, real-provider work, a product-type-specific renderer, a new product model or any
commercial facts outside approved evidence and canonical commerce.
