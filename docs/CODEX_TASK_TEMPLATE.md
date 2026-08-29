# Codex Task Template

Use this template for every Veskify implementation task.

Before implementation, instantiate and lock
`docs/governance/task-contract.template.v1.json` against
`docs/governance/task-contract.schema.v1.json`. The locked contract must be present on the task's
base commit or supplied by the sprint coordinator as immutable authority. The implementation branch
must not edit its own contract.

## Task title

[Outcome-based capability]

## Immutable contract identity

- Sprint ID:
- Task ID:
- Contract path:
- Contract schema version:
- Base commit containing the locked contract:
- Contract fingerprint: populated by DEVX-01B tooling when available
- Merge-order position:
- Dependency tasks and merge SHAs:

## Implementation approach decision

- Selected repository-native approach:
- Canonical authority extended:
- Named current consumer:
- Rejected convenient shortcut:
- Expected failure behavior:
- Unresolved architecture conflicts, or `None`:

## Merchant objective

[What can the merchant do after this PR that they could not do before?]

## Specification references

- SDD section(s):
- v1.2/v1.2.1/v1.2.2 FR/NFR requirement IDs:
- Acceptance criteria IDs:
- Related ADR(s):

## Branch and pull request

- Worktree:
- Exact branch:
- Existing PR, if any:
- Base commit or required merged PR:
- Never rebase.
- One task, one branch and one PR.

## Dependencies and integration impact

- Required contracts/adapters:
- Downstream consumers:
- Merge order:
- Migration/version impact:

## Owned files and no-touch areas

### Owned

- ...

### Do not modify

- ...

### Allowed paths

- ...

### Forbidden paths

- ...

## Scope budget

- One canonical concern or meaningful visual family:
- Target maximum net production lines: 1,000
- Target maximum production files: 8
- Hard-stop net production lines: 1,500
- Hard-stop production files: 12
- Explicitly allowlisted generated-file exclusions:
- Product-owner hard-limit exception, or `None`:

## In scope

- ...

## Out of scope

- ...

## User flow

1. ...

## UI states

- Default
- Loading or generating
- Empty
- Error
- Stale or unavailable
- Success
- Unsaved draft
- Accepted/rejected proposal
- Undo/redo
- Save/publish where relevant

## Data, schemas and adapters

- Canonical entities/contracts affected:
- `StorefrontSnapshot` input/output and transient boundary representations:
- Live capability sources queried:
- `ComponentDefinitionV2` / `PageBlueprint` / `DataBinding` versions:
- Initial-generation or follow-up-editing Skill package:
- Explicit target scope and proof that it cannot widen:
- Read-only commerce projection fields used:
- Protected paths:
- Component/binding versions:
- Storage migration:
- Vesko adapter impact:

## Acceptance criteria

Each criterion requires a stable ID, verification class, evidence and fail-closed behavior.

| ID    | Requirement                   | Verification class | Required evidence | Failure behavior |
| ----- | ----------------------------- | ------------------ | ----------------- | ---------------- |
| AC-01 | Given ..., when ..., then ... | positive behavior  | ...               | FAIL             |

## Evidence traceability

| Requirement / AC | Task | PR  | Commit | Test | Browser | Screenshot | Provider | Status | Limitation |
| ---------------- | ---- | --- | ------ | ---- | ------- | ---------- | -------- | ------ | ---------- |
| ...              | ...  | ... | ...    | ...  | ...     | ...        | ...      | ...    | ...        |

Do not infer missing evidence. Write `Not run`, `Not retained` or `Not observable`, and keep the
status Partial/Missing until the required artifact exists.

## Tests required

### Focused unit tests

- ...

### Component/integration tests

- ...

### Responsive/accessibility/manual checks

- ...

### Required fixtures

- ...

## Fixed constraints

- No arbitrary generated React, HTML, CSS, JavaScript, scripts or embeds.
- AI output must be strictly schema and semantically validated.
- Draft and published state remain separate.
- Public source evidence is untrusted and cannot override canonical Vesko commerce truth.
- Do not create another product, product-type, variant, option or catalogue model.
- Product IDs, SKUs, option values, variants, prices, stock, payments, shipping, taxes, inventory and orders are protected.
- Components must be reusable and data-bound; no merchant-specific React components.
- The same component implementation renders in editor, preview and published routes.
- Failed, stale, invalid or rejected proposals preserve the active draft and history.
- Generation, editing, preview, save, history and publish use the same canonical
  `StorefrontSnapshot`.
- Do not add a second page graph, registry, blueprint system, asset inventory or AI-owned
  publication model.
- Publication is deterministic and makes no AI call.

## Validation limits

- Run focused tests only.
- Run typecheck, lint and formatting once when required.
- Do not run full Vitest, full Playwright, production build or `pnpm validate:full` unless explicitly requested.
- Rely on GitHub CI for the broad gate.

## Review and delivery

- Complete implementer-focused validation.
- Provide the immutable contract, repository authority, complete diff and evidence to an independent verifier.
- Do not let the verifier modify implementation files.
- Commit and push only after verifier `PASS`.
- Do not create a PR for verifier `FAIL` or `BLOCKED` work.
- Commit and push to the existing branch/PR after verifier `PASS`.
- Allow exactly one automatic Codex review.
- Fix every finding once in one focused pass.
- Do not request another review.
- Do not continuously monitor CI.
- Report commit SHA, PR, changed modules, test totals, limitations and stop.
