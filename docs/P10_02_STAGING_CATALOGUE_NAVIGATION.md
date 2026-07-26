# P10-02 — Staging catalogue and navigation projection

## Scope and contract evidence

The repository contains no Vesko staging endpoint specification, OpenAPI document, client package,
or backend catalogue/navigation payload example. P9-05C explicitly records real staging transports
as a Phase 10 gap. P10-02 therefore does **not** claim a live Vesko connection or name an HTTP
endpoint.

It defines the endpoint-neutral injected boundary
`StagingCatalogueNavigationTransport.load(context)`. The request carries the canonical P9-01
tenant, store, storefront-project and optional expected opaque catalogue revision. The strict
response envelope carries the same scope, an opaque `catalogueRevision`, and a P9-03
`StorefrontCatalogueProjection` fixture. These field names are Studio-owned conformance fixtures,
not asserted Vesko backend fields. P10-01 owns any later shared authentication or generic HTTP
binding; this adapter accepts an already injected endpoint-specific transport.

## Canonical mapping and ordering

The adapter validates the embedded payload with the merged P9-03 projection schema and then uses
the P9-03 projection provider for canonical normalization. It returns that normalized projection
unchanged alongside the opaque staging catalogue revision. Product IDs, collection IDs, category
IDs, slugs, labels, route references, hierarchy and navigation source order are preserved. In
particular, `collection.productIds` is never sorted or rebuilt, so Vesko merchandising order
remains authoritative.

P9-03 remains the validation owner for duplicate identities, duplicate normalized route path and
locale ownership, broken memberships, primary-route mismatches, category/navigation references and
cycles. The staging boundary maps those failures to the existing P9-01 merchant-safe integration
failure taxonomy. It performs no catalogue, product, navigation, inventory, pricing, media or
enrichment mutation.

## Locale and revision behavior

Only EN and FI are admitted by the inherited canonical schemas. The adapter additionally requires
projection-supported locales to be enabled in the freshly loaded merchant/project context and
rejects localized values for a locale outside the projection scope. The opaque
`catalogueRevision` is compared only for equality with an optional caller expectation and returned
verbatim; it is never parsed, incremented, reconstructed or converted to a local revision.

## Authorization and revalidation

Every load first reloads the P9-02 merchant/project context and requires the explicit
`view-storefront` action (`readStorefront` permission). Tenant, store and storefront-project scope
are checked before accepting the transport response. A permission change therefore blocks a later
read even if a previous load succeeded.

The adapter owns no cache. P10-01 or the eventual real Vesko client may add bounded transport
caching/revalidation only when its endpoint contract specifies revision/ETag semantics. Until then,
every caller load reaches the injected transport after current authorization.

## Remaining staging wiring blocker

Concrete endpoint URL, authentication headers, backend field names, response versioning and server
cache semantics remain blocked on an actual Vesko staging API/OpenAPI contract. Replacing the
fixture envelope requires only an endpoint-specific P10-01 transport implementation that preserves
this adapter's request scope, opaque revision and strict response conformance; it must not change
the P9-03 canonical projection or introduce commerce mutation.
