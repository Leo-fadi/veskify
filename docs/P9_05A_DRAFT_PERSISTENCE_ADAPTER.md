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

## Save provenance

`save(...)` obtains an explicit origin from the injected authoritative
`DraftSaveProvenanceSource`. The client request does not contain or select the origin.

For a `manualEditor` save, the adapter:

- binds the provenance record to the request, tenant, merchant, store, project and exact source
  draft;
- requires the submitted snapshot to preserve active snapshot identity, navigation, catalogue
  identity and page identities;
- derives changed pages from the active draft;
- validates the complete candidate with the existing `assembleValidatedEditorDraft(...)` and
  `saveValidatedEditorDraft(...)` workflow;
- permits canonical page and brand-system edits without requiring an AI proposal.

For an `aiProposal` save, the authoritative provenance record additionally carries the proposal
ID, proposal state and accepted snapshot. Only `accepted` is permitted. Ready, rejected, failed,
stale or closed proposals fail before persistence. The request content must exactly equal that
accepted result, which must preserve the active snapshot identity as required by the proposal
lifecycle.

The provenance source is an authority resolver only. It is not a second draft repository or a
competing proposal lifecycle.

## Persisted identity and source lineage

Manual edits and accepted proposals both retain the active draft snapshot identity until Save
draft. The adapter mints a distinct immutable saved-snapshot ID at that persistence boundary.
Proposal acceptance never creates or changes persistence identity.

The default ID combines the save timestamp with a canonical digest of trusted lineage:

- tenant, merchant, store and storefront project;
- operation and request ID;
- manual or accepted-AI origin;
- source draft ID, revision and content fingerprint;
- accepted proposal ID when applicable.

The ID is not derived from untrusted snapshot content alone. The persisted candidate is assembled
from the authoritative source draft, while that source snapshot remains immutable in history.
Callers may inject the repository environment's established ID generator through the adapter
factory.

## Optimistic concurrency and restore

Save checks the opaque project revision and the current draft ID, revision and fingerprint before
the existing validated editor-save workflow calls `ProjectRepository.saveDraft(...)` with the
repository's numeric expected base. The repository performs the final atomic compare-and-save, so
a concurrent draft cannot be overwritten.

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

## Scoped replay and idempotency

Successful operations are keyed by tenant, merchant, store, storefront project, operation type
(`save` or `restore`) and request ID. Authorization succeeds before a key is consulted or
reserved. Therefore:

- identical request IDs in different projects do not collide;
- save and restore may use the same request ID;
- an exact replay returns the prior canonical result;
- a replay that changes draft identity, revision, fingerprint, content or restore target fails.

The standalone adapter keeps these completed-operation records in process memory. They do not
survive process restart. A durable transport may implement the same scoped key at its repository
boundary.

## Local deterministic operation

The adapter is credential-free and endpoint-independent. Local operation combines:

- `createStandaloneMerchantProjectContextPort(...)`;
- `InMemoryProjectRepository` or `IndexedDbProjectRepository`;
- a deterministic application-owned save-provenance source.

The same adapter works with canonical Aurum Nordic and Karvonen aggregates while keeping project
and tenant checks at every operation.
