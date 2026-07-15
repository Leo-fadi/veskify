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

## Explicitly deferred

Later Phase 0 and Phase 1 work remains out of scope for these batches. The implementation does not add IndexedDB, snapshots, publishing, full editor chrome, chat, onboarding, seed catalogue data, the full component registry, AI providers, authentication, real payments, logistics, shipping, tax, inventory, orders or storefront templates.
