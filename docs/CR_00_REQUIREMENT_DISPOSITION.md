# CR-00 requirement, finding and historical-work disposition

**Proposed coverage map, not new requirement definitions.** Canonical meaning remains in current SDD Appendix A: FR-101–124, NFR-101–110, AC-101–138. Every identifier is included below. Summaries are short labels only; do not replace the source text with them. “Retain” is not “implemented,” “accepted” or “currently verified.”

**Source-definition preservation.** The 72 authoritative Appendix A rows remain in
`VESKIFY_SDD.md` unchanged. This document records ownership and disposition only; it does not
waive, rewrite or complete any row. AC-120 remains historical-only, AC-126's three-direction
obligation is not discharged by two internal outputs, and URL onboarding/real production
integration remain explicit future gates.

## Postmortem finding → corrective task

| Finding                                                   | What changes                                                                              | Tasks / decisive evidence                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| F01 — Unproved design library                             | Prove designed sections and complete templates before custom generation expansion         | CR-01, CR-03–05; owner G1 on rendered home/collection/PDP                |
| F02 — Narrow live AI interface                            | Actual component-aware proposals with usable layout/field/theme vocabulary                | CR-06–08; real request-to-render trace and scoped edit                   |
| F03 — Propagation confused with provider capability       | Record component support, provider expression, rendering and acceptance separately        | CR-00, CR-06, CR-08; don't repeat already delivered regional propagation |
| F04 — Structural machinery without complete active result | Complete one visual template set and its native consumers before expanding taxonomy       | CR-03–05, CR-09–10                                                       |
| F05 — Creative choices confused with permissions          | Validate bounded refs/props while retaining server-owned permissions and commerce         | CR-02, CR-06–08                                                          |
| F06 — Representation/change coupling                      | Retain real trust boundaries; consolidate only duplicated mappings with current consumers | CR-02, CR-06–07, CR-10, CR-15                                            |
| F07 — Validity mistaken for quality                       | Separate correctness, fidelity, craft and usability; matched evidence                     | CR-01, CR-05, CR-08, CR-11, CR-14                                        |
| F08 — Fragile process-local proof path                    | Persist usable candidates early; normal editor and restart-safe review                    | CR-06, CR-10, CR-12–13                                                   |
| F09 — Excess governance/owner scheduling                  | Shared batch authority, outcome gates, resource pools and lean evidence                   | CR-00, every batch, CR-13, CR-15                                         |
| F10 — Missing reuse experiment                            | Execute comparison before another custom foundation investment                            | CR-01–02                                                                 |

## Already corrected or not established as a defect

| Prior claim                                                  | Accurate disposition                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Provider called after precomputed complete candidates        | Historical P10B-16L defect; current coordinator is provider-first. Retain that correction, do not reimplement it.                    |
| Every product necessarily has a separate editable design     | Historical defect improved by current dynamic archetypes. Verify current route/template behavior; do not reinstate an old migration. |
| No templates/components exist                                | False: older executable profiles, card anatomies and renderers exist. Their quality and new structural reachability are the issues.  |
| Every validation layer is useless                            | Unsupported: independent reconstruction/version and protected-data checks catch real defects. Consolidate only actual duplication.   |
| Whole-store AI is impossible                                 | Not established by source or these visual results. The complete-store orchestration is tested after good scoped authoring.           |
| Every Next timeout or Codex stall is a Veskify source defect | Unproven. Retain exact known symptoms and diagnose the actual stage.                                                                 |
| A fork would certainly have succeeded                        | Unproven; CR-02 supplies the missing experiment.                                                                                     |

## Functional requirements (24)

| ID     | Source meaning, abbreviated                                                   | Corrective ownership              | Disposition / limit                                                                                                  |
| ------ | ----------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| FR-101 | Product boundary: controlled engine for Storefront Studio                     | CR-00, CR-02, CR-12, CR-19        | Retain; implementation platform choice is not a change to product purpose.                                           |
| FR-102 | Design cannot own or mutate commerce                                          | CR-04, CR-07, CR-17               | Retain unchanged; applies to every branch of the platform decision.                                                  |
| FR-103 | Public storefront URL onboarding with no draft change                         | CR-16, CR-17, CR-19               | Retain; not claimed by the earlier minimal-input internal proof.                                                     |
| FR-104 | Source provenance, confidence and canonical reconciliation                    | CR-01, CR-08, CR-16, CR-17        | Retain; public/reference content remains untrusted.                                                                  |
| FR-105 | Merchant-approved Storefront Design Brief                                     | CR-01, CR-06, CR-12               | Retain; a fictional approved benchmark is not customer onboarding proof.                                             |
| FR-106 | Brand reconstruction and exact valid palette instructions                     | CR-03, CR-06, CR-08               | Retain; actual valid colors/fonts can be bounded without coarse moods.                                               |
| FR-107 | Asset IDs, role/crop/provenance and governed reuse/generation                 | CR-01, CR-08, CR-12               | Retain; no new image-generation authority implied.                                                                   |
| FR-108 | Controlled proposals, permissions and review before mutation                  | CR-06, CR-07, CR-10, CR-12        | Retain; typed allowlisted references are untrusted proposal data.                                                    |
| FR-109 | ComponentDefinitionV2 capabilities and shared lifecycle renderers             | CR-02, CR-03, CR-04, CR-05        | Retain by default; native-platform replacement requires explicit per-requirement ADR disposition before integration. |
| FR-110 | Canonical read-only commerce projection, no second catalogue                  | CR-04, CR-09, CR-17               | Retain unchanged.                                                                                                    |
| FR-111 | Reusable PDP archetypes and all canonical configuration states                | CR-04, CR-09, CR-17               | Retain; no one design page per product.                                                                              |
| FR-112 | Collection/search mapping and transient query/results                         | CR-04, CR-09, CR-17               | Retain; missing search authority cannot silently become collection output.                                           |
| FR-113 | Whole-store coordination and atomic application/undo                          | CR-10, CR-12                      | Retain; staged generation is compatible with atomic final acceptance.                                                |
| FR-114 | Responsive/accessibility across the whole journey                             | CR-03, CR-04, CR-05, CR-12, CR-14 | Retain; output and editor both covered.                                                                              |
| FR-115 | Accept/history/Save/Publish/Restore remain distinct                           | CR-07, CR-12, CR-13, CR-18        | Retain; alternate native recovery semantics require explicit approval.                                               |
| FR-116 | Merchant shell hides internals and developer tooling                          | CR-12, CR-14                      | Retain; test-runner UI is not merchant completion.                                                                   |
| FR-117 | Failure/stale/demo reliability preserves draft/history                        | CR-06, CR-07, CR-10, CR-13        | Retain; no false reclassification of old failures.                                                                   |
| FR-118 | Typed Vesko integration and handoff                                           | CR-16, CR-17, CR-18               | Retain; actual platform decision must be stable before integration, not invented endpoints.                          |
| FR-119 | Controlled meaningful variants, slots, bindings and shared rendering          | CR-03, CR-04, CR-05, CR-06        | Retain; designed quality and executable contracts both required.                                                     |
| FR-120 | PageBlueprint is the constrained composition authority                        | CR-02, CR-05, CR-09               | Retain by default; selected native equivalent needs explicit ownership/migration disposition, not a second engine.   |
| FR-121 | Registered composition and bounded parameters; no arbitrary executable output | CR-06, CR-07, CR-08               | Retain; clarify proposed refs versus executable privilege. Generated-code arm is not accepted product behavior.      |
| FR-122 | Brand/profile/family/instance inheritance                                     | CR-03, CR-05, CR-08               | Retain; independent local choices remain inside validated theme bounds.                                              |
| FR-123 | No ungrounded trust/evidence claims or false defaults                         | CR-01, CR-08, CR-09               | Retain unchanged.                                                                                                    |
| FR-124 | End-to-end reachability plus coordinated visual review                        | CR-05, CR-06, CR-12, CR-14        | Retain; no schema-only completion.                                                                                   |

## Non-functional requirements (10)

| ID      | Source meaning, abbreviated                                          | Corrective ownership              | Disposition / limit                                                                                 |
| ------- | -------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| NFR-101 | Security/protected data at every boundary                            | CR-04, CR-06, CR-07, CR-17, CR-18 | Retain unchanged.                                                                                   |
| NFR-102 | WCAG 2.2 AA expectations                                             | CR-03, CR-04, CR-12, CR-14        | Retain; automated checks alone do not certify all accessibility.                                    |
| NFR-103 | 375/768/1024/1440 responsive usability                               | CR-03, CR-04, CR-05, CR-11, CR-14 | Retain unchanged.                                                                                   |
| NFR-104 | Responsive editor interactions and visible bounded asynchronous work | CR-07, CR-10, CR-12, CR-13        | Retain; declare measured targets at implementation instead of fabricated current latency.           |
| NFR-105 | Deterministic failure/recovery preserves valid state                 | CR-07, CR-10, CR-12, CR-13, CR-18 | Retain unchanged.                                                                                   |
| NFR-106 | Safe observability without secrets/full prompts by default           | CR-06, CR-10, CR-13, CR-19        | Retain; benchmark-only approved prompt retention is explicit and access-controlled.                 |
| NFR-107 | Provider isolation and repeatable deterministic tests                | CR-02, CR-06, CR-10               | Retain; vendor-internal behavior must not be misrepresented as controllable.                        |
| NFR-108 | Deterministic correctness and customer-ready journey coverage        | CR-04, CR-07, CR-12, CR-14, CR-17 | Retain; quality evidence separately required.                                                       |
| NFR-109 | Boundaries, Puck isolation and historical context                    | CR-00, CR-02, CR-06, CR-15        | Retain until a specifically approved native-document/adapter amendment; evaluation is not adoption. |
| NFR-110 | Human commercial visual quality, not schema-only evidence            | CR-05, CR-11, CR-14               | Retain as a decisive gate, not a footnote.                                                          |

## Acceptance criteria (38)

| ID     | Source meaning, abbreviated                                                 | Corrective ownership              | Disposition / limit                                                                                                                                                         |
| ------ | --------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-101 | Public URL discovery without draft mutation                                 | CR-16, CR-17, CR-19               | Retain; later real onboarding gate.                                                                                                                                         |
| AC-102 | Source prices/stock/variants never override canonical facts                 | CR-01, CR-08, CR-17               | Retain unchanged.                                                                                                                                                           |
| AC-103 | Minimal-input brief approval                                                | CR-01, CR-12                      | Retain; complements, not replaces, URL onboarding.                                                                                                                          |
| AC-104 | Brief includes assets, gaps, plan, assumptions and commerce source          | CR-01, CR-12                      | Retain unchanged.                                                                                                                                                           |
| AC-105 | Coherent home and complete dynamic route coverage                           | CR-09, CR-10, CR-14               | Retain; staged operations must yield a complete proposal.                                                                                                                   |
| AC-106 | Simple watch selector and technical attributes                              | CR-04, CR-09                      | Retain unchanged.                                                                                                                                                           |
| AC-107 | All five/six configurable ring option groups and states                     | CR-04, CR-09, CR-17               | Retain unchanged.                                                                                                                                                           |
| AC-108 | Layout changes preserve option/variant/price/stock/SKU truth                | CR-04, CR-07, CR-08               | Retain unchanged.                                                                                                                                                           |
| AC-109 | Selected canonical variant drives price/availability/media                  | CR-04, CR-17                      | Retain unchanged.                                                                                                                                                           |
| AC-110 | Unknown product type uses generic safe archetype                            | CR-04, CR-09, CR-11               | Retain unchanged.                                                                                                                                                           |
| AC-111 | Truthful card price/compare-at/unavailable state                            | CR-04, CR-17                      | Retain unchanged.                                                                                                                                                           |
| AC-112 | Same implementations across editor/preview/published                        | CR-02, CR-05, CR-12, CR-18        | Retain; selected native renderer mapping must prove equivalence.                                                                                                            |
| AC-113 | Exact valid brand palette is supported                                      | CR-03, CR-06, CR-08               | Retain; not only named mood presets.                                                                                                                                        |
| AC-114 | Atomic whole-store restyling; transient representative context              | CR-10, CR-12                      | Retain unchanged.                                                                                                                                                           |
| AC-115 | Provider/validation/stale failure preserves draft/history                   | CR-06, CR-07, CR-10, CR-13        | Retain unchanged.                                                                                                                                                           |
| AC-116 | Atomic whole-store undo/redo                                                | CR-10, CR-12                      | Retain unchanged.                                                                                                                                                           |
| AC-117 | No irrelevant seed-brand/fixture content                                    | CR-08, CR-11, CR-14               | Retain; transfer test exposes hardcoding.                                                                                                                                   |
| AC-118 | Approved provenance and correct product media                               | CR-01, CR-04, CR-08               | Retain unchanged.                                                                                                                                                           |
| AC-119 | Missing media offers an honest supported choice                             | CR-08, CR-12                      | Retain; generated-media capability remains separately authorized/deferred, never silently invoked.                                                                          |
| AC-120 | Historical Karvonen reset/demo reliability                                  | CR-00, CR-15                      | Historical only as in the current SDD; preserve useful evidence, do not make it a new visual milestone.                                                                     |
| AC-121 | No raw internals in merchant UI                                             | CR-12, CR-14                      | Retain unchanged.                                                                                                                                                           |
| AC-122 | No clipping/overlap at all required widths                                  | CR-03, CR-04, CR-11, CR-14        | Retain unchanged.                                                                                                                                                           |
| AC-123 | Keyboard/labels for selectors, drawers and lifecycle actions                | CR-04, CR-07, CR-12, CR-18        | Retain unchanged.                                                                                                                                                           |
| AC-124 | Actual Vesko adapter passes canonical conformance                           | CR-16, CR-17, CR-18               | Retain; a standalone mock is not staging evidence.                                                                                                                          |
| AC-125 | Full onboarding → AI/manual edit → save → preview → publish → restore       | CR-12, CR-17, CR-18, CR-19        | Retain; internal proof stops short of real publication.                                                                                                                     |
| AC-126 | Retained three named direction families materially differ                   | CR-11, CR-14, CR-15               | Retain historical evidence and full original obligation. New two-design proof alone does not discharge it; report remaining coverage or obtain a specific future amendment. |
| AC-127 | Direction evidence across locales/widths/catalogue cardinalities/media gaps | CR-01, CR-04, CR-11, CR-14        | Retain; new sample coverage is not automatically the entire historical matrix.                                                                                              |
| AC-128 | Every direction retains provenance and exact commerce binding               | CR-04, CR-08, CR-11               | Retain unchanged.                                                                                                                                                           |
| AC-129 | Capability retrieval is current, registered and executable                  | CR-03, CR-04, CR-06               | Retain; derive manifests rather than hand-maintain duplicate inventories.                                                                                                   |
| AC-130 | Unknown/stale/incompatible references rejected before proposal/draft        | CR-06, CR-07, CR-10               | Retain; model-supplied IDs never become authority.                                                                                                                          |
| AC-131 | Generation and follow-up have separate governed contracts                   | CR-06, CR-07, CR-10, CR-12        | Retain; shared implementation need not mean identical scope permission.                                                                                                     |
| AC-132 | Scope cannot silently widen                                                 | CR-07, CR-10, CR-12               | Retain unchanged.                                                                                                                                                           |
| AC-133 | Blueprints compile into same canonical lifecycle state                      | CR-02, CR-05, CR-10, CR-12, CR-18 | Retain by default; any native-document migration must explicitly reconcile this requirement first.                                                                          |
| AC-134 | Functional transfer beyond jewellery and representative catalogue shapes    | CR-01, CR-04, CR-11, CR-14        | Retain; one attractive Aurum page is insufficient.                                                                                                                          |
| AC-135 | Deterministic provider-free authorized publication                          | CR-18                             | Retain unchanged.                                                                                                                                                           |
| AC-136 | Only bounded registered composition, no arbitrary code/CSS/imports          | CR-06, CR-07, CR-08               | Retain; separately evaluated code mode is not the acceptance path.                                                                                                          |
| AC-137 | Inheritance and complete applicable reachability                            | CR-03, CR-06, CR-08, CR-12, CR-14 | Retain; observable downstream consumers mandatory.                                                                                                                          |
| AC-138 | No false trust claims; coordinated real-asset/human page review             | CR-01, CR-05, CR-08, CR-14        | Retain; placeholder-only/deterministic-only/schema-only cannot close real output quality.                                                                                   |

## Original AR responsibility crosswalk

This is scheduling/ownership mapping, not automatic completion of any old task. The full retained T01–T24 acceptance set in the adopted AR source must be mapped during CR-00; no unexecuted gate is silently waived.

| Existing owner | Corrective responsibility / disposition                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-00/01       | CR-00/02 authority and current inventory; completed history remains completed, not replayed as a new phase.                                                                                        |
| AR-02/03/04    | Existing metadata, route separation and isolation are reused if the platform is retained; only demonstrated new consumer changes belong in CR-06/09/15.                                            |
| AR-05/06/07/08 | Existing composition/version work is not discarded. Prove actual selected renderer/template/lifecycle consumer in CR-04–07/09/10/12; unresolved dynamic/history/publication gates remain explicit. |
| AR-09–15       | Theme, designed sections, real page templates and complete store coverage in CR-03–05/08/09/11. No mandatory six-family campaign is introduced.                                                    |
| AR-16/18–21    | Agent/scoped orchestration, usable lifecycle, capture and recovery in CR-06–08/10/12/13. No unconsumed stage-contract programme.                                                                   |
| AR-22          | Internal complete quality proof CR-11/14. Only its actually exercised obligations can close.                                                                                                       |
| AR-17/23–28    | Host contracts, durable integrated operation, public rendering and pilot CR-16–19. Deferred, not quietly removed.                                                                                  |
| AR-29/30       | Evidence-based retirement CR-15 plus later host retirement when real integration permits it.                                                                                                       |

## Master handoff and old audit treatment

The supplied Master Handoff is preserved with its PR #233/as-of identity. Its product goal, capability requirements and safety constraints remain useful. Its old exact-next, six-family default, 73-child lock and prospective implementation claims are not current schedule authority.

The older P10B-16L audit remains dated evidence. Its recommendation to correct provider ordering and route-instance design was acted on; its current-tense defect claims must not overwrite the newer source. The 19 October postmortem is a reviewed finding source, not execution authority.

## Adoption verification

CR-00 compares all source Appendix A rows before/after, lists every actual meaning change and preserves the original IDs. Update current owner and evidence links without marking future tasks done. A later foundation/native-document change must explicitly resolve FR-109/120, NFR-109 and AC-112/133/136/137 (and any other affected row discovered), rather than claiming compatible ownership by assertion.

## Full retained T01–T24 crosswalk

The exact gate definitions and forbidden substitutions remain in
`AR_00_SOURCE_DISPOSITION_AND_ACCEPTANCE.md` §5. CR ownership below is a forward responsibility
map, not an execution or completion claim.

| Gate | CR owners               | Remaining required observation                                        |
| ---- | ----------------------- | --------------------------------------------------------------------- |
| T01  | CR-00/02/15             | Legacy canonical replay across any foundation or retirement decision. |
| T02  | CR-02/05/06/07/09/10/12 | Composition integrity rejects ignored topology/parallel trees.        |
| T03  | CR-03/04/05/11/14       | Four-width composition and accessible order.                          |
| T04  | CR-02/07/12             | Puck/native round trip and unknown-version rejection.                 |
| T05  | CR-06/10                | Template-scale invariance.                                            |
| T06  | CR-09/17                | Route lifecycle follows canonical sync.                               |
| T07  | CR-04/09/17             | Commerce freshness without design write.                              |
| T08  | CR-07/12                | Scoped edit preserves locks.                                          |
| T09  | CR-07/10/12             | Stale acceptance preserves prior draft/history.                       |
| T10  | CR-13/18                | Worker restart/fencing.                                               |
| T11  | CR-06/13/18             | Idempotency and provider budget.                                      |
| T12  | CR-13/18                | Cancellation fencing.                                                 |
| T13  | CR-06/13/17/18          | Tenant/artifact/cache/publication isolation.                          |
| T14  | CR-03/05/11/14          | Counterfactual visual control.                                        |
| T15  | CR-04/09/11/14          | Complete enabled family.                                              |
| T16  | CR-12                   | Normal Studio path.                                                   |
| T17  | CR-18                   | Publication atomicity.                                                |
| T18  | CR-17/18                | Fresh public session.                                                 |
| T19  | CR-18                   | SEO agreement.                                                        |
| T20  | CR-11/14                | Critic bounds.                                                        |
| T21  | CR-15                   | Safe removal.                                                         |
| T22  | CR-14                   | Commercial acceptance.                                                |
| T23  | CR-01/04/09/14          | Empty/sparse/unknown truthfulness.                                    |
| T24  | CR-13/18                | Host restart/release compatibility.                                   |

F01–F10 remain mapped above without creating defects that source does not establish: F03 does not
reopen the fixed provider-before-materialization boundary, F05 does not make references authority,
and F10 requires a working comparison. The original AR crosswalk is responsibility only; accepted
work is neither reopened nor silently used to close an unexecuted parent.
