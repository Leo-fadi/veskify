# P3-16 — Merchant generation review panel

## Purpose

`StorefrontGenerationReviewPanel` is a reusable, presentation-only review surface for the
validated `StorefrontGenerationReview` contract. It lets a merchant understand a guided
storefront proposal before the later project-creation flow is connected. The panel does not
generate, mutate, persist, publish, or project storefront data.

## Public API

```ts
type StorefrontGenerationReviewPanelProps = {
  review: StorefrontGenerationReview;
  locale: "en" | "fi";
  busy?: boolean;
  errorMessage?: string | null;
  onBack: () => void;
  onConfirmCreate: () => void;
};
```

The public boundary validates `review` with `validateStorefrontGenerationReview` before any
rendering. `canCreateProject` remains authoritative: the panel never recomputes readiness.

## Review content

The nine canonical sections are rendered in contract order: what we understood, brand direction,
storefront template, storefront pages, storefront languages, catalogue readiness, assumptions,
warnings, and blockers. Internal IDs, fingerprints, provenance, plan IDs, catalogue references,
and component IDs are not shown. Merchant-facing facts and diagnostics retain their canonical
values and exact diagnostic messages; diagnostic context is localized in English or Finnish.

Page summaries show localized page types, paths, and section counts. Language and catalogue
labels are localized with a primary-locale fallback. Empty assumptions, warnings, blockers, and
catalogue states have explicit copy.

## Actions and accessibility

Back and Create storefront project are the only actions. Busy mode disables both actions and
announces the creating label; an unavailable `canCreateProject` state disables Create with a
localized explanation. Supplied creation errors use `role="alert"`. Semantic headings, labelled
sections, visible focus rings, responsive one-column layout, wrapping long values, and reduced
motion support keep the panel usable on keyboard and narrow screens.

## Boundaries and follow-up

The component imports only the canonical review application contract. Project creation, storage,
onboarding, Puck, generation orchestration, and O-09 integration remain outside this task and
must be wired by a later flow without changing this review boundary.

Traceability: SDD §4.1, §4.4, §5.3, §6.1–6.2, §8.1–8.3, §14.1–14.3, §18.1, §21.1–21.3;
FR-009, FR-010, FR-011, FR-013–FR-016, FR-040, FR-053–FR-056, NFR-004, AC-002, AC-013,
AC-018, AC-026, AC-027.
