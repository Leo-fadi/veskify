# P10B-03 — Component Anatomy and Meaningful Variant Contract

**Status:** **Baseline**

**Phase status:** P10B — Commercial Storefront Generation System v1 is **Partial / active**.

**Date:** 8 August 2026

**Depends on:** P10B-01 commercial design grammar and compatibility vocabulary.

**Binding architecture:**
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md)

## 1. Outcome

P10B-03 adds one typed commercial anatomy contract to `ComponentDefinitionV2` and projects that
contract through the existing generated component capability authority. A later P10B consumer can
require an exact registered anatomy identity/version, compatible page family, narrative role,
approved asset role, and structurally meaningful variant without consulting a second registry.

The contract prevents a class, colour, padding, radius, or other finishing-only change from being
claimed as a meaningful structural variant. A meaningful claim must declare and realize a material
difference against the component's registered default structure.

This task does not deliver the later commercial renderer/profile minimums: four shared frames, six
heroes, five product-card anatomies, expanded homepage profiles, collection profiles, or PDP
profiles remain future P10B work.

## 2. Canonical anatomy authority

Each commercial anatomy has:

- one stable identity, semantic version, and contract version;
- unique semantic regions rather than DOM selectors;
- typed structural, semantic-finishing, content, commerce-binding, and asset-role parameters;
- bounded responsive transformations using the P10B-01 responsive vocabulary;
- compatibility with registered page families, narrative roles, BrandSystem postures, approved
  asset roles, and responsive modes;
- one structural classification and realized structure record for every registered variant; and
- deterministic migration metadata.

The closed semantic-region vocabulary includes frame, navigation, media, content, heading, body,
merchandising, price, metadata, proof, actions, utility, continuation, and service. A component
declares only the regions it uses.

Schema-backed mutable parameters—props-backed structure, props/style-backed semantic finishing,
and content-backed content input—must resolve in their canonical schema and must not overlap
protected commerce or component read-only paths. The overlap check is bidirectional: neither a
protected parent nor a mutable parent containing a protected child is accepted. Schema presence
alone therefore does not make read-only content commercially editable.

Commerce-binding and asset-role parameters remain typed references to existing canonical binding
and asset slots. They identify protected external/canonical authority but do not grant editable
value authority, so they are not treated as mutable content or presentation paths.

## 3. Meaningful structural difference

The executable material-difference vocabulary is:

- hierarchy;
- region arrangement;
- region presence or omission;
- asset placement;
- content relationship;
- CTA relationship;
- merchandising emphasis;
- navigation model;
- responsive transformation; and
- presentation mode.

A variant may be classified as `meaningfulStructuralVariant` only when its registered structural
signature differs from the default signature in every declared category. Finishing tokens do not
satisfy this rule. A declaration that is not realized fails component-definition validation.

Every variant uses exactly one of these executable classifications:

- `meaningfulStructuralVariant`;
- `finishingOnlyVariation`;
- `compatibilityAlias`;
- `legacySuperseded`; or
- `notYetP10BCommercialReady`.

Compatibility aliases require an exact registered target. A supersession target, when declared,
must also be registered. Once a definition claims commercial readiness, missing variant coverage,
stale slot/asset/region/transformation references, and incompatible page/narrative authority fail
closed. Duplicate regions and invalid migrations always fail schema validation.

Every region declared `required` must appear exactly once in every realized commercial variant's
base `regionOrder` and may never appear in `omittedRegions`. Optional regions may be realized or
explicitly omitted, but never both. Responsive collapse, reorder, or condensation remains a typed
transformation and does not excuse a structurally incomplete base variant.

## 4. Responsive anatomy and compatibility

Responsive anatomy declares registered transformations such as preserve, stack, scroll, collapse,
reorder, reflow, condense, simplify, disclosure, carousel, switch-layout, or hide-optional. Each
declaration names its supported breakpoint set, source and target presentation modes, and affected
semantic regions. Arbitrary media-query code does not become design authority.

Compatibility remains embedded in the component definition and generated manifest. No parallel
compatibility registry was added. Current asset requirements are derived from the same registered
asset slots and approved role authority already used by components.

Every asset placement must target a declared region that is present in the variant's realized
`regionOrder`. An omitted or otherwise unrealized region cannot hide an asset assignment. Required
asset slots therefore cannot be structurally assigned outside realized anatomy.

## 5. Generated capability and fail-closed query

The generated component capability manifest is version `1.2.0`. Its deterministic fingerprint now
includes canonical anatomy metadata and exact variant classifications/material differences. The
authority exposes:

- `getCommercialAnatomy`;
- `getCommercialAnatomyMigration`; and
- `requireCommercialReadyVariant`.

The requirement query rejects unknown components or variants, missing or stale anatomy,
incompatible page/narrative/asset use, variants not yet commercially ready, and non-meaningful
variants when meaningful structure is required. P10A consumers that do not request P10B
commercial-ready authority remain compatible and continue to use the same manifest.

Canonical component validation establishes the mutable-path, required-region, and realized-asset
invariants before manifest generation. The generated authority therefore cannot advertise a
protected mutable content path or return a commercial-ready variant with incomplete anatomy; the
manifest/query layer does not duplicate or weaken these checks.

## 6. Current registry audit

The current generated registry contains **25 ComponentDefinitionV2 definitions and 91 registered
variants**. Every definition now carries anatomy metadata, and every registered variant has an
explicit executable classification.

The conservative classification is:

| Classification                | Current variants |
| ----------------------------- | ---------------: |
| Meaningful structural variant |                0 |
| Finishing-only variation      |                0 |
| Compatibility alias           |                0 |
| Legacy/superseded             |                0 |
| Not yet P10B commercial-ready |               91 |

This is intentional. Existing variants are not promoted from names or visual aliases alone. The
later component-family tasks must register truthful realized structural signatures before
commercial-ready planning can select them. The contract test proves that a structurally distinct
registered fixture can qualify; it does not claim that the current runtime families already meet
the later commercial coverage gates.

## 7. Migration and existing lifecycle

Anatomy migration is deterministic and version-addressed. Stable version-1 anatomies declare no
migration. A future version that changes anatomy must declare its previous versions and an exact
registered migration step to the current version; missing, duplicate, disconnected, or stale
migration metadata is rejected.

The same component definition remains authoritative for editor, preview, and published
projection. This task changed contract and registry metadata only. It did not create a second
renderer, component registry, PageBlueprint/profile authority, BrandSystem implementation,
storefront state model, or provider interaction.

## 8. Evidence

Focused deterministic evidence covers all required P10B-03 areas:

1. anatomy schema and closed semantic-region vocabulary;
2. deterministic anatomy and manifest fingerprints;
3. semantic-region uniqueness;
4. valid realized meaningful structure;
5. rejection of CSS/finishing-only meaningful claims;
6. complete declaration of every registered variant;
7. typed P10B-01 responsive transformations;
8. incompatible page-family rejection;
9. incompatible narrative-role rejection;
10. invalid or stale asset-requirement rejection;
11. generated anatomy, parameter, responsive, narrative, and asset projection;
12. missing/stale anatomy rejection when commercial capability is required;
13. complete 25-definition/91-variant current-registry classification;
14. unchanged valid P10A capability consumers; and
15. deterministic anatomy migration resolution;
16. valid mutable content-input authority;
17. protected content and commerce overlap rejection, including both parent/child directions;
18. continued structural and semantic-finishing protection;
19. legitimate commerce-binding and asset-role references;
20. required-region presence and required-region omission rejection;
21. optional-region presence, omission, and mutual exclusion;
22. realized, omitted, and undeclared asset-placement validation;
23. commercial-ready generation/query rejection for incomplete anatomy; and
24. variant-order-independent validation.

The focused suite passed 137 tests across component-platform, generated-manifest,
commercial-capability, skill-knowledge, P10B-01 grammar, and P10B-03 anatomy coverage. No AI
provider was called.

## 9. Remaining P10B work

P10B remains Partial. P10B-02 is separately Baseline and owns Design DNA/BrandSystem authority;
P10B-05 remains Planned and owns site-map, page-family, and PageBlueprint profile authority.
P10B-04 and P10B-06 through P10B-18 remain Planned. Later component/profile tasks must use this
contract to promote only evidenced structural variants and then supply all-target rendering,
responsive accessibility, performance, scale, and retained human commercial-quality evidence.

## Current P10B-17 continuation

P10B-17 adds one renderer-facing `responsive-execution-v1` projection derived directly from each
existing commercial anatomy, selected meaningful variant, and its registered breakpoint list. It
emits deterministic transformation and breakpoint fingerprints for homepage, collection, PDP,
content/support, and utility renderers; the singleton card family exposes the equivalent
breakpoint-scoped IDs directly from its anatomy. An unknown variant or missing anatomy still fails
closed. CSS executes only the transformation IDs registered for the active breakpoint, so this is
not a second anatomy, breakpoint vocabulary, component registry, or responsive authority.

The same continuation enforces the existing semantic accessibility contracts through labelled
regions, bounded controls, paired focus roles, live-state semantics, and reduced-motion behavior.
It changes no snapshot, commerce, or media authority. P10B-18 remains responsible for repeated
commercial-quality and scale evidence beyond these registered variants.
