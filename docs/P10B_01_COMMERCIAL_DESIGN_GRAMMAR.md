# P10B-01 — Commercial Design Grammar and Compatibility Vocabulary

**Status:** **Baseline**

**Phase status:** P10B — Commercial Storefront Generation System v1 is **Partial / active**.

**Date:** 8 August 2026

**Binding architecture:**
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md)

## 1. Outcome

P10B-01 establishes one typed, closed, immutable, fingerprinted commercial design grammar through
the existing generated component and executable PageBlueprint capability manifest. Planning and
compiler-facing consumers can query the grammar without maintaining a second catalogue.

The canonical inheritance remains:

```text
BrandSystem
  → PageBlueprint profile
  → component family / meaningful variant
  → bounded validated instance override
```

Each category names one primary owner and the exact lower authorities permitted to narrow or select
it. A lower layer can intersect inherited values but cannot add a value excluded by its parent.
Unknown, stale, conflicting, unbounded, or wrong-owner input fails with a stable typed error before
proposal compilation or snapshot mutation.

This task does not implement the P10B-02 Design DNA expansion, P10B-03 component anatomy,
P10B-04 art-direction data, P10B-05 site-map/page-family authority, commercial renderers, synthesis,
or editor controls.

## 2. Canonical placement

The vocabulary is a contract extension of existing authority:

- `commercialGrammarCategories` is the closed schema vocabulary in the component-platform design
  domain;
- `commercialDesignGrammar` is generated into the existing immutable component/PageBlueprint
  capability manifest;
- the manifest fingerprint includes components, executable profiles, and grammar;
- `commercialDesignGrammarKnowledge` is the read-only planning boundary;
- no registration or mutation operation is exposed;
- no token store, component registry, PageBlueprint graph, direction authority, recipe engine, or
  persisted storefront representation was added.

The capability manifest version is `1.1.0`. Its reference carries both the exact manifest
fingerprint and the exact commercial-grammar fingerprint. Either becoming stale closes the query.
The generated `valueCompatibility` projection covers every registered category/value. Values with
no additional cross-category rule are explicitly allowed only inside their inherited ownership
bounds; values with additional rules expose the exact rule IDs.

## 3. Closed taxonomy and ownership

The table lists the primary owner. Every category also declares explicit narrowing and selection
levels. Instance selection is permitted only where the schema says so.

| Domain     | Category                    | Closed values                                                                                                              | Primary owner |
| ---------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Typography | `typography.posture`        | editorial, humanist, modern, restrained, technical                                                                         | BrandSystem   |
| Typography | `typography.role`           | body, display, emphasis, heading, price, utility                                                                           | BrandSystem   |
| Typography | `typography.scale`          | balanced, compact, expressive                                                                                              | BrandSystem   |
| Typography | `typography.weight`         | light, medium, regular, strong                                                                                             | BrandSystem   |
| Typography | `typography.tracking`       | normal, open, tight                                                                                                        | BrandSystem   |
| Typography | `typography.lineHeight`     | balanced, relaxed, tight                                                                                                   | BrandSystem   |
| Layout     | `layout.container`          | commerce, content, full, reading, wide                                                                                     | BrandSystem   |
| Layout     | `layout.sectionRhythm`      | balanced, compact, expansive                                                                                               | PageBlueprint |
| Layout     | `layout.pageGutter`         | compact, generous, standard                                                                                                | BrandSystem   |
| Layout     | `layout.gridRhythm`         | open, standard, tight                                                                                                      | PageBlueprint |
| Layout     | `layout.alignment`          | center, end, split, start                                                                                                  | PageBlueprint |
| Layout     | `layout.density`            | compact, spacious, standard                                                                                                | BrandSystem   |
| Layout     | `layout.visualWeight`       | dominant, heavy, light, medium                                                                                             | PageBlueprint |
| Layout     | `layout.balance`            | asymmetric, editorial, symmetric                                                                                           | PageBlueprint |
| Surface    | `surface.role`              | accent, background, bordered, contrast, elevated, inset, muted, overlay, plain, subtle, surface                            | BrandSystem   |
| Action     | `action.hierarchy`          | primary, quiet, secondary, tertiary, text-link                                                                             | BrandSystem   |
| Control    | `control.posture`           | compact, prominent, standard                                                                                               | BrandSystem   |
| Shape      | `shape.border`              | defined, none, strong, subtle                                                                                              | BrandSystem   |
| Shape      | `shape.radius`              | pill, rounded, square, subtle                                                                                              | BrandSystem   |
| Shape      | `shape.elevation`           | flat, floating, raised, subtle                                                                                             | BrandSystem   |
| Media      | `media.ratio`               | landscape, natural, portrait, square, wide                                                                                 | BrandSystem   |
| Media      | `media.crop`                | artDirected, contain, cover, editorial                                                                                     | BrandSystem   |
| Media      | `media.focalPoint`          | artDirected, center, source, subject                                                                                       | BrandSystem   |
| Media      | `media.overlay`             | contrast, gradient, none, subtle                                                                                           | BrandSystem   |
| Media      | `media.emphasis`            | balanced, immersive, leading, supporting                                                                                   | BrandSystem   |
| Responsive | `responsive.transformation` | carousel, collapse, condense, disclosure, hide-optional, preserve, reflow, reorder, scroll, simplify, stack, switch-layout | PageBlueprint |
| Narrative  | `narrative.role`            | campaign, continuation, conversion, discovery, editorial, introduction, merchandising, proof, service, utility             | PageBlueprint |

The commercial narrative vocabulary is a semantic projection over the existing canonical
PageBlueprint narrative authority. It does not replace the retained P10A roles or create another
narrative registry.

## 4. Inheritance and narrowing

Resolution is deterministic and ordered by canonical authority level, not caller array order.
Exactly one effective layer is permitted at each of BrandSystem, PageBlueprint, component-variant,
and instance authority. Duplicate layers at any level fail closed before any selection is applied;
reversing duplicate inputs therefore produces the same typed issue, effective defaults, and
fingerprint rather than selecting a caller-order-dependent winner.

1. Start from each registered category and its default allowed set.
2. Apply BrandSystem authority.
3. Intersect PageBlueprint constraints with the inherited set.
4. Intersect component-family or meaningful-variant constraints with that result.
5. Accept an instance selection only when the category explicitly permits it and the value remains
   inside every inherited constraint.
6. Reject widening, empty intersections, conflicting selections, and wrong-owner changes.
7. Fingerprint the complete effective values, allowed sets, and deterministic issue result.

`layout.alignment` and `layout.visualWeight` currently permit bounded instance selection. Global
posture, typography, container, surface, control, shape, media, responsive, and narrative authority
cannot be broadened through an arbitrary instance value. Later P10B tasks may narrow declared
selection levels through the same schema; they may not bypass it.

## 5. Compatibility language

Compatibility references are closed and can address:

- a grammar category/value;
- a registered PageBlueprint profile;
- a registered component family;
- an exact registered component/variant;
- a responsive mode;
- a commercial narrative role;
- an approved asset role; or
- a typed media requirement.

Compatibility evaluation first parses and canonicalizes the complete input, then validates every
supplied reference against current authority before running any relationship rule. Grammar
category/value, responsive-mode, and narrative-role validity comes from the generated commercial
grammar capability; profile, component-family, component-type, and variant validity comes from the
same generated executable PageBlueprint/component capability manifest; asset roles come from the
shared canonical asset-role schema; and media requirements come from the closed media-requirement
contract. The rule list is not used as an identity inventory. A registered reference with no active
rule remains valid, while any unknown or stale reference fails closed and cannot be interpreted as
compatible.

Rules use exactly five relationships:

- `allowed` — records a permitted relationship without inventing a selection;
- `prohibited` — rejects the active pair;
- `requires` — rejects a selected left side when the required authority is absent;
- `mutuallyExclusive` — rejects both active sides;
- `narrowingIntersection` — requires both references to resolve to the same active bounded
  intersection.

The baseline rules prove that art-directed crop requires approved-asset authority, art-directed
crop or focal-point mutation cannot replace canonical product-media authority, and responsive
mode must agree with the resolved responsive transformation. Protected commerce and product media
remain unchanged.

## 6. Legacy v1.3 adaptation

Valid existing v1.3 `BrandSystem`, `StorefrontSnapshot`, PageBlueprint, and component state remains
readable. The adapter creates transient query layers; it does not rewrite or persist legacy state.

The deterministic projection maps existing approved font/voice posture, type scale/weight,
content-width, density, surface, button, border, radius, elevation, image ratio/crop/emphasis, slot
visual weight, narrative role, and supported bounded PageBlueprint parameters into the new closed
vocabulary. Every mapping lands on a registered value and never expands the source authority.

Collection and PDP composite PageBlueprint slots retain their canonical runtime ownership through
`dynamicCollectionCommerce` and `dynamicProductDetail`. The PageBlueprint slot identity and variant
remain exact; the runtime capability view does not pretend that a composite sub-slot variant is a
separate runtime component variant.

## 7. Typed rejection

Domain resolution returns stable issue codes:

- `UNKNOWN_GRAMMAR_CATEGORY`;
- `UNKNOWN_GRAMMAR_VALUE`;
- `UNKNOWN_PAGE_BLUEPRINT_PROFILE`;
- `UNKNOWN_COMPONENT_FAMILY`;
- `UNKNOWN_COMPONENT_TYPE`;
- `UNKNOWN_COMPONENT_VARIANT`;
- `UNKNOWN_RESPONSIVE_MODE`;
- `UNKNOWN_NARRATIVE_ROLE`;
- `UNKNOWN_ASSET_ROLE`;
- `UNKNOWN_MEDIA_REQUIREMENT`;
- `INVALID_COMPATIBILITY_INPUT`;
- `DUPLICATE_GRAMMAR_AUTHORITY_LEVEL`;
- `UNBOUNDED_DESIGN_VALUE`;
- `PROHIBITED_GRAMMAR_AUTHORITY`;
- `ILLEGAL_GRAMMAR_BROADENING`;
- `CONFLICTING_GRAMMAR_CONSTRAINT`;
- `INCOMPATIBLE_GRAMMAR_SELECTION`;
- `MISSING_GRAMMAR_REQUIREMENT`.

The planning boundary additionally distinguishes stale manifest, stale grammar, stale
materialization, unknown profile/slot/component, incompatible variant, invalid legacy state,
invalid inheritance, and incompatible grammar. Raw CSS, class names, React/JavaScript-like values,
unregistered fonts, and arbitrary style tokens are not accepted as design values.

## 8. Capability reachability

The verified path is:

```text
valid v1.3 BrandSystem
  → exact executable PageBlueprint materialization
  → exact PageBlueprint slot
  → canonical registered runtime component capability
  → generated commercial grammar authority
  → immutable planning/compiler-facing query result
```

The query checks the current profile version, materialization fingerprint, page type, slot,
component selection, exact non-composite variant, composite runtime owner, grammar reference, and
compatibility result. It exposes no renderer implementation, provider payload, commerce record,
asset instance, registration, or mutation operation.

## 9. Evidence

Focused deterministic evidence covers:

- all 27 categories and nine domains;
- ownership and exact selection/narrowing authority;
- four-level inheritance and bounded instance override;
- illegal broadening, empty intersection, unknown category/value, raw CSS/code, wrong-owner, and
  duplicate-level rejection;
- fail-closed validation of profile, component, variant, responsive, narrative, asset, and media
  authority before all five compatibility relationships and protected-media requirements;
- stable order-insensitive valid authority, deterministic invalid-result, and material selection
  fingerprints;
- deterministic non-mutating v1.3 adaptation;
- every current executable P10A PageBlueprint and slot, including composite collection/PDP
  mapping;
- stale manifest, grammar, materialization, component, and variant rejection; and
- immutable read-only queries without a second inventory.

No AI provider or Vesko API is involved.

## 10. Deferred work

P10B remains **Partial / active**. P10B-02, P10B-03, and P10B-05 are now unblocked and remain
**Planned**. They may proceed in parallel only with the disjoint ownership established by the
architecture lock:

- P10B-02 owns the persisted parametric BrandSystem / Design DNA and renderer projection;
- P10B-03 owns component anatomy and meaningful variant metadata;
- P10B-05 owns site-map, page-family, route, and navigation authority.

This Baseline does not claim new visual variants, page families, renderer output, responsive visual
quality, commercial quality, synthesis diversity, merchant editor reachability, Vesko staging, or
production evidence.
