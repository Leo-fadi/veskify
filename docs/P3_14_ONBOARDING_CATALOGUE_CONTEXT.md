# P3-14 — O-06 catalogue context

O-06 is the optional catalogue-context choice in the guided onboarding brief. It records how the later deterministic storefront planner should treat catalogue information. It does not import, upload, fetch, parse, enrich, create, or persist product data.

## Canonical contract

The existing `StorefrontDesignBrief.catalogueContext` field is the single source of truth. Its only accepted values are:

- `existing-vesko-catalogue` — use the merchant's existing Vesko catalogue context;
- `controlled-demo-catalogue` — use the controlled demo catalogue context in the later planner;
- `empty-catalogue` — design the storefront without a supplied catalogue context for now.

The onboarding UI renders these values as accessible radio cards with plain English and Finnish labels and explanations. It never displays schema names as merchant-facing copy. No aliases or second catalogue model are retained.

## Lifecycle and persistence

While O-06 is active, changing a radio card updates the canonical brief field through the existing wizard-level `OnboardingMutationQueue`. A field save clears stale O-06 completed/skipped markers and commits one updated `OnboardingSession`.

Continue requires one of the three canonical values. It validates the value, writes the brief, marks `catalogue` completed, removes a stale skip marker, changes the active step to `pages`, and saves the session once. The typed `CATALOGUE_CONTEXT_REQUIRED` error keeps the step active when no value is selected; unsupported values use `CATALOGUE_CONTEXT_UNSUPPORTED`.

Skip is an explicit O-06 transition. It writes `empty-catalogue`, marks `catalogue` skipped, removes completion, advances to `pages`, and saves once. Therefore a skipped O-06 session still has the intentional empty context, while completed and skipped lifecycle markers cannot coexist.

Going back leaves a partial collecting value available for editing. Refresh/resume restores the persisted canonical value. A queued field mutation that arrives after Continue or Skip is rejected by the active-step guard and cannot overwrite the transition.

The persisted-session loading boundary also contains a narrow same-version compatibility backfill for
the pre-P3-14 schema-v2 shape: only a session whose skipped steps include `catalogue` and whose
catalogue context is exactly `null` receives `empty-catalogue` before strict validation. All other
schema-v2 values, including completed-with-null and skipped-with-a-non-empty context, remain subject
to the strict invariant and enter the existing corrupt-session recovery path when invalid. Canonical
sessions are not rewritten.

## Session invariants

The existing schema version remains unchanged. In addition to the shared lifecycle rules, the session validator requires:

- completed O-06 has a non-null canonical catalogue context;
- skipped O-06 has `empty-catalogue`;
- completed and skipped O-06 cannot both be present;
- collecting O-06 may have a null or canonical context.

Invalid stored sessions continue through the existing corrupt-session recovery flow rather than bypassing O-06.

## Downstream boundary

O-06 supplies only the canonical context to the public P3-05/P3-06 deterministic planner contracts. The planners map existing Vesko, controlled demo, and empty contexts deterministically and include the context in the brief fingerprint. Product records, prices, stock, uploads, and catalogue persistence remain outside this onboarding step. For an empty catalogue, the later planner may provide controlled industry sample data as specified by the existing readiness warning; O-06 itself does not create it.

## Accessibility and localization

The choice group uses a semantic `fieldset`/`legend`, native radios, visible focus and selected states, keyboard activation, associated validation messaging, and responsive cards without horizontal overflow. All labels, descriptions, help text, and errors are available in English and Finnish.

## Specification traceability

This implementation follows `docs/VESKIFY_SDD.md` §§4.1, 4.4, 5.3, 6.1 (FR-003, FR-004, FR-006, FR-007, FR-010), 11.2, 14.1, 18.1, 21.1 and acceptance criteria AC-001, AC-002, AC-013, and AC-018. It reuses the canonical brief schema, onboarding session, mutation queue, repository, and P3-05/P3-06 planner boundaries.
