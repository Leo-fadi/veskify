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
save, restore and AI-related authority do not imply publishing authority.

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
and records publication history. Any repository failure leaves the prior published storefront
unchanged; multi-page snapshots are committed as one aggregate.

## Idempotency and draft preservation

Successful request IDs are retained by an adapter instance with a fingerprint of the complete
canonical request. Completed replay entries use bounded oldest-first eviction (256 by default).
Exact sequential or concurrent replays return the same publication result and do not create
duplicate history. A completed replay reloads current authenticated identity and explicit publish
authority before returning its result, while intentionally omitting the revision check that changed
as a consequence of the publication. Reusing a request ID with different preconditions fails as
stale.

If the repository commits atomically but its response is lost or rejected, the adapter reloads and
reconciles project revision, source and prior snapshot identities, fingerprints, current published
and synchronized draft content, and publication-history metadata. A verified commit becomes the
successful idempotency result; only an operation with no matching authoritative commit is removed
from the retry cache.

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
