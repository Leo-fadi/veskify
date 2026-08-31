# Veskify Development Delivery Tracker

## Document control

| Field                       | Value                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Version                     | 1.3.0                                                                                                               |
| Baseline                    | 19 August 2026, accepted P10B-18B-04 PDP quality upgrade                                                            |
| Active development phase    | P10B — Commercial Storefront Generation System v1 (**Partial**)                                                     |
| Overall product status      | **Partial**                                                                                                         |
| Authoritative specification | [`VESKIFY_SDD.md`](VESKIFY_SDD.md)                                                                                  |
| Delivery order              | [`VESKIFY_DEVELOPMENT_ROADMAP.md`](VESKIFY_DEVELOPMENT_ROADMAP.md)                                                  |
| Checkbox rule               | A checked box means the complete stated outcome and evidence gate are satisfied; an unchecked box means incomplete. |

Implementation status and evidence level are separate. A task is not done because a contract, test,
or partial implementation exists. The checkbox changes only when the task's complete outcome and
required evidence are accepted.

## Overall phase checklist

- [ ] DEVX-01 - Contract-driven development and CI execution enablement
  - [x] DEVX-01A - Sprint contract and independent verification protocol
  - [x] DEVX-01B - Mechanical contract and verifier-verdict enforcement
  - [x] DEVX-01C - CI timings, obsolete-run cancellation and Next build caching
  - [x] DEVX-01D - Parallel static, Vitest and production-build jobs
  - [x] DEVX-01E - Playwright timing inventory and balanced execution groups
  - [x] DEVX-01F - Playwright sharding/matrix, merged reports and stable required aggregator
  - [x] DEVX-01F2 - Contention-safe Vitest sharding
  - [ ] DEVX-01G - Two-run performance acceptance and workflow closure (**exact next engineering task**)

| Done | Task | Outcome                                                | Status                | Owner                                | Dependency                                | Required evidence                                                                                        |
| ---- | ---- | ------------------------------------------------------ | --------------------- | ------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ☑    | P10A | Grounded orchestration and publishing closure          | **Baseline / closed** | Veskify orchestration and publishing | Phase 9 handoff                           | Controlled-provider where eligible; deterministic; integration; browser/E2E; retained publication review |
| ☐    | P10B | Commercial Storefront Generation System v1             | **Partial**           | Veskify storefront generation        | P10A closure                              | Capability chain; 100+ diversity analysis; browser/E2E; retained human commercial review                 |
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

| Done | Task         | Outcome                                              | Status                                     | Owner                                    | Dependency                                | Required evidence                                                                                                                                                                           |
| ---- | ------------ | ---------------------------------------------------- | ------------------------------------------ | ---------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☑    | P10B-01      | Commercial grammar and compatibility vocabulary      | **Baseline**                               | Canonical design contracts               | P10A closure; architecture lock           | Schema/queryability, migration, compatibility and typed rejection                                                                                                                           |
| ☑    | P10B-02      | Parametric BrandSystem / Design DNA                  | **Baseline**                               | BrandSystem                              | P10B-01                                   | Cross-page projection, migration, responsive and lifecycle evidence                                                                                                                         |
| ☑    | P10B-03      | Component anatomy and meaningful variant contract    | **Baseline**                               | Component platform                       | P10B-01                                   | 29 definitions/126 variants; structural, query, migration and rejection evidence                                                                                                            |
| ☑    | P10B-04      | Responsive image and art-direction authority         | **Baseline**                               | Asset presentation and media             | P10B-02, P10B-03                          | 35-case authority, integration/lifecycle and four-width browser evidence                                                                                                                    |
| ☑    | P10B-05      | Veskify site-map and page-family authority           | **Baseline**                               | PageBlueprint/storefront domain          | P10B-01                                   | Page-set/navigation/generation/lifecycle and rejection evidence                                                                                                                             |
| ☑    | P10B-06      | Commercial shared-frame families                     | **Baseline**                               | Shared frame                             | P10B-02, P10B-03, P10B-05                 | Four frames, three mobile modes, four footers, lifecycle and retained browser review                                                                                                        |
| ☑    | P10B-07      | Hero, editorial, campaign and proof families         | **Baseline**                               | Commercial content families              | P10B-02 through P10B-05                   | Six heroes, story/campaign/proof chain, provenance and four-width browser review                                                                                                            |
| ☑    | P10B-08      | Canonical product-card and merchandising family      | **Baseline**                               | Commerce presentation                    | P10B-02 through P10B-04                   | One renderer; five anatomies; protected facts/media; lifecycle and four-width browser evidence                                                                                              |
| ☑    | P10B-09      | Commercial homepage profile library                  | **Baseline**                               | PageBlueprint profiles                   | P10B-05 through P10B-08                   | Six profiles, materialization-to-render and 24-view visual review                                                                                                                           |
| ☑    | P10B-10      | Commercial collection and search profiles            | **Baseline**                               | Collection/search presentation           | P10B-04 through P10B-06, P10B-08          | Four profiles, exact commerce/intents, lifecycle and 16-view browser review                                                                                                                 |
| ☑    | P10B-11      | Commercial PDP profile library                       | **Baseline**                               | PDP presentation                         | P10B-03 through P10B-06, P10B-08          | Four profiles, generic options/commerce and visual review                                                                                                                                   |
| ☑    | P10B-12      | Content and support page families                    | **Baseline**                               | Content page presentation                | P10B-03 through P10B-07                   | 15 profiles, approved facts, localization, lifecycle, and 61 Chromium checks                                                                                                                |
| ☑    | P10B-13      | Commerce utility presentation pages                  | **Baseline**                               | Utility presentation                     | P10B-03, P10B-05, P10B-06, P10B-08        | Six profiles plus route-local loading, canonical action boundary, snapshot/publication preservation, 16 responsive views                                                                    |
| ☑    | P10B-14      | Premium Editorial complete-storefront vertical slice | **Baseline**                               | Storefront generation and QA             | Minimum P10B-02 through P10B-13           | 17 routes; canonical generation/save/publish; 15 screenshots; passing 160-scenario human review                                                                                             |
| ☑    | P10B-15      | Bounded storefront synthesis and narrative engine    | **Baseline**                               | Storefront generation                    | P10B-14                                   | 25-case matrix; three complete outcomes; lifecycle; four-width browser; 480-scenario retained human review                                                                                  |
| ☑    | P10B-16      | Coordinated directions and diversity control         | **Baseline**                               | Direction/evaluation authority           | P10B-15                                   | Three packages; nine outcomes; fingerprint/classification/repetition control; browser and retained human review                                                                             |
| ☑    | P10B-16P-01  | Dynamic commerce route archetype authority           | **Baseline**                               | Storefront domain/runtime routes         | P10B-16 and dynamic profile authority     | Cardinality, mapping/migration, editor projection, lifecycle/compiler/publication and exact route/browser evidence                                                                          |
| ☑    | P10B-16P-02  | Prompted design-plan contract                        | **Baseline**                               | Provider/design-plan authority           | P10B-16P-01                               | Strict intent/mock evidence, bounded metadata compiler, exact current-authority synthesis/proposal and no-partial lifecycle evidence                                                        |
| ☑    | P10B-16P-02A | Prompted Storefront Design Intent V2                 | **Baseline**                               | Provider contract/adapter                | P10B-16P-01                               | Safe capability/request projection, strict intent/reference/fingerprint/failure tests and mocked OpenAI transport                                                                           |
| ☑    | P10B-16P-02B | Deterministic design-intent compiler                 | **Baseline**                               | Design-plan compiler                     | P10B-16P-02A                              | Exact refreshed-authority resolution, bounded metadata compilation, canonical one-shot synthesis/proposal, diagnostics and stale/incompatible/no-partial rejection                          |
| ☑    | P10B-16P-03  | Storefront Studio generation journey                 | **Baseline**                               | Storefront Studio/generation             | P10B-16P-02B                              | Standalone/mock authority; integrated auth fail-closed; one registered operation; exact source/lineage/evidence; full mocked lifecycle and browser/E2E                                      |
| ☑    | P10B-16P-04  | Live V2 acceptance and bridge disposition            | **Baseline**                               | Provider acceptance/architecture         | P10B-16P-03                               | Safe 16-call ledger; final A/B/C; C full lifecycle; protected commerce/media; Deprecated P10B-16L                                                                                           |
| ☑    | P10B-16P-05A | Active production-path and compiler rationalisation  | **Baseline**                               | Generation route/compiler                | P10B-16P-04                               | One semantic initial-generation composition; one coordinator/resolver/decision/executor chain; A/B/C replay; migration/publication/protected-state regressions                              |
| ☑    | P10B-16P-06  | Canonical search query/results adapter               | **Baseline**                               | Search runtime/commerce presentation     | P10B-16P-05A and dynamic-search authority | Transient exact canonical query/results; ranking/filter/pagination; lifecycle non-persistence; EN/FI browser and publication evidence; protected commerce/media                             |
| ☑    | P10B-17      | Responsive, accessibility and performance closure    | **Baseline**                               | Design system and QA                     | P10B-16P-06 and implemented families      | Registered transformations; four-width EN/FI geometry; keyboard/semantic/contrast; bounded performance/build budgets; browser and retained human visual evidence                            |
| ☐    | P10B-18      | Commercial quality and scale gate                    | **Partial**                                | Product owner, generation, QA            | All prior P10B tasks                      | Accepted audit, source-authority upgrade, then 100+ configurations and fingerprint-stratified human review                                                                                  |
| ☑    | P10B-18A     | Commercial authority audit and ceiling diagnosis     | **Baseline**                               | Product owner, generation, QA            | P10B-17 and current authority             | Accepted 72-case matrix, 18-store/108-capture human review, protected commerce/media, zero provider/Vesko/publication traffic                                                               |
| ☑    | P10B-18B     | Commercial source-authority quality upgrade          | **Baseline**                               | Generation/component/profile owners      | Accepted P10B-18A                         | Six accepted packages with focused and integrated browser/human evidence against the frozen audit baseline                                                                                  |
| ☑    | P10B-18B-01  | Design DNA and shared-frames quality upgrade         | **Baseline**                               | Design DNA, direction, frame owners      | Accepted P10B-18A                         | Same-72-case material deltas, compact complete-store proof, 17 accepted captures, responsive/build/lifecycle/protected-state preservation                                                   |
| ☑    | P10B-18B-06  | Asset composition and art-direction quality upgrade  | **Baseline**                               | Asset, responsive-image, frame owners    | Accepted P10B-18B-01                      | Accepted bounded purpose affinity, reuse, paired responsive sources, shared-frame logo, same-72-case regression and 13-capture checkpoint; complete-store visual quality remains unaccepted |
| ☑    | P10B-18B-02  | Homepage / editorial / campaign quality upgrade      | **Baseline**                               | Homepage profile/component owners        | Accepted P10B-18B-01 and P10B-18B-06      | Accepted intentional rich/sparse progression, exact transition authority, stronger hierarchy/rhythm, same-strata accounting, retained review and lifecycle preservation                     |
| ☑    | P10B-18B-03  | Collection / search / product-card quality upgrade   | **Baseline**                               | Collection/search/product-card owners    | Accepted P10B-18B-02                      | Accepted cardinality/facet hierarchy, four distinct profile purposes, five canonical card anatomies, executable search truth, same-72 accounting and 21-capture retained review             |
| ☑    | P10B-18B-04  | PDP quality upgrade                                  | **Baseline**                               | PDP profile/commerce presentation owners | Accepted P10B-18B-03                      | Accepted 19 August 2026: stronger PDP opening, gallery, option/purchase and related-merchandising hierarchy with protected variant/price/media and retained four-width evidence             |
| ☑    | P10B-18B-05  | Content / support / utilities quality upgrade        | **Baseline**                               | Content/support/utility owners           | Accepted P10B-18B-04                      | Stronger registered content, support and utility compositions with lifecycle, navigation and protected-commerce preservation                                                                |
| ☑    | P10B-18C     | 100+ commercial quality and diversity gate           | **Baseline**                               | Product owner, generation, QA            | Accepted and integrated P10B-18B packages | 126/126 complete/replay, protected-state/diversity/causality gates, 28 stores and final 280-entry four-width EN/FI review                                                                   |
| ☑    | P10B-16P-05B | Major repository and historical-authority cleanup    | **Baseline**                               | Generation architecture/evidence         | P10B-16P-05A and accepted P10B-18C        | Consumer graph; one active generation chain; lean P10B-18D seam; production fail-closed; durable lifecycle, migration and quality regressions                                               |
| ☑    | P10B-18D     | Live AI commercial storefront acceptance diagnostic  | **Baseline diagnostic / quality rejected** | Product owner, provider, generation, QA  | P10B-16P-05B and accepted P10B-18C        | Six bounded calls and safe evidence accepted; 3/6 fidelity passes, exact Concept 2/6 authority collapse and incomplete final reload/Preview reject live commercial quality                  |
| ☑    | P10B-19 PRE  | Structural Design Intelligence Architecture Lock     | **Baseline**                               | Product owner and architecture           | Completed P10B-18D diagnostic             | Accepted ownership, migration, safety, alternatives, and P10B-19A-J implementation sequence; no production implementation                                                                   |
| ☐    | P10B-19A     | Structural Storefront Family Contract                | **Planned / exact next**                   | Planned task owner                       | Accepted P10B-19 PRE                      | Versioned family and PageBlueprint v2 contracts, registry, topology identity, deterministic selection, and v1 compatibility                                                                 |
| ☐    | P10B-19B-J   | Remaining Structural Design Intelligence sequence    | **Planned**                                | Planned task owners                      | Accepted P10B-19 PRE and package sequence | Nine package-specific implementation and acceptance tasks                                                                                                                                   |

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
| ☐    | P10C-09 | Studio commercial QA                     | **Planned** | Product owner, Storefront Studio, QA | P10C-08 and P10B-18                       | Full select-to-publish browser chain and human review     |

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

### DEVX-01 - Contract-driven development and CI execution enablement

DEVX-01 establishes bounded independently verified delivery before changing CI execution. It does
not alter storefront, generation, commerce, media, persistence, Puck or merchant-visible behavior.

| Task                                                                                 | Outcome                                                                                                                                                      | Status                                    | Dependency           | Evidence                                                                            | Non-goal                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- |
| DEVX-01A - Sprint contract and independent verification protocol                     | Establish immutable child-task and verdict schemas, exact roles, architecture-quality decisions, PR budgets, rolling waves and a pre-PR independent verifier | **Baseline**                              | Accepted P10B-19 PRE | JSON schema/template consistency, docs/tooling checks and independent verifier PASS | Executable verifier or CI changes               |
| DEVX-01B - Mechanical contract and verifier-verdict enforcement                      | Enforce identity, paths, budgets, declarations, criterion coverage and terminal verdicts                                                                     | **Baseline**                              | DEVX-01A             | Focused positive/fail-closed contract tests and exact verifier reconciliation       | CI parallelization or P10B-19A implementation   |
| DEVX-01C - CI timings, obsolete-run cancellation and Next build caching              | Record timings and add safe cancellation/cache authority                                                                                                     | **Baseline**                              | DEVX-01B             | Complete timing artifact, cache authority and static/native cancellation proof      | Job sharding                                    |
| DEVX-01D - Parallel static, Vitest and production-build jobs                         | Separate independent CI jobs behind stable required authority                                                                                                | **Baseline**                              | DEVX-01C             | Four profile artifacts, stable aggregate status and failure-propagation proof       | Playwright sharding                             |
| DEVX-01E - Playwright timing inventory and balanced execution groups                 | Measure retained browser suites and define balanced groups                                                                                                   | **Baseline**                              | DEVX-01D             | Deterministic timing inventory                                                      | Matrix execution                                |
| DEVX-01F - Playwright sharding/matrix, merged reports and stable required aggregator | Run browser groups in parallel with merged evidence and one required result                                                                                  | **Baseline**                              | DEVX-01E             | Shard failure and merged-report regressions                                         | Weakening retained suites                       |
| DEVX-01F2 - Contention-safe Vitest sharding                                          | Replace the serial Vitest bottleneck with exact isolated one-worker shards and one validated merged result                                                   | **Baseline**                              | DEVX-01F             | Locked source plan; exact discovery; shard manifests/blobs; merged result           | Test, worker, retry or product-semantics change |
| DEVX-01G - Two-run performance acceptance and workflow closure                       | Prove the bounded workflow and CI improvement over two clean runs                                                                                            | **Planned / exact next engineering task** | DEVX-01F2            | Two-run acceptance and closure record                                               | Product behavior change                         |

P10B remains Partial. P10B-19A is the next product-development sprint after DEVX-01.
DEVX-01C measured the serial gate, retained PR/ref-scoped cancellation and added compatible
`.next/cache` reuse. DEVX-01D runs static, one-worker Vitest, production-build and unchanged
complete browser validation independently behind the stable fail-closed `validate` status, with a
separate bounded timing artifact per profile. Its projected command critical path was
1h 11m 24.063s versus 2h 5m 49.513s measured serial work; achieved timings remain run evidence and
two-run performance acceptance remains DEVX-01G authority. DEVX-01E, DEVX-01F and DEVX-01F2 are
Baseline; DEVX-01G is the exact next engineering task.

#### P10B-19A planned micro-pull-request map

| Order | Child task                                                                            | Merge eligibility                  |
| ----: | ------------------------------------------------------------------------------------- | ---------------------------------- |
|     1 | P10B-19A-01 - Structural family identity, versions, lifecycle states and invariants   | DEVX-01 closed                     |
|     2 | P10B-19A-02 - Cross-page structural relationship contract                             | A-01 merged                        |
|     3 | P10B-19A-03 - Required page structures, region graph and PageBlueprint v2 dispatch    | A-02 merged                        |
|     4 | P10B-19A-04 - Asset-role contract                                                     | Declared A dependency merged       |
|     5 | P10B-19A-05 - Responsive-rule contract                                                | Declared A dependency merged       |
|     6 | P10B-19A-06 - Omission, substitution and fallback contract                            | Declared A dependency merged       |
|     7 | P10B-19A-07 - Inactive family registry and candidate fingerprints                     | A-01 through A-06 authority merged |
|     8 | P10B-19A-08 - Compatibility, deterministic selection and normalized topology identity | A-07 merged                        |
|     9 | P10B-19A-09 - v1 read/render/migration/publication compatibility                      | A-08 merged                        |
|    10 | P10B-19A-10 - Retained matrices, integration and P10B-19A closure                     | A-01 through A-09 merged           |

No P10B-19A production authority is implemented by DEVX-01A.

The immutable DEVX-01A product-owner contract explicitly replaces the earlier six-child P10B-19A
delivery partition with this ten-child merge map. Structural, PageBlueprint v2, registry,
compatibility, migration and closure ownership remain exactly as accepted in P10B-19 PRE.

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

### P10B — Commercial Storefront Generation System v1

The binding details and minimum coverage are in
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md).
P10B-01 through P10B-17, P10B-16P-01 through P10B-16P-05A, P10B-16P-06, accepted P10B-18A and
accepted P10B-18B-01, P10B-18B-06, P10B-18B-02, P10B-18B-03, P10B-18B-04 and P10B-18B-05 are
**Baseline**. P10B-16P-02, parent P10B-18B, P10B-18C and P10B-16P-05B are **Baseline**; P10B-18 and
P10B remain **Partial**; P10B-18D is a **Baseline diagnostic with live commercial quality
rejected**. P10B-19 PRE is **Baseline**, and P10B-19A is **Planned / exact next**. P10B-16P-04 acceptance evidence is retained in
[`P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md`](P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md).
The remaining Done conditions are implementation gates, not claims about the current repository.
The P10B-16P-01 through P10B-16P-05A plus P10B-16P-06 sequence is a mandatory convergence package
between P10B-16 and P10B-17; it supplements rather than renumbers the locked P10B-01 through
P10B-18 plan.
P10B-16P-05B follows accepted P10B-18C and is now Baseline. P10B-18D completed as a rejected-quality
diagnostic. P10B-19 PRE is Baseline. P10B-19A is the exact next product task, followed by planned
P10B-19B through P10B-19J.

#### P10B-01 — Commercial design grammar and compatibility vocabulary

- **Outcome:** Make structural, visual, responsive, narrative, and compatibility vocabulary
  executable through existing canonical authorities.
- **Authority:** Existing `BrandSystem`, bounded parameters, component compatibility,
  PageBlueprint, approved-asset, narrative, and direction-reference contracts.
- **Depends on:** P10A closure, this architecture lock, and the retained audit/specification.
- **Done when:** Every approved value has closed schema, ownership, inheritance/narrowing,
  compatibility, migration, runtime queryability, fingerprint contribution, and stable typed
  failure; downstream consumers can query it without a duplicate registry.
- **Fail closed:** Unknown, stale, broadening, conflicting, unregistered, raw CSS/class/code, and
  unrestricted font values are rejected before proposal mutation.
- **Evidence:** Contract/schema, migration, inheritance, generated-manifest, queryability, and
  deterministic rejection tests.
- **Non-goal:** Implementing visual families or another token/page/recipe/direction authority.
- **Status:** **Baseline**. See
  [`P10B_01_COMMERCIAL_DESIGN_GRAMMAR.md`](P10B_01_COMMERCIAL_DESIGN_GRAMMAR.md).

#### P10B-02 — Parametric BrandSystem / Design DNA

- **Outcome:** Make merchant-wide typography, palette, rhythm, layout, surfaces, controls,
  radius/elevation, density, and media posture bounded, coherent, and AI-selectable.
- **Authority:** Existing `BrandSystem`, migration, and renderer projection.
- **Depends on:** P10B-01.
- **Done when:** Every Design DNA domain in the architecture lock has deterministic legacy migration
  and renderer projection; at least two non-colour foundations visibly coordinate every page and
  survive proposal, snapshot, save/reload, and publish.
- **Fail closed:** Invalid ranges, contrast failures, unrestricted fonts, raw CSS, per-section token
  stores, and local broadening are rejected.
- **Evidence:** Schema/migration/unit, contrast, projection, integration, lifecycle, and four-width
  foundation review.
- **Non-goal:** Component anatomy, page composition, or direction-owned global tokens.
- **Status:** **Baseline**. See
  [`P10B_02_PARAMETRIC_BRAND_SYSTEM.md`](P10B_02_PARAMETRIC_BRAND_SYSTEM.md).

#### P10B-03 — Component anatomy and meaningful variant contract

- **Outcome:** Give every commercial family explicit anatomy, structural variants, parameters,
  assets, responsive transformations, and compatibility metadata.
- **Authority:** `ComponentDefinitionV2`, bounded parameters, compatibility, migrations, and shared
  renderer identity.
- **Depends on:** P10B-01.
- **Done when:** Every commercial family declares its anatomy and PageBlueprint reachability; each
  meaningful variant changes maintained hierarchy/composition and renders through the same editor,
  preview, and published implementation.
- **Fail closed:** Missing/incompatible anatomy metadata and class/colour/padding/radius-only aliases
  presented as meaningful variants are rejected.
- **Evidence:** Registry/schema, manifest/queryability, migration, renderer-identity, structural
  comparison, and compatibility rejection tests.
- **Non-goal:** Implementing all commercial family renderers in this contract task.
- **Status:** **Baseline**. At P10B-03 delivery, all then-current 25 V2 definitions and 91 variants
  were classified explicitly without false commercial-ready promotion. Later family tasks extend
  that same authority rather than replacing it. See
  [`P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md`](P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md).

#### P10B-04 — Responsive image and art-direction authority

- **Outcome:** Add approved focal point, safe area, crop, ratio, overlay, derivative, and responsive
  image treatment authority.
- **Authority:** Existing approved asset placement/presentation and renderer media projection.
- **Depends on:** P10B-02, P10B-03.
- **Done when:** Editorial and canonical product media render intentional desktop/mobile treatment,
  registered fallback/omission, and exact provenance/role/revision preservation.
- **Fail closed:** Wrong-owner, wrong-role, stale, unapproved, unsafe, incompatible, and
  product-media-replacement attempts are rejected.
- **Evidence:** Contract/unit, asset/media integration, responsive browser, fallback, and retained
  visual evidence.
- **Non-goal:** Modifying canonical product media or unrestricted image generation.
- **Status:** **Baseline**. Contract `1.0.0` embeds exact lineage and bounded treatment in the
  existing approved presentation, consumes Design DNA and registered anatomy, projects protected
  same-product media, preserves authority through lifecycle/compiler boundaries, and renders
  semantic four-breakpoint evidence. Production CDN transforms and retained commercial visual
  acceptance remain deferred. See
  [`P10B_04_RESPONSIVE_IMAGE_ART_DIRECTION.md`](P10B_04_RESPONSIVE_IMAGE_ART_DIRECTION.md).

#### P10B-05 — Veskify site-map and page-family authority

- **Outcome:** Create and validate complete storefront page sets, navigation, routes, and registered
  page families through PageBlueprint and `StorefrontSnapshot`.
- **Authority:** Existing PageBlueprint/profile, navigation, route, and canonical snapshot contracts.
- **Depends on:** P10B-01.
- **Done when:** Shared frame, home, collection/category, PDP, content/support, campaign, search,
  cart/checkout, empty/error/404 families generate as one navigable canonical page set with unique
  routes, locale coverage, required contexts, and save/reload/publish preservation.
- **Fail closed:** Unknown families, duplicate/unsafe routes, orphan navigation, missing commerce
  context, unsupported locale combinations, and unapproved policy/service claims are rejected
  before mutation.
- **Evidence:** Contract/unit, PageBlueprint materialization, generation/proposal/compiler/snapshot,
  navigation/route, lifecycle, and no-partial-write tests.
- **Non-goal:** Another page graph, snapshot, recipe engine, or unrestricted CMS.
- **Status:** **Baseline**. See
  [`P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md`](P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md).

#### P10B-06 — Commercial shared-frame families

- **Outcome:** Deliver materially distinct coordinated shared-frame systems with cross-page identity.
- **Authority:** Existing shared-frame/navigation PageBlueprint slots and registered families.
- **Depends on:** P10B-02, P10B-03, P10B-05; consume P10B-04 where media applies.
- **Done when:** At least four complete frame systems, three mobile navigation modes, and four footer
  compositions coordinate announcement/search/cart/locale treatment and preserve one identity on
  every page in EN/FI and four widths.
- **Fail closed:** Incompatible header/footer/mobile combinations, duplicate navigation authority,
  broken landmarks, and inaccessible focus/keyboard behavior are rejected.
- **Evidence:** Full capability chain, navigation regression, responsive/a11y browser evidence, and
  retained human review.
- **Non-goal:** P10C merchant frame-editing controls.
- **Status:** **Baseline**. Four exact root-frame profiles, three mobile modes, and four footer
  compositions preserve canonical navigation and frame identity through snapshot, save/reload,
  Puck root, preview, publication compilation, EN/FI, and 375/768/1024/1440 px evidence. See
  [`P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md`](P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md).

#### P10B-07 — Hero, editorial, campaign and proof families

- **Outcome:** Deliver meaningful first-impression, story, campaign, service, and proof composition.
- **Authority:** Existing registered commercial families, PageBlueprint slots, narrative roles, and
  approved asset/copy evidence.
- **Depends on:** P10B-02 through P10B-05.
- **Done when:** At least six hero anatomies plus brand story, process, image/text, quote, lookbook,
  campaign, service/trust, and evidence-backed proof families are canonically reachable and visibly
  distinct.
- **Fail closed:** Invented claims, unapproved proof/assets, missing required media, invalid
  adjacency/cardinality, and incompatible family/profile combinations are rejected or omitted only
  through registered rules.
- **Evidence:** Registry/profile, proposal/compiler/snapshot/render, provenance, responsive/a11y,
  omission, and retained visual evidence.
- **Non-goal:** Generic filler or free-form generated sections.
- **Status:** **Baseline**. Six meaningful hero anatomies, five editorial/story anatomies, five
  campaign/promotion anatomies and three evidence-grounded proof/service anatomies are registered,
  PageBlueprint-selectable, deterministically generated, snapshot/publish preserved and rendered
  through one shared implementation. Focused deterministic coverage and a zero-provider Chromium
  scenario retain evidence at 375, 768, 1024 and 1440 px. See
  [`P10B_07_HERO_EDITORIAL_CAMPAIGN_PROOF_FAMILIES.md`](P10B_07_HERO_EDITORIAL_CAMPAIGN_PROOF_FAMILIES.md).

#### P10B-08 — Canonical product-card and merchandising family

**Status:** Baseline. One fingerprinted authority and renderer now serve homepage merchandising,
collection/results, related products, and legacy compatibility. Five meaningful anatomies preserve
canonical facts and P10B-04 media lineage through plan, proposal, snapshot, save/reload, publish,
and responsive browser evidence. See
[`P10B_08_CANONICAL_PRODUCT_CARD_AND_MERCHANDISING.md`](P10B_08_CANONICAL_PRODUCT_CARD_AND_MERCHANDISING.md).

- **Outcome:** Establish one protected reusable commercial product-card authority.
- **Authority:** Existing canonical product-card presentation and commerce bindings.
- **Depends on:** P10B-02 through P10B-04.
- **Done when:** At least five meaningful editorial, compact, dense, image-led, and
  comparison/information-led anatomies preserve exact product facts across home, collection/search,
  related products, responsive modes, snapshots, and published output.
- **Fail closed:** Duplicate card authorities, wrong-product media, invented badges/price/
  availability, incompatible actions, and protected-commerce mutation are rejected.
- **Evidence:** Binding/product-media/commerce regressions, capability chain, state/responsive
  matrix, and retained visual review.
- **Non-goal:** A product model, catalogue write path, or copied commerce truth.

#### P10B-09 — Commercial homepage profile library

**Status:** Baseline. Six versioned, structurally fingerprinted homepage PageBlueprint profiles
compose current shared-frame, commercial storytelling, canonical product-card, approved-media,
and Design DNA authority. Evidence/cardinality guards fail closed; deterministic lifecycle and
24 retained four-width browser images pass. See
[`P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md`](P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md).

- **Outcome:** Deliver multiple materially different homepage profiles and narrative flows.
- **Authority:** Existing executable homepage PageBlueprint profiles and narrative constraints.
- **Depends on:** P10B-05 through P10B-08.
- **Done when:** At least six profiles differ in hierarchy, narrative, merchandising, cardinality,
  and responsive transformation and pass generation, materialization, proposal, compiler, snapshot,
  renderer, and credible-asset review.
- **Fail closed:** Colour-only duplicates, unsupported ordering, excessive repetition, missing
  required authority, and unregistered sections are rejected.
- **Evidence:** Profile/schema, pairwise structure, capability chain, four-width browser, and
  retained human evidence.
- **Non-goal:** Six manually copied templates.

#### P10B-10 — Commercial collection and search profiles

**Status:** Baseline. Four fingerprinted executable PageBlueprint profiles now select the existing
P10B-06 shared frame, P10B-03 `dynamicCollectionCommerce` anatomy, P10B-08 canonical card anatomy,
and P10B-04 approved media treatment. Exact canonical catalogue bindings preserve product
membership/order, facts, product media, filters/sort state, and child-collection order. Campaign
media is approved collection/editorial media, not a product-media replacement. A transient
revision-checked zero-result context keeps the query without fabricating products. Deterministic
lifecycle and 16-view Chromium evidence pass with zero provider calls. See
[`P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md`](P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md).

- **Outcome:** Deliver editorial discovery, catalogue comparison, campaign-led, and dense/search
  experiences.
- **Authority:** Existing PageBlueprint profiles and `dynamicCollectionCommerce`.
- **Depends on:** P10B-04 through P10B-06 and P10B-08.
- **Done when:** At least four profiles preserve canonical collection membership/order, typed
  filter/sort intents, child collections, product cards, results/no-results, responsive behavior,
  snapshot, and published rendering.
- **Fail closed:** Membership/order/price/media mutation, incompatible card/filter combinations,
  missing bindings, and finishing-only duplicate profiles are rejected.
- **Evidence:** Materialization, commerce/intents, capability chain, responsive browser, and retained
  visual review.
- **Non-goal:** A second collection/search engine.

#### P10B-11 — Commercial PDP profile library

- **Outcome:** Deliver distinct standard, high-consideration, gallery-led, and variant-led purchase
  experiences.
- **Authority:** Existing PageBlueprint profiles, `dynamicProductDetail`, and P6 generic option
  resolution.
- **Depends on:** P10B-03 through P10B-06 and P10B-08.
- **Done when:** At least four profiles preserve all simple/configurable option groups,
  dependencies, incomplete/unavailable states, resolved price/availability/media, related products,
  responsive modes, snapshot, and published rendering.
- **Fail closed:** Product-type forks, dropped options, missing bindings, shallow duplicates, and
  protected commerce/media mutation are rejected.
- **Evidence:** Dynamic PDP/option/media/commerce regression, capability chain, four-width browser,
  and retained visual review.
- **Non-goal:** Product-specific component architecture.

#### P10B-12 — Content and support page families

- **Outcome:** Generate About/brand story, Contact/locations, FAQ, shipping/returns, policy,
  campaign/editorial, and reusable generic content pages from current approved facts.
- **Authority:** Existing P10B-05 PageBlueprint/page-family, content/evidence, localization,
  navigation, and `StorefrontSnapshot` contracts.
- **Depends on:** P10B-03 through P10B-07.
- **Status:** **Baseline**. Fifteen structurally distinct registered profiles resolve exact current
  approved brief evidence into strict localized fact documents. P10B-05 preserves page-set,
  route, locale, and transitive navigation authority; P10B-06 frames and P10B-07 editorial/campaign
  renderers are reused. Snapshot save/reload and deterministic publication preserve the exact
  document. See [`P10B_12_CONTENT_AND_SUPPORT_PAGE_FAMILIES.md`](P10B_12_CONTENT_AND_SUPPORT_PAGE_FAMILIES.md).
- **Fail closed:** Caller bodies cannot authorize facts. Missing, stale, revoked, superseded,
  unapproved, malformed, mismatched, or wrong-family evidence fails; required unsupported facts
  fail while optional content omits only through registered P10B-05 policy.
- **Evidence:** Contract/profile, source fact/provenance, generation/lifecycle, locale/navigation,
  protected-commerce, compiler, and 61 zero-provider Chromium checks at 375/768/1024/1440 px.
- **Non-goal:** Unrestricted CMS, legal-content generation, a second page graph, or a provider path.

#### P10B-13 — Commerce utility presentation pages — **Baseline**

- **Outcome:** Deliver governed search/no-results, cart, checkout, empty, error, and 404 presentation.
- **Authority:** Existing page/profile, shared frame, canonical commerce projection, and operational
  adapter seams.
- **Depends on:** P10B-03, P10B-05, P10B-06, P10B-08.
- **Delivered:** Six deterministic PageBlueprint profiles materialize one `commerceUtility`
  component through the P10B-05 family page; registered loading state renders on its pending route
  instead of replacing the 404 singleton. Read-only runtime state supplies canonical cart facts,
  checkout continuation, P10B-10 query/filter context, and bounded recovery actions while the
  snapshot preserves presentation only. Shared-frame/Design DNA, save/reload, publication, four-
  width browser evidence, and no-provider behavior are covered under
  [`P10B_13_COMMERCE_UTILITY_PRESENTATION_PAGES.md`](P10B_13_COMMERCE_UTILITY_PRESENTATION_PAGES.md).
- **Fail closed:** Local commerce operations/writes, invented totals or availability, unsupported
  actions, and executable payment/checkout behavior outside Vesko adapters are rejected.
- **Evidence:** Contract/integration, adapter-boundary, state matrix, responsive/a11y browser, and
  retained visual evidence.
- **Non-goal:** Owning cart, checkout, payment, order, tax, shipping, or returns operations.

#### P10B-14 — Premium Editorial complete-storefront vertical slice — **Baseline**

- **Outcome:** Prove one commercially credible complete multi-page storefront early.
- **Authority:** Existing canonical generation/proposal/snapshot/preview/publication chain using the
  implemented P10B authorities.
- **Depends on:** Minimum accepted P10B-02 through P10B-13 capability.
- **Delivered:** One approved Lumo brief, read-only two-product commerce projection and approved
  assets reach a 17-route canonical snapshot through the site-map, commercial PageBlueprint,
  whole-storefront proposal, save/reload and deterministic publication path. One Design DNA and
  `centered-minimal` frame span all pages; simple/configurable PDP, factual content, utility states,
  15 four-width/representative screenshots and the passing 160-scenario human record are retained
  in
  [`P10B_14_PREMIUM_EDITORIAL_COMPLETE_STOREFRONT_VERTICAL_SLICE.md`](P10B_14_PREMIUM_EDITORIAL_COMPLETE_STOREFRONT_VERTICAL_SLICE.md).
- **Fail closed:** Missing/disconnected/generic required pages, manual reconstruction, stale
  authority, or schema-only visual evidence fails the slice.
- **Evidence:** Complete capability chain, correlated browser/screenshots, protected parity, and
  retained human commercial review.
- **Non-goal:** P10B closure or broad direction/diversity proof.

#### P10B-15 — Bounded storefront synthesis and narrative engine — **Baseline**

- **Outcome:** Generate complete coherent storefronts from compatible Design DNA, page set,
  profiles, families/variants, parameters, assets, and narrative roles.
- **Authority:** Existing governed planning/proposal compiler plus the registered P10B authorities;
  output remains one `StorefrontSnapshot`.
- **Depends on:** P10B-14 and sufficient real family/profile capability.
- **Delivered:** One versioned deterministic synthesis contract binds exact merchant, evidence,
  commerce, asset, Design DNA, site-map, frame, PageBlueprint/profile, component/anatomy,
  narrative, density, art-direction, responsive, planner, registry and recipe authority. The same
  approved fixture produces editorial-heavy, commerce/discovery-heavy and restrained/minimal
  complete 17-route stores through the existing whole-storefront proposal, snapshot, save/reload,
  renderer and immutable publication chain. Details are retained in
  [`P10B_15_BOUNDED_STOREFRONT_SYNTHESIS_AND_NARRATIVE_ENGINE.md`](P10B_15_BOUNDED_STOREFRONT_SYNTHESIS_AND_NARRATIVE_ENGINE.md).
- **Fail closed:** Missing, stale, ambiguous, incompatible, unregistered, repetitive, or
  protected-state-divergent combinations produce no partial proposal/snapshot.
- **Evidence:** Required 25-case deterministic matrix; P10B-14 regression; three distinct complete
  outcomes; exact save/reload and deterministic publication; dedicated 375/768/1024/1440 browser
  evidence; and three passing 160-scenario retained human commercial reviews (480 scenarios).
- **Non-goal:** Arbitrary trees/styles, a second synthesis representation, or P10B-16
  duplicate/near-duplicate and direction-scale authority.

#### P10B-16 — Coordinated directions and diversity control — **Baseline**

- **Outcome:** Make Premium Editorial, Modern Technical, and Minimal Commerce coordinated constraint
  packages and prevent duplicates/near duplicates.
- **Authority:** Versioned Premium Editorial, Modern Technical and Minimal Commerce narrowing
  packages over P10B-15 plus deterministic direction/diversity fingerprint authority.
- **Depends on:** P10B-15.
- **Done:** Three canonical packages validate current Design DNA/profile/frame/anatomy/page/evidence
  references and drive the canonical proposal/snapshot lifecycle. Fingerprints cover Design DNA,
  page set/profiles, frame, anatomies/variants, bounded parameters, image posture,
  density/responsive posture and narrative composition; comparison classifies exact, palette-only,
  shallow, near and material outcomes; repetition control fails closed when novelty is exhausted.
- **Fail closed:** Fixed-template/token/page direction authority, incompatible references,
  colour-only differences, and fingerprints that omit material structure are rejected.
- **Evidence:** 31 focused unit/integration cases; nine representative complete outcomes; exact
  save/reload and compiled publication; protected commerce/evidence/media parity; dedicated
  375/768/1024/1440 browser coverage; three retained human commercial reviews and one exact
  evidence manifest. See
  [`P10B_16_COORDINATED_DIRECTIONS_AND_DIVERSITY_CONTROL.md`](P10B_16_COORDINATED_DIRECTIONS_AND_DIVERSITY_CONTROL.md).
- **Non-goal:** Thousands of manually authored templates.

#### P10B-16P-01 — Dynamic commerce route archetype authority — **Baseline**

- **Outcome:** Separate genuinely static editable pages, maintained collection/search and PDP
  design archetypes, and concrete commerce route inventory without removing public routes.
- **Authority:** One versioned/fingerprinted `dynamicCommercePresentation` member inside canonical
  `StorefrontSnapshot`; existing PageBlueprint profiles, dynamic commerce components, read-only
  catalogue projection, renderer, persistence, history, compiler, and publication remain singular.
- **Depends on:** P10B-16 and the implemented P10B-05, P10B-10, and P10B-11 authorities.
- **Delivered:** A compact route inventory, four collection/search archetypes, four maintained PDP
  profiles plus generic fallback, exact collection and product-type mappings, bounded matching
  rules, transient editor/runtime projection, deterministic legacy convergence, and complete
  snapshot/lifecycle/publication preservation. Exact primary and related-product bindings survive
  convergence. A server-owned, storefront-scoped proposal transition binds legacy and reviewed
  canonical projections for deterministic acceptance replay. Storefront Studio lists archetypes
  rather than one page per commerce URL; representative context is not persisted. See
  [`P10B_16P_01_DYNAMIC_COMMERCE_ROUTE_ARCHETYPES.md`](P10B_16P_01_DYNAMIC_COMMERCE_ROUTE_ARCHETYPES.md).
- **Search boundary:** `/search` inventory and its archetype are registered. P10B-16P-06 now supplies
  exact transient query/results through the standalone canonical catalogue adapter; missing,
  invalid, stale, or unresolved runtime context still fails closed and never substitutes a
  collection. Vesko-backed search remains P11 integration work.
- **Fail closed:** Protected commerce inside design state; duplicate/unresolved/stale routes,
  mappings, profiles, frames, or fingerprints; incompatible legacy per-route presentation;
  unsupported or provider-originated proposal migration; page/section-scoped structural
  transition; and partial persistence/compilation are rejected.
- **Evidence:** Contract/schema, deterministic cardinality/mapping/migration, integration,
  persistence/history, compiler/publication, editor, exact preview/published route, and responsive
  browser evidence; zero provider calls.
- **Non-goal:** Provider prompt/design-plan work, the final Studio generation journey, individual
  product/collection overrides, P10B-17/P10B-18, P10C general editing, or operational commerce.

#### P10B-16P-02 — Prompted design-plan contract

- **Outcome:** Establish a strict transient prompted intent, then deterministically compile it
  against refreshed bounded synthesis, direction, archetype, and route authority.
- **Status:** **Baseline**; Part A and Part B are Baseline.
- **Depends on:** P10B-16P-01.
- **Done when:** Both Part A and Part B pass; provider intent references only advertised current
  capability, and deterministic refreshed-authority compilation preserves the canonical lifecycle
  while rejecting unknown, stale, malformed, broadening, provider-owned or partial results.
- **Non-goal:** The final normal Storefront Studio generation journey or live V2 acceptance.

#### P10B-16P-02A — Prompted Storefront Design Intent V2 — **Baseline**

- **Outcome:** Expose a compact provider-safe view of current capability and accept one strict,
  preference-rich, non-executable V2 intent tied to exact prompt/request/authority fingerprints.
- **Authority:** Read-only capability projection, versioned request and intent schemas, exact
  reference validation, deterministic normalization/fingerprints, and server-only OpenAI adapter.
- **Depends on:** P10B-16P-01.
- **Done when:** Hard, ranked soft, optional and avoidance preferences cover Design DNA, frame,
  home, dynamic commerce archetypes, content/utility, components, responsive and art direction;
  every reference is advertised and correctly dimensioned; strict extra/unknown/unavailable/stale
  values fail safely; mocked transport proves `store: false`, bounded timeout, zero retries, no
  repair/fallback, and sanitized evidence.
- **Evidence:** Contract/schema, deterministic unit, architecture and mocked-transport integration;
  zero provider and Vesko calls. No live V2 provider evidence is claimed.
- **Non-goal:** P10B-15 execution, complete candidate materialization, deterministic intent
  compilation, proposal/snapshot creation, Studio wiring, search adapter, or live provider call.
- **Record:**
  [`P10B_16P_02_PROMPTED_STOREFRONT_DESIGN_PLAN_V2.md`](P10B_16P_02_PROMPTED_STOREFRONT_DESIGN_PLAN_V2.md).

#### P10B-16P-02B — Deterministic design-intent compiler — **Baseline**

- **Outcome:** Refresh current authority and deterministically compile validated V2 preferences
  into exact registered compatible selections and the canonical P10B-15/P10B-16 proposal path.
- **Status:** **Baseline**. Completed 12 August 2026 with zero provider and Vesko calls.
- **Depends on:** P10B-16P-02A.
- **Done:** Exact authority is refreshed before compilation; a bounded metadata-only solver applies
  hard/ranked-soft/optional/avoidance semantics and a material-intent gate; the strict transient
  decision records exact Design DNA, frame, PageBlueprint, dynamic-commerce, component/variant/
  bounded-parameter, narrative, responsive/art and evidence/asset resolution with diagnostics and
  deterministic fingerprints; one successful decision extends canonical synthesis and creates one
  isolated proposal while failures leave snapshot/history/proposal state unchanged.
- **Evidence:** Contract/schema, deterministic unit and integration across exact synthesis,
  PageBlueprint/profile materialization, dynamic archetypes/product-type mappings, proposal
  lifecycle, protected commerce and no-partial rejection; zero provider and Vesko calls.
- **Non-goal:** Provider-owned layout, normal Studio UX, live acceptance, or search execution.

#### P10B-16P-03 — Storefront Studio generation journey

- **Outcome:** Complete the normal merchant-language prompt-to-review generation journey through
  the existing proposal and canonical snapshot lifecycle.
- **Status:** **Baseline**. Completed 12 August 2026 with mocked providers and zero real-provider or
  Vesko calls.
- **Depends on:** P10B-16P-02B.
- **Done:** Normal Storefront Studio opens an idempotently seeded raw Karvonen project with no
  request on load; an explicit Generate action sends the exact prompt and compact current identity
  to one server route; standalone/mock server-owned current authority invokes one mocked Design
  Intent V2 provider attempt and P10B-16P-02B once; one registered
  `APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION` operation with the target-bound
  `compilePromptedStorefrontDesignIntentV2@2.0.0` permission cross-binds the exact P02B
  source-proposal fingerprint and compiler lineage; one isolated proposal supports homepage, representative dynamic
  collection/PDP, content and utility review with current approved evidence references; Reject and
  Generate another preserve the draft; Accept commits one atomic unsaved change; Undo/Redo,
  Save/reload and normal dynamic-route Preview preserve the exact result. Current content/support
  evidence is independently resolved from trusted server authority and checked against retained
  snapshot provenance; snapshots never authorize themselves. Integrated requests without injected
  authenticated tenant/project and evidence authority fail closed before provider selection.
  Failures and stale/late responses cause no draft/history mutation and no retry or fallback. Search
  execution remains explicitly unavailable.
- **Evidence:** Contract/schema, deterministic unit, integration, dedicated mocked browser/E2E at
  375/768/1024/1440 and focused lifecycle/persistence/preview regressions. No real-provider or human
  commercial-quality claim.
- **Non-goal:** Live V2 provider evidence, P10B-16L disposition, executable search, P10C general
  manual/scoped editing, publication, or commercial-quality closure.

#### P10B-16P-04 — Live V2 acceptance and bridge disposition

- **Outcome:** Prove the prompt-driven Design Intent V2 path with separately authorized real
  provider evidence and explicitly disposition the P10B-16L compatibility bridge.
- **Status:** **Baseline**. Completed 15 August 2026; see
  [`P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md`](P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md).
- **Depends on:** P10B-16P-03.
- **Done:** A trusted server-owned, production-disabled Aurum acceptance composition loaded current
  project, draft, evidence, assets, catalogue, and capability authority before explicit provider
  selection. The cumulative P10B-16P-04 ledger records 16 authorized calls with zero retries or
  fallback; the final Premium Editorial, Modern Technical, and Minimal Commerce calls each returned
  strict semantic intent, compiled deterministically, and materialized exactly one isolated
  proposal through normal Storefront Studio. Prompt A and Prompt B were rejected without draft or
  history mutation. Prompt C passed Accept, exact Undo/Redo, Save, reload, and normal Preview with
  no publication. The three results were materially distinct, retained human visual acceptance,
  and preserved protected commerce and canonical product media. At the P10B-16P-04 acceptance
  point, search presentation remained registered while execution failed closed. P10B-16P-06 later
  supplied the current canonical transient query/results execution; that later capability does not
  alter the P10B-16P-04 call ledger, provider evidence, or acceptance result. P10B-16L is
  **Deprecated compatibility-only**; its active runtime is removed under P10B-16P-05A while
  historical evidence and required neutral migration/safety fixtures remain.
- **Evidence:** Real-provider, contract/schema, deterministic unit, integration, browser/E2E, and
  retained human visual review correlated through safe provider/model, authority, semantic intent,
  compiled-decision, structural, candidate-snapshot, lifecycle, usage, and latency fingerprints.
  Raw prompts, provider responses, credentials, and authorization headers were not retained.
- **Non-goal:** Production authentication, Vesko staging, executable search, publication,
  P10B-17/P10B-18 closure, automatic provider calls, or treating preset selection as V2 evidence.

#### P10B-16P-05A — Active production-path and compiler rationalisation

- **Outcome:** Make the normal semantic initial-generation path and the sole prompted
  compiler/materialization ownership chain obvious while preserving P10B-16P-04 behavior.
- **Status:** **Baseline**. Completed 15 August 2026 with zero provider, Vesko, or publication calls.
- **Depends on:** P10B-16P-04.
- **Done:** Normal Storefront Studio uses one operation-tagged proposal route, canonical prompted
  handler, trusted current-authority composition, semantic provider selector, compatibility
  resolver, exact compiled decision, coordinator, and sole executor/materialization boundary. A
  missing or ambiguous operation fails closed; registered follow-up remains separately tagged.
  P03/P04 inject into the same canonical handler only in production-disabled compositions, and
  normal composition imports no P9/Lumo, P10B-16L, or acceptance/demo authority. The active
  P10B-16L executable-intent routes/providers/runtime and obsolete P9/Lumo live-generation entry
  path are removed or isolated; proven migration/publication fixtures and historical evidence stay
  available. Public compiler exports no longer expose superseded traversal/materialization paths.
- **Evidence:** Architecture/dependency checks, provider/security and semantic compiler/executor
  tests, deterministic Prompt A/B/C replay, Prompt C lifecycle, dynamic-route migration,
  publication separation, and protected commerce/media regressions. The P10B-16P-04 acceptance
  composition remains production-disabled through P10B-18C.
- **Non-goal:** Search execution, visual redesign, new provider behavior, P10B-17/P10B-18, final
  historical cleanup, publication, or Vesko integration.

#### P10B-16P-06 — Canonical search query/results adapter

- **Outcome:** Execute the one persisted `/search` route and selected registered search archetype
  from validated transient query, filter, sort, page, result-ID, and result-count state derived from
  current canonical commerce.
- **Status:** **Baseline**. Completed 15 August 2026 with zero provider and Vesko calls.
- **Depends on:** P10B-16P-05A and existing P10B-16P-01, P10B-10, P10B-13, frame, product-card,
  persistence, and publication authorities.
- **Done:** A versioned provider-neutral read-only search contract and standalone
  `CatalogueDisplayModel` adapter validate and normalize EN/FI input, rank exact SKU and localized
  title matches deterministically, apply only supported filters/sort/pagination with bounded work,
  and return unique current public product-route IDs. Draft, proposal, saved/history, and published
  `/search` routes resolve that transient result page through the existing selected
  `dynamicCollectionCommerce` archetype, shared frame, product-card renderer, and governed
  orientation/no-results states. Exact product links resolve through current dynamic PDP authority.
- **Authority boundary:** `StorefrontSnapshot` persists only one `/search` route identity and selected
  presentation archetype. Query text, filters, sort, page, result IDs, and result count remain
  runtime-only; they never enter `PageModel`, snapshot/history, compiler decisions, publication
  artifacts as editable design state, provider evidence, or fingerprints.
- **Evidence:** Contract/schema, deterministic unit and integration, bounded 1,000-product work,
  EN/FI normalization/ranking, dynamic renderer/routes, proposal/save/history/publication
  non-persistence, browser/E2E, and protected commerce/media regressions.
- **Non-goal:** Vesko search integration, OpenAI or other provider calls, semantic/vector/fuzzy
  search, typo correction, recommendations, personalization, analytics, commerce writes, a second
  search/page graph, or a duplicate collection/product-card renderer.

#### P10B-16P-05B — Major repository and historical-authority cleanup

- **Status:** **Baseline**.
- **Depends on:** P10B-16P-05A and accepted P10B-18C.
- **Outcome:** Consumer-proven removal/consolidation of one-time acceptance infrastructure while
  retaining the active generation path, P03 lifecycle, one lean P04 mock/live P10B-18D seam,
  governed P9 follow-up, stable migration/publication identities and durable 126/72 quality gates.
- **Security:** P04 acceptance is unavailable in production; tokens remain server/test-process
  authority; mock and live transports remain explicit and cannot silently substitute.
- **Non-goal:** Storefront output, generation semantics, P10B-18D execution, P10B-19 implementation,
  commerce/media changes or migration breakage.

P10B-18C and P10B-16P-05B are Baseline. P10B-18D is a Baseline diagnostic with live commercial
quality rejected. P10B-18 and P10B remain Partial. P10B-19 PRE is Baseline. P10B-19A is the exact
next task, followed by planned P10B-19B through P10B-19J.

#### P10B-17 — Responsive, accessibility and performance closure

- **Outcome:** Preserve deliberate commercial hierarchy and usability across target widths,
  locales, accessibility, and bounded performance budgets.
- **Status:** **Baseline**. Completed 16 August 2026 with zero provider or Vesko calls.
- **Authority:** Existing responsive/a11y contracts, registered transformations, renderers, and
  evidence protocol.
- **Depends on:** P10B-16P-06 and implemented commercial families/profiles/directions.
- **Done:** Retained Premium Editorial, Modern Technical, Minimal Commerce, neutral, and commerce-
  integrity authority executes through the existing renderers at 375/768/1024/1440 and EN/FI.
  Registered navigation, disclosure, stack/reflow, media, merchandising, purchase-flow, content,
  utility, search, and footer transformations preserve content, protected commerce, and canonical
  product media. Keyboard/focus, landmark/heading/form/control semantics, announcements, contrast,
  touch targets, reduced motion, and locale expansion pass the bounded acceptance matrix.
- **Fail closed:** Clipping, overlap, inaccessible controls, lost content/commerce, desktop-only
  approval, or undispositioned budget failure blocks completion.
- **Evidence:** Automated geometry, accessibility, performance, build-budget, lifecycle-renderer,
  and browser matrices plus retained representative four-width human visual review correlated to
  current authority and protected commerce/media fingerprints.
- **Non-goal:** P10B-18B source-authority improvement, P10B-18C designer-grade commercial quality
  or 100+ scale, Vesko integration/staging, production authentication/performance/readiness, or
  visual approval from isolated component screenshots.

#### P10B-18 — Commercial quality and scale gate

- **Outcome:** Prove repeated generation of publishable, premium, materially different complete
  storefronts.
- **Status:** **Partial**. P10B-18A, P10B-18B-01, P10B-18B-06, P10B-18B-02, P10B-18B-03 and P10B-18B-04 are Baseline; parent P10B-18B is Partial and
  P10B-18C remains Planned.
- **Authority:** Existing golden-store/human-review evidence plus the P10B synthesis and fingerprint
  authorities.
- **Depends on:** P10B-17 and every prior P10B task.
- **Done when:** At least 100 deterministic complete configurations across representative
  catalogue/evidence/asset/locale/page-set/direction contexts pass snapshot validity, protected
  parity, exact-duplicate, near-duplicate, and structural-distribution gates; a fingerprint-
  stratified subset passes retained four-width human commercial review.
- **Fail closed:** One polished store, automated checks alone, placeholder assets, registry counts,
  screenshots without exact authority, or colour-only diversity cannot close P10B.
- **Evidence:** Scale-generation ledger, fingerprint/diversity analysis, complete capability-chain
  correlations, retained screenshots, and explicit human acceptance.
- **Non-goal:** P10C merchant editing, Vesko staging, or production-readiness claims.

#### P10B-18A — Commercial authority audit and quality-ceiling diagnosis

- **Outcome:** Establish the exact commercial ceiling of current registered source authority and
  assign each observed defect to fixture/source evidence, compatibility, materializer/renderer
  consumption or missing evaluation authority before any redesign.
- **Status:** **Baseline**. Accepted by the product owner on 16 August 2026 under
  [`P10B_18_COMMERCIAL_QUALITY_AUDIT.md`](P10B_18_COMMERCIAL_QUALITY_AUDIT.md).
- **Depends on:** P10B-17 and current registered synthesis, profile, renderer, asset and commerce
  authority.
- **Done:** A deterministic 72-case matrix, 18-store/108-capture retained human review and exact
  authority/fingerprint evidence diagnose the current ceiling, preserve canonical commerce/media,
  and freeze six conditional P10B-18B packages with zero OpenAI/provider, Vesko or publication
  traffic.
- **Evidence:** Current authority inventory and reachability, compatibility funnels, fixed-backbone
  semantic-influence proof, exact collapse witnesses, strongest/typical/weak store review, frozen
  issue denominators, protected-state parity and accepted checkpoint crosswalk.
- **Non-goal:** Implementing P10B-18B, proving those packages improve quality, satisfying P10B-18C,
  or closing parent P10B-18/P10B.

#### P10B-18B — Commercial source-authority quality upgrade

- **Outcome:** Implement the accepted coherent improvements to current Design DNA, compatibility,
  profiles, component consumers, asset-role selection and evaluation authority.
- **Status:** **Baseline** / complete. P10B-18B-01, P10B-18B-06, P10B-18B-02, P10B-18B-03,
  P10B-18B-04 and P10B-18B-05 are Baseline.
- **Depends on:** Accepted P10B-18A and its frozen package order/ownership.
- **Done when:** Every implemented package has focused positive/fail-closed evidence and the
  integrated authority produces improved multi-surface output against the frozen P10B-18A
  baseline without protected commerce/media drift.
- **Required evidence:** Contract/deterministic/integration evidence as applicable plus exact
  multi-width browser captures and retained human comparison for the changed authority.
- **Non-goal:** A second canonical model, page graph, component platform, renderer, commerce model,
  generated imagery, or an automatic claim that P10B-18C passed.

#### P10B-18B-01 — Design DNA and shared-frames quality upgrade

- **Outcome:** Materialize bounded within-direction density, report exact semantic dependencies,
  make the existing compact frame truthfully complete-store reachable, and refine the four shared
  frames without adding canonical authority.
- **Status:** **Baseline**. Accepted by the product owner on 17 August 2026 under
  [`P10B_18_COMMERCIAL_QUALITY_AUDIT.md`](P10B_18_COMMERCIAL_QUALITY_AUDIT.md).
- **Depends on:** Accepted P10B-18A and current Design DNA/direction/frame authority.
- **Done:** Design DNA remains `1.0.0` with two exact density outcomes per direction; semantic
  density and mobile hierarchy are truthfully compound; all nine audit strata have non-zero
  compact complete-store candidates; the same 72 cases improve from 3 to 6 non-colour DNA bundles
  and 25 to 36 normalized material topologies; 17 focused captures pass accepted review.
- **Evidence:** Fixed-backbone DNA/CSS proof, complete-site compatibility and former-blocker direct
  rendering, exact semantic/factorized authority, persistence/compiler/protected-state regression,
  final P10B-17 browser gate, production build/budgets, and accepted 17-capture manifest.
- **Non-goal:** Homepage, collection/search/card, PDP, content/utility or asset/art-direction
  redesign; a fifth frame; schema migration; P10B-18C quality/scale closure.
- **Historical handoff:** P10B-18B-06 — Asset Composition and Art Direction Quality Upgrade,
  subsequently accepted on 17 August 2026.

#### P10B-18B-06 — Asset Composition and Art Direction Quality Upgrade

- **Status:** **Baseline**. Accepted by the product owner on 17 August 2026 for the bounded shared
  asset-selection, purpose-affinity, reuse, responsive-source/crop, logo-consumer and art-direction
  authority.
- **Depends on:** Accepted P10B-18B-01.
- **Done:** Exact purpose-affine asset selection, explicit reuse limits, paired responsive hero
  sources and crops, one registered shared-header logo consumer, same-72-case regression and 13
  retained captures preserve snapshot, compiler, renderer and protected product-media truth.
- **Review closure:** The one automatic review was resolved in one focused pass: follow-up reuse
  ignores replaced homepage/header placements; paired sources enforce independent reuse and exact
  current provenance; primaries require complete viewport coverage; art direction is keyed by exact
  placement, upgrades existing authority, preserves approved crop identity/ratio and safe areas;
  source/treatment fallback stays independent; collection campaign affinity honors collection IDs.
- **Boundary:** This is not complete-storefront commercial visual acceptance. Excessive whitespace,
  generic homepage composition, weak merchandising rhythm and insufficient section hierarchy remain
  owned by P10B-18B-02/03/04/05.
- **Historical handoff:** P10B-18B-02 — Homepage / Editorial / Campaign Quality Upgrade,
  subsequently accepted on 18 August 2026.

#### P10B-18B-02 — Homepage / Editorial / Campaign Quality Upgrade

- **Status:** **Baseline**. Accepted by the product owner on 18 August 2026 for the bounded homepage,
  editorial and campaign quality authority.
- **Depends on:** Accepted P10B-18B-01 and P10B-18B-06.
- **Done:** The six existing homepage profiles now carry explicit transition intent, truthful
  story/catalogue semantic causality, asset-aware rich/sparse progression and distinct hierarchy;
  the renderer consumes observable hero, promotion, editorial and proof structures without a
  second page graph or renderer.
- **Evidence:** The unchanged nine-by-eight strata produce 38 normalized topologies, 55/72 repeated
  material memberships, a largest cluster of seven and 17 singletons. Fourteen retained captures
  prove rich/sparse, three same-direction profile/frame contrasts, compact mobile merchandising,
  internal overflow bounds, persistence and protected commerce/media parity.
- **Boundary:** This does not accept collection/search/product-card, PDP or content/utility visual
  quality and does not satisfy the P10B-18C designer-grade/100+ gate.
- **Historical handoff:** P10B-18B-03 — Collection / Search / Product-card Quality Upgrade.

#### P10B-18B-03 — Collection / Search / Product-card Quality Upgrade

- **Status:** **Baseline**. Accepted by the product owner on 18 August 2026 for the bounded
  collection, search-results and canonical product-card quality authority.
- **Depends on:** Accepted P10B-18B-02.
- **Delivered:** Retains the four collection/search profile identities and one renderer while adding
  deterministic micro/small/medium/dense presentation classification; facet usefulness and
  profile-specific filter hierarchy; proportional orientation/grid composition; five strengthened
  canonical card anatomies; comparison and dense executable search presentations; and exact
  provider-facing transient canonical-search capability truth without changing the provider schema.
- **Evidence:** The unchanged 72 semantic/catalogue strata produce 39 normalized topologies,
  53/72 repeated-cluster memberships, largest cluster 7, collection distribution
  editorial 35 / dense 27 / comparison 9 / campaign 1 and search distribution dense 63 /
  comparison 9. Twenty-one retained captures cover all four profile purposes, five card anatomies,
  Premium/Modern/Minimal outcomes, 375/768/1024/1440 geometry, zero/one/multiple-result search,
  exact save/reload/render authority and zero external/provider/Vesko/browser generation-endpoint/
  publication calls.
- **Boundaries:** No PDP, content/support/utility redesign, new product/search/filter/card authority,
  commerce mutation, provider call, Vesko call, generated media or real publication. Parent
  P10B-18B/P10B-18/P10B remain Partial and P10B-18C designer-grade/100+ acceptance is unproved.
- **Historical handoff:** P10B-18B-04 — PDP Quality Upgrade, subsequently accepted on 19 August 2026.

#### P10B-18B-04 — PDP Quality Upgrade

- **Status:** **Baseline**. Accepted by the product owner on 19 August 2026 for bounded PDP quality.
- **Depends on:** Accepted P10B-18B-03.
- **Delivered:** Retains the four stable PDP profiles and one canonical renderer/resolver while
  adding exact-product configuration, media-depth and decision-support matching; bounded
  content-driven media stages; stronger gallery, purchase, configuration-summary and related-
  merchandising hierarchy; failure-disabled purchase; and profile-authorized mobile sticky action.
- **Evidence:** Focused deterministic context and renderer matrices plus 20 retained captures at
  375/768/1024/1440 cover standard simple, light configurable, complex variant-led, rich gallery-
  led, high consideration with and without optional approved evidence, sparse media and
  zero/one/three related products. The unchanged 72 strata retain 39 normalized material
  topologies, 53/72 repeated memberships and the prior profile/frame/DNA distributions while
  preserving exact canonical variants, options, prices and media.
- **Boundaries:** No content/support/utility redesign, new commerce authority, product-type-name
  matching, provider call, Vesko call, generated media or real publication. This does not accept
  complete-store commercial visual quality or P10B-18C designer-grade/100+ quality.
- **Historical handoff:** P10B-18B-05 — Content / Support / Utilities Quality Upgrade, subsequently
  accepted on 20 August 2026. P10B-18C is now the exact next task; P10B-16P-05B remains after it.

#### P10B-18C — 100+ commercial quality and diversity gate

- **Outcome:** Prove final breadth, meaningful diversity and designer-grade commercial quality on
  the integrated P10B-18B authority.
- **Status:** **Baseline**. Accepted on 22 August 2026.
- **Depends on:** Accepted and integrated P10B-18B packages.
- **Done:** 126/126 exact complete-store compiles and deterministic replays, zero protected-state
  mutation or fabrication, 54 normalized topologies, explicit duplicate/causality accounting, a
  deterministic 28-store selector and final hash-bound 280-entry EN/FI four-width review with zero
  primary visual FAIL.
- **Required evidence:** Retained Stage A reports, complete browser manifest, request/runtime and
  geometry/accessibility ledgers, final human review, lifecycle/publication regressions and
  unchanged protected commerce/media.
- **Non-goal:** Treating P10B-18A evidence, registry counts, configuration count, automated checks,
  or one polished store as final commercial acceptance.

#### P10B-18D — Live AI commercial storefront acceptance

- **Outcome:** Diagnose freshly authorized live-AI generation against the final integrated post-18B
  authority without weakening deterministic compiler/materializer or protected-state boundaries.
- **Status:** **Baseline diagnostic / live commercial quality rejected**, 24 August 2026.
- **Depends on:** Accepted P10B-18C.
- **Result:** Six bounded calls preserve exact technical lineage and protected commerce/media, but
  only Concepts 3, 4 and 5 pass prompt fidelity. Concepts 2 and 6 resolve to the same exact
  authority. Concept 6 does not complete reload and full Preview proof.
- **Evidence limits:** Concept 1 safe/Reject evidence is partial; Concept 4 lacks two expired cart
  captures; Concept 5 lacks explicit Reject proof; Concept 6 is complete only through Save.
- **Non-goal:** Vesko calls, real publication, production-readiness claims or a second provider/
  compiler/materializer authority.

P10B-18 and P10B remain Partial. `P10B-19 PRE - Structural Design Intelligence Architecture Lock`
is Baseline. `P10B-19A - Structural Storefront Family Contract` is the exact next task; P10B-19B
through P10B-19J remain Planned.

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
- **Depends on:** P10C-08 and P10B-18.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Complete browser/E2E chain and retained human commercial review.
- **Non-goal:** Reopening P10B generation-system scope.

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

- **Outcome:** Prove one real pilot has complete diagnostics, audit, observability, recovery, and
  documented limitations.
- **Status:** **Blocked**.
- **Depends on:** P11-09.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Signed pilot-readiness and operational handoff record.
- **Non-goal:** Automatic production rollout.

### P12 — Production hardening and pilot operations

- **Outcome:** Close production authentication, tenancy, security, observability, recovery,
  deployment, incident response, and controlled-pilot operations.
- **Status:** **Blocked**.
- **Depends on:** P11-10.
- **Done when:** The stated outcome and required evidence are accepted.
- **Required evidence:** Security, load, recovery, telemetry, and controlled-pilot evidence.
- **Non-goal:** New design, editor, advanced-media, or commerce scope.

### P10B-18B-05 accepted Baseline (20 August 2026)

The accepted package preserves one `StorefrontSnapshot`, one `PageBlueprint`, one
fact/asset/navigation authority, the existing `contentSupport` and `commerceUtility` families and
transient utility runtime projection. Focused evidence is 31/31 final unit tests, 78/78 retained
P10B-12/13 browser tests, 70/70 focused authority/lifecycle tests, 2/2 dedicated matrix tests with 30
captures, and the unchanged 72/72 frozen compilation strata. The product owner accepted the exact
checkpoint on 20 August 2026. P10B-18B-05 and the completed P10B-18B parent are Baseline;
P10B-18/P10B remain Partial and P10B-18C is the exact next task. The mandated complete one-worker
Vitest ran exactly once: 2,925 tests passed, three retained assertions failed and one live-gated test
was skipped. The three findings were corrected through focused authority/test updates, all affected
focused reruns are green, and the final retained browser/lifecycle/compiler regressions are green.
PR review, CI and merge remain.

### P10B-18C accepted Baseline (22 August 2026)

The accepted deterministic gate uses nine catalogue/evidence shapes by fourteen semantic strata.
All 126 cases compile and replay, the frozen 72 remains 39 topologies / 53 repeated memberships /
largest seven / 19 singletons, protected commerce/media and external activity are zero, and the
expanded matrix contains 54 normalized topologies. The deterministic selector retains 28 stores and
the final complete manifest binds 280 captures across 375/768/1024/1440 and EN/FI. The final human
verdict is **PASS WITH MINOR LIMITATION** with zero primary FAIL. P10B-16P-05B subsequently removed
the one-time capture platform while retaining the bounded quality gate. P10B-18D subsequently
completed as a rejected-quality diagnostic. P10B-19 PRE is Baseline, and P10B-19A is the exact next
task.

## P10B-19 accepted architecture delivery state

| Status   | Task                      | State                    | Evidence / next boundary                                                                                                                |
| -------- | ------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Complete | P10B-19 PRE               | **Baseline**             | Product owner accepted the structural design intelligence architecture; no production implementation was included                       |
| Next     | P10B-19A                  | **Planned / exact next** | Structural Storefront Family and PageBlueprint v2 contracts, registry, topology identity, deterministic selection, and v1 compatibility |
| Planned  | P10B-19B through P10B-19J | **Planned**              | Granular Visual Recipe, frame, homepage, discovery, PDP, content/utility, multi-concept, critic, and final live-acceptance packages     |

The accepted parent plan contains 73 bounded child tasks. Each meaningful visual family requires a
focused product-owner screenshot checkpoint before merge. P10B remains Partial.

## DEVX-01 CI matrix authority

- DEVX-01A = Baseline
- DEVX-01B = Baseline
- DEVX-01C = Baseline
- DEVX-01D = Baseline
- DEVX-01E = Baseline
- DEVX-01F = Baseline
- DEVX-01F2 = Baseline
- DEVX-01G = exact next engineering task
- P10B-19A = next product-development sprint after DEVX-01

The canonical serial browser command now reads the versioned 12-suite inventory in
`scripts/playwright-ci-suites.v1.json` through `scripts/playwright-ci.mjs`. CI still runs one
serial `browser-regression` job and stops at the first failing suite. Per-suite records contain
bounded timing/status metadata only; the deterministic 2–6 group plans are advisory inputs for
DEVX-01F locks the two-group whole-suite matrix in
`scripts/playwright-ci-execution-plan.v1.json` and executes it through the canonical
`scripts/playwright-ci.mjs` authority. The workflow emits only bounded group IDs, runs every
canonical suite exactly once, retains per-group timing and blob evidence, rejects missing,
duplicate, unexpected or hash-mismatched artifacts before merge, and produces one merged HTML
report plus one matrix timing summary behind the stable `validate` check. The measured whole-suite
plan already meets the bounded makespan and balance targets, so no suite sharding is activated.
Audit the plan with `node scripts/playwright-ci.mjs audit-plan`; matrix rows use
`node scripts/playwright-ci.mjs run-group`; the report job runs
`node scripts/playwright-ci.mjs validate-group-artifacts` before
`pnpm exec playwright merge-reports`. DEVX-01F2 locks the three-shard source plan in
`scripts/vitest-ci-plan.v1.json`; runtime discovery binds all current files to official Vitest
shards, every row remains one-worker and serial, and `scripts/vitest-ci.mjs` rejects incomplete or
identity-mismatched manifests and blobs before validating one merged machine-readable result.
DEVX-01G owns two-run performance acceptance and workflow closure.
