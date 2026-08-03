# P10A W2 — Integration and commercial-quality evidence foundation

This record prepares deterministic acceptance infrastructure for P10A Tasks 6–9. It implements
no Task 6 narrative schema, commercial family, executable `PageBlueprint` profile, planner change,
OpenAI provider call, live generation request, protected-project mutation, acceptance action, save
action or publish action. Focused tests exercise the existing in-memory deterministic provider seam
only.

The authority remains the binding SDD: §§2, 2.1, 18.1–18.3; FR-102, FR-105, FR-108 through
FR-115, FR-119 through FR-124; and AC-112, AC-118, AC-122 through AC-123, AC-127 through AC-128,
and AC-134 through AC-138. The evidence layer is test-only and derives its projections from the
existing `StorefrontSnapshot`, canonical commerce projection and approved asset context. It creates
no competing proposal, `PageBlueprint`, recipe, registry, asset inventory, page graph or publish
model.

## Acceptance infrastructure inventory

| Area                     | Reusable infrastructure                                                             | Constraint or gap carried into P10A                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Proposal/lifecycle       | `p9-05a-generation-harness`, proposal lifecycle, save/preview/publish tests         | Existing P9R-04 assertions are Lumo-specific and are not a reusable commercial-quality contract.                       |
| Structural composition   | `p9r-04-generation-acceptance` and `design-diversity-evaluator`                     | They prove named legacy section selections/difference, not an independent screenshot-level commercial review.          |
| Protected commerce       | Catalogue fingerprinting, compiler guards and P9/P9R preservation tests             | No small reusable projection collected routes, media bindings, option values and collection order together.            |
| Assets/provenance        | Approved generation context and asset-placement validators                          | Existing checks are placed inside individual workflow tests rather than a portable evidence assertion.                 |
| Rendering                | Registered snapshot validation, editor, preview, published and commerce route tests | No page-family-neutral three-surface projection parity helper existed.                                                 |
| Responsive/accessibility | Geometry helper and P9R browser EN/FI matrix                                        | The browser test has correct geometry probes but its exact Lumo selectors/layout are not reusable for future families. |
| Evidence artifacts       | `PHASE_9_EVIDENCE_MATRIX.md`, P9R deterministic and execution-fidelity records      | Deterministic correctness must remain distinct from retained manual commercial visual review.                          |
| CI                       | Vitest already serializes test files; browser configs had implicit workers          | Shared in-memory demo/browser authority could be exercised concurrently, yielding timeout-shaped failures.             |

The W2 helper deliberately records only objective structural deltas. A structural change is not a
visual-quality pass. Screenshot references and criterion-level human review stay separate.

## Deterministic evidence contract

`tests/helpers/phase-10a-evidence.ts` is the reusable contract for Tasks 7–9.

| Evidence record                     | Deterministic content                                                                                                                                                                  | Explicit boundary                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GenerationAuthorityEvidence`       | planner/provider identity, registered recipe/profile IDs, component family/variant sequence and bounded prop projection                                                                | Profile IDs may be `null` until Task 8; this does not introduce a recipe model.               |
| `ProposalSnapshotIntegrityEvidence` | proposal/operation fingerprints and exact proposed-projection-to-accepted-snapshot parity                                                                                              | The proposal remains transient; only the accepted `StorefrontSnapshot` is canonical.          |
| `ProtectedCommerceProjection`       | complete canonical `ProductDisplayModel` values: product/variant identity, SKU, localized labels, attributes, prices, availability, stock, media, options, collection order and routes | Captures the read-only input; it does not create editable commerce copies.                    |
| `ApprovedAssetProjection`           | approved brief ID/revision/evidence fingerprint, asset-context fingerprint, approved assets, approval actor, provenance, presentation and placement bindings                           | Consumes the canonical full approved-generation context; it does not approve or place assets. |
| `RendererParityEvidence`            | canonical storefront fingerprint plus catalogue ref, navigation, BrandSystem, complete page content/order and registered component projection                                          | This is structural renderer parity, not a screenshot similarity claim.                        |
| `BaselineStructuralDelta`           | deterministic page-family component sequences before/after                                                                                                                             | It reports deltas only and makes no quality judgement.                                        |
| `ViewportPageFamilyEvidence`        | lifecycle state, page family, EN/FI, 375/768/1024/1440, distinct renderer target, overflow and basic accessibility result                                                              | Browser/visual tests supply observations; the helper does not invent layout assertions.       |
| `CommercialQualityEvidence`         | criterion-level retained review record, screenshots, discovery/purchase/media observations and optional future metadata                                                                | No opaque visual-pass boolean; each criterion is `not-reviewed`, `passed` or `failed`.        |
| `PublishWithoutProviderEvidence`    | provider calls before/after and published snapshot fingerprint                                                                                                                         | Represents AC-135 evidence without invoking a provider at publish time.                       |

Future Task 6 fields (`narrativeSequence`, visual weight and surface-transition sequences) are
optional. W2 does not define narrative-role enums or require a fixture to contain them.

## Golden storefront matrix

Every later golden-store run records the following matrix. Deterministic assertions and manual
commercial visual review are intentionally different columns.

The mandatory page-evidence matrix has exactly **120 records**:
`proposal-preview`, `accepted-editor`, `saved-reloaded`, `preview`, `published` × homepage,
collection, PDP × 375/768/1024/1440 × EN/FI. Renderer target remains a distinct observation
(`editor`, `preview` or `published`) and is not multiplied into this lifecycle completeness count.
The deterministic assertion rejects missing combinations, duplicates and unsupported lifecycle
states, reporting every missing key.

| Surface/state         | Page families                       | Locale | Viewports            | Deterministic assertions                                                          | Commercial-review evidence                                        |
| --------------------- | ----------------------------------- | ------ | -------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Proposal preview      | Home, collection, PDP, shared frame | EN, FI | 375, 768, 1024, 1440 | Schema, proposal/snapshot preconditions, protected commerce, approved assets      | Screenshot reference; criterion-level review only.                |
| Accepted editor state | Home, collection, PDP, shared frame | EN, FI | 375, 768, 1024, 1440 | Proposal/snapshot parity, renderer projection, basic keyboard/labels, no overflow | Screenshot reference; mobile and composition review.              |
| Saved/reloaded draft  | Home, collection, PDP, shared frame | EN, FI | 375, 768, 1024, 1440 | Snapshot fingerprint and route/component projection parity                        | Screenshot reference when a changed surface is reviewed.          |
| Preview route         | Home, collection, PDP, shared frame | EN, FI | 375, 768, 1024, 1440 | Renderer parity, routes, no overflow, basic accessibility                         | Screenshot reference; hierarchy/coherence/media review.           |
| Published route       | Home, collection, PDP, shared frame | EN, FI | 375, 768, 1024, 1440 | Renderer parity, no provider call, protected commerce/assets                      | Screenshot reference; purchase clarity and mobile quality review. |

Assertion classification:

- Schema/contract: registered selections, bounded props, proposal operations and fingerprints.
- Commerce preservation: product/variant IDs, SKUs, prices, stock, options, collection order,
  media and routes.
- Renderer parity: editor, preview and published projections derive from the same canonical state,
  including navigation, shared header/footer page content and BrandSystem.
- Structural quality: component family/variant/order/region deltas and responsive overflow.
- Commercial visual review: hierarchy, coherence, repetition, spacing rhythm, surface transitions,
  media, discovery, PDP purchase clarity and mobile quality; each is retained individually rather
  than collapsed into an opaque result.

## CI stability correction

Vitest remains serial (`fileParallelism: false`). Both Playwright configurations now use one worker
and disable full parallelism because their deterministic demo authority and retained browser evidence
are run-scoped. Timeouts and assertions are unchanged, failures remain failures, and Playwright
trace artifacts remain enabled on first retry.

## Focused helper coverage

`tests/unit/phase-10a-evidence.test.ts` proves that:

- protected-commerce, collection-order, route, variant label, variant attributes, SKU, stock and
  media-binding mutations are detected;
- approved asset/provenance and approved-brief/asset-context identity mutations are detected;
- proposal-to-accepted-snapshot parity works;
- editor/preview/published projections are exact and reject navigation, shared-header and
  BrandSystem drift;
- baseline structural deltas are deterministic;
- the complete 120-record lifecycle × EN/FI × 375/768/1024/1440 × home/collection/PDP matrix is
  required, including proposal-preview and saved-reloaded states;
- Finnish editor metadata survives and absent future narrative metadata is valid;
- publication evidence represents zero provider calls;
- current Phase 9 deterministic fixtures remain compatible.
