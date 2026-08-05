# P10A-07C-03 — Controlled Real-Provider Acceptance

## Status

Blocked safely before a real-provider invocation on 2026-08-05. The trusted server configuration
selected the deterministic whole-storefront planner, not the configured OpenAI provider required
for this controlled gate. This is retained as typed terminal Case A evidence; Case B was not
started. No provider/model selection was changed to force eligibility.

| Case                        | Provider attempts | Provider completions | Provider outcome | Lifecycle          | Terminal status                            |
| --------------------------- | ----------------: | -------------------: | ---------------- | ------------------ | ------------------------------------------ |
| A — initial generation      |                 0 |                    0 | `not-attempted`  | `preview-only`     | `invalid-provider-configuration` / blocked |
| B — governed hero follow-up |                 0 |                    0 | `not-attempted`  | `accept-undo-redo` | Not started after Case A block             |

No provider request, retry, raw provider response, prompt, credential, environment-file value,
proposal mutation, save, or publish action occurred.

## Trusted router and direction authority

Every routed P10A-07C-03 case now supplies its exact canonical router request together with an
optional expected decision fingerprint. The preflight independently runs
`routeGovernedDesignRequest` against the current authority, verifies the execution kind, governed
package, canonical scope, declared pages, and exact slots, then retains only the recomputed
decision fingerprint. A stale, foreign, mismatched, clarification, or unsupported route produces a
typed zero-attempt terminal record.

For governed initial generation, the canonical provider request now contains only the registered
direction authorized by P10A-05C. The provider boundary verifies the returned plan against that
same constrained expected plan. A different otherwise-registered direction is a deterministic
authority failure; no copied direction inventory or result overwrite is used.

## Blocked evidence and model identifiers

The runner is constructed before live eligibility is assessed. Deterministic-provider selection,
credentials unavailable, absent trusted model identity, unsupported provider configuration, and a
disabled live gate each retain safe terminal evidence: case/version, execution kind, recomputed
router fingerprint where available, provider-configuration category, zero attempt/completion
counts, `not-attempted` outcome, and typed failure. Credentials, raw configuration, and raw
provider data are excluded.

Provider/model validation uses the shared canonical provider-model identifier schema. It supports
ordinary OpenAI identifiers and valid fine-tuned identifiers beginning with `ft:` while rejecting
empty, control-character, malformed, and overlong values. The trusted injected model identifier is
the only model value retained in evidence.

## Deferred

This result does not establish real-provider acceptance. A future explicitly authorized run may
use the existing trusted server configuration only when it reports an eligible OpenAI provider and
trusted model. It must perform Case A first with its single-call allowance and run Case B only after
Case A succeeds; neither case may retry.
