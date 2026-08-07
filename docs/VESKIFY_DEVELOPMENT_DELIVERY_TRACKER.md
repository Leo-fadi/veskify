# Veskify Development Delivery Tracker

## Document control

| Field                       | Value                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Version                     | 1.3.0                                                                                                               |
| Baseline                    | 7 August 2026, current `main` after PR #170                                                                         |
| Active development phase    | P10B — Commercial Storefront Design System v1 (**Planned**)                                                         |
| Overall product status      | **Partial**                                                                                                         |
| Authoritative specification | [`VESKIFY_SDD.md`](VESKIFY_SDD.md)                                                                                  |
| Delivery order              | [`VESKIFY_DEVELOPMENT_ROADMAP.md`](VESKIFY_DEVELOPMENT_ROADMAP.md)                                                  |
| Checkbox rule               | A checked box means the complete stated outcome and evidence gate are satisfied; an unchecked box means incomplete. |

Implementation status and evidence level are separate. A task is not done because a contract, test,
or partial implementation exists. The checkbox changes only when the task's complete outcome and
required evidence are accepted.

## Overall phase checklist

| Done | Task | Outcome                                                | Status                | Owner                                | Dependency                                | Required evidence                                                                                        |
| ---- | ---- | ------------------------------------------------------ | --------------------- | ------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ☑    | P10A | Grounded orchestration and publishing closure          | **Baseline / closed** | Veskify orchestration and publishing | Phase 9 handoff                           | Controlled-provider where eligible; deterministic; integration; browser/E2E; retained publication review |
| ☐    | P10B | Commercial Storefront Design System v1                 | **Planned**           | Veskify design system                | P10A closure                              | Capability chain; responsive browser/E2E; retained human commercial review                               |
| ☐    | P10C | Storefront Studio Editing Experience v1                | **Planned**           | Storefront Studio                    | P10B commercial authority                 | Integration; browser/E2E; retained human commercial review                                               |
| ☐    | P10D | Advanced media and registered interactive presentation | **Planned**           | Design system and media              | Relevant P10B authority                   | Contract; browser/E2E; accessibility; performance; fallback review                                       |
| ☐    | P11  | Vesko Integration Readiness and Reference Adapter      | **Blocked**           | Veskify + Vesko platform             | Contract decisions; P10A and minimum P10C | Adapter conformance; browser/E2E; Vesko staging                                                          |
| ☐    | P12  | Production hardening and pilot operations              | **Blocked**           | Veskify + Vesko platform/operations  | P11 staging exit                          | Security; load; recovery; monitoring; controlled production pilot                                        |

## P10A checklist

| Done | Task         | Outcome                                          | Status       | Owner                | Dependency                                                  | Required evidence                                                                                    |
| ---- | ------------ | ------------------------------------------------ | ------------ | -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ☑    | P10A-07C-03R | Controlled real-provider acceptance completion   | **Baseline** | Provider acceptance  | Explicit approval and eligible trusted OpenAI configuration | One initial case before one follow-up case; retained real-provider evidence; no retry                |
| ☑    | P10A-08B-02  | Accepted-AI acceptance-to-receipt wiring         | **Baseline** | Proposal/publishing  | Existing acceptance, receipt, and gateway authority         | Deterministic; integration; browser/E2E; stale/divergent/no-partial-write rejection                  |
| ☑    | P10A-08C-02B | Atomic compiled publication and rollback closure | **Baseline** | Publishing           | P10A-08B-02 and deterministic compiler                      | Atomic artifact/version/history persistence; idempotency; rollback/republish evidence                |
| ☑    | P10A-08D-02  | Complete publication evidence                    | **Baseline** | Publishing and QA    | P10A-08C-02B                                                | Gateway/compiler home, collection, PDP; failure; active version; rollback; zero-provider publication |
| ☑    | P10A-09      | P10A closure record                              | **Baseline** | Product architecture | Prior P10A closure tasks or explicit disposition            | Accepted closure and evidence coverage record                                                        |

## P10B checklist

| Done | Task    | Outcome                                         | Status      | Owner                                   | Dependency              | Required evidence                                                      |
| ---- | ------- | ----------------------------------------------- | ----------- | --------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| ☐    | P10B-01 | Executable commercial vocabulary                | **Planned** | Design system                           | P10A closure            | Contract/schema and deterministic reachability                         |
| ☐    | P10B-02 | Semantic visual foundations                     | **Planned** | Design system                           | P10B-01                 | Contract, migration, renderer integration, responsive browser evidence |
| ☐    | P10B-03 | Responsive image and art-direction authority    | **Planned** | Design system and media                 | P10B-01, P10B-02        | Contract, integration, responsive browser evidence                     |
| ☐    | P10B-04 | Premium shared frame                            | **Planned** | Design system                           | P10B-02, P10B-03        | Capability-chain and responsive human review                           |
| ☐    | P10B-05 | Hero, editorial, campaign, and proof families   | **Planned** | Design system                           | P10B-02, P10B-03        | Proposal/compiler/render reachability and visual review                |
| ☐    | P10B-06 | Canonical product-card and merchandising system | **Planned** | Design system and commerce presentation | P10B-02, P10B-03        | Commerce regression, capability chain, visual review                   |
| ☐    | P10B-07 | Commercial collection profiles                  | **Planned** | Design system                           | P10B-04 through P10B-06 | Materialization-to-render evidence and visual review                   |
| ☐    | P10B-08 | Commercial PDP profiles                         | **Planned** | Design system and commerce presentation | P10B-04 through P10B-06 | Dynamic-commerce regression and visual review                          |
| ☐    | P10B-09 | Coordinated storefront directions v2            | **Planned** | Design system                           | P10B-04 through P10B-08 | Exact selection and complete-storefront differentiation evidence       |
| ☐    | P10B-10 | Narrative composition                           | **Planned** | Design system and generation            | P10B-05 through P10B-09 | Proposal/compiler/snapshot preservation and human review               |
| ☐    | P10B-11 | Responsive commercial closure                   | **Planned** | Design system and QA                    | P10B-02 through P10B-10 | Browser matrix at 375, 768, 1024, 1440 px and accessibility checks     |
| ☐    | P10B-12 | Commercial visual-quality gate                  | **Planned** | Product owner, design system, QA        | All prior P10B tasks    | Retained screenshots and explicit human acceptance                     |

## P10C checklist

| Done | Task    | Outcome                                  | Status      | Owner                                | Dependency                                | Required evidence                                         |
| ---- | ------- | ---------------------------------------- | ----------- | ------------------------------------ | ----------------------------------------- | --------------------------------------------------------- |
| ☐    | P10C-01 | Brand asset library                      | **Planned** | Storefront Studio and media          | P10B asset authority                      | Contract, integration, browser/E2E                        |
| ☐    | P10C-02 | Asset roles and provenance               | **Planned** | Storefront Studio and media          | P10C-01                                   | Assignment validation and browser evidence                |
| ☐    | P10C-03 | Canonical Puck boundary                  | **Planned** | Storefront Studio                    | P10B component/profile authority          | Adapter conformance and save/reload preservation          |
| ☐    | P10C-04 | Stable frame identity and selection      | **Planned** | Storefront Studio                    | P10C-03                                   | Frame/page scope integration and browser/E2E              |
| ☐    | P10C-05 | Approved manual frame operations         | **Planned** | Storefront Studio                    | P10C-02 through P10C-04                   | Positive/fail-closed integration, undo/redo, browser/E2E  |
| ☐    | P10C-06 | Scoped AI editing                        | **Planned** | Storefront Studio and design agent   | P10C-03 through P10C-05; P10A authorities | Scope, ambiguity, and proposal lifecycle browser evidence |
| ☐    | P10C-07 | Unified AI/manual history                | **Planned** | Storefront Studio and state          | P10C-05, P10C-06                          | Mixed-operation atomicity, save/reload, undo/redo         |
| ☐    | P10C-08 | Brand and asset editor with Studio shell | **Planned** | Storefront Studio                    | P10C-01 through P10C-07                   | UI states, responsive accessibility, browser/E2E          |
| ☐    | P10C-09 | Studio commercial QA                     | **Planned** | Product owner, Storefront Studio, QA | P10C-08 and P10B-12                       | Full select-to-publish browser chain and human review     |

## P11 checklist

| Done | Task   | Outcome                                                    | Status       | Owner                               | Dependency                                    | Required evidence                                                     |
| ---- | ------ | ---------------------------------------------------------- | ------------ | ----------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| ☑    | P11-00 | Vesko OpenAPI audit                                        | **Baseline** | Veskify architecture                | Obtained OpenAPI 3.0 document                 | Contract audit and integration matrix                                 |
| ☐    | P11-01 | Backend contract closure and ownership                     | **Blocked**  | Veskify + Vesko platform            | Vesko platform decisions                      | Approved typed contracts and ownership record                         |
| ☐    | P11-02 | Identity and store-context adapter                         | **Blocked**  | Veskify + Vesko platform            | P11-01                                        | Auth/tenant adapter conformance and staging                           |
| ☐    | P11-03 | Catalogue and navigation projection                        | **Blocked**  | Veskify + Vesko commerce            | P11-01, P11-02                                | Read-only adapter conformance and staging                             |
| ☐    | P11-04 | Variant, option, price, availability and media conformance | **Blocked**  | Veskify + Vesko commerce            | P11-03                                        | Simple/configurable product conformance and staging                   |
| ☐    | P11-05 | Approved presentation-asset service                        | **Blocked**  | Veskify + Vesko media               | P11-01, P11-02, media ownership               | Provenance, permissions, lifecycle, staging                           |
| ☐    | P11-06 | Storefront draft and history persistence                   | **Blocked**  | Veskify + Vesko platform            | P11-01, P11-02, persistence/revision contract | Concurrency and canonical save/reload/restore in staging              |
| ☐    | P11-07 | Accepted receipt and publication adapter                   | **Blocked**  | Veskify + Vesko platform            | P10A closure; P11-01, P11-02, P11-06          | Receipt/gateway/compiler/artifact conformance and staging publication |
| ☐    | P11-08 | Synchronization, revisions, errors and caching             | **Blocked**  | Veskify + Vesko platform            | P11-03 through P11-07                         | Conflict, retry, cache, and recovery integration                      |
| ☐    | P11-09 | Vesko staging conformance                                  | **Blocked**  | Veskify + Vesko platform + QA       | P11-02 through P11-08; minimum P10C           | Browser/E2E and correlated Vesko staging evidence                     |
| ☐    | P11-10 | Pilot readiness                                            | **Blocked**  | Product owner + Veskify/Vesko leads | P11-09                                        | One real pilot with signed evidence and documented limitations        |

## Task definitions

### P10A — Grounded orchestration and publishing closure

#### P10A-07C-03R — Controlled real-provider acceptance completion

- **Outcome:** Execute exactly one eligible initial-generation case, then one follow-up-editing
  case, through the controlled real-provider boundary.
- **Status:** **Baseline**. Completed 7 August 2026 with one successful initial-generation call
  before one successful hero follow-up call, safe retained evidence, and no retry.
- **Depends on:** Explicit approval and eligible trusted OpenAI provider/model configuration.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Safe correlated real-provider evidence; initial succeeds before follow-up;
  no retry.
- **Non-goal:** Provider redesign, synthetic success, retry, or merchant editor wiring.

#### P10A-08B-02 — Accepted-AI acceptance-to-receipt wiring

- **Outcome:** Authoritative proposal acceptance mints and persists the exact server-owned
  accepted-snapshot receipt, and the active publish gateway resolves it.
- **Status:** **Baseline**.
- **Depends on:** Existing proposal acceptance, receipt repository, and publishing gateway.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Exact lineage, create-once persistence, manual/AI separation, stale and
  accept-then-undo rejection, and no partial write.
- **Non-goal:** Browser-created receipt authority or fallback to manual publication.

#### P10A-08C-02B — Atomic compiled publication and rollback closure

- **Outcome:** Commit the compiled artifact, published snapshot, publication history, and active
  version atomically; preserve the existing live version on failure; restore to draft and change
  live state only through explicit republish.
- **Status:** **Baseline**.
- **Depends on:** P10A-08B-02 and the current deterministic publish compiler.
- **Done:** One authoritative transaction retains the snapshot, artifact, version/history,
  operation, and active pointer; failures preserve prior live state; historical versions restore
  only to a new draft and require a fresh explicit publish.
- **Required evidence:** Deterministic identity, atomicity, idempotency, active-pointer safety,
  rollback, republish, and failure preservation.
- **Non-goal:** A second editable state model or copied commerce snapshot.

#### P10A-08D-02 — Complete publication evidence

- **Outcome:** Prove manual and accepted-AI compile/publish, exact homepage/collection/PDP
  rendering, failure atomicity, draft/published isolation, restore, and republish with zero provider
  calls during publication.
- **Status:** **Baseline**.
- **Depends on:** P10A-08C-02B.
- **Done:** Manual and accepted-AI authority are correlated through preparation, deterministic
  compilation, atomic artifact/version publication, the active pointer, and exact published home,
  collection, and PDP routes. Browser and repository evidence also preserves live state on stale
  or injected failure, isolates later draft edits, restores history only to a new draft, and creates
  a fresh version on explicit republish with zero external provider calls during publication.
- **Required evidence:** Browser/E2E and retained manual evidence correlated to compiled version,
  including no-partial-write and zero-provider publication.
- **Non-goal:** P10B commercial visual acceptance.

#### P10A-09 — Closure record

- **Outcome:** Synchronize evidence, limitations, README, SDD, roadmap, and exports and formally
  close P10A.
- **Status:** **Baseline**. Completed 7 August 2026; see
  [`P10A_PHASE_CLOSURE.md`](P10A_PHASE_CLOSURE.md).
- **Depends on:** All remaining P10A tasks or explicit product-owner disposition.
- **Done:** All 20 exit items were classified explicitly, every required P10A item passed at
  Baseline, active documentation was synchronized, and P10B became the next active development
  phase while remaining Planned.
- **Required evidence:** Traceable closure record.
- **Non-goal:** Merchant-facing routing, clarification, or scope controls; those belong to P10C.

### P10B — Commercial Storefront Design System v1

#### P10B-01 — Executable commercial vocabulary

- **Outcome:** Make typography, layout, surface, media, component, and responsive vocabulary
  enforceable through existing authority without arbitrary CSS or a second token store.
- **Status:** **Planned**.
- **Depends on:** P10A closure and accepted P10B audit/specification.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Contract/schema and deterministic runtime-queryability.
- **Non-goal:** A second vocabulary, registry, recipe, or token system.

#### P10B-02 — Semantic visual foundations

- **Outcome:** Make every storefront surface consume coherent typography, spacing, containers,
  surfaces, borders, radius, elevation, controls, and density.
- **Status:** **Planned**.
- **Depends on:** P10B-01.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Schema/migration, renderer integration, responsive browser evidence.
- **Non-goal:** Arbitrary CSS or direction-owned global tokens.

#### P10B-03 — Responsive image and art-direction authority

- **Outcome:** Give approved images bounded focal points, safe areas, crops, ratios, overlays, and
  responsive derivatives without replacing canonical product media.
- **Status:** **Planned**.
- **Depends on:** P10B-01, P10B-02.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Provenance/role validation and responsive browser evidence.
- **Non-goal:** Mutating Vesko media or unrestricted image generation.

#### P10B-04 — Premium shared frame

- **Outcome:** Make header, navigation, announcement, and footer systems commercially distinct and
  coherent across desktop/mobile and EN/FI.
- **Status:** **Planned**.
- **Depends on:** P10B-02, P10B-03.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Full capability chain and human responsive review.
- **Non-goal:** Merchant editor frame controls.

#### P10B-05 — Hero, editorial, campaign, and proof families

- **Outcome:** Provide meaningful registered first-impression, storytelling, promotion, and
  evidence-backed trust compositions without generic filler.
- **Status:** **Planned**.
- **Depends on:** P10B-02, P10B-03.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Proposal-to-render reachability and retained visual review.
- **Non-goal:** Invented claims, trust marks, certifications, or arbitrary sections.

#### P10B-06 — Canonical product-card and merchandising system

- **Outcome:** Establish one protected card authority with materially distinct editorial, dense,
  compact, and image-led merchandising across home, collection, and recommendations.
- **Status:** **Planned**.
- **Depends on:** P10B-02, P10B-03.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Protected-commerce regression, capability chain, visual review.
- **Non-goal:** Product, price, stock, variant, or availability ownership.

#### P10B-07 — Commercial collection profiles

- **Outcome:** Make editorial discovery, catalogue comparison, and campaign-led collection profiles
  differ materially in hierarchy, filters, child collections, density, and cards.
- **Status:** **Planned**.
- **Depends on:** P10B-04 through P10B-06.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Exact materialization, proposal/compiler/snapshot/render preservation, human
  review.
- **Non-goal:** A second collection template engine.

#### P10B-08 — Commercial PDP profiles

- **Outcome:** Make standard, high-consideration, gallery-led, and variant-led PDPs provide distinct
  purchase experiences while preserving generic options and commerce truth.
- **Status:** **Planned**.
- **Depends on:** P10B-04 through P10B-06.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Simple watch, complex ring, incomplete/unavailable selection, selected
  variant price/availability/media, fallback, and visual review.
- **Non-goal:** Product-type-specific forks or copied commerce facts.

#### P10B-09 — Coordinated storefront directions v2

- **Outcome:** Make Premium Editorial, Modern Technical, and Minimal Commerce complete coordinated
  cross-page packages rather than colour-only themes.
- **Status:** **Planned**.
- **Depends on:** P10B-04 through P10B-08.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Exact materialized component/variant matches and complete-storefront
  differentiation.
- **Non-goal:** A second token, recipe, PageBlueprint, or page authority.

#### P10B-10 — Narrative composition

- **Outcome:** Give pages coherent commercial narrative roles, visual weight, adjacency, and
  omission rules.
- **Status:** **Planned**.
- **Depends on:** P10B-05 through P10B-09.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Governed proposal expression, compiler/snapshot preservation, human review.
- **Non-goal:** Unverified merchant claims or free-form generated pages.

#### P10B-11 — Responsive commercial closure

- **Outcome:** Preserve deliberate hierarchy and usability for every direction at 375, 768, 1024,
  and 1440 px.
- **Status:** **Planned**.
- **Depends on:** P10B-02 through P10B-10.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Complete browser matrix, accessibility checks, retained screenshots.
- **Non-goal:** Desktop-only approval or isolated component snapshots.

#### P10B-12 — Commercial visual-quality gate

- **Outcome:** Establish that a serious retailer can publish the generated complete storefront
  without a designer rebuilding it.
- **Status:** **Planned**.
- **Depends on:** All prior P10B tasks.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Correlated home, collection, simple PDP, configurable PDP, all directions,
  EN/FI, all target widths, credible assets, and explicit retained human acceptance with no generic
  starter-theme appearance.
- **Non-goal:** Closure through schemas, test counts, placeholders, or automated screenshots alone.

### P10C — Storefront Studio Editing Experience v1

#### P10C-01 — Brand asset library

- **Outcome:** Let merchants view and choose approved presentation assets in Storefront Studio.
- **Status:** **Planned**.
- **Depends on:** P10B asset authority.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Contract, integration, browser/E2E.
- **Non-goal:** Product-media replacement or generic DAM scope.

#### P10C-02 — Asset roles and provenance

- **Outcome:** Show and preserve role, source, approval, revision, and assignment authority.
- **Status:** **Planned**.
- **Depends on:** P10C-01.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Valid assignment and stale/unknown/role-mismatch rejection.
- **Non-goal:** Untyped uploads or hidden provenance.

#### P10C-03 — Canonical Puck boundary

- **Outcome:** Project registered canonical content into Puck and validate edits back into the same
  `StorefrontSnapshot`.
- **Status:** **Planned**.
- **Depends on:** P10B component/profile authority.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Adapter conformance and save/reload preservation.
- **Non-goal:** Raw Puck persistence or a second page tree.

#### P10C-04 — Stable frame identity and selection

- **Outcome:** Select and edit one shared frame consistently from every page context.
- **Status:** **Planned**.
- **Depends on:** P10C-03.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Stable identity, scope, history, and browser behavior.
- **Non-goal:** Duplicating frame state per page.

#### P10C-05 — Approved manual frame operations

- **Outcome:** Support bounded manual shared-frame add, remove, reorder, field, asset, and
  presentation operations.
- **Status:** **Planned**.
- **Depends on:** P10C-02 through P10C-04.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Positive and fail-closed integration, undo/redo, browser/E2E.
- **Non-goal:** Arbitrary code/CSS/components or commerce mutation.

#### P10C-06 — Scoped AI editing

- **Outcome:** Connect merchant routing, clarification, frame/page scope, and proposal review to the
  existing P10A governed authorities.
- **Status:** **Planned**.
- **Depends on:** P10C-03 through P10C-05 and P10A internal router/packages.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Selected-section, frame, page, storefront, ambiguity, stale, and failure
  browser flows.
- **Non-goal:** Rebuilding the router, packages, proposals, or provider boundary.

#### P10C-07 — Unified AI/manual history

- **Outcome:** Put manual and accepted AI operations into one atomic canonical undo/redo history.
- **Status:** **Planned**.
- **Depends on:** P10C-05, P10C-06.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Mixed edits, undo/redo, save/reload, stale protection.
- **Non-goal:** A Puck-only or AI-only history.

#### P10C-08 — Brand and asset editor with Studio shell

- **Outcome:** Deliver the merchant shell subset required to operate assets, canvas, review, save,
  preview, and publish.
- **Status:** **Planned**.
- **Depends on:** P10C-01 through P10C-07.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Default/loading/empty/error/stale/success/unsaved states, accessibility,
  responsive browser/E2E.
- **Non-goal:** Full CMS or exposure of implementation internals.

#### P10C-09 — Studio commercial QA

- **Outcome:** Complete select frame → manual edit → bounded AI edit elsewhere → add/remove/reorder
  → undo/redo → save → preview → publish.
- **Status:** **Planned**.
- **Depends on:** P10C-08 and P10B-12.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Complete browser/E2E chain and retained human commercial review.
- **Non-goal:** Reopening P10B design-system scope.

### P10D — Advanced media and registered interactive presentation

#### P10D — Governed advanced media

- **Outcome:** Add justified generated imagery, registered video, and registered GLTF/GLB/Three.js
  presentation with accessible, performant static fallbacks.
- **Status:** **Planned**.
- **Depends on:** Relevant P10B component and asset authority.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Provenance, contract, browser/E2E, accessibility, performance, fallback
  review.
- **Non-goal:** AI-generated implementation code or a dependency for the first commercial store,
  minimum editor, or Vesko pilot.

### P11 — Vesko Integration Readiness and Reference Adapter

#### P11-00 — Vesko OpenAPI audit

- **Outcome:** Establish the real endpoint inventory, usable surfaces, incompatibilities, missing
  authority, and integration decisions.
- **Status:** **Baseline**.
- **Depends on:** Obtained Vesko OpenAPI 3.0 contract.
- **Done when:** The obtained contract audit and integration matrix are accepted.
- **Required evidence:** [`VESKO_OPENAPI_CONTRACT_AUDIT.md`](VESKO_OPENAPI_CONTRACT_AUDIT.md) and
  [`VESKO_VESKIFY_INTEGRATION_MATRIX.md`](VESKO_VESKIFY_INTEGRATION_MATRIX.md).
- **Non-goal:** Claiming that the contract is sufficient or that an adapter is implemented.

#### P11-01 — Backend contract closure and ownership

- **Outcome:** Agree security, tenant context, typed responses, revisions, errors, navigation,
  missing Veskify APIs, and ownership with Vesko backend owners.
- **Status:** **Blocked**.
- **Depends on:** Vesko platform decisions.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Approved contracts and ownership matrix.
- **Non-goal:** Coding against inferred bodies or changing Veskify canonical models to raw API
  shapes.

#### P11-02 — Identity and store-context adapter

- **Outcome:** Resolve trusted tenant, store, user, permission, locale, subdomain, and custom-domain
  context.
- **Status:** **Blocked**.
- **Depends on:** P11-01.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Adapter conformance, authorization/tenant isolation, Vesko staging.
- **Non-goal:** Browser-submitted or global implicit store authority.

#### P11-03 — Catalogue and navigation projection

- **Outcome:** Map products, brands, categories/collections, product groups, merchandising order,
  and routes into one versioned read-only projection.
- **Status:** **Blocked**.
- **Depends on:** P11-01, P11-02.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Typed adapter conformance and staging reads.
- **Non-goal:** Veskify catalogue/navigation writes.

#### P11-04 — Variant, option, price, availability and media conformance

- **Outcome:** Prove variants, options, price, availability, and media for simple and configurable
  products without apparel-specific frontend assumptions.
- **Status:** **Blocked**.
- **Depends on:** P11-03.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Simple watch, complex ring, missing/unknown states, and Vesko staging.
- **Non-goal:** Duplicating commerce resolution or mutating commerce facts.

#### P11-05 — Approved presentation-asset service

- **Outcome:** Give approved logo, campaign, and editorial assets typed identity, role, revision,
  approval, derivatives, and retention separate from canonical product media.
- **Status:** **Blocked**.
- **Depends on:** P11-01, P11-02, and Vesko media ownership decision.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Typed lifecycle, permissions, provenance, and staging.
- **Non-goal:** Overwriting product media or storing unapproved assets as canonical.

#### P11-06 — Storefront draft and history persistence

- **Outcome:** Persist authenticated tenant-scoped revisioned `StorefrontSnapshot` drafts, immutable
  history, and restore-to-draft.
- **Status:** **Blocked**.
- **Depends on:** P11-01, P11-02, and persistence/revision contract.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Adapter conformance, conflict behavior, save/reload/restore in staging.
- **Non-goal:** Raw `/puck` persistence.

#### P11-07 — Accepted receipt and publication adapter

- **Outcome:** Persist accepted authority, compiled artifacts, publication history, and active
  version through an authenticated idempotent transaction.
- **Status:** **Blocked**.
- **Depends on:** P10A closure, P11-01, P11-02, P11-06.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Receipt/gateway/compiler/artifact conformance and staging publication.
- **Non-goal:** Browser publication, manual/AI authority collapse, or commerce writes.

#### P11-08 — Synchronization, revisions, errors and caching

- **Outcome:** Expose commerce/media revision and synchronization authority, typed stale/conflict
  errors, retry policy, and bounded caching.
- **Status:** **Blocked**.
- **Depends on:** P11-03 through P11-07.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Conflict, retry, cache, and recovery integration in staging.
- **Non-goal:** Silent last-write-wins or unbounded retry.

#### P11-09 — Vesko staging conformance

- **Outcome:** Complete Vesko identity/catalogue → Veskify projection → generate → edit → save →
  publish → render → change Vesko commerce → refresh without presentation corruption.
- **Status:** **Blocked**.
- **Depends on:** P11-02 through P11-08 and the minimum P10C editor.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Correlated browser/E2E and Vesko staging record.
- **Non-goal:** Production readiness claim.

#### P11-10 — Pilot readiness

- **Outcome:** Prove one real pilot has onboarding, diagnostics, audit records, observability,
  recovery guidance, and documented limitations.
- **Status:** **Blocked**.
- **Depends on:** P11-09.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Signed pilot-readiness and operational handoff record.
- **Non-goal:** Automatic production rollout.

### P12 — Production hardening and pilot operations

#### P12 — Production and pilot closure

- **Outcome:** Establish authentication, tenant isolation, security, observability, performance,
  backup/recovery, deployment, incidents, and controlled pilot operations.
- **Status:** **Blocked**.
- **Depends on:** P11-10.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Security/load/recovery exercises, production telemetry, and controlled pilot
  evidence.
- **Non-goal:** New design, editor, advanced-media, or commerce scope.
