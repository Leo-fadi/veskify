# P9-05B — Authoritative storefront publishing adapter

## Canonical P9-01 port

P9-05B implements `StorefrontPublishingGateway` from the P9-01 Vesko integration boundary. The
adapter accepts and returns the exact canonical P9-01 publish request and publication result. It
does not define a second publishing interface or alter the P9-01 schemas.

## Authoritative saved-draft source

The canonical request contains only context, request and preparation identities plus expected
saved-draft and published-snapshot identities, opaque revisions and fingerprints. Before
publishing, the adapter loads the trusted publish preparation and current project aggregate, then
resolves the current saved draft from repository persistence. A client-supplied storefront
snapshot is rejected by the strict P9-01 request schema and can never become the publish source.

## Permission and identity boundary

The adapter reloads the authenticated merchant/project context through the P9-01 context port. It
requires an exact tenant, merchant, organization, store, project and authenticated-user match and
the explicit `publishStorefront` permission in both the authenticated and requested context. Read,
save, restore and AI-related authority do not imply publishing authority. This authorization runs
for every invocation, including callers replaying a completed request or joining an in-flight
request. A completed exact replay omits only concurrency checks made stale by its own successful
publication.

## Revisions and concurrency

Integrated revisions remain opaque. The generic authoritative factory requires an injected revision
mapper supplied by the environment that issued those revisions; it never assumes a standalone
encoding. The repository-backed standalone factory injects its explicit project and snapshot
revision mappings and uses them for every precondition check. Changed project, draft, fingerprint,
published state or preparation identity fails with the corresponding P9-01 typed error.

## Atomic publication and history

The adapter delegates the write to the existing `confirmPublish` and `ProjectRepository.publish`
transaction. That transaction validates the authoritative draft, creates distinct immutable
published and synchronized-draft snapshots, advances the published and draft pointers together,
records publication history, and stores the completed publication operation. Any repository
failure leaves the prior published storefront unchanged; multi-page snapshots are committed as one
aggregate.

## Idempotency and draft preservation

Completed idempotency is authoritative repository state rather than process memory. The operation
identity is scoped by tenant, merchant, organization, store, storefront project, operation type
(`publish`) and request ID. Its durable record binds that identity to the complete canonical
request fingerprint, the canonical publication result, the committed repository revision and the
created published snapshot. The repository writes this record in the same transaction as
snapshots, project pointers and publication history. The same request ID can therefore be reused
safely in another tenant or project scope, while reuse in one scope with different preconditions
fails as stale.

Before publication, the adapter authorizes the caller and checks this durable operation record. An
exact completed replay returns the stored canonical result without republishing. If the repository
commits but its response is lost, rejected or times out, the adapter queries the same scoped
operation identity. A matching committed record converts the ambiguous response into success
without duplicate history; a definitely absent record permits a safe later retry. If operation
storage cannot establish commitment, the adapter reports publishing as unavailable and every later
attempt checks authoritative storage again before attempting a transaction.

Process-local state contains only currently in-flight promises, keyed by the same scoped operation
identity and request fingerprint. Each duplicate caller is authorized before it may join. Entries
are removed deterministically after settlement, so there is no completed-result cache, retention
window or memory growth tied to historical publication count. Durable operation-record retention
is owned by the authoritative repository; this adapter does not prune it.

Publishing never accepts a draft body and never overwrites the source draft in place. The existing
repository keeps the source snapshot as history and creates a distinct synchronized active draft,
so saved-draft and published identities remain separate after success.

## Typed failures

P9-05B normalizes permission, tenant, merchant, project, project-revision, saved-draft,
published-state, preparation, repository-validation and availability failures to merchant-safe
`VeskoIntegrationError` codes. Raw repository and transport errors are not exposed.

## Standalone behavior

`createStandaloneAuthoritativePublishingAdapter` is credential-free and repository-backed. It uses
the same strict request, permission, concurrency, atomicity and idempotency behavior for Aurum and
Karvonen fixtures and contains no live Vesko endpoint.

## Non-goals

P9-05B does not save or restore drafts, mutate catalogue or inventory, connect a live transport,
redesign UI, publish automatically after proposal acceptance, enrich products, or create another
published-history model.
