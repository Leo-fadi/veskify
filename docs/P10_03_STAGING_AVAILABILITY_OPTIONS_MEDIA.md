# P10-03 — Vesko staging availability, options, variants and media

## Transport boundary

`createVeskoStagingAvailabilityOptionMediaAdapter` accepts an injected
`fetchProductProjection` client. It intentionally contains no URL construction, HTTP client,
authentication-token acquisition or credential storage. The endpoint-specific response is a
strict envelope with `authorization` and `projection` fields. The current repository contains no
Vesko staging OpenAPI document or confirmed endpoint URL, so live wiring remains an environment
handoff blocker.

## Backend fields and canonical mapping

The fixture/transport contract uses the merged P9-04 projection field names: tenant/store/project,
catalogue and opaque projection revisions, supported locales, availability records, attributes,
ordered option groups and values, dependency declarations, text-entry constraints, variants
(`variantId`, `sku`, option-value IDs, availability ID, authorized price, media IDs and
purchasability), and product/variant media (`assetId`, role, variant IDs, localized alt and
`decorative`). The adapter passes these fields unchanged to the P9-04 canonical validator and
resolver, preserving source order, stable IDs, prices, SKUs and media ownership. No options,
variants, inventory values or media are synthesized.

Availability and sellability remain Vesko-owned. Storefront Studio only consumes storefront-safe
status, stock-display, purchasability and localized expected messages; it never mutates stock or
availability. The P9-04 resolver owns dependency compatibility, partial disabled values and the
sole zero-dimension variant rule.

## Identity, revision and authorization

The envelope must carry current `view-storefront` authority for the same tenant, store and
storefront project as the request. P9-04 then checks product identity and the optional expected
projection revision. Catalogue identity/revision is retained in the projection and is joined by
the existing P9-04 PDP bridge. Mismatches, stale revisions and malformed payloads become typed
merchant-safe integration failures. The returned projection is validated, normalized and frozen
by P9-04; the staging client cannot mutate source data.

## Media behavior

Product-wide and variant-specific media remain canonical and read-only. P9-04 validates both
directions of variant-media associations, keeps localized alt text, and prevents another
variant's media from entering a resolved configuration. Decorative media remains decorative and
does not acquire an accessibility name through product-title fallback.

## Missing contract details

No repository evidence identifies the staging host, route, authentication exchange, request
headers, pagination envelope, or backend field aliases. These must be supplied by Vesko staging
owners before a live client is enabled. This PR therefore provides strict fixture-compatible
mapping only and makes no live network calls.
