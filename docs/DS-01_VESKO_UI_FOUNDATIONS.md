# DS-01 — Vesko UI foundations

DS-01 establishes the shared merchant-facing presentation layer for Vesko Storefront Studio.
It implements the P10-01 shell foundation described by the SDD without changing canonical domain,
storage, AI proposal, publishing, history or Puck integration contracts.

## Delivered surface

- Vesko application tokens for the approved evergreen, green, mint, canvas, surface, border, text,
  muted, warning, danger and information colours.
- Shared `Button`, `Card`, `StatusPill`, `Field`, `Tabs`, `Notice`, `Drawer` and `AppShell` primitives
  under `src/components/ui`.
- Vesko global navigation and Storefront Studio module navigation for project workspaces.
- Merchant entry route `/` with Storefront Studio naming and separate setup, editor and preview
  actions.
- Shared shell presentation for onboarding and the project editor, including project context,
  current page, status, Preview, Save draft and Publish actions.
- EN/FI labels for the shared shell and the existing onboarding/editor locale controls.

## Boundary and requirements

The implementation is presentation-only. It consumes existing onboarding save state and editor draft
state; it does not introduce a second persistence path, autosave, proposal store or publication path.
The isolated `/puck-proof` route remains available for development proof but is not linked from the
normal merchant entry surface.

This implementation maps to SDD FR-101, FR-114, FR-115, FR-116 and FR-117; NFR-102, NFR-103 and
NFR-109; acceptance criteria AC-121, AC-122 and AC-123; and roadmap item P10-01.
