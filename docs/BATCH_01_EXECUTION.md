# BATCH-01 execution record

BATCH-01 is an owner-approved two-child pilot. The [roadmap](VESKIFY_DEVELOPMENT_ROADMAP.md)
retains delivery order and the [tracker](VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md) remains the sole
status authority; this file records no mutable task status.

1. AR-02A separates live renderer observation and report composition while preserving conformance.
2. AR-03A may start only after AR-02A has an explicit owner-authorized or independently confirmed
   merge, a clean sequential worktree boundary, and a fresh contract at actual `origin/main`.

AR-02A evidence is its [contract](governance/task-contracts/AR/AR-02A.json),
[approach](AR_02A_APPROACH.md), and [implementation report](AR_02A_IMPLEMENTATION_REPORT.md).
The AR-03A evidence is its [contract](governance/task-contracts/AR/AR-03A.json),
[approach](AR_03A_APPROACH.md), and [implementation report](AR_03A_IMPLEMENTATION_REPORT.md).
The clean boundary ends prior worker/verifier turns and requires clean index, tracked, and untracked
state before a fresh worker/verifier reads AR-03A's new contract.

The coordinator uses existing worker, helper, and independent-verifier roles. There is one writer,
separate branches and PRs, one automatic review per PR, one bounded CI/review wait per submitted
head, and explicit owner approval before every merge. CI observations are at least two minutes
apart, capped at 60 minutes and 30 observations per head; exhaustion records `WAITING_EXTERNAL`.
One independent-verifier FAIL permits one correction and rerun. One later GitHub-review correction
reruns affected checks and independent verification. The same verifier may repair an artifact-only
verdict with unchanged code. No settings, permissions, provider/Vesko, publication, or deployment
authority is added. The pilot ends after AR-03A; it does not mark parents complete or select a third
task.
