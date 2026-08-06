# Veskify Current-State Truth Audit

**Audit date:** 6 August 2026

**Repository baseline:** `169a8ba56cf25c7b816d9a0e25a5321c31ac85aa` (`origin/main`, including merged PR #163)

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
- server-only OpenAI and public-source adapters, strict Vesko integration ports, standalone
  adapters, and endpoint-neutral staging adapters; and
- a deterministic publish compiler enforced before the existing authoritative publish command in
  the configured server gateway.

The repository does not yet have:

- the P10A governed router and package integrations wired into the normal merchant editor flow;
- a successful retained P10A controlled-provider acceptance run;
- an active merchant endpoint that mints accepted-proposal publication receipts and a configured
  accepted-AI authority in the active server composition;
- persisted immutable compiled publication artifacts, an atomic active-artifact pointer, or
  rollback/republish authority;
- full published-route browser/manual evidence tied to the current compiler and gateway;
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
`executeGovernedInitialGeneration`, or `executeGovernedFollowUpEditing`. It still uses the older
page proposal orchestration and `AiStorefrontGenerationOrchestrator`, with a deterministic mock by
default and a protected local-demo server provider when explicitly configured. P10A skills/router
are therefore real but internal-only authorities.

### 4.4 Persistence and publication

Normal standalone projects use browser IndexedDB. Save, publish, and restore create validated
snapshot identities and preserve history. The active publish UI now sends only bounded prepare and
confirm requests to the same-origin server gateway; it cannot publish directly through IndexedDB.

The configured server gateway is available only for the non-production P9-05B local demo. Without
that explicit server configuration, the route fails closed. The configured composition supplies
manual publication but does not inject `acceptedAiAuthority`, so an accepted-AI request is rejected
even though receipt minting, durable receipt storage, and trusted receipt validation exist as
server modules and deterministic tests.

PR #163 added deterministic compilation before publication preparation and fresh recompilation at
confirmation. The compiled result is not persisted as the active published artifact. The existing
snapshot repository still owns the publication transaction and published snapshot pointer.

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
   and a safely blocked controlled-provider run.
6. PRs #159, #162, and #163 added accepted-snapshot receipt authority, the active authoritative
   merchant gateway, and deterministic publication compilation. PR #161 separately corrected
   published collection/PDP render-target propagation.

The old page proposal system, legacy V1 registry bridge, `StorefrontDesignSystemV1` direction
material, and new P10A authorities currently coexist. Some coexistence is intentional migration;
some is documentation and reachability debt that v1.3.0 must name rather than obscure.

## 6. Merchant reachability

| Merchant capability                                              | Status       | Current truth                                                                                                                                                |
| ---------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Open and edit seeded/local storefronts                           | **Baseline** | Browser routes load canonical snapshots; Puck fields and bounded section commands update unsaved canonical draft state.                                      |
| Start a project from minimal inputs                              | **Baseline** | The onboarding wizard persists a session, builds a deterministic guided plan/review, and creates a local project for demo or empty catalogue modes.          |
| Connect an existing Vesko catalogue during onboarding            | **Partial**  | The UI can select the intent, but project creation intentionally stops because no authoritative Vesko catalogue source is wired.                             |
| Discover a public storefront URL and approve reconciled evidence | **Partial**  | Secure adapter and URL-to-brief lifecycle exist, but the normal onboarding UI does not invoke the public server adapter as a complete merchant journey.      |
| Generate an initial storefront                                   | **Partial**  | Deterministic guided creation and legacy/runtime whole-store generation are reachable; governed P10A initial generation is not the normal editor path.       |
| Request AI design changes                                        | **Partial**  | The editor exposes section/page/storefront prompts and proposal review; the strict P10A router and governed packages are internal-only.                      |
| Review, accept/reject, undo/redo                                 | **Baseline** | Page and whole-store proposal lifecycles are merchant-accessible; whole-store acceptance is atomic.                                                          |
| Save and reload a draft                                          | **Baseline** | IndexedDB local flow is reachable and tested; Vesko durable persistence is an adapter seam, not an active environment.                                       |
| Preview home, collection, and PDP                                | **Baseline** | Routes select canonical draft/published/history snapshots and render protected commerce through route adapters.                                              |
| Publish explicitly                                               | **Partial**  | UI and server gateway exist, but the active server composition is protected local-demo-only. General standalone and production authority are not configured. |
| Publish accepted AI lineage                                      | **Partial**  | Receipt contracts and enforcement exist, but no merchant acceptance endpoint/configured accepted-AI authority currently completes the chain.                 |
| Restore history                                                  | **Baseline** | Local history and restore routes operate on immutable snapshots and preserve published state.                                                                |
| Use Vesko staging or production                                  | **Blocked**  | No confirmed endpoints, auth exchange, production repositories, deployment, or retained environment evidence exist.                                          |

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
- Real-provider evidence is narrow and historical. P9R-07 retains a successful manually reviewed
  OpenAI design-system-only change through review, accept, undo/redo, save/reload, and preview, but
  not publication or structural generation. P9R-08 records two unsuccessful pre-correction calls.
  P10A-07C-03 made zero calls because trusted configuration selected the deterministic provider.
- Retained human visual review exists narrowly in the P9R-07 written record and three P9-03E
  content-aware screenshots. It is not a current compiler-correlated full home/collection/PDP
  commercial review.

### 7.2 What is not proved

There is no Vesko staging or production evidence. There is no successful retained P10A controlled
provider case. There is no retained current 160-scenario human review record, no complete current
commercial screenshot matrix, no accepted-AI publication journey, and no compiler-artifact
rollback/republish evidence. Tests that mock OpenAI transport are integration evidence, not
real-provider evidence. Browser tests using deterministic fixtures are browser/E2E evidence, not
human visual or production evidence.

## 8. Actual remaining Phase 10A work

P10A is substantially implemented but not closed. The remaining work is narrower than the roadmap
currently implies:

1. **Controlled-provider acceptance is Blocked.** Re-run P10A-07C-03 only under explicit approval
   when trusted server configuration selects an eligible OpenAI provider and model. Case A must
   succeed before Case B; no retry is permitted.
2. **Accepted-AI merchant wiring is Partial.** Connect the server-only acceptance authority to the
   authoritative accepted proposal endpoint, persist the receipt through the existing durable
   repository, and inject the trusted accepted-AI authority into the active gateway composition.
3. **P10A-08C-02B is Planned.** Atomically persist the immutable compiled artifact with publication
   history and active artifact/version authority, and define safe rollback/republish without a
   second editable model.
4. **P10A-08D-02 is Planned.** Prove the current gateway/compiler/published home, collection, and PDP
   journey with final browser and retained manual evidence, including failed compilation,
   no-partial-write, active-version, rollback, and zero-provider publication evidence.
5. **Merchant route convergence is Partial.** Decide whether P10A closure itself wires the strict
   router/governed packages into the editor or records that work as P10C reachability. The current
   roadmap says P10A owns governed execution and P10C owns merchant-operable editing; v1.3.0 must
   state the exact boundary and acceptance proof.

P10A does not need another registry, proposal model, recipe engine, component system, provider, or
publish command.

## 9. Commercial storefront quality ceiling and viable path

The current ceiling remains the P10B-01 conclusion: a competent, clean, responsive catalogue
storefront with limited brand distinction. Homepage has the greatest useful variation. Collection
and PDP are safe and functionally deep but their governed profiles remain visually narrow. Brand
tokens do not yet provide a sufficient semantic typography, spacing, layout, surface, control, and
image-art-direction system. Product-card authority is duplicated across legacy, homepage, and
collection renderers. Current direction packages can converge below the first viewport.

Commercial viability requires P10B, not looser generation:

1. extend the existing `BrandSystem` with governed semantic visual foundations and make renderers
   consume them consistently;
2. deepen registered shared-frame, hero, product-card, collection, PDP, editorial, campaign, and
   evidence-backed trust families;
3. enrich only the existing executable PageBlueprint profiles and dynamic commerce authorities;
4. add approved responsive art-direction metadata without replacing canonical product media;
5. make complete registered directions materially different across home, collection, PDP, frame,
   typography, density, imagery, and composition; and
6. retain correlated browser screenshots and human review at 375, 768, 1024, and 1440 px with
   representative approved assets and protected-commerce comparisons.

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

Vesko owners must still supply:

- the API/OpenAPI catalogue, base paths, methods, pagination and response envelopes;
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

Until those are documented, real staging adapters and production deployment are **Blocked**, not
merely untested.

## 11. Documentation, naming, status, and duplication drift

| Drift                                                                               | Current repository truth                                                                                                          | v1.3.0 action                                                                                                                            |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| README and roadmap call Phase 9 active                                              | `P9_CLOSEOUT_RECORD.md` records the explicit post-PR-#134 closeout; later P10A work is merged.                                    | Replace active-Phase-9 narrative while retaining the evidence limitations and historical records.                                        |
| Roadmap calls P10A planned after Phase 9                                            | P10A-03 through 08C-02A and 08D-01 are merged; only the closure items in §8 remain.                                               | Mark each subtask factually rather than marking the whole phase planned or complete.                                                     |
| SDD verified baseline is `4a96a5a`                                                  | Current main is `169a8ba`; significant capability and publication authority landed afterward.                                     | Establish a new auditable baseline and move old hashes to revision history.                                                              |
| SDD says deterministic discovery was the only adapter in P7-01                      | A bounded public server adapter exists, but merchant runtime wiring is incomplete.                                                | Separate adapter implementation from merchant reachability and production service status.                                                |
| `StorefrontDesignSystemV1` and executable profiles both describe recipes/directions | PageBlueprint profiles execute; direction material still supplies active planner context.                                         | Name the direction material as transitional bounded selection data and remove duplicated recipe authority through an explicit migration. |
| Legacy V1 registry and V2 registry coexist                                          | V1 is still the generic Puck/snapshot bridge; V2 is the capability authority; native dynamic/home components bypass or bridge it. | Mark the V1 bridge **Deprecated** only where a tested V2 migration path exists; do not delete active compatibility prematurely.          |
| P10A-04B document records 19 blockers and six commercial gaps                       | Current test expectation is 16 blockers, 25 metadata gaps, one migration item, zero commercial gaps.                              | Treat the report output as current and the task document as historical baseline.                                                         |
| “Same renderer everywhere” is stated broadly                                        | Shared/native bridges largely preserve implementation identity, but conformance still reports target/ownership drift.             | Scope parity claims per component and require zero relevant blocking defects before global wording.                                      |
| Merchant-facing names include historical P9/P10 labels and Veskify proof routes     | Normal UI says Storefront Studio, but demo/internal route names remain.                                                           | Keep internal evidence names internal; standardize merchant language only in product surfaces.                                           |
| Authentication/tenancy appear implemented in contract prose                         | They are deterministic/standalone authorities; no production identity system exists.                                              | Use **Partial** for contracts/adapters and **Blocked** for real environment operation.                                                   |

## 12. Decisions required for SDD v1.3.0 synchronization

The later synchronization must make these decisions explicitly:

1. Choose the new verified baseline commit and date and identify historical evidence that remains
   valid without pretending it proves current output.
2. Record Phase 9 as closed by product-owner handoff while preserving its incomplete commercial
   and full-matrix evidence truth.
3. Split P10A status by implemented authority, merchant reachability, controlled-provider evidence,
   compiled-artifact persistence, rollback, and final render evidence.
4. Decide the acceptance boundary between P10A internal governed execution and P10C merchant-facing
   scope controls; name the route that must call the strict router.
5. Confirm that PageBlueprint profiles are the sole executable recipe authority and define the
   retirement path for duplicated template/direction recipe material.
6. Define the migration policy for the legacy V1 registry/Puck bridge and the exact zero-blocker
   renderer-conformance gate.
7. Separate local standalone, protected local demo, controlled provider, Vesko staging, and
   production claims in every baseline table.
8. Define whether successful P10A-07C acceptance is a P10A closure gate or can be superseded by a
   later current-architecture controlled run; do not reuse the blocked run as a pass.
9. Specify accepted-AI receipt minting ownership, durable storage, and active gateway composition.
10. Specify the P10A-08C-02B compiled artifact, active pointer, history, idempotency, rollback, and
    republish contracts without making it editable state.
11. Define P10A-08D-02 retained evidence and its relationship to P10B commercial visual evidence.
12. Adopt the P10B commercial design-system sequence and criteria without claiming its vocabulary
    specification is implemented.
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

This audit made no provider call, publication, staging request, or production request. It did not
read environment secrets. It did not change runtime code, schemas, registries, components,
PageBlueprints, styles, README, the SDD, the roadmap, or any DOCX. Historical documentation remains
historical; this document is the evidence basis for, not the execution of, the later v1.3.0
synchronization.
