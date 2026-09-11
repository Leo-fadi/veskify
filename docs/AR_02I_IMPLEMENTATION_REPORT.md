# AR-02I — Renderer-free planner metadata consumption

The existing planner, planning contract, recipe constructor and direct provider now
consume narrow metadata owners. Merchant generation, defaults, errors and proposal
behavior remain the compatibility target; this task adds no visible feature or new
capability inventory. The original checkout uses
`codex/ar-02i-planner-metadata-boundary`, from accepted PR250 merge
`ddca96fb79e9ab03692e0fe79dfd202ef8c83d76`.

Seven production paths change. `homepage-commerce-bridge-metadata.ts` owns the five
original bridge metadata declarations, importing the existing schemas and V2
definitions. The old bridge imports/re-exports those same values and retains its
rendering, projection and validation bodies. `homepage-planning-defaults.ts` derives
fresh normalized defaults from existing homepage/hero metadata and bridge values.
The planner changes only imports and its two default lookups, preserving lookup
order, supplied V2 capability authority and D/E dynamic-route imports. Contract,
recipe and provider changes only narrow imports; protocol and async behavior stay
unchanged. Current status projections, their guards and deterministic exports remain
in the same task.

The initial contract remains unchanged: raw SHA-256
`ffb3ef606ff6c3ae8d3269580c7e54be9fa37a4e378cec1bcecb343ca3337c38`, canonical fingerprint
`veskify-task-contract-v1_fc49a83af9de2df084415c03ed01e206fa1772a274a1a289dd1a3a57073d1ced`.
The authoritative canonical fingerprint is recorded in the native lock and final
verification evidence. Fresh configured verifier readiness passed in the original
checkout with all 1,403 frozen inputs unchanged before implementation. Readiness is
separate from final verification.

The genuine pre-edit harness retains complete recipes, targets, plans, validations,
defaults, errors and fingerprints for 94 planning/provider cases, including 72
combinations: 18 successes and 54 terminal failures. Original drafts, typecheck
findings and corrected pre-edit observations remain preserved; no post-edit baseline
was captured. The new boundary test passes 19 focused cases covering all six closure
roots, shared identities, all 18 normalized defaults, real slot coverage,
unknown/prototype rejection and mutation isolation. It compares complete recipe and
three plan outputs with pre-edit hashes. Typecheck and original-declaration comparison
passed. Full declared regression/observation and final independent records supplement
these initial focused results.

Candidate 01 compiled but exceeded the unchanged search raw ceiling by 1,638 bytes.
The single permitted packaging correction removed computed namespace schema lookups
whose emitted names enlarged client chunks. Bridge defaults are already parsed by
the canonical owner; the consumer returns fresh clones. Focused tests prove those
values equal the runtime factory's second parse. No schema, renderer, behavior or
budget changed.

Candidate 02 reached build tracing and failed with ENOSPC. That infrastructure failure
and its partial outputs remain preserved. Owner-authorized recovery subsequently
retired only recorded inactive build caches and export-local dependency copies;
source archives, emitted chunks/manifests, reports, locks and observations remain.
A successor support record documents those exact retirements without changing source
integrity checks. The owner clarified that 15 GiB was advisory. A component estimate
allowed 4 GiB for export/dependencies/output/transients plus a 2 GiB OS reserve;
measured free space was 9.90 GiB. No historical peak measurement was claimed.

Candidate 03 built the same corrected source successfully; all unchanged budgets
passed. Shared-filesystem samples stayed above 7.26 GiB. Three original coordinator
build slots are consumed, zero extra ENOSPC slots; a fresh independent final build
remains a separate delivery gate, with capacity checked immediately before it.

| Route                | Raw bytes | Gzip bytes | Raw/gzip headroom |
| -------------------- | --------: | ---------: | ----------------: |
| Home/content utility | 1,594,732 |    431,640 |    5,268 / 18,360 |
| Search               | 1,653,098 |    450,276 |    1,902 / 24,724 |
| Collection           | 1,645,389 |    447,515 |    4,611 / 27,485 |
| Product              | 1,645,899 |    447,644 |    4,101 / 27,356 |
| Editor               | 2,802,135 |    757,656 |   47,865 / 67,344 |

The comparable accepted E export matches all 1,361 base public source files and the
same Node 24.18.0/Next 16.2.10/darwin-arm64 toolchain. Search grows by 105 raw bytes;
this is an ownership correction, not a bundle improvement claim. Complete build,
checker, manifest, source and capacity records are retained externally under BATCH-07.

[Original AR-02 acceptance](AR_02_BOUNDARY_ACCEPTANCE.md) remains Partial because
confirmed metadata projections outside this task still import renderer-capable
barrels. AR-03 stays closed. Independent/native PASS, one automatic review, required
CI including production budgets/validate and expected-head protection remain mandatory
before the standing-authorized merge. External submission/closeout records bind the
exact final head and actual gate outcomes. No rebase, second review request, unrelated
implementation, deployment or additional task is authorized.
