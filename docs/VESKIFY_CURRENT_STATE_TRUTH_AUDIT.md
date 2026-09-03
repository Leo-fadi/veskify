# Veskify Current-State Truth Audit

**Audit date:** 3 September 2026

**Repository baseline:** P10B-19A-10A Retained Matrix Inventory and Frozen Baseline Lock

**Scope:** code-grounded current-truth record synchronized through the completed P10B-19A-10A
baseline while retaining the P10B-18D live commercial-quality rejection

## 1. Audit contract

This document is a point-in-time account of the repository, not a new product specification. It
uses the implementation statuses **Baseline**, **Partial**, **Planned**, **Deprecated**, and
**Blocked** exactly as defined in the task that commissioned the audit. Evidence is classified
separately as contract/schema, deterministic unit, integration, browser/E2E, real-provider,
retained human visual review, Vesko staging, or production.

The companion [capability evidence ledger](./VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md) records the
complete capability chain. A **Baseline** claim in either document is bounded to its stated outcome;
for example, safe deterministic dynamic-PDP rendering can be Baseline while commercially
differentiated PDP design remains Partial. Deterministic or fixture evidence is never promoted to
real-provider, human visual, Vesko staging, or production evidence.

Implementation and tests take precedence here over stale phase prose. Historical records are used
only for the event or evidence they actually retain. PR titles were corroborated against merged
source and tests rather than treated as proof by themselves.

## 2. Executive truth

Veskify is a substantial controlled storefront-design engine and a capable standalone engineering
environment. It is not yet a production Vesko Storefront Studio product.

The repository genuinely has:

- one validated canonical editable aggregate, `StorefrontSnapshot`, with `BrandSystem`, navigation,
  pages, sections, revisions, history, and deterministic content fingerprints;
- a controlled component platform, executable PageBlueprint profiles, a generated queryable
  capability manifest, renderer-conformance reporting, and reusable home, collection, and PDP
  rendering;
- deterministic initial-generation and follow-up authorities, strict scope routing, coordinated
  proposal compilation, atomic review/accept/undo/redo, draft persistence, preview, history, restore,
  and explicit publication contracts;
- one canonical Storefront Studio whole-storefront initial-generation path that sends one exact
  prompt through server-reloaded Design Intent V2, deterministic semantic compatibility resolution,
  one exact decision, and the sole executor/materialization boundary, then binds
  the exact P02B source-proposal fingerprint and compiler lineage in one registered structural
  operation before isolated proposal review, reject/accept, undo/redo, evidence-preserving
  save/reload, and dynamic-route preview;
- bounded P10B-17 responsive, accessibility, and performance closure for current registered
  storefront authority across 375, 768, 1024, and 1440 px, EN/FI, three materially distinct
  coordinated directions, canonical search, and proposal/saved/published renderer equivalence;
- an accepted P10B-18A commercial-authority audit: 72 deterministic current-authority cases plus
  retained full-resolution human review of 18 stores/108 home, collection and PDP captures, with
  exact ceiling ownership and unchanged protected commerce/media;
- an accepted P10B-18B-01 Design DNA and shared-frame upgrade: six materially consumed non-colour
  DNA bundles across the three coordinated directions, all four complete-store frame families, 36
  normalized topologies, and 17 retained focused captures with unchanged protected commerce/media;
- an accepted P10B-18B-06 bounded asset-composition and art-direction upgrade: exact purpose
  affinity, explicit reuse limits, paired approved responsive sources/crops, one shared-frame logo
  consumer, and 13 retained captures with protected product media unchanged;
- an accepted P10B-18B-02 homepage/editorial/campaign quality upgrade: explicit profile transition
  authority, truthful compound story/catalogue causality, asset-aware rich/sparse progression, 38
  normalized same-strata topologies, and 14 retained captures with protected commerce/media intact;
- an accepted P10B-18B-03 collection/search/product-card quality upgrade: deterministic
  micro/small/medium/dense presentation, useful facet/filter hierarchy, four distinct profile
  purposes, five strengthened canonical card anatomies, two executable search presentations, 39
  normalized same-strata topologies, and 21 retained captures with protected commerce/media intact;
- server-only OpenAI and public-source adapters, strict Vesko integration ports, standalone
  adapters, and endpoint-neutral staging adapters; and
- a deterministic publish compiler enforced before the existing authoritative publish command in
  the configured server gateway.

The repository does not yet have:

- the P10A governed router and package integrations wired into the normal merchant editor flow;
- accepted live-AI commercial storefront quality after the rejected P10B-18D diagnostic;
- a merchant-connected URL discovery and approval journey using the bounded public adapter;
- real Vesko API clients, a documented authentication protocol, production storage/deployment,
  or production evidence.

The truthful overall product status is therefore **Partial**. The canonical engine, many local
lifecycles, bounded P10B-18A diagnosis, and completed P10B-18B-01/06/02/03/04/05 package are
Baseline. P10B-18C deterministic commercial-quality/diversity acceptance is also Baseline. Merchant
delivery, accepted live-AI commercial quality, Vesko environment wiring, and production operation
are not. P10B-19 PRE, P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C
are Baseline; parent P10B-19A-08 is Baseline / closed. P10B-19A-09A, P10B-19A-09B,
P10B-19A-09C and P10B-19A-10A are Baseline; parent P10B-19A-09 is Baseline / closed. Parent
P10B-19A-10 and P10B-19A remain Partial, P10B-19A-10B is the exact next implementation task,
A-10C is Planned after it, P10B-19B-01 is Planned after A-10C, and P10B remains Partial.

## 3. Mission and product boundary

The stable mission is to remove storefront composition and visual-design burden from Vesko
onboarding. A merchant should be able to reuse existing website evidence and approved assets,
combine them with read-only canonical Vesko commerce, approve a design direction, generate a
coherent storefront, request bounded changes, review them, save, preview, publish explicitly, and
restore history.

The merchant-facing product is **Vesko Storefront Studio**. **Veskify** is normally hidden as the
controlled design engine. Puck and the configured model provider are implementation details.

Veskify owns presentation authority: storefront composition, brand tokens, registered variants,
PageBlueprint profiles, structured operations, proposals, snapshots, history, source evidence,
approved presentation assets, and publishing preparation. Vesko owns operational commerce and
sellability: products, collections, product types, variants, option values and dependencies, SKUs,
prices, stock, availability, canonical media relationships, checkout, orders, payments, shipping,
taxes, and inventory.

The implementation substantially enforces this boundary through read-only catalogue and product
projections, protected-path validation, proposal replay, asset provenance checks, and publish-time
compilation. It must not be described as a catalogue manager, unrestricted site/code generator, or
production commerce service.

## 4. Current architecture

### 4.1 Canonical state

`src/domain/storefront/storefront.ts` defines the canonical `StorefrontSnapshot`, `PageModel`,
`SectionInstance`, and navigation schemas. `src/domain/storefront/canonical-storefront.ts` provides
stable canonical serialization, equality, and content fingerprints. `BrandSystem` is stored inside
the snapshot and projected to controlled CSS variables.

The canonical path is:

```text
approved inputs and read-only commerce
  -> registered capability and PageBlueprint authority
  -> structured plan and operations
  -> validated proposal
  -> accepted StorefrontSnapshot
  -> draft save / preview / history
  -> explicit authoritative publication
```

Provider DTOs, whole-store planning state, proposal projections, PageBlueprint materializations,
Puck data, and compiled publication results are transient. None is a second editable storefront
aggregate.

### 4.2 Components, profiles, and renderers

The current V2 component registry is assembled from adapted legacy components, native
`dynamicCollectionCommerce`, native `dynamicProductDetail`, and six native homepage-commerce
families. The generated capability manifest is a frozen in-memory projection of the live V2
registry and ten executable profiles: three home, three collection, three product, and one shared
frame profile.

P10A-04C made the six native homepage families canonical `SectionInstance`/Puck capabilities.
Whole-storefront generation materializes native dynamic collection and PDP instances rather than
storing their legacy composite subslots as parallel runtime authorities.

The current conformance suite still deliberately reports 16 blocking defects, 25 renderer-version
metadata gaps, and one future migration item while reporting zero commercial gaps. This is
important drift from the original P10A-04B prose, which records the earlier 19-blocker baseline.
The report is useful evidence because it exposes ownership and binding differences instead of
claiming perfect parity.

### 4.3 Puck and the editor

Direct `@puckeditor/core` imports are confined to `src/integrations/puck`. Canonical pages are
mapped into transient Puck data and validated back into canonical pages. The editor supports page
and locale context, section selection, registered fields and variants, visibility and duplication
commands, device modes, AI proposal review, storefront undo/redo, Save draft, preview links, and
history.

The current merchant editor does not call `routeGovernedDesignRequest`,
`executeGovernedInitialGeneration`, or `executeGovernedFollowUpEditing`. Selected-section,
current-page, homepage-only, frame/design-system, clarification, and other follow-up scopes still use
their existing bounded/legacy proposal authorities, while normal initial entire-storefront
generation now uses the P10B-16P-03/P10B-16P-05A prompted Design Intent V2 path. P10A skills/router
therefore remain real but internal-only authorities rather than the merchant-facing
initial-generation path.

P10B-16P-05A removes the active P10B-16L executable-intent routes/providers/runtime and makes
P9/Lumo live generation isolated Deprecated historical, production-disabled authority. Required
neutral migration/publication fixtures and historical evidence remain; P10B-16P-05B owns final
consumer-verified cleanup after P10B-18C. The P10B-16P-04 acceptance composition is the lean production-disabled mock/live seam retained for P10B-18D.

### 4.4 Persistence and publication

Normal standalone projects use browser IndexedDB. Save, publish, and restore create validated
snapshot identities and preserve history. The active publish UI now sends only bounded prepare and
confirm requests to the same-origin server gateway; it cannot publish directly through IndexedDB.

The configured server gateway remains a protected non-production local composition. Without that
explicit configuration, the route fails closed. Within that bounded composition, authoritative
proposal acceptance now mints and durably retains one exact accepted-snapshot receipt; later
canonical client mutation invalidates that receipt rather than silently publishing an older
accepted snapshot.

Preparation and confirmation independently resolve current authority and deterministically compile.
One atomic repository transaction persists the published snapshot, immutable compiled artifact,
append-only version/history, operation, and active pointer. Restore creates a new draft without
moving the live pointer; a later explicit republish creates a fresh artifact and version.

## 5. Development history that remains technically relevant

The repository evolved through additive convergence rather than a clean replacement:

1. Early phases established the canonical snapshot, registered storefront rendering, isolated Puck
   editor, deterministic proposal lifecycle, browser persistence, and explicit publication.
2. P5-P7 added ComponentDefinitionV2, dynamic options/PDP/collection presentation, source evidence,
   asset review, design briefs, and URL workflow contracts.
3. P8-P9 added whole-store planning, OpenAI adapters, atomic multi-page proposals, realistic
   fixtures, protected local-demo routing, and deterministic browser lifecycle evidence.
4. Phase 9 was closed by explicit product-owner handoff after PR #134 despite older SDD, roadmap,
   README, and evidence-matrix language still describing it as active. The closeout preserves
   controlled-generation correctness but moves commercial depth forward; it does not retroactively
   create the missing full visual evidence matrix.
5. P10A PRs #140-#155 established executable profiles, generated capability knowledge, governed
   package contracts, initial/follow-up integrations, strict routing, evaluation/review protocols,
   and the safely fail-closed precursor to controlled acceptance.
6. PRs #159, #161-#163, #167-#170 completed accepted-snapshot receipt wiring, the active
   authoritative gateway, deterministic publication compilation, atomic artifacts/versions and
   active-pointer authority, rollback/republish, exact published collection/PDP propagation, and
   correlated manual/accepted-AI publication evidence. PR #168 retained the successful ordered
   two-call real-provider acceptance.
7. P10B-16P-04 proved real semantic A/B/C Studio generation and the Prompt C lifecycle;
   P10B-16P-05A then rationalised that behavior into one normal initial-generation composition and
   one coordinator/resolver/exact-decision/executor chain, removed the active P10B-16L runtime, and
   isolated historical P9/Lumo live generation without removing required migration/publication
   evidence.
8. P10B-16P-06 made `/search` a canonical transient query/results route across draft, proposal,
   saved/history, and published renderers. P10B-17 then closed its bounded four-width EN/FI
   responsive, accessibility, and performance outcome with retained A/B/C visual evidence, derived
   immutable indexes/projections, explicit runtime/build bounds, renderer equivalence, and protected
   commerce/media parity.

The old page proposal system, legacy V1 registry bridge, `StorefrontDesignSystemV1` direction
material, and new P10A authorities currently coexist. Some coexistence is intentional migration;
some is documentation and reachability debt that v1.3.0 must name rather than obscure.

## 6. Merchant reachability

| Merchant capability                                              | Status       | Current truth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open and edit seeded/local storefronts                           | **Baseline** | Browser routes load canonical snapshots; Puck fields and bounded section commands update unsaved canonical draft state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Start a project from minimal inputs                              | **Baseline** | The onboarding wizard persists a session, builds a deterministic guided plan/review, and creates a local project for demo or empty catalogue modes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Connect an existing Vesko catalogue during onboarding            | **Partial**  | The UI can select the intent, but project creation intentionally stops because no authoritative Vesko catalogue source is wired.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Discover a public storefront URL and approve reconciled evidence | **Partial**  | Secure adapter and URL-to-brief lifecycle exist, but the normal onboarding UI does not invoke the public server adapter as a complete merchant journey.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Generate an initial storefront                                   | **Partial**  | Normal local Studio reaches one canonical trusted server-owned semantic Design Intent route, deterministic exact complete-store compilation, the sole prompted executor/materialization boundary, and an isolated proposal from an approved raw project. P10B-16P-04 adds separately authorized real OpenAI A/B/C evidence through a production-disabled Aurum acceptance composition: one materialization per successful prompt, clean A/B rejection, and C Accept/Undo/Redo/Save/reload/Preview. P10B-16P-05A removes the active executable-intent/P10B-16L alternative and isolates P9/Lumo live generation as historical. P10B-17 adds bounded four-width responsive, accessibility, performance, search, renderer-equivalence, and retained visual evidence. Accepted P10B-18A adds the deterministic 72-case and 18-store/108-capture ceiling diagnosis. Accepted P10B-18B-01/06/02/03/04/05 complete bounded Design DNA/frame, asset, homepage, collection/search/card, PDP, and content/support/utility quality with protected authority unchanged. Accepted P10B-18C adds deterministic 126-case compile/replay and hash-bound 280-capture quality/diversity acceptance. One registered operation binds exact compiler lineage; snapshot evidence remains provenance and never self-authorizes. General production authentication/authority remains absent; P10B-18D retained a bounded live diagnostic whose commercial quality was rejected. |
| Request AI design changes                                        | **Partial**  | The editor exposes section/page/storefront prompts and proposal review; the strict P10A router and governed packages are internal-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Review, accept/reject, undo/redo                                 | **Baseline** | Page and whole-store proposal lifecycles are merchant-accessible; whole-store acceptance is atomic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Save and reload a draft                                          | **Baseline** | IndexedDB local flow is reachable and tested; Vesko durable persistence is an adapter seam, not an active environment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Preview home, collection, and PDP                                | **Baseline** | Routes select canonical draft/published/history snapshots and render protected commerce through route adapters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Search canonical storefront products                             | **Baseline** | One persisted `/search` presentation archetype is executable in draft, proposal, saved/history, and published storefront routes through transient EN/FI query/results from the standalone current `CatalogueDisplayModel`. Exact product links use current dynamic PDP routes; query, filters, sort, page, result IDs, and result count are not persisted. This does not claim a Vesko search endpoint, AI/semantic/fuzzy search, recommendations, or analytics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Publish explicitly                                               | **Partial**  | UI and server gateway exist, but the active server composition is protected local-demo-only. General standalone and production authority are not configured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Publish accepted AI lineage                                      | **Partial**  | The protected local server composition completes authoritative acceptance, durable receipt, independent preparation/confirmation resolution, atomic publication, and browser evidence. General merchant/Vesko/production reach remains absent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Restore history                                                  | **Baseline** | Local history and restore routes operate on immutable snapshots and preserve published state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Use Vesko staging or production                                  | **Blocked**  | Audited endpoint surfaces exist, but security/store authority, typed responses, revisions, navigation/synchronization, canonical persistence/publication APIs, deployment, and retained environment evidence remain absent or insufficient.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## 7. Evidence truth

### 7.1 What is proved

- Contract/schema and deterministic unit evidence is broad across canonical models, registries,
  PageBlueprints, skills, routing, protected operations, acceptance, persistence, publishing, and
  the compiler.
- Integration evidence covers onboarding, generation, proposal lifecycle, editor routes, dynamic
  commerce routes, save/reload, history, publishing, and published target propagation.
- Browser/E2E evidence covers the local merchant shell, editor/proposal interactions, onboarding,
  history/restore, publish confirmation, and the bounded P10B-17 A/B/C matrix across 375, 768, 1024,
  and 1440 px, EN/FI, home/collection/search/simple and configurable PDP/content/cart surfaces,
  keyboard/focus/mobile-menu/reduced-motion/touch geometry, layout stability, protected-state
  parity, and proposal/saved/published renderer equivalence.
- Real-provider evidence remains narrow. P9R-07 retains a historical manually reviewed OpenAI
  design-system-only change. P10A-07C-03R retains one successful governed initial-generation case
  before one successful exact hero follow-up case through the current package/router authority,
  with two total calls, zero retry, protected-state parity, and no save or publication.
- P10B-16P-04 retains bounded real-provider A/B/C semantic-intent and complete-storefront evidence.
  P10B-17 uses the same production-disabled deterministic acceptance authority for its responsive,
  accessibility, performance, and renderer-equivalence evidence and makes zero provider calls.
- P10B-18A retains a reproducible 72-case current-authority matrix and a clean 18-store/108-capture
  browser manifest covering home, largest truthful collection and representative PDP at 375/1440.
  Human inspection records exact strongest/typical/weak cases, same-topology/different-intent
  collapse witnesses, source/fixture versus compatibility/renderer causes, 108/108 complete images,
  unchanged protected commerce/media in 18/18 stores and zero provider, Vesko or publication call.
- P10B-18B-01 retains the same nine-by-eight strata after the accepted upgrade: six materially
  consumed DNA bundles, all four frame families, 36 topologies, exact compatibility funnels, and a
  17-capture browser manifest covering focused DNA/frame, navigation/footer, persistence, and
  renderer authority. It made zero external/provider/Vesko/browser generation-endpoint/publication
  calls; deterministic store materialization still ran in-process.
- Retained human visual review now includes the bounded P10B-16P-04 A/B/C product-owner evidence and
  the P10B-17 representative coordinated-direction matrix correlated to its automated four-width
  EN/FI evidence, the accepted P10B-18A commercial-ceiling review, and accepted P10B-18B-01 focused
  DNA/frame review. These remain bounded inputs to the later accepted P10B-18B and P10B-18C
  deterministic commercial-quality baselines.

### 7.2 What is not proved

There is no Vesko staging or production evidence. Accepted P10B-18A, P10B-18B and P10B-18C prove
bounded deterministic commercial authority and quality. P10B-18D adds diagnostic live evidence but
not accepted live commercial quality, production performance, or real-user operations. Their deterministic and browser evidence is not
additional real-provider evidence, and retained visual inspection is not a production-readiness
verdict. The P10A controlled-provider evidence does not prove Vesko connectivity or production
operation.

## 8. P10A closure verdict

P10A is **Baseline / closed**. The explicit 20-item exit audit, merged capability inventory,
requirement traceability, provider evidence, publication evidence, protected-state verdict, and
deferred ownership are recorded in [`P10A_PHASE_CLOSURE.md`](P10A_PHASE_CLOSURE.md). No required
P10A exit item remains Partial or Blocked.

P10B — Commercial Storefront Generation System v1 is the active development phase and remains
**Partial**. P10B-16P-03 provides its normal mocked initial-generation Studio journey,
P10B-16P-04 provides accepted real V2 A/B/C evidence, P10B-16P-05A provides one rationalised normal
path and compiler/materialization boundary, and P10B-16P-06 provides the standalone canonical
search query/results adapter at **Baseline** for their bounded outcomes. P10B-17 is also
**Baseline** for its bounded responsive, accessibility, performance, and retained evidence outcome.
P10B-18A is **Baseline**, accepted on 16 August 2026 for its bounded commercial-authority audit;
P10B-18B-01 is **Baseline**, accepted on 17 August 2026 for its bounded Design DNA/shared-frame
upgrade. P10B-18B-06 is **Baseline**, accepted on 17 August 2026 for its bounded asset-composition
authority. Accepted P10B-18B-02 closes bounded homepage/editorial/campaign quality and accepted
P10B-18B-03 closes bounded collection/search/product-card quality. P10B-18B-04 closes bounded PDP
quality, and P10B-18B-05 closes bounded content/support/utility quality. Parent P10B-18B is
**Baseline / complete**; P10B-18C and P10B-16P-05B are **Baseline**. P10B-18D is a Baseline
diagnostic with live commercial quality rejected. P10B-18 and P10B remain **Partial**. P10B-19 PRE,
P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are Baseline; parent
P10B-19A-08 is Baseline / closed. P10B-19A-09A, P10B-19A-09B, P10B-19A-09C and
P10B-19A-10A are Baseline; parent P10B-19A-09 is Baseline / closed. Parent P10B-19A-10 and
P10B-19A remain Partial, and P10B-19A-10B is the exact next implementation task. P10A does not
require another registry, proposal
model, recipe engine, component system, provider, publish command, or merchant editor integration.

### Decided P10A/P10C editor boundary

Governed initial generation, governed follow-up execution, package authority, strict routing, the
proposal lifecycle, and their internal functional evidence are closed P10A authorities.
Merchant-facing controls are not a P10A closure requirement.

P10C owns connecting the normal Storefront Studio UI to those authorities, including merchant-facing
routing, clarification UI, frame/page scope controls, and scoped execution through the editor. That
ownership is an existing binding architecture decision, not an open phase-boundary choice.

## 9. Commercial storefront quality ceiling and viable path

The historical pre-implementation P10B capability audit identified a competent catalogue
storefront with limited brand distinction, narrow commerce-page variation, precursor brand tokens,
and duplicated product-card presentation. That ceiling is preserved as historical evidence, not
current repository truth. P10B-02 through P10B-16 subsequently established bounded cross-page
Design DNA, meaningful registered anatomy, complete page-family/profile authority, approved
art-direction metadata, the singleton product-card authority, a complete Premium Editorial slice,
bounded synthesis, and three coordinated direction packages. P10B-16P-01 through P10B-16P-06 then
converged dynamic routes, semantic prompt compilation, the normal Studio journey, one active
materialization path, and canonical transient search.

P10B-17 closes the bounded non-functional execution of that current authority: A/B/C registered
output has correlated four-width EN/FI responsive behavior, accessibility interaction coverage,
performance counts and production-build bounds, retained human inspection, canonical search, and
renderer equivalence. Accepted P10B-18A then measures the actual commercial ceiling across 72
deterministic cases and 18 stores/108 captures. It proves three coarse cross-direction packages but
also shows fixed-backbone semantic under-consumption, one rendered DNA per direction, compatibility-
blocked technical authority, source/evidence-poor placeholder/dead-space defects and within-
direction topology collapse. Accepted P10B-18B-01 corrects the audited density/frame under-
consumption and shared-frame defects without changing DNA/frame schema identity: the same strata
now produce six non-colour DNA bundles, all four frames, and 36 topologies. Source/evidence and
asset-composition work remains; designer-grade acceptance is still unproved.

The locked commercial path is therefore complete through its first six implementation outcomes:

1. P10B-02 owns bounded cross-page Design DNA in the existing `BrandSystem`;
2. P10B-03 and P10B-06 through P10B-13 own meaningful registered anatomy, frames, content,
   merchandising, dynamic-commerce families, and complete page profiles;
3. P10B-05 owns the complete site map and page-family authority through executable
   `PageBlueprint` profiles and `StorefrontSnapshot`;
4. P10B-04 owns approved responsive art direction without replacing canonical product media;
5. P10B-14 proves the complete Premium Editorial page set across commerce, content/support,
   campaign, search presentation, utility, empty, error, and not-found surfaces; and
6. P10B-15/P10B-16 synthesize compatible registered combinations and reject exact or meaningful
   near duplicates through structural fingerprints.

The deterministic commercial path is accepted through P10B-18C: all 126 complete configurations
compile and replay, protected state is exact, 54 material topologies are reported, and a stable
28-store selector binds the final 280-entry four-width EN/FI review. P10B-18D completed the fresh
live-AI diagnostic with commercial quality rejected. Parent P10B-18 and P10B remain Partial pending
P10B-19; Vesko staging and production readiness remain outside P10B.

The binding plan is
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md).

P10C can then make those proven capabilities merchant-editable. A polished shell before P10B would
improve usability but would not raise the generated storefront quality ceiling.

## 10. Vesko integration seams and unknown requirements

The canonical seams are credible and should be retained:

- merchant/project context and action permissions;
- catalogue/navigation projection;
- availability/options/variants/product-media projection;
- draft save and immutable history restore;
- authoritative publication command and idempotency;
- source discovery, media approval/ingestion, provider routing, and observability ports.

Standalone adapters exercise these contracts with deterministic projects and opaque-like revision
checks. Server-only staging transport, catalogue/navigation, and product-projection adapters also
exist. They are fixture-compatible mappings, not evidence of Vesko connectivity.

The Vesko OpenAPI 3.0 contract has now been obtained and audited in the
[`Vesko OpenAPI Contract Audit`](./VESKO_OPENAPI_CONTRACT_AUDIT.md), with endpoint-to-port and
field-level findings in the
[`Vesko–Veskify Integration Matrix`](./VESKO_VESKIFY_INTEGRATION_MATRIX.md). It establishes real
endpoint surfaces for store context, products, variants, categories, brands, media, inventory, raw
Puck configurations, and storefront product reads. Contract acquisition is complete for this
supplied snapshot; integration sufficiency is not.

Vesko owners must still resolve or supply:

- authoritative staging/production server and base-path selection, typed response schemas, and
  consistent pagination envelopes for the selected operations;
- authentication protocol, credential acquisition/refresh, tenant/environment identity, and
  authorization semantics;
- canonical product-type, option dependency, variant, availability, price, stock, and media field
  mappings, including revision/ETag rules;
- navigation, catalogue hierarchy, localized-field, and merchandising-order mappings;
- durable project/snapshot/history repositories and publication transaction semantics;
- accepted-proposal persistence and publication-receipt ownership;
- media ingestion, derivatives, crop/focal metadata, stable public URLs, and retention policy;
- correlation/revision headers, readiness/health contract, caching, rate limits, timeouts, and
  error mapping;
- deployment, secrets, audit logging, monitoring, backup, recovery, domain activation, and rollback
  ownership.

The audited contract remains insufficient because its response coverage is incomplete, security
declarations are inconsistent, revision/ETag authority is absent, navigation and synchronization
contracts are missing, and it exposes no canonical Veskify draft/history/publication API. Until
those deficiencies are resolved, real staging adapters and production deployment are **Blocked**,
not merely untested.

## 11. Documentation, naming, status, and duplication drift

| Drift                                                                               | Current repository truth                                                                                                                                                                                                                                                                                                                                                                                                               | v1.3.0 action                                                                                                                                                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README and roadmap call Phase 9 active                                              | `P9_CLOSEOUT_RECORD.md` records the explicit post-PR-#134 closeout; later P10A work is merged.                                                                                                                                                                                                                                                                                                                                         | Replace active-Phase-9 narrative while retaining the evidence limitations and historical records.                                                                    |
| Earlier roadmap called P10A planned after Phase 9                                   | All required P10A gates are merged; P10B-18A, completed P10B-18B, P10B-18C, P10B-16P-05B, P10B-19 PRE, P10B-19A-01 through P10B-19A-07, P10B-19A-08A through P10B-19A-08C, P10B-19A-09A through P10B-19A-09C, and P10B-19A-10A are accepted Baselines; parent P10B-19A-08 and parent P10B-19A-09 are Baseline / closed; P10B-18D is a rejected-quality diagnostic Baseline while P10B-18/P10B/P10B-19A and parent A-10 remain Partial. | Keep P10A and parents P10B-19A-08/P10B-19A-09 closed, keep P10B, P10B-19A and parent A-10 Partial, make A-10B exact next, and keep historical records point-in-time. |
| Earlier SDD verified baseline was `4a96a5a`                                         | Current closure baseline is `3d36f54`; significant authority landed afterward.                                                                                                                                                                                                                                                                                                                                                         | Keep the closure baseline current and preserve older hashes only in revision history.                                                                                |
| SDD says deterministic discovery was the only adapter in P7-01                      | A bounded public server adapter exists, but merchant runtime wiring is incomplete.                                                                                                                                                                                                                                                                                                                                                     | Separate adapter implementation from merchant reachability and production service status.                                                                            |
| `StorefrontDesignSystemV1` and executable profiles both describe recipes/directions | PageBlueprint profiles execute; direction material still supplies active planner context.                                                                                                                                                                                                                                                                                                                                              | Name the direction material as transitional bounded selection data and remove duplicated recipe authority through an explicit migration.                             |
| Legacy V1 registry and V2 registry coexist                                          | V1 is still the generic Puck/snapshot bridge; V2 is the capability authority; native dynamic/home components bypass or bridge it.                                                                                                                                                                                                                                                                                                      | Mark the V1 bridge **Deprecated** only where a tested V2 migration path exists; do not delete active compatibility prematurely.                                      |
| P10A-04B document records 19 blockers and six commercial gaps                       | Current test expectation is 16 blockers, 25 metadata gaps, one migration item, zero commercial gaps.                                                                                                                                                                                                                                                                                                                                   | Treat the report output as current and the task document as historical baseline.                                                                                     |
| “Same renderer everywhere” is stated broadly                                        | Shared/native bridges largely preserve implementation identity, but conformance still reports target/ownership drift.                                                                                                                                                                                                                                                                                                                  | Scope parity claims per component and require zero relevant blocking defects before global wording.                                                                  |
| Merchant-facing names include historical P9/P10 labels and Veskify proof routes     | Normal UI says Storefront Studio; active P10B-16L routes are removed and P9/Lumo live generation is isolated historical evidence.                                                                                                                                                                                                                                                                                                      | Keep historical evidence names internal; standardize merchant language only in product surfaces and finish consumer-verified cleanup under P10B-16P-05B.             |
| Authentication/tenancy appear implemented in contract prose                         | They are deterministic/standalone authorities; no production identity system exists.                                                                                                                                                                                                                                                                                                                                                   | Use **Partial** for contracts/adapters and **Blocked** for real environment operation.                                                                               |

## 12. Decisions preserved by the v1.3.0 synchronization

The later synchronization must make or preserve these decisions explicitly:

1. Choose the new verified baseline commit and date and identify historical evidence that remains
   valid without pretending it proves current output.
2. Record Phase 9 as closed by product-owner handoff while preserving its incomplete commercial
   and full-matrix evidence truth.
3. Preserve P10A as Baseline / closed from current internal authority, controlled-provider,
   receipt, compiler, atomic publication, rollback, and final render evidence; track merchant
   reachability under P10C rather than as a P10A closure blocker.
4. Preserve and document the binding phase boundary: P10A owns internal governed execution,
   package and strict-routing authority, proposal lifecycle, and functional evidence; P10C owns
   merchant-facing routing, clarification, frame/page scope controls, and scoped Storefront Studio
   execution. Name the P10C route that must call the strict router without presenting ownership as
   an open architectural choice.
5. Confirm that PageBlueprint profiles are the sole executable recipe authority and define the
   retirement path for duplicated template/direction recipe material.
6. Define the migration policy for the legacy V1 registry/Puck bridge and the exact zero-blocker
   renderer-conformance gate.
7. Separate local standalone, protected local demo, controlled provider, Vesko staging, and
   production claims in every baseline table.
8. Retain the successful ordered P10A-07C-03R current-architecture acceptance separately from the
   historical blocked precursor; do not broaden it into save, publish, or commercial evidence.
9. Preserve server-owned accepted-AI receipt minting, durable create-once storage, and active
   gateway composition.
10. Preserve the immutable compiled artifact, active pointer, history, idempotency, rollback, and
    explicit-republish contracts without making them editable state.
11. Preserve P10A-08D-02 functional publication evidence separately from P10B commercial visual
    evidence.
12. Preserve the locked P10B commercial storefront-generation architecture and 18-task sequence;
    record P10B-01 through P10B-17, P10B-16P-01 through P10B-16P-05A, P10B-16P-06 and accepted
    P10B-18A, completed P10B-18B, P10B-18C and P10B-16P-05B as Baseline; leave P10B-18/P10B
    Partial, record P10B-18D as a rejected-quality diagnostic Baseline, record P10B-19 PRE as an
    accepted architecture Baseline, record P10B-19A-01 through P10B-19A-07 and P10B-19A-08A
    through P10B-19A-08C, P10B-19A-09A through P10B-19A-09C and P10B-19A-10A as Baseline, close
    parent P10B-19A-08 and parent P10B-19A-09, leave parent A-10 and P10B-19A Partial, and make
    P10B-19A-10B the exact next implementation task.
13. Clarify current onboarding: deterministic local project creation is reachable; URL discovery,
    exact approved-brief runtime correlation, and existing Vesko catalogue creation are not one
    complete merchant journey.
14. Replace generic “integration-ready” language with a matrix of port completeness, standalone
    conformance, staging blockers, and production blockers.
15. Assign Vesko API, authentication, persistence, media, publishing, observability, and deployment
    contract owners and required external artifacts.
16. Decide whether EN/FI remains the only supported locale contract for v1.3.0 or becomes an
    explicitly bounded reference implementation.
17. Define what evidence may justify **Baseline** for functional correctness versus commercial
    visual quality, staging readiness, and production readiness.

## 13. Audit boundary confirmation

This synchronization preserves accepted package history and current runtime/evidence truth. Its
validation made no external-provider, Vesko, real-publication, staging, or production request and
did not read environment secrets. P10B-18A and P10B-18B-01/06/02/03/04/05 are Baseline; parent
P10B-18B, P10B-18C and P10B-16P-05B are Baseline, while P10B-18 remains Partial. P10B-18D is a
rejected-quality diagnostic Baseline. P10B-19 PRE, P10B-19A-01 through P10B-19A-07 and
P10B-19A-08A through P10B-19A-08C are Baseline; parent P10B-19A-08 is Baseline / closed.
P10B-19A-09A, P10B-19A-09B, P10B-19A-09C and P10B-19A-10A are Baseline; parent P10B-19A-09 is
Baseline / closed. Parent P10B-19A-10 and P10B-19A remain Partial, and P10B-19A-10B is the exact
next implementation task. P10B remains Partial.
Historical documentation remains historical.

## P10B-18B-06 accepted bounded-authority synchronization

The accepted implementation adds deterministic purpose-affine approved-asset selection, bounded
reuse, exact desktop/mobile source pairing, responsive source/crop/treatment execution, and an
approved shared-header logo consumer with text fallback. It preserves the accepted 72-case
P10B-18B-01 counts (six non-colour DNA outcomes, `27/9/18/18` frame distribution, 36 normalized
topologies), leaves 64 no-asset cases asset-free, and adds 13 focused rich/sparse captures.

This bounded authority is **Baseline**, accepted by the product owner on 17 August 2026. It adds no
provider, Vesko, external image generation, real publication, staging, production, asset-library UI,
page-family redesign, or designer-grade quality claim. The retained page-level whitespace,
homepage-composition, merchandising-rhythm and section-hierarchy problems remain explicitly open;
P10B-18B-02 was subsequently accepted on 18 August 2026.

## P10B-18B-02 accepted homepage-quality synchronization

The accepted implementation retains the six canonical homepage profile IDs and shared renderer,
adds exact transition intent to existing slot plans, makes story/catalogue balance a truthful
compound profile driver, and gives hero, promotion, editorial, proof and merchandising regions
observable rich/sparse hierarchy. Unsupported asset regions collapse through the accepted
P10B-18B-06 authority without placeholders, reserved media or product-media substitution.

The unchanged 72-case audit strata now contain 38 normalized material topologies, 55/72 repeated
memberships, a largest cluster of seven and 17 singletons. Fourteen retained captures include rich
and sparse outcomes plus same-direction Premium, Modern and Warm profile/frame contrasts. Exact
snapshot persistence, Design DNA/frame/profile authority and protected commerce/media are retained;
the evidence ledger records zero external/provider/Vesko/browser generation-endpoint/publication or
runtime-error calls.

This bounded authority is **Baseline**, accepted by the product owner on 18 August 2026. It adds no
provider, Vesko, real publication, staging, production, new page graph, renderer or component
registry. Content/utility commercial quality remains open;
P10B-18B-03 is now Baseline and P10B-18C remains the final designer-grade/100+ gate.

## P10B-18B-03 accepted collection/search/card-quality synchronization

The accepted implementation retains the four collection/search profiles, five canonical card
anatomies and single dynamic renderer. It derives bounded result cardinality for presentation,
suppresses ineffective unselected facets, keeps selected filters operable, and makes editorial,
comparison, campaign and dense purposes visibly distinct. Comparison and dense profiles both
execute through the existing transient P10B-16P-06 search adapter; search exposes explicit query and
result identity without synthetic collection claims.

The unchanged 72 semantic/catalogue strata now contain 39 normalized material topologies, 53/72
repeated memberships, a largest cluster of seven and 19 singletons. Collection distribution is
editorial 35 / dense 27 / comparison 9 / campaign 1; search is dense 63 / comparison 9. Twenty-one
retained captures cover all profiles, card anatomies, directions, responsive widths and zero/one/
multiple-result search with exact persistence and protected commerce/media parity.

This bounded authority is **Baseline**, accepted by the product owner on 18 August 2026. It adds no
provider schema, provider/Vesko call, new search/card/filter/catalogue authority, real publication,
staging or production claim. Its historical handoff was P10B-18B-04, followed by P10B-18B-05.

## P10B-18B-04 accepted synchronization

The accepted bounded PDP package provides exact per-product
configuration/media/decision-support matching, four strengthened existing PDP anatomies, a
resolver-derived configuration summary, bounded media, cardinality-aware related merchandising and
failure-disabled purchase. It retains all canonical product, option, media, profile, frame, DNA and
lifecycle authorities. Twenty deterministic captures and a focused product-context matrix are the
accepted evidence. P10B-18B-04 is **Baseline**, accepted by the product owner on 19 August 2026;
its historical handoff was P10B-18B-05, subsequently accepted on 20 August 2026.

### P10B-18B-05 accepted Baseline truth (20 August 2026)

The accepted package truthfully differentiates supported content/support anatomy,
reclassifies unsupported appointment/topic-guide and media-free image-led identities, pairs campaign
actions with exact canonical navigation, and gives nine utility runtime states distinct purposeful
composition through the existing family. Thirty retained EN/FI captures and focused lifecycle,
protected-state and frozen-matrix evidence exist. The product owner accepted the evidence on 20
August 2026; P10B-18B-05 and completed P10B-18B are Baseline, P10B-18/P10B remain Partial, and
accepted history is unchanged. At that checkpoint P10B-18C was next. P10B-19 PRE,
P10B-19A-01 through P10B-19A-07, P10B-19A-08A through P10B-19A-08C, P10B-19A-09A through
P10B-19A-09C, and P10B-19A-10A are now Baseline; parent P10B-19A-08 and parent P10B-19A-09 are
Baseline / closed. Parent P10B-19A-10 and P10B-19A remain Partial, and P10B-19A-10B is the exact
next implementation task.

## P10B-18C and P10B-16P-05B current-state synchronization

P10B-18C is Baseline as of 22 August 2026. Its accepted durable result is 126/126 compile and
replay, 54 normalized topologies, protected commerce/media, and a historical 280-entry human review
with zero primary FAIL.

P10B-16P-05B is Baseline as of 23 August 2026. The normal generation route, semantic provider,
compatibility resolver, deterministic compiler/coordinator, sole executor/materializer and
`StorefrontSnapshot` lifecycle remain unchanged. P03 remains the normal zero-provider Studio
regression. P04 is reduced to one token-protected production-disabled mock/live seam for P10B-18D.
Governed P9 follow-up and actual migration/publication identities remain; obsolete initial
generation and one-time production capture do not.

Normal production cannot configure or reach P04 acceptance. No acceptance token is client or
persisted evidence authority. Provider, Vesko and real-publication calls for cleanup are zero.

P10B-18D is a Baseline diagnostic with live commercial quality rejected. P10B-19 PRE,
P10B-19A-01 through P10B-19A-07, P10B-19A-08A through P10B-19A-08C, P10B-19A-09A through
P10B-19A-09C, and P10B-19A-10A are Baseline; parent P10B-19A-08 and parent P10B-19A-09 are
Baseline / closed. Parent P10B-19A-10 and P10B-19A remain Partial; P10B-19A-10B is the exact next
implementation task, A-10C is Planned after it, and P10B-19B-01 is Planned after A-10C. P10B
remains Partial.

## P10B-18D current-state truth

The live provider path is technically proven under a bounded six-call diagnostic, but live
commercial quality is not accepted. Concepts 3, 4 and 5 met prompt fidelity; Concepts 1, 2 and 6
did not. Concepts 2 and 6 produced the same exact snapshot, structural fingerprint and normalized
topology despite materially different prompts. The current system is strongest where existing
authority already expresses technical/configurable commerce, warm editorial storytelling and
restrained product-first layouts. It does not yet express merchant-wide dark foundations, bold
campaign identity, material asymmetry or sufficiently distinct cross-page structure strongly
enough.

Evidence truth remains bounded: Concept 1 has partial detailed safe/lifecycle evidence; Concept 4
lacks two expired candidate cart captures; Concept 5 lacks explicit Reject proof; Concept 6 proves
through Save but not reload and full Preview. These are not silently promoted to complete results.
No live provider call is authorized after the six-call matrix.

The duplicate collapse is first proven at semantic resolution/compatibility and the finite
PageBlueprint/Visual Recipe/Design DNA/frame inventory. Provider interpretation is indeterminate.
Concept 6 media evidence is primarily an image-settlement/test-seam issue with a secondary
lazy-image consumer owner; canonical media did not change. Its reload timeout is primarily a
development acceptance-seam continuity failure, not a proven saved-state or Preview defect.

Current status is `P10B-18D = Baseline diagnostic / live commercial quality rejected`,
`P10B-18 = Partial`, `P10B = Partial`, `P10B-19 PRE = Baseline`, and
`P10B-19A-01 through P10B-19A-08C = Baseline`, `P10B-19A-08 = Baseline / closed`,
`P10B-19A-09A = Baseline`, `P10B-19A-09B = Baseline`, `P10B-19A-09C = Baseline`,
`P10B-19A-09 = Baseline / closed`, `P10B-19A-10A = Baseline`, `P10B-19A-10 = Partial`,
`P10B-19A = Partial`, `P10B-19A-10B = exact next implementation task`,
`P10B-19A-10C = Planned after P10B-19A-10B`, and
`P10B-19B-01 = Planned after P10B-19A-10C`. P10B-19B through P10B-19J remain Planned.

## P10B-19 PRE current-state baseline

P10B-19 PRE is Baseline as an accepted architecture lock. P10B-19A-01 through P10B-19A-08C now
provide bounded production contract authority, but no registered record or runtime production
consumer exists. The current live generator therefore still has the P10B-18D commercial limitation: three
coordinated direction packages and a concentrated compatibility funnel can compress materially
different prompts into one exact authority.

The accepted future boundary is Creative Brief -> deterministic Structural Storefront Family ->
PageBlueprint v2 -> Visual Recipe compiled into canonical BrandSystem / Design DNA v2 -> exact
registered realization -> existing proposal and StorefrontSnapshot lifecycle. Six deep initial
families, deterministic three-concept distinction, one bounded critic pass, and append-only human
preference evidence are architecture commitments, not current production claims.

All current protected commerce, media, snapshot, component, Puck, lifecycle, and publication
authority remains unchanged. P10B remains Partial.

## P10B-19A-07 current-state baseline

P10B-19A-07 adds strict, deeply readonly PageBlueprint v2 and Structural Storefront Family
candidate authorities at candidate schema version `1.0.0`. PageBlueprint candidates compose exact
A-03/A-04/A-05/A-06 authority and carry stale-checked
`page-blueprint-v2-candidate-v1_<canonical-length>_<sha256>` exact-content fingerprints. Family
candidates keep exact A-01 identity and lifecycle `candidate`, cover all six A-02 page-family roles
with nonempty profile references plus canonical A-02 relationships, and carry stale-checked
`structural-storefront-family-candidate-v1_<canonical-length>_<sha256>` fingerprints that exclude
lifecycle. The inactive registry rejects duplicate identities, unresolved or page-family-mismatched
A-06 targets, and direct, indirect, or cross-version substitution cycles while preserving target
priority. Its sole production value contains two exactly empty candidate arrays. These fingerprints
prove content integrity, not normalized topology; active or candidate records, selection,
activation, persistence, publication, and runtime consumers remain zero. A-01 through A-06 and v1
remain unchanged.

P10B-19A-01 through P10B-19A-07, P10B-19A-08A through P10B-19A-08C, P10B-19A-09A through
P10B-19A-09C, and P10B-19A-10A are Baseline; parent P10B-19A-08 and parent P10B-19A-09 are
Baseline / closed. Parent P10B-19A-10 and P10B-19A remain Partial, P10B-19A-10B is the exact next
implementation task, and P10B remains Partial.

## P10B-19A-08A current-state baseline

P10B-19A-08A establishes strict normalized PageBlueprint v2 and Structural Storefront Family
topology projections. `PAGE_BLUEPRINT_V2_NORMALIZED_TOPOLOGY_SCHEMA_VERSION`,
`STRUCTURAL_STOREFRONT_FAMILY_NORMALIZED_TOPOLOGY_SCHEMA_VERSION`, and
`INACTIVE_CANDIDATE_NORMALIZED_TOPOLOGY_INDEX_SCHEMA_VERSION` are each exactly `1.0.0`.

The page projection assigns deterministic `r0`, `r1`, ... region tokens in A-03 default reading
order, retains A-03 structural relationships and A-05 responsive rules, and excludes A-04
asset-role and A-06 fallback authority. Its fingerprint format is
`page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>`. The family projection
covers all six canonical A-02 page-family roles plus A-02 cross-page relationships. Its
fingerprint format is
`structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>`.

One pure, non-persisted inactive index groups duplicate PageBlueprint and family topology
identities. It does not
reject duplicates, evaluate compatibility, select, activate, persist or create runtime authority.
The production PageBlueprint v2 record count, Structural Storefront Family record count and
normalized-topology index record count remain exactly zero. Current v1 read/render/migration/
publication behavior is unchanged.

The A-08A/A-08B/A-08C split is delivery-only and preserves the accepted P10B-19 PRE architecture
and P10B-19A-09 boundary. P10B-19A-08A through P10B-19A-08C and parent P10B-19A-08 are Baseline;
the parent is closed. P10B-19A-09A, P10B-19A-09B, P10B-19A-09C and P10B-19A-10A are Baseline;
parent P10B-19A-09 is Baseline / closed. Parent P10B-19A-10 and P10B-19A remain Partial,
P10B-19A-10B is the exact next implementation task, and P10B remains Partial.

## P10B-19A-08B current-state baseline

P10B-19A-08B adds strict schema-version `1.0.0` transient capability-context, exact required-role
capacity, exact family-profile and empty profile-catalogue authority. Its ordered dimensions are
catalogue-cardinality, fact-depth, product-complexity, navigation-depth and the existing canonical
`en`/`fi` locale order. Capacity is candidate-scoped for every and only A-04 required region/role,
bounded through maximum 32; no asset identity, provenance, reuse decision or missing-evidence
default enters compatibility. Each exact A-07 family profile explicitly partitions all five
vocabularies into supported and incompatible values. The sole production profile catalogue is
empty.

Memoized A-06 DAG evaluation retains every compatible direct target in declared order without
choosing one. PageBlueprint results are directly-compatible, substitution-compatible,
omission-compatible or incompatible; family results are directly-compatible,
conditionally-compatible or incompatible. A-08A topology fingerprints are diagnostic provenance
only. The stale-checked context, profile and evaluation fingerprints use the exact
`structural-storefront-capability-context-v1_<canonical-length>_<sha256>`,
`structural-storefront-family-compatibility-profile-v1_<canonical-length>_<sha256>` and
`structural-storefront-candidate-compatibility-evaluation-v1_<canonical-length>_<sha256>` formats.
No score, rank, winner, fallback selection, omission execution, activation or persistence exists.

Production PageBlueprint candidates, family candidates, profiles, contexts, evaluations, active
families, selectable families, selected candidates and current-generation compatibility consumers
all remain zero. A-01 through A-08A, current v1 behavior, commerce/media, snapshot, proposal,
renderer, publication and Puck authority remain unchanged. P10B-19A-08B is Baseline;
P10B-19A-08C subsequently completed the parent A-08 outcome.

## P10B-19A-08C current-state baseline

P10B-19A-08C establishes strict schema-version `1.0.0` deterministic selection requests and
immutable receipts over exact A-07/A-08A/A-08B authority. It uses scoring-free family and
PageBlueprint compatibility precedence with case-bound canonical-fingerprint tie-breaks, selects
all six canonical page families, follows A-06 recursive substitution priority, and retains safe
omission declarations without executing them. Complete-store combinations share one global 4,096
evaluation bound and produce an identity-free complete topology; receipt parsing replays selection
to reject stale or contradictory authority. Production registry, profile, request, receipt and
current-generation runtime counts remain zero, with no visual, runtime-wiring, provider,
persistence or publication change.

P10B-19A-08C and parent P10B-19A-08 are Baseline; the parent is closed. P10B-19A-09A,
P10B-19A-09B, P10B-19A-09C and P10B-19A-10A are Baseline; parent P10B-19A-09 is Baseline /
closed. Parent P10B-19A-10 and P10B-19A remain Partial, P10B-19A-10B is the exact next
implementation task, and P10B remains Partial.

## P10B-19A-09A current-state baseline

P10B-19A-09A adds opaque compatibility identity for exactly the ordered aliases
`legacy-v1:premium-editorial`, `legacy-v1:modern-technical`, and
`legacy-v1:minimal-commerce`, mapped one-to-one to the current coordinated directions. Each
immutable alias binds coordinated-direction authority version `1.1.0` and the exact current
package fingerprint; one populated immutable registry contains exactly those aliases.

One strict replay reference retains a complete current v1 selection narrowing. It resolves the
exact alias, requires direction agreement, reuses the current selection-narrowing validator and
derives executable identity through the existing exact projection. The replay fingerprint excludes
only incidental `selectionId`; the retained audit input keeps it. Unknown, malformed, mismatched or
stale alias, direction, registry, narrowing and replay authority fails closed without repair.

This authority never infers a legacy identity from snapshot contents, appearance, profiles, frame
similarity or topology and never converts v1 authority into a Structural Storefront Family,
PageBlueprint v2, Visual Recipe v2, candidate or activation record. It does not read or write a
snapshot, replay a renderer, invoke Preview or prove publication compatibility. It changes neither
current production generation nor merchant-visible behavior. A-09B owns historical snapshot
read/render replay without write-back; A-09C owns the now-complete publication replay boundary and
parent A-09 closure.

P10B-19A-01 through P10B-19A-07, P10B-19A-08A through P10B-19A-08C, P10B-19A-09A through
P10B-19A-09C, and P10B-19A-10A are Baseline; parent P10B-19A-08 and parent P10B-19A-09 are
Baseline / closed. Parent P10B-19A-10 and P10B-19A remain Partial, P10B-19A-10B is the exact next
implementation task, and P10B remains Partial.

## P10B-19A-09B current-state baseline

P10B-19A-09B adds one strict read-only historical-v1 adapter. It validates the current canonical
snapshot and exact catalogue reference plus registered section, PageBlueprint-profile,
shared-frame, navigation/site-map, dynamic-commerce, canonical product and approved-asset
authority. Unknown, malformed, stale, mismatched or noncanonical input fails closed without repair,
fallback or write-back.

An optional A-09A replay reference must bind exactly and yields
`readable-explicit-replay-binding`; without it, the adapter yields `readable-unattributed`, resolves
no coordinated direction and never infers an alias or original lineage. The detached deeply
immutable result contains the canonical snapshot and deterministic receipt. Its field partition
reports seven present persisted selection fields as verified and seven absent selection fields as
unverified, and its normalization disposition is `none` or `canonical-read-defaults`. Receipt
identity uses `legacy-v1-historical-snapshot-read-v1_<canonical-length>_<sha256>` and is rechecked
on parse.

Frozen exact-base evidence matches 36 of 36 bounded current-renderer observations for three
representative snapshots across EN/FI. Snapshot, route/profile/frame, commerce, product-media,
approved-asset and locale observations remain equal, with zero snapshot mutation and zero
repository write. It uses the existing historical Preview target/path but adds no new Preview route
and does not exercise published-target or publication replay. It proves neither raw HTML equality,
original-lineage recovery, migration, publication compatibility, v2 execution, production
operation nor merchant-visible change.

P10B-19A-09A, P10B-19A-09B, P10B-19A-09C and P10B-19A-10A are Baseline; parent P10B-19A-09 is
Baseline / closed. Parent P10B-19A-10 and P10B-19A remain Partial, P10B-19A-10B is the exact next
implementation task, and P10B remains Partial.

## P10B-19A-09C current-state baseline

P10B-19A-09C adds one bounded historical-v1 publication-replay authority. It accepts only the
exact validated A-09B historical read result and receipt, binds their snapshot, project, revision,
catalogue and fingerprint identities, and invokes the existing canonical publication compiler
with truthful `manual` source authority. The source snapshot is never rewritten: compilation uses
a detached transient aggregate projection in which the historical snapshot is the draft. Migration
must already resolve as current; no migration or compatibility result is persisted.

The immutable replay receipt binds A-09B provenance, the optional explicit alias/replay reference,
canonical source identity and current compiler authority. Receipt parsing and current-authority
assertion recompute exact fingerprints and fail closed on malformed, stale, mismatched, unresolved
or contradictory evidence. A-09C is imported directly only by its evidence boundary and is not
exported through the production publication barrel. Production replay-receipt count,
current-generation consumers and current-publication UI consumers remain zero.

Frozen exact-base evidence covers the same three Premium Editorial, Modern Technical and Minimal
Commerce representatives. Three direct compilations and three deterministic preparations are
identical, preparation performs no write, and exactly three isolated confirmations preserve atomic
publication semantics. Each confirmation adds exactly one publication version and makes the exact
compiled artifact active without changing the source aggregate or snapshot. All 36 of 36
published renderer observations match the frozen task-base publication authority, and all 36 of 36
normalized Preview/published structural observations match apart from explicit render-target and
route-context differences. Provider calls, Vesko calls and external-publication calls are zero;
commerce and media remain unchanged. This proves no merchant publication, staging result,
merchant-visible change, original lineage inference, snapshot rewrite or v2 activation.

`P10B-19A-09A = Baseline`; `P10B-19A-09B = Baseline`; `P10B-19A-09C = Baseline`;
`P10B-19A-09 = Baseline / closed`; `P10B-19A-10A = Baseline`;
`P10B-19A-10 = Partial`; `P10B-19A = Partial`;
`P10B-19A-10B = exact next implementation task`;
`P10B-19A-10C = Planned after P10B-19A-10B`;
`P10B-19B-01 = Planned after P10B-19A-10C`; `P10B = Partial`.

## P10B-19A-10A current-state baseline

P10B-19A-10A records a delivery-only decomposition of parent A-10: A-10A owns the retained
inventory and frozen baseline, A-10B owns cross-authority integration and the negative-failure
matrix, and A-10C owns complete retained execution, the closure report and product-owner
architecture gate. It preserves the accepted architecture and P10B-19B ordering. A-10A does not
prove complete integration, and neither A-10A nor A-10B may close P10B-19A.

The strict checked fixture
`tests/fixtures/p10b-19a-10a-retained-matrix-inventory.v1.json` is sufficient in a fresh clone. It
contains 24 explicit retained-matrix entries with exact repository-root commands and bounded
semantic outcomes, covering the accepted P10B-18C 126-case matrix, frozen P10B-18A 72-case subset,
focused A-01 through A-09C evidence, production inactivity, runtime isolation and dynamic DEVX-01
CI discovery. It binds 76 canonically ordered task-base production-source SHA-256 values and nine
zero-count production-v2 assertions.

The exact retained metrics remain 126 complete cases, successful compiles and deterministic
replays; 98 consumed-authority lineages; 54 normalized material and 54 direction-label-free
topologies; 34 repeated clusters with 106 memberships and maximum size 14; and 20 singletons. The
frozen 72 retain 39 topologies, 53 repeated memberships, maximum size 7 and 19 singletons. A-09
retains three aliases, three historical representatives, 36 of 36 Preview observations, three of
three compilations/preparations/isolated confirmations/current migration results, 36 of 36
published observations and 36 of 36 normalized Preview/published parity. All protected mutation,
repository-write, provider, Vesko and external-publication counts remain zero.

The inventory fingerprint is
`p10b-19a-retained-matrix-inventory-v1_32375_1b97e7da8eebdcda779b51b91b2f540263c97e9d2b40950b7f002721b6a5eb7d`.
Changing a metric, command or protected hash changes the identity; stale identity, missing
required evidence, changed matrix case set or unavailable checked A-09 baseline fails closed. No
automatic update mechanism exists. The external read-only baseline corroborates provenance but is
not a runtime or fresh-clone dependency.

Production files changed: zero. Production PageBlueprint candidates, Structural Family
candidates, compatibility profiles, capability contexts, compatibility evaluations, selection
requests, selection receipts, active families and selectable families remain zero. No current
generation consumer, provider call, Vesko call, external publication, screenshot, visual behavior
or merchant-visible behavior is added.

`P10B-19A-01 through P10B-19A-07 = Baseline`; `P10B-19A-08A through P10B-19A-08C = Baseline`;
`P10B-19A-09A through P10B-19A-09C = Baseline`; `P10B-19A-08 = Baseline / closed`;
`P10B-19A-09 = Baseline / closed`; `P10B-19A-10A = Baseline`;
`P10B-19A-10 = Partial`; `P10B-19A = Partial`;
`P10B-19A-10B = exact next implementation task`;
`P10B-19A-10C = Planned after P10B-19A-10B`;
`P10B-19B-01 = Planned after P10B-19A-10C`; `P10B = Partial`.
