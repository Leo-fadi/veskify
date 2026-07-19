# P3-19 — O-08 languages domain and application support

P3-19 prepares the canonical language-selection boundary for onboarding O-08. It
does not add the React onboarding screen, modify the onboarding wizard, or change
the shell/save-and-exit flow.

The authoritative product contract is `docs/VESKIFY_SDD.md`; this milestone note
records the implementation scope and traceability for that SDD. The synchronized
human-readable export is `docs/VESKIFY_SDD_v1.1.docx`.

## Canonical fields and values

Storefront language choices remain in the existing fields:

- `StorefrontDesignBrief.languagePlan.selectedLanguages`
- `StorefrontDesignBrief.languagePlan.primaryLanguage`
- the existing onboarding session `selectedLanguages` and `primaryLanguage` fields,
  synchronized when O-08 is updated or completed

The only supported storefront languages are `en` (English) and `fi` (Finnish).
Canonical ordering is `en`, then `fi`, regardless of input order. Duplicates and
unsupported values are rejected at the domain and O-08 application boundaries,
including a distinct unsupported-primary error; normalization validates every
runtime locale before deduplication or ordering, and never silently filters a
malformed locale. Strict schemas continue to reject malformed values.

At least one language is required for O-08 completion. A primary language is
required and must be one of the selected languages. If a selection would leave the
primary language outside the set, the mutation rejects it with a stable typed
validation error rather than inventing a fallback.

## O-08 transition

`OnboardingService.updateLanguages` validates and persists a partial O-08 selection
while keeping the active step on `languages`. `completeLanguages` validates the
selection, writes the canonical language plan into the design brief, synchronizes
the session-level fields, marks `languages` complete, and advances atomically to
`review-plan` through the existing repository commit boundary. Earlier O-01–O-07
data is carried forward unchanged. Invalid current steps and invalid selections are
rejected before persistence.

Persisted schema-v2 sessions restore canonical locale ordering at the established
loading boundary. Unrelated malformed sessions still fail strict validation; no
broad repair or hidden language fallback is added.

## Propagation and exclusions

P3-10 already receives the canonical brief and therefore uses its language plan for
deterministic generation. P3-13 exposes the selected languages and primary language
in its localized review projection. P3-15 maps them to the existing project
`enabledLocales` and `primaryLocale`, and P3-17 persists that aggregate through the
repository. This task does not translate or invent content and does not modify
publishing, editing, rendering, commerce, catalogue, inventory, orders, payments,
or the React onboarding UI.

## Traceability

This slice implements the O-08 contract in SDD §5.3 and §6.1 FR-004 and FR-007,
using the canonical domain and generation boundaries in §§12.8, 14, 15.1–15.5,
16.2–16.5 and 17.1/17.4. It preserves strict validation required by NFR-006 and
the guided creation/review/project handoffs covered by AC-001, AC-002, AC-021,
AC-023 and AC-025–AC-027.
