# P12-02 — Real Vesko staging catalogue and navigation projection

## Scope and contract evidence

The repository contains no Vesko staging endpoint specification, OpenAPI document, client package,
or backend catalogue/navigation payload example. P9-05C explicitly records real staging transports
as an environment-specific integration gap. P12-02 therefore does **not** claim a live Vesko connection or name an HTTP
endpoint.

It defines the endpoint-neutral injected boundary
`StagingCatalogueNavigationTransport.load(context)`. The request carries the canonical P9-01
tenant, store, storefront-project and optional expected opaque catalogue revision. The strict
response envelope carries the same scope, an opaque `catalogueRevision`, and a P9-03
`StorefrontCatalogueProjection` fixture. These field names are Studio-owned conformance fixtures,
not asserted Vesko backend fields. Any future shared authentication or generic HTTP binding stays
outside this endpoint-specific adapter.

## Canonical mapping and ordering

The adapter validates the embedded payload with the merged P9-03 projection schema and then uses
the P9-03 projection provider for canonical normalization. It maps that result through the shared
P9 catalogue-port mapping and returns the canonical `VeskoIntegrationPorts["catalogue"]`
projection directly. The staging transport remains private to this boundary; it is not a second
catalogue port. Product IDs, collection IDs, category IDs, slugs, labels, route references,
hierarchy and navigation source order are preserved. In particular, `collection.productIds` is
never sorted or rebuilt, so Vesko merchandising order remains authoritative.

P9-03 remains the validation owner for duplicate identities, duplicate normalized route path and
locale ownership, broken memberships, primary-route mismatches, category/navigation references and
cycles. The staging boundary maps those failures to the existing P9-01 merchant-safe integration
failure taxonomy. It performs no catalogue, product, navigation, inventory, pricing, media or
enrichment mutation.

## Locale and revision behavior

Only EN and FI are admitted by the inherited canonical schemas. The adapter requires the
projection locale set to exactly equal the freshly loaded merchant/project enabled-locale set;
array order does not matter and canonical ordering is preserved by P9-03 normalization. It checks
only schema-defined localized text fields (catalogue, product, collection, category, navigation,
SEO and media-alt fields). Arbitrary commerce attributes, metadata and extension records are never
treated as localized merely because a key resembles a locale code. The opaque
`catalogueRevision` is compared only for equality with an optional caller expectation and returned
verbatim as the canonical port revision; it is never parsed, incremented, reconstructed or
converted to a local revision.

## Authorization and revalidation

Every load first reloads the P9-02 merchant/project context and requires the explicit
`view-storefront` action (`readStorefront` permission). Tenant, store and storefront-project scope
are checked before accepting the transport response. A permission change therefore blocks a later
read even if a previous load succeeded.

The adapter owns no cache. The eventual real Vesko client may add bounded transport
caching/revalidation only when its endpoint contract specifies revision/ETag semantics. Until then,
every caller load reaches the injected transport after current authorization.

## Remaining staging wiring blocker

Concrete endpoint URL, authentication headers, backend field names, response versioning and server
cache semantics remain blocked on an actual Vesko staging API/OpenAPI contract. Replacing the
fixture envelope requires only an endpoint-specific transport implementation that preserves this
adapter's request scope, opaque revision and strict response conformance; it must not change the
P9-03 canonical projection or introduce commerce mutation.
