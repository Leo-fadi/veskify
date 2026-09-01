# Veskify Development Roadmap

**Version:** 1.3.0

**Baseline:** 1 September 2026, P10B-19A-07 Inactive Family Registry and Candidate Fingerprints Baseline

**Active development phase:** P10B — Commercial Storefront Generation System v1 (**Partial**)

**Authoritative specification:** [`VESKIFY_SDD.md`](VESKIFY_SDD.md)

**Execution status:** [`VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md`](VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md)

This roadmap contains only approved delivery order, tasks, ownership, dependencies, evidence, and
non-goals. Capability truth and architecture live in the SDD. Checkbox progress and detailed exit
criteria live in the delivery tracker.

**Engineering enablement:** DEVX-01A through DEVX-01G are Baseline, and DEVX-01 is Baseline /
closed. P10B-19A-01 through P10B-19A-07 are Baseline, P10B-19A is Partial, and P10B-19A-08 -
Compatibility, Deterministic Selection and Normalized Topology Identity is the exact next
implementation task. P10B remains Partial.

## 1. Delivery order

| Order | Phase                                                         | Outcome                                                                                 | Status                | Dependency                                                                 | Owner                                | Required evidence                                                                                            | Non-goal                                                                 |
| ----- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1     | P10A — Grounded orchestration and publishing closure          | Close internal governed execution and authoritative publication evidence.               | **Baseline / closed** | Phase 9 product-owner handoff                                              | Veskify orchestration and publishing | Real-provider where eligible; contract; deterministic; integration; browser/E2E; retained publication review | Merchant-facing router/editor controls                                   |
| 2     | P10B — Commercial Storefront Generation System v1             | Generate complete commercially credible storefronts with substantial bounded diversity. | **Partial**           | P10A closure                                                               | Veskify storefront generation        | Contract; deterministic scale/diversity; integration; browser/E2E; retained responsive human visual review   | Storefront Studio editing UX or Vesko commerce operations                |
| 3     | P10C — Storefront Studio Editing Experience v1                | Make canonical manual and scoped AI editing merchant operable.                          | **Planned**           | P10B commercial authority                                                  | Storefront Studio                    | Contract; integration; browser/E2E; retained human commercial review                                         | New canonical state or commerce editor                                   |
| 4     | P10D — Advanced media and registered interactive presentation | Add governed media and registered interactive presentation with safe fallbacks.         | **Planned**           | Relevant P10B component/asset authority                                    | Veskify design system and media      | Contract; integration; browser/E2E; performance; accessibility; human review                                 | Blocking the first commercial storefront, minimum editor, or Vesko pilot |
| 5     | P11 — Vesko Integration Readiness and Reference Adapter       | Close typed contracts and prove the canonical lifecycle in Vesko staging.               | **Blocked**           | P10A publication closure and minimum P10C editor; Vesko contract decisions | Veskify + Vesko platform             | Contract; adapter conformance; integration; browser/E2E; Vesko staging                                       | Commerce writes or raw Puck persistence                                  |
| 6     | P12 — Production hardening and pilot operations               | Establish secure, observable, recoverable production service and controlled pilots.     | **Blocked**           | P11 staging exit                                                           | Veskify + Vesko platform/operations  | Security; load; recovery; staging; production pilot evidence                                                 | Product-scope expansion                                                  |

P10D is deliberately non-blocking for the first commercial storefront, the minimum pilot editor,
and the Vesko pilot.

### 1.1 DEVX-01 engineering-enablement sprint

| Order | Task                                                                                 | Outcome                                                                                                 | Status       | Dependency           |
| ----: | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
|     1 | DEVX-01A - Sprint contract and independent verification protocol                     | Lock immutable child contracts, roles, scope budgets, rolling waves and pre-PR independent verification | **Baseline** | Accepted P10B-19 PRE |
|     2 | DEVX-01B - Mechanical contract/verdict verifier                                      | Enforce contract identity, paths, budgets, evidence coverage and terminal verdicts                      | **Baseline** | DEVX-01A             |
|     3 | DEVX-01C - CI timings, obsolete-run cancellation and Next build caching              | Establish measured CI timing, cancellation and safe build caching                                       | **Baseline** | DEVX-01B             |
|     4 | DEVX-01D - Parallel static, Vitest and production-build jobs                         | Split independent CI work behind stable required authority                                              | **Baseline** | DEVX-01C             |
|     5 | DEVX-01E - Playwright timing inventory and balanced execution groups                 | Measure and balance retained browser groups                                                             | **Baseline** | DEVX-01D             |
|     6 | DEVX-01F - Playwright sharding/matrix, merged reports and stable required aggregator | Execute browser groups safely in parallel with one required result                                      | **Baseline** | DEVX-01E             |
|     7 | DEVX-01F2 - Contention-safe Vitest sharding                                          | Execute complete one-worker Vitest shards on isolated runners and validate one merged result            | **Baseline** | DEVX-01F             |
|     8 | DEVX-01G - Two-run performance acceptance and workflow closure                       | Prove stable improvement over two clean runs and close DEVX-01                                          | **Baseline** | DEVX-01F2            |

DEVX-01 changes development execution, not storefront behavior or the accepted P10B-19
architecture. Run A completed in 34m27s with complete coverage on a cache miss; Run B remains the
final before-merge gate under the same frozen architecture. P10B-19A-01 through P10B-19A-07 are
Baseline, P10B-19A is Partial, and P10B-19A-08 - Compatibility, Deterministic Selection and
Normalized Topology Identity is the exact next implementation task.

### 1.2 P10B-19A planned child sequence

| Order | Child task                                                                            |
| ----: | ------------------------------------------------------------------------------------- |
|     1 | P10B-19A-01 - Structural family identity, versions, lifecycle states and invariants   |
|     2 | P10B-19A-02 - Cross-page structural relationship contract                             |
|     3 | P10B-19A-03 - Required page structures, region graph and PageBlueprint v2 dispatch    |
|     4 | P10B-19A-04 - Asset-role contract                                                     |
|     5 | P10B-19A-05 - Responsive-rule contract                                                |
|     6 | P10B-19A-06 - Omission, substitution and fallback contract                            |
|     7 | P10B-19A-07 - Inactive family registry and candidate fingerprints                     |
|     8 | P10B-19A-08 - Compatibility, deterministic selection and normalized topology identity |
|     9 | P10B-19A-09 - v1 read/render/migration/publication compatibility                      |
|    10 | P10B-19A-10 - Retained matrices, integration and P10B-19A closure                     |

P10B-19A-01 through P10B-19A-07 are **Baseline**, parent P10B-19A is **Partial**, and P10B-19A-08 -
Compatibility, Deterministic Selection and Normalized Topology Identity is the exact next
implementation task. P10B-19A-07 adds strict, deeply readonly PageBlueprint v2 and Structural
Storefront Family candidate authorities at candidate schema version `1.0.0`. A PageBlueprint
candidate composes canonical A-03/A-04/A-05/A-06 authority at one exact ID/version and carries a
stale-checked `page-blueprint-v2-candidate-v1_<canonical-length>_<sha256>` exact-content
fingerprint. A family candidate keeps exact A-01 ID/version and lifecycle `candidate`, contains
exactly one nonempty profile-reference entry for each of the six A-02 page-family roles plus
canonical A-02 relationships, and carries a stale-checked
`structural-storefront-family-candidate-v1_<canonical-length>_<sha256>` fingerprint that excludes
lifecycle. The strict inactive registry canonicalizes bounded candidates, rejects duplicate
identities, stale fingerprints, unresolved or page-family-mismatched fallback targets, and direct,
indirect, or cross-version substitution cycles while preserving A-06 target priority. Its sole
production registry value contains two exactly empty candidate arrays. These fingerprints prove
content integrity, not normalized topology; active or candidate records, selection, activation,
persistence, publication, and runtime consumers remain zero. A-01 through A-06 and v1 stay
unchanged; A-08 owns compatibility, deterministic selection, and normalized topology.
P10B-19A-06 adds a strict version `1.0.0` omission, substitution and fallback companion under the
sole storefront-template PageBlueprint authority. It composes the exact A-03, A-04 and A-05
blueprint identity; owns only the `required-asset-role-cardinality-unsatisfied` trigger; declares
one explicit `omit-region` or `fail-closed` terminal rule for every and only required-role region;
and preserves up to eight whole-blueprint substitution references in declared priority order. A
bounded internal A-03 projection validates maximum simultaneous optional omission without becoming
a new record. It introduces no availability, target lookup, compatibility, selection, execution,
registry, persistence, renderer or runtime consumer. P10B-19A-05 retains the responsive-rule
companion with exactly `mobile`/375, `tablet`/768, `desktop`/1024, and `wide`/1440. Proportions are
limited to `preserve`, `compress`, `expand`, and `full-width`; relationship transformations are
limited by kind while `precedes` always preserves. Canonicalization follows canonical breakpoint
order, each selected alternative's reading order, and canonical A-03 relationship order while
preserving all structural and accessibility invariants. It adds no visibility, media, fallback,
rendering, records, persistence, selection, or production consumers. P10B-19A-04 adds a
strict version `1.0.0` asset-role compatibility companion under the sole storefront-template
PageBlueprint authority. It reuses the canonical ordered nine-role vocabulary, binds exact
blueprint ID/version and known region IDs, validates explicit required/optional role cardinality
through maximum 32, and canonicalizes valid authority by structural default reading order and
canonical role order. It adds no exact assets, availability, responsive/fallback authority,
records, registry, persistence, selector, renderer or current-generation consumer. P10B-19A-03 adds the
strict inactive PageBlueprint v2 region contract and explicit v1 `1.0.0` / v2 `2.0.0`
`contractSchemaVersion` dispatch under the existing storefront-template authority. Its bounded
region graph reuses canonical A-02 page-family, narrative-role and visual-weight authority; locks
`precedes`, `pairs-with`, `offsets`, `contains`, `spans` and `anchors`; enforces page-family minimum
required roles, acyclic ordering/containment, single direct containment parents and complete
accessible order alternatives; and canonicalizes successful input deterministically. Current v1
records and behavior are unchanged, while v2 record, registry, persistence and current-generation
consumer counts stay zero. A-03 itself added no responsive or fallback authority.
P10B-19A-02 adds the strict six-role and seven-kind directed cross-page
relationship contract with deterministic keys, duplicate rejection and canonical ordering. It adds
no relationship records, registry, graph, PageBlueprint v2 dispatch or current-generation consumer.
P10B-19A-01 establishes
`src/domain/structural-storefront-family` as the sole family identity authority with the ordered
IDs `editorial-offset`, `campaign-modular`, `product-first-commerce`, `technical-comparison`,
`warm-narrative`, and `restrained-gallery`; strict supported-major-v1 versions beginning at
`1.0.0`; and lifecycle states `candidate`, `active`, and `deprecated`. Active-family and candidate-
registry-record counts remain zero. A-01 itself added no registry, fingerprint, selection,
PageBlueprint v2, rendering, or current-generation wiring.

The ten children preserve the accepted P10B-19 PRE architecture and are independently mergeable
only in dependency order. The product owner explicitly approved this DEVX-01A delivery
decomposition to supersede the earlier six-child P10B-19A partition; it does not change accepted
P10B-19 authority or outcomes. The map does not authorize implementation during DEVX-01.

## 2. P10A — Grounded orchestration and publishing closure

| Task                                                            | Outcome                                                                                                                                                                                | Status       | Dependency                                                                   | Owner                       | Required evidence                                                                            | Non-goal                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| P10A-07C-03R — Controlled real-provider acceptance completion   | Pass one explicitly authorized real-provider initial-generation case before one follow-up case, with safe retained evidence and no retry.                                              | **Baseline** | Explicit approval and eligible trusted OpenAI provider/model configuration   | Veskify provider acceptance | Real-provider; correlated safe record of both ordered cases                                  | Provider redesign, retry, merchant editor wiring                  |
| P10A-08B-02 — Accepted-AI acceptance-to-receipt wiring          | Mint and persist the exact server-owned accepted-snapshot receipt on authoritative proposal acceptance and resolve it through the active publish gateway.                              | **Baseline** | Existing proposal acceptance, receipt, and gateway authorities               | Veskify proposal/publishing | Deterministic unit; integration; browser/E2E; stale/divergent/no-partial-write rejection     | Browser-created authority or manual fallback                      |
| P10A-08C-02B — Atomic compiled publication and rollback closure | Commit the compiled artifact, published snapshot, publication history, and active version atomically; preserve the live version on failure; restore to draft and republish explicitly. | **Baseline** | P10A-08B-02 and existing deterministic compiler                              | Veskify publishing          | Contract; deterministic unit; integration; atomicity/idempotency/rollback/republish evidence | Second editable model or commerce snapshot                        |
| P10A-08D-02 — Complete publication evidence                     | Prove manual and accepted-AI compile/publish, exact home/collection/PDP rendering, failure atomicity, draft/published isolation, restore, and republish with zero provider calls.      | **Baseline** | P10A-08C-02B                                                                 | Veskify publishing and QA   | Browser/E2E; retained human publication review; correlated receipts/artifacts/routes         | P10B commercial visual-quality claim                              |
| P10A-09 — Phase closure record                                  | Synchronize evidence, limitations, README, SDD, roadmap, and exports and formally close P10A.                                                                                          | **Baseline** | P10A-07C-03R, P10A-08B-02, P10A-08C-02B, P10A-08D-02 or explicit disposition | Product architecture owner  | Accepted closure record linked to retained evidence and synchronized documentation           | Merchant-facing routing, clarification, or scoped editor controls |

P10A owns internal governed initial/follow-up execution, package authority, strict routing,
proposal lifecycle, functional evidence, and publishing authority. P10C owns normal Storefront
Studio wiring, clarification UI, frame/page scope controls, and merchant execution.

P10A is formally closed at Baseline by the
[`P10A_PHASE_CLOSURE.md`](P10A_PHASE_CLOSURE.md) exit audit. P10B is now the active development
phase; each remaining task stays Planned until implemented and evidenced.

## 3. P10B — Commercial Storefront Generation System v1

The binding architecture, coverage targets, concrete Done conditions, synthesis/fingerprint model,
and parallelization rules live in
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md).
P10B is **Partial / active**. P10B-01 through P10B-17, P10B-16P-01 through P10B-16P-05A,
P10B-16P-06, accepted P10B-18A, accepted P10B-18B-01, accepted P10B-18B-06, accepted
P10B-18B-02, and accepted P10B-18B-03 are Baseline.
P10B-16P-02, completed P10B-18B, accepted P10B-18C and P10B-16P-05B are **Baseline**; P10B-18 and
P10B remain **Partial**. P10B-18D is a **Baseline diagnostic with live commercial quality
rejected**. P10B-19 PRE is **Baseline**; P10B-19A is **Partial**; P10B-19A-01 through
P10B-19A-07 are **Baseline**, P10B-19A-08 is **Planned / exact next**, and P10B-19B through
P10B-19J remain **Planned**.
P10B-16P-04
acceptance evidence is retained in
[`P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md`](P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md).
P10B-18A accepted ceiling evidence and the frozen conditional package plan are retained in
[`P10B_18_COMMERCIAL_QUALITY_AUDIT.md`](P10B_18_COMMERCIAL_QUALITY_AUDIT.md).
The original P10B-01 through P10B-18 sequence remains intact except for the product-owner-approved
placement of P10B-16P-05B immediately after P10B-18C and before P10B-18D. P10B-16P-01 through
P10B-16P-05A plus P10B-16P-06 remain the sequential convergence package between P10B-16 and
P10B-17; P10B-16P-05B is the accepted consumer-verified cleanup. A slice does not renumber or
independently complete the parent phase. Accepted P10B-18B-03,
P10B-18B-04 and P10B-18B-05 are the current bounded collection/search/product-card, PDP and
content/support/utility baselines; parent P10B-18B and P10B-18C are Baseline. P10B-18D is a
completed rejected-quality diagnostic. P10B-19 PRE is Baseline, and P10B-19A is Partial;
P10B-19A-01 through P10B-19A-07 are Baseline, and P10B-19A-08 - Compatibility, Deterministic
Selection and Normalized Topology Identity is the exact next implementation task.

The P10B-16P-04 Aurum composition is now the single lean, token-protected, production-disabled
mock/live seam retained for P10B-18D. P10B-16P-05A removed active P10B-16L initial generation;
P10B-16P-05B removed the one-time P10B-18C production-capture platform and superseded acceptance
runners while retaining governed P9 follow-up, stable migration identities and durable quality
regressions.

P10B-17 replays existing registered direction and neutral authority without provider calls and
closes responsive execution at 375, 768, 1024, and 1440 px in EN/FI. Its bounded evidence covers
shared-frame and page-family geometry, keyboard/focus/semantic/contrast behavior, protected
commerce/media parity, deterministic render/search/media/build budgets, browser lifecycle parity,
and representative human visual review. It does not claim P10B-18B source-authority improvement,
P10B-18C designer-grade commercial quality or 100+ scale, Vesko staging, production authentication,
or production performance.

### 3.1 Dependency waves

| Wave                           | Planned work                                                                                                                           | Gate                                                                                                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Grammar                    | P10B-01 (**Baseline**)                                                                                                                 | Existing authorities have executable vocabulary; no visual implementation claim.                                                                                                                                                                                     |
| 2 — Parallel foundations       | P10B-02, P10B-03, P10B-05 (**Baseline**)                                                                                               | Disjoint ownership of BrandSystem, component anatomy, and page-set/PageBlueprint authority.                                                                                                                                                                          |
| 3 — Art direction and families | P10B-04, P10B-06, P10B-07, P10B-08 (**Baseline**)                                                                                      | Real registered frame/content/merchandising authority reaches renderers.                                                                                                                                                                                             |
| 4 — Page profiles              | P10B-09 through P10B-13 (**Baseline**)                                                                                                 | Complete home, commerce, content/support, and utility page coverage.                                                                                                                                                                                                 |
| 5 — Early complete store       | P10B-14 (**Baseline**)                                                                                                                 | One credible Premium Editorial multi-page storefront passes retained human review.                                                                                                                                                                                   |
| 6 — Synthesis and diversity    | P10B-15, P10B-16 (**Baseline**)                                                                                                        | Bounded synthesis, three coordinated direction packages and deterministic duplicate/near-duplicate control are live.                                                                                                                                                 |
| 6P — Generation convergence    | P10B-16P-01 through P10B-16P-05A plus P10B-16P-06 (**Baseline**)                                                                       | Route instances no longer own design; strict intent, canonical compilation, mocked Studio generation, real V2 A/B/C normal-Studio acceptance, one active semantic path/compiler/materializer chain, and transient canonical search query/results authority are live. |
| 7 — Deterministic closure      | P10B-17, P10B-18A, completed P10B-18B and P10B-18C (**Baseline**); parent P10B-18/P10B (**Partial**)                                   | Responsive/a11y/performance, all six source-authority packages, and deterministic 126-case/280-capture quality acceptance are closed.                                                                                                                                |
| 8 — Historical cleanup         | P10B-16P-05B (**Baseline**)                                                                                                            | Consumer-proven cleanup removes one-time acceptance infrastructure while retaining migration, durable quality and the lean P10B-18D seam.                                                                                                                            |
| 9 — Live and intelligence      | P10B-18D (**Baseline diagnostic / quality rejected**), P10B-19 PRE (**Baseline**), P10B-19A (**Partial**) and P10B-19B-J (**Planned**) | The accepted live diagnostic exposes exact cross-prompt authority collapse; the structural-design-intelligence architecture lock precedes its ten planned implementation packages.                                                                                   |

### 3.2 Locked tasks

| Task                                                                | Outcome                                                                                                                                                                                                                           | Status                                     | Dependency                                                      | Owner                                                    | Required evidence                                                                                                                                                                                      | Non-goal                                                                                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| P10B-01 — Commercial design grammar and compatibility vocabulary    | Make structural, visual, responsive, narrative, and compatibility vocabulary executable through existing authority.                                                                                                               | **Baseline**                               | P10A closure; architecture lock; historical audit/specification | Canonical design contracts                               | Schema/queryability, inheritance/compatibility, migration and typed rejection                                                                                                                          | New token/registry/page/recipe/direction authority                                                                       |
| P10B-02 — Parametric BrandSystem / Design DNA                       | Make merchant-wide typography, palette, rhythm, layout, surfaces, controls, shape/elevation, density, and media posture bounded and coherent.                                                                                     | **Baseline**                               | P10B-01                                                         | BrandSystem                                              | Migration, non-colour cross-page projection, save/publish preservation, responsive evidence                                                                                                            | Per-section themes or raw CSS                                                                                            |
| P10B-03 — Component anatomy and meaningful variant contract         | Register anatomy, structural variants, parameters, assets, responsive transformations, and compatibility for every commercial family.                                                                                             | **Baseline**                               | P10B-01                                                         | Component platform                                       | 29 definitions/126 variants classified; schema/queryability, meaningful structural difference, migration and fail-closed validation                                                                    | CSS-class aliases presented as variants                                                                                  |
| P10B-04 — Responsive image and art-direction authority              | Add approved focal point, safe area, crop, ratio, overlay, derivative, and responsive treatment authority.                                                                                                                        | **Baseline**                               | P10B-02, P10B-03                                                | Asset presentation and media                             | 35-case authority suite, asset/media integration, lifecycle regression, semantic renderer and four-width browser evidence                                                                              | Mutating canonical product media; production CDN transforms                                                              |
| P10B-05 — Veskify site-map and page-family authority                | Create and validate complete page sets, navigation, routes, and registered page families through PageBlueprint/StorefrontSnapshot.                                                                                                | **Baseline**                               | P10B-01                                                         | PageBlueprint and storefront domain                      | Route/navigation/page-set validation, canonical generation, save/publish preservation                                                                                                                  | Second page graph or unrestricted CMS                                                                                    |
| P10B-06 — Commercial shared-frame families                          | Deliver at least four frames, three mobile navigation modes, and four footer compositions.                                                                                                                                        | **Baseline**                               | P10B-02, P10B-03, P10B-05; P10B-04 where applicable             | Shared frame                                             | Four profiles, three mobile modes, four footers, lifecycle, EN/FI/four-width keyboard/focus, and retained visual evidence                                                                              | Merchant editor controls or new navigation truth                                                                         |
| P10B-07 — Hero, editorial, campaign and proof families              | Deliver at least six hero compositions plus reusable story, campaign, service, and evidence-backed proof families.                                                                                                                | **Baseline**                               | P10B-02 through P10B-05                                         | Commercial content families                              | Six distinct hero anatomies; story/campaign/proof capability chain; grounded omission; four-width browser evidence                                                                                     | Invented claims or generic filler                                                                                        |
| P10B-08 — Canonical product-card and merchandising family           | Establish one protected card authority with at least five meaningful anatomies.                                                                                                                                                   | **Baseline**                               | P10B-02 through P10B-04                                         | Commerce presentation                                    | One renderer, cross-context fact/media parity, lifecycle/publish authority and four-width browser evidence                                                                                             | Duplicate card authority or commerce ownership                                                                           |
| P10B-09 — Commercial homepage profile library                       | Deliver at least six materially different homepage profiles and narrative flows.                                                                                                                                                  | **Baseline**                               | P10B-05 through P10B-08                                         | PageBlueprint profiles                                   | Six fingerprinted profiles; exact frame/story/card composition; evidence/cardinality guards; lifecycle and 24-view browser evidence                                                                    | Colour-only profiles or unregistered sections                                                                            |
| P10B-10 — Commercial collection and search profiles                 | Deliver four editorial, comparison, campaign, and dense/search profiles.                                                                                                                                                          | **Baseline**                               | P10B-04 through P10B-06, P10B-08                                | PageBlueprint and dynamic collection                     | Exact commerce/intents/cards/zero-results, lifecycle, 16 responsive views and retained report evidence                                                                                                 | Second collection engine, membership mutation, or operational search route                                               |
| P10B-11 — Commercial PDP profile library                            | Deliver at least four standard, high-consideration, gallery-led, and variant-led experiences.                                                                                                                                     | **Baseline**                               | P10B-03 through P10B-06, P10B-08                                | PageBlueprint and dynamic PDP                            | Generic options/configurations, commerce/media parity, all-target render and retained review                                                                                                           | Product-type forks                                                                                                       |
| P10B-12 — Content and support page families                         | Generate About, Contact/locations, FAQ, shipping/returns, policy, campaign/editorial, and generic content pages from approved facts.                                                                                              | **Baseline**                               | P10B-03 through P10B-07                                         | PageBlueprint and content families                       | 15 profiles; approved-fact provenance; locale/navigation; save/reload/compiler; 61 Chromium checks                                                                                                     | Fabricated policy/service/compliance claims                                                                              |
| P10B-13 — Commerce utility presentation pages                       | Deliver governed search/no-results, cart, checkout, empty, error, and 404 presentation.                                                                                                                                           | **Baseline**                               | P10B-03, P10B-05, P10B-06, P10B-08                              | Utility presentation                                     | Canonical facts/actions, state distinction, save/publish preservation, 16 responsive views and retained evidence                                                                                       | Cart/checkout/payment operations                                                                                         |
| P10B-14 — Premium Editorial complete-storefront vertical slice      | Prove one credible complete multi-page storefront before broad synthesis/direction expansion.                                                                                                                                     | **Baseline**                               | Minimum accepted P10B-02 through P10B-13 capability             | Storefront generation and QA                             | 17 routes; canonical generation/save/publish; 15 retained screenshots; passing 160-scenario human review                                                                                               | Hand-built or homepage-only proof                                                                                        |
| P10B-15 — Bounded storefront synthesis and narrative engine         | Generate coherent complete stores from compatible Design DNA, page set, profiles, variants, parameters, assets, and narrative roles.                                                                                              | **Baseline**                               | P10B-14 and sufficient real family/profile authority            | Storefront generation                                    | Versioned deterministic authority; 25-case matrix; three complete 17-route outcomes; lifecycle publication; four-width browser and 480-scenario retained human review                                  | Arbitrary trees/styles, best-effort mutation, or P10B-16 diversity control                                               |
| P10B-16 — Coordinated directions and diversity control              | Make the three directions constraint packages and add deterministic duplicate/near-duplicate prevention.                                                                                                                          | **Baseline**                               | P10B-15                                                         | Direction selection and evaluation                       | Three versioned packages; nine complete outcomes; structural fingerprint/classification; repetition control; 31 focused cases; four-width browser and retained human review                            | Fixed templates, aesthetic AI scoring, 100+ scale gate or colour-only diversity                                          |
| P10B-16P-01 — Dynamic commerce route archetype authority            | Separate static design pages, maintained collection/search and PDP archetypes, and concrete runtime route inventory in one snapshot.                                                                                              | **Baseline**                               | P10B-16 and P10B-05/P10B-10/P10B-11 authority                   | Storefront domain and runtime routes                     | Versioned/fingerprinted authority; deterministic mapping/migration; Studio projection; lifecycle/compiler/publication; exact route and browser evidence                                                | One design page per product/collection, provider-plan changes, or individual route overrides                             |
| P10B-16P-02 — Prompted design-plan contract                         | Establish strict transient provider design intent, then compile it deterministically through current authority.                                                                                                                   | **Baseline**                               | P10B-16P-01                                                     | Provider and design-plan authority                       | Strict contract/mock evidence; bounded metadata solver; exact authority compilation; canonical one-shot synthesis/proposal and no-partial lifecycle evidence                                           | Provider-owned page graph, commerce, code, or final Studio journey                                                       |
| P10B-16P-02A — Prompted Storefront Design Intent V2                 | Project current capability safely and accept one strict non-executable preference-rich provider intent without pre-provider materialization.                                                                                      | **Baseline**                               | P10B-16P-01                                                     | Provider contract and adapter                            | Strict schema/reference/fingerprint/failure tests, mocked OpenAI transport, dependency boundary                                                                                                        | Deterministic intent compilation, proposal/snapshot creation, live provider acceptance                                   |
| P10B-16P-02B — Deterministic design-intent compiler                 | Compile refreshed V2 preferences into exact registered compatible selections and the existing canonical synthesis/proposal path.                                                                                                  | **Baseline**                               | P10B-16P-02A                                                    | Design-plan compiler                                     | Deterministic bounded metadata resolution; exact PageBlueprint/dynamic/component selection; diagnostics/fingerprints; stale/incompatible/no-partial rejection; lifecycle preservation                  | Provider-owned materialization, Studio UX, search execution or live acceptance                                           |
| P10B-16P-03 — Storefront Studio generation journey                  | Complete the normal prompt-to-review storefront generation journey through existing proposal and snapshot authority.                                                                                                              | **Baseline**                               | P10B-16P-02B                                                    | Storefront Studio and generation                         | Standalone/mock server authority; integrated auth fail-closed; one registered structural operation; exact P02B source-proposal fingerprint/lineage; retained evidence; lifecycle and browser/E2E proof | Live provider evidence, new snapshot authority, bypassed review, or P10C general editing                                 |
| P10B-16P-04 — Live V2 acceptance and bridge disposition             | Prove the prompt-driven V2 path with separately authorized real-provider evidence and decide the P10B-16L compatibility bridge disposition.                                                                                       | **Baseline**                               | P10B-16P-03                                                     | Provider acceptance and architecture                     | Safe 16-call ledger; final A/B/C Studio proposals; C full lifecycle; zero retry/fallback/publish; protected commerce/media; retained human review; Deprecated P10B-16L                                 | Automatic calls, executable search, production claims, or preset selection as V2 evidence                                |
| P10B-16P-05A — Active production-path and compiler rationalisation  | Make one canonical semantic initial-generation composition and one coordinator/resolver/exact-decision/executor chain explicit; remove active P10B-16L and isolate P9 generation while retaining required compatibility/evidence. | **Baseline**                               | P10B-16P-04                                                     | Generation route, provider boundary and compiler         | Import/runtime architecture; deterministic A/B/C replay; one provider/one materialization; migration/publication/protected-state regressions                                                           | Search execution, visual redesign, final evidence cleanup, P10B-17, or P10B-18                                           |
| P10B-16P-06 — Canonical search query/results adapter                | Execute the one persisted `/search` presentation through validated transient query/filter/sort/page state and exact current canonical product IDs.                                                                                | **Baseline**                               | P10B-16P-05A and P10B-16P-01/P10B-10/P10B-13 authority          | Search runtime and commerce presentation                 | Contract/schema; deterministic ranking/filter/pagination; integration; lifecycle/publication non-persistence; EN/FI browser evidence; protected commerce/media                                         | Vesko search integration, AI/semantic/fuzzy search, recommendations, analytics, or persisted query/results               |
| P10B-17 — Responsive, accessibility and performance closure         | Preserve deliberate hierarchy and usability across 375/768/1024/1440, EN/FI, accessibility, and bounded budgets.                                                                                                                  | **Baseline**                               | P10B-16P-06 and implemented families/profiles/directions        | Design system and QA                                     | Registered transformations; four-width EN/FI geometry; keyboard/semantic/contrast; bounded performance/build budgets; browser and retained human visual evidence                                       | P10B-18B source improvement, P10B-18C quality/scale, Vesko staging, or production claims                                 |
| P10B-18 — Commercial quality and scale gate                         | Prove repeated generation of publishable, premium, materially different complete storefronts.                                                                                                                                     | **Partial**                                | P10B-17 and all prior P10B tasks                                | Product owner, generation, QA                            | Accepted P10B-18A ceiling audit, P10B-18B source-authority improvement, then P10B-18C 100+ deterministic configurations and fingerprint-stratified retained human review                               | Closure from the accepted audit, one store, tests, screenshots, counts, or placeholders alone                            |
| P10B-18A — Commercial authority audit and quality-ceiling diagnosis | Audit current source authority, reachability, compatibility, materializer/renderer consumption and commercial output before redesign.                                                                                             | **Baseline**                               | P10B-17 and current registered authority                        | Product owner, generation, QA                            | Accepted 72-case deterministic matrix; 18-store/108-capture retained human review; protected commerce/media; zero provider/Vesko/publication traffic; frozen six-package improvement plan              | Implementing source upgrades, claiming designer-grade quality, or satisfying the 100+ gate                               |
| P10B-18B — Commercial source-authority quality upgrade              | Implement and evidence the accepted coherent improvements to existing Design DNA, compatibility, profiles, component consumers, assets and evaluation authority.                                                                  | **Baseline**                               | Accepted P10B-18A                                               | Generation/component/profile/evaluation owners           | Six accepted package-level positive/fail-closed matrices plus integrated browser and human review against the frozen P10B-18A baseline                                                                 | A second page graph/renderer/commerce model or an automatic quality claim                                                |
| P10B-18B-01 — Design DNA and shared-frames quality upgrade          | Materialize bounded within-direction density, truthful semantic/frame-responsive causality, complete-store compact reachability, and intentional shared-frame composition.                                                        | **Baseline**                               | Accepted P10B-18A                                               | Design DNA, direction, frame and evaluation owners       | Same-72-case consumed-authority deltas; direct compatibility/render proof; 17-capture accepted review; P10B-17/build/lifecycle/protected-state preservation                                            | Later page-family, asset/art-direction or P10B-18C quality closure                                                       |
| P10B-18B-06 — Asset composition and art-direction quality upgrade   | Select approved presentation assets by exact placement purpose, bound reuse, pair approved responsive sources, and consume exact art direction in existing renderers and the shared frame.                                        | **Baseline**                               | Accepted P10B-18B-01                                            | Asset, responsive-image, frame and evaluation owners     | Accepted same-72-case regression; exact source/crop/reuse/provenance evidence; 13-capture checkpoint; lifecycle/build/protected-media preservation                                                     | Complete-storefront visual acceptance, page-family redesign, generated imagery, asset-library UI, or P10B-18C acceptance |
| P10B-18B-02 — Homepage / editorial / campaign quality upgrade       | Upgrade existing homepage profiles and hero/editorial/campaign consumers into intentional rich and sparse page progression with stronger hierarchy and merchandising rhythm.                                                      | **Baseline**                               | Accepted P10B-18B-01 and P10B-18B-06                            | Homepage profile, component and evaluation owners        | Accepted same-strata topology/concentration accounting; rich/sparse retained review; exact persistence; protected commerce/media and lifecycle preservation                                            | Collection/search/card, PDP, content/utility redesign, new page graph/renderer, or P10B-18C acceptance                   |
| P10B-18B-03 — Collection / search / product-card quality upgrade    | Strengthen collection and search composition, product-card hierarchy and merchandising density through the existing registered authorities.                                                                                       | **Baseline**                               | Accepted P10B-18B-02                                            | Collection/search, product-card and evaluation owners    | Accepted same-strata structural accounting; 21-capture retained review; protected commerce/media, canonical search and lifecycle preservation                                                          | PDP, content/utility redesign, new commerce model, or P10B-18C acceptance                                                |
| P10B-18B-04 — PDP quality upgrade                                   | Strengthen the existing PDP opening hierarchy, gallery, option/purchase composition and related merchandising without replacing canonical commerce or page authority.                                                             | **Baseline**                               | Accepted P10B-18B-03                                            | PDP profile, commerce presentation and evaluation owners | Accepted same-strata structural accounting; 20-capture four-width review; protected variants/options/media and lifecycle preservation                                                                  | Collection/search, content/utility redesign, commerce writes, or P10B-18C acceptance                                     |
| P10B-18B-05 — Content / support / utilities quality upgrade         | Strengthen existing content, support and utility compositions without adding a second content, cart, error or page authority.                                                                                                     | **Baseline**                               | Accepted P10B-18B-04                                            | Content/support/utility and evaluation owners            | Profile-specific browser review, lifecycle preservation and protected commerce/navigation evidence                                                                                                     | PDP redesign, operational cart ownership, or P10B-18C acceptance                                                         |
| P10B-18C — 100+ commercial quality and diversity gate               | Run final deterministic breadth/quality/diversity analysis and fingerprint-stratified retained human acceptance on the integrated P10B-18B authority.                                                                             | **Baseline**                               | Accepted and integrated P10B-18B packages                       | Product owner, generation, QA                            | 126 complete configurations and replays; protected-state/duplicate/causality gates; 28-store, 280-entry four-width EN/FI retained human review with no primary FAIL                                    | Treating P10B-18A evidence or registry/configuration counts alone as final quality acceptance                            |
| P10B-16P-05B — Major repository and historical-authority cleanup    | Remove or consolidate unconsumed acceptance scaffolding while preserving active generation, migration, durable quality and one lean P10B-18D live-AI seam.                                                                        | **Baseline**                               | P10B-16P-05A and accepted P10B-18C                              | Generation architecture and evidence                     | Complete consumer graph; production fail-closed proof; lean mock/live seam; active lifecycle, migration, quality and protected-state regressions                                                       | Storefront output, generation semantics, migration breakage or implementation of P10B-18D/P10B-19                        |
| P10B-18D — Live AI commercial storefront acceptance                 | Diagnose final integrated live-AI commercial quality through six freshly authorized calls and retained human evidence.                                                                                                            | **Baseline diagnostic / quality rejected** | P10B-16P-05B and accepted P10B-18C                              | Product owner, provider, generation, QA                  | Six-call bounded ledger; exact lineage; protected commerce/media; disclosed lifecycle limits; 3/6 prompt-fidelity passes and exact Concept 2/6 collapse                                                | Repair calls, generated-result patches, Vesko calls, publication or architecture implementation                          |
| P10B-19 PRE — Structural Design Intelligence Architecture Lock      | Lock the architecture and ownership boundaries for the planned structural design intelligence program.                                                                                                                            | **Baseline**                               | Completed P10B-18D diagnostic                                   | Product owner and architecture                           | Product-owner accepted architecture decision and locked P10B-19A-J sequence grounded in the rejected live-quality diagnostic                                                                           | Implementing P10B-19A-J during the lock                                                                                  |
| P10B-19A — Structural Storefront Family Contract                    | Implement the accepted family and PageBlueprint v2 contract boundary without beginning later packages.                                                                                                                            | **Partial**                                | Accepted P10B-19 PRE                                            | Planned task owner                                       | Versioned family and PageBlueprint v2 contracts, deterministic selection, topology identity, and v1 compatibility                                                                                      | Pulling later Visual Recipe, page-family, multi-concept, or critic work into P10B-19A                                    |
| P10B-19B-J — Remaining Structural Design Intelligence sequence      | Deliver the remaining nine planned packages in the accepted order after P10B-19A.                                                                                                                                                 | **Planned**                                | Accepted P10B-19 PRE and package dependencies                   | Planned task owners                                      | Package-specific contracts, implementation and acceptance                                                                                                                                              | Treating this roadmap synchronization as implementation                                                                  |

P10B-18D is complete only as a diagnostic baseline. P10B-19 PRE is Baseline, P10B-19A is Partial,
P10B-19A-01 through P10B-19A-07 are Baseline, and P10B-19A-08 - Compatibility, Deterministic
Selection and Normalized Topology Identity is the exact next implementation task. Concepts 3,
4 and 5 met prompt fidelity; Concepts 1, 2 and 6 did not. The exact Concept 2/6 snapshot and
topology collapse is the central input to P10B-19 PRE. P10B-18 and P10B remain Partial; P10B-19A
through P10B-19J remain Planned.

### 3.3 Slicing and concurrency

Use A/B/C slices only for necessary contract/anatomy, renderer/variant, or
PageBlueprint/generation/evidence separation. A parent is not complete until all required slices
and evidence pass. With P10B-01 through P10B-17, P10B-16P-01 through P10B-16P-05A, and P10B-16P-06
Baseline, their
disjoint authority ownership remains defined by the architecture lock. Shared schema exports,
registry indexes, migrations, manifests, direction/synthesis/dynamic-route authority, and renderer
boundaries require one integration owner and cannot be edited concurrently. Accepted P10B-18A
freezes the audit baseline; accepted P10B-18B-01 closes only the Design DNA/shared-frame package;
accepted P10B-18B-06 closes only bounded asset-composition authority; accepted P10B-18B-02 closes
only bounded homepage/editorial/campaign quality; accepted P10B-18B-03 closes only bounded
collection/search/product-card quality; accepted P10B-18B-04 closes only bounded PDP quality.
Accepted P10B-18B-05 closes only bounded content/support/utility quality and completes parent
P10B-18B. P10B-18C final quality/scale acceptance is next, followed by P10B-16P-05B historical
cleanup.

## 4. P10C — Storefront Studio Editing Experience v1

| Task                                               | Outcome                                                                                                                                            | Status      | Dependency                                             | Owner                                    | Required evidence                                                                       | Non-goal                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| P10C-01 — Brand asset library                      | Provide a merchant brand asset library.                                                                                                            | **Planned** | P10B asset authority                                   | Storefront Studio and media              | Contract; integration; browser/E2E                                                      | Product-media replacement                             |
| P10C-02 — Asset roles and provenance               | Expose asset roles, provenance, approval, and safe assignment.                                                                                     | **Planned** | P10C-01                                                | Storefront Studio and media              | Assignment validation; stale/role mismatch rejection; browser evidence                  | Untyped uploads or invented provenance                |
| P10C-03 — Canonical Puck boundary                  | Complete the canonical Puck adapter boundary for registered components and `StorefrontSnapshot`.                                                   | **Planned** | P10B component/profile authority                       | Storefront Studio                        | Adapter conformance; save/reload preservation                                           | Raw Puck persistence or second page graph             |
| P10C-04 — Stable frame identity and selection      | Give shared-frame sections stable identity, selection, and scoped editor behavior.                                                                 | **Planned** | P10C-03                                                | Storefront Studio                        | Frame/page scope integration; browser/E2E                                               | Duplicated frame state per page                       |
| P10C-05 — Approved manual frame operations         | Deliver approved bounded manual frame add, remove, reorder, field, asset, and presentation operations.                                             | **Planned** | P10C-02 through P10C-04                                | Storefront Studio                        | Positive and fail-closed integration; undo/redo; browser/E2E                            | Arbitrary components, CSS, code, or commerce mutation |
| P10C-06 — Scoped AI editing                        | Wire merchant-facing scoped AI editing, route feedback, and clarification to P10A authorities.                                                     | **Planned** | P10C-03 through P10C-05; P10A internal router/packages | Storefront Studio and design agent       | Selected/frame/page/storefront scope; ambiguity; proposal lifecycle browser evidence    | New router, skill package, or proposal model          |
| P10C-07 — Unified AI/manual history                | Unify AI and manual changes in canonical history and undo/redo.                                                                                    | **Planned** | P10C-05, P10C-06                                       | Storefront Studio and state              | Mixed-operation atomicity; save/reload; undo/redo evidence                              | Parallel editor history                               |
| P10C-08 — Brand and asset editor with Studio shell | Deliver the required brand and asset editor with Storefront Studio shell.                                                                          | **Planned** | P10C-01 through P10C-07                                | Storefront Studio                        | Loading/empty/error/stale/success/unsaved states; responsive accessibility; browser/E2E | Full CMS or developer-facing internals                |
| P10C-09 — Studio commercial QA                     | Pass Studio commercial QA through select frame, manual edit, bounded AI edit elsewhere, add/remove/reorder, undo/redo, save, preview, and publish. | **Planned** | P10C-08 and P10B-18                                    | Product owner, Storefront Studio, and QA | Complete browser/E2E chain and retained human review                                    | Reopening P10B generation-system scope                |

The minimum pilot editor requires P10C-01, P10C-03, P10C-04, P10C-05, the required subset of
P10C-08, and working save, preview, and publish actions.

Full P10C exit requires:

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

## 5. P10D — Advanced media and registered interactive presentation

| Task | Outcome                                                                                                                                | Status      | Dependency                                                               | Owner                   | Required evidence                                                              | Non-goal                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| P10D | Add governed generated imagery where justified, registered video, and registered GLTF/GLB/Three.js presentation with static fallbacks. | **Planned** | Relevant P10B component, asset, accessibility, and performance authority | Design system and media | Contract; provenance; browser/E2E; accessibility; performance; fallback review | AI-generated implementation code or pilot dependency |

## 6. P11 — Vesko Integration Readiness and Reference Adapter

| Task                                                                | Outcome                                                                                                                                                                       | Status       | Dependency                                       | Owner                               | Required evidence                                                   | Non-goal                                      |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| P11-00 — Vesko OpenAPI audit                                        | Audit the obtained Vesko OpenAPI contract and map its usable and missing surfaces.                                                                                            | **Baseline** | Obtained OpenAPI 3.0 document                    | Veskify architecture                | Contract audit and integration matrix                               | Claiming integration sufficiency              |
| P11-01 — Backend contract closure and ownership                     | Agree security, tenant context, typed responses, revisions, errors, navigation, missing Veskify APIs, and ownership with Vesko backend owners.                                | **Blocked**  | Vesko platform decisions                         | Veskify + Vesko platform            | Approved typed contracts and ownership record                       | Implementing against inferred response bodies |
| P11-02 — Identity and store-context adapter                         | Provide trusted tenant, store, user, permission, locale, subdomain, and custom-domain context.                                                                                | **Blocked**  | P11-01                                           | Veskify + Vesko platform            | Adapter conformance; auth/tenant integration; Vesko staging         | Browser-trusted store authority               |
| P11-03 — Catalogue and navigation projection                        | Map products, brands, categories/collections, product groups, merchandising order, and routes into one versioned read-only projection.                                        | **Blocked**  | P11-01, P11-02                                   | Veskify + Vesko commerce            | Contract and adapter conformance; Vesko staging                     | Catalogue or navigation writes from Veskify   |
| P11-04 — Variant, option, price, availability and media conformance | Prove simple and configurable variants/options/price/availability/media conformance without apparel-specific frontend assumptions.                                            | **Blocked**  | P11-03                                           | Veskify + Vesko commerce            | Simple/complex product fixtures; adapter integration; Vesko staging | Competing commerce model or sellability logic |
| P11-05 — Approved presentation-asset service                        | Give approved logo, campaign, and editorial assets typed identity, role, revision, approval, derivatives, and retention separate from product media.                          | **Blocked**  | P11-01, P11-02 and media ownership decision      | Veskify + Vesko media               | Contract; provenance; permissions; staging lifecycle                | Overwriting canonical product media           |
| P11-06 — Storefront draft and history persistence                   | Persist authenticated tenant-scoped revisioned `StorefrontSnapshot` drafts, immutable history, and restore-to-draft.                                                          | **Blocked**  | P11-01, P11-02 and persistence/revision contract | Veskify + Vesko platform            | Adapter conformance; concurrency; save/reload/restore in staging    | Raw `/puck` persistence                       |
| P11-07 — Accepted receipt and publication adapter                   | Persist accepted authority, compiled artifacts, publication history, and active version through an authenticated idempotent transaction.                                      | **Blocked**  | P10A publication closure; P11-01, P11-02, P11-06 | Veskify + Vesko platform            | Receipt/gateway/compiler/artifact conformance; staging publication  | Browser publication or commerce writes        |
| P11-08 — Synchronization, revisions, errors and caching             | Expose commerce/media revision and synchronization authority, typed stale/conflict errors, retry policy, and bounded caching.                                                 | **Blocked**  | P11-03 through P11-07                            | Veskify + Vesko platform            | Conflict, stale, retry, cache, recovery integration; staging        | Silent last-write-wins behavior               |
| P11-09 — Vesko staging conformance                                  | Prove Vesko identity/catalogue → Veskify projection → generate → edit → save → publish → render → change Vesko commerce → refresh without presentation corruption in staging. | **Blocked**  | P11-02 through P11-08 and minimum P10C editor    | Veskify + Vesko platform + QA       | Vesko staging; browser/E2E; correlated retained evidence            | Production claim                              |
| P11-10 — Pilot readiness                                            | Prove one real pilot has onboarding, diagnostics, audit records, observability, recovery guidance, and documented limitations.                                                | **Blocked**  | P11-09                                           | Product owner + Veskify/Vesko leads | Signed pilot evidence and readiness record                          | Uncontrolled production rollout               |

## 7. P12 — Production hardening and pilot operations

| Task | Outcome                                                                                                                                                         | Status      | Dependency | Owner                               | Required evidence                                                                               | Non-goal                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| P12  | Close authentication, tenancy isolation, security, observability, performance, backup/recovery, deployment, incident response, and controlled pilot operations. | **Blocked** | P11-10     | Veskify + Vesko platform/operations | Security and load evidence; recovery exercise; production monitoring; controlled pilot evidence | New design-system, editor, or commerce scope |

### P10B-18B-05 accepted Baseline (20 August 2026)

The accepted package completes focused content/support and utility implementation,
truthful profile reclassification, transient runtime-state proof and a 30-capture EN/FI visual
matrix. The product owner accepted the mandatory checkpoint on 20 August 2026. P10B-18B-05 and the
completed P10B-18B parent are Baseline; P10B-18 and P10B remain Partial. P10B-18C is the exact next
task after this package merges.

### P10B-18C accepted Baseline (22 August 2026)

The accepted gate compiles and deterministically replays all 126 exact cases, retains protected
commerce/media and zero placeholders/fabrication, reports 54 normalized material topologies and a
truthful largest compatibility cluster of 14, and selects 28 deterministic stores for a final
280-entry four-width EN/FI review. The final review is **PASS WITH MINOR LIMITATION** with zero
primary FAIL. P10B-16P-05B subsequently completed the consumer-proven historical-authority cleanup
and is Baseline. P10B-18D completed as a rejected-quality diagnostic. P10B-19 PRE is Baseline, and
P10B-19A-01 through P10B-19A-07 are Baseline, P10B-19A is Partial, and P10B-19A-08 - Compatibility,
Deterministic Selection and Normalized Topology Identity is the exact next implementation task.

## Accepted P10B-19 sequence

P10B-19 PRE is Baseline. P10B-19A-01 through P10B-19A-07 are Baseline, P10B-19A is Partial, and
P10B-19A-08 - Compatibility, Deterministic Selection and Normalized Topology Identity is the exact
next implementation task.
P10B-19B through P10B-19J remain Planned. The accepted sequence is additive and preserves current
snapshot, commerce, media, component, proposal, editor, and publication authority.

The implementation program is deliberately granular: 73 bounded children cover contracts, one
meaningful visual family on one page family at a time, responsive evidence, deterministic AI
reachability, and focused product-owner screenshot checkpoints. Real-provider and final complete
store acceptance remain in P10B-19J rather than being repeated in ordinary visual-family tasks.

P10B remains Partial until the implementation and acceptance sequence completes.

## DEVX-01E browser timing authority

- DEVX-01A = Baseline
- DEVX-01B = Baseline
- DEVX-01C = Baseline
- DEVX-01D = Baseline
- DEVX-01E = Baseline
- DEVX-01F = Baseline
- DEVX-01F2 = Baseline
- DEVX-01G = Baseline
- DEVX-01 = Baseline / closed
- P10B-19A-01 = Baseline
- P10B-19A-02 = Baseline
- P10B-19A-03 = Baseline
- P10B-19A-04 = Baseline
- P10B-19A-05 = Baseline
- P10B-19A-06 = Baseline
- P10B-19A-07 = Baseline
- P10B-19A = Partial
- P10B-19A-08 = exact next implementation task

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
`pnpm exec playwright merge-reports`. DEVX-01F2 locks the smallest conservative Vitest plan under
the 35-minute projection: three isolated rows, each retaining one worker, serial file execution,
zero retry, exact runtime discovery, unique blobs and fail-closed merged-result reconciliation.
DEVX-01G closes the sprint through two comparable clean runs without changing that architecture.
Run A reduced developer wait time from 2h6m13s to 34m27s (72.706%) while summed job time increased
by 3m33s; no lower compute-cost claim is made. Final Run B remains merge-gated.
