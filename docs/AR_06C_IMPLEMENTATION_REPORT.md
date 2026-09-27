# AR-06C implementation report

## CI correction checkpoint

PR #261's first CI run, `36351310293`, passed unit/integration, static and production
budget gates but failed nine C browser cases at the unchanged 30-second test limit.
The retained browser report shows 13.7–14.4 seconds spent in nine individual typing
steps for each offset journey, and 18.4 seconds in the stale-page journey. The offset
cases completed edit, reorder and save before timing out during fresh-page reopen.
This is cumulative test interaction cost, not evidence of a repository rejection or
an established infrastructure failure. The complete failed CI evidence is retained.

Only the task-owned browser helper and C spec change: C explicitly replaces the real
Puck text field's value through Playwright `fill`, then asserts focus, the exact full
text and its editor/preview projections. B retains its existing default sequential
typing, caret and per-character focus checks. No timeout, retry, content, drag,
readiness, geometry, persistence assertion, production file or budget changes.

The fresh complete coordinator campaign passes **12/12** in 3.0 minutes, with eight
new original post-reload captures. The corrected candidate requires its own full
independent browser execution and direct inspection of all eight images; previous
captures are evidence of their original candidate. Production-build proof may be
reused only after independent input and artifact applicability checks. The final
correction report, native reconciliation and final-head CI are retained separately
from the earlier reports below. The one automatic review completed without findings;
no second review is requested. Accepted merge remains a separate delivery gate.

At this checkpoint five local browser invocations and three complete capture sets
are counted. Production builds remain three. AR-06 remains Partial.

## Independent verification checkpoint

This earlier checkpoint describes the pre-CI-correction candidate and retains its
original report identities and execution attribution.

The guarded composed static draft can be edited, explicitly saved and reopened from
real IndexedDB in a fresh page and repository instance. Independent verification and
native reconciliation pass for the preserved candidate; final documentary verification,
the single automatic review, final-head CI and accepted merge remain separate gates.
AR-06C closes only upon accepted delivery. AR-06 remains Partial for history/lifecycle,
publication, normal Studio rollout and executable-commerce support.

The verifier independently executed all 21 declared validations: **959 focused tests**
passed, with five intentionally unselected cases in the scoped A-10A test; the full
browser campaign passed **12/12**. All eight original offset captures were directly
inspected across EN/FI and 375/768/1024/1440, alongside compact stack, unsaved-loss and
stale-save checks. The 120 support controls, typecheck, lint, formatting and documentation
checks passed. Original coordinator 12/12 evidence retains its separate attribution.

The complete verifier-authored report has SHA-256
`1ee63accade7ac6fb3f0e35e1b7d64fe3bc7a509cd047ffd51a2335c41285822`;
its provenance binds direct authoring and actual execution. Native reconciliation
SHA-256 is `1dfef4029d530805fa46d14d5afb8e6cf6e56c66e9b65e4adabb0c923dbc5624`.
These identities describe the pre-documentary-update candidate; final documentation
receives separate verification with explicit applicability of unchanged product proof.

The fresh independent production build passes all six budgets under the five explicitly
approved raw-limit increases. Every gzip limit, editor limit and measurement rule is
unchanged. Earlier budget failures remain failures; this is a policy amendment, not
an optimization. Final measurements and deltas from the identity-verified accepted
base build are:

| Route           | Final raw / gzip    | Delta from accepted base raw / gzip | Headroom raw / gzip |
| --------------- | ------------------- | ----------------------------------- | ------------------- |
| home            | 1,600,379 / 434,683 | +3,837 / +2,546                     | 1,621 / 15,317      |
| content-utility | 1,600,379 / 434,683 | +3,837 / +2,546                     | 1,621 / 15,317      |
| search          | 1,658,745 / 453,318 | +3,837 / +2,545                     | 1,255 / 21,682      |
| collection      | 1,651,036 / 450,554 | +3,837 / +2,543                     | 1,964 / 24,446      |
| product         | 1,651,546 / 450,685 | +3,837 / +2,544                     | 1,454 / 24,315      |
| editor          | 2,807,267 / 760,186 | +3,907 / +2,567                     | 42,733 / 64,814     |

The production route returns 404 with the acceptance flag enabled. Nine client manifests
pass isolation checks; 48 NFT traces contain 6,541 validated entries, with 129 chunk
references resolving to 33 unique chunks. The approved deterministic A fixture and C
proof source remain identity-verified server packaging entries. Neither the 404 nor
client isolation proves server-source absence or impossibility of execution. Development
no-cache/must-revalidate does not establish storage prevention or shared-cache exclusion.

Four browser invocations and three production builds are counted; two complete C image
sets are retained. The initial approval denial, failed browser attempts and capacity
observations remain unchanged. A reconciled explicit execution assignment received
normal approval. Completed export caches and redundant dependencies were retired only
after integrity/inactivity/reinstallability checks; source, screenshots, logs, compiled
proof, original dependencies and prior inventories remain. The later worktree-retirement
step was skipped when measured capacity fit. No package-store or unrelated-project
cleanup occurred.

## Coordinator checkpoint retained below

The following record predates the independent results above. Its pending statements
and earlier measurements describe that original checkpoint, not the final proof.

The uncommitted candidate on `codex/ar-06c-composed-draft-persistence` implements
explicit static-composition repository capability, whole-snapshot draft save,
transactional stale-state checks, mixed retained history and a guarded real
IndexedDB save/reopen surface. It reuses the accepted Puck editor and renderer.
Its predecessor AR-06B was accepted through PR #260, head
`afd20c0e85b47a39afcf520c87d68108e97b4c7e`, merge and current task base
`e2addffc29f7719e23e9e7856ecf7c739924501f`.

Two coordinator production builds completed, but the unchanged all-six-route
checker failed five raw-byte ceilings on both candidates. The owner-authorized
correction moves material-only capability issuance and its private WeakMap into
`composed-draft-repository-support.ts`, preserving runtime exports, authenticated
lookup, error identity and repository safety checks. It did not reduce the measured
bundle. The storage index remains unchanged.

Against the original ceilings, home and content each exceed by 379 bytes, search by 3,745, collection by
1,034 and product by 1,546. Editor raw and every gzip ceiling pass. The initial
3,834-byte common storefront increase comprises 1,371 bytes of emitted generic
repository/capability support, 2,441 bytes of changed shared-chunk partitioning,
24 bytes of deferred-import mapping and a two-byte wrapper reduction. The full
composed policy and acceptance client are absent from normal measured chunk sets;
this limited observation does not replace final trace or production-404 proof.
The correction leaves the 2,441-byte partition remainder unchanged and adds three
raw bytes per route (one for collection). No specific second correction is
supported by the bounded source/artifact investigation.

The persistent `budget-decision-01` packet retains exact baseline and both candidate
measurements, importing roots, chunk identities, attribution limits and its original
unapplied exact-minimum proposal. Baseline source/assets/configuration were checked
against the accepted Git tree without repeating its build or changing its identity.

The owner subsequently approved a substantive five-limit raw-budget policy with
bounded headroom, replacing that proposal. Home/content ceilings are now 1,602,000,
search 1,660,000 and collection/product 1,653,000. Every gzip ceiling, editor raw
ceiling, route, collection/compression/integrity check and failure algorithm is
unchanged. No further automatic increases are authorized. This is not a performance
optimization, and the two original budget failures remain failures.

After verifying source/dependency/artifact identities, `budget-policy-01` ran the
exact amended checker against the actual retained candidate-02 artifacts through
a separate measurement view. All six routes pass the new policy, with these raw /
gzip bytes and raw / gzip headroom:

| Route           | Measured raw / gzip | Headroom raw / gzip |
| --------------- | ------------------- | ------------------- |
| Home            | 1,600,379 / 434,682 | 1,621 / 15,318      |
| Content utility | 1,600,379 / 434,682 | 1,621 / 15,318      |
| Search          | 1,658,745 / 453,316 | 1,255 / 21,684      |
| Collection      | 1,651,034 / 450,554 | 1,966 / 24,446      |
| Product         | 1,651,546 / 450,684 | 1,454 / 24,316      |
| Editor          | 2,807,267 / 760,185 | 42,733 / 64,815     |

This policy-only measurement consumed no build slot and is not a new build
execution. The remaining coordinator slot is preserved; the independent final-source
production build remains mandatory. Build configuration and dependencies are unchanged.

Fresh coordinator checks for the correction passed 14/14 capability/persistence
tests, 101/101 legacy repository/save tests and 185/185 accepted A/B/authority
checks, plus typecheck, lint, formatting and scope integrity. Earlier failures,
their focused corrections and documentation checks remain retained under their
original identities. This does not claim a completed final independent campaign.
The current-status test maintenance and its actual results are recorded separately.
The new checker regression passed 15/15 controls using the actual script on synthetic
artifacts: exact raw boundaries, one-byte overruns, gzip rejection for all six routes,
unchanged editor limits and missing artifacts. A test subprocess environment typing
error was corrected; its failed typecheck remains retained. Fresh affected typecheck,
lint and formatting pass.

The full browser spec discovers twelve tests. Its first coordinator invocation
failed because the save-status locator also matched Puck and drag-announcement
status elements. The run was stopped after seven failures; one case was interrupted
and four were unrun. The task-owned spec now selects the proof's own status
paragraph and requires exactly one match, preserving the expected save/conflict
messages and timeouts. Affected lint, formatting, typecheck and scope checks pass.
The next full campaign passed eleven cases; compact EN reached saved-draft reopen
but exhausted its unchanged timeout during a duplicate post-focus image-readiness
walk. The C-only spec now retains the full initial lazy-image/decode pass and checks
every current image's successful decode, stable element/source and positive dimensions
in a bounded per-document capture check. No product, drag, fixture or timeout change
was needed. Both failed campaigns and their traces remain retained.

The corrected full coordinator campaign passes **12/12** tests: offset EN/FI at all
four widths, compact stack in both locales, unsaved-edit loss and stale-save rejection.
Its eight original post-reload images, canonical identities, observations and boards
are retained with exact source/dependency identities. Independent direct inspection
of all eight images and independent full execution remain mandatory; coordinator
success and comparison boards do not replace them.

Browser count at this coordinator checkpoint is three of twelve, with one complete
eight-image capture set. Two of
six production-build starts are used (coordinator two of three, independent zero
of three). No independent final build/report, native reconciliation, CI, PR or merge
has occurred at this checkpoint. The candidate, original contract and semantic successors, support
identities and failed artifacts remain preserved. The original `budget-blocker-01`
and `budget-decision-01` checkpoints are unchanged; `budget-policy-01` records the
later approved-policy result. Authorized disposable dependencies/cache from the
completed coordinator builds and first browser export were retired with append-only
records. Source, compiled artifacts, traces, measurements and other proof remain;
the old exported dependency installations are no longer fully present. A later
browser-only capacity estimate uses twice the larger observed C browser working-space
decline, fresh materialization, 512 MiB miscellaneous allowance and the unchanged
2 GiB reserve. Its sampling/shared-filesystem uncertainty is explicit. Production-build
capacity accounting remains unchanged; no evidence or execution allowance was reset.

AR-06C is unfinished. AR-06 remains Partial for composed save/reload acceptance,
history/lifecycle/publication integration, normal Studio rollout and executable
commerce obligations. This guarded candidate makes no production-save or
publication enablement claim. AR-02/03/04/05 and AR-06A/B remain closed.
