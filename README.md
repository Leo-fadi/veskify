# Veskify

Veskify is the controlled AI storefront-design engine that powers the future **Vesko Storefront Studio** merchant experience.

It helps retailers transform an existing public storefront, a logo, available media and canonical Vesko commerce data into a coherent, responsive and editable online storefront. Merchants can request design changes in plain language, review validated proposals, adjust the result visually, save a draft and publish explicitly.

## Product boundary

Veskify designs presentation. It does not operate commerce.

It may design:

- brand tokens and visual direction;
- navigation, header and footer;
- homepage, collection and product-detail pages;
- content, campaign, cart and checkout presentation;
- reusable responsive component compositions;
- dynamic product option presentation;
- localized presentation copy and SEO metadata.

It must not modify:

- product identity or SKU;
- product type, option values or variant identity;
- price, compare-at-price, stock or availability truth;
- payments, shipping, logistics, taxes, orders or inventory;
- operational checkout behaviour.

Canonical commerce data is consumed through read-only adapters.

## Current verified baseline

The repository currently includes:

- Next.js App Router, React, TypeScript, Tailwind CSS and Zod;
- Puck isolated as the visual-editor foundation;
- canonical storefront, brand, snapshot and history models;
- registered responsive components;
- manual section editing and device preview;
- selected-section, current-page and whole-storefront AI proposal scopes;
- structured validation and protected-field guards;
- deterministic and OpenAI provider adapters;
- atomic multi-page acceptance with undo/redo;
- separate save draft and publish flows;
- IndexedDB persistence and realistic Aurum/Karvonen fixtures;
- a verified real-provider Karvonen redesign and publish journey.

## Next development direction

The v1.2 roadmap prioritizes:

1. reusable component registry v2 and typed data bindings;
2. dynamic product-detail pages for simple and complex product types;
3. URL-first source discovery and brand reconstruction;
4. asset-aware initial generation;
5. exact brand-palette and whole-storefront design quality;
6. native Vesko Storefront Studio product UX;
7. reliable staging and Vesko integration handoff.

Veskify is not building another catalogue/import system. Jewellery and watches remain the first deep reference industry before broader expansion.

## Architecture

```text
Vesko / fixture commerce truth
  -> read-only commerce projection
  -> Veskify canonical storefront contracts
  -> controlled component families and page blueprints
  -> design skills and structured operations
  -> validated proposal
  -> draft acceptance and atomic history
  -> explicit save and publish
```

Public website discovery is treated as untrusted design evidence with provenance. It informs brand and asset reconstruction but never overrides canonical Vesko commerce values.

## Local development

Requirements:

- Node.js version supported by the repository;
- pnpm;
- a modern browser with IndexedDB.

Install and start:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The deterministic AI provider is the default and requires no secret.

For the optional real OpenAI provider, configure a local server-side environment file:

```bash
OPENAI_API_KEY=<your-key>
VESKIFY_AI_PROVIDER=openai
```

Never commit provider keys.

## Validation

Normal feature PRs should run focused tests plus typecheck, lint and formatting once when required. GitHub CI performs the broad gate.

Full repository validation is reserved for phase/release gates, high-risk migrations, staging acceptance or explicit instruction.

## Documentation

- [`docs/VESKIFY_SDD.md`](docs/VESKIFY_SDD.md) — authoritative product and architecture specification.
- [`docs/VESKIFY_SDD_v1.2.docx`](docs/VESKIFY_SDD_v1.2.docx) — synchronized human-readable export.
- [`AGENTS.md`](AGENTS.md) — binding Codex/developer constitution.
- [`docs/VESKIFY_DEVELOPMENT_ROADMAP.md`](docs/VESKIFY_DEVELOPMENT_ROADMAP.md) — current phase plan.
- [`docs/DESIGN_AGENT_SKILLS.md`](docs/DESIGN_AGENT_SKILLS.md) — controlled skill catalogue.
- [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) — worktree, testing and PR workflow.
- `docs/adr/` — binding architecture decisions.

## Core decisions

- Puck provides editor mechanics but does not own canonical state.
- AI emits structured operations, never arbitrary frontend code.
- Veskify owns storefront composition and proposal safety.
- Vesko owns commerce truth.
- Components are reusable, versioned and data-bound.
- Dynamic product pages render option groups supplied by canonical data.
- Material changes are reviewable and reversible.
- Save draft and Publish changes are separate actions.

Owner: Vesko Oy
