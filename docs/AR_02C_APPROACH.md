# AR-02C implementation approach

Recorded before implementation on 8 September 2026. The original checkout uses
`codex/ar-02c-utility-metadata`, based on AR-02B's approved PR #240 merge
`03f3cb85668acdb8444ea83e1d14fa14aff93c1f`.

The [native contract](governance/task-contracts/AR/AR-02C.json) mirrors the immutable
external contract at `/Users/leo/veskify-batch-runs/BATCH-02/AR-02C/contract.json`,
active SHA-256 `6487d85086b3d9079c69611e4bee4a55a76c5987fa73b6076dac139e8271ab50`.
The original lock was `eec4033229fb8efc673a794f9482b00b79cd8ef615d75c48716bc18c573633c7`.
The owner authorized one formatting-only reissue on 8 September 2026; original artifacts
remain preserved externally. Parsed content and the canonical fingerprint are unchanged;
the [implementation report](AR_02C_IMPLEMENTATION_REPORT.md) records the equivalence evidence.

Move the utility schemas, ordered variants and complete declarative definition input
once into `commerce-utility-metadata.ts`. A literal-preserving local type derived
from the existing `defineComponent` input retains schema/default and renderer
inference. Metadata imports Zod and the existing localized-text schema leaf; contract
references remain type-only. The current runtime definition consumes this input and
re-exports the same schema objects. The supported vocabulary consumes its same arrays.

The existing registered definition, V2 adaptation, generated capability manifest and
PageBlueprint profiles remain canonical. Current consumers are the utility renderer,
supported vocabulary and unchanged registry/profile composition. JSX, responsive
helpers, action gating, runtime validation and private V1-to-V2 adaptation stay in the
renderer module. Metadata is neither a renderable definition nor another registry.

Rejected shortcuts are duplicated declarative values, suppressed type incompatibility,
a new factory/DSL, and redirecting the protected utility-profile import. Invalid
schemas, unknown component/variant/page references and mismatched runtime states must
still fail closed; unavailable actions remain absent and loading stays on its route.
Preflight found no unresolved architecture conflict.

The pinned baseline captures complete metadata/schema representation, V2 definitions,
ordered vocabulary, canonical manifest, live conformance and six utility profile
materializations. Existing utility/anatomy tests passed 42 tests at the base. Final
checks prove both actual runtime closures with the unchanged AR-02B traversal helper,
public object identities, unchanged bytes and runtime behavior. No visual redesign or
bundle-size result is claimed. V2 legacy adaptation and the utility-profile renderer
import remain explicit residuals.

One writer implements; a fresh independent verifier checks the paused complete diff.
Commit, one PR, automatic review and CI follow only after native verification. AR-02C
requires its own explicit merge approval. BATCH-02 then ends with no third task.
