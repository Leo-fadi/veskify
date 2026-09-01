# Veskify Software Design Document v1.3.0

## 1. Document control and revision history

| Field                     | Value                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| Document                  | Veskify Software Design Document                                      |
| Version                   | 1.3.0                                                                 |
| Verified baseline         | 31 August 2026, P10B-19A-02 cross-page structural relationship Baseline |
| Merchant-facing product   | Vesko Storefront Studio                                               |
| Internal controlled engine | Veskify                                                              |
| Status                    | Authoritative source specification                                    |
| Overall product status    | **Partial**                                                           |
| Binding decisions         | ADR-001 through ADR-004                                               |
| Delivery plan             | [`VESKIFY_DEVELOPMENT_ROADMAP.md`](VESKIFY_DEVELOPMENT_ROADMAP.md)    |
| Delivery status           | [`VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md`](VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md) |

| Revision | Date | Baseline | Purpose |
| -------- | ---- | -------- | ------- |
| 1.3.0 P10B-19A-02 | 31 August 2026 | P10B-19A-02 cross-page structural relationship baseline | Establish the exact six-role and seven-kind directed relationship vocabulary, strict immutable value object, deterministic key, bounded duplicate rejection and canonical collection ordering without adding relationship records, a registry, graph, PageBlueprint v2 authority, persistence, rendering or current-generation consumers; make P10B-19A-03 the exact next task. |
| 1.3.0 P10B-19A-01 | 31 August 2026 | P10B-19A-01 structural family identity and lifecycle baseline | Establish the exact six-family identity vocabulary, strict supported-major-v1 version and identity contract, deterministic duplicate rejection, candidate/active/deprecated lifecycle policy and active-only selectability without adding family records, a registry, selection, PageBlueprint v2, rendering or current-generation wiring; make P10B-19A-02 the exact next task. |
| 1.3.0 P10B-18D | 24 August 2026 | P10B-18D diagnostic baseline; live quality rejected | Accept the bounded six-call live-AI experiment and safe evidence while rejecting current commercial quality; record exact Concept 2/6 authority collapse, prompt-fidelity failures, evidence limitations and P10B-19 PRE as the next architecture lock without changing production behavior, provider contracts, retry/fallback policy, commerce/media authority or thresholds. |
| 1.3.0 P10B-16P-05B | 23 August 2026 | P10B-16P-05B accepted cleanup | Remove consumer-proven one-time acceptance infrastructure, restore unconditional production fail-closed P04 authority, retain one lean token-protected mock/live P10B-18D seam, and preserve active generation, migration, deterministic quality and protected commerce/media without changing storefront output. |
| 1.3.0 P10B-18C | 22 August 2026 | P10B-18C accepted implementation and evidence | Accept the deterministic 9 x 14 complete-store matrix, 126/126 replay and protected-state result, 54 material topologies, deterministic 28-store selector, final 280-entry four-width EN/FI review and canonical lifecycle as the current commercial-quality baseline; preserve first-run failures and frozen P10B-18A/P10B-18B evidence while leaving live-AI acceptance to P10B-18D. |
| 1.3.0 P10B-18B-04 | 19 August 2026 | P10B-18B-04 accepted implementation | Add bounded exact-product PDP matching, four purposeful compositions, stronger purchase/configuration hierarchy, bounded canonical galleries, resolver-safe failure behavior and cardinality-aware related merchandising; retain protected variants/options/prices/media, canonical lifecycle/publication authority and 20 reviewed captures without accepting content/utility or complete-storefront commercial quality. |
| 1.3.0 P10B-18B-03 | 18 August 2026 | P10B-18B-03 accepted implementation | Strengthen the four existing collection/search profiles and five canonical card anatomies with bounded cardinality, useful facet/filter hierarchy, proportional orientation/grid composition, distinct executable comparison/dense search, truthful semantic discovery causality and synchronized provider-facing canonical-search capability; retain protected commerce/media, lifecycle and publication authority and 21 reviewed captures without accepting complete-storefront quality. |
| 1.3.0 P10B-18B-02 | 18 August 2026 | P10B-18B-02 accepted implementation | Strengthen the six existing homepage profiles and shared hero/editorial/campaign/proof renderer with explicit transition authority, truthful story/catalogue semantic causality, asset-aware rich/sparse progression and observable hierarchy; retain 72-case structural accounting and 14 reviewed captures while preserving protected commerce/media, snapshot/lifecycle and publication authority and leaving later page-family and P10B-18C quality gates incomplete. |
| 1.3.0 P10B-18B-06 | 17 August 2026 | P10B-18B-06 accepted implementation | Select approved presentation assets by exact purpose affinity, enforce bounded reuse, pair approved responsive sources/crops, consume an approved shared-frame logo and material art direction, preserve historical responsive-image and protected product-media authority, and retain an accepted 13-capture checkpoint without accepting complete-storefront commercial visual quality. |
| 1.3.0 P10B-18B-01 | 17 August 2026 | P10B-18B-01 accepted implementation | Materialize bounded within-direction Design DNA density, correct semantic influence claims, make the existing compact-technical frame truthfully complete-store reachable, refine all four shared frames, preserve protected commerce/media and lifecycle authority, and retain a focused accepted 17-capture checkpoint while leaving parent P10B-18B/P10B-18/P10B Partial and P10B-18C unproved. |
| 1.3.0 P10B-18A | 16 August 2026 | P10B-18A accepted audit | Accept the deterministic 72-case commercial-authority audit and retained 18-store/108-capture human review as the current ceiling diagnosis; freeze six conditional P10B-18B source-authority packages while leaving parent P10B-18 Partial, P10B-18B/P10B-18C Planned, and the 100+ quality gate unproved. |
| 1.3.0 P10B-17 | 16 August 2026 | P10B-17 delivery | Execute existing registered responsive authority across 375/768/1024/1440 px and EN/FI; close shared-frame, homepage, collection/search, PDP, content/support, and utility geometry; preserve keyboard/focus/semantic/contrast behavior and protected commerce/media; enforce deterministic rendering, media, search, and build budgets; and retain bounded browser and human visual evidence without claiming P10B-18 designer-grade quality, Vesko staging, or production readiness. |
| 1.3.0 P10B-16P-06 | 15 August 2026 | P10B-16P-06 delivery | Add one provider-neutral transient product-search contract and standalone `CatalogueDisplayModel` adapter; execute the persisted `/search` route and selected registered presentation across draft, proposal, saved/history, and published targets; preserve exact product links, EN/FI behavior, protected commerce/media, and lifecycle non-persistence; and keep Vesko/AI/semantic/fuzzy search outside the claim. |
| 1.3.0 P10B-16P-05A | 15 August 2026 | P10B-16P-05A delivery | Make one canonical semantic initial-generation route and composition explicit, reduce the prompted compiler to one coordinator/resolver/decision/executor chain with one materialization boundary, remove the active P10B-16L runtime and executable-intent path, isolate retained P9/Lumo evidence, and preserve the production-disabled P10B-16P-04 acceptance composition through P10B-18. |
| 1.3.0 P10B-16P-04 | 15 August 2026 | P10B-16P-04 delivery | Prove the bounded semantic Design Intent path through the normal production-disabled Storefront Studio with separately authorized real OpenAI A/B/C evidence, deterministic exact compilation and one materialization per successful prompt, clean A/B rejection, full C accept/undo/redo/save/reload/preview lifecycle, protected commerce/media parity, retained human review, and explicit P10B-16L compatibility disposition. |
| 1.3.0 P10B-16P-03 | 12 August 2026 | P10B-16P-03 delivery | Connect normal Storefront Studio whole-storefront generation to standalone/mock server authority and P10B-16P-02B compilation, bind one registered operation to exact source/compiler lineage and retained evidence, fail integrated requests closed pending P10B-16P-04 authenticated authority, and prove the mocked review/lifecycle/preview journey with zero real-provider calls. |
| 1.3.0 P10B-16P-02B | 12 August 2026 | P10B-16P-02B delivery | Refresh and validate exact prompted authority, resolve complete material intent through a bounded metadata-only compatibility solver, compile exact Design DNA/frame/PageBlueprint/dynamic-commerce/component selections and diagnostics, and consume the result once through canonical P10B synthesis and isolated proposal authority with zero provider calls. |
| 1.3.0 P10B-16P-02A | 11 August 2026 | P10B-16P-02A delivery | Establish the strict transient provider-safe capability projection, prompted request, preference-rich Design Intent V2, exact capability-reference validation, deterministic fingerprints, server-only OpenAI adapter and safe mocked-transport evidence without compiling or materializing a storefront before the provider response. |
| 1.3.0 P10B-16P-01 | 11 August 2026 | P10B-16P-01 delivery | Separate static design pages, maintained collection/search and PDP archetypes, and concrete commerce route inventory inside one fingerprinted `StorefrontSnapshot`; add deterministic mapping/migration, transient Studio/runtime projections, lifecycle/compiler/publication preservation, and exact route rendering without per-product or per-collection design documents. |
| 1.3.0 P10B-15 | 10 August 2026 | P10B-15 delivery | Generalize complete-store generation into one versioned deterministic bounded synthesis and cross-page narrative authority with exact evidence, commerce, asset, Design DNA, page/profile/frame/component fingerprints; three complete outcomes; lifecycle publication; browser evidence; and retained human review. |
| 1.3.0 P10B-16 | 10 August 2026 | P10B-16 delivery | Register Premium Editorial, Modern Technical and Minimal Commerce as versioned narrowing packages; add deterministic direction/diversity fingerprints, duplicate and near-duplicate classification, bounded repetition avoidance, nine representative complete outcomes and retained browser/human evidence. |
| 1.3.0 P10B-14 | 10 August 2026 | P10B-14 delivery | Prove one 17-route Premium Editorial storefront through current Design DNA, site-map, profile, proposal, snapshot, persistence, publication, canonical renderer, four-width browser and retained human-review authority. |
| 1.3.0 P10B-10 | 9 August 2026 | P10B-10 delivery | Establish four fingerprinted commercial collection/search PageBlueprint profiles with exact canonical commerce, product-card and media authority, transient fail-closed zero-result context, deterministic lifecycle reachability, and retained four-width browser evidence. |
| 1.3.0 P10B-11 | 9 August 2026 | P10B-11 delivery | Establish four fingerprinted commercial PDP PageBlueprint profiles inside the canonical dynamic PDP runtime, retain generic canonical option/media/card authority, ground optional high-consideration support in approved evidence, preserve lifecycle/publishing, and provide four-width browser evidence. |
| 1.3.0 P10B-12 | 9 August 2026 | P10B-12 delivery | Establish fifteen fact-bound content/support PageBlueprint profiles with approved-evidence rejection, canonical page-family, locale, navigation, snapshot, compiler, renderer, and browser evidence. |
| 1.3.0 P10B-13 | 9 August 2026 | P10B-13 delivery | Establish six fingerprinted commerce-utility PageBlueprint profiles plus route-local loading state with transient read-only cart/checkout/search/runtime state, fail-closed executable actions, snapshot configuration preservation, and retained four-width browser evidence. |
| 1.3.0 P10B-09 | 9 August 2026 | P10B-09 delivery | Establish six fingerprinted commercial homepage PageBlueprint profiles with evidence/cardinality authority, exact frame/story/card composition, deterministic lifecycle reachability, and retained four-width browser evidence. |
| 1.3.0 P10B-07 | 8 August 2026 | P10B-07 delivery | Establish commercial-ready hero, editorial, campaign, service and evidence-grounded proof families with six meaningful hero anatomies, canonical art direction, PageBlueprint generation reachability, lifecycle preservation and four-width browser evidence. |
| 1.3.0 P10B-08 | 8 August 2026 | P10B-08 delivery | Establish one fingerprinted product-card authority and renderer, five meaningful anatomies, exact protected-commerce and P10B-04 media lineage, deterministic legacy migration, generation/publish reachability, and four-width browser evidence. |
| 1.3.0 P10B-06 | 8 August 2026 | P10B-06 delivery | Establish one canonical root shared-frame authority with four structural profiles, three mobile modes, four footer compositions, exact commercial-anatomy selection, cross-page/lifecycle preservation, and retained four-width browser evidence. |
| 1.3.0 P10B-04 | 8 August 2026 | P10B-04 delivery | Establish one versioned responsive image/art-direction authority with exact lineage, normalized geometry, Design DNA/anatomy narrowing, protected product media, deterministic fallback/fingerprint/migration, shared semantic rendering, and four-width evidence. |
| 1.3.0 P10B-05 | 8 August 2026 | P10B-05 delivery | Establish registered page-family, route, navigation, evidence, locale, shared-frame, deterministic site-map materialization, and lifecycle authority without a second page graph or component-anatomy claim. |
| 1.3.0 P10B-03 | 8 August 2026 | P10B-03 delivery | Establish typed semantic anatomy, structural-difference validation, conservative complete registry classification, generated commercial-capability queries, and deterministic anatomy migration without falsely promoting current variants. |
| 1.3.0 P10B-02 | 8 August 2026 | P10B-02 delivery | Establish canonical parametric Design DNA, deterministic legacy BrandSystem migration, semantic renderer projection, contrast-safe colour authority, and bounded cross-page foundations. |
| 1.3.0 P10B-01 | 8 August 2026 | P10B-01 delivery | Establish the closed, owned, narrowing-only commercial grammar, generated query authority, deterministic migration, compatibility language, and typed fail-closed evidence; make P10B Partial. |
| 1.3.0 P10B lock | 7 August 2026 | `cd7b25a`, current `main` after merged PR #171 | Lock the complete-storefront generation architecture, broaden the P10B phase name, and replace its provisional 12-task plan with 18 implementation-ready tasks. |
| 1.3.0 closure sync | 7 August 2026 | `3d36f54`, current `main` after merged PR #170 | Close P10A from current governed-provider, accepted-receipt, atomic-publication, rollback, and correlated publication evidence; make Planned P10B the next active phase. |
| 1.3.0 | 6 August 2026 | `27e08a0`, current `main` after merged PR #165 | Consolidate verified product truth, current architecture, commercial-design work, Studio ownership, and Vesko contract readiness. |
| 1.2.2 | 31 July 2026 | Historical source and DOCX export | Preserve the earlier commercial-vocabulary amendment and its historical evidence context. |

This document replaces the v1.2.2 source specification as the consolidated statement of current
product truth and approved architecture. Historical task reports and evidence records remain
historical. They do not override current code, contracts, tests, accepted evidence, ADRs, this
specification, or the current roadmap.

The synchronized human-readable export is
[`VESKIFY_SDD_v1.3.0.docx`](VESKIFY_SDD_v1.3.0.docx). The superseded v1.2.2 export is retained only
as [`archive/VESKIFY_SDD_v1.2.2.docx`](archive/VESKIFY_SDD_v1.2.2.docx) historical evidence.

### 1.1 Status and evidence vocabulary

Every capability uses exactly one implementation status:

- **Baseline** — implemented through the canonical lifecycle with sufficient evidence for its
  stated outcome;
- **Partial** — real implementation exists, but merchant delivery, reachability, or required
  evidence is incomplete;
- **Planned** — approved future work without a current implementation claim;
- **Deprecated** — compatibility-only implementation intended for retirement or migration;
- **Blocked** — unsafe to proceed without an unresolved authority, contract, or external system.

Evidence is classified separately as contract/schema, deterministic unit, integration,
browser/E2E, real-provider, retained human visual review, Vesko staging, or production. A higher
implementation status does not manufacture a stronger evidence level. Deterministic fixtures are
not real-provider, human visual, staging, or production evidence.

## 2. Executive product truth

Veskify is a controlled storefront-design engine. It is not a general website generator and not a
commerce system. The repository contains a substantial deterministic foundation: canonical
storefront state, registered capabilities, PageBlueprint materialization, governed initial and
follow-up proposal execution, strict internal scope authority, editing adapters, history, draft
persistence, an authoritative publishing gateway, a deterministic publish compiler, and published
home, collection, and product-detail rendering.

The product remains **Partial**. Phase 9 is closed by product-owner handoff, and P10A grounded
orchestration and publishing is **Baseline / closed** under the formal
[`P10A_PHASE_CLOSURE.md`](P10A_PHASE_CLOSURE.md) exit audit. P10B is now **Partial / active**:
P10B-01 commercial grammar, P10B-02 parametric BrandSystem / Design DNA, P10B-03 component anatomy,
P10B-04 responsive image/art-direction authority, P10B-05 site-map/page-family authority, P10B-06
commercial shared-frame families, P10B-07 hero/editorial/campaign/proof families, P10B-08
canonical product-card authority, P10B-09 commercial homepage profiles, and P10B-10 commercial
collection/search profiles, P10B-11 commercial PDP profiles, P10B-12 content/support page families,
P10B-13 commerce utility presentation, the P10B-14 Premium Editorial complete-storefront vertical
slice, the P10B-15 bounded synthesis engine, P10B-16 direction/diversity authority, and
P10B-16P-01 dynamic commerce route archetype authority, P10B-16P-02A prompted Design Intent V2
authority, P10B-16P-02B deterministic intent compilation/canonical proposal materialization, and
P10B-16P-03 normal Studio prompted generation, P10B-16P-04 real-provider acceptance,
P10B-16P-05A active-path/compiler rationalisation, P10B-16P-06 canonical search query/results
authority, P10B-17 responsive/accessibility/performance closure, the accepted P10B-18A
commercial-authority audit, accepted P10B-18B-01 Design DNA/shared-frame upgrade, accepted
P10B-18B-06 asset-composition/art-direction upgrade, accepted P10B-18B-02
homepage/editorial/campaign quality upgrade, accepted P10B-18B-03 collection/search/product-card
quality upgrade, accepted P10B-18B-04 PDP quality upgrade and accepted P10B-18B-05
content/support/utility quality upgrade are Baseline. P10B-16P-02 is Baseline; parent P10B-18B is
Baseline/complete. P10B-18C and P10B-16P-05B are Baseline. P10B-18D is a Baseline diagnostic with
live commercial quality rejected. P10B-18 and P10B remain Partial pending P10B-19. P10B-19 PRE is
Baseline. P10B-19A-01 and P10B-19A-02 are Baseline, parent P10B-19A is Partial, and P10B-19A-03 is
the exact next task. The current
merchant editor does not yet expose the governed routing and scoped editing authorities; that is
intentionally P10C work, not a P10A closure requirement.

The current visual ceiling is a clean, responsive catalogue storefront with useful commerce depth
but limited brand distinction. P10B is the first phase allowed to claim a commercially credible
generation system. The next major customer milestone is:

> Generate a complete storefront that a serious retailer can publish without a designer rebuilding
> it.

Vesko's OpenAPI 3.0 contract has been obtained and audited. It exposes useful store, catalogue,
media, inventory, Puck, and storefront product surfaces, but is insufficient for safe production
integration. Typed responses, security and tenancy authority, revision semantics, navigation and
synchronization contracts, and canonical Veskify draft/history/publication APIs remain unresolved.
There is no Vesko staging or production evidence.

## 3. Mission and product boundary

### 3.1 Mission

Vesko Storefront Studio lets a retailer combine approved website and brand evidence, product media,
and canonical Vesko commerce data; approve a storefront brief; generate and improve a complete
storefront through controlled edits; and explicitly save, preview, and publish it.

The product reduces the design and composition burden of Vesko onboarding. It serves merchants who
may have a logo and product imagery but no complete design system. Jewellery and watches remain the
first deep reference domain, while the architecture must safely support unknown product types.

### 3.2 Veskify authority

Veskify owns storefront creation, presentation, and composition:

- site-map decisions, page creation, routes, navigation, shared frame, projects, brand systems,
  pages, sections, snapshots, drafts, and history;
- homepage, collection/category, PDP, About/brand-story, Contact/locations, FAQ,
  shipping/returns/policy, campaign/editorial, generic content, search/results, cart, checkout,
  empty, error, and 404 presentation;
- registered component families, meaningful variants, slots, and bounded parameters;
- PageBlueprints and registered profiles;
- presentation bindings and product-presentation contexts;
- source evidence, asset inventory, approved asset roles, and storefront design briefs;
- governed storefront synthesis, skills, plans, operations, proposals, acceptance, and restoration;
- deterministic publication compilation and Veskify publication authority;
- editor, preview, and published-renderer projections.

### 3.3 Vesko authority

Vesko owns operational commerce and sellability. Veskify consumes these facts read-only and must
never mutate or replace:

- product, variant, option, and SKU identity;
- canonical product type and attributes;
- price, compare-at price, stock, availability, and inventory;
- canonical product and variant media;
- cart and checkout operations, orders, payments, shipping, tax, returns, logistics, and
  merchant/store operational facts.

Public source evidence can inform presentation but cannot override Vesko commerce truth. Generated
copy must not invent materials, certifications, policies, service claims, guarantees, delivery
promises, compliance facts, availability, or price facts. Legal/policy/service presentation
requires approved merchant or Vesko evidence.

### 3.4 Explicit product boundary

Veskify is not a catalogue importer, product-information manager, inventory agent, arbitrary code
generator, merchant-specific component factory, unrestricted CMS, or replacement for Vesko
services. AI may select and parameterize registered authority. It may not generate executable
React, HTML, CSS, JavaScript, scripts, shaders, or arbitrary Three.js implementations.

## 4. Canonical architecture

### 4.1 Authority flow

The canonical storefront lifecycle is:

```text
approved evidence and read-only Vesko commerce
  → Veskify site-map and page-set decision
  → bounded BrandSystem / Design DNA
  → registered PageBlueprint profile per static page or maintained dynamic archetype
  → compatible component family and meaningful structural variant
  → bounded validated parameters
  → approved asset placement and art direction
  → narrative and compatibility validation
  → complete StorefrontSnapshot
  → preview
  → explicit publish
```

`StorefrontSnapshot` is the sole canonical editable aggregate across generation, editing, preview,
save, history, restore, and publication. Planner payloads, proposals, Puck data, compiler input, and
renderer projections are transient. No task may introduce a second page graph, storefront plan,
component inventory, blueprint engine, asset inventory, commerce model, or publish model.

### 4.2 Architectural layers

1. **Domain contracts** define projects, `BrandSystem`, `StorefrontSnapshot`, commerce projections,
   bindings, proposals, receipts, and publication records without UI, provider, or Puck types.
2. **Registered capability platform** defines component families, variants, fields, slots,
   migrations, PageBlueprints, profiles, render targets, and generated queryable manifests.
3. **Application authorities** resolve briefs, route governed requests, compile proposals, apply
   acceptance, manage draft/history, and compile publications.
4. **Adapters** isolate providers, Puck, browsers, files, databases, Vesko, media, discovery, and
   publishing transports.
5. **Renderers** project the same canonical snapshot into editor, preview, and published routes.

### 4.3 Binding architecture decisions

- **ADR-001:** Puck is an isolated editor foundation, not canonical state or persistence.
- **ADR-002:** AI is a controlled design agent producing validated structured operations.
- **ADR-003:** URL discovery is untrusted evidence with provenance and reconciliation.
- **ADR-004:** commerce components bind dynamically to canonical projections and preserve every
  available option group through a generic fallback architecture.

## 5. Current verified capability baseline

The current baseline is code-grounded in the capability evidence ledger and truth audit.

| Capability area                                      | Status      | Verified truth                                                                 |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| Canonical storefront and brand contracts             | **Baseline** | `StorefrontSnapshot` and `BrandSystem` govern editable presentation state.     |
| ComponentDefinitionV2 and generated manifest         | **Baseline** | Registered definitions are runtime-queryable without a parallel inventory.     |
| PageBlueprint profiles and materialization           | **Baseline** | Registered profiles materialize canonical page composition.                    |
| Site-map and registered page-family authority        | **Baseline** | Nineteen registered families materialize deterministic canonical pages/navigation with route, locale, evidence, context, and lifecycle validation. |
| Dynamic collection and PDP commerce presentation     | **Baseline** | Canonical bindings, option groups, variants, media, price, and availability render safely. |
| Canonical storefront query/results search             | **Baseline** | One persisted `/search` presentation executes through transient current-catalogue results across draft, proposal, saved/history, and published targets without persisting query/result state. |
| Source evidence, asset inventory, and approved brief | **Baseline** | Provenance and protected-commerce reconciliation are contracted and tested.    |
| Governed initial generation                          | **Partial**  | Internal authority exists; normal merchant editor reach is P10C work.           |
| Governed follow-up editing                           | **Partial**  | Internal authority exists; normal merchant editor reach is P10C work.           |
| Strict scope routing                                 | **Partial**  | Internal fail-closed authority exists; merchant clarification UI is P10C work.  |
| Proposal review, atomic acceptance, undo/redo        | **Baseline** | Canonical lifecycle and stale/invalid rejection are deterministically covered.  |
| Puck/editor projection                               | **Partial**  | Real adapter and editor exist; the full merchant-operable Studio chain is incomplete. |
| Draft save, history, and restore                     | **Baseline** | Standalone canonical persistence and lifecycle evidence exist.                  |
| Controlled real-provider acceptance                  | **Baseline** | One authorized initial case and then one hero follow-up case passed with two total calls and no retry. |
| Accepted-AI receipt-to-gateway composition           | **Baseline** | Server acceptance mints durable create-once authority used by active prepare/confirm. |
| Authoritative merchant publishing gateway            | **Baseline** | Server-side auth, permission, preparation, confirmation, and idempotency exist. |
| Deterministic publish compiler                       | **Baseline** | Exact snapshot and live authority compile to deterministic immutable output.    |
| Compiled-artifact persistence and rollback           | **Baseline** | One atomic transaction retains immutable artifacts, versions, history, operations, and active pointers; rollback restores a new draft before explicit republish. |
| Published home, collection, and PDP rendering        | **Baseline** | Canonical published routes bind the exact active compiled version, artifact, and snapshot for manual and accepted-AI publication. |
| Commercial storefront generation system              | **Partial**  | P10B-01 through P10B-17 and the P10B-16P convergence sequence establish the single bounded complete-store authority. Accepted P10B-18A freezes the 72-case ceiling diagnosis; completed P10B-18B adds the six bounded source/consumer quality packages; accepted P10B-18C proves 126/126 deterministic complete-store compiles and replays, protected commerce/media, 54 material topologies, one deterministic 28-store selector and a hash-bound 280-entry four-width EN/FI review with no primary visual FAIL. P10B-18D completed the bounded live diagnostic, but live commercial quality was rejected; P10B-18 and P10B remain Partial pending P10B-19. |
| Vesko reference integration                          | **Blocked**  | OpenAPI exists but is incomplete and no staging authority or evidence exists.   |
| Authentication, tenancy, observability, deployment   | **Partial**  | Foundations exist; production service closure belongs to P11/P12.               |

Phase 9 is closed by product-owner handoff. Its retained records remain evidence with their stated
limits; closure does not convert deterministic or narrow human review into current commercial,
real-provider, staging, or production proof.

## 6. AI generation and editing governance

### 6.1 Required lifecycle

All AI-assisted design changes follow:

```text
merchant instruction
  → normalized intent and explicit scope
  → authorized initial or follow-up skill package
  → structured operations
  → schema and semantic validation
  → protected-commerce and authority guards
  → isolated proposal transaction
  → merchant review
  → accept, revise, or reject
  → explicit save or publish
```

Provider output is untrusted data. Unknown operations, fields, components, variants, bindings,
assets, profiles, or parameters fail closed. Invalid, failed, stale, or rejected proposals leave
the active draft and history unchanged. Whole-storefront proposals apply and undo atomically.

### 6.2 Package and routing authority

Initial generation and follow-up editing use distinct governed packages with different permissions,
input authority, and evidence requirements. The strict router resolves selected-section,
current-page, shared-frame, and whole-storefront scope. Ambiguous requests require clarification;
they must not silently broaden scope.

P10A owns these internal authorities and their functional evidence. P10C owns their
merchant-operable presentation in Storefront Studio: routing feedback, clarification UI,
frame/page scope controls, and execution from the normal editor. Merchant-facing wiring is not a
P10A closure requirement.

### 6.3 Parameters and providers

Only registered bounded parameters may be expressed. Unsupported canonical runtime projection
must fail with a typed deterministic error before proposal compilation; parameters may never be
silently discarded. Provider-specific request and response formats stay behind adapters. The
deterministic provider remains the default for reliable tests.

P10A-07C-03R controlled real-provider acceptance completed on 7 August 2026 through an explicitly
authorized eligible trusted OpenAI configuration. One initial-generation case succeeded before one
hero follow-up case; each used one provider call, neither retried, safe evidence was retained, and
no save or publication occurred.

The later P10B-16L OpenAI path is retained only as Deprecated historical compatibility evidence.
Its authorized call used the earlier v1 direction/posture contract, completed the strict provider
result, and then failed coordinated synthesis with safe code `malformed-state`. Its corrected v2
bridge pre-executed and materialized compatible storefront candidates before asking the provider to
select an advertised `executableIntentId`, but made zero live calls. P10B-16P-05A removed that active
runtime, its routes/providers, and all product-path consumers. Neither path is prompt-driven
storefront generation. P10B-16P-02A instead defines a strict non-executable
preference-rich Design Intent V2 before any complete-store execution. P10B-16P-02B now compiles
that result deterministically and invokes canonical synthesis/proposal materialization only after
successful compilation. Both slices made zero provider calls in their own delivery.

P10B-16P-04 subsequently completed the normal production-disabled Studio acceptance with the
server-only `openai-prompted-storefront-design-intent-v2` provider and `gpt-5.6-sol`. The cumulative
P10B-16P-04 investigation and acceptance ledger is 16 real calls with zero retries or fallbacks.
The final A/B/C calls each returned one valid bounded semantic intent, compiled one exact decision,
and materialized once. A and B were rejected cleanly; C completed Accept, Undo/Redo, explicit Save,
reload, and normal Preview. Publication remained separate, search execution remained fail closed,
and protected commerce and canonical product media remained unchanged. The distinct P10B-16L
historical call is not part of that 16-call ledger.

## 7. Component, PageBlueprint and direction model

### 7.1 One registered capability platform

`ComponentDefinitionV2` is the canonical component definition. Its generated capability manifest
must be derived from live definitions and expose versions, families, meaningful variants, slots,
fields, bindings, permissions, renderer identities, and migrations. Planners, compilers, editors,
and renderers query this authority; they do not maintain duplicate component inventories.

Composite collection and product-detail PageBlueprint slots resolve through their canonical
runtime owners, including `dynamicCollectionCommerce` and `dynamicProductDetail`. Shared-frame and
page selections bind to exact materialized slots. A registered but different variant is not an
equivalent authority.

### 7.2 PageBlueprint authority

A commercial page recipe is only a registered constrained `PageBlueprint` profile. It may define
permitted and default slots, component/variant compatibility, order, omission/fallback rules,
bindings, assets, responsive constraints, and bounded parameters. It never becomes another page
tree, template runtime, or independently executable recipe engine.

Materialization produces the exact canonical slots that proposal compilation, snapshot storage,
editor projection, preview, and publication preserve. Optional authority may be inferred only from
the exact current executable materialization; stale, unknown, or ambiguous authority fails closed.

### 7.3 Design inheritance

The exact inheritance chain is:

```text
BrandSystem
  → registered PageBlueprint profile
  → compatible component family and meaningful variant
  → bounded validated instance override
```

`BrandSystem` owns global semantic presentation tokens. A PageBlueprint profile constrains page
composition. A family and variant provide a maintained renderer implementation. An instance
override may alter only registered bounded values. Direction packages select compatible
combinations across this chain; they are not a second token system, recipe authority, or page
authority.

### 7.4 Responsive and dynamic commerce rules

The same registered implementation renders in editor, preview, and published routes. Components
must be keyboard accessible and responsive at 375, 768, 1024, and 1440 px. Product pages render
all option groups supplied by canonical commerce, resolve selected variant price, availability,
and media without mutation, handle incomplete and unavailable selections, and retain unknown
attributes through a safe generic fallback.

Concrete collection, search, and product URLs are runtime route instances, not independently
editable design authorities. Static pages remain canonical `PageModel`s. Dynamic commerce
presentation is a versioned, fingerprinted member of the same `StorefrontSnapshot`: it owns a
small maintained set of collection/search and PDP archetypes plus product-type/collection mappings
and fallbacks, while a compact route inventory retains only each URL and canonical commerce
identity. Runtime resolves the current mapping, validates the exact registered profile/frame/
component authority, and binds current protected commerce into a transient renderer projection.

The `/search` route and selected archetype are registered persisted presentation authority.
P10B-16P-06 supplies the separate first-class transient query/results authority: a provider-neutral
read-only port and standalone `CatalogueDisplayModel` adapter derive exact current public
product-route IDs for validated EN/FI query, supported filter/sort, and page state. The same
`dynamicCollectionCommerce`, product-card, frame, orientation/no-results, and dynamic PDP route
authorities render the result. Query text, filters, sort, page, result IDs, and result count remain
runtime-only and never enter `PageModel`, `StorefrontSnapshot`, history, compiled design authority,
or publication records as editable state. Missing, invalid, stale, or unresolved runtime authority
still fails closed and never substitutes a collection.

### 7.5 Registered `dynamicCollectionCommerce` contract

The registered `dynamicCollectionCommerce` component uses a required, revision-bound
`primaryCollection` binding for the exact canonical collection identity and revision, and a
required, revision-bound `collectionProducts` binding for its exact canonical ordered product
membership. Where applicable, the optional `childCollections` binding carries the ordered
canonical child-collection list. Filtering and sorting interactions emit typed presentation intents
rather than mutating canonical commerce truth. Collection membership, price, stock, availability,
and canonical media remain protected, and the same registered component renders through editor,
preview, and published targets.

### 7.6 Registered `dynamicProductDetail` contract

The registered `dynamicProductDetail` component uses a required, revision-bound `primaryProduct`
binding for the exact canonical product identity and revision. Its optional `relatedProducts`
binding carries the ordered canonical related-product list, while `productMedia` remains the
canonical protected product-media authority.
Option selection uses the existing P6 option-resolution engine. The component emits typed selection
and primary-action intent rather than mutating price, SKU, stock, availability, variants, or media.
Unsupported or unknown option structures retain the generic option architecture, and the same
registered component renders through editor, preview, and published targets.

## 8. State, editor and lifecycle

### 8.1 Canonical state

`StorefrontSnapshot` contains the editable brand system, shared frame/navigation, static pages,
sections, dynamic commerce presentation authority, bindings, presentation references, revisions,
and provenance needed by the controlled lifecycle. `PageModel` is a member of that aggregate, not
a competing canonical graph. A transient dynamic route or editor projection may use the
`PageModel` renderer contract, but it is derived from an archetype plus exact route commerce and is
not persisted as another page.

Draft mutation occurs only through validated commands and proposal acceptance. Every operation is
scoped, reversible where required, and correlated to the current revision. A stale operation must
not partially apply.

### 8.2 Puck boundary

Puck provides selection, insertion, drag-and-drop, reordering, fields, canvas mechanics, and
viewport controls. Direct Puck types remain inside `src/integrations/puck`. Puck data is transient
adapter state. Raw Puck payloads, including Vesko's current `/puck` surface, are incompatible with
canonical `StorefrontSnapshot` persistence and cannot become a save, history, or publication API.

### 8.3 Merchant lifecycle

Save draft and Publish changes remain distinct explicit actions. Editor, preview, history, restore,
and publication must preserve the same canonical content and bindings. P10C closes the full
merchant chain:

```text
select frame
  → manual edit
  → bounded AI edit elsewhere
  → add/remove/reorder
  → undo/redo
  → save
  → preview
  → publish
```

The minimum pilot editor requires the asset library, canonical Puck boundary, stable frame identity,
approved manual operations, the required Storefront Studio shell subset, and working save,
preview, and publish actions.

## 9. Publishing architecture

### 9.1 Authoritative gateway

The browser may request and confirm publication but cannot publish directly, advance a pointer, or
construct trusted accepted-AI authority. The server authenticates the merchant, checks the
`publishStorefront` permission, resolves current project and draft authority, stores a bounded
preparation, and invokes the authoritative `StorefrontPublishingGateway`.

Manual and accepted-AI authority remain distinct. Accepted-AI publication resolves a durable,
immutable acceptance receipt on the server and validates exact project, draft, proposal, snapshot,
registry, manifest, profile, commerce, and approved-asset lineage. Browser-submitted receipt
content is invalid. Stale authority, accept-then-undo divergence, and idempotency conflicts fail
without moving publication state.

Authoritative governed acceptance accepts only bounded proposal/action identities and optimistic
project/draft preconditions from the browser. It resolves the authenticated merchant context,
server-retained proposal and review, current lifecycle, canonical draft, materialization, registry,
manifest, package, commerce, and approved-asset authority itself. One accepted action owns one
deterministic receipt identity; exact retries recover that receipt, while conflicting reuse fails
closed. Prepare and confirm reload the persisted receipt and independently resolve current authority
again. The same internal authority contract accepts governed initial-generation and follow-up
proposals; normal merchant follow-up routing remains P10C-owned.

### 9.2 Deterministic compiler

The publish compiler transforms the exact authorized `StorefrontSnapshot` and current live
authorities into an immutable renderer-ready result and deterministic compile receipt. It is
write-free and provider-free. It validates component/profile/renderer reachability, bindings,
protected commerce, routes, locales, assets, accessibility, and migrations. Confirmation reloads
authority and recompiles; any identity drift fails before publication.

For a current dynamic-commerce snapshot, compilation validates every archetype component and
profile, preserves the exact root authority in the immutable result, and binds its fingerprint into
compiler authority, migration, receipt, navigation/route, and runtime fingerprints. Older valid
artifacts may omit the optional authority; a current artifact cannot silently drop it or persist a
representative editor context.

### 9.3 Atomic compiled publication and rollback

P10A-08C-02B atomically persists the canonical published snapshot, immutable compiled artifact,
append-only published version/history, completed publication operation, and active
artifact/version pointer through the existing repository transaction. The artifact retains the
exact deterministic compiler result and receipt, source snapshot fingerprint, manual or accepted-AI
lineage, compiler and registry/profile authority, route/locale/asset/commerce fingerprints,
operation identity, timestamp, and integrity fingerprint. Reads validate integrity and all
correlated identities. Stale active-version, draft, receipt, or compiler authority and injected
artifact/version/pointer failures leave the prior live state unchanged.

Rollback restores a selected historical published snapshot as a new canonical draft while the
current live version remains unchanged. Only a later explicit Publish performs a fresh compilation,
creates a new immutable version, and advances the active pointer. An older artifact is never
repointed or reused as a new publication. These derived records are not another editable model or
commerce snapshot.

### 9.4 Complete publication evidence

P10A-08D-02 retains correlated deterministic, integration, browser, and narrow human publication
evidence for both manual and accepted-AI authority. It binds the trusted source draft or accepted
receipt, preparation, operation, compile receipt/result, immutable artifact/version, active pointer,
published snapshot, and exact home, collection, and PDP observations. The evidence also proves
draft/published isolation, stale and injected-failure preservation, immutable history,
restore-to-new-draft, fresh explicit republish, and zero external AI-provider calls during
publication. This is functional publication evidence, not P10B commercial visual acceptance.

P10A-09 reconciles this evidence with every other P10A gate in the formal
[`P10A phase closure record`](P10A_PHASE_CLOSURE.md). P10A is Baseline / closed; this functional
publication evidence still does not claim P10B commercial visual acceptance.

## 10. Commercial Storefront Generation System

### 10.1 Current ceiling

The current output is a competent, clean, responsive catalogue store. Homepage composition has
the most useful range; collection and PDP profiles are functionally safe but visually narrow.
Typography, spacing, layout, surfaces, controls, image art direction, shared frame, product cards,
and narrative depth do not yet form a sufficiently differentiated commercial system. Valid schemas,
component counts, fixture screenshots, and deterministic tests cannot establish commercial quality.

### 10.2 P10B outcome and binding architecture

P10B delivers Commercial Storefront Generation System v1 through the existing canonical
authorities. The internal commercial design system is one P10B subsystem; the phase also owns the
site map, complete registered page set, navigation composition, bounded storefront synthesis,
diversity control, responsive presentation, and commercial evidence.

The binding model, locked 18-task sequence, and post-P10B-16 three-stage generation-journey
correction live in
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md).
The architecture produces one complete Premium Editorial storefront before broad synthesis and
direction expansion. P10B-01 is Baseline; its executable contract and evidence are recorded in
[`P10B_01_COMMERCIAL_DESIGN_GRAMMAR.md`](P10B_01_COMMERCIAL_DESIGN_GRAMMAR.md). P10B-02 Design DNA
is Baseline under [`P10B_02_PARAMETRIC_BRAND_SYSTEM.md`](P10B_02_PARAMETRIC_BRAND_SYSTEM.md), and
P10B-03 anatomy is Baseline under
[`P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md`](P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md).
P10B-04 responsive image/art-direction authority is Baseline under
[`P10B_04_RESPONSIVE_IMAGE_ART_DIRECTION.md`](P10B_04_RESPONSIVE_IMAGE_ART_DIRECTION.md).
P10B-05 page-set authority is Baseline under
[`P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md`](P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md).
P10B-06 shared-frame authority is Baseline under
[`P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md`](P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md).
P10B-08 product-card authority is Baseline under
[`P10B_08_CANONICAL_PRODUCT_CARD_AND_MERCHANDISING.md`](P10B_08_CANONICAL_PRODUCT_CARD_AND_MERCHANDISING.md).
These authorities remain disjoint: P10B-03 consumes P10B-02 compatibility where relevant without
duplicating Design DNA authority, and P10B-05 owns only site-map/page-family/PageBlueprint page-set
authority.

The canonical inheritance remains:

```text
BrandSystem
  → PageBlueprint profile
  → component family / meaningful variant
  → bounded validated instance override
```

A blueprint owns structure, regions, hierarchy, slots, relationships, responsive transformation,
and permitted layouts. Bounded finishing selects typed palette, typography, rhythm, containers,
surfaces, controls, shape/elevation, density, image treatment, alignment, and visual weight. Raw
CSS, class aliases, React, generated executable frontend code, and parallel token/page/recipe/
registry/direction authorities remain prohibited.

### 10.3 P10B-01 executable commercial grammar

The existing generated component/PageBlueprint capability manifest now includes one immutable,
versioned commercial grammar. It closes typography posture/roles/scale/weight/tracking/line-height;
container/rhythm/gutter/grid/alignment/density/visual-weight/balance; surfaces; action/control
hierarchy; border/radius/elevation; media ratio/crop/focal-point/overlay/emphasis; responsive
transformations; and commercial narrative roles.

Every category declares one primary owner plus exact narrowing and selection levels. Resolution
follows `BrandSystem → PageBlueprint profile → component family/meaningful variant → bounded
validated instance override`; lower levels intersect inherited authority and cannot broaden it.
Compatibility rules express allowed, prohibited, required, mutually exclusive, and narrowing-
intersection relationships across profiles, components/variants, responsive modes, narrative
roles, and asset/media requirements. The manifest and each effective selection have deterministic,
order-insensitive fingerprints.

Valid v1.3 BrandSystem and executable PageBlueprint state is adapted deterministically without
persisting another model. Unknown or stale authority, unregistered values, conflicts, widening,
wrong-owner overrides, raw CSS/class/code, and incompatible protected-media selections fail closed
with typed errors before proposal mutation. P10B-01 adds vocabulary/query authority only; it does
not implement Design DNA persistence, component anatomy, art direction, site-map/page families,
commercial renderers, synthesis, or visual-quality evidence.

### 10.4 P10B-05 site-map and page-family authority

The canonical page-family registry contains stable versioned authority for home, collection,
search/results, product detail, About, Contact, locations, FAQ, shipping, returns, policy/legal,
generic content, campaign/editorial landing, cart, checkout, no-results, empty, error, and 404.
Each family declares its route class, required or optional commerce context, allowed PageBlueprint
profile references, navigation eligibility, all-enabled-locale coverage, shared-frame requirement,
approved-fact requirements, omission/fallback policy, and commerce-operation boundary.

One bounded transient site-map decision deterministically materializes canonical static
`StorefrontSnapshot.pages`, `StorefrontSnapshot.navigation`, and the compact dynamic-commerce route
inventory. Each static `PageModel` retains its exact family/profile/context/locale/shared-frame/
evidence reference; each dynamic entry retains only its URL and canonical commerce identity while
the root archetype authority owns presentation. There is no persisted site map beside the snapshot
and no second page graph. Deterministic IDs and a canonical site-map fingerprint make repeated
materialization stable.

Validation fails before mutation for unsafe or duplicate routes, missing or duplicate root,
family/type/route mismatch, reserved namespace conflict, missing/cyclic parents, orphan or missing
navigation, missing collection/product context, stale family/profile/frame authority, invalid EN/FI
coverage, evidence-free factual pages, and utility pages that claim operational commerce authority.
Optional evidence-gated pages are omitted with an explicit reason; required ones fail. Legacy P10A
home/collection/PDP snapshots remain valid without implicit migration, and governed materialization
preserves their exact existing sections and protected bindings through save/reload and deterministic
publication compilation.

The minimum site-map profiles intentionally contain no component anatomy. P10B-05 establishes
page-family/profile authority only; P10B-03 and P10B-06 through P10B-13 still own commercial
component, frame, content/support, search, and utility presentation.

### 10.5 P10B-03 executable component anatomy

`ComponentDefinitionV2` now carries optional versioned commercial anatomy with unique semantic
regions, typed structural/finishing/content/commerce-binding/asset parameters, P10B-01 responsive
transformations, embedded compatibility, exact variant classification, realized structural
signatures, and deterministic migration metadata. The generated component capability manifest
projects this authority and fails closed when a later consumer requires missing, stale,
incompatible, not-ready, or non-meaningful commercial capability.

Required semantic regions and protected content, commerce, and asset inputs are validated fail
closed. Mutable parameters remain bounded by their declared kind and cannot overwrite protected
content or canonical commerce bindings.

All 29 current V2 component definitions and all 126 registered variants have explicit executable
metadata. P10B-06 promotes exactly four header and four footer variants through realized shared-
frame anatomy. P10B-07 promotes only registered hero, promotion, editorial and proof variants
whose implementations declare and realize material hierarchy, region arrangement/presence, asset
placement, content/CTA relationship, merchandising emphasis, navigation model, responsive
transformation, or presentation-mode differences. All other current families remain explicitly
`notYetP10BCommercialReady` unless their owning family task proves the same contract;
compatibility aliases remain aliases and do not count as meaningful variants.

The contract is Baseline under
[`P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md`](P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md).
P10B-06 delivers the shared-frame subset and P10B-07 delivers the hero/editorial/campaign/proof
subset. Product-card, homepage-profile, collection-profile, and PDP-profile minimums remain later
work. The anatomy contract does not create another component, compatibility, BrandSystem, or
PageBlueprint authority.

### 10.6 P10B-02 parametric BrandSystem / Design DNA

The canonical `BrandSystem` now contains an optional versioned `designDna` field with deterministic
legacy migration. Its strict bounded authority covers semantic colour and contrast relationships;
approved font pairing and display/heading/body/utility/price roles; type scale, weight, line height,
and tracking; spacing rhythm, gutters, gaps, insets, and container postures; surface, border, radius,
and elevation grammar; action/control posture; global/page-purpose density; and default media ratio,
crop, overlay, and prominence posture. Remote font URLs, raw CSS and spacing, invalid ranges or
relationships, stale versions, malformed migration input, and lower-level widening fail closed.

One immutable canonical projection feeds the existing editor, preview, and published CSS-variable
boundary. Shared frame, homepage, collection, and PDP consume the same fingerprinted foundations;
current valid BrandSystem fixtures migrate deterministically, and exact Design DNA survives
`StorefrontSnapshot`, save/reload, and deterministic publication compilation. Premium Editorial
and Modern Technical examples share identical colours while differing materially in typography,
rhythm, containers, surfaces, controls, density, and media posture. Contract and lifecycle details
are recorded in [`P10B_02_PARAMETRIC_BRAND_SYSTEM.md`](P10B_02_PARAMETRIC_BRAND_SYSTEM.md).

P10B-02 by itself does not claim P10B-03 anatomy, P10B-04 art direction, P10B-05 page families,
later commercial render families, synthesis, scale diversity, or retained human quality.

Accepted P10B-18B-01 retains the canonical Design DNA schema at `1.0.0` and adds no migration or
parallel token model. New current-authority compilation now materializes two supported exact
density outcomes per direction through existing spacing, controls, surfaces and regional-density
fields: Premium and Minimal use standard/balanced or spacious/airy; Modern uses compact/compact or
standard/balanced. Merchant colour and each direction's typography/media identity remain stable.
Density is reported as a compound exact spacing/Design DNA consequence rather than a raw
fingerprint-only posture axis. Exact fixed-backbone, lifecycle, CSS projection and accepted browser
evidence are recorded in the P10B-02 authority document and the frozen-audit successor section.

### 10.7 P10B-04 responsive image and art-direction authority

The existing approved asset presentation now embeds one optional, versioned responsive-image
authority. It binds normalized focal point and safe area, typed ratio, bounded crop and overlay,
exact registered breakpoints, immutable source and approved-derivative lineage, exact component
version/variant/anatomy region/asset slot, and a deterministic material fingerprint. It contains no
transformed URL, arbitrary CSS, executable output, second asset registry, or responsive-state store.

Validation consumes current P10B-02 Design DNA and P10B-03 anatomy/slot authority. Lower-level
treatments can narrow but cannot broaden DNA media defaults or component role/cardinality. Exact
breakpoint selection falls back deterministically through compatible registered breakpoints and the
valid source treatment; optional omission remains owned by the component slot. Invalid geometry,
unsafe safe-area exclusion, stale fingerprints/definitions, wrong role/slot/anatomy/source,
unapproved derivatives, and broadening fail closed.

Canonical product media remains commerce-owned. Presentation authority retains exact product ID,
media ID, role, revision, membership and order; wrong-product lineage, editorial replacement, and
editorial product crop geometry fail. Homepage editorial, collection-card and PDP media share one
semantic `picture` renderer across editor, preview and published targets. Legacy presentations
default deterministically without fixture rewrites, while authored authority survives snapshot,
save/reload, compiler fingerprinting and compiled output exactly.

The contract and deterministic/browser evidence are recorded in
[`P10B_04_RESPONSIVE_IMAGE_ART_DIRECTION.md`](P10B_04_RESPONSIVE_IMAGE_ART_DIRECTION.md). Production
CDN derivative materialization, media editing, generated media, later commercial families and
retained human commercial acceptance remain deferred.

### 10.8 P10B-07 hero, editorial, campaign and proof families

The existing homepage V2 registry now provides six canonical meaningful hero anatomies:
editorial split, media-led, full-bleed overlay, asymmetric editorial, restrained copy-first and
campaign merchandising. The legacy `editorial`, `fullBleed`, and `minimal` identifiers remain
loadable compatibility aliases and do not inflate the meaningful count. Each promoted anatomy has
an explicit presentation mode and deliberate mobile/tablet transformation.

The same registry and shared renderer provide reusable image/text, brand-story, craft/process,
lookbook/gallery and continuation editorial compositions; five campaign/promotion compositions;
and quote, proof-grid and service-assurance compositions. Their compatibility is bounded by page
family and P10B-01 narrative role. This task enriches existing homepage PageBlueprint slots and
did not itself create the later P10B-09 profile library or another component/page authority.

Hero and editorial assets retain P10B-04 responsive focal, crop, safe-area, ratio, overlay,
derivative and lineage authority through the shared editor/preview/published image renderer. CSS
fallbacks apply only to legacy direct images and do not override explicit art direction. All
finishing continues to inherit P10B-02 Design DNA; no family-local palette, typography or spacing
authority exists.

Proof items carry canonical approved evidence references as protected read-only content, but their
embedded approval fields do not establish current authority. Render and publication conformance
must match each item to a separately supplied current-evidence projection; changed revisions,
revoked approval and stale fingerprints fail closed. Optional proof resolves to omission when no
current approved evidence exists; required proof fails closed.
The deterministic generation path selects the registered families through the existing executable
PageBlueprint, proposal compiler, runtime state, `StorefrontSnapshot`, save/reload and publication
compiler with zero provider calls. Focused and browser evidence is recorded in
[`P10B_07_HERO_EDITORIAL_CAMPAIGN_PROOF_FAMILIES.md`](P10B_07_HERO_EDITORIAL_CAMPAIGN_PROOF_FAMILIES.md).

### 10.9 P10B-06 commercial shared-frame authority

One optional canonical `StorefrontSnapshot.sharedFrame` stores the exact selected commercial frame
profile, authority version/fingerprint, and canonical announcement/header/footer sections once for
the storefront. Explicit deterministic migration promotes legacy page-local frame sections into
this root authority; legacy P9/P10A snapshots remain valid until that selection is requested.

Four registered structural profiles—editorial masthead, commerce utility-led, centred minimal, and
compact technical—coordinate brand, canonical primary/service navigation, available search/cart
destinations, locale controls, mobile navigation, and footer hierarchy. They resolve through the
generated P10B-03 commercial-capability manifest to four meaningful header and four meaningful
footer variants. Their three mobile modes are drawer, stacked disclosure, and compact overlay;
their four footer compositions are brand/editorial, service/navigation, navigation columns, and
compact commerce/legal.

The bounded frame proposal binds the exact source snapshot ID, revision, content fingerprint,
profile identity, authority version, and authority fingerprint. A stale proposal fails before
projection. Header/footer pairing, responsive transformations, canonical routes, approved asset
lineage, and protected commerce also validate fail closed. Search, cart, service, and footer links
appear only from P10B-05 page/navigation authority; no policy, location, service, guarantee, or
route is invented. P10B-04 art direction applies only to approved frame asset placements that
exist. Design DNA controls the visual foundations without changing profile structure or adding a
frame-local token system.

The same root sections render around home, collection/search, PDP, content/support, and utility
pages through the Puck editor root, preview, and published renderer. Save/reload and deterministic
publication preserve the exact frame and compile its component, asset, responsive-image, and
protected-state authority. Contract, deterministic, lifecycle, accessibility, four-width EN/FI,
and retained visual evidence are recorded in
[`P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md`](P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md).

Accepted P10B-18B-01 retains shared-frame authority `1.0.0` and the same four identities. It admits
`compact-technical` only for the four previously blocking About-story, checkout, empty and
not-found profiles, making the existing frame truthfully reachable over the full required audit
site map. The shared renderer now preserves whole long-navigation labels at 1024/1440, bounds the
Premium editorial wordmark, reduces the utility footer without dropping links, strengthens the
centered-minimal transition, and gives compact-technical a distinct dense rail/legal composition.
Navigation posture directly selects the exact shared frame; mobile hierarchy is compound over the
selected frame's registered mobile mode and responsive transformations. No fifth frame, breakpoint
authority, frame-local token system, navigation model or persisted migration is introduced.

### 10.10 P10B-08 canonical product-card authority

One versioned `canonicalProductCardAuthority` owns five meaningful comparison/information-led,
editorial, compact, image-led, and dense anatomies. Each declares P10B-03 semantic structure,
material differences, supported contexts, and responsive transformations. One strict renderer is
used by homepage merchandising, collection/results, related products, and compatibility wrappers;
legacy `productGrid` and `relatedProducts` definitions are explicitly superseded and cannot be
promoted by commercial-ready capability queries.

Cards consume the existing `ProductPresentationContext` and P10B-04 responsive-image authority.
Product ID, title, price/unavailable state, compare-at price, availability, membership, media ID,
media role, and exact product source owner remain protected. Editorial or wrong-product media,
invented badges or fact overrides, unsupported context/anatomy combinations, and stale publication
authority fail closed. Cards emit navigation/detail intent only and own no cart or commerce write.

Design-system records reference the canonical anatomy ID rather than repeating card variants or
protected-field lists. Deterministic selection reaches PageBlueprint materialization, plan,
proposal, accepted `StorefrontSnapshot`, save/reload, preview, and the existing publish compiler.
The compiler fingerprints and revalidates the exact card authority. Details and evidence are in
[`P10B_08_CANONICAL_PRODUCT_CARD_AND_MERCHANDISING.md`](P10B_08_CANONICAL_PRODUCT_CARD_AND_MERCHANDISING.md).

### 10.11 P10B-09 commercial homepage profile authority

Six versioned executable homepage PageBlueprint profiles now provide editorial storytelling,
commerce-led discovery, minimal brand commerce, campaign-led, collection-gateway, and
high-consideration architectures. Each declares compatible P10B-06 root frames, exact P10B-07
component families and meaningful variants, a P10B-08 product-card anatomy, evidence requirements,
section and commerce-item cardinality, responsive transformations at 375/768/1024/1440 px, and
narrowing-only P10B-02 Design DNA compatibility.

ID-independent structural signatures cover material narrative order, component/variant selection,
required/optional posture, cardinality, frames, merchandising, responsive behavior, and Design DNA
narrowing. Exact duplicates and profiles differing in fewer than three bounded material dimensions
fail. Profile identities separately bind the signature to exact ID/version; palette and font
choices do not create structural uniqueness.

Optional unsupported evidence/media slots omit deterministically. Required campaign, process,
proof, media, and commerce roles fail closed; product/collection selections preserve canonical
order and stop at registered maximum cardinality without filler duplication. All merchandising
uses the one P10B-08 renderer, and all approved assets use P10B-04 authority. Deterministic tests
prove plan, proposal, exact slot compilation, snapshot, save/reload, preview and publication.
Twenty-four retained browser images cover six profiles at four widths through the canonical
renderer. Details are in
[`P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md`](P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md).

### 10.12 P10B-10 commercial collection/search profile authority

Four versioned executable collection/search PageBlueprint profiles now provide editorial discovery,
catalogue comparison, campaign-led discovery, and dense/search-oriented collection presentations.
Every profile narrows P10B-02 Design DNA, selects a compatible P10B-06 root frame, one registered
P10B-03 `dynamicCollectionCommerce` meaningful anatomy, a P10B-08 product-card anatomy, and exact
responsive transformations at 375/768/1024/1440 px. ID-independent structural signatures and
profile-bound fingerprints reject exact duplicates, stale authority, and pairs with fewer than
three material differences.

The existing catalogue route adapter remains the commerce boundary. Product membership/order,
prices, compare-at price, availability, product media, filters, sorting, and child collection order
come only from its canonical projection and exact bindings; all cards use the P10B-08 renderer.
The campaign profile requires approved collection/editorial media and its P10B-04 treatment, while
canonical product media remains product-owned. A transient search context validates exact canonical
revision and result IDs; zero results retain the query and emit no fabricated cards. This task does
not create a search route, pagination authority, collection model, filter engine, or commerce write.
P10B-16P-01 later registers `/search` in compact route inventory and selects its maintained
archetype. P10B-16P-06 now supplies the separate transient canonical query/results adapter while
preserving that presentation authority; unavailable or invalid runtime state still fails closed
without substituting a collection.

Deterministic coverage proves materialization, planning, proposal/compiler/snapshot preservation,
all renderer targets, save/reload, publication compilation, canonical fact/media/order guards,
child collection ordering, active filters, and zero-result behavior. Four-width Chromium evidence
covers the canonical route renderer and retains screenshots in its report. Details are in
[`P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md`](P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md).

### 10.13 P10B-12 content and support page-family authority

Fifteen registered `PageBlueprint` profiles cover About, contact, locations, FAQ, shipping,
returns, policy, generic content, and campaign/editorial pages through the existing P10B-05
page-family, locale, navigation, shared-frame, snapshot, compiler, and renderer authority. Their
single `contentSupport` component resolves localized facts only from current approved brief evidence;
missing, stale, revoked, superseded, unapproved, mismatched, or malformed evidence fails closed.
They add neither a CMS, fact registry, second page graph, nor fabricated policy, service, delivery,
location, guarantee, certification, or compliance claims. Details are in
[`P10B_12_CONTENT_AND_SUPPORT_PAGE_FAMILIES.md`](P10B_12_CONTENT_AND_SUPPORT_PAGE_FAMILIES.md).

### 10.14 P10B-13 commerce utility presentation authority

Six versioned utility profiles—cart, checkout boundary, no-results, generic empty, recoverable
error, and 404—now materialize a single registered `commerceUtility` component through the
existing P10B-05 page-family/PageBlueprint authority. They select only compatible P10B-06 frames,
inherit P10B-02 Design DNA, declare exact responsive transformations, and preserve only the
presentation configuration in `StorefrontSnapshot`, save/reload, and deterministic publication.
The registered loading runtime state renders on the route whose adapter state is pending; it does
not replace the 404 singleton or persist as a second loading page.

Current cart lines, quantities, prices, totals, checkout sessions, queries, filters, and runtime
errors are a transient read-only commerce-adapter projection. The renderer resolves canonical
product identity/media from the existing catalogue and displays only adapter-supplied prices; it
does not calculate totals, discounts, shipping, tax, or inventory. Actions render only when the
runtime adapter declares and handles the matching bounded intent. P10B-10 no-results retains
query/filter context and emits no products. Error, empty, and 404 remain semantically distinct.
Checkout retains its existing external/adapter boundary and does not create payment or order
authority. Details are in [`P10B_13_COMMERCE_UTILITY_PRESENTATION_PAGES.md`](P10B_13_COMMERCE_UTILITY_PRESENTATION_PAGES.md).

### 10.15 P10B-14 Premium Editorial complete-storefront vertical slice

The first complete-store convergence proof materializes one 17-route Lumo Atelier storefront from
approved merchant evidence, approved assets and unchanged read-only commerce. It selects the
canonical `premiumEditorial` Design DNA, `centered-minimal` frame,
`homepage-editorial-storytelling`, `collection-editorial-discovery`,
`collection-dense-search`, `pdp-high-consideration`, current factual content profiles and all six
current utility profiles. Simple and configurable products share the generic dynamic PDP and P6
option-resolution authority; all merchandising shares the P10B-08 card authority and canonical
product media remains protected.

The current site-map, PageBlueprint, whole-storefront proposal, `StorefrontSnapshot`, save/reload,
deterministic publication and registered render paths preserve the same complete authority. The
dedicated canonical proof route covers all 17 routes and retains 15 reviewed screenshots across the
required 375/768/1024/1440 widths. The existing human commercial-review protocol retains a passing
160-scenario record tied to exact snapshot, manifest, frame, Design DNA, profile, commerce, asset,
route and component/art-direction fingerprints. See
[`P10B_14_PREMIUM_EDITORIAL_COMPLETE_STOREFRONT_VERTICAL_SLICE.md`](P10B_14_PREMIUM_EDITORIAL_COMPLETE_STOREFRONT_VERTICAL_SLICE.md).

This establishes one representative complete store. P10B-15 generalizes that convergence path,
P10B-16 governs direction/diversity authority, and P10B-16P-01 preserves the same route coverage
while converging collection/search/PDP design into maintained root archetypes. P10B-16P-02A
provides the strict transient prompted intent boundary, and P10B-16P-02B compiles its result into
one exact canonical synthesis/proposal execution. P10B-16P-03 connects that authority to the normal
Storefront Studio journey, and P10B-16P-04 adds accepted real V2 evidence plus bridge disposition.
P10B-17 subsequently closes phase-wide responsive/accessibility/performance execution; accepted
P10B-18A audits the prior ceiling; accepted P10B-18B-01 closes the bounded Design DNA/shared-frame
upgrade; accepted P10B-18B-06 closes bounded asset-composition authority; accepted P10B-18B-02
closes bounded homepage/editorial/campaign quality; accepted P10B-18B-03 closes bounded
collection/search/product-card quality; accepted P10B-18B-04 closes bounded PDP quality; and
accepted P10B-18B-05 closes bounded content/support/utility quality. Parent P10B-18B is
Baseline/complete; P10B-18C and P10B-16P-05B are Baseline. P10B-18D is a Baseline diagnostic with
live commercial quality rejected. P10B-19 PRE is Baseline. P10B-19A-01 is Baseline, parent P10B-19A
is Partial, P10B-19A-02 is Baseline, and P10B-19A-03 is the exact next task.

### 10.16 P10B-15 bounded storefront synthesis and narrative authority

One versioned synthesis contract now binds the merchant/brief context, sorted approved evidence
revisions, canonical commerce, approved assets, selected Design DNA, page set, shared frame,
PageBlueprint profiles, component/variant/anatomy capabilities, bounded parameters, narrative,
merchandising, density, art direction, responsive posture and current planner/registry/recipe
authority into one deterministic synthesis fingerprint. Execution recomputes the complete decision
from current authority before it can materialize a snapshot; supplying a repaired hash cannot make
a stale decision current.

The engine accepts only registered editorial, commerce, restrained, dense-catalogue,
high-consideration, campaign and stronger-story constraints. It chooses or explicitly narrows
registered authority, records public machine-readable outcomes, verifies cross-page discovery and
conversion paths, bounds consecutive repetition, omits unsupported optional factual pages, and
fails closed for unavailable required evidence or any stale/incompatible reference. It emits no
HTML, CSS, JSX, scripts, components, page families, facts, products, media or commerce mutations.

The same approved Lumo fixture now produces editorial-heavy, commerce/discovery-heavy and
restrained/minimal complete 17-route outcomes with distinct Design DNA/profile/narrative/snapshot
fingerprints. All use the canonical whole-storefront plan/proposal, `StorefrontSnapshot`,
save/reload, renderer, compiler and immutable publication path. The 25-case deterministic matrix,
dedicated four-width browser proof and three passing 160-scenario retained human-review records
cover the stated P10B-15 outcome. See
[`P10B_15_BOUNDED_STOREFRONT_SYNTHESIS_AND_NARRATIVE_ENGINE.md`](P10B_15_BOUNDED_STOREFRONT_SYNTHESIS_AND_NARRATIVE_ENGINE.md).

This is the bounded synthesis space consumed by the P10B-16 direction-scale
duplicate/near-duplicate controller, not the P10B-18C 100+ configuration commercial-quality gate.

### 10.17 P10B-16 coordinated direction and diversity authority

One versioned registry defines Premium Editorial, Modern Technical and Minimal Commerce as
coordinated constraint packages over the existing P10B-15 authority. Packages narrow current
Design DNA finishing, frames, PageBlueprint profiles, meaningful component anatomies, optional
factual page composition, narrative, merchandising, art direction, density and responsive posture.
They add no direction-specific renderer, template, page graph, component registry, token authority
or executable code. Exact package identity/version/fingerprint and every referenced capability are
revalidated before synthesis; stale, unsupported or incompatible selection fails before proposal
compilation.

Each selected store receives a cross-page direction fingerprint and an independent diversity
fingerprint spanning non-colour Design DNA, page set, profiles, frame, component anatomy, bounded
parameters, art, density, narrative and responsive posture. Deterministic comparison separates
exact duplicates, palette-only differences, shallow component swaps, near duplicates and materially
different stores. A material result requires changed rendered architecture; direction names or
colour alone never qualify. Batch selection rejects previously used exact/near candidates and fails
closed when valid novelty is exhausted.

The retained batch has three complete outcomes per direction and preserves current required
home/search/commerce/utility authority while narrowing only optional approved-fact pages. It passes
save/reload and compiled publication, protects commerce/evidence/product media, renders at
375/768/1024/1440, and binds three passing reviews to exact direction/diversity/snapshot
fingerprints. See
[`P10B_16_COORDINATED_DIRECTIONS_AND_DIVERSITY_CONTROL.md`](P10B_16_COORDINATED_DIRECTIONS_AND_DIVERSITY_CONTROL.md).

### 10.18 P10B-16P-01 dynamic commerce route archetype authority

P10B-16P-01 corrects the earlier complete-store representation in which each collection and
product URL became an independently visible/editable `PageModel`. Collection and PDP public-route
coverage is unchanged; `/search` retains one registered route and presentation authority. Route
instance and design authority are now separate. Static home, content, campaign, policy, and utility
pages remain canonical pages.
Collection/search and PDP design live in one versioned, fingerprinted
`dynamicCommercePresentation` authority inside the same `StorefrontSnapshot`.

The root authority records a compact collection/product/search route inventory, four maintained
collection/search archetypes, four maintained PDP profiles plus a generic PDP fallback, exact
PageBlueprint profile versions/fingerprints, compatible frames, Design DNA narrowing, component/
anatomy/variant and bounded parameter selections, responsive/art-direction posture,
collection-route mappings, product-type mappings, bounded matching rules, fallbacks, revision, and
authority fingerprint. Editable archetype state cannot contain route or membership identities,
canonical revisions, SKU/price/stock/availability, variant or option structures, or canonical
product media.

Every known product type maps to one PDP archetype and several product types may reuse one
archetype. Unknown types use the generic canonical-option fallback. Every collection route has one
collection-compatible mapping; `/search` retains registered search archetype selection. At runtime
the exact collection or PDP URL resolves its current route entry and mapping, revalidates current
profile/frame/component authority, binds exact current protected product or collection commerce,
and renders through the existing `dynamicProductDetail` or `dynamicCollectionCommerce`
implementation. Search materialization additionally requires an exact transient query/result
projection from a first-class canonical adapter. P10B-16P-06 supplies it from the standalone current
catalogue; unavailable, invalid, stale, or unresolved authority fails closed rather than fabricating
results or binding a collection. Catalogue size and query count therefore do not change editable
design cardinality.

Storefront Studio lists static pages and archetypes, not every product and collection URL. A chosen
representative product or collection is transient view state and is never saved or published.
Archetype edits update root authority revision/fingerprint. Draft save/reload, history/restore,
proposal projection, compiler, manual and accepted-AI publication, immutable artifacts, preview,
and published routes preserve the same authority.

Legacy snapshots remain parseable. Deterministic migration converges compatible concrete commerce
pages while preserving routes, primary and related-product bindings, profile/variant choices,
navigation, and static pages.
Missing identity, unsupported layout, a static child of a dynamic route, materially different
legacy presentations, or incompatible per-product-type profiles returns a typed explicit-decision
result instead of choosing or discarding authority. Details are in
[`P10B_16P_01_DYNAMIC_COMMERCE_ROUTE_ARCHETYPES.md`](P10B_16P_01_DYNAMIC_COMMERCE_ROUTE_ARCHETYPES.md).

Existing whole-storefront proposal compatibility uses an explicit server-owned canonical
dynamic-commerce migration transition. It is valid only for whole-storefront scope and binds the
exact operation-produced legacy projection, reviewed canonical projection, and resulting authority
fingerprint. Acceptance replays the migration against current catalogue authority and must
reproduce the reviewed storefront exactly. Provider-originated transitions, page/section scope,
stale authority, or an unsafe migration fail before acceptance.

P10B-16P-01 is Baseline. P10B-16P-02A owns the strict transient prompted Design Intent boundary,
and P10B-16P-02B owns deterministic compilation plus canonical one-shot synthesis/proposal
consumption; both are Baseline, so P10B-16P-02 is Baseline. Normal Studio generation is Baseline
under P10B-16P-03, and separately authorized real-provider acceptance is Baseline under
P10B-16P-04.

### 10.19 P10B-16P-02A prompted Storefront Design Intent V2 authority

P10B-16P-02A established the strict transient provider-safe boundary. P10B-16P-04 retains that
boundary while narrowing its provider wire surface to one compact bounded-hybrid semantic intent.
The provider expresses merchant-facing commercial posture, visual character, density, frame
priority, homepage balance, collection discovery, PDP decision support, responsive/mobile posture,
art direction, and explicit merchant hard/avoid constraints. It does not select exact component,
variant, PageBlueprint, frame, product-card, archetype, product-type mapping, parameter, product,
collection, route, or candidate-storefront identifiers.

One generated transient semantic influence authority derives from the current canonical Design
DNA, frame, PageBlueprint/profile, component/anatomy, dynamic-commerce, content/utility,
responsive, art-direction, evidence, and asset metadata. It marks semantic fields as direct,
compound-driver, derived, substitution-only, or unavailable and fingerprints the current influence
surface. It is not a second registry or executable plan. Search is represented truthfully as
registered presentation authority whose runtime remains fail closed until a first-class canonical
query/results adapter exists.

The strict versioned request binds the exact unchanged merchant prompt and deterministic prompt,
request, project/draft/snapshot, dynamic-commerce, semantic-influence, PageBlueprint, Design DNA,
brief/evidence, asset and aggregate catalogue/commerce fingerprints. It includes approved safe
merchant context, bounded aggregate catalogue/product-type characteristics, evidence/asset
availability, semantic values, and at most two server-attested exact merchant hints. Full products,
prices, stock, customers, orders, raw media, a complete capability manifest, unnecessary raw
evidence, credentials and authorization data are excluded.

The strict closed result is transient, untrusted, non-canonical and non-executable. It expresses
explicit merchant hard constraints and avoidances plus bounded semantic soft/optional design
preferences. AI-inferred implementation choices remain soft. It cannot emit an
`executableIntentId`, exact registry selection, arbitrary route/page/section tree, concrete product
or collection design entry, component, code, CSS, commerce value, proposal, PageBlueprint or
`StorefrontSnapshot`.

After strict schema parsing, every semantic value must belong to its request-specific bounded enum;
hard/avoid constraints and optional exact hints must match current server-owned authority. Unknown,
invented, concrete-route, unavailable required, fingerprint-mismatched or stale values fail without
fuzzy repair, named-preset substitution, retry, fallback or partial result. Normalization makes the
request and intent fingerprints stable under unordered source iteration; all material semantics
affect the intent fingerprint.

The server-only OpenAI adapter uses strict structured output, `store: false`, zero SDK and
application retries, one bounded-time transport attempt, no repair call/fallback, exact fingerprint
verification and safe refusal/timeout/transport/malformed/schema/reference/stale classification.
Only safe provider/model, call/retry, fingerprint, bounded usage and outcome metadata may be
retained; raw prompts, provider bodies, credentials and headers are not logged or retained.

Before the provider response, this path may calculate semantic capability knowledge only. It cannot execute
P10B-15, execute complete P10B-16 candidates, create a complete plan, materialize PageBlueprints,
create proposal operations or construct a candidate snapshot. The prior P10B-16L real OpenAI call
completed the earlier strict v1 direction/posture result and failed coordinated synthesis; the
corrected executable-option bridge made zero live calls and its active runtime is now removed.
Neither is prompt-driven generation evidence. P10B-16P-02B owns deterministic post-provider
compilation, P10B-16P-03 owns the normal Studio journey, P10B-16P-04 owns accepted live evidence,
and P10B-16P-05A owns active-path/compiler rationalisation.
Full audit and contracts are in
[`P10B_16P_02_PROMPTED_STOREFRONT_DESIGN_PLAN_V2.md`](P10B_16P_02_PROMPTED_STOREFRONT_DESIGN_PLAN_V2.md).

### 10.20 P10B-16P-02B deterministic design-intent compiler

`CompiledPromptedStorefrontDesignDecisionV2` is the strict, versioned, transient execution
authority between a validated provider intent and the existing P10B synthesis lifecycle. The
compiler first reconstructs the current provider request and requires exact prompt, request,
snapshot revision, semantic-influence, manifest, PageBlueprint, Design DNA, dynamic-commerce,
approved evidence/asset and aggregate catalogue authority. A stale or mismatched identity fails
before compilation and leaves draft, history and proposal state unchanged.

The deterministic factorized solver evaluates only bounded compatibility metadata after the
provider result; it never materializes completed candidate storefronts for scoring. It first
selects a compatible page-set/Design-DNA/frame/profile/archetype backbone, then resolves exact
factor options for typography, narrative, merchandising density, components, meaningful variants,
product cards, bounded parameters, responsive posture, and art direction. It enforces an explicit
evaluation budget, canonical ordering and score-based selection, with stable fingerprints used only
to break equal scores. Exact merchant hard constraints remain hard; soft semantics influence only
direct or truthful compound axes, and derived/substitution-only fields do not double-count one
correlated exact choice. Search remains a registered presentation selection with fail-closed
execution; the compiler does not invent query/results authority.

The compiled decision binds exact Design DNA material, shared frame, homepage/collection/search/PDP
profiles and archetypes, complete product-type-to-PDP mappings with a generic fallback, canonical
product-card anatomies, material PageBlueprint slot/meaningful-variant/bounded-parameter overrides,
static/support and utility selections, narrative, responsive/art-direction and approved asset-role
use. Every material provider preference records an `accepted`, `substituted`, `rejected`,
`omitted`, or `defaulted` diagnostic with its exact authority and stable reason. Compiled,
structural, dynamic-route and exact-authority fingerprints change with material decisions.

Only a successfully validated compiled decision may be consumed. It becomes one exact extension
of the existing bounded synthesis decision and is then materialized once through the canonical
P10B generation plan and isolated whole-storefront proposal lifecycle. This executable boundary
carries the selected exact authority values, never a coordinated-direction `selectionId`,
compatibility-package wrapper or precomputed-candidate identity. Those identifiers may support
bounded internal solving and diagnostics only. `PageBlueprint` remains the composition authority
and `StorefrontSnapshot` remains the sole canonical editable state. Invalid, stale, incompatible,
budget-exceeded, unsupported bounded-runtime, protected-commerce or partial results fail closed
with no snapshot/proposal mutation. Protected-commerce evidence verifies the actual materialized
plan, proposal and proposed snapshot rather than trusting only compiler metadata. P10B-16P-02B made
zero provider and Vesko calls and does not itself provide normal Storefront Studio wiring,
executable search or live V2 acceptance. P10B-16P-03 now supplies the normal Studio wiring without
changing this compiler boundary.

### 10.21 P10B-16P-03 Storefront Studio prompted generation journey

Normal initial whole-storefront generation now starts from an approved raw local merchant project
in Vesko Storefront Studio. The browser sends only exact merchant text plus current project,
snapshot, revision, locale, and storefront-scope identity through the strict versioned
`promptedStorefrontDesignV2` operation. In standalone and explicitly configured mock evidence
compositions, the server independently reloads project, snapshot, catalogue, evidence, approved
assets, and capability authority; invokes one injected Design Intent V2 provider; refreshes
authority after the response; and calls `runPromptedStorefrontDesignCompilation`. That local
authority is not integrated authentication. An integrated request without injected authenticated
tenant/project-backed current authority fails closed before provider selection. P10B-16P-04
subsequently supplies a production-disabled trusted server-owned acceptance composition; it is not
production authentication. Browser-supplied intents, compiled
decisions, component selections, candidate snapshots, and proposal operations are rejected by the
closed request schema.

The server returns one existing isolated `AiStorefrontProposal`, current approved evidence
references, and safe lineage. Exactly one server-minted registered
`APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION` structured operation carries the target-bound
`compilePromptedStorefrontDesignIntentV2@2.0.0` permission. It binds the exact raw projection,
operation-produced projection, reviewed canonical result, and the exact P02B source-proposal,
request, prompt, provider-intent, compiled-decision, synthesis, structural, candidate-snapshot, and
materialization-authority fingerprints. Response validation cross-binds those values across
proposal metadata, the operation, and lineage. This is the explicit lifecycle authority needed to
atomically replace a raw page set, navigation, shared frame, content-fact projection, and
dynamic-commerce presentation. It does not create another proposal system or permit browser- or
provider-authored replacement state.

Proposal review remains read-only and isolated until acceptance. Accept, Reject, Generate another,
Undo/Redo, Save/reload, and normal Preview continue through existing proposal, history,
`StorefrontSnapshot`, storage, and renderer authority. Representative collection/PDP context is
transient and never enters snapshot history or publication. At P10B-16P-03 delivery, search
presentation could be listed but runtime search remained fail closed; P10B-16P-06 later supplies its
separate transient query/results authority without changing the Studio generation contract.
Current approved evidence references accompany proposal review; content/support fact documents
retain their exact references in the candidate and accepted snapshots as provenance only. After
save/reload, normal editor and Preview entry independently resolve current approved evidence from
trusted server authority and compare it with the retained provenance; a saved snapshot never
authorizes itself. The standalone P03 fixture supplies that current authority only for its exact
project, while integrated mode fails closed without injected authenticated evidence authority.

The P10B-16P-03 retained implementation evidence uses only injected mocked providers. Page load,
review, Accept, Reject, Undo/Redo, Save, Preview, and Publish controls make no provider call; one explicit
Generate action makes at most one attempt with zero retry or fallback. Refusal, timeout, transport,
malformed/schema, hard-constraint, and stale-authority failures leave draft and history unchanged
and return the prompt controls to a usable state. P10B-16L terminal/demo injection and legacy
bounded follow-up paths did not control normal initial generation; P10B-16P-05A subsequently
removed the P10B-16L active runtime while preserving valid follow-up authority. P10B-16P-03 itself
claims no real Design Intent provider call or commercial visual-quality acceptance. P10B-16P-04
supplies those later bounded acceptance facts. Details are in
[`P10B_16P_03_STUDIO_PROMPT_GENERATION_JOURNEY.md`](P10B_16P_03_STUDIO_PROMPT_GENERATION_JOURNEY.md).

### 10.22 P10B-16P-04 real Storefront Studio Design Intent acceptance

P10B-16P-04 adds one production-disabled, trusted server-owned Aurum acceptance composition to the
normal Storefront Studio route. Aurum is a fictional repository fixture, not a real merchant,
staging environment, production authority, or reusable designed snapshot. The server loads current
project, snapshot, catalogue, approved evidence/assets, dynamic-commerce, and semantic capability
authority; the browser still submits only compact merchant intent and current identity.

The accepted provider is `openai-prompted-storefront-design-intent-v2` using `gpt-5.6-sol` through
one bounded 120-second Responses API attempt with `store: false`, zero SDK/application retries, no
repair, and no fallback. The cumulative P10B-16P-04 ledger is 16 real calls. Calls 1 through 13
failed closed while transport, strict-schema, semantic, compatibility, and rendered-fidelity
defects were isolated and corrected. The final ordered Prompt A/B/C calls each validated one
semantic intent, refreshed current authority, compiled one exact decision, and materialized exactly
once. Raw provider payloads, prompts, credentials, headers, and reasoning are not retained.

Prompt A selected Premium Editorial authority and was rejected after product-owner visual review;
Prompt B selected Modern Technical authority and was rejected; both restored the raw draft without
history mutation. Prompt C produced a third materially different structure, was accepted as one
atomic unsaved whole-storefront change, undid to the exact raw draft, redid to the exact accepted
snapshot, saved explicitly, reloaded exactly, and rendered through normal homepage, two collection,
simple PDP, configurable PDP, About, and cart Preview routes. Publish remained separate and was not
invoked. Pairwise evidence records six non-colour material differences between C and each prior
proposal. Protected commerce and canonical product media remained unchanged.

P10B-16L and the legacy whole-storefront selector are Deprecated compatibility-only historical
authorities for prompted complete-store generation. P10B-16P-05A removes their active runtime,
routes, provider selector, and executable-intent product-path consumers after proving equivalent V2
safety coverage and no normal-path dependency. Historical evidence and required neutral
migration/regression fixtures were consumer-classified by P10B-16P-05B after accepted P10B-18C;
only current migration consumers and durable regressions remain. At the P10B-16P-04 acceptance
boundary, search presentation remained registered while execution failed closed;
P10B-16P-06 later supplies the standalone runtime adapter. See
[`P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md`](P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md).

### 10.23 P10B-16P-05A active production-path and compiler rationalisation

P10B-16P-05A makes prompted initial generation one explicit path:

```text
Storefront Studio
  → /api/ai/whole-storefront-proposals
  → prompted Storefront Studio server handler
  → trusted current-authority composition
  → semantic provider selector
  → deterministic semantic compatibility resolver
  → exact compiled storefront decision
  → coordinator and sole executor
  → exactly one materialization
  → one isolated proposal
```

The normal route rejects a missing or ambiguous operation. Its separately tagged registered
follow-up operation remains valid follow-up authority, but cannot be mistaken for initial
generation. Normal composition imports no P9/Lumo, P10B-16L, or acceptance/demo authority. P03 and
P04 inject current authority and provider selection into the same canonical prompted handler only
through explicit production-disabled compositions. There is no pre-provider storefront
materialization, `executableIntentId`, prebuilt candidate selection, exact-key provider vocabulary,
hidden deterministic fallback, browser-authored semantic/exact authority, retry, or second
initial-generation handler.

The prompted compiler coordinator owns current-authority refresh and stage sequencing, the semantic
resolver owns metadata-only compatible selection, the exact decision remains transient, and the
executor is the sole prompted-generation materialization/proposal owner. Internal traversal and
superseded execution entry points are not public compiler authority. `StorefrontSnapshot`,
PageBlueprint, Design DNA, dynamic-commerce, proposal, history, save, preview, and publication
contracts remain unchanged.

P10B-16P-05A removes the active P10B-16L executable-intent route/provider/runtime and isolates P9/Lumo
live generation as Deprecated historical, production-disabled evidence. Proven publication and
migration fixtures remain where they have current consumers. The P10B-16P-04 Aurum acceptance
composition remains production-disabled as the lean mock/live seam retained for P10B-18D.
P10B-16P-05B is Baseline after its consumer-verified historical cleanup following accepted
P10B-18C. P10B-16P-06 subsequently closes the standalone canonical search query/results
adapter, P10B-17 closes responsive/accessibility/performance execution, and the accepted P10B-18A
audit freezes the commercial-authority ceiling. Accepted P10B-18B-01 subsequently closes its
Design DNA/shared-frame package, accepted P10B-18B-06 closes bounded asset-composition authority,
accepted P10B-18B-02 closes bounded homepage/editorial/campaign quality; accepted P10B-18B-03
closes bounded collection/search/product-card quality; and accepted P10B-18B-04 closes bounded PDP
quality; accepted P10B-18B-05 closes bounded content/support/utility quality. Parent P10B-18B is
Baseline/complete; P10B-18C and P10B-16P-05B are Baseline. P10B-18D is a Baseline diagnostic with
live commercial quality rejected. P10B-18 and P10B remain Partial. P10B-19 PRE is Baseline.
P10B-19A-01 and P10B-19A-02 are Baseline, parent P10B-19A is Partial, and P10B-19A-03 is the exact next task.

### 10.24 P10B-16P-06 canonical search query/results adapter

P10B-16P-06 establishes one versioned provider-neutral, read-only search request/result contract.
Its standalone adapter searches only the current canonical `CatalogueDisplayModel`: it validates and
normalizes bounded EN/FI query input, applies only supported filters/sort/page state, prioritizes
exact SKU and localized title matches deterministically, bounds work, and returns unique exact IDs
that have current public product-route authority. It does not copy product records or own catalogue,
collection, commerce, or media truth.

The persisted authority remains exactly one `/search` route identity and the search-compatible
P10B-10 archetype selected inside `dynamicCommercePresentation`. The runtime request and result page
are transient. Query text, filters, sort, page number, result IDs, and result count never enter
`PageModel`, `StorefrontSnapshot`, history, compiled design decisions, design fingerprints, provider
evidence, or publication records as editable storefront state. Save, reload, restore, and publish
preserve presentation authority but never replay a customer's search query.

Draft Preview, isolated proposal preview, saved/history Preview, and published `/search` routes bind
the transient exact result page to the existing `dynamicCollectionCommerce` implementation,
P10B-08 product cards, P10B-06 shared frame, current Design DNA, and P10B-13 governed
orientation/no-results presentation. Supported shared-frame forms submit normal GET query URLs;
result cards link through exact current dynamic PDP routes. Missing, invalid, stale, or unresolved
catalogue/route/search authority fails closed without fabricated results, collection substitution,
or canonical mutation.

This Baseline uses the standalone catalogue adapter only and made zero provider or Vesko calls. It
does not claim a Vesko search endpoint, AI/semantic/vector/fuzzy search, typo correction,
recommendations, personalization, analytics, or operational commerce writes. P10B-17 subsequently
closes the existing responsive/accessibility/performance authority. The accepted P10B-18A audit
then freezes the commercial ceiling; accepted P10B-18B-01 closes its Design DNA/shared-frame
package; accepted P10B-18B-06 closes bounded asset-composition authority; accepted P10B-18B-02
closes bounded homepage/editorial/campaign quality; accepted P10B-18B-03 closes bounded
collection/search/product-card quality; accepted P10B-18B-04 closes bounded PDP quality; and
accepted P10B-18B-05 closes bounded content/support/utility quality. Parent P10B-18B is
Baseline/complete; P10B-18C and P10B-16P-05B are Baseline. P10B-18D is a Baseline diagnostic with
live commercial quality rejected. P10B-18 and P10B remain Partial. P10B-19 PRE is Baseline.
P10B-19A-01 and P10B-19A-02 are Baseline, parent P10B-19A is Partial, and P10B-19A-03 is the exact next task.

### 10.25 P10B-17 responsive, accessibility and performance closure

P10B-17 executes the existing registered responsive transformations rather than adding a second
breakpoint, renderer, component, search, or commerce authority. Deterministic replay of the retained
Premium Editorial, Modern Technical, and Minimal Commerce authorities, plus neutral and commerce-
integrity fixtures, covers 375, 768, 1024, and 1440 px in EN/FI across the shared frame, homepage,
collection, executable search, simple/configurable PDP, content/support, and commerce-utility
surfaces. Mobile/tablet disclosure, navigation, stacking, grid, media, purchase-flow, and footer
behavior remain registered presentation concerns and do not mutate semantic content, protected
commerce, or canonical product media.

The Baseline includes keyboard/focus traversal, native landmark/heading/form/control semantics,
status announcements, option-group accessibility, contrast-safe semantic roles, bounded touch
targets, reduced-motion handling where motion exists, and EN/FI expansion evidence. Deterministic
budgets bound rendered product cards, facets, related merchandising, gallery/media loading, search
work, duplicate media requests, layout shifts, and storefront build artifacts. Browser geometry,
accessibility, performance, cross-lifecycle renderer, and representative retained human visual
evidence are correlated to current authority and commerce/media fingerprints.

This closes only the deliberate responsive, accessibility, and bounded-performance behavior of the
existing registered commercial authority. It does not claim the later P10B-18B source-authority
upgrade or P10B-18C designer-grade commercial quality/100+ scale evidence, a Vesko adapter or
staging result, production authentication, production performance, deployment readiness, or a
provider call.

### 10.26 Remaining commercial generation authority

P10B-18 is **Partial** and is delivered through three ordered slices. P10B-18A is **Baseline**,
accepted on 16 August 2026 under
[`P10B_18_COMMERCIAL_QUALITY_AUDIT.md`](P10B_18_COMMERCIAL_QUALITY_AUDIT.md): its 72-case
deterministic matrix and retained 18-store/108-capture human review diagnose the current ceiling,
separate source/fixture weakness from compatibility and renderer consumption, preserve protected
commerce/media, and freeze six conditional improvement packages. P10B-18B is now **Baseline /
complete**:
P10B-18B-01 and P10B-18B-06 are **Baseline**, accepted on 17 August 2026, P10B-18B-02 and
P10B-18B-03 are **Baseline**, accepted on 18 August 2026, and P10B-18B-04 is **Baseline**, accepted
on 19 August 2026. P10B-18B-05 is **Baseline**, accepted on 20 August 2026. P10B-18C is **Baseline**,
accepted on 22 August 2026 after the final 126-case and 280-capture quality/diversity gate. P10B-18D
is a Baseline diagnostic with live commercial quality rejected. P10B-19 PRE is Baseline.
P10B-19A-01 and P10B-19A-02 are Baseline, parent P10B-19A is Partial, and P10B-19A-03 is the exact next task.
Acceptance of P10B-18B-06
proves only its bounded asset selection, reuse, responsive source/crop, logo-consumer and
art-direction authority. Acceptance of P10B-18B-02 proves only bounded homepage, editorial and
campaign profile/renderer quality, not parent P10B-18B/P10B-18, later page families or
complete-storefront designer-grade quality.

Acceptance of P10B-18B-03 proves only bounded collection/search/cardinality/facet/card quality and
provider-facing canonical-search truth. It retains four profile IDs, five canonical card anatomies,
one dynamic renderer and one transient read-only search adapter. Micro/small/medium/dense
classification is derived presentation state and never persists or rewrites canonical membership.
Editorial/campaign remain collection-only; comparison/dense are executable in both collection and
search-results contexts. Content/utility quality remains open.

The six existing homepage profile IDs and version `1.0.0` remain canonical. Their slot plans carry
explicit transition intent from semantic resolution through synthesis and the whole-storefront
planner to the shared renderer. `homepageIntent.storyCatalogueBalance` is a compound driver of the
exact selected homepage profile; raw narrative posture is retained as metadata and is not claimed
as an independent rendered axis. Asset-dependent regions continue to use P10B-18B-06 approved
purpose/source/crop/reuse authority and collapse without placeholders or reserved media when that
authority is unavailable. Canonical product cards and protected commerce/media remain unchanged.

The accepted same-strata result contains 38 normalized material topologies, 55/72 repeated
memberships, a largest cluster of seven and 17 singletons. Fourteen retained rich/sparse and
same-direction comparison captures bind exact profile, transition, snapshot, rendered Design DNA,
frame and protected-state authority. This evidence is bounded homepage acceptance, not the final
P10B-18C commercial-quality verdict.

`BrandSystem` owns merchant-wide bounded Design DNA across semantic colour, approved font roles and
pairing, type scale/weights, spacing and section rhythm, gutters/containers, grid/card/control
density, surfaces, borders, radius, elevation/shadow, actions, image posture, and responsive
density. AI does not independently style each section.

P10B adds a bounded Veskify-owned site-map/page-family decision through existing PageBlueprint and
`StorefrontSnapshot` authority. It covers shared frame, home, collection/category, PDP,
About/brand story, Contact/locations, FAQ, shipping/returns/policy, campaign/editorial, generic
content, search/results/no-results, cart, checkout, empty, error, and 404 presentation. Vesko
retains all operational commerce and merchant/store facts.

Commercial minimums are four complete frame systems, three mobile navigation modes, four footer
compositions, six hero compositions, five canonical product-card anatomies, six homepage profiles,
four collection/search profiles, four PDP profiles, registered content/support families, and
governed commerce-utility states. A meaningful variant changes anatomy, hierarchy, arrangement,
asset/content/CTA relationship, navigation, merchandising, responsive transformation, or
interaction mode; class, colour, padding, border, or radius alone is not meaningful.

The three registered directions are:

- **Premium Editorial** — luxurious editorial rhythm, high-quality imagery, restrained commerce,
  and strong narrative hierarchy;
- **Modern Technical** — precise, feature-led, structured, information-rich presentation;
- **Minimal Commerce** — quiet, product-forward, efficient commerce with disciplined density.

Each direction is only a coordinated constraint package selecting compatible canonical authority.
It must differ materially across shared frame, typography, density, imagery, page profiles,
merchandising, responsive behavior, and narrative composition—not merely palette or spacing.
Optional proof, policy, and trust content is shown only when approved merchant/Vesko evidence
exists.

Bounded synthesis selects compatible Design DNA, page set, profiles, frame, component anatomies,
meaningful variants, parameters, approved assets, image treatments, ordering/cardinality, and
narrative roles. It rejects incompatible combinations, excessive repetition, protected-state
drift, and exact or meaningful near duplicates. A deterministic storefront-design fingerprint
covers structural and non-colour dimensions; hundreds or thousands of outcomes arise from bounded
combinations, not manually authored templates.

### 10.27 Commercial acceptance

Parent P10B-18 and P10B remain Partial after P10B-18D rejected live commercial quality and pending
P10B-19. P10B-16P-05B is Baseline; its retained migration and deterministic evidence remains
separate from the completed live diagnostic.

P10B closes only when at least 100 complete bounded storefront configurations pass deterministic
validity, protected-state, exact-duplicate, near-duplicate, and structural-distribution analysis,
and a fingerprint-stratified representative subset passes retained human commercial review. The
complete-store evidence includes required content/support and utility pages, EN/FI where supported,
and 375, 768, 1024, and 1440 px. Tests alone cannot close visual quality, and one polished vertical
slice cannot close meaningful diversity.

## 11. Storefront Studio and merchant editing

P10C delivers merchant-operable editing without changing canonical authority. It owns:

- a brand asset library with explicit roles and provenance;
- the canonical Puck boundary and stable shared-frame identity/selection;
- approved bounded manual add, remove, reorder, field, asset, and presentation operations;
- merchant-facing scoped AI routing, clarification, and execution;
- unified manual/AI history and undo/redo;
- the brand/asset editor and required Storefront Studio shell;
- commercial editor QA and the complete select-to-publish chain.

P10C does not create another state model, unrestricted page builder, commerce editor, provider
authority, component generator, or publishing command. The canvas is the primary workspace;
merchant UI uses merchant language and does not expose raw JSON, schemas, registry IDs, prompt
internals, or provider payloads.

## 12. Vesko integration architecture

### 12.1 Contract truth

The Vesko OpenAPI 3.0 contract has been obtained and audited. It establishes real endpoint surfaces
for store context, products, variants, categories, brands, media, inventory, Puck, and storefront
product reads. See [`VESKO_OPENAPI_CONTRACT_AUDIT.md`](VESKO_OPENAPI_CONTRACT_AUDIT.md) and
[`VESKO_VESKIFY_INTEGRATION_MATRIX.md`](VESKO_VESKIFY_INTEGRATION_MATRIX.md).

Contract acquisition is not integration sufficiency. Production integration remains **Blocked** by:

- incomplete or absent response schemas and error bodies;
- inconsistent security declarations and unresolved tenant/store authority;
- missing revisions, ETags, optimistic concurrency, and synchronization semantics;
- missing navigation projection contracts;
- no canonical Veskify draft, history, accepted-receipt, compiled-artifact, or publication APIs;
- no agreed media ownership and presentation-asset write boundary;
- no Vesko staging credentials, conformance environment, or retained staging evidence.

### 12.2 Integration rules

Veskify adapters translate stable Vesko contracts into canonical read-only projections. They do not
leak Vesko transport types into the domain or add commerce writes. Veskify presentation assets must
be explicitly separated from canonical product media. Raw Puck persistence is prohibited. Draft,
history, receipt, compiler artifact, and publication APIs must preserve `StorefrontSnapshot` and
the authoritative publishing lifecycle.

P11 owns contract closure, identity/store context, catalogue/navigation projection, full commerce
conformance, presentation assets, persistence, accepted-receipt/publication adapters,
synchronization, staging conformance, and pilot readiness. P12 owns production hardening and pilot
operations after P11 establishes stable authority.

## 13. Evidence and acceptance model

### 13.1 Evidence rules

Each claim names its evidence level. Required levels are cumulative only when the acceptance gate
says so. In particular:

- schema validation proves a contract, not rendering or merchant usability;
- deterministic and mocked-provider tests are not real-provider evidence;
- browser/E2E execution is not retained human visual review;
- local adapter conformance is not Vesko staging;
- staging is not production;
- a published snapshot route is not atomic compiled-artifact rollback evidence.

Evidence must correlate the relevant project, source/brief revision, proposal, accepted snapshot,
registry/manifest/profile authority, commerce and asset fingerprints, publication operation,
compiled artifact/version, and rendered route where those authorities apply. Secret values,
provider payloads containing sensitive data, and merchant private data must not be retained.

### 13.2 Capability-chain acceptance

For each storefront capability, assess the applicable chain:

```text
registered
  → runtime-queryable
  → planner-selectable
  → proposal-expressible
  → compiler-preserved
  → StorefrontSnapshot-stored
  → renderer-visible
  → editor-accessible
  → save/reload preserved
  → publish preserved
  → evidence retained
```

An upstream pass cannot conceal a downstream gap. A capability can remain Partial even when its
contract and internal execution are Baseline if merchant reachability or required evidence is
incomplete.

## 14. Non-functional requirements

### 14.1 Safety and integrity

- Reject unknown or stale authority and preserve state on failure.
- Keep protected commerce read-only through generation, editing, save, and publication.
- Use create-once or transactional storage for immutable receipts and published artifacts.
- Authenticate and authorize server-side writes; never trust browser-submitted authority bodies.
- Keep provider credentials server-side and secrets out of logs and evidence.
- Treat crawled content as untrusted data and resist prompt injection.

### 14.2 Determinism and reliability

- Canonical fingerprints, manifests, materialization, proposal compilation, and publication
  compilation are deterministic for identical authority.
- Idempotent requests return the original result; conflicting reuse fails closed.
- Failed operations produce no partial proposal, draft, history, receipt, or publication write.
- Migrations are explicit, registered, tested, and fail closed when unresolved.

### 14.3 Accessibility and responsive behavior

- Merchant controls are keyboard accessible with meaningful labels and visible focus.
- Renderers preserve semantic structure, contrast, media alternatives, and safe fallbacks.
- Primary storefront and Studio journeys cover 375, 768, 1024, and 1440 px.
- Loading, empty, error, stale, unavailable, success, and unsaved states are explicit.

### 14.4 Performance and operations

- Published output uses deterministic, cacheable artifacts and bounded runtime data reads.
- Responsive images and art direction avoid unnecessary payloads and layout shifts.
- Observability correlates project, request, proposal, snapshot, publication, and adapter operations
  without exposing secrets or protected merchant data.
- Production claims require defined service levels, tenancy isolation, backup/recovery, security,
  monitoring, deployment, and incident procedures.

## 15. Phase sequence and exit criteria

The binding sequence is:

1. **P10A — Grounded orchestration and publishing closure.** **Baseline / closed** through the
   formal P10A phase closure record.
2. **P10B — Commercial Storefront Generation System v1.** **Partial / active phase.** P10B-01
   through P10B-17, P10B-16P-01 through P10B-16P-05A, and P10B-16P-06 are Baseline; P10B-16P-02 is
   Baseline; accepted P10B-18A and P10B-18B-01/06/02/03/04/05 are Baseline; parent P10B-18B is
   Baseline/complete. P10B-18C and P10B-16P-05B are Baseline. P10B-18D is a Baseline diagnostic
   with live commercial quality rejected. P10B-18 and P10B remain Partial. P10B-19 PRE is Baseline.
   P10B-19A-01 and P10B-19A-02 are Baseline, parent P10B-19A is Partial, and P10B-19A-03 is the exact next task.
   Deliver complete commercially credible storefronts
   with bounded material diversity through registered authority and retained human review.
3. **P10C — Storefront Studio Editing Experience v1.** Deliver merchant-operable assets, manual and
   scoped AI editing, unified history, save, preview, and publish.
4. **P10D — Advanced media and registered interactive presentation.** Add governed generated media,
   video, and registered interactive presentation with fallbacks.
5. **P11 — Vesko Integration Readiness and Reference Adapter.** Close contracts and prove the
   canonical lifecycle in Vesko staging.
6. **P12 — Production hardening and pilot operations.** Establish production tenancy, security,
   observability, recovery, deployment, and pilot operations.

P10D is not a dependency for the first commercial storefront, the minimum merchant editor, or the
Vesko pilot. Detailed tasks, ownership, dependencies, evidence, and non-goals are maintained in the
roadmap and delivery tracker.

### 15.1 Phase exit summaries

- **P10A — Baseline / closed:** all internal orchestration/publication gates are complete with no
  merchant-editor wiring requirement; evidence and deferred ownership are traceable in
  [`P10A_PHASE_CLOSURE.md`](P10A_PHASE_CLOSURE.md).
- **P10B:** a serious retailer could publish the generated complete storefront without a designer
  rebuilding it, supported by retained responsive human review.
- **P10C:** a merchant completes the canonical select-to-publish editing chain in Storefront Studio.
- **P10D:** advanced media remains registered, governed, accessible, performant, and safely
  degradable.
- **P11:** the canonical lifecycle passes typed adapter conformance and end-to-end Vesko staging,
  and one real pilot has an accepted readiness record without implying broad production readiness.
- **P12:** production-readiness gates and controlled pilot operations pass with retained evidence.

## 16. Deprecation and migration

The following are compatibility-only or superseded authorities and must not guide new work:

- legacy component definitions and renderer paths superseded by ComponentDefinitionV2;
- hand-maintained capability inventories duplicated from the generated manifest;
- legacy deterministic/fixture editor routes that bypass governed package and scope authority;
- browser-owned publication methods or browser-created accepted-AI authority;
- raw Puck persistence or Puck-shaped canonical page state;
- independently executable recipe, template, direction, or storefront-plan representations;
- concrete collection/search/PDP `PageModel`s used as current design authority instead of the
  root dynamic-commerce archetype contract;
- P10B-16L `executableIntentId` selection and normal whole-storefront `selectionId` semantics for
  prompted initial generation, now Deprecated compatibility-only historical authority after
  P10B-16P-05A removed their active runtime, routes, providers, and product-path consumers;
- P9/Lumo live generation from an already-designed demonstration storefront, now isolated as
  Deprecated historical, production-disabled evidence while proven publication and migration
  fixtures remain;
- legacy product-card implementations duplicated outside the canonical commercial family;
- v1.2.2 phase descriptions that keep Phase 9 active or assign merchant editing outside P10C.

Migration must preserve canonical IDs, bindings, commerce truth, snapshot history, and published
authority. An unresolved migration blocks compilation or rendering rather than silently dropping
content or selecting a fallback variant. Legacy concrete commerce-route pages remain loadable,
but convergence to root archetypes requires deterministic equality; materially different route
presentations require an explicit typed migration decision.

## 17. Explicit current non-claims

Version 1.3.0 does not claim:

- that the overall product is Baseline or production ready;
- that acceptance of the P10B-18A audit or any accepted P10B-18B slice means current output has passed the
  P10B-18C commercial visual-quality/100+ scale gate;
- that governed internal routing is wired into the normal merchant editor;
- that the Vesko OpenAPI contract is sufficient for production integration;
- that raw Vesko Puck persistence is compatible with `StorefrontSnapshot`;
- that Veskify may mutate commerce truth;
- that Vesko staging or production evidence exists;
- that authentication, tenancy, observability, deployment, and operations are production complete;
- that P10D advanced media is required for the first commercial storefront or pilot;
- that P10B-16P-04 closes executable search, P10B-17 responsive/accessibility/performance,
  P10B-18 repeated commercial quality/scale, Vesko staging, production authentication, publication,
  or production readiness;
- that P10B-16P-05A supplies the missing search query/results adapter, production authentication,
  P10B-17/P10B-18 closure, or final historical-evidence cleanup; accepted P10B-16P-05B supplies the
  bounded cleanup before P10B-18D without closing P10B;
- that P10B-16P-06 provides a Vesko search endpoint, AI/semantic/vector/fuzzy search, typo
  correction, recommendations, personalization, analytics, persisted customer search state, or
  P10B-17/P10B-18 closure;
- that P10B-18A itself implements the conditional P10B-18B source-authority packages, or that
  accepted P10B-18B-02 implements collection/search/product-card, PDP, content/utility or the
  P10B-18C 100+ quality/diversity gate;
- that P10B-16P-02A materializes a storefront, creates a proposal or snapshot, provides executable
  search, or has live Design Intent V2 provider evidence;
- that P10B-16P-03 provides executable search, live Design Intent V2 provider evidence, retained
  V2 human review, commercial quality acceptance, or phase-closure evidence;
- that archived v1.2.2 prose describes current implementation or phase status.

## Appendix A — Authoritative requirement and acceptance traceability

This appendix is the sole authoritative v1.3.0 definition site for the retained requirement
namespace: 24 functional requirements (`FR-101` through `FR-124`), 10 non-functional requirements
(`NFR-101` through `NFR-110`), and 38 acceptance criteria (`AC-101` through `AC-138`). The meanings
come from the previous authoritative specification and are retained or clarified against the
current architecture and phase boundary; stale v1.2.2 phase prose does not regain authority.

The **Current status** column is a traceability disposition, not the implementation status defined
in section 1.1. **Clarified** means the requirement retains its identifier and essential meaning but
uses current v1.3.0 terminology or ownership. **Historical only** is used only where no active
binding document depends on the outcome as a current delivery gate. Pre-consolidation task-local
`001`–`099` identifiers are governed by the explicit exclusion in
[`archive/README.md`](archive/README.md); they are not v1.3.0 aliases.

### A.1 Functional requirements

| ID | Type | Requirement / acceptance meaning | v1.3.0 owner | Current status | Evidence / linked authority |
| --- | --- | --- | --- | --- | --- |
| **FR-101** | Functional requirement | Veskify MUST operate as the controlled storefront-design engine for Vesko Storefront Studio while the standalone repository remains an implementation, validation, and demo environment rather than the merchant product boundary. | §§2–4; cross-phase product boundary | **Clarified** | README; AGENTS; current-state audit |
| **FR-102** | Functional requirement | Veskify MUST preserve product identity and commerce boundaries: no design flow may own or mutate catalogue management, product types, variants, prices, stock, inventory, orders, payments, tax, or logistics. | §§3.3–3.4, 12; all phases | **Retained unchanged** | ADR-004; capability ledger; protected-commerce tests |
| **FR-103** | Functional requirement | The primary onboarding path MUST start from an existing public storefront URL, discover reusable source evidence, and present it without changing the current draft. | §§3.1, 5; retained baseline and P11 adapter | **Retained unchanged** | ADR-003; source-discovery contracts and tests |
| **FR-104** | Functional requirement | Source discovery MUST record evidence, provenance, warnings, and confidence, and MUST reconcile discovered products, collections, and assets against canonical Vesko commerce data before generation. | §§3.1, 3.3, 5; retained baseline and P11 | **Retained unchanged** | ADR-003; source-evidence and reconciliation tests |
| **FR-105** | Functional requirement | The merchant MUST approve a Storefront Design Brief before initial generation; the brief MUST include business profile, source summary, brand direction, approved assets, page plan, assumptions, warnings, and protected commerce source. | §§3.1, 5–6; P10A internal execution | **Retained unchanged** | Approved-brief contracts; Phase 9 evidence matrix |
| **FR-106** | Functional requirement | Brand reconstruction MUST work from logo, public-site evidence, product imagery, merchant preferences, and registered industry/direction presets, including exact valid palette instructions when schema and contrast validation pass. | §§3.1, 7.3, 10; P10B | **Clarified** | BrandSystem contracts; P10B capability audit |
| **FR-107** | Functional requirement | Asset inventory, selection, and reuse MUST preserve asset IDs, role eligibility, responsive crop metadata, provenance, and merchant approval; generation MAY be offered only when reusable assets are insufficient or explicitly requested. | §§3.2, 5, 10–11; P10B/P10C | **Retained unchanged** | Asset contracts; capability ledger; P10C asset ownership |
| **FR-108** | Functional requirement | AI design changes MUST use controlled proposals, approved skills, structured operations, target-bound permissions, validation, and merchant review before draft mutation. | §6; P10A internal authority and P10C merchant operation | **Retained unchanged** | ADR-002; proposal lifecycle tests |
| **FR-109** | Functional requirement | The component platform MUST provide reusable ComponentDefinitionV2 families, variants, slots, bindings, PageBlueprints/profiles, migrations, and shared editor/preview/published renderers. | §§4.2, 7; P10A/P10B/P10C | **Clarified** | Component registry; generated manifest; P10B audit |
| **FR-110** | Functional requirement | Storefront components MUST bind to a canonical read-only Vesko commerce projection and MUST NOT create a competing product, product-type, option, variant, or catalogue model. | §§3.3, 7.4, 12; all phases and P11 | **Retained unchanged** | ADR-004; protected-commerce regressions |
| **FR-111** | Functional requirement | Dynamic product-detail routes MUST select one maintained PDP archetype through governed product-type/complexity mapping and render option groups, dependencies, required states, variant resolution, media, price, and availability from canonical product configuration without one design document per product. | §§7.4, 10.18; P10B/P10C | **Clarified** | ADR-004; dynamic-route/PDP materialization and renderer tests |
| **FR-112** | Functional requirement | Dynamic collection/search routes MUST select one maintained archetype through governed mapping and bind collection headers, filters, product grids, merchandising rows, and no-results states to canonical collection/product data without changing membership or commerce truth; search MUST use exact transient query/result authority, keep it out of editable/published design state, and fail closed when its current canonical adapter or route authority is unavailable. | §§7.4, 10.18, 10.24; P10B/P10C/P11 | **Clarified** | Dynamic-route/collection materialization, standalone search contract/adapter, lifecycle non-persistence, fail-closed, renderer, and browser tests |
| **FR-113** | Functional requirement | Whole-storefront design changes MUST coordinate global tokens, navigation, footer, and representative pages through one validated proposal and atomic application/undo path. | §§6, 8–9; P10A/P10C | **Retained unchanged** | Governed proposal compiler and lifecycle tests |
| **FR-114** | Functional requirement | Generated and edited storefronts MUST meet responsive and accessibility quality requirements across onboarding, storefront output, Storefront Studio, proposal review, dynamic PDP, collection, and publishing surfaces. | §§7.4, 10–11, 14; P10B/P10C | **Clarified** | Responsive/accessibility gates; P10B human review |
| **FR-115** | Functional requirement | Draft acceptance, history, Save draft, Publish, and Restore MUST remain separate: accepted changes mutate the active draft only, Save persists draft only, Publish requires explicit confirmation and authoritative compilation, and Restore creates a draft. | §§8–9; P10A/P10C/P11 | **Clarified** | Draft/history tests; publishing gateway/compiler authority |
| **FR-116** | Functional requirement | Vesko Storefront Studio MUST expose a merchant-facing product shell and language that hides raw JSON, registry IDs, provider payloads, component internals, and developer tooling. | §11; P10C | **Clarified** | Merchant UX rules; Storefront Studio roadmap/tracker |
| **FR-117** | Functional requirement | Provider failure, validation failure, stale context, and retained demo reset/load flows MUST preserve active draft/history and keep deterministic-provider reliability for repeatable tests and demos. | §§6, 8, 14.2; P10A/P10C | **Clarified** | Failure/stale regressions; deterministic provider tests |
| **FR-118** | Functional requirement | Vesko adapters and teammate handoff MUST map project, commerce, media, storage, publishing, source discovery, AI provider, and observability contracts without redesigning the Veskify engine. | §12; P11/P12 | **Clarified** | Vesko OpenAPI audit; integration matrix |
| **FR-119** | Functional requirement | The component platform MUST use controlled component families with meaningful variants, typed slots, compatibility rules, approved bindings/assets, and one shared editor/preview/published renderer implementation. | §7; P10B/P10C | **Retained unchanged** | Component registry; renderer authority; P10B audit |
| **FR-120** | Functional requirement | Each commercial recipe MUST remain only a registered constrained `PageBlueprint` profile defining required/optional slots, compatible families/variants, default and permitted ordering, data bindings, approved-asset requirements, responsive constraints, omission/fallback rules, and cross-page coordination without a second executable representation. | §7.2; P10B | **Clarified** | PageBlueprint/profile authority; ADR-002 |
| **FR-121** | Functional requirement | AI composition MUST select only registered PageBlueprint profiles, compatible registered families/variants, permitted ordering, and typed bounded design parameters; validation MUST reject arbitrary trees, raw CSS/classes, executable code, unrestricted font imports, and values outside registered bounds. | §§6.3, 7; P10A/P10B | **Clarified** | Generated manifest; governed compiler; bounded-parameter fail-closed tests |
| **FR-122** | Functional requirement | Design inheritance MUST flow from `BrandSystem` through a registered PageBlueprint profile and family/variant to constrained validated instance overrides; semantic tokens flow downward, renderer-visible values derive from canonical typed state, and invalid or unrelated local visual-language overrides fail validation. | §7.3; P10B | **Clarified** | BrandSystem and profile contracts; P10B audit |
| **FR-123** | Functional requirement | Optional evidence/trust content MUST be omitted without approved evidence, and registry defaults MUST NOT make unsupported commercial claims. | §§3.3, 10; P10B | **Retained unchanged** | Evidence/provenance guards; human review protocol |
| **FR-124** | Functional requirement | Commercial capability completion MUST prove the applicable capability-reachability chain and coordinated homepage/collection/PDP browser review with representative approved assets and retained human evidence. | §§10, 13; P10B | **Clarified** | Capability ledger; P10B human commercial gate |

### A.2 Non-functional requirements

| ID | Type | Requirement / acceptance meaning | v1.3.0 owner | Current status | Evidence / linked authority |
| --- | --- | --- | --- | --- | --- |
| **NFR-101** | Non-functional requirement | Security and protected commerce data MUST be enforced at every source, provider, operation, binding, storage, and publishing boundary; untrusted source/provider content cannot grant permissions. | §§3, 6, 9, 12, 14.1; all phases | **Retained unchanged** | ADR-002/003/004; protected-commerce and gateway tests |
| **NFR-102** | Non-functional requirement | Merchant-facing flows MUST meet WCAG 2.2 AA expectations for keyboard access, focus visibility, semantics, labels, contrast, and dynamic state announcements. | §§7.4, 11, 14.3; P10B/P10C | **Retained unchanged** | Accessibility tests and retained human review gates |
| **NFR-103** | Non-functional requirement | Responsive behavior MUST be validated for primary surfaces at 375, 768, 1024, and 1440 px with no visible clipping, overlap, or unusable dynamic controls. | §§7.4, 10–11, 14.3; P10B/P10C | **Retained unchanged** | Responsive browser evidence and P10B review gate |
| **NFR-104** | Non-functional requirement | Performance-sensitive editor interactions SHOULD feel immediate, while source discovery, resolver calls, and provider work run asynchronously with visible progress and bounded failure states. | §§6, 11, 14.4; P10C/P12 | **Retained unchanged** | Storefront Studio states; performance/operations roadmap |
| **NFR-105** | Non-functional requirement | Reliability and rollback MUST be deterministic: failed, invalid, stale, or rejected proposals, saves, publishes, and restores preserve the last valid active, saved, and published state. | §§6, 8–9, 14.2; P10A/P10C/P11 | **Retained unchanged** | Proposal, persistence, gateway, and compiler regressions |
| **NFR-106** | Non-functional requirement | Observability MUST record safe metadata such as request ID, provider, scope, operation count, validation result, latency, failure category, component versions, and commerce revision without secrets or full prompts by default. | §§13–14.4; P11/P12 | **Clarified** | Observability ports; P11/P12 tracker gates |
| **NFR-107** | Non-functional requirement | Provider isolation MUST keep provider-specific formats, credentials, errors, and retries behind adapters; deterministic fixtures remain the default for local and automated tests. | §§6.3, 14.1–14.2; P10A/P12 | **Retained unchanged** | Provider adapters; deterministic tests |
| **NFR-108** | Non-functional requirement | Deterministic testing MUST cover schemas, bindings, source evidence, proposals, atomic application, adapter conformance, responsive/accessibility gates, and the customer-ready journey. | §§5, 13–14; all delivery phases | **Retained unchanged** | Capability ledger; repository validation gates |
| **NFR-109** | Non-functional requirement | Maintainability MUST preserve integration boundaries: Puck stays isolated, canonical domain/application modules avoid UI/provider dependencies, and historical documents remain superseded context. | §§4, 7–8, 12; all phases | **Retained unchanged** | ADR-001; architecture boundary tests |
| **NFR-110** | Non-functional requirement | Commercial visual quality MUST be assessed at 375, 768, 1024, and 1440 px for hierarchy, density, composition, spacing, typography, imagery, and commerce usability; deterministic/schema-only evidence is insufficient for phase closure. | §§10, 13; P10B | **Clarified** | P10B audit and retained human commercial review protocol |

### A.3 Acceptance criteria

| ID | Type | Requirement / acceptance meaning | v1.3.0 owner | Current status | Evidence / linked authority |
| --- | --- | --- | --- | --- | --- |
| **AC-101** | Acceptance criterion | A merchant can enter an existing public storefront URL and receive a source-discovery summary without the current draft being changed. | §§3.1, 5; retained baseline/P11 | **Retained unchanged** | ADR-003; source-discovery integration evidence |
| **AC-102** | Acceptance criterion | Discovered website prices, stock, and variant values never replace canonical Vesko commerce data. | §§3.3, 12; all phases | **Retained unchanged** | ADR-003/004; protected-commerce tests |
| **AC-103** | Acceptance criterion | A merchant with only a logo, business description, and canonical catalogue can approve a coherent Storefront Design Brief. | §§3.1, 5; retained baseline | **Retained unchanged** | Brief contracts and onboarding evidence |
| **AC-104** | Acceptance criterion | The brief lists reused assets, missing assets, page plan, assumptions, and protected commerce source. | §§3.1, 5; retained baseline | **Retained unchanged** | Brief/schema and asset evidence |
| **AC-105** | Acceptance criterion | Initial generation creates a coherent homepage plus complete collection/search and PDP route coverage using registered static-page and dynamic-archetype components and bindings. | §§5–7, 10.18; P10A internal authority/P10B quality | **Clarified** | Governed generation, route-archetype, and materialization tests; ADR-004 |
| **AC-106** | Acceptance criterion | A watch with one colour dimension renders only the relevant compact selector and technical attributes. | §7.4; retained baseline/P10B | **Retained unchanged** | ADR-004; PDP renderer tests |
| **AC-107** | Acceptance criterion | A ring with five or six configured dimensions/options renders every required group, dependencies, unavailable states, and completion guidance. | §7.4; retained baseline/P10B | **Retained unchanged** | ADR-004; configurable PDP tests |
| **AC-108** | Acceptance criterion | Changing PDP layout or selector style does not change canonical option values, variants, prices, stock, or SKUs. | §§3.3, 7.4; all phases | **Retained unchanged** | Protected-commerce and binding tests |
| **AC-109** | Acceptance criterion | The selected canonical variant controls displayed price, availability, and variant media through the resolver adapter. | §7.4; retained baseline/P11 adapter | **Retained unchanged** | Variant resolver and media tests |
| **AC-110** | Acceptance criterion | Unknown product types resolve through the governed generic PDP archetype and render without dropping available attributes or options. | §§7.4, 10.18; retained baseline/P10B | **Clarified** | ADR-004; dynamic-route unknown-type fallback tests |
| **AC-111** | Acceptance criterion | Product cards render valid price, compare-at-price, or explicit unavailable-price state without inventing a value. | §§3.3, 7.4; P10B | **Retained unchanged** | Product-card and commerce-binding tests |
| **AC-112** | Acceptance criterion | The same registered component implementations render in editor, preview, and published routes. | §§4.2, 7.4; P10B/P10C | **Retained unchanged** | Registry renderer identity and route tests |
| **AC-113** | Acceptance criterion | A merchant can request an exact valid brand palette and receive a validated token proposal rather than a generic unsupported failure. | §§6, 7.3; P10A/P10C | **Retained unchanged** | Brand-token proposal tests |
| **AC-114** | Acceptance criterion | Whole-storefront restyling coordinates global tokens, navigation, footer, static pages, and maintained collection/search and PDP archetypes atomically; representative route contexts remain transient. | §§6, 8, 10.18; P10A/P10B/P10C | **Clarified** | Whole-storefront compiler/lifecycle and dynamic-route editor tests |
| **AC-115** | Acceptance criterion | A failed provider call, invalid operation, or stale commerce revision preserves the active draft and history. | §§6, 8, 14.2; P10A/P10C | **Retained unchanged** | Failure, validation, and stale-context tests |
| **AC-116** | Acceptance criterion | Accepted whole-storefront changes undo and redo as one complete transaction. | §8; P10A/P10C | **Retained unchanged** | Atomic proposal lifecycle tests |
| **AC-117** | Acceptance criterion | Generated storefronts contain no seed-brand or fixture-specific copy unrelated to the selected merchant. | §§3.1, 6; P10A/P10B | **Retained unchanged** | Generation regressions and human review |
| **AC-118** | Acceptance criterion | Asset placement uses approved asset IDs and provenance; product media is never bound to the wrong product. | §§3.2–3.3, 7.4; P10B/P10C | **Retained unchanged** | Asset/binding/product-media regressions |
| **AC-119** | Acceptance criterion | Missing hero or collection media produces a clear reuse/upload/generate choice rather than silent generation. | §§3.2, 11; P10C, with generated media deferred to P10D | **Clarified** | Asset review records; P10C/P10D roadmap boundary |
| **AC-120** | Acceptance criterion | The historical Karvonen demo can be loaded, reset, and demonstrated repeatedly without manual IndexedDB preparation. | Historical demo reliability only | **Historical only** | QA_DATA_01 and historical demo records |
| **AC-121** | Acceptance criterion | Merchant mode exposes no raw JSON, internal IDs, provider payloads, or developer tools. | §11; P10C | **Clarified** | Storefront Studio merchant-language boundary |
| **AC-122** | Acceptance criterion | Primary storefront and Storefront Studio journeys have no visible clipping or overlap at 375, 768, 1024, and 1440 px. | §§10–11, 14.3; P10B/P10C | **Clarified** | Responsive browser and retained human evidence |
| **AC-123** | Acceptance criterion | Dynamic selectors, drawers, proposal actions, save, and publish are keyboard operable and labelled. | §§7.4, 11, 14.3; P10B/P10C | **Clarified** | Accessibility/browser evidence |
| **AC-124** | Acceptance criterion | A Vesko integration adapter passes the same canonical contract tests as standalone fixtures for project, commerce, media, storage, and publishing. | §12; P11 | **Clarified** | Vesko OpenAPI audit; integration matrix; future staging conformance |
| **AC-125** | Acceptance criterion | A complete customer-ready journey succeeds: URL or minimal-input onboarding → exact approved-brief runtime correlation → governed AI edit → manual edit → save draft → preview → authoritative publish → restore. | §§5–12; P10A/P10C/P11 | **Clarified** | Roadmap/tracker phase gates; lifecycle evidence |
| **AC-126** | Acceptance criterion | Premium Editorial, Modern Technical, and the retained approachable/minimal direction evidence are pairwise materially different across required homepage, collection, and PDP dimensions rather than by colour, typography, or one rearranged section alone. | §§10, 13; P10B | **Clarified** | Historical P9-04D matrix; current P10B direction gate |
| **AC-127** | Acceptance criterion | Direction evidence covers EN/FI, 375/768/1024/1440, one/many collections, small/large catalogues, and missing optional media with measured no-overflow, clipping, overlap, and empty-space results. | §§10, 13–14; P10B | **Clarified** | Historical P9-04D matrix; current P10B responsive gate |
| **AC-128** | Acceptance criterion | Every direction uses approved asset provenance and correct product/collection binding and matches canonical source-commerce truth for protected IDs, SKU, price, availability, and media. | §§3.3, 10, 13; P10B | **Clarified** | Historical Phase 9 evidence; P10B protected-commerce gate |
| **AC-129** | Acceptance criterion | Capability retrieval returns only current registered components, variants, bindings, renderers, responsive/accessibility rules, and executable PageBlueprints derived from canonical repository contracts. | §§5, 7; P10A | **Clarified** | Generated capability manifest and audit tests |
| **AC-130** | Acceptance criterion | Unknown, stale, incompatible, or schema-invalid component, variant, binding, PageBlueprint/profile, and skill references are rejected before a proposal can classify them as reachable or mutate a draft. | §§6–7; P10A | **Clarified** | Manifest/router/compiler fail-closed tests |
| **AC-131** | Acceptance criterion | Initial storefront generation and follow-up editing have separately identified governed package contracts with separate schemas, declared authority, quality gates, and evidence; merchant-operable execution belongs to P10C. | §6.2; P10A internal authority/P10C merchant operation | **Clarified** | P10A package contracts and integration tests |
| **AC-132** | Acceptance criterion | Scope classification and strict routing reject any plan whose declared authority silently widens beyond selected section, page, shared frame, design system, or whole-storefront scope; merchant controls and clarification belong to P10C. | §6.2; P10A internal authority/P10C merchant operation | **Clarified** | Strict-router tests; P10A/P10C boundary |
| **AC-133** | Acceptance criterion | Every executable static-page or dynamic-archetype PageBlueprint compiles through controlled operations into the same canonical `StorefrontSnapshot` used by editor, preview, save, history, and publish; concrete commerce route projections remain transient. | §§4.1, 7–10; P10A/P10B | **Clarified** | Proposal compiler, dynamic-route, and canonical lifecycle tests |
| **AC-134** | Acceptance criterion | Golden-store evaluation proves grounded composition, canonical-commerce preservation, accessibility, and responsive functional quality across representative catalogue shapes and at least one non-jewellery merchant; commercial visual acceptance remains P10B. | §§10, 13; P10A functional gate/P10B visual gate | **Clarified** | Golden-store evaluation; human review protocol |
| **AC-135** | Acceptance criterion | Publication deterministically validates and compiles the authorized accepted `StorefrontSnapshot` without an AI call, provider payload, or provider-owned page graph at publish time. | §9; P10A | **Clarified** | Publish compiler/gateway authority and zero-provider tests |
| **AC-136** | Acceptance criterion | Proposal and PageBlueprint validation accept only registered profiles, compatible families/variants, permitted slots/order/bindings/assets, and typed parameters within registered bounds; arbitrary trees, raw CSS/classes, executable code, unrestricted font imports, and out-of-contract values are rejected before acceptance. | §§6.3, 7, 10; P10B on P10A authority | **Clarified** | P10B audit; manifest and validation gates |
| **AC-137** | Acceptance criterion | Validation and renderer proof enforce `BrandSystem → registered PageBlueprint profile → component family/variant → constrained instance override`, and every supported capability proves the complete applicable chain from registration through retained evidence. | §§7.3, 10, 13; P10B | **Clarified** | Capability ledger; P10B human review gate |
| **AC-138** | Acceptance criterion | Without approved merchant evidence, optional trust/evidence sections are omitted and registry defaults cannot introduce unsupported claims; approved provenance is preserved, and responsive human review proves homepage, collection, and PDP as one coordinated storefront. Placeholder-only, deterministic-only, or schema-only evidence fails. | §§3.3, 10, 13; P10B | **Clarified** | Provenance guards; responsive retained human review |

## P10B-18B-06 accepted authority addendum

The accepted bounded implementation strengthens AC-118 and AC-138 without changing product
scope. Generated presentation assets remain approved evidence distinct from Vesko-owned canonical
product media. Exact placement now binds server-owned purpose, bounded reuse, affinity, and optional
approved responsive-source lineage. Responsive-image authority remains backward-readable while its
current `1.1.0` form can resolve a distinct approved physical source per breakpoint and can report
source change independently from crop/treatment change.

The automatic review closure keeps this authority fail-closed across follow-up editing and
materialization. Placements replaced by a new homepage or header plan do not consume the next
plan's reuse budget; paired sources enforce their own reuse limits and must still match the current
approved revision, role, material fingerprint, source group, viewport and provenance. Universal
primary coverage is required unless an approved desktop/mobile pair closes it. Exact presentation
selection is placement-specific, source overrides resolve independently from treatment fallback,
and optional approved crop ID plus exact aspect-ratio lineage remain in the current `1.1.0`
treatment while safe-area geometry stays containing. Collection-scoped affinity applies equally to
collection and editorial campaign media.

The existing shared frame may consume an approved logo through one registered optional header slot;
merchant text identity remains the fallback. Provider intent never selects raw asset IDs or URLs.
Puck remains a transient projection, and StorefrontSnapshot plus approved-asset authority remain the
canonical persisted owners. This implementation adds no product-media mutation, generated imagery,
asset-library UI, page-family redesign, provider call, Vesko call, or real publication.

Status is **Baseline**, accepted by the product owner on 17 August 2026 for this bounded authority
only. The retained captures continue to show excessive whitespace, generic homepage composition,
weak merchandising rhythm and insufficient section hierarchy; those are not accepted as
designer-grade output and remain owned by P10B-18B-02/03/04/05. P10B-18B-02 was subsequently
accepted on 18 August 2026.

## P10B-18B-02 accepted authority addendum

The accepted bounded implementation strengthens AC-126, AC-127 and AC-138 without changing product
scope. The six existing homepage profile IDs remain at version `1.0.0`. Their plans carry exact
slot-transition intent through semantic resolution, bounded synthesis and the whole-storefront
planner to the existing renderer. Story/catalogue balance is a compound homepage-profile driver;
raw narrative posture remains metadata rather than an independently claimed rendered axis.

Hero, promotion, editorial and proof regions expose distinct structural hierarchy; asset-free
variants collapse without placeholders or reserved media; campaign media remains bounded at tablet
and wide widths; evidence columns follow actual cardinality; and compact mobile merchandising uses
the registered two-column anatomy where permitted. Approved asset purpose/source/crop/reuse,
canonical product cards and protected commerce/media remain unchanged.

Status is **Baseline**, accepted by the product owner on 18 August 2026 for bounded homepage,
editorial and campaign quality only. Same-strata evidence records 38 normalized topologies, 55/72
repeated memberships, a largest cluster of seven and 17 singletons; 14 retained captures cover
rich/sparse and same-direction contrasts with exact persistence and no external/provider/Vesko/
browser generation-endpoint/publication calls. This does not accept collection/search/product-card,
PDP, content/utility or P10B-18C designer-grade/100+ quality. The exact next task is
**P10B-18B-03 — Collection / Search / Product-card Quality Upgrade**.

## P10B-18B-03 accepted authority addendum

The accepted bounded implementation strengthens AC-126, AC-128 and AC-138 without changing product
scope or canonical schema. The four existing collection/search profile IDs and five canonical card
anatomies remain stable. One deterministic presentation-only cardinality class (`micro`, `small`,
`medium`, `dense`) controls proportionate orientation, grid and filter posture without persisting or
rewriting catalogue truth. Facets with no decision value are suppressed unless selected; active
filters remain visible and operable.

Editorial discovery remains curated and collection-only; campaign discovery still requires an
approved purpose-affine asset; catalogue comparison uses standard fact-forward cards; dense
collection/search uses horizontal high-scanability cards. Comparison and dense profiles are both
truthfully executable in transient search-results context. Search renders explicit query/result/
filter/sort identity without synthetic collection claims through the same renderer and catalogue.
Applied filter fields and canonical stock states render as localized EN/FI merchant labels.
Medium/dense collection filters remain collapsible below 1024 px and become persistent only at the
desktop breakpoint; comparison search omits the collection-only sidebar and spans the result grid.

Exact pre-P10B-18B-03 comparison/compact and dense-search/compact profile fingerprints have one
deterministic compatibility migration to the current standard and horizontal anatomies. It
increments the root authority revision/fingerprint while preserving routes, mappings, protected
commerce, bounded presentation choices and approved assets. Unknown stale authorities remain
fail-closed, while direct runtime projection keeps saved, historical and compiled snapshots
renderable until the current authority is persisted.

The provider-facing compact capability now reports registered presentation plus
`canonical-transient-query-results`, `read-only-bounded` behavior and the
`p10b-16p-06-canonical-search-adapter` reason. Instructions explicitly exclude AI, semantic,
vector, fuzzy, personalized and Vesko-search claims. No provider schema changed and no external
provider or Vesko call occurred.

Status is **Baseline**, accepted by the product owner on 18 August 2026 for bounded collection,
search-results and canonical product-card quality only. Same-strata evidence records 39 normalized
topologies, 53/72 repeated memberships, a largest cluster of seven and 19 singletons; 21 retained
captures cover all four profiles, all five anatomies, search zero/one/multiple states, three
directions and all four responsive widths. This does not accept PDP, content/utility or P10B-18C
designer-grade/100+ quality. The exact next task is **P10B-18B-04 — PDP Quality Upgrade**.

## P10B-18B-04 accepted PDP quality authority

The accepted bounded package strengthens AC-126, AC-128 and AC-138 while retaining one canonical
product model, PDP PageBlueprint/profile library, dynamic renderer, option resolver, media authority,
related-card authority, shared frame and Design DNA. Exact per-product facts now classify bounded
configuration complexity, canonical media depth and decision-support need; no product-type taxonomy
or merchant branch is introduced. Fresh dynamic-commerce authority fingerprints those facts while
the additive optional schema fields keep historical `1.0.0` records readable.

The existing four PDP profiles gain clearer commercial purposes: proportionate standard purchase,
configuration-first variant led, commerce-aware rich-media gallery led and evidence-grounded high
consideration. Price, compare-at price, availability, option/dependency state, media order, related
IDs and the add-to-cart intent remain canonical and protected. Resolver failure retains visible
truth but disables purchase. Optional high-consideration support requires an exact current approved
evidence reference and omits cleanly when absent. P10B-18B-04 is **Baseline**, accepted by the
product owner on 19 August 2026. Its historical handoff was P10B-18B-05, subsequently accepted on
20 August 2026.

### P10B-18B-05 accepted authority Baseline (20 August 2026)

The accepted P10B-18B-05 Baseline strengthens the existing `contentSupport` and
`commerceUtility` families without adding a content model, utility renderer, cart/checkout/error
engine or page graph. Content variants consume approved fact documents, exact approved asset
placements and canonical navigation; unsupported appointment/topic-guide identities and media-free
image-led campaigns reclassify to truthful compatible profiles. Utility profile design remains
canonical while cart, query, error and loading payloads remain transient. This is focused
implementation/evidence. The product owner accepted the checkpoint on 20 August 2026. P10B-18B-05
and the completed P10B-18B parent are Baseline; P10B-18 and P10B remain Partial, accepted P10B-18B
denominators remain unchanged, and P10B-18C is the exact next task.

### P10B-18C accepted authority Baseline (22 August 2026)

The accepted deterministic gate compiles and replays all 126 exact complete-store cases, preserves
protected commerce/media and zero fabrication, records 54 normalized material topologies, and binds
a stable 28-store selector to a final 280-entry four-width EN/FI review with zero primary FAIL. The
overall human verdict is **PASS WITH MINOR LIMITATION**. This adds no second snapshot, page graph,
renderer, commerce model, provider path or production evaluation system. P10B-16P-05B subsequently
completed the consumer-proven cleanup and is Baseline. P10B-18D live-AI commercial storefront
diagnostic is complete with live commercial quality rejected. P10B-19 PRE is Baseline. P10B-19A-01
and P10B-19A-02 are Baseline, parent P10B-19A is Partial, and P10B-19A-03 is the exact next task.


### 10.29 P10B-16P-05B major repository and historical-authority cleanup

P10B-16P-05B is Baseline. It removes the one-time P10B-18C production-capture application,
superseded P9R acceptance runners and duplicated historical narratives after a consumer graph across
imports, routes, environment authority, scripts, CI, migrations and publication readers.

The normal semantic initial-generation path, P03 mocked Studio lifecycle, governed tagged P9
follow-up, stable migration/publication identities, 126-case/frozen-72 quality gates and protected
commerce/media remain. P04 is one lean token-protected, production-disabled mock/live seam for
P10B-18D and is unconditionally unavailable in production. No provider, Vesko or real publication
call occurred; merchant rendering, snapshots and generation selection are unchanged.

P10B remains Partial. P10B-18D is a Baseline diagnostic with live commercial quality rejected. The
locked order is P10B-19 PRE Baseline, P10B-19A-01 and P10B-19A-02 Baseline, P10B-19A Partial,
P10B-19A-03 next, then P10B-19A-04 through P10B-19A-10 and P10B-19B through P10B-19J.

### 10.30 P10B-18D live-AI diagnostic baseline

P10B-18D completed six authorized calls through the controlled provider-to-proposal path with the
same model, one locked prompt per call, a 120-second bounded timeout, zero retries, zero fallback
and no publication. The experiment and safe evidence are accepted; live commercial quality is
rejected.

Three concepts met prompt fidelity. Concepts 2 and 6 resolved to the exact same candidate snapshot,
structural fingerprint, normalized topology, direction, frame and principal authority. Concept 1
did not realize its dark gallery-luxury direction. Concept 6 did not realize Finnish bold
asymmetry, showed blank mobile media regions in retained evidence and did not complete post-save
reload plus seven-surface Preview proof. Missing evidence remains missing and is not reconstructed.

The safe record proves a concentration in current semantic expressiveness, exact compatibility
resolution and finite PageBlueprint/Visual Recipe/Design DNA/frame authority. It does not prove
that the provider emitted identical field-level intent. No canonical AI, compiler,
StorefrontSnapshot, commerce, media, proposal or publication contract changes in this diagnostic.
`P10B-18D = Baseline diagnostic / live commercial quality rejected`; `P10B-18 = Partial`;
`P10B = Partial`; `P10B-19 PRE = Baseline`; `P10B-19A-01 = Baseline`;
`P10B-19A-02 = Baseline`; `P10B-19A = Partial`; `P10B-19A-03 = Planned / exact next`;
P10B-19A-04 through P10B-19A-10 and P10B-19B through P10B-19J
remain Planned.

## P10B-19 structural design intelligence architecture baseline

P10B-19 PRE is Baseline following product-owner acceptance on 29 August 2026. The binding
architecture is `docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md`.

Future complete-storefront generation separates provider-owned, non-executable interpretation from
deterministic execution:

```text
merchant intent and approved references
-> AI Creative Brief
-> deterministic Structural Storefront Family assignment
-> PageBlueprint v2
-> bounded Visual Recipe preferences
-> deterministic BrandSystem / Design DNA v2 compilation
-> exact registered component realization
-> sole materializer and isolated proposal
-> bounded screenshot critique and human selection
-> existing StorefrontSnapshot lifecycle
```

Structural Storefront Families own merchant-neutral cross-page composition. Visual Recipe intent
owns merchant-specific visual preferences but remains transient; exact accepted values compile into
canonical `BrandSystem`. PageBlueprint v2 remains the one executable page-composition contract and
does not introduce another page graph. Existing v1 snapshots, profiles, Design DNA, saved drafts,
history, Preview, and publication remain readable without forced regeneration.

One page graph, one `StorefrontSnapshot`, one component registry, canonical Vesko commerce, exact
approved media lineage, one deterministic compiler/coordinator, one final materializer/executor,
proposal isolation, Accept/Reject, Undo/Redo, Save, reload, Preview, publication, and the Puck
adapter boundary remain binding. P10B remains Partial. P10B-19A-01 and P10B-19A-02 are Baseline,
parent P10B-19A is Partial, and P10B-19A-03 is the exact next task; P10B-19A-04 through P10B-19A-10 and P10B-19B
through P10B-19J remain Planned.

### 10.31 P10B-19A-01 structural family identity and lifecycle authority

P10B-19A-01 establishes `src/domain/structural-storefront-family` as the sole Structural Storefront
Family identity and lifecycle authority. The ordered, closed family-ID vocabulary is:

1. `editorial-offset`
2. `campaign-modular`
3. `product-first-commerce`
4. `technical-comparison`
5. `warm-narrative`
6. `restrained-gallery`

The family contract schema version and initial family record version are independently named and
both begin at `1.0.0`. Family record versions accept only canonical `major.minor.patch` values for
supported major `1`; prefixes, suffixes, prerelease/build metadata, whitespace, leading zeroes and
unsupported major versions fail closed. A family identity contains exactly `familyId` and
`familyVersion`, and its deterministic identity key is `<familyId>@<familyVersion>`. Duplicate
instances of the same exact identity reject with bounded, sorted evidence; the same family ID at a
different supported version and different family IDs at one version remain distinct identities.

The lifecycle vocabulary is exactly `candidate`, `active` and `deprecated`, with `candidate` as the
initial state. The only legal forward transitions are `candidate -> active`, `candidate ->
deprecated` and `active -> deprecated`. Candidate activation records the requirement for future
governed activation authority; this child does not implement that authority. Reverse, self,
unknown and identity-changing transitions fail closed. Only `active` is selectable.

Active family-record count and candidate registry-record count both remain zero. This child adds no
family registry, family records, candidate records, fingerprints, selector wiring, PageBlueprint
v2, rendering, migration, provider payload or current-generation consumption. Existing v1
generation, snapshots, protected commerce/media, proposal lifecycle, editor, preview, publication
and merchant-visible output remain unchanged.

`P10B-19A-01 = Baseline`; `P10B-19A = Partial`; `P10B-19A-02 = Planned / exact next`; `P10B =
Partial`.

### 10.32 P10B-19A-02 cross-page structural relationship authority

P10B-19A-02 adds one merchant-neutral, directed cross-page relationship contract under
`src/domain/structural-storefront-family`. Its exact structural page-family role vocabulary is
`home`, `collection`, `search`, `product-detail`, `content-support`, and `utility`. Its exact
relationship-kind vocabulary is `frame-continuity`, `navigation-continuity`,
`hierarchy-continuity`, `recurring-anchor`, `merchandising-continuity`, `commerce-transition`, and
`state-anatomy-boundary`.

Each strict readonly value object contains only `sourcePageFamilyId`, `relationshipKind`, and
`targetPageFamilyId`. Self relationships and duplicate exact triples fail closed. The deterministic
key is `<source>-><kind>-><target>`. Canonical collections sort by the declared source-role order,
then relationship-kind order, then target-role order. The contract intentionally permits the same
directed pair under different kinds, reverse relationships, cycles, disconnected sets, and empty
sets; it does not impose connectivity, root, reachability, or acyclicity policy.

This contract is not a page graph, route model, PageBlueprint v2 region graph, snapshot field,
registry, selector, renderer or persistence authority. Active family-record count, candidate
registry-record count, persisted relationship count, production-selected relationship count and
current-generation consumer count all remain zero. Existing StorefrontSnapshot, PageBlueprint v1,
site-map, route, navigation, shared-frame, component, commerce, media, proposal, Puck and
publication authority remains unchanged.

`P10B-19A-01 = Baseline`; `P10B-19A-02 = Baseline`; `P10B-19A = Partial`;
`P10B-19A-03 = Planned / exact next`; `P10B = Partial`.
