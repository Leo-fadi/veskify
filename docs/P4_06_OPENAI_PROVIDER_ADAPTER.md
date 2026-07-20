# P4-06 — Secure real OpenAI provider adapter

P4-06 adds an optional OpenAI Responses API adapter behind the existing P4-01 `AIProvider`
boundary. The deterministic provider remains the default. This implements the provider,
validation, observability, and privacy rules in SDD §§12.6–12.10, 16.1–16.4, 17.1–17.5,
19, 20, and 21; FR-025–FR-028 and FR-042; NFR-007–NFR-009; and AC-016/AC-017. ADR-002
remains binding: the provider executes a model, while Veskify owns authority, schemas,
validation, proposal state, and every draft or published mutation.

## Environment and explicit selection

All configuration is read in `openai-client.server.ts`, which is protected by Next.js's
`server-only` marker. No environment value is read by React or sent to browser state.

| Variable                      | Behavior                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `VESKIFY_AI_PROVIDER`         | `mock` (default) or `openai`. Any other value fails closed.                                                  |
| `OPENAI_API_KEY`              | Required only when `openai` is selected. A missing key returns `missingApiKey`; it never falls back to mock. |
| `VESKIFY_OPENAI_MODEL`        | Optional model override. The documented default is `gpt-5.6-sol`.                                            |
| `VESKIFY_OPENAI_TIMEOUT_MS`   | Optional 1,000–120,000 ms override. The default is 30,000 ms.                                                |
| `VESKIFY_REAL_PROVIDER_SMOKE` | Must equal `1`, together with a key, before the local smoke test can call OpenAI.                            |

The official OpenAI TypeScript SDK is instantiated only after explicit OpenAI selection and a
non-empty server key. The client uses the Responses API with `maxRetries: 0`, SDK logging off,
a bounded timeout, and `store: false`. Merchant Retry therefore remains explicit; the SDK does
not create a hidden retry or concurrency path.

## Server authority and standalone boundary

`POST /api/ai/proposals` accepts only request identity, target identity, active locale, and the
merchant instruction. Its strict input schema rejects browser-supplied permission grants,
operation/component allow-lists, fingerprints, canonical pages, storefront state, or protected
field declarations.

The route-handler factory requires a `ServerAiProposalAuthorityResolver`. The supplied repository
resolver first calls an authorizer, then reloads the canonical project, current draft, page,
section, locales, brand system, catalogue-backed render context, snapshot ID, and revision. It
derives the P4-01 request and target-bound grants through the existing P4-03 planner. Provider
selection is injected on the server and occurs only after authority succeeds.

The standalone application currently persists merchant projects in browser IndexedDB and has no
production authentication or server project repository. The production route is therefore wired
to an unavailable authority resolver and fails closed. A deployment must supply authenticated
tenant authorization, a server-backed canonical repository, and managed secret storage before
enabling this route. This task deliberately does not invent that deferred production architecture.

## Bounded request and structured response

The OpenAI input contains only the merchant design instruction, current page or selected section,
current brand system, target scope, approved target-bound operation/component vocabulary, enabled
EN/FI locales, and the static protected-field list. It excludes imported-content bodies, full
storefronts, catalogue products, customers, orders, payments, inventory, logistics, analytics,
and secrets. System instructions label merchant and canonical content as untrusted data and state
that it cannot widen policy or permissions.

The Responses request uses strict JSON Schema structured output for canonical design operations,
diagnostics, and an optional localized explanation. React, HTML, CSS, JavaScript, executable code,
unsupported schemas, and protected commerce fields remain forbidden.

Every response is untrusted. The adapter first checks response status/refusal and parses the strict
model shape. `requestAiProposal` then reuses the complete P4-01 validation path: canonical request
schema, operation schema, target-bound grants, operation/component allow-lists, registry checks,
locale checks, executable/markup rejection, protected-field checks, target scope, isolated page
application, and `validation: valid`. P4-03 creates target and permission fingerprints only after
that validation and rechecks current project, draft, revision, target, and page fingerprint before
creating a ready proposal. P4-05A storefront fingerprints remain unchanged; P4-05B generation is
outside this task.

## Failure, cancellation, and privacy

Provider failures normalize to: `missingApiKey`, `authenticationFailed`, `rateLimited`, `timeout`,
`cancelled`, `networkFailure`, `malformedResponse`, `validationRejected`, `providerRefusal`,
`unavailableModel`, or `unexpectedProviderFailure`. Raw SDK errors, response bodies, stack traces,
and secrets are not returned. Failed, cancelled, timed-out, stale, or superseded work cannot create
a ready proposal or mutate active, stored, or published state.

The route propagates its abort signal. P4-03 continues to deduplicate identical pending requests;
when a newer request supersedes an older one, it aborts the older provider signal and retains its
existing sequence guard, so a late result still cannot become ready.

No prompt, merchant instruction, imported content, generated copy, full response, key, or protected
catalogue value is logged. Optional provider telemetry contains only provider/model identifiers,
safe request ID, duration, normalized outcome, and numeric token usage. Telemetry is best-effort and
cannot alter provider success or failure.

## Opt-in local smoke test

The smoke test is excluded from the normal Vitest configuration, CI, `validate`, and
`validate:full`. Run it only with explicit approval and both gates present:

```bash
OPENAI_API_KEY=... VESKIFY_REAL_PROVIDER_SMOKE=1 pnpm smoke:openai
```

It sends one minimal seeded hero-copy request, validates it through P4-01, verifies no draft
mutation, and prints only provider/request identifiers, operation count, duration, and validation
status. It never prints the prompt, generated text, full response, or key.
