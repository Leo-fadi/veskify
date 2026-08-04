# P10A-05D-02 — Governed Follow-Up Package Integration

## Purpose

P10A-05D-02 connects the P10A-05B `followUpEditing` authority envelope to the
P10A-05D-01 coordinated proposal path. The application entry point is
`executeGovernedFollowUpEditing` in
`src/application/design-skills/follow-up-editing-integration.ts`.

The entry point accepts untrusted `unknown` input, clones and parses it inside
a typed failure boundary, validates it through the existing governed package
registry and P10A-05A capability consumer, then compiles the existing
`WholeStorefrontProposal`. It has no provider, router, persistence, acceptance,
save, publish, or editor side effect.

```text
governed follow-up request
  -> P10A-05B package and envelope validation
  -> P10A-05A manifest/profile/slot capability resolution
  -> P10A-05D-01 CoordinatedFollowUpPlan
  -> existing WholeStorefrontProposal compiler
  -> existing review, atomic acceptance, reject/close, undo and redo lifecycle
```

No new planner, proposal type, acceptance coordinator, history system,
manifest, PageBlueprint registry, or component registry is introduced.

## Canonical package scopes

Only these P10A-05B packages are executable by this entry point:

| Package                                   | Governed result                                                                                                                                                                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applyExactBrandPalette`                  | One validated registered BrandSystem token-refinement operation. It carries no page authority and cannot change components, bindings, navigation, assets, product media, or commerce.                                                                                                                   |
| `improveHero`                             | One explicit homepage or landing-page canonical hero slot. The selected registered component, variant, profile and current component version are checked before one page operation is compiled.                                                                                                         |
| `addCampaignSection`                      | One profile-defined `promotion` slot. It inserts only the registered `homepagePromotion` component at the PageBlueprint-defined position before the next materialized slot, using the component registry definition and defaults. It fails when that legal slot is unavailable or already materialized. |
| `applyRegisteredWholeStorefrontDirection` | One or more explicit page authorities plus one current registered direction identifier. Each declared page is independently validated and mapped into the existing coordinated aggregate plan.                                                                                                          |

Deprecated compatibility aliases remain governed by P10A-05B. A deprecated
alias can never execute the registered whole-storefront direction path, so it
cannot acquire wider authority.

## Authority and protected state

Before compilation, the integration confirms the current project, draft,
snapshot, component registry, commerce, approved-asset context, locale,
request identity, package registry, manifest, profile, page and slot authority.
It confirms that the selected runtime component has the current registered
definition version. Binding references must match the exact current canonical
binding fingerprint. Approved assets are checked against current ID, role,
revision and material fingerprint; P10A-05B additionally enforces registered
slot compatibility, cardinality and required/optional status.

The compiler and lifecycle preserve protected product and variant identifiers,
SKUs, prices, stock, options, collection membership and ordering,
merchandising order, routes, navigation destinations, commerce media, approved
asset provenance and all protected commerce relationships. Invalid authority is
rejected before planning or compilation with a deterministic typed failure.

## Lifecycle and determinism

The result is the existing reviewable `WholeStorefrontProposal`. The existing
`WholeStorefrontProposalAcceptanceCoordinator` remains solely responsible for
atomic Accept, Reject, Close, Undo and Redo. A stale or duplicate acceptance is
rejected by that coordinator. The adapter returns frozen canonical values and
uses canonical package normalization, so identical authority and planning input
produce identical coordinated plans, operation order, review summary and output
fingerprint.

## Deferred to P10A-06

P10A-05D-02 does not classify merchant natural language, select package scope,
interpret instructions, call a provider, change prompts, persist a proposal,
or publish. Those routing and classification responsibilities remain owned by
P10A-06. P10A-07C remains responsible for controlled real-provider acceptance,
and P10A-08 remains responsible for publishing integration.
