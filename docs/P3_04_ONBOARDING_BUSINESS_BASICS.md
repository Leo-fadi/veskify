# P3-04 — Guided Onboarding Business Basics

## Merchant outcome

The `/projects/new` flow now carries one collecting `StorefrontDesignBrief` inside the persisted
`OnboardingSession`. A merchant can choose the O-01 creation path, enter the required O-02 business
basics in English or Finnish, go back and forward, refresh, and resume without creating a project or
storefront pages.

## Specification alignment

This milestone implements the O-01/O-02 slice described by SDD §§4.1, 4.4, 5.1, 5.3, 6.1, 8.1,
11.1, 12.1–12.5, 14.1, 15.1 and 21. It prepares FR-001, FR-002, FR-003, FR-004, FR-005, FR-007,
FR-008, FR-009 and FR-035, and supports the onboarding portions of AC-001 and AC-002. Full
generation, project creation and editor handoff remain later acceptance criteria.

## Session ownership and migration

`OnboardingSession` remains the single persisted workflow aggregate. Its `designBrief` property is
the canonical validated `StorefrontDesignBrief`; onboarding does not define another business-profile
schema. The embedded brief is always `collecting`, shares the session creation timestamp, and is
updated through the canonical immutable brief-area helper. Session invariants reject a missing brief,
brief lifecycle changes, timestamp drift, and disagreement between the O-01 path and brief context.

The session schema moved from version 1 to version 2. The browser repository recognizes exactly the
immediately previous P3-01 version, migrates it deterministically, persists the migrated v2 value,
maps `demo-preset` to `demo-storefront`, preserves identity and timestamps, and does not invent
business data. Invalid legacy data remains corrupt; unknown future versions remain incompatible.

## O-01 and O-02 behavior

O-01 maps `new-storefront`, `redesign-existing-storefront`, and `demo-preset` to the corresponding
brief creation context in the same repository write. Leaving a redesign clears any existing URL;
the flow does not invent one.

O-02 uses the canonical business identity fields: name, short description, bounded industry, target
customer and primary market. The React-independent onboarding service normalizes and persists field
edits, evaluates only these required fields, and advances to the O-03 existing-sources step only when
all five are valid. Optional secondary markets and later brief areas remain untouched.

The form uses native labelled controls, localized EN/FI copy and industry labels, length limits,
field-level errors, an accessible summary, first-invalid focus, keyboard navigation, and a
responsive layout. The parent keeps the usable in-memory draft while storage recovery is shown;
retry returns to the persisted workflow without exposing technical errors.

## Persistence and recovery

All writes continue through `OnboardingSessionRepository`; routes never write localStorage directly.
Field, completion, navigation, path, skip, and reset writes are serialized by one onboarding-boundary
mutation queue. Each queued task reads the latest session immediately before calling the service, so a
blur save cannot overwrite Back or another workflow transition. Storage errors pause later queued work
and enter the existing controlled retry state; retry reopens the queue. Non-storage programming errors
are not converted into storage errors.
Partial O-02 data, completed O-02 data, migrations, corrupt values, incompatible versions, and
unavailable storage are covered by focused unit, integration, route, and Playwright tests.

## Explicit boundary and deferred work

This milestone does not consume or modify P3-03 template-registry work and does not create projects,
pages, templates, catalogue records, assets, uploads, imports, provider prompts, AI output, Puck
data, proposals, drafts, publishing state, history, or restore state. O-03 remains limited to a
merchant-entered HTTPS URL for redesigns or an informational no-source state; O-04–O-09 remain
controlled placeholders.
