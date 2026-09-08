# AR-02D implementation report

AR-02D moves renderer-independent declarations for the nine legacy homepage definitions and the
legacy hero into renderer-free metadata leaves. The existing runtime modules retain context checks,
reference validation, JSX renderers, public schema exports, definition groups, and behavior.

The [locked contract](governance/task-contracts/AR/AR-02D.json) records the exact commands and
criteria; the [pre-implementation approach](AR_02D_APPROACH.md) records baseline provenance and
the fixed contract hash. Implementer validation passed all twelve declared checks: **747 tests
across eleven files**, plus **one separate complete-observation test**, typecheck, focused lint
and formatting, full-diff whitespace, architecture/status, requirements/tooling, documentation
and deterministic SDD/tracker export checks. The earlier five-test development run overlaps the
final suite and is not added to its total. No local full suite, build or browser campaign ran.

The repeatable pre-edit observation is compared byte-for-byte after the extraction: 10 affected
definitions and adaptations, 29 V2 definitions and manifest entries, 80 EN/FI renders, 33 live
registrations, 52 conformance findings, and seven negative observations. Runtime closure tests prove
the two metadata leaves do not reach renderer, registry, Puck, UI, CSS, or acceptance modules.

Production scope is four files, **+645/-465 lines**, counting moves. Handwritten additions exceed
the 1,500-line soft target but remain within the 2,500-addition/1,500-deletion hard limits; only
the two existing DOCX exports are excluded. The final native identity records complete counts.
The nine original untracked inputs, 477 prior evidence files and all unowned sources remain
unchanged. Existing exporters regenerated the DOCX outputs after their source projections changed.
Detailed command logs and before/after material are retained in the approved external
`BATCH-03/AR-02D` evidence directory. These records contain task evidence, not private input contents.

The V2 registry still imports the legacy rendering registry. AR-02F owns cutting that edge after the
remaining commerce metadata work. AR-02 and AR-03 remain Partial; AR-23 remains eligible and
unstarted. This report records implementation evidence only; independent verification, commit, PR,
CI, and explicit merge authority remain separate gates.
