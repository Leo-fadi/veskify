# Veskify

Veskify is a standalone AI storefront **design** agent demo for retailers with very low technical and design knowledge. This foundation uses dummy-only commerce boundaries and does not configure real prices, payments, shipping, taxes, inventory, logistics, or orders.

## Authoritative specification

- Product and software specification: [`docs/VESKIFY_SDD.md`](docs/VESKIFY_SDD.md)
- Codex repository instructions: [`AGENTS.md`](AGENTS.md)
- Phase 0 Batch 1 notes: [`docs/PHASE_0_FOUNDATION.md`](docs/PHASE_0_FOUNDATION.md)

## Current scope

Phase 0 Batch 1 implements only the repository foundation, minimal accessible application shell, shared Zod primitives/localisation schemas, the `BrandSystem` schema/token validation for the fictional **Aurum Nordic** demo brand, and a minimal isolated Puck adapter proof.

Tasks 5–16 are intentionally not implemented yet. There is no onboarding, full editor chrome, full component registry, catalogue data, IndexedDB persistence, AI provider, publishing flow, or commerce integration in this batch. Puck is embedded only as infrastructure proof through Veskify-controlled components and validation.

## Setup

```bash
pnpm install
```

## Commands

```bash
pnpm dev        # Start the Next.js development server
pnpm typecheck  # Run strict TypeScript checks
pnpm lint       # Run ESLint with: eslint .
pnpm test       # Run Vitest unit and integration tests
pnpm build      # Build the Next.js application
pnpm test:e2e   # Run the Playwright smoke test
```

## Implementation notes

- Package manager: pnpm
- Framework: Next.js App Router with strict TypeScript
- Styling: Tailwind CSS and CSS variables generated from validated brand tokens
- Validation: Zod schemas in `src/domain/**` and Puck adapter validation in `src/integrations/puck/**`
- Testing: Vitest, React Testing Library, and Playwright
- Embedded editor foundation: `@puckeditor/core` via an isolated Veskify adapter; HugoBlox is not used
- Supported locales: English (`en`) and Finnish (`fi`)
