**VESKIFY**

**Software Design
Specification**

Dynamic storefront generation · URL-first onboarding · reusable commerce components · Vesko integration handoff

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| **DOCUMENT FIELD**          | **VALUE**                                                              |
|-----------------------------|------------------------------------------------------------------------|
| **Document ID**             | VESKIFY-SDD-001                                                        |
| **Version**                 | 1.2.2                                                                  |
| **Status**                  | Corrective grounded-generation architecture amendment; Phase 9 active  |
| **Date**                    | 31 July 2026                                                           |
| **Merchant-facing product** | Vesko Storefront Studio                                                |
| **Internal engine**         | Veskify                                                                |
| **Primary use**             | Codex implementation, teammate handoff and Vesko Retail OS integration |
| **Repository state**        | Standalone product repository with defined Vesko adapter boundary      |

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>v1.2.2 decision</strong></p>
<p>Veskify is the controlled storefront-design engine that powers Vesko Storefront Studio. It composes coordinated editable storefronts from controlled component families, registered PageBlueprint recipe profiles and bounded design parameters; it never generates arbitrary page code or a competing storefront model.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Owner: Vesko Oy · Product owner: Leo Fadi

# Document control
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Purpose of this document</strong></p>
<p>This specification supersedes the product direction and roadmap portions of v1.1 while preserving its safety architecture. It defines the next development path for a real Vesko product: URL-first merchant onboarding, brand reconstruction, asset-aware generation, reusable dynamic components, schema-driven product pages and a clean integration handoff.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Field**                      | **Definition**                                                                                                                                                                                           |
|--------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Product name**               | Merchant-facing: Vesko Storefront Studio. Internal controlled design engine: Veskify.                                                                                                                    |
| **Primary objective**          | Remove the heavy storefront design and setup burden from new Vesko customers, including merchants who have an existing website but little or no usable brand system beyond a logo.                       |
| **Primary onboarding route**   | Improve an existing store from a public website URL, then reconcile discovered design evidence with canonical Vesko catalogue and product data.                                                          |
| **Secondary onboarding route** | Create a new storefront from business information, logo, canonical catalogue data and guided visual choices.                                                                                             |
| **Commerce boundary**          | Veskify consumes read-only canonical Vesko product, collection, price, variant, option and media projections. It does not become an inventory, order, payment, logistics or catalogue-management system. |
| **Implementation authority**   | The requirement IDs, architecture boundaries, roadmap gates and acceptance criteria in this document are binding for v1.2 work.                                                                          |
| **Source basis**               | VESKIFY SDD v1.1, the approved Vesko Storefront Studio product-design direction, repository evidence at each stated amendment baseline and explicitly recorded evidence limitations.                  |
| **Historical v1.2.1 baseline** | `8174b1a6d31301b4072622e2e3ef675957479121`; the earlier corrective-amendment baseline, not the v1.2.2 source.                                                                                              |
| **Historical v1.2.1 branch**   | `codex/sdd-v1.2.1-grounded-storefront-generator`; retained as historical provenance only.                                                                                                                |
| **v1.2.2 amendment baseline**  | `4a96a5a5567b83e62306f73f7069e0e09f0c8683` (`origin/main` at the commercial-design-vocabulary amendment start and the merge commit containing P9R-06).                                                  |
| **v1.2.2 amendment branch**    | `codex/sdd-v1-2-2-commercial-design-vocabulary-recovery`.                                                                                                                                                 |
| **Generated document version** | `docs/VESKIFY_SDD_v1.2.2.docx`, deterministically synchronized from this Markdown specification.                                                                                                          |
| **Current PR delivery record** | PR #132 was automatically reviewed at initial delivery commit `bba2827e63f2027c946138f6c91362f3f989b088`; GitHub records the later review-fix delivery commit, which is not invented or embedded before it exists. |
| **PR #123 evidence**           | Merged 30 July 2026 as `8174b1a6d31301b4072622e2e3ef675957479121`; narrowly verifies exact token-refinement preservation and does not prove a complete generated storefront.                              |


## Source of truth

- `docs/VESKIFY_SDD.md` is the authoritative implementation baseline.
- `docs/VESKIFY_SDD_v1.2.2.docx` is the synchronized human-readable export.
- `docs/VESKIFY_SDD_v1.2.1.docx` is retained as the superseded synchronized export.
- `docs/VESKIFY_SDD_v1.2.docx` is retained as the superseded v1.2 export.
- `docs/archive/VESKIFY_SDD_v1.1.docx` is retained only as historical context and is superseded for new work.
- ADR-001, ADR-002, ADR-003 and ADR-004 are binding architectural decisions that clarify this SDD.
- If Markdown and DOCX differ, the Markdown specification takes precedence.
- Update this Markdown specification first, then synchronize the DOCX export and affected supporting documents.

## Revision history
| **Version** | **Date**        | **Status**                       | **Summary**                                                                                                                                                                                                                                                                                   |
|-------------|-----------------|----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1.0         | 15 July 2026    | Initial baseline                 | Established the standalone controlled storefront-editor product.                                                                                                                                                                                                                              |
| 1.1         | 16-17 July 2026 | Controlled design-agent baseline | Added structured skills, operations, proposal-before-apply, canonical composition ownership, validation and Puck boundaries.                                                                                                                                                                  |
| 1.2         | 22 July 2026    | Product integration baseline     | Repositions Veskify as the Vesko design engine; makes URL-first onboarding primary; replaces catalogue/import drift with canonical Vesko projections; specifies reusable dynamic components and a schema-driven product-detail page; resets the roadmap after the verified real-AI milestone. |
| 1.2         | 29 July 2026    | P9-04D acceptance clarification  | Incorporates the Lumo real-AI design-diversity gate for complete storefront directions, canonical-commerce protection and measured cross-page quality. |
| 1.2.1       | 30 July 2026    | Corrective amendment             | Defines grounded generation over the existing canonical storefront state, corrects the Phase 9 quality gate and evidence ownership, and binds the P10A/P10B/P11/P12 delivery order without rewriting the v1.2 safety architecture. |
| 1.2.2       | 31 July 2026    | Commercial design vocabulary      | Defines controlled component families, registered PageBlueprint recipe profiles, bounded parametric design, inheritance, reachability and visual-quality gates; it does not close Phase 9 or unblock P10A. |
| 1.2.2       | 5 August 2026   | Authoritative commercial roadmap synchronization | Assigns P10B Commercial Storefront Design System v1 after P10A publishing closure; migrates former P10B Studio/asset work to P10C, defers advanced media to P10D, and sequences integration and production hardening afterward. |

## v1.2.1 corrective amendment — grounded storefront generation

This amendment is binding where it clarifies or corrects v1.2. Unchanged v1.2 requirements remain
in force. It does not create a v1.3 architecture or mark Phase 9 as closed.

### Product position and grounded workflow

commercetools uses AI primarily to help developers generate storefront software. Veskify uses AI to
generate and continuously govern merchant-editable storefront design state. Veskify is not a
commercetools clone. The useful lesson from capability-grounded storefront generators is the
workflow: discover available capabilities, retrieve exact schemas, plan, validate and implement
deterministically.

The grounded workflow is:

```text
Approved Storefront Design Brief + canonical commerce projection
  -> retrieve registered components, variants, bindings, blueprints and skills
  -> route the merchant instruction to an explicit scope
  -> create a validated Proposal over the current StorefrontSnapshot
  -> compile through deterministic operations and guards
  -> merchant review and atomic accept/reject
  -> the same StorefrontSnapshot lifecycle for editor, preview, save and publish
```

Provider output is never an executable page graph, component implementation, publication payload or
second source of truth. It may select only capabilities supplied by the current repository.
The AI MUST NOT invent components, component variants, props, slots, bindings, asset roles,
PageBlueprints or registered recipe profiles, adapter capabilities, operation types or versions.

### One canonical storefront intermediate representation

The canonical terms are:

| Term | Binding meaning |
| --- | --- |
| `StorefrontSnapshot` | The single canonical editable storefront aggregate used by generation, editing, preview, save, history and publication. |
| `BrandSystem` | The snapshot-owned design-token and brand-direction contract. |
| `ComponentDefinitionV2` | The engineering-owned, versioned component capability contract. |
| `PageBlueprint` | The canonical executable page-composition contract. A commercial recipe is only a registered, constrained profile or preset of permitted/default PageBlueprint values; current `StorefrontTemplateDefinition` contracts are its implementation precursor and must converge rather than fork. |
| `DataBinding` | The typed presentation binding from controlled components to canonical context. |
| `ProductPresentationContext` | Read-only commerce presentation input for dynamic product components. |
| `Proposal` | A transient, validated change set over a known snapshot revision; it is not canonical storefront state. |

Every generation and editing path MUST compile into the same `StorefrontSnapshot`. The existing
implementation type `PageModel` is a page member inside `StorefrontSnapshot`; it MUST NOT be treated
as an alternate canonical root. Names such as `StorefrontPlan`, `SectionNode`, AI-native page graph
or provider registry MUST NOT become a second canonical storefront model. Planner payloads,
whole-storefront projections and renderer adapters are transient boundary representations only.

No second component registry, binding registry, blueprint system, skill catalogue, asset inventory
or publish graph may compete with the existing canonical contracts. New query layers MUST be
generated from, or directly backed by, those contracts.

### Corrected Phase 9 gate and delivery order

Phase 9 remains active. Its outcome is a meaningful coordinated multi-page storefront: shared
frame, homepage, collection and dynamic PDP compositions must use compatible registered
capabilities, preserve canonical commerce, apply atomically and survive save/preview/publish.
Token-only refinement, palette fidelity, a provider-shaped response, one changed section or
renderer-only variety is insufficient.

One merchant instruction must create a materially new coordinated storefront across the shared
header, navigation, announcement bar where present, footer, homepage, collection and representative
product-detail pages. Objective composition evidence includes:

| Area | Material changes required |
| --- | --- |
| Shared storefront frame | Header, navigation, announcement-bar and footer treatment. |
| Homepage | Hero composition; section hierarchy/order; product or collection presentation; story/campaign composition; rhythm and density. |
| Collection | Header treatment; filtering/discovery; product-card composition; merchandising density; collection hierarchy. |
| Product detail | Gallery; product-information hierarchy; options and specifications; purchasing-area hierarchy; related products. |
| Whole storefront | Coherent typography, surfaces, spacing/density, image treatment and page-to-page direction. |

Colour, typography, copy, spacing or density alone; one hero; homepage-only change; one changed page;
unchanged recipes with new tokens; a generic starter theme; unrelated page designs; provider HTTP
success; or a valid but visually immaterial proposal MUST fail the Phase 9 closing gate.

The binding order inside Phase 9 is:

1. establish the smallest registered and end-to-end reachable capability set required to prove
   meaningful multi-page composition;
2. prove coordinated page and shared-frame composition;
3. prove commerce and approved-asset preservation;
4. prove atomic application, rejection, stale protection and undo;
5. prove persistence, preview and explicit publication of the accepted snapshot.

P9-03 may repair reachability of already registered capabilities, expose the smallest curated set
required by the Phase 9 directions, correct planner/compiler/renderer gaps and enable the minimum
editorial, modern-technical and warm compositions needed for acceptance. It MUST NOT become broad
or unrestricted vocabulary scaling. Broad commercial vocabulary expansion occurs after the Phase
9 proof gates and P10A publishing closure, through P10B’s use of the generated registry and canonical validation.

Phase 9 retained brief-handoff evidence MUST show this complete lifecycle: authoritative
Storefront Design Brief creation → merchant review → explicit approval → approved
revision/fingerprint recording → runtime generation receiving that exact revision → correlated
proposal → storefront review and acceptance. The retained package MUST include project ID, brief
ID, approval state, actor/action/timestamp and runtime request correlation, and MUST prove that no
later unapproved brief mutation supplied generation. A deterministic fixture or a validated but
unapproved brief is not closing evidence.

Protected commerce, history, rollback and explicit publishing are invariants throughout this order;
they are never deferred while composition is proved.

PR #123 is merged evidence for exact valid token refinement, including preservation semantics. It
is not evidence that `generateInitialStorefront` or `coordinateWholeStorefront` has passed this
whole-store gate. The current repository also contains mocked provider-boundary and deterministic
lifecycle tests, but no retained evidence proving the required live-provider journey and complete
visual matrix. Those limitations are recorded in
`docs/PHASE_9_EVIDENCE_MATRIX.md`.

The verified PR #123 correction records `spacing: null` for preservation-only spacing, maps
`#201A17` to primary/text, `#C9A27A` to secondary/accent, `#6B2E3D` to button/strong accent and
`#E7D8C8` to surface/border, resolves heading/body intent to registered system serif/sans, issues
one canonical storefront POST, advances local authority once on acceptance and preserves structure,
navigation, assets, bindings and commerce. Automated coverage uses provider-shaped or mocked
transport; a live network response is not retained and therefore is not claimed.

### Acceptance ownership correction

The existing acceptance IDs retain their wording, but their phase ownership is clarified:

| Acceptance | Binding owner |
| --- | --- |
| AC-119 | Phase 9 asset resolution and approved reuse/generation choice. |
| AC-120 | Later demo-reliability work; it does not prove generation quality. |
| AC-121 | P10C Storefront Studio merchant UX. Phase 9 still owns fixture/provider/internal-term leakage in generated storefront output. |
| AC-122 | Split: Phase 9 owns generated storefront output at all target widths; P10C owns Storefront Studio shell and workflow responsiveness. |
| AC-123 | Split: Phase 9 owns generated storefront semantics and interactive commerce controls; P10C owns Studio controls, proposal review, save and publish accessibility. |

Phase 9 additionally owns exact valid token instructions, meaningful initial generation,
coordinated multi-page composition, registered component reachability, protected-commerce and
asset fidelity, invalid/stale rejection, atomic application and undo, output responsiveness,
fixture leakage, real-provider evidence, the approved Storefront Design Brief-to-runtime handoff
required by FR-105 and the accepted snapshot’s save/preview/publish path.

### Grounded capability roadmap

P10A establishes grounded orchestration without changing the canonical state model:

1. **P10A-01 — Vocabulary freeze:** publish canonical names, aliases and transient-boundary rules.
2. **P10A-02 — Repository capability audit:** map live components, variants, bindings, templates,
   renderers and planner/compiler reachability.
3. **P10A-03 — Executable PageBlueprint contracts:** evolve the current template contracts into
   validated composition rules that compile to `StorefrontSnapshot`.
4. **P10A-04 — Generated Component Knowledge Registry:** generate a queryable capability view from
   canonical contracts, including the executable PageBlueprint contracts produced by P10A-03.
   P10B consumes this registered view for commercial vocabulary and visual-quality expansion.
5. **P10A-05 — Separate Skill package contracts:** define instructions, schemas, authorities,
   allowed scopes, capability requirements, operations, validation and evidence for initial
   generation and follow-up editing separately.
6. **P10A-06 — Scoped instruction-router contracts:** define scope classification, authority
   declarations, routing schemas and validation rules that prohibit silent authority widening.
7. **P10A-07 — Evidence-harness groundwork:** deterministic and real-provider evaluation
   infrastructure across representative catalogues, including at least one non-jewellery merchant.
8. **P10A-08 — Publish compiler:** deterministically validate and publish the accepted canonical
   snapshot with no AI at publication time.

The P10A-02 audit MUST produce a live gap matrix with columns Capability, Existing source,
Runtime-queryable, Planner-visible, Compiler-preserved, Validated, Rendered and Missing work. Each
row is classified existing-and-sufficient, existing-but-not-queryable, duplicated,
planner-visible-but-lost, render-only or missing. Capability facts found only in prompts, tests,
fixtures or allowlists must be identified before P10A-03 contract design.

P10A-03 PageBlueprint metadata includes ID/version/page type, required and optional families,
cardinality and order, binding and asset-role requirements, responsive composition and
compatibility. It also owns the registered commercial recipe-profile representation: a profile
supplies permitted/default PageBlueprint values for required/optional slots, compatible
families/variants, default and permitted ordering, data bindings, approved-asset requirements,
responsive constraints, omission/fallback rules and cross-page coordination. It never becomes a
separate template graph or independently executable model. Recipe selection materializes or
constrains a canonical PageBlueprint. A blueprint is an independent generation starting point;
generated output becomes ordinary snapshot state and is not silently rewritten when the blueprint
later changes. Dynamic PDP and collection composition stays stable while runtime bindings resolve
different entities.

P10A-04 is generated from `ComponentDefinitionV2`, the executable PageBlueprint contracts produced
by P10A-03, `DataBinding`, renderer, asset and adapter capability contracts, protected paths and
migration metadata. For each applicable component it exposes type, version, family, variants, page
types, slots and cardinality, props/content schemas, binding requirements, editable/protected paths,
responsive/accessibility rules, asset requirements, compatibility and migration version. Codex and
the live design agent query the same source. Registry generation cannot pass without the P10A-03
PageBlueprint contracts; unknown or stale capability references fail before preview.

P10A-05 defines versioned Skill package contracts for storefront orchestration, initial generation,
selected-section editing, shared-frame editing, current-page editing, page/whole-storefront
regeneration, brand tokens, homepage, collection, dynamic PDP, assets, image generation,
localization and validation/publish. Each contract declares its instructions, authority, required
capability queries, allowed operations, exact input/output schemas, examples, deterministic
fixtures, negative and validation cases and scope classification. A whole-store generation Skill
contract is never reused for one hero or page. This task does not make those editing packages
merchant-operable.

P10A-06 defines router contracts over the canonical scopes selected section/component, current
page, shared storefront frame, design system and complete storefront. “Shared storefront frame”
means navigation, header, announcement bar and footer. The contracts classify scope, declare
authority and require validation that rejects silent widening: “change this hero” cannot classify
as site-wide, “make this PDP technical” cannot include home, “navigation and footer” may classify as
shared frame and “use this palette everywhere” may classify as design system. Runtime explanations,
approval controls and proposal execution belong to P10C.

**Phase boundary:** P10A defines and validates the scopes. P10A does not deliver
merchant-operable granular editing. P10C implements and exposes those scopes as working merchant
features.

P10A-07 evidence-harness groundwork includes premium/minimal jewellery, editorial jewellery, a
watch retailer, a dense hardware/general-retail catalogue, EN/FI, a simple watch PDP and a complex
configurable ring PDP. The non-jewellery fixture is mandatory to detect luxury, jewellery, Karvonen
and sparse-catalog assumptions. P10A owns functional and publishing validation for governed
generation/follow-up execution, routing, proposal lifecycle, controlled-provider acceptance,
compiler/publish/render/rollback behavior and protected-commerce correctness. P10A does not close
on commercial visual polish. P10B owns commercial component/profile reachability for new
design-system capabilities, direction differentiation, credible-asset complete-storefront generation
and the final commercial screenshot/manual browser-quality gate; runtime mixed-scope history and
Undo/Redo for granular editing are P10C gates.

P10A-08 compiles validated draft `StorefrontSnapshot` → publish-time validation → immutable runtime
snapshot → published renderer. It rejects invalid bindings, unknown component versions, missing
required fields or critical assets, protected-field violations, critical accessibility failures
and unresolved migrations. Published storefronts require no LLM, Puck runtime, provider proposal
object or browser-accessible Vesko/provider credentials. Cart, checkout, order, inventory and
pricing mutation remain separate commerce operations.

P10A-08B establishes the server-owned accepted-snapshot publication authority seam. After an
authoritative proposal acceptance transaction, a server-only service may mint one immutable,
canonically fingerprinted receipt that binds the exact accepted `StorefrontSnapshot` to its project,
draft, proposal, review, accepted-runtime, registry, manifest, governed package/profile, commerce
and approved-asset authority where represented. The receipt repository is create-once and rejects
replay, collision, malformed, modified, missing, stale and cross-authority use. AI-originated
publication preparation accepts only the receipt identity, resolves trusted storage and validates
current authority; confirmation resolves and validates it again before a publication write. Manual
publication remains an explicit separate authority and cannot claim AI acceptance lineage.

P10A-08C-01 makes this seam effective at the active merchant route. The browser supplies only a
manual authority declaration or an accepted-receipt ID to a same-origin server boundary. That boundary
authenticates the merchant, requires `publishStorefront`, resolves receipt authority from trusted durable
storage, creates the existing `StorefrontPublishingGateway` request and retains the preparation server-side
for confirmation. It rechecks receipt/current-state authority at preparation and confirmation; the browser
cannot mutate a repository, move the published pointer, submit receipt content or fall back from accepted
AI to manual authority. The narrow server receipt store is create-once and parses immutable receipts on
retrieval; publication request records are also durable for idempotent retry.

Manual publication remains explicit and distinct from accepted-AI publication. This work leaves the
deterministic compiled-runtime artifact, atomic active-version switching, rollback closure and published
render-target closure to P10A-08C-02; it does not claim compiler closure.

### P10B Commercial Storefront Design System v1

P10B follows P10A publishing closure and is the first phase that broadens commercial visual quality. It owns commercial component/profile reachability for new design-system capabilities, direction differentiation, credible-asset complete-storefront generation and P10B-01 executable vocabulary, P10B-02 foundations, P10B-03 image/art direction, P10B-04 premium shared frame, P10B-05 hero/editorial/campaign families, P10B-06 product-card and merchandising system, P10B-07 collection profiles, P10B-08 PDP profiles, P10B-09 coordinated directions, P10B-10 narrative composition, P10B-11 responsive closure and P10B-12 visual-quality gate. These tasks extend only the existing canonical `BrandSystem`, registered `PageBlueprint` profiles, component families/variants, approved asset placement and `StorefrontSnapshot` lifecycle.

P10B closes only when credible assets prove a complete homepage, collection, simple PDP and configurable PDP at 375, 768, 1024 and 1440 px. Manual screenshot/browser review must prove strong typography and imagery, coherent storytelling, cross-page identity, meaningful directions, commercially credible mobile output and protected-commerce correctness; unit, schema, placeholder, generic-starter-theme, repetitive-stack or unexplained-gap evidence is insufficient.

### P10C Storefront Studio Editing Experience v1

P10C follows P10B. It migrates former P10B-01 to **P10C-01 Brand asset library**, former P10B-02 to **P10C-02 Asset roles and provenance**, and former P10B-04 to **P10C-08 Brand and asset editor with Studio shell**. It adds P10C-03 canonical Puck boundary, P10C-04 stable frame identity, P10C-05 approved manual frame operations, P10C-06 scoped AI frame/page/shared-frame editing, P10C-07 unified AI/manual history and P10C-09 Studio commercial QA. Existing `AssetInventory` roles/provenance remain the foundation; no competing media, Puck document or history model is introduced.

P10C closes when a merchant can select a frame, edit it manually in Puck, ask AI to redesign another frame, reorder sections, undo/redo, save, preview and publish. `StorefrontSnapshot` remains the shared canonical state; stable identity, approved bounded edits, protected bindings, scoped AI and unified AI/manual history are mandatory.

AC-119 remains solely a Phase 9 gate. P10C consumes the approved reuse/upload/generate decision; it does not claim the generated-storefront asset matrix or authorize generated imagery before P10D.

### P10D deferred advanced media and interactive presentation

Former P10B-03 becomes **P10D-01 Generated-image lifecycle**, after P10B and P10C. P10D also reserves registered video, GLTF/GLB product assets, registered Three.js presentation, camera and lighting presets, mobile/accessibility fallbacks and performance budgets. Registered, governed Three.js implementations are permitted only as registered interactive-presentation capabilities. AI may select or configure those capabilities but may not generate implementation code; each remains subject to registered component, asset, performance, accessibility and non-interactive-fallback authority. No arbitrary generated application code or arbitrary/generated Three.js implementation is permitted.

### P11 stable domains and Vesko reference adapters

Former Phase 12 work migrates to P11: canonical product, variant/option, collection/navigation, price/availability presentation, localization, product-media, brand-asset and generated-asset domains, plus versioned media, commerce, navigation and asset adapters with conformance fixtures. Vesko remains the first reference implementation, not a special case embedded through the editor.

### P12 production hardening and operations

Former later deployment work follows P11: authentication, authorization, tenant isolation, production persistence and secrets, hosted staging, observability, recovery, pilot operations, deployment and release runbooks. It is not a P10B or P10C prerequisite.

### Capability and recommendation status

Use these status words consistently:

- **Baseline:** merged and evidenced through the canonical lifecycle.
- **Partial:** merged foundations exist but the complete merchant outcome or required evidence is
  missing.
- **Planned:** approved future work with no claim of current availability.
- **Research recommendation:** an external pattern worth evaluating; it is not an implementation
  commitment or repository fact.

`applyExactBrandPalette` is Baseline only for exact token refinement proved by merged PR #123.
`coordinateWholeStorefront` remains Partial until meaningful shared-frame/home/collection/PDP
composition passes the Phase 9 gate. `generateInitialStorefront` remains Partial: a planner or API
response alone does not establish editor acceptance, persistence, preview and publish.

## v1.2.2 commercial design vocabulary and controlled composition

This amendment makes the commercial design-generation model explicit. It clarifies the existing
canonical architecture; it does not authorize product-code changes, a second registry, a second page
tree, arbitrary renderer input or a claim that Phase 9 has closed. P9R-06 proved the real editor
homepage-only generation path. P9R-07 whole-store global colour and typography routing is active
work at this amendment's baseline and is not claimed complete here.

AC-136 through AC-138 are P10B commercial-design-system acceptance criteria implemented after the
existing Phase 9 gate and P10A publishing closure. They are not required to close Phase 9 and
this documentation amendment does not satisfy them. Phase 9 remains open for its existing
whole-storefront generation, approved-brief handoff, protected-commerce, lifecycle, responsive,
accessibility and retained real-provider evidence requirements.

### Controlled component-family contract

A component family is one engineering-maintained renderer implementation with several
professionally designed, structurally meaningful variants. A variant changes architecture or
commercial presentation, not merely a colour, padding value or renamed identifier. Families include
shared header/navigation and footer; hero; featured product; product card/grid; collection
discovery; brand story; campaign; approved evidence/trust; collection header/filter/presentation;
and PDP gallery, information, options/purchasing, specifications and recommendations.

Every family MUST declare its compatible pages, slots, typed bindings, approved asset roles,
responsive and accessibility contract, editable and protected paths, and renderer implementation.
It MUST use the same registered implementation in editor, preview and published routes. Product-card
families, for example, may offer image-forward editorial, compact commerce, horizontal featured,
technical specification and minimal catalogue variants only where those variants are materially
distinct and commercially reviewable.

### Controlled PageBlueprint recipe-profile and slot contract

A commercial page recipe is a registered, constrained `PageBlueprint` profile or preset, not a
second page graph, template architecture or independently executable representation. The canonical
`PageBlueprint` remains the executable page-composition contract. A recipe defines its
permitted/default values for:

- required and optional section slots;
- compatible component families and meaningful variants;
- default order and permitted controlled reordering;
- canonical data bindings and approved-asset requirements;
- responsive constraints and shared-frame/cross-page coordination;
- fallback and omission behavior when approved content is unavailable.

Recipe selection materializes or constrains a canonical `PageBlueprint`. Proposal, compiler,
snapshot, editor, preview, save, history and publish continue to operate through `PageBlueprint` and
`StorefrontSnapshot`; there is no recipe engine or separately persisted recipe representation. The
AI may select and populate a compatible registered profile through structured operations. It MUST
NOT generate arbitrary component trees, executable code or unregistered slots. A slot is satisfied
only when its registered cardinality, family/variant compatibility, binding, asset-role and omission
rules pass validation. Optional evidence or trust slots MUST be omitted when approved merchant
evidence is unavailable; defaults MUST NOT introduce unsupported delivery, material, durability,
guarantee, sustainability, popularity, performance or certification claims.

### Bounded parametric design and inheritance

Within an approved family/PageBlueprint-profile structure, AI may choose only typed, validated
parameters: semantic palette; typography system, heading scale and weight; spacing/density; radius;
border treatment; elevation/shadows; image ratio/crop/treatment; overlay strength; button treatment;
and card surface.
It MUST NOT emit raw CSS, arbitrary class names, JavaScript/React, unrestricted font imports or
layout values outside the registered contract. The renderer remains authoritative for CSS and
responsive behavior.

The binding inheritance order is:

```text
Global BrandSystem
  → registered PageBlueprint recipe profile
    → component family and variant
      → limited validated instance override
```

Local values normally derive from global semantic tokens. An instance override must be explicitly
allowed, typed and compatible with its family and PageBlueprint profile; it must not create an
unrelated visual language across sections or bypass global accessibility/responsive rules.

### P10B-01 narrative vocabulary and deterministic composition validation

P10B-01 formalizes the controlled middle layer without creating a second page graph, planner,
snapshot, proposal representation or component registry. `PageBlueprint` precursor plans carry
registered narrative metadata and continue to materialize only canonical page sections. The
controlled narrative roles are `orientation`, `primary-discovery`, `secondary-discovery`,
`product-focus`, `product-proof`, `brand-story`, `brand-proof`, `education`, `campaign`, `trust`,
`service`, `conversion` and `continuation`. They are exact registered IDs, never model-provided
free text. Each role declares page applicability, bounded visual weight, cardinality, opening and
closing eligibility, compatible component families, commerce requirements and accessibility intent.

Visual weight is one of `light`, `medium`, `heavy` or `dominant`. Registered flow rules can require,
prefer or prohibit adjacency; constrain opening/closing roles and role order; require protected
product context adjacent to conversion; bound repeated roles/families; and prohibit invalid
weight transitions, including adjacent dominant sections. Adjacent sections may declare only the
registered narrative transition intents `continuation`, `contrast`, `escalation`, `proof`,
`clarification`, `conversion` and `reset`; these describe composition, not animation or CSS.

The bounded parameter vocabulary separates structural values (layout model, registered order,
columns, media/alignment/information/filter/gallery placement, width, cardinality and responsive
collapse) from visual values (density, surface, weight, typography role, image/border/shape,
spacing, emphasis, background role and tone). Values are enums or registered numeric ranges. They
reuse `BrandSystem` semantics and component-prop vocabulary; they do not permit arbitrary CSS,
classes, fonts or raw style values. Parameter authority resolves deterministically as
`BrandSystem → PageBlueprint profile → component variant → instance`. A lower level may only narrow
an inherited enum set or numeric minimum/maximum and may override only when that registered
parameter permits it. The effective numeric range is accumulated at every authority level; a later
value outside it, a restored broader range, contradictory bounds, ambiguous last-write-wins
resolution and prohibited instance overrides fail with stable typed errors. An explicit empty
component parameter allowlist permits no bounded parameters; legacy broad compatibility is an
explicit adapter contract, never an empty-list fallback.

`ComponentDefinitionV2` declares narrative, weight, transition, parameter, PageBlueprint-profile
and commerce compatibility. Legacy registered components receive a deterministic broad compatibility
adapter until P10B-04 through P10B-06 add family-specific commercial metadata; this preserves
existing Phase 9 snapshots and proposals. PageBlueprint plans declare allowed/required roles,
flow-rule IDs, cardinality, bounded-parameter and responsive constraints while retaining their
existing slot, family/variant, binding and omission rules. P10B-01 supplies contracts and
deterministic validation only. P10B-04 through P10B-06 supply commercial families/variants;
P10B-07/08 supply executable constrained PageBlueprint profiles; P10B-09 through P10B-12 supply
coordinated direction selection, visual quality and full-chain evidence. P10B-01 alone does not
claim commercially strong storefront output.

Every referenced flow rule must be registered for the page type; unknown or incompatible rule IDs
fail closed. A section satisfies both its role's visual-weight allowance and its component
compatibility; a broad component adapter cannot widen a role. Each conversion occurrence must have
its required adjacent protected product-focus context, including repeated conversions. Required
roles must be satisfiable by non-omittable compatible slots: the initial PDP's always-present product
information/purchase section owns conversion, while optional product-options may be omitted without
creating false required semantics.

Resolved template selections created before P10B-01 are persisted as v2 execution identities with no
narrative metadata. Current selections are v3. A v2 selection is migrated only in memory by verifying
each legacy homepage, collection and product plan against the registered pre-P10B-01 execution
identity, then re-resolving that exact registered plan with P10B-01 metadata. Modified legacy plans
and unknown future versions fail closed. Migration neither writes project state nor changes canonical
commerce, bindings, assets, variants or routes; it never mistakes parser defaults for merchant
selected semantics.

### Commercial library, compatibility and reachability

The initial commercial library target is approximately 10–15 major section families, 3–5 genuinely
distinct variants per applicable family, 3–4 coordinated registered PageBlueprint recipe profiles
for each major page type, and strong typography, spacing, surface, shape, elevation and
image-treatment controls. These are depth and quality targets, not registry quotas: a smaller
excellent library is preferable to many visually equivalent variants.

Recipes, family variants, optional slots, permitted ordering, design-system parameters, approved
assets and merchant/commerce data together create hundreds of materially distinct coordinated
storefronts and thousands of controlled variations. Not every theoretical combination is valid.
Compatibility, PageBlueprint-profile constraints, responsive rules, accessibility and cross-page
coordination MUST filter invalid or low-quality combinations.

P10B-07 and P10B-08 implement the coordinated commercial recipes only as registered constrained
`PageBlueprint` profiles. P10A-03 remains the canonical implementation contract and MUST NOT
duplicate or synchronize a separate recipe/template representation.

A capability is not complete merely because it appears in a registry. It must be:

```text
registered → planner-selectable → proposal-expressible → compiler-preserved
→ StorefrontSnapshot-stored → renderer-visible → editor-editable → manually live-proven
```

Documentation, task acceptance matrices and release evidence MUST use this complete reachability
chain. `StorefrontSnapshot` remains the sole stored canonical aggregate throughout it.

### Commercial visual-quality and protected-commerce gate

Visual acceptance MUST include screenshot-level review at the defined mobile and desktop widths
(375, 768, 1024 and 1440 px), reviewing homepage, collection and PDP together as one coordinated
storefront. Final commercial acceptance uses real or representative approved assets; placeholder SVGs
are insufficient. Review each variant for hierarchy, density, composition, spacing, typography,
imagery and commerce usability. Schema validity, metadata, fingerprints, snapshots and registry
counts do not establish visual quality, and no phase may close on deterministic tests without a
merchant-visible browser result.

Structural and visual composition may change only while preserving canonical product IDs, variant
IDs, SKUs, prices, stock, availability, options, collection membership/order, routes, canonical
media, media bindings and approved asset IDs/provenance.

## How implementation agents and developers must use v1.2.2
1.  Read the complete affected section and named requirement IDs before modifying code.

2.  Preserve the v1.1 non-negotiables: controlled components, structured operations, validation, protected commerce truth, proposal review, reversible drafts and separate publishing.

3.  Do not introduce another catalogue, product-type or variant model inside Veskify. Use a read-only presentation projection from Vesko or a fixture that follows the same contract.

4.  Build reusable component families and data-binding contracts before adding merchant-specific layouts.

5.  Keep the merchant experience free from developer concepts such as raw JSON, registries, provider envelopes, component IDs and prompt internals.

6.  Every task must state the user-visible capability, affected requirements, tests, constraints, branch/PR rules and integration impact.

## Requirement language
| **Term**     | **Meaning**                                                                |
|--------------|----------------------------------------------------------------------------|
| **MUST**     | Mandatory for the defined capability or release gate.                      |
| **MUST NOT** | Prohibited.                                                                |
| **SHOULD**   | Expected unless a documented implementation constraint justifies deferral. |
| **MAY**      | Optional or adapter-specific.                                              |

## v1.2.2 requirement catalogue
The following stable v1.2 requirement IDs and v1.2.1/v1.2.2 additions are binding for implementation tasks.
They replace the obsolete v1.1 roadmap identifiers for new work while preserving the
controlled-agent, protected-commerce, reversible-draft and explicit-publishing safety model.

### Functional requirements
| **ID**     | **Requirement**                                                                                                                                                                                          |
|------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **FR-101** | Veskify MUST operate as the controlled storefront-design engine for Vesko Storefront Studio while the standalone repository remains only an implementation, validation and demo environment.              |
| **FR-102** | Veskify MUST preserve product identity and commerce boundaries: no design flow may own or mutate catalogue management, product types, variants, prices, stock, inventory, orders, payments, tax or logistics. |
| **FR-103** | The primary onboarding path MUST start from an existing public storefront URL, discover reusable source evidence and present it without changing the current draft.                                      |
| **FR-104** | Source discovery MUST record evidence, provenance, warnings and confidence, and MUST reconcile discovered products, collections and assets against canonical Vesko commerce data before generation.       |
| **FR-105** | The merchant MUST approve a Storefront Design Brief before initial generation; the brief MUST include business profile, source summary, brand direction, approved assets, page plan, assumptions, warnings and protected commerce source. |
| **FR-106** | Brand reconstruction MUST work from logo, public-site evidence, product imagery, merchant preferences and industry presets, including exact valid palette instructions when schema and contrast validation pass. |
| **FR-107** | Asset inventory, selection and reuse MUST preserve asset IDs, role eligibility, responsive crop metadata, provenance and merchant approval; generation MAY be offered only when reusable assets are insufficient or explicitly requested. |
| **FR-108** | AI design changes MUST use controlled proposals, approved skills, structured operations, target-bound permissions, validation and merchant review before draft mutation.                                  |
| **FR-109** | The component platform MUST provide reusable ComponentDefinitionV2 families, variants, slots, bindings, page blueprints, migrations and shared editor/preview/published renderers.                       |
| **FR-110** | Storefront components MUST bind to a canonical read-only Vesko commerce projection and MUST NOT create a competing product, product-type, option, variant or catalogue model.                            |
| **FR-111** | Dynamic product-detail pages MUST render option groups, dependencies, required states, variant resolution, media, price and availability from canonical product configuration.                            |
| **FR-112** | Collection-page presentation MUST bind collection headers, filters, product grids, merchandising rows and no-results states to canonical collection/product data without changing membership or commerce truth. |
| **FR-113** | Whole-storefront design changes MUST coordinate global tokens, navigation, footer and representative pages through one validated proposal and atomic application/undo path.                              |
| **FR-114** | Generated and edited storefronts MUST meet responsive and accessibility quality requirements across merchant onboarding, editor, proposal review, dynamic PDP, collection and publishing surfaces.        |
| **FR-115** | Draft, history, Save draft, Publish and Restore MUST remain separate: accepted changes mutate the active draft only, Save persists draft only, Publish requires explicit confirmation and Restore creates a draft. |
| **FR-116** | Vesko Storefront Studio MUST expose a merchant-facing product shell and language that hides raw JSON, registry IDs, provider payloads, component internals and developer tooling.                        |
| **FR-117** | Provider failure, validation failure, stale context and demo reset/load flows MUST preserve active draft/history and keep deterministic mock-provider reliability for repeatable tests and demos.         |
| **FR-118** | Future Vesko adapters and teammate handoff MUST map project, commerce, media, storage, publishing, source discovery, AI provider and observability contracts without redesigning the Veskify engine.     |
| **FR-119** | The component platform MUST use controlled component families with meaningful variants, typed slots, compatibility rules, approved bindings/assets and one shared editor/preview/published renderer implementation. |
| **FR-120** | Each commercial recipe MUST be a registered constrained `PageBlueprint` profile that defines required/optional slots, compatible families/variants, default and permitted ordering, data bindings, approved-asset requirements, responsive constraints, omission/fallback rules and cross-page coordination without a second executable representation. |
| **FR-121** | AI composition MUST select only registered PageBlueprint recipe profiles, compatible registered families/variants, permitted ordering and typed bounded design parameters; proposals and PageBlueprints MUST reject arbitrary trees, raw CSS, arbitrary class names, executable JavaScript/React or generated code, unrestricted font imports and layout/style values outside registered bounds. |
| **FR-122** | Design inheritance MUST flow from `BrandSystem` through a registered PageBlueprint recipe profile and family/variant to constrained validated instance overrides; semantic tokens normally flow downward, renderer-visible values remain derived from canonical typed state, and invalid or unrelated local visual-language overrides MUST fail validation. |
| **FR-123** | Optional evidence/trust content MUST be omitted without approved evidence, and registry defaults MUST NOT make unsupported commercial claims. |
| **FR-124** | Commercial capability completion MUST prove the documented reachability chain and screenshot-level coordinated homepage/collection/PDP browser review with representative approved assets. |

### Non-functional requirements
| **ID**      | **Requirement**                                                                                                                                                                                     |
|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **NFR-101** | Security and protected commerce data MUST be enforced at every source, provider, operation, binding, storage and publishing boundary; untrusted source/provider content cannot grant permissions.   |
| **NFR-102** | Merchant-facing flows MUST meet WCAG 2.2 AA expectations for keyboard access, focus visibility, semantics, labels, contrast and dynamic state announcements.                                      |
| **NFR-103** | Responsive behaviour MUST be validated for primary surfaces at 375, 768, 1024 and 1440 px with no visible clipping, overlap or unusable dynamic controls.                                        |
| **NFR-104** | Performance-sensitive editor interactions SHOULD feel immediate, while source discovery, resolver calls and provider work run asynchronously with visible progress and bounded failure states.      |
| **NFR-105** | Reliability and rollback MUST be deterministic: failed, invalid, stale or rejected proposals, saves, publishes and restores preserve the last valid active, saved and published state.             |
| **NFR-106** | Observability MUST record safe metadata such as request ID, provider, scope, operation count, validation result, latency, failure category, component versions and commerce revision without secrets or full prompts by default. |
| **NFR-107** | Provider isolation MUST keep provider-specific formats, credentials, errors and retries behind adapters; deterministic fixtures remain the default for local and automated tests.                  |
| **NFR-108** | Deterministic testing MUST cover schemas, bindings, source evidence, proposals, atomic application, adapter conformance, responsive/accessibility gates and the customer-ready journey.             |
| **NFR-109** | Maintainability MUST preserve integration boundaries: Puck stays isolated, canonical domain/application modules avoid UI/provider dependencies, and historical documents remain superseded context. |
| **NFR-110** | Commercial visual quality MUST be assessed at 375, 768, 1024 and 1440 px for hierarchy, density, composition, spacing, typography, imagery and commerce usability; deterministic/schema-only evidence is insufficient for phase closure. |

# Contents
- 1\. Executive product definition

- 2\. Comparison with v1.1 and required corrections

- 3\. Current verified implementation baseline

- 4\. Users, roles and jobs to be done

- 5\. Product boundaries and ownership

- 6\. End-to-end merchant journeys

- 7\. URL-first source discovery and reconciliation

- 8\. Brand reconstruction and asset-aware generation

- 9\. Reusable dynamic component platform

- 10\. Dynamic product-detail page system

- 11\. Homepage and collection-page design depth

- 12\. AI design-agent specification v1.2

- 13\. Storefront design system and whole-site consistency

- 14\. Vesko Storefront Studio merchant experience

- 15\. Data model and contracts

- 16\. Technical architecture and Vesko integration

- 17\. Security, privacy, performance and observability

- 18\. Testing and release acceptance criteria

- 19\. Correct development roadmap

- 20\. Handoff and final integration package

- Appendices

# 1. Executive product definition
Veskify is the controlled AI storefront-design engine used by Vesko Storefront Studio. It enables a merchant with limited technical or design knowledge to transform business information, an existing public website, a logo, available media and canonical Vesko commerce data into a coherent, responsive and editable storefront.

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Core merchant promise</strong></p>
<p>Connect what you already have, approve the design direction, receive a complete storefront, and keep improving it through plain-language instructions — without rebuilding product data, writing code or becoming a web designer.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 1.1 Product goal
The product goal is to remove the heavy UI, visual-design and storefront-composition work from Vesko onboarding. A new customer should not need a complete brand guide, a developer or a separate web-design project before using Vesko. When the merchant has an existing website, that site becomes design evidence and reusable source material; Vesko commerce data remains the operational truth.

## 1.2 Product identity
| **Layer**                | **Name**                | **Merchant visibility** | **Responsibility**                                                                                                  |
|--------------------------|-------------------------|-------------------------|---------------------------------------------------------------------------------------------------------------------|
| Vesko module             | Vesko Storefront Studio | Visible                 | Onboarding, design workspace, preview, draft, publishing and history within Vesko Retail OS.                        |
| Design engine            | Veskify                 | Usually hidden          | Intent, planning, design skills, component selection, structured operations, validation, proposals and composition. |
| Visual editor foundation | Puck integration        | Hidden as technology    | Canvas mechanics, section selection, insertion, reordering and field controls through an isolated adapter.          |
| AI provider              | Configured text model   | Hidden                  | Model execution only. Provider-specific output never becomes canonical application state.                           |

## 1.3 What Veskify designs
- Global brand and design tokens derived from merchant evidence and approved preferences.

- Navigation, header, footer, homepage, collection pages, product-detail pages, content pages, campaign pages, cart and checkout presentation.

- Responsive compositions using controlled component families and reusable page blueprints.

- Presentation of canonical product data, including media, attributes, variants, option groups, prices, compare-at prices, availability labels and order options.

- Editable marketing copy, SEO metadata, translations and non-factual presentation enrichment.

- Asset selection, cropping role, placement and reuse; optional image generation only when approved assets are insufficient or explicitly requested.

## 1.4 What Veskify does not own
- Product creation, catalogue management, product-type definitions or operational inventory.

- SKU, price, compare-at price, stock, availability truth, variant values or order-option values.

- Payments, taxes, logistics, shipping configuration, orders, returns or invoicing.

- Unrestricted code generation, arbitrary CSS, scripts, plugins or merchant-executed embeds.

- An independent customer-data model that competes with Vesko Retail OS.

## 1.5 Standalone repository and real-product rule
The standalone repository remains the fastest environment for implementation, deterministic tests, real-provider validation and demonstrations. It must, however, behave as a replaceable module. IndexedDB, local fixtures and demo routes are adapters, not assumptions that may leak into domain or editor logic. Every new contract must have a clear mapping to Vesko authentication, canonical commerce data, media, persistence and publishing services.

# 2. Comparison with v1.1 and required corrections
Version 1.1 correctly established the controlled-agent safety architecture. Its main weakness is product sequencing: it still frames the repository as a standalone demo with broad import and catalogue-intelligence work, while the actual product need is a Vesko-integrated design agent that can reconstruct an existing storefront, reuse available assets and render dynamic product types safely.

| **Area**                 | **v1.1 position**                                                | **v1.2 decision**                                                                                                                                  | **Action**                                 |
|--------------------------|------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------|
| **Product positioning**  | Standalone interactive demo, later integrated.                   | Integration-ready Vesko product module; standalone repository is the implementation environment.                                                   | Replace framing.                           |
| **Merchant-facing name** | Veskify / AI Storefront Design Agent.                            | Vesko Storefront Studio; Veskify remains the internal engine.                                                                                      | Replace naming in merchant UI.             |
| **Primary onboarding**   | New store, redesign and demo preset treated as peers.            | Improve existing store by URL is primary; new store is secondary.                                                                                  | Reorder journey and screens.               |
| **Brand inputs**         | Upload brand guide or use guided creation.                       | Assume many merchants only have a logo and public website; reconstruct brand evidence and ask only for material gaps.                              | Expand requirements.                       |
| **Catalogue scope**      | Dummy catalogue plus CSV/Excel mapping and product intelligence. | Consume canonical Vesko commerce projections. CSV/Excel/import work is not a prerequisite for the design-agent product.                            | Narrow and defer.                          |
| **Component system**     | Controlled registry and a list of components/variants.           | Explicit layered platform: primitives, patterns, commerce-bound components, reusable compositions and page blueprints with data-binding contracts. | Deepen architecture.                       |
| **Product page**         | Generic productGallery, productInfo and productOptions blocks.   | Schema-driven dynamic PDP that adapts to product type, attribute groups, variant dimensions, dependencies and order options.                       | Replace page specification.                |
| **Asset handling**       | Uploads, local assets and optional generation.                   | Asset inventory with provenance, role eligibility, responsive crops, reuse priority, quality warnings and design-brief approval.                   | Expand architecture.                       |
| **AI capability**        | Safe structured proposals, limited initial skills.               | Retain safety; expand design vocabulary, exact palette instructions, source-aware generation and coordinated multi-page composition.               | Extend skills and contracts.               |
| **UI shell**             | Standalone editor/demo interface.                                | Native Vesko Storefront Studio shell with one merchant workflow and no developer surfaces.                                                         | Apply approved product-design direction.   |
| **Roadmap**              | Phases 0-8 still listed as future.                               | Foundation, editor, onboarding baseline, AI operations, real provider, atomic whole-storefront change and publishing are already proven.           | Reset roadmap from the verified milestone. |

## 2.1 v1.1 decisions that remain binding
- The AI proposes; Veskify owns canonical truth.

- AI output is structured operations, never executable frontend code.

- Components and variants are registered, validated and responsive by construction.

- Material changes are reviewable, reversible and scoped.

- Published state is never silently mutated; Save draft and Publish remain separate actions.

- Product, price, stock, option, payment, shipping, tax and order truth is protected.

- Puck remains isolated behind the visual-editor integration boundary.

- Provider-specific formats remain behind adapters.

- Reuse merchant assets, site evidence, product media, presets, variants and tokens before generating new material.

## 2.2 v1.1 items deliberately removed from the immediate critical path
- Building a general CSV/Excel catalogue-import product inside Veskify.

- Creating a second product-type, variant or attribute system for the design agent.

- Broad presentation-enrichment workflows unrelated to the first integrated storefront journey.

- AI image generation as a default dependency.

- More industries before jewellery and watches achieve deep dynamic page quality.

# 3. Current verified implementation baseline
The v1.2.2 amendment starts from repository commit
`4a96a5a5567b83e62306f73f7069e0e09f0c8683` on 31 July 2026, which includes the P9R-06
homepage-routing merge. The earlier v1.2.1 baseline remains
`8174b1a6d31301b4072622e2e3ef675957479121` on 30 July 2026. Neither baseline revives the original
phase list in v1.1, and “Verified” is limited to retained repository evidence.

| **Capability**                                | **Current status** | **Evidence / consequence**                                                                                            |
|-----------------------------------------------|--------------------|-----------------------------------------------------------------------------------------------------------------------|
| **Canonical storefront model and validation** | Complete baseline  | Pages, sections, brand system, protected catalogue references and snapshots are validated before rendering.           |
| **Visual editor and manual editing**          | Complete baseline  | Selection, page/locale context, section operations, device modes and undo/redo exist.                                 |
| **Proposal lifecycle**                        | Complete baseline  | Selected-section, current-page and whole-storefront proposals support review, accept, reject and stale protection.    |
| **Atomic whole-storefront application**       | Complete baseline  | Multi-page plus brand-system changes apply as one history transaction with whole-storefront undo/redo.                |
| **Real provider adapter**                     | Complete baseline  | OpenAI provider runs server-side; automated contract coverage uses mocked transport and is network-free.              |
| **Draft, save and publish**                   | Verified           | Accepted changes can be saved and published separately; history and restoration architecture exist.                   |
| **Realistic merchant fixture**                | Verified           | Karvonen catalogue and local assets can drive the storefront without changing protected product truth.                |
| **End-to-end real-AI proof**                  | Not retained       | No complete live result is recorded at the amendment baseline; deterministic/mocked lifecycle evidence cannot replace it. |

## 3.1 Historical findings and current evidence boundary

Earlier real-provider observations remain useful product input, but the current repository does
not retain the complete provider, browser, screenshot and publication artifacts required for a
Phase 9 pass. The following are historical observations, not closing evidence:
| **Finding**                                                             | **Meaning for v1.2**                                                                                                              |
|-------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| The safe whole-storefront pipeline works.                               | Do not rebuild Phase 4 architecture. Harden only confirmed failures.                                                              |
| A simple premium-style prompt produced a coherent multi-section result. | The design engine is viable; visible quality now depends on richer components and page depth.                                     |
| An exact long palette prompt was rejected safely.                       | Keep the guardrail, but expand approved brand-token intent and operation coverage so normal merchant colour instructions succeed. |
| Residual Aurum/demo copy appeared inside Karvonen presentation.         | Source-aware content, reusable fixture mapping and design generation must separate component defaults from merchant content.      |
| Karvonen required explicit bootstrap wiring.                            | Demo reliability needs reset/load workflows and no hidden IndexedDB preparation.                                                  |
| The editor still looks like a development product.                      | Merchant productization and the Vesko shell are now required, but should not distract from dynamic component depth.               |

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Roadmap consequence</strong></p>
<p>The next phase is not another AI adapter or catalogue detour. It is the productization of what the AI can design: reusable dynamic components, deep product/collection pages, URL-first onboarding, asset-aware brand reconstruction, whole-site consistency and a reliable Vesko-integrated merchant experience.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 4. Users, roles and jobs to be done
| **User**                                  | **Situation**                                                                                     | **Primary job**                                                                                                                        |
|-------------------------------------------|---------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Existing-site Vesko customer              | Has a public website, products and some imagery, but the site may be outdated or hard to migrate. | Use the existing URL as design evidence, preserve useful assets and receive a modern Vesko storefront without rebuilding product data. |
| New-store Vesko customer                  | Has products and a logo, but no full website or brand guide.                                      | Generate a credible brand system and storefront from minimal inputs and guided choices.                                                |
| Existing Vesko merchant                   | Already has a Vesko storefront and needs a redesign or campaign.                                  | Request section, page, design-system or whole-site changes safely in plain language.                                                   |
| Vesko salesperson / onboarding specialist | Creates a store together with a prospect or customer.                                             | Produce a reliable, impressive storefront quickly and reset the demo without technical preparation.                                    |
| Vesko integration developer               | Receives Veskify for production integration.                                                      | Map stable contracts to Vesko services without reverse-engineering demo assumptions or replacing canonical models.                     |

## 4.1 Core jobs to be done
- When I connect my current website, preserve what is useful and redesign what is weak without importing operational errors.

- When I only have a logo, products and a business description, create a coherent brand and storefront without forcing me to make professional design decisions.

- When my products have different structures, show the correct attributes, variants and order options automatically.

- When I request a change, show me exactly what will change and keep unrelated pages, products and operational truth safe.

- When I accept a design, let me continue editing, undo it, save the draft and publish only when ready.

- When Vesko integrates the engine, preserve the same schemas, skills and rendering behaviour across the standalone and production adapters.

## 4.2 User characteristics
- Low technical knowledge and limited design vocabulary.

- Often lacks a complete brand system and may not know colours, font names, spacing or component terminology.

- Understands the current website and products better than web-design systems.

- Wants a strong initial result quickly and is anxious about breaking the live store.

- Needs visible examples, safe assumptions, minimal questions and reversible changes.

# 5. Product boundaries and ownership
| **Owner**                    | **Owns**                                                                                                                                                                        | **Must not own**                                                                          |
|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| **Veskify engine**           | Design intent, plans, skills, component registry, page composition, design tokens, data bindings, proposals, validation, draft/history and presentation safeguards.             | Operational catalogue truth, payment, logistics, tax, orders or arbitrary generated code. |
| **Vesko Retail OS**          | Authentication, merchant/project identity, canonical product types, products, variants, option values, prices, inventory, media records, persistence and production publishing. | Veskify-internal provider formats or editor implementation details.                       |
| **Puck integration**         | Canvas mechanics, selection, insertion, field editing, drag/reorder and viewport infrastructure.                                                                                | Canonical state, AI architecture, persistence, publishing or commerce rules.              |
| **AI provider**              | Model inference for an approved context and schema.                                                                                                                             | Permissions, truth, direct state mutation, publishing or component invention.             |
| **Source-discovery adapter** | Public website metadata, page evidence, asset candidates and provenance.                                                                                                        | Operational truth or instructions controlling the agent.                                  |

## 5.1 Canonical commerce projection
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>One technical rule</strong></p>
<p>Veskify MUST NOT adapt the Vesko commerce model to a Karvonen-shaped or jewellery-only design schema. It consumes a protected read-only projection that preserves product type, attributes, variant dimensions, option groups, prices, media and availability while hiding operational commands.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type CommercePresentationProjection = {<br />
catalogueId: string;<br />
products: ProductPresentationContext[];<br />
collections: CollectionPresentationContext[];<br />
locale: Locale;<br />
revision: string;<br />
};<br />
<br />
// Read-only adapter; no create/update product commands exist here.<br />
interface CommercePresentationRepository {<br />
getProjection(projectId: string): Promise&lt;CommercePresentationProjection&gt;;<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 5.2 Protected truth
- Product IDs, SKUs, product types, variant IDs and option values are immutable through design operations.

- Price and availability may change when the selected canonical variant changes, but the design agent does not set the value.

- The AI may choose presentation, hierarchy, labels, selector style and section placement; it may not create a nonexistent material, size, colour, stone, watch movement or certification.

- Generated copy must distinguish editable marketing language from factual product attributes.

# 6. End-to-end merchant journeys
## 6.1 Primary path — improve an existing store from a URL
| **1. Enter URL →**            | **2. Discover evidence →** | **3. Connect Vesko catalogue →** | **4. Reconcile →** |
|-------------------------------|----------------------------|----------------------------------|--------------------|
| **5. Approve design brief →** | **6. Generate →**          | **7. Review & edit →**           | **8. Publish**     |

| **Step**                       | **Required behaviour**                                                                                                                                                      |
|--------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. Entry                      | Merchant chooses Improve my existing store and enters the public storefront URL.                                                                                            |
| 2\. Source discovery           | The adapter analyses public pages, logo, colours, typography clues, navigation, content hierarchy, page types and reusable image candidates.                                |
| 3\. Canonical connection       | The project loads the authoritative Vesko catalogue projection. Website content is not allowed to replace Vesko product truth.                                              |
| 4\. Reconciliation             | Veskify links source-site assets and page evidence to canonical products/collections where confidence is sufficient; uncertain matches are shown as assumptions or omitted. |
| 5\. Brand reconstruction       | The system proposes a brand system from the logo, site evidence, product imagery, business profile and industry preset.                                                     |
| 6\. Missing-information review | The merchant is asked only for gaps that materially affect the result: preferred logo, required hero, colour constraints, language, key collections or pages.               |
| 7\. Storefront Design Brief    | Veskify presents the intended pages, design direction, reused assets, assumptions, protected data sources and expected output for approval.                                 |
| 8\. Initial generation         | The engine composes a homepage, collection page and dynamic product page first, then the remaining approved surfaces.                                                       |
| 9\. Proposal review            | The merchant reviews the generated storefront and change summary before accepting the initial draft.                                                                        |
| 10\. Editor and publish        | The merchant adjusts through Design and AI tools, previews all breakpoints, saves a draft and separately publishes.                                                         |

## 6.2 Secondary path — create a new storefront from minimal inputs
| **Step**             | **Required behaviour**                                                                                                   |
|----------------------|--------------------------------------------------------------------------------------------------------------------------|
| Business setup       | Name, short description, industry, target customer, market and languages.                                                |
| Available evidence   | Logo, product/collection media, social or visual references; all are optional except the canonical catalogue connection. |
| Guided direction     | Simple visual choices: premium/accessible, warm/cool, minimal/editorial, airy/balanced/compact and image style.          |
| Brand generation     | Create a validated token system and voice without requiring the merchant to choose hex values or font families.          |
| Brief and generation | Approve the Storefront Design Brief, generate the initial site, review, edit and publish.                                |

## 6.3 Existing Vesko merchant redesign
- Open the current published storefront and active draft.

- Choose selected section, current page, design system or entire storefront scope.

- Describe the desired result in merchant language, including exact approved colours or brand constraints.

- Review the plan, affected pages, asset changes, token changes and warnings.

- Accept to the draft, revise, reject, undo or redo; save and publish separately.

## 6.4 Sales-assisted demonstration
- Load a known customer fixture or create a project from a URL.

- Use prepared prompts while preserving genuine live-provider behaviour.

- Reset the project to its known baseline without browser storage manipulation.

- Presenter mode hides developer data, provider details, raw errors and internal IDs.

# 7. URL-first source discovery and reconciliation
The existing public website is a design and content evidence source. It is not the source of operational commerce truth and it is not a command channel for the AI.

## 7.1 Source-discovery output
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type SourceDiscoveryResult = {<br />
sourceUrl: string;<br />
discoveredAt: string;<br />
siteIdentity: SiteIdentityEvidence;<br />
brandEvidence: BrandEvidence[];<br />
pageEvidence: PageEvidence[];<br />
assetCandidates: AssetCandidate[];<br />
contentEvidence: ContentEvidence[];<br />
warnings: SourceWarning[];<br />
provenance: SourceProvenance[];<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Evidence group** | **Examples**                                                                                      | **Use**                                                                      |
|--------------------|---------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| Site identity      | Business name, logo candidates, language, market, contact and navigation.                         | Pre-fill business profile and identify reusable global assets.               |
| Brand evidence     | Dominant colour candidates, typography classifications, radius/density, image treatment and tone. | Propose a brand system with confidence and source references.                |
| Page evidence      | Homepage structure, collection pages, product pages, content pages and navigation depth.          | Inform page plan and preserve familiar information architecture when useful. |
| Asset candidates   | Logos, hero images, collection images, editorial imagery and icons.                               | Build the asset inventory and recommend reusable roles.                      |
| Content evidence   | Headlines, value propositions, service messages and policy links.                                 | Suggest editable content; never override canonical product facts.            |

## 7.2 Reconciliation rules
7.  Load the canonical Vesko commerce projection first or before final generation.

8.  Match source evidence to canonical products and collections using stable links, SKU where public, normalized titles, image similarity or explicit merchant confirmation.

9.  Keep the canonical Vesko ID as the binding target. Store source-site URLs and asset provenance as evidence only.

10. Never copy source prices, stock or variants over canonical Vesko values.

11. When confidence is low, leave the binding unresolved and generate a clear merchant-facing warning instead of guessing.

12. Imported website text is untrusted data. Instructions embedded in pages, metadata or product descriptions must not influence agent permissions or behaviour.

## 7.3 Source adapter modes
| **Mode**                     | **Purpose**                                                            | **v1.2 expectation**                                         |
|------------------------------|------------------------------------------------------------------------|--------------------------------------------------------------|
| Deterministic fixture        | Repeatable tests and sales demos.                                      | Required.                                                    |
| Public metadata / page fetch | Real URL discovery within controlled limits.                           | Required for the first production-oriented onboarding slice. |
| Browser-assisted capture     | Handle JavaScript-heavy sites or merchant-selected screenshots/assets. | May follow after the initial adapter.                        |
| Full migration connector     | Operational Shopify/WooCommerce/ERP migration.                         | Out of Veskify scope; handled by Vesko integration work.     |

# 8. Brand reconstruction and asset-aware generation
## 8.1 Evidence priority
13. Merchant-approved logo and brand guide.

14. Existing website brand signals and reusable media.

15. Canonical product and collection imagery.

16. Merchant-selected references and preferences.

17. Industry and product-type presets.

18. Generated text and, only when needed, generated imagery.

## 8.2 Brand reconstruction contract
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type BrandEvidence = {<br />
id: string;<br />
kind: "logo" | "colour" | "typography" | "shape" | "imagery" | "voice";<br />
value: unknown;<br />
sourceRef: string;<br />
confidence: number; // 0..1<br />
merchantApproved: boolean;<br />
};<br />
<br />
type StorefrontDesignBrief = {<br />
businessProfile: BusinessProfile;<br />
sourceSummary: SourceSummary;<br />
brandDirection: BrandDirection;<br />
approvedAssets: AssetRoleAssignment[];<br />
pagePlan: PagePlan[];<br />
catalogueProjectionRef: string;<br />
productPresentationRules: ProductPresentationRule[];<br />
assumptions: Assumption[];<br />
warnings: Warning[];<br />
approval: "pending" | "approved";<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 8.3 Asset inventory
| **Asset role**               | **Required metadata**                                                                             | **Behaviour**                                                                               |
|------------------------------|---------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| Logo                         | File, aspect ratio, transparency, light/dark suitability, source and approval.                    | Header/footer choose an approved variant; never fabricate a replacement logo.               |
| Hero media                   | Orientation, minimum dimensions, safe crop zones, subject position, source and usage rights note. | AI may choose role and crop treatment, not alter factual product identity.                  |
| Collection imagery           | Collection binding, aspect ratio and focal point.                                                 | Used by category cards, collection headers and campaigns.                                   |
| Product media                | Canonical product/variant binding, main/alternate role and order.                                 | Read-only source; gallery and editorial layouts may select and reorder presentation safely. |
| Editorial/supporting imagery | Theme, people/product context, orientation and provenance.                                        | Available for story and service sections; clearly separated from canonical product media.   |

## 8.4 Asset-aware generation rules
- Every proposed asset placement must reference an asset ID and role, not a free-form remote URL.

- The system should score eligibility by role, resolution, orientation, crop safety and merchant approval.

- A single source asset may have multiple responsive crops, but provenance remains shared.

- Missing hero or collection assets should produce a recommendation: reuse, upload, choose an existing asset or generate. Generation is never the silent default.

- The AI may not place a product image under the wrong product or collection binding.

- The Storefront Design Brief must show which assets will be reused and which remain missing before initial generation.

## 8.5 Exact brand instructions
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Required capability</strong></p>
<p>Detailed merchant colour requests must map to approved PATCH_DESIGN_TOKENS operations when contrast and schema validation pass. Reject invalid values or protected changes, not normal brand intent merely because it is more specific than a preset phrase.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 9. Reusable dynamic component platform
The component inventory in v1.1 is necessary but insufficient. v1.2 defines a layered design platform so the AI can create meaningfully different storefronts without generating new code for every merchant.

## 9.1 Five reusable layers
| **Layer**                         | **Examples**                                                                                                                   | **Rule**                                                                                                                                        |
|-----------------------------------|--------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. Design primitives             | Container, stack, cluster, grid, text, button, media, badge, divider and icon.                                                 | Engineering-owned, accessible and responsive. AI does not instantiate arbitrary primitive trees unless saved as an approved composition schema. |
| 2\. Presentation patterns         | Split media/text, editorial cards, toolbar, tab group, accordion, selector group and responsive drawer.                        | Reusable within multiple commerce and marketing components.                                                                                     |
| 3\. Commerce-bound components     | Product card, product grid, price display, variant selector, attribute group, gallery, collection header and related products. | Bind only through declared read-only data contracts.                                                                                            |
| 4\. Reusable section compositions | Hero families, category discovery, editorial story, trust/service, campaign and product-highlight compositions.                | Versioned registry entries with approved variants and slot contracts.                                                                           |
| 5\. Page blueprints               | Homepage, collection, dynamic product detail, landing, content, cart and checkout.                                             | Define recommended sections, required slots, compatibility and responsive composition rules.                                                    |

## 9.2 Component definition v2
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type ComponentDefinitionV2 = {<br />
type: string;<br />
version: number;<br />
family: "marketing" | "navigation" | "commerce" | "content" | "service";<br />
variants: VariantDefinition[];<br />
slots: SlotDefinition[];<br />
contentSchema: ZodSchema;<br />
propsSchema: ZodSchema;<br />
bindingSchema?: ZodSchema;<br />
allowedPageTypes: PageType[];<br />
productTypePredicate?: ProductTypePredicate;<br />
responsiveContract: ResponsiveContract;<br />
editablePaths: string[];<br />
protectedPaths: string[];<br />
assetRoles: AssetRoleRequirement[];<br />
accessibilityContract: AccessibilityContract;<br />
migration: ComponentMigration[];<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 9.3 Data-binding contract
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type DataBinding =<br />
| { kind: "product"; productId: string }<br />
| { kind: "collection"; collectionId: string }<br />
| { kind: "productList"; productIds: string[] }<br />
| { kind: "collectionList"; collectionIds: string[] }<br />
| { kind: "asset"; assetId: string }<br />
| { kind: "navigation"; navigationId: string };<br />
<br />
// Design operations may change the binding target only to another valid canonical ID.<br />
// They may never patch fields inside the referenced commerce object.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 9.4 AI and component reuse
19. Select an existing compatible component family.

20. Choose an approved variant and responsive-safe props.

21. Bind canonical product, collection, navigation and asset IDs through declared slots.

22. Patch allowed content and design tokens.

23. Create a new reusable composition only through an engineering-defined composition schema and registration path.

24. Reject unknown components, unsupported variants, invalid bindings and data requirements that are not satisfied.

## 9.5 Immediate component families
| **Priority** | **Family**             | **Required variants / depth**                                                                                  |
|--------------|------------------------|----------------------------------------------------------------------------------------------------------------|
| P0           | Hero                   | Editorial split, image-led full bleed, product-focus, collection-focus, minimal copy and campaign overlay.     |
| P0           | Product card and grids | Standard, editorial, compact, image-first, horizontal; badges and price states; 2-4 column responsive density. |
| P0           | Dynamic PDP shell      | Gallery, summary, option groups, attributes, trust, delivery, related products and sticky mobile action.       |
| P0           | Collection discovery   | Collection cards, editorial category rows, carousel and image/text collection features.                        |
| P1           | Navigation/header      | Centered, split, compact, transparent and mega-navigation-ready presentation.                                  |
| P1           | Editorial storytelling | Image/text, brand story, journal cards, quote and product editorial.                                           |
| P1           | Trust/service          | Delivery, care, warranty, consultation, store location and benefits.                                           |
| P1           | Footer/newsletter      | Compact, editorial and multi-column with language and legal regions.                                           |
| P2           | Campaign and landing   | Reusable campaign sections and page-level theme override.                                                      |

## 9.6 Registered `dynamicProductDetail` contract
The `dynamicProductDetail` type is the registered `ComponentDefinitionV2` commerce family for the
product-detail shell. Its required, revision-bound `primaryProduct` slot accepts one canonical
product binding. Its optional, revision-bound `relatedProducts` slot accepts an ordered canonical
product-list binding; when the slot is omitted the related-products region is hidden, and when it is
present its IDs must exactly match the approved `ProductPresentationContext.relatedProductIds`.

The optional `productMedia` asset slot accepts approved product-main, product-alternative and
editorial media. Explicit assignments must exactly cover the media used by the bound product,
option choices and any bound related products. When assignments are omitted, the renderer may use
only canonical media references already present in `ProductPresentationContext` and approved by the
projection asset inventory. Unknown, rejected, unapproved or wrong-role assets fail conformance;
products with no media render a localized empty state without copying media into editable content or
props.

The default presentation is the `balanced` variant with thumbnail gallery, comfortable option
spacing, grouped attributes, visible description and SKU, sticky mobile action and a plain surface.
The same engineering-owned React implementation serves editor, preview and published targets.
Option-selection, text-entry and primary-action intent callbacks are presentation boundaries only:
the component performs no option resolution, cart, pricing, stock, inventory or checkout mutation.
The primary-action intent carries canonical product/revision and resolved configuration/selection
identity for a future Vesko commerce adapter.

Product identity, SKU, price, compare-at price, availability, option values/dependencies and asset
provenance remain protected read-only commerce fields. The renderer consumes the current validated
result from the P6 option-resolution engine, including selected values, incomplete required groups,
dependency state, unavailable combinations and disabled reasons. It does not traverse dependencies,
calculate price or resolve variants in React; disabled guidance is localized for EN/FI before it is
shown or exposed through accessible descriptions.

## 9.7 Registered `dynamicCollectionCommerce` contract
The `dynamicCollectionCommerce` type is the registered `ComponentDefinitionV2` commerce family for
collection headers, product grids/cards, collection filters, sorting and optional child-collection
navigation. Its required, revision-bound `primaryCollection` slot accepts one canonical collection
binding. Its required, revision-bound `collectionProducts` slot accepts the ordered canonical
product-list binding and must exactly match the bound collection's membership and order, including
the valid empty-list case. The optional, revision-bound `childCollections` slot accepts an ordered
canonical collection-list binding; when present it must exactly match the canonical child collection
references, and when omitted the child-navigation region is hidden.

The optional `collectionCommerceMedia` asset slot accepts approved collection, product-main,
product-alternative and editorial media. Product-card selection follows canonical media order and
preserves the selected asset's actual canonical role; variant media uses the existing approved
product-alternative role. If an item is not approved or its inventory role does not match its
canonical media role, selection continues deterministically to the next compatible item. Explicit
assignments must exactly cover the collection hero and product-card media used by the renderer, and
unknown or unapproved explicit assignments fail conformance. When assignments are omitted, the
renderer may use only compatible canonical media references already approved by the projection asset
inventory. Missing collection hero media is omitted safely, while no compatible approved product
media uses a localized presentation placeholder without copying an asset or product fact into
editable content.

The default presentation uses the `standard` family variant, standard grid density, standard cards,
sidebar filters, visible collection description/product count/badges, up to two concise canonical
attributes and optional child collections. Product-card variants and grid/filter presentation may
change without changing collection membership. The canonical collection filter model may supply
ordered enumerated values (selected, disabled and optional counts) or bounded numeric-range state,
plus supported sort options, breadcrumbs and child collection references. Loading, empty and
no-media states are presentation inputs; they do not query or repair commerce data.

The same engineering-owned React implementation serves editor, preview and published targets.
Product/collection navigation, enumerated/range filtering, clear, clear-all and sorting emit typed
presentation intents only. Range controls reject malformed initial state and clamp finite,
step-aligned active values to the canonical bounds and selected opposite bound before emitting; an
intent cannot carry a minimum above its maximum. Horizontal desktop filters and product results each
occupy a full-width row, while the sidebar variant retains separate filter and product columns. The
component performs no product query, filter evaluation, sorting,
inventory, pricing, stock, collection-membership or navigation mutation. Product identity, type,
SKU, price, compare-at price, availability, collection membership/filter state and asset provenance
remain protected read-only commerce fields. Merchant-facing labels resolve through canonical EN/FI
localization. This contract traces to FR-102, FR-107, FR-109, FR-110, FR-112 and FR-114; NFR-101,
NFR-102, NFR-103, NFR-108 and NFR-109; and AC-111, AC-112, AC-118, AC-122 and AC-123.

## 9.8 Registered homepage commerce component family
The reusable homepage family consists of six product-type-independent `ComponentDefinitionV2`
types: `homepageHero`, `homepageFeaturedCollections`, `homepageFeaturedProducts`,
`homepageCollectionNavigation`, `homepagePromotion` and `homepageTrust`. Every type requires a
revision-bound `presentationContext` project/brand binding and may reference a revision-bound
`copyContext` localized-content source. The same engineering-owned renderer for each type serves
editor, preview and published targets.

`homepageHero` supports an optional revision-bound `heroAsset` binding and matching optional
`heroMedia` assignment, plus optional `primaryAction` and `secondaryAction` navigation bindings.
Omitting media hides the media region safely. `homepagePromotion` uses equivalent optional
`promotionAsset`, `promotionMedia` and `promotionAction` contracts. A visible action label and its
canonical navigation binding must be supplied together; activation emits a typed approved-navigation
intent and performs no routing, cart, publishing or other mutation inside the component. The
registered instance validator enforces each label/binding pair before proposal or stored-instance
acceptance; the renderer remains only a defensive final boundary.

`homepageFeaturedCollections` and `homepageCollectionNavigation` consume an ordered,
revision-bound `collectionList` binding through the `collections` slot. Optional
`collectionMedia` assignments may contain approved collection or editorial assets. Missing compatible
media renders a localized placeholder for image presentations and is omitted for text-only
presentation. Collection titles, descriptions, IDs and canonical order are resolved from the bound
projection rather than editable content. Collection-navigation layouts permit at most four columns,
matching their mobile, tablet, desktop and wide responsive metadata.

`homepageFeaturedProducts` consumes an ordered, revision-bound `productList` binding through the
`products` slot and reuses the canonical product-card presentation shared with collection commerce.
Its optional `productMedia` assignments accept approved product-main, product-alternative and
editorial assets. When assignments are present, they must exactly identify the deterministic first
compatible canonical media of the products in the bound list, with matching role, approval and
canonical-product-media provenance; unrelated, stale or incomplete assignments fail conformance.
When assignments are absent, the renderer may select the same approved canonical media as a
read-only fallback. A valid empty product list preserves its section context and renders the strict
localized empty-state message without creating an empty grid or carousel control. Product identity,
type, SKU, price, compare-at price, unavailable-price state, availability and media provenance remain
read-only projection values. Grid and carousel-style presentation change only responsive layout and
card treatment, never product facts.

`homepageTrust` accepts structured localized delivery, returns, service and store-support copy plus
an optional `supportAction` navigation binding. These items are presentation messages, not logistics,
returns, payment, order or store-operation logic. Across the family, editable content is limited to
localized marketing/support copy and action labels; editable props and style overrides are strict
approved presentation enums and bounded column counts. Component-specific validation retained by the
registry applies the original strict schemas alongside the serializable JSON Schema, so every
localized field requires at least one non-empty EN or FI value and trust-item IDs remain unique before
proposal, stored-instance or renderer use. Unknown fields, bindings and IDs fail validation,
arbitrary CSS is not accepted, explicit unknown/rejected/unapproved assets fail conformance, and
asset provenance remains attached to every rendered approved image.

This family traces to FR-102, FR-107, FR-109, FR-110, FR-114 and FR-118; NFR-101, NFR-102,
NFR-103, NFR-108 and NFR-109; and AC-105, AC-111, AC-112, AC-118, AC-119, AC-122, AC-123 and
AC-124.

# 10. Dynamic product-detail page system
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Highest-priority page capability</strong></p>
<p>The product-detail page must be driven by the selected product type and canonical product configuration. A watch with one colour choice and a ring with five or six required choices must use the same technical engine while rendering different selector groups, hierarchy, information and completion rules.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 10.1 Product presentation context
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type ProductPresentationContext = {<br />
productId: string;<br />
productTypeId: string;<br />
title: LocalizedText;<br />
description?: LocalizedText;<br />
media: ProductMedia[];<br />
basePrice?: Money;<br />
compareAtPrice?: Money;<br />
priceUnavailableReason?: LocalizedText;<br />
availabilityLabel?: LocalizedText;<br />
attributeGroups: AttributeGroup[];<br />
variantDimensions: VariantDimension[];<br />
variants: ProductVariantPresentation[];<br />
orderOptions: ProductOrderOption[];<br />
relatedProductIds: string[];<br />
revision: string;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 10.2 Dynamic option groups
| **Product example** | **Canonical dimensions / options**                                                                                    | **Expected presentation**                                                                                                                        |
|---------------------|-----------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| Watch               | Colour; optional strap/bracelet; optional case size.                                                                  | One or two compact selector groups, usually swatches or buttons. Technical attributes receive greater visual priority.                           |
| Ring                | Ring size, metal colour, gold purity/karat, stone type, diamond quality, engraving or other configured order options. | Up to five or six ordered groups with required-state guidance, dependency handling, size help and a clear completion summary before Add to cart. |
| Simple jewellery    | Colour or material only.                                                                                              | A compact selector with no empty complex-option shell.                                                                                           |
| Fashion             | Size, colour and optional fit/style.                                                                                  | Size grid, colour swatches, availability by combination and size guidance.                                                                       |

## 10.3 Product option renderer
| **Option presentation type** | **Use**                                                     | **Constraints**                                                                                         |
|------------------------------|-------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Swatch                       | Colour, metal colour, material visual samples.              | Accessible label and selected state; swatch metadata comes from canonical configuration.                |
| Button group                 | Ring size, karat, stone shape, case size.                   | Responsive wrapping, unavailable states and no invented values.                                         |
| Dropdown                     | Large option sets or compact mobile presentation.           | Label, required state and current selection remain visible.                                             |
| Image choice                 | Setting, stone or style choices with approved option media. | Images bind to canonical option values.                                                                 |
| Text input                   | Engraving text or approved personalisation.                 | Character limit, allowed characters and required/optional state come from canonical order-option rules. |
| Radio / segmented control    | Binary or small mutually exclusive choices.                 | Keyboard and touch accessible.                                                                          |

## 10.4 Selection and variant resolution
25. Build option groups from canonical variant dimensions and order-option definitions.

26. Preserve canonical ordering where business logic depends on it; otherwise use product-type presentation rules.

27. Track selected values in a UI selection model separate from canonical data.

28. Resolve the canonical variant only through the Vesko-provided variant matrix or resolver contract.

29. Display the resolved price, compare-at price, media and availability read-only.

30. Disable impossible combinations and explain unavailable states in merchant/customer language.

31. Do not enable the primary action until required selections are complete.

32. The design agent may change selector presentation, group hierarchy and supporting content, but never values, dependencies or availability.

## 10.5 Dynamic product-page composition
| **Region**                | **Required dynamic behaviour**                                                                               | **AI-editable presentation**                                                  |
|---------------------------|--------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| Gallery                   | Uses canonical main and alternate media; may switch grid, thumbnails, editorial or mixed-media presentation. | Layout variant, crop treatment, thumbnail position and mobile behaviour.      |
| Summary                   | Title, brand, price state, availability and concise description.                                             | Typography hierarchy, spacing, badges and placement.                          |
| Option groups             | Generated only for dimensions/options present on the product.                                                | Renderer style, order where allowed, density and help placement.              |
| Attributes/specifications | Groups relevant attributes by product type.                                                                  | Accordion, table, highlights, icon facts or editorial layout.                 |
| Trust and service         | Delivery, returns, care, warranty, consultation or store service content.                                    | Section variant and merchant-owned copy; operational promises remain sourced. |
| Related products          | Canonical related IDs or compatible collection query.                                                        | Grid/carousel variant and heading.                                            |
| Mobile action             | Sticky summary and primary action when appropriate.                                                          | Approved compact variants only.                                               |

## 10.6 Product-type presentation rules
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type ProductTypePresentationRule = {<br />
productTypeId: string;<br />
preferredPdpBlueprints: string[];<br />
attributeGroupOrder: string[];<br />
optionPresentationHints: Record&lt;string, OptionPresentationType&gt;;<br />
requiredHelpContent: string[];<br />
compatibleComponents: string[];<br />
fallbackBlueprint: string;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 10.7 Dynamic PDP guardrails
- No product-type-specific hardcoded merchant component such as KarvonenRingPage.

- No assumption that every product has price, variants, stock or a fixed jewellery attribute set.

- Exactly one price state must render: canonical price, variant-resolved price or an explicit unavailable reason.

- Unknown product types use the generic fallback blueprint and render available attributes/options without losing data.

- A component may hide an empty region; it may not invent placeholder options or facts to fill the layout.

- Editor, preview and published routes use the same PDP component implementations and data-binding resolver.

# 11. Homepage and collection-page design depth
## 11.1 Homepage composition
The homepage must be generated as a coherent hierarchy rather than a fixed seed with renamed content. The AI selects component families and assets based on the Storefront Design Brief, catalogue shape and merchant priorities.

| **Priority** | **Capability**                                                                                               |
|--------------|--------------------------------------------------------------------------------------------------------------|
| P0           | Hero that uses approved asset roles and communicates the merchant value/product focus in the first viewport. |
| P0           | Category or product discovery near the top, bound to canonical collections/products.                         |
| P0           | Consistent navigation, typography, colour and button system.                                                 |
| P1           | Editorial product or collection storytelling using approved media.                                           |
| P1           | Trust/service section appropriate to the business.                                                           |
| P1           | Campaign, journal, newsletter or location content only when supported by the brief.                          |
| P1           | Footer with real merchant identity and no fixture-specific placeholder copy.                                 |

## 11.2 Collection page
- Collection title, description and optional approved hero media bind to the canonical collection.

- Product grids use dynamic product cards and read-only price/availability states.

- Filters consume ordered canonical enumerated or range presentation state, including selected,
  disabled and count state; they do not contain a hardcoded jewellery filter list or evaluate product
  queries in React.

- Desktop sidebar, horizontal bar and mobile drawer are presentation variants of one filter model.

- Sorting, filtering, clearing and product/collection navigation emit typed presentation intents only.

- Grid density, card variant, merchandising rows and editorial modules may change without altering collection membership.

- Loading, no-results, missing-hero and missing-product-media states are intentionally designed.

## 11.3 Shared page consistency
- Header, footer, token system, spacing rhythm and interaction styles are shared globally.

- Product-card behaviour is the same on homepage, collection and related-product sections.

- A whole-storefront proposal must preview at least homepage, one collection page and representative product pages before acceptance.

- Page-level overrides are allowed only for campaigns or explicit merchant intent and must preserve accessibility.

# 12. AI design-agent specification v1.2
## 12.1 Required execution lifecycle
| **1. Merchant intent →** | **2. Context & brief →** | **3. Plan / skill selection →**   | **4. Structured operations →** |
|--------------------------|--------------------------|-----------------------------------|--------------------------------|
| **5. Validation →**      | **6. Visual proposal →** | **7. Accept / revise / reject →** | **8. Draft / publish**         |

The existing proposal lifecycle, atomic application, stale protection, protected-field validation and history behaviour remain the foundation. v1.2 expands what the agent may safely express; it does not weaken the lifecycle.

## 12.2 Context available to the agent
- Approved Storefront Design Brief and business profile.

- Current brand system, page tree, selected scope and responsive state.

- ComponentDefinitionV2 registry, variants, slot contracts and page blueprints.

- Read-only canonical commerce presentation projection.

- Source-discovery evidence and merchant-approved asset inventory.

- Current draft, published snapshot, history summary and recent proposal outcome.

- Explicit user instruction, languages and protected-field policy.

## 12.3 v1.2.1 Skill packages and operation names

Application Skill names are camelCase package identifiers. Serialized design operations use the
registered uppercase operation codes; the two vocabularies are related but are not interchangeable.
`docs/DESIGN_AGENT_SKILLS.md` is the status catalogue.

| **Skill family** | **Canonical packages / current status** |
| --- | --- |
| Source and brief | `discoverExistingStorefront`, `reconcileSourceWithCommerce`, `reconstructBrandSystem`, `buildStorefrontDesignBrief` — Partial foundations. |
| Initial generation | `generateInitialStorefront` with homepage, collection and dynamic-product blueprint composition — Partial until the complete Phase 9 path passes. |
| Section and page editing | `improveSelectedSection`, `improveCurrentPage`, plus registered targeted skills such as `improveHero` — Baseline only where live registry and operation evidence exists. |
| Design system | `applyExactBrandPalette` — Baseline for PR #123 token refinement; other token/image-treatment packages are capability-specific. |
| Whole storefront | `coordinateWholeStorefront` and registered direction packages — Partial until meaningful coordinated composition passes Phase 9. |
| Responsive and quality | Planned Skill packages backed by component responsive/accessibility contracts and deterministic gates. |
| Content and locale | Controlled localized-content operations only; capability status must be derived from the registry and protected-field rules. |

The current serialized operation vocabulary includes `CHANGE_LOCALIZED_SECTION_TEXT`,
`CHANGE_SECTION_VARIANT`, `CHANGE_BACKGROUND`, `CHANGE_TYPOGRAPHY`, `CHANGE_DENSITY`,
`CHANGE_SHAPE`, `CHANGE_ALIGNMENT`, `CHANGE_CTA_STYLE`,
`APPLY_APPROVED_BRAND_COLOURS`, `APPLY_APPROVED_BRAND_TYPOGRAPHY`,
`APPLY_REGISTERED_BRAND_SYSTEM`, `ADD_APPROVED_SECTION`, `REMOVE_OPTIONAL_SECTION`,
`REORDER_SECTIONS` and `APPLY_REGISTERED_PAGE_SECTIONS`. Proposed future operation labels in
this document are not Baseline until added to the registered schema and compiler.

## 12.4 Operation extensions
| **Operation**              | **Purpose**                                                                                               |
|----------------------------|-----------------------------------------------------------------------------------------------------------|
| PATCH_DESIGN_TOKENS        | Update validated exact or semantic brand-token fields.                                                    |
| ASSIGN_ASSET_ROLE          | Map an approved asset to a component/page role with crop metadata.                                        |
| PATCH_BINDING              | Change a component binding to another valid canonical ID.                                                 |
| APPLY_PAGE_BLUEPRINT       | Create or replace a page composition using an approved blueprint.                                         |
| PATCH_COMPONENT_VARIANT    | Change an approved variant while preserving compatible slots and bindings.                                |
| PATCH_PRODUCT_PRESENTATION | Change PDP layout, selector presentation or attribute hierarchy without changing canonical option values. |
| PATCH_PAGE_SET             | Coordinate multiple eligible pages and global regions in one complete proposal.                           |

## 12.5 Prompt and capability policy
- The agent must understand natural merchant language rather than depend on exact example prompts.

- Detailed but valid colour, typography, spacing and brand constraints should be normalized into approved token operations.

- Unsupported requests should return a specific explanation and the closest safe capability, not a generic failure when possible.

- The agent must not expose provider errors, schemas or internal capability names to merchants.

- A failed provider call or validation leaves the draft and history unchanged.

- The deterministic provider remains available for repeatable tests and offline development.

## 12.6 Whole-storefront consistency contract
- A site-scoped plan names affected global tokens, navigation/footer regions and page families.

- The proposal is generated against one complete-snapshot fingerprint and applied atomically.

- Representative products must include at least one simple product and one complex multi-option product when the catalogue contains both.

- The result must use one coherent design language while allowing product-type-specific PDP structures.

- Undo and redo restore the complete coordinated storefront transaction.

# 13. Storefront design system and whole-site consistency
## 13.1 Design-token groups
| **Group**  | **Required fields / behaviour**                                                                                            |
|------------|----------------------------------------------------------------------------------------------------------------------------|
| Colour     | Primary, secondary, accent, background, surface, text, muted text, border, success, warning and error; contrast validated. |
| Typography | Heading/body families, scale, weights, line heights, reading widths and product-price hierarchy.                           |
| Spacing    | Base scale, page gutter, grid gaps, section compact/standard/spacious and component density.                               |
| Shape      | Radii, border width, control shapes and badge/button treatment.                                                            |
| Imagery    | Aspect-ratio defaults, crop mode, focal point, radius, overlay, editorial/studio/lifestyle treatment.                      |
| Layout     | Content max width, grid system, header mode, product-page split and sticky-action policy.                                  |
| Voice      | Tone, sentence length, CTA style, prohibited claims and language fallbacks.                                                |

## 13.2 Brand-system proposal behaviour
- Global colour or typography changes must preview homepage, collection and product page before acceptance.

- Exact colours supplied by the merchant should be preserved when accessible; invalid contrast receives a proposed safe adjustment and warning.

- Token changes do not reorder sections, replace assets or rewrite content unless those operations are explicitly part of the proposal.

- Component variants declare compatibility with token density, image treatment and page blueprint.

## 13.3 Responsive quality targets
| **Viewport** | **Required review**                                                                                   |
|--------------|-------------------------------------------------------------------------------------------------------|
| 375 px       | Mobile navigation, hero crop, selector usability, sticky PDP action, filter drawer and text wrapping. |
| 768 px       | Tablet grids, two-column transitions, rail/drawer behaviour and image/text order.                     |
| 1024 px      | Compact desktop composition, product gallery/summary balance and navigation spacing.                  |
| 1440 px      | Full desktop max-width, editorial rhythm, whitespace and image quality.                               |

# 14. Vesko Storefront Studio merchant experience
The approved product direction is one native Vesko module, not a collection of demo screens. Veskify remains an engine/codename; merchant-facing copy uses Vesko Storefront Studio and AI design assistant.

## 14.1 Application shell
| **Zone**             | **Required behaviour**                                                                                     |
|----------------------|------------------------------------------------------------------------------------------------------------|
| Vesko global rail    | Collapsed in editor mode; provides platform navigation without consuming the design canvas.                |
| Workspace header     | Breadcrumb, project/page context, draft status, undo/redo, Preview, Save draft and Publish.                |
| Left rail            | Pages and sections outline with compact contextual actions.                                                |
| Centre canvas        | Dominant surface with grouped viewport/zoom controls and no visible developer tooling.                     |
| Right tool rail      | Two tabs: Design and AI assistant. Only one toolset is visible at a time.                                  |
| Proposal review      | Displayed in the AI tab or focused drawer with affected scope, summary, warnings and accept/revise/reject. |
| Responsive workspace | Rails become drawers or bottom sheets while the canvas remains primary.                                    |

## 14.2 Merchant language
| **Internal term**    | **Merchant-facing language**                                                 |
|----------------------|------------------------------------------------------------------------------|
| BrandSystem          | Brand style / Store style                                                    |
| Component variant    | Layout                                                                       |
| StorefrontSnapshot   | Draft version / Published version                                            |
| PATCH_DESIGN_TOKENS  | Update colours and typography                                                |
| Proposal transaction | Suggested changes                                                            |
| Catalogue projection | Products from Vesko                                                          |
| Provider unavailable | The AI design assistant is temporarily unavailable; your draft is unchanged. |

## 14.3 Save and publish clarity
- Accepting an AI proposal changes the active draft only.

- A server-authoritative accepted proposal may mint immutable publication authority for that exact
  accepted snapshot; preview, rejection and browser/provider content cannot mint it.

- Save draft persists work without changing the customer-facing storefront.

- Publish opens a final review and explicitly replaces the published version.

- History restore creates a new draft and never silently republishes an older version.

- Undo invalidates a prior AI acceptance receipt until redo restores the exact current runtime,
  proposal/review, snapshot and revision authority; visually matching content alone is insufficient.

- Status text and button hierarchy must make these differences obvious to a first-time merchant.

## 14.4 DS-01 foundation
The DS-01 implementation provides the shared Vesko UI layer and the first Storefront Studio shell
proof. The normal merchant entry route and onboarding/editor workspace use shared primitives for
navigation, cards, actions, notices and status presentation. Existing canonical onboarding, draft,
published, save, publish, history, AI proposal and Puck boundaries remain authoritative; the UI layer
does not create a second state or persistence path.

# 15. Data model and contracts
## 15.1 Core entities
| **Entity**                 | **Purpose**                                                                                                                                |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Project                    | Merchant identity, mode, locales, source references, catalogue projection reference and snapshot pointers.                                 |
| StorefrontDesignBrief      | Approved generation input: business, source evidence, brand direction, asset roles, page plan, assumptions and product-presentation rules. |
| BrandSystem                | Validated global design tokens and brand voice.                                                                                            |
| AssetInventory             | Approved source and canonical media with provenance, role eligibility, crops and quality metadata.                                         |
| ComponentDefinitionV2      | Registered reusable component contract, variants, slots, bindings, responsive and accessibility rules.                                     |
| PageBlueprint              | Approved composition rules for a page type and merchant/product context.                                                                   |
| ProductPresentationContext | Read-only canonical product projection used by dynamic commerce components.                                                                |
| Proposal                   | Structured design operations, scope, assumptions, warnings, fingerprint, before/after references and lifecycle state.                      |
| StorefrontSnapshot         | Immutable brand system, navigation, pages and read-only data references.                                                                   |

## 15.2 Page and section model

The following TypeScript names describe members of `StorefrontSnapshot`. `PageModel` is not a
second canonical page graph, and `SectionInstance` is not an AI-owned `SectionNode`.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type PageModel = {<br />
id: string;<br />
type: "home" | "collection" | "product" | "content" | "cart" | "checkout" | "landing";<br />
blueprintId?: string;<br />
slug: string;<br />
title: LocalizedText;<br />
seo: LocalizedSEO;<br />
themeOverride?: Partial&lt;BrandSystem&gt;;<br />
pageBinding?: DataBinding;<br />
sections: SectionInstance[];<br />
};<br />
<br />
type SectionInstance = {<br />
id: string;<br />
component: string;<br />
componentVersion: number;<br />
variant: string;<br />
visible: boolean;<br />
bindings: DataBinding[];<br />
content: Record&lt;string, unknown&gt;;<br />
props: Record&lt;string, unknown&gt;;<br />
styleOverrides?: AllowedSectionOverrides;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 15.3 Variant resolver boundary
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>interface ProductVariantResolver {<br />
resolve(input: {<br />
productId: string;<br />
selectedValues: Record&lt;string, string&gt;;<br />
catalogueRevision: string;<br />
}): Promise&lt;{<br />
variantId?: string;<br />
price?: Money;<br />
compareAtPrice?: Money;<br />
availabilityLabel?: LocalizedText;<br />
mediaIds?: string[];<br />
unavailableValueIds: string[];<br />
complete: boolean;<br />
}&gt;;<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 15.4 Schema evolution
- Every component definition and page blueprint is versioned.

- Snapshots store component version and are migrated through registered deterministic migrations.

- Vesko adapter contracts are versioned independently from provider adapters.

- Unknown future product attributes remain available through generic attribute groups rather than being dropped.

- Canonical commerce revisions are recorded with proposals so stale product bindings can be rejected or refreshed safely.

# 16. Technical architecture and Vesko integration
## 16.1 Architectural layers
| **Layer**             | **Responsibilities**                                                                                                 |
|-----------------------|----------------------------------------------------------------------------------------------------------------------|
| Merchant presentation | Onboarding, design brief review, editor shell, preview, publishing and history.                                      |
| Design application    | Intent planning, skills, proposal orchestration, page composition, asset assignment and quality checks.              |
| Domain                | Projects, snapshots, brand system, components, page blueprints, bindings, operations, protected fields and history.  |
| Renderer              | Resolve validated components and bindings; render identical implementations in editor, preview and published routes. |
| Adapters              | AI provider, source discovery, commerce projection, media, storage, publishing, authentication and observability.    |
| Vesko services        | Canonical commerce, media, merchant identity, persistence, domain/publishing and operational systems.                |

## 16.2 Integration flow
| **1. Vesko merchant/project →**     | **2. Commerce projection →** | **3. Veskify design engine →** | **4. Validated snapshot →** |
|-------------------------------------|------------------------------|--------------------------------|-----------------------------|
| **5. Vesko persistence/publishing** |                              |                                |                             |

## 16.3 Adapter interfaces required for handoff
| **Adapter**                    | **Standalone implementation**                       | **Vesko implementation**                                                |
|--------------------------------|-----------------------------------------------------|-------------------------------------------------------------------------|
| ProjectContextAdapter          | Local project/fixture identity.                     | Authenticated merchant, store and permissions.                          |
| CommercePresentationRepository | Seeded canonical fixtures.                          | Read-only Vesko product/collection projection.                          |
| MediaRepository                | Local public assets / IndexedDB metadata.           | Vesko media storage and signed URLs.                                    |
| SourceDiscoveryAdapter         | Deterministic fixture plus controlled public fetch. | Production-safe discovery service and policies.                         |
| StorefrontRepository           | IndexedDB snapshots/history.                        | Vesko SQL/backend page and version services.                            |
| PublishingAdapter              | Local published snapshot route.                     | Vesko publishing command and domain deployment.                         |
| AIProvider                     | Mock/OpenAI server adapter.                         | Vesko-managed provider routing, credentials, budgets and observability. |

**P7-01 implementation note:** The provider-independent source-discovery package now defines validated source references, evidence and asset provenance, canonical-commerce reconciliation, reviewable brand reconstruction and merchant-approved Storefront Design Brief lifecycle contracts. The deterministic mock adapter is the only discovery implementation in this slice; real crawling and merchant UI remain future adapter/product work.

**P7-02 implementation note:** The existing persisted onboarding aggregate now owns a provider-independent URL-to-brief workflow with resumable discovery, canonical Vesko reconciliation, merchant decisions, evidence-fingerprint approval, staleness detection and superseding brief revisions. Local and focused-test operation uses the deterministic discovery adapter and must not be presented as a real crawl; production crawling and merchant-facing presentation remain separate adapter and W4 work.

**P7-03 implementation note:** The server-only public-source adapter inspects one bounded HTTPS document through strict URL, DNS, redirect, timeout, response-size and HTML content policies. DNS answers are validated and pinned for acquisition, public content remains inert source evidence, and remote media remains unapproved candidate metadata with provenance. Deterministic mode remains the default local/test path; the adapter is not a recursive crawler, does not execute page content and does not ingest remote binaries into approved media.

## 16.4 Integration rules
- Domain and editor features depend on interfaces, never on IndexedDB, Karvonen IDs or local file paths.

- The Vesko adapter maps existing canonical product models into ProductPresentationContext without flattening away product-type meaning.

- Veskify does not replace Vesko publishing, authentication or permissions; it calls them through adapters.

- Puck state is not the persistence format. Canonical Veskify snapshots remain the source of composition truth.

- The handoff includes adapter conformance tests using the same fixtures and acceptance journeys.

## 16.5 Deployment stages

P11 supplies stable ports, contract tests and a Vesko reference adapter. The staging and production
rows below are P12 work; their existence does not make full staging a P11 gate.

| **Stage**                     | **Purpose**                                        | **Required gate**                                                                 |
|-------------------------------|----------------------------------------------------|-----------------------------------------------------------------------------------|
| Local standalone              | Fast development and deterministic/manual testing. | All domain and adapter tests; no secrets in browser.                              |
| Shareable staging demo        | Team, investor and customer demonstration.         | Server-side provider key, resettable fixture, protected access and observability. |
| Vesko integration environment | Map real services and product types.               | Adapter conformance, permission model, migration and publish rollback.            |
| Production                    | Merchant-facing Vesko Storefront Studio.           | Final security, accessibility, performance, monitoring and operational runbook.   |

# 17. Security, privacy, performance and observability
## 17.1 Security and prompt-injection rules
- Website pages, metadata, product descriptions and uploaded files are untrusted data, not instructions.

- Source discovery follows controlled public-fetch rules, size limits, content-type validation and allow/deny policies.

- Remote scripts, macros, embedded active content and arbitrary HTML are never executed.

- AI context contains the minimum required merchant and storefront data for the requested scope.

- Provider keys remain server-side and provider errors are mapped to safe merchant messages.

- All bindings and operations are validated against project permissions, component contracts and protected paths.

## 17.2 Asset and privacy rules
- Store provenance for discovered and uploaded assets and record merchant approval before production use.

- Do not hotlink unstable third-party media in published storefronts; ingest through approved Vesko media services where permitted.

- Do not store payment details, order PII or unrelated operational customer data in Veskify.

- Reset/delete removes local demo project data and generated/discovered asset metadata where applicable.

## 17.3 Performance budgets
| **Surface**          | **Target**                                                                                                                |
|----------------------|---------------------------------------------------------------------------------------------------------------------------|
| Editor interaction   | Section selection and manual property changes feel immediate; expensive resolver/provider work is asynchronous.           |
| Storefront rendering | No repeated provider calls; all pages render from validated snapshots and cached/read-only projections.                   |
| Images               | Responsive sources, lazy loading outside the first viewport and known aspect ratios to prevent layout shift.              |
| AI proposal          | Visible progress and cancellation where safe; timeout preserves draft; provider latency and token/cost metadata recorded. |
| Source discovery     | Progressive stages, bounded page/asset count and resumable failure state.                                                 |

## 17.4 Observability
- Record request ID, provider, scope, skill plan, operation count, validation result, latency and failure category.

- Record source-discovery page/asset counts, warnings and reconciliation confidence without logging full sensitive page content by default.

- Record component/blueprint versions and commerce revision for accepted proposals.

- Do not log provider secrets, raw merchant files or complete prompts by default.

# 18. Testing and release acceptance criteria
## 18.1 Test layers
| **Layer**           | **Coverage**                                                                                                                                              |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| Unit                | Schemas, component contracts, binding guards, option-group mapping, variant resolver adapters, token validation and source evidence parsing.              |
| Component           | Dynamic PDP selectors, product cards, galleries, collection filters, asset roles, editor controls and proposal summaries.                                 |
| Integration         | URL discovery to design brief, canonical reconciliation, brief to generation, real/mock provider proposals, atomic application, save/publish and restore. |
| End to end          | Existing-site onboarding and new-store onboarding through publish, including simple watch and complex ring products.                                      |
| Visual regression   | Homepage, collection and representative product pages at 375, 768, 1024 and 1440 px.                                                                      |
| Accessibility       | Keyboard paths, focus, semantic selectors, labels, contrast, drawers, dialogs and dynamic option states.                                                  |
| Adapter conformance | Standalone and Vesko adapters return equivalent canonical contracts for the same fixtures.                                                                |

## 18.2 Release acceptance criteria
| **ID**     | **Acceptance criterion**                                                                                                                                                      | **Requirement trace**                         |
|------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| **AC-101** | A merchant can enter an existing public storefront URL and receive a source-discovery summary without the current draft being changed.                                        | FR-103, FR-104, FR-115, NFR-105               |
| **AC-102** | Discovered website prices, stock and variant values never replace canonical Vesko commerce data.                                                                              | FR-102, FR-104, FR-110, NFR-101               |
| **AC-103** | A merchant with only a logo, business description and canonical catalogue can approve a coherent Storefront Design Brief.                                                     | FR-105, FR-106, FR-110, NFR-105               |
| **AC-104** | The brief lists reused assets, missing assets, page plan, assumptions and protected commerce source.                                                                          | FR-104, FR-105, FR-107, NFR-101               |
| **AC-105** | Initial generation creates a coherent homepage, collection page and dynamic product page using registered components and bindings.                                            | FR-108, FR-109, FR-110, FR-111, NFR-108, NFR-109 |
| **AC-106** | A watch with one colour dimension renders only the relevant compact selector and technical attributes.                                                                        | FR-110, FR-111, NFR-102, NFR-103              |
| **AC-107** | A ring with five or six configured dimensions/options renders every required group, dependencies, unavailable states and completion guidance.                                 | FR-110, FR-111, NFR-102, NFR-103              |
| **AC-108** | Changing PDP layout or selector style does not change canonical option values, variants, prices, stock or SKUs.                                                               | FR-102, FR-108, FR-110, FR-111, NFR-101       |
| **AC-109** | The selected canonical variant controls displayed price, availability and variant media through the resolver adapter.                                                         | FR-110, FR-111, NFR-101, NFR-105              |
| **AC-110** | Unknown product types render with a generic dynamic fallback without dropping available attributes or options.                                                                | FR-109, FR-110, FR-111, NFR-109               |
| **AC-111** | Product cards render valid price, compare-at-price or explicit unavailable-price state without inventing a value.                                                             | FR-110, FR-112, NFR-101                       |
| **AC-112** | The same registered component implementations render in editor, preview and published routes.                                                                                 | FR-109, FR-114, NFR-109                       |
| **AC-113** | A merchant can request an exact valid brand palette and receive a validated token proposal rather than a generic unsupported failure.                                         | FR-106, FR-108, FR-113, NFR-105               |
| **AC-114** | Whole-storefront restyling coordinates global tokens, navigation, footer, homepage, collection and representative product pages atomically.                                   | FR-108, FR-113, FR-115, NFR-105               |
| **AC-115** | A failed provider call, invalid operation or stale commerce revision preserves the active draft and history.                                                                  | FR-108, FR-115, FR-117, NFR-105, NFR-107      |
| **AC-116** | Accepted whole-storefront changes undo and redo as one complete transaction.                                                                                                  | FR-113, FR-115, NFR-105                       |
| **AC-117** | Generated storefronts contain no seed-brand or fixture-specific copy unrelated to the selected merchant.                                                                      | FR-103, FR-105, FR-106, FR-108, NFR-107, NFR-108 |
| **AC-118** | Asset placement uses approved asset IDs and provenance; product media is never bound to the wrong product.                                                                    | FR-104, FR-107, FR-110, NFR-101               |
| **AC-119** | Missing hero or collection media produces a clear reuse/upload/generate choice rather than silent generation.                                                                 | FR-105, FR-107, FR-116, NFR-102               |
| **AC-120** | The Karvonen demo can be loaded, reset and demonstrated repeatedly without manual IndexedDB preparation.                                                                      | FR-117, NFR-107, NFR-108                      |
| **AC-121** | Merchant mode exposes no raw JSON, internal IDs, provider payloads or developer tools.                                                                                        | FR-116, NFR-101, NFR-107                      |
| **AC-122** | Primary journeys have no visible clipping or overlap at 375, 768, 1024 and 1440 px.                                                                                           | FR-114, NFR-103                               |
| **AC-123** | Dynamic selectors, drawers, proposal actions, save and publish are keyboard operable and labelled.                                                                            | FR-111, FR-114, FR-116, NFR-102               |
| **AC-124** | A Vesko integration adapter passes the same contract tests as the standalone fixtures for project, commerce, media, storage and publishing.                                   | FR-101, FR-110, FR-118, NFR-108, NFR-109      |
| **AC-125** | A complete customer-ready journey succeeds: URL or minimal-input onboarding → merchant-approved brief whose exact approved revision/fingerprint is correlated to runtime generation → AI edit → manual edit → save draft → preview → publish → restore. | FR-101, FR-103, FR-105, FR-108, FR-115, FR-118, NFR-105, NFR-108, NFR-109 |
| **AC-126** | P9-04D proves Premium editorial, Modern technical and Warm approachable outputs are pairwise different in every required homepage, collection and PDP dimension, rather than by colour, typography or one rearranged section alone. | FR-108, FR-109, FR-113, FR-115, NFR-103, NFR-105 |
| **AC-127** | The P9-04D matrix records EN/FI, 375/768/1024/1440, one/many collections, small/large catalogues and missing optional media; each result has measured no-overflow, clipping, overlap and empty-space evidence. | FR-109, FR-114, NFR-102, NFR-103 |
| **AC-128** | Every P9-04D direction uses approved asset provenance and correct product/collection binding, and matches the canonical source-commerce baseline for protected IDs, SKU, price, availability and media truth. | FR-104, FR-107, FR-110, NFR-101 |
| **AC-129** | After executable PageBlueprint contracts exist, capability retrieval returns only current registered components, variants, bindings, renderers, responsive/accessibility rules and executable blueprints derived from canonical repository contracts. | FR-108, FR-109, NFR-108, NFR-109 |
| **AC-130** | Unknown, stale, incompatible or schema-invalid component, variant, binding, blueprint and skill references are rejected before a proposal can classify them as reachable or mutate a draft. | FR-108, FR-109, FR-117, NFR-101, NFR-105 |
| **AC-131** | Initial storefront generation and follow-up editing have separately identified Skill package contracts with separate schemas, declared authority, quality gates and evidence. Runtime merchant execution remains a P10C responsibility. | FR-105, FR-108, FR-113, NFR-101, NFR-108 |
| **AC-132** | Scope-classification and instruction-router contracts reject any plan whose declared authority silently widens beyond the selected section, page, shared frame, design system or complete-storefront scope. Runtime merchant controls and execution remain P10C responsibilities. | FR-108, FR-113, NFR-101, NFR-105 |
| **AC-133** | Every executable PageBlueprint compiles through controlled operations into the same canonical StorefrontSnapshot used by editor, preview, save, history and publish. | FR-109, FR-113, FR-115, NFR-105, NFR-109 |
| **AC-134** | Golden-store evaluation proves grounded composition, canonical-commerce preservation, accessibility and responsive quality across representative catalogue shapes and at least one non-jewellery merchant. | FR-109, FR-110, FR-114, NFR-102, NFR-103, NFR-108 |
| **AC-135** | Publication deterministically validates and publishes the accepted StorefrontSnapshot without an AI call, provider payload or provider-owned page graph at publish time. | FR-108, FR-115, NFR-101, NFR-105, NFR-107 |
| **AC-136** | Proposal and PageBlueprint validation accept only registered PageBlueprint recipe profiles, registered compatible families/variants, permitted slots/order/bindings/assets and typed parameters within registered bounds; they reject arbitrary trees, raw CSS, arbitrary class names, executable JavaScript/React or generated code, unrestricted font imports and out-of-contract layout/style values before proposal acceptance. | FR-119, FR-120, FR-121, NFR-101, NFR-109 |
| **AC-137** | Validation and renderer proof enforce `BrandSystem → registered PageBlueprint recipe profile → component family/variant → constrained instance override`: semantic tokens flow downward, invalid or unrelated local visual-language overrides fail, renderer-visible values derive from canonical typed state, and every supported capability is proved registered → planner-selectable → proposal-expressible → compiler-preserved → StorefrontSnapshot-stored → renderer-visible → editor-editable → manually live-proven. | FR-119, FR-122, FR-124, NFR-101, NFR-108, NFR-109 |
| **AC-138** | Without approved merchant evidence, optional trust/evidence sections are omitted; registry defaults cannot introduce unsupported delivery, materials, durability, guarantees, sustainability, popularity, performance or certification claims; approved evidence provenance is preserved; and screenshot-level review at 375, 768, 1024 and 1440 px proves homepage, collection and PDP as one coordinated storefront using representative approved assets. Placeholder-only, deterministic-only or schema-only evidence fails. | FR-114, FR-123, FR-124, NFR-101, NFR-102, NFR-103, NFR-110 |

### P9-04D objective design-diversity gate

The 29 July 2026 real-AI Lumo evaluation showed that a valid generated storefront can still be
generic. P9-04D is therefore a binding Phase 9 acceptance gate, not a palette comparison. The
same project, canonical catalogue and approved assets must produce these registered directions:
`premiumEditorial`, `modernTechnical` and `warmApproachable`.

For every direction pair, the acceptance harness independently verifies homepage section
structure/order, hero, navigation, collection discovery, product cards and story/trust/campaign
presentation; collection discovery/filter, structure and product-card presentation; and PDP
gallery, information hierarchy and option/variant presentation. Homepage, collection and PDP must
share the selected registered PageBlueprint recipe-profile/token identity. Colour-only,
typography-only and one-section-only changes fail, as do mixed-direction pages.

The executable evidence matrix covers EN and FI at 375, 768, 1024 and 1440 px, plus one
collection, multiple collections, small and large product counts and missing optional media.
Measured results must reject overflow, clipping, overlap, invalid empty space and failed layout
probes. Merchant-visible locale evidence must not leak fixture brands, component/recipe IDs or
provider terminology. Asset-use evidence must preserve approved role, provenance and correct
product/collection ownership. Each generated direction is compared directly with the canonical
source-commerce baseline; pairwise output agreement alone is insufficient.

## 18.3 Definition of done for every implementation task
- The merchant-visible capability is explicit and demonstrable.

- Affected v1.2 requirement and acceptance IDs are named.

- No competing commerce/product model or direct protected-field mutation is introduced.

- Loading, empty, error, stale, unavailable and success states are handled.

- Focused unit/integration tests and relevant responsive/accessibility checks pass.

- Provider, storage and Vesko boundaries remain behind interfaces.

- SDD/ADR/component documentation is updated when contracts or roadmap assumptions change.

# 19. Correct development roadmap
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Authoritative commercial roadmap synchronization</strong></p>
<p>The controlled lifecycle is retained, but repository infrastructure is not the same as a proven merchant outcome. Phase 9 remains active until meaningful grounded multi-page composition and its complete evidence gate pass. The binding order is Phase 9, P10A publishing closure, P10B Commercial Storefront Design System v1, P10C Storefront Studio Editing Experience v1, deferred P10D advanced registered media, P11 stable domains/reference adapters and P12 production hardening.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 19.1 Completed baseline
| **Completed area**                 | **Outcome**                                                                                    |
|------------------------------------|------------------------------------------------------------------------------------------------|
| Foundation and renderer            | Canonical schemas, registered components, responsive rendering, fixtures and storage adapters. |
| Editor and manual design           | Canvas selection, page context, manual operations, device modes and undo/redo.                 |
| Guided onboarding baseline         | Persisted onboarding, design brief/generation review foundations and project creation flow.    |
| Controlled AI operations           | Intent scopes, structured proposals, validation, protected fields and confirmation lifecycle.  |
| Provider and whole-storefront foundations | Secure provider adapter, complete-snapshot proposal, atomic application and composite history. Live complete-store quality remains unverified. |
| Draft and publishing               | Separate draft/save/publish, history and restore architecture.                                 |
| Deterministic design-agent proof   | Karvonen/Lumo fixtures, mocked provider-boundary tests and protected lifecycle tests. Retained live-provider evidence is still required. |

## 19.2 Remaining phases
| **Phase**                                              | **Scope**                                                                                                                     | **Merchant outcome**                                                                                     | **Gate**                                                                    |
|--------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| **P4.1 — Real-AI findings and hardening**              | Fix only confirmed provider parsing, supported intent, error messaging, stale/timeout and fixture-content problems.           | Normal real-provider requests behave through the existing safe lifecycle.                                | One focused hardening PR set; no architecture rewrite.                      |
| **P5 — Dynamic component and binding platform**        | ComponentDefinitionV2, binding contracts, page blueprints, asset roles, versioning and generic commerce projection.           | The AI has a reusable design vocabulary that is not merchant- or product-specific.                       | Contracts merged and adapter tests green.                                   |
| **P6 — Dynamic commerce page depth**                   | Dynamic PDP first; then product cards, collection filters, collection headers and homepage commerce sections.                 | Rings, watches and other product types render the right options and information automatically.           | Complex ring and simple watch acceptance journeys pass at all viewports.    |
| **P7 — URL-first onboarding and brand reconstruction** | Source discovery, provenance, canonical reconciliation, brand evidence, asset inventory and approved Storefront Design Brief. | A merchant can connect an existing site or start from minimal assets without rebuilding catalogue truth. | URL → approved brief works with deterministic and real public-source modes. |
| **P8 — Asset-aware initial generation**                | Compose homepage, collection and dynamic PDP from the brief; reuse approved assets; remove fixture defaults.                  | The first generated storefront feels specific to the merchant and catalogue.                             | Initial generation passes source/asset/binding checks and visual review.    |
| **P9 — Meaningful grounded storefront generation** | Minimum proof-enabling registered capability reachability; coordinated shared frame, homepage, collection and PDP composition; approved-brief runtime handoff; commerce/assets; atomic apply/undo; persistence, preview and publish; responsive, accessibility and real-provider evidence. | A merchant receives a coherent editable storefront from the exact approved brief revision rather than token-only or one-section variation. | The Phase 9 evidence matrix is complete, including retained FR-105 approval-to-runtime correlation; no token-only, fixture-leaking, renderer-only, unapproved-brief or API-response-only result may pass. |
| **P10A — Grounded orchestration and publishing closure** | Vocabulary freeze, capability audit, executable PageBlueprints, registry, Skills/router, functional/publishing quality contracts and deterministic publish compiler. | Governed generation/follow-up execution and publication compile the canonical snapshot. | P10A-08 closes before P10B with controlled-provider, publish/render/rollback and protected-commerce evidence; no merchant-operable editing or commercial-visual-quality claim. |
| **P10B — Commercial Storefront Design System v1** | P10B-01 through P10B-12: vocabulary, foundations, art direction, frame, families, merchandising, collection/PDP profiles, directions, narrative, responsive closure and visual gate. | Complete credible generated storefront without manual reconstruction. | Commercial component/profile reachability, directions and credible-asset manual screenshot/browser home/collection/simple-PDP/configurable-PDP review at 375/768/1024/1440; no generic starter theme or schema-only closure. |
| **P10C — Storefront Studio Editing Experience v1** | Migrated asset governance/Studio work plus canonical Puck boundary, frame identity, approved operations, scoped AI and unified history. | Merchant can select/edit/reorder/undo/redo/save/preview/publish. | `StorefrontSnapshot` remains canonical; Puck has no persisted document model. |
| **P10D — Deferred advanced media and interactive presentation** | Migrated generated-image lifecycle, video, registered GLTF/GLB/Three.js presentation, presets, fallbacks and budgets. | Future rich media when justified. | Does not block P10B/P10C; registered governed interactive presentation is permitted, but no arbitrary generated application code or arbitrary/generated Three.js implementation is permitted. |
| **P11 — Stable domains and reference adapters** | Former P12 domains/ports and Vesko conformance adapter. | Integration without competing commerce truth. | Reference adapter passes standalone-equivalent fixtures. |
| **P12 — Production hardening and operations** | Former later deployment work: auth, tenancy, secrets, staging, observability, recovery and runbooks. | Safely operable integrated product. | Environment-specific operational gates pass. |

## 19.3 Next binding task sequence

Execute P10A-01 through P10A-08 in order after Phase 9 closes, ending with publish closure. Then
execute P10B-01 through P10B-12 in dependency order before P10C manual/Puck editing. P10C preserves
and renumbers former P10B asset/Studio tasks; P10D defers generated media and interactive 3D; former
Phase 12 moves to P11 and former later deployment work moves to P12. Parallel worktree assignments
must still declare owned files, dependencies and merge order; a worktree label never changes
canonical phase ownership.

## 19.4 Integration rules

1. Merge shared canonical contract work before dependent orchestration or UI work.
2. Update dependent worktrees with `git fetch` and `git merge origin/main`; never rebase.
3. Generate queryable knowledge from canonical contracts; do not hand-maintain a parallel registry.
4. Keep provider planning, proposal projections and editor adapters transient.
5. Use a controlled real-provider run only at its documented gate and retain safe evidence without
   prompts, raw payloads or secrets.

## 19.5 Explicit non-priorities before the integration-ready design demo
- Another catalogue-management or product-entry system.

- Operational inventory, orders, payments, logistics or returns.

- General CSV/Excel import as a prerequisite for the design agent.

- More AI provider adapters unless a production routing requirement appears.

- AI image generation before existing-asset reuse is strong.

- Broad industry expansion before jewellery/watches dynamic PDP and whole-store quality are proven.

- Unrestricted custom code or model-invented components.

# 20. Handoff and final integration package
## 20.1 Required handoff artifacts
| **Artifact**                     | **Required content**                                                                                                               |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| Authoritative SDD and roadmap    | v1.2 requirements, acceptance criteria, phase gates and task references.                                                           |
| Architecture decisions           | Controlled agent, Puck boundary, canonical commerce projection, component registry v2, URL-source trust and publishing boundaries. |
| Type and schema package          | Versioned component, binding, product presentation, source discovery, asset inventory, brief, proposal and snapshot schemas.       |
| Adapter package                  | Project context, commerce projection, media, storage, publishing, source discovery, AI provider and observability interfaces.      |
| Component and blueprint registry | Registered component manifests, responsive/accessibility contracts, migrations and page blueprints.                                |
| Reference fixtures               | Karvonen plus simple watch and complex ring fixtures following the canonical projection.                                           |
| Conformance tests                | Adapter parity, protected data, dynamic options, rendering, proposal lifecycle and publish/restore.                                |
| Deployment runbook               | Environment variables, secrets, staging access, reset workflow, monitoring and rollback.                                           |
| Integration guide                | Mapping table from Veskify contracts to Vesko services, owners, dependencies and unresolved decisions.                             |

## 20.2 Final acceptance journey
| **1. Open Storefront Studio →** | **2. Connect URL / minimal inputs →** | **3. Approve design brief →** | **4. Generate storefront →** |
|---------------------------------|---------------------------------------|-------------------------------|------------------------------|
| **5. AI redesign →**            | **6. Manual adjust →**                | **7. Save draft →**           | **8. Preview & publish →**   |
| **9. Restore history**          |                                       |                               |                              |

The final integration-ready result is not measured by the number of schemas or components. It is successful when a real Vesko customer can reach a product-type-correct, visually coherent storefront quickly, understand every proposal, preserve canonical commerce truth and publish safely without developer assistance.

## 20.3 Open implementation decisions
- Exact production source-discovery service and crawling limits.

- Exact mapping of Vesko product-type and option schemas into ProductPresentationContext.

- Whether page blueprints are code-first manifests, versioned JSON or generated from a typed DSL.

- Exact Vesko media ingestion and responsive crop service.

- Exact staging authentication and customer-demo access model.

- The final production provider routing and cost-control policy.

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Final baseline statement</strong></p>
<p>Veskify v1.2 is a controlled, reusable and integration-ready storefront design engine. Its next success depends on deeper dynamic components and merchant onboarding, not on expanding into commerce operations. The product must turn existing website evidence, minimal brand assets and canonical Vesko product data into a complete storefront while keeping every operational fact protected and every material design change reviewable.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# Appendix A — v1.1 to v1.2 requirement mapping
| **v1.1 area**                             | **v1.2 treatment**                                                                                 |
|-------------------------------------------|----------------------------------------------------------------------------------------------------|
| Executive definition                      | Reframed from standalone demo to Vesko Storefront Studio design engine.                            |
| New-store and existing-store journeys     | Existing-store URL path becomes primary; new-store path assumes minimal brand assets.              |
| Controlled component system               | Retained and expanded into a layered, versioned component/binding/blueprint platform.              |
| Product page                              | Replaced with dynamic product-type-driven PDP composition and option resolver boundaries.          |
| Product/catalogue intelligence            | Narrowed to presentation and reconciliation; canonical Vesko commerce projection is authoritative. |
| AI operations and guardrails              | Retained; capability vocabulary expanded for sources, assets, exact tokens and dynamic pages.      |
| Draft, preview, versioning and publishing | Retained as a proven baseline.                                                                     |
| Technical architecture                    | Expanded with source, commerce, media and publishing adapters for Vesko integration.               |
| Roadmap                                   | Reset from the verified Phase 4/publishing milestone.                                              |

# Appendix B — Dynamic PDP examples
## B.1 Watch example
| **Input**                | **Rendered result**                                                                                      |
|--------------------------|----------------------------------------------------------------------------------------------------------|
| **Product type**         | Watch                                                                                                    |
| **Variant dimensions**   | Colour                                                                                                   |
| **Attributes**           | Brand, model, case size, strap material, movement, water resistance                                      |
| **PDP composition**      | Gallery + compact summary + colour swatches + technical specifications + service/trust + related watches |
| **Hidden empty regions** | No ring-size, stone, karat or engraving UI.                                                              |

## B.2 Ring example
| **Input**              | **Rendered result**                                                                                                                                    |
|------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Product type**       | Ring                                                                                                                                                   |
| **Variant dimensions** | Ring size, metal colour, karat, stone type and diamond quality                                                                                         |
| **Order options**      | Engraving text and style                                                                                                                               |
| **PDP composition**    | Gallery + premium summary + ordered selector groups + size help + resolved price/availability + material/stone details + care/delivery + related rings |
| **Completion rule**    | Primary action waits for every required dimension; impossible combinations are disabled.                                                               |

# Appendix C — Codex task contract for v1.2.1
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>TASK TITLE<br />
[Outcome-based capability]<br />
<br />
OBJECTIVE<br />
[What the merchant can do after this PR]<br />
<br />
SPEC REFERENCES<br />
[v1.2/v1.2.1 sections, requirement IDs and acceptance criteria]<br />
<br />
BRANCH / PR<br />
[Exact branch; one task, one PR; never rebase]<br />
<br />
DEPENDENCIES<br />
[Required merged commit/PR and adapter/schema versions]<br />
<br />
OWNED FILES / DO NOT TOUCH<br />
[Prevent parallel worktree overlap]<br />
<br />
IN SCOPE / OUT OF SCOPE<br />
[Explicit product boundary]<br />
<br />
USER FLOW AND UI STATES<br />
[Default, loading, empty, error, stale, success, undo/publish]<br />
<br />
DATA / SCHEMAS / MIGRATIONS<br />
[Canonical contracts and version impact]<br />
<br />
TESTS<br />
[Focused unit/component/integration/visual as required]<br />
<br />
EVIDENCE<br />
[Requirement/AC, task, PR, commit, test, browser, screenshot, provider, status and limitation]<br />
<br />
VALIDATION<br />
[Focused tests; typecheck, lint, formatting once; rely on CI for full gate]<br />
<br />
DELIVERABLE<br />
[Commit, push, PR, one automatic review cycle, report and stop]</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# Appendix D — Glossary
| **Term**                      | **Definition**                                                                                                                       |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Vesko Storefront Studio       | Merchant-facing Vesko module for storefront onboarding, design, preview, draft, publishing and history.                              |
| Veskify                       | Internal controlled design engine powering Storefront Studio.                                                                        |
| Canonical commerce projection | Read-only product and collection presentation data mapped from Vesko operational truth.                                              |
| Component family              | Reusable engineering-owned component with approved variants, slots, bindings and responsive rules.                                   |
| Controlled page recipe        | Registered constrained profile or preset of permitted/default canonical PageBlueprint values for slots, compatible families/variants, order, bindings, assets, responsive constraints, coordination and omission/fallback rules; it is never a second page graph or executable representation. |
| Bounded parametric design     | Typed validated selection of approved visual parameters inside a registered PageBlueprint profile/family; the renderer, not AI output, converts them to CSS. |
| Page blueprint                | Canonical executable page-composition contract; recipe selection only materializes or constrains this contract before compilation to StorefrontSnapshot. |
| Component Knowledge Registry  | Queryable capability view generated from canonical component, binding, blueprint and renderer contracts; never a second registry.     |
| Skill package                 | Versioned controlled capability with explicit lifecycle, scope, required capabilities, operations, validation and evidence.           |
| Publish compiler              | Deterministic validation/publication path from an accepted StorefrontSnapshot; it makes no AI call.                                   |
| Storefront Design Brief       | Merchant-approved generation contract containing business, sources, brand direction, asset roles, page plan and assumptions.         |
| Source evidence               | Untrusted public website or uploaded information used to inform design, never to control permissions or override canonical commerce. |
| Dynamic PDP                   | Product-detail page composed from product type, attributes, variant dimensions, option groups and approved presentation rules.       |
| Proposal                      | Validated structured design changes shown for accept, revise or reject before entering the draft.                                    |
| Protected commerce truth      | SKU, product type, variants, option values, prices, stock, inventory and operational data that design operations cannot modify.      |
