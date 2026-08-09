# P10B — Commercial Storefront Generation Architecture and Delivery Lock

**Status:** Binding architecture. P10B-01 through P10B-10 and P10B-13 are **Baseline**;
P10B-11, P10B-12, and P10B-14 through P10B-18 remain **Planned**.

**Phase:** P10B — Commercial Storefront Generation System v1

**Baseline:** 9 August 2026, P10B-13 commerce utility presentation pages

**Historical evidence:**
[`P10B_01_STOREFRONT_DESIGN_SYSTEM_CAPABILITY_AUDIT.md`](P10B_01_STOREFRONT_DESIGN_SYSTEM_CAPABILITY_AUDIT.md)
remains the pre-implementation capability audit. This lock supersedes its provisional delivery
sequence without rewriting its historical findings.

## 1. Product outcome and boundary

P10B must make Veskify capable of generating a complete, coherent, commercially credible,
multi-page online storefront that a serious retailer can publish without a designer rebuilding it.
The architecture must support hundreds or thousands of materially different bounded outcomes from
compatible registered authority.

P10B is not three templates, palette swaps, CSS-class variants, one homepage with generic commerce
pages, or arbitrary AI-generated frontend code. Commercial diversity comes from governed
composition and finishing choices whose compatibility is deterministic and whose visual quality is
retained for human review.

P10A remains Baseline / closed. P10B-01 is Baseline under
[`P10B_01_COMMERCIAL_DESIGN_GRAMMAR.md`](P10B_01_COMMERCIAL_DESIGN_GRAMMAR.md), P10B-02 is Baseline
under [`P10B_02_PARAMETRIC_BRAND_SYSTEM.md`](P10B_02_PARAMETRIC_BRAND_SYSTEM.md), and P10B-03 is
Baseline under
[`P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md`](P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md).
P10B-04 is Baseline under
[`P10B_04_RESPONSIVE_IMAGE_ART_DIRECTION.md`](P10B_04_RESPONSIVE_IMAGE_ART_DIRECTION.md), P10B-05
is Baseline under
[`P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md`](P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md).
P10B-06 is Baseline under
[`P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md`](P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md), and
P10B-07 is Baseline under
[`P10B_07_HERO_EDITORIAL_CAMPAIGN_PROOF_FAMILIES.md`](P10B_07_HERO_EDITORIAL_CAMPAIGN_PROOF_FAMILIES.md).
P10B-08 is Baseline under
[`P10B_08_CANONICAL_PRODUCT_CARD_AND_MERCHANDISING.md`](P10B_08_CANONICAL_PRODUCT_CARD_AND_MERCHANDISING.md).
P10B-09 is Baseline under
[`P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md`](P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md).
P10B-10 is Baseline under
[`P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md`](P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md).
P10B is **Partial / active**; P10B-11, P10B-12, and P10B-14 through P10B-18 remain Planned.

## 2. Storefront and commerce ownership

### 2.1 Veskify owns storefront creation

Veskify owns the storefront site map, page creation, navigation composition, route presentation,
responsive visual composition, bounded presentation copy, `BrandSystem`, registered
`PageBlueprint` profiles, component families and meaningful variants, storefront synthesis,
`StorefrontSnapshot`, preview, and publication presentation.

That ownership covers:

- shared header, announcement, search, locale, cart entry, navigation, mobile navigation, and
  footer;
- homepage;
- collection and category pages;
- product-detail pages;
- About and brand-story pages;
- Contact and store-location pages;
- FAQ and service-information pages;
- shipping, returns, and policy presentation;
- campaign and editorial landing pages;
- reusable generic content pages;
- search/results and no-results presentation;
- cart and checkout presentation;
- empty, error, and 404 presentation.

Veskify decides which registered page families are required for the approved merchant context,
creates the canonical page set, assigns registered profiles, composes navigation, and preserves the
result through the existing lifecycle.

### 2.2 Vesko owns operational commerce truth

Vesko remains authoritative for product, variant, option, SKU, price, stock, availability,
canonical product media, inventory, cart and checkout operations, payment, orders, shipping, taxes,
returns, logistics, and merchant/store operational facts. Veskify may bind and present these facts
but may not mutate, replace, or invent them.

Legal, policy, service, certification, guarantee, delivery, and compliance claims may appear only
when approved merchant evidence or canonical Vesko facts authorize them. Missing authority causes
registered omission, neutral fallback, clarification, or rejection; it never causes fabricated
content.

## 3. Canonical generation architecture

```text
approved merchant evidence + read-only Vesko commerce
  → Veskify site-map and page-set decision
  → bounded BrandSystem / Design DNA
  → registered PageBlueprint profile per page
  → compatible component family and meaningful structural variant
  → bounded validated parameters
  → approved asset placement and art direction
  → narrative and compatibility validation
  → complete StorefrontSnapshot
  → preview
  → explicit publish
```

The one inheritance chain remains:

```text
BrandSystem
  → PageBlueprint profile
  → component family / meaningful variant
  → bounded validated instance override
```

This architecture extends existing authorities. It must not introduce another token store, page
graph, recipe engine, component registry, direction authority, snapshot, asset inventory, commerce
model, arbitrary CSS surface, arbitrary React surface, or generated executable frontend code.

## 4. Blueprint plus bounded finishing

A component or page blueprint is the architectural plan. It owns structure, regions, hierarchy,
slots, relationships, responsive transformations, permitted layouts, required bindings, asset
roles, ordering, cardinality, omission, and fallback.

AI or deterministic synthesis may then select only registered bounded finishing decisions:

- semantic palette and approved font pairing;
- type scale, role assignments, and weights;
- spacing rhythm, section rhythm, grid gap, and card inset;
- page gutters and container posture;
- surface, border, radius, elevation, and shadow grammar;
- action, button, control, and density treatment;
- image ratio, crop, focal point, safe area, overlay, and responsive derivative;
- alignment, visual weight, and other declared structural parameters.

These decisions are typed canonical values. A raw CSS declaration, class name, DOM tree, React
element, free-form breakpoint, or unregistered font is not a finishing decision and fails closed.

## 5. Parametric Design DNA through `BrandSystem`

P10B extends the existing `BrandSystem` as the merchant-wide bounded Design DNA. It is the only
global visual-foundation authority and must establish cross-page identity rather than styling every
section independently.

The P10B Design DNA must govern at least:

- semantic colour roles and contrast-safe derived roles;
- approved font-family roles and font pairing;
- display, heading, body, utility, label, and price roles;
- type scale and weight posture;
- spacing scale and rhythm;
- page gutters and reading, content, commerce, wide, and full-width containers;
- section rhythm, grid gap, and card inset;
- control size and density;
- surface grammar;
- border grammar;
- radius grammar;
- elevation and shadow grammar;
- primary, secondary, tertiary, and text-action hierarchy;
- image-treatment defaults;
- responsive density and layout posture.

Profiles and variants may constrain or narrow Design DNA. Instance overrides may select only values
explicitly permitted by the effective constraint. None may broaden the brand authority or create a
parallel per-section theme.

## 6. Meaningful component variants

An invalid shallow variant keeps the same anatomy and composition and changes only a CSS class,
colour, padding, border, or radius. Such a change is a bounded treatment parameter, not a meaningful
variant.

A meaningful structural variant changes at least one maintained semantic property:

- hierarchy or anatomy;
- region arrangement;
- asset placement;
- content relationship;
- CTA relationship;
- navigation model;
- merchandising emphasis;
- responsive transformation;
- interaction or presentation mode.

Every commercial family must document and register its anatomy, meaningful variants, bounded
parameters, required and optional asset roles, compatible narrative roles, responsive behavior,
accessibility behavior, and exact `PageBlueprint` reachability. The same maintained implementation
must render through editor, preview, and published targets.

## 7. Minimum v1 commercial coverage

### 7.1 Shared frame

- At least four materially distinct complete frame systems.
- At least three meaningful mobile navigation modes.
- At least four meaningful footer compositions.
- Coordinated announcement, search, cart entry, and locale treatment where applicable.
- One cross-page frame identity preserved by every generated page and route.

### 7.2 Hero and first impression

At least six meaningful compositions spanning editorial, split, full-bleed,
product/collection-led, campaign, and restrained/minimal postures.

### 7.3 Editorial, campaign, service, and proof

Reusable families must cover brand story, craftsmanship/process, image/text, quote/editorial,
lookbook, campaign, service/trust, and evidence-backed proof. Evidence-dependent sections must omit
or fail closed when their approved source is absent.

### 7.4 Canonical product card

One canonical product-card authority must provide at least five meaningful anatomies: editorial,
compact, dense, image-led, and comparison/information-led. Compatible bounded treatments may select
canonical primary or alternative media, price state, approved badges/attributes, availability,
secondary media/hover where supported, responsive density, and approved actions. No card may copy,
invent, or own protected commerce.

### 7.5 PageBlueprint profile targets

- Homepage: at least six materially different registered profiles and narrative flows.
- Collection/search: at least four profiles covering editorial discovery, catalogue comparison,
  campaign-led, and dense/search-oriented presentation.
- PDP: at least four profiles covering standard commerce, high-consideration, gallery-led, and
  variant-led purchase experiences through the same generic option/commerce architecture.
- Content/support: registered About/brand story, Contact/locations, FAQ, shipping/returns, policy,
  campaign/editorial landing, and generic content profiles; major content types receive more than
  one meaningful composition where commercially useful.
- Commerce utility: governed search/no-results, cart, checkout, empty, error, and 404 presentation;
  operational cart, checkout, and payment behavior remains Vesko-owned.

## 8. Site-map and page-family authority

P10B adds a bounded Veskify-owned site-map decision over the existing `PageBlueprint` and
`StorefrontSnapshot` authorities. It selects a registered page set from approved merchant evidence,
canonical catalogue shape, supported locales, and required commerce/service surfaces.

The decision must validate unique routes, required shared frame, navigation reachability, page
family/profile compatibility, locale coverage, canonical commerce context, approved facts,
optional-page omission, and utility/error coverage. Materialization creates ordinary canonical
pages inside `StorefrontSnapshot`; the decision is not persisted as a second page graph.

Unknown page families, duplicate or unsafe routes, missing required commerce context, unsupported
locale combinations, unapproved policy/service content, orphan navigation, and incompatible
profiles fail before proposal or snapshot mutation.

## 9. Bounded combinatorial storefront synthesis

The synthesis authority selects compatible combinations across:

- Design DNA;
- site map and page set;
- `PageBlueprint` profiles;
- shared-frame family and variants;
- component anatomies and meaningful variants;
- bounded structural and visual parameters;
- approved assets and image treatments;
- section ordering and cardinality;
- narrative roles and commercial emphasis.

Selection uses only live registered authority. It must preserve cross-page identity, reject
incompatible combinations, avoid excessive family/profile repetition, prevent exact and meaningful
near duplicates, preserve protected commerce/assets, and fail closed for unsupported combinations.
Hundreds or thousands of possible outcomes must arise from valid combinations, not from thousands
of manually authored templates.

### 9.1 Compatibility sequence

1. Resolve current merchant evidence, catalogue, locale, registry, profile, and asset authority.
2. Select a supported page set and validate navigation/route completeness.
3. Select one compatible Design DNA and registered direction constraints.
4. Select a profile for every page and one shared frame for the storefront.
5. Select compatible family anatomies, variants, parameters, and approved assets.
6. Validate narrative roles, adjacency, omission, cardinality, and cross-page repetition.
7. Resolve canonical bindings and protected-commerce parity.
8. Produce a deterministic design fingerprint and reject duplicate/near-duplicate candidates when
   diversity is required.
9. Compile the validated selection through existing proposal authority into one complete
   `StorefrontSnapshot`.

## 10. Storefront design fingerprint

Every synthesized storefront must have a deterministic fingerprint covering enough canonical
design authority to distinguish structure rather than colour alone:

- Design DNA identity and resolved semantic posture;
- page set and routes;
- PageBlueprint profile per page;
- shared-frame selection;
- component family/anatomy/variant selections;
- structural bounded parameters;
- image-treatment posture;
- density and responsive posture;
- narrative roles, order, and cardinality.

The fingerprint must support exact duplicate detection, meaningful near-duplicate detection,
pairwise generated-store comparison, and final scale evidence. A colour-only, font-only, or spacing-
only difference is not material diversity. Near-duplicate scoring must weight page structure,
anatomy, merchandising, responsive transformation, and narrative flow more heavily than finishing
details.

## 11. Coordinated commercial directions

Premium Editorial, Modern Technical, and Minimal Commerce are coordinated constraint packages that
select compatible canonical authority. They may guide typography, image posture, density, frame
families, preferred profiles, merchandising emphasis, narrative intensity, surfaces, and component
compatibility.

They do not own tokens, pages, recipes, components, instance values, or failure behavior. A
direction that references missing, stale, ambiguous, or incompatible authority fails closed.

## 12. Early Premium Editorial vertical slice

Before broad synthesis and direction expansion, P10B must prove one complete Premium Editorial
storefront with credible approved assets and realistic canonical commerce. It includes:

- shared frame and navigation;
- homepage;
- collection;
- simple PDP;
- configurable PDP;
- About;
- Contact or locations;
- FAQ or service-information page;
- required search/no-results, cart/checkout, empty, error, and 404 presentation.

The slice must be reachable through canonical generation, preserved in `StorefrontSnapshot`,
visible in preview/published rendering, responsive at 375/768/1024/1440 px, and retained for human
commercial review. It does not wait for P10B-18 and does not itself complete the phase.

## 13. Locked implementation sequence

P10B-01 through P10B-10 and P10B-13 are **Baseline**. P10B-11, P10B-12, and P10B-14 through
P10B-18 remain **Planned**. Parent tasks may use A/B/C slices only when required to keep contract,
renderer, profile/generation, or evidence PRs reviewable. A parent remains Planned or Partial until
every required slice and its evidence passes.

| Task                                                             | Locked outcome                                                                                                                                                   | Dependency                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P10B-01 — Commercial design grammar and compatibility vocabulary | Make structural, visual, responsive, narrative, and compatibility vocabulary executable through existing canonical authorities.                                  | P10A closure; this architecture lock; historical audit/specification |
| P10B-02 — Parametric BrandSystem / Design DNA                    | Make merchant-wide typography, palette, spacing, layout, surfaces, controls, radius, elevation, density, and media posture bounded, coherent, and AI-selectable. | P10B-01                                                              |
| P10B-03 — Component anatomy and meaningful variant contract      | Give every commercial family explicit anatomy, structural variants, bounded parameters, responsive transformations, and compatibility metadata.                  | P10B-01                                                              |
| P10B-04 — Responsive image and art-direction authority           | Add approved focal point, safe area, crop, ratio, overlay, derivative, and responsive treatment authority without modifying canonical product media.             | P10B-02 and P10B-03                                                  |
| P10B-05 — Veskify site-map and page-family authority             | Create and validate complete page sets, navigation, routes, and registered page families through `PageBlueprint` and `StorefrontSnapshot`.                       | P10B-01                                                              |
| P10B-06 — Commercial shared-frame families                       | Deliver materially distinct coordinated header/navigation/announcement/mobile/footer systems.                                                                    | P10B-02, P10B-03, P10B-05; consume P10B-04 where media applies       |
| P10B-07 — Hero, editorial, campaign and proof families           | Deliver meaningful first-impression, storytelling, campaign, service, and approved-proof compositions.                                                           | P10B-02 through P10B-05                                              |
| P10B-08 — Canonical product-card and merchandising family        | Consolidate duplicated card authority into one protected reusable commercial product-card system.                                                                | P10B-02 through P10B-04                                              |
| P10B-09 — Commercial homepage profile library                    | Deliver at least six materially different homepage profiles/narrative flows.                                                                                     | P10B-05 through P10B-08                                              |
| P10B-10 — Commercial collection and search profiles              | Deliver at least four discovery, comparison, campaign, and dense/search profiles.                                                                                | P10B-04 through P10B-06 and P10B-08                                  |
| P10B-11 — Commercial PDP profile library                         | Deliver at least four standard, high-consideration, gallery-led, and variant-led experiences.                                                                    | P10B-03 through P10B-06 and P10B-08                                  |
| P10B-12 — Content and support page families                      | Generate approved-fact About, Contact/locations, FAQ, shipping/returns, policy, campaign/editorial, and generic content pages.                                   | P10B-03 through P10B-07                                              |
| P10B-13 — Commerce utility presentation pages                    | Deliver search/no-results, cart, checkout, empty, error, and 404 presentation while Vesko retains operations.                                                    | P10B-03, P10B-05, P10B-06, P10B-08                                   |
| P10B-14 — Premium Editorial complete-storefront vertical slice   | Prove one commercially credible complete multi-page storefront before broad synthesis/direction expansion.                                                       | Minimum accepted capability from P10B-02 through P10B-13             |
| P10B-15 — Bounded storefront synthesis and narrative engine      | Generate coherent stores by selecting compatible Design DNA, page set, profiles, variants, parameters, assets, and narrative roles.                              | P10B-14 and sufficient implemented family/profile authority          |
| P10B-16 — Coordinated directions and diversity control           | Make all three directions coordinated constraint packages and add deterministic duplicate/near-duplicate prevention.                                             | P10B-15                                                              |
| P10B-17 — Responsive, accessibility and performance closure      | Preserve deliberate hierarchy and usability across four widths, EN/FI, keyboard/accessibility, and bounded performance budgets.                                  | Implemented commercial families/profiles/directions through P10B-16  |
| P10B-18 — Commercial quality and scale gate                      | Prove repeated generation of publishable, premium, materially different complete storefronts.                                                                    | P10B-17 and every prior P10B task                                    |

## 14. Concrete completion contract by task

Each task must prove the complete applicable chain: registered → runtime-queryable →
planner-selectable → proposal-expressible → compiler-preserved → `StorefrontSnapshot`-stored →
renderer-visible → editor-accessible where P10C authority already permits → save/reload preserved →
publish preserved → evidence retained.

### P10B-01 — Commercial design grammar and compatibility vocabulary

- **Status:** **Baseline** under
  [`P10B_01_COMMERCIAL_DESIGN_GRAMMAR.md`](P10B_01_COMMERCIAL_DESIGN_GRAMMAR.md).
- Extend existing `BrandSystem`, bounded-parameter, component-compatibility, PageBlueprint, asset,
  narrative, and direction-reference vocabularies; create no new authority.
- Define closed values, ownership, inheritance/narrowing, compatibility, migrations, and stable
  typed rejection for unknown, stale, broadening, or conflicting values.
- Done only when every vocabulary item is schema-valid, runtime-queryable, fingerprinted, and
  available to downstream canonical consumers without renderer-visible implementation claims.

### P10B-02 — Parametric BrandSystem / Design DNA

- **Status:** **Baseline** under
  [`P10B_02_PARAMETRIC_BRAND_SYSTEM.md`](P10B_02_PARAMETRIC_BRAND_SYSTEM.md).
- Implement every Design DNA domain in section 5 with deterministic legacy migration and
  contrast-safe renderer projection.
- Prove two materially different Design DNA instances change non-colour cross-page foundations and
  preserve save/reload/publication.
- Reject unrestricted fonts, raw CSS, invalid ranges, contrast failures, per-section token stores,
  and instance attempts to broaden brand authority.

### P10B-03 — Component anatomy and meaningful variant contract

- **Status:** **Baseline** under
  [`P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md`](P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md).
- Register anatomy, structural-difference declaration, parameters, assets, responsive behavior,
  narrative compatibility, and PageBlueprint reachability for every commercial family.
- Prove a declared meaningful variant changes maintained hierarchy/composition and the same
  renderer identity serves editor, preview, and publish.
- Reject shallow class-only aliases as meaningful variants and reject missing/incompatible anatomy
  metadata before planning.

### P10B-04 — Responsive image and art-direction authority

- Extend approved asset presentation with focal point, safe area, crop, ratio, overlay, derivative,
  responsive fallback, and compatibility authority.
- Prove intentional desktop/mobile treatment and correct omission/fallback across representative
  editorial and canonical product media.
- Reject wrong-owner, wrong-role, stale, unapproved, unsafe, or product-media-replacement attempts.

### P10B-05 — Veskify site-map and page-family authority

- Register and validate every page family in section 7.5 and generate a navigable canonical page
  set through existing PageBlueprint/StorefrontSnapshot authority.
- Prove unique routes, locale coverage, shared-frame reachability, required utility states, and
  save/reload/publish preservation.
- Reject unknown families, duplicate/unsafe routes, orphan navigation, missing commerce context,
  and unsupported policy/service claims before mutation.
- **Status:** **Baseline** under
  [`P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md`](P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md).

### P10B-06 — Commercial shared-frame families

- Deliver at least four complete frame systems, three mobile navigation modes, and four footer
  compositions with coordinated announcement/search/cart/locale treatment.
- Prove one frame identity across every page, EN/FI, four target widths, keyboard/focus, proposal,
  snapshot, preview, and publish.
- Reject incompatible header/footer/mobile combinations and any second navigation authority.
- **Status:** **Baseline**. See
  [`P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md`](P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md).

### P10B-07 — Hero, editorial, campaign and proof families

- Deliver at least six hero compositions plus the reusable story/campaign/service/proof coverage in
  section 7.3.
- Prove approved asset/copy reachability, meaningful anatomy differences, narrative compatibility,
  responsive rendering, omission, and publication preservation.
- Reject invented claims, unapproved proof, missing required assets, invalid adjacency, and
  unsupported family/profile combinations.
- **Status:** **Baseline**. Six meaningful hero structures, editorial/story, campaign/promotion and
  evidence-grounded proof/service families use the existing V2 registry, PageBlueprint,
  `StorefrontSnapshot`, P10B-04 art direction and shared renderer authority.

### P10B-08 — Canonical product-card and merchandising family

- Establish one product-card authority with at least five meaningful anatomies and bounded
  treatments for the canonical states in section 7.4.
- Prove identical protected product facts across home, collection/search, related products,
  responsive modes, snapshot, and published rendering.
- Reject duplicated card authorities, wrong-product media, fabricated badges/price/availability,
  and incompatible actions.

### P10B-09 — Commercial homepage profile library

**Status:** Baseline. Six versioned PageBlueprint profiles compose P10B-06 frames, P10B-07
storytelling families, P10B-08 cards, P10B-04 assets, and P10B-02 Design DNA through executable
evidence/cardinality, compatibility, responsive, fingerprint, lifecycle, and browser authority.
See
[`P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md`](P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md).

- Register at least six materially different homepage profiles with distinct hierarchy, narrative
  flow, merchandising emphasis, cardinality, and responsive transformation.
- Prove generation selection, exact materialization, proposal/compiler/snapshot preservation,
  renderer visibility, and credible-asset four-width review.
- Reject colour-only duplicates, unsupported ordering, excessive repetition, missing required
  authority, and generic unregistered sections.

### P10B-10 — Commercial collection and search profiles

**Status:** Baseline. Four versioned collection/search PageBlueprint profiles compose P10B-06
frames, P10B-03 collection anatomy, P10B-08 product cards, P10B-04 approved media, and P10B-02
Design DNA through exact canonical catalogue bindings, structural fingerprints, lifecycle, and
four-width browser authority. See
[`P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md`](P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md).

- Register at least four profiles: editorial discovery, catalogue comparison, campaign-led, and
  dense/search-oriented, including results and no-results behavior.
- Prove canonical collection/order, filters/sort intents, child collections, product cards,
  pagination/results, responsive behavior, and published rendering.
- Reject membership/order/price/media mutation, incompatible card/filter combinations, and profiles
  that differ only by finishing values.

### P10B-11 — Commercial PDP profile library

- Register at least four profiles: standard commerce, high-consideration, gallery-led, and
  variant-led through `dynamicProductDetail` and the generic option architecture.
- Prove simple/configurable products, dependencies, incomplete/unavailable selections, resolved
  price/availability/media, related products, responsive modes, and published rendering.
- Reject product-type forks, dropped option groups, protected commerce/media mutation, and shallow
  profile duplication.

### P10B-12 — Content and support page families

- Register About/brand story, Contact/locations, FAQ, shipping/returns, policy,
  campaign/editorial, and generic content profiles; provide multiple meaningful compositions where
  commercially useful.
- Prove approved-fact provenance, localization, site-map/navigation reachability, omission/fallback,
  responsive output, snapshot preservation, and publication.
- Reject fabricated store locations, policy, certification, guarantee, delivery, compliance, or
  service claims.

### P10B-13 — Commerce utility presentation pages

- Register search/no-results, cart, checkout, empty, error, and 404 presentation with coherent
  Design DNA/shared frame and explicit operational adapter boundaries.
- Prove canonical facts/actions are presented, empty/error states are useful, responsive and
  accessible, and the complete page set preserves them.
- Reject local cart/checkout/payment ownership, commerce writes, invented totals/availability, and
  executable payment or checkout behavior outside Vesko adapters.

### P10B-14 — Premium Editorial complete-storefront vertical slice

- Generate the complete page/state set in section 12 from one approved brief, realistic commerce,
  and credible approved assets.
- Prove exact canonical generation, complete snapshot, navigation, preview/published rendering,
  EN/FI where content exists, four widths, protected commerce/assets, and retained human review.
- The slice fails if any required page is generic, missing, disconnected, rebuilt by hand, or only
  schema-valid without commercial review.

### P10B-15 — Bounded storefront synthesis and narrative engine

- Implement the compatibility sequence in section 9.1 over real registered families/profiles; do
  not synthesize unsupported trees or styles.
- Prove deterministic selection, cross-page identity, narrative/adjacency/cardinality rules,
  repetition control, complete snapshot output, and fail-closed no-partial generation.
- Reject missing/stale/ambiguous/incompatible authority and any output outside the registered page
  set, inheritance chain, assets, or commerce bindings.

### P10B-16 — Coordinated directions and diversity control

- Express Premium Editorial, Modern Technical, and Minimal Commerce only as coordinated compatible
  constraint packages and implement the deterministic fingerprint in section 10.
- Prove exact duplicates and meaningful near duplicates are detected; pairwise generated stores
  differ in structural, narrative, merchandising, responsive, and non-colour Design DNA dimensions.
- Reject colour-only distinction, fixed-template direction authority, incompatible packages, and
  fingerprint exclusions that hide material structure.

### P10B-17 — Responsive, accessibility and performance closure

- Prove all implemented page families/directions at 375, 768, 1024, and 1440 px and EN/FI with
  declared responsive transformations, keyboard/focus/semantics/contrast, and bounded budgets.
- Retain geometry, accessibility, performance, and representative visual evidence correlated to
  exact fingerprints and authority versions.
- Reject clipping, overlap, inaccessible controls, lost content/commerce, desktop-only approval,
  and budget exceptions without explicit disposition.

### P10B-18 — Commercial quality and scale gate

- Deterministically generate at least 100 complete bounded storefront configurations across
  representative catalogue, evidence, asset, locale, page-set, and direction contexts.
- Prove valid complete snapshots, protected-commerce parity, no exact duplicates, thresholded
  near-duplicate control, and distribution across material structural dimensions.
- Retain human commercial review for a representative fingerprint-stratified subset at all four
  widths; automated checks or review of only one polished store cannot close the phase.
- Close only when both commercial quality and meaningful diversity pass. P10B-18 does not claim
  P10C merchant editing, Vesko staging, or production readiness.

## 15. Dependency and parallelization graph

```text
P10B-01
  ├─ P10B-02
  ├─ P10B-03
  └─ P10B-05

P10B-02 + P10B-03
  → P10B-04 responsive image/art direction

P10B-02 + P10B-03 + P10B-05
  → P10B-06 shared frame
    (also consumes P10B-04 where media applies)

P10B-02 + P10B-03 + P10B-04 + P10B-05
  → P10B-07 hero/editorial/campaign/proof

P10B-02 + P10B-03 + P10B-04
  → P10B-08 product card

P10B-05 + P10B-06 + P10B-07 + P10B-08
  → P10B-09 homepage profiles

P10B-04 + P10B-05 + P10B-06 + P10B-08
  → P10B-10 collection/search profiles

P10B-03 + P10B-04 + P10B-05 + P10B-06 + P10B-08
  → P10B-11 PDP profiles

P10B-03 + P10B-04 + P10B-05 + P10B-06 + P10B-07
  → P10B-12 content/support

P10B-03 + P10B-05 + P10B-06 + P10B-08
  → P10B-13 utility presentation

P10B-02…13 minimum accepted capability
  → P10B-14 Premium Editorial complete-storefront slice
  → P10B-15 synthesis/narrative
  → P10B-16 directions/diversity
  → P10B-17 responsive/a11y/performance
  → P10B-18 commercial quality and scale
```

P10B-02 and P10B-03 were delivered in parallel after P10B-01 with disjoint ownership. P10B-04,
P10B-05 and P10B-07 now consume and preserve those boundaries:

- P10B-02 owns `BrandSystem`, semantic projection, and its migrations;
- P10B-03 owns component anatomy/compatibility contracts and their migrations;
- P10B-05 owns site-map, page-family, PageBlueprint profile, and page-set validation contracts.

Later family/profile tasks may use
separate worktrees when their component/profile files do not overlap. Shared registry indexes,
canonical schema exports, migration order, generated manifests, direction registry, synthesis
authority, and common renderer boundaries require one named integration owner and must not be
edited concurrently.

## 16. Evidence and slicing policy

Every implementation task must name its owned files/authority, non-goals, dependencies, positive
cases, fail-closed cases, canonical generation reachability, snapshot preservation, renderer
visibility, responsive evidence, and visual evidence. Tests alone cannot establish commercial
quality.

Use A/B/C slices only when a parent needs separately reviewable contract/anatomy,
renderer/variants, or PageBlueprint/generation/evidence work. A slice cannot mark the parent
complete, relax its minimum coverage, or create temporary competing authority merely to isolate a
PR.

## 17. Locked handoff

P10B-01 through P10B-10 and P10B-13 are Baseline under the disjoint ownership constraints in
section 15. No later implementation task is complete merely because this architecture is approved
or the completed foundations passed.
