# P3-UI-01 — Vesko application shell and onboarding exit

## Visual system

The application-level Vesko tokens live in `src/app/globals.css` under the `--vesko-*` namespace.
They define primary and navigation greens, pale active surfaces, neutral backgrounds and borders,
text, danger and warning colours, the neutral UI font stack, radii, shadows, and focus rings. These
tokens remain separate from storefront `--brand-*` values so a merchant storefront keeps its own
BrandSystem.

The onboarding route applies the Vesko tokens through its scoped shell. It uses the official supplied
green-on-white logo unchanged in a white logo plate on the dark-green top bar. The image keeps its
original aspect ratio and has the accessible name “Vesko”.

## Shell structure

The compact top bar contains the Vesko logo, localized Storefront setup context, current save state,
Back to dashboard navigation, and the primary Save & exit action. The onboarding introduction,
locale choice, progress, step content, and existing Back, Continue, Skip, and restart controls remain
inside the focused content area. On narrow screens the actions wrap into touch-sized rows without a
sidebar or horizontal overflow.

## Persistence and navigation

All onboarding writes continue through `OnboardingService` and the existing
`OnboardingMutationQueue`. Save & exit and Back to dashboard enqueue a final validated session save
behind pending field and step mutations. Navigation to `/` occurs only after that repository write
succeeds. A ref guard and disabled controls prevent repeated activation while pending. Storage
failure keeps the merchant on the route and exposes an accessible error; it never reports success
early. Returning to `/projects/new` resumes the same stored session.

The shell projects the existing lifecycle as Saved / Saving… / Save failed in English and
Tallennettu / Tallennetaan… / Tallennus epäonnistui in Finnish. This is UI state only, not a second
persistence state machine.

## Accessibility

The dashboard destination uses link semantics and Save & exit uses button semantics. Both support
keyboard activation, visible Vesko-compatible focus rings, pending states, and practical touch
targets. Save state is announced politely and exit failures use `role="alert"`. The existing logical
heading order and step semantics are preserved, with responsive coverage at 375, 768, 1024, and
1440 pixels.

## Exclusions

This milestone does not change generation review contracts or projection, project creation,
catalogue semantics, publishing, editor or Puck behavior, history, commerce records, or IndexedDB
schemas. It does not add the full ROS navigation sidebar.

Traceability: SDD §4.1, §4.4, §5.1, §5.3, §6.1, §21.1–21.2; FR-001–FR-005, FR-007, AC-002,
AC-013, AC-018, AC-019.
