# P4-05A — Whole-storefront AI contract foundations

This document records the implemented contract foundation for future whole-storefront AI
proposals. The authoritative product and architecture baseline remains
[`docs/VESKIFY_SDD.md`](VESKIFY_SDD.md); the synchronized human-readable export is
[`docs/archive/VESKIFY_SDD_v1.1.docx`](archive/VESKIFY_SDD_v1.1.docx).

## Implemented foundation

The application exposes an additive `ai-storefront` contract boundary containing:

- a canonical storefront target for one project and draft revision, affected pages, globally
  unambiguous page-bound section targets, an optional explicit storefront design-system target,
  and the enabled/active English/Finnish locales;
- an aggregate storefront projection that excludes catalogue, customer, UI-state, and secret data
  while retaining the complete ordered page set, navigation identity, page content, and brand
  tokens;
- target-bound storefront operation envelopes with contiguous deterministic ordering;
- an additive raw proposal envelope that can retain provider validation failures, plus a separate
  ready-proposal boundary that admits only `valid: true` proposals with no validation errors;
- deterministic target and permission fingerprints built with the canonical storefront serializer;
- validators for target ownership, active draft identity, page/section membership, permission
  grants, registered component contracts, projection preservation, and operation semantics.

The target fingerprint includes the nullable design-system target as well as affected page and
section identity. Ready-proposal validation recomputes both the target and permission fingerprints
from the active canonical context and rejects stale or tampered values.

Storefront projections require section IDs to be unique across the complete page set. Proposed
projections must preserve every page, page order, and navigation. Pages outside the declared target
must remain byte-for-byte canonically equivalent to their original projection. Global design state
may change only with an explicit storefront design-system target and permission grant.

Page reordering operations must contain exactly the current section IDs once each. Section
operations are validated sequentially against an isolated working page by the existing design
operation and component-registry boundary. This permits an approved section to be introduced and
then customized in the same operation sequence while rejecting use-before-add, duplicate or
cross-page identities, grant-kind or component mismatches, unsupported variants or fields,
protected fields, malformed style values, and components that are unknown or disallowed for the
target page. Validation does not mutate the active draft.

The existing P4-01 permission model is extended only with the explicit
`storefrontDesignSystem` target. The existing single-page provider request rejects that target,
and existing page/section grant matching remains unchanged. `GeneratedAiProposal`,
`DesignProposal`, the P4-03 request builder/orchestrator, P4-02 confirmation, single-page history,
and draft/published separation remain the compatibility boundaries.

The foundation is contract-only. It does not invoke providers, compose merchant prompts, connect
editor selection, display confirmation UI, persist a second proposal store, apply multi-page
changes, implement site-wide atomicity, add site-wide undo/redo, or publish.

## P4-05B — generation implemented

P4-05B now builds the constrained whole-storefront colour/typography generation path on these
contracts. It resolves approved EN/FI merchant requests into explicit page, section and optional
design-system targets, derives target-bound grants from registered storefront skills, builds a
minimal provider-independent request, validates untrusted output, and returns one canonical ready
proposal with stale, dedupe and supersede protection. It does not widen locales, flatten grants,
mutate the active draft, or replace the existing single-page path. See
[`docs/P4_05B_STOREFRONT_AI_GENERATION.md`](P4_05B_STOREFRONT_AI_GENERATION.md).

## P4-05C — remaining atomic application and history work

P4-05C must add an application boundary that validates and applies an accepted storefront proposal
as one atomic draft transaction across all affected pages and any explicitly granted global design
state. It must validate the complete current storefront and fingerprints before mutation, leave the
draft unchanged on failure, record one coherent history event, preserve published state, and support
site-wide stale detection and undo/restore semantics through the canonical history and draft-save
boundaries.

Independent page commits are not a substitute for P4-05C atomicity. The contract foundation does
not claim that multi-page acceptance, site-wide undo, or publishing is implemented.

## Traceability

The implementation follows SDD §§6.1–6.5, 12.3, 12.5–12.10, 13.1, 13.6, 14.1,
15.3–15.5, 16.2, 18, and 20; FR-007, FR-013–FR-016, FR-020, FR-027, FR-028,
FR-040–FR-042, FR-050; NFR-006 and NFR-009; AC-012, AC-013, AC-016, and AC-017.
