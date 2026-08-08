# P10B-05 — Veskify Site-Map and Page-Family Authority

**Status:** Baseline
**Date:** 8 August 2026
**Dependency:** P10B-01 Baseline
**Provider calls:** Zero

## Outcome and ownership

P10B-05 establishes one registered, versioned authority for complete storefront page sets. Veskify
owns page-family selection, canonical routes, navigation placement, parent/child relationships,
locale coverage, PageBlueprint profile references, shared-frame identity, and presentation-page
materialization. Vesko remains the read-only authority for collection/product identity and all
operational cart, checkout, payment, shipping, returns, inventory, tax, and fulfilment behaviour.

The site-map decision is transient. Materialization writes its result into the existing
`StorefrontSnapshot.pages` and `StorefrontSnapshot.navigation` authority; it does not persist a
second page graph, recipe engine, CMS tree, or provider-owned plan. Each governed `PageModel`
retains a compact family/profile/context reference so save, reload, compile, and publication
preserve the exact decision.

## Registered page-family inventory

The versioned `1.0.0` registry contains 19 families:

- commerce/core: home, collection, search/results, and product detail;
- content/support: About, Contact, store locations, FAQ, shipping information, returns
  information, policy/legal, generic content, and campaign/editorial landing;
- commerce utility presentation: cart, checkout, no-results, empty, error, and 404.

Every family declares its canonical `PageModel` type, route class, commerce-context requirement,
allowed PageBlueprint profile reference, navigation eligibility, all-enabled-locales policy,
shared-frame requirement, evidence requirement, omission/failure policy, and commerce-operation
boundary.

P10B-05 registers nine deliberately empty baseline PageBlueprint profiles for page-family and route
proof. They are executable and deterministic but add no component anatomy or commercial visual
claim. Rich content, utility, frame, and commercial profile implementations remain owned by
P10B-03 and P10B-06 through P10B-13.

## Canonical site-map contract

A bounded decision declares:

- one project and canonical EN/FI locale set;
- the registered shared-frame identity;
- stable page keys and registered family/version references;
- canonical safe routes and required/optional status;
- exact PageBlueprint profile/version references;
- existing canonical page IDs where P10A home/collection/PDP state is retained;
- collection/product/search context identities;
- navigation placement and order;
- optional parent keys;
- localized title/SEO coverage;
- approved factual-authority references where required.

New page IDs and navigation IDs derive deterministically from the decision. Materialization is pure,
does not mutate its input or base snapshot, and produces a deterministic site-map fingerprint from
canonical page-family, route, relationship, and navigation state.

## Routing and reachability

The route authority reserves `/`, `/collections/*`, `/products/*`, `/search`, `/pages/*`,
`/campaigns/*`, `/cart`, `/checkout`, `/states/*`, and `/404` for their registered route classes.
Validation rejects unsafe paths, duplicate routes, multiple or missing roots, family/type/route
mismatch, reserved-namespace conflicts, missing parents, parent cycles, navigation to missing pages,
undeclared navigation placement, and navigable pages that are neither linked nor parent-reachable.

Collection pages require a canonical collection ID and its canonical collection slug. PDP pages
require a canonical product ID. Existing section bindings must agree with those identities. Search
uses a separate search context and does not masquerade as a collection identity.

## Evidence-backed support pages

About, Contact, locations, FAQ, shipping, returns, policy/legal, and campaign/editorial families
require approved merchant, Vesko-authoritative, or approved-source-evidence references. An optional
page without that authority is omitted and recorded. A required page without it fails with typed
`missing-evidence` before a snapshot is produced.

The contract therefore cannot invent store addresses, shipping or return terms, guarantees,
certifications, compliance statements, delivery promises, or legal text. Generic content is
materialized only as an empty page-family baseline and makes no factual claim.

Cart, checkout, and state families carry `presentation-only` commerce authority. They cannot claim
operational cart, checkout, payment, inventory, shipping, or order ownership.

## Failure taxonomy

The bounded materializer and canonical validator fail closed for invalid decisions, unsupported or
stale families, stale profiles, unsafe/duplicate/mismatched routes, missing or duplicate homepages,
reserved namespace conflicts, orphan or missing navigation, invalid parents, missing commerce
context, invalid EN/FI coverage, stale shared-frame identity, missing evidence, mixed legacy/new
authority, and utility commerce-authority widening.

No invalid decision mutates the source snapshot or repository. Legacy P10A snapshots with no
page-family references remain valid without implicit migration; governed page sets require every
page to carry the registered authority.

## Lifecycle and compatibility evidence

Deterministic evidence proves:

```text
registered page-set decision
  → live PageBlueprint baseline materialization
  → canonical StorefrontSnapshot pages/navigation
  → repository save/reload
  → deterministic compiler/published projection
```

The complete 19-family EN/FI fixture preserves the existing P10A homepage, collection, and PDP
sections exactly, including protected collection/product identities and commerce bindings. The
compiler preserves every governed page and the canonical navigation shared frame without an AI or
provider call.

## Deferred work

P10B-05 does not implement BrandSystem/Design DNA, component anatomy, rich content/support
renderers, operational utility logic, commercial profile diversity, responsive browser evidence,
or human visual-quality acceptance. Those remain in P10B-02 through P10B-04 and P10B-06 through
P10B-18. No P10C editor wiring is required or claimed.
