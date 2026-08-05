# P10A-06 — Strict Scope Router

`routeGovernedDesignRequest` in `src/application/design-skills/strict-scope-router.ts` is the single application-level P10A-06 entry point. It accepts `unknown`, clones and parses it inside a typed failure boundary, normalizes the merchant instruction deterministically, and returns a frozen routing result. It does not persist, accept, publish, create a proposal authority, create a planner, or call a provider.

## Canonical outcomes

The router returns one of four outcomes:

- `initialGeneration` for an explicit request to create a new governed storefront proposal.
- `followUpEditing` for an authorized palette, hero, campaign insertion, or registered whole-storefront direction request.
- `clarificationRequired` when the request is ambiguous, contradictory, missing exact authority, or would require a wider scope.
- `unsupported` for malformed, stale, unsupported, commerce-mutating, publishing, or downstream-rejected requests.

Clarification and unsupported outcomes carry deterministic reason codes and structured clarification fields. The router does not invent a merchant-facing free-form question.

## Narrowest-scope routing

The request declares one of `designSystem`, `exactSlot`, `pageInsertion`, or `completeStorefront`. The declaration must exactly match the canonical package and its page and slot authority:

- `applyExactBrandPalette` is design-system-only and cannot acquire page or slot authority.
- `improveHero` is one exact current home or landing hero slot with an explicit executable profile.
- `addCampaignSection` is one explicitly authorized page insertion; its optional profile remains resolved by P10A-05D-02 from current materialization.
- `applyRegisteredWholeStorefrontDirection` is complete-storefront-only and may affect only declared current pages.

Array references are canonicalized in sorted order. Duplicate references, missing ownership, ambiguous hero selection, page expansion, slot-to-page widening, or page-to-storefront widening fail closed.

## Package and authority resolution

The router owns no package inventory. It resolves only through the P10A-05B `GovernedSkillPackageRegistry`:

- `applyExactBrandPalette`
- `improveHero`
- `addCampaignSection`
- `applyRegisteredWholeStorefrontDirection`

Deprecated aliases are accepted only when the registry resolves them and they retain the same scope. A deprecated whole-storefront alias never supplies registered direction authority. Current project, draft, locale, request identity, capability manifest, and package registry authority are checked through the existing P10A-05B validators before dispatch.

## Deterministic language rules

The router recognizes only explicit normalized phrases for creation, exact palette, hero improvement, campaign insertion, and registered direction. It does not use a model, embeddings, fuzzy matching, prompts, network calls, or providers. A request that combines recognized package intents, structural and palette/hero requests, or initial and follow-up authority requires clarification.

Commerce truth mutations (including prices, stock, SKU/variants, collection membership/order, and product-media truth), checkout/payment/order/authentication changes, arbitrary code, unsupported components, and publishing intent are unsupported at this boundary.

## Dispatch and proposal lifecycle

Dispatch is opt-in. When requested, the router calls only:

- P10A-05C `executeGovernedInitialGeneration` for initial generation.
- P10A-05D-02 `executeGovernedFollowUpEditing` for follow-up editing.

Those adapters retain ownership of planning, current materialization validation, coordinated proposal compilation, and the existing whole-storefront proposal lifecycle. Any downstream rejection is returned as a typed deterministic router outcome; no partial proposal is retained by the router.

## Deferred to P10A-07C

P10A-06 defines and validates routing only. Controlled live acceptance, merchant-facing clarification UX, persistence, proposal acceptance, save/publish actions, and runtime granular-editing exposure remain deferred to P10A-07C and later governed lifecycle work.
