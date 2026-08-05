# P10A-07C-03 — Controlled Real-Provider Acceptance

## Status

Blocked before the provider boundary on 2026-08-05. This task adds an opt-in, serial acceptance
test that uses the existing P10A-06 router, P10A-05C/P10A-05D-02 integrations, P10A-07C-02
preflight, configured server provider boundary, proposal lifecycle, and in-memory safe-evidence
contract. It neither changes a configured provider/model nor adds a provider adapter, prompt,
retry loop, persistence mechanism, publication action, PageBlueprint, or storefront model.

The trusted server boundary resolved the deterministic whole-storefront provider rather than the
required real-provider identity. The test therefore failed closed before an authorization could
reach `createPlan()`.

## Safe retained outcome

| Case | Routed execution                                                        | Lifecycle          | Provider attempts | Provider completions | Terminal status                  |
| ---- | ----------------------------------------------------------------------- | ------------------ | ----------------: | -------------------: | -------------------------------- |
| A    | Not started because trusted real-provider configuration was unavailable | `preview-only`     |                 0 |                    0 | Blocked before provider boundary |
| B    | Not started; serial guard prohibits it after Case A does not succeed    | `accept-undo-redo` |                 0 |                    0 | Not run                          |

No provider request, raw provider response, prompt, credential, header, environment value,
proposal mutation, save, or publish action occurred. The existing preflight’s explicit one-call
authorization and fresh-authority guard remain the only provider entry path.

## When configuration is available

Run exactly once with `VESKIFY_P10A_07C_03_CONTROLLED_ACCEPTANCE=1` and the existing application
real-provider configuration. The test executes Case A first and executes Case B only after Case A
has a successful terminal record. Each case has a separate authorization with an allowance of one;
there is no retry path.

On a successful run, its in-memory evidence contains only the versioned case identity, P10A-06
router-decision fingerprint, execution/package identity, request and authority fingerprints,
safe project/draft/snapshot/manifest/profile/registry authority, safe provider/model identity,
attempt/completion counts, sanitized provider outcome, proposal/review/lifecycle fingerprints,
protected-state before/after fingerprints, and a typed terminal result. Case B additionally proves
the exact materialized hero selection, review before acceptance, exact undo to the original state,
and redo to the accepted state. No raw provider payload is retained.

## Deferred

This blocked acceptance run does not establish real-provider commercial acceptance. It awaits an
existing configured real-provider boundary; it must not be bypassed with a deterministic provider,
an overridden model, a copied credential, or an additional provider call.
