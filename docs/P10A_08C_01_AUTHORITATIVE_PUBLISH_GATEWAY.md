# P10A-08C-01 — Authoritative Merchant Publish Gateway

## Outcome

P10A-08C-01 moves the active merchant publishing route behind the existing authoritative
`StorefrontPublishingGateway`. The browser can review a saved draft, but it can no longer call a
browser repository publication method, advance a published pointer or construct a trusted AI
publication authority.

The same-origin server route accepts a narrow request:

- manual publication: project ID and idempotency request ID;
- accepted-AI publication: the same fields plus only the persisted acceptance-receipt ID;
- confirmation: project ID, request ID and the server-created preparation ID.

It authenticates the merchant and requires the canonical `publishStorefront` permission before
preparing or confirming. It stores the complete gateway request server-side, then invokes the
existing gateway on confirmation. No second publishing authority or browser write capability is
introduced.

## Accepted-AI authority

The trusted server path resolves the P10A-08B immutable receipt from the durable, create-once
receipt repository. Receipt content submitted by a browser is invalid. The receipt is resolved and
validated against the current project, draft, proposal, accepted snapshot, registry/manifest/profile,
commerce and approved-asset authority during both preparation and confirmation. A receipt from
another project or proposal, accept-then-undo divergence, stale project/draft state and conflicting
reuse of one idempotency key fail without moving the published pointer.

Manual and accepted-AI authority remain separate: a manual request has no receipt lineage, an
accepted-AI request cannot fall back to manual, and a server without trusted accepted-AI authority
rejects that source kind.

## Persistence and idempotency

`FileSystemAcceptedSnapshotPublishReceiptRepository` is a narrow server adapter that stores only
parsed immutable receipts using create-once files. `FileSystemMerchantPublishPreparationStore`
retains the prepared gateway request under a deterministic request-derived preparation ID. Matching
retries resolve the original request; different authority data under the same request identity is a
deterministic conflict.

The active configured local-authority route uses that storage only when its authoritative server
authority is configured. An unconfigured route fails closed rather than using browser IndexedDB as
a publication fallback.

## Deliberately deferred

P10A-08C-01 continues to publish the canonical snapshot path already owned by the gateway. It does
not implement the deterministic compiled-runtime artifact, atomic active-version switch, rollback
closure or published render-target closure. Those remain P10A-08C-02 work.

## Verification

Focused tests cover browser request-only behaviour, server gateway invocation, authentication and
permission gates, manual/AI separation, trusted receipt resolution at both phases, stale receipt and
draft rejection, active-pointer preservation and idempotent retries. They use deterministic
repositories and the authoritative adapter only: no AI provider or external publication is called.
