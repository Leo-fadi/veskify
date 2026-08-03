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
- parsed canonical baseline snapshot and a checked canonical content fingerprint;
- current capability-manifest version and fingerprint;
- the canonical home, collection, and product PageBlueprint materializations, including profile identity/version, narrative roles, component/variant order, bounded parameters, binding categories, asset roles, and materialization fingerprint;
- five parsed lifecycle observations: `proposal-preview`, `accepted-editor`, `preview-route`, `saved-reloaded`, and `published`;
- EN/FI responsive and accessibility evidence for every required surface and viewport;
- parsed renderer-output evidence and future screenshot references for every scenario;
- parsed canonical commerce and approved-asset projections for every lifecycle observation.

The baseline is reference evidence only; it is not a substitute for the required preview-route observation. The harness parses the complete input at its runtime boundary with the canonical snapshot, catalogue, approved-asset, locale, viewport, and PageBlueprint-materialization schemas. It recomputes snapshot, navigation, commerce, approved-asset, and renderer-output fingerprints internally; supplied snapshot metadata must agree or evaluation fails closed. The run fingerprint deliberately contains no timestamp, wall-clock duration, browser-storage value, or provider output.

## Required scenario matrix

The harness materializes this fixed matrix (160 scenarios):

| Dimension      | Values                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| Surface        | shared frame, home, collection, product                                     |
| Lifecycle      | proposal preview, accepted editor, preview route, saved/reloaded, published |
| Locale         | EN, FI                                                                      |
| Viewport width | 375, 768, 1024, 1440 px                                                     |

The matrix uses the existing canonical fixtures and projections. It does not add merchant-specific commerce entities or hidden fixture preparation. Screenshot references are nullable future evidence references; they are not canonical storefront state.

## Evidence separation

P10A-07A deliberately separates four kinds of evidence:

1. **Deterministic correctness:** parsed baseline reference, current manifest, current P10A-03 materializations, all five lifecycle observations, exact matrix coverage, and stable run fingerprint.
2. **Structural quality signals:** role cardinality, required registered components, shared-frame coherence, PageBlueprint component variants/parameters/bindings, responsive/accessibility status, and editor-preview-publish lifecycle parity. These are objective structural checks, not subjective commercial scores.
3. **Human visual evaluation:** explicit `not-reviewed` placeholder only. P10A-07A makes no claim of final screenshot-level commercial quality or a human visual approval.
4. **Future provider evidence:** explicit `not-run` placeholder only. The harness does not invoke OpenAI or any other provider.

No subjective threshold, brand-quality score, or final visual verdict is introduced in this task.

## Fail-closed validation and protected state

The harness rejects evidence when:

- baseline or any lifecycle snapshot is malformed, belongs to another project, has mismatched revision metadata, or has a stale supplied fingerprint;
- the generated component capability manifest differs from the live read-only authority;
- a PageBlueprint profile/materialization fingerprint, slot order, component, variant, narrative role, visual weight, transition intent, bounded parameter, binding category, asset role, compatibility, or cardinality diverges from the P10A-03 canonical materializer;
- a lifecycle snapshot fails the existing executable PageBlueprint realization validator, including shared-frame/header/footer coherence;
- any lifecycle/surface/locale/viewport record is absent, duplicated, unsupported, or records failed responsive/accessibility evidence;
- any proposal-preview → accepted-editor → preview-route → saved/reloaded → published canonical projection transition diverges;
- canonical commerce, approved assets, or navigation derived from parsed objects diverge.

This preserves the canonical commerce projection, navigation, media/approved-asset state, and the `StorefrontSnapshot` lifecycle. It verifies rather than mutates them.

## Existing renderer and browser evidence

P10A-07A reuses the repository’s existing deterministic lifecycle and browser-test infrastructure as its source of renderer/output and responsive evidence. Each returned scenario retains its derived renderer-output fingerprint, profile identity, evidence reference, and optional screenshot reference; renderer evidence participates in both scenario and run fingerprints. Duplicate composite evidence keys are rejected before map insertion. It neither adds screenshot CSS nor claims page-image rendering or visual-review completion.

## Deferred work

- **P10A-07B:** human visual-review procedure, reviewer evidence, and any product-owner-approved qualitative rubric.
- **P10A-07C:** real-provider evaluation evidence, with provider behavior kept outside this deterministic foundation.
- P10A-04B/C registry work, new commercial component families, new PageBlueprint profiles, skills/router work, image generation, and publish-compiler redesign remain out of scope.
- SDD and synchronized DOCX changes are intentionally not made by this bounded foundation task.
