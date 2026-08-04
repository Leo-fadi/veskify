# P10A-07C-01 — Typed Generation Failure Classification

## Scope

This bounded prerequisite corrects the server whole-storefront generation boundary without changing
provider selection, prompts, retry orchestration, routes, PageBlueprints, snapshots, Puck, renderers,
or the governed P10A-05D follow-up contracts.

Previously, the route's final catch treated every unrecognized error as
`providerUnavailable` with HTTP `503` and `retryable: true`. That could turn a deterministic
fingerprint, validation, proposal-compilation, or protected-state rejection into a misleading
provider outage. No provider is called by this work's tests.

## Canonical stage mapping

The existing failure vocabulary remains authoritative. The server maps its existing typed errors to
the established response categories and never exposes error messages, stacks, prompts, credentials,
or provider responses.

| Generation stage                                                                                                         | Typed result                                                   | HTTP response                                                |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Request JSON/schema and supported scope validation                                                                       | `validation`                                                   | `400`, non-retryable                                         |
| Merchant authorization or authentication                                                                                 | `permissionDenied`                                             | `401`, non-retryable                                         |
| Merchant authentication transport or backing-service unavailability                                                      | `authenticationUnavailable`                                    | `503`, retryable without claiming an AI-provider outage      |
| Project/draft, browser/server, plan, registry, commerce, asset, or proposal fingerprint staleness                        | `stale` (or existing project/tenant category where applicable) | `409` (or existing safe authorization status), non-retryable |
| Provider DTO parsing, normalization, PageBlueprint plan validation, proposal compilation, and protected-state validation | `validation`                                                   | `400`, non-retryable                                         |
| Known provider refusal or incapability                                                                                   | `validation`                                                   | `400`, non-retryable                                         |
| Unknown post-provider application failure                                                                                | `internalFailure`                                              | `500`, non-retryable                                         |

`requestWholeStorefrontGenerationPlan()` now separates the provider invocation from deterministic
acceptance, normalization, and validation. An untyped exception is translated to
`provider-unavailable` only while directly invoking `provider.createPlan()`. Typed planner failures
are retained; deterministic failures after the provider returns continue to the server mapper.

## Provider-unavailable boundary and retryability

Only the existing provider-boundary `credentials-unavailable` and `provider-unavailable` failures,
the existing unavailable configured authority, and an untyped direct provider transport failure map
to `providerUnavailable`, HTTP `503`, and `retryable: true`. The existing provider timeout and
authentication/access policy is therefore unchanged.

Every other known failure keeps a non-retryable typed category. In particular, an invalid provider
DTO, a plan that contradicts PageBlueprint authority, an invalid proposal compilation, or protected
state validation cannot ask the merchant to retry an external provider.

The browser planning client preserves the server category, status, retryability and safe message in
the existing client error model. Only `providerUnavailable` is translated to the provider-unavailable
exception used by the existing orchestrator; an `internalFailure` remains non-retryable through the
editor flow. `permissionDenied` remains distinct from temporary
`authenticationUnavailable` integration access.

## Sanitized diagnostics

The route continues to record only the authorized attempt ID, project ID, scope, stage, safe
category, and status. It records no prompt, credential, provider payload, private asset content, or
stack trace. The response remains the established `{ ok: false, failure: { category, retryable } }`
contract.

## Deferred to P10A-07C

This work does not perform real-provider acceptance, change provider prompts or models, add retry
or observability systems, redesign UI errors, or make the P10A-07C acceptance decision. The SDD and
synchronized DOCX remain unchanged.
