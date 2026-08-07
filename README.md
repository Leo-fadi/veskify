# Veskify

Veskify is the internal controlled storefront-design engine for the merchant-facing **Vesko
Storefront Studio**. It turns approved brand/source evidence, approved presentation assets, and
read-only canonical Vesko commerce data into a governed, editable, and explicitly publishable
storefront.

The overall product is **Partial**. Phase 9 is closed by product-owner handoff, and P10A grounded
orchestration and publishing is **Baseline / closed**. P10B Commercial Storefront Design System v1
is the next active development phase, but remains **Planned** until implementation and evidence
begin.

## Product boundary

Veskify owns storefront presentation and composition: `BrandSystem`, registered components and
PageBlueprints, `StorefrontSnapshot`, governed proposals, editing, draft/history, preview, and
publication compilation.

Vesko owns operational commerce and sellability. Veskify consumes product, variant, option, SKU,
price, stock, availability, canonical media, inventory, order, payment, shipping, tax, and logistics
truth read-only. It must not mutate or replace those authorities.

Puck supplies isolated editor mechanics. Puck data is transient adapter data, never a second
canonical page tree or persistence format. AI emits validated structured operations and may select
only registered authority; it never emits executable storefront code.

## Current verified baseline

The repository includes:

- one canonical editable `StorefrontSnapshot` and `BrandSystem`;
- ComponentDefinitionV2, a generated capability manifest, and registered renderer authority;
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
Storefront Design System v1 is the next visual product phase and the first phase allowed to make a
commercial-quality claim.

Its target is:

> Generate a complete storefront that a serious retailer can publish without a designer rebuilding
> it.

P10B first proves one complete Premium Editorial vertical slice, then Modern Technical and Minimal
Commerce, then narrative, responsive, and commercial-quality closure. Tests and schema validity
alone cannot close that gate.

## Delivery sequence

1. P10A — Grounded orchestration and publishing closure (**Baseline / closed**)
2. P10B — Commercial Storefront Design System v1 (**Planned / next active phase**)
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
  → registered capability and PageBlueprint authority
  → governed instruction and scope
  → structured plan and proposal
  → validated StorefrontSnapshot
  → review and atomic acceptance
  → draft, history and preview
  → deterministic publication compilation
  → immutable published version
  → homepage, collection and PDP rendering
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
