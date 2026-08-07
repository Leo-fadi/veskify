# P10A-08C-02B — Atomic Compiled Publication and Rollback Closure

**Status:** Baseline

**Evidence boundary:** contract/schema, deterministic unit, integration, and existing browser restore/publish journeys

**Provider calls:** zero

## Outcome

The authoritative manual and accepted-AI publish paths now use one server-derived transaction:

```text
trusted preparation
→ reload current authority
→ recompile exact current StorefrontSnapshot
→ compare preparation and confirmation compilation
→ commit published snapshot + compiled artifact + published version
  + history + publication operation + active pointer atomically
```

`StorefrontSnapshot` remains the sole editable storefront aggregate. Compiled artifacts and
published versions are immutable derived publication records. They do not copy or replace
operational commerce truth.

## Immutable compiled artifact

`CompiledPublicationArtifact` retains the exact renderer-ready P10A-08C-02A compiler result and
compile receipt. It binds:

- artifact contract and identity;
- compiler contract/version and result fingerprint;
- project and source snapshot identity, revision, and canonical content fingerprint;
- manual or accepted-AI source authority, including accepted receipt and proposal lineage;
- manifest, registry, profile, commerce, navigation, media, locale, and approved-asset authority
  already represented by the compile receipt;
- publication operation identity and operation key;
- creation time and a deterministic integrity fingerprint.

Reads parse the complete record, recompute its integrity fingerprint, and verify correlated
project, source, result, receipt, operation, and authority identities. Invalid or tampered records
fail with `COMPILED_PUBLICATION_INTEGRITY_FAILED`.

## Published storefront version and active pointer

Each successful publication appends one `PublishedStorefrontVersion`. It binds the immutable
published snapshot identity/fingerprint to the compiled artifact, compile receipt, source
authority, operation, predecessor version, sequence, and publication time. Older records are not
updated by later publications.

The active pointer contains only the correlated project, version, artifact, and published snapshot
identities and integrity fingerprints. Once a compiled publication exists, the configured
published projection resolves its canonical snapshot through this pointer and rejects a mismatch
with the project’s published snapshot authority.

## Atomic repository transaction

The existing `ProjectRepository.publish` transaction is the only publication write boundary. A
trusted confirmation supplies the freshly recompiled result, source authority, operation identity,
and server-retained expected active version. The repository then constructs all record identities
itself and commits:

1. canonical published snapshot and synchronized draft;
2. immutable compiled artifact;
3. immutable published storefront version/history entry;
4. completed publication operation/idempotency record;
5. active published version/artifact pointer.

The in-memory adapter stages every value before replacing authoritative state. IndexedDB uses one
read-write transaction across the existing project/snapshot/history/operation stores and the new
artifact/version/pointer stores. There is no partial-write cleanup path.

Deterministic failure injection at artifact, version, and pointer stages proves that the prior live
snapshot, artifact, version history, operation state, and pointer remain unchanged and no orphan
artifact is retained.

## Authority, idempotency, and concurrency

- Manual publication stores `kind: manual` and cannot claim an accepted receipt.
- Accepted-AI publication re-resolves the durable receipt and current proposal/snapshot authority
  during confirmation, then stores the exact accepted receipt and proposal lineage.
- The browser submits neither compiled result/receipt nor artifact, version, history, or pointer
  state.
- Exact gateway retries resolve the same durable operation result and do not append another
  version or artifact.
- Reuse of an operation key with different preconditions fails deterministically.
- The transaction compares the server-retained expected active version with current persisted
  authority. A competing publication, stale project/draft, stale receipt, or compiler drift fails
  before any pointer advance.

## Restore and explicit republish

Rollback never repoints live state to an old artifact. The supported lifecycle is:

```text
version A live
→ publish version B
→ restore version A snapshot as a new canonical draft
→ version B remains live
→ inspect or edit restored draft
→ explicit Publish recompiles the restored draft
→ new version C becomes live
```

Versions A and B remain immutable history. Version C receives a new compilation, artifact,
operation, and active pointer. An old compiled artifact is never reused as a new publication.

## Evidence

Focused deterministic and integration coverage proves:

- manual and accepted-AI artifact/version lineage;
- immutable append-only versions and exact active-pointer correlation;
- durable idempotent replay without duplicate history or artifacts;
- typed stale, drift, authority-confusion, and concurrency rejection;
- in-memory and IndexedDB failure atomicity at every derived-record stage;
- durable reload of pointer, version, artifact, published snapshot, operation, and AI lineage;
- fail-closed artifact/version tamper detection;
- restore-to-new-draft with unchanged live state and explicit fresh republish;
- zero AI-provider calls during compile, publish, restore, and republish.

## Remaining P10A publication evidence

P10A-08D-02 remains Planned. It owns the final correlated browser and retained human publication
evidence for manual and accepted-AI publication across homepage, collection, and PDP routes,
including failure, active-version, restore, and republish observations. P10A-08C-02B does not make
that final evidence or commercial visual-quality claim.
