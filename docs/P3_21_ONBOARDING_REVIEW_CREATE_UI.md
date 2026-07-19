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
keeps the session and review in place, hides internal errors and permits retry.

This slice implements SDD §5.3 O-08/O-09, §6.1 FR-001/FR-004/FR-007–FR-010, §13.5, §14.1,
§15.7 and AC-001, AC-018, AC-021, AC-023, AC-025–AC-027. It preserves ADR-002's controlled
generation boundary, draft/published separation, protected commerce fields, the Vesko shell and the
existing onboarding mutation queue.
