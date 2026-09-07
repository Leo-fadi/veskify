# AR-01 implementation report

AR-01 supplies a refactoring baseline; merchant behavior is unchanged. The audit
base is `82e8c3922ccc5a737fec2e18311ff7ab1a69e8ae`, the actual merged main for
AR-00 PR #236. Its reviewed head `3612a888e39783a251815b0a0097d50cdc79e3c0`
is not misidentified as the merge commit. No intervening main changes were present
at preflight. This PR proposes acceptance; AR-01 closure takes effect only upon
explicit owner acceptance/merge. AR-02 remains Planned and unstarted.

## Inventory and limits

The [manifest](AR_01_REFACTOR_MANIFEST.json) contains exactly I01–I36: **21 keep,
10 refactor, 2 isolate, 3 conditional-retire, 0 safe-remove**. Nested targets name
exact files, exported symbols and conservative static reachability. Manual records
connect responsibilities, callers, persisted/string evidence, protected invariants,
successors, regression proof and retirement prerequisites. I33 records already
absent paths; I34 retains all 42 public assets. No deletion is proposed.

The scanner examines 1,263 tracked base paths, including 912 TS/JS files, using the
installed TypeScript parser/resolver and actual tsconfig options/aliases. It records
4,595 import declarations, 303 re-export declarations, 50 side-effect imports,
10 literal dynamic imports, 420 type-only edges, and 6,890 exported-name records
including barrel expansion. Of 4,958 edges, 3,926 resolve locally, 717 to packages,
293 to Node builtins, 21 remain unresolved locally and one externally. The local
unresolved references are generated Next route declarations and stylesheet imports;
the external case is Puck CSS. Two computed dynamic imports remain explicit.

The 58,198 unique-per-file literal-string observations are candidate reference
evidence, not a persisted-record census. Source roles follow value-syntax closure
from named roots; they do not establish executed production paths or bundle size.
Type-only edges are separate; uncertain emit/tree-shaking remains explicit. Next
entrypoints, client/server directives, enclosing import conditions, tests, scripts
and configuration roots are retained in the reconstructible raw graph. No
application module executes during scanning. No secrets or untracked source
package are discovery inputs.

External tenant/storage/publication consumers and merchant databases were
unavailable. Neither a zero local import count nor a legacy name permits retirement.
The conditional-retire rows retain concrete external checks. The inventory is tied
to this audit base; it is not a future source-hash freeze or second registry.

Reconstruct with the recorded manifest command after setting `AR01_EVIDENCE_DIR`
to an external output directory. Run `node scripts/ar-01-inventory.mjs --base
82e8c3922ccc5a737fec2e18311ff7ab1a69e8ae --check
docs/AR_01_REFACTOR_MANIFEST.json` to regenerate/compare exact source facts. Toolchain:
Node 24.18.0, TypeScript 6.0.3, pnpm 10.28.1, Vitest 4.1.10. Raw edges remain external;
checked-in exact target/export records and commands support reconstruction.

## Observed behavior

The predeclared diagnostic command in the [locked contract](governance/task-contracts/AR/AR-01.json)
ran **11 existing files: 101 passed, 0 failed**. The new audit and retained status
matrix ran **3 files: 623 passed, 0 failed**. These are focused suites, not a full
repository or commercial-quality gate.

| Group                 | Executed observation and boundary                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial generation    | Existing server composition tests cover deterministic standalone, mocked configured provider and fail-closed unconfigured integrated ingress. New spies execute real compiler/executor/materializer bodies and observe provider-start → provider-complete → compile → execute → materialize, exactly once. No live provider call.                       |
| Commerce selection    | Existing route-authority cases exercise type/complexity selection, known-type gates, generic unknown-type fallback, route identities and invalid authority rejection.                                                                                                                                                                                   |
| Editor projection     | Existing editor-state cases exercise archetype projection, apply-back and one-composite restrictions; projected pages remain adapter state.                                                                                                                                                                                                             |
| Compact authority     | New characterization starts with migrated compact authority, observes the complete materializer's temporary empty route-page identities, and verifies four route records return unchanged with zero concrete commerce pages and unchanged source/catalogue. This uses reconcile/rematerialize/fold, not a call to the separate legacy expansion helper. |
| Proposal/history/save | Existing lifecycle, history and draft-save cases exercise acceptance/rejection, stale behavior, undo/restore and explicit save persistence.                                                                                                                                                                                                             |
| Publication/preview   | Existing deterministic A09B/A09C tests exercise versioned legacy render/publication replay, artifact identity and renderer targets. Internal project preview resolves local draft/history/publication state; it is not evidence of host public serving.                                                                                                 |

The live reporter measured **52 findings: 16 blocking defects, 29 metadata gaps,
7 deliberate future capabilities, 0 commercial gaps**. All finding IDs/classes and
the report fingerprint are retained in the manifest. Executable
16/29/7 expectations match; old 16/25/1 prose is historical and inaccurate for this
base. Existing conformance defects remain findings for AR-02 metadata separation
and AR-22 enabled-capability quality work; no reporter or product fix is included.

## First bounded handoffs

**AR-02:** edit `src/components/registry/renderer-conformance.ts` and `index.ts`;
add `renderer-observation.ts` and `live-renderer-conformance.ts`. Move live target-map
observation, its exact helpers and live report composition; preserve the deterministic
evaluation entrypoint and compatible public exports. Existing barrel importers need
zero initial changes. Preserve adapted V1 definitions, capability/profile IDs,
fingerprints, report signatures and finding identities. The manifest specifies moved
symbols and shared types. Estimate four production files and 120–180 moved/added
lines, three existing focused test files and at most one boundary test. This is a
preparatory boundary: V2 definitions and PageBlueprint materializer closure still
carry rendering dependencies. The full AR-02 must resolve that closure before
claiming a pure metadata producer. Rollback restores original imports/functions;
no persisted identity changes.

**AR-03:** edit `src/application/dynamic-commerce-routes/authority.ts`; add
`route-errors.ts` and `route-selection.ts`. Extract error class/codes and the full bounded-range, unique-priority, product-complexity
and collection-context matching closure, including both private selectors. Keep
`selectCollectionContextRule` private; export `selectProductComplexityRule` only for
the retained authority `productTypeMappings` caller. Selection imports the error
module to avoid a cycle. Authority explicitly re-exports only existing public names;
the internal selector does not enter the public barrel. Leave the large route resolver,
editor projection, migration and materialization closure for later bounded slices.
Preserve error identity, unknown-type fallback, route/archetype IDs, fingerprints
and one-composite behavior. Estimate three production files, about 145–175 moved/added
lines, three existing focused test files and at most one facade-identity test.
Rollback restores functions to authority without data changes.

The literal write sets are disjoint only under those limits. Shared registry
consumption remains a dependency; **execute AR-02 then AR-03 sequentially** under
separate locked contracts. Neither begins here.

AR-23 questions cover authenticated tenant/permissions; storage transactions/CAS;
durable runs/fencing; canonical routes/visibility/revisions; public release/SEO
serving; asset access/retention; shop action/search contracts; and safe staging
proof. Host answers do not block the local extractions. AR-23 still depends only
on AR-01; no AR-02 or visual gate is added. The manifest maps historical A07/A09A,
A04/A06, P05A and A10C source guards to their real invariants and future replacement
proof. Historical guard bytes are retained; none is weakened to permit refactoring.

## Acceptance record

Exact acceptance commands and evidence links are locked in the native contract.
Current status projections and their existing declaration matrix are narrowly
advanced for proposed merge; existing SDD/tracker DOCX exports use their normal
exporters. Independent verdict, native reconciliation, complete before/after input
identities, final command results and submission metadata are retained with the PR.
They must pass before submission; this report does not pre-approve itself.

No product source, public asset, accepted fixture, original P19/A-10C evidence,
agent configuration, CI, package or lockfile changes. All nine original coordinator
inputs remain untouched. No build, full suite, browser campaign, host access,
publication, merge, successor implementation, rebase or extra review request.
