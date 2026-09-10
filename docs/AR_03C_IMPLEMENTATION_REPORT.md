# AR-03C implementation report

Existing dynamic-commerce current-authority validation, page/section projection and
runtime resolution now have three adjacent owners. The project, collection, product
and search preview clients import their route functions from `route-resolution.ts`.
Their rendering, hooks, storage and runtime arguments are unchanged. The original
facade forwards the same public implementations and retains full migration,
selection/application, editor projection/apply and expansion.

All 45 original declarations match after relocation and internal exports are accounted
for. The new roots use existing direct schema/profile/V2 metadata and accepted B support
leaves. The profile materializer and exact historical compatibility upgrade remain
legitimate dependencies. Public functions/errors retain identity; internal helpers do
not become public facade exports. No route policy, persisted representation or renderer
implementation changes.

The pinned pre-edit observations cover 11 fixtures, 113 runtime routes, 661 editor
variant projections, 226 EN/FI runtime renders, 1,244 successful variant renders,
78 expected missing-campaign-media rejections, 132 fault/override controls and four
successful campaign renders. These include current and supported compatibility
fixtures. Baseline tests passed 38 cases in five files and 50 retained guards in seven
files; draft harness corrections remain preserved as pre-edit evidence.

Focused validation passed 872 tests across 26 repository files, including 26 new C
boundary cases; two historical matrix cases were deliberately excluded. Two external
observation tests passed. Final route/editor/render and metadata payloads match the
pre-edit baselines exactly; both historical replays passed. Typecheck, external harness
typecheck, focused ESLint and documentation/export checks passed. Initial test-only type/lint
failures are retained; the corrected C test passed all 26 cases again. The external evidence
retains actual command results under their original contract identity. Fresh independent
verification and native reconciliation bind the complete final diff to the replacement
contract before submission; PR review, CI and merge remain separate gates.

An owner-authorized semantic support amendment pins the full verified successor Git
config hash after proving one exact branch-metadata insertion and unchanged earlier
bytes. It changes only the config assertion, associated support pin and provenance;
17 synthetic cases challenge the actual config/support/protected-input assertions.
The original checker, support lock, contract identities and BLOCKED evidence remain
retained locally. Raw config and private evidence are excluded from public submission.
All six functional criteria, existing 17 commands, scope, budgets and merge gates are
unchanged; one declared synthetic support-regression command is added. Replacement
contract raw SHA-256 is `4fbbc59ce430062b2ebf5f69c924e6c5405a047fe8ddce66a639ab7c52822cbc`.

The nine original inputs, 1,495 prior evidence files, accepted B support and all
unrelated tracked files remain unchanged. Historical source archives, aggregate
fingerprints, transitions and replay destinations are preserved. Current documentation
projects C closure only upon gated acceptance/merge and batch completion only after
safe closeout. AR-02/03 remain Partial; AR-23 is eligible and unstarted. No successor
is selected.

Remaining work includes full migration, selection/application, editor and expand/fold
isolation, plus remaining compiler/materializer consumers. No measured bundle reduction,
new visual quality or live commerce freshness is claimed. Rollback reverts the eight-file
extraction and four import cutovers together. BATCH-05 ends only after C's verified merge
and safe closeout.
