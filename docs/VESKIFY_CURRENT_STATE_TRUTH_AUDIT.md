# Veskify Current-State Truth Audit

**Audit date:** 19 August 2026

**Repository baseline:** current `origin/main` plus accepted P10B-18B-04 delivery

**Scope:** code-grounded current-truth record synchronized after P10B-18B-04 bounded acceptance

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
- completion of P10B-18B beyond its accepted P10B-18B-01, P10B-18B-06, P10B-18B-02 and P10B-18B-03 slices, or P10B-18C designer-grade
  commercial-quality and 100+ configuration scale/diversity gate;
- a merchant-connected URL discovery and approval journey using the bounded public adapter;
- real Vesko API clients, a documented authentication protocol, production storage/deployment,
  or production evidence.

The truthful overall product status is therefore **Partial**. The canonical engine and many local
lifecycles, the bounded P10B-18A diagnosis, and P10B-18B-01 upgrade are Baseline; merchant delivery,
the rest of P10B-18B, P10B-18C commercial-quality closure, Vesko environment wiring, and production
operation are not. P10B-18B-02 acceptance is bounded to homepage/editorial/campaign quality;
collection/search/product-card, content/utility and complete-storefront designer-grade quality
remain open page-family work.

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
consumer-verified cleanup after P10B-18C. The P10B-16P-04 acceptance composition remains
production-disabled through P10B-18C.

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

| Merchant capability                                              | Status       | Current truth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open and edit seeded/local storefronts                           | **Baseline** | Browser routes load canonical snapshots; Puck fields and bounded section commands update unsaved canonical draft state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Start a project from minimal inputs                              | **Baseline** | The onboarding wizard persists a session, builds a deterministic guided plan/review, and creates a local project for demo or empty catalogue modes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Connect an existing Vesko catalogue during onboarding            | **Partial**  | The UI can select the intent, but project creation intentionally stops because no authoritative Vesko catalogue source is wired.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Discover a public storefront URL and approve reconciled evidence | **Partial**  | Secure adapter and URL-to-brief lifecycle exist, but the normal onboarding UI does not invoke the public server adapter as a complete merchant journey.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Generate an initial storefront                                   | **Partial**  | Normal local Studio reaches one canonical trusted server-owned semantic Design Intent route, deterministic exact complete-store compilation, the sole prompted executor/materialization boundary, and an isolated proposal from an approved raw project. P10B-16P-04 adds separately authorized real OpenAI A/B/C evidence through a production-disabled Aurum acceptance composition: one materialization per successful prompt, clean A/B rejection, and C Accept/Undo/Redo/Save/reload/Preview. P10B-16P-05A removes the active executable-intent/P10B-16L alternative and isolates P9/Lumo live generation as historical. P10B-17 adds bounded four-width responsive, accessibility, performance, search, renderer-equivalence, and retained visual evidence. Accepted P10B-18A adds the deterministic 72-case and 18-store/108-capture ceiling diagnosis. Accepted P10B-18B-01 materializes six exact non-colour DNA bundles, makes all four complete-store frames reachable, and retains a 17-capture quality review with protected commerce/media unchanged. One registered operation binds exact compiler lineage; snapshot evidence remains provenance and never self-authorizes. General production authentication/authority, the rest of P10B-18B, and P10B-18C quality/scale closure remain absent. |
| Request AI design changes                                        | **Partial**  | The editor exposes section/page/storefront prompts and proposal review; the strict P10A router and governed packages are internal-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Review, accept/reject, undo/redo                                 | **Baseline** | Page and whole-store proposal lifecycles are merchant-accessible; whole-store acceptance is atomic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Save and reload a draft                                          | **Baseline** | IndexedDB local flow is reachable and tested; Vesko durable persistence is an adapter seam, not an active environment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Preview home, collection, and PDP                                | **Baseline** | Routes select canonical draft/published/history snapshots and render protected commerce through route adapters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Search canonical storefront products                             | **Baseline** | One persisted `/search` presentation archetype is executable in draft, proposal, saved/history, and published storefront routes through transient EN/FI query/results from the standalone current `CatalogueDisplayModel`. Exact product links use current dynamic PDP routes; query, filters, sort, page, result IDs, and result count are not persisted. This does not claim a Vesko search endpoint, AI/semantic/fuzzy search, recommendations, or analytics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Publish explicitly                                               | **Partial**  | UI and server gateway exist, but the active server composition is protected local-demo-only. General standalone and production authority are not configured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Publish accepted AI lineage                                      | **Partial**  | The protected local server composition completes authoritative acceptance, durable receipt, independent preparation/confirmation resolution, atomic publication, and browser evidence. General merchant/Vesko/production reach remains absent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Restore history                                                  | **Baseline** | Local history and restore routes operate on immutable snapshots and preserve published state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Use Vesko staging or production                                  | **Blocked**  | Audited endpoint surfaces exist, but security/store authority, typed responses, revisions, navigation/synchronization, canonical persistence/publication APIs, deployment, and retained environment evidence remain absent or insufficient.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

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
  DNA/frame review. These remain bounded baselines, not completion of P10B-18B or P10B-18C
  designer-grade/100+ configuration evidence.

### 7.2 What is not proved

There is no Vesko staging or production evidence. Acceptance of P10B-18A and P10B-18B-01 proves
their bounded diagnosis and Design DNA/shared-frame upgrade, not completion of P10B-18B, the
P10B-18C 100+ configuration diversity/scale gate, production performance, or real-user operations.
Their deterministic and browser evidence is not additional real-provider evidence, and retained
visual inspection is not a production-readiness verdict. The P10A controlled-provider evidence does
not prove commercial quality, save/publish, Vesko connectivity, or production operation.

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
P10B-18B-03 closes bounded collection/search/product-card quality. Parent P10B-18B
and P10B-18 remain **Partial**. P10B-18B-04 is Baseline, P10B-18B-05 is next, P10B-18C remains
Planned, and P10B-16P-05B remains Planned after P10B-18C. P10A does not require another
registry, proposal model, recipe engine, component system, provider, publish command, or merchant
editor integration.

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

The remaining commercial path is explicit: after accepted P10B-18B-01, bounded P10B-18B-06,
accepted P10B-18B-02, accepted P10B-18B-03 and accepted P10B-18B-04, P10B-18B-05 is the next page-family quality package in the sequence frozen by
P10B-18A; P10B-18C then runs
at least 100 complete bounded configurations, deterministic quality/diversity analysis and retained
four-width human review for a representative fingerprint-stratified subset. Parent P10B-18 and
P10B remain Partial until that final acceptance. Vesko staging and production readiness remain
outside P10B.

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

| Drift                                                                               | Current repository truth                                                                                                                                                              | v1.3.0 action                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README and roadmap call Phase 9 active                                              | `P9_CLOSEOUT_RECORD.md` records the explicit post-PR-#134 closeout; later P10A work is merged.                                                                                        | Replace active-Phase-9 narrative while retaining the evidence limitations and historical records.                                                        |
| Earlier roadmap called P10A planned after Phase 9                                   | All required P10A gates are merged; P10B-18A, P10B-18B-01, P10B-18B-06, P10B-18B-02, P10B-18B-03 and P10B-18B-04 are accepted Baselines while parent P10B-18B/P10B-18 remain Partial. | Keep P10A closed, P10B active/Partial, P10B-18B-05 next, P10B-18C Planned, P10B-16P-05B after P10B-18C, and historical records point-in-time.            |
| Earlier SDD verified baseline was `4a96a5a`                                         | Current closure baseline is `3d36f54`; significant authority landed afterward.                                                                                                        | Keep the closure baseline current and preserve older hashes only in revision history.                                                                    |
| SDD says deterministic discovery was the only adapter in P7-01                      | A bounded public server adapter exists, but merchant runtime wiring is incomplete.                                                                                                    | Separate adapter implementation from merchant reachability and production service status.                                                                |
| `StorefrontDesignSystemV1` and executable profiles both describe recipes/directions | PageBlueprint profiles execute; direction material still supplies active planner context.                                                                                             | Name the direction material as transitional bounded selection data and remove duplicated recipe authority through an explicit migration.                 |
| Legacy V1 registry and V2 registry coexist                                          | V1 is still the generic Puck/snapshot bridge; V2 is the capability authority; native dynamic/home components bypass or bridge it.                                                     | Mark the V1 bridge **Deprecated** only where a tested V2 migration path exists; do not delete active compatibility prematurely.                          |
| P10A-04B document records 19 blockers and six commercial gaps                       | Current test expectation is 16 blockers, 25 metadata gaps, one migration item, zero commercial gaps.                                                                                  | Treat the report output as current and the task document as historical baseline.                                                                         |
| “Same renderer everywhere” is stated broadly                                        | Shared/native bridges largely preserve implementation identity, but conformance still reports target/ownership drift.                                                                 | Scope parity claims per component and require zero relevant blocking defects before global wording.                                                      |
| Merchant-facing names include historical P9/P10 labels and Veskify proof routes     | Normal UI says Storefront Studio; active P10B-16L routes are removed and P9/Lumo live generation is isolated historical evidence.                                                     | Keep historical evidence names internal; standardize merchant language only in product surfaces and finish consumer-verified cleanup under P10B-16P-05B. |
| Authentication/tenancy appear implemented in contract prose                         | They are deterministic/standalone authorities; no production identity system exists.                                                                                                  | Use **Partial** for contracts/adapters and **Blocked** for real environment operation.                                                                   |

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
    P10B-18A, P10B-18B-01, P10B-18B-06, P10B-18B-02 and P10B-18B-03 as Baseline; leave parent P10B-18B/P10B-18
    Partial, make P10B-18B-05 next, and retain P10B-18C plus P10B-16P-05B after it as Planned.
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

This synchronization records accepted P10B-18B-01 runtime and evidence truth. Its validation made
no external-provider, Vesko, real-publication, staging, or production request and did not read
environment secrets. P10B-18A, P10B-18B-01, P10B-18B-06, P10B-18B-02 and P10B-18B-03 are Baseline; parent
P10B-18B/P10B-18 remain Partial; P10B-18B-04 is Baseline; P10B-18B-05 is next; P10B-18C and P10B-16P-05B after it remain Planned.
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
staging or production claim. Parent P10B-18B/P10B-18/P10B remain Partial; P10B-18B-04 is Baseline, P10B-18B-05 is next and
P10B-18C remains the final designer-grade/100+ gate.

## P10B-18B-04 accepted synchronization

The accepted bounded PDP package provides exact per-product
configuration/media/decision-support matching, four strengthened existing PDP anatomies, a
resolver-derived configuration summary, bounded media, cardinality-aware related merchandising and
failure-disabled purchase. It retains all canonical product, option, media, profile, frame, DNA and
lifecycle authorities. Twenty deterministic captures and a focused product-context matrix are the
accepted evidence. P10B-18B-04 is **Baseline**, accepted by the product owner on 19 August 2026;
parent P10B-18B/P10B-18/P10B remain Partial and P10B-18B-05 is next.
