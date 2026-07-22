# P4-05B — Whole-storefront AI proposal generation

This document records the implemented generation-only slice for controlled whole-storefront AI
proposals. The authoritative product and architecture baseline remains
[`docs/VESKIFY_SDD.md`](VESKIFY_SDD.md); its synchronized human-readable export is
[`docs/archive/VESKIFY_SDD_v1.1.docx`](archive/VESKIFY_SDD_v1.1.docx).

## Supported capability

P4-05B supports one deliberately narrow storefront operation: apply either the approved warm
premium or minimal Nordic colour and typography direction across at least two explicitly targeted
pages. A request may additionally target the storefront design system, in which case the proposal
may replace the complete approved colour and typography groups. Selected-pages requests do not
receive global design-system permission.

The planner recognizes a fixed EN/FI request vocabulary, resolves page and eligible section targets
deterministically, and selects one registered storefront-scoped skill. It rejects ambiguous or
unsupported instructions, unsupported page/component targets, and a mismatch between the requested
direction and the explicit design-system target. Existing section- and page-scoped planning remains
unchanged.

## Canonical command and provider request

`AiStorefrontGenerationCommand` binds generation to one project, draft snapshot and revision; the
complete canonical P4-05A storefront projection; at least two affected page IDs; optional explicit
section targets and design-system target; merchant instruction; EN/FI locale context; capability;
and provider identity. Runtime parsing rejects duplicate, unknown or cross-page targets, locale
conflicts, and provider identity conflicts before canonical ordering.

The provider-independent request contains only the declared target, affected pages and sections,
minimal registered component contracts, optional current colour/typography state, target-bound
grants, target and permission fingerprints, locale context, protected paths, labelled untrusted
imports, and the required structured-response contract. It excludes secrets, UI state, unrelated
catalogue data, commerce operations, customers, analytics payloads, and repository state.

Permission grants retain their skill, version, scope, operation, page, section, component, and
design-system relationships. They are never flattened into independent allow-lists.

## Orchestration and concurrency

`AiStorefrontGenerationOrchestrator` is React-independent and owns only request generation. It
parses and plans before invocation, deduplicates identical pending requests, invokes the provider
once, validates untrusted output, and returns one canonical ready proposal only while the request is
still current. It does not store proposals or mutate active, saved, or published state.

Request identity covers the normalized instruction, provider, project/draft identity, complete
canonical target, affected pages and sections, optional design-system target, locale context, target
fingerprint, permission fingerprint, deterministic complete-storefront baseline fingerprint, and
request sequence. The pending key uses the planner's NFC, casing, whitespace, and harmless trailing
punctuation normalization, so equivalent supported instructions share one invocation. A distinct
newer request supersedes the older result; an invalid newer command also supersedes pending work.
Changes to any canonical page content or identity, page order, navigation, global design state,
target identity, draft revision, or locale context make a result stale. Volatile UI state is outside
the identity and cannot stale generation.

## Deterministic provider and validation

The deterministic mock provider emits only registered colour/typography operations authorized by
the request grants. For an explicit design-system target it emits the approved complete colour and
typography groups. It preserves the page set, page order, navigation, untargeted pages, content,
catalogue/commerce truth, and global section-ID uniqueness, and returns deterministic EN/FI
summaries.

Provider output is parsed strictly and must match the request/provider identity, pending status,
target, grants, fingerprints, operation count, proposal identity, locale context, and successful
validation metadata. The P4-05A boundary then checks target ownership, grant matching, registered
components, component-specific payloads, protected fields, operation order, projection preservation,
and fingerprints. Finally, the proposed storefront and affected design state must be exactly
reproducible by replaying the validated operations from the original canonical projection. This
rejects hidden page additions/removals, page-order or navigation changes, untargeted mutations,
permission escape, ungranted global changes, malformed operations, unsupported locales, executable
content, CSS/style injection, fenced code, and markup. Failed raw output never becomes a ready
proposal.

## Analytics and privacy

Best-effort analytics records only these events:

- `storefront_prompt_submitted`
- `storefront_proposal_generated`
- `storefront_generation_failed`
- `storefront_generation_stale`
- `storefront_generation_superseded`

Properties are limited to request/provider identity, request sequence, target fingerprint, affected
page and operation counts, duration, validation state, and controlled failure code. Merchant
instructions, generated text, imports, operations, provider responses, catalogue/customer values,
and secrets are never recorded. Analytics failures cannot change generation state.

## Explicit exclusions and next work

P4-05B adds no editor target selector, prompt UI, confirmation UI, Accept/Reject behavior, active
draft mutation, history, composite undo/redo, Save draft, publishing, onboarding behavior, or real
external provider adapter.

P4-05C remains responsible for revalidating and atomically applying an accepted multi-page proposal
to the active draft with one coherent history boundary and site-wide stale/undo semantics. P4-05D
remains responsible for merchant-facing whole-storefront targeting, generation and review wiring.

## Traceability

The implementation follows SDD §§6.1–6.5, 12.3, 12.5–12.8, 13.1, 13.6, 14.1,
15.3–15.5, 16.2, 17.2, 18, 19, 20, and 21.2; FR-007, FR-013–FR-016, FR-020,
FR-027, FR-040–FR-042, FR-050; NFR-006–NFR-009; AC-012, AC-013, AC-016, and
AC-017.
