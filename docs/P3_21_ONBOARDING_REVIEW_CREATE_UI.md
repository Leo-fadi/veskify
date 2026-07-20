# P3-21 — O-09 review, project creation confirmation and editor entry

P3-21 completes the `/projects/new` onboarding journey by connecting O-08 to the canonical O-09
generation review and the approved storefront-project creation orchestration.

The route uses the P3-19 language application contract to persist EN/FI storefront choices. On
O-09 it deterministically projects the persisted canonical design brief through the existing guided
generation and generation-review boundaries. Preparing, entering or restoring the review is
side-effect free and does not create a Project, snapshot or history entry.

The merchant must explicitly activate **Create storefront project**. The canonical review's
`canCreateProject` value controls availability; the React route does not reproduce its blocker,
required-page, language or snapshot rules. Confirmation is guarded against repeated activation,
shows a localized pending state, waits for `ProjectRepository.create` through the existing P3-20
approved-project orchestration, and navigates with the returned `editorRoute`. A failed creation
keeps the session and review in place, hides internal errors and permits retry. A successful
creation completes and clears the resumable onboarding session before navigation; if cleanup fails,
retry reuses the already-created result without creating a second Project.

The catalogue aggregate follows the selected plan: explicit demo selection uses the controlled Aurum
seed, empty selection uses a canonical zero-product catalogue and omits catalogue-dependent sections
from the initial materialization, and an existing Vesko catalogue is blocked until its reference can
be resolved by a canonical catalogue boundary.

This slice implements SDD §5.3 O-08/O-09, §6.1 FR-001/FR-004/FR-007–FR-010, §13.5, §14.1,
§15.7 and AC-001, AC-018, AC-021, AC-023, AC-025–AC-027. It preserves ADR-002's controlled
generation boundary, draft/published separation, protected commerce fields, the Vesko shell and the
existing onboarding mutation queue.

## P3-UI-02 merchant review presentation

The O-09 presentation maps canonical facts and diagnostics into concise EN/FI merchant copy without
changing the review projection or creation eligibility. Repeated diagnostics use a deterministic
presentation identity based on canonical code and message, so the same issue reported by multiple
generation stages appears once while distinct blockers and fallback issues remain visible.

The review presents blockers, warnings and compact informational notes in that order. A readiness
summary reports their presentation counts from the canonical review, unresolved blockers provide a
keyboard-focus target, completed plan sections use native disclosure controls, and the creation
actions remain available in a sticky footer. Brand-direction tokens are rendered as plain-language
labels, and internal template, capability, slot and context identifiers remain confined to canonical
data and tests.

This presentation polish implements SDD §5.3 O-09, FR-008, FR-055, FR-056, NFR-004, NFR-010,
AC-018, AC-026 and AC-027. It does not alter generation, catalogue resolution, persistence, duplicate
prevention, project creation or the returned editor route.
