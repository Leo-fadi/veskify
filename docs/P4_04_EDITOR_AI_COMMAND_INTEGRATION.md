# P4-04 — Editor AI command and selected-target integration

The editor design-assistant panel now submits localized merchant instructions through
the canonical P4-03 generation orchestrator using the active project, draft revision,
page, selected section, locale, brand system and storefront render context. The editor
does not derive operation permissions: P4-03 resolves planner scope and target-bound
grants before P4-01 validates provider output.

Ready results are opened directly in the P4-02 confirmation orchestrator. React keeps
only merchant-facing lifecycle presentation state; the rendered proposal is derived
from the canonical P4-02 confirmation snapshot, preserving generated proposal identity,
permission grants and page/target fingerprints without a second proposal model. Draft
mutation remains exclusive to explicit P4-02 acceptance and creates one canonical
editor-history transaction.

The composer provides EN/FI labels, examples, placeholders and keyboard guidance.
Control/Command + Enter submits once, empty requests are rejected before provider
invocation, successful ready handoff clears the visible input, and retryable failures
retain and refocus it. In-flight page edits and selection changes are rechecked by
P4-03, while a locale switch supersedes the editor attempt so a new locale-aware
request can be submitted.

Editor analytics forwards only the canonical privacy-safe prompt-submitted,
proposal-generated, generation-failed, accepted and rejected events. Merchant
instructions, generated content, imported content and provider payloads are excluded.

This implements SDD §§5.2, 6.3–6.5, 7.1–7.4, 12.1–12.10, 17.1–17.2 and 19.1,
including FR-021, FR-022, FR-027, FR-028, FR-040, FR-042, FR-050, AC-004,
AC-006, AC-016, AC-018, AC-019 and AC-020, while preserving ADR-001 and ADR-002.
