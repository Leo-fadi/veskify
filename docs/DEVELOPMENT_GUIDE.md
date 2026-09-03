# Veskify Development Guide

**Version:** 1.3.0
**Aligned with:** `docs/VESKIFY_SDD.md` and `AGENTS.md`

## 1. Purpose

This guide defines how Veskify is developed, tested, reviewed and handed off while preserving the controlled design-agent architecture and the Vesko integration boundary.

The goal is fast, parallel delivery without duplicate commerce models, conflicting canonical contracts, unnecessary Codex usage or stale branches.

## 2. Repository ownership map

### Canonical domain and contracts

Typical locations:

- `src/domain/**`
- `src/application/**/contract.ts`
- versioned schema modules

Owns projects, pages, sections, snapshots, brand systems, proposals, operations, product-presentation contexts, bindings, source evidence, asset inventory and Storefront Design Brief contracts.

Canonical modules must not import Puck or provider-specific types.

### Component platform

Typical locations:

- `src/domain/component-platform/**`
- `src/application/storefront-design-system/**`
- `src/application/storefront-templates/**`
- `src/components/storefront/**`

Owns component families, variants, slots, editable fields, data-binding requirements, page permissions, responsive/accessibility rules, renderer mapping and migrations.

Commercial family work uses one maintained renderer implementation with materially meaningful
variants, not colour/padding renames. Commercial recipes are registered constrained
`PageBlueprint` profiles that supply permitted/default slots, compatibility, order,
bindings/assets, responsive constraints and omission/fallback rules; they are not a second template
or executable page representation. AI can select only typed bounded parameters; it never provides
arbitrary trees, CSS, classes, code or font imports. Design inherits
`BrandSystem → registered PageBlueprint profile → compatible component family and meaningful variant → bounded validated instance override`.

### Puck integration

Location:

- `src/integrations/puck/**`

Owns direct Puck imports, canonical-to-Puck mapping, transient editor configuration and validated Puck-to-canonical handoff. Puck is not persistence or canonical state.

### Design agent

Typical locations:

- `src/domain/design-agent/**`
- `src/application/design-skills/**`
- `src/application/design-operations/**`
- `src/application/ai-storefront-generation/**`
- `src/application/whole-storefront-generation-plan/**`

Owns skills, planning contracts, structured operations, provider adapters, proposal lifecycle, merchant summaries and guarded application.

### Source discovery and onboarding

Typical locations:

- `src/domain/source-discovery/**`
- `src/services/source-discovery/**`
- `src/domain/storefront-design-brief/**`
- `src/features/onboarding/**`

Owns source evidence, provenance, crawl adapter contracts, reconciliation, asset inventory and approved Storefront Design Briefs.

### Vesko and persistence adapters

Typical locations:

- `src/integrations/vesko/**`
- `src/services/storage/**`
- `src/services/media/**`
- `src/services/publishing/**`

Owns adapter interfaces and standalone implementations. Features depend on interfaces rather than IndexedDB, seed or future Vesko implementation details.

## 3. Current implementation baseline

The verified v1.3.0 source baseline includes the accepted P10B-18B-04 PDP quality upgrade on
19 August 2026. Phase 9 is
closed by product-owner handoff, and P10A is **Baseline / closed**. The overall product remains
**Partial**. P10B is the active development phase. P10B-01 commercial grammar, P10B-02 parametric
BrandSystem / Design DNA, P10B-03 component anatomy, P10B-04 responsive image/art-direction
authority, P10B-05 site-map/page-family authority, P10B-06 commercial shared-frame families,
P10B-07 hero/editorial/campaign/proof families, P10B-08 canonical product-card authority,
P10B-09 commercial homepage profiles, P10B-10 commercial collection/search profiles, P10B-11
commercial PDP profiles, P10B-12 content/support page families, P10B-13 commerce-utility
presentation, the P10B-14 complete-store convergence proof, P10B-15 bounded storefront synthesis,
P10B-16 coordinated direction/diversity control, P10B-16P-01 dynamic commerce route archetypes,
P10B-16P-02A/P10B-16P-02B prompted Design Intent V2 authority and deterministic compilation, and
P10B-16P-03 normal Studio generation, P10B-16P-04 real-provider acceptance, P10B-16P-05A
active-path/compiler rationalisation, P10B-16P-06 canonical search query/results authority, and
P10B-17 responsive/accessibility/performance closure, P10B-18A commercial-authority audit, and
P10B-18B-01 Design DNA/shared-frame upgrade, P10B-18B-06 asset-composition/art-direction upgrade,
P10B-18B-02 homepage/editorial/campaign quality upgrade, P10B-18B-03 collection/search/product-card
quality upgrade, P10B-18B-04 PDP quality upgrade, and P10B-18B-05 content/support/utility quality
upgrade are **Baseline**. P10B-16P-02 is **Baseline**; parent P10B-18B is **Baseline / complete**.
P10B-18C, P10B-16P-05B and P10B-19 PRE are **Baseline**. P10B-18D is a **Baseline diagnostic with live commercial quality rejected**. P10B-18 and P10B remain **Partial**. DEVX-01A through DEVX-01G are Baseline, and DEVX-01 is Baseline / closed. P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are Baseline; parent P10B-19A-08 is Baseline / closed. P10B-19A-09A is Baseline; parent P10B-19A-09 and P10B-19A remain Partial. P10B-19A-09B is the exact next implementation task, P10B-19A-09C is Planned after A-09B, P10B-19A-10 is Planned after A-09C, and P10B remains Partial.

The P10B-16P-02B boundary refreshes exact request/current authority, applies a bounded
metadata-only deterministic compatibility solver, and compiles exact Design DNA, shared frame,
PageBlueprint, dynamic-commerce, component/variant/parameter, narrative and responsive/art
authority with machine-readable diagnostics. A valid decision reaches existing synthesis and one
isolated proposal; stale, incompatible or partial results mutate nothing. P10B-16P-03 wires that
authority into normal Studio with compact standalone/mock server-verified identity, one explicit
mocked call, and one registered `APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION` operation carrying the
target-bound `compilePromptedStorefrontDesignIntentV2@2.0.0` permission. The operation cross-binds
the exact P02B source-proposal fingerprint and compiler lineage. The snapshot preserves exact
evidence references as provenance through review, accept, undo/redo, save/reload, and Preview;
current approved evidence is resolved independently from trusted server/session authority and the
snapshot never authorizes itself.
P10B-16P-04 proves the real provider boundary through a production-disabled, trusted server-owned
Aurum acceptance composition. Three final ordered Prompt A/B/C calls compiled materially different
exact storefronts with one materialization each; A and B rejected cleanly, while C completed atomic
Accept, Undo/Redo, explicit Save, reload, and normal Preview. The cumulative task ledger is 16 calls
with zero retry/fallback, zero publication, and unchanged protected commerce/media. This is not
production authentication, Vesko staging, or production evidence. P10B-16P-05A makes that semantic
route the only active initial-generation path and reduces
the prompted compiler to one coordinator/resolver/exact-decision/executor chain with one
materialization boundary. The active P10B-16L executable-intent routes/providers/runtime are
removed; its historical evidence and required neutral migration/safety fixtures remain Deprecated
compatibility-only. P9/Lumo live generation is isolated historical/deprecated authority, while its
proven publication/migration fixtures remain. The P10B-16P-04 acceptance composition is now the lean production-disabled mock/live seam retained for P10B-18D. P10B-16P-05B has completed consumer-verified cleanup.

P10B-16P-06 keeps the selected `/search` presentation in `StorefrontSnapshot` while deriving query,
filters, sort, page, result IDs, and result count transiently through one provider-neutral search
port and the standalone `CatalogueDisplayModel` adapter. Draft, proposal, saved/history, and
published routes reuse the existing collection/search renderer, product cards, shared frame, and
governed orientation/no-results states. It claims no Vesko search integration, OpenAI or other
provider call, semantic/vector/fuzzy search, recommendation, personalization, or analytics
authority.

P10B-17 executes current registered responsive transformations through the existing shared
renderers at 375, 768, 1024, and 1440 px in EN/FI. Its Baseline evidence covers frame and page-
family geometry, keyboard/focus/semantic/contrast behavior, touch and reduced-motion behavior,
bounded rendering/search/media/build budgets, lifecycle parity, protected commerce/media, browser
evidence, and representative human visual review. It adds no breakpoint registry or renderer and
does not claim P10B-18B source-authority improvement, P10B-18C designer-grade quality/100+ scale,
Vesko staging, production authentication, or production performance. The accepted P10B-18A audit
freezes the commercial ceiling and six conditional improvement packages. Accepted P10B-18B-01
materializes bounded within-direction density, corrects semantic frame/responsive causality, makes
the existing compact frame complete-store reachable, and refines shared-frame composition without
claiming later page-family or P10B-18C closure. Accepted P10B-18B-06 adds only bounded shared
asset-composition authority; accepted P10B-18B-02 closes bounded homepage/editorial/campaign
quality, accepted P10B-18B-03 closes bounded collection/search/card quality, accepted P10B-18B-04
closes bounded PDP quality, and accepted P10B-18B-05 closes bounded content/support/utility quality
and completes parent P10B-18B. Accepted P10B-18C closes deterministic integrated quality/diversity;
P10B-18D completed as a rejected-quality diagnostic, P10B-19 PRE is Baseline, P10B-19A is Partial,
P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are Baseline, and parent
P10B-19A-08 is Baseline / closed. P10B-19A-09A is Baseline; parent P10B-19A-09 and P10B-19A
remain Partial. P10B-19A-09B is the exact next implementation task, P10B-19A-09C is Planned
after A-09B, and P10B-19A-10 is Planned after A-09C.

For normal initial generation, follow this ownership chain and do not add a parallel composition:

```text
Storefront Studio
  → /api/ai/whole-storefront-proposals
  → canonical prompted server handler
  → trusted current authority and semantic provider selector
  → semantic compatibility resolution
  → exact compiled decision
  → coordinator and sole executor/materializer
  → isolated proposal
```

Standalone P03 and controlled P04 compositions inject into this handler only outside production.
Registered follow-up execution remains separately tagged and is not an alternative initial-generation
service.

The current baseline includes canonical storefront/brand contracts, ComponentDefinitionV2 and its
generated manifest, executable PageBlueprint profiles, registered complete page-set/site-map
authority, dynamic commerce-bound collection/PDP
rendering, governed internal initial/follow-up execution, strict internal scope routing, proposal
acceptance/history, draft persistence, an authoritative publishing gateway, deterministic publish
compilation, and published homepage/collection/PDP routes.

Do not rebuild those systems. Completed P10A capability includes governed initial and follow-up
execution, strict internal routing, controlled real-provider acceptance, accepted-AI receipt
wiring, the authoritative publish gateway, deterministic publish compilation, atomic compiled
artifact/version persistence, restore-to-draft with explicit republish, and final correlated
publication evidence.

All generation and editing paths compile into the same `StorefrontSnapshot`. `PageModel` is an
implementation type inside that aggregate, not a second canonical page graph. Governed packages
and routing are internal P10A authorities; merchant-facing routing, clarification, scope controls,
and normal-editor execution belong to P10C. P10D remains advanced media, P11 remains Vesko
integration readiness, and P12 remains production hardening.

## 4. Branch and PR strategy

### Contract-driven sprint authority

This guide is the single narrative authority for Veskify sprint contracts and independent
verification. The versioned machine authorities are:

- `docs/governance/task-contract.schema.v1.json`
- `docs/governance/task-contract.template.v1.json`
- `docs/governance/verifier-verdict.schema.v1.json`
- `docs/governance/verifier-verdict.template.v1.json`

Sprint coordinators lock the dependency/merge-order map and all child-task contracts in the sprint
baseline before implementation branches are created. Contract instances belong under
`docs/governance/task-contracts/<sprintId>/` when retained in the repository and must already exist
on the child's base commit. An implementation branch must not edit its own contract. A material
contract change requires product-owner authority, a new locked baseline and a newly eligible branch;
it is never a convenient scope expansion.

DEVX-01B implements the canonical repository-native executable at `scripts/task-governance.mjs`.
Its `contract`, `identity`, and `verify` commands validate immutable external or base-retained
contracts, calculate RFC 8785 domain-separated identities, inspect complete Git worktree state,
enforce path/scope authority, and reconcile independent verifier verdicts. The accepted v1 schemas
remain the sole machine contract and verdict authority.

### Permanent delivery loop

```text
merchant/product requirement
  -> sprint contract
  -> bounded child-task contract
  -> implementation approach decision
  -> implementation
  -> implementer-focused validation
  -> independent verifier
  -> verifier PASS
  -> commit and push
  -> one pull request
  -> exactly one automatic Codex GitHub review
  -> one consolidated correction pass
  -> required CI
  -> explicit merge authority
  -> sequential merge
  -> synchronize remaining branches
  -> next eligible child task
```

Implementer tests, independent verification, GitHub review, CI and product-owner acceptance are
five separate authorities. Self-validation may establish implementation evidence but can never be
the sole proof that the immutable contract was interpreted correctly.

### Roles and authority

| Role                 | Owns                                                                                                                                          | Must not do                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Sprint coordinator   | Immutable sprint map, dependency graph, branch eligibility, worker allocation, merge order, sprint state and stop conditions                  | Silently widen a child contract or create branches before dependencies merge            |
| Implementer          | One immutable task contract, one branch, approach decision, implementation, focused tests, local evidence and correction of verifier findings | Approve its own task or push failed/blocked work merely to seek review                  |
| Independent verifier | Locked contract, repository authority, complete diff, claimed evidence, adversarial challenge and criterion-level `PASS`/`FAIL`/`BLOCKED`     | Modify implementation files or turn convenient interpretation into acceptance           |
| GitHub reviewer      | One post-PR automatic Codex review and actionable code-review findings                                                                        | Replace pre-commit independent verification or initiate a second automatic review cycle |
| Product owner        | Architecture decisions, material scope changes, merchant-visible checkpoints, commercial acceptance and subjective final rejection            | Perform mechanical QA or manufacture missing implementation evidence                    |

### Architecture-quality decision record

Before implementation begins, the immutable contract records:

1. the selected repository-native approach;
2. the canonical authority it extends;
3. at least one rejected convenient shortcut;
4. expected failure behavior;
5. unresolved architecture conflicts, or an explicit empty list.

Do not optimize for the quickest passing implementation, the smallest convenient diff, or reuse
that weakens canonical ownership. Select the lowest-long-term-complexity design that fully meets
the contract, compatibility, fail-closed, migration and merchant/engineering outcome. Do not add an
abstraction without a named current consumer. Stop rather than implement a workaround that violates
the SDD, ADRs, canonical ownership or the locked P10B-19 architecture. These rules prohibit both
shortcuts and speculative overengineering.

### Pull-request scope budgets

| Budget                              | Default |
| ----------------------------------- | ------: |
| Target maximum net production lines |   1,000 |
| Target maximum production files     |       8 |
| Hard-stop net production lines      |   1,500 |
| Hard-stop production files          |      12 |

Each pull request owns one canonical concern or one meaningful visual family. Generated files are
excluded only when their paths and rationale are allowlisted in the immutable contract. Tests and
documentation required to prove behavior remain with that behavior. Crossing either hard stop
requires explicit product-owner approval in the locked contract and otherwise stops the task for
safe decomposition. File or line count alone must not split one atomic invariant across unsafe
boundaries.

### Rolling sprint and branch protocol

One parent sprint may deliver seven to ten child pull requests through bounded rolling waves:

1. Lock one dependency and merge-order map before implementation.
2. Create a branch only after every declared dependency is merged.
3. Use at most two independent implementers and one independent verifier by default.
4. Require disjoint ownership or explicit safe shared-file coordination for parallel work.
5. Branch dependent tasks from updated `origin/main` unless a locked dependency says otherwise.
6. Synchronize eligible open branches with `git fetch origin` and `git merge origin/main`.
7. Never rebase or force-push.
8. Merge sequentially according to the locked dependency order.
9. Continue automatically only through pre-authorized non-visual children.
10. Do not claim that dependent pull requests can safely share one stale base.

The coordinator stops the sprint for a product-owner checkpoint, verifier `FAIL` or `BLOCKED`
requiring material redesign, architecture conflict, dependency failure, scope-budget violation, CI
failure requiring behavior changes, or unexpected canonical ownership change.

### Verification policy

DEVX-01B owns mechanical verification of schema validity, task/branch/base identity, changed and
forbidden paths, file/addition budgets, validation and evidence declarations, acceptance-criterion
coverage, contract/verdict identity and terminal state. DEVX-01A defines the protocol; DEVX-01B
executes its bounded mechanical portion.

Canonical command usage is:

```bash
pnpm governance:contract --contract <path> --expected-file-sha256 <sha256> [--output <path>]
pnpm governance:identity --contract <path> --expected-file-sha256 <sha256> [--output <path>]
pnpm governance:verify --contract <path> --expected-file-sha256 <sha256> --verdict <path> [--output <path>]
```

Contract identity is `sha256("veskify-task-contract-v1\n" + RFC8785_JCS(contract))`; raw-file
SHA-256 remains a separate immutability gate. Implementation identity fingerprints a deterministic
safe manifest relative to the minimum base and includes committed, staged, unstaged, untracked,
deleted, renamed, binary, mode and non-followed symbolic-link state. Every changed path must be
allowed, every production path must be owned, and forbidden paths override both. Likely
secret-bearing paths fail before content hashing unless the immutable contract explicitly allows
them.

The accepted numerical scope fields named `NetProductionLines` are mechanically interpreted as
non-generated production **additions**. Deletions are reported separately and never offset those
limits. Exceeding a target produces a warning; exceeding a hard stop fails unless the immutable
contract contains the schema-valid product-owner exception. Canonical merchant/runtime files under
`src/**` are production; tests, documentation, governance scripts, and deterministic DOCX exports
are not production runtime files.

The pre-commit verdict binds the verifier's anchor HEAD plus the complete diff fingerprint. Commit
exactly that content after verifier PASS; the base-to-committed fingerprint must remain equal even
though HEAD advances. The CLI never executes contract commands and does not replace semantic
verification, GitHub review, CI, or product-owner commercial judgment. A post-review correction is
mechanically re-inspected but is not retroactively covered by the original semantic verdict.

The independent semantic verifier must:

- read the immutable contract first;
- inspect applicable repository authority and the complete diff;
- reproduce the smallest sufficient claimed validation;
- challenge convenient interpretations and implementation-tailored tests;
- verify negative/fail-closed, compatibility, migration, ownership and scope claims where required;
- use temporary adversarial tests when useful, then remove them or leave them uncommitted;
- report unsupported claims without modifying implementation files;
- return `PASS`, `FAIL` or `BLOCKED` with criterion-level evidence.

Verification fails closed when a criterion is absent, required evidence is missing, forbidden paths
changed, architecture ownership is unresolved, validation cannot be reproduced, or contract and
implementation identities differ. Evidence must not contain credentials, tokens, raw provider
responses, environment values or private merchant data.

Commit and push only after verifier `PASS`. On verifier `FAIL`, make one consolidated correction
pass and run the verifier once more. Stop with a consolidated diagnosis if the second verdict is
not `PASS`; do not create an endless correction loop.

### Visual-task policy

Merchant-visible P10B-19 tasks own one meaningful component or page-family concern per pull
request. Automated structural, browser, accessibility and responsive checks run first. The
implementer generates a bounded focused screenshot set, the independent verifier passes the
technical evidence, and the product owner then decides subjective commercial quality before merge.

The product owner is not responsible for creating screenshots, inspecting hundreds of captures,
discovering broken media or finding basic responsive failures. Full-store, multi-page and live-AI
acceptance remains primarily in final phase gates rather than every child pull request.

### P10B-19A planned micro-pull-request map

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

P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are **Baseline**; parent
P10B-19A-08 is **Baseline / closed**. P10B-19A-09A is **Baseline**; parent P10B-19A-09 and
P10B-19A remain **Partial**. P10B-19A-09B is the **exact next implementation task**,
P10B-19A-09C is Planned after A-09B, and P10B-19A-10 is Planned after A-09C.

P10B-19A-08A owns only normalized topology identity. Its three schemas are version `1.0.0`.
PageBlueprint v2 regions receive deterministic `r0`, `r1`, ... tokens in the A-03 canonical
default reading order; the normalized page topology retains A-03 structural relationships and A-05
responsive rules while excluding A-04 asset-role and A-06 fallback authority. Page fingerprints
use `page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>`. A Structural
Storefront Family topology covers the six canonical A-02 page-family roles and A-02 cross-page
relationships, with fingerprints shaped as
`structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>`. One pure,
non-persisted inactive duplicate-cluster index groups equal PageBlueprint and family topology
identities. It neither
evaluates compatibility nor rejects, selects, activates, persists or exposes runtime records. The
production PageBlueprint v2 record count, Structural Storefront Family record count and normalized
topology index record count remain exactly zero.

P10B-19A-08B owns only compatibility contracts and deterministic evaluation. Its schema-version
`1.0.0` capability context uses the ordered catalogue-cardinality, fact-depth,
product-complexity, navigation-depth and canonical `en`/`fi` locale dimensions, plus exact
candidate-scoped capacity for every required A-04 region/role through maximum 32. Family profiles
bind exact A-07 candidates and explicitly partition all five dimension vocabularies; the sole
production profile catalogue is empty. Memoized A-06 DAG evaluation reports all compatible
substitution targets in declared order without selecting one, classifies PageBlueprint candidates
as directly-compatible, substitution-compatible, omission-compatible or incompatible, and
classifies families as directly-compatible, conditionally-compatible or incompatible. A-08A
topology identity is provenance only. Context, profile and aggregate evaluation fingerprints are
stale-checked; scores, ranks, winners, selection, activation, persistence and runtime wiring remain
outside this task. Production candidate, profile, context, evaluation, active/selectable/selected
and current-generation consumer counts remain zero.

P10B-19A-08C owns strict schema-version `1.0.0` deterministic selection requests and immutable
receipts over exact A-07/A-08A/A-08B authority. It applies scoring-free family and PageBlueprint
compatibility precedence with case-bound canonical-fingerprint tie-breaks, selects all six
canonical page families, follows A-06 recursive substitution priority and retains safe omission
declarations without executing them. Complete-store combinations share one global 4,096 evaluation
bound and produce an identity-free complete topology; receipt parsing replays selection to reject
stale or contradictory authority. Production registry, profile, request, receipt and current-
generation runtime counts remain zero, with no visual, runtime-wiring, provider, persistence or
publication change. Parent P10B-19A-08 is Baseline / closed.

P10B-19A-09A owns only opaque legacy-v1 alias and replay-reference authority. The ordered aliases
are exactly `legacy-v1:premium-editorial`, `legacy-v1:modern-technical`, and
`legacy-v1:minimal-commerce`, mapped one-to-one to the three existing coordinated directions.
Each immutable alias binds the imported current direction authority version `1.1.0` and exact
package fingerprint. Replay input is one complete existing selection narrowing, validated through
the current narrowing validator and projected only through the existing exact executable-selection
schema. The retained audit input keeps `selectionId`, but replay fingerprint identity excludes it
as incidental selection-instance authority. No alias is inferred from a snapshot, appearance,
profiles or topology, and no Structural Storefront Family, PageBlueprint v2 or Visual Recipe v2
identity is fabricated. A-09B owns historical snapshot read/render replay; A-09C owns publication
replay and A-09 closure. A-09A therefore claims no historical classification, read/render replay,
publication compatibility, current-generation change or merchant-visible outcome.

The A-08A/A-08B/A-08C rows are a delivery-only decomposition of the accepted parent P10B-19A-08
architecture. They do not redefine P10B-19 PRE or the accepted P10B-19A-09 ownership boundary.

P10B-19A-07 adds strict schema-version `1.0.0` PageBlueprint v2 and Structural
Storefront Family candidate composition plus one bounded inactive registry. Exact stale-checked
fingerprints cover canonical candidate content only; they are not normalized-topology identities.
Every family candidate covers all six A-02 page-family roles with exact ID/version references and
canonical relationships. Registry validation resolves family references and A-06 targets, enforces
same-page-family targets, rejects exact-identity cycles, preserves A-06 priority and returns deeply
readonly deterministic order. The only production registry remains exactly empty, with no active,
deprecated, selected or runtime-reachable record. A-01 through A-06 and current v1 behavior remain
unchanged.
P10B-19A-06 adds one strict, deeply readonly omission, substitution and fallback companion at
schema version `1.0.0` under the sole storefront-template PageBlueprint authority. It composes the
exact A-03 structural, A-04 asset-role and A-05 responsive identities; owns only the
`required-asset-role-cardinality-unsatisfied` trigger; covers every and only required-role region
with one `omit-region` or `fail-closed` terminal rule; and preserves one declared priority order for
at most eight whole-blueprint substitution references. Required regions cannot be omitted, and the
maximum simultaneous optional omission is revalidated through an internal A-03 projection that is
never exported, persisted or fingerprinted. It adds no current availability, target lookup,
compatibility, selection, execution, records, registry, persistence, rendering or production
consumer. P10B-19A-05 adds the retained strict responsive-rule companion; P10B-19A-04 adds
one strict, deeply readonly asset-role compatibility companion under the sole storefront-template
PageBlueprint authority. It reuses the canonical ordered nine-value `AssetRole` list, binds to one
exact A-03 blueprint ID, record version and known region set, validates explicit per-role
required/optional cardinality through maximum 32, and canonicalizes only valid authority by the
structural default reading order and canonical role order. Empty or absent region declarations are
not wildcards. It adds no exact asset, availability, reuse, responsive, fallback, record, registry,
persistence, selector or current-generation authority. P10B-19A-03 establishes
the inactive `page-blueprint-v2-contract.ts` region core and explicit
`page-blueprint-version-dispatch.ts` envelope under the sole storefront-template authority. The
envelope maps v1 compatibility contract `1.0.0` to the unchanged v1 parser and v2 contract `2.0.0`
to initial record version `1.0.0`. The strict core reuses A-02 page-family IDs and canonical
narrative roles/visual weights, locks six intra-page relationship kinds, enforces the six-family
minimum required roles, validates bounded acyclic precedence/containment and complete accessible
orders, and canonicalizes only valid input. It adds no v2 record, registry, persistence, selector,
materializer, renderer, provider, publication, responsive, or fallback authority.
P10B-19A-02 owns only the strict directed cross-page relationship vocabulary,
value object, deterministic key and canonical collection boundary. It does not own page instances,
routes, a graph, PageBlueprint v2 region relationships, persistence, selection or rendering.
P10B-19A-01 establishes
`src/domain/structural-storefront-family` as the sole family identity authority with the ordered
IDs `editorial-offset`, `campaign-modular`, `product-first-commerce`, `technical-comparison`,
`warm-narrative`, and `restrained-gallery`; strict supported-major-v1 versions beginning at
`1.0.0`; and lifecycle states `candidate`, `active`, and `deprecated`. Active-family and candidate-
registry-record counts remain zero. A-01 itself added no registry, fingerprint, selection,
PageBlueprint v2, rendering, or current-generation wiring.

These children preserve the accepted P10B-19 PRE outcome. DEVX-01A implements none of their
production authority.

The product owner explicitly approved this ten-child delivery decomposition in the immutable
DEVX-01A contract. It supersedes only P10B-19 PRE's earlier six-child P10B-19A delivery partition;
it does not change Structural Storefront Family, PageBlueprint v2, registry, compatibility,
migration or closure ownership in the accepted architecture.

### DEVX-01 engineering-enablement sprint

| Order | Task                                                                                 | Status after DEVX-01A merge |
| ----: | ------------------------------------------------------------------------------------ | --------------------------- |
|     1 | DEVX-01A - Sprint contract and independent verification protocol                     | Baseline                    |
|     2 | DEVX-01B - Mechanical contract/verdict verifier                                      | Baseline                    |
|     3 | DEVX-01C - CI timings, obsolete-run cancellation and Next build caching              | Baseline                    |
|     4 | DEVX-01D - Parallel static, Vitest and production-build jobs                         | Baseline                    |
|     5 | DEVX-01E - Playwright timing inventory and balanced execution groups                 | Baseline                    |
|     6 | DEVX-01F - Playwright sharding/matrix, merged reports and stable required aggregator | Baseline                    |
|     7 | DEVX-01F2 - Contention-safe Vitest sharding                                          | Baseline                    |
|     8 | DEVX-01G - Two-run performance acceptance and workflow closure                       | Baseline                    |

P10B remains Partial. DEVX-01A through DEVX-01G are Baseline, and DEVX-01 is Baseline / closed.
P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are Baseline; parent P10B-19A-08 is Baseline / closed; P10B-19A-09A is Baseline; parent P10B-19A-09 and P10B-19A remain Partial; P10B-19A-09B is the exact next implementation task; P10B-19A-09C is Planned after A-09B; P10B-19A-10 is Planned after A-09C; P10B remains Partial.

### CI timing, cancellation and Next cache authority

The canonical CI runs independent static and production-build jobs plus bounded Vitest and browser
plan/matrix/report graphs. Every Vitest matrix row remains internally one-worker and serial. The
stable `validate` job executes no validation command; it runs after every graph dependency and
fails unless every dependency result is exactly `success`. Timed commands still execute without
shell expansion through the repository-owned timing utility:

```bash
node scripts/ci-timing.mjs run \
  --id typecheck \
  --output-directory .ci-timings \
  -- pnpm typecheck
```

The runner streams child output normally but stores only schema/version identity, stable step ID,
status, monotonic duration, bounded UTC timestamps, exit code and terminating signal. It writes one
atomic record and returns the child exit status; a child signal uses the conventional `128 + signal`
status. Invalid invocation exits `64`, malformed timing authority exits `65`, and a timing-write
failure after a successful child exits `74`.

Each execution job writes to its own profile directory. The always-run summary command validates
that profile's declared order and records the profile identity:

```bash
node scripts/ci-timing.mjs summarize \
  --profile static \
  --input-directory .ci-timings/static \
  --output .ci-evidence/static-summary.json \
  --job-status success
```

A successful profile requires all of its declared records. An unsuccessful job may retain only a
truthful ordered prefix. Repeated install records remain isolated by profile. Each summary includes
safe records, measured command total and three slowest completed commands, appends a bounded table
to `$GITHUB_STEP_SUMMARY`, and is uploaded with its individual records for 14 days. The aggregate
summary contains only dependency names, results and the final decision. Timing JSON, logs and
`.next/cache` are never committed as evidence.

GitHub-native concurrency groups runs by workflow and pull-request number, falling back to ref for
non-PR execution, and cancels only obsolete work in the same group. `actions/cache@v4` persists only
`.next/cache`; its key binds runner OS, Node 24, `pnpm-lock.yaml`, `package.json` and relevant build
inputs. The restore prefix remains dependency/runtime compatible when source changes. Webpack and
storefront budgets still execute on every run.

The PR #211 baseline was 2h 6m 13s. The completed DEVX-01C run measured 2h 5m 49.513s of commands:
Vitest 1h 11m 18.183s, Playwright 51m 5.840s, Webpack 1m 7.832s, and the remaining stages under
1m 8s each. Grouping those measured stages projected a 1h 11m 24.063s command critical path, a
54m 25.450s reduction, while four installs add a projected 17.640s of runner work. That projection
excludes queueing, runner startup and cache variance; actual DEVX-01D timings are evidence rather
than final performance acceptance. DEVX-01E owns Playwright timing inventory, DEVX-01F owns locked
browser matrix execution and merged reports without activating unnecessary suite shards, and
DEVX-01F2 owns contention-safe Vitest sharding and merged-result validation.

Final-architecture Run A (`33362860614`, commit
`563b427d3eadcae206d9b20e49793f62dd989130`) completed in 34m27s on a cache miss. It retained 245
runtime-discovered Vitest files across `82 / 82 / 81`, 3,165 passed, one pending, zero failed, and
all 12 canonical Playwright suites with successful merged reports and stable `validate`. Against
the original 2h6m13s serial baseline, developer wait time fell by 1h31m46s, or 72.706%. Summed
GitHub job time was 2h9m46s, 3m33s higher than the serial baseline; this closure claims reduced
waiting time, not lower compute cost. Run B remains the final clean before-merge evidence gate and
must use the same CI architecture.

### Existing branch and PR rules

- One task equals one branch, one worktree and one PR.
- Start from the latest approved `origin/main` unless the task names an unmerged dependency.
- Use outcome-based branch names, for example:
  - `codex/p5-01-component-registry-v2`
  - `codex/p7-01-source-discovery-contracts`
  - `codex/p10a-03-component-knowledge-registry`
- Use `git fetch origin` and `git merge origin/main`. Never rebase.
- Do not force-push to rewrite history.
- Update an existing open PR rather than creating a duplicate.
- Keep documentation-only updates in one documentation PR.
- Merge only after CI is green, the PR is mergeable and the single automatic review cycle is resolved.

## 5. Worktree workflow

Current worktrees:

| Window | Path                       | Default role                                                                   |
| ------ | -------------------------- | ------------------------------------------------------------------------------ |
| W1     | `/Users/leo/veskify`       | Shared contracts, component registry v2, documentation and merge-leading work. |
| W2     | `/Users/leo/veskify-p1-02` | Merchant shell and presentation-only UI.                                       |
| W3     | `/Users/leo/veskify-p1-03` | Source discovery, onboarding contracts and independent capabilities.           |
| W4     | `/Users/leo/veskify-qa`    | Manual QA and real-provider regression.                                        |

Roles may change per phase, but every task must declare ownership and no-touch areas.

### Safe parallel example

- W1 defines new component/binding contracts.
- W2 builds the Storefront Studio shell without touching domain/registry contracts.
- W3 builds source-evidence and Storefront Design Brief contracts in new modules.

### Unsafe parallel example

- two branches modify the same registry index;
- two branches alter `BrandSystem` or `StorefrontSnapshot` simultaneously;
- one branch changes option-group schemas while another builds against the old shape;
- two branches modify the same editor route/store;
- one branch changes a persistence migration while another changes bootstrap logic.

## 6. Future task design policy

Every future task must state these 11 items:

1. **Outcome** — the observable merchant, system, or evidence result.
2. **Canonical authority** — the existing model, contract, registry, adapter, or lifecycle that
   owns the result.
3. **Deficiency** — the verified current gap, without treating planned prose as implementation.
4. **Exact scope** — the bounded files, capabilities, and behavior the task may change.
5. **Dependencies** — required tasks, commits, contracts, decisions, environments, and ownership.
6. **Positive evidence** — focused proof that the authorized outcome works.
7. **Negative and fail-closed evidence** — rejected, stale, invalid, ambiguous, and no-partial-write
   behavior where relevant.
8. **Browser and visual evidence** — explicit viewport, fixture, screenshot, and human-review needs;
   tests alone cannot close P10B commercial quality.
9. **Non-goals** — adjacent systems and authorities the task must not create or change.
10. **Exit condition** — the exact implementation and evidence gate required to mark the task done.
11. **Unlocks** — the named downstream task, merchant capability, or phase gate enabled by closure.

Branch/worktree, owned/no-touch files, validation commands, commit/PR workflow, and completion
report requirements must also be explicit execution controls, but they do not replace the 11
product-delivery fields above.

Ask before starting:

> What can the merchant do after this PR that they could not do before?

Architecture-only tasks are allowed only when they directly unlock a named merchant capability and have a clear consumer task.

## 7. Development sequence

### Phase 9 — Closed by product-owner handoff

Phase 9 records remain historical evidence with their stated limits. Do not reopen Phase 9 or
reinterpret its closure as current commercial, real-provider, Vesko staging, or production proof.

### P10A — Grounded orchestration and publishing closure

Freeze vocabulary, audit capabilities, define executable PageBlueprint contracts, generate the
Component Knowledge Registry from those contracts, define separate initial/follow-up Skill package
contracts, define scoped router/authority/validation contracts, and compile publication
deterministically. P10A owns governed generation and follow-up execution, scope routing, proposal
lifecycle, controlled-provider acceptance, publishing/compiler authority, publish/render/rollback
evidence and protected-commerce correctness. It closes before commercial visual expansion and does
not deliver merchant-operable granular editing or close on commercial visual polish.

### P10B — Commercial Storefront Generation System v1

P10B-01 through P10B-18 deliver executable grammar, bounded Design DNA, meaningful component
anatomy, art direction, complete site-map/page-family authority, commercial families/profiles, an
early Premium Editorial complete-storefront slice, bounded synthesis, diversity control,
responsive/accessibility/performance closure, and a commercial quality/scale gate. P10B owns
complete-storefront generation and presentation; Vesko retains operational commerce.

The binding architecture is
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md).
It uses only `BrandSystem → PageBlueprint profile → component family/meaningful variant → bounded
validated instance override`; manual Puck editing is not a dependency. P10B closes only when 100+
complete configurations pass deterministic diversity/protected-state gates and a representative
fingerprint-stratified subset passes retained human review at 375, 768, 1024, and 1440 px.

P10B-01 through P10B-17, P10B-16P-01 through P10B-16P-05A, P10B-16P-06, P10B-18A, and all accepted
P10B-18B-01/06/02/03/04/05 packages and P10B-18C are Baseline; P10B-16P-02 is Baseline. Parent
P10B-18B is Baseline/complete; P10B-16P-05B is Baseline; P10B-18D is a rejected-quality diagnostic
Baseline. P10B-18 and P10B remain Partial, P10B-19 PRE is Baseline, and P10B-19A is Partial;
P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are Baseline, while parent
P10B-19A-08 is Baseline / closed. P10B-19A-09A is Baseline; parent P10B-19A-09 and P10B-19A
remain Partial. P10B-19A-09B is the exact next implementation task, P10B-19A-09C is Planned after
A-09B, and P10B-19A-10 remains Planned after A-09C. Their ownership remains
disjoint: P10B-05 owns
site-map/PageBlueprint page-set authority,
while P10B-03 consumes P10B-02 Design DNA compatibility where relevant without copying or replacing
its `BrandSystem` authority.
Shared registry indexes, schema exports, migrations, manifests, synthesis/direction authority, and
renderer boundaries require one integration owner. Use A/B/C slices only for necessary
contract/anatomy, renderer/variant, or PageBlueprint/generation/evidence separation; a parent is not
complete until all required slices and evidence pass.

### P10C — Storefront Studio Editing Experience v1

P10C delivers the brand asset library, canonical Puck boundary, stable frame identity, bounded
manual operations, merchant-facing scoped AI editing, unified AI/manual history and the required
Storefront Studio shell. It closes when a merchant can select, manually edit, make an AI edit
elsewhere, add/remove/reorder, undo/redo, save, preview and publish through the same
`StorefrontSnapshot`.

### P10D, P11 and P12

P10D defers registered generated media, video and GLTF/GLB/Three.js presentation with required
fallbacks. Registered, governed Three.js implementations are permitted only through registered
interactive-presentation capabilities; AI may select or configure them but may not generate their
implementation. Registered component, asset, performance, accessibility and fallback authority
continues to apply. No arbitrary generated application code or arbitrary/generated Three.js
implementation is permitted. P10D is not a dependency for the first commercial storefront,
minimum pilot editor, or Vesko pilot.

P11 closes the incomplete obtained Vesko OpenAPI contract, supplies canonical reference adapters,
and proves the lifecycle in Vesko staging. Raw `/puck` persistence is incompatible with
`StorefrontSnapshot`; Veskify commerce writes remain forbidden. P12 then supplies production
hardening, tenancy, security, observability, recovery, deployment, and pilot operations.

## 8. Testing strategy

### Focused tests per PR

Use the smallest relevant set:

- schema and contract unit tests;
- executor/rollback tests;
- component/binding tests;
- repository or adapter contract tests;
- focused React integration tests;
- one relevant Playwright journey only when the visible risk requires it;
- responsive/accessibility checks for changed components.

P10A focused acceptance records functional and publishing evidence: governed generation/follow-up
execution, routing, proposal lifecycle, controlled-provider acceptance, compiler/publish/render/
rollback behavior and protected-commerce correctness. P10B acceptance records the commercial
reachability chain for new design-system capabilities (registered → planner-selectable →
proposal-expressible → compiler-preserved → `StorefrontSnapshot`-stored → renderer-visible →
editor-editable → manually live-proven), direction differentiation and manual screenshot/browser
review of homepage, collection and PDP at 375, 768, 1024 and 1440 px using representative approved
assets. Schema-valid or placeholder-only evidence does not close P10B.

### Dynamic PDP minimum fixtures

- simple watch with one colour dimension;
- complex ring with five or six groups;
- incomplete selection;
- unavailable combination;
- selected-variant price, availability and media resolution;
- unknown product-type fallback.

### Source discovery minimum fixtures

- valid public source summary;
- blocked or unavailable source;
- conflicting public and canonical prices;
- missing logo/hero media;
- prompt-injection-like page text treated as data only;
- deterministic evidence and provenance.

## 9. Validation policy

Normal feature PR:

```text
focused tests
+ typecheck once
+ lint once
+ formatting once
+ GitHub CI broad gate
```

Do not run, unless explicitly requested:

- `pnpm validate:full`;
- full Vitest;
- full Playwright;
- repeated production builds;
- repeated validation after no relevant changes.

Run full validation only at phase/release gates, high-risk migrations, staging acceptance or explicit product-owner instruction.

### Production-build policy

Webpack is temporarily the required production-validation bundler for local validation and GitHub CI.
Use the following commands directly so their child-process exit status remains the reported result:

```bash
pnpm build
pnpm build:webpack
```

`pnpm build` is the required production gate and delegates to `build:webpack`; the explicit command
is available when the selected bundler needs to be visible in a validation record. Next.js prints
`webpack` at the start of either build.

Turbopack remains the default Next.js development technology through `pnpm dev` and is retained as
an explicit diagnostic production build:

```bash
pnpm build:turbopack
```

Do not substitute a failed or interrupted Turbopack diagnostic for the required Webpack gate. Do
not hide either command behind `|| true`, a pipeline, a generic timeout increase, or a wrapper that
changes its exit status.

Before comparing build modes or clearing generated output, first inspect the lock owner:

```bash
if [ -e .next/lock ]; then
  lsof .next/lock
else
  echo "No .next lock is present."
fi
```

On systems without `lsof`, use the platform-equivalent open-file inspection such as
`fuser -v .next/lock`. Never delete `.next` while that check identifies an active build owner. Only
after the build has exited or no lock/owner is present may the cache be cleared:

```bash
rm -rf .next
```

Silence by itself does not establish a stalled build. Preserve the last build output and collect at
least two observations of the same lock-owning PID: its elapsed time, CPU activity, child processes,
and whether `.next` receives new writes between observations. A build is conclusively stalled only
when those observations show no progress as well as no active child work. After that evidence is
recorded, a developer may recover the identified process manually; automation must not kill it.

Restore Turbopack as the mandatory production gate only after repeated clean builds across the
affected worktrees and CI complete without stalls. That restoration must change `build`, CI, and this
policy together, while retaining `build:webpack` as a diagnostic fallback until the stability change
is accepted.

## 10. Review workflow

1. Open or update the single PR for the task.
2. Allow one automatic Codex review.
3. Collect all findings.
4. Fix every valid finding once in one focused pass.
5. Run focused validation once.
6. Push and stop.
7. Do not request a second review.
8. Merge when CI is green and the PR is mergeable.

Do not continuously watch CI or create follow-up tasks after completion.

## 11. Integration readiness checklist

- One canonical `StorefrontSnapshot` remains the generation, editor, preview, save and publish IR.
- Capability knowledge is generated from live contracts; no parallel hand-maintained registry.
- Initial-generation and follow-up-editing Skill packages have distinct permissions and evidence.
- No Puck imports outside its adapter.
- No provider-specific types in canonical modules.
- No duplicate product, variant or option model.
- Canonical commerce values are read-only.
- Public source data has provenance and lower trust than Vesko data.
- Components use typed bindings and canonical IDs.
- Same components render in editor, preview and published routes.
- Dynamic PDP preserves every option group and resolver rule.
- Failed/rejected/stale proposals preserve draft and history.
- Save draft and publish remain separate.
- Merchant UI exposes no developer internals.
- Adapter interfaces have standalone fixtures and conformance tests.

## 12. Teammate handoff package

Before Vesko integration, deliver:

- authoritative SDD and ADRs;
- schema/type package with versions;
- component and page-blueprint manifests;
- project, commerce, media, source, storage, provider and publishing adapters;
- Karvonen, watch and complex-ring reference fixtures;
- conformance tests;
- environment and deployment runbook;
- mapping from Veskify contracts to Vesko services;
- unresolved decisions and ownership table.

## 13. Completion report

Report:

- merchant outcome;
- commit SHA and PR;
- changed modules;
- focused tests and totals;
- typecheck/lint/format status;
- known limitations;
- confirmation that no rebase, duplicate PR, second review request or unrelated validation was performed.

Then stop.

## P10B-18B-06 accepted bounded-authority note

Current generated presentation selection must use the single approved-asset placement authority.
Resolve exact assets only after profile, variant, component slot, page/shared-frame context, and
collection identity are known. Persist approved asset ID/revision/material/provenance plus exact
purpose, reuse policy, affinity, and responsive pair IDs; never persist raw Puck media state.

Current responsive-image output is `1.1.0`; historical `1.0.0` remains readable. A physical mobile
source is used only when an approved paired source exists. Diagnostics must keep source change and
treatment change separate. Presentation selection must reject protected product-media roles.

P10B-18B-06 is **Baseline**, accepted by the product owner on 17 August 2026 for this bounded
authority only. Do not infer complete-storefront commercial visual acceptance: retained whitespace,
homepage-composition, merchandising-rhythm and section-hierarchy work belongs to
P10B-18B-02/03/04/05. P10B-18B-02 was subsequently accepted on 18 August 2026.

## P10B-18B-02 accepted homepage-quality note

Homepage plans must use the existing executable profile and component-slot authority. Preserve each
slot's explicit transition intent from semantic resolution through synthesis, planner output,
snapshot materialization and the shared renderer; do not infer hierarchy from CSS order alone or
create a second recipe/page representation.

Story/catalogue balance is a compound homepage-profile driver. Asset-dependent campaign and
editorial regions must fail closed or collapse cleanly when approved P10B-18B-06 authority is
absent. Canonical product cards and commerce bindings remain the only merchandising truth.

P10B-18B-02 is **Baseline**, accepted by the product owner on 18 August 2026 for bounded
homepage/editorial/campaign quality only. Collection/search/product-card, PDP, content/utility and
complete-storefront designer-grade quality remain unaccepted. The exact next task is
**P10B-18B-03 — Collection / Search / Product-card Quality Upgrade**.

## P10B-18B-03 accepted collection/search/card-quality note

Collection and search work must preserve one `PageBlueprint`, dynamic renderer, canonical catalogue,
canonical card authority and transient read-only search adapter. Derive `micro`/`small`/`medium`/
`dense` only as presentation state. Never persist it, duplicate products, rewrite membership/order
or turn filtered results into a second catalogue.

Facet presentation must suppress ineffective unselected choices while retaining selected active
facets. Editorial/campaign profiles remain collection-only; comparison/dense may execute for search.
Search output must show query/result/filter/sort identity and must not fabricate collection identity,
suggestions or campaign claims. Provider capability text may describe only bounded canonical
transient query/results; it must not imply AI, semantic, vector, fuzzy, personalized or Vesko search.

P10B-18B-03 is **Baseline**, accepted by the product owner on 18 August 2026 for bounded collection,
search-results and canonical card quality only. P10B-18B-04 is **Baseline**, accepted on 19 August
2026 for bounded PDP quality. Content/utility quality remains unaccepted; parent
P10B-18B/P10B-18/P10B remain Partial. The exact next task is
**P10B-18B-05 — Content / Support / Utilities Quality Upgrade**.

## P10B-18B-04 accepted quality note

The candidate keeps the four P10B-11 profiles and the single dynamic PDP renderer. Local proof uses
`playwright.p10b-18b-04.config.ts` for 20 bounded captures and
`tests/unit/p10b-18b-04-pdp-quality.test.ts` for exact product-context matching. The production-
disabled proof route still executes the normal plan, snapshot, catalogue adapter, canonical resolver
and renderer. It does not call providers, Vesko, generation endpoints or publication. The product
owner accepted this package as Baseline on 19 August 2026. Parent P10B-18B/P10B-18/P10B remain
Partial at that checkpoint, with P10B-18B-05 as its historical handoff. P10B-18B-05 was
subsequently accepted on 20 August 2026.

### P10B-18B-05 accepted validation scope

For the uncommitted P10B-18B-05 candidate, use the focused P10B-12/P10B-13 unit and browser suites,
the dedicated `p10b-18b-05-content-support-utilities-quality` unit/Playwright matrices, focused fact,
asset, lifecycle and frozen P10B-18A tests, then typecheck, targeted ESLint/Prettier, docs validation,
Webpack and storefront budgets. Do not run complete Vitest, commit, push or open a PR before the
mandatory product-owner checkpoint. That checkpoint was accepted on 20 August 2026; complete
one-worker Vitest ran exactly once, its three retained findings were corrected through focused
reruns, and the listed retained browser/lifecycle/compiler regressions are green. Utility runtime
state is test-only transient input and must not be serialized into a storefront fixture.

### P10B-18C durable validation scope after P10B-16P-05B

Use the exact 126-case deterministic matrix and replay, frozen 72-case regression, protected
commerce/media, semantic-causality, topology and duplicate reports as the durable machine gate.
Use the retained P10B-18A and P10B-17 browser suites for representative complete-store,
responsive, accessibility and performance regression. The accepted historical 280-capture result
remains in the quality audit and merged PR history; do not recreate its retired production-capture
application during normal development.

### P10B-16P-05B current cleanup boundary

The repository keeps one normal initial-generation provider/compiler/materializer path, the P03
mocked Studio lifecycle, one lean P04 mock/live acceptance seam for P10B-18D, governed P9 follow-up,
and focused migration/publication compatibility. Normal production cannot enable local P04
acceptance. No removed P10B-18C capture configuration is part of active tooling or CI.

P10B-18C and P10B-16P-05B are Baseline. P10B-18D is a Baseline diagnostic with live commercial
quality rejected. P10B-19 PRE is Baseline. P10B-19A-01 through P10B-19A-07 and P10B-19A-08A
through P10B-19A-08C are Baseline; parent P10B-19A-08 is Baseline / closed. P10B-19A-09A is
Baseline; parent P10B-19A-09 and P10B-19A remain Partial. P10B-19A-09B is the exact next
implementation task; P10B-19A-09C is Planned after A-09B; P10B-19A-10 remains Planned after
A-09C; P10B-19B through P10B-19J remain Planned. P10B remains Partial.

### P10B-18D diagnostic handoff

Do not treat the P10B-18D six-call experiment as an accepted live-generation quality baseline. The
provider-to-proposal mechanics ran under a strict bounded call policy, but only Concepts 3, 4 and 5
met prompt fidelity. Concepts 2 and 6 collapsed to the same exact StorefrontSnapshot and structural
authority; dark merchant-wide foundations and bold asymmetry remain underexpressed.

Do not retry, repair or special-case those generated concepts. Use retained zero-call deterministic
and mocked regressions for maintenance. Do not place raw provider output, acceptance tokens,
credentials or live screenshots in the repository. Any future real-call activity requires its own
explicit task authority.

`P10B-19 PRE - Structural Design Intelligence Architecture Lock` is Baseline. It defines, but does
not implement, authority for structural storefront families, PageBlueprint v2, Visual Recipe v2,
multi-concept generation and screenshot-based refinement. P10B-19A-01 through P10B-19A-07 and
P10B-19A-08A through P10B-19A-08C are Baseline; parent P10B-19A-08 is Baseline / closed.
P10B-19A-09A is Baseline; parent P10B-19A-09 and P10B-19A remain Partial. P10B-19A-09B is the
exact next implementation task; P10B-19A-09C is Planned after A-09B; P10B-19A-10 remains Planned
after A-09C; P10B-19B through P10B-19J remain Planned, and P10B remains Partial.

## Implementing the accepted P10B-19 architecture

P10B-19 PRE is Baseline. P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C
are Baseline; parent P10B-19A-08 is Baseline / closed. P10B-19A-09A is Baseline; parent
P10B-19A-09 and P10B-19A remain Partial. P10B-19A-09B is the exact next implementation task,
P10B-19A-09C is Planned after A-09B, and P10B-19A-10 remains Planned after A-09C. Do not
implement later P10B-19 packages
on an earlier child branch.

P10B-19 implementation must preserve these rules:

- one canonical page graph and one `StorefrontSnapshot`;
- Structural Storefront Families are registered merchant-neutral composition authority, not themes
  or another page model;
- PageBlueprint v2 extends the existing executable page-composition registry;
- Visual Recipe provider output is transient and non-executable; exact values compile into
  canonical BrandSystem / Design DNA v2;
- providers never own component IDs, routes, commerce, assets, persistence, publication, CSS, HTML,
  or React;
- exact realization continues through the deterministic compiler/coordinator and sole
  materializer;
- Puck remains a controlled projection/editor boundary;
- v1 snapshots, profiles, Design DNA, history, Preview, and publication remain compatible;
- one child task owns one contract or one meaningful visual family on one page family;
- every meaningful visual family receives a bounded product-owner screenshot checkpoint;
- deterministic mocks are the default, and real provider calls are reserved for explicitly
  authorized P10B-19J acceptance.

The binding architecture and 73-child plan are in
`docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md`. P10B remains Partial.

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
- P10B-19A-09 = Partial
- P10B-19A-09B = exact next implementation task
- P10B-19A-09C = Planned after P10B-19A-09B
- P10B-19A-10 = Planned after P10B-19A-09C
- P10B-19A = Partial
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
`pnpm exec playwright merge-reports`. DEVX-01F2 locks the accepted three-shard Vitest plan in
`scripts/vitest-ci-plan.v1.json` and audits it through `node scripts/vitest-ci.mjs audit-plan`.
CI emits only bounded shard IDs, retains `--maxWorkers=1` and `--no-file-parallelism` per row, then
rejects incomplete shard manifests or blobs before `pnpm exec vitest --merge-reports` and one safe
merged-result projection. DEVX-01G closes two-run performance acceptance and workflow authority.
The closure wording becomes canonical only after the final Run B gate passes and this task merges;
no CI execution authority changes in DEVX-01G.

### Playwright CI timing operations

Use `node scripts/playwright-ci.mjs audit` to validate the exact enabled suite inventory without
launching browsers. `pnpm test:e2e` executes that inventory serially. CI sets
`PLAYWRIGHT_CI_TIMING_OUTPUT_DIRECTORY`, then runs `summarize` with the browser job status and
`plan` only after a complete successful run. The summary reports suite duration, median, relative
share, slowest-first order, and an exact unmeasured suffix after failure. Group planning uses stable
longest-processing-time assignment with canonical-order/ID tie-breaking for 2–6 future groups.

Timing artifacts never contain command output, environment values, screenshots, traces, test
reports, tokens, or credentials. Playwright configs retain their own retries, reporters, workers,
ports, web servers, and output behavior. Future parallel groups must execute on isolated GitHub
runners because repository-local build output and default ports are not safe shared-runner
authority.
