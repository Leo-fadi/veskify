# P3-13 — Deterministic storefront generation review projection

## Ownership and outcome

`src/application/storefront-generation-review` is a React-, Puck-, provider- and persistence-
independent projection boundary. It converts a validated P3-10 `GuidedStorefrontGenerationPlan`
into one immutable `StorefrontGenerationReview` for the later O-09 review screen. It does not rerun
brand planning, template scoring, materialization, project creation or persistence.

## Input and output

`createStorefrontGenerationReview` first validates the supplied guided plan with
`validateGuidedStorefrontGenerationPlan`. A canonical brief may be supplied alongside the plan (as
`{ guidedGenerationPlan, brief }` or as the second argument) so merchant business and language
values remain exact. The review contains a versioned deterministic ID, localized EN/FI title and
summary, fixed review sections, page summaries, language and catalogue facts, source diagnostics,
assumptions, warnings, blockers and provenance.

The review carries the P3-10 full `briefFingerprint` as focused provenance. When a canonical brief is
supplied to the factory, its full validated fingerprint must match; same-ID edited briefs are rejected
instead of being projected over an older generation.

## Fixed sections and localization

Sections are always ordered: business, brand-foundation, storefront-template, storefront-pages,
languages, catalogue, assumptions, warnings, blockers. System headings and summaries carry both EN
and FI forms. Merchant-entered business values are copied exactly and are never translated or
rewritten. Brand and template facts come from the real P3-05/P3-06 outputs; page facts come directly
from the canonical P3-08 snapshot.

## Diagnostics and readiness

Every projected diagnostic preserves its original stage, stable code, severity, message and plan ID,
with a separate localized stage context. Stage order remains P3-05, P3-06, P3-08. Assumptions do
not create warnings. Warnings preserve `ready-with-warnings`; blockers preserve `blocked`.
`canCreateProject` is true only for a valid non-blocked plan with a generated snapshot, all required
home/collection/product pages and no blocker diagnostics.

Blocked plans remain reviewable: completed stage sections remain visible, not-run stages are shown as
not applicable, page summaries stay empty when no snapshot exists, and project creation remains
disabled. No placeholder page or commerce data is invented.

The materialization stage status is projected explicitly. A not-run materialization produces a
not-applicable pages section without diagnostics or fabricated facts. An executed materialization
without a snapshot produces a blocked pages section tied only to its own diagnostics.

## Consistency and immutability

The contract independently validates fixed section order, diagnostic counts, page count reconciliation,
page-free blocked reviews, and the `canCreateProject` rule. The factory validates the source plan and
rejects impossible source relationships. Review IDs hash the schema version, guided plan ID, status
and stage-plan IDs. Returned values are detached and deeply frozen.

## Deferred boundaries

O-09 UI, onboarding state, Project/ProjectRepository, IndexedDB/storage, editor/Puck handoff, draft
save, publishing, history, proposals, providers, catalogue ingestion and commerce remain outside
this projection.

## Specification traceability

This boundary fulfils SDD §4.1 guided creation and review handoff; §6.2 FR-009, FR-010, FR-011,
FR-013–FR-016, FR-040, FR-053–FR-056; §12.8 validation/application pipeline; §15.3–§15.5
snapshot, page/section and BrandSystem contracts; §16.2/§16.5 architecture and renderer boundaries;
§17.1 application services; and §21.2 AC-001, AC-002, AC-013, AC-016, AC-023–AC-026.
