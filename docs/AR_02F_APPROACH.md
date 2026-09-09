# AR-02F implementation approach

This is BATCH-03 child 3 of 3 in the original `/Users/leo/veskify` checkout, branch
`codex/ar-02f-v2-metadata-adaptation`, based on accepted PR #243 merge
`d9647c84523c6b26d10cf025dcfccbed541c3c7d`. The owner’s retained autonomous
continuation grants conditional submission/merge authority for this child and batch closeout.
Independent/native verification, one automatic review and final-head/base CI remain separate gates.

## Native approach and authority

Replace only the legacy-registry import/input in v2-registry.ts with direct accepted homepage, hero, collection, product and utility metadata imports. Assemble local adapter input in original effective order, excluding native home types by homepageCommerceDefinitions.some; omit dynamic bridge imports because the original expression excluded them. Keep the existing adaptV1ComponentRegistryToV2 call/algorithm, adapted prefix, native suffix references/order and createComponentRegistryV2 validation composition unchanged.

Existing shared ComponentMetadata declarations and ComponentDefinitionV2 registry remain sole authority. The unchanged native V1-to-V2 adapter materializes canonical V2 definitions; metadata is not another executable registry.

## Current consumers

- Existing v2-registry definitions/instance registry consumed by homepage/content-support bridges, dynamic storefront renderers, capability manifest, renderer observation and live conformance.
- Existing application generation/runtime authorities and stored snapshot/publication replay consumers of the same V2 public API.

## Rejected shortcuts

- Importing legacy renderers and filtering after import; duplicating a global metadata registry or generated JSON snapshot.
- Copying native homepage type IDs, changing adapter semantics or dropping stored versions/dynamic native validation to simplify composition.
- Changing utility profiles/template materializers or source locks, masking unresolved edges, broadening type assertions or adding a second traversal helper.

## Failure behavior and rollback

Unknown component/version, malformed content/props and protected bindings keep existing rejection. Any definition/order/fingerprint, replay/render, callback identity or baseline discrepancy blocks submission. Unresolved/renderer-bearing V2 closure outside sole allowed edit is a blocker. Rollback restores the prior legacy import/expression without persisted changes.

## Preflight and evidence

Pre-edit attempt04 captures 18 adapted definitions, all 29 V2 definitions, 112 EN/FI
renders, 29 manifest entries, 53 profiles, 33 registrations/52 findings, two valid
instances and nine explicit rejection cases. The complete 3,064,032-byte baseline
has SHA-256 `1bd4a769de736691c1a8bd06e7d471926126f9cb9f3bba3db8b44434d66f4fe6`.
Earlier incomplete scratch captures remain preserved and are not acceptance evidence.
The existing closure resolver finds only Zod outside the eleven proposed/remaining
dependency roots; final proof must resolve the entire changed V2 root.

The immutable contract names 21 focused test files, including actual A09B historical
and A09C publication render replay, native dynamic/homepage/content-support rendering,
accepted metadata boundaries, manifest/conformance, instance validation and the status guard.
Run the unchanged complete observer plus integrity, typecheck, focused lint/formatting,
documentation and deterministic exports. Do not run a local full suite, build, browser
campaign, provider call or deployment. Pause writers before fresh independent verification.

## Scope and remaining boundaries

Only `src/components/registry/v2-registry.ts` changes in production. Seventeen literal
task paths include the new test, contract/approach/report, current status projections
and two existing generated DOCX exports. No shared adapter, metadata owner, runtime
renderer, barrel, source lock or accepted fixture changes. Preserve the nine original
untracked inputs, all earlier branches/worktrees/contracts and evidence.

The V2 leaf becomes renderer-free; capability-manifest’s utility-profile/template path
and the intentional live conformance wrapper still render. AR-02/AR-03 remain Partial
and AR-23 remains independently eligible/unstarted. F selects no fourth child. Native
`nextTask` records delivery closeout only. Record standing owner authority with the
exact verified head immediately before an expected-head protected merge, without an
override or another routine approval request. Then synchronize and stop.

Unresolved architecture conflicts: none identified in bounded preflight.
