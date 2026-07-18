# P3-12 — O-05 visual direction

O-05 is the optional, merchant-facing visual direction step in the onboarding brief. It is a controlled input surface: it stores canonical design-brief values and never creates a second visual-direction model, assets, catalogue records, or storefront pages.

## Stored fields

The step writes only these existing `StorefrontDesignBrief` fields:

- `brandDirection.visualStyleDirection`
- `brandDirection.typographyDirection`
- `brandDirection.imageryDirection`
- `brandDirection.toneKeywords`
- `generationPreferences.visualDensity`
- `generationPreferences.contentEmphasis`
- `generationPreferences.merchandisingEmphasis`
- `generationPreferences.sectionRichness`
- `generationPreferences.accessibilityPreference`

Visual style is required to complete O-05. The controlled styles are minimal, editorial, luxury, playful, bold, and natural. The §8.3 guided choices persist these exact canonical values:

- tone: elegant, modern, warm, bold, minimal, playful, technical;
- imagery: studio, lifestyle, editorial, product-focused, mixed;
- typography: serif-led, sans-led, mixed, strong, soft;
- visual density: airy, balanced, compact;
- promotion prominence: subtle, balanced, campaign-led, stored in the existing `generationPreferences.merchandisingEmphasis` field.

Typography and imagery have a `Recommended` choice represented by `null`, so the deterministic planners retain ownership of those recommendations. Tone keywords are localized in the form, limited to six selections, normalized, deduplicated, and persisted in canonical vocabulary order. There is no free-text tone field and no compatibility alias for the superseded local/demo values.

Generation preferences use the existing brief enums and balanced/standard defaults. High contrast is a preference for the later brand planner; it may adjust unsafe colours to preserve readable text.

## Transitions and persistence

The existing wizard-level `OnboardingMutationQueue` serializes every O-05 field save and transition. Continue validates the style, applies the complete O-05 draft to the brief, marks O-05 completed, removes a stale skip marker, and advances to O-06 Catalogue in one repository commit. Skip clears only the O-05-owned brand fields, resets the O-05 generation preferences to balanced/standard defaults, marks O-05 skipped, removes completion, and advances to O-06 in one repository commit. A queued field save that reaches the service after a transition cannot overwrite the transition because the service validates the active step.

Going back leaves a collecting partial draft available for editing. Refresh and resume use the persisted brief values. A corrupt or stale stored session is handled by the existing onboarding recovery path.

The session schema enforces these lifecycle rules:

- completed O-05 requires a non-null visual style and cannot also be skipped;
- skipped O-05 requires null style/typography/imagery, no tone keywords, and balanced/standard generation preferences;
- collecting O-05 may be partial.

## Planner boundary

O-05 feeds the public deterministic `planBrandFoundation` (P3-05) and `planStorefrontTemplateSelection` (P3-06) contracts. Explicit style, tone, preference, accessibility, typography, and imagery choices are passed through those contracts. Null typography or imagery deliberately preserves planner-owned preset recommendations. The O-05 step does not select a template, generate copy or assets, read a catalogue, create a project, or publish anything.

## Accessibility and localization

The form uses fieldsets and legends, visible selected/focus states, radio and button semantics, error associations, keyboard-removable tone chips, and responsive grids that do not introduce horizontal overflow. Labels, explanations, validation messages, and preference choices are available in English and Finnish.

## Specification traceability

This slice implements the existing visual-direction and guided onboarding contracts in `docs/VESKIFY_SDD.md`: §§4.1, 4.4, 5.3, 6.1 (FR-003, FR-004, FR-007), 8.1–8.3, 14.1–14.3, 15.5, 16.2/16.4, 18.1, 21.1–21.3 and acceptance criteria AC-001, AC-002, AC-012, AC-013, and AC-018. It also follows ADR-002 §§3.2–3.5 and 8.1 and the P3-05/P3-06 planner contracts.
