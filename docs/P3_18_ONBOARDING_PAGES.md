# P3-18 — O-07 Pages onboarding

O-07 now saves the canonical `StorefrontDesignBrief.storefrontStructure.pageTypes` selection in
the existing onboarding session. The deterministic generation/template system currently materializes
the required pages in this order: `home`, `collection`, `product`. The brief vocabulary also exposes
the optional requested page types `about`, `contact`, `faq`, `policy` and `content`.

The three generated pages are required and cannot be removed. Optional requested pages are enabled
checkboxes and can be selected or deselected; they are captured in the brief even when downstream
deterministic materialization only renders the supported required pages. O-07 has no Skip action.
Continue validates and canonicalizes the page IDs, persists the brief update, marks O-07 complete,
clears any stale skipped state, and moves to O-08 Languages in one `OnboardingMutationQueue` task.
The queue serializes rapid field mutations and the transition so an older save cannot overwrite the
completed step. Back, refresh and locale changes reuse the same persisted canonical brief.

Completed sessions must contain the required page IDs in canonical order. Collecting sessions may remain
partial, and legacy sessions that predate O-07 remain readable when their earlier shape is valid. Invalid
duplicates, unsupported IDs or missing required pages are rejected at the service/schema boundary.

The complete canonical selection is passed through the existing P3-06 template selection, P3-10 guided
generation and P3-13 review projection boundaries. Review diagnostics distinguish requested pages from
the pages materialized by the current deterministic foundation. O-07 does not create a project,
generate content, approve a review, persist to the project repository, or add a second page/session model.

The UI uses fieldset/legend semantics, keyboard-operable native controls, visible selected state,
screen-reader labels, EN/FI copy and responsive layout compatible with 375, 768, 1024 and 1440 pixel
viewports.

Traceability: SDD §5.3 O-07/§5.3 O-08, §6.1 FR-003–FR-009, §6.2 FR-011–FR-016, §10.5, §12.8,
§14.1, §16.2 and §21.2 AC-001, AC-002, AC-018, AC-019, AC-021, AC-023 and AC-026.
