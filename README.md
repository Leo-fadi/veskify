# Veskify

Veskify is the internal controlled storefront-design engine for the merchant-facing **Vesko
Storefront Studio**. It turns approved brand/source evidence, approved presentation assets, and
read-only canonical Vesko commerce data into a governed, editable, and explicitly publishable
storefront.

The overall product is **Partial**. Phase 9 is closed by product-owner handoff, and P10A grounded
orchestration and publishing is **Baseline / closed**. P10B Commercial Storefront Generation System
v1 is **Partial / active**: P10B-01 through P10B-14 are Baseline, including Design DNA, commercial
anatomy, art direction, page-family authority, four canonical shared-frame families, commercial
storytelling families, a five-anatomy canonical product-card family, homepage, collection/search,
PDP, fifteen approved-fact content/support profiles, governed commerce-utility presentation, and
one retained 17-route Premium Editorial complete-storefront proof; P10B-15 through P10B-18 remain
Planned.

## Product boundary

Veskify owns storefront creation and presentation: site map, page set, navigation, routes,
`BrandSystem`, registered components and PageBlueprints, `StorefrontSnapshot`, governed synthesis
and proposals, editing, draft/history, preview, and publication compilation. This includes home,
collection, PDP, content/support, campaign, search, cart/checkout, empty, error, and 404
presentation.

Vesko owns operational commerce and sellability. Veskify consumes product, variant, option, SKU,
price, stock, availability, canonical media, inventory, cart/checkout operations, order, payment,
shipping, tax, returns, logistics, and merchant/store operational truth read-only. It must not
mutate, replace, or invent those authorities. Legal, policy, delivery, guarantee, certification,
and compliance claims require approved merchant or Vesko evidence.

Puck supplies isolated editor mechanics. Puck data is transient adapter data, never a second
canonical page tree or persistence format. AI emits validated structured operations and may select
only registered authority; it never emits executable storefront code.

## Current verified baseline

The repository includes:

- one canonical editable `StorefrontSnapshot` and `BrandSystem`;
- ComponentDefinitionV2, a generated capability manifest, and registered renderer authority;
- a closed, owned, narrowing-only commercial grammar with deterministic compatibility and
  selection fingerprints;
- canonical parametric Design DNA with deterministic legacy migration, semantic renderer
  projection, contrast-safe colour, and bounded cross-page typography, spacing, layout, surface,
  control, density, and media posture;
- typed component anatomy, structural-difference classification, deterministic migration, and a
  generated fail-closed commercial-ready capability query;
- nineteen registered page families with canonical site-map, route, locale, navigation, evidence,
  page-set materialization, and lifecycle authority;
- executable PageBlueprint profiles for home, collection, and dynamic product-detail composition;
- protected canonical commerce bindings, dynamic variants/options/media, and safe fallbacks;
- approved source evidence, asset inventory, and Storefront Design Brief contracts;
- governed internal initial-generation and follow-up-editing packages;
- strict internal section, page, frame, and whole-storefront scope authority;
- validated proposal review, atomic acceptance, undo/redo, draft save, history, and restore;
- isolated Puck/editor, preview, and published route projections;
- an authoritative server-side merchant publishing gateway;
- deterministic publication compilation, atomic immutable artifact/version persistence,
  restore-to-draft/explicit-republish rollback, and published home, collection, and PDP rendering;
- deterministic, integration, and browser evidence for the stated capabilities.

Merchant-facing wiring of governed routing, clarification, and scoped execution belongs to P10C.
It is not a P10A closure requirement.

## Commercial limitation and next milestone

Current output can be a clean, responsive catalogue storefront, but it has limited brand
distinction and has not passed a current commercial human visual-quality gate. P10B Commercial
Storefront Generation System v1 is the active product phase and the first phase allowed to make a
commercial-quality claim.

Its target is:

> Generate a complete storefront that a serious retailer can publish without a designer rebuilding
> it.

P10B first makes the existing design grammar, Design DNA, component anatomy, page-set authority,
families, and profiles executable. It then proves one complete Premium Editorial vertical slice
before bounded synthesis and broader direction/diversity work. Tests and schema validity alone
cannot close its 100+ configuration scale gate or commercial human-review gate.

## Delivery sequence

1. P10A — Grounded orchestration and publishing closure (**Baseline / closed**)
2. P10B — Commercial Storefront Generation System v1 (**Partial / active phase**)
3. P10C — Storefront Studio Editing Experience v1
4. P10D — Advanced media and registered interactive presentation
5. P11 — Vesko Integration Readiness and Reference Adapter
6. P12 — Production hardening and pilot operations

P10D is not required for the first commercial storefront, minimum pilot editor, or Vesko pilot.

## Vesko integration truth

The Vesko OpenAPI 3.0 contract has been obtained and audited. It exposes real store, catalogue,
media, inventory, Puck, and storefront product surfaces, but it is not sufficient for production
integration. Typed responses, security/tenancy, revisions, navigation/synchronization, canonical
draft/history/publication APIs, and staging authority remain unresolved. Raw `/puck` persistence is
not compatible with canonical `StorefrontSnapshot` storage. No Vesko staging or production evidence
exists.

See the [OpenAPI contract audit](docs/VESKO_OPENAPI_CONTRACT_AUDIT.md) and
[integration matrix](docs/VESKO_VESKIFY_INTEGRATION_MATRIX.md).

## Architecture

```text
approved evidence and read-only Vesko commerce
  → Veskify site-map and page-set decision
  → bounded BrandSystem / Design DNA
  → registered PageBlueprint profile per page
  → compatible family, meaningful variant and bounded parameters
  → approved asset art direction and narrative validation
  → complete StorefrontSnapshot
  → preview and explicit publish
```

Design inherits through:

```text
BrandSystem
  → registered PageBlueprint profile
  → compatible component family and meaningful variant
  → bounded validated instance override
```

Directions select compatible combinations; they do not create another token, recipe, or page
authority.

## Local development

Requirements: a repository-supported Node.js version, pnpm, and a modern browser.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The deterministic provider is the safe default for local development and requires no secret.
Provider credentials must remain server-side and must never be committed.

For normal feature work, run focused tests plus typecheck, lint, and formatting once when required.
Full Vitest, Playwright, and production builds are reserved for explicit release, staging, or
high-risk validation.

## Authoritative documentation

- [Software Design Document v1.3.0](docs/VESKIFY_SDD.md)
- [Software Design Document v1.3.0 DOCX](docs/VESKIFY_SDD_v1.3.0.docx)
- [Development roadmap](docs/VESKIFY_DEVELOPMENT_ROADMAP.md)
- [Development delivery tracker](docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md)
- [Development delivery tracker v1.3.0 DOCX](docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER_v1.3.0.docx)
- [Current-state truth audit](docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md)
- [Capability evidence ledger](docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md)
- [P10A phase closure record](docs/P10A_PHASE_CLOSURE.md)
- [P10B commercial storefront generation architecture](docs/P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md)
- [Development guide](docs/DEVELOPMENT_GUIDE.md)
- [Binding repository constitution](AGENTS.md)
- [Architecture decisions](docs/adr/README.md)

Historical phase records retain their original evidence meaning. Superseded exports, including
[SDD v1.2.2](docs/archive/VESKIFY_SDD_v1.2.2.docx), are retained in the
[documentation archive](docs/archive/README.md) and are not current implementation authority.

## Non-claim

This repository does not claim current P10B commercial visual acceptance, merchant-complete
Storefront Studio editing, complete Vesko integration, Vesko staging acceptance, production
readiness, or production operation.

Owner: Vesko Oy
