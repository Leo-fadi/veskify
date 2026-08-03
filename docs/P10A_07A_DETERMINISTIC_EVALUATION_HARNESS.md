# P10A-07A — Deterministic Golden-Store Evaluation Harness Foundation

## Status

Implemented as a deterministic evidence harness. It is not a final commercial visual-quality verdict, a replacement renderer, a provider evaluation, or a new fixture/storefront model.

## Purpose and boundary

P10A-07A adds a fail-closed, versioned evaluation record for the canonical `StorefrontSnapshot` lifecycle. The harness consumes the existing generated component capability manifest and the canonical PageBlueprint materializations created by whole-storefront planning. It does not construct a competing page graph, registry, renderer projection, asset model, or persisted evaluation state.

The implementation is located at `src/application/golden-store-evaluation`. Its only output is deterministic evaluation evidence suitable for unit/integration evidence and for future browser screenshots to reference. No provider is selected or called.

## Versioned evaluation contract

`GoldenStoreEvaluationInput` records:

- evaluation ID and contract version;
- canonical fixture and project identity;
- baseline snapshot ID, revision, and canonical content fingerprint;
- current capability-manifest version and fingerprint;
- the canonical home, collection, and product PageBlueprint materializations, including profile identity/version, narrative roles, component/variant order, bounded parameters, binding categories, asset roles, and materialization fingerprint;
- lifecycle evidence for `baseline`, `proposed-reviewable`, `accepted`, `saved-reloaded`, and `published`;
- EN/FI responsive and accessibility evidence for every required surface and viewport;
- optional renderer-output and future screenshot references;
- protected commerce, approved-asset, and navigation fingerprints for each lifecycle state.

The run fingerprint is a canonical-value fingerprint over the contract evidence. It deliberately contains no timestamp, wall-clock duration, browser-storage value, or provider output.

## Required scenario matrix

The harness materializes this fixed matrix (160 scenarios):

| Dimension      | Values                                                             |
| -------------- | ------------------------------------------------------------------ |
| Surface        | shared frame, home, collection, product                            |
| Lifecycle      | baseline, proposed-reviewable, accepted, saved-reloaded, published |
| Locale         | EN, FI                                                             |
| Viewport width | 375, 768, 1024, 1440 px                                            |

The matrix uses the existing canonical fixtures and projections. It does not add merchant-specific commerce entities or hidden fixture preparation. Screenshot references are nullable future evidence references; they are not canonical storefront state.

## Evidence separation

P10A-07A deliberately separates four kinds of evidence:

1. **Deterministic correctness:** current baseline revision/fingerprint, current manifest, current PageBlueprint profiles, complete matrix, and stable run fingerprint.
2. **Structural quality signals:** role cardinality, required registered components, shared-frame coherence, PageBlueprint component variants/parameters/bindings, responsive/accessibility status, and editor-preview-publish lifecycle parity. These are objective structural checks, not subjective commercial scores.
3. **Human visual evaluation:** explicit `not-reviewed` placeholder only. P10A-07A makes no claim of final screenshot-level commercial quality or a human visual approval.
4. **Future provider evidence:** explicit `not-run` placeholder only. The harness does not invoke OpenAI or any other provider.

No subjective threshold, brand-quality score, or final visual verdict is introduced in this task.

## Fail-closed validation and protected state

The harness rejects evidence when:

- the baseline snapshot ID, revision, or canonical fingerprint is stale;
- the generated component capability manifest differs from the live read-only authority;
- a PageBlueprint profile, version, role cardinality, component/variant composition, required binding category, or asset role is stale/incompatible;
- any lifecycle/surface/locale/viewport record is absent, duplicated, unsupported, or records failed responsive/accessibility evidence;
- accepted, saved/reloaded, and published canonical content or protected fingerprints lose parity;
- commerce, approved-asset, or navigation fingerprints diverge from baseline state.

This preserves the canonical commerce projection, navigation, media/approved-asset state, and the `StorefrontSnapshot` lifecycle. It verifies rather than mutates them.

## Existing renderer and browser evidence

P10A-07A reuses the repository’s existing deterministic lifecycle and browser-test infrastructure as its source of renderer/output and responsive evidence. It captures renderer-output references when supplied, and reserves screenshot references for the existing or future Playwright evidence artifacts. It neither adds screenshot CSS nor claims page-image rendering or visual-review completion.

## Deferred work

- **P10A-07B:** human visual-review procedure, reviewer evidence, and any product-owner-approved qualitative rubric.
- **P10A-07C:** real-provider evaluation evidence, with provider behavior kept outside this deterministic foundation.
- P10A-04B/C registry work, new commercial component families, new PageBlueprint profiles, skills/router work, image generation, and publish-compiler redesign remain out of scope.
- SDD and synchronized DOCX changes are intentionally not made by this bounded foundation task.
