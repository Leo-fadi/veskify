# Veskify

Veskify is a standalone AI storefront **design** agent demo for retailers with very low technical and design knowledge. This foundation uses dummy-only commerce boundaries and does not configure real prices, payments, shipping, taxes, inventory, logistics, or orders.

## Authoritative specification

- Product and software specification: [`docs/VESKIFY_SDD.md`](docs/VESKIFY_SDD.md)
- Codex repository instructions: [`AGENTS.md`](AGENTS.md)
- Phase 0 Batch 1 notes: [`docs/PHASE_0_FOUNDATION.md`](docs/PHASE_0_FOUNDATION.md)

## Current scope

The completed Phase 0 foundation through P0-06 includes canonical domain schemas, the controlled component registry, the validated **Aurum Nordic** jewellery seed, repository-level draft/publish/restore semantics, and browser persistence through an isolated IndexedDB adapter. UI routes, onboarding, AI operations, and later Phase 0 work remain intentionally deferred.

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
- Persistence: `ProjectRepository` adapters for deterministic memory storage and browser IndexedDB via `idb`
- IndexedDB tests: shared repository contract coverage plus persistence tests using development-only `fake-indexeddb`
- Embedded editor foundation: `@puckeditor/core` via an isolated Veskify adapter; HugoBlox is not used
- Supported locales: English (`en`) and Finnish (`fi`)
