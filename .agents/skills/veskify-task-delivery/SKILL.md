---
name: veskify-task-delivery
description: Deliver one approved Veskify engineering task using its locked native contract, scoped implementation and independent verification. Does not authorize roadmap continuation or merging.
---

Read [AGENTS.md](../../../AGENTS.md), the applicable authority in
[DEVELOPMENT_GUIDE.md](../../../docs/DEVELOPMENT_GUIDE.md), and the
[team workflow](../../../docs/AGENT_TEAM_WORKFLOW.md). Resolve these paths from the
repository root when the client does not resolve skill-relative links.

Use the existing `docs/governance/task-contract.schema.v1.json` and template.
The coordinator supplies a base-retained or external immutable contract with its
raw SHA-256. Never edit an implementation branch's contract to widen scope.
Record the selected native approach, canonical authority, named consumer, rejected
shortcut, expected failure behavior and unresolved conflicts before implementation.

Require an assignment naming outcome, write ownership, forbidden paths, exact base,
merged dependencies, integration/merge order, focused tests and stop conditions.
One small task owns one branch/worktree and one PR. Only the coordinator makes
authorized Git/PR mutations; workers do not stage, commit, push or switch branches.
Initially only one implementation writer is allowed. Helpers are read-only.

Implement within the contract; read complete affected SDD requirements and ADRs
before product code changes. Run only the declared focused validation and record
actual commands, exit status, totals and limitations. Never treat a planned test
as evidence or run broad validation because it happens to be available.

Pause implementation for independent verification of the exact final diff,
including staged, unstaged and untracked work. Supply the contract, native identity,
repository authority and evidence. A material change invalidates a previous verdict.
Only the coordinator retains returned verdict content and performs the native
`governance:verify` reconciliation. Never issue an implementer PASS.

On FAIL, allow at most one consolidated correction and one verifier rerun under
existing task authority; stop if the rerun is not PASS. GitHub review, CI, product
acceptance and explicit merge authority remain separate gates. Do not request a
second automatic review. A PASS is necessary but does not itself authorize a commit,
push or merge. Honor earlier user checkpoints, including leaving work uncommitted.

Report the outcome, branch/PR, SHA, changed modules, exact focused totals,
typecheck/lint/format status when run, limitations and safeguards. Stop at the
assigned checkpoint without starting a successor or recursively delegating.
