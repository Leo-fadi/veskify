# P9R-08 whole-store structural execution fidelity

**Date:** 2 August 2026

**Branch:** `codex/p9r-08-final-whole-store-structural-acceptance`

**Status:** Deterministic execution-fidelity correction prepared; final reviewed-head live retest
requires separate approval

## Scope and provider-call record

P9R-08 corrects the Phase 9 boundary between a provider-selected registered whole-store direction
and the executable storefront proposal. The OpenAI contract accepts only the strict
`requestFingerprint` and registered `selectionId`. Components, variants, props, recipes and page
graphs remain server-owned and extra provider structural fields fail strict response validation.

Two controlled OpenAI calls were used before this correction:

1. The first proposal was rejected before Accept because its collection composition did not satisfy
   the live structural gate.
2. The second proposal was invalidated during review. It was not accepted, saved or published.

No additional provider call is authorized by this implementation task. No API key, token, session
identifier, authorization header, raw provider payload or unrelated merchant data is retained.

## Execution-fidelity correction

The registered direction now materializes its shared-frame, homepage, collection and PDP execution
projection once in the canonical proposal compiler. The compiler applies the exact registered page
recipes, component families, variants, order and typed presentation props. Runtime authority maps
that compiled projection to canonical `PageModel` sections and approved asset presentations without
independently reapplying variants, injecting alternate props or recalculating recipe order.

The same resulting `StorefrontSnapshot` remains the source for proposal preview, accepted editor
state, save/reload, preview and published rendering. The editor collection canvas uses the same
registered dynamic collection renderer and canonical commerce-route projection as preview and
published routes.

## Objective Phase 9 structural contract

The modern-technical direction retains the merged-main registered contract:

- shared header and footer use the registered `compact` variants;
- `homeModernCommerce` uses the asymmetric hero and its registered family order;
- the legacy collection header, filter and product-grid composition is replaced by
  `dynamicCollectionCommerce:compact` with compact cards/density and sidebar filters;
- the legacy product gallery, information and options composition is replaced by
  `dynamicProductDetail:compact` with thumbnails, compact options, table attributes and contained
  media.

The deterministic gate compares these canonical structural facts rather than proposal metadata,
serialized size or subjective screenshot quality. Products, variants, SKUs, prices, stock,
availability, options/dependencies, collection membership/order, navigation, routes, canonical
media/bindings, approved asset authority and provenance remain protected.

## Proposal and lifecycle stability

Normal storefront-page dropdown navigation is read-only while reviewing a whole-store proposal. It
preserves proposal identity, review contents and acceptance readiness while previewing homepage,
collection and PDP, and it does not emit a false language-change failure. Locale is captured in the
request authority; a real locale change invalidates the ready proposal immediately and clearly.

Focused lifecycle proof covers Review, Accept, editability, Undo, Redo, Save, Reload, Preview and
Publish. Publish consumes the accepted saved `StorefrontSnapshot` and does not invoke a provider.

## P10A deferral

This correction does not claim commercially final composition. Executable commercial
`PageBlueprint` depth, narrative roles and flow, adjacency/transition rules, expanded component
families and variants, bounded parameter inheritance improvements, and screenshot-level commercial
quality remain assigned to P10A Tasks 6–9. P9R-08 introduces no parallel blueprint, planner,
renderer or publish model.

The separate “Open a proposed page” shortcut defect is not repaired by P9R-08; normal storefront
page selection remains the acceptance path.
