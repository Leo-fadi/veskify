# P10A-08B — Accepted Snapshot Publishing Authority

## Outcome

P10A-08B adds the canonical server/application authority seam between an accepted governed proposal
and future AI-originated publication. A reviewed and successfully accepted proposal can produce one
immutable receipt that binds the accepted `StorefrontSnapshot` to its project, draft, proposal,
review and protected runtime authorities. Publishing preparation and confirmation can require that
receipt through trusted server dependencies without invoking an AI provider.

This task does not close active-route publishing. The current merchant browser publish route remains
unchanged and continues to prepare explicit manual publication authority. P10A-08C owns migration of
that route to an authoritative gateway, durable receipt persistence, compiled runtime publication,
atomic active-version switching and rollback closure.

## Canonical authority flow

```text
reviewed proposal
  -> authoritative acceptance transaction
  -> canonical accepted-runtime-to-StorefrontSnapshot materialization
  -> exact accepted proposal result = supplied accepted snapshot
  -> exact supplied accepted snapshot = current persisted draft
  -> server-only AcceptedSnapshotPublishingAuthorityService
  -> immutable AcceptedSnapshotPublishReceiptRepository.createOnce
  -> trusted receipt identity
  -> preparePublish resolves and validates the receipt
  -> confirmPublish resolves and validates the receipt again
```

The receipt is publication authority metadata, not another proposal, page graph, snapshot or
publisher. `StorefrontSnapshot` remains the canonical editable and publishable aggregate. The
whole-storefront runtime state stored in acceptance evidence remains a transient compiler/lifecycle
projection; P10A-08B fingerprints that accepted runtime and binds it to the exact authoritative
snapshot without introducing a second snapshot model.

## Receipt contract

`AcceptedSnapshotPublishReceipt` is versioned and canonically fingerprinted. It records:

- receipt, project, draft, proposal, review, accepted-runtime and accepted-snapshot identities;
- proposal, review, project and draft revisions;
- exact accepted snapshot content fingerprint;
- component registry, capability manifest, governed package registry and PageBlueprint profile
  authorities where represented;
- canonical commerce and approved-asset fingerprints;
- acceptance action, timestamp and initial-generation or governed-follow-up origin.

The fingerprint covers the entire unsigned receipt, including its receipt identity. Unsupported,
malformed or modified persisted values fail with typed deterministic receipt errors.

## Server-owned minting

`AcceptedSnapshotPublishingAuthorityService` is exported only from the server-only entry point. It
accepts canonical lifecycle evidence from a future authoritative acceptance endpoint and verifies:

- the proposal and lifecycle are both accepted;
- the lifecycle transaction exactly reproduces the reviewed proposed runtime;
- the active runtime equals the accepted transaction result;
- the accepted proposal result materializes through the same canonical runtime-to-page/section
  projection used by whole-storefront integration, including registered component authority,
  protected collection/product bindings and approved asset placements;
- the materialized accepted proposal result equals the supplied accepted snapshot by both canonical
  content fingerprint and collision-safe canonical value;
- the same supplied accepted snapshot equals the current persisted draft by both checks;
- the proposal, project, draft and accepted snapshot identities and revisions agree;
- component registry, manifest, package registry, commerce and approved-asset authorities agree
  with proposal authority where the proposal represents them.

Proposal/snapshot divergence fails deterministically as `accepted-proposal-content-mismatch` before
any receipt write, even when the supplied snapshot still exactly matches the persisted draft.
Preview, rejection, stale acceptance and malformed lifecycle evidence cannot mint a receipt. The
browser, planner and provider receive no minting API. A caller-created receipt object is not
accepted by publishing; only an identity that resolves from the trusted repository seam is usable.

## Repository seam

`AcceptedSnapshotPublishReceiptRepository` has only `createOnce` and `get`. The deterministic
in-memory adapter clones values on write and read, verifies receipt integrity before persistence and
rejects both exact replay and same-identity/different-content collision. It is suitable for contract
tests and an injected server lifetime.

Durable production receipt storage is not provided by this task. P10A-08C must map this port to the
authoritative server persistence boundary before the active merchant route can enforce AI
acceptance lineage.

## Prepare and confirm enforcement

Publication preparation stores an explicit discriminated authority:

- `manual` carries no AI acceptance claim;
- `accepted-ai` carries the trusted receipt identity and immutable receipt lineage needed for
  confirmation.

For `accepted-ai`, `preparePublish` accepts only a receipt ID from the caller-facing request portion,
retrieves the full receipt from trusted storage and revalidates current project, draft, snapshot,
proposal, review, registry, manifest, profile, commerce and asset authority through the injected
server authority source. It preserves the trusted receipt identity and fingerprint in the prepared
publication.

`confirmPublish` requires the matching authority kind, retrieves the receipt again, verifies that it
matches the prepared lineage and reruns current authority validation before any publication write.
AI preparation cannot fall back to manual confirmation, and manual preparation cannot claim an AI
receipt.

## Undo, redo and state drift

An accepted transaction may mint a receipt. Undo changes the current accepted-runtime authority, so
the prior receipt fails confirmation. Redo is eligible only when the authoritative runtime,
proposal/review revisions, project/draft revisions and snapshot fingerprint again match the receipt
exactly. Matching visual content alone is insufficient when revision authority differs. Any
divergent snapshot content, even under a reused snapshot identity, fails closed.

## Deterministic evidence

The P10A-08B tests cover exact accepted-proposal/snapshot/draft equality; BrandSystem, variant,
bounded-parameter, asset, ordering, protected-binding and navigation divergence; canonical input
normalization; accepted initial generation and governed follow-up minting; preview and rejection;
server-only ownership; immutable persistence; deterministic fingerprinting; replay and collision;
modified and missing receipts; cross-lineage and protected-authority drift; trusted prepare
resolution; confirm-time re-resolution; undo/redo policy; and manual/AI authority separation. They
use deterministic repositories and perform no provider call or external publication.

## Explicitly deferred

P10A-08C owns:

- wiring the authoritative acceptance service into the active accepted-proposal server path;
- durable receipt persistence;
- migrating or strictly gating `publish-client.tsx` through the authoritative publishing gateway;
- deterministic compiled runtime artifacts and published collection/PDP render-target corrections;
- atomic active-version switching, idempotency at the active route and rollback closure.

Until that work lands, the receipt authority and prepare/confirm enforcement are available at the
canonical server boundary, but end-to-end active merchant-route enforcement remains incomplete.
