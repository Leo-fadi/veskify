# Local Codex team workflow

The main IDE conversation coordinates one approved small task on one branch/worktree
and one PR. [AGENTS.md](../AGENTS.md) and [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)
section 4 remain binding. This setup grants no continuous roadmap execution,
architecture adoption or automatic merge authority.

## Roles and model settings

| Role                 | Model           | Reasoning                                                | Responsibility                                                           |
| -------------------- | --------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Main IDE coordinator | `gpt-6-astra`   | Select explicitly in the IDE; medium is a starting point | Task authority, assignments, integration and authorized Git/PR mutations |
| `veskify_worker`     | `gpt-5.6-terra` | `medium`                                                 | One bounded implementation assignment                                    |
| `veskify_helper_a`   | `gpt-5.6-terra` | `high`                                                   | Read-only dependency tracing and difficult investigation                 |
| `veskify_helper_b`   | `gpt-5.6-luna`  | `low`                                                    | Read-only narrow research and evidence checks                            |
| `veskify_verifier`   | `gpt-6-astra`   | `high`                                                   | Independent requirements, diff and evidence verification                 |

Standalone role files live in `.codex/agents/`; each pins model and effort so parent
Ultra cannot be inherited accidentally. The project caps open child threads at
three, excluding the coordinator; four role definitions do not require four
simultaneous children. Generic children default to Terra/medium. Children disable
their own agent tools and are instructed not to delegate recursively.

Keep Astra selection in the main conversation. Do not silently substitute another
model or reasoning level if a role is unavailable. Distinguish a configured ID,
a catalogue entry, an accepted spawn request and actual runtime model/effort metadata.
The current checkpoint's observations are in [AGTEAM_01_SETUP_REPORT.md](AGTEAM_01_SETUP_REPORT.md).

## Assign and deliver

Each assignment states the outcome, owned write files (or none), allowed read paths,
forbidden files/contracts, exact branch/base, merged dependencies, integration
impact and merge order, focused tests/evidence, and stop conditions. Reference the
locked native contract; do not copy the entire architecture package into prompts.

Initially there is one implementation writer. If the worker writes, the coordinator
does not edit implementation concurrently. Helpers have no write ownership. The
verifier begins after all implementation is paused. Future concurrent writing needs
explicit disjoint ownership and isolated worktrees within the existing repository
limits; this setup creates no extra worktrees and does not expand those limits.
Dependent branches and implementation wait for dependency merges.

Use [veskify-task-delivery](../.agents/skills/veskify-task-delivery/SKILL.md).
Lock the native task contract before implementation, then record the native approach,
canonical authority, named current consumer, rejected shortcut, expected failure
behavior and unresolved conflicts. An immutable contract is either present at the
approved base or is a regular external file pinned by its raw SHA-256. Do not edit
it from its implementation branch. Follow the existing canonical commands:

```bash
pnpm governance:contract --contract <path> --expected-file-sha256 <sha256>
pnpm governance:identity --contract <path> --expected-file-sha256 <sha256>
pnpm governance:verify --contract <path> --expected-file-sha256 <sha256> --verdict <path>
```

Only the coordinator performs authorized Git/PR mutations, including staging,
branch/worktree changes, commits, pushes, PR updates and merges. Updating an eligible
branch uses `git fetch origin` followed by `git merge origin/main`; never rebase or
force-push. Preserve unrelated user work and reuse an existing owning PR.

## Independent verification

Use [veskify-independent-verification](../.agents/skills/veskify-independent-verification/SKILL.md).
Supply the locked contract, applicable repository authority, complete final diff and
native identity, and claimed evidence. Include untracked/staged/unstaged state.
Identify pre-existing user inputs and verify their preserved bytes; do not conceal
them from the canonical identity. The verifier reproduces the smallest sufficient
permitted checks and returns native criterion-level PASS, FAIL or BLOCKED without
editing implementation. The coordinator may retain that returned verdict externally.

A material implementation change invalidates the previous verdict. After FAIL,
allow at most one consolidated correction and one verifier rerun under existing
authority, then stop if it is not PASS. A semantic PASS is required before commit/push
but is not permission to perform them. User checkpoints take precedence. Keep exactly
one automatic GitHub review, one focused correction pass, required CI, product-owner
acceptance and explicit merge authority as separate gates. Merge sequentially only
when authorized; do not continuously watch CI or request a second automatic review.

## Permissions and activation

Worker permissions inherit from the parent. Helpers and verifier configure
`sandbox_mode = "read-only"`. These are configuration requests, not proof of
effective isolation: parent runtime overrides can take precedence, and filesystem
sandboxes do not establish read-only connector permissions. The instructions also
prohibit file/Git/PR/connector mutations, permission changes and recursive delegation.
Never present prompt-only restraint as enforced sandbox security.

Inspect effective client metadata when observable. If isolation or a required check
cannot be established, report the limitation; do not grant broader permissions,
change global configuration or issue a write probe to make the exercise pass.
No provider/Vesko/deployment activity follows from a development-team assignment.

If the current client's role-discovery/spawn interface does not expose these roles,
report **configured; activation pending** and stop. Start a new IDE conversation in
this repository when Leo resumes; reload the IDE only if that conversation still
does not discover them. Do not relabel a generic child as a successfully loaded role.

Once custom roles are actually selectable, the AGTEAM-01 read-only exercise is:

| Role     | Bounded assignment                                                                           | Required result                                                           |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Worker   | Identify the existing task-delivery procedure                                                | File references and delivery gates; no edits                              |
| Helper A | Identify branch and concurrency restrictions                                                 | File references and exact writer limits                                   |
| Helper B | Locate the outdated A-10C package instruction                                                | Exact package references and current status authority                     |
| Verifier | After other children finish and writers pause, check their findings and the final setup diff | Native verdict covering scope, conflicts, evidence and permission leakage |

Use short assignments, no recursive delegation and at most three open child threads.
Record actual model/effort and effective permissions for each. Close finished child
sessions using the client's supported control; if closing is unavailable, report
that limitation and ensure no child turn is running. Stop after the checkpoint.
AGTEAM-01 specifically leaves all changes uncommitted: no push, PR or merge.

## Official configuration sources

Checked on 6 September 2026: [custom agents and inheritance](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[configuration keys](https://learn.chatgpt.com/docs/config-file/config-reference),
[model IDs and IDE selection](https://learn.chatgpt.com/docs/models), and
[local skills and discovery](https://developers.openai.com/codex/skills).
Client support and account availability must still be observed locally.
