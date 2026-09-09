# AR-02E implementation approach

Recorded before implementation in the original `/Users/leo/veskify` checkout,
branch `codex/ar-02e-commerce-metadata`, base
`020692efb9705ee5619efe8ba88020c7ab3ad034` (AR-02D merge, PR #242).

The [immutable native contract](governance/task-contracts/AR/AR-02E.json) is retained
at `/Users/leo/veskify-batch-runs/BATCH-03/AR-02E/contract.json`, fixed raw SHA-256
`61b71c7965077c3d20157c2f30ba7b26360d92d64191fd38a0cfe71b538e92de`.
Its native canonical fingerprint is
`veskify-task-contract-v1_9b1f95660cf8887d5cca2b720888107f19337e0ac99ba69ffef14726c1a25739`.
The approved BATCH-03 queue is D, E, F with separate explicit merge approvals.

## Existing authority and implementation

Move the existing schemas and renderer-independent `defineComponent` inputs into
`collection-metadata.ts` and `product-metadata.ts`. Original runtime modules consume
the same named objects and re-export identical schemas. Ordered metadata groups
derive from those declarations for the later AR-02F adapter consumer. Use the
accepted local literal-preserving type pattern, with type-only contract references
and direct shared schema leaves when a barrel introduces runtime dependencies.

The two collection and five product definitions remain the canonical declarations;
the original factory, V1-to-V2 adapter, `StorefrontSnapshot` and read-only Vesko
commerce remain authoritative. Existing family renderers, dynamic commerce bridges,
legacy adaptation and manifest/conformance consumers are current consumers.
Keep `requireProduct`, collection and related-reference context checks, callbacks,
JSX and public definition/group exports in their original runtime owners. Move
schema-local refinements with schemas. Preserve `jewelleryFilterTokenSchema` and
the shared product-reference schema identity across gallery, information and options.

Rejected shortcuts are a copied metadata catalogue, runtime imports from metadata,
a new factory/DSL, shared-schema or adapter changes, widened variant tuples,
suppression casts, and premature V2 composition changes. No source-lock or
architecture conflict was found in the four authorized production paths.

## Baseline and focused evidence

The pre-edit native observation passed one test at the recorded base. Its complete
2,203,614-byte output is retained under `BATCH-03/AR-02E/observation`, SHA-256
`bdb66afbe2298494c3bbddaa6ac963e17e3c1053adedef3a08fbd15d862ea873`.
It records seven definitions/adaptations, 29 V2 definitions/manifest entries and
53 profiles, 18 family renders and four bridge renders in EN/FI, 33 registrations,
52 conformance findings, and nine error/default observations. Reuse the unchanged
captured harness to compare complete final bytes. Raw defaults are compared after
the original schemas parse them; source inspection separately proves declaration
moves and schema identity.

The existing test observer changes only its render page argument from `home` to
`definition.allowedPageTypes[0]`; that change already exists in the scratch baseline
copy. The runtime import traversal helper stays unchanged. New focused tests prove
both complete metadata closures, public/shared schema identity, adaptation parity
and meaningful strictness, reference, asset, variant, page and default behavior.
Fourteen existing focused tests cover accepted boundaries and commerce consumers.

The contract declares twelve focused commands, including native tests, observation,
integrity/complete whitespace, typecheck, lint, formatting and documentation checks.
Only existing exporters regenerate the two owned DOCX outputs. Local full suites,
builds, browser campaigns and live provider calls are outside scope.

## Failure and delivery

Preserve exact unknown-reference and schema-refinement errors, duplicate rejection,
filter order, local-asset restrictions, demo-only flags, protected commerce fields,
localized placeholder disclaimers and style defaults. Changed baseline behavior,
schema identity or a renderer-bearing/unresolved metadata closure blocks submission.
Rollback restores declarations to the original modules; stored data needs no migration.

Preserve all unowned sources, original nine untracked inputs, previous worktrees and
evidence. One writer pauses for independent verification and native reconciliation
before commit/push/public PR. Review, final-head CI and explicit merge approval are
separate gates. AR-02E closes only on acceptance and selects AR-02F next. AR-02/03
remain Partial, AR-23 eligible and unstarted. Live V2 still loads legacy rendering
until F; utility-profile, manifest/template and intentional live-wrapper limitations
remain outside this child.
