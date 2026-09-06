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
claimed evidence. Inspect all changed paths, including untracked work, and
distinguish pre-existing user inputs without hiding them from the fingerprint.

Check every acceptance criterion against repository behavior and authority.
Challenge convenient shortcuts and implementation-tailored tests. Reproduce the
smallest sufficient permitted validation; examine negative behavior, compatibility,
ownership, migrations and scope where relevant. Use actual results and file:line
references. Do not run undeclared full suites, provider/Vesko calls or deployment.

Never edit implementation source, tests, configuration or docs to resolve findings.
Do not mutate Git/PR state, call mutating connectors or delegate recursively.
If a required check needs unavailable permissions, return BLOCKED with the exact
limitation; do not obtain broader permissions to make the check pass. Report
observable effective permissions separately from configured defaults or prose.

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
