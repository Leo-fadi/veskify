# P10A-05C — Governed initial-generation integration

**Status:** Implemented

## Purpose

P10A-05C connects the already-governed initial-generation authority to the existing canonical
whole-storefront generation path. It adds no provider adapter, planner, PageBlueprint, proposal,
asset model, routing model or persistence path.

```text
GovernedInitialGenerationRequest
  -> immutable governed package and authority validation
  -> P10A-05A generated capability-manifest profile validation
  -> server-derived WholeStorefrontPlanningInput validation
  -> createWholeStorefrontGenerationPlan
  -> compileWholeStorefrontProposal
  -> validateWholeStorefrontProposal
```

`executeGovernedInitialGeneration` in
`src/application/design-skills/initial-generation-integration.ts` is the sole adapter. Its result is
the existing typed whole-storefront plan and proposal. It does not call a provider, change an editor
draft, write persistence, save, publish, or mutate canonical commerce or approved-asset authority.

## Canonical package execution

Only `applyRegisteredWholeStorefrontDirection` v1.1.0 accepts the `initialGeneration` execution
kind. It must be requested by its canonical ID; compatibility aliases are rejected even if they
resolve to the same descriptor. `applyExactBrandPalette`, `improveHero`, and
`addCampaignSection` remain follow-up-only.

The request preserves the governed authority envelope, approved brief ID/revision/fingerprint,
generated PageBlueprint profile references and fingerprints, catalogue fingerprint, registered
direction and `wholeStorefrontPlanningInput.v1` output-contract identity. The adapter first checks
the current authority envelope and package-registry fingerprint, then validates server-derived
planning input against the same project, draft, component registry, commerce, approved-assets,
locale, brief and catalogue authority.

Unknown packages, aliases, unsupported execution kinds, stale package versions, stale manifest or
profile references, stale request/draft/commerce/asset authority, and planning-input mismatches all
fail closed before planning or proposal compilation.

The existing `WholeStorefrontPlanningInput` deliberately has no field for a skill-owned profile
selection: its canonical recipe context chooses only its established deterministic PageBlueprint
materializations. P10A-05C therefore validates and preserves the governed profile authority without
substituting it into a new planner field or changing that existing selection behavior.

## Reused canonical execution and lifecycle

After authority validation, P10A-05C calls the existing
`createWholeStorefrontGenerationPlan` with the registered direction and the existing
`compileWholeStorefrontProposal`. The compiled proposal is immediately checked by the existing
proposal validator. Review, acceptance, undo and redo continue to use the existing whole-storefront
proposal lifecycle; P10A-05C does not implement an alternative lifecycle.

The adapter returns frozen copies of the plan, proposal and validated planning input. It creates no
provider-facing projection and no registry mutation API; commerce records, prices, stock, product or
variant identifiers, media bindings, approved asset instances, editor state, save and publish
authority are not exposed as mutable skill authority.

## Deterministic evidence

`tests/unit/p10a-05c-governed-initial-generation-integration.test.ts` proves:

- only the canonical whole-storefront package can execute initial generation;
- envelope, approved brief, generated profiles, registered direction and output contract are
  preserved;
- stale request, manifest, package, draft, catalogue, asset and profile authority fail closed;
- planning-input authority mismatches are rejected before a proposal is produced;
- the existing planner/compiler/proposal validator produce deterministic results; and
- the existing acceptance, undo and redo lifecycle preserves canonical commerce, approved assets
  and navigation while the adapter exposes no provider, persistence, editor, save or publish API.

The P10A-05B registry test additionally proves that the initial-generation execution kind is
available only on the canonical descriptor.

## Deferred work

P10A-05D remains responsible for governed follow-up proposal integration and retiring legacy
execution bypasses. P10A-06 remains responsible for strict merchant-language scope routing and
fail-closed ambiguity handling. This task does not alter prompts, provider behavior, renderer or
component implementations, PageBlueprint materialization, asset transport, SDD, or DOCX. In
particular, it has no dependency on and changes none of W3's concurrent approved-asset placement,
snapshot, Puck or renderer transport work.
