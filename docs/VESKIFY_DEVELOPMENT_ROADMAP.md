# Veskify Development Roadmap

**Version:** 1.2
**Aligned with:** `docs/VESKIFY_SDD.md`
**Merchant-facing product:** Vesko Storefront Studio
**Internal engine:** Veskify

## 1. Product outcome

A new Vesko customer can connect an existing storefront URL or provide minimal business inputs, approve a reconstructed brand and storefront plan, receive a dynamic product-type-correct storefront, improve it through plain-language design requests and publish safely without developer assistance.

Veskify remains a design engine. It consumes read-only canonical Vesko commerce projections and does not become a catalogue, inventory, order, payment, logistics or tax system.

## 2. Verified baseline — complete

The roadmap begins from the repository state proven on 22 July 2026.

| Area                          | Outcome                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Foundation and renderer       | Canonical schemas, registered components, responsive rendering, fixtures and storage adapters.              |
| Visual editor                 | Page/locale context, selection, manual section operations, device modes and undo/redo.                      |
| Controlled proposals          | Selected-section, current-page and whole-storefront scope with review, accept, reject and stale protection. |
| Real provider                 | Secure OpenAI adapter through the same structured and guarded lifecycle as the mock provider.               |
| Atomic storefront application | Multi-page and brand-system changes apply and undo as one history transaction.                              |
| Draft and publishing          | Separate draft, save and publish flows with history and restore architecture.                               |
| Real merchant fixture         | Karvonen catalogue and local assets render without changing protected product truth.                        |
| End-to-end proof              | Real prompt → validated proposal → atomic acceptance → undo/redo → save → publish succeeded.                |

These capabilities are not future work and must not be rebuilt.

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

### P8 — Whole-storefront generation and review — complete

**Completed capabilities:**

- whole-storefront generation planning and controlled proposal lifecycle;
- real OpenAI planner/provider integration behind the guarded design boundary;
- AI-ready premium visual system and merchant whole-storefront generation/review;
- the dedicated Storefront Studio editor-shell correction.

**Merchant outcome:** Merchants can generate, review, accept, undo and save one coherent whole-storefront proposal through the native editor experience.

### P9 — Vesko integration foundation — complete

**Completed capabilities:**

- P9-01 canonical Vesko integration contracts and boundaries;
- P9-02 merchant/project context and authorization adapter;
- P9-03 catalogue, collection, category, navigation and route adapter;
- P9-04 availability, attributes, options, variants, SKU and canonical media adapter;
- P9-05A authoritative draft persistence and restoration;
- P9-05B authoritative saved-draft publishing;
- P9-05C complete ports assembly and integration-readiness checkpoint;
- final Phase 9 validation and manual checkpoint.

**Frozen ownership:** Vesko owns canonical commerce truth and sellability. Storefront Studio owns presentation and controlled design changes.

**Deliberate Phase 10 limitations:** No real Vesko staging transport, production authentication, production credentials or live staging commerce synchronization exists yet.

### P10 — Vesko staging integration and pilot readiness — active

**Goal:** Replace deterministic/local integration adapters with authenticated staging integrations while preserving the completed P9 contracts and ownership boundary.

#### P10-01 — Vesko staging transport and authentication foundation

**Goal:** Establish the authenticated server-side staging transport boundary and credential handling.

**Dependencies:** Completed P9-01 and P9-02 contracts.

**Acceptance:** Staging context requests authenticate safely, map merchant/project authority and keep credentials out of the client.

#### P10-02 — Real catalogue/navigation staging projection

**Goal:** Load real staging catalogue, collection, category, navigation and route data through the P9-03 projection.

**Dependencies:** P10-01.

**Acceptance:** Staging projections validate against the canonical contracts without creating competing commerce truth.

#### P10-03 — Real availability/options/variants/media staging projection

**Goal:** Load real sellability, attributes, options, variants, SKU and canonical media through the P9-04 projection.

**Dependencies:** P10-01 and P10-02.

**Acceptance:** Product presentation reflects staging commerce truth while Studio controls only presentation.

#### P10-04 — Real draft persistence and publishing staging integration

**Goal:** Connect authoritative staging draft save, restore and publishing operations to P9-05A and P9-05B.

**Dependencies:** P10-01 and completed P9-05A/P9-05B contracts.

**Acceptance:** Authenticated staging save, restore and publish preserve concurrency, history, explicit publication and merchant authority.

#### P10-05 — End-to-end staging readiness and pilot checkpoint

**Goal:** Validate the complete authenticated staging journey and prepare a controlled pilot handoff.

**Dependencies:** P10-01 through P10-04.

**Acceptance:** A merchant can complete the supported staging journey with canonical commerce truth, controlled design changes and explicit save/publish boundaries.

### P11 — Demo reliability and staging

**Goal:** Make sales/customer demonstrations repeatable and shareable.

**Deliverables:**

- load/reset Karvonen and reference fixtures;
- known prompt library;
- clean-state start and restore;
- provider failure recovery;
- staging deployment with server-side secrets;
- access control;
- logging, latency and cost observability;
- final performance and accessibility gate.

**Merchant outcome:** The same demo works repeatedly without IndexedDB preparation or developer intervention.

**Gate:** AC-120 and the complete final acceptance journey pass from a clean environment.

### P12 — Vesko integration handoff

**Goal:** Hand the engine to the Vesko teammate without redesigning it.

**Deliverables:**

- production adapter contracts and implementations;
- project/authentication context mapping;
- canonical commerce projection mapping;
- media, persistence, publishing and source-discovery adapters;
- component/blueprint registry package;
- migrations and version policy;
- conformance tests;
- deployment and rollback runbook;
- ownership and unresolved-decision table.

**Merchant outcome:** Veskify operates inside Vesko Storefront Studio against real Vesko services.

**Gate:** AC-124 and AC-125 pass; integration sign-off complete.

## 5. Current execution focus

P10-01 is the active starting point. The remaining Phase 10 tasks progress in dependency order and must preserve the completed P9 ports and the frozen Vesko/Storefront Studio ownership boundary.

## 6. Phase 10 integration sequence

1. Establish staging transport and authenticated merchant/project context.
2. Map real catalogue/navigation, then availability/options/variants/media projections.
3. Integrate authoritative staging draft persistence, restore and publishing.
4. Complete the end-to-end staging readiness and pilot checkpoint.

## 7. Explicit non-priorities

Do not prioritize before the integration-ready design demo:

- another catalogue-management or product-entry system;
- general CSV/Excel import as a prerequisite;
- operational inventory, orders, payments, logistics, returns or taxes;
- more AI providers without a production requirement;
- AI image generation before existing-asset reuse works well;
- broad industry expansion before jewellery/watches PDP depth;
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
