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

| Area | Outcome |
|---|---|
| Foundation and renderer | Canonical schemas, registered components, responsive rendering, fixtures and storage adapters. |
| Visual editor | Page/locale context, selection, manual section operations, device modes and undo/redo. |
| Controlled proposals | Selected-section, current-page and whole-storefront scope with review, accept, reject and stale protection. |
| Real provider | Secure OpenAI adapter through the same structured and guarded lifecycle as the mock provider. |
| Atomic storefront application | Multi-page and brand-system changes apply and undo as one history transaction. |
| Draft and publishing | Separate draft, save and publish flows with history and restore architecture. |
| Real merchant fixture | Karvonen catalogue and local assets render without changing protected product truth. |
| End-to-end proof | Real prompt → validated proposal → atomic acceptance → undo/redo → save → publish succeeded. |

These capabilities are not future work and must not be rebuilt.

## 3. Real-provider findings

| Finding | Roadmap consequence |
|---|---|
| Whole-storefront safe lifecycle works. | Keep architecture; harden only confirmed failures. |
| Premium prompt produced a coherent redesign. | Invest in component variety and page depth. |
| Detailed exact-palette prompt was rejected safely. | Expand approved palette intent and token operations. |
| Aurum/demo copy leaked into Karvonen presentation. | Remove fixture defaults and strengthen source-aware binding. |
| Karvonen needed explicit bootstrap wiring. | Add reliable load/reset demo workflows. |
| Editor still looks like a development tool. | Build the native Storefront Studio merchant shell. |

## 4. Remaining phases

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

### P8 — Asset-aware initial generation

**Goal:** Generate a complete merchant-specific first storefront.

**Deliverables:**

- homepage, collection and dynamic PDP generation from the approved brief;
- page-blueprint selection;
- asset-role placement;
- missing-asset choices: reuse, upload, continue or generate;
- removal of seed-brand defaults;
- source/binding/asset validation before proposal.

**Merchant outcome:** Initial generation feels specific to the merchant and uses existing assets correctly.

**Gate:** AC-103 through AC-105 and AC-117 through AC-119 pass.

### P9 — Whole-storefront design quality

**Goal:** Produce genuinely different, coherent complete storefronts.

**Deliverables:**

- exact valid brand-palette support;
- richer hero, editorial, collection, product and trust variants;
- coordinated navigation and footer;
- typography, spacing, buttons and image-treatment skills;
- coherent homepage, collection and product-page restyling;
- responsive visual polish;
- fixture-content cleanup.

**Merchant outcome:** “Redesign this as a premium Scandinavian jewellery storefront” creates one coordinated storefront, not isolated page edits.

**Gate:** AC-113 through AC-123 pass, including atomic whole-site undo/redo.

### P10 — Vesko Storefront Studio product UX

**Goal:** Turn the engine into an understandable Vesko product.

**Deliverables:**

- native Vesko application shell;
- merchant naming and navigation;
- focused Setup, Editor, Preview, Publishing and History workspace;
- compact page/outline rail;
- larger canvas;
- tabbed Design/AI controls;
- responsive drawers/bottom sheets;
- first-use guidance;
- no developer tools or internal terminology.

**Merchant outcome:** A first-time retailer completes the journey without developer assistance.

**Gate:** AC-121, AC-123 and first-time usability acceptance pass.

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

## 5. Immediate parallel start

After the v1.2 documentation PR merges:

| Window | Task | Outcome | Overlap rule |
|---|---|---|---|
| W1 | **P5-01 Component registry v2 and commerce-presentation contracts** | Define component, binding, product-presentation, blueprint and conformance contracts. | Shared contract branch; merge first. |
| W2 | **P10-01 Storefront Studio shell foundation** | Implement native shell, workspace header and compact rails. | Presentation-only; do not alter W1 contracts. |
| W3 | **P7-01 Source discovery and Storefront Design Brief contracts** | Define source evidence, provenance, asset inventory, reconciliation and brief schemas with deterministic fixtures. | New source/onboarding modules; do not alter component registry. |
| W4 | **Manual testing only** | Preserve real-provider Karvonen environment. | No Codex task unless explicitly assigned. |

## 6. Merge sequence

1. Merge P5-01 shared contracts first.
2. Update dependent branches with `git fetch origin` and `git merge origin/main`; never rebase.
3. Start P6-01 dynamic option-group engine and P6-02 dynamic PDP components with one named registry integration owner.
4. Continue P7 source discovery against approved brief contracts.
5. Merge the shell independently when it does not overlap active editor files.
6. Use W4 for one manual real-provider regression at each phase gate.

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
