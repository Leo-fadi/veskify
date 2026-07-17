# P2-06 controlled design skills and deterministic planner

This slice implements the controlled planning and skill-orchestration foundation from SDD §§2,
6.2–6.5, 9, 12, 15.4–15.6, 16.2–16.4, 17.2, 21, and Addendum A. The affected requirement IDs are
FR-014–016, FR-020, FR-022, FR-027, FR-031, FR-036, FR-039–042, FR-050, NFR-006, NFR-008, and
NFR-009. It directly covers the non-UI portions of AC-004, AC-012, AC-016, and AC-017.

The implementation is isolated under `src/application/design-skills`. It contains no React UI,
Puck integration, persistence, publishing, proposal store, or operation-schema replacement.

## Public API

`@/application/design-skills` exports:

- `designSkillDefinitionSchema`, the canonical bounded skill contract;
- `DesignSkillRegistry`, `createDesignSkillRegistry`, and the initial `designSkillRegistry`;
- `classifyDesignRequest` for exact controlled EN/FI intent families;
- `createDesignPlan` for immutable, deterministic, scope-aware plans;
- `executeDesignPlan` for transactional execution through the existing design-operation executor;
- `createProposalFromDesignPlan` for the existing `InMemoryDesignProposalStore` lifecycle;
- `DeterministicDesignProvider`, `createDeterministicDesignProvider`, and
  `deterministicDesignProvider` as retained no-credentials proposal lifecycle facades;
- the initial `applyLuxuryStyle`, `applyMinimalNordicStyle`, `addCampaignSection`, and `improveHero`
  definitions.

## Safety boundary

Every skill declares supported intents, scope, page types, context, components, operations, protected
paths, preconditions, output schema, validation rules, deterministic execution, and an EN/FI
summary. The registry validates definitions, rejects duplicate IDs, and checks every emitted
operation against declared permissions. The executor then applies operations one at a time through
`applyDesignOperation`, validates the final registered `PageModel`, and returns the original page on
any failure.

The module accepts one active page and returns detached page values. It cannot address another
page, storage, a published snapshot, or operational commerce services. Catalogue context is frozen
for skill execution and checked for mutation. Existing operation schemas and registry validation
prevent unregistered components, unsupported variants, protected content fields, and invalid
header/footer composition. Executable React, HTML, CSS, JavaScript, scripts, and embeds are rejected
before canonical execution.

Each deterministic provider instance owns one stable `InMemoryDesignProposalStore` and exposes
`propose`, `inspect`, `accept`, and `reject`. Callers may bind or pass their own store, while the
default provider remains able to complete the pending-proposal lifecycle without external state.
Provider instances do not share proposal state.

## Deterministic request families

The initial exact request vocabulary supports these English and Finnish outcomes:

- luxury homepage refinement;
- campaign-section addition;
- minimal Nordic layout refinement;
- existing-hero improvement.

Unknown requests return a controlled unsupported result. Requests containing conflicting supported
directions return one focused clarification instead of choosing an unsafe fuzzy match.
