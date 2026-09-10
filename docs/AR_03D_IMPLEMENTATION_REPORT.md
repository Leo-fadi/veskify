# AR-03D — Design selection and editor boundary

Studio archetype editing and deterministic design selection keep their existing
behavior while using separate application owners. This change adds no merchant
feature, route policy, persisted format or model call.

`design-selection-contract.ts` owns the unchanged strict schema, types and error.
`design-selection.ts` owns the original validation, source-authority replay,
materialization and application closure. `editor-projection.ts` owns representative
archetype projection and page application. The facade forwards the same public API;
`index.ts` remains unchanged.

The planner uses the selection owners and retains its legacy materialization import
until E. The two Studio editor consumers use `editor-projection.ts`; their other
imports, arguments, hooks, JSX and state operations are unchanged. The full planner
and React editor are not claimed to be renderer-free.

Pre-edit evidence at base `078ed3ca6ca61e5792969840507f2a3c5015f76d` captures 31 original
facade declarations, 36 public value/type names and three consumer bodies. Full
observations cover 33 selection scenarios/four operations each, six editor archetypes,
representative/frame/section failures, 11 route/render fixtures and complete metadata
and conformance output. Existing source guards passed 429 tests and initial functional
baselines passed 31 tests. Retained original hashes and source transitions are unchanged.

The new boundary test covers complete runtime closures, identity and real module
resolution, weaker source-only replay context, first validation error, missing
representatives, collection/product frame asymmetry, one composite, unknown-page
cloning, approved assets and raw-style/no-op/revision behavior. Its 14 tests passed. Focused authoring/planner tests passed 155 tests across 14 files;
generation/lifecycle/preview integration passed 43 across six. Boundary/source checks
passed 1,078 across 11 files; retained inventory passed four with two existing matrix
tests unselected. Both historical render/publication replays passed. Full route/selection
and metadata observations matched the pre-edit outputs exactly. Typecheck, harness
typecheck and lint pass. Initial missing relocation imports and a test callback lint
error were corrected without changing original declaration bodies; earlier logs remain
external evidence. Independent verification is a separate final gate.

All six production route budgets and the measurement algorithm remain unchanged,
including search at 1,655,000 raw and 475,000 gzip bytes. Comparable accepted C build
artifacts retain their original identity. The candidate build passed in a fresh offline export; a fresh independently executed
final build remains mandatory before submission. The candidate adds 358 raw bytes to
each storefront route and 393 to the editor versus the comparable accepted C build.
This is a bounded measured regression, not a bundle optimization.

| Route           | Raw bytes | Gzip bytes | Raw headroom | Gzip headroom |
| --------------- | --------: | ---------: | -----------: | ------------: |
| home            | 1,593,490 |    431,174 |        6,510 |        18,826 |
| content-utility | 1,593,490 |    431,174 |        6,510 |        18,826 |
| search          | 1,651,856 |    449,810 |        3,144 |        25,190 |
| collection      | 1,644,147 |    447,049 |        5,853 |        27,951 |
| product         | 1,644,657 |    447,178 |        5,343 |        27,822 |
| editor          | 2,801,297 |    756,850 |       48,703 |        68,150 |

D's conditional closure follows independent/native PASS, one automatic review and
required exact-head CI. External records bind actual command totals, build measurements,
verified head, standing owner authority and protected merge event. AR-03 remains Partial
for migration and expand/fold separation; AR-02 remains Partial. E starts only after D's
verified merge and safe synchronization. No rebase, second review request, historical
rebaseline, new workspace, unrelated work or deployment is part of this task.

The owner-authorized workspace wording amendment aligns the verifier role, verification
skill and team workflow. Sequential verification may use the contract-assigned original
checkout only with paused writers, exact branch/base confirmation and frozen reviewed
inputs checked afterward. Models, sandbox, network, approval policy, tool permissions
and independent verification requirements are unchanged. The original contract/lock,
readiness BLOCKED verdict and native FAIL for missing independent execution are retained.
A semantic successor contract/support identity governs a fresh configured verifier;
its active instructions and actual workspace must be confirmed before execution.
The product implementation and earlier evidence retain their original provenance.
