# AR-00 implementation approach

**Task:** AR-00 — Adopt template-scoped architecture and replacement roadmap

**Locked authority:** external immutable review-06 contract `AR-00.json`, SHA-256 `e2a914bcf7a03bf90f76cbb213099a6c3979c96b8540b8cc86390cea1a78e021`

**Base:** `db95f7c055217d380e88cebe50256741905d222c`

## Active PR #236 review correction

Reviewed head: `5bbd5888795ad227fa5708fa40f16f6515eb0ebf`. The owner authorizes one focused
correction of the two automatic-review findings and a fresh independent verification. The PR
remains proposed adoption; neither owner acceptance nor merge is asserted by this document.

The new canonical fingerprint is `veskify-task-contract-v1_33dae282b2f88769da4d2156ae6ad23338b15a1ec75f6778e207901f856e5d86`.
The prior external contract, raw pin and lock are preserved unchanged in
`/private/tmp/veskify-ar-00/original-authority-03/`. `review-06-reissue-proof.json` records the
only parsed changes: AC-03's status-timing clause and one authorization-provenance entry.
All other criteria, dependencies, scope limits, paths, permissions and required commands remain
unchanged. The candidate was formatted and validated with native schema tools before repinning.

The tracker and current notices encode the repository state effective upon explicit owner
adoption/merge: AR-00 Baseline / closed; AR-01 Planned / exact next, not started; other tasks
unchanged, including AR-23's sole AR-01 dependency. The existing guard checks those committed
values offline. The named consumer is documentation validation on the adopted repository.
Rejected shortcuts are a follow-up status-fix commit, network or branch detection, retaining the
obsolete pending-state assertion, and altering Git whitespace settings or formatter exclusions.
The guard must reject obsolete pending/active state and preserve all ownership/history checks.
There is no unresolved architectural conflict; this correction changes status timing only.

The exact locked whitespace command previously missed new untracked Markdown; after the files
were committed it reproduces exit 2 under default Git rules. New hard-break spaces become plain
paragraphs. Complete-diff proof uses an isolated temporary Git index and object directory covering
every tracked and untracked proposed file. It neither stages the real index nor modifies Git
configuration. The independent verifier must reproduce this additional owner-required check.

All prior results retain their original identities. The remaining authority/process history below
is retained context; previous pending activation and submission actions are historical. No new
permission change, activation exercise or automatic-review request is authorized.

## Historical reissue-03 authority and retained architecture decision

At its historical checkpoint, reissue-03 authorized the bounded guard correction and verifier-policy repair.
Its canonical fingerprint is `veskify-task-contract-v1_650a6c2c0ca6c1fc5ced06fb02bf6a9b9cb056e7db604a72a5728c7bf7a45608`.
All seven acceptance criteria, EVIDENCE-02=document, base commit, architectural meaning and
approved dependencies remain unchanged; VALIDATION-07 remains byte-for-byte the same command.
The precise delta adds only the three named verifier-policy files to exact path authority,
clarifies permitted generated outputs and scoped approvals, and records one additional owner-authorized
correction cycle and one fresh verifier run. Formatting coverage includes the two policy Markdown
files; VALIDATION-13 parses the TOML using existing Python 3.13.2 without installing anything.
The native review-policy count remains one for this specifically authorized cycle; prior exhausted
cycles and FAIL/BLOCKED results are preserved, not reset or relabeled.

Original authority-01 remains archived at raw SHA-256
`49655b2ca6dfa89ed49052483ff2f0f6281260df46c5f0bded1e555dd88a2af0`, canonical
`veskify-task-contract-v1_cf508c14cdb3f5443af963c8acb2fc303cc995b4800c7b12aefde2e6c427e471`.
Authority-02 remains archived at raw SHA-256
`1fb010152ccf6d990664dcb761e36fe7d3aa04dccb9e883627854bdbe04b4906`, canonical `veskify-task-contract-v1_544b124e281d80f748b5ddcf361384a743efaa44a10d71efccc1739c7e543b85`;
its one-field EVIDENCE-02 correction is retained. Reissue-03 was formatted and schema-validated
before pinning. Exact earlier approach/report bytes remain recoverable in external evidence.

The owner-authorized amendment is incorporated through one normative SDD addendum. The SDD remains the architecture authority; the development roadmap retains delivery order and detailed task outcomes, dependencies, acceptance, non-goals, and retirement gates; the delivery tracker alone owns current status. The nine supplied reset-package files are source evidence only. Their hashes and dispositions are recorded in committed documentation so a clone does not depend on the untracked source folder or temporary files.

The amendment changes only future policy authorized by the locked task: template-scoped compilation with one atomic proposal acceptance; durable bounded operational records outside the editable snapshot; default one concept; two initial complete families; and the staged AR delivery sequence. It retains the canonical `StorefrontSnapshot`, `BrandSystem`/Design DNA, `PageBlueprint`, controlled component capability source, Puck adapter boundary, protected commerce authority, accepted P19 architecture, and accepted A-10C closure.

## Decision crosswalk

| Approved decision                                          | Canonical incorporation                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| One editable snapshot and one composition authority        | Normative addendum and retained SDD requirements                       |
| Template-scoped compilation with staged repair             | Addendum and AR roadmap acceptance gates                               |
| Durable operational runs without competing design state    | Addendum and AR operational work packages                              |
| Current commerce freshness with legacy replay              | Addendum and roadmap dependency/freshness outcomes                     |
| Host-neutral resource resolution                           | Addendum; no Vesko endpoint, datastore, queue, or checkout is invented |
| Two complete first families; four deferred families        | Roadmap and source-disposition coverage                                |
| AR-01 next; AR-23 after AR-01 without visual serialization | Roadmap dependency table and tracker status projection                 |

## Rejected shortcuts

- Applying stale A-10C deprecation instructions or editing the fingerprinted P19 architecture, closure manifest, fixtures, metrics, or source.
- Treating the untracked source package, absent handoff files, or temporary evidence as operative dependencies.
- Adding a second snapshot, composition language, registry, status graph, host topology, queue, datastore, or checkout.
- Weakening historical guards or modifying their fixtures to make the new policy pass.
- Broad source refactoring, successor implementation, or automatic task progression.

## Failure behavior and conflicts

The focused guard fails on contradictory current status, task/dependency coverage, AR-23 visual serialization, or changed P19/A-10C closure authority. The documentation validator resolves local Markdown links. The guard preserves historical B-01 statements as event evidence while removing their current scheduling authority. Any amendment beyond the supplied delta, unexpected path, missing dependency, budget overrun, unavailable required verification, or changed protected bytes stops this task.

The existing transient-only, three-concept, and 73-child future wording conflicts with the owner-authorized delta. This amendment resolves only those future-policy conflicts: operational persistence replaces transient-only wording, staged compiler acceptance replaces a monolithic assumption, one concept is the default, two initial families replace the future 73-child ordering. No current product capability is reclassified.

## Scope and validation

The locked scope permits 23 exact paths: 21 text/tooling/document paths and two deterministic DOCX exports. The three additional verifier-policy paths were applied exactly once through normal approval after subsequent informed owner authorization. The original rejection and proposed bytes remain historical evidence; fresh task-worktree activation is pending. Budget: target at most 4,000 added and 1,000 deleted text lines; hard stop at 5,500 added or 1,500 deleted text lines; zero production files. The required commands are exactly:

1. `node scripts/check-architecture-reset-adoption.mjs`
2. `pnpm docs:check:requirements`
3. `pnpm docs:check:tooling`
4. `pnpm docs:check:sdd`
5. `pnpm docs:check:tracker`
6. `pnpm docs:validate`
7. `pnpm exec vitest run tests/unit/ar-00-architecture-reset-adoption.test.ts tests/unit/p10b-19a-10c-closure-manifest.test.ts tests/integration/p10b-19a-10c-architecture-closure.test.ts`
8. `pnpm exec eslint scripts/check-architecture-reset-adoption.mjs scripts/validate-documentation.mjs scripts/export-sdd-docx.mjs scripts/export-development-delivery-tracker-docx.mjs tests/unit/ar-00-architecture-reset-adoption.test.ts`
9. `pnpm exec prettier --check AGENTS.md README.md docs/VESKIFY_SDD.md docs/VESKIFY_DEVELOPMENT_ROADMAP.md docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md docs/DEVELOPMENT_GUIDE.md docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md docs/AR_00_SOURCE_DISPOSITION_AND_ACCEPTANCE.md scripts/check-architecture-reset-adoption.mjs scripts/validate-documentation.mjs scripts/export-sdd-docx.mjs scripts/export-development-delivery-tracker-docx.mjs tests/unit/ar-00-architecture-reset-adoption.test.ts docs/governance/task-contracts/AR/AR-00.json docs/AR_00_APPROACH.md docs/AR_00_IMPLEMENTATION_REPORT.md .agents/skills/veskify-independent-verification/SKILL.md docs/AGENT_TEAM_WORKFLOW.md`
10. `git diff --check db95f7c055217d380e88cebe50256741905d222c`
11. `node scripts/task-governance.mjs contract --contract /private/tmp/veskify-ar-00/AR-00.json --expected-file-sha256 "$(cat /private/tmp/veskify-ar-00/contract.sha256)"`
12. `node scripts/task-governance.mjs identity --contract /private/tmp/veskify-ar-00/AR-00.json --expected-file-sha256 "$(cat /private/tmp/veskify-ar-00/contract.sha256)"`
13. `/opt/homebrew/bin/python3.13 -c 'import pathlib,tomllib; p=pathlib.Path(".codex/agents/veskify_verifier.toml"); c=tomllib.loads(p.read_text()); assert c["name"] == "veskify_verifier"; assert c["model"] == "gpt-6-astra"; assert c["model_reasoning_effort"] == "high"; assert c["sandbox_mode"] == "workspace-write"; assert c["sandbox_workspace_write"]["network_access"] is False; assert c["agents"]["enabled"] is False; assert "approval_policy" not in c; assert "writable_roots" not in c["sandbox_workspace_write"]; print("Verifier TOML parsed; model/effort retained, workspace-write/network-off requested, runtime approval policy inherited; effective enforcement is not proven")'`

Independent verification is required after the exact final diff is frozen. This document does not claim that verdict.

## Current correction and execution blocker

The guard collects current status and dependency declarations across declared current-policy surfaces,
compares them with the approved task/status/dependency authority and preserves clearly identified
historical statements. Temporary-copy regressions reproduce all four verdict-02 false negatives and
cover added dependencies and current declarations beyond those examples. Existing closure fixtures,
production inactivity and frozen source hashes remain unchanged.

The proposed verifier requests workspace-write/network-off with unchanged Astra/high settings,
permits only declared generated outputs, prohibits reviewed-input and Git/PR edits, and retains
normal narrowly scoped approvals only for owner-authorized checks. Workspace-write cannot enforce
source-file immutability. The automatic approval rejection blocks activation of that proposal; no
alternate tool, agent or permission workaround was used. A new configured verifier must establish
active instructions and actual task-worktree readiness before full verification. The old blocked
child must not be reused. No fresh full verifier attempt or conditional Git action has occurred.

## Informed approval and current activation checkpoint

The owner accepted the disclosed persistent project-local workspace-write trade-off and explicitly
approved the exact three-file patch. Normal approval accepted its application; all three file hashes
match the approved candidates. No network access, extra writable roots, global change or runtime-policy
bypass was introduced. The preceding permission-blocker account remains historical. All six affected
configuration/documentation/native checks passed after application; independent test execution is
still pending. The active IDE workspace remains the coordinator checkout on main and the native
spawn interface cannot select a different worktree/configuration source. Open a new conversation
in the existing AR-00 worktree, confirm the fresh configured role and actual workspace, then perform
the authorized independent review. Do not reuse the blocked verifier or substitute implementer proof.
