# AR-03E — Legacy conversion boundary

Legacy migration, generation and storefront rendering preserve their current merchant
behavior while using explicit migration and transient-projection owners. No new
merchant feature, route policy, persisted version or model call is introduced.

`legacy-migration.ts` owns the original 13-declaration migration closure.
`legacy-route-projection.ts` owns full non-search expansion and the separate
identity-only reconciliation closure. The complete-store materializer invokes
reconciliation at its original point and retains its later migration fold. The
planner and synthesizer use only the named narrow imports. The old facade keeps
its 36 public value/type exports; no private helper becomes a barrel export.

The approved schema amendment moves three unchanged declarations into
`dynamic-commerce-bridge-contract.ts`: two bridge-content schemas and their private
shared revision schema. The bridge imports/re-exports the same instances and keeps
its defaults, renderer bodies and public exports. The second amendment changes
only D's planner import expectation to `legacy-migration`, retaining strict import
resolution and every other test byte. Nine production paths remain authorized.

Base is `9ff3f3770c58e7906eb632a0d3dd302bc1ab3716`, the accepted D merge from PR249.
The initial contract, both blocker records and pre-edit evidence remain preserved.
The same-base semantic successor was formatted before pinning; its raw SHA-256 is
`19e4397dec25494d1093711cc5e04325f20944d64efdddef0310abc3aaa40f7a` and canonical
fingerprint is `veskify-task-contract-v1_bdbc906fb285676708e35d6d18ea73e1ab8862d9881ff7b60282bf7e96d9813a`.
Fresh configured verifier readiness confirmed the original checkout, active policy,
explicit build authority and 1,409 unchanged frozen inputs before implementation.

Pre-edit observations cover 22 legacy cases, 13 current-authority cases, 11 complete
reconciliation/rematerialization cases, 52 schema-validation cases, full route/render
and selection/editor results, and complete metadata/conformance output. Earlier
harness fixture/typecheck failures are preserved with their original provenance;
no post-change baseline replaces them. The final declaration comparison preserves
all moved bodies, remaining renderer/materializer bodies and unrelated consumer
statements. Reconciliation uses a separate explicit export so its original function
declaration remains byte-equivalent in the AST comparison.

Implementer validation passed 1,564 test executions: 259 focused, 62 integration,
1,232 source/status guards, four selected inventory tests, two historical replays,
four complete observations and one metadata observation. Two existing inventory
cases remain unselected. All 15 new E tests also passed after a lint-only callback
fix. The status fixture now rejects removing the tracker’s conditional AR-03 closure;
its stale-fixture failures and every earlier failed check remain preserved.
Typecheck, strict harness typecheck, focused lint/format, documentation checks and
both deterministic exports pass. AST/public API and complete observation parity pass.
Final independent/native verification remains a separate submission gate, retained
externally against the exact final diff.

The first candidate production build and unchanged budget checker passed. Measurements
are from that recorded export, before final report/test-fixture edits; production
bytes are identical to the final candidate. This is separation, not a bundle optimization.

| Route           | Raw bytes | Gzip bytes | Raw headroom | Gzip headroom |
| --------------- | --------: | ---------: | -----------: | ------------: |
| home            | 1,594,629 |    431,580 |        5,371 |        18,420 |
| content-utility | 1,594,629 |    431,580 |        5,371 |        18,420 |
| search          | 1,652,993 |    450,215 |        2,007 |        24,785 |
| collection      | 1,645,286 |    447,455 |        4,714 |        27,545 |
| product         | 1,645,796 |    447,584 |        4,204 |        27,416 |
| editor          | 2,801,608 |    757,092 |       48,392 |        67,908 |

The [parent map](AR_03_BOUNDARY_ACCEPTANCE.md) distinguishes preserved T01/T06/T07
characterization from future live canonical-sync outcomes. AR-03 closure is conditional
on independent confirmation of its complete original acceptance and E's verified
merge. AR-02 remains Partial: planner `getComponentDefinition` and other registry/
legacy bridge metadata imports remain renderer-reachable. Full-store materializer
and synthesizer execution is intentional; deterministic `profile-materializer.ts`
is a valid metadata owner. AR-04/05 depend on AR-02/03, and AR-06 on AR-05; no successor
implementation starts here. AR-23 remains eligible and unstarted.

All bundle ceilings and the measurement algorithm remain unchanged, including search
at 1,655,000 raw / 475,000 gzip bytes. A comparable retained independent D build avoids
a completed-task rerun; a fresh E candidate and independent final build are required.
The nine-file and 1,167-production-addition soft overruns are disclosed and within
the authorized scope and unchanged hard ceilings; moved code counts normally. Original inputs, historical hashes/archives/
transitions and previous evidence remain unchanged. No rebase, second automatic review
request, new workspace, unrelated work, deployment or third task is authorized.
