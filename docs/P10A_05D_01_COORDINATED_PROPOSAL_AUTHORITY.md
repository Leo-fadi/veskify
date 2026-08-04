# P10A-05D-01 — Coordinated proposal authority

**Status:** Implemented shared authority boundary; governed package mapping deferred to P10A-05D-02

## Decision

The repository already has two proposal shapes with deliberately different responsibilities. The
legacy single-page `DesignProposal` remains available for page-local consumers, but it cannot
represent a coordinated multi-page transaction with one review, atomic acceptance and one
undo/redo history entry. The existing `WholeStorefrontProposal` already provides those guarantees.

P10A-05D-01 therefore evolves the input authority for the existing aggregate compiler instead of
expanding the legacy proposal or creating another aggregate proposal, compiler, coordinator,
history implementation or persistence model.

```text
existing initial-generation plan ─┐
                                  ├─> compileWholeStorefrontProposal
governed follow-up plan ──────────┘        -> WholeStorefrontProposal
                                               -> review -> atomic lifecycle -> undo/redo
```

Initial-generation callers retain their existing input and output semantics. They are the
compatibility form of the common authority. A governed follow-up plan is a new, explicit input
form to the same compiler and produces the same persisted proposal shape.

## Common coordinated plan

`CoordinatedFollowUpPlan` is versioned and fingerprinted. It carries only authority needed to
compile a deterministic proposal:

- project, draft snapshot, project/draft revision and draft fingerprint;
- normalized request identity and locale;
- generated-manifest and governed-package-registry version/fingerprint;
- component-registry, canonical-commerce and approved-asset fingerprints;
- a protected-state fingerprint, which binds navigation, canonical commerce/asset authority and
  retained component binding identities without exposing mutable commerce records;
- optional future `registeredDirectionId`; and
- one or more explicit page changes plus a deterministic merchant-review explanation.

Each page change owns exactly one page ID and page type, its executable profile ID/fingerprint,
the current page-authority fingerprint, non-empty unique slot IDs and its own operations. A page
operation cannot name another page, page/asset operations cannot be shared, and duplicate page
authority, duplicate page materialization and duplicate shared authority are rejected before
compilation. The compiler checks the profile and slots against the current canonical
materialization and checks the page authority again immediately before replay.

The plan reuses `WholeStorefrontProposalOperation`; it does not introduce an operation vocabulary.
This supports registered component/variant presentation, BrandSystem/token, bounded-parameter,
canonical binding and approved-asset operations as the existing operation schemas allow. Package
selection, parameter mapping and direction execution are deliberately not implemented here.

## Protected-state and lifecycle guarantees

The compiler reconstructs the current authoritative runtime state through the existing
whole-storefront generation plan. It then verifies the coordinated plan's target, component
registry, commerce, approved asset, protected-state and page/profile/slot fingerprints before
the proposal is built.

After replay, the compiler rejects a proposal that changes project/draft identity, canonical
commerce authority, navigation, an undeclared page, or a retained component's type, version or
canonical bindings. Approved-asset placements are accepted only when their ID and role are in the
current approved-asset context. Existing proposal validation compares the persisted proposal to a
fresh deterministic compilation, so stale authority, altered operations and incomplete proposal
projections fail closed.

The proposal remains review-before-apply. `WholeStorefrontProposalAcceptanceCoordinator` is still
the only coordinator: it accepts all operations atomically, preserves reject/close behavior, and
stores one transaction for exact undo and redo. No persistence schema or migration is required
because the emitted `WholeStorefrontProposal` shape is unchanged.

## Compatibility evidence

`tests/unit/p10a-05d-01-coordinated-proposal-authority.test.ts` covers unchanged deterministic
initial-generation compilation, one-page and multi-page governed-follow-up compilation through
the existing compiler, page/profile/slot failures, protected-state preservation, reject/close,
atomic acceptance and exact undo/redo. Existing whole-storefront proposal lifecycle and
initial-generation integration suites remain the regression coverage for persisted proposal
parsing, lifecycle semantics and canonical commerce/asset preservation.

## Deferred to P10A-05D-02

P10A-05D-02 will be the only task that maps validated `followUpEditing` package authority from
P10A-05B into this common plan. In particular, it owns execution of
`applyExactBrandPalette`, `improveHero`, `addCampaignSection` and governed
`applyRegisteredWholeStorefrontDirection`, registered-direction population, bounded parameter and
asset/component mapping, and retirement of executable legacy follow-up bypasses. P10A-06 still
owns strict merchant-language scope routing.

This task changes no provider, prompt, editor, renderer, component, route, publish, SDD or DOCX
contract.
