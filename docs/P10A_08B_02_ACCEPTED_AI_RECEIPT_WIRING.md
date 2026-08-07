# P10A-08B-02 — Accepted-AI Acceptance-to-Receipt Wiring

- **Status:** Baseline
- **Authority:** `StorefrontSnapshot`, governed whole-storefront proposal lifecycle,
  accepted-snapshot receipt, and authoritative merchant publish gateway
- **Provider calls:** None

## Outcome

Authoritative proposal acceptance now mints and durably retains the existing accepted-snapshot
publication receipt. The active merchant publish gateway can prepare and confirm `accepted-ai`
publication from the opaque receipt identity without accepting a browser-created snapshot, runtime,
receipt body, provider payload, or authority fingerprint.

```text
server-retained governed proposal
  → merchant review and bounded acceptance request
  → authenticated server acceptance
  → canonical accepted runtime transaction
  → canonical StorefrontSnapshot materialization
  → exact current draft persistence
  → create-once accepted-snapshot receipt
  → opaque receipt identity
  → accepted-AI prepare
  → independent receipt/current-authority reload
  → accepted-AI confirm
  → independent receipt/current-authority reload
```

## Authoritative acceptance entry point

The configured local authority exposes `POST /api/demo/p9-05b/accept`. Its strict request contains
only project, proposal, acceptance-action, expected authority revision, expected project revision,
expected draft identity, and expected draft revision. Same-origin JSON and the existing local
merchant session are required.

`AuthoritativeAcceptedAiReceiptService` resolves and checks:

- authenticated merchant/project context and `accept-design-proposal` permission;
- the server-retained reviewed proposal and its canonical compiler input;
- the current project, draft, proposal, review, and session revisions;
- the existing whole-storefront acceptance coordinator and one atomic acceptance transaction;
- canonical runtime-to-`StorefrontSnapshot` materialization and exact persisted-draft equality;
- current component registry, capability manifest, governed package registry, PageBlueprint
  materialization, commerce, and approved-asset authority.

The public client receives only `receiptId` and the next authoritative session revision. The route's
strict schema rejects caller-supplied accepted snapshots or authority content.

## Exact receipt minting and persistence

The implementation reuses `AcceptedSnapshotPublishingAuthorityService` and
`AcceptedSnapshotPublishReceipt`; it creates no competing receipt or acceptance model. One
acceptance-action ID deterministically owns one receipt ID. The durable configured adapter stores
receipts under the existing server-only local publish-authority namespace through
`FileSystemAcceptedSnapshotPublishReceiptRepository`.

An identical retry returns the same trusted receipt. If acceptance committed but recording the
receipt identity was interrupted, retry resolves or finishes the create-once receipt and records its
identity. Different request content under the same action identity fails as a typed collision.
Receipt persistence failure never returns accepted-AI authority.

PageBlueprint materialization fingerprints remain distinct from registered profile-definition
fingerprints. The deterministic publish compiler re-materializes current profile authority and
validates its ordered runtime projection. Collection and PDP sub-slots resolve through the shared
canonical composite mapping to `dynamicCollectionCommerce` and `dynamicProductDetail`; optional
slot omission is accepted only when every required projected component remains in registered order.

## Active publishing composition

The configured authoritative merchant publishing service and standalone gateway adapter share the
same durable receipt repository and server current-authority source. Accepted-AI prepare and confirm
each independently:

1. reload the persisted receipt by opaque identity;
2. reload the current project, draft, and snapshot;
3. recompute proposal, review, accepted runtime, registry, manifest, package, PageBlueprint
   materialization, commerce, and approved-asset authority;
4. reject any drift before a publication write.

The editor's existing explicit Publish action carries the opaque receipt ID after successful
acceptance. The publish review does not synchronize a browser aggregate over the server-owned
accepted draft. Manual publication remains a separate authority kind and cannot fall back to or
claim accepted-AI lineage.

## Lifecycle and failure behavior

- Initial-generation and governed follow-up proposals use the same internal acceptance service.
- Preview, rejection, malformed lifecycle, stale/superseded proposal, snapshot divergence,
  persisted-draft divergence, and permission failure mint nothing.
- Accept then undo invalidates the receipt; exact eligible redo restores eligibility only when the
  full required authority matches.
- Manual edits and proposal/review/runtime or revision drift invalidate the old receipt.
- A later governed proposal acceptance uses a different acceptance action and receipt identity.
- Stale receipt or confirmation failure performs no publication write.
- Publication remains provider-free.

## Evidence and limits

Focused deterministic and integration evidence covers bounded route input, exact canonical
acceptance, initial and follow-up receipt creation, create-once retry/collision behavior, trusted
receipt reload, accepted-AI prepare/confirm re-resolution, auth/permission enforcement, undo, exact
redo, manual drift, later proposal identity, manual/AI separation, and no partial publication.

This task does not persist the compiled publication artifact or implement active-version rollback;
P10A-08C-02B owns that closure. It does not add merchant follow-up routing or scoped controls; P10C
owns normal Storefront Studio wiring.
