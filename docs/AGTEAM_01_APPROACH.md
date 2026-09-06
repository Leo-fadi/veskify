# AGTEAM-01 implementation approach

## Current formatting-only reissue authority

On 6 September 2026 Leo explicitly authorized one formatting-only contract reissue,
necessary current-run hash references, one independent verifier rerun, and submission
of this same setup task only after independent and mechanical PASS. No merge or
semantic contract change is authorized. This current authority supersedes the
earlier checkpoint-only execution restrictions recorded below.

Use the existing external authority `/private/tmp/veskify-agteam-01/AGTEAM-01.json`
with fixed raw SHA-256
`2437d756b50f12ae829e751609866cb422dbeb8c359d3f4b6ffe9da83e828db8`.
`/private/tmp/veskify-agteam-01/contract.sha256` contains that literal pin; checks
read it rather than calculating a new expected hash. The repository copy is
byte-identical. The canonical fingerprint remains
`veskify-task-contract-v1_18885459d8ff7df7108c1d21cf72cb1a38ffb8c69fba38cc86d679b9c3b3d0a1`.
The [setup report](AGTEAM_01_SETUP_REPORT.md) records strict parsing/canonicalization
equivalence and lossless recovery of the original bytes. Previous BLOCKED/FAIL
evidence and the original pin below remain historical; they are not active pins.

## Original approach and authority (historical)

Recorded before configuration edits on 6 September 2026. This is engineering setup,
not adoption of the proposed architecture reset.

- Task/worktree: `AGTEAM-01`, `codex/agent-team-setup`, `/Users/leo/veskify`.
- Approved base and refreshed `origin/main`: `a665324b500b2d4e921a97bd4b33946d72297316`.
- Dependency: PR #234 / P10B-19A-10C, merged 6 September 2026 at 09:15:39 UTC.
- Existing open PRs: zero. No new branch, worktree or PR is needed for this checkpoint.
- Sole writer: main IDE coordinator. A generic Terra/medium helper inspected the native
  procedure without writing; that was preflight research, not custom-role activation proof.

## Locked task authority

The native executable accepts an immutable external regular-file contract. Use
`/private/tmp/veskify-agteam-01/AGTEAM-01.json`, raw SHA-256
`ea6e57185422c17ecc79ff7e22d26d2e963c01a2ac71cb221b86494099d8cad0`.
Its native identity is
`veskify-task-contract-v1_18885459d8ff7df7108c1d21cf72cb1a38ffb8c69fba38cc86d679b9c3b3d0a1`.
The contract preflight passed before implementation. The retained
[contract copy](governance/task-contracts/AGTEAM/AGTEAM-01.json) is documentary and
byte-identical; it did not exist at the approved base and must not be passed as a
base-retained contract on this branch. If the temporary copy expires, restore the
exact retained bytes outside the repository and verify the pinned hash first.

The schema requires a sprint ID; `AGTEAM` groups this single setup task only. It
does not adopt a sprint roadmap or authorize a successor. The nine pre-existing
untracked package files are explicitly allowed in the complete-diff inventory,
with their original hashes pinned in the contract. This grants no edit, staging,
adoption or PR authority over those supplied files. Unexpected hash drift stops work.

## Decision

Extend the delivery and verification procedure in `DEVELOPMENT_GUIDE.md` section 4
using supported project-local agent TOML, two instruction-only skills, and a concise
operating guide. The current consumers are the main IDE coordinator, one bounded
worker, two read-only helpers and a verifier that runs after implementation pauses.
Keep one implementation writer initially; helpers do not acquire write ownership.
Only the coordinator performs authorized Git/PR mutations.

Use explicit model IDs and efforts in every role. Keep the coordinator's model
selection in the main IDE conversation. Inspect the active session's runtime
metadata separately from extension files, bundled catalogues and cached models.
Check discovery without changing global settings or starting product work.

Rejected shortcuts: using generic delegated sessions as proof of custom roles;
claiming a separately installed CLI proves the IDE runtime; inheriting Ultra into
children; weakening permissions to make verification pass; duplicating governance;
executing AR-00; hiding supplied files from the native full-worktree identity.

Failure behavior: unsupported models/settings are reported without substitution.
Unavailable custom-role activation yields **configured; activation pending** and
stops this checkpoint. Prompt instructions are never described as enforced sandbox
permissions. A missing independent verdict cannot become a PASS. A material change
after a verdict invalidates it. Preserve the single consolidated correction/rerun
bound and explicit merge authority.

Unresolved architecture conflicts: none for this setup scope. The package's stale
A-10C assumption is a documented input discrepancy, not an instruction to change
the accepted baseline. Product source, architectural contracts, CI, dependencies,
roadmap, history and package bytes are outside implementation scope.

Validation is limited to native contract/identity checks, TOML/client discovery,
skill metadata, focused Markdown formatting/links, scope and preserved hashes.
Runtime role exercises occur only if the actual custom roles are available.
No product tests, full builds, provider tests, Vesko calls or deployment.
Leave everything uncommitted even if a verifier eventually passes.
