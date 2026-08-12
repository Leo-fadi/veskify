# Veskify Current-State Truth Audit

**Audit date:** 12 August 2026

**Repository baseline:** `28c0592bc530bc28e18f123ce0fde8c64ebd33f5` plus P10B-16P-03 delivery

**Scope:** code-grounded documentation audit; no runtime, canonical specification, roadmap, README, or DOCX change

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
- a normal mocked Storefront Studio whole-storefront journey that sends one exact prompt through
  standalone/mock server-reloaded Design Intent V2 and deterministic P10B compilation, then binds
  the exact P02B source-proposal fingerprint and compiler lineage in one registered structural operation before
  isolated proposal review, reject/accept, undo/redo, evidence-preserving save/reload, and
  dynamic-route preview;
- server-only OpenAI and public-source adapters, strict Vesko integration ports, standalone
  adapters, and endpoint-neutral staging adapters; and
- a deterministic publish compiler enforced before the existing authoritative publish command in
  the configured server gateway.

The repository does not yet have:

- the P10A governed router and package integrations wired into the normal merchant editor flow;
- a commercially deep storefront design system or retained current full-store visual acceptance;
- a merchant-connected URL discovery and approval journey using the bounded public adapter;
- real Vesko API clients, a documented authentication protocol, production storage/deployment,
  or production evidence.

The truthful overall product status is therefore **Partial**. The canonical engine and many local
lifecycles are Baseline; merchant delivery, commercial quality, Vesko environment wiring, and
production operation are not.

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
generation now uses the P10B-16P-03 prompted Design Intent V2 path. P10A skills/router therefore
remain real but internal-only authorities rather than the merchant-facing initial-generation path.

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

The old page proposal system, legacy V1 registry bridge, `StorefrontDesignSystemV1` direction
material, and new P10A authorities currently coexist. Some coexistence is intentional migration;
some is documentation and reachability debt that v1.3.0 must name rather than obscure.

## 6. Merchant reachability

| Merchant capability                                              | Status       | Current truth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open and edit seeded/local storefronts                           | **Baseline** | Browser routes load canonical snapshots; Puck fields and bounded section commands update unsaved canonical draft state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Start a project from minimal inputs                              | **Baseline** | The onboarding wizard persists a session, builds a deterministic guided plan/review, and creates a local project for demo or empty catalogue modes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Connect an existing Vesko catalogue during onboarding            | **Partial**  | The UI can select the intent, but project creation intentionally stops because no authoritative Vesko catalogue source is wired.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Discover a public storefront URL and approve reconciled evidence | **Partial**  | Secure adapter and URL-to-brief lifecycle exist, but the normal onboarding UI does not invoke the public server adapter as a complete merchant journey.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Generate an initial storefront                                   | **Partial**  | Normal local Studio reaches standalone/mock server-owned Design Intent V2 and deterministic complete-store compilation from an approved raw project. One registered operation binds the exact P02B source-proposal fingerprint/compiler lineage. Snapshots preserve evidence references as provenance through proposal/save/reload/Preview, while current approved evidence is independently resolved from trusted server/session authority; snapshots never self-authorize. Integrated requests fail closed until P10B-16P-04 injects authenticated authority. Live V2 provider evidence, production authority, executable search, and commercial-quality closure remain absent. |
| Request AI design changes                                        | **Partial**  | The editor exposes section/page/storefront prompts and proposal review; the strict P10A router and governed packages are internal-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Review, accept/reject, undo/redo                                 | **Baseline** | Page and whole-store proposal lifecycles are merchant-accessible; whole-store acceptance is atomic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Save and reload a draft                                          | **Baseline** | IndexedDB local flow is reachable and tested; Vesko durable persistence is an adapter seam, not an active environment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Preview home, collection, and PDP                                | **Baseline** | Routes select canonical draft/published/history snapshots and render protected commerce through route adapters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Publish explicitly                                               | **Partial**  | UI and server gateway exist, but the active server composition is protected local-demo-only. General standalone and production authority are not configured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Publish accepted AI lineage                                      | **Partial**  | The protected local server composition completes authoritative acceptance, durable receipt, independent preparation/confirmation resolution, atomic publication, and browser evidence. General merchant/Vesko/production reach remains absent.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Restore history                                                  | **Baseline** | Local history and restore routes operate on immutable snapshots and preserve published state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Use Vesko staging or production                                  | **Blocked**  | Audited endpoint surfaces exist, but security/store authority, typed responses, revisions, navigation/synchronization, canonical persistence/publication APIs, deployment, and retained environment evidence remain absent or insufficient.                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## 7. Evidence truth

### 7.1 What is proved

- Contract/schema and deterministic unit evidence is broad across canonical models, registries,
  PageBlueprints, skills, routing, protected operations, acceptance, persistence, publishing, and
  the compiler.
- Integration evidence covers onboarding, generation, proposal lifecycle, editor routes, dynamic
  commerce routes, save/reload, history, publishing, and published target propagation.
- Browser/E2E evidence covers the local merchant shell, editor/proposal interactions, onboarding,
  collection/PDP rendering, history/restore, publish confirmation, and deterministic responsive
  journeys.
- Real-provider evidence remains narrow. P9R-07 retains a historical manually reviewed OpenAI
  design-system-only change. P10A-07C-03R retains one successful governed initial-generation case
  before one successful exact hero follow-up case through the current package/router authority,
  with two total calls, zero retry, protected-state parity, and no save or publication.
- Retained human visual review exists narrowly in the P9R-07 written record and three P9-03E
  content-aware screenshots. It is not a current compiler-correlated full home/collection/PDP
  commercial review.

### 7.2 What is not proved

There is no Vesko staging or production evidence. There is no retained current 160-scenario human
commercial review record or complete current commercial screenshot matrix. The P10A controlled
provider evidence does not prove commercial quality, save/publish, Vesko connectivity, or
production operation. Tests that mock OpenAI transport are integration evidence, not real-provider
evidence. Browser tests using deterministic fixtures are browser/E2E evidence, not human visual or
production evidence.

## 8. P10A closure verdict

P10A is **Baseline / closed**. The explicit 20-item exit audit, merged capability inventory,
requirement traceability, provider evidence, publication evidence, protected-state verdict, and
deferred ownership are recorded in [`P10A_PHASE_CLOSURE.md`](P10A_PHASE_CLOSURE.md). No required
P10A exit item remains Partial or Blocked.

P10B — Commercial Storefront Generation System v1 is the active development phase and remains
**Partial**. P10B-16P-03 provides its normal mocked initial-generation Studio journey; live V2
acceptance and the final quality gates remain Planned. P10A does not require another registry, proposal model, recipe engine, component
system, provider, publish command, or merchant editor integration.

### Decided P10A/P10C editor boundary

Governed initial generation, governed follow-up execution, package authority, strict routing, the
proposal lifecycle, and their internal functional evidence are closed P10A authorities.
Merchant-facing controls are not a P10A closure requirement.

P10C owns connecting the normal Storefront Studio UI to those authorities, including merchant-facing
routing, clarification UI, frame/page scope controls, and scoped execution through the editor. That
ownership is an existing binding architecture decision, not an open phase-boundary choice.

## 9. Commercial storefront quality ceiling and viable path

The current ceiling remains the conclusion of the historical P10B capability audit: a competent,
clean, responsive catalogue storefront with limited brand distinction. Homepage has the greatest
useful variation. Collection and PDP are safe and functionally deep but their governed profiles
remain visually narrow. Brand tokens do not yet provide a sufficient semantic typography, spacing,
layout, surface, control, and image-art-direction system. Product-card authority is duplicated
across legacy, homepage, and collection renderers. Current direction packages can converge below
the first viewport.

Commercial viability requires P10B, not looser generation:

1. extend the existing `BrandSystem` into bounded cross-page Design DNA;
2. define meaningful anatomy and deepen registered frame, content, merchandising, and dynamic
   commerce families;
3. create complete site-map/page-family authority using only executable PageBlueprint profiles and
   `StorefrontSnapshot`;
4. add approved responsive art-direction metadata without replacing canonical product media;
5. prove home, commerce, content/support, campaign, search, cart/checkout, empty, error, and 404
   presentation in an early complete Premium Editorial store;
6. synthesize compatible registered combinations and reject exact/meaningful near duplicates with
   a structural design fingerprint; and
7. generate 100+ complete configurations, then retain four-width human review for a representative
   fingerprint-stratified subset.

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

| Drift                                                                               | Current repository truth                                                                                                          | v1.3.0 action                                                                                                                            |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| README and roadmap call Phase 9 active                                              | `P9_CLOSEOUT_RECORD.md` records the explicit post-PR-#134 closeout; later P10A work is merged.                                    | Replace active-Phase-9 narrative while retaining the evidence limitations and historical records.                                        |
| Earlier roadmap called P10A planned after Phase 9                                   | All required P10A gates are merged and the formal closure audit passes at Baseline.                                               | Keep P10A closed, P10B active/Planned, and historical task records point-in-time.                                                        |
| Earlier SDD verified baseline was `4a96a5a`                                         | Current closure baseline is `3d36f54`; significant authority landed afterward.                                                    | Keep the closure baseline current and preserve older hashes only in revision history.                                                    |
| SDD says deterministic discovery was the only adapter in P7-01                      | A bounded public server adapter exists, but merchant runtime wiring is incomplete.                                                | Separate adapter implementation from merchant reachability and production service status.                                                |
| `StorefrontDesignSystemV1` and executable profiles both describe recipes/directions | PageBlueprint profiles execute; direction material still supplies active planner context.                                         | Name the direction material as transitional bounded selection data and remove duplicated recipe authority through an explicit migration. |
| Legacy V1 registry and V2 registry coexist                                          | V1 is still the generic Puck/snapshot bridge; V2 is the capability authority; native dynamic/home components bypass or bridge it. | Mark the V1 bridge **Deprecated** only where a tested V2 migration path exists; do not delete active compatibility prematurely.          |
| P10A-04B document records 19 blockers and six commercial gaps                       | Current test expectation is 16 blockers, 25 metadata gaps, one migration item, zero commercial gaps.                              | Treat the report output as current and the task document as historical baseline.                                                         |
| “Same renderer everywhere” is stated broadly                                        | Shared/native bridges largely preserve implementation identity, but conformance still reports target/ownership drift.             | Scope parity claims per component and require zero relevant blocking defects before global wording.                                      |
| Merchant-facing names include historical P9/P10 labels and Veskify proof routes     | Normal UI says Storefront Studio, but demo/internal route names remain.                                                           | Keep internal evidence names internal; standardize merchant language only in product surfaces.                                           |
| Authentication/tenancy appear implemented in contract prose                         | They are deterministic/standalone authorities; no production identity system exists.                                              | Use **Partial** for contracts/adapters and **Blocked** for real environment operation.                                                   |

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
    record P10B-01 through P10B-16P-03 as Baseline while leaving P10B-16P-04, P10B-17, and P10B-18
    Planned.
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

The original audit and this closure synchronization made no provider call, publication, staging
request, or production request and did not read environment secrets. No runtime code, schemas,
registries, components, PageBlueprints, or styles changed. Historical documentation remains
historical; this current-state record now links the formal P10A closure authority.
