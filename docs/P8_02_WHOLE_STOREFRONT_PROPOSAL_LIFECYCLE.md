# P8-02 — Whole-storefront plan proposal lifecycle

`docs/VESKIFY_SDD.md` remains the authoritative product and architecture baseline. This document records the P8-02 implementation that turns one validated P8-01 whole-storefront plan into a deterministic, reviewable proposal without creating merchant-facing UI, provider calls, publishing changes, catalogue mutations, or media storage.

## Compiler boundary

`src/application/whole-storefront-proposal-lifecycle` accepts exactly:

- a validated `WholeStorefrontGenerationPlan`;
- the current P8-01 planning input: approved brief, project, active draft, canonical commerce projection, `ComponentDefinitionV2` registry, approved-asset context and required placements.

The compiler reconstructs the current plan before compiling. It records the plan fingerprint, brief revision and evidence fingerprint, project revision, active-draft fingerprint, registry fingerprint, canonical-commerce fingerprint and approved-asset-context fingerprint as proposal preconditions. A change to any of these values blocks review or acceptance with a typed stale failure.

The resulting proposal contains a complete V2 runtime graph rather than arbitrary HTML, React, CSS or executable content. The graph keeps the active BrandSystem and navigation as retained values, preserves page and retained-component identities, and represents generated or replacement components as validated `ComponentInstanceV2` values.

## Operation mapping

Every compiled proposal has contiguous, canonical operation identities and is replayed from its original runtime storefront:

| Plan material | Replayable proposal operation |
|---|---|
| Current BrandSystem | `RETAIN_BRAND_SYSTEM` |
| Current navigation/shared chrome | `RETAIN_NAVIGATION` |
| Retained, added and replacement component graphs per page | `APPLY_PAGE_COMPONENTS` |
| Removed replacement targets | `removedComponentIds` on the corresponding page operation and normalized review summary |
| Approved P7-05 source asset placement | `PLACE_APPROVED_SOURCE_ASSET` |

The compiler does not infer a token patch from descriptive brand direction. P8-01 records a shared direction and current BrandSystem fingerprint, but not a concrete colour or typography payload. Inventing one would violate the structured-operation boundary; the existing explicit global colour/typography proposal operations remain the only way to change those fields.

Invalid or incomplete plan material, invalid page/component targets, unrepresented navigation changes, duplicate operation identities, protected-commerce mutation attempts and invalid asset targets fail safely. A proposal cannot be accepted unless replay reproduces its declared proposed storefront exactly.

## Protected commerce and assets

The runtime graph stores only canonical IDs and revision-bound presentation bindings. It does not copy or mutate SKU, price, compare-at-price, availability, variants, collection membership or canonical product media into editable component content. Approved source assets retain the P7-05 asset ID, role, slot, component/page identity, revision, material fingerprint and provenance reference. A placement may only target a component that exists after replacements; removed targets are rejected.

## Review and lifecycle

The normalized review summary deterministically lists shared design-system direction, page status, component additions/replacements/removals, retained navigation, canonical bindings, approved source-asset placements, protected facts, warnings and merchant-review items.

`WholeStorefrontProposalAcceptanceCoordinator` provides the same explicit lifecycle states as the existing storefront proposal path: ready, accepted, rejected, closed, stale and failed. Acceptance validates current preconditions, replays all operations into one complete runtime graph, verifies the exact reviewed projection, and records one history transaction. A stale or failed acceptance leaves active, stored and published runtime state unchanged. Reject and Close are non-mutating. Undo restores the exact original graph; Redo restores the exact accepted graph.

## Non-goals

- Merchant-facing proposal controls or editor wiring.
- AI provider calls or provider response handling.
- Storefront route/renderer changes or persistence adapter changes.
- Publishing, media download/storage, cart/checkout, or catalogue mutation.
- Inferring unsupported global colour or typography mutations from descriptive brief text.

P8-02 is deliberately a contract and lifecycle adapter for the V2 component graph. Rendering and persistence adapters must consume this validated graph rather than flattening its bindings, assets or operation provenance into legacy section fields.
