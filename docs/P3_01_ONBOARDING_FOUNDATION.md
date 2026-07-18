# P3-01 — Guided Onboarding Foundation

## Merchant outcome

A retailer can open `/projects/new`, choose whether to create a new storefront, redesign an existing
storefront, or use a demo preset, and continue into a clear nine-step onboarding shell. Valid progress
is saved locally, so refreshing or leaving the route resumes the same active step. English and Finnish
interface controls do not reset progress.

This milestone establishes onboarding only. It does not create a `Project`, generate pages or a brand
system, read catalogue data, upload assets, enter the editor, or call an AI provider.

## Specification alignment

- SDD §4.1 — Path A guided creation journey
- SDD §4.4 — optional-step defaults and refresh persistence
- SDD §5.1 — `/projects/new`
- SDD §5.3 — canonical O-01 through O-09 screens
- FR-001 — guided onboarding foundation for future project creation
- FR-002 — new-store, redesign, and demo-preset entry paths
- FR-003 — central required/optional navigation and safe skipping
- FR-004 — local persistence after valid completed or skipped transitions
- NFR-004 and NFR-006 — keyboard-accessible controls, strict TypeScript, and boundary validation

Full storefront creation acceptance criteria AC-001 and AC-002 remain intentionally incomplete until
the later generation milestone. P3-01 covers the entry-path, persistence, recovery, localization, and
accessible shell prerequisites for those criteria.

## Architecture boundary

| Layer                        | Ownership                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/onboarding`      | Versioned Zod session contract, stable values, invariants, and the ordered localized O-01–O-09 registry. No React, Next.js, browser, Puck, or provider types.        |
| `src/application/onboarding` | React-independent creation, resume, path selection, validated navigation, skip, reset, and progress inspection. Depends only on the onboarding repository interface. |
| `src/services/onboarding`    | `OnboardingSessionRepository` and the SSR-safe localStorage adapter. Stored values are parsed, validated, cloned, and classified before use.                         |
| `src/app/projects/new`       | Localized accessible wizard presentation and recoverable merchant-facing UI states. It uses the application service and never manages raw storage.                   |

The onboarding storage key is separate from IndexedDB project storage. No `ProjectRepository`, project,
snapshot, draft, published state, catalogue, design operation, proposal, or seeded content contract is
modified or invoked.

## Canonical session and lifecycle

The schema records a stable session ID, schema version, selected creation path, active step, completed
and skipped steps, storefront language defaults, status, and creation/update timestamps. Validation
rejects unsupported or duplicate values, completed/skipped overlap, an invalid primary language,
timestamp reversal, incompatible schema versions, and active steps that jump over unresolved work.

The lifecycle is:

1. `resume()` loads and validates saved progress.
2. Missing progress creates and persists a clean O-01 session.
3. Choosing an O-01 path persists that choice without marking O-01 complete.
4. Continue validates the step, records O-01 as completed, persists once, and activates O-02.
5. Back changes only the active step; completed information remains available.
6. Skip is accepted only for optional steps and persists the skip plus next active step atomically.
7. Invalid or failed transitions return typed failures without partially changing the supplied session.
8. Reset validates and saves a new clean session in one replacement write, so a failed write cannot
   first delete the prior recoverable value.

Only O-01 is completable in P3-01. O-02–O-09 are controlled placeholders that describe later input and
state explicitly that it has not been saved. Continue is disabled on those placeholders. The service
still implements and tests the canonical required/optional navigation rules needed as later forms land.

## Persistence and recovery

`BrowserOnboardingSessionRepository` resolves browser storage only when a method runs, making adapter
construction safe during server rendering. It returns one of five controlled load states:

- missing;
- found and validated;
- corrupt;
- incompatible version;
- storage unavailable.

Corrupt or incompatible values never reach the domain or crash the route. The merchant can confirm a
discard-and-restart action. Storage failures show a plain-language retry state. Neither raw data,
storage keys, schema versions, nor technical exceptions are presented in the UI.

## UI and accessibility coverage

The route includes loading, new, resumed, storage-failure, corrupt/incompatible recovery, restart
confirmation, and valid active-step states. It provides semantic headings, labelled radio groups,
keyboard-operable path and locale controls, visible focus, accessible status and progress information,
and responsive layouts verified at 375, 768, 1024, and 1440 pixels without horizontal overflow.

## Implemented tests

- Unit: schema invariants, registry ordering/navigation, transitions, required/optional skip rules,
  placeholder guard, reset, progress, persistence failure rollback, and immutable results.
- Integration: browser persistence, refresh/resume, corrupt/incompatible classification, SSR safety,
  unrelated storage isolation, O-01 UI flow, back navigation, EN/FI state preservation, and recovery.
- Playwright: all three paths, continue/back, refresh/resume, keyboard selection, EN/FI switching,
  corrupt/incompatible recovery, and required responsive widths.

## Deferred P3-02 through P3-06 scope

- P3-02: business basics form and validated business-profile input.
- P3-03: existing-source and brand-asset intake, including safe upload boundaries.
- P3-04: guided visual direction and catalogue-source selection or import mapping.
- P3-05: page and storefront-language configuration plus the plain-language review plan.
- P3-06: confirmed project/storefront generation, generation progress, and editor handoff through
  approved presets, components, skills, operations, and project services.

Those milestones must continue to use the canonical registry and session service. They must not put raw
form or browser-storage state directly into route components or bypass the existing project, catalogue,
design-agent, draft, or publishing boundaries.
