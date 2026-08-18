# P10B-09 — Commercial Homepage Profile Library

**Status:** Baseline

**Evidence date:** 9 August 2026

**Provider calls:** Zero

## Outcome and authority

P10B-09 extends the existing executable `PageBlueprint` profile authority with six registered
commercial homepage architectures. It does not add a template engine, page graph, component
registry, renderer, Design DNA system, frame system, product-card system, or art-direction model.

The preserved chain is:

```text
approved merchant evidence + canonical commerce
→ BrandSystem / Design DNA
→ registered executable homepage PageBlueprint profile
→ compatible root shared frame
→ registered P10B-07 families and P10B-08 product-card anatomy
→ bounded parameters, cardinality, and approved media
→ deterministic materialization and proposal compilation
→ StorefrontSnapshot
→ editor / preview / published renderer authority
```

`StorefrontSnapshot` remains the only canonical editable storefront aggregate. Header and footer
do not appear as homepage-owned slots; every profile narrows P10B-06 root shared-frame authority.

## Registered profiles

All profiles use version `1.0.0`. Profile structural identity is independent of merchant colour
and typography choices.

| Profile ID                        | Architecture and narrative                                                                                                                                                                        | Compatible frames; default                                             | Merchandising                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `homepage-editorial-storytelling` | Editorial split hero → optional approved brand story → curated products → optional lookbook → optional evidence-backed quote → continuation                                                       | `editorial-masthead`, `centered-minimal`; default `editorial-masthead` | P10B-08 `editorial`, 1/4/8 products                                   |
| `homepage-commerce-led-discovery` | Asymmetric commerce hero → collection discovery → dense product discovery → optional campaign → optional service proof → continuation                                                             | `commerce-utility`, `compact-technical`; default `commerce-utility`    | P10B-08 `compact`, 2/8/12 products and 1/4/8 collections              |
| `homepage-minimal-brand-commerce` | Restrained copy-first hero → focused products → optional concise service context → continuation                                                                                                   | `centered-minimal`, `editorial-masthead`; default `centered-minimal`   | P10B-08 `standard`, 1/2/4 products                                    |
| `homepage-campaign-led`           | Campaign-merchandising hero → required approved image-led campaign → campaign products → optional supporting story → optional evidence proof → continuation                                       | `editorial-masthead`, `commerce-utility`; default `editorial-masthead` | P10B-08 `imageFirst`, 1/4/8 products                                  |
| `homepage-collection-gateway`     | Media-led introduction → featured collections → collection-navigation gateway → category products → optional story/service reinforcement → continuation                                           | `commerce-utility`, `compact-technical`; default `compact-technical`   | P10B-08 `compact`, collection bounds 1/4/6 and 1/6/12; products 1/4/8 |
| `homepage-high-consideration`     | Editorial value proposition → required approved craft/process explanation → required evidence proof → optional service context → selected products → optional supporting editorial → continuation | `editorial-masthead`, `centered-minimal`; default `centered-minimal`   | P10B-08 `horizontal`, 1/2/4 products                                  |

Minimum, ideal, and maximum item cardinality is executable authority. Available canonical items are
selected in canonical order up to the registered maximum; undersized required commerce fails
closed. The planner never duplicates filler products, collections, or sections to reach an ideal.

## Compatibility, evidence, and failure behavior

Profile validation resolves exact current shared-frame profiles, current registered component
variants, meaningful P10B-07 anatomy, canonical P10B-08 anatomy, registered responsive
transformations, narrative-role compatibility, Design DNA narrowing, and structural fingerprints.
Unknown, stale, broadened, or incompatible authority fails before proposal compilation and before
snapshot mutation.

Optional brand story, campaign support, proof, service, and editorial slots omit deterministically
when their registered policy allows omission and approved evidence/media is absent. Required
campaign, process, proof, commerce, or media authority fails closed. Generated factual filler is
not permitted. Proof content is derived only from the current approved brief and carries its exact
evidence reference. Hero, story, campaign, and collection placements resolve only approved
P10B-04 assets. Canonical product media remains product-owned and is never replaced by editorial
media.

The focused sparse case omits three unsupported editorial slots without leaving empty sections.
The rich-catalogue case supplies 20 products and 10 collections and proves caps of eight featured
products, six featured collections, and ten available collection-navigation entries. The
commerce-led profile separately proves its required two-product minimum.

## Responsive architecture and structural diversity

Every profile declares exact responsive transformation IDs at 375, 768, 1024, and 1440 px. Those
IDs must exist in the selected P10B-03 component anatomy or P10B-08 product-card authority.
Examples include split-to-stack, media-first reorder, campaign reflow, process/proof condensation,
lookbook carousel, card simplification/reflow, and continuation condensation. CSS wrapping is not
the profile contract.

Two deterministic identities are retained:

- `structuralSignature` fingerprints ID-independent material architecture: narrative order,
  components/variants, required/optional posture, section and item cardinality, frame compatibility,
  merchandising/card posture, responsive transformations, and Design DNA narrowing;
- `structuralFingerprint` binds that material to the exact profile ID and version.

Exact structural duplicates fail. Pairwise bounded comparison requires at least three differing
material dimensions across the six-profile library. Colour and font choices do not contribute to
profile uniqueness. The current library has six unique signatures and six unique fingerprints.
This is the bounded P10B-09 duplicate guard, not the future P10B-16 storefront diversity engine.

## Lifecycle, renderer, and migration evidence

All six profiles are queryable from the existing executable profile registry and are selectable by
the existing deterministic whole-storefront planner. Tests prove each profile through
materialization, plan, proposal, exact PageBlueprint-slot compilation, `StorefrontSnapshot`,
save/reload, preview, deterministic publication compilation, and published output. Repeated
same-family homepage slots bind to their exact materialized PageBlueprint slot rather than an
occurrence-order guess.

Editor, preview, and published targets use the same registered component renderer exports. All
homepage merchandising is `homepageFeaturedProducts` rendered through the canonical
`homepageMerchandising` P10B-08 context; no legacy local product-card renderer is selected.
Protected catalogue and media projections are byte-for-byte unchanged across profile selection.

Commercial profiles are additive. Existing P10A/P10B snapshots and legacy executable homepage
profiles remain schema-valid and loadable without automatic content rewrite. A legacy snapshot is
not silently assigned a commercial profile. Selection of a commercial profile is an explicit new
generation decision; current content, commerce bindings, and approved assets are preserved where
compatible.

## Browser and visual evidence

The dedicated evidence route `/p10b-09-homepage-proof` orchestrates the existing planner,
proposal compiler, runtime snapshot projection, render context, shared frame, and canonical
storefront page renderer. It is not a second renderer. The route exposes review correlation for
profile ID/version, profile structural fingerprint, exact PageBlueprint materialization
fingerprint, Design DNA fingerprint, shared-frame identity, component/anatomy fingerprint,
product-card anatomy, and canonical snapshot fingerprint.

The dedicated Playwright suite retains 24 macOS Chromium screenshot baselines under
`tests/e2e/p10b-09-commercial-homepage-profile-library.spec.ts-snapshots/`: all six profiles at 375,
768, 1024, and 1440 px. It also asserts zero horizontal clipping, visible hero and canonical
merchandising authority, root-frame identity, and zero OpenAI requests. The final evidence run is
25/25 passing, including the cross-profile diversity assertion.

Interactive visual inspection covered all 24 retained images for hierarchy, rhythm, imagery,
merchandising, CTA clarity, frame/DNA coherence, mobile comprehension, clipping, and overlap. It
found and corrected two upstream presentation defects: tablet brand-editorial footer word breaks
and small-width trust-card grid specificity. The corrected images have no observed blocker and
show six materially different first impressions. This task-level visual record uses the existing
evidence vocabulary and correlation authority; it does not claim the complete 160-scenario
P10A-07B human protocol or the P10B-18 retained full-store commercial-quality gate.

## Remaining gaps and non-goals

P10B remains Partial. P10B-10 through P10B-18 remain Planned. This task does not implement
collection/search profiles, PDP profiles, content/support or utility pages, the complete-store
vertical slice, synthesis, coordinated directions/diversity control, final responsive/a11y/
performance closure, or the commercial quality/scale gate. It adds no merchant editor/P10C,
Vesko, generated-media, provider, save, or publication operation.

## Current P10B-17 continuation

P10B-17 leaves all six PageBlueprint profiles and narrative sequences intact while passing the
selected anatomy's centrally derived breakpoint execution into every hero, campaign, editorial,
proof, trust, and merchandising section. Registered transformations now own stacking, ordering,
contained overlays, bounded media height, horizontal overflow behavior, and reduced-motion
fallbacks. Primary first-impression media and downstream merchandising also use their distinct
shared image-loading roles and responsive `sizes` authority.

No homepage profile, section family, registry, snapshot, commerce binding, or approved-asset
authority changed. P10B-18 still owns repeated human review of complete-homepage commercial
quality and diversity.

## Accepted P10B-18B-02 continuation

P10B-18B-02 refines the six existing version `1.0.0` profile records without introducing another
profile system or changing their IDs. Each slot now declares an explicit transition intent so the
planner and renderer can distinguish narrative continuation, editorial contrast, merchandising
acceleration, proof reinforcement and closing progression. Story/catalogue balance is a truthful
compound semantic driver of exact homepage-profile material; the raw narrative posture remains
metadata rather than a falsely independent renderer axis.

The accepted profiles now omit weak or unsupported duplication: editorial storytelling no longer
promises a one-asset lookbook, campaign-led requires approved campaign media, high-consideration
places selected products before service context, commerce-led omits a weak optional campaign, and
collection-gateway avoids redundant editorial reinforcement while targeting three featured
collections. The renderer gives rich and sparse paths deliberate rhythm, keeps canonical product
cards and protected commerce/media unchanged, and collapses unavailable asset regions rather than
leaving placeholders or reserved whitespace.

Against the unchanged nine-by-eight audit strata, accepted P10B-18B-02 raises normalized material
topologies from 36 to 38, reduces repeated memberships from 57/72 to 55/72, keeps the largest
cluster at seven and raises singletons from 15 to 17. Fourteen retained captures cover rich/sparse
outcomes and same-direction Premium, Modern and Warm profile contrasts at 375/1024/1440 where
applicable. This is bounded homepage/editorial/campaign acceptance only; P10B-18B-03 owns the next
collection/search/product-card quality upgrade and P10B-18C remains the final designer-grade/100+
gate.
