# P9R-07 whole-store design-system live acceptance

**Date:** 1 August 2026

**Branch:** `codex/p9r-07-whole-store-design-system-routing`

**Status:** Manually verified narrow live-provider acceptance; Phase 9 remains active

## Scope and provider-call record

P9R-07 corrects the canonical capability-selection boundary for a merchant request that selects
the entire storefront but changes only global colours and typography. The protected Lumo editor
journey used the exact instruction retained in
`tests/fixtures/p9r-07-design-system.ts` with the real OpenAI provider and the minimum canonical
storefront context required by the existing provider contract.

Two controlled OpenAI calls were made across P9R-07:

1. The first call returned the correct design-system-only proposal, but manual review found that
   legacy renderer CSS did not apply the accepted palette to every visible surface and disabled
   action state. That result was rejected as incomplete evidence.
2. The second, separately approved call tested the corrected renderer boundaries and passed the
   complete manual acceptance recorded below.

No further provider call is authorized by this evidence. No secret, API key, demo token, session
identifier, authorization header, raw provider payload, log, or unrelated project data is retained.

## Proposal review

The corrected protected-editor run reported:

- scope: Entire storefront;
- target pages: 3;
- page changes: 0;
- shared appearance changes: 2;
- operations: `APPLY_APPROVED_BRAND_COLOURS` and
  `APPLY_APPROVED_BRAND_TYPOGRAPHY` only;
- no page replacement, section reordering, structural mutation, commerce mutation, route change,
  media rebinding, approved-asset substitution, or relationship change.

The accepted palette was pure white (`#FFFFFF`) for backgrounds and surfaces, near-black
(`#111111`) for text, and burnt orange (`#B54708`) for primary actions and active emphasis. The
accepted typography used the registered modern sans-serif tokens with bold compact headings.

## Manual lifecycle and renderer evidence

The merchant completed the real protected Lumo editor journey manually because no Codex-controlled
browser instance was available. Review, Accept, Undo, Redo, Save, Reload, and Preview all passed.
No Publish action occurred.

The manually inspected accepted result proved:

- homepage hero and section surfaces render white;
- collection and product-detail surfaces render white;
- the shared footer renders white on collection and product-detail pages;
- text renders near-black;
- primary buttons, highlights, required-state text, selected controls, and active states render
  burnt orange;
- the incomplete PDP purchase action renders as a white bordered disabled control rather than a
  black fill;
- completing all required PDP options enables the purchase action and changes it to burnt orange;
- the registered typography is consistent across homepage, collection, and PDP;
- page structures, section order, component variants, products, prices, stock, options, routes,
  media, approved assets, and commerce relationships remain unchanged.

## Deterministic correlation

The live result is backed by the editor-path, authority-parity, proposal/compiler, persistence, and
renderer regressions in the P9R-07 change set. The focused renderer journey inspects actual browser
CSS for the homepage hero, collection/PDP footers, near-black text, and disabled-to-enabled PDP
purchase action while also comparing proposal pages, navigation, catalogue reference, and the two
allowed operation types.

## Final validation and infrastructure exception

The functional validation evidence completed for this change is:

- the complete Vitest suite passed **1,842/1,842 tests in 133/133 files** before the final
  browser-stage corrections;
- the focused corrected storefront editor browser suite passed **22/22 tests**;
- typecheck, lint, format check, production build, and `git diff --check` each exited 0;
- the two unchanged files implicated by the later infrastructure failure passed **10/10 tests in
  2/2 files** in isolation with one worker.

The later `pnpm validate:full` attempt failed in the `pnpm test` (Vitest) stage because the test
pool could not start a worker for
`tests/unit/merchant-project-context-adapter.test.ts`. Vitest reported
`[vitest-pool]: Failed to start forks worker` caused by
`[vitest-pool-runner]: Timeout waiting for worker to respond`. Under the same resource starvation,
the unchanged `tests/integration/p9-05b-editor-bridge.test.ts` lifecycle test exceeded its 5-second
test timeout after its mocked provider invocation, response parsing, proposal compilation,
protected-state validation, and response completion had all logged success. Both unchanged files
then passed together in isolation: **10/10 tests, exit 0**.

This is an approved validation-infrastructure exception limited to that known worker-startup and
resource-starvation flake. No assertion, application, renderer, authority, commerce, proposal
lifecycle, or protected-state validation failure occurred. The exception does not weaken any
functional P9R-07 acceptance requirement and does not authorize a broader validation exception.

## Limitations

This evidence verifies a whole-store design-system-only edit. It does not prove a meaningful
structural multi-page generation result, the complete Phase 9 responsive/locale screenshot matrix,
or publication. It therefore does not close Phase 9 or authorize Phase 10A.
