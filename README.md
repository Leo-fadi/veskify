# Veskify

Veskify is a standalone AI storefront **design** agent demo for retailers with very low technical and design knowledge. This foundation uses dummy-only commerce boundaries and does not configure real prices, payments, shipping, taxes, inventory, logistics, or orders.

## Authoritative specification

- Product and software specification: [`docs/VESKIFY_SDD.md`](docs/VESKIFY_SDD.md)
- Codex repository instructions: [`AGENTS.md`](AGENTS.md)
- Phase 0 implementation history: [`docs/PHASE_0_FOUNDATION.md`](docs/PHASE_0_FOUNDATION.md)
- Phase 0 completion matrix: [`docs/PHASE_0_COMPLETION.md`](docs/PHASE_0_COMPLETION.md)

## Current scope

**Phase 0 is complete.** The reproducible foundation includes canonical domain schemas, the controlled component registry, isolated Puck infrastructure, the validated **Aurum Nordic** jewellery seed, repository-level draft/publish/restore semantics, browser persistence, and a first read-only persisted project route.

This does not mean the full Veskify product is complete. Phase 1 storefront rendering is next; editor UI, onboarding, AI operations, publishing workflows, and production integrations remain deferred.

## What can be tested

After starting the development server, these local routes are available:

- `http://localhost:3000/` — foundation status and route links
- `http://localhost:3000/puck-proof` — isolated Puck compatibility proof
- `http://localhost:3000/projects/project_aurum_nordic` — persisted read-only Aurum Nordic draft with English/Finnish switching

## Setup

```bash
pnpm install
```

## Commands

```bash
pnpm dev        # Start the Next.js development server
pnpm typecheck  # Run strict TypeScript checks
pnpm lint       # Run ESLint with: eslint .
pnpm format:check # Verify repository formatting
pnpm test       # Run Vitest unit and integration tests
pnpm build      # Build the Next.js application
pnpm test:e2e   # Run Chromium Playwright smoke tests
pnpm validate   # Typecheck, lint, format, test, and production build
pnpm validate:full # Run validate plus Playwright
```

## Implementation notes

- Package manager: pnpm
- Framework: Next.js App Router with strict TypeScript
- Styling: Tailwind CSS and CSS variables generated from validated brand tokens
- Validation: Zod schemas in `src/domain/**` and Puck adapter validation in `src/integrations/puck/**`
- Testing: Vitest, React Testing Library, and Playwright
- Persistence: `ProjectRepository` adapters for deterministic memory storage and browser IndexedDB via `idb`
- IndexedDB tests: shared repository contract coverage plus persistence tests using development-only `fake-indexeddb`
- Embedded editor foundation: `@puckeditor/core` via an isolated Veskify adapter; HugoBlox is not used
- Supported locales: English (`en`) and Finnish (`fi`)
