# AR-03D — Design selection and editor boundary

The existing `dynamicCommercePresentation` in `StorefrontSnapshot` remains canonical.
Move the strict selection schema, type and error into `design-selection-contract.ts`;
move their existing validation/replay/application closure into `design-selection.ts`;
move archetype projection/application into `editor-projection.ts`. Preserve declarations
unchanged and forward the original public API explicitly through `authority.ts`.

The planner imports selection operations from their new owners. The two Studio editor
consumers import projection/application from the editor owner. Their other imports,
arguments, hooks, JSX, state and orchestration remain unchanged. The planner's legacy
current-authority materialization import remains on the facade until AR-03E.

Rejected shortcuts are a facade back-edge, duplicate schema/error objects, stronger
source-authority replay validation, product-loop filtering copied from collection
logic, broad planner import cleanup, and a larger bundle ceiling. Existing metadata
profile materialization and current-authority compatibility are valid dependencies.

Preserve strict first failures and nonmutation, exact representative/frame behavior,
unknown-page return, one-composite restriction, approved assets, raw equivalent styles,
and no-op/revision behavior. Reverting the extraction and consumer cutovers together
requires no persisted migration. No unresolved architecture conflict was found.

The native contract was formatted before external raw/canonical pinning at base
`078ed3ca6ca61e5792969840507f2a3c5015f76d`. Pre-edit evidence includes full serialized
selection/editor and route/render observations, metadata/conformance observations,
31 declarations, 36 public names and the three consumer bodies. Original inputs,
historical transitions and earlier evidence are preservation-only.

One coordinator writes; existing helpers read only. Implementation pauses for final
independent verification, including a fresh bounded production build and unchanged
budget checker. Standing BATCH-06 owner authorization permits commit, public PR and
expected-head merge only after independent/native PASS, one automatic review and all
required exact-head CI. AR-03 and AR-02 remain Partial; E starts after D merges safely.

The owner-authorized workspace wording amendment aligns the verifier role, verification
skill and team workflow. Sequential verification may use the contract-assigned original
checkout only with paused writers, exact branch/base confirmation and frozen reviewed
inputs checked afterward. Models, sandbox, network, approval policy, tool permissions
and independent verification requirements are unchanged. The original contract/lock,
readiness BLOCKED verdict and native FAIL for missing independent execution are retained.
A semantic successor contract/support identity governs a fresh configured verifier;
its active instructions and actual workspace must be confirmed before execution.
The product implementation and earlier evidence retain their original provenance.
