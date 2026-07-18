# P3-15 — Approved-generation Initial ProjectAggregate factory

## Ownership and public contract

`src/application/initial-project-aggregate` owns the pure handoff from an explicitly approved guided
generation result to a complete canonical `ProjectAggregate`. The public function is:

```ts
createInitialProjectAggregate({
  guidedGenerationPlan,
  review,
  brief,
  catalogue,
  mode,
  publishedSnapshotId,
}): ProjectAggregate;
```

The inputs are the P3-10 `GuidedStorefrontGenerationPlan`, its exact P3-13
`StorefrontGenerationReview`, the canonical `StorefrontDesignBrief` used for that run, a complete
caller-supplied `CatalogueDisplayModel`, the explicit `merchant` or `salesDemo` mode, and an explicit
ID for the synchronized initial published baseline. The factory does not run generation or review
projection and does not persist the result. Its output is ready for `ProjectRepository.create`.

## Approval and source consistency

Every boundary is validated independently through the existing canonical validators. Creation is
allowed only for `ready` or `ready-with-warnings` generation and review states where the generated
snapshot exists, the review permits project creation, blocker diagnostics are absent, materialization
was executed, and home, collection and product summaries are present.

The factory then verifies the complete handoff correlation: plan/review IDs and status, brief IDs and
full `createStorefrontDesignBriefFingerprint` values, generated snapshot identity, project identity,
catalogue reference, explicit `createdAt`, P3-05 BrandSystem, P3-05/P3-06/P3-08 stage-plan IDs,
selected preset/template IDs, stage statuses, source diagnostics, assumptions, language and catalogue
context provenance, and page summaries computed from the generated snapshot. These checks compare
existing results; they do not rerun brand planning, template selection, materialization or the P3-13
projection.

Failures use `InitialProjectAggregateError` with stable codes:

- `invalid-input` for malformed plan, review, brief or explicit scalar input;
- `project-creation-not-allowed` for blocked or incomplete approval state;
- `inconsistent-generation-source` for valid inputs that do not belong to the same generation run;
- `invalid-project-aggregate` for an invalid catalogue, registered storefront composition or final
  aggregate.

## Deterministic project mapping

The project ID and revision-zero timestamps come from P3-10. Name and business profile values come
unchanged from the canonical brief. The only source reference is the normalized existing-storefront
URL when one exists. Locale order is preserved exactly, and null primary or empty enabled language
choices are rejected.

Industry mapping is fixed:

- `jewellery` and `watches` become project industry `jewellery`;
- `fashion` becomes `fashion`;
- every other supported brief industry becomes `generic`.

The supplied mode is validated against the canonical `Project` schema. No fallback mode, locale,
industry, identity or timestamp is invented.

## Initial synchronized snapshots

The returned aggregate contains exactly two snapshots in deterministic order:

1. the initial published baseline using the explicit `publishedSnapshotId`, revision `0`, P3-10
   `createdAt`, and `createdBy: "system"`;
2. the exact P3-10 generated snapshot as the active draft, preserving its ID, revision `0`,
   `createdBy: "agent"`, BrandSystem, navigation, pages, catalogue reference and timestamp.

The IDs must differ. The two records have canonically equal storefront content. This represents the
clean state after the merchant approved guided creation; it is not a publish operation. The factory
does not call `publish`, and it returns no `snapshotHistoryMetadata`. Consequently an immediate
repository publish reports `NoStorefrontChangesError`, while a later genuinely changed saved draft
uses the normal publish workflow and history policy.

## Catalogue and registered-component boundary

The caller supplies the complete canonical catalogue. The factory validates its exact ID and validates
both snapshots through the registered-component boundary with that catalogue, so product and
collection references must resolve. It never selects, fetches, imports, builds, enriches or mutates
catalogue records. Prices, SKU, stock and other protected commerce values pass through unchanged.
The brief catalogue context remains planning provenance only.

## Immutability, repository handoff and exclusions

The aggregate is validated through `validateProjectAggregate`, detached from all inputs and deeply
frozen. Canonically equal detached inputs produce equal results. The in-memory and IndexedDB
repositories accept the result atomically and return detached values; IndexedDB reopening preserves
the same aggregate without fabricated history.

The adapter integration exposed and fixes one genuine existing repository helper defect: a compact
project-scoped snapshot ID could truncate a project fragment immediately after `-` or `_` and then
append another separator. The helper now removes a trailing separator from only that compact fragment,
preserving deterministic global identity while keeping the canonical ID format valid.

This milestone does not modify onboarding UI/session/services, run generation or review projection,
resolve catalogue context, import products, create routes, navigate to the editor, save or publish a
draft, create history, or call AI/image/network/browser APIs.

## Specification traceability

This boundary implements the approved project-construction handoff described by SDD §4.1,
§13.1–§13.6, §15.1–§15.5, §16.2–§16.5, and §17.1/§17.4. It supports FR-001, FR-009, FR-041,
FR-042, FR-044, FR-045, FR-050 and FR-053–FR-056; NFR-006; and AC-001, AC-021, AC-023,
AC-025, AC-026 and AC-027. It introduces no new requirement or acceptance-criterion identifiers.
