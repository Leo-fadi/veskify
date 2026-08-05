# Veskify Development Roadmap

**Version:** 1.2.2
**Aligned with:** `docs/VESKIFY_SDD.md`
**Merchant-facing product:** Vesko Storefront Studio
**Internal engine:** Veskify

## 1. Product outcome

A new Vesko customer can connect an existing storefront URL or provide minimal business inputs, approve a reconstructed brand and storefront plan, receive a dynamic product-type-correct storefront, improve it through plain-language design requests and publish safely without developer assistance.

Veskify remains a design engine. It consumes read-only canonical Vesko commerce projections and does not become a catalogue, inventory, order, payment, logistics or tax system.

## 2. Verified baseline — complete

The v1.2.2 roadmap begins from `origin/main` commit
`4a96a5a5567b83e62306f73f7069e0e09f0c8683` on 31 July 2026, which includes the P9R-06 merge.
The earlier v1.2.1 baseline was `8174b1a6d31301b4072622e2e3ef675957479121`; it remains historical
evidence for that amendment and PR #123, not the v1.2.2 source. “Complete” below means the
foundation is merged; it does not imply that the corrected Phase 9 merchant-quality gate has passed.

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

#### P9R status

P9R-06 is reproducible at the v1.2.2 baseline merge commit `4a96a5a`: PR #131 added the controlled
editor homepage routing and its integration/live-acceptance tests. It proved the real editor
homepage-only generation route, not whole-storefront composition, and does not close Phase 9.
P9R-07, whole-store global colour and typography routing, is active parallel work at this roadmap
revision; this documentation update does not claim it has merged or completed.

### Completed Vesko integration foundation prework

The merged integration foundation provides canonical integration boundaries, merchant/project context, catalogue/navigation projection, availability/options/variants/media projection, authoritative draft persistence, authoritative publishing and complete standalone port assembly.

Historical internal task and branch labels used `P9-*` for this completed work. Those labels do not replace the authoritative SDD identity of canonical Phase 9 and do not by themselves complete canonical Phase 9 or Phase 12.

**Frozen ownership:** Vesko owns canonical commerce truth and sellability. Storefront Studio owns presentation and controlled design changes.

### P10A — Grounded orchestration and publishing closure — planned after Phase 9

**Goal:** Close the existing contract and publication work before commercial visual expansion: make
repository capabilities queryable and executable without creating a second storefront model or
hand-maintained parallel registry, then complete deterministic publish compilation. P10A does not
deliver merchant-operable granular editing or commercial visual-quality expansion.

| Task    | Deliverable                                                                                                                                                            | Gate                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P10A-01 | Freeze canonical vocabulary and transient-boundary aliases.                                                                                                            | No new canonical `PageModel`, `StorefrontPlan`, `SectionNode`, AI graph or provider registry.                                   |
| P10A-02 | Audit registered components, variants, bindings, planners, compilers and renderers.                                                                                    | Reachability derives from live evidence and reports stale classifications.                                                      |
| P10A-03 | Define executable `PageBlueprint` contracts from current template precursors, including the sole registered representation for constrained commercial recipe profiles. | AC-133 and the blueprint-validation portion of AC-130 pass without a separate recipe/template representation.                   |
| P10A-04 | Generate the Component Knowledge Registry from canonical contracts, including the executable `PageBlueprint` contracts produced by P10A-03.                            | AC-129 and the capability-reference portion of AC-130 pass; P10B consumes this registered view for commercial scaling.          |
| P10A-05 | Define separate initial-generation and follow-up-editing Skill package contracts.                                                                                      | AC-131 passes at the schema, authority and validation-contract layer.                                                           |
| P10A-06 | Define scoped instruction-router contracts and no-widening validation.                                                                                                 | AC-132 passes at the classification, authority and validation-contract layer.                                                   |
| P10A-07 | Add the functional/publishing evidence-harness groundwork, including trust/evidence safety and a non-jewellery merchant.                                               | AC-134 validation groundwork passes; it does not establish commercial visual acceptance, which P10B owns through AC-136–AC-138. |
| P10A-08 | Add the deterministic publish compiler.                                                                                                                                | AC-133 and AC-135 pass; publication makes no AI call.                                                                           |

P10A owns governed initial/follow-up execution, scope routing, proposal lifecycle, controlled-provider
acceptance, compiler authority, publish/render/rollback evidence and protected-commerce correctness.
It defines Skill packages, capability-query requirements, schemas, authority declarations, scope
classification, router contracts and validation rules, including the explicit prohibition against
silent scope widening. Its closure requires P10A-08 to publish the accepted canonical
`StorefrontSnapshot` deterministically; P10A does not close on commercial visual polish. It is
complete before P10B begins. P10C implements and exposes the resulting editing scopes as
merchant-operable features.

### P10B — Commercial Storefront Design System v1 — planned

**Primary exit condition:** Veskify proves commercial component/profile reachability for its new
design-system capabilities and generates a complete, commercially credible and materially
differentiated storefront across homepage, collection and PDP without manual reconstruction. P10B
follows P10A publishing closure; manual Puck editing is not a P10B dependency.

| Task                                                     | Objective                                                                                           | Dependency and canonical authority                                                   | Merchant-visible result and evidence                                                                                       | Explicit non-goals                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **P10B-01 — Executable commercial vocabulary**           | Add governed commercial composition vocabulary and reachability for new design-system capabilities. | P10A-03/04/08; `BrandSystem`, `PageBlueprint`, compatibility and bounded parameters. | Deterministic inheritance, compatibility, migration and commercial capability/profile reachability evidence.               | No second token registry, recipe engine, page graph or arbitrary CSS.                                              |
| **P10B-02 — Commercial visual foundations**              | Establish semantic typography, spacing, containers, surfaces and actions.                           | P10B-01; renderer-derived `BrandSystem` projection.                                  | Strong hierarchy and rhythm with contrast and four-width specimens.                                                        | No raw style values or unrestricted fonts.                                                                         |
| **P10B-03 — Image and art-direction authority**          | Govern approved media treatment, crop and fallback.                                                 | P10B-01/02; approved asset placement and component compatibility.                    | Intentional credible imagery at desktop and mobile.                                                                        | No mutable product media, hotlinks or generated imagery.                                                           |
| **P10B-04 — Premium shared storefront frame**            | Deepen header, navigation, announcement and footer.                                                 | P10B-02; registered shared-frame profiles and families.                              | Coherent frame with EN/FI keyboard, focus and four-width review.                                                           | No separate navigation authority or Puck document.                                                                 |
| **P10B-05 — Hero, editorial and campaign families**      | Deepen existing composition families.                                                               | P10B-02/03; registered component families and profiles.                              | Strong first impression and story pacing with asset/contrast review.                                                       | No merchant-specific components or invented claims.                                                                |
| **P10B-06 — Product-card and merchandising system**      | Consolidate card presentation across home, collection and related products.                         | P10B-02/03; canonical card presentation/bindings.                                    | Consistent merchandising with card-state and responsive evidence.                                                          | No third card authority or commerce mutation.                                                                      |
| **P10B-07 — Collection-page profile expansion**          | Add editorial discovery, catalogue comparison and campaign-led collection profiles.                 | P10B-04/06; `dynamicCollectionCommerce` and `PageBlueprint`.                         | Better filter, density, card and child-collection coordination.                                                            | No new collection shape or composition bridge.                                                                     |
| **P10B-08 — PDP profile expansion**                      | Add high-consideration, variant-led, editorial-gallery and standard PDP profiles.                   | P10B-03/04/06; `dynamicProductDetail` and `PageBlueprint`.                           | Stronger gallery, purchase, proof, service and related-product composition.                                                | No replacement PDP family or commerce-authority change.                                                            |
| **P10B-09 — Coordinated complete-storefront directions** | Make registered directions visibly coordinate frame, home, collection and PDP.                      | P10B-04–08; direction compatibility selection.                                       | Pairwise non-colour-only complete-storefront differences.                                                                  | Direction is not an inheritance/default layer.                                                                     |
| **P10B-10 — Narrative page composition**                 | Extend registered roles, flow rules and profile metadata.                                           | P10B family/profile work; narrative/flow contracts.                                  | Commercial pacing with adjacency, cardinality and commerce-context evidence.                                               | No free-text planner or unrestricted sections.                                                                     |
| **P10B-11 — Responsive visual closure**                  | Close registered transformations across all affected families.                                      | P10B-01–10; component/profile responsive contracts.                                  | 375/768/1024/1440 EN/FI geometry, accessibility and screenshots.                                                           | No arbitrary breakpoints or CSS escape hatch.                                                                      |
| **P10B-12 — Commercial visual-quality gate**             | Review the full canonical lifecycle, not only contracts.                                            | P10B-01–11; complete `StorefrontSnapshot` lifecycle.                                 | Credible-asset manual screenshot/browser review of home, collection, simple PDP and configurable PDP at 375/768/1024/1440. | Unit/schema-only, starter-theme, repetitive-stack, unexplained-gap or placeholder-only evidence cannot close P10B. |

**P10B exit gate:** Complete-storefront review proves commercial component/profile reachability,
meaningful directions, strong typography and imagery, coherent storytelling, coordinated cross-page
identity, commercially credible mobile output and protected-commerce correctness. Its manual
screenshot/browser review at 375, 768, 1024 and 1440 px rejects generic starter-theme appearance,
unexplained large gaps and repetitive component stacking.

### P10C — Storefront Studio Editing Experience v1 — planned

**Primary exit condition:** A merchant can select a frame, edit it manually in Puck, ask AI to redesign another frame, reorder sections, undo/redo, save, preview and publish. `StorefrontSnapshot` remains the shared canonical state.

| Task                                                    | Objective and canonical authority                                              | Merchant-visible result and evidence                                                   | Migration and explicit non-goals                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **P10C-01 — Brand asset library**                       | Migrate former P10B-01 into `AssetInventory` and approved placement authority. | Upload, approve, replace and reuse presentation assets.                                | No competing media system.                              |
| **P10C-02 — Asset roles and provenance**                | Migrate former P10B-02 roles/provenance/metadata.                              | Review role, approval, crop, locale and usage suitability.                             | Product media truth stays protected.                    |
| **P10C-03 — Canonical Puck editing boundary**           | Keep Puck transient and map edits to validated snapshot operations.            | Manual canvas cannot create a second Puck document.                                    | No Puck Cloud, Puck AI or Puck persistence.             |
| **P10C-04 — Stable frame identity**                     | Give shared frame/page sections stable canonical identity.                     | Select the intended frame or section reliably.                                         | No identity derived solely from transient editor order. |
| **P10C-05 — Approved manual frame operations**          | Permit registered add/remove/reorder/replace/property edits.                   | Manual editing preserves bindings, profiles and protected truth.                       | No arbitrary trees, CSS or protected-field edits.       |
| **P10C-06 — Scoped AI frame/page/shared-frame editing** | Expose validated P10A scopes through proposals.                                | AI redesigns the intended scope without silent widening.                               | No unreviewed mutation or cross-scope leakage.          |
| **P10C-07 — Unified AI/manual history**                 | Retain one snapshot history for accepted AI and manual operations.             | Exact undo/redo, save, preview and publish across both modes.                          | No parallel Puck history.                               |
| **P10C-08 — Brand and asset editor with Studio shell**  | Migrate former P10B-04 shell and connect asset governance.                     | Merchant-language Design/AI workflow, proposal review and accessible responsive shell. | A polished shell cannot conceal weak generation.        |
| **P10C-09 — Studio commercial QA**                      | Validate Studio workflow against P10B-quality output.                          | Select/edit/reorder/undo/redo/save/preview/publish with responsive/a11y evidence.      | Does not reopen P10B visual-quality acceptance.         |

### P10D — Deferred registered advanced media and interactive presentation — planned

P10D follows P10B and P10C and does not block either. **P10D-01 — Generated-image lifecycle** migrates former P10B-03 through policy, proposal, review and approved-library promotion. Future registered work also includes **P10D-02 — Video**, **P10D-03 — GLTF/GLB and registered Three.js product presentation**, and **P10D-04 — Camera/lighting presets, mobile/accessibility fallbacks and performance budgets**. Registered, governed Three.js implementations are permitted only as registered interactive-presentation capabilities. AI may select or configure those capabilities but may not generate implementation code; each remains subject to registered component, asset, performance, accessibility and non-interactive-fallback authority. No arbitrary generated application code or arbitrary/generated Three.js implementation is permitted.

### P11 — Stable domains and Vesko reference adapters — planned

Former Phase 12 stable-domain and adapter work migrates here after P10D: consolidate project, commerce, media, source-discovery, persistence, publishing, provider and observability ports, then prove a Vesko reference adapter against the same conformance fixtures as standalone implementations.

### P12 — Production hardening and operations — planned

Former later deployment work migrates here after P11: authentication, authorization, tenancy, production secrets, staging transports, deployment, health checks, observability, recovery, pilot rollout and support runbooks. Production hardening is not a P10B/P10C gate.

## 5. Current execution focus

Canonical Phase 9 is active. No P10A, P10B, P10C, P10D, Phase 11 or Phase 12 foundation closes Phase 9.
The binding sequence is minimum proof-enabling reachability, coordinated composition,
commerce/assets, atomicity and persistence/publish. Broad commercial vocabulary scaling belongs to
P10B after Phase 9 and P10A publishing closure.

## 6. Canonical phase sequence

1. Complete Phase 9 meaningful grounded multi-page generation and its evidence matrix.
2. Complete P10A grounded orchestration.
3. Complete P10B Commercial Storefront Design System v1.
4. Complete P10C Storefront Studio Editing Experience v1.
5. Complete deferred P10D registered advanced media and interactive presentation work only when justified.
6. Complete P11 stable canonical domains and Vesko reference adapters.
7. Complete P12 production hardening and operations.

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
