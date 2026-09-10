# AR-03B implementation approach

The original checkout starts at accepted PR246 merge
`58360843b9766d3ed0dc8bb0ef618f17b9d8838c` on
`codex/ar-03b-presentation-support`. BATCH-05's standing owner grant covers this
child's gated public submission and protected merge. The formatted external native
contract is authoritative; its repository copy documents the same bytes.

Move the existing presentation builders and private support into
`archetype-presentation.ts`, the exact two-profile P18B03 read compatibility into
`presentation-compatibility.ts`, migration types/error into `migration-contract.ts`,
and style projection into `presentation-style.ts`. Share the unchanged truthy-cause
failure helper through `route-errors.ts`. The facade imports the moved functions
and explicitly forwards its original public types and constructor.

The named consumers are existing snapshot migration, current-authority validation,
section fingerprinting and route/editor projection. Canonical StorefrontSnapshot,
PageBlueprint profiles and ComponentDefinitionV2 retain ownership. New leaves use
direct schema/default/V2 metadata and the existing deterministic profile materializer.
Rejected shortcuts are importing the broad registry/facade back, duplicating schemas
or mappings, and removing historical compatibility. None establishes a safe boundary.

Before source edits, the public observation captured complete legacy/current and
P18B03 outcomes, errors and immutable inputs. Four baseline files passed 102 tests;
the bounded historical/source/status subset passed 50, with 605 intentionally skipped.
Two additional observation checks passed. Full existing profile, definition, manifest,
renderer and conformance observations are retained externally for exact comparison.
No post-edit output is a replacement pre-edit baseline.

Invalid facts, references, profiles, cards, assets and provenance retain their original
failure order, error identity/code/message/cause and immutable inputs. Optional assets
and undefined/empty style behavior remain unchanged. All accepted historical hashes,
archives and readers stay untouched. There is no unresolved architecture conflict.
Rollback reverts the extraction and forwarding together; no persisted schema changes.

Only declared focused checks run locally. A paused exact diff requires fresh independent
execution and native PASS before submission. One automatic review and passing required
CI including validate precede the standing-authority record and protected merge. B
selects C only after that merge and safe synchronization; the broader AR-02/03 work
remains Partial. B does not claim the migration/editor facade itself is isolated.
