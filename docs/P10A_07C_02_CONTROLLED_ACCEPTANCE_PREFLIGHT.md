# P10A-07C-02 — Controlled Provider Acceptance Preflight

## Status and boundary

This foundation adds the deterministic, fail-closed preflight for a later explicitly authorised
controlled provider acceptance run. Its entry point is
`ControlledAcceptancePreflightRunner` in `src/application/controlled-acceptance-preflight`.
It has no route, provider selection, environment lookup, credential access, persistence adapter,
publication action, natural-language router, retry loop, or real-provider fixture.

All automated coverage injects an in-process deterministic `WholeStorefrontPlanningProvider`.
Consequently, constructing a runner makes zero calls and calling `run()` without a valid explicit
authorisation stops before the provider boundary. This task made zero OpenAI or other network calls.

## Authority and execution guard

`ControlledAcceptanceCase` is a versioned envelope around an already explicit P10A-05C initial
generation request or P10A-05D-02 governed follow-up request. It retains and validates the current
project/draft IDs and revisions, request identity, locale, snapshot, manifest, package registry,
component registry, commerce and approved-asset fingerprints. It also binds the request's existing
profile or slot authority with a derived fingerprint; it does not create a new planner, proposal,
registry, PageBlueprint, or provider-adapter authority.

Before an injected provider is reached, the runner safely clones unknown input and validates:

- the case/version, execution kind, request identity, locale and evidence destination;
- exact current governed project/draft/snapshot/manifest/registry/commerce/asset authority;
- the existing initial-generation profile set or follow-up page/slot authority;
- allowed provider and safe provider/model identities (never options or credentials);
- a positive exact call budget; and
- an explicit `controlled-live-provider-call` authorisation bound to the case, authority,
  provider and budget, including its deterministic integrity fingerprint.

The authorisation is an explicit non-secret control value, not an API key or a fixture token. A
missing, malformed, stale, mismatched, zero-budget, or previously consumed authorisation prevents
provider invocation. The runner records every attempted boundary call, permits no automatic retry,
and prevents another successful call after the bounded allowance is consumed.

The actual live-provider acceptance task remains responsible for supplying a separately authorised
live provider and authorisation after P10A-06 merges. It may add a routed case, but must continue
through this preflight authority and must not alter its default-deny policy.

## Canonical proposal and lifecycle path

The runner first executes the existing P10A-05C or P10A-05D-02 integration without side effects.
Only then does it call the existing whole-storefront provider boundary. The returned plan must pass
that boundary's typed validation and have the exact fingerprint of the governed canonical plan;
otherwise no proposal lifecycle is exercised.

The existing `WholeStorefrontProposalAcceptanceCoordinator` retains the pending proposal before
review and supplies the configured deterministic lifecycle exercise:

- `preview-only`;
- `reject`;
- `accept`;
- `accept-undo`; or
- `accept-undo-redo`.

Acceptance refreshes canonical planning input, so stale acceptance fails closed. The runner does
not save or publish; retained evidence asserts the published storefront is still the original state.

## Retained evidence and protected-state proof

The contract retains only safe metadata in its in-memory test equivalent: case/version, timestamps
from the injected clock, execution/package identity, request and authority fingerprints,
project/draft/snapshot, manifest/registry/page/commerce/asset authority, provider/model identity,
attempt count/outcome, plan/proposal/review fingerprints, lifecycle fingerprints, protected-state
before/after fingerprints, final status, and safe typed failures.

It never accepts API keys, prompts, raw provider DTOs, credential headers, `.env.local` data, or
raw provider output. Fingerprints are deterministic under injected clock and identities.

Protected-state proof hashes canonical navigation, commerce and approved-asset authority before and
after the lifecycle. Existing canonical proposal compilation continues to validate protected media
and commerce bindings; a mismatch is retained as `protected-state-violation`.

## Failure classification

The preflight returns typed retained failures for malformed cases, stale authority, invalid provider
configuration, missing/invalid/exhausted authorisation, evidence initialization, provider
unavailability, provider response validation, planning/proposal rejection, stale acceptance,
protected-state violation, and lifecycle failure. A known malformed plan is a response-validation
failure, not a provider outage; only transport/unavailability at the existing provider boundary is
classified as unavailable.

## Deferred work

P10A-06 routing, any real provider invocation, provider/model configuration changes, credentials,
prompt changes, retry orchestration, external evidence persistence, human commercial approval,
save/publish, and the actual controlled live acceptance run remain deferred. The SDD and DOCX are
intentionally unchanged.
