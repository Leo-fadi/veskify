# P4-03 — AI proposal-generation orchestrator

`src/application/ai-proposal-generation` connects canonical editor identity and the
existing design-skill planner to the P4-01 provider boundary. The dedicated request
builder validates page/section selection, derives operation and component permissions
from selected registered skills, preserves enabled locale context, and labels imported
content as untrusted data.

`AiProposalGenerationOrchestrator` coordinates exactly one provider invocation for an
identical pending request, validates output through P4-01, and creates the existing
pending `DesignProposal` shape for merchant review. Generated proposal identity retains
the project, page, optional section, draft snapshot/revision, provider, and provider
request ID. The active draft and published storefront are never mutated.

The React-independent lifecycle exposes idle, generating, proposal-ready, failed,
stale, and superseded states. In-flight results are discarded when the draft identity
or editor target changes, and an older request cannot replace a newer proposal.
Optional analytics receive only safe identifiers, operation counts, duration, and
validation status—never merchant instructions, imported content, secrets, or payloads.

This implements the controlled proposal pipeline in SDD §§12.1–12.10, 17.1–17.2,
17.5–17.6, FR-025–FR-028, FR-042, NFR-007–NFR-009, and AC-003, AC-004, AC-016, and
AC-020 while preserving ADR-002 and the existing draft/published separation.
