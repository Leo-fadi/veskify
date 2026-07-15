# Phase 0 Foundation

## SDD references

- §1 Executive product definition and §2 Product principles define the standalone design-agent boundary and prohibit real commerce configuration.
- §6.1 FR-007 requires English and Finnish storefront language support.
- §6.4 FR-040 requires structured output conforming to schemas.
- §15.1 and §15.5 define the `BrandSystem` domain entity and schema shape.
- §16.1 and §16.7 define the recommended Next.js stack and mandatory Puck embedded-editor foundation.
- §18 NFR-004, NFR-006, NFR-008, and NFR-009 require accessible controls, strict TypeScript/schema validation, no external API keys, and no executable AI markup/code paths.
- §21.1 and §21.3 require schema/token tests and task-level validation.
- Appendix D defines global validation expectations for locale fields, colour values, approved fonts, safe external URLs, and immutable protected commerce boundaries.

## Decisions implemented

- Created a pnpm-managed Next.js App Router application using current framework conventions.
- Added strict TypeScript, ESLint (`eslint .`), Prettier, Tailwind CSS, Vitest/React Testing Library, and Playwright smoke-test configuration.
- Built a minimal semantic application shell for the fictional Aurum Nordic brand.
- Added canonical shared Zod schemas for IDs, ISO datetimes, `en`/`fi` locales, localized text, localized SEO, safe external URLs, and asset references.
- Added `BrandSystem` validation matching SDD §15.5, including controlled colour, typography, shape, spacing, imagery, and voice tokens.
- Added approved font-token validation and a utility that converts validated brand tokens into CSS custom properties.
- Added an isolated minimal Puck adapter proof using `@puckeditor/core`, one approved Veskify demo component, Puck Config derived from Veskify-owned component definitions, Puck Render, and Zod validation for Puck draft handoff.

## Architecture correction

Puck is mandatory editor infrastructure, not the Veskify product architecture or source of commerce truth. Veskify owns the domain models, components, schemas, validation, localisation, draft/publish workflows, storage adapters, AI provider boundaries, and future Vesko integration. Puck output is not persisted or published directly; it must pass through Veskify validation and the explicit publish-confirmation workflow in later batches.

HugoBlox is explicitly excluded.

## Batch 2 — permanent Puck architecture alignment

Batch 2 records the Batch 1 compatibility proof as the approved repository architecture. The complete rationale and rejected alternatives are in [ADR-001](ADR-001-PUCK_EDITOR_FOUNDATION.md).

- Puck owns canvas mechanics, selection, insertion, drag-and-drop, viewport editing and editor fields.
- Veskify owns canonical schemas, component contracts, validation, protected fields, snapshots, persistence, publishing, AI operations and storefront rendering boundaries.
- Puck-specific types and `@puckeditor/core` imports stay isolated under `src/integrations/puck`; canonical domain modules do not depend on them.
- The adapter derives Puck Config from approved Veskify component contracts and validates/maps Puck output before draft state or persistence.
- Puck Data is transient editor infrastructure. Veskify stores one canonical page composition and does not persist a parallel Puck tree.
- Puck publish actions are draft-handoff events and cannot bypass explicit Veskify publish confirmation.
- Puck Cloud, Puck AI, HugoBlox, custom drag-and-drop infrastructure and arbitrary generated code remain excluded.

The existing Batch 1 proof already conforms to this boundary, so Batch 2 requires no product-code expansion.

## P0-02 — canonical domain models

P0-02 implements the editor-agnostic Zod schemas from SDD §15.1–§15.4 for business profiles, projects, navigation, pages, sections and storefront snapshots.

- Project validation preserves separate draft and published snapshot references and enforces enabled/primary locale consistency.
- Page and section composition is represented once in Veskify domain code, with controlled local style overrides and no Puck types.
- Snapshot validation enforces unique page and section IDs and requires internal navigation targets to resolve within the snapshot.
- Component and variant identifiers are stored structurally; registry membership and variant validation belong to P0-03 and are not implemented here.
- No persistence, snapshot workflow, publishing, Puck mapping, seed catalogue or storefront UI is introduced.

## P0-03 — controlled component registry

P0-03 adds the Veskify-owned component registry as the single source for component identifiers, labels, allowed pages and variants, content and props schemas, renderer mappings, editor-field metadata and protected-field metadata.

- The existing `AurumHero` is registered as the `hero` component with its editorial variant and home/landing page boundary.
- Registry validation composes the P0-02 `SectionInstance`, `PageModel` and `StorefrontSnapshot` schemas without introducing competing composition models.
- Unknown components, unsupported variants, disallowed page placement and invalid content or props are rejected before renderer invocation.
- Puck Config, editor fields, defaults and render mapping are generated by the isolated adapter from registry metadata.
- Puck-specific types remain under `src/integrations/puck`; the canonical registry and domain modules do not depend on Puck.
- P0-04 seed data, P0-05 storage and all later workflows remain deferred.

## P0-04 — Aurum Nordic jewellery seed

P0-04 adds one deterministic, locally validated jewellery demo aggregate using the P0-02 domain models and P0-03 registry.

- The Aurum Nordic project enables English and Finnish and references separate published and draft snapshots.
- The dummy catalogue contains the six Appendix B jewellery/watch products, bilingual display content, collections, protected dummy price/stock fields and §11.4 jewellery attributes.
- Six local SVG placeholder assets live under `public/seed-assets`; the seed uses no external images, APIs or credentials.
- Home, collection and product page templates are canonical `PageModel` data. Only the home page contains a section because `hero` is the sole registered component and is not allowed on collection or product pages.
- Both snapshots pass canonical schema validation and controlled registry validation at module construction time.
- At P0-04 completion, storage and all later UI, publishing, onboarding and AI workflows remained deferred.

## P0-05 — storage core

P0-05 establishes the canonical `ProjectRepository` boundary and a deterministic in-memory adapter before browser persistence is introduced.

- The repository exposes the SDD §17.4 `list`, `get`, `saveDraft`, `publish` and `restore` contract over the existing canonical Project, StorefrontSnapshot and catalogue models.
- The in-memory adapter starts from the validated Aurum Nordic aggregate and validates canonical Zod schemas plus registered component compositions at every input and output boundary.
- `structuredClone` isolates repository state from callers and saved inputs; internally frozen snapshots preserve history as immutable values.
- Draft saves leave the published reference unchanged. Publish requires the current revision, creates a new published snapshot and retains prior snapshots. Restore creates a new draft snapshot ID without publishing it.
- Typed errors distinguish missing projects, missing snapshots, revision conflicts, project mismatches and validation failures.
- Catalogue data remains read-only across repository operations, preserving protected dummy price and stock display fields.
- At P0-05 completion, IndexedDB persistence and all later UI and service workflows remained deferred.

## P0-06 — IndexedDB persistence

P0-06 adds browser persistence behind the unchanged `ProjectRepository` contract while preserving the P0-05 storage semantics.

- `IndexedDbProjectRepository` uses `idb` with a versioned database and separate project, catalogue and snapshot stores. A `by-project` snapshot index retrieves complete project history.
- Database access is lazy and adapter-local, so importing storage modules during SSR does not access browser globals.
- The validated Aurum Nordic aggregate is inserted atomically only when the projects store is empty. Reopening the database preserves user changes and never reseeds over existing data.
- Draft saves, publishing and restore use multi-store read/write transactions. Full canonical and component-registry validation occurs before writes, preventing partial invalid state.
- Test-only database names and injectable snapshot ID/time generators make persistence behavior deterministic without adding infrastructure concerns to domain models.
- The in-memory and IndexedDB adapters run through one shared repository contract suite. IndexedDB-specific coverage uses `fake-indexeddb` for bootstrap, reopen persistence, isolation and failed-operation safety.
- At P0-06 completion, project routes and all later UI, onboarding and AI workflows remained deferred.

## P0-07 — seeded project route

P0-07 adds `/projects/[projectId]` as a read-only, browser-loaded proof of the persisted Aurum Nordic draft. It is not the final editor route.

- The route creates the browser repository without reading IndexedDB during server rendering, then calls `ProjectRepository.get` with the URL project ID after hydration.
- The current draft and its homepage are resolved from canonical project/snapshot references and rendered only through the shared Veskify registry-backed storefront renderer.
- Validated BrandSystem tokens are applied as CSS variables. A labelled keyboard-accessible English/Finnish control defaults to the project primary locale and preserves shared fallback behavior.
- Loading, missing project/draft/homepage, storage failure and validation/rendering failure states use merchant-readable messages and safe retry actions where appropriate.
- The successful route displays a compact project name, Draft preview status and current locale without Puck chrome, editing, publishing or destructive controls.
- Unit/integration tests cover repository-to-registry rendering and all route states. Playwright covers the seeded route at desktop/mobile widths and locale switching.
- P0-08 and all editor, publishing, onboarding and AI workflows remain deferred.

## Explicitly deferred

Later Phase 0 and Phase 1 work remains out of scope for these batches. The implementation does not add the full editor route/chrome, editing commands, publishing UI, preview/published/history routes, chat, onboarding, AI providers, authentication, real payments, logistics, shipping, tax, inventory or orders.
