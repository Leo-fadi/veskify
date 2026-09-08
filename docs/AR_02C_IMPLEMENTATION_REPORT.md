# AR-02C implementation report

AR-02C extracts the commerce-utility family's schemas, ordered variants, defaults, page types,
and protected metadata into one renderer-free module. The existing utility renderer consumes that
object through its existing `defineComponent` call, reexports the same schema objects, and retains
its action handling, runtime validation, responsive behavior, and V1-to-V2 adaptation. Supported
vocabulary reads the exact same page-type and variant arrays through a broad read-only view needed
by its existing union consumer; the arrays themselves are not copied or cast.

The focused test covers schema and array identity, strict unknown-field rejection, defaults,
definition rejection for unknown components, variants, and disallowed pages, and preservation of
the declarative input. It fixes before hashes for metadata, adapted and registered V2 definitions,
vocabulary, manifest, and six utility-profile materializations. Two complete import-closure checks
use the retained AR-02 traversal helper and reject renderer, registry, compatibility, Puck, React,
CSS, and acceptance edges.

The external observation harness compares complete registered utility authority, live conformance,
and six profile materializations byte-for-byte with its preflight baseline. Unchanged P10B-13 tests
cover actual rendering. The locked integrity check also preserves the active contract,
prior evidence, original untracked inputs, protected tracked
inputs, scope budget, and whitespace through a scratch Git index. No renderer redesign, registry
change, V2 legacy-adaptation removal, utility-profile runtime-import removal, bundle-size claim, or
successor task is included.

Prior implementer evidence records 686 passing tests across the seven declared focused files,
followed by five overlapping metadata tests after correcting two unused test bindings. These
are separate runs, not 691 distinct tests or an independent verdict. The observation capture
passed one test; its complete 1,625,210 bytes matched the baseline. Typecheck, focused lint,
documentation/export checks and complete default-whitespace checks passed. Integrity checks
preserved nine original inputs, 363 prior evidence files and 1,276 unowned tracked inputs.
Logs and command records remain under `/Users/leo/veskify-batch-runs/BATCH-02/AR-02C/`.

On 8 September 2026 the owner authorized one formatting-only contract reissue after the initial
temporary contract used formatter defaults instead of the repository's existing configuration.
Only the `AC-06.requiredEvidence` array's line wrapping changed. The original external authority,
documentary copy, lock, diff and evidence remain preserved externally under their original identities.
Original raw SHA-256: `eec4033229fb8efc673a794f9482b00b79cd8ef615d75c48716bc18c573633c7`.
Fixed replacement raw SHA-256: `6487d85086b3d9079c69611e4bee4a55a76c5987fa73b6076dac139e8271ab50`.
The unchanged native fingerprint is
`veskify-task-contract-v1_051ebeb8eb121bc387f81dac1c9d21554837bbe7d1ebfe0ded5b8f94c4f46451`.
Token comparison excluding whitespace outside strings, parsed JSON equality, native validation
of both versions, and repository-configured formatting all passed. Exact results and the diff
are retained in `contract-reissue-equivalence.json`, `reissue-original-native.json`,
`reissue-candidate-native.json` and `reissue-exact.diff` in that evidence directory.

Upon explicit owner acceptance and merge, AR-02C is Baseline / closed. AR-02 and AR-03 remain
Partial. AR-23 remains eligible and unstarted with AR-01 as its only dependency; no third child is
selected. The evidence above precedes independent verification. The fresh verifier's final
input identity, actual command results and native reconciliation remain separate gates before
the authorized commit, push and public PR. Automatic review, CI and explicit owner approval
remain separate merge gates.
