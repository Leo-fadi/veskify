# P9-05A — Canonical storefront draft persistence adapter

## Scope

P9-05A implements the canonical P9-01 `StorefrontDraftPersistencePort` without changing that
contract. It connects Storefront Studio draft load, save and history restore operations to the
existing `ProjectRepository`.

This adapter covers FR-108, FR-115, FR-117 and FR-118; NFR-105, NFR-108 and NFR-109; and AC-115
and AC-124. It does not add publishing, catalogue mutation, inventory, checkout, AI proposal
generation or merchant UI behaviour.

## Authority and identity

Every operation reloads the merchant and project context through the existing P9-02
`MerchantProjectContextPort`. The adapter then authorizes the exact draft or restore action and
uses the repository aggregate as the source of truth for:

- tenant and storefront-project identity;
- project revision;
- current draft ID and revision;
- current draft content fingerprint;
- immutable history target ID, revision and content fingerprint.

Standalone numeric project and snapshot revisions are exposed through deterministic opaque
revision mappings. Canonical content fingerprints use
`canonicalStorefrontContentFingerprint(...)`.

## Accepted proposal handoff

`save(...)` does not trust the snapshot carried in the integration request. An injected
`AcceptedStorefrontDraftSource` resolves the server-side result of the existing accepted-proposal
lifecycle for the request ID. Its record must be in the `accepted` state and must bind the tenant,
project and exact current-draft expectation.

The request snapshot, revision and fingerprint must exactly match that authoritative accepted
candidate. The adapter persists the resolved candidate, not an independently supplied client
snapshot. A missing, mismatched, stale or replayed candidate is rejected before the repository
write.

The source is an authority resolver only. It is not a second draft repository or a competing
proposal lifecycle.

## Optimistic concurrency and restore

Save checks the opaque project revision and the current draft ID, revision and fingerprint before
calling `ProjectRepository.saveDraft(...)` with the repository's numeric expected base. The
repository performs the final atomic compare-and-save, so a concurrent draft cannot be
overwritten.

Restore accepts only an immutable snapshot already present in the same validated project
aggregate. The client supplies target identity and fingerprint, never target content.
`ProjectRepository.restore(...)` receives the authoritative project, current-draft and target
expectations and creates a new active draft through the existing restore workflow. The immutable
target and current published snapshot remain unchanged.

## Failure normalization and atomicity

The adapter exposes only canonical `VeskoIntegrationError` codes. It preserves the most specific
P9-01 mappings available:

| Failure                                                           | Canonical code                                  |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| Missing project or cross-project snapshot                         | `projectNotFound` or `historyTargetUnavailable` |
| Tenant mismatch                                                   | `tenantMismatch`                                |
| Missing permission or mismatched merchant identity                | `permissionDenied`                              |
| Stale project revision                                            | `staleProjectRevision`                          |
| Missing/stale/current draft, draft fingerprint mismatch or replay | `draftRevisionConflict`                         |
| Missing or invalid restore target                                 | `historyTargetUnavailable`                      |
| Stale restore target revision                                     | `staleHistoryTarget`                            |
| Restore target fingerprint mismatch                               | `historyTargetFingerprintMismatch`              |
| Malformed repository aggregate or canonical snapshot              | `malformedIntegrationResponse`                  |
| Persistence boundary unavailable                                  | `unsupportedCapability`                         |

P9-01 does not define separate `draftNotFound`, `projectMismatch` or general
`persistenceUnavailable` codes, so those cases use the closest existing canonical code rather
than extending the contract.

All identity, authorization, proposal-acceptance and fingerprint failures happen before a write.
The repository remains the transaction boundary for save and restore. Its existing atomic
compare-and-write operations preserve the active draft, immutable history, published snapshot and
proposal state when persistence fails.

## Local deterministic operation

The adapter is credential-free and endpoint-independent. Local operation combines:

- `createStandaloneMerchantProjectContextPort(...)`;
- `InMemoryProjectRepository` or `IndexedDbProjectRepository`;
- a deterministic application-owned accepted-draft source.

The same adapter works with canonical Aurum Nordic and Karvonen aggregates while keeping project
and tenant checks at every operation.
