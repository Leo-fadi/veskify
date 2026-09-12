# Veskify Development Roadmap

## AR-00 replacement-roadmap projection (effective on adoption/merge)

This is the delivery-order projection of the incorporated AR-00 SDD addendum. It is not a second
status tracker and the supplied 31-task decomposition is advisory planning rather than a permanent
numeric lock. Every task's detailed outcome, changes, acceptance, non-goals, and rollback gate is
recorded in the complete task specifications below; [AR-00 source disposition](./AR_00_SOURCE_DISPOSITION_AND_ACCEPTANCE.md)
records source/evidence and old-work disposition. This repository projection takes effect upon
explicit owner acceptance/merge of AR-02K and does not assert the PR's lifecycle or owner acceptance.
AR-00 is Baseline / closed. AR-01 is Baseline / closed. AR-02A is Baseline / closed. AR-02B is Baseline / closed. AR-02C is Baseline / closed. AR-02D is Baseline / closed. AR-02E is Baseline / closed. AR-02F is Baseline / closed. AR-02G is Baseline / closed. AR-02H is Baseline / closed. AR-02I is Baseline / closed. AR-02J is Baseline / closed. AR-02K is Baseline / closed upon explicit owner acceptance/merge. AR-02 is Partial; the semantic-capability-features.ts metadata dependency remains mapped in AR_02_BOUNDARY_ACCEPTANCE.md. AR-03 is Baseline / closed; original same-input characterization and separate ownership are verified. AR-03A is Baseline / closed. AR-03B is Baseline / closed. AR-03C is Baseline / closed. AR-03D is Baseline / closed. AR-03E is Baseline / closed. AR-23 is eligible after AR-01 and is not serialized behind visual work. AR-23 remains unstarted. BATCH-03 is complete. BATCH-04 is complete. BATCH-05 is complete. BATCH-06 is complete. BATCH-07 is complete. BATCH-08 is complete upon AR-02K acceptance/merge and safe closeout. No next reset task is selected. No third task is authorized.

Retained B01 exact-next, fixed-two-call/mandatory-three-concept, transient-only, and 73-child
future-sequence statements are **historical pre-AR future policy** superseded by the incorporated
addendum. Accepted history, functional requirements, and current capability truth remain binding.

| Package | Task  | Outcome                                                 | Dependencies                      |
| ------- | ----- | ------------------------------------------------------- | --------------------------------- |
| P0      | AR-00 | Adopt reset without rewriting accepted history          | —                                 |
| P0      | AR-01 | Inventory local dependencies and working path           | AR-00                             |
| P1      | AR-02 | Separate capability metadata from renderer/diagnostics  | AR-01                             |
| P1      | AR-03 | Extract dynamic-route authority without semantic change | AR-01                             |
| P1      | AR-04 | Isolate legacy and acceptance compositions              | AR-02, AR-03                      |
| P2      | AR-05 | Version executable composition in canonical state       | AR-02, AR-03                      |
| P2      | AR-06 | Render and round-trip one composed template             | AR-05                             |
| P2      | AR-07 | Compile template scope and final canonical assembly     | AR-04, AR-06                      |
| P2      | AR-08 | Close foundational refactor with executable proof       | AR-07                             |
| P3      | AR-09 | Compile independent visual identity into Design DNA v2  | AR-08                             |
| P3      | AR-10 | Build product-first frame and homepage                  | AR-09                             |
| P3      | AR-11 | Build product-first PDP and generic options             | AR-10                             |
| P3      | AR-12 | Build product-first collection and search               | AR-10                             |
| P3      | AR-13 | Complete and activate first family                      | AR-11, AR-12                      |
| P4      | AR-14 | Build editorial-offset frame and homepage               | AR-13                             |
| P4      | AR-15 | Complete editorial-offset commerce/support family       | AR-14                             |
| P5      | AR-16 | Add generation stages and resumable contracts           | AR-07                             |
| P5      | AR-17 | Add durable execution, fencing, recovery                | AR-16, AR-23                      |
| P6      | AR-18 | Connect creative brief and template provider stages     | AR-09, AR-16                      |
| P6      | AR-19 | Wire normal Studio generation and progress              | AR-13, AR-16, AR-18               |
| P6      | AR-20 | Unify scoped editing and merchant protection            | AR-19, AR-15                      |
| P7      | AR-21 | Add machine capture and bounded critique                | AR-15, AR-19                      |
| P7      | AR-22 | Accept engine and optional concept comparison           | AR-15, AR-20, AR-21               |
| P8      | AR-23 | Resolve host/data contract                              | AR-01                             |
| P8      | AR-24 | Add live route resolution and scoped freshness          | AR-07, AR-23                      |
| P8      | AR-25 | Connect trusted storage, publication, public rendering  | AR-17, AR-19, AR-24               |
| P8      | AR-26 | Deliver localized runtime SEO/content fields            | AR-25                             |
| P8      | AR-27 | Connect real commerce actions                           | AR-25                             |
| P9      | AR-28 | Accept integrated pilot, recovery, isolation            | AR-17, AR-20, AR-22, AR-26, AR-27 |
| P9      | AR-29 | Retire obsolete active generation/transports            | AR-04, AR-20, AR-22               |
| P9      | AR-30 | Prune proof infrastructure and close reset              | AR-28, AR-29                      |

The two initial enabled families are product-first commerce and editorial-offset. Campaign-modular,
technical-comparison, warm-narrative, and restrained-gallery remain explicit deferred family
coverage. Specialized campaign, technical-comparison, warm, gallery, deep-variant, and numerical
topology outcomes from the prior plan remain retained/deferred backlog unless a later scoped task
supplies its exact acceptance. AR-13/AR-15 prove only the two initial families; they do not claim
six-family completion. AR-16/AR-18/AR-19/AR-22 replace fixed two-call and mandatory three-concept
future policy with staged budgets, default one concept, and optional materially distinct comparison.
AR-21 is bounded critique; preference learning remains deferred pending consent and retention policy.

**Version:** 1.3.0

**Baseline:** 4 September 2026, P10B-19A-10C P10B-19A Closure and Product-Owner Architecture Gate

**Active development phase:** P10B — Commercial Storefront Generation System v1 (**Partial**)

**Authoritative specification:** [`VESKIFY_SDD.md`](VESKIFY_SDD.md)

**Execution status:** [`VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md`](VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md)

This roadmap contains only approved delivery order, tasks, ownership, dependencies, evidence, and
non-goals. Capability truth and architecture live in the SDD. Checkbox progress and detailed exit
criteria live in the delivery tracker.

**Engineering enablement:** DEVX-01A through DEVX-01G are Baseline, and DEVX-01 is Baseline /
closed. P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are Baseline;
parent P10B-19A-08 is Baseline / closed. P10B-19A-09A, P10B-19A-09B and P10B-19A-09C are
Baseline; parent P10B-19A-09 is Baseline / closed. P10B-19A-10A, P10B-19A-10B1,
P10B-19A-10B2 and P10B-19A-10C are Baseline; parents P10B-19A-10B, P10B-19A-10 and P10B-19A
are Baseline / closed. P10B-19 and P10B remain Partial; P10B-19B-01 is Planned / exact next and
has not begun.

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
final before-merge gate under the same frozen architecture. P10B-19A-01 through P10B-19A-07 and
P10B-19A-08A through P10B-19A-08C are Baseline; parent P10B-19A-08 is Baseline / closed.
P10B-19A-09A, P10B-19A-09B and P10B-19A-09C are Baseline; parent P10B-19A-09 is Baseline /
closed. P10B-19A-10A, P10B-19A-10B1, P10B-19A-10B2 and P10B-19A-10C are Baseline; parents
P10B-19A-10B, P10B-19A-10 and P10B-19A are Baseline / closed. P10B-19 and P10B remain Partial;
P10B-19B-01 is Planned / exact next and has not begun.

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
|    8A | P10B-19A-08A - Normalized Topology Identity                                           |
|    8B | P10B-19A-08B - Candidate Compatibility Contract and Evaluation                        |
|    8C | P10B-19A-08C - Deterministic Candidate Selection                                      |
|     9 | P10B-19A-09 - v1 read/render/migration/publication compatibility                      |
|    9A | P10B-19A-09A - Legacy v1 Replay Alias and Compatibility Reference                     |
|    9B | P10B-19A-09B - Historical v1 Snapshot Read and Render Replay                          |
|    9C | P10B-19A-09C - Publication Replay and A-09 Closure                                    |
|    10 | P10B-19A-10 - Retained matrices, integration and P10B-19A closure                     |
|   10A | P10B-19A-10A - Retained Matrix Inventory and Frozen Baseline Lock                     |
|   10B | P10B-19A-10B - Cross-Authority Integration and Failure Matrix                         |
|  10B1 | P10B-19A-10B1 - Positive Cross-Authority Integration Matrix                           |
|  10B2 | P10B-19A-10B2 - Fail-Closed Cross-Authority Failure Matrix and A-10B Closure          |
|   10C | P10B-19A-10C - P10B-19A Closure and Product-Owner Architecture Gate                   |

P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are **Baseline**; parent
P10B-19A-08 is **Baseline / closed**. P10B-19A-09A, P10B-19A-09B and P10B-19A-09C are
**Baseline**; parent P10B-19A-09 is **Baseline / closed**. P10B-19A-10A, P10B-19A-10B1,
P10B-19A-10B2 and P10B-19A-10C are **Baseline**; parents P10B-19A-10B, P10B-19A-10 and
P10B-19A are **Baseline / closed**. P10B-19 and P10B remain **Partial**; P10B-19B-01 is
**Planned / exact next** and has not begun.

P10B-19A-08A establishes strict normalized PageBlueprint v2 and Structural Storefront Family
topology projections at schema version `1.0.0`. Deterministic `r0`, `r1`, ... region tokens follow
the A-03 default reading order. Page topology retains A-03 structural relationships and A-05
responsive rules while excluding A-04 asset-role and A-06 fallback authority; its fingerprints
use `page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>`. Family topology covers
all six canonical A-02 page-family roles plus A-02 relationships; its fingerprints use
`structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>`. The pure,
non-persisted inactive index groups duplicate PageBlueprint and family topology identities but does not reject,
evaluate compatibility, select, activate or create runtime reachability. Production PageBlueprint
v2, Structural Storefront Family and normalized-topology index record counts remain exactly zero.

P10B-19A-08B establishes schema-version `1.0.0` compatibility authority without selection. The
transient context uses the ordered catalogue-cardinality, fact-depth, product-complexity,
navigation-depth and canonical `en`/`fi` locale dimensions, with exact candidate-scoped capacity
for every required A-04 region/role through maximum 32. Exact A-07 family profiles explicitly
partition all five vocabularies; the production catalogue remains empty. Memoized A-06 DAG
evaluation retains every compatible target in declared order, classifies PageBlueprint candidates
as directly-compatible, substitution-compatible, omission-compatible or incompatible, and
classifies families as directly-compatible, conditionally-compatible or incompatible. A-08A
topology fingerprints remain provenance only. Stale-checked context, profile and evaluation
fingerprints add no score, rank, winner, selected receipt, activation, persistence or runtime
wiring. Production candidates, profiles, contexts, evaluations, active/selectable/selected records
and current-generation consumers remain zero.

P10B-19A-08C establishes strict schema-version `1.0.0` deterministic selection requests and
immutable receipts over exact A-07/A-08A/A-08B authority. Scoring-free family and PageBlueprint
precedence uses case-bound canonical-fingerprint tie-breaks; selection covers all six page families,
follows A-06 recursive substitution priority and retains safe omission declarations without
executing them. Complete-store combinations share one global 4,096 evaluation bound and yield an
identity-free complete topology, while receipt parsing replays selection to reject stale or
contradictory authority.
Production registry, profile, request, receipt and current-generation runtime counts remain zero;
visual behavior, runtime wiring, providers, persistence and publication are unchanged. Parent
P10B-19A-08 is Baseline / closed.

P10B-19A-09A establishes opaque legacy-v1 replay identity for exactly the ordered aliases
`legacy-v1:premium-editorial`, `legacy-v1:modern-technical` and
`legacy-v1:minimal-commerce`, mapped one-to-one to the existing coordinated directions. Each
immutable alias binds current direction authority version `1.1.0` and the exact package
fingerprint. A strict replay reference retains the complete v1 selection narrowing, reuses the
current narrowing validator and exact executable projection, and excludes incidental `selectionId`
from replay fingerprint identity. It performs no snapshot, appearance, profile or topology
inference and creates no v2 identity. A-09B still owns historical snapshot read/render replay;
A-09C owns publication replay and parent A-09 closure. No read/render/publication compatibility,
generation change or merchant-visible outcome is claimed by A-09A.

P10B-19A-09B establishes a strict read-only historical-v1 adapter over current canonical snapshot,
registered component, PageBlueprint-profile, shared-frame, navigation, dynamic-commerce and
catalogue validation. A supplied A-09A replay reference must bind exactly; without one, the read is
`readable-unattributed` and no lineage is inferred. Its deterministic immutable receipt reports
seven present persisted selection fields as verified and seven absent fields as unverified,
records normalization disposition `none` or `canonical-read-defaults`, and uses
`legacy-v1-historical-snapshot-read-v1_<canonical-length>_<sha256>`. Frozen exact-base evidence
matches all 36 of 36 bounded current-renderer observations for three representatives across EN/FI
with zero snapshot mutation, repository write, commerce change, media change, or
route/profile/frame mismatch. It does not prove raw HTML equality, original lineage, migration,
publication replay, v2 authority, or merchant-visible change.

P10B-19A-09C establishes bounded historical-v1 publication replay by binding the exact A-09B
result and receipt to the current canonical publication compiler. It uses truthful `manual` source
authority and a detached transient historical-draft projection, requires current migration status
without write-back, and returns a strict immutable replay receipt. Frozen exact-base evidence
matches three direct compilations, three preparations and exactly three isolated atomic
publication confirmations, including active compiled-artifact and added-version integrity. All 36
of 36 published renderer observations and all 36 of 36 normalized Preview/published structural
observations match; source snapshots and aggregates remain unchanged, and provider, Vesko and
external-publication calls remain zero. No production/runtime consumer, v2 activation or
merchant-visible change is added. Parent P10B-19A-09 is Baseline / closed.

P10B-19A-10A records the delivery-only A-10A/A-10B/A-10C decomposition and freezes one checked,
fresh-clone-safe retained inventory. Its 24 explicit entries cover the accepted 126-case and
frozen-72 metrics, A-01 through A-09C focused authority, exact A-09 replay counts and current
DEVX-01 discovery. It binds 76 task-base production-source SHA-256 values and nine zero-count v2
inactivity assertions under one canonical fingerprint. It adds zero production or runtime change.
A-10B is delivered through two nested delivery-only children: A-10B1 owns the positive
cross-authority integration matrix, while A-10B2 owns fail-closed negative coverage and parent
A-10B closure. A-10B1 adds no production code. Its fixture contains eight PageBlueprint v2
candidates—six primary and two product-detail fallbacks—six Structural Storefront Family
candidates, six compatibility profiles, three capability contexts and three normalized
family-topology groups of two exact identities. It proves two-hop product-detail substitution,
optional content/support omission, six family-constrained receipts and three sequential pairwise
topology-distinct receipts. A-09 coexists unchanged; frozen A-10A remains byte-identical at 24
entries, 76 protected hashes and nine inactivity assertions, and accepted 126/72 and A-09 metrics
remain unchanged. No current-generation or client-runtime reachability is introduced.

A-10B2 adds the strict checked 36-case fail-closed matrix. Every ordered case begins from fresh
A-10B1 authority, applies one atomic corruption, terminates at its exact A-03 through A-09C owner,
completes no downstream phase, produces no partial result and preserves its source fingerprint.
Bounded errors retain only typed/native name and code or sorted Zod issue code/path authority.
Repair, fallback, default, repository-write, provider, Vesko and external-publication counts are
zero. Cases 17/18/20 alone permit native `Error` with null code, case 25 resolves to canonical
`stale-selection-authority`, case 28 is one coherent production-empty root replacement, and four
legacy/v2 substitutions fail without coercion. The canonical fingerprint is
`p10b-19a-fail-closed-cross-authority-matrix-v1_30308_ffae8e9700b84c08fcf1fe7315846077b01170f0be0d82743dce4e8a0ac8d307`;
the checked fixture SHA-256 is `8708a2282749796c9d27d2dcd382384989c7738a5eb0b2f72f87c1ad73cb6a64`.
A-10A and A-10B1 remain byte-identical, accepted 24/76/9 and 126/72/A-09 evidence remains
unchanged and every production-v2 authority count remains zero.

A-10A, A-10B1 and A-10B2 are Baseline; parent A-10B is Baseline / closed. At that checkpoint,
A-10 and P10B-19A remained Partial, A-10C was exact next, and P10B-19B-01 remained Planned after
A-10C.

P10B-19A-10C closes only the accepted structural architecture and adds no production code or
merchant-visible output. Its accepted candidate fingerprint is
`p10b-19a-structural-architecture-closure-candidate-v1_11823_e1482cb9f76b470302823bc25f767243cf108776cfe318dd9194821e0ce55e8e`;
the exact product-owner decision `ACCEPT P10B-19A STRUCTURAL ARCHITECTURE CLOSURE` has fingerprint
`p10b-19a-product-owner-architecture-decision-v1_653_1e2f42c02bcac0e507b032eb81885aa3797d734ba94371f3f97047d22523e88b`;
and the final closure fingerprint is
`p10b-19a-structural-architecture-closure-v1_12651_76316ec1e4c4edc48b02942ec27624b6a05926b91cf11dbcf08a64c65d18e728`.
The checked fixture SHA-256 is
`757c0febf40da2e893f99795dc12bbf1e5bf933fe55b326cab512f80f35d67b1`, its canonical-material
SHA-256 is `76316ec1e4c4edc48b02942ec27624b6a05926b91cf11dbcf08a64c65d18e728`, and the read-only
external corroborating baseline SHA-256 is
`529da1152e5d088a9ff3bff075829d8f22f5b4bed95446eac119f9d79e338122`. Its exact sorted unique
26-file retained plan preserves the accepted 126/72 and A-09 authority and remains discoverable
exactly once by current CI, with zero production, current-generation or client-runtime reach. The
exact ordered limitations remain `no-active-v2-family`, `no-v2-rendered-storefront`,
`no-visual-recipe`,
`no-design-dna-v2`, `no-v2-frame-family`, `no-v2-page-family-realization`,
`no-ai-design-director`, `no-screenshot-critic`, `no-live-ai-quality-evidence`, and
`no-v2-commercial-quality-claim`. P10B-19A-10C is Baseline; parent P10B-19A-10 and P10B-19A are
Baseline / closed. P10B-19 and P10B remain Partial. P10B-19B-01 is Planned / exact next and has not
begun.

The A-08A/A-08B/A-08C, A-09A/A-09B/A-09C and A-10A/A-10B/A-10C rows, including
A-10B1/A-10B2 beneath A-10B, are nested delivery-only decompositions of their accepted parent
tasks. They do not renumber or expand the accepted 73-child architecture.

P10B-19A-07 adds strict, deeply readonly PageBlueprint v2 and Structural
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

The ten parent children preserve the accepted P10B-19 PRE architecture and are independently
mergeable only in dependency order. A-08, A-09 and A-10 have bounded A/B/C delivery subchildren
without changing those parent outcomes. The product owner explicitly approved this DEVX-01A
delivery sequence to supersede the earlier six-child P10B-19A partition; it does not change accepted
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
rejected**. P10B-19 PRE is **Baseline**; P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through
P10B-19A-08C are **Baseline**; parent P10B-19A-08 is **Baseline / closed**. P10B-19A-09A,
P10B-19A-09B and P10B-19A-09C are **Baseline**; parent P10B-19A-09 is **Baseline / closed**.
P10B-19A-10A, P10B-19A-10B1, P10B-19A-10B2 and P10B-19A-10C are **Baseline**; parents
P10B-19A-10B, P10B-19A-10 and P10B-19A are **Baseline / closed**. P10B-19 and P10B remain
**Partial**; P10B-19B-01 is **Planned / exact next** and has not begun; P10B-19B through
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
completed rejected-quality diagnostic. P10B-19 PRE is Baseline. P10B-19A-01 through P10B-19A-07
and P10B-19A-08A through P10B-19A-08C are Baseline; parent P10B-19A-08 is Baseline / closed.
P10B-19A-09A, P10B-19A-09B and P10B-19A-09C are Baseline; parent P10B-19A-09 is Baseline /
closed. P10B-19A-10A, P10B-19A-10B1, P10B-19A-10B2 and P10B-19A-10C are Baseline; parents
P10B-19A-10B, P10B-19A-10 and P10B-19A are Baseline / closed. P10B-19 and P10B remain Partial;
P10B-19B-01 is Planned / exact next and has not begun.

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

| Wave                           | Planned work                                                                                                                                                            | Gate                                                                                                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Grammar                    | P10B-01 (**Baseline**)                                                                                                                                                  | Existing authorities have executable vocabulary; no visual implementation claim.                                                                                                                                                                                     |
| 2 — Parallel foundations       | P10B-02, P10B-03, P10B-05 (**Baseline**)                                                                                                                                | Disjoint ownership of BrandSystem, component anatomy, and page-set/PageBlueprint authority.                                                                                                                                                                          |
| 3 — Art direction and families | P10B-04, P10B-06, P10B-07, P10B-08 (**Baseline**)                                                                                                                       | Real registered frame/content/merchandising authority reaches renderers.                                                                                                                                                                                             |
| 4 — Page profiles              | P10B-09 through P10B-13 (**Baseline**)                                                                                                                                  | Complete home, commerce, content/support, and utility page coverage.                                                                                                                                                                                                 |
| 5 — Early complete store       | P10B-14 (**Baseline**)                                                                                                                                                  | One credible Premium Editorial multi-page storefront passes retained human review.                                                                                                                                                                                   |
| 6 — Synthesis and diversity    | P10B-15, P10B-16 (**Baseline**)                                                                                                                                         | Bounded synthesis, three coordinated direction packages and deterministic duplicate/near-duplicate control are live.                                                                                                                                                 |
| 6P — Generation convergence    | P10B-16P-01 through P10B-16P-05A plus P10B-16P-06 (**Baseline**)                                                                                                        | Route instances no longer own design; strict intent, canonical compilation, mocked Studio generation, real V2 A/B/C normal-Studio acceptance, one active semantic path/compiler/materializer chain, and transient canonical search query/results authority are live. |
| 7 — Deterministic closure      | P10B-17, P10B-18A, completed P10B-18B and P10B-18C (**Baseline**); parent P10B-18/P10B (**Partial**)                                                                    | Responsive/a11y/performance, all six source-authority packages, and deterministic 126-case/280-capture quality acceptance are closed.                                                                                                                                |
| 8 — Historical cleanup         | P10B-16P-05B (**Baseline**)                                                                                                                                             | Consumer-proven cleanup removes one-time acceptance infrastructure while retaining migration, durable quality and the lean P10B-18D seam.                                                                                                                            |
| 9 — Live and intelligence      | P10B-18D (**Baseline diagnostic / quality rejected**), P10B-19 PRE (**Baseline**), P10B-19A (**Baseline / closed**), P10B-19 (**Partial**) and P10B-19B-J (**Planned**) | The accepted live diagnostic exposes exact cross-prompt authority collapse; the lock precedes the ten parent packages P10B-19A through P10B-19J, while A-08, A-09 and A-10 use bounded delivery subchildren.                                                         |

### 3.2 Locked tasks

| Task                                                                         | Outcome                                                                                                                                                                                                                           | Status                                     | Dependency                                                      | Owner                                                    | Required evidence                                                                                                                                                                                      | Non-goal                                                                                                                 |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| P10B-01 — Commercial design grammar and compatibility vocabulary             | Make structural, visual, responsive, narrative, and compatibility vocabulary executable through existing authority.                                                                                                               | **Baseline**                               | P10A closure; architecture lock; historical audit/specification | Canonical design contracts                               | Schema/queryability, inheritance/compatibility, migration and typed rejection                                                                                                                          | New token/registry/page/recipe/direction authority                                                                       |
| P10B-02 — Parametric BrandSystem / Design DNA                                | Make merchant-wide typography, palette, rhythm, layout, surfaces, controls, shape/elevation, density, and media posture bounded and coherent.                                                                                     | **Baseline**                               | P10B-01                                                         | BrandSystem                                              | Migration, non-colour cross-page projection, save/publish preservation, responsive evidence                                                                                                            | Per-section themes or raw CSS                                                                                            |
| P10B-03 — Component anatomy and meaningful variant contract                  | Register anatomy, structural variants, parameters, assets, responsive transformations, and compatibility for every commercial family.                                                                                             | **Baseline**                               | P10B-01                                                         | Component platform                                       | 29 definitions/126 variants classified; schema/queryability, meaningful structural difference, migration and fail-closed validation                                                                    | CSS-class aliases presented as variants                                                                                  |
| P10B-04 — Responsive image and art-direction authority                       | Add approved focal point, safe area, crop, ratio, overlay, derivative, and responsive treatment authority.                                                                                                                        | **Baseline**                               | P10B-02, P10B-03                                                | Asset presentation and media                             | 35-case authority suite, asset/media integration, lifecycle regression, semantic renderer and four-width browser evidence                                                                              | Mutating canonical product media; production CDN transforms                                                              |
| P10B-05 — Veskify site-map and page-family authority                         | Create and validate complete page sets, navigation, routes, and registered page families through PageBlueprint/StorefrontSnapshot.                                                                                                | **Baseline**                               | P10B-01                                                         | PageBlueprint and storefront domain                      | Route/navigation/page-set validation, canonical generation, save/publish preservation                                                                                                                  | Second page graph or unrestricted CMS                                                                                    |
| P10B-06 — Commercial shared-frame families                                   | Deliver at least four frames, three mobile navigation modes, and four footer compositions.                                                                                                                                        | **Baseline**                               | P10B-02, P10B-03, P10B-05; P10B-04 where applicable             | Shared frame                                             | Four profiles, three mobile modes, four footers, lifecycle, EN/FI/four-width keyboard/focus, and retained visual evidence                                                                              | Merchant editor controls or new navigation truth                                                                         |
| P10B-07 — Hero, editorial, campaign and proof families                       | Deliver at least six hero compositions plus reusable story, campaign, service, and evidence-backed proof families.                                                                                                                | **Baseline**                               | P10B-02 through P10B-05                                         | Commercial content families                              | Six distinct hero anatomies; story/campaign/proof capability chain; grounded omission; four-width browser evidence                                                                                     | Invented claims or generic filler                                                                                        |
| P10B-08 — Canonical product-card and merchandising family                    | Establish one protected card authority with at least five meaningful anatomies.                                                                                                                                                   | **Baseline**                               | P10B-02 through P10B-04                                         | Commerce presentation                                    | One renderer, cross-context fact/media parity, lifecycle/publish authority and four-width browser evidence                                                                                             | Duplicate card authority or commerce ownership                                                                           |
| P10B-09 — Commercial homepage profile library                                | Deliver at least six materially different homepage profiles and narrative flows.                                                                                                                                                  | **Baseline**                               | P10B-05 through P10B-08                                         | PageBlueprint profiles                                   | Six fingerprinted profiles; exact frame/story/card composition; evidence/cardinality guards; lifecycle and 24-view browser evidence                                                                    | Colour-only profiles or unregistered sections                                                                            |
| P10B-10 — Commercial collection and search profiles                          | Deliver four editorial, comparison, campaign, and dense/search profiles.                                                                                                                                                          | **Baseline**                               | P10B-04 through P10B-06, P10B-08                                | PageBlueprint and dynamic collection                     | Exact commerce/intents/cards/zero-results, lifecycle, 16 responsive views and retained report evidence                                                                                                 | Second collection engine, membership mutation, or operational search route                                               |
| P10B-11 — Commercial PDP profile library                                     | Deliver at least four standard, high-consideration, gallery-led, and variant-led experiences.                                                                                                                                     | **Baseline**                               | P10B-03 through P10B-06, P10B-08                                | PageBlueprint and dynamic PDP                            | Generic options/configurations, commerce/media parity, all-target render and retained review                                                                                                           | Product-type forks                                                                                                       |
| P10B-12 — Content and support page families                                  | Generate About, Contact/locations, FAQ, shipping/returns, policy, campaign/editorial, and generic content pages from approved facts.                                                                                              | **Baseline**                               | P10B-03 through P10B-07                                         | PageBlueprint and content families                       | 15 profiles; approved-fact provenance; locale/navigation; save/reload/compiler; 61 Chromium checks                                                                                                     | Fabricated policy/service/compliance claims                                                                              |
| P10B-13 — Commerce utility presentation pages                                | Deliver governed search/no-results, cart, checkout, empty, error, and 404 presentation.                                                                                                                                           | **Baseline**                               | P10B-03, P10B-05, P10B-06, P10B-08                              | Utility presentation                                     | Canonical facts/actions, state distinction, save/publish preservation, 16 responsive views and retained evidence                                                                                       | Cart/checkout/payment operations                                                                                         |
| P10B-14 — Premium Editorial complete-storefront vertical slice               | Prove one credible complete multi-page storefront before broad synthesis/direction expansion.                                                                                                                                     | **Baseline**                               | Minimum accepted P10B-02 through P10B-13 capability             | Storefront generation and QA                             | 17 routes; canonical generation/save/publish; 15 retained screenshots; passing 160-scenario human review                                                                                               | Hand-built or homepage-only proof                                                                                        |
| P10B-15 — Bounded storefront synthesis and narrative engine                  | Generate coherent complete stores from compatible Design DNA, page set, profiles, variants, parameters, assets, and narrative roles.                                                                                              | **Baseline**                               | P10B-14 and sufficient real family/profile authority            | Storefront generation                                    | Versioned deterministic authority; 25-case matrix; three complete 17-route outcomes; lifecycle publication; four-width browser and 480-scenario retained human review                                  | Arbitrary trees/styles, best-effort mutation, or P10B-16 diversity control                                               |
| P10B-16 — Coordinated directions and diversity control                       | Make the three directions constraint packages and add deterministic duplicate/near-duplicate prevention.                                                                                                                          | **Baseline**                               | P10B-15                                                         | Direction selection and evaluation                       | Three versioned packages; nine complete outcomes; structural fingerprint/classification; repetition control; 31 focused cases; four-width browser and retained human review                            | Fixed templates, aesthetic AI scoring, 100+ scale gate or colour-only diversity                                          |
| P10B-16P-01 — Dynamic commerce route archetype authority                     | Separate static design pages, maintained collection/search and PDP archetypes, and concrete runtime route inventory in one snapshot.                                                                                              | **Baseline**                               | P10B-16 and P10B-05/P10B-10/P10B-11 authority                   | Storefront domain and runtime routes                     | Versioned/fingerprinted authority; deterministic mapping/migration; Studio projection; lifecycle/compiler/publication; exact route and browser evidence                                                | One design page per product/collection, provider-plan changes, or individual route overrides                             |
| P10B-16P-02 — Prompted design-plan contract                                  | Establish strict transient provider design intent, then compile it deterministically through current authority.                                                                                                                   | **Baseline**                               | P10B-16P-01                                                     | Provider and design-plan authority                       | Strict contract/mock evidence; bounded metadata solver; exact authority compilation; canonical one-shot synthesis/proposal and no-partial lifecycle evidence                                           | Provider-owned page graph, commerce, code, or final Studio journey                                                       |
| P10B-16P-02A — Prompted Storefront Design Intent V2                          | Project current capability safely and accept one strict non-executable preference-rich provider intent without pre-provider materialization.                                                                                      | **Baseline**                               | P10B-16P-01                                                     | Provider contract and adapter                            | Strict schema/reference/fingerprint/failure tests, mocked OpenAI transport, dependency boundary                                                                                                        | Deterministic intent compilation, proposal/snapshot creation, live provider acceptance                                   |
| P10B-16P-02B — Deterministic design-intent compiler                          | Compile refreshed V2 preferences into exact registered compatible selections and the existing canonical synthesis/proposal path.                                                                                                  | **Baseline**                               | P10B-16P-02A                                                    | Design-plan compiler                                     | Deterministic bounded metadata resolution; exact PageBlueprint/dynamic/component selection; diagnostics/fingerprints; stale/incompatible/no-partial rejection; lifecycle preservation                  | Provider-owned materialization, Studio UX, search execution or live acceptance                                           |
| P10B-16P-03 — Storefront Studio generation journey                           | Complete the normal prompt-to-review storefront generation journey through existing proposal and snapshot authority.                                                                                                              | **Baseline**                               | P10B-16P-02B                                                    | Storefront Studio and generation                         | Standalone/mock server authority; integrated auth fail-closed; one registered structural operation; exact P02B source-proposal fingerprint/lineage; retained evidence; lifecycle and browser/E2E proof | Live provider evidence, new snapshot authority, bypassed review, or P10C general editing                                 |
| P10B-16P-04 — Live V2 acceptance and bridge disposition                      | Prove the prompt-driven V2 path with separately authorized real-provider evidence and decide the P10B-16L compatibility bridge disposition.                                                                                       | **Baseline**                               | P10B-16P-03                                                     | Provider acceptance and architecture                     | Safe 16-call ledger; final A/B/C Studio proposals; C full lifecycle; zero retry/fallback/publish; protected commerce/media; retained human review; Deprecated P10B-16L                                 | Automatic calls, executable search, production claims, or preset selection as V2 evidence                                |
| P10B-16P-05A — Active production-path and compiler rationalisation           | Make one canonical semantic initial-generation composition and one coordinator/resolver/exact-decision/executor chain explicit; remove active P10B-16L and isolate P9 generation while retaining required compatibility/evidence. | **Baseline**                               | P10B-16P-04                                                     | Generation route, provider boundary and compiler         | Import/runtime architecture; deterministic A/B/C replay; one provider/one materialization; migration/publication/protected-state regressions                                                           | Search execution, visual redesign, final evidence cleanup, P10B-17, or P10B-18                                           |
| P10B-16P-06 — Canonical search query/results adapter                         | Execute the one persisted `/search` presentation through validated transient query/filter/sort/page state and exact current canonical product IDs.                                                                                | **Baseline**                               | P10B-16P-05A and P10B-16P-01/P10B-10/P10B-13 authority          | Search runtime and commerce presentation                 | Contract/schema; deterministic ranking/filter/pagination; integration; lifecycle/publication non-persistence; EN/FI browser evidence; protected commerce/media                                         | Vesko search integration, AI/semantic/fuzzy search, recommendations, analytics, or persisted query/results               |
| P10B-17 — Responsive, accessibility and performance closure                  | Preserve deliberate hierarchy and usability across 375/768/1024/1440, EN/FI, accessibility, and bounded budgets.                                                                                                                  | **Baseline**                               | P10B-16P-06 and implemented families/profiles/directions        | Design system and QA                                     | Registered transformations; four-width EN/FI geometry; keyboard/semantic/contrast; bounded performance/build budgets; browser and retained human visual evidence                                       | P10B-18B source improvement, P10B-18C quality/scale, Vesko staging, or production claims                                 |
| P10B-18 — Commercial quality and scale gate                                  | Prove repeated generation of publishable, premium, materially different complete storefronts.                                                                                                                                     | **Partial**                                | P10B-17 and all prior P10B tasks                                | Product owner, generation, QA                            | Accepted P10B-18A ceiling audit, P10B-18B source-authority improvement, then P10B-18C 100+ deterministic configurations and fingerprint-stratified retained human review                               | Closure from the accepted audit, one store, tests, screenshots, counts, or placeholders alone                            |
| P10B-18A — Commercial authority audit and quality-ceiling diagnosis          | Audit current source authority, reachability, compatibility, materializer/renderer consumption and commercial output before redesign.                                                                                             | **Baseline**                               | P10B-17 and current registered authority                        | Product owner, generation, QA                            | Accepted 72-case deterministic matrix; 18-store/108-capture retained human review; protected commerce/media; zero provider/Vesko/publication traffic; frozen six-package improvement plan              | Implementing source upgrades, claiming designer-grade quality, or satisfying the 100+ gate                               |
| P10B-18B — Commercial source-authority quality upgrade                       | Implement and evidence the accepted coherent improvements to existing Design DNA, compatibility, profiles, component consumers, assets and evaluation authority.                                                                  | **Baseline**                               | Accepted P10B-18A                                               | Generation/component/profile/evaluation owners           | Six accepted package-level positive/fail-closed matrices plus integrated browser and human review against the frozen P10B-18A baseline                                                                 | A second page graph/renderer/commerce model or an automatic quality claim                                                |
| P10B-18B-01 — Design DNA and shared-frames quality upgrade                   | Materialize bounded within-direction density, truthful semantic/frame-responsive causality, complete-store compact reachability, and intentional shared-frame composition.                                                        | **Baseline**                               | Accepted P10B-18A                                               | Design DNA, direction, frame and evaluation owners       | Same-72-case consumed-authority deltas; direct compatibility/render proof; 17-capture accepted review; P10B-17/build/lifecycle/protected-state preservation                                            | Later page-family, asset/art-direction or P10B-18C quality closure                                                       |
| P10B-18B-06 — Asset composition and art-direction quality upgrade            | Select approved presentation assets by exact placement purpose, bound reuse, pair approved responsive sources, and consume exact art direction in existing renderers and the shared frame.                                        | **Baseline**                               | Accepted P10B-18B-01                                            | Asset, responsive-image, frame and evaluation owners     | Accepted same-72-case regression; exact source/crop/reuse/provenance evidence; 13-capture checkpoint; lifecycle/build/protected-media preservation                                                     | Complete-storefront visual acceptance, page-family redesign, generated imagery, asset-library UI, or P10B-18C acceptance |
| P10B-18B-02 — Homepage / editorial / campaign quality upgrade                | Upgrade existing homepage profiles and hero/editorial/campaign consumers into intentional rich and sparse page progression with stronger hierarchy and merchandising rhythm.                                                      | **Baseline**                               | Accepted P10B-18B-01 and P10B-18B-06                            | Homepage profile, component and evaluation owners        | Accepted same-strata topology/concentration accounting; rich/sparse retained review; exact persistence; protected commerce/media and lifecycle preservation                                            | Collection/search/card, PDP, content/utility redesign, new page graph/renderer, or P10B-18C acceptance                   |
| P10B-18B-03 — Collection / search / product-card quality upgrade             | Strengthen collection and search composition, product-card hierarchy and merchandising density through the existing registered authorities.                                                                                       | **Baseline**                               | Accepted P10B-18B-02                                            | Collection/search, product-card and evaluation owners    | Accepted same-strata structural accounting; 21-capture retained review; protected commerce/media, canonical search and lifecycle preservation                                                          | PDP, content/utility redesign, new commerce model, or P10B-18C acceptance                                                |
| P10B-18B-04 — PDP quality upgrade                                            | Strengthen the existing PDP opening hierarchy, gallery, option/purchase composition and related merchandising without replacing canonical commerce or page authority.                                                             | **Baseline**                               | Accepted P10B-18B-03                                            | PDP profile, commerce presentation and evaluation owners | Accepted same-strata structural accounting; 20-capture four-width review; protected variants/options/media and lifecycle preservation                                                                  | Collection/search, content/utility redesign, commerce writes, or P10B-18C acceptance                                     |
| P10B-18B-05 — Content / support / utilities quality upgrade                  | Strengthen existing content, support and utility compositions without adding a second content, cart, error or page authority.                                                                                                     | **Baseline**                               | Accepted P10B-18B-04                                            | Content/support/utility and evaluation owners            | Profile-specific browser review, lifecycle preservation and protected commerce/navigation evidence                                                                                                     | PDP redesign, operational cart ownership, or P10B-18C acceptance                                                         |
| P10B-18C — 100+ commercial quality and diversity gate                        | Run final deterministic breadth/quality/diversity analysis and fingerprint-stratified retained human acceptance on the integrated P10B-18B authority.                                                                             | **Baseline**                               | Accepted and integrated P10B-18B packages                       | Product owner, generation, QA                            | 126 complete configurations and replays; protected-state/duplicate/causality gates; 28-store, 280-entry four-width EN/FI retained human review with no primary FAIL                                    | Treating P10B-18A evidence or registry/configuration counts alone as final quality acceptance                            |
| P10B-16P-05B — Major repository and historical-authority cleanup             | Remove or consolidate unconsumed acceptance scaffolding while preserving active generation, migration, durable quality and one lean P10B-18D live-AI seam.                                                                        | **Baseline**                               | P10B-16P-05A and accepted P10B-18C                              | Generation architecture and evidence                     | Complete consumer graph; production fail-closed proof; lean mock/live seam; active lifecycle, migration, quality and protected-state regressions                                                       | Storefront output, generation semantics, migration breakage or implementation of P10B-18D/P10B-19                        |
| P10B-18D — Live AI commercial storefront acceptance                          | Diagnose final integrated live-AI commercial quality through six freshly authorized calls and retained human evidence.                                                                                                            | **Baseline diagnostic / quality rejected** | P10B-16P-05B and accepted P10B-18C                              | Product owner, provider, generation, QA                  | Six-call bounded ledger; exact lineage; protected commerce/media; disclosed lifecycle limits; 3/6 prompt-fidelity passes and exact Concept 2/6 collapse                                                | Repair calls, generated-result patches, Vesko calls, publication or architecture implementation                          |
| P10B-19 PRE — Structural Design Intelligence Architecture Lock               | Lock the architecture and ownership boundaries for the planned structural design intelligence program.                                                                                                                            | **Baseline**                               | Completed P10B-18D diagnostic                                   | Product owner and architecture                           | Product-owner accepted architecture decision and locked P10B-19A-J sequence grounded in the rejected live-quality diagnostic                                                                           | Implementing P10B-19A-J during the lock                                                                                  |
| P10B-19A — Structural Storefront Family Contract                             | Implement the accepted family and PageBlueprint v2 contract boundary without beginning later packages.                                                                                                                            | **Baseline / closed**                      | Accepted P10B-19 PRE                                            | P10B-19A task owner                                      | Versioned family and PageBlueprint v2 contracts, deterministic selection, topology identity, v1 compatibility and accepted architecture closure                                                        | Pulling later Visual Recipe, page-family, multi-concept, or critic work into P10B-19A                                    |
| P10B-19A-10 — Retained integration and closure                               | Close retained P10B-19A evidence through three bounded delivery children.                                                                                                                                                         | **Baseline / closed**                      | P10B-19A-09 closed                                              | P10B-19A task owner                                      | Frozen inventory, cross-authority failure matrix, retained execution and accepted product-owner architecture gate                                                                                      | Collapsing inventory, integration and closure into one review                                                            |
| P10B-19A-10A — Retained Matrix Inventory and Frozen Baseline Lock            | Freeze exact retained tests, commands, metrics, production hashes, inactivity and CI discovery without production change.                                                                                                         | **Baseline**                               | P10B-19A-09C merged                                             | P10B-19A task owner                                      | 24-entry checked inventory; 126/72 and A-09 metrics; 76 source hashes; nine zeroes; CI discovery                                                                                                       | Cross-authority scenarios or P10B-19A closure                                                                            |
| P10B-19A-10B — Cross-Authority Integration and Failure Matrix                | Deliver bounded positive and fail-closed cross-authority evidence through two dependency-ordered children.                                                                                                                        | **Baseline / closed**                      | P10B-19A-10A merged                                             | P10B-19A task owner                                      | A-10B1 positive and A-10B2 exact 36-case fail-closed baselines complete; zero production                                                                                                               | Closure report or later P10B-19 work                                                                                     |
| P10B-19A-10B1 — Positive Cross-Authority Integration Matrix                  | Prove positive A-03 through A-08C composition beside unchanged A-09 and frozen A-10A authority.                                                                                                                                   | **Baseline**                               | P10B-19A-10A merged                                             | P10B-19A task owner                                      | 8 PageBlueprint candidates; 6 family candidates; 6 profiles; 3 contexts; 3 topology groups × 2 identities; 6 direct and 3 sequential receipts; A-09/A-10A unchanged; zero production                   | Negative failure matrix, parent closure or production activation                                                         |
| P10B-19A-10B2 — Fail-Closed Cross-Authority Failure Matrix and A-10B Closure | Prove deliberate cross-authority failures close safely and close parent A-10B.                                                                                                                                                    | **Baseline**                               | P10B-19A-10B1 merged                                            | P10B-19A task owner                                      | 36 exact ordered failures; owner/phase isolation; no partial output or source mutation; four strict legacy/v2 rejections; A-10A/B1 unchanged; zero production                                          | A-10C closure or later P10B-19 work                                                                                      |
| P10B-19A-10C — P10B-19A Closure and Product-Owner Architecture Gate          | Run complete retained evidence, issue the closure report and obtain the product-owner architecture gate.                                                                                                                          | **Baseline**                               | P10B-19A-10B2 merged                                            | P10B-19A task owner                                      | Accepted candidate and product-owner decision; fresh-clone-safe closure manifest; retained execution; zero production                                                                                  | Beginning P10B-19B before closure                                                                                        |
| P10B-19B-01 — First Visual Recipe child                                      | Begin the next accepted package only after A-10C.                                                                                                                                                                                 | **Planned / exact next**                   | P10B-19A-10C merged                                             | Planned task owner                                       | Package-specific immutable contract and evidence; work has not begun                                                                                                                                   | Starting automatically from A-10A                                                                                        |
| P10B-19B-J — Remaining Structural Design Intelligence sequence               | Deliver the remaining nine planned packages in the accepted order after P10B-19A.                                                                                                                                                 | **Planned**                                | Accepted P10B-19 PRE, P10B-19A-10C and package dependencies     | Planned task owners                                      | Package-specific contracts, implementation and acceptance                                                                                                                                              | Treating this roadmap synchronization as implementation                                                                  |

P10B-18D is complete only as a diagnostic baseline. P10B-19 PRE is Baseline. P10B-19A-01 through
P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are Baseline; parent P10B-19A-08 is Baseline /
closed. P10B-19A-09A, P10B-19A-09B and P10B-19A-09C are Baseline; parent P10B-19A-09 is
Baseline / closed. P10B-19A-10A, P10B-19A-10B1 and P10B-19A-10B2 are Baseline; parent
P10B-19A-10B is Baseline / closed. P10B-19A-10C is Baseline; parent P10B-19A-10 and P10B-19A are
Baseline / closed. P10B-19 and P10B remain Partial; P10B-19B-01 is Planned / exact next and has
not begun.
Concepts 3,
4 and 5 met prompt fidelity; Concepts 1, 2 and 6 did not. The exact Concept 2/6 snapshot and
topology collapse is the central input to P10B-19 PRE. P10B-18, P10B-19 and P10B remain Partial;
P10B-19A is Baseline / closed, and P10B-19B through P10B-19J remain Planned.

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
and is Baseline. P10B-18D completed as a rejected-quality diagnostic. P10B-19 PRE is Baseline.
P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are Baseline; parent
P10B-19A-08 is Baseline / closed. P10B-19A-09A, P10B-19A-09B and P10B-19A-09C are Baseline;
parent P10B-19A-09 is Baseline / closed. P10B-19A-10A, P10B-19A-10B1, P10B-19A-10B2 and
P10B-19A-10C are Baseline; parents P10B-19A-10B, P10B-19A-10 and P10B-19A are Baseline / closed.
P10B-19 and P10B remain Partial; P10B-19B-01 is Planned / exact next and has not begun.

## Accepted P10B-19 sequence

P10B-19 PRE is Baseline. P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C
are Baseline; parent P10B-19A-08 is Baseline / closed. P10B-19A-09A, P10B-19A-09B,
P10B-19A-09C, P10B-19A-10A, P10B-19A-10B1, P10B-19A-10B2 and P10B-19A-10C are Baseline; parents
P10B-19A-09, P10B-19A-10B, P10B-19A-10 and P10B-19A are Baseline / closed. P10B-19 and P10B
remain Partial; P10B-19B-01 is Planned / exact next and has not begun. The accepted sequence is
additive and preserves current snapshot, commerce, media, component, proposal, editor, and
publication authority.

The accepted architecture remains the 73-child granular plan. The A-10A/A-10B/A-10C rows,
including A-10B1/A-10B2 beneath A-10B, are nested delivery micro-PRs within accepted parent A-10
and do not renumber or expand that architecture count. The program covers contracts, one meaningful visual family on one page family
at a time, responsive evidence, deterministic AI reachability, and focused product-owner screenshot
checkpoints. Real-provider and final complete-store acceptance remain in P10B-19J rather than being
repeated in ordinary visual-family tasks.

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
- P10B-19A-08A = Baseline
- P10B-19A-08B = Baseline
- P10B-19A-08C = Baseline
- P10B-19A-08 = Baseline / closed
- P10B-19A-09A = Baseline
- P10B-19A-09B = Baseline
- P10B-19A-09C = Baseline
- P10B-19A-09 = Baseline / closed
- P10B-19A-10A = Baseline
- P10B-19A-10B1 = Baseline
- P10B-19A-10B = Baseline / closed
- P10B-19A-10 = Baseline / closed
- P10B-19A-10B2 = Baseline
- P10B-19A-10C = Baseline
- P10B-19B-01 = Planned / exact next; not begun
- P10B-19A = Baseline / closed
- P10B-19 = Partial
- P10B = Partial

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

## AR-00 complete supplied task specifications

This table is the committed detailed replacement-roadmap record. The tracker alone owns status; rows below preserve supplied outcome, changes, acceptance, non-goals, and rollback detail.

### AR-00 — Adopt the reset without rewriting history

**Package:** P0 — Authority and baseline. **Dependencies:** —. **Planned detail:** Baseline / closed in the repository state effective upon explicit owner adoption/merge; no product implementation is implied.

**Outcome:** One approved replacement direction and one exact-next authority; the old 73-child future sequence no longer blocks authorized corrections.

**Changes:**

- Add an incorporated AR architecture addendum, decision crosswalk and evidence boundary. Preserve permanent ADR ownership rules.
- Preserve completed A-10C as Baseline and A-10/P10B-19A as Baseline / closed. Supersede only the stale future delivery sequence while retaining accepted A-01–A-10B2 records and historical parent limitations.
- Amend transient-only wording to allow access-controlled operational checkpoints outside StorefrontSnapshot; separate historical zero/hash assertions from future production activation rules.
- Retain current review/merge safeguards. Permit coherent larger tasks only through bounded, explicitly approved contract exceptions; use short task-specific deltas.
- Synchronize current status docs and supported deterministic exports. This new task is not performed under A-10C’s incompatible zero-lock-change contract.

**Acceptance:**

- Repository documentation validation and exports pass when executed; no production source change, provider call or false acceptance claim.
- Old-to-new requirement/task mapping is present. AR-01 is the sole next reset task.

**Non-goals:**

- No implementation, baseline regeneration, broad CI redesign, automatic merge or retroactive human approval.

**Rollback / failure behavior:**

- Revert the unmerged/adopted documentation delta as one unit; retained historical evidence is untouched.

### AR-01 — Complete local dependency inventory and characterize the working path

**Package:** P0 — Authority and baseline. **Dependencies:** AR-00. **Status projection:** Baseline / closed only upon explicit AR-01 acceptance/merge; the tracker controls current status.

**Outcome:** Every path proposed for change/removal has real caller, route and compatibility evidence.

**Changes:**

- Enumerate TS imports/re-exports, Next route roots, dynamic imports, registry string references and supported persisted versions; include tests, public media and external publication dependencies.
- Classify active generation, scoped editing, legacy read/replay, test-only and unresolved paths. No absence of access is treated as no persisted data.
- Run focused current generation/lifecycle/route/conformance reports. Reconcile 16/25/1 prose versus 16/29/7 test-source expectations using executed evidence.
- Record behavioural characterization for known-type/complexity selection, one-composite editing, expand/fold translation, accepted proposal and publication. Map frozen source guards to invariant owners.
- Report changed-file and dependency-frontier estimates for subsequent tasks; identify safe ownership lanes.

**Acceptance:**

- T01 and characterization subset execute with exact results or explicit blockers; no invented test totals.
- All 36 disposition rows resolved to exact files/exports or explicitly unavailable external dependencies; confirmed orphan removal list distinct from conditional retirement.
- Normal-route and public-preview evidence classified correctly; no claims of product-quality validation from this audit.

**Non-goals:**

- No destructive code removal, new provider call or source-wide cosmetic reorganization.

**Rollback / failure behavior:**

- Audit changes are additive; failure leaves all product code intact.

### AR-02 — Separate pure capability metadata from rendering and diagnostics

**Package:** P1 — Dependency boundaries. **Dependencies:** AR-01. **Status projection:** Partial;
the remaining semantic-capability-features.ts metadata edge is mapped in AR_02_BOUNDARY_ACCEPTANCE.md; tracker status controls.

The approved [AR-02A child](governance/task-contracts/AR/AR-02A.json) separates live renderer
observation and report composition with unchanged observed behavior. It is a preparatory slice;
the parent acceptance below still requires remaining metadata-consumer isolation. See its
[implementation report](AR_02A_IMPLEMENTATION_REPORT.md) and the [BATCH-01 queue](BATCH_01_EXECUTION.md).

[AR-02I](AR_02I_IMPLEMENTATION_REPORT.md) isolates the existing planner/recipe/provider roots. The
[parent evidence map](AR_02_BOUNDARY_ACCEPTANCE.md) identifies out-of-scope metadata consumers that
remain after I. [AR-02J](AR_02J_IMPLEMENTATION_REPORT.md) isolates actual provider descriptions and
schema consumption. [AR-02K](AR_02K_IMPLEMENTATION_REPORT.md) isolates the actual governed-package
and grammar consumers while preserving the real default inventory facade. Complete original
parent acceptance remains incomplete: semantic-capability-features.ts still reads profile metadata
through the renderer-bearing template barrel. AR-04/AR-05 remain dependency-blocked and unstarted;
AR-06 depends on AR-05. AR-03 stays closed.

**Outcome:** Template planning can use truthful component capabilities without importing editor/runtime/audit implementations.

**Changes:**

- Derive pure metadata and renderer-binding entrypoints from the same definition source.
- Preserve v2-registry’s required adapted legacy definitions; retain registry identities and current behaviour.
- Move client-reachable callers to narrow imports in bounded groups. Keep existing type-only deterministic-selector exports type-only.
- Add dependency boundary tests for compiler/provider/browser entrypoints and report bundle impact at the authorized build gate.

**Acceptance:**

- T01,T02,T21: registry definition identity and rendered observations remain equivalent; no duplicate capability inventory.
- New compiler metadata imports have no React/Puck/Next renderer closure; runtime/client reachability checked by actual graph/build, not only string matching.

**Non-goals:**

- No semantic generation changes, component redesign or all-directory rename.

**Rollback / failure behavior:**

- Restore previous imports/exports; no persisted data changed.

### AR-03 — Extract dynamic-route authority without changing semantics

**Package:** P1 — Dependency boundaries. **Dependencies:** AR-01. **Status projection:** Baseline / closed
after accepted PR250; see the [parent evidence map](AR_03_BOUNDARY_ACCEPTANCE.md). The accepted
[AR-03A child](governance/task-contracts/AR/AR-03A.json) extracted route matching and errors without
changing semantics. [AR-03B](AR_03B_IMPLEMENTATION_REPORT.md) separates presentation construction,
exact historical compatibility and shared migration/style support. [AR-03C](AR_03C_IMPLEMENTATION_REPORT.md)
separates current validation and route projection/resolution, with four preview clients using the
narrow entrypoint. [AR-03D](AR_03D_IMPLEMENTATION_REPORT.md) separates selection and editor operations
and redirects their three named consumers. [AR-03E](AR_03E_IMPLEMENTATION_REPORT.md) separates legacy
migration and transient expansion/reconciliation, preserving the later fold. Its approved schema
amendment moves only existing bridge schemas into one metadata owner with unchanged compatibility
exports. This sequence does not change the parent dependency on AR-01; tracker status controls.

**Outcome:** Migration, validation, selection, runtime resolution and editor projection have clear separate owners.

**Changes:**

- Extract functions behind compatible exports into adjacent modules selected from the local dependency graph.
- Retain exact v1 route inventory, type/complexity selection, one-composite restriction and migration error behaviour during this task.
- Keep extraction out of component registry and snapshot schema changes; prepare later versioned policy work.

**Acceptance:**

- T01,T06,T07 characterization is unchanged for the same inputs; existing callers compile.
- No altered current-source hash is hidden: approved guard mapping records mechanical changes.

**Non-goals:**

- No new route policy, schema version, precedence change, fallback expansion or cleanup of unrelated functions.

**Rollback / failure behavior:**

- Revert extraction/facades; persisted bytes remain unchanged.

### AR-04 — Isolate legacy and acceptance compositions from normal roots

**Package:** P1 — Dependency boundaries. **Dependencies:** AR-02, AR-03. **Planned detail:** future work; tracker status controls.

**Outcome:** There is one explicit normal design entrypoint and clearly separated legacy/test composition.

**Changes:**

- Use AR-01 reachability to separate production dependencies from P03/P04/P9 acceptance adapters.
- Keep active retained follow-up operations reachable until AR-20 replaces their required scopes.
- Constrain any legacy facade to its declared operations and versions; do not create an automatic v2-to-v1 fallback.
- Delete only already-proven orphan glue. Preserve compatible readers, media and fixtures.

**Acceptance:**

- T01,T16,T21: normal route still works under its configured test authority; production-disabled seams remain inaccessible in production.
- Existing legacy registry/profile and published-artifact references still resolve.

**Non-goals:**

- No global deletion of legacy folders, no removal of working generation before replacement, no weakened integrated auth.

**Rollback / failure behavior:**

- Restore explicit composition wiring; unchanged canonical data and current generation remain usable.

### AR-05 — Define versioned executable composition inside canonical state

**Package:** P2 — Template execution core. **Dependencies:** AR-02, AR-03. **Planned detail:** future work; tracker status controls.

**Outcome:** One authoritative v2 composition can be represented without duplicating content, ordering or the page graph.

**Changes:**

- Lock compiled PageBlueprint composition over canonical section/anatomy identities and registered relationship/order/responsive choices.
- Specify v2 section storage order versus sole layout order; preserve v1 flat/composite semantics.
- Add explicit snapshot extension/dynamic-authority version dispatch compatible with the currently unversioned root. Do not silently infer v2 from shape.
- Reject missing refs, unsupported relation realizations, invalid reading order and unsafe omissions. Add migration/read/unsupported-version tests.

**Acceptance:**

- T01,T02: supported old payloads parse identically; new authority rejects contradictions and cannot become a parallel tree.
- Exact owner, version and fingerprint strategy is documented and ready for AR-06’s named renderer consumer.

**Non-goals:**

- No active family registration, full token redesign, arbitrary CSS or generic DOM model.

**Rollback / failure behavior:**

- Keep v2 write path disabled; v1 reader remains available. Never write new payloads then revert to a reader that cannot understand them.

### AR-06 — Render and round-trip one composed template end to end

**Package:** P2 — Template execution core. **Dependencies:** AR-05. **Planned detail:** future work; tracker status controls.

**Outcome:** PageBlueprint regions become visible, editable and persistable—not metadata-only architecture.

**Changes:**

- Implement the shared registered composition renderer for the minimal supported relation set needed by the first families; unimplemented relations fail, never silently degrade.
- Retain generic product option state and registered commerce sub-anatomy; do not create competing variant resolvers.
- Project composition losslessly to/from Puck and preserve it in save/history/publish compilation.
- Use one approved/neutral representative template to prove offset/stack behaviour, mobile reading order and round trip.

**Acceptance:**

- T01–T04,T17: render, allowed edit, save/reload and compiled publication preserve the same composition.
- Focused four-width captures show actual structure; tests prove unsupported choices fail before acceptance.
- Independent verifier checks cross-layer round trip. Split into named subordinate PRs before lock if the existing hard budget is exceeded.

**Non-goals:**

- No full family library, new AI provider, real Vesko publishing or all-page redesign.

**Rollback / failure behavior:**

- Disable v2 entry for new writes; preserve compatible reader for already-created test artifacts. Revert only after confirming no accepted new payload depends on it.

### AR-07 — Implement template-scoped compilation and final canonical assembly

**Package:** P2 — Template execution core. **Dependencies:** AR-04, AR-06. **Planned detail:** future work; tracker status controls.

**Outcome:** Individual templates compile through one authority and form one complete isolated proposal without route-sized design expansion.

**Changes:**

- Add template command/result artifact with explicit base identity, global-contract ref, read/write set, dependencies, exact decisions and diagnostics.
- Reuse existing PageBlueprint, component, asset and protected-commerce validation; extract shared materialization instead of implementing a second engine.
- For the new path, compile archetypes directly rather than reconcile/expand/fold every resource into temporary pages.
- Assemble staged template artifacts into StorefrontSnapshot and existing proposal lifecycle; introduce truthful versioned provenance instead of pretending to be an old skill.

**Acceptance:**

- T01,T02,T05,T08,T09: repeated pure compilation stable; wrong scope and stale dependencies rejected; template count does not grow with product count.
- New complete proposal accepts/undoes atomically in focused integration tests; protected commerce has no write path.
- Legacy generation still uses its documented contract until cutover.

**Non-goals:**

- No durable worker, new catalog model, new publisher or all-stage visual quality claim.

**Rollback / failure behavior:**

- Keep legacy ingress active; disable new compilation contract for new requests while retaining any written version readers.

### AR-08 — Close the foundational refactor with executable proof

**Package:** P2 — Template execution core. **Dependencies:** AR-07. **Planned detail:** future work; tracker status controls.

**Outcome:** A finite reset milestone ends; visual product development resumes on a usable core.

**Changes:**

- Verify AR-00–07 outcomes together through the normal facade/test injection rather than a separate demo generator.
- Execute scoped migration, template-count, Puck, renderer and publication checks; map each superseded source/zero guard.
- Review one composed template at all required widths; report remaining host and quality gates explicitly.

**Acceptance:**

- Foundational completion criteria in architecture section 18 met; T01–T05,T08,T09,T21 relevant cases executed.
- No new active path relies on unimplemented semantic capability or hidden legacy fallback.
- No claim that all families, all legacy debt or production integration is complete.

**Non-goals:**

- No new feature framework or another open-ended abstraction phase.

**Rollback / failure behavior:**

- Keep new generation disabled if the gate fails; repair only identified regressions, preserve legacy baseline.

### AR-09 — Compile independent visual identity into Design DNA v2

**Package:** P3 — First complete family. **Dependencies:** AR-08. **Planned detail:** future work; tracker status controls.

**Outcome:** Light/dark foundation and independent typography/surface/control choices visibly affect canonical output.

**Changes:**

- Add exact v1/v2 DNA union and a deterministic compiler from bounded visual preferences.
- Intersect actual family/capability limits, approved palette/font choices and accessibility rules.
- Consume supported foundation, hierarchy and surface/control axes through shared rendering now, not later.
- Declare unsupported recipe dimensions rather than add placeholder motion/media flags.

**Acceptance:**

- T01,T03,T14: old DNA unchanged; true dark foundation with readable statuses/focus/logo treatment; counterfactual independent axes demonstrated.
- Failed accessible palette or unsupported critical identity produces typed failure without candidate mutation.

**Non-goals:**

- No arbitrary fonts/CSS, separate persisted recipe, advanced motion or six visual systems at once.

**Rollback / failure behavior:**

- Retain v1 reader; new DNA writing gated. Preserve reader for any accepted v2 artifact.

### AR-10 — Build product-first frame and homepage

**Package:** P3 — First complete family. **Dependencies:** AR-09. **Planned detail:** future work; tracker status controls.

**Outcome:** A real product-first home presents approved merchandise and useful navigation with little dependence on editorial assets.

**Changes:**

- Register candidate v2 frame/home structure using existing safe components and canonical bindings.
- Prove sparse/standard/rich catalogue adaptations and multiple visual identities from AR-09.
- Keep semantic priority on product discovery; do not create a merchant-specific component.

**Acceptance:**

- T03,T14,T23: actual hierarchy, mobile navigation and sparse asset handling pass focused review.
- Family remains unactivated until complete-role gate AR-13.

**Non-goals:**

- No claim of complete-family availability or new commerce service.

**Rollback / failure behavior:**

- Disable candidate registration; existing default path unaffected.

### AR-11 — Build product-first PDP with complete generic options

**Package:** P3 — First complete family. **Dependencies:** AR-10. **Planned detail:** future work; tracker status controls.

**Outcome:** Simple, configurable and unknown product types work under one safe product-first presentation.

**Changes:**

- Compose gallery/purchase/specifications through supported regions while reusing option/variant logic.
- Retain every available option group and truthful selected-variant price/availability.
- Test unavailable media, long names, many options and missing optional facts.

**Acceptance:**

- T03,T07,T15,T23: no dropped options or wrong product bindings; four-width purchase hierarchy and keyboard use verified.
- Observed variant changes come from canonical commerce, not generated copy.

**Non-goals:**

- No cart/checkout backend, inferred availability or product-specific persisted page.

**Rollback / failure behavior:**

- Disable new PDP candidate; generic legacy fallback stays available within its original contract.

### AR-12 — Build product-first collection and search

**Package:** P3 — First complete family. **Dependencies:** AR-10. **Planned detail:** future work; tracker status controls.

**Outcome:** Browsing and query results share coherent cards and controls but retain distinct purposes.

**Changes:**

- Reuse canonical product cards, current search port and runtime-only query/result state.
- Implement density/cardinality/facet layout within new composition.
- Keep search no-results recovery and sparse collections truthful.

**Acceptance:**

- T03,T05,T15,T23: cards/filters operate at representative sizes and locales; no search state saved in snapshot.
- Product-first hierarchy remains coherent with home and PDP.

**Non-goals:**

- No new search engine, fabricated facets or a per-collection design generation loop.

**Rollback / failure behavior:**

- Disable candidates; retained search semantics and data port remain unchanged.

### AR-13 — Complete and activate the first full family

**Package:** P3 — First complete family. **Dependencies:** AR-11, AR-12. **Planned detail:** future work; tracker status controls.

**Outcome:** Product-first becomes one honest complete-store family rather than a homepage demonstration.

**Changes:**

- Compose relevant approved factual pages and state-specific utility presentation; reuse existing variants where fit.
- Cover all six page-family roles with references to actual implementations and capability/evidence requirements.
- Run complete canonical proposal/save/reload/preview/publication projection under deterministic ports.
- Activate only this proven family in the intended capability context.

**Acceptance:**

- T01,T03,T04,T15,T16,T23: complete-store structure, localization, evidence and utility correctness proven.
- Activation does not imply live model quality or Vesko staging acceptance.

**Non-goals:**

- No six-family activation, invented policies or expanded checkout logic.

**Rollback / failure behavior:**

- Deactivate new-family selection for future runs while preserving published/saved reader support.

### AR-14 — Build editorial-offset frame and homepage

**Package:** P4 — Structural contrast. **Dependencies:** AR-13. **Planned detail:** future work; tracker status controls.

**Outcome:** A second structure is visibly asymmetric and editorial, not the first theme with different colour.

**Changes:**

- Implement real offset relationships and accessible responsive order.
- Bind approved editorial assets and missing-evidence policy; retain identity-independent visual recipes.
- Show monochrome structure and real-asset versions against product-first.

**Acceptance:**

- T03,T14,T23: structural differences remain visible without colour/copy; mobile hierarchy is deliberate.
- Dark/light style choices do not redefine family identity.

**Non-goals:**

- No forced editorial family on asset-poor merchants or automatic second concept for every request.

**Rollback / failure behavior:**

- Disable candidate structure; first complete family remains usable.

### AR-15 — Complete the editorial-offset commerce and support family

**Package:** P4 — Structural contrast. **Dependencies:** AR-14. **Planned detail:** future work; tracker status controls.

**Outcome:** A second commercially distinct complete family shares the same engine and truthful commerce.

**Changes:**

- Add gallery/editorial PDP and discovery alternatives using the existing generic commerce internals.
- Use coherent support/utility inheritance without decorative misuse; cover all six roles.
- Apply full meaningfulness gate across home plus at least two of collection/search/PDP.
- Plan subordinate PDP/discovery/activation PRs before locking if the local diff exceeds scope bounds.

**Acceptance:**

- T03,T07,T14,T15,T23: two complete families have distinct actual topology and usable commerce; same renderer across lifecycle.
- Compatibility failures disclose unmet facts/assets and cannot manufacture evidence.

**Non-goals:**

- No provider-specific family IDs, separate renderer or mandatory third design.

**Rollback / failure behavior:**

- Disable only second-family new selection; retained first-family and historical data remain supported.

### AR-16 — Introduce generation stages and resumable execution contracts

**Package:** P5 — Operational execution. **Dependencies:** AR-07. **Planned detail:** future work; tracker status controls.

**Outcome:** One orchestrator owns bounded stage execution, isolated artifacts and global design dependencies.

**Changes:**

- Define GenerationRun, StageAttempt, immutable artifact refs, read/write dependencies, status and budget accounting without a second accepted draft.
- Implement orchestration against a deterministic reference repository and provider doubles.
- Authorize resource ownership before job admission; require scope and idempotency payload equality.
- Drive the same template compiler from synchronous/reference and worker entrypoints.

**Acceptance:**

- T08–T13 deterministic state-machine cases: duplicate requests, stale stage, cancellation, budget reservation and stage reuse.
- Reference/in-memory results are not described as process-restart or distributed durability proof.

**Non-goals:**

- No new workflow-platform dependency, host-database assumption or automatic model retry.

**Rollback / failure behavior:**

- Disable new run entrypoint; pure template compiler remains usable for deterministic validation.

### AR-17 — Implement durable execution with fencing and recovery

**Package:** P5 — Operational execution. **Dependencies:** AR-16, AR-23. **Planned detail:** future work; tracker status controls.

**Outcome:** Restarts and duplicate workers cannot lose completed design work or corrupt final application.

**Changes:**

- Use the actual host-approved transaction/CAS mechanism for durable run and artifact storage.
- Implement lease/fencing token, idempotent committed stage result, cancellation fencing and bounded request admission.
- Reserve attempts before remote calls; persist uncertain outcomes and prevent hidden rebilling/retry loops.
- Test process restart, lease expiry, duplicate delivery, delayed completion and retention/deletion access policy.

**Acceptance:**

- T10,T11,T12,T13,T24 execute against a real durable adapter; no exactly-once provider billing claim.
- Missing host transaction authority blocks this task, not AR-09–15 visual work or deterministic AR-16 tests.

**Non-goals:**

- No assumed Redis/Kafka/Temporal, cross-tenant artifacts or background activity outside declared budget.

**Rollback / failure behavior:**

- Disable worker admission, let authorized in-flight operations drain/cancel safely, retain artifacts and compatible readers.

### AR-18 — Connect expressive creative-brief and template provider stages

**Package:** P6 — Merchant design workflow. **Dependencies:** AR-09, AR-16. **Planned detail:** future work; tracker status controls.

**Outcome:** The model authors supported global and per-template preferences instead of selecting a completed package.

**Changes:**

- Add non-executable creative brief and template-stage schemas grounded in actual advertised capabilities.
- Use hard constraints, ordered merchant priorities and transparent substitutions; stable ties are final, not design quality.
- Declare per-run calls/tokens/attempts/corrections; reuse provider config and explicit secret boundaries.
- Default to one concept; add no mandatory three-result response and no prebuilt full snapshots in provider input.

**Acceptance:**

- T11,T14,T23 with provider doubles; requests expose compact capabilities, not exact execution authority or executable code.
- Unknown capability, refusal, malformed output and unsupported critical intent have typed outcomes with no draft change.
- Live calls remain separately authorized evidence, not used to debug an unverified harness.

**Non-goals:**

- No model-selection claims, arbitrary component IDs, provider-owned permissions or hidden retry.

**Rollback / failure behavior:**

- Disable new provider contract; saved artifacts remain readable and deterministic tests use the same interfaces.

### AR-19 — Wire the normal Studio generation lifecycle and progress

**Package:** P6 — Merchant design workflow. **Dependencies:** AR-13, AR-16, AR-18. **Planned detail:** future work; tracker status controls.

**Outcome:** Generate store works as one action with template progress, isolated review and exact existing lifecycle.

**Changes:**

- Route normal requests into the orchestrator and existing proposal transport; expose safe status/results.
- Preserve explicit Accept/Reject/Undo/Redo/Save/Preview/Publish boundaries; no provider calls on inspection or acceptance.
- Keep incomplete template previews isolated from active draft; preserve completed siblings on stage failure.
- Allow deterministic/reference operation before host activation; integrated mode still requires actual trusted authority.

**Acceptance:**

- T09,T12,T16: open=zero calls; reject/regenerate no reset; accept atomic; undo/redo/save/reload exact.
- AR-17/25 remain required for durable integrated production, even when local Studio journey passes.

**Non-goals:**

- No complete P10C editor redesign, browser-authoritative integrated save or privileged test identity.

**Rollback / failure behavior:**

- Disable new generation entry contract; retain accepted-version readers and previous working editor behaviour.

### AR-20 — Unify scoped editing and protect merchant changes

**Package:** P6 — Merchant design workflow. **Dependencies:** AR-19, AR-15. **Planned detail:** future work; tracker status controls.

**Outcome:** Page/template/section edits reuse the same compiler without overwriting unrelated merchant work.

**Changes:**

- Wire actual existing scope router and permission semantics into normal editing.
- Distinguish static page, reusable template, section and global-system edits; show impact before acceptance.
- Implement merchant locks and dependency invalidation; global token changes trigger affected checks.
- Port every retained scope needed by the pilot before retiring its legacy transport.

**Acceptance:**

- T04,T08,T09,T16: PDP edit leaves home unchanged; global edits disclose impact; conflicts fail without silent rebase.
- Round trip preserves v2 composition and legacy edits remain supported within documented boundaries.

**Non-goals:**

- No automatic conflict rebasing or commerce/content ownership escalation.

**Rollback / failure behavior:**

- Disable new scope paths; do not remove old follow-up until equivalent acceptance is proven.

### AR-21 — Add normal-path machine capture and bounded critique

**Package:** P7 — Quality proof. **Dependencies:** AR-15, AR-19. **Planned detail:** future work; tracker status controls.

**Outcome:** Basic visual defects are caught before human review without creating a separate screenshot application.

**Changes:**

- Capture identified surfaces/widths after asset/font settlement with safe immutable artifact references.
- Run geometry, accessibility, image, lifecycle and cross-page checks before optional critic inference.
- Compile any authorized critic correction as one immutable bounded successor; recompute impacted dependencies.
- Persist safe verdict/preference evidence outside StorefrontSnapshot; capture failure is not misreported as model-design failure.

**Acceptance:**

- T03,T14,T20: unsupported critic commands rejected, correction/capture budget enforced, affected surfaces rechecked.
- No output is automatically published and no hidden repair loops occur.

**Non-goals:**

- No learned preference model, unrestricted visual agent or product-owner-run capture manufacture.

**Rollback / failure behavior:**

- Disable critic calls/corrections; deterministic machine checks and manual quality review remain.

### AR-22 — Accept the engine and optional concept comparison

**Package:** P7 — Quality proof. **Dependencies:** AR-15, AR-20, AR-21. **Planned detail:** future work; tracker status controls.

**Outcome:** Two complete families produce prompt-faithful editable stores through the ordinary product path.

**Changes:**

- Run zero-call harness preflight, then explicit bounded live calls for the diagnostic intent set within supported capabilities.
- Prove independent foundation/structure/typography controls and complete-store coherence in EN/FI and four widths.
- Support explicit one/two/three-concept requests only to the available capacity; report shortfall without padding or silent constraint relaxation.
- Retain at least one human-approved publishable-without-structural-rebuild outcome plus reasons for rejected outputs.

**Acceptance:**

- T14,T15,T16,T20,T22,T23 with actual provider/human evidence; unsupported requests truthful.
- Engine gate explicitly excludes unverified public-host, production durability and live Vesko integration.

**Non-goals:**

- No guaranteed third distinct family at initial two-family launch; no claim that all requests are supported.

**Rollback / failure behavior:**

- Keep new generation in limited acceptance mode when commercial gate fails; fix named expressive/renderer gaps, not enlarge prompts blindly.

### AR-23 — Resolve the Vesko monolith hosting and data contract

**Package:** P8 — Host integration. **Dependencies:** AR-01. **Planned detail:** future work; tracker status controls.

**Outcome:** Architecture connects to verified host services rather than invented auth, persistence or public URLs.

**Changes:**

- Inspect actual monolith interfaces for tenant identity/permissions, project storage, transactions/CAS, worker execution, route/visibility data, assets and publication.
- Choose the minimal compatible durable run adapter; define narrow snapshot/current-catalogue/history reads.
- Document public rendering ownership and provider-safe data projection. Define precise unavailable-field blockers.
- Record actual checkout/cart/search commands and locale/route revision contracts; no raw /puck persistence.

**Acceptance:**

- An executable integration-specific contract and evidence references exist, or missing interfaces are explicitly blocked.
- No claim that the repository’s August OpenAPI audit is current live backend behaviour.

**Non-goals:**

- No second backend, endpoint invention, credentials in docs or full monolith refactor.

**Rollback / failure behavior:**

- Contract-only decision; preserve current standalone adapters. Block only dependent host tasks when evidence is missing.

### AR-24 — Implement live route resolution and dependency-scoped freshness

**Package:** P8 — Host integration. **Dependencies:** AR-07, AR-23. **Planned detail:** future work; tracker status controls.

**Outcome:** Commerce changes do not require design regeneration or destroy unrelated design work.

**Changes:**

- Implement single resolver joining static route authority with canonical resource identity/visibility/handle projection.
- Version route/resource navigation semantics; preserve v1 inventory/replay and define migration/redirect/tombstone policy.
- Define capability-checked assignment/type/complexity/fallback precedence and current search context.
- Separate presentation read-set conflicts from routine commerce observations; reconcile new/deleted/renamed resources independently of AI.

**Acceptance:**

- T01,T05,T06,T07,T09,T23: route lifecycle and option changes work; no catalogue-sized design expansion.
- Every migration conflict is explicit; no silently dropped assignments or unapproved route renames.

**Non-goals:**

- No second editable route graph, fabricated stock, or automatic whole-store re-generation on product change.

**Rollback / failure behavior:**

- Keep v1 resolver for old releases; new v2 releases require supported v2 reader. Reverse writes only through explicit migration/restore.

### AR-25 — Connect trusted server storage, publishing and public rendering

**Package:** P8 — Host integration. **Dependencies:** AR-17, AR-19, AR-24. **Planned detail:** future work; tracker status controls.

**Outcome:** A fresh public request resolves a real server-held release without Studio browser state.

**Changes:**

- Inject real authenticated authority and permissions into normal integrated routes; retain fail-closed defaults.
- Read requested snapshot/current context through narrow server interfaces; avoid loading every history snapshot for public requests.
- Render released v2 composition through the same registered implementation; keep public/preview loading and action adapters separate.
- Prove exact prepare/confirm, artifact/version/active-pointer atomicity and supported renderer-version deployment.

**Acceptance:**

- T09,T13,T17,T18,T24 on actual host: fresh process/browser, no IndexedDB dependency, no partial publication.
- External delivery failure is recoverable through host-owned propagation; there is one live authority.

**Non-goals:**

- No browser publish, replacement checkout or unsupported old-renderer retirement.

**Rollback / failure behavior:**

- Disable new writes/public activation; restore via supported draft-and-republish workflow, not unsafe direct pointer manipulation.

### AR-26 — Deliver localized runtime SEO and governed content fields

**Package:** P8 — Host integration. **Dependencies:** AR-25. **Planned detail:** future work; tracker status controls.

**Outcome:** Public metadata reflects the same route, language, approved content and commerce facts as the visible page.

**Changes:**

- Implement explicit locale URL/canonical/alternate policy and legacy redirect handling.
- Project product/offer structured data from current commerce; static metadata and social imagery from approved content/assets.
- Implement indexability, sitemaps and correct error/not-found handling; keep drafts private and non-indexable.
- Separate design SEO defaults from authorized product-content writes.

**Acceptance:**

- T06,T18,T19: fresh direct URLs, language alternates, visibility and structured-data facts agree; no draft URL leaks.
- Verify actual server/streaming metadata behaviour under supported crawlers rather than assume first-chunk layout.

**Non-goals:**

- No ranking guarantee, invented keywords-as-ranking-system, fake ratings or policy claims.

**Rollback / failure behavior:**

- Revert metadata projection version without corrupting canonical URLs; preserve agreed redirects and verified content.

### AR-27 — Connect real commerce actions without building commerce again

**Package:** P8 — Host integration. **Dependencies:** AR-25. **Planned detail:** future work; tracker status controls.

**Outcome:** Public purchase controls actually execute supported Vesko operations with current variant identity.

**Changes:**

- Wire selected-variant action and error/loading/retry UX to host-authorized commands.
- Retain a no-op or explicit disabled action only in labelled preview contexts.
- Verify cart/checkout handoff and error states, including stock changes and validation failures.

**Acceptance:**

- T07,T13,T18: actual supported shopper journey succeeds; unauthorized/mismatched variant requests fail.
- Public store cannot silently use the preview no-op callback.

**Non-goals:**

- No new order, payment, tax, return or checkout engine inside Veskify.

**Rollback / failure behavior:**

- Disable affected public action with truthful state or revert adapter; never present a successful purchase without host confirmation.

### AR-28 — Accept the integrated pilot with recovery and isolation

**Package:** P9 — Pilot and retirement. **Dependencies:** AR-17, AR-20, AR-22, AR-26, AR-27. **Planned detail:** future work; tracker status controls.

**Outcome:** One real merchant store is operational, recoverable and commercially accepted on Vesko.

**Changes:**

- Exercise multi-tenant denial, restart, duplicate workers, cancel, failure during publication, stale assets/facts and current commerce.
- Measure generation cost/stages, queue wait, public serving performance and error/fallback behaviour; establish justified SLOs from measurements.
- Run fresh-session public routes, SEO and commerce journey; retain human complete-store review.
- Record deployment/rollback, artifact retention, unsupported versions and ownership runbook.

**Acceptance:**

- T01,T06–T13,T17–T19,T22–T24 pass applicable real-host cases with actual results.
- No unresolved critical commerce, tenant isolation, data-loss or publication issue; performance claims are measured, not predicted.

**Non-goals:**

- No automatic broad rollout, new family scope or unbudgeted provider tests.

**Rollback / failure behavior:**

- Keep pilot limited/disabled on failure; use tested restore-and-republish and worker admission controls.

### AR-29 — Retire obsolete active generation and redundant transports

**Package:** P9 — Pilot and retirement. **Dependencies:** AR-04, AR-20, AR-22. **Planned detail:** future work; tracker status controls.

**Outcome:** New normal generation/editing no longer coexists with a misleading hidden selector path.

**Changes:**

- Remove obsolete active v1 initial selector entrypoints and v2 expand/fold compatibility detours only where all new consumers are accepted.
- Retain required direction/profile/component readers and old artifacts; move any remaining needed helper under clear compatibility ownership.
- Remove superseded scope transports only after AR-20 equivalent coverage; update route/import and CI discovery evidence.
- Attach path-by-path retirement record and explicit rollback for every removed capability.

**Acceptance:**

- T01,T16,T21: no dangling import/dynamic route/persisted reference; old stores remain readable and publishable under supported policy.
- A v2 failure cannot invoke removed v1 generation as an undocumented fallback.

**Non-goals:**

- No wholesale bounded-storefront-synthesis or whole-storefront-generation-plan directory deletion based on naming.

**Rollback / failure behavior:**

- Revert removal PR if compatibility evidence fails; do not migrate stored data to compensate for an accidental deletion.

### AR-30 — Prune remaining proof infrastructure and close the reset

**Package:** P9 — Pilot and retirement. **Dependencies:** AR-28, AR-29. **Planned detail:** future work; tracker status controls.

**Outcome:** The remaining codebase has explicit active, compatibility and test ownership with no misleading reset leftovers.

**Changes:**

- Remove only proof/runtime roots and static assets proven unused by source, snapshots, tests and public host.
- Keep useful golden fixtures, source evidence and compatibility replay; replace temporary source hashes/zero counts only via mapped adopted gates.
- Synchronize SDD/roadmap/tracker/exports and report unresolved noncritical legacy modules with owners/retirement triggers.
- Close AR with actual engine/pilot evidence; prioritize subsequent expansion by merchant need.

**Acceptance:**

- T01,T21,T24: final source graph, tests and artifact readers are consistent; retained history not falsified.
- No “all debt removed” or six-family support claim unless separately proven.

**Non-goals:**

- No vanity directory rewrite, evidence erasure, CI simplification by deleting tests or unsupported asset purge.

**Rollback / failure behavior:**

- Revert isolated cleanup changes; original historical evidence remains recoverable and release support intact.
