# P10B-16P-01 — Dynamic Commerce Route Archetype Authority

**Status:** Baseline

**Date:** 11 August 2026

**Provider calls:** zero

**Sequence:** P10B-16P-01 → P10B-16P-02 → P10B-16P-03

## Outcome

P10B-16P-01 removes the accidental equation between a concrete commerce URL and an editable
storefront design page. Collection and product URLs remain complete public routes, while `/search`
retains one registered route and presentation authority and receives exact transient result context
from the later P10B-16P-06 adapter.
All three families resolve their design through one versioned, fingerprinted
`dynamicCommercePresentation` authority inside the canonical `StorefrontSnapshot`.

The binding distinction is:

```text
static PageModel
  = one genuinely static editable page and its content

dynamic commerce archetype
  = one maintained editable collection/search or PDP presentation

route inventory entry
  = one concrete URL plus canonical collection/product identity

runtime route page
  = transient archetype + exact current commerce binding
```

A product or collection count change can enlarge the route inventory without enlarging canonical
design-authority cardinality. The same maintained archetype can render many URLs while every URL
retains its own exact canonical commerce data.

## Current-authority audit and correction

Before this task, `materializeStorefrontSiteMap` created a full `PageModel` for every collection,
search, and product route. The complete-storefront materializer then selected a collection or PDP
profile and populated a composite section on every one of those pages. Storefront Studio derived
its outline from `draft.pages`; preview and published route clients found concrete pages by slug;
draft persistence, history, proposal projection, compilation, and publication therefore carried
one copied section tree per commerce route.

That representation mixed two different concerns:

| Concern          | Genuine design authority                                                                                                                                                                     | Runtime/commerce identity                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Page composition | PageBlueprint profile identity/version/fingerprint; component, anatomy and variant; bounded presentation content/props/parameters; responsive, art-direction, frame and Design DNA narrowing | Concrete URL, product ID, collection ID and current canonical revision                          |
| Product truth    | None                                                                                                                                                                                         | Product type, options, variants, SKU, price, availability, stock and canonical product media    |
| Collection truth | None                                                                                                                                                                                         | Collection identity, exact ordered membership, child collections and current canonical revision |
| Editor context   | Archetype selection and its bounded presentation                                                                                                                                             | Representative product or collection chosen only to preview the archetype                       |

P10B-16P-01 converges the genuine design fields into one root authority and retains route and
commerce identities only as resolution inputs. It does not delete routes or replace the canonical
catalogue projection.

## Canonical snapshot model

`StorefrontSnapshot` remains the sole editable aggregate. Its static `pages` array continues to
contain home, content/support, campaign/editorial, policy, and utility pages whose content is
genuinely page-specific. The optional `dynamicCommercePresentation` member carries dynamic
commerce presentation for current snapshots. It is not another snapshot or page graph.

Contract version `1.0.0` contains:

- an authority ID, revision, and recomputed authority fingerprint;
- a compact route inventory of collection, product, and exactly one search route;
- collection/search archetypes and PDP archetypes;
- exact PageBlueprint profile ID, semantic version, and executable fingerprint per archetype;
- compatible/default shared-frame profiles and narrowing-only Design DNA posture;
- exact component slot, component, variant, anatomy, visibility, bounded content/props,
  style overrides, and bounded parameters;
- the canonical 375/768/1024/1440 responsive posture and approved art-direction posture;
- collection-route mappings, product-type mappings, bounded matching rules, and family fallbacks;
  and
- an explicit read-only commerce-binding policy for each dynamic family.

Canonical normalization sorts unordered authority material before fingerprinting. Duplicate route
IDs or paths, duplicate product/collection bindings, unresolved mappings, duplicate deterministic
rule priorities, unknown archetypes, stale fingerprints, and an invalid search or fallback
relationship fail schema validation.

Protected commerce truth cannot appear inside editable archetype design state. Nested route and
membership identities, canonical revisions, SKU/price/stock/availability, variant and option
structures, and canonical product media are rejected rather than becoming presentation authority.

Pre-authority snapshots remain loadable and keep their historical canonical fingerprint shape;
the optional field is omitted rather than serialized as empty compatibility state.

## Collection and search archetypes

The authority reuses the four registered P10B-10 profiles as a small maintained set:

- editorial collection discovery;
- catalogue comparison;
- campaign-led discovery; and
- dense catalogue/search presentation.

Each collection route has exactly one explicit mapping to a collection-compatible archetype.
Bounded context rules record deterministic selection authority for campaign posture, child-
collection availability, catalogue density, and the safe editorial default. Search resolves the
registered search archetype and its family fallback; no-results remains the governed P10B-13
utility relationship rather than a fabricated collection.

The `/search` inventory entry and registered archetype do not themselves create operational search
authority. Runtime materialization requires an exact transient query/result projection from a
first-class canonical adapter. P10B-16P-06 now supplies that projection from the standalone current
`CatalogueDisplayModel`; missing, invalid, stale, or unresolved query/result authority still fails
closed and never substitutes a collection or fabricated membership. A Vesko-backed adapter remains
an explicit P11 integration gap.

At runtime, the selected archetype receives the exact current collection identity, revision, and
ordered membership. It does not own or modify products, child collections, filters, sorting,
prices, availability, stock, or canonical media. Several collection URLs may therefore use one
archetype while rendering different canonical memberships.

## PDP archetypes and product-type mapping

The authority reuses the four registered P10B-11 profiles and adds one governed generic fallback:

- standard commerce;
- configurable/variant-led;
- gallery-led;
- high-consideration; and
- generic fallback using the existing generic canonical option architecture.

Every known canonical product type receives one explicit PDP archetype mapping. Multiple product
types may map to the same archetype. Deterministic migration/materialization considers simple
versus configurable option structure, option-group complexity, canonical media availability, and
high-consideration posture when a current mapping must be derived. An unknown or newly introduced
product type resolves through the generic fallback; it does not create a product-specific design
page or a product-type-specific React implementation.

Runtime binding supplies the exact current product, all generic option groups, variants, SKU,
resolved price, availability, stock, related products, and protected canonical media. Mapping
changes affect presentation only.

## Runtime and renderer resolution

Preview, history, published, and proof routes use the same resolver:

```text
requested URL
  → exact route inventory entry
  → current collection mapping, product-type mapping, search selection or governed fallback
  → current registered PageBlueprint/profile/frame validation
  → transient PageModel projection
  → exact current collection/product binding, or exact transient search query/results
  → existing dynamicCollectionCommerce or dynamicProductDetail renderer
```

The transient `PageModel` preserves compatibility with the one registered renderer pipeline; it is
not stored as a canonical page. A missing URL, commerce identity, archetype, current profile,
compatible frame, or valid presentation fails closed. The route registry and navigation resolver
include route-inventory paths, so removing copied dynamic pages does not remove public collection
or PDP URLs, nor the registered `/search` identity.

For search specifically, the registered archetype and `/search` route remain discoverable, but the
resolver returns a typed failure until exact transient query/result authority is supplied. It does
not bind the first collection as a proxy for search results.

## Storefront Studio projection

Storefront Studio projects static pages plus one transient editor page per collection/search or PDP
archetype. The design outline therefore scales with maintained design authority, not catalogue
size. The projection uses the archetype ID as its editor identity and renders one selected
representative route through the normal component adapter.

The editor distinguishes the archetype from its representative context. A merchant may choose a
representative collection or product to inspect membership, media, options, and responsive
behavior. That selection remains local transient editor state. Editing an archetype validates the
same composite component presentation, increments authority revision, and recomputes the authority
fingerprint; it does not write the representative route or commerce identity into design state.
Search representative state likewise cannot be persisted or synthesized from collection data.

Product-type mappings remain canonical authority, while representative product/type inspection is
only a view over those mappings. Undo/redo, active-draft comparison, and Save operate on the root
`StorefrontSnapshot`, not the projected editor page.

## Persistence, history, compiler, and publication

The lifecycle preserves the root authority as follows:

```text
dynamicCommercePresentation
  → StorefrontSnapshot content fingerprint
  → draft save/reload
  → history/restore
  → deterministic publish compilation
  → immutable compiled publication and receipt
  → concrete collection/search/PDP route resolution
```

Draft persistence performs a complete validated snapshot replacement when the dynamic authority
changes, preventing page-diff persistence from losing a root-level archetype edit. History retains
the exact authority revision, mappings, and fingerprint. Publish compilation validates archetype
components and profiles, includes the exact authority in the immutable compiled result, binds its
fingerprint into compiler authority, migration, receipt, navigation/route, and runtime
fingerprints, and remains compatible with manual and accepted-AI publication.

Compiled artifacts from older snapshots may omit the authority. Current artifacts cannot silently
drop it. Representative editor selections are never persisted or published.

## Deterministic migration and compatibility

`migrateLegacyDynamicCommerceRoutes` loads a valid legacy snapshot, identifies its concrete
collection/search/PDP pages and exact commerce contexts, and converges compatible pages into the
smallest registered authority:

- shared legacy profile/component presentation becomes one archetype presentation;
- collection URLs retain exact collection IDs and explicit route mappings;
- product URLs retain exact primary and related-product bindings while product types receive one
  presentation mapping;
- legacy navigation targets become dynamic-route targets;
- compatible concrete dynamic pages are removed from canonical `pages`; and
- existing static pages, commerce bindings, route paths, profile choices, variants, and historical
  snapshot identity remain intact.

Migration does not pick an arbitrary winner. Unsupported multi-section layouts, missing route
identity, static pages parented to dynamic route pages, materially different presentations sharing
one profile, or incompatible profile choices for one product type return a typed
`requires-decision` result. Historical pre-authority snapshots remain parseable; compilation or
current execution must resolve migration explicitly rather than discarding differences.

Compatibility projections may temporarily expand the root authority into concrete transient pages
for an existing planner/proposal consumer. That projection is derived, write-free, and removed
again before the canonical result is retained. It is not a second page graph or new design
authority.

When an existing whole-storefront proposal is compiled through that compatibility projection, the
reviewed proposal carries an explicit canonical dynamic-commerce migration transition. The
transition is storefront-scoped and binds the exact operation-produced legacy projection, the
resulting canonical projection, and the resulting authority fingerprint. Acceptance recomputes
the migration against current catalogue authority and must reproduce the reviewed storefront
exactly. A provider cannot supply this server-owned transition, and page- or section-scoped
proposals cannot invoke it.

## Cardinality and diversity truth

For the current Karvonen acceptance fixture, nine collection routes and ten product routes remain
available, but they no longer create nineteen independent editable design pages. The maintained
dynamic design set is bounded to four collection/search archetypes and five PDP archetypes,
including the generic fallback. Adding hundreds or thousands of products grows only the compact
route inventory and product-type mapping set where a new canonical type appears.

P10B-15 synthesis and P10B-16 diversity fingerprints now distinguish static page profiles,
dynamic archetype selections, mappings, and route coverage. A second concrete product using the
same PDP archetype is not a second design outcome. Route completeness still matters for generation
and publication, while material diversity is measured from the maintained archetype structure.

## Evidence and boundaries

Acceptance covers contract/schema, deterministic unit, integration, lifecycle, compiler/
publication, and browser/E2E evidence for cardinality, exact commerce/media preservation, product-
type and collection/search mapping, generic fallback, editor projection, migration, save/reload,
history, and concrete preview/published route rendering at 375, 768, 1024, and 1440 px. No provider
or Vesko call is part of this task. The dedicated Playwright suite retains macOS golden baselines
for the Studio archetype outline, two products sharing an archetype, two collections sharing an
archetype, and the configurable PDP at every required width. Cross-platform assertions continue to
prove exact commerce identity, representative-context non-persistence, save/reload, and geometry.

P10B-16P-01 evidence proves registered archetype selection, retained `/search` inventory, P10B-13
no-results relationship, and fail-closed missing-runtime-context behavior. P10B-16P-06 subsequently
adds the first-class transient query/results adapter and makes supported shared-frame search controls
submit to the same `/search` route. It does not change this persisted archetype authority or turn a
query into a `PageModel`.

P10B-16P-01 does not implement the P10B-16P-02 prompted design-plan contract, the P10B-16P-03 final
Storefront Studio prompt-generation journey, individual product/collection design overrides,
P10B-17, P10B-18, P10C general editing, operational commerce, arbitrary code generation, or
repository cleanup.

P10B remains **Partial**. P10B-16P-01 through P10B-16P-05A plus P10B-16P-06 are **Baseline**;
P10B-17 and P10B-18 remain **Planned**, and P10B-16P-05B remains Planned after P10B-18.
P10B-16P-06 claims standalone canonical catalogue search only, not Vesko integration, provider
calls, AI/semantic/vector/fuzzy search, recommendations, personalization, or analytics.

## Accepted P10B-18B-03 search-presentation continuation

P10B-18B-03 keeps this persisted archetype/runtime separation. Catalogue comparison and dense
search are both registered executable transient search presentations; editorial and campaign remain
collection-only. The current frame may narrow an editor projection, but it does not erase a valid
archetype from registry or provider-capability truth. Missing or incompatible selected mappings
still fail closed.

The provider-facing compact capability now synchronizes with P10B-16P-06:
`registered-presentation-authority` plus `canonical-transient-query-results`, `read-only-bounded`
behavior and `p10b-16p-06-canonical-search-adapter`. This is not a persisted query/result model and
does not claim AI, semantic, vector, fuzzy, personalized or Vesko search.
