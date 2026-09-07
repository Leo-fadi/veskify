## AR-00 — Template-scoped architecture and replacement-roadmap addendum

**Status:** Normative upon explicit owner adoption/merge of AR-00; incorporated into the authoritative [SDD](../VESKIFY_SDD.md).

**Scope:** Future architecture and delivery policy only. This addendum does not implement a capability, change accepted historical evidence, or authorize AR-01.

## 1. Authority and retained invariants

This addendum resolves the future-policy conflict recorded by AR-00. StorefrontSnapshot remains the sole canonical editable storefront aggregate. `BrandSystem`, including versioned Design DNA, remains the authority for exact visual values. `PageBlueprint` remains the executable page-composition contract, and the registered component capability source remains the sole authority for reusable families, variants, anatomy, bindings, and permitted parameters. Puck is transient adapter data. Planner payloads, provider DTOs, proposals, renderer projections, execution records, and publish artifacts do not become a second editable storefront or page graph.

Vesko commerce remains read-only canonical truth. Existing protected-commerce, legacy-replay, proposal isolation, save/history, preview, publication, and explicit merchant acceptance guarantees remain in force. This addendum does not claim a Vesko endpoint, datastore, queue, host topology, checkout, production identity, or completed integration.

## 2. Template-scoped compilation and acceptance

Global planning may select only registered, bounded Design DNA, PageBlueprint profiles, component capabilities, and presentation bindings. It compiles one template-scoped design at a time, verifies it against the registered authority, and repairs only the bounded failed stage. The compiler then assembles one complete isolated proposal from the validated scopes. Merchant acceptance is final and atomic: it either accepts the complete proposal into the existing snapshot lifecycle or changes neither active draft nor history.

Scoped editing reuses this compiler, its permitted write set, protected-field guards, and stale checks. A scoped request must not become a separate editor, a per-product design document, or a bypass around proposal acceptance. Unsupported critical intent is disclosed rather than silently substituted.

Composition has one authoritative order: versioned composition references registered existing content
and does not duplicate it in a parallel page tree. New versions are additive and dispatch explicitly;
unknown versions reject before render, edit, save, or publish. Template stages declare their read set,
write set, source revisions, dependency fingerprints, and permitted repair scope. A changed global
revision invalidates dependent stage output; a changed unrelated resource does not. The final compiler
assembly validates all stage receipts and commits one proposal only after every required stage succeeds.

## 3. Operational persistence and freshness

Durable operational runs, stages, inputs, bounded artifacts, fencing/cancellation state, and retention metadata may exist outside `StorefrontSnapshot`. They support resume and audit but cannot hold competing editable design state, raw hidden reasoning, secrets, or authority to accept a draft. Hashes alone are insufficient if retained outputs cannot be resumed. Access control, retention, idempotency, recovery, and authoritative host storage are staged work, not existing capability claims.

Each run has an authorized owner, monotonic stage transition, fencing token, cancellation fence, and
idempotency key. An expired worker cannot commit after a later owner; uncertain provider calls consume
the declared budget until reconciled and do not trigger hidden retry or fallback. Artifacts retain
only the bounded inputs and outputs needed for recovery. Merchant locks and protected commerce remain
validated at compile, proposal, acceptance, and publish boundaries.

Presentation freshness is dependency-scoped. Current read-only commerce may refresh price, stock, availability, options, media, and route context without invalidating unrelated layout decisions. A changed dependency that affects the accepted proposal blocks stale acceptance. Supported versioned legacy snapshots retain their documented replay behavior; AR-00 clarifies future stale-commerce policy and does not rewrite strict historical replay.

## 4. Resource routing and initial family policy

One resource-route resolver receives host-provided context and selects registered templates and current commerce presentation. It must not maintain a design page for every product URL, duplicate the catalogue, or invent a Vesko route or deployment contract.

When resource assignment is actually enabled, its explicit assignment is first. Then select a
compatible type preference, ordered capability/complexity/context match, and only then a generic
safe fallback. Capability is checked for each candidate. A mandatory incompatible choice is
explained and has no fallback; it is never silently normalized. Resource
context is resolved from current canonical commerce at read time. Current options, price, stock,
availability, media, visibility, and locale are presentation inputs, never editable design facts.
Public SEO, release pointers, and publication remain host-bound staged work; no internal preview,
browser store, or publication artifact is promoted to a public release claim.

The first enabled complete families are **product-first-commerce** and **editorial-offset**. Each must cover the registered page roles through the same authority and renderer lifecycle. `campaign-modular`, `technical-comparison`, `warm-narrative`, and `restrained-gallery` remain deferred coverage; they are neither removed nor represented as completed. One concept is the default. Any optional comparison has to demonstrate material differences in merchant meaning, structure, visual identity, and registered realization.

## 5. Delivery gates and retirement

The [development roadmap](../VESKIFY_DEVELOPMENT_ROADMAP.md) is the delivery-order authority and contains the complete AR outcome/dependency/acceptance/non-goal/rollback plan. The [delivery tracker](../VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md) alone owns task status; this addendum and other documents are status projections.

The current status projection takes effect upon explicit owner acceptance/merge of AR-01; it does not assert the PR's actual lifecycle or owner acceptance. AR-00 is Baseline / closed. AR-01 is Baseline / closed. AR-02 is Planned — exact next task, not started. AR-23 depends only on AR-01 and is eligible alongside later eligible work; numeric order does not serialize it behind visual packages. AR-08 closes the foundational refactor evidence, AR-22 accepts engine quality, and AR-28 accepts the integrated pilot. Retirement occurs only after caller inventory, persisted-version support, replacement behavior, and regression evidence; names, apparent deadness, or an old hash guard are insufficient.

## 6. Requirement and evidence relationship

No new authoritative FR, NFR, or AC identifiers are introduced. Existing retained requirements remain mapped by the source-disposition record. The accepted P10B-19A architecture, A-10C decision and closure manifest, historical fixtures, metrics, and protected source remain historical authority with their original identities. Historical B-01 “next” statements describe the accepted A-10C event only; they do not schedule current work after this addendum.

## Complete supplied target architecture

The following owner-supplied target architecture is incorporated as normative future policy, with the AR-00 closure/status correction and committed-authority substitutions stated above. External W references are source references, not new verified implementation claims.

**Architecture reset AR / revision 1.0 — 4 September 2026**

**Reviewed repository:** `Leo-fadi/veskify`

**Original source review base:** `f9af2b2f007ff1bcb0f20a046edf33bc1f10ea37`; **AR-00 adoption base:** `db95f7c055217d380e88cebe50256741905d222c`

**Historical source status (4 September 2026):** Proposed replacement architecture, commissioned by the product owner. Not yet adopted in the repository and not implemented by this report.

**Evidence:** IDs are catalogued in [AR-00 source disposition](../AR_00_SOURCE_DISPOSITION_AND_ACCEPTANCE.md). Current facts, recommendations and unverified integration assumptions are distinguished there.

## 1. Decision

Retain Veskify's controlled storefront foundation. Replace its coupled, whole-store preset-selection centre with **globally coordinated, template-scoped design compilation**.

The product remains Vesko Storefront Studio. Veskify remains its controlled design engine, not another commerce platform or a general code generator.

> Plan the store together. Design reusable templates incrementally. Validate their actual rendering. Assemble one isolated proposal. Accept atomically. Serve current commerce independently of design generation.

This is a substantial refactor with bounded completion gates, not a replacement repository, a second canonical model, or a requirement to perfect every internal module before shipping useful design improvements.

### Decisive changes

| Existing constraint or pattern                                               | Corrected decision                                                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A broad commercial posture selects a tightly correlated design package       | Preserve independent merchant meaning, structure, visual identity and commerce requirements through compilation   |
| Complete-store generation is the sole execution granularity                  | Whole-store planning, template-scoped work, whole-store acceptance; scoped edits use the same compiler and guards |
| PageBlueprint v2 topology exists without a production visual consumer        | Add a canonical executable composition projection and prove it through renderer, editor, save and publication     |
| Six families and mandatory three concepts precede the finished experience    | Two deep complete families first; one concept by default, explicitly requested alternatives later                 |
| Request-local generation and transient-only interpretations                  | Durable bounded execution records outside the editable snapshot; retain only necessary validated artifacts        |
| Exact whole-catalogue equality across generation                             | Dependency-scoped presentation checks; independently current commerce, without loosening read-only protection     |
| Route inventory participates in template expansion/folding                   | Design templates once; resolve resource routes independently; preserve old route-inventory readers                |
| All legacy code appears removable after a new design                         | Retire active obsolete generation; retain required read/render/edit/publication compatibility                     |
| Phase history and source hashes constrain future implementation indefinitely | Preserve historical evidence; explicitly supersede current-source equality guards with mapped behavioural gates   |

No microservice fleet, new checkout, second component inventory, new canvas engine or arbitrary AI-authored frontend code is introduced.

## 2. What is already real

The reviewed code already calls the semantic provider before its final complete materialization. It already stores compact commerce archetypes and resolves route-specific commerce projections. It already has substantial proposal, history, canonical-state and publishing machinery. The early P10B-16L diagnosis must not be reapplied as though those corrections never happened. [E03, E04, E05]

The remaining bottlenecks are narrower and concrete: the semantic choice space remains correlated; v2 structural contracts are inactive; current dynamic archetype editing expects one composite section; the materializer temporarily expands route instances; normal integration is not production-connected; and long-running generation lacks durable coordination in the inspected handler. [E04–E10]

These findings justify changing the centre and its boundaries. They do not justify deleting all `legacy`, `whole-storefront`, `history`, `services` or `P10B` paths.

## 3. Invariants that survive the reset

1. **One editable aggregate:** `StorefrontSnapshot` owns accepted storefront design. `PageModel` remains a member, not an independent site graph.
2. **One visual authority:** exact accepted design tokens live in `BrandSystem` / versioned Design DNA. A provider recipe is not another editable design system.
3. **One component capability source:** `ComponentDefinitionV2` and its registered definitions generate projections for providers, validation, editing and rendering.
4. **One page composition language:** extend PageBlueprint v2 and its realization. Do not add a competing layout DSL, generic DOM tree or recipe engine.
5. **Commerce ownership:** Vesko owns product identity, options, variants, prices, stock, media and transactions. A design run has no commerce-write authority.
6. **Puck isolation:** Puck is an adapter over canonical design, never persisted truth.
7. **Explicit lifecycle:** candidate preview is not acceptance; acceptance is not Save; Save is not Publish.
8. **Bounded failure:** malformed, stale, unauthorized or unsupported critical output never changes the active draft, history or publication.
9. **Version honesty:** old documents retain their actual lineage; no fake v2 identity or automatic destructive migration.
10. **Evidence honesty:** contract tests, browser tests, live provider results, human quality review and Vesko production evidence remain separate claims.

## 4. Target logical architecture

```text
                      AUTHORING / CONTROL SIDE

Merchant request + approved brief, assets and facts
                    |
Authenticated request and scope resolution
                    |
GenerationRun / explicit budgets / dependency revisions
                    |
AI Creative Brief + global visual preferences
                    |
Deterministic compatibility + compiled BrandSystem
                    |
Global design contract + ordered template work plan
                    |
       +------------+-------------+----------------+
       |                          |                |
  Home template              PDP templates   Collection/search
       |                          |                |
       +---------- template-scoped compiler -------+
                    |
      Registered composition and component realization
                    |
   Per-template validation, rendering, bounded correction
                    |
    Factual content and utility composition + store checks
                    |
      Final canonical assembly -> isolated proposal
                    |
      Accept / Undo / Redo -> Save -> explicit Publish
                    |
      Existing atomic artifact/version publication

                       SHOPPER / SERVING SIDE

Verified store/domain + locale + resource URL
                    |
Current canonical route/resource resolution
                    |
Released template selection + capability validation
                    |
Same registered renderer + current commerce context
                    |
HTML / metadata / structured data + interaction islands
                    |
            Existing Vesko commerce commands
```

This is a logical division inside a modular application. A worker may run in a separate process for execution reliability. It does not require a separately deployed service per stage. The final host topology and datastore must follow the actual Vesko monolith integration contract, not assumptions made in this report.

## 5. Authority ownership and persistence

| Record or projection                                           | Owner                                                         | Persistence and authority                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `StorefrontSnapshot`                                           | Existing storefront domain                                    | Canonical accepted editable design and history                                                                   |
| `BrandSystem` with Design DNA v1/v2                            | Existing design-system domain                                 | Exact merchant visual values inside snapshot                                                                     |
| Registered PageBlueprint/family/component definitions          | Existing code registries                                      | Versioned reusable capabilities, not merchant state                                                              |
| `GenerationRun` and stage attempts                             | Application execution + host storage adapter                  | Durable operational state; cannot be served as accepted design                                                   |
| Validated creative interpretation and compiled stage artifacts | Generation run artifact store                                 | Bounded, access-controlled, retention-limited inputs/results required for resume and review                      |
| Global design contract                                         | Compiler-derived stage artifact                               | Immutable constraints for this run; accepted values ultimately live in snapshot, not in a second settings system |
| Candidate template result                                      | Existing canonical page/archetype representation plus lineage | Isolated, immutable pending artifact; becomes design authority only through acceptance                           |
| Route/resource index                                           | Runtime adapter / host                                        | Derived current lookup; not a second editable site graph                                                         |
| Catalogue projection                                           | Vesko read adapter                                            | Read-only current commerce, or a clearly identified historical/test observation                                  |
| Critic diagnostics/captures/preference records                 | Evaluation evidence store                                     | Non-authoritative, access-controlled evidence with retention policy                                              |
| Published artifact/version                                     | Existing publication storage                                  | Immutable compiled design release; active pointer moved only by authorized publication                           |

**Explicit amendment required:** the current broad “transient” rule is refined. It prohibits a competing editable/executable source of truth, not all durable operational checkpoints. A run must retain the actual validated information needed to resume; a collection of hashes cannot reconstruct lost stage output. Raw provider envelopes, hidden reasoning and secrets are not retained as execution authority. [E02, E15]

Unselected candidates may have short retention for comparison, retries and audit. Define deletion and access rules at the storage boundary. No generation artifact is publicly addressable merely because its ID is known.

## 6. Generation workflow

### 6.1 One merchant action, incremental execution

The default experience remains **Generate store**, not a wizard demanding approval of every page. Studio shows progress, useful isolated previews, unsupported requirements and an eventual complete proposal. An optional guided workflow can introduce a deliberate design-direction checkpoint.

Default internal order:

1. Resolve identity, request scope, approved brief, facts, assets and compact catalogue capabilities.
2. Interpret merchant intent and compile a global direction: foundation, typography, surfaces, rhythm, controls and commercial priorities.
3. Plan the required template set and genuine static pages.
4. Generate the homepage and render it.
5. Generate the most demanding representative PDP early; cover simple and configurable products without losing generic option handling.
6. Generate collection and search presentation using shared card/control grammar.
7. Compose approved factual pages and utility presentation.
8. Evaluate whole-store navigation, coherence, locale coverage, commerce capabilities and mobile behaviour.
9. Assemble one complete canonical candidate and submit through the existing proposal lifecycle.

After the global contract is fixed, disjoint templates may execute with bounded parallelism. Start sequentially for predictable evidence. Do not let two workers rewrite shared BrandSystem, frame or navigation.

A template stage cannot silently reopen the global direction. If it discovers a required global change, return a typed blocked result. A deliberately created successor global-contract revision invalidates its dependent artifacts. Recompilation may reuse still-valid semantic artifacts; additional provider calls require remaining explicit budget. Do not start an oscillating automatic redesign loop.

### 6.2 Model calls are not tied to URL count

A provider call may author global preferences or the supported semantic decisions of one template. Deterministic factual pages and utility states need no mandatory model call. The provider never receives a catalogue-sized array of completed page candidates.

A budget is declared before execution: allowed stages, provider attempts, token limits, capture count, correction allowance and candidate-evaluation bound. Defaults remain zero automatic provider retry until an explicit retry policy is approved and tested. A normal run does not inherit the old mandatory two-call/three-concept shape.

The target is bounded work per design template and real content page. Catalogue summarization and route indexing may be O(N); expensive template design must not become one model call or one maintained layout per product.

### 6.3 Creative control, not renamed preset selection

Separate four layers:

- **Merchant meaning:** requested mood, priorities, must-haves, avoidances and unsupported intent.
- **Structure:** meaningful region relationships, relative prominence, reading order and commerce placement.
- **Visual identity:** independent foundation, type hierarchy, palette roles, surfaces, rhythm and control treatment.
- **Realization:** exact registered components, variants, parameters and approved asset placements.

Provider-owned preferences remain untrusted. They cannot grant tool permissions, publish rights or commerce writes. Merchant-critical constraints must be represented and reported; a failed requirement cannot disappear behind a successful schema parse.

Compatibility is a safety filter, not an excuse to select an unrelated design. Reuse A-08 compatibility and exact-validation logic. Merchant-fit selection must be an explicitly versioned policy over feasible alternatives; do not mutate historical scoring-free A-08 receipts into a new semantics. Stable fingerprint ordering is a final tie-break, not the primary measure of design appropriateness.

Any advertised capability must have a complete chain:

```text
supported provider vocabulary -> compiler decision -> renderer behaviour -> visual evidence
```

A new “asymmetry” field without layout consequences fails this requirement. A more powerful model cannot compensate for an absent renderer capability.

## 7. Canonical executable composition: the missing bridge

### 7.1 Current limitation

PageBlueprint v2 describes regions and relationships, but production registries remain empty. Current canonical static pages store flat sections, while dynamic commerce projection/editor logic retains one composite section. Merely activating more family IDs will not make arbitrary region relations render. [E05, E06, E10]

### 7.2 Proposed representation

Add **one versioned compiled PageBlueprint composition value**, owned by the existing storefront/PageBlueprint authority. It references canonical section or registered anatomy-slot identities and contains only compiler-validated selections from PageBlueprint v2: region assignment, supported order choice, registered relationship realization and four-breakpoint transformation choices.

Its exact schema is locked in AR-05 with the current domain owners. The design decision is fixed here:

- Section content is stored once. Region membership references that content; it does not copy it into another tree.
- For v2, composition is the sole ordering/relationship authority. The serialized section array has canonical storage order, not an independently editable conflicting layout order.
- For v1, existing flat order and composite semantics stay unchanged.
- A renderer consumes the compiled composition and registered realizations, not provider instructions or a search process.
- A bounded region may correspond to a registered internal anatomy slot of a commerce component. Do not create separate independent option-selection state just to split the visual layout.
- Unsupported or impossible region relations fail before acceptance. No `offsets` metadata may be silently rendered as a normal stack while claiming fidelity.

This is an extension of PageBlueprint realization, not a second page graph, new recursive HTML language or collection of per-merchant React components.

### 7.3 Renderer and Puck

Provide one shared composition rendering function over the existing registered components. Editor, proposal preview, saved preview and public serving use that implementation with different data-loading and interaction adapters.

Puck receives an appropriate controlled projection. It must not erase region assignments, responsive rules or version references when a merchant edits text or reorders an allowed region. Unsupported canvas operations are disabled with a useful explanation. Round-trip tests compare exact canonical values, not only screenshots.

Retain the generic product option and variant resolver. Layout may move gallery, purchase information and specifications; it may not duplicate option state, drop available option groups or invent an independent add-to-cart implementation.

### 7.4 Version boundary

The current root snapshot has no general `schemaVersion` discriminator. Do not assume one exists. AR-05 must choose an explicit compatible envelope/extension dispatch and preserve absent-field legacy behaviour. [E10]

BrandSystem uses an explicit Design DNA v1/v2 union. Dynamic-commerce presentation uses an explicit v1/v2 contract. Any new compiled composition has its own versioned value. Old readers must reject unsupported new authority, not partially render it.

No old snapshot is rewritten on read. An explicit upgrade generates a candidate/new draft revision and preserves original history.

## 8. Structural families and visual recipes

Retain the six accepted family identities and the intended separation of structure from merchant aesthetics. Initial execution focuses on:

**`product-first-commerce`:** useful with limited assets, strong product discovery, simple purchase hierarchy and reliable generic commerce.

**`editorial-offset`:** real asymmetric composition, approved editorial imagery, deliberate narrative rhythm and a materially different cross-page structure.

These are implementation priorities, not a promise that one family fits every merchant. Unsupported evidence requirements remain explicit. The remaining four families retain planned status until separately implemented and reviewed.

Each activated family must cover home, collection, search, product-detail, content/support and utility roles. Reusing appropriate shared support/utility anatomy is allowed; inventing six decorative checkout variants is not required. Activation still requires actual cross-page distinctiveness and four-width evidence, not merely registered IDs.

Compile visual preferences independently into BrandSystem. Both initial families must demonstrate more than one visual identity, including accessible dark treatment where supported. Do not correlate a family with one fixed palette/font tuple.

One concept is the normal mode. Later comparison accepts an explicit requested count of two or three. It must not fill missing capacity with a palette-only duplicate or silently broaden the merchant's hard constraints. Report available distinct capacity honestly.

## 9. Template compiler and final assembly

Expose a single application facade for initial generation and scoped editing. Implementation can be staged behind explicit version dispatch while legacy generation remains available for its original contract.

A template compiler consumes:

```text
exact base snapshot/template identity
+ global compiled design-contract reference
+ selected PageBlueprint/family capability references
+ validated template-specific semantic intent
+ required approved facts/assets
+ compact commerce capability context
```

It produces:

```text
versioned canonical template/page artifact
+ bounded read set and write set
+ component/profile/asset dependencies
+ exact content/topology/visual fingerprints
+ fulfilled / substituted / unsupported decisions
+ deterministic validation results
```

It is pure with respect to repositories and commerce. Renderer checks and screenshots happen outside the pure compiler.

Final assembly applies the compatible staged artifacts to the exact base snapshot, validates whole-store invariants, then calls the existing canonical proposal machinery. Assembly does not ask a model to redesign the store or reconstruct all product URLs as design pages.

“One materializer” means one implementation authority, not an eternal prohibition on scoped compilation or retrying a pure function. The guarantees are one committed result per stage revision, no hidden alternate executor, and one atomic acceptance of the assembled candidate. Historical v1 one-call/one-materialization tests retain their historical meaning.

## 10. Durable execution and concurrency

### 10.1 Operational state

The proposed `GenerationRun` records tenant/store/project identity, exact base revision, scope, idempotency key and request hash, global-contract artifact reference, stage dependencies, budget reservations, attempts, leases and safe failure details.

Run states:

```text
queued -> running -> awaiting-review
             |           |
             |           +-> completed (proposal handed off)
             +-> failed / cancelled / blocked-stale / blocked-input
```

Proposal acceptance/rejection remains owned by the existing proposal lifecycle. Do not create competing “accepted draft” state in the run record.

### 10.2 Claiming and committing work

Authorize before consuming expensive resources or claiming a project run. Use a tenant-scoped idempotency identity and reject reuse of the same key with a different payload.

A durable worker lease includes a fencing token. Stage commit atomically checks current lease/token, expected dependency revisions, cancellation state and absence of an already committed result. A slow prior worker may finish a provider request, but it cannot overwrite the winning stage.

Reserve provider budget durably before attempting a call. Record uncertain outcomes. Do not promise exactly-once external model billing after timeouts or connection failure; guarantee idempotent stage application and auditable attempts instead.

A client disconnect does not corrupt the job. An explicit cancellation prevents later commits, even when an already issued remote call cannot be cancelled. At-least-once worker execution must not become repeated proposal acceptance.

### 10.3 Host dependency

Select the datastore/queue adapter after inspecting Vesko's actual host. Reuse a suitable existing database and worker mechanism; a database-backed job table may be sufficient. Do not add Redis, Kafka or Temporal merely because the workflow has multiple steps.

A deterministic in-memory adapter supports tests, not a restart-resilience claim. A standalone durable reference adapter may be added when required for engine work, clearly distinct from a verified Vesko production adapter.

## 11. Commerce changes and stale authority

A design engine must protect commerce against its own writes without interpreting every legitimate backend update as an attack.

### Dependency classes

| Change                                                  | Required response                                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Active draft or targeted template changed               | Reject stale final acceptance; retain useful staged evidence                                                    |
| Global typography/frame/recipe changed                  | Invalidate/recompile dependent template outputs                                                                 |
| Required asset or approved policy/fact revision changed | Revalidate exact affected stages; block if no supported truthful result                                         |
| Ordinary price/stock/availability change                | Refresh runtime commerce; do not regenerate unrelated layout                                                    |
| Product gains an option group                           | Re-evaluate chosen template capabilities and render all options; use supported fallback or block unsafe serving |
| Product added, hidden, deleted or slug changed          | Reconcile route/resource lookup and visibility; no AI design call                                               |
| Component/blueprint renderer contract changed           | Require compatible version resolution or explicit migration before compile/publish                              |

The read set records the dependencies actually consumed. Whole-catalogue fingerprints can remain provenance for a particular observation; they should not universally act as acceptance locks for unrelated visual edits.

Legacy replay uses its existing strict rules. This new freshness policy is a versioned correction, not a global deletion of stale-state checks.

For the first scoped-edit release, an overlapping revision conflict fails explicitly. Automatic rebasing is deferred. Non-overlapping change-set rebasing is allowed only after a separately tested conflict policy; it is not inferred merely from different section IDs.

## 12. Routes and reusable commerce templates

### 12.1 Ownership

The current code owns navigation and stored route inventory within the storefront. The available Vesko API audit does not establish a complete canonical route service. Therefore the target is a **single resolver with an adapter boundary**, not an invented dependency on an already-existing Vesko endpoint. [E05, E10, E16]

Vesko supplies authoritative entity identity, visibility and public handle information where its actual contract supports them. Veskify owns presentation assignments and static-content route definitions. The resolver derives the concrete route index from those sources without introducing a second editable page graph.

### 12.2 Selection precedence

For new v2 commerce authority, define and test this precedence explicitly:

1. A supported explicit resource presentation assignment, only when the product specification actually enables that feature.
2. A compatible type-level presentation preference.
3. Ordered capability/complexity/context matching rules.
4. Mandatory generic safe fallback.

Every candidate is capability-checked; a preferred template cannot suppress options or essential purchase information. An incompatible explicit mandatory choice produces an explanation, not a secret fallback. Optional preferences may follow their disclosed fallback policy.

Do not reinterpret current v1 mapping semantics during a mechanical extraction. Characterize them first, preserve legacy replay, then introduce this versioned policy. The inspected v1 implementation checks known types and then resolves complexity; field names alone are not a behavioural specification. [E05]

### 12.3 Route index lifecycle

The route/resource index can legitimately grow with catalogue size. Reconciliation handles new entities, changed handles, visibility and removals independently of AI. Define atomic revision handling, collision checks and redirect/tombstone policy with the host.

For new v2 authority, remove the need to expand every dynamic route into a temporary `PageModel` during design compilation. Keep the old translator only for supported historical transformations. Static content pages remain real independently authored pages.

Representative product/collection selection is preview state. It cannot rewrite template identity or enter saved design history accidentally. Search query, filters, results and pagination remain runtime-only.

## 13. Publication and public serving

Retain the existing prepare/confirm authorization and atomic artifact/version transaction. The compiler remains provider-free and write-free. Confirmation reloads current relevant authority before moving the live pointer.

A public request resolves the active release, current route and commerce context on the server. Share rendering implementations with Studio but not its IndexedDB loading path. Preview and historical rendering remain useful and are not mislabeled public checkout evidence. [E11, E12]

Published design references exact registered versions. Deployment must retain compatible code/assets for supported published artifacts, or perform an explicit migration/publication workflow. A fingerprint alone does not preserve executable renderer code or original pixels forever.

For multi-step host publication, prepare an immutable artifact and use the existing atomic authority for active-pointer change. Any external propagation uses a host-owned recoverable delivery mechanism; no dual independent live pointers and no browser-led publish.

Rollback retains the existing restore-to-new-draft, then explicit-republish meaning. Revoked assets, missing operational facts or incompatible current commerce may legitimately prevent republishing an old design.

Veskify does not implement another checkout. Public actions connect to authorized Vesko commands. A no-op preview action must never pass as an operational purchase path.

## 14. SEO and localized content

SEO is a deterministic part of resolved page delivery, plus governed content editing—not a final unrestricted prompt.

| Concern                                                             | Owner                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Product facts, variant availability, canonical product media        | Vesko commerce                                                                      |
| Product-specific SEO content overrides                              | The explicitly authorized Vesko content workflow; not a side effect of a design run |
| Static-page titles/descriptions and presentation SEO defaults       | Accepted Veskify content/design authority                                           |
| URL resolution, redirects, canonical URLs and language alternatives | Shared public route resolver with host policy                                       |
| Structured data                                                     | Deterministic projection of the same current facts displayed on the page            |
| Sitemaps/indexability                                               | Public serving layer and authoritative route visibility                             |

The current model has localized content but a single route string in the inspected PageModel. Localized URL behaviour must therefore be specified rather than inferred. Choose one explicit locale routing policy initially; do not silently create translated slugs or break existing URLs.

Public metadata must not expose Studio URLs, draft routes or unapproved policy text. No fabricated reviews, certifications, stock, shipping promises or delivery estimates. Preview authentication protects confidentiality; `noindex` alone is not access control.

For a Next.js host, use its server metadata APIs with the same route data loader and verify streaming/bot behaviour rather than assuming every metadata tag is in the first streamed chunk. [W02]

## 15. Security boundaries

Preserve server-only provider credentials, trusted tenant/project resolution, scoped permissions and strict output schemas. Tighten operational surfaces as they are introduced:

- Tenant/store scoping is included in job, artifact, cache, snapshot and publication lookups. A browser-selected store ID is never authorization.
- Generation, draft-save, publish and commerce-command permissions remain separate.
- Protect same-origin mutation routes against the actual session model's CSRF risks; do not assume bearer and cookie sessions have identical requirements.
- Source discovery and image fetching require bounded protocols, redirects, resolved addresses, payload sizes and timeout/egress rules; source instructions remain untrusted data.
- Critic and provider output cannot issue new tools, fetch URLs, change budgets or grant itself scope.
- Generated text is rendered safely; structured data serialization must prevent script break-out. CSP and upload/content handling follow the public host's tested policy.
- A resource failure cannot trigger an unlimited model loop, candidate enumeration or browser capture loop.

These are required tests and design constraints. This review did not demonstrate an exploit or perform a penetration test.

## 16. Quality and human evidence

Retain deterministic tests and the existing conformance reporter. Its diagnostic baseline includes known gaps; do not delete its warnings to obtain a clean dashboard. Fix defects reachable by the new enabled template set and classify retained legacy-only findings explicitly. [E13]

A quality gate has four independent levels:

1. **Safety and semantics:** schema, permissions, scope, evidence, commerce, routes, version references.
2. **Rendering:** component reachability, geometry, accessible order, keyboard/focus, settled media, responsive states.
3. **Intent control:** counterfactual changes produce the intended structural/visual effect without unrelated drift.
4. **Commercial judgment:** a retailer can publish the resulting complete store without a designer rebuilding it.

Use the normal Studio pipeline for acceptance; fixtures inject ports, not a separate generation architecture. Capture after fonts/images settle, record failed capture causes separately and retain safe evidence before a process can exit.

Critic output is typed diagnosis plus bounded suggested corrections. Initial policy allows at most one correction successor within an explicitly declared budget. Every correction passes the same compiler and invalidates/rechecks affected dependents. Human review remains necessary for subjective quality, not for manufacturing screenshots or diagnosing basic broken images.

## 17. Migration and removal strategy

### Preserve first

Keep canonical v1 parsing, generic commerce, existing snapshot history, registered components still imported, versioned publication replay, protected-field tests and deterministic fixtures. Maintain a runnable v1 product path during construction of the replacement.

### Separate next

Extract contracts/metadata from React renderer bindings; split the dynamic route authority by responsibilities; isolate test/demo compositions and legacy generation entrypoints; establish template-scoped compilation and versioned composition.

### Replace then remove

Route the new normal initial-generation workflow through the new compiler/orchestrator only after same-path mocked and visual acceptance. Port retained follow-up scopes before deleting their old entrypoints. Delete obsolete active selection, expand/fold and harness code only after direct/indirect imports, dynamic routes, persisted references and test consumers are accounted for.

Not every historical reader should disappear. Compatibility code has a legitimate owner and retirement trigger. “No new v1 generation” and “cannot read old stores” are different decisions.

## 18. Refactor completion gate

The foundational refactor ends when all of the following hold:

- The architecture amendment and replacement task authority are adopted without falsifying old acceptance.
- A complete local import/route/persisted-version inventory exists for changed paths, with explicit disposition and owners.
- Pure metadata, renderer and test/legacy dependency boundaries are enforceable.
- A v2 compiled composition survives render, Puck round-trip, save and publication projection.
- Template-scoped compilation can use the existing lifecycle without full-catalogue page expansion.
- Relevant legacy acceptance/replay remains truthful and the new path has no hidden v1 fallback.
- At least one representative composed template is visibly working; foundational work is not allowed to finish as schemas only.

It does **not** require six finished families, advanced motion, full editor redesign, every legacy warning eliminated or unavailable Vesko staging. Those have named later gates. Feature work thereafter proceeds as vertical slices; each slice retires the obsolete path it replaces.

## 19. Adoption

AR-00 is a new amendment task, not a relabelled A-10C. It explicitly supersedes the future 73-child sequence, records the unchanged accepted P19A achievements, and preserves the completed A-10C closure as Baseline with A-10/P10B-19A Baseline / closed. The SDD remains normative after amendment; this document is an incorporated architecture addendum, not a rival source of truth.

Implementation begins only against the adopted delta and a pinned base. The roadmap and first Astra instructions specify the changes, tests, owners and stop rules. No merge or production-readiness claim is implied by this report.
