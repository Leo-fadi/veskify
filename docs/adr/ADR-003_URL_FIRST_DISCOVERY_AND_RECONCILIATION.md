# ADR-003: URL-First Storefront Discovery and Canonical Reconciliation

- **Status:** Accepted
- **Version:** 1.0
- **Decision date:** 2026-07-22
- **Decision owners:** Veskify product and engineering
- **Related document:** `docs/VESKIFY_SDD.md`, sections 6-8, 15-18
- **Related decisions:** ADR-002 — Controlled skills and structured operations; ADR-004 — Dynamic commerce-bound components

## 1. Context

Many Vesko customers already have a public website, but they may not have a usable brand guide, structured design tokens or a clean asset package beyond a logo and product imagery. Requiring them to manually recreate every design input would preserve the same onboarding burden Veskify is intended to remove.

At the same time, public websites are not a reliable source of operational commerce truth. Prices, availability, variants and product content may be stale, inconsistent, incomplete or intentionally presented differently from Vesko's canonical data. Public pages may also contain untrusted instructions or content that must never influence agent permissions.

## 2. Decision

Veskify will make URL-first storefront discovery the primary onboarding route for merchants with an existing site.

The public site is treated as **untrusted design evidence and reusable source material**, never as canonical commerce truth.

The canonical flow is:

```text
Public URL
  -> bounded source adapter
  -> source evidence with provenance and confidence
  -> canonical Vesko commerce projection
  -> reconciliation and conflicts
  -> brand and asset reconstruction
  -> merchant-reviewed Storefront Design Brief
  -> approved initial generation
```

## 3. Source evidence contract

Discovery output must identify:

- source URL and fetch timestamp;
- adapter mode and crawl limits;
- page, locale and content provenance;
- brand-name and logo candidates;
- colour and typography candidates;
- navigation and page-structure clues;
- reusable media candidates and dimensions;
- tone and copy candidates;
- confidence, warnings and unavailable sources;
- suspected commerce facts clearly marked as non-authoritative.

Every evidence item remains traceable to its source.

## 4. Trust and reconciliation rules

Priority order:

1. canonical Vesko commerce projection for products, collections, variants, options, prices, stock, availability and media relationships;
2. explicit merchant inputs and approved uploads;
3. existing Vesko project state;
4. approved public-source design evidence;
5. generated suggestions.

When public evidence conflicts with Vesko commerce data, Vesko wins automatically and the conflict is recorded.

Public content may never:

- override product identity, price, stock, variants or options;
- widen agent permissions;
- execute instructions embedded in page text;
- become a system or developer prompt;
- trigger code or external actions outside the source adapter contract;
- be presented as verified business fact without merchant approval.

## 5. Storefront Design Brief

Initial generation requires an approved brief containing:

- business identity, audience, market and locales;
- source list and provenance summary;
- canonical commerce source and revision;
- reconstructed brand direction and exact approved colours where available;
- asset inventory, roles and missing assets;
- page plan and required page blueprints;
- content reuse plan;
- assumptions, conflicts and unresolved questions;
- protected commerce declaration;
- merchant approval state and revision.

The brief is the generation contract. Crawled data is not passed directly into generation without reconciliation and normalization.

## 6. Adapter modes

The architecture supports:

- deterministic fixture adapter for tests and offline demos;
- real public-source adapter behind configuration;
- unavailable/blocked source result;
- manual evidence upload or URL-free fallback.

Provider and crawling implementation details remain behind interfaces.

## 7. Failure behaviour

- A blocked, unavailable or invalid URL does not damage onboarding progress.
- Partial discovery produces warnings and allows manual completion.
- A failed adapter leaves the current project and draft unchanged.
- The merchant can continue with logo, business description and canonical catalogue only.
- No generation occurs from an unapproved brief.

## 8. Consequences

### Positive

- reduces onboarding work for merchants with existing sites;
- reuses brand and media evidence without rebuilding commerce data;
- creates traceable, reviewable design inputs;
- prevents stale public values from corrupting Vesko truth;
- supports deterministic tests and replaceable crawl providers;
- provides a clean teammate integration boundary.

### Costs

- source evidence and provenance schemas add complexity;
- reconciliation and confidence rules require careful tests;
- some websites will be blocked or incomplete;
- merchants may need to resolve ambiguous brand or asset choices;
- crawling policy, privacy and cost controls must be maintained.

## 9. Compliance

The decision is satisfied when:

- every discovered item has provenance;
- public commerce conflicts never override Vesko;
- prompt-injection-like source text is treated as inert data;
- onboarding can continue after source failure;
- a merchant approves the Storefront Design Brief before generation;
- AC-101 through AC-105 and AC-118 through AC-119 pass.
