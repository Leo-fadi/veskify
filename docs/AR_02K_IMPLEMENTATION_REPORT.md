# AR-02K implementation report

K separates actual governed-package capability queries and commercial grammar
metadata consumption without changing merchant behavior. The original checkout uses
`codex/ar-02k-skill-capability-boundary`, based on accepted J merge
`7cfc23ed1ca3a9b76df9127818ee30bd02f79ada`. Four production paths change: the
capability facade, its new core, governed packages and commercial grammar.

The core retains exact query/error/type/factory/singleton declarations and the
existing inventory projection. The facade preserves every original export and the
actual no-argument executable registry, forwarding supplied registries unchanged.
Actual governed packages use the core and defining direction-schema contract;
package and grammar nonimport declarations are identical to the base. Grammar keeps
full materialization fingerprint/current-slot, inheritance and compatibility checks.

The initial contract's bookkeeping clause had an incorrect branch suffix. The
configured verifier blocked readiness before implementation. The owner authorized
one semantic reissue changing only `/noTouchAreas/6`; branch/base, Git configuration
and every other parsed value remain unchanged. Original contract, lock, fingerprint
and blocker are retained. Active raw identity is
`b5b570f5c3a039fee6af682e3df6613c2b8e92e43c4f5a22fa378c6195ece1c8`;
canonical identity is
`veskify-task-contract-v1_f5648c4fdf88431bdccd08bb2a51d01e7f7f81fd2bcc46dae152f180175b7a46`.
Readiness was reconfirmed against this contract. Earlier evidence retains its actual
provenance.

Pre-edit observations contain 8,870 complete capability, package, grammar, inventory
and error cases; the final output is byte-identical. The published 324-line helper
exceeds the soft 250-line target to retain complete cases without a private-file
runtime dependency; its lines count normally. No current-owner assertion maintenance
was needed in existing tests. Three pure runtime roots and installed Zod closure
checks pass. The real default inventory remains a mixed root with an explicit
facade-to-default-registry-to-component-validation chain and actual call evidence.

The first selected behavior run passed 385 tests and exposed one new-test mistake:
the pure-closure helper cannot resolve CSS in the deliberately mixed facade. The
corrected test strictly checks the actual import chain and default/custom registry
calls, retaining all three pure-root checks. All 10 new tests then passed; the 376
unchanged tests were not rerun for that correction. Typecheck, lint and exact declaration comparison pass. Cross-boundary checks pass
896 tests, integrations 24, retained inventory four (two existing cases unselected),
A-09B/C replays two, and full observation parity one: 1,313 selected tests in total
with the corrected 386-test behavior group. A type-only error-code annotation fixed
a helper lint finding without changing its transpiled runtime AST. Requirements,
tooling and deterministic exports pass. The first independent attempt ran all 17
commands successfully (1,313 tests); its only failed criterion was the unsupported
parent-closure documentation. One consolidated status correction keeps AR-02 Partial;
the original FAIL, complete diff and all 1,520 unchanged input hashes remain retained.

The early candidate production build passes every unchanged budget:

| Route           | Raw bytes | Gzip bytes | Raw headroom |
| --------------- | --------: | ---------: | -----------: |
| Home            | 1,596,092 |    431,987 |        3,908 |
| Content/utility | 1,596,092 |    431,987 |        3,908 |
| Search          | 1,654,458 |    450,623 |          542 |
| Collection      | 1,646,749 |    447,861 |        3,251 |
| Product         | 1,647,259 |    447,991 |        2,741 |
| Editor          | 2,804,107 |    758,841 |       45,893 |

No optimization or infrastructure replacement build was used. An earlier offline
export preparation hit sandbox EPERM before a build started; its source/logs and
capacity records remain. Scoped approval permitted normal offline pnpm registration
for the next export. One coordinator and the first independent build passed; the
latter measured search 1,654,456 raw / 450,619 gzip bytes. The authorized second
independent slot rechecks the corrected documentary source with its own identity.
Small environment-dependent bundle
variation and search's narrow headroom remain limitations; no ceiling or algorithm
changed.

Only the successful new candidate's declared inactive dependencies/cache were
retired: 1,201,332,224 allocated bytes, 605,196,288 bytes measured free-space increase;
all 1,807 retained artifact entries matched afterward. The first independent export
also retired only its inactive dependencies/cache after verdict retention, reclaiming
602,882,048 measured bytes with all 1,808 retained entries unchanged. The failed
preparation, thirteen historical exports and prior cleanup report remain untouched.

The [parent assessment](AR_02_BOUNDARY_ACCEPTANCE.md) covers original T01/T02/T21
and all four actual descriptive consumers. AR-02 remains Partial because
semantic-capability-features.ts still projects profile metadata through the
renderer-bearing template barrel; the map names the operation, chain, original
acceptance clause and minimal future cutover. AR-04/AR-05 remain blocked; AR-03
stays closed. No residual production repair is included. Final independent/native
PASS and review/CI/merge remain delivery gates. Actual
contextual permission validation, executable inventory, renderer/editor adapters
and publication remain runtime compositions. No new family, visual quality, live
commerce or publication readiness is claimed. No additional task, historical
rebaselining, original-input change, new worktree, permission change, rebase or second
review request is included.
