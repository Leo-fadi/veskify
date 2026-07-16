# P1-04 Aurum Nordic Cart Page Renderer — Implementation Plan

## Status and sequencing

Isolated implementation started from `origin/main` at `d9ce8e1` after PR #14 on `codex/p1-04-cart-renderer`. PR #12 (`codex/p1-03-product-renderer`) remains untouched and unmerged. This slice contains only the cart definition, storefront sections, styling, focused tests, and this plan; shared integration must wait until PR #12 merges.

P1-04 is the next unimplemented Phase 1 task after the product renderer. It delivers the responsive, bilingual, read-only dummy cart page. Checkout remains a later Phase 1 slice.

## Specification baseline

- SDD §1.2–§2.1: storefront transaction UI is a design surface only; no commerce configuration or arbitrary code.
- SDD §6.2: FR-011, FR-013–FR-017, FR-019 and FR-020.
- SDD §6.5: FR-041–FR-043 and FR-049–FR-050 for draft/published separation and safe preview behavior.
- SDD §8.2–§8.5 and §9.1–§9.5: inherited BrandSystem, controlled registry, approved variants and responsive rules.
- SDD §10.4: dummy cart values, storefront token inheritance, and no payment/logistics/tax/shipping configuration.
- SDD §14, §15.3–§15.7 and §16.2/§16.5–§16.7: bilingual canonical snapshot data, protected commerce values, repository loading and registry-derived Puck configuration.
- SDD §18–§21 and Appendix C/D: accessibility, schema validation, testing, protected operational content and the `header`, `cartPage`, `benefitIcons`, `footer` cart composition.
- Acceptance criteria: AC-007, AC-008, AC-013, AC-015–AC-018.
- Non-functional requirements: NFR-001, NFR-003–NFR-006 and NFR-008–NFR-010.

## Proposed user-visible scope

- Route: `/projects/[projectId]/cart`; seeded route: `/projects/project_aurum_nordic/cart`.
- Exact visible composition: `header`, `cartPage`, `benefitIcons`, `footer`.
- `cartPage` initial approved variant: `split`.
- Dummy line items reference canonical catalogue product IDs; product records, images and prices are resolved from validated catalogue data rather than duplicated.
- Dummy quantity and summary presentation is schema-validated and protected from design edits. Subtotals are derived from read-only dummy prices.
- Checkout CTA, quantity buttons, remove controls, search and cart controls are visual only and perform no transaction, catalogue mutation or operational configuration.
- English/Finnish presentation, primary-locale fallback, empty cart, loading, missing project/draft/page, storage failure and validation failure states.
- No cart drawer state machine, checkout page, product-page work, editor, AI, onboarding, publishing UI or real commerce integration.

## Isolated files safe to implement before PR #12 merges

- `docs/P1_04_CART_RENDERER_PLAN.md`
- `src/components/registry/cart.tsx`
- `src/components/storefront/cart-sections.tsx`
- `src/components/storefront/cart-sections.module.css`
- `tests/unit/cart-registry.test.tsx`
- `tests/integration/cart-page-rendering.test.tsx`

The cart definition and renderer can be developed through direct imports in cart-specific tests without registering them globally or changing canonical seed/persistence data.

## Files and integration that must wait for PR #12

PR #12 currently changes these shared integration files, so P1-04 must not edit them until its product work lands:

- `src/data/seed/aurum-nordic.ts`
- `src/components/registry/contract.ts`
- `src/components/registry/homepage.tsx`
- `src/components/registry/index.ts`
- `src/components/registry/registry.ts`
- `src/integrations/puck/config.tsx`
- `src/services/storage/indexed-db-project-repository.ts`
- `src/app/globals.css`
- `tests/integration/collection-renderer.test.tsx`
- `tests/integration/indexed-db-project-repository.test.ts`
- `tests/unit/aurum-nordic-seed.test.ts`
- `tests/unit/homepage-registry.test.tsx`
- `tests/unit/puck-adapter.test.ts`

The following new cart route/test files do not overlap by path, but their successful implementation depends on the post-PR-12 canonical snapshot, registry and migration baseline and therefore also waits:

- `src/app/projects/[projectId]/cart/page.tsx`
- `src/app/projects/[projectId]/cart/cart-preview-client.tsx`
- `tests/integration/cart-route.test.tsx`
- `tests/e2e/cart-page.spec.ts`

Existing homepage, collection and product component/route/test files remain untouched.

## Isolated implementation notes

- `cartPage` uses one controlled `split` variant and is allowed only on cart pages.
- Line items store only validated catalogue product references and bounded dummy quantities. Duplicate and unknown references are rejected before rendering.
- Product titles, images, unit prices and derived totals resolve from the validated catalogue. Line items, demo-only status, prices and stock status are protected metadata, while only the bilingual page heading is editor-exposed in this isolated slice.
- Quantity, removal and checkout controls are accessible buttons with a shared localized demo notice. They intentionally have no handlers and cannot mutate catalogue, cart or operational data.
- The renderer provides bilingual populated and empty states. Existing controlled `benefitIcons` rendering is covered alongside the cart without creating a competing benefits model.
- Route loading/error states and canonical page composition remain deferred because they require the shared seed, registry, repository and route integration that must wait for PR #12.

## Post-merge implementation sequence

1. Rebase the proposed P1-04 branch onto the main commit containing PR #12.
2. Finalize strict `cartPage` content/props schemas, defaults, protected metadata, catalogue-reference validation and the `split` renderer in cart-specific files.
3. Register `cartPage` through the single Veskify registry; derive Puck Config from that registry without exposing Puck types outside the integration.
4. Extend only the approved global `header`, `benefitIcons` and `footer` page compatibility needed for cart pages, without new variants.
5. Add deterministic bilingual cart pages to draft and published seed snapshots and an exact, idempotent untouched P1-03 → P1-04 IndexedDB migration that preserves any edited aggregate.
6. Add the repository-loaded cart preview route with BrandSystem variables, locale controls, project-scoped navigation, Draft preview indicator and merchant-readable states.
7. Add unit, integration, route and dedicated Playwright coverage, including empty cart, protected prices/quantities, non-functional controls, hidden validation and 375/768/1024/1440 overflow checks.
8. Run the focused suites and the complete validation sequence before publication.

## Proposed branch

`codex/p1-04-cart-renderer`
