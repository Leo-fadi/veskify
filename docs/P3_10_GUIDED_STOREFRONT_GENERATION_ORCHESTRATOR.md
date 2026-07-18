# P3-10 — Deterministic guided storefront generation orchestrator

## Ownership and merchant outcome

`src/application/guided-storefront-generation` is a React-, Puck-, provider- and persistence-
independent application boundary. It gives a later onboarding review step one immutable result
containing the proposed brand foundation, selected template, initial in-memory snapshot, assumptions,
warnings, blockers and stage-labelled diagnostics. It does not create or persist a Project.

## Input and output

`generateGuidedStorefront` accepts a validated `StorefrontDesignBrief`, explicit `projectId`,
`snapshotId`, `catalogueRef` and `createdAt`, plus an optional `preferredTemplateId`. No clock,
randomness, browser, network, catalogue or provider call is used.

The versioned `GuidedStorefrontGenerationPlan` contains the input correlation values, P3-05 brand
plan, P3-06 selection plan when executed, P3-08 generation plan when executed, top-level snapshot,
stage diagnostics, aggregated diagnostics, assumptions, warnings, blockers and provenance. Plans are
serializable, detached and deeply immutable.

## Fixed stage order and failure policy

The orchestrator calls the existing public APIs in one fixed sequence:

1. `planBrandFoundation`
2. `planStorefrontTemplateSelection` with the normal merchant override, if supplied
3. `materializeInitialStorefront` with the exact P3-05 BrandSystem and same-call P3-06 plan

If brand foundation or template selection is blocked, later stages are explicitly `not-run`. If
materialization is blocked, no top-level snapshot is returned. Normal merchant blockers remain
structured blocked results; invalid input and impossible cross-stage corruption use the typed
`GuidedStorefrontGenerationError`. Unexpected programming errors are not disguised as merchant
diagnostics.

## Diagnostics and status

Every diagnostic retains its source stage, original stable code, message, severity and originating
plan ID. Aggregation follows brand-foundation, template-selection, storefront-materialization order
and removes only exact duplicates from the same stage/code/message. Status is `blocked` for any
blocker, `ready-with-warnings` for a successful snapshot with warnings, and `ready` otherwise.
Assumptions alone do not create warnings.

## Consistency and determinism

The boundary verifies matching brief IDs, the P3-06 fingerprint, the P3-08 selection-plan ID and
selected template, the P3-05 BrandSystem, and snapshot project/snapshot/catalogue/timestamp
metadata. The orchestration ID is a stable hash of canonical input and stage-plan IDs. Identical
explicit input yields identical stage plans, snapshot and orchestration ID; explicit identifiers and
createdAt remain caller-controlled.

## Catalogue and language boundaries

Only `catalogueRef` and the brief catalogue context cross this boundary. No catalogue records,
products, collections, prices, stock, SKUs, variants or live Vesko data are loaded or invented.
P3-06 and P3-08 warnings are preserved. Existing EN/FI explanations and primary-locale content are
returned unchanged; the orchestrator does not translate or invent merchant copy.

## Deferred handoff

Project creation, repository/storage, onboarding state, editor/Puck handoff, draft save, publishing,
history, proposals, provider adapters and catalogue ingestion remain later boundaries. A future
onboarding review may inspect this result and explicitly hand the validated snapshot to project
creation.

P3-13 projects this result into a localized merchant-readable `StorefrontGenerationReview` without
rerunning any generation stage.

## Specification traceability

This boundary fulfils SDD §4.1 guided new-store generation, §6.2 FR-009, FR-010, FR-011, FR-013–
FR-016, FR-040 and FR-051–FR-054; §9.1 registered component contracts; §12.8 validation and
application pipeline; §15.3–§15.5 snapshot, page/section and BrandSystem schemas; §16.2 and §16.5
architecture/renderer boundaries; §17.1 application services; and §21.2 AC-001, AC-002, AC-013,
AC-016 and AC-023–AC-024.
