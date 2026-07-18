# P3-05 — Deterministic brand foundation planner

## Purpose and ownership

The React-independent `src/application/brand-foundation` boundary converts a validated
`StorefrontDesignBrief` into a proposed canonical `BrandSystem`. It owns the versioned
`BrandFoundationPlan` contract, controlled preset registry, deterministic mapping policy,
colour safety and provenance. It does not own onboarding sessions, project creation, pages,
templates, persistence, proposals, providers or editor state.

The planner supports the SDD design-system and controlled-agent boundaries (SDD §§8.1–8.4,
12.5, 12.8–12.10, 15.5, 18.1 and 21.1; FR-003, FR-007, FR-008, FR-009, FR-010 and FR-040).
It is a foundation for later deterministic initial storefront generation; it does not claim
AC-001 or project-generation completion.

## Controlled presets

The frozen registry contains six industry-neutral foundations:

- `clean-minimal-v1`
- `editorial-v1`
- `premium-luxury-v1`
- `playful-v1`
- `bold-v1`
- `natural-v1`

Every preset is schema-validated and contains only canonical colour roles, approved font tokens,
controlled shape, spacing, imagery and voice values. Suitability metadata provides deterministic
fallback selection when the merchant has not chosen a visual direction; it is not a claim that
an industry may only use one foundation.

## Mapping and precedence

The planner is pure and deterministic. It never calls a provider, reads the clock, uses random
values, fetches assets or mutates its input. The stable precedence is:

1. explicit merchant typography, colour, imagery and tone preferences;
2. accessibility constraints;
3. the visual-style preset (or industry suitability when no style is selected);
4. approved typography pairing;
5. generation preferences such as density and content emphasis;
6. controlled preset defaults.

Typography directions map only to `georgia`, `inter`, `system-sans` and `system-serif`. Visual
density, imagery direction, content emphasis and tone keywords map to existing BrandSystem enum
values. The plan ID is a stable hash of the normalized brief and planner source version, so equal
inputs produce equal IDs and results.

## Colour safety and accessibility

Six-digit hexadecimal colours are normalized before planning. Preferred colours are retained in
safe emphasis roles where their contrast permits; a low-contrast preference is retained as a
secondary accent and reported with a structured warning rather than silently discarded. Text,
background and surface roles always pass the WCAG-style minimum contrast check. High-contrast
briefs use a 7:1 text pairing target and accessibility takes precedence over visual styling.

## Plan states and provenance

Normal incomplete briefs use controlled defaults and remain `ready`. A safe adjustment produces
`ready-with-warnings`; `blocked` is reserved for the future case where no valid BrandSystem can be
produced. Each plan records localized assumptions, warnings and provenance for colours,
typography, shape, spacing, imagery and voice so a later onboarding UI can explain the result.

## Later integration boundary

P3-06+ onboarding and deterministic storefront generation may consume `planBrandFoundation`, show
its explanation and warnings, and allow the merchant to edit the resulting BrandSystem before
creating a project. This PR intentionally does not integrate onboarding, create projects or
persist plans.
