# AR-02D implementation approach

Recorded before production edits for BATCH-03 child 1 in the original
`/Users/leo/veskify` checkout, branch `codex/ar-02d-homepage-metadata`, base
`03418ba678099b8a14c6733e009affb2c70f620b` (merged AR-02C, PR #241).

The [immutable contract](governance/task-contracts/AR/AR-02D.json) follows the
existing native schema. Its repository-formatted external authority is retained at
`/Users/leo/veskify-batch-runs/BATCH-03/AR-02D/contract.json`, with fixed raw SHA-256
`68abe81c3ea3eb48f41a518558e1a76933257d65d59242f8ccfb8a308d4242e6`.
The owner-approved runbook permits only D, E and F sequentially, with separate
contracts, branches, PRs and explicit merge approvals.

## Existing authority and approach

Move the existing schema declarations and renderer-independent `defineComponent`
inputs from `homepage.tsx` and `aurum-hero.tsx` into their corresponding metadata
leaves. This covers the nine legacy homepage definitions and the existing
`aurumHeroDefinition` of type `hero`. Original runtime modules consume the same
named objects and re-export the identical schemas. Ordered metadata groups derive
from those declarations for the later AR-02F consumer.

Use AR-02C's local literal-preserving types derived from `defineComponent`; its
type-only import may refer to the existing contract. Keep callbacks, context and
catalogue-reference validation, JSX, `validateCatalogueReferences`, renderer imports
and runtime definition/group exports in their original owners. Raw declaration
defaults still pass through the existing factory and schemas; parsed defaults may
contain fields absent from raw inputs.

The current consumers are the original homepage/hero rendering definitions,
existing legacy-to-V2 adaptation and its manifest/conformance consumers. Existing
schemas, `StorefrontSnapshot`, read-only commerce, component definitions and the
unchanged V2 adapter remain authoritative. No second registry or persisted
representation is introduced. The incorporated AR-00 addendum and complete AR-02
acceptance govern the extraction; the tracker owns status and roadmap owns order.

Rejected shortcuts: copying a second metadata catalogue; importing runtime
definitions from the metadata; adding a new DSL/factory or changing shared schemas;
widening variant tuples or suppressing incompatibility with `any`/double assertions;
moving runtime validation or rewriting V2 composition before D/E acceptance.

## Baseline and proof

The pre-edit repeatable observation is retained externally under
`BATCH-03/AR-02D/observation/baseline-observation.json`, SHA-256
`e18ebcb9e7f131e86e9ebe4dc9d1b52c67db97f2f60e8db6817b2d11eb3d47dd`.
Its unchanged scratch harness passed one test before source edits and captures
10 definitions and adaptations, 29 V2 definitions/manifest entries, 80 static
renders across all affected variants in EN/FI, 33 registrations, 52 conformance
findings and seven recorded error observations. The earlier AST supplement remains
preserved separately; it is not part of the repeatable runtime comparison.

Compare complete before/after bytes, not only counts or hashes derived after
extraction. The new focused test separately proves public schema identity, raw
metadata defaults after parsing, exact adaptation and behavior, and both recursive
runtime closures using the unchanged AR-02B traversal helper. A small test-only
observation helper may reuse the pre-edit capture. Existing focused tests cover
homepage/hero, navigation, assets, catalogue binding and commercial consumers.

The contract declares twelve commands: focused Vitest, unchanged full observation,
integrity/complete whitespace, architecture status, requirements/tooling/SDD/tracker
and documentation checks, typecheck, focused lint and affected-file formatting.
Only existing exporters may regenerate the two owned DOCX outputs. Local full
suites, builds, browser campaigns and live provider/Vesko calls are outside scope.

## Failure, scope and delivery

Keep strict schema/refinement messages, asset/link restrictions, duplicate and
unknown references, missing brand-story media authority, invalid variants/page
types, localized content and default behavior. Changed baseline bytes, schema
identity, undeclared dependencies or a renderer-bearing metadata closure block
submission. Rollback restores declarations to the original modules; no stored-data
migration is needed. No unresolved architecture conflict was found in preflight.

Exactly four production files are writable; the contract lists all ancillary paths.
Count moved lines as additions/deletions. Handwritten additions target 1,500 and
stop at 2,500; deletions stop at 1,500. Native production limits also apply. Preserve
all unowned sources, nine original untracked inputs, prior worktrees and evidence.

One writer implements, then pauses for a fresh independent verifier and exact
native reconciliation. Both must pass before commit/push/public PR. One automatic
review, the bounded per-head CI wait and explicit merge approval remain separate
gates. D closes only upon accepted merge and selects E next. AR-02/03 remain Partial;
AR-23 remains independently eligible and unstarted. V2 still loads legacy rendering
at this intermediate stage; AR-02F owns that dependency removal. Utility-profile,
manifest/template and intentional live-wrapper dependencies remain explicit.
