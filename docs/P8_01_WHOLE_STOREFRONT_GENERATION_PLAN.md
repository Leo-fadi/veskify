# P8-01 — Approved-brief whole-storefront generation plan

## Purpose and preconditions

P8-01 defines a provider-independent, planning-only boundary for a complete storefront. It accepts a current approved `StorefrontDesignBrief`, the canonical project and draft snapshot, the canonical Vesko catalogue projection, the current `ComponentDefinitionV2` registry, and the P7-05 approved source-asset context.

Planning requires an approved, current brief with its approved evidence fingerprint, matching canonical commerce reference, supported project locales, and (where assets are requested) an asset context matching the same brief revision, evidence fingerprint and asset-review fingerprint. It does not mutate the draft, history, published snapshot or catalogue.

## Target context

The normalized target contains only the canonical information necessary to plan safely:

- project and draft identifiers and revisions, plus an active-draft fingerprint;
- supported locales;
- page IDs, roles, types, visible section IDs and component types;
- normalized navigation structure;
- canonical product IDs, collection IDs and collection membership;
- registered component versions and registry fingerprint;
- BrandSystem and commerce-projection fingerprints; and
- the approved asset-context fingerprint, when present.

It intentionally excludes raw provider payloads, arbitrary HTML, and executable code.

## Plan contract and consistency

`WholeStorefrontGenerationPlan` is strict and serializable. It records the plan and request fingerprints, target, approved brief/evidence/asset identities, registry fingerprint, language plan, shared design direction, shared chrome, page plans, canonical bindings, approved asset placements, review items and normalized review summary.

The shared direction expresses colours, typography, imagery direction, tone and durable rules for spacing, radius, surfaces, header, footer, navigation, buttons, headings, trust messaging and language usage once. Homepage, collection-template and product-template page plans reference that shared direction rather than creating independent visual systems.

Existing sections are represented by identity and a `preservesExistingContent` compatibility marker. Their current data is validated internally against the registry but is not re-emitted as new plan content. New or replacement components carry strict registry-validated content, props, style overrides and bindings. This preserves existing page IDs and unsupported/hidden content without silently replacing a page tree.

When an approved collection or product page family is absent from a newly initialized target, the planner adds one typed reusable template page plan (`page_collection_template` or `page_product_template`). Existing page IDs are retained; no existing page is silently removed or replaced.

## Canonical commerce bindings

Commerce is read-only. The planner creates structured `product`, `productList`, `collection` and `collectionList` bindings only for IDs in the canonical Vesko projection. Product identity, SKU, price, availability, variants, product media and collection membership are not copied into merchant-editable generated content.

The collection and product template plans use the existing dynamic commerce components. They support reusable collection and product templates rather than product-type-specific contracts. Unknown bindings, unsupported pages, unknown components, incompatible versions and invalid component data fail before review handoff.

## Approved asset placements

Only the P7-05 approved generation asset context may supply source assets. Each placement must reference a current approved asset revision and material fingerprint, a planned page and component, and a compatible registered asset slot. Non-decorative assets retain validated localized alternative text from the approved context.

Public-source assets cannot replace canonical product main or alternative media. Required placements cannot be accepted when the context is absent, stale, rejected, unavailable or incompatible.

## Determinism and stale-result protection

The planner normalizes pages, sections, definitions, locales, bindings, placements, warnings and review items before fingerprinting. Identical approved inputs therefore produce identical target, request and plan fingerprints.

`validateWholeStorefrontGenerationPlan` accepts only the exact structured plan allowed by the current deterministic request. `acceptWholeStorefrontPlanningResult` rechecks the request fingerprint after an asynchronous result resolves; if a brief, draft, registry, catalogue, asset context or locale input changed, the result fails as stale and cannot become reviewable.

## Review handoff

The normalized review summary exposes shared design-system direction, retained/replacement component identities, page dispositions, canonical bindings, approved asset placements, warnings, required merchant-review items and the protected commerce facts that remain unchanged. A later proposal or UI workflow may render this summary, but P8-01 does not create UI or apply a plan.

## Explicit non-goals

P8-01 does not apply plans, accept proposals, change editor state, publish, alter catalogue data, create merchant-facing React UI, download or store media, call a live provider, make network calls, or modify storefront renderers, routes or seed data.
