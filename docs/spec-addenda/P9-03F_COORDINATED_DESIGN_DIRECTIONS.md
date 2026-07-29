# P9-03F — Coordinated storefront design directions

## Status

This corrective Phase 9 addendum was identified during the 29 July 2026 real-AI Lumo demo. It
refines the existing Phase 9 requirement that whole-storefront generation creates genuinely
different, coherent storefronts. It does not amend the authoritative SDD or roadmap.

## Merchant outcome

The same approved brief, catalogue and assets can produce one of three recognizably different
complete storefront directions. A direction coordinates the homepage, collection and dynamic
product-detail page; it is not a colour or font restyle.

## Controlled direction contract

`StorefrontDesignDirection` is a versioned, schema-validated registered contract. It contains a
stable direction ID, recipe IDs, typography and image-treatment IDs, a product-card family,
spacing, shape and surface selections, plus the following registered component selections:

- global header/navigation and footer;
- homepage hero, collection discovery, product-card presentation, storytelling, campaign and
  trust sections;
- dynamic collection commerce; and
- dynamic product detail.

The contract accepts only `premiumEditorial`, `modernTechnical` and `warmApproachable`. Recipe IDs
must belong to their correct page family. Every coordinated component selection must occur in its
selected registered recipe; dynamic collection/PDP variants must match their presentation settings;
and the collection card presentation must match its selected registered card family. The planner
also verifies that every recipe component and variant is supported by the active Component Registry
v2. Unknown, unsupported or incompatible choices fail planning rather than degrading to a generic
legacy direction.

The provider receives direction options only as bounded registered context. The server selects and
materializes the canonical plan. Provider output cannot invent IDs, replace the coordinated
direction or broaden protected operation authority.

## Registered directions

| Direction         | Homepage                                                                                             | Collection                                                        | Product detail                                              | Non-colour system choices                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Premium editorial | Full-bleed image hero, image-led discovery, editorial product presentation and story/campaign rhythm | Editorial collection, spacious image-first cards                  | Editorial split, grid gallery and comfortable option groups | Refined serif, spacious rhythm, soft corners, layered surfaces, editorial crop                 |
| Modern technical  | Asymmetric hero, compact commerce-first product discovery and structured category discovery          | Compact collection, dense grid, sidebar filters and compact cards | Compact, thumbnail-led, specification-table PDP             | Technical typography, compact rhythm, square corners, flat surfaces, product-neutral treatment |
| Warm approachable | Welcoming editorial hero, brand story, category cards and approachable product presentation          | Editorial collection with standard cards and horizontal filters   | Balanced, guidance-oriented PDP                             | Warm typography, standard rhythm, rounded corners, subtle surfaces, soft-frame treatment       |

Each pair must differ in homepage composition, collection presentation, PDP presentation, and at
least two non-colour design-system groups. A palette-only or typography-only outcome is invalid.

## Invariants

- Planner and proposal execution use stable IDs; merchant-facing labels remain localized registry
  labels rather than IDs or provider terminology.
- The complete proposal is generated against one snapshot fingerprint, validated before review,
  and accepted/undone/redone atomically.
- Approved asset references and canonical commerce bindings remain validated. Directions may change
  presentation only; they never change product identity, SKU, variants, prices, availability,
  canonical media or collection membership.
- No arbitrary component, recipe, HTML, CSS, JavaScript or provider-defined operation is allowed.

## Capability boundary

This addendum consumes only already registered component families, recipes, image treatments and
dynamic commerce presentations. It does not add production component families or page recipes.
W2's independent reachability audit remains the authority for identifying renderer reachability
gaps. Any gap found there is deferred to the owning P9-04/P9-05 follow-up rather than represented
as a synthetic P9-03F capability.

## Validation

Focused coverage must prove all three direction contracts, rejection of unknown and incompatible
selections, deterministic planning, complete homepage/collection/PDP coordination, structural
differences beyond colour, approved asset and canonical-commerce preservation, and preservation of
the direction through proposal compilation and lifecycle validation.
