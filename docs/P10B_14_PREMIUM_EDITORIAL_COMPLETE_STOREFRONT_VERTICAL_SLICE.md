# P10B-14 — Premium Editorial Complete-Storefront Vertical Slice

**Status:** Baseline

**Date:** 10 August 2026
**Provider calls:** Zero

## Outcome

P10B-14 proves that the merged P10B-01 through P10B-13 authorities converge into one coherent,
commercially credible Lumo Atelier storefront. It is reached through the existing approved-input,
site-map, PageBlueprint, whole-storefront proposal, `StorefrontSnapshot`, persistence, publication
compiler and renderer chain. It adds no template, page graph, component registry, product-card
authority, frame authority, commerce aggregate or renderer.

The representative direction objective is Premium Editorial. It is not a P10B-16 direction
package or fixed template. The slice selects the existing `premiumEditorial` BrandSystem preset and
its canonical Design DNA, the `centered-minimal` P10B-06 shared frame, and these registered profile
authorities:

| Page purpose                            | Route(s)                                               | Registered profile                                    |
| --------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Homepage                                | `/`                                                    | `homepage-editorial-storytelling`                     |
| Collection                              | `/collections/jewellery`                               | `collection-editorial-discovery`                      |
| Search results                          | `/search`                                              | `collection-dense-search`                             |
| Simple and configurable PDP             | `/products/arc-studs`, `/products/custom-halo-ring`    | `pdp-high-consideration`                              |
| About                                   | `/pages/about`                                         | `content-about-story`                                 |
| Contact                                 | `/pages/contact`                                       | `content-contact-channels`                            |
| FAQ                                     | `/pages/faq`                                           | `content-faq-disclosure`                              |
| Shipping and returns                    | `/pages/shipping`, `/pages/returns`                    | `content-service-details`                             |
| Policy                                  | `/pages/policy`                                        | `content-policy-reading`                              |
| Cart and checkout boundary              | `/cart`, `/checkout`                                   | `commerce-utility-cart`, `commerce-utility-checkout`  |
| No-results, empty and recoverable error | `/states/no-results`, `/states/empty`, `/states/error` | the matching registered `commerce-utility-*` profiles |
| Not found                               | `/404`                                                 | `commerce-utility-not-found`                          |

These 17 routes form one P10B-05 site map with exact singleton/cardinality, locale, navigation,
parent-chain and reachability validation. The P10B-13 loading presentation remains a transient
route-local runtime state; it is deliberately not persisted as an eighteenth static page.

## Canonical generation and evidence

The deterministic fixture starts from the approved P9-05A Lumo brief, its approved asset context,
and the unchanged read-only two-product commerce projection. Six P10B-12 pages resolve exact
current fact documents for approved About, contact, FAQ, shipping, returns and policy content.
Missing or stale required facts fail before materialization. The approved brief separately grounds
homepage proof content. No address, opening hours, phone, certification, policy, delivery promise
or product fact is inferred.

```text
approved Lumo brief/facts + read-only catalogue + approved asset presentations
→ P10B-05 site-map materializer
→ P10B-12 factual-page materializer
→ registered P10B-09/P10B-10/P10B-11 profile selections
→ current whole-storefront generation plan
→ current proposal compiler and runtime materializer
→ one 17-route StorefrontSnapshot with static pages plus dynamic commerce archetypes
→ canonical preview/editor/published renderers
→ save/reload and authoritative deterministic publication
```

The homepage consumes P10B-07 hero, editorial, proof and merchandising families. Collection,
search and related merchandising consume the one P10B-08 product-card authority with editorial,
compact and information-oriented anatomy where registered. P10B-04 approved art-direction
presentations preserve asset revision, material fingerprint, crop and focal authority. PDP product
media continues to resolve only from canonical commerce; editorial placements never replace it.

The simple Arc Studs PDP and the configurable Custom Halo Ring PDP use the same
`dynamicProductDetail` authority. The configurable product retains all option groups, dependencies,
incomplete selection, disabled combinations, resolved variant/price/availability and media through
the P6 option-resolution engine. No product-type-specific renderer or product mutation is added.

## Persistence and publication

Focused evidence saves and reloads the complete snapshot and compares its canonical content
fingerprint. Site map, Design DNA, shared frame, profile identities, content documents, component
selections, approved asset lineage, product bindings and utility configuration are preserved.
Transient cart/search/checkout runtime projections and actions are absent from persisted state.

The authoritative manual preparation/confirmation path compiles that saved snapshot, commits the
immutable compiled artifact/version/pointer transaction and retains the same 17-route canonical
snapshot fingerprint. Published rendering uses the same registered component implementations as
editor and preview. No production deployment, Vesko write, save side channel or alternate publish
model is involved.

## Responsive and human commercial evidence

The canonical proof route `/p10b-14-premium-editorial-proof` accepts a route, locale and renderer
target and renders the selected page from the same complete snapshot. It is evidence plumbing, not
a screenshot-only renderer. The dedicated Playwright suite exercises all 17 routes, bounded cart
actions and configurable-product interaction. Fifteen reviewed macOS Chromium baselines are
retained beside the suite:

- homepage, collection and configurable PDP at 375, 768, 1024 and 1440 px;
- About at 1440 px, cart at 375 px and no-results at 1024 px.

Review verified deliberate frame behavior, no horizontal clipping, responsive navigation,
readable hierarchy, usable filters/options/actions, consistent Design DNA, protected merchandising
and coherent content/utility presentation. A high-consideration PDP breakpoint defect that made the
1024 px title column commercially unusable was corrected in the canonical renderer by deferring
the three-column layout until 1200 px.

The retained record uses the existing P10A-07B human commercial-review protocol. Its 160 current
lifecycle/surface/locale/viewport coverage entries bind the exact snapshot, current capability
manifest, home/collection/PDP PageBlueprint materializations, shared-frame profile, BrandSystem,
navigation, commerce and approved-asset fingerprints. The complete-store authority observation
adds the full route/profile/component/art-direction inventory. All eleven required criteria passed:
commercial credibility, hierarchy, discoverability, merchandising, brand consistency, responsive
composition, content/media appropriateness, navigation, conversion clarity, accessibility
observations and cross-page coherence. No blocker or accepted risk remains.

The deterministic P10B-14 evidence manifest records fixture/project identity, snapshot/site-map/
Design-DNA fingerprints, frame authority, all route/family/profile selections, component/anatomy
selections, seven approved evidence authorities, approved asset lineage, commerce references,
publication version/artifact identity, browser evidence and the human-review fingerprint. It is
traceability only and cannot execute or mutate the storefront.

## Fail-closed and compatibility evidence

Focused P10B-14 and affected P10B regression suites reject missing required pages, stale profiles,
incompatible frame/profile/component combinations, invalid Design DNA narrowing, stale or
unapproved facts, wrong media lineage, fabricated commerce, unresolved options, unreachable
navigation, unsupported utility actions and invalid publication compilation before canonical
mutation. Existing P10A/P10B snapshots remain compatible; the golden-store harness now recognizes
the current P10B-06 singular shared-frame model while retaining its legacy-frame compatibility path.

Two upstream convergence gaps were corrected centrally: site-map materialization now validates the
selected shared frame against every current commercial profile authority, and P10B-12 factual pages
can flow through the current whole-storefront plan/proposal lifecycle with their exact localized
content binding and bounded surface override. Search and multiple PDP routes retain their exact
materialized authority without weakening protected commerce.

P10B-16P-01 subsequently converges the collection, search and two PDP routes into compact route
inventory plus maintained collection/search and PDP archetypes in the same snapshot. The 17-route
coverage and retained P10B-14 commercial evidence remain valid; the dynamic routes are no longer
separate editable design pages. See
[`P10B_16P_01_DYNAMIC_COMMERCE_ROUTE_ARCHETYPES.md`](P10B_16P_01_DYNAMIC_COMMERCE_ROUTE_ARCHETYPES.md).

## Deferred work

P10B remains **Partial**. P10B-15 and P10B-16 are Baseline for bounded synthesis, coordinated
directions and diversity control; P10B-16P-01 is Baseline for dynamic route/archetype convergence.
P10B-16P-02 owns the prompted design-plan contract, P10B-16P-03 owns the final Studio generation
journey, P10B-17 owns phase-wide responsive, accessibility and performance closure, and P10B-18
owns repeated 100+ configuration diversity plus representative retained human quality acceptance.
P10C still owns general merchant-facing Storefront Studio editing. Vesko operational adapters and
production deployment remain P11 and P12 work respectively.
