# AR-02I — Planner metadata consumption

The existing planner, plan contract, recipe constructor and direct application
provider will consume existing metadata through renderer-free entrypoints. Their
planned output, request authority, validation, errors and merchant rendering remain
unchanged. This is one BATCH-07 task on `codex/ar-02i-planner-metadata-boundary`, based
on accepted PR250 merge `ddca96fb79e9ab03692e0fe79dfd202ef8c83d76`.

The original homepage bridge names, type, private variant helper, variants and
parsed defaults move together into `homepage-commerce-bridge-metadata.ts`. The
bridge retains the same public objects through explicit re-exports. Its rendering,
projection and validation bodies stay unchanged. Existing homepage-commerce schemas
and V2 definitions remain authoritative.

`homepage-planning-defaults.ts` is a private consumer projection over the canonical
homepage/hero groups and bridge metadata. It reproduces the existing runtime
factory's schema parsing and exposes only default content/props. The planner still
uses supplied V2 definitions and instance validation as capability authority.

Preflight found two default lookups: brand-story props, and each materialized home
slot before shared-frame/profile/omission checks. Registered home plans include
announcement and newsletter as well as header/footer and commerce slots; all 18
canonical homepage metadata keys are characterized. Raw default inputs omit schema
defaults, so substituting them directly is rejected. A hard-coded component list,
duplicate schema, broad-barrel rewrite, lazy renderer fallback or alternate unused
planner is also rejected.

The four existing modules change import ownership only, plus the two planner lookup
identifiers. Dynamic selection/migration imports established by D/E stay unchanged.
The deterministic profile materializer and named dynamic authority functions remain
valid dependencies. Complete-store execution and renderer diagnostics retain their
separate purposes.

Pre-edit observations on the actual base capture 94 planning/provider cases, including
72 direction/profile/frame/media combinations: 18 succeed and 54 retain terminal
failures. Full recipes, targets, plans, validation, defaults and errors are retained
externally; no post-edit baseline will replace them. Earlier harness drafts and their
typecheck findings are preserved. The final pre-edit harness passes strict typecheck.
Unchanged historical observations and D/E caller assertions remain regression proof.

The seven production paths and ancillary scope are locked in the native contract.
Both copies were formatted before pinning. Raw SHA-256 is
`ffb3ef606ff6c3ae8d3269580c7e54be9fa37a4e378cec1bcecb343ca3337c38`;
canonical fingerprint is
`veskify-task-contract-v1_fc49a83af9de2df084415c03ed01e206fa1772a274a1a289dd1a3a57073d1ced`.
Fresh configured verifier readiness confirmed this original checkout and all 1,403
frozen inputs before implementation. No unresolved implementation-scope conflict was
identified. Parent AR-02 closure still requires independent original-acceptance proof.

Failure preserves the original first error, clone behavior and canonical state.
Reverting the extraction/import changes needs no persisted migration. Candidate and
independent final production builds must satisfy every existing route ceiling;
search has only 2,007 raw bytes of accepted-base headroom. No bundle improvement,
live-provider quality, production readiness or successor implementation is claimed.
