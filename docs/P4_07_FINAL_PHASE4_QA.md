# P4-07 — Final Phase 4 integration QA

## Verdict

**Phase 4 is ready for the defined standalone-demo scope.** The selected-section, current-page and
entire-storefront merchant workflows pass the focused application and browser gates after one
narrowly scoped selected-target fallback fix. The deterministic providers remain the default, the
real OpenAI boundary remains opt-in and server-owned, and accepted changes remain active-draft only
until the merchant explicitly saves and later publishes.

This report is an implementation and QA record. The authoritative contract remains
[`VESKIFY_SDD.md`](VESKIFY_SDD.md), especially §§6.3–6.5, 7.1–7.4, 12.7–12.10, 13.1–13.6,
16.4, 17.1–17.2, and 18–21; ADR-002 remains binding. The exercised traceability is FR-020–FR-028,
FR-040–FR-050; NFR-004 and NFR-006–NFR-010; and AC-004, AC-006, AC-008–AC-012, and
AC-016–AC-020.

## Tested baseline and architecture gate

The QA branch started clean at `b75c704`, exactly matching the fetched `origin/main`. Merged
history contains P4-01, P4-02, P4-03, P4-04, P4-QA-01, P4-05A/B/C/D, and P4-06.

The architecture inspection confirmed:

- deterministic page and storefront providers remain the application and test defaults;
- ordinary CI and local editor use require no API key;
- OpenAI selection, environment access, provider authority and fingerprints remain server-owned;
- selecting OpenAI without a key fails closed without deterministic fallback;
- React presents the canonical application lifecycle and complete active storefront rather than
  owning a second proposal or persisted page model;
- Puck remains an editor adapter and no canonical application/domain module imports Puck state;
- pending review, accepted composite history, stored draft and published state remain separate.

## Confirmed workflow invariants

### Selected section

- Section scope is enabled only for an eligible canonical selection.
- A page switch that removes the selected target now resets scope to Current page.
- Real target, page, locale and relevant canonical-content changes supersede or stale older work.
- The canonical planner/provider/confirmation path invokes once, presents merchant-readable review,
  mutates only on Accept, rejects duplicate activation, and preserves stored/published state.
- Reject, stale and superseded results cannot remain active on the canvas or become acceptable.

### Current page

- Current-page scope binds to the active canonical page and preserves unrelated pages.
- Revise and Regenerate create newer proposal identities without dirtying the draft.
- Reject, Cancel, Retry failure and stale context preserve the active draft.
- Accept uses the canonical page transaction; Undo/Redo, Save draft and Publish remain separate.

### Entire storefront

- Generation includes the complete intended page set, preserves page order/navigation and omits
  catalogue, commerce, customer, secret and volatile UI state from provider authority.
- Target-bound grants explicitly authorize section, colour and typography operations.
- Complete canonical page, navigation, design-state, locale or untargeted-page changes stale pending
  work; volatile review UI does not.
- Canonically equivalent pending requests deduplicate and older results cannot replace newer work.
- Review represents affected-page and operation totals, every page/section operation, shared design
  changes, warnings and blockers without internal IDs or operation enums.
- Accept revalidates immediately, applies all pages/design state atomically and records one composite
  history transaction. Reject and Cancel create no mutation.
- Undo/Redo restore complete storefront transactions. Page edits newer than a storefront Accept are
  undone first, rejected later proposals preserve earlier history, and two accepted proposals undo
  and redo in chronological order.

### Persistence, preview and publishing safety

- Complete active-draft composition includes editor-visible and supported non-editor-visible pages,
  page order, navigation, BrandSystem, catalogue reference and enabled locale context.
- Save draft persists accepted storefront state and survives reload without changing Published.
- The focused non-editor-page application test confirms accepted hidden-page changes are included,
  untouched pages remain exact, and catalogue/published state is retained.
- Only an active pending ready/accepting proposal can drive proposal preview. Stale, failed,
  rejected, closed, superseded and accepted proposals return the canvas immediately to active draft.
- Normal editor mutations never use an inactive proposal projection.

### OpenAI boundary

- All OpenAI tests used mocked SDK/network behavior; no real API call was made.
- Strict provider JSON Schema uses the supported subset while complete local Zod and semantic
  validation remain active.
- Empty/unsupported output, unbound variants, protected data, missing key, authority outage,
  timeout, cancellation, supersession and late completion have controlled outcomes and cannot become
  ready after termination.
- Prompts, merchant instructions, full responses, protected values and API keys are excluded from
  logs and telemetry.

## Defects and classifications

| Classification              | Finding                                                                                                                      | Resolution                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproducible product defect | Switching pages while Selected section was active cleared the section selection but left the disabled section scope checked. | The page-switch lifecycle now explicitly resets to Current page, supersedes old section work and binds canonical identity to the new page. Integration and Playwright regressions pass. |
| Environment issue           | The worktree install predated merged P4-06 and initially lacked the lockfile-declared `openai` and `server-only` packages.   | `pnpm install --frozen-lockfile` restored the declared dependencies with no repository diff; the exact blocked suite then passed.                                                       |

No reproducible test defect, parallel-load timeout or unrelated pre-existing failure occurred in the
focused P4-07 matrix. No timeout was increased, no sleep was added, and no validation was weakened.

## Exact focused tests

Focused Vitest groups:

```text
P4-01/P4-03/P4-06 provider, validation, orchestration, OpenAI adapter and server authority:
  86 passed
P4-02 confirmation, lifecycle, page history, presentation and analytics:
  40 passed
P4-04/P4-QA-01/P4-05D editor integration baseline:
  86 passed
P4-05A/B/C/D contracts, fingerprints, generation, atomic application/history,
review and complete draft persistence:
  128 passed
Publishing, published-state separation, history and restore:
  35 passed
Selected-section fallback regression after the fix:
  1 passed

Focused unit/integration total: 376 passed.
```

Focused Playwright files:

```text
tests/e2e/editor-ai-command.spec.ts
tests/e2e/editor-shell.spec.ts
tests/e2e/editor-storefront-ai.spec.ts
tests/e2e/proposal-confirmation.spec.ts

50 passed using Chromium with one worker.
```

The browser matrix covers selected-section, current-page and entire-storefront proposals; Accept →
Undo → Redo; Reject; explicit Retry; Revise and Regenerate; selected-target fallback; stale preview
removal; target switching; duplicate submission; complete Save/reload; Published isolation; keyboard
operation; EN/FI review; and horizontal overflow at 375, 768, 1024 and 1440 pixels.

`pnpm validate:full`, the complete Vitest suite, the complete Playwright suite, a production build,
and the opt-in real-provider smoke test were intentionally not run under the P4-07 stop rules.

## Manual testing still required

- The in-app visual browser surface was unavailable during this session. Repository Playwright ran
  against the real local editor, but no separate screenshot-based visual review was performed.
- Human screen-reader announcement quality, real touch-device ergonomics and non-Chromium visual
  review remain manual release checks.
- The real-provider smoke test remains intentionally unexecuted. Production OpenAI enablement still
  requires the documented authenticated server authority, tenant isolation, managed secrets and rate
  limiting; the standalone production route continues to fail closed until those deployment
  boundaries exist.

## Documentation impact

The confirmed fix restores behavior already required by the SDD and P4-05D; it does not change the
authoritative product contract. `VESKIFY_SDD.md` and its synchronized DOCX therefore require no
change for P4-07.
