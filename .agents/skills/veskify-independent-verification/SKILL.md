---
name: veskify-independent-verification
description: Independently check a paused Veskify task against its immutable native contract, complete diff and evidence; return a criterion-level verdict without modifying implementation.
---

Read the immutable task contract first, then [AGENTS.md](../../../AGENTS.md),
[DEVELOPMENT_GUIDE.md](../../../docs/DEVELOPMENT_GUIDE.md) section 4 and the
[team workflow](../../../docs/AGENT_TEAM_WORKFLOW.md). Use the existing
`docs/governance/verifier-verdict.schema.v1.json` and template; do not create a
parallel verdict format. Resolve authority paths from the repository root.

Require the coordinator to pause every implementation writer and supply the
contract path/raw SHA-256, base/HEAD/branch, complete native diff identity and
claimed evidence. Confirm that the actual session workspace is the assigned isolated
task worktree and that the current execution/output policy loaded in the active
custom role. Reading a changed TOML does not prove a running child reloaded it.
After policy changes, use a new configured verifier; stop before full verification
if its active instructions or workspace cannot be confirmed. Inspect all changed
paths, including untracked work, and distinguish pre-existing user inputs without
hiding them from the fingerprint. Freeze the complete reviewed input hashes before
checks and compare them afterward.

Check every acceptance criterion against repository behavior and authority.
Challenge convenient shortcuts and implementation-tailored tests. Reproduce the
smallest sufficient permitted validation; examine negative behavior, compatibility,
ownership, migrations and scope where relevant. Use actual results and file:line
references. Do not run undeclared full suites, provider/Vesko calls or deployment.

Execute the declared checks yourself, including required focused test commands;
coordinator or implementer results do not establish independent test execution.
The verifier requests `workspace-write` with network access disabled in its assigned
worktree. It may create only the checks' identified generated cache, temporary-fixture
and report outputs. The assignment must name those output paths before execution.

Never edit reviewed source, tests, docs, configuration, contracts or accepted
fixtures, including your own rules. Only the coordinator/implementer changes
verifier policy. Do not mutate Git/PR state, call mutating connectors or delegate
recursively. Native verdict retention and reconciliation belong to the coordinator.

Normal narrowly scoped approval requests for a declared check are permitted only
when the task owner explicitly authorized that action. Inherit managed/runtime
approval policy. Never grant global access, Full Access, blanket command approvals
or persistent prefixes, new network access, or bypass managed/runtime policy.
If the authorized check cannot run under those policies, report BLOCKED with the
exact failing operation and sanitized error; do not use an indirect workaround.

Workspace-write does **not** enforce source-file immutability. Frozen hashes and
observed actions provide integrity evidence, not proof of a read-only filesystem.
Report observable model/reasoning and effective permissions separately from
configured defaults or instructions; use "not independently observable" where
runtime metadata is absent. Delegation tools may remain exposed and must not be
used. Configuration alone is never proof of active-role loading or enforcement.

Return native verdict content to the coordinator for authorized retention outside
the implementation tree. Bind it to the exact native contract fingerprint and
implementation identity; cover all criteria, evidence IDs, actual commands and
unsupported claims. PASS requires sufficient independent evidence and no unresolved
blocking finding. Missing proof is not PASS. FAIL reports concrete discrepancies;
BLOCKED reports the evidence or access needed to finish.

A material implementation change invalidates the verdict. The coordinator may
perform one consolidated correction and one rerun within the authorized correction
budget; the verifier never fixes the implementation itself. Semantic PASS does not
replace the one automatic GitHub review, CI, product-owner checkpoint or explicit
merge authority. Stop after returning the verdict.
