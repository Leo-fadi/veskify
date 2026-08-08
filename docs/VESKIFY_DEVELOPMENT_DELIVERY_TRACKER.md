# Veskify Development Delivery Tracker

## Document control

| Field                       | Value                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Version                     | 1.3.0                                                                                                               |
| Baseline                    | 7 August 2026, current `main` after PR #171                                                                         |
| Active development phase    | P10B — Commercial Storefront Generation System v1 (**Planned**)                                                     |
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
| ☐    | P10B | Commercial Storefront Generation System v1             | **Planned**           | Veskify storefront generation        | P10A closure                              | Capability chain; 100+ diversity analysis; browser/E2E; retained human commercial review                 |
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

| Done | Task    | Outcome                                              | Status      | Owner                           | Dependency                         | Required evidence                                                      |
| ---- | ------- | ---------------------------------------------------- | ----------- | ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| ☐    | P10B-01 | Commercial grammar and compatibility vocabulary      | **Planned** | Canonical design contracts      | P10A closure; architecture lock    | Schema/queryability, migration, compatibility and typed rejection      |
| ☐    | P10B-02 | Parametric BrandSystem / Design DNA                  | **Planned** | BrandSystem                     | P10B-01                            | Cross-page projection, migration, responsive and lifecycle evidence    |
| ☐    | P10B-03 | Component anatomy and meaningful variant contract    | **Planned** | Component platform              | P10B-01                            | Structural difference, queryability, renderer and rejection evidence   |
| ☐    | P10B-04 | Responsive image and art-direction authority         | **Planned** | Asset presentation and media    | P10B-02, P10B-03                   | Provenance/crop/fallback and four-width visual evidence                |
| ☐    | P10B-05 | Veskify site-map and page-family authority           | **Planned** | PageBlueprint/storefront domain | P10B-01                            | Page-set/navigation/generation/lifecycle and rejection evidence        |
| ☐    | P10B-06 | Commercial shared-frame families                     | **Planned** | Shared frame                    | P10B-02, P10B-03, P10B-05          | Minimum frame/mobile/footer coverage and responsive human review       |
| ☐    | P10B-07 | Hero, editorial, campaign and proof families         | **Planned** | Commercial content families     | P10B-02 through P10B-05            | Minimum anatomy coverage, provenance, full chain and visual review     |
| ☐    | P10B-08 | Canonical product-card and merchandising family      | **Planned** | Commerce presentation           | P10B-02 through P10B-04            | Five anatomies, protected commerce, full chain and visual review       |
| ☐    | P10B-09 | Commercial homepage profile library                  | **Planned** | PageBlueprint profiles          | P10B-05 through P10B-08            | Six profiles, materialization-to-render and visual review              |
| ☐    | P10B-10 | Commercial collection and search profiles            | **Planned** | Collection/search presentation  | P10B-04 through P10B-06, P10B-08   | Four profiles, commerce/intents and visual review                      |
| ☐    | P10B-11 | Commercial PDP profile library                       | **Planned** | PDP presentation                | P10B-03 through P10B-06, P10B-08   | Four profiles, generic options/commerce and visual review              |
| ☐    | P10B-12 | Content and support page families                    | **Planned** | Content page presentation       | P10B-03 through P10B-07            | Approved-fact provenance, localization, lifecycle and visual review    |
| ☐    | P10B-13 | Commerce utility presentation pages                  | **Planned** | Utility presentation            | P10B-03, P10B-05, P10B-06, P10B-08 | Search/cart/checkout/state/a11y evidence                               |
| ☐    | P10B-14 | Premium Editorial complete-storefront vertical slice | **Planned** | Storefront generation and QA    | Minimum P10B-02 through P10B-13    | Complete page set, four widths and retained human review               |
| ☐    | P10B-15 | Bounded storefront synthesis and narrative engine    | **Planned** | Storefront generation           | P10B-14                            | Determinism, compatibility, no-partial snapshot and repetition control |
| ☐    | P10B-16 | Coordinated directions and diversity control         | **Planned** | Direction/evaluation authority  | P10B-15                            | Fingerprints, duplicate/near-duplicate and pairwise diversity          |
| ☐    | P10B-17 | Responsive, accessibility and performance closure    | **Planned** | Design system and QA            | P10B-16 and implemented families   | Four-width EN/FI geometry, a11y, performance and visual evidence       |
| ☐    | P10B-18 | Commercial quality and scale gate                    | **Planned** | Product owner, generation, QA   | All prior P10B tasks               | 100+ configurations and fingerprint-stratified human review            |

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
Every task below is **Planned**. The Done conditions are implementation gates, not claims about the
current repository.

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

#### P10B-08 — Canonical product-card and merchandising family

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
  campaign/editorial, and reusable generic content pages.
- **Authority:** Existing PageBlueprint, content/evidence, localization, navigation, and snapshot
  contracts.
- **Depends on:** P10B-03 through P10B-07.
- **Done when:** Every named family has registered profiles and approved-fact provenance,
  localization, navigation reachability, omission/fallback, responsive output, snapshot
  preservation, and publication; major types have multiple compositions where commercially useful.
- **Fail closed:** Fabricated locations, policies, certifications, guarantees, delivery, compliance,
  and service claims are rejected or omitted through registered rules.
- **Evidence:** Contract/profile, evidence/provenance, generation/lifecycle, localization,
  responsive/a11y, and retained visual evidence.
- **Non-goal:** Unrestricted CMS or legal-content generation.

#### P10B-13 — Commerce utility presentation pages

- **Outcome:** Deliver governed search/no-results, cart, checkout, empty, error, and 404 presentation.
- **Authority:** Existing page/profile, shared frame, canonical commerce projection, and operational
  adapter seams.
- **Depends on:** P10B-03, P10B-05, P10B-06, P10B-08.
- **Done when:** Every state presents canonical facts/actions with coherent Design DNA/frame,
  useful empty/error behavior, complete page-set reachability, responsive accessibility, snapshot,
  and publication preservation.
- **Fail closed:** Local commerce operations/writes, invented totals or availability, unsupported
  actions, and executable payment/checkout behavior outside Vesko adapters are rejected.
- **Evidence:** Contract/integration, adapter-boundary, state matrix, responsive/a11y browser, and
  retained visual evidence.
- **Non-goal:** Owning cart, checkout, payment, order, tax, shipping, or returns operations.

#### P10B-14 — Premium Editorial complete-storefront vertical slice

- **Outcome:** Prove one commercially credible complete multi-page storefront early.
- **Authority:** Existing canonical generation/proposal/snapshot/preview/publication chain using the
  implemented P10B authorities.
- **Depends on:** Minimum accepted P10B-02 through P10B-13 capability.
- **Done when:** One approved brief with realistic commerce and credible assets generates shared
  frame, home, collection, simple/configurable PDP, About, Contact/locations, FAQ/service, and
  required utility/error states; navigation, EN/FI where supported, four widths, protected state,
  preview/publish, and retained human review pass.
- **Fail closed:** Missing/disconnected/generic required pages, manual reconstruction, stale
  authority, or schema-only visual evidence fails the slice.
- **Evidence:** Complete capability chain, correlated browser/screenshots, protected parity, and
  signed human commercial review.
- **Non-goal:** P10B closure or broad direction/diversity proof.

#### P10B-15 — Bounded storefront synthesis and narrative engine

- **Outcome:** Generate complete coherent storefronts from compatible Design DNA, page set,
  profiles, families/variants, parameters, assets, and narrative roles.
- **Authority:** Existing governed planning/proposal compiler plus the registered P10B authorities;
  output remains one `StorefrontSnapshot`.
- **Depends on:** P10B-14 and sufficient real family/profile capability.
- **Done when:** Deterministic selection preserves cross-page identity, narrative adjacency/
  cardinality, repetition limits, bindings/assets, and complete snapshot/lifecycle output for
  representative inputs.
- **Fail closed:** Missing, stale, ambiguous, incompatible, unregistered, repetitive, or
  protected-state-divergent combinations produce no partial proposal/snapshot.
- **Evidence:** Selection/compatibility/unit, proposal/compiler/lifecycle integration, no-partial-
  write, deterministic fingerprint inputs, and complete-store browser evidence.
- **Non-goal:** Arbitrary trees/styles or a second synthesis representation.

#### P10B-16 — Coordinated directions and diversity control

- **Outcome:** Make Premium Editorial, Modern Technical, and Minimal Commerce coordinated constraint
  packages and prevent duplicates/near duplicates.
- **Authority:** Existing direction-selection authority plus deterministic storefront-design
  fingerprint/evaluation.
- **Depends on:** P10B-15.
- **Done when:** Fingerprints cover Design DNA, page set/profiles, frame, anatomies/variants,
  structural parameters, image posture, density/responsive posture, and narrative composition;
  exact and meaningful near duplicates fail, and pairwise stores differ materially beyond colour.
- **Fail closed:** Fixed-template/token/page direction authority, incompatible references,
  colour-only differences, and fingerprints that omit material structure are rejected.
- **Evidence:** Determinism, exact/near-duplicate fixtures, pairwise structural scoring, direction
  compatibility, complete-store generation, and representative visual evidence.
- **Non-goal:** Thousands of manually authored templates.

#### P10B-17 — Responsive, accessibility and performance closure

- **Outcome:** Preserve deliberate commercial hierarchy and usability across target widths,
  locales, accessibility, and bounded performance budgets.
- **Authority:** Existing responsive/a11y contracts, registered transformations, renderers, and
  evidence protocol.
- **Depends on:** Implemented commercial families/profiles/directions through P10B-16.
- **Done when:** All supported page families/directions pass 375/768/1024/1440 and EN/FI geometry,
  declared transformations, keyboard/focus/semantics/contrast, content/commerce retention, and
  explicit performance budgets with correlated evidence.
- **Fail closed:** Clipping, overlap, inaccessible controls, lost content/commerce, desktop-only
  approval, or undispositioned budget failure blocks completion.
- **Evidence:** Automated geometry/a11y/performance/browser matrices plus retained representative
  human review.
- **Non-goal:** Visual approval from isolated component screenshots.

#### P10B-18 — Commercial quality and scale gate

- **Outcome:** Prove repeated generation of publishable, premium, materially different complete
  storefronts.
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
