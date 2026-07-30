# Veskify Development Roadmap

**Version:** 1.2.1
**Aligned with:** `docs/VESKIFY_SDD.md`
**Merchant-facing product:** Vesko Storefront Studio
**Internal engine:** Veskify

## 1. Product outcome

A new Vesko customer can connect an existing storefront URL or provide minimal business inputs, approve a reconstructed brand and storefront plan, receive a dynamic product-type-correct storefront, improve it through plain-language design requests and publish safely without developer assistance.

Veskify remains a design engine. It consumes read-only canonical Vesko commerce projections and does not become a catalogue, inventory, order, payment, logistics or tax system.

## 2. Verified baseline — complete

The roadmap begins from `origin/main` commit
`8174b1a6d31301b4072622e2e3ef675957479121` on 30 July 2026. “Complete” below means
the foundation is merged; it does not imply that the corrected Phase 9 merchant-quality gate has
passed.

| Area                          | Outcome                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundation and renderer       | Canonical schemas, registered components, responsive rendering, fixtures and storage adapters.                                                                     |
| Visual editor                 | Page/locale context, selection, manual section operations, device modes and undo/redo.                                                                             |
| Controlled proposals          | Selected-section, current-page and whole-storefront scope with review, accept, reject and stale protection.                                                        |
| Provider boundary             | Secure OpenAI adapter plus deterministic and mocked provider-boundary coverage. Retained live Phase 9 evidence remains required.                                   |
| Atomic storefront application | Multi-page and brand-system changes apply and undo as one history transaction.                                                                                     |
| Draft and publishing          | Separate draft, save and publish flows with history and restore architecture.                                                                                      |
| Real merchant fixture         | Karvonen catalogue and local assets render without changing protected product truth.                                                                               |
| Lifecycle proof               | Deterministic/mocked proposal → atomic acceptance → undo/redo → save → publish is covered. A complete retained live-provider quality journey is not yet evidenced. |

These foundations are not future work and must not be rebuilt. They must be composed and evidenced
through the same canonical `StorefrontSnapshot`; infrastructure presence alone does not close
Phase 9.

## 3. Real-provider findings

| Finding                                            | Roadmap consequence                                          |
| -------------------------------------------------- | ------------------------------------------------------------ |
| Whole-storefront safe lifecycle works.             | Keep architecture; harden only confirmed failures.           |
| Premium prompt produced a coherent redesign.       | Invest in component variety and page depth.                  |
| Detailed exact-palette prompt was rejected safely. | Expand approved palette intent and token operations.         |
| Aurum/demo copy leaked into Karvonen presentation. | Remove fixture defaults and strengthen source-aware binding. |
| Karvonen needed explicit bootstrap wiring.         | Add reliable load/reset demo workflows.                      |
| Editor still looks like a development tool.        | Build the native Storefront Studio merchant shell.           |

## 4. Phase status and active work

### P4.1 — Real-AI findings and hardening

**Goal:** Make normal real-provider requests reliable without changing the proven architecture.

**Scope:**

- provider parsing and safe error mapping;
- exact supported brand-token requests;
- timeout/unavailable states;
- stale and invalid proposal summaries;
- fixture-specific content cleanup;
- demo load/reset reliability;
- confirmed undo/publish regressions only.

**Merchant outcome:** Normal design requests behave through the same safe lifecycle as the deterministic provider.

**Gate:** Focused hardening PRs pass relevant tests; no architecture rewrite.

### P5 — Dynamic component and binding platform

**Goal:** Give the AI a reusable, versioned storefront vocabulary.

**Deliverables:**

- `ComponentDefinitionV2`;
- typed slots and editable fields;
- `DataBinding` contracts;
- `ProductPresentationContext`;
- asset roles and provenance bindings;
- page blueprints;
- component versioning and migrations;
- generic standalone/Vesko projection adapters;
- conformance tests.

**Merchant outcome:** The AI composes reusable storefronts without merchant-specific code or copied product facts.

**Gate:** Contracts merge first and adapter tests are green.

### P6 — Dynamic commerce page depth

**Goal:** Render product-type-correct product and collection experiences from canonical Vesko data.

**Deliverables:**

- dynamic option-group schema and renderer;
- option dependencies and required-selection guidance;
- variant resolver boundary;
- dynamic product gallery and information components;
- price/compare-at/unavailable-price presentation;
- product cards and grids;
- collection header and filter presentation;
- unknown product-type fallback;
- responsive and keyboard behaviour.

**Acceptance:**

- simple watch with one colour dimension;
- complex ring with five or six option groups;
- unavailable combinations;
- selected variant controls price, availability and media;
- layout changes never change option or product truth.

**Gate:** AC-106 through AC-112 pass at 375, 768, 1024 and 1440 px.

### P7 — URL-first onboarding and brand reconstruction

**Goal:** Let merchants start from what they already have.

**Deliverables:**

- public URL source adapter and deterministic fixture adapter;
- source evidence with provenance and confidence;
- prompt-injection-resistant parsing;
- reconciliation against canonical commerce data;
- logo, colour, typography, copy and asset discovery;
- asset inventory and roles;
- guided brand reconstruction;
- merchant-approved Storefront Design Brief.

**Merchant outcome:** A merchant with an existing site or only a logo can approve a complete design direction without rebuilding catalogue truth.

**Gate:** URL/minimal inputs → approved brief succeeds; public commerce conflicts never override Vesko.

### P8 — Asset-aware initial generation — engineering foundation delivered; runtime integration outstanding

**Completed infrastructure and tested capabilities:**

- whole-storefront generation plan and proposal lifecycle;
- server-side OpenAI whole-storefront planner;
- premium visual system;
- review, Accept, Reject and Close lifecycle with controlled whole-storefront confirmation;
- Storefront Studio editor-shell work.

**Outstanding runtime integration:** The merchant editor still falls back to the deterministic/legacy storefront provider path. Wiring the canonical server planning provider, brief, component-registry and approved-asset handoff into that runtime is required before the complete merchant generation outcome is available.

### P9 — Whole-storefront design quality — active

**Goal:** Produce a meaningful coordinated shared frame, homepage, collection and dynamic PDP from
registered capabilities, rather than a token-only, renderer-only, API-response-only or
one-section rearrangement.

**Binding order:** establish the smallest registered and end-to-end reachable capability set needed
for meaningful multi-page composition → prove coordinated composition → prove canonical commerce
and approved assets → prove atomic apply/reject/undo → prove persistence/preview/publish. Only
after those Phase 9 proof gates pass may P10A broadly expand the controlled vocabulary.

**Evidence:** `docs/PHASE_9_EVIDENCE_MATRIX.md` is the required traceability record. PR #123
(`8174b1a6d31301b4072622e2e3ef675957479121`) is merged evidence only for exact token refinement
and preservation semantics. It does not prove this Phase 9 outcome.

#### P9-01 — Wire the server whole-storefront planning provider into the runtime editor

**Goal:** Use the canonical server planning provider in the merchant editor instead of the deterministic/legacy fallback.

**Acceptance:** A runtime editor session reaches the controlled whole-storefront planning and review path.

#### P9-02 — Complete approved-brief, component-registry and approved-asset runtime handoff

**Goal:** Carry the exact merchant-approved brief revision, controlled component vocabulary and
approved assets into runtime generation.

**Acceptance:** Retained evidence correlates project ID, brief ID, approved revision/fingerprint,
approval actor/action/timestamp and runtime request/proposal so the generated storefront is proven
to use that exact approved revision with no later unapproved mutation. A validated but unapproved
brief or deterministic fixture alone cannot satisfy this gate.

#### P9-03 — Minimum proof-enabling design capability reachability

**Goal:** Repair reachability of already registered capabilities and expose only the smallest
curated capability set required for the Phase 9 coordinated directions.

**Acceptance:** Planner, compiler and renderer gaps are corrected so the minimum
`premiumEditorial`, `modernTechnical` and `warmApproachable` compositions required by Phase 9 can
be proved end to end without changing commerce truth. P9-03 is not unrestricted or broad
controlled-vocabulary scaling.

#### P9-04 — Whole-storefront visual-quality and responsive acceptance suite

**Goal:** Prove coherent visual quality, atomicity and responsive behaviour through the runtime journey.

**Acceptance:** P9-04D is a binding gate discovered in the 29 July 2026 Lumo real-AI test. The
same canonical project, catalogue and approved assets must yield `premiumEditorial`,
`modernTechnical` and `warmApproachable` directions that independently differ in required
homepage, collection and PDP dimensions. Palette-only, typography-only and one-section-only
variation fails. The executable matrix covers EN/FI, 375/768/1024/1440, one/many collections,
small/large catalogues and missing optional media with measured responsive evidence. Every output
must retain approved-asset provenance and match the canonical source-commerce baseline for all
protected commerce truth.

#### P9-05 — Internal merchant-generation demo checkpoint

**Goal:** Verify the completed runtime journey with internal merchants before moving to product UX and staging work.

**Acceptance:** The runtime journey completes without the current full-suite lifecycle timeout; no final quality/manual checkpoint is claimed until that and the open editor-quality work are resolved.

**Current status:** Active/incomplete. Repository tests document mocked provider transport and
deterministic lifecycle coverage; the required retained live-provider result, full browser matrix
and visual-quality evidence have not been recorded.

### Completed Vesko integration foundation prework

The merged integration foundation provides canonical integration boundaries, merchant/project context, catalogue/navigation projection, availability/options/variants/media projection, authoritative draft persistence, authoritative publishing and complete standalone port assembly.

Historical internal task and branch labels used `P9-*` for this completed work. Those labels do not replace the authoritative SDD identity of canonical Phase 9 and do not by themselves complete canonical Phase 9 or Phase 12.

**Frozen ownership:** Vesko owns canonical commerce truth and sellability. Storefront Studio owns presentation and controlled design changes.

### P10A — Grounded orchestration — planned after Phase 9

**Goal:** Define and validate the contract-level groundwork that makes repository capabilities
queryable and executable without creating a second storefront model or hand-maintained parallel
registry. P10A does not deliver merchant-operable granular editing.

| Task    | Deliverable                                                                                                                                                                                                                                                       | Gate                                                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| P10A-01 | Freeze canonical vocabulary and transient-boundary aliases.                                                                                                                                                                                                       | No new canonical `PageModel`, `StorefrontPlan`, `SectionNode`, AI graph or provider registry.                                                 |
| P10A-02 | Audit registered components, variants, bindings, planners, compilers and renderers.                                                                                                                                                                               | Reachability derives from live evidence and reports stale classifications.                                                                    |
| P10A-03 | Define executable `PageBlueprint` contracts from current template precursors.                                                                                                                                                                                     | AC-133 and the blueprint-validation portion of AC-130 pass.                                                                                   |
| P10A-04 | Generate the Component Knowledge Registry from canonical contracts, including the executable `PageBlueprint` contracts produced by P10A-03, then broaden the controlled vocabulary only through validated canonical registrations exposed by that generated view. | AC-129 and the capability-reference portion of AC-130 pass without a forward dependency; broad scaling cannot precede the Phase 9 proof gate. |
| P10A-05 | Define separate initial-generation and follow-up-editing Skill package contracts.                                                                                                                                                                                 | AC-131 passes at the schema, authority and validation-contract layer.                                                                         |
| P10A-06 | Define scoped instruction-router contracts and no-widening validation.                                                                                                                                                                                            | AC-132 passes at the classification, authority and validation-contract layer.                                                                 |
| P10A-07 | Add golden-store quality gates, including a non-jewellery merchant.                                                                                                                                                                                               | AC-134 passes with deterministic and retained real-provider evidence.                                                                         |
| P10A-08 | Add the deterministic publish compiler.                                                                                                                                                                                                                           | AC-133 and AC-135 pass; publication makes no AI call.                                                                                         |

P10A defines Skill packages, capability-query requirements, schemas, authority declarations, scope
classification, router contracts and validation rules, including the explicit prohibition against
silent scope widening. P10A defines and validates the scopes; Phase 11 implements and exposes those
scopes as working merchant features.

### P10B — Assets and Vesko Storefront Studio UX — planned

**Goal:** Let merchants upload, classify, approve, replace and reuse presentation assets through an
understandable Studio that consumes P10A contracts.

**Scope:** Asset upload/library, role/provenance review, generated-image
candidate/approval/promotion/replacement lifecycle, compact editor workspace, clear Design/AI
flows, localization, responsive shell, accessible proposal review, Save draft and Publish.

**Gate:** The Studio-owned portions of AC-121, AC-122 and AC-123 pass. AC-119 remains solely a
Phase 9 gate; P10B consumes its approved reuse/upload/generate decision rather than claiming
ownership. The generated storefront portions of AC-121 through AC-123 also remain Phase 9 evidence.

### P11 — Granular controlled editing — planned

**Goal:** Implement and expose the P10A-defined scopes as merchant-operable runtime features:
component/section selection, selected-section proposals, current-page, shared-frame, design-system
and complete-storefront editing; add/remove/reorder/replace operations; proposal preview and
acceptance; mixed-scope history; Undo/Redo; and merchant scope controls and warnings.

**Gate:** Every merchant-operable scope proves runtime no-widening enforcement, proposal preview and
acceptance, atomic application where applicable, stale rejection, mixed-scope history, exact
Undo/Redo and understandable scope controls/warnings.

### P12 — Stable domains and Vesko reference adapters — planned

**Goal:** Consolidate stable canonical domains and ports, then provide a Vesko reference adapter
and conformance suite without redesigning Veskify.

**Scope:** Project/merchant context, canonical commerce projection, media, source discovery,
storefront persistence, publishing, provider and observability ports. Existing standalone and
integration-foundation implementations are migrated behind the stable contracts rather than
duplicated.

**Gate:** The reference adapter passes the same contract fixtures as standalone implementations.
Immediate full Vesko staging transport is not required.

### Later — Deployment and operations

Authentication, tenancy, production secret management, staging transports, deployment, health
checks, operational observability, pilot rollout and support runbooks follow the stable adapter
phase. Earlier integration-foundation code may be reused, but historical task labels do not change
this ordering.

## 5. Current execution focus

Canonical Phase 9 is active. No P10A, P10B, Phase 11 or Phase 12 foundation closes Phase 9.
The binding sequence is minimum proof-enabling reachability, coordinated composition,
commerce/assets, atomicity and persistence/publish. Broad controlled-vocabulary scaling belongs to
P10A-04 after Phase 9 closes.

## 6. Canonical phase sequence

1. Complete Phase 9 meaningful grounded multi-page generation and its evidence matrix.
2. Complete P10A grounded orchestration.
3. Complete P10B assets and Storefront Studio UX.
4. Complete Phase 11 granular controlled editing.
5. Complete Phase 12 stable canonical domains and Vesko reference adapters.
6. Execute environment-specific authentication, tenancy, staging and operations work later.

## 7. Explicit non-priorities

Do not prioritize before the integration-ready design demo:

- another catalogue-management or product-entry system;
- general CSV/Excel import as a prerequisite;
- operational inventory, orders, payments, logistics, returns or taxes;
- more AI providers without a production requirement;
- AI image generation before existing-asset reuse works well;
- broad industry expansion before jewellery/watches PDP depth, except the required non-jewellery
  golden-store gate;
- unrestricted custom code or model-invented components.

## 8. Release acceptance

The product is integration-ready when a customer can:

1. open Vesko Storefront Studio;
2. connect a public website or provide minimal inputs;
3. review source evidence and canonical reconciliation;
4. approve a Storefront Design Brief;
5. generate homepage, collection and product pages;
6. see correct product-type options and selected-variant data;
7. request an AI redesign, including exact brand colours;
8. review and accept or reject the proposal;
9. adjust manually;
10. save draft;
11. preview and publish explicitly;
12. restore history;
13. repeat the flow reliably in staging.
