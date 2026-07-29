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

### P8 — Asset-aware initial generation — engineering foundation delivered; runtime integration outstanding

**Completed infrastructure and tested capabilities:**

- whole-storefront generation plan and proposal lifecycle;
- server-side OpenAI whole-storefront planner;
- premium visual system;
- review, Accept, Reject and Close lifecycle with controlled whole-storefront confirmation;
- Storefront Studio editor-shell work.

**Outstanding runtime integration:** The merchant editor still falls back to the deterministic/legacy storefront provider path. Wiring the canonical server planning provider, brief, component-registry and approved-asset handoff into that runtime is required before the complete merchant generation outcome is available.

### P9 — Whole-storefront design quality — active

**Goal:** Produce genuinely different, coherent complete storefronts rather than small rearrangements.

#### P9-01 — Wire the server whole-storefront planning provider into the runtime editor

**Goal:** Use the canonical server planning provider in the merchant editor instead of the deterministic/legacy fallback.

**Acceptance:** A runtime editor session reaches the controlled whole-storefront planning and review path.

#### P9-02 — Complete brief, component-registry and approved-asset runtime handoff

**Goal:** Carry the approved brief, controlled component vocabulary and approved assets into runtime generation.

**Acceptance:** Runtime proposals use the same validated brief, registry and asset context as the completed planning infrastructure.

#### P9-03 — Storefront Design System v1 quality expansion

**Goal:** Expand the approved visual vocabulary for coherent premium whole-storefront design.

**Acceptance:** Whole-storefront proposals can make approved typography, spacing, colour, component and page-level changes without changing commerce truth.

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

### Completed Vesko integration foundation prework

The merged integration foundation provides canonical integration boundaries, merchant/project context, catalogue/navigation projection, availability/options/variants/media projection, authoritative draft persistence, authoritative publishing and complete standalone port assembly.

Historical internal task and branch labels used `P9-*` for this completed work. Those labels do not replace the authoritative SDD identity of canonical Phase 9 and do not by themselves complete canonical Phase 9 or Phase 12.

**Frozen ownership:** Vesko owns canonical commerce truth and sellability. Storefront Studio owns presentation and controlled design changes.

### P10 — Vesko Storefront Studio product UX — planned

**Goal:** Turn the engine into an understandable Vesko product without developer terminology or confusing controls.

**Outstanding work:**

- compact usable editor workspace with coherent toolbar and project/page identity;
- practical desktop viewport use and responsive panels;
- clear Design and AI workflows;
- localization consistency;
- removal of duplicated or confusing controls;
- merchant usability acceptance.

**Gate:** The current editor UI has not passed its manual quality checkpoint; the observed layout quality remains an open P10 gate.

### P11 — Demo reliability and staging — planned

**Goal:** Establish the prerequisites for repeatable, supportable demos and staging use.

**Prerequisites:**

- deployable staging environment;
- server-side secret configuration;
- authentication and access control;
- observability and safe logs;
- deterministic demo data;
- reliability and failure recovery;
- staging health checks and a demo runbook.

**Gate:** These prerequisites must exist before a pilot-readiness checkpoint can pass.

### P12 — Vesko integration handoff — planned

**Goal:** Connect the completed integration foundation to real Vesko staging services without redesigning the engine.

#### P12-01 — Vesko staging transport and authentication foundation

**Goal:** Establish the authenticated server-side staging transport boundary and credential handling.

**Dependencies:** P11 staging deployment, secret configuration, authentication and access-control prerequisites.

**Acceptance:** Staging context requests authenticate safely, map merchant/project authority and keep credentials out of the client.

#### P12-02 — Real catalogue/navigation staging projection

**Goal:** Load real staging catalogue, collection, category, navigation and route data through the canonical projection.

**Dependencies:** P12-01.

**Acceptance:** Staging projections validate against the canonical contracts without creating competing commerce truth.

#### P12-03 — Real availability/options/variants/media staging projection

**Goal:** Load real sellability, attributes, options, variants, SKU and canonical media through the canonical projection.

**Dependencies:** P12-01 and P12-02.

**Acceptance:** Product presentation reflects staging commerce truth while Studio controls only presentation.

#### P12-04 — Real draft persistence and publishing staging integration

**Goal:** Connect authoritative staging draft save, restore and publishing operations to the completed persistence and publishing boundaries.

**Dependencies:** P12-01 and the completed integration foundation prework.

**Acceptance:** Authenticated staging save, restore and publish preserve concurrency, history, explicit publication and merchant authority.

#### P12-05 — End-to-end Vesko integration handoff and pilot checkpoint

**Goal:** Validate the complete authenticated staging journey and prepare the Vesko handoff.

**Dependencies:** Relevant P11 staging/deployment prerequisites and P12-01 through P12-04.

**Acceptance:** Only after those dependencies are met can a merchant complete the authenticated staging journey with canonical commerce truth, controlled design changes and explicit save/publish boundaries.

## 5. Current execution focus

Canonical Phase 9 is active. W1, W3 and W4 may contribute parallel prework originally labelled P10-01 through P10-03 toward canonical Phase 12; that early work does not make Phase 12 active or complete.

## 6. Canonical phase sequence

1. Complete P9 whole-storefront runtime integration and quality work.
2. Complete P10 merchant product UX and manual usability acceptance.
3. Establish P11 demo reliability and staging prerequisites.
4. Execute P12 Vesko staging integration and handoff tasks.

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
