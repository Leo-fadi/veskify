# Veskify Software Design Document v1.3.0

## 1. Document control and revision history

| Field                     | Value                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| Document                  | Veskify Software Design Document                                      |
| Version                   | 1.3.0                                                                 |
| Verified baseline         | 6 August 2026, current `main` after PR #165                           |
| Merchant-facing product   | Vesko Storefront Studio                                               |
| Internal controlled engine | Veskify                                                              |
| Status                    | Authoritative source specification                                    |
| Overall product status    | **Partial**                                                           |
| Binding decisions         | ADR-001 through ADR-004                                               |
| Delivery plan             | [`VESKIFY_DEVELOPMENT_ROADMAP.md`](VESKIFY_DEVELOPMENT_ROADMAP.md)    |
| Delivery status           | [`VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md`](VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md) |

| Revision | Date | Baseline | Purpose |
| -------- | ---- | -------- | ------- |
| 1.3.0 | 6 August 2026 | `27e08a0`, current `main` after merged PR #165 | Consolidate verified product truth, current architecture, commercial-design work, Studio ownership, and Vesko contract readiness. |
| 1.2.2 | 31 July 2026 | Historical source and DOCX export | Preserve the earlier commercial-vocabulary amendment and its historical evidence context. |

This document replaces the v1.2.2 source specification as the consolidated statement of current
product truth and approved architecture. Historical task reports and evidence records remain
historical. They do not override current code, contracts, tests, accepted evidence, ADRs, this
specification, or the current roadmap.

The synchronized human-readable export is
[`VESKIFY_SDD_v1.3.0.docx`](VESKIFY_SDD_v1.3.0.docx). The superseded v1.2.2 export is retained only
as [`archive/VESKIFY_SDD_v1.2.2.docx`](archive/VESKIFY_SDD_v1.2.2.docx) historical evidence.

### 1.1 Status and evidence vocabulary

Every capability uses exactly one implementation status:

- **Baseline** — implemented through the canonical lifecycle with sufficient evidence for its
  stated outcome;
- **Partial** — real implementation exists, but merchant delivery, reachability, or required
  evidence is incomplete;
- **Planned** — approved future work without a current implementation claim;
- **Deprecated** — compatibility-only implementation intended for retirement or migration;
- **Blocked** — unsafe to proceed without an unresolved authority, contract, or external system.

Evidence is classified separately as contract/schema, deterministic unit, integration,
browser/E2E, real-provider, retained human visual review, Vesko staging, or production. A higher
implementation status does not manufacture a stronger evidence level. Deterministic fixtures are
not real-provider, human visual, staging, or production evidence.

## 2. Executive product truth

Veskify is a controlled storefront-design engine. It is not a general website generator and not a
commerce system. The repository contains a substantial deterministic foundation: canonical
storefront state, registered capabilities, PageBlueprint materialization, governed initial and
follow-up proposal execution, strict internal scope authority, editing adapters, history, draft
persistence, an authoritative publishing gateway, a deterministic publish compiler, and published
home, collection, and product-detail rendering.

The product remains **Partial**. Phase 9 is closed by product-owner handoff, and P10A is
substantially implemented but not closed. Controlled real-provider acceptance, accepted-AI receipt
wiring, atomic compiled-artifact persistence and rollback, and complete retained publication
evidence remain. The current merchant editor does not yet expose the governed routing and scoped
editing authorities; that is intentionally P10C work, not a P10A closure blocker.

The current visual ceiling is a clean, responsive catalogue storefront with useful commerce depth
but limited brand distinction. P10B is the first phase allowed to claim a commercially credible
design system. The next major customer milestone is:

> Generate a complete storefront that a serious retailer can publish without a designer rebuilding
> it.

Vesko's OpenAPI 3.0 contract has been obtained and audited. It exposes useful store, catalogue,
media, inventory, Puck, and storefront product surfaces, but is insufficient for safe production
integration. Typed responses, security and tenancy authority, revision semantics, navigation and
synchronization contracts, and canonical Veskify draft/history/publication APIs remain unresolved.
There is no Vesko staging or production evidence.

## 3. Mission and product boundary

### 3.1 Mission

Vesko Storefront Studio should let a retailer reuse an existing website, brand assets, product
media, and canonical Vesko commerce data to approve a storefront brief, generate a complete
storefront, improve it through controlled natural-language and visual edits, and explicitly save,
preview, and publish it.

The product reduces the design and composition burden of Vesko onboarding. It serves merchants who
may have a logo and product imagery but no complete design system. Jewellery and watches remain the
first deep reference domain, while the architecture must safely support unknown product types.

### 3.2 Veskify authority

Veskify owns presentation and composition:

- projects, brand systems, pages, sections, navigation, snapshots, drafts, and history;
- registered component families, meaningful variants, slots, and bounded parameters;
- PageBlueprints and registered profiles;
- presentation bindings and product-presentation contexts;
- source evidence, asset inventory, approved asset roles, and storefront design briefs;
- governed skills, plans, operations, proposals, acceptance, and restoration;
- deterministic publication compilation and Veskify publication authority;
- editor, preview, and published-renderer projections.

### 3.3 Vesko authority

Vesko owns operational commerce and sellability. Veskify consumes these facts read-only and must
never mutate or replace:

- product, variant, option, and SKU identity;
- canonical product type and attributes;
- price, compare-at price, stock, availability, and inventory;
- canonical product and variant media;
- orders, payments, checkout operations, shipping, tax, returns, and logistics.

Public source evidence can inform presentation but cannot override Vesko commerce truth. Generated
copy must not invent materials, certifications, guarantees, delivery promises, availability, or
price facts.

### 3.4 Explicit product boundary

Veskify is not a catalogue importer, product-information manager, inventory agent, arbitrary code
generator, merchant-specific component factory, unrestricted CMS, or replacement for Vesko
services. AI may select and parameterize registered authority. It may not generate executable
React, HTML, CSS, JavaScript, scripts, shaders, or arbitrary Three.js implementations.

## 4. Canonical architecture

### 4.1 Authority flow

The canonical storefront lifecycle is:

```text
approved evidence and read-only Vesko commerce
  → registered capability and PageBlueprint authority
  → governed instruction and scope
  → structured plan and proposal
  → validated StorefrontSnapshot
  → review and atomic acceptance
  → draft, history and preview
  → deterministic publication compilation
  → immutable published version
  → homepage, collection and PDP rendering
```

`StorefrontSnapshot` is the sole canonical editable aggregate across generation, editing, preview,
save, history, restore, and publication. Planner payloads, proposals, Puck data, compiler input, and
renderer projections are transient. No task may introduce a second page graph, storefront plan,
component inventory, blueprint engine, asset inventory, commerce model, or publish model.

### 4.2 Architectural layers

1. **Domain contracts** define projects, `BrandSystem`, `StorefrontSnapshot`, commerce projections,
   bindings, proposals, receipts, and publication records without UI, provider, or Puck types.
2. **Registered capability platform** defines component families, variants, fields, slots,
   migrations, PageBlueprints, profiles, render targets, and generated queryable manifests.
3. **Application authorities** resolve briefs, route governed requests, compile proposals, apply
   acceptance, manage draft/history, and compile publications.
4. **Adapters** isolate providers, Puck, browsers, files, databases, Vesko, media, discovery, and
   publishing transports.
5. **Renderers** project the same canonical snapshot into editor, preview, and published routes.

### 4.3 Binding architecture decisions

- **ADR-001:** Puck is an isolated editor foundation, not canonical state or persistence.
- **ADR-002:** AI is a controlled design agent producing validated structured operations.
- **ADR-003:** URL discovery is untrusted evidence with provenance and reconciliation.
- **ADR-004:** commerce components bind dynamically to canonical projections and preserve every
  available option group through a generic fallback architecture.

## 5. Current verified capability baseline

The current baseline is code-grounded in the capability evidence ledger and truth audit.

| Capability area                                      | Status      | Verified truth                                                                 |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| Canonical storefront and brand contracts             | **Baseline** | `StorefrontSnapshot` and `BrandSystem` govern editable presentation state.     |
| ComponentDefinitionV2 and generated manifest         | **Baseline** | Registered definitions are runtime-queryable without a parallel inventory.     |
| PageBlueprint profiles and materialization           | **Baseline** | Registered profiles materialize canonical page composition.                    |
| Dynamic collection and PDP commerce presentation     | **Baseline** | Canonical bindings, option groups, variants, media, price, and availability render safely. |
| Source evidence, asset inventory, and approved brief | **Baseline** | Provenance and protected-commerce reconciliation are contracted and tested.    |
| Governed initial generation                          | **Partial**  | Internal authority exists; normal merchant editor reach is P10C work.           |
| Governed follow-up editing                           | **Partial**  | Internal authority exists; normal merchant editor reach is P10C work.           |
| Strict scope routing                                 | **Partial**  | Internal fail-closed authority exists; merchant clarification UI is P10C work.  |
| Proposal review, atomic acceptance, undo/redo        | **Baseline** | Canonical lifecycle and stale/invalid rejection are deterministically covered.  |
| Puck/editor projection                               | **Partial**  | Real adapter and editor exist; the full merchant-operable Studio chain is incomplete. |
| Draft save, history, and restore                     | **Baseline** | Standalone canonical persistence and lifecycle evidence exist.                  |
| Controlled real-provider acceptance                  | **Blocked**  | No eligible approved provider configuration is currently available.            |
| Accepted-AI receipt-to-gateway composition           | **Partial**  | Receipt and gateway authority exist but active acceptance wiring is incomplete. |
| Authoritative merchant publishing gateway            | **Baseline** | Server-side auth, permission, preparation, confirmation, and idempotency exist. |
| Deterministic publish compiler                       | **Baseline** | Exact snapshot and live authority compile to deterministic immutable output.    |
| Compiled-artifact persistence and rollback           | **Planned**  | P10A-08C-02B owns atomic artifact/version history and rollback.                  |
| Published home, collection, and PDP rendering        | **Baseline** | Canonical published snapshot routes render; final compiler-correlated evidence remains. |
| Commercial storefront design system                  | **Planned**  | P10B owns the first commercial visual-quality claim.                            |
| Vesko reference integration                          | **Blocked**  | OpenAPI exists but is incomplete and no staging authority or evidence exists.   |
| Authentication, tenancy, observability, deployment   | **Partial**  | Foundations exist; production service closure belongs to P11/P12.               |

Phase 9 is closed by product-owner handoff. Its retained records remain evidence with their stated
limits; closure does not convert deterministic or narrow human review into current commercial,
real-provider, staging, or production proof.

## 6. AI generation and editing governance

### 6.1 Required lifecycle

All AI-assisted design changes follow:

```text
merchant instruction
  → normalized intent and explicit scope
  → authorized initial or follow-up skill package
  → structured operations
  → schema and semantic validation
  → protected-commerce and authority guards
  → isolated proposal transaction
  → merchant review
  → accept, revise, or reject
  → explicit save or publish
```

Provider output is untrusted data. Unknown operations, fields, components, variants, bindings,
assets, profiles, or parameters fail closed. Invalid, failed, stale, or rejected proposals leave
the active draft and history unchanged. Whole-storefront proposals apply and undo atomically.

### 6.2 Package and routing authority

Initial generation and follow-up editing use distinct governed packages with different permissions,
input authority, and evidence requirements. The strict router resolves selected-section,
current-page, shared-frame, and whole-storefront scope. Ambiguous requests require clarification;
they must not silently broaden scope.

P10A owns these internal authorities and their functional evidence. P10C owns their
merchant-operable presentation in Storefront Studio: routing feedback, clarification UI,
frame/page scope controls, and execution from the normal editor. Merchant-facing wiring is not a
P10A closure requirement.

### 6.3 Parameters and providers

Only registered bounded parameters may be expressed. Unsupported canonical runtime projection
must fail with a typed deterministic error before proposal compilation; parameters may never be
silently discarded. Provider-specific request and response formats stay behind adapters. The
deterministic provider remains the default for reliable tests.

Controlled real-provider acceptance is a separate evidence exercise. P10A-07C-03R can run only
with explicit approval and an eligible trusted OpenAI configuration. The initial-generation case
must succeed before the follow-up case, evidence must be retained safely, and no retry is allowed.

## 7. Component, PageBlueprint and direction model

### 7.1 One registered capability platform

`ComponentDefinitionV2` is the canonical component definition. Its generated capability manifest
must be derived from live definitions and expose versions, families, meaningful variants, slots,
fields, bindings, permissions, renderer identities, and migrations. Planners, compilers, editors,
and renderers query this authority; they do not maintain duplicate component inventories.

Composite collection and product-detail PageBlueprint slots resolve through their canonical
runtime owners, including `dynamicCollectionCommerce` and `dynamicProductDetail`. Shared-frame and
page selections bind to exact materialized slots. A registered but different variant is not an
equivalent authority.

### 7.2 PageBlueprint authority

A commercial page recipe is only a registered constrained `PageBlueprint` profile. It may define
permitted and default slots, component/variant compatibility, order, omission/fallback rules,
bindings, assets, responsive constraints, and bounded parameters. It never becomes another page
tree, template runtime, or independently executable recipe engine.

Materialization produces the exact canonical slots that proposal compilation, snapshot storage,
editor projection, preview, and publication preserve. Optional authority may be inferred only from
the exact current executable materialization; stale, unknown, or ambiguous authority fails closed.

### 7.3 Design inheritance

The exact inheritance chain is:

```text
BrandSystem
  → registered PageBlueprint profile
  → compatible component family and meaningful variant
  → bounded validated instance override
```

`BrandSystem` owns global semantic presentation tokens. A PageBlueprint profile constrains page
composition. A family and variant provide a maintained renderer implementation. An instance
override may alter only registered bounded values. Direction packages select compatible
combinations across this chain; they are not a second token system, recipe authority, or page
authority.

### 7.4 Responsive and dynamic commerce rules

The same registered implementation renders in editor, preview, and published routes. Components
must be keyboard accessible and responsive at 375, 768, 1024, and 1440 px. Product pages render
all option groups supplied by canonical commerce, resolve selected variant price, availability,
and media without mutation, handle incomplete and unavailable selections, and retain unknown
attributes through a safe generic fallback.

## 8. State, editor and lifecycle

### 8.1 Canonical state

`StorefrontSnapshot` contains the editable brand system, shared frame/navigation, pages, sections,
bindings, presentation references, revisions, and provenance needed by the controlled lifecycle.
`PageModel` is a member of that aggregate, not a competing canonical graph.

Draft mutation occurs only through validated commands and proposal acceptance. Every operation is
scoped, reversible where required, and correlated to the current revision. A stale operation must
not partially apply.

### 8.2 Puck boundary

Puck provides selection, insertion, drag-and-drop, reordering, fields, canvas mechanics, and
viewport controls. Direct Puck types remain inside `src/integrations/puck`. Puck data is transient
adapter state. Raw Puck payloads, including Vesko's current `/puck` surface, are incompatible with
canonical `StorefrontSnapshot` persistence and cannot become a save, history, or publication API.

### 8.3 Merchant lifecycle

Save draft and Publish changes remain distinct explicit actions. Editor, preview, history, restore,
and publication must preserve the same canonical content and bindings. P10C closes the full
merchant chain:

```text
select frame
  → manual edit
  → bounded AI edit elsewhere
  → add/remove/reorder
  → undo/redo
  → save
  → preview
  → publish
```

The minimum pilot editor requires the asset library, canonical Puck boundary, stable frame identity,
approved manual operations, the required Storefront Studio shell subset, and working save,
preview, and publish actions.

## 9. Publishing architecture

### 9.1 Authoritative gateway

The browser may request and confirm publication but cannot publish directly, advance a pointer, or
construct trusted accepted-AI authority. The server authenticates the merchant, checks the
`publishStorefront` permission, resolves current project and draft authority, stores a bounded
preparation, and invokes the authoritative `StorefrontPublishingGateway`.

Manual and accepted-AI authority remain distinct. Accepted-AI publication resolves a durable,
immutable acceptance receipt on the server and validates exact project, draft, proposal, snapshot,
registry, manifest, profile, commerce, and approved-asset lineage. Browser-submitted receipt
content is invalid. Stale authority, accept-then-undo divergence, and idempotency conflicts fail
without moving publication state.

### 9.2 Deterministic compiler

The publish compiler transforms the exact authorized `StorefrontSnapshot` and current live
authorities into an immutable renderer-ready result and deterministic compile receipt. It is
write-free and provider-free. It validates component/profile/renderer reachability, bindings,
protected commerce, routes, locales, assets, accessibility, and migrations. Confirmation reloads
authority and recompiles; any identity drift fails before publication.

### 9.3 Remaining publication closure

P10A-08B-02 must connect authoritative proposal acceptance to durable accepted-AI receipt creation
and active gateway composition. P10A-08C-02B must atomically persist the immutable compiled
artifact with publication operation, history, active artifact/version pointer, and safe
rollback/republish authority. This compiled artifact is derived publication state, not another
editable model.

P10A-08D-02 must retain final browser and human evidence for gateway/compiler publication of home,
collection, and PDP routes, plus failure/no-partial-write, active-version, rollback, republish, and
zero-provider-during-publication behavior. P10A-09 records closure only after these gates and the
eligible controlled-provider result are resolved or explicitly dispositioned.

## 10. Commercial Storefront Design System

### 10.1 Current ceiling

The current output is a competent, clean, responsive catalogue store. Homepage composition has
the most useful range; collection and PDP profiles are functionally safe but visually narrow.
Typography, spacing, layout, surfaces, controls, image art direction, shared frame, product cards,
and narrative depth do not yet form a sufficiently differentiated commercial system. Valid schemas,
component counts, fixture screenshots, and deterministic tests cannot establish commercial quality.

### 10.2 P10B outcome

P10B delivers Commercial Storefront Design System v1 through the existing canonical authorities.
It must produce one credible complete Premium Editorial storefront before broadening to Modern
Technical and Minimal Commerce. It then closes direction differentiation, narrative composition,
responsive behavior, and retained human commercial review.

The three registered directions are:

- **Premium Editorial** — luxurious editorial rhythm, high-quality imagery, restrained commerce,
  and strong narrative hierarchy;
- **Modern Technical** — precise, feature-led, structured, information-rich presentation;
- **Minimal Commerce** — quiet, product-forward, efficient commerce with disciplined density.

Each direction must differ materially across shared frame, typography, density, imagery, home,
collection, PDP, and composition—not merely palette or spacing. Optional proof and trust content is
shown only when approved merchant evidence exists.

### 10.3 Commercial acceptance

P10B closes only when representative approved assets and canonical commerce produce a coherent
home, collection, simple PDP, and configurable PDP at 375, 768, 1024, and 1440 px. Required
evidence combines contract/schema, deterministic/integration/browser reachability, retained
screenshots, and human commercial review. Tests alone cannot close visual quality.

## 11. Storefront Studio and merchant editing

P10C delivers merchant-operable editing without changing canonical authority. It owns:

- a brand asset library with explicit roles and provenance;
- the canonical Puck boundary and stable shared-frame identity/selection;
- approved bounded manual add, remove, reorder, field, asset, and presentation operations;
- merchant-facing scoped AI routing, clarification, and execution;
- unified manual/AI history and undo/redo;
- the brand/asset editor and required Storefront Studio shell;
- commercial editor QA and the complete select-to-publish chain.

P10C does not create another state model, unrestricted page builder, commerce editor, provider
authority, component generator, or publishing command. The canvas is the primary workspace;
merchant UI uses merchant language and does not expose raw JSON, schemas, registry IDs, prompt
internals, or provider payloads.

## 12. Vesko integration architecture

### 12.1 Contract truth

The Vesko OpenAPI 3.0 contract has been obtained and audited. It establishes real endpoint surfaces
for store context, products, variants, categories, brands, media, inventory, Puck, and storefront
product reads. See [`VESKO_OPENAPI_CONTRACT_AUDIT.md`](VESKO_OPENAPI_CONTRACT_AUDIT.md) and
[`VESKO_VESKIFY_INTEGRATION_MATRIX.md`](VESKO_VESKIFY_INTEGRATION_MATRIX.md).

Contract acquisition is not integration sufficiency. Production integration remains **Blocked** by:

- incomplete or absent response schemas and error bodies;
- inconsistent security declarations and unresolved tenant/store authority;
- missing revisions, ETags, optimistic concurrency, and synchronization semantics;
- missing navigation projection contracts;
- no canonical Veskify draft, history, accepted-receipt, compiled-artifact, or publication APIs;
- no agreed media ownership and presentation-asset write boundary;
- no Vesko staging credentials, conformance environment, or retained staging evidence.

### 12.2 Integration rules

Veskify adapters translate stable Vesko contracts into canonical read-only projections. They do not
leak Vesko transport types into the domain or add commerce writes. Veskify presentation assets must
be explicitly separated from canonical product media. Raw Puck persistence is prohibited. Draft,
history, receipt, compiler artifact, and publication APIs must preserve `StorefrontSnapshot` and
the authoritative publishing lifecycle.

P11 owns contract closure, identity/store context, catalogue/navigation projection, full commerce
conformance, presentation assets, persistence, accepted-receipt/publication adapters,
synchronization, staging conformance, and pilot readiness. P12 owns production hardening and pilot
operations after P11 establishes stable authority.

## 13. Evidence and acceptance model

### 13.1 Evidence rules

Each claim names its evidence level. Required levels are cumulative only when the acceptance gate
says so. In particular:

- schema validation proves a contract, not rendering or merchant usability;
- deterministic and mocked-provider tests are not real-provider evidence;
- browser/E2E execution is not retained human visual review;
- local adapter conformance is not Vesko staging;
- staging is not production;
- a published snapshot route is not atomic compiled-artifact rollback evidence.

Evidence must correlate the relevant project, source/brief revision, proposal, accepted snapshot,
registry/manifest/profile authority, commerce and asset fingerprints, publication operation,
compiled artifact/version, and rendered route where those authorities apply. Secret values,
provider payloads containing sensitive data, and merchant private data must not be retained.

### 13.2 Capability-chain acceptance

For each storefront capability, assess the applicable chain:

```text
registered
  → runtime-queryable
  → planner-selectable
  → proposal-expressible
  → compiler-preserved
  → StorefrontSnapshot-stored
  → renderer-visible
  → editor-accessible
  → save/reload preserved
  → publish preserved
  → evidence retained
```

An upstream pass cannot conceal a downstream gap. A capability can remain Partial even when its
contract and internal execution are Baseline if merchant reachability or required evidence is
incomplete.

## 14. Non-functional requirements

### 14.1 Safety and integrity

- Reject unknown or stale authority and preserve state on failure.
- Keep protected commerce read-only through generation, editing, save, and publication.
- Use create-once or transactional storage for immutable receipts and published artifacts.
- Authenticate and authorize server-side writes; never trust browser-submitted authority bodies.
- Keep provider credentials server-side and secrets out of logs and evidence.
- Treat crawled content as untrusted data and resist prompt injection.

### 14.2 Determinism and reliability

- Canonical fingerprints, manifests, materialization, proposal compilation, and publication
  compilation are deterministic for identical authority.
- Idempotent requests return the original result; conflicting reuse fails closed.
- Failed operations produce no partial proposal, draft, history, receipt, or publication write.
- Migrations are explicit, registered, tested, and fail closed when unresolved.

### 14.3 Accessibility and responsive behavior

- Merchant controls are keyboard accessible with meaningful labels and visible focus.
- Renderers preserve semantic structure, contrast, media alternatives, and safe fallbacks.
- Primary storefront and Studio journeys cover 375, 768, 1024, and 1440 px.
- Loading, empty, error, stale, unavailable, success, and unsaved states are explicit.

### 14.4 Performance and operations

- Published output uses deterministic, cacheable artifacts and bounded runtime data reads.
- Responsive images and art direction avoid unnecessary payloads and layout shifts.
- Observability correlates project, request, proposal, snapshot, publication, and adapter operations
  without exposing secrets or protected merchant data.
- Production claims require defined service levels, tenancy isolation, backup/recovery, security,
  monitoring, deployment, and incident procedures.

## 15. Phase sequence and exit criteria

The binding sequence is:

1. **P10A — Grounded orchestration and publishing closure.** Close controlled-provider evidence,
   accepted-AI receipt composition, atomic compiled publication/rollback, final publication
   evidence, and the closure record.
2. **P10B — Commercial Storefront Design System v1.** Deliver the first commercially credible
   complete storefront through registered visual authority and retained human review.
3. **P10C — Storefront Studio Editing Experience v1.** Deliver merchant-operable assets, manual and
   scoped AI editing, unified history, save, preview, and publish.
4. **P10D — Advanced media and registered interactive presentation.** Add governed generated media,
   video, and registered interactive presentation with fallbacks.
5. **P11 — Vesko Integration Readiness and Reference Adapter.** Close contracts and prove the
   canonical lifecycle in Vesko staging.
6. **P12 — Production hardening and pilot operations.** Establish production tenancy, security,
   observability, recovery, deployment, and pilot operations.

P10D is not a dependency for the first commercial storefront, the minimum merchant editor, or the
Vesko pilot. Detailed tasks, ownership, dependencies, evidence, and non-goals are maintained in the
roadmap and delivery tracker.

### 15.1 Phase exit summaries

- **P10A:** all remaining internal orchestration/publication gates are complete or explicitly
  dispositioned, with no merchant-editor wiring requirement.
- **P10B:** a serious retailer could publish the generated complete storefront without a designer
  rebuilding it, supported by retained responsive human review.
- **P10C:** a merchant completes the canonical select-to-publish editing chain in Storefront Studio.
- **P10D:** advanced media remains registered, governed, accessible, performant, and safely
  degradable.
- **P11:** the canonical lifecycle passes typed adapter conformance and end-to-end Vesko staging,
  and one real pilot has an accepted readiness record without implying broad production readiness.
- **P12:** production-readiness gates and controlled pilot operations pass with retained evidence.

## 16. Deprecation and migration

The following are compatibility-only or superseded authorities and must not guide new work:

- legacy component definitions and renderer paths superseded by ComponentDefinitionV2;
- hand-maintained capability inventories duplicated from the generated manifest;
- legacy deterministic/fixture editor routes that bypass governed package and scope authority;
- browser-owned publication methods or browser-created accepted-AI authority;
- raw Puck persistence or Puck-shaped canonical page state;
- independently executable recipe, template, direction, or storefront-plan representations;
- legacy product-card implementations duplicated outside the canonical commercial family;
- v1.2.2 phase descriptions that keep Phase 9 active or assign merchant editing outside P10C.

Migration must preserve canonical IDs, bindings, commerce truth, snapshot history, and published
authority. An unresolved migration blocks compilation or rendering rather than silently dropping
content or selecting a fallback variant.

## 17. Explicit current non-claims

Version 1.3.0 does not claim:

- that the overall product is Baseline or production ready;
- that current output has passed the P10B commercial visual-quality gate;
- that P10A is closed;
- that a successful retained P10A controlled real-provider case exists;
- that governed internal routing is wired into the normal merchant editor;
- that accepted-AI publication is fully composed end to end;
- that immutable compiled artifacts, active-version rollback, and republish are implemented;
- that final compiler-correlated home, collection, and PDP publication evidence is retained;
- that the Vesko OpenAPI contract is sufficient for production integration;
- that raw Vesko Puck persistence is compatible with `StorefrontSnapshot`;
- that Veskify may mutate commerce truth;
- that Vesko staging or production evidence exists;
- that authentication, tenancy, observability, deployment, and operations are production complete;
- that P10D advanced media is required for the first commercial storefront or pilot;
- that archived v1.2.2 prose describes current implementation or phase status.
