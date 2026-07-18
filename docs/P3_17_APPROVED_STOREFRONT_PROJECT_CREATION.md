# P3-17 — Approved storefront project creation

P3-17 is the application boundary between an approved guided-generation review and
the first persisted `ProjectAggregate`. It is intentionally independent of React,
Next.js, Puck, onboarding, IndexedDB adapters, publishing, and commerce services.

## Public contract

`createApprovedStorefrontProject` accepts the typed P3-10 guided-generation plan,
the submitted P3-13 `StorefrontGenerationReview`, the canonical
`StorefrontDesignBrief`, a validated catalogue display model, project creation mode,
an explicit published-baseline snapshot ID, and a `ProjectRepository` interface.
It returns a detached result containing `projectId`, `draftSnapshotId`, and
`publishedSnapshotId`.

## Orchestration sequence

1. Validate the plan, review, brief, catalogue, scalar IDs, mode, and repository
   dependency through their existing contracts.
2. Recompute the P3-13 review projection and compare its canonical serialization
   with the submitted review.
3. Require the exact review to have `canCreateProject === true`.
4. Call the P3-15 `createInitialProjectAggregate` factory.
5. Call `ProjectRepository.create` once with the factory result.
6. Return only detached identity values. The operation never calls `publish`.

The repository adapter is the transaction boundary. Its create implementations
validate the complete aggregate, check project/catalogue/snapshot identities before
writing, and commit the aggregate atomically. Rejected validation and review paths
call the repository zero times.

## Error mapping

The stable `ApprovedStorefrontProjectError` codes are:

- `invalid-input`
- `inconsistent-generation-review`
- `review-not-ready`
- `aggregate-construction-failed`
- `project-identity-conflict`
- `catalogue-identity-conflict`
- `snapshot-identity-conflict`
- `repository-failure`

P3-15 factory errors are mapped without replacing its validation. Existing typed
repository identity conflicts remain visible as application-level conflict codes;
other repository failures are reported as `repository-failure`.

## Duplicate approval and exclusions

Repeated approval is safe but not silently idempotent: the first create succeeds and
a repeated call with an existing identity returns the corresponding typed identity
conflict. Existing projects are never overwritten, replaced, or deleted, and no
second aggregate is created under the same identities.

This operation does not publish, mutate a draft, persist onboarding state, call a
concrete storage adapter, render UI, or alter commerce data.

## Traceability

The boundary implements the deferred project-creation handoff in SDD §§4.1, 6.1
(FR-001, FR-009, FR-010), 6.2 (FR-041–FR-045 and FR-050–FR-056), 7.3–7.4, and
13.1–13.6. It satisfies AC-001, AC-021, AC-023, AC-025–AC-027 and NFR-006 while
reusing the P3-10, P3-13, P3-15, and P3-11 contracts.
