# AR-03E — Legacy conversion and parent acceptance

The existing `StorefrontSnapshot.dynamicCommercePresentation` remains canonical.
Move the unchanged legacy migration closure into `legacy-migration.ts` and the two
separate transient projections into `legacy-route-projection.ts`. Expansion resolves
non-search route pages; reconciliation creates only matching identity placeholders
for the existing site-map materializer. Preserve their different semantics and the
materializer's later fold through `requireMigratedDynamicCommerceSnapshot`.

Move the existing collection-archetype query into `archetype-presentation.ts`.
The old authority remains explicit compatibility exports with the same public API.
The planner, complete-store materializer and synthesizer use only the named new
owners; unrelated imports and orchestration stay unchanged.

The authorized schema amendment moves both original bridge-content schemas and their
private shared revision schema into `dynamic-commerce-bridge-contract.ts`. The bridge
imports and re-exports those same instances, retaining defaults and renderer bodies.
The authorized D-test amendment changes only the planner's expected migration owner
alongside that import cutover. All nine production paths and line limits remain fixed.

Rejected shortcuts are duplicate schemas, a renderer-backed migration import, using
full expansion as identity reconciliation, relaxed historical guards, changed bundle
limits, or a post-change baseline. Preserve strict parsing, first-error ordering,
clone/alias behavior, matching priorities, compatibility near misses, asset authority,
route/navigation identities and source nonmutation. A coherent extraction/import
revert requires no persisted migration.

Pre-edit observations at base `9ff3f3770c58e7906eb632a0d3dd302bc1ab3716` cover full
route/render, selection/editor, migration/current/expansion/rematerialization and
schema validation results. Original declaration bodies and public exports are pinned.
The initial contract and both scope blockers remain preserved; the owner-authorized
same-base semantic successor governs implementation. Fresh verifier readiness passed
in the original checkout before production edits; active policies remain unchanged.

One coordinator writes, then pauses for independent execution of the final declared
checks, including a fresh production build with unchanged budgets. The verifier must
confirm the complete original AR-03 characterization acceptance before parent closure;
future live synchronization is not implied. AR-02 remains Partial. Standing BATCH-06
authority permits public PR and expected-head protected merge only after all gates,
then safe synchronization and batch closeout. No third task is authorized.
